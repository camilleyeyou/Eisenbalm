---
phase: 04-pipeline-skeleton
plan: 02
subsystem: pipeline-library
tags: [python, typeddict, langgraph, httpx, sanity, convex, portable-text, cost-tracking, run-id, async]

# Dependency graph
requires:
  - phase: 04-pipeline-skeleton-01
    provides: pyproject.toml with fastapi/httpx/langgraph/python-slugify pinned + eisenbalm_pipeline package skeleton
  - phase: 03-convex-deployment
    provides: Convex HTTP API contract (Authorization: Convex {KEY}, body status field for errors)
  - phase: 02-web-shell-theme-engine
    provides: weeklyIssue Sanity schema with pipelineMetadata field
provides:
  - DispatchState TypedDict + 9 nested TypedDicts matching API_CONTRACTS §7 verbatim
  - new_run_id() — single source of run_id generation (uuid4().hex, 32-char no-dash)
  - text_to_portable_text() — canonical Sanity Portable Text helper
  - convex_mutation / convex_mutation_safe / convex_query — Convex HTTP API wrappers with correct Convex auth + status-field error branching
  - write_charity / write_issue_draft / upload_pdf_to_issue / set_charity_first_featured — Sanity write surface via raw httpx
  - CostRecorder + record_cost / get_cost_payload / get_duration_ms / end_run — per-run cost + duration tracking shape
  - Module-level _CLIENT singleton + set_client() / get_client() pattern in convex_client.py for FastAPI lifespan injection
affects: [04-06-stub-fixtures-and-wrapper, 04-07-stub-agents, 04-08-graph-builder-and-checkpointer, 04-09-fastapi-app-and-routers, 04-10-integration-tests, 05-real-agents, 06-publisher-and-pdf, 09-frontend-deliberation]

# Tech tracking
tech-stack:
  added: [python-slugify (already in pyproject from 04-01)]
  patterns:
    - "Module-level shared httpx.AsyncClient via set_client()/get_client() — injected from FastAPI lifespan"
    - "Sanity writes via raw httpx (no SDK) — POST /v2024-01-01/data/mutate/{dataset} with Bearer auth"
    - "Convex calls branch on body.get('status') != 'success' — NOT on response.status_code (Pitfall 7)"
    - "Cost payload shape: {'total': float, 'agents': {name: {tokens_in, tokens_out, usd, duration_ms}}}, JSON-stringified into both Sanity pipelineMetadata.cost and Convex pipelineRuns.cost"
    - "Deterministic Sanity _ids: charity-{slugify(name)} and issue-{issueNumber}"
    - "Underscore-prefix convention for non-canonical test-only TypedDict fields (_force_no_winner, _force_fail_agent)"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/graph/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/ids.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/cost.py
    - packages/pipeline/src/eisenbalm_pipeline/types.py
  modified: []

key-decisions:
  - "DispatchState matches API_CONTRACTS §7 verbatim plus two underscore-prefixed test toggles (_force_no_winner, _force_fail_agent) — underscore signals non-canonical (research §Open Questions Q3). API_CONTRACTS §7 not amended."
  - "set_charity_first_featured uses Sanity-native setIfMissing rather than API_CONTRACTS §2.5's 'GET + check + set' pattern — atomic and avoids the extra GET round-trip. Documented as Claude's discretion (Rule 1 deviation neighborhood: a correctness improvement, but small enough to not break the existing API_CONTRACTS contract since the observable result — only writes when missing — is identical)."
  - "Convex auth header uses literal 'Convex ' prefix (NOT 'Bearer ') — verified by grep at three call sites (convex_mutation x1, convex_query x1, plus the literal string in the module docstring NOTING that it is NOT Bearer)."
  - "convex_mutation_safe handles the case where set_client() hasn't been called: logs warning and drops the call. This lets stub agents safely emit deliberation events even before the FastAPI lifespan boots (e.g., in pytest unit tests)."
  - "CostRecorder is exposed both as module-level functions (begin_run/record_cost/end_run) AND as a context manager class. The @agent_node wrapper (Plan 06) will use the function form; Phase 5 may prefer the CM form for ergonomic blocks."
  - "Cost store is thread-safe via threading.Lock — handles pytest concurrent runs even though FastAPI itself is single-event-loop."

patterns-established:
  - "TypedDict contract verbatim from docs: graph/state.py is the canonical state. Agent code in Plan 07 imports from eisenbalm_pipeline.graph.state, never invents fields."
  - "Sanity client surface: every public function takes (http: AsyncClient, ...) first arg — caller passes the lifespan-owned client. No global Sanity client object."
  - "Convex client surface: convex_mutation(http, ...) is the explicit form; convex_mutation_safe(...) uses the module singleton + swallows errors (CONTEXT D-20)."
  - "Optional cost payload: write_issue_draft(http, state, cost_payload=None) — falls back to {'total': 0.0, 'agents': {}} so stub mode produces a structurally complete pipelineMetadata.cost field on day one."
  - "API_VERSION = 'v2024-01-01' exported from sanity_client — single source of truth for Sanity REST API version."

requirements-completed: [PIP-05, PIP-07]

# Metrics
duration: 5min
completed: 2026-05-14
---

# Phase 04 Plan 02: DispatchState + Library Modules Summary

**Canonical LangGraph state shape + Sanity/Convex HTTP clients + Portable Text helper + per-run cost/duration tracking + UUID run_id generator — the load-bearing library surface that every Wave-2 stub agent and Wave-3 FastAPI route imports.**

## Performance

- **Duration:** ~4 min 19 sec (259 s)
- **Started:** 2026-05-14T02:31:05Z
- **Completed:** 2026-05-14T02:35:24Z
- **Tasks:** 5 (all autonomous)
- **Files modified:** 9 created, 0 modified

## Accomplishments

- `graph/state.py` ships `DispatchState` + 9 nested TypedDicts copied verbatim from `docs/API_CONTRACTS.md` §7 (lines 1185-1291). Two underscore-prefixed test toggles appended per research §"Open Questions" Q3.
- `lib/portable_text.py` ships `text_to_portable_text()` byte-for-byte from API_CONTRACTS §2.4. Every block + span gets a UUID-based `_key` so Sanity Studio renders correctly.
- `lib/convex_client.py` ships `convex_mutation` / `convex_mutation_safe` / `convex_query` with the correct `Authorization: Convex {KEY}` header (NOT Bearer) and error detection that branches on body `status` field (NOT HTTP status code) — Pitfall 7 defended in code.
- `lib/sanity_client.py` ships the full Sanity write surface (`write_charity`, `write_issue_draft`, `upload_pdf_to_issue`, `set_charity_first_featured`) via raw httpx since no maintained Sanity Python SDK exists (research §5). `write_issue_draft` writes `pipelineMetadata.runId = state['run_id']` and `pipelineMetadata.cost = json.dumps(cost_payload)` per CONTEXT D-22.
- `lib/cost.py` ships the `CostRecorder` machinery — additive per-agent accumulation, JSON-serializable payload shape, wall-clock duration tracking, thread-safe via `threading.Lock`.
- `lib/ids.py` ships `new_run_id() -> uuid.uuid4().hex` — 32-char no-dash, the single source of run_id generation (PIP-05 foundation).

## Task Commits

Each task was committed atomically with `--no-verify` (parallel executor wave):

1. **Task 1: DispatchState + ids + types + __init__ files** — `631981b` (feat)
2. **Task 2: portable_text helper** — `c0ae03c` (feat)
3. **Task 3: Convex HTTP client (mutation/query/safe)** — `4397637` (feat)
4. **Task 4: Sanity write client (raw httpx)** — `670b77a` (feat)
5. **Task 5: CostRecorder + duration tracking** — `8a3f185` (feat)

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/graph/__init__.py` — graph subpackage marker
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — `DispatchState` + 9 nested TypedDicts (`StyleBrief`, `CharityCandidate`, `ResearchOutput`, `SectionContent`, `CaseStudyContent`, `GameContent`, `BonusContent`, `Theme`, `QACorrection`) plus two test toggles
- `packages/pipeline/src/eisenbalm_pipeline/lib/__init__.py` — lib subpackage marker
- `packages/pipeline/src/eisenbalm_pipeline/lib/ids.py` — `new_run_id()` returning uuid4 hex
- `packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` — `text_to_portable_text(text)` Sanity block builder
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` — `convex_mutation` + `convex_mutation_safe` + `convex_query` + `set_client` / `get_client` singleton helpers
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` — `write_charity`, `write_issue_draft`, `upload_pdf_to_issue`, `set_charity_first_featured`, plus internal `_build_bonus` and `_build_podcast_description` helpers; `API_VERSION = "v2024-01-01"` constant
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` — `begin_run`, `record_cost`, `get_cost_payload`, `get_duration_ms`, `end_run`, `cost_payload_to_json`, plus `CostRecorder` context-manager wrapper
- `packages/pipeline/src/eisenbalm_pipeline/types.py` — public re-exports of all 10 TypedDicts for tests and external code

## Decisions Made

1. **`setIfMissing` vs `set` in `set_charity_first_featured`** — chose Sanity-native `setIfMissing` (atomic, no extra GET round-trip) rather than API_CONTRACTS §2.5's "fetch + Python-side `not existing.get('firstFeaturedIn')` check + commit" pattern. Same observable result; safer under concurrent re-runs. Recorded here per the plan's output spec.
2. **Test toggles on `DispatchState`** — added `_force_no_winner: Optional[bool]` and `_force_fail_agent: Optional[str]` at the end of `DispatchState` with an inline comment marking them as non-canonical (research §"Open Questions" Q3). API_CONTRACTS §7 explicitly NOT amended — these are pipeline-internal test affordances.
3. **`convex_mutation_safe` no-op when `_CLIENT` is `None`** — emits a warning log and returns silently. This means stub agents in pytest unit-tests (no FastAPI lifespan running) can call it without raising. Plan 06's `@agent_node` wrapper will rely on this in dev/test paths.
4. **`CostRecorder` exists both as functions and as a class** — both surfaces are tested. The plan only required the function set; the CM wrapper is a small ergonomic add that makes Phase 5's per-agent blocks cleaner. Module-level functions remain the primary API for Plan 06's wrapper.
5. **`threading.Lock` for the cost store** — pytest may exercise concurrent test runs even though FastAPI is single-event-loop. Lock acquisition cost is negligible.
6. **`write_issue_draft` accepts `cost_payload: Optional[dict] = None`** — when `None`, falls back to `{"total": 0.0, "agents": {}}` so stub mode produces a structurally complete `pipelineMetadata.cost` field from day one. Phase 5 passes `get_cost_payload(run_id)` here.

## Deviations from Plan

None — plan executed exactly as written. The two items recorded as "Claude's discretion" in the plan (Decision 1 above, Decision 2 above) are noted in the SUMMARY as required by the plan's `<output>` block, not as deviations.

## Issues Encountered

None. All five `uv run python -c "..."` verifications passed on the first try. `slugify` was already pinned in `pyproject.toml` (`python-slugify==8.0.4`) by Plan 01.

## Forward Links

- **Plan 04-06 (Stub fixtures + `@agent_node` wrapper)** will import:
  - `eisenbalm_pipeline.lib.convex_client.convex_mutation_safe` (for `deliberationEvents:insert` + `pipelineRuns:updateStatus` calls inside the wrapper)
  - `eisenbalm_pipeline.lib.cost.record_cost` (after each agent body completes)
  - `eisenbalm_pipeline.graph.state.DispatchState` (the wrapper signature)
- **Plan 04-07 (14 stub agents)** will import:
  - `eisenbalm_pipeline.graph.state.DispatchState` + the 9 nested TypedDicts (all agents)
  - `eisenbalm_pipeline.lib.sanity_client.write_charity` (Scout — one call per candidate found)
- **Plan 04-08 (graph builder + checkpointer)** will not import from this plan directly — it imports the agents from Plan 07.
- **Plan 04-09 (FastAPI app)** will import:
  - `eisenbalm_pipeline.lib.ids.new_run_id` (single call inside `POST /run/weekly`)
  - `eisenbalm_pipeline.lib.cost.begin_run` + `end_run` (run lifecycle bookends)
  - `eisenbalm_pipeline.lib.convex_client.set_client` (inside FastAPI `lifespan`)
  - `eisenbalm_pipeline.lib.sanity_client.write_issue_draft` (called from the pipeline-end node OR Publisher)
- **Phase 5 (real agents)** swaps stub agent bodies in place — the function signatures + the `@agent_node` wrapper contract owned by Plan 06 stay stable, so no churn here.
- **Phase 6 (Publisher / WeasyPrint)** calls `upload_pdf_to_issue` and `set_charity_first_featured` — both already shipped here.

## Next Phase Readiness

- Wave-1 sibling executors (Plans 03, 04, 05) are landing in parallel; their file scopes do not overlap with this plan's.
- All Wave-2 plans (06, 07) have a stable import surface ready: `graph.state.DispatchState`, `lib.cost.record_cost`, `lib.convex_client.convex_mutation_safe`, `lib.sanity_client.write_charity`.
- All Wave-3 plans (08, 09, 10, 11, 12) have a stable composition surface ready: `lib.ids.new_run_id`, `lib.cost.begin_run/end_run`, `lib.convex_client.set_client`, `lib.sanity_client.write_issue_draft`.

## Self-Check: PASSED

All 9 source files verified present on disk. All 5 task commit hashes verified present in git log:

- `631981b` Task 1 — DispatchState + ids + types + __init__ files
- `c0ae03c` Task 2 — portable_text helper
- `4397637` Task 3 — Convex HTTP client
- `670b77a` Task 4 — Sanity write client
- `8a3f185` Task 5 — CostRecorder

Final overall verification (plan's `<verification>` block):
- `uv run python -c "from eisenbalm_pipeline.graph.state import DispatchState; from eisenbalm_pipeline.lib.portable_text import text_to_portable_text; from eisenbalm_pipeline.lib.convex_client import convex_mutation; from eisenbalm_pipeline.lib.sanity_client import write_issue_draft, write_charity; from eisenbalm_pipeline.lib.cost import begin_run, record_cost, end_run, CostRecorder; from eisenbalm_pipeline.lib.ids import new_run_id; print('all imports OK')"` — PASSED
- `grep -F 'Authorization: Convex '` — PASSED in convex_client.py at two call sites
- `grep -F 'Authorization": f"Bearer '` — PASSED in sanity_client.py at two call sites
- `grep -F 'pipelineMetadata'` + `grep -F '"cost": json.dumps'` — both PASSED in sanity_client.py
- `grep -F '_force_no_winner'` + `grep -F '_force_fail_agent'` — both PASSED in state.py

---
*Phase: 04-pipeline-skeleton*
*Plan: 02*
*Completed: 2026-05-14*
