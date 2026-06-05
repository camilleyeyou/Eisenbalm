---
phase: 20-post-purchase-email-lifecycle-8-email-flow
plan: 03
type: execute
wave: 2
depends_on: [20-01, 20-02]
files_modified:
  - packages/emails/src/charity.ts
  - packages/emails/src/enqueuePlan.ts
  - packages/emails/src/index.ts
  - apps/web/__tests__/email-charity-queries.test.ts
  - apps/web/__tests__/email-enqueue-missing-email.test.ts
  - convex/emailFlow.ts
  - convex/emailActions.ts
  - convex/emailSends.ts
  - convex/crons.ts
  - convex/stripeOrders.ts
autonomous: true
requirements: [EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-09]
must_haves:
  truths:
    - "Recording a stripeOrders order schedules enqueueEmailFlow fire-and-forget; an enqueue failure never fails the order write"
    - "enqueueEmailFlow schedules 8 sendEmailStep actions at the correct OFFSETS_MS and records each as an emailSends 'scheduled' row carrying its scheduledFnId"
    - "When customerEmail is absent, enqueue marks all 8 steps 'skipped' and schedules nothing, without throwing (EMAIL-09)"
    - "sendEmailStep is idempotent: a step already 'sent' returns without re-sending (EMAIL-02)"
    - "sendEmailStep suppresses marketing steps (4-8) when the subscriber is unsubscribed; transactional (1-3) always send (EMAIL-03)"
    - "Marketing sends carry List-Unsubscribe + List-Unsubscribe-Post headers; transactional sends carry none"
    - "An hourly cron sweep re-enqueues stale 'scheduled' rows, made safe by the idempotency check"
    - "Charity GROQ builders (funded, others-for-E7, N-more-count-for-E8) are pure and unit-tested"
  artifacts:
    - path: "convex/emailFlow.ts"
      provides: "enqueueEmailFlow internalMutation + getOrder internalQuery"
      exports: ["enqueueEmailFlow", "getOrder"]
    - path: "convex/emailActions.ts"
      provides: "sendEmailStep + sweepStaleSends internal actions ('use node')"
      contains: "use node"
    - path: "convex/crons.ts"
      provides: "hourly email-retry-sweep cron"
      contains: "cronJobs"
    - path: "packages/emails/src/charity.ts"
      provides: "buildFundedCharityQuery, buildOtherCharitiesQuery, buildFundedSinceCountQuery, orderMsToIsoDate"
      exports: ["buildFundedCharityQuery", "buildOtherCharitiesQuery", "buildFundedSinceCountQuery", "orderMsToIsoDate"]
  key_links:
    - from: "convex/stripeOrders.ts"
      to: "internal.emailFlow.enqueueEmailFlow"
      via: "ctx.scheduler.runAfter(0, ...) inside insert, try/catch wrapped"
      pattern: "enqueueEmailFlow"
    - from: "convex/emailFlow.ts"
      to: "internal.emailActions.sendEmailStep"
      via: "ctx.scheduler.runAfter(offsetForStep(step), ...)"
      pattern: "sendEmailStep"
    - from: "convex/emailActions.ts"
      to: "internal.emailSends.getByOrderStep"
      via: "ctx.runQuery idempotency gate before send"
      pattern: "getByOrderStep"
---

<objective>
Build the Convex scheduling engine: wire `stripeOrders.insert` to fire `enqueueEmailFlow`, which schedules all 8 `sendEmailStep` internal actions at the purchase-anchored offsets and records each as an idempotent `emailSends` row (with its `scheduledFnId` so unsubscribe can cancel it). `sendEmailStep` resolves charity data from Sanity, renders the step's email via a render seam, and sends through the provider abstraction (live OFF by default). An hourly cron sweep recovers stale/failed steps (Convex scheduled actions are at-most-once). Pure GROQ builders for charity personalization are unit-tested.

Purpose: This is the heart of the lifecycle — offset correctness (EMAIL-01), idempotency (EMAIL-02), suppression (EMAIL-03), missing-email skip (EMAIL-09). Templates land in Plan 20-04; this plan calls a `renderEmailStep(step, data)` seam that 20-04 fills (here it returns a minimal placeholder so the engine is testable without templates).
Output: emailFlow + emailActions + crons + the stripeOrders enqueue hook + pure charity GROQ builders, deployed to dev.
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
@convex/stripeOrders.ts
@convex/schema.ts

<interfaces>
<!-- Contracts from Plans 20-01 / 20-02 the executor uses directly. -->

From @eisenbalm/emails (Plan 20-01):
  OFFSETS_MS: readonly number[]   (index 0 == step 1)
  offsetForStep(step): number ; isMarketingStep(step): boolean
  STEP_STREAM: Record<number,'transactional'|'marketing'>
  SUBJECTS: Record<number,string>
  shouldSuppressStep(step, subscriber): boolean ; shouldSendStep(existing): boolean
  generateUnsubscribeToken(): string
  selectProvider(env): SendEmailProvider   (FakeEmailProvider unless EMAIL_LIVE_SEND==='true' && RESEND_API_KEY)

From convex/emailSends.ts + convex/emailSubscribers.ts (Plan 20-02), as internal.emailSends.* / internal.emailSubscribers.*:
  getByOrderStep({orderId, step}) -> row|null
  insertScheduled({orderId, email, step, scheduledFnId?}) -> _id
  markSent({orderId, step, providerMessageId}); markFailed({orderId, step, errorMessage}); markSkipped({orderId, email, step})
  getByEmail({email}) -> subscriber|null ; getByToken({token}) ; upsertSubscriber({email, unsubscribeToken, source}) -> _id

stripeOrders row fields (convex/schema.ts): sessionId, eventId, amountTotal, currency, customerEmail?(optional), charitySlug?(optional), createdAt.

Convex rules (20-RESEARCH §Anti-Patterns): actions CANNOT use ctx.db — use ctx.runQuery / ctx.runMutation. Only internalAction can call fetch/external. emailActions.ts FIRST LINE must be the directive "use node". 

Sanity CDN query URL (20-RESEARCH §Pattern 4):
  https://${NEXT_PUBLIC_SANITY_PROJECT_ID}.api.sanity.io/v2024-01-01/data/query/production?query=<encoded GROQ>

weeklyIssue 'published' literal is 'published' (verified). publishDate is a Sanity date (ISO string). charity resolved via charity->. charity fields: name, location, focusArea, missionStatement, slug.current.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pure charity GROQ builders (E5/E6 funded, E7 others, E8 count)</name>
  <read_first>packages/emails/src/index.ts, .planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-RESEARCH.md, docs/API_CONTRACTS.md</read_first>
  <files>packages/emails/src/charity.ts, packages/emails/src/index.ts, apps/web/__tests__/email-charity-queries.test.ts</files>
  <behavior>
    - buildFundedCharityQuery('nap-ministry') contains: _type == "charity", slug.current == "nap-ministry", name, location, focusArea, missionStatement
    - buildOtherCharitiesQuery('nap-ministry') contains: _type == "weeklyIssue", status == "published", charity->slug.current != "nap-ministry", order(issueNumber desc), [0...3]
    - buildFundedSinceCountQuery('2026-06-01') contains: count(, publishDate > "2026-06-01"
    - buildFundedCharityQuery(undefined) === null
    - orderMsToIsoDate(0) === '1970-01-01'
  </behavior>
  <action>
Create `packages/emails/src/charity.ts` with pure GROQ-string builders (no fetch — fetching happens in the Convex action). Defensively strip `"` from interpolated slug/date:
- `buildFundedCharityQuery(charitySlug)`: returns null when falsy, else `*[_type == "charity" && slug.current == "${s}"][0]{name, location, focusArea, missionStatement}`.
- `buildOtherCharitiesQuery(charitySlug)`: `*[_type == "weeklyIssue" && status == "published" && charity->slug.current != "${s}"] | order(issueNumber desc)[0...3]{ "charity": charity->{name, "slug": slug.current, location, focusArea, missionStatement} }` (s = slug or '').
- `buildFundedSinceCountQuery(orderDateIso)`: `count(*[_type == "weeklyIssue" && status == "published" && publishDate > "${d}"])`.
- `orderMsToIsoDate(ms)`: `new Date(ms).toISOString().slice(0,10)`.

Add `export * from './charity'` to `packages/emails/src/index.ts`.

Create `apps/web/__tests__/email-charity-queries.test.ts` encoding the behaviors with substring assertions.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/web && npx vitest run __tests__/email-charity-queries.test.ts</automated>
  </verify>
  <acceptance_criteria>
- Test green with substring assertions listed in behavior.
- `buildFundedCharityQuery(undefined) === null` asserted.
- `buildOtherCharitiesQuery('nap-ministry')` excludes the buyer's own slug (`!= "nap-ministry"`) asserted.
- Builders exported from the `@eisenbalm/emails` barrel.
  </acceptance_criteria>
  <done>Three GROQ builders + iso-date helper, unit-tested, exported.</done>
</task>

<task type="auto">
  <name>Task 2: enqueueEmailFlow + getOrder + stripeOrders.insert hook + planEnqueue helper</name>
  <read_first>convex/stripeOrders.ts, convex/emailSends.ts, convex/emailSubscribers.ts, .planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-RESEARCH.md</read_first>
  <files>convex/emailFlow.ts, convex/stripeOrders.ts, packages/emails/src/enqueuePlan.ts, packages/emails/src/index.ts, apps/web/__tests__/email-enqueue-missing-email.test.ts</files>
  <action>
Add a pure helper `packages/emails/src/enqueuePlan.ts`:
```typescript
export interface OrderLike { customerEmail?: string | null }
export function planEnqueue(order: OrderLike): { skip: boolean; steps: number[] } {
  const steps = [1, 2, 3, 4, 5, 6, 7, 8]
  return { skip: !order.customerEmail, steps }
}
```
Add `export * from './enqueuePlan'` to the barrel.

Create `convex/emailFlow.ts`:
- `getOrder = internalQuery({ args:{ orderId: v.id('stripeOrders') }, handler: async (ctx,{orderId}) => ctx.db.get(orderId) })` — actions use this to read the order.
- `enqueueEmailFlow = internalMutation({ args:{ orderId: v.id('stripeOrders') }, handler })`:
  1. `const order = await ctx.db.get(orderId)`; if `!order` return.
  2. `const plan = planEnqueue(order)` (imported from `@eisenbalm/emails`).
  3. If `plan.skip`: for each step in `plan.steps` `await ctx.runMutation(internal.emailSends.markSkipped, { orderId, email: '', step })`; return. NEVER throw.
  4. Else: `const token = generateUnsubscribeToken()`; `await ctx.runMutation(internal.emailSubscribers.upsertSubscriber, { email: order.customerEmail, unsubscribeToken: token, source: 'post-purchase-flow' })`.
  5. For each step in `plan.steps`: `const fnId = await ctx.scheduler.runAfter(offsetForStep(step), internal.emailActions.sendEmailStep, { orderId, step })`; `await ctx.runMutation(internal.emailSends.insertScheduled, { orderId, email: order.customerEmail, step, scheduledFnId: fnId as unknown as string })`.
  Import `planEnqueue, offsetForStep, generateUnsubscribeToken` from `@eisenbalm/emails`; `internalMutation, internalQuery` from `./_generated/server`; `internal` from `./_generated/api`; `v` from `convex/values`.

Extend `convex/stripeOrders.ts` `insert` (additive — args + behavior unchanged, preserving API_CONTRACTS §6 and the webhook contract): after the `ctx.db.insert('stripeOrders', {...})` capturing `orderId`, add:
```typescript
try {
  await ctx.scheduler.runAfter(0, internal.emailFlow.enqueueEmailFlow, { orderId })
} catch (err) {
  console.error('[emailFlow] enqueue scheduling failed; order recorded:', err)
}
return orderId
```
Change the final `return null` to `return orderId` (handlers.ts ignores the return value — confirmed in apps/web/lib/stripe/handlers.ts maybeRecordOrder — so this is safe). Import `internal` from `./_generated/api` at top of stripeOrders.ts.

Create `apps/web/__tests__/email-enqueue-missing-email.test.ts` testing `planEnqueue`: `planEnqueue({}) → { skip:true, steps:[1..8] }`; `planEnqueue({ customerEmail:'a@b.c' }) → { skip:false, steps:[1..8] }`. enqueueEmailFlow calls this same helper, so the unit test covers the real decision.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/web && npx vitest run __tests__/email-enqueue-missing-email.test.ts && cd /Users/user/Desktop/Eisenbalm && grep -q "enqueueEmailFlow" convex/stripeOrders.ts && grep -q "return orderId" convex/stripeOrders.ts && grep -q "scheduledFnId" convex/emailFlow.ts && grep -q "markSkipped" convex/emailFlow.ts && echo OK</automated>
  </verify>
  <acceptance_criteria>
- `email-enqueue-missing-email.test.ts` green (planEnqueue skip true/false).
- `convex/emailFlow.ts` schedules with `offsetForStep(step)` and stores `scheduledFnId` via `insertScheduled`.
- `convex/stripeOrders.ts` calls `internal.emailFlow.enqueueEmailFlow` inside try/catch and `return orderId`.
- enqueueEmailFlow missing-email path has no `throw` (grep shows markSkipped loop + early return).
  </acceptance_criteria>
  <done>Enqueue wired fire-and-forget to order insert; missing-email path marks skipped; planEnqueue unit-tested.</done>
</task>

<task type="auto">
  <name>Task 3: sendEmailStep + sweepStaleSends actions + crons.ts + render seam</name>
  <read_first>convex/emailFlow.ts, convex/emailSends.ts, convex/emailSubscribers.ts, .planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-RESEARCH.md</read_first>
  <files>convex/emailActions.ts, convex/emailSends.ts, convex/crons.ts, packages/emails/src/render.ts, packages/emails/src/index.ts</files>
  <action>
Add a render seam in `packages/emails/src/render.ts` (Plan 20-04 replaces the body with real React Email templates; KEEP THIS SIGNATURE STABLE):
```typescript
export interface RenderData {
  order: { customerEmail?: string | null; charitySlug?: string | null; amountTotal: number; createdAt: number }
  charity?: { name: string; location?: string; focusArea?: string; missionStatement?: string } | null
  others?: Array<{ name: string }> | null
  fundedMoreCount?: number | null
  unsubscribeToken?: string | null
  postalAddress?: string | null
}
export async function renderEmailStep(step: number, data: RenderData): Promise<string> {
  // PLACEHOLDER — Plan 20-04 swaps this for React Email render(). Keep async + signature.
  return `<p>step ${step}</p>`
}
```
Add `export * from './render'` to the barrel.

Add to `convex/emailSends.ts` an `internalQuery listStaleScheduled = internalQuery({ args:{}, handler })` reading `by_status` index `.eq('status','scheduled')`, returning the first 100 rows.

Create `convex/emailActions.ts` with FIRST LINE `"use node"`. Import `internalAction` from `./_generated/server`, `internal` from `./_generated/api`, `v` from `convex/values`, and from `@eisenbalm/emails`: `shouldSuppressStep, shouldSendStep, isMarketingStep, STEP_STREAM, SUBJECTS, selectProvider, buildFundedCharityQuery, buildOtherCharitiesQuery, buildFundedSinceCountQuery, orderMsToIsoDate, offsetForStep, renderEmailStep`.

`sendEmailStep = internalAction({ args:{ orderId: v.id('stripeOrders'), step: v.number() }, handler })`:
  1. `const existing = await ctx.runQuery(internal.emailSends.getByOrderStep, { orderId, step })`; if `!shouldSendStep(existing)` return (EMAIL-02).
  2. `const order = await ctx.runQuery(internal.emailFlow.getOrder, { orderId })`; if `!order?.customerEmail` { `await ctx.runMutation(internal.emailSends.markSkipped, { orderId, email:'', step })`; return }.
  3. `const subscriber = await ctx.runQuery(internal.emailSubscribers.getByEmail, { email: order.customerEmail })`; if `shouldSuppressStep(step, subscriber)` return (EMAIL-03).
  4. Resolve charity via fetch to Sanity CDN, each in try/catch (failure → null):
     - steps 1-6: `buildFundedCharityQuery(order.charitySlug)` → charity (null → fallback copy).
     - step 7: `buildOtherCharitiesQuery(order.charitySlug)` → others[].
     - step 8: `buildFundedSinceCountQuery(orderMsToIsoDate(order.createdAt))` → fundedMoreCount (parse the numeric `result`).
     Build URL with `process.env.NEXT_PUBLIC_SANITY_PROJECT_ID` and `encodeURIComponent(groq)`.
  5. `const html = await renderEmailStep(step, { order, charity, others, fundedMoreCount, unsubscribeToken: subscriber?.unsubscribeToken, postalAddress: process.env.EMAIL_POSTAL_ADDRESS })`.
  6. Headers: if `isMarketingStep(step)` && `subscriber?.unsubscribeToken`: `{ 'List-Unsubscribe': `<${process.env.NEXT_PUBLIC_BASE_URL}/api/email/unsubscribe?token=${subscriber.unsubscribeToken}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' }`. Transactional → `{}` (NO unsubscribe headers — 20-RESEARCH Anti-Pattern).
  7. `const from = STEP_STREAM[step]==='transactional' ? process.env.EMAIL_FROM_TRANSACTIONAL! : process.env.EMAIL_FROM_MARKETING!`.
  8. `const provider = selectProvider(process.env)` (live OFF by default). `try { const res = await provider.send({ from, to: order.customerEmail, subject: SUBJECTS[step], html, headers }); await ctx.runMutation(internal.emailSends.markSent, { orderId, step, providerMessageId: res.id }) } catch (err) { await ctx.runMutation(internal.emailSends.markFailed, { orderId, step, errorMessage: String(err) }) }`.

`sweepStaleSends = internalAction({ args:{}, handler })`: `const rows = await ctx.runQuery(internal.emailSends.listStaleScheduled, {})`; for each row where `row.createdAt + offsetForStep(row.step) < Date.now() - 3600_000` call `await ctx.scheduler.runAfter(0, internal.emailActions.sendEmailStep, { orderId: row.orderId, step: row.step })`. Idempotency in sendEmailStep makes this safe (20-RESEARCH Gotcha 4/5).

Create `convex/crons.ts`:
```typescript
import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'
const crons = cronJobs()
crons.hourly('email-retry-sweep', { minuteUTC: 30 }, internal.emailActions.sweepStaleSends, {})
export default crons
```
Deploy to dev: `pnpm --filter @eisenbalm/convex dev:once`.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && head -1 convex/emailActions.ts | grep -q 'use node' && grep -q "getByOrderStep" convex/emailActions.ts && grep -q "shouldSuppressStep" convex/emailActions.ts && grep -q "List-Unsubscribe-Post" convex/emailActions.ts && grep -q "sweepStaleSends" convex/crons.ts && pnpm --filter @eisenbalm/convex dev:once >/tmp/cvx20b.log 2>&1 && echo DEPLOY_OK || (echo "see /tmp/cvx20b.log"; head -1 convex/emailActions.ts | grep -q 'use node' && grep -q "List-Unsubscribe-Post" convex/emailActions.ts && echo STATIC_OK)</automated>
  </verify>
  <acceptance_criteria>
- `convex/emailActions.ts` first line is `"use node"`.
- Idempotency gate present: `shouldSendStep(existing)` check before send.
- Suppression gate present: `shouldSuppressStep(step, subscriber)` early-return for marketing.
- Marketing branch sets BOTH `List-Unsubscribe` and `List-Unsubscribe-Post`; transactional branch sets neither.
- `selectProvider(process.env)` is the only send path (live OFF by default).
- `convex/crons.ts` registers `email-retry-sweep` → `sweepStaleSends`.
- `pnpm --filter @eisenbalm/convex dev:once` deploys without schema/function errors (or STATIC_OK if dev deploy unavailable in CI).
  </acceptance_criteria>
  <done>sendEmailStep idempotent + suppression-aware + header-correct; sweep + cron registered; render seam stable for 20-04.</done>
</task>

</tasks>

<verification>
- `cd apps/web && npx vitest run __tests__/email-charity-queries.test.ts __tests__/email-enqueue-missing-email.test.ts` → green.
- `grep -n "List-Unsubscribe" convex/emailActions.ts` shows headers only in the marketing branch.
- `pnpm --filter @eisenbalm/convex dev:once` deploys schema + emailFlow + emailActions + crons.
</verification>

<success_criteria>
- Order insert enqueues 8 scheduled steps at correct offsets (fire-and-forget).
- sendEmailStep idempotent + suppression-aware; marketing headers correct; live OFF by default.
- Cron sweep recovers stale steps safely.
- Charity GROQ builders unit-tested.
</success_criteria>

<output>
After completion, create `.planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-03-SUMMARY.md`
</output>
