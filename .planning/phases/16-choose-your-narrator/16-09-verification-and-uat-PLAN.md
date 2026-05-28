---
phase: 16-choose-your-narrator
plan: 09
type: execute
wave: 5
depends_on: [16-04, 16-05, 16-06, 16-07, 16-08a, 16-08b]
files_modified:
  - .planning/phases/16-choose-your-narrator/16-VERIFICATION.md
  - .planning/phases/16-choose-your-narrator/16-UAT.md
autonomous: false
requirements:
  - NRR-01
  - NRR-02
  - NRR-03
  - NRR-04
  - NRR-05
  - NRR-06
  - NRR-07
  - NRR-08
  - NRR-09
  - NRR-10
  - NRR-11
  - NRR-12
  - NRR-13
  - NRR-14
must_haves:
  truths:
    - "Per-task verification map covers every NRR-01..NRR-14 requirement with a named task ID"
    - "Zero-regression gate asserts pipeline test count ≥ Phase 14 baseline (168) + Phase 16 additions"
    - "Zero-regression gate asserts web commerce sentinel count ≥ Phase 8 baseline (29 CMR- tests)"
    - "Andrew end-to-end UAT confirms full Maya/Herzog/Jesse round-trip works"
  artifacts:
    - path: ".planning/phases/16-choose-your-narrator/16-VERIFICATION.md"
      provides: "Automated verification report with explicit count assertions"
    - path: ".planning/phases/16-choose-your-narrator/16-UAT.md"
      provides: "Andrew's UAT log for end-to-end narrator pick + chronicler output + chip render"
  key_links:
    - from: "16-VERIFICATION.md"
      to: "Plan 16-02 + Plan 16-03 test files"
      via: "named pytest / vitest invocations with count gates"
      pattern: "pytest ... | grep -oE \"[0-9]+ passed\" must return ≥187"
---

<objective>
Run the full Phase 16 verification matrix, assert zero regression on Phase 14 and Phase 8 baselines via explicit test counts, and gate Phase 16 ship-readiness on Andrew's end-to-end UAT (Maya issue render + Jesse legacy issue render + Herzog draft preview in Studio).

Purpose: NRR-01..NRR-14 are individually exercised by per-task tests across Plans 16-02 through 16-08b. This plan binds them into a single matrix, adds explicit count-based regression guards (B3), and pauses for Andrew to drive the round-trip flow before declaring Phase 16 done.

Output:
- `16-VERIFICATION.md` with the per-task matrix, named pytest/vitest invocations, and explicit count assertions.
- `16-UAT.md` with Andrew's end-to-end test transcript.

Implements: all NRR-01..NRR-14 — this plan is the audit layer.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
@$HOME/.claude/get-shit-done/templates/verification.md
@$HOME/.claude/get-shit-done/templates/uat.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/16-choose-your-narrator/16-CONTEXT.md
@.planning/phases/16-choose-your-narrator/16-RESEARCH.md
@.planning/phases/16-choose-your-narrator/16-01-contract-and-schema-SUMMARY.md
@.planning/phases/16-choose-your-narrator/16-02-pipeline-test-scaffold-SUMMARY.md
@.planning/phases/16-choose-your-narrator/16-03-web-test-scaffold-SUMMARY.md
@.planning/phases/16-choose-your-narrator/16-04-voice-py-refactor-SUMMARY.md
@.planning/phases/16-choose-your-narrator/16-05-state-calibrator-writers-SUMMARY.md
@.planning/phases/16-choose-your-narrator/16-06-chronicler-narrator-SUMMARY.md
@.planning/phases/16-choose-your-narrator/16-07-qa-judge-narrator-SUMMARY.md
@.planning/phases/16-choose-your-narrator/16-08a-seed-narrators-SUMMARY.md
@.planning/phases/16-choose-your-narrator/16-08b-frontend-chip-SUMMARY.md

<decisions_implemented>
- B3 revision (count baselines): Phase 14 pipeline baseline is 168 passing tests; Phase 16 adds ~19 new tests (test_voice_constants, test_dispatch_state_narrator, test_calibrator_narrator, test_writer_system_message_invariance, test_chronicler_narrator, test_qa_judge_narrator, test_narrator_cost_budget, test_narrator_seed_sentinel). Total expected ≥187. Phase 8 commerce sentinel baseline is 29 CMR- tests.
- B6 revision: NRR-10 byte-equivalence asserted on BOTH system AND user QA messages — not just system.
- W11 revision: disambiguate per-task map row IDs and add a row for NRR-07.
</decisions_implemented>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Run zero-regression matrix with explicit test count assertions (B3)</name>
  <files>.planning/phases/16-choose-your-narrator/16-VERIFICATION.md</files>

  <read_first>
    1. CONFIRM the Phase 14 pipeline test baseline (168). Run once on the pre-Phase-16 git ref OR rely on the documented baseline in `.planning/phases/14-*-SUMMARY.md`.
    2. CONFIRM the Phase 8 commerce sentinel baseline (29 CMR- tests). Run once or check `.planning/phases/08-*-SUMMARY.md`.
    3. CONFIRM all six SUMMARY files referenced in `<context>` exist (i.e., upstream plans completed).
  </read_first>

  <action>
    Author `16-VERIFICATION.md` (use `~/.claude/get-shit-done/templates/verification.md` as a starting template). The file MUST include:

    ### Section A — Per-Task Verification Map (W11 fix: disambiguated row IDs)

    | NRR ID | Description | Task ID | Verify Command |
    |--------|-------------|---------|----------------|
    | NRR-01 | Narrative writers byte-identical to Phase 14 (VOICE_CONSTRAINTS verbatim) | 16-02-01a | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice_constants.py::test_voice_byte_equivalence -v` |
    | NRR-02 | Chronicler narrator-aware | 16-06-01 | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_chronicler_narrator.py -v` |
    | NRR-03 | Calibrator is single resolution point | 16-05-02 | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py -v` |
    | NRR-04 | VOICE_CONSTRAINTS symbol preserved + JESSE_PERSONA_BLOCK names Jesse | 16-02-01b | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice_constants.py::test_jesse_persona_block_names_jesse_explicitly -v` |
    | NRR-05 | DispatchState has narrator + narrator_slug | 16-02-01 / 16-05-01 | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_dispatch_state_narrator.py -v` |
    | NRR-06 | No leakage to non-chronicler / non-QA agents | 16-05-03 | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_writer_system_message_invariance.py -v` |
    | NRR-07 | Andrew can pick narrator in Studio with exampleSamples preview | 16-08a-03 | Andrew checkpoint (Plan 16-08a Task 3) — recorded in 16-UAT.md |
    | NRR-08 | WINNER AUTHORITY lives in chronicler.py, not voice.py | 16-06-01 | `[ "$(grep -c 'WINNER AUTHORITY' packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py)" -ge 1 ] && [ "$(grep -c 'WINNER AUTHORITY' packages/pipeline/src/eisenbalm_pipeline/lib/voice.py)" -eq 0 ]` |
    | NRR-09 | QA judge narrator-aware | 16-07-01 | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_qa_judge_narrator.py -v` |
    | NRR-10 | QA judge byte-identical (system + user) when narrator=None | 16-07-01 | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_qa_judge_narrator.py::test_qa_judge_narrator_none_preserves_legacy_messages -v` |
    | NRR-11 | Narrator is Studio-curated content | 16-08a-03 | Andrew checkpoint (Plan 16-08a Task 3) |
    | NRR-12 | Jesse seed sentinel anchored to VOICE_CONSTRAINTS | 16-02-01c / 16-08a-01 | `uv run --project packages/pipeline pytest packages/pipeline/tests/test_narrator_seed_sentinel.py -v` |
    | NRR-13 | Frontend surfaces narrator on issue page | 16-08b-03 | `pnpm --filter web test:unit --run apps/web/__tests__/issue/narrator-chip.test.ts` |
    | NRR-14 | Jesse implicit, non-Jesse explicit | 16-08b-03 | Same as NRR-13 (chip absent for jesse, present for others) |

    Note row-ID disambiguation: NRR-01 / NRR-04 / NRR-12 all live in pipeline test files Plan 16-02 Task 1 produced. The task IDs are suffixed (a/b/c) to point at the exact pytest filter. NRR-07 maps to the Plan 16-08a Task 3 Andrew checkpoint (no automated verify possible — recorded in UAT.md).

    ### Section B — Zero-regression gates (B3 fix: explicit counts)

    Three named acceptance criteria, run as bash commands and recorded with the exact numeric outputs:

    1. **Pipeline test count ≥187** (Phase 14 baseline 168 + Phase 16 additions ~19):
       ```bash
       PIPELINE_COUNT=$(uv run --project packages/pipeline pytest packages/pipeline/tests/ 2>&1 | tail -3 | grep -oE "[0-9]+ passed" | awk '{print $1}')
       echo "Pipeline passing tests: $PIPELINE_COUNT (expect ≥187)"
       [ "$PIPELINE_COUNT" -ge 187 ] || (echo "REGRESSION: pipeline test count dropped" && exit 1)
       ```

    2. **Commerce sentinel count ≥29** (Phase 8 baseline):
       ```bash
       CMR_COUNT=$(pnpm --filter web test:unit 2>&1 | grep -c "CMR-")
       echo "Commerce sentinel hits: $CMR_COUNT (expect ≥29)"
       [ "$CMR_COUNT" -ge 29 ] || (echo "REGRESSION: commerce sentinel count dropped" && exit 1)
       ```

    3. **No new lint errors**:
       ```bash
       pnpm --filter web lint && pnpm --filter studio lint
       uv run --project packages/pipeline ruff check packages/pipeline/src packages/pipeline/tests
       ```

    Record actual numeric outputs in 16-VERIFICATION.md alongside the commands.

    ### Section C — WINNER AUTHORITY cross-check (B1)

    ```bash
    [ "$(grep -c 'WINNER AUTHORITY' packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py)" -ge 1 ]
    [ "$(grep -c 'WINNER AUTHORITY' packages/pipeline/src/eisenbalm_pipeline/lib/voice.py)" -eq 0 ]
    ```

    Record exact grep output.

    ### Section D — Phase 14 named-test allowlist

    Spot-check a sample of Phase 14 tests that exercise the writer agents (origin_story, founder_bio, case_study, bonus) still pass under narrator=Jesse default. Capture the test names and pass status.
  </action>

  <verify>
    <automated>
      # 1. Pipeline count gate.
      PIPELINE_COUNT=$(uv run --project packages/pipeline pytest packages/pipeline/tests/ 2>&1 | tail -3 | grep -oE "[0-9]+ passed" | awk '{print $1}')
      echo "Pipeline passing: $PIPELINE_COUNT"
      [ "$PIPELINE_COUNT" -ge 187 ]

      # 2. Commerce sentinel count gate.
      CMR_COUNT=$(pnpm --filter web test:unit 2>&1 | grep -c "CMR-")
      echo "Commerce sentinel hits: $CMR_COUNT"
      [ "$CMR_COUNT" -ge 29 ]

      # 3. WINNER AUTHORITY cross-check (B1).
      [ "$(grep -c 'WINNER AUTHORITY' packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py)" -ge 1 ]
      [ "$(grep -c 'WINNER AUTHORITY' packages/pipeline/src/eisenbalm_pipeline/lib/voice.py)" -eq 0 ]

      # 4. No placeholder leftover in narrators.json (B5).
      ! grep -E "VERBATIM_FROM|TODO|PLACEHOLDER" apps/studio/seeds/narrators.json

      # 5. All per-NRR named tests pass.
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_voice_constants.py packages/pipeline/tests/test_dispatch_state_narrator.py packages/pipeline/tests/test_calibrator_narrator.py packages/pipeline/tests/test_writer_system_message_invariance.py packages/pipeline/tests/test_chronicler_narrator.py packages/pipeline/tests/test_qa_judge_narrator.py packages/pipeline/tests/test_narrator_seed_sentinel.py packages/pipeline/tests/test_narrator_cost_budget.py -v
      pnpm --filter web test:unit --run apps/web/__tests__/issue/narrator-chip.test.ts

      # 6. 16-VERIFICATION.md exists and records all three gate outputs.
      [ -f .planning/phases/16-choose-your-narrator/16-VERIFICATION.md ]
      grep -q "Pipeline passing tests" .planning/phases/16-choose-your-narrator/16-VERIFICATION.md
      grep -q "Commerce sentinel hits" .planning/phases/16-choose-your-narrator/16-VERIFICATION.md
      grep -q "WINNER AUTHORITY" .planning/phases/16-choose-your-narrator/16-VERIFICATION.md
    </automated>
  </verify>

  <done>
    - 16-VERIFICATION.md exists with all four sections.
    - Pipeline test count gate satisfied (≥187).
    - Commerce sentinel gate satisfied (≥29).
    - WINNER AUTHORITY cross-check passes.
    - No placeholder tokens in narrators.json.
    - All per-NRR named tests pass.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Andrew end-to-end UAT — Maya/Herzog/Jesse round-trip (record in 16-UAT.md)</name>
  <files>.planning/phases/16-choose-your-narrator/16-UAT.md</files>

  <what-built>
    Phase 16 narrator support is wired end-to-end:
    - Three narrators seeded in Sanity Studio (Plan 16-08a).
    - Pipeline narrator resolution + chronicler / QA judge narrator-awareness (Plans 16-04 through 16-07).
    - Frontend narrator chip on issue pages (Plan 16-08b).

    All automated tests pass per Task 1 above. This checkpoint binds the wiring into Andrew's hands: pick a narrator on a real draft issue, drive the pipeline, watch the chronicler output speak in the narrator's voice, confirm the chip renders on the published page.
  </what-built>

  <how-to-verify>
    Drive three scenarios in sequence. Record actual output verbatim in `16-UAT.md`.

    ### Scenario A — Jesse (legacy default, regression check)

    1. In Sanity Studio, open the most recent draft issue. Confirm `narratorSlug` is unset (or explicitly set to `jesse`).
    2. Trigger a pipeline run against this draft (or replay a Phase 14 fixture).
    3. After chronicler output completes: confirm the chronicled section bodies read as Jesse. No Maya/Herzog tells.
    4. Publish the draft. Open `/issue/[slug]`.
    5. Confirm NO narrator chip renders.
    6. Confirm the issue reads identically to a Phase 14 published issue (byline, publish date, mission).

    ### Scenario B — Maya Rudolph

    1. Open the same (or new) draft issue. Set `narratorSlug` to `maya-rudolph` in the picker.
    2. Confirm Studio preview shows Maya's voiceRubric and at least one exampleSample.
    3. Trigger a pipeline run.
    4. After chronicler output completes: confirm sections read in Maya's voice (sly, dry, warm). Sentences shorter than Herzog; warmer than Jesse.
    5. Publish. Open `/issue/[slug]`.
    6. Confirm the narrator chip renders with text "Narrated by Maya Rudolph".
    7. Confirm the chip appears ABOVE the publish-date element (D-19) — use browser devtools to confirm DOM order.

    ### Scenario C — Werner Herzog (draft preview only — no publish required)

    1. Open the same (or new) draft issue. Set `narratorSlug` to `werner-herzog`.
    2. Confirm Studio preview shows Herzog's voiceRubric.
    3. Trigger a pipeline run (or just the chronicler agent in dev mode).
    4. Confirm at least the chronicler dry-run output reads in Herzog's register (longer, more grave sentences).
    5. Either publish and verify chip ("Narrated by Werner Herzog") above publish-date, OR confirm in Studio preview that the chip would render.

    ### Aggregate confirmations to record in 16-UAT.md:

    - All three scenarios completed.
    - Chip placement matches D-19 (DOM order: byline → chip → publish-date).
    - Chronicled voice qualitatively shifts between narrators (subjective — Andrew judges).
    - Phase 14 Jesse path renders identically to baseline.
    - No console errors in the browser during any scenario.
    - Pipeline logs show calibrator resolved the correct narrator on each run.
  </how-to-verify>

  <resume-signal>
    Type "approved" once all three scenarios are complete and recorded in `16-UAT.md`, OR describe any issue (failed voice shift, missing chip, regression on Jesse path).
  </resume-signal>

  <action>
    This task is a manual checkpoint. Andrew executes the three scenarios in `<how-to-verify>` against the production stack and records observations verbatim in `.planning/phases/16-choose-your-narrator/16-UAT.md`. There is no Claude-automated action.
  </action>

  <verify>
    <automated>(checkpoint — manual: Andrew confirms each scenario in &lt;how-to-verify&gt; and types "approved" in &lt;resume-signal&gt;)</automated>
  </verify>

  <done>
    Andrew types "approved" after all three scenarios (Jesse, Maya, Herzog) are recorded in 16-UAT.md with PASS verdicts.
  </done>
</task>

</tasks>

<verification>
- 16-VERIFICATION.md exists and contains all sections.
- Task 1 zero-regression gates pass with named numeric outputs recorded.
- Task 2 Andrew checkpoint passes with `16-UAT.md` containing transcripts for all three scenarios.
- All cross-checks (WINNER AUTHORITY, placeholder absence) pass.
</verification>

<success_criteria>
- Phase 16 ship-readiness confirmed.
- Every NRR-01..NRR-14 has a documented verification (test or human checkpoint).
- Phase 14 pipeline baseline (168) and Phase 8 commerce sentinel baseline (29) are non-regressed by EXPLICIT count assertion.
- Andrew has driven the full Maya/Herzog/Jesse loop and signed off.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-09-verification-and-uat-SUMMARY.md`. Record:
- Final numeric outputs from the three zero-regression gates.
- Excerpt of Andrew's UAT confirmations.
- Cross-reference to `16-VERIFICATION.md` and `16-UAT.md` for full transcripts.
</output>
