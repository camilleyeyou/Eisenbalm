# Phase 8: Stripe / Commerce — Research

**Researched:** 2026-05-19
**Domain:** E-commerce — Stripe Checkout (hosted), webhook signature verification, idempotency, Next.js 15 App Router route handlers
**Confidence:** HIGH (stack and patterns are well-documented and stable; project conventions already established in Phases 2-7)

---

## Summary

Phase 8 wires the project's commerce surface: a server-rendered `/shop` page using the existing Sanity `latestCharityName` projection pattern from Phase 2, a Stripe Checkout flow via `stripe.checkout.sessions.create()` returning a hosted-page URL, a `/shop/thank-you` decorative landing (no DB query), a Next.js Route Handler at `/api/stripe/webhook` that verifies signatures with `stripe.webhooks.constructEvent` on the raw `await req.text()` body, and a Convex-backed idempotency table that deduplicates by `event.id`. Two persistent legal pages (`/legal/privacy`, `/legal/terms`) and a shop callout already wired into the issue page (Phase 2 left it static) round out the surface.

The architecture is already constrained: the brief locks "Stripe Checkout (custom, no Shopify, no Commerce.js, no urgency)" and the `Out of Scope` table in REQUIREMENTS.md forbids popups, urgency mechanics, countdown timers, modal upsells, and stack substitutions. The Phase 2 `ShopCallout` component at `apps/web/components/issue/ShopCallout.tsx` already renders the locked one-sentence + button shape inside the issue page; Phase 8 only needs to ensure the button links to `/shop` (it already does) and that `/shop` itself works. No change to the issue-page shop callout is required for CMR-09 — the existing component already satisfies the contract.

The two hard security guarantees — (a) **no environment bypass for signature verification** and (b) **exactly-once event processing under retries** — drive the most subtle planning decisions:

- The webhook route must always call `stripe.webhooks.constructEvent(rawBody, sig, secret)` before any branching on event type; there must be no `if (process.env.NODE_ENV !== 'production') skipVerify()` path anywhere.
- Idempotency must be enforced at a layer that survives concurrent retry races. Convex's atomic inserts on a unique-indexed `stripeEvents` table (or a wrapper using `withIndex(...).first()` + insert in a single mutation) provide this; the project already uses Convex for atomic state and the Python pipeline already calls Convex mutations from the server.

**Primary recommendation:** Adopt Stripe Checkout (hosted page) with a server Route Handler creating sessions, configure `shipping_address_collection`, store the lip-balm `price` as `STRIPE_PRICE_ID` env var (configured in Stripe dashboard — already a Phase 6 blocker per STATE.md), use Convex table `stripeEvents` indexed by `eventId` for idempotency (raised in a new Phase 8 schema patch), and lock the webhook handler at `apps/web/app/api/stripe/webhook/route.ts` with `runtime = 'nodejs'`.

---

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for Phase 8 (planner spawned this researcher directly per `/gsd:plan-phase`). The constraints below are derived from the brief and REQUIREMENTS.md:

### Locked Decisions (from CLAUDE.md + brief + REQUIREMENTS.md Out of Scope table)

- Stack is locked: Next.js 14+ (15.3.x in this repo) App Router on Vercel; Stripe custom integration only.
- **No Shopify, no Commerce.js, no `@stripe/stripe-js` Elements-driven flow** — Stripe Checkout (hosted) only.
- **No urgency mechanics, popups, modals, banners, countdown timers, stock-left displays, "X other people viewing" social proof.**
- One product: Jesse A. Eisenbalm lip balm. No catalog. No variants UI. Quantity may be allowed (default 1).
- Shop callout = one sentence + one button. Always. Period.
- Webhook signature verification has **no development-mode bypass** (CMR-05 is explicit).
- `/shop/thank-you` makes **no DB query** (CMR-03 is explicit).

### Claude's Discretion

- Choice of idempotency store (Convex vs Supabase vs Stripe metadata) — research recommends Convex.
- Legal page content (Sanity-managed vs hardcoded MDX) — research recommends hardcoded TSX placeholders with a `TODO(Andrew)` comment, escalated to STATE.md blockers.
- Whether to record additional order metadata in Convex (research recommends a minimal `stripeOrders` table for audit/charity attribution).
- Whether to gate Convex order writes behind a feature flag for first deploy (research recommends "yes, ship behind `STRIPE_RECORD_ORDERS=true`").

### Deferred Ideas (OUT OF SCOPE)

- Multi-product catalog / Shopify integration
- User accounts / login
- Newsletter / email subscriptions
- Per-issue OG image generation
- Email confirmation sends (Stripe Checkout's default receipts cover this for v1)
- Charity attribution surfacing to readers ("you donated $X to Y this year") — internal data only

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CMR-01 | `/shop` server-rendered with charity callout, no client flicker | §Architecture Pattern 1: Server Component fetches Sanity, ISR `revalidate=60` (mirrors Phase 2 Plan 02-09 pattern in `apps/web/app/shop/page.tsx`) |
| CMR-02 | Stripe Checkout via `checkout.sessions.create()` custom integration | §Standard Stack + §Pattern 2: server Route Handler `/api/checkout/create-session`, line items reference `STRIPE_PRICE_ID` |
| CMR-03 | `/shop/thank-you` static, no DB query | §Pattern 3: static page reads only `session_id` URL param (decorative), no `fetch`, no Sanity, no Convex |
| CMR-04 | Webhook signature verification with raw body | §Pattern 4: `await req.text()` BEFORE any JSON parse; `runtime='nodejs'` on the route handler |
| CMR-05 | No dev-mode signature bypass — always required | §Don't Hand-Roll #1, §Pitfall 1: the only acceptable code path verifies; missing env throws |
| CMR-06 | Idempotency on `event.id` | §Pattern 5: Convex `stripeEvents` table with unique index `by_eventId`; atomic check-and-insert mutation |
| CMR-07 | `/legal/privacy` page exists, no 404 | §Pattern 6: static TSX page under `app/legal/privacy/page.tsx` with placeholder copy + TODO escalation |
| CMR-08 | `/legal/terms` page exists, no 404 | Same as CMR-07 at `app/legal/terms/page.tsx` |
| CMR-09 | Persistent shop callout on every issue page | **Already satisfied by Phase 2** `apps/web/components/issue/ShopCallout.tsx` — verify in Wave 0, no rework required |
| CMR-10 | Stripe shipping rates configured | §Pattern 2: `shipping_address_collection` enabled in session create; shipping rates configured in Stripe Dashboard (already a Phase 6 blocker in STATE.md) |

---

## Project Constraints (from CLAUDE.md)

These directives bind every plan in this phase:

1. **GSD workflow enforcement** — All edits go through GSD commands (`/gsd:execute-phase`); no out-of-band edits.
2. **Stack locked** — Next.js 14+ App Router on Vercel, Sanity v3 (v5 actual), Convex, Stripe custom — no substitutions.
3. **Voice** — Jesse: dry, precise, absurdly serious. No exclamation marks. No winking. No urgency. Even page-not-found copy follows this register.
4. **Security**
   - HMAC signature verification on every webhook, unconditional. No env-var bypass.
   - Idempotency required on retries.
   - HTML/JS injection paths use `setProperty` (not template literals) — established for theme engine in Phase 2; the Stripe surface has no theme-variable injection so this is informational.
5. **Reads to Sanity use `useCdn: true`** — Phase 2 already establishes this; `/shop` follows it.
6. **Sanity API token is write-only secret** — never expose. Phase 8 uses Sanity only for reads, so this doesn't apply directly.
7. **No emoji in any output** — copy in `/shop`, `/shop/thank-you`, `/legal/*` is plaintext only.
8. **Confirm build step at session start** — applies to executing plans, not research.
9. **CMR-09 is locked at the component level** — Phase 2's `ShopCallout` rendered the exact one-sentence + button shape, with the print stylesheet hiding it. Phase 8 must NOT replace this component with a banner, modal, or popup. The brief language "no banner, no modal, no popup, no countdown timer" is a hard constraint reinforced by `Out of Scope` in REQUIREMENTS.md.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` (stripe-node) | `^18.0.0` or `^19.0.0` (LTS-stable line; verify with `npm view stripe version` and pin a current major before installing) | Server-side Stripe API client | Official SDK; required for `checkout.sessions.create()` and `webhooks.constructEvent()` |
| `next` | `^15.3.9` (already installed) | App Router route handlers + server components | Project standard from Phase 2 |
| `@sanity/client` | `^7.22.0` (already installed) | Read latest charity for `/shop` callout | Project standard from Phase 2 |
| `convex` | `^1.38.0` (already installed) | Idempotency table + atomic event-id dedupe | Project standard from Phase 3 |

**Version verification (RUN BEFORE WRITING PLAN):**
```bash
npm view stripe version
npm view stripe time --json | head -5
```
The Stripe Node SDK ships a new major version roughly quarterly; major bumps pin a new `apiVersion` default. As of 2026-05-19, `stripe@22.1.1` is the published latest, but the project should pin a major that's been stable for at least 30 days. Recommend pinning `stripe: "^18.0.0"` or `^19.0.0` after verification — confirm at planning time and document the resolved version in PLAN.md. The plan MUST run `npm view stripe version` and record the value; if a fresh major has shipped within 30 days, pin the previous major to avoid an unreviewed `apiVersion` change.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@stripe/stripe-js` | — | NOT NEEDED for hosted Checkout flow | Only required if using Stripe Elements (we are not) |
| `micro` | — | NOT NEEDED in App Router | Only required for Pages Router raw-body parsing; `await req.text()` replaces it |
| `stripe-cli` (system tool, not npm) | latest | Local webhook testing | `stripe listen --forward-to localhost:3000/api/stripe/webhook` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Stripe Checkout (hosted) | Stripe Elements (in-page) | Elements requires `@stripe/stripe-js`, additional CSP entries, more frontend complexity, more PCI scope. Brief says "Stripe Checkout" — locked. |
| `stripe.webhooks.constructEvent` (sync) | `stripe.webhooks.constructEventAsync` | Async variant for edge runtimes. We use `runtime='nodejs'`, so sync is fine and simpler. |
| Convex for idempotency | Supabase Postgres unique index | Pipeline already uses Supabase for webhook idempotency (Phase 6 `webhook_idempotency` table). However, Phase 6's pipeline lives on Railway (Python) and Phase 8's Stripe webhook lives on Vercel (Node.js). Convex is reachable from both Vercel + Railway and avoids Vercel→Supabase connection from edge. Convex is the right place. |
| Convex for idempotency | Stripe `idempotency-key` request header | Stripe's `idempotency-key` is for *outbound* requests to Stripe (deduplicating session creates), not for handling inbound webhooks. Different problem. We use both: outbound `idempotency-key` on `checkout.sessions.create` (if we ever retry from client), and Convex for inbound. |

**Installation:**
```bash
pnpm --filter web add stripe@<verified-major>
# (no @stripe/stripe-js — hosted flow)
# Stripe CLI: install separately per https://docs.stripe.com/stripe-cli (system tool)
```

---

## Architecture Patterns

### Recommended File Layout

```
apps/web/
├── app/
│   ├── shop/
│   │   ├── page.tsx                          # CMR-01: server component, ISR, charity callout
│   │   └── thank-you/
│   │       └── page.tsx                      # CMR-03: static, no DB query
│   ├── legal/
│   │   ├── privacy/
│   │   │   └── page.tsx                      # CMR-07
│   │   └── terms/
│   │       └── page.tsx                      # CMR-08
│   └── api/
│       ├── checkout/
│       │   └── create-session/
│       │       └── route.ts                  # CMR-02: POST creates Checkout Session, returns { url }
│       └── stripe/
│           └── webhook/
│               └── route.ts                  # CMR-04, CMR-05, CMR-06: signature verify + idempotency
├── lib/
│   └── stripe/
│       ├── server.ts                         # Stripe server client (lazy init, throws on missing env)
│       └── constants.ts                      # STRIPE_API_VERSION pin, success/cancel URL builders
└── components/
    └── marketing/
        └── BuyButton.tsx                     # Client Component — POSTs to /api/checkout/create-session, redirects

convex/
└── stripeEvents.ts                           # NEW: idempotency check-and-insert mutation
└── stripeOrders.ts                           # OPTIONAL: minimal order audit table (charity attribution)
└── schema.ts                                 # Patched to add stripeEvents + stripeOrders tables
```

### Pattern 1: Server-Rendered `/shop` with Charity Callout (CMR-01)

The existing Phase 2 file at `apps/web/app/shop/page.tsx` already uses the correct pattern. Phase 8 rewrites the body to add a real BuyButton, but **keeps the data-fetching shape**:

```typescript
// apps/web/app/shop/page.tsx
// Source: existing project file (Phase 2 Plan 02-09); pattern verified.
import type { Metadata } from 'next'
import { groq } from 'next-sanity'
import { sanityClient } from '@/lib/sanity/client'
import { BuyButton } from '@/components/marketing/BuyButton'

export const revalidate = 60  // ISR — callout refreshes weekly when new issue ships

// Inline query — single consumer, mirrors Plan 02-09 decision.
const QUERY_LATEST_CHARITY_NAME = groq`
  *[_type == "weeklyIssue" && status == "published"]
  | order(issueNumber desc)[0] {
    "charityName": charity->name
  }
`

export default async function ShopPage() {
  const result = await sanityClient.fetch<{ charityName: string | null } | null>(
    QUERY_LATEST_CHARITY_NAME,
  )
  const charityCallout = result?.charityName
    ? `This week's proceeds benefit ${result.charityName}.`
    : 'Proceeds go to our featured charity each week.'

  return (
    <section>
      {/* ... heading + copy ... */}
      <p>{charityCallout}</p>
      <BuyButton />  {/* Client Component */}
    </section>
  )
}
```

**Why server component:** Charity name is server-fetched at request time; reader sees the correct callout in the initial HTML response — no client-side loading skeleton, no flicker, no useEffect. ISR `revalidate=60` keeps it fresh within a minute of a new issue publishing.

**Empty-state behavior:** If no published issue exists yet, the callout falls back to the generic copy. Page still renders. No 500.

### Pattern 2: Checkout Session Creation (CMR-02, CMR-10)

```typescript
// apps/web/app/api/checkout/create-session/route.ts
// Source: stripe-node official Next.js example + docs.stripe.com Checkout
import { NextResponse } from 'next/server'
import { getStripeServer } from '@/lib/stripe/server'

export const runtime = 'nodejs'  // explicit — never edge for Stripe SDK

export async function POST(req: Request) {
  const stripe = getStripeServer()
  const priceId = process.env.STRIPE_PRICE_ID
  if (!priceId) {
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ price: priceId, quantity: 1 }],  // quantity locked at 1 for v1
    shipping_address_collection: {
      allowed_countries: ['US'],  // expand later if Andrew configures more
    },
    // shipping_options: configured in dashboard; auto-picked via shipping_rates
    phone_number_collection: { enabled: true },
    automatic_tax: { enabled: false },  // off until Andrew configures Stripe Tax
    success_url: `${baseUrl}/shop/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/shop`,
    metadata: {
      source: 'eisenbalm-dispatch',
      // charitySlug intentionally omitted at session creation — derived in webhook from current issue (race-safe)
    },
  })

  if (!session.url) {
    return NextResponse.json({ error: 'No checkout URL' }, { status: 500 })
  }
  return NextResponse.json({ url: session.url })
}
```

**Client component:**
```typescript
// apps/web/components/marketing/BuyButton.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function BuyButton() {
  const [loading, setLoading] = useState(false)
  return (
    <Button
      size="lg"
      disabled={loading}
      onClick={async () => {
        setLoading(true)
        try {
          const r = await fetch('/api/checkout/create-session', { method: 'POST' })
          const { url, error } = await r.json()
          if (url) window.location.href = url
          else throw new Error(error ?? 'Checkout failed')
        } catch (e) {
          setLoading(false)
          // Surface a small inline error — no toast/modal per voice
          console.error(e)
        }
      }}
    >
      {loading ? 'Redirecting…' : 'Buy the lip balm'}
    </Button>
  )
}
```

**Notes:**
- `mode: 'payment'` (one-time), not `'subscription'`.
- `STRIPE_PRICE_ID` is configured in the Stripe Dashboard. Andrew creates the product + price + shipping rates there (already noted as a Phase 6 blocker; carry it forward).
- Shipping rates are configured in the Stripe Dashboard at Settings → Shipping; Checkout pulls them via the `shipping_options` Dashboard config or passed via API. Default behavior: passing `shipping_address_collection` makes Checkout collect the address; shipping rate is selected by the customer if multiple are configured.
- `phone_number_collection.enabled = true` per Stripe Checkout 2025 default best practice (collects shipping phone for delivery providers).
- `automatic_tax` is left OFF for v1. Stripe Tax requires explicit Andrew setup (tax registrations, address origins). Once Andrew configures, planning can flip this on with no code change beyond `{ enabled: true }`.
- **Outbound idempotency-key:** When creating sessions from a client retry path (e.g., double-click), pass `{ idempotencyKey: '<stable-key>' }` as the second argument to `create()`. For v1, the redirect short-circuits this risk; consider deferred to v2.

### Pattern 3: `/shop/thank-you` Static Page (CMR-03)

```typescript
// apps/web/app/shop/thank-you/page.tsx
// CMR-03: NO DB query. NO Sanity. NO Convex.
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Thank you',
  robots: { index: false, follow: false },  // post-purchase, not a public marketing page
}

interface PageProps {
  searchParams: Promise<{ session_id?: string }>
}

export default async function ThankYouPage({ searchParams }: PageProps) {
  const { session_id } = await searchParams
  // We intentionally do NOT verify session_id against Stripe here.
  // The webhook is the source of truth for fulfillment.
  // This page is decorative confirmation only.

  return (
    <section>
      <h1>Order received.</h1>
      <p>Your lip balm is on the way. A receipt is in your inbox.</p>
      <p>100% of proceeds from this week's sales go to the featured charity.</p>
      <p><Link href="/">Return to the latest issue.</Link></p>
      {/* session_id is intentionally not surfaced — readers don't need it. */}
    </section>
  )
}
```

**Why no DB query:**
1. The webhook (Pattern 4) is the authoritative fulfillment event. The thank-you page is decorative.
2. If the page queried by `session_id`, an attacker could enumerate session IDs from URLs.
3. Stripe's hosted Checkout sends a default email receipt — no need to render order details on this page.
4. Loading state would create the very flicker CMR-01 forbids on `/shop`; the same constraint applies here.

### Pattern 4: Webhook Signature Verification (CMR-04, CMR-05)

```typescript
// apps/web/app/api/stripe/webhook/route.ts
// Sources:
//   - https://github.com/stripe/stripe-node/blob/master/examples/webhook-signing/nextjs/app/api/webhooks/route.ts
//   - https://docs.stripe.com/webhooks/signature
import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import type Stripe from 'stripe'
import { getStripeServer } from '@/lib/stripe/server'
import { handleStripeEvent } from '@/lib/stripe/handlers'

export const runtime = 'nodejs'      // never edge — stripe-node uses Node crypto
export const dynamic = 'force-dynamic'  // never cached

export async function POST(req: Request) {
  const stripe = getStripeServer()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    // CMR-05: there is NO bypass. Misconfiguration is a hard 500.
    // No "skip verification in dev" path. None. Ever.
    return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
  }

  const sig = (await headers()).get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  // Raw body MUST be read via .text() before any JSON parse.
  // Source: docs.stripe.com/webhooks/signature — re-serialized JSON breaks HMAC.
  const rawBody = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    // Bad signature — never trust, never process, never log payload.
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Idempotency (Pattern 5)
  await handleStripeEvent(event)

  // Always 200 on signature-valid, processing-attempted events — Stripe retries on 4xx/5xx.
  return NextResponse.json({ received: true })
}
```

**Key invariants:**
1. `runtime = 'nodejs'` — `stripe.webhooks.constructEvent` uses Node `crypto`, not Web Crypto. Edge runtime breaks this.
2. `await req.text()` BEFORE any JSON parsing. JSON.parse(rawBody) re-serializes whitespace/ordering and breaks the HMAC.
3. There is no environment branch in this file. Signature verification runs in every environment.
4. Missing `STRIPE_WEBHOOK_SECRET` is a 500, not a silent pass.
5. Errors return 400 (signature) or 500 (config), never 4xx with details that could fingerprint the failure mode for an attacker.
6. The Phase 8 source-scan test (mirroring Phase 7's GAM-03 pattern in `apps/web/__tests__/game-sandbox.test.ts`) reads this file from disk and asserts that the strings `STRIPE_WEBHOOK_SECRET` and `constructEvent` both appear and no bypass token (`skip`, `disable`, `BYPASS`) appears.

### Pattern 5: Idempotency on `event.id` (CMR-06)

Convex provides atomic `insert`s and unique-index lookups in a single mutation, which is what we need for race-free dedup:

```typescript
// convex/schema.ts patch (additive)
stripeEvents: defineTable({
  eventId: v.string(),       // Stripe evt_... — UNIQUE
  eventType: v.string(),     // e.g. 'checkout.session.completed'
  livemode: v.boolean(),     // matches event.livemode
  receivedAt: v.number(),
})
  .index('by_eventId', ['eventId']),

// Optional: minimal order audit
stripeOrders: defineTable({
  sessionId: v.string(),     // cs_test_... or cs_live_...
  eventId: v.string(),       // evt_... that fulfilled
  amountTotal: v.number(),   // cents
  currency: v.string(),
  customerEmail: v.optional(v.string()),
  charitySlug: v.optional(v.string()),  // current charity at time of order
  createdAt: v.number(),
})
  .index('by_sessionId', ['sessionId'])
  .index('by_charitySlug_createdAt', ['charitySlug', 'createdAt']),
```

```typescript
// convex/stripeEvents.ts
import { mutation } from './_generated/server'
import { v } from 'convex/values'

/**
 * Atomic check-and-insert. Returns:
 *   - { firstTime: true }  if event was not previously processed
 *   - { firstTime: false } if event was already recorded (replay)
 *
 * Convex serializes mutations per-table, so the check + insert is atomic.
 */
export const claim = mutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    livemode: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('stripeEvents')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId))
      .first()
    if (existing) return { firstTime: false }
    await ctx.db.insert('stripeEvents', { ...args, receivedAt: Date.now() })
    return { firstTime: true }
  },
})
```

```typescript
// apps/web/lib/stripe/handlers.ts
import type Stripe from 'stripe'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'

export async function handleStripeEvent(event: Stripe.Event) {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  // Note: server-side Convex calls from Next.js use the public URL and
  // either anonymous or admin auth — for write-mutations exposed as public
  // queries/mutations we use ConvexHttpClient with no token. Restricting
  // these to internal mutations requires server-side admin auth setup.

  const claim = await convex.mutation(api.stripeEvents.claim, {
    eventId: event.id,
    eventType: event.type,
    livemode: event.livemode,
  })
  if (!claim.firstTime) {
    // Replay — already processed. Log and return.
    console.log(`[stripe.webhook] replay ignored: ${event.id}`)
    return
  }

  switch (event.type) {
    case 'checkout.session.completed':
      await onCheckoutCompleted(event.data.object as Stripe.Checkout.Session, convex)
      break
    case 'payment_intent.payment_failed':
      // Log only — Stripe sends customer the failure notice
      console.log(`[stripe.webhook] payment_failed: ${event.id}`)
      break
    default:
      // No-op — only subscribed events from Dashboard reach here anyway
      break
  }
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session, convex: ConvexHttpClient) {
  // Resolve current charity (read-side; same query as /shop)
  // ...
  // Record minimal order audit:
  await convex.mutation(api.stripeOrders.insert, {
    sessionId: session.id,
    eventId: `(scope-creep-guard: pull from caller)`,
    amountTotal: session.amount_total ?? 0,
    currency: session.currency ?? 'usd',
    customerEmail: session.customer_details?.email ?? undefined,
    charitySlug: undefined, // resolved from a Sanity read; optional
  })
}
```

**Why Convex (not Supabase, not local table, not Stripe metadata):**
- Convex provides atomicity-per-table for free; no race-condition gymnastics.
- Pipeline already uses Convex for runId-keyed state. Adding two tables fits established patterns.
- Supabase access from Vercel adds an additional system dependency on the consumer side; Convex is already wired in `apps/web` via `ConvexClientProvider` (Phase 3 Plan 03-05).
- Stripe `event.metadata` is not a dedup store — it's customer-supplied data on the source object.

**Replay handling explicit:** A duplicate webhook returns 200 (silently logged) — Stripe stops retrying. Re-firing fulfillment twice is the catastrophic outcome to avoid.

### Pattern 6: Legal Pages (CMR-07, CMR-08)

```typescript
// apps/web/app/legal/privacy/page.tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'Privacy practices for The Eisenbalm Dispatch.',
}

export default function PrivacyPage() {
  return (
    <article>
      <h1>Privacy</h1>
      {/* TODO(Andrew): replace placeholder with reviewed privacy policy text. */}
      <p>
        The Eisenbalm Dispatch collects the minimum data needed to ship lip balm
        and acknowledge receipt of payment. We use Stripe to process payments;
        Stripe receives the data necessary to complete the transaction.
        {/* ... finish placeholder ... */}
      </p>
    </article>
  )
}
```

**Same shape for `/legal/terms`.** Both must exist (CMR-07/08 are "no 404" checks) but content quality is Andrew's call. Plan flags both pages as `TODO(Andrew)` and surfaces a blocker in STATE.md analogous to the Phase 2 `/about` copy blocker that's still open.

---

### Pattern 7: Webhook Source-Scan Tripwire (CMR-05)

Phase 7 established a tripwire pattern in `apps/web/__tests__/game-sandbox.test.ts` that reads `GameSlot.tsx` from disk and fails if the forbidden string `allow-same-origin` is present. Phase 8 mirrors this for the webhook bypass-prevention guarantee:

```typescript
// apps/web/__tests__/stripe-webhook-source.test.ts
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const WEBHOOK_PATH = resolve(__dirname, '../app/api/stripe/webhook/route.ts')

describe('stripe webhook source-scan (CMR-05)', () => {
  const source = readFileSync(WEBHOOK_PATH, 'utf8')

  it('calls stripe.webhooks.constructEvent', () => {
    expect(source).toMatch(/\bconstructEvent\b/)
  })

  it('has no env-var bypass for signature verification', () => {
    // Reject any pattern that conditionally skips verification.
    const forbidden = [
      /SKIP_(SIGNATURE|STRIPE|VERIFY)/i,
      /BYPASS_(SIGNATURE|STRIPE|VERIFY)/i,
      /process\.env\.NODE_ENV\s*!==?\s*['"]production['"]\s*\)[^]{0,200}return/m,
      /if\s*\(\s*!\s*(?:secret|sig|signature)\s*\)\s*return\s+NextResponse\.json\(\s*\{\s*received/i,
    ]
    for (const pat of forbidden) {
      expect(source).not.toMatch(pat)
    }
  })

  it('uses await req.text() (raw body, not parsed JSON)', () => {
    expect(source).toMatch(/await\s+req\.text\(\)/)
  })

  it('declares runtime nodejs (not edge)', () => {
    expect(source).toMatch(/runtime\s*=\s*['"]nodejs['"]/)
  })
})
```

This is the strongest possible defense against accidental bypass — it fails any commit that reintroduces an environment-conditional skip.

---

### Anti-Patterns to Avoid

- **Parsing the body before signature verification.** `await req.json()` then re-serializing for HMAC fails because JSON re-serialization differs in whitespace/ordering/escaping. **Always** `await req.text()` → constructEvent → `JSON.parse(rawBody)` if needed.
- **Edge runtime for the webhook.** stripe-node uses Node `crypto`, not Web Crypto. Set `runtime = 'nodejs'` explicitly.
- **Returning 4xx/5xx after signature verification passes.** Stripe retries aggressively on non-2xx. After signature passes, return 200 unless there's a genuine config error (which Stripe will retry until you fix). Per Phase 6 / API_CONTRACTS pattern: always 200 once we own the event.
- **Using `event.metadata` for dedup.** `event.id` is the dedup key; metadata is customer-supplied data.
- **Surfacing `session_id` on `/shop/thank-you` as a product detail lookup.** This invites enumeration and breaks CMR-03.
- **Querying the DB on `/shop/thank-you`.** Explicit CMR-03 violation.
- **Showing "X left in stock" / countdowns / popups.** REQUIREMENTS.md Out of Scope.
- **Banner-style shop callout.** REQUIREMENTS.md Out of Scope + CMR-09.
- **Trusting client-supplied price.** Server-side, look up `STRIPE_PRICE_ID` env. Never accept a price from the client.
- **Mixing API versions across files.** Pin Stripe API version in one place (`lib/stripe/server.ts`) and import.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC signature verification of Stripe webhook | Custom HMAC SHA256 verification with timestamp tolerance window | `stripe.webhooks.constructEvent()` | Stripe SDK handles signature scheme `v1=`, timestamp tolerance (default 300s), `t=` extraction, constant-time comparison. Hand-rolling these is how teams ship signature bypasses. |
| Idempotency dedup | In-memory Map; Vercel KV; ad-hoc table; file-based lockfile | Convex `stripeEvents` with `by_eventId` index + `claim` mutation | Convex serializes mutations per-table → atomic check-and-insert. In-memory dies on cold start. Vercel KV is fine but adds another dependency; Convex is already wired. |
| Checkout session URL with quantity selector | Custom cart UI with quantity state, line item builder, Elements integration | Stripe Checkout hosted page (`mode: 'payment'`, line items locked to qty 1 server-side) | Brief locks "Stripe Checkout, no Shopify, no popups." The hosted page handles quantity changes, shipping calculation, address validation, 3DS, retries, mobile UX, accessibility. |
| Shipping rate selection | Custom shipping calculator | Stripe Checkout `shipping_address_collection` + Dashboard-configured shipping rates | Andrew configures rates in Dashboard (already a blocker in STATE.md). Code only sets the country allowlist. |
| Customer email retrieval | OAuth, custom login | `session.customer_details.email` from Checkout | Stripe Checkout collects email; webhook gets it free. |
| Receipt / confirmation email | Custom transactional email service | Stripe Checkout default receipts (Dashboard → Email customers) | Stripe's default email is on-brand-enough for v1; Andrew can custom-template later. |
| Tax | Custom tax calculator | Stripe Tax (off in v1; flip when Andrew is ready) | One-line config change to enable. Don't pre-build. |
| Order persistence | Full e-commerce schema (carts, products, variants, inventory) | Minimal `stripeOrders` table (sessionId, amount, charitySlug) | We sell one SKU. We don't manage inventory. Stripe is the orders system of record; Convex stores attribution metadata for "X went to charity Y" internal reporting. |

**Key insight:** Stripe Checkout is a complete commerce frontend. The temptation is to wrap it in custom UI ("our cart page"). The brief locks against this — and rightly so, because every wrapper layer multiplies maintenance, breaks Stripe's mobile UX, and introduces failure modes (cart state desync, double-charge on back button, etc.). The Stripe Checkout redirect is the entire frontend for v1.

---

## Common Pitfalls

### Pitfall 1: Environment Bypass for Signature Verification
**What goes wrong:** Engineer adds `if (process.env.STRIPE_WEBHOOK_SECRET === 'skip') return ...` to make local dev easier, or returns 200 early when sig is missing. An attacker now triggers fulfillment by POSTing forged events.
**Why it happens:** Local dev with Stripe CLI requires the webhook secret from `stripe listen` output; engineers find that annoying.
**How to avoid:** Source-scan tripwire test (Pattern 7). Stripe CLI's `stripe listen` always provides a `whsec_...` value — there's never a real need to bypass.
**Warning signs:** Any `if (process.env.NODE_ENV` near `constructEvent`. Any optional-secret pattern.

### Pitfall 2: Re-serializing JSON Before HMAC
**What goes wrong:** Engineer does `const body = await req.json()` then `constructEvent(JSON.stringify(body), sig, secret)`. Verification fails for all valid requests because JSON.stringify reorders keys / drops whitespace / escapes Unicode differently.
**Why it happens:** Defaulting to `req.json()` is common Next.js pattern.
**How to avoid:** Always `await req.text()` first. Source-scan test asserts presence.
**Warning signs:** `await req.json()` anywhere in the webhook file.

### Pitfall 3: Edge Runtime for Stripe Webhook
**What goes wrong:** Next.js defaults route handlers to edge if certain APIs are detected. stripe-node uses Node `crypto` and breaks on edge.
**Why it happens:** Following a tutorial that uses edge without realizing stripe-node is incompatible.
**How to avoid:** Always `export const runtime = 'nodejs'` in the webhook route. Source-scan test asserts.
**Warning signs:** `runtime = 'edge'`. Imports of `@stripe/stripe-js` (client SDK) in the route handler.

### Pitfall 4: Idempotency Race on Cold Start
**What goes wrong:** Two webhook retries arrive in the same second. Both check "have I seen this event.id?" simultaneously. Both insert. Fulfillment fires twice.
**Why it happens:** Naive "SELECT + INSERT" without atomicity.
**How to avoid:** Use Convex mutations — they serialize per-table, so the check-and-insert is one atomic operation. Unique index `by_eventId` gives database-level enforcement as a backstop.
**Warning signs:** In-memory deduplication; non-atomic check-then-write; no unique index on the dedup key.

### Pitfall 5: Trusting `session_id` on Thank-You for Fulfillment
**What goes wrong:** Engineer queries Stripe by `session_id` on `/shop/thank-you` and triggers fulfillment there. Customer hits refresh — fulfillment fires twice. Customer copies URL — anyone can replay.
**Why it happens:** Skipping the webhook because thank-you-page feels simpler.
**How to avoid:** Webhook is the *only* source of truth for fulfillment. Thank-you is decorative. CMR-03 enforces this.
**Warning signs:** Any Stripe API call on the thank-you page; any DB write triggered from a GET handler.

### Pitfall 6: Stripe API Version Drift
**What goes wrong:** `new Stripe(key)` without `apiVersion` uses the SDK default, which changes on every major bump. A `pnpm update` six months from now silently changes the API contract for `checkout.sessions.create`.
**Why it happens:** Convenience.
**How to avoid:** Pin `apiVersion` explicitly:
```typescript
export function getStripeServer() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' })
}
```
The plan should record the chosen `apiVersion` and the resolved Stripe SDK version side by side.
**Warning signs:** `new Stripe(...)` with no second argument.

### Pitfall 7: Convex `stripeOrders` Write Failing Silently
**What goes wrong:** Convex returns 5xx during webhook handling. Webhook returns 500. Stripe retries. Idempotency catches the second one — but the first run already incremented some local counter or recorded a partial state.
**Why it happens:** Convex network blips; misconfigured `NEXT_PUBLIC_CONVEX_URL`.
**How to avoid:** Make the idempotency claim and the audit-write happen in a clear order: claim first, then audit. If audit fails, log it but return 200 to Stripe (we already claimed the event ID, so we don't want a retry). Treat audit as best-effort, not load-bearing.
**Warning signs:** Throwing after the claim succeeds; mutations not wrapped in try/catch.

### Pitfall 8: Forgetting `STRIPE_PRICE_ID` Configuration
**What goes wrong:** Code ships, env var is set in Vercel but Stripe Dashboard product/price wasn't created. First test purchase fails with "no such price".
**Why it happens:** This is precisely the Phase 6 blocker already noted in STATE.md ("Andrew must configure Stripe product, price ID, and shipping rates in the Stripe dashboard before Phase 8 code can complete").
**How to avoid:** Phase 8 must explicitly schedule a checkpoint plan for Andrew to create the product, price, and shipping rates BEFORE code lands. Same pattern as Phase 1 Plan 01-02 (sanity-init-checkpoint) and Phase 3 Plan 03-02 (convex-init-checkpoint).
**Warning signs:** Plan that ships `checkout.sessions.create` without an explicit Andrew-action plan before it.

---

## Code Examples

### Stripe Server Client (Singleton)

```typescript
// apps/web/lib/stripe/server.ts
// Source: stripe-node README + docs.stripe.com (2025)
import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripeServer(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  _stripe = new Stripe(key, {
    apiVersion: '2025-04-30.basil',  // pin explicitly; bump only when reviewed
    typescript: true,
  })
  return _stripe
}
```

### Local Webhook Testing with Stripe CLI

```bash
# One-time install: https://docs.stripe.com/stripe-cli
stripe login

# In one terminal, forward events to local Next.js
stripe listen --forward-to localhost:3000/api/stripe/webhook
# CLI prints: > Ready! Your webhook signing secret is whsec_xxx (^C to quit)
# Copy that into apps/web/.env.local as STRIPE_WEBHOOK_SECRET=whsec_xxx

# In another terminal, trigger test events
stripe trigger checkout.session.completed
# Validates: webhook returns 200, console logs the event, Convex stripeEvents has a new row

# Replay test (idempotency): re-fire the same event ID
stripe events resend evt_xxx --webhook-endpoint=we_xxx
# Validates: webhook returns 200 but logs "replay ignored"
```

### Source-Scan Forbidden-Patterns List (CMR-05)

The Phase 8 tripwire test (Pattern 7) needs the planner to bake in these specific banned patterns. The list mirrors Phase 7's GAM-02 BANNED_PATTERNS approach:

```typescript
// Patterns the source-scan test rejects (apps/web/__tests__/stripe-webhook-source.test.ts):
const FORBIDDEN_BYPASS_PATTERNS = [
  /SKIP_SIGNATURE/i,
  /SKIP_STRIPE_VERIFY/i,
  /BYPASS_SIGNATURE/i,
  /STRIPE_SKIP_VERIFY/i,
  /NODE_ENV\s*!==?\s*['"]production['"]\s*\)[^]{0,150}(?:return|skip)/m,
] as const
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pages Router `pages/api/webhooks/stripe.ts` + `bodyParser: false` + `micro` to get raw body | App Router `app/api/.../route.ts` + `await req.text()` | Next.js 13.4 (App Router stable, May 2023) | Simpler — no `bodyParser` config, no `micro` dependency. Project already on Next.js 15. |
| `stripe.redirectToCheckout({ sessionId })` from `@stripe/stripe-js` | `window.location.href = session.url` after server-side `sessions.create` | Stripe Checkout v3 (2021) | Frontend doesn't need `@stripe/stripe-js` for hosted Checkout flow at all. Simpler and one less script tag. |
| Custom in-house idempotency tables in app DB | Convex (or any single-mutation atomic store) | Always-recommended, especially clear in 2024+ guidance | Convex makes atomicity free; same pattern as Phase 6's Supabase `webhook_idempotency_key_source` constraint. |
| Manual `Buffer.from(rawBody)` reading in pages router | `await req.text()` in route handler | Next.js 13.4 | Less code, no buffer manipulation. |
| Stripe SDK without pinned `apiVersion` | Pin `apiVersion` explicitly | Always-recommended | Avoids silent API contract drift across SDK majors. |

**Deprecated/outdated:**
- Pages Router for new code — App Router is the project standard already.
- `redirectToCheckout` client-side — server-side `sessions.create` returning `session.url` is the recommended flow now.
- `stripe.webhooks.constructEvent` without `apiVersion` pinning — drift hazard.

---

## Runtime State Inventory

Phase 8 is a greenfield additive phase — no rename/refactor/migration. **This section is intentionally minimal.** The only existing artifact touched is `apps/web/components/issue/ShopCallout.tsx`, which is left unchanged (CMR-09 is already satisfied).

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Convex `stripeEvents` and `stripeOrders` are new tables | Schema patch in dedicated plan; redeploy Convex |
| Live service config | Stripe Dashboard: product, price ID, webhook endpoint, shipping rates — none yet exist | Andrew checkpoint plan (mirrors Plan 01-02, Plan 03-02 pattern) |
| OS-registered state | None | None — verified no scheduled tasks reference Stripe |
| Secrets/env vars | New: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` (unused — see Open Question 3), `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID` | Add to `apps/web/.env.example` + Vercel; document with single-quote rule analogous to `CONVEX_DEPLOY_KEY` if any key contains shell-special chars |
| Build artifacts | None — pnpm install adds `stripe` to `apps/web/package.json` and lockfile | Standard pnpm flow |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `stripe` (npm) | Webhook + session creation | Will be installed | TBD via `npm view stripe version` at plan time | — |
| Stripe CLI (`stripe`) | Local webhook testing | Installed per developer machine | Latest from `https://docs.stripe.com/stripe-cli` | Use `ngrok` + Stripe Dashboard webhook (slower iteration) |
| Stripe account (test mode) | All testing | Andrew's account | — | — |
| Stripe Dashboard config: product, price, shipping rates | Real checkout end-to-end | Not yet created (Phase 6 blocker in STATE.md) | — | **BLOCKING — needs Andrew checkpoint plan** |
| Convex deployment (existing) | Idempotency + orders tables | `modest-magpie-797` (per Phase 3) | convex@^1.38.0 | — |
| Sanity (existing) | `/shop` charity callout | `6h1vd9mf/production` | — | Empty-state fallback copy in `/shop` page |

**Missing dependencies with no fallback:**
- Stripe Dashboard product + price + shipping rates: blocks first real test purchase. Plan must include a checkpoint plan analogous to Phase 1's Plan 01-02 (Sanity init), Phase 3's Plan 03-02 (Convex init), Phase 4's Plan 04-12 (Railway smoke). Mark `autonomous: false`.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

`workflow.nyquist_validation` is implicitly enabled (not set to false in `.planning/config.json`). Phase 8 validation lands cleanly atop the Phase 7 Vitest infrastructure (`pnpm --filter web test:unit`).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (already installed; Phase 7 Plan 07-01) |
| Config file | `apps/web/vitest.config.ts` (already exists; uses `vite-tsconfig-paths`) |
| Quick run command | `pnpm --filter web test:unit` |
| Full suite command | `pnpm --filter web test:unit` (single suite; no e2e in v1) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CMR-01 | `/shop` renders server-side with charity callout, no client flicker | integration | `pnpm --filter web test:unit __tests__/shop-page.test.ts` | ❌ Wave 0 |
| CMR-01 (manual) | Visual: no loading flicker on cold load | manual | UAT smoke | — |
| CMR-02 | `POST /api/checkout/create-session` returns `{ url }` with valid session | integration | `__tests__/checkout-create-session.test.ts` (mocked Stripe) | ❌ Wave 0 |
| CMR-02 (manual) | End-to-end test purchase via Stripe test card | manual | UAT smoke | — |
| CMR-03 | `/shop/thank-you` renders without DB query | source-scan + integration | `__tests__/thank-you-source.test.ts` (asserts no `fetch`, no Sanity import, no Convex import in page.tsx) | ❌ Wave 0 |
| CMR-04 | Webhook accepts valid signature, parses raw body | unit | `__tests__/stripe-webhook.test.ts` (uses `stripe.webhooks.generateTestHeaderString`) | ❌ Wave 0 |
| CMR-04 | Webhook rejects invalid/missing signature | unit | same as above | ❌ Wave 0 |
| CMR-05 | Source-scan: no bypass patterns in webhook route | source-scan | `__tests__/stripe-webhook-source.test.ts` (Pattern 7) | ❌ Wave 0 |
| CMR-05 (manual) | Set STRIPE_WEBHOOK_SECRET to garbage → forged event POST returns 400 | manual | UAT smoke | — |
| CMR-06 | Same `event.id` processed exactly once across two calls | unit | `__tests__/stripe-webhook-idempotency.test.ts` (mocked Convex claim returning `firstTime: false` on replay) | ❌ Wave 0 |
| CMR-06 (manual) | `stripe events resend evt_xxx` → second invocation logs "replay ignored" | manual | UAT smoke (via Stripe CLI) | — |
| CMR-07 | `/legal/privacy` route resolves with 200 | integration | `__tests__/legal-pages.test.ts` (Next.js test-helper render) | ❌ Wave 0 |
| CMR-08 | `/legal/terms` route resolves with 200 | integration | same as CMR-07 | ❌ Wave 0 |
| CMR-09 | Issue page renders ShopCallout component | integration | Already implicitly covered by Phase 2 smoke — but add a Vitest source-scan asserting `<ShopCallout />` appears in `apps/web/app/issue/[slug]/page.tsx` | ❌ Wave 0 |
| CMR-10 | Session create includes `shipping_address_collection` | unit | Same as CMR-02 (assert the shape of the args passed to mocked Stripe) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter web test:unit` (already < 30s for the existing 27 tests)
- **Per wave merge:** `pnpm --filter web test:unit` (same)
- **Phase gate:** Full suite green + Andrew UAT for CMR-01 (no flicker), CMR-02 (full test purchase), CMR-05 (forged signature), CMR-06 (replay)

### Wave 0 Gaps
- [ ] `apps/web/__tests__/shop-page.test.ts` — covers CMR-01 (mocks `sanityClient.fetch`, snapshots the rendered HTML, asserts no `'use client'`)
- [ ] `apps/web/__tests__/checkout-create-session.test.ts` — covers CMR-02/CMR-10 (mocks `getStripeServer`, asserts session args shape)
- [ ] `apps/web/__tests__/thank-you-source.test.ts` — covers CMR-03 (source-scan; rejects `sanity`, `convex`, `fetch(`)
- [ ] `apps/web/__tests__/stripe-webhook.test.ts` — covers CMR-04 (uses `stripe.webhooks.generateTestHeaderString` to forge valid + invalid signatures)
- [ ] `apps/web/__tests__/stripe-webhook-source.test.ts` — covers CMR-05 (Pattern 7)
- [ ] `apps/web/__tests__/stripe-webhook-idempotency.test.ts` — covers CMR-06 (mocks Convex client)
- [ ] `apps/web/__tests__/legal-pages.test.ts` — covers CMR-07, CMR-08 (Next.js render assertion)
- [ ] `apps/web/__tests__/issue-page-shop-callout.test.ts` — covers CMR-09 (source-scan asserting `<ShopCallout />` is present in issue page)

No new framework install needed — Vitest is already wired and pnpm `--filter web test:unit` exists.

---

## Open Questions

1. **Charity attribution at order time — race against pipeline.**
   - What we know: 100% of proceeds go to "this week's featured charity," derived from the latest published issue.
   - What's unclear: If a new issue publishes between `checkout.sessions.create` (reader at `/shop`) and `checkout.session.completed` (webhook), which charity gets credited?
   - Recommendation: Resolve charity at session creation time and pass it via `session.metadata.charitySlug`. The webhook reads `session.metadata.charitySlug` (locked at click time) rather than re-querying Sanity. Planner decides.

2. **Order recording — required or deferred to v2?**
   - What we know: The brief says "100% of proceeds go to the featured charity" but doesn't specify reporting requirements.
   - What's unclear: Does Andrew need to query "show me all orders for charity X this week"? Or does he get that from Stripe Dashboard + manual ledger?
   - Recommendation: Ship the `stripeOrders` Convex table behind a `STRIPE_RECORD_ORDERS` flag defaulted to `true`. Cost is one mutation per webhook — negligible. Andrew can ignore the data; future Phase 9.x can build a tiny dashboard if he wants.

3. **Do we need `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` at all?**
   - What we know: Hosted Checkout flow doesn't use Stripe.js — server creates session, returns URL, browser does `window.location.href = url`.
   - What's unclear: Brief lists `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in env vars. Is that for a future Elements flow?
   - Recommendation: **Do not configure it for v1.** Document in `.env.example` as "reserved for future Elements integration; not required for hosted Checkout." Removing it from the brief's required env list reduces attack surface (one less public key in repo metadata, build pipelines, etc.).

4. **What's the minimum viable legal page content?**
   - What we know: CMR-07/08 require pages exist with no 404.
   - What's unclear: Does Andrew want full counsel-reviewed copy, or placeholders with `TODO(Andrew)`?
   - Recommendation: Ship placeholders with explicit `TODO(Andrew)` and an entry in STATE.md blockers ("Legal pages have placeholder copy; Andrew must replace before public launch"). Mirrors how `/about` was handled (still open, see STATE.md Blockers/Concerns).

5. **Should the BuyButton be inside or outside the ShopCallout footer?**
   - What we know: Phase 2 `apps/web/components/issue/ShopCallout.tsx` has a button linking to `/shop`. The `/shop` page itself needs a BuyButton.
   - What's unclear: Does the issue-page callout button skip `/shop` and go straight to checkout? The brief implies "callout → /shop → checkout" (two clicks), and that's what Phase 2 wired. Don't change it.
   - Recommendation: Keep the issue-page callout as a link to `/shop` (current behavior). The Checkout-initiating button lives only on `/shop`. Lower surface area, fewer accidental click-and-charge paths.

6. **Convex authentication for server-side mutation calls from the Next.js webhook handler.**
   - What we know: Phase 4 established the Python pipeline uses `Authorization: Convex <CONVEX_DEPLOY_KEY>` header against `/api/mutation` HTTP endpoint.
   - What's unclear: Does `ConvexHttpClient` from `convex/browser` support the same Authorization header pattern from server-side Node.js? Or do we need to use `/api/mutation` raw HTTP from the webhook?
   - Recommendation: Use `convex/nextjs`'s `fetchMutation` (Convex's official Next.js server-side helper) if available; otherwise hit `/api/mutation` directly with httpx-equivalent (`fetch` + Authorization). Resolve at plan time via Context7 or Convex docs.

7. **Sanity API version drift for `/shop` charity query.**
   - What we know: `sanityClient` is pinned to `apiVersion: '2024-01-01'` in `apps/web/lib/sanity/client.ts`.
   - What's unclear: Nothing — but flagging that the `/shop` query goes through the same client, so it inherits the version pin. No new pinning needed.

---

## Sources

### Primary (HIGH confidence)
- Project repo files — `apps/web/app/shop/page.tsx`, `apps/web/components/issue/ShopCallout.tsx`, `apps/web/lib/sanity/client.ts`, `apps/web/__tests__/game-sandbox.test.ts`, `convex/schema.ts`, `docs/CLAUDE_CODE_BRIEF.md`, `docs/API_CONTRACTS.md` §6 (Commerce), `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/STATE.md` — verified directly via Read tool.
- [Stripe webhook signature docs](https://docs.stripe.com/webhooks/signature) — canonical reference for `constructEvent`.
- [stripe-node official Next.js example](https://github.com/stripe/stripe-node/blob/master/examples/webhook-signing/nextjs/app/api/webhooks/route.ts) — canonical App Router pattern.
- [Stripe API: Checkout Session object](https://docs.stripe.com/api/checkout/sessions/object) — field shapes for `customer_details`, `shipping_details`, `amount_total`, `metadata`.
- [Stripe Checkout: collect physical addresses](https://docs.stripe.com/payments/collect-addresses) — `shipping_address_collection` semantics.

### Secondary (MEDIUM confidence — verified against official source)
- [Next.js App Router Webhook Handler Testing Guide](https://webhooks.cc/blog/nextjs-app-router-webhook-handler) — App Router patterns; corroborates `await req.text()` rule.
- [How I Handle Stripe Webhooks in Production (DEV)](https://dev.to/whoffagents/how-i-handle-stripe-webhooks-in-production-the-right-way-32jd) — `event.id` dedup pattern; matches Stripe docs guidance.
- [Stripe Checkout and Webhook in a Next.js 15 (2025) — John Gragson](https://medium.com/@gragson.john/stripe-checkout-and-webhook-in-a-next-js-15-2025-925d7529855e) — current (2025) App Router shape; aligns with official example.
- [Stripe CLI listen reference](https://docs.stripe.com/cli/listen) — local webhook testing flow.
- [stripe-node npm package](https://www.npmjs.com/package/stripe) — version verification (`22.1.1` published; pin a stable major before installing).

### Tertiary (LOW confidence — flagged)
- None. All claims in this document trace back to either project files, Stripe docs, or stripe-node SDK source.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Stripe SDK is stable; Next.js 15 App Router is project standard; Convex is wired.
- Architecture: HIGH — patterns are direct lifts from Stripe official examples and project conventions (Phase 2/6/7 source-scan tests, Phase 3 Convex schema patches).
- Pitfalls: HIGH — common Stripe + Next.js gotchas are well-catalogued in the ecosystem.
- Validation: HIGH — mirrors Phase 7 Vitest infrastructure; no new framework risk.
- Open questions: MEDIUM — most are planner-discretion calls, not technical uncertainty.

**Research date:** 2026-05-19
**Valid until:** 2026-06-18 (30 days for the stack itself; Stripe SDK majors ship quarterly so re-verify `npm view stripe version` at planning time even within validity window)
