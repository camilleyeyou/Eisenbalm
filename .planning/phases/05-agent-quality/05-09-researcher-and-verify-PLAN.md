---
phase: 05-agent-quality
plan: 09
type: execute
wave: 4
depends_on:
  - "05-08"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/verify.py
  - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
  - packages/pipeline/tests/agents/test_researcher.py
  - packages/pipeline/tests/agents/test_verify.py
autonomous: true
requirements_addressed:
  - AGT-07
  - AGT-08
  - AGT-09
  - AGT-18
must_haves:
  truths:
    - "Researcher uses Tavily (lib/search_client.web_search) deep-dive on the winning charity (AGT-07)"
    - "Researcher emits founderName + founderNameSourceUrl + subjectName + subjectNameSourceUrl in ResearchOutputModel (AGT-07)"
    - "Researcher max_tool_calls=12 (AGT-18 enforced inside body); overrun raises AgentToolCallLimitExceeded"
    - "verify_research is a STANDALONE node (no @agent_node, no LLM, no deliberationEvents emission) (D-11)"
    - "verify_research fetches founderNameSourceUrl via httpx (10s timeout, follow_redirects), strips HTML via selectolax, sets founderNameVerified bool"
    - "verify_research uses case-insensitive substring + last-name fallback; httpx errors leave verified=false (AGT-08)"
    - "graph/builder.py inserts verify_research node between Researcher and the parallel fan-out"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py"
      provides: "Real Tavily-driven Researcher body — replaces Phase 4 stub"
      min_lines: 140
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/verify.py"
      provides: "Standalone verify_research node (no @agent_node)"
      min_lines: 60
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/builder.py"
      provides: "verify_research inserted between researcher and fan-out"
      contains: "verify_research"
  key_links:
    - from: "agents/researcher.py"
      to: "lib/search_client.web_search"
      via: "Tavily wrapper (D-09); max_tool_calls=12 budget (AGT-18)"
      pattern: "web_search"
    - from: "agents/verify.py"
      to: "selectolax.parser.HTMLParser + httpx.AsyncClient"
      via: "fetch + strip + case-insensitive substring match (D-11)"
      pattern: "selectolax"
    - from: "graph/builder.py"
      to: "verify_research node"
      via: "graph.add_node + graph.add_edge('researcher', 'verify_research')"
      pattern: "add_node.*verify_research"
---

<objective>
Replace the Phase 4 Researcher stub with a real Tavily-driven implementation AND insert the new standalone `verify_research` node into the graph topology. This plan covers four requirements together because they form a single dataflow contract: Researcher emits names + source URLs; verify_research fetches the URLs and sets the `*Verified` booleans; downstream section writers (Plan 05-10) consume those booleans to choose between named and role-framed prose.

Three concerns:

1. **Researcher Tavily deep-dive (AGT-07, AGT-18):** Researcher receives `state['winning_charity']` from Editor gate 1. Uses Tavily to investigate official website, founding year, annual budget, one case study subject, and key statistics. Emits `ResearchOutputModel` Pydantic with `founderName, founderNameSourceUrl, founderRole, subjectName, subjectNameSourceUrl, subjectRole` plus narrative fields. **`max_tool_calls=12`** enforced via a local counter inside the body that raises `AgentToolCallLimitExceeded` (decorator parameter mirrors).

2. **verify_research standalone node (AGT-08, D-11):** A new non-`@agent_node` async function in `agents/verify.py`. NO LLM call. NO deliberationEvents emission. Just `httpx.AsyncClient(timeout=10.0, follow_redirects=True, User-Agent: Mozilla/5.0)` GET, `selectolax.parser.HTMLParser` text strip, case-insensitive substring search with last-name fallback. Same logic applied to both `founderName/founderNameSourceUrl/founderNameVerified` and `subjectName/subjectNameSourceUrl/subjectNameVerified`.

3. **Graph topology insertion:** `graph/builder.py` currently has `graph.add_edge("researcher", "<section_writer>")` for each of the 7 section writers. Replace those direct edges with `graph.add_edge("researcher", "verify_research")` + `graph.add_edge("verify_research", "<section_writer>")` for each writer.

Voice-isolation contract for downstream section writers (AGT-09) is established here because the research dict is the upstream input that `lib/voice.build_section_writer_prompt()` receives. When `founderNameVerified=False`, Researcher's `founderName` field is NOT cleared (it's source data) — but Plan 05-10 will null it out before passing to the writer per RESEARCH §"FounderBioWriter" line 637.

Output: 3 files (researcher.py replace, verify.py new, builder.py patch) + 2 test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
@packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py
@packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py
@docs/CLAUDE_CODE_BRIEF.md

<interfaces>
<!-- ResearchOutputModel Pydantic (RESEARCH §"Researcher" lines 552-567) -->
```python
class ResearchOutputModel(BaseModel):
    summary: str
    foundingYear: int | None = None
    annualBudget: str | None = None
    founderName: str | None = None
    founderNameSourceUrl: str | None = None
    founderRole: str = "founder"
    founderBio: str
    subjectName: str | None = None
    subjectNameSourceUrl: str | None = None
    subjectRole: str = "a program participant"
    subjectStory: str
    keyStatistics: list[str]
    fundingSources: list[str]
```

<!-- verify_research (RESEARCH §"Pattern 3" lines 300-343) -->
```python
async def verify_research(state: DispatchState) -> dict:
    """Standalone node — no @agent_node. Sets *Verified bools."""
    ...
    return {"research": research}
```

<!-- httpx + selectolax (RESEARCH §"Pattern 3") -->
```python
async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
    r = await client.get(url, headers={"User-Agent": "Mozilla/5.0 ..."})
    r.raise_for_status()
tree = HTMLParser(r.text)
text = " ".join(n.text() for n in tree.css("body *") if n.text())
```

<!-- graph/builder.py current topology -->
<!-- researcher → (section_writers in parallel) -->
<!-- Phase 5 inserts: researcher → verify_research → (section_writers in parallel) -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Replace Researcher stub body with real Tavily-driven implementation</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py (Phase 4 stub)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Researcher" lines 530-570
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-09 (Tavily), D-11 (verification fields), D-21 (max_tool_calls=12)
    - packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py (web_search)
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py (acomplete)
    - docs/CLAUDE_CODE_BRIEF.md lines 140-156 (Researcher contract)
  </read_first>

  <behavior>
    - Test 1 (test_founder_fields): Mock web_search returning charity-website content with founder info; mock acomplete returning ResearchOutputModel with founderName + founderNameSourceUrl. Assert returned state['research']['founderName'] and ['founderNameSourceUrl'] populated.
    - Test 2 (test_tool_limit_exceeded): Force web_search calls to exceed 12; assert `AgentToolCallLimitExceeded` raised.
    - Test 3 (test_model_version_recorded): Assert `state['model_versions']['researcher']` populated.
  </behavior>

  <action>
  REPLACE `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` with:

  ```python
  """Phase 5 Researcher — Tavily-driven deep-dive (Sonnet via OpenRouter).

  Replaces Phase 4 stub. Responsibilities:

    1. Receive state['winning_charity'] from Editor gate 1.
    2. Run up to 12 Tavily searches (D-21) on official website, founder, case-
       study subject, statistics, funding.
    3. Use Sonnet (low-temp) to parse Tavily results into ResearchOutputModel
       (AGT-07 schema). MUST emit founderName + founderNameSourceUrl pointing
       to a page on the charity's own domain (or null + role-only).
    4. Enforce max_tool_calls=12 (AGT-18); overrun raises
       AgentToolCallLimitExceeded which @agent_node converts to
       eventType='agent-tool-limit-exceeded'.
    5. Record resolved model into state['model_versions']['researcher'].

  emit_event='section-draft': decorator emits one deliberationEvents row with
  eventType='section-draft' on the success path (research IS a kind of
  section-draft for purposes of live deliberation visualization).
  """
  from __future__ import annotations

  from pydantic import BaseModel, Field

  from eisenbalm_pipeline.agents._wrapper import agent_node
  from eisenbalm_pipeline.graph.state import DispatchState
  from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded
  from eisenbalm_pipeline.lib.openrouter_client import acomplete
  from eisenbalm_pipeline.lib.search_client import SearchResult, web_search
  from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS


  MAX_TOOL_CALLS: int = 12  # AGT-18 / D-21


  class ResearchOutputModel(BaseModel):
      """AGT-07 output (RESEARCH §"Researcher" lines 552-567)."""
      summary: str
      foundingYear: int | None = None
      annualBudget: str | None = None
      founderName: str | None = None
      founderNameSourceUrl: str | None = None
      founderRole: str = "founder"
      founderBio: str
      subjectName: str | None = None
      subjectNameSourceUrl: str | None = None
      subjectRole: str = "a program participant"
      subjectStory: str
      keyStatistics: list[str] = Field(default_factory=list)
      fundingSources: list[str] = Field(default_factory=list)


  def _build_queries(charity: dict) -> list[str]:
      """Five candidate queries; cap fan-out via the max_tool_calls counter."""
      name = charity.get("name", "")
      website = charity.get("website", "")
      domain = website.split("://", 1)[-1].split("/", 1)[0] if website else ""
      return [
          f"{name} founder about page site:{domain}" if domain else f"{name} founder",
          f"{name} mission history founding year",
          f"{name} annual report budget revenue",
          f"{name} program participant case study",
          f"{name} key statistics impact",
      ]


  def _build_messages(
      *, charity: dict, tavily_results: list[SearchResult]
  ) -> list[dict]:
      """System prompt embeds verification + role-fallback rules verbatim
      from RESEARCH §"Researcher" lines 533-549."""
      results_block = "\n\n---\n\n".join(
          f"URL: {r.url}\nTitle: {r.title}\nContent: {r.content[:1200]}"
          for r in tavily_results
      )
      system = (
          "You are the Researcher for The Eisenbalm Dispatch. Deep-dive the "
          "winning charity. You will not name a founder without a source URL "
          "on the charity's own website. Falls back to anonymous framing "
          "rather than guess.\n\n"
          "VOICE CONSTRAINTS (apply to summary and bio fields):\n"
          f"{VOICE_CONSTRAINTS}\n\n"
          "For founderName: MUST provide founderNameSourceUrl pointing to "
          "the specific page where the name appears on the charity's own "
          "domain. If no verifiable source found, set founderName=null "
          "and provide founderRole (the role title only). Same rule applies "
          "to subjectName/subjectNameSourceUrl/subjectRole for the case "
          "study subject (a beneficiary, program graduate, or similar)."
      )
      user = (
          f"WINNING CHARITY:\n{charity}\n\n"
          f"TAVILY RESEARCH RESULTS:\n{results_block}\n\n"
          "Return JSON ResearchOutputModel with all narrative fields filled "
          "and all source-URL fields either populated (pointing to charity's "
          "own domain) or null."
      )
      return [
          {"role": "system", "content": system},
          {"role": "user", "content": user},
      ]


  @agent_node(name="researcher", emit_event="section-draft", max_tool_calls=12)
  async def researcher(state: DispatchState) -> DispatchState:
      charity = state.get("winning_charity") or {}
      if not charity:
          raise RuntimeError(
              "researcher: state['winning_charity'] missing — Editor gate 1 "
              "must run first."
          )

      queries = _build_queries(charity)

      # AGT-18: Enforce max_tool_calls=12 across all web_search calls.
      tool_calls = 0
      tavily_results: list[SearchResult] = []
      for q in queries:
          if tool_calls >= MAX_TOOL_CALLS:
              # Plan 05-03 Task 1 — 3-arg constructor for introspection.
              raise AgentToolCallLimitExceeded(
                  agent_id="researcher", attempts=tool_calls, limit=MAX_TOOL_CALLS,
              )
          tool_calls += 1
          batch = await web_search(q, max_results=4)
          tavily_results.extend(batch)

      messages = _build_messages(charity=charity, tavily_results=tavily_results)
      out_obj, usage = await acomplete(
          "researcher", messages, response_format=ResearchOutputModel,
      )

      research_dict = (
          out_obj.model_dump() if hasattr(out_obj, "model_dump") else dict(out_obj)
      )

      # AGT-17: record resolved model.
      model_versions = dict(state.get("model_versions") or {})
      model_versions["researcher"] = usage["resolved_model"]

      return {
          **state,
          "research": research_dict,
          "model_versions": model_versions,
      }
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.researcher import researcher, ResearchOutputModel, MAX_TOOL_CALLS, _build_queries; assert MAX_TOOL_CALLS == 12; assert len(_build_queries({'name': 'Foo', 'website': 'https://foo.org'})) >= 4; r = ResearchOutputModel(summary='s', founderBio='b', subjectStory='ss'); assert r.founderRole == 'founder'; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/researcher.py` defines `MAX_TOOL_CALLS = 12`
    - `agents/researcher.py` imports `web_search` from `lib.search_client`
    - `agents/researcher.py` imports `acomplete` from `lib.openrouter_client`
    - `agents/researcher.py` imports `AgentToolCallLimitExceeded`
    - `ResearchOutputModel` includes `founderName, founderNameSourceUrl, founderRole, subjectName, subjectNameSourceUrl, subjectRole` (D-11 contract)
    - Decorator: `@agent_node(name="researcher", emit_event="section-draft", max_tool_calls=12)`
    - Return dict contains `research` + `model_versions`
  </acceptance_criteria>

  <done>
  Researcher runs against real OpenRouter (Sonnet) + Tavily; emits ResearchOutputModel with source-URL fields populated; respects max_tool_calls=12.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Create agents/verify.py standalone verify_research node</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/verify.py</files>

  <read_first>
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Pattern 3: verify_research Standalone Node" lines 299-343
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-11 (verification algorithm), D-12 (anonymous fallback semantics)
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py (DispatchState shape; research TypedDict)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"State Extensions Required" lines 1441-1464 (founderNameVerified, subjectNameVerified fields)
  </read_first>

  <behavior>
    - Test 1 (test_verify_match_full_name): Mock httpx returning HTML with "Jane Doe is the founder…"; founderName="Jane Doe"; assert founderNameVerified=True.
    - Test 2 (test_verify_match_last_name_fallback): Mock httpx returning HTML with "…contact Doe at…"; founderName="Jane Doe"; assert founderNameVerified=True (last-name fallback succeeds).
    - Test 3 (test_verify_no_match): Mock httpx returning HTML with no founder name; assert founderNameVerified=False.
    - Test 4 (test_verify_httpx_error): Mock httpx raising httpx.HTTPError; assert founderNameVerified=False (conservative fallback).
    - Test 5 (test_verify_null_name): Researcher emitted founderName=None; assert founderNameVerified=False (no name to verify).
    - Test 6 (test_subject_name_parallel): Same five behaviors applied to subjectName/subjectNameSourceUrl/subjectNameVerified.
  </behavior>

  <action>
  CREATE `packages/pipeline/src/eisenbalm_pipeline/agents/verify.py`:

  ```python
  """Phase 5 verify_research — standalone non-LLM node (D-11).

  Inserted between Researcher and the parallel section-writer fan-out by
  graph/builder.py. Reads state['research']['founderName'] +
  ['founderNameSourceUrl'] (and the subject equivalents), fetches the source
  URL via httpx (10s timeout, follow_redirects, desktop User-Agent), strips
  HTML to text via selectolax, and sets *Verified bools via case-insensitive
  substring + last-name fallback.

  NOT an @agent_node:
    - No LLM call.
    - No deliberationEvents emission (per CONTEXT D-11 explicit note).
    - No cost recording (no tokens consumed).

  Conservative posture: httpx errors (timeout, 4xx/5xx, SSL, DNS) leave
  verified=False. False negatives are acceptable; false positives (wrong
  name confirmed) ship factual errors and are not (AGT-08).
  """
  from __future__ import annotations

  import httpx
  from selectolax.parser import HTMLParser

  from eisenbalm_pipeline.graph.state import DispatchState


  _FETCH_TIMEOUT_S: float = 10.0
  _USER_AGENT: str = "Mozilla/5.0 (compatible; EisenbalmBot/1.0)"


  async def _fetch_text(url: str) -> str | None:
      """GET + strip. Returns None on any failure."""
      try:
          async with httpx.AsyncClient(
              timeout=_FETCH_TIMEOUT_S, follow_redirects=True,
          ) as client:
              r = await client.get(url, headers={"User-Agent": _USER_AGENT})
              r.raise_for_status()
          tree = HTMLParser(r.text)
          parts = [n.text() for n in tree.css("body *") if n.text()]
          return " ".join(parts) if parts else None
      except Exception:
          return None


  def _name_in_text(name: str, text: str) -> bool:
      """Case-insensitive substring + last-name fallback (D-11)."""
      if not name or not text:
          return False
      if name.lower() in text.lower():
          return True
      tokens = name.strip().split()
      if not tokens:
          return False
      last = tokens[-1]
      return last.lower() in text.lower()


  async def verify_research(state: DispatchState) -> dict:
      """Set founderNameVerified + subjectNameVerified on state['research']."""
      research = dict(state.get("research") or {})

      for name_field, url_field, verified_field in [
          ("founderName", "founderNameSourceUrl", "founderNameVerified"),
          ("subjectName", "subjectNameSourceUrl", "subjectNameVerified"),
      ]:
          name = research.get(name_field)
          url = research.get(url_field)
          if name and url:
              text = await _fetch_text(url)
              research[verified_field] = bool(text and _name_in_text(name, text))
          else:
              research[verified_field] = False

      return {"research": research}
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.agents.verify import verify_research, _name_in_text, _fetch_text; assert _name_in_text('Jane Doe', 'Jane Doe is the founder') is True; assert _name_in_text('Jane Doe', 'contact Doe at info@x.org') is True; assert _name_in_text('Jane Doe', 'no founder mentioned here') is False; assert _name_in_text('', 'whatever') is False; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `agents/verify.py` defines `verify_research` as plain `async def` (NOT `@agent_node`)
    - `verify_research` does NOT import `agent_node` or `convex_mutation_safe` (verify by grep)
    - `_fetch_text` uses `httpx.AsyncClient(timeout=10.0, follow_redirects=True)`
    - `_fetch_text` sets `User-Agent: Mozilla/5.0 (compatible; EisenbalmBot/1.0)`
    - `_fetch_text` returns `None` on any exception
    - `_name_in_text('Jane Doe', '...Doe...')` returns `True` (last-name fallback)
    - `verify_research` sets both `founderNameVerified` and `subjectNameVerified` bool fields
    - `selectolax` is imported (not BeautifulSoup, not lxml)
  </acceptance_criteria>

  <done>
  verify_research is a working standalone node ready for graph topology insertion in Task 4.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Create tests/agents/test_verify.py</name>
  <files>packages/pipeline/tests/agents/test_verify.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/verify.py (just-implemented from Task 2)
    - packages/pipeline/tests/conftest.py
  </read_first>

  <action>
  CREATE `packages/pipeline/tests/agents/test_verify.py`:

  ```python
  """Phase 5 verify_research unit tests — implemented by Plan 05-09.

  Validation: AGT-08 (verification logic + httpx error fallback).
  """
  from __future__ import annotations

  from unittest.mock import AsyncMock, patch

  import pytest

  from eisenbalm_pipeline.agents.verify import _name_in_text, verify_research


  def test_name_in_text_full_match() -> None:
      assert _name_in_text("Jane Doe", "Jane Doe founded the organization") is True


  def test_name_in_text_last_name_fallback() -> None:
      assert _name_in_text("Jane Doe", "Contact Doe at the office") is True


  def test_name_in_text_no_match() -> None:
      assert _name_in_text("Jane Doe", "The organization was founded in 2003") is False


  def test_name_in_text_empty() -> None:
      assert _name_in_text("", "anything") is False
      assert _name_in_text("Jane", "") is False


  @pytest.mark.asyncio
  async def test_verify_match() -> None:
      state = {
          "research": {
              "founderName": "Jane Doe",
              "founderNameSourceUrl": "https://foo.example/about",
              "subjectName": None,
              "subjectNameSourceUrl": None,
          }
      }
      with patch(
          "eisenbalm_pipeline.agents.verify._fetch_text",
          AsyncMock(return_value="Jane Doe founded this in 2003."),
      ):
          out = await verify_research(state)

      assert out["research"]["founderNameVerified"] is True
      assert out["research"]["subjectNameVerified"] is False  # no name to verify


  @pytest.mark.asyncio
  async def test_verify_no_match() -> None:
      state = {
          "research": {
              "founderName": "Jane Doe",
              "founderNameSourceUrl": "https://foo.example/about",
          }
      }
      with patch(
          "eisenbalm_pipeline.agents.verify._fetch_text",
          AsyncMock(return_value="The organization was founded in 2003."),
      ):
          out = await verify_research(state)
      assert out["research"]["founderNameVerified"] is False


  @pytest.mark.asyncio
  async def test_verify_httpx_error_is_unverified() -> None:
      """AGT-08: httpx error leaves founderNameVerified=False (conservative)."""
      state = {
          "research": {
              "founderName": "Jane Doe",
              "founderNameSourceUrl": "https://foo.example/about",
          }
      }
      with patch(
          "eisenbalm_pipeline.agents.verify._fetch_text",
          AsyncMock(return_value=None),  # _fetch_text returns None on any failure
      ):
          out = await verify_research(state)
      assert out["research"]["founderNameVerified"] is False


  @pytest.mark.asyncio
  async def test_verify_subject_parallel() -> None:
      """Same verification logic applied to subjectName."""
      state = {
          "research": {
              "founderName": None,
              "subjectName": "Alex Park",
              "subjectNameSourceUrl": "https://foo.example/stories/alex",
          }
      }
      with patch(
          "eisenbalm_pipeline.agents.verify._fetch_text",
          AsyncMock(return_value="Alex came to the program in 2019."),
      ):
          out = await verify_research(state)
      assert out["research"]["subjectNameVerified"] is True  # last-name fallback ('Park' not in text but 'Alex' is)
  ```

  Note: the last test uses the FULL-name path; `_name_in_text('Alex Park', 'Alex came...')` matches via full-name substring check (no — `'alex park' in 'alex came...'` is False; only last-name `'park'` is checked next, but `'park'` is not in the mocked text either). To make this test meaningful, change the mocked HTML to `"Alex Park came to the program in 2019."` — fix at write time.

  Correction: ensure the final test's mocked HTML contains the full name `"Alex Park came to the program in 2019."` so `_name_in_text` returns True via the full-name substring branch.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_verify.py -x -v 2>&1 | tail -30</automated>
  </verify>

  <acceptance_criteria>
    - `pytest tests/agents/test_verify.py -x` exits 0 with ≥6 tests passing
    - Last-name fallback test asserts `_name_in_text('Jane Doe', 'Contact Doe at...') is True`
    - httpx-error test asserts `founderNameVerified is False` when `_fetch_text` returns None
    - subject-parallel test asserts `subjectNameVerified` set correctly
  </acceptance_criteria>

  <done>
  verify_research test coverage proves AGT-08 mechanics.
  </done>
</task>

<task type="auto">
  <name>Task 4: Patch graph/builder.py — insert verify_research between researcher and fan-out</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/builder.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/graph/builder.py (whole file — confirm current researcher → writer edges)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"graph/builder.py — verify_research Insertion" lines 1468-1487
    - packages/pipeline/src/eisenbalm_pipeline/agents/verify.py (just-implemented)
  </read_first>

  <action>
  Edit `graph/builder.py` to:

  1. Add import: `from eisenbalm_pipeline.agents.verify import verify_research`
  2. Add node: `graph.add_node("verify_research", verify_research)`
  3. Replace every existing `graph.add_edge("researcher", "<section_writer>")` with:
     - One edge `graph.add_edge("researcher", "verify_research")` (deduplicated — only ONE such edge in total)
     - For each section writer (origin_story, problem, founder_bio, case_study, game, bonus, design): `graph.add_edge("verify_research", "<writer>")`

  Where SECTION_WRITERS is currently a list/constant in builder.py, replace its iteration. Approximate the edit pattern:

  ```python
  # OLD:
  for writer in SECTION_WRITERS:
      graph.add_edge("researcher", writer)

  # NEW:
  graph.add_edge("researcher", "verify_research")
  for writer in SECTION_WRITERS:
      graph.add_edge("verify_research", writer)
  ```

  Do NOT touch any other edges, nodes, or interrupt points. The change is surgical — one node + N+1 edges replacing N direct edges.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && grep -c 'verify_research' src/eisenbalm_pipeline/graph/builder.py | awk '$1 >= 3 {print "OK"; exit} {print "FAIL"; exit 1}'</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c 'verify_research' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` returns ≥ 3 (import + add_node + add_edge)
    - `grep -c 'from eisenbalm_pipeline.agents.verify import verify_research' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` returns 1
    - `grep -c 'add_node("verify_research"' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` returns ≥ 1
    - `grep -c 'add_edge("researcher", "verify_research")' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` returns ≥ 1
    - No direct `add_edge("researcher", "<writer>")` lines remain (verify by grep)
    - Pipeline still builds: `EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.graph.builder import build_graph; build_graph()"` exits 0
  </acceptance_criteria>

  <done>
  graph topology updated; verify_research runs between Researcher and the parallel section fan-out.
  </done>
</task>

<task type="auto">
  <name>Task 5: Replace test_researcher.py skip-skeletons with real assertions</name>
  <files>packages/pipeline/tests/agents/test_researcher.py</files>

  <read_first>
    - packages/pipeline/tests/agents/test_researcher.py (Plan 05-04 skeleton)
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py (just-implemented from Task 1)
  </read_first>

  <action>
  REPLACE `packages/pipeline/tests/agents/test_researcher.py` with:

  ```python
  """Phase 5 Researcher unit tests — implemented by Plan 05-09.

  Validation: AGT-07 (founder fields), AGT-18 (tool limit), AGT-17 (modelVersions).
  """
  from __future__ import annotations

  from unittest.mock import AsyncMock, patch

  import pytest

  from eisenbalm_pipeline.agents.researcher import (
      MAX_TOOL_CALLS,
      ResearchOutputModel,
      researcher,
  )
  from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded


  def _make_research(founder: str | None = "Jane Doe") -> ResearchOutputModel:
      return ResearchOutputModel(
          summary="summary text",
          foundingYear=2003,
          annualBudget="$500k",
          founderName=founder,
          founderNameSourceUrl="https://foo.example/about" if founder else None,
          founderRole="founder",
          founderBio="bio text",
          subjectName="Alex Park",
          subjectNameSourceUrl="https://foo.example/stories/alex",
          subjectRole="a program participant",
          subjectStory="story text",
          keyStatistics=["a", "b"],
          fundingSources=["donors"],
      )


  @pytest.mark.asyncio
  async def test_founder_fields(sample_dispatch_state) -> None:
      """AGT-07: Researcher emits founderName + founderNameSourceUrl."""
      sample_dispatch_state["winning_charity"] = {
          "name": "Foo Org", "website": "https://foo.org",
      }
      out = _make_research("Jane Doe")

      with patch(
          "eisenbalm_pipeline.agents.researcher.web_search",
          AsyncMock(return_value=[]),
      ), patch(
          "eisenbalm_pipeline.agents.researcher.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-sonnet-4-6",
          })),
      ):
          result = await researcher(sample_dispatch_state)

      assert result["research"]["founderName"] == "Jane Doe"
      assert result["research"]["founderNameSourceUrl"] == "https://foo.example/about"
      assert result["research"]["subjectName"] == "Alex Park"
      assert result["research"]["founderRole"] == "founder"


  @pytest.mark.asyncio
  async def test_max_tool_calls_constant() -> None:
      assert MAX_TOOL_CALLS == 12


  @pytest.mark.asyncio
  async def test_tool_limit_exceeded(sample_dispatch_state) -> None:
      """AGT-18: Researcher raises AgentToolCallLimitExceeded when >12 queries."""
      from eisenbalm_pipeline.agents import researcher as researcher_mod

      sample_dispatch_state["winning_charity"] = {"name": "Foo", "website": ""}
      thirteen_queries = [f"q{i}" for i in range(13)]

      with patch(
          "eisenbalm_pipeline.agents.researcher._build_queries",
          return_value=thirteen_queries,
      ), patch(
          "eisenbalm_pipeline.agents.researcher.web_search",
          AsyncMock(return_value=[]),
      ):
          with pytest.raises(AgentToolCallLimitExceeded):
              await researcher(sample_dispatch_state)


  @pytest.mark.asyncio
  async def test_model_version_recorded(sample_dispatch_state) -> None:
      """AGT-17: model_versions['researcher'] populated."""
      sample_dispatch_state["winning_charity"] = {"name": "Foo", "website": ""}
      out = _make_research()
      with patch(
          "eisenbalm_pipeline.agents.researcher.web_search",
          AsyncMock(return_value=[]),
      ), patch(
          "eisenbalm_pipeline.agents.researcher.acomplete",
          AsyncMock(return_value=(out, {
              "tokens_in": 0, "tokens_out": 0, "usd": 0.0,
              "resolved_model": "anthropic/claude-sonnet-4-6-20251101",
          })),
      ):
          result = await researcher(sample_dispatch_state)
      assert result["model_versions"]["researcher"] == "anthropic/claude-sonnet-4-6-20251101"
  ```
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_researcher.py -x -v 2>&1 | tail -30</automated>
  </verify>

  <acceptance_criteria>
    - `pytest tests/agents/test_researcher.py -x` exits 0 with ≥4 tests passing
    - `test_founder_fields` asserts `founderName` and `founderNameSourceUrl` populated
    - `test_tool_limit_exceeded` asserts `AgentToolCallLimitExceeded` raised
    - `test_max_tool_calls_constant` asserts `MAX_TOOL_CALLS == 12`
  </acceptance_criteria>

  <done>
  Researcher test suite verifies AGT-07 + AGT-18 mechanically.
  </done>
</task>

</tasks>

<verification>
- `EISENBALM_STUB_MODE=true pytest tests/agents/test_researcher.py tests/agents/test_verify.py -x` exits 0
- `EISENBALM_STUB_MODE=true pytest tests/ -x -q --timeout=30` exits 0
- `grep -c 'verify_research' packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` returns ≥ 3
- `grep -c 'selectolax' packages/pipeline/src/eisenbalm_pipeline/agents/verify.py` returns ≥ 1
- `EISENBALM_STUB_MODE=true uv run python -c "from eisenbalm_pipeline.graph.builder import build_graph; build_graph()"` exits 0
</verification>

<success_criteria>
- Researcher uses Tavily; max_tool_calls=12 enforced
- ResearchOutputModel includes founderName, founderNameSourceUrl, founderRole, subjectName, subjectNameSourceUrl, subjectRole
- verify_research is standalone (no @agent_node)
- verify_research sets *Verified bools using case-insensitive substring + last-name fallback
- httpx errors leave verified=False (conservative)
- graph/builder.py has verify_research between researcher and fan-out
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-09-researcher-and-verify-SUMMARY.md`.
</output>
