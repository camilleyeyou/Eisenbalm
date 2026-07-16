---
phase: 49-roles-permissions
plan: 06
subsystem: ui
tags: [react, clerk, a11y, aria, cloneElement, rbac]

# Dependency graph
requires:
  - phase: 49-01
    provides: role model decisions (D-01..D-04) and Clerk publicMetadata.role source of truth
provides:
  - "useRole() / useIsEditor() presentation-only client hooks (apps/dispatch-control/lib/role.ts)"
  - "<LockedControl> reusable locked-with-explanation wrapper (apps/dispatch-control/components/LockedControl.tsx)"
affects: [49-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Force-disable via React.cloneElement prop-threading (disabled + aria-disabled) onto the real interactive child, instead of a CSS-only inert overlay — keeps a locked control genuinely non-interactive and announced to assistive tech, never merely visually dimmed."
    - "useId() + aria-describedby to programmatically associate a visible explanation node with its control (no title= tooltip)."

key-files:
  created:
    - apps/dispatch-control/lib/role.ts
    - apps/dispatch-control/components/LockedControl.tsx
    - apps/dispatch-control/__tests__/LockedControl.test.tsx
  modified: []

key-decisions:
  - "useRole() returns undefined while Clerk is loading (never defaults to Collaborator) to avoid a locked-flash-then-unlock flicker for editors."
  - "LockedControl takes a SINGLE interactive child (React.Children.only) and clones it — no multi-child support this plan; callers needing multiple nodes must wrap them in one interactive element."

patterns-established:
  - "Pattern 3 (RESEARCH.md): a11y-safe locked-control rendering — clone the real element, never a pointer-events-none overlay."

requirements-completed: [ROL-03]

# Metrics
duration: 5min
completed: 2026-07-16
---

# Phase 49 Plan 06: Role Hook + LockedControl Summary

**Presentation-only `useRole()` Clerk hook plus an a11y-safe `<LockedControl>` wrapper that force-disables the real interactive child via `React.cloneElement` and associates a visible §6 explanation via `aria-describedby`.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-07-16T18:25:20Z
- **Completed:** 2026-07-16T18:30:24Z
- **Tasks:** 2 completed
- **Files modified:** 3 (2 created + 1 test)

## Accomplishments
- `useRole()` / `useIsEditor()` — client-only role hint reading Clerk `useUser().publicMetadata.role`, returning `undefined` while loading (never assumes Collaborator)
- `<LockedControl>` — reusable wrapper that clones the caller's single interactive child to force `disabled` + `aria-disabled="true"` onto the REAL element and renders the verbatim caller-supplied §6 label as visible text associated via `aria-describedby`; never removes the control from the DOM
- Test-first: `LockedControl.test.tsx` written RED (component didn't exist), then GREEN after implementation — asserts the real `<button>` (not a wrapper) carries the disabled state, is present when locked, unchanged when unlocked, and that the label node's `id` equals the button's `aria-describedby`

## Task Commits

Each task was committed atomically:

1. **Task 1: Create the useRole() presentation-only hook** - `c47476e` (feat)
2. **Task 2: Write LockedControl.test.tsx (RED)** - `4470742` (test)
2. **Task 2: Implement LockedControl.tsx (GREEN)** - `d8e7e98` (feat)

**Plan metadata:** (this commit) `docs(49-06): complete role-hook-lockedcontrol plan`

_Note: Task 2 was TDD — RED then GREEN, two commits._

## Files Created/Modified
- `apps/dispatch-control/lib/role.ts` - `useRole()` / `useIsEditor()` presentation-only hooks wrapping Clerk `useUser()`
- `apps/dispatch-control/components/LockedControl.tsx` - the reusable locked-with-explanation wrapper (ROL-03)
- `apps/dispatch-control/__tests__/LockedControl.test.tsx` - RTL test proving the a11y-safe force-disable + aria-describedby contract

## Decisions Made
- Followed the plan's revised (a11y-checker-driven) action exactly: `React.cloneElement` prop-threading onto the real child, not a `pointer-events-none` overlay div (RESEARCH.md Pattern 3 closing note).
- No hard-coded §6 label string in the component — `lockedLabel` is always a caller-supplied prop (verified via grep guard `"editor only"` count == 0); Plan 49-07 wires the six verbatim strings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Cast `getByRole('button')` result to `HTMLButtonElement` in the test**
- **Found during:** Task 2 (`pnpm typecheck`, run as part of pre-commit verification)
- **Issue:** `screen.getByRole('button', ...)` returns `HTMLElement` per Testing Library's types, which has no `.disabled` property — `tsc --noEmit` flagged two errors in the new test file.
- **Fix:** Cast both `getByRole` results `as HTMLButtonElement`, matching the existing convention already used elsewhere in this app (e.g. `AnnotationMark.test.tsx`, `PublishPreviewDialog.test.tsx`).
- **Files modified:** `apps/dispatch-control/__tests__/LockedControl.test.tsx`
- **Verification:** `pnpm typecheck` no longer reports errors in `LockedControl.test.tsx` or `LockedControl.tsx`; `pnpm vitest run __tests__/LockedControl.test.tsx` still passes (2/2).
- **Committed in:** `d8e7e98` (part of the Task 2 GREEN commit)

---

**Total deviations:** 1 auto-fixed (1 bug — type-only, no behavior change)
**Impact on plan:** Cosmetic/type-safety fix matching an established repo convention. No scope creep; acceptance criteria and behavior unchanged.

## Issues Encountered
- The acceptance-criteria grep guard (`grep -c "pointer-events-none" == 0`) initially failed because explanatory *comments* in `LockedControl.tsx` mentioned the literal string `pointer-events-none` (to document what NOT to do). Reworded those comments to convey the same meaning without the literal string, keeping the guard's intent (no inert-overlay implementation) intact.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Both ROL-03 primitives (`useRole()`, `<LockedControl>`) exist, are tested, and match the exact signatures Plan 49-07 expects (`isLocked`, `lockedLabel`, single interactive `children`).
- Plan 49-07 can now wire the six verbatim §6 labels into the real action buttons (Apply revision, Approve the Voice Pass, Publish, Make instruction active, Mark Do not use, and the fact-check apply surface sharing the Draft/Apply lock) using `<LockedControl isLocked={useRole() !== 'Editor-in-chief'} lockedLabel="...">`.
- No blockers.

---
*Phase: 49-roles-permissions*
*Completed: 2026-07-16*

## Self-Check: PASSED

All created files verified present on disk; all task commit hashes (`c47476e`, `4470742`, `d8e7e98`) verified present in git history.
