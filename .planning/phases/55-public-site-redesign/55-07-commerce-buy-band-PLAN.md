---
phase: 55-public-site-redesign
plan: 07
type: execute
wave: 2
depends_on: [55-01, 55-02, 55-03, 55-04]
files_modified:
  - apps/web/lib/checkout-client.ts
  - apps/web/components/marketing/BuyButton.tsx
  - apps/web/components/dispatch/FundButton.tsx
  - apps/web/components/dispatch/BalmCounter.tsx
  - apps/web/components/dispatch/BuyBand.tsx
  - apps/web/lib/dispatch/balms-server.ts
  - apps/web/components/dispatch/commerce.css
  - apps/web/__tests__/fund-button.test.tsx
  - apps/web/__tests__/balm-count.test.tsx
autonomous: true
requirements: [P55-SC5, P55-SC1, P55-SC6, PUB-08, PUB-09]

must_haves:
  truths:
    - "Pressing the buy-band 'Fund …' button opens the existing Stripe Checkout via /api/checkout/create-session with quantity 1"
    - "On checkout failure the reader sees the existing voice-approved CHECKOUT_FAILURE_MESSAGE inline (aria-live) and can retry; no modal, no toast"
    - "The balms-sold tile shows the real Convex count (0 shows as '0'), upgrades live, and disappears entirely when Convex is unavailable"
    - "No urgency mechanics: no countdown, no scarcity copy, no pulsing"
    - "The /shop BuyButton still works unchanged (buy-button.test stays green)"
  artifacts:
    - path: "apps/web/lib/checkout-client.ts"
      provides: "startCheckout(quantity) + CHECKOUT_FAILURE_MESSAGE"
      exports: ["startCheckout", "CHECKOUT_FAILURE_MESSAGE"]
    - path: "apps/web/components/dispatch/FundButton.tsx"
      provides: "Dispatch-styled checkout button"
      exports: ["FundButton"]
    - path: "apps/web/components/dispatch/BalmCounter.tsx"
      provides: "Live balms tile + impact bar"
      exports: ["BalmCounter", "BalmTile"]
    - path: "apps/web/components/dispatch/BuyBand.tsx"
      provides: "#buy ink band (data-shop-callout)"
      exports: ["BuyBand"]
    - path: "apps/web/lib/dispatch/balms-server.ts"
      provides: "fetchBalms server helper (initial value)"
      exports: ["fetchBalms"]
  key_links:
    - from: "apps/web/components/dispatch/FundButton.tsx"
      to: "/api/checkout/create-session"
      via: "startCheckout(1)"
      pattern: "startCheckout\\(1\\)"
    - from: "apps/web/components/dispatch/BalmCounter.tsx"
      to: "convex stripeOrders.balmsForCharity"
      via: "useQuery(api.stripeOrders.balmsForCharity, …)"
      pattern: "api\\.stripeOrders\\.balmsForCharity"
---

<objective>
Wire the money path on the front page: extract the shared checkout client, build the Dispatch `FundButton`, the live `BalmCounter` (Convex initial-then-live), and the `#buy` ink band that hosts them.

Purpose: SC-5 — every "Fund them" path ends at the working Stripe checkout, and the balms count reflects real sales.
Output: checkout-client, refactored BuyButton, FundButton, BalmCounter, BuyBand, balms-server helper, commerce.css, 2 tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/55-public-site-redesign/55-UI-SPEC.md
@.planning/phases/55-public-site-redesign/55-RESEARCH.md
@apps/web/components/marketing/BuyButton.tsx
@apps/web/__tests__/buy-button.test.tsx
@apps/web/components/providers/ConvexClientProvider.tsx

<interfaces>
From Plans 02–04:
```typescript
// copy.ts: fundButtonLabel, CHECKOUT_LOADING, buyEyebrow, BUY_HEADLINE, buyLead, BALM_LINE, SHIPPING_NOTE, MORE_THAN_ONE_LINK, COUNT_LABEL_CURRENT, COUNT_LABEL_LIFETIME, impactCaption
// derive.ts: type ImpactRange = { min: number; max: number; unit: string }; impactProgress(balms, range): number
// Convex: api.stripeOrders.balmsForCharity({ charitySlug, sinceMs? }) -> { orders, balms, donationCents }
```
Created here (Plan 11 composes):
```typescript
export const CHECKOUT_FAILURE_MESSAGE = 'Checkout is unavailable right now. Try again in a moment.'  // moved verbatim; BuyButton re-exports
export async function startCheckout(quantity?: number): Promise<{ ok: true } | { ok: false }>
export function FundButton(p: { label: string }): JSX.Element                    // 'use client'
export function BalmTile(p: { value: number | undefined; label: string; impact?: ImpactRange | null }): JSX.Element | null
export function BalmCounter(p: { charitySlug: string; sinceMs?: number; initial: number | undefined; label: string; impact?: ImpactRange | null }): JSX.Element | null  // 'use client'
export async function fetchBalms(charitySlug: string, sinceMs?: number): Promise<number | undefined>
export function BuyBand(p: { charityName: string; charitySlug: string; sinceMs?: number; countLabel: string; initialBalms: number | undefined; impact: ImpactRange | null }): JSX.Element
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: checkout-client + BuyButton refactor + FundButton</name>
  <files>apps/web/lib/checkout-client.ts, apps/web/components/marketing/BuyButton.tsx, apps/web/components/dispatch/FundButton.tsx, apps/web/__tests__/fund-button.test.tsx</files>
  <read_first>
    - apps/web/components/marketing/BuyButton.tsx (current fetch/redirect + CHECKOUT_FAILURE_MESSAGE)
    - apps/web/__tests__/buy-button.test.tsx (must stay green; copy its fetch/location mocking approach)
    - apps/web/app/api/checkout/create-session/route.ts (request body { quantity }, response { url })
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Interaction and State Contract" FundButton row
  </read_first>
  <behavior>
    - startCheckout(1) POSTs '/api/checkout/create-session' with JSON body {"quantity":1}; on { url } sets window.location.href and resolves { ok: true }; on missing url, non-JSON or fetch rejection resolves { ok: false } (never throws)
    - FundButton idle shows label; click -> button disabled, aria-busy="true", text 'Opening checkout'; fetch called exactly once even on double click
    - failure -> button re-enabled, label restored, `[aria-live="polite"]` region text === CHECKOUT_FAILURE_MESSAGE
    - FundButton does not require ShopQtyProvider (renders standalone)
    - buy-button.test.tsx still passes unchanged (CHECKOUT_FAILURE_MESSAGE still importable from '@/components/marketing/BuyButton')
  </behavior>
  <action>
    1. lib/checkout-client.ts: move `CHECKOUT_FAILURE_MESSAGE` here verbatim; implement startCheckout per RESEARCH "Shared checkout client" (try/catch around fetch + res.json; `if (body.url) { window.location.href = body.url; return { ok: true } }`; else `{ ok: false }`).
    2. BuyButton.tsx: `export { CHECKOUT_FAILURE_MESSAGE } from '@/lib/checkout-client'`; replace its inline fetch with `const result = await startCheckout(quantity); if (result.ok) return;` then the existing error branch (keep console.error, role="alert" paragraph, 'Redirecting…' label, useShopQty usage and props exactly as today).
    3. FundButton.tsx ('use client'; `import './commerce.css'`): useState loading/error; useRef guard against double submit; render `<div className="d-fund"><button type="button" className="d-pill d-pill--accent d-fund-btn" onClick={onClick} disabled={loading} aria-busy={loading || undefined}>{loading ? CHECKOUT_LOADING : label}</button><p className="d-label d-fund-status" aria-live="polite">{error ?? ''}</p></div>`. On `{ ok: false }`: setError(CHECKOUT_FAILURE_MESSAGE), setLoading(false).
    4. fund-button.test.tsx (jsdom) for FundButton + startCheckout behaviours.
  </action>
  <verify>
    <automated>pnpm --filter web test -- fund-button buy-button shop-page && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter web test -- fund-button buy-button shop-page` exits 0
    - `grep -c "/api/checkout/create-session" apps/web/components/marketing/BuyButton.tsx` returns 0 and `grep -c "/api/checkout/create-session" apps/web/lib/checkout-client.ts` returns 1
    - `grep -n "startCheckout(1)" apps/web/components/dispatch/FundButton.tsx` matches
    - `grep -c "useShopQty" apps/web/components/dispatch/FundButton.tsx` returns 0
    - `grep -n 'aria-live="polite"' apps/web/components/dispatch/FundButton.tsx` matches
  </acceptance_criteria>
  <done>One checkout client feeds both buttons; FundButton works outside /shop; existing shop tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: BalmCounter (initial + live) + fetchBalms server helper</name>
  <files>apps/web/components/dispatch/BalmCounter.tsx, apps/web/lib/dispatch/balms-server.ts, apps/web/__tests__/balm-count.test.tsx</files>
  <read_first>
    - apps/web/components/providers/ConvexClientProvider.tsx (no provider when NEXT_PUBLIC_CONVEX_URL unset — useQuery would throw)
    - apps/web/app/api/email/unsubscribe/route.ts (ConvexHttpClient import style)
    - apps/web/lib/dispatch/derive.ts (impactProgress, ImpactRange)
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md "Balm count tile" and "Impact bar" rows
  </read_first>
  <behavior>
    - BalmTile({ value: undefined }) renders nothing; value 0 renders '0'; value 1234 renders '1,234'; label text shown
    - BalmTile with impact {min:14,max:21,unit:'wheelchair'} and value 7 renders caption 'Progress toward the next wheelchair' and an element role="meter" with aria-valuenow="50" aria-valuemin="0" aria-valuemax="100"; without impact no meter
    - BalmCounter with NEXT_PUBLIC_CONVEX_URL unset renders BalmTile(initial) and never calls useQuery
    - BalmCounter with URL set: while useQuery returns undefined shows initial; when it returns { balms: 9 } shows '9'
    - fetchBalms returns undefined when URL unset or the client throws; returns r.balms otherwise; passes sinceMs only when defined
    - Source: no 'only', 'left', 'hurry', 'countdown', 'animate-pulse' strings in BalmCounter.tsx or commerce.css
  </behavior>
  <action>
    1. BalmCounter.tsx ('use client'; `import './commerce.css'`): export `BalmTile` (pure render: `if (value === undefined) return null`; `<div className="d-count"><p className="d-label d-count-label">{label}</p><p className="d-heading d-count-value">{value.toLocaleString('en-US')}</p>{impact && (() => { const pct = Math.round(impactProgress(value, impact) * 100); return (<div className="d-impact"><p className="d-label" id="d-impact-label">{impactCaption(impact.unit)}</p><div className="d-impact-track" role="meter" aria-labelledby="d-impact-label" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span className="d-impact-fill" style={{ width: `${pct}%` }} /></div></div>) })()}</div>`); `LiveBalmCounter` calls `useQuery(api.stripeOrders.balmsForCharity, sinceMs === undefined ? { charitySlug } : { charitySlug, sinceMs })` and renders `<BalmTile value={live?.balms ?? initial} … />`; exported `BalmCounter` returns `process.env.NEXT_PUBLIC_CONVEX_URL ? <LiveBalmCounter …/> : <BalmTile value={initial} …/>`.
    2. lib/dispatch/balms-server.ts: `fetchBalms(charitySlug, sinceMs?)` using `new ConvexHttpClient(url).query(api.stripeOrders.balmsForCharity, …)` inside try/catch; returns `undefined` on any failure (the page must render without Convex).
    3. balm-count.test.tsx (jsdom): `vi.mock('convex/react', () => ({ useQuery: vi.fn() }))`, `vi.mock('@convex/_generated/api', () => ({ api: { stripeOrders: { balmsForCharity: 'balmsForCharity' } } }))`; toggle `process.env.NEXT_PUBLIC_CONVEX_URL` per test; for fetchBalms mock 'convex/browser'.
  </action>
  <verify>
    <automated>pnpm --filter web test -- balm-count && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter web test -- balm-count` exits 0
    - `grep -n "api.stripeOrders.balmsForCharity" apps/web/components/dispatch/BalmCounter.tsx apps/web/lib/dispatch/balms-server.ts` matches in both
    - `grep -n 'role="meter"' apps/web/components/dispatch/BalmCounter.tsx` matches
    - `grep -ciE "countdown|hurry|only [0-9]|left in stock|animate-pulse" apps/web/components/dispatch/BalmCounter.tsx` returns 0
  </acceptance_criteria>
  <done>Count tile shows real numbers, hides when unavailable, no urgency mechanics.</done>
</task>

<task type="auto">
  <name>Task 3: BuyBand (#buy) + commerce.css</name>
  <files>apps/web/components/dispatch/BuyBand.tsx, apps/web/components/dispatch/commerce.css, apps/web/__tests__/fund-button.test.tsx</files>
  <read_first>
    - apps/web/components/issue/ShopBand.tsx (CMR-09: data-shop-callout attribute + /shop link — carry both onto BuyBand)
    - apps/web/__tests__/issue-page-shop-callout.test.ts (Plan 12 re-points it at BuyBand)
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Page Structure" item 8 and Copywriting rows for buy band
  </read_first>
  <action>
    1. BuyBand.tsx (server component; `import './commerce.css'`): `<section id="buy" aria-labelledby="buy-title" className="d-buy d-on-dark" data-shop-callout><div className="d-container d-buy-grid"><div className="d-buy-copy"><p className="d-eyebrow d-buy-eyebrow">{buyEyebrow(charityName)}</p><h2 id="buy-title" className="d-display">{BUY_HEADLINE}</h2><p className="d-body d-buy-lead">{buyLead(charityName, impact)}</p><p className="d-body d-buy-balm">{BALM_LINE}</p><FundButton label={fundButtonLabel(charityName)} /><p className="d-label d-buy-note">{SHIPPING_NOTE}</p><a href="/shop" className="d-tap d-label d-link d-buy-more">{MORE_THAN_ONE_LINK}</a></div><div className="d-buy-side"><BalmCounter charitySlug={charitySlug} sinceMs={sinceMs} initial={initialBalms} label={countLabel} impact={impact} /><span className="d-balm-glyph" aria-hidden="true" /></div></div></section>`.
       (h2 uses Display tier per UI-SPEC "buy-band headline"; this is the band's only heading.)
    2. commerce.css (vars only, no hex): `.d-buy{background:var(--d-ink);color:var(--d-paper);padding-block:64px} .d-buy-grid{display:flex;flex-wrap:wrap;gap:48px;align-items:flex-start} .d-buy-copy{flex:1 1 min(100%, 560px);min-width:0} .d-buy-eyebrow{color:var(--d-dark-caption)} .d-buy-lead{color:var(--d-dark-lead);margin:24px 0 16px} .d-buy-balm{color:var(--d-dark-lead);margin:0 0 24px} .d-buy-note{color:var(--d-dark-caption);margin:16px 0 0} .d-buy-more{color:var(--d-paper)} .d-buy-side{flex:0 1 min(100%, 320px);display:flex;flex-direction:column;gap:24px} .d-fund{display:flex;flex-direction:column;gap:8px} .d-fund-status{color:var(--d-paper);min-height:1.35em;margin:0;border-bottom:2px solid transparent} .d-fund-status:not(:empty){border-bottom-color:var(--d-red)} .d-count{border:2px solid var(--d-paper);border-radius:20px;padding:24px} .d-count-label{color:var(--d-dark-caption);margin:0} .d-count-value{margin:8px 0 0} .d-impact{margin-top:24px} .d-impact-track{height:24px;background:var(--d-track-dark);margin-top:8px} .d-impact-fill{display:block;height:100%;background:var(--d-green)} .d-balm-glyph{display:block;width:72px;height:120px;border:3px solid var(--d-paper);border-radius:16px 16px 8px 8px;background:var(--d-accent)}`. Focus rings in this band are white via `.d-on-dark` (dispatch.css).
    3. Add to fund-button.test.tsx a jsdom render of BuyBand (mock convex/react + api as in balm-count): root `section#buy` has attribute data-shop-callout; exactly one h2; one FundButton button with text fundButtonLabel(charityName); a link to '/shop'; no element rendered for count when initialBalms undefined and URL unset.
  </action>
  <verify>
    <automated>pnpm --filter web test -- fund-button balm-count dispatch-css-responsive dispatch-a11y dispatch-voice brand-tokens && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Command above exits 0
    - `grep -n 'id="buy"' apps/web/components/dispatch/BuyBand.tsx` and `grep -n "data-shop-callout" apps/web/components/dispatch/BuyBand.tsx` and `grep -n 'href="/shop"' apps/web/components/dispatch/BuyBand.tsx` all match
    - `grep -cE "#[0-9a-fA-F]{6}" apps/web/components/dispatch/commerce.css` returns 0
    - `grep -c "8.99" apps/web/components/dispatch/BuyBand.tsx` returns 0
  </acceptance_criteria>
  <done>The #buy band hosts the only checkout-creating button and the live count.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test` full suite green; `pnpm --filter web typecheck` clean
- Real Stripe test purchase + count increment is verified in Plan 13 (human)
</verification>

<success_criteria>
Fund path and live count implemented, tested, and free of urgency mechanics.
</success_criteria>

<output>
After completion, create `.planning/phases/55-public-site-redesign/55-07-SUMMARY.md`
</output>
