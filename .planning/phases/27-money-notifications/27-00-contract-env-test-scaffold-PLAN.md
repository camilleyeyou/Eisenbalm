---
phase: 27-money-notifications
plan: 00
type: execute
wave: 0
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - apps/web/__tests__/stripe-reconciliation.test.ts
  - apps/web/__tests__/notifications-ledger.test.ts
  - apps/web/__tests__/model-pricing-staleness.test.ts
autonomous: false
requirements: [RCN-01, RCN-02, NTF-01, NTF-02]
user_setup:
  - service: stripe
    why: "Stripe fee reconciliation internalAction runs in Convex's node env; STRIPE_SECRET_KEY is currently only in apps/web env"
    env_vars:
      - name: STRIPE_SECRET_KEY
        source: "Existing test-mode key from apps/web/.env.local — set into Convex env via `npx convex env set STRIPE_SECRET_KEY sk_test_...`"

must_haves:
  truths:
    - "docs/API_CONTRACTS.md contains a §27 section defining finance queries, payouts table+mutations, notificationsLedger table+config keys, and the Slack provider shape — written BEFORE any schema or code change (D-14 contract-first)"
    - "STRIPE_SECRET_KEY is present in the Convex deployment environment (npx convex env list shows it)"
    - "Three Vitest test files exist as the Wave 0 RED scaffold for RCN-01, NTF-01/02, and D-13 staleness"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§27 contract — finance/payouts/notifications/slack shapes"
      contains: "## 27."
    - path: "apps/web/__tests__/stripe-reconciliation.test.ts"
      provides: "RCN-01 gross/net/fee aggregation + sales-window attribution tests"
    - path: "apps/web/__tests__/notifications-ledger.test.ts"
      provides: "NTF-01/02 idempotency, flag-off skip, channel dispatch, budget trigger tests"
    - path: "apps/web/__tests__/model-pricing-staleness.test.ts"
      provides: "D-13 30-day staleness boundary tests"
  key_links:
    - from: "docs/API_CONTRACTS.md §27"
      to: "all Wave 1+ plans"
      via: "contract-first discipline — schema/code follow the contract"
      pattern: "## 27\\."
---

<objective>
Establish the Phase 27 foundation: amend `docs/API_CONTRACTS.md` with a new §27 (the mandatory contract-first step per CLAUDE.md D-14), set `STRIPE_SECRET_KEY` in the Convex environment, and create the three Vitest test files that form the Wave 0 RED scaffold for the validation strategy.

Purpose: D-14 is a non-negotiable hard rule — no schema or code may change before the contract exists. The Stripe env var is a hard prerequisite (no fallback) for the finance internalAction. The three test files unblock every downstream task's `<verify>` step.
Output: §27 contract section, Convex env var set, three test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/27-money-notifications/27-CONTEXT.md
@.planning/phases/27-money-notifications/27-RESEARCH.md
@.planning/phases/27-money-notifications/27-VALIDATION.md

<interfaces>
<!-- Shapes the §27 contract must specify, extracted from RESEARCH.md (all HIGH confidence, code-read). -->

SendEmailProvider (packages/emails/src/provider.ts):
```typescript
export interface SendEmailParams { from: string; to: string; subject: string; html: string; headers?: Record<string, string> }
export interface SendEmailProvider { send(params: SendEmailParams): Promise<{ id: string }> }
export function selectProvider(env: ProviderEnv): SendEmailProvider
```

stripeOrders existing fields (convex/schema.ts:134 — FROZEN, additive-only):
  sessionId, eventId, amountTotal (cents, gross), currency, customerEmail, charitySlug, createdAt,
  amountSubtotal (cents), amountShipping, donationAmount (== amountSubtotal, 100%-to-charity net), customerName, phone, shippingAddress
  → Phase 27 ADDITIVE field to specify in §27: stripeFee: v.optional(v.number())  (cached Stripe fee in cents)

model_pricing existing fields (convex/schema.ts:341 — FROZEN, read-only this phase):
  workspace_id, model, inputPricePer1M (USD), outputPricePer1M (USD), updatedAt

auditLog.write signature (convex/auditLog.ts — internalMutation):
  { workspace_id, actorId, action, resourceType?, resourceId?, before?, after? }  (timestamp server-side)

Stripe fee fetch path (D-08, sessionId path — NO paymentIntentId field exists):
  stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent.latest_charge.balance_transaction'] })
  → fee = (session.payment_intent as PaymentIntent).latest_charge.balance_transaction.fee  (cents)
  API version pin: '2025-04-30.basil'
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend docs/API_CONTRACTS.md with §27 (contract-first, D-14)</name>
  <read_first>
    - docs/API_CONTRACTS.md (read the tail — current content ends ~line 2229; line ~2110 names the "Phase 27 NTF hook"; match the existing markdown heading/formatting conventions)
    - .planning/phases/27-money-notifications/27-CONTEXT.md (D-06 config keys, D-07 ledger key, D-08 fee path, D-10 attribution, D-11 payouts table, D-13 staleness)
    - .planning/phases/27-money-notifications/27-RESEARCH.md (Pattern 1-6, "Additive schema additions required" code block, "Critical Gap" Option B)
    - convex/schema.ts (stripeOrders ~134, model_pricing ~341 — to specify additive fields against frozen shapes)
  </read_first>
  <action>
    Append a new top-level section `## 27. Money + Notifications (Phase 27)` to docs/API_CONTRACTS.md. It MUST document the following sub-sections with exact shapes (these become the source of truth all Wave 1+ plans implement against):

    **27.1 Finance queries (RCN-01).** Document a Convex query `finance:perIssueRevenue` returning, per published issue: `{ issueNumber, issueId, charitySlug, charityName, windowStart, windowEnd (null for latest/open), orderCount, grossCents, feeCents (nullable until fetched), netCents }`. State that gross = sum of `stripeOrders.amountTotal`, net = sum of `stripeOrders.donationAmount` (== `amountSubtotal`, the 100%-to-charity figure), fee = sum of cached `stripeOrders.stripeFee`. State explicitly: reconciliation is computed from actuals, NEVER from `model_pricing` (D-08). Document the sales-window attribution rule (D-10): an order attributes to the issue whose window is `[issue.publishedAt, nextIssue.publishedAt)`, matched by `charitySlug`; the latest issue's window upper bound is `nextIssuePublishedAt ?? Date.now()` (open window). Document an "Unattributed orders" fallback bucket for orders not matching any window.

    **27.2 Stripe fee reconciliation (RCN-01, D-08).** Document that fees are fetched via the sessionId path (the `paymentIntentId` field does NOT exist in `stripeOrders`): `stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent.latest_charge.balance_transaction'] })`, fee in cents from `balance_transaction.fee`, API version `'2025-04-30.basil'`. Document the additive cache field `stripeOrders.stripeFee: v.optional(v.number())` (cents) — written once per order by an internalAction; subsequent reads skip the API. State STRIPE_SECRET_KEY must be in the Convex env (not apps/web only).

    **27.3 payouts table (RCN-02, D-11).** Document the additive `payouts` table: `{ workspace_id: string, issueNumber: number, issueId?: string, charitySlug: string, amount: number (net cents), status: 'pending' | 'sent', sentAt?: number, reference?: string, actor?: string, createdAt: number, updatedAt: number }` with indexes `by_workspace_issueNumber` and `by_workspace_status`. Document mutations `payouts:markPayoutSent({ payoutId, reference, sentAt })` — Clerk-JWT-guarded (`ctx.auth.getUserIdentity()`), audit-logged via `internal.auditLog.write` with `action: 'payout:markSent'` and before/after JSON (D-12, AUD-01). Document a query `payouts:listByWorkspace` for the dashboard.

    **27.4 notificationsLedger table + config keys (NTF-01/02, D-06/D-07).** Document the additive `notificationsLedger` table: `{ workspace_id: string, runId: string (or eventKey for budget), eventType: string ('complete' | 'failed' | 'awaiting-review' | 'budget'), channel: string ('email' | 'slack'), status: 'queued' | 'sent' | 'failed' | 'skipped', providerId?: string, sentAt?: number, errorMessage?: string, createdAt: number }` with indexes `by_runId_eventType_channel` and `by_workspace_createdAt`. Document the idempotency key `(runId|eventKey, eventType, channel)` (D-07) and the two-step `insertScheduled`/`markSent`/`markFailed`/`markSkipped` pattern mirroring `emailSends`. Document the `pipeline_config` keys (D-06): `notify_email`, `notify_slack_webhook_url`, `notify_on_complete`, `notify_on_failed`, `notify_on_awaiting_review`, `notify_on_budget`.

    **27.5 Notification dispatch seams (NTF-01/02, D-01/D-04/D-05).** Document that notifications originate Convex-side (no Python egress). Run complete/failed/awaiting-review dispatch from `pipelineRuns:updateStatus` via `scheduler.runAfter(0, internal.notificationActions.sendNotification, { runId, eventType: status })`. Budget dispatch from the `deliberationEvents:insert` mutation when `eventType === 'cost-warning'` → dispatch with `eventType: 'budget'`. State the `deliberationEvents.eventType` union stays FROZEN (reuse `cost-warning`, do not add literals — D-04).

    **27.6 Slack provider shape (NTF-01, D-02).** Document `SlackWebhookProvider implements SendEmailProvider` in `packages/emails/src/slackProvider.ts`: constructor takes `webhookUrl: string`; `send(params)` POSTs `{ text: params.subject + '\n' + stripHtml(params.html) }` to the webhook via native `fetch`; throws on `!res.ok`; returns `{ id: 'slack-<ts>' }`. No new npm package. Document `selectSlackProvider(webhookUrl): SendEmailProvider`.

    Close the section with a frozen-shapes note: "All Phase 27 schema changes are additive. Frozen shapes: stripeOrders (except additive stripeFee), model_pricing, emailSends, deliberationEvents.eventType union — unchanged."
  </action>
  <verify>
    <automated>grep -q "## 27\." docs/API_CONTRACTS.md && grep -q "notificationsLedger" docs/API_CONTRACTS.md && grep -q "markPayoutSent" docs/API_CONTRACTS.md && grep -q "notify_slack_webhook_url" docs/API_CONTRACTS.md && grep -q "SlackWebhookProvider" docs/API_CONTRACTS.md && grep -q "balance_transaction" docs/API_CONTRACTS.md && echo CONTRACT_OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "## 27\." docs/API_CONTRACTS.md` returns >= 1
    - docs/API_CONTRACTS.md contains all of: `notificationsLedger`, `payouts`, `markPayoutSent`, `stripeFee`, `notify_email`, `notify_slack_webhook_url`, `notify_on_complete`, `notify_on_failed`, `notify_on_awaiting_review`, `notify_on_budget`, `SlackWebhookProvider`, `selectSlackProvider`, `balance_transaction`, `2025-04-30.basil`, `Unattributed`
    - docs/API_CONTRACTS.md contains the string `additive` within the §27 frozen-shapes note and lists `deliberationEvents.eventType` as frozen
  </acceptance_criteria>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: Set STRIPE_SECRET_KEY in the Convex environment</name>
  <what-built>The §27 contract specifies fee fetches run in a Convex internalAction. STRIPE_SECRET_KEY is currently only in apps/web env; Convex env is separate and must carry the test-mode key. This is a hard prerequisite with NO fallback (the finance internalAction fails silently without it).</what-built>
  <read_first>
    - .planning/phases/27-money-notifications/27-RESEARCH.md (Pitfall 3, Environment Availability table, Open Question 3)
    - apps/web/.env.local (read to copy the existing test-mode STRIPE_SECRET_KEY value — do NOT print the secret in any committed file)
  </read_first>
  <action>
    Set the existing test-mode STRIPE_SECRET_KEY into the Convex deployment environment (the `modest-magpie-797` deployment). Convex env is separate from the apps/web Next.js env; the finance internalAction reads `process.env.STRIPE_SECRET_KEY` from Convex's node runtime. Run `npx convex env set STRIPE_SECRET_KEY sk_test_...` using the value copied from apps/web/.env.local. Do not commit the secret to any file.
  </action>
  <how-to-verify>
    1. From the repo root run `npx convex env list` and confirm `STRIPE_SECRET_KEY` is NOT yet present.
    2. Copy the existing test-mode key from apps/web/.env.local.
    3. Run `npx convex env set STRIPE_SECRET_KEY sk_test_...` (use the actual value; against the `modest-magpie-797` deployment).
    4. Re-run `npx convex env list` and confirm `STRIPE_SECRET_KEY` now appears.
  </how-to-verify>
  <acceptance_criteria>
    - `npx convex env list` output contains the line `STRIPE_SECRET_KEY`
    - No Stripe secret value is committed to any file in the repo (verify the key only lives in Convex env + apps/web/.env.local which is gitignored)
  </acceptance_criteria>
  <resume-signal>Type "set" once `npx convex env list` shows STRIPE_SECRET_KEY, or describe the issue.</resume-signal>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create the three Wave 0 Vitest RED scaffolds</name>
  <read_first>
    - apps/web/vitest.config.ts (confirm config + how existing __tests__ are structured)
    - apps/web/__tests__/issue-page-typography.test.ts (an existing test file — mirror its import style, describe/it structure, and Vitest conventions)
    - docs/API_CONTRACTS.md §27 (the just-written contract — tests assert against these shapes)
    - .planning/phases/27-money-notifications/27-VALIDATION.md (Wave 0 Requirements — exact behaviors each file must cover)
  </read_first>
  <behavior>
    stripe-reconciliation.test.ts:
    - Test: a pure helper `reconcileIssue(orders, fees)` computes grossCents = sum(amountTotal), netCents = sum(donationAmount), feeCents = sum(stripeFee); gross − fee should equal net for a clean order set (assert the arithmetic identity on a fixture).
    - Test: `attributeOrderToWindow(order, issues)` attributes by charitySlug + createdAt within [publishedAt, nextPublishedAt); the latest issue uses Date.now() upper bound (open window); an order outside all windows returns the 'unattributed' bucket.
    notifications-ledger.test.ts:
    - Test: idempotency — given a ledger row with status 'sent' for (runId, eventType, channel), a second dispatch decision is a no-op (returns skip).
    - Test: config-flag-off — when `notify_on_complete` is false, the dispatch decision for a 'complete' event is skip.
    - Test: per-channel dispatch — with both email + slack configured and enabled, the dispatch yields one decision per channel.
    - Test: budget trigger — a `cost-warning` deliberationEvent maps to eventType 'budget' for dispatch.
    model-pricing-staleness.test.ts:
    - Test: `isStale(updatedAt, now)` is false when updatedAt is exactly 30 days ago, false when < 30 days, true when > 30 days (threshold = 30*24*60*60*1000 ms).
  </behavior>
  <action>
    Create the three test files under `apps/web/__tests__/`. Each file imports the (not-yet-existing or pure-helper) functions it tests. Where the production helper does not exist yet, write the test against the intended import path and mark the file so it is RED until the implementing task lands — use a placeholder import that the implementing plan will satisfy (e.g. `import { reconcileIssue, attributeOrderToWindow } from '@/lib/finance/reconcile'`, `import { decideDispatch } from '@/lib/notifications/dispatch'`, `import { isStale } from '@/lib/finance/staleness'`). These import paths are the contract the Wave 2 plans implement.

    Use the 30-day constant `const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000` in the staleness test. Use fixtures with explicit cent values (e.g. amountTotal 899, donationAmount 850, stripeFee 49 → gross 899 = net 850 + fee 49). Mirror the describe/it style of `apps/web/__tests__/issue-page-typography.test.ts`. These tests are EXPECTED to fail (RED) until Wave 2 implements the helpers — that is correct Wave 0 behavior.
  </action>
  <verify>
    <automated>test -f apps/web/__tests__/stripe-reconciliation.test.ts && test -f apps/web/__tests__/notifications-ledger.test.ts && test -f apps/web/__tests__/model-pricing-staleness.test.ts && grep -q "reconcileIssue" apps/web/__tests__/stripe-reconciliation.test.ts && grep -q "decideDispatch" apps/web/__tests__/notifications-ledger.test.ts && grep -q "isStale" apps/web/__tests__/model-pricing-staleness.test.ts && echo TESTS_SCAFFOLDED</automated>
  </verify>
  <acceptance_criteria>
    - All three files exist under apps/web/__tests__/
    - stripe-reconciliation.test.ts references `reconcileIssue` and `attributeOrderToWindow` and contains an assertion that gross − fee === net
    - notifications-ledger.test.ts references `decideDispatch`, asserts idempotency no-op, flag-off skip, per-channel decisions, and budget mapping from `cost-warning`
    - model-pricing-staleness.test.ts references `isStale` and `THIRTY_DAYS_MS` and tests the exactly-30-days / <30 / >30 boundary
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `grep "## 27\." docs/API_CONTRACTS.md` succeeds; §27 documents finance/payouts/notifications/slack shapes.
- `npx convex env list` shows STRIPE_SECRET_KEY.
- Three test files exist and reference their helper import paths (RED is expected at this wave).
</verification>

<success_criteria>
- D-14 satisfied: §27 contract written BEFORE any schema/code change.
- STRIPE_SECRET_KEY in Convex env (RCN-01 prerequisite met).
- Three Vitest RED scaffolds in place, defining the helper import-path contracts Wave 2 implements.
</success_criteria>

<output>
After completion, create `.planning/phases/27-money-notifications/27-00-SUMMARY.md`
</output>
