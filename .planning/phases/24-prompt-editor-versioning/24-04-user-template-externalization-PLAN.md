---
phase: 24-prompt-editor-versioning
plan: 04
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
  - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/game.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
  - packages/pipeline/scripts/seed_phase24_assets.py
  - packages/pipeline/tests/test_prompt_version_seeds.py
autonomous: true
requirements: [PRM-01]
must_haves:
  truths:
    - "Each agent's user-prompt template is externalized to a versioned prompt_versions row and read from RunConfig.user_templates at run start"
    - "Assembled user messages are byte-identical to the pre-externalization inline strings given the same inputs"
    - "When the active row is unavailable, the call site falls back to the on-disk .md (CFG-03)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/prompts/scout_user.md"
      provides: "Externalized scout user template (byte-verified seed)"
      contains: "PROMPT START"
    - path: "packages/pipeline/scripts/seed_phase24_assets.py"
      provides: "Idempotent upsertActive seed with byte-verification asserts"
      contains: "assert"
  key_links:
    - from: "agent _build_messages"
      to: "RunConfig.user_templates[agentKey]"
      via: "state['config'].user_templates with disk fallback"
      pattern: "user_templates"
---

<objective>
Externalize each agent's inline user-message template (the `user = (...)` strings in every
`_build_messages`) into versioned `prompt_versions` rows, byte-equivalent to the current inline
strings. Convert per-template runtime interpolation to the established `{token}` + `str.replace`
pattern (NOT str.format). Switch each call site to read its user template from
`RunConfig.user_templates[agentKey]` with on-disk `.md` fallback.

Purpose: PRM-01 — operator can edit BOTH system prompt (already migrated) AND user-prompt template.
Output: 11 `*_user.md` files, 8 agent call-site swaps, an idempotent byte-verified seed script,
and the Plan-01 `test_user_template_seed_byte_equivalence` test made GREEN with real expected values.
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
Existing seed mutation: convex/promptVersions.ts `upsertActive` (idempotent v1; refreshes content, keeps version 1).
Existing convex client: packages/pipeline/.../lib/convex_client.py convex_mutation.
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
    runtime variable, and record the token name. For static user strings with no interpolation (e.g.
    calibrator's user, advocate's trailing instruction), the .md is the literal text.

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

<task type="auto">
  <name>Task 2: Swap each call site to read user template from RunConfig.user_templates</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/scout.py, advocate.py, calibrator.py, editor.py, researcher.py, game.py, design/__init__.py, bonus.py</files>
  <read_first>
    - Each agent's _build_messages (same files as Task 1)
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (RunConfig.user_templates, AGENT_KEY_TO_PROMPT_FILE)
    - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py lines 196-210 (existing system-prompt config-read + disk-fallback pattern to mirror)
  </read_first>
  <action>
    In each `_build_messages`, replace the inline `user = (...)` construction with a config-first read:
    read `cfg = state.get("config")`; `tmpl = cfg.user_templates.get("&lt;key&gt;") if cfg and cfg.user_templates.get("&lt;key&gt;") else load_prompt("&lt;key&gt;")`;
    then `user = tmpl.replace("{token1}", value1).replace("{token2}", value2)` using the SAME tokens
    captured in Task 1. For static (token-free) templates no `.replace` chain is needed.
    For editor.py do this for BOTH `editor_gate1_user` and `editor_final_user`. Keep system-prompt read
    paths unchanged. Do NOT change message role order ([system, user]) or any non-message logic.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_prompt_version_seeds.py::test_user_template_seed_byte_equivalence tests/test_voice.py tests/test_section_writer_voice_propagation.py -x -q 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rc "user_templates.get" packages/pipeline/src/eisenbalm_pipeline/agents/` shows ≥8 total occurrences across edited files
    - editor.py contains both `editor_gate1_user` and `editor_final_user` reads
    - `cd packages/pipeline && uv run pytest tests/test_prompt_version_seeds.py tests/test_voice.py tests/test_section_writer_voice_propagation.py -x -q` PASSES
    - Full suite green: `cd packages/pipeline && uv run pytest -x -q` exits 0
  </acceptance_criteria>
  <done>All 8 agents read user templates from config with disk fallback; tripwires green.</done>
</task>

<task type="auto">
  <name>Task 3: Idempotent byte-verified seed script for user-template rows</name>
  <files>packages/pipeline/scripts/seed_phase24_assets.py</files>
  <read_first>
    - packages/pipeline/scripts/ (list with `ls`; read the Phase 22 prompt-seed script that called upsertActive)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (convex_mutation signature)
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (USER_TEMPLATE_KEYS, AGENT_KEY_TO_PROMPT_FILE, WORKSPACE_ID)
  </read_first>
  <action>
    Create scripts/seed_phase24_assets.py. Design it to seed a passed-in list of agentKeys (Plans 05/06
    extend it). For this plan it seeds USER_TEMPLATE_KEYS. For each key: `content = load_prompt(AGENT_KEY_TO_PROMPT_FILE[key])`;
    add a byte-verification `assert content` is non-empty and assert it round-trips through `_extract` cleanly;
    call `promptVersions:upsertActive` with `{workspace_id: 'eisenbalm', agentKey: key, content,
    note: 'Phase 24 v1 seed — byte-verified user template'}`. Idempotent: re-running upserts same content,
    version stays 1, isActive stays true. Print one OK line per key + a final count. Use the existing
    convex_mutation client and WORKSPACE_ID constant.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "import ast; ast.parse(open('scripts/seed_phase24_assets.py').read()); print('PARSES')" && grep -q "upsertActive" packages/pipeline/scripts/seed_phase24_assets.py && grep -q "assert" packages/pipeline/scripts/seed_phase24_assets.py && echo SEED_OK</automated>
  </verify>
  <acceptance_criteria>
    - The command prints `PARSES` then `SEED_OK`
    - `grep -c "upsertActive" packages/pipeline/scripts/seed_phase24_assets.py` returns ≥1
    - `grep -c "USER_TEMPLATE_KEYS" packages/pipeline/scripts/seed_phase24_assets.py` returns ≥1
    - Script is idempotent by construction (uses upsertActive, no version increment)
  </acceptance_criteria>
  <done>Idempotent byte-verified seed script for user-template rows.</done>
</task>

</tasks>

<verification>
- 11 user templates externalized + byte-verified + call sites swapped + seeded.
- Voice + structure tripwires green; full pipeline suite green.
</verification>

<success_criteria>
Operator-editable user templates exist as v1 active rows, read at run start, with disk fallback,
byte-identical to pre-externalization behavior.
</success_criteria>

<output>
After completion, create `.planning/phases/24-prompt-editor-versioning/24-04-SUMMARY.md`
</output>
