---
phase: 27
plan: "05"
subsystem: dispatch-control
tags: [notifications, settings, pipeline-config, convex, shadcn]
dependency-graph:
  requires: [27-03-SUMMARY.md]
  provides:
    - convex/pipelineConfig.ts#setNotificationConfig
    - "apps/dispatch-control/.../settings/_components/NotificationSettings.tsx"
  affects:
    - "apps/dispatch-control/.../settings/page.tsx"
    - "apps/dispatch-control/components/ui/switch.tsx"
tech-stack:
  added:
    - "@radix-ui/react-switch (shadcn Switch primitive)"
  patterns:
    - "all-optional mutation args so each channel block saves only its own keys"
    - "inline deterministic upsert against by_workspace_key (mirrors setAutoPublish)"
    - "per-key audit row via internal.auditLog.write with action config:set:<key>"
    - "config seeding from getAll + JSON.parse configMap (mirrors BudgetAlertBanner)"
    - "channel input visibility via CSS hidden/block (no height animation)"
key-files:
  created:
    - "apps/dispatch-control/app/(dashboard)/settings/_components/NotificationSettings.tsx"
    - "apps/dispatch-control/components/ui/switch.tsx"
  modified:
    - convex/pipelineConfig.ts
    - "apps/dispatch-control/app/(dashboard)/settings/page.tsx"
    - apps/dispatch-control/package.json
    - pnpm-lock.yaml
decisions:
  - "setNotificationConfig inlines the upsert (like setAutoPublish) rather than calling internal.pipelineConfig.upsert, since the existing `upsert` is a public mutation not an internalMutation"
  - "channel enabled-state is derived from a non-empty webhook/email value on load; saving a disabled channel writes an empty string for its config key (clears it)"
  - "per-event flags are shared across both channels in the UI state but each save button writes the four flags alongside only its own channel's config key"
metrics:
  duration: "~5 minutes"
  completed: "2026-06-23"
  tasks: 2
  files: 6
requirements: [NTF-01, NTF-02]
---

# Phase 27 Plan 05: Notification Settings UI Summary

Operator-facing Notifications config in the dispatch-control Settings page — independent Slack/Email channel toggles writing the `notify_*` pipeline_config keys via a Clerk-guarded, audit-logged Convex mutation that feeds the Plan 03 notifier.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | setNotificationConfig mutation | 9c4335b | convex/pipelineConfig.ts |
| 2 | NotificationSettings subsection + page wiring | e6b31d5 | NotificationSettings.tsx, settings/page.tsx, switch.tsx |

## What Was Built

**Task 1 — `setNotificationConfig` (convex/pipelineConfig.ts):** A new public mutation with all six `notify_*` args optional (`notify_email`, `notify_slack_webhook_url`, `notify_on_complete`, `notify_on_failed`, `notify_on_awaiting_review`, `notify_on_budget`). Clerk-JWT guard via `ctx.auth.getUserIdentity()` (throws `Unauthorized` when absent). Only keys actually passed are upserted (inline against the `by_workspace_key` index, mirroring `setAutoPublish`), so the Slack save never clobbers email keys and vice versa. Each written key emits an `internal.auditLog.write` row with action `config:set:<key>`, `resourceType: 'pipeline_config'`. `npx convex codegen` clean.

**Task 2 — Notifications Settings subsection:** Installed shadcn `<Switch>` (official; `@radix-ui/react-switch` added). `NotificationSettings.tsx` is a client component that seeds state from `api.pipelineConfig.getAll` (JSON.parse configMap, mirroring `BudgetAlertBanner`). Two independent channel blocks (Slack / Email), each with a `<Switch>` + visible `<label>`, a conditional config input revealed via CSS `hidden`/`block` (Slack webhook URL / recipient email with the exact spec placeholders), and four per-event checkboxes (`Run complete` / `Run failed` / `Awaiting review` / `Budget threshold`). Full-width `Save Slack settings` / `Save email settings` buttons (`bg-neutral-900 text-white text-sm`) call `setNotificationConfig` with only their own channel's keys. Unconfigured copy shown when neither channel has a persisted value. Wired into `settings/page.tsx` beneath existing content. All interactive elements carry `min-h-[44px]` + `focus-visible:ring-2`. `npx next build` exits 0 (`/settings` 6.2 kB).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Inline upsert instead of internal.pipelineConfig.upsert**
- **Found during:** Task 1
- **Issue:** The plan/interfaces note instructed calling `internal.pipelineConfig.upsert(...)`, but the existing `upsert` in convex/pipelineConfig.ts is a public `mutation`, not an `internalMutation` — `internal.pipelineConfig.upsert` would not resolve in the generated API and would fail typecheck.
- **Fix:** Inlined the upsert logic (query `by_workspace_key` → patch-or-insert) directly in the handler, exactly as `setAutoPublish` already does. Audit still routed through `internal.auditLog.write` (which IS an internalMutation).
- **Files modified:** convex/pipelineConfig.ts
- **Commit:** 9c4335b

## Verification

- `convex codegen` exits without error; `setNotificationConfig` exported with all six notify_* args optional, Clerk guard throws `Unauthorized`, per-key `config:set:` audit rows.
- `npx next build` (dispatch-control) exits 0 — `/settings` route compiles with the new subsection.
- Automated greps (NotificationSettings.tsx contains `Notifications`, `Slack`, `Email`, all four event labels, both save buttons, unconfigured copy; page renders `<NotificationSettings`) all pass.

## Notes for Downstream

- Manual end-to-end verification (VALIDATION.md row 27-03) remains: configure a channel + enable it, trigger a run status change, confirm delivery + ledger `sent`. That depends on the Plan 03 notifier reading these keys.
- The four per-event checkboxes are shared UI state across channels; if a future plan needs per-channel event flags, the config key model (single `notify_on_*` per workspace) would need to expand.

## Self-Check: PASSED

All created files and per-task commits (9c4335b, e6b31d5) verified present.
