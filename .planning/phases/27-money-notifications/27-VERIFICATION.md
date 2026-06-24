---
phase: 27-money-notifications
verified: 2026-06-23T18:00:00Z
status: passed
score: 4/4 success criteria verified
human_verification:
  - test: "Live Stripe fee resolution end-to-end"
    expected: "fetchFeeForOrder retrieves a real balance_transaction.fee via sessionId and caches it to stripeOrders.stripeFee; the finance UI fee column flips from — to a real value"
    why_human: "Requires STRIPE_SECRET_KEY in Convex env + a real test-mode Checkout session with a settled balance transaction; cannot be exercised statically. STRIPE_SECRET_KEY is now set per the orchestrator note."
  - test: "Dashboard markPayoutSent guard + audit emission"
    expected: "Clicking Mark sent in /finance under a real Clerk session flips the row to a green Sent badge and writes a payout:markSent audit row; an unauthenticated call throws Unauthorized"
    why_human: "Requires a live Clerk JWT session in dispatch-control; the guard/audit path is code-verified but its runtime emission is operator-only."
---

# Phase 27: Money + Notifications Verification Report

**Phase Goal:** Operator can view, per issue, gross sales / Stripe fees / net-to-charity from actual Stripe API data + recorded order data; payout status per issue is tracked; `model_pricing` is labeled projection-only with a staleness indicator; operator receives Slack and/or email notifications on run complete, failed, awaiting review, and budget threshold hit.

**Verified:** 2026-06-23T18:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Finance view shows per-issue gross / Stripe fees / net-to-charity from ACTUAL stripeOrders + Stripe API, never model_pricing | ✓ VERIFIED | `convex/finance.ts:perIssueRevenue` sums gross from `amountTotal`, net from `donationAmount`, fee from cached `stripeFee`; the only model_pricing read is the explicitly-labeled `listModelPricing` projection query (D-08). `financeActions.ts:fetchFeeForOrder` fetches the real Stripe fee via sessionId + `balance_transaction` expansion. UI: FinanceSummaryCard "This Issue" anchor + IssueRevenueTable. |
| 2 | Operator can mark a payout sent (date + reference) per issue; payout status auditable at a glance across all issues | ✓ VERIFIED | `convex/payouts.ts:markPayoutSent` (Clerk-guarded, double-send rejection, audit-logged via `internal.auditLog.write` action `payout:markSent`), `listByWorkspace` powers the at-a-glance view. UI: PayoutRow inline mark-sent (no modal), Pending-yellow/Sent-green badge wired to `api.payouts.markPayoutSent`. |
| 3 | model_pricing labeled "Projection pricing" with 30-day staleness indicator | ✓ VERIFIED | `apps/web/lib/finance/staleness.ts` (`isStale`, `THIRTY_DAYS_MS`). UI: ModelPricingCard renders read-only "Projection Pricing" with amber staleness badge driven by the most-stale row's `updatedAt` against a 30-day threshold. |
| 4 | Operator receives Slack and/or email within 5 min of run complete/failed/awaiting-review/budget threshold | ✓ VERIFIED | `convex/notificationActions.ts:sendNotification` (config-gated per-event flag, per-channel email+slack, idempotent, never-throws). Seams: `pipelineRuns.ts:updateStatus` dispatches complete/failed/awaiting-review via `scheduler.runAfter(0,...)`; `deliberationEvents.ts:insert` maps `cost-warning`→`budget`. `slackProvider.ts:SlackWebhookProvider` (native fetch, no new dep). Settings UI writes notify_* keys. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Status | Details |
| --- | --- | --- |
| `convex/finance.ts` | ✓ VERIFIED | perIssueRevenue, publishedIssues, listModelPricing, getOrderForFee, cacheFee — wired to IssueRevenueTable + ModelPricingCard |
| `convex/financeActions.ts` | ✓ VERIFIED | `"use node"` fetchFeeForOrder; sessionId path + balance_transaction; write-once cache; never-throws |
| `convex/payouts.ts` | ✓ VERIFIED | markPayoutSent (guard+audit), listByWorkspace, upsertForIssue; wired to PayoutRow |
| `convex/notifications.ts` | ✓ VERIFIED | getByKey/insertScheduled/markSent/markFailed/markSkipped on by_runId_eventType_channel index (mirrors emailSends) |
| `convex/notificationActions.ts` | ✓ VERIFIED | sendNotification internalAction; config gate; ledger gate; provider send; D-05 never-throws |
| `convex/pipelineConfig.ts` | ✓ VERIFIED | setNotificationConfig (Clerk guard, per-key isolation, audit `config:set:*`) |
| `packages/emails/src/slackProvider.ts` | ✓ VERIFIED | SlackWebhookProvider implements SendEmailProvider via native fetch; exported from index.ts; no npm dep |
| `apps/web/lib/finance/reconcile.ts` | ✓ VERIFIED | reconcileIssue + attributeOrderToWindow pure helpers |
| `apps/web/lib/finance/staleness.ts` | ✓ VERIFIED | isStale + THIRTY_DAYS_MS |
| `apps/web/lib/notifications/dispatch.ts` | ✓ VERIFIED | decideDispatch (flag-off + per-channel + idempotency + budget mapping) |
| finance UI (4 components + page) | ✓ VERIFIED | FinanceSummaryCard, IssueRevenueTable, ModelPricingCard, PayoutRow all mounted in /finance page |
| NotificationSettings + settings/page | ✓ VERIFIED | Slack/Email independent blocks, 4 per-event checkboxes, mounted in settings page |

### Key Link Verification

| From | To | Via | Status |
| --- | --- | --- | --- |
| docs/API_CONTRACTS.md §27 | Wave 1+ code | contract-first (D-14) | ✓ WIRED (§27 at line 2217, written before schema) |
| schema notificationsLedger | notifications.ts | by_runId_eventType_channel | ✓ WIRED |
| schema payouts | payouts.ts + finance UI | by_workspace_issueNumber / by_workspace_status | ✓ WIRED |
| financeActions.fetchFeeForOrder | Stripe Checkout Sessions API | balance_transaction expansion | ✓ WIRED |
| payouts.markPayoutSent | auditLog.write | action payout:markSent | ✓ WIRED |
| pipelineRuns.updateStatus | notificationActions.sendNotification | scheduler.runAfter(0,...) | ✓ WIRED |
| deliberationEvents.insert (cost-warning) | sendNotification | eventType budget | ✓ WIRED |
| notificationActions | slack+resend providers | selectSlackProvider / selectProvider | ✓ WIRED |
| PayoutRow → markPayoutSent | convex/payouts.ts | useMutation(api.payouts.markPayoutSent) | ✓ WIRED |
| IssueRevenueTable → perIssueRevenue | convex/finance.ts | useQuery(api.finance.perIssueRevenue) | ✓ WIRED |
| NotificationSettings → setNotificationConfig | convex/pipelineConfig.ts | useMutation(api.pipelineConfig.setNotificationConfig) | ✓ WIRED |

### Frozen-Shape / Additivity Audit (D-04, D-14)

| Shape | Status | Evidence |
| --- | --- | --- |
| stripeOrders | ✓ Additive only | stripeFee added as `v.optional(v.number())`; all prior fields intact |
| deliberationEvents.eventType union | ✓ FROZEN | Same 9 literals as Phase 5; cost-warning reused, no new literal added |
| emailSends | ✓ Unchanged | Phase 20 shape + indices intact |
| model_pricing | ✓ Unchanged | git commit 36b6d07 (schema) touched only notificationsLedger/payouts/stripeFee; model_pricing fields untouched (comment label only) |
| notificationsLedger / payouts | ✓ New additive tables | Added with correct idempotency/status indices |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Wave 0 RED scaffolds now GREEN | `npx vitest run` (3 files) | 3 files / 23 passed | ✓ PASS |
| reconcile path has no model_pricing read | grep model_pricing reconcile.ts | only a doc comment, no code | ✓ PASS |
| No new slack npm dependency | grep slack packages/emails/package.json | none | ✓ PASS |
| convex codegen | (orchestrator) | exit 0 | ✓ PASS |
| apps/web vitest full suite | (orchestrator) | 46 files / 440 passed | ✓ PASS |
| dispatch-control next build | (orchestrator) | exit 0 | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| RCN-01 | 27-00/01/02/04 | Per-issue gross/fees/net from Stripe API + orders | ✓ SATISFIED | finance.ts + financeActions.ts + reconcile.ts + finance UI |
| RCN-02 | 27-00/01/02/04 | Payout status per issue auditable | ✓ SATISFIED | payouts.ts (guard+audit) + PayoutRow + IssueRevenueTable |
| NTF-01 | 27-00/01/03/05 | Slack/email on complete/failed/awaiting-review | ✓ SATISFIED | notificationActions + slackProvider + pipelineRuns seam + Settings UI |
| NTF-02 | 27-00/01/03/05 | Notification on budget threshold | ✓ SATISFIED | deliberationEvents cost-warning seam → budget dispatch |

No orphaned requirements: REQUIREMENTS.md maps exactly RCN-01, RCN-02, NTF-01, NTF-02 to Phase 27, all claimed by plans, all marked Complete.

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER/"not implemented" in any Phase 27 backend or UI file. The one deferred-items.md note (stripe resolution in convex codegen during parallel execution) is resolved — codegen now exits 0 (financeActions.ts isolates the Stripe import in a `"use node"` module).

### Human Verification Required

Two operator-only runtime checks (deferred per plans, not blockers):
1. **Live Stripe fee resolution** — needs a settled test-mode balance transaction; STRIPE_SECRET_KEY now set in Convex env.
2. **Dashboard markPayoutSent guard/audit emission** — needs a live Clerk session; code path verified statically.

### Gaps Summary

No gaps. All 4 ROADMAP success criteria are achieved against the actual codebase: reconciliation reads only actuals (D-08 confirmed), payouts are guarded+audited and surfaced in UI, model_pricing is projection-labeled with 30-day staleness, and the notification dispatch fires non-blocking from both seams across Slack/email with idempotency and config gating. All frozen shapes are unchanged and all additions are strictly additive (D-04/D-14). Contract-first §27 precedes the schema. The remaining items are operator-only live-service verifications, correctly deferred.

---

_Verified: 2026-06-23T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
