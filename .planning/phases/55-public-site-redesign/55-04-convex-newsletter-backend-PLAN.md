---
phase: 55-public-site-redesign
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - convex/stripeOrders.ts
  - convex/emailSubscribers.ts
  - convex/_generated/api.d.ts
  - apps/web/app/api/email/subscribe/route.ts
  - apps/web/__tests__/newsletter-route.test.ts
autonomous: true
requirements: [P55-SC5, PUB-09, PUB-10]

must_haves:
  truths:
    - "A public Convex query returns the number of balms sold for one charity (optionally since a timestamp) from real stripeOrders rows, with aggregates only (no emails/addresses)"
    - "A reader can submit an email and a newsletter-optin subscriber row is recorded (idempotent; a prior unsubscribe is preserved)"
    - "The subscribe endpoint never reveals whether an address was already subscribed and ignores honeypot submissions"
    - "Both new Convex functions are live on the dev:modest-magpie-797 deployment, not just committed"
  artifacts:
    - path: "convex/stripeOrders.ts"
      provides: "balmsForCharity public query"
      contains: "export const balmsForCharity"
    - path: "convex/emailSubscribers.ts"
      provides: "subscribeNewsletter public mutation (webhook-secret lane)"
      contains: "export const subscribeNewsletter"
    - path: "apps/web/app/api/email/subscribe/route.ts"
      provides: "POST /api/email/subscribe"
      exports: ["POST", "runtime", "dynamic"]
  key_links:
    - from: "apps/web/app/api/email/subscribe/route.ts"
      to: "convex/emailSubscribers.ts"
      via: "ConvexHttpClient.mutation(api.emailSubscribers.subscribeNewsletter, { webhookSecret: STRIPE_TO_CONVEX_SECRET })"
      pattern: "api\\.emailSubscribers\\.subscribeNewsletter"
    - from: "convex/emailSubscribers.ts subscribeNewsletter"
      to: "internal.emailSubscribers.upsertSubscriber"
      via: "ctx.runMutation with source 'newsletter-optin'"
      pattern: "newsletter-optin"
---

<objective>
Add the two small backend surfaces the front page needs — a scoped public "balms sold" aggregate query and a secret-guarded newsletter subscribe mutation — plus the Next route that calls the mutation, then sync Convex so they actually exist on the deployment (project lesson: committing convex/*.ts ≠ deployed).

Purpose: SC-5 (balms count reflects real sales) and the "working email signup" scope item.
Output: two Convex functions, one API route + test, live Convex sync verified with `convex run`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@.planning/phases/55-public-site-redesign/55-RESEARCH.md
@convex/stripeOrders.ts
@convex/emailSubscribers.ts
@convex/lib/auth.ts
@apps/web/app/api/email/unsubscribe/route.ts

<interfaces>
Existing:
```typescript
// convex/lib/auth.ts
export function requireWebhookSecret(secret: string): void   // constant-time compare vs STRIPE_TO_CONVEX_SECRET; throws if unset/mismatch
// convex/emailSubscribers.ts
export const upsertSubscriber = internalMutation({ args: { email: v.string(), unsubscribeToken: v.string(), source: v.string() }, ... })
// convex/schema.ts stripeOrders: charitySlug?: string, createdAt: number, donationAmount?: number, amountSubtotal?: number, amountTotal: number; index 'by_charitySlug_createdAt' ['charitySlug','createdAt']
// packages/emails/src/token.ts
export function generateUnsubscribeToken(): string   // 64-char hex; import from '@eisenbalm/emails'
```
Created (consumed by Plans 07 and 08):
```typescript
api.stripeOrders.balmsForCharity: query({ charitySlug: string, sinceMs?: number }) => { orders: number; balms: number; donationCents: number }
api.emailSubscribers.subscribeNewsletter: mutation({ email: string, unsubscribeToken: string, webhookSecret: string }) => null
POST /api/email/subscribe  body { email: string; company?: string }
  200 { ok: true } | 400 { ok: false, error: 'invalid-email' } | 500 { ok: false, error: 'misconfigured' } | 502 { ok: false, error: 'unavailable' }
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Convex balmsForCharity query + subscribeNewsletter mutation</name>
  <files>convex/stripeOrders.ts, convex/emailSubscribers.ts</files>
  <read_first>
    - convex/stripeOrders.ts (keep `insert` byte-identical)
    - convex/emailSubscribers.ts (upsertSubscriber + unsubscribeByTokenPublic pattern using ctx.runMutation(internal…))
    - convex/lib/auth.ts (requireWebhookSecret)
    - convex/charityLedger.ts (fallback chain donationAmount ?? amountSubtotal ?? amountTotal)
    - convex/schema.ts stripeOrders + emailSubscribers definitions (no schema change in this plan)
  </read_first>
  <action>
    1. convex/stripeOrders.ts — change the server import to `import { mutation, query } from './_generated/server'` and append:
       ```ts
       /** Phase 55 (API_CONTRACTS §55.3). Public, aggregate-only: never returns emails, names or addresses. Mirrors apps/web/lib/site.ts BALM_PRICE_CENTS. */
       const BALM_PRICE_CENTS = 899
       export const balmsForCharity = query({
         args: { charitySlug: v.string(), sinceMs: v.optional(v.number()) },
         handler: async (ctx, { charitySlug, sinceMs }) => {
           const rows = await ctx.db.query('stripeOrders')
             .withIndex('by_charitySlug_createdAt', (q) => sinceMs === undefined
               ? q.eq('charitySlug', charitySlug)
               : q.eq('charitySlug', charitySlug).gte('createdAt', sinceMs))
             .collect()
           let balms = 0, donationCents = 0
           for (const r of rows) {
             const c = r.donationAmount ?? r.amountSubtotal ?? r.amountTotal ?? 0
             donationCents += c
             balms += Math.max(0, Math.round(c / BALM_PRICE_CENTS))
           }
           return { orders: rows.length, balms, donationCents }
         },
       })
       ```
    2. convex/emailSubscribers.ts — append (import `mutation`/`internal` if not already imported; they are used by unsubscribeByTokenPublic):
       ```ts
       /** Phase 55 (API_CONTRACTS §55.4). Called only by apps/web /api/email/subscribe (server). Webhook-secret lane: no Clerk identity exists for anonymous readers. */
       export const subscribeNewsletter = mutation({
         args: { email: v.string(), unsubscribeToken: v.string(), webhookSecret: v.string() },
         handler: async (ctx, args): Promise<null> => {
           requireWebhookSecret(args.webhookSecret)
           const email = args.email.trim().toLowerCase()
           if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('invalid email')
           if (!/^[0-9a-f]{64}$/.test(args.unsubscribeToken)) throw new Error('invalid token')
           await ctx.runMutation(internal.emailSubscribers.upsertSubscriber, { email, unsubscribeToken: args.unsubscribeToken, source: 'newsletter-optin' })
           return null
         },
       })
       ```
       Import `requireWebhookSecret` from './lib/auth'. Do not modify upsertSubscriber (it already preserves an existing row's consent state and token).
    3. Run `pnpm --filter @eisenbalm/convex typecheck`.
  </action>
  <verify>
    <automated>pnpm --filter @eisenbalm/convex typecheck && grep -n "export const balmsForCharity" convex/stripeOrders.ts && grep -n "export const subscribeNewsletter" convex/emailSubscribers.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter @eisenbalm/convex typecheck` exits 0
    - `grep -n "withIndex('by_charitySlug_createdAt'" convex/stripeOrders.ts` matches
    - `grep -A6 "export const subscribeNewsletter" convex/emailSubscribers.ts | grep -c "requireWebhookSecret(args.webhookSecret)"` returns 1
    - `grep -n "'newsletter-optin'" convex/emailSubscribers.ts` matches
    - balmsForCharity return object keys are exactly orders, balms, donationCents (`grep -n "return { orders: rows.length, balms, donationCents }" convex/stripeOrders.ts`)
  </acceptance_criteria>
  <done>Both functions typecheck; no schema change; existing insert untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: POST /api/email/subscribe route + test</name>
  <files>apps/web/app/api/email/subscribe/route.ts, apps/web/__tests__/newsletter-route.test.ts</files>
  <read_first>
    - apps/web/app/api/email/unsubscribe/route.ts (runtime nodejs, ConvexHttpClient pattern)
    - apps/web/__tests__/email-unsubscribe-route.test.ts (vi.doMock pattern for convex/browser and @convex/_generated/api)
    - apps/web/lib/stripe/handlers.ts L35–42 (webhookSecret: process.env.STRIPE_TO_CONVEX_SECRET ?? '')
  </read_first>
  <behavior>
    - Missing body / non-JSON / missing email / 'not-an-email' / 255-char address -> 400 { ok: false, error: 'invalid-email' }, mutation not called
    - Non-empty `company` honeypot -> 200 { ok: true }, mutation not called
    - Valid ' Reader@Example.com ' -> mutation called once with { email: 'reader@example.com', unsubscribeToken: <64 hex from mocked generateUnsubscribeToken>, webhookSecret: process.env.STRIPE_TO_CONVEX_SECRET }, response 200 { ok: true }
    - Mutation throws -> 502 { ok: false, error: 'unavailable' } (response body never echoes the error message)
    - NEXT_PUBLIC_CONVEX_URL unset -> 500 { ok: false, error: 'misconfigured' }
    - Responses for "already subscribed" and "new" are identical (mutation resolves null in both)
  </behavior>
  <action>
    RED: write newsletter-route.test.ts using `vi.doMock('convex/browser', …)`, `vi.doMock('@convex/_generated/api', () => ({ api: { emailSubscribers: { subscribeNewsletter: 'subscribeNewsletter' } } }))`, `vi.doMock('@eisenbalm/emails', () => ({ generateUnsubscribeToken: () => 'a'.repeat(64) }))`, `vi.resetModules()` in beforeEach, then `await import('@/app/api/email/subscribe/route')`.
    GREEN: route.ts:
    ```ts
    import { ConvexHttpClient } from 'convex/browser'
    import { api } from '@convex/_generated/api'
    import { generateUnsubscribeToken } from '@eisenbalm/emails'
    export const runtime = 'nodejs'
    export const dynamic = 'force-dynamic'
    const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status })
    export async function POST(req: Request) {
      let data: { email?: unknown; company?: unknown } = {}
      try { data = await req.json() } catch { return json(400, { ok: false, error: 'invalid-email' }) }
      if (typeof data.company === 'string' && data.company.trim() !== '') return json(200, { ok: true })
      const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : ''
      if (email.length < 3 || email.length > 254 || !EMAIL_RE.test(email)) return json(400, { ok: false, error: 'invalid-email' })
      const url = process.env.NEXT_PUBLIC_CONVEX_URL
      if (!url) { console.error('[email.subscribe] NEXT_PUBLIC_CONVEX_URL is not set'); return json(500, { ok: false, error: 'misconfigured' }) }
      try {
        await new ConvexHttpClient(url).mutation(api.emailSubscribers.subscribeNewsletter, { email, unsubscribeToken: generateUnsubscribeToken(), webhookSecret: process.env.STRIPE_TO_CONVEX_SECRET ?? '' })
      } catch (err) { console.error('[email.subscribe] convex mutation failed', err); return json(502, { ok: false, error: 'unavailable' }) }
      return json(200, { ok: true })
    }
    ```
    Only POST is exported. Never log the email address.
  </action>
  <verify>
    <automated>pnpm --filter web test -- newsletter-route && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter web test -- newsletter-route` exits 0
    - `grep -n "export const runtime = 'nodejs'" apps/web/app/api/email/subscribe/route.ts` matches
    - `grep -c "export async function GET" apps/web/app/api/email/subscribe/route.ts` returns 0
    - `grep -n "STRIPE_TO_CONVEX_SECRET" apps/web/app/api/email/subscribe/route.ts` matches and `grep -c "NEXT_PUBLIC_STRIPE_TO_CONVEX" apps/web/app/api/email/subscribe/route.ts` returns 0
  </acceptance_criteria>
  <done>Route validated, honeypot-safe, non-enumerating, tested.</done>
</task>

<task type="auto">
  <name>Task 3: Sync Convex functions to the deployment and verify live</name>
  <files>convex/_generated/api.d.ts</files>
  <read_first>
    - convex/package.json (`dev:once` script = `convex dev --once`)
    - .planning/phases/55-public-site-redesign/55-RESEARCH.md §"Pitfall 5: Convex function not deployed"
  </read_first>
  <action>
    1. Run `pnpm --filter @eisenbalm/convex dev:once` (target deployment dev:modest-magpie-797). This pushes all convex/*.ts and regenerates convex/_generated (api.d.ts is module-keyed, so it may not change; commit whatever changed).
       If the command fails with an authentication/deploy-key error, STOP and return an auth-gate checkpoint asking the user to run `pnpm --filter @eisenbalm/convex dev:once` themselves (or provide auth), then resume at step 2. Do not work around auth.
       Note: this plan is the ONLY Phase 55 plan that edits convex/*.ts, so pushing from this worktree cannot drop another plan's function.
    2. Verify live: `cd convex && npx convex run stripeOrders:balmsForCharity '{"charitySlug":"phase55-verify-no-orders"}'` must print `{ balms: 0, donationCents: 0, orders: 0 }` (any key order). Record the output in the SUMMARY.
    3. Verify the mutation is registered and fails closed without the secret: `cd convex && npx convex run emailSubscribers:subscribeNewsletter '{"email":"x@example.com","unsubscribeToken":"'$(printf 'a%.0s' $(seq 64))'","webhookSecret":"wrong"}'` must exit non-zero with an auth/secret error (proves requireWebhookSecret runs; no row written). Record the error line in the SUMMARY.
  </action>
  <verify>
    <automated>cd convex && npx convex run stripeOrders:balmsForCharity '{"charitySlug":"phase55-verify-no-orders"}'</automated>
  </verify>
  <acceptance_criteria>
    - `npx convex run stripeOrders:balmsForCharity '{"charitySlug":"phase55-verify-no-orders"}'` output contains `balms: 0` (or `"balms":0`)
    - The wrong-secret subscribeNewsletter call exits non-zero
    - SUMMARY records both command outputs
  </acceptance_criteria>
  <done>balmsForCharity and subscribeNewsletter are live on the Convex deployment and behave as contracted.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @eisenbalm/convex typecheck` and `pnpm --filter web test` green
- Live `convex run` evidence in SUMMARY
- Vercel env check (STRIPE_TO_CONVEX_SECRET present in production) is part of Plan 13's deploy checkpoint
</verification>

<success_criteria>
Aggregate count query + subscribe mutation deployed; subscribe route tested and safe.
</success_criteria>

<output>
After completion, create `.planning/phases/55-public-site-redesign/55-04-SUMMARY.md`
</output>
