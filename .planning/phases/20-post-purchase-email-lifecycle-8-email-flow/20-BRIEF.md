# Phase 20 — Post-Purchase Email Lifecycle (8-email flow) — BRIEF

**Status:** Locked decisions captured pre-planning (user-confirmed 2026-06-05). Treat the LOCKED DECISIONS as non-negotiable inputs to the plan.

## Goal

Build an in-house post-purchase email lifecycle for the single-SKU Stripe store: 8 emails triggered off each completed order, in Jesse's deadpan voice, with charity personalization driven by the `charitySlug` already captured per order in Convex `stripeOrders`.

## Locked decisions (confirmed with user — do not revisit)

- **Architecture: IN-HOUSE.** React Email templates in the monorepo (`apps/web`), **Convex scheduled functions** as the timer/clock (orders already land in Convex `stripeOrders`), **Resend** as the delivery provider. No third-party marketing-automation ESP.
- **Timing: PURCHASE-ANCHORED for v1** (no fulfillment/carrier integration exists). Map the original "delivered + N" design onto "purchase + N" assuming ~4-day delivery.
- **Scope: ALL 8 emails** in this phase.

## The 8 emails + purchase-anchored schedule

| # | Email | Offset from purchase | Stream |
|---|-------|----------------------|--------|
| 1 | Order confirmation | +0 (instant) | Transactional |
| 2 | Shipping | +1 day | Transactional |
| 3 | Delivered / arrival | +4 days | Transactional |
| 4 | The ritual (teach the 3-second pause) | +7 days | Marketing |
| 5 | **Charity receipt (where the $8.99 went)** — THE ANCHOR | +9 days | Marketing |
| 6 | Review ask | +14 days | Marketing |
| 7 | **Opt-in to weekly charity newsletter (the hinge)** | +21 days | Marketing |
| 8 | Replenishment + last call | +42 days | Marketing |

Copy nuances:
- **Email 2** has NO live tracking number (we have no carrier data). Play the deadpan "handed to the carrier / another machine now knows where you live" beat without a real tracking link. Leave a clean upgrade path to real tracking later.
- **Email 3** is delivery-ESTIMATE copy; it must NEVER claim a delivery we can't verify.

## Transactional vs marketing split (legal + deliverability)

- Emails 1–3 transactional; 4–8 marketing.
- Marketing emails MUST carry: one-click unsubscribe + `List-Unsubscribe` / `List-Unsubscribe-Post` headers (Gmail/Yahoo 2024 bulk-sender rules), CAN-SPAM physical postal address footer, honest subject lines.
- Recommend separate sending subdomains: transactional (e.g. `receipts.`) vs marketing (e.g. `dispatch.`) so promo complaints don't poison receipt deliverability.
- Unsubscribe stops all marketing (4–8) but transactional (1–3) still sends. Suppression honored.

## Charity cleverness (the differentiator)

- **Emails 1–6 footer** = the specific charity THAT order funded. Resolve `stripeOrders.charitySlug` → Sanity charity doc (`name`, `location`, `focusArea`, `missionStatement`). Email 5 is the full-screen version of that footer.
- **Email 7** flips to VARIETY: 2–3 OTHER recently-featured charities (`weeklyIssue` charities != the buyer's funded one) to prove "there are more."
- **Email 8** shows a live machine-voiced count — "since you bought, a machine has quietly funded **N** more causes" — computed from `weeklyIssue`s published after the order's `createdAt`.

## Data model additions (Convex)

- `emailSubscribers` — email, consentState, source, unsubscribeToken, createdAt, unsubscribedAt.
- `emailSends` ledger — orderId/email, step, status, providerMessageId, sentAt. **IDEMPOTENT — never double-send a step.**
- Flow enqueued when a `checkout.session.completed` order is recorded (existing webhook → existing `stripeOrders`). Convex `scheduler.runAfter` + a `cron` sweep drives the delays.

## Endpoints / infra

- Next.js route `GET/POST /api/email/unsubscribe?token=...` (one-click) + `List-Unsubscribe-Post` support.
- Resend integration (`RESEND_API_KEY` secret).
- Templates via React Email + `@react-email/components` in `apps/web`.

## External dependencies (block go-live/sending, NOT the build)

- Resend account + API key.
- DNS to verify sending subdomains (SPF/DKIM/DMARC).
- Physical postal address for CAN-SPAM footer.
- Andrew's voice sign-off on the 8 copy beats — drafts ship for approval, NOT auto-send. Brand voice is the non-negotiable gate.

## Out of scope (note as next phase)

- Actually SENDING the weekly charity newsletter that email 7 opts into — v1 only CAPTURES the subscriber + consent.
- Real carrier tracking for emails 2/3 (delivered-based timing) — later upgrade.

## Success criteria

A completed test order enqueues all 8 steps; each step sends once (idempotent) at the right offset via Resend with the correct charity personalization; marketing emails carry working one-click unsubscribe that suppresses the rest of the marketing stream while leaving transactional intact; copy ships as Andrew-approvable drafts in Jesse's voice.
