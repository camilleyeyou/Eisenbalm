---
phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
  - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
  - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher.md
  - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md
  - packages/pipeline/tests/agents/test_researcher.py
  - packages/pipeline/tests/test_pipeline_real_mode.py
autonomous: true
requirements: [PRV-01]
must_haves:
  truths:
    - "The Researcher emits per-claim index-bound sources; the LLM never writes a URL, only a source index (S1, S2…)"
    - "Code maps sourceIndex → the real Tavily result URL + a code-stamped retrievedAt; an out-of-range/absent index yields an honestly-unsourced claim (sourceUrl=None)"
    - "state['research']['claims'] is a list of {claimId, text, sourceUrl|None, retrievedAt|None} with code-assigned, collision-free claimIds"
    - "keyStatistics is removed from ResearchOutputModel; the two test fixtures that constructed it no longer break"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py"
      provides: "ClaimOutput model + claims list + S-index numbering + index→URL mapping"
      contains: "sourceIndex"
    - path: "packages/pipeline/tests/agents/test_researcher.py"
      provides: "index-binding + out-of-range + keyStatistics-removal assertions"
      contains: "sourceIndex"
  key_links:
    - from: "researcher() Tavily loop"
      to: "state['research']['claims'][].sourceUrl"
      via: "S1..Sn numbering + retrievedAt stamp per batch, mapped post-LLM"
      pattern: "retrievedAt"
---

<objective>
Generalize the founder/subject paired-field precedent into a full index-bound claims list (PRV-01, D-01/D-02). The Researcher shows the LLM numbered search results (S1, S2…), the LLM output binds each claim to a source INDEX, and code maps that index to the real Tavily URL plus a code-stamped `retrievedAt`. A hallucinated source becomes structurally impossible because the LLM never sees or writes a URL.

Purpose: A URL in the UI is always a URL the pipeline actually fetched (the gate philosophy: never assert verification you didn't earn).
Output: `ResearchOutputModel.claims`, code-side `state['research']['claims']`, `keyStatistics` absorbed/removed.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-CONTEXT.md
@.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- researcher.py current ResearchOutputModel (verified) -->
class ResearchOutputModel(BaseModel):
    summary: str = ""
    foundingYear: int | None = None
    founderName: str | None = None
    founderNameSourceUrl: str | None = None   # KEEP (D-02 back-compat)
    subjectName: str | None = None
    subjectNameSourceUrl: str | None = None    # KEEP (D-02 back-compat)
    keyStatistics: list[str] = Field(default_factory=list)   # REMOVE (D-02)
    fundingSources: list[str] = Field(default_factory=list)

<!-- Tavily loop (researcher.py ~L121-131): SearchResult(url,title,content,score) has NO timestamp -->
tool_calls = 0
tavily_results: list[SearchResult] = []
for q in queries:
    ...
    batch = await web_search(q, max_results=4)
    tavily_results.extend(batch)   # <-- stamp retrievedAt = int(time.time()*1000) per batch HERE
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED tests — index binding, out-of-range, keyStatistics removal</name>
  <files>packages/pipeline/tests/agents/test_researcher.py, packages/pipeline/tests/test_pipeline_real_mode.py</files>
  <read_first>
    - packages/pipeline/tests/agents/test_researcher.py (existing fixtures + assertion style)
    - packages/pipeline/tests/test_pipeline_real_mode.py (grep keyStatistics — the fixture that constructs it)
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
  </read_first>
  <behavior>
    - Given a ResearchOutputModel with claims [{text:"$2.3M budget", sourceIndex:0}] and 2 numbered Tavily results, researcher() produces state['research']['claims'][0] with sourceUrl == results[0].url and retrievedAt is an int (ms).
    - Given a claim with sourceIndex out of range (e.g. 99) or None, the mapped claim has sourceUrl is None AND retrievedAt is None (honestly unsourced).
    - Every mapped claim has a non-empty, unique claimId (assert len(set(ids)) == len(ids)).
    - ResearchOutputModel no longer has a keyStatistics field: `assert 'keyStatistics' not in ResearchOutputModel.model_fields`.
  </behavior>
  <action>
    Extend `packages/pipeline/tests/agents/test_researcher.py` with the four behaviors above. Drive researcher() through the existing fake-OpenRouter path used by the other tests in that file (patch web_search to return a known list of SearchResult, and make the fake return a ResearchOutputModel whose `claims` field is populated — mirror how the file already stubs `acomplete`/response models). Grep both `tests/agents/test_researcher.py` and `tests/test_pipeline_real_mode.py` for `keyStatistics`; update any fixture that constructs `keyStatistics=[...]` to drop that field (D-02: it is absorbed by the claims list). These tests MUST fail now (claims field + removal not yet implemented) — that is the RED gate.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/agents/test_researcher.py -x -q; test $? -ne 0 && echo "RED-as-expected"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "sourceIndex" packages/pipeline/tests/agents/test_researcher.py` matches
    - `grep -n "retrievedAt" packages/pipeline/tests/agents/test_researcher.py` matches
    - `grep -rn "keyStatistics" packages/pipeline/tests/` returns no remaining constructor usages (only comments if any)
    - Running the researcher test file currently FAILS (RED) because the claims field / keyStatistics removal do not exist yet
  </acceptance_criteria>
  <done>New RED assertions encode index-binding, out-of-range fallback, unique claimIds, and keyStatistics removal.</done>
</task>

<task type="auto">
  <name>Task 2: Implement claims list, index→URL mapping, retrievedAt, claimId; remove keyStatistics; update ResearchOutput TypedDict</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py, packages/pipeline/src/eisenbalm_pipeline/graph/state.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py (full)
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py L73-90 (ResearchOutput TypedDict)
    - packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py L25+ (SearchResult fields: url, title, content, score — no timestamp)
    - docs/API_CONTRACTS.md §35 (the code-side claim shape)
  </read_first>
  <action>
    In `researcher.py`:
    1. Add a flat Pydantic model (no oneOf):
    ```python
    class ClaimOutput(BaseModel):
        text: str = ""
        sourceIndex: int | None = None
    ```
    2. On `ResearchOutputModel`: DELETE the `keyStatistics: list[str] = Field(...)` line; ADD `claims: list[ClaimOutput] = Field(default_factory=list)`.
    3. In the Tavily loop, stamp retrieval time per batch. Import `time`. Replace `tavily_results.extend(batch)` with a parallel list that pairs each result with its retrieval timestamp, e.g. keep `tavily_results: list[SearchResult]` AND a same-length `retrieved_at_by_index: list[int]` where each appended result gets `int(time.time() * 1000)` captured at the moment of that batch's `web_search` return.
    4. AFTER `acomplete()` returns and `research_dict` is built, add a code-side mapping step (pure, synchronous — inside researcher(), no new graph node, per Research Open Q2):
       - For each `ClaimOutput` in `research_dict["claims"]` (index `i`), build `{ "claimId": f"{run_id[:8]}-{i}", "text": claim["text"], "sourceUrl": None, "retrievedAt": None }`.
       - If `claim["sourceIndex"]` is an int and `0 <= sourceIndex < len(tavily_results)`, set `sourceUrl = tavily_results[sourceIndex].url` and `retrievedAt = retrieved_at_by_index[sourceIndex]`. Otherwise leave both None (honestly unsourced).
       - Replace `research_dict["claims"]` with this mapped list of dicts (so downstream reads code-side dicts, not ClaimOutput objects).
    5. In `graph/state.py`, add to the `ResearchOutput` TypedDict a `claims: NotRequired[list[dict]]` entry (the mapped claim dict shape). Do NOT change or "fix" the existing stale fields (foundingMoment, caseStudySubject, verifiedFacts, etc.) — that drift is documented as known/out-of-scope in §35 (Research Pitfall 3).
    Keep `founderName`/`founderNameSourceUrl`/`subjectName`/`subjectNameSourceUrl` exactly as-is (D-02 back-compat).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/agents/test_researcher.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "class ClaimOutput" packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` matches
    - `grep -n "keyStatistics" packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` returns nothing
    - `grep -n "claims: list\[ClaimOutput\]\|claims: NotRequired" packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py packages/pipeline/src/eisenbalm_pipeline/graph/state.py` shows both the model field and the TypedDict entry
    - `grep -n "retrieved_at_by_index\|int(time.time" packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` matches (per-batch stamping)
    - `uv run pytest tests/agents/test_researcher.py -x -q` passes (GREEN)
  </acceptance_criteria>
  <done>Researcher emits code-mapped index-bound claims; keyStatistics removed; ResearchOutput TypedDict carries claims; researcher tests green.</done>
</task>

<task type="auto">
  <name>Task 3: Number Tavily results S1..Sn in the prompt + instruct the LLM to emit index-bound claims</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py, packages/pipeline/src/eisenbalm_pipeline/prompts/researcher.md, packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py (_build_messages, results_block construction ~L84-101)
    - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md
  </read_first>
  <action>
    1. In `researcher.py::_build_messages`, change `results_block` so each result is prefixed with a stable index label matching the mapping in Task 2: enumerate `tavily_results` and render `f"[S{i}] URL: {r.url}\nTitle: {r.title}\nContent: {r.content[:1200]}"` (index `i` is 0-based and MUST equal the `sourceIndex` the LLM returns — keep them aligned; document this in a code comment).
    2. In `prompts/researcher.md` (system) add a terse instruction block: the results are numbered `[S0] [S1] …`; for every factual claim you output, set `sourceIndex` to the number of the single result that supports it, or `null` if no numbered result supports it. Never invent or paste a URL — only the index. Emit these as the `claims` array.
    3. In `prompts/researcher_user.md`, add a one-line reminder to populate `claims` with `{text, sourceIndex}` for each number/date/name/statistic worth checking.
    Keep the `{VOICE_CONSTRAINTS}` / `{charity}` / `{results_block}` placeholders intact.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/agents/test_researcher.py tests/test_pipeline_real_mode.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "S{i}\|\[S" packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` shows numbered results in _build_messages
    - `grep -in "sourceindex\|source index\|numbered" packages/pipeline/src/eisenbalm_pipeline/prompts/researcher.md` matches
    - `uv run pytest tests/agents/test_researcher.py tests/test_pipeline_real_mode.py -x -q` passes
  </acceptance_criteria>
  <done>The Researcher prompt shows numbered results and instructs index-only source binding; researcher + real-mode tests green.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/agents/test_researcher.py tests/test_pipeline_real_mode.py -x -q` passes.
- Full pipeline suite regression: `cd packages/pipeline && uv run pytest -x -q` stays green (baseline ~477 tests).
</verification>

<success_criteria>
PRV-01 satisfied: Researcher emits per-claim `{claim, sourceUrl, retrievedAt}` bindings via index-binding; keyStatistics absorbed; no LLM-written URLs; hallucinated sources structurally impossible.
</success_criteria>

<output>
After completion, create `.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-02-SUMMARY.md`
</output>
