---
phase: 24-prompt-editor-versioning
plan: 03
type: execute
wave: 2
depends_on: [24-01]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py
  - docs/API_CONTRACTS.md
  - packages/pipeline/tests/test_config_loader_assets.py
autonomous: true
requirements: [PRM-01, PRM-06]
must_haves:
  truths:
    - "RunConfig carries the newly-externalized asset categories (user templates, section guidance, rubric, voice_constraints) so migration plans have a typed home to read from"
    - "config_loader hydrates every new asset key from its active prompt_versions row with per-key disk/code fallback (CFG-03 discipline preserved)"
    - "All new agentKeys are declared once in the canonical mapping so migration plans only add .md files + swap call sites"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py"
      provides: "Extended RunConfig + asset-key registries + hydration"
      contains: "voice_constraints"
  key_links:
    - from: "load_run_config"
      to: "promptVersions:getActive per new agentKey"
      via: "convex_query + disk fallback"
      pattern: "getActive"
---

<objective>
Own ALL pipeline-side config plumbing for the newly-externalized assets so the three migration
plans (04 user-templates, 05 section-guidance/rubric, 06 voice) stay decoupled from
`config_loader.py` internals. Extend `RunConfig` with the new asset fields, declare every new
agentKey in one canonical registry, and extend `load_run_config()` to hydrate each new asset from
its active `prompt_versions` row with the existing per-key disk/code fallback (CFG-03).

Purpose: a single, tested home for the new config surface (PRM-01 system+user templates loaded
from DB; PRM-06 voice loaded from DB) without scattering loader edits across plans.
Output: extended config_loader.py, RunConfig fields, a config-loader asset test, API_CONTRACTS §7 note.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/24-prompt-editor-versioning/24-CONTEXT.md
@.planning/phases/24-prompt-editor-versioning/24-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py
@packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py

<interfaces>
RunConfig (config_loader.py lines 55-69): dataclass with workspace_id, agents (dict[str,AgentConfig]),
  require_review, auto_publish, schedule_enabled. Serialized via dataclasses.asdict() for runs.configSnapshot.
AGENT_KEY_TO_PROMPT_FILE (lines 75-87): 11 system-prompt keys → file stems.
Per-key fallback: load_run_config already does `promptVersions:getActive` per key with
  try/except + log.warning + `load_prompt(file)` fallback (lines 207-231).
load_prompt(name) reads src/eisenbalm_pipeline/prompts/<name>.md between PROMPT START/END markers.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extend RunConfig with new asset fields + declare new agentKey registries</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py</files>
  <behavior>
    - RunConfig gains `voice_constraints: Optional[str] = None`, `user_templates: dict[str,str] = field(default_factory=dict)`, `section_guidance: dict[str,str] = field(default_factory=dict)`, `rubric: Optional[str] = None`
    - `dataclasses.asdict(RunConfig(...))` still serializes cleanly (no non-serializable fields)
    - New registries exist: `USER_TEMPLATE_KEYS`, `SECTION_GUIDANCE_KEYS`, `SINGLETON_ASSET_KEYS` (`rubric`, `voice_constraints`)
  </behavior>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (full)
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (Pattern 6 RunConfig extension; config_loader two-tier fallback verbatim pattern; the agentKey list in Pattern 8 + §"Verified Pattern: Config Loader Two-Tier Fallback")
    - docs/API_CONTRACTS.md §4A.2 (the canonical new agentKey list added by Plan 01)
  </read_first>
  <action>
    Edit config_loader.py. Add `from dataclasses import dataclass, field`.

    Extend RunConfig (keep existing fields + ordering of the first five) by APPENDING defaulted fields:
    ```python
    voice_constraints: Optional[str] = None
    user_templates: dict[str, str] = field(default_factory=dict)
    section_guidance: dict[str, str] = field(default_factory=dict)
    rubric: Optional[str] = None
    ```

    Declare the canonical new-key registries (data only — exact strings):
    ```python
    USER_TEMPLATE_KEYS: tuple[str, ...] = (
        "scout_user", "advocate_user", "calibrator_user", "editor_gate1_user",
        "editor_final_user", "researcher_user", "game_user", "design_user",
        "bonus_big_budget_user", "bonus_jingle_user", "bonus_spec_ad_user",
    )
    SECTION_GUIDANCE_KEYS: tuple[str, ...] = (
        "section_guidance_origin", "section_guidance_problem",
        "founder_bio_verified", "founder_bio_anonymous",
        "case_study_verified", "case_study_anonymous",
    )
    SINGLETON_ASSET_KEYS: tuple[str, ...] = ("rubric", "voice_constraints")
    ```
    Add each of these keys to `AGENT_KEY_TO_PROMPT_FILE` mapping to the file stem of the SAME name
    (e.g. `"scout_user": "scout_user"`, `"voice_constraints": "voice_constraints"`,
    `"founder_bio_verified": "section_guidance_founder_bio_verified"`,
    `"founder_bio_anonymous": "section_guidance_founder_bio_anonymous"`,
    `"case_study_verified": "section_guidance_case_study_verified"`,
    `"case_study_anonymous": "section_guidance_case_study_anonymous"`,
    `"section_guidance_origin": "section_guidance_origin"`,
    `"section_guidance_problem": "section_guidance_problem"`,
    `"rubric": "rubric"`). Keep the existing 11 system-prompt entries unchanged.
    Do NOT change the existing system-prompt hydration loop behavior for the original 11 keys.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.config_loader import RunConfig, USER_TEMPLATE_KEYS, SECTION_GUIDANCE_KEYS, SINGLETON_ASSET_KEYS; import dataclasses; r=RunConfig(workspace_id='x',agents={},require_review=True,auto_publish=False,schedule_enabled=False); assert r.voice_constraints is None; assert isinstance(r.user_templates,dict); dataclasses.asdict(r); print('OK', len(USER_TEMPLATE_KEYS), len(SECTION_GUIDANCE_KEYS), len(SINGLETON_ASSET_KEYS))"</automated>
  </verify>
  <acceptance_criteria>
    - The python -c above prints `OK 11 6 2`
    - `grep -c "voice_constraints: Optional\[str\] = None" packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py` returns 1
    - `grep -c "USER_TEMPLATE_KEYS\|SECTION_GUIDANCE_KEYS\|SINGLETON_ASSET_KEYS" config_loader.py` (run from lib dir) returns ≥3
    - existing 11 entries still present: `grep -q '"editor_gate1":     "editor"' config_loader.py`
  </acceptance_criteria>
  <done>RunConfig + registries extended; asdict serializable.</done>
</task>

<task type="auto">
  <name>Task 2: Hydrate new assets in load_run_config with per-key disk fallback</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (the load_run_config + _build_fallback_config functions)
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (two-tier fallback discipline)
  </read_first>
  <action>
    Add a private helper `async def _hydrate_asset(http, agent_key) -> Optional[str]` that mirrors the
    existing per-key prompt fallback: try `promptVersions:getActive` for the key; on exception OR missing
    row, log.warning and return `load_prompt(AGENT_KEY_TO_PROMPT_FILE[agent_key])` if a file mapping
    exists, else None. Use it in BOTH `load_run_config` (Convex-reachable path) and inside the
    `_build_fallback_config` path (disk-only — read straight from `load_prompt`).

    In `load_run_config`, after the existing agents loop, populate the new RunConfig fields:
    - `user_templates = { k: <hydrated> for k in USER_TEMPLATE_KEYS }`
    - `section_guidance = { k: <hydrated> for k in SECTION_GUIDANCE_KEYS }`
    - `rubric = <hydrated 'rubric'>`
    - `voice_constraints = <hydrated 'voice_constraints'>`
    In `_build_fallback_config`, populate the same fields from `load_prompt(...)` directly (no Convex).

    IMPORTANT: until Plans 04/05/06 create the `.md` seed files, `load_prompt` for the new keys will
    raise FileNotFoundError. Guard each `_hydrate_asset` so a missing file logs a warning and yields
    None rather than raising (the migration plans replace None with real content). This keeps the
    pipeline bootable between Wave 2 and Wave 3.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_config_loader_assets.py -x -q 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/test_config_loader_assets.py -x -q` passes
    - `grep -q "_hydrate_asset" config_loader.py` (run from lib dir)
    - `grep -q "user_templates=" config_loader.py` and `grep -q "voice_constraints=" config_loader.py` in BOTH load_run_config and _build_fallback_config (grep count ≥2 each)
    - The full existing suite still passes: `cd packages/pipeline && uv run pytest -x -q` exits 0
  </acceptance_criteria>
  <done>New assets hydrate from DB with disk fallback; missing-file safe; existing suite green.</done>
</task>

<task type="auto">
  <name>Task 3: Author config-loader asset test + API_CONTRACTS §7 note</name>
  <files>packages/pipeline/tests/test_config_loader_assets.py, docs/API_CONTRACTS.md</files>
  <read_first>
    - packages/pipeline/tests/ (existing config-loader test patterns, e.g. any test_config_loader*.py)
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py (final state)
    - docs/API_CONTRACTS.md §7 RunConfig block (lines ~1519-1604)
  </read_first>
  <action>
    Write test_config_loader_assets.py with:
    - `test_runconfig_has_asset_fields`: construct RunConfig with no asset kwargs, assert defaults
      (voice_constraints None, dicts empty, rubric None).
    - `test_fallback_config_missing_files_does_not_raise`: call `_build_fallback_config()` and assert it
      returns without raising even when the new asset .md files are absent.
    - `test_asset_registries_counts`: assert len(USER_TEMPLATE_KEYS)==11, len(SECTION_GUIDANCE_KEYS)==6,
      len(SINGLETON_ASSET_KEYS)==2.

    In docs/API_CONTRACTS.md §7 RunConfig block, add the four new fields under the existing
    `voice_constraints` note from Plan 01 (extend the same region): `user_templates: dict[str,str]`,
    `section_guidance: dict[str,str]`, `rubric: Optional[str]` — each annotated as "hydrated at run start
    from the active prompt_versions row for the matching agentKey; disk/code fallback per CFG-03."
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_config_loader_assets.py -x -q 2>&1 | grep -Eq "passed" && grep -q "user_templates: dict" /Users/user/Desktop/Eisenbalm/docs/API_CONTRACTS.md && echo OK</automated>
  </verify>
  <acceptance_criteria>
    - test_config_loader_assets.py passes all three tests
    - `grep -c "user_templates: dict" docs/API_CONTRACTS.md` returns ≥1
    - `grep -c "def test_" packages/pipeline/tests/test_config_loader_assets.py` returns 3
  </acceptance_criteria>
  <done>Asset infra tested; contract documents the RunConfig asset fields.</done>
</task>

</tasks>

<verification>
- RunConfig + registries + hydration in place; asdict serializable; missing-file safe.
- Existing pipeline suite green; new asset test green.
</verification>

<success_criteria>
Migration plans 04/05/06 can write a .md file + seed + swap a call site to read from RunConfig
without touching config_loader internals again.
</success_criteria>

<output>
After completion, create `.planning/phases/24-prompt-editor-versioning/24-03-SUMMARY.md`
</output>
