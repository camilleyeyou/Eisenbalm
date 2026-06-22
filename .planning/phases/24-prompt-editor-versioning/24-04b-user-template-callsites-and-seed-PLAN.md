---
phase: 24-prompt-editor-versioning
plan: 04b
type: execute
wave: 4
depends_on: [24-03, 24-04a]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/game.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
  - packages/pipeline/scripts/seed_phase24_assets.py
autonomous: true
requirements: [PRM-01]
must_haves:
  truths:
    - "Each agent's user-prompt template is read from RunConfig.user_templates[agentKey] at run start, with on-disk .md fallback (CFG-03)"
    - "Assembled user messages remain byte-identical to the pre-externalization inline strings given the same inputs"
    - "An idempotent seed script upserts the 11 user-template rows with byte-verification asserts"
  artifacts:
    - path: "packages/pipeline/scripts/seed_phase24_assets.py"
      provides: "Idempotent upsertActive seed with byte-verification asserts (USER_TEMPLATE_KEYS)"
      contains: "USER_TEMPLATE_KEYS"
  key_links:
    - from: "agent _build_messages"
      to: "RunConfig.user_templates[agentKey]"
      via: "state['config'].user_templates with disk fallback"
      pattern: "user_templates"
---

<objective>
Switch each agent call site (the `user = (...)` construction in every `_build_messages`) to read its
user template from `RunConfig.user_templates[agentKey]` with on-disk `.md` fallback, using the
`{token}` placeholders captured in Plan 04a. Add an idempotent, byte-verified seed script that upserts
the 11 user-template rows.

This is the second half of the former Plan 04 (split for scope). The 11 `*_user.md` files and the
byte-equivalence test were produced by Plan 04a.

Purpose: PRM-01 — operator-editable user templates fed at run start, byte-identical behavior.
Output: 8 agent call-site swaps and an idempotent byte-verified seed script (USER_TEMPLATE_KEYS).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/24-prompt-editor-versioning/24-CONTEXT.md
@.planning/phases/24-prompt-editor-versioning/24-RESEARCH.md
@.planning/phases/24-prompt-editor-versioning/24-04a-user-template-md-and-byte-test-PLAN.md
@packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py
@packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py

<interfaces>
load_prompt(name) returns content between `<!-- PROMPT START -->` / `<!-- PROMPT END -->`, stripping one
  leading + one trailing newline. The 11 *_user.md files (created in Plan 04a) use these markers.
RunConfig.user_templates: dict[str,str] (added by Plan 03), keyed by USER_TEMPLATE_KEYS.
Existing seed mutation: convex/promptVersions.ts `upsertActive` (idempotent v1; refreshes content, keeps version 1).
Existing convex client: packages/pipeline/.../lib/convex_client.py convex_mutation.
Token substitution convention: `template.replace("{token}", value)` — NEVER str.format (literal braces in prose).
The exact `{token}` names per template were captured in Plan 04a — re-read each *_user.md to recover them.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Swap each call site to read user template from RunConfig.user_templates</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/scout.py, advocate.py, calibrator.py, editor.py, researcher.py, game.py, design/__init__.py, bonus.py</files>
  <read_first>
    - Each agent's _build_messages (scout.py, advocate.py, calibrator.py, editor.py, researcher.py, game.py, design/__init__.py, bonus.py)
    - The 11 *_user.md files from Plan 04a (recover the exact {token} names used per template)
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (RunConfig.user_templates, AGENT_KEY_TO_PROMPT_FILE)
    - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py lines 196-210 (existing system-prompt config-read + disk-fallback pattern to mirror)
  </read_first>
  <action>
    In each `_build_messages`, replace the inline `user = (...)` construction with a config-first read:
    read `cfg = state.get("config")`; `tmpl = cfg.user_templates.get("&lt;key&gt;") if cfg and cfg.user_templates.get("&lt;key&gt;") else load_prompt("&lt;key&gt;")`;
    then `user = tmpl.replace("{token1}", value1).replace("{token2}", value2)` using the SAME tokens
    captured in Plan 04a. For static (token-free) templates no `.replace` chain is needed.
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
  <name>Task 2: Idempotent byte-verified seed script for user-template rows</name>
  <files>packages/pipeline/scripts/seed_phase24_assets.py</files>
  <read_first>
    - packages/pipeline/scripts/ (list with `ls`; read the Phase 22 prompt-seed script that called upsertActive)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (convex_mutation signature)
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (USER_TEMPLATE_KEYS, AGENT_KEY_TO_PROMPT_FILE, WORKSPACE_ID)
  </read_first>
  <action>
    Create scripts/seed_phase24_assets.py. Design it to seed a passed-in list of agentKeys (Plans 05b/06
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
- 8 agent call sites read user templates from config with disk fallback; seed script seeds 11 rows.
- Voice + structure tripwires green; full pipeline suite green.
</verification>

<success_criteria>
Operator-editable user templates exist as v1 active rows, read at run start, with disk fallback,
byte-identical to pre-externalization behavior.
</success_criteria>

<output>
After completion, create `.planning/phases/24-prompt-editor-versioning/24-04b-SUMMARY.md`
</output>
