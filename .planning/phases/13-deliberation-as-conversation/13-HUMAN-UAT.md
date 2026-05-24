---
status: partial
phase: 13-deliberation-as-conversation
source: [13-VERIFICATION.md]
started: 2026-05-24T17:30:00Z
updated: 2026-05-24T17:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Rendered chat thread appears inline on a real issue page
expected: Load a published issue page that has run through the Phase 13 pipeline (conversation[] populated in Sanity). A threaded chat conversation is visible above the "How this issue was made" disclosure, with named-agent chips (S/A/E initials), speaker label + role per turn, plain prose turn text, and NO literal # / ** / _ Markdown characters rendered.
result: [pending]

### 2. Deliberation reads as a genuine conversation faithful to real run data (SC-1)
expected: Turns attribute real Scout findings, real Advocate scores (0–10), and the actual Editor decision to the named personas — genuine multi-turn back-and-forth (not a monologue), no fabricated facts, no generic filler. Compare rendered turn text against the actual DispatchState values from the live pipeline run.
result: [pending]

### 3. prefers-reduced-motion is respected on the conversation thread
expected: With OS reduced-motion enabled, no CSS transitions or animations play on the conversation chips or turn entries; the thread renders instantly.
result: [pending]

### 4. WCAG AA colour contrast on conversation turn text
expected: `var(--color-text-dim)` turn text achieves at least 4.5:1 contrast ratio against the page background for the current issue theme (verify with a browser accessibility tool against the runtime-injected theme variables).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
