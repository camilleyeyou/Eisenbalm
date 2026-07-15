---
status: partial
phase: 44-inspect-how-this-was-made
source: [44-VALIDATION.md, 44-09-integration-gate-PLAN.md Task 2]
started: 2026-07-15
updated: 2026-07-15
---

## Current Test

[testing paused — 4 items outstanding, awaiting a live operator session]

## Tests

### 1. The same panel opens from all six surfaces with the correct artifact (INS-01)
expected: Sign in to dispatch-control (localhost:3001) with a real Clerk session, against a real
pipeline run. Open the inspector from EACH of the six entry points and confirm it is the SAME
panel component each time, resolving the correct artifact:
  - brief org card (Story stage) → org/scout artifact
  - a draft passage finding + a section header (Draft stage) → founder artifact
  - a fact-check claim's Inspect button (Fact Check stage) → claim/researcher artifact
  - a voice finding (Voice stage) → founder artifact
  - the agent editor's recommendation Inspect (Approval) → rec/editor_final artifact
  - a qa/claim task's "Inspect context" (My Tasks) → the same artifact its deep-link targets
    (confirm the two sign-off rows' button stays reserved/disabled)
result: [pending]

### 2. Human-readable-first reads correctly on every tab (INS-02)
expected: On each of the seven tabs (Summary, Inputs, Instructions, Output, Sources, Diagnostics,
Technical), confirm prose/labels lead and raw JSON only appears on the Technical tab (never the
default anywhere). This is a readability judgment call that jsdom cannot assert.
result: [pending]

### 3. The missing-inputs call-out is genuinely useful, not noise (INS-03)
expected: Inspect a real drafted section on a live run. Confirm the "Missing expected inputs"
call-out lists meaningful, real state-input names with glosses (or explicitly states "all
supplied") — NOT every declared variable flagged regardless of what was actually supplied (the
Pitfall-1 failure mode the redefined diff exists to avoid).
result: [pending]

### 4. Footer actions render live vs. reserved correctly (INS-06)
expected: On a resolved artifact with a non-null promptKey, confirm "Improve this agent →"
deep-links to that agent's prompt-lab page. Confirm "Restart from this step" and "Ask agent to
revise" render visibly reserved/disabled with explanatory titles on EVERY artifact type (never
silently missing, never accidentally wired).
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

None recorded yet — these are irreducibly-manual, live-session-only checks (cross-screen
visual/interaction flow, readability judgment, diagnostic usefulness) that the Phase 44 Wave-0
automated suite (inspectorArtifact, missingInputsDiff, InspectorPanel, InspectorProvider,
outputDivergence) already covers at the unit level per 44-VALIDATION.md's Per-Task Verification
Map. They are marked `pending`, not `pass`, per the plan's explicit instruction that "any failure
is captured as a gap ... never silently marked pass." Run `/gsd:audit-uat 44` or a live session
against localhost:3001 + dev:modest-magpie-797 to close them out.
