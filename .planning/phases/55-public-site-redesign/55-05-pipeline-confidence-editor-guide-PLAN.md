---
phase: 55-public-site-redesign
plan: 05
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
  - packages/pipeline/tests/test_sanity_write_editor_confidence.py
  - packages/pipeline/tests/test_sanity_write_frontpage_carry.py
  - apps/studio/EDITOR_GUIDE.md
autonomous: true
requirements: [P55-SC3, P55-SC2, PUB-06, PUB-11]

must_haves:
  truths:
    - "Every new pipeline run writes the Editor Gate 1 confidence (0-1) into selectionDeliberation.editorConfidence in Sanity"
    - "When the pipeline has no valid confidence (None, NaN, out of range, bool), the field is omitted so the public bar is hidden — never defaulted"
    - "A pipeline re-run for the same issue number preserves the editor-authored frontPage (Studio draft preferred over published); a failed lookup never blocks the draft write"
    - "Andrew has written instructions for every frontPage field and its fallback, and knows front-page edits survive pipeline re-runs"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
      provides: "write_issue_draft emits editorConfidence"
      contains: "editorConfidence"
    - path: "packages/pipeline/tests/test_sanity_write_editor_confidence.py"
      provides: "pytest coverage for the new field"
    - path: "packages/pipeline/tests/test_sanity_write_frontpage_carry.py"
      provides: "pytest coverage for frontPage carry-forward (preserved / absent / lookup failure)"
    - path: "apps/studio/EDITOR_GUIDE.md"
      provides: "Front Page (Phase 55) authoring section"
      contains: "Front Page"
  key_links:
    - from: "graph/state.py editor_confidence"
      to: "Sanity selectionDeliberation.editorConfidence"
      via: "write_issue_draft createOrReplace document"
      pattern: "state.get\\(\"editor_confidence\"\\)"
    - from: "write_issue_draft"
      to: "Sanity /data/doc/{dataset}/issue-N,drafts.issue-N"
      via: "GET existing docs before createOrReplace; copy frontPage"
      pattern: "_fetch_existing_front_page"
---

<objective>
Close the fake-confidence gap (research finding 2): the real `editor_confidence` exists in pipeline state but never reaches Sanity, so the old UI showed a hard-coded 80%. Write it in `write_issue_draft` (omitted when invalid) with a pytest. Make `write_issue_draft` carry forward an existing `frontPage` so a pipeline re-run never wipes the editor-authored front-page fields (RESEARCH Pitfall 4 — implemented, not just documented). Document the new Studio `frontPage` fields for Andrew.

Purpose: SC-3 ("summary cards from live data" — the confidence bar must be real or absent).
Output: editorConfidence write + frontPage carry-forward in sanity_client.py with two pytest files; EDITOR_GUIDE section. This is the only Wave 1 plan touching packages/pipeline/** and apps/studio/EDITOR_GUIDE.md; the Studio field description and API_CONTRACTS note are owned by 55-03. Railway deploy is a Plan 13 human checkpoint.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
@packages/pipeline/tests/test_sanity_write.py
@apps/studio/EDITOR_GUIDE.md

<interfaces>
packages/pipeline/src/eisenbalm_pipeline/graph/state.py:
  editor_confidence: Optional[float]   # 0.0–1.0; None on human-override path; 0.9 on deterministic fallback
sanity_client.write_issue_draft(http, state) builds `doc["selectionDeliberation"] = { candidates, editorDecision, runnerUpNotes, conversation }` (~L239–262) and posts `{"mutations": [{"createOrReplace": doc}]}`.
Sanity schema (Plan 03): selectionDeliberation.editorConfidence number 0–1 optional.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: write editorConfidence in write_issue_draft</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py, packages/pipeline/tests/test_sanity_write_editor_confidence.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py L180–285 (write_issue_draft doc construction)
    - packages/pipeline/tests/test_sanity_write.py (`_base_state` and `_capture_write` MockTransport pattern — copy it)
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py L275–290 (editor_confidence)
  </read_first>
  <behavior>
    - state editor_confidence 0.82 -> doc["selectionDeliberation"]["editorConfidence"] == 0.82
    - 0 -> 0.0 present; 1 -> 1.0 present (ints accepted, emitted as float)
    - None, missing key, float('nan'), 1.5, -0.1, True, "0.8" -> key "editorConfidence" absent from selectionDeliberation
    - existing keys (candidates, editorDecision, runnerUpNotes, conversation) unchanged
  </behavior>
  <action>
    RED: create tests/test_sanity_write_editor_confidence.py reusing the `_base_state` / `_capture_write` helpers pattern from test_sanity_write.py (copy them locally; add "editor_decision", "runner_up_notes" keys), parametrised over the behaviour table; mark async tests the same way test_sanity_write.py does. Run `cd packages/pipeline && uv run pytest tests/test_sanity_write_editor_confidence.py -x -q` and confirm failure.
    GREEN: in sanity_client.py add a module-level helper:
    ```python
    def _valid_confidence(value: object) -> float | None:
        """Phase 55 (API_CONTRACTS §55.2): only a finite number in [0, 1] is written; anything else is omitted so the public bar is hidden."""
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            return None
        f = float(value)
        if not math.isfinite(f) or f < 0.0 or f > 1.0:
            return None
        return f
    ```
    (add `import math` if absent). After the `doc` dict is built and before the POST: `conf = _valid_confidence(state.get("editor_confidence"))` then `if conf is not None: doc["selectionDeliberation"]["editorConfidence"] = conf`. Change nothing else in this task (createOrReplace stays; frontPage carry-forward is Task 2).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_sanity_write_editor_confidence.py tests/test_sanity_write.py tests/test_sanity_client_pdfcontent.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - The three pytest files pass
    - `grep -n "editorConfidence" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` matches
    - `grep -n "def _valid_confidence" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` matches
    - `grep -cE "0\\.8\\b|\\b80\\b" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` shows no new default introduced (diff adds no numeric default)
  </acceptance_criteria>
  <done>New runs persist real confidence; invalid values are omitted; existing write tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Carry forward an existing frontPage across pipeline re-runs</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py, packages/pipeline/tests/test_sanity_write_frontpage_carry.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py L170–285 (write_issue_draft: `issue_id = f"issue-{state['issue_number']}"`, `_auth_headers()`, `_dataset()`, `API_VERSION`, POST via the passed `http` client) and L360–400 (`_groq` uses its own client — do NOT use it here; use the passed `http` so tests can intercept)
    - packages/pipeline/tests/test_sanity_write.py (its MockTransport handler json-decodes every request body — a GET with an empty body raises inside that handler; the carry-forward must swallow that and still POST, so these existing tests stay green unchanged)
    - .planning/phases/55-public-site-redesign/55-RESEARCH.md §"Pitfall 4: Pipeline re-run wipes Andrew's frontPage"
  </read_first>
  <behavior>
    - Existing doc: GET returns `{"documents": [{"_id": "issue-13", "frontPage": {"dek": "Published dek"}}]}` -> the POSTed createOrReplace doc has `frontPage == {"dek": "Published dek"}`
    - Draft preferred: GET returns both `issue-13` (dek 'Published dek') and `drafts.issue-13` (dek 'Draft dek') -> POSTed frontPage dek == 'Draft dek'
    - No existing doc: GET returns `{"documents": []}` or 404 -> POSTed doc has NO "frontPage" key
    - Existing doc without frontPage (or frontPage not a non-empty dict) -> no "frontPage" key
    - Lookup failure: GET raises httpx.ConnectError or returns 500 -> no "frontPage" key, a WARNING is logged, and the POST still happens exactly once (draft write never blocked)
    - The GET path is `/{API_VERSION}/data/doc/{dataset}/issue-13,drafts.issue-13` and carries the auth headers
    - test_sanity_write.py, test_sanity_client_pdfcontent.py and test_sanity_write_editor_confidence.py pass unchanged
  </behavior>
  <action>
    RED: create tests/test_sanity_write_frontpage_carry.py with an httpx.MockTransport handler branching on `request.method` ("GET" -> configurable response or raised exception; "POST" -> capture `json.loads(request.content)` and return `{"transactionId": "t", "results": []}`); reuse the `_base_state` shape from test_sanity_write.py with issue_number 13; use `caplog` for the warning. Cover every behaviour above and confirm failure.
    GREEN in sanity_client.py (reuse an existing module logger if one exists; otherwise add `import logging` and `logger = logging.getLogger(__name__)`):
    ```python
    async def _fetch_existing_front_page(http: AsyncClient, issue_id: str) -> dict | None:
        # Phase 55 (API_CONTRACTS 55.1): carry the editor-authored frontPage across
        # pipeline re-runs. Prefers the Studio draft (drafts.<id>) over the published doc.
        # Failure-tolerant: any error -> warning + None (never blocks the draft write).
        try:
            r = await http.get(
                f"/{API_VERSION}/data/doc/{_dataset()}/{issue_id},drafts.{issue_id}",
                headers=_auth_headers(),
            )
            if r.status_code == 404:
                return None
            r.raise_for_status()
            docs = {d.get("_id"): d for d in (r.json().get("documents") or []) if isinstance(d, dict)}
            for doc_id in (f"drafts.{issue_id}", issue_id):
                fp = (docs.get(doc_id) or {}).get("frontPage")
                if isinstance(fp, dict) and fp:
                    return fp
            return None
        except Exception as exc:  # noqa: BLE001 — must never block the draft write
            logger.warning("frontPage carry-forward lookup failed for %s: %s", issue_id, exc)
            return None
    ```
    In write_issue_draft, after `doc` is built (and after the editorConfidence step) and before the POST: `front_page = await _fetch_existing_front_page(http, issue_id)`; `if front_page is not None: doc["frontPage"] = front_page`. Leave `createOrReplace` and everything else unchanged. Never invent or default frontPage content.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_sanity_write_frontpage_carry.py tests/test_sanity_write_editor_confidence.py tests/test_sanity_write.py tests/test_sanity_client_pdfcontent.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - The four pytest files pass
    - `grep -n "async def _fetch_existing_front_page" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` matches
    - `grep -n "data/doc/" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` matches on a line containing `drafts.`
    - `grep -n 'doc\["frontPage"\] = front_page' packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` matches
    - `grep -c "createOrReplace" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` equals `git show HEAD:packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py | grep -c createOrReplace`
  </acceptance_criteria>
  <done>Re-runs preserve an existing frontPage (draft preferred); no-doc and lookup-failure paths write without it; existing write tests green unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: EDITOR_GUIDE — Front Page authoring section</name>
  <files>apps/studio/EDITOR_GUIDE.md</files>
  <read_first>
    - apps/studio/EDITOR_GUIDE.md (match its heading levels and tone)
    - .planning/phases/55-public-site-redesign/55-RESEARCH.md §"Scope-B Content Classification" and §"Pitfall 4"
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Open items for Andrew"
  </read_first>
  <action>
    Append a section `## Front Page (Phase 55)` written plainly for Andrew, containing:
    1. A table: field | where it shows | what happens if empty — rows: Dek (hero sub-headline; falls back to the first two sentences of the charity mission statement) · Ticker lines (black ticker under the masthead; falls back to facts from the charity record; every line must also be true elsewhere on the page) · Pull quotes: origin / case (large quote in sections 01 and 04; omitted) · Case timeline (up to 4 steps in section 04, last step shown as the result; omitted) · Ad summary (only for spec-ad issues, section 06; omitted) · Hero image + alt text (hero right column; alt text is required; falls back to the geometric artwork) · Impact unit label/min/max USD (shop band "About N to M balms covers one …" and progress bar; omitted, count only) · Editor's confidence (written by the pipeline; shown as a bar in "Why we selected them"; older issues show no bar — you may type a value 0–1 if you know it).
    2. "Voice": every field is reader-facing copy in Jesse's voice — dry, precise, no exclamation marks; pull quotes must be lifted verbatim from the section text.
    3. "Pipeline re-runs": re-running the pipeline for the same issue number regenerates the pipeline-written sections, but Front Page fields are carried forward automatically (an unpublished Studio draft is preferred over the published copy). Other manual Studio edits to pipeline-written sections are still replaced by a re-run.
    4. "Weekly accent": the accent colour rotates green → blue → red → yellow by issue number (Issue 2 = green); it is not chosen per issue.
  </action>
  <verify>
    <automated>grep -n "## Front Page (Phase 55)" apps/studio/EDITOR_GUIDE.md && grep -n "carried forward automatically" apps/studio/EDITOR_GUIDE.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "## Front Page (Phase 55)" apps/studio/EDITOR_GUIDE.md` returns 1
    - `grep -n "Alt text" apps/studio/EDITOR_GUIDE.md` (case-insensitive `grep -in "alt text"`) matches
    - `grep -n "carried forward automatically" apps/studio/EDITOR_GUIDE.md` matches and `grep -c "Fill Front Page fields only after the final pipeline run" apps/studio/EDITOR_GUIDE.md` returns 0
    - `grep -c "!" apps/studio/EDITOR_GUIDE.md` does not increase versus `git show HEAD:apps/studio/EDITOR_GUIDE.md | grep -c "!"`
  </acceptance_criteria>
  <done>Andrew can author every frontPage field from the guide and knows front-page edits survive pipeline re-runs.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests -k "sanity" -q` green (includes carry-forward tests)
- Railway deploy of the pipeline is deferred to Plan 13 (human/deploy checkpoint)
</verification>

<success_criteria>
editorConfidence flows pipeline → Sanity for new runs; frontPage survives re-runs; guide documents all authored fields.
</success_criteria>

<output>
After completion, create `.planning/phases/55-public-site-redesign/55-05-SUMMARY.md`
</output>
