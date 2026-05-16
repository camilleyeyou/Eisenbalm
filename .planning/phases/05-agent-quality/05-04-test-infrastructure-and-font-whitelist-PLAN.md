---
phase: 05-agent-quality
plan: 04
type: execute
wave: 2
depends_on:
  - "05-02"
files_modified:
  - packages/pipeline/tests/conftest.py
  - packages/pipeline/tests/agents/__init__.py
  - packages/pipeline/tests/agents/qa/__init__.py
  - packages/pipeline/tests/agents/test_calibrator.py
  - packages/pipeline/tests/agents/test_scout.py
  - packages/pipeline/tests/agents/test_advocate.py
  - packages/pipeline/tests/agents/test_editor.py
  - packages/pipeline/tests/agents/test_researcher.py
  - packages/pipeline/tests/agents/test_verify.py
  - packages/pipeline/tests/agents/test_founder_bio.py
  - packages/pipeline/tests/agents/test_bonus.py
  - packages/pipeline/tests/agents/test_game.py
  - packages/pipeline/tests/agents/test_design.py
  - packages/pipeline/tests/agents/test_editor_final.py
  - packages/pipeline/tests/agents/test_tool_limits.py
  - packages/pipeline/tests/agents/qa/test_rules.py
  - packages/pipeline/tests/agents/qa/test_judge.py
  - packages/pipeline/tests/lib/test_wcag.py
  - packages/pipeline/tests/lib/test_voice.py
  - packages/pipeline/tests/lib/test_openrouter.py
  - packages/pipeline/tests/lib/test_cost.py
  - packages/pipeline/tests/test_pipeline_real_mode.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py
autonomous: true
requirements_addressed:
  - AGT-14
must_haves:
  truths:
    - "Every Wave 0 test file from 05-VALIDATION.md exists and is collectable by pytest"
    - "All Wave 0 tests start skip-skipped (pytest.mark.skip) — later waves remove skip markers"
    - "conftest.py provides shared fixtures: mock Convex, mock Sanity, fake OpenRouter, mock Tavily, mock httpx"
    - "font_whitelist.py exists with WHITELIST_DISPLAY, WHITELIST_BODY, FONT_WHITELIST, FALLBACK_FONT_DISPLAY, FALLBACK_FONT_BODY"
    - "font_whitelist.py contains an Andrew-approval marker comment"
    - "pytest tests/ -x --co collects > 0 tests with no import errors"
  artifacts:
    - path: "packages/pipeline/tests/conftest.py"
      provides: "Shared pytest fixtures for Phase 5 (mock Convex/Sanity/OpenRouter/Tavily/httpx)"
      min_lines: 80
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py"
      provides: "Andrew-approved (initially candidate) font whitelist with display + body lists, fallback defaults"
      contains: "FALLBACK_FONT_DISPLAY"
  key_links:
    - from: "tests/conftest.py fixtures"
      to: "all agent test files in tests/agents/"
      via: "shared fixtures consumed across the test surface"
      pattern: "@pytest\\.fixture"
    - from: "agents/design/font_whitelist.py FONT_WHITELIST"
      to: "agents/design.py validation (Plan 05-11)"
      via: "in-set membership check at write time"
      pattern: "FONT_WHITELIST"
---

<objective>
Land the pytest test infrastructure skeleton AND the `font_whitelist.py` candidate list. Both are Wave 0 prerequisites for downstream agent work but neither requires the lib modules from Plan 05-03 — they can run as soon as Plan 05-02 ships the dependency pins.

Two parallel concerns:

1. **Test skeleton (18+ files):** From 05-VALIDATION.md Wave 0 Requirements. Every test file is created with a single `pytest.mark.skip("Wave N: pending — implementation in plan 05-XX")` marker so pytest collection stays green throughout the phase. Later wave tasks REMOVE the skip marker when the implementation lands. This mirrors Phase 4 Plan 04-05 (RESEARCH §"Test Infrastructure"). conftest.py provides shared fixtures so wave tasks consume them.

2. **font_whitelist.py (D-16):** The Andrew-approval blocker noted in STATE.md. This plan ships the 25-font candidate list as a `# TODO(Andrew): approve or revise` artifact; Plan 05-15 (Wave 8) is where Andrew approves any extended additions; Plan 05-12 (DesignAgent) consumes the list as-is. The FALLBACK_FONT_DISPLAY / FALLBACK_FONT_BODY constants guarantee a safe theme even before Andrew signs off on extended candidates — they reuse the Phase-2-approved baseline (Playfair Display + Source Serif Pro).

Purpose: Wave 0 closeout. After Plan 05-04 commits, every agent body plan in Waves 1-3 can be written without any "where do tests go" or "where's the font list" friction.

Output: 24 files (18 test files + 4 init files + conftest.py + font_whitelist.py); `pytest tests/ --collect-only` exits 0.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-agent-quality/05-CONTEXT.md
@.planning/phases/05-agent-quality/05-RESEARCH.md
@.planning/phases/05-agent-quality/05-VALIDATION.md
@packages/pipeline/tests/conftest.py
@packages/pipeline/pyproject.toml
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend conftest.py with Phase 5 mock fixtures</name>
  <files>packages/pipeline/tests/conftest.py</files>

  <read_first>
    - packages/pipeline/tests/conftest.py (current Phase 4 conftest — preserve, add to)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Validation Architecture" lines 1491-1541
    - .planning/phases/05-agent-quality/05-VALIDATION.md Wave 0 Requirements
    - packages/pipeline/src/eisenbalm_pipeline/stubs/fake_openrouter.py
  </read_first>

  <action>
  Open `packages/pipeline/tests/conftest.py`. PRESERVE everything from Phase 4 (Plan 04-05 SUMMARY confirms it has `pytest_asyncio` config, env-skip guard, ASGITransport in-process FastAPI client, and 14-15 stub-mode fixtures).

  APPEND the following Phase 5 mock fixtures at the bottom of the file:

  ```python
  # ── Phase 5 mock fixtures (added by Plan 05-04) ─────────────────────

  import pytest
  from unittest.mock import AsyncMock, MagicMock


  @pytest.fixture
  def mock_convex_mutation():
      """Patch lib.convex_client.convex_mutation_safe to record calls.

      Returns an AsyncMock. Tests assert on call_args_list to verify
      the right mutation name + payload was issued.
      """
      mock = AsyncMock(return_value={"status": "success"})
      return mock


  @pytest.fixture
  def mock_sanity_write_charity():
      """Patch lib.sanity_client.write_charity. Returns deterministic _id."""
      mock = AsyncMock(side_effect=lambda http, c: f"charity-{c['name'].lower().replace(' ', '-')}")
      return mock


  @pytest.fixture
  def mock_openrouter_acomplete():
      """Patch lib.openrouter_client.acomplete with a canned response.

      Tests set .return_value or .side_effect to control content + usage.
      Default returns the empty-string content + zero tokens (cost cap safe).
      """
      mock = AsyncMock(return_value=("", {
          "tokens_in": 0,
          "tokens_out": 0,
          "usd": 0.0,
          "resolved_model": "anthropic/claude-opus-4-7",
      }))
      return mock


  @pytest.fixture
  def mock_tavily_search():
      """Patch lib.search_client.web_search. Returns 3 fake SearchResult-shaped dicts."""
      mock = AsyncMock(return_value=[
          {"url": "https://example.org/about", "title": "Example Charity", "content": "...", "score": 0.9},
          {"url": "https://example2.org/about", "title": "Another Charity", "content": "...", "score": 0.8},
          {"url": "https://example3.org/about", "title": "Third Charity", "content": "...", "score": 0.7},
      ])
      return mock


  @pytest.fixture
  def mock_httpx_get():
      """Patch httpx.AsyncClient.get for verify_research tests.

      Default returns 200 OK with HTML containing 'Jane Doe' for substring matching.
      """
      response = MagicMock()
      response.text = "<html><body>About us. Founded by Jane Doe in 2003.</body></html>"
      response.raise_for_status = MagicMock(return_value=None)
      mock = AsyncMock(return_value=response)
      return mock


  @pytest.fixture
  def sample_dispatch_state():
      """Minimal DispatchState dict for unit-test assembly."""
      return {
          "run_id": "test-run-id-0001",
          "issue_number": 42,
          "publish_date": "2026-05-21",
          "pipeline_started_at": "2026-05-21T10:00:00Z",
          "style_brief": {
              "voice": "Jesse",
              "constraints": ["No exclamation marks", "No sentimentality"],
              "bonusType": "bigBudget",
              "visualDirection": "Warm cream and oxblood",
              "previousBonusTypes": ["jingle"],
          },
          "winning_charity": {
              "name": "Example Charity",
              "location": "Maine, USA",
              "website": "https://example.org",
              "missionStatement": "We help people.",
              "assetRange": "$100K–$500K",
              "focusArea": "Education",
          },
          "research": {
              "summary": "Founded 2003 by Jane Doe...",
              "founderName": "Jane Doe",
              "founderRole": "founder",
              "founderNameSourceUrl": "https://example.org/about",
              "founderNameVerified": True,
              "subjectName": "Alex Smith",
              "subjectRole": "a parent",
              "subjectNameSourceUrl": "https://example.org/stories/alex",
              "subjectNameVerified": True,
          },
          "featured_charity_keys": [],
          "model_versions": {},
      }
  ```

  Sanity check: this APPENDS only; do not delete or modify any Phase 4 fixture.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/conftest.py --collect-only 2>&1 | tail -5 && uv run python -c "import importlib.util, sys; spec = importlib.util.spec_from_file_location('conftest', 'tests/conftest.py'); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m); assert hasattr(m, 'mock_openrouter_acomplete'); assert hasattr(m, 'mock_tavily_search'); assert hasattr(m, 'sample_dispatch_state'); print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - `tests/conftest.py` contains `mock_convex_mutation`, `mock_sanity_write_charity`, `mock_openrouter_acomplete`, `mock_tavily_search`, `mock_httpx_get`, `sample_dispatch_state` fixtures
    - All Phase 4 fixtures remain intact (no Phase 4 fixture deleted or modified)
    - `pytest --collect-only` exits 0
    - `grep -c 'def mock_openrouter_acomplete' tests/conftest.py` returns 1
  </acceptance_criteria>

  <done>
  conftest.py provides every shared mock fixture downstream tests need. Tests can be written without restating mock construction.
  </done>
</task>

<task type="auto">
  <name>Task 2: Create all Wave 0 test files as skip-skeletons</name>
  <files>packages/pipeline/tests/agents/__init__.py, packages/pipeline/tests/agents/qa/__init__.py, packages/pipeline/tests/agents/test_calibrator.py, packages/pipeline/tests/agents/test_scout.py, packages/pipeline/tests/agents/test_advocate.py, packages/pipeline/tests/agents/test_editor.py, packages/pipeline/tests/agents/test_researcher.py, packages/pipeline/tests/agents/test_verify.py, packages/pipeline/tests/agents/test_founder_bio.py, packages/pipeline/tests/agents/test_bonus.py, packages/pipeline/tests/agents/test_game.py, packages/pipeline/tests/agents/test_design.py, packages/pipeline/tests/agents/test_editor_final.py, packages/pipeline/tests/agents/test_tool_limits.py, packages/pipeline/tests/agents/qa/test_rules.py, packages/pipeline/tests/agents/qa/test_judge.py, packages/pipeline/tests/lib/test_wcag.py, packages/pipeline/tests/lib/test_voice.py, packages/pipeline/tests/lib/test_openrouter.py, packages/pipeline/tests/lib/test_cost.py, packages/pipeline/tests/test_pipeline_real_mode.py</files>

  <read_first>
    - .planning/phases/05-agent-quality/05-VALIDATION.md (per-task verification map — every test command listed)
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Phase Requirements to Test Map" lines 1504-1525
    - packages/pipeline/tests/test_pipeline_smoke.py (existing Phase 4 test — for skip-pattern reference)
  </read_first>

  <action>
  Create the 21 test files below. Each is a pytest skip-skeleton; the wave task that implements the corresponding agent removes the `pytest.mark.skip` decorator and replaces the body with real assertions. This pattern ships from Phase 4 Plan 04-05.

  **Create empty package init files first:**

  `packages/pipeline/tests/agents/__init__.py`:
  ```python
  """Phase 5 agent unit tests. Filled in by wave-1..3 plans."""
  ```

  `packages/pipeline/tests/agents/qa/__init__.py`:
  ```python
  """Phase 5 QA two-layer rubric tests. Filled in by Plan 05-12."""
  ```

  **Then create each test file using this exact template (substitute AGENT + WAVE + PLAN_ID + REQ_ID + TEST_FN_NAME):**

  ```python
  """Phase 5 {AGENT} unit test — implementation in Plan {PLAN_ID}.

  Validation source: .planning/phases/05-agent-quality/05-VALIDATION.md
  REQ-ID: {REQ_ID}
  """
  from __future__ import annotations

  import pytest


  @pytest.mark.skip(reason="Wave {WAVE}: pending — Plan {PLAN_ID} implements")
  def test_{TEST_FN_NAME}() -> None:
      """Asserted by Plan {PLAN_ID}. Remove skip marker when body lands."""
      raise NotImplementedError
  ```

  **The 21 files (test function name + REQ-ID + implementing plan):**

  | File | Test fn | REQ-ID | Plan |
  |------|---------|--------|------|
  | tests/agents/test_calibrator.py | `test_bonus_rotation`, `test_voice_constants` | AGT-01, AGT-02 | 05-05 |
  | tests/agents/test_scout.py | `test_candidate_count`, `test_dedup` | AGT-03, AGT-04 | 05-06 |
  | tests/agents/test_advocate.py | `test_advocate_scores_all_candidates` | AGT-05 | 05-07 |
  | tests/agents/test_editor.py | `test_interrupt_threshold`, `test_deterministic_winner` | AGT-06 | 05-08 |
  | tests/agents/test_researcher.py | `test_founder_fields` | AGT-07 | 05-09 |
  | tests/agents/test_verify.py | `test_founder_name_verified_true`, `test_founder_name_verified_false_on_fetch_error` | AGT-08 | 05-09 |
  | tests/agents/test_founder_bio.py | `test_role_framing` | AGT-10 | 05-10 |
  | tests/agents/test_bonus.py | `test_big_budget_branch`, `test_jingle_branch`, `test_spec_ad_branch` | AGT-11 | 05-11 |
  | tests/agents/test_game.py | `test_no_external_deps` | AGT-12 | 05-11 |
  | tests/agents/test_design.py | `test_font_whitelist`, `test_hex_validation`, `test_wcag_fallback` | AGT-13, AGT-14 | 05-11 |
  | tests/agents/test_editor_final.py | `test_editor_final_emits_event` | AGT-16 | 05-12 |
  | tests/agents/test_tool_limits.py | `test_scout_max_tool_calls`, `test_researcher_max_tool_calls` | AGT-18 | 05-13 |
  | tests/agents/qa/test_rules.py | `test_exclamation_marks_caught`, `test_sentiment_keywords_caught`, `test_winking_caught`, `test_ai_reference_caught`, `test_unverified_name_caught` | AGT-15 | 05-12 |
  | tests/agents/qa/test_judge.py | `test_judge_emits_findings`, `test_judge_writes_qa_corrections` | AGT-15 | 05-12 |
  | tests/lib/test_wcag.py | `test_validate_hex_valid`, `test_validate_hex_invalid`, `test_wcag_aa_pass`, `test_wcag_aa_fail`, `test_safe_theme_passes` | AGT-13 | 05-03 |
  | tests/lib/test_voice.py | `test_prompt_isolation`, `test_voice_constants_present` | AGT-09 | 05-03 |
  | tests/lib/test_openrouter.py | `test_model_version_recording`, `test_stub_mode_path` | AGT-17 | 05-03 |
  | tests/lib/test_cost.py | `test_soft_warn_at_70_pct`, `test_hard_cap_at_100_pct` | (cost cap) | 05-03 |
  | tests/test_pipeline_real_mode.py | `test_real_mode_pipeline_end_to_end` | (phase gate) | 05-13 |

  For each file, generate the test functions using the template above. Each function is independently skip-marked so the wave plan can remove only the markers it implements.

  Sanity check: every test function MUST start with `test_` so pytest discovers it. Every function MUST be `pytest.mark.skip`-decorated at creation time. The implementing plan removes the skip marker AND adds the real assertions in the same task.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/ --collect-only -q 2>&1 | tail -10 && uv run python -c "import subprocess; r = subprocess.run(['uv', 'run', 'pytest', 'tests/', '--collect-only', '-q'], capture_output=True, text=True); assert 'test_bonus_rotation' in r.stdout, 'test_bonus_rotation missing'; assert 'test_no_external_deps' in r.stdout, 'test_no_external_deps missing'; assert 'test_unverified_name_caught' in r.stdout, 'qa rule test missing'; assert r.returncode == 0, f'pytest collect failed: {r.stderr}'; print('OK')"</automated>
  </verify>

  <acceptance_criteria>
    - 21 test files exist at the listed paths
    - `tests/agents/__init__.py` and `tests/agents/qa/__init__.py` exist (package files)
    - Every test function in every file has `@pytest.mark.skip(reason="Wave N: pending...")`
    - `pytest tests/ --collect-only` exits 0 and lists ≥ 30 discovered test functions
    - `grep -rE '^def test_' tests/agents/ tests/lib/ tests/test_pipeline_real_mode.py | wc -l` returns ≥ 30
    - No file is missing a `from __future__ import annotations` import
  </acceptance_criteria>

  <done>
  Test surface complete. Every Phase 5 requirement has a discoverable test file. Wave tasks unskip-and-implement; pytest stays green throughout.
  </done>
</task>

<task type="auto">
  <name>Task 3: Create agents/design/font_whitelist.py — Andrew-approval candidate list</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py, packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py</files>

  <read_first>
    - .planning/phases/05-agent-quality/05-RESEARCH.md §"Font Whitelist" lines 1143-1196 (exact candidate list)
    - .planning/phases/05-agent-quality/05-CONTEXT.md D-16 (Andrew-approval blocker)
    - apps/web/lib/theme.ts (Phase 2 approved fonts — 6 already-approved baseline)
    - .planning/STATE.md Blockers/Concerns "Phase 5 Font whitelist..."
  </read_first>

  <action>
  Create `packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` as empty package file:

  ```python
  """Phase 5 DesignAgent submodules. font_whitelist requires Andrew approval (D-16)."""
  ```

  Create `packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py` with the EXACT candidate list from RESEARCH §"Font Whitelist" lines 1143-1193 (verbatim — do not paraphrase font names):

  ```python
  """Phase 5 D-16 — DesignAgent font whitelist (candidate list pending Andrew approval).

  TODO(Andrew): approve or revise this candidate list BEFORE Phase 5 closes.
  Each font must be:
    1. Available on Google Fonts (SIL Open Font License or equivalent)
    2. Renderable by WeasyPrint on Ubuntu fontconfig (Phase 6 PDF generation)
    3. Compatible with Phase 2 theme engine validators (apps/web/lib/theme.ts)

  Phase 2 already approved 6 fonts; this file extends the list with 19 candidates.
  The fallback defaults (FALLBACK_FONT_DISPLAY, FALLBACK_FONT_BODY) are Phase 2-approved
  so DesignAgent fallback path is safe even before Andrew approves the extended list.

  Plan 05-15 (Wave 8) is where Andrew reviews and signs off on the extended candidates
  before the phase closes.
  """
  from __future__ import annotations

  WHITELIST_DISPLAY: list[str] = [
      # ── Phase 2 approved (locked) ─────────────────────────────────
      "Playfair Display",
      "Lora",
      "Cormorant Garamond",
      "Merriweather",
      "DM Serif Display",
      # ── Phase 5 candidates — Andrew approval pending ──────────────
      "Libre Baskerville",
      "EB Garamond",
      "Crimson Text",
      "Spectral",
      "Source Serif Pro",
      "Josefin Serif",
      "Zilla Slab",
      "Bitter",
  ]

  WHITELIST_BODY: list[str] = [
      # ── Phase 2 approved (locked) ─────────────────────────────────
      "Inter",
      "Lora",
      "Merriweather",
      # ── Phase 5 candidates — Andrew approval pending ──────────────
      "Source Serif Pro",
      "Libre Baskerville",
      "EB Garamond",
      "Crimson Text",
      "PT Serif",
      "Noto Serif",
      "Roboto Slab",
      "IBM Plex Serif",
      "Noto Sans",
  ]

  # Union set for O(1) membership check in agents/design.py validation.
  FONT_WHITELIST: set[str] = set(WHITELIST_DISPLAY + WHITELIST_BODY)

  # D-16 fallback defaults — used when DesignAgent regenerates twice and still
  # emits an unapproved font. Both are Phase 2-approved so the fallback is safe
  # even before Andrew reviews the extended candidate list.
  FALLBACK_FONT_DISPLAY: str = "Playfair Display"
  FALLBACK_FONT_BODY: str = "Source Serif Pro"
  ```

  Sanity check: the file has zero imports beyond `__future__`. It's a pure-data module.
  </action>

  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.design.font_whitelist import WHITELIST_DISPLAY, WHITELIST_BODY, FONT_WHITELIST, FALLBACK_FONT_DISPLAY, FALLBACK_FONT_BODY; assert 'Playfair Display' in WHITELIST_DISPLAY; assert 'Inter' in WHITELIST_BODY; assert FALLBACK_FONT_DISPLAY == 'Playfair Display'; assert FALLBACK_FONT_BODY == 'Source Serif Pro'; assert isinstance(FONT_WHITELIST, set); assert len(FONT_WHITELIST) >= 18; print('OK')" && grep -c 'TODO(Andrew)' /Users/user/Desktop/Eisenbalm/packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py</automated>
  </verify>

  <acceptance_criteria>
    - `packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` exists
    - `packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py` exists
    - `WHITELIST_DISPLAY` contains at least: `'Playfair Display'`, `'Lora'`, `'Cormorant Garamond'`, `'Merriweather'`, `'DM Serif Display'` (Phase 2 baseline)
    - `WHITELIST_BODY` contains at least: `'Inter'`, `'Lora'`, `'Merriweather'` (Phase 2 baseline)
    - `FALLBACK_FONT_DISPLAY == 'Playfair Display'`
    - `FALLBACK_FONT_BODY == 'Source Serif Pro'`
    - `FONT_WHITELIST` is a `set` with ≥ 18 entries
    - File contains `TODO(Andrew)` marker exactly once
    - Module has zero runtime imports beyond `__future__`
  </acceptance_criteria>

  <done>
  Font whitelist file ships with safe fallback defaults. DesignAgent (Plan 05-12) can import + enforce immediately; Andrew's final approval (Plan 05-15) refines the candidate list.
  </done>
</task>

</tasks>

<verification>
- `pytest tests/ --collect-only -q` exits 0 with ≥ 30 discovered tests
- Every Phase 5 REQ-ID has at least one corresponding test file
- font_whitelist.py importable from `eisenbalm_pipeline.agents.design.font_whitelist`
- Phase 4 test fixtures + commands continue working (`EISENBALM_STUB_MODE=true pytest tests/test_pipeline_smoke.py` green)
</verification>

<success_criteria>
- 21 test files + 4 init/conftest files committed
- pytest collection green
- font_whitelist.py shipped with Andrew approval marker
- No production agent body code changed (this plan is test infrastructure + data only)
</success_criteria>

<output>
After completion, create `.planning/phases/05-agent-quality/05-04-test-infrastructure-and-font-whitelist-SUMMARY.md`.
</output>
