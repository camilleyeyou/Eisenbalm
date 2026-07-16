---
phase: 49-roles-permissions
plan: 07
subsystem: ui
tags: [react, clerk, rbac, a11y, cloneElement, vitest]

# Dependency graph
requires:
  - phase: 49-06
    provides: "useRole() presentation-only hook + <LockedControl> a11y-safe force-disable wrapper"
provides:
  - "All six ROL-02 gated actions (seven call sites, incl. the legacy publish path) rendered present-but-locked-with-explanation for a Collaborator via <LockedControl>, never hidden"
  - "Two integration-level RTL smoke tests (RevisionFlow, DecisionRail) proving the REAL Apply/Publish <button> is present + force-disabled + labeled with the verbatim §6 text for a Collaborator"
affects: [49-08, 49-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Role-lock props threaded from the orchestrating container (RevisionFlow) down to a shared presentation component (RevisionComparisonCard) rather than resolved via useRole() inside the shared component itself, when that component is also reused by a screen whose underlying action is NOT one of the six server-gated actions (BriefFieldStrengthen's brief-field-strengthen/apply is a distinct, ungated endpoint)."
    - "Existing test files that mock '@clerk/nextjs' narrowly (useAuth only) now also stub '@/lib/role' directly (vi.mock('@/lib/role', () => ({ useRole: () => 'Editor-in-chief' }))) to preserve pre-Phase-49 editor-view assertions, since useRole() unconditionally calls Clerk's useUser()."

key-files:
  created:
    - apps/dispatch-control/__tests__/RevisionFlow.roleGate.test.tsx
    - apps/dispatch-control/__tests__/DecisionRail.roleGate.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx
    - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/ReviewDecisionPanel.tsx
    - apps/dispatch-control/components/revision/RevisionComparisonCard.tsx
    - apps/dispatch-control/components/revision/RevisionFlow.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx
    - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx
    - apps/dispatch-control/__tests__/RevisionFlow.test.tsx
    - apps/dispatch-control/__tests__/VoicePassRail.test.tsx
    - apps/dispatch-control/__tests__/VoicePassScreen.test.tsx
    - .planning/phases/49-roles-permissions/deferred-items.md

key-decisions:
  - "The plan named RevisionFlow.tsx as the file to wrap for 'Apply revision', but the actual <button>Apply</button> JSX lives in its sibling presentation component RevisionComparisonCard.tsx. Wrapped the button there; RevisionFlow.tsx computes isLocked via useRole() and threads it down as applyLocked/applyLockedLabel props (RevisionComparisonCard defaults to unlocked when the props are omitted)."
  - "Did NOT resolve useRole() unconditionally inside RevisionComparisonCard.tsx, because that shared component is also mounted by BriefFieldStrengthen.tsx (Story Brief's 'Ask agent to strengthen'), whose apply endpoint is a distinct, currently ungated route (not one of the six ROL-02 actions) — an unconditional lock there would have incorrectly disabled a legitimate Collaborator action."
  - "RegistryTable.tsx: locked the 'Blocklist Charity' TRIGGER button (which opens the inline confirm), not the final confirm-with-reason button inside the popover — a locked Collaborator never reaches the typed-confirmation flow at all, per the plan's explicit guidance."
  - "VersionHistoryPanel.tsx: locked only the top-level 'Make active'/'Restore this version' affordance on non-active version rows; the eval-gate override sub-flow (Commit anyway) is unreachable once the top-level control is locked, so it was left unwrapped as instructed."

patterns-established:
  - "Optional lock-prop pass-through for shared presentation components reused by out-of-scope, non-gated screens, instead of baking role resolution into the shared component."

requirements-completed: [ROL-03]

# Metrics
duration: 25min
completed: 2026-07-16
---

# Phase 49 Plan 07: Wire Locked Controls Summary

**All six ROL-02 gated actions (seven call sites) wrapped in `<LockedControl>` with the verbatim DERIVED-STATE-CONTRACT §6 labels, plus two integration-level RTL smoke tests proving the real Apply/Publish buttons render present-disabled-labeled for a Collaborator — never hidden.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-16T18:33:00Z
- **Completed:** 2026-07-16T18:58:38Z
- **Tasks:** 4 completed
- **Files modified:** 14 (2 created, 12 modified)

## Accomplishments
- Apply revision (RevisionComparisonCard.tsx, mounted by RevisionFlow.tsx) + Confirm evidence replacement (FactCheckScreen.tsx) share `Apply revision 🔒 editor only`
- Approve the Voice Pass (VoicePassRail.tsx) gets `Voice approval 🔒 Editor-in-chief only`
- Publish, both surfaces — current (DecisionRail.tsx) and legacy (ReviewDecisionPanel.tsx) — get `Collaborators can review and comment, not publish.`
- Make instruction active (VersionHistoryPanel.tsx) gets `Make active 🔒 Editor-in-chief only`
- Mark Do not use (RegistryTable.tsx) gets `🔒 editor only`
- Two integration RTL smoke tests (`RevisionFlow.roleGate.test.tsx`, `DecisionRail.roleGate.test.tsx`) mount the REAL call sites with `useRole()` mocked to `'Collaborator'` and assert the actual `<button>` is present, `disabled`, `aria-disabled="true"`, and labeled with the verbatim §6 text
- Fixed a real regression the wiring caused in four pre-existing test files that mock `@clerk/nextjs` narrowly — none of them mocked `useUser`, which `useRole()` now calls unconditionally
- `pnpm --filter dispatch-control build` passes cleanly (exit 0); full `pnpm vitest run` suite: 951 passed, 2 todo, 1 skipped (up from 887 passed / 64 failed after Task 1's initial full-suite check)

## Task Commits

Each task was committed atomically:

1. **Task 1: Wrap the four FastAPI-backed controls** - `047435d` (feat)
2. **Task 2: Wrap the two Convex-backed controls** - `548e477` (feat)
   - **Regression fix (see Deviations):** `8581247` (fix)
3. **Task 3: Integration RTL smoke tests** - `592222e` (test)
4. **Task 4: Strict Next build** - `44ad58a` (chore — no code changes needed; documents the verification + deferred typecheck debt)

**Plan metadata:** (this commit) `docs(49-07): complete wire-locked-controls plan`

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx` - wraps the "Confirm replacement" button (local `EvidenceComparisonCard` component) with the shared Apply-revision lock
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx` - wraps "Sign: Sounds human" with the voice-approval lock
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` - wraps "Publish" with the publish sentence
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/ReviewDecisionPanel.tsx` - legacy "Approve and Publish" surface gated the same way
- `apps/dispatch-control/components/revision/RevisionComparisonCard.tsx` - actual DOM location of the "Apply" button; now accepts optional `applyLocked`/`applyLockedLabel` props (default unlocked) instead of resolving role internally
- `apps/dispatch-control/components/revision/RevisionFlow.tsx` - resolves `useRole()` once and threads `applyLocked`/`applyLockedLabel` down to `RevisionComparisonCard`
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx` - wraps the top-level "Make active"/"Restore this version" affordance
- `apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` - wraps the "Blocklist Charity" trigger (not the inner confirm button)
- `apps/dispatch-control/__tests__/RevisionFlow.roleGate.test.tsx` - new integration smoke test (SC-3)
- `apps/dispatch-control/__tests__/DecisionRail.roleGate.test.tsx` - new integration smoke test (SC-3)
- `apps/dispatch-control/__tests__/DecisionRail.test.tsx`, `RevisionFlow.test.tsx`, `VoicePassRail.test.tsx`, `VoicePassScreen.test.tsx` - added `vi.mock('@/lib/role', () => ({ useRole: () => 'Editor-in-chief' }))` to preserve pre-Phase-49 editor-view assertions
- `.planning/phases/49-roles-permissions/deferred-items.md` - recorded Task 4's clean strict-build result and an updated (larger) pre-existing `tsc --noEmit` test-file debt count, confirmed unrelated to this plan's files

## Decisions Made
- See `key-decisions` in frontmatter above — the RevisionComparisonCard prop-threading decision (avoiding a false lock on BriefFieldStrengthen's distinct, ungated apply endpoint) is the most consequential one; it also happens to correctly land the role resolution in `RevisionFlow.tsx`, matching the plan's stated `files_modified` even though the plan's read_first note pointed at the wrong JSX location for the button itself.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] "Apply revision" JSX lives in RevisionComparisonCard.tsx, not RevisionFlow.tsx**
- **Found during:** Task 1
- **Issue:** The plan's `files_modified` and interfaces section named `RevisionFlow.tsx` as the file containing the "Apply" button (`~line 138 → applyRevision`), but that line is actually inside `RevisionFlow.tsx`'s `applyText()` function which merely *calls* `applyRevision`; the actual `<button>Apply</button>` JSX is rendered by the sibling presentation component `components/revision/RevisionComparisonCard.tsx` (mounted via `<RevisionComparisonCard onApply={handleApply} .../>`).
- **Fix:** Added the `<LockedControl>` wrap directly around the Apply button in `RevisionComparisonCard.tsx`. `RevisionFlow.tsx` still gets a legitimate change (computes `isLocked` via `useRole()`, threads it down as props), matching the plan's file list in substance.
- **Files modified:** `apps/dispatch-control/components/revision/RevisionComparisonCard.tsx`, `apps/dispatch-control/components/revision/RevisionFlow.tsx`
- **Verification:** `grep -c "LockedControl"` across the plan's 5 named files sums to 12 (≥5 required); `RevisionFlow.roleGate.test.tsx` (Task 3) mounts `<RevisionFlow>` end-to-end and confirms the real Apply button renders locked for a Collaborator.
- **Committed in:** `047435d` (Task 1), refined in `8581247`

**2. [Rule 1 - Bug] Locking RevisionComparisonCard unconditionally would have wrongly gated an unrelated, ungated screen**
- **Found during:** Task 1 follow-up (running the full `pnpm vitest run` suite as an extra safety check beyond Task 1's narrow specified verify command)
- **Issue:** `RevisionComparisonCard.tsx` is also mounted by `apps/dispatch-control/app/(dashboard)/story-brief/_components/BriefFieldStrengthen.tsx` ("Ask agent to strengthen" a Brief field). That screen's apply endpoint (`POST /issues/{run_id}/brief/{field}/strengthen/apply`, `packages/pipeline/.../api/brief.py`) uses only `_require_clerk_jwt_control` (authentication) — it is explicitly NOT one of the six ROL-02 server-gated actions. My initial implementation called `useRole()` directly inside `RevisionComparisonCard.tsx`, which would have rendered that unrelated screen's Apply button as locked for a Collaborator even though the server does not actually restrict it — a false/misleading lock and a functional regression for a legitimate Collaborator capability.
- **Fix:** Refactored `RevisionComparisonCard.tsx` to accept optional `applyLocked`/`applyLockedLabel` props (default unlocked, no `useRole()` call inside the shared component). Only `RevisionFlow.tsx` (the actual "Apply revision" entry point, one of the six actions) resolves the role and passes the lock down. `BriefFieldStrengthen.tsx` was left untouched and its Apply button remains unaffected.
- **Files modified:** `apps/dispatch-control/components/revision/RevisionComparisonCard.tsx`, `apps/dispatch-control/components/revision/RevisionFlow.tsx`
- **Verification:** `pnpm vitest run __tests__/BriefFieldStrengthen.test.tsx __tests__/RevisionComparisonCard.test.tsx` — both pass unmodified, confirming the unrelated screen's behavior is unchanged.
- **Committed in:** `8581247`

**3. [Rule 1 - Bug] LockedControl wiring broke four pre-existing test files' Clerk mocks**
- **Found during:** Task 1 follow-up (full `pnpm vitest run`, run proactively beyond the plan's narrower per-task verify commands)
- **Issue:** `useRole()` (from Plan 49-06) unconditionally calls Clerk's `useUser()`. Four pre-existing test files — `DecisionRail.test.tsx`, `VoicePassRail.test.tsx`, `VoicePassScreen.test.tsx`, `RevisionFlow.test.tsx` — mock `@clerk/nextjs` narrowly (`useAuth` only, no `useUser`), because before this plan their components-under-test never called `useUser()`. Once `DecisionRail.tsx`/`VoicePassRail.tsx`/`RevisionFlow.tsx` started calling `useRole()`, every test in those four files threw `"No 'useUser' export is defined on the '@clerk/nextjs' mock"` (64 failing tests across 6 files, including the two RevisionComparisonCard-reuse cases already covered by fix #2 above).
- **Fix:** Added `vi.mock('@/lib/role', () => ({ useRole: () => 'Editor-in-chief' }))` to each of the four files, isolating them from Clerk's mock shape entirely and preserving their pre-existing "editor sees everything enabled" assertions. The Collaborator-locked contract for these same components is covered separately by the new `*.roleGate.test.tsx` integration tests (Task 3).
- **Files modified:** `apps/dispatch-control/__tests__/DecisionRail.test.tsx`, `RevisionFlow.test.tsx`, `VoicePassRail.test.tsx`, `VoicePassScreen.test.tsx`
- **Verification:** Full `pnpm vitest run` went from 887 passed/64 failed to 951 passed/0 failed (2 todo, 1 skipped unchanged).
- **Committed in:** `8581247`

---

**Total deviations:** 3 auto-fixed (1 blocking/wrong-file-location, 2 bugs — one a would-be false-lock regression on an unrelated screen, one a test-mock regression). No scope creep: all three were directly caused by this plan's own wiring changes and are essential for correctness (an accurate lock signal + a green test suite).
**Impact on plan:** None of the six required §6 labels, files, or acceptance-criteria greps changed as a result — all pass exactly as specified. The extra fixes only corrected *where* the role check lives and repaired test infrastructure the wiring disturbed.

## Issues Encountered
- Task 1's plan-specified verify command (`pnpm vitest run __tests__/dispatch-control-no-sanity-write.test.ts`) is narrow and would not have caught the four-test-file regression above. Ran the full `pnpm vitest run` suite proactively after Task 1/2 to catch this before it reached Task 3/4 — resolved as documented above.
- `pnpm --filter dispatch-control typecheck` (bare `tsc --noEmit`, broader than the plan's Task 4 build gate) surfaces 232 pre-existing errors across 30 test files, none touched by this plan and none related to roles/permissions — recorded in `deferred-items.md` per the scope-boundary rule; `pnpm --filter dispatch-control build` (the actual Task 4 gate) is green.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- All six ROL-02 gated actions now render present-but-locked-with-explanation for a Collaborator, verified by: static greps (Tasks 1-2), two integration RTL smoke tests (Task 3), the pre-existing LockedControl unit test (49-06), and a clean strict build (Task 4).
- Plan 49-08 (comments-affordance-mount) and 49-09 (integration-gate, the full phase human-verify pass) can proceed — no blockers.
- `pnpm vitest run` is fully green (951 passed) and should be the baseline any future plan in this phase diffs against.

---
*Phase: 49-roles-permissions*
*Completed: 2026-07-16*

## Self-Check: PASSED
