---
status: partial
phase: 42-fact-check-stage
source: [42-VERIFICATION.md]
started: 2026-07-15
updated: 2026-07-15
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live demo leg — evidence replacement propagates everywhere
expected: In a live browser against a real/seeded issue run, open the Issue Workspace → My Tasks, click "Resolve an unsupported statistic" → deep-links to the Fact Check claim detail. Trigger **Ask agent for better evidence** on an unsourced load-bearing claim → a comparison card shows a replacement source + rewritten claim. **Confirm replacement** → the claim's prose is content-patched, the claim updates to sourced/checked, and simultaneously the Fact Check counters, the global header status, the My Tasks count, the Approval readiness board, and the publish lock all update live (Convex reactivity across pipeline + Sanity). (FCT-05/FCT-02)
result: [pending]

### 2. Revision → unchecked flip (FCT-07)
expected: With a claim in "checked" state, apply a content revision that touches that claim's block (e.g. edit the section prose containing it). The claim returns to **unchecked** and the "changed since check" counter increments — **even when the replacement text is itself already sourced**. Verify the Stage 3 summary and the outline/badges reflect the flip live.
result: [pending]

### 3. Shared provenance card parity across Draft, Fact Check, Approval (FCT-04)
expected: The SAME `ClaimProvenanceCard` renders on claim selection in Stage 2 (Draft — via the `ClaimMark` popover, showing real non-empty claim text + importance tier, not blank), in Stage 3 (Fact Check claim detail), and in Stage 5 (Approval — `SourceIndex` rows), with no forked component. The Phase 35 galley rendering (marigold/rust wash, keyboard focus parity, unchecked-claim click-through to Fact Check) is not regressed.
result: [pending]

### 4. The six claim actions update all four surfaces (FCT-05)
expected: Confirm · Edit claim · Replace source · Remove claim · Keep as written (requires a reason). Each action updates the Fact Check counters, My Tasks, Approval readiness, and header status live. "Keep as written" rejects an empty reason and writes a decision-log/audit entry.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
