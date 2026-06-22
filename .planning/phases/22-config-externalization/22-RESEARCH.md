# Phase 22: Config Externalization — Research

**Researched:** 2026-06-22
**Domain:** LangGraph pipeline config migration — Convex HTTP reads, DispatchState augmentation, idempotent seed, byte-verification
**Confidence:** HIGH (all findings from live codebase reads; no assumptions from training data)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Migrate exactly the 11 `.md` system-prompt files into `prompt_versions` as v1 active rows. Set: `scout`, `advocate`, `editor`, `editor-final`, `calibrator`, `researcher`, `design`, `game`, `bonus-big-budget`, `bonus-jingle`, `bonus-spec-ad`. `prompts/README.md` is editorial — not a prompt. Byte-verification required, zero diff (CFG-02).
- **D-02:** Section-writer prompts (`origin_story`, `problem`, `founder_bio`, `case_study`) deferred to Phase 24. Their inline `SECTION_GUIDANCE` strings are NOT migrated this phase.
- **D-03:** System prompts only. `prompt_versions.content` stores the body between `<!-- PROMPT START/END -->`. User-prompt templates keep their existing `str.replace("{token}", …)` substitution pattern.
- **D-04:** Seed `agents` rows for ALL pipeline agent keys using the full `llm_config.MODEL_BY_AGENT` key set (15 keys). `prompt_versions` has no rows yet for agents without migrated prompts — that is intentional.
- **D-05:** Keep `llm_config.py` as the in-code fallback default set. `agents` seed is generated FROM it. Do NOT delete `llm_config.py`.
- **D-06:** All-or-nothing on hard Convex failure. If `load_run_config()` fails entirely, use ALL disk/code defaults for the whole run + emit a single structured WARNING. Run still snapshots the resolved (fallback) config.
- **D-07:** Per-key fallback on partial gaps. If Convex is reachable but an individual prompt/agent row is missing, that agent falls back to its disk default + per-agent WARNING. Never crash on a single missing row.
- **D-08:** Store + snapshot the `enabled` flag only this phase. No skip-gating logic. `DESIGNAGENT_SUPPRESSED` env precursor left untouched. Wiring `enabled=false → agent skipped` is deferred to Phase 23/25.
- **D-09:** `runs.configSnapshot` stores a JSON string of the FULL resolved run config: per-agent `{model, temperature, top_p, max_tokens, enabled, systemPrompt}` for every agent + relevant `pipeline_config` values. Captures actual resolved values (post-fallback).
- **D-10:** The snapshot write is the FIRST awaited op after `runs`/`pipelineRuns:create` and BEFORE `graph.ainvoke()`. Awaited and error-checked. A mid-run edit cannot alter the in-flight run (snapshot-race pitfall).

### Claude's Discretion

- Exact `config_loader.py` function signatures, the in-memory `RunConfig`/`config` TypedDict shape on `DispatchState`, and the agentKey canonical-mapping table.
- Whether to add `max_tokens`/`top_p`/`description` columns to the `agents` table now or fold into the JSON — planner to align with brief §3A and the Phase-21 stub.
- The byte-comparison verification script's location/form (standalone script vs pytest), as long as it proves zero diff between seeded rows and the 11 `.md` files.
- Migration mechanism (idempotent Convex seed mutation vs one-shot script), consistent with the project's deterministic-upsert convention and Phase-21 `seedEisenbalm` pattern.

### Deferred Ideas (OUT OF SCOPE)

- Section-writer prompt externalization (`origin_story`/`problem`/`founder_bio`/`case_study` `SECTION_GUIDANCE`) — **Phase 24**.
- User-prompt templates, `qa/rubric.md`, `VOICE_CONSTRAINTS` as separately versioned/editable assets — **Phase 24**.
- Prompt-editing UI (CodeMirror + `{variable}` highlighting), diff, rollback, single-agent test-run — **Phase 24**.
- Per-agent `enabled → skip` execution gating — **Phase 23/25**.
- `wrap_agent_node()`, `agent_runs` live emissions, read-only dashboard, `lib/registry.py` — **Phase 23**.
- Run control (`/pipeline/tick`, cancel, schedule, budget caps) — **Phase 25**.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CFG-01 | Pipeline reads active agent config (system prompts + model/temp/max-tokens/enabled) from Convex once at run start, and agents use that config instead of disk during the run | `load_run_config()` pattern in ARCHITECTURE.md §2; `convex_query` helper already exists; 11 call-site swap pattern documented |
| CFG-02 | The 11 `.md` prompt files are migrated into Convex `prompt_versions` as v1 active rows with byte-identical content (zero diff vs `load_prompt()` output) | Byte-verification oracle is `load_prompt()` + `_extract()`; migration script MUST use these functions, not raw file reads; `by_workspace_agentKey` index supports upsert pattern |
| CFG-03 | Pipeline does NOT crash if config store is unavailable — falls back to on-disk `.md` and `llm_config.py` defaults | D-06 (hard failure = all-or-nothing fallback + WARNING), D-07 (partial = per-key fallback + WARNING); `load_prompt()` remains the fallback oracle |
| CFG-04 | An immutable config snapshot is written to `runs.configSnapshot` before the LangGraph graph is invoked, containing the full resolved per-agent config | `runs` table already has `configSnapshot: v.optional(v.string())`; snapshot must be first awaited op BEFORE `asyncio.create_task()`; PITFALLS.md Pitfall 1.1 documents the exact race condition |
</phase_requirements>

---

## Summary

Phase 22 is the §2 keystone for Mission Control v2.0. The core change is replacing `load_prompt(name)` calls scattered across 8 agent files (11 call sites) with a single `load_run_config()` call at run start that reads the full agent configuration from Convex once, caches it in a new `DispatchState.config` field, and then writes an immutable snapshot to `runs.configSnapshot` before any LangGraph node runs. This eliminates the risk of a mid-run dashboard edit corrupting an in-flight pipeline, and makes every run self-documenting: the exact system prompts and model parameters that produced an issue are frozen on the run record.

The migration work is straightforward but has one critical correctness constraint: the seeded `prompt_versions.content` rows must be byte-identical to what `load_prompt()` currently returns. The `_extract()` function strips exactly one leading and one trailing newline from the PROMPT START/END block; a migration script that reads the raw file bytes instead of calling `load_prompt()` will produce different whitespace and the diff will be non-zero. The byte-verification step in CFG-02 exists to catch this class of error.

The snapshot-race pitfall (CFG-04) is the most dangerous correctness issue. The `snapshot_config()` call must be `await`ed synchronously in the HTTP request handler BEFORE `asyncio.create_task()`, NOT inside the `_execute_run()` background task. If the snapshot happens inside the task, there is a real window where a concurrent dashboard edit can land after the snapshot is committed but before the agents actually read from state — defeating the isolation guarantee.

**Primary recommendation:** Implement `lib/config_loader.py` with `load_run_config()` + `snapshot_config()`, amend `docs/API_CONTRACTS.md §7` for `DispatchState.config` first, then flesh out the Convex schema gaps, then run the seed migration, then swap the 11 call sites.

---

## Standard Stack

### Core (all already in-repo)

| Library / Tool | Version | Purpose | Why Standard |
|----------------|---------|---------|--------------|
| `eisenbalm_pipeline.lib.convex_client` | in-repo | `convex_query` / `convex_mutation` for Convex HTTP reads/writes | Already used for all pipeline→Convex calls; no new dependency |
| `eisenbalm_pipeline.lib.prompts` | in-repo | `load_prompt()` / `_extract()` as byte-exact fallback oracle | Must NOT be deleted; remains the fallback path |
| `eisenbalm_pipeline.lib.llm_config` | in-repo | `MODEL_BY_AGENT`, `SAMPLING_BY_AGENT`, `MAX_TOKENS_BY_AGENT` as in-code defaults | Source of truth for `agents` seed; stays as disk-side fallback |
| `importlib.resources` | stdlib | Railway-safe package-relative prompt file resolution | `load_prompt()` already uses this; do not change the resolution strategy |
| `dataclasses` / `TypedDict` | stdlib | `RunConfig` in-memory shape for config_loader | Lightweight, no new dependencies; matches DispatchState pattern |
| `json` | stdlib | JSON-serialize config for `configSnapshot` storage | Already used everywhere in pipeline |

### Supporting (Convex schema / functions)

| Item | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `convex/schema.ts` `agents` table | Phase-21 stub | Per-agent model/temp/tokens/enabled config | Phase 22 adds `max_tokens`, `top_p`, `description` columns; seed with 15 rows |
| `convex/schema.ts` `prompt_versions` table | Phase-21 stub | Versioned system prompts, `isActive` flag | Phase 22 seeds 11 v1 active rows |
| `convex/schema.ts` `pipeline_config` table | Phase-21 stub | Key/value global pipeline settings | Phase 22 reads `schedule_enabled`, `require_review`, `auto_publish` at run start |
| `convex/schema.ts` `runs` table | Phase-21 stub | Dashboard-facing run record; `configSnapshot` already declared | Phase 22 populates `configSnapshot` |

### No New External Dependencies

This phase adds zero npm or pip packages. All tooling is stdlib + in-repo.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
packages/pipeline/src/eisenbalm_pipeline/
├── lib/
│   └── config_loader.py          # NEW — load_run_config() + snapshot_config()
├── ...
convex/
├── agents.ts                     # NEW — mutations: upsert, getByKey; query: listForWorkspace
├── promptVersions.ts             # NEW — mutations: upsert; query: getActive, listForAgent
├── pipelineConfig.ts             # NEW — mutations: upsert; query: getAll
├── runs.ts                       # NEW (or extend Phase-21) — mutation: setConfigSnapshot
scripts/
└── verify_prompt_seed.py         # NEW — standalone byte-comparison verification
```

### Pattern 1: RunConfig In-Memory Shape

The `RunConfig` dataclass is the in-memory config cache threaded through `DispatchState`. It captures the resolved (post-fallback) config; agents read from it directly.

```python
# packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py

from __future__ import annotations
import dataclasses
import json
import logging
from typing import Optional

from eisenbalm_pipeline.lib.prompts import load_prompt
from eisenbalm_pipeline.lib.llm_config import (
    MODEL_BY_AGENT, SAMPLING_BY_AGENT, MAX_TOKENS_BY_AGENT
)
from eisenbalm_pipeline.lib.convex_client import convex_query, convex_mutation

log = logging.getLogger(__name__)

WORKSPACE_ID = "eisenbalm"

@dataclasses.dataclass
class AgentConfig:
    model: str
    temperature: float
    top_p: float
    max_tokens: Optional[int]
    enabled: bool
    system_prompt: str   # resolved, ready for substitution via str.replace()

@dataclasses.dataclass
class RunConfig:
    workspace_id: str
    agents: dict[str, AgentConfig]   # keyed by canonical agentKey (e.g. "editor_gate1")
    require_review: bool
    auto_publish: bool
    schedule_enabled: bool
```

**Why dataclass not TypedDict:** Dataclasses serialize cleanly via `dataclasses.asdict()` for `json.dumps()`, which is exactly what `snapshot_config()` needs. TypedDict would require manual serialization.

### Pattern 2: load_run_config() — Two-Tier Fallback

```python
# packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (continued)

async def load_run_config(http) -> RunConfig:
    """
    Called ONCE at run start in the HTTP handler (NOT inside _execute_run).
    Returns RunConfig with all resolved per-agent config.
    Two-tier fallback:
      - Hard Convex failure: all-or-nothing disk/code fallback + single WARNING (D-06)
      - Per-key miss: individual agent falls back + per-agent WARNING (D-07)
    """
    try:
        agents_rows = await convex_query(http, "agents:listForWorkspace", {
            "workspace_id": WORKSPACE_ID
        })
        # pipeline_config: read all key/value rows
        pc_rows = await convex_query(http, "pipelineConfig:getAll", {
            "workspace_id": WORKSPACE_ID
        })
        pc = {r["key"]: json.loads(r["value"]) for r in pc_rows}
    except Exception:
        log.warning(
            "load_run_config: Convex unreachable — using full disk/llm_config fallback for this run"
        )
        return _build_fallback_config()

    agents: dict[str, AgentConfig] = {}
    agents_by_key = {r["agentKey"]: r for r in agents_rows}

    # CANONICAL AGENT KEYS (source: llm_config.MODEL_BY_AGENT)
    for agent_key in MODEL_BY_AGENT:
        row = agents_by_key.get(agent_key)

        # Resolve model
        model = (row.get("model") if row else None) or MODEL_BY_AGENT[agent_key]

        # Resolve sampling
        sampling = SAMPLING_BY_AGENT.get(agent_key, {})
        temperature = (row.get("temperature") if row else None)
        if temperature is None:
            temperature = sampling.get("temperature", 0.3)
        top_p = (row.get("top_p") if row else None)
        if top_p is None:
            top_p = sampling.get("top_p", 1.0)

        max_tokens = (row.get("max_tokens") if row else None) or MAX_TOKENS_BY_AGENT.get(agent_key)
        enabled = row.get("enabled", True) if row else True

        # Resolve system_prompt (D-07 per-key fallback)
        prompt_key = AGENT_KEY_TO_PROMPT_FILE.get(agent_key)   # see mapping table
        system_prompt = None
        if prompt_key is not None:
            try:
                pv = await convex_query(http, "promptVersions:getActive", {
                    "workspace_id": WORKSPACE_ID,
                    "agentKey": agent_key
                })
                system_prompt = pv["content"] if pv else None
            except Exception:
                log.warning("load_run_config: failed to fetch prompt for %s — using file fallback", agent_key)
            if system_prompt is None:
                log.warning("load_run_config: no active prompt_version for %s — using file fallback", agent_key)
                system_prompt = load_prompt(prompt_key)
        # else: no prompt file (e.g. origin_story — deferred D-02); system_prompt stays None

        agents[agent_key] = AgentConfig(
            model=model,
            temperature=temperature,
            top_p=top_p,
            max_tokens=max_tokens,
            enabled=enabled,
            system_prompt=system_prompt or "",
        )

    return RunConfig(
        workspace_id=WORKSPACE_ID,
        agents=agents,
        require_review=pc.get("require_review", True),
        auto_publish=pc.get("auto_publish", False),
        schedule_enabled=pc.get("schedule_enabled", False),
    )


def _build_fallback_config() -> RunConfig:
    """All-or-nothing disk+code fallback (D-06). Uses load_prompt() + llm_config defaults."""
    agents: dict[str, AgentConfig] = {}
    for agent_key in MODEL_BY_AGENT:
        prompt_key = AGENT_KEY_TO_PROMPT_FILE.get(agent_key)
        sampling = SAMPLING_BY_AGENT.get(agent_key, {})
        agents[agent_key] = AgentConfig(
            model=MODEL_BY_AGENT[agent_key],
            temperature=sampling.get("temperature", 0.3),
            top_p=sampling.get("top_p", 1.0),
            max_tokens=MAX_TOKENS_BY_AGENT.get(agent_key),
            enabled=True,
            system_prompt=load_prompt(prompt_key) if prompt_key else "",
        )
    return RunConfig(
        workspace_id=WORKSPACE_ID,
        agents=agents,
        require_review=True,
        auto_publish=False,
        schedule_enabled=False,
    )
```

### Pattern 3: snapshot_config() — Must Be First Awaited Op

```python
async def snapshot_config(http, run_id: str, config: RunConfig) -> None:
    """
    Write full resolved RunConfig to runs.configSnapshot as JSON.
    MUST be called BEFORE asyncio.create_task(_execute_run(...)).
    MUST be awaited (not fire-and-forget) — snapshot race otherwise (PITFALLS 1.1).
    """
    snapshot = json.dumps(dataclasses.asdict(config))
    await convex_mutation(http, "runs:setConfigSnapshot", {
        "runId": run_id,
        "configSnapshot": snapshot,
    })
```

### Pattern 4: runs.py Run-Start Sequence (the correct ordering)

```python
# api/runs.py — POST /run/weekly handler (modified section)
# CURRENT sequence (lines ~179–242):
#   1. _resolve_issue_number()
#   2. run_id = new_run_id()
#   3. begin_run(run_id)
#   4. await convex_mutation(... "pipelineRuns:create" ...)
#   5. build initial_state (no config field yet)
#   6. task = asyncio.create_task(_execute_run(...))
#   7. return {"runId": run_id}

# PHASE 22 ORDERING (insert between steps 4 and 6):
#   4a. await convex_mutation(... "runs:create" ..., runId=run_id)       ← new
#   4b. config = await load_run_config(http)                             ← new
#   4c. await snapshot_config(http, run_id, config)                      ← new (MUST be here, not in _execute_run)
#   5.  initial_state["config"] = config                                 ← new
#   6.  task = asyncio.create_task(_execute_run(..., initial_state))
#   7.  return {"runId": run_id}
```

**Why NOT inside `_execute_run()`:** `asyncio.create_task()` schedules the coroutine but does NOT wait for it. If `snapshot_config()` is inside the background task, the HTTP handler returns `{"runId": ...}` immediately, the user sees success, but the snapshot hasn't been written yet. A concurrent dashboard edit can land before the snapshot commits — and will be overwritten by the snapshot. The snapshot must be committed BEFORE the background task starts.

### Pattern 5: DispatchState.config Addition

```python
# packages/pipeline/src/eisenbalm_pipeline/graph/state.py
# BEFORE: modify docs/API_CONTRACTS.md §7 first (CLAUDE.md hard rule)

from typing import NotRequired, Optional
# ... existing imports ...

class DispatchState(TypedDict):
    # ... all existing fields unchanged ...
    config: NotRequired[Optional["RunConfig"]]  # Phase 22 — loaded at run start, never mutated mid-run
```

`NotRequired` preserves backward compatibility with existing tests that construct `DispatchState` dicts without `config`. Using `Optional` allows `None` default for pre-migration tests.

### Pattern 6: Agent Call-Site Swap

```python
# BEFORE (all 11 sites):
system = load_prompt("scout").replace("{featured_keys}", f"{featured_keys}")

# AFTER:
system = state["config"].agents["scout"].system_prompt.replace("{featured_keys}", f"{featured_keys}")
# Note: str.replace() substitution is preserved exactly — NOT str.format() (D-03)

# BEFORE (editor has two prompts):
load_prompt("editor")        # gate1
load_prompt("editor-final")  # final

# AFTER:
state["config"].agents["editor_gate1"].system_prompt
state["config"].agents["editor_final"].system_prompt
```

### Pattern 7: Canonical AgentKey Mapping Table

This is the resolution of the mismatch between `.md` filenames (kebab-case) and `llm_config.py` keys (snake_case). This table must be defined once and used by `config_loader.py`, the seed script, and verification.

| `.md` filename | canonical `agentKey` (in `agents` + `prompt_versions`) | `llm_config.MODEL_BY_AGENT` key |
|---|---|---|
| `scout.md` | `scout` | `scout` |
| `advocate.md` | `advocate` | `advocate` |
| `editor.md` | `editor_gate1` | `editor_gate1` |
| `editor-final.md` | `editor_final` | `editor_final` |
| `calibrator.md` | `calibrator` | `calibrator` |
| `researcher.md` | `researcher` | `researcher` |
| `design.md` | `design` | `design` |
| `game.md` | `game` | `game` |
| `bonus-big-budget.md` | `bonus_big_budget` | `bonus` (shared llm row) |
| `bonus-jingle.md` | `bonus_jingle` | `bonus` (shared llm row) |
| `bonus-spec-ad.md` | `bonus_spec_ad` | `bonus` (shared llm row) |
| *(no file)* | `chronicler` | `chronicler` |
| *(no file)* | `qa` | `qa` |
| *(no file)* | `origin_story` | `origin_story` |
| *(no file)* | `problem` | `problem` |
| *(no file)* | `founder_bio` | `founder_bio` |
| *(no file)* | `case_study` | `case_study` |

**Critical findings:**

1. **`editor.md` → `editor_gate1`**: The `.md` filename is `editor` but the `llm_config` key (and the LangGraph node name) is `editor_gate1`. The `agentKey` in Convex MUST be `editor_gate1` to allow `config_loader.py` to join them. The prompt file at `prompts/editor.md` is loaded as `load_prompt("editor")` — so `AGENT_KEY_TO_PROMPT_FILE["editor_gate1"] = "editor"`.

2. **Three bonus variants, one `llm_config` row**: `bonus-big-budget.md`, `bonus-jingle.md`, `bonus-spec-ad.md` all map to the same `MODEL_BY_AGENT["bonus"]` and `SAMPLING_BY_AGENT["bonus"]` row. In Convex, they get DISTINCT `agentKey` values (`bonus_big_budget`, `bonus_jingle`, `bonus_spec_ad`) in `prompt_versions` — so the active prompt per type is independently selectable. But in `agents`, they share one `bonus` row (model/temp/enabled). The planner must decide: either add three `agents` rows or one `bonus` row. Research recommendation: **add three distinct rows** (`bonus_big_budget`, `bonus_jingle`, `bonus_spec_ad`) so they are independently editable from the dashboard in Phase 24. This means `MODEL_BY_AGENT` must also grow three bonus-variant keys — OR the config_loader applies the single `bonus` row to all three. The simpler Phase-22 approach: one `bonus` agents row, three `prompt_versions` rows, and `config_loader` maps all three to the same model/temp.

3. **`chronicler`, `qa`, `origin_story`, `problem`, `founder_bio`, `case_study`** have no prompt `.md` files to migrate this phase. They still get `agents` rows (D-04) with model/temp from `llm_config.py` and `enabled=true`. Their `system_prompt` is left empty string in `RunConfig.agents[key]` until Phase 24 migrates them.

4. **`AGENT_KEY_TO_PROMPT_FILE` dict** (defined in `config_loader.py`):
   ```python
   AGENT_KEY_TO_PROMPT_FILE: dict[str, str] = {
       "scout":          "scout",
       "advocate":       "advocate",
       "editor_gate1":   "editor",        # NOTE: file is editor.md, key is editor_gate1
       "editor_final":   "editor-final",
       "calibrator":     "calibrator",
       "researcher":     "researcher",
       "design":         "design",
       "game":           "game",
       "bonus_big_budget": "bonus-big-budget",
       "bonus_jingle":     "bonus-jingle",
       "bonus_spec_ad":    "bonus-spec-ad",
       # chronicler, qa, origin_story, problem, founder_bio, case_study: no file this phase
   }
   ```

### Pattern 8: `agents` Table Schema Gap — Must Add Columns

The Phase-21 stub has: `agentKey, enabled, model, temperature`. Phase 22 needs `max_tokens`, `top_p`, and `description` (for Phase 23 dashboard display). The planner must decide: extend the Convex schema now or fold max_tokens/top_p into a JSON field. Research recommendation: **add them as first-class columns** (consistent with the schema pattern for `model` and `temperature`) since the dashboard will display and edit them individually.

Required schema amendment in `convex/schema.ts`:
```typescript
agents: defineTable({
  workspace_id: v.string(),
  agentKey: v.string(),
  enabled: v.boolean(),
  model: v.optional(v.string()),
  temperature: v.optional(v.number()),
  top_p: v.optional(v.number()),         // ADD — from SAMPLING_BY_AGENT
  max_tokens: v.optional(v.number()),    // ADD — from MAX_TOKENS_BY_AGENT
  description: v.optional(v.string()),   // ADD — for Phase 23 dashboard display
})
```

### Pattern 9: Idempotent Seed Script Pattern

Mirror Phase 21's `seedEisenbalm` pattern: upsert by `(workspace_id, agentKey)` index.

```python
# scripts/seed_phase22.py  (or a Convex mutation called from Python)
# For each agent in MODEL_BY_AGENT:
#   1. patch agents row (upsert by workspace_agentKey)
#   2. If agentKey in AGENT_KEY_TO_PROMPT_FILE: patch prompt_versions v1 active row (upsert by workspace_agentKey)
# For pipeline_config keys: upsert require_review=true, auto_publish=false, schedule_enabled=false

# The upsert for prompt_versions MUST use load_prompt(AGENT_KEY_TO_PROMPT_FILE[key]) as content
# so the seeded bytes are byte-identical to the fallback. NOT raw file read.
```

### Pattern 10: Byte-Verification Script

```python
# scripts/verify_prompt_seed.py
# For each of the 11 agentKey/promptFile pairs:
#   1. Call load_prompt(prompt_file_name) to get the expected bytes
#   2. Query Convex promptVersions:getActive for the agentKey
#   3. Assert seeded_content == expected_content (exact string equality)
#   4. Print OK or FAIL with diff on failure
# Exit code 1 if any diff.
```

Can also be expressed as a pytest test (avoids needing live Convex in CI):
```python
# packages/pipeline/tests/lib/test_prompt_seed.py
# Parametrize over (agentKey, prompt_file) pairs.
# Mock convex_query to return seeded content; verify against load_prompt() output.
# This tests the SEED LOGIC, not the live Convex state.
```

### Anti-Patterns to Avoid

- **Snapshot inside `_execute_run()`:** Creates the snapshot-race window. Must be in the HTTP handler, synchronously awaited before `create_task()`.
- **Raw file reads in migration:** `open("prompts/scout.md").read()` misses `_extract()` and seeds wrong bytes. Always use `load_prompt()`.
- **Deleting `lib/prompts.py` or the `.md` files:** They are the fallback path. Without them, Convex degradation = pipeline outage.
- **Using `str.format()` after call-site swap:** Existing substitution is `str.replace("{token}", value)`. Do NOT convert to `str.format()` — the prompt templates contain `{token}` placeholders that `str.format()` would try to interpret as format specifiers (KeyError on any unreplaced token).
- **Calling `load_prompt()` from inside agent nodes after swap:** Once agents read from `state["config"]`, `load_prompt()` is dead code at call sites. The import of `load_prompt` in each agent file can be removed.
- **Single `bonus` agentKey in `prompt_versions`:** The bonus agent calls `load_prompt()` three times (bonus-big-budget, bonus-jingle, bonus-spec-ad) in a conditional. Seeding a single row loses the ability to activate/rollback bonus variants independently. Must be three rows.
- **Treating `AGENT_GEN_PARAMS` as the dict name:** The actual dict is `SAMPLING_BY_AGENT` in `llm_config.py`. The CONTEXT.md mentions `AGENT_GEN_PARAMS` but that name does not exist in the file. Use `SAMPLING_BY_AGENT`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Convex HTTP read at run start | Custom httpx calls with manual auth | `convex_query()` from `lib/convex_client.py` | Already implements `Authorization: Convex {KEY}` auth, `body["status"] != "success"` error detection, structured logging |
| Convex write for snapshot | Manual httpx POST | `convex_mutation()` from `lib/convex_client.py` | Same auth pattern; error-raises on Convex-level errors (not just HTTP errors) |
| JSON serialization of RunConfig | Manual dict construction | `dataclasses.asdict()` + `json.dumps()` | Handles nested dataclasses; no custom serializer needed |
| Idempotent seed | Custom SQL-style ON CONFLICT | Convex upsert mutation checking `by_workspace_agentKey` index | The Pattern-21 `seedEisenbalm` already demonstrates this; copy the pattern |
| Byte-exact prompt extraction | Custom parser for PROMPT START/END markers | `load_prompt()` from `lib/prompts.py` | `_extract()` already handles the one-leading/one-trailing-newline strip; any rewrite risks non-identical bytes |

---

## Runtime State Inventory

This is a migration/config-loader phase. The following runtime state considerations apply:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `prompt_versions` table starts empty; `agents` table starts empty; `pipeline_config` table starts empty | Seed script populates all three; must be idempotent (upsert); run once against production Convex before deploying pipeline changes |
| Live service config | Convex cloud (modest-magpie-797) has the Phase-21 stubs but no data rows yet | No live Convex data to migrate; safe to deploy schema changes and seed in one shot |
| OS-registered state | None relevant to this phase | None |
| Secrets/env vars | `CONVEX_DEPLOY_KEY` already set on Railway; no new env vars needed | None — `config_loader.py` reads via existing `convex_client.py` which already uses `CONVEX_DEPLOY_KEY` |
| Build artifacts | `eisenbalm_pipeline` wheel on Railway — `importlib.resources` resolves prompts from wheel; `.md` files MUST remain in `prompts/` directory | Confirm `prompts/*.md` are included in `MANIFEST.in` or `pyproject.toml` package data |

**CRITICAL: `.md` files in package data.** If the 11 prompt `.md` files are not explicitly declared in `pyproject.toml` as package data, they will NOT be included in the Railway wheel and `load_prompt()` (the fallback path) will raise `FileNotFoundError` in production. Verify `pyproject.toml` includes:
```toml
[tool.setuptools.package-data]
eisenbalm_pipeline = ["prompts/*.md"]
```

---

## Common Pitfalls

### Pitfall 1: Snapshot Race Condition (HIGH — data integrity)

**What goes wrong:** `snapshot_config()` is placed inside `_execute_run()` background coroutine instead of the HTTP handler. A concurrent dashboard config edit can land AFTER `create_task()` returns but BEFORE the snapshot is written. The snapshot then overwrites the dashboard edit with the pre-edit values — or worse, the snapshot reflects the edit even though agents have already started with the pre-edit config.

**Why it happens:** The pattern `task = asyncio.create_task(...)` is non-blocking. Code inside the task runs in the event loop but NOT synchronously before the handler returns. Developers mistake "same event loop" for "same transaction."

**How to avoid:** `snapshot_config()` must be a `await`ed call in the HTTP handler body, BEFORE `asyncio.create_task()`. The sequence in `runs.py` must be: `await snapshot_config(...)` → `task = asyncio.create_task(_execute_run(...))`. 

**Warning signs:** If you see `await snapshot_config(...)` inside `_execute_run()`, it is wrong.

---

### Pitfall 2: Migration Byte Mismatch (HIGH — CFG-02 violation)

**What goes wrong:** Seed script reads raw bytes from `prompts/scout.md` instead of calling `load_prompt("scout")`. The raw file includes the `<!-- PROMPT START -->` header comment and the one leading + one trailing newline that `_extract()` strips. The seeded `prompt_versions.content` is longer than what the pipeline currently sends. The byte-verification step fails, and if ignored, the pipeline sends different content than what was seeded (defeating reproducibility).

**Why it happens:** Raw file read is the obvious approach. `_extract()` is a non-obvious internal detail.

**How to avoid:** Every path that produces `prompt_versions.content` MUST call `load_prompt(name)`. The migration, the verification script, and any fallback all use the same oracle. Never call `open(...).read()` on a prompt file.

**Warning signs:** Verification shows off-by-one-line diffs. Seeded content starts with `\n` or ends with `\n\n`.

---

### Pitfall 3: `editor.md` → `editor_gate1` Key Mismatch (HIGH — agent config miss)

**What goes wrong:** Seed script uses the `.md` filename as the `agentKey` (`editor`) but `config_loader.py` looks up `editor_gate1` (the `llm_config.py` key). The active prompt row is never found. The fallback path fires with a WARNING, and the test for "no WARNING logged" fails even though the system technically works.

**Why it happens:** The `.md` file names are the original file-system names; the `llm_config` keys were chosen to match the LangGraph node names (`editor_gate1`, `editor_final`). Nobody wrote down the mapping.

**How to avoid:** Use `AGENT_KEY_TO_PROMPT_FILE` (Pattern 7 above) as the single source of truth. The seed script keys on `agentKey` (the `llm_config` key), with the file name as a value. Never iterate the `prompts/` directory directly to derive agent keys.

**Warning signs:** `load_run_config()` emits "no active prompt_version for editor_gate1" warning even after seeding. Check the `agentKey` values in the `prompt_versions` table.

---

### Pitfall 4: Three Bonus Prompts, One agents Row (MEDIUM — Phase 24 setup)

**What goes wrong:** Planner creates one `bonus` agentKey for both `agents` and `prompt_versions`. The bonus agent at call-site reads from `state["config"].agents["bonus"].system_prompt` — but it needs three different prompts depending on `bonus_type`. The config structure does not support independent bonus-variant prompt retrieval.

**Why it happens:** `llm_config.py` has one `bonus` key for model/temp. The three bonus `.md` files look like variants of a single agent, not three separate agents.

**How to avoid (for Phase 22):** Seed three distinct `prompt_versions` rows (`bonus_big_budget`, `bonus_jingle`, `bonus_spec_ad`) and add them to `RunConfig.agents` as three distinct keys. The call-site swap in `agents/bonus.py` reads from:
  - `state["config"].agents["bonus_big_budget"].system_prompt` (was `load_prompt("bonus-big-budget")`)
  - `state["config"].agents["bonus_jingle"].system_prompt` (was `load_prompt("bonus-jingle")`)
  - `state["config"].agents["bonus_spec_ad"].system_prompt` (was `load_prompt("bonus-spec-ad")`)

For `agents` model/temp rows, keep one `bonus` row or add three with the same values — the planner decides, but `prompt_versions` MUST be three rows.

---

### Pitfall 5: `AGENT_GEN_PARAMS` Name Does Not Exist (MEDIUM — typo in CONTEXT.md)

**What goes wrong:** The CONTEXT.md references `AGENT_GEN_PARAMS` but the actual dict in `llm_config.py` is `SAMPLING_BY_AGENT`. Any code that does `from llm_config import AGENT_GEN_PARAMS` will raise `ImportError`.

**Why it happens:** The CONTEXT.md was written from the research doc, which used the name from an earlier draft.

**How to avoid:** Import `SAMPLING_BY_AGENT` (confirmed present at `llm_config.py` line ~45). Cross-reference `llm_config.py` directly before writing any import.

---

### Pitfall 6: Resume Path Does NOT Re-Snapshot (LOW — correctness note)

**What goes wrong:** Developer adds `snapshot_config()` to the resume path (`POST /run/{run_id}/resume`, ~line 279–321 in `runs.py`). The resume re-snapshot overwrites the original snapshot with the current (potentially different) config values — destroying the immutability guarantee for the initial run.

**Why it happens:** Resume path looks symmetric to the initial run path.

**How to avoid:** The resume path explicitly does NOT call `snapshot_config()`. It calls `graph.ainvoke(Command(resume=...), ...)` with the original `run_id`. The original snapshot from the initial run start remains authoritative.

---

### Pitfall 7: `str.format()` vs `str.replace()` After Call-Site Swap (LOW — runtime crash)

**What goes wrong:** After swapping `load_prompt("scout")` to `state["config"].agents["scout"].system_prompt`, the developer also converts `.replace("{featured_keys}", ...)` to `f"{template}".format(featured_keys=...)` for "cleanliness." Prompt templates contain `{VOICE_CONSTRAINTS}`, `{charity_name}`, etc. `str.format()` raises `KeyError` for any placeholder not passed as a kwarg.

**How to avoid:** Keep `str.replace("{token}", value)` unchanged. The prompts use `{ALL_CAPS_TOKENS}` which are replaced one at a time. This is intentional and must be preserved (D-03).

---

## Code Examples

### Example 1: convex_query signature (confirmed from lib/convex_client.py)

```python
# Source: packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
# convex_query is an async function taking an httpx.AsyncClient, path string, and args dict
# Returns the Convex response body (parsed from JSON)
# Auth: Authorization: Convex {CONVEX_DEPLOY_KEY}
# Error detection: body.get("status") != "success" raises, NOT HTTP status code

result = await convex_query(http, "agents:listForWorkspace", {"workspace_id": "eisenbalm"})
```

### Example 2: _extract() logic (source: lib/prompts.py)

```python
# Source: packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py (lines ~26-46)
_START = "<!-- PROMPT START -->"
_END   = "<!-- PROMPT END -->"

def _extract(raw: str, name: str) -> str:
    start_idx = raw.index(_START) + len(_START)
    end_idx   = raw.index(_END)
    body = raw[start_idx:end_idx]
    # strip exactly one leading and one trailing newline
    if body.startswith("\n"):
        body = body[1:]
    if body.endswith("\n"):
        body = body[:-1]
    return body
```

**The migration script MUST use `load_prompt(name)` (which calls `_extract()`) — not this function directly.**

### Example 3: Full run-start sequence in runs.py (the Phase 22 target)

```python
# packages/pipeline/src/eisenbalm_pipeline/api/runs.py
# POST /run/weekly handler — Phase 22 target ordering

from eisenbalm_pipeline.lib.config_loader import load_run_config, snapshot_config

async def _weekly_run_handler(request: Request, http: httpx.AsyncClient, body: WeeklyRunBody):
    issue_number = await _resolve_issue_number(http)
    run_id = new_run_id()
    begin_run(run_id)

    # Write to both frozen pipelineRuns and new runs table (same runId)
    await convex_mutation(http, "pipelineRuns:create", { ... "runId": run_id ... })
    await convex_mutation(http, "runs:create", {
        "workspace_id": "eisenbalm",
        "runId": run_id,
        "triggerSource": "manual",
    })

    # PHASE 22: load config + snapshot BEFORE create_task (D-10 / PITFALLS 1.1)
    config = await load_run_config(http)                        # ← awaited, in handler
    await snapshot_config(http, run_id, config)                 # ← awaited, in handler

    initial_state: DispatchState = {
        "run_id": run_id,
        "issue_number": issue_number,
        # ... existing fields ...
        "config": config,                                       # ← new field (Phase 22)
    }

    task = asyncio.create_task(_execute_run(request.app.state.graph, initial_state))  # ← after snapshot
    _track_task(task)
    return {"runId": run_id}
```

### Example 4: DispatchState addition + API_CONTRACTS.md §7 amendment (must happen first)

```python
# packages/pipeline/src/eisenbalm_pipeline/graph/state.py
from __future__ import annotations
from typing import NotRequired, Optional

# BEFORE writing this code, amend docs/API_CONTRACTS.md §7 to add:
#   config: NotRequired[Optional[RunConfig]]
#   - Type: RunConfig dataclass (or None for pre-22 tests)
#   - Populated at: run start by load_run_config()
#   - Immutable after: run start (snapshot commits before graph.ainvoke)
#   - Consumed by: all 11 load_prompt call sites (agents/scout,calibrator,editor,
#     advocate,researcher,bonus,game,design)

class DispatchState(TypedDict):
    # --- existing fields (all unchanged) ---
    run_id: str
    issue_number: int
    # ... etc ...
    # --- Phase 22 addition ---
    config: NotRequired[Optional[object]]  # RunConfig; Optional for backward-compat tests
```

### Example 5: Convex `agents` mutations needed (new Convex files)

```typescript
// convex/agents.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    workspace_id: v.string(),
    agentKey: v.string(),
    model: v.optional(v.string()),
    temperature: v.optional(v.number()),
    top_p: v.optional(v.number()),
    max_tokens: v.optional(v.number()),
    enabled: v.boolean(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agents")
      .withIndex("by_workspace_agentKey", (q) =>
        q.eq("workspace_id", args.workspace_id).eq("agentKey", args.agentKey)
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("agents", args);
    }
  },
});

export const listForWorkspace = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("agents")
      .withIndex("by_workspace", (q) => q.eq("workspace_id", args.workspace_id))
      .collect();
  },
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact on Phase 22 |
|---|---|---|---|
| Prompts in database | Prompts in package-bundled `.md` files + `importlib.resources` | Pre-existing (v1 design) | Migration is loader swap, not extraction — `.md` files stay as fallback |
| Convex queries mid-run per agent | Single `load_run_config()` at run start + state threading | Phase 22 (new) | Eliminates concurrent round-trips in parallel phase-2 superstep; simplifies agent code |
| No run config record | `configSnapshot` JSON on `runs` table | Phase 22 (new) | Every run is self-documenting and reproducible |

**Not deprecated this phase:** `load_prompt()` remains; it is promoted to fallback oracle role. `llm_config.py` remains; it is the in-code fallback default set.

---

## Open Questions

1. **Bonus `agents` row count**: Should `agents` have one `bonus` row (model/temp shared) or three (`bonus_big_budget`, `bonus_jingle`, `bonus_spec_ad`) for independent dashboard control in Phase 24?
   - What we know: `llm_config.py` has one `bonus` key; `prompt_versions` needs three rows; Phase 23 dashboard displays agent roster.
   - Recommendation: start with three distinct `agents` rows, all pointing to the same model/temp as `llm_config.py["bonus"]`. Avoids schema migration at Phase 24.

2. **`pipeline_config` shape**: The Phase-21 stub uses key/value pairs (flexible but opaque). CONTEXT.md expects `require_review`, `auto_publish`, `schedule_enabled`. Should these remain key/value or move to a typed single-row document?
   - What we know: The key/value schema is already deployed; changing it is a schema migration.
   - Recommendation: keep key/value; add constants for the known keys.

3. **`verify_prompt_seed.py` placement**: Script vs pytest parametrize?
   - Recommendation: pytest parametrize in `tests/lib/test_prompt_seed.py` — runs in CI without needing live Convex (mock `convex_query`). A separate `scripts/verify_prompt_seed.py` can verify against live Convex.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Convex cloud (modest-magpie-797) | `load_run_config()`, `snapshot_config()`, seed mutations | ✓ | Phase-21 deployed | Disk/code defaults (D-06) |
| `CONVEX_DEPLOY_KEY` env var | `convex_client.py` auth | ✓ | Set on Railway (Phase-21) | None — required; pipeline cannot call Convex without it |
| Railway Postgres | LangGraph checkpointer only | ✓ | In use | None (unrelated to Phase 22) |
| `importlib.resources` | `load_prompt()` fallback | ✓ | stdlib | N/A |
| Package data (`prompts/*.md`) | `load_prompt()` fallback | ✓ (verify) | Must be in `pyproject.toml` package-data | `FileNotFoundError` if missing |

**Missing dependencies with no fallback:** None — all dependencies available.

**Verify before starting:** Confirm `pyproject.toml` `[tool.setuptools.package-data]` includes `eisenbalm_pipeline = ["prompts/*.md"]` or equivalent. If missing, add it as the first task in Wave 0.

---

## Validation Architecture

> `workflow.nyquist_validation` not found in `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (confirmed from existing `tests/` directory; `pytest.ini` or `pyproject.toml` [tool.pytest]) |
| Config file | `packages/pipeline/pyproject.toml` (existing) |
| Quick run command | `cd packages/pipeline && pytest tests/lib/ -x -q` |
| Full suite command | `cd packages/pipeline && pytest -x -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CFG-01 | `load_run_config()` returns `RunConfig` with all 15 agents' config populated from Convex mock | unit | `pytest tests/lib/test_config_loader.py::test_load_run_config_from_convex -x` | ❌ Wave 0 |
| CFG-01 | Agents read `state["config"].agents[key].system_prompt` not disk — verified by no `load_prompt` import in agent files after swap | unit | `pytest tests/lib/test_config_loader.py::test_call_site_swap -x` (import check) | ❌ Wave 0 |
| CFG-01 | DispatchState.config field accepted without breaking existing state construction | unit | `pytest tests/test_builder_wiring.py -x` (existing, must stay green) | ✅ |
| CFG-02 | 11 seeded `prompt_versions.content` rows are byte-identical to `load_prompt()` output | unit | `pytest tests/lib/test_prompt_seed.py -x` | ❌ Wave 0 |
| CFG-02 | Seed is idempotent — running twice produces no duplicates, version stays 1 | unit | `pytest tests/lib/test_prompt_seed.py::test_seed_idempotent -x` | ❌ Wave 0 |
| CFG-03 | On Convex exception in `load_run_config()`, returns full disk fallback config + emits WARNING, does not raise | unit | `pytest tests/lib/test_config_loader.py::test_hard_failure_fallback -x` | ❌ Wave 0 |
| CFG-03 | On missing single prompt row, that agent uses file fallback, others use Convex — verified by per-agent WARNING | unit | `pytest tests/lib/test_config_loader.py::test_partial_fallback_per_key -x` | ❌ Wave 0 |
| CFG-03 | Fallback config bytes for prompts are identical to current `load_prompt()` output (not regression from swap) | unit | `pytest tests/lib/test_config_loader.py::test_fallback_bytes_match_load_prompt -x` | ❌ Wave 0 |
| CFG-04 | `snapshot_config()` is called BEFORE `asyncio.create_task()` in the HTTP handler | unit | `pytest tests/api/test_runs_config_snapshot.py::test_snapshot_before_task -x` | ❌ Wave 0 |
| CFG-04 | `runs.configSnapshot` JSON can round-trip through `RunConfig` dataclass | unit | `pytest tests/lib/test_config_loader.py::test_snapshot_roundtrip -x` | ❌ Wave 0 |
| CFG-04 | Resume path does NOT re-snapshot (existing snapshot stays intact) | unit | `pytest tests/api/test_runs_config_snapshot.py::test_resume_no_resnap -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd packages/pipeline && pytest tests/lib/test_config_loader.py tests/lib/test_prompt_seed.py -x -q`
- **Per wave merge:** `cd packages/pipeline && pytest -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `tests/lib/test_config_loader.py` — covers CFG-01, CFG-03, CFG-04
- [ ] `tests/lib/test_prompt_seed.py` — covers CFG-02 (parametrize over 11 pairs; mock `convex_query`)
- [ ] `tests/api/test_runs_config_snapshot.py` — covers CFG-04 snapshot ordering (mock `asyncio.create_task` and `convex_mutation`; assert snapshot called first)
- [ ] `tests/lib/__init__.py` — if not present (needed for test discovery in the `lib/` subtree)

Existing tests that MUST stay green after Phase 22:
- `tests/test_builder_wiring.py` — asserts graph topology; must still pass after DispatchState.config added
- `tests/test_voice.py` — byte-equivalence invariants; `assemble_voice()` must stay unchanged
- `tests/test_section_writer_voice_propagation.py` — narrator voice propagation; unaffected by Phase 22

---

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` apply to Phase 22 planning and implementation:

- **API_CONTRACTS.md amendment FIRST:** "do not modify field names without checking API_CONTRACTS.md first." For Phase 22: amend `docs/API_CONTRACTS.md §7` for `DispatchState.config` BEFORE writing any code that adds the field to `state.py`.
- **Schema files:** `schemas/` and `convex/schema.ts` field names are governed by `API_CONTRACTS.md`. Adding `max_tokens`, `top_p`, `description` to the `agents` table must be consistent with the brief's §3A.
- **GSD workflow enforcement:** All code changes go through a GSD workflow entry point (`/gsd:execute-phase`). No direct repo edits outside GSD.
- **Tech stack locked:** Next.js 14+, Sanity v3, FastAPI, LangGraph, OpenRouter, Supabase, Convex, Stripe — do not substitute.
- **Security:** Secrets (API keys, webhook secrets) MUST NOT be stored in Convex. `CONVEX_DEPLOY_KEY` stays in Railway env vars only.
- **Frozen tables:** `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog` — do NOT modify these tables or their mutation signatures.

---

## Sources

### Primary (HIGH confidence)

- `packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py` — `_extract()` / `load_prompt()` byte-exact logic; the migration oracle
- `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` — confirmed dict names (`SAMPLING_BY_AGENT`, NOT `AGENT_GEN_PARAMS`); all 15 agent keys; model tier assignments
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` — confirmed run-start sequence; two `ainvoke` sites (lines ~161, ~310); current order (pipelineRuns:create → initial_state → create_task)
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — confirmed `DispatchState` TypedDict; no `config` field currently present
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` — confirmed `convex_query` / `convex_mutation` signatures; auth pattern; error detection on `body["status"]`
- `convex/schema.ts` (lines 249–285) — Phase-21 stub schemas for `agents`, `prompt_versions`, `pipeline_config`, `runs`; confirmed `configSnapshot: v.optional(v.string())` already present; confirmed `agents` stub MISSING `max_tokens`, `top_p`, `description`
- `packages/pipeline/src/eisenbalm_pipeline/prompts/` — confirmed 11 prompt `.md` files (excluding README.md)
- All 11 agent call sites — confirmed via `grep -rn "load_prompt"` across `agents/` directory
- `.planning/research/ARCHITECTURE.md` §2 — config externalization design; `load_run_config()` + `snapshot_config()` pattern; RunConfig shape
- `.planning/research/PITFALLS.md` — Pitfall 1.1 (snapshot race); Pitfall 1.2 (keep .md files); Pitfall 2.1 (byte-verification)
- `.planning/phases/22-config-externalization/22-CONTEXT.md` — locked decisions D-01 through D-10

### Secondary (MEDIUM confidence)

- `.planning/research/SUMMARY.md` — mission control milestone summary; confirms 8-call-site count (research was written before bonus×3 was counted; actual call site count is 11 across 8 files)
- `docs/CURRENT_STATE.md` — Phase 0 reconciliation; Q1 confirms file-based prompts, exact call-site table

### Tertiary (LOW confidence — not needed for planning)

- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries are in-repo; no new dependencies
- Architecture patterns: HIGH — all patterns derived from live codebase reads; RunConfig shape from ARCHITECTURE.md §2
- Pitfalls: HIGH — snapshot race and byte-mismatch confirmed from PITFALLS.md + direct code verification
- AgentKey mapping: HIGH — derived from `grep` of actual call sites + `llm_config.py` key list
- Validation Architecture: HIGH — test seams derived from actual failure modes, not abstract requirements

**Research date:** 2026-06-22
**Valid until:** 2026-08-22 (stable codebase; schema stubs won't change until Phase 22 lands)

**Key discrepancy found and documented:** `22-CONTEXT.md` D-04 references `AGENT_GEN_PARAMS` but the actual dict in `llm_config.py` is `SAMPLING_BY_AGENT`. Any code importing the former will fail. The planner must use `SAMPLING_BY_AGENT`.

**Call-site count clarification:** The research summary and CONTEXT.md say "8 call sites" or "11 call sites" interchangeably. The precise count: **8 agent files** each containing between 1 and 3 `load_prompt()` calls, totaling **11 individual call-site occurrences**. All 11 must be swapped.
