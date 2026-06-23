# Phase 27: Money + Notifications - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-23
**Phase:** 27-money-notifications
**Mode:** Auto (`--auto`) — all gray areas auto-selected; recommended option chosen per question.
**Areas discussed:** Notification transport & origin, Notification triggers/timing, Notification config & dedup, Stripe reconciliation source, Per-issue order attribution, Payout tracking, model_pricing staleness view

---

## Notification transport & origin (NTF-01/02)

| Option | Description | Selected |
|--------|-------------|----------|
| Convex-side notifier reusing packages/emails + Slack webhook provider | Hang off existing `runs:updateStatus` / `cost-warning` writes; no new pipeline egress | ✓ |
| Pipeline-side (Python) Slack/email sender | New outbound HTTP from the Railway pipeline | |
| Third-party alerting service | New external dependency | |

**User's choice:** [auto] Convex-side internalAction reusing `packages/emails` `selectProvider` + new Slack incoming-webhook provider (recommended)
**Notes:** Pipeline already persists run state + budget events to Convex; transport belongs where the events already land.

---

## Notification triggers & timing

| Option | Description | Selected |
|--------|-------------|----------|
| Fire from existing Convex writes via scheduler.runAfter(0) | `runs:updateStatus` for run states; `cost-warning` event for budget | ✓ |
| Polling sweep (cron) checking run states | Periodic Convex cron diff | |

**User's choice:** [auto] Event-driven from existing writes, dispatched via `scheduler.runAfter(0)` → internalAction (recommended)
**Notes:** Near-instant; well within the 5-minute success-criterion ceiling. Reuses the frozen `cost-warning` eventType for budget.

---

## Notification config & dedup

| Option | Description | Selected |
|--------|-------------|----------|
| pipeline_config keys + idempotent notifications ledger | Per-event enable flags, recipient/webhook keys, one send per (event+channel) | ✓ |
| Hardcoded single recipient, no ledger | Simpler, no dedup guarantee | |

**User's choice:** [auto] `pipeline_config` keys (`notify_email`, `notify_slack_webhook_url`, per-event flags) + idempotent ledger mirroring `emailSends` (recommended)
**Notes:** `convex/pipelineConfig.ts:167` already marks this as the Phase 27 transport seam.

---

## Stripe reconciliation source (RCN-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Recorded stripeOrders for gross/net + Stripe API for fees | gross=`amountTotal`, net=`donationAmount`; fees from balance-transaction; never model_pricing | ✓ |
| Stripe API for everything | Re-fetch all figures live | |
| model_pricing estimates | Explicitly forbidden by success criterion 1 | |

**User's choice:** [auto] Recorded `stripeOrders` for gross/net + Stripe API balance-transaction for fees, cached; never `model_pricing` (recommended)
**Notes:** net-to-charity = `donationAmount` (the 100%-to-charity figure).

---

## Per-issue order attribution (RCN-01)

| Option | Description | Selected |
|--------|-------------|----------|
| charitySlug + createdAt within issue's published→next-published window | Resolve via weeklyIssue.charity reference | ✓ |
| Explicit issueId stamped on each order at checkout | Would require Phase 8 checkout change (out of scope) | |

**User's choice:** [auto] Attribute by `charitySlug` + `createdAt` within the issue's active sales window (recommended)
**Notes:** Surface a fallback bucket for orders outside any window; handle the latest issue (no "next") gracefully.

---

## Payout tracking (RCN-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Additive Convex payouts table keyed by issue, audit-logged | amount/status/sentAt/reference/actor; operator marks sent | ✓ |
| Reuse stripeOrders rows with a payout flag | Conflates order data with payout state | |

**User's choice:** [auto] New additive `payouts` table keyed by issue; Clerk-guarded + audit-logged mutations; dashboard status grid across all issues (recommended)
**Notes:** Phase only *tracks* payout status — does not execute disbursement.

---

## model_pricing staleness view (success criterion 3)

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only, labeled "Projection pricing (not actual cost)" + 30-day staleness badge | Existing table; no editing | ✓ |
| Editable pricing maintenance UI | Out of scope this phase | |

**User's choice:** [auto] Read-only projection label + 30-day staleness badge (recommended)
**Notes:** Editing model pricing deferred.

## Claude's Discretion

- Finance-view layout/components; Stripe-fee cache TTL/storage; Slack message formatting; notifications-ledger table vs folded-in; latest-issue sales-window boundary handling.

## Deferred Ideas

- Executing payouts (vs tracking); weekly newsletter send; carrier/shipment tracking; editing model_pricing rows; multi-currency normalization beyond display.
