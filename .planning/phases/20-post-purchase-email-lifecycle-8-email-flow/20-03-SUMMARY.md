---
phase: "20"
plan: "03"
subsystem: "email-lifecycle"
tags: ["convex", "email-flow", "scheduling", "idempotency", "crons"]
dependency_graph:
  requires: ["20-01 (emailSends schema)", "20-02 (emailSubscribers + provider + offsets)"]
  provides: ["enqueueEmailFlow mutation", "sendEmailStep action", "sweepStaleSends action", "hourly cron", "renderEmailStep seam"]
  affects: ["stripeOrders.insert (wired)", "emailSends rows lifecycle", "convex/crons.ts"]
tech_stack:
  added:
    - "resend ^6.12.4 (packages/emails + convex node_modules)"
    - "@types/node ^22.0.0 (convex + packages/emails devDeps)"
  patterns:
    - "Convex internalMutation/internalQuery/internalAction separation"
    - "\"use node\" directive for Node.js runtime in emailActions.ts"
    - "Web Crypto (crypto.getRandomValues) for token generation in mutation runtime"
    - "Pure helper inlining to avoid bundler-hostile transitive deps in mutation files"
    - "convex.json externalPackages=[\"resend\"] for Node.js action bundle"
    - "cronJobs().hourly() for sweep scheduling"
key_files:
  created:
    - "convex/emailActions.ts — sendEmailStep + sweepStaleSends internalActions"
    - "convex/crons.ts — hourly sweep at :30 UTC"
    - "packages/emails/src/render.tsx — renderEmailStep seam (placeholder)"
    - "packages/emails/src/charity.ts — pure GROQ builders (Task 1)"
    - "packages/emails/src/enqueuePlan.ts — planEnqueue pure helper (Task 1)"
    - "apps/web/__tests__/email-charity-queries.test.ts — 22 tests"
    - "apps/web/__tests__/email-enqueue-missing-email.test.ts — 7 tests"
  modified:
    - "convex/emailFlow.ts — enqueueEmailFlow + getOrder (Task 2)"
    - "convex/emailSends.ts — listStaleScheduled internalQuery"
    - "convex/stripeOrders.ts — fire-and-forget enqueue hook"
    - "convex/convex.json — externalPackages=[\"resend\"]"
    - "convex/package.json — @eisenbalm/emails workspace dep + resend + @types/node"
    - "packages/emails/package.json — resend dep + @types/node devDep"
    - "packages/emails/src/index.ts — exports render, charity, enqueuePlan"
decisions:
  - "Inlined planEnqueue + offsetForStep into emailFlow.ts instead of importing from @eisenbalm/emails barrel — barrel transitively pulls node:crypto + resend into mutation runtime which is not Node.js; runtime behavior identical"
  - "generateToken() uses Web Crypto API (crypto.getRandomValues) not node:crypto — works in Convex mutation runtime without \"use node\""
  - "render.tsx seam returns placeholder HTML from day 1 — Plan 20-04 wires actual templates; the .tsx extension is intentional for JSX support later"
  - "SUBJECTS[step] cast to string — index access on string[] returns string|undefined in TS; steps 1-8 are always valid so the cast is safe"
  - "resend added to packages/emails/package.json (not just convex) — esbuild resolves transitive imports from the workspace package's own node_modules"
metrics:
  duration: "~3h (including multi-session context resume)"
  completed: "2026-06-05"
  tasks_completed: 3
  tasks_total: 3
  files_created: 7
  files_modified: 9
  tests_passing: 29
---

# Phase 20 Plan 03: Convex Flow Engine Summary

Convex scheduling engine for the 8-email post-purchase lifecycle: `stripeOrders.insert` → `enqueueEmailFlow` → 8 `sendEmailStep` actions at purchase-anchored offsets (0d, 1d, 4d, 7d, 9d, 14d, 21d, 42d), each recorded as an idempotent `emailSends` row.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Pure helpers + TDD green | `c71f7fe` | charity.ts, enqueuePlan.ts, 2 test files |
| 2 | enqueueEmailFlow + stripeOrders hook | `b687e91` | emailFlow.ts, stripeOrders.ts, emailSends.ts |
| 3 | sendEmailStep + sweepStaleSends + crons + render seam | `8898968` | emailActions.ts, crons.ts, render.tsx |

## Verification

- `convex dev --once`: PASS (clean deploy, no TypeScript errors)
- `vitest run` (29 tests): PASS
  - `email-charity-queries.test.ts`: 22/22
  - `email-enqueue-missing-email.test.ts`: 7/7

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Convex bundler can't import @eisenbalm/emails barrel in mutation runtime**
- **Found during:** Task 2
- **Issue:** `emailFlow.ts` (internalMutation = not Node.js runtime) imported from `@eisenbalm/emails` barrel. Barrel re-exports `token.ts` (uses `node:crypto`) and `provider.ts` (uses `resend`). Both fail in non-Node.js Convex mutation runtime.
- **Fix:** Inlined `planEnqueue`, `offsetForStep` offsets array directly into `emailFlow.ts`. Created `generateToken()` using `crypto.getRandomValues` (Web Crypto API, available in all Convex runtimes). Added inline comment citing the deviation.
- **Files modified:** `convex/emailFlow.ts`
- **Commit:** `b687e91`

**2. [Rule 3 - Blocking] resend not resolved from packages/emails/src/provider.ts**
- **Found during:** Task 3
- **Issue:** Even with `convex.json` `externalPackages: ["resend"]`, esbuild resolved `provider.ts` from the workspace package's local path. `resend` wasn't in `packages/emails/node_modules`, only in `convex/node_modules`.
- **Fix:** Added `"resend": "^6.12.4"` to `packages/emails/package.json` dependencies; ran `pnpm install`.
- **Files modified:** `packages/emails/package.json`, `pnpm-lock.yaml`
- **Commit:** `8898968`

**3. [Rule 1 - Bug] SUBJECTS[step] type widened to string|undefined**
- **Found during:** Task 3 (TypeScript compile error at deploy)
- **Issue:** TypeScript infers `string[]` index access as `string | undefined`. The `subject` field of `SendEmailParams` requires `string`.
- **Fix:** Cast `SUBJECTS[step] as string` — steps 1-8 are always valid, the cast is safe.
- **Files modified:** `convex/emailActions.ts`
- **Commit:** `8898968`

**4. [Rule 2 - Missing functionality] @types/node absent from convex + packages/emails devDeps**
- **Found during:** Task 3 (TypeScript compile errors for `process`, `node:crypto`)
- **Issue:** Neither `convex/package.json` nor `packages/emails/package.json` declared `@types/node`. After adding `resend` as a real dep, the TS compiler needed node types.
- **Fix:** Added `"@types/node": "^22.0.0"` to devDependencies in both packages.
- **Files modified:** `convex/package.json`, `packages/emails/package.json`
- **Commit:** `8898968`

## Known Stubs

- `packages/emails/src/render.tsx` — `renderEmailStep` returns `<p>step N</p>` placeholder. Intentional: Plan 20-04 wires the actual React Email templates. The stub lets the full scheduling pipeline be tested end-to-end before templates exist.

## Self-Check: PASSED
