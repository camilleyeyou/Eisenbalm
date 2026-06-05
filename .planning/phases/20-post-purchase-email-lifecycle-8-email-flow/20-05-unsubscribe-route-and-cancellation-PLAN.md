---
phase: 20-post-purchase-email-lifecycle-8-email-flow
plan: 05
type: execute
wave: 3
depends_on: [20-02, 20-03]
files_modified:
  - convex/emailSubscribers.ts
  - apps/web/app/api/email/unsubscribe/route.ts
  - apps/web/__tests__/email-unsubscribe-route.test.ts
  - apps/web/__tests__/email-unsubscribe-cancel.test.ts
autonomous: true
requirements: [EMAIL-03, EMAIL-10]
must_haves:
  truths:
    - "GET /api/email/unsubscribe?token=... unsubscribes and returns an HTML confirmation; POST handles RFC 8058 one-click"
    - "A missing/blank token returns 400 without touching Convex"
    - "Unsubscribe sets consentState='unsubscribed' and cancels all pending SCHEDULED marketing steps (4-8) via ctx.scheduler.cancel, marking them 'cancelled'"
    - "Transactional steps (1-3) are never cancelled by unsubscribe"
    - "Already-sent or non-marketing rows are left untouched by the cancellation"
  artifacts:
    - path: "apps/web/app/api/email/unsubscribe/route.ts"
      provides: "GET + POST one-click unsubscribe handlers"
      exports: ["GET", "POST"]
    - path: "convex/emailSubscribers.ts"
      provides: "unsubscribeByToken internalMutation + unsubscribeByTokenPublic public mutation (cancels pending marketing steps)"
      exports: ["unsubscribeByToken", "unsubscribeByTokenPublic"]
  key_links:
    - from: "apps/web/app/api/email/unsubscribe/route.ts"
      to: "api.emailSubscribers.unsubscribeByTokenPublic"
      via: "ConvexHttpClient.mutation"
      pattern: "unsubscribeByTokenPublic"
    - from: "convex/emailSubscribers.ts"
      to: "ctx.scheduler.cancel"
      via: "cancel each pending scheduled marketing step's scheduledFnId"
      pattern: "scheduler\\.cancel"
---

<objective>
Build the one-click unsubscribe surface: the Convex cancellation mutation that flips `consentState` to `unsubscribed` and cancels every pending SCHEDULED marketing step (4-8) for that email via `ctx.scheduler.cancel`, plus the Next.js `GET/POST /api/email/unsubscribe?token=...` route (RFC 8058 one-click). Transactional steps (1-3) are never cancelled, and the suppression already wired in Plan 20-03's `sendEmailStep` provides defense-in-depth for any step that races past cancellation.

Purpose: Satisfies EMAIL-10 (one-click route incl. POST) and the suppression half of EMAIL-03 (unsubscribe suppresses marketing but not transactional). The route mirrors the existing Stripe-webhook ConvexHttpClient pattern.
Output: cancellation mutation + unsubscribe route + 2 vitest files (route shape + cancellation decision logic).
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
@convex/emailSubscribers.ts
@convex/schema.ts
@apps/web/app/api/stripe/webhook/route.ts

<interfaces>
<!-- Existing patterns + Plan 20-02/20-03 contracts. -->

ConvexHttpClient usage (from apps/web/lib/stripe/handlers.ts):
  import { ConvexHttpClient } from 'convex/browser'
  import { api } from '@convex/_generated/api'
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)
  await convex.mutation(api.x.y, {...})

emailSubscribers table (Plan 20-02): email, consentState, unsubscribeToken, unsubscribedAt?. Indexed by_token.
emailSends table (Plan 20-02/03): orderId, email, step(1-8), status('scheduled'|'sent'|'failed'|'cancelled'|'skipped'), scheduledFnId?. Indexed by_email_step + by_status.

isMarketingStep(step) from @eisenbalm/emails: step >= 4.

Convex cancel API (20-RESEARCH §Code Examples): `await ctx.scheduler.cancel(scheduledFnId as any)` — returns void, does not throw if the id already ran/cancelled. Cancel must run inside a mutation/action.

Route runtime: Next 15 App Router Route Handler. Use `export const runtime = 'nodejs'` (ConvexHttpClient + env). RFC 8058 requires the SAME endpoint to accept POST (one-click clients POST).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure cancellation-decision helper + unsubscribeByToken mutation</name>
  <read_first>convex/emailSubscribers.ts, convex/schema.ts, .planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-RESEARCH.md</read_first>
  <files>convex/emailSubscribers.ts, packages/emails/src/suppression.ts, packages/emails/src/index.ts, apps/web/__tests__/email-unsubscribe-cancel.test.ts</files>
  <behavior>
    - shouldCancelOnUnsubscribe({step:4, status:'scheduled'}) === true
    - shouldCancelOnUnsubscribe({step:3, status:'scheduled'}) === false  (transactional never cancelled)
    - shouldCancelOnUnsubscribe({step:5, status:'sent'}) === false        (already sent — leave it)
    - shouldCancelOnUnsubscribe({step:6, status:'cancelled'}) === false   (already cancelled)
  </behavior>
  <action>
Add a pure helper to `packages/emails/src/suppression.ts` (so the cancel decision is unit-testable; the Convex mutation calls the SAME helper):
```typescript
import { isMarketingStep } from './offsets'
export function shouldCancelOnUnsubscribe(row: { step: number; status: string }): boolean {
  return isMarketingStep(row.step) && row.status === 'scheduled'
}
```
(`isMarketingStep` is already imported in suppression.ts from Plan 20-01.) It is re-exported via the existing barrel.

Add to `convex/emailSubscribers.ts`:
- `unsubscribeByToken = internalMutation({ args:{ token: v.string() }, handler })`:
  1. `const sub = await ctx.db.query('emailSubscribers').withIndex('by_token', q=>q.eq('unsubscribeToken', token)).first()`; if `!sub` return `{ ok: false }`.
  2. `await ctx.db.patch(sub._id, { consentState:'unsubscribed', unsubscribedAt: Date.now() })`.
  3. `const rows = await ctx.db.query('emailSends').withIndex('by_email_step', q=>q.eq('email', sub.email)).collect()`.
  4. For each row where `shouldCancelOnUnsubscribe(row)` (imported from `@eisenbalm/emails`): if `row.scheduledFnId` `await ctx.scheduler.cancel(row.scheduledFnId as any)`; then `await ctx.db.patch(row._id, { status:'cancelled' })`.
  5. return `{ ok: true }`.
- `unsubscribeByTokenPublic = mutation({ args:{ token: v.string() }, handler: async (ctx,{token}) => ctx.runMutation(internal.emailSubscribers.unsubscribeByToken, { token }) })` — public wrapper the Next route calls (the internal one isn't callable from the browser client).

Import `mutation, internalMutation` from `./_generated/server`, `internal` from `./_generated/api`, `shouldCancelOnUnsubscribe` from `@eisenbalm/emails`.

Create `apps/web/__tests__/email-unsubscribe-cancel.test.ts` testing `shouldCancelOnUnsubscribe` per the behavior block (transactional never cancelled; only scheduled marketing cancelled).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/web && npx vitest run __tests__/email-unsubscribe-cancel.test.ts && cd /Users/user/Desktop/Eisenbalm && grep -q "scheduler.cancel" convex/emailSubscribers.ts && grep -q "unsubscribeByTokenPublic" convex/emailSubscribers.ts && grep -q "shouldCancelOnUnsubscribe" convex/emailSubscribers.ts && echo OK</automated>
  </verify>
  <acceptance_criteria>
- `email-unsubscribe-cancel.test.ts` green: marketing+scheduled → cancel; transactional → no cancel; sent/cancelled → no cancel.
- `convex/emailSubscribers.ts` patches consentState to 'unsubscribed' + sets unsubscribedAt.
- Cancellation loop calls `ctx.scheduler.cancel(row.scheduledFnId ...)` and patches the row to 'cancelled', gated by `shouldCancelOnUnsubscribe`.
- `unsubscribeByTokenPublic` (public) wraps the internal mutation.
  </acceptance_criteria>
  <done>Cancellation mutation cancels only pending marketing steps via the unit-tested decision helper; public wrapper exposed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GET/POST /api/email/unsubscribe route (one-click RFC 8058)</name>
  <read_first>apps/web/app/api/stripe/webhook/route.ts, convex/emailSubscribers.ts, apps/web/vitest.config.ts</read_first>
  <files>apps/web/app/api/email/unsubscribe/route.ts, apps/web/__tests__/email-unsubscribe-route.test.ts</files>
  <behavior>
    - GET with no token → 400 (no Convex call)
    - GET with blank token (?token=) → 400
    - GET with a token → calls api.emailSubscribers.unsubscribeByTokenPublic once, returns 200 text/html confirmation
    - POST is exported and handles one-click (same logic as GET)
    - route exports `runtime = 'nodejs'`
  </behavior>
  <action>
Create `apps/web/app/api/email/unsubscribe/route.ts`:
```typescript
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function handle(req: Request): Promise<Response> {
  const token = new URL(req.url).searchParams.get('token')
  if (!token || token.length === 0) {
    return new Response('Missing token', { status: 400 })
  }
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  if (!url) return new Response('Misconfigured', { status: 500 })
  const convex = new ConvexHttpClient(url)
  await convex.mutation(api.emailSubscribers.unsubscribeByTokenPublic, { token })
  return new Response(
    '<html><body><p>You have been unsubscribed from marketing emails. Transactional receipts will still be sent for any orders.</p></body></html>',
    { status: 200, headers: { 'Content-Type': 'text/html' } },
  )
}
export async function GET(req: Request) { return handle(req) }
export async function POST(req: Request) { return handle(req) }  // RFC 8058 one-click
```

Create `apps/web/__tests__/email-unsubscribe-route.test.ts`. The existing test suite cannot easily spin a real Convex client, so mock `convex/browser`'s `ConvexHttpClient` (vitest `vi.mock`) so `.mutation` is a spy. Assert:
- `GET(new Request('https://x/api/email/unsubscribe'))` → status 400, mutation NOT called.
- `GET(new Request('https://x/api/email/unsubscribe?token='))` → 400.
- `GET(new Request('https://x/api/email/unsubscribe?token=abc'))` → 200, `Content-Type` text/html, mutation called once with `{ token: 'abc' }`.
- `typeof POST === 'function'` (one-click export present).
Set `process.env.NEXT_PUBLIC_CONVEX_URL` in the test before importing the route (or via vi.stubEnv). Mock `@convex/_generated/api` if needed so `api.emailSubscribers.unsubscribeByTokenPublic` resolves.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/web && npx vitest run __tests__/email-unsubscribe-route.test.ts && grep -q "export async function POST" app/api/email/unsubscribe/route.ts && grep -q "runtime = 'nodejs'" app/api/email/unsubscribe/route.ts && echo OK</automated>
  </verify>
  <acceptance_criteria>
- `email-unsubscribe-route.test.ts` green: 400 on missing/blank token (no mutation), 200 text/html on valid token (mutation called once), POST exported.
- Route file exports both `GET` and `POST` and `runtime = 'nodejs'`.
- The 200 response body states transactional receipts still send (sets reader expectation).
  </acceptance_criteria>
  <done>One-click unsubscribe route handles GET + POST, validates token, calls the public cancellation mutation; tested with a mocked Convex client.</done>
</task>

</tasks>

<verification>
- `cd apps/web && npx vitest run __tests__/email-unsubscribe-cancel.test.ts __tests__/email-unsubscribe-route.test.ts` → green.
- `grep -q "scheduler.cancel" convex/emailSubscribers.ts` (cancellation present).
- `pnpm --filter @eisenbalm/convex dev:once` deploys the new mutations (run if dev deploy available).
</verification>

<success_criteria>
- One-click unsubscribe route (GET + POST) validates token + calls Convex.
- Unsubscribe flips consent + cancels pending marketing steps only; transactional untouched.
- Decision logic unit-tested; route shape unit-tested with mocked Convex.
</success_criteria>

<output>
After completion, create `.planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-05-SUMMARY.md`
</output>
