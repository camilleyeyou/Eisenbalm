---
phase: 36-voice-pass-de-slop-screen
plan: 02
type: execute
wave: 2
depends_on: [36-01]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py
  - packages/pipeline/tests/agents/qa/test_qa_axis_passthrough.py
  - packages/pipeline/tests/test_signoffs_endpoints.py
autonomous: true
requirements: [VOX-03, VOX-04]
must_haves:
  truths:
    - "A Layer-1 QA finding is written to qaCorrections with its predicate's true axis (gravity/sentiment/irony-signaling/precision/machine-tell), NOT collapsed to hard-rule"
    - "The facts-cleared sign-off no longer blocks on an open voice-axis error (only on factual/undefined-axis errors)"
    - "The sounds-human sign-off 409s open_voice_findings when any open error finding carries a voice axis, and succeeds when none do"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py"
      provides: "Layer-1 axis passthrough (§36.2 — collapse removed)"
      contains: "layer1"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py"
      provides: "VOICE_AXES partition: narrowed facts-cleared + new sounds-human prerequisite (§36.7)"
      contains: "VOICE_AXES"
    - path: "packages/pipeline/tests/test_signoffs_endpoints.py"
      provides: "RED tests for the partition (both sign-offs)"
      contains: "open_voice_findings"
  key_links:
    - from: "agents/qa/__init__.py::qa()"
      to: "qaCorrections:insert payload axis field"
      via: "f.axis passthrough (no hard-rule override)"
      pattern: "\"axis\": f.axis"
    - from: "api/signoffs.py sounds-human branch"
      to: "qaCorrections:byRunId open-error scan"
      via: "axis in VOICE_AXES filter"
      pattern: "VOICE_AXES"
---

<objective>
Land the two pipeline-side structural foundations the research proved must exist before any Voice Pass feature works (§36.2 + §36.7):

1. **Axis passthrough** — stop `agents/qa/__init__.py::qa()` overwriting every Layer-1 finding's axis to `"hard-rule"`. Each Layer-1 finding is written with its predicate's true axis. Without this, the D-05 `machine-tell` finding (Plan 36-05) becomes `"hard-rule"` on write and Voice Pass's axis filter never sees it (research Pitfall 3).
2. **Sign-off axis partition** — narrow the shipped `facts-cleared` prerequisite so an open voice error no longer double-blocks it (Pitfall 2), and add the server-enforced `sounds-human` prerequisite (D-12/D-14) that 409s when open error voice findings remain.

Purpose: These are the "every downstream task silently fails otherwise" foundations flagged in the sequencing guidance. They must land (with RED tests) before the machine-tell predicate (36-05) and the Voice Pass sign-off UI (36-07).
Output: passthrough in `qa/__init__.py`; `VOICE_AXES` partition in `signoffs.py`; RED tests for both.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-voice-pass-de-slop-screen/36-RESEARCH.md
@docs/API_CONTRACTS.md
@packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py
@packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py
@packages/pipeline/tests/test_signoffs_endpoints.py

<interfaces>
<!-- CURRENT collapse to remove (agents/qa/__init__.py:187-198). Layer-1 raw findings already
     carry true per-predicate axis (gravity/sentiment/irony-signaling/precision); the comprehension
     overwrites them to "hard-rule". §36.2: drop the override, pass f.axis through. -->
```python
layer1_raw: list[QAFinding] = run_all_predicates(sections, research)
layer1: list[QAFinding] = [
    QAFinding(section=f.section, severity=f.severity, axis="hard-rule",
              quotedSpan=f.quotedSpan, reason=f.reason, suggestedFix=f.suggestedFix)
    for f in layer1_raw
]
```
<!-- CURRENT facts-cleared open-error scan to NARROW (api/signoffs.py:102-120): -->
```python
open_errors = [f for f in findings
    if f.get("severity") == "error" and not f.get("resolution")]
```
<!-- signoffs.py already branches `if body.kind == "facts-cleared":` (line 81) then comments
     `# kind == "sounds-human": no prerequisite checks (D-06, ungated).` (line 121). The new
     `elif body.kind == "sounds-human":` branch slots there. -->
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Remove Layer-1 axis collapse — write true per-predicate axis (§36.2)</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py (the qa() orchestrator, esp. lines 184-237 — the layer1 comprehension + the per-finding insert loop)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py (confirm each predicate's true axis: check_exclamation_marks→gravity, check_sentiment_keywords→sentiment, check_winking→irony-signaling, check_ai_reference→gravity, check_unverified_name→precision)
    - docs/API_CONTRACTS.md §36.2 (just-written passthrough contract)
    - packages/pipeline/tests/agents/qa/test_rules.py (predicate-level test patterns to mirror)
  </read_first>
  <behavior>
    - Test 1 (RED→GREEN): a section body with a sentiment keyword (e.g. "a truly heartwarming ending") flows through `qa()` and the resulting `state['qa_corrections']` entry for that finding has `axis == "sentiment"` (NOT `"hard-rule"`).
    - Test 2: a body with an exclamation mark yields a finding with `axis == "gravity"`.
    - Test 3: `check_unverified_name`'s precision finding surfaces with `axis == "precision"` (so it routes to Review Desk, not Voice Pass — Pitfall 5 resolved).
    - Test 4: the Convex `qaCorrections:insert` payload built in the loop carries `axis == f.axis` (assert on the captured mutation args via the fake/monkeypatched `convex_mutation_safe`).
  </behavior>
  <action>
    In `agents/qa/__init__.py::qa()`:
    - DELETE the `layer1` re-mapping comprehension (lines ~188-198) that sets `axis="hard-rule"`. Replace with `layer1 = layer1_raw` (each raw finding already carries its predicate's true axis).
    - Update the now-stale docstring/comments at lines ~184-186 and ~217-234 (the "Override Layer-1 axis to 'hard-rule'" and "axis carries the 6-literal union including 'hard-rule'" notes) to state §36.2: Layer-1 findings now write their true per-predicate axis; `hard-rule` is retired for new rows.
    - The per-finding insert loop already does `"axis": f.axis` — leave it; it now emits the true axis.
    - Create `packages/pipeline/tests/agents/qa/test_qa_axis_passthrough.py` with the four behavior tests. Mirror the monkeypatch style in `packages/pipeline/tests/test_findings_endpoints.py` / existing qa tests: patch `eisenbalm_pipeline.agents.qa.convex_mutation_safe` (or the module attribute the loop calls) to capture payloads; drive `qa()` with a minimal `DispatchState` and a stubbed `run_llm_judge` returning `[]` so only Layer-1 findings are asserted.

    Do NOT change `rules.py` (predicates already correct) and do NOT add the machine-tell predicate here — that is Plan 36-05.
  </action>
  <acceptance_criteria>
    - `grep -c "hard-rule" packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` returns 0 (the collapse and its comments are gone)
    - `grep -q "layer1 = layer1_raw" packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` (or an equivalent non-overriding assignment)
    - `packages/pipeline/tests/agents/qa/test_qa_axis_passthrough.py` exists and asserts `axis == "sentiment"` and `axis == "precision"`
    - `cd packages/pipeline && uv run pytest tests/agents/qa/test_qa_axis_passthrough.py tests/agents/qa/test_rules.py -x -q` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/qa/test_qa_axis_passthrough.py tests/agents/qa/test_rules.py -x -q</automated>
  </verify>
  <done>Layer-1 QA findings write their true predicate axis to qaCorrections; no `"hard-rule"` literal remains in the orchestrator; the passthrough is proven by a test that captures the insert payload.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Partition the sign-off prerequisites by axis (§36.7)</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py (the whole file — the facts-cleared branch at 81-120, the ungated sounds-human comment at 121)
    - packages/pipeline/tests/test_signoffs_endpoints.py (harness: `_run`, `_error_finding`, monkeypatch of `_cc.convex_query`/`convex_mutation`)
    - docs/API_CONTRACTS.md §36.3 (VOICE_AXES/FACTUAL_AXES) + §36.7 (both prerequisite shapes)
  </read_first>
  <behavior>
    - Test 1 (RED→GREEN): POST sign-off `{kind:"sounds-human"}` with one open `severity="error"`, `axis="machine-tell"` finding present → 409 with `detail.reason == "open_voice_findings"` and `detail.count == 1`.
    - Test 2: POST `{kind:"sounds-human"}` with NO open voice-axis error (all resolved, or only factual-axis errors) → 200 and `signOffs:record` called with `kind="sounds-human"`.
    - Test 3 (Pitfall 2 regression guard): POST `{kind:"facts-cleared"}` with claims all signed AND only an open `axis="sentiment"` (voice) error present → 200 (the voice error must NOT block facts-cleared).
    - Test 4: POST `{kind:"facts-cleared"}` with an open `axis="precision"` (factual) error → still 409 `open_error_findings` (factual errors still block facts-cleared).
  </behavior>
  <action>
    In `api/signoffs.py`:
    - Add a module constant `VOICE_AXES = {"gravity", "sentiment", "irony-signaling", "machine-tell"}` near `WORKSPACE_ID`.
    - NARROW the existing `facts-cleared` `open_errors` filter (lines ~105-108) to exclude voice axes:
      ```python
      open_errors = [
          f for f in findings
          if f.get("severity") == "error"
          and not f.get("resolution")
          and f.get("axis") not in VOICE_AXES   # §36.7 — voice errors belong to sounds-human
      ]
      ```
      (A finding with a missing/None axis is NOT in VOICE_AXES, so it still blocks facts-cleared — the safe factual default.)
    - ADD an `elif body.kind == "sounds-human":` branch (replacing the "no prerequisite checks" comment at line 121) that mirrors the facts-cleared open-error scan but scoped to voice axes:
      ```python
      elif body.kind == "sounds-human":
          findings = await _cc.convex_query(http, "qaCorrections:byRunId", {"runId": run_id}) or []
          open_voice_errors = [
              f for f in findings
              if f.get("severity") == "error"
              and not f.get("resolution")
              and f.get("axis") in VOICE_AXES
          ]
          if open_voice_errors:
              raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={
                  "reason": "open_voice_findings",
                  "message": f"{len(open_voice_errors)} voice finding(s) must be accepted or dismissed before signing sounds-human.",
                  "count": len(open_voice_errors),
              })
      ```
      Keep it anchor-blind (an orphaned voice error with no `resolution` still blocks — D-11b parity). Update the endpoint docstring's guard list (lines ~55-61) to reflect the new sounds-human prerequisite.
    - Extend `packages/pipeline/tests/test_signoffs_endpoints.py` with the four behavior tests, reusing `_error_finding(**overrides)` (add `axis="..."` overrides).
  </action>
  <acceptance_criteria>
    - `grep -q "VOICE_AXES" packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py`
    - `grep -q "open_voice_findings" packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py`
    - `grep -q "not in VOICE_AXES" packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` (facts-cleared narrowed)
    - `grep -q "open_voice_findings" packages/pipeline/tests/test_signoffs_endpoints.py`
    - `cd packages/pipeline && uv run pytest tests/test_signoffs_endpoints.py -x -q` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_signoffs_endpoints.py -x -q</automated>
  </verify>
  <done>facts-cleared ignores open voice-axis errors; sounds-human is server-gated on zero open voice-axis errors (409 open_voice_findings); both proven by tests; the two sign-offs partition the same qaCorrections table into disjoint gating halves.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/agents/qa/ tests/test_signoffs_endpoints.py -x -q` green.
- `cd packages/pipeline && uv run pytest -q` full suite stays green (no regression to the shipped facts-cleared path or the QA orchestrator).
- Reconciliation note (Phase 35 lesson / research Pitfall 7): if this plan runs in an isolated worktree alongside 36-03/36-04, its `qa/__init__.py` + `signoffs.py` changes MUST be reconciled onto master before Wave 3 (36-05 depends on this passthrough).
</verification>

<success_criteria>
Layer-1 axes survive to Convex; the facts-cleared / sounds-human prerequisites partition cleanly on VOICE_AXES; both foundations proven by RED-first tests.
</success_criteria>

<output>
After completion, create `.planning/phases/36-voice-pass-de-slop-screen/36-02-SUMMARY.md`.
</output>
