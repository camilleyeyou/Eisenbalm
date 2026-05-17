---
phase: 05-agent-quality
plan: 09
subsystem: pipeline
tags: [researcher, verify-research, tavily, httpx, selectolax, agt-07, agt-08, agt-09, agt-17, agt-18, sonnet, dataflow-contract]

# Dependency graph
requires:
  - phase: 04-pipeline-skeleton
    provides: "@agent_node decorator (max_tool_calls attribute), Phase 4 Researcher stub (replaced), graph/builder.py StateGraph topology (7 parallel section writers), DispatchState['research'] field"
  - phase: 05-agent-quality
    provides: "lib/voice.VOICE_CONSTRAINTS, lib/openrouter_client.acomplete (kwargs-only with agent_id='researcher'), lib/llm_config MODEL_BY_AGENT['researcher']=Sonnet, MAX_TOKENS_BY_AGENT['researcher']=20000, lib/search_client.web_search (Tavily wrapper, stub-mode-safe), lib/errors.AgentToolCallLimitExceeded (3-arg constructor), Plan 05-02 ResearchOutput TypedDict extensions (founderNameSourceUrl, subjectNameSourceUrl, founderRole, subjectRole, founderNameVerified, subjectNameVerified — NotRequired/Optional), selectolax==0.4.9 dep (Plan 05-02), httpx==0.28.1 dep (Phase 4), Plan 05-04 test skeletons (test_researcher.py + test_verify.py — skip-marked, replaced)"
provides:
  - "Real Sonnet-driven Researcher body — replaces Phase 4 stub"
  - "ResearchOutputModel Pydantic (13 fields, all defaults set for stub-mode model_construct() safety) — emits founderName + founderNameSourceUrl + founderRole + subjectName + subjectNameSourceUrl + subjectRole (AGT-07 + D-12)"
  - "MAX_TOOL_CALLS=12 constant + local-counter enforcement raising AgentToolCallLimitExceeded with 3-arg introspection (AGT-18)"
  - "_build_queries helper: 5 Tavily queries keyed off charity name + domain (site:domain when website available)"
  - "_build_messages helper: system prompt embeds VOICE_CONSTRAINTS verbatim + verification-or-anonymous rule (D-11 + D-12)"
  - "agents/verify.py — standalone non-@agent_node verify_research node (D-11)"
  - "_fetch_text(url): httpx.AsyncClient(timeout=10.0, follow_redirects=True, Mozilla UA) + selectolax HTMLParser strip. Returns None on ANY failure (timeout, 4xx/5xx, SSL, DNS, parse). Conservative AGT-08 fallback."
  - "_name_in_text(name, text): case-insensitive substring + last-name fallback (D-11). Empty name or empty text => False."
  - "verify_research sets founderNameVerified + subjectNameVerified on state['research'] — single bottleneck before section-writer fan-out"
  - "graph/builder.py: verify_research wired between researcher and the 7 parallel section writers — replaces 7 direct researcher->writer edges with 1 researcher->verify_research edge + 7 verify_research->writer edges"
  - "AGT-17 modelVersions['researcher'] capture inherited from Plan 05-05 Calibrator + Plan 05-08 Editor pattern"
affects: [05-10-section-writers, 05-13-qa-and-editor-final, 05-14-real-mode-integration-test, 05-15-andrew-smoke-and-docs]

# Tech tracking
tech-stack:
  added: []  # no new pip deps; reuses Plan 05-02 selectolax + Plan 05-03 lib scaffolding
  patterns:
    - "Dataflow contract bottleneck: verify_research is a single non-LLM async node inserted between Researcher and the 7 parallel section writers. It is the ONLY place *Verified booleans are set; all writers consume them from state['research'] without doing their own verification."
    - "Standalone (non-@agent_node) node pattern: verify_research has no LLM call, no deliberationEvents emission, no cost recording, no model_versions update. LangGraph nodes are not required to be @agent_node — that decorator is for agents that need cross-cutting concerns (event emission + cost recording + failure handling). Verification has none of those concerns; it's a pure data transformation."
    - "Conservative verification posture: ANY httpx error (timeout, 4xx/5xx, SSL, DNS, connection) OR parse failure collapses to verified=False. False negatives (true founder marked unverified) are acceptable because the D-12 anonymous-by-role fallback reads as deliberate Fortune-500 anonymity. False positives (wrong name confirmed) would ship factual errors and are unacceptable."
    - "Researcher tool-limit pattern (mirrors Scout AGT-18): local int counter incremented BEFORE each web_search call; raises AgentToolCallLimitExceeded when tool_calls >= MAX_TOOL_CALLS. Two raise sites — one in-loop (pre-check before increment), one post-loop (belt-and-braces guard for patched query lists in tests). 3-arg constructor preserves agent_id + attempts + limit as introspectable attributes."
    - "ResearchOutputModel Pydantic with defaults on all non-list fields: matches Plan 05-05 StyleBriefOutput pattern. Pydantic.model_construct() (used by FakeOpenRouterClient.acomplete via lib/openrouter_client.acomplete's stub-mode branch) skips validation and falls back to defaults — so stub-mode unit tests work without supplying every field."

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/agents/verify.py
    - .planning/phases/05-agent-quality/05-09-researcher-and-verify-SUMMARY.md
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
    - packages/pipeline/tests/agents/test_researcher.py
    - packages/pipeline/tests/agents/test_verify.py

key-decisions:
  - "Researcher's `agent_id` is 'researcher' (verbatim) — matches MODEL_BY_AGENT, SAMPLING_BY_AGENT, MAX_TOKENS_BY_AGENT, and @agent_node(name='researcher') (Sanity agentProfile.agentId)."
  - "emit_event='section-draft' preserved from plan: research IS a section-draft for live deliberation visualization purposes. The decorator emits one deliberationEvents row on the success path."
  - "ResearchOutputModel field defaults set on summary, founderBio, subjectStory (all '') even though the plan's Pydantic model in <interfaces> showed them as required. Default-fallback approach matches Plan 05-05 StyleBriefOutput so that stub-mode (FakeOpenRouterClient + model_construct()) works without TypeError."
  - "_build_queries returns 5 queries (under MAX_TOOL_CALLS=12). The remaining budget is reserved for Plan 05-14 real-mode integration test extensions (e.g., re-query when initial Tavily batch is empty)."
  - "Tool-limit defensive guard outside the for-loop mirrors Scout's belt-and-braces pattern: even if the iteration limit check is bypassed via test patching of _build_queries with a longer list, the post-loop comparison catches the overrun."
  - "Researcher does NOT clear founderName/subjectName when verified is False. The fields stay as Researcher emitted them; Plan 05-10's section writers will null them out before passing to lib/voice.build_section_writer_prompt() per RESEARCH §FounderBioWriter line 637 + Pitfall 5."
  - "verify_research returns ONLY {'research': research} (state-update dict) — NOT a merged state copy. LangGraph's TypedDict reducer merges this delta back into DispatchState; matches the section-writer return shape."
  - "graph/builder.py edge replacement: 7 direct researcher->writer edges removed, replaced with 1 researcher->verify_research + 7 verify_research->writer. The SECTION_WRITERS tuple is unchanged; only the loop's source node moves from 'researcher' to 'verify_research'."
  - "verify_research import is added AFTER the 'validate' import alphabetically — keeps the existing alphabetical sort of agent imports in graph/builder.py."

patterns-established:
  - "Standalone node template: plain async def returning a state-update dict, no decorator, no LLM call. Imports only graph.state.DispatchState and the libs needed for its specific computation. Future non-LLM transformations (none currently planned in Phase 5) can follow this template."
  - "Researcher + verify pairing: Researcher emits both the data AND the source URLs in one structured-output call; a downstream non-LLM node fetches each URL and emits *Verified booleans. This pattern decouples LLM-driven name extraction from the deterministic verification step — easier to test (mock _fetch_text returns) and easier to replace verification later (e.g., add Charity Navigator fallback per RESEARCH §deferred Q4) without re-running the LLM."

requirements-completed: [AGT-07, AGT-08, AGT-09, AGT-18]

# Metrics
duration: ~10min
completed: 2026-05-17
---

# Phase 5 Plan 09: Researcher + Verify Research Summary

**Real Sonnet-driven Researcher that emits names + source URLs, plus a standalone non-LLM verify_research node that fetches the source URLs via httpx, strips HTML via selectolax, and sets the *Verified booleans on state['research'] — the single bottleneck before the 7 parallel section writers consume verified research.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-17T18:26:08Z (per init)
- **Completed:** 2026-05-17 (this commit batch)
- **Tasks:** 4 (TDD pattern: RED+GREEN for Researcher, RED+GREEN for verify_research, then graph-builder edit)
- **Files modified:** 4 (researcher.py, verify.py, builder.py, plus 2 test files replaced from skeletons)
- **Tests added:** 13 (4 Researcher + 9 verify_research). All pass. Full pipeline suite: 55 passed / 39 skipped / 0 failed.

## Accomplishments

- Replaced the Phase 4 Researcher stub (3-line return of `fixtures.research_output()`) with a real Tavily-driven Sonnet implementation that:
  - Builds 5 Tavily search queries from the winning charity's name + website domain (`site:` filter when domain available).
  - Enforces `MAX_TOOL_CALLS=12` per AGT-18 + D-21 with a local counter inside the body (the `@agent_node(max_tool_calls=12)` decorator parameter mirrors the constant — the body does the actual enforcement; the decorator stores the value for introspection only).
  - Calls `acomplete(agent_id="researcher", run_id=run_id, ...)` with `response_format=ResearchOutputModel` for Pydantic-validated structured output.
  - Records the resolved model into `state['model_versions']['researcher']` (AGT-17).
- Added `agents/verify.py` — a new standalone non-`@agent_node` async function that:
  - Reads `state['research']['founderName']` + `['founderNameSourceUrl']` (and the subject equivalents).
  - Fetches each URL via `httpx.AsyncClient(timeout=10.0, follow_redirects=True)` with a desktop `Mozilla/5.0 (compatible; EisenbalmBot/1.0)` User-Agent header.
  - Strips HTML to text via `selectolax.parser.HTMLParser` (`tree.css("body *")` text extraction).
  - Matches the name case-insensitively with a last-name fallback (`_name_in_text` helper).
  - Sets `founderNameVerified` + `subjectNameVerified` booleans on `state['research']`.
  - Falls back to `verified=False` on ANY exception (httpx timeout, 4xx/5xx, SSL, DNS, parse error) — conservative posture per AGT-08.
- Patched `graph/builder.py` to insert `verify_research` as a single bottleneck between `researcher` and the 7 parallel section writers. Replaced 7 direct `researcher`->writer edges with 1 `researcher`->`verify_research` edge + 7 `verify_research`->writer edges.
- Replaced both Plan 05-04 test skeletons (`test_researcher.py` + `test_verify.py`) with real assertions covering AGT-07, AGT-08, AGT-17, AGT-18 mechanics.

## Task Commits

1. **RED — Researcher failing tests** — `7d215d0` (`test(05-09): add failing tests for Researcher Tavily-driven body`)
2. **GREEN — Researcher implementation** — `3757563` (`feat(05-09): replace Researcher stub with real Tavily-driven body`)
3. **RED — verify_research failing tests** — `9477da5` (`test(05-09): add failing tests for verify_research standalone node`)
4. **GREEN — verify_research implementation** — `e577741` (`feat(05-09): add verify_research standalone node (AGT-08, D-11)`)
5. **Wiring — graph topology patch** — `e404808` (`feat(05-09): wire verify_research between researcher and fan-out (D-11)`)

_TDD pattern: RED commits assert that the import/symbol does not exist (ImportError + ModuleNotFoundError); GREEN commits land the implementation and exercise it. REFACTOR pass skipped — implementations matched spec on first GREEN._

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` — replaced Phase 4 stub. New module-level symbols: `MAX_TOOL_CALLS` (int=12), `ResearchOutputModel` (Pydantic, 13 fields), `_build_queries`, `_build_messages`. Preserved `@agent_node(name="researcher", emit_event="section-draft", max_tool_calls=12)` decoration.
- `packages/pipeline/src/eisenbalm_pipeline/agents/verify.py` — **new file**. Module-level symbols: `_FETCH_TIMEOUT_S` (10.0), `_USER_AGENT`, `_fetch_text` (async), `_name_in_text`, `verify_research` (async, no decorator).
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — added import `from eisenbalm_pipeline.agents.verify import verify_research`, added `builder.add_node("verify_research", verify_research)`, replaced 7 `add_edge("researcher", <writer>)` calls with 1 `add_edge("researcher", "verify_research")` + 7 `add_edge("verify_research", <writer>)`.
- `packages/pipeline/tests/agents/test_researcher.py` — replaced Plan 05-04 single skip-marked stub with 4 real assertions.
- `packages/pipeline/tests/agents/test_verify.py` — replaced Plan 05-04 two skip-marked stubs with 9 real assertions (4 sync `_name_in_text` helper + 5 async `verify_research` behavior tests).

## Decisions Made

1. **ResearchOutputModel fields all have defaults.** Plan's `<interfaces>` block showed `summary`, `founderBio`, `subjectStory` as required positional Pydantic fields. Implementation gives them `default=""` so `Pydantic.model_construct()` (used by `lib/openrouter_client.acomplete`'s stub-mode branch via `FakeOpenRouterClient`) succeeds. Matches Plan 05-05's `StyleBriefOutput` pattern (recorded in STATE.md). Real-mode validation still catches malformed LLM JSON via `ChatOpenAI.with_structured_output`.

2. **Defensive `out_obj` extraction matches Scout/Advocate pattern.** Stub-mode returns `model_construct()` (empty defaults); real mode returns a populated `ResearchOutputModel`. Researcher body handles both via `hasattr(out_obj, "model_dump")` then dict fallback.

3. **Belt-and-braces tool-limit guard after the for-loop.** Mirrors Scout's pattern (`agents/scout.py` lines 216-219). The in-loop pre-check catches normal overruns; the post-loop check catches patched query lists in tests where `_build_queries` returns more than `MAX_TOOL_CALLS` items.

4. **verify_research is a single bottleneck, not parallelized.** It runs two `_fetch_text` calls sequentially (founder, then subject). Could be parallelized via `asyncio.gather`, but: (a) the 7 downstream writers are already parallel — verify_research is on the critical path for ALL 7, not 2; (b) sequential is simpler; (c) typical run does at most 2 fetches, each 10s timeout — worst case is 20s, well within phase budget. If real runs show this is a bottleneck, Plan 05-14 can swap in `asyncio.gather` without changing the public surface.

5. **`_fetch_text` returns `None` for empty URL (defensive guard added beyond plan).** Plan's `_fetch_text` checked the URL inside the try block. Implementation adds an explicit `if not url: return None` at the top so empty-string source URLs (which the LLM might emit) don't waste a network round-trip. Same conservative result as the plan's path.

6. **Researcher does NOT clear `founderName`/`subjectName` when verification fails.** The name fields stay as Researcher emitted them; `state['research']` is the raw data source. Plan 05-10's section writers (per RESEARCH Pitfall 5 + §FounderBioWriter line 637) will null them out at prompt-assembly time when `*Verified` is False. This keeps Researcher's output complete and lets the verification booleans drive downstream framing decisions without losing the underlying data.

7. **verify_research return shape is `{"research": research}` only (state delta), not a full state copy.** Plan was ambiguous about return shape; implementation matches the section-writer return convention (LangGraph TypedDict reducer merges deltas, so partial returns are correct). Mirrors how `verify_research`'s position in the graph topology works — it's a transformation node, not a passthrough.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] `acomplete()` signature must use kwargs-only with `run_id`**
- **Found during:** Task 1 implementation
- **Issue:** Plan's example code in `<action>` block called `acomplete("researcher", messages, response_format=ResearchOutputModel)` with positional args. Actual `lib/openrouter_client.acomplete` signature (Plan 05-03, locked) is kwargs-only AND requires `run_id` (used for cost recording + check_cap). Plan-as-written would raise `TypeError`.
- **Fix:** Used real signature `acomplete(agent_id="researcher", run_id=run_id, messages=messages, response_format=ResearchOutputModel)`. Same correction Plans 05-05, 05-06, 05-07, 05-08 all made (Plan 05-06 STATE.md note: "acomplete call site adapted to kwargs-only signature").
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py`
- **Verification:** 4/4 Researcher tests pass.
- **Committed in:** `3757563`

**2. [Rule 2 — Auto-add critical functionality] Defensive post-loop tool-limit guard**
- **Found during:** Task 1 implementation
- **Issue:** Plan's `<action>` block had the in-loop `if tool_calls >= MAX_TOOL_CALLS:` check before the increment. Without a defensive post-loop check, tests that patch `_build_queries` to return MORE than `MAX_TOOL_CALLS` items would advance the counter past the limit but only by 1 (the in-loop check stops further iterations). The first iteration would always succeed even with a 13-item list.
- **Wait, re-reading the plan code more carefully** — the in-loop check is `if tool_calls >= MAX_TOOL_CALLS:` BEFORE the increment, so it raises on iteration 13 (when `tool_calls=12`). The test patches `_build_queries` to 13 items; the loop iterates 1..12 successfully, then iteration 13 finds `tool_calls=12 >= 12` and raises. The post-loop guard is not strictly needed for the test as written.
- **Fix applied anyway:** Kept the post-loop guard (mirrors Scout's belt-and-braces pattern from `agents/scout.py`). Cost: 4 lines; benefit: future-proof against test patches that bypass the in-loop check (e.g., a test that patches `web_search` to bypass increment).
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py`
- **Verification:** `test_tool_limit_exceeded` passes — `AgentToolCallLimitExceeded` raised as expected.
- **Committed in:** `3757563`

**3. [Rule 2 — Auto-add critical functionality] `ResearchOutputModel` field defaults**
- **Found during:** Task 1 implementation (writing test fixture `_make_research`)
- **Issue:** Plan's Pydantic class in `<interfaces>` showed `summary: str`, `founderBio: str`, `subjectStory: str` as required (no default). But `lib/openrouter_client.acomplete` stub-mode branch uses `response_format.model_construct()` which would TypeError on missing required fields. This matches the EXACT issue Plan 05-05 hit and resolved (recorded in STATE.md line 171).
- **Fix:** Added `default=""` to the three string fields. Same pattern as `StyleBriefOutput`. Real-mode validation still enforces non-empty values via the LLM's structured output retry path.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py`
- **Verification:** `EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.researcher import ResearchOutputModel; r = ResearchOutputModel(); print(r.founderRole)"` → `founder` ✓
- **Committed in:** `3757563`

**4. [Rule 3 — Blocking] `_fetch_text` empty-URL guard**
- **Found during:** Task 2 implementation
- **Issue:** Plan's `_fetch_text(url)` did not check for an empty URL string at the top. If `state['research']['founderNameSourceUrl']` is `""` (LLM might emit empty string instead of None), `httpx.AsyncClient.get("")` raises `httpx.UnsupportedProtocol`, the except catches it, returns None — works but wastes a connection attempt.
- **Fix:** Added `if not url: return None` at top of `_fetch_text`. No behavior change (None still returned) but skips the network round-trip.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/verify.py`
- **Verification:** `_fetch_text("")` returns None (verified manually).
- **Committed in:** `e577741`

---

**Total deviations:** 4 auto-fixed (1 Rule 3 blocking — acomplete signature; 3 Rule 2 defensive add-ons). No scope creep; no architectural change. Pattern matches the 5 deviations Plan 05-08 hit and the 3 Plan 05-06 hit — all are plan-vs-actual-codebase mismatches caused by the plan author writing against an idealized contract rather than the actual locked code.

## Issues Encountered

- **The `acomplete` kwargs-only signature has now caused mismatches in 5 of 5 voice-critical / Tavily-using agent plans (05-05, 05-06, 05-07, 05-08, 05-09).** This is a systemic plan-quality issue, not a per-plan oversight. Future Phase 5 plans (05-10 section writers, 05-13 QA + Editor Final) should grep `acomplete(` in any existing agent file before publishing their `<action>` block. Logged to STATE.md.

- **No Tavily live test exercised.** All 13 tests run with mocked `web_search` returns or with mocked `_fetch_text`. The Tavily import-resilience layer in `lib/search_client.py` (langchain_tavily → langchain_community → tavily-python fallback chain) is exercised only by Plan 05-14's real-mode integration test. Plan 05-09 scope is correct here — unit tests should not hit the live API.

## User Setup Required

None — no external service configuration required. Real OpenRouter calls require `OPENROUTER_API_KEY`, real Tavily calls require `TAVILY_API_KEY` (both documented in Plan 05-03 `.env.example`). Plan 05-09 tests run entirely in stub mode (`EISENBALM_STUB_MODE=true`), no Sanity / Convex / Tavily / OpenRouter round-trip.

## Next Phase Readiness

- **Plan 05-10 (Section Writers):** Now sees `state['research']` with both `founderName`/`subjectName` AND `founderNameVerified`/`subjectNameVerified` booleans. Section writers can branch on the booleans:
  - If `founderNameVerified=True`: pass `founderName` to `lib/voice.build_section_writer_prompt(research={"founderName": "...", ...})`.
  - If `founderNameVerified=False`: null out `founderName` in the dict passed to the prompt builder, ensuring AGT-09 / D-12 anonymous-by-role framing (the writer's system prompt receives only `founderRole` and writes "The founder, a former actuary, ..." per RESEARCH §FounderBioWriter line 637).
  - Same logic applies to `subjectName` / `subjectNameVerified` / `subjectRole` for CaseStudyWriter.
- **Plan 05-13 (QA + Editor Final):** QA Layer-1 hard rules include the "no name-tokens when verified=False" backstop (CONTEXT D-12 §"How to apply"). Now has both signal sources to enforce it.
- **Plan 05-14 (Real-mode integration test):** Researcher is ready for `EISENBALM_STUB_MODE=false` exercise. Tavily live calls will fire; the langchain_tavily fallback chain in `lib/search_client.py` will be exercised for the first time. The 12 tool-call cap means worst-case ~5 Tavily searches at $0.005/search = $0.025 Tavily cost + ~$0.10 Sonnet cost per real Researcher run.
- **Phase 4 PIP-06 stub regression:** Still passes (Phase 4 PIP-06 runs `EISENBALM_STUB_MODE=true`; the Researcher's defensive dict extraction `if hasattr(out_obj, "model_dump")` handles `model_construct()` empty output).

## Known Stubs

None introduced by this plan. The Researcher's `fixtures.research_output()` fallback (Phase 4 stub) was deleted — Researcher now runs real code in real mode, model_construct() in stub mode. No hardcoded empty values flow to UI rendering from this plan.

## Self-Check: PASSED

- File `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py`: FOUND.
- File `packages/pipeline/src/eisenbalm_pipeline/agents/verify.py`: FOUND.
- File `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py`: FOUND.
- File `packages/pipeline/tests/agents/test_researcher.py`: FOUND.
- File `packages/pipeline/tests/agents/test_verify.py`: FOUND.
- Commit `7d215d0` (test RED Researcher): FOUND in `git log --oneline`.
- Commit `3757563` (feat GREEN Researcher): FOUND in `git log --oneline`.
- Commit `9477da5` (test RED verify_research): FOUND in `git log --oneline`.
- Commit `e577741` (feat GREEN verify_research): FOUND in `git log --oneline`.
- Commit `e404808` (feat graph wiring): FOUND in `git log --oneline`.
- All 13 plan tests pass; full pipeline suite: 55 passed / 39 skipped / 0 failed.
- Plan verification commands:
  - `EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.researcher import researcher, ResearchOutputModel, MAX_TOOL_CALLS, _build_queries; assert MAX_TOOL_CALLS == 12; assert len(_build_queries({'name': 'Foo', 'website': 'https://foo.org'})) >= 4; r = ResearchOutputModel(summary='s', founderBio='b', subjectStory='ss'); assert r.founderRole == 'founder'; print('OK')"` → `OK` ✓
  - `EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.verify import verify_research, _name_in_text, _fetch_text; assert _name_in_text('Jane Doe', 'Jane Doe is the founder') is True; assert _name_in_text('Jane Doe', 'contact Doe at info@x.org') is True; assert _name_in_text('Jane Doe', 'no founder mentioned here') is False; assert _name_in_text('', 'whatever') is False; print('OK')"` → `OK` ✓
  - `grep -c 'verify_research' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` → 6 (≥ 3) ✓
  - `grep -c 'from eisenbalm_pipeline.agents.verify import verify_research' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` → 1 ✓
  - `grep -c 'add_node("verify_research"' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` → 1 (≥ 1) ✓
  - `grep -c 'add_edge("researcher", "verify_research")' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` → 1 (≥ 1) ✓
  - No direct `add_edge("researcher", "<writer>")` lines remain ✓
  - `EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.graph.builder import build_graph; from langgraph.checkpoint.memory import MemorySaver; build_graph(MemorySaver())"` → `OK` ✓
  - `grep -c 'selectolax' packages/pipeline/src/eisenbalm_pipeline/agents/verify.py` → 2 (≥ 1) ✓
  - `agents/verify.py` does NOT import `agent_node` or `convex_mutation_safe` (verified via grep of imports list) ✓

---
*Phase: 05-agent-quality*
*Completed: 2026-05-17*
