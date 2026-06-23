# Phase 27: Money + Notifications — Research

**Researched:** 2026-06-23
**Domain:** Convex-side notifications dispatch, Stripe fee reconciliation, payout tracking, model_pricing staleness view
**Confidence:** HIGH — derived entirely from reading the project's own codebase, not training data

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Notifications originate Convex-side, not from the pipeline. The pipeline already writes run state to Convex (`runs:updateStatus`) and emits budget `cost-warning` deliberationEvents — so the notifier hangs off those existing writes. No new outbound HTTP egress is added to the Python pipeline.
- **D-02:** Reuse the Phase 20 email transport abstraction (`packages/emails` — `SendEmailProvider` / `selectProvider(env)` / `ResendProvider` / `FakeEmailProvider`) and the `convex/emailActions.ts` `internalAction` pattern (only `internalAction` may make external HTTP calls). Add a Slack incoming-webhook provider alongside the email provider behind the same selection seam. Do NOT fork a second email path.
- **D-03:** Both channels are independently toggleable; the system supports "Slack and/or email" — either, both, or (degenerate) neither.
- **D-04:** Fire from the events that already exist:
  - run **complete** / **failed** / **awaiting-review** → from `runs:updateStatus`
  - **budget threshold** → from the existing `cost-warning` seam (`deliberationEvents.eventType` union — reuse it, do not invent a new event type without an API_CONTRACTS amendment)
- **D-05:** Dispatch external HTTP send via `scheduler.runAfter(0, internalAction)` (mirror Phase 20) so the triggering mutation stays non-blocking.
- **D-06:** Channel config lives in `pipeline_config` keys: `notify_email`, `notify_slack_webhook_url`, `notify_on_complete`, `notify_on_failed`, `notify_on_awaiting_review`, `notify_on_budget`.
- **D-07:** Idempotent notifications ledger table keyed on `(runId or eventKey) + eventType + channel` — mirror the `emailSends` idempotency pattern.
- **D-08:** Gross/net from recorded `stripeOrders` rows: gross = `amountTotal`, net-to-charity = `donationAmount`. Stripe **fees** from Stripe API (balance-transaction per `payment_intent`), fetched server-side and cached.
- **D-09:** Stripe access is read-only reconciliation using existing (test-mode) keys. No new payment flows.
- **D-10:** Attribute each order to an issue via `stripeOrders.charitySlug` + `createdAt` falling within that issue's active sales window (issue published → next issue published). Fallback bucket for unmapped orders.
- **D-11:** Additive Convex `payouts` table: `issueNumber/issueId + charitySlug`, `amount`, `status (pending|sent)`, `sentAt`, `reference`, `actor`, timestamps.
- **D-12:** Payout mutations are Clerk-JWT-guarded and audit-logged (reuse AUD-01 `auditLog:write` pattern).
- **D-13:** Finance view renders `model_pricing` read-only, labeled "Projection pricing (not actual cost)", staleness badge when `updatedAt` older than 30 days.
- **D-14:** Contract-first (CLAUDE.md hard rule): amend `docs/API_CONTRACTS.md` with §27 **before** touching schema or code. All Convex schema changes are additive only.
- **D-15:** Preserve Phase 25 cost invariants: single-cost-writer rule and once-snapshotted per-run budget cap remain untouched.

### Claude's Discretion

- Exact finance-view layout/components in `dispatch-control` (the `finance/page.tsx` placeholder is ready to replace)
- Stripe-fee cache TTL + storage location
- Slack message formatting/blocks vs plain text
- Whether the notifications ledger is its own table or folded into an existing events table (planner decides from the §27 contract)
- How the sales-window boundary handles the current (latest) issue with no "next" issue yet

### Deferred Ideas (OUT OF SCOPE)

- Executing payouts (vs tracking status) — Phase 27 only records that a payout was sent; actual disbursement integration is a separate future capability
- Weekly newsletter send (Phase 20 captured consent only) — out of scope here
- Carrier/shipment tracking for delivery-anchored email timing — explicitly deferred in Phase 20
- Editing `model_pricing` rows from the dashboard — Phase 27 view is read-only; pricing maintenance is its own future task
- Multi-currency normalization beyond display of the recorded `currency`
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RCN-01 | Operator can see, per issue, gross sales / Stripe fees / net-to-charity for that issue's sales window (from the Stripe API + existing order records) | `stripeOrders` has `amountTotal` (gross), `donationAmount` (net); critical gap: no `paymentIntentId` field in schema or webhook handler — see §Architecture Patterns §Gap below |
| RCN-02 | Operator can track payout status per issue so the "100% of proceeds" promise is auditable | Additive `payouts` table (D-11); Clerk-JWT guard + audit log confirmed at `convex/auditLog.ts` |
| NTF-01 | Operator receives a notification (Slack and/or email) on run complete, run failed, and run awaiting review | Trigger seams confirmed: `convex/pipelineRuns.ts:28` `updateStatus` mutation; `convex/pipelineConfig.ts:167` Phase 27 NTF hook comment; `sendEmailProvider` interface extensible to Slack |
| NTF-02 | Operator receives a notification when a budget threshold is hit | `cost-warning` deliberationEvent already emitted by `lib/cost.py:306-326`; frozen union literal reused per D-04/D-15 |
</phase_requirements>

---

## Summary

Phase 27 is a pure extension phase — every capability hangs off existing infrastructure. The notification path mirrors Phase 20 (email internalAction + scheduler dispatch + idempotency ledger) with one new provider (Slack webhook). The financial reconciliation path reads from `stripeOrders` rows that are already recorded; the only external API call needed is for Stripe balance-transaction fees. The payout table is additive. The model_pricing view already has the data; only a display component is missing.

**The single architectural blocker:** `stripeOrders` does not store `paymentIntentId`, but D-08 requires fees from the balance-transaction API per `payment_intent`. Two valid resolutions exist; the planner must choose and document in §27 of `API_CONTRACTS.md` before any schema/code work begins.

**Primary recommendation:** Use Option B (retrieve fees via `stripe.checkout.sessions.retrieve(sessionId, {expand: ['payment_intent.latest_charge.balance_transaction']})`) — the `sessionId` IS stored in `stripeOrders`, so no schema change is needed for the existing rows. The Convex internalAction fetches and caches the fee on demand.

---

## Standard Stack

### Core (already installed — no new packages required for core functionality)

| Library | Version | Purpose | Location |
|---------|---------|---------|----------|
| `convex` | current deployment | Notification internalActions, payouts table, ledger | all Convex files |
| `stripe` | `^21.0.0`, API `2025-04-30.basil` | Fee reconciliation (balance-transaction) | `apps/web/lib/stripe/server.ts` |
| `@clerk/nextjs` | installed | JWT guard for payout mutations | `apps/dispatch-control` |
| `packages/emails` (local) | — | `SendEmailProvider` / `selectProvider` seam | `packages/emails/src/provider.ts` |

### Supporting (new for Phase 27)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Slack Incoming Webhook | n/a (plain HTTPS POST) | Operational notifications to Slack | `notify_slack_webhook_url` config key is set |
| `@slack/webhook` (optional) | `^7.x` | Typed Slack webhook client | Only if team prefers typed SDK over raw fetch; raw `fetch` is fine for incoming webhooks |

**Note:** Slack Incoming Webhooks are plain HTTPS POST — no SDK required. The `SlackWebhookProvider` can use the native `fetch` available in Convex's Node environment (`"use node"` internalAction). No additional npm install is necessary unless the planner chooses the typed SDK.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|---------|
| Raw fetch for Slack | `@slack/webhook` npm package | SDK adds typing/retry logic; raw fetch is simpler, no new dep |
| Demand-fetch Stripe fees (Option B) | Store `paymentIntentId` in schema (Option A) | Option B: zero schema migration, works for all existing rows; Option A: cleaner join but requires schema migration for past rows |

---

## Architecture Patterns

### Recommended Project Structure (new files this phase)

```
convex/
├── notifications.ts          # notificationsLedger mutations (idempotency)
├── notificationActions.ts    # internalAction: send email + Slack
├── payouts.ts                # CRUD mutations for payouts table (Clerk-JWT-guarded)
├── finance.ts                # internalQuery: per-issue revenue aggregation + fee fetch
apps/dispatch-control/
├── app/(dashboard)/finance/
│   └── page.tsx              # Replace placeholder — FinanceSummaryCard + IssueRevenueTable + ModelPricingCard
│   └── _components/
│       ├── FinanceSummaryCard.tsx
│       ├── IssueRevenueTable.tsx
│       ├── ModelPricingCard.tsx
│       └── PayoutRow.tsx
├── app/(dashboard)/settings/
│   └── _components/
│       └── NotificationSettings.tsx  # subsection of existing settings page
packages/emails/src/
└── slackProvider.ts          # SlackWebhookProvider implementing SendEmailProvider
```

### Pattern 1: Notification Dispatch (mirror Phase 20 emailActions.ts)

**What:** A mutation that writes run status calls `scheduler.runAfter(0, internal.notificationActions.sendNotification, {runId, eventType})`. The internalAction reads config, checks ledger, and sends.

**When to use:** Any time `pipelineRuns:updateStatus` or a `cost-warning` deliberationEvent is written.

**Trigger seam — runs:updateStatus (existing file):**
```typescript
// convex/pipelineRuns.ts — append to updateStatus handler after ctx.db.patch:
// Phase 27 NTF hook (pipelineConfig.ts:167 marks this seam)
await ctx.scheduler.runAfter(0, internal.notificationActions.sendNotification, {
  runId: args.runId,
  eventType: args.status, // 'complete' | 'failed' | 'awaiting-review'
})
```

**Trigger seam — cost-warning deliberationEvent:**
The budget signal fires from the Python pipeline via `deliberationEvents:insert`. To avoid touching the pipeline, a Convex `crons.ts` sweep (or a hook on `deliberationEvents:insert`) can detect new `cost-warning` rows and dispatch. Alternatively, add a lightweight check inside a post-insert mutation. The planner should decide in §27 contract which seam is cleaner; the `deliberationEvents:insert` mutation is the natural hook.

**notificationActions.ts pattern:**
```typescript
"use node"
// Source pattern: convex/emailActions.ts
export const sendNotification = internalAction({
  args: {
    runId: v.string(),
    eventType: v.string(),  // 'complete' | 'failed' | 'awaiting-review' | 'budget'
    channel: v.union(v.literal('email'), v.literal('slack')),
  },
  handler: async (ctx, { runId, eventType, channel }) => {
    // 1. Idempotency gate: getByKey(runId, eventType, channel)
    const existing = await ctx.runQuery(internal.notifications.getByKey, { runId, eventType, channel })
    if (existing?.status === 'sent') return
    // 2. Fetch config
    const config = await ctx.runQuery(api.pipelineConfig.getAll, { workspace_id })
    // 3. Check enable flag (notify_on_complete, notify_on_failed, etc.)
    // 4. Send via selectProvider(env) or SlackWebhookProvider
    // 5. Mark sent or failed in ledger
  }
})
```

### Pattern 2: SlackWebhookProvider implementing SendEmailProvider

**What:** Slack incoming webhooks accept a JSON POST to a URL. The provider reuses the `SendEmailProvider` interface — treating `subject` as the notification title and `html`-stripped text as the Slack message body.

```typescript
// packages/emails/src/slackProvider.ts
// Source: extends interface from packages/emails/src/provider.ts
export class SlackWebhookProvider implements SendEmailProvider {
  constructor(private webhookUrl: string) {}

  async send(params: SendEmailParams): Promise<{ id: string }> {
    const text = params.subject + '\n' + stripHtml(params.html)
    const res = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),  // or Slack Block Kit blocks
    })
    if (!res.ok) throw new Error(`Slack webhook error: ${res.status}`)
    return { id: `slack-${Date.now()}` }
  }
}
```

**selectProvider extension:**
```typescript
// packages/emails/src/provider.ts — add Slack arm
export function selectSlackProvider(webhookUrl: string): SendEmailProvider {
  return new SlackWebhookProvider(webhookUrl)
}
```

### Pattern 3: Notifications Ledger (mirror emailSends.ts)

**What:** Idempotency table preventing duplicate sends. Keyed on `(runId, eventType, channel)`.

```typescript
// convex/notifications.ts — mirror convex/emailSends.ts pattern
export const getByKey = internalQuery({
  args: { runId: v.string(), eventType: v.string(), channel: v.string() },
  handler: async (ctx, args) =>
    ctx.db.query('notificationsLedger')
      .withIndex('by_runId_eventType_channel',
        q => q.eq('runId', args.runId).eq('eventType', args.eventType).eq('channel', args.channel))
      .first()
})

export const markSent = internalMutation({
  args: { runId: v.string(), eventType: v.string(), channel: v.string(), providerId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db.query('notificationsLedger')
      .withIndex('by_runId_eventType_channel',
        q => q.eq('runId', args.runId).eq('eventType', args.eventType).eq('channel', args.channel))
      .first()
    if (existing) {
      await ctx.db.patch(existing._id, { status: 'sent', providerId: args.providerId, sentAt: Date.now() })
    } else {
      await ctx.db.insert('notificationsLedger', { ...args, status: 'sent', sentAt: Date.now() })
    }
  }
})
```

### Pattern 4: Stripe Fee Reconciliation via sessionId (Option B — recommended)

**What:** For each `stripeOrders` row, retrieve fees on demand using the stored `sessionId`. The Convex internalAction expands to balance_transaction via the Checkout Sessions API.

```typescript
// convex/finance.ts — internalAction (requires "use node" for Stripe SDK)
"use node"
import Stripe from 'stripe'

export const fetchFeeForOrder = internalAction({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }): Promise<number> => {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' })
    // Source: apps/web/lib/stripe/server.ts — existing singleton pattern
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['payment_intent.latest_charge.balance_transaction'],
    })
    const pi = session.payment_intent as Stripe.PaymentIntent | null
    const charge = pi?.latest_charge as Stripe.Charge | null
    const bt = charge?.balance_transaction as Stripe.BalanceTransaction | null
    return bt?.fee ?? 0  // Stripe fee in cents
  }
})
```

**Cache strategy (Claude's discretion):** Cache fetched fee in the `stripeOrders` row itself as `stripeFee: v.optional(v.number())` (additive field). On first view, internalAction fetches and patches; subsequent reads skip the API call. This is a one-time write per order — fees on completed charges do not change.

### Pattern 5: Payout Mutation with Clerk-JWT Guard + Audit Log

**What:** Mirror `convex/pipelineConfig.ts` `setAutoPublish` mutation — guard with Clerk JWT identity, audit log before/after.

```typescript
// convex/payouts.ts
// Source pattern: convex/pipelineConfig.ts setAutoPublish + convex/auditLog.ts write
export const markPayoutSent = mutation({
  args: {
    payoutId: v.id('payouts'),
    reference: v.string(),
    sentAt: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error('Unauthorized')  // Clerk-JWT guard
    const before = await ctx.db.get(args.payoutId)
    if (!before || before.status === 'sent') throw new Error('Payout not found or already sent')
    await ctx.db.patch(args.payoutId, {
      status: 'sent',
      sentAt: args.sentAt,
      reference: args.reference,
      actor: identity.subject,
    })
    // AUD-01 audit log pattern
    await ctx.runMutation(internal.auditLog.write, {
      workspace_id: before.workspace_id,
      actorId: identity.subject,
      action: 'payout:markSent',
      resourceType: 'payouts',
      resourceId: args.payoutId,
      before: JSON.stringify({ status: before.status }),
      after: JSON.stringify({ status: 'sent', reference: args.reference }),
    })
  },
})
```

### Pattern 6: Inline Payout Confirmation (mirror ReviewDecisionPanel.tsx)

**What:** Replace "Mark sent" button with `[Mark as sent] [Keep pending]` pair in-row — no modal. State-driven.

```typescript
// apps/dispatch-control/app/(dashboard)/finance/_components/PayoutRow.tsx
// Source pattern: ReviewDecisionPanel.tsx confirmingAction state + getToken()
const [confirming, setConfirming] = useState(false)
const { getToken } = useAuth()
const markSent = useMutation(api.payouts.markPayoutSent)

// Render: if confirming → show date input + reference input + [Confirm] [Cancel]
// else → show [Mark sent] button
```

### Anti-Patterns to Avoid

- **Notifying from the pipeline (Python):** D-01 is explicit — no new egress from Railway. All sends are Convex internalActions.
- **Adding new `deliberationEvents.eventType` literals without §27 contract amendment:** The union is frozen. `cost-warning` already covers D-04; reuse it.
- **Renaming or removing `stripeOrders` fields:** The table shape is frozen (D-14). Add `stripeFee: v.optional(v.number())` only as additive caching.
- **Using the Stripe secret key from `dispatch-control`:** Stripe key is only in `apps/web` env. The Convex internalAction runs in Convex's node environment and must read `STRIPE_SECRET_KEY` from Convex environment variables (set via `npx convex env set`).
- **Building a real-time polling loop for fee data:** Fetch once, cache in `stripeOrders.stripeFee`, render cached value — avoid repeated Stripe API calls.

---

## Critical Gap: Missing `paymentIntentId` in stripeOrders

**What goes wrong:** D-08 specifies fees from "balance-transaction per `payment_intent`". The `stripeOrders` schema (confirmed at `convex/schema.ts:134-159`) has no `paymentIntentId` field. The webhook handler (`apps/web/lib/stripe/handlers.ts:95-122`) does not capture `session.payment_intent` when writing the order row.

**Two valid resolutions (planner must choose before API_CONTRACTS §27):**

**Option A — Additive schema (`paymentIntentId` field):**
- Add `paymentIntentId: v.optional(v.string())` to `stripeOrders` schema (additive — allowed by D-14)
- Update `maybeRecordOrder` in `handlers.ts` to capture `session.payment_intent` on new orders
- Past orders have no `paymentIntentId` → fee shown as "—" until re-paid; not a concern for test-mode orders
- Pro: cleaner — join directly on `payment_intent` for balance-transaction fetch
- Con: new orders only; past rows missing the field

**Option B — Retrieve via sessionId (recommended):**
- `sessionId` IS stored and IS the session ID; call `stripe.checkout.sessions.retrieve(sessionId, {expand: ['payment_intent.latest_charge.balance_transaction']})` to get the fee
- No schema change required, works for ALL existing `stripeOrders` rows (including past ones)
- Pro: zero migration; works immediately for historical data
- Con: one extra Stripe API call per order (mitigated by caching `stripeFee` additively)

**Recommendation:** Option B. Cache the fetched fee as `stripeFee: v.optional(v.number())` (additive field). This resolves the gap without migration and works for historical rows.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email idempotency | Custom dedup | Mirror `convex/emailSends.ts` pattern | Already battle-tested; `getByKey` + `markSent` + `markFailed` internalMutations are the template |
| Slack HTTP client | Custom HTTP wrapper | Plain `fetch` inside `"use node"` internalAction | Slack incoming webhooks are trivial HTTPS POST; no SDK needed |
| Stripe fee fetch | Custom API client | Existing `stripe@^21.0.0` singleton pattern from `lib/stripe/server.ts` | Same SDK, same API version pin (`2025-04-30.basil`) |
| Clerk-JWT guard | Custom auth | `ctx.auth.getUserIdentity()` already used in Phase 26 mutations | Already the project pattern; see `convex/pipelineConfig.ts` |
| Audit log | Custom write | `await ctx.runMutation(internal.auditLog.write, {...})` | AUD-01 pattern already in place at `convex/auditLog.ts` |
| Config reads | Custom KV store | `api.pipelineConfig.getAll` + JSON.parse (see `BudgetAlertBanner.tsx:34-39`) | `pipeline_config` table is the canonical config store |
| Finance table styling | Custom CSS | Mirror `RunsTable.tsx` — `overflow-x-auto rounded-lg border border-neutral-200 bg-white`, `w-full text-sm` | Project uses shadcn neutral preset; RunsTable is the reference |

---

## Common Pitfalls

### Pitfall 1: Firing notifications from pipeline Python code
**What goes wrong:** Python adds an HTTP call to Resend/Slack inside a pipeline agent.
**Why it happens:** Pipeline already knows run status — seems natural.
**How to avoid:** D-01 is explicit: all notification transport is Convex-side. The pipeline only writes to Convex; Convex dispatches notifications.
**Warning signs:** Any `requests.post` or `httpx.post` to Resend/Slack URLs in `packages/pipeline/`.

### Pitfall 2: Adding new deliberationEvents.eventType literal without contract amendment
**What goes wrong:** Schema validation error or frozen-union breakage across all consumers.
**Why it happens:** Budget notification seems to need a new event type.
**How to avoid:** `cost-warning` is already in the union and already emitted by the pipeline. Reuse it. If genuinely new event types are needed, amend API_CONTRACTS §27 first.
**Warning signs:** Any new string literal added to the `eventType` union in `convex/schema.ts`.

### Pitfall 3: Reading `STRIPE_SECRET_KEY` from `dispatch-control`
**What goes wrong:** Stripe key is not in `dispatch-control`'s env; fee fetch silently fails.
**Why it happens:** `dispatch-control` has Clerk keys but not Stripe keys (confirmed from `.env.example`).
**How to avoid:** The Stripe fee fetch runs in a Convex internalAction. Set `STRIPE_SECRET_KEY` as a Convex environment variable (`npx convex env set STRIPE_SECRET_KEY sk_test_...`), not in any Next.js app.
**Warning signs:** `process.env.STRIPE_SECRET_KEY` referenced in any `dispatch-control/` file.

### Pitfall 4: Blocking the updateStatus mutation with notification sends
**What goes wrong:** A Resend or Slack HTTP timeout (up to 30s) wedges the run status write, causing pipeline to hang.
**Why it happens:** Calling the provider directly inside the mutation instead of via scheduler.
**How to avoid:** Always dispatch via `scheduler.runAfter(0, internal.notificationActions.sendNotification, args)`. The mutation returns before the HTTP call starts.
**Warning signs:** Any direct `fetch`/provider call inside a `mutation()` handler.

### Pitfall 5: charitySlug → issue attribution for the latest (open-window) issue
**What goes wrong:** The "latest" issue has no next issue, so the window has no upper bound.
**Why it happens:** Sales-window logic `createdAt < nextIssuePublishedAt` fails when `nextIssuePublishedAt` is null.
**How to avoid:** Treat `nextIssuePublishedAt ?? Date.now()` as the window end for the latest issue (shows "current window" revenue). Planner should document this in §27 contract.
**Warning signs:** Any query that filters `createdAt < nextIssuePublishedAt` without a null guard.

### Pitfall 6: Notifications ledger per-channel, not per-send-attempt
**What goes wrong:** Two concurrent scheduler jobs both pass the idempotency gate (race condition) and send duplicate notifications.
**Why it happens:** Convex mutations are serialized per document, but two separate ledger insert attempts can race if the ledger row doesn't exist yet.
**How to avoid:** Write the ledger row with status `'queued'` inside the *mutation* (before scheduling), then the internalAction checks for `'queued'`/`'sent'`. This is the same pattern as `emailSends.ts` `insertScheduled` (a separate internalMutation called from the dispatch mutation). Mirror exactly.

### Pitfall 7: Payout mutation without audit log
**What goes wrong:** RCN-02 requires auditability; payout state change with no log breaks the "100% of proceeds" audit trail.
**Why it happens:** Forgetting to call `internal.auditLog.write` after `ctx.db.patch`.
**How to avoid:** Every payout write (markSent, revertToPending if needed) calls `internal.auditLog.write` with before/after JSON.

---

## Code Examples

### Existing SendEmailProvider Interface (HIGH confidence — direct file read)

```typescript
// Source: packages/emails/src/provider.ts (exact shape)
export interface SendEmailParams {
  from: string
  to: string
  subject: string
  html: string
  headers?: Record<string, string>
}
export interface SendEmailProvider {
  send(params: SendEmailParams): Promise<{ id: string }>
}
export function selectProvider(env: ProviderEnv): SendEmailProvider
// Live sending ON only when EMAIL_LIVE_SEND==='true' AND RESEND_API_KEY present
```

### Existing emailActions.ts internalAction dispatch (HIGH confidence — direct file read)

```typescript
// Source: convex/emailActions.ts — pattern for notificationActions.ts
"use node"
export const sendEmailStep = internalAction({
  args: { orderId: v.id('stripeOrders'), step: v.number() },
  handler: async (ctx, { orderId, step }) => {
    // 1. Idempotency gate via ctx.runQuery
    // 2. Fetch data via ctx.runQuery
    // 3. Send via provider
    // 4. Mark sent/failed via ctx.runMutation
  }
})
// Dispatch from mutation: await ctx.scheduler.runAfter(0, internal.emailActions.sendEmailStep, args)
```

### Existing auditLog.write signature (HIGH confidence — direct file read)

```typescript
// Source: convex/auditLog.ts (internalMutation)
// Called via: await ctx.runMutation(internal.auditLog.write, {...})
{
  workspace_id: string,   // required
  actorId: string,        // required — Clerk subject
  action: string,         // required — e.g. 'payout:markSent'
  resourceType?: string,  // optional
  resourceId?: string,    // optional
  before?: string,        // optional — JSON.stringify(beforeState)
  after?: string,         // optional — JSON.stringify(afterState)
  // timestamp injected server-side
}
```

### pipeline_config config read pattern (HIGH confidence — BudgetAlertBanner.tsx:34-39)

```typescript
// Source: apps/dispatch-control/app/(dashboard)/runs/_components/BudgetAlertBanner.tsx
const configRows = useQuery(api.pipelineConfig.getAll, { workspace_id })
const configMap: Record<string, unknown> = {}
for (const row of configRows) {
  try { configMap[row.key] = JSON.parse(row.value) }
  catch { configMap[row.key] = row.value }
}
// Access: const notifyEmail = configMap['notify_email'] as string | undefined
```

### Existing pipelineConfig.ts upsert + audit log (HIGH confidence — direct file read)

```typescript
// Source: convex/pipelineConfig.ts setAutoPublish mutation
// Pattern for notification config write mutations:
const identity = await ctx.auth.getUserIdentity()
if (!identity) throw new Error('Unauthorized')
await ctx.runMutation(internal.pipelineConfig.upsert, {
  workspace_id, key: 'notify_email', value: JSON.stringify(email), updatedBy: identity.subject,
})
await ctx.runMutation(internal.auditLog.write, {
  workspace_id, actorId: identity.subject, action: 'config:set:notify_email',
  resourceType: 'pipeline_config', after: JSON.stringify({ notify_email: email }),
})
```

### Stripe fee fetch via sessionId (HIGH confidence — API_CONTRACTS §6 + sdk version confirmed)

```typescript
// Source: Stripe SDK pattern; API version from apps/web/lib/stripe/server.ts
// Run inside "use node" internalAction only
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' })
const session = await stripe.checkout.sessions.retrieve(sessionId, {
  expand: ['payment_intent.latest_charge.balance_transaction'],
})
const fee = (
  (session.payment_intent as Stripe.PaymentIntent)
    ?.latest_charge as Stripe.Charge
)?.balance_transaction as Stripe.BalanceTransaction
return fee?.fee ?? 0  // Stripe fee in smallest currency unit (cents)
```

### Status badge colors (HIGH confidence — confirmed UI-SPEC + RunsTable.tsx:39-45)

```typescript
// Payout status badges — from 27-UI-SPEC.md STATUS_CLASSES
const PAYOUT_STATUS_CLASSES: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  sent:    'bg-green-100 text-green-800',
}
// Model pricing staleness badge
// bg-amber-50 border border-amber-200 text-amber-800
// Show when: Date.now() - row.updatedAt > 30 * 24 * 60 * 60 * 1000
```

### Additive schema additions required (HIGH confidence — confirmed against existing schema)

```typescript
// convex/schema.ts — new tables (additive only, per D-14)

// notificationsLedger table
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

// payouts table
payouts: defineTable({
  workspace_id: v.string(),
  issueNumber: v.number(),
  issueId: v.optional(v.string()),   // Sanity weeklyIssue._id
  charitySlug: v.string(),
  amount: v.number(),               // net-to-charity in cents (from donationAmount sum)
  status: v.union(v.literal('pending'), v.literal('sent')),
  sentAt: v.optional(v.number()),
  reference: v.optional(v.string()),
  actor: v.optional(v.string()),    // Clerk subject of operator who marked sent
  createdAt: v.number(),
  updatedAt: v.number(),
}).index('by_workspace_issueNumber', ['workspace_id', 'issueNumber'])
  .index('by_workspace_status', ['workspace_id', 'status']),

// stripeOrders — ADDITIVE ONLY (no renames)
// Add optional fields to stripeOrders table:
// stripeFee: v.optional(v.number())   — cached Stripe fee in cents
// NOTE: Only add after §27 API_CONTRACTS specifies this field
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Poll for notification status | Event-driven `scheduler.runAfter` | Phase 20 established | Zero-latency dispatch; mutation non-blocking |
| Ad-hoc Stripe API calls | Singleton `getStripeServer()` + API version pin | Phase 8 | Consistent versioned client across all Stripe calls |
| Manual audit trail | `auditLog:write` internalMutation (AUD-01) | Phase 21+ | Every operator write auto-logged; query via `by_workspace_timestamp` index |

**No deprecated approaches found:** The Phase 20 email architecture is current and this phase extends it rather than replacing it.

---

## Open Questions

1. **Notifications ledger: own table or folded into events?**
   - What we know: `emailSends` is its own table; `deliberationEvents` is its own table. D-07 says "mirror `emailSends` idempotency pattern."
   - What's unclear: Whether the planner wants a single unified `notificationsLedger` table or reuses `emailSends` with new `step` values.
   - Recommendation: Own table (`notificationsLedger`) — cleaner separation; `emailSends` is keyed on `orderId` not `runId`.

2. **Budget threshold notification trigger seam**
   - What we know: `cost-warning` deliberationEvent is written by the pipeline. The pipeline calls `deliberationEvents:insert` mutation. That mutation could dispatch the notification scheduler.
   - What's unclear: Whether to hook into `deliberationEvents:insert` or use a cron sweep.
   - Recommendation: Hook into `deliberationEvents:insert` — filter `eventType === 'cost-warning'`, dispatch `scheduler.runAfter(0, internal.notificationActions.sendNotification, {runId, eventType: 'budget', channel})`. This is instant (no cron lag) and mirrors D-04.

3. **Stripe key in Convex environment**
   - What we know: `STRIPE_SECRET_KEY` is in `apps/web/.env.local`. Convex internalActions run in Convex's cloud, not in Next.js.
   - What's unclear: Whether `STRIPE_SECRET_KEY` has already been added to the Convex deployment environment.
   - Recommendation: Wave 0 task — verify with `npx convex env list`, set if absent.

4. **Sales window attribution for the current (open) issue**
   - What we know: Attribution uses `createdAt` between current issue publish and next issue publish. Latest issue has no next.
   - What's unclear: Whether to show "current window" open-ended or only aggregate closed windows.
   - Recommendation: Use `nextIssuePublishedAt ?? Date.now()` as upper bound. Planner documents in §27 contract.

5. **STRIPE_SECRET_KEY API version for Convex vs apps/web**
   - What we know: `apps/web/lib/stripe/server.ts` uses `'2025-04-30.basil'`.
   - What's unclear: Whether the same API version pin should be hardcoded in the Convex finance internalAction.
   - Recommendation: Yes — use `'2025-04-30.basil'` in the Convex internalAction to match the project's pinned version.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `stripe` npm package | Fee reconciliation internalAction | ✓ | `^21.0.0` (in `apps/web/package.json`) | — |
| `STRIPE_SECRET_KEY` in Convex env | Fee reconciliation internalAction | Unknown — must verify | — | Task in Wave 0: `npx convex env set STRIPE_SECRET_KEY` |
| `RESEND_API_KEY` in Convex env | Email notifications | Unknown — was set for Phase 20 web env, but Convex env is separate | — | `EMAIL_LIVE_SEND` guard + FakeEmailProvider fallback already in `selectProvider` |
| Slack incoming webhook URL | Slack notifications | Not yet configured | — | System degrades gracefully: `notify_slack_webhook_url` config key absent → channel skipped |
| `notify_email` config key in `pipeline_config` | Email notification routing | Not yet configured | — | Graceful: absent key → skip email send |
| Convex deployment (`modest-magpie-797`) | All Convex mutations | ✓ | Deployed | — |

**Missing dependencies with no fallback:**
- `STRIPE_SECRET_KEY` in Convex environment — if absent, fee fetch internalAction fails. Must be set before testing reconciliation. Wave 0 task.

**Missing dependencies with fallback:**
- `RESEND_API_KEY` in Convex env — `selectProvider` falls back to `FakeEmailProvider` (logs only). Feature works in test mode.
- Slack webhook URL — config-absent check in notificationActions handler; skip cleanly.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest ^3.2.0 |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/web && npx vitest run --reporter=dot` |
| Full suite command | `cd apps/web && npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RCN-01 | Stripe fee aggregation logic (gross - fee = net) | unit | `cd apps/web && npx vitest run __tests__/stripe-reconciliation.test.ts -x` | ❌ Wave 0 |
| RCN-01 | Sales-window order attribution (charitySlug + createdAt) | unit | `cd apps/web && npx vitest run __tests__/stripe-reconciliation.test.ts -x` | ❌ Wave 0 |
| RCN-02 | Payout status mutation (markSent with audit log) | integration (Convex) | manual / Convex dashboard | ❌ Wave 0 |
| NTF-01 | Notification dispatch does not fire when config flag off | unit | `cd apps/web && npx vitest run __tests__/notifications-ledger.test.ts -x` | ❌ Wave 0 |
| NTF-01 | Idempotency: second dispatch for same runId+eventType+channel is a no-op | unit | `cd apps/web && npx vitest run __tests__/notifications-ledger.test.ts -x` | ❌ Wave 0 |
| NTF-02 | Budget notification trigger reads cost-warning eventType correctly | unit | `cd apps/web && npx vitest run __tests__/notifications-ledger.test.ts -x` | ❌ Wave 0 |
| D-13 | Staleness badge shows when updatedAt > 30 days ago | unit | `cd apps/web && npx vitest run __tests__/model-pricing-staleness.test.ts -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/web && npx vitest run --reporter=dot` (fast — skip Convex integration tests)
- **Per wave merge:** `cd apps/web && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/__tests__/stripe-reconciliation.test.ts` — covers RCN-01 gross/net/fee aggregation + sales-window attribution logic
- [ ] `apps/web/__tests__/notifications-ledger.test.ts` — covers NTF-01/NTF-02 idempotency gate, flag-off skip, channel dispatch logic
- [ ] `apps/web/__tests__/model-pricing-staleness.test.ts` — covers D-13 staleness computation (30-day threshold)
- [ ] Verify `STRIPE_SECRET_KEY` in Convex env: `npx convex env list`

---

## Sources

### Primary (HIGH confidence — code read directly)

- `convex/schema.ts` — `stripeOrders` (134-159), `model_pricing` (341-349), `emailSends` (174-195), `audit_log` (239-250), `pipeline_config` (284-292), `deliberationEvents` (29-49), `runs` (222-236)
- `convex/emailActions.ts` — internalAction pattern, scheduler.runAfter dispatch, idempotency gate
- `convex/emailSends.ts` — full idempotency ledger: `getByOrderStep`, `insertScheduled`, `markSent`, `markFailed`, `markSkipped`
- `convex/pipelineConfig.ts` — `setAutoPublish` (Clerk-JWT guard + audit log pattern), line 167 Phase 27 NTF hook comment
- `convex/auditLog.ts` — `write` internalMutation signature
- `convex/pipelineRuns.ts` — `updateStatus` mutation args (complete, failed, awaiting-review, running)
- `convex/stripeOrders.ts` — `insert` mutation args; confirms no `paymentIntentId`
- `packages/emails/src/provider.ts` — `SendEmailProvider`, `SendEmailParams`, `selectProvider(env)` interface
- `apps/web/lib/stripe/server.ts` — `getStripeServer()` singleton, `stripe@^21.0.0`, `'2025-04-30.basil'`
- `apps/web/lib/stripe/handlers.ts` — `maybeRecordOrder` — confirms `session.payment_intent` NOT captured
- `apps/dispatch-control/app/(dashboard)/runs/_components/BudgetAlertBanner.tsx` — `pipeline_config` read pattern, amber badge classes
- `apps/dispatch-control/app/(dashboard)/runs/_components/RunsTable.tsx` — STATUS_CLASSES, table styling
- `apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` — inline confirmation pattern (state-driven, no modal)
- `apps/dispatch-control/app/(dashboard)/finance/page.tsx` — placeholder to replace (14-line stub)
- `apps/dispatch-control/app/(dashboard)/settings/page.tsx` — `force-dynamic`, `getCurrentWorkspace()` pattern
- `apps/dispatch-control/.env.example` — confirms NO Stripe keys in dispatch-control
- `apps/dispatch-control/lib/reviewClient.ts` — Clerk Bearer token pattern for dashboard fetch calls
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` — `cost-warning` deliberationEvent emission (lines 306-326)
- `packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py` — `pipelineRuns:updateStatus` call patterns for complete/failed/awaiting-review
- `docs/API_CONTRACTS.md` — current end (line 2229); §27 does not yet exist (confirmed)
- `.planning/phases/27-money-notifications/27-CONTEXT.md` — all locked decisions D-01 through D-15
- `.planning/phases/27-money-notifications/27-UI-SPEC.md` — STATUS_CLASSES, finance page sections, settings subsection spec
- `.planning/REQUIREMENTS.md` — RCN-01, RCN-02, NTF-01, NTF-02 exact text

### Secondary (MEDIUM confidence)

- Slack Incoming Webhooks docs (from training): simple HTTPS POST to webhook URL with `{"text": "..."}` body — no SDK required, any `fetch` call works

### Tertiary (LOW confidence)

- None — all findings based on direct code reads

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — version numbers confirmed from package.json and existing source files
- Architecture patterns: HIGH — all patterns derived from existing working code in the project
- Critical gap (paymentIntentId): HIGH — confirmed by reading both schema.ts and handlers.ts
- Pitfalls: HIGH — derived from existing project constraints and code patterns
- Validation architecture: MEDIUM — test file names are proposed (Wave 0 gaps); framework/runner confirmed

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (30 days — stable Stripe SDK, Convex schema frozen by discipline)
