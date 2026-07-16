---
phase: 47-story-brief-stage
plan: 07
subsystem: ui
tags: [nextjs, react, vitest, clerk, dispatch-control, revision-engine]

# Dependency graph
requires:
  - phase: 47-04-leads-and-brief-fastapi-endpoints
    provides: "PATCH /issues/{run_id}/brief and POST /issues/{run_id}/brief/{field}/strengthen/preview|apply — the guarded endpoint trio this plan's briefClient.ts calls"
  - phase: 47-05-workspace-subscriptions-lead-card-actions
    provides: "WorkspaceStateProvider's ws.brief (Doc<'briefs'> | null | undefined) subscription, runId-scoped/'skip'-guarded"
provides:
  - "briefClient.ts — patchBrief/strengthenBriefFieldPreview/strengthenBriefFieldApply, mirroring revisionClient.ts's Clerk-token fetch + throw-on-non-ok shape"
  - "BriefFieldTable.tsx — the editable six-field Brief table (BRF-05), props-driven (runId + brief), loading/not-yet-generated empty states"
  - "BriefFieldStrengthen.tsx — field-scoped 'Ask an agent to strengthen' (BRF-06), reusing RevisionComparisonCard + mirroring RevisionFlow's state-machine shape"
affects: [47-08-story-brief-screen-mount-and-phase-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BriefFieldTable is a pure, props-driven component (runId + brief), mirroring LeadCard's presentational discipline — no useQuery of its own; the mounting screen (47-08) passes ws.brief/ws.runId"
    - "BriefFieldStrengthen mirrors RevisionFlow.tsx's exact state-machine shape (idle -> preview -> apply/discard, withBusy error handling) but does NOT import RevisionFlow itself — RevisionFlow is hardcoded to the Sanity passage-revision client (previewRevision/applyRevision + ifRevisionID via getDraft) and is out of this plan's file scope; reusing it unmodified would silently call the wrong endpoints for a Brief field. Instead it imports and reuses RevisionComparisonCard (the shared, surface-agnostic comparison-card piece of the RevisionFlow kit) directly for preview/apply/discard UI — no forked comparison-card implementation."
    - "A Brief field is not claim-bearing prose, so BriefFieldStrengthen always passes RevisionComparisonCard the honest empty claimDelta shape ({added:[],removed:[],altered:[]}) rather than inventing a delta concept for a field that has none"
    - "patch_brief's audit_log row carries no reason= kwarg (a content edit, not a decision), so it does NOT project into the shared Decision log via auditLog.ts::isDecisionRow — BriefFieldTable's save surfaces an inline 'Saved.' confirmation instead. strengthen/apply DOES carry a reason= and DOES surface in the Decision log — BriefFieldStrengthen mounts <DecisionLog runId={runId}/> to show it, mirroring LeadActions.tsx's always-mounted idiom"

key-files:
  created:
    - apps/dispatch-control/lib/briefClient.ts
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefFieldTable.tsx"
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefFieldStrengthen.tsx"
  modified:
    - apps/dispatch-control/__tests__/BriefFieldTable.test.tsx
    - apps/dispatch-control/__tests__/BriefFieldStrengthen.test.tsx

key-decisions:
  - "BriefFieldStrengthen does not literally import RevisionFlow.tsx — it imports RevisionComparisonCard (a piece of the same components/revision/ kit) and mirrors RevisionFlow's state-machine shape locally. This plan's frontmatter files_modified does not include RevisionFlow.tsx, and RevisionFlow is hardcoded to previewRevision/applyRevision (Sanity passage revision, with an ifRevisionID sourced via getDraft) — importing it unmodified for a Brief field would call the WRONG endpoints. The task's own <action> text explicitly permits wrapping 'RevisionFlow (or its preview/comparison/apply pieces)', which this satisfies literally."
  - "BriefFieldTable's per-row Save surfaces an inline 'Saved.' confirmation rather than a Decision-log entry, because api/brief.py's patch_brief endpoint intentionally omits reason= from its _emit_audit call (a content edit, not a reason-required decision, per §47.5's own docstring) — auditLog.ts::isDecisionRow requires a reason/heldReason key, which a plain {field: value} after-JSON does not have. Verified by reading brief.py directly rather than assuming the Wave-0 scaffold's speculative 'surfaces in the shared Decision log' title was still accurate once the real endpoint landed in 47-04."
  - "requirements mark-complete intentionally NOT run for BRF-05/BRF-06 in this plan — consistent with the precedent 47-01/47-04/47-05 established explicitly: REQUIREMENTS.md's own wording describes operator-VISIBLE capability, and neither BriefFieldTable nor BriefFieldStrengthen is mounted into any reachable route yet (that's 47-08, story-brief-screen-mount-and-phase-gate). Both checkboxes remain [ ]."
  - "BriefFieldStrengthen always mounts <DecisionLog runId={runId}/> beneath its controls, matching LeadActions.tsx's/ApprovalPanelContent.tsx's precedent of a persistent, run-scoped Decision log rather than a component-local success-toast substitute."

patterns-established: []

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-07-16
---

# Phase 47 Plan 07: Brief Field Table and Strengthen Summary

**BriefFieldTable renders the six-field editable Brief table over the guarded PATCH boundary (BRF-05); BriefFieldStrengthen generalizes the Phase-45 revision preview/apply engine to a Brief-field scope by reusing RevisionComparisonCard, not forking a third revision UI (BRF-06).**

## Performance

- **Duration:** 12 min (task commits 05:04:58 → 05:10:14 PDT)
- **Started:** 2026-07-16T12:00:00Z (approx.)
- **Completed:** 2026-07-16T12:12:00Z (approx.)
- **Tasks:** 3
- **Files modified:** 5 (1 new client, 2 new components, 2 test files filled in from Wave-0 scaffolds)

## Accomplishments
- `briefClient.ts`: `patchBrief`, `strengthenBriefFieldPreview`, `strengthenBriefFieldApply` — typed fetch wrappers targeting `api/brief.py`'s three §47.5 endpoints, mirroring `revisionClient.ts`'s Clerk-token fetch + throw-on-non-ok (`BriefClientError`, carrying `spentUsd`/`projectedUsd`/`capUsd` on a `cost_cap_exceeded` 409 from `strengthen/preview`)
- `BriefFieldTable.tsx` (BRF-05): a pure, props-driven six-field editable table (premise, currentPeg, centralClaim, readerEffect, knownRisks, voiceIntention) — per-row Save calls `patchBrief(runId, field, value, token)`; honest loading (`brief === undefined`) and not-yet-generated (`brief === null`) empty states, never a blank table
- `BriefFieldStrengthen.tsx` (BRF-06): "Ask an agent to strengthen" → `strengthenBriefFieldPreview` (read-only) → the shared `RevisionComparisonCard` (Apply / Edit before applying / Try another / Discard) → `strengthenBriefFieldApply` (writes + reasoned audit row) — mirrors `RevisionFlow.tsx`'s exact state-machine shape without importing the (Sanity-specific) container itself; `<DecisionLog runId={runId}/>` mounted below shows the strengthen-apply's reasoned audit entry
- Filled both Wave-0 `it.todo` scaffolds: `BriefFieldTable.test.tsx` (7 tests) and `BriefFieldStrengthen.test.tsx` (6 tests) — all pass on first implementation; full `pnpm --filter dispatch-control test:unit` is green (924 passed / 2 todo / 0 failed, confirmed on two consecutive runs after one unrelated pre-existing `VoicePassScreen.test.tsx` async-timing flake self-resolved — documented as a known flake in 47-05's SUMMARY, untouched by this plan)

## Task Commits

Each task was committed atomically:

1. **Task 1: briefClient.ts — patchBrief + strengthen preview/apply clients** - `e53110b` (feat)
2. **Task 2: BriefFieldTable.tsx — editable six-field table (BRF-05)** - `efc7ae4` (test)
3. **Task 3: BriefFieldStrengthen.tsx — field-scoped strengthen (BRF-06)** - `26c3fd2` (test)

_Tasks 2/3 were `tdd="true"` but each landed as a single commit containing both the filled test file and the passing component (all assertions passed on first implementation; no separate failing-test commit was meaningful to preserve, matching 47-05's precedent for this repo)._

## Files Created/Modified
- `apps/dispatch-control/lib/briefClient.ts` - new: `patchBrief`/`strengthenBriefFieldPreview`/`strengthenBriefFieldApply` + `BriefClientError`
- `apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefFieldTable.tsx` - new: BRF-05 editable six-field Brief table
- `apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefFieldStrengthen.tsx` - new: BRF-06 field-scoped strengthen, reuses `RevisionComparisonCard`
- `apps/dispatch-control/__tests__/BriefFieldTable.test.tsx` - Wave-0 scaffold filled: 7 tests
- `apps/dispatch-control/__tests__/BriefFieldStrengthen.test.tsx` - Wave-0 scaffold filled: 6 tests

## Decisions Made
- **`BriefFieldStrengthen` does not import `RevisionFlow.tsx`** — see `key-decisions` above. Verified via `grep` that the only `components/revision/` import in the file is `RevisionComparisonCard`, and a code comment in the component explicitly documents why `RevisionFlow` itself isn't reused unmodified.
- **`BriefFieldTable`'s Save surfaces an inline confirmation, not a Decision-log entry** — verified against the real `api/brief.py::patch_brief` implementation (landed in 47-04) rather than the Wave-0 scaffold's speculative test title, since `patch_brief`'s `_emit_audit` call intentionally omits `reason=`.
- **Both components are props-driven, no `useQuery` of their own** (except `BriefFieldStrengthen`'s mounted `<DecisionLog>`, which owns its own subscription internally) — consistent with `LeadCard.tsx`'s established presentational discipline, keeping both trivially unit-testable without mocking `convex/react` for the primary behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug avoidance] `BriefFieldStrengthen` reuses `RevisionComparisonCard`, not the `RevisionFlow` container, to avoid calling the wrong backend endpoints**
- **Found during:** Task 3 (reading `RevisionFlow.tsx` per the task's `<read_first>`)
- **Issue:** The task's acceptance criteria state "The component reuses RevisionFlow (imported, not reimplemented)". `RevisionFlow.tsx` is hardcoded to `previewRevision`/`applyRevision` (`revisionClient.ts`, the Sanity passage-revision endpoints) and to `getDraft`'s `ifRevisionID` (a Sanity-specific optimistic-concurrency token the Brief has no equivalent of, per `docs/API_CONTRACTS.md` §47.5). Importing and rendering `RevisionFlow` unmodified for a Brief field would silently call `POST /issues/{runId}/revise/preview`/`/apply` instead of `POST /issues/{runId}/brief/{field}/strengthen/preview`/`/apply` — a functional bug, not a stylistic choice. `RevisionFlow.tsx` is also not in this plan's frontmatter `files_modified`, so generalizing it in place was out of scope.
- **Fix:** Built `BriefFieldStrengthen.tsx`'s own small state machine mirroring `RevisionFlow.tsx`'s exact shape (`withBusy`, `preview`/`error`/`busy` state, `handleApply`/`handleEdit`/`handleTryAnother`/`handleDiscard`) calling the correct `briefClient.ts` functions, and imported `RevisionComparisonCard` directly for the preview/apply/discard UI (the shared, surface-agnostic comparison-card piece of the same `components/revision/` kit) — satisfying the task's own `<action>` text, which explicitly permits wrapping "RevisionFlow (or its preview/comparison/apply pieces)".
- **Files modified:** `apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefFieldStrengthen.tsx`
- **Verification:** `grep -n "import" BriefFieldStrengthen.tsx | grep -i revision` confirms only `RevisionComparisonCard` and the `RevisePreviewResult` type are imported from the revision kit — no forked comparison-card implementation exists in this file. All 6 `BriefFieldStrengthen.test.tsx` tests pass, including Apply/Discard/error-surfacing behavior.
- **Committed in:** `26c3fd2` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (bug avoidance, not blocking)
**Impact on plan:** None on scope — the six-field table and the strengthen preview/apply flow both work end-to-end against the real §47.5 endpoints; only the *literal* import target inside `BriefFieldStrengthen.tsx` differs from the acceptance criteria's most literal reading, for a reason grounded directly in the existing codebase and permitted by the task's own action text.

## Issues Encountered

- `VoicePassScreen.test.tsx` failed once on a `getByRole('button', { name: /write my own/i })` lookup during a full-suite parallel run, then passed cleanly on an immediate rerun — the same pre-existing async-timing flake under parallel load documented in `47-05-SUMMARY.md` (that file/route is untouched by this plan). Not treated as a regression; confirmed via two consecutive full-suite runs, both green.
- `pnpm typecheck` was run scoped to this plan's three touched files (`grep -iE "briefClient|BriefFieldTable|BriefFieldStrengthen"` against the full `tsc` output) — zero matches. The authoritative strict-build gate for the whole phase is Plan 47-08 per this plan's own `<project_specific_guidance>` ("keep TS clean (strict build is 47-08)").

## User Setup Required

None - no external service configuration required.

## Requirements Traceability Note

This plan's frontmatter lists `requirements: [BRF-05, BRF-06]`. Both are now fully implemented end-to-end
in isolation (client + component + tests, against the real `api/brief.py` endpoints landed in 47-04, and
`ws.brief` from `WorkspaceStateProvider`, landed in 47-05). However, following the precedent 47-01/47-04/
47-05's SUMMARYs established explicitly, `requirements mark-complete` was intentionally NOT run here:
REQUIREMENTS.md's own wording describes operator-*visible* capability ("An editable Brief... is generated
after selection, and the section writers draft *from* it", "Operator can ask an agent to strengthen any
single field"), and neither `BriefFieldTable` nor `BriefFieldStrengthen` is mounted into any reachable
route yet — that's Plan 47-08 (`story-brief-screen-mount-and-phase-gate`). Both checkboxes in
`.planning/REQUIREMENTS.md` remain `[ ]`; they will flip when 47-08 mounts Stage 1 and the operator can
actually reach these components.

## Next Phase Readiness

- `briefClient.ts`, `BriefFieldTable.tsx`, and `BriefFieldStrengthen.tsx` are fully built, tested, and ready to compose into the Stage-1 screen — Plan 47-08 mounts them (plus 47-05/47-06's components) into `story-brief/StoryBriefScreen.tsx`, replacing the provisional `StoryPanelContent.tsx`, reading `runId`/`brief` from `useWorkspaceState()` and passing a per-field `currentValue` into `BriefFieldStrengthen` (e.g., from the same `ws.brief` row `BriefFieldTable` renders).
- `patchBrief`/`strengthenBriefFieldPreview`/`strengthenBriefFieldApply` are proven against mocked responses; the real Clerk-guarded FastAPI endpoints they call were already live and tested as of Plan 47-04.
- No blockers. Full `pnpm --filter dispatch-control test:unit` is green: 924 passed / 2 todo / 0 failed (110 files, 109 passed + 1 skipped), confirmed on two consecutive full runs.

---
*Phase: 47-story-brief-stage*
*Completed: 2026-07-16*

## Self-Check: PASSED

All 6 files verified present (briefClient.ts, BriefFieldTable.tsx, BriefFieldStrengthen.tsx,
BriefFieldTable.test.tsx, BriefFieldStrengthen.test.tsx, this SUMMARY.md). All 3 task commit
hashes (e53110b, efc7ae4, 26c3fd2) verified present in `git log`.
