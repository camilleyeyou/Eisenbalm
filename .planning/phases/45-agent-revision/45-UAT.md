---
status: partial
phase: 45-agent-revision
source: [45-VALIDATION.md, 45-07-integration-gate-PLAN.md Task 2, 45-CONTEXT.md <specifics>]
started: 2026-07-16
updated: 2026-07-16
---

## Current Test

[testing paused — 8 items outstanding, awaiting a live operator session with a real Clerk session
against a run that has reached Draft/Voice review]

## Tests

### 1. Draft selection toolbar offers all six actions (REV-01)
expected: On a run that has reached Draft (Stage 2) in dispatch-control, select a phrase in the
Founder Bio (e.g. the founder characterization). Confirm a toolbar appears offering exactly six
actions: Edit text, Ask agent to revise, Compare with previous, Restore previous, Related facts &
sources, Inspect how this was made — with Compare/Restore visibly reserved (disabled + explanatory
tooltip).
result: [pending]

### 2. Direction chips appear, never a bare "Regenerate" (REV-02)
expected: Click "Ask agent to revise". Confirm the seven direction chips appear (Make clearer /
Make more specific / Tighten / Match the brief / Reduce repetition / Try another approach /
Custom) — and NO bare "Regenerate".
result: [pending]

### 3. Comparison card returns before anything applies, with an explicit claim delta (REV-03)
expected: Pick a chip. Confirm a comparison card returns BEFORE anything applies: original
(struck through), proposed, a "What changed" line, and the explicit claim delta (added / removed /
altered).
result: [pending]

### 4. Try another approach / Edit before applying both work (REV-02, REV-03)
expected: Confirm the four actions: Apply, Edit before applying, Try another approach, Discard.
Try "Try another approach" (proposal changes, diverges from the prior proposal) and "Edit before
applying" (editable proposed text).
result: [pending]

### 5. Apply mutates the draft and revokes Voice sign-off (REV-04)
expected: Click Apply. Confirm the draft updates (the applied text appears) and, on the Voice
stage, the Voice Pass returns to "Review needed" (the sign-off was revoked — Phase-34 wiring, not
the prototype bug where voiceDone survives).
result: [pending]

### 6. Header cost-vs-budget readout increments after a revision call (REV-05)
expected: Confirm the header cost-vs-budget readout incremented after the revision call (never
blank/$0).
result: [pending]

### 7. Second entry surface — InspectorFooter "Ask agent to revise" is live, not a dead button (REV-01, D-18)
expected: Open "Inspect how this was made" for a drafted section, then click the InspectorFooter
"Ask agent to revise" button. Confirm it is LIVE (not reserved/greyed) and opens the SAME revision
flow scoped to a REAL passage — the direction chips appear and picking one returns a comparison
card (NOT a "span not resolved" error). This proves the inspector-footer surface is a real entry
point, not a dead button.
result: [pending]

### 8. (Optional) Per-issue cost cap renders disabled-with-explanation, never a silent failure (REV-05)
expected: Exhaust the per-issue cap and confirm the chips render disabled-with-explanation (409
cost guard), never a silent failure.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps

None recorded yet. This is the single load-bearing, full-stack demo leg the milestone hinges on
(Draft/Voice → select the founder phrase → Ask agent to revise → apply → Voice Pass returns to
"Review needed" → header cost readout increments), spanning DOM selection, a live LLM revision
call, the content-patch write boundary, cross-stage sign-off revocation, and a real Clerk session
— none of which is reproducible in a single headless harness. All 11 pieces it depends on are
independently covered by Phase 45's Wave-0 automated suite (PassageToolbar, DirectionChips,
RevisionComparisonCard, RevisionFlow, FrameChromeCostReadout, blockIndexFromKey,
test_revision_endpoints.py, test_budget.py — all green per 45-VALIDATION.md's Per-Task
Verification Map, confirmed by the 45-07 integration gate's full-suite run). These 8 items are
marked `pending`, not `pass`, per the plan's explicit instruction that "any failure is recorded as
a gap for a follow-up `--gaps` plan, never silently marked pass." Run `/gsd:audit-uat 45` or a live
session against localhost:3001 + a real Clerk session + dev:modest-magpie-797 to close them out.
