---
phase: 27-money-notifications
plan: 03
subsystem: notifications-backend
tags: [notifications, slack, convex, idempotency, ntf]
requires:
  - "packages/emails SendEmailProvider seam (Phase 20)"
  - "notificationsLedger table + indexes (Plan 27-01)"
  - "pipeline_config getAll (Phase 22)"
provides:
  - "decideDispatch pure decision helper (apps/web/lib/notifications/dispatch.ts)"
  - "SlackWebhookProvider + selectSlackProvider (packages/emails)"
  - "notificationsLedger module (convex/notifications.ts)"
  - "sendNotification internalAction (convex/notificationActions.ts)"
  - "two Convex dispatch seams (pipelineRuns:updateStatus, deliberationEvents:insert)"
affects:
  - "convex/pipelineRuns.ts (additive seam)"
  - "convex/deliberationEvents.ts (additive seam — eventType union FROZEN)"
tech-stack:
  added: []
  patterns:
    - "Slack reuses the SendEmailProvider seam (no second send path, native fetch)"
    - "Two-step idempotency ledger keyed on (runId, eventType, channel)"
    - "Non-blocking dispatch via scheduler.runAfter(0, internalAction)"
key-files:
  created:
    - packages/emails/src/slackProvider.ts
    - apps/web/lib/notifications/dispatch.ts
    - convex/notifications.ts
    - convex/notificationActions.ts
  modified:
    - packages/emails/src/index.ts
    - convex/pipelineRuns.ts
    - convex/deliberationEvents.ts
decisions:
  - "workspace_id resolved to the single-workspace constant 'eisenbalm' (matches users.ts DEFAULT_WORKSPACE_ID)"
  - "decideDispatch emits per-channel skip decisions on flag-off so the unit test's every()==='skip' holds"
metrics:
  tasks: 3
  files: 7
  duration: 16
  completed: 2026-06-24
---

# Phase 27 Plan 03: Notifications Backend Summary

Operational notification backend (NTF-01/02): a Slack incoming-webhook provider behind the existing `packages/emails` selection seam, a pure `decideDispatch` decision helper (turning the Wave 0 RED scaffold GREEN), a `notificationsLedger` idempotency module mirroring `emailSends`, a `sendNotification` Node internalAction, and the two Convex trigger seams — all transport Convex-side (D-01), the Python pipeline untouched.

## What Was Built

- **`decideDispatch`** (`apps/web/lib/notifications/dispatch.ts`) — pure helper at the exact import path the Wave 0 scaffold asserts. Per-channel decision: flag-off → skip (D-06); ledger row already `sent`/`queued` → skip (D-07, idempotent no-op); `cost-warning` source → `budget` (D-04); otherwise `send`. Wave 0 `notifications-ledger.test.ts` now passes 7/7.
- **`SlackWebhookProvider` + `selectSlackProvider`** (`packages/emails/src/slackProvider.ts`) — implements `SendEmailProvider` via native `fetch`, POSTs `{ text: subject + '\n' + stripHtml(html) }`, throws on `!res.ok`. No new npm dependency. Re-exported from `packages/emails/src/index.ts`.
- **`notificationsLedger` module** (`convex/notifications.ts`) — `getByKey` / `insertScheduled` (atomic check-and-insert, status `queued`) / `markSent` / `markFailed` / `markSkipped`, all keyed on `(runId, eventType, channel)` via `by_runId_eventType_channel`. `status` is `v.string()` per §27.4.
- **`sendNotification` internalAction** (`convex/notificationActions.ts`, `"use node"`) — reads `pipeline_config` via `api.pipelineConfig.getAll`, JSON.parses each row, gates on `notify_on_<eventType>`, then per configured channel runs the two-step idempotency gate and sends via `selectProvider` (email) / `selectSlackProvider` (slack). Never throws out of the action (D-05).
- **Two trigger seams** — `pipelineRuns:updateStatus` dispatches for `complete`/`failed`/`awaiting-review` only (never `running`); `deliberationEvents:insert` dispatches `eventType: 'budget'` when `args.eventType === 'cost-warning'`. Both via `scheduler.runAfter(0, …)`; the `deliberationEvents.eventType` union is unchanged (FROZEN, D-04).

## Deviations from Plan

None — plan executed as written. One out-of-scope blocking issue was discovered and correctly deferred (see below).

## Deferred Issues

**`convex/finance.ts` breaks `npx convex codegen` with `Could not resolve "stripe"`.**
- This file is owned by the **parallel Plan 02 (RCN track)** executor and was uncommitted/in-flight during this plan. The `stripe` package is not installed in the convex bundle's resolution scope.
- Out of scope for 27-03 per the plan's `files_owned_note` and the parallel-execution rule (touch only my plan's files). Logged to `.planning/phases/27-money-notifications/deferred-items.md`.
- **My modules verified clean:** with `finance.ts` temporarily excluded, `npx convex codegen` exits 0, regenerates `_generated/api.d.ts` to include `notifications` + `notificationActions`, TypeScript passes, and `internal.notificationActions.sendNotification` resolves from both seams. The codegen failure is entirely attributable to the parallel track's file; Plan 02 must install/external the `stripe` dep.

## Verification

- `cd apps/web && npx vitest run __tests__/notifications-ledger.test.ts` → **7/7 GREEN**.
- `npx convex codegen` → clean (exit 0) for the NTF modules + both seams (parallel-track `finance.ts` stripe-dep issue excepted, deferred).
- `git diff convex/deliberationEvents.ts` shows **no** change to the `eventType` `v.union(...)` literals.
- No dispatch on `'running'`; both dispatches are `scheduler.runAfter(0, …)` (non-blocking).
- End-to-end delivery is manual-only per VALIDATION.md row 27-03 (configure a channel, trigger a status change, confirm arrival + ledger `sent`).

## Commits

- `ef529e4` feat(27-03): Slack provider + decideDispatch helper
- `32dd162` feat(27-03): notificationsLedger module + sendNotification internalAction
- `2314dd1` feat(27-03): wire two Convex notification trigger seams

## Self-Check: PASSED

- All 5 created files present on disk.
- All 3 task commits present in git history.
