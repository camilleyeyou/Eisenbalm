# Quick Task 260621-d31: Fix per-agent OpenRouter cost/token capture — Research

**Researched:** 2026-06-21
**Domain:** LangChain (`langchain-openai` / `langchain-core`) structured output + OpenRouter usage accounting
**Confidence:** HIGH (all library behavior verified against installed source in `.venv`; OpenRouter cost field cross-checked with official docs)

## Summary

`acomplete()` in `lib/openrouter_client.py` has TWO LLM paths. The **plain-text path** (lines 205-230) already reads real token counts from `result.usage_metadata` — but its USD math is wrong (it reads non-existent `usage["input_cost"]`/`["output_cost"]` keys, so `usd` is always `0.0`). The **structured-output path** (lines 167-203) hardcodes `tokens_in=tokens_out=usd=0` with a TODO, because `with_structured_output(Model)` returns the bare Pydantic object with no access to the underlying `AIMessage`. Both bugs make `record_cost(...)` accumulate `$0`, which keeps `CostRecorder.check_cap()` permanently below the cap — the per-run cost cap is inert.

**Two fixes, one mechanism:**
1. Switch structured calls to `with_structured_output(Model, include_raw=True)` so you get back `{"raw": AIMessage, "parsed": Model, "parsing_error": ...}` — `raw.usage_metadata` gives real tokens, `raw.response_metadata["token_usage"]["cost"]` gives real USD.
2. Enable OpenRouter **usage accounting** by adding `usage={"include": True}` to the request (`extra_body` on `ChatOpenAI`). OpenRouter then returns `usage.cost` (authoritative USD), which `langchain-openai` 1.2.1 passes through verbatim into `response_metadata["token_usage"]`.

**Primary recommendation:** Use OpenRouter usage accounting (option 2a) — NOT a local price table. It is authoritative, zero-maintenance, and already surfaces through the pinned `langchain-openai` with no code in LangChain stripping it.

## Project Constraints (from CLAUDE.md)

- Per-run AI cost containment "matters" — this task re-arms the safety mechanism, directly aligned.
- Stack is locked (OpenRouter + LangGraph). No new dependencies needed — `langchain-openai==1.2.1` already does everything.
- Must route every LLM call through `acomplete()` (D-14, AGT-17). Do not add a second call site.

## Verified Library Versions (installed in `.venv`)

| Package | Version | Source |
|---------|---------|--------|
| `langchain-openai` | **1.2.1** | `pyproject.toml` + `.dist-info` |
| `langchain-core` | **1.4.0** | `.dist-info` (transitive) |
| `pydantic` | 2.13.4 | `pyproject.toml` |
| `respx` | >=0.21 | dev group (available for HTTP-level mocks if ever needed) |

---

## Q1 — Token capture with structured output (`include_raw=True`)

**Exact return shape** (verified in `langchain_core/language_models/chat_models.py:2357-2377`):

> "The final output is always a `dict` with keys `'raw'`, `'parsed'`, and `'parsing_error'`."
> - `'raw'`: `BaseMessage` (the `AIMessage`)
> - `'parsed'`: `None` if there was a parsing error, otherwise the typed Pydantic object
> - `'parsing_error'`: `BaseException | None`

So:
```python
structured = llm.with_structured_output(response_format, include_raw=True)
result = await structured.ainvoke(messages)
raw = result["raw"]            # AIMessage
parsed = result["parsed"]      # response_format instance or None
parse_err = result["parsing_error"]  # BaseException or None
```

**Reading token usage from `raw`** — `raw.usage_metadata` is a normalized `UsageMetadata` TypedDict with these exact field names (verified in `_create_usage_metadata`, base.py:3984):
- `input_tokens` (int)
- `output_tokens` (int)
- `total_tokens` (int)

```python
usage = getattr(raw, "usage_metadata", None) or {}
tokens_in = int(usage.get("input_tokens", 0) or 0)
tokens_out = int(usage.get("output_tokens", 0) or 0)
```
This mirrors what the plain-text path already does — the field names are identical. (Note `usage_metadata` does NOT carry cost; see Q2.)

**Retry-with-corrective-message branch:** With `include_raw=True`, a parse failure does **NOT** raise. LangChain wraps the parser in `.with_fallbacks([...], exception_key="parsing_error")` (verified base.py:2492-2498), so a malformed model output comes back as `{"raw": <AIMessage>, "parsed": None, "parsing_error": <exc>}`. The current code's `try/except Exception` will therefore NOT catch a schema-validation miss anymore — you must detect failure by inspecting the dict:

```python
result = await structured.ainvoke(messages)
if result["parsed"] is None:   # parse failed OR refusal
    # retry once with corrective message (preserve existing D-14 behavior)
    retry_messages = messages + [{"role": "user", "content": f"Previous output failed schema validation: {result['parsing_error']}. Return JSON strictly matching the schema."}]
    result = await structured.ainvoke(retry_messages)
parsed = result["parsed"]
raw = result["raw"]
if parsed is None:
    # second failure — preserve D-14 "propagate" contract
    raise result["parsing_error"] or OutputParserException("structured output failed twice")
```
Keep the existing `try/except` too, to catch genuine transient/network errors from `ainvoke` itself (those still raise). The two failure modes are now distinct: exception = transport error; `parsed is None` = schema/refusal miss. **Record cost from `raw` regardless of which path won** (record once — see Pitfalls).

---

## Q2 — USD cost: the authoritative path (RECOMMENDED: OpenRouter usage accounting)

### Recommendation: Option (a) — OpenRouter usage accounting. Do NOT build a price table.

**Why authoritative:** OpenRouter returns the real charged amount inline in every chat-completion response under `usage.cost` (USD credits) when you opt in. From official docs (https://openrouter.ai/docs/cookbook/administration/usage-accounting): enabling usage accounting returns token counts AND `usage.cost`, plus `usage.cost_details` (`upstream_inference_cost`, `cache_discount`), with no extra API call. This is the exact dollar figure OpenRouter bills — strictly better than recomputing from a price table.

**How to enable** — add `usage: {include: true}` to the request body. With `ChatOpenAI` (OpenAI-compatible client) this goes through `extra_body`. The client already sets `extra_body` in `_build_chat_model` (lines 94-107) for the Anthropic provider pin, so merge into it:

```python
extra_body: dict[str, Any] = {"usage": {"include": True}}
if model_id.startswith("anthropic/"):
    extra_body["provider"] = {"order": ["Anthropic"], "allow_fallbacks": False}
```

### WHERE the cost surfaces in the LangChain result — VERIFIED in installed source

This is the crux. Traced through `langchain-openai==1.2.1`:

1. `_create_chat_result` (base.py:1756, 1775) puts the **entire raw `usage` object** from the response into `llm_output["token_usage"]`:
   ```python
   token_usage = response_dict.get("usage")   # the full OpenRouter usage dict, incl. "cost"
   ...
   llm_output = {"token_usage": token_usage, "model_provider": "openai", "model_name": ...}
   ```
   `_create_usage_metadata` (base.py:3984) builds the normalized `usage_metadata` separately and **drops `cost`** (only token fields survive). So **cost is NOT in `usage_metadata`** — it rides along in the raw `token_usage`.

2. `langchain_core` then spreads `llm_output` into the message's `response_metadata` (chat_models.py:1990-1994):
   ```python
   result.generations[0].message.response_metadata = {**result.llm_output, **result.generations[0].message.response_metadata}
   ```

**Therefore the cost lands at:**
```python
raw.response_metadata["token_usage"]["cost"]            # USD float (authoritative)
raw.response_metadata["token_usage"].get("cost_details")  # {"upstream_inference_cost": ..., "cache_discount": ...}
```

### Exact extraction code (works for BOTH the structured `raw` and the plain-text `result`)

```python
def _usage_from_message(msg: Any, fallback_model: str) -> dict[str, Any]:
    um = getattr(msg, "usage_metadata", None) or {}
    rm = getattr(msg, "response_metadata", None) or {}
    token_usage = rm.get("token_usage") or {}
    cost = token_usage.get("cost")  # OpenRouter usage accounting
    usd = float(cost) if cost is not None else 0.0
    return {
        "tokens_in": int(um.get("input_tokens", 0) or 0),
        "tokens_out": int(um.get("output_tokens", 0) or 0),
        "usd": usd,
        "resolved_model": rm.get("model_name") or rm.get("model") or fallback_model,
    }
```
Note: `langchain-openai` 1.2.1 writes the resolved model into `response_metadata["model_name"]` (base.py:1779) — the current code reads `response_metadata.get("model", ...)` (line 216) which is also present via `_combine_llm_outputs` but `model_name` is the canonical key in this version. Read `model_name` first, fall back to `model`, then the static pin.

### Why NOT option (b) — local price table

A per-model `{model: (price_in, price_out)}` table requires manual maintenance every time OpenRouter changes prices or you change the model pin (`MODEL_PIN_VOICE_CRITICAL` already names a snapshot that will rotate). It also cannot see cache discounts or BYOK pricing. Usage accounting eliminates all of that. Only fall back to a table if usage accounting ever returns `cost: null` for a provider — in which case log a warning and record `0.0` (the cap stays conservative, not falsely tripped).

---

## Q3 — Test strategy (no real API)

### How existing tests mock the LLM today

- **Agent unit tests** (e.g. `tests/agents/test_calibrator.py`) and the e2e wiring test (`tests/test_pipeline_real_mode.py`) patch **`acomplete` itself**, at each agent's import site (e.g. `patch("eisenbalm_pipeline.agents.calibrator.acomplete", side_effect=_mock_acomplete)`). They never touch `ChatOpenAI`. The mock returns `(parsed_obj, usage_dict)` with a hardcoded `usage = {"tokens_in":100,"tokens_out":50,"usd":0.01,...}`. **These do not exercise the real token/cost extraction inside `acomplete`** — they bypass it.
- **Cost tests** (`tests/lib/test_cost.py`) call `record_cost`/`CostRecorder` directly with literal USD values and patch `convex_mutation_safe` at `eisenbalm_pipeline.lib.convex_client.convex_mutation_safe`.

**Conclusion:** there is currently NO test that drives `acomplete`'s real-mode extraction. The new test must patch INSIDE `openrouter_client` — at `_build_chat_model` (or the `ChatOpenAI` it returns) — so the structured/plain path runs for real against a fake `AIMessage`.

### Patch point + fake-message construction for the new test

Patch `_build_chat_model` to return a fake model whose `with_structured_output(...).ainvoke(...)` yields the `include_raw` dict, and whose `.ainvoke(...)` (plain path) yields a fake `AIMessage`:

```python
from unittest.mock import AsyncMock, MagicMock, patch
from langchain_core.messages import AIMessage

def _fake_raw_message():
    return AIMessage(
        content="",
        usage_metadata={"input_tokens": 1200, "output_tokens": 350, "total_tokens": 1550},
        response_metadata={
            "model_name": "anthropic/claude-opus-4-7",
            "token_usage": {
                "prompt_tokens": 1200, "completion_tokens": 350, "total_tokens": 1550,
                "cost": 0.0271,  # OpenRouter usage accounting
            },
        },
    )

async def test_structured_capture_records_real_cost(monkeypatch):
    monkeypatch.setenv("EISENBALM_STUB_MODE", "false")
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    begin_run("run-cap-1")

    structured = MagicMock()
    structured.ainvoke = AsyncMock(return_value={
        "raw": _fake_raw_message(),
        "parsed": StyleBriefOutput.model_construct(),
        "parsing_error": None,
    })
    fake_model = MagicMock()
    fake_model.with_structured_output.return_value = structured

    with patch("eisenbalm_pipeline.lib.openrouter_client._build_chat_model", return_value=fake_model):
        parsed, usage = await acomplete(
            agent_id="calibrator", run_id="run-cap-1",
            messages=[{"role": "system", "content": "x"}],
            response_format=StyleBriefOutput,
        )
    assert usage["tokens_in"] == 1200
    assert usage["tokens_out"] == 350
    assert usage["usd"] == pytest.approx(0.0271)
    payload = get_cost_payload("run-cap-1")
    assert payload["agents"]["calibrator"]["usd"] == pytest.approx(0.0271)  # recorded exactly once
```

For the **plain-text path**, set `fake_model.ainvoke = AsyncMock(return_value=_fake_raw_message())` and call `acomplete` with `response_format=None`.

For the **retry branch**, return `{"raw": ..., "parsed": None, "parsing_error": ValueError("bad")}` on the first `ainvoke` call and a good dict on the second (use `side_effect=[bad, good]`), then assert `structured.ainvoke.call_count == 2` and cost recorded from the SECOND `raw` only.

Patch target string: `"eisenbalm_pipeline.lib.openrouter_client._build_chat_model"` (it is defined and called in that module, so patching there is correct).

---

## Q4 — Pitfalls

1. **Double-counting tokens (the additivity trap).** `record_cost` is ADDITIVE (cost.py:98-109): repeated calls for the same `(run_id, agent_name)` sum. TWO places call it per agent run:
   - `acomplete()` (the path you're fixing) — records `tokens_in/out` + `usd`, `duration_ms=0`.
   - `@agent_node` wrapper (`agents/_wrapper.py:121`) — records `tokens_in=0, tokens_out=0, usd=0.0, duration_ms=<real>`.
   This split is intentional and currently NON-overlapping (wrapper contributes only duration; acomplete contributes only tokens/usd). **Keep it that way.** Do NOT also start recording tokens in the wrapper, and within `acomplete` record cost from exactly ONE message per call (the final/successful `raw`), never from both the failed and retried attempt. If an agent calls `acomplete` multiple times legitimately (e.g. Scout tool loop), additivity is correct and desired.

2. **Stub-mode path must keep returning 0.** The `is_stub_mode()` short-circuit (lines 141-162) must remain untouched: `record_cost(..., 0, 0, 0.0)` and `resolved_model="fake-openrouter-stub"`. `test_stub_mode_acomplete_short_circuits` asserts exactly this and must stay green.

3. **Preserve the return contract.** `acomplete` must still return `(parsed_or_content, usage_dict)` where `usage_dict` has keys `tokens_in, tokens_out, usd, resolved_model`. The structured path returns the `parsed` Pydantic object (NOT the `{"raw",...}` dict) as the first element — unwrap `result["parsed"]`. Agents downstream expect the bare model.

4. **`check_cap()` must run after recording REAL usd.** Currently `check_cap` runs but always sees `$0`. Once real `usd` is recorded it can raise `CostCapExceeded`, which `@agent_node` translates to `status='failed'`. This is the intended re-arming — but verify any test that runs many agents under the default `PIPELINE_COST_CAP_USD=10.0` doesn't now trip. The e2e `test_pipeline_real_mode.py` patches `acomplete` wholesale, so it is unaffected (its mock returns `usd=0.01` and never calls the real recorder path). Real cost only flows when `acomplete` runs unpatched.

5. **`cost` may be absent.** If usage accounting isn't echoed by a provider, `token_usage.get("cost")` is `None` → record `0.0` (don't crash). Same defensive `or 0.0` pattern as tokens.

6. **`include_raw=True` changes failure semantics** (see Q1) — the old `except OutputParserException` will silently stop catching schema misses. Detect via `result["parsed"] is None`. This is the single most likely regression if overlooked.

---

## Code Examples — target shape for the structured path

```python
if response_format is not None:
    structured = llm.with_structured_output(response_format, include_raw=True)
    try:
        result = await structured.ainvoke(messages)
    except Exception as exc:  # transport/transient only now
        log.warning("acomplete %s: invoke error, retrying once: %r", agent_id, exc)
        result = await structured.ainvoke(messages)
    if result["parsed"] is None:  # schema/refusal miss (no longer raises)
        retry_messages = messages + [{"role": "user", "content":
            f"Previous output failed schema validation: {result['parsing_error']}. "
            f"Return JSON strictly matching the schema."}]
        result = await structured.ainvoke(retry_messages)
    parsed = result["parsed"]
    raw = result["raw"]
    if parsed is None:
        raise result["parsing_error"] or RuntimeError(f"{agent_id}: structured output failed twice")

    u = _usage_from_message(raw, MODEL_BY_AGENT[agent_id])
    record_cost(run_id, agent_id, tokens_in=u["tokens_in"], tokens_out=u["tokens_out"], usd=u["usd"])
    recorder = get_recorder(run_id); recorder._last_agent = agent_id
    await recorder.check_cap()
    return parsed, u
```
The plain-text path (lines 205-230) collapses to the same `_usage_from_message(result, ...)` helper — fixing its broken `usage["input_cost"]` math as a side effect.

---

## Open Questions

1. **Does OpenRouter return `usage.cost` for the Anthropic-pinned provider in THIS account's plan?** HIGH confidence it does for standard (non-BYOK) requests per docs, but the only definitive proof is one live call. Recommendation: the plan should include a one-line live smoke (Andrew's existing real-run harness) asserting `usd > 0` for at least one agent after the fix. The unit test proves the extraction logic; the smoke proves OpenRouter actually emits the field.

## Sources

### Primary (HIGH)
- Installed `langchain_core/language_models/chat_models.py` (v1.4.0): `with_structured_output` docstring lines 2357-2377 (return shape), 2488-2500 (`include_raw` fallback / `parsing_error` semantics), 1990-1994 (`llm_output` → `response_metadata` merge).
- Installed `langchain_openai/chat_models/base.py` (v1.2.1): `_create_chat_result` lines 1714-1795 (`token_usage = response.usage` → `llm_output["token_usage"]`), `_create_usage_metadata` lines 3984+ (cost dropped from `usage_metadata`).
- OpenRouter usage accounting docs — `usage: {include: true}` returns `usage.cost` + `usage.cost_details`: https://openrouter.ai/docs/cookbook/administration/usage-accounting
- Project files read: `lib/openrouter_client.py`, `lib/cost.py`, `agents/_wrapper.py`, `lib/llm_config.py`, `tests/test_pipeline_real_mode.py`, `tests/lib/test_cost.py`, `tests/agents/test_calibrator.py`, `pyproject.toml`.

### Secondary (MEDIUM)
- WebSearch confirmation of `usage.cost` / `cost_details` field names and BYOK caveat for `/generation` endpoint.

## Metadata
- Standard stack: HIGH — exact versions read from `.venv`.
- Cost surfacing path: HIGH — traced line-by-line through installed source, not training data.
- OpenRouter emits `cost` in practice for this account: MEDIUM — doc-backed, needs one live smoke.
- Research date: 2026-06-21 · Valid until: ~30 days (stable pins; re-verify if `langchain-openai` bumped).
