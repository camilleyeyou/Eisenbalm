---
phase: 05-agent-quality
plan: 03
type: execute
wave: 2
depends_on:
  - "05-01"
  - "05-02"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/wcag.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/cost.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/errors.py
autonomous: true
requirements_addressed:
  - AGT-02
  - AGT-03
  - AGT-05
  - AGT-09
  - AGT-13
  - AGT-17
  - AGT-18

must_haves:
  truths:
    - "lib.openrouter_client.acomplete(agent_id, messages, response_format=...) routes through ChatOpenAI with openai_api_base='https://openrouter.ai/api/v1'"
    - "lib.openrouter_client records token usage + resolved model into state['model_versions'] via CostRecorder + return value"
    - "lib.llm_config.MODEL_BY_AGENT maps 14 agent_ids to one of 3 model tiers (Opus pinned, Sonnet alias, Haiku alias)"
    - "lib.voice.VOICE_CONSTRAINTS is a string literal derived from CLAUDE_CODE_BRIEF.md lines 359-367"
    - "lib.voice.build_section_writer_prompt() returns a 2-message list whose system prompt contains voice_constraints AND whose user prompt contains charity + research + style_brief but NOT any other section's output"
    - "lib.search_client.web_search(query, max_results=5) returns list[SearchResult] from Tavily, stub-mode-aware"
    - "lib.wcag.validate_theme(theme) returns [] on a valid theme and a list of error strings on invalid theme; uses the 0.03928 threshold (matches apps/web/lib/theme.ts)"
    - "lib.cost.CostRecorder gains check_cap() async method that raises CostCapExceeded at >= PIPELINE_COST_CAP_USD"
    - "lib.errors exports CostCapExceeded AND AgentToolCallLimitExceeded (shared exception classes for cost cap + agent tool-call limit)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py"
      provides: "Single async OpenRouter client; routes every agent's LLM call; honors EISENBALM_STUB_MODE"
      min_lines: 80
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py"
      provides: "MODEL_BY_AGENT, SAMPLING_BY_AGENT, MAX_TOKENS_BY_AGENT, MODEL_PIN_VOICE_CRITICAL"
      min_lines: 40
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/voice.py"
      provides: "VOICE_CONSTRAINTS string + build_section_writer_prompt()"
      min_lines: 50
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py"
      provides: "Tavily web_search wrapper used by Scout + Researcher only"
      min_lines: 40
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/wcag.py"
      provides: "WCAG-AA contrast + hex validation; Python port of apps/web/lib/theme.ts"
      min_lines: 50
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/cost.py"
      provides: "Extended CostRecorder.check_cap() + CostCapExceeded exception (additive — preserves Phase 4 surface)"
      contains: "CostCapExceeded"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/errors.py"
      provides: "Shared Phase 5 exception classes — CostCapExceeded + AgentToolCallLimitExceeded"
      contains: "AgentToolCallLimitExceeded"
  key_links:
    - from: "lib.errors.CostCapExceeded + lib.errors.AgentToolCallLimitExceeded"
      to: "lib.cost.check_cap (imports CostCapExceeded) + agents/scout.py + agents/researcher.py + agents/_wrapper.py (import AgentToolCallLimitExceeded)"
      via: "single import site for both Phase 5 exception classes"
      pattern: "from eisenbalm_pipeline.lib.errors import"
    - from: "lib.openrouter_client.acomplete"
      to: "lib.cost.record_cost + CostRecorder.check_cap"
      via: "every LLM call records token usage AND awaits check_cap"
      pattern: "record_cost"
    - from: "lib.voice.build_section_writer_prompt"
      to: "Section writer agents (origin_story, problem, founder_bio, case_study, bonus, game) in Plans 05-11..05-13"
      via: "ONLY path to assemble a section writer's prompt"
      pattern: "build_section_writer_prompt"
    - from: "lib.wcag.validate_theme"
      to: "agents/design.py (Plan 05-14)"
      via: "called before Sanity write; failure triggers regenerate-once"
      pattern: "validate_theme"
    - from: "lib.search_client.web_search"
      to: "agents/scout.py (Plan 05-07) + agents/researcher.py (Plan 05-10)"
      via: "only call sites in the codebase"
      pattern: "web_search"
---

<objective>
Land the 7 library modules every Phase 5 agent depends on. After this plan, agent bodies (Plans 05-06 through 05-16) can be written without any infrastructure churn: each one just imports from `lib/openrouter_client`, `lib/voice`, `lib/llm_config`, `lib/search_client`, `lib/wcag`, `lib/errors`, or the extended `lib/cost`.

Seven modules:

1. **`lib/errors.py`** — shared exception classes for Phase 5: `CostCapExceeded` (raised by `lib/cost.CostRecorder.check_cap()` when per-run cost hits `PIPELINE_COST_CAP_USD`; D-08, AGT-18) and `AgentToolCallLimitExceeded` (raised by `@agent_node` wrapper / agent bodies when the per-agent `max_tool_calls` budget overruns; D-21, AGT-18). Owning these in a dedicated module avoids split definitions across `lib/cost.py` + `agents/scout.py` + `agents/researcher.py` + `agents/_wrapper.py` and lets every consumer import from `eisenbalm_pipeline.lib.errors`.

2. **`lib/llm_config.py`** — `MODEL_BY_AGENT` (14 agent_ids → 3 model tiers per D-05), `SAMPLING_BY_AGENT` (per D-07), `MAX_TOKENS_BY_AGENT` (Scout=12k, Researcher=20k per RESEARCH §"OpenRouter Client Architecture"), `MODEL_PIN_VOICE_CRITICAL = "anthropic/claude-opus-4-7"`. Single source of truth for model identity.

3. **`lib/openrouter_client.py`** — `get_chat_model(agent_id)` returns a configured `ChatOpenAI(model=..., openai_api_base="https://openrouter.ai/api/v1", openai_api_key=os.environ["OPENROUTER_API_KEY"])`. `acomplete(agent_id, messages, response_format=None)` is the single async call site for every agent; records token usage into `CostRecorder`, awaits `check_cap()`, captures resolved model from `response_metadata.model` (falls back to `MODEL_BY_AGENT[agent_id]` if absent — RESEARCH Open Question 4). Honors `EISENBALM_STUB_MODE=true` by delegating to `stubs/fake_openrouter.FakeOpenRouterClient`.

4. **`lib/voice.py`** — `VOICE_CONSTRAINTS` string literal (sourced verbatim from `docs/CLAUDE_CODE_BRIEF.md` lines 359-367) and `build_section_writer_prompt(*, voice_constraints, section_id, section_title, section_guidance, charity, research, style_brief)` helper. **Critical:** this function is the ONLY path to build a section writer's prompt — it structurally isolates voice + research + charity + styleBrief and does NOT accept any other section's state (AGT-09 enforcement at code level).

5. **`lib/search_client.py`** — `async def web_search(query, *, max_results=5) -> list[SearchResult]` wrapping `langchain_tavily.TavilySearch` (or `langchain_community.utilities.tavily_search.TavilySearchAPIWrapper` — whichever resolved per Plan 05-02 Task 1 SUMMARY). `SearchResult` dataclass with `url, title, content, score`. Used only by Scout and Researcher. Honors `EISENBALM_STUB_MODE=true` by returning a deterministic fixture list.

6. **`lib/wcag.py`** — Python port of `apps/web/lib/theme.ts`. Exports `HEX_REGEX`, `WCAG_AA_THRESHOLD`, `SAFE_THEME`, `relative_luminance`, `contrast_ratio`, `passes_wcag_aa`, `validate_hex`, `validate_theme`. Uses threshold `0.03928` (NOT `0.04045` — RESEARCH Pitfall 3; matches Phase 2 exactly).

7. **`lib/cost.py` extension** — additive: keep all Phase 4 module-level functions (`begin_run`, `record_cost`, `get_cost_payload`, `get_duration_ms`, `end_run`, `cost_payload_to_json`) and the Phase 4 `CostRecorder` class. Import `CostCapExceeded` from `lib/errors.py` (Task 1 — single source) and add an `async def check_cap(self)` method on `CostRecorder` that reads `PIPELINE_COST_CAP_USD` and `PIPELINE_COST_WARN_PCT` from env, raises on cap, emits a fire-and-forget `deliberationEvents:insert` with `eventType='cost-warning'` at warn pct (deduplicated via `self._warned` flag). Also add a module-level helper `get_recorder(run_id)` so `lib.openrouter_client.acomplete` can fetch the right recorder by run_id (single-process pattern; FastAPI runs one event loop). Since the Phase 4 `record_cost()` is module-level keyed by `run_id`, `check_cap()` reads from the same `_store`.

Purpose: Wave 1 of library plumbing. These 7 modules unlock parallel implementation of all 14 agent bodies in Waves 2-5. Plans 05-04 (font whitelist), 05-05 (test infrastructure) can run in parallel with this plan since they have no overlapping `files_modified`.

Output: 7 lib files (6 new + 1 extended) committed; module imports verified via pytest collection.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@docs/CLAUDE_CODE_BRIEF.md
@apps/web/lib/theme.ts
@packages/pipeline/src/eisenbalm_pipeline/lib/cost.py
@packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
@packages/pipeline/src/eisenbalm_pipeline/stubs/fake_openrouter.py
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py

<interfaces>
<!-- Phase 4 CostRecorder (lib/cost.py — current) exposes module-level fns AND a class. We extend BOTH. -->

```python
# Existing lib/cost.py exports (DO NOT BREAK):
#   begin_run(run_id), record_cost(run_id, agent_name, *, tokens_in, tokens_out, usd, duration_ms)
#   get_cost_payload(run_id), get_duration_ms(run_id), end_run(run_id), cost_payload_to_json(payload)
#   class CostRecorder(run_id): context-manager wrapper; .record(...) delegates to record_cost
```

<!-- Phase 4 FakeOpenRouterClient (stubs/fake_openrouter.py) — interface to preserve for stub-mode: -->
```python
class FakeOpenRouterClient:
    def __init__(self) -> None: self.model = "fake-openrouter-stub"
    async def acomplete(self, prompt: str, **kwargs) -> dict:
        return {"content": "stub-response", "tokens_in": 0, "tokens_out": 0, "usd": 0.0}

def is_stub_mode() -> bool: ...  # returns os.environ.get("EISENBALM_STUB_MODE", "true").lower() == "true"
```

<!-- Phase 4 apps/web/lib/theme.ts WCAG math (port verbatim — RESEARCH Pitfall 3 demands 0.03928 not 0.04045): -->
```javascript
// srgbToLinear: c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
// relativeLuminance: 0.2126 * R_linear + 0.7152 * G_linear + 0.0722 * B_linear
// contrastRatio: (lighter + 0.05) / (darker + 0.05)
// WCAG_AA_THRESHOLD = 4.5
// HEX_REGEX = /^#[0-9a-fA-F]{6}$/
// BRAND_DEFAULTS bg/text/primary/accent: '#FAFAF8', '#1A1A18', '#2D5016', '#8B1A1A'
// FONT_WHITELIST (Phase 2): Playfair Display, Lora, Inter, Cormorant Garamond, Merriweather, DM Serif Display
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create lib/errors.py — shared Phase 5 exception classes</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/errors.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/__init__.py (verify module discoverable)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-08 (cost cap), D-21 (max_tool_calls)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Cost Cap Enforcement" lines 1318-1382 (CostCapExceeded contract)
  </read_first>

  <action>
  Create `packages/pipeline/src/eisenbalm_pipeline/lib/errors.py` with both Phase 5 custom exception classes. This is the ONLY place either exception is defined; every other module (lib/cost.py, agents/scout.py, agents/researcher.py, agents/_wrapper.py, tests/agents/test_tool_limits.py, tests/test_pipeline_real_mode.py) imports from here.

  ```python
  """Shared Phase 5 exception classes.

  Defining both exceptions in one module avoids split definitions across
  lib/cost.py + agents/scout.py + agents/researcher.py + agents/_wrapper.py.
  Every consumer imports from ``eisenbalm_pipeline.lib.errors``.
  """
  from __future__ import annotations


  class CostCapExceeded(Exception):
      """Raised by ``CostRecorder.check_cap()`` when per-run cost exceeds
      ``PIPELINE_COST_CAP_USD`` (D-08, AGT-18).

      The ``@agent_node`` wrapper's generic exception handler catches this and
      writes ``pipelineRuns.status='failed'`` with errorMessage per CONTEXT D-27.
      """

      def __init__(self, total_usd: float, cap_usd: float, agent_id: str) -> None:
          self.total_usd = total_usd
          self.cap_usd = cap_usd
          self.agent_id = agent_id
          super().__init__(
              f"cost-cap-exceeded: ${total_usd:.2f} of ${cap_usd:.2f} "
              f"(agent: {agent_id})"
          )


  class AgentToolCallLimitExceeded(Exception):
      """Raised when an ``@agent_node`` body exceeds its ``max_tool_calls`` budget (D-21, AGT-18).

      Plan 05-14 wires ``agents/_wrapper.py`` so this exception class also
      emits a ``deliberationEvents:insert`` row with
      ``eventType='agent-tool-limit-exceeded'`` (Plan 05-01 schema patch)
      before the wrapper writes ``pipelineRuns.status='failed'``.
      """

      def __init__(self, agent_id: str, attempts: int, limit: int) -> None:
          self.agent_id = agent_id
          self.attempts = attempts
          self.limit = limit
          super().__init__(
              f"{agent_id}: tool-call-limit-exceeded: {attempts} of {limit}"
          )
  ```

  Sanity check: zero imports beyond `__future__`. Pure exception module — no Convex, no Pydantic, no asyncio.

  **Note on `CostCapExceeded` signature change vs. RESEARCH §"Cost Cap Enforcement":** RESEARCH originally showed `CostCapExceeded` as a bare `Exception` subclass raised with a single f-string message. Phase 5 standardizes the constructor to take `(total_usd, cap_usd, agent_id)` so call sites (lib/cost.py, tests) can introspect the attributes without parsing the message. Task 4 (lib/cost.py) MUST import and raise with this 3-arg constructor — the existing RESEARCH snippet in Task 4 below should be adapted accordingly (see Task 4's updated action).
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.errors import CostCapExceeded, AgentToolCallLimitExceeded; e1 = CostCapExceeded(15.0, 10.0, 'calibrator'); assert e1.total_usd == 15.0 and e1.cap_usd == 10.0 and e1.agent_id == 'calibrator'; assert 'cost-cap-exceeded' in str(e1); e2 = AgentToolCallLimitExceeded('scout', 9, 8); assert e2.agent_id == 'scout' and e2.attempts == 9 and e2.limit == 8; assert 'tool-call-limit-exceeded' in str(e2); print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `lib/errors.py` exists
    - Exports `CostCapExceeded` and `AgentToolCallLimitExceeded` (both Exception subclasses)
    - `CostCapExceeded(total_usd, cap_usd, agent_id)` stores `.total_usd`, `.cap_usd`, `.agent_id` attributes
    - `AgentToolCallLimitExceeded(agent_id, attempts, limit)` stores `.agent_id`, `.attempts`, `.limit` attributes
    - Module has zero imports beyond `__future__`
    - `from eisenbalm_pipeline.lib.errors import CostCapExceeded, AgentToolCallLimitExceeded` succeeds
  </acceptance_criteria>

  <done>
  Both Phase 5 custom exception classes ship from a single module. Downstream lib/cost.py imports `CostCapExceeded` from here (not declared locally). Downstream agents/scout.py + agents/researcher.py + agents/_wrapper.py + test files import `AgentToolCallLimitExceeded` from here. No fallback inline definitions allowed in any other module.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create lib/llm_config.py — single source of model identity</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/__init__.py (verify module discoverable)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"OpenRouter Client Architecture" lines 1199-1250 (exact MODEL_BY_AGENT + SAMPLING_BY_AGENT + MAX_TOKENS_BY_AGENT tables)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-05, D-06, D-07 (model tiering + pin policy + sampling)
  </read_first>

  <action>
  Create `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` with EXACTLY this content (copy verbatim from RESEARCH §"OpenRouter Client Architecture"; do NOT paraphrase model IDs):

  ```python
  """Single source of truth for Phase 5 model identity, sampling, token caps.

  D-05: tiered model selection (Opus voice-critical, Sonnet writers, Haiku mechanical).
  D-06: pin voice-critical IDs verbatim; section writers + mechanical use aliases.
  D-07: per-agent sampling defaults.
  RESEARCH §"OpenRouter Client Architecture": MAX_TOKENS_BY_AGENT.

  Phase 5 agents never hardcode their own model ID or temperature — every value
  in this module is the only place to edit when (e.g.) OpenRouter retires
  ``anthropic/claude-opus-4-7`` or Andrew wants to tune temperature.
  """
  from __future__ import annotations

  # D-06: voice-critical pin. Replace with whichever Opus snapshot OpenRouter
  # actually resolves; the resolved model is captured into modelVersions at
  # call time (AGT-17) so observability survives pin retirement.
  MODEL_PIN_VOICE_CRITICAL = "anthropic/claude-opus-4-7"

  # D-05: 14 agent_ids → 3 tiers (Opus / Sonnet / Haiku).
  # Keys MUST match the agent_id used in @agent_node(name=...) and the Sanity
  # agentProfile.agentId seeds (Phase 1 D-17).
  MODEL_BY_AGENT: dict[str, str] = {
      # Voice-critical (Opus, pinned).
      "calibrator":   MODEL_PIN_VOICE_CRITICAL,
      "editor_gate1": MODEL_PIN_VOICE_CRITICAL,
      "editor_final": MODEL_PIN_VOICE_CRITICAL,
      "qa":           MODEL_PIN_VOICE_CRITICAL,
      # Section writers (Sonnet, latest-stable alias).
      "researcher":   "anthropic/claude-sonnet-4-6",
      "origin_story": "anthropic/claude-sonnet-4-6",
      "problem":      "anthropic/claude-sonnet-4-6",
      "founder_bio":  "anthropic/claude-sonnet-4-6",
      "case_study":   "anthropic/claude-sonnet-4-6",
      "bonus":        "anthropic/claude-sonnet-4-6",
      "game":         "anthropic/claude-sonnet-4-6",
      # Mechanical (Haiku, latest-stable alias).
      "scout":    "anthropic/claude-haiku-4-5",
      "advocate": "anthropic/claude-haiku-4-5",
      "design":   "anthropic/claude-haiku-4-5",
  }

  # D-07: temperature + top_p per agent. Voice-critical low; writers higher.
  SAMPLING_BY_AGENT: dict[str, dict] = {
      "calibrator":   {"temperature": 0.2, "top_p": 1.0},
      "editor_gate1": {"temperature": 0.2, "top_p": 1.0},
      "editor_final": {"temperature": 0.2, "top_p": 1.0},
      "qa":           {"temperature": 0.2, "top_p": 1.0},
      "researcher":   {"temperature": 0.3, "top_p": 1.0},
      "scout":        {"temperature": 0.3},
      "advocate":     {"temperature": 0.3},
      "design":       {"temperature": 0.4},
      "origin_story": {"temperature": 0.7, "top_p": 1.0},
      "problem":      {"temperature": 0.7, "top_p": 1.0},
      "founder_bio":  {"temperature": 0.7, "top_p": 1.0},
      "case_study":   {"temperature": 0.7, "top_p": 1.0},
      "bonus":        {"temperature": 0.7, "top_p": 1.0},
      "game":         {"temperature": 0.7, "top_p": 1.0},
  }

  # RESEARCH §"OpenRouter Client Architecture": per-agent max_tokens for the
  # tool-using factual agents. Other agents accept OpenRouter's default cap.
  MAX_TOKENS_BY_AGENT: dict[str, int] = {
      "scout":      12_000,
      "researcher": 20_000,
  }
  ```

  Sanity check: this file has zero imports beyond `from __future__ import annotations`. It is a pure constants module.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib.llm_config import MODEL_BY_AGENT, SAMPLING_BY_AGENT, MAX_TOKENS_BY_AGENT, MODEL_PIN_VOICE_CRITICAL; assert len(MODEL_BY_AGENT) == 14, f'expected 14 agents, got {len(MODEL_BY_AGENT)}'; assert MODEL_PIN_VOICE_CRITICAL == 'anthropic/claude-opus-4-7'; assert MODEL_BY_AGENT['scout'] == 'anthropic/claude-haiku-4-5'; assert SAMPLING_BY_AGENT['qa']['temperature'] == 0.2; assert MAX_TOKENS_BY_AGENT['researcher'] == 20000; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `lib/llm_config.py` exists and exports `MODEL_PIN_VOICE_CRITICAL`, `MODEL_BY_AGENT`, `SAMPLING_BY_AGENT`, `MAX_TOKENS_BY_AGENT`
    - `len(MODEL_BY_AGENT) == 14`
    - `MODEL_PIN_VOICE_CRITICAL == "anthropic/claude-opus-4-7"`
    - All 4 voice-critical agents (`calibrator`, `editor_gate1`, `editor_final`, `qa`) map to `MODEL_PIN_VOICE_CRITICAL`
    - 7 section writers + researcher map to `"anthropic/claude-sonnet-4-6"`
    - 3 mechanical agents (`scout`, `advocate`, `design`) map to `"anthropic/claude-haiku-4-5"`
    - `MAX_TOKENS_BY_AGENT == {"scout": 12000, "researcher": 20000}`
    - Module has zero runtime imports beyond `__future__`
  </acceptance_criteria>

  <done>
  Constants module ships; downstream lib/openrouter_client + every agent can import without circular dep risk.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create lib/voice.py — VOICE_CONSTRAINTS + build_section_writer_prompt</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/voice.py</files>

  <read_first>
    - docs/CLAUDE_CODE_BRIEF.md lines 359-367 (the canonical Jesse voice notes — source text for VOICE_CONSTRAINTS)
    - apps/studio/seeds/agents.json (per-agent personality copy — supplemental)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Pattern 2: Voice-Isolated Section Writer (lib/voice.py)" lines 254-297 (exact build_section_writer_prompt template)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-13 (voice.py as single source of truth for voice + structural isolation)
    - .planning/phases/05-agent-quality/05-CONTEXT.md specifics (AGT-09 "structurally isolated voiceConstraints block")
  </read_first>

  <action>
  Create `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` with the following structure. Copy `VOICE_CONSTRAINTS` content from RESEARCH §"Pattern 2" — this string is the canonical Jesse voice, derived verbatim from CLAUDE_CODE_BRIEF.md voice notes:

  ```python
  """Phase 5 D-13 — single source of truth for Jesse voice + prompt assembly.

  Every section writer agent (origin_story, problem, founder_bio, case_study,
  bonus, game) MUST call ``build_section_writer_prompt(...)`` to assemble its
  message list. No writer reads any other section's output. This enforces
  AGT-09 ("structurally isolated voiceConstraints block, not concatenated
  with prior agent state") in code, not by convention.

  The VOICE_CONSTRAINTS string is derived verbatim from
  ``docs/CLAUDE_CODE_BRIEF.md`` lines 359-367 ("Voice and tone notes for
  agent prompts"). Treat it as a configuration artifact: if Andrew refines
  the voice, edit this string + the rubric.md (Plan 05-15), then commit.
  """
  from __future__ import annotations

  from typing import Any

  VOICE_CONSTRAINTS = (
      "Jesse Eisenbalm voice. Dry, precise, absurdly serious. No winking. "
      "No irony signaling. The brand does not pivot to AI.\n"
      "Treat every charity with the gravity of a Fortune 500 company.\n"
      "Treat every founder as a visionary regardless of obscurity.\n"
      "Never use exclamation marks. Never use: heartwarming, inspiring, "
      "incredible, amazing, truly, simply, journey of, passion, transformative, "
      "empowering, life-changing, remarkable, humbling, beautiful work.\n"
      "Never use winking constructions: \"if you can call it that\", "
      "\"believe it or not\", \"of sorts\", \"for lack of a better word\", "
      "\"so to speak\", \"as they say\".\n"
      "Never reference AI, language models, or Jesse's AI nature. "
      "Jesse was born AI. This is not a gimmick.\n"
      "Answer the implied question \"Why do you deserve to exist?\" without sentiment.\n"
      "Adjectives that are also compliments (impressive, wonderful, great) are forbidden.\n"
      "Passive hedging (might be, could perhaps, seems to) is forbidden."
  )


  def build_section_writer_prompt(
      *,
      section_id: str,
      section_title: str,
      section_guidance: str,
      charity: dict[str, Any],
      research: dict[str, Any],
      style_brief: dict[str, Any],
      voice_constraints: str = VOICE_CONSTRAINTS,
  ) -> list[dict[str, str]]:
      """Assemble a section-writer message list with structural voice isolation.

      Critical invariant (AGT-09): this function accepts ONLY the four content
      blocks below. It does NOT accept ``state`` or any other section's
      output. Section writers that try to inject other section content into
      the prompt must do so OUTSIDE this helper — which would be flagged in
      code review.

      Args:
          section_id: agent_id (e.g. "origin_story", "founder_bio"). Used in
              the system prompt header.
          section_title: human-readable section name shown in the user prompt.
          section_guidance: section-specific instructions (word count, focus,
              conditional framing for unverified names). Pre-rendered string —
              writer-specific Jinja-style branching happens upstream.
          charity: dict-shaped from CharityCandidate TypedDict (winning_charity).
              Used fields: name, location, missionStatement, focusArea.
          research: dict-shaped from ResearchOutput TypedDict. Used fields:
              foundingMoment, founderBackground, caseStudySubject,
              caseStudyOutcome, verifiedFacts. NEVER pass founderName when
              founderNameVerified is False (RESEARCH Pitfall 5).
          style_brief: dict-shaped from StyleBrief TypedDict. Used fields:
              bonusType, visualDirection.
          voice_constraints: defaults to VOICE_CONSTRAINTS.

      Returns:
          A 2-element list of {"role": "system" | "user", "content": str}.
      """
      system = (
          f"You are the {section_id} writer for The Eisenbalm Dispatch.\n\n"
          f"VOICE CONSTRAINTS (non-negotiable):\n{voice_constraints}\n\n"
          f"STYLE BRIEF:\n"
          f"Bonus type for this issue: {style_brief.get('bonusType', '')}\n"
          f"Visual direction: {style_brief.get('visualDirection', '')}\n"
      )

      # Compose research block defensively — omit fields absent from research.
      research_lines = []
      if research.get("foundingMoment"):
          research_lines.append(f"Founding moment: {research['foundingMoment']}")
      if research.get("founderBackground"):
          research_lines.append(f"Founder background: {research['founderBackground']}")
      if research.get("caseStudySubject"):
          research_lines.append(f"Case study subject: {research['caseStudySubject']}")
      if research.get("caseStudyOutcome"):
          research_lines.append(f"Case study outcome: {research['caseStudyOutcome']}")
      if research.get("verifiedFacts"):
          research_lines.append("Verified facts:\n  - " + "\n  - ".join(research["verifiedFacts"]))

      user = (
          f"Write the {section_title} section.\n\n"
          f"CHARITY: {charity.get('name', '')} ({charity.get('location', '')})\n"
          f"FOCUS AREA: {charity.get('focusArea', '')}\n"
          f"MISSION: {charity.get('missionStatement', '')}\n\n"
          f"RESEARCH:\n" + "\n".join(research_lines) + "\n\n"
          f"GUIDANCE:\n{section_guidance}\n\n"
          f"Return valid JSON matching the schema for the {section_id} section."
      )

      return [
          {"role": "system", "content": system},
          {"role": "user", "content": user},
      ]
  ```

  Sanity check the isolation invariant at the function signature level: only `section_id, section_title, section_guidance, charity, research, style_brief, voice_constraints` are accepted. There is no `state: DispatchState` parameter, no `other_sections: dict` parameter — those are the things AGT-09 forbids.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run python -c "
  from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, build_section_writer_prompt
  assert 'exclamation marks' in VOICE_CONSTRAINTS
  assert 'heartwarming' in VOICE_CONSTRAINTS
  assert 'Fortune 500' in VOICE_CONSTRAINTS
  msgs = build_section_writer_prompt(
      section_id='origin_story',
      section_title='Origin Story',
      section_guidance='400-600 words.',
      charity={'name': 'X', 'location': 'Y', 'focusArea': 'F', 'missionStatement': 'M'},
      research={'foundingMoment': 'FM'},
      style_brief={'bonusType': 'bigBudget', 'visualDirection': 'V'},
  )
  assert len(msgs) == 2
  assert msgs[0]['role'] == 'system'
  assert msgs[1]['role'] == 'user'
  assert 'VOICE CONSTRAINTS' in msgs[0]['content']
  assert 'origin_story' in msgs[0]['content']
  assert 'CHARITY: X' in msgs[1]['content']
  print('OK')
  "</automated>
  </verify>

  <acceptance_criteria>
    - `lib/voice.py` exists and exports `VOICE_CONSTRAINTS` (string) and `build_section_writer_prompt` (callable)
    - `VOICE_CONSTRAINTS` contains the strings: `exclamation marks`, `heartwarming`, `Fortune 500`, `winking`, `as an AI` is forbidden
    - `VOICE_CONSTRAINTS` contains forbidden words `heartwarming`, `inspiring`, `incredible`, `amazing`, `truly`, `simply`, `journey of`, `passion`, `transformative`, `empowering`, `life-changing`, `remarkable`
    - `build_section_writer_prompt` signature accepts ONLY `section_id, section_title, section_guidance, charity, research, style_brief, voice_constraints` (kwargs-only)
    - `build_section_writer_prompt` does NOT accept `state`, `other_sections`, `origin_story`, `problem`, or any other-section parameter
    - Returns a list of exactly 2 messages with roles `system` then `user`
    - System message contains `voice_constraints` and `section_id`
    - User message contains `charity['name']` and `charity['location']`
  </acceptance_criteria>

  <done>
  Voice module ships with structurally-isolated prompt builder. Every section writer in Waves 4-5 calls this exact signature.
  </done>
</task>

<task type="auto">
  <name>Task 4: Extend lib/cost.py — add CostCapExceeded + async check_cap() method</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/cost.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/cost.py (whole file — 179 lines — read FIRST)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (verify `convex_mutation_safe` async signature)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Cost Cap Enforcement" lines 1318-1382 (exact additions)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Common Pitfalls" Pitfall 6 (check_cap must be async)
  </read_first>

  <action>
  Additive edits to `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py`:

  **Edit A — add imports at the top of the file**, after the existing imports (`import json`, `import threading`, `import time`, `from typing import Optional, TypedDict`). Append:
  ```python
  import asyncio
  import logging
  import os
  ```
  Also add `log = logging.getLogger(__name__)` at module scope (below the imports, above `class AgentCost`).

  **Edit B — import the exception class from `lib/errors.py`** (NOT a local re-declaration; Task 1 of this plan owns the canonical definition). Add this import near the other module-imports (below the new asyncio/logging/os imports added in Edit A):
  ```python
  from eisenbalm_pipeline.lib.errors import CostCapExceeded
  ```
  Do NOT declare `class CostCapExceeded(Exception)` in `lib/cost.py` — it lives in `lib/errors.py` (Task 1). Re-export it from `lib/cost.py` for backwards compatibility (existing Phase 4 callers may continue to do `from eisenbalm_pipeline.lib.cost import CostCapExceeded`) by adding it to `__all__`:
  ```python
  __all__ = [
      # ...existing Phase 4 exports preserved verbatim...
      "CostCapExceeded",  # re-exported from lib.errors for caller convenience
  ]
  ```
  If `lib/cost.py` does not already declare `__all__`, simply leave the bare `from ... import CostCapExceeded` statement — the import alone makes the name accessible as `lib.cost.CostCapExceeded`.

  **Edit C — add `_warned: bool = False` and `_last_agent: str = ''` to `CostRecorder.__init__`** (existing constructor — line 148-152). The class currently has:
  ```python
  def __init__(self, run_id: str) -> None:
      self.run_id = run_id
      self.payload: dict = {}
      self.duration_ms: Optional[int] = None
  ```
  Replace with:
  ```python
  def __init__(self, run_id: str) -> None:
      self.run_id = run_id
      self.payload: dict = {}
      self.duration_ms: Optional[int] = None
      # Phase 5 D-08 additions
      self._warned: bool = False
      self._last_agent: str = "unknown"
  ```

  **Edit D — update `CostRecorder.record(...)`** (lines 158-173) to set `self._last_agent = agent_name` at the top of the method. Insert the line `self._last_agent = agent_name` as the first statement of `record()` after the docstring (or top of the body if no docstring). Preserve the rest of the existing delegation to `record_cost(...)`.

  **Edit E — add the async check_cap method** as a new method on `CostRecorder`, AFTER `record()` but BEFORE `__exit__`:
  ```python
      async def check_cap(self) -> None:
          """Soft-warn at 70% of PIPELINE_COST_CAP_USD; hard-raise at 100% (D-08).

          Called by ``lib.openrouter_client.acomplete`` after every LLM call.
          Reads env vars on each call so test fixtures can monkeypatch.

          Raises:
              CostCapExceeded: when cumulative USD >= cap. Caller's
                  ``@agent_node`` wrapper translates this into
                  ``pipelineRuns.status='failed'``.
          """
          cap = float(os.environ.get("PIPELINE_COST_CAP_USD", "10.0"))
          warn_pct = float(os.environ.get("PIPELINE_COST_WARN_PCT", "0.7"))

          # Total USD = sum across all per-agent records for this run_id.
          payload = get_cost_payload(self.run_id)
          total = payload.get("total", 0.0)

          if total >= cap:
              # 3-arg constructor (Plan 05-03 Task 1) — preserves total/cap/agent
              # as introspectable attributes on the exception.
              raise CostCapExceeded(total, cap, self._last_agent)

          if total >= cap * warn_pct and not self._warned:
              self._warned = True
              # Fire-and-forget Convex emit. Import inline to avoid circular
              # dependency between lib.cost and lib.convex_client at module-load.
              try:
                  from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
                  payload_json = json.dumps({
                      "totalUsd": total,
                      "percentOfCap": (total / cap) if cap > 0 else 0.0,
                      "perAgent": payload.get("agents", {}),
                      "capUsd": cap,
                  })
                  # Don't await — the warn shouldn't slow the LLM call path.
                  asyncio.create_task(convex_mutation_safe(
                      "deliberationEvents:insert",
                      {
                          "runId": self.run_id,
                          "agentId": "cost-monitor",
                          "eventType": "cost-warning",
                          "payload": payload_json,
                      },
                  ))
              except Exception as exc:  # noqa: BLE001 — never let warn emission break the call
                  log.warning("cost-warning emission failed: %r", exc)
  ```

  **Edit F — add a module-level helper `get_recorder(run_id)`** so `lib.openrouter_client` can fetch the right recorder without instantiating its own. Since Phase 4 `CostRecorder` is a context-manager-style object (each agent constructs its own), the simplest contract is: each call to `get_recorder(run_id)` returns a NEW `CostRecorder` bound to that `run_id`, sharing the module-level `_store`. The recorder's `_warned` flag is per-instance which means duplicate cost-warnings could fire across calls within one run. To avoid that, keep a module-level `_warned_runs: set[str]` and migrate the dedup state there. Add:
  ```python
  # Module-level dedup for cost-warning emissions (D-08 — one warn per run).
  _warned_runs: set[str] = set()


  def get_recorder(run_id: str) -> "CostRecorder":
      """Return a CostRecorder bound to ``run_id``.

      Phase 5 ``lib.openrouter_client.acomplete`` calls this on every LLM
      invocation; the recorder shares the module-level ``_store`` keyed by
      run_id so token totals accumulate correctly across calls.
      """
      r = CostRecorder(run_id)
      r._warned = run_id in _warned_runs
      return r
  ```

  And update `check_cap` to use the module-level dedup:
  ```python
          if total >= cap * warn_pct and not self._warned:
              self._warned = True
              _warned_runs.add(self.run_id)
              try:
                  from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
                  ...
  ```

  Sanity check: do NOT change any existing module-level function signature. Do NOT change the existing `record_cost` keyword args. Phase 4 callers (e.g., the wrapper at `_wrapper.py` line 121) keep working without edits.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run python -c "
  import asyncio, os
  from eisenbalm_pipeline.lib.cost import CostRecorder, CostCapExceeded, begin_run, record_cost, get_recorder, _warned_runs
  os.environ['PIPELINE_COST_CAP_USD'] = '1.00'
  os.environ['PIPELINE_COST_WARN_PCT'] = '0.5'
  _warned_runs.clear()
  begin_run('test-run-1')
  record_cost('test-run-1', 'calibrator', usd=1.5)
  r = get_recorder('test-run-1')
  r._last_agent = 'calibrator'
  try:
      asyncio.run(r.check_cap())
      raise AssertionError('expected CostCapExceeded')
  except CostCapExceeded as e:
      assert e.total_usd == 1.5 and e.cap_usd == 1.0 and e.agent_id == 'calibrator'
      assert 'cost-cap-exceeded' in str(e)
      print('OK')
  "</automated>
  </verify>

  <acceptance_criteria>
    - `lib/cost.py` exports `CostCapExceeded` (an Exception subclass)
    - `lib/cost.py` exports `get_recorder(run_id)` callable returning a `CostRecorder`
    - `CostRecorder.check_cap` is `async def` (raises `CostCapExceeded` when total >= cap)
    - `CostRecorder.__init__` initializes `self._warned: bool = False` and `self._last_agent: str = "unknown"`
    - `CostRecorder.record` sets `self._last_agent = agent_name`
    - `_warned_runs: set[str]` module-level dedup set exists
    - All Phase 4 exports preserved: `begin_run`, `record_cost`, `get_cost_payload`, `get_duration_ms`, `end_run`, `cost_payload_to_json`, `CostRecorder`, `AgentCost`
    - `record_cost` keyword signature unchanged (`run_id`, `agent_name`, `*`, `tokens_in`, `tokens_out`, `usd`, `duration_ms`)
    - Phase 4 caller (the `@agent_node` wrapper at `_wrapper.py` line 121 — `record_cost(run_id, name, tokens_in=0, tokens_out=0, usd=0.0, duration_ms=duration_ms)`) still works
  </acceptance_criteria>

  <done>
  cost.py extended additively. `check_cap()` raises at cap, fires-and-forgets warn at 70%, deduped per run_id. Phase 4 surface untouched.
  </done>
</task>

<task type="auto">
  <name>Task 5: Create lib/openrouter_client.py — single async LLM call site</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/stubs/fake_openrouter.py (stub-mode interface to preserve)
    - packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py (Task 1 output — MODEL_BY_AGENT etc.)
    - packages/pipeline/src/eisenbalm_pipeline/lib/cost.py (Task 3 output — get_recorder, check_cap, CostCapExceeded)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Pattern 1: OpenRouter Client" lines 188-252 (exact acomplete shape)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Structured Output Strategy" lines 1252-1267 (one-regenerate pattern)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Common Pitfalls" Pitfall 2 (Haiku JSON-mode reliability)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-14 (Pydantic validation, regenerate-once policy)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-22 (EISENBALM_STUB_MODE toggle)
  </read_first>

  <action>
  Create `packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py` with the following structure (adapted from RESEARCH §"Pattern 1" with stub-mode branching and per-call run_id threading):

  ```python
  """Phase 5 — single async OpenRouter client used by every agent (D-14, AGT-17).

  Routes every LLM call through ``acomplete(agent_id, messages, ...)``.
  Records token usage + USD into ``lib.cost.CostRecorder`` keyed by run_id.
  Captures the resolved model ID from OpenRouter's response_metadata into
  ``state['model_versions']`` (AGT-17 observability surface).

  Honors ``EISENBALM_STUB_MODE`` (D-22):
    - true (Phase 4 PIP-06 regression): delegates to FakeOpenRouterClient,
      records 0 tokens / $0, returns canned content.
    - false (Phase 5 default once Plan 05-17 flips runtime default):
      hits OpenRouter live via langchain-openai ChatOpenAI.

  Structured output strategy (D-14): when ``response_format`` is a Pydantic
  BaseModel subclass, uses ``ChatOpenAI.with_structured_output(...)`` with a
  one-regenerate retry on OutputParserException. Second failure propagates;
  ``@agent_node`` wrapper catches and sets pipelineRuns.status='failed'.
  """
  from __future__ import annotations

  import logging
  import os
  from typing import Any, Optional, Type

  from pydantic import BaseModel

  from eisenbalm_pipeline.lib.cost import get_recorder, record_cost
  from eisenbalm_pipeline.lib.llm_config import (
      MODEL_BY_AGENT,
      SAMPLING_BY_AGENT,
      MAX_TOKENS_BY_AGENT,
  )
  from eisenbalm_pipeline.stubs.fake_openrouter import (
      FakeOpenRouterClient,
      is_stub_mode,
  )

  log = logging.getLogger(__name__)


  # ── Real-mode helpers ───────────────────────────────────────────────────


  def _build_chat_model(agent_id: str) -> Any:
      """Return a configured langchain-openai ChatOpenAI for OpenRouter.

      Imported lazily so stub-mode tests don't require langchain-openai's
      transitive runtime deps to resolve.
      """
      from langchain_openai import ChatOpenAI

      if agent_id not in MODEL_BY_AGENT:
          raise KeyError(
              f"agent_id={agent_id!r} not in MODEL_BY_AGENT "
              f"(lib/llm_config.py). Add it there or fix the caller."
          )
      model_id = MODEL_BY_AGENT[agent_id]
      sampling = SAMPLING_BY_AGENT.get(agent_id, {"temperature": 0.7})
      kwargs: dict[str, Any] = {**sampling}
      max_tokens = MAX_TOKENS_BY_AGENT.get(agent_id)
      if max_tokens is not None:
          kwargs["max_tokens"] = max_tokens

      return ChatOpenAI(
          model=model_id,
          openai_api_base="https://openrouter.ai/api/v1",
          openai_api_key=os.environ["OPENROUTER_API_KEY"],
          **kwargs,
      )


  # ── Public API ──────────────────────────────────────────────────────────


  async def acomplete(
      *,
      agent_id: str,
      run_id: str,
      messages: list[dict[str, str]],
      response_format: Optional[Type[BaseModel]] = None,
  ) -> tuple[Any, dict[str, Any]]:
      """Single async LLM call site for every Phase 5 agent.

      Args:
          agent_id: One of the keys in ``MODEL_BY_AGENT`` (e.g. "calibrator").
          run_id: ``state['run_id']``. Used to key cost recording + check_cap.
          messages: List of ``{"role": "system"|"user", "content": str}``.
          response_format: Optional Pydantic BaseModel subclass. When set,
              uses ChatOpenAI.with_structured_output + one regenerate-on-fail.

      Returns:
          ``(content, usage_dict)`` where ``content`` is either a string
          (raw text response) or an instance of ``response_format`` (parsed
          Pydantic object), and ``usage_dict`` contains
          ``{tokens_in, tokens_out, usd, resolved_model}``.

      Raises:
          CostCapExceeded: If cumulative run cost has hit the cap (D-08).
              Caller's ``@agent_node`` wrapper translates to status='failed'.
          OutputParserException: If response_format parsing fails twice
              in a row (one regenerate already attempted).
      """
      # Stub-mode short-circuit (D-22).
      if is_stub_mode():
          fake = FakeOpenRouterClient()
          # Stub returns a dict; if response_format requested, return a default
          # instance so downstream code path is identical to real mode.
          fake_out = await fake.acomplete(prompt=str(messages))
          content: Any
          if response_format is not None:
              try:
                  # Pydantic v2: model_construct skips validation — fine for stub.
                  content = response_format.model_construct()
              except Exception:
                  content = fake_out["content"]
          else:
              content = fake_out["content"]
          record_cost(run_id, agent_id, tokens_in=0, tokens_out=0, usd=0.0)
          return content, {
              "tokens_in": 0,
              "tokens_out": 0,
              "usd": 0.0,
              "resolved_model": "fake-openrouter-stub",
          }

      # Real mode.
      llm = _build_chat_model(agent_id)

      if response_format is not None:
          structured = llm.with_structured_output(response_format)
          try:
              parsed = await structured.ainvoke(messages)
          except Exception as exc:  # OutputParserException + transient — retry once (D-14).
              log.warning("acomplete %s: parse fail, retrying once: %r", agent_id, exc)
              retry_messages = messages + [{
                  "role": "user",
                  "content": (
                      f"Previous output failed schema validation: {exc}. "
                      f"Return JSON strictly matching the schema."
                  ),
              }]
              parsed = await structured.ainvoke(retry_messages)
          # Token + cost capture from the underlying invocation result is not
          # directly available on the structured-output wrapper; we approximate
          # via a separate non-structured call usage_metadata if needed. For
          # now record_cost is called with what we know; LangChain provides
          # response_metadata on the raw model. Fall back to zero on absent.
          tokens_in = 0
          tokens_out = 0
          usd = 0.0
          resolved_model = MODEL_BY_AGENT[agent_id]
          # Best-effort metadata capture (LangChain returns BaseModel directly
          # from with_structured_output; the response_metadata is not exposed
          # in this wrapper path. We log a TODO for accurate token capture).
          log.debug("acomplete %s: structured output (token capture approximate)", agent_id)
          record_cost(run_id, agent_id, tokens_in=tokens_in, tokens_out=tokens_out, usd=usd)
          recorder = get_recorder(run_id)
          recorder._last_agent = agent_id
          await recorder.check_cap()
          return parsed, {
              "tokens_in": tokens_in,
              "tokens_out": tokens_out,
              "usd": usd,
              "resolved_model": resolved_model,
          }

      # Plain string response path — full usage metadata accessible.
      result = await llm.ainvoke(messages)
      usage = getattr(result, "usage_metadata", {}) or {}
      tokens_in = int(usage.get("input_tokens", 0) or 0)
      tokens_out = int(usage.get("output_tokens", 0) or 0)
      # OpenRouter's usage cost field shape may vary; default conservative.
      input_cost = float(usage.get("input_cost", 0.0) or 0.0)
      output_cost = float(usage.get("output_cost", 0.0) or 0.0)
      usd = input_cost + output_cost

      response_metadata = getattr(result, "response_metadata", {}) or {}
      resolved_model = response_metadata.get("model", MODEL_BY_AGENT[agent_id])

      content = result.content if hasattr(result, "content") else result

      record_cost(run_id, agent_id, tokens_in=tokens_in, tokens_out=tokens_out, usd=usd)
      recorder = get_recorder(run_id)
      recorder._last_agent = agent_id
      await recorder.check_cap()

      return content, {
          "tokens_in": tokens_in,
          "tokens_out": tokens_out,
          "usd": usd,
          "resolved_model": resolved_model,
      }


  # ── State helper for model_versions (AGT-17) ────────────────────────────


  def record_model_version(state: dict, agent_id: str, resolved_model: str) -> None:
      """Mutate ``state['model_versions']`` to record the resolved model.

      Agents call this after each acomplete() call to populate the AGT-17
      observability surface; the final dict is JSON-serialized into
      ``weeklyIssue.pipelineMetadata.modelVersions`` by the Publisher.
      """
      mv = state.get("model_versions") or {}
      mv[agent_id] = resolved_model
      state["model_versions"] = mv
  ```

  Note on token capture for the `with_structured_output` path: langchain-openai's structured output wrapper does not always expose `usage_metadata` directly. Plan 05-17's real-mode smoke is the place to measure and tighten this. For Phase 5 v1, the conservative behavior (zero token capture on structured path) under-reports cost — Andrew's cost baseline (STATE.md blocker) will reveal whether this matters.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "
  import asyncio
  from eisenbalm_pipeline.lib.openrouter_client import acomplete, record_model_version
  from eisenbalm_pipeline.lib.cost import begin_run

  begin_run('test-run-orc')
  content, usage = asyncio.run(acomplete(
      agent_id='calibrator',
      run_id='test-run-orc',
      messages=[{'role': 'system', 'content': 's'}, {'role': 'user', 'content': 'u'}],
      response_format=None,
  ))
  assert isinstance(content, str)
  assert usage['tokens_in'] == 0
  assert usage['resolved_model'] == 'fake-openrouter-stub'

  state = {}
  record_model_version(state, 'calibrator', 'anthropic/claude-opus-4-7')
  assert state['model_versions']['calibrator'] == 'anthropic/claude-opus-4-7'
  print('OK')
  "</automated>
  </verify>

  <acceptance_criteria>
    - `lib/openrouter_client.py` exports `acomplete` (async callable) and `record_model_version` (sync callable)
    - `acomplete` signature is `*, agent_id: str, run_id: str, messages: list, response_format: Optional[Type[BaseModel]] = None`
    - `acomplete` returns a 2-tuple `(content, usage_dict)` where `usage_dict` contains keys `tokens_in, tokens_out, usd, resolved_model`
    - With `EISENBALM_STUB_MODE=true`, `acomplete` returns `("stub-response", {..., 'resolved_model': 'fake-openrouter-stub'})` without hitting OpenRouter
    - Real mode (env unset / set to "false") uses `ChatOpenAI(openai_api_base="https://openrouter.ai/api/v1", openai_api_key=os.environ["OPENROUTER_API_KEY"])`
    - Cost is recorded via `record_cost(run_id, agent_id, ...)` on every call
    - `await recorder.check_cap()` is called on every real-mode call
    - `record_model_version(state, agent_id, resolved_model)` mutates `state['model_versions']` in place
  </acceptance_criteria>

  <done>
  Single LLM call site lands. Stub-mode tests pass. Real-mode path uses lazy import so stub-only test envs don't pay the cost.
  </done>
</task>

<task type="auto">
  <name>Task 6: Create lib/search_client.py — Tavily wrapper for Scout + Researcher</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py</files>

  <read_first>
    - Plan 05-02 Task 1 SUMMARY — which langchain-tavily import path resolved at 0.2.18
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Tavily Integration" lines 1268-1314
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Common Pitfalls" Pitfall 1 (import-path drift)
    - packages/pipeline/src/eisenbalm_pipeline/stubs/fake_openrouter.py (is_stub_mode helper to reuse)
  </read_first>

  <action>
  Create `packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py`:

  ```python
  """Tavily web search wrapper. Used only by Scout + Researcher (D-09).

  Honors ``EISENBALM_STUB_MODE``: in stub mode returns a deterministic 3-item
  fixture list so Scout / Researcher tests don't hit the live API.

  Import-path resilience (RESEARCH Pitfall 1): tries ``langchain_tavily``
  first (the canonical 0.2.18 package); falls back to
  ``langchain_community.utilities.tavily_search`` if absent. Plan 05-02 Task 1
  SUMMARY records which path resolves at the current pin.
  """
  from __future__ import annotations

  import asyncio
  import logging
  import os
  from dataclasses import dataclass
  from typing import Any

  from eisenbalm_pipeline.stubs.fake_openrouter import is_stub_mode

  log = logging.getLogger(__name__)


  @dataclass
  class SearchResult:
      """Tavily search hit. Stable shape for Scout + Researcher consumption."""
      url: str
      title: str
      content: str
      score: float


  _STUB_RESULTS = [
      SearchResult(
          url="https://example.org/quiet-foundation",
          title="The Quiet Foundation",
          content="A small Vermont charity preserving library acoustic environments.",
          score=0.92,
      ),
      SearchResult(
          url="https://example.org/backroad-cartography",
          title="The Backroad Cartography Trust",
          content="Cartographers documenting forgotten New England backroads.",
          score=0.81,
      ),
      SearchResult(
          url="https://example.org/seed-savers",
          title="Heritage Seed Savers Collective",
          content="Preserving heirloom seed varieties across the Midwest.",
          score=0.75,
      ),
  ]


  # ── Wrapper cache (one TavilyClient per process) ─────────────────────────


  _wrapper: Any = None


  def _get_wrapper() -> Any:
      """Resolve a Tavily client object; tries multiple import paths."""
      global _wrapper
      if _wrapper is not None:
          return _wrapper
      api_key = os.environ.get("TAVILY_API_KEY")
      if not api_key:
          raise RuntimeError(
              "TAVILY_API_KEY not set. Required by Scout + Researcher when "
              "EISENBALM_STUB_MODE is false."
          )

      # Prefer langchain_tavily (canonical 0.2.18).
      try:
          from langchain_tavily import TavilySearch
          _wrapper = TavilySearch(tavily_api_key=api_key, max_results=10)
          log.info("search_client: using langchain_tavily.TavilySearch")
          return _wrapper
      except ImportError:
          pass

      # Fallback: langchain_community wrapper.
      try:
          from langchain_community.utilities.tavily_search import TavilySearchAPIWrapper
          _wrapper = TavilySearchAPIWrapper(tavily_api_key=api_key)
          log.info("search_client: using langchain_community TavilySearchAPIWrapper")
          return _wrapper
      except ImportError:
          pass

      # Last resort: tavily-python directly.
      from tavily import TavilyClient
      _wrapper = TavilyClient(api_key=api_key)
      log.info("search_client: using tavily-python TavilyClient (bare)")
      return _wrapper


  # ── Public API ──────────────────────────────────────────────────────────


  async def web_search(query: str, *, max_results: int = 5) -> list[SearchResult]:
      """Search Tavily. Stub-mode returns deterministic fixtures.

      Args:
          query: Free-text search query.
          max_results: Cap on returned hits (Tavily's max is typically 10).

      Returns:
          List of SearchResult, possibly empty on transient failure (logged).
      """
      if is_stub_mode():
          return list(_STUB_RESULTS[:max_results])

      wrapper = _get_wrapper()

      # langchain_tavily.TavilySearch exposes .ainvoke(query) returning
      # {"results": [...]}; TavilySearchAPIWrapper exposes .aresults(query, max_results);
      # tavily-python TavilyClient exposes .search(query) (sync) — wrap in to_thread.
      raw_list: list[dict] = []
      try:
          # Detect interface heuristically.
          if hasattr(wrapper, "ainvoke") and callable(getattr(wrapper, "ainvoke")):
              raw = await wrapper.ainvoke({"query": query, "max_results": max_results})
              raw_list = raw.get("results", []) if isinstance(raw, dict) else []
          elif hasattr(wrapper, "aresults") and callable(getattr(wrapper, "aresults")):
              raw_list = await wrapper.aresults(query, max_results=max_results)
          elif hasattr(wrapper, "search") and callable(getattr(wrapper, "search")):
              raw = await asyncio.to_thread(wrapper.search, query, max_results=max_results)
              raw_list = raw.get("results", []) if isinstance(raw, dict) else []
          else:
              log.error("search_client: unknown Tavily client interface on %r", type(wrapper))
              return []
      except Exception as exc:  # noqa: BLE001 — network errors must not crash agents
          log.warning("Tavily search failed (query=%r): %r", query, exc)
          return []

      results: list[SearchResult] = []
      for r in raw_list[:max_results]:
          if not isinstance(r, dict):
              continue
          results.append(SearchResult(
              url=str(r.get("url", "")),
              title=str(r.get("title", "")),
              content=str(r.get("content", r.get("snippet", ""))),
              score=float(r.get("score", 0.0) or 0.0),
          ))
      return results
  ```

  Adapt the import-order to whichever path Plan 05-02 Task 1 SUMMARY identified as canonical (move it to the top of `_get_wrapper`). Leave the others as fallbacks.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "
  import asyncio
  from eisenbalm_pipeline.lib.search_client import web_search, SearchResult
  results = asyncio.run(web_search('obscure charity acoustic library'))
  assert len(results) >= 1
  assert all(isinstance(r, SearchResult) for r in results)
  assert all(r.url for r in results)
  assert all(0.0 <= r.score <= 1.0 for r in results)
  print('OK')
  "</automated>
  </verify>

  <acceptance_criteria>
    - `lib/search_client.py` exports `SearchResult` dataclass and `web_search` async callable
    - `SearchResult` has 4 fields: `url, title, content, score`
    - `web_search(query, max_results=5)` returns `list[SearchResult]`
    - In stub mode (`EISENBALM_STUB_MODE=true`) returns at least 1 deterministic result without hitting the network
    - In real mode, tries `langchain_tavily.TavilySearch` first (or whichever path Plan 05-02 SUMMARY recorded as canonical), then `langchain_community.utilities.tavily_search.TavilySearchAPIWrapper`, then bare `tavily.TavilyClient`
    - Network errors return `[]` (logged) rather than raise — agents handle empty result lists gracefully
  </acceptance_criteria>

  <done>
  Tavily wrapper ships. Scout + Researcher have a single call site. Stub-mode tests don't need TAVILY_API_KEY set.
  </done>
</task>

<task type="auto">
  <name>Task 7: Create lib/wcag.py — Python port of apps/web/lib/theme.ts</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/wcag.py</files>

  <read_first>
    - apps/web/lib/theme.ts (whole file — 390 lines — port the WCAG math + HEX_REGEX + BRAND_DEFAULTS)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"WCAG-AA Python Port" lines 1075-1138 (target Python code shape)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Common Pitfalls" Pitfall 3 (MUST use 0.03928, NOT 0.04045)
  </read_first>

  <action>
  Create `packages/pipeline/src/eisenbalm_pipeline/lib/wcag.py` with the following content. Critical: use threshold `0.03928` (matches `apps/web/lib/theme.ts srgbToLinear` exactly) — do NOT "correct" to WCAG 2.1's `0.04045` or Phase 5 DesignAgent outputs will fail the Phase 2 renderer or vice versa (RESEARCH Pitfall 3):

  ```python
  """WCAG-AA contrast — Python port of ``apps/web/lib/theme.ts``.

  IMPORTANT (RESEARCH Pitfall 3): uses linearization threshold ``0.03928`` to
  match Phase 2's render-time validator exactly. Do NOT change to WCAG 2.1's
  ``0.04045``; the two validators must agree on every color.

  Used by ``agents/design.py`` (Plan 05-14) to validate DesignAgent output
  before the Sanity write. Failure path: regenerate-once; second failure
  falls back to ``SAFE_THEME``.
  """
  from __future__ import annotations

  import re

  HEX_REGEX = re.compile(r"^#[0-9a-fA-F]{6}$")
  WCAG_AA_THRESHOLD = 4.5

  # apps/web/lib/theme.ts BRAND_DEFAULTS (lines 67-76) — Phase 2 verified.
  # Phase 5 DesignAgent fallback uses these when validation fails twice.
  SAFE_THEME: dict[str, str] = {
      "primaryColor":    "#2D5016",         # forest green
      "accentColor":     "#8B1A1A",         # deep crimson
      "backgroundColor": "#FAFAF8",         # warm off-white
      "textColor":       "#1A1A18",         # near-black
      "fontDisplay":     "Playfair Display",
      "fontBody":        "Source Serif Pro",
  }


  def validate_hex(color: str) -> bool:
      """Strict 6-digit hex regex. Mirrors apps/web/lib/theme.ts validateHex."""
      if not isinstance(color, str):
          return False
      return bool(HEX_REGEX.match(color))


  def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
      """Convert 6-digit hex (post-validate_hex) to (r, g, b) in [0, 255]."""
      r = int(hex_color[1:3], 16)
      g = int(hex_color[3:5], 16)
      b = int(hex_color[5:7], 16)
      return r, g, b


  def _srgb_to_linear(channel255: int) -> float:
      """sRGB (0-255) → linearized per apps/web/lib/theme.ts srgbToLinear.

      Threshold ``0.03928`` matches the TypeScript exactly.
      """
      c = channel255 / 255.0
      if c <= 0.03928:
          return c / 12.92
      return ((c + 0.055) / 1.055) ** 2.4


  def relative_luminance(hex_color: str) -> float:
      """WCAG 2.x relative luminance. Returns NaN-like 0.0 on invalid input
      (matches apps/web/lib/theme.ts behavior: invalid → NaN; here we
      return 0.0 for simpler arithmetic — passes_wcag_aa returns False below).
      """
      if not validate_hex(hex_color):
          return 0.0
      r, g, b = _hex_to_rgb(hex_color)
      r_l = _srgb_to_linear(r)
      g_l = _srgb_to_linear(g)
      b_l = _srgb_to_linear(b)
      return 0.2126 * r_l + 0.7152 * g_l + 0.0722 * b_l


  def contrast_ratio(hex1: str, hex2: str) -> float:
      """WCAG 2.x contrast ratio. Returns 0.0 if either input is invalid
      (so passes_wcag_aa returns False — safe behavior matches Phase 2).
      """
      if not (validate_hex(hex1) and validate_hex(hex2)):
          return 0.0
      l1 = relative_luminance(hex1)
      l2 = relative_luminance(hex2)
      lighter = max(l1, l2)
      darker = min(l1, l2)
      return (lighter + 0.05) / (darker + 0.05)


  def passes_wcag_aa(hex_text: str, hex_bg: str) -> bool:
      """True iff (text, bg) contrast ratio >= 4.5:1 (WCAG AA body text).

      Argument order matches apps/web/lib/theme.ts passesWcagAA(textColor, bgColor).
      """
      return contrast_ratio(hex_text, hex_bg) >= WCAG_AA_THRESHOLD


  def validate_theme(theme: dict) -> list[str]:
      """Validate a DesignAgent-emitted theme.

      Checks:
        1. All 4 color fields (primaryColor, accentColor, backgroundColor,
           textColor) match HEX_REGEX.
        2. (backgroundColor, textColor) pair passes WCAG AA (>= 4.5:1).

      Returns:
          Empty list if valid. Otherwise list of human-readable error strings.
          Caller (agents/design.py) uses non-empty list to trigger regenerate.

      Note: fontDisplay / fontBody whitelist enforcement is in
      ``agents/design/font_whitelist.py`` (Plan 05-04), not here.
      """
      errors: list[str] = []
      for field in ("primaryColor", "accentColor", "backgroundColor", "textColor"):
          value = theme.get(field, "")
          if not validate_hex(value):
              errors.append(f"{field} invalid 6-digit hex: '{value}'")
      if not errors:
          ratio = contrast_ratio(theme["backgroundColor"], theme["textColor"])
          if ratio < WCAG_AA_THRESHOLD:
              errors.append(
                  f"bg/text contrast {ratio:.2f}:1 fails WCAG AA "
                  f"(required >= {WCAG_AA_THRESHOLD}:1)"
              )
      return errors
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run python -c "
  from eisenbalm_pipeline.lib.wcag import (
      validate_hex, contrast_ratio, passes_wcag_aa, validate_theme,
      SAFE_THEME, WCAG_AA_THRESHOLD,
  )
  # Hex regex
  assert validate_hex('#FFFFFF') is True
  assert validate_hex('#fff') is False
  assert validate_hex('red') is False
  assert validate_hex('#GG0000') is False
  # Contrast: black on white is ~21:1
  r = contrast_ratio('#000000', '#FFFFFF')
  assert 20.5 < r < 21.5, f'unexpected: {r}'
  # WCAG: brand defaults pass
  assert passes_wcag_aa(SAFE_THEME['textColor'], SAFE_THEME['backgroundColor']) is True
  # WCAG: low contrast fails
  assert passes_wcag_aa('#CCCCCC', '#FFFFFF') is False
  # validate_theme: SAFE_THEME passes (no errors)
  assert validate_theme({**SAFE_THEME}) == []
  # validate_theme: bad hex returns error
  errs = validate_theme({'primaryColor': 'red', 'accentColor': '#8B1A1A', 'backgroundColor': '#FAFAF8', 'textColor': '#1A1A18'})
  assert any('primaryColor' in e for e in errs)
  print('OK')
  "</automated>
  </verify>

  <acceptance_criteria>
    - `lib/wcag.py` exports `HEX_REGEX`, `WCAG_AA_THRESHOLD`, `SAFE_THEME`, `validate_hex`, `relative_luminance`, `contrast_ratio`, `passes_wcag_aa`, `validate_theme`
    - `_srgb_to_linear` uses threshold `0.03928` (grep confirms presence; NOT `0.04045`)
    - `WCAG_AA_THRESHOLD == 4.5`
    - `contrast_ratio('#000000', '#FFFFFF')` returns ~21.0 (between 20.5 and 21.5)
    - `passes_wcag_aa(SAFE_THEME['textColor'], SAFE_THEME['backgroundColor'])` returns True
    - `validate_theme(SAFE_THEME)` returns `[]`
    - `validate_theme({'primaryColor': 'red', ...})` returns a non-empty error list
    - `validate_hex('#fff')` returns False (3-digit shorthand rejected — matches Phase 2)
    - `SAFE_THEME` has all 6 expected keys
  </acceptance_criteria>

  <done>
  WCAG module ships, matches Phase 2 exactly. DesignAgent (Plan 05-14) consumes via `validate_theme`.
  </done>
</task>

</tasks>

<verification>
- All 6 lib modules importable: `uv run python -c "from eisenbalm_pipeline.lib import openrouter_client, llm_config, voice, search_client, wcag, cost"` exits 0
- `EISENBALM_STUB_MODE=true uv run python -c "import asyncio; from eisenbalm_pipeline.lib.openrouter_client import acomplete; from eisenbalm_pipeline.lib.cost import begin_run; begin_run('r'); asyncio.run(acomplete(agent_id='qa', run_id='r', messages=[{'role':'system','content':'x'}], response_format=None))"` exits 0
- `EISENBALM_STUB_MODE=true uv run python -c "import asyncio; from eisenbalm_pipeline.lib.search_client import web_search; r = asyncio.run(web_search('test')); assert len(r) >= 1"` exits 0
- `lib/cost.py` `record_cost` signature unchanged (Phase 4 caller at `_wrapper.py:121` still works)
</verification>

<success_criteria>
- 6 library modules land (5 new, 1 extended additively)
- Stub-mode smoke through `openrouter_client.acomplete` works without OPENROUTER_API_KEY
- Stub-mode smoke through `search_client.web_search` works without TAVILY_API_KEY
- Phase 4 `lib.cost` exports preserved byte-for-byte (no Phase 4 breakage)
- `lib.voice.build_section_writer_prompt` signature structurally forbids cross-section state (AGT-09 enforcement in code)
- `lib.wcag` uses the `0.03928` threshold (RESEARCH Pitfall 3 honored)
- All 14 agent_ids are in `MODEL_BY_AGENT`
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-03-lib-modules-SUMMARY.md`. Include in the summary: (1) which `langchain-tavily` import path resolved as canonical at 0.2.18, (2) whether `with_structured_output` reliably exposed token metadata on Sonnet vs. Haiku (TODO for Plan 05-17 real-mode smoke).
</output>
