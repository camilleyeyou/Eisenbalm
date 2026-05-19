---
phase: 07-game-rendering
plan: 04
subsystem: web-tests
tags: [vitest, source-scan, tripwire, gam-03, security-test, wave-3]

requires:
  - phase: 07-game-rendering
    provides: Vitest 3.x infra + apps/web/__tests__/game-sandbox.test.ts it.todo stub (Plan 07-01)
  - phase: 07-game-rendering
    provides: GameSlot.tsx final Phase 7 shape — `sandbox="allow-scripts"` present, no `allow-same-origin` literal anywhere (Plan 07-03)

provides:
  - "Codebase-level GAM-03 tripwire — any future edit adding `allow-same-origin` to GameSlot.tsx (even in a comment) fails the build on the next `pnpm --filter web test:unit` run"
  - "Positive sandbox contract — the test also fails if a future edit removes `sandbox=\"allow-scripts\"` entirely"
  - "File-exists tripwire — readFileSync raises ENOENT if GameSlot is moved/renamed, forcing the test path to be updated rather than silently lost"
  - "Final unit test count in apps/web: 27 (24 validator + 3 sandbox source-scan)"

affects:
  - "07-05 (readme-and-smoke-test): README will document the test:unit script which now includes the source-scan tripwire as part of CI gate"
  - "Phase 9 deliberation layer: no direct dependency; source-scan is build-level enforcement, not runtime"
  - "Any future engineer/AI editing GameSlot.tsx: if `allow-same-origin` is reintroduced, the test fails with a clear assertion message — guidance to fix GameSlot, NOT to weaken the test, is embedded in the test docstring"

tech-stack:
  added: []
  patterns:
    - "readFileSync at test runtime (not at compile time) so the test always reflects the current GameSlot.tsx source"
    - "Two-sided assertion (negative + positive) — negative catches additive errors, positive catches removal errors"
    - "Third assertion as path-rename tripwire — file length > 0 fails fast if GameSlot is moved/renamed (readFileSync raises ENOENT)"
    - "Indirect phrasing in renderer files (Plan 07-03 GameSlot.tsx comments avoid the literal forbidden token) so grep-based source-scans are not fooled by docstrings"

key-files:
  created: []
  modified:
    - "apps/web/__tests__/game-sandbox.test.ts (4 → 49 lines — replaced `it.todo` stub with 3 real assertions)"

key-decisions:
  - "`__dirname` works in Vitest 3.x with `environment: 'node'` — no need for `path.resolve(process.cwd(), ...)` fallback. Confirmed by green test run on first try."
  - "Three assertions (not two): negative `not.toContain('allow-same-origin')`, positive `toContain('sandbox=\"allow-scripts\"')`, AND a file-length sanity check. The third is cheap insurance against GameSlot rename/move — readFileSync raises ENOENT and the entire describe block fails with a clear pointer to update `GAME_SLOT_PATH`."
  - "Used `toContain` (substring match) rather than regex. The plan's note about future formatter rewrites (single-quote JSX) is acknowledged: if Prettier ever flips JSX to single quotes, this test will fail and a maintainer must consult Plan 07-03 to confirm the format change is intentional before relaxing the assertion to a regex."
  - "Dry-run regression simulation (Step B) was performed and confirmed: sed-mutating the iframe `sandbox=\"allow-scripts\"` → `sandbox=\"allow-scripts allow-same-origin\"` made 2 of 3 tests fail (negative + positive both flipped), exit code 1. GameSlot.tsx was restored verbatim and final test run shows 27/27 passing, `git diff --exit-code` clean."

requirements-completed:
  - GAM-03

metrics:
  duration: 7min
  tasks-completed: 2
  files-created: 0
  files-modified: 1
  completed: 2026-05-19
---

# Phase 07 Plan 04: Sandbox Source-Scan Tripwire Summary

The GAM-03 codebase-level tripwire is now live. `apps/web/__tests__/game-sandbox.test.ts` reads `apps/web/components/issue/GameSlot.tsx` from disk at every test run and fails CI if `allow-same-origin` ever appears in the file. The positive `sandbox="allow-scripts"` assertion catches the inverse failure (sandbox attribute removed entirely). A third file-exists assertion catches GameSlot rename/move.

## Performance

- **Duration:** ~7 min (~429s)
- **Started:** 2026-05-19T08:00:13Z
- **Completed:** 2026-05-19T08:07:22Z
- **Tasks:** 2 (1 implementation + 1 dry-run verification — no commit on Task 2 by design)
- **Files modified:** 1 (`apps/web/__tests__/game-sandbox.test.ts`)

## Accomplishments

- Replaced the Plan 07-01 `it.todo` stub in `apps/web/__tests__/game-sandbox.test.ts` with three real assertions (45 net lines added including module docstring).
- Assertion 1 (**negative**): `expect(source).not.toContain('allow-same-origin')` — the GAM-03 tripwire proper. Fails the build if any future edit (including comments) reintroduces the forbidden escape token.
- Assertion 2 (**positive**): `expect(source).toContain('sandbox="allow-scripts"')` — proves the iframe is actually sandboxed, not just missing the dangerous flag. Catches the failure mode "someone removed the sandbox attribute entirely."
- Assertion 3 (**path tripwire**): `expect(source.length).toBeGreaterThan(0)` — readFileSync raises ENOENT before this line ever runs if GameSlot is moved/renamed, forcing the maintainer to update `GAME_SLOT_PATH` rather than silently lose the security guard.

## Task Commits

- **Task 1 (implementation):** `7d09db5` — `test(07-04): implement GAM-03 source-scan tripwire in game-sandbox.test.ts`
- **Task 2 (verification dry-run):** No commit. By plan design — `<files>(none — read-only verification using sed/grep, no file edits committed)</files>`. Verified that:
  - Step A: pre-mutation test run = 27/27 passing
  - Step B: after `sed 's/sandbox="allow-scripts"/sandbox="allow-scripts allow-same-origin"/'`, **2 of 3 source-scan tests failed** (negative + positive assertions both flipped) — tripwire works
  - Step C: `cp /tmp/GameSlot.tsx.bak apps/web/components/issue/GameSlot.tsx` restored verbatim; final state 27/27 passing; `git diff --exit-code apps/web/components/issue/GameSlot.tsx` clean

## Verification

### Acceptance Criteria (Task 1)

| Criterion | Command | Expected | Actual |
| --- | --- | --- | --- |
| `it.todo` removed | `grep -c "it.todo" apps/web/__tests__/game-sandbox.test.ts` | 0 | **0** ✓ |
| readFileSync used | `grep -c "readFileSync" apps/web/__tests__/game-sandbox.test.ts` | ≥1 | **2** ✓ |
| `allow-same-origin` in test | `grep -c "allow-same-origin" apps/web/__tests__/game-sandbox.test.ts` | ≥1 | **5** ✓ |
| `not.toContain` used | `grep -c "not.toContain" apps/web/__tests__/game-sandbox.test.ts` | ≥1 | **1** ✓ |
| `sandbox="allow-scripts"` in test | `grep -c 'sandbox="allow-scripts"' apps/web/__tests__/game-sandbox.test.ts` | ≥1 | **3** ✓ |
| `GameSlot.tsx` path reference | `grep -c "GameSlot.tsx" apps/web/__tests__/game-sandbox.test.ts` | ≥1 | **4** ✓ |
| Explicit `vitest` import | `grep -c "from 'vitest'" apps/web/__tests__/game-sandbox.test.ts` | 1 | **1** ✓ |
| `pnpm --filter web test:unit` exit code | — | 0 | **0** ✓ |
| Game-sandbox passing tests | — | ≥3 | **3** ✓ |

### Acceptance Criteria (Task 2)

| Criterion | Command | Expected | Actual |
| --- | --- | --- | --- |
| Final test run green | `pnpm --filter web test:unit` | exit 0 | **exit 0** ✓ |
| GameSlot.tsx unchanged | `git diff --exit-code apps/web/components/issue/GameSlot.tsx` | exit 0 | **exit 0** ✓ |

### Final Unit Test Output

```
 RUN  v3.2.4 /Users/user/Desktop/Eisenbalm/apps/web

 ✓ __tests__/game-sandbox.test.ts (3 tests) 4ms
 ✓ __tests__/game-validator.test.ts (24 tests) 11ms

 Test Files  2 passed (2)
      Tests  27 passed (27)
   Duration  719ms
```

### Dry-Run Regression Output (Step B — what a future regression looks like)

After sed-mutating GameSlot.tsx to add `allow-same-origin`:

```
 ❯ __tests__/game-sandbox.test.ts:41:20
     39|     // or replaces the sandbox attribute, this test fails — surfacing
     40|     // the change for review.
     41|     expect(source).toContain('sandbox="allow-scripts"')
       |                    ^
     42|   })

 Test Files  1 failed | 1 passed (2)
      Tests  2 failed | 25 passed (27)
Exit status 1
```

Both assertions flipped as designed:
- Negative `not.toContain('allow-same-origin')` failed: the substring is now in the file.
- Positive `toContain('sandbox="allow-scripts"')` failed: the sed expression rewrote the exact literal to `sandbox="allow-scripts allow-same-origin"` (with the trailing token). This is a desirable false-positive: any modification of the sandbox attribute value forces a maintainer to consult Plan 07-03 before adjusting the assertion. If the project ever needs to add a SAFE additional token (e.g. `allow-pointer-lock`), the test must be updated deliberately — preventing silent erosion of the sandbox contract.

## Test File Path Resolution

`GAME_SLOT_PATH = resolve(__dirname, '../components/issue/GameSlot.tsx')` resolves to:

```
/Users/user/Desktop/Eisenbalm/apps/web/components/issue/GameSlot.tsx
```

`__dirname` works out of the box in Vitest 3.x with `environment: 'node'` (the runner provides the CommonJS shim). No fallback to `process.cwd()` was needed.

## Deviations from Plan

None. Plan executed exactly as written. The optional Step B regression simulation (Task 2) was performed and confirmed the tripwire works.

## Reminder to Future Engineers

If `apps/web/components/issue/GameSlot.tsx` is moved or renamed:

1. Update `GAME_SLOT_PATH` in `apps/web/__tests__/game-sandbox.test.ts` to point at the new path.
2. **DO NOT delete or weaken the assertions.** The whole point is that this test IS the codebase-level GAM-03 guard. ESLint is deliberately not configured in `apps/web/` (Phase 7 cost decision), so this Vitest source-scan is the only build-time enforcement.
3. If the test fails for any other reason (regression in GameSlot.tsx), fix the source — DO NOT modify the test. The assertion failure message points at the exact mistake.

## Authentication Gates

None. All work was local file writes + pnpm test runs.

## Self-Check: PASSED

- File modified: `apps/web/__tests__/game-sandbox.test.ts` — FOUND
- Commit exists: `7d09db5` (`test(07-04): implement GAM-03 source-scan tripwire in game-sandbox.test.ts`) — FOUND
- `it.todo` removed: count = 0 — VERIFIED
- 3 assertions present: `not.toContain('allow-same-origin')` + `toContain('sandbox="allow-scripts"')` + file-length tripwire — VERIFIED
- Unit tests passing: `pnpm --filter web test:unit` exits 0 with 27/27 passing — VERIFIED
- GameSlot.tsx unchanged: `git diff --exit-code` returns 0 — VERIFIED
- Dry-run regression simulation executed: Step B caused 2 failures, Step C restored verbatim — VERIFIED

---
*Phase: 07-game-rendering*
*Completed: 2026-05-19*
