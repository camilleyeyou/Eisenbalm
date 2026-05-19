---
phase: 8
slug: stripe-commerce
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-19
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (already installed; Phase 7 Plan 07-01) |
| **Config file** | `apps/web/vitest.config.ts` (exists; uses `vite-tsconfig-paths`) |
| **Quick run command** | `pnpm --filter web test:unit` |
| **Full suite command** | `pnpm --filter web test:unit` (single suite; no e2e in v1) |
| **Estimated runtime** | ~30 seconds (existing 27 tests + ~8 new files) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test:unit`
- **After every plan wave:** Run `pnpm --filter web test:unit`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD by planner | TBD | 0 | CMR-01 | integration | `pnpm --filter web test:unit __tests__/shop-page.test.ts` | ❌ W0 | ⬜ pending |
| TBD by planner | TBD | 0 | CMR-02, CMR-10 | unit | `pnpm --filter web test:unit __tests__/checkout-create-session.test.ts` | ❌ W0 | ⬜ pending |
| TBD by planner | TBD | 0 | CMR-03 | source-scan + integration | `pnpm --filter web test:unit __tests__/thank-you-source.test.ts` | ❌ W0 | ⬜ pending |
| TBD by planner | TBD | 0 | CMR-04 | unit | `pnpm --filter web test:unit __tests__/stripe-webhook.test.ts` | ❌ W0 | ⬜ pending |
| TBD by planner | TBD | 0 | CMR-05 | source-scan | `pnpm --filter web test:unit __tests__/stripe-webhook-source.test.ts` | ❌ W0 | ⬜ pending |
| TBD by planner | TBD | 0 | CMR-06 | unit | `pnpm --filter web test:unit __tests__/stripe-webhook-idempotency.test.ts` | ❌ W0 | ⬜ pending |
| TBD by planner | TBD | 0 | CMR-07, CMR-08 | integration | `pnpm --filter web test:unit __tests__/legal-pages.test.ts` | ❌ W0 | ⬜ pending |
| TBD by planner | TBD | 0 | CMR-09 | source-scan | `pnpm --filter web test:unit __tests__/issue-page-shop-callout.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Planner fills in concrete Task IDs and Plan numbers during step 8. This stub reflects Validation Architecture from `08-RESEARCH.md` §Validation Architecture.*

---

## Wave 0 Requirements

- [ ] `apps/web/__tests__/shop-page.test.ts` — covers CMR-01 (mocks `sanityClient.fetch`, asserts no `'use client'`, snapshots SSR HTML)
- [ ] `apps/web/__tests__/checkout-create-session.test.ts` — covers CMR-02, CMR-10 (mocks `getStripeServer`, asserts session args + `shipping_address_collection`)
- [ ] `apps/web/__tests__/thank-you-source.test.ts` — covers CMR-03 (source-scan; rejects `sanity`, `convex`, `fetch(` imports/calls in page.tsx)
- [ ] `apps/web/__tests__/stripe-webhook.test.ts` — covers CMR-04 (uses `stripe.webhooks.generateTestHeaderString` to forge valid + invalid signatures)
- [ ] `apps/web/__tests__/stripe-webhook-source.test.ts` — covers CMR-05 (source-scan; rejects bypass patterns like `if (process.env...) return` early-exits before `constructEvent`)
- [ ] `apps/web/__tests__/stripe-webhook-idempotency.test.ts` — covers CMR-06 (mocks Convex `stripeEvents.claim` returning `firstTime: false` on replay)
- [ ] `apps/web/__tests__/legal-pages.test.ts` — covers CMR-07, CMR-08 (Next.js render assertion for `/legal/privacy` + `/legal/terms`)
- [ ] `apps/web/__tests__/issue-page-shop-callout.test.ts` — covers CMR-09 (source-scan asserting `<ShopCallout` appears in `apps/web/app/issue/[slug]/page.tsx`)

Framework already installed — no `pnpm add` needed beyond Stripe SDK pin.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Visual: no client-side loading flicker on cold `/shop` load | CMR-01 | Visual perception (no fixture for "flash of unstyled content") | Andrew: hard refresh `/shop` in incognito, watch for any visible re-render after initial paint. None expected. |
| End-to-end test purchase via Stripe test card | CMR-02 | Hits real Stripe API; tests success_url redirect | Andrew: visit `/shop`, click Buy, use `4242 4242 4242 4242`, land on `/shop/thank-you`. |
| Forged-signature rejection | CMR-05 | Tests live route handler with arbitrary HTTP | Andrew: `curl -X POST` with body `{}` and bogus `Stripe-Signature` header against deployed webhook URL. Expect 4xx. |
| Idempotent replay | CMR-06 | Requires Stripe CLI live event resend | Andrew: `stripe events resend evt_xxx`; second invocation logs "replay ignored" / no duplicate order. |
| Shop callout visual check | CMR-09 | Visual placement at bottom of issue page | Andrew: open any published issue, scroll to bottom, confirm one-sentence + button (no banner, no modal, no popup). |
| `/legal/privacy` + `/legal/terms` render | CMR-07, CMR-08 | Smoke that placeholders ship without 404 | Andrew: visit both URLs in deployed env, confirm 200 + readable copy. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
