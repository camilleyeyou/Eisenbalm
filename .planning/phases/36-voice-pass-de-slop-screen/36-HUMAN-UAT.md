---
status: partial
phase: 36-voice-pass-de-slop-screen
source: [36-VERIFICATION.md]
started: 2026-07-09T00:00:00Z
updated: 2026-07-09T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Machine-tell lighting reads over clean prose (VOX-01)
expected: Open /voice-pass/[runId] for a real run. Machine-tells and voice violations light inline over otherwise-clean prose; the per-screen tell count is accurate; the conservative MACHINE_TELL_LEXICON does not over-fire on legitimate prose.
result: [pending]

### 2. Two independent sign-off greens (VOX-03)
expected: Sign "Facts cleared" on the Review Desk and "Sounds human" on Voice Pass. Both greens are required for Publish, are independent, and an open error-severity voice finding blocks ONLY "Sounds human" (not "Facts cleared").
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
