---
phase: 08-stripe-commerce
plan: 05
type: execute
wave: 2
depends_on:
  - "08-01"
  - "08-03"
  - "08-04"
files_modified:
  - apps/web/app/api/stripe/webhook/route.ts
  - apps/web/lib/stripe/handlers.ts
autonomous: true
requirements:
  - CMR-04
  - CMR-05
  - CMR-06
must_haves:
  truths:
    - "apps/web/app/api/stripe/webhook/route.ts declares `export const runtime = 'nodejs'` (NOT edge — Stripe SDK needs Node crypto)"
    - "The route handler reads raw body via `await req.text()` BEFORE any JSON parse"
    - "The route handler calls `stripe.webhooks.constructEvent(rawBody, sig, secret)` unconditionally — there is no env-var bypass"
    - "Missing STRIPE_WEBHOOK_SECRET returns a non-2xx response (NOT a silent pass)"
    - "Invalid/missing signature returns 4xx; valid signature + processed event returns 200"
    - "apps/web/lib/stripe/handlers.ts implements handleStripeEvent(event) which calls api.stripeEvents.claim atomically; on firstTime=false the function returns without firing any downstream side effect"
    - "On firstTime=true and event.type='checkout.session.completed', the handler optionally inserts a row into stripeOrders (best-effort, gated by STRIPE_RECORD_ORDERS env flag)"
    - "The source-scan tripwire at apps/web/__tests__/stripe-webhook-source.test.ts passes (CMR-05 hard rule)"
    - "Both unit tests stripe-webhook.test.ts and stripe-webhook-idempotency.test.ts pass after this plan"
  artifacts:
    - path: "apps/web/app/api/stripe/webhook/route.ts"
      provides: "POST handler with raw-body signature verification, idempotency claim, runtime=nodejs"
      exports: ["POST", "runtime", "dynamic"]
    - path: "apps/web/lib/stripe/handlers.ts"
      provides: "handleStripeEvent(event) — atomic dedup + best-effort audit"
      exports: ["handleStripeEvent"]
  key_links:
    - from: "apps/web/app/api/stripe/webhook/route.ts"
      to: "apps/web/lib/stripe/server.ts getStripeServer()"
      via: "stripe.webhooks.constructEvent on raw body"
      pattern: "constructEvent"
    - from: "apps/web/lib/stripe/handlers.ts"
      to: "convex/stripeEvents.ts claim mutation"
      via: "ConvexHttpClient.mutation(api.stripeEvents.claim, ...) atomic check-and-insert"
      pattern: "stripeEvents\\.claim"
    - from: "apps/web/lib/stripe/handlers.ts"
      to: "convex/stripeOrders.ts insert mutation"
      via: "ConvexHttpClient.mutation(api.stripeOrders.insert, ...) best-effort audit, gated by STRIPE_RECORD_ORDERS"
      pattern: "stripeOrders\\.insert"
---

<objective>
Land the Stripe webhook handler with raw-body signature verification (CMR-04), atomic idempotency via Convex (CMR-06), and zero environment bypass (CMR-05). After this plan: three Wave 0 tests turn green — `__tests__/stripe-webhook.test.ts`, `__tests__/stripe-webhook-source.test.ts`, `__tests__/stripe-webhook-idempotency.test.ts`.

Purpose: Honors RESEARCH §Pattern 4 (verbatim route handler shape), §Pattern 5 (Convex idempotency via firstTime claim), §Pitfall 1 (no env bypass), §Pitfall 2 (raw body before JSON), §Pitfall 3 (runtime=nodejs), §Pitfall 4 (atomic dedup), §Pitfall 5 (webhook is source of truth, NOT thank-you page).

Output: A webhook route handler that survives forged-signature attempts, dedupes Stripe retries atomically, and records orders best-effort. The CMR-05 source-scan tripwire is in place as a permanent guard against future bypass.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/08-stripe-commerce/08-RESEARCH.md
@apps/web/__tests__/stripe-webhook.test.ts
@apps/web/__tests__/stripe-webhook-source.test.ts
@apps/web/__tests__/stripe-webhook-idempotency.test.ts
@apps/web/lib/stripe/server.ts
@apps/web/__tests__/game-sandbox.test.ts
@convex/stripeEvents.ts
@convex/stripeOrders.ts

<interfaces>
<!-- Convex HTTP client signature (already used in Phase 4 Python pipeline pattern;
     now used from Next.js server-side via convex/browser):
       import { ConvexHttpClient } from 'convex/browser'
       const convex = new ConvexHttpClient(NEXT_PUBLIC_CONVEX_URL)
       await convex.mutation(api.stripeEvents.claim, { eventId, eventType, livemode })
       // returns { firstTime: boolean }

     Generated api object (post Plan 08-03 codegen):
       api.stripeEvents.claim  -> mutation reference
       api.stripeOrders.insert -> mutation reference

     Stripe SDK constructEvent signature:
       stripe.webhooks.constructEvent(rawBody: string, sig: string, secret: string): Stripe.Event
       throws Stripe.errors.StripeSignatureVerificationError on bad signature

     Wave 0 test fixture expectations:
       stripe-webhook.test.ts: mocks convex/browser ConvexHttpClient + @convex/_generated/api
       stripe-webhook-idempotency.test.ts: same mocks; toggles claim() return value via vi.fn() per test
       stripe-webhook-source.test.ts: reads route.ts from disk, asserts patterns (no async needed)

     Stripe event types relevant to v1:
       'checkout.session.completed'    -> happy path; fire fulfillment audit
       'payment_intent.payment_failed' -> log only; Stripe already notifies customer -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create apps/web/lib/stripe/handlers.ts — handleStripeEvent with Convex idempotency</name>
  <read_first>
    - apps/web/__tests__/stripe-webhook-idempotency.test.ts (Wave 0 fixture — the test mocks ConvexHttpClient and toggles `firstTime` per case; the contract this file satisfies)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pattern 5 (handleStripeEvent shape + Convex claim mutation use)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Open Question 2 (STRIPE_RECORD_ORDERS feature flag default true; orders insert is best-effort)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pitfall 7 (Convex audit write failing silently — log + return success; do NOT throw)
    - convex/stripeEvents.ts (Plan 08-03 — claim mutation signature)
    - convex/stripeOrders.ts (Plan 08-03 — insert mutation signature)
  </read_first>
  <behavior>
    - Test 1: handleStripeEvent calls api.stripeEvents.claim exactly once with `{eventId, eventType, livemode}` derived from event.
    - Test 2: When claim returns `{firstTime: false}`, handler returns without calling api.stripeOrders.insert.
    - Test 3: When claim returns `{firstTime: true}` AND event.type=='checkout.session.completed' AND STRIPE_RECORD_ORDERS!=='false', handler calls api.stripeOrders.insert with session fields.
    - Test 4: When claim throws, handler re-throws (caller route maps to 5xx so Stripe retries — webhook hasn't "claimed" the event yet).
    - Test 5: When stripeOrders.insert throws, handler logs error but does NOT re-throw (audit is best-effort per Pitfall 7).
    - Test 6: STRIPE_RECORD_ORDERS='false' skips the stripeOrders.insert call even on firstTime=true.
  </behavior>
  <files>apps/web/lib/stripe/handlers.ts</files>
  <action>
    Create `apps/web/lib/stripe/handlers.ts`:

    ```typescript
    /**
     * Stripe webhook event handlers.
     *
     * Contract (called by apps/web/app/api/stripe/webhook/route.ts):
     *   handleStripeEvent(event) ->
     *     1. Atomic claim via api.stripeEvents.claim. If !firstTime, return early (replay).
     *     2. Switch on event.type. Currently handles:
     *          - checkout.session.completed: optionally write a stripeOrders audit row
     *          - payment_intent.payment_failed: log only
     *     3. Audit write is best-effort: a Convex error here logs + returns (Pitfall 7).
     *
     * Why best-effort audit: we have already claimed the event via stripeEvents.claim.
     * If we throw, Stripe retries the webhook — which will dedup at claim and skip the
     * audit again. Either we drop one audit row OR we never write it; the second case
     * is worse than the first.
     */
    import type Stripe from 'stripe'
    import { ConvexHttpClient } from 'convex/browser'
    import { api } from '@convex/_generated/api'

    function getConvexClient(): ConvexHttpClient {
      const url = process.env.NEXT_PUBLIC_CONVEX_URL
      if (!url) {
        throw new Error('NEXT_PUBLIC_CONVEX_URL is not set; webhook cannot reach Convex.')
      }
      return new ConvexHttpClient(url)
    }

    export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
      const convex = getConvexClient()

      // Step 1: atomic claim. Re-throw on Convex failure so the caller returns 5xx
      // and Stripe retries (we have NOT yet committed to processing this event).
      const claim = (await convex.mutation(api.stripeEvents.claim, {
        eventId: event.id,
        eventType: event.type,
        livemode: event.livemode,
      })) as { firstTime: boolean }

      if (!claim.firstTime) {
        // Replay: log + return success. Stripe will stop retrying on 200.
        // eslint-disable-next-line no-console
        console.log(`[stripe.webhook] replay ignored: ${event.id} (${event.type})`)
        return
      }

      // Step 2: switch on event type. v1 only handles two.
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object as Stripe.Checkout.Session
          await maybeRecordOrder(convex, session, event.id)
          break
        }
        case 'payment_intent.payment_failed': {
          // Stripe already emails the customer. Log for ops visibility.
          // eslint-disable-next-line no-console
          console.log(`[stripe.webhook] payment_failed: ${event.id}`)
          break
        }
        default: {
          // Subscribed events are configured in Dashboard; defensive no-op for
          // unexpected types.
          // eslint-disable-next-line no-console
          console.log(`[stripe.webhook] unhandled event type: ${event.type} (${event.id})`)
          break
        }
      }
    }

    /**
     * Best-effort write to convex stripeOrders. Errors are logged + swallowed
     * (Pitfall 7). Gated by STRIPE_RECORD_ORDERS env flag (default 'true').
     */
    async function maybeRecordOrder(
      convex: ConvexHttpClient,
      session: Stripe.Checkout.Session,
      eventId: string,
    ): Promise<void> {
      if (process.env.STRIPE_RECORD_ORDERS === 'false') {
        return
      }
      try {
        await convex.mutation(api.stripeOrders.insert, {
          sessionId: session.id,
          eventId,
          amountTotal: session.amount_total ?? 0,
          currency: session.currency ?? 'usd',
          customerEmail: session.customer_details?.email ?? undefined,
          // charitySlug was locked at click time (Open Question 1) via session.metadata.
          charitySlug:
            (session.metadata?.charitySlug && session.metadata.charitySlug.length > 0)
              ? session.metadata.charitySlug
              : undefined,
        })
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[stripe.webhook] stripeOrders.insert failed for ${eventId}; continuing.`, err)
      }
    }
    ```

    Notes:
    - The Convex `mutation()` return is cast to `{ firstTime: boolean }` — the actual generated type from codegen will be narrower (literal union), but the cast avoids a tight coupling that would break if Convex regenerates with slightly different inference.
    - `STRIPE_RECORD_ORDERS === 'false'` (string compare, NOT `!== 'true'`) — defaults to TRUE if the var is unset or any other value. Matches the conservative default from RESEARCH Open Question 2.
    - Audit write swallows errors but logs them (Pitfall 7). The claim is the load-bearing write; audit is observability candy.
    - `charitySlug` may be empty string when click-time Sanity read failed (Plan 08-04). We persist as undefined in that case so Convex doesn't store a blank.
  </action>
  <verify>
    <automated>test -f apps/web/lib/stripe/handlers.ts && grep -q "export async function handleStripeEvent" apps/web/lib/stripe/handlers.ts && grep -q "api.stripeEvents.claim" apps/web/lib/stripe/handlers.ts && grep -q "firstTime" apps/web/lib/stripe/handlers.ts && grep -q "api.stripeOrders.insert" apps/web/lib/stripe/handlers.ts && grep -q "STRIPE_RECORD_ORDERS" apps/web/lib/stripe/handlers.ts && grep -q "checkout.session.completed" apps/web/lib/stripe/handlers.ts && pnpm --filter web typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/lib/stripe/handlers.ts` exits 0
    - `grep -q "export async function handleStripeEvent" apps/web/lib/stripe/handlers.ts` exits 0
    - `grep -q "api.stripeEvents.claim" apps/web/lib/stripe/handlers.ts` exits 0
    - `grep -q "if (!claim.firstTime)" apps/web/lib/stripe/handlers.ts` exits 0
    - `grep -q "api.stripeOrders.insert" apps/web/lib/stripe/handlers.ts` exits 0
    - `grep -q "STRIPE_RECORD_ORDERS" apps/web/lib/stripe/handlers.ts` exits 0
    - `grep -q "checkout.session.completed" apps/web/lib/stripe/handlers.ts` exits 0
    - `grep -q "payment_intent.payment_failed" apps/web/lib/stripe/handlers.ts` exits 0
    - `grep -q "ConvexHttpClient" apps/web/lib/stripe/handlers.ts` exits 0
    - `grep -q "NEXT_PUBLIC_CONVEX_URL" apps/web/lib/stripe/handlers.ts` exits 0
    - `grep -q "session.metadata?.charitySlug\\|session.metadata.charitySlug" apps/web/lib/stripe/handlers.ts` exits 0 (charitySlug propagated from session metadata)
    - `pnpm --filter web typecheck` exits 0
  </acceptance_criteria>
  <done>Event handler with atomic dedup + best-effort audit lands; typecheck clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create apps/web/app/api/stripe/webhook/route.ts (CMR-04, CMR-05, CMR-06)</name>
  <read_first>
    - apps/web/__tests__/stripe-webhook.test.ts (4 cases — valid sig 200, forged sig 4xx, missing sig 400, unset secret non-2xx)
    - apps/web/__tests__/stripe-webhook-source.test.ts (6 source-scan assertions — constructEvent, runtime=nodejs, await req.text(), NO FORBIDDEN_BYPASS patterns)
    - apps/web/__tests__/stripe-webhook-idempotency.test.ts (first-time + replay + claim args)
    - apps/web/lib/stripe/server.ts (Plan 08-04 — getStripeServer)
    - apps/web/lib/stripe/handlers.ts (Task 1 above)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pattern 4 (verbatim handler shape)
    - apps/web/__tests__/game-sandbox.test.ts (Phase 7 source-scan reference — this plan's webhook is the equivalent locked surface)
  </read_first>
  <behavior>
    - Test 1: Missing STRIPE_WEBHOOK_SECRET env var -> 4xx/5xx response, no event processing.
    - Test 2: Missing `stripe-signature` header -> 400 response.
    - Test 3: Bad signature -> 400 response (constructEvent throws).
    - Test 4: Valid signature -> 200 response and handleStripeEvent called once.
    - Test 5: Replay (claim returns firstTime=false inside handleStripeEvent) -> 200 response (Stripe stops retrying).
    - Test 6 (source-scan): Module exports `runtime = 'nodejs'`.
    - Test 7 (source-scan): Module reads body via `await req.text()` BEFORE JSON parse.
    - Test 8 (source-scan): Module contains string `constructEvent`.
    - Test 9 (source-scan): Module contains NONE of the FORBIDDEN_BYPASS patterns (SKIP_SIGNATURE, BYPASS_SIGNATURE, STRIPE_SKIP_VERIFY, NODE_ENV-conditional-return).
  </behavior>
  <files>apps/web/app/api/stripe/webhook/route.ts</files>
  <action>
    Create `apps/web/app/api/stripe/webhook/route.ts` with EXACTLY this shape. The source-scan tripwire is unforgiving — every literal pattern matters.

    ```typescript
    /**
     * POST /api/stripe/webhook
     *
     * Stripe webhook handler. Requirements:
     *   - CMR-04: verify signature against raw body using STRIPE_WEBHOOK_SECRET
     *   - CMR-05: NO env-var bypass — signature is ALWAYS required, in EVERY environment
     *   - CMR-06: idempotency on event.id via Convex stripeEvents.claim (atomic)
     *
     * Sources (verbatim shape lifts):
     *   - https://github.com/stripe/stripe-node/blob/master/examples/webhook-signing/nextjs/app/api/webhooks/route.ts
     *   - https://docs.stripe.com/webhooks/signature
     *   - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pattern 4
     *
     * Locked invariants enforced by apps/web/__tests__/stripe-webhook-source.test.ts:
     *   - export const runtime = 'nodejs'  (Stripe SDK uses Node crypto; edge breaks it)
     *   - await req.text() BEFORE any JSON parse  (JSON re-serialization breaks HMAC)
     *   - stripe.webhooks.constructEvent(...) is always called
     *   - NO patterns matching /SKIP_SIGNATURE/i, /BYPASS_SIGNATURE/i, /STRIPE_SKIP_VERIFY/i,
     *     or /NODE_ENV !== 'production' ... return/  (signature is always verified)
     */
    import { NextResponse } from 'next/server'
    import type Stripe from 'stripe'
    import { getStripeServer } from '@/lib/stripe/server'
    import { handleStripeEvent } from '@/lib/stripe/handlers'

    export const runtime = 'nodejs'
    export const dynamic = 'force-dynamic'

    export async function POST(req: Request) {
      const secret = process.env.STRIPE_WEBHOOK_SECRET
      if (!secret) {
        // Misconfiguration. NOT a bypass — we never process unverified events.
        // Returning 500 (rather than 200) lets Stripe retry, so once the env
        // var is set we recover. Logged to surface the gap loudly.
        // eslint-disable-next-line no-console
        console.error('[stripe.webhook] STRIPE_WEBHOOK_SECRET is not set; rejecting.')
        return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
      }

      const sig = req.headers.get('stripe-signature')
      if (!sig) {
        return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
      }

      // Raw body MUST be read via .text() BEFORE any JSON parsing.
      // JSON.parse + JSON.stringify reorders keys / drops whitespace / escapes
      // Unicode differently, which breaks Stripe's HMAC. (Pitfall 2.)
      const rawBody = await req.text()

      let stripe
      try {
        stripe = getStripeServer()
      } catch {
        return NextResponse.json({ error: 'Misconfigured' }, { status: 500 })
      }

      let event: Stripe.Event
      try {
        event = stripe.webhooks.constructEvent(rawBody, sig, secret)
      } catch {
        // Bad signature. Never log payload (could leak). 400 stops retries.
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
      }

      try {
        await handleStripeEvent(event)
      } catch (err) {
        // Convex claim failure or other downstream error.
        // 5xx so Stripe retries; claim is idempotent so retry-after-fix is safe.
        // eslint-disable-next-line no-console
        console.error(`[stripe.webhook] handler error for ${event.id}:`, err)
        return NextResponse.json({ error: 'Handler error' }, { status: 500 })
      }

      // Signature OK + handler done (either processed or recognized as replay).
      return NextResponse.json({ received: true })
    }
    ```

    Critical: every line of this file is under source-scan from `__tests__/stripe-webhook-source.test.ts`. Specifically:

    - `export const runtime = 'nodejs'` — exact string match required.
    - `await req.text()` — exact pattern match. Do NOT change to `request.text()` or use a Buffer reader.
    - `stripe.webhooks.constructEvent` — exact identifier required.
    - `NODE_ENV !== 'production'` followed by `return` within 150 chars — FORBIDDEN. Do not write any branch like `if (process.env.NODE_ENV !== 'production') { return ... }`.
    - The strings `SKIP_SIGNATURE`, `STRIPE_SKIP_VERIFY`, `BYPASS_SIGNATURE` — FORBIDDEN anywhere in the file (including comments).

    Notes for the executor:
    - Use `console.error` with the prefix `[stripe.webhook]` for log correlation (matches Phase 6/7 logging conventions).
    - Do NOT log the raw body, signature header, or event payload. Logging only the event.id is safe (it's not secret) and useful.
    - The double try/catch (getStripeServer + constructEvent) is intentional: STRIPE_SECRET_KEY missing is config (500), bad signature is attacker (400). Keep them distinct.
    - Do NOT add `request.headers.get('stripe-signature')!` (non-null assertion). The explicit `if (!sig)` branch is the right shape.
  </action>
  <verify>
    <automated>test -f apps/web/app/api/stripe/webhook/route.ts && cd apps/web && npx vitest run __tests__/stripe-webhook.test.ts __tests__/stripe-webhook-source.test.ts __tests__/stripe-webhook-idempotency.test.ts 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `test -f apps/web/app/api/stripe/webhook/route.ts` exits 0
    - `grep -q "export const runtime = 'nodejs'" apps/web/app/api/stripe/webhook/route.ts` exits 0 (exact literal — source-scan)
    - `grep -q "export const dynamic = 'force-dynamic'" apps/web/app/api/stripe/webhook/route.ts` exits 0
    - `grep -q "await req.text()" apps/web/app/api/stripe/webhook/route.ts` exits 0
    - `grep -q "stripe.webhooks.constructEvent" apps/web/app/api/stripe/webhook/route.ts` exits 0
    - `grep -q "STRIPE_WEBHOOK_SECRET" apps/web/app/api/stripe/webhook/route.ts` exits 0
    - `grep -q "handleStripeEvent" apps/web/app/api/stripe/webhook/route.ts` exits 0
    - NO match for `grep -E "SKIP_SIGNATURE|BYPASS_SIGNATURE|STRIPE_SKIP_VERIFY" apps/web/app/api/stripe/webhook/route.ts` (forbidden patterns absent)
    - NO match for `grep -E "NODE_ENV.*!==.*production" apps/web/app/api/stripe/webhook/route.ts` (no environment branching on signature verification)
    - NO match for `grep -q "runtime = 'edge'" apps/web/app/api/stripe/webhook/route.ts` (edge runtime forbidden)
    - `pnpm --filter web typecheck` exits 0
    - `cd apps/web && npx vitest run __tests__/stripe-webhook.test.ts` exits 0 (all 4 test cases pass)
    - `cd apps/web && npx vitest run __tests__/stripe-webhook-source.test.ts` exits 0 (all 6 source-scan assertions pass)
    - `cd apps/web && npx vitest run __tests__/stripe-webhook-idempotency.test.ts` exits 0 (all 3 idempotency cases pass)
  </acceptance_criteria>
  <done>Webhook route handler lands; all three Wave 0 webhook tests turn green; CMR-04, CMR-05, CMR-06 satisfied in mocked tests.</done>
</task>

</tasks>

<verification>
After both tasks complete:
- `pnpm --filter web test:unit` shows green for the three webhook tests plus the checkout test from Plan 08-04
- `pnpm --filter web typecheck` exits 0
- The source-scan tripwire is locked in: any future edit that introduces a bypass pattern fails the build
- Phase 7's pattern of locked-source-of-truth tests is now mirrored for Phase 8's webhook
</verification>

<success_criteria>
- CMR-04 satisfied (mocked + source-scan): raw body read + signature verified via constructEvent
- CMR-05 satisfied (source-scan): no env-var bypass anywhere; tripwire is the permanent guard
- CMR-06 satisfied (mocked): replay via firstTime=false skips fulfillment; first-time fires audit
- Pitfall 1, 2, 3, 4, 7 all mitigated by direct code structure
- The webhook is now the source of truth for fulfillment; thank-you page (Plan 08-07) remains decorative
</success_criteria>

<output>
After completion, create `.planning/phases/08-stripe-commerce/08-05-webhook-handler-and-idempotency-SUMMARY.md` recording:
- 2 files created (route.ts + handlers.ts)
- Vitest results for the 3 Wave 0 webhook tests (target: all pass)
- Confirmation that `__tests__/stripe-webhook-source.test.ts` source-scan tripwire is green (the locked guard)
- The STRIPE_RECORD_ORDERS feature flag default ('true') and its semantics
- Any deviations from RESEARCH Pattern 4 (none expected)
- Note for Plan 08-08 smoke: forged-signature test instructions (curl with bogus stripe-signature header against deployed webhook URL)
</output>
</content>
