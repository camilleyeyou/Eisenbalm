---
status: partial
phase: 47-story-brief-stage
source: [47-VERIFICATION.md]
started: 2026-07-16
updated: 2026-07-16
---

## Current Test

[awaiting human testing — optional UX/LLM-quality passes; NOT gaps against the phase goal (verification passed 6/6)]

## Tests

### 1. Stage-1 visual composition at real viewport widths
expected: Load `/issues/[n]/story` for a run with leads, org options, and (if paused) the Needs-your-decision card in a browser. The vertical composition (Leads → Org options → Needs-your-decision → Brief table) reads cleanly at real viewport widths; the never-truncated blocks (brand-risk warning, org main concern) don't visually overflow oddly with very long agent-generated text.
why_human: Visual layout/typography quality can't be verified by grep/unit tests — this is UX polish, not a functional gap (automated tripwires already confirm text is never programmatically clipped).
result: [pending]

### 2. End-to-end "Ask an agent to strengthen" quality
expected: Trigger a real strengthen pass on a Brief field with a live OpenRouter call; review the proposed text — it should be a genuine improvement to the field and stay on Jesse-voice.
why_human: LLM output quality is not assessable by a unit test with mocked `acomplete`; the wiring (preview→apply, budget guard, audit) is already verified structurally.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps

- Both items are optional UX/LLM-quality passes flagged by the verifier as non-blocking; verification passed 6/6 at code level. No functional gaps.
