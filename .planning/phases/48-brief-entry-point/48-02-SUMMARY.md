---
phase: 48-brief-entry-point
plan: 02
subsystem: testing
tags: [pytest, vitest, tdd-scaffolds, langgraph, fastapi, verify-candidates, dispatch-control]

# Dependency graph
requires:
  - phase: 48-brief-entry-point
    provides: "Plan 48-01's frozen contracts (§48.1-§48.5, entry_mode/source_material DispatchState fields, runs.entryMode Convex field) this plan's scaffolds assert against"
provides:
  - "4 new pipeline test files + 1 extended e2e test locking every Phase 48 pipeline-side behavior (ENT-02/ENT-03/ENT-04) as executable assertions"
  - "1 new + 1 extended dispatch-control test file locking the frontend-side behaviors (ENT-01/ENT-04)"
  - "A GREEN characterization test proving verify_candidates needs zero code change for ENT-04's advisory posture"
  - "Skip-guard idioms (source-scan for pipeline, source-scan for dispatch-control) that 48-03 through 48-06 will each turn from red/skipped to green"
affects: [48-03-pipeline-entry-seam, 48-04-brief-trigger-endpoint, 48-05-create-panel-brief-path, 48-06-stage1-brief-mode-render, 48-07-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Signature-introspection skip-guard (inspect.signature(_start_run)) for a symbol that already exists but whose signature is incomplete — a variant of the source-scan idiom for a live Python callable rather than a text file"
    - "Route-registration skip-guard (scanning a live FastAPI router's .routes for a path) for an endpoint scaffold whose module already exists"
    - "vitest source-scan skip-guard (fs.readFileSync + regex on a component's own source) mirroring the pytest source-scan idiom, with an explicit false-positive note: doc-comments referencing the target UI copy must be excluded via a code-only marker symbol, not the UI copy string itself"
    - "Patch-where-used discipline for `from X import Y` direct bindings (api/control.py's own `_start_run` name, not api/runs.py's) versus `import X as _cc` module-qualified references (patchable via the shared module object from any importer)"

key-files:
  created:
    - packages/pipeline/tests/test_builder_entry_mode_wiring.py
    - packages/pipeline/tests/test_start_run_brief_seed.py
    - packages/pipeline/tests/test_brief_run_endpoint.py
    - packages/pipeline/tests/test_verify_candidates_brief_mode.py
    - apps/dispatch-control/__tests__/CreatePanel.test.tsx
  modified:
    - packages/pipeline/tests/test_pipeline_e2e.py
    - apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx

key-decisions:
  - "test_verify_candidates_brief_mode.py is a NEW top-level file (not an extension of tests/agents/test_verify_candidates.py) — mirrors the plan's frontmatter file list; the existing Phase 46 file stays scoped to generic verify_candidates behavior, this one is scoped to the brief-mode/ENT-04 characterization story specifically"
  - "CreatePanel.test.tsx's skip-guard marker is the code-only symbol `triggerBriefRun`, not the UI copy string 'Start from my brief' — CreatePanel.tsx's own doc-comment already contains that exact phrase (describing the reserved-but-absent second cell, Phase 40 D-28), so a copy-string marker would false-positive on the comment and never actually skip"
  - "test_start_run_brief_seed.py stubs `_cc.convex_mutation` / `load_run_config` / `snapshot_config` / `_execute_run` directly rather than using the conftest.py `convex_runs_store`/`convex_config_store` fixtures — those fixtures route by path PREFIX (runs:/agentRuns:/pipelineRuns:/issues: and pipelineConfig:/auditLog:) and do NOT claim `briefs:`, so a `briefs:insert` assertion would silently fall through to the real (unmocked) convex_mutation; a direct capture-everything stub avoids that gap"
  - "test_brief_run_endpoint.py stubs `_start_run` itself (patched on api.control's own name binding, per patch-where-used) rather than exercising the real launcher — this file asserts the ENDPOINT's own contract (422/409/200 + what it hands to _start_run + the audit row); _start_run's own seeding is test_start_run_brief_seed.py's separate concern"

patterns-established:
  - "Wave 0 test-scaffold-first discipline (Phases 46/47 precedent) applied to a cross-boundary phase: every ENT-01..04 requirement gets an executable assertion — either GREEN now (ENT-04's verify_candidates half, a true characterization test of already-correct behavior) or skip-guarded red (everything requiring new production code) — before any Wave 2+ implementation code is written"

requirements-completed: [ENT-01, ENT-02, ENT-03, ENT-04]

# Metrics
duration: 25min
completed: 2026-07-16
---

# Phase 48 Plan 02: Wave 0 Test Scaffolds Summary

**Authored 4 new pipeline test files + 1 extended e2e test + 1 new + 1 extended dispatch-control test file locking every Phase 48 requirement (ENT-01..04) as an executable assertion before any implementation code — one file (verify_candidates advisory characterization) runs GREEN today with zero code change; the rest are skip-guarded red, ready for Plans 48-03 through 48-06 to turn green one at a time.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-16T14:26:00Z (approx.)
- **Completed:** 2026-07-16T14:50:43Z
- **Tasks:** 3 completed
- **Files modified:** 7

## Accomplishments
- `test_builder_entry_mode_wiring.py` — pure source-scan (no import) asserting the calibrator/verify_candidates conditional-edge fork (§48.1: `route_by_entry_mode`, the two `add_conditional_edges` calls and their path_maps, the two removed static edges, `START -> calibrator` staying unconditional), skip-guarded on a `_fork_wired()` predicate until Plan 48-03
- `test_start_run_brief_seed.py` — unit tests for `_start_run`'s four new optional params (§48.3): existing-caller byte-equivalence (no `entryMode` key, full 20-key agent list, no `briefs:insert`), brief-mode seeding of `initial_state`/`runs:create`/`agentRuns:queueForRun`/`briefs:insert`, and the `briefs:insert`-only-when-`brief`-is-not-None gate — skip-guarded via `inspect.signature(_start_run)` until Plan 48-03
- `test_brief_run_endpoint.py` — FastAPI `TestClient` tests for `POST /pipeline/run/brief` (§48.2): 422 on empty org name, 409 reusing the one-at-a-time gate, a 409-budget-gate implication check, and the 200 happy path asserting `_start_run` receives `entry_mode="brief"` + a reduced `agent_keys_override` + a `run.triggered` audit row carrying `entryMode="brief"` — skip-guarded on live route registration until Plan 48-04
- `test_verify_candidates_brief_mode.py` — 3-test characterization suite proving ENT-04's advisory posture (record persisted even when killed; the return dict never contains `winning_charity`; a passing org also gets exactly one record) is **already the node's natural behavior** — runs GREEN now, confirmed by direct pytest execution, zero code change required
- Extended `test_pipeline_e2e.py` with `test_pipeline_e2e_brief_mode`, cloning the existing runId-threaded precedent: posts to `/pipeline/run/brief`, polls to `awaiting-review`, asserts the Sanity draft + `qaCorrections`/`verificationRecords` rows exist, and asserts the D-12 "no deliberation events" divergence — inherits the module's `SUPABASE_POSTGRES_URL` skip plus a local route-registration skip-guard
- New `CreatePanel.test.tsx`: the existing "Find a story with agents" path is regression-covered unconditionally (calls `ensureByNumber` → `triggerRun` → `router.push`, never `triggerBriefRun`); a new "Start from my brief" peer-card block (two cards, intake form reveal, submit-chain ordering + payload shape) is source-scan skip-guarded on the `triggerBriefRun` symbol until Plan 48-05
- Extended `StoryBriefScreen.test.tsx` with an `entryMode === 'brief'` describe block asserting the discovery-mode "No leads yet." / OrgOptionSlate's "No organization options yet" empty states do NOT render, and the human org's name + verification-with-dates line DOES render — skip-guarded on an `ENTRY_MODE_WIRED` source-scan of `StoryBriefScreen.tsx` until Plan 48-06

## Task Commits

Each task was committed atomically:

1. **Task 1: Pipeline graph-fork + _start_run seeding scaffolds** - `2e80bf1` (test)
2. **Task 2: Endpoint, verify_candidates advisory, and e2e brief-mode scaffolds** - `09710ca` (test)
3. **Task 3: Dispatch-control CreatePanel + StoryBriefScreen brief-mode scaffolds** - `06a4d4b` (test)

## Files Created/Modified
- `packages/pipeline/tests/test_builder_entry_mode_wiring.py` - source-scan test for the entry-mode conditional-edge fork (§48.1)
- `packages/pipeline/tests/test_start_run_brief_seed.py` - unit tests for `_start_run`'s brief-mode seed params (§48.3)
- `packages/pipeline/tests/test_brief_run_endpoint.py` - FastAPI TestClient tests for `POST /pipeline/run/brief` (§48.2)
- `packages/pipeline/tests/test_verify_candidates_brief_mode.py` - GREEN characterization test for ENT-04's advisory posture
- `packages/pipeline/tests/test_pipeline_e2e.py` - extended with `test_pipeline_e2e_brief_mode`
- `apps/dispatch-control/__tests__/CreatePanel.test.tsx` - new file: existing-path regression + skip-guarded second-card scaffold
- `apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx` - extended with an `entryMode==='brief'` Stage-1 render block

## Decisions Made
- `test_verify_candidates_brief_mode.py` is a new top-level file (matches the plan's `files_modified` list) rather than extending `tests/agents/test_verify_candidates.py` — keeps the Phase 46 generic-behavior file and the Phase 48 brief-mode/ENT-04 characterization story separate.
- `CreatePanel.test.tsx`'s skip-guard uses the code-only marker `triggerBriefRun` rather than the UI copy string "Start from my brief" — discovered via a real test failure that CreatePanel.tsx's own doc-comment already contains that exact phrase (describing the Phase 40 D-28 reserved-but-absent cell), which made a copy-string marker match immediately and never skip. Fixed before committing.
- `test_start_run_brief_seed.py` stubs the Convex/config surface directly (`_cc.convex_mutation`, `load_run_config`, `snapshot_config`, `_execute_run`) instead of the `convex_runs_store`/`convex_config_store` conftest fixtures, because those fixtures route by path prefix and do not claim `briefs:*` — a direct capture-everything stub avoids a silent fall-through to the real (unmocked) `convex_mutation` for the `briefs:insert` assertion.
- `test_brief_run_endpoint.py` stubs `_start_run` itself (patched on `api.control`'s own name binding — it did `from ... import _start_run`, a direct binding independent of `api.runs`'s namespace) so this file asserts only the endpoint's own contract; `_start_run`'s internal seeding is `test_start_run_brief_seed.py`'s separate, already-covered concern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] CreatePanel.test.tsx's skip-guard regex false-positived on the component's own doc-comment**
- **Found during:** Task 3 (running `pnpm --filter dispatch-control test:unit -- CreatePanel StoryBriefScreen` to verify the scaffold behaves as designed)
- **Issue:** The skip-guard predicate `SECOND_CARD_SHIPPED` matched `/start from my brief/i` against `CreatePanel.tsx`'s source text. `CreatePanel.tsx`'s existing doc-comment (Phase 40 Plan 40-05) already contains the literal phrase "Start from my brief" describing the reserved-but-absent second grid cell — so the regex matched immediately, the `describe.skipIf` block never skipped, and 3 assertions failed against the (correctly) unimplemented component.
- **Fix:** Changed the marker to `/triggerBriefRun/` — a code-only symbol Plan 48-05 will import from `@/lib/pipelineControlClient` (D-14), with zero occurrences in `CreatePanel.tsx` today, confirmed via `grep`. Re-ran the suite: the block now skips as intended (4 tests, 3 skipped) and the existing-path test passes.
- **Files modified:** `apps/dispatch-control/__tests__/CreatePanel.test.tsx`
- **Verification:** `pnpm --filter dispatch-control test:unit -- CreatePanel StoryBriefScreen` exits 0 (111 test files passed, 1 pre-existing unrelated skip; `CreatePanel.test.tsx` shows 4 tests | 3 skipped)
- **Committed in:** `06a4d4b` (part of Task 3 commit — caught and fixed before commit, not a separate follow-up)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** The fix was necessary for the scaffold to actually behave as the plan specifies (skip-guarded, not falsely failing). No scope creep — same file, same task, caught during the task's own verification step before committing.

## Issues Encountered
None beyond the deviation above.

## User Setup Required

None - no external service configuration required. All scaffolds are self-contained unit/characterization tests with no live Convex/Sanity/Supabase dependency (the one true e2e addition inherits the existing `SUPABASE_POSTGRES_URL` module skip-guard).

## Next Phase Readiness

- 48-03 (pipeline entry seam) has two red scaffolds to turn green: `test_builder_entry_mode_wiring.py` (the graph fork) and `test_start_run_brief_seed.py` (the launcher extension) — both skip-guarded to flip automatically the moment the corresponding code lands, no scaffold edits needed.
- 48-04 (brief-trigger endpoint) has `test_brief_run_endpoint.py` ready to flip green the moment `POST /pipeline/run/brief` is registered on `api/control.py`'s router.
- 48-05 (Create-panel brief path) has `CreatePanel.test.tsx`'s skip-guarded block ready to flip green once `triggerBriefRun` is wired in; the assertions on submit-chain ordering and payload shape (premise/peg/organization.name) are pre-written but the exact submit-button copy is a best guess (`/submit|start this run|create issue/i`) since D-13's exact intake-form layout is Claude's discretion at implementation time — 48-05 may need to adjust that one selector.
- 48-06 (Stage 1 brief-mode render) has `StoryBriefScreen.test.tsx`'s skip-guarded block ready to flip green once the `entryMode`-aware branch (and, per RESEARCH Pattern 4, a `BriefOrgCard` component) lands.
- ENT-04's verify_candidates half is fully proven today — no further pipeline-side work is needed for that half of the requirement; 48-03's job is only to place `verify_candidates` on the brief path via the graph fork.
- No blockers.

---
*Phase: 48-brief-entry-point*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: packages/pipeline/tests/test_builder_entry_mode_wiring.py
- FOUND: packages/pipeline/tests/test_start_run_brief_seed.py
- FOUND: packages/pipeline/tests/test_brief_run_endpoint.py
- FOUND: packages/pipeline/tests/test_verify_candidates_brief_mode.py
- FOUND: apps/dispatch-control/__tests__/CreatePanel.test.tsx
- FOUND: packages/pipeline/tests/test_pipeline_e2e.py (modified, test_pipeline_e2e_brief_mode present)
- FOUND: apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx (modified, entryMode block present)
- FOUND: 2e80bf1 (Task 1 commit)
- FOUND: 09710ca (Task 2 commit)
- FOUND: 06a4d4b (Task 3 commit)
