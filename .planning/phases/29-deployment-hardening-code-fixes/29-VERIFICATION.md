---
phase: 29-deployment-hardening-code-fixes
verified: 2026-07-04T06:57:05Z
status: passed
score: 13/13 must-haves verified (D-1 through D-13)
---

# Phase 29: Deployment Hardening Code Fixes Verification Report

**Phase Goal:** Close the code-track blockers from the 2026-07-03 pre-production audit — security-critical (D-1 Convex mutation auth lockdown, D-2 pipeline fail-closed auth, D-3 constant-time compare, D-4 restart reconciliation) plus mechanical cleanups (D-5..D-13).
**Verified:** 2026-07-04T06:57:05Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths / Must-Haves (D-1..D-13)

| # | Decision | Status | Evidence |
|---|----------|--------|----------|
| 1 | D-1 Convex auth lockdown | ✓ VERIFIED | `convex/lib/auth.ts` exists with `requireOperator`, `requirePipelineSecret`, `requireOperatorOrPipeline`, `requireWebhookSecret` (all constant-time via `constantTimeEqual`). Dashboard mutations (`promptVersions.ts`, `pipelineConfig.ts`, `agents.ts`, `claimChecks.ts`, `charities.ts`) call `requireOperator`. Pipeline/webhook mutations (`pipelineRuns.ts`, `runs.ts`, `deliberationEvents.ts`, `agentVotes.ts`, `pitchLog.ts`, `claimChecks.ts`, `reviewActions.ts`, `auditLog.ts`, `charities.ts`, `stripeEvents.ts`, `stripeOrders.ts`) call `requirePipelineSecret`/`requireOperatorOrPipeline`/`requireWebhookSecret` — none are `internalMutation` (grep for `internalMutation` in all touched files = 0, except pre-existing unrelated `auditLog.ts:write`). `qaCorrections.insert` confirmed public/unguarded by design (GAM-05), with a documented comment and 2000-char defensive cap; excluded from the pipeline secret-injection allowlist. `convex_client.py`'s `_PIPELINE_SECRET_GUARDED_PATHS` is a scoped frozenset (18 paths) that explicitly excludes `qaCorrections:insert` and `agentRuns:*`. `apps/web/lib/stripe/handlers.ts` sends `webhookSecret: process.env.STRIPE_TO_CONVEX_SECRET` on both `stripeEvents.claim` and `stripeOrders.insert` calls. |
| 2 | D-2 pipeline fail-closed auth | ✓ VERIFIED | `api/auth.py` has `_deployed()` (checks `RAILWAY_ENVIRONMENT_NAME`) and `assert_deployed_secrets()` (raises `RuntimeError` if `PIPELINE_TRIGGER_SECRET`/`CLERK_JWT_ISSUER_DOMAIN` missing in a deployed env). `main.py` calls `assert_deployed_secrets()` at line 64, BEFORE the `try:` at line 73 (confirmed by direct read) — cannot be swallowed by the degraded-boot except block. `require_clerk_jwt` raises HTTP 500 when deployed + secret unset, only falls back to the `local-dev-operator` sentinel when `_deployed()` is false. |
| 3 | D-3 constant-time compare | ✓ VERIFIED | `api/runs.py` line 154: `if not provided or not hmac.compare_digest(provided, expected):` — no bare `!=` comparison on the secret remains (grep for literal `provided != expected` in the file returns nothing beyond a comment referencing the old pattern). |
| 4 | D-4 restart reconciliation | ✓ VERIFIED | `api/reconcile.py` exists; `reconcile_orphaned_runs()` queries `runs:listForWorkspace`, finds rows with `status == "running"`, calls existing `runs:updateStatus` + `pipelineRuns:updateStatus` mutations (no new Convex table/function — confirmed via file read, no `internalMutation` or schema keywords). Wired into `main.py` lifespan on the clean-boot path (line 106), after `convex_client.set_client()`, before `yield`. Degrades to warning + 0 on Convex failure, never blocks boot. |
| 5 | D-5 pipeline deps | ✓ VERIFIED | `pyproject.toml` declares `"pyjwt>=2.8.0"` and `"requests>=2.31.0"` directly in `[project.dependencies]` (lines 23-24). |
| 6 | D-6 stale Supabase→Railway env docs | ✓ VERIFIED | `grep -rn "pooler.supabase.com\|Supabase session pooler"` across `.env.example`, `checkpointer.py`, `cli.py` returns zero matches. |
| 7 | D-7 remove public /_debug/convex route | ✓ VERIFIED | `apps/web/app/%5Fdebug/` does not exist on disk (confirmed via `ls`). `robots.txt` has no `/_debug` entry. `debug-route.test.ts` now asserts absence (`existsSync(...) === false`) rather than existence. |
| 8 | D-8 remove dead Convex subs + update 3 tripwires | ✓ VERIFIED | `DeliberationSlot.tsx` contains zero occurrences of `useQuery`, `byRunId`, `convex/react`, `MOCK_ISSUE` (grep returns no matches). `IssueLayout.tsx` still renders `<DeliberationSlot>` from Sanity-sourced props. All 3 tripwire tests (`deliberation-subscriptions.test.ts`, `machine-editorial-components.test.ts`, `motion-polish.test.ts`) updated to assert the inverted "zero subs" contract. |
| 9 | D-9 checkout-failure UX | ✓ VERIFIED | `BuyButton.tsx` has `useState` for `errorMessage`, renders it with `role="alert"`, exports `CHECKOUT_FAILURE_MESSAGE`, and statically imports `useShopQty` (no `require()`). `apps/web/__tests__/buy-button.test.tsx` exists and passes (4/4 tests). |
| 10 | D-10 ESLint config | ✓ VERIFIED | `apps/web/eslint.config.mjs` exists, bridges `next/core-web-vitals` via `FlatCompat`. `next.config.ts` sets `eslint.ignoreDuringBuilds: true` (accepted per task note — lint is its own advisory gate). |
| 11 | D-11 ~17 test TS errors | ✓ VERIFIED | `pnpm --filter web typecheck` re-run live: exits 0, zero errors output. |
| 12 | D-12 favicon | ✓ VERIFIED | `apps/web/app/icon.svg` exists (398 bytes, oxblood/gold monogram). `pnpm --filter web build` (re-run live) emits `○ /icon.svg` as a build route. |
| 13 | D-13 env.example/DEPLOY.md gaps | ✓ VERIFIED | `apps/dispatch-control/.env.example` has `PREVIEW_SECRET` + `NEXT_PUBLIC_WEB_PREVIEW_BASE`; `DEPLOY.md` labels `NEXT_PUBLIC_PIPELINE_URL` as "Required" (not optional) and documents both preview vars. `packages/pipeline/.env.example` has `DESIGNAGENT_SUPPRESSED=true` and `LOG_LEVEL=INFO`. |

**Score:** 13/13 must-haves verified

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| Pipeline `convex_client.py` | Convex secret-guarded mutations | `pipelineSecret` injection on `_PIPELINE_SECRET_GUARDED_PATHS` | ✓ WIRED | 18-path frozenset reconciled 1:1 against `requirePipelineSecret`/`requireOperatorOrPipeline` call sites; `agentRuns:*` and `qaCorrections:insert` correctly excluded (would break on undeclared-arg validator rejection). |
| Stripe webhook (`apps/web`) | `stripeEvents.claim`/`stripeOrders.insert` | `webhookSecret` arg | ✓ WIRED | `handlers.ts` sends `STRIPE_TO_CONVEX_SECRET` on both calls; both mutations call `requireWebhookSecret`. |
| `main.py` lifespan | `assert_deployed_secrets()` | direct call, pre-try | ✓ WIRED | Confirmed at line 64, before `try:` at line 73 — not swallowed by degraded-boot except. |
| `main.py` lifespan | `reconcile_orphaned_runs()` | direct call, clean-boot path | ✓ WIRED | Confirmed at line 106, inside the try block, after `set_client()`, before `yield`. |
| `DeliberationSlot.tsx` | Sanity content | props from `IssueLayout.tsx` | ✓ WIRED | `IssueLayout.tsx` still passes `conversation`/`candidates` Sanity-sourced props to `<DeliberationSlot>`; component renders with zero Convex subscriptions. |

### Behavioral Spot-Checks (re-run live, not just trusted from SUMMARYs)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Convex typecheck clean | `pnpm typecheck:convex` | exit 0, no output | ✓ PASS |
| Web typecheck clean (D-11) | `pnpm --filter web typecheck` | exit 0, no output | ✓ PASS |
| Web test suite green | `pnpm --filter web test` | 47 files, 443 passed / 13 todo | ✓ PASS |
| Web strict build green + favicon route | `pnpm --filter web build` | success, `○ /icon.svg` route emitted | ✓ PASS |
| Dispatch-control test suite green | `pnpm --filter dispatch-control test` | 24 files passed / 1 skipped, 129 passed / 2 todo | ✓ PASS |
| Pipeline pytest green | `cd packages/pipeline && uv run pytest -q` | 372 passed, 33 skipped | ✓ PASS |
| No stale `provided != expected` compare | grep `runs.py` | `hmac.compare_digest` present, no bare `!=` on secret | ✓ PASS |
| No stale Supabase pooler guidance | grep across 3 files | 0 matches | ✓ PASS |
| Debug route absent | `ls apps/web/app/%5Fdebug/` | "No such file or directory" | ✓ PASS |

### Requirements Coverage

No formal REQUIREMENTS.md IDs map to this phase (per task instructions); verified against the D-1..D-13 must_haves in 29-CONTEXT.md and the 5 plan SUMMARY files instead. All 13 items independently confirmed against the actual codebase (not merely trusted from summaries) — see table above. All 14 task commits referenced in the 5 SUMMARY files (`8f63e23`, `d6342a2`, `3c8007a`, `1b23588`, `12a3888`, `751309e`, `5ee48b7`, `9188607`, `5866736`, `cf87aa8`, `d12b2d5`, `a157ef3`, `9116ba7`, `d697342`) are present in `git log`.

### Anti-Patterns Found

None blocking. Notes:
- D-10's `eslint.ignoreDuringBuilds: true` is an explicitly accepted decision per the task brief (lint is its own gate; typecheck still enforced) — not a gap.
- `qaCorrections.insert` remaining unguarded is intentional (GAM-05 anonymous game-validator reporter), documented in-code, and explicitly called for by 29-RESEARCH.md/29-CONTEXT.md — not a gap.
- External secret provisioning (real values for `PIPELINE_CONVEX_SECRET`, `STRIPE_TO_CONVEX_SECRET` on Convex/Railway/Vercel) and the manual Railway boot-assertion smoke test are correctly out of scope per the task brief — the code ships fail-closed and doc-only for these.

### Human Verification Required

Per 29-VALIDATION.md's own "Manual-Only Verifications" section (unaffected by this verification pass, still applicable post-deploy):

1. **Favicon renders in a browser tab**
   **Test:** Load the deployed site in a browser, confirm the tab icon is the brand mark.
   **Expected:** Oxblood/gold monogram displays, `/favicon.ico`-equivalent route resolves (Next.js serves `/icon.svg`).
   **Why human:** Visual/browser-only; automated check only confirms the file exists and the build emits the route.

2. **Operator dashboard flows work end-to-end after the D-1 lockdown, live**
   **Test:** Sign into dispatch-control with a real Clerk session, edit + activate a prompt version, record a review action.
   **Expected:** No "Unauthorized" regression; writes succeed via the Clerk JWT lane.
   **Why human:** Requires a live Clerk session + deployed Convex; automated convex-test suite proves the guard logic but not the live JWT-forwarding wiring end-to-end.

3. **Post-deploy secret provisioning + fail-closed smoke test** (external punch-list, not a phase gap)
   **Test:** On Railway, confirm `RAILWAY_ENVIRONMENT_NAME` is set and deliberately leave `PIPELINE_TRIGGER_SECRET` or `CLERK_JWT_ISSUER_DOMAIN` unset on a preview deploy; confirm the service refuses to report healthy.
   **Expected:** Boot fails/refuses instead of silently degrading open.
   **Why human:** `RAILWAY_ENVIRONMENT_NAME` is only auto-injected by Railway itself; cannot be simulated locally.

### Gaps Summary

None. All 13 audit decisions (D-1 through D-13) are implemented in the actual codebase, independently confirmed by direct file reads and greps (not merely trusted from SUMMARY claims), and all automated gates re-run live during this verification pass: `pnpm typecheck:convex` (0 errors), `pnpm --filter web typecheck` (0 errors), `pnpm --filter web test` (443 passed), `pnpm --filter web build` (success, favicon route present), `pnpm --filter dispatch-control test` (129 passed), pipeline `pytest` (372 passed). The 14 task commits referenced across the 5 SUMMARY files are all present in git history. No regressions, no stubs, no orphaned wiring found.

---

*Verified: 2026-07-04T06:57:05Z*
*Verifier: Claude (gsd-verifier)*
