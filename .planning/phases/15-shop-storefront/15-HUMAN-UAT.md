---
status: partial
phase: 15-shop-storefront
source: [15-VERIFICATION.md]
started: 2026-05-28T11:00:00Z
updated: 2026-05-28T11:00:00Z
---

## Current Test

[awaiting human walkthrough on the rendered light-theme storefront]

## Tests

### 1. Responsive layout + touch targets across breakpoints (SC-1)
expected: Load `/shop` at 375 / 768 / 1024 / 1440px viewports. Confirm `#shop-features` collapses 3-col → 1-col below 768px; `#shop-buy` stacks 2-col → 1-col below 768px; hero padding rebalances. Every CTA (3 BuyButton wrappers + 6 FAQ summary chevrons) is ≥44×44px touch target at every breakpoint.
result: [pending]

### 2. BuyButton wrapper double-spacing visual check (SC-1 / SC-2)
expected: At each of the 3 BuyButton positions (hero / buy / footer), confirm the spacing above the button looks editorially correct — NOT visibly double-spaced. BuyButton has internal `mt-8`; current wrappers are `mt-N`. If any position shows visible double-spacing, drop the wrapper margin (`mt-0`) and rely on the internal `mt-8` alone.
result: [pending]

### 3. Voice register read-through (SC-6 — lip-balm sub-brand, not Dispatch editorial)
expected: Read every paragraph + FAQ answer + hero/footer copy on `/shop`. Confirm the register is meditative, declarative, deliberate (Stop. Breathe. Balm.) — NOT the Dispatch's dry-editorial register. Specifically voice-check the footer outro line **"One product. This week's charity needs it."** — it edges toward persuasion ("needs it" leans appeal-to-need) and is flagged for replacement if it doesn't sit right.
result: [pending]

### 4. FAQ accordion behavior (SC-4)
expected: Click each of the 6 FAQ summaries. Confirm: (a) no native disclosure triangle (`list-none` working), (b) custom `ChevronDown` rotates smoothly on open (`group-open:rotate-180`), (c) answers are legible on the warm-paper light theme, (d) keyboard `Enter`/`Space` toggles the disclosure (semantic `<details>` default behavior).
result: [pending]

### 5. Hero + product photography placeholder quality (SC-1)
expected: The hero is type-only by design (no img); the `#shop-buy` product image is a `TODO(Andrew)` SVG/illustration placeholder. Confirm the type-only hero feels intentional (not "missing image"), and the `#shop-buy` placeholder reads as a "real product image coming" cue — not broken or empty. Track Andrew's photography upload (hero + product still + optional lifestyle shot) as a pre-launch task.
result: [pending]

### 6. Real Stripe checkout click-through (SC-2 — gated on Andrew's test-key swap, Phase 8 08-08)
expected: AFTER Andrew swaps `apps/web/.env.local` from `sk_live_` → `sk_test_` (Phase 8 `08-02` UAT item 1), run `pnpm --filter web dev`, load `/shop`, click each of the 3 BuyButtons in turn, complete the Stripe Checkout test purchase (`4242` card), land on `/shop/thank-you`. All 3 BuyButtons redirect to a hosted Stripe Checkout session; no console errors.
result: [pending — gated on Phase 8 08-08]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
