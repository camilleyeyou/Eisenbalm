---
phase: 27-money-notifications
plan: 02
type: execute
wave: 2
depends_on: ["27-01"]
files_modified:
  - apps/web/lib/finance/reconcile.ts
  - apps/web/lib/finance/staleness.ts
  - convex/finance.ts
  - convex/payouts.ts
files_owned_note: "RCN track. No overlap with Plan 03 (NTF track) files."
autonomous: true
requirements: [RCN-01, RCN-02]

must_haves:
  truths:
    - "Operator-facing logic computes, per issue, gross (amountTotal) / fees (cached stripeFee) / net-to-charity (donationAmount) from actual stripeOrders rows — never from model_pricing"
    - "Orders attribute to an issue by charitySlug + createdAt within [publishedAt, nextPublishedAt); the latest issue uses an open window; unmatched orders go to an Unattributed bucket"
    - "Stripe fee is fetched via the stored sessionId (no paymentIntentId) and cached additively to stripeOrders.stripeFee"
    - "Operator can mark a payout sent; the mutation is Clerk-JWT-guarded and audit-logged with before/after"
    - "model_pricing staleness is computed against a 30-day threshold"
  artifacts:
    - path: "apps/web/lib/finance/reconcile.ts"
      provides: "reconcileIssue + attributeOrderToWindow pure helpers (RCN-01)"
      exports: ["reconcileIssue", "attributeOrderToWindow"]
    - path: "apps/web/lib/finance/staleness.ts"
      provides: "isStale + THIRTY_DAYS_MS (D-13)"
      exports: ["isStale", "THIRTY_DAYS_MS"]
    - path: "convex/finance.ts"
      provides: "perIssueRevenue query + fetchFeeForOrder internalAction"
      exports: ["perIssueRevenue", "fetchFeeForOrder"]
    - path: "convex/payouts.ts"
      provides: "markPayoutSent (guarded+audited) + listByWorkspace + upsertForIssue"
      exports: ["markPayoutSent", "listByWorkspace"]
  key_links:
    - from: "convex/finance.ts fetchFeeForOrder"
      to: "Stripe Checkout Sessions API"
      via: "stripe.checkout.sessions.retrieve(sessionId, {expand: ['payment_intent.latest_charge.balance_transaction']})"
      pattern: "balance_transaction"
    - from: "convex/payouts.ts markPayoutSent"
      to: "convex/auditLog.ts write"
      via: "ctx.runMutation(internal.auditLog.write, {action: 'payout:markSent', before, after})"
      pattern: "payout:markSent"
---

<objective>
Build the financial reconciliation backend (RCN-01) and payout tracking backend (RCN-02): pure reconciliation/staleness helpers in apps/web (unit-tested against the Wave 0 scaffolds), a Convex `finance.ts` (per-issue revenue query + Stripe fee internalAction caching to `stripeOrders.stripeFee`), and a Convex `payouts.ts` (Clerk-JWT-guarded, audit-logged mark-sent + list).

Purpose: Turns recorded `stripeOrders` rows + the Stripe fee API into an auditable per-issue gross/fee/net picture and a payout status record, satisfying the "100% of proceeds" auditability promise.
Output: 2 lib helper files + 2 Convex files. Wave 0 finance + staleness tests go GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- HIGH confidence from RESEARCH.md code reads. -->

stripeOrders row fields used: amountTotal (cents, gross), donationAmount (cents, net == amountSubtotal), charitySlug, createdAt, sessionId, currency, stripeFee? (additive cache).

weeklyIssue (apps/studio/schemas/weeklyIssue.ts): issueNumber, slug `issue-{n}`, charity reference (→ charity.slug), publishedAt. Resolve charitySlug → issue via charity ref.

Stripe fee fetch (Convex internalAction, "use node"):
```typescript
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' })
const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent.latest_charge.balance_transaction'] })
const fee = ((session.payment_intent as Stripe.PaymentIntent)?.latest_charge as Stripe.Charge)?.balance_transaction as Stripe.BalanceTransaction
return fee?.fee ?? 0  // cents
```

auditLog.write (internalMutation): { workspace_id, actorId, action, resourceType?, resourceId?, before?, after? }

markPayoutSent pattern (RESEARCH Pattern 5):
```typescript
const identity = await ctx.auth.getUserIdentity()
if (!identity) throw new Error('Unauthorized')
const before = await ctx.db.get(args.payoutId)
if (!before || before.status === 'sent') throw new Error('Payout not found or already sent')
await ctx.db.patch(args.payoutId, { status: 'sent', sentAt: args.sentAt, reference: args.reference, actor: identity.subject, updatedAt: Date.now() })
await ctx.runMutation(internal.auditLog.write, { workspace_id: before.workspace_id, actorId: identity.subject, action: 'payout:markSent', resourceType: 'payouts', resourceId: args.payoutId, before: JSON.stringify({status: before.status}), after: JSON.stringify({status:'sent', reference: args.reference}) })
```

Sales-window rule (D-10, Pitfall 5): window = [issue.publishedAt, nextIssue.publishedAt); latest issue upper bound = nextIssuePublishedAt ?? Date.now(); unmatched → 'unattributed' bucket.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure reconciliation + staleness helpers (RCN-01, D-13)</name>
  <read_first>
    - apps/web/__tests__/stripe-reconciliation.test.ts (Wave 0 RED — the exact function names, signatures, and fixtures these helpers must satisfy)
    - apps/web/__tests__/model-pricing-staleness.test.ts (Wave 0 RED — isStale + THIRTY_DAYS_MS contract)
    - docs/API_CONTRACTS.md §27.1 (gross/net/fee definitions + attribution rule)
    - apps/web/vitest.config.ts + tsconfig path alias (confirm `@/lib/...` resolves to apps/web/lib)
  </read_first>
  <behavior>
    - reconcileIssue(orders): returns { orderCount, grossCents: sum(amountTotal), netCents: sum(donationAmount), feeCents: sum(stripeFee ?? 0, or null if any uncached) }. gross − fee === net holds for clean fixtures.
    - attributeOrderToWindow(order, issues): returns the matching issueNumber when order.charitySlug === issue.charitySlug AND order.createdAt ∈ [issue.publishedAt, nextPublishedAt ?? Date.now()); otherwise 'unattributed'.
    - isStale(updatedAt, now): now - updatedAt > THIRTY_DAYS_MS. Exactly 30 days → false; >30 → true; <30 → false.
  </behavior>
  <action>
    Create `apps/web/lib/finance/reconcile.ts` exporting `reconcileIssue(orders: ReconcileOrder[])` and `attributeOrderToWindow(order, issues)`. Create `apps/web/lib/finance/staleness.ts` exporting `THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000` and `isStale(updatedAt: number, now: number): boolean` returning `now - updatedAt > THIRTY_DAYS_MS`.

    Define the helper input types inline (e.g. `ReconcileOrder = { amountTotal: number; donationAmount?: number; stripeFee?: number }`, issue window type `{ issueNumber: number; charitySlug: string; publishedAt: number; nextPublishedAt: number | null }`). For `attributeOrderToWindow`, the latest issue's `nextPublishedAt === null` → upper bound `Date.now()` passed in or computed; accept a `now` param defaulting to `Date.now()` so the test is deterministic. Match the import paths the Wave 0 tests use exactly (`@/lib/finance/reconcile`, `@/lib/finance/staleness`).
  </action>
  <verify>
    <automated>cd apps/web && npx vitest run __tests__/stripe-reconciliation.test.ts __tests__/model-pricing-staleness.test.ts --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - `cd apps/web && npx vitest run __tests__/stripe-reconciliation.test.ts` exits 0 (GREEN)
    - `cd apps/web && npx vitest run __tests__/model-pricing-staleness.test.ts` exits 0 (GREEN)
    - apps/web/lib/finance/reconcile.ts exports `reconcileIssue` and `attributeOrderToWindow`
    - apps/web/lib/finance/staleness.ts exports `isStale` and `THIRTY_DAYS_MS`
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: convex/finance.ts — perIssueRevenue query + Stripe fee internalAction</name>
  <read_first>
    - docs/API_CONTRACTS.md §27.1 + §27.2 (query return shape + fee fetch path)
    - apps/web/lib/stripe/server.ts (existing getStripeServer singleton + apiVersion '2025-04-30.basil')
    - convex/emailActions.ts (the "use node" internalAction pattern + ctx.runQuery/ctx.runMutation usage)
    - convex/schema.ts (stripeOrders indexes by_charitySlug_createdAt / by_createdAt; new stripeFee field)
    - convex/stripeOrders.ts (existing query/mutation patterns for stripeOrders)
  </read_first>
  <action>
    Create `convex/finance.ts`:

    1. A query `perIssueRevenue` (regular Convex query, no node) that: reads all `stripeOrders`, reads published issues' windows (issueNumber, charitySlug, publishedAt, sorted; latest window upper bound = Date.now()), attributes each order to a window by charitySlug + createdAt (mirror the apps/web `attributeOrderToWindow` logic — reimplement inline in TS since Convex can't import from apps/web), and returns per issue `{ issueNumber, issueId, charitySlug, charityName, windowStart, windowEnd (null for latest), orderCount, grossCents (sum amountTotal), netCents (sum donationAmount), feeCents (sum stripeFee; null if any order in the window lacks a cached stripeFee) }`, plus an `unattributed` bucket. Issue window data: accept it as an arg (the dashboard passes published issues from Sanity) OR document that the caller passes the issue list — choose the arg approach and document the arg shape. Compute gross/net from actuals ONLY; never read model_pricing.

    2. An internalAction `fetchFeeForOrder` (`"use node"`) that takes `{ orderId: v.id('stripeOrders') }`, reads the order's `sessionId` via `ctx.runQuery`, constructs `new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' })`, calls `stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent.latest_charge.balance_transaction'] })`, extracts `balance_transaction.fee` (cents, default 0), and patches `stripeOrders.stripeFee` via an internalMutation `cacheFee({ orderId, fee })` (write once; skip if already set). Wrap the Stripe call in try/catch; on failure log and leave stripeFee unset (the UI shows "—").

    3. An internalMutation `cacheFee` performing the additive `ctx.db.patch(orderId, { stripeFee })`.

    Run `npx convex codegen` to confirm it compiles.
  </action>
  <verify>
    <automated>grep -q "export const perIssueRevenue" convex/finance.ts && grep -q "export const fetchFeeForOrder" convex/finance.ts && grep -q "balance_transaction" convex/finance.ts && grep -q "2025-04-30.basil" convex/finance.ts && grep -q '"use node"' convex/finance.ts && cd convex && npx convex codegen 2>&1 | tail -1; echo FINANCE_DONE</automated>
  </verify>
  <acceptance_criteria>
    - convex/finance.ts exports `perIssueRevenue`, `fetchFeeForOrder`, `cacheFee`
    - convex/finance.ts contains `'2025-04-30.basil'` and the expand string `payment_intent.latest_charge.balance_transaction`
    - `fetchFeeForOrder` is declared in a file beginning with `"use node"`
    - perIssueRevenue reads `stripeOrders` and computes gross from `amountTotal` and net from `donationAmount`; `grep -c "model_pricing" convex/finance.ts` returns 0
    - `npx convex codegen` exits without error
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: convex/payouts.ts — markPayoutSent (guarded+audited) + listByWorkspace + upsertForIssue</name>
  <read_first>
    - docs/API_CONTRACTS.md §27.3 (payouts mutations/query contract)
    - convex/pipelineConfig.ts (setAutoPublish — the Clerk-JWT guard `ctx.auth.getUserIdentity()` + `internal.auditLog.write` pattern to mirror exactly)
    - convex/auditLog.ts (write internalMutation signature)
    - convex/schema.ts (payouts table + indexes by_workspace_issueNumber / by_workspace_status)
  </read_first>
  <action>
    Create `convex/payouts.ts`:

    1. `markPayoutSent` mutation, args `{ payoutId: v.id('payouts'), reference: v.string(), sentAt: v.number() }`. Guard: `const identity = await ctx.auth.getUserIdentity(); if (!identity) throw new Error('Unauthorized')`. Load `before = await ctx.db.get(args.payoutId)`; throw `'Payout not found or already sent'` if missing or `before.status === 'sent'`. Patch `{ status: 'sent', sentAt: args.sentAt, reference: args.reference, actor: identity.subject, updatedAt: Date.now() }`. Then call `await ctx.runMutation(internal.auditLog.write, { workspace_id: before.workspace_id, actorId: identity.subject, action: 'payout:markSent', resourceType: 'payouts', resourceId: args.payoutId, before: JSON.stringify({ status: before.status }), after: JSON.stringify({ status: 'sent', reference: args.reference }) })`.

    2. `listByWorkspace` query, args `{ workspace_id: v.string() }`, returns all payout rows for the workspace ordered by issueNumber (use index `by_workspace_issueNumber`).

    3. `upsertForIssue` mutation (or internalMutation), args `{ workspace_id, issueNumber, issueId?, charitySlug, amount }` — creates a `pending` payout row for an issue if none exists (idempotent on workspace_id+issueNumber), so the finance view can ensure a payout row exists per reconciled issue. Set `status: 'pending'`, `createdAt`/`updatedAt = Date.now()`.

    Run `npx convex codegen`.
  </action>
  <verify>
    <automated>grep -q "export const markPayoutSent" convex/payouts.ts && grep -q "getUserIdentity" convex/payouts.ts && grep -q "payout:markSent" convex/payouts.ts && grep -q "auditLog.write" convex/payouts.ts && grep -q "export const listByWorkspace" convex/payouts.ts && cd convex && npx convex codegen 2>&1 | tail -1; echo PAYOUTS_DONE</automated>
  </verify>
  <acceptance_criteria>
    - convex/payouts.ts exports `markPayoutSent`, `listByWorkspace`, `upsertForIssue`
    - markPayoutSent calls `ctx.auth.getUserIdentity()` and throws `'Unauthorized'` when absent
    - markPayoutSent calls `internal.auditLog.write` with `action: 'payout:markSent'` and both `before` and `after` JSON
    - markPayoutSent throws when the payout is missing or already `sent` (no double-send)
    - `npx convex codegen` exits without error
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `cd apps/web && npx vitest run __tests__/stripe-reconciliation.test.ts __tests__/model-pricing-staleness.test.ts` GREEN.
- `npx convex codegen` clean with finance.ts + payouts.ts.
- Payout mark-sent is guarded + audit-logged (manual Convex-dashboard verify per VALIDATION.md manual-only row 27-02-PAYOUT).
</verification>

<success_criteria>
- RCN-01: per-issue gross/fee/net computed from actuals; fee from Stripe sessionId path, cached additively.
- RCN-02: payout status mutation guarded + audited; list query for the dashboard.
- D-13 staleness helper GREEN.
</success_criteria>

<output>
After completion, create `.planning/phases/27-money-notifications/27-02-SUMMARY.md`
</output>
