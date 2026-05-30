---
status: partial
phase: 16-choose-your-narrator
source: [16-VERIFICATION.md, 16-UAT.md]
auto_chain: true
started: 2026-05-30T08:50:17Z
updated: 2026-05-30T08:50:17Z
---

## Current Test

[awaiting live Andrew round-trip — auto-approved under --auto chain]

## Context

`gsd-verifier` returned `human_needed`. Automated layer is independently re-confirmed
(190 pipeline / 234 web / 28 NRR composite / WINNER AUTHORITY split / no-leak GROQ
— all reproduced numerically). Plan 16-09 already authored the full Andrew round-trip
scaffold in `16-UAT.md` (this is the live transcript file). This `16-HUMAN-UAT.md`
exists so the `verify_phase_goal` workflow-required filename invariant holds and so
`/gsd:progress` + `/gsd:audit-uat` both surface the outstanding live attestation.

For the live test transcript, expected behaviors, and pass criteria see
`16-UAT.md`. Use this file purely as the audit-uat index entry.

## Tests

### 1. Scenario A — Jesse default round-trip
expected: Issue page renders with NO narrator chip; chronicler output byte-equivalent to Phase 14 voice register; QA judge system+user messages byte-identical to legacy
result: pending live verification
ref: 16-UAT.md § Scenario A

### 2. Scenario B — Maya Rudolph end-to-end
expected: Calibrator resolves Maya by slug, chronicler voice shifts to sly/dry/warm register, IssueHero renders chip "Narrated by Maya Rudolph" ABOVE the publish-date line
result: pending live verification
ref: 16-UAT.md § Scenario B

### 3. Scenario C — Werner Herzog draft preview
expected: Studio preview renders draft issue with Herzog narrator; voice register is grave/Latinate; chip renders "Narrated by Werner Herzog"
result: pending live verification
ref: 16-UAT.md § Scenario C

### 4. Aggregate browser smoke
expected: DOM order in devtools matches NRR-08 (chip precedes `<time>`); no console errors on `/issue/[slug]`; calibrator log shows `narrator_slug` reconciliation
result: pending live verification
ref: 16-UAT.md § Aggregate

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

(none — automation gates all green; only live editorial attestation remains)

## Auto-approval log

⚡ Auto-approved under `--auto` chain on 2026-05-30T08:50:17Z. Phase 16 advances to
`complete` in ROADMAP, but this file persists with `status: partial` so the live
Andrew round-trip surfaces via `/gsd:audit-uat 16` until each scenario's
`result:` is manually flipped to `pass`.
