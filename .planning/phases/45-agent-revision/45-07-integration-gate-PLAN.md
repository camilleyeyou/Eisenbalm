---
phase: 45-agent-revision
plan: 07
type: execute
wave: 4
depends_on: ["45-02", "45-03", "45-04", "45-05", "45-06"]
files_modified:
  - .planning/phases/45-agent-revision/45-VALIDATION.md
  - .planning/phases/45-agent-revision/45-UAT.md
autonomous: false
requirements: [REV-01, REV-02, REV-03, REV-04, REV-05]
must_haves:
  truths:
    - "The full pipeline pytest suite and the full console vitest suite are green with zero tripwire regressions"
    - "The strict Next build (pnpm/npm build) for dispatch-control passes"
    - "Any Convex functions the phase touched are synced to the dev deployment (or confirmed unchanged)"
    - "The load-bearing Annotations demo leg is human-verified end to end"
    - "Both revision entry surfaces are human-verified live: the galley selection toolbar AND the InspectorFooter 'Ask agent to revise' button open a REAL passage (D-18 — not a dead button)"
  artifacts:
    - path: ".planning/phases/45-agent-revision/45-VALIDATION.md"
      provides: "final per-task test map status + UAT capture"
      contains: "Approval"
  key_links:
    - from: "select founder phrase → Ask agent to revise → apply"
      to: "Voice Pass returns to Review needed (sign-off revoked) + header cost increments"
      via: "full-stack demo leg"
      pattern: "Review needed"
---

<objective>
Phase gate: prove Phase 45 is complete and regression-free. Run the full pipeline + console suites,
the strict console build, and confirm Convex sync; then human-verify the single load-bearing demo
leg the whole milestone hinges on (select the founder phrase → Ask agent to revise → apply →
Voice Pass returns to "Review needed" via sign-off revocation → header cost-vs-budget increments).

Purpose: this is the established integration-gate pattern (43-09/44-09). Nothing new is built — the
gate catches cross-plan integration gaps, tripwire regressions, and strict-build-only failures
(memory: vitest does not type-check; run the strict build before declaring a frontend phase done),
and captures the one human-only verification.
Output: green full suites + strict build + Convex-sync confirmation + a signed-off UAT capture.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/45-agent-revision/45-VALIDATION.md
@docs/API_CONTRACTS.md
@docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md

<interfaces>
<!-- Suite + gate commands (45-VALIDATION §Test Infrastructure). -->
Pipeline full:  cd packages/pipeline && python -m pytest
Console full:   cd apps/dispatch-control && npm run test
Strict build:   cd apps/dispatch-control && npm run build
Convex sync:    pnpm --filter @eisenbalm/convex dev:once   (memory: committing convex/*.ts ≠ deployed)
EDT-05 tripwire: apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts (must stay green)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Full suites + strict build + tripwires green; Convex sync</name>
  <requirements>REV-01, REV-02, REV-03, REV-04, REV-05</requirements>
  <read_first>
    - .planning/phases/45-agent-revision/45-VALIDATION.md — the per-task test map to mark green + the sampling/gate rules.
    - the .claude memory note "Run strict build before frontend phase done" — vitest does not type-check; the strict `npm run build` is the gate that caught prior Vercel/Linux-only bugs.
    - the .claude memory note "Convex functions need live sync" — this phase touched no Convex schema (REV-05 uses existing queries), but confirm nothing convex/*.ts changed; if it did, sync it.
  </read_first>
  <files>.planning/phases/45-agent-revision/45-VALIDATION.md</files>
  <action>
Run and confirm all green (fix any cross-plan integration gap surfaced — do not paper over):
1. `cd packages/pipeline && python -m pytest` — full pipeline suite (incl. test_revision_endpoints.py, test_budget.py, test_factcheck_endpoints.py regression).
2. `cd apps/dispatch-control && npm run test` — full console vitest (incl. blockIndexFromKey, DirectionChips, RevisionComparisonCard, PassageToolbar, FrameChromeCostReadout, derivedState, and the EDT-05 no-Sanity-write tripwire + every prior tripwire).
3. `cd apps/dispatch-control && npm run build` — strict Next build MUST pass (type-checks the whole app; catches the Linux/Vercel-only failures vitest misses).
4. Convex: confirm `git status convex/` shows no phase-45 changes (this phase adds no Convex schema/function — REV-05 reads existing `agentRuns.byRunId`/`pipelineConfig.getAll`). If any `convex/*.ts` changed, run `pnpm --filter @eisenbalm/convex dev:once` to sync to `dev:modest-magpie-797` and confirm no type errors.
Update `45-VALIDATION.md`: set every Per-Task Verification Map row to ✅ green with its owning plan/task id, and flip `nyquist_compliant: true` in the frontmatter.
  </action>
  <verify>
    <automated>cd packages/pipeline && python -m pytest -q && cd ../../apps/dispatch-control && npm run test && npm run build 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && python -m pytest -q` exits 0 (zero failures).
    - `cd apps/dispatch-control && npm run test` exits 0 including `dispatch-control-no-sanity-write.test.ts`.
    - `cd apps/dispatch-control && npm run build` exits 0 (strict build).
    - `45-VALIDATION.md` has every test-map row marked ✅ and `nyquist_compliant: true`.
  </acceptance_criteria>
  <done>Both full suites and the strict console build are green with zero tripwire regressions; Convex is in sync; the validation map is complete.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Human-verify the Annotations demo leg</name>
  <requirements>REV-01, REV-02, REV-03, REV-04, REV-05</requirements>
  <files>.planning/phases/45-agent-revision/45-UAT.md</files>
  <what-built>
The full passage-revision flow across Draft/Voice from BOTH entry surfaces — the six-action galley
selection toolbar AND the Phase-44 InspectorFooter "Ask agent to revise" button (D-18) — the seven
direction chips, the comparison card with an explicit claim delta, the atomic apply through the
content-patch write boundary with sign-off revocation, and the header cost-vs-budget readout with a
per-issue guard.
  </what-built>
  <action>
Pause for the operator to perform the live verification steps in how-to-verify on a real run. This is
a human-verify checkpoint — the executor runs no code here; it presents the steps, waits for the
resume signal, and records the pass/fail outcome of each step into
`.planning/phases/45-agent-revision/45-UAT.md` (mirroring Phase 43/44 UAT persistence). Any failure
is recorded as a gap for a follow-up `--gaps` plan, never silently marked pass. Under an active
`--auto` chain with no live browser/Clerk session, persist the steps as UAT items (status: pending)
rather than blocking indefinitely — mirroring the 44-09 precedent.
  </action>
  <how-to-verify>
On a run that has reached review (Draft/Voice) in the dispatch-control app:
1. Open the issue's Draft (Stage 2). Select a phrase in the Founder Bio (e.g. the founder
   characterization). Confirm a toolbar appears offering exactly six actions: Edit text, Ask agent to
   revise, Compare with previous, Restore previous, Related facts & sources, Inspect how this was
   made — with Compare/Restore visibly reserved (disabled + explanatory tooltip).
2. Click "Ask agent to revise". Confirm the seven direction chips appear (Make clearer / Make more
   specific / Tighten / Match the brief / Reduce repetition / Try another approach / Custom) — and
   NO bare "Regenerate".
3. Pick a chip. Confirm a comparison card returns BEFORE anything applies: original (struck through),
   proposed, a "What changed" line, and the explicit claim delta (added / removed / altered).
4. Confirm the four actions: Apply, Edit before applying, Try another approach, Discard. Try "Try
   another approach" (proposal changes) and "Edit before applying" (editable proposed text).
5. Click Apply. Confirm the draft updates (the applied text appears) and, on the Voice stage, the
   Voice Pass returns to "Review needed" (the sign-off was revoked — Phase-34 wiring, not the
   prototype bug where voiceDone survives).
6. Confirm the header cost-vs-budget readout incremented after the revision call (never blank/$0).
7. Second entry surface (D-18): open "Inspect how this was made" for a drafted section, then click the
   InspectorFooter "Ask agent to revise" button. Confirm it is LIVE (not reserved/greyed) and opens the
   SAME revision flow scoped to a REAL passage — the direction chips appear and picking one returns a
   comparison card (NOT a "span not resolved" error). This proves the inspector-footer surface is a real
   entry point, not a dead button.
8. (Optional) Exhaust the per-issue cap and confirm the chips render disabled-with-explanation
   (409 cost guard), never a silent failure.
  </how-to-verify>
  <verify>Human confirms per the how-to-verify steps; the per-step outcomes are written to 45-UAT.md.</verify>
  <resume-signal>Type "approved" or describe any step that failed (which step, expected vs actual).</resume-signal>
  <done>45-UAT.md records a pass/fail per demo-leg step; the operator has approved (or gaps are logged for a --gaps plan).</done>
</task>

</tasks>

<verification>
- Full pipeline pytest + full console vitest green; strict `npm run build` green; EDT-05 tripwire green.
- Demo leg human-verified end to end.
- 45-VALIDATION.md map all ✅, nyquist_compliant: true.
</verification>

<success_criteria>
Phase 45 is regression-free (both suites + strict build green, zero tripwire regressions), Convex is
in sync, and the load-bearing Annotations demo leg is human-verified: passage selection → chips →
comparison card with claim delta → apply through the write boundary → Voice returns to Review needed
→ cost readout increments, bounded by the per-issue guard.
</success_criteria>

<output>
After completion, create `.planning/phases/45-agent-revision/45-07-SUMMARY.md` and record the UAT
capture in `.planning/phases/45-agent-revision/45-UAT.md`.
</output>
