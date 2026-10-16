---
phase: 52-issue-the-front-door
plan: 02
subsystem: ui
tags: [tdd, dispatch-control, publish, gate-parity]
requires:
  - phase: 52-01
    provides: HomeFooter type
provides:
  - publishChain (facts-cleared -> sounds-human -> publish) and derivePublishGate
  - copy constants (network failure, collaborator lock, held reason, slow notice)
affects: [52-03, 52-04]
tech-stack:
  added: []
  patterns: [compose existing clients, client gate strictly narrower than server]
key-files:
  created:
    - apps/dispatch-control/lib/publishChain.ts
    - apps/dispatch-control/__tests__/publishChain.test.ts
  modified:
    - apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx
key-decisions:
  - "Collaborators never start the chain (facts-cleared is not role-gated server-side; avoids half-recorded sign-off)"
  - "Non-API errors map to one plain network message; API errors pass server message verbatim"
requirements-completed: [HOME-07]
duration: 8min
completed: 2026-10-16
---

# Phase 52 Plan 02: Publish Chain Summary

**One-click publish as a tested sequence over recordSignOff and publishIssue, with an enablement predicate that can only be stricter than the server.**

## Accomplishments
- `publishChain` skips sign-offs already active, stops at the first failure, returns the server's message; fresh token per request.
- `derivePublishGate` order: not-ready, busy, loading, held, role-unknown, collaborator.
- RunScreen docstring no longer claims DecisionRail is the only caller (comment-only).
- 17 new tests; publishChain, errorEnvelope, publishNoTypedConfirm, roleGateInventory: 33 passing.

## Task Commits
1. RED: 62f4df48
2. GREEN: e8e1ce97

## Deviations from Plan
None. Note: `pnpm --filter dispatch-control typecheck` reports pre-existing errors in unrelated test files (syntheticPortableText, voicePassAxis, WriterExpansion, others); none in files touched by this plan. Out of scope, not fixed.

## Known Stubs
None.

## Self-Check: PASSED
