---
phase: 24-prompt-editor-versioning
plan: 04a
type: execute
wave: 3
depends_on: [24-03]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/prompts/scout_user.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/advocate_user.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/calibrator_user.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/editor_gate1_user.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/editor_final_user.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/game_user.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/design_user.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/bonus_big_budget_user.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/bonus_jingle_user.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/bonus_spec_ad_user.md
  - packages/pipeline/tests/test_prompt_version_seeds.py
autonomous: true
requirements: [PRM-01]
must_haves:
  truths:
    - "Each agent's inline user-prompt template is captured to a versioned *_user.md file, byte-identical (after token substitution) to the current inline assembled user message"
    - "test_user_template_seed_byte_equivalence asserts byte-equality for every key with real captured expected values (no xfail/TODO placeholders remain)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/prompts/scout_user.md"
      provides: "Externalized scout user template (byte-verified)"
      contains: "PROMPT START"
    - path: "packages/pipeline/tests/test_prompt_version_seeds.py"
      provides: "Real byte-equivalence assertions for all 11 user templates"
      contains: "test_user_template_seed_byte_equivalence"
  key_links:
    - from: "*_user.md token placeholders"
      to: "agent _build_messages runtime values"
      via: ".replace('{token}', value) reproduces original byte-for-byte"
      pattern: "\\{[a-z_]+\\}"
---

<objective>
Capture each agent's inline user-message template (the `user = (...)` strings in every
`_build_messages`) into a versioned `*_user.md` file, byte-equivalent to the current inline strings.
Convert per-template runtime interpolation to the established `{token}` + `str.replace` pattern (NOT
str.format). Make the Plan-01 `test_user_template_seed_byte_equivalence` test GREEN with real expected
values.

This is the first half of the former Plan 04 (split for scope). Call-site swaps + seed extension are
in Plan 04b.

Purpose: PRM-01 — operator can edit BOTH system prompt (already migrated) AND user-prompt template.
Output: 11 `*_user.md` files and the byte-equivalence test made GREEN.
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
load_prompt(name) returns content between `<!-- PROMPT START -->` / `<!-- PROMPT END -->`, stripping one
  leading + one trailing newline. New .md files MUST use these markers.
RunConfig.user_templates: dict[str,str] (added by Plan 03), keyed by USER_TEMPLATE_KEYS.
Token substitution convention: `template.replace("{token}", value)` — NEVER str.format (literal braces in prose).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Capture each inline user template into a *_user.md file, byte-verified</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/prompts/scout_user.md, advocate_user.md, calibrator_user.md, editor_gate1_user.md, editor_final_user.md, researcher_user.md, game_user.md, design_user.md, bonus_big_budget_user.md, bonus_jingle_user.md, bonus_spec_ad_user.md, packages/pipeline/tests/test_prompt_version_seeds.py</files>
  <behavior>
    - For each of the 11 user-template agentKeys, load_prompt("&lt;key&gt;") returns a string that, after
      substituting the SAME runtime tokens the current inline code substitutes, is byte-identical to the
      current assembled user message string
    - test_prompt_version_seeds.py::test_user_template_seed_byte_equivalence asserts this for every key
      against a captured expected value (no xfail/TODO placeholders remain)
  </behavior>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py (_build_messages user string, lines 199-206)
    - packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py (_build_messages user string, lines 72-76)
    - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py (_build_messages user string, lines 122-125)
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py (BOTH gate1 and final _build_messages user strings)
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py, game.py, design/__init__.py, bonus.py (all _build_messages user strings)
    - packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py (marker convention + leading/trailing newline stripping)
  </read_first>
  <action>
    For each agent, copy the EXACT current `user = (...)` assembled string into a `&lt;key&gt;_user.md` file
    wrapped in `&lt;!-- PROMPT START --&gt;` / `&lt;!-- PROMPT END --&gt;` markers. Where the current inline string
    interpolates a runtime value via an f-string (e.g. candidates_json, results_block, display_list,
    charity_name), replace that interpolation with a literal `{token}` placeholder named to match the
    runtime variable, and record the token name (Plan 04b consumes these token names for the call-site
    swaps). For static user strings with no interpolation (e.g. calibrator's user, advocate's trailing
    instruction), the .md is the literal text.

    CRITICAL byte-equivalence: the marker convention strips exactly one leading + one trailing newline.
    Author each .md so load_prompt returns the template with `{token}` placeholders such that
    `.replace("{token}", runtime_value)` reproduces the original `user` string byte-for-byte.

    Then update test_prompt_version_seeds.py::test_user_template_seed_byte_equivalence: replace the Plan-01
    placeholders with a real assertion per key. For each key, build the expected `user` string by calling
    the agent's `_build_messages(...)` with a fixed synthetic state/inputs and assert it equals
    load_prompt("&lt;key&gt;") with those same tokens substituted.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.prompts import load_prompt; [load_prompt(k) for k in ('scout_user','advocate_user','calibrator_user','editor_gate1_user','editor_final_user','researcher_user','game_user','design_user','bonus_big_budget_user','bonus_jingle_user','bonus_spec_ad_user')]; print('ALL_LOADED')"</automated>
  </verify>
  <acceptance_criteria>
    - The python -c command prints `ALL_LOADED` (all 11 files exist with valid markers)
    - Each `*_user.md` contains both `PROMPT START` and `PROMPT END` markers
    - `grep -c "xfail\|TODO" packages/pipeline/tests/test_prompt_version_seeds.py` returns 0
    - `cd packages/pipeline && uv run pytest tests/test_prompt_version_seeds.py::test_user_template_seed_byte_equivalence -x -q` PASSES
  </acceptance_criteria>
  <done>11 user-template .md files authored; byte-equivalence test green.</done>
</task>

</tasks>

<verification>
- 11 user templates externalized to .md and byte-verified against the inline source strings.
- test_user_template_seed_byte_equivalence GREEN with real captured values.
</verification>

<success_criteria>
The 11 user-template assets exist on disk as `{token}`-parameterized .md files byte-identical to the
pre-externalization inline strings; the byte-equivalence oracle is green. Plan 04b can now swap the
call sites and seed the rows.
</success_criteria>

<output>
After completion, create `.planning/phases/24-prompt-editor-versioning/24-04a-SUMMARY.md`
</output>
