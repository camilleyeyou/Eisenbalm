# Deferred Items — Phase 35

## Plan 35-05 (galley-provenance-wash)

### Pre-existing `pnpm --filter dispatch-control build` static-export failure (out of scope)

**Found during:** Task 3 verification (`pnpm --filter dispatch-control build`).

**Symptom:** `next build` fails during "Generating static pages" with:
```
Error: Could not find Convex client! `useQuery` must be used in the React
component tree under `ConvexProvider`.
```

**Scope check:** Reproduced on a clean `.next` cache and on the commit
immediately BEFORE this plan's Task 3 changes (`git stash` back to the
35-05 Task 2 commit) — the failure occurs on an unrelated dashboard page
each time (`/run-monitor` on one run, `/eval-center` on two subsequent
runs), never on `/review-desk/[runId]` (the page this plan touches). This
is a pre-existing, non-deterministic static-export issue affecting
Convex-`useQuery`-calling dashboard pages in general (e.g. the Phase 30
`/eval-center` placeholder), not something introduced by Plan 35-05.

**Action:** NOT fixed here per the scope boundary (only auto-fix issues
directly caused by the current task's changes). Logged for whichever phase
next touches build/deploy configuration for `apps/dispatch-control`.

**Evidence the plan's own code is sound despite this:**
- `next build`'s "Compiled successfully" + "Linting and checking validity
  of types" steps both pass cleanly before the unrelated page's prerender
  step fails — Plan 35-05's TypeScript is type-correct.
- Full `apps/dispatch-control` vitest suite: 45 files / 386 tests passed
  (0 regressions) including the 3 files this plan added/extended (`Galley
  .test.tsx`, `claimProvenance.test.ts`, `syntheticPortableText.test.ts`).
