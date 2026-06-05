---
phase: 20-post-purchase-email-lifecycle-8-email-flow
plan: 02
subsystem: convex
tags: [email, convex, schema, idempotency, consent]
dependency_graph:
  requires: []
  provides:
    - convex/emailSubscribers — consent ledger with upsertSubscriber, getByEmail, getByToken
    - convex/emailSends — idempotent send ledger with getByOrderStep, insertScheduled, markSent, markFailed, markSkipped
  affects:
    - Wave 2 flow engine (Plan 20-03) — calls insertScheduled, markSent, markFailed, markSkipped
    - Wave 4 unsubscribe route (Plan 20-05) — calls getByToken, getByOrderStep
tech_stack:
  added: []
  patterns:
    - Convex internalQuery/internalMutation (not exposed to browser client)
    - Compound index by_orderId_step for O(1) idempotency lookups
    - Lookup-then-conditional-insert pattern for upsertSubscriber (preserves prior unsubscribe)
key_files:
  created:
    - convex/emailSubscribers.ts
    - convex/emailSends.ts
  modified:
    - convex/schema.ts
    - apps/web/.env.example
    - convex/README.md
    - convex/_generated/api.d.ts
decisions:
  - upsertSubscriber does NOT patch consentState on existing rows — a prior unsubscribe survives a later order purchase
  - markSent includes a defensive insert for the sweep edge case where no scheduled row was previously written
  - All new Convex functions are internalQuery/internalMutation — the browser client cannot call them directly
  - deploy was pnpm --filter @eisenbalm/convex dev:once only — NOT convex deploy (prod)
  - NEXT_PUBLIC_BASE_URL added to .env.example (may duplicate if already present; kept as the canonical Phase 20 definition)
metrics:
  duration: ~7 min
  completed: "2026-06-05"
  tasks: 3
  files: 6
---

# Phase 20 Plan 02: Convex Data Model Summary

Two new Convex tables + two internal function modules added for the Phase 20 email lifecycle, deployed to the dev Convex deployment (modest-magpie-797).

## What Was Built

### emailSubscribers table + module (EMAIL-03)

One row per email address. Tracks consent state, the globally-unique 64-char hex `unsubscribeToken`, and the acquisition `source`. Unsubscribing here suppresses all marketing steps (E4–E8) while letting transactional steps (E1–E3) continue.

Indexes: `by_email` (suppression lookups), `by_token` (unsubscribe route lookup).

Internal functions:
- `getByEmail` — look up by email for suppression checks
- `getByToken` — look up by token for the Wave 4 unsubscribe route
- `upsertSubscriber` — insert on new email; return existing `_id` on duplicate WITHOUT touching `consentState`

### emailSends table + module (EMAIL-02)

One row per `(orderId, step)` pair. The primary idempotency key for the 8-email flow. Carries `scheduledFnId` so the unsubscribe path can cancel pending Convex scheduled functions. Status literals: `scheduled`, `sent`, `failed`, `cancelled`, `skipped`.

Indexes: `by_orderId`, `by_orderId_step` (the idempotency lookup — O(1)), `by_email_step`, `by_status`.

Internal functions:
- `getByOrderStep` — idempotency check before scheduling a step
- `insertScheduled` — called when a Convex scheduled function is enqueued
- `markSent` — patches status + providerMessageId + sentAt; has defensive insert for sweep edge case
- `markFailed` — patches status + failedAt + errorMessage
- `markSkipped` — inserts a skipped row when customerEmail is absent (EMAIL-09)

### Env vars (apps/web/.env.example)

Six new Phase 20 env vars documented with no real values:
- `EMAIL_LIVE_SEND=false` — master switch, OFF by default
- `RESEND_API_KEY=` — LAUNCH PREREQUISITE
- `EMAIL_FROM_TRANSACTIONAL=receipts@receipts.eisenbalm.com`
- `EMAIL_FROM_MARKETING=dispatch@dispatch.eisenbalm.com`
- `EMAIL_POSTAL_ADDRESS=` — LAUNCH PREREQUISITE (Andrew provides)
- `NEXT_PUBLIC_BASE_URL=http://localhost:3000` — for unsubscribe URL construction

### convex/README.md

Added `## Phase 20 — Email lifecycle tables` section documenting both tables, their purpose, indexes, and function files.

### Convex deploy

`pnpm --filter @eisenbalm/convex dev:once` ran clean. The log confirmed all 10 new indexes were added. `convex/_generated/api.d.ts` was regenerated with `internal.emailSends.*` and `internal.emailSubscribers.*` modules. No `convex deploy` (prod) was run.

## Deviations from Plan

None — plan executed exactly as written. All three tasks completed without deviations.

## Known Stubs

None. The function modules are fully wired against the schema. No placeholder text, no hardcoded empty returns that flow to UI rendering.

## Self-Check: PASSED

Files exist:
- convex/schema.ts — FOUND (contains emailSubscribers: and emailSends:)
- convex/emailSubscribers.ts — FOUND
- convex/emailSends.ts — FOUND
- apps/web/.env.example — FOUND (contains EMAIL_LIVE_SEND)
- convex/README.md — FOUND (contains Phase 20 section)
- convex/_generated/api.d.ts — FOUND (contains emailSends + emailSubscribers)

Commits exist:
- 0197c1c feat(20-02): add emailSubscribers + emailSends tables to schema.ts
- d75a449 feat(20-02): add emailSubscribers + emailSends internal Convex functions
- e2334f0 chore(20-02): env docs + deploy email lifecycle tables to dev Convex
