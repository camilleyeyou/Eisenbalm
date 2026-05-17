---
phase: 05-agent-quality
plan: 06
subsystem: pipeline-agent

tags: [scout, tavily, dedup, iteration-limit, charity-discovery, AGT-03, AGT-04, AGT-18]

# Dependency graph
requires:
  - phase: 05-agent-quality
    provides: "Plan 05-03 — lib/search_client.web_search (Tavily); lib/openrouter_client.acomplete (kwargs-only); lib/errors.AgentToolCallLimitExceeded 3-arg constructor"
  - phase: 05-agent-quality
    provides: "Plan 05-02 — DispatchState.featured_charity_keys: Optional[list[str]] (NotRequired, list NOT set per RESEARCH Pitfall 7)"
  - phase: 05-agent-quality
    provides: "Plan 05-01 — deliberationEvents.eventType accepts 'agent-tool-limit-exceeded' literal (used by @agent_node wrapper when Scout raises)"
  - phase: 05-agent-quality
    provides: "Plan 05-04 — Wave 0 test skeletons + sample_dispatch_state fixture (consumed by Scout tests)"
  - phase: 04-pipeline-skeleton
    provides: "@agent_node decorator contract (locked); three-datastore write order (Sanity then Convex); convex_mutation_safe; lib.sanity_client.write_charity + shared httpx AsyncClient"
provides:
  - "agents/scout.py — Real Tavily-driven Scout body replacing Phase 4 stub: 1-3 web_search calls, Pydantic ScoutBatchOutput, AGT-04 dedup, AGT-18 iteration limit, AGT-17 modelVersions"
  - "agents/scout._load_featured_keys — Single GROQ read against Sanity charity archive at Scout start (D-10); returns sorted list[str] of lowercase name|slug|domain"
  - "agents/scout._domain_of, _candidate_keys — Helpers usable by Plan 05-09 Researcher when its own dedup needs land"
  - "tests/agents/test_scout.py — 5 passing tests (test_domain_of, test_candidate_keys, test_candidate_count, test_dedup, test_tool_limit_exceeded)"
affects:
  - "05-07-advocate (consumes state['candidates'] from Scout; Plan 05-07 emits the first 'advocate-argument' deliberationEvents row)"
  - "05-08-editor-gate1 (consumes state['candidates'] + Advocate scores; uses featured_charity_keys indirectly via Sanity archive)"
  - "05-14-real-mode-integration-test (asserts Scout produces 3-5 candidates + featured_charity_keys list against live Sanity)"

# Tech tracking
tech-stack:
  added: []  # All deps already pinned in Plan 05-02
  patterns:
    - "Single GROQ load at agent start (D-10): featured_charity_keys = await _load_featured_keys() runs once; Python-side filter against the in-memory set on every candidate"
    - "Iteration-limit counter in agent body (AGT-18): local tool_calls int increments before every web_search; pre-loop guard raises AgentToolCallLimitExceeded BEFORE the next call when budget is exhausted"
    - "Defensive Pydantic shape extraction: hasattr(batch_out, 'candidates') → use direct; isinstance dict → use dict get; else empty list — works in both stub-mode (model_construct empty) and real-mode (populated)"
    - "GROQ HTTP fallback: direct httpx GET on /{API_VERSION}/data/query/{dataset}?query=... (no groq_query helper exists in lib/sanity_client.py at present); first-run safe (empty list on any error)"
    - "Sorted dedup key list: sorted(keys) returned by _load_featured_keys gives deterministic test fixtures and stable Sanity-archive ordering"
    - "@agent_node decorator preserved verbatim (Phase 4 contract): emit_event=None, max_tool_calls=8; AgentToolCallLimitExceeded surfaces through the wrapper's generic Exception handler → pipelineRuns.status='failed' + errorMessage formatted per CONTEXT D-27"

key-files:
  created:
    - ""
  modified:
    - "packages/pipeline/src/eisenbalm_pipeline/agents/scout.py (replaced Phase 4 fixture-based stub body with real Tavily + OpenRouter implementation; 260 insertions, 30 deletions)"
    - "packages/pipeline/tests/agents/test_scout.py (replaced Wave 0 skip skeletons with 5 real assertions; 173 insertions, 11 deletions)"

key-decisions:
  - "GROQ load implemented inline via raw httpx GET, NOT via a new lib/sanity_client.groq_query helper. Reason: lib/sanity_client.py does not export groq_query at this point; adding it would expand scope into Plan 05-09 Researcher territory. Scout's GROQ is the only Phase 5 read path (Plan 05-09 Researcher does Tavily-only verification). When Researcher needs GROQ reads, Plan 05-09 can promote _load_featured_keys' pattern to lib if desired."
  - "_load_featured_keys returns sorted list[str] (not set, not unsorted list). sorted gives deterministic test fixtures; list (vs set) preserves JSON-serializable LangGraph checkpoint per RESEARCH Pitfall 7; DispatchState.featured_charity_keys is typed list[str] for the same reason."
  - "AgentToolCallLimitExceeded 3-arg constructor (agent_id, attempts, limit) — preserves introspectable attributes for the wrapper and Plan 05-14 integration test assertions. Tests verify excinfo.value.agent_id == 'scout', limit == 8."
  - "acomplete called with kwargs-only signature (agent_id=, run_id=, messages=, response_format=) per Plan 05-03 lib/openrouter_client.py contract. Plan template showed positional form (acomplete('scout', messages, response_format=...)) — adapted to lib's actual signature."
  - "Iteration-limit raises BEFORE the would-be 9th tool call (not AFTER): pre-loop check 'if tool_calls >= max_calls: raise' fires when about to make the 9th call. Tests patch SCOUT_QUERIES to 9 entries; the 9th iteration trips the raise."
  - "Extra post-loop guard added: 'if tool_calls > max_calls: raise' covers the case where a future SCOUT_QUERIES expansion grows the static tuple itself past 8 (not exercised by current tests but a defensive belt-and-braces against AGT-18 regression)."
  - "Sanity client error path mirrors Phase 4 stub: get_sanity_http() RuntimeError → RuntimeError raised in body → @agent_node wrapper sets status='failed'. Same surface as Phase 4 (CONTEXT D-20)."
  - "Stub-mode acomplete path tolerated: when EISENBALM_STUB_MODE=true and response_format=ScoutBatchOutput, acomplete returns model_construct() (empty .candidates). Defensive extraction handles this without crashing — surviving list is empty, return state is shape-correct, no Sanity/Convex writes happen. Tests bypass this via direct acomplete patching."

patterns-established:
  - "Iteration limit pattern reusable by Plan 05-09 Researcher (max_tool_calls=12): local counter incremented before each web_search; pre-call AgentToolCallLimitExceeded raise; post-loop defensive guard"
  - "Dedup-load helper pattern: one GROQ at agent start, sorted list[str] keys, case-insensitive match against {name, slug, domain}; reusable by any future agent doing archive dedup"
  - "Pydantic-output extraction defense: candidates_raw extraction handles stub-mode model_construct() (empty), real-mode populated Pydantic object, and dict fallback — single function call site is robust across modes"

requirements-completed:
  - AGT-03
  - AGT-04
  - AGT-18

# Metrics
duration: 4min
completed: 2026-05-17
---

# Phase 05 Plan 06: Scout Summary

**Replaces the Phase 4 Scout stub body with a real Tavily-driven implementation: 1-3 curated web searches, Pydantic-validated 3-5 candidate output via OpenRouter, single-GROQ archive dedup, and a hard iteration-limit budget that raises AgentToolCallLimitExceeded when exceeded — exercising AGT-03 + AGT-04 + AGT-18 mechanically for the first time in the pipeline.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-17T18:17:51Z
- **Completed:** 2026-05-17T18:22:00Z (approx)
- **Tasks:** 2
- **Files modified:** 2 (1 agent body, 1 test file)

## Accomplishments

- **Real Tavily-driven candidate discovery (AGT-03):** Scout makes up to 3 `web_search()` calls against curated queries ("obscure charity", "underfunded foundation", "small charity unique mission"), aggregates up to 15 raw hits, and parses them via OpenRouter Haiku (`MODEL_BY_AGENT['scout']` = `anthropic/claude-haiku-4-5`) into a Pydantic `ScoutBatchOutput(candidates: list[CharityCandidate] = Field(min_length=3, max_length=5))`. Single LLM call site (`acomplete` from Plan 05-03).
- **Archive dedup at Scout start (AGT-04, D-10):** New `_load_featured_keys()` helper makes one GROQ read against `*[_type == "charity"]{ name, "slug": slug.current, website }`, returns `sorted(list[str])` of lowercase name + lowercase slug + lowercase website-domain keys. Each surviving LLM-emitted candidate's `_candidate_keys()` (lowercase name + lowercase domain via `_domain_of(url)`) is set-intersected against the featured archive; matches are dropped before Sanity write. The dedup list is also persisted into `state['featured_charity_keys']` (as `list[str]` for JSON-safe LangGraph checkpointing per RESEARCH Pitfall 7).
- **Iteration limit enforcement (AGT-18, D-21):** Local `tool_calls: int = 0` counter increments before every `web_search()` call. Pre-loop guard `if tool_calls >= max_calls: raise AgentToolCallLimitExceeded(agent_id="scout", attempts=tool_calls, limit=8)` fires when the 9th call would be made. The `@agent_node` decorator's generic exception handler catches it and writes `pipelineRuns.status='failed'` with `errorMessage='scout: AgentToolCallLimitExceeded: ...'` (CONTEXT D-27 format).
- **Three-datastore write order preserved (CONTEXT D-18, D-20):** Phase 4 stub order kept verbatim — Sanity `write_charity` first (raise on failure → halts pipeline), then Convex `pitchLog:insert` via `convex_mutation_safe` (log + continue on failure). Deterministic `charity-{slug}` IDs via Sanity client's existing logic; idempotent across re-runs.
- **AGT-17 model versioning recorded:** `state['model_versions']['scout']` populated with the resolved model ID from `usage['resolved_model']` after every successful run — surfaces in `pipelineMetadata.modelVersions` JSON when Publisher writes the issue.
- **5 unit tests passing (AGT-03 + AGT-04 + AGT-18 + AGT-17 mechanical proof):** `test_domain_of` + `test_candidate_keys` validate dedup helpers; `test_candidate_count` mocks Tavily + LLM to verify 3 ≤ len(candidates) ≤ 5 plus modelVersions['scout'] recording; `test_dedup` verifies "Foo Org" (matching `foo org`/`foo.example` in featured archive) is dropped while non-matching candidates survive AND `featured_charity_keys` returned as `list`; `test_tool_limit_exceeded` patches `SCOUT_QUERIES` to 9 entries and asserts `AgentToolCallLimitExceeded` is raised with introspectable `.agent_id`, `.limit`, `.attempts` attributes.

## Task Commits

Each task was committed atomically (--no-verify per parallel-executor protocol):

1. **Task 1: Replace Scout stub body with real Tavily-driven implementation** — `c610df3` (feat)
2. **Task 2: Replace test_scout.py skip-skeletons with real assertions** — `5e8b332` (test)

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` — 260 insertions, 30 deletions (replaced Phase 4 fixture-based body; preserves @agent_node decorator + DispatchState contract)
- `packages/pipeline/tests/agents/test_scout.py` — 173 insertions, 11 deletions (replaced Wave 0 skip skeletons with 5 real assertions)

## Decisions Made

- **GROQ load implemented inline (no new lib helper):** `_load_featured_keys()` lives in `agents/scout.py` and makes a direct httpx GET to `/{API_VERSION}/data/query/{dataset}?query=...` because `lib/sanity_client.py` does not export a `groq_query` function at this point. Plan template assumed one exists; adapted to actual codebase state. If Plan 05-09 Researcher needs GROQ reads, the pattern can be promoted to `lib/sanity_client.py` then.
- **`acomplete` called with kwargs-only signature:** Plan template showed `acomplete("scout", messages, response_format=ScoutBatchOutput)` (positional). The actual `lib/openrouter_client.py` signature is `acomplete(*, agent_id, run_id, messages, response_format)`. Adapted call site accordingly.
- **3-arg `AgentToolCallLimitExceeded` constructor:** `AgentToolCallLimitExceeded(agent_id="scout", attempts=tool_calls, limit=max_calls)` — preserves introspectable attributes for wrapper / Plan 05-14 assertions. Tests verify `excinfo.value.agent_id`, `.limit`, `.attempts`.
- **`_load_featured_keys` returns `sorted(list[str])`:** sorted gives deterministic test fixtures + stable archive ordering. list (vs set) preserves JSON-serializable LangGraph checkpoint per RESEARCH Pitfall 7.
- **Pre-loop iteration-limit raise (BEFORE the 9th call, not AFTER):** `if tool_calls >= max_calls: raise` fires when about to make the 9th call. Tests patch `SCOUT_QUERIES` to 9 entries; iteration 9 trips the raise with `attempts == 8` (or higher; test asserts `>= 8`).
- **Defensive Pydantic shape extraction:** `if hasattr(batch_out, 'candidates'): list(batch_out.candidates or [])` handles both stub-mode (`model_construct()` → empty `.candidates`) and real-mode (populated). Fallback to `isinstance(dict)` covers Pydantic-failure cases. Tests bypass via direct `acomplete` patching.
- **Sanity client error path mirrors Phase 4:** `get_sanity_http()` RuntimeError → RuntimeError raised in body → wrapper sets `status='failed'`. Same surface as Phase 4 stub (CONTEXT D-20 "Sanity failure halts the pipeline").

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan template referenced non-existent `groq_query` import**
- **Found during:** Task 1
- **Issue:** Plan template specified `from eisenbalm_pipeline.lib.sanity_client import ... groq_query` but `lib/sanity_client.py` does not export `groq_query`. Plan template implied it exists.
- **Fix:** Implemented GROQ load inline via direct httpx GET to Sanity's `/data/query/{dataset}` endpoint, using the existing `get_sanity_http()` shared client + `API_VERSION` + `_dataset()` helpers already exported by `lib/sanity_client.py`. First-run safe (empty list on any error).
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py`
- **Commit:** `c610df3`
- **Note:** If Plan 05-09 Researcher needs GROQ reads, the helper pattern can be promoted to `lib/sanity_client.py` at that time.

**2. [Rule 3 - Blocking] Plan template used positional `acomplete` call; actual signature is kwargs-only**
- **Found during:** Task 1
- **Issue:** Plan template showed `content, usage = await acomplete("scout", messages, response_format=ScoutBatchOutput)` (mixed positional). The actual `lib/openrouter_client.py` defines `acomplete(*, agent_id, run_id, messages, response_format=None)` — kwargs-only. Positional call would `TypeError`.
- **Fix:** Adapted call site to keyword arguments: `await acomplete(agent_id="scout", run_id=run_id, messages=messages, response_format=ScoutBatchOutput)`.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py`
- **Commit:** `c610df3`

**3. [Rule 2 - Critical functionality] Added belt-and-braces post-loop iteration-limit check**
- **Found during:** Task 1
- **Issue:** Plan template only checked the limit at the top of the loop. If a future SCOUT_QUERIES expansion grows the tuple past 8, the pre-loop check still catches it on iteration 9, but only because the loop iterates sequentially. A defensive `if tool_calls > max_calls: raise` after the loop guards against any logic-change regression that would let `tool_calls` reach 9+ silently.
- **Fix:** Added `if tool_calls > max_calls: raise AgentToolCallLimitExceeded(...)` after the search loop.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py`
- **Commit:** `c610df3`
- **Note:** Not exercised by current tests (the in-loop raise fires first) but harmless as a regression backstop.

**Notes on plan-flagged choices:**
- **CharityCandidate Pydantic field set:** matches `docs/CLAUDE_CODE_BRIEF.md` lines 89-103 (Scout contract: 3-5 candidates, name, location, website, assetRange, focusArea, missionStatement, scoutSummary, whyOverlooked). Plan template field list copied verbatim. Phase 4 fixture shape (which has additional optional fields like `charityNavigatorUrl`, `guidestarUrl`, `foundingYear`) is a superset — `write_charity` accepts both shapes via `.get()` calls.
- **`SCOUT_QUERIES` tuple size = 3:** chosen because 3 × 5 results = 15 candidates which Haiku can comfortably filter to 3-5 surviving picks. Well under the `max_tool_calls=8` budget; leaves headroom for Plan 05-14 real-mode integration test to add a 4th query if Andrew finds the initial set too narrow.

## Authentication Gates

None encountered. Scout reads from Sanity (existing `SANITY_API_TOKEN` env var, gracefully degrades to empty archive on missing token) and writes to Sanity + Convex (existing tokens, fail-fast on missing).

## Issues Encountered

- **Parallel executor test collection errors (out of scope):** `tests/agents/test_calibrator.py` and `tests/agents/test_editor.py` failed `pytest --collect-only` due to imports (`BONUS_TYPES`, `EDITOR_CONFIDENCE_THRESHOLD`) that don't yet exist in their respective agent modules. These are Plans 05-05 (Calibrator) and 05-08 (Editor Gate 1) — running in parallel. Not Scout's concern. Scout's 5 tests pass cleanly; the broader test suite passes 29 + 42 skipped when these two files are excluded.

## User Setup Required

None — Scout consumes pre-existing env vars (`SANITY_API_TOKEN`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `CONVEX_DEPLOY_KEY`). All documented in `packages/pipeline/.env.example` by Plan 05-02. Stub-mode tests don't require any of them.

## Next Phase Readiness

**Ready for Plan 05-07 (Advocate):**

- Advocate consumes `state['candidates']` populated by Scout — shape locked at `list[dict]` matching `CharityCandidate` Pydantic dump.
- Advocate adds `advocateScore: int (1-10)` and `advocateArgument: str` fields to each candidate dict (matching the existing `CharityCandidate` TypedDict in `graph/state.py`).
- `state['featured_charity_keys']` is set; Advocate does not consume it (Scout already filtered).
- `state['model_versions']['scout']` is set; Advocate appends `'advocate'` to the same dict.

**Ready for Plan 05-08 (Editor Gate 1):**

- Editor consumes Scout candidates + Advocate scores to pick winner; no Scout-specific dependencies.

**Ready for Plan 05-14 (real-mode integration test):**

- Plan 05-14 will run Scout against live Tavily + live OpenRouter Haiku + live Sanity; assert 3-5 candidates survive dedup against the seeded charity archive; assert `pipelineRuns.cost.agents['scout'].usd > 0`; assert `featured_charity_keys` is a non-empty `list[str]` after Sanity archive grows past Phase 1 seed.

**No blockers introduced.**

---

## Self-Check: PASSED

**Verified files exist:**
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` (replaced; 295 lines)
- FOUND: `packages/pipeline/tests/agents/test_scout.py` (replaced; 175 lines)

**Verified commits exist:**
- FOUND: `c610df3` (Task 1 — agents/scout.py real implementation)
- FOUND: `5e8b332` (Task 2 — tests/agents/test_scout.py real assertions)

**Verified runtime behavior:**
- `EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.scout import scout"` imports cleanly.
- `_domain_of('https://www.foo.org/about')` returns `'foo.org'`.
- `_domain_of('http://bar.example/x')` returns `'bar.example'`.
- `_candidate_keys(CharityCandidate(name='Foo Org', website='https://foo.org', ...))` returns `{'foo org', 'foo.org'}`.
- `@agent_node` decorator parameters preserved: `scout._max_tool_calls == 8`.
- Function signature preserved: `inspect.signature(scout).parameters` is `{'state'}` (single param).
- `EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_scout.py -x -v` exits 0 with 5 passed.
- Acceptance grep: `web_search` ≥1 (3 hits), `AgentToolCallLimitExceeded` ≥2 (4 hits), `max_tool_calls=8` ≥1 (2 hits), `featured_charity_keys` in tests ≥1 (3 hits).

---
*Phase: 05-agent-quality*
*Completed: 2026-05-17*
