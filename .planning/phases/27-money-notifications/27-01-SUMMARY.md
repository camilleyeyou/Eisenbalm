---
phase: 27-money-notifications
plan: 01
subsystem: convex-schema
tags: [convex, schema, additive, notifications, payouts, stripe-fees]
requires:
  - "docs/API_CONTRACTS.md §27 (written by 27-00)"
provides:
  - "notificationsLedger table (by_runId_eventType_channel idempotency index)"
  - "payouts table (by_workspace_issueNumber + by_workspace_status indexes)"
  - "stripeOrders.stripeFee additive optional field"
affects:
  - "convex/notifications.ts (Wave 2 — consumes notificationsLedger indexes)"
  - "convex/payouts.ts + finance UI (Wave 2/3 — consume payouts indexes)"
  - "Stripe fee reconciliation internalAction (Wave 2 — writes stripeFee cache)"
tech-stack:
  added: []
  patterns:
    - "Additive-only Convex schema change (D-14): new tables + one optional field, zero removals/renames"
    - "emailSends-style idempotency ledger pattern reused for notificationsLedger"
key-files:
  created: []
  modified:
    - "convex/schema.ts"
    - "convex/_generated/api.d.ts"
decisions:
  - "notificationsLedger.status typed as v.string() per the authoritative §27.4 contract (not v.union), overriding the plan's <interfaces> v.union illustration — §27 is the contract of record per D-14 and the task's read_first directs implementing exactly what §27.4 specifies"
  - "stripeFee placed among existing additive optional fields in stripeOrders; no field reordered or removed"
  - "Committed regenerated convex/_generated/api.d.ts alongside schema.ts since codegen is part of the task action"
metrics:
  duration: 4 min
  tasks: 1
  files: 2
  completed: 2026-06-24
requirements: [RCN-01, RCN-02, NTF-01, NTF-02]
---

# Phase 27 Plan 01: Additive Convex Schema Summary

Added the additive Phase 27 Convex schema — a `notificationsLedger` table, a `payouts` table, and one additive optional `stripeFee` field on `stripeOrders` — implemented exactly against `docs/API_CONTRACTS.md §27`, with all frozen shapes (`model_pricing`, `emailSends`, `deliberationEvents.eventType`, and the rest of `stripeOrders`) untouched.

## What Was Built

### `notificationsLedger` table (NTF-01/02, D-07)
Operational-notification idempotency ledger mirroring the `emailSends` pattern. Fields: `workspace_id`, `runId` (or eventKey for budget events), `eventType`, `channel`, `status` (`v.string()`: queued/sent/failed/skipped), `providerId?`, `sentAt?`, `errorMessage?`, `createdAt`. Indexes:
- `by_runId_eventType_channel` (`['runId', 'eventType', 'channel']`) — the at-most-once-per-channel idempotency key consumed by Wave 2 `getByKey`/`markSent`.
- `by_workspace_createdAt` (`['workspace_id', 'createdAt']`).

Placed directly after `emailSends`.

### `payouts` table (RCN-02, D-11)
Per-issue payout tracking. Fields: `workspace_id`, `issueNumber`, `issueId?`, `charitySlug`, `amount` (net cents), `status` (`v.union('pending'|'sent')`), `sentAt?`, `reference?`, `actor?`, `createdAt`, `updatedAt`. Indexes:
- `by_workspace_issueNumber` (`['workspace_id', 'issueNumber']`).
- `by_workspace_status` (`['workspace_id', 'status']`) — the finance dashboard at-a-glance status filter.

Placed directly after `model_pricing`.

### `stripeOrders.stripeFee` additive field (RCN-01, D-08)
Exactly one field added: `stripeFee: v.optional(v.number())` — cached Stripe fee in cents, written once per order by a Wave 2 `internalAction`. Placed among the existing additive optional fields; no existing field renamed, reordered, or removed.

## Verification

- All grep markers pass: `notificationsLedger:`, `by_runId_eventType_channel`, `payouts:`, `by_workspace_status`, `stripeFee`.
- `git diff convex/schema.ts` shows **only added lines** — zero removed/renamed lines (strict additive compliance with D-14).
- `npx convex codegen` exits 0 (schema compiles, no validation error).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Contract conformance] notificationsLedger.status type**
- **Found during:** Task 1
- **Issue:** The plan's `<interfaces>` block illustrated `status` as `v.union(v.literal('queued'), …)`, but the authoritative `docs/API_CONTRACTS.md §27.4` specifies `status: v.string()`.
- **Fix:** Implemented `v.string()` per §27.4, which is the contract of record (D-14, CLAUDE.md contract-first hard rule) and what the task's `read_first` directs ("implement exactly what §27.2/27.3/27.4 specify").
- **Files modified:** convex/schema.ts
- **Commit:** 36b6d07

### Other notes

- Committed regenerated `convex/_generated/api.d.ts` together with `schema.ts`: codegen (part of the task action) refreshed stale module registrations (`claimChecks`, `reviewActions` — modules already on disk from prior phases, unrelated to this plan's tables). Leaving it dirty would orphan a generated file.

## Self-Check: PASSED

- FOUND: convex/schema.ts (notificationsLedger, payouts, stripeFee all present)
- FOUND: commit 36b6d07
