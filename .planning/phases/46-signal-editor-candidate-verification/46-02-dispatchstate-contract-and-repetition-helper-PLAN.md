---
phase: 46-signal-editor-candidate-verification
plan: 02
type: execute
wave: 2
depends_on: ["46-01"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/registry_repetition.py
  - packages/pipeline/src/eisenbalm_pipeline/api/registry.py
  - packages/pipeline/tests/lib/test_registry_repetition.py
autonomous: true
requirements: [SGE-01, SGE-03, SGE-04, SGE-05]

must_haves:
  truths:
    - "DispatchState carries story_leads + verification_records as JSON-safe list[dict] fields that survive the Postgres checkpoint"
    - "The shipped repetition-note counting algorithm is a shared helper both api/registry.py and the Signal Editor call — not reinvented"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/state.py"
      provides: "StoryLead + VerificationRecord TypedDicts + 2 DispatchState fields"
      contains: "class StoryLead"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/registry_repetition.py"
      provides: "compute_repetition_note(sanity_rows) -> dict"
      contains: "def compute_repetition_note"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/registry.py"
      to: "lib/registry_repetition.compute_repetition_note"
      via: "delegation (no behavior change)"
      pattern: "compute_repetition_note"
---

<objective>
Add the StoryLead + VerificationRecord TypedDicts and the two new JSON-safe DispatchState fields (matching API_CONTRACTS §46), and extract the shipped repetition-note counting algorithm into a shared helper the Signal Editor will reuse.

Purpose: state.py must speak the §46 vocabulary before either agent (46-04/46-05) can write to it, and it must stay JSON-serializable so the Postgres checkpointer resumes across the new nodes (SGE-04). SGE-05's warning logic already exists verbatim in api/registry.py::repetition_note — RESEARCH mandates extracting, not reinventing.
Output: two new TypedDicts + two DispatchState fields, lib/registry_repetition.py, api/registry.py delegating to it, a helper unit test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/46-signal-editor-candidate-verification/46-CONTEXT.md
@.planning/phases/46-signal-editor-candidate-verification/46-RESEARCH.md
@docs/API_CONTRACTS.md
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py
@packages/pipeline/src/eisenbalm_pipeline/api/registry.py
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Extract compute_repetition_note into lib/registry_repetition.py</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/registry_repetition.py, packages/pipeline/src/eisenbalm_pipeline/api/registry.py, packages/pipeline/tests/lib/test_registry_repetition.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/registry.py (lines 99-178) — the repetition_note endpoint whose counting body (lines 140-176) is extracted VERBATIM
    - packages/pipeline/tests/test_repetition_note.py — the existing `_FEATURED_ROWS_OVER_REPRESENTED` fixture shape (3 rows sharing focusArea="weather" + location="US-SE" → "avoid US-SE · avoid weather")
    - .planning/phases/40-* references for REPETITION_THRESHOLD=3 + geo-before-cause tie-break (embedded in api/registry.py)
  </read_first>
  <behavior>
    - compute_repetition_note([]) returns {"note": None, "avoid": [], "sampleSize": 0}
    - Given 3 rows with focusArea="weather" and location="US-SE", compute_repetition_note(rows) returns note == "avoid US-SE · avoid weather" (geo before cause) and avoid has 2 entries with dimension/value/count
    - Below-threshold values (count < 3) produce note=None
    - Ties break geo-before-cause then value ascending; result capped at 2 avoid entries
  </behavior>
  <action>
    1. Create `lib/registry_repetition.py` with `REPETITION_THRESHOLD = 3`, `_REPETITION_DIMENSION_ORDER = {"geo": 0, "cause": 1}`, and `def compute_repetition_note(sanity_rows: list[dict]) -> dict`. Move the counting logic from api/registry.py lines 140-176 VERBATIM (dimension→lowercased-value→[count, display] counters over `focusArea`(cause)/`location`(geo); over_represented filter at >= threshold; sort by -count, dimension order, value asc; top 2; build `avoid` list of `{dimension, value, count}`; `note = " · ".join(f"avoid {v}")` or None). Return `{"note": note, "avoid": avoid, "sampleSize": len(sanity_rows)}`.
    2. Edit `api/registry.py::repetition_note` endpoint to DELEGATE: after fetching `sanity_rows`, call `compute_repetition_note(sanity_rows)` and return its dict (preserving the exact same JSON shape `{note, avoid, sampleSize}`). Remove the now-duplicated inline counter block. `sampleSize` must remain `len(rows)` (the Convex row count, not the Sanity join count) — if the helper's sampleSize differs from the endpoint's historical `len(rows)`, keep the endpoint returning `{**compute_repetition_note(sanity_rows), "sampleSize": len(rows)}` so the existing endpoint contract is byte-stable.
    3. Create `tests/lib/test_registry_repetition.py` asserting the behavior block above, reusing the `test_repetition_note.py` fixture shape.
  </action>
  <acceptance_criteria>
    - `grep -q "def compute_repetition_note" packages/pipeline/src/eisenbalm_pipeline/lib/registry_repetition.py` matches
    - `grep -q "compute_repetition_note" packages/pipeline/src/eisenbalm_pipeline/api/registry.py` matches (endpoint delegates)
    - `cd packages/pipeline && uv run pytest tests/lib/test_registry_repetition.py -q` exits 0
    - existing `uv run pytest tests/test_repetition_note.py -q` still passes (endpoint contract unchanged)
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/lib/test_registry_repetition.py tests/test_repetition_note.py -q</automated>
  </verify>
  <done>compute_repetition_note is the single shared algorithm; api/registry.py delegates; both the new unit test and the existing endpoint test pass.</done>
</task>

<task type="auto">
  <name>Task 2: Add StoryLead + VerificationRecord TypedDicts + 2 DispatchState fields</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/state.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py — the existing TypedDict style + the `featured_charity_keys: Optional[list[str]]` "list NOT set — JSON-serializable for LangGraph checkpoint" precedent (~L208) and `claims: NotRequired[list[dict]]` precedent (~L96)
    - docs/API_CONTRACTS.md §46 (from 46-01) — the authoritative field set these TypedDicts must match EXACTLY
    - RESEARCH Pitfall 6 — §7's code block is already drifted; do NOT try to reconcile it, just add the new fields
  </read_first>
  <action>
    In `graph/state.py`:
    1. Add `class StoryLead(TypedDict)` with the 11 §46 fields: `premise: str`, `datedPeg: str`, `pegSourceUrl: str`, `readerEnergy: str`, `charitableAngle: str`, `category: str`, `confidence: str`, `brandRiskFlag: bool`, `brandRiskReason: Optional[str]`, `repetitionWarning: Optional[str]`, `recommended: bool`.
    2. Add `class VerificationRecord(TypedDict)` with: `candidateId: str`, `candidateName: str`, `domainLive: bool`, `registrationId: Optional[str]`, `registrationVerified: bool`, `obscurity: dict` (holds `{pressHits: int, verdict: str}`), `status: Literal['pass','fail','unverified']`, `killed: bool`, `killReason: Optional[str]`, `checkedAt: int`.
    3. Add two fields to `class DispatchState` in the Phase-1 selection block (near `candidates`): `story_leads: Optional[list[StoryLead]]` and `verification_records: Optional[list[VerificationRecord]]`. Add an inline comment on each: `# Phase 46 — JSON-serializable list[dict] (NOT set/objects) so the Postgres checkpointer resumes across signal_editor→scout→verify_candidates (SGE-04). See docs/API_CONTRACTS.md §46.`
    Both TypedDicts define the SHAPE only; the Pydantic models that enforce them live at the agent boundaries (46-04/46-05). `Literal` is already imported in state.py.
  </action>
  <acceptance_criteria>
    - `grep -q "class StoryLead(TypedDict)" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` matches
    - `grep -q "class VerificationRecord(TypedDict)" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` matches
    - `grep -q "story_leads: Optional\[list\[StoryLead\]\]" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` matches
    - `grep -q "verification_records: Optional\[list\[VerificationRecord\]\]" packages/pipeline/src/eisenbalm_pipeline/graph/state.py` matches
    - `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.graph.state import DispatchState, StoryLead, VerificationRecord; print('STATE_OK')"` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.graph.state import DispatchState, StoryLead, VerificationRecord; print('STATE_OK')" && uv run pytest tests/test_builder_wiring.py -q</automated>
  </verify>
  <done>StoryLead + VerificationRecord + the two JSON-safe DispatchState fields import cleanly and match §46.</done>
</task>

</tasks>

<verification>
- compute_repetition_note extracted, api/registry.py delegates, helper + endpoint tests green
- StoryLead/VerificationRecord/story_leads/verification_records importable from state.py
</verification>

<success_criteria>
- DispatchState has story_leads + verification_records as JSON-safe list[dict] fields (SGE-04-safe)
- lib/registry_repetition.compute_repetition_note is the shared SGE-05 algorithm, both call sites delegating to it
- No regression in the existing repetition-note endpoint test
</success_criteria>

<output>
After completion, create `.planning/phases/46-signal-editor-candidate-verification/46-02-SUMMARY.md`
</output>
