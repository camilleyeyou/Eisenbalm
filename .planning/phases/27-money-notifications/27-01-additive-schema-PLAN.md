---
phase: 27-money-notifications
plan: 01
type: execute
wave: 1
depends_on: ["27-00"]
files_modified:
  - convex/schema.ts
autonomous: true
requirements: [RCN-01, RCN-02, NTF-01, NTF-02]

must_haves:
  truths:
    - "Convex schema has a notificationsLedger table with the (runId, eventType, channel) idempotency index"
    - "Convex schema has a payouts table keyed by workspace + issueNumber with a status index"
    - "stripeOrders has an additive optional stripeFee field; no existing field renamed or removed"
    - "model_pricing and deliberationEvents shapes are unchanged"
  artifacts:
    - path: "convex/schema.ts"
      provides: "notificationsLedger + payouts tables, stripeOrders.stripeFee additive field"
      contains: "notificationsLedger"
  key_links:
    - from: "convex/schema.ts notificationsLedger"
      to: "convex/notifications.ts (Wave 2)"
      via: "by_runId_eventType_channel index used by getByKey/markSent"
      pattern: "by_runId_eventType_channel"
    - from: "convex/schema.ts payouts"
      to: "convex/payouts.ts + finance UI (Wave 2/3)"
      via: "by_workspace_status + by_workspace_issueNumber indexes"
      pattern: "by_workspace_status"
---

<objective>
Add the additive Convex schema for Phase 27 exactly as specified in docs/API_CONTRACTS.md §27: a `notificationsLedger` table, a `payouts` table, and one additive optional field `stripeFee` on `stripeOrders`. No existing field is renamed or removed (D-14 additive-only; `stripeOrders`/`model_pricing`/`emailSends`/`deliberationEvents.eventType` shapes are frozen).

Purpose: All Wave 2 mutations/queries (notifications ledger, payouts, fee caching) require these tables/fields to exist first.
Output: updated `convex/schema.ts` that codegens cleanly.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- Exact table shapes from RESEARCH.md "Additive schema additions required" (HIGH confidence). -->

notificationsLedger:
```typescript
notificationsLedger: defineTable({
  workspace_id: v.string(),
  runId: v.string(),              // or eventKey for budget events
  eventType: v.string(),          // 'complete' | 'failed' | 'awaiting-review' | 'budget'
  channel: v.string(),            // 'email' | 'slack'
  status: v.union(v.literal('queued'), v.literal('sent'), v.literal('failed'), v.literal('skipped')),
  providerId: v.optional(v.string()),
  sentAt: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
}).index('by_runId_eventType_channel', ['runId', 'eventType', 'channel'])
  .index('by_workspace_createdAt', ['workspace_id', 'createdAt']),
```

payouts:
```typescript
payouts: defineTable({
  workspace_id: v.string(),
  issueNumber: v.number(),
  issueId: v.optional(v.string()),
  charitySlug: v.string(),
  amount: v.number(),               // net-to-charity in cents
  status: v.union(v.literal('pending'), v.literal('sent')),
  sentAt: v.optional(v.number()),
  reference: v.optional(v.string()),
  actor: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
}).index('by_workspace_issueNumber', ['workspace_id', 'issueNumber'])
  .index('by_workspace_status', ['workspace_id', 'status']),
```

stripeOrders (existing, FROZEN) — add ONLY:
  stripeFee: v.optional(v.number())   // cached Stripe fee in cents
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add notificationsLedger + payouts tables and stripeOrders.stripeFee</name>
  <read_first>
    - convex/schema.ts (read current state — stripeOrders ~line 134, model_pricing ~line 341; match the defineTable/defineField/v.* style and the // ── section-header comment convention)
    - docs/API_CONTRACTS.md §27 (the authoritative shapes — implement exactly what §27.2/27.3/27.4 specify)
    - convex/emailSends.ts (reference for the ledger idempotency pattern these indexes serve)
  </read_first>
  <action>
    In convex/schema.ts:

    1. Add the `notificationsLedger` table verbatim from the §27.4 interface above, with both indexes `by_runId_eventType_channel` (`['runId', 'eventType', 'channel']`) and `by_workspace_createdAt` (`['workspace_id', 'createdAt']`). Place it near `emailSends` with a `// ── notificationsLedger: operational notification idempotency (Phase 27 NTF-01/02) ──` header comment.

    2. Add the `payouts` table verbatim from the §27.3 interface above, with indexes `by_workspace_issueNumber` (`['workspace_id', 'issueNumber']`) and `by_workspace_status` (`['workspace_id', 'status']`). Place it near `model_pricing` with a `// ── payouts: per-issue payout tracking (Phase 27 RCN-02) ──` header comment.

    3. Add EXACTLY ONE field to the existing `stripeOrders` table — `stripeFee: v.optional(v.number()), // cached Stripe fee in cents (Phase 27 RCN-01, D-08)` — placed among the other additive optional fields. Do NOT rename, reorder, or remove any existing stripeOrders field. Do NOT touch model_pricing, emailSends, or the deliberationEvents.eventType union.

    Run codegen to confirm the schema compiles: `npx convex codegen` (or `npx convex dev --once` if codegen alone is unavailable).
  </action>
  <verify>
    <automated>grep -q "notificationsLedger:" convex/schema.ts && grep -q "by_runId_eventType_channel" convex/schema.ts && grep -q "payouts:" convex/schema.ts && grep -q "by_workspace_status" convex/schema.ts && grep -q "stripeFee" convex/schema.ts && cd convex && npx convex codegen 2>&1 | tail -1; echo SCHEMA_DONE</automated>
  </verify>
  <acceptance_criteria>
    - convex/schema.ts contains `notificationsLedger:` with indexes `by_runId_eventType_channel` and `by_workspace_createdAt`
    - convex/schema.ts contains `payouts:` with indexes `by_workspace_issueNumber` and `by_workspace_status`
    - convex/schema.ts contains `stripeFee: v.optional(v.number())` inside the stripeOrders defineTable block
    - `git diff convex/schema.ts` shows only ADDED lines for the two new tables, the one stripeFee field, and their comment headers — no removed/renamed lines in stripeOrders/model_pricing/emailSends/deliberationEvents
    - `npx convex codegen` exits without a schema validation error
  </acceptance_criteria>
</task>

</tasks>

<verification>
- Schema codegens cleanly with two new tables + one additive field.
- `git diff` confirms additive-only (no renames/removals to frozen shapes).
</verification>

<success_criteria>
- notificationsLedger + payouts tables exist with the §27 indexes.
- stripeOrders.stripeFee additive field present; all frozen shapes intact.
</success_criteria>

<output>
After completion, create `.planning/phases/27-money-notifications/27-01-SUMMARY.md`
</output>
