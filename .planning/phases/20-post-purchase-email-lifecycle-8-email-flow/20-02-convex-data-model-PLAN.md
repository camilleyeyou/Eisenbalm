---
phase: 20-post-purchase-email-lifecycle-8-email-flow
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - convex/schema.ts
  - convex/emailSubscribers.ts
  - convex/emailSends.ts
  - apps/web/.env.example
  - convex/README.md
autonomous: true
requirements: [EMAIL-02, EMAIL-03, EMAIL-09]
must_haves:
  truths:
    - "Two new Convex tables exist: emailSubscribers (consent + unsubscribeToken) and emailSends (idempotent ledger with scheduledFnId)"
    - "emailSends has an index that makes (orderId, step) lookups O(1) so idempotency checks are cheap"
    - "emailSubscribers has by_email and by_token indexes for suppression + unsubscribe lookups"
    - "Internal query/mutation functions exist to claim/markSent/markFailed an email step and to upsert/getByEmail/getByToken a subscriber"
    - "Convex schema+functions deploy cleanly (codegen regenerates _generated/api.ts with the new modules)"
  artifacts:
    - path: "convex/schema.ts"
      provides: "emailSubscribers + emailSends table definitions"
      contains: "emailSends:"
    - path: "convex/emailSubscribers.ts"
      provides: "upsertSubscriber, getByEmail, getByToken internal fns"
      exports: ["upsertSubscriber", "getByEmail", "getByToken"]
    - path: "convex/emailSends.ts"
      provides: "getByOrderStep, insertScheduled, markSent, markFailed, markSkipped internal fns"
      exports: ["getByOrderStep", "insertScheduled", "markSent", "markFailed"]
  key_links:
    - from: "convex/schema.ts"
      to: "emailSends index by_orderId_step"
      via: "Convex .index for idempotency lookup"
      pattern: "by_orderId_step"
    - from: "convex/emailSends.ts"
      to: "emailSends table"
      via: "ctx.db.query('emailSends').withIndex('by_orderId_step')"
      pattern: "by_orderId_step"
---

<objective>
Extend the Convex schema with the two new tables Phase 20 needs — `emailSubscribers` (consent state + unsubscribe token) and the idempotent `emailSends` ledger (one row per order+step, carrying the `scheduledFnId` so unsubscribe can cancel pending steps) — and write the internal query/mutation functions the Wave 2 flow engine and Wave 4 unsubscribe route call. Document the new env vars and deploy.

Purpose: This is the durable state layer. Idempotency (EMAIL-02), suppression queries (EMAIL-03), and the skip-on-missing-email path (EMAIL-09) all read/write these tables. CLAUDE.md forbids renaming existing fields without checking API_CONTRACTS — these are NET-NEW tables (additive; no existing field touched), so no API_CONTRACTS change is required, but note the addition in the SUMMARY.
Output: Two tables + two function modules + env docs, deployed to the dev Convex deployment.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-BRIEF.md
@.planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-RESEARCH.md
@convex/schema.ts
@convex/stripeOrders.ts
@convex/stripeEvents.ts

<interfaces>
<!-- Existing Convex conventions (from convex/schema.ts + convex/stripeEvents.ts). Mirror these EXACTLY. -->

Existing table style: camelCase fields, *At suffix for ms timestamps, kebab-case status literals via v.literal, inline .index('by_x',['x']). Date.now() injected server-side on insert.

Existing stripeEvents.claim pattern (atomic check-and-insert via unique index) — emailSends idempotency is analogous but keyed on (orderId, step).

Convex function defs: `import { internalQuery, internalMutation } from './_generated/server'` and `import { v } from 'convex/values'`. Internal fns are NOT exposed to the browser client. (Existing public fns use `query`/`mutation`; these new ones are internal because only Convex actions/mutations + the server-side unsubscribe wrapper call them.)

stripeOrders.insert already exists at convex/stripeOrders.ts — Plan 20-04 extends it; this plan does NOT modify it.

CLAUDE.md: convex/AGENTS.md / _generated/ai/guidelines.md govern Convex API usage — read convex/_generated/ai/guidelines.md before writing functions.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add emailSubscribers + emailSends tables to schema.ts</name>
  <read_first>convex/schema.ts, convex/_generated/ai/guidelines.md, .planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-RESEARCH.md</read_first>
  <files>convex/schema.ts</files>
  <action>
Append two tables to the `defineSchema({ ... })` object in `convex/schema.ts`, after `stripeOrders`, following the exact field/index/comment conventions used by the existing tables.

`emailSubscribers`:
```typescript
// ── Email lifecycle: consent ledger (Phase 20 — EMAIL-03) ────────────────
emailSubscribers: defineTable({
  email: v.string(),
  consentState: v.union(v.literal('subscribed'), v.literal('unsubscribed')),
  source: v.string(),                  // 'post-purchase-flow' | 'newsletter-optin'
  unsubscribeToken: v.string(),        // 64-char hex; globally unique
  createdAt: v.number(),
  unsubscribedAt: v.optional(v.number()),
})
  .index('by_email', ['email'])
  .index('by_token', ['unsubscribeToken']),
```

`emailSends`:
```typescript
// ── Email lifecycle: idempotent send ledger (Phase 20 — EMAIL-02) ────────
emailSends: defineTable({
  orderId: v.id('stripeOrders'),
  email: v.string(),                   // denormalized for fast suppression queries
  step: v.number(),                    // 1-8
  status: v.union(
    v.literal('scheduled'),
    v.literal('sent'),
    v.literal('failed'),
    v.literal('cancelled'),            // unsubscribe cancelled this pending step
    v.literal('skipped'),              // customerEmail absent at enqueue time
  ),
  scheduledFnId: v.optional(v.string()),     // Convex scheduled-fn id for ctx.scheduler.cancel
  providerMessageId: v.optional(v.string()), // Resend / fake provider message id
  sentAt: v.optional(v.number()),
  failedAt: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
})
  .index('by_orderId', ['orderId'])
  .index('by_orderId_step', ['orderId', 'step'])
  .index('by_email_step', ['email', 'step'])
  .index('by_status', ['status']),
```
Do NOT modify any existing table. Keep the closing `})` of defineSchema intact.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -q "emailSubscribers:" convex/schema.ts && grep -q "emailSends:" convex/schema.ts && grep -q "by_orderId_step" convex/schema.ts && grep -q "scheduledFnId" convex/schema.ts && echo OK</automated>
  </verify>
  <acceptance_criteria>
- `convex/schema.ts` contains `emailSubscribers:` and `emailSends:` table definitions.
- `emailSends` has indexes `by_orderId`, `by_orderId_step`, `by_email_step`, `by_status`.
- `emailSubscribers` has indexes `by_email`, `by_token`.
- No existing table (pipelineRuns, stripeOrders, etc.) lost a field (grep `stripeOrders:` still present).
  </acceptance_criteria>
  <done>Two additive tables present with all listed indexes; existing schema untouched.</done>
</task>

<task type="auto">
  <name>Task 2: emailSubscribers + emailSends internal functions</name>
  <read_first>convex/stripeEvents.ts, convex/stripeOrders.ts, convex/_generated/ai/guidelines.md</read_first>
  <files>convex/emailSubscribers.ts, convex/emailSends.ts</files>
  <action>
Create `convex/emailSubscribers.ts` with internal functions (used by Wave 2 actions + Wave 4 unsubscribe wrapper):
- `getByEmail = internalQuery({ args:{ email: v.string() }, handler })` → `.withIndex('by_email', q=>q.eq('email', email)).first()`.
- `getByToken = internalQuery({ args:{ token: v.string() }, handler })` → `.withIndex('by_token', q=>q.eq('unsubscribeToken', token)).first()`.
- `upsertSubscriber = internalMutation({ args:{ email: v.string(), unsubscribeToken: v.string(), source: v.string() }, handler })` → look up by email; if absent, insert `{ email, consentState:'subscribed', source, unsubscribeToken, createdAt: Date.now() }` and return the new `_id`; if present, return the existing `_id` WITHOUT overwriting consentState (so a prior unsubscribe survives a later order). Idempotent.

Create `convex/emailSends.ts` with internal functions:
- `getByOrderStep = internalQuery({ args:{ orderId: v.id('stripeOrders'), step: v.number() }, handler })` → `.withIndex('by_orderId_step', q=>q.eq('orderId',orderId).eq('step',step)).first()`.
- `insertScheduled = internalMutation({ args:{ orderId, email: v.string(), step: v.number(), scheduledFnId: v.optional(v.string()) }, handler })` → insert `{ ...args, status:'scheduled', createdAt: Date.now() }`, return `_id`.
- `markSent = internalMutation({ args:{ orderId, step: v.number(), providerMessageId: v.string() }, handler })` → find row by `by_orderId_step`, `ctx.db.patch(row._id, { status:'sent', providerMessageId, sentAt: Date.now() })`. If no row exists, insert one with status 'sent' (defensive — sweep edge case).
- `markFailed = internalMutation({ args:{ orderId, step: v.number(), errorMessage: v.string() }, handler })` → patch row to `{ status:'failed', failedAt: Date.now(), errorMessage }`.
- `markSkipped = internalMutation({ args:{ orderId, email: v.string(), step: v.number() }, handler })` → insert `{ orderId, email, step, status:'skipped', createdAt: Date.now() }` (used by enqueue when customerEmail absent — EMAIL-09).

Use `v.id('stripeOrders')` for orderId args. All inserts set `createdAt: Date.now()` server-side. Follow the existing file header-comment style.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -q "getByOrderStep" convex/emailSends.ts && grep -q "markSent" convex/emailSends.ts && grep -q "by_orderId_step" convex/emailSends.ts && grep -q "getByToken" convex/emailSubscribers.ts && grep -q "upsertSubscriber" convex/emailSubscribers.ts && echo OK</automated>
  </verify>
  <acceptance_criteria>
- `convex/emailSends.ts` exports `getByOrderStep`, `insertScheduled`, `markSent`, `markFailed`, `markSkipped`.
- `convex/emailSubscribers.ts` exports `getByEmail`, `getByToken`, `upsertSubscriber`.
- `upsertSubscriber` does NOT overwrite `consentState` on an existing row (grep shows no `patch` of consentState in upsert; lookup-then-conditional-insert).
- All DB reads use `.withIndex(...)` (no full table scans / `.collect()` without index for these lookups).
  </acceptance_criteria>
  <done>Both function modules created with index-backed queries and idempotent upsert.</done>
</task>

<task type="auto">
  <name>Task 3: Env docs + deploy schema & functions</name>
  <read_first>apps/web/.env.example, convex/README.md</read_first>
  <files>apps/web/.env.example, convex/README.md</files>
  <action>
Document the new Phase 20 env vars in `apps/web/.env.example` (additive — do not remove existing entries), each with a one-line comment and NO real values:
- `EMAIL_LIVE_SEND=false   # Phase 20: master switch for real sending. Live sending OFF by default. Only 'true' enables Resend.`
- `RESEND_API_KEY=         # Phase 20: Resend API key. LAUNCH PREREQUISITE — leave blank until DNS + domains verified.`
- `EMAIL_FROM_TRANSACTIONAL=receipts@receipts.eisenbalm.com   # Phase 20: E1-E3 sender (separate subdomain).`
- `EMAIL_FROM_MARKETING=dispatch@dispatch.eisenbalm.com       # Phase 20: E4-E8 sender (separate subdomain).`
- `EMAIL_POSTAL_ADDRESS=   # Phase 20: CAN-SPAM physical postal address footer. LAUNCH PREREQUISITE — Andrew provides.`
- `NEXT_PUBLIC_BASE_URL=   # used to build the unsubscribe URL in List-Unsubscribe headers (already present? keep one copy).`

In `convex/README.md`, add a short `## Phase 20 — Email lifecycle tables` section listing the two new tables, their purpose, and the note that `emailSends` is the idempotency ledger keyed on (orderId, step).

Then deploy schema + functions to the DEV deployment (the deployment all consumers use per Phase 3 D-04): run `pnpm --filter @eisenbalm/convex dev:once`. This regenerates `convex/_generated/api.ts` with `internal.emailSubscribers.*` and `internal.emailSends.*`. If the deploy requires interactive prod confirmation, use `dev:once` (dev) only — do NOT run `convex deploy` (prod).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter @eisenbalm/convex dev:once >/tmp/cvx20.log 2>&1; grep -q "EMAIL_LIVE_SEND" apps/web/.env.example && grep -rq "emailSends" convex/_generated/api.d.ts 2>/dev/null && echo OK || (echo "check /tmp/cvx20.log"; grep -q "EMAIL_LIVE_SEND" apps/web/.env.example && echo ENV_OK)</automated>
  </verify>
  <acceptance_criteria>
- `apps/web/.env.example` contains `EMAIL_LIVE_SEND`, `RESEND_API_KEY`, `EMAIL_FROM_TRANSACTIONAL`, `EMAIL_FROM_MARKETING`, `EMAIL_POSTAL_ADDRESS` with no real secret values.
- `convex/_generated/api.d.ts` (or api.js) references `emailSends` and `emailSubscribers` modules after codegen.
- `convex/README.md` documents the two new tables.
- No `convex deploy` (prod) was run — dev:once only.
  </acceptance_criteria>
  <done>Env vars documented; schema + functions deployed to dev; codegen reflects new modules.</done>
</task>

</tasks>

<verification>
- `grep -E "emailSubscribers:|emailSends:" convex/schema.ts` shows both tables.
- `pnpm --filter @eisenbalm/convex typecheck` passes (or `dev:once` completes without schema errors).
- `convex/_generated/api.*` includes the new internal modules.
</verification>

<success_criteria>
- emailSubscribers + emailSends tables deployed with all indexes.
- Internal fns for idempotency (getByOrderStep/markSent), suppression lookup (getByEmail/getByToken), and skip path (markSkipped) exist.
- Env vars documented; live-send OFF default reflected in .env.example.
</success_criteria>

<output>
After completion, create `.planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-02-SUMMARY.md`
</output>
