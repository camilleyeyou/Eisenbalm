---
phase: 08-stripe-commerce
plan: 08
type: execute
wave: 4
depends_on:
  - "08-02"
  - "08-03"
  - "08-04"
  - "08-05"
  - "08-06"
  - "08-07"
files_modified:
  - apps/web/README.md
autonomous: false
requirements:
  - CMR-01
  - CMR-02
  - CMR-04
  - CMR-05
  - CMR-06
  - CMR-10
must_haves:
  truths:
    - "apps/web/README.md has a new '## Phase 8 — Stripe / Commerce' section appended at the end (additive; existing sections preserved)"
    - "The Phase 8 README section documents: file layout, env vars, the locked sandbox contract for the webhook (no env bypass), the idempotency model (Convex stripeEvents.claim), and Andrew's manual UAT runbook"
    - "Andrew runs the manual UAT against a deployed (or local + Stripe CLI) environment and confirms (a) test purchase with 4242 card lands on /shop/thank-you, (b) forged-signature curl returns 4xx, (c) Stripe CLI replay logs 'replay ignored', (d) /legal/privacy and /legal/terms return 200"
    - "The Plan 08-08 SUMMARY records the smoke test outcome and a Phase 8 closure checklist (10 CMR items)"
  artifacts:
    - path: "apps/web/README.md"
      provides: "Phase 8 onboarding section: file layout, env vars, security contract, idempotency model, UAT runbook"
      contains: "Phase 8"
      min_lines: 60
  key_links:
    - from: "apps/web/README.md"
      to: "apps/web/app/api/stripe/webhook/route.ts"
      via: "README references the locked webhook source-scan tripwire"
      pattern: "stripe-webhook-source"
    - from: "apps/web/README.md"
      to: "convex/stripeEvents.ts"
      via: "README documents the idempotency claim mutation"
      pattern: "stripeEvents\\.claim"
    - from: "apps/web/README.md"
      to: ".planning/STATE.md"
      via: "README acknowledges the legal-copy blocker and the Stripe Dashboard setup blocker resolution"
      pattern: "STATE\\.md"
---

<objective>
Document Phase 8 in `apps/web/README.md` and execute Andrew's manual UAT for the requirements that cannot be fully automated (CMR-02 real test purchase, CMR-05 forged signature against deployed endpoint, CMR-06 Stripe CLI replay). Mirror Phase 7 Plan 07-05 structure: README section + checkpoint:human-verify task + SUMMARY capture.

Purpose: Phase 8 has automated mocked coverage for CMR-01..CMR-10 via Vitest (Plans 08-01 through 08-07). The closing gate is the manual UAT that confirms the deployed app talks to Stripe correctly. The README captures the runbook so Andrew (or any future operator) can re-run after future webhook edits.

Output: Updated `apps/web/README.md` Phase 8 section + Andrew's smoke results captured in the Plan 08-08 SUMMARY.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/08-stripe-commerce/08-RESEARCH.md
@.planning/phases/08-stripe-commerce/08-VALIDATION.md
@.planning/phases/07-game-rendering/07-05-readme-and-smoke-test-PLAN.md
@apps/web/README.md
@apps/web/app/api/stripe/webhook/route.ts
@apps/web/app/api/checkout/create-session/route.ts
@apps/web/lib/stripe/server.ts
@apps/web/lib/stripe/handlers.ts
@apps/web/components/marketing/BuyButton.tsx
@apps/web/__tests__/stripe-webhook-source.test.ts
@convex/stripeEvents.ts
@convex/stripeOrders.ts

<interfaces>
<!-- Phase 7 Plan 07-05 is the canonical precedent for this plan:
       - Task 1: append "## Phase 7 — Game Rendering" section to apps/web/README.md
       - Task 2: checkpoint:human-verify with detailed how-to-verify runbook
       - Task 3: capture results in SUMMARY with closure checklist
     Phase 8 mirrors this exact 3-task structure with Phase-8-specific content.

     Phase 8 files to reference in the README (all created in earlier plans):
       apps/web/app/api/checkout/create-session/route.ts  (Plan 08-04)
       apps/web/app/api/stripe/webhook/route.ts           (Plan 08-05)
       apps/web/app/shop/page.tsx                         (Plan 08-06)
       apps/web/app/shop/thank-you/page.tsx               (Plan 08-07)
       apps/web/app/legal/privacy/page.tsx                (Plan 08-07)
       apps/web/app/legal/terms/page.tsx                  (Plan 08-07)
       apps/web/lib/stripe/server.ts                      (Plan 08-04)
       apps/web/lib/stripe/constants.ts                   (Plan 08-04)
       apps/web/lib/stripe/handlers.ts                    (Plan 08-05)
       apps/web/components/marketing/BuyButton.tsx        (Plan 08-04)
       convex/stripeEvents.ts                             (Plan 08-03)
       convex/stripeOrders.ts                             (Plan 08-03)
       apps/web/__tests__/{8 test files}                  (Plan 08-01)

     Env vars (documented in apps/web/.env.example by Plan 08-03):
       STRIPE_SECRET_KEY (secret), STRIPE_WEBHOOK_SECRET (secret),
       STRIPE_PRICE_ID, STRIPE_RECORD_ORDERS=true, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (reserved)

     Plan 08-02 (Stripe Dashboard checkpoint) resolves the existing STATE.md
     Phase-6-carryover Stripe blocker; the SUMMARY for Plan 08-02 should
     mark that blocker as RESOLVED. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Append "## Phase 8 — Stripe / Commerce" section to apps/web/README.md</name>
  <read_first>
    - apps/web/README.md (current contents — must not clobber prior phase sections; locate the insertion point at the end of the file)
    - .planning/phases/08-stripe-commerce/08-VALIDATION.md (Manual-Only Verifications table — used verbatim in the UAT runbook)
    - .planning/phases/07-game-rendering/07-05-readme-and-smoke-test-PLAN.md Task 1 (formatting precedent: architecture table, security contract, runbook structure)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Validation Architecture (per-requirement test/manual map for the runbook)
  </read_first>
  <files>apps/web/README.md (append-only)</files>
  <action>
    Open `apps/web/README.md` and APPEND a new `## Phase 8 — Stripe / Commerce` section at the END of the file. Do NOT remove or restructure existing sections (Phase 1 through Phase 7 documentation must be preserved).

    Use this exact markdown content. The heading `## Phase 8 — Stripe / Commerce` uses an en-dash (U+2014, the same character Phase 7's heading uses — verify by grep):

    ```markdown
    ## Phase 8 — Stripe / Commerce

    Phase 8 wires the lip-balm commerce surface: a server-rendered `/shop`
    page, Stripe Checkout (hosted), `/shop/thank-you`, a signature-verifying
    webhook with idempotency, and legal placeholders.

    ### Architecture

    | File | Role |
    |------|------|
    | `apps/web/app/shop/page.tsx` | Server Component: charity callout + BuyButton (CMR-01) |
    | `apps/web/components/marketing/BuyButton.tsx` | Client Component: POSTs to `/api/checkout/create-session`, redirects to Stripe URL |
    | `apps/web/app/api/checkout/create-session/route.ts` | POST handler: creates Stripe Checkout session with shipping + charitySlug metadata (CMR-02, CMR-10) |
    | `apps/web/app/api/stripe/webhook/route.ts` | POST handler: raw-body signature verify + atomic idempotency (CMR-04, CMR-05, CMR-06) |
    | `apps/web/lib/stripe/server.ts` | Stripe SDK singleton with pinned `apiVersion` |
    | `apps/web/lib/stripe/constants.ts` | API version pin + success/cancel URL builders |
    | `apps/web/lib/stripe/handlers.ts` | `handleStripeEvent` — atomic dedup + best-effort audit |
    | `apps/web/app/shop/thank-you/page.tsx` | Decorative confirmation; NO DB query (CMR-03) |
    | `apps/web/app/legal/privacy/page.tsx` | Privacy placeholder, `TODO(Andrew)` (CMR-07) |
    | `apps/web/app/legal/terms/page.tsx` | Terms placeholder, `TODO(Andrew)` (CMR-08) |
    | `convex/stripeEvents.ts` | Atomic claim mutation returning `{ firstTime }` |
    | `convex/stripeOrders.ts` | Best-effort audit insert |
    | `apps/web/__tests__/stripe-webhook-source.test.ts` | Source-scan tripwire: no env bypass, runtime nodejs, raw body |

    ### Security contract (LOCKED)

    The webhook route at `apps/web/app/api/stripe/webhook/route.ts` enforces
    three invariants. NEVER weaken any of them:

    1. `export const runtime = 'nodejs'` — Stripe SDK uses Node `crypto`, not
       Web Crypto. The edge runtime breaks signature verification.
    2. `await req.text()` BEFORE any JSON parse — JSON re-serialization
       breaks HMAC (key order, whitespace, escape differences).
    3. `stripe.webhooks.constructEvent(rawBody, sig, secret)` runs in every
       environment — there is NO `if (process.env.NODE_ENV !== 'production')`
       bypass, ever.

    The Vitest test at `apps/web/__tests__/stripe-webhook-source.test.ts` reads
    the route file from disk and fails the build if any of these invariants
    regress. DO NOT delete or weaken that test.

    ### Idempotency model

    Stripe retries webhooks aggressively (every minute, then exponentially).
    Two retries of the same `event.id` MUST trigger fulfillment exactly once.

    Convex serializes mutations per-table; the `stripeEvents.claim` mutation
    checks `withIndex('by_eventId').first()` and inserts atomically:

    ```typescript
    // convex/stripeEvents.ts
    export const claim = mutation({
      args: { eventId: v.string(), eventType: v.string(), livemode: v.boolean() },
      handler: async (ctx, args) => {
        const existing = await ctx.db
          .query('stripeEvents')
          .withIndex('by_eventId', (q) => q.eq('eventId', args.eventId))
          .first()
        if (existing) return { firstTime: false }
        await ctx.db.insert('stripeEvents', { ...args, receivedAt: Date.now() })
        return { firstTime: true }
      },
    })
    ```

    Returning `{ firstTime: false }` is the dedup signal — the webhook handler
    logs "replay ignored" and returns 200 without touching the audit table.

    ### Order audit (optional, behind feature flag)

    On `checkout.session.completed`, the handler also writes a row to
    `convex/stripeOrders` with `{ sessionId, eventId, amountTotal, currency,
    customerEmail?, charitySlug? }`. This is **best-effort**: if the insert
    fails, the handler logs the error but returns 200 to Stripe (the
    `stripeEvents.claim` has already locked the event id, so a retry would
    also dedup and skip).

    Toggle via env var: set `STRIPE_RECORD_ORDERS=false` to disable order
    persistence. The Stripe Dashboard remains the source of truth for orders.

    ### Charity attribution

    The `charitySlug` for an order is locked at click time, NOT at webhook
    time. The `/api/checkout/create-session` endpoint queries Sanity for the
    current published issue's `charity.slug.current` and stamps it into
    `session.metadata.charitySlug`. The webhook reads that value when writing
    the audit row.

    This avoids the race where a new issue publishes between click and
    webhook — without the click-time lock, the wrong charity would be
    credited for orders in flight at publication time.

    ### Environment variables

    Set in `apps/web/.env.local` (gitignored) and in Vercel's project
    environment settings:

    | Var | Required | Source |
    |-----|----------|--------|
    | `STRIPE_SECRET_KEY` | YES | Stripe Dashboard -> Developers -> API keys -> Secret key |
    | `STRIPE_WEBHOOK_SECRET` | YES | Stripe Dashboard -> Developers -> Webhooks -> endpoint -> Signing secret  (or `stripe listen` CLI output) |
    | `STRIPE_PRICE_ID` | YES | Stripe Dashboard -> Products -> lip balm -> Price id |
    | `STRIPE_RECORD_ORDERS` | optional (default `true`) | Set `false` to skip Convex audit writes |
    | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | no (reserved) | Hosted Checkout does not use it; reserved for V2 Elements |
    | `NEXT_PUBLIC_CONVEX_URL` | YES (already set by Phase 3) | Convex deployment URL |

    Plan 08-02 walks through Andrew's one-time Stripe Dashboard setup.

    ### Running the tests

    ```bash
    pnpm --filter web test:unit                                # full Vitest suite
    pnpm --filter web test:unit stripe-webhook-source          # CMR-05 tripwire only
    pnpm --filter web test:unit checkout-create-session        # CMR-02 + CMR-10
    pnpm --filter web test:unit stripe-webhook-idempotency     # CMR-06
    ```

    No watch mode in CI — the npm script uses `vitest run`.

    ### Andrew's manual UAT runbook

    The mocked unit tests cover CMR-01..CMR-10 in isolation. The UAT below
    confirms the real surface works end-to-end against the actual Stripe
    Dashboard configured in Plan 08-02.

    **Prerequisites:**
    - Plan 08-02 complete: Stripe Dashboard has Product + Price + Shipping
      Rate + Webhook Endpoint, `apps/web/.env.local` has all four Stripe env
      vars in test mode.
    - For local UAT: Stripe CLI installed (`stripe login` succeeded).
    - For deployed UAT: Vercel preview deployment has all Stripe env vars
      set (same names; copy from `apps/web/.env.local` into Vercel project
      settings -> Environment Variables).

    **Part A — Test purchase (CMR-01, CMR-02, CMR-10):**

    1. Open `/shop` in a browser (local: `pnpm --filter web dev`, then
       `http://localhost:3000/shop`; deployed: `https://<vercel-preview>/shop`).
    2. Confirm:
       - The page renders server-side: view source shows the charity name
         (e.g. "This week's proceeds benefit ...") in the HTML response.
         No loading skeleton, no client-side flicker on hard refresh.
       - The "Buy the lip balm" button is enabled (no "Coming soon" placeholder).
    3. Click the button. Confirm you redirect to `https://checkout.stripe.com/...`
       (Stripe-hosted page). The page shows the lip balm SKU, the price set
       in Plan 08-02, and a shipping address form.
    4. Fill in the shipping form. Pay with the Stripe test card
       `4242 4242 4242 4242`, any future expiry, any CVC, any ZIP.
    5. Confirm you land on `/shop/thank-you?session_id=cs_test_...`
       - The page renders "Your lip balm is on the way."
       - The page does NOT show order details (amount, items, email) —
         that's CMR-03 by design.
       - View source: no `<script>` references to the session id beyond
         the URL itself.

    **Part B — Forged signature rejection (CMR-04, CMR-05):**

    From a terminal:

    ```bash
    # Replace WEBHOOK_URL with the deployed webhook (e.g. https://<vercel>/api/stripe/webhook)
    # or http://localhost:3000/api/stripe/webhook for local dev.
    WEBHOOK_URL="http://localhost:3000/api/stripe/webhook"

    curl -i -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -H "Stripe-Signature: t=0,v1=this_is_obviously_forged" \
      -d '{"id":"evt_forged_test","type":"checkout.session.completed","data":{"object":{}}}'
    ```

    Confirm:
    - HTTP status returned is in the 400 range (not 200).
    - No order is created in the Stripe Dashboard.
    - No row is inserted into Convex `stripeEvents` or `stripeOrders`
      (check via Convex dashboard).
    - Server logs show "[stripe.webhook]" prefix on the rejection.

    Repeat with a missing `Stripe-Signature` header — expect HTTP 400.

    **Part C — Idempotent replay (CMR-06):**

    Using Stripe CLI:

    ```bash
    # In one terminal:
    stripe listen --forward-to localhost:3000/api/stripe/webhook
    # Note the printed signing secret (starts with whsec_) — confirm it
    # matches STRIPE_WEBHOOK_SECRET in apps/web/.env.local.

    # In another terminal:
    stripe trigger checkout.session.completed
    # This fires a real event. Confirm:
    #   - Server logs show one [stripe.webhook] entry for evt_xxx
    #   - Convex stripeEvents has a new row with that eventId
    #   - Convex stripeOrders has a new row (if STRIPE_RECORD_ORDERS=true)

    # Find the event id (e.g. evt_test_1NXYZ...) from the first run, then:
    stripe events resend evt_test_1NXYZ
    # Confirm:
    #   - Server logs show "replay ignored: evt_test_1NXYZ"
    #   - Convex stripeEvents row count for this eventId is still 1
    #   - Convex stripeOrders row count is still 1 (no duplicate)
    #   - HTTP 200 still returned to the resend (so Stripe stops retrying)
    ```

    **Part D — Legal pages render (CMR-07, CMR-08):**

    1. Visit `/legal/privacy`. Confirm:
       - 200 response, no 404.
       - Heading "Privacy" renders.
       - Placeholder copy mentions Stripe.
       - "Last updated: placeholder pending Andrew's review" is visible.
    2. Visit `/legal/terms`. Confirm same checks with "Terms" heading.

    **Part E — Shop callout still on issue pages (CMR-09):**

    1. Open any published issue (e.g. `/issue/<latest-slug>`).
    2. Scroll to the bottom of the article.
    3. Confirm the ShopCallout renders: one sentence + "Buy the lip balm"
       button. No banner, no modal, no popup, no countdown.
    4. Click the button -> confirm it links to `/shop` (NOT directly to
       Stripe Checkout — the two-click flow is intentional per Open
       Question 5).

    ### What to do if a UAT step fails

    - Part A test purchase fails: check `STRIPE_PRICE_ID` matches the
      Dashboard. Re-run Plan 08-02 verification.
    - Part B forged signature returns 200: this is a CMR-05 violation.
      Re-run `pnpm --filter web test:unit stripe-webhook-source` to see
      what the source-scan caught (or missed). DO NOT ship.
    - Part C replay creates a second row: check `convex/stripeEvents.ts`
      for the `by_eventId` index and the `if (existing) return { firstTime: false }`
      guard. Re-deploy Convex if the schema is stale.
    - Part D 404 on legal pages: verify directory structure
      `apps/web/app/legal/{privacy,terms}/page.tsx`.
    - Part E ShopCallout missing or replaced with a banner: revert any
      changes to `apps/web/components/issue/ShopCallout.tsx` or
      `apps/web/app/issue/[slug]/page.tsx`. CMR-09 is locked at the
      Phase 2 boundary.

    ### Phase 8 closure checklist

    - [ ] CMR-01: /shop server-rendered with charity callout
    - [ ] CMR-02: Stripe Checkout session via custom integration
    - [ ] CMR-03: /shop/thank-you static, no DB query
    - [ ] CMR-04: Webhook verifies signature using raw body
    - [ ] CMR-05: No dev-mode bypass on signature verification
    - [ ] CMR-06: Idempotent on event.id via Convex
    - [ ] CMR-07: /legal/privacy exists (placeholder copy)
    - [ ] CMR-08: /legal/terms exists (placeholder copy)
    - [ ] CMR-09: Persistent ShopCallout on every issue page
    - [ ] CMR-10: Stripe shipping rates configured

    Phase 8 is COMPLETE when all 10 are checked. If any UAT step failed,
    open a gap-closure plan via `/gsd:plan-phase 8 --gaps` — DO NOT mark
    the phase complete.
    ```

    Notes for the executor:
    - The heading must be exactly `## Phase 8 — Stripe / Commerce` (em-dash, not hyphen). Match the Phase 7 pattern.
    - Insert at the END of `apps/web/README.md`. Do NOT delete or restructure any existing section.
    - Code blocks: triple-backtick fences. Use language hints (`bash`, `typescript`) where applicable.
    - No emojis (CLAUDE.md voice rule).
    - The "Last updated" line in copy uses a curly apostrophe in some renders but the source can use the plain apostrophe — match what's actually in `apps/web/app/legal/privacy/page.tsx` after Plan 08-07.
  </action>
  <verify>
    <automated>grep -c "^## Phase 8 — Stripe / Commerce$" apps/web/README.md && grep -c "stripe-webhook-source" apps/web/README.md && grep -c "stripeEvents.claim" apps/web/README.md && grep -c "STRIPE_WEBHOOK_SECRET" apps/web/README.md && grep -c "no env-var bypass\\|env.var.bypass\\|NEVER weaken" apps/web/README.md && grep -c "4242 4242 4242 4242" apps/web/README.md && grep -c "Phase 7 — Game Rendering" apps/web/README.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^## Phase 8 — Stripe / Commerce$" apps/web/README.md` returns exactly 1 (em-dash, not hyphen)
    - `grep -c "stripe-webhook-source" apps/web/README.md` returns at least 1 (tripwire referenced)
    - `grep -c "stripeEvents.claim" apps/web/README.md` returns at least 1 (idempotency model documented)
    - `grep -c "STRIPE_WEBHOOK_SECRET" apps/web/README.md` returns at least 2 (env table + UAT runbook)
    - `grep -c "STRIPE_PRICE_ID" apps/web/README.md` returns at least 1
    - `grep -c "4242 4242 4242 4242" apps/web/README.md` returns at least 1 (test card in UAT)
    - `grep -c "stripe trigger checkout.session.completed" apps/web/README.md` returns at least 1
    - `grep -c "stripe events resend" apps/web/README.md` returns at least 1
    - `grep -c "replay ignored" apps/web/README.md` returns at least 1
    - `grep -c "runtime = 'nodejs'" apps/web/README.md` returns at least 1
    - `grep -c "await req.text" apps/web/README.md` returns at least 1
    - `grep -c "CMR-01\\|CMR-02\\|CMR-03\\|CMR-04\\|CMR-05\\|CMR-06\\|CMR-07\\|CMR-08\\|CMR-09\\|CMR-10" apps/web/README.md` returns at least 10 (every CMR-* mentioned at least once)
    - Existing Phase 7 section still present: `grep -c "^## Phase 7 — Game Rendering$" apps/web/README.md` returns exactly 1
    - Existing Phase 1-6 documentation preserved: `git diff apps/web/README.md` shows only additions, no deletions
    - No emojis in the new section
    - No exclamation marks in the Phase 8 body prose (`grep -A1 "Phase 8 — Stripe" apps/web/README.md | grep -c "!"` returns 0 — code blocks with literal `!` are not body prose)
  </acceptance_criteria>
  <done>Phase 8 README section appended; voice and content satisfy contract; existing sections untouched.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Andrew runs the manual UAT runbook (CMR-01, CMR-02, CMR-04, CMR-05, CMR-06, CMR-07, CMR-08, CMR-09, CMR-10)</name>
  <read_first>
    - apps/web/README.md (the "Andrew's manual UAT runbook" section added in Task 1)
    - .planning/phases/08-stripe-commerce/08-VALIDATION.md (Manual-Only Verifications table)
    - apps/web/.env.local (verify the four Stripe env vars from Plan 08-02 are still present and test-mode prefixed)
  </read_first>
  <files>(none — read-only smoke against running infrastructure; results captured in Task 3 SUMMARY)</files>
  <action>
    Execute the 5-part UAT documented in apps/web/README.md "Andrew's manual UAT runbook" section. The executor pauses at this checkpoint; Andrew runs the steps manually against either local dev (with Stripe CLI) or a Vercel preview deployment.
  </action>
  <acceptance_criteria>
    - Part A (test purchase, CMR-01/CMR-02/CMR-10): /shop renders charity callout server-side, BuyButton redirects to Stripe Checkout, test card 4242 completes purchase, /shop/thank-you renders with no order details
    - Part B (forged signature, CMR-04/CMR-05): curl with bogus stripe-signature returns 400; missing signature also returns 400; no Convex rows written
    - Part C (replay, CMR-06): `stripe trigger checkout.session.completed` then `stripe events resend <eventId>` — second invocation logs "replay ignored"; Convex stripeEvents row count for that eventId remains 1
    - Part D (legal pages, CMR-07/CMR-08): /legal/privacy and /legal/terms both return 200 with placeholder copy mentioning Stripe
    - Part E (shop callout, CMR-09): published issue still shows one-sentence + button at bottom (no banner/modal/popup/countdown); button links to /shop
    - Andrew types "approved" (or "issues: ...") at the resume-signal
  </acceptance_criteria>
  <verify>
    <automated>MISSING — manual UAT; the verify is the human resume signal; outcomes captured in 08-08 SUMMARY (Task 3)</automated>
  </verify>
  <done>Andrew confirms all 5 UAT parts pass; SUMMARY captures the observations.</done>
  <what-built>
    Phase 8 ships:
    - `apps/web/app/shop/page.tsx` — Server-rendered shop with BuyButton (Plan 08-06)
    - `apps/web/components/marketing/BuyButton.tsx` — Client-side checkout trigger (Plan 08-04)
    - `apps/web/app/api/checkout/create-session/route.ts` — POST creates Stripe session (Plan 08-04)
    - `apps/web/app/api/stripe/webhook/route.ts` — Signature-verified webhook (Plan 08-05)
    - `apps/web/lib/stripe/{server,constants,handlers}.ts` — Stripe SDK + helpers (Plans 08-04, 08-05)
    - `apps/web/app/shop/thank-you/page.tsx` — Decorative landing, no DB query (Plan 08-07)
    - `apps/web/app/legal/{privacy,terms}/page.tsx` — Placeholder pages (Plan 08-07)
    - `convex/stripe{Events,Orders}.ts` — Idempotency + audit (Plan 08-03)
    - 8 Vitest test files covering CMR-01..CMR-10 (Plan 08-01)
    - Source-scan tripwire at __tests__/stripe-webhook-source.test.ts (CMR-05 guard)
  </what-built>
  <how-to-verify>
    Run the runbook in `apps/web/README.md` -> "Andrew's manual UAT runbook" section. The runbook has 5 parts (A-E) covering:

    - **Part A (5-10 min):** Open /shop, click Buy, complete checkout with 4242 test card, land on /shop/thank-you.
    - **Part B (2 min):** curl with bogus signature returns 4xx; check no Convex rows.
    - **Part C (5 min):** Stripe CLI `stripe trigger` + `stripe events resend`; check Convex row count.
    - **Part D (1 min):** Open /legal/privacy and /legal/terms; confirm 200.
    - **Part E (1 min):** Open any published issue; confirm ShopCallout at bottom, button links to /shop.

    Capture each result as PASS / FAIL with a one-line note. Document any deviations.

    If UAT runs against deployed Vercel: confirm Stripe env vars are set in Vercel project settings before testing (otherwise the deployed app cannot talk to Stripe).
  </how-to-verify>
  <resume-signal>Type "approved" if all 5 UAT parts pass. Type "issues: <description>" if any step failed (which will trigger `/gsd:plan-phase 8 --gaps`).</resume-signal>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Capture UAT results + Phase 8 closure checklist in the Plan 08-08 SUMMARY</name>
  <read_first>
    - .planning/phases/07-game-rendering/07-05-readme-and-smoke-test-SUMMARY.md (if exists — formatting precedent)
    - .planning/phases/08-stripe-commerce/08-VALIDATION.md
  </read_first>
  <files>.planning/phases/08-stripe-commerce/08-08-readme-and-smoke-test-SUMMARY.md</files>
  <action>
    Create `.planning/phases/08-stripe-commerce/08-08-readme-and-smoke-test-SUMMARY.md` after the UAT checkpoint resumes with "approved". Document:

    1. **README addition:** Line range or section title where Phase 8 section was added; word count or line count of the new section.

    2. **UAT environment:** Local dev with Stripe CLI? Vercel preview deployment? Both? Note the URL where applicable.

    3. **Part A — Test purchase (CMR-01/CMR-02/CMR-10):**
       - PASS / FAIL
       - Charity name shown in server-rendered HTML: which charity?
       - BuyButton -> Stripe Checkout redirect succeeded? URL pattern confirmed?
       - Test card 4242 purchase completed? Amount charged?
       - Shipping address form appeared? Shipping rate selected?
       - Landed on /shop/thank-you with session_id query param?
       - Thank-you page showed NO order details? (CMR-03 confirmed by absence)

    4. **Part B — Forged signature (CMR-04/CMR-05):**
       - PASS / FAIL
       - HTTP status returned to forged curl?
       - HTTP status returned to missing-signature curl?
       - Convex stripeEvents rows confirmed unchanged?

    5. **Part C — Idempotent replay (CMR-06):**
       - PASS / FAIL
       - Initial event id processed (paste evt_xxx)
       - Second invocation logged "replay ignored"?
       - Convex stripeEvents row count for that eventId? (target: 1)
       - Convex stripeOrders row count? (target: 1 if STRIPE_RECORD_ORDERS=true)

    6. **Part D — Legal pages (CMR-07/CMR-08):**
       - /legal/privacy: 200 returned? Placeholder copy mentions Stripe?
       - /legal/terms: 200 returned? Placeholder copy mentions Stripe + refund?

    7. **Part E — Shop callout (CMR-09):**
       - PASS / FAIL
       - Which published issue tested?
       - ShopCallout rendered with one-sentence + button?
       - Button link target: /shop (NOT direct Stripe Checkout)?
       - Confirm no banner/modal/popup/countdown visible?

    8. **Test suite status:** Output of final `pnpm --filter web test:unit` showing all Phase 8 tests passing.

    9. **Phase 8 closure checklist:**
       - [ ] CMR-01 — /shop server-rendered with charity callout (Part A confirmed)
       - [ ] CMR-02 — Stripe Checkout session via custom integration (Part A confirmed)
       - [ ] CMR-03 — /shop/thank-you static, no DB query (Part A confirmed visually; Plan 08-01 source-scan test confirms statically)
       - [ ] CMR-04 — Webhook verifies signature using raw body (Part B + Plan 08-05 unit tests)
       - [ ] CMR-05 — No dev-mode bypass on signature verification (Part B + Plan 08-01 source-scan tripwire)
       - [ ] CMR-06 — Idempotent on event.id via Convex (Part C + Plan 08-05 unit test)
       - [ ] CMR-07 — /legal/privacy exists with placeholder (Part D + STATE.md blocker for content)
       - [ ] CMR-08 — /legal/terms exists with placeholder (Part D + STATE.md blocker for content)
       - [ ] CMR-09 — Persistent ShopCallout on every issue page (Part E + Phase 2 inheritance)
       - [ ] CMR-10 — Stripe shipping rates configured (Plan 08-02 Dashboard setup + Part A confirmed by shipping form)

    10. **Open issues or follow-ups:**
        - Legal copy: blocker open in STATE.md (Plan 08-07 added it)
        - automatic_tax: still OFF (Plan 08-04 default); flip when Andrew configures Stripe Tax
        - allowed_countries: ['US'] only; expand when Andrew expands shipping rates
        - Live mode: this UAT uses test mode only; live-mode rollout is a launch-day task
        - Cost tracking metadata fix (Phase 5 / Phase 6 carryover) is unrelated to Phase 8 but still open

    11. **Reminder:** Phase 8 is COMPLETE when all 10 CMR-* are checked. If any UAT part failed, open a gap-closure plan via `/gsd:plan-phase 8 --gaps` — DO NOT mark the phase complete.

    The SUMMARY follows the format of prior `*-SUMMARY.md` files in the .planning/phases/ tree.
  </action>
  <verify>
    <automated>test -f .planning/phases/08-stripe-commerce/08-08-readme-and-smoke-test-SUMMARY.md && grep -c "CMR-0\\|CMR-10" .planning/phases/08-stripe-commerce/08-08-readme-and-smoke-test-SUMMARY.md</automated>
  </verify>
  <acceptance_criteria>
    - File `.planning/phases/08-stripe-commerce/08-08-readme-and-smoke-test-SUMMARY.md` exists
    - File contains references to all 10 CMR-* requirements (CMR-01 through CMR-10)
    - File documents the UAT environment (local + Stripe CLI? Vercel preview?)
    - File records each Part A-E with PASS/FAIL
    - File contains a Phase 8 closure checklist with all 10 CMR-* items
    - File documents the legal-copy and automatic_tax follow-ups
    - File references the STATE.md blocker for legal copy (Plan 08-07 added it)
  </acceptance_criteria>
  <done>SUMMARY captures README change + UAT observations + Phase 8 closure checklist; Phase 8 ready to close (or follow-up plan flagged if UAT failed).</done>
</task>

</tasks>

<verification>
- `apps/web/README.md` has a Phase 8 section documenting architecture, security contract, idempotency model, env vars, and Andrew's UAT runbook
- Andrew's manual UAT confirms (or flags) the 10 CMR-* requirements against real Stripe + Convex + Vercel infrastructure
- The Plan 08-08 SUMMARY captures all 5 UAT parts + the Phase 8 closure checklist
</verification>

<success_criteria>
- README documents the locked webhook security contract so future engineers don't accidentally weaken signature verification or introduce a bypass
- README documents the idempotency model so future contributors understand why `firstTime` is the load-bearing return
- Andrew's UAT covers the four code-path-only-detectable behaviors (real Stripe redirect, forged signature rejection, Stripe CLI replay, shipping form appearance)
- Phase 8 closure criteria are checkable: 10 CMR-* requirements + 5 UAT parts mapped
- Any UAT failure triggers `/gsd:plan-phase 8 --gaps` (clearly documented in the SUMMARY contract)
</success_criteria>

<output>
After completion, the file `.planning/phases/08-stripe-commerce/08-08-readme-and-smoke-test-SUMMARY.md` contains the UAT observations + Phase 8 closure checklist. Phase 8 is ready for `/gsd:verify-work` to close it (all CMR-* requirements satisfied).
</output>
</content>
