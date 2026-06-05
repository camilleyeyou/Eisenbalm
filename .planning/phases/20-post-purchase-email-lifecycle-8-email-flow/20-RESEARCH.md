# Phase 20: Post-Purchase Email Lifecycle (8-email flow) — Research

**Researched:** 2026-06-05
**Domain:** Convex scheduled functions · Resend · React Email · CAN-SPAM / Gmail/Yahoo 2024 compliance
**Confidence:** HIGH (Convex scheduling, React Email render, Resend headers) / MEDIUM (testability patterns, Convex cron sweep for email) / LOW (Convex cancel-on-unsubscribe exact API edge cases)

---

## Summary

Phase 20 wires an 8-email post-purchase lifecycle directly onto the Convex `stripeOrders` table that Phase 8 already populates. The architecture is fully settled: Convex mutations schedule `internalAction` calls via `ctx.scheduler.runAfter`; the actions render React Email templates to HTML, call Resend, and write an idempotency record to a new `emailSends` ledger table before and after each send. Two new Convex tables (`emailSubscribers`, `emailSends`) extend the existing schema. Template code lives in `apps/web/emails/` and is imported from Convex actions via a shared render helper. A Next.js HTTP action route handles one-click unsubscribe. No Convex mutations can call Resend directly — only `internalAction` functions can make external HTTP calls.

**Primary recommendation:** Use `internalAction` (with `"use node"` for Node.js crypto compatibility) for every Resend call, scheduled from a single `enqueueEmailFlow` internal mutation that fires immediately after the `stripeOrders.insert` succeeds. Store one scheduled-function ID per step in `emailSends` so that `ctx.scheduler.cancel(scheduledFnId)` can short-circuit all remaining marketing steps on unsubscribe.

---

<user_constraints>
## User Constraints (from CLAUDE.md / BRIEF — no CONTEXT.md for this phase)

### Locked Decisions
- Architecture: IN-HOUSE. React Email templates in `apps/web`, Convex scheduled functions (`scheduler.runAfter` + cron sweep) as timer, Resend as delivery provider. No third-party ESP.
- Timing: PURCHASE-ANCHORED for v1. Offsets: E1 +0, E2 +1d, E3 +4d, E4 +7d, E5 +9d, E6 +14d, E7 +21d, E8 +42d.
- Scope: ALL 8 emails in this phase.
- Emails 1-3 transactional; 4-8 marketing.
- Marketing emails carry one-click List-Unsubscribe + List-Unsubscribe-Post headers + CAN-SPAM postal footer.
- Separate sending subdomains recommended: `receipts.` (transactional) vs `dispatch.` (marketing).
- Unsubscribe suppresses emails 4-8 only; emails 1-3 continue.
- `emailSubscribers` + `emailSends` tables added to Convex schema.
- `emailSends` is IDEMPOTENT — never double-send a step.
- Flow enqueued when `checkout.session.completed` order recorded (existing webhook → existing `stripeOrders` → new enqueue).
- Next.js route `GET/POST /api/email/unsubscribe?token=...`.
- Email 2: NO live tracking number — deadpan "handed to the carrier" copy.
- Email 3: Delivery-ESTIMATE copy — must NEVER claim verified delivery.
- Emails 1-6 footer: the specific charity that order funded (charitySlug → Sanity charity doc).
- Email 7: 2-3 OTHER recently-featured charities (not the buyer's funded charity).
- Email 8: Live "funded N more since you bought" count from `weeklyIssue` docs published after `order.createdAt`.

### Claude's Discretion
- How to model `emailSends` schema fields precisely (step index vs step name, scheduledFnId nullable, etc.).
- Where the Resend send call originates (Convex internalAction vs Next.js route called by Convex).
- Provider abstraction / dry-run mode design for testability.
- GROQ query shapes for Email 7 (other charities) and Email 8 (issue count).
- Exact cron sweep frequency for catching failed/missed sends.
- Whether to co-locate email templates in `apps/web/emails/` or a separate package.

### Deferred Ideas (OUT OF SCOPE)
- Actually sending the weekly charity newsletter that Email 7 opts into (v1 only captures subscriber + consent).
- Real carrier tracking for delivered-based timing — later upgrade.
- Automated unsubscribe honor period enforcement beyond 48 hours (Resend suppression list handles this at provider level).
</user_constraints>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `resend` | 6.12.4 | Email delivery API client | Chosen provider per BRIEF; TypeScript-first, React Email native integration |
| `@react-email/render` | 2.0.8 | Render JSX email component → HTML string | Official renderer; `render()` is now async (replaces deprecated `renderAsync`) |
| `@react-email/components` | 1.0.12 | Pre-built email primitives (Html, Head, Body, Text, Link, Hr, etc.) | Inbox-compatible cross-client building blocks |
| `convex` | 1.38.0 | Already installed — `internalAction`, `internalMutation`, `ctx.scheduler` | Already in monorepo at this exact version |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@react-email/tailwind` | latest (~^0.1.0) | Tailwind-in-email utility (optional) | Only if templates need utility classes; may add bundle size; verify before committing |
| `crypto` (Node built-in) | — | Token generation for `unsubscribeToken` | Built into Node.js; `"use node"` directive in Convex action gives access |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Convex `internalAction` for Resend call | Next.js API route called by Convex via HTTP | Convex action is simpler (no round-trip), actions run in Convex's own environment; the Next.js route option adds a second Vercel function cold-start and breaks atomic scheduling |
| `scheduler.runAfter` per step | Single cron sweep querying `emailSends` for pending sends | `runAfter` is more predictable and cancellable per order; cron sweep is a fallback/retry safety net, not the primary mechanism |

**Installation (apps/web):**
```bash
pnpm --filter web add resend @react-email/render @react-email/components
```

**Version verification (confirmed 2026-06-05):**
```bash
npm view resend version          # 6.12.4
npm view @react-email/render version   # 2.0.8
npm view @react-email/components version # 1.0.12
```

---

## Architecture Patterns

### Recommended Project Structure
```
apps/web/
├── emails/                      # React Email templates
│   ├── lib/
│   │   └── render.ts            # shared render(template, props) → html wrapper
│   ├── OrderConfirmation.tsx    # E1
│   ├── Shipping.tsx             # E2
│   ├── DeliveredEstimate.tsx    # E3
│   ├── TheRitual.tsx            # E4
│   ├── CharityReceipt.tsx       # E5 (full-screen charity story)
│   ├── ReviewAsk.tsx            # E6
│   ├── NewsletterOptin.tsx      # E7
│   └── Replenishment.tsx        # E8
│
convex/
├── schema.ts                    # extend with emailSubscribers + emailSends tables
├── emailSubscribers.ts          # query + mutation: upsert, getByEmail, unsubscribe
├── emailSends.ts                # query + mutation: claim (idempotent), markSent, markFailed
├── emailFlow.ts                 # internalMutation: enqueueEmailFlow (schedules 8 steps)
├── emailActions.ts              # internalAction "use node": sendEmailStep(orderId, step)
└── crons.ts                     # cron sweep: retry failed/stuck email steps
│
apps/web/app/api/email/
└── unsubscribe/
    └── route.ts                 # GET/POST ?token=... (one-click unsubscribe handler)
```

### Pattern 1: Mutation → internalAction for external sends

**What:** Convex mutations cannot call Resend (no external HTTP in mutations). Only `internalAction` can call external services. The pattern is: mutation writes to DB + schedules internalAction; the action calls Resend and writes the result back via `ctx.runMutation`.

**When to use:** Every email send in this phase.

```typescript
// convex/emailFlow.ts
import { internalMutation } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

const OFFSETS_MS = [
  0,                    // E1: Order confirmation
  1  * 24 * 3600_000,  // E2: Shipping
  4  * 24 * 3600_000,  // E3: Delivered estimate
  7  * 24 * 3600_000,  // E4: The ritual
  9  * 24 * 3600_000,  // E5: Charity receipt
  14 * 24 * 3600_000,  // E6: Review ask
  21 * 24 * 3600_000,  // E7: Newsletter opt-in
  42 * 24 * 3600_000,  // E8: Replenishment
] as const

export const enqueueEmailFlow = internalMutation({
  args: { orderId: v.id('stripeOrders') },
  handler: async (ctx, { orderId }) => {
    const order = await ctx.db.get(orderId)
    if (!order?.customerEmail) return  // no email address — skip silently

    for (let step = 1; step <= 8; step++) {
      const scheduledFnId = await ctx.scheduler.runAfter(
        OFFSETS_MS[step - 1],
        internal.emailActions.sendEmailStep,
        { orderId, step },
      )
      // Record the pending send with the scheduled function ID for cancellation
      await ctx.db.insert('emailSends', {
        orderId,
        email: order.customerEmail,
        step,
        status: 'scheduled',
        scheduledFnId: scheduledFnId as string,
        createdAt: Date.now(),
      })
    }
  },
})
```

### Pattern 2: Idempotent send via `emailSends` ledger

**What:** Before calling Resend, the action checks whether a row for `(orderId, step)` with `status === 'sent'` already exists. If yes — skip. This is the idempotency guard.

**When to use:** Inside `sendEmailStep` before every Resend call.

```typescript
// convex/emailActions.ts
"use node"  // required for Node crypto (unsubscribeToken generation)
import { internalAction } from './_generated/server'
import { internal } from './_generated/api'
import { v } from 'convex/values'

export const sendEmailStep = internalAction({
  args: { orderId: v.id('stripeOrders'), step: v.number() },
  handler: async (ctx, { orderId, step }) => {
    // 1. Idempotency: abort if already sent
    const existing = await ctx.runQuery(internal.emailSends.getByOrderStep, { orderId, step })
    if (existing?.status === 'sent') return

    // 2. Load order + subscriber state
    const order = await ctx.runQuery(internal.emailSends.getOrder, { orderId })
    if (!order?.customerEmail) return

    // 3. Check marketing suppression for steps 4-8
    if (step >= 4) {
      const subscriber = await ctx.runQuery(
        internal.emailSubscribers.getByEmail, { email: order.customerEmail }
      )
      if (subscriber?.consentState === 'unsubscribed') return
    }

    // 4. Resolve charity data from Sanity (via fetch — actions can use fetch)
    const charityData = await fetchCharityFromSanity(order.charitySlug)

    // 5. Render and send
    const html = await renderTemplate(step, { order, charityData, ... })
    const result = await resend.emails.send({
      from: step <= 3 ? 'receipts@receipts.eisenbalm.com' : 'dispatch@dispatch.eisenbalm.com',
      to: order.customerEmail,
      subject: SUBJECTS[step],
      html,
      headers: step >= 4 ? {
        'List-Unsubscribe': `<https://eisenbalm.com/api/email/unsubscribe?token=${subscriber.unsubscribeToken}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      } : {},
    })

    // 6. Write result back via mutation
    await ctx.runMutation(internal.emailSends.markSent, {
      orderId, step, providerMessageId: result.data?.id ?? '',
    })
  },
})
```

### Pattern 3: Unsubscribe cancellation

**What:** When a user unsubscribes, mark `emailSubscribers.consentState = 'unsubscribed'`, then call `ctx.scheduler.cancel(scheduledFnId)` for each pending marketing step (steps 4-8) that has a `scheduledFnId` stored in `emailSends`.

**Critical:** `ctx.scheduler.cancel` only works from within a mutation or action. The unsubscribe HTTP route must call a Convex mutation that performs the cancellations.

```typescript
// convex/emailSubscribers.ts (excerpt)
export const unsubscribeByToken = internalMutation({
  args: { token: v.string() },
  handler: async (ctx, { token }) => {
    const sub = await ctx.db
      .query('emailSubscribers')
      .withIndex('by_token', q => q.eq('unsubscribeToken', token))
      .first()
    if (!sub) return { ok: false }

    await ctx.db.patch(sub._id, {
      consentState: 'unsubscribed',
      unsubscribedAt: Date.now(),
    })

    // Cancel all pending scheduled marketing steps for this email
    const pendingSteps = await ctx.db
      .query('emailSends')
      .withIndex('by_email_step', q => q.eq('email', sub.email))
      .filter(q => q.and(
        q.gte(q.field('step'), 4),
        q.eq(q.field('status'), 'scheduled'),
      ))
      .collect()

    for (const send of pendingSteps) {
      if (send.scheduledFnId) {
        await ctx.scheduler.cancel(send.scheduledFnId as any)
        await ctx.db.patch(send._id, { status: 'cancelled' })
      }
    }
    return { ok: true }
  },
})
```

### Pattern 4: GROQ fetches inside Convex actions

Convex actions can use `fetch` to call the Sanity CDN API directly. This avoids a round-trip through Next.js and keeps the email data resolution inside the action.

```typescript
// Inside sendEmailStep action:
async function fetchCharityFromSanity(charitySlug: string | undefined) {
  if (!charitySlug) return null
  const query = encodeURIComponent(
    `*[_type == "charity" && slug.current == "${charitySlug}"][0]{name, location, focusArea, missionStatement}`
  )
  const url = `https://${process.env.NEXT_PUBLIC_SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/production?query=${query}`
  const res = await fetch(url)  // actions can use fetch()
  const data = await res.json()
  return data.result
}
```

### Pattern 5: Enqueue hook in existing Stripe webhook

The enqueue must happen AFTER `stripeOrders.insert` succeeds without changing the existing API contract. The existing `maybeRecordOrder` in `apps/web/lib/stripe/handlers.ts` calls `api.stripeOrders.insert` then returns. The new flow: after the insert succeeds, call a second mutation `api.emailFlow.enqueueEmailFlowPublic` (a public mutation that wraps the internal one) passing the `orderId` returned from insert.

Alternatively: extend `stripeOrders.insert` to call `enqueueEmailFlow` internally. This is the cleaner option — single Convex call from the webhook handler, no additional HTTP round-trip.

```typescript
// convex/stripeOrders.ts — extend the existing insert mutation
export const insert = mutation({
  args: { /* existing args */ },
  handler: async (ctx, args) => {
    const orderId = await ctx.db.insert('stripeOrders', {
      ...args,
      createdAt: Date.now(),
    })
    // Immediately enqueue email flow if customerEmail is present
    await ctx.scheduler.runAfter(0, internal.emailFlow.enqueueEmailFlow, { orderId })
    return orderId
  },
})
```

This is the recommended approach: zero changes to `apps/web/lib/stripe/handlers.ts`, zero changes to the webhook route, zero changes to `API_CONTRACTS.md` §6.

### Anti-Patterns to Avoid
- **Calling Resend from a Convex mutation:** Mutations cannot make external HTTP calls. Resend must be called from an `internalAction`.
- **Not storing `scheduledFnId`:** Without storing the Convex scheduled function ID in `emailSends`, there is no way to cancel individual pending steps on unsubscribe.
- **Marketing headers on transactional emails:** Do NOT add `List-Unsubscribe` headers to E1-E3. This can trigger spam filtering for receipts.
- **Using the same sending subdomain for transactional and marketing:** Promo complaints kill receipt deliverability. Separate subdomains from day one.
- **`ctx.db` in actions:** Actions cannot access `ctx.db` directly. All DB reads must use `ctx.runQuery(internal.x.y, args)` and writes must use `ctx.runMutation(internal.x.y, args)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email rendering to HTML | Custom HTML string builder | `@react-email/render` | Inline CSS inlining, table-based layout, Outlook compat — thousands of edge cases |
| Unsubscribe token generation | Custom hash | `crypto.randomBytes(32).toString('hex')` (Node built-in) | UUID or random hex is secure enough; no dependency needed |
| Resend API client | Direct `fetch` to `api.resend.com` | `resend` npm package | Type-safe, error handling, rate-limit detection already built in |
| DMARC / SPF / DKIM | DNS zone file construction | Resend dashboard guided setup | DNS records are configured in the sending domain's DNS, not in code |
| Complaint-rate monitoring | Custom bounce/complaint tracking | Resend dashboard webhooks (future) | Resend surfaces these metrics natively; v1 does not need custom tracking |

**Key insight:** The entire email infrastructure in this phase is plumbing — schema, scheduling, render, send, suppress. None of those primitives should be written from scratch.

---

## Data Model Additions (Convex)

Two new tables extend `convex/schema.ts`. Follow existing project conventions: `camelCase` fields, `*At` suffix for datetime fields, `kebab-case` status literals, inline `.index()`.

### `emailSubscribers` table

```typescript
emailSubscribers: defineTable({
  email: v.string(),
  consentState: v.union(
    v.literal('subscribed'),
    v.literal('unsubscribed'),
  ),
  source: v.string(),              // 'post-purchase-flow' | 'newsletter-optin' etc.
  unsubscribeToken: v.string(),   // crypto.randomBytes(32).toString('hex') — globally unique
  createdAt: v.number(),          // Date.now() ms
  unsubscribedAt: v.optional(v.number()),
})
  .index('by_email', ['email'])
  .index('by_token', ['unsubscribeToken']),
```

### `emailSends` table

```typescript
emailSends: defineTable({
  orderId: v.id('stripeOrders'),
  email: v.string(),               // denormalized for fast suppression queries
  step: v.number(),                // 1-8
  status: v.union(
    v.literal('scheduled'),
    v.literal('sent'),
    v.literal('failed'),
    v.literal('cancelled'),        // unsubscribe cancelled remaining steps
    v.literal('skipped'),          // customerEmail absent at enqueue time
  ),
  scheduledFnId: v.optional(v.string()),  // Convex scheduled fn ID — for ctx.scheduler.cancel
  providerMessageId: v.optional(v.string()), // Resend message id
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

**Why `scheduledFnId` as `v.optional(v.string())`:** The Convex scheduled function ID is typed as `GenericId<"_scheduled_functions">` but stored as a string to avoid binding `emailSends` to the internal `_scheduled_functions` type. At cancellation time, cast back: `ctx.scheduler.cancel(send.scheduledFnId as any)`.

---

## Integration Points / Gotchas

### 1. `customerEmail` is optional on `stripeOrders`

The existing schema has `customerEmail: v.optional(v.string())`. The `stripeOrders.insert` mutation already accepts it as optional (from `session.customer_details?.email ?? undefined` in `handlers.ts`).

**Plan implication:** `enqueueEmailFlow` must guard against `!order.customerEmail` and early-return silently. Mark the `emailSends` rows as `status: 'skipped'` so the state is queryable but no send is attempted. Do not throw — throwing would propagate back and cause the Stripe webhook to 5xx.

### 2. `charitySlug` is also optional on `stripeOrders`

`session.metadata?.charitySlug` can be absent if checkout was created before the charitySlug metadata was added. Email templates must have a graceful fallback (generic "this week's featured charity" copy) when `charitySlug` is null.

### 3. The existing `stripeOrders.insert` mutation is a best-effort write

From `stripeOrders.ts`: "Best-effort writes: the webhook handler wraps this call in try/catch." If we extend `insert` to also schedule the email flow, a failure in `enqueueEmailFlow` could mask an otherwise-successful order insert. Pattern: wrap the `ctx.scheduler.runAfter` call in a try/catch inside the mutation, log the failure, but do not rethrow — the order record is what matters. A cron sweep provides the recovery path.

### 4. The cron sweep as a recovery net

A daily or hourly `convex/crons.ts` sweep queries `emailSends` for rows with `status: 'scheduled'` and `createdAt` older than their expected send window. If a scheduled action failed permanently (the action errored and Convex marked it failed — "at most once" guarantee), the sweep re-enqueues it with `ctx.scheduler.runAfter(0, ...)` and resets the row to `status: 'scheduled'`. This also catches the edge case where `enqueueEmailFlow` itself failed after writing partial rows.

### 5. Convex scheduled actions are "at most once", not "at least once"

Unlike mutations (guaranteed exactly once), scheduled actions can fail without retry. The cron sweep is the retry mechanism for failed action executions. The `emailSends` ledger + idempotency check means the sweep can safely re-enqueue without risk of double-send.

### 6. Email 7 "other charities" GROQ query

The Sanity CDN query needs charities from recent `weeklyIssue` docs WHERE the featured charity != `order.charitySlug`. Approximate GROQ:

```groq
*[_type == "weeklyIssue" && status == "published" && charity->slug.current != $charitySlug]
| order(issueNumber desc)[0...3] {
  charity-> {
    name,
    "slug": slug.current,
    location,
    focusArea,
    missionStatement,
  }
}
```

This query runs inside the Convex `sendEmailStep` action via `fetch` to the Sanity CDN. The GROQ projection reuses existing `charity->` field names from `API_CONTRACTS.md §1.2` (no new Sanity fields needed).

### 7. Email 8 "funded N more" count

```groq
count(*[_type == "weeklyIssue" && status == "published" && publishDate > $orderDate])
```

`orderDate` = ISO 8601 date string derived from `order.createdAt` (Unix ms → ISO string). This query is a simple count — it can be called inside the action via `fetch` to Sanity CDN.

### 8. Email flow enqueue is a Convex-only concern

The enqueue does NOT go through any Next.js route or API. The flow is:
1. Stripe webhook → `apps/web/lib/stripe/handlers.ts` → calls `api.stripeOrders.insert` via `ConvexHttpClient`
2. `stripeOrders.insert` mutation → internally schedules `internal.emailFlow.enqueueEmailFlow`
3. `enqueueEmailFlow` mutation → schedules 8 `sendEmailStep` internal actions with correct offsets

This is entirely within Convex's own scheduler — no additional HTTP calls from the Next.js layer.

### 9. React Email render must happen in the Convex action, not in a Next.js route

The `@react-email/render` package runs `render(jsx)` server-side. Convex actions with `"use node"` directive have access to Node.js APIs and can import `@react-email/render`. However, the `apps/web/emails/*.tsx` templates are React components that import from `@react-email/components`. The Convex action needs to import these templates.

**Problem:** Convex actions live in `convex/` directory and are bundled separately from `apps/web/`. They cannot import from `apps/web/emails/` via relative paths across the monorepo boundary without a shared package.

**Recommended solution:** Create a minimal `packages/emails/` workspace package that exports the templates and the render helper. Both `convex/emailActions.ts` and `apps/web/` can import from `@eisenbalm/emails`. This mirrors the existing `@eisenbalm/shared` pattern already used in the monorepo.

**Alternative (simpler):** Keep templates as plain functions in `convex/emails/` (co-located with Convex functions) that return HTML strings directly — no JSX, no React Email render dependency cross-boundary. Tradeoff: less reusable, harder to preview with React Email dev server.

**Recommended for v1:** Option 1 (shared package) because React Email's `render()` gives cross-client CSS inlining and component reuse. The planner must create the `packages/emails/` workspace setup.

### 10. Convex `"use node"` directive

The `emailActions.ts` file must start with `"use node"` to access Node.js crypto APIs (for token generation, if done in actions) and to ensure `@react-email/render` works correctly. Without it, Convex runs in its faster V8 environment which lacks Node.js APIs.

---

## Deliverability / Compliance Specifics

### Gmail/Yahoo 2024 Bulk-Sender Requirements (applies when > 5,000/day; apply now regardless)
| Requirement | What It Means | Where It Lives |
|------------|--------------|----------------|
| SPF | TXT record on sending domain | DNS — not in code |
| DKIM | Key pair + TXT record | Resend dashboard → DNS |
| DMARC | `_dmarc.` TXT record, minimum `p=none` | DNS — not in code |
| One-click `List-Unsubscribe` | `List-Unsubscribe` + `List-Unsubscribe-Post` headers | Code (in Resend `headers` field for E4-E8) |
| Unsubscribe honored within 48h | POST to `/api/email/unsubscribe` must cancel within 48h | Code (route handler + Convex mutation) |
| Spam rate < 0.10% target / 0.30% hard limit | Monitor in Google Postmaster Tools | Operational — not in code |

**Separate subdomains:** `receipts.eisenbalm.com` (E1-E3) and `dispatch.eisenbalm.com` (E4-E8). Each subdomain needs its own SPF/DKIM/DMARC setup in Resend and DNS. This prevents a spam complaint on a marketing email from affecting receipt deliverability.

### CAN-SPAM Requirements (apply to all US commercial email)
| Requirement | Where Implemented |
|------------|-------------------|
| Honest "From" address | Resend `from` field — set correctly |
| Non-deceptive subject lines | Email copy — Andrew's sign-off gate |
| Physical postal address | Footer component in E1-E8 templates — `TODO(Andrew): confirm address` |
| Clear "this is an ad" for marketing | E4-E8 — implied by transparent brand footer |
| Opt-out mechanism | Unsubscribe link in all marketing emails |
| Opt-out honored within 10 business days | Convex mutation cancels immediately |

**What is code vs operational:**
- **Code tasks:** Headers, unsubscribe endpoint, footer with postal address placeholder, suppress logic
- **DNS/Resend dashboard (launch prerequisites, not build tasks):** SPF, DKIM, DMARC, Resend domain verification, separate sending domains registered

---

## Testability Without Live Sending

### Provider Abstraction

Define a `SendEmailProvider` interface. The real implementation calls Resend; a `FakeEmailProvider` records sends to an in-memory array and never calls the network.

```typescript
// packages/emails/src/provider.ts
export interface SendEmailProvider {
  send(params: {
    from: string
    to: string
    subject: string
    html: string
    headers?: Record<string, string>
  }): Promise<{ id: string }>
}

export class ResendProvider implements SendEmailProvider {
  constructor(private client: Resend) {}
  async send(params) { return (await this.client.emails.send(params)).data! }
}

export class FakeEmailProvider implements SendEmailProvider {
  public sent: Array<{ to: string; subject: string; step?: number }> = []
  async send(params) {
    this.sent.push(params)
    return { id: `fake-${Date.now()}` }
  }
}
```

**Dry-run mode:** `EMAIL_DRY_RUN=true` environment variable causes `sendEmailStep` action to use `FakeEmailProvider`. In production (Vercel/Convex), this var is absent — real Resend client is used.

### Convex Actions Are Not Directly Unit-Testable

Convex does not expose a testing SDK for mocking `ctx.runQuery` / `ctx.runMutation` / `ctx.scheduler` in unit tests. The standard pattern from the existing test suite (`apps/web/__tests__/`) is:

1. Extract pure business logic (render, subject, offset computation, suppression check) into plain TypeScript functions in `packages/emails/src/` that have NO Convex imports.
2. Test those pure functions with vitest (existing test runner in `apps/web/`).
3. Test the Convex mutations/actions via integration tests against a real `convex dev` instance (not unit tests). This project has no Convex integration test setup currently — the planner should note this gap.

### What Vitest Can Cover (HIGH confidence)
- Email template render output (snapshot tests): `render(<OrderConfirmation props={...} />)` → assert HTML contains charity name, postal address, etc.
- Offset constant correctness: `OFFSETS_MS[3] === 7 * 24 * 3600_000` (regression guard)
- Suppression logic: pure function `shouldSuppressStep(step, subscriber)` → boolean
- Unsubscribe token generation: `generateToken()` returns 64-char hex string
- Email 7 GROQ query shape: mock fetch, assert GROQ string excludes buyer's charity slug
- Email 8 count computation: mock Sanity response, assert count string interpolation

### What Cannot Be Unit-Tested in This Setup
- `ctx.scheduler.cancel` actually cancelling the job (requires live Convex)
- Resend API actually accepting and delivering the email (E2E only)
- At-most-once guarantee of scheduled actions (Convex platform behavior)

---

## Common Pitfalls

### Pitfall 1: Calling Resend from a Convex Mutation
**What goes wrong:** `fetch` inside a mutation throws "fetch is not defined" (mutations run in a restricted environment).
**Why it happens:** Convex mutations cannot make external HTTP calls. Only actions can.
**How to avoid:** All Resend calls must be in `internalAction` functions. Mutations only write to the DB and schedule actions.
**Warning signs:** TypeScript error "Property 'fetch' does not exist" or runtime "fetch not defined" in mutation handler.

### Pitfall 2: Missing `scheduledFnId` in `emailSends`
**What goes wrong:** Unsubscribe cannot cancel pending steps. User still receives marketing emails after opting out.
**Why it happens:** `enqueueEmailFlow` schedules actions and inserts `emailSends` rows separately — if `scheduledFnId` is not captured from `ctx.scheduler.runAfter` return value and stored, cancellation is impossible.
**How to avoid:** The mutation inserts the `emailSends` row AFTER calling `ctx.scheduler.runAfter`, storing its return value as `scheduledFnId`.
**Warning signs:** Unsubscribe route returns 200 but emails still arrive. `emailSends` rows have `scheduledFnId: null`.

### Pitfall 3: Email 3 delivery claim
**What goes wrong:** Email 3 says "your order has arrived" — customer hasn't received it yet. Returns/complaints.
**Why it happens:** "delivered + N" timing was mapped to "purchase + 4 days" as an estimate, not a verified event.
**How to avoid:** Email 3 copy must NEVER say "your order arrived" — only "it should arrive today" / "it's on its way". BRIEF explicitly requires this. This is a copy constraint, not a code constraint, but the template must bake it in.
**Warning signs:** Any variant of "arrived", "delivered", "got your order" in the Email 3 subject or preview text.

### Pitfall 4: React Email templates not importable from Convex functions
**What goes wrong:** `convex/emailActions.ts` imports from `apps/web/emails/*.tsx` → TypeScript compilation fails because Convex bundles its own directory separately.
**Why it happens:** Convex's bundler resolves imports relative to `convex/` directory. Cross-package imports require a workspace package.
**How to avoid:** Create `packages/emails/` as a workspace package. Add it to `pnpm-workspace.yaml`. Both `convex/` and `apps/web/` import from `@eisenbalm/emails`.
**Warning signs:** `convex dev` fails with "Cannot resolve module '../../apps/web/emails/...'".

### Pitfall 5: `customerEmail` absent — enqueue silently skips
**What goes wrong:** If `enqueueEmailFlow` throws on a missing email instead of silently skipping, the Convex mutation throws, which propagates back to `stripeOrders.insert`, which propagates back to the Stripe webhook handler — which returns 5xx to Stripe, triggering aggressive retries.
**Why it happens:** Missing null-check on `order.customerEmail`.
**How to avoid:** Early return with `status: 'skipped'` row inserts when `customerEmail` is absent. Never throw from `enqueueEmailFlow`.
**Warning signs:** Stripe Dashboard shows repeated webhook delivery failures for orders without email addresses.

### Pitfall 6: `@react-email/render` package requires specific Next.js config
**What goes wrong:** Next.js build fails with "cannot use @react-email/render and @react-email/components without serverComponentsExternalPackages".
**Why it happens:** React Email uses node-specific APIs that Next.js needs to treat as server-only externals.
**How to avoid:** In `apps/web/next.config.ts`, add `serverExternalPackages: ['@react-email/render', '@react-email/components']`. (This is a known issue tracked in react-email GitHub #977.)
**Warning signs:** Build error mentioning `serverComponentsExternalPackages` or `Module not found: @react-email/...`.

---

## Code Examples

### Convex cron sweep definition
```typescript
// convex/crons.ts
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Hourly sweep: find emailSends rows that should have sent but didn't
crons.hourly('email-retry-sweep', { minuteUTC: 30 }, internal.emailActions.sweepFailedSends)

export default crons
```

### `ctx.scheduler.cancel` for unsubscribe
```typescript
// Exact Convex 1.38 API — cancel a scheduled function by its ID
// Returns void; does not throw if ID is already run or cancelled
await ctx.scheduler.cancel(scheduledFnId as any)
```

### Resend send with required marketing headers
```typescript
// Source: Resend docs — headers field for one-click unsubscribe
const resend = new Resend(process.env.RESEND_API_KEY)
await resend.emails.send({
  from: 'Jesse <dispatch@dispatch.eisenbalm.com>',
  to: customerEmail,
  subject: 'The ritual. Every lip, every morning.',
  html: renderedHtml,
  headers: {
    'List-Unsubscribe': `<https://eisenbalm.com/api/email/unsubscribe?token=${token}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  },
})
```

### React Email render (new async API)
```typescript
// Source: @react-email/render v2.0.8 — render() is now always async
// renderAsync is deprecated
import { render } from '@react-email/render'
import { OrderConfirmation } from '@eisenbalm/emails'

const html = await render(<OrderConfirmation order={order} charity={charity} />)
```

### Unsubscribe route (Next.js App Router)
```typescript
// apps/web/app/api/email/unsubscribe/route.ts
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return new Response('Missing token', { status: 400 })

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  await convex.mutation(api.emailSubscribers.unsubscribeByTokenPublic, { token })

  // Return a simple confirmation page (GET is shown to user; POST is one-click)
  return new Response('<html><body>Unsubscribed successfully.</body></html>', {
    headers: { 'Content-Type': 'text/html' },
  })
}

// RFC 8058 requires the endpoint also handle POST for one-click
export async function POST(req: Request) {
  // Same logic — one-click clients POST to this URL
  return GET(req)
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `renderAsync()` from `@react-email/render` | `render()` (always async, same semantics) | React Email ~2024-2025 | `renderAsync` is deprecated; use `render` in all new code |
| Gmail/Yahoo bulk: "implement if >5K/day" | Required for ALL commercial senders regardless of volume | February 2024 (enforcement) | One-click unsubscribe + DMARC now mandatory from day one |
| Convex beta: no `ctx.scheduler` | Stable `ctx.scheduler.runAfter` + `ctx.scheduler.cancel` | Convex ~1.x stable | API is stable and production-ready in v1.38 |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `resend` npm | Email delivery | Not installed yet | 6.12.4 (registry) | — (no fallback; required) |
| `@react-email/render` | Template render | Not installed yet | 2.0.8 (registry) | — |
| `@react-email/components` | Template primitives | Not installed yet | 1.0.12 (registry) | — |
| `convex` | Scheduling | Already installed | 1.38.0 | — |
| Node.js `crypto` | Token generation | Built-in (Node 18+) | Built-in | — |
| `RESEND_API_KEY` env var | Resend auth | Not yet provisioned | — | EMAIL_DRY_RUN=true during dev |
| Resend sending domain + DNS | Deliverability | Not yet configured | — | Block go-live, not build |

**Missing dependencies with no fallback (blocking go-live, not blocking build):**
- `RESEND_API_KEY` — required for live sends; EMAIL_DRY_RUN=true bypasses during development
- DNS records (SPF/DKIM/DMARC) for `receipts.eisenbalm.com` + `dispatch.eisenbalm.com`
- Resend domain verification for both subdomains
- Physical postal address for CAN-SPAM footer (Andrew provides)
- Andrew's voice sign-off on 8 copy beats (drafts ship for approval, not auto-send)

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.0 |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter web test:unit` |
| Full suite command | `pnpm --filter web test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EMAIL-01 | 8 offset constants are correct ms values | unit | `pnpm --filter web test:unit` | ❌ Wave 0: `apps/web/__tests__/email-offsets.test.ts` |
| EMAIL-02 | Idempotency: `shouldSend(existing)` returns false when status=sent | unit | `pnpm --filter web test:unit` | ❌ Wave 0: `apps/web/__tests__/email-idempotency.test.ts` |
| EMAIL-03 | Marketing suppression: step >=4 + unsubscribed → skip | unit | `pnpm --filter web test:unit` | ❌ Wave 0: `apps/web/__tests__/email-suppression.test.ts` |
| EMAIL-04 | Order confirmation template renders with charity name | unit (snapshot) | `pnpm --filter web test:unit` | ❌ Wave 0: `apps/web/__tests__/email-templates.test.ts` |
| EMAIL-05 | Marketing emails contain List-Unsubscribe header | unit | `pnpm --filter web test:unit` | ❌ Wave 0: see EMAIL-04 file |
| EMAIL-06 | Transactional emails (E1-E3) do NOT contain List-Unsubscribe header | unit | `pnpm --filter web test:unit` | ❌ Wave 0: see EMAIL-04 file |
| EMAIL-07 | Unsubscribe token is 64-char hex | unit | `pnpm --filter web test:unit` | ❌ Wave 0: `apps/web/__tests__/email-token.test.ts` |
| EMAIL-08 | Email 3 copy does not contain "arrived" or "delivered" | unit (snapshot) | `pnpm --filter web test:unit` | ❌ Wave 0: see EMAIL-04 file |
| EMAIL-09 | customerEmail absent → graceful skip (no throw) | unit | `pnpm --filter web test:unit` | ❌ Wave 0: `apps/web/__tests__/email-missing-email.test.ts` |
| EMAIL-10 | Unsubscribe route handles POST (one-click RFC 8058) | unit | `pnpm --filter web test:unit` | ❌ Wave 0: `apps/web/__tests__/email-unsubscribe-route.test.ts` |

### Sampling Rate
- **Per task commit:** `pnpm --filter web test:unit` (runs all `__tests__/**/*.test.ts`)
- **Per wave merge:** `pnpm --filter web test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `apps/web/__tests__/email-offsets.test.ts` — covers EMAIL-01
- [ ] `apps/web/__tests__/email-idempotency.test.ts` — covers EMAIL-02
- [ ] `apps/web/__tests__/email-suppression.test.ts` — covers EMAIL-03
- [ ] `apps/web/__tests__/email-templates.test.ts` — covers EMAIL-04 through EMAIL-08
- [ ] `apps/web/__tests__/email-token.test.ts` — covers EMAIL-07
- [ ] `apps/web/__tests__/email-missing-email.test.ts` — covers EMAIL-09
- [ ] `apps/web/__tests__/email-unsubscribe-route.test.ts` — covers EMAIL-10
- [ ] `packages/emails/` workspace package setup (Wave 0 infra — required before templates can be authored)
- [ ] `next.config.ts` update: add `serverExternalPackages: ['@react-email/render', '@react-email/components']`

---

## Open Questions

1. **Shared `packages/emails/` vs templates co-located in `convex/emails/`**
   - What we know: Convex actions can import from workspace packages; `@eisenbalm/shared` already establishes this pattern.
   - What's unclear: Whether `packages/emails/` needs a build step (like `tsup`) or can use source resolution (like `@eisenbalm/shared` which uses `.ts` main/types). Source resolution is simpler and matches the existing pattern.
   - Recommendation: Start with source resolution (no build step), same as `@eisenbalm/shared` Phase 1 decision.

2. **`stripeOrders.insert` extension vs separate mutation call from webhook handler**
   - What we know: Extending `insert` is cleaner (single Convex call from webhook). But it changes an existing mutation's behavior.
   - What's unclear: Whether the existing `stripe-webhook.test.ts` / `stripe-webhook-idempotency.test.ts` will need updating.
   - Recommendation: Extend `insert` — it's a purely additive change (adding a `ctx.scheduler.runAfter` call that is fire-and-forget). The existing tests mock Convex calls and won't break. Document this in the plan.

3. **`emailSubscribers` upsert: when is the subscriber record created?**
   - What we know: The `emailSubscribers` table stores consent. E7 is the "opt-in to newsletter" email — v1 only captures consent, does not send a newsletter.
   - What's unclear: Should the subscriber record be created at order time (before E7 sends) or at E7 send time? If at order time with `consentState: 'subscribed'` by default, unsubscribes before E7 work correctly. If at E7 send time, earlier unsubscribes have no row to update.
   - Recommendation: Create the `emailSubscribers` row in `enqueueEmailFlow` at order time, `consentState: 'subscribed'`, so all 8 steps have a subscriber record to check against.

---

## Sources

### Primary (HIGH confidence)
- [Convex Actions docs](https://docs.convex.dev/functions/actions) — ctx.runQuery, ctx.runMutation, fetch in actions, "use node" directive
- [Convex Scheduler API](https://docs.convex.dev/api/interfaces/server.Scheduler) — runAfter signature, cancel, at-most-once vs exactly-once guarantees
- [Convex Scheduled Functions](https://docs.convex.dev/scheduling/scheduled-functions) — ctx.scheduler.cancel semantics
- [Convex Internal Functions](https://docs.convex.dev/functions/internal-functions) — internalMutation, internalAction definition and import pattern
- [Convex Cron Jobs](https://docs.convex.dev/scheduling/cron-jobs) — crons.ts file, cronJobs API
- [Resend Unsubscribe Headers](https://resend.com/docs/dashboard/emails/add-unsubscribe-to-transactional-emails) — List-Unsubscribe, List-Unsubscribe-Post, RFC 8058
- `convex/package.json` (repo) — version 1.38.0 confirmed installed
- `convex/stripeOrders.ts` (repo) — existing insert mutation pattern
- `apps/web/lib/stripe/handlers.ts` (repo) — how stripeOrders.insert is called; hook point for enqueue
- `convex/schema.ts` (repo) — existing table patterns, stripeOrders fields, customerEmail is optional

### Secondary (MEDIUM confidence)
- [@react-email/render npm](https://www.npmjs.com/package/@react-email/render) v2.0.8 — `render()` is now always async, `renderAsync` deprecated
- [react-email GitHub #977](https://github.com/resend/react-email/issues/977) — `serverExternalPackages` requirement for Next.js
- [Convex email integration guide](https://stack.convex.dev/bluefox-convex-developers-email-integration-guide) — internalAction pattern for external email sends from mutations
- [Gmail bulk sender requirements 2024](https://support.google.com/a/answer/81126?hl=en) — SPF/DKIM/DMARC, one-click unsubscribe, complaint rate thresholds

### Tertiary (LOW confidence)
- [dmarcwise.io Gmail/Yahoo 2024 guide](https://dmarcwise.io/blog/gmail-yahoo-new-requirements-2024) — enforcement timeline (cross-verified with Google's own page)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — npm registry versions confirmed live
- Convex scheduling mechanics: HIGH — verified against official Convex docs
- React Email render API: HIGH — npm page + changelog confirm `render()` is async, `renderAsync` deprecated
- Resend headers: HIGH — official Resend docs
- Deliverability compliance: MEDIUM — primary sources (Google, Resend docs) verified; exact enforcement dates for new-sender thresholds may shift
- Testability / Convex test gap: MEDIUM — Convex has no official unit-test SDK; pattern derived from existing project test style

**Research date:** 2026-06-05
**Valid until:** 2026-09-05 (90 days; React Email and Convex APIs are stable; Resend API unlikely to change)
