---
phase: 55-public-site-redesign
plan: 07
subsystem: web-commerce
tags: [stripe, convex, checkout, dispatch]
requires: [55-01, 55-02, 55-03, 55-04]
provides: [startCheckout, FundButton, BalmCounter, BuyBand, fetchBalms]
key-files:
  created:
    - apps/web/lib/checkout-client.ts
    - apps/web/components/dispatch/FundButton.tsx
    - apps/web/components/dispatch/BalmCounter.tsx
    - apps/web/components/dispatch/BuyBand.tsx
    - apps/web/components/dispatch/commerce.css
    - apps/web/lib/dispatch/balms-server.ts
    - apps/web/__tests__/fund-button.test.tsx
    - apps/web/__tests__/balm-count.test.tsx
  modified:
    - apps/web/components/marketing/BuyButton.tsx
metrics:
  completed: 2026-10-17
---

# Phase 55 Plan 07: Commerce Buy Band Summary

Shared Stripe checkout client feeding both the /shop BuyButton and a new Dispatch FundButton, plus a live Convex BalmCounter (hidden when unavailable) and the `#buy` ink band (`data-shop-callout`, `/shop` link).

## Commits
- Task 1: checkout-client, BuyButton refactor, FundButton
- Task 2: BalmCounter, fetchBalms
- Task 3: BuyBand, tests

## Deviations
None. Tests for FundButton/BuyBand are in fund-button.test.tsx as planned; commerce.css was committed with Task 1 since FundButton imports it.

## Verification
Full web suite 601 passed; `tsc --noEmit` clean; buy-button test green. Stripe purchase check deferred to Plan 13.

## Self-Check: PASSED
