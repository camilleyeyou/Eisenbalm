---
phase: quick-260608-gvm
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/.env.local
  - apps/web/.env.example
  - apps/web/app/api/checkout/create-session/route.ts
  - apps/web/README.md
autonomous: false
requirements: [CMR-SHIP-INTL, CMR-10]
must_haves:
  truths:
    - "A Stripe Checkout session offers TWO selectable shipping options: US flat $3 (shr_1Tg7rtIA8FV5c3JmLjOZUbYO) and International flat $12 (shr_1Tg8WzIA8FV5c3Jm9SMT0UJd)."
    - "shipping_address_collection.allowed_countries is exactly ['US','CA','GB','DE','FR','IE','NL','ES','IT']."
    - "When both shipping rate env vars are unset, the session still creates with NO shipping_options key (the 3 stripe vitest suites + checkout-create-session suite stay green)."
    - ".env.example documents STRIPE_SHIPPING_RATE_ID_INTL as the optional international ($12) rate."
    - "apps/web/README.md no longer contains the 'Phase 8 adds Stripe variables to this list.' TODO in either the Environment variables table or the Deploying to Vercel list; both list the Stripe vars."
  artifacts:
    - path: "apps/web/app/api/checkout/create-session/route.ts"
      provides: "Two-option shipping array + widened allowed_countries"
      contains: "STRIPE_SHIPPING_RATE_ID_INTL"
    - path: "apps/web/.env.example"
      provides: "Documented blank STRIPE_SHIPPING_RATE_ID_INTL placeholder"
      contains: "STRIPE_SHIPPING_RATE_ID_INTL"
    - path: "apps/web/README.md"
      provides: "Completed Stripe env documentation in both tables"
      contains: "STRIPE_SHIPPING_RATE_ID_INTL"
  key_links:
    - from: "apps/web/app/api/checkout/create-session/route.ts"
      to: "process.env.STRIPE_SHIPPING_RATE_ID_INTL"
      via: "env read near existing shippingRateId read"
      pattern: "STRIPE_SHIPPING_RATE_ID_INTL"
    - from: "session.shipping_options"
      to: "[{shipping_rate: US}, {shipping_rate: INTL}]"
      via: "non-empty array spread onto sessions.create"
      pattern: "shipping_options"
---

<objective>
Add an international shipping option to Stripe Checkout (US + Canada + UK + EU core), and finish the two stale "Phase 8 adds Stripe variables to this list." TODO lines in apps/web/README.md.

Purpose: International buyers can complete checkout (US-only `allowed_countries` currently blocks them), and Andrew gets a single accurate env-var reference for production Stripe setup. Builds directly on quick task 260608-fwd (US flat shipping + donation-excludes-shipping ledger).

Output: Updated checkout route offering two shipping rates, env documentation (blank placeholder + README rows), and a live smoke-verified session.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

<interfaces>
<!-- Current checkout route (apps/web/app/api/checkout/create-session/route.ts). -->
<!-- Existing US shipping wiring (lines 46-94) — extend, do NOT rewrite: -->

```ts
// line 48: existing US rate read
const shippingRateId = process.env.STRIPE_SHIPPING_RATE_ID

// lines 83-101: existing session create (PRESERVE all fields)
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  line_items: [{ price: priceId, quantity }],
  shipping_address_collection: { allowed_countries: ['US'] },   // <- widen this
  phone_number_collection: { enabled: true },
  automatic_tax: { enabled: false },
  ...(shippingRateId
    ? { shipping_options: [{ shipping_rate: shippingRateId }] }   // <- replace with array builder
    : {}),
  success_url: buildSuccessUrl(),
  cancel_url: buildCancelUrl(),
  metadata: { source: 'eisenbalm-dispatch', charitySlug },
})
```

Locked values:
- allowed_countries → ['US','CA','GB','DE','FR','IE','NL','ES','IT']
- US rate env STRIPE_SHIPPING_RATE_ID = shr_1Tg7rtIA8FV5c3JmLjOZUbYO
- INTL rate env STRIPE_SHIPPING_RATE_ID_INTL = shr_1Tg8WzIA8FV5c3Jm9SMT0UJd
- Both shipping_options shown to every buyer (no per-country filtering — accepted).
- Donation = product subtotal only; shipping excluded — ALREADY DONE in 260608-fwd. NO Convex/ledger/handler changes here.

Test note: apps/web/__tests__/checkout-create-session.test.ts only asserts
allowed_countries is a non-empty array (not hardcoded ['US']) — widening keeps it green.
The 3 stripe-webhook* suites are webhook-only and unaffected.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Wire STRIPE_SHIPPING_RATE_ID_INTL env (local + example)</name>
  <files>apps/web/.env.local, apps/web/.env.example</files>
  <action>
    apps/web/.env.local (gitignored — edit directly, do NOT commit):
    - Add the line `STRIPE_SHIPPING_RATE_ID_INTL=shr_1Tg8WzIA8FV5c3Jm9SMT0UJd`
      immediately after the existing STRIPE_SHIPPING_RATE_ID line. (If the file
      lacks the US line, just append the INTL line near the Stripe block.)

    apps/web/.env.example (committed):
    - Immediately below the existing STRIPE_SHIPPING_RATE_ID block (after line 50,
      the `STRIPE_SHIPPING_RATE_ID=` line), add a BLANK placeholder mirroring that
      block's comment style:

      # Stripe flat-rate INTERNATIONAL shipping ($12). The shipping_rate id (shr_...)
      # for Canada/UK/EU buyers. OPTIONAL — when unset, the international option is
      # simply not offered (US-only checkout still works).
      STRIPE_SHIPPING_RATE_ID_INTL=

    Do NOT paste the real shr_ value into .env.example (keep it blank, like
    STRIPE_SHIPPING_RATE_ID). camelCase n/a (env vars are SCREAMING_SNAKE per file convention).
  </action>
  <verify>
    <automated>grep -q "STRIPE_SHIPPING_RATE_ID_INTL=" apps/web/.env.example && grep -q "STRIPE_SHIPPING_RATE_ID_INTL=shr_1Tg8WzIA8FV5c3Jm9SMT0UJd" apps/web/.env.local && echo OK</automated>
  </verify>
  <done>.env.local has the real INTL rate id; .env.example has a documented blank STRIPE_SHIPPING_RATE_ID_INTL placeholder matching the existing US block's style.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Offer US + International shipping in checkout session</name>
  <files>apps/web/app/api/checkout/create-session/route.ts</files>
  <behavior>
    - allowed_countries is exactly ['US','CA','GB','DE','FR','IE','NL','ES','IT'].
    - Both env ids set → shipping_options = [{shipping_rate: US}, {shipping_rate: INTL}] (US first).
    - Only US set → shipping_options = [{shipping_rate: US}].
    - Only INTL set → shipping_options = [{shipping_rate: INTL}].
    - Neither set → no shipping_options key on the session at all (graceful no-op; suites stay green).
  </behavior>
  <action>
    Near the existing US rate read (line 48), also read the INTL id:
      const shippingRateId = process.env.STRIPE_SHIPPING_RATE_ID
      const shippingRateIdIntl = process.env.STRIPE_SHIPPING_RATE_ID_INTL

    Build a typed shipping_options array (US first, then INTL), pushing only set ids:
      const shippingOptions: { shipping_rate: string }[] = []
      if (shippingRateId) shippingOptions.push({ shipping_rate: shippingRateId })
      if (shippingRateIdIntl) shippingOptions.push({ shipping_rate: shippingRateIdIntl })

    In stripe.checkout.sessions.create({...}):
    - Change allowed_countries to ['US','CA','GB','DE','FR','IE','NL','ES','IT'].
      (Stripe types allowed_countries as a string-literal union; if tsc complains,
      this exact list is valid ISO country codes and should typecheck — do NOT cast
      to `any`.)
    - Replace the inline `...(shippingRateId ? {...} : {})` spread with:
        ...(shippingOptions.length > 0 ? { shipping_options: shippingOptions } : {})
    - Update the CMR-10 / CMR-SHIP-01 comments to note two rates (US + intl) are
      offered to all buyers.

    PRESERVE every other field exactly: mode, line_items, phone_number_collection,
    automatic_tax:{enabled:false}, success_url, cancel_url,
    metadata{source,charitySlug}, the priceId guard, the quantity parse, the
    charitySlug Sanity fetch, and getStripeServer error handling. camelCase identifiers.
  </action>
  <verify>
    <automated>pnpm --filter web typecheck && pnpm --filter web test -- checkout-create-session stripe-webhook stripe-webhook-idempotency stripe-webhook-source --run 2>/dev/null || pnpm --filter web test --run 2>&1 | tail -20</automated>
  </verify>
  <done>typecheck passes; checkout-create-session + 3 stripe-webhook suites green; route reads both env ids, widens allowed_countries to the 9-country list, and attaches shipping_options only when the array is non-empty.</done>
</task>

<task type="auto">
  <name>Task 3: Finish Stripe env docs in README (both stale TODOs)</name>
  <files>apps/web/README.md</files>
  <action>
    (a) Environment variables table (around lines 68-76). Add these rows after the
    CONVEX_DEPLOY_KEY row (keep existing rows + the table header):
      | `STRIPE_SECRET_KEY` | yes | _none_ | **SECRET. NEVER commit. NEVER expose via NEXT_PUBLIC_*.** Server Stripe API key (`sk_test_…` / `sk_live_…`). |
      | `STRIPE_WEBHOOK_SECRET` | yes | _none_ | **SECRET. NEVER commit.** Webhook signing secret (`whsec_…`) for `/api/stripe/webhook`. |
      | `STRIPE_PRICE_ID` | yes | _none_ | Stripe Price id (`price_…`) for the lip balm SKU. |
      | `STRIPE_SHIPPING_RATE_ID` | no | _none_ | US flat-rate shipping id (`shr_…`, $3). Omit → no US shipping line. |
      | `STRIPE_SHIPPING_RATE_ID_INTL` | no | _none_ | International flat-rate shipping id (`shr_…`, $12, CA/UK/EU). Omit → international option not offered. |
      | `STRIPE_RECORD_ORDERS` | no | `true` | Write order rows to Convex `stripeOrders` on successful checkout. `false` → skip persistence. |
    Then REPLACE the line `No write token is needed for the web app at runtime. Phase 8 adds Stripe env vars to this list.`
    with: `No write token is needed for the web app at runtime. Stripe secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) stay out of `NEXT_PUBLIC_*` — set them in `apps/web/.env.local` (local) and the Vercel project dashboard (production).`

    (b) Deploying to Vercel "Value" table (around lines 274-280). Add these rows
    after the NEXT_PUBLIC_SITE_URL row, using NON-secret placeholder descriptions
    (DO NOT paste real key/secret values):
      | `STRIPE_SECRET_KEY` | from Stripe Dashboard → Developers → API keys (test or live) |
      | `STRIPE_WEBHOOK_SECRET` | from Stripe Dashboard → Developers → Webhooks → endpoint signing secret |
      | `STRIPE_PRICE_ID` | `price_…` for the lip balm SKU (Stripe Dashboard → Products) |
      | `STRIPE_SHIPPING_RATE_ID` | `shr_…` US flat rate ($3) |
      | `STRIPE_SHIPPING_RATE_ID_INTL` | `shr_…` international flat rate ($12, optional) |
      | `STRIPE_RECORD_ORDERS` | `true` (optional; `false` to skip Convex order rows) |
    Then REPLACE the line `No write token needed on the web side. Phase 8 adds Stripe variables to this list.`
    with: `No write token needed on the web side. Set the Stripe variables above in the Vercel dashboard — never commit secret values.`

    Voice: dry, precise (Jesse voice). Both occurrences of the "Phase 8 adds…"
    sentence must be gone.
  </action>
  <verify>
    <automated>! grep -q "Phase 8 adds Stripe" apps/web/README.md && grep -c "STRIPE_SHIPPING_RATE_ID_INTL" apps/web/README.md | grep -q "2" && echo OK</automated>
  </verify>
  <done>Neither stale "Phase 8 adds Stripe…" sentence remains; both README tables list the six Stripe env vars; secret vars marked SECRET in the env table and given non-secret placeholders in the Vercel table.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <what-built>
    International + US shipping in the live checkout session: widened allowed_countries
    (US/CA/GB/EU) and a two-entry shipping_options array (US $3 + International $12).
  </what-built>
  <how-to-verify>
    With the web dev server running (`pnpm dev:web`) and apps/web/.env.local holding
    both STRIPE_SHIPPING_RATE_ID and STRIPE_SHIPPING_RATE_ID_INTL (test mode):
    1. POST a session:
       `curl -s -XPOST http://localhost:3000/api/checkout/create-session -H 'content-type: application/json' -d '{"quantity":1}'`
       → expect `{ "url": "https://checkout.stripe.com/..." }` (200).
    2. Extract the `cs_...` session id from the url (or list recent sessions) and
       retrieve it via the Stripe API / Dashboard.
    3. Confirm: shipping_address_collection.allowed_countries includes CA, GB, and
       at least one EU code (DE/FR/IE/NL/ES/IT) — the full set is
       ['US','CA','GB','DE','FR','IE','NL','ES','IT'].
    4. Confirm shipping_options contains BOTH shr_1Tg7rtIA8FV5c3JmLjOZUbYO ($3) and
       shr_1Tg8WzIA8FV5c3Jm9SMT0UJd ($12).
    Expected: both rates selectable; international addresses accepted.
  </how-to-verify>
  <resume-signal>Type "approved" or describe the discrepancy (e.g. missing rate / wrong country list).</resume-signal>
</task>

</tasks>

<verification>
- `pnpm --filter web typecheck` passes.
- checkout-create-session + stripe-webhook + stripe-webhook-idempotency + stripe-webhook-source suites all green.
- `grep -q "Phase 8 adds Stripe" apps/web/README.md` returns nothing (both TODOs gone).
- Live session shows the 9-country list and both shipping rates (human checkpoint).
</verification>

<success_criteria>
- International buyers (CA/UK/EU core) can reach Stripe Checkout and pick a shipping rate.
- Both flat rates ($3 US, $12 intl) are attached as selectable shipping_options; graceful no-op when env unset.
- README documents all six Stripe env vars in both the env table and the Vercel deploy table; no stale "Phase 8" sentences.
- No Convex/ledger/handler changes; donation-excludes-shipping behavior from 260608-fwd untouched.
</success_criteria>

<output>
After completion, create `.planning/quick/260608-gvm-add-international-shipping-option-finish/260608-gvm-SUMMARY.md`
</output>
