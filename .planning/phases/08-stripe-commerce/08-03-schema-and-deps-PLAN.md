---
phase: 08-stripe-commerce
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - convex/schema.ts
  - convex/stripeEvents.ts
  - convex/stripeOrders.ts
  - apps/web/.env.example
  - apps/web/package.json
  - pnpm-lock.yaml
autonomous: true
requirements:
  - CMR-02
  - CMR-04
  - CMR-06
  - CMR-10
must_haves:
  truths:
    - "convex/schema.ts has a new `stripeEvents` table with field `eventId: v.string()` and an index `by_eventId` on [eventId]"
    - "convex/schema.ts has a new `stripeOrders` table with optional fields recording session, amount, customer email, and charity slug"
    - "convex/stripeEvents.ts exports a `claim` mutation that performs an atomic check-and-insert and returns `{ firstTime: boolean }`"
    - "convex/stripeOrders.ts exports an `insert` mutation accepting sessionId, eventId, amountTotal, currency, optional customerEmail, optional charitySlug"
    - "Both new tables redeploy cleanly: `pnpm --filter @eisenbalm/convex exec convex dev --once` exits 0 and regenerates convex/_generated/api.d.ts"
    - "apps/web/.env.example documents STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, STRIPE_RECORD_ORDERS, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (reserved)"
    - "apps/web/package.json has a `stripe` dependency pinned to a recorded major version; pnpm-lock.yaml is updated"
    - "npm-resolved stripe version is recorded in the SUMMARY"
  artifacts:
    - path: "convex/schema.ts"
      provides: "stripeEvents + stripeOrders table definitions with by_eventId / by_sessionId indices"
      contains: "stripeEvents"
    - path: "convex/stripeEvents.ts"
      provides: "Atomic claim(eventId, eventType, livemode) -> {firstTime}"
      exports: ["claim"]
    - path: "convex/stripeOrders.ts"
      provides: "insert({sessionId, eventId, amountTotal, currency, customerEmail?, charitySlug?})"
      exports: ["insert"]
    - path: "apps/web/.env.example"
      provides: "Documented Stripe env var template"
      contains: "STRIPE_SECRET_KEY="
    - path: "apps/web/package.json"
      provides: "stripe SDK pinned dependency"
      contains: "\"stripe\":"
  key_links:
    - from: "convex/stripeEvents.ts claim mutation"
      to: "apps/web/app/api/stripe/webhook/route.ts (Plan 08-05)"
      via: "Webhook handler calls api.stripeEvents.claim atomically to dedup event.id"
      pattern: "stripeEvents\\.claim"
    - from: "convex/schema.ts stripeEvents.by_eventId index"
      to: "convex/stripeEvents.ts claim mutation"
      via: "claim queries by index, then inserts atomically"
      pattern: "withIndex\\('by_eventId'"
---

<objective>
Land the data + dependency substrate that Plans 08-04 (checkout session API) and 08-05 (webhook + idempotency) build on. Three concrete deliverables:

1. **Convex schema patch** — add `stripeEvents` (idempotency dedup) and `stripeOrders` (audit) tables.
2. **Convex mutations** — `stripeEvents.claim` (atomic check-and-insert returning `firstTime`) and `stripeOrders.insert`.
3. **Stripe SDK + env docs** — install `stripe` (pinned major) and document the four new env vars in `apps/web/.env.example`.

Purpose: Honors RESEARCH §Pattern 5 (Convex idempotency table with atomic claim mutation), §Pattern 6 (Stripe SDK pinned major + `apiVersion` lock), §Open Question 2 (`stripeOrders` ships behind `STRIPE_RECORD_ORDERS=true` — default on, but the orders insert is best-effort: webhook never 5xx's because audit failed).

Output: Convex `api.stripeEvents.claim` and `api.stripeOrders.insert` exist after codegen; `stripe` npm package importable from `apps/web`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/08-stripe-commerce/08-RESEARCH.md
@convex/schema.ts
@convex/CLAUDE.md
@convex/pipelineRuns.ts
@apps/web/.env.example
@apps/web/package.json

<interfaces>
<!-- Existing Convex query/mutation pattern (convex/pipelineRuns.ts) — follow verbatim:
       import { query, mutation } from './_generated/server'
       import { v } from 'convex/values'

       export const X = mutation({
         args: { ... v.string() ... },
         handler: async (ctx, args) => { ... ctx.db.query(table).withIndex(...).first() ... ctx.db.insert(table, {...}) ... }
       })

     Schema field additions follow Phase 3/4 patterns (convex/schema.ts already has
     pipelineRuns, deliberationEvents, agentVotes, qaCorrections, pitchLog — DO NOT
     remove or alter any of these). Stripe tables are ADDITIVE.

     env var conventions established in Phase 1-7:
       - Public values: NEXT_PUBLIC_*
       - Secrets: bare names (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)
       - Values that may contain shell-special chars: quote with single quotes in .env.example
         (see CONVEX_DEPLOY_KEY note in apps/web/.env.example) -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Patch convex/schema.ts to add stripeEvents + stripeOrders tables; create the two mutation files</name>
  <read_first>
    - convex/schema.ts (current state — must not lose any of the 5 existing tables or their indices)
    - convex/CLAUDE.md (project Convex guidance)
    - convex/pipelineRuns.ts (canonical mutation pattern — see updateStatus for the throw-if-not-found pattern; see create for the timestamp + insert pattern)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Pattern 5 (the exact stripeEvents.claim shape with `firstTime` return)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Architecture Patterns §schema patch listing stripeEvents + stripeOrders fields verbatim
  </read_first>
  <files>convex/schema.ts, convex/stripeEvents.ts, convex/stripeOrders.ts</files>
  <action>
    **Step 1: Patch `convex/schema.ts`** — append two new tables ADDITIVELY (do not remove or alter any existing table). The patch:

    ```typescript
    // Inside the defineSchema({ ... }) object, after qaCorrections and pitchLog,
    // add these two new tables:

    // ── Stripe events: idempotency dedup table (Phase 8 — CMR-06) ────────────
    // One row per unique Stripe event.id we have processed. The unique
    // by_eventId index + Convex per-table mutation serialization gives us
    // atomic check-and-insert via the `claim` mutation (see convex/stripeEvents.ts).
    stripeEvents: defineTable({
      eventId: v.string(),       // Stripe evt_... — unique per event delivery
      eventType: v.string(),     // e.g. 'checkout.session.completed'
      livemode: v.boolean(),     // matches event.livemode from Stripe
      receivedAt: v.number(),    // Date.now() server-side
    })
      .index('by_eventId', ['eventId']),

    // ── Stripe orders: minimal audit trail (Phase 8 — Open Question 2) ───────
    // Behind STRIPE_RECORD_ORDERS env flag (default 'true'). One row per
    // checkout.session.completed event we processed. Stripe Dashboard remains
    // source of truth for orders; this exists so we can answer
    // "how much went to charity X this week" without paginating Stripe API.
    stripeOrders: defineTable({
      sessionId: v.string(),     // cs_test_... or cs_live_...
      eventId: v.string(),       // evt_... that fulfilled this order
      amountTotal: v.number(),   // cents (Stripe convention)
      currency: v.string(),      // 'usd', 'eur', etc.
      customerEmail: v.optional(v.string()),
      charitySlug: v.optional(v.string()),  // current charity at click time
      createdAt: v.number(),     // Date.now() server-side
    })
      .index('by_sessionId', ['sessionId'])
      .index('by_charitySlug_createdAt', ['charitySlug', 'createdAt']),
    ```

    Insert BEFORE the closing `})` of `defineSchema`. After: 7 total tables (5 original + 2 new). Do NOT touch any existing field, validator, or index.

    **Step 2: Create `convex/stripeEvents.ts`** with the atomic claim mutation:

    ```typescript
    /**
     * Phase 8 — CMR-06 idempotency table mutations.
     *
     * Convex serializes mutations per-table, so the check (withIndex.first)
     * + insert below is atomic: two concurrent webhook retries cannot both
     * see "no existing row" and both insert. The first wins; the second
     * receives { firstTime: false } and the caller (webhook handler) skips
     * fulfillment.
     *
     * Contract:
     *   claim({ eventId, eventType, livemode }) -> { firstTime: boolean }
     *     - firstTime: true  -> caller should process the event
     *     - firstTime: false -> caller should treat as replay and skip
     */
    import { mutation } from './_generated/server'
    import { v } from 'convex/values'

    export const claim = mutation({
      args: {
        eventId: v.string(),
        eventType: v.string(),
        livemode: v.boolean(),
      },
      handler: async (ctx, args) => {
        const existing = await ctx.db
          .query('stripeEvents')
          .withIndex('by_eventId', (q) => q.eq('eventId', args.eventId))
          .first()
        if (existing) {
          return { firstTime: false as const }
        }
        await ctx.db.insert('stripeEvents', {
          eventId: args.eventId,
          eventType: args.eventType,
          livemode: args.livemode,
          receivedAt: Date.now(),
        })
        return { firstTime: true as const }
      },
    })
    ```

    **Step 3: Create `convex/stripeOrders.ts`** with the insert mutation:

    ```typescript
    /**
     * Phase 8 — Open Question 2: minimal order audit table.
     *
     * Behind STRIPE_RECORD_ORDERS env flag in the webhook handler
     * (Plan 08-05). This mutation is unconditional from Convex's
     * perspective — the gating happens in the webhook handler.
     *
     * Best-effort writes: the webhook handler wraps this call in
     * try/catch and returns 200 to Stripe even if this fails, because
     * stripeEvents.claim has already succeeded and we do not want
     * Stripe to retry the event (which would also dedup at claim).
     */
    import { mutation } from './_generated/server'
    import { v } from 'convex/values'

    export const insert = mutation({
      args: {
        sessionId: v.string(),
        eventId: v.string(),
        amountTotal: v.number(),
        currency: v.string(),
        customerEmail: v.optional(v.string()),
        charitySlug: v.optional(v.string()),
      },
      handler: async (ctx, args) => {
        await ctx.db.insert('stripeOrders', {
          sessionId: args.sessionId,
          eventId: args.eventId,
          amountTotal: args.amountTotal,
          currency: args.currency,
          customerEmail: args.customerEmail,
          charitySlug: args.charitySlug,
          createdAt: Date.now(),
        })
        return null
      },
    })
    ```

    **Step 4: Regenerate `convex/_generated/`** by running:
    ```bash
    pnpm --filter @eisenbalm/convex exec convex dev --once
    ```

    This pushes the schema patch to the dev deployment AND regenerates `convex/_generated/api.d.ts` so the new `api.stripeEvents.claim` and `api.stripeOrders.insert` symbols are typed. If the command requires interactive confirmation (e.g. "Add stripeEvents table?"), accept the additive change.

    **Do NOT touch existing tables or mutations.** The patch is purely additive.

    **Code style notes:**
    - Use `as const` on the firstTime boolean so the return type is `{ firstTime: true } | { firstTime: false }` (helps caller type narrowing).
    - `Date.now()` server-side per established D-12 pattern (`convex/pipelineRuns.ts` `create` mutation does this).
    - Argument validators match RESEARCH §Pattern 5 exactly: `eventId: v.string()`, `eventType: v.string()`, `livemode: v.boolean()`.
  </action>
  <verify>
    <automated>grep -c "stripeEvents: defineTable" convex/schema.ts && grep -c "stripeOrders: defineTable" convex/schema.ts && grep -c "by_eventId" convex/schema.ts && grep -c "by_sessionId" convex/schema.ts && test -f convex/stripeEvents.ts && test -f convex/stripeOrders.ts && grep -q "export const claim" convex/stripeEvents.ts && grep -q "export const insert" convex/stripeOrders.ts && grep -q "firstTime" convex/stripeEvents.ts && pnpm --filter @eisenbalm/convex exec convex dev --once 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "stripeEvents: defineTable" convex/schema.ts` returns exactly 1
    - `grep -c "stripeOrders: defineTable" convex/schema.ts` returns exactly 1
    - `grep -c "'by_eventId'" convex/schema.ts` returns exactly 1
    - `grep -c "'by_sessionId'" convex/schema.ts` returns exactly 1
    - `grep -c "'by_charitySlug_createdAt'" convex/schema.ts` returns exactly 1
    - `grep -c "pipelineRuns: defineTable" convex/schema.ts` returns exactly 1 (existing table preserved)
    - `grep -c "deliberationEvents: defineTable" convex/schema.ts` returns exactly 1 (existing preserved)
    - `grep -c "qaCorrections: defineTable" convex/schema.ts` returns exactly 1 (existing preserved)
    - `test -f convex/stripeEvents.ts` exits 0
    - `test -f convex/stripeOrders.ts` exits 0
    - `grep -q "export const claim = mutation" convex/stripeEvents.ts` exits 0
    - `grep -q "export const insert = mutation" convex/stripeOrders.ts` exits 0
    - `grep -q "firstTime: true as const" convex/stripeEvents.ts` exits 0
    - `grep -q "firstTime: false as const" convex/stripeEvents.ts` exits 0
    - `grep -q "withIndex('by_eventId'" convex/stripeEvents.ts` exits 0
    - `grep -q "Date.now()" convex/stripeEvents.ts` exits 0 (server-side timestamp)
    - `grep -q "Date.now()" convex/stripeOrders.ts` exits 0
    - `pnpm --filter @eisenbalm/convex exec convex dev --once` exits 0 with the schema accepted by Convex
    - `convex/_generated/api.d.ts` contains references to `stripeEvents` and `stripeOrders` (`grep -q "stripeEvents" convex/_generated/api.d.ts` exits 0)
  </acceptance_criteria>
  <done>Schema patch + two mutation files land; Convex dev deployment accepts the schema; codegen produces typed `api.stripeEvents.claim` and `api.stripeOrders.insert`.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Install Stripe SDK (pinned major) and document Stripe env vars in apps/web/.env.example</name>
  <read_first>
    - apps/web/package.json (existing dependencies — note convex@^1.38.0, next@^15.3.9 already pinned)
    - apps/web/.env.example (existing env var documentation conventions; CONVEX_DEPLOY_KEY single-quote rule)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Standard Stack §Core (pin `stripe: "^18.0.0"` or `^19.0.0` after verifying latest)
    - .planning/phases/08-stripe-commerce/08-RESEARCH.md §Common Pitfalls §Pitfall 6 (apiVersion drift)
  </read_first>
  <files>apps/web/package.json, pnpm-lock.yaml, apps/web/.env.example</files>
  <action>
    **Step 1: Verify the current Stripe SDK version and decide the pin**

    Run:
    ```bash
    npm view stripe version
    npm view stripe time --json | python3 -c "import sys, json; t=json.load(sys.stdin); latest=max(((k, v) for k, v in t.items() if k not in ('created','modified') and 'beta' not in k and '-' not in k), key=lambda x: x[1]); print(latest)"
    ```

    Record both outputs in the SUMMARY for traceability.

    Choose the pin per RESEARCH §Standard Stack:
    - If the most-recently-published major has been stable for ≥ 30 days (publish time ≥ 30 days ago), pin that major.
    - Otherwise, pin the previous major. E.g., if latest is `22.x` shipped 5 days ago, pin `^21.0.0`. If latest is `22.x` shipped 60 days ago, pin `^22.0.0`.
    - Record the chosen pin and the rationale in the SUMMARY.

    **Step 2: Install Stripe via pnpm**

    From the repo root:
    ```bash
    pnpm --filter web add stripe@<chosen-major-range>
    # e.g., pnpm --filter web add stripe@^18.0.0
    ```

    pnpm will update `apps/web/package.json` and `pnpm-lock.yaml`. Do NOT install `@stripe/stripe-js` (the client SDK) — hosted Checkout flow uses `window.location.href = session.url` without it (RESEARCH §Standard Stack §Supporting).

    **Step 3: Document env vars in `apps/web/.env.example`**

    Append a new section at the end of `apps/web/.env.example` (do not remove or alter existing entries):

    ```bash
    # ── Stripe (Phase 8 — Plans 08-02..08-08) ───────────────────────────────────
    # Server-side Stripe API key. Test mode = sk_test_..., live mode = sk_live_...
    # Get from https://dashboard.stripe.com/{test/}apikeys
    # SECRET. Never commit. Never expose via NEXT_PUBLIC_*.
    # Configured per Plan 08-02 (Andrew sets up the Dashboard).
    STRIPE_SECRET_KEY=

    # Stripe Webhook signing secret. Whsec_...
    # If using Stripe CLI locally: copy from `stripe listen --forward-to localhost:3000/api/stripe/webhook` output.
    # If using Dashboard endpoint: https://dashboard.stripe.com/{test/}webhooks -> endpoint -> Signing secret.
    # SECRET. Never commit.
    STRIPE_WEBHOOK_SECRET=

    # The Stripe Price object id for the Jesse A. Eisenbalm lip balm SKU.
    # Format: price_test_... (test mode) or price_... (live mode).
    # Created in Stripe Dashboard per Plan 08-02. Public-ish (price ID alone
    # cannot create charges) but pin it as a server-side env var so the
    # checkout-session API has a single locked SKU.
    STRIPE_PRICE_ID=

    # Feature flag: write order rows to Convex stripeOrders table on
    # successful checkout (RESEARCH Open Question 2). Default 'true'.
    # Set to 'false' to skip order persistence; webhook still dedups via
    # stripeEvents.claim and Stripe Dashboard remains source of truth.
    STRIPE_RECORD_ORDERS=true

    # Stripe Publishable Key (pk_test_..., pk_live_...) — RESERVED.
    # NOT REQUIRED for v1's hosted Checkout flow (we redirect via session.url,
    # not Stripe Elements). Documented here so future Elements integration
    # (V2) does not need to invent a new env var name. Leave blank in v1.
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
    ```

    **Code style notes:**
    - Header `# ── Stripe (...) ──` matches the existing `# ── Phase 4 additions ──` style used in convex/schema.ts.
    - Match the documentation density of the existing `CONVEX_DEPLOY_KEY` entry — each var gets a "what / where to get / security posture" paragraph.
    - Do NOT include actual secret values. `STRIPE_*=` (empty) is correct for `.env.example`.
    - `STRIPE_RECORD_ORDERS=true` (the default) DOES get a value because it is a feature flag, not a secret.
  </action>
  <verify>
    <automated>npm view stripe version && grep -q '"stripe":' apps/web/package.json && grep -q "STRIPE_SECRET_KEY=" apps/web/.env.example && grep -q "STRIPE_WEBHOOK_SECRET=" apps/web/.env.example && grep -q "STRIPE_PRICE_ID=" apps/web/.env.example && grep -q "STRIPE_RECORD_ORDERS=true" apps/web/.env.example && grep -q "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=" apps/web/.env.example && cd apps/web && node -e "require('stripe')" 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `npm view stripe version` returns a version string (network reachable; recorded in SUMMARY)
    - `apps/web/package.json` has a `"stripe":` entry under dependencies with a major-pinned range (e.g. `"^18.0.0"`, `"^19.0.0"`, `"^21.0.0"`)
    - `@stripe/stripe-js` is NOT installed (`grep -q "stripe-js" apps/web/package.json` exits 1) — hosted flow doesn't need it
    - `pnpm-lock.yaml` has been updated (verify with `git diff --stat pnpm-lock.yaml` showing changes)
    - `cd apps/web && node -e "require('stripe')"` exits 0 (the SDK loads)
    - `grep -q "^STRIPE_SECRET_KEY=" apps/web/.env.example` exits 0
    - `grep -q "^STRIPE_WEBHOOK_SECRET=" apps/web/.env.example` exits 0
    - `grep -q "^STRIPE_PRICE_ID=" apps/web/.env.example` exits 0
    - `grep -q "^STRIPE_RECORD_ORDERS=true" apps/web/.env.example` exits 0
    - `grep -q "^NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=" apps/web/.env.example` exits 0
    - `grep -c "RESERVED" apps/web/.env.example` returns at least 1 (publishable key documented as reserved)
    - The chosen stripe pin (e.g. `^18.0.0`) is recorded in `.planning/phases/08-stripe-commerce/08-03-schema-and-deps-SUMMARY.md`
  </acceptance_criteria>
  <done>Stripe SDK installed and pinned; env var template documents all 5 Stripe-related variables with security posture; lockfile updated.</done>
</task>

</tasks>

<verification>
After both tasks complete:
- Convex dev deployment shows 7 tables (5 existing + 2 new); `convex/_generated/api.d.ts` references both new tables
- `pnpm --filter web typecheck` exits 0 (no broken types from schema patch)
- `cd apps/web && node -e "console.log(require('stripe').VERSION || 'loaded')"` prints a string (SDK loads)
- `pnpm --filter web test:unit` still runs (Wave 0 stubs from 08-01 still load; idempotency + checkout-create-session tests can now resolve `stripe` SDK on dynamic import, so they progress to "target route handler not found" failure rather than "stripe package not found")
</verification>

<success_criteria>
- New Convex tables and mutations exist, are typed, and deploy cleanly
- Stripe SDK is installed and importable from `apps/web`
- Env var template documents the full Stripe surface with security posture (matches Phase 3 CONVEX_DEPLOY_KEY pattern)
- No schema regressions: existing 5 Convex tables and their mutations are untouched
- The pin choice is recorded for future audit (RESEARCH Pitfall 6 prevention)
</success_criteria>

<output>
After completion, create `.planning/phases/08-stripe-commerce/08-03-schema-and-deps-SUMMARY.md` recording:
- Resolved Stripe SDK version installed (e.g. `stripe@18.4.0` or whatever pnpm resolved)
- The pin range chosen (e.g. `^18.0.0`) and the rationale (latest-30d or one-back)
- Convex deploy result (deployment name + URL)
- The two new Convex tables and their indices
- The four new env vars added to `apps/web/.env.example`
- Any deviations from RESEARCH §Pattern 5 (none expected)
- Note: Plan 08-05 will set the Stripe `apiVersion` pin in `apps/web/lib/stripe/server.ts` — record the apiVersion string here for cross-reference (research recommends `'2025-04-30.basil'`; actual choice depends on the resolved SDK major)
</output>
</content>
