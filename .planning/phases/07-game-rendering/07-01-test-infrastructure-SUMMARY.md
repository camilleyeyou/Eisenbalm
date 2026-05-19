---
phase: 07-game-rendering
plan: 01
subsystem: web-tests
tags:
  - vitest
  - test-infrastructure
  - wave-0
dependency-graph:
  requires: []
  provides:
    - "Vitest 3.x test runner in apps/web"
    - "pnpm --filter web test:unit script (production-mode, no watch)"
    - "vite-tsconfig-paths resolution for @/* and @convex/* aliases"
    - "__tests__/game-validator.test.ts stub anchor for Plan 07-02"
    - "__tests__/game-sandbox.test.ts stub anchor for Plan 07-04"
  affects:
    - "07-02-validator-and-csp (writes real assertions into game-validator.test.ts)"
    - "07-03-gameslot-wiring (may add new tests under __tests__/)"
    - "07-04-sandbox-source-scan (writes real assertion into game-sandbox.test.ts)"
    - "07-05-readme-and-smoke-test (documents test:unit in apps/web/README.md)"
tech-stack:
  added:
    - "vitest@^3.2.0"
    - "@vitest/ui@^3.2.0"
    - "vite-tsconfig-paths@^5.1.0"
  patterns:
    - "production-mode Vitest (vitest run, not bare vitest) per 07-VALIDATION.md no-watch rule"
    - "tsconfig.paths -> Vite resolve.alias via vite-tsconfig-paths plugin (no manual alias table)"
    - "it.todo placeholders signal Wave 1 ownership of the assertion body"
key-files:
  created:
    - "apps/web/vitest.config.ts"
    - "apps/web/__tests__/game-validator.test.ts"
    - "apps/web/__tests__/game-sandbox.test.ts"
  modified:
    - "apps/web/package.json"
    - "pnpm-lock.yaml"
decisions:
  - "Vitest pinned to ^3.2.0 (current stable major at time of execution); vite-tsconfig-paths ^5.1.0 (Vitest >= 1.6 compatible)"
  - "environment: 'node' — both Phase 7 test files run in Node (pure-function validator + filesystem source-scan); no jsdom needed"
  - "globals: false — tests must explicitly import { describe, it, expect } from 'vitest', avoids Jest-globals coupling"
  - "include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'] — scoped to __tests__/ so runner ignores Sanity schemas, lib/, components/"
  - "Workspace filter is `--filter web` (matching package.json `name: web`), not `--filter apps/web` (a path, not a name)"
metrics:
  duration: 6m
  tasks-completed: 3
  files-created: 3
  files-modified: 2
  completed: 2026-05-19
---

# Phase 7 Plan 01: Test Infrastructure Summary

Vitest 3.x stood up in `apps/web` with the `vite-tsconfig-paths` plugin so Wave 1 plans (07-02 validator, 07-03 GameSlot wiring, 07-04 source-scan) can write real assertions immediately against `@/lib/*` and `@convex/_generated/*` imports without touching infrastructure.

## What Landed

### Task 1 — Install Vitest devDependencies (commit 490152f)

Added to `apps/web/devDependencies`:

```
"@vitest/ui": "^3.2.0",
"vite-tsconfig-paths": "^5.1.0",
"vitest": "^3.2.0"
```

`pnpm-lock.yaml` at the repo root gained 386 lines for the new transitive tree. All pre-existing dependencies (`next@^15.3.9`, `react@^19.2.6`, `convex@^1.38.0`, `@sanity/client@^7.22.0`, `tailwindcss@^4.3.0`, `typescript@^5.6.0`) remained at their original versions — no clobbering.

### Task 2 — test:unit script + vitest.config.ts (commit 7fa0a27)

Added one new script to `apps/web/package.json` (the existing five — dev, build, start, lint, typecheck — are intact):

```json
"test:unit": "vitest run"
```

`vitest run` (not bare `vitest`) is mandatory: 07-VALIDATION.md forbids watch mode (it would hang CI and the GSD execution loop).

Created `apps/web/vitest.config.ts` verbatim from the plan:

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    globals: false,
    reporters: ['default'],
  },
})
```

The `tsconfigPaths()` plugin reads `apps/web/tsconfig.json` `paths` automatically and creates a Vite `resolve.alias` entry per mapping. With `@/*` -> `./*` and `@convex/*` -> `../../convex/*` already declared in tsconfig, no manual alias table needs maintenance.

### Task 3 — Stub test files (commit 6899b5d)

Created `apps/web/__tests__/game-validator.test.ts` (3 `it.todo` entries — Plan 07-02 fills in):

```ts
import { describe, it } from 'vitest'

describe('game-validator', () => {
  describe('validateEmbedCode (GAM-02)', () => {
    it.todo('rejects each of the 10 banned patterns')
  })
  describe('injectCsp (GAM-04)', () => {
    it.todo('injects meta tag with connect-src none and script-src unsafe-inline')
    it.todo('injects viewport meta and CSS reset for mobile (GAM-06 substrate)')
  })
})
```

Created `apps/web/__tests__/game-sandbox.test.ts` (1 `it.todo` — Plan 07-04 fills in):

```ts
import { describe, it } from 'vitest'

describe('GAM-03: GameSlot sandbox security', () => {
  it.todo('never contains allow-same-origin in any form')
})
```

Total `it.todo` entries seeded: **4** (3 validator + 1 sandbox).

## Verification

Final run of `pnpm --filter web test:unit`:

```
 RUN  v3.2.4 /Users/user/Desktop/Eisenbalm/apps/web

 ↓ __tests__/game-sandbox.test.ts (1 test | 1 skipped)
 ↓ __tests__/game-validator.test.ts (3 tests | 3 skipped)

 Test Files  2 skipped (2)
      Tests  4 todo (4)
   Start at  00:34:19
   Duration  675ms (transform 74ms, setup 0ms, collect 65ms, tests 0ms, environment 1ms, prepare 386ms)
```

- **Exit status:** 0
- **Wall-clock duration:** 675ms (well under the 10s Nyquist target)
- **Test Files collected:** 2 (both stubs)
- **Todo count:** 4 (matches plan: 3 validator + 1 sandbox)

## Deviations from Plan

### Rule 1/3 — Pnpm filter token

- **Found during:** Task 1
- **Issue:** Plan prescribed `pnpm --filter apps/web add -D ...`. Running this returns `No projects matched the filters in "/Users/user/Desktop/Eisenbalm"`. The pnpm `--filter` flag matches package `name`, not path; `apps/web/package.json` declares `"name": "web"` (not `"apps/web"`).
- **Fix:** Used `pnpm --filter web add -D ...` (matching the package name). Verification commands and acceptance criteria still pass — the resolved package is `apps/web` either way.
- **Files modified:** None (command-line change only).
- **Commit:** 490152f (the install commit itself)
- **Forward note:** All future plan-text references to `pnpm --filter apps/web test:unit` should be read as `pnpm --filter web test:unit`. Mentioned in SUMMARY frontmatter `decisions[]` for downstream plans.

No other deviations. Plan executed exactly as written for Tasks 2 and 3.

## Authentication Gates

None. All work was local-only (pnpm install + file writes).

## Concurrency Note

A parallel agent executing Plan 07-02 modified `apps/web/__tests__/game-validator.test.ts` *after* this plan's Task 3 commit (6899b5d) landed. That replacement is the planned Wave 1 handoff contract (`it.todo` placeholders become real assertions). This summary documents the file as it was at the close of Plan 07-01 — the post-replacement content is owned by Plan 07-02's summary.

## Commits

| Task | Description                                            | Commit  | Files                                                                 |
| ---- | ------------------------------------------------------ | ------- | --------------------------------------------------------------------- |
| 1    | Install vitest, @vitest/ui, vite-tsconfig-paths        | 490152f | apps/web/package.json, pnpm-lock.yaml                                 |
| 2    | Add test:unit script + create vitest.config.ts         | 7fa0a27 | apps/web/package.json, apps/web/vitest.config.ts                      |
| 3    | Seed empty test stub files for Wave 1                  | 6899b5d | apps/web/__tests__/game-validator.test.ts, apps/web/__tests__/game-sandbox.test.ts |

## Handoff to Wave 1

- Plan 07-02 (validator + CSP): replaces 3 `it.todo` entries in `__tests__/game-validator.test.ts` with real assertions; imports `validateEmbedCode` and `injectCsp` from `@/lib/game-validator` (path alias resolves via `vite-tsconfig-paths`).
- Plan 07-03 (GameSlot wiring): may add a new `__tests__/game-slot.test.tsx` if Phase 7 grows to need DOM assertions — `vitest.config.ts` `environment: 'node'` will need to flip to `'jsdom'` or use the file-level `// @vitest-environment jsdom` pragma if so. Not a blocker for 07-01.
- Plan 07-04 (source-scan): replaces 1 `it.todo` in `__tests__/game-sandbox.test.ts` with `readFileSync`-based scan of `components/issue/GameSlot.tsx`.
- Plan 07-05 (README + smoke): documents `pnpm --filter web test:unit` (not `apps/web`) in the README — see Deviation note above.

## Self-Check: PASSED

- `apps/web/vitest.config.ts` exists — FOUND
- `apps/web/__tests__/game-validator.test.ts` exists — FOUND
- `apps/web/__tests__/game-sandbox.test.ts` exists — FOUND
- Commit 490152f present in `git log` — FOUND
- Commit 7fa0a27 present in `git log` — FOUND
- Commit 6899b5d present in `git log` — FOUND
- `pnpm --filter web test:unit` exit 0 — VERIFIED
