---
phase: 24-prompt-editor-versioning
plan: 05
type: execute
wave: 4
depends_on: [24-03, 24-04]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_origin.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_problem.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_founder_bio_verified.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_founder_bio_anonymous.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_case_study_verified.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_case_study_anonymous.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/rubric.md
  - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
  - packages/pipeline/scripts/seed_phase24_assets.py
  - packages/pipeline/tests/test_prompt_version_seeds.py
autonomous: true
requirements: [PRM-01]
must_haves:
  truths:
    - "SECTION_GUIDANCE for origin/problem and GUIDANCE_VERIFIED/ANONYMOUS for founder_bio/case_study are externalized to versioned rows and read from RunConfig.section_guidance"
    - "qa/rubric.md is externalized to a versioned row and read from RunConfig.rubric"
    - "Seeded v1 content is byte-identical to the in-code Python constants (STRUCTURE_CONTRACT suffix included)"
    - "founder_bio/case_study anonymous variants preserve the runtime {role} .format() branch"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_origin.md"
      provides: "Externalized origin SECTION_GUIDANCE incl. STRUCTURE_CONTRACT suffix"
      contains: "STRUCTURE CONTRACT"
    - path: "packages/pipeline/src/eisenbalm_pipeline/prompts/rubric.md"
      provides: "Externalized QA rubric"
      contains: "PROMPT START"
  key_links:
    - from: "section writer / qa call sites"
      to: "RunConfig.section_guidance / RunConfig.rubric"
      via: "state['config'] with disk fallback"
      pattern: "section_guidance\\[|\\.rubric"
---

<objective>
Clear the two Phase-22 deferrals: externalize the section-writer `SECTION_GUIDANCE` /
`GUIDANCE_VERIFIED` / `GUIDANCE_ANONYMOUS` strings (origin, problem, founder_bio, case_study)
and `agents/qa/rubric.md` into versioned `prompt_versions` rows, byte-identical to source, read
from `RunConfig.section_guidance` / `RunConfig.rubric` at run start with disk fallback.

Critical nuance (RESEARCH Pitfall 3 + 6): the guidance constants append `STRUCTURE_CONTRACT` at
module load, so the seed source-of-truth is the Python CONSTANT (post-append), not a hand copy;
and `founder_bio`/`case_study` use TWO agentKeys each (`_verified`/`_anonymous`) — the anonymous
variants keep their runtime `{role}` `.format()` branch (store the pre-`.format` template).

Purpose: PRM-01 (full editable corpus — section guidance + rubric).
Output: 7 `.md` files, 5 call-site swaps, seed-script extension, byte-equivalence tests green.
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
build_section_writer_prompt(..., section_guidance=...) consumes the guidance string (lib/voice.py).
GUIDANCE_ANONYMOUS contains a literal `{role}` and is runtime `.format(role=role)`-ed in
  _select_guidance_and_scrub (founder_bio.py:111, case_study.py:104).
load_prompt strips one leading + one trailing newline — author .md accordingly.
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
    constant (the one containing `{role}`).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_prompt_version_seeds.py::test_section_guidance_seed_byte_equivalence tests/test_prompt_version_seeds.py::test_rubric_seed_byte_equivalence -x -q 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - Both named tests PASS
    - `grep -q "STRUCTURE CONTRACT" packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_origin.md` (STRUCTURE_CONTRACT suffix present)
    - `grep -q "{role}" packages/pipeline/src/eisenbalm_pipeline/prompts/section_guidance_founder_bio_anonymous.md` (unformatted role token preserved)
    - all 7 files contain PROMPT START / PROMPT END markers
  </acceptance_criteria>
  <done>7 guidance/rubric .md files authored; byte-equivalence tests green.</done>
</task>

<task type="auto">
  <name>Task 2: Swap section-writer + QA call sites to read guidance/rubric from RunConfig</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py, problem.py, founder_bio.py, case_study.py, packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py</files>
  <read_first>
    - origin_story.py (lines ~100-115 where SECTION_GUIDANCE is passed to build_section_writer_prompt)
    - problem.py (same)
    - founder_bio.py (_select_guidance_and_scrub, lines 89-111 — both branches + .format(role))
    - case_study.py (_select_guidance_and_scrub, lines ~89-104)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py (where rubric.md is currently read — grep for `rubric`)
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (RunConfig.section_guidance / .rubric)
  </read_first>
  <action>
    origin_story.py / problem.py: where `section_guidance=SECTION_GUIDANCE` is passed, replace with a
    config-first read: `cfg = state.get("config"); guidance = cfg.section_guidance.get("section_guidance_origin")
    if cfg and cfg.section_guidance.get("section_guidance_origin") else SECTION_GUIDANCE` (use the
    matching key per agent), then pass `guidance`. Keep SECTION_GUIDANCE as the disk/code fallback.

    founder_bio.py / case_study.py: in `_select_guidance_and_scrub`, change the verified/anonymous branch
    to read from `state['config'].section_guidance` for keys `founder_bio_verified`/`founder_bio_anonymous`
    (and `case_study_*`), falling back to the in-code GUIDANCE_VERIFIED/GUIDANCE_ANONYMOUS. Preserve the
    runtime `.format(role=role)` on the ANONYMOUS path EXACTLY (apply `.format(role=role)` to whichever
    source — config or code — produced the template). `_select_guidance_and_scrub` needs access to config:
    thread `state` (or `config`) into it from the caller.

    qa/judge.py: where `rubric.md` is loaded, prefer `state['config'].rubric` when present, else the
    existing on-disk read. Keep the JudgeFinding logic unchanged.

    Do NOT change build_section_writer_prompt, the structural-floor validators, or QA finding shapes.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_voice.py tests/test_section_writer_voice_propagation.py -x -q 2>&1 | tail -5 && cd packages/pipeline && uv run pytest -x -q 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rc "section_guidance.get\|config.rubric\|\.rubric" packages/pipeline/src/eisenbalm_pipeline/agents/` shows ≥5 occurrences across edited files
    - founder_bio.py and case_study.py still call `.format(role=` on the anonymous path (grep matches)
    - `cd packages/pipeline && uv run pytest tests/test_voice.py tests/test_section_writer_voice_propagation.py -x -q` PASSES
    - Full suite green: `cd packages/pipeline && uv run pytest -x -q` exits 0 (Phase 18 MEL structural tests stay green)
  </acceptance_criteria>
  <done>5 call sites read guidance/rubric from config with disk fallback; {role} branch preserved; suite green.</done>
</task>

<task type="auto">
  <name>Task 3: Extend seed script with guidance + rubric keys</name>
  <files>packages/pipeline/scripts/seed_phase24_assets.py</files>
  <read_first>
    - packages/pipeline/scripts/seed_phase24_assets.py (Plan 04 version — extend, don't rewrite)
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (SECTION_GUIDANCE_KEYS + 'rubric')
  </read_first>
  <action>
    Extend seed_phase24_assets.py to ALSO seed SECTION_GUIDANCE_KEYS and the 'rubric' key (in addition
    to USER_TEMPLATE_KEYS from Plan 04) via upsertActive, each with a byte-verification assert that the
    seeded content equals `load_prompt(AGENT_KEY_TO_PROMPT_FILE[key])`. Keep idempotency (upsertActive,
    version stays 1). Note 'Phase 24 v1 seed — byte-verified section guidance/rubric'.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "import ast; ast.parse(open('scripts/seed_phase24_assets.py').read()); print('PARSES')" && grep -q "SECTION_GUIDANCE_KEYS" packages/pipeline/scripts/seed_phase24_assets.py && grep -q "rubric" packages/pipeline/scripts/seed_phase24_assets.py && echo SEED_OK</automated>
  </verify>
  <acceptance_criteria>
    - Command prints `PARSES` then `SEED_OK`
    - `grep -c "SECTION_GUIDANCE_KEYS" packages/pipeline/scripts/seed_phase24_assets.py` returns ≥1
    - USER_TEMPLATE_KEYS seeding from Plan 04 is still present (grep matches)
  </acceptance_criteria>
  <done>Seed script covers user templates + section guidance + rubric.</done>
</task>

</tasks>

<verification>
- 7 guidance/rubric assets externalized + byte-verified + call sites swapped + seeded.
- {role} format branch + structural-floor validators preserved; full suite green.
</verification>

<success_criteria>
Both Phase-22 deferrals (section guidance, rubric) cleared; assets are operator-editable v1 rows,
read at run start, byte-identical to source behavior.
</success_criteria>

<output>
After completion, create `.planning/phases/24-prompt-editor-versioning/24-05-SUMMARY.md`
</output>
