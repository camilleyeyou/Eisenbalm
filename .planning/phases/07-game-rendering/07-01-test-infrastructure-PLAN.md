---
phase: 07-game-rendering
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/web/package.json
  - apps/web/vitest.config.ts
  - apps/web/__tests__/game-validator.test.ts
  - apps/web/__tests__/game-sandbox.test.ts
autonomous: true
requirements: []
must_haves:
  truths:
    - "pnpm --filter apps/web test:unit exits 0 with two test files collected"
    - "vitest, @vitest/ui, and vite-tsconfig-paths are present in apps/web devDependencies"
    - "Wave 1 plans can write real assertions in __tests__/game-validator.test.ts and __tests__/game-sandbox.test.ts without further infrastructure setup"
  artifacts:
    - path: "apps/web/vitest.config.ts"
      provides: "Vitest configuration with vite-tsconfig-paths so @/* and @convex/* aliases resolve in tests"
      contains: "vite-tsconfig-paths"
    - path: "apps/web/__tests__/game-validator.test.ts"
      provides: "Placeholder Vitest stub for validator + CSP tests (Plan 07-02 fills in)"
      contains: "describe"
    - path: "apps/web/__tests__/game-sandbox.test.ts"
      provides: "Placeholder Vitest stub for GameSlot sandbox source-scan (Plan 07-04 fills in)"
      contains: "describe"
    - path: "apps/web/package.json"
      provides: "test:unit npm script and vitest devDependency"
      contains: "test:unit"
  key_links:
    - from: "apps/web/__tests__/game-validator.test.ts"
      to: "apps/web/vitest.config.ts"
      via: "Vitest test runner uses config to resolve @/lib/* imports"
      pattern: "vite-tsconfig-paths"
---

<objective>
Stand up the Vitest test runner in apps/web so Plans 07-02, 07-03, and 07-04 can write real assertions for the game validator, CSP injection, GameSlot wiring, and the GAM-03 source-scan test.

Purpose: Phase 7 introduces unit tests where none existed before. The Nyquist validation strategy (07-VALIDATION.md) requires `pnpm --filter apps/web test:unit` to be the per-commit feedback loop with < 10s latency. This plan installs Vitest, wires the path-alias plugin, adds the npm script, and seeds empty test files that downstream plans flesh out. After this plan, every Wave 1 plan has a place to write its assertions immediately.

Output: vitest.config.ts, two test stub files, updated package.json with test:unit script and three new devDependencies.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/07-game-rendering/07-RESEARCH.md
@.planning/phases/07-game-rendering/07-VALIDATION.md

@apps/web/package.json
@apps/web/tsconfig.json

<interfaces>
<!-- Vitest 3.x exposes the standard `describe / it / expect` API. The
     `vite-tsconfig-paths` plugin reads tsconfig.json `paths` and creates
     a Vite resolve.alias entry per mapping — no manual alias table to
     maintain. The apps/web tsconfig already defines:
       "@/*":       ["./*"]
       "@convex/*": ["../../convex/*"]
     so once vite-tsconfig-paths is installed, Vitest tests can write
     `import { foo } from '@/lib/game-validator'` and `import { api }
     from '@convex/_generated/api'` with no additional config. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Install Vitest devDependencies in apps/web</name>
  <read_first>
    - apps/web/package.json (current devDependencies — must not clobber tailwind/postcss/typescript pins)
  </read_first>
  <files>apps/web/package.json (modified)</files>
  <action>
    Run from the repo root:

    ```
    pnpm --filter apps/web add -D vitest@^3.2.0 @vitest/ui@^3.2.0 vite-tsconfig-paths@^5.1.0
    ```

    If the latest stable major has bumped past 3.x at the time of execution, run `npm view vitest version` to confirm and pin to the current major rather than ^3.x — the only hard requirement is Vitest >= 1.6 (when `vite-tsconfig-paths` v5+ became compatible).

    After install, verify all three appear in `apps/web/package.json` under `devDependencies` (pnpm adds them automatically). Do NOT add them to the `dependencies` block — these are test-only.

    Also verify pnpm-lock.yaml updated at repo root (single lockfile for the workspace).
  </action>
  <verify>
    <automated>grep -E '"(vitest|@vitest/ui|vite-tsconfig-paths)"' apps/web/package.json</automated>
  </verify>
  <acceptance_criteria>
    - `grep '"vitest"' apps/web/package.json` returns a line containing `"vitest"` under devDependencies
    - `grep '"@vitest/ui"' apps/web/package.json` returns a line containing `"@vitest/ui"` under devDependencies
    - `grep '"vite-tsconfig-paths"' apps/web/package.json` returns a line containing `"vite-tsconfig-paths"` under devDependencies
    - `grep -c '"vitest"' apps/web/package.json` returns exactly 1 (no duplicate in dependencies)
    - All existing dependencies (`next`, `react`, `convex`, `@sanity/client`, `tailwindcss`) remain untouched at the same versions
    - pnpm-lock.yaml at the repo root was updated (git diff shows additions for vitest packages)
  </acceptance_criteria>
  <done>Three new devDependencies present in apps/web/package.json; lockfile updated; no other dep versions changed.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add test:unit script + create vitest.config.ts</name>
  <read_first>
    - apps/web/package.json (current scripts block — must keep dev/build/start/lint/typecheck)
    - apps/web/tsconfig.json (to confirm `@/*` and `@convex/*` path mappings exist and what they point at)
  </read_first>
  <files>apps/web/package.json (modified), apps/web/vitest.config.ts (new)</files>
  <action>
    Step A — Add the `test:unit` script to `apps/web/package.json`. After this task, the scripts block must contain exactly:

    ```json
    "scripts": {
      "dev": "next dev --port 3000",
      "build": "next build",
      "start": "next start --port 3000",
      "lint": "next lint",
      "typecheck": "tsc --noEmit",
      "test:unit": "vitest run"
    }
    ```

    Note `vitest run` (not bare `vitest`) — bare `vitest` enters watch mode which would hang CI and the GSD execution loop. Watch mode is forbidden by 07-VALIDATION.md.

    Step B — Create `apps/web/vitest.config.ts` with this exact content:

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

    Rationale:
    - `environment: 'node'` — both initial tests (game-validator pure functions, game-sandbox source-scan reading the GameSlot file from disk) work in a Node environment. No DOM needed for Phase 7.
    - `globals: false` — tests must `import { describe, it, expect } from 'vitest'` explicitly. This avoids polluting the type namespace and prevents accidental coupling to Jest globals.
    - `tsconfigPaths()` — picks up `apps/web/tsconfig.json` `paths` automatically. Phase 7 tests use `@/lib/game-validator` and (via Plan 07-03) `@convex/_generated/api`.
    - `include` is scoped to `__tests__/` so the runner does not accidentally pick up Sanity schemas or pipeline tests.
  </action>
  <verify>
    <automated>cat apps/web/vitest.config.ts && grep '"test:unit"' apps/web/package.json</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/vitest.config.ts` exists
    - `apps/web/vitest.config.ts` contains the string `import tsconfigPaths from 'vite-tsconfig-paths'`
    - `apps/web/vitest.config.ts` contains the string `plugins: [tsconfigPaths()]`
    - `apps/web/vitest.config.ts` contains the string `environment: 'node'`
    - `apps/web/vitest.config.ts` contains the string `__tests__/**/*.test.ts`
    - `grep '"test:unit": "vitest run"' apps/web/package.json` returns a match (exact `vitest run`, NOT bare `vitest`)
    - The existing five scripts (`dev`, `build`, `start`, `lint`, `typecheck`) are still present in package.json scripts block
  </acceptance_criteria>
  <done>vitest.config.ts created; test:unit script added; no other scripts removed; bare watch-mode vitest is not present.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Seed empty test stub files for Wave 1 plans</name>
  <read_first>
    - apps/web/vitest.config.ts (the include pattern this task seeds against — must match the file paths created here)
  </read_first>
  <files>apps/web/__tests__/game-validator.test.ts (new), apps/web/__tests__/game-sandbox.test.ts (new)</files>
  <action>
    Create the `apps/web/__tests__/` directory if it does not exist.

    Step A — Create `apps/web/__tests__/game-validator.test.ts` with this exact content (placeholder skip so the file collects but doesn't fail — Plan 07-02 replaces these with real assertions):

    ```ts
    import { describe, it } from 'vitest'

    // Plan 07-02 fills these in. Stubs land in Wave 0 so the runner
    // collects the file without errors and downstream plans only
    // need to flesh out the body.
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

    Step B — Create `apps/web/__tests__/game-sandbox.test.ts` with this exact content (Plan 07-04 replaces the `it.todo` with the real source-scan):

    ```ts
    import { describe, it } from 'vitest'

    // Plan 07-04 fills this in (GAM-03 source-scan).
    describe('GAM-03: GameSlot sandbox security', () => {
      it.todo('never contains allow-same-origin in any form')
    })
    ```

    Both files MUST use `it.todo(...)` (not `it.skip(...)` and not bare `it(...)`). `it.todo` keeps the runner green while signalling that an implementation is pending — which is exactly the Wave 0 / Wave 1 handoff contract.

    Do NOT add any imports from `@/lib/game-validator` yet — that module doesn't exist until Plan 07-02. Stub files exist purely so Vitest collects them on day one.
  </action>
  <verify>
    <automated>pnpm --filter apps/web test:unit 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/__tests__/game-validator.test.ts` exists
    - `apps/web/__tests__/game-sandbox.test.ts` exists
    - `grep "it.todo" apps/web/__tests__/game-validator.test.ts` returns at least 3 matches (one per pending it)
    - `grep "it.todo" apps/web/__tests__/game-sandbox.test.ts` returns exactly 1 match
    - `grep -c "import { describe, it } from 'vitest'" apps/web/__tests__/game-validator.test.ts` returns 1
    - `grep -c "import { describe, it } from 'vitest'" apps/web/__tests__/game-sandbox.test.ts` returns 1
    - `pnpm --filter apps/web test:unit` exits with code 0
    - The Vitest output (stdout) contains both file paths under "Test Files" (proves it actually collected and ran both stubs)
    - The Vitest output mentions "todo" count of at least 4 (sum across both files)
  </acceptance_criteria>
  <done>Both stub test files collected by Vitest; `test:unit` exits 0; no real assertions yet — Wave 1 plans now have anchored places to write them.</done>
</task>

</tasks>

<verification>
After all three tasks:
- `pnpm --filter apps/web test:unit` exits 0
- Vitest reports collecting `__tests__/game-validator.test.ts` and `__tests__/game-sandbox.test.ts`
- `apps/web/package.json` has the three new devDependencies and the `test:unit` script
- `apps/web/vitest.config.ts` exists with the tsconfig-paths plugin
- pnpm-lock.yaml updated
</verification>

<success_criteria>
- Wave 1 plans (07-02 validator, 07-03 GameSlot wiring, 07-04 source-scan) can write real assertions in the stub files immediately without touching infra
- `pnpm --filter apps/web test:unit` is the canonical per-commit feedback loop and runs in < 10 seconds (Nyquist requirement)
- No watch-mode flag anywhere
- Path alias `@/...` resolves in Vitest tests via `vite-tsconfig-paths` (verified by Plan 07-02 when it imports `@/lib/game-validator`)
</success_criteria>

<output>
After completion, create `.planning/phases/07-game-rendering/07-01-test-infrastructure-SUMMARY.md` documenting:
- Vitest version pinned (output of `grep '"vitest"' apps/web/package.json`)
- vitest.config.ts contents verbatim
- Exit status of `pnpm --filter apps/web test:unit`
- Number of `it.todo` entries seeded (for Wave 1 plans to find)
</output>
