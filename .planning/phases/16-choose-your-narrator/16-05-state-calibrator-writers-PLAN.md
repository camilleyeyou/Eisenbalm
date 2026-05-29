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
    - "Calibrator falls back to Jesse + emits inactive_narrator deliberation event when narrator.active is False"
    - "Narrative writer agents (origin_story, founder_bio, case_study, bonus) consume verbatim VOICE_CONSTRAINTS — no narrator-aware branching"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/state.py"
      provides: "Narrator TypedDict (aligned with Sanity narratorProfile schema from Plan 16-01); DispatchState narrator fields"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py"
      provides: "narrator resolution + inactive-fallback warning emission"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py"
      to: "packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.convex_mutation_safe"
      via: "module-level import + best-effort deliberation event for inactive-fallback warning"
      pattern: "from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe"
    - from: "packages/pipeline/src/eisenbalm_pipeline/state.Narrator"
      to: "apps/studio/schemas/narratorProfile.ts (Plan 16-01)"
      via: "field-name alignment — Python Narrator TypedDict mirrors Sanity narratorProfile schema fields verbatim"
      pattern: "name, slug, voiceConstraints, voiceRubric, exampleSamples, active"
---

<objective>
Add the narrator state slot, calibrator resolution logic, and confirm narrative writers (origin story, founder bio, case study, bonus) continue to consume `VOICE_CONSTRAINTS` verbatim.

Purpose: Establish the "narrator only affects chronicler + QA judge" boundary at the state and calibrator layers. NRR-01 (no voice drift on narrative writers) is enforced negatively here: by NOT branching on narrator in writer agents, and POSITIVELY verified by the Plan 16-02 byte-equivalence test of `VOICE_CONSTRAINTS`.

Output: Updated `state.py` (TypedDict additions + Narrator model aligned with Sanity narratorProfile schema from Plan 16-01), updated `calibrator.py` (narrator resolution path), no behavioural changes to the four narrative writer agents (but verified in this plan via tests).

Implements: D-02 (default narrator = Jesse), D-08 (Sanity narratorProfile field shape — `name`, `slug`, `voiceConstraints`, `voiceRubric`, `exampleSamples`, `active`), D-13 (override path), D-14 (inactive narrator fallback to Jesse + Convex warning event), NRR-01/03/05.
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
@apps/studio/schemas/narratorProfile.ts  # <-- created by Plan 16-01 — SOURCE OF TRUTH for field names
@packages/pipeline/src/eisenbalm_pipeline/state.py
@packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
@packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
@packages/pipeline/tests/test_calibrator_narrator.py  # <-- created by Plan 16-02 Task 2

<decisions_implemented>
- **D-02**: Default narrator is Jesse. If charity.narratorSlug is None or unresolved, use Jesse.
- **D-08**: Narrator TypedDict mirrors the Sanity `narratorProfile` schema verbatim — fields are `name` (str), `slug` (str), `voiceConstraints` (str), `voiceRubric` (str), `exampleSamples` (list[str]), `active` (bool). This is the canonical field-name surface; Plan 16-01 + CONTEXT D-08 set it. The Python test fixtures (16-02) and seed JSON (16-08a) MUST match.
- **D-13**: Override path is `state["narrator_slug"]` set before calibrator runs. Takes precedence over charity.narratorSlug.
- **D-14**: If resolved narrator has `active` field == False, fall back to Jesse and emit a `deliberationEvents` entry with type=`inactive_narrator_fallback` carrying the original slug.
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

Phase 16 additions — **canonical field surface from Plan 16-01 (Sanity narratorProfile schema) + CONTEXT D-08**:
```python
class Narrator(TypedDict):
    """Resolved narrator record (loaded from Sanity by calibrator).

    Field names mirror the Sanity narratorProfile schema (Plan 16-01) verbatim.
    Do not rename without amending docs/API_CONTRACTS.md §7 + apps/studio/schemas/narratorProfile.ts
    together (CLAUDE.md hard rule).
    """
    name: str                      # display name e.g. "Werner Herzog" — Sanity narratorProfile.name
    slug: str                      # url-slug — Sanity narratorProfile.slug.current (the inner string, not the wrapper object)
    voiceConstraints: str          # PERSONA_BLOCK content; Sanity narratorProfile.voiceConstraints (type: 'text')
    voiceRubric: str               # QA-judge persona rubric, plain text; Sanity narratorProfile.voiceRubric (type: 'text')
    exampleSamples: list[str]      # plain prose samples (NOT Portable Text); Sanity narratorProfile.exampleSamples (array of 'text')
    active: bool                   # narrator on/off switch; Sanity narratorProfile.active (default True). D-14: when False, calibrator falls back to Jesse.

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
  <name>Task 1: Extend DispatchState with narrator fields + add Narrator TypedDict aligned with Sanity narratorProfile schema</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/state.py</files>

  <read_first>
    1. READ `apps/studio/schemas/narratorProfile.ts` (created by Plan 16-01). The Sanity schema is the SOURCE OF TRUTH for field names. The Python `Narrator` TypedDict in this task MUST mirror the 6 `defineField` names verbatim: `name`, `slug`, `voiceConstraints`, `voiceRubric`, `exampleSamples`, `active`. Field types: name/slug/voiceConstraints/voiceRubric are str, exampleSamples is list[str], active is bool.
    2. READ the current `packages/pipeline/src/eisenbalm_pipeline/state.py` end-to-end. Note all existing TypedDicts and the exact `DispatchState` schema.
    3. CONFIRM the existing import block uses `from typing import TypedDict` (or compatible). Note: `Literal` is NOT needed for this plan because `active` is now a plain `bool`, not a Literal["active","inactive"] string.
    4. READ `.planning/phases/16-choose-your-narrator/16-CONTEXT.md` D-08 to re-confirm the field surface: 6 fields exactly, with `active: boolean (default true)` — NOT a status string.
    5. READ `packages/pipeline/tests/test_narrator_seed_sentinel.py` (Plan 16-02 Task 1). It calls `jesse_entry.get("voiceConstraints")` and reads `{"active": False}` from fixtures — these field names are the test contract this plan MUST honor.
  </read_first>

  <action>
    Edit `state.py`:

    1. Add ONE new module-level TypedDict ABOVE `DispatchState`:
       ```python
       class Narrator(TypedDict):
           """Resolved narrator record. Loaded from Sanity by the calibrator agent (Plan 16-05 Task 2).

           Field names mirror the Sanity narratorProfile schema (Plan 16-01 + CONTEXT D-08) verbatim.
           Renaming any field here REQUIRES a matching rename in:
             - apps/studio/schemas/narratorProfile.ts
             - apps/studio/seeds/narrators.json
             - apps/studio/scripts/seed-narrators.ts
             - docs/API_CONTRACTS.md §7
           Per CLAUDE.md hard rule, contract changes happen first.
           """
           name: str                      # display name (Sanity narratorProfile.name)
           slug: str                      # url-slug (Sanity narratorProfile.slug.current — inner string)
           voiceConstraints: str          # PERSONA_BLOCK content (Sanity narratorProfile.voiceConstraints, type: 'text')
           voiceRubric: str               # QA-judge persona rubric, plain text (Sanity narratorProfile.voiceRubric, type: 'text')
           exampleSamples: list[str]      # plain prose samples (Sanity narratorProfile.exampleSamples, array of 'text')
           active: bool                   # narrator on/off switch (Sanity narratorProfile.active; default True; D-14: when False → fall back to Jesse)
       ```

       NOTE: The previous revision of this plan introduced a separate `NarratorVoiceRubric` structured TypedDict and a `status: Literal["active","inactive"]` field. Both were wrong relative to the Sanity schema (Plan 16-01) and the test fixtures (16-02). `voiceRubric` is a plain `str` (Sanity field type: 'text'); `active` is a plain `bool`. Do not reintroduce structured/Literal alternatives.

    2. Add two fields to `DispatchState` (preserve every existing field):
       ```python
       narrator: Narrator | None           # resolved by calibrator. None until calibrator runs.
       narrator_slug: str | None           # D-13 override; if set, takes precedence over charity.narratorSlug.
       ```

    3. If `state.py` exposes a `dispatch_state_initial(run_id, issue_number)` or similar initializer factory, add `narrator=None, narrator_slug=None` to its returned dict.

    Do NOT change any other TypedDict. Do NOT add a `NarratorVoiceRubric` TypedDict (the Sanity schema makes voiceRubric a plain `text` field — see Plan 16-01 + CONTEXT D-08).
  </action>

  <verify>
    <automated>
      # 1. State imports cleanly (Narrator only — no NarratorVoiceRubric, which was a wrong-schema artifact of the prior revision).
      uv run --project packages/pipeline python -c "from eisenbalm_pipeline.state import DispatchState, Narrator; print('ok')" | grep -q '^ok$'

      # 2. The Narrator TypedDict has the 6 canonical field names from the Sanity schema (Plan 16-01).
      grep -E "^\s*(name|slug|voiceConstraints|voiceRubric|exampleSamples|active)\s*:" packages/pipeline/src/eisenbalm_pipeline/state.py | head -20
      # Expect to see each of: name, slug, voiceConstraints, voiceRubric, exampleSamples, active.

      # 3. No legacy/wrong field names sneak in.
      ! grep -E "displayName\s*:" packages/pipeline/src/eisenbalm_pipeline/state.py
      ! grep -E '^\s*status\s*:\s*Literal\[' packages/pipeline/src/eisenbalm_pipeline/state.py
      ! grep -E "class NarratorVoiceRubric" packages/pipeline/src/eisenbalm_pipeline/state.py

      # 4. State scaffold tests exercise the new field (Plan 16-02 Task 2).
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py -v
    </automated>
  </verify>

  <done>
    - `Narrator` is exported as a module-level TypedDict with the 6 canonical Sanity field names: `name`, `slug`, `voiceConstraints`, `voiceRubric`, `exampleSamples`, `active`.
    - `voiceRubric` is `str` (plain text). `active` is `bool`. No `displayName`, no `status` Literal, no `NarratorVoiceRubric` structured wrapper.
    - `DispatchState` includes `narrator` and `narrator_slug` optional fields.
    - No existing field renamed or removed.
    - Initializer factory (if present) sets narrator fields to None.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Calibrator narrator resolution + D-14 inactive fallback warning (module-level convex_mutation_safe import)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py</files>

  <read_first>
    1. READ `apps/studio/schemas/narratorProfile.ts` (Plan 16-01) for the field names this resolver reads — specifically that `active: boolean` is the on/off switch (NOT `status: 'active'|'inactive'`).
    2. READ the FULL current `packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py`. Note:
       - the current import block,
       - the current calibrator entry point function name (e.g. `run_calibrator(state)` or `calibrator(state)`),
       - existing Sanity client usage.
    3. READ `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` and confirm `convex_mutation_safe` is exposed as a module-level coroutine.
    4. READ `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` for the existing helper used to fetch documents by slug. Reuse it if present; do not invent a new HTTP path. The narrator-loader MUST project the 6 canonical fields (`name`, `"slug": slug.current`, `voiceConstraints`, `voiceRubric`, `exampleSamples`, `active`) — NOT `displayName`, NOT a structured rubric object, NOT `status`.
    5. READ `packages/pipeline/tests/test_calibrator_narrator.py` (Plan 16-02 Task 2). The fixture uses `{"active": False}` for the parked-narrator scenario. The implementation MUST detect inactivity by reading `narrator["active"] is False`, NOT `narrator["status"] == "inactive"`.
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

           D-14: If the resolved narrator record has `active` == False,
           emit a deliberation event and fall back to Jesse. Note: the field
           name is `active: bool` (per Sanity narratorProfile schema — Plan 16-01 +
           CONTEXT D-08), NOT a `status: "active"|"inactive"` string.
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

           # D-14: detect inactivity by reading the boolean `active` field
           # (matches Sanity narratorProfile schema from Plan 16-01).
           if narrator_record.get("active") is False:
               # Best-effort Convex warning event, then fall back to Jesse.
               await convex_mutation_safe(
                   "deliberation:insertEvent",
                   {
                       "runId": state["run_id"],
                       "agentId": "calibrator",
                       "eventType": "inactive_narrator_fallback",
                       "payload": {
                           "originalSlug": chosen_slug,
                           "fellBackTo": "jesse",
                           "reason": "narrator marked inactive (active=False)",
                       },
                   },
               )
               logger.warning(
                   "Narrator %s marked inactive (active=False); falling back to Jesse (run_id=%s).",
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

    4. If `sanity_client.fetch_narrator_by_slug` does NOT exist yet in `sanity_client.py`, ADD a thin helper that does the GROQ-by-slug query (mirroring existing `fetch_charity_by_slug` style — see existing patterns). The helper returns `Narrator | None`. The GROQ projection MUST be:

       ```groq
       *[_type == "narratorProfile" && slug.current == $slug][0]{
         name,
         "slug": slug.current,
         voiceConstraints,
         voiceRubric,
         exampleSamples,
         active,
       }
       ```

       (matches the Sanity narratorProfile schema field names from Plan 16-01).

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

      # 5. Inactivity is detected via the boolean `active` field, not a `status` string.
      grep -E "narrator_record\.get\(.active.\)|narrator\[.active.\]" packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
      # Expect at least one match — the inactivity branch.
      ! grep -E 'narrator_record\[.status.\]\s*==\s*.inactive.' packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
      ! grep -E 'narrator\.get\(.status.\)\s*==\s*.inactive.' packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py

      # 6. Sanity GROQ projection (in calibrator.py OR sanity_client.py) uses the canonical schema fields.
      grep -E "voiceConstraints|voiceRubric|exampleSamples" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py | head -5
      # Expect matches naming the canonical fields. No displayName, no structured rubric object.
      ! grep -E "displayName" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
      ! grep -E '_type\s*==\s*.narrator.[^P]' packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
      # The Sanity _type is 'narratorProfile' (per Plan 16-01), never bare 'narrator'.

      # 7. Existing calibrator behaviour preserved.
      uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator.py -v
    </automated>
  </verify>

  <done>
    - `convex_mutation_safe` is imported at module level in calibrator.py.
    - `_resolve_narrator` exists and follows the D-13 precedence chain.
    - D-14 fallback emits a `deliberationEvents` row with `eventType="inactive_narrator_fallback"`; detection uses `narrator_record.get("active") is False` (NOT `status == "inactive"`).
    - `state["narrator"]` is populated after calibrator runs.
    - `state["narrator_slug"]` (input) is preserved.
    - `sanity_client.fetch_narrator_by_slug` (added if missing) projects the 6 canonical narratorProfile fields and queries `_type == "narratorProfile"`.
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
- The `Narrator` TypedDict in `state.py` has field names verbatim-matching the Sanity narratorProfile schema (`name`, `slug`, `voiceConstraints`, `voiceRubric`, `exampleSamples`, `active`); no `displayName`, no `status` Literal, no `NarratorVoiceRubric` wrapper.
</verification>

<success_criteria>
- All three tasks' verify blocks pass.
- Calibrator is the single narrator resolution point (NRR-03).
- Narrative writers are provably narrator-agnostic (NRR-01).
- D-14 inactive-narrator fallback observably writes to Convex via the mocked `convex_mutation_safe` — driven by `narrator["active"] is False`, not a status string.
- Field-name surface in `state.Narrator` is byte-aligned with Plan 16-01's Sanity schema; no schema-drift between Sanity, the seed (Plan 16-08a), and the pipeline.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-05-state-calibrator-writers-SUMMARY.md`. Record:
- The exact list of new state fields (and explicit confirmation that `voiceRubric` is `str`, `active` is `bool`, no `NarratorVoiceRubric` wrapper, no `status` Literal).
- The narrator precedence chain enforced in calibrator (D-13).
- Confirmation that `convex_mutation_safe` is imported at module level.
- The Sanity GROQ projection used by `fetch_narrator_by_slug` (the 6 canonical fields).
- Cross-reference to 16-06 (chronicler) and 16-07 (QA judge) which consume `state["narrator"]`.
</output>
</content>
</invoke>