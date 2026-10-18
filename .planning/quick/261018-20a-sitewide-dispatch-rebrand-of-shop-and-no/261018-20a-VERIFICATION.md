---
quick: 261018-20a
verified: 2026-10-18
status: human_needed
score: 5/5 truths verified in code; visual checks pending
---

# Quick 261018-20a Verification

**Goal:** Sitewide Dispatch rebrand of non-front-page public routes in apps/web.

## Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All listed routes render in `.dispatch` scope with Dispatch tokens, no Phase 19 styling | VERIFIED (code) | about, legal, thank-you, archive, charities, agents use `SitePage` (`.dispatch d-page`); shop uses `.dispatch d-shop`; error/not-found rebranded. `SiteHeader`, `SiteFooter`, `shop-brand.css` deleted; no references remain. |
| 2 | Six-link top bar plus Fund pill, wraps, 44px targets | VERIFIED (code) | `SITE_TOPBAR_LINKS` has the 6 required hrefs; pill links to `/shop`; `d-tap` and `min-height:44px` in site.css; wide-layout media query only. Rendering at 375px not checked. |
| 3 | DispatchFooter on every route outside the single main; front page and /issue chrome unchanged | VERIFIED | layout.tsx renders `<DispatchFooter />` after `</main>`. Only one `<main id="main">` in the codebase. No diff in app/page.tsx, components/issue, ChromeSwitch, DispatchFooter, app/api, lib/theme.ts, lib/game-validator.ts. |
| 4 | Shop copy verbatim, ids, BuyButtons, stepper, sticky bar, details FAQ, Stripe | VERIFIED | Word-level diff (`git diff -w`) between a76cf618 and HEAD shows only comment text and markup changes. Ingredient lists are identical text (now wrapped in spans). "Stop. Breathe. Balm." retained. Ids shop-hero, shop-features, shop-buy, shop-faq present. 2 BuyButtons, 6 `<details>`. app/api untouched. |
| 5 | Contrast pairings, focus, reduced motion | PARTIAL (code only) | Motion is gated by `prefers-reduced-motion: no-preference`. Contrast and focus not measured in a browser. |

## Copy diff (a76cf618..HEAD)

Checked app/shop/page.tsx, shop/thank-you, about, legal/privacy, legal/terms, archive, charities, and components/archive, components/charities, components/marketing. No user-visible string was added, removed or edited. All differences are re-indentation, comment rewrites, `className`/style changes and wrappers (`SitePage` title/eyebrow/lead props carry the same strings: "About", "Legal/Privacy", "Legal/Terms", "Archive" with its lead, "Charities" with its lead, "Order received" with its h1). The only new copy is the top bar link labels in `lib/dispatch/copy.ts`, which the plan specified.

## Hex literals

No hex literals in components/dispatch, app/shop, app/about, app/legal, app/archive or app/charities. Hex values that remain are pre-existing and out of scope: lib/brand.ts, the `themeColor` in layout.tsx, lib/theme.ts, and the issue preview page.

## Checks run

- `pnpm --filter web test`: 61 files, 664 tests pass.
- `pnpm --filter web typecheck`: clean.
- I did not run `build`.

## Human verification required

1. **Visual pass at 375px and 1280px** on /shop, /shop/thank-you, /archive, /charities, /charities/<slug>, /about, /agents/<id>, /legal/privacy, a 404 and the error boundary. Expected: Dispatch look, top bar wraps with all links visible, no horizontal scroll. Why human: no browser render was performed (the executor also skipped this). Note the local dev CORS gap in memory may block draft data.
2. **Contrast and focus on toned bands** (ink on green/yellow/red, paper on blue/ink; visible focus ring). Why human: needs rendered colors.
3. **Shop flow:** quantity stepper, sticky bar, and Stripe checkout redirect (test mode). Why human: runtime behaviour.
4. **Known deviation:** CharityDetail header band is inside the container (not full-bleed). Visual only.

## Gaps

None found in code.
