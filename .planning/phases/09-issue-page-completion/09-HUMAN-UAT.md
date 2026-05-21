---
status: partial
phase: 09-issue-page-completion
source: [09-VERIFICATION.md]
started: 2026-05-21T23:09:38Z
updated: 2026-05-21T23:09:38Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Real-time deliberation updates while pipeline runs (DEL-03 / Success Criterion 4)
expected: On an issue page whose `runId` has live Convex data, while a pipeline run is emitting events, new deliberation events (pitch-log entries, advocate arguments, QA corrections, votes) appear in the expanded accordion within Convex's subscription latency — with NO page refresh. The code uses Convex `useQuery` (reactive subscriptions) with the `"skip"` sentinel, so this is correct-by-code; this item confirms live propagation against a running Convex deployment.
result: [pending]

how_to_test: |
  1. Ensure a Convex deployment is running with deliberation data for a known runId.
  2. Open the corresponding issue page and expand the deliberation accordion.
  3. Insert or update a `deliberationEvents` / `agentVotes` / `qaCorrections` / `pitchLog` row via the Convex dashboard (or run the pipeline).
  4. Confirm the UI updates within subscription latency without reloading the page.

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
