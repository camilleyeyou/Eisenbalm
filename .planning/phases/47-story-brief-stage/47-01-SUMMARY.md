---
phase: 47-story-brief-stage
plan: 01
subsystem: api
tags: [convex, fastapi, langgraph, contract-first, vitest, typescript, python]

# Dependency graph
requires:
  - phase: 46-signal-editor-candidate-verification
    provides: story_leads + verification_records tables, StoryLead/VerificationRecord TypedDicts, the pitchLog/storyLeads.ts insert idiom this plan mirrors for briefs.ts
  - phase: 41-issue-workspace-frame
    provides: the Workspace frame + stage tabs Stage 1 will mount into (later plans)
provides:
  - "docs/API_CONTRACTS.md §7 Brief TypedDict + brief DispatchState field"
  - "docs/API_CONTRACTS.md §47 — briefs table, story_leads.status, Brief generation mechanism, five FastAPI endpoint shapes (declared, not yet implemented), three guarded pipeline-secret paths"
  - "convex/briefs.ts — insert (upsert-safe)/patch/byRunId, single-row-per-run"
  - "convex/storyLeads.ts::setStatus — Require/Remove-lead mutation"
  - "convex/schema.ts briefs table + story_leads.status additive field, live-synced to dev:modest-magpie-797"
  - "six collectible Wave-0 vitest scaffolds (LeadCard, LeadActions, OrgOptions, NeedsYourDecision, BriefFieldTable, BriefFieldStrengthen) — one per BRF-01..06 requirement"
affects: [47-02-dispatchstate-brief-and-editor-gate1-generation, 47-03-writer-brief-threading, 47-04-leads-and-brief-fastapi-endpoints, 47-05-workspace-subscriptions-lead-card-actions, 47-06-org-options-and-needs-your-decision, 47-07-brief-field-table-and-strengthen, 47-08-story-brief-screen-mount-and-phase-gate, 48-start-from-my-brief]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single-row-per-run, patch-based Convex table (briefs) — distinct from the multi-row story_leads/verification_records append pattern; upsert-safe insert (by_runId lookup -> patch-or-insert) guards against a restarted run re-resolving editor_gate_1"
    - "Deterministic zero-new-node Brief assembly inside editor_gate_1 (documented in §47.3, implemented in 47-02) — no new LLM call, no new graph node"
    - "Wave-0 it.todo scaffolds as sampling points — six new __tests__/*.test.tsx files collect cleanly with zero import errors before their components exist, referencing the never-truncated (CandidateSlate) and resume-bridge (AdjudicationPanel/adjudicateGate1) precedents they must reuse"

key-files:
  created:
    - convex/briefs.ts
    - packages/pipeline/tests/test_brief_convex_guard.py
    - apps/dispatch-control/__tests__/LeadCard.test.tsx
    - apps/dispatch-control/__tests__/LeadActions.test.tsx
    - apps/dispatch-control/__tests__/OrgOptions.test.tsx
    - apps/dispatch-control/__tests__/NeedsYourDecision.test.tsx
    - apps/dispatch-control/__tests__/BriefFieldTable.test.tsx
    - apps/dispatch-control/__tests__/BriefFieldStrengthen.test.tsx
  modified:
    - docs/API_CONTRACTS.md
    - convex/schema.ts
    - convex/storyLeads.ts
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
    - convex/_generated/api.d.ts

key-decisions:
  - "briefs table is runId-scoped, single-row-per-run, patch-based (not append-per-edit like story_leads) — briefs:insert is upsert-safe so a restarted run re-resolving editor_gate_1 patches instead of duplicating"
  - "Brief generation stays a deterministic in-editor_gate_1 assembly (zero new graph node, zero new LLM call) per D-11/§47.3 — the honest tradeoff (writers draft from the AUTO-GENERATED Brief on the first pass; human edits refine later revision passes + seed Phase 48) is stated explicitly in the contract, not hidden"
  - "story_leads gains ONE additive optional status field (active/required/removed); Phase 46's storyLeads:insert args shape is untouched — status is set only via the new setStatus mutation"
  - "Require/Remove-lead and Brief field-strengthen endpoints are declared in §47.5 as FastAPI-routed (mirroring factcheck.py's keep_claim/delete_claim and revision.py's preview/apply) but NOT implemented in this plan — that's 47-04/47-07"

patterns-established:
  - "Pattern: single-row-per-run Convex table with upsert-safe insert + separate single-field patch mutation, for any future 'one editable artifact per run' entity"

requirements-completed: [BRF-01, BRF-02, BRF-03, BRF-04, BRF-05, BRF-06]

# Metrics
duration: 32min
completed: 2026-07-16
---

# Phase 47 Plan 01: Contracts + Convex Store + Wave-0 Tests Summary

**API_CONTRACTS §7/§47 amended with the six-field Brief entity and its Convex/FastAPI contract; the `briefs` Convex table + `story_leads.status`/`setStatus` are live on dev:modest-magpie-797; six collectible Wave-0 vitest scaffolds exist for BRF-01..06.**

## Performance

- **Duration:** 32 min (task commits 02:51:46 → 03:22:48 PDT)
- **Started:** 2026-07-16T09:51:46Z
- **Completed:** 2026-07-16T10:22:48Z
- **Tasks:** 3
- **Files modified:** 12 (2 docs/schema amendments, 4 new Convex/pipeline files, 6 new vitest scaffolds, 1 auto-generated api.d.ts)

## Accomplishments
- Amended `docs/API_CONTRACTS.md` §7 (new `Brief` TypedDict + `brief: Optional[Brief]` DispatchState field) and added a new §47 (six subsections: `briefs` table shape, additive `story_leads.status`, the deterministic Brief-generation mechanism, Convex function signatures, five FastAPI endpoint shapes, guarded-path registrations) — all BEFORE any consuming code, per CLAUDE.md's contract-first hard rule
- Landed the `briefs` Convex table (single-row-per-run, patch-based) + `convex/briefs.ts` (upsert-safe `insert`, `patch`, `byRunId`) + `story_leads.status` additive field + `storyLeads:setStatus` mutation; registered all three new mutation paths in `_PIPELINE_SECRET_GUARDED_PATHS`; live-synced to `dev:modest-magpie-797`; `pnpm check:convex-parity` green (59 called functions, all present, up from 56 at Phase 46)
- Scaffolded six collectible Wave-0 vitest files (`LeadCard`, `LeadActions`, `OrgOptions`, `NeedsYourDecision`, `BriefFieldTable`, `BriefFieldStrengthen`), each with `it.todo` entries spelling out the exact assertions the implementing plans (47-05/47-06/47-07) must make, referencing the never-truncated `CandidateSlate` precedent and the unchanged `adjudicateGate1` resume bridge

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend API_CONTRACTS.md — §7 Brief + new §47** - `562d006` (docs)
2. **Task 2: Convex briefs table + story_leads.status + setStatus + guarded paths + live-sync** - `c16182d` (feat)
3. **Task 3: Wave-0 vitest scaffolds for the six Stage-1 components** - `00489b7` (test)

_No TDD tasks in this plan — all three are `type="auto"` contract/schema/scaffold work._

## Files Created/Modified
- `docs/API_CONTRACTS.md` - §7 gains `Brief` TypedDict + `brief` DispatchState field; new §47 (six subsections) declares the `briefs` table, `story_leads.status`, the Brief-generation mechanism, Convex function signatures, five FastAPI endpoints, and guarded-path registrations
- `convex/schema.ts` - new `briefs` table (`by_runId` index); additive `status` field on `story_leads`
- `convex/briefs.ts` - `insert` (upsert-safe), `patch` (single-field), `byRunId` query
- `convex/storyLeads.ts` - new `setStatus` mutation (Require/Remove-lead, BRF-02)
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` - registered `briefs:insert`, `briefs:patch`, `storyLeads:setStatus` in `_PIPELINE_SECRET_GUARDED_PATHS`
- `packages/pipeline/tests/test_brief_convex_guard.py` - guarded-path membership regression test (2 tests)
- `apps/dispatch-control/__tests__/{LeadCard,LeadActions,OrgOptions,NeedsYourDecision,BriefFieldTable,BriefFieldStrengthen}.test.tsx` - six Wave-0 `it.todo` scaffolds (32 todo cases total)
- `convex/_generated/api.d.ts` - auto-regenerated by `convex dev --once` (new `briefs` module registered)

## Decisions Made
- **briefs table shape (RESEARCH Open Question 2, resolved):** `runId`-scoped, single-row-per-run, upsert-safe insert + separate patch mutation — matches the RESEARCH recommendation exactly.
- **Brief generation mechanism (RESEARCH Open Question 1, resolved as documented):** deterministic assembly inside `editor_gate_1`, zero new graph node/LLM call. The contract states plainly that the writers draft from the auto-generated Brief on the first pass (the graph has no interrupt point between Gate 1 and the writers); human edits refine later revision passes and seed Phase 48. This is the honest tradeoff the plan asked to be stated explicitly, not hidden.
- **Require/Remove-lead endpoint shape:** FastAPI-routed (not a bare Convex mutation), mirroring `factcheck.py::keep_claim`/`delete_claim` — Remove's reason-mandatory + decision-log write requires the pipeline-secret-guarded `_emit_audit` path, matching the RESEARCH recommendation and CONTEXT D-05.
- **Brief field-strengthen has no optimistic-concurrency token** (unlike Sanity passage revision's `ifRevisionID`) — documented in §47.5 as an accepted low-risk simplification (one operator per run), matching `story_leads`/`verification_records`'s own lack of a revision-token concept.

## Deviations from Plan

None in task execution — plan executed exactly as written. Task 1 touched only `docs/API_CONTRACTS.md` (no production code). Task 2's live-sync hit two transient network timeouts (`ETIMEDOUT` against `convex.dev`) before succeeding on the third attempt — not a code issue; confirmed general internet connectivity was fine via `curl` to unrelated hosts, then retried the same `pnpm --filter @eisenbalm/convex dev:once` command, which succeeded.

**Post-execution self-correction (state-update step, not task execution):** this plan's frontmatter lists `requirements: [BRF-01..06]` (all six phase requirements), because it lays the shared foundation every other 47-0x plan builds on. Running the standard `requirements mark-complete` step against that list would have checked off all six BRF boxes in `REQUIREMENTS.md` despite no UI, endpoint, or writer-threading code existing yet (only 47-02 through 47-08 build the actual leads/org-options/decision/brief-table/strengthen functionality). Caught and reverted immediately — all six `BRF-0x` checkboxes in `.planning/REQUIREMENTS.md` were restored to `[ ]`; the traceability table's `Planned` status was untouched (never flipped). No `requirements mark-complete` call is made for this plan; the six boxes will be checked off by whichever later plan(s) actually deliver the visible behavior (BRF-05/06 fields land in 47-04/47-07; the six checkboxes will most naturally flip together when 47-08 mounts the screen, or incrementally as each plan lands — orchestrator/next-plan's call).

## Issues Encountered
- Two transient network timeouts during `convex dev --once` (fetch failed / ETIMEDOUT against Convex's auth endpoint). Resolved by retrying after confirming general connectivity was healthy — no code or configuration change was needed. Third attempt succeeded cleanly (`Added table indexes: [+] briefs.by_runId`, functions ready in 9.08s).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The contract (`docs/API_CONTRACTS.md` §7/§47) and the live Convex store (`briefs` table + `story_leads.status`) are fixed and deployed — Plan 47-02 (DispatchState Brief + editor_gate_1 generation) and Plan 47-04 (leads/brief FastAPI endpoints) can build against them directly with no further schema negotiation.
- All six Wave-0 test scaffolds exist and collect cleanly (0 failures, 32 `it.todo` cases) — Plans 47-05/47-06/47-07 fill these in as they build the corresponding components; no test-infrastructure work remains for those plans.
- `pnpm check:convex-parity` is green (59/59 called functions present on `dev:modest-magpie-797`) and the full regression matrix is clean: pipeline pytest 617 passed / 37 skipped (pre-existing); dispatch-control vitest 884 passed / 34 todo (0 failed) across 103 test files.
- No blockers. The one open design question this plan resolved explicitly (rather than deferring) is BRF-05's "editable Brief... generated after selection" — the contract now states plainly that the Brief is auto-generated and consumed by writers on the first pass, with human edits refining later passes; if the team wants genuine pre-drafting edit time in a future phase, that requires a new `interrupt()` point (not built here, and explicitly out of scope per D-11).

---
*Phase: 47-story-brief-stage*
*Completed: 2026-07-16*

## Self-Check: PASSED

All 13 files verified present (docs/API_CONTRACTS.md, convex/schema.ts, convex/briefs.ts,
convex/storyLeads.ts, convex_client.py, test_brief_convex_guard.py, six vitest scaffolds, this
SUMMARY.md). All 3 task commit hashes (562d006, c16182d, 00489b7) verified present in `git log`.
