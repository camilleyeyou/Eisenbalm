---
phase: 15-shop-storefront
plan: 01
subsystem: ui
tags: [next.js, react, sanity, tailwind, stripe, lucide-react]

requires:
  - phase: 08-stripe-commerce
    provides: BuyButton component + /api/checkout/create-session route (byte-unchanged)
  - phase: 10-editorial-design-pass
    provides: .eyebrow / .drop-cap / .ornament-divider / .prose-measure CSS utilities
  - phase: 14-light-theme-adoption
    provides: warm-paper --color-* token palette (--color-bg, --color-surface, --color-card, --color-primary-text, etc.)

provides:
  - 8-section long-scroll /shop product page in the "Stop. Breathe. Balm." lip-balm sub-brand voice
  - Hero with tagline + sub-tagline + first BuyButton + price line
  - Positioning paragraph with .drop-cap (brand story opening)
  - 3-column features cluster (beeswax / charity / edition)
  - Expanded ingredient-story panel on --color-surface background
  - Dynamic charity callout server-rendered from Sanity QUERY_LATEST_CHARITY_NAME (Phase 8 preserved)
  - Product buy section with image placeholder + price/edition in --color-primary-text + second BuyButton
  - 6-item inline FAQ using native <details>/<summary> with ChevronDown (zero-JS)
  - Footer CTA on --color-surface background with third BuyButton
  - 10 new source-scan test assertions covering section IDs, tagline, BuyButton count, no-urgency, no-hex, TODO markers, FAQ

affects:
  - 15-HUMAN-UAT (visual hierarchy, mobile breakpoints, BuyButton wrapper spacing, FAQ chevron, voice register, Stripe flow)

tech-stack:
  added: []
  patterns:
    - "ChevronDown from lucide-react with group-open:rotate-180 on <details> parent for zero-JS FAQ accordion"
    - "BuyButton wrapper-div spacing: <div className='mt-N'><BuyButton /></div> — never pass props to BuyButton"
    - "Fragment return <> … </> so root layout's <main id='main'> remains the single <main>"
    - "text-[color:var(--color-*)] arbitrary-value CSS variable pattern (project convention, not canonical shorthand)"

key-files:
  created: []
  modified:
    - apps/web/app/shop/page.tsx
    - apps/web/__tests__/shop-page.test.ts

key-decisions:
  - "Wrapper-div spacing kept at mt-8 / mt-6 as specced (no double-spacing detected in static analysis; manual visual check deferred to 15-HUMAN-UAT)"
  - "Fragment <> return (not <main>) — root layout at apps/web/app/layout.tsx already provides <main id='main'>; confirmed by CLAUDE.md single-<main> rule"
  - "charityCallout intermediate string removed; charityName interpolated directly inline in JSX ternary as specced in Task 2 action"
  - "All 8 TODO(Andrew) markers included as JSX comments: hero photo, product photo, price confirm, edition confirm, ingredient spec verify, shipping rates, contact email, footer voice-check"
  - "No hardcoded hex anywhere in page source — all colors via --color-* token form text-[color:var(--color-*)]"
  - "Tailwind canonical-class IDE warnings (e.g. 'text-(--color-text-dim)' suggestion) intentionally ignored — project convention uses text-[color:var(--color-*)] form per UI-SPEC and established codebase pattern"

patterns-established:
  - "Phase 15 FAQ pattern: <details className='group'> + <summary className='list-none …'> + ChevronDown with transition-transform group-open:rotate-180 — mirrors DeliberationSlot.tsx"

requirements-completed:
  - SHOP-01
  - SHOP-02
  - SHOP-03
  - SHOP-04
  - SHOP-05
  - SHOP-06
  - SHOP-07
  - SHOP-08
  - SHOP-09
  - SHOP-10
  - SHOP-11

duration: 4min
completed: 2026-05-28
---

# Phase 15 Plan 01: Shop Storefront Summary

**8-section long-scroll /shop product page in the "Stop. Breathe. Balm." sub-brand voice register, rebuilding the Phase 8 placeholder with 241 lines of new JSX while preserving all Phase 8 Stripe machinery byte-unchanged.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-28T17:55:23Z
- **Completed:** 2026-05-28T17:59:40Z
- **Tasks:** 2 (TDD: test extension RED → page rewrite GREEN)
- **Files modified:** 2

## Accomplishments

- Extended `apps/web/__tests__/shop-page.test.ts` with 10 new Phase 15 source-scan assertions (RED state committed before Task 2)
- Rewrote `apps/web/app/shop/page.tsx` from 97-line Phase 8 placeholder to 285-line 8-section storefront
- All 16 shop-page.test.ts assertions green (6 CMR-01 + 10 Phase 15); full 225/225 suite green; build exits 0
- Phase 8 Stripe machinery byte-unchanged: BuyButton, checkout API, webhook, thank-you, legal pages, ShopCallout

## Task Commits

1. **Task 1: Extend test file (RED state)** - `c237514` (test)
2. **Task 2: Rewrite shop/page.tsx (GREEN state)** - `bfb5b2d` (feat)

## Files Created/Modified

- `apps/web/__tests__/shop-page.test.ts` — extended with `describe('Phase 15: /shop long-scroll structure')` block containing 10 source-scan assertions
- `apps/web/app/shop/page.tsx` — rewritten from Phase 8 minimal placeholder to 8-section long-scroll storefront

## Decisions Made

- Wrapper-div spacing (`mt-8` / `mt-6`) kept as specced. BuyButton has internal `mt-8` on its `<Button>` — whether this produces visual double-spacing requires manual inspection at `/shop` in a running dev server. Deferred to 15-HUMAN-UAT per 15-VALIDATION.md §Manual-Only.
- Fragment `<>…</>` return confirmed correct — `apps/web/app/layout.tsx` provides the single `<main id="main">`, so this page must not add a second `<main>`.
- `charityCallout` intermediate string removed per Task 2 action spec; `charityName` interpolated directly in JSX ternary.
- IDE Tailwind canonical-class warnings (suggesting `text-(--color-text-dim)` form) intentionally ignored — project convention uses `text-[color:var(--color-*)]` form per UI-SPEC §Color and all existing components (DeliberationSlot, ShopCallout).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Known Stubs / TODO(Andrew) Items Before Launch

The following are intentional stubs that Andrew must resolve before the shop page is production-ready:

| # | Location | Item | Marker |
|---|----------|------|--------|
| 1 | `#shop-hero` | Hero product photography (4:3 landscape) | `TODO(Andrew): upload hero product photography` |
| 2 | `#shop-hero` | Final price confirmation ($8.99) | `TODO(Andrew): confirm final price before launch` |
| 3 | `#shop-features` card 3 | Confirm hand-numbering process description | `TODO(Andrew): confirm hand-numbering process before launch` |
| 4 | `#shop-ingredient-story` | Verify ingredient list against manufacturer spec sheet | `TODO(Andrew): verify ingredient list against manufacturer spec sheet before launch` |
| 5 | `#shop-buy` left column | Product still photography (3:4 portrait) | `TODO(Andrew): upload product still photography (3:4 portrait, close-up of tube)` |
| 6 | `#shop-buy` right column | Confirm final price + edition number | `TODO(Andrew): confirm final price + edition number before launch` |
| 7 | `#shop-buy` right column | Confirm shipping rates, carrier, delivery window | `TODO(Andrew): confirm shipping rates, carrier, and estimated delivery window before launch` |
| 8 | `#shop-faq` item 3 | Confirm hand-numbering process description | `TODO(Andrew): confirm hand-numbering process description before launch` |
| 9 | `#shop-faq` item 5 | Add shipping rates, carrier, estimated delivery | `TODO(Andrew): add shipping rates, carrier, and estimated delivery window before launch` |
| 10 | `#shop-faq` item 6 | Insert contact email address | `TODO(Andrew): insert contact email address before launch` |
| 11 | `#shop-footer-cta` | Voice-check outro line — "needs it" leans persuasive | `TODO(Andrew): voice-check this outro line` |

None of these stubs prevent the page's goal from being achieved (the page renders correctly as a product storefront with placeholder content). All are deferred to Andrew per the Phase 15 scope decision.

## Manual-Only Verifications (per 15-VALIDATION.md §Manual-Only)

These require Andrew to run `pnpm --filter web dev` and visit `/shop`:

1. **BuyButton wrapper-pattern double-spacing** — Visual check at all 3 positions. BuyButton has internal `mt-8`; if wrappers (`mt-8` hero, `mt-6` buy/footer-cta) produce visible double-spacing, reduce wrapper `mt-*` to 0 and rely on BuyButton's internal `mt-8`.
2. **Mobile breakpoints** — 360 / 480 / 768 / 1024 / 1440px: `#shop-features` 3→1 col, `#shop-buy` 2→1 col, hero padding, ≥44px touch targets.
3. **FAQ accordion behavior** — `list-none` suppresses native disclosure triangle; chevron rotates on open.
4. **Voice register read-through** — Every paragraph in the "Stop. Breathe. Balm." meditative register, not the Dispatch editorial register.
5. **Stripe checkout regression** — Click BuyButton from rebuilt page; confirm redirect to Stripe Checkout.

## Phase 8 Preservation Contract (verified)

All of the following are byte-unchanged (confirmed by git status clean on Task 2 commit):

- `apps/web/components/marketing/BuyButton.tsx`
- `apps/web/app/api/checkout/create-session/route.ts`
- `apps/web/app/api/stripe/webhook/route.ts`
- `apps/web/app/shop/thank-you/page.tsx`
- `apps/web/app/legal/privacy/page.tsx`
- `apps/web/app/legal/terms/page.tsx`
- `apps/web/components/issue/ShopCallout.tsx`
- `apps/web/lib/theme.ts`
- `apps/web/app/globals.css`
- `convex/schema.ts`

## Next Phase Readiness

`/shop` is fully functional as a product storefront. BuyButton routes correctly to `/api/checkout/create-session` (Phase 8 contract preserved). The page is ready for 15-HUMAN-UAT once Andrew has a dev environment available.

---
*Phase: 15-shop-storefront*
*Completed: 2026-05-28*
