---
phase: 46-signal-editor-candidate-verification
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py
  - packages/pipeline/src/eisenbalm_pipeline/prompts/signal_editor.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/signal_editor_user.md
  - packages/pipeline/scripts/seed_phase46_signal_editor.py
autonomous: true
requirements: [SGE-01]

must_haves:
  truths:
    - "acomplete(agent_id='signal_editor', ...) resolves a model (Sonnet tier) instead of raising KeyError"
    - "signal_editor + signal_editor_user prompts are externalized .md files, registered, and idempotently seedable"
    - "config.agents['signal_editor'].system_prompt + config.user_templates['signal_editor_user'] hydrate at run start"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py"
      provides: "signal_editor model/sampling/max_tokens"
      contains: "signal_editor"
    - path: "packages/pipeline/src/eisenbalm_pipeline/prompts/signal_editor.md"
      provides: "Signal Editor system prompt (lead generation + brand-risk rubric + repetition-warning phrasing)"
      min_lines: 20
    - path: "packages/pipeline/scripts/seed_phase46_signal_editor.py"
      provides: "idempotent prompt seed"
      contains: "seed_assets"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py"
      to: "AGENT_KEY_TO_PROMPT_FILE + USER_TEMPLATE_KEYS"
      via: "signal_editor / signal_editor_user keys"
      pattern: "signal_editor"
---

<objective>
Register the Signal Editor's model tier, sampling, token cap, and its two externalized prompts, plus an idempotent seed script — the plumbing the agent body (46-04) needs to run in real mode.

Purpose: RESEARCH Pitfall 4 — `acomplete()` raises `KeyError` for any `agent_id` not in `MODEL_BY_AGENT`; this MUST be the first code change so every real-mode run of the new agent resolves a model. RESEARCH Pitfall 5 corrects CONTEXT's "Advocate/Editor class" framing: Advocate is actually Haiku; the right analog is Researcher at the Sonnet tier.
Output: signal_editor entries in llm_config + config_loader, two prompt .md files, a seed script.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/46-signal-editor-candidate-verification/46-CONTEXT.md
@.planning/phases/46-signal-editor-candidate-verification/46-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py
@packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py
@packages/pipeline/scripts/seed_phase24_assets.py
@packages/pipeline/src/eisenbalm_pipeline/prompts/scout.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Register signal_editor in llm_config + config_loader</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py, packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py — MODEL_BY_AGENT / SAMPLING_BY_AGENT / MAX_TOKENS_BY_AGENT (researcher's Sonnet entry is the tier analog)
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py — AGENT_KEY_TO_PROMPT_FILE (~L88), SYSTEM_PROMPT_KEYS (~L134, FROZEN 11 — do NOT append), USER_TEMPLATE_KEYS (~L145), ALL_AGENT_KEYS (~L162)
    - RESEARCH Pitfall 4, 5, 7 (USER_PROMPT_KEYS is a CONTEXT slip; the real constant is USER_TEMPLATE_KEYS)
  </read_first>
  <action>
    1. `lib/llm_config.py`: add three entries keyed `"signal_editor"`:
       - `MODEL_BY_AGENT["signal_editor"] = "anthropic/claude-sonnet-4-6"` (Researcher tier — proposals for human review, not a final/irreversible voice-critical call; NOT Haiku, NOT Opus). Add a one-line comment noting this is a discretion call (RESEARCH Pitfall 5) and the plumbing is identical if Andrew later bumps it to the Opus pin.
       - `SAMPLING_BY_AGENT["signal_editor"] = {"temperature": 0.4, "top_p": 1.0}` (between Researcher 0.3 and section writers 0.7; matches chronicler/design).
       - `MAX_TOKENS_BY_AGENT["signal_editor"] = 16_000` (between Scout 12_000 and Researcher 20_000).
       Adding to MODEL_BY_AGENT automatically extends `config_loader.ALL_AGENT_KEYS` (= tuple(MODEL_BY_AGENT) + bonus variants), so load_run_config auto-hydrates it with disk fallback.
    2. `lib/config_loader.py`: extend `AGENT_KEY_TO_PROMPT_FILE` with `"signal_editor": "signal_editor"` and `"signal_editor_user": "signal_editor_user"`. Add `"signal_editor_user"` to the `USER_TEMPLATE_KEYS` tuple so `config.user_templates["signal_editor_user"]` hydrates at run start. Do NOT append `"signal_editor"` to `SYSTEM_PROMPT_KEYS` — that tuple is the FROZEN Phase-22 "exactly 11" subset (RESEARCH Pitfall 7); the superset map + ALL_AGENT_KEYS are what load_run_config + the seed iterate.
  </action>
  <acceptance_criteria>
    - `python -c "from eisenbalm_pipeline.lib.llm_config import MODEL_BY_AGENT; assert MODEL_BY_AGENT['signal_editor'] == 'anthropic/claude-sonnet-4-6'"` exits 0 (run under `uv run` in packages/pipeline)
    - `python -c "from eisenbalm_pipeline.lib.config_loader import AGENT_KEY_TO_PROMPT_FILE, USER_TEMPLATE_KEYS, ALL_AGENT_KEYS; assert AGENT_KEY_TO_PROMPT_FILE['signal_editor']=='signal_editor'; assert 'signal_editor_user' in USER_TEMPLATE_KEYS; assert 'signal_editor' in ALL_AGENT_KEYS"` exits 0
    - `grep -c "signal_editor" packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py` >= 3
    - SYSTEM_PROMPT_KEYS still has exactly 11 entries (signal_editor NOT added)
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.llm_config import MODEL_BY_AGENT,SAMPLING_BY_AGENT,MAX_TOKENS_BY_AGENT; from eisenbalm_pipeline.lib.config_loader import AGENT_KEY_TO_PROMPT_FILE,USER_TEMPLATE_KEYS,ALL_AGENT_KEYS,SYSTEM_PROMPT_KEYS; assert MODEL_BY_AGENT['signal_editor']=='anthropic/claude-sonnet-4-6'; assert MAX_TOKENS_BY_AGENT['signal_editor']==16000; assert AGENT_KEY_TO_PROMPT_FILE['signal_editor']=='signal_editor' and AGENT_KEY_TO_PROMPT_FILE['signal_editor_user']=='signal_editor_user'; assert 'signal_editor_user' in USER_TEMPLATE_KEYS; assert 'signal_editor' in ALL_AGENT_KEYS; assert len(SYSTEM_PROMPT_KEYS)==11; print('REG_OK')"</automated>
  </verify>
  <done>signal_editor resolves model/sampling/max_tokens + prompt file mappings; SYSTEM_PROMPT_KEYS stays frozen at 11.</done>
</task>

<task type="auto">
  <name>Task 2: Author signal_editor.md + signal_editor_user.md prompts</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/prompts/signal_editor.md, packages/pipeline/src/eisenbalm_pipeline/prompts/signal_editor_user.md</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/prompts/scout.md — the PROMPT START/END marker convention + `{featured_keys}` token pattern
    - packages/pipeline/src/eisenbalm_pipeline/prompts/scout_user.md — user-template `{results_block}` token pattern
    - packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py — `_START`/`_END`/`load_prompt`/`_extract` marker contract
    - docs/CLAUDE_CODE_BRIEF.md — Jesse voice/gravity constraints (leads are surfaced verbatim to Andrew in Phase 47)
  </read_first>
  <action>
    Write two marker-wrapped prompt files (each with the `<!-- PROMPT START -->` / `<!-- PROMPT END -->` sentinels + a header comment listing any tokens, matching scout.md byte convention so `load_prompt`/`_extract` round-trips):

    1. `prompts/signal_editor.md` (SYSTEM): Instruct the Signal Editor to emit 3-5 dated story leads from the supplied current-news search results. Each lead MUST carry: `premise` (a sharp, on-voice one-line story angle — Jesse's dry, precise, non-ironic register), `datedPeg` (a specific recent event with a date), `pegSourceUrl` (the real source URL the peg came from — NEVER invented), `readerEnergy`, `charitableAngle`, `category`, `confidence` (exactly one of low/medium/high). Include the brand-risk rubric (SGE-02): set `brandRiskFlag=true` + a concrete `brandRiskReason` for any lead touching politically/reputationally hazardous ground; and the hard rule that a brand-risk-flagged lead is NEVER `recommended`. At most ONE non-risky lead may be `recommended=true`. Include the repetition-warning guidance (SGE-05): given an avoid-note, attach an advisory `repetitionWarning` (e.g. "avoid US-SE · avoid weather") to any lead whose category/premise overlaps an avoided cause/geo — surface it, never drop the lead. Include an `{avoid_note}` token where the deterministic avoid string is interpolated.
    2. `prompts/signal_editor_user.md` (USER): carry a `{results_block}` token (the dated-news search results, same shape Scout interpolates) and re-state "return 3-5 leads, real sourced pegs only." Keep a header comment warning not to delete `{results_block}` / `{avoid_note}`.

    Every `{token}` used MUST round-trip through `load_prompt` (extend tests/test_package_data_prompts.py coverage is handled by the existing token round-trip test; do not weaken markers).
  </action>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.prompts import load_prompt; s=load_prompt('signal_editor'); u=load_prompt('signal_editor_user'); assert s and u; assert '{results_block}' in u"` exits 0
    - `grep -q "PROMPT START" packages/pipeline/src/eisenbalm_pipeline/prompts/signal_editor.md` and same for signal_editor_user.md
    - signal_editor.md prose mentions brand-risk (recommended false gate) and repetition warning
    - existing prompt token round-trip test still passes: `uv run pytest tests/test_package_data_prompts.py -q`
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.prompts import load_prompt; s=load_prompt('signal_editor'); u=load_prompt('signal_editor_user'); assert s and u and '{results_block}' in u; print('PROMPTS_OK')" && uv run pytest tests/test_package_data_prompts.py -q</automated>
  </verify>
  <done>Both prompts load via load_prompt, carry their tokens, and encode SGE-02 + SGE-05 rules; the package-data prompt test stays green.</done>
</task>

<task type="auto">
  <name>Task 3: Add the idempotent Phase-46 prompt seed script</name>
  <files>packages/pipeline/scripts/seed_phase46_signal_editor.py</files>
  <read_first>
    - packages/pipeline/scripts/seed_phase24_assets.py — `seed_assets(http, agent_keys, *, note=...)` is generic, idempotent, byte-verified (RESEARCH "Don't Hand-Roll": reuse, don't rebuild)
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py — WORKSPACE_ID, AGENT_KEY_TO_PROMPT_FILE
  </read_first>
  <action>
    Create `scripts/seed_phase46_signal_editor.py` as a thin wrapper: build the standalone Convex AsyncClient (mirror seed_phase24_assets.py `_build_client()`), then `await seed_assets(http, ("signal_editor", "signal_editor_user"), note="Phase 46 v1 seed — Signal Editor")`, print the count, close the client. Do NOT reimplement byte-verification or upsert — import and call `seed_assets` from `scripts.seed_phase24_assets`. Requires NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOY_KEY (same as the Phase 24 seed). Runnable via `uv run python scripts/seed_phase46_signal_editor.py`.
  </action>
  <acceptance_criteria>
    - `grep -q "seed_assets" packages/pipeline/scripts/seed_phase46_signal_editor.py` matches and imports it from the Phase-24 module (no re-implemented upsert)
    - `grep -q "signal_editor" packages/pipeline/scripts/seed_phase46_signal_editor.py` and `grep -q "signal_editor_user" ...` both match
    - `cd packages/pipeline && uv run python -c "import ast,sys; ast.parse(open('scripts/seed_phase46_signal_editor.py').read()); print('SEED_PARSES')"` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && grep -q "seed_assets" scripts/seed_phase46_signal_editor.py && grep -q "signal_editor_user" scripts/seed_phase46_signal_editor.py && uv run python -c "import ast; ast.parse(open('scripts/seed_phase46_signal_editor.py').read()); print('SEED_OK')"</automated>
  </verify>
  <done>A re-runnable, byte-verified seed for the two new prompt keys reusing seed_assets.</done>
</task>

</tasks>

<verification>
- signal_editor resolves in llm_config + config_loader (KeyError-safe for acomplete)
- Both prompts load via load_prompt and round-trip their tokens
- Seed script parses and reuses seed_assets
</verification>

<success_criteria>
- `acomplete(agent_id="signal_editor")` will resolve the Sonnet model (Pitfall 4 avoided)
- config.agents['signal_editor'].system_prompt + config.user_templates['signal_editor_user'] hydrate at run start
- Prompts encode SGE-01 lead fields, the SGE-02 brand-risk/recommended gate, and SGE-05 repetition-warning phrasing
- SYSTEM_PROMPT_KEYS remains exactly 11
</success_criteria>

<output>
After completion, create `.planning/phases/46-signal-editor-candidate-verification/46-03-SUMMARY.md`
</output>
