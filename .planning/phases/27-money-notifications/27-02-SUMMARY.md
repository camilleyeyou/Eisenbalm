---
phase: 27-money-notifications
plan: 02
subsystem: finance-reconciliation
tags: [convex, finance, reconciliation, payouts, stripe-fees, vitest, tdd, RCN-01, RCN-02]
requires:
  - "docs/API_CONTRACTS.md §27.1–§27.3 (contract of record)"
  - "convex/schema.ts payouts table + stripeOrders.stripeFee (27-01)"
  - "convex/auditLog.ts write internalMutation (Phase 23 AUD-01)"
provides:
  - "apps/web/lib/finance/reconcile.ts — reconcileIssue + attributeOrderToWindow pure helpers"
  - "apps/web/lib/finance/staleness.ts — isStale + THIRTY_DAYS_MS"
  - "convex/finance.ts — perIssueRevenue query + getOrderForFee + cacheFee"
  - "convex/financeActions.ts — fetchFeeForOrder (use node) internalAction"
  - "convex/payouts.ts — markPayoutSent (guarded+audited) + listByWorkspace + upsertForIssue"
affects:
  - "Wave 3 finance dashboard UI (consumes finance:perIssueRevenue + payouts:listByWorkspace)"
  - "Wave 3 mark-sent UI (calls payouts:markPayoutSent)"
  - "Fee backfill caller (schedules internal.financeActions.fetchFeeForOrder per order)"
tech-stack:
  added:
    - "stripe@^21.0.0 in convex workspace (required by the fee-fetch internalAction)"
  patterns:
    - "TDD GREEN against Wave 0 RED scaffolds (reconcileIssue/attributeOrderToWindow/isStale)"
    - "Node-runtime internalAction isolated to its own use-node module (financeActions.ts) so finance.ts can keep its query/mutations"
    - "Write-once additive cache (stripeOrders.stripeFee) via internalMutation"
    - "Clerk-JWT guard + internal.auditLog.write before/after pattern mirrored from pipelineConfig.setAutoPublish"
    - "Reconciliation computed from actuals only (stripeOrders), never model_pricing (D-08)"
key-files:
  created:
    - "apps/web/lib/finance/reconcile.ts"
    - "apps/web/lib/finance/staleness.ts"
    - "convex/finance.ts"
    - "convex/financeActions.ts"
    - "convex/payouts.ts"
  modified:
    - "convex/package.json (added stripe dep)"
decisions:
  - "Split the Stripe fee internalAction into convex/financeActions.ts (use node) — Convex forbids a query/mutation in a use-node module, so perIssueRevenue + getOrderForFee + cacheFee stay in finance.ts and only fetchFeeForOrder lives in the node module. The public query name finance:perIssueRevenue is preserved; the action's path is financeActions:fetchFeeForOrder."
  - "reconcileIssue signature is (orders, fees) where fees is a sessionId→cents map (matches the Wave 0 scaffold), not the plan's (orders) sketch — the test fixtures are the contract."
  - "feeCents is null when ANY contributing order's fee is uncached (poison-the-sum), matching the scaffold + §27.1; perIssueRevenue mirrors this per-window."
  - "Added stripe@^21.0.0 to convex deps (Rule 3 — blocking dependency: the fee action could not bundle without it)."
  - "D-10 window attribution is reimplemented inline in convex/finance.ts (Convex cannot import from apps/web); kept in sync with apps/web/lib/finance/reconcile.ts."
metrics:
  duration: 8 min
  tasks: 3
  files: 6
  completed: 2026-06-24
requirements: [RCN-01, RCN-02]
---

# Phase 27 Plan 02: Finance Reconciliation + Payout Tracking Backend Summary

Built the RCN-01/RCN-02 backend: pure reconciliation/staleness helpers in `apps/web` (turning the Wave 0 RED scaffolds GREEN, 16/16), a Convex `finance.ts` per-issue revenue query computed from actual `stripeOrders` rows (gross from `amountTotal`, net from `donationAmount`, fee from the cached `stripeFee` — never from `model_pricing`, D-08), a Node-runtime Stripe fee internalAction that fetches via the sessionId/`balance_transaction.fee` path and caches additively write-once, and a Clerk-JWT-guarded, audit-logged `payouts.ts` mark-sent + list + idempotent upsert.

## What Was Built

**Task 1 — Pure helpers (RCN-01, D-13).** `apps/web/lib/finance/reconcile.ts` exports `reconcileIssue(orders, fees)` (gross/net/fee aggregation; `feeCents` null if any contributing fee is uncached; the `gross − fee === net` identity holds on clean sets) and `attributeOrderToWindow(order, issues, now)` (D-10 sales-window attribution by `charitySlug` + `createdAt ∈ [publishedAt, nextPublishedAt)`, latest window open to `now`, unmatched → `unattributed` bucket). `apps/web/lib/finance/staleness.ts` exports `THIRTY_DAYS_MS` and `isStale(updatedAt, now)` (`now - updatedAt > THIRTY_DAYS_MS`; exactly 30 days → false). Both Wave 0 scaffolds pass (16/16).

**Task 2 — Finance Convex backend (RCN-01).** `convex/finance.ts` (`perIssueRevenue` query + `getOrderForFee` internalQuery + `cacheFee` internalMutation) and `convex/financeActions.ts` (`fetchFeeForOrder` internalAction, `"use node"`). `perIssueRevenue` reads all `stripeOrders`, attributes each to a published-issue window (caller passes the issue list from Sanity), and returns per-issue `{ issueNumber, issueId, charitySlug, charityName, windowStart, windowEnd, orderCount, grossCents, netCents, feeCents }` plus an `unattributed` bucket. `fetchFeeForOrder` retrieves the Checkout Session (`expand: ['payment_intent.latest_charge.balance_transaction']`, apiVersion `2025-04-30.basil`), extracts `balance_transaction.fee`, and caches it write-once via `cacheFee`.

**Task 3 — Payout tracking (RCN-02).** `convex/payouts.ts`: `markPayoutSent` (Clerk-JWT guard → `Unauthorized`; double-send guard → `Payout not found or already sent`; patches status/sentAt/reference/actor/updatedAt; audit-logs via `internal.auditLog.write` with `action: 'payout:markSent'` + before/after JSON), `listByWorkspace` (rows by `by_workspace_issueNumber`), and `upsertForIssue` (idempotent pending row per `workspace_id`+`issueNumber`, never overwrites a sent row).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Split the Node-runtime fee action into its own module**
- **Found during:** Task 2
- **Issue:** The plan's verify expects `perIssueRevenue`, `fetchFeeForOrder`, and `"use node"` all in `convex/finance.ts`. Convex rejects this: a `"use node"` module may only export actions (`cacheFee` mutation in a node file errors with `InvalidModules: Only actions can be defined in Node.js`).
- **Fix:** Kept `perIssueRevenue` + `getOrderForFee` + `cacheFee` in non-node `convex/finance.ts` (preserving the contract name `finance:perIssueRevenue`); moved `fetchFeeForOrder` into a new `"use node"` `convex/financeActions.ts`. The action path is `financeActions:fetchFeeForOrder`. All §27.2 specifics (`2025-04-30.basil`, `balance_transaction`, sessionId path) live in `financeActions.ts`.
- **Files modified:** convex/finance.ts, convex/financeActions.ts
- **Commit:** c0d4dbd

**2. [Rule 3 - Blocking] Added `stripe` to the convex workspace**
- **Found during:** Task 2
- **Issue:** `convex codegen` failed with `Could not resolve "stripe"` — the fee action imports the SDK but `convex/package.json` had no `stripe` dependency.
- **Fix:** Added `"stripe": "^21.0.0"` (matching `apps/web`) to `convex/package.json` and installed it.
- **Files modified:** convex/package.json, pnpm-lock.yaml
- **Commit:** c0d4dbd

**3. [Rule 1 - Bug] TS strict undefined on array index**
- **Found during:** Task 2
- **Issue:** `sorted[i + 1].publishedAt` failed `tsc` under `noUncheckedIndexedAccess`-style strictness (`Object is possibly 'undefined'`).
- **Fix:** Destructured `const next = sorted[i + 1]` and guarded `next ? next.publishedAt : null`.
- **Files modified:** convex/finance.ts
- **Commit:** c0d4dbd

## Authentication Gates

None.

## Verification

- `cd apps/web && npx vitest run __tests__/stripe-reconciliation.test.ts __tests__/model-pricing-staleness.test.ts` → 2 files, 16 tests, all GREEN.
- `npx convex codegen` (from `convex/`) → clean (push + bundle + `tsc` all pass) with finance.ts, financeActions.ts, payouts.ts.
- Acceptance greps for all three tasks pass (exports, guards, audit action, apiVersion, balance_transaction, use-node directive). No actual `model_pricing` reads in finance.ts (the 3 grep hits are D-08 documentation comments).
- `payouts:markPayoutSent` guard + audit is a manual Convex-dashboard verify per VALIDATION.md row 27-02-PAYOUT (deferred to operator).

## Known Stubs

None — all helpers and Convex functions are fully wired against real `stripeOrders` data, the Stripe API, and `internal.auditLog.write`.

## Self-Check: PASSED

Files verified present: apps/web/lib/finance/reconcile.ts, apps/web/lib/finance/staleness.ts, convex/finance.ts, convex/financeActions.ts, convex/payouts.ts.
Commits verified: e07cc92 (helpers), c0d4dbd (finance backend), 2980b4f (payouts).
