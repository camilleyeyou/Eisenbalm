---
phase: 27
plan: 00
subsystem: money-notifications
tags: [contract, finance, notifications, stripe, slack, vitest, scaffold]
requires:
  - docs/API_CONTRACTS.md (existing §1–§26 conventions)
  - convex/schema.ts (frozen stripeOrders, model_pricing shapes)
  - packages/emails/src/provider.ts (SendEmailProvider seam)
provides:
  - "API_CONTRACTS §27 — finance/payouts/notifications/slack contract (source of truth for Wave 1+)"
  - "STRIPE_SECRET_KEY in Convex env (RCN-01 prerequisite; set by human)"
  - "@/lib/finance/reconcile import-path contract (Wave 2 implements)"
  - "@/lib/finance/staleness import-path contract (Wave 2 implements)"
  - "@/lib/notifications/dispatch import-path contract (Wave 2 implements)"
affects:
  - 27-01-additive-schema
  - 27-02-finance-backend
  - 27-03-notifications-backend
  - 27-04-finance-ui
  - 27-05-notification-settings-ui
tech-stack:
  added: []
  patterns:
    - "Contract-first (D-14): §27 written before any schema/code"
    - "Wave 0 RED scaffold: tests assert against not-yet-existing helper import paths"
key-files:
  created:
    - apps/web/__tests__/stripe-reconciliation.test.ts
    - apps/web/__tests__/notifications-ledger.test.ts
    - apps/web/__tests__/model-pricing-staleness.test.ts
    - .planning/phases/27-money-notifications/27-00-SUMMARY.md
  modified:
    - docs/API_CONTRACTS.md
decisions:
  - "Slack provider reuses SendEmailProvider seam (D-02) — no second send path, no new npm dep"
  - "stripeFee fetched via sessionId path (no paymentIntentId field exists; D-08), API version 2025-04-30.basil"
  - "Staleness boundary is inclusive at exactly 30 days (NOT stale at 30d, stale at >30d)"
metrics:
  duration_min: 16
  tasks: 3
  files: 5
  completed: "2026-06-24"
---

# Phase 27 Plan 00: Contract, Env, Test Scaffold Summary

Established the Phase 27 foundation: a contract-first §27 in `docs/API_CONTRACTS.md` (finance queries, payouts table + mutations, notifications ledger + config keys, Slack provider), the `STRIPE_SECRET_KEY` Convex-env prerequisite, and three Wave 0 RED Vitest scaffolds that pin the helper import-path contracts Wave 2 will implement.

## What Was Built

**Task 1 — `docs/API_CONTRACTS.md` §27 (D-14 contract-first).** Appended a new top-level `## 27. Money + Notifications (Phase 27)` section with six sub-sections:
- **§27.1 Finance queries (RCN-01):** `finance:perIssueRevenue` per-issue shape; gross = `sum(amountTotal)`, net = `sum(donationAmount)`, fee = `sum(stripeFee)`; computed from actuals NEVER `model_pricing`; sales-window attribution `[publishedAt, nextPublishedAt)` by `charitySlug` (open window for latest issue via `?? Date.now()`); "Unattributed orders" fallback bucket (D-10).
- **§27.2 Stripe fee reconciliation (RCN-01, D-08):** sessionId-path fetch (`checkout.sessions.retrieve` with `payment_intent.latest_charge.balance_transaction` expand), `balance_transaction.fee` in cents, API version `2025-04-30.basil`; additive `stripeOrders.stripeFee: v.optional(v.number())` cache; STRIPE_SECRET_KEY must be in Convex env.
- **§27.3 `payouts` table + mutations (RCN-02, D-11/D-12):** additive table with `by_workspace_issueNumber` / `by_workspace_status` indexes; `payouts:markPayoutSent` Clerk-JWT-guarded + audit-logged (`action: 'payout:markSent'`); `payouts:listByWorkspace` query.
- **§27.4 `notificationsLedger` table + config keys (NTF-01/02, D-06/D-07):** additive table with `by_runId_eventType_channel` / `by_workspace_createdAt` indexes; idempotency key `(runId|eventKey, eventType, channel)`; two-step insertScheduled/markSent/markFailed/markSkipped; six `pipeline_config` keys.
- **§27.5 Dispatch seams (D-01/D-04/D-05):** Convex-origin, `scheduler.runAfter(0, …)`; complete/failed/awaiting-review from `pipelineRuns:updateStatus`, budget from `deliberationEvents:insert` on `cost-warning`; `deliberationEvents.eventType` union stays FROZEN.
- **§27.6 Slack provider (NTF-01, D-02):** `SlackWebhookProvider implements SendEmailProvider` in `packages/emails/src/slackProvider.ts`; native `fetch`, no new npm; `selectSlackProvider(webhookUrl)`.
- Closing frozen-shapes note listing `stripeOrders` (except additive `stripeFee`), `model_pricing`, `emailSends`, `deliberationEvents.eventType` as unchanged.

**Task 2 — STRIPE_SECRET_KEY in Convex env (human-action checkpoint).** Completed by the human (operator). The plan correctly surfaced this as a blocking auth gate — the executor cannot set the real test-mode secret. The human copied the test-mode key from `apps/web/.env.local` and ran `npx convex env set STRIPE_SECRET_KEY sk_test_...` against the `modest-magpie-797` deployment; `npx convex env list` now shows `STRIPE_SECRET_KEY`. No secret was committed to any file.

**Task 3 — Three Wave 0 Vitest RED scaffolds.** Created under `apps/web/__tests__/`, mirroring `issue-page-typography.test.ts` conventions (`describe`/`it`, `vitest` imports, ASCII section headers):
- `stripe-reconciliation.test.ts` → `@/lib/finance/reconcile` (`reconcileIssue`, `attributeOrderToWindow`): gross/net/fee aggregation, the `gross − fee === net` identity on the `899 = 850 + 49` fixture, open-window attribution, inclusive lower bound, and the unattributed bucket.
- `notifications-ledger.test.ts` → `@/lib/notifications/dispatch` (`decideDispatch`): idempotency no-op on a `sent` ledger row, config-flag-off skip, per-channel (email+slack) dispatch, and `cost-warning → 'budget'` mapping.
- `model-pricing-staleness.test.ts` → `@/lib/finance/staleness` (`isStale`, `THIRTY_DAYS_MS`): inclusive 30-day boundary (NOT stale at exactly 30d / <30d, stale at >30d).

## Verification

- Task 1 automated verify printed `CONTRACT_OK`; all 17 acceptance tokens present (`notificationsLedger`, `payouts`, `markPayoutSent`, `stripeFee`, all six `notify_*` keys, `SlackWebhookProvider`, `selectSlackProvider`, `balance_transaction`, `2025-04-30.basil`, `Unattributed`, `additive`, `deliberationEvents.eventType`); `## 27.` count = 1.
- Task 3 automated verify printed `TESTS_SCAFFOLDED` (all three files exist + reference their helper functions).
- The three scaffolds are RED-by-design: `npx vitest run` on them fails with "Cannot find package '@/lib/finance/reconcile'" etc. — the intended unresolved-import contract for Wave 2.
- Full `apps/web` suite: **43 files passed (417 tests), only the 3 new RED scaffolds failed** — no collateral breakage.

## Deviations from Plan

None — plan executed exactly as written. Rules 1–3 were not triggered; Task 2 surfaced as the planned `checkpoint:human-action` gate and was resolved by the human before resume.

## Authentication Gates

**Task 2 (STRIPE_SECRET_KEY in Convex env) — normal flow, not a failure.** Surfaced as a `checkpoint:human-action` gate per the plan. The executor stopped, returned a structured checkpoint, and the human set the key into the `modest-magpie-797` Convex deployment (verified via `npx convex env list`). The executor did NOT fabricate, set, or re-verify the secret itself.

## Notes for Downstream Plans

- Wave 2 (27-02, 27-03) MUST implement the three helper modules at the exact import paths these tests assert (`apps/web/lib/finance/reconcile.ts`, `apps/web/lib/finance/staleness.ts`, `apps/web/lib/notifications/dispatch.ts`) to turn the scaffolds GREEN. The function signatures used in the tests (argument objects, return shapes) are the binding contract.
- All Wave 1+ schema/code implements against §27 — do not deviate from the documented shapes without amending the contract first (D-14).
- `stripeFee` is the only additive `stripeOrders` field; all other Phase 27 schema work is new tables (`payouts`, `notificationsLedger`).

## Self-Check: PASSED

All created files present on disk (API_CONTRACTS.md, 3 test scaffolds, SUMMARY.md). Both per-task commits confirmed in git history (`f69fb2c`, `0f48765`).
