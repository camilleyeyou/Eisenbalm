---
phase: 16-choose-your-narrator
plan: 05
type: execute
wave: 2
depends_on: ["16-01", "16-02", "16-04"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/graph/state.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py
  - packages/pipeline/api/runs.py
autonomous: true
requirements: [NRR-03, NRR-04]
must_haves:
  truths:
    - "DispatchState carries narrator: NotRequired[Optional[dict]] field declared identically to API_CONTRACTS.md §7 (added by Plan 16-01)"
    - "lib/sanity_client.py exports async load_narrator_from_issue(issue_id: str) -> Optional[dict] that GROQ-dereferences weeklyIssue.narrator into {name, slug, voiceConstraints, voiceRubric, exampleSamples, active}"
    - "FastAPI startup path (api/runs.py /run/weekly handler) calls load_narrator_from_issue and seeds state['narrator'] BEFORE graph.ainvoke"
    - "Calibrator imports assemble_voice from lib/voice and uses it at BOTH stub-mode fallback (line 158) AND defensive fill (line 182) — style_brief['voice'] = assemble_voice(state.get('narrator'))"
    - "Calibrator emits inactive-narrator warning via existing Convex deliberationEvents.eventType='editor-decision' payload `{warning: 'inactive narrator <name> — fell back to Jesse'}` and proceeds with Jesse voice (D-14)"
    - "All 4 narrative writer agents (origin_story.py, problem.py, founder_bio.py, case_study.py) pass `voice_constraints=style_brief.get('voice', VOICE_CONSTRAINTS)` to build_section_writer_prompt — without this, narrator voice never reaches the writers (Pitfall 2)"
    - "Game agent (agents/game.py) is UNTOUCHED — stays on direct VOICE_CONSTRAINTS import per D-07 Game-stays-Jesse rule"
    - "All Wave 0 tests (test_calibrator_narrator, test_section_writer_voice_propagation) flip GREEN"
    - "Existing 168 pipeline tests + voice byte-equivalence tests stay GREEN"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/graph/state.py"
      provides: "DispatchState.narrator field"
      contains: "narrator"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
      provides: "load_narrator_from_issue helper"
      contains: "load_narrator_from_issue"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py"
      provides: "narrator-aware assembly + inactive narrator warning"
      contains: "assemble_voice"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py"
      provides: "voice_constraints kwarg propagation"
      contains: "voice_constraints=style_brief"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/problem.py"
      provides: "voice_constraints kwarg propagation"
      contains: "voice_constraints=style_brief"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py"
      provides: "voice_constraints kwarg propagation"
      contains: "voice_constraints=style_brief"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py"
      provides: "voice_constraints kwarg propagation"
      contains: "voice_constraints=style_brief"
    - path: "packages/pipeline/api/runs.py"
      provides: "load_narrator_from_issue invocation before graph.ainvoke"
      contains: "load_narrator_from_issue"
  key_links:
    - from: "api/runs.py POST /run/weekly handler"
      to: "lib/sanity_client.load_narrator_from_issue"
      via: "async call before graph.ainvoke, result seeded into initial state['narrator']"
      pattern: "await load_narrator_from_issue"
    - from: "agents/calibrator.py assemble_voice call"
      to: "lib/voice.assemble_voice"
      via: "import + invocation at line 158 + line 182"
      pattern: "assemble_voice(state.get"
    - from: "4 writer agents build_section_writer_prompt call sites"
      to: "lib/voice.build_section_writer_prompt voice_constraints kwarg"
      via: "explicit kwarg propagation from style_brief['voice']"
      pattern: "voice_constraints=style_brief"
---

<objective>
Wire the narrator surface end-to-end from Sanity load → DispatchState → Calibrator → 4 writers. This is the load-bearing plan for NRR-03 (Calibrator voice merge) and NRR-04 (4 writers consume narrator voice).

Per Research §C (Calibrator wiring) and Pitfall 2 (writers MUST explicitly pass voice_constraints kwarg or narrator voice silently falls back to Jesse default), this plan touches 8 files: graph/state.py + lib/sanity_client.py + agents/calibrator.py + 4 writers + api/runs.py. Each edit is small (≤20 lines each); the file count is high because narrator must flow through the full pipeline initialization path.

This plan does NOT touch the Chronicler (Plan 16-06) or the QA judge (Plan 16-07) — Chronicler reads style_brief["voice"] which the Calibrator already populates after this plan, so Chronicler narrator-awareness is technically free; the explicit refactor in Plan 16-06 is needed only to remove the direct VOICE_CONSTRAINTS import dependency and turn the chronicler Wave 0 test green.

This plan does NOT touch Game agent (D-07 Game-stays-Jesse) and does NOT touch Bonus/Researcher (out of scope per CONTEXT non-goals).

Output: 8 files modified; 2 Wave 0 tests flip GREEN (test_calibrator_narrator, test_section_writer_voice_propagation); 168 pipeline tests + 4 voice tests stay GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/16-choose-your-narrator/16-CONTEXT.md
@.planning/phases/16-choose-your-narrator/16-RESEARCH.md
@.planning/phases/16-choose-your-narrator/16-VALIDATION.md

<interfaces>
<!-- Plan 16-04 (already landed) ships: -->
from eisenbalm_pipeline.lib.voice import (
    VOICE_CONSTRAINTS,
    UNIVERSAL_CORE,
    JESSE_PERSONA_BLOCK,
    assemble_voice,
    build_section_writer_prompt,
)

<!-- API_CONTRACTS §7 (Plan 16-01 landed): -->
# DispatchState gains:
narrator: Optional[dict]   # {name, slug, voiceConstraints, voiceRubric, exampleSamples, active} or None

<!-- API_CONTRACTS §1.2 (frontend GROQ): voiceConstraints / voiceRubric / exampleSamples MUST NOT be projected — Plan 16-08 enforces -->

<!-- Pipeline-side GROQ (NEW — for the pipeline narrator load only; full pipeline-only projection): -->
*[_type == "weeklyIssue" && _id == $issueId][0]{
  narrator->{
    name,
    "slug": slug.current,
    voiceConstraints,
    voiceRubric,
    exampleSamples,
    active
  }
}
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add narrator field to DispatchState + load_narrator_from_issue helper in lib/sanity_client.py</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/graph/state.py, packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py</files>
  <behavior>
    - DispatchState gains `narrator: NotRequired[Optional[dict]]` with comment citing API_CONTRACTS §7
    - load_narrator_from_issue(issue_id) returns None when weeklyIssue.narrator is unset, or a dict with the 6 narratorProfile fields when set
    - load_narrator_from_issue tolerates Sanity unreachability — returns None on any exception (graceful degradation)
    - load_narrator_from_issue uses the existing groq_query helper (same dereference pattern as winning_charity)
  </behavior>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py FULL FILE (current 179 lines — preserve every existing field; insert narrator between lines 168-170)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py lines 337-382 (existing groq_query helper — the GROQ read pattern to reuse) + lines 36-68 (charity dereference exemplar)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §E (load_narrator_from_issue signature + GROQ query verbatim)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-09 (optional reference; absence = null) + D-14 (inactive narrator NOT silently honored — but the load itself returns the dict; Calibrator decides the fallback)
    - docs/API_CONTRACTS.md §7 narrator line (Plan 16-01 landed — confirm field exists and matches what we declare in state.py)
  </read_first>
  <action>
Two file edits.

(A) packages/pipeline/src/eisenbalm_pipeline/graph/state.py — insert this block immediately AFTER the line `featured_charity_keys: Optional[list[str]]   # AGT-04: ...` (around line 169) and BEFORE the `# ── Error handling ──` comment line:

```python

    # ── Phase 16: Narrator (NRR-02, NRR-03) ───────────────────────────────────
    # Loaded narratorProfile dict {name, slug, voiceConstraints, voiceRubric, exampleSamples, active}
    # or None. Sourced from weeklyIssue.narrator reference at pipeline start by
    # lib/sanity_client.load_narrator_from_issue. ONLY the Calibrator reads this
    # field (CONTEXT D-05 single injection point); all downstream agents
    # consume style_brief["voice"] which Calibrator sets via lib/voice.assemble_voice.
    # VERBATIM from docs/API_CONTRACTS.md §7 (Phase 16 addition).
    narrator: NotRequired[Optional[dict]]
```

(B) packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py — append at the end of the file (after the existing `set_charity_first_featured` function):

```python


# ── Phase 16: Narrator load (NRR-02) ─────────────────────────────────────


async def load_narrator_from_issue(issue_id: str) -> Optional[dict]:
    """Load the narrator profile dereference for a weeklyIssue, or None.

    Used by api/runs.py POST /run/weekly handler at pipeline start to seed
    state['narrator'] BEFORE the Calibrator runs. The Calibrator is the single
    injection point that reads state['narrator'] (CONTEXT D-05).

    Pipeline-side GROQ projection — includes voiceConstraints / voiceRubric /
    exampleSamples (the frontend projection per API_CONTRACTS §1.2 explicitly
    excludes these for security per Pitfall 8).

    Tolerant: any exception (Sanity unreachable, malformed response, missing
    narrator) returns None. The Calibrator handles None as the default Jesse
    voice path.

    Args:
        issue_id: Sanity weeklyIssue _id (e.g. "issue-42").

    Returns:
        {name, slug, voiceConstraints, voiceRubric, exampleSamples, active} dict
        or None.
    """
    query = (
        '*[_type == "weeklyIssue" && _id == $issueId][0]'
        '{ narrator->{ name, "slug": slug.current, voiceConstraints, '
        'voiceRubric, exampleSamples, active } }'
    )
    try:
        rows = await groq_query(query, params={"issueId": issue_id})
    except Exception:  # noqa: BLE001 — first-run / outage tolerance
        return None
    if not rows:
        return None
    row = rows[0] if isinstance(rows, list) else rows
    narrator = row.get("narrator") if isinstance(row, dict) else None
    return narrator if isinstance(narrator, dict) else None
```
  </action>
  <verify>
    <automated>grep -E "narrator: NotRequired\[Optional\[dict\]\]" packages/pipeline/src/eisenbalm_pipeline/graph/state.py returns a match; grep -E "async def load_narrator_from_issue" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py returns a match; uv run --project packages/pipeline python -c "from eisenbalm_pipeline.lib.sanity_client import load_narrator_from_issue; import inspect; sig = inspect.signature(load_narrator_from_issue); assert 'issue_id' in sig.parameters; print('OK')" prints 'OK'; uv run --project packages/pipeline pytest packages/pipeline/tests/ -x -q exits 0 (existing 168 + Phase 16 byte-equiv tests still green)</automated>
  </verify>
  <done>DispatchState.narrator field declared (matches API_CONTRACTS §7); load_narrator_from_issue helper exists with tolerant error handling; existing tests still green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire Calibrator to assemble_voice + inactive narrator warning (D-05 single injection point)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py</files>
  <behavior>
    - Calibrator imports `assemble_voice` alongside `VOICE_CONSTRAINTS` from lib/voice
    - Lines 156-166 (stub-mode fallback): `brief_dict["voice"] = assemble_voice(narrator)` where narrator is computed once at function entry
    - Line 181 (defensive fill): `brief_dict["voice"] = assemble_voice(narrator)`
    - Inactive narrator branch: if state.get('narrator') is a dict AND narrator.get('active') is False → emit a Convex deliberationEvents row with eventType='editor-decision' + payload JSON-string `{"warning": "inactive narrator <name> — fell back to Jesse"}`, then set narrator = None for the rest of the function
    - Wave 0 test_calibrator_narrator flips GREEN (3 tests: test_calibrator_uses_assemble_voice_with_narrator, test_calibrator_narrator_none_byte_equivalent_to_jesse, test_inactive_narrator_falls_back_to_jesse_with_warning)
    - When narrator is None, the stub-mode fallback brief_dict["voice"] == VOICE_CONSTRAINTS (byte-equal — NRR-10 zero-regression)
  </behavior>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py FULL FILE (current 197 lines — function body at lines 130-196 is the edit target)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (verify the `convex_mutation_safe` API — used to emit the deliberationEvents row for the inactive narrator warning; lookup the exact import name)
    - packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py (@agent_node decorator — confirm emit_event=None semantics and how to emit a custom event from within the node body)
    - packages/pipeline/tests/test_calibrator_narrator.py (the RED tests this task turns GREEN — confirms exact assertions: assemble_voice called, brief_dict["voice"] contains narrator content, inactive narrator emits warning via Convex)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-14 (inactive narrator: fall back to Jesse + log non-blocking warning via existing editor-decision eventType + no Convex schema change)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §C (Calibrator rewire pattern — exact 4 edits)
  </read_first>
  <action>
Edit packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py — four targeted edits.

(A) Line 27 — extend the lib.voice import to include `assemble_voice`:
```python
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, assemble_voice
```

(B) After line 134 (`run_id = state["run_id"]`), insert the narrator resolution block (lines added inside the `calibrator()` function body, before the `previous = await ...` line):

```python
    # ── Phase 16: Resolve narrator (D-05 single injection point, D-14 inactive fallback) ──
    narrator = state.get("narrator")
    if isinstance(narrator, dict) and narrator.get("active") is False:
        # D-14: inactive narrator silently parked — fall back to Jesse and emit
        # a non-blocking warning via the existing editor-decision eventType.
        # No new Convex schema field needed.
        try:
            from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
            import json as _json
            await convex_mutation_safe(
                "deliberationEvents:insert",
                {
                    "runId": run_id,
                    "agentId": "calibrator",
                    "eventType": "editor-decision",
                    "payload": _json.dumps({
                        "warning": (
                            f"inactive narrator {narrator.get('name', '?')} "
                            f"— fell back to Jesse"
                        ),
                        "narratorSlug": narrator.get("slug"),
                    }),
                },
            )
        except Exception as _exc:  # noqa: BLE001 — Convex failure must not block the run
            log.warning(
                "Calibrator: failed to emit inactive-narrator warning event: %r",
                _exc,
            )
        narrator = None
```

(C) Line 158 (inside the stub-mode `else:` branch — the `brief_dict = { ... "voice": VOICE_CONSTRAINTS, ... }` literal) — change the `"voice": VOICE_CONSTRAINTS,` line to:
```python
            "voice": assemble_voice(narrator),
```

(D) Line 181-182 (the defensive fill `if not brief_dict.get("voice"): brief_dict["voice"] = VOICE_CONSTRAINTS`) — change the assignment to:
```python
    if not brief_dict.get("voice"):
        brief_dict["voice"] = assemble_voice(narrator)
```

Leave _build_messages (lines 93-127) and the LLM call site (lines 143-148) UNCHANGED — they still embed the literal VOICE_CONSTRAINTS in the system prompt, and the defensive override at the new line 182 guarantees the right voice lands in `brief_dict["voice"]` regardless of what the LLM emitted. Per Research §C this is the minimal-safe wiring.
  </action>
  <verify>
    <automated>grep -E "from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, assemble_voice" packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py returns a match; grep -c "assemble_voice(narrator)" packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py returns at least 2 (stub-mode + defensive fill); grep -E "inactive narrator" packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py returns a match; uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py -q exits 0 (all 3 tests GREEN); uv run --project packages/pipeline pytest packages/pipeline/tests/ -x -q exits 0 (no regression on existing 168 + voice byte-equivalence)</automated>
  </verify>
  <done>Calibrator imports assemble_voice; narrator resolution branch handles active=False with warning event; both stub-mode + defensive-fill sites use assemble_voice; Wave 0 test_calibrator_narrator 3 tests GREEN; no regression.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Propagate voice_constraints kwarg in 4 narrative writer agents (Pitfall 2 mitigation — NRR-04)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py, packages/pipeline/src/eisenbalm_pipeline/agents/problem.py, packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py, packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py</files>
  <behavior>
    - All 4 writer agents pass `voice_constraints=style_brief.get("voice", VOICE_CONSTRAINTS)` to build_section_writer_prompt
    - Each writer adds an import: `from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, build_section_writer_prompt` (replacing the current single-symbol import)
    - The local variable `style_brief` is computed once at the top of the call site (defensive: `style_brief = state.get("style_brief") or {}`) to keep both build_section_writer_prompt args (the dict + the kwarg) sourced from the same value
    - Game agent (agents/game.py) is NOT touched — Game stays Jesse via direct VOICE_CONSTRAINTS import per D-07
    - test_section_writer_voice_propagation 4 parametrized tests flip GREEN
  </behavior>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py FULL FILE (87 lines — call site at lines 55-62)
    - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py lines 1-90 (call site near line 87)
    - packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py lines 1-100 (call site near line 90)
    - packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py lines 1-100 (call site near line 84)
    - packages/pipeline/tests/test_section_writer_voice_propagation.py (the RED test this task turns GREEN — captures voice_constraints kwarg via build_section_writer_prompt patch)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §C + Pitfall 2 (writers MUST add voice_constraints=style_brief.get("voice", VOICE_CONSTRAINTS) — single-line addition per writer)
    - packages/pipeline/src/eisenbalm_pipeline/agents/game.py line 21 (confirm game.py is NOT in the edit scope — it imports VOICE_CONSTRAINTS directly and keeps that import)
  </read_first>
  <action>
For each of the 4 narrative writer files, apply the same surgical edit pattern. Use `Read` first on each file to confirm exact line numbers (the call site signature is identical across all 4 — they all call build_section_writer_prompt(section_id=..., section_title=..., section_guidance=..., charity=..., research=..., style_brief=...)).

For each writer (origin_story.py, problem.py, founder_bio.py, case_study.py):

(A) Import line change. Locate the existing line:
```python
from eisenbalm_pipeline.lib.voice import build_section_writer_prompt
```
Replace with:
```python
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, build_section_writer_prompt
```

(B) Call site change. The current pattern in all 4 writers is:
```python
    messages = build_section_writer_prompt(
        section_id="<id>",
        section_title="<title>",
        section_guidance=SECTION_GUIDANCE,
        charity=state.get("winning_charity") or {},
        research=state.get("research") or {},
        style_brief=state.get("style_brief") or {},
    )
```

Refactor to extract style_brief once and add the voice_constraints kwarg:
```python
    style_brief = state.get("style_brief") or {}
    messages = build_section_writer_prompt(
        section_id="<id>",
        section_title="<title>",
        section_guidance=SECTION_GUIDANCE,
        charity=state.get("winning_charity") or {},
        research=state.get("research") or {},
        style_brief=style_brief,
        voice_constraints=style_brief.get("voice", VOICE_CONSTRAINTS),
    )
```

Apply this verbatim to all 4 files. No other change. Do NOT touch agents/game.py (Game stays Jesse — D-07).

For founder_bio.py and case_study.py: the call site has additional logic around state.get("winning_charity") and verification scrubbing (Plan 05-10 Pitfall 5). PRESERVE the existing scrub logic; only add the voice_constraints kwarg and the style_brief extraction. Read the exact file before editing.
  </action>
  <verify>
    <automated>for f in packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py packages/pipeline/src/eisenbalm_pipeline/agents/problem.py packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py; do grep -E "voice_constraints=style_brief" "$f" || { echo "FAIL $f"; exit 1; }; done; grep -E "voice_constraints" packages/pipeline/src/eisenbalm_pipeline/agents/game.py | wc -l returns 0 (Game agent NOT touched); uv run --project packages/pipeline pytest packages/pipeline/tests/test_section_writer_voice_propagation.py -q exits 0 (all 4 parametrized cases GREEN); uv run --project packages/pipeline pytest packages/pipeline/tests/ -x -q exits 0 (no regression on existing 168 + AGT-09 voice isolation tests in test_*_voice_isolation.py)</automated>
  </verify>
  <done>4 writer agents have voice_constraints=style_brief.get("voice", VOICE_CONSTRAINTS); game.py untouched; test_section_writer_voice_propagation 4 tests GREEN; AGT-09 voice isolation tests still GREEN.</done>
</task>

<task type="auto">
  <name>Task 4: Seed state['narrator'] in api/runs.py BEFORE graph.ainvoke</name>
  <files>packages/pipeline/api/runs.py</files>
  <read_first>
    - packages/pipeline/api/runs.py FULL FILE (current handler — locate the POST /run/weekly handler body and find where the initial DispatchState dict is built and graph.ainvoke is invoked)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (the load_narrator_from_issue helper landed in Task 1)
    - .planning/phases/16-choose-your-narrator/16-RESEARCH.md §E + §Open Question 3 (load narrator at pipeline start, before graph.ainvoke — exact location: alongside the issue_number → weeklyIssue lookup if one exists, or as a new call inline)
    - .planning/phases/16-choose-your-narrator/16-CONTEXT.md D-09 (narrator loaded from Sanity weeklyIssue.narrator reference)
  </read_first>
  <action>
Edit packages/pipeline/api/runs.py. Locate the POST /run/weekly handler (or whatever endpoint constructs the initial DispatchState and calls graph.ainvoke). The exact line numbers depend on the current file; use Read to confirm before editing.

(A) Import the helper at the top of the file:
```python
from eisenbalm_pipeline.lib.sanity_client import load_narrator_from_issue
```

(B) Immediately BEFORE the initial DispatchState dict construction (or BEFORE graph.ainvoke if state is built inline), add:

```python
    # ── Phase 16: Load narrator from Sanity weeklyIssue.narrator reference ──
    # Tolerant: returns None if Sanity unreachable, narrator unset, or issue not
    # yet in Sanity. The Calibrator handles None as the default Jesse voice path.
    issue_doc_id = f"issue-{issue_number}"
    narrator_doc = await load_narrator_from_issue(issue_doc_id)
```

(C) In the initial DispatchState literal (the dict passed to graph.ainvoke), add the narrator field:
```python
        "narrator": narrator_doc,
```

The exact insertion point in the DispatchState literal depends on the current file structure — insert it adjacent to other initial-state fields like run_id, issue_number, publish_date. Use Read to find the right block.

If the file does not currently have a clean initial-state literal (e.g., the state is built piecemeal via dict operations), add a single statement after the construction:
```python
    initial_state["narrator"] = narrator_doc
```

Preserve every existing field and the existing graph.ainvoke call signature.
  </action>
  <verify>
    <automated>grep -E "from eisenbalm_pipeline.lib.sanity_client import load_narrator_from_issue" packages/pipeline/api/runs.py returns a match; grep -E "load_narrator_from_issue\(" packages/pipeline/api/runs.py returns a match; grep -E "narrator.*narrator_doc|\"narrator\": narrator_doc|narrator_doc" packages/pipeline/api/runs.py returns at least 2 matches (import-level call + state-field assignment); uv run --project packages/pipeline pytest packages/pipeline/tests/ -x -q exits 0 (full suite green); uv run --project packages/pipeline pytest packages/pipeline/tests/test_calibrator_narrator.py packages/pipeline/tests/test_section_writer_voice_propagation.py packages/pipeline/tests/test_voice.py -q exits 0 (all Phase 16 wave-1-targeted tests GREEN)</automated>
  </verify>
  <done>api/runs.py calls load_narrator_from_issue before graph.ainvoke and seeds state['narrator']. Full pytest suite green.</done>
</task>

</tasks>

<verification>
- 2 Wave 0 RED tests flip GREEN: test_calibrator_narrator.py (3 tests) + test_section_writer_voice_propagation.py (4 parametrized cases).
- test_voice.py + test_narrator_seed_sentinel.py + test_narrator_cost_budget.py either GREEN or skip-guarded (depending on whether Plan 16-08 seed has landed — they may stay SKIPPED here).
- Full pipeline pytest suite (168 + ~9 new Phase 16) exits 0.
- Game agent untouched (grep voice_constraints in game.py = 0 matches outside the import statement which is unchanged).
- AGT-09 voice isolation tests (test_*_voice_isolation in Plan 05-10) stay GREEN — the voice_constraints kwarg addition does not violate the invariant.
</verification>

<success_criteria>
- NRR-03 (Calibrator narrator merge) verified by test_calibrator_narrator green.
- NRR-04 (4 writers consume narrator voice) verified by test_section_writer_voice_propagation green.
- D-14 (inactive narrator warning) verified by test_inactive_narrator_falls_back_to_jesse_with_warning green.
- Zero-regression on existing pipeline tests.
</success_criteria>

<output>
After completion, create `.planning/phases/16-choose-your-narrator/16-05-SUMMARY.md` documenting: the exact line changes in calibrator.py (before/after diff for the four edits), the writer-agent kwarg propagation diff, the api/runs.py narrator-load wiring, confirmation that Game agent and Bonus/Researcher were not touched, and the green-test count after this plan.
</output>
