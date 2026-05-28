---
phase: 16-choose-your-narrator
plan: 05
type: execute
wave: 3
depends_on: [16-01, 16-02, 16-04]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/state.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
autonomous: true
requirements:
  - NRR-01
  - NRR-03
  - NRR-05
must_haves:
  truths:
    - "DispatchState exposes optional `narrator: Narrator | None` and `narrator_slug: str | None`"
    - "Calibrator fetches narrator record by slug on the winning charity (or via override)"
    - "Calibrator falls back to Jesse + emits inactive_narrator deliberation event when narrator is inactive"
    - "Narrative writer agents (origin_story, founder_bio, case_study, bonus) consume verbatim VOICE_CONSTRAINTS — no narrator-aware branching"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/state.py"
      provides: "Narrator + NarratorVoiceRubric typed dicts; DispatchState narrator fields"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py"
      provides: "narrator resolution + inactive-fallback warning emission"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py"
      to: "packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.convex_mutation_safe"
      via: "module-level import + best-effort deliberation event for inactive-fallback warning"
      pattern: "from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe"
---

<objective>
Add the narrator state slot, calibrator resolution logic, and confirm narrative writers (origin story, founder bio, case study, bonus) continue to consume `VOICE_CONSTRAINTS` verbatim.

Purpose: Establish the "narrator only affects chronicler + QA judge" boundary at the state and calibrator layers. NRR-01 (no voice drift on narrative writers) is enforced negatively here: by NOT branching on narrator in writer agents, and POSITIVELY verified by the Plan 16-02 byte-equivalence test of `VOICE_CONSTRAINTS`.

Output: Updated `state.py` (TypedDict additions + Narrator/NarratorVoiceRubric models), updated `calibrator.py` (narrator resolution path), no behavioural changes to the four narrative writer agents (but verified in this plan via tests).

Implements: D-02 (default narrator = Jesse), D-13 (override path), D-14 (inactive narrator fallback to Jesse + Convex warning event), NRR-01/03/05.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/16-choose-your-narrator/16-CONTEXT.md
@.planning/phases/16-choose-your-narrator/16-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/state.py
@packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
@packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
@packages/pipeline/tests/test_calibrator_narrator.py  # <-- created by Plan 16-02 Task 2

<decisions_implemented>
- **D-02**: Default narrator is Jesse. If charity.narratorSlug is None or unresolved, use Jesse.
- **D-13**: Override path is `state["narrator_slug"]` set before calibrator runs. Takes precedence over charity.narratorSlug.
- **D-14**: If resolved narrator has `status='inactive'`, fall back to Jesse and emit a `deliberationEvents` entry with type=`inactive_narrator_fallback` carrying the original slug.
- **NRR-01**: Narrative writer agents continue to use verbatim VOICE_CONSTRAINTS. No conditional branching on narrator.
- **NRR-03**: Calibrator is the SINGLE narrator resolution point. Chronicler/QA judge read `state["narrator"]` (resolved object), not `state["narrator_slug"]` (raw string).
</decisions_implemented>

<interfaces>
Current `DispatchState` (state.py) fields (Phase 14 baseline — preserve all):
```python
class DispatchState(TypedDict):
    run_id: str
    issue_number: int
    style_brief: StyleBrief | None
    candidates: list[CharityCandidate]
    winning_charity: Charity | None
    winning_charity_sanity_id: str | None
    # ... etc (all existing fields)
```

Phase 16 additions:
```python
class Narrator(TypedDict):
    """Resolved narrator record (loaded from Sanity by calibrator)."""
    slug: str
    displayName: str
    voiceRubric: NarratorVoiceRubric
    exampleSamples: list[str]
    status: Literal["active", "inactive"]

class NarratorVoiceRubric(TypedDict):
    """Voice rubric structure used by chronicler prompt + QA judge."""
    register: str          # e.g. "Maya Rudolph: sly, dry, warm but precise"
    constraints: list[str] # e.g. ["No 1980s sitcom callbacks", "No ironic asides"]
    cadence: str           # e.g. "Short declarative sentences with one well-placed comma"

# Added to DispatchState:
    narrator: Narrator | None           # resolved by calibrator (default = Jesse record)
    narrator_slug: str | None           # override path (D-13); if set, takes precedence over charity.narratorSlug
```

`convex_mutation_safe` signature (from `lib/convex_client.py` — Phase 8/15 unchanged):
```python
async def convex_mutation_safe(mutation_name: str, args: dict) -> None:
    """Best-effort Convex mutation: logs on failure, never raises."""
```
</interfaces>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend DispatchState with narrator fields + add Narrator/NarratorVoiceRubric TypedDicts</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/state.py</files>

  <read_first>
    1. READ the current `packages/pipeline/src/eisenbalm_pipeline/state.py` end-to-end. Note all existing TypedDicts and the exact `DispatchState` schema.
    2. CONFIRM the existing import block uses `from typing import TypedDict, Literal` (or compatible). If `Literal` is missing, add it.
  </read_first>

  <action>
    Edit `state.py`:

    1. Add two new module-level TypedDicts ABOVE `DispatchState`:
       ```python
       class NarratorVoiceRubric(TypedDict):
           """Per-narrator voice rubric. Used as chronicler system prompt addendum and as the QA judge rubric override."""
           register: str
           constraints: list[str]
           cadence: str

       class Narrator(TypedDict):
           """Resolved narrator record. Loaded from Sanity by the calibrator agent (Plan 16-05 Task 2)."""
           slug: str
           displayName: str
           voiceRubric: NarratorVoiceRubric
           exampleSamples: list[str]
           status: Literal["active", "inactive"]
       ```

    2. Add two fields to `DispatchState` (preserve every existing field):
       ```python
       narrator: Narrator | None           # resolved by calibrator. None until calibrator runs.
       narrator_slug: str | None           # D-13 override; if set, takes precedence over charity.narratorSlug.
       ```

    3. If `state.py` exposes a `dispatch_state_initial(run_id, issue_number)` or similar initializer factory, add `narrator=None, narrator_slug=None` to its returned dict.

    Do NOT change any other TypedDict.
  </action>

  <verify>
    <automated>
      # State imports cleanly.
      uv run --project packages/pipeline python -c "from eisenbalm_pipeline.state import DispatchState, Narrator, NarratorVoiceRubric; print('ok')" | grep -q '^ok$'

      # State scaffold tests pass via the calibrator narrator tests (which load narrator into DispatchState and exercise the new field — Plan 16-02 Task 2).
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py -v
    </automated>
  </verify>

  <done>
    - `Narrator` and `NarratorVoiceRubric` are exported as module-level TypedDicts.
    - `DispatchState` includes `narrator` and `narrator_slug` optional fields.
    - No existing field renamed or removed.
    - Initializer factory (if present) sets narrator fields to None.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Calibrator narrator resolution + D-14 inactive fallback warning (module-level convex_mutation_safe import)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py</files>

  <read_first>
    1. READ the FULL current `packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py`. Note:
       - the current import block,
       - the current calibrator entry point function name (e.g. `run_calibrator(state)` or `calibrator_node(state)`),
       - existing Sanity client usage.
    2. READ `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` and confirm `convex_mutation_safe` is exposed as a module-level coroutine.
    3. READ `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` for the existing helper used to fetch documents by slug. Reuse it if present; do not invent a new HTTP path.
  </read_first>

  <action>
    Edit `calibrator.py`:

    1. **Add `convex_mutation_safe` as a MODULE-LEVEL import** (alongside existing imports at the top of the file). This is required so that `unittest.mock.patch("eisenbalm_pipeline.agents.calibrator.convex_mutation_safe", ...)` intercepts it correctly per the Python "patch where it's looked up" convention. Do NOT use an inline (function-body) import — the Plan 16-02 Task 2 test patches at the import site, and an inline import would silently bypass the mock.

       ```python
       from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
       ```

    2. Add a narrator resolution helper (private to the module — name it `_resolve_narrator`):

       ```python
       async def _resolve_narrator(
           state: DispatchState,
           sanity_client: SanityClient,  # or whatever the existing client type is
       ) -> Narrator:
           """
           Resolve which narrator to use for this run.

           Precedence (D-13):
             1. state["narrator_slug"] (override) if set
             2. winning_charity.narratorSlug if set
             3. "jesse" (default per D-02)

           D-14: If the resolved narrator record has status='inactive',
           emit a deliberation event and fall back to Jesse.
           """
           override_slug = state.get("narrator_slug")
           charity_slug = (state.get("winning_charity") or {}).get("narratorSlug")
           chosen_slug = override_slug or charity_slug or "jesse"

           narrator_record = await sanity_client.fetch_narrator_by_slug(chosen_slug)
           if narrator_record is None:
               # Slug pointed at a missing record — silently fall back to Jesse, but log.
               logger.warning(
                   "Narrator slug %s did not resolve; falling back to Jesse.",
                   chosen_slug,
               )
               return await sanity_client.fetch_narrator_by_slug("jesse")

           if narrator_record["status"] == "inactive":
               # D-14: best-effort Convex warning event, then fall back to Jesse.
               await convex_mutation_safe(
                   "deliberation:insertEvent",
                   {
                       "runId": state["run_id"],
                       "agentId": "calibrator",
                       "eventType": "inactive_narrator_fallback",
                       "payload": {
                           "originalSlug": chosen_slug,
                           "fellBackTo": "jesse",
                           "reason": "narrator status == 'inactive'",
                       },
                   },
               )
               logger.warning(
                   "Narrator %s is inactive; falling back to Jesse (run_id=%s).",
                   chosen_slug,
                   state["run_id"],
               )
               return await sanity_client.fetch_narrator_by_slug("jesse")

           return narrator_record
       ```

    3. In the existing calibrator entry function (after `winning_charity` has been confirmed), call `_resolve_narrator` and write the result back to state:
       ```python
       resolved = await _resolve_narrator(state, sanity_client)
       state["narrator"] = resolved
       # Do NOT clear state["narrator_slug"]; preserve the override input for auditability.
       ```

    4. If `sanity_client.fetch_narrator_by_slug` does NOT exist yet in `sanity_client.py`, ADD a thin helper that does the GROQ-by-slug query (mirroring existing `fetch_charity_by_slug` style — see existing patterns). The helper returns `Narrator | None`.

    Do NOT change calibrator's effect on `style_brief`, `winning_charity`, or any other state field. Narrator resolution is additive.
  </action>

  <verify>
    <automated>
      # 1. Named test for D-14 inactive-narrator fallback path (created by Plan 16-02 Task 2).
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py::test_inactive_narrator_falls_back_to_jesse_with_warning -v

      # 2. Full calibrator narrator test file passes.
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py -v

      # 3. convex_mutation_safe is a MODULE-LEVEL import (so the mock-patch site works).
      grep -E "^from eisenbalm_pipeline\.lib\.convex_client import .*convex_mutation_safe" packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py | grep -v "^\s*#"
      # Should print exactly one line. (No leading whitespace = top-level import.)

      # 4. There is NO inline import of convex_mutation_safe inside any function body.
      ! grep -E "^\s+from eisenbalm_pipeline\.lib\.convex_client import .*convex_mutation_safe" packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
      # The leading "!" inverts: this line must FAIL to find any indented import.

      # 5. Existing calibrator behaviour preserved.
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator.py -v
    </automated>
  </verify>

  <done>
    - `convex_mutation_safe` is imported at module level in calibrator.py.
    - `_resolve_narrator` exists and follows the D-13 precedence chain.
    - D-14 fallback emits a `deliberationEvents` row with `eventType="inactive_narrator_fallback"`.
    - `state["narrator"]` is populated after calibrator runs.
    - `state["narrator_slug"]` (input) is preserved.
    - `test_calibrator_narrator.py::test_inactive_narrator_falls_back_to_jesse_with_warning` passes.
    - All existing Phase 14 calibrator tests still pass.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Confirm narrative writers (origin_story, founder_bio, case_study, bonus) remain narrator-agnostic</name>
  <files>
    packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
    packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
    packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
    packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py
  </files>

  <read_first>
    1. READ all four files end-to-end. Confirm each currently builds its system prompt from `VOICE_CONSTRAINTS` (verbatim).
    2. CONFIRM none of them currently reads `state["narrator"]` or `state["narrator_slug"]`.
  </read_first>

  <action>
    NO CODE CHANGES. The point of this task is to make narrator-agnosticism a verified property, not to edit files.

    Add a header comment to each of the four files (above the existing imports) that pins this guarantee in human-readable form for any future reviewer:

    ```python
    # ─── Phase 16 NRR-01 invariant ───────────────────────────────────────────────
    # This agent consumes VOICE_CONSTRAINTS VERBATIM. It must not branch on
    # state["narrator"] or state["narrator_slug"]. Narrator-aware behaviour lives
    # exclusively in the chronicler agent (16-06) and the QA judge (16-07).
    # The byte-equivalence guard for the system message lives in
    # packages/pipeline/tests/test_section_writer_voice_propagation.py
    # (Plan 16-02 Task 2).
    # ─────────────────────────────────────────────────────────────────────────────
    ```

    Do NOT add `narrator` to any function signature in these four files. Do NOT add any conditional that references narrator state.
  </action>

  <verify>
    <automated>
      # 1. Header comment present in all four narrative writer files.
      for f in origin_story founder_bio case_study bonus; do
        grep -q "Phase 16 NRR-01 invariant" packages/pipeline/src/eisenbalm_pipeline/agents/${f}.py || (echo "MISSING in ${f}.py" && exit 1)
      done

      # 2. None of the four files reads narrator state.
      for f in origin_story founder_bio case_study bonus; do
        ! grep -E '(state\["narrator|state\.get\("narrator|narrator_slug)' packages/pipeline/src/eisenbalm_pipeline/agents/${f}.py
      done
      # Each grep must exit non-zero (no match). The leading "!" turns absence into success.

      # 3. The four narrative writers propagate style_brief["voice"] to build_section_writer_prompt — Plan 16-02 Task 2 created this test.
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_section_writer_voice_propagation.py -v
    </automated>
  </verify>

  <done>
    - All four narrative writers carry the NRR-01 header comment.
    - Grep confirms none of them references narrator state.
    - `test_section_writer_voice_propagation.py` passes.
    - No behavioural regression on Phase 14 writer tests.
  </done>
</task>

</tasks>

<verification>
- `uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py packages/pipeline/tests/test_section_writer_voice_propagation.py -v` exits 0.
- Test count across the whole pipeline test suite is ≥ Phase 14 baseline (168) + Phase 16 additions from Plan 16-02.
- `grep -rE 'state\["narrator|narrator_slug' packages/pipeline/src/eisenbalm_pipeline/agents/{origin_story,founder_bio,case_study,bonus}.py` returns no matches.
</verification>

<success_criteria>
- All three tasks' verify blocks pass.
- Calibrator is the single narrator resolution point (NRR-03).
- Narrative writers are provably narrator-agnostic (NRR-01).
- D-14 inactive-narrator fallback observably writes to Convex via the mocked `convex_mutation_safe`.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-05-state-calibrator-writers-SUMMARY.md`. Record:
- The exact list of new state fields.
- The narrator precedence chain enforced in calibrator (D-13).
- Confirmation that `convex_mutation_safe` is imported at module level.
- Cross-reference to 16-06 (chronicler) and 16-07 (QA judge) which consume `state["narrator"]`.
</output>
