---
phase: 29-deployment-hardening-code-fixes
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/package.json
  - apps/web/eslint.config.mjs
  - apps/web/next.config.ts
  - apps/web/__tests__/checkout-create-session.test.ts
  - apps/web/__tests__/stripe-webhook-idempotency.test.ts
  - apps/web/__tests__/model-pricing-staleness.test.ts
  - apps/web/__tests__/notifications-ledger.test.ts
  - apps/web/__tests__/stripe-reconciliation.test.ts
  - apps/web/app/icon.svg
autonomous: true
requirements: [D-10, D-11, D-12]
must_haves:
  truths:
    - "pnpm --filter web lint runs non-interactively (no ESLint config prompt) and does not fail the build on pre-existing style"
    - "pnpm --filter web typecheck exits 0 (was 17 errors across 5 test files)"
    - "A favicon is served so browser tabs show the brand mark instead of the default globe"
  artifacts:
    - path: "apps/web/eslint.config.mjs"
      provides: "Next 15 flat ESLint config"
      contains: "eslint-config-next"
    - path: "apps/web/app/icon.svg"
      provides: "app-router favicon"
  key_links:
    - from: "apps/web/next.config.ts"
      to: "next build"
      via: "eslint.ignoreDuringBuilds decision (set true only if lint error count is large)"
      pattern: "eslint"
---

<objective>
Three dev-tooling/hygiene fixes: (D-10) add a real ESLint config so `next lint` stops dropping into the interactive "How would you like to configure ESLint?" prompt (the gate is currently non-functional and every `eslint-disable` is decorative); (D-11) fix the 17 TypeScript errors in `apps/web/__tests__` so `pnpm --filter web typecheck` exits 0; (D-12) add a favicon so `/favicon.ico` stops 404-ing.

Purpose: a working lint gate, a green typecheck, and a branded tab.
Output: flat ESLint config + deps, fixed test typings, a served favicon.

Follow 29-RESEARCH.md § "Next.js 15 ESLint Setup" and § "TypeScript Test Errors (D-11)". CRITICAL (Pitfall 5): adding an ESLint config can make `next build` start failing on pre-existing style. Run lint ONCE to size the error surface, then set `eslint.ignoreDuringBuilds: true` in next.config.ts if the count is large — decide during execution, do not assume zero errors.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/29-deployment-hardening-code-fixes/29-RESEARCH.md

<interfaces>
Confirmed: apps/web/package.json has ZERO eslint packages; Next 15.3.9, React 19.2.6. Pin `eslint-config-next` to `^15.3.9`.

Next 15 flat config shape (from official docs):
```javascript
// apps/web/eslint.config.mjs
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
export default defineConfig([
  ...nextVitals,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
```

D-11 exact 17 errors across 5 files (verified):
- __tests__/checkout-create-session.test.ts — 10× TS2532 (lines 70,85,103,116,143,156,169,182,195,208) — add `?.`/length-guard on array/object index access
- __tests__/stripe-webhook-idempotency.test.ts — 1× TS2532 (line 101)
- __tests__/model-pricing-staleness.test.ts — 1× TS2578 unused @ts-expect-error (line 21) — delete the stale directive
- __tests__/notifications-ledger.test.ts — 1× TS2578 (line 24) + 2× TS18048 'email' possibly undefined (lines 51,62)
- __tests__/stripe-reconciliation.test.ts — 1× TS2578 (line 23) + 1× TS18047 'r.feeCents' possibly null (line 57)

D-12: no app/icon.* or app/favicon.ico exists. App-router serves `app/icon.svg` (or favicon.ico) automatically. Use the brand mark (gold #CDA434 on the light base, or a simple on-brand monogram).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: ESLint config for apps/web (D-10)</name>
  <files>apps/web/package.json, apps/web/eslint.config.mjs, apps/web/next.config.ts</files>
  <read_first>
    - apps/web/package.json (scripts.lint = "next lint"; devDependencies)
    - apps/web/next.config.ts
    - .planning/phases/29-deployment-hardening-code-fixes/29-RESEARCH.md (§ ESLint, Pitfall 5)
  </read_first>
  <action>
    Add `eslint@^9` and `eslint-config-next@^15.3.9` to `apps/web/package.json` devDependencies and install. Create `apps/web/eslint.config.mjs` using the Next 15 flat-config shape above. Run `pnpm --filter web exec next lint` ONCE to size the real error count. If it produces more than a handful of errors (pre-existing style across many phases), set `eslint: { ignoreDuringBuilds: true }` in `apps/web/next.config.ts` and document (a comment) that lint runs as an advisory `pnpm lint:web` step, not a build gate. Configure so it does NOT hard-fail on pre-existing warnings.
  </action>
  <verify>
    <automated>pnpm --filter web lint --max-warnings=100000 2>&1 | tail -5; pnpm --filter web build</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/eslint.config.mjs` && `grep -q "eslint-config-next" apps/web/eslint.config.mjs`
    - `grep -q "eslint-config-next" apps/web/package.json`
    - `pnpm --filter web lint` runs non-interactively (no "How would you like to configure ESLint?" prompt) and exits without the config-prompt hang
    - `pnpm --filter web build` exits 0 (either lint is clean or `ignoreDuringBuilds: true` is set with a documenting comment)
  </acceptance_criteria>
  <done>`next lint` is configured and non-interactive; the build stays green (lint advisory if the pre-existing error count is large).</done>
</task>

<task type="auto">
  <name>Task 2: Fix the 17 TypeScript test errors (D-11)</name>
  <files>apps/web/__tests__/checkout-create-session.test.ts, apps/web/__tests__/stripe-webhook-idempotency.test.ts, apps/web/__tests__/model-pricing-staleness.test.ts, apps/web/__tests__/notifications-ledger.test.ts, apps/web/__tests__/stripe-reconciliation.test.ts</files>
  <read_first>
    - apps/web/__tests__/checkout-create-session.test.ts
    - apps/web/__tests__/stripe-webhook-idempotency.test.ts
    - apps/web/__tests__/model-pricing-staleness.test.ts
    - apps/web/__tests__/notifications-ledger.test.ts
    - apps/web/__tests__/stripe-reconciliation.test.ts
  </read_first>
  <action>
    Fix exactly the 17 errors listed above without weakening test intent: for TS2532/TS18048/TS18047 "possibly undefined/null" add a length/null guard or non-null assertion after an explicit check (e.g. destructure after asserting `.length`, or `expect(x).toBeDefined()` then `x!`); for the three TS2578 "unused @ts-expect-error" directives, delete the stale directive line. Product source (app/, components/, lib/) is already clean — do not touch it.
  </action>
  <verify>
    <automated>pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter web typecheck` exits 0 (was 17 errors)
    - `pnpm --filter web test` still green (no test behavior weakened)
    - Only the five __tests__ files changed for this task (no product-source edits)
  </acceptance_criteria>
  <done>`pnpm --filter web typecheck` exits 0 and the vitest suite stays green.</done>
</task>

<task type="auto">
  <name>Task 3: Add a favicon (D-12)</name>
  <files>apps/web/app/icon.svg</files>
  <read_first>
    - apps/web/app/ (confirm no icon.*/favicon.ico exists)
    - apps/web/app/globals.css (brand color tokens — gold #CDA434, light base)
  </read_first>
  <action>
    Add `apps/web/app/icon.svg` — a simple on-brand mark (e.g. a monogram or dispatch mark in brand gold on the warm-paper base) that Next's App Router serves at `/icon.svg` and as the favicon. Keep it small and static (no external fetch). If an existing brand asset exists in the repo, reuse it.
  </action>
  <verify>
    <automated>pnpm --filter web build</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/app/icon.svg` (or app/favicon.ico) exists
    - `pnpm --filter web build` exits 0 and emits the icon (build output references the app icon route)
    - Manual (flagged): loading `/` in a browser shows the brand mark in the tab and `/favicon.ico` no longer 404s
  </acceptance_criteria>
  <done>An on-brand favicon is served by the App Router; the build is green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web lint` non-interactive
- `pnpm --filter web typecheck` exits 0
- `pnpm --filter web build` exits 0 with the favicon emitted
</verification>

<success_criteria>
The lint gate functions, the typecheck is green, and tabs show a brand mark — with the strict `pnpm --filter web build` staying green (lint advisory if pre-existing style errors are numerous).
</success_criteria>

<output>
After completion, create `.planning/phases/29-deployment-hardening-code-fixes/29-04-SUMMARY.md`
</output>
