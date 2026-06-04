---
phase: quick-260604-ftt
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/app/shop/page.tsx
  - apps/web/app/shop/shop-brand.css
  - apps/web/components/marketing/ShopQtyProvider.tsx
  - apps/web/components/marketing/BuyButton.tsx
  - apps/web/components/marketing/ShopStickyBar.tsx
  - apps/web/components/marketing/ShopMotion.tsx
  - apps/web/app/api/checkout/create-session/route.ts
  - apps/web/__tests__/checkout-create-session.test.ts
  - docs/API_CONTRACTS.md
autonomous: true
requirements: [SHOP-REDESIGN, SHOP-MULTIQTY, SHOP-PLACEHOLDER]

must_haves:
  truths:
    - "Visiting /shop renders the 'Stop. Breathe. Balm.' split-screen hero with a CSS lip-balm tube placeholder and a buy panel showing the LIVE charity name"
    - "The shop's sub-brand palette/fonts apply ONLY inside the shop wrapper — the themed SiteHeader/SiteFooter and the rest of the site are visually unchanged"
    - "User can set a quantity 1–20 in the hero stepper; the running total updates; clicking Add-to-cart POSTs { quantity } and Stripe receives that quantity"
    - "A sticky buy bar appears after the hero scrolls past and also reflects the selected quantity"
    - "create-session defaults to quantity 1 when the body is missing/invalid and clamps out-of-range values into 1–20"
    - "The /shop page remains a server component (no top-level 'use client'); animations respect prefers-reduced-motion"
  artifacts:
    - path: "apps/web/app/shop/page.tsx"
      provides: "Server-rendered Stop.Breathe.Balm sub-brand shop page with live charity name + scoped wrapper"
      contains: "shop-brand"
    - path: "apps/web/app/shop/shop-brand.css"
      provides: "Scoped sub-brand palette + section/motion styles under .shop-brand"
      contains: ".shop-brand"
    - path: "apps/web/components/marketing/ShopQtyProvider.tsx"
      provides: "Client island holding shared 1–20 quantity state + stepper + running total"
    - path: "apps/web/components/marketing/BuyButton.tsx"
      provides: "Purchase island that reads shared quantity and POSTs { quantity }"
      contains: "quantity"
    - path: "apps/web/app/api/checkout/create-session/route.ts"
      provides: "Checkout route that reads + validates quantity from JSON body"
      contains: "quantity"
  key_links:
    - from: "apps/web/components/marketing/BuyButton.tsx"
      to: "/api/checkout/create-session"
      via: "fetch POST with JSON body { quantity }"
      pattern: "JSON.stringify"
    - from: "apps/web/app/api/checkout/create-session/route.ts"
      to: "stripe.checkout.sessions.create"
      via: "line_items[0].quantity = validated quantity"
      pattern: "line_items"
    - from: "apps/web/app/shop/page.tsx"
      to: "sanityClient"
      via: "QUERY_LATEST_CHARITY_NAME GROQ projection"
      pattern: "charityName"
---

<objective>
Redesign `/shop` into the user-supplied "Stop. Breathe. Balm." lip-balm sub-brand mockup and wire a real 1–20 multi-quantity Stripe checkout.

Purpose: The shop becomes a self-contained product microsite with its OWN fixed palette/fonts (NOT the site's per-issue theme), a quantity stepper + running total + sticky buy bar, while staying server-rendered and keeping the shared themed SiteHeader/SiteFooter.

Output: A rewritten server-component `apps/web/app/shop/page.tsx`, a scoped `shop-brand.css`, three client islands (quantity provider/stepper, sticky bar, motion), a quantity-aware `BuyButton`, a quantity-reading `create-session` route, updated tests, and an API_CONTRACTS note.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

# Current shop page (being replaced in place)
@apps/web/app/shop/page.tsx
# Purchase island (being extended for quantity)
@apps/web/components/marketing/BuyButton.tsx
# Checkout route (being extended to read quantity from body)
@apps/web/app/api/checkout/create-session/route.ts
# Tests that gate this work
@apps/web/__tests__/shop-page.test.ts
@apps/web/__tests__/checkout-create-session.test.ts
# Theme tokens + existing utilities (.eyebrow etc.) — read for class reuse only
@apps/web/app/globals.css

<interfaces>
<!-- Contracts the executor needs. Use directly — no exploration required. -->

Fonts are ALREADY loaded sitewide via next/font/google in apps/web/app/layout.tsx as CSS variables:
  --font-display-loaded  → Fraunces (display)
  --font-body-loaded     → Newsreader (body)
  --font-ui-loaded       → IBM Plex Mono (mono/eyebrow)
The sub-brand needs Fraunces / Newsreader / IBM Plex Mono — so REUSE these variables. Do NOT add new next/font imports or CDN <link>s.

Shared chrome is applied at the LAYOUT level (apps/web/app/layout.tsx renders <SiteHeader/> + <main> + <SiteFooter/>). DO NOT add a second header/footer/nav in the shop page. The mockup's own <header>/<footer>/<nav> are dropped.

Existing checkout route signature (apps/web/app/api/checkout/create-session/route.ts):
  export async function POST(_req: Request): Promise<NextResponse>
  - reads STRIPE_PRICE_ID (500 if unset)
  - reads charitySlug via QUERY_CURRENT_CHARITY_SLUG (empty string on Sanity error)
  - calls stripe.checkout.sessions.create({ mode, line_items:[{ price, quantity:1 }], shipping_address_collection:{allowed_countries:['US']}, phone_number_collection, automatic_tax:{enabled:false}, success_url:buildSuccessUrl(), cancel_url:buildCancelUrl(), metadata:{ source, charitySlug } })
  - returns NextResponse.json({ url }) or 500 on missing url
  ONLY the quantity wiring changes; every other line stays byte-identical.

BuyButton current signature: export function BuyButton()  (no props). It fetches POST /api/checkout/create-session with NO body.

Shop GROQ projection (keep verbatim in page.tsx):
  QUERY_LATEST_CHARITY_NAME = *[_type=="weeklyIssue" && status=="published"] | order(issueNumber desc)[0]{ "charityName": charity->name }
  charityName: string | null  (try/catch → null fallback)
  ISR: export const revalidate = 60
</interfaces>

# LOCKED SUB-BRAND PALETTE (scope ALL of these under the .shop-brand wrapper; do NOT touch :root)
#   --paper #FBFAF6 · --paper2 #F3F0E8 · --paper3 #EBE7DC
#   --ink #1A1714 · --ink-2 #56514A · --ink-3 #8C8779
#   --accent #9A3324 · --accent-soft #F2E3DE · --accent-deep #6E2117
#   --gold #9C7A3C · --rule #E2DDD0 · --rule-strong #CFC9B8
# Fonts inside .shop-brand: display=var(--font-display-loaded) (Fraunces),
#   body=var(--font-body-loaded) (Newsreader), mono=var(--font-ui-loaded) (IBM Plex Mono).
</context>

<tasks>

<task type="auto">
  <name>Task 1: Quantity wiring — provider island, quantity-aware BuyButton, create-session route, tests, contract note</name>
  <files>apps/web/components/marketing/ShopQtyProvider.tsx, apps/web/components/marketing/BuyButton.tsx, apps/web/app/api/checkout/create-session/route.ts, apps/web/__tests__/checkout-create-session.test.ts, docs/API_CONTRACTS.md</files>
  <action>
Build the end-to-end multi-quantity path FIRST so Task 2's UI has a stable contract to render against.

1) CREATE `apps/web/components/marketing/ShopQtyProvider.tsx` ('use client'):
   - A React Context exposing `{ quantity: number, setQuantity: (n:number)=>void, unitPriceCents: number }`. Default quantity=1, unitPriceCents=899 (TODO(Andrew): confirm final price; mirrors the $8.99 used elsewhere).
   - `setQuantity` CLAMPS to integer 1–20 (Math.min(20, Math.max(1, Math.round(n)||1))).
   - Export `ShopQtyProvider` (wraps children) and a `useShopQty()` hook (throws if used outside provider).
   - Export a `<QtyStepper />` component: a labelled −/＋ control (two ≥44px buttons + a readable count) plus a live running-total line "Total: $X.XX" computed from quantity*unitPriceCents (use `(cents/100).toFixed(2)`). aria-label the buttons "Decrease quantity"/"Increase quantity"; the count has `aria-live="polite"`. Disable − at 1 and ＋ at 20. Style with plain Tailwind utilities that read the scoped tokens via `text-[color:var(--accent)]` etc. — it renders INSIDE the .shop-brand wrapper so the sub-brand vars resolve.

2) EDIT `apps/web/components/marketing/BuyButton.tsx`:
   - Keep 'use client'. Add optional prop `quantity?: number`. When the prop is omitted, call `useShopQty()` to read the shared quantity (so a bare <BuyButton/> inside the provider still works). Accept the prop form too so the sticky bar can pass an explicit value if needed.
   - Change the fetch to send a JSON body: `headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity })`.
   - Everything else (loading state "Redirecting…", console.error path, no toast) stays unchanged. Keep the existing label "Buy the lip balm" as the default but allow an optional `label?: string` prop (sticky bar uses a short label). Do NOT remove the `className="mt-8"`-style spacing flexibility — keep an optional `className` passthrough.

3) EDIT `apps/web/app/api/checkout/create-session/route.ts`:
   - Change `POST(_req: Request)` to `POST(req: Request)`.
   - After the STRIPE_PRICE_ID guard, parse quantity defensively:
     ```ts
     let quantity = 1
     try {
       const body = await req.json().catch(() => ({}))
       const q = Number((body as { quantity?: unknown })?.quantity)
       if (Number.isFinite(q)) quantity = Math.min(20, Math.max(1, Math.round(q)))
     } catch { quantity = 1 }
     ```
     (Missing body, non-JSON, NaN, or out-of-range all collapse to a valid 1–20 value — default 1.)
   - Replace the hardcoded `line_items: [{ price: priceId, quantity: 1 }]` with `quantity`. Leave shipping/phone/tax/success/cancel/metadata BYTE-UNCHANGED.

4) EDIT `apps/web/__tests__/checkout-create-session.test.ts`:
   - Update the existing "quantity=1" assertion test so the default-body (`'{}'`) case still asserts `quantity: 1` (default path).
   - ADD tests: (a) body `{ quantity: 5 }` → `line_items[0].quantity === 5`; (b) body `{ quantity: 0 }` and `{ quantity: 99 }` → clamped to 1 and 20 respectively; (c) missing/non-numeric quantity (`{ quantity: 'abc' }` and empty body) → defaults to 1. Pass JSON bodies with `headers: { 'content-type': 'application/json' }`. Keep all other existing tests passing unchanged.

5) EDIT `docs/API_CONTRACTS.md` §6.1: add an explicit prose note under the Create-checkout-session example documenting the locked request body `{ quantity?: number }` — "POST /api/checkout/create-session accepts an optional JSON body `{ quantity?: number }`; the route validates it as an integer 1–20 and defaults to 1 on missing/invalid/out-of-range input. Stripe `line_items[0].quantity` is set to the validated value." Do not restructure the section.
  </action>
  <verify>
    <automated>cd apps/web && npx vitest run __tests__/checkout-create-session.test.ts</automated>
  </verify>
  <done>create-session reads quantity from the JSON body, validates/clamps to 1–20 (default 1), and passes it to Stripe; BuyButton POSTs { quantity }; ShopQtyProvider + QtyStepper + useShopQty exist; the checkout test file passes including new valid/invalid/out-of-range cases; API_CONTRACTS §6.1 documents the body.</done>
</task>

<task type="auto">
  <name>Task 2: Rebuild /shop as the scoped Stop.Breathe.Balm sub-brand page + scoped CSS + motion + sticky bar</name>
  <files>apps/web/app/shop/page.tsx, apps/web/app/shop/shop-brand.css, apps/web/components/marketing/ShopStickyBar.tsx, apps/web/components/marketing/ShopMotion.tsx</files>
  <action>
Translate the mockup into the project's React/Next conventions. The page STAYS a server component.

A) CREATE `apps/web/app/shop/shop-brand.css` — ALL selectors scoped under `.shop-brand`:
   - `.shop-brand { --paper:#FBFAF6; --paper2:#F3F0E8; --paper3:#EBE7DC; --ink:#1A1714; --ink-2:#56514A; --ink-3:#8C8779; --accent:#9A3324; --accent-soft:#F2E3DE; --accent-deep:#6E2117; --gold:#9C7A3C; --rule:#E2DDD0; --rule-strong:#CFC9B8; --sb-display:var(--font-display-loaded),Georgia,serif; --sb-body:var(--font-body-loaded),Georgia,serif; --sb-mono:var(--font-ui-loaded),monospace; background:var(--paper); color:var(--ink); }`
   - This wrapper's vars OVERRIDE the inherited site theme within the shop only (scoped — no leak). Provide component classes for each mockup beat: split hero (`.sb-hero` 2-col grid, left tube panel on a paper gradient, right buy panel), `.sb-tube` (CSS-rendered lip-balm tube placeholder with the float animation), `.sb-stamp` ("Release 001 · Hand-numbered" edition stamp), `.sb-ritual` (dark `var(--ink)` full-bleed band with the breathing circle + In/Out label), `.sb-formula` (two-column "What's in it / What isn't" in/out lists + closing italic paragraph), `.sb-edition` (big 001 numeral on `var(--paper2)`), `.sb-cause` (full-bleed `var(--accent)` close with $8.99 → charity), FAQ via native `<details>/<summary>`, and the `.sb-sticky` sticky buy bar.
   - Motion keyframes scoped under `.shop-brand`: `float` (tube gentle vertical translate), `breathe` (circle scale + glow pulse), and a `.rv`→`.rv.in` scroll-reveal (opacity/translateY transition). Inside `@media (prefers-reduced-motion: reduce)` (you MAY use a top-level media query that targets `.shop-brand` descendants): disable `float`/`breathe` animations and force `.shop-brand .rv { opacity:1 !important; transform:none !important; transition:none !important; }`.
   - Use ONLY the scoped `--paper/--ink/--accent/...` vars and the three `--sb-*` font vars — these literal hex values live in this CSS file ONLY (the page.tsx must contain NO 6-digit hex, to satisfy the SHOP-09 shop-page test). The sticky bar + In/Out toggling is driven by the client islands (Task B/C) via class toggles.

B) CREATE `apps/web/components/marketing/ShopMotion.tsx` ('use client'):
   - An IntersectionObserver island that adds `.in` to every `.rv` element when it enters the viewport (one-shot). Early-return (and leave content visible) when `window.matchMedia('(prefers-reduced-motion: reduce)').matches`. Renders nothing (returns null) — it just wires observers on mount against `document.querySelectorAll('.shop-brand .rv')`. Clean up the observer on unmount.

C) CREATE `apps/web/components/marketing/ShopStickyBar.tsx` ('use client'):
   - Reads `useShopQty()` for quantity. Renders the `.sb-sticky` bar: product name + "$8.99" + "100% → {charityName}" (charityName passed as a prop, string|null with the existing fallback copy) + a `<BuyButton label="Add to cart" quantity={quantity} />`.
   - Show/hide on scroll: hidden until the hero has scrolled past (track via a scroll listener comparing window.scrollY to a threshold, e.g. ~600px, or observe a sentinel at the end of the hero). Toggle a visibility class. Under prefers-reduced-motion, skip transition but still toggle visibility.
   - ≥44px Add-to-cart target; the bar must not cover the SiteFooter awkwardly (fixed bottom, z below the header's z-[150]).

D) REWRITE `apps/web/app/shop/page.tsx` (SERVER component — NO top-level 'use client'):
   - Keep verbatim: the `import type { Metadata }`, `groq`, `sanityClient`, `SITE_NAME/getSiteUrl`, the `export const revalidate = 60`, the `metadata` object, the `QUERY_LATEST_CHARITY_NAME` projection, the `export default async function ShopPage()` with the try/catch → `charityName: string | null` fallback. The shop-page test requires: not a client component, imports sanityClient, async default export, renders `<BuyButton/>` (≥2 instances), `revalidate` present, sections with ids `shop-hero`/`shop-features`/`shop-buy`/`shop-faq`, tagline "Stop. Breathe. Balm." verbatim, native `<details>/<summary>`, a `TODO(Andrew)` marker, NO urgency vocabulary, and NO 6-digit hex in code. PRESERVE all of these.
   - `import './shop-brand.css'` at top of the page.
   - Wrap the whole page body in `<div className="shop-brand">…</div>` so the scoped sub-brand styling applies (and does not leak to header/footer which live outside this subtree at the layout level).
   - Compose the mockup beats in order, KEEPING the required section ids: hero `id="shop-hero"` (split-screen: left `.sb-tube` placeholder + `.sb-stamp` "Release 001 · Hand-numbered"; right buy panel = eyebrow, `<h1>Jesse A. Eisenbalm</h1>`, the "Stop. Breathe. Balm." ritual line, sub, `$8.99`, `<QtyStepper/>` + running total, `<BuyButton/>`, trust bullets where the charity bullet uses the LIVE `charityName` with the existing null fallback) → The Ritual band → The Formula `id="shop-features"` (what's-in/what-isn't two columns + italic close) → The Edition (big 001) → The Cause `id="shop-buy"` full-bleed accent ($8.99 → charityName, copy, a `<BuyButton/>`) → FAQ `id="shop-faq"` (reuse/adapt the existing 6 native `<details>/<summary>` items). Add TODO(Andrew) comments on the tube placeholder and image-placeholder blocks ("upload product photography … replace with <Image>") and on price/edition.
   - Mount the client islands so shared quantity state spans the stepper + both BuyButtons + sticky bar: wrap the interactive subtree in `<ShopQtyProvider>` and render `<ShopMotion/>` and `<ShopStickyBar charityName={charityName} />` inside the provider. (ShopQtyProvider is a client component; rendering it from a server component is fine — children that are server-rendered markup still pass through. Where the stepper/BuyButtons need shared state they are client components inside the provider.)
   - Do NOT duplicate the mockup's <header>/<footer>/<nav> — shared chrome is at the layout level.
   - Ensure NO 6-digit hex literal appears anywhere in page.tsx (all color comes from shop-brand.css classes).
  </action>
  <verify>
    <automated>cd apps/web && npx vitest run __tests__/shop-page.test.ts</automated>
  </verify>
  <done>/shop renders the scoped Stop.Breathe.Balm sub-brand layout (hero with CSS tube + edition stamp + qty stepper/total, Ritual band, Formula in/out, Edition numeral, accent Cause close with live charity, native FAQ, sticky buy bar); page stays a server component; sub-brand palette/fonts are scoped under .shop-brand (no leak to header/footer); motion respects prefers-reduced-motion; shop-page.test.ts passes.</done>
</task>

<task type="auto">
  <name>Task 3: Full suite green</name>
  <files>apps/web</files>
  <action>
Run the full apps/web test suite and fix any regressions introduced by Tasks 1–2 (e.g. BuyButton consumers elsewhere expecting the old no-body fetch, or the create-session shape). Do not weaken assertions to pass — fix the code. Confirm there is no top-level 'use client' in shop/page.tsx and no 6-digit hex in page.tsx code (both are asserted by shop-page.test.ts, but re-confirm after edits).
  </action>
  <verify>
    <automated>cd apps/web && npm test</automated>
  </verify>
  <done>The entire apps/web test suite passes; no regressions from the quantity wiring or shop rebuild.</done>
</task>

</tasks>

<verification>
- `cd apps/web && npm test` is fully green.
- `apps/web/__tests__/shop-page.test.ts`: server component, imports sanityClient, async default export, ≥2 BuyButtons, revalidate present, ids shop-hero/shop-features/shop-buy/shop-faq, tagline verbatim, native details/summary, TODO(Andrew) present, no urgency vocab, no 6-digit hex in code.
- `apps/web/__tests__/checkout-create-session.test.ts`: default→qty 1; valid qty passed through; out-of-range clamped; invalid/missing defaults to 1; all prior assertions intact.
- Sub-brand palette/fonts are confined to `.shop-brand` (grep shop-brand.css selectors all begin with `.shop-brand`); page.tsx contains no 6-digit hex.
</verification>

<success_criteria>
- /shop reproduces the mockup's beats in the Stop.Breathe.Balm register with placeholders + TODO(Andrew) markers.
- 1–20 quantity flows end-to-end: stepper → shared state → BuyButton body { quantity } → create-session validation → Stripe line_items quantity.
- Sticky buy bar appears on scroll and reflects quantity.
- Page stays server-rendered with live charity name + ISR; shared SiteHeader/SiteFooter untouched and unthemed by the sub-brand.
- prefers-reduced-motion disables float/breathe/scroll-reveal and reveals content.
- API_CONTRACTS §6.1 documents the { quantity?: number } body.
</success_criteria>

<output>
After completion, create `.planning/quick/260604-ftt-redesign-shop-to-stop-breathe-balm-sub-b/260604-ftt-SUMMARY.md`
</output>
