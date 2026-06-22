---
phase: 24-prompt-editor-versioning
plan: 05b
type: execute
wave: 5
depends_on: [24-04b, 24-05a]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
  - packages/pipeline/scripts/seed_phase24_assets.py
autonomous: true
requirements: [PRM-01]
must_haves:
  truths:
    - "Section writers read guidance from RunConfig.section_guidance and QA reads the rubric from RunConfig.rubric at run start, with disk/code fallback"
    - "founder_bio/case_study anonymous variants preserve the runtime {role} .format() branch exactly"
    - "The seed script also seeds SECTION_GUIDANCE_KEYS + 'rubric' rows with byte-verification asserts"
  artifacts:
    - path: "packages/pipeline/scripts/seed_phase24_assets.py"
      provides: "Seed extended with section guidance + rubric keys"
      contains: "SECTION_GUIDANCE_KEYS"
  key_links:
    - from: "section writer / qa call sites"
      to: "RunConfig.section_guidance / RunConfig.rubric"
      via: "state['config'] with disk fallback"
      pattern: "section_guidance\\[|\\.rubric"
---

<objective>
Clear the two Phase-22 deferrals at the call sites: swap origin/problem/founder_bio/case_study and
`agents/qa/judge.py` to read guidance/rubric from `RunConfig.section_guidance` / `RunConfig.rubric` at
run start (with disk/code fallback), and extend the seed script with SECTION_GUIDANCE_KEYS + 'rubric'.

This is the second half of the former Plan 05 (split for scope). The 7 `.md` files and byte-equivalence
tests were produced by Plan 05a; the seed script was created by Plan 04b.

Critical nuance: the `founder_bio`/`case_study` anonymous variants keep their runtime `{role}`
`.format()` branch — apply `.format(role=role)` to whichever source (config or code) produced the
unformatted template.

Purpose: PRM-01 (full editable corpus — section guidance + rubric).
Output: 5 call-site swaps + seed-script extension; full suite green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/24-prompt-editor-versioning/24-CONTEXT.md
@.planning/phases/24-prompt-editor-versioning/24-RESEARCH.md
@.planning/phases/24-prompt-editor-versioning/24-05a-guidance-rubric-md-and-byte-test-PLAN.md
@packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py
@packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py

<interfaces>
RunConfig.section_guidance: dict[str,str] keyed by SECTION_GUIDANCE_KEYS (origin/problem/founder_bio_*/case_study_*).
RunConfig.rubric: Optional[str] (key 'rubric').
AGENT_KEY_TO_PROMPT_FILE maps these keys to file stems (Plan 03).
build_section_writer_prompt(..., section_guidance=...) consumes the guidance string (lib/voice.py).
GUIDANCE_ANONYMOUS contains a literal `{role}` and is runtime `.format(role=role)`-ed in
  _select_guidance_and_scrub (founder_bio.py:111, case_study.py:104).
scripts/seed_phase24_assets.py already seeds USER_TEMPLATE_KEYS (Plan 04b) — extend, do not rewrite.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap section-writer + QA call sites to read guidance/rubric from RunConfig</name>
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
  <name>Task 2: Extend seed script with guidance + rubric keys</name>
  <files>packages/pipeline/scripts/seed_phase24_assets.py</files>
  <read_first>
    - packages/pipeline/scripts/seed_phase24_assets.py (Plan 04b version — extend, don't rewrite)
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (SECTION_GUIDANCE_KEYS + 'rubric')
  </read_first>
  <action>
    Extend seed_phase24_assets.py to ALSO seed SECTION_GUIDANCE_KEYS and the 'rubric' key (in addition
    to USER_TEMPLATE_KEYS from Plan 04b) via upsertActive, each with a byte-verification assert that the
    seeded content equals `load_prompt(AGENT_KEY_TO_PROMPT_FILE[key])`. Keep idempotency (upsertActive,
    version stays 1). Note 'Phase 24 v1 seed — byte-verified section guidance/rubric'.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "import ast; ast.parse(open('scripts/seed_phase24_assets.py').read()); print('PARSES')" && grep -q "SECTION_GUIDANCE_KEYS" packages/pipeline/scripts/seed_phase24_assets.py && grep -q "rubric" packages/pipeline/scripts/seed_phase24_assets.py && echo SEED_OK</automated>
  </verify>
  <acceptance_criteria>
    - Command prints `PARSES` then `SEED_OK`
    - `grep -c "SECTION_GUIDANCE_KEYS" packages/pipeline/scripts/seed_phase24_assets.py` returns ≥1
    - USER_TEMPLATE_KEYS seeding from Plan 04b is still present (grep matches)
  </acceptance_criteria>
  <done>Seed script covers user templates + section guidance + rubric.</done>
</task>

</tasks>

<verification>
- 5 call sites externalized; seed extended to guidance + rubric.
- {role} format branch + structural-floor validators preserved; full suite green.
</verification>

<success_criteria>
Both Phase-22 deferrals (section guidance, rubric) cleared; assets are operator-editable v1 rows,
read at run start, byte-identical to source behavior.
</success_criteria>

<output>
After completion, create `.planning/phases/24-prompt-editor-versioning/24-05b-SUMMARY.md`
</output>
