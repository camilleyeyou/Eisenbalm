---
phase: 46-signal-editor-candidate-verification
plan: 01
subsystem: pipeline-contracts
tags: [convex, langgraph, contract-first, signal-editor, verify-candidates, testing]

# Dependency graph
requires:
  - phase: 39-registry-coverage-memory-strip
    provides: "charities:listRecentFeatured + repetition_note() algorithm the Signal Editor's Editorial Memory read will reuse in 46-04"
  - phase: 29-money-notifications
    provides: "_PIPELINE_SECRET_GUARDED_PATHS central-injection pattern (convex_client.py) this plan extends"
provides:
  - "API_CONTRACTS.md §46 — StoryLead, VerificationRecord, story_leads/verification_records DispatchState fields (contract-first, binding for 46-02..46-07)"
  - "story_leads + verification_records Convex tables, live on dev:modest-magpie-797, with insert/byRunId functions"
  - "storyLeads:insert + verificationRecords:insert registered in the pipeline-secret guard"
  - "3 Wave-0 pytest scaffolds (test_signal_editor.py, test_verify_candidates.py, test_checkpoint_resume_phase46.py) as sampling points for 46-04/46-05/46-07"
affects: [46-02, 46-03, 46-04, 46-05, 46-06, 46-07, 47-story-brief-stage]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dedicated Convex table (not deliberationEvents literal) for patchable per-run structured artifacts — mirrors pitchLog/qaCorrections/charity_corrections"
    - "pytest.importorskip module-level guard for Wave-0 agent test scaffolds (whole-module SKIP, not collection ERROR)"

key-files:
  created:
    - convex/storyLeads.ts
    - convex/verificationRecords.ts
    - packages/pipeline/tests/agents/test_signal_editor.py
    - packages/pipeline/tests/agents/test_verify_candidates.py
    - packages/pipeline/tests/test_checkpoint_resume_phase46.py
  modified:
    - docs/API_CONTRACTS.md
    - convex/schema.ts
    - convex/_generated/api.d.ts
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py

key-decisions:
  - "Two dedicated Convex tables (story_leads, verification_records) instead of a new deliberationEvents.eventType literal — §37.3 declares that union FROZEN, and Phase 47 (BRF-02) needs a patchable per-lead row an append-only stream can't support"
  - "obscurity: {pressHits, verdict} is flattened into pressHits + obscurityVerdict columns on the Convex verification_records table; the pipeline VerificationRecord dict re-nests it — Convex has no need for a nested-object column here"
  - "§46 appended as a new self-contained section (mirroring §39/§42) rather than rewriting the already-stale §7 DispatchState code block — matches the established precedent for post-Phase-26 additions"

requirements-completed: [SGE-01, SGE-03, SGE-04]

# Metrics
duration: ~25min
completed: 2026-07-16
---

# Phase 46 Plan 01: Contract, Convex Store & Wave-0 Tests Summary

**Landed the API_CONTRACTS §46 contract (StoryLead + VerificationRecord shapes) before any code, deployed the two dedicated Convex tables it describes to dev:modest-magpie-797, and scaffolded three skip-guarded Wave-0 pytest files as sampling points for the agent plans that follow.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-16
- **Tasks:** 3
- **Files modified:** 9 (4 created, 5 modified — including the regenerated `convex/_generated/api.d.ts`)

## Accomplishments
- `docs/API_CONTRACTS.md` §46 documents `StoryLead` (11 fields, `recommended` never `true` when `brandRiskFlag` is `true`), `VerificationRecord`, the two new `DispatchState` fields, both Convex tables, and corrects the stale "no Signal Editor exists until Phase 46" `signal` inspector-artifact row — all BEFORE any `state.py`/agent/Convex code exists, per the CLAUDE.md contract-first hard rule.
- `story_leads` + `verification_records` Convex tables (with `insert`/`byRunId` functions, mirroring `pitchLog.ts` exactly) are live on `dev:modest-magpie-797` — confirmed via `pnpm --filter @eisenbalm/convex dev:once` (table indexes created) and `pnpm check:convex-parity` (56/56 called functions present, 131 deployed).
- Both `insert` mutations are registered in `convex_client.py`'s `_PIPELINE_SECRET_GUARDED_PATHS`, avoiding the documented 42-03 "unregistered guarded path = every real call 500s" failure mode.
- Three Wave-0 test files (`test_signal_editor.py`, `test_verify_candidates.py`, `test_checkpoint_resume_phase46.py`) collect and skip cleanly — 592 passed / 39 skipped / 0 failed across the full pipeline suite, confirming zero regressions.

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend API_CONTRACTS.md with §46 (contract-first)** - `0aeea43` (docs)
2. **Task 2: Add story_leads + verification_records Convex tables, functions, and guard registration** - `97f8695` (feat)
3. **Task 3: Scaffold the three Wave-0 pytest files (skip-guarded)** - `0a01dd7` (test)

**Plan metadata:** committed alongside this SUMMARY (see final commit below).

## Files Created/Modified
- `docs/API_CONTRACTS.md` - New §46 section (StoryLead, story_leads, VerificationRecord, verification_records, both Convex tables, corrected `signal` row)
- `convex/schema.ts` - Two new tables: `story_leads` (by_runId index), `verification_records` (by_runId + by_runId_and_candidate indexes)
- `convex/storyLeads.ts` - `insert` (requirePipelineSecret-guarded) + `byRunId` query
- `convex/verificationRecords.ts` - `insert` (requirePipelineSecret-guarded) + `byRunId` query
- `convex/_generated/api.d.ts` - Regenerated by `dev:once` codegen (adds storyLeads/verificationRecords module imports)
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` - `"storyLeads:insert"` + `"verificationRecords:insert"` added to `_PIPELINE_SECRET_GUARDED_PATHS`
- `packages/pipeline/tests/agents/test_signal_editor.py` - 5 skip-guarded stub tests (SGE-01/02/05), `pytest.importorskip("eisenbalm_pipeline.agents.signal_editor")`
- `packages/pipeline/tests/agents/test_verify_candidates.py` - 3 skip-guarded stub tests (SGE-03), `pytest.importorskip("eisenbalm_pipeline.agents.verify_candidates")`
- `packages/pipeline/tests/test_checkpoint_resume_phase46.py` - 1 skip-guarded stub test (SGE-04), `SUPABASE_POSTGRES_URL`-gated module skip mirroring `test_editor_gate_1_resume.py`

## Decisions Made
- **Dedicated tables over a new `deliberationEvents` literal** — §37.3's FROZEN union plus Phase 47's need to PATCH lead state (Require/Remove) made the dedicated-table pattern (mirroring `pitchLog`/`qaCorrections`/`charity_corrections`) the only viable option. Documented in §46.5 with an explicit rationale so no future plan re-litigates it.
- **Flattened `obscurity` on the Convex side** (`pressHits: v.number()`, `obscurityVerdict: v.string()`) rather than a nested `v.object(...)` column — the pipeline's `VerificationRecord.obscurity: dict` re-nests these two fields at write/read time; Convex gains nothing from a nested column here and flat fields are simpler to index/query if ever needed.
- **§46 as a new self-contained section**, not a rewrite of the already-stale §7 `DispatchState` code block (confirmed stale per 46-RESEARCH Pitfall 6 — `featured_charity_keys`/`claims`/`narrator_slug` are already missing from that block, predating this phase). Followed the exact §39/§42 structural precedent.

## Deviations from Plan

None — plan executed exactly as written. All three tasks' acceptance criteria passed on the first attempt; no auto-fixes, no blocking issues, no architectural questions.

## Issues Encountered

None. `pnpm --filter @eisenbalm/convex typecheck` passed cleanly before `dev:once`; the live sync completed in ~10s with the three expected new indexes reported (`story_leads.by_runId`, `verification_records.by_runId`, `verification_records.by_runId_and_candidate`); `check:convex-parity` confirmed zero drift.

## Next Phase Readiness

- Plan 46-02 (DispatchState contract + repetition helper) can now add `story_leads`/`verification_records` fields to the real `state.py` `DispatchState` TypedDict — the §46 contract this plan lands is the binding shape.
- Plans 46-04 (signal_editor agent) and 46-05 (verify_candidates agent) have their Convex write targets (`storyLeads:insert`, `verificationRecords:insert`) live and guarded, plus their Wave-0 test scaffolds waiting to be filled in.
- Plan 46-07 (checkpoint resume + integration gate) has its skip-guarded pause/resume scaffold in place, gated on `SUPABASE_POSTGRES_URL` exactly like the existing Gate-1 resume test.

## Self-Check

- [x] `docs/API_CONTRACTS.md` contains `## §46` — confirmed (`grep -c` = 8 matches total incl. cross-references; primary heading present)
- [x] `convex/storyLeads.ts` exists, exports `insert` + `byRunId`
- [x] `convex/verificationRecords.ts` exists, exports `insert` + `byRunId`
- [x] `packages/pipeline/tests/agents/test_signal_editor.py` exists, collects/skips cleanly
- [x] `packages/pipeline/tests/agents/test_verify_candidates.py` exists, collects/skips cleanly
- [x] `packages/pipeline/tests/test_checkpoint_resume_phase46.py` exists, collects/skips cleanly
- [x] Commits `0aeea43`, `97f8695`, `0a01dd7` all present in `git log`

## Self-Check: PASSED

All 6 created/modified files confirmed present on disk; all 3 task commits (`0aeea43`, `97f8695`, `0a01dd7`) confirmed in `git log`.

---
*Phase: 46-signal-editor-candidate-verification*
*Plan: 01-contract-convex-store-and-wave0-tests*
*Completed: 2026-07-16*
