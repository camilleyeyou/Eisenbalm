---
phase: 05-agent-quality
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/pipeline/pyproject.toml
  - packages/pipeline/uv.lock
  - packages/pipeline/.env.example
  - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
autonomous: true
requirements_addressed:
  - AGT-03
  - AGT-04
  - AGT-07
  - AGT-08
  - AGT-17

must_haves:
  truths:
    - "`tavily-python`, `langchain-tavily`, `selectolax` are pinned in pyproject.toml"
    - "`uv sync` resolves without error on Python 3.11"
    - "DispatchState exposes `featured_charity_keys: list[str]` and `model_versions: dict[str, str]`"
    - "ResearchOutput exposes founderNameSourceUrl, founderNameVerified, founderRole, subjectName, subjectNameSourceUrl, subjectNameVerified, subjectRole"
    - "QACorrection.severity literal type is `'info' | 'warning' | 'error'` (replaces minor|moderate|major)"
    - ".env.example documents OPENROUTER_API_KEY, TAVILY_API_KEY, PIPELINE_COST_CAP_USD, PIPELINE_COST_WARN_PCT, EISENBALM_STUB_MODE"
  artifacts:
    - path: "packages/pipeline/pyproject.toml"
      provides: "Pinned Phase 5 dependency additions"
      contains: "tavily-python"
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/state.py"
      provides: "Extended DispatchState + ResearchOutput TypedDicts"
      contains: "founderNameVerified"
    - path: "packages/pipeline/.env.example"
      provides: "Documented Phase 5 env vars"
      contains: "PIPELINE_COST_CAP_USD"
  key_links:
    - from: "DispatchState.featured_charity_keys"
      to: "agents/scout.py (consumes for dedup; AGT-04)"
      via: "list[str] populated by Scout before first Tavily call"
      pattern: "featured_charity_keys"
    - from: "DispatchState.model_versions"
      to: "lib/openrouter_client.py acomplete() (writes per call; AGT-17)"
      via: "dict[str, str] {agent_id: resolved_model_id}"
      pattern: "model_versions"
    - from: "ResearchOutput.founderNameVerified"
      to: "agents/verify.py (sets True/False) + agents/founder_bio.py (gates role framing)"
      via: "bool"
      pattern: "founderNameVerified"
---

<objective>
Land the Phase 5 dependency pins and DispatchState extensions that every subsequent plan consumes. This is a Wave 0 task with no Convex dependency — runs in parallel with Plan 05-01.

Three additions:

1. **Dependency pins (pyproject.toml + uv.lock)** — `tavily-python==0.7.24` (REST client fallback), `langchain-tavily==0.2.18` (preferred LangChain integration; STACK.md recommendation), `selectolax==0.4.9` (fast HTML-to-text for `verify_research` per D-11; chosen over `lxml` to avoid libxml2 Docker build complexity on Railway).

2. **DispatchState + ResearchOutput extensions** — Phase 5 needs 2 new top-level state fields (`featured_charity_keys`, `model_versions`) and 7 new fields on `ResearchOutput` (`founderNameSourceUrl`, `founderNameVerified`, `founderRole`, `subjectName`, `subjectNameSourceUrl`, `subjectNameVerified`, `subjectRole`). The `QACorrection.severity` Literal must also flip from `'minor' | 'moderate' | 'major'` to `'info' | 'warning' | 'error'` to match the Plan 05-01 Convex schema patch. Also confirm `deliberation_transcript` field exists (RESEARCH.md Open Question 5 — verified: it does, state.py line 105).

3. **.env.example documentation** — add `PIPELINE_COST_CAP_USD=10.0`, `PIPELINE_COST_WARN_PCT=0.7` (D-08), `OPENROUTER_API_KEY=` (already there from Phase 4; verify), `TAVILY_API_KEY=` (Phase 4 D-31 reserved), `EISENBALM_STUB_MODE=false` (D-22 default flip — document the new default but DO NOT change runtime default yet; Plan 05-14 does the runtime flip).

Purpose: Wave 0 prerequisite. Lib modules (Plan 05-03) and every agent body need these pins + state shapes available before they can import or annotate.

Output: 4 files patched; `uv sync` regenerates `uv.lock`; commit lands on `master`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@packages/pipeline/pyproject.toml
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py
@docs/API_CONTRACTS.md

<interfaces>
<!-- Current pyproject.toml [project].dependencies (verified by inspection) -->
```toml
dependencies = [
  "fastapi==0.136.1",
  "uvicorn[standard]==0.46.0",
  "langgraph==1.1.10",
  "langgraph-checkpoint-postgres==3.1.0",
  "psycopg[binary]>=3.2,<4",
  "pydantic==2.13.4",
  "httpx==0.28.1",
  "langchain-openai==1.2.1",
  "supabase==2.30.0",
  "python-slugify==8.0.4",
]
```

<!-- Current graph/state.py DispatchState ends with these fields (verified by inspection): -->
```python
# state.py line 126: model_versions: Optional[dict[str, str]]  -- ALREADY EXISTS (Phase 4 added it)
# state.py line 105: deliberation_transcript: Optional[str]    -- ALREADY EXISTS (Phase 4 added it)
# Missing: featured_charity_keys: list[str]
# QACorrection.severity is currently: Literal['minor', 'moderate', 'major']   <-- needs flip
# ResearchOutput is currently minimal — needs 7 new optional fields
```

<!-- Note: Plan 05-01 patched Convex to accept severity='info'|'warning'|'error'. Python QACorrection.severity Literal must match. Since QACorrection is a TypedDict, no Pydantic validation — but downstream qa.py + qaCorrections:insert callers WILL pass these new strings. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Phase 5 dependency pins to pyproject.toml + regenerate uv.lock</name>
  <files>packages/pipeline/pyproject.toml, packages/pipeline/uv.lock</files>

  <read_first>
    - packages/pipeline/pyproject.toml (whole file — 41 lines)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Standard Stack" lines 104-127 (pinned versions + rationale)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Common Pitfalls" Pitfall 1 (langchain-tavily import path drift)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Risks and Mitigations" R5 (selectolax wheel ABI on Railway)
  </read_first>

  <action>
  Edit `packages/pipeline/pyproject.toml`. Append three new lines to the `dependencies = [...]` list (preserving the existing 10 lines verbatim, appending after `"python-slugify==8.0.4"`, and matching the existing one-string-per-line indentation):

  ```toml
  dependencies = [
    "fastapi==0.136.1",
    "uvicorn[standard]==0.46.0",
    "langgraph==1.1.10",
    "langgraph-checkpoint-postgres==3.1.0",
    "psycopg[binary]>=3.2,<4",
    "pydantic==2.13.4",
    "httpx==0.28.1",
    "langchain-openai==1.2.1",
    "supabase==2.30.0",
    "python-slugify==8.0.4",
    "tavily-python==0.7.24",       # Phase 5 D-09 — REST client (fallback if langchain-tavily import fails)
    "langchain-tavily==0.2.18",    # Phase 5 D-09 — preferred LangChain Tavily integration
    "selectolax==0.4.9",           # Phase 5 D-11 — fast HTML-to-text for agents/verify.py
  ]
  ```

  Do NOT touch `[dependency-groups].dev`, `[build-system]`, `[tool.hatch.build.targets.wheel]`, `[tool.uv]`, or `[tool.pytest.ini_options]`. Only the `dependencies` list grows by 3 lines.

  Then, from `packages/pipeline/`, run `uv sync` (or `uv lock` if `uv sync` is not desired in this task — either is acceptable; both regenerate `uv.lock`). Verify exit code 0 and that all 3 new packages appear in `uv.lock`. If `uv sync` fails because the Railway / local environment cannot reach PyPI, the executor MUST surface the failure rather than commit a stale lock file.

  Sanity test the import paths immediately by running:
  ```bash
  cd packages/pipeline && uv run python -c "from tavily import TavilyClient; from selectolax.parser import HTMLParser; print('tavily+selectolax OK')"
  ```
  Exit code 0 with `tavily+selectolax OK` on stdout proves the pure-Python wheels resolved.

  For `langchain-tavily`, also verify a candidate import path (RESEARCH §Pitfall 1):
  ```bash
  cd packages/pipeline && uv run python -c "
  try:
      from langchain_tavily import TavilySearch
      print('langchain_tavily.TavilySearch OK')
  except ImportError:
      try:
          from langchain_community.utilities.tavily_search import TavilySearchAPIWrapper
          print('langchain_community.utilities.tavily_search.TavilySearchAPIWrapper OK')
      except ImportError as e:
          print(f'BOTH import paths failed: {e}')
          raise
  "
  ```
  Record which path resolved in this task's SUMMARY so Plan 05-03 (`lib/search_client.py`) knows which import to use.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && grep -q 'tavily-python==0.7.24' pyproject.toml && grep -q 'langchain-tavily==0.2.18' pyproject.toml && grep -q 'selectolax==0.4.9' pyproject.toml && uv run python -c "from tavily import TavilyClient; from selectolax.parser import HTMLParser" && echo OK</automated>
  </verify>

  <acceptance_criteria>
    - `packages/pipeline/pyproject.toml` `dependencies` list contains the strings `"tavily-python==0.7.24"`, `"langchain-tavily==0.2.18"`, `"selectolax==0.4.9"` (exact version pins)
    - All 10 existing dependency pins remain unchanged byte-for-byte
    - `packages/pipeline/uv.lock` contains entries for `tavily-python`, `langchain-tavily`, `selectolax` (greppable)
    - `uv run python -c "from tavily import TavilyClient; from selectolax.parser import HTMLParser"` exits 0
    - At least one of `from langchain_tavily import TavilySearch` OR `from langchain_community.utilities.tavily_search import TavilySearchAPIWrapper` succeeds; the working path is documented in the plan SUMMARY
  </acceptance_criteria>

  <done>
  3 dependency pins added. `uv.lock` regenerated. All imports verified locally. SUMMARY documents which `langchain-tavily` import path is canonical at version 0.2.18 (so Plan 05-03 uses the right one).
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend DispatchState + ResearchOutput + QACorrection in graph/state.py</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/state.py</files>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py (whole file — 136 lines — read FIRST to see current shape)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"State Extensions Required" lines 1441-1465
    - docs/API_CONTRACTS.md §7 (DispatchState canonical shape — verify our additions don't conflict)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Common Pitfalls" Pitfall 7 (Python set in DispatchState — must use list[str])
  </read_first>

  <action>
  Three surgical edits to `packages/pipeline/src/eisenbalm_pipeline/graph/state.py`:

  **Edit A — extend ResearchOutput** (currently lines 39-46, 7 fields). Add 7 new optional fields after the existing `sources` field. ResearchOutput is a `TypedDict` (not `total=False`), so new optional fields must use `total=False` semantics — switch the class declaration to a two-class pattern OR mark new fields via `NotRequired[]` from `typing_extensions`. Python 3.11 has `typing.NotRequired` natively (PEP 655). Use `NotRequired` from `typing` (3.11+).

  Add to the imports at the top of the file (after the existing `from typing import Literal, Optional, TypedDict`):
  ```python
  from typing import NotRequired
  ```

  Replace the existing ResearchOutput class (lines 39-46):
  ```python
  class ResearchOutput(TypedDict):
      foundingMoment: str                 # the weird, specific origin moment
      founderName: str
      founderBackground: str
      caseStudySubject: str               # name/description of one real person
      caseStudyOutcome: str               # what happened to them
      verifiedFacts: list[str]            # fact-checked claims with sources
      sources: list[str]                  # URLs used
  ```
  with:
  ```python
  class ResearchOutput(TypedDict):
      foundingMoment: str                 # the weird, specific origin moment
      founderName: str
      founderBackground: str
      caseStudySubject: str               # name/description of one real person
      caseStudyOutcome: str               # what happened to them
      verifiedFacts: list[str]            # fact-checked claims with sources
      sources: list[str]                  # URLs used
      # ── Phase 5 additions (AGT-07, AGT-08, AGT-09, AGT-10) ─────────────────
      # All NotRequired: Researcher may emit None when no source found.
      # verify_research sets *Verified booleans after Researcher returns.
      founderNameSourceUrl: NotRequired[Optional[str]]   # AGT-07: URL where founderName was found
      founderNameVerified: NotRequired[bool]             # AGT-08: set by verify_research node
      founderRole: NotRequired[str]                      # D-12 fallback role e.g. "founder", "executive director"
      subjectName: NotRequired[Optional[str]]            # AGT-09 case study subject name
      subjectNameSourceUrl: NotRequired[Optional[str]]   # AGT-09 verification source
      subjectNameVerified: NotRequired[bool]             # AGT-09: set by verify_research node
      subjectRole: NotRequired[str]                      # D-12 fallback role e.g. "a parent", "a program participant"
  ```

  **Edit B — flip QACorrection.severity Literal** (currently line 89). Replace:
  ```python
      severity: Literal['minor', 'moderate', 'major']
  ```
  with:
  ```python
      severity: Literal['info', 'warning', 'error']  # Phase 5 D-01: aligned with Convex qaCorrections.severity patch
  ```

  Do NOT change any other field on QACorrection.

  **Edit C — add 2 new top-level DispatchState fields**. After line 126 (`model_versions: Optional[dict[str, str]]`) and BEFORE the `# ── Error handling ──` divider, insert:
  ```python
      # ── Phase 5 additions ─────────────────────────────────────────────────────
      featured_charity_keys: Optional[list[str]]   # AGT-04: Scout dedup keys (list NOT set — JSON-serializable for LangGraph checkpoint per RESEARCH Pitfall 7)
  ```

  Verify `model_versions` already exists at line 126 (per RESEARCH Open Question 5 — confirmed by inspection). If absent, also add. Verify `deliberation_transcript` exists at line 105 (confirmed). Do NOT duplicate either field.

  Do NOT touch the test-toggle fields `_force_no_winner` and `_force_fail_agent` at the end.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && grep -q "founderNameVerified" src/eisenbalm_pipeline/graph/state.py && grep -q "subjectNameVerified" src/eisenbalm_pipeline/graph/state.py && grep -q "featured_charity_keys" src/eisenbalm_pipeline/graph/state.py && grep -q "Literal\['info', 'warning', 'error'\]" src/eisenbalm_pipeline/graph/state.py && ! grep -q "Literal\['minor', 'moderate', 'major'\]" src/eisenbalm_pipeline/graph/state.py && uv run python -c "from eisenbalm_pipeline.graph.state import DispatchState, ResearchOutput, QACorrection; print('imports OK')" && echo OK</automated>
  </verify>

  <acceptance_criteria>
    - `graph/state.py` contains `from typing import NotRequired` (or appends NotRequired to existing import)
    - `ResearchOutput` class contains all 7 new field names: `founderNameSourceUrl`, `founderNameVerified`, `founderRole`, `subjectName`, `subjectNameSourceUrl`, `subjectNameVerified`, `subjectRole` (each greppable)
    - All 7 new ResearchOutput fields use `NotRequired[...]`
    - `QACorrection.severity` Literal type is `'info', 'warning', 'error'` (greppable as `Literal['info', 'warning', 'error']`)
    - `graph/state.py` no longer contains `Literal['minor', 'moderate', 'major']`
    - `DispatchState` contains the field `featured_charity_keys: Optional[list[str]]`
    - `DispatchState` still contains `model_versions: Optional[dict[str, str]]` (unchanged from Phase 4)
    - `DispatchState` still contains `deliberation_transcript: Optional[str]` (unchanged from Phase 4)
    - `uv run python -c "from eisenbalm_pipeline.graph.state import DispatchState, ResearchOutput, QACorrection"` exits 0
  </acceptance_criteria>

  <done>
  State.py extended with 7 new ResearchOutput fields, 1 new DispatchState field, and 1 severity Literal flip. Existing Phase 4 fields untouched. Module imports cleanly.
  </done>
</task>

<task type="auto">
  <name>Task 3: Document Phase 5 env vars in packages/pipeline/.env.example</name>
  <files>packages/pipeline/.env.example</files>

  <read_first>
    - packages/pipeline/.env.example (whole file — read FIRST to see current vars)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Cost Cap Enforcement" lines 1376-1382 (env var names + defaults)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-08 (cost cap), D-22 (stub-mode toggle), D-09 (Tavily key)
  </read_first>

  <action>
  Edit `packages/pipeline/.env.example`. Add a new section at the bottom (or after the existing OPENROUTER/Convex section if one exists) with the following block. Preserve all existing entries verbatim:

  ```bash
  # ─── Phase 5 — Agent Quality ────────────────────────────────────────────────

  # OpenRouter API key — required for all real-mode LLM calls (AGT-17).
  # Source: https://openrouter.ai/keys
  # Already present from Phase 4; documented here for completeness.
  OPENROUTER_API_KEY=

  # Tavily Search API key — required by Scout (D-09) + Researcher (AGT-03, AGT-07).
  # Source: https://tavily.com/dashboard
  # Reserved by Phase 4 D-31; first wired in Phase 5.
  TAVILY_API_KEY=

  # Per-run dollar cap for LLM cost (D-08 + AGT-18).
  # CostRecorder.check_cap() raises CostCapExceeded at this value;
  # emits deliberationEvents 'cost-warning' at PIPELINE_COST_WARN_PCT * this.
  PIPELINE_COST_CAP_USD=10.0

  # Soft-warning percentage of the cap (D-08).
  # At total_usd >= cap * this, a single 'cost-warning' event is emitted.
  PIPELINE_COST_WARN_PCT=0.7

  # Stub-mode toggle (D-22).
  # Phase 5 default flips to "false" (real OpenRouter + Tavily calls).
  # Set to "true" to exercise the Phase 4 PIP-06 stub fixtures path
  # (Phase 4 PIP-06 integration test still relies on this).
  # The runtime default change is applied in Plan 05-14;
  # for now `lib/openrouter_client.py` still treats absent as "true".
  EISENBALM_STUB_MODE=false
  ```

  If `OPENROUTER_API_KEY` or `TAVILY_API_KEY` already appears in the file (Phase 4 may have documented them), do NOT duplicate — instead verify the existing line matches the format above (`<KEY>=` with empty value placeholder). If the existing entry has a different style (e.g., `# OPENROUTER_API_KEY=` commented out), leave it AND add the new Phase 5 block as documentation; pipeline reads the uncommented form.

  Do NOT add any actual key values. Do NOT touch any other env var in the file.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && grep -q "^PIPELINE_COST_CAP_USD=10.0$" .env.example && grep -q "^PIPELINE_COST_WARN_PCT=0.7$" .env.example && grep -q "^EISENBALM_STUB_MODE=false$" .env.example && grep -q "^TAVILY_API_KEY=" .env.example && grep -q "^OPENROUTER_API_KEY=" .env.example && echo OK</automated>
  </verify>

  <acceptance_criteria>
    - `.env.example` contains line `PIPELINE_COST_CAP_USD=10.0` (exact, no leading whitespace)
    - `.env.example` contains line `PIPELINE_COST_WARN_PCT=0.7`
    - `.env.example` contains line `EISENBALM_STUB_MODE=false`
    - `.env.example` contains line starting with `TAVILY_API_KEY=` (value may be empty)
    - `.env.example` contains line starting with `OPENROUTER_API_KEY=` (Phase 4 may have placed it; no duplicate created)
    - No actual key values committed (placeholders are empty strings)
    - Existing Phase 4 env vars (`SUPABASE_POSTGRES_URL`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `SANITY_API_TOKEN`, `PIPELINE_TRIGGER_SECRET`) still present
  </acceptance_criteria>

  <done>
  .env.example documents all 5 Phase 5 env vars with sensible defaults / empty placeholders. No real secret values committed. Phase 4 env vars preserved.
  </done>
</task>

</tasks>

<verification>
- `pyproject.toml` contains all 3 new dependency pins and `uv.lock` reflects them.
- `uv run python -c "from tavily import TavilyClient; from selectolax.parser import HTMLParser"` exits 0.
- `graph/state.py` exposes 7 new ResearchOutput fields, 1 new DispatchState field, and QACorrection.severity is `'info' | 'warning' | 'error'`.
- `from eisenbalm_pipeline.graph.state import DispatchState, ResearchOutput, QACorrection` exits 0.
- `.env.example` documents the 5 Phase 5 env vars.
</verification>

<success_criteria>
- 4 files patched (`pyproject.toml`, `uv.lock`, `graph/state.py`, `.env.example`)
- Subsequent plans can import `tavily`, `selectolax`, and the chosen `langchain-tavily` path
- Subsequent plans can use `featured_charity_keys`, `model_versions`, and the 7 new ResearchOutput fields without type errors
- QACorrection.severity Literal type matches Plan 05-01's Convex schema patch (byte-aligned vocabulary)
- No existing Phase 4 deps, state fields, or env vars regressed
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-02-dependencies-and-state-SUMMARY.md` per the standard summary template. Include in the summary the canonical `langchain-tavily` import path that resolved at version 0.2.18 so Plan 05-03 uses it directly.
</output>
