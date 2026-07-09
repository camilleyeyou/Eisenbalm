---
status: partial
phase: 37-run-monitor-v2-signal-desk
source: [37-VERIFICATION.md]
started: 2026-07-09T00:00:00Z
updated: 2026-07-09T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Forensic spine reads as dots/diamonds with chips (MON-01)
expected: Open run-monitor/graph for a real run. LLM agents render as dots; verify_research and validate_sections render as marigold diamonds; each executed node shows cost, latency, model chip, and retry count together.
result: [pending]

### 2. Handoff inspector (MON-02)
expected: Click a mid-spine node; the upstream→node→downstream handoff renders human-readable first, with raw JSON behind a toggle and a truncation note.
result: [pending]

### 3. Per-section strength + re-run (MON-03)
expected: Expand the 7-writers node; per-section strength bars (0-100, colored) + flag counts show; a per-section re-run triggers rerun_agent on a finished run.
result: [pending]

### 4. Drift strip vs trailing 8 (MON-04)
expected: The drift strip compares the current run's cost + duration against the trailing-8 mean with an over/under indicator; labels n when fewer than 8 prior runs.
result: [pending]

### 5. primaryConcern + editor reasoning never truncated (SIG-01/02)
expected: On Signal Desk with real data, primaryConcern and the editor reasoning render in full — no line-clamp/ellipsis.
result: [pending]

### 6. Gate 1 adjudication resumes the run (SIG-03)
expected: Interrupt a run at Gate 1; on Signal Desk pick a candidate + type a reason; the run resumes via the bridge and the pick+reason are audit-logged. No trigger secret is exposed to the client.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
