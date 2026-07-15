---
status: partial
phase: 43-my-tasks-decision-log
source: [43-VALIDATION.md]
started: 2026-07-15
updated: 2026-07-15
---

## Current Test

[testing paused — 2 items outstanding]

## Tests

### 1. Decision Log renders actor as a human/agent name in a live session (TSK-06)
expected: Sign in to dispatch-control (localhost:3001) with a real Clerk session. Perform a reasoned action (Hold the issue with a reason, OR mark a charity Do-not-use with a reason). Open the Decision log in BOTH mounts — the Approval context panel AND the persistent Workspace "Decision log" control — and confirm the new row shows your NAME (not a Clerk sub/user ID), the reason, action, time, before/after, and issue+run.
result: [pending]

### 2. "Superseded" appears after a real section re-roll, never silent disappearance (TSK-05)
expected: With an issue that has an open task on a section (e.g. an open fact-check finding), trigger `rerun_agent` to re-roll that section on a live run. Return to /my-tasks and confirm the task now reads "superseded" with a link to the new step — it does NOT silently drop off the list.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
