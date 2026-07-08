# Phase 33 — Deferred / out-of-scope discoveries

## Pre-existing `tsc --noEmit` failures in dispatch-control `__tests__/` (found during 33-04 Task 2)

`pnpm --filter dispatch-control typecheck` exits non-zero with **133 pre-existing
errors**, ALL confined to `__tests__/*.test.ts(x)` files (e.g. `TS2339 ImportMeta.glob`,
`TS2532 possibly undefined` in convex-test files, `TS2352` in AgentNode.test.tsx).
Verified identical count on the pre-33-04 baseline via `git stash` — Plan 33-04
introduced ZERO new errors (no non-`__tests__/` error exists at all).

Consequence: the 33-04 Task 2 acceptance criterion "`pnpm --filter dispatch-control
typecheck` exits 0" is unattainable without out-of-scope test-file cleanup. The strict
type gate that IS enforceable (and is the memory-rule gate) is
`pnpm --filter dispatch-control build`, which type-checks app source and excludes
`__tests__/`. Not fixed per CLAUDE.md SCOPE BOUNDARY (pre-existing failures in
unrelated files).

Suggested future fix: add `"types": ["vite/client"]` or `import.meta.glob` typing +
non-null assertions in the convex-test files, or exclude `__tests__/` from the
`typecheck` script's tsconfig.
