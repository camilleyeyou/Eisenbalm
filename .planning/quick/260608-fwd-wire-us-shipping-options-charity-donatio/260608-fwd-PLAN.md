---
phase: quick-260608-fwd
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/.env.local
  - apps/web/.env.example
  - apps/web/app/api/checkout/create-session/route.ts
  - convex/schema.ts
  - convex/stripeOrders.ts
  - convex/charityLedger.ts
  - apps/web/scripts/charity-ledger.mjs
  - apps/web/README.md
autonomous: true
requirements: [CMR-SHIP-01, CMR-DONATE-01]

must_haves:
  truths:
    - "Every checkout session attaches the flat $3 US shipping rate when STRIPE_SHIPPING_RATE_ID is set, and silently no-ops when unset"
    - "A completed order stores product subtotal, shipping, and donation as separate cents fields, with donationAmount == amountSubtotal"
    - "The charity ledger query reports per-charity donation totals that exclude shipping"
    - "Existing Stripe webhook test suites stay green and stripeOrders.insert still returns null"
  artifacts:
    - path: "convex/schema.ts"
      provides: "stripeOrders additive fields (amountSubtotal, amountShipping, donationAmount, customerName, phone, shippingAddress) + by_createdAt index"
      contains: "amountSubtotal"
    - path: "convex/stripeOrders.ts"
      provides: "insert mutation accepting + persisting new optional args; return null preserved"
      contains: "amountSubtotal"
    - path: "convex/charityLedger.ts"
      provides: "charityTotals Convex query, runtime-safe"
      contains: "charityTotals"
    - path: "apps/web/scripts/charity-ledger.mjs"
      provides: "year-end export CLI -> stdout table + CSV"
      contains: "charityTotals"
  key_links:
    - from: "apps/web/app/api/checkout/create-session/route.ts"
      to: "process.env.STRIPE_SHIPPING_RATE_ID"
      via: "shipping_options conditional spread"
      pattern: "STRIPE_SHIPPING_RATE_ID"
    - from: "apps/web/lib/stripe/handlers.ts"
      to: "api.stripeOrders.insert"
      via: "maybeRecordOrder passes amountSubtotal/amountShipping/donationAmount/customerName/phone/shippingAddress"
      pattern: "amountSubtotal"
    - from: "apps/web/scripts/charity-ledger.mjs"
      to: "api.charityLedger.charityTotals"
      via: "ConvexHttpClient query over NEXT_PUBLIC_CONVEX_URL"
      pattern: "charityTotals"
---

<objective>
Wire flat $3.00 US shipping into every Stripe Checkout session and build a charity donation ledger whose totals count PRODUCT SUBTOTAL ONLY (shipping excluded). Persist subtotal / shipping / donation separately on each order, expose a Convex query for per-charity donation totals, and ship a year-end export script.

Purpose: Andrew needs to (a) charge real US shipping and (b) answer "how much did charity X actually receive" without counting shipping or paginating Stripe.
Output: env wiring, checkout shipping_options, additive Convex schema fields + ledger index, expanded insert mutation, webhook extraction, a new charityLedger query, and a charity-ledger.mjs export script.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- Extracted from codebase. Use directly; do not re-explore. -->

convex/stripeOrders.ts — insert mutation (CURRENT args; you ADD optionals, keep all existing):
  args: { sessionId, eventId, amountTotal:number, currency:string,
          customerEmail?:string, charitySlug?:string }
  handler inserts row { ...args, createdAt: Date.now() }, then
    await ctx.scheduler.runAfter(0, internal.emailFlow.enqueueEmailFlow, { orderId })  (try/catch)
  returns null   // PRESERVED — public return shape (API_CONTRACTS §6). DO NOT CHANGE.

convex/schema.ts — stripeOrders table (CURRENT; ADD optional fields + 1 index, never rename/remove):
  { sessionId:string, eventId:string, amountTotal:number, currency:string,
    customerEmail?:string, charitySlug?:string, createdAt:number }
  indexes: by_sessionId(['sessionId']), by_charitySlug_createdAt(['charitySlug','createdAt'])

apps/web/lib/stripe/handlers.ts — maybeRecordOrder(convex, session, eventId):
  gated by process.env.STRIPE_RECORD_ORDERS === 'false' (early return)
  try { await convex.mutation(api.stripeOrders.insert, {...}) } catch { console.error }
  CURRENT args passed: sessionId, eventId, amountTotal: session.amount_total ?? 0,
    currency: session.currency ?? 'usd', customerEmail: session.customer_details?.email ?? undefined,
    charitySlug: session.metadata?.charitySlug || undefined

apps/web/app/api/checkout/create-session/route.ts — stripe.checkout.sessions.create({...}):
  CURRENT: mode:'payment', line_items:[{price, quantity}],
    shipping_address_collection:{ allowed_countries:['US'] },
    phone_number_collection:{ enabled:true }, automatic_tax:{ enabled:false },
    success_url, cancel_url, metadata:{ source, charitySlug }
  ALL of the above must be PRESERVED. You only ADD shipping_options.

Package filter names:  web app = `web`  (e.g. `pnpm --filter web typecheck`).
                       convex   = `@eisenbalm/convex` (dev:once = `convex dev --once`).
Convex client import in scripts: `import { ConvexHttpClient } from 'convex/browser'` + `import { api } from '@convex/_generated/api'` (handlers.ts uses this pattern).
Stripe basil API: shipping address on a completed session lives at
  `session.collected_information?.shipping_details ?? session.shipping_details` (defensive cast — types lag the basil version).
  Shipping cents at `session.total_details?.amount_shipping ?? 0`. Subtotal at `session.amount_subtotal ?? 0`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Env wiring + checkout shipping_options</name>
  <files>apps/web/.env.local, apps/web/.env.example, apps/web/app/api/checkout/create-session/route.ts</files>
  <action>
1. Edit apps/web/.env.local (gitignored — edit directly; create the line if the var is absent):
   add `STRIPE_SHIPPING_RATE_ID=shr_1Tg7rtIA8FV5c3JmLjOZUbYO`

2. In apps/web/.env.example, add a documented block AFTER the STRIPE_PRICE_ID block (around line 45),
   mirroring its comment style. Leave the value BLANK in the example:
   ```
   # Stripe flat-rate US shipping. The shipping_rate id (shr_...) created in the
   # Stripe Dashboard (Shipping rates). Attached to every checkout session.
   # When unset, checkout still works — shipping_options is simply omitted.
   STRIPE_SHIPPING_RATE_ID=
   ```

3. In create-session/route.ts, attach shipping_options ONLY when the env var is set.
   Read it near the top of POST (after the priceId guard):
   ```ts
   const shippingRateId = process.env.STRIPE_SHIPPING_RATE_ID
   ```
   Then in the `stripe.checkout.sessions.create({...})` object, ADD a conditional spread.
   Preserve EVERY existing field (shipping_address_collection US, phone_number_collection,
   automatic_tax, metadata.charitySlug, success/cancel urls):
   ```ts
   ...(shippingRateId
     ? { shipping_options: [{ shipping_rate: shippingRateId }] }
     : {}),
   ```
   Graceful no-op when unset so unit tests / local without the var still pass.
  </action>
  <verify>
    <automated>pnpm --filter web typecheck</automated>
  </verify>
  <done>.env.local has the real shr_ id; .env.example has a blank documented placeholder; route adds shipping_options only when STRIPE_SHIPPING_RATE_ID is set, all prior session fields untouched; typecheck passes.</done>
</task>

<task type="auto">
  <name>Task 2: Convex schema + insert mutation (additive)</name>
  <files>convex/schema.ts, convex/stripeOrders.ts</files>
  <action>
ADDITIVE ONLY — never rename or remove existing fields/indexes (CLAUDE.md + API_CONTRACTS §6).

1. convex/schema.ts — in the `stripeOrders` table, after `charitySlug`, ADD these optional fields
   (camelCase identifiers, cents are numbers):
   ```ts
   amountSubtotal: v.optional(v.number()),   // product subtotal in cents (excludes shipping)
   amountShipping: v.optional(v.number()),   // shipping in cents
   donationAmount: v.optional(v.number()),   // == amountSubtotal; 100%-to-charity figure
   customerName: v.optional(v.string()),
   phone: v.optional(v.string()),
   shippingAddress: v.optional(v.object({
     line1: v.optional(v.string()),
     line2: v.optional(v.string()),
     city: v.optional(v.string()),
     state: v.optional(v.string()),
     postalCode: v.optional(v.string()),
     country: v.optional(v.string()),
   })),
   ```
   KEEP `createdAt` and all existing fields. ADD a `by_createdAt` index alongside the two existing ones:
   ```ts
   .index('by_sessionId', ['sessionId'])
   .index('by_charitySlug_createdAt', ['charitySlug', 'createdAt'])
   .index('by_createdAt', ['createdAt'])
   ```

2. convex/stripeOrders.ts — extend the `insert` mutation `args` with the SAME new optional fields
   (amountSubtotal, amountShipping, donationAmount: all v.optional(v.number()); customerName,
   phone: v.optional(v.string()); shippingAddress: v.optional(v.object({...same shape...}))).
   In the handler, persist them into the ctx.db.insert('stripeOrders', {...}) object alongside the
   existing fields. donationAmount is persisted exactly as passed (caller guarantees == amountSubtotal).
   PRESERVE: the ctx.scheduler.runAfter(0, internal.emailFlow.enqueueEmailFlow, { orderId }) try/catch
   block AND `return null`. Do NOT change the public return shape.
  </action>
  <verify>
    <automated>pnpm --filter @eisenbalm/convex exec convex dev --once</automated>
  </verify>
  <done>Convex codegen succeeds; stripeOrders has 6 new optional fields + by_createdAt index; insert accepts + persists them; emailFlow scheduler call + `return null` intact.</done>
</task>

<task type="auto">
  <name>Task 3: Webhook extraction in maybeRecordOrder</name>
  <files>apps/web/lib/stripe/handlers.ts</files>
  <action>
In `maybeRecordOrder`, keep the STRIPE_RECORD_ORDERS gate and the best-effort try/catch.
Inside the try, BEFORE the insert call, extract the new values from the completed Checkout Session.
Use defensive casts because the basil API types lag the runtime shape:

```ts
const amountSubtotal = session.amount_subtotal ?? 0
const amountShipping = session.total_details?.amount_shipping ?? 0
const details = session.customer_details
// basil moved shipping under collected_information; fall back to legacy field.
const shipping =
  (session as unknown as {
    collected_information?: { shipping_details?: { address?: Record<string, string | null> } }
    shipping_details?: { address?: Record<string, string | null> }
  }).collected_information?.shipping_details ??
  (session as unknown as { shipping_details?: { address?: Record<string, string | null> } }).shipping_details
const addr = shipping?.address
```

Then pass to api.stripeOrders.insert (KEEP existing sessionId, eventId, amountTotal, currency,
customerEmail, charitySlug) PLUS:
```ts
amountSubtotal,
amountShipping,
donationAmount: amountSubtotal,            // donation = product subtotal only (excludes shipping)
customerName: details?.name ?? undefined,
phone: details?.phone ?? undefined,
shippingAddress: addr
  ? {
      line1: addr.line1 ?? undefined,
      line2: addr.line2 ?? undefined,
      city: addr.city ?? undefined,
      state: addr.state ?? undefined,
      postalCode: addr.postal_code ?? undefined,
      country: addr.country ?? undefined,
    }
  : undefined,
```
Leave the catch (console.error + swallow) unchanged. amountTotal stays `session.amount_total ?? 0`.
  </action>
  <verify>
    <automated>pnpm --filter web test:unit __tests__/stripe-webhook.test.ts __tests__/stripe-webhook-idempotency.test.ts __tests__/stripe-webhook-source.test.ts</automated>
  </verify>
  <done>maybeRecordOrder passes amountSubtotal, amountShipping, donationAmount(=subtotal), customerName, phone, shippingAddress to insert; gate + try/catch preserved; all 3 stripe suites green.</done>
</task>

<task type="auto">
  <name>Task 4: charityLedger query + export script + README note</name>
  <files>convex/charityLedger.ts, apps/web/scripts/charity-ledger.mjs, apps/web/README.md</files>
  <action>
1. Create convex/charityLedger.ts — a Convex `query` (NOT mutation, NO Node imports — runtime-safe):
   ```ts
   import { query } from './_generated/server'
   import { v } from 'convex/values'

   export const charityTotals = query({
     args: { startMs: v.optional(v.number()), endMs: v.optional(v.number()) },
     handler: async (ctx, args) => {
       let rows
       if (args.startMs !== undefined || args.endMs !== undefined) {
         const start = args.startMs ?? 0
         const end = args.endMs ?? Number.MAX_SAFE_INTEGER
         rows = await ctx.db
           .query('stripeOrders')
           .withIndex('by_createdAt', (q) => q.gte('createdAt', start).lte('createdAt', end))
           .collect()
       } else {
         rows = await ctx.db.query('stripeOrders').collect()
       }
       const groups = new Map<string, { donationTotal: number; shippingTotal: number; orderCount: number; currency: string }>()
       for (const r of rows) {
         const slug = r.charitySlug ?? 'unknown'
         // legacy rows predate amountSubtotal/donationAmount — fall back down the chain.
         const donation = r.donationAmount ?? r.amountSubtotal ?? r.amountTotal ?? 0
         const shipping = r.amountShipping ?? 0
         const g = groups.get(slug) ?? { donationTotal: 0, shippingTotal: 0, orderCount: 0, currency: r.currency ?? 'usd' }
         g.donationTotal += donation
         g.shippingTotal += shipping
         g.orderCount += 1
         groups.set(slug, g)
       }
       return Array.from(groups.entries())
         .map(([charitySlug, g]) => ({ charitySlug, ...g }))
         .sort((a, b) => b.donationTotal - a.donationTotal)
     },
   })
   ```

2. Create apps/web/scripts/charity-ledger.mjs (ESM, run with node):
   - import { ConvexHttpClient } from 'convex/browser' and { api } from '../../../convex/_generated/api.js'
     (resolve the path from apps/web/scripts to convex/_generated; if import fails at runtime, fall back
     to client.query('charityLedger:charityTotals', args) by string reference).
   - read NEXT_PUBLIC_CONVEX_URL from process.env; exit(1) with a clear message if unset.
   - parse optional `--year YYYY`: when present compute startMs = Date.UTC(year,0,1,0,0,0,0),
     endMs = Date.UTC(year+1,0,1,0,0,0,0) - 1; otherwise pass {} (all-time).
   - call charityTotals; print a readable aligned table to stdout
     (columns: charitySlug | donation ($) | shipping ($) | orders | currency; cents/100 to 2dp).
   - write a CSV file `charity-ledger-<year|all>.csv` with header
     `charitySlug,donationTotalCents,shippingTotalCents,orderCount,currency` and one row per charity;
     print the written path. Pure stdout/fs only — no other deps.

3. Append a brief "Charity donation ledger" usage note to apps/web/README.md (after the Verifying section):
   document `NEXT_PUBLIC_CONVEX_URL=... node scripts/charity-ledger.mjs --year 2026` (and without
   `--year` for all-time), and state that donation totals are PRODUCT SUBTOTAL ONLY (shipping excluded).
  </action>
  <verify>
    <automated>pnpm --filter @eisenbalm/convex exec convex dev --once && node --check apps/web/scripts/charity-ledger.mjs</automated>
  </verify>
  <done>charityLedger.ts is a runtime-safe Convex query grouping by charitySlug, summing donationAmount (with legacy fallback) and amountShipping, sorted donation desc; codegen exposes api.charityLedger.charityTotals; charity-ledger.mjs parses --year and is syntactically valid; README documents usage + the subtotal-only rule.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>Full shipping + donation-ledger wiring: $3 US shipping on checkout, separate subtotal/shipping/donation persistence, and the charityTotals ledger that excludes shipping.</what-built>
  <how-to-verify>
With apps/web/.env.local populated (STRIPE_SHIPPING_RATE_ID, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, NEXT_PUBLIC_CONVEX_URL) and Convex dev running:

1. Start dev: `pnpm --filter web dev`
2. Checkout shipping:
   `curl -s -X POST http://localhost:3000/api/checkout/create-session -H 'content-type: application/json' -d '{"quantity":1}'`
   Open the returned url (or retrieve the session via Stripe CLI) and confirm Stripe Checkout shows
   a $3.00 shipping line AND a US shipping-address form.
3. Simulate a completed order (Stripe CLI):
   `stripe trigger checkout.session.completed --add checkout_session:amount_subtotal=2100 --add checkout_session:amount_total=2400`
   (or sign your own checkout.session.completed event carrying amount_subtotal=2100,
   total_details.amount_shipping=300, amount_total=2400 + a shipping address, POST to
   /api/stripe/webhook). Confirm HTTP 200.
4. In the Convex dashboard data view, find the new stripeOrders row: amountSubtotal=2100,
   amountShipping=300, donationAmount=2100, amountTotal=2400, shippingAddress populated.
5. Ledger: `NEXT_PUBLIC_CONVEX_URL=<url> node apps/web/scripts/charity-ledger.mjs`
   Confirm the charity's donationTotal reflects 2100 (NOT 2400) and shippingTotal reflects 300,
   and a CSV file was written.
  </how-to-verify>
  <resume-signal>Type "approved" or describe what was off (e.g. shipping line missing, donation counted 2400).</resume-signal>
</task>

</tasks>

<verification>
- `pnpm --filter web typecheck` passes (Tasks 1, 3).
- `pnpm --filter @eisenbalm/convex exec convex dev --once` codegen clean (Tasks 2, 4).
- 3 stripe vitest suites green (Task 3) — no regression.
- `node --check apps/web/scripts/charity-ledger.mjs` valid (Task 4).
- Live smoke confirms $3 shipping on session, subtotal/shipping/donation stored separately, donation == subtotal (excludes shipping) in both the row and the ledger (Task 5).
</verification>

<success_criteria>
- STRIPE_SHIPPING_RATE_ID wired: real value in .env.local, blank documented placeholder in .env.example.
- Checkout attaches `shipping_options: [{ shipping_rate }]` only when the env var is set; all prior session fields preserved.
- stripeOrders gained 6 additive optional fields + by_createdAt index; no existing field renamed/removed; insert persists them; `return null` + emailFlow scheduler call preserved.
- maybeRecordOrder extracts amount_subtotal, total_details.amount_shipping(default 0), customer name/phone/email, basil-safe shipping address; donationAmount == amount_subtotal.
- charityLedger.charityTotals: runtime-safe Convex query, groups by charitySlug, donation (fallback chain) excludes shipping, sorted donation desc.
- charity-ledger.mjs prints a table + writes CSV, honors optional --year; README documents it and the subtotal-only rule.
</success_criteria>

<output>
After completion, create `.planning/quick/260608-fwd-wire-us-shipping-options-charity-donatio/260608-fwd-SUMMARY.md`
</output>
