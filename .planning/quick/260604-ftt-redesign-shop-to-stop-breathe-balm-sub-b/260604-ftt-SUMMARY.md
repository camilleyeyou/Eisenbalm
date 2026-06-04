---
phase: quick-260604-ftt
plan: "01"
subsystem: shop
tags: [shop, stripe, quantity, sub-brand, css, animation]
dependency_graph:
  requires: []
  provides: [shop-brand-subsite, multi-quantity-checkout]
  affects: [apps/web/app/shop, apps/web/components/marketing, apps/web/app/api/checkout]
tech_stack:
  added: []
  patterns:
    - Scoped CSS sub-brand (.shop-brand wrapper, all hex in CSS file only)
    - React Context for shared quantity state across server-rendered page islands
    - IntersectionObserver scroll-reveal (one-shot, prefers-reduced-motion aware)
    - Scroll threshold sticky bar (fixed bottom, scroll listener)
    - Defensive JSON body parsing (try/catch + clamp 1-20)
key_files:
  created:
    - apps/web/app/shop/shop-brand.css
    - apps/web/components/marketing/ShopQtyProvider.tsx
    - apps/web/components/marketing/ShopMotion.tsx
    - apps/web/components/marketing/ShopStickyBar.tsx
  modified:
    - apps/web/app/shop/page.tsx
    - apps/web/components/marketing/BuyButton.tsx
    - apps/web/app/api/checkout/create-session/route.ts
    - apps/web/__tests__/checkout-create-session.test.ts
    - docs/API_CONTRACTS.md
    - apps/web/package.json
decisions:
  - Scoped CSS file (shop-brand.css) holds ALL hex values; page.tsx has no hex literals — satisfies SHOP-09 test assertion
  - BuyButton reads quantity from ShopQtyProvider context when no prop given, falls back to 1 — works as bare <BuyButton/> outside provider for backward compatibility
  - Mock @/lib/sanity/client in checkout tests to prevent real network call timeouts in full suite (defensive fix, does not weaken assertions)
  - "npm test" alias added to package.json pointing to vitest run (plan verification command)
metrics:
  duration: "~20 min"
  completed: "2026-06-04T18:42:49Z"
  tasks: 3
  files: 10
---

# Quick 260604-ftt: Redesign /shop as Stop.Breathe.Balm sub-brand + Multi-quantity Stripe checkout

Rewrote the /shop page into a scoped lip-balm product microsite with a locked sub-brand palette, a quantity stepper wired end-to-end to Stripe, and a sticky buy bar — while keeping the page server-rendered and the shared SiteHeader/SiteFooter visually untouched.

## Tasks Completed

| Task | Name | Commit | Key files |
|------|------|--------|-----------|
| 1 | Quantity wiring | 8b6d2ae | ShopQtyProvider.tsx, BuyButton.tsx, create-session/route.ts, checkout tests |
| 2 | Shop sub-brand rebuild | 30204df | shop-brand.css, ShopMotion.tsx, ShopStickyBar.tsx, page.tsx |
| 3 | Full suite green | b670e93 | checkout-create-session.test.ts (sanityClient mock) |

## What Was Built

### Task 1 — Quantity wiring

- `ShopQtyProvider.tsx`: React context exposing `{ quantity, setQuantity, unitPriceCents }`. `QtyStepper` component with accessible −/+ buttons (>=44px), `aria-live="polite"` count, and live "Total: $X.XX" running total. Clamps to integer 1-20.
- `BuyButton.tsx`: extended with optional `quantity?` prop and optional `label?`/`className?` props. When prop is omitted, reads from context via `useShopQty()` (with try/catch fallback to 1 for out-of-provider use). POSTs `JSON.stringify({ quantity })` with `Content-Type: application/json` header.
- `create-session/route.ts`: changed `POST(_req)` to `POST(req)`, added defensive JSON body parse. Stripe `line_items[0].quantity` set to the validated value (integer 1-20, default 1).
- `checkout-create-session.test.ts`: added 6 new quantity tests (valid qty=5 passes through; qty=0 and qty=99 clamp to 1 and 20; non-numeric string and missing key default to 1; empty body defaults to 1). Added `vi.doMock('@/lib/sanity/client')` to prevent real network call timeouts in full suite.
- `API_CONTRACTS.md §6.1`: added prose note documenting the `{ quantity?: number }` request body contract.

### Task 2 — Sub-brand rebuild

- `shop-brand.css`: ALL hex values live here only. Scoped under `.shop-brand`. Palette tokens, font vars (referencing sitewide `--font-*-loaded` CSS vars), CSS lip-balm tube animation (`sb-float`), breathing circle animation (`sb-breathe`), scroll-reveal primitive (`.rv` / `.rv.in`), and full section styles. `@media (prefers-reduced-motion: reduce)` disables all animations and forces `.rv` content visible.
- `ShopMotion.tsx`: `'use client'` IntersectionObserver island. Adds `.in` to `.shop-brand .rv` elements on viewport entry (one-shot). Early-returns when `prefers-reduced-motion` is active. Renders `null`.
- `ShopStickyBar.tsx`: `'use client'` sticky buy bar. Reads `useShopQty()` for quantity. Scroll listener with 600px threshold toggles `.visible` class. Shows product name + $8.99 + charity cause line + BuyButton.
- `page.tsx`: full rewrite as server component. Section order: `id="shop-hero"` (split-screen: CSS tube placeholder + edition stamp / buy panel with tagline "Stop. Breathe. Balm.", QtyStepper, BuyButton #1, trust bullets) + Ritual band + `id="shop-features"` (formula in/out) + Edition 001 numeral + `id="shop-buy"` (cause close with BuyButton #2) + `id="shop-faq"` (6 native details/summary FAQ items). No hex in .tsx. Multiple TODO(Andrew) markers.

### Task 3 — Full suite green

Added `vi.doMock('@/lib/sanity/client')` in checkout test `beforeEach` to prevent network call timeouts in the full suite.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Checkout tests timeout in full suite**
- **Found during:** Task 3
- **Issue:** `sanityClient.fetch()` in the create-session route makes a real network call during tests. Hangs and exceeds the 5s timeout when the full suite runs concurrently.
- **Fix:** Added `vi.doMock('@/lib/sanity/client', () => ({ sanityClient: { fetch: vi.fn().mockResolvedValue(null) } }))` to `beforeEach`. Same pattern as the existing Stripe mock.
- **Files modified:** `apps/web/__tests__/checkout-create-session.test.ts`
- **Commit:** b670e93

**2. [Rule 3 - Blocking] Worktree has no node_modules**
- **Found during:** Task 1 verification
- **Issue:** Git worktree does not share node_modules with the main checkout.
- **Fix:** Ran `pnpm install --frozen-lockfile` from worktree root.
- **No code changed**

**3. [Rule 2 - Missing functionality] No npm test script**
- **Found during:** Task 1 (plan's verify command is `npm test`)
- **Fix:** Added `"test": "vitest run"` alias to package.json scripts.
- **Files modified:** `apps/web/package.json`
- **Commit:** 8b6d2ae

## Test Results

Final full suite: **32 test files, 288 tests passing, 13 todo** (zero failures).

- `__tests__/shop-page.test.ts`: 16/16 (all constraints met)
- `__tests__/checkout-create-session.test.ts`: 12/12 (6 original + 6 new quantity tests)

## Known Stubs

- CSS tube placeholder in `id="shop-hero"` left panel: `TODO(Andrew)` marker indicates real product photography should replace this when available. The tube is CSS-only and conveys product shape but is not a photograph.
- Ingredient list: `TODO(Andrew)` marker on formula section — needs verification against manufacturer spec sheet.
- Price ($8.99), edition number (001), shipping rates, contact email: all marked with `TODO(Andrew)`.

These stubs are intentional placeholders per plan specification. They do not prevent the plan's goal (functional shop with sub-brand design and working multi-quantity checkout) from being achieved.

## Self-Check: PASSED

Files exist:
- FOUND: apps/web/app/shop/shop-brand.css
- FOUND: apps/web/components/marketing/ShopQtyProvider.tsx
- FOUND: apps/web/components/marketing/ShopMotion.tsx
- FOUND: apps/web/components/marketing/ShopStickyBar.tsx
- FOUND: apps/web/app/shop/page.tsx (rewritten)
- FOUND: apps/web/components/marketing/BuyButton.tsx (modified)
- FOUND: apps/web/app/api/checkout/create-session/route.ts (modified)

Commits exist:
- FOUND: 8b6d2ae (Task 1 — quantity wiring)
- FOUND: 30204df (Task 2 — sub-brand rebuild)
- FOUND: b670e93 (Task 3 — full suite green)
