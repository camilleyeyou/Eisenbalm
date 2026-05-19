---
phase: 07-game-rendering
plan: 04
type: execute
wave: 1
depends_on:
  - "07-01"
  - "07-03"
files_modified:
  - apps/web/__tests__/game-sandbox.test.ts
autonomous: true
requirements:
  - GAM-03
must_haves:
  truths:
    - "pnpm --filter apps/web test:unit runs game-sandbox.test.ts and asserts the literal string 'allow-same-origin' does NOT appear in apps/web/components/issue/GameSlot.tsx"
    - "The test reads the GameSlot.tsx file from disk at test runtime (not at compile time) so future edits to GameSlot are caught immediately on the next test run"
    - "The test passes when GameSlot uses only sandbox=\"allow-scripts\" (the Phase 7 state)"
    - "The test fails (and the build fails) if any future edit reintroduces 'allow-same-origin' anywhere in GameSlot.tsx — even in a comment"
    - "The test also verifies that sandbox=\"allow-scripts\" IS present (positive assertion — proves the iframe is actually sandboxed, not just missing the dangerous flag)"
  artifacts:
    - path: "apps/web/__tests__/game-sandbox.test.ts"
      provides: "Source-scan tripwire test for GAM-03 — fails CI if allow-same-origin is ever added to GameSlot.tsx"
      contains: "allow-same-origin"
      min_lines: 25
  key_links:
    - from: "apps/web/__tests__/game-sandbox.test.ts"
      to: "apps/web/components/issue/GameSlot.tsx"
      via: "readFileSync at test runtime — file is the source of truth, not a snapshot"
      pattern: "GameSlot\\.tsx"
---

<objective>
Implement the GAM-03 source-scan tripwire test in `apps/web/__tests__/game-sandbox.test.ts` (which Plan 07-01 created as an `it.todo` stub). The test reads `apps/web/components/issue/GameSlot.tsx` from disk at runtime and asserts the literal string `allow-same-origin` is NOT present. It also asserts the positive contract: `sandbox="allow-scripts"` IS present.

Purpose: ESLint is not configured in `apps/web/`. A Vitest source-scan is the cheapest possible codebase-level tripwire — if any future engineer (or AI) adds `allow-same-origin` to GameSlot's iframe sandbox attribute (or even in a comment), the next `pnpm --filter apps/web test:unit` run fails with a clear message. This is the machine-readable enforcement of the "DO NOT remove sandbox='allow-scripts'" comment that was already in the Phase 2 file.

Output: Real assertions replacing the `it.todo` stub from Plan 07-01. No new files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/07-game-rendering/07-RESEARCH.md
@.planning/phases/07-game-rendering/07-VALIDATION.md

@apps/web/components/issue/GameSlot.tsx
@apps/web/__tests__/game-sandbox.test.ts
@apps/web/vitest.config.ts

<interfaces>
<!-- Vitest 3.x exports `describe`, `it`, `expect` from 'vitest'.
     `globals: false` in vitest.config.ts means imports are required (no Jest-style globals).

     Node's `fs` and `path` are available because vitest.config.ts sets
     environment: 'node'. The test resolves the GameSlot path relative
     to __dirname (the __tests__ directory) using path.resolve.

     The Phase 7 GameSlot.tsx (after Plan 07-03) contains exactly:
       sandbox="allow-scripts"
     and contains NO occurrence of the substring allow-same-origin.
     This test is the tripwire that locks both invariants. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Replace the it.todo stub in game-sandbox.test.ts with real source-scan assertions</name>
  <read_first>
    - apps/web/__tests__/game-sandbox.test.ts (the it.todo stub from Plan 07-01 — overwrite this file)
    - apps/web/components/issue/GameSlot.tsx (the file being scanned — confirm it's in the Phase 7 state from Plan 07-03 with `sandbox="allow-scripts"` and no `allow-same-origin`)
    - apps/web/vitest.config.ts (confirms environment: 'node' so fs/path work)
  </read_first>
  <files>apps/web/__tests__/game-sandbox.test.ts (rewritten)</files>
  <action>
    Overwrite `apps/web/__tests__/game-sandbox.test.ts` with this exact content:

    ```ts
    /**
     * GAM-03 source-scan tripwire.
     *
     * Phase 7 deliberately does NOT add ESLint to apps/web (no eslint.config.js
     * exists). Instead, this Vitest test reads GameSlot.tsx from disk at
     * runtime and fails if the literal string `allow-same-origin` appears
     * anywhere in the file — including comments. It also positively asserts
     * that `sandbox="allow-scripts"` IS present, so a future edit that
     * removes the sandbox attribute entirely is also caught.
     *
     * Why two assertions:
     *   - Negative ("not contain allow-same-origin") catches additive errors.
     *   - Positive ("contains allow-scripts") catches removal errors.
     *
     * If this test fails, DO NOT delete it or weaken the assertions. Fix
     * the GameSlot.tsx source instead. The whole point is that this test
     * IS the codebase-level guard.
     */
    import { readFileSync } from 'node:fs'
    import { resolve } from 'node:path'

    import { describe, it, expect } from 'vitest'

    const GAME_SLOT_PATH = resolve(__dirname, '../components/issue/GameSlot.tsx')

    describe('GAM-03: GameSlot sandbox security source-scan', () => {
      const source = readFileSync(GAME_SLOT_PATH, 'utf-8')

      it('never contains the literal string "allow-same-origin"', () => {
        // Negative assertion. allow-same-origin + allow-scripts together
        // defeats the sandbox: the sandboxed page can rewrite its own
        // sandbox attribute via DOM manipulation. This test fails the
        // build if any future edit (including a comment) reintroduces it.
        expect(source).not.toContain('allow-same-origin')
      })

      it('contains sandbox="allow-scripts" (positive sandbox contract)', () => {
        // Positive assertion. If a future edit removes the iframe entirely
        // or replaces the sandbox attribute, this test fails — surfacing
        // the change for review.
        expect(source).toContain('sandbox="allow-scripts"')
      })

      it('GameSlot.tsx file exists at the expected path', () => {
        // Tripwire for refactors that rename or move GameSlot. If the
        // component moves, this test must be updated to point at the new
        // path — the failure makes that maintenance step impossible to
        // overlook.
        expect(source.length).toBeGreaterThan(0)
      })
    })
    ```

    Notes for the executor:
    - `__dirname` is available in Vitest's Node environment without ESM ceremony because Vitest provides it via `node:module` shim. If the test runner reports `__dirname is not defined`, fall back to `path.resolve(process.cwd(), 'apps/web/__tests__/../components/issue/GameSlot.tsx')` — but try `__dirname` first; it works in vitest with `environment: 'node'`.
    - The `not.toContain` Vitest matcher is the right shape. It compares the raw file string, so it catches `allow-same-origin` regardless of quoting, attribute order, comment style, or formatting.
    - The positive assertion uses the exact substring `sandbox="allow-scripts"` (double quotes). The Phase 7 GameSlot.tsx uses double-quoted JSX attribute syntax (consistent with React/Next conventions). If a future formatter rewrites to single quotes, this test will fail — fix the test to accept either form ONLY after consulting Plan 07-03's source to confirm the format change is intentional.
    - The third test (file-exists tripwire) is cheap insurance: if GameSlot is ever moved/renamed, every test in this file fails with a clear ENOENT error from readFileSync, prompting the maintainer to update the path constant rather than silently lose the tripwire.

    After writing, run `pnpm --filter apps/web test:unit` to confirm all three assertions pass against the Plan 07-03 GameSlot output.
  </action>
  <verify>
    <automated>pnpm --filter apps/web test:unit 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/__tests__/game-sandbox.test.ts` exists
    - `grep -c "it.todo" apps/web/__tests__/game-sandbox.test.ts` returns 0 (stub replaced)
    - `grep "readFileSync" apps/web/__tests__/game-sandbox.test.ts` returns at least 1 match
    - `grep "allow-same-origin" apps/web/__tests__/game-sandbox.test.ts` returns at least 1 match (in the assertion)
    - `grep "not.toContain" apps/web/__tests__/game-sandbox.test.ts` returns at least 1 match
    - `grep 'sandbox=\"allow-scripts\"' apps/web/__tests__/game-sandbox.test.ts` returns at least 1 match (positive assertion)
    - `grep "GameSlot.tsx" apps/web/__tests__/game-sandbox.test.ts` returns at least 1 match (path reference)
    - `grep "from 'vitest'" apps/web/__tests__/game-sandbox.test.ts` returns 1 match (explicit imports, globals: false)
    - `pnpm --filter apps/web test:unit` exits with code 0
    - Test output contains the test names `never contains the literal string "allow-same-origin"` and `contains sandbox="allow-scripts" (positive sandbox contract)`
    - The game-sandbox.test.ts test file shows ≥3 passing tests in the Vitest output
  </acceptance_criteria>
  <done>Source-scan test passes with three real assertions; no it.todo remaining; failure of either invariant in GameSlot.tsx now breaks the test suite.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Verify the tripwire works by simulating a regression (optional dry-run, no commit)</name>
  <read_first>
    - apps/web/components/issue/GameSlot.tsx (current Phase 7 source)
    - apps/web/__tests__/game-sandbox.test.ts (Task 1 output)
  </read_first>
  <files>(none — read-only verification using sed/grep, no file edits committed)</files>
  <action>
    Optional self-verification. Confirm the tripwire actually catches the regression it claims to catch. Do this by manually checking what would happen — do NOT actually modify GameSlot.tsx and commit the change.

    Run these commands from the repo root and confirm the expected output:

    Step A — Confirm current state is green:
    ```
    pnpm --filter apps/web test:unit 2>&1 | grep -E "(PASS|FAIL).*game-sandbox" | head -3
    ```
    Expected output: a line indicating game-sandbox.test.ts passed.

    Step B — Confirm the negative assertion would catch a regression. Simulate by checking what would happen if `allow-same-origin` were added — use a temporary file:
    ```
    cp apps/web/components/issue/GameSlot.tsx /tmp/GameSlot.tsx.bak
    sed -i.bak 's/sandbox="allow-scripts"/sandbox="allow-scripts allow-same-origin"/' apps/web/components/issue/GameSlot.tsx
    pnpm --filter apps/web test:unit 2>&1 | grep -E "(FAIL|allow-same-origin)" | head -5
    ```
    Expected output: at least one line containing "FAIL" or "allow-same-origin" showing the test failed as designed.

    Step C — Restore the file IMMEDIATELY:
    ```
    cp /tmp/GameSlot.tsx.bak apps/web/components/issue/GameSlot.tsx
    rm /tmp/GameSlot.tsx.bak apps/web/components/issue/GameSlot.tsx.bak 2>/dev/null
    pnpm --filter apps/web test:unit 2>&1 | grep -E "(PASS|FAIL).*game-sandbox" | head -3
    ```
    Expected output: a line indicating game-sandbox.test.ts is green again.

    If you skip Step B (e.g. uncomfortable running mutations even temporarily), that's acceptable — the static `grep` acceptance criteria in Task 1 already prove the assertion exists. The dry-run is a confidence check, not a hard gate.

    Do NOT commit any changes to GameSlot.tsx as part of this task. If you ran Step B, the very next step MUST be Step C to restore. Verify with `git diff apps/web/components/issue/GameSlot.tsx` — must show no diff before commit.
  </action>
  <verify>
    <automated>pnpm --filter apps/web test:unit 2>&1 | tail -10 && git diff --exit-code apps/web/components/issue/GameSlot.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter apps/web test:unit` exits with code 0 (final state, after any optional Step B + Step C)
    - `git diff --exit-code apps/web/components/issue/GameSlot.tsx` exits with code 0 (GameSlot.tsx is unchanged — no accidental regression committed)
    - Repo working tree is clean for GameSlot.tsx after this task completes
  </acceptance_criteria>
  <done>Tripwire is confirmed (either by dry-run or by Task 1's static acceptance criteria); no accidental edits to GameSlot.tsx persist.</done>
</task>

</tasks>

<verification>
- `pnpm --filter apps/web test:unit` exits 0
- game-sandbox.test.ts has at least 3 passing tests
- The test file contains both `not.toContain('allow-same-origin')` and `toContain('sandbox="allow-scripts"')`
- GameSlot.tsx is unchanged from Plan 07-03's final state
</verification>

<success_criteria>
- GAM-03: any future edit that adds `allow-same-origin` to GameSlot.tsx is caught by the test suite on the next run — codebase-level enforcement without ESLint setup cost
- The positive sandbox assertion catches the inverse error (sandbox attribute removed entirely)
- The file-exists assertion catches GameSlot rename/move and forces the test path to be updated
</success_criteria>

<output>
After completion, create `.planning/phases/07-game-rendering/07-04-sandbox-source-scan-SUMMARY.md` documenting:
- Final test count in game-sandbox.test.ts (must be ≥3)
- Confirmation that the assertion file path correctly resolves to apps/web/components/issue/GameSlot.tsx
- Whether the optional dry-run regression simulation (Step B) was performed and what the failure output looked like
- Reminder to future engineers: if GameSlot is moved/renamed, update GAME_SLOT_PATH in this test file and do NOT weaken the assertions
</output>
</content>
</invoke>