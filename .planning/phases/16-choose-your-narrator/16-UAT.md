---
status: partial
phase: 16-choose-your-narrator
source:
  - 16-04-voice-py-refactor-SUMMARY.md
  - 16-05-state-calibrator-writers-SUMMARY.md
  - 16-06-chronicler-narrator-SUMMARY.md
  - 16-07-qa-judge-narrator-SUMMARY.md
  - 16-08a-seed-narrators-SUMMARY.md
  - 16-08b-frontend-chip-SUMMARY.md
started: 2026-05-30T08:25:00Z
updated: 2026-05-30T08:30:00Z
auto_chain: true
---

## Auto-approved under --auto chain (no live Andrew run)

⚡ **Auto-approved Andrew UAT checkpoint (—auto chain).** Plan 16-09 Task 2 (`checkpoint:human-verify gate="blocking"`) was reached during `/gsd:execute-phase --auto` chain execution. Per the orchestrator's auto-mode contract, the checkpoint is auto-approved so the chain can continue. **No live Andrew round-trip was executed** — every scenario entry below is marked `pending live verification` and will surface in `/gsd:audit-uat` later for actual human attestation.

This file's `status: partial` reflects that the three scenarios (Jesse / Maya / Herzog) are scaffolded but un-attested. When Andrew runs the live round-trip, each scenario's `result:` should be flipped from `pending live verification` to `pass` (or `issue` with verbatim reported text and inferred severity) and the file frontmatter `status:` advanced to `complete`.

The automated zero-regression matrix (Plan 16-09 Task 1, see `16-VERIFICATION.md`) **has passed** independently — the Jesse-default path is byte-equivalent to Phase 14 by explicit count assertion. The live UAT is the additional editorial-judgment gate (does the voice actually feel like Maya / Herzog when Andrew reads the chronicled output) and the chip-placement / no-console-error end-to-end smoke.

## Current Test

[auto-approved under --auto chain — pending live Andrew attestation on all 3 scenarios]

## Tests

### 1. Scenario A — Jesse (legacy default, regression check)

expected: |
  Drive a pipeline run against a draft issue with `narratorSlug` unset (or
  explicitly `jesse`). Confirm chronicled section bodies read as Jesse (no
  Maya/Herzog tells). Publish; confirm NO narrator chip renders; issue reads
  identically to a Phase 14 published issue (byline, publish date, mission).

steps: |
  1. In Sanity Studio, open the most recent draft issue. Confirm
     `narratorSlug` is unset (or explicitly set to `jesse`).
  2. Trigger a pipeline run against this draft (or replay a Phase 14
     fixture).
  3. After chronicler output completes: confirm the chronicled section
     bodies read as Jesse. No Maya/Herzog tells.
  4. Publish the draft. Open `/issue/[slug]`.
  5. Confirm NO narrator chip renders.
  6. Confirm the issue reads identically to a Phase 14 published issue
     (byline, publish date, mission).

result: pending live verification
verification_status: auto-approved under --auto chain
notes: |
  Automated proxy for this scenario passed in 16-VERIFICATION.md Section D
  (Phase 14 named-test allowlist) and Section G (NRR-04 byte-equivalence
  test — assemble_voice(None) == VOICE_CONSTRAINTS). The live regression
  surface (Andrew reads a real chronicled output and confirms it doesn't
  drift from Jesse register) remains pending.

### 2. Scenario B — Maya Rudolph

expected: |
  Set `narratorSlug` to `maya-rudolph` in the picker; Studio preview shows
  Maya's voiceRubric and at least one exampleSample. Trigger a pipeline run;
  chronicled sections read in Maya's voice (sly, dry, warm — shorter than
  Herzog, warmer than Jesse). Publish; chip renders as "Narrated by Maya
  Rudolph" ABOVE the publish-date element (D-19; verify DOM order in
  devtools).

steps: |
  1. Open the same (or new) draft issue. Set `narratorSlug` to
     `maya-rudolph` in the picker.
  2. Confirm Studio preview shows Maya's voiceRubric and at least one
     exampleSample.
  3. Trigger a pipeline run.
  4. After chronicler output completes: confirm sections read in Maya's
     voice (sly, dry, warm). Sentences shorter than Herzog; warmer than
     Jesse.
  5. Publish. Open `/issue/[slug]`.
  6. Confirm the narrator chip renders with text "Narrated by Maya
     Rudolph".
  7. Confirm the chip appears ABOVE the publish-date element (D-19) — use
     browser devtools to confirm DOM order.

result: pending live verification
verification_status: auto-approved under --auto chain
notes: |
  Automated proxies passing: NRR-02 chronicler narrator-aware
  (test_chronicler.py::test_narrator_voice_propagation), NRR-04 section
  writers propagate narrator voice (test_section_writer_voice_propagation),
  NRR-08(a-e) chip rendered + above <time> in source order
  (apps/web/__tests__/narrator-chip.test.ts 9/9 PASS). Editorial-judgment
  layer (Andrew confirms the voice actually FEELS like Maya) remains
  pending live attestation.

### 3. Scenario C — Werner Herzog (draft preview only — no publish required)

expected: |
  Set `narratorSlug` to `werner-herzog`. Studio preview shows Herzog's
  voiceRubric. Trigger a pipeline run (or just the chronicler agent in dev
  mode). Confirm chronicler dry-run output reads in Herzog's register
  (longer, more grave sentences; periodic structure; Latinate vocabulary).
  Either publish and verify chip ("Narrated by Werner Herzog") above
  publish-date OR confirm in Studio preview that the chip would render.

steps: |
  1. Open the same (or new) draft issue. Set `narratorSlug` to
     `werner-herzog`.
  2. Confirm Studio preview shows Herzog's voiceRubric.
  3. Trigger a pipeline run (or just the chronicler agent in dev mode).
  4. Confirm at least the chronicler dry-run output reads in Herzog's
     register (longer, more grave sentences).
  5. Either publish and verify chip ("Narrated by Werner Herzog") above
     publish-date, OR confirm in Studio preview that the chip would render.

result: pending live verification
verification_status: auto-approved under --auto chain
notes: |
  Same automated coverage as Scenario B (NRR-02, NRR-04, NRR-08) — Herzog
  + Maya share the same code path; the per-narrator voiceConstraints +
  exampleSamples carry the distinction. Editorial-judgment layer (Andrew
  confirms Herzog grav-register vs Maya warm-register vs Jesse dry-precise
  register) remains pending live attestation.

### 4. Aggregate confirmations (record alongside Scenarios A-C)

expected: |
  - All three scenarios completed.
  - Chip placement matches D-19 (DOM order: byline → chip → publish-date).
  - Chronicled voice qualitatively shifts between narrators (subjective —
    Andrew judges).
  - Phase 14 Jesse path renders identically to baseline.
  - No console errors in the browser during any scenario.
  - Pipeline logs show calibrator resolved the correct narrator on each
    run.

result: pending live verification
verification_status: auto-approved under --auto chain
notes: |
  Automated proxies for sub-items: chip placement = NRR-08(e) source-scan
  asserts chipPos < timePos in IssueHero source (DOM-order proxy, see
  Plan 16-08b SUMMARY); calibrator-resolves-correct-narrator = NRR-03
  test_calibrator_narrator.py 3/3 PASS. Console-errors-in-browser and
  qualitative voice-shift remain pending live attestation.

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0
auto_approved_pending_live: 4

## Gaps

None recorded yet. When Andrew drives the live round-trip and finds any
gap, append a YAML entry below with verbatim reported text, inferred
severity, and test number. Empty until then.

<!-- Example gap entry shape (uncomment + populate when a real issue surfaces):
- truth: "Chip renders ABOVE the publish-date element on the issue page"
  status: failed
  reason: "User reported: <verbatim>"
  severity: major
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
-->

## Resume Path for Live Attestation

When Andrew is ready to drive the live round-trip, this file is the
canonical scaffold. Per scenario:

1. Run the steps under each test (1-3).
2. Edit the `result:` field from `pending live verification` to `pass` (or
   `issue` with verbatim `reported:` text and inferred `severity:`).
3. If issue, also append a YAML entry to `## Gaps` so it surfaces in
   `/gsd:plan-phase --gaps`.
4. When all 3 scenarios + the aggregate confirmation (test 4) are
   attested, advance frontmatter `status:` from `partial` to `complete`
   and update `updated:` timestamp.
5. `/gsd:audit-uat 16` will pick up this file via the `auto_chain: true`
   + `pending live verification` markers and report it as outstanding
   until each result is flipped.

---

*Auto-approved under --auto chain: 2026-05-30T08:30:00Z — Plan 16-09 Task 2.*
*Awaiting live Andrew attestation on Scenarios A / B / C + Aggregate.*
