---
phase: 27-money-notifications
plan: 03
type: execute
wave: 2
depends_on: ["27-01"]
files_modified:
  - packages/emails/src/slackProvider.ts
  - packages/emails/src/index.ts
  - apps/web/lib/notifications/dispatch.ts
  - convex/notifications.ts
  - convex/notificationActions.ts
  - convex/pipelineRuns.ts
  - convex/deliberationEvents.ts
files_owned_note: "NTF track. No overlap with Plan 02 (RCN track) files."
autonomous: true
requirements: [NTF-01, NTF-02]

must_haves:
  truths:
    - "A SlackWebhookProvider implementing SendEmailProvider sends a run alert to a Slack incoming webhook via native fetch (no new npm package)"
    - "Notifications dispatch from Convex (not the pipeline) when a run goes complete/failed/awaiting-review, and when a cost-warning budget event fires"
    - "Each (runId|eventKey, eventType, channel) sends at most once — idempotency ledger mirrors emailSends insertScheduled/markSent"
    - "A disabled per-event config flag (notify_on_*) skips dispatch for that event; an unconfigured channel is skipped cleanly"
    - "Dispatch is non-blocking — fired via scheduler.runAfter(0, internalAction), never inside the triggering mutation"
  artifacts:
    - path: "packages/emails/src/slackProvider.ts"
      provides: "SlackWebhookProvider + selectSlackProvider (NTF-01, D-02)"
      exports: ["SlackWebhookProvider", "selectSlackProvider"]
    - path: "apps/web/lib/notifications/dispatch.ts"
      provides: "decideDispatch pure decision helper (idempotency + flag-off + per-channel + budget mapping)"
      exports: ["decideDispatch"]
    - path: "convex/notifications.ts"
      provides: "notificationsLedger getByKey/insertScheduled/markSent/markFailed/markSkipped"
      exports: ["getByKey", "insertScheduled", "markSent"]
    - path: "convex/notificationActions.ts"
      provides: "sendNotification internalAction (config read + ledger gate + provider send)"
      exports: ["sendNotification"]
  key_links:
    - from: "convex/pipelineRuns.ts updateStatus"
      to: "convex/notificationActions.ts sendNotification"
      via: "ctx.scheduler.runAfter(0, internal.notificationActions.sendNotification, {runId, eventType: status})"
      pattern: "scheduler.runAfter"
    - from: "convex/deliberationEvents.ts insert (cost-warning)"
      to: "convex/notificationActions.ts sendNotification"
      via: "filter eventType==='cost-warning' then dispatch eventType budget"
      pattern: "cost-warning"
    - from: "convex/notificationActions.ts"
      to: "packages/emails slack+resend providers"
      via: "selectProvider(env) / selectSlackProvider(webhookUrl)"
      pattern: "selectSlackProvider"
---

<objective>
Build the operational notification backend (NTF-01/02): a Slack webhook provider behind the existing `packages/emails` selection seam, a pure dispatch-decision helper (unit-tested against the Wave 0 scaffold), a `notificationsLedger` idempotency module mirroring `emailSends`, a `sendNotification` internalAction, and the two Convex trigger seams (`pipelineRuns:updateStatus` for complete/failed/awaiting-review, `deliberationEvents:insert` for `cost-warning` then budget). All transport is Convex-side (D-01); the Python pipeline is untouched.

Purpose: Operator gets a Slack and/or email alert within 5 minutes (effectively instant, event-driven) of a run completing, failing, awaiting review, or crossing a budget threshold.
Output: 1 provider + 1 lib helper + 2 Convex modules + 2 seam edits. Wave 0 notifications test goes GREEN.
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

SendEmailProvider (packages/emails/src/provider.ts):
```typescript
export interface SendEmailParams { from: string; to: string; subject: string; html: string; headers?: Record<string, string> }
export interface SendEmailProvider { send(params: SendEmailParams): Promise<{ id: string }> }
export function selectProvider(env: ProviderEnv): SendEmailProvider  // Fake unless EMAIL_LIVE_SEND==='true' && RESEND_API_KEY
```

SlackWebhookProvider (RESEARCH Pattern 2):
```typescript
export class SlackWebhookProvider implements SendEmailProvider {
  constructor(private webhookUrl: string) {}
  async send(params: SendEmailParams): Promise<{ id: string }> {
    const text = params.subject + '\n' + stripHtml(params.html)
    const res = await fetch(this.webhookUrl, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text }) })
    if (!res.ok) throw new Error(`Slack webhook error: ${res.status}`)
    return { id: `slack-${Date.now()}` }
  }
}
export function selectSlackProvider(webhookUrl: string): SendEmailProvider { return new SlackWebhookProvider(webhookUrl) }
```

pipelineRuns:updateStatus (convex/pipelineRuns.ts:28) handler ends with `ctx.db.patch(run._id, updates)`. status union: 'running'|'awaiting-review'|'complete'|'failed'.

deliberationEvents:insert (convex/deliberationEvents.ts:31) handler ends with `ctx.db.insert('deliberationEvents', {...args, timestamp: Date.now()})`. eventType union is FROZEN — includes 'cost-warning'.

emailSends ledger pattern (convex/emailSends.ts): internalQuery getByOrderStep, internalMutation insertScheduled (status 'scheduled'), markSent/markFailed/markSkipped. Mirror with key (runId, eventType, channel) and status 'queued'/'sent'/'failed'/'skipped'.

pipeline_config keys (D-06): notify_email, notify_slack_webhook_url, notify_on_complete, notify_on_failed, notify_on_awaiting_review, notify_on_budget. Read via api.pipelineConfig.getAll then JSON.parse each row.value.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: SlackWebhookProvider + selectSlackProvider + pure decideDispatch helper</name>
  <read_first>
    - packages/emails/src/provider.ts (SendEmailProvider/SendEmailParams/selectProvider — implement the interface exactly; mirror ResendProvider's lazy/native style)
    - packages/emails/src/index.ts (the package's public export surface — add the Slack exports here)
    - apps/web/__tests__/notifications-ledger.test.ts (Wave 0 RED — exact decideDispatch signature + idempotency/flag-off/per-channel/budget cases)
    - docs/API_CONTRACTS.md §27.5 + §27.6 (dispatch seams + Slack shape)
  </read_first>
  <behavior>
    decideDispatch(input): given { eventType, configMap, ledgerRows } decide which channels to send on:
    - returns [] (skip all) when the matching notify_on_event flag is false/absent.
    - for each channel ('email' if notify_email set, 'slack' if notify_slack_webhook_url set) that is enabled: if a ledger row for (key, eventType, channel) already has status 'sent' or 'queued', that channel is a no-op (excluded); else included.
    - a 'cost-warning' source eventType maps to dispatch eventType 'budget'.
    - returns one decision per eligible, not-already-sent channel.
  </behavior>
  <action>
    1. Create `packages/emails/src/slackProvider.ts` exporting `SlackWebhookProvider` (implements `SendEmailProvider`, constructor `(webhookUrl: string)`, `send` POSTs `{ text: subject + '\n' + stripHtml(html) }` via native `fetch`, throws on `!res.ok`, returns `{ id: 'slack-' + Date.now() }`) and `selectSlackProvider(webhookUrl: string): SendEmailProvider`. Include a small local `stripHtml(html: string): string` (regex tag strip — no new dep). Do NOT add any npm package.

    2. Add `export * from './slackProvider'` (or named re-exports) to `packages/emails/src/index.ts`.

    3. Create `apps/web/lib/notifications/dispatch.ts` exporting the pure `decideDispatch` function matching the Wave 0 test's import path and signature. Map `cost-warning` to `'budget'`. The per-event flag keys are exactly: `notify_on_complete`, `notify_on_failed`, `notify_on_awaiting_review`, `notify_on_budget`. The channel-config keys are `notify_email` and `notify_slack_webhook_url`. Treat ledger status `'sent'` and `'queued'` as already-handled (idempotent no-op).
  </action>
  <verify>
    <automated>grep -q "class SlackWebhookProvider" packages/emails/src/slackProvider.ts && grep -q "selectSlackProvider" packages/emails/src/slackProvider.ts && grep -q "decideDispatch" apps/web/lib/notifications/dispatch.ts && cd apps/web && npx vitest run __tests__/notifications-ledger.test.ts --reporter=dot</automated>
  </verify>
  <acceptance_criteria>
    - packages/emails/src/slackProvider.ts exports `SlackWebhookProvider` and `selectSlackProvider`; SlackWebhookProvider implements SendEmailProvider and uses native `fetch`
    - `grep -rn "@slack/webhook\|require('slack'\|from 'slack'" packages/emails/src/slackProvider.ts` returns nothing (no new dep)
    - packages/emails/src/index.ts re-exports the Slack provider
    - apps/web/lib/notifications/dispatch.ts exports `decideDispatch`
    - `cd apps/web && npx vitest run __tests__/notifications-ledger.test.ts` exits 0 (GREEN)
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: convex/notifications.ts ledger + convex/notificationActions.ts sendNotification internalAction</name>
  <read_first>
    - convex/emailSends.ts (the full ledger: getByOrderStep/insertScheduled/markSent/markFailed/markSkipped — mirror exactly, re-keyed on runId+eventType+channel)
    - convex/emailActions.ts (the "use node" internalAction pattern: idempotency gate via ctx.runQuery, send via provider, mark via ctx.runMutation)
    - convex/pipelineConfig.ts (getAll query — config read pattern; JSON.parse each row.value)
    - packages/emails/src/provider.ts + packages/emails/src/slackProvider.ts (selectProvider + selectSlackProvider)
    - docs/API_CONTRACTS.md §27.4 + §27.5 (ledger contract + dispatch flow)
  </read_first>
  <action>
    1. Create `convex/notifications.ts` mirroring `emailSends.ts`, keyed on (runId, eventType, channel):
       - `getByKey` internalQuery, args `{ runId, eventType, channel }`, uses index `by_runId_eventType_channel`, returns the row or null.
       - `insertScheduled` internalMutation, args `{ workspace_id, runId, eventType, channel }`, inserts `{ ...args, status: 'queued', createdAt: Date.now() }` ONLY if no row exists (atomic check-and-insert via getByKey-then-insert in the same mutation); returns the _id.
       - `markSent` internalMutation, args `{ runId, eventType, channel, providerId }`, patches the row to `{ status: 'sent', providerId, sentAt: Date.now() }`.
       - `markFailed` internalMutation, args `{ runId, eventType, channel, errorMessage }`, patches `{ status: 'failed', errorMessage }`.
       - `markSkipped` internalMutation, args `{ runId, eventType, channel }`, patches `{ status: 'skipped' }`.

    2. Create `convex/notificationActions.ts` (`"use node"`) with `sendNotification` internalAction, args `{ runId: v.string(), eventType: v.string() }` (eventType one of 'complete'|'failed'|'awaiting-review'|'budget'):
       - Read config via `ctx.runQuery(api.pipelineConfig.getAll, { workspace_id })` and build a configMap (JSON.parse each row.value). Resolve workspace_id (use the existing project default 'eisenbalm' or read from run — match how other Convex actions resolve it).
       - Check the per-event flag (`notify_on_${eventType}`, mapping 'awaiting-review' to `notify_on_awaiting_review`). If false/absent, return (no send).
       - For each enabled channel: email when `notify_email` set, slack when `notify_slack_webhook_url` set. For each channel: `insertScheduled` (skips if already queued/sent → re-read getByKey; if status already 'sent' return). Build a `SendEmailParams` with subject like `Eisenbalm run ${runId}: ${eventType}` and a short html body. Send via `selectProvider(process.env)` (email) or `selectSlackProvider(webhookUrl)` (slack). On success `markSent({ ..., providerId })`; on throw `markFailed({ ..., errorMessage })`. Never throw out of the action (log + mark failed) so a transport failure never wedges the trigger.

    Run `npx convex codegen`.
  </action>
  <verify>
    <automated>grep -q "export const getByKey" convex/notifications.ts && grep -q "export const insertScheduled" convex/notifications.ts && grep -q "export const markSent" convex/notifications.ts && grep -q '"use node"' convex/notificationActions.ts && grep -q "export const sendNotification" convex/notificationActions.ts && grep -q "selectSlackProvider" convex/notificationActions.ts && cd convex && npx convex codegen 2>&1 | tail -1; echo NTF_BACKEND_DONE</automated>
  </verify>
  <acceptance_criteria>
    - convex/notifications.ts exports `getByKey`, `insertScheduled`, `markSent`, `markFailed`, `markSkipped`, all keyed on (runId, eventType, channel) and using index `by_runId_eventType_channel`
    - convex/notificationActions.ts begins with `"use node"` and exports `sendNotification`
    - sendNotification reads `notify_on_${eventType}` flags, references `notify_email` and `notify_slack_webhook_url`, and calls both `selectProvider` and `selectSlackProvider`
    - sendNotification calls `insertScheduled` before sending and `markSent`/`markFailed` after (two-step idempotency)
    - `npx convex codegen` exits without error
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 3: Wire the two Convex trigger seams (updateStatus + deliberationEvents.insert)</name>
  <read_first>
    - convex/pipelineRuns.ts (updateStatus mutation at line 28 — append the scheduler call AFTER ctx.db.patch; status values 'complete'|'failed'|'awaiting-review' map directly to eventType)
    - convex/deliberationEvents.ts (insert mutation at line 31 — append the cost-warning filter AFTER ctx.db.insert)
    - convex/notificationActions.ts (the sendNotification internalAction signature to dispatch to)
    - docs/API_CONTRACTS.md §27.5 (the seam contract + frozen eventType note)
  </read_first>
  <action>
    1. In `convex/pipelineRuns.ts` `updateStatus` handler, AFTER `await ctx.db.patch(run._id, updates)`, add a dispatch ONLY for the three notifiable statuses:
       ```typescript
       if (args.status === 'complete' || args.status === 'failed' || args.status === 'awaiting-review') {
         await ctx.scheduler.runAfter(0, internal.notificationActions.sendNotification, {
           runId: args.runId,
           eventType: args.status,
         })
       }
       ```
       Add the `internal` import if not present. Do NOT dispatch for `'running'`. Do NOT change the mutation's args/return shape.

    2. In `convex/deliberationEvents.ts` `insert` handler, AFTER `ctx.db.insert('deliberationEvents', {...args, timestamp: Date.now()})`, add:
       ```typescript
       if (args.eventType === 'cost-warning') {
         await ctx.scheduler.runAfter(0, internal.notificationActions.sendNotification, {
           runId: args.runId,
           eventType: 'budget',
         })
       }
       ```
       Do NOT add any new literal to the `eventType` union (it stays FROZEN — reuse `cost-warning`, D-04/D-15). Keep the existing insert return value.

    Run `npx convex codegen` to confirm the `internal.notificationActions.sendNotification` reference resolves.
  </action>
  <verify>
    <automated>grep -q "internal.notificationActions.sendNotification" convex/pipelineRuns.ts && grep -q "internal.notificationActions.sendNotification" convex/deliberationEvents.ts && grep -q "cost-warning" convex/deliberationEvents.ts && cd convex && npx convex codegen 2>&1 | tail -1; echo SEAMS_DONE</automated>
  </verify>
  <acceptance_criteria>
    - convex/pipelineRuns.ts dispatches `internal.notificationActions.sendNotification` via `ctx.scheduler.runAfter(0, ...)` ONLY for status complete/failed/awaiting-review (grep confirms no dispatch on 'running')
    - convex/deliberationEvents.ts dispatches `sendNotification` with `eventType: 'budget'` guarded by `args.eventType === 'cost-warning'`
    - `git diff convex/deliberationEvents.ts` shows NO change to the eventType `v.union(...)` literals
    - `npx convex codegen` exits without error (internal reference resolves)
  </acceptance_criteria>
</task>

</tasks>

<verification>
- `cd apps/web && npx vitest run __tests__/notifications-ledger.test.ts` GREEN.
- `npx convex codegen` clean with notifications.ts + notificationActions.ts + the two seam edits.
- Dispatch is via scheduler.runAfter (non-blocking) in both seams; deliberationEvents eventType union unchanged.
- End-to-end delivery is manual-only per VALIDATION.md row 27-03 (trigger a status change with a configured channel, confirm arrival + ledger 'sent').
</verification>

<success_criteria>
- NTF-01: Slack and/or email alert on run complete/failed/awaiting-review, idempotent per channel, config-gated.
- NTF-02: budget alert fires off the existing cost-warning event with no new eventType and no Python egress.
</success_criteria>

<output>
After completion, create `.planning/phases/27-money-notifications/27-03-SUMMARY.md`
</output>
