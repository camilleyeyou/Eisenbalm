---
phase: 08-stripe-commerce
plan: 04
type: execute
wave: 2
depends_on:
  - "08-01"
  - "08-03"
files_modified:
  - apps/web/lib/stripe/server.ts
  - apps/web/lib/stripe/constants.ts
  - apps/web/app/api/checkout/create-session/route.ts
  - apps/web/components/marketing/BuyButton.tsx
autonomous: true
requirements:
  - CMR-02
  - CMR-10
must_haves:
  truths:
    - "apps/web/lib/stripe/server.ts exports a getStripeServer() singleton-factory that initializes Stripe with pinned apiVersion and throws on missing STRIPE_SECRET_KEY"
    - "apps/web/app/api/checkout/create-session/route.ts exports POST handler with `export const runtime = 'nodejs'`"
    - "The checkout API calls stripe.checkout.sessions.create with mode='payment', line_items=[{price: STRIPE_PRICE_ID, quantity: 1}], shipping_address_collection (CMR-10), success_url and cancel_url"
    - "The API returns NextResponse.json({ url: session.url }) on success and a 500 error JSON when STRIPE_PRICE_ID is missing"
    - "apps/web/components/marketing/BuyButton.tsx is a Client Component that POSTs to /api/checkout/create-session and redirects to the returned URL via window.location.href"
    - "The unit tests __tests__/checkout-create-session.test.ts (Plan 08-01 Task 2) pass after this plan"
    - "The session metadata locks in the current charity slug as `charitySlug` (RESEARCH Open Question 1) to avoid race with pipeline publishing between click and webhook"
  artifacts:
    - path: "apps/web/lib/stripe/server.ts"
      provides: "Singleton getStripeServer() with pinned apiVersion"
      exports: ["getStripeServer"]
    - path: "apps/web/lib/stripe/constants.ts"
      provides: "STRIPE_API_VERSION pin + success/cancel URL builders"
      exports: ["STRIPE_API_VERSION", "buildSuccessUrl", "buildCancelUrl"]
    - path: "apps/web/app/api/checkout/create-session/route.ts"
      provides: "POST handler creating Stripe Checkout session, returns { url }"
      exports: ["POST", "runtime"]
    - path: "apps/web/components/marketing/BuyButton.tsx"
      provides: "Client Component button that initiates checkout"
      exports: ["BuyButton"]
  key_links:
    - from: "apps/web/app/api/checkout/create-session/route.ts"
      to: "apps/web/lib/stripe/server.ts getStripeServer()"
      via: "Single Stripe SDK client per server runtime; pinned apiVersion"
      pattern: "getStripeServer\\(\\)"
    - from: "apps/web/components/marketing/BuyButton.tsx"
      to: "apps/web/app/api/checkout/create-session/route.ts"
      via: "fetch('/api/checkout/create-session', { method: 'POST' })"
      pattern: "/api/checkout/create-session"
    - from: "apps/web/app/api/checkout/create-session/route.ts"
      to: "apps/web/lib/sanity/client.ts (read latest charity for metadata)"
      via: "Server-side GROQ query at session-create time locks charitySlug"
      pattern: "sanityClient\\.fetch"
---

<objective>
Land the Stripe SDK singleton, the checkout-session API endpoint, and the BuyButton client component. After this plan: `pnpm --filter web test:unit __tests__/checkout-create-session.test.ts` goes green (currently fails because target route does not exist).

Purpose: Honors CMR-02 (Stripe Checkout via `sessions.create()`) and CMR-10 (`shipping_address_collection` enabled). Implements RESEARCH §Pattern 2 verbatim. Closes Open Question 1 by locking `charitySlug` into session metadata at click time (not at webhook time) to avoid race with mid-week issue publishing.

Output: A POST endpoint that returns a Stripe-hosted Checkout URL; a Client Component that triggers it. Wave 0 unit test for CMR-02 + CMR-10 turns green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/08-stripe-commerce/08-RESEARCH.md
@apps/web/.env.example
@apps/web/lib/sanity/client.ts
@apps/web/lib/site.ts
@apps/web/components/ui/button.tsx
@apps/web/__tests__/checkout-create-session.test.ts

<interfaces>
<!-- Stripe SDK signature (relevant subset; see @types/stripe):
       new Stripe(key: string, opts?: { apiVersion?: string; typescript?: boolean })
       stripe.checkout.sessions.create(params: Stripe.Checkout.SessionCreateParams)
         params:
           mode: 'payment' | 'setup' | 'subscription'
           line_items: Array<{ price: string; quantity: number }>
           shipping_address_collection?: { allowed_countries: Stripe.CheckoutSessionCreateParams.ShippingAddressCollection.AllowedCountry[] }
           phone_number_collection?: { enabled: boolean }
           success_url: string
           cancel_url: string
           metadata?: Record<string, string>
         returns: Stripe.Checkout.Session  // .url is the hosted-page URL

     Wave 0 test fixture (apps/web/__tests__/checkout-create-session.test.ts):
       Mocks @/lib/stripe/server.getStripeServer to return { checkout: { sessions: { create: vi.fn() } } }
       Asserts: returns 200 with { url } that starts with 'https://checkout.stripe.com/'
       Asserts: args.mode === 'payment'
       Asserts: args.line_items === [{ price: 'price_test_lipbalm_001', quantity: 1 }]
       Asserts: args.shipping_address_collection.allowed_countries is a non-empty array
       Asserts: args.success_url contains '/shop/thank-you' and '{CHECKOUT_SESSION_ID}'
       Asserts: args.cancel_url ends with '/shop'
       Asserts: returns 500 when STRIPE_PRICE_ID env is unset

     Site URL helper (already exists, Phase 2):
       apps/web/lib/site.ts -> getSiteUrl(): string  // returns NEXT_PUBLIC_SITE_URL or 'http://localhost:3000' -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create apps/web/lib/stripe/server.ts + apps/web/lib/stripe/constants.ts</name>
  <read_first>
    - apps/web/lib/sanity/client.ts (singleton pattern: const x = createClient({...}); export const ... — Phase 2 establishes this)
    - apps/web/lib/site.ts (existing helper for SITE_NAME, getSiteUrl)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Code Examples §Stripe Server Client (verbatim shape; pin apiVersion)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Common Pitfalls §Pitfall 6 (apiVersion drift — pin explicitly)
    - .planning/phases/08-stripe-commerce/08-03-schema-and-deps-SUMMARY.md (for the resolved Stripe SDK version and recommended apiVersion string)
  </read_first>
  <behavior>
    - Test 1: `getStripeServer()` called twice returns the same instance (singleton).
    - Test 2: `getStripeServer()` throws an Error mentioning "STRIPE_SECRET_KEY" when env var is unset.
    - Test 3: STRIPE_API_VERSION constant exists and is a non-empty string (the pinned apiVersion).
    - Test 4: `buildSuccessUrl()` returns a URL containing `/shop/thank-you` and the literal `{CHECKOUT_SESSION_ID}` placeholder (Stripe substitutes at redirect time).
    - Test 5: `buildCancelUrl()` returns a URL ending in `/shop`.
  </behavior>
  <files>apps/web/lib/stripe/server.ts, apps/web/lib/stripe/constants.ts</files>
  <action>
    **Create `apps/web/lib/stripe/constants.ts`:**

    ```typescript
    /**
     * Stripe API version pin (RESEARCH Pitfall 6).
     *
     * Pinning prevents silent API contract drift when the SDK ships a new
     * major. To bump: update this constant in one place, run integration
     * tests + Stripe Dashboard sanity-check, then commit.
     *
     * Match the SDK major resolved in Plan 08-03 — if SDK is on the 18.x
     * line, the matching default apiVersion is '2025-04-30.basil' (record
     * the actual choice in the Plan 08-03 SUMMARY and reference here).
     */
    import { getSiteUrl } from '@/lib/site'

    export const STRIPE_API_VERSION = '2025-04-30.basil' as const
    // NOTE: If Plan 08-03 SUMMARY recorded a different SDK major's default
    // apiVersion, swap this string accordingly. The pin is what matters,
    // not the specific value.

    /** Stripe substitutes {CHECKOUT_SESSION_ID} at redirect time. */
    export const SUCCESS_PATH = '/shop/thank-you?session_id={CHECKOUT_SESSION_ID}'
    export const CANCEL_PATH = '/shop'

    export function buildSuccessUrl(): string {
      return `${getSiteUrl()}${SUCCESS_PATH}`
    }

    export function buildCancelUrl(): string {
      return `${getSiteUrl()}${CANCEL_PATH}`
    }
    ```

    **Create `apps/web/lib/stripe/server.ts`:**

    ```typescript
    /**
     * Stripe server SDK singleton.
     *
     * - Lazy: initialized on first call so env vars resolve at runtime,
     *   not at module load. This keeps Vitest happy when STRIPE_SECRET_KEY
     *   is set per-test.
     * - Singleton: cached on a module-level variable so we don't pay
     *   construction cost or break Stripe SDK's internal connection pool.
     * - apiVersion pinned via STRIPE_API_VERSION constant (Pitfall 6).
     *
     * Throws when STRIPE_SECRET_KEY is missing. The webhook + checkout
     * route handlers each map this to a 500 response so misconfiguration
     * is loud, not silent.
     */
    import Stripe from 'stripe'
    import { STRIPE_API_VERSION } from './constants'

    let _stripe: Stripe | null = null

    export function getStripeServer(): Stripe {
      if (_stripe) return _stripe
      const key = process.env.STRIPE_SECRET_KEY
      if (!key) {
        throw new Error(
          'STRIPE_SECRET_KEY is not set. Plan 08-02 (Andrew checkpoint) provisions this.',
        )
      }
      _stripe = new Stripe(key, {
        apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
        typescript: true,
      })
      return _stripe
    }

    /**
     * Test-only helper: clear the cached client so a test can install a fresh
     * mock or env value between cases.
     *
     * NOT exported in production builds — tests import via path alias and
     * vitest doesn't run a separate production bundle, so calling this in
     * tests is fine. Do NOT call from runtime code.
     */
    export function _resetStripeServerForTests(): void {
      _stripe = null
    }
    ```

    Code style notes:
    - Use `Stripe.LatestApiVersion` typecast on the pinned version string so TypeScript treats the union literal as compatible with the SDK's evolving type alias. This avoids needing a stripe SDK major bump just to keep TypeScript happy.
    - The `_resetStripeServerForTests` export starts with `_` (convention for non-public API); test files can import it explicitly when needed.

    **Both files: NO `'use server'` directive (these are server-only modules, never imported by client code; pure server runtime).**
  </action>
  <verify>
    <automated>test -f apps/web/lib/stripe/server.ts && test -f apps/web/lib/stripe/constants.ts && grep -q "getStripeServer" apps/web/lib/stripe/server.ts && grep -q "STRIPE_API_VERSION" apps/web/lib/stripe/constants.ts && grep -q "as const" apps/web/lib/stripe/constants.ts && grep -q "buildSuccessUrl" apps/web/lib/stripe/constants.ts && grep -q "buildCancelUrl" apps/web/lib/stripe/constants.ts && grep -q "CHECKOUT_SESSION_ID" apps/web/lib/stripe/constants.ts && pnpm --filter web typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/lib/stripe/server.ts` exits 0
    - `test -f apps/web/lib/stripe/constants.ts` exits 0
    - `grep -q "export function getStripeServer" apps/web/lib/stripe/server.ts` exits 0
    - `grep -q "import Stripe from 'stripe'" apps/web/lib/stripe/server.ts` exits 0
    - `grep -q "apiVersion: STRIPE_API_VERSION" apps/web/lib/stripe/server.ts` exits 0
    - `grep -q "export const STRIPE_API_VERSION" apps/web/lib/stripe/constants.ts` exits 0
    - `grep -q "export function buildSuccessUrl" apps/web/lib/stripe/constants.ts` exits 0
    - `grep -q "export function buildCancelUrl" apps/web/lib/stripe/constants.ts` exits 0
    - `grep -q "/shop/thank-you" apps/web/lib/stripe/constants.ts` exits 0
    - `grep -q "{CHECKOUT_SESSION_ID}" apps/web/lib/stripe/constants.ts` exits 0
    - `grep -q "STRIPE_SECRET_KEY" apps/web/lib/stripe/server.ts` exits 0 (the error message references the env var by name)
    - `pnpm --filter web typecheck` exits 0
  </acceptance_criteria>
  <done>Stripe SDK singleton + URL builders land with pinned apiVersion; typecheck is clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create apps/web/app/api/checkout/create-session/route.ts (CMR-02 + CMR-10)</name>
  <read_first>
    - apps/web/__tests__/checkout-create-session.test.ts (Wave 0 fixture — the assertion shape is the implementation contract; especially the args.line_items === [{price: 'price_test_lipbalm_001', quantity: 1}] check)
    - apps/web/lib/stripe/server.ts (Task 1 — getStripeServer)
    - apps/web/lib/stripe/constants.ts (Task 1 — buildSuccessUrl/buildCancelUrl)
    - apps/web/lib/sanity/client.ts (server-side GROQ for charity metadata lock — Open Question 1)
    - apps/web/app/shop/page.tsx (existing — same QUERY_LATEST_CHARITY_NAME pattern; reuse the projection inline OR define a separate one)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pattern 2 (verbatim route handler shape)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Open Question 1 (lock charitySlug into session.metadata at click time, NOT at webhook time)
  </read_first>
  <behavior>
    - Test 1: POST without env STRIPE_PRICE_ID returns 500 with JSON body containing an `error` field.
    - Test 2: POST with env vars set calls stripe.checkout.sessions.create exactly once.
    - Test 3: The create() call args include `mode: 'payment'`.
    - Test 4: The create() call args include `line_items: [{ price: <STRIPE_PRICE_ID env value>, quantity: 1 }]`.
    - Test 5: The create() call args include `shipping_address_collection.allowed_countries` as a non-empty array.
    - Test 6: The create() call args include `success_url` containing `/shop/thank-you` and the literal `{CHECKOUT_SESSION_ID}`.
    - Test 7: The create() call args include `cancel_url` ending in `/shop`.
    - Test 8: The response body is `{ url: <session.url> }` and HTTP 200.
    - Test 9: `metadata.charitySlug` is set when Sanity returns a current charity; falls back to empty string or omitted when none.
  </behavior>
  <files>apps/web/app/api/checkout/create-session/route.ts</files>
  <action>
    Create `apps/web/app/api/checkout/create-session/route.ts` with EXACTLY this shape (this is the implementation that makes Plan 08-01 Task 2 File 2 turn green):

    ```typescript
    /**
     * POST /api/checkout/create-session
     *
     * CMR-02 + CMR-10: creates a Stripe Checkout session for the lip balm SKU,
     * with shipping address collection enabled. Returns { url } pointing at
     * Stripe-hosted Checkout. Browser redirects via `window.location.href = url`.
     *
     * RESEARCH Open Question 1: we lock the current charity slug into
     * session.metadata at click time, NOT at webhook time. This avoids the
     * race where a new issue publishes between click and webhook (which
     * would otherwise credit the wrong charity).
     */
    import { NextResponse } from 'next/server'
    import { groq } from 'next-sanity'
    import { getStripeServer } from '@/lib/stripe/server'
    import { buildSuccessUrl, buildCancelUrl } from '@/lib/stripe/constants'
    import { sanityClient } from '@/lib/sanity/client'

    export const runtime = 'nodejs'  // Stripe SDK uses Node crypto, not Edge
    export const dynamic = 'force-dynamic'  // never cache the API response

    // Inline projection (same pattern as apps/web/app/shop/page.tsx).
    // Returns the slug of the latest published issue's charity, or null.
    const QUERY_CURRENT_CHARITY_SLUG = groq`
      *[_type == "weeklyIssue" && status == "published"]
      | order(issueNumber desc)[0] {
        "charitySlug": charity->slug.current
      }
    `

    export async function POST(_req: Request) {
      const priceId = process.env.STRIPE_PRICE_ID
      if (!priceId) {
        // Stripe Dashboard product wasn't set up (Plan 08-02). Hard config error.
        return NextResponse.json(
          { error: 'Checkout misconfigured (STRIPE_PRICE_ID unset).' },
          { status: 500 },
        )
      }

      // Lock charity slug into session metadata at click time (Open Question 1).
      // If Sanity is unreachable, fall through with an empty string — better
      // to complete the checkout than to block on a CMS read.
      let charitySlug = ''
      try {
        const result = await sanityClient.fetch<{ charitySlug: string | null } | null>(
          QUERY_CURRENT_CHARITY_SLUG,
        )
        charitySlug = result?.charitySlug ?? ''
      } catch {
        charitySlug = ''
      }

      let stripe
      try {
        stripe = getStripeServer()
      } catch (err) {
        // getStripeServer throws on missing STRIPE_SECRET_KEY (also Plan 08-02 territory)
        return NextResponse.json(
          { error: 'Checkout misconfigured (Stripe client init failed).' },
          { status: 500 },
        )
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [{ price: priceId, quantity: 1 }],  // quantity LOCKED at 1 for v1
        shipping_address_collection: {
          // CMR-10: shipping enabled; expand allowed_countries when Andrew configures more rates.
          allowed_countries: ['US'],
        },
        phone_number_collection: { enabled: true },
        automatic_tax: { enabled: false },  // OFF until Andrew configures Stripe Tax
        success_url: buildSuccessUrl(),
        cancel_url: buildCancelUrl(),
        metadata: {
          source: 'eisenbalm-dispatch',
          charitySlug,  // Open Question 1 lock; empty string if Sanity unavailable
        },
      })

      if (!session.url) {
        // Defensive: Stripe should always return a url for hosted Checkout.
        return NextResponse.json({ error: 'No checkout URL returned.' }, { status: 500 })
      }

      return NextResponse.json({ url: session.url })
    }
    ```

    Notes:
    - `mode: 'payment'` (one-time), NOT subscription. The brief is explicit.
    - `quantity: 1` is hardcoded. The brief says one product, no cart UI; the read of `request.json().quantity` from API_CONTRACTS §6.1 is an older sketch — RESEARCH supersedes it (RESEARCH locks quantity at 1 for v1). API_CONTRACTS §6.1 will need a docs update later but is not a required deliverable of this plan.
    - `success_url` contains `{CHECKOUT_SESSION_ID}` literal (Stripe templating). The buildSuccessUrl() helper from Task 1 wires this in.
    - `automatic_tax: { enabled: false }`. Stripe Tax requires explicit account setup (Andrew action); leave OFF until Phase 8.x.
    - The `charitySlug` lookup is best-effort (try/catch). A Sanity outage must not block checkout.
    - Use `import { groq } from 'next-sanity'` — existing pattern from `apps/web/app/shop/page.tsx`.
    - The `_req` parameter is prefixed with underscore to signal "unused" (Next.js requires the param exists even if not read).
  </action>
  <verify>
    <automated>test -f apps/web/app/api/checkout/create-session/route.ts && grep -q "export const runtime = 'nodejs'" apps/web/app/api/checkout/create-session/route.ts && grep -q "mode: 'payment'" apps/web/app/api/checkout/create-session/route.ts && grep -q "shipping_address_collection" apps/web/app/api/checkout/create-session/route.ts && grep -q "buildSuccessUrl" apps/web/app/api/checkout/create-session/route.ts && grep -q "buildCancelUrl" apps/web/app/api/checkout/create-session/route.ts && grep -q "charitySlug" apps/web/app/api/checkout/create-session/route.ts && cd apps/web && npx vitest run __tests__/checkout-create-session.test.ts 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/app/api/checkout/create-session/route.ts` exits 0
    - `grep -q "export const runtime = 'nodejs'" apps/web/app/api/checkout/create-session/route.ts` exits 0
    - `grep -q "export const dynamic = 'force-dynamic'" apps/web/app/api/checkout/create-session/route.ts` exits 0
    - `grep -q "export async function POST" apps/web/app/api/checkout/create-session/route.ts` exits 0
    - `grep -q "mode: 'payment'" apps/web/app/api/checkout/create-session/route.ts` exits 0
    - `grep -q "shipping_address_collection" apps/web/app/api/checkout/create-session/route.ts` exits 0
    - `grep -q "phone_number_collection" apps/web/app/api/checkout/create-session/route.ts` exits 0
    - `grep -q "buildSuccessUrl" apps/web/app/api/checkout/create-session/route.ts` exits 0
    - `grep -q "buildCancelUrl" apps/web/app/api/checkout/create-session/route.ts` exits 0
    - `grep -q "metadata.*charitySlug\\|charitySlug.*metadata\\|charitySlug," apps/web/app/api/checkout/create-session/route.ts` exits 0
    - `grep -q "STRIPE_PRICE_ID" apps/web/app/api/checkout/create-session/route.ts` exits 0
    - `pnpm --filter web typecheck` exits 0
    - `cd apps/web && npx vitest run __tests__/checkout-create-session.test.ts` exits 0 (all 6 test cases from Plan 08-01 pass)
    - NO `await req.json()` in this file (we ignore the body — quantity is locked, source is single-button)
  </acceptance_criteria>
  <done>Checkout-session route handler lands; Plan 08-01 checkout test goes green; CMR-02 + CMR-10 satisfied in mocked tests.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Create apps/web/components/marketing/BuyButton.tsx</name>
  <read_first>
    - apps/web/components/ui/button.tsx (existing shadcn Button — variant/size signature)
    - apps/web/components/issue/ShopCallout.tsx (existing component using anchor + accent button styling — voice reference: "Buy the lip balm")
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pattern 2 §Client component (BuyButton blueprint with useState loading + window.location.href)
  </read_first>
  <files>apps/web/components/marketing/BuyButton.tsx</files>
  <action>
    Create `apps/web/components/marketing/BuyButton.tsx` as a Client Component:

    ```typescript
    'use client'

    /**
     * BuyButton — initiates Stripe Checkout for the Eisenbalm lip balm.
     *
     * Flow:
     *   1. User clicks
     *   2. fetch('/api/checkout/create-session', { method: 'POST' })
     *   3. Server returns { url }
     *   4. window.location.href = url (redirects to Stripe-hosted Checkout)
     *
     * Loading state: text changes to "Redirecting…" and button disables.
     * Error path: console.error (no toast/modal/banner per CLAUDE.md voice rules).
     */
    import { useState } from 'react'
    import { Button } from '@/components/ui/button'

    export function BuyButton() {
      const [loading, setLoading] = useState(false)

      async function onClick() {
        if (loading) return
        setLoading(true)
        try {
          const res = await fetch('/api/checkout/create-session', { method: 'POST' })
          const body = (await res.json()) as { url?: string; error?: string }
          if (body.url) {
            window.location.href = body.url
            return
          }
          throw new Error(body.error ?? 'Checkout failed')
        } catch (err) {
          // No toast/modal/banner per voice rules. Surface to console and re-enable
          // the button so the user can retry. A small inline status could be added
          // later, but the brief locks against UI ornaments here.
          // eslint-disable-next-line no-console
          console.error('[BuyButton] checkout failed:', err)
          setLoading(false)
        }
      }

      return (
        <Button
          type="button"
          size="lg"
          disabled={loading}
          onClick={onClick}
          className="mt-8"
        >
          {loading ? 'Redirecting…' : 'Buy the lip balm'}
        </Button>
      )
    }
    ```

    Voice notes:
    - "Buy the lip balm" matches the ShopCallout button label verbatim (UI-SPEC contract).
    - "Redirecting…" uses an en-ellipsis character (U+2026), not three dots. Matches the dry voice register established in Phase 2.
    - No icon, no badge, no countdown, no urgency, no "X people viewing", no "Buy now".

    Behavior notes:
    - The button is `disabled` when loading; clicking again is a no-op (`if (loading) return` guard).
    - `console.error` is the deliberate error surface — no toast/Sonner integration in v1.
    - No `useRouter`: we use `window.location.href` because Stripe redirects to an external domain, not a Next.js route.
  </action>
  <verify>
    <automated>test -f apps/web/components/marketing/BuyButton.tsx && head -1 apps/web/components/marketing/BuyButton.tsx | grep -q "use client" && grep -q "fetch.*/api/checkout/create-session" apps/web/components/marketing/BuyButton.tsx && grep -q "window.location.href" apps/web/components/marketing/BuyButton.tsx && grep -q "Buy the lip balm" apps/web/components/marketing/BuyButton.tsx && pnpm --filter web typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/components/marketing/BuyButton.tsx` exits 0
    - `head -1 apps/web/components/marketing/BuyButton.tsx | grep -q "use client"` exits 0 (directive on first line)
    - `grep -q "fetch.*/api/checkout/create-session" apps/web/components/marketing/BuyButton.tsx` exits 0
    - `grep -q "window.location.href" apps/web/components/marketing/BuyButton.tsx` exits 0
    - `grep -q "Buy the lip balm" apps/web/components/marketing/BuyButton.tsx` exits 0
    - `grep -q "useState" apps/web/components/marketing/BuyButton.tsx` exits 0
    - `grep -q "import.*Button.*from.*@/components/ui/button" apps/web/components/marketing/BuyButton.tsx` exits 0
    - `pnpm --filter web typecheck` exits 0
    - No `import { useRouter }` or Next.js router APIs (BuyButton uses window.location.href because Stripe redirects to an external domain)
    - No emojis, no toast/Sonner imports, no countdown timer logic
  </acceptance_criteria>
  <done>BuyButton Client Component lands; ready to be embedded in /shop page (Plan 08-06).</done>
</task>

</tasks>

<verification>
After all three tasks complete:
- `pnpm --filter web typecheck` exits 0
- `pnpm --filter web test:unit __tests__/checkout-create-session.test.ts` exits 0 (Wave 0 test now green)
- The Stripe SDK singleton + apiVersion pin are in place (`getStripeServer()` callable)
- BuyButton is ready for /shop page to import (Plan 08-06 wires it)
</verification>

<success_criteria>
- CMR-02 satisfied in mocked unit tests (session.create called with correct line_items + mode)
- CMR-10 satisfied in mocked unit tests (shipping_address_collection enabled)
- Open Question 1 closed: charitySlug locked into session.metadata at click time
- Pitfall 6 mitigated: STRIPE_API_VERSION pinned via constant
- BuyButton uses hosted-Checkout flow (window.location.href redirect — no @stripe/stripe-js import)
- No Stripe Elements, no urgency mechanics, no DB query on /shop/thank-you (decorative landing comes in Plan 08-07)
</success_criteria>

<output>
After completion, create `.planning/phases/08-stripe-commerce/08-04-stripe-client-and-checkout-api-SUMMARY.md` recording:
- The STRIPE_API_VERSION value pinned (cross-reference Plan 08-03 SUMMARY)
- The 4 files created (server.ts, constants.ts, route.ts, BuyButton.tsx)
- Vitest result for __tests__/checkout-create-session.test.ts (target: all green)
- Any TS strictness fights (`Stripe.LatestApiVersion` cast working as expected?)
- Confirmation that `metadata.charitySlug` lock is in place (Open Question 1)
- Confirmation that `automatic_tax: { enabled: false }` is set (deferred to Phase 8.x when Andrew configures Stripe Tax)
- Allowed countries list value (`['US']` — note if a different list was chosen)
</output>
