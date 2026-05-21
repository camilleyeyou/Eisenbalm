---
phase: quick-260521-mnz
plan: "01"
subsystem: apps/web
tags: [type-fix, deliberation-layer, build-fix]
dependency_graph:
  requires: []
  provides: [clean-production-build]
  affects: [apps/web/components/issue/DeliberationSlot.tsx]
tech_stack:
  added: []
  patterns: [typeof-narrowing]
key_files:
  modified:
    - apps/web/components/issue/DeliberationSlot.tsx
decisions:
  - "Used `typeof scoreValue === 'number'` (not `scoreValue !== null`) to narrow `number | null | undefined` to `number`, eliminating the undefined escape that `!== null` leaves"
metrics:
  duration: "~3 min"
  completed: "2026-05-21"
  tasks_completed: 1
  files_changed: 1
---

# Quick Task 260521-mnz: Fix DeliberationSlot scoreValue Possibly-Undefined

**One-liner:** Swapped `scoreValue !== null` guard to `typeof scoreValue === 'number'` on the advocate-score-bar branch, eliminating the TypeScript `possibly 'undefined'` error that blocked production builds.

## What Was Fixed

**File:** `apps/web/components/issue/DeliberationSlot.tsx` line 340

**Before:**
```tsx
{hasScore && scoreValue !== null ? (
```

**After:**
```tsx
{hasScore && typeof scoreValue === 'number' ? (
```

## Why This Fixed It

The type chain was:
- `advocateScores` is `Map<string, number | null>` (line 129)
- `Map.get()` adds `undefined` to the return type: `number | null | undefined`
- `const scoreValue = hasScore ? score : undefined` → type: `number | null | undefined`
- The old guard `scoreValue !== null` only narrowed out `null`, leaving `number | undefined`
- TypeScript then flagged `${(scoreValue / 10) * 100}%` (line 365) as arithmetic on `number | undefined`

`typeof scoreValue === 'number'` correctly narrows to exactly `number` inside the branch, satisfying both the label at line 355 (`{scoreValue}/10`) and the width arithmetic at line 365.

## Unchanged Branches

The null-score fallback branch was left exactly as-is:
```tsx
) : hasScore && scoreValue === null ? (
  <p ...>Scores did not complete this cycle.</p>
) : null}
```
This still correctly handles the Issue 999 real-data case where the Advocate emitted a `null` score into the map.

## Build Result

```
pnpm --filter web build
✓ Compiled successfully in 4.8s
✓ Generating static pages (23/23)
Exit 0 — no "Type error", no "Failed to compile"
```

No additional latent type errors surfaced after applying the guard fix. The build passed cleanly on the first attempt.

## Test Result

```
vitest run __tests__/deliberation-advocate-scores.test.ts __tests__/deliberation-no-model-names.test.ts __tests__/game-sandbox.test.ts
✓ deliberation-advocate-scores.test.ts (4 tests)
✓ game-sandbox.test.ts (3 tests)
✓ deliberation-no-model-names.test.ts (3 tests)
Tests: 10 passed (10)
Exit 0
```

## Commit

- `ac71c83` — `fix(quick-260521-mnz): narrow scoreValue guard to typeof === 'number'`

## Deviations from Plan

None — plan executed exactly as written. One edit, one build pass, tests clean.

## Self-Check: PASSED

- `apps/web/components/issue/DeliberationSlot.tsx` line 340: `hasScore && typeof scoreValue === 'number'` confirmed
- Commit `ac71c83` exists in git log
- Build: Compiled successfully, exit 0
- Tests: 10/10 passed
