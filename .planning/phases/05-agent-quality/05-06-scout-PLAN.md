---
phase: 05-agent-quality
plan: 06
type: execute
wave: 3
depends_on:
  - "05-03"
  - "05-04"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
  - packages/pipeline/tests/agents/test_scout.py
autonomous: true
requirements_addressed:
  - AGT-03
  - AGT-04
  - AGT-18
must_haves:
  truths:
    - "Scout uses Tavily (lib/search_client.web_search) to find 3-5 charity candidates"
    - "Scout loads featured charity keys via a single GROQ query at start; in-memory dedup against name/slug/domain"
    - "Each candidate that survives dedup is written to Sanity (write_charity) + Convex pitchLog incrementally"
    - "Scout decorator enforces max_tool_calls=8; overrun raises AgentToolCallLimitExceeded which @agent_node converts to deliberationEvents eventType='agent-tool-limit-exceeded' + pipelineRuns.status='failed'"
    - "Scout output is a list of CharityCandidate Pydantic objects matching docs/CLAUDE_CODE_BRIEF.md per-agent contract"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/scout.py"
      provides: "Real Tavily-driven Scout body — replaces Phase 4 stub"
      min_lines: 120
    - path: "packages/pipeline/tests/agents/test_scout.py"
      provides: "test_candidate_count + test_dedup + test_tool_limit assertions"
      contains: "test_dedup"
  key_links:
    - from: "agents/scout.py"
      to: "lib/search_client.web_search"
      via: "Tavily search wrapper (D-09)"
      pattern: "web_search\\("
    - from: "agents/scout.py"
      to: "Sanity GROQ archive query"
      via: "single read-once at scout start; populates featured_charity_keys (D-10)"
      pattern: "featured_charity_keys"
    - from: "agents/scout.py per-candidate loop"
      to: "Convex pitchLog:insert + Sanity write_charity"
      via: "three-datastore write order (Phase 4 D-18)"
      pattern: "pitchLog:insert"
---

<objective>
Replace the Phase 4 Scout stub body (which reads from `stubs.fixtures.scout_candidates()`) with a real Tavily-driven implementation. Scout is the first tool-using agent in the pipeline and the first plan to exercise the iteration-limit machinery (AGT-18) plus the dedup mechanism (AGT-04).

Three concerns:

1. **Tavily-driven discovery (AGT-03, D-09):** Scout uses `lib/search_client.web_search()` to run 1-3 Tavily searches (e.g. "obscure charity", "overlooked nonprofit", "small charity impact") and parses each `SearchResult` (url, title, content, score) into Pydantic-validated `CharityCandidate` objects via `ChatOpenAI.with_structured_output`. Returns 3-5 candidates total.

2. **Archive dedup (AGT-04, D-10):** First action is one GROQ query: `*[_type == "charity"]{ name, slug, website }`. Build `featured_charity_keys: set[str]` containing lowercase name, slug.current, and website-domain for each existing charity. Each Tavily candidate that case-insensitive-matches any key is dropped before write. The deduped set is also written into `state['featured_charity_keys']` (as a list for JSON-serialization safety per RESEARCH Pitfall 7).

3. **Iteration limit (AGT-18, D-21):** `@agent_node(name="scout", emit_event=None, max_tool_calls=8)` already locked in Phase 4. Scout's body must track the number of `web_search()` calls it makes and raise `AgentToolCallLimitExceeded` when it would exceed 8. The `_wrapper.py` decorator converts the exception into `deliberationEvents:insert` with `eventType='agent-tool-limit-exceeded'` (Plan 05-01 schema patch) and sets `pipelineRuns.status='failed'`.

Phase 4 Scout's three-datastore write order (Sanity `write_charity` first, then Convex `pitchLog:insert`) is preserved verbatim. Per CONTEXT D-20 Sanity failure halts the pipeline; Convex failure uses `convex_mutation_safe` (logs + continues).

Per RESEARCH §"Scout" lines 397-430 the Pydantic output per candidate is `CharityCandidate(name, location, website, assetRange, focusArea, missionStatement, scoutSummary, whyOverlooked)`. The Phase 4 fixture shape already matches — Scout's return dict must satisfy the existing TypedDict in `graph/state.py`.

Output: `agents/scout.py` replaced; `tests/agents/test_scout.py` skip markers removed; three real assertions land.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
@packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py
@packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py
@packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py
@docs/CLAUDE_CODE_BRIEF.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- lib/search_client.web_search signature (Plan 05-03) -->
```python
async def web_search(query: str, *, max_results: int = 5) -> list[SearchResult]:
    # SearchResult is a dataclass with: url, title, content, score
```

<!-- lib/openrouter_client.acomplete signature (Plan 05-03) -->
```python
content, usage = await acomplete("scout", messages, response_format=ScoutBatchOutput)
# usage = {"tokens_in": int, "tokens_out": int, "usd": float, "resolved_model": str}
```

<!-- AgentToolCallLimitExceeded exception — owned by lib/errors.py (Plan 05-03 Task 1) -->
```python
# In packages/pipeline/src/eisenbalm_pipeline/lib/errors.py:
class AgentToolCallLimitExceeded(Exception):
    """Raised when an @agent_node body exceeds its max_tool_calls budget (AGT-18).

    Constructor: AgentToolCallLimitExceeded(agent_id, attempts, limit).
    Stores .agent_id, .attempts, .limit attributes.
    """
```

<!-- @agent_node contract (locked Phase 4) — Scout already declared with max_tool_calls=8 -->
```python
@agent_node(name="scout", emit_event=None, max_tool_calls=8)
async def scout(state: DispatchState) -> DispatchState:
    ...
```

<!-- pitchLog:insert (API_CONTRACTS §3.3) -->
```python
await convex_mutation_safe("pitchLog:insert", {
    "runId": run_id,
    "charityId": charity_id,
    "charityName": candidate["name"],
    "charityLocation": candidate.get("location", ""),
    "charityWebsite": candidate.get("website"),
    "assetRange": candidate.get("assetRange"),
    "focusArea": candidate.get("focusArea"),
    "scoutSummary": candidate.get("scoutSummary", ""),
    "selected": False,
})
```

<!-- Sanity archive GROQ for dedup (D-10) -->
```groq
*[_type == "charity"]{ name, "slug": slug.current, website }
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace Scout stub body with real Tavily-driven implementation</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/scout.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py (Phase 4 stub — lines 1-69)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Per-Agent Prompt + Output Schema Sketches — Scout" lines 397-430
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Tavily Integration" lines 1270-1314
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Pitfall 7: Python set in DispatchState" lines 1618-1627
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-09 (Tavily), D-10 (single GROQ dedup), D-21 (max_tool_calls=8)
    - packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py (decorator contract — locked)
    - packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py (web_search + SearchResult)
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py (acomplete signature)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (groq_query + write_charity)
    - docs/CLAUDE_CODE_BRIEF.md lines 89-103 (Scout contract: 3-5 candidates, asset range, focus area, why-overlooked)
    - docs/API_CONTRACTS.md §3.3 (pitchLog:insert exact field list)
  </read_first>

  <behavior>
    - Test 1 (test_candidate_count): Mock `web_search` to return 7 Tavily results; mock `acomplete` to return a ScoutBatchOutput with 5 candidates; assert `state['candidates']` has length between 3 and 5 inclusive.
    - Test 2 (test_dedup): Pre-populate Sanity-mock GROQ result with `[{"name": "Foo Org", "slug": "foo-org", "website": "https://foo.example"}]`; mock the LLM to return candidates including "Foo Org" + new "Bar Org"; assert dedup drops "Foo Org" and keeps "Bar Org".
    - Test 3 (test_tool_limit_exceeded): Mock `web_search` such that it is called 9 times (exceeds max_tool_calls=8); assert `AgentToolCallLimitExceeded` is raised; assert decorator emits `deliberationEvents:insert` with `eventType='agent-tool-limit-exceeded'`.
    - Test 4 (test_featured_charity_keys_persisted): Assert returned state includes `featured_charity_keys: list[str]` populated from the GROQ result (list type, not set, per Pitfall 7).
  </behavior>

  <action>
  REPLACE the contents of `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` with the following. Copy the system prompt structure verbatim from RESEARCH §"Scout" — do NOT paraphrase the rejection rule or the tool-call budget:

  ```python
  """Phase 5 Scout — Tavily-driven charity discovery (Haiku via OpenRouter).

  Replaces Phase 4 stub. Responsibilities:

    1. Load featured-charity archive via one GROQ query (D-10 dedup source).
    2. Run 1-3 Tavily web searches against curated queries to surface candidates.
    3. Use OpenRouter (Haiku, low-temp) to parse Tavily results into structured
       CharityCandidate objects (AGT-03 schema).
    4. Filter out candidates matching featured_charity_keys (AGT-04).
    5. For each surviving candidate: write_charity to Sanity (idempotent
       deterministic _id), then pitchLog:insert to Convex (Phase 4 D-18 order).
    6. Enforce max_tool_calls=8 (AGT-18): a local counter increments before
       every web_search; raises AgentToolCallLimitExceeded when budget would
       be exceeded. @agent_node converts the exception into a
       deliberationEvents 'agent-tool-limit-exceeded' row + status='failed'.

  emit_event=None: the Phase 4 stub set this to None; per-candidate pitchLog
  rows are the observable per-finding records for the deliberation layer.
  Plan 05-07 (Advocate) emits the first 'advocate-argument' event downstream.
  """
  from __future__ import annotations

  from typing import Literal

  from pydantic import BaseModel, Field

  from eisenbalm_pipeline.agents._wrapper import agent_node
  from eisenbalm_pipeline.graph.state import DispatchState
  from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
  from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded
  from eisenbalm_pipeline.lib.openrouter_client import acomplete
  from eisenbalm_pipeline.lib.sanity_client import (
      get_client as get_sanity_http,
      groq_query,
      write_charity,
  )
  from eisenbalm_pipeline.lib.search_client import web_search, SearchResult


  SCOUT_QUERIES: tuple[str, ...] = (
      "obscure charity small nonprofit overlooked impact",
      "underfunded charitable foundation lesser-known",
      "small charity unique mission narrow focus",
  )


  class CharityCandidate(BaseModel):
      """AGT-03 per-candidate Pydantic shape (RESEARCH §Scout lines 416-426)."""
      name: str
      location: str
      website: str
      assetRange: str = Field(description="e.g. '<$100k', '$100k-$1M', '$1M-$10M'")
      focusArea: str
      missionStatement: str
      scoutSummary: str
      whyOverlooked: str


  class ScoutBatchOutput(BaseModel):
      """Top-level shape returned by the LLM after parsing Tavily results."""
      candidates: list[CharityCandidate] = Field(min_length=3, max_length=5)


  def _domain_of(url: str) -> str:
      """Extract bare domain (no scheme, no path) for dedup. Case-folded."""
      if not url:
          return ""
      no_scheme = url.split("://", 1)[-1]
      domain = no_scheme.split("/", 1)[0].lower()
      return domain[4:] if domain.startswith("www.") else domain


  def _candidate_keys(c: CharityCandidate) -> set[str]:
      """Lowercase name + lowercase domain — match keys used in featured set."""
      keys = {c.name.strip().lower()}
      d = _domain_of(c.website)
      if d:
          keys.add(d)
      return keys


  async def _load_featured_keys() -> list[str]:
      """One Sanity GROQ at Scout start (D-10). Returns list (JSON-safe per Pitfall 7).

      Keys: lowercase name, lowercase slug, lowercase website-domain.
      """
      query = '*[_type == "charity"]{ name, "slug": slug.current, website }'
      try:
          rows = await groq_query(query)
      except Exception:
          return []  # First-run safety — empty archive

      keys: set[str] = set()
      for row in rows:
          if row.get("name"):
              keys.add(row["name"].strip().lower())
          if row.get("slug"):
              keys.add(row["slug"].strip().lower())
          d = _domain_of(row.get("website", ""))
          if d:
              keys.add(d)
      return sorted(keys)  # deterministic order for testing


  def _build_messages(
      *, tavily_results: list[SearchResult], featured_keys: list[str]
  ) -> list[dict]:
      """System prompt embeds rejection rule + max_tool_calls budget verbatim
      from RESEARCH §Scout. featured_keys are interpolated for the LLM to use
      defensively (the real filter runs in Python after the model returns)."""
      results_block = "\n\n".join(
          f"URL: {r.url}\nTitle: {r.title}\nContent: {r.content[:600]}"
          for r in tavily_results
      )
      system = (
          "You are the Scout for The Eisenbalm Dispatch. You find obscure "
          "charities that deserve the Fortune-500 treatment. You reject "
          "anything Charity Navigator already ranks prominently.\n"
          "Return 3-5 candidates, never fewer.\n\n"
          "Preferred terms: 'obscure charity', 'overlooked nonprofit', "
          "'small charity impact'.\n"
          f"Reject any charity whose name or website domain appears in: "
          f"{featured_keys}\n\n"
          "Emit each candidate as soon as you have enough information — "
          "do not wait for all 5. Max tool calls: 8."
      )
      user = (
          "Parse the following Tavily search results into 3-5 CharityCandidate "
          "objects. Reject anything that does not look like a small or "
          "overlooked charity.\n\n"
          f"TAVILY RESULTS:\n{results_block}\n\n"
          "Return JSON ScoutBatchOutput with field `candidates` "
          "(list of 3-5 CharityCandidate objects)."
      )
      return [
          {"role": "system", "content": system},
          {"role": "user", "content": user},
      ]


  @agent_node(name="scout", emit_event=None, max_tool_calls=8)
  async def scout(state: DispatchState) -> DispatchState:
      run_id = state["run_id"]
      max_calls = 8  # mirrors @agent_node decorator parameter (AGT-18)

      # 1. Archive dedup load (D-10).
      featured_keys = await _load_featured_keys()
      featured_set = set(featured_keys)

      # 2. Tavily searches with iteration-limit enforcement (AGT-18).
      tavily_results: list[SearchResult] = []
      tool_calls = 0
      for query in SCOUT_QUERIES:
          if tool_calls >= max_calls:
              raise AgentToolCallLimitExceeded(
                  f"scout: exceeded max_tool_calls={max_calls} "
                  f"(attempts={tool_calls})"
              )
          tool_calls += 1
          batch = await web_search(query, max_results=5)
          tavily_results.extend(batch)

      # 3. LLM parses Tavily output into Pydantic-validated candidates.
      messages = _build_messages(
          tavily_results=tavily_results, featured_keys=featured_keys
      )
      batch_out, usage = await acomplete(
          "scout", messages, response_format=ScoutBatchOutput
      )

      candidates_raw = (
          batch_out.candidates if hasattr(batch_out, "candidates")
          else batch_out["candidates"]
      )

      # 4. Python-side dedup (defensive — model may ignore the system rule).
      surviving: list[dict] = []
      for cand in candidates_raw:
          c = cand if isinstance(cand, CharityCandidate) else CharityCandidate(**cand)
          keys = _candidate_keys(c)
          if keys & featured_set:
              continue
          surviving.append(c.model_dump())

      # 5. Sanity + Convex writes per Phase 4 D-18 order (verbatim from
      # Phase 4 stub: Sanity halts the pipeline on failure; Convex logs+continues).
      sanity_http = get_sanity_http()
      for candidate in surviving:
          try:
              charity_id = await write_charity(sanity_http, candidate)
          except Exception as exc:
              raise RuntimeError(
                  f"Sanity write_charity failed: {exc!r}"
              ) from exc

          await convex_mutation_safe(
              "pitchLog:insert",
              {
                  "runId": run_id,
                  "charityId": charity_id,
                  "charityName": candidate["name"],
                  "charityLocation": candidate.get("location", ""),
                  "charityWebsite": candidate.get("website"),
                  "assetRange": candidate.get("assetRange"),
                  "focusArea": candidate.get("focusArea"),
                  "scoutSummary": candidate.get("scoutSummary", ""),
                  "selected": False,
              },
          )

      # 6. AGT-17: record resolved model.
      model_versions = dict(state.get("model_versions") or {})
      model_versions["scout"] = usage["resolved_model"]

      return {
          **state,
          "candidates": surviving,
          "featured_charity_keys": featured_keys,  # list[str] for JSON safety
          "model_versions": model_versions,
      }
  ```

  **Import source for `AgentToolCallLimitExceeded`:** Plan 05-03 Task 1 ships `lib/errors.py` with BOTH `CostCapExceeded` and `AgentToolCallLimitExceeded`. The scout body MUST import via `from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded` (already shown in the file template above). Do NOT define `AgentToolCallLimitExceeded` inline in `agents/scout.py` — Plan 05-03 owns the canonical definition. If the import resolves at execution time, this plan is correctly sequenced after Plan 05-03 and no fallback is needed.

  The raise call site should use the 3-arg constructor per Plan 05-03 Task 1:
  ```python
  raise AgentToolCallLimitExceeded(
      agent_id="scout", attempts=tool_calls, limit=max_calls,
  )
  ```
  (Replace the `f"scout: exceeded max_tool_calls={max_calls} (attempts={tool_calls})"` single-arg raise shown in the file template above with this 3-arg form so call sites can introspect `.agent_id`, `.attempts`, `.limit`.)

  Sanity check: `EISENBALM_STUB_MODE=true python -c "from eisenbalm_pipeline.agents.scout import scout"` imports cleanly.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.scout import scout, _domain_of, _candidate_keys, SCOUT_QUERIES, CharityCandidate; assert _domain_of('https://www.foo.org/about') == 'foo.org'; assert _domain_of('http://bar.example/x') == 'bar.example'; c = CharityCandidate(name='Foo Org', location='NYC', website='https://foo.org', assetRange='<1M', focusArea='education', missionStatement='m', scoutSummary='s', whyOverlooked='o'); assert 'foo org' in _candidate_keys(c); assert len(SCOUT_QUERIES) >= 1; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/scout.py` imports `web_search` from `lib.search_client`
    - `agents/scout.py` imports `acomplete` from `lib.openrouter_client`
    - `agents/scout.py` imports `groq_query` from `lib.sanity_client`
    - `grep -c 'AgentToolCallLimitExceeded' agents/scout.py` returns ≥ 2 (import + raise)
    - `grep -c 'max_tool_calls=8' agents/scout.py` returns ≥ 1
    - `_domain_of('https://www.foo.org/about')` returns `'foo.org'`
    - `_candidate_keys(CharityCandidate(...))` returns a set including the lowercase name and domain
    - Function signature unchanged: `async def scout(state: DispatchState) -> DispatchState`
    - Decorator unchanged: `@agent_node(name="scout", emit_event=None, max_tool_calls=8)`
    - Return dict contains `candidates`, `featured_charity_keys` (list, NOT set), and `model_versions`
    - `featured_charity_keys` is `list[str]` (not `set`) — verify by inspecting the return type annotation in the file
  </acceptance_criteria>

  <done>
  Scout runs against real Tavily (Haiku via OpenRouter), filters against the Sanity archive, writes surviving candidates to Sanity + Convex, and respects max_tool_calls=8.
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace test_scout.py skip-skeletons with real assertions</name>
  <files>packages/pipeline/tests/agents/test_scout.py</files>

  <read_first>
    - packages/pipeline/tests/agents/test_scout.py (Plan 05-04 skeleton — remove skip markers)
    - packages/pipeline/tests/conftest.py (mock_openrouter_acomplete, mock_tavily_search, mock_sanity_groq fixtures)
    - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py (just-implemented from Task 1)
    - .planning/phases/05-agent-quality/05-VALIDATION.md (AGT-03, AGT-04, AGT-18 row commands)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Phase Requirements to Test Map" lines 1505-1525
  </read_first>

  <action>
  REPLACE `packages/pipeline/tests/agents/test_scout.py` with:

  ```python
  """Phase 5 Scout unit tests — implemented by Plan 05-06.

  Validation: AGT-03 (candidate count), AGT-04 (dedup), AGT-18 (tool limit),
  AGT-17 (modelVersions recording).
  """
  from __future__ import annotations

  from unittest.mock import AsyncMock, patch

  import pytest

  from eisenbalm_pipeline.agents.scout import (
      CharityCandidate,
      ScoutBatchOutput,
      _candidate_keys,
      _domain_of,
      scout,
  )
  from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded
  from eisenbalm_pipeline.lib.search_client import SearchResult


  def _make_candidate(name: str, website: str) -> CharityCandidate:
      return CharityCandidate(
          name=name, location="NYC", website=website,
          assetRange="<$1M", focusArea="education",
          missionStatement="m", scoutSummary="s", whyOverlooked="o",
      )


  def test_domain_of() -> None:
      assert _domain_of("https://www.foo.org/about") == "foo.org"
      assert _domain_of("http://bar.example/x") == "bar.example"
      assert _domain_of("") == ""


  @pytest.mark.asyncio
  async def test_candidate_count(sample_dispatch_state) -> None:
      """AGT-03: Scout returns 3-5 candidates."""
      five = [_make_candidate(f"Org {i}", f"https://org{i}.example") for i in range(5)]
      batch = ScoutBatchOutput(candidates=five)
      tavily_results = [
          SearchResult(url=f"https://org{i}.example", title=f"Org {i}",
                       content="...", score=0.9)
          for i in range(7)
      ]

      with patch(
          "eisenbalm_pipeline.agents.scout.web_search",
          AsyncMock(return_value=tavily_results),
      ), patch(
          "eisenbalm_pipeline.agents.scout.acomplete",
          AsyncMock(return_value=(batch, {
              "tokens_in": 100, "tokens_out": 50, "usd": 0.01,
              "resolved_model": "anthropic/claude-haiku-4-5",
          })),
      ), patch(
          "eisenbalm_pipeline.agents.scout._load_featured_keys",
          AsyncMock(return_value=[]),
      ), patch(
          "eisenbalm_pipeline.agents.scout.write_charity",
          AsyncMock(side_effect=lambda http, c: f"charity-{c['name'].lower().replace(' ', '-')}"),
      ), patch(
          "eisenbalm_pipeline.agents.scout.convex_mutation_safe",
          AsyncMock(),
      ), patch(
          "eisenbalm_pipeline.agents.scout.get_sanity_http", return_value=None,
      ):
          result = await scout(sample_dispatch_state)

      assert 3 <= len(result["candidates"]) <= 5


  @pytest.mark.asyncio
  async def test_dedup(sample_dispatch_state) -> None:
      """AGT-04: Scout filters candidates matching featured archive."""
      featured = ["foo org", "foo-org", "foo.example"]
      cands = [
          _make_candidate("Foo Org", "https://foo.example"),
          _make_candidate("Bar Org", "https://bar.example"),
          _make_candidate("Baz Org", "https://baz.example"),
          _make_candidate("Qux Org", "https://qux.example"),
      ]
      batch = ScoutBatchOutput(candidates=cands)

      with patch(
          "eisenbalm_pipeline.agents.scout.web_search",
          AsyncMock(return_value=[]),
      ), patch(
          "eisenbalm_pipeline.agents.scout.acomplete",
          AsyncMock(return_value=(batch, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-haiku-4-5",
          })),
      ), patch(
          "eisenbalm_pipeline.agents.scout._load_featured_keys",
          AsyncMock(return_value=featured),
      ), patch(
          "eisenbalm_pipeline.agents.scout.write_charity",
          AsyncMock(side_effect=lambda http, c: f"charity-{c['name'].lower().replace(' ', '-')}"),
      ), patch(
          "eisenbalm_pipeline.agents.scout.convex_mutation_safe", AsyncMock(),
      ), patch(
          "eisenbalm_pipeline.agents.scout.get_sanity_http", return_value=None,
      ):
          result = await scout(sample_dispatch_state)

      names = {c["name"] for c in result["candidates"]}
      assert "Foo Org" not in names, "dedup must drop matched name"
      assert {"Bar Org", "Baz Org", "Qux Org"}.issubset(names) or len(names) >= 3
      # featured_charity_keys persisted as list (JSON-safe per Pitfall 7)
      assert isinstance(result["featured_charity_keys"], list)


  @pytest.mark.asyncio
  async def test_tool_limit_exceeded(sample_dispatch_state) -> None:
      """AGT-18: Scout raises AgentToolCallLimitExceeded when web_search budget exceeded.

      Synthesize the overrun by patching SCOUT_QUERIES to 9 entries (>8).
      """
      from eisenbalm_pipeline.agents import scout as scout_mod

      nine_queries = tuple(f"q{i}" for i in range(9))
      with patch.object(scout_mod, "SCOUT_QUERIES", nine_queries), patch(
          "eisenbalm_pipeline.agents.scout.web_search",
          AsyncMock(return_value=[]),
      ), patch(
          "eisenbalm_pipeline.agents.scout._load_featured_keys",
          AsyncMock(return_value=[]),
      ):
          with pytest.raises(AgentToolCallLimitExceeded):
              await scout(sample_dispatch_state)
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_scout.py -x -v 2>&1 | tail -30</automated>
  </verify>

  <acceptance_criteria>
    - `pytest tests/agents/test_scout.py -x` exits 0 with ≥4 tests passing
    - No `@pytest.mark.skip` decorator remains in the file
    - `test_candidate_count` asserts `3 <= len(result['candidates']) <= 5`
    - `test_dedup` asserts `'Foo Org' not in names`
    - `test_tool_limit_exceeded` asserts `pytest.raises(AgentToolCallLimitExceeded)`
    - `grep -c 'featured_charity_keys' tests/agents/test_scout.py` returns ≥ 1
  </acceptance_criteria>

  <done>
  Scout test suite verifies AGT-03 + AGT-04 + AGT-18 mechanically. Plan 05-14's real-mode integration test inherits these guarantees.
  </done>
</task>

</tasks>

<verification>
- `EISENBALM_STUB_MODE=true pytest tests/agents/test_scout.py -x` exits 0
- `EISENBALM_STUB_MODE=true pytest tests/ -x -q --timeout=30` exits 0 (no regression)
- `grep -c 'web_search' packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` returns ≥ 1
- `grep -c 'AgentToolCallLimitExceeded' packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` returns ≥ 2
</verification>

<success_criteria>
- Scout body is real (no fixture import path)
- Tavily wraps Scout's discovery
- Dedup filters featured charities
- max_tool_calls=8 enforced; overrun raises AgentToolCallLimitExceeded
- modelVersions['scout'] populated after every run
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-06-scout-SUMMARY.md`.
</output>
