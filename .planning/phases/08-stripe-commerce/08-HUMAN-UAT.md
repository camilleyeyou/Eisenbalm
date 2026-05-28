---
status: partial
phase: 08-stripe-commerce
source: [08-VERIFICATION.md]
started: 2026-05-27T19:00:00Z
updated: 2026-05-27T19:00:00Z
---

## Current Test

[awaiting Andrew — Stripe key swap + live smoke]

## Tests

### 1. Stripe Dashboard key swap (08-02 gate)
expected: `apps/web/.env.local` switched from `sk_live_…` / live `price_…` / live `whsec_…` to `sk_test_…` / test-mode `price_…` / test-mode `whsec_…` (CLI `stripe listen --forward-to localhost:3000/api/stripe/webhook` OR a test-mode webhook endpoint in the Dashboard). Live values stashed in a password manager for the real launch.
result: [pending]

### 2. Real test-mode checkout — happy path (CMR-02)
expected: Run `pnpm --filter web dev` (after #1), visit `/shop`, click BuyButton, complete checkout with Stripe test card `4242 4242 4242 4242` (any CVC, future expiry, any ZIP). Lands on `/shop/thank-you`. No console errors.
result: [pending]

### 3. Webhook forged-signature rejection (CMR-04)
expected: `curl` a forged event payload at the deployed `/api/stripe/webhook` (or local) with a bogus signature header → 4xx. With NO signature header → 400. With `STRIPE_WEBHOOK_SECRET` unset → 5xx / not 200 (no env bypass).
result: [pending]

### 4. Webhook replay / idempotency (CMR-06)
expected: With `stripe listen` forwarding, trigger one `checkout.session.completed`. Confirm the log shows fulfillment ran once and a single `stripeOrders` row appears in Convex. Replay the same event via `stripe events resend <id>`. Confirm "replay ignored" (firstTime=false) — no second order row.
result: [pending]

### 5. Legal page visual check (CMR-07 / CMR-08)
expected: Load `/legal/privacy` and `/legal/terms`. Both render on the warm-paper light base, header + footer intact, no 404, no console errors. Placeholder copy visible with `TODO(Andrew)` markers (expected — see #6).
result: [pending]

### 6. Legal copy replacement (pre-launch blocker)
expected: Andrew commissions reviewed privacy + terms copy (covers: Stripe handles payment, what data is collected, the 100%-donation model, charity attribution, contact email) and replaces the placeholder text + `[Last updated: …]` line on both pages. Verify `hello@eisenbalm.com` (currently placeholder contact) is correct or replace with Andrew's actual address.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
