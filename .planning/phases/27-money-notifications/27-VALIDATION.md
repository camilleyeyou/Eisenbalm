---
phase: 27
slug: money-notifications
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-23
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^3.2.0 |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `cd apps/web && npx vitest run --reporter=dot` |
| **Full suite command** | `cd apps/web && npx vitest run` |
| **Estimated runtime** | ~15 seconds (unit only; Convex integration is manual) |

---

## Sampling Rate

- **After every task commit:** Run `cd apps/web && npx vitest run --reporter=dot`
- **After every plan wave:** Run `cd apps/web && npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 27-00-01 | 00 | 0 | RCN-01 | unit | `cd apps/web && npx vitest run __tests__/stripe-reconciliation.test.ts` | ❌ W0 | ⬜ pending |
| 27-00-02 | 00 | 0 | NTF-01/02 | unit | `cd apps/web && npx vitest run __tests__/notifications-ledger.test.ts` | ❌ W0 | ⬜ pending |
| 27-00-03 | 00 | 0 | D-13 | unit | `cd apps/web && npx vitest run __tests__/model-pricing-staleness.test.ts` | ❌ W0 | ⬜ pending |
| 27-xx-RCN | — | — | RCN-01 | unit | `cd apps/web && npx vitest run __tests__/stripe-reconciliation.test.ts` | ❌ W0 | ⬜ pending |
| 27-xx-NTF | — | — | NTF-01/02 | unit | `cd apps/web && npx vitest run __tests__/notifications-ledger.test.ts` | ❌ W0 | ⬜ pending |
| 27-xx-PAYOUT | — | — | RCN-02 | integration (Convex) | manual — Convex dashboard / `npx convex run` | ❌ W0 | ⬜ pending |
| 27-xx-STALE | — | — | D-13 | unit | `cd apps/web && npx vitest run __tests__/model-pricing-staleness.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Task IDs above are provisional placeholders pending the planner's wave/plan breakdown. The planner MUST assign the concrete `{padded_phase}-{plan}-{task}` IDs and update this map so each task with logic (not pure UI/markup) maps to one of the three Wave 0 test files or an explicit manual-only row.*

---

## Wave 0 Requirements

- [ ] `apps/web/__tests__/stripe-reconciliation.test.ts` — stubs for RCN-01: gross (`amountTotal`) / net (`donationAmount`/`amountSubtotal`) / fee aggregation (gross − net − fee), and sales-window order attribution (`charitySlug` + `createdAt` within published→next-published window, open-window for latest issue, unattributed fallback bucket)
- [ ] `apps/web/__tests__/notifications-ledger.test.ts` — stubs for NTF-01/NTF-02: idempotency (second dispatch for same `runId/eventKey + eventType + channel` is a no-op), config-flag-off skip, per-channel dispatch selection, budget trigger reads `cost-warning` eventType
- [ ] `apps/web/__tests__/model-pricing-staleness.test.ts` — stubs for D-13: staleness computation at the 30-day threshold boundary (`updatedAt` exactly 30 days, < 30, > 30)
- [ ] Verify `STRIPE_SECRET_KEY` present in Convex env: `npx convex env list` (research flagged it is currently only in `apps/web` env — required before any finance internalAction runs)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Payout `markSent` mutation writes audit log + flips status | RCN-02 | Convex mutation with Clerk-JWT guard + `auditLog:write`; needs authenticated Convex context | From dispatch-control `/finance`, click "Mark sent" on a pending row, confirm; verify `payouts` row `status: "sent"` + `sentAt`/`reference` set and a matching `auditLog` entry exists via Convex dashboard |
| Slack/email notification actually delivered end-to-end | NTF-01 | External HTTP egress (Resend / Slack webhook) — `internalAction` side effect not unit-testable without live transport | Trigger a run status change (or budget threshold) with a configured channel; confirm message arrives in Slack channel / inbox within 5 min and ledger row marked `sent` |
| Stripe fee fetched from live (test-mode) Stripe API | RCN-01 | Requires real Stripe API call against test-mode keys; unit test mocks the SDK | With `STRIPE_SECRET_KEY` set in Convex env, load `/finance`; confirm fee column resolves from `—` to an actual figure for a real test order |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies or an explicit manual-only row
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (3 test files + Stripe env check)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
