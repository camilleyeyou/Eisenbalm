---
phase: 16-choose-your-narrator
plan: 09
type: execute
wave: 3
depends_on: ["16-04", "16-05", "16-06", "16-07", "16-08"]
files_modified:
  - .planning/phases/16-choose-your-narrator/16-VALIDATION.md
  - .planning/phases/16-choose-your-narrator/16-HUMAN-UAT.md
autonomous: false
requirements: [NRR-10]
must_haves:
  truths:
    - "All Phase 16 Wave 0 RED tests are GREEN: test_voice.py (4), test_narrator_seed_sentinel.py (1), test_narrator_cost_budget.py (3 parametrized), test_calibrator_narrator.py (3), test_section_writer_voice_propagation.py (4 parametrized), test_qa_judge_narrator.py (3), test_chronicler.py::test_narrator_voice_propagation (1)"
    - "All 8 existing web tripwires + 29 CMR sentinels GREEN: deliberation-no-model-names, game-sandbox, typography, deliberation-conversation, podcast-slot, theme-aa-tones, shop-page, narrator-chip (Plan 16-03 file flipping fully GREEN with Plan 16-08 implementation)"
    - "Full pipeline pytest suite (≥168 + ~19 Phase 16 = ≥187 tests) exits 0 — zero regression on Phase 1-15 contracts"
    - "pnpm --filter web test:unit exits 0; pnpm --filter web build exits 0"
    - "16-VALIDATION.md frontmatter flipped to nyquist_compliant: true and wave_0_complete: true; Per-Task Verification Map TBD task IDs filled with the canonical 16-NN-NN identifiers from Plans 16-01 through 16-08"
    - "16-HUMAN-UAT.md created with Andrew's UAT checklist for Success Criterion 1 (Herzog issue reads as Herzog) + Success Criterion 4 (Studio picker UX) + Success Criterion 5 (chip placement + copy) + D-14 inactive narrator fallback (run with a parked narrator + confirm warning event in Convex)"
    - "Andrew has run at least ONE narrator-aware pipeline run end-to-end against the production Sanity dataset: weeklyIssue.narrator set to werner-herzog, real OpenRouter call (not stub mode), QA score recorded, draft Sanity issue contains Herzog-voice sections + Herzog-voice chronicler conversation"
  artifacts:
    - path: ".planning/phases/16-choose-your-narrator/16-VALIDATION.md"
      provides: "Updated frontmatter + task-to-requirement map with 16-NN-NN IDs filled in"
      contains: "nyquist_compliant: true"
    - path: ".planning/phases/16-choose-your-narrator/16-HUMAN-UAT.md"
      provides: "Andrew's manual UAT checklist for Phase 16 success criteria + D-14 inactive narrator manual test"
      contains: "Herzog"
  key_links:
    - from: ".planning/phases/16-choose-your-narrator/16-VALIDATION.md"
      to: "Plans 16-01 through 16-08 PLAN.md files"
      via: "task ID assignment + filled Per-Task Verification Map"
      pattern: "16-0[1-8]"
    - from: ".planning/phases/16-choose-your-narrator/16-HUMAN-UAT.md"
      to: ".planning/phases/16-choose-your-narrator/16-INTENT.md Werner Herzog sample"
      via: "Andrew compares pipeline output to the client-supplied acceptance reference"
      pattern: "Werner Herzog"
---

<objective>
Close Phase 16. Run the full test matrix to confirm every NRR-* requirement has flipped from RED to GREEN. Flip 16-VALIDATION.md to nyquist_compliant: true with the Per-Task Verification Map TBD IDs filled in. Author 16-HUMAN-UAT.md with Andrew's manual UAT checklist covering Success Criteria 1, 4, 5 + the D-14 inactive narrator path. Andrew runs a real Herzog-narrator pipeline end-to-end against production Sanity and confirms the output reads as Herzog (not Jesse-in-disguise) per the client-supplied acceptance bar from 16-INTENT.md.

This plan is the verification + UAT close-out. It does NOT modify any production code — only the planning docs (VALIDATION.md, HUMAN-UAT.md). The autonomous-false checkpoint is Andrew's UAT confirmation: a single Herzog run must produce a Sanity draft whose Origin Story / Problem / Founder Bio / Case Study sections read as Herzog when Andrew reads them aloud (the human-judgable bar from 16-INTENT.md).

Output: 2 planning files updated; full test matrix green; Andrew UAT signed off.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/16-choose-your-narrator/16-CONTEXT.md
@.planning/phases/16-choose-your-narrator/16-INTENT.md
@.planning/phases/16-choose-your-narrator/16-VALIDATION.md
@.planning/phases/16-choose-your-narrator/16-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Run full test matrix and confirm all GREEN</name>
  <files></files>
  <read_first>
    - .planning/phases/16-choose-your-narrator/16-VALIDATION.md (the full validation contract — every test in Per-Task Verification Map MUST exit 0 here)
  </read_first>
  <action>
Run the full test matrix in this exact order and capture the outputs:

(A) Pipeline byte-equivalence + voice constants:
```bash
uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice.py -v
```
Expected: 4 tests PASS (test_voice_constants_byte_equivalence, test_jesse_explicit_narrator_byte_equivalence, test_universal_core_contains_dem_04_rule, test_universal_core_contains_no_exclamation_rule).

(B) Pipeline seed sentinel + cost budget:
```bash
uv run --project packages/pipeline pytest packages/pipeline/tests/test_narrator_seed_sentinel.py packages/pipeline/tests/test_narrator_cost_budget.py -v
```
Expected: 1 + 3 = 4 tests PASS.

(C) Pipeline Calibrator narrator + 4 writer propagation + QA judge narrator + chronicler narrator:
```bash
uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py packages/pipeline/tests/test_section_writer_voice_propagation.py packages/pipeline/tests/test_qa_judge_narrator.py packages/pipeline/tests/test_chronicler.py -v
```
Expected: 3 + 4 + 3 + (existing Phase 13 chronicler tests + 1 new test_narrator_voice_propagation) all PASS.

(D) Full pipeline pytest suite — zero regression:
```bash
uv run --project packages/pipeline pytest packages/pipeline/tests/ -v
```
Expected: ≥187 tests pass (168 Phase 14 baseline + ~19 Phase 16 new). Exit 0.

(E) Web Vitest suite — narrator-chip + 8 existing tripwires + 29 CMR sentinels:
```bash
pnpm --filter web test:unit
```
Expected: narrator-chip.test.ts ≥7 assertions GREEN; deliberation-no-model-names + game-sandbox + typography + deliberation-conversation + podcast-slot + theme-aa-tones + shop-page + all CMR sentinels GREEN. Exit 0.

(F) Web build — TypeScript + Next.js production build:
```bash
pnpm --filter web build
```
Expected: exit 0.

If ANY suite fails, halt and report. Do not flip nyquist_compliant: true until all 6 commands above exit 0. Capture the test counts and timing in the SUMMARY.md.
  </action>
  <verify>
    <automated>uv run --project packages/pipeline pytest packages/pipeline/tests/ -q exits 0; pnpm --filter web test:unit exits 0; pnpm --filter web build exits 0; echo "FULL MATRIX GREEN"</automated>
  </verify>
  <done>All 6 commands exit 0. Captures pasted into the eventual SUMMARY.md.</done>
</task>

<task type="auto">
  <name>Task 2: Update 16-VALIDATION.md — flip nyquist_compliant + fill Per-Task Verification Map task IDs</name>
  <files>.planning/phases/16-choose-your-narrator/16-VALIDATION.md</files>
  <read_first>
    - .planning/phases/16-choose-your-narrator/16-VALIDATION.md FULL FILE (current frontmatter has nyquist_compliant: false; Per-Task Verification Map has 15 rows with TBD task IDs in columns 1+2)
    - All 9 created PLAN.md files (16-01 through 16-09) — locate which plan + which requirement covers each row
  </read_first>
  <action>
Edit .planning/phases/16-choose-your-narrator/16-VALIDATION.md.

(A) Frontmatter — flip two fields:
```yaml
nyquist_compliant: true
wave_0_complete: true
```

(B) Per-Task Verification Map — fill TBD columns. Use this mapping (derived from each plan's requirements + the test file each plan turns green):

| Task ID | Plan | Wave | Requirement | Test Command |
|---------|------|------|-------------|--------------|
| 16-02-01 | 16-02 | 0 | NRR-03, NRR-10 | test_voice.py::test_voice_constants_byte_equivalence |
| 16-02-01 | 16-02 | 0 | NRR-03, NRR-10 | test_voice.py::test_jesse_explicit_narrator_byte_equivalence |
| 16-02-01 | 16-02 | 0 | NRR-09 | test_narrator_seed_sentinel.py::test_jesse_seed_matches_persona_block |
| 16-02-01 | 16-02 | 0 | NRR-10 (cost ≤10%) | test_narrator_cost_budget.py |
| 16-03-01 | 16-03 | 0 | NRR-02, NRR-08 | narrator-chip.test.ts |
| 16-01-02 | 16-01 | 0 | NRR-01 | pnpm typegen + NarratorProfile in sanity.types.ts |
| 16-01-03 | 16-01 | 0 | NRR-02 | grep narrator in weeklyIssue.ts |
| 16-05-02 | 16-05 | 2 | NRR-03 (Calibrator) | test_calibrator_narrator.py |
| 16-05-03 | 16-05 | 2 | NRR-04 (4 writers) | test_section_writer_voice_propagation.py |
| 16-06-01 | 16-06 | 2 | NRR-05 (Chronicler) | test_chronicler.py::test_narrator_voice_propagation |
| 16-07-01 | 16-07 | 2 | NRR-06 (QA rubric) | test_qa_judge_narrator.py |
| 16-08-04 | 16-08 | 2 | NRR-08 (frontend chip) | narrator-chip.test.ts (DOM + source-scan) |
| 16-08-05 | 16-08 | 2 | NRR-09 (seed) | pnpm seed:narrators (manual + automated) |
| 16-09-01 | 16-09 | 3 | NRR-10 (tripwires) | full pipeline pytest + web test:unit |
| 16-05-02 | 16-05 | 2 | NRR-10 (inactive warning) | test_calibrator_narrator.py::test_inactive_narrator_falls_back_to_jesse_with_warning |

Update the Validation Sign-Off section at the bottom — flip all 5 checkboxes to checked and the Approval line to `**Approval:** approved — Phase 16 closed YYYY-MM-DD`.
  </action>
  <verify>
    <automated>grep -E "nyquist_compliant: true" .planning/phases/16-choose-your-narrator/16-VALIDATION.md returns a match; grep -E "wave_0_complete: true" .planning/phases/16-choose-your-narrator/16-VALIDATION.md returns a match; grep -c "TBD" .planning/phases/16-choose-your-narrator/16-VALIDATION.md returns 0 in the Per-Task Verification Map section (all task ID slots filled); grep -E "Approval.*approved" .planning/phases/16-choose-your-narrator/16-VALIDATION.md returns a match</automated>
  </verify>
  <done>16-VALIDATION.md flipped to nyquist_compliant: true with task IDs filled; sign-off approved.</done>
</task>

<task type="auto">
  <name>Task 3: Create 16-HUMAN-UAT.md with Andrew's manual UAT checklist</name>
  <files>.planning/phases/16-choose-your-narrator/16-HUMAN-UAT.md</files>
  <read_first>
    - .planning/phases/16-choose-your-narrator/16-INTENT.md "Voice samples (acceptance reference)" section — Andrew uses the Werner Herzog sample as the qualitative bar
    - .planning/phases/13-deliberation-as-conversation/13-HUMAN-UAT.md (Phase 13 UAT pattern to mirror — checklist format, success criteria mapping, Andrew approval line)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-14 (inactive narrator UAT scenario)
    - .planning/phases/16-choose-your-narrator/16-VALIDATION.md §Manual-Only Verifications (the 4 manual verification items)
  </read_first>
  <action>
Create .planning/phases/16-choose-your-narrator/16-HUMAN-UAT.md:

```markdown
[YAML frontmatter block:]
  phase: 16-choose-your-narrator
  type: human-uat
  status: pending
  created: YYYY-MM-DD
[end frontmatter]

# Phase 16 — Human UAT Checklist (Andrew)

> Authored by /gsd:plan-phase Plan 16-09 close-out.
> Andrew runs through each item; sign off at the bottom.

## Pre-UAT setup

- [ ] Plan 16-08 Task 5 already approved (3 narrators seeded into production Sanity dataset).
- [ ] Studio is deployed and reachable at the canonical Sanity Studio URL.
- [ ] Production pipeline (Railway FastAPI) is healthy: `curl https://<railway-domain>/healthz` returns 200.
- [ ] Real OpenRouter token, Tavily token, SANITY_API_TOKEN in Railway secrets (Phase 5 baseline).

## Success Criterion 1 — Herzog issue reads as Herzog (NRR-04 + Success Criterion 1)

- [ ] Create a new `weeklyIssue` draft in Studio (issue number N where N is the next free integer).
- [ ] Set `weeklyIssue.narrator` to `werner-herzog`.
- [ ] Trigger pipeline run: `POST /run/weekly` with `{issueNumber: N, narrator: "werner-herzog"}` (or whatever the production trigger shape is per Phase 4 contract).
- [ ] Wait for completion (~3 minutes per Phase 5 cost baseline).
- [ ] Open the resulting Sanity draft.
- [ ] **Read the Origin Story aloud.** Does it sound like Werner Herzog?
  - Bar: does it reach for the geological-time register? Are there wry comparisons (the opera-house, the river)?
  - Compare to the Werner Herzog Origin Story sample in `.planning/phases/16-choose-your-narrator/16-INTENT.md`.
  - PASS if it reads as Herzog. FAIL if it reads as Jesse-in-disguise.
- [ ] **Read the Problem Statement aloud.** Same test.
- [ ] **Read the Founder Bio aloud.** Same test.
- [ ] **Read the Case Study aloud.** Same test.
- [ ] **Check the deliberation conversation** (DeliberationSlot on the rendered issue page): does the Editor's final turn still name the WINNER (Phase 13 D-04 + quick task 260524-ojm preserved)? Is the dialogue in Herzog register?

Notes section (Andrew fills in observations / spot-rewrites needed):
```
[Andrew notes here]
```

## Success Criterion 2 — Jesse-default (NRR-10 zero-regression)

- [ ] Create a second `weeklyIssue` draft (issue N+1) with `narrator` UNSET.
- [ ] Trigger pipeline run.
- [ ] **Spot check** the Origin Story / Problem / Founder Bio / Case Study against the latest pre-Phase-16 Jesse-default issue (issue 999 from Phase 5 baseline or whichever was the last canonical Jesse issue).
- [ ] PASS if Jesse voice is byte-equivalent in feel (small deviations expected from LLM stochasticity; no register drift).

## Success Criterion 4 — Studio picker UX (NRR-07)

- [ ] Open any `weeklyIssue` draft → confirm "Narrator" reference picker is visible above the pipelineMetadata group.
- [ ] Click into picker → confirm all 3 seeded narrators (jesse, maya-rudolph, werner-herzog) appear.
- [ ] Click on werner-herzog → confirm the Studio reference card opens the narratorProfile document showing the `exampleSamples` array entries inline.
- [ ] Confirm the picker can be CLEARED back to no-selection (D-16 — defaults to no selection footgun mitigation).

## Success Criterion 5 — Frontend chip (NRR-08)

- [ ] Load the Herzog-narrator issue page (the Success Criterion 1 issue) in the deployed web app.
- [ ] Confirm "Narrated by Werner Herzog" chip renders under the issue title.
- [ ] Confirm chip styling: --color-text-mute, Inter uppercase, 0.18em letter-spacing, ~11px (Phase 12 MED-04 convention).
- [ ] Confirm chip placement: after the byline "by Jesse A. Eisenbalm", before the mission statement.
- [ ] Load the Jesse-default issue page (Success Criterion 2 issue) → confirm NO chip renders.
- [ ] Open browser network inspector → confirm GROQ response does NOT include voiceConstraints / voiceRubric / exampleSamples (Pitfall 8 security gate).

## D-14 — Inactive narrator silent fallback (NRR-10)

- [ ] In Studio, create a 4th narrator profile (e.g. "Aaron Sorkin") with `active: false`.
- [ ] Reference it on a new `weeklyIssue` draft.
- [ ] Trigger pipeline run.
- [ ] Confirm the issue ships with Jesse voice (not Sorkin).
- [ ] Open Convex dashboard → `deliberationEvents` table → find a row with `agentId: 'calibrator'`, `eventType: 'editor-decision'`, payload containing `"warning"` and the inactive narrator name.
- [ ] PASS if the warning is recorded AND the run completes successfully.

## Sign-off

- [ ] Success Criterion 1: PASS / FAIL (Herzog reads as Herzog)
- [ ] Success Criterion 2: PASS / FAIL (Jesse-default zero-regression)
- [ ] Success Criterion 4: PASS / FAIL (Studio picker functional)
- [ ] Success Criterion 5: PASS / FAIL (Chip placement + no leak)
- [ ] D-14 inactive narrator: PASS / FAIL

**Approval:** ___________  **Date:** ___________
```

The exact wording can be tightened. The core checklist must cover the 4 manual verifications from 16-VALIDATION.md plus the D-14 path.
  </action>
  <verify>
    <automated>test -f .planning/phases/16-choose-your-narrator/16-HUMAN-UAT.md; grep -E "Werner Herzog" .planning/phases/16-choose-your-narrator/16-HUMAN-UAT.md returns at least 3 matches; grep -E "Approval" .planning/phases/16-choose-your-narrator/16-HUMAN-UAT.md returns a match; grep -E "D-14" .planning/phases/16-choose-your-narrator/16-HUMAN-UAT.md returns a match</automated>
  </verify>
  <done>16-HUMAN-UAT.md created with the 5 UAT sections + sign-off block.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Andrew executes 16-HUMAN-UAT.md end-to-end + signs off</name>
  <what-built>
Tasks 1-3 ran the full automated test matrix, flipped 16-VALIDATION.md to nyquist_compliant: true, and authored the 16-HUMAN-UAT.md checklist. Andrew now executes the UAT checklist against the production stack, confirms each Success Criterion + D-14, and signs off.

This is the Phase 16 close-out gate. After Andrew's approval, the phase is complete; STATE.md updates and ROADMAP.md Phase 16 completion happen in the post-execute phase-close step.
  </what-built>
  <how-to-verify>
1. Open .planning/phases/16-choose-your-narrator/16-HUMAN-UAT.md.
2. Work through each checklist item in order: Pre-UAT setup → Success Criterion 1 → 2 → 4 → 5 → D-14.
3. For Success Criterion 1: read each section ALOUD and compare to the Werner Herzog sample in 16-INTENT.md. The bar is "does it sound like Herzog or like Jesse-in-disguise?" — the latter fails.
4. Fill in the sign-off PASS / FAIL line for each Success Criterion.
5. If any FAIL: report the specific failure mode (which Success Criterion, what was observed vs expected). The plan does NOT close until all 5 are PASS.
6. If all 5 PASS: sign the Approval line and date. Type "approved" here to signal completion.
  </how-to-verify>
    <action>
This task is a manual checkpoint — Andrew executes the steps in <how-to-verify> below. There is no Claude-automated action for this task; the verification happens entirely in the user's environment with the user's credentials.
  </action>
  <verify>
    <automated>(checkpoint — manual: Andrew confirms each step in <how-to-verify> and types "approved" in <resume-signal>)</automated>
  </verify>
  <done>Andrew types "approved" after completing each <how-to-verify> step successfully.</done>
  <resume-signal>Type "approved" with the 5 PASS lines confirmed, or report specific Success Criterion failures.</resume-signal>
</task>

</tasks>

<verification>
- 6-command test matrix all exit 0.
- 16-VALIDATION.md nyquist_compliant: true.
- 16-HUMAN-UAT.md exists with full 5-section checklist.
- Andrew has signed off on all 5 Success Criteria (1, 2, 4, 5, D-14).
- Phase 16 ready for STATE.md / ROADMAP.md close-out.
</verification>

<success_criteria>
- NRR-10 zero-regression: full test matrix + Andrew UAT confirms.
- Success Criteria 1 (Herzog) + 4 (Studio) + 5 (chip) + D-14 (inactive) all PASS.
- The phase ships only when Andrew reads a Herzog Origin Story aloud and confirms it sounds like Herzog (the human-judgable bar from 16-INTENT.md is the binding gate).
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-09-SUMMARY.md` documenting: the test matrix counts (e.g. "187 pipeline tests pass, 0 fail"), the Andrew UAT outcome per Success Criterion, any spot-rewrite observations Andrew flagged, and the final approval timestamp.
</output>
