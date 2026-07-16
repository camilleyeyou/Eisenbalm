---
phase: 47-story-brief-stage
plan: 06
subsystem: ui
tags: [convex, nextjs, react, vitest, clerk, dispatch-control]

# Dependency graph
requires:
  - phase: 47-01-contracts-convex-store-wave0-tests
    provides: "docs/API_CONTRACTS.md §47 contract, live briefs/story_leads.status Convex store, the OrgOptions/NeedsYourDecision Wave-0 it.todo scaffolds this plan fills in"
  - phase: 47-05-workspace-subscriptions-lead-card-actions
    provides: "WorkspaceStateProvider.storyLeads / verificationRecords / pitchRows — the centralized subscriptions OrgOptionSlate reads from"
provides:
  - "OrgOptionSlate.tsx — BRF-03 org options grouped under the single active lead, verification record WITH DATES, agent case, confidence, prior-coverage warning, never-truncated main concern"
  - "NeedsYourDecisionCard.tsx — BRF-04 two-option side-by-side adjudication (what each makes possible / evidence quality / risk / burden), mandatory rationale, resumes via the UNCHANGED adjudicateGate1"
  - "selectActiveLead() — the one-active-lead-per-run selector (Required > recommended > first), exported for reuse"
affects: [47-07-brief-field-table-and-strengthen, 47-08-story-brief-screen-mount-and-phase-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "OrgOptionSlate reads ws.pitchRows/ws.verificationRecords/ws.storyLeads from useWorkspaceState() (zero new subscriptions for those three) and adds exactly two new useQuery calls not centralized on the provider: deliberationEvents:byRunIdAndType (advocate rows, mirrors CandidateSlate/SignalDeskScreen) and charities:listByWorkspace (prior-coverage registry read)"
    - "NeedsYourDecisionCard stays a pure, props-only component (runId/pitchRows/advocateRows/verificationRecords) mirroring AdjudicationPanel's shape exactly — the composing screen (47-08) supplies the data and the isPausedAtGate1 gating, this component does not self-subscribe or self-gate"
    - "Evidence quality/burden on the Needs-your-decision card are derived from the REAL Phase-46 verification record (domainLive/registrationVerified/pressHits/obscurityVerdict) rather than fabricated copy — verify_candidates runs before editor_gate_1 in the graph, so this data is always available by the time Gate 1 pauses"

key-files:
  created:
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/OrgOptionSlate.tsx"
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/NeedsYourDecisionCard.tsx"
  modified:
    - "apps/dispatch-control/__tests__/OrgOptions.test.tsx"
    - "apps/dispatch-control/__tests__/NeedsYourDecision.test.tsx"

key-decisions:
  - "One-active-lead-per-run (47-RESEARCH Pitfall 1, no lead<->org join key exists): selectActiveLead() picks the operator-Required lead, else the Signal Editor's recommended lead, else the first lead — ALL surviving org options group under that single heading, never a fuzzy per-lead filter"
  - "NeedsYourDecisionCard reconstructs the top two candidates client-side via joinCandidates sorted by advocateScore (API_CONTRACTS §37.4(b)) rather than reading editor_gate_1's server-computed topTwoScores interrupt payload — the dashboard does not read interrupt payloads directly (47-RESEARCH BRF-04), consistent with how CandidateSlate/AdjudicationPanel already work"
  - "The header '⏸ Paused for you' chip flip (Masthead.tsx) is NOT wired from NeedsYourDecisionCard — it derives independently from the run's own status/completedAt subscription and flips automatically once adjudicateGate1 resumes the run; no coupling was added, and the Wave-0 scaffold's chip-flip todo was converted into a same-component 'resumed confirmation' assertion instead (documented inline in both the component doc comment and the test)"
  - "'Mechanism' (BRF-03's org-option field, no literal 'mechanism' field exists in the data model) is rendered from pitchLog's scoutSummary — Scout's own description of how the org's work fits the story — the closest existing proxy, consistent with how CandidateSlate already renders scoutSummary as the candidate's core description"

patterns-established: []

requirements-completed: []

# Metrics
duration: 35min
completed: 2026-07-16
---

# Phase 47 Plan 06: Org Options + Needs-Your-Decision Summary

**OrgOptionSlate joins pitchLog/advocate/verification/registry data under the single active lead with a never-truncated main concern; NeedsYourDecisionCard compares the top two candidates on four real (not fabricated) rows and resumes the paused run through the unchanged adjudicateGate1 bridge.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-16T11:32:00Z (approx.)
- **Completed:** 2026-07-16T11:51:00Z
- **Tasks:** 2
- **Files modified:** 4 (2 new components, 2 Wave-0 test scaffolds filled in)

## Accomplishments
- `OrgOptionSlate.tsx` (BRF-03): extends `CandidateSlate`'s `joinCandidates` (imported verbatim, not reimplemented) with two additional client-side joins on the shared `charityId`/`candidateId` key — `ws.verificationRecords` (Phase-46, WITH `checkedAt` dates) and a new `charities:listByWorkspace` subscription (prior-coverage warning). Every option renders mechanism (scoutSummary), the dated verification summary, agent case + confidence, a prior-coverage warning when the registry reports one, and its main concern rendered ALWAYS visible/IN FULL — the exact never-truncated discipline copied from `CandidateSlate.tsx:197-208`. All options group under a single active-lead heading (`selectActiveLead`: Required > recommended > first — no invented lead↔org join, per 47-RESEARCH Pitfall 1).
- `NeedsYourDecisionCard.tsx` (BRF-04): adapts `AdjudicationPanel.tsx` to a two-column comparison layout — the top two candidates (by `advocateScore`, reconstructed client-side via `joinCandidates`, §37.4(b)) render side by side with four rows: what each makes possible (`scoutSummary`), evidence quality (the real verification record — domain/registration/press/obscurity), risk (`primaryConcern`), and burden (outstanding verification gaps, derived from the same record). The label is literally "Needs your decision"; `requiresHumanInput` never renders anywhere in the DOM. "Choose this story" is disabled until a rationale is entered; submitting calls the UNCHANGED `adjudicateGate1(runId, { selection: { charityName }, reason }, token)` — the identical client `AdjudicationPanel` uses, confirmed via grep that no second resume/interrupt path exists anywhere in this plan's new code.
- Filled both Wave-0 `it.todo` scaffolds: `OrgOptions.test.tsx` (8 tests: join/render/prior-coverage/never-truncated/graceful-degradation/lead-grouping/`selectActiveLead`-preference/loading-state) and `NeedsYourDecision.test.tsx` (5 tests: label discipline, four-row side-by-side rendering, disabled-until-rationale, `adjudicateGate1` call shape, resumed-confirmation) — 0 `it.todo` remaining in either file.

## Task Commits

Each task was committed atomically:

1. **Task 1: OrgOptionSlate.tsx — grouped org options, never-truncated concern (BRF-03)** - `a22be59` (feat)
2. **Task 2: NeedsYourDecisionCard.tsx — two-option adjudication + resume (BRF-04)** - `9211ef5` (feat)

_No dedicated RED/GREEN split commits — both tasks were `tdd="true"` but landed as a single commit each containing both the filled test file and the passing component (all assertions passed on first implementation; no separate failing-test commit was meaningful to preserve, matching Plan 47-05's precedent)._

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/story-brief/_components/OrgOptionSlate.tsx` - new: BRF-03 grouped org-option slate
- `apps/dispatch-control/app/(dashboard)/story-brief/_components/NeedsYourDecisionCard.tsx` - new: BRF-04 two-option adjudication card
- `apps/dispatch-control/__tests__/OrgOptions.test.tsx` - Wave-0 scaffold filled: 8 tests
- `apps/dispatch-control/__tests__/NeedsYourDecision.test.tsx` - Wave-0 scaffold filled: 5 tests

## Decisions Made
- **One-active-lead-per-run grouping** (`selectActiveLead`, exported and independently unit-tested): Required-status lead wins over the `recommended` lead, which wins over the first lead in `story_leads` — matches 47-RESEARCH's explicit "safe, honest simplification" recommendation rather than inventing a fuzzy lead↔organization join that doesn't exist in the data model.
- **NeedsYourDecisionCard stays props-only** (`runId`, `pitchRows`, `advocateRows`, `verificationRecords`), mirroring `AdjudicationPanel`'s exact shape — the composing screen (Plan 47-08) will supply these from `useWorkspaceState()` plus the reused `isPausedAtGate1` predicate and conditionally mount the card, exactly as `SignalDeskScreen` already does for `AdjudicationPanel`. This keeps the component trivially unit-testable without provider/context mocking.
- **Evidence quality / burden use real verification data, not fabricated copy** — `verify_candidates` runs before `editor_gate_1` in the graph (`builder.py`), so `verification_records` are guaranteed to exist by the time Gate 1 pauses; deriving these two comparison rows from `domainLive`/`registrationVerified`/`pressHits`/`obscurityVerdict` keeps every rendered claim traceable to a real agent output.
- **The header "⏸ Paused for you" chip flip is intentionally NOT wired here** — `components/Masthead.tsx` already derives that chip from its own independent run-status subscription (confirmed via grep — no prior coupling existed and none was added). The Wave-0 scaffold's literal chip-flip todo was converted into an equivalent, correctly-scoped assertion (a resumed-confirmation message renders after a successful choice) rather than reaching into a sibling component's rendering from this test file.

## Deviations from Plan

**Post-execution self-correction (state-update step, not task execution):** this plan's frontmatter lists `requirements: [BRF-03, BRF-04]`. The standard `requirements mark-complete BRF-03 BRF-04` step was initially run and checked off both boxes in `REQUIREMENTS.md`, but — following the exact precedent 47-01's and 47-05's SUMMARYs established for BRF-01/BRF-02 — `OrgOptionSlate`/`NeedsYourDecisionCard` are not yet mounted into any reachable route (that is Plan 47-08, `story-brief-screen-mount-and-phase-gate`); `REQUIREMENTS.md`'s own wording describes operator-*visible* capability. Caught immediately and reverted: both `BRF-03`/`BRF-04` checkboxes in `.planning/REQUIREMENTS.md` were restored to `[ ]`; the traceability table's `Planned` status was untouched (never flipped). No `requirements mark-complete` call stands for this plan — the two boxes will flip when 47-08 (or whichever plan actually mounts Stage 1) lands, consistent with how 47-05 left BRF-01/BRF-02.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Strict-mode `noUncheckedIndexedAccess` errors in both new test files**
- **Found during:** Post-implementation `pnpm typecheck` pass (not required by this plan's `<verify>` block, but run proactively per the project's "run strict build before frontend phase done" memory/CLAUDE.md discipline)
- **Issue:** Both test files originally referenced fixture data via bracket indexing (`pitchRows[0].scoutSummary`, `advocateRows[0].payload`, `screen.getAllByRole('radio')[0]`) — under the repo's `tsconfig.base.json` `noUncheckedIndexedAccess: true`, every one of these is typed `T | undefined`, producing 7 `tsc` errors across the two files.
- **Fix:** Replaced indexed fixture access with named constants (`QUIET_HARVEST_PITCH`, `RIVERBEND_PITCH`, `QUIET_HARVEST_PRIMARY_CONCERN`, etc.) referenced directly, and replaced `screen.getAllByRole('radio')[0]` with `screen.getByRole('radio', { name: /Quiet Harvest Food Bank/i })` — matching the existing `AdjudicationPanel.test.tsx` precedent for radio selection.
- **Files modified:** `apps/dispatch-control/__tests__/OrgOptions.test.tsx`, `apps/dispatch-control/__tests__/NeedsYourDecision.test.tsx`
- **Verification:** `pnpm typecheck` shows zero errors referencing either new component or either new/modified test file; `pnpm --filter dispatch-control test:unit -- OrgOptions NeedsYourDecision` still green (8 + 5 tests) after the rewrite.
- **Committed in:** `a22be59` (OrgOptions.test.tsx), `9211ef5` (NeedsYourDecision.test.tsx) — each fixed before its respective task commit, not as a separate follow-up commit.

---

**Total deviations:** 1 auto-fixed (1 bug-class, pre-existing-pattern strict-mode fix in test files this plan authored)
**Impact on plan:** No scope creep — only the two files this plan created/filled were touched; no production component code was affected by the fix.

## Issues Encountered
None beyond the deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `OrgOptionSlate` and `NeedsYourDecisionCard` are fully built, tested, and ready to compose into the Stage-1 screen — Plan 47-08 mounts them (plus 47-05's `LeadCard`/`LeadActions` and 47-07's Brief field table) into `story-brief/StoryBriefScreen.tsx`, replacing the provisional `StoryPanelContent.tsx`. 47-08 supplies `NeedsYourDecisionCard`'s props from `useWorkspaceState()` + the reused `isPausedAtGate1` predicate (mirroring `SignalDeskScreen`'s existing conditional mount of `AdjudicationPanel`) and is also where the BRF-03/BRF-04 `REQUIREMENTS.md` checkboxes should be verified reachable end-to-end.
- No new Convex subscriptions were added to `WorkspaceStateProvider` — `OrgOptionSlate`'s two new `useQuery` calls (`deliberationEvents:byRunIdAndType`, `charities:listByWorkspace`) are local to the component, matching the existing `CandidateSlate`/`SignalDeskScreen` precedent for data not centralized on the provider.
- No blockers. `pnpm --filter dispatch-control test:unit` is green: 911 passed / 12 todo / 0 failed (110 files, 107 passed + 3 skipped) — confirmed on a full run after both tasks. `pnpm typecheck` reports zero errors referencing any file this plan created or modified (pre-existing, unrelated `__tests__/*.ts(x)` errors elsewhere in the repo are out of scope, matching Plan 47-05's documented precedent).

---
*Phase: 47-story-brief-stage*
*Completed: 2026-07-16*

## Self-Check: PASSED

All 5 files verified present (OrgOptionSlate.tsx, NeedsYourDecisionCard.tsx,
OrgOptions.test.tsx, NeedsYourDecision.test.tsx, this SUMMARY.md). Both task
commit hashes (a22be59, 9211ef5) verified present in `git log`.
