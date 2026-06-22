---
phase: 24-prompt-editor-versioning
plan: 05a
type: execute
wave: 4
depends_on: [24-03, 24-04a]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_origin.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_problem.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_founder_bio_verified.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_founder_bio_anonymous.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_case_study_verified.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_case_study_anonymous.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/rubric.md
  - packages/pipeline/tests/test_prompt_version_seeds.py
autonomous: true
requirements: [PRM-01]
must_haves:
  truths:
    - "SECTION_GUIDANCE for origin/problem and GUIDANCE_VERIFIED/ANONYMOUS for founder_bio/case_study are captured to .md files byte-identical to the in-code Python constants (STRUCTURE_CONTRACT suffix included)"
    - "qa/rubric.md is captured to a .md file byte-identical to the original rubric content"
    - "founder_bio/case_study anonymous variants store the UNformatted template (literal {role} preserved)"
    - "test_section_guidance_seed_byte_equivalence and test_rubric_seed_byte_equivalence are GREEN"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_origin.md"
      provides: "Externalized origin SECTION_GUIDANCE incl. STRUCTURE_CONTRACT suffix"
      contains: "STRUCTURE CONTRACT"
    - path: "packages/pipeline/src/eisenbalm_pipeline/prompts/rubric.md"
      provides: "Externalized QA rubric"
      contains: "PROMPT START"
  key_links:
    - from: "*_anonymous.md"
      to: "runtime .format(role=role) branch"
      via: "literal {role} placeholder preserved in stored template"
      pattern: "\\{role\\}"
---

<objective>
Capture the two Phase-22-deferred guidance corpora to disk: the section-writer `SECTION_GUIDANCE` /
`GUIDANCE_VERIFIED` / `GUIDANCE_ANONYMOUS` strings (origin, problem, founder_bio, case_study) and
`agents/qa/rubric.md`, each as a `.md` file byte-identical to source, plus the byte-equivalence tests.

This is the first half of the former Plan 05 (split for scope). Call-site swaps + seed extension are
in Plan 05b.

Critical nuance (RESEARCH Pitfall 3 + 6): the guidance constants append `STRUCTURE_CONTRACT` at
module load, so the .md source-of-truth is the Python CONSTANT (post-append), not a hand copy; and
`founder_bio`/`case_study` use TWO agentKeys each (`_verified`/`_anonymous`) — the anonymous variants
keep their runtime `{role}` `.format()` branch (store the pre-`.format` template).

Purpose: PRM-01 (full editable corpus — section guidance + rubric).
Output: 7 `.md` files and byte-equivalence tests green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/24-prompt-editor-versioning/24-CONTEXT.md
@.planning/phases/24-prompt-editor-versioning/24-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py
@packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py

<interfaces>
RunConfig.section_guidance: dict[str,str] keyed by SECTION_GUIDANCE_KEYS (origin/problem/founder_bio_*/case_study_*).
RunConfig.rubric: Optional[str] (key 'rubric').
AGENT_KEY_TO_PROMPT_FILE maps these keys to file stems (Plan 03).
GUIDANCE_ANONYMOUS contains a literal `{role}` and is runtime `.format(role=role)`-ed in
  _select_guidance_and_scrub (founder_bio.py:111, case_study.py:104).
load_prompt strips one leading + one trailing newline — author .md accordingly.
test_prompt_version_seeds.py was first touched in Plan 04a — extend it, do not clobber 04a's tests.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Externalize the 7 guidance/rubric assets to .md, byte-verified against Python constants</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_origin.md, section_guidance_problem.md, section_guidance_founder_bio_verified.md, section_guidance_founder_bio_anonymous.md, section_guidance_case_study_verified.md, section_guidance_case_study_anonymous.md, rubric.md, packages/pipeline/tests/test_prompt_version_seeds.py</files>
  <behavior>
    - load_prompt("section_guidance_origin") == origin_story.SECTION_GUIDANCE (post STRUCTURE_CONTRACT append)
    - load_prompt("section_guidance_problem") == problem.SECTION_GUIDANCE
    - load_prompt("section_guidance_founder_bio_verified") == founder_bio.GUIDANCE_VERIFIED
    - load_prompt("section_guidance_founder_bio_anonymous") == founder_bio.GUIDANCE_ANONYMOUS (UNformatted, still containing literal {role})
    - load_prompt("section_guidance_case_study_verified") == case_study.GUIDANCE_VERIFIED
    - load_prompt("section_guidance_case_study_anonymous") == case_study.GUIDANCE_ANONYMOUS (UNformatted)
    - load_prompt("rubric") == the content of agents/qa/rubric.md (byte-equal)
  </behavior>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py (SECTION_GUIDANCE + STRUCTURE_CONTRACT, lines 38-57)
    - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py (SECTION_GUIDANCE + STRUCTURE_CONTRACT, lines 38-61)
    - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py (GUIDANCE_VERIFIED/ANONYMOUS + STRUCTURE_CONTRACT, lines 39-66; note {role})
    - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py (same shape, lines 38-65)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md (full)
    - packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py (marker stripping)
    - packages/pipeline/tests/test_prompt_version_seeds.py (Plan 04a's user-template test — extend, do not remove)
  </read_first>
  <action>
    For each guidance asset, write the .md so load_prompt returns a string byte-identical to the FINAL
    Python constant (after the `X = X + STRUCTURE_CONTRACT` append). Source of truth is the constant, not
    a manual copy. For the anonymous variants, store the template WITH the literal `{role}` placeholder
    intact (do NOT pre-format it). Wrap each in PROMPT START/END markers; account for the one-newline
    strip so byte-equivalence holds.
    For rubric.md: copy the content of agents/qa/rubric.md verbatim into prompts/rubric.md wrapped in
    PROMPT START/END so load_prompt("rubric") equals the original rubric file content byte-for-byte.

    Extend test_prompt_version_seeds.py with `test_section_guidance_seed_byte_equivalence` and
    `test_rubric_seed_byte_equivalence` (the Plan-01 scaffolds) — import the Python constants and assert
    byte-equality against load_prompt(...). For the anonymous variants, assert against the UNformatted
    constant (the one containing `{role}`). Leave Plan 04a's user-template test intact.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_prompt_version_seeds.py::test_section_guidance_seed_byte_equivalence tests/test_prompt_version_seeds.py::test_rubric_seed_byte_equivalence -x -q 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - Both named tests PASS
    - `grep -q "STRUCTURE CONTRACT" packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_origin.md` (STRUCTURE_CONTRACT suffix present)
    - `grep -q "{role}" packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_founder_bio_anonymous.md` (unformatted role token preserved)
    - all 7 files contain PROMPT START / PROMPT END markers
    - Plan 04a's user-template test still passes: `cd packages/pipeline && uv run pytest tests/test_prompt_version_seeds.py::test_user_template_seed_byte_equivalence -x -q` PASSES
  </acceptance_criteria>
  <done>7 guidance/rubric .md files authored; byte-equivalence tests green; 04a test preserved.</done>
</task>

</tasks>

<verification>
- 7 guidance/rubric assets externalized to .md and byte-verified against the Python constants.
- {role} token preserved unformatted; STRUCTURE_CONTRACT suffix present; 04a test intact.
</verification>

<success_criteria>
Section guidance + rubric exist on disk as .md files byte-identical to source; their byte-equivalence
oracles are green. Plan 05b can now swap call sites and seed the rows.
</success_criteria>

<output>
After completion, create `.planning/phases/24-prompt-editor-versioning/24-05a-SUMMARY.md`
</output>
