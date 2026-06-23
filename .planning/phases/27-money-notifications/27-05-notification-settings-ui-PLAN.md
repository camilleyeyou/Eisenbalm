---
phase: 27-money-notifications
plan: 05
type: execute
wave: 3
depends_on: ["27-03"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/settings/_components/NotificationSettings.tsx
  - apps/dispatch-control/app/(dashboard)/settings/page.tsx
  - convex/pipelineConfig.ts
autonomous: true
requirements: [NTF-01, NTF-02]

must_haves:
  truths:
    - "Settings has a Notifications subsection with independent Slack and Email channel toggles (Slack and/or email — either, both, or neither)"
    - "Each enabled channel reveals its config input (Slack webhook URL / recipient email) and four per-event checkboxes: Run complete / Run failed / Awaiting review / Budget threshold"
    - "Saving writes the notify_* pipeline_config keys via a Clerk-JWT-guarded, audit-logged mutation; each channel block saves only its own keys"
    - "An unconfigured state shows the no-channels-configured copy"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/settings/_components/NotificationSettings.tsx"
      provides: "Notifications config subsection (toggles + inputs + per-event checkboxes + save)"
      contains: "Notifications"
    - path: "convex/pipelineConfig.ts"
      provides: "setNotificationConfig mutation writing notify_* keys (guarded + audited)"
      exports: ["setNotificationConfig"]
  key_links:
    - from: "NotificationSettings.tsx"
      to: "convex/pipelineConfig.ts setNotificationConfig"
      via: "useMutation(api.pipelineConfig.setNotificationConfig)"
      pattern: "setNotificationConfig"
    - from: "convex/pipelineConfig.ts setNotificationConfig"
      to: "convex/auditLog.ts write"
      via: "ctx.runMutation(internal.auditLog.write, action config:set:notify)"
      pattern: "config:set:notify"
---

<objective>
Add the Notifications config subsection to the dispatch-control Settings page (per the APPROVED 27-UI-SPEC) and the backing Convex mutation that writes the `notify_*` `pipeline_config` keys (Clerk-JWT-guarded + audit-logged, mirroring `setAutoPublish`).

Purpose: Lets the operator independently configure Slack and/or email channels and choose which events trigger alerts — the config the Plan 03 notifier reads at dispatch time (NTF-01/02, D-03/D-06).
Output: NotificationSettings component + settings page wiring + setNotificationConfig mutation.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/27-money-notifications/27-UI-SPEC.md
@docs/API_CONTRACTS.md

<interfaces>
pipeline_config keys (D-06): notify_email (string), notify_slack_webhook_url (string), notify_on_complete (bool), notify_on_failed (bool), notify_on_awaiting_review (bool), notify_on_budget (bool). Stored JSON.stringify'd in pipeline_config rows; read via api.pipelineConfig.getAll then JSON.parse(row.value).

setAutoPublish pattern (convex/pipelineConfig.ts — mirror): Clerk guard `ctx.auth.getUserIdentity()`; upsert via `internal.pipelineConfig.upsert({ workspace_id, key, value: JSON.stringify(...), updatedBy: identity.subject })`; audit via `internal.auditLog.write({ workspace_id, actorId, action: 'config:set:<key>', resourceType: 'pipeline_config', after: JSON.stringify(...) })`.

UI-SPEC fixed values:
- Section heading `Notifications`. Channel labels `Slack` / `Email`.
- shadcn <Switch> per channel (install via `npx shadcn add switch` from shadcn official only if absent — no vetting gate needed).
- Channel input appears/disappears via CSS hidden/block (no height animation). Slack placeholder `https://hooks.slack.com/services/…`; Email placeholder `operator@example.com`.
- Per-event checkboxes: `Run complete` / `Run failed` / `Awaiting review` / `Budget threshold`.
- Per-subsection save: `Save Slack settings` / `Save email settings` — each `bg-neutral-900 text-white text-sm`, full-width within its block, saves only its own keys.
- Unconfigured copy: `No notification channels configured. Add a Slack webhook or email address to receive run alerts.`
- All interactive: min-h-[44px] min-w-[44px] + focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1. Each <Switch> has a visible <label> with the channel name.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: convex/pipelineConfig.ts setNotificationConfig mutation</name>
  <read_first>
    - convex/pipelineConfig.ts (setAutoPublish — the exact Clerk-JWT guard + internal.pipelineConfig.upsert + internal.auditLog.write pattern to mirror; getAll query; the existing upsert internalMutation)
    - convex/auditLog.ts (write signature)
    - docs/API_CONTRACTS.md §27.4 (the notify_* config keys)
  </read_first>
  <action>
    Add a `setNotificationConfig` mutation to convex/pipelineConfig.ts. Args (all optional so each channel block saves only its own keys): `{ workspace_id: v.string(), notify_email: v.optional(v.string()), notify_slack_webhook_url: v.optional(v.string()), notify_on_complete: v.optional(v.boolean()), notify_on_failed: v.optional(v.boolean()), notify_on_awaiting_review: v.optional(v.boolean()), notify_on_budget: v.optional(v.boolean()) }`.

    Handler: Clerk guard `const identity = await ctx.auth.getUserIdentity(); if (!identity) throw new Error('Unauthorized')`. For each provided (non-undefined) arg key, call `internal.pipelineConfig.upsert({ workspace_id, key, value: JSON.stringify(value), updatedBy: identity.subject })`, then `internal.auditLog.write({ workspace_id, actorId: identity.subject, action: 'config:set:' + key, resourceType: 'pipeline_config', after: JSON.stringify({ [key]: value }) })`. Only write keys that were actually passed (so the Slack save button does not clobber email keys and vice versa).

    Run `npx convex codegen`.
  </action>
  <verify>
    <automated>grep -q "export const setNotificationConfig" convex/pipelineConfig.ts && grep -q "config:set:" convex/pipelineConfig.ts && grep -q "notify_slack_webhook_url" convex/pipelineConfig.ts && cd convex && npx convex codegen 2>&1 | tail -1; echo CONFIG_MUTATION_DONE</automated>
  </verify>
  <acceptance_criteria>
    - convex/pipelineConfig.ts exports `setNotificationConfig` with all six notify_* args optional
    - the handler calls `ctx.auth.getUserIdentity()` and throws `'Unauthorized'` when absent
    - the handler upserts only the keys actually provided and calls `internal.auditLog.write` with `action` starting `config:set:`
    - `npx convex codegen` exits without error
  </acceptance_criteria>
</task>

<task type="auto">
  <name>Task 2: NotificationSettings.tsx subsection + settings/page.tsx wiring</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/settings/page.tsx (existing settings content + force-dynamic + getCurrentWorkspace pattern — append the subsection beneath existing content)
    - apps/dispatch-control/app/(dashboard)/runs/_components/BudgetAlertBanner.tsx (api.pipelineConfig.getAll read + JSON.parse configMap pattern)
    - apps/dispatch-control/components.json (confirm shadcn; Switch install path if needed)
    - .planning/phases/27-money-notifications/27-UI-SPEC.md (Notification Config section + Copywriting Contract + Interaction Contracts channel-toggle behavior)
    - convex/pipelineConfig.ts (setNotificationConfig signature from Task 1)
  </read_first>
  <action>
    If shadcn `<Switch>` is not yet present in apps/dispatch-control, install it: `npx shadcn add switch` (shadcn official — no vetting gate).

    Create `NotificationSettings.tsx` (client component): reads current config via `useQuery(api.pipelineConfig.getAll, { workspace_id })` → build configMap (JSON.parse each row.value) to seed initial state. Render a section with heading `Notifications` (text-base/text-xl font-semibold per the type scale). Two channel blocks:

    Slack block: a `<Switch>` with a visible `<label>Slack</label>`. When on (CSS `block`, when off `hidden` — no height animation), reveal a webhook URL `<input>` (placeholder `https://hooks.slack.com/services/…`) and the four per-event checkboxes labeled `Run complete` / `Run failed` / `Awaiting review` / `Budget threshold` mapping to `notify_on_complete` / `notify_on_failed` / `notify_on_awaiting_review` / `notify_on_budget`. A full-width `Save Slack settings` button (`bg-neutral-900 text-white text-sm`, min-h-[44px], focus-visible ring) calls `useMutation(api.pipelineConfig.setNotificationConfig)` passing ONLY the Slack keys (`notify_slack_webhook_url` + the four event flags) + `workspace_id`.

    Email block: a `<Switch>` with a visible `<label>Email</label>`. When on, reveal a recipient `<input>` (placeholder `operator@example.com`) and the same four per-event checkboxes. A full-width `Save email settings` button calls `setNotificationConfig` passing ONLY the email keys (`notify_email` + the four event flags) + `workspace_id`.

    When neither channel is configured (no notify_email and no notify_slack_webhook_url in configMap), show the copy `No notification channels configured. Add a Slack webhook or email address to receive run alerts.`

    Append `<NotificationSettings workspace_id={...} />` to settings/page.tsx beneath the existing settings content (resolve workspace via getCurrentWorkspace()).

    Build to confirm: `cd apps/dispatch-control && npx next build`.
  </action>
  <verify>
    <automated>test -f "apps/dispatch-control/app/(dashboard)/settings/_components/NotificationSettings.tsx" && grep -q "setNotificationConfig" "apps/dispatch-control/app/(dashboard)/settings/_components/NotificationSettings.tsx" && grep -q "Save Slack settings" "apps/dispatch-control/app/(dashboard)/settings/_components/NotificationSettings.tsx" && grep -q "Save email settings" "apps/dispatch-control/app/(dashboard)/settings/_components/NotificationSettings.tsx" && grep -q "Budget threshold" "apps/dispatch-control/app/(dashboard)/settings/_components/NotificationSettings.tsx" && grep -q "NotificationSettings" "apps/dispatch-control/app/(dashboard)/settings/page.tsx" && echo SETTINGS_UI_DONE</automated>
  </verify>
  <acceptance_criteria>
    - NotificationSettings.tsx contains `Notifications`, `Slack`, `Email`, the four event labels `Run complete`/`Run failed`/`Awaiting review`/`Budget threshold`, both `Save Slack settings` and `Save email settings`, and the unconfigured copy
    - NotificationSettings.tsx calls `api.pipelineConfig.setNotificationConfig` and the Slack save passes only Slack keys while the email save passes only email keys (separate handlers)
    - the channel input toggles visibility via CSS `hidden`/`block` (no animate-height)
    - settings/page.tsx renders `<NotificationSettings`
    - all interactive elements carry `min-h-[44px]` and `focus-visible:ring-2`; each Switch has an associated visible label
    - `npx next build` (dispatch-control) exits 0
  </acceptance_criteria>
</task>

</tasks>

<verification>
- dispatch-control builds clean.
- Settings shows a Notifications subsection; channels independently toggle; per-channel saves write only their own keys.
- Manual verify (VALIDATION.md row 27-03 end-to-end): with a channel configured + enabled, trigger a run status change and confirm delivery + ledger 'sent'.
</verification>

<success_criteria>
- NTF-01/02 config surface complete: Slack and/or email, per-event flags, guarded+audited writes feeding the Plan 03 notifier.
</success_criteria>

<output>
After completion, create `.planning/phases/27-money-notifications/27-05-SUMMARY.md`
</output>
