---
phase: 47-story-brief-stage
plan: 06
type: execute
wave: 3
depends_on: ["47-05"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/story-brief/_components/OrgOptionSlate.tsx
  - apps/dispatch-control/app/(dashboard)/story-brief/_components/NeedsYourDecisionCard.tsx
  - apps/dispatch-control/__tests__/OrgOptions.test.tsx
  - apps/dispatch-control/__tests__/NeedsYourDecision.test.tsx
autonomous: true
requirements: [BRF-03, BRF-04]
must_haves:
  truths:
    - "Organization options are grouped under the chosen (one-active) lead, each showing mechanism, verification record WITH DATES, agent case, confidence, prior-coverage warning, and its main concern ALWAYS visible — never truncated or tooltip-hidden"
    - "When agents cannot confidently choose (run paused at Gate 1: status==='awaiting-review' && completedAt==null), the stage shows the top two options side by side (what each makes possible, evidence quality, risk, burden) under the label 'Needs your decision' — NEVER requiresHumanInput"
    - "Choose this story requires a rationale and resumes via the UNCHANGED adjudicateGate1(runId, {selection:{charityName}, reason}, token) path"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/story-brief/_components/OrgOptionSlate.tsx"
      provides: "BRF-03 grouped org options, never-truncated main concern"
      min_lines: 50
    - path: "apps/dispatch-control/app/(dashboard)/story-brief/_components/NeedsYourDecisionCard.tsx"
      provides: "BRF-04 two-option side-by-side adjudication + rationale + resume"
      min_lines: 50
  key_links:
    - from: "NeedsYourDecisionCard.tsx"
      to: "adjudicateGate1 (pipelineControlClient.ts)"
      via: "Choose this story with rationale, existing resume machinery"
      pattern: "adjudicateGate1"
    - from: "OrgOptionSlate.tsx"
      to: "joinCandidates + verificationRecords + charities:listByWorkspace"
      via: "client-side join on charity-{slugify(name)}"
      pattern: "joinCandidates"
---

<objective>
Build the two adjudication-facing components: `OrgOptionSlate` (BRF-03 — organization options grouped under the chosen lead) and `NeedsYourDecisionCard` (BRF-04 — the "Needs your decision" two-option side-by-side card that resumes the run). Both reuse Phase-37 substrate verbatim: `joinCandidates` (advocate join), the never-truncated-concern discipline, and the `adjudicateGate1` → `_resume_paused_run` write path (D-02/D-08 — no second resume mechanism).

Purpose: BRF-03's "main concern always visible" is the same hard tripwire as BRF-01. BRF-04's label discipline is load-bearing ("Needs your decision", never `requiresHumanInput`), the paused trigger is the EXISTING `status==='awaiting-review' && completedAt==null` predicate, and the resume is untouched.
Output: OrgOptionSlate.tsx; NeedsYourDecisionCard.tsx; two filled Wave-0 tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/47-story-brief-stage/47-CONTEXT.md
@.planning/phases/47-story-brief-stage/47-RESEARCH.md
@docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md

<interfaces>
Design contract (Annotations §Stage 1, L51-52):
- Org options: "mechanism, fit, verification summary with dates, evidence links, agent case, main concern always visible (never truncated/tooltip-hidden), confidence, prior-coverage warning."
- Paused-for-you: "Two options side by side — what each makes possible, evidence quality, risk, burden, Choose this story + required rationale. Header Activity flips to '⏸ Paused for you'. Label is 'Needs your decision', never requiresHumanInput."

Reuse targets (verified this session):
- joinCandidates (CandidateSlate.tsx L71-105): joins pitchLog rows + advocate-argument rows on charityId (fallback charityName), yielding {charityName, advocateScore, advocateArgument, primaryConcern, ...}. Extend by additionally joining verificationRecords (match candidateId === `charity-{slugify(name)}`, the confirmed identical key) and charity registry prior-coverage (`api.charities.listByWorkspace`, see RegistryTable.tsx L62).
- primaryConcern never-truncated block: CandidateSlate.tsx L197-208.
- adjudicateGate1(runId, {selection:{charityName}, reason}, token) (pipelineControlClient.ts L186-211) — UNCHANGED.
- Paused predicate (API_CONTRACTS §37.4(c)): pipelineRuns status==='awaiting-review' && completedAt==null. SignalDeskScreen.tsx L94 computes `isPausedAtGate1` the same way — reuse it.

One-active-lead-per-run (RESEARCH Pitfall 1): there is NO lead↔org join key. Group ALL of the run's surviving orgs under the single active lead (the recommended lead, or the operator-Required lead). Do NOT invent a fuzzy join.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: OrgOptionSlate.tsx — grouped org options, never-truncated concern (BRF-03)</name>
  <read_first>
    apps/dispatch-control/app/(dashboard)/signal-desk/_components/CandidateSlate.tsx (import `joinCandidates` verbatim; copy the L197-208 primaryConcern never-truncated block). apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx L62 (the `api.charities.listByWorkspace` read for prior-coverage). verification_records shape (API_CONTRACTS §46.5: candidateId, candidateName, domainLive, registrationId?, registrationVerified, pressHits, obscurityVerdict, status, killed, killReason?, checkedAt). apps/dispatch-control/__tests__/OrgOptions.test.tsx (Wave-0 scaffold to fill). Annotations §Stage 1 L51.
  </read_first>
  <behavior>
    - Each org option renders mechanism/fit, the verification record with dates (checkedAt formatted), agent case (advocateArgument), confidence (advocateScore), and a prior-coverage warning where the registry indicates prior coverage.
    - The main concern (primaryConcern) renders in full — className does NOT match /line-clamp|truncate/, textContent equals the full string.
    - Options are grouped under the single active lead (no lead-id filtering).
  </behavior>
  <action>
    Create OrgOptionSlate.tsx: consume ws.pitchRows + the advocate-argument rows via the imported `joinCandidates`, then join ws.verificationRecords (on candidateId `charity-{slugify(name)}`) and the registry prior-coverage query. Render each option per Annotations §Stage 1 with the verification dates and the never-truncated main-concern block copied from CandidateSlate. Group all under the active lead heading. Fill OrgOptions.test.tsx: assert mechanism/verification-with-dates/agent-case/confidence/prior-coverage all render, plus the main-concern never-truncated tripwire.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- OrgOptions</automated>
  </verify>
  <acceptance_criteria>
    - OrgOptionSlate.tsx imports `joinCandidates` from CandidateSlate (not a reimplementation)
    - OrgOptions.test.tsx asserts `expect(el.className).not.toMatch(/line-clamp|truncate/)` on the main-concern element and that the verification record renders a formatted date
    - The option renders confidence, agent case, and a prior-coverage warning branch
    - `pnpm --filter dispatch-control test:unit -- OrgOptions` green
  </acceptance_criteria>
  <done>Org options are grouped under the chosen lead with verification dates and an always-visible main concern.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: NeedsYourDecisionCard.tsx — two-option adjudication + resume (BRF-04)</name>
  <read_first>
    apps/dispatch-control/app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx (the pick + required-reason → adjudicateGate1 idiom — adapt to a two-column side-by-side comparison layout, do NOT reinvent the write path). apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx L94 (`isPausedAtGate1` = status==='awaiting-review' && completedAt==null — reuse this exact predicate). apps/dispatch-control/lib/pipelineControlClient.ts L186-211 (adjudicateGate1 signature — UNCHANGED). apps/dispatch-control/__tests__/NeedsYourDecision.test.tsx (Wave-0 scaffold to fill). Annotations §Stage 1 L52 + §State model L105-110. 47-RESEARCH.md §"Anti-Patterns" (no second resume/interrupt).
  </read_first>
  <behavior>
    - Renders ONLY when the run is paused at Gate 1 (status==='awaiting-review' && completedAt==null).
    - Shows the top two options side by side with the four comparison rows: what each makes possible, evidence quality, risk, burden.
    - The visible label is "Needs your decision" (the string appears; "requiresHumanInput" NEVER appears in rendered text).
    - Choose this story is disabled until a rationale is entered; on submit it calls adjudicateGate1(runId, {selection:{charityName}, reason}, token) with the picked option's charityName.
  </behavior>
  <action>
    Create NeedsYourDecisionCard.tsx: reconstruct the top-two options client-side (the joined candidates sorted by advocateScore, per §37.4(b)), lay them out in a two-column comparison with the four rows, gate the "Choose this story" button on a required rationale, and call the UNCHANGED adjudicateGate1. Use the "Needs your decision" heading and drive visibility from the reused isPausedAtGate1 predicate. Fill NeedsYourDecision.test.tsx: two options render; label text is "Needs your decision" (assert "requiresHumanInput" NOT present); Choose disabled without rationale; Choose calls adjudicateGate1 with {selection:{charityName}, reason}.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit -- NeedsYourDecision</automated>
  </verify>
  <acceptance_criteria>
    - NeedsYourDecision.test.tsx asserts the rendered label contains "Needs your decision" and does NOT contain "requiresHumanInput"
    - Test asserts Choose is disabled with empty rationale and, when chosen, calls `adjudicateGate1(runId, { selection: { charityName }, reason }, token)`
    - Two options render side by side with the four comparison rows
    - No new resume/interrupt client path is introduced (grep: only `adjudicateGate1` is called for resume)
    - `pnpm --filter dispatch-control test:unit -- NeedsYourDecision` green
  </acceptance_criteria>
  <done>The paused-for-you two-option card resumes the run through the single authoritative adjudicate path, with the correct label discipline.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit -- OrgOptions NeedsYourDecision` green; full suite green.
- No second resume path; adjudicateGate1 unchanged.
</verification>

<success_criteria>
BRF-03 and BRF-04 are implemented and unit-verified, reusing Phase-37's join, never-truncated discipline, and resume machinery verbatim.
</success_criteria>

<output>
After completion, create `.planning/phases/47-story-brief-stage/47-06-SUMMARY.md`.
</output>
