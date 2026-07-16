---
phase: 46-signal-editor-candidate-verification
plan: 04
type: execute
wave: 3
depends_on: ["46-01", "46-02", "46-03"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/signal_editor.py
  - packages/pipeline/tests/agents/test_signal_editor.py
autonomous: true
requirements: [SGE-01, SGE-02, SGE-05]

must_haves:
  truths:
    - "signal_editor emits 3-5 StoryLeads, each with premise/datedPeg/pegSourceUrl/readerEnergy/charitableAngle/category/confidence/brandRiskFlag"
    - "A brand-risk-flagged lead is NEVER recommended=true, even if the LLM output claims otherwise (enforced in Python)"
    - "signal_editor reads Editorial Memory and attaches a repetitionWarning to an overlapping lead WITHOUT dropping it; Convex-down → leads still emitted"
    - "Each lead is persisted to Convex story_leads (nothing silent)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/signal_editor.py"
      provides: "@agent_node signal_editor + SignalEditorOutput/StoryLead Pydantic"
      contains: "def signal_editor"
      min_lines: 60
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/agents/signal_editor.py"
      to: "storyLeads:insert"
      via: "convex_mutation_safe per lead"
      pattern: "storyLeads:insert"
    - from: "packages/pipeline/src/eisenbalm_pipeline/agents/signal_editor.py"
      to: "charities:listRecentFeatured + compute_repetition_note"
      via: "Editorial Memory read (empty fallback on failure)"
      pattern: "listRecentFeatured"
---

<objective>
Build the Signal Editor LLM agent: it runs before Scout, does a bounded web search for current dated news, reads Editorial Memory for a repetition avoid-note, calls the LLM to produce 3-5 StoryLeads, enforces the brand-risk/recommended invariant in Python, persists each lead to Convex, and returns `story_leads` on state.

Purpose: SGE-01 (real dated leads), SGE-02 (never self-select a brand-risk lead), SGE-05 (surface, never suppress, a repetition warning). This is the node that makes Stage 1 have real leads to render in Phase 47.
Output: agents/signal_editor.py + the filled-in test_signal_editor.py (Wave-0 stub from 46-01).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/46-signal-editor-candidate-verification/46-CONTEXT.md
@.planning/phases/46-signal-editor-candidate-verification/46-RESEARCH.md
@.planning/phases/46-signal-editor-candidate-verification/46-VALIDATION.md
@packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py
@packages/pipeline/src/eisenbalm_pipeline/api/registry.py
@packages/pipeline/src/eisenbalm_pipeline/lib/registry_repetition.py

<interfaces>
<!-- @agent_node — from agents/scout.py -->
from eisenbalm_pipeline.agents._wrapper import agent_node
@agent_node(name="signal_editor", emit_event=None, max_tool_calls=8)
async def signal_editor(state: DispatchState) -> DispatchState: ...

<!-- LLM + tools + convex + memory (all existing) -->
from eisenbalm_pipeline.lib.openrouter_client import acomplete            # acomplete(agent_id=, run_id=, messages=, response_format=) -> (obj, usage) ; usage["resolved_model"]
from eisenbalm_pipeline.lib.search_client import web_search, SearchResult  # web_search(q, *, max_results=5)
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe, convex_query_safe  # query_safe returns None on failure
from eisenbalm_pipeline.lib.sanity_client import groq_query               # groq_query(q, *, params=None)
from eisenbalm_pipeline.lib.registry_repetition import compute_repetition_note  # (sanity_rows) -> {"note","avoid","sampleSize"}
from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded
from eisenbalm_pipeline.lib.prompts import load_prompt

<!-- Editorial Memory read (mirror api/registry.py:99-138) -->
rows = await convex_query_safe("charities:listRecentFeatured", {"workspace_id": "eisenbalm", "limit": 8})
ids  = [r["sanityCharityId"] for r in (rows or []) if r.get("sanityCharityId")]
sanity_rows = await groq_query('*[_type=="charity" && _id in $ids]{_id, focusArea, location}', params={"ids": ids}) if ids else []
avoid_note = compute_repetition_note(sanity_rows)   # wrap whole read in try/except → {"note":None,"avoid":[],"sampleSize":0} on failure (D-17)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement agents/signal_editor.py</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/signal_editor.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py — the @agent_node pattern, `max_tool_calls=8` Tavily loop with `AgentToolCallLimitExceeded`, `_build_messages` reading `config.agents[key].system_prompt` with disk fallback, `usage["resolved_model"]` into model_versions, per-item `convex_mutation_safe` emission
    - packages/pipeline/src/eisenbalm_pipeline/api/registry.py lines 99-138 — the `charities:listRecentFeatured` + groq focusArea/location read to mirror
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py — StoryLead field names (must match exactly)
    - .planning/phases/46-CONTEXT.md D-08, D-09, D-16, D-17, D-19
  </read_first>
  <behavior>
    - Returns state with story_leads = list of 3-5 dicts; every dict has keys premise, datedPeg, pegSourceUrl, readerEnergy, charitableAngle, category, confidence, brandRiskFlag, brandRiskReason, repetitionWarning, recommended
    - If the LLM returns a lead with brandRiskFlag=true AND recommended=true, the returned dict has recommended forced to false (Python invariant, not prompt trust)
    - When compute_repetition_note yields avoid entries, at least one emitted lead may carry a non-null repetitionWarning; NO lead is dropped on repetition grounds
    - When convex_query_safe / groq_query raise, the agent still returns leads (empty avoid-note, no crash) and logs the failure
    - The Editorial Memory read is logged with a count (verifiable via caplog)
    - web_search is called within the max_tool_calls=8 budget; exceeding it raises AgentToolCallLimitExceeded
  </behavior>
  <action>
    Create `agents/signal_editor.py` mirroring scout.py's shape:
    1. Pydantic output models: `class StoryLeadModel(BaseModel)` with the 11 StoryLead fields (`confidence` constrained via `Literal['low','medium','high']` or a validator); `class SignalEditorOutput(BaseModel)` with `leads: list[StoryLeadModel] = Field(default_factory=list)`.
    2. `SIGNAL_QUERIES: tuple[str,...]` — 2-3 curated CURRENT-news queries (dated/charitable-adjacent, e.g. "this week charitable response breaking news", "recent nonprofit relief effort event") — NOT Scout's "obscure charity" queries.
    3. `async def _read_repetition_note() -> dict`: the Editorial Memory read from the interfaces block, wrapped in try/except → `{"note": None, "avoid": [], "sampleSize": 0}` on ANY failure (D-17), logging `signal_editor: read N recent-coverage row(s) — <note or 'no repetition'>`.
    4. `def _build_messages(*, config, tavily_results, avoid_note) -> list[dict]`: system = `config.agents["signal_editor"].system_prompt if config else load_prompt("signal_editor")`, `.replace("{avoid_note}", avoid_note.get("note") or "")`; user template = `config.user_templates.get("signal_editor_user") or load_prompt("signal_editor_user")`, `.replace("{results_block}", <formatted tavily results>)` (same block shape scout uses).
    5. `@agent_node(name="signal_editor", emit_event=None, max_tool_calls=8) async def signal_editor(state)`:
       - `run_id = state["run_id"]`; `avoid_note = await _read_repetition_note()`
       - bounded Tavily loop over SIGNAL_QUERIES with a local `tool_calls` counter and `AgentToolCallLimitExceeded(agent_id="signal_editor", ...)` guard (verbatim shape from scout.discover_candidates)
       - `out, usage = await acomplete(agent_id="signal_editor", run_id=run_id, messages=_build_messages(config=state.get("config"), tavily_results=results, avoid_note=avoid_note), response_format=SignalEditorOutput)`
       - `leads = [l.model_dump() for l in getattr(out, "leads", [])]`
       - PYTHON INVARIANT (SGE-02, D-08): `for lead in leads: if lead.get("brandRiskFlag"): lead["recommended"] = False`
       - Per-lead Convex emission (nothing silent): `for lead in leads: await convex_mutation_safe("storyLeads:insert", {"runId": run_id, **lead})`
       - record model: `model_versions = dict(state.get("model_versions") or {}); model_versions["signal_editor"] = usage["resolved_model"]`
       - `return {**state, "story_leads": leads, "model_versions": model_versions}`
  </action>
  <acceptance_criteria>
    - `grep -q "def signal_editor" packages/pipeline/src/eisenbalm_pipeline/agents/signal_editor.py` and `grep -q "class SignalEditorOutput" ...` both match
    - `grep -q 'lead\["recommended"\] = False' packages/pipeline/src/eisenbalm_pipeline/agents/signal_editor.py` (Python invariant present)
    - `grep -q "storyLeads:insert" packages/pipeline/src/eisenbalm_pipeline/agents/signal_editor.py` matches
    - `grep -q "listRecentFeatured" packages/pipeline/src/eisenbalm_pipeline/agents/signal_editor.py` matches
    - `grep -q "AgentToolCallLimitExceeded" packages/pipeline/src/eisenbalm_pipeline/agents/signal_editor.py` matches
    - `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.signal_editor import signal_editor, SignalEditorOutput; print('IMPORT_OK')"` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.signal_editor import signal_editor, SignalEditorOutput, StoryLeadModel; print('IMPORT_OK')"</automated>
  </verify>
  <done>signal_editor emits leads, enforces the brand-risk invariant in Python, reads Editorial Memory with an empty fallback, and persists each lead.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fill test_signal_editor.py (SGE-01, SGE-02, SGE-05)</name>
  <files>packages/pipeline/tests/agents/test_signal_editor.py</files>
  <read_first>
    - packages/pipeline/tests/agents/test_signal_editor.py — the Wave-0 stub (from 46-01) with the exact `-k` names to fill
    - packages/pipeline/tests/agents/ — an existing agent unit test (e.g. test_scout_registry.py) for the acomplete/web_search/convex monkeypatch fixture pattern
    - packages/pipeline/tests/test_repetition_note.py — the `_FEATURED_ROWS_OVER_REPRESENTED` fixture shape to reuse for the repetition test
  </read_first>
  <behavior>
    - test_emits_leads_with_required_fields: mock acomplete → SignalEditorOutput with 3-5 leads; assert len in 3..5 and every lead dict has all 11 StoryLead keys
    - test_brand_risk_never_recommended: mock acomplete → a lead with brandRiskFlag=true AND recommended=true; assert the returned lead's recommended is False and brandRiskReason is non-empty
    - test_repetition_warning_attached: monkeypatch the Editorial Memory read so compute_repetition_note returns an "avoid US-SE · avoid weather" note; assert a lead carries a non-null repetitionWarning AND all leads are still present (none dropped)
    - test_editorial_memory_read_empty_fallback: make convex_query_safe raise; assert leads are still emitted and no exception propagates
    - test_repetition_read_logged: use caplog to assert the read is logged with a count
  </behavior>
  <action>
    Replace the five `pytest.skip(...)` stubs with real async tests. Monkeypatch `eisenbalm_pipeline.agents.signal_editor.acomplete` (side_effect returning `(SignalEditorOutput(leads=[...]), {"resolved_model": "anthropic/claude-sonnet-4-6", ...})`), `signal_editor.web_search` (AsyncMock → a few SearchResult), `signal_editor.convex_mutation_safe` (AsyncMock), and the memory read (`signal_editor.convex_query_safe` + `signal_editor.groq_query`). Invoke `await signal_editor.__wrapped__(state)` or the underlying coroutine directly with a minimal state (`{"run_id": "r1", "issue_number": 1, "model_versions": {}}`); if the @agent_node wrapper interferes, call the inner function via the module (mirror how existing agent unit tests bypass the wrapper). Assert per the behavior block. Use the exact `-k` names already in the file.
  </action>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/agents/test_signal_editor.py -q` exits 0 with all 5 tests PASSED (none skipped)
    - `uv run pytest tests/agents/test_signal_editor.py -k brand_risk -q` passes (SGE-02)
    - `uv run pytest tests/agents/test_signal_editor.py -k repetition -q` passes (SGE-05)
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_signal_editor.py -q</automated>
  </verify>
  <done>All five signal_editor unit tests pass, proving SGE-01/SGE-02/SGE-05 at the agent boundary.</done>
</task>

</tasks>

<verification>
- signal_editor imports and emits 3-5 leads with the full field set
- brand-risk lead never recommended; repetition warning attached-not-suppressed; empty fallback on Convex failure
- `cd packages/pipeline && uv run pytest tests/agents/test_signal_editor.py -q` green
</verification>

<success_criteria>
- SGE-01: 3-5 dated leads with all required fields, each persisted to story_leads
- SGE-02: brand-risk-flagged leads never recommended (Python-enforced)
- SGE-05: repetition warning surfaced (not suppressed), empty fallback when Convex unavailable
</success_criteria>

<output>
After completion, create `.planning/phases/46-signal-editor-candidate-verification/46-04-SUMMARY.md`
</output>
