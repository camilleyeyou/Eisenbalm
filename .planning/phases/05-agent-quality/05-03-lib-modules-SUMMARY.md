---
phase: 05-agent-quality
plan: 03
subsystem: infra

tags: [openrouter, langchain-openai, tavily, wcag, voice, cost-cap, model-pinning, pydantic]

# Dependency graph
requires:
  - phase: 05-agent-quality
    provides: "Plan 05-01 — agentVotes/qaCorrections/deliberationEvents Convex schema patches; cost-warning + agent-tool-limit-exceeded eventType literals"
  - phase: 05-agent-quality
    provides: "Plan 05-02 — langchain-tavily 0.2.18, tavily-python 0.7.24, selectolax 0.4.9 pinned; DispatchState extended with featured_charity_keys + ResearchOutput verification fields; .env.example documents 5 Phase 5 env vars"
  - phase: 04-pipeline-skeleton
    provides: "lib/cost.py module-level record_cost/begin_run/end_run + CostRecorder context manager; stubs/fake_openrouter.py FakeOpenRouterClient + is_stub_mode helper; lib/convex_client.py convex_mutation_safe; @agent_node decorator contract"
  - phase: 02-web-shell-theme-engine
    provides: "apps/web/lib/theme.ts WCAG math (0.03928 threshold, HEX_REGEX, BRAND_DEFAULTS) — ported verbatim to lib/wcag.py"
provides:
  - "lib/errors.py — CostCapExceeded + AgentToolCallLimitExceeded shared exception classes (single source for all Phase 5 consumers)"
  - "lib/llm_config.py — MODEL_BY_AGENT (14 agent_ids → 3 tiers), SAMPLING_BY_AGENT, MAX_TOKENS_BY_AGENT, MODEL_PIN_VOICE_CRITICAL"
  - "lib/voice.py — VOICE_CONSTRAINTS canonical Jesse voice block + build_section_writer_prompt() with structural isolation (AGT-09 enforced at signature level)"
  - "lib/cost.py — additively extended with async CostRecorder.check_cap(), get_recorder(run_id) factory, _warned_runs dedup set; Phase 4 surface preserved byte-for-byte"
  - "lib/openrouter_client.py — single async acomplete(agent_id, run_id, messages, response_format) call site; stub-mode + real-mode (langchain_openai.ChatOpenAI at openrouter.ai/api/v1); record_model_version helper for AGT-17"
  - "lib/search_client.py — async web_search() wrapping langchain_tavily.TavilySearch with langchain_community + tavily-python fallbacks; SearchResult dataclass; stub-mode fixtures"
  - "lib/wcag.py — Python port of apps/web/lib/theme.ts (0.03928 threshold) with validate_hex, contrast_ratio, passes_wcag_aa, validate_theme, SAFE_THEME"
affects:
  - "05-04-test-infrastructure-and-font-whitelist (consumes lib/wcag.SAFE_THEME)"
  - "05-05-calibrator (consumes lib/openrouter_client.acomplete + lib/voice.VOICE_CONSTRAINTS)"
  - "05-06-scout (consumes lib/openrouter_client.acomplete + lib/search_client.web_search + lib/errors.AgentToolCallLimitExceeded)"
  - "05-07-advocate (consumes lib/openrouter_client.acomplete)"
  - "05-08-editor-gate1 (consumes lib/openrouter_client.acomplete)"
  - "05-09-researcher-and-verify (consumes lib/openrouter_client.acomplete + lib/search_client.web_search + lib/errors.AgentToolCallLimitExceeded)"
  - "05-10-section-writers (consumes lib/voice.build_section_writer_prompt)"
  - "05-11-bonus-and-game (consumes lib/voice.build_section_writer_prompt)"
  - "05-12-design-agent (consumes lib/wcag.validate_theme + SAFE_THEME)"
  - "05-13-qa-and-editor-final (consumes lib/openrouter_client.acomplete)"
  - "05-14-real-mode-integration-test (consumes lib/errors.CostCapExceeded + lib/cost.check_cap)"

# Tech tracking
tech-stack:
  added: []  # All deps already pinned in Plan 05-02
  patterns:
    - "Single-source exception module (lib/errors.py): one file owns both Phase 5 custom exceptions; lib/cost re-exports for backwards compat"
    - "Single call-site for LLM (lib/openrouter_client.acomplete): every agent in Phase 5 routes through one function; stub-mode short-circuit at function entry"
    - "Single call-site for web search (lib/search_client.web_search): Scout + Researcher only call sites; resilient import chain (langchain_tavily → langchain_community → tavily-python)"
    - "Single call-site for section-writer prompt assembly (lib/voice.build_section_writer_prompt): kwargs-only signature structurally forbids cross-section state injection (AGT-09 enforced in code)"
    - "Lazy imports for heavy deps: langchain_openai imported inside _build_chat_model so stub-mode tests don't pay langchain-openai's transitive cost; convex_mutation_safe imported inside check_cap to avoid circular import"
    - "Module-level dedup set (lib/cost._warned_runs): cost-warning fires once per run_id across all CostRecorder instances bound to that run"
    - "Async fire-and-forget Convex emit via asyncio.create_task: cost-warning emission doesn't block the LLM call path"
    - "Additive extension of Phase 4 module (lib/cost.py): all Phase 4 module-level functions + CostRecorder class preserved verbatim; new methods/helpers appended without breaking Phase 4 callers"

key-files:
  created:
    - "packages/pipeline/src/eisenbalm_pipeline/lib/errors.py"
    - "packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py"
    - "packages/pipeline/src/eisenbalm_pipeline/lib/voice.py"
    - "packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py"
    - "packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py"
    - "packages/pipeline/src/eisenbalm_pipeline/lib/wcag.py"
  modified:
    - "packages/pipeline/src/eisenbalm_pipeline/lib/cost.py (additive extension; Phase 4 surface preserved)"

key-decisions:
  - "CostCapExceeded constructor takes (total_usd, cap_usd, agent_id) — introspectable attributes, NOT a bare f-string message; allows call-site tests to assert on .total_usd, .cap_usd, .agent_id without parsing"
  - "Exception classes live in lib/errors.py (not lib/cost.py or agents/*); lib/cost.py imports and re-exports CostCapExceeded for backwards compat with any Phase 4 callers expecting it from lib.cost"
  - "VOICE_CONSTRAINTS derived verbatim from docs/CLAUDE_CODE_BRIEF.md lines 359-367; treat as configuration artifact (edited by Andrew when voice drifts) not as code"
  - "build_section_writer_prompt signature accepts kwargs-only (section_id, section_title, section_guidance, charity, research, style_brief, voice_constraints) — does NOT accept state or other_sections params; AGT-09 enforced at signature level"
  - "Token capture for with_structured_output path is approximate (zeros) — langchain-openai's wrapper does not expose usage_metadata reliably; Plan 05-14 real-mode smoke is the place to tighten"
  - "search_client tries langchain_tavily.TavilySearch first (canonical at 0.2.18 per Plan 05-02 SUMMARY); fallback chain preserved for resilience against future API drift"
  - "WCAG sRGB linearization threshold pinned at 0.03928 (matches apps/web/lib/theme.ts byte-for-byte); explicitly NOT updated to WCAG 2.1's 0.04045 (RESEARCH Pitfall 3 — must agree with Phase 2 renderer)"
  - "SAFE_THEME.fontBody is 'Lora' (matches apps/web/lib/theme.ts BRAND_DEFAULTS line 73), NOT 'Source Serif Pro' which appears in some RESEARCH snippets; Phase 2 wins for byte-for-byte compatibility"
  - "_warned_runs is module-level (not per-CostRecorder-instance) so multiple get_recorder(run_id) calls within one run share the dedup state"

patterns-established:
  - "Single call site per external dependency: one acomplete (LLM), one web_search (Tavily), one build_section_writer_prompt (section prompts), one validate_theme (WCAG)"
  - "Stub-mode short-circuit at function entry: every lib module that calls external services checks is_stub_mode() first and returns deterministic fixtures without touching the network or real client"
  - "Lazy import of heavy deps inside function bodies: langchain_openai (in _build_chat_model), convex_mutation_safe (in check_cap), Tavily clients (in _get_wrapper) — keeps module-load time fast and stub-mode tests independent of real-mode transitive deps"
  - "Additive lib extension pattern: when extending a Phase 4 module (lib/cost.py), preserve all existing exports byte-for-byte and append new functions/methods/module-level state; verify with the Phase 4 caller's literal keyword-arg signature"
  - "Structural API constraints over comment-based ones: AGT-09's 'voice not concatenated with prior agent state' is enforced by build_section_writer_prompt's kwargs-only signature, not by a docstring or convention"

requirements-completed:
  - AGT-02
  - AGT-03
  - AGT-05
  - AGT-09
  - AGT-13
  - AGT-17
  - AGT-18

# Metrics
duration: 24min
completed: 2026-05-17
---

# Phase 05 Plan 03: Lib Modules Summary

**Seven Phase 5 library modules — single call sites for OpenRouter, Tavily, Jesse-voice prompt assembly, WCAG validation, cost-cap enforcement, and a shared exception hierarchy — landing the infrastructure spine that lets Plans 05-04 through 05-15 implement agent bodies without library churn.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-05-17T17:43:00Z (approx)
- **Completed:** 2026-05-17T18:07:41Z
- **Tasks:** 7
- **Files modified:** 7 (6 created, 1 extended additively)

## Accomplishments

- **One LLM call site for the whole pipeline:** `lib.openrouter_client.acomplete(agent_id, run_id, messages, response_format)` — every Phase 5 agent routes through this. Stub-mode short-circuits to FakeOpenRouterClient (zero tokens, zero USD); real mode hits OpenRouter via `langchain_openai.ChatOpenAI(openai_api_base="https://openrouter.ai/api/v1")`. Cost recording + check_cap fire on every call.
- **One section-writer prompt assembler:** `lib.voice.build_section_writer_prompt(...)` enforces AGT-09's "structurally isolated voiceConstraints" at the signature level — kwargs-only `(section_id, section_title, section_guidance, charity, research, style_brief, voice_constraints)`. No `state` param, no `other_sections` param. Writers that try to inject cross-section content must do so outside this helper, which would surface in code review.
- **One web-search call site:** `lib.search_client.web_search(query, max_results=5)` — used only by Scout + Researcher. Canonical import `from langchain_tavily import TavilySearch` (Plan 05-02 verified at 0.2.18); resilient fallback chain to `langchain_community.TavilySearchAPIWrapper` and bare `tavily.TavilyClient`. Stub mode returns 3 deterministic fixtures.
- **Cost cap enforcement (D-08):** `CostRecorder.check_cap()` raises `CostCapExceeded` at 100% of `PIPELINE_COST_CAP_USD` (default $10) and emits a fire-and-forget `deliberationEvents:insert` with `eventType='cost-warning'` at 70%. Module-level `_warned_runs: set[str]` ensures one warn per run across all recorder instances. Async fire-and-forget Convex emit doesn't block the LLM call path.
- **WCAG-AA validator matches Phase 2 byte-for-byte:** `lib.wcag.validate_theme(theme)` ports `apps/web/lib/theme.ts` with the exact `0.03928` sRGB linearization threshold (RESEARCH Pitfall 3) — both validators must agree on every color. `SAFE_THEME` mirrors `BRAND_DEFAULTS` (Playfair Display + Lora + #FAFAF8/#1A1A18/#2D5016/#8B1A1A).
- **Shared exception hierarchy:** `lib.errors.CostCapExceeded(total_usd, cap_usd, agent_id)` and `lib.errors.AgentToolCallLimitExceeded(agent_id, attempts, limit)` — both with introspectable attributes (not just message strings). `lib.cost.py` re-exports `CostCapExceeded` for backwards-compatibility with any caller expecting it from `lib.cost`.
- **Phase 4 surface preserved byte-for-byte:** `lib/cost.py` extension is purely additive. All Phase 4 module-level functions (`begin_run`, `record_cost`, `get_cost_payload`, `get_duration_ms`, `end_run`, `cost_payload_to_json`) and the `CostRecorder` context-manager surface (`__init__`, `__enter__`, `record`, `__exit__`) work unchanged. The `@agent_node` wrapper at `_wrapper.py:120` still passes `tokens_in=0, tokens_out=0, usd=0.0, duration_ms=duration_ms` literally.

## Task Commits

Each task was committed atomically (--no-verify per parallel-executor protocol):

1. **Task 1: lib/errors.py — shared Phase 5 exception classes** — `6f8603e` (feat)
2. **Task 2: lib/llm_config.py — single source of model identity** — `0de1439` (feat)
3. **Task 3: lib/voice.py — VOICE_CONSTRAINTS + build_section_writer_prompt** — `8e2d6b3` (feat)
4. **Task 4: lib/cost.py extension — async check_cap + get_recorder** — `c6d27e4` (feat)
5. **Task 5: lib/openrouter_client.py — single async LLM call site** — `15b43c4` (feat)
6. **Task 6: lib/search_client.py — Tavily wrapper** — `d80812d` (feat)
7. **Task 7: lib/wcag.py — Python port of apps/web/lib/theme.ts** — `a2f9ffb` (feat)

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/lib/errors.py` — CostCapExceeded + AgentToolCallLimitExceeded (44 lines)
- `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` — MODEL_BY_AGENT (14 agents) + SAMPLING_BY_AGENT + MAX_TOKENS_BY_AGENT + MODEL_PIN_VOICE_CRITICAL (66 lines)
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` — VOICE_CONSTRAINTS string + build_section_writer_prompt kwargs-only function (110 lines)
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` — extended with check_cap + get_recorder + _warned_runs + __all__ + CostRecorder additions (88 new lines; Phase 4 surface preserved)
- `packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py` — acomplete + _build_chat_model + record_model_version (207 lines)
- `packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py` — web_search + SearchResult + _get_wrapper resilient fallback chain (147 lines)
- `packages/pipeline/src/eisenbalm_pipeline/lib/wcag.py` — HEX_REGEX + WCAG_AA_THRESHOLD + SAFE_THEME + validate_hex/contrast_ratio/passes_wcag_aa/validate_theme + relative_luminance (118 lines)

## Decisions Made

- **CostCapExceeded 3-arg constructor:** Took the planner's explicit override of the RESEARCH bare-Exception form. `(total_usd, cap_usd, agent_id)` lets tests assert on attributes without parsing the message string.
- **lib/errors.py owns both exception classes:** Single import site (`from eisenbalm_pipeline.lib.errors import ...`) — no split definitions in `lib/cost.py` + `agents/scout.py` + `agents/researcher.py` + `agents/_wrapper.py`. `lib/cost.py` re-exports `CostCapExceeded` via `__all__` for any caller historically expecting it from `lib.cost`.
- **VOICE_CONSTRAINTS as a configuration artifact:** Treated as data, not code. Edits should be commit-only (Andrew refines voice when QA finds drift); the rubric.md in Plan 05-13 mirrors this content.
- **`build_section_writer_prompt` is the AGT-09 enforcement point:** Decision to encode the "no cross-section state" constraint structurally (kwargs-only signature, no `state`/`other_sections` params) rather than via a comment or convention. Writers that violate AGT-09 must do so outside the helper, which is review-visible.
- **Token capture for structured-output is approximate:** `with_structured_output` doesn't reliably expose `usage_metadata`. Conservative behavior records zeros on the structured path; documented as a TODO for Plan 05-14 real-mode smoke. Plain-text path captures full `input_tokens/output_tokens` from `result.usage_metadata`.
- **Resilient Tavily import chain:** Tried `langchain_tavily.TavilySearch` first per Plan 05-02 SUMMARY, but kept `langchain_community.TavilySearchAPIWrapper` and bare `tavily.TavilyClient` as fallbacks. Future Tavily SDK shifts don't break the agent code path.
- **WCAG threshold 0.03928, not 0.04045:** Pinned to match `apps/web/lib/theme.ts` exactly. Phase 5 DesignAgent outputs must validate identically in both Python (lib/wcag) and TypeScript (apps/web). Diverging would create render-time / pipeline-time disagreement.
- **SAFE_THEME.fontBody = "Lora" (not "Source Serif Pro"):** Cross-referenced `apps/web/lib/theme.ts` line 73 (`fontBody: 'Lora'`) — Phase 2 wins for byte-for-byte compatibility. Some RESEARCH snippets reference "Source Serif Pro"; that was outdated relative to Phase 2 final state.
- **Module-level `_warned_runs` set:** Cost-warning dedup must survive across multiple `get_recorder(run_id)` calls within one run (each call returns a fresh `CostRecorder`). Instance-level `_warned` flag handles within-instance dedup; module-level set handles cross-instance dedup.
- **Async fire-and-forget Convex emit:** `asyncio.create_task(convex_mutation_safe(...))` for cost-warning emission. The warn must not block the LLM call path; failures log silently (`log.warning`) but never propagate.

## Deviations from Plan

None — plan executed exactly as written.

**Notes on choices the plan left open or flagged as TODO:**

- **Canonical Tavily import path** (asked by plan output spec): `from langchain_tavily import TavilySearch` resolves at `langchain-tavily==0.2.18` (Plan 05-02 Task 1 SUMMARY already verified this). `lib/search_client.py` uses this as the primary path; `langchain_community.TavilySearchAPIWrapper` and bare `tavily.TavilyClient` are fallbacks.
- **Token metadata exposure for `with_structured_output`** (asked by plan output spec): At the time of this plan, langchain-openai 1.2.1's `ChatOpenAI.with_structured_output(...)` returns the parsed Pydantic object directly without exposing the underlying `AIMessage.usage_metadata`. Conservative behavior: structured-output path records 0 tokens / $0 USD. This under-reports cost on every voice-critical agent that uses structured output (Calibrator, QA, EditorGate1, EditorFinal). **TODO Plan 05-14 (real-mode integration test):** measure Sonnet vs. Haiku reliability + figure out whether `with_structured_output(..., include_raw=True)` or a separate metadata-capture path can recover the usage data without breaking the structured contract. The plain-text path (no `response_format`) already captures full token metadata via `result.usage_metadata`.

## Issues Encountered

- **One incidental file-state ping during Task 7 commit:** A parallel executor running Plan 05-04 renamed `packages/pipeline/src/eisenbalm_pipeline/agents/design.py` → `design_old.py` (preparing the `design/` directory restructure for font_whitelist). My `git add` for `lib/wcag.py` picked up that rename in the same commit (zero content change — pure rename). The rename was Plan 05-04's intent and was committed by them too. No conflict, no functional impact on this plan's deliverables.

## User Setup Required

None — this plan adds library modules only. No new env vars (the 5 Phase 5 env vars were documented in Plan 05-02). No external service configuration. No dashboard changes.

## Next Phase Readiness

**Ready for Wave 2 (parallel agent bodies):**

- Plan 05-04 (test infrastructure + font whitelist) — parallel with this plan, also in Wave 2; no overlap in `files_modified`.
- Plan 05-05 (Calibrator) — can import `lib.openrouter_client.acomplete` + `lib.voice.VOICE_CONSTRAINTS` + `lib.llm_config.MODEL_BY_AGENT['calibrator']` immediately.
- Plan 05-06 (Scout) — can import `lib.search_client.web_search` + `lib.errors.AgentToolCallLimitExceeded` immediately.
- Plan 05-09 (Researcher + verify_research) — can import `lib.search_client.web_search` immediately.
- Plan 05-10 (Section writers) — can import `lib.voice.build_section_writer_prompt` immediately.
- Plan 05-11 (Bonus + Game) — can import `lib.voice.build_section_writer_prompt` immediately.
- Plan 05-12 (DesignAgent) — can import `lib.wcag.validate_theme` + `lib.wcag.SAFE_THEME` immediately.
- Plan 05-13 (QA + EditorFinal) — can import `lib.openrouter_client.acomplete` immediately.
- Plan 05-14 (real-mode integration test) — can import `lib.errors.CostCapExceeded` + `lib.cost.check_cap` immediately; will also be the place to revisit the structured-output token-capture TODO.

**No blockers introduced.**

---

## Self-Check: PASSED

**Verified files exist:**
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/lib/errors.py`
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py`
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py`
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` (modified)
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py`
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py`
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/lib/wcag.py`

**Verified commits exist:**
- FOUND: `6f8603e` (Task 1 — lib/errors.py)
- FOUND: `0de1439` (Task 2 — lib/llm_config.py)
- FOUND: `8e2d6b3` (Task 3 — lib/voice.py)
- FOUND: `c6d27e4` (Task 4 — lib/cost.py extension)
- FOUND: `15b43c4` (Task 5 — lib/openrouter_client.py)
- FOUND: `d80812d` (Task 6 — lib/search_client.py)
- FOUND: `a2f9ffb` (Task 7 — lib/wcag.py)

**Verified runtime behavior:**
- All 7 lib modules importable: `from eisenbalm_pipeline.lib import openrouter_client, llm_config, voice, search_client, wcag, cost, errors` exits 0
- Stub-mode `acomplete` returns `("stub-response", {..., 'resolved_model': 'fake-openrouter-stub'})` without OPENROUTER_API_KEY
- Stub-mode `web_search` returns 3 deterministic SearchResult objects without TAVILY_API_KEY
- `CostRecorder.check_cap()` raises `CostCapExceeded(total_usd=1.5, cap_usd=1.0, agent_id='calibrator')` when total >= cap
- WCAG `contrast_ratio('#000000', '#FFFFFF')` returns ~21.0 (between 20.5 and 21.5)
- WCAG `validate_theme(SAFE_THEME)` returns `[]`
- Phase 4 `record_cost(run_id, agent_name, tokens_in=0, tokens_out=0, usd=0.0, duration_ms=100)` keyword signature unchanged

---
*Phase: 05-agent-quality*
*Completed: 2026-05-17*
