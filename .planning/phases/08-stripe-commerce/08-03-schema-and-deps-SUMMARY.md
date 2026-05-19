---
phase: 08-stripe-commerce
plan: 03
subsystem: schema-and-dependencies
tags: [convex, stripe, schema, idempotency, env-vars, sdk]

# Dependency graph
requires:
  - phase: 03-convex-deployment
    provides: Convex deployment modest-magpie-797 (dev), @eisenbalm/convex workspace, pipelineRuns + deliberationEvents + agentVotes + qaCorrections + pitchLog tables, convex/_generated tracked in git
  - phase: 02-web-shell-theme-engine
    provides: apps/web/.env.example documentation conventions (single-quote rule for shell-special chars)
provides:
  - convex/schema.ts patched with stripeEvents + stripeOrders tables (additive, 7 tables total)
  - convex/stripeEvents.ts exporting atomic claim() mutation -> { firstTime: true | false } as const
  - convex/stripeOrders.ts exporting insert() audit mutation with server-side createdAt
  - convex/_generated/api.d.ts re-emitted with api.stripeEvents and api.stripeOrders symbols (typed for downstream consumers)
  - apps/web/package.json pinned to stripe@^21.0.0 (resolved stripe@21.0.1) with documented major-version pin rationale
  - apps/web/.env.example documenting STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID, STRIPE_RECORD_ORDERS, NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (RESERVED)
affects: [08-04-stripe-client-and-checkout-api, 08-05-webhook-handler-and-idempotency, 08-06-shop-page-rewrite, 08-07-thank-you-and-legal-pages]

# Tech tracking
tech-stack:
  added:
    - "stripe@^21.0.0 (resolved 21.0.1) — Stripe Node SDK for server-side Checkout session creation + webhook signature verification"
  patterns:
    - "Atomic check-and-insert via Convex per-table mutation serialization (CMR-06 idempotency)"
    - "Literal-union return type ({ firstTime: true } | { firstTime: false }) via `as const` for caller narrowing"
    - "Server-side timestamp injection (Date.now()) per Phase 3 D-12 convention"
    - "Major-version pin with stable-30-day check (RESEARCH §Standard Stack) — pin previous major when latest is fresh"
    - "Reserved env var slot (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=) documented but unused in v1 hosted Checkout flow"

key-files:
  created:
    - convex/stripeEvents.ts
    - convex/stripeOrders.ts
  modified:
    - convex/schema.ts
    - convex/_generated/api.d.ts
    - apps/web/package.json
    - apps/web/.env.example
    - pnpm-lock.yaml

decisions:
  - "Stripe SDK pin: ^21.0.0 (resolved 21.0.1). Latest stable is 22.1.1 (published 2026-05-06, 13 days ago) which is below the 30-day stability threshold per RESEARCH §Standard Stack. Previous major 21.x first published 2026-03-26 (54 days stable). Choosing 21.x avoids an unreviewed apiVersion bump in v1; plan 08-05 will pin apiVersion explicitly in lib/stripe/server.ts."
  - "Convex tables created on dev deployment modest-magpie-797 (consistent with Phase 3 D-04 + Phase 4 Plan 04-03 decision to use dev as the canonical consumer-facing deployment, not prod)"
  - "@stripe/stripe-js intentionally NOT installed — hosted Checkout flow does `window.location.href = session.url` without Elements (RESEARCH §Standard Stack §Supporting)"
  - "stripeOrders is shipped behind STRIPE_RECORD_ORDERS env flag, default `true` per RESEARCH Open Question 2 — best-effort writes; webhook returns 200 to Stripe even if Convex audit insert fails (Pitfall 7 prevention)"
  - "Literal-union return on claim mutation (`{ firstTime: true as const }` / `{ firstTime: false as const }`) so callers can narrow in TypeScript without a runtime if-else type guard (matches Convex idiomatic discriminated-union pattern)"

metrics:
  duration: ~6 min
  completed: 2026-05-19
  tasks: 2
  files: 7 (2 created, 5 modified)

# Stripe pin rationale (auditability)
stripe:
  resolved_version: "21.0.1"
  pin_range: "^21.0.0"
  latest_published: "22.1.1 (2026-05-06)"
  pin_choice_reason: "Latest major (22.x) is 13 days old as of 2026-05-19, below RESEARCH 30-day stability threshold. Previous major 21.x (first published 2026-03-26, 54 days stable) is the safe pin until 22.x crosses 30d and the apiVersion bump can be reviewed."
  apiVersion_pin_deferred_to: "Plan 08-05 (apps/web/lib/stripe/server.ts) — research recommends '2025-04-30.basil'; actual choice depends on stripe@21.x default which Plan 08-05 will inspect via `new Stripe(...).getApiField('version')`"
---

# Phase 8 Plan 03: Schema and Dependencies Summary

Landed the data + SDK substrate for the rest of Phase 8: two new Convex tables (`stripeEvents` for CMR-06 idempotency and `stripeOrders` for the audit trail), their atomic mutation files, the Stripe Node SDK pinned to a major-stable version, and full env var documentation in `apps/web/.env.example`.

## What Shipped

### Convex schema patch (additive)

`convex/schema.ts` now defines 7 tables — the 5 existing pipeline tables (`pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`) are untouched, and the two new Stripe tables append at the bottom:

```typescript
stripeEvents: defineTable({
  eventId: v.string(),       // Stripe evt_... — unique per event delivery
  eventType: v.string(),
  livemode: v.boolean(),
  receivedAt: v.number(),
}).index('by_eventId', ['eventId']),

stripeOrders: defineTable({
  sessionId: v.string(),
  eventId: v.string(),
  amountTotal: v.number(),   // cents
  currency: v.string(),
  customerEmail: v.optional(v.string()),
  charitySlug: v.optional(v.string()),
  createdAt: v.number(),
})
  .index('by_sessionId', ['sessionId'])
  .index('by_charitySlug_createdAt', ['charitySlug', 'createdAt']),
```

`pnpm --filter @eisenbalm/convex exec convex dev --once` deployed the schema patch to **modest-magpie-797** (dev) in 5.56s with the following diff confirmed in CLI output:

```
✔ Added table indexes:
  [+] stripeEvents.by_eventId   eventId, _creationTime
  [+] stripeOrders.by_charitySlug_createdAt   charitySlug, createdAt, _creationTime
  [+] stripeOrders.by_sessionId   sessionId, _creationTime
```

`convex/_generated/api.d.ts` now contains:

```
import type * as stripeEvents from "../stripeEvents.js";
import type * as stripeOrders from "../stripeOrders.js";
  stripeEvents: typeof stripeEvents;
  stripeOrders: typeof stripeOrders;
```

Plan 08-05 webhook handler imports `api.stripeEvents.claim` and `api.stripeOrders.insert` via this generated index.

### Convex mutation files

`convex/stripeEvents.ts` — atomic `claim` mutation. Returns a discriminated union via `as const`:

```typescript
export const claim = mutation({
  args: { eventId: v.string(), eventType: v.string(), livemode: v.boolean() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('stripeEvents')
      .withIndex('by_eventId', q => q.eq('eventId', args.eventId)).first()
    if (existing) return { firstTime: false as const }
    await ctx.db.insert('stripeEvents', { ...args, receivedAt: Date.now() })
    return { firstTime: true as const }
  },
})
```

Convex serializes mutations per-table — the `withIndex.first()` + `insert` pair is one atomic operation, so two concurrent webhook retries cannot both observe "no existing row" and both insert.

`convex/stripeOrders.ts` — best-effort audit `insert` mutation. Plan 08-05 webhook handler wraps this in try/catch and returns 200 to Stripe regardless of audit outcome, because the `claim` row is already persisted and Stripe should not retry. Server-side `createdAt: Date.now()` follows Phase 3 D-12.

### Stripe SDK install

`pnpm --filter web add stripe@^21.0.0` resolved **stripe@21.0.1** and updated `pnpm-lock.yaml` (+16 lines). The pin rationale:

| Major | First published | Days stable (as of 2026-05-19) | Pin? |
|-------|------------------|-------------------------------|------|
| 22.x | 2026-04-03 (22.0.0) — latest 22.1.1 on 2026-05-06 | 13 days (latest) / 46 days (first) | NO — latest patch too fresh |
| 21.x | 2026-03-26 | 54 days | YES |

Per RESEARCH §Standard Stack: "If the most-recently-published major has been stable for ≥ 30 days, pin that major. Otherwise, pin the previous major." 22.1.1 (the actual published latest) is 13 days old → pin 21.x. Plan 08-05 will lock `apiVersion` explicitly in `apps/web/lib/stripe/server.ts` (recommended `'2025-04-30.basil'` from RESEARCH §Pitfall 6 — verify against stripe@21.x default at that plan time).

`@stripe/stripe-js` is intentionally absent. Hosted Checkout flow uses `window.location.href = session.url`, not Elements.

### Env var template (`apps/web/.env.example`)

Five new entries appended after `CONVEX_DEPLOY_KEY`:

| Var | Purpose | Security |
|-----|---------|----------|
| `STRIPE_SECRET_KEY=` | Server-side Stripe API key (sk_test_..., sk_live_...) | SECRET |
| `STRIPE_WEBHOOK_SECRET=` | Webhook signing secret (whsec_...) | SECRET |
| `STRIPE_PRICE_ID=` | Locked SKU for the lip balm Price object | Public-ish but pinned server-side |
| `STRIPE_RECORD_ORDERS=true` | Feature flag (default 'true') — toggle stripeOrders writes | Non-secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=` | RESERVED for V2 Elements; blank in v1 | Public (when used) |

Each entry follows the documentation density of `CONVEX_DEPLOY_KEY` (purpose / where-to-get / security posture). The single-quote rule from `CONVEX_DEPLOY_KEY` does not apply to any current Stripe value (no `|` or other shell-special chars in test or live keys).

## Verification

| Acceptance Criterion | Result |
|---------------------|--------|
| `grep -c "stripeEvents: defineTable" convex/schema.ts` | 1 ✓ |
| `grep -c "stripeOrders: defineTable" convex/schema.ts` | 1 ✓ |
| `grep -c "'by_eventId'" convex/schema.ts` | 1 ✓ |
| `grep -c "'by_sessionId'" convex/schema.ts` | 1 ✓ |
| `grep -c "'by_charitySlug_createdAt'" convex/schema.ts` | 1 ✓ |
| All 5 existing tables preserved (pipelineRuns/deliberationEvents/agentVotes/qaCorrections/pitchLog) | ✓ (each grep returns 1) |
| `export const claim = mutation` in stripeEvents.ts | ✓ |
| `export const insert = mutation` in stripeOrders.ts | ✓ |
| `firstTime: true as const` + `firstTime: false as const` both present | ✓ |
| `withIndex('by_eventId'` in claim handler | ✓ |
| `Date.now()` server-side in both mutations | ✓ |
| `convex dev --once` exits 0; schema accepted by Convex | ✓ (5.56s) |
| `convex/_generated/api.d.ts` references stripeEvents + stripeOrders | ✓ |
| `apps/web/package.json` has `"stripe": "^21.0.0"` | ✓ |
| `@stripe/stripe-js` NOT in package.json | ✓ |
| `pnpm-lock.yaml` updated (+16 lines) | ✓ |
| `node -e "require('stripe')"` loads SDK | ✓ (function type) |
| All 5 env vars present in `.env.example` with prescribed values/comments | ✓ |
| `RESERVED` keyword for publishable key | ✓ |

`pnpm --filter web typecheck` regression check: the only failures are Wave 0 test files referencing future route handlers (`@/app/api/checkout/create-session/route`, `@/app/api/stripe/webhook/route`) which are intentional sentinels from Plan 08-01 (will go green in Plans 08-04..08-05). No regression caused by this plan.

`pnpm --filter web test:unit` regression check: same sentinel — 37 pass / 29 fail, identical to Plan 08-01 close-out. Stripe SDK is now resolvable on dynamic import (previously failed with "Cannot find module 'stripe'"); test failures now progress to the expected "target route handler not found" stage.

## Deviations from Plan

None. Plan executed as written. The pin choice (`^21.0.0` instead of `^18.0.0` or `^19.0.0` that the plan suggested as examples) follows the plan's own algorithm: "If the most-recently-published major has been stable for ≥ 30 days, pin that major. Otherwise, pin the previous major." With latest `22.1.1` at 13 days old, the algorithm selects `21.x` (54 days stable).

## Cross-References

- **Plan 08-05** (webhook-handler-and-idempotency) consumes `api.stripeEvents.claim` and `api.stripeOrders.insert`, and will pin `apiVersion` in `apps/web/lib/stripe/server.ts`. Recommended `apiVersion: '2025-04-30.basil'` per RESEARCH §Pitfall 6; Plan 08-05 should verify this matches the stripe@21.x default before committing.
- **Plan 08-04** (stripe-client-and-checkout-api) consumes `apps/web/lib/stripe/server.ts` (created by Plan 08-05) and the `STRIPE_PRICE_ID` env var documented here.
- **Plan 08-02** (stripe-dashboard-checkpoint) is the human-action gate where Andrew creates the actual product, price, and shipping rates in the Stripe Dashboard — supplies the values that fill `STRIPE_PRICE_ID` and (eventually) the test-mode webhook signing secret.

## Commits

- `75e96ca` feat(08-03): add stripeEvents + stripeOrders Convex tables and mutations
- `6c44485` chore(08-03): install stripe@^21.0.0 SDK + document Stripe env vars

## Self-Check: PASSED

- All claimed files exist on disk (convex/stripeEvents.ts, convex/stripeOrders.ts, apps/web/.env.example, apps/web/package.json, this SUMMARY.md).
- Both commit hashes (`75e96ca`, `6c44485`) present in `git log --oneline --all`.
- All Task 1 + Task 2 acceptance criteria verified (see Verification table above).
- Convex deployment confirmed via CLI ("Added table indexes: stripeEvents.by_eventId, stripeOrders.by_sessionId, stripeOrders.by_charitySlug_createdAt").
- No regressions to existing 5 Convex tables (each `grep -c "<table>: defineTable" convex/schema.ts` returns 1).
