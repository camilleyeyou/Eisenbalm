---
status: partial
phase: 48-brief-entry-point
source: [48-VERIFICATION.md]
started: 2026-07-16T09:10:00Z
updated: 2026-07-16T09:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Stages 2–5 visual/functional parity (ENT-03)
expected: Open a brief-started run and a discovery-started run side by side at Stages 2–5 (Research, Sections, QA, Sign-off). The two runs are visually and functionally indistinguishable — same layout, same fields, same interactions. (No DOM-diff/visual-regression harness exists in this repo; the artifact-presence assertions in `test_pipeline_e2e_brief_mode` pass, but the "indistinguishable" UX judgment needs a human eye.)
result: [pending]

### 2. Reader-page DeliberationSlot absent-state (ENT-03 / D-12 honest divergence)
expected: Open a brief-started issue's public reader page and confirm the Deliberation section (`DeliberationSlot`) renders its graceful empty/absent state without error — no console error, no broken layout. A brief run never populates `selectionDeliberation`, so DEL-05's existing empty-state gate (`!runId && no candidates && no conversation`, pre-existing from Phase 29) should render cleanly. Requires a live browser session against a real brief-started issue.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
