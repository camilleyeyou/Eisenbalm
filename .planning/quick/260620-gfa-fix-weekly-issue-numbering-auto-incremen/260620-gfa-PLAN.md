---
phase: quick-260620-gfa
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
  - packages/pipeline/tests/api/test_runs.py
autonomous: true
requirements: [ISSUE-NUM-01]
must_haves:
  truths:
    - "A POST /run/weekly with an empty body {} resolves a UNIQUE issue number = max(existing weeklyIssue.issueNumber) + 1, never a fixed 999."
    - "When the request body explicitly provides issueNumber, that number is honored verbatim and NO Sanity read is performed."
    - "When no weeklyIssue documents exist (empty dataset), the resolved number falls back to a sensible base (1)."
    - "If the Sanity max-number read fails on the auto-increment path, the trigger fails loudly (raises -> 5xx) rather than silently colliding on a default."
    - "The resolved issue number is used for BOTH the Convex pipelineRuns:create row AND the initial DispatchState (issue_number), resolved before either is built."
    - "The existing pipeline pytest suite stays green (explicit-issueNumber tests unaffected; narratorSlug tests unaffected)."
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/runs.py"
      provides: "RunWeeklyBody.issueNumber as Optional[int]=None + a _resolve_issue_number helper that reads Sanity max+1, wired into run_weekly before the Convex row / initial_state."
      contains: "_resolve_issue_number"
    - path: "packages/pipeline/tests/api/test_runs.py"
      provides: "Unit tests for the auto-increment path (max+1, empty-dataset base, explicit override skips read, read-failure raises)."
      contains: "_resolve_issue_number"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/runs.py::run_weekly"
      to: "lib.sanity_client.groq_query"
      via: "_resolve_issue_number GROQ read when body.issueNumber is None"
      pattern: "groq_query"
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/runs.py::run_weekly"
      to: "convex pipelineRuns:create + initial_state.issue_number"
      via: "resolved issue_number variable used for both"
      pattern: "issue_number"
---

<objective>
Fix pipeline weekly issue numbering so automatic (cron) runs always produce a NEW issue that becomes the site's "latest" issue, instead of colliding on a hardcoded 999.

Root cause: `RunWeeklyBody.issueNumber: int = 999` means an empty-body POST /run/weekly (manual curl AND the `trigger-weekly` cron CLI both send `{}`) always defaults to 999. `lib/sanity_client.write_issue_draft` builds `issue_id = f"issue-{issue_number}"` via `createOrReplace`, so every weekly run OVERWRITES `issue-999`. The homepage selects `order(issueNumber desc)[0]`, so a colliding/low number stays hidden.

Fix: make `issueNumber` optional; when omitted, compute NEXT number = (max existing weeklyIssue.issueNumber) + 1 via a Sanity GROQ read at trigger time, reusing the existing `groq_query` helper. Resolve the number BEFORE building the Convex row and initial DispatchState. Preserve explicit override verbatim (no read). Fail loudly if the read errors on the auto path.

Purpose: Guarantees a unique `issue-{N}` doc id per run (no collision) AND the new issue is always the highest number so the homepage surfaces it.
Output: Updated `runs.py` (RunWeeklyBody + run_weekly + new helper) and new tests in `test_runs.py`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Primary change surface (read in full before editing)
@packages/pipeline/src/eisenbalm_pipeline/api/runs.py

# OUT OF SCOPE — read only to confirm WHY incrementing fixes the collision (do NOT modify)
@packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py

# Test file to extend
@packages/pipeline/tests/api/test_runs.py

<interfaces>
<!-- Existing helpers the executor must reuse — do NOT add a new HTTP client. -->

From lib/sanity_client.py (REUSE — do not modify):
```python
async def groq_query(query: str, *, params: Optional[dict] = None) -> list[dict]:
    """Read-only GROQ against the configured dataset. Returns body.get("result") or []."""
```
NOTE: `groq_query` returns `body.get("result") or []`. A scalar projection like
`...[0].issueNumber` would return a bare int (or get coerced by `or []` when null/0).
To stay unambiguous, project an OBJECT and read a key:
GROQ: `*[_type == "weeklyIssue"] | order(issueNumber desc)[0]{ issueNumber }`
This yields `result == {"issueNumber": N}` (a dict) on hit, or `result == null` -> `[]` on empty dataset.
Normalize both shapes (dict vs empty list) exactly like `fetch_narrator_by_slug` does.

Existing precedent in agents/calibrator.py (same ordering pattern, REUSE the style):
```python
query = ('*[_type == "weeklyIssue" ...] | order(issueNumber desc)[0..2]{ bonusType, issueNumber }')
rows = await groq_query(query)
```

From api/runs.py (CURRENT — to be changed):
```python
class RunWeeklyBody(BaseModel):
    issueNumber: int = 999  # CONTEXT D-16 default   <-- becomes Optional[int] = None
    ...

@router.post("/run/weekly")
async def run_weekly(request, body):
    ...
    run_id = new_run_id()
    begin_run(run_id)
    await convex_mutation(..., "pipelineRuns:create", {"issueNumber": body.issueNumber, ...})  # <-- use resolved number
    initial_state = {"issue_number": body.issueNumber, ...}                                     # <-- use resolved number
    ...
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Auto-increment issue number resolution in run_weekly</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/runs.py</files>
  <behavior>
    - When body.issueNumber is None: run_weekly resolves issue_number = (max existing weeklyIssue.issueNumber) + 1 via a Sanity GROQ read.
    - When body.issueNumber is an int: that value is used verbatim and NO GROQ read happens.
    - Empty dataset (GROQ result empty/null) -> resolved number is base 1.
    - GROQ read raising (network/HTTP error) on the auto path propagates -> the endpoint returns 5xx (cron run marked failed); it must NOT swallow the error and default to a colliding number.
    - The resolved number is used for BOTH the Convex pipelineRuns:create "issueNumber" arg AND initial_state["issue_number"], and is resolved BEFORE either is constructed.
  </behavior>
  <action>
    In packages/pipeline/src/eisenbalm_pipeline/api/runs.py:

    1. Change RunWeeklyBody.issueNumber from `int = 999` to `Optional[int] = None`.
       Update the inline comment from "CONTEXT D-16 default" to reflect the new
       auto-increment behavior, e.g.:
       `issueNumber: Optional[int] = None  # None -> auto-increment to max(existing)+1 at trigger time (was: hardcoded 999, CONTEXT D-16); explicit value honored verbatim (manual override + tests).`

    2. Add a module-level GROQ constant near the top of the file (after the imports
       / router), mirroring the calibrator ordering style:
       `QUERY_MAX_ISSUE_NUMBER = '*[_type == "weeklyIssue"] | order(issueNumber desc)[0]{ issueNumber }'`

    3. Add an async helper `_resolve_issue_number(body_issue_number: Optional[int]) -> int`:
       - If body_issue_number is not None: `return body_issue_number` immediately (NO Sanity read — explicit override).
       - Else: import groq_query locally inside the function to avoid circular import at module load
         (`from eisenbalm_pipeline.lib.sanity_client import groq_query` — same local-import
         pattern manual_publish already uses for groq_query).
         Call `rows = await groq_query(QUERY_MAX_ISSUE_NUMBER)`. Do NOT wrap in try/except that
         swallows — let exceptions propagate (fail loud per requirement). Normalize the result
         exactly like fetch_narrator_by_slug: if rows is a dict -> use it; if rows is a non-empty
         list -> use rows[0]; else (empty/None) -> no existing issue.
         Extract `max_num = doc.get("issueNumber")` from the normalized dict (or None when no doc).
         `return (max_num + 1) if isinstance(max_num, int) else 1`  (empty dataset / missing -> base 1).
       - Add a docstring referencing the collision root cause (sanity_client write_issue_draft
         issue_id = f"issue-{issue_number}" via createOrReplace) and that fail-loud is intentional.

    4. In run_weekly, immediately after `_require_graph(request)` and BEFORE `run_id = new_run_id()`
       (or at minimum before the convex_mutation pipelineRuns:create call AND before building
       initial_state), resolve:
       `issue_number = await _resolve_issue_number(body.issueNumber)`
       Then replace BOTH usages of `body.issueNumber`:
       - convex_mutation pipelineRuns:create args -> `"issueNumber": issue_number`
       - initial_state -> `"issue_number": issue_number`
       Keep the run_id-generated-exactly-once (D-09) and begin_run ordering intact; placing the
       resolve before run_id is fine and means a failed read aborts before any run_id/Convex row
       is created (cleanest — no orphan row). Leave narratorSlug injection, background task
       wiring, trigger-secret auth, and the asyncio.create_task pattern UNCHANGED.

    Do NOT modify lib/sanity_client.py (its id/slug construction is correct — incrementing the
    number is precisely what makes it correct). Do NOT touch cli.py, the webhook, the web app,
    or any other route.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "import ast,sys; t=ast.parse(open('src/eisenbalm_pipeline/api/runs.py').read()); src=open('src/eisenbalm_pipeline/api/runs.py').read(); assert 'Optional[int] = None' in src and 'issueNumber: int = 999' not in src, 'issueNumber default not flipped'; assert '_resolve_issue_number' in src and 'QUERY_MAX_ISSUE_NUMBER' in src, 'helper/query missing'; assert 'order(issueNumber desc)' in src, 'GROQ ordering missing'; print('OK')"</automated>
  </verify>
  <done>RunWeeklyBody.issueNumber is Optional[int]=None; `_resolve_issue_number` + `QUERY_MAX_ISSUE_NUMBER` exist; run_weekly resolves the number once and uses it for both the Convex row and initial_state; explicit override skips the read; read failure propagates; lib/sanity_client.py unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Tests for auto-increment, override, empty-dataset, and fail-loud</name>
  <files>packages/pipeline/tests/api/test_runs.py</files>
  <behavior>
    - test_resolve_issue_number_auto_increments_from_max: groq_query mocked to return [{"issueNumber": 7}] (or {"issueNumber": 7}) -> _resolve_issue_number(None) == 8.
    - test_resolve_issue_number_empty_dataset_base_one: groq_query mocked to return [] -> _resolve_issue_number(None) == 1.
    - test_resolve_issue_number_explicit_override_skips_read: groq_query mocked as AsyncMock; _resolve_issue_number(42) == 42 AND groq_query NOT awaited.
    - test_resolve_issue_number_read_failure_propagates: groq_query mocked to raise -> _resolve_issue_number(None) raises (no silent default).
    - test_run_weekly_body_issue_number_defaults_none: RunWeeklyBody().issueNumber is None (documents the new default).
  </behavior>
  <action>
    Append unit tests to packages/pipeline/tests/api/test_runs.py. These tests call the helper
    directly (pure-function level) so they do NOT require the `client` fixture / real Convex —
    keeping them fast and env-independent (matching the existing pure-unit RunWeeklyBody tests
    already in this file).

    - Import the helper: `from eisenbalm_pipeline.api.runs import _resolve_issue_number, RunWeeklyBody`.
    - Patch the Sanity read at its canonical home with monkeypatch, mirroring the existing
      test_manual_publish_invokes_publisher pattern:
      `monkeypatch.setattr("eisenbalm_pipeline.lib.sanity_client.groq_query", fake_groq)`
      (the helper imports groq_query locally from lib.sanity_client each call, so patching the
      canonical home is correct).
    - For the override-skips-read test, assert `fake_groq.assert_not_awaited()`.
    - For the fail-loud test, set `AsyncMock(side_effect=RuntimeError("sanity down"))` and assert
      `with pytest.raises(RuntimeError): await _resolve_issue_number(None)`.
    - Cover BOTH normalized shapes the helper accepts: include at least one test returning a dict
      `{"issueNumber": 7}` and one returning a list `[{"issueNumber": 7}]` to lock the
      normalization (or parametrize). Empty case returns `[]`.
    - Mark async tests `async def` (the file already runs under anyio/asyncio per conftest;
      existing async tests in this file have no explicit marker, so follow the same convention).

    Do NOT weaken or delete the existing narratorSlug tests. Do NOT change the existing
    explicit-issueNumber POSTs in test_pipeline_e2e.py / test_status_endpoint.py /
    test_agent_failure.py / test_editor_gate_1_resume.py — they pass explicit issueNumber and
    therefore hit the override branch (no Sanity read), so they remain green untouched.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/api/test_runs.py -v 2>&1 | tail -30</automated>
  </verify>
  <done>New tests cover max+1, empty-dataset base 1, explicit-override-no-read, and read-failure-propagates; all pass; existing test_runs.py tests still pass.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/api/test_runs.py -v` — all green (new + existing).
- Full suite spot check (the change is isolated to the auto path; explicit-issueNumber tests skip the read):
  `cd packages/pipeline && uv run pytest tests/ -q 2>&1 | tail -20` — no NEW failures vs. baseline (pre-existing skips for missing env vars are acceptable).
- Manual grep: `grep -n "issueNumber: int = 999" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` returns nothing.
- `lib/sanity_client.py` shows no diff (git status / git diff) — out of scope, untouched.
</verification>

<success_criteria>
- Empty-body POST /run/weekly resolves issue_number = max(existing weeklyIssue.issueNumber)+1 (or 1 on empty dataset), used for both the Convex pipelineRuns:create row and initial_state["issue_number"].
- Explicit issueNumber in the body is honored verbatim with NO Sanity read.
- A failing Sanity read on the auto path raises (5xx), never silently defaults to a colliding number.
- The existing `groq_query` helper is reused (no new HTTP client); lib/sanity_client.py id/slug construction unchanged.
- The pipeline pytest suite stays green.
- CONTEXT D-16 code comment updated to describe the new auto-increment behavior.
</success_criteria>

<output>
After completion, create `.planning/quick/260620-gfa-fix-weekly-issue-numbering-auto-incremen/260620-gfa-SUMMARY.md`
</output>
