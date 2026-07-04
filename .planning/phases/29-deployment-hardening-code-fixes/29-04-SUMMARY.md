---
phase: 29-deployment-hardening-code-fixes
plan: 04
subsystem: testing
tags: [eslint, typescript, next15, favicon, tooling, vitest]

# Dependency graph
requires:
  - phase: 27-money-notifications
    provides: finance/staleness + finance/reconcile + notifications/dispatch helpers (the Wave 2 modules whose stale @ts-expect-error directives are now removed)
  - phase: 08-stripe-commerce
    provides: checkout + webhook test suites carrying the possibly-undefined mock.calls errors
provides:
  - Functional non-interactive ESLint config for apps/web (Next 15 flat config via FlatCompat)
  - Green pnpm --filter web typecheck (was 17 errors across 5 test files)
  - On-brand App Router favicon (app/icon.svg) replacing the default globe / 404 favicon
affects: [deployment, ci, web]

# Tech tracking
tech-stack:
  added: [eslint@^9, eslint-config-next@^15.3.9]
  patterns:
    - "ESLint 9 flat config bridging eslintrc-format eslint-config-next via @eslint/eslintrc FlatCompat"
    - "Lint is advisory (eslint.ignoreDuringBuilds), not a build gate, for pre-existing style"

key-files:
  created:
    - apps/web/eslint.config.mjs
    - apps/web/app/icon.svg
  modified:
    - apps/web/package.json
    - apps/web/next.config.ts
    - apps/web/__tests__/checkout-create-session.test.ts
    - apps/web/__tests__/stripe-webhook-idempotency.test.ts
    - apps/web/__tests__/model-pricing-staleness.test.ts
    - apps/web/__tests__/notifications-ledger.test.ts
    - apps/web/__tests__/stripe-reconciliation.test.ts

key-decisions:
  - "eslint-config-next@15.5.20 ships eslintrc-format config, so the flat config bridges it with FlatCompat rather than importing a native flat export (which does not exist)"
  - "Lint made advisory (ignoreDuringBuilds:true) + two erroring rules softened (no-html-link-for-pages→warn, no-explicit-any→off) so ~29 phases of pre-existing style don't hard-fail the strict build or the lint command"
  - "Registered @typescript-eslint/no-explicit-any as 'off' purely so stale inline disable directives in lib/theme.test.ts resolve to a known rule (core-web-vitals doesn't load the TS plugin)"

patterns-established:
  - "Pattern: dev-tooling ESLint added despite no-new-runtime-deps lock — it's not a runtime dependency"
  - "Pattern: test-type fixes use non-null assertion / optional chaining after explicit guards; never weaken product behavior"

requirements-completed: [D-10, D-11, D-12]

# Metrics
duration: ~40min
completed: 2026-07-04
---

# Phase 29 Plan 04: ESLint config + test typecheck + favicon Summary

**Working non-interactive ESLint gate for apps/web (Next 15 flat config), a green `pnpm --filter web typecheck` (17→0 errors), and an on-brand App Router favicon — with the strict production build staying green.**

## Performance

- **Duration:** ~40 min (dominated by a slow `pnpm add` of the eslint-config-next dependency tree)
- **Started:** 2026-07-04T06:00Z (approx)
- **Completed:** 2026-07-04T06:41Z
- **Tasks:** 3
- **Files modified:** 9 (2 created, 7 modified)

## Accomplishments
- **D-10:** `apps/web/eslint.config.mjs` — Next 15 flat config that bridges `eslint-config-next`'s eslintrc `core-web-vitals` ruleset via `FlatCompat`. `next lint` no longer drops into the interactive "How would you like to configure ESLint?" prompt; `pnpm --filter web lint` exits 0 (warnings only). `eslint.ignoreDuringBuilds:true` in next.config.ts keeps the strict build green.
- **D-11:** All 17 TypeScript errors across 5 test files fixed; `pnpm --filter web typecheck` exits 0. Vitest stays green at 443 passed / 13 todo.
- **D-12:** `apps/web/app/icon.svg` — oxblood/gold monogram served at `/icon.svg`; the strict build emits the `/icon.svg` route (`○ /icon.svg`, `.next/server/app/icon.svg.body`).

## Task Commits

Each task was committed atomically:

1. **Task 2: Fix 17 TypeScript test errors (D-11)** - `cf87aa8` (fix)
2. **Task 3: Add favicon (D-12)** - `d12b2d5` (feat)
3. **Task 1: ESLint config for apps/web (D-10)** - `a157ef3` (chore)

_(Tasks committed in dependency-safe order — test fixes and favicon before the eslint/next.config change; all three planned tasks complete.)_

## Files Created/Modified
- `apps/web/eslint.config.mjs` - Flat ESLint config (FlatCompat → next/core-web-vitals); softens 2 erroring rules to keep lint advisory
- `apps/web/app/icon.svg` - On-brand oxblood (#9A3324) + gold (#9C7A3C) "E" monogram favicon
- `apps/web/next.config.ts` - `eslint.ignoreDuringBuilds: true` so lint is not a build gate
- `apps/web/package.json` - added `eslint@^9`, `eslint-config-next@^15.3.9` devDeps
- `apps/web/__tests__/checkout-create-session.test.ts` - 10× non-null assert on `mock.calls[0]!` (TS2532)
- `apps/web/__tests__/stripe-webhook-idempotency.test.ts` - 1× non-null assert on `mock.calls[0]!` (TS2532)
- `apps/web/__tests__/model-pricing-staleness.test.ts` - removed stale `@ts-expect-error` (TS2578)
- `apps/web/__tests__/notifications-ledger.test.ts` - removed stale `@ts-expect-error` + optional-chained possibly-undefined `email` (TS2578, TS18048)
- `apps/web/__tests__/stripe-reconciliation.test.ts` - removed stale `@ts-expect-error` + guarded possibly-null `feeCents` (TS2578, TS18047)

## Decisions Made
- **Flat-config bridge, not native flat export:** `eslint-config-next@15.5.20` still exports eslintrc-format objects (`{ extends: [...] }`), not a flat-config array. The plan's suggested `import nextVitals from 'eslint-config-next/core-web-vitals'` shape does not work against this version, so the config uses `@eslint/eslintrc` `FlatCompat` (resolvable via the workspace `.pnpm` store). The must-have artifact ("eslint.config.mjs contains eslint-config-next") is satisfied.
- **Lint advisory, not enforced:** Lint surfaced 4 pre-existing errors (1× `no-html-link-for-pages`, 3× `no-explicit-any` "rule definition not found" from stale inline disables in `lib/theme.test.ts` — a file outside this plan's scope). Rather than edit out-of-scope files or add the full TS-plugin ruleset (a wall of new errors — Pitfall 5), softened those two rules (warn / off) and set `ignoreDuringBuilds:true`. Lint exits 0 with warnings only; the strict build is unaffected.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Flat config could not import a native eslint-config-next flat export**
- **Found during:** Task 1 (ESLint config)
- **Issue:** The plan's `interfaces` block proposed `import nextVitals from 'eslint-config-next/core-web-vitals'`, but the installed `eslint-config-next@15.5.20` ships eslintrc-format config (CommonJS `{ extends }`), not a flat-config array — importing it as flat config fails.
- **Fix:** Bridged the eslintrc ruleset into flat config via `@eslint/eslintrc` `FlatCompat` (`compat.config({ extends: ['next/core-web-vitals'] })`).
- **Files modified:** apps/web/eslint.config.mjs
- **Verification:** `pnpm --filter web lint` runs non-interactively and exits 0.
- **Committed in:** a157ef3 (Task 1 commit)

**2. [Rule 2 - Missing Critical] Lint hard-failed on 4 pre-existing errors**
- **Found during:** Task 1 (ESLint config)
- **Issue:** First lint run exited 1 — a legacy `<a href="/">` and three "rule definition not found" errors from stale inline `@typescript-eslint/no-explicit-any` disables. The lint gate must not fail on pre-existing style (Pitfall 5).
- **Fix:** Downgraded `no-html-link-for-pages` to `warn`, registered `@typescript-eslint/no-explicit-any` as `off` (so the inline directives resolve to a known rule), and set `eslint.ignoreDuringBuilds:true` in next.config.ts.
- **Files modified:** apps/web/eslint.config.mjs, apps/web/next.config.ts
- **Verification:** `pnpm --filter web lint` exits 0 (warnings only); `pnpm --filter web build` exits 0.
- **Committed in:** a157ef3 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing-critical config)
**Impact on plan:** Both necessary to satisfy the plan's own "must not hard-fail on pre-existing style" constraint. No scope creep — only the ESLint config + next.config.ts touched; `lib/theme.test.ts` (out of scope) was NOT edited, its stale directives are handled by the `off` rule registration.

## Issues Encountered
- The `pnpm add` of `eslint` + `eslint-config-next` took ~5.5 min (large transitive tree); an earlier background attempt did not persist, so the install was re-run synchronously in the foreground to completion.

## Verification (all foreground, all green)
- `pnpm --filter web typecheck` → exit 0 (was 17 errors)
- `pnpm --filter web lint` → exit 0 (non-interactive, warnings only)
- `pnpm --filter web test` → 443 passed | 13 todo (baseline held)
- `pnpm --filter web build` → exit 0, emits `○ /icon.svg` route

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Web deployment-hardening code fixes for D-10/D-11/D-12 complete. Plan 29-05 (if present) or phase verification can proceed.
- No blockers. Lint is now a usable dev/CI gate; future work can tighten rules incrementally without breaking the build.

## Self-Check: PASSED

- Created files present: apps/web/eslint.config.mjs, apps/web/app/icon.svg, 29-04-SUMMARY.md
- Task commits present: cf87aa8 (D-11), d12b2d5 (D-12), a157ef3 (D-10)

---
*Phase: 29-deployment-hardening-code-fixes*
*Completed: 2026-07-04*
