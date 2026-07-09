---
phase: 36-voice-pass-de-slop-screen
plan: 03
type: execute
wave: 2
depends_on: [36-01]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
  - packages/pipeline/src/eisenbalm_pipeline/api/findings.py
  - packages/pipeline/tests/test_voice_pass_endpoints.py
  - packages/pipeline/tests/test_findings_endpoints.py
autonomous: true
requirements: [VOX-02, VOX-04]
must_haves:
  truths:
    - "POST /issues/{run_id}/voice-recheck re-runs the Opus judge against the CURRENT draft and writes fresh voice findings tagged agentId=qa-recheck"
    - "Re-running voice-recheck twice on an unchanged draft does not double the finding count (prior open qa-recheck findings are superseded first)"
    - "POST /issues/{run_id}/voice-rewrite returns a house-voice suggestedFix for a finding that had none"
    - "accept_finding applies body.suggestedFixOverride when present, falling back to the finding's stored suggestedFix"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py"
      provides: "voice-recheck (§36.4) + voice-rewrite (§36.5) endpoints"
      exports: ["router"]
      contains: "voice-recheck"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/main.py"
      provides: "voice_pass router registration"
      contains: "voice_pass"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/findings.py"
      provides: "suggestedFixOverride accept path (§36.6)"
      contains: "suggestedFixOverride"
  key_links:
    - from: "api/voice_pass.py voice_recheck"
      to: "agents/qa/judge.py::run_llm_judge"
      via: "run_llm_judge(sections, run_id=run_id, narrator=None, rubric=None)"
      pattern: "run_llm_judge"
    - from: "api/voice_pass.py voice_recheck"
      to: "qaCorrections:setResolution (supersede prior qa-recheck)"
      via: "dismiss open agentId=='qa-recheck' findings before insert"
      pattern: "qa-recheck"
    - from: "api/findings.py accept_finding"
      to: "body.suggestedFixOverride"
      via: "suggested_fix = body.suggestedFixOverride or finding.get('suggestedFix')"
      pattern: "suggestedFixOverride"
---

<objective>
Build the on-demand detection + rewrite backend for Voice Pass (§36.4/§36.5/§36.6):

- **voice-recheck** — the VOX-04 "judge runs on demand" half: re-read the current (post-edit) draft, re-run the EXISTING `run_llm_judge` (never a new detector), write voice findings — with dedup so repeated clicks don't inflate the tell count (research Pitfall 4) and `narrator=None` (Pitfall 6).
- **voice-rewrite** — the VOX-02 on-click house-voice suggestion for a rule-only tell that has no stored `suggestedFix` (D-08), via the existing `acomplete` wrapper.
- **suggestedFixOverride** — the one-field extension to the Phase 33 `accept_finding` (D-09) so the rewrite text is applied through the SAME accept path (no new mutation, no two-step patch race).

Purpose: VOX-04's second layer and VOX-02's rewrite mechanism, built entirely from existing modules per the "don't hand-roll" mandate.
Output: `api/voice_pass.py` (2 routes) registered in `main.py`; `_AcceptBody.suggestedFixOverride` in `findings.py`; tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/36-voice-pass-de-slop-screen/36-RESEARCH.md
@docs/API_CONTRACTS.md
@packages/pipeline/src/eisenbalm_pipeline/api/findings.py
@packages/pipeline/src/eisenbalm_pipeline/api/content.py
@packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py
@packages/pipeline/src/eisenbalm_pipeline/api/main.py

<interfaces>
<!-- Reuse chain (all verified). _resolve_sanity_id (api/content.py:62) returns
     (convex_http, sanity_http, sanity_id, actor). get_issue_draft (lib/sanity_client.py:586)
     returns { revisionId, sections:{originStory,problemStatement,founderBio,caseStudy → {headline,blocks,lossy}},
     theme, game, bonus:{...,body:[rows]}, podcast, bonusType, conversation }. -->
```python
from eisenbalm_pipeline.api.content import _resolve_sanity_id
from eisenbalm_pipeline.lib.sanity_client import get_issue_draft
from eisenbalm_pipeline.agents.qa.judge import run_llm_judge  # -> (list[QAFinding], resolved_model)
from eisenbalm_pipeline.api.control import _require_clerk_jwt_control, _emit_audit
import eisenbalm_pipeline.lib.convex_client as _cc
from eisenbalm_pipeline.lib.openrouter_client import acomplete
```
<!-- run_llm_judge signature (judge.py:107): run_llm_judge(sections: dict[str,str], *, run_id, narrator=None, rubric=None) -->
<!-- convex_mutation(http, path, args) RAISES on failure; convex_mutation_safe(path, args) swallows.
     For an operator-triggered synchronous call, prefer convex_mutation (raising) so a silent drop
     doesn't masquerade as a fresh check (research Code Example 1 note). qaCorrections:insert is
     the public GAM-05 exception (no pipeline secret). qaCorrections:setResolution is secret-guarded
     (already in _PIPELINE_SECRET_GUARDED_PATHS) and injects the secret centrally. -->
<!-- main.py router registration block (main.py:196-204): app.include_router(findings.router); app.include_router(signoffs.router) -->
<!-- _AcceptBody (findings.py:61): class _AcceptBody(BaseModel): ifRevisionID: str -->
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: voice-recheck endpoint (§36.4) — on-demand Opus judge with dedup</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/findings.py (the _resolve_sanity_id usage + Clerk-JWT dependency + get_issue_draft draft shape)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py (_extract_sections + _body_to_text — the section-flattening shape to mirror for the DRAFT container)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py (run_llm_judge signature + QAFinding fields)
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py (router registration block)
    - packages/pipeline/tests/test_findings_endpoints.py (fixture style for a fake Sanity draft + monkeypatched _cc)
    - docs/API_CONTRACTS.md §36.4
  </read_first>
  <behavior>
    - Test 1: POST /issues/{run_id}/voice-recheck with a fake draft + `run_llm_judge` stubbed to return 2 findings → 200 `{ "runId": run_id, "findingCount": 2 }` and `qaCorrections:insert` called twice, each with `agentId=="qa-recheck"` and `accepted==False`.
    - Test 2 (dedup, Pitfall 4): given one existing OPEN finding with `agentId=="qa-recheck"` (no resolution), the endpoint calls `qaCorrections:setResolution(resolution="dismissed", resolutionReason="superseded by re-check")` on it BEFORE inserting the new findings.
    - Test 3: existing RULE-layer findings (`agentId=="qa"`) are NOT superseded (only prior `qa-recheck` rows are).
    - Test 4: run lookup 404 / no_sanity_issue 409 propagate from `_resolve_sanity_id` unchanged.
  </behavior>
  <action>
    Create `packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py` with `router = APIRouter()` and a `_draft_to_qa_sections(draft: dict) -> dict[str, str]` helper mirroring `agents/qa/__init__.py::_extract_sections` but reading the `get_issue_draft` container:
      ```python
      def _rows_to_text(rows): return " ".join(r.get("text", "") for r in (rows or []))
      sections = draft["sections"]
      out = {
        "origin_story": _rows_to_text(sections.get("originStory", {}).get("blocks")),
        "problem":      _rows_to_text(sections.get("problemStatement", {}).get("blocks")),
        "founder_bio":  _rows_to_text(sections.get("founderBio", {}).get("blocks")),
        "case_study":   _rows_to_text(sections.get("caseStudy", {}).get("blocks")),
        "game":         (draft.get("game") or {}).get("description", "") or "",
        "bonus":        _rows_to_text((draft.get("bonus") or {}).get("body")) if draft.get("bonusType") == "specAd" else "",
      }
      ```
    Add `@router.post("/issues/{run_id}/voice-recheck")` guarded by `_require_clerk_jwt_control`:
      1. `convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(request, run_id, claims)`
      2. `draft = await get_issue_draft(sanity_http, sanity_id)`; `sections = _draft_to_qa_sections(draft)`
      3. Dedup: `existing = await _cc.convex_query(convex_http, "qaCorrections:byRunId", {"runId": run_id}) or []`; for each row with `row.get("agentId") == "qa-recheck" and not row.get("resolution")`, call `await _cc.convex_mutation(convex_http, "qaCorrections:setResolution", {"id": row["_id"], "resolution": "dismissed", "resolutionReason": "superseded by re-check", "resolvedBy": actor, "resolvedAt": <ms>})`.
      4. `findings, _model = await run_llm_judge(sections, run_id=run_id, narrator=None, rubric=None)`
      5. For each finding, `await _cc.convex_mutation(convex_http, "qaCorrections:insert", { "runId": run_id, "agentId": "qa-recheck", "sectionName": f.section, "severity": f.severity, "axis": f.axis, "quotedSpan": f.quotedSpan, "reason": f.reason, "suggestedFix": f.suggestedFix, "accepted": False })` (use the RAISING `convex_mutation`, not `_safe` — a silent drop on a synchronous operator action is worse; research Code Example 1 note).
      6. `await _emit_audit(convex_http, actor_id=actor, action="voice.recheck", resource_type="run", resource_id=run_id)`
      7. return `{ "runId": run_id, "findingCount": len(findings) }`.
    Register the router in `api/main.py`: add `voice_pass` to the `from eisenbalm_pipeline.api import (...)` tuple and `app.include_router(voice_pass.router)` alongside the findings/signoffs registrations.
    Create `packages/pipeline/tests/test_voice_pass_endpoints.py` with a minimal FastAPI TestClient app mounting `voice_pass.router` (mirror `test_signoffs_endpoints.py`'s app-build + `_cc` monkeypatch), stubbing `get_issue_draft`, `run_llm_judge`, and `_cc.convex_query`/`convex_mutation`.
  </action>
  <acceptance_criteria>
    - `packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py` exists and contains `voice-recheck`, `qa-recheck`, `narrator=None`, and `_draft_to_qa_sections`
    - `grep -q "voice_pass" packages/pipeline/src/eisenbalm_pipeline/api/main.py`
    - `grep -q "run_llm_judge" packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py`
    - `grep -q "superseded by re-check" packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py`
    - `cd packages/pipeline && uv run pytest tests/test_voice_pass_endpoints.py -x -q` exits 0
    - `cd packages/pipeline && python -c "from eisenbalm_pipeline.api.main import app"` does not raise (router mounts)
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_voice_pass_endpoints.py -k recheck -x -q</automated>
  </verify>
  <done>voice-recheck re-runs the existing Opus judge against the live draft with narrator=None, supersedes prior open qa-recheck findings before writing, registers on the app, and is covered by tests.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: voice-rewrite endpoint (§36.5) — on-click house-voice suggestion</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py (Task 1's router + _resolve_sanity_id usage)
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py::score_output (the acomplete-based single-output pattern to mirror — system rubric + one user prompt)
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py (acomplete signature: agent_id, run_id, messages, response_format)
    - packages/pipeline/src/eisenbalm_pipeline/lib/voice.py (VOICE_CONSTRAINTS — the house-voice law the rewrite must obey; MUST NOT introduce AI self-reference/hedging)
    - docs/API_CONTRACTS.md §36.5
  </read_first>
  <behavior>
    - Test 1: POST /issues/{run_id}/voice-rewrite `{finding_id}` with `acomplete` stubbed → 200 `{ "findingId": finding_id, "suggestedFix": "<rewrite>" }`.
    - Test 2: a finding_id that doesn't belong to the run → 404 (reuse `_load_finding`-style lookup or `qaCorrections:byId` + run check).
    - Test 3: the acomplete call passes `agent_id="qa"` (or a labeled key) and a `run_id` so cost is recorded; the user prompt includes the finding's `quotedSpan`.
  </behavior>
  <action>
    Add `@router.post("/issues/{run_id}/voice-rewrite")` to `api/voice_pass.py`, body Pydantic `class _RewriteBody(BaseModel): findingId: str`, Clerk-JWT guarded:
      1. Resolve convex_http via `_resolve_sanity_id` (or a lighter run+finding lookup); load the finding via `qaCorrections:byId` and 404 if missing or `runId` mismatch.
      2. Build a rewrite prompt: system message = the house-voice law (import `VOICE_CONSTRAINTS` from `lib/voice.py`; append an explicit "Rewrite the QUOTED span into Jesse's dry, precise, Fortune-500 register. Return ONLY the rewritten span text. Do NOT add AI self-reference, hedging, or sentiment."), user message includes `finding["quotedSpan"]` and `finding["reason"]`. Use a small Pydantic `response_format` (e.g. `class _Rewrite(BaseModel): suggestedFix: str`) so `acomplete(agent_id="qa", run_id=f"voice-rewrite-{run_id}", messages=..., response_format=_Rewrite)` returns structured text.
      3. return `{ "findingId": body.findingId, "suggestedFix": rewrite.suggestedFix }`.
    Extend `test_voice_pass_endpoints.py` with the three behavior tests (stub `acomplete` to return a `_Rewrite`/dict with a known `suggestedFix`).
  </action>
  <acceptance_criteria>
    - `grep -q "voice-rewrite" packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py`
    - `grep -q "acomplete" packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py`
    - `grep -Eq "VOICE_CONSTRAINTS|voice" packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py`
    - `cd packages/pipeline && uv run pytest tests/test_voice_pass_endpoints.py -k rewrite -x -q` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_voice_pass_endpoints.py -k rewrite -x -q</automated>
  </verify>
  <done>voice-rewrite returns a house-voice suggestedFix for any finding, generated via the existing acomplete wrapper under Jesse's VOICE_CONSTRAINTS; covered by tests.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: accept_finding honors suggestedFixOverride (§36.6)</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/findings.py (the _AcceptBody model at 61-63 + accept_finding, esp. the `suggested_fix = finding.get("suggestedFix")` line at 134)
    - packages/pipeline/tests/test_findings_endpoints.py (existing accept tests to extend)
    - docs/API_CONTRACTS.md §36.6
  </read_first>
  <behavior>
    - Test 1: accept a finding that has NO stored `suggestedFix` but the request body carries `suggestedFixOverride="the plain rewrite"` → the patch applies "the plain rewrite" and the finding resolves `accepted` (no `accept_unavailable` 409).
    - Test 2 (regression): accept with NO override on a finding that HAS a stored `suggestedFix` → unchanged behavior (uses the stored fix).
    - Test 3: accept with neither override nor stored fix → still 409 `accept_unavailable`.
  </behavior>
  <action>
    In `api/findings.py`:
    - Extend `_AcceptBody`: add `suggestedFixOverride: Optional[str] = None` (Optional already imported at line 24).
    - In `accept_finding`, replace `suggested_fix = finding.get("suggestedFix")` (line ~134) with `suggested_fix = body.suggestedFixOverride or finding.get("suggestedFix")`. The existing `if not suggested_fix or not quoted_span:` guard now correctly passes when an override is supplied but no stored fix exists. Everything else (span resolve, `patch_issue_field`, `setResolution`, audit before/after using `suggested_fix`, sign-off revoke) is UNCHANGED.
    - Extend `packages/pipeline/tests/test_findings_endpoints.py` with the three behavior tests.
  </action>
  <acceptance_criteria>
    - `grep -q "suggestedFixOverride" packages/pipeline/src/eisenbalm_pipeline/api/findings.py`
    - `grep -q "body.suggestedFixOverride or finding.get" packages/pipeline/src/eisenbalm_pipeline/api/findings.py`
    - `grep -q "suggestedFixOverride" packages/pipeline/tests/test_findings_endpoints.py`
    - `cd packages/pipeline && uv run pytest tests/test_findings_endpoints.py -x -q` exits 0
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_findings_endpoints.py -x -q</automated>
  </verify>
  <done>accept_finding applies an on-demand rewrite via suggestedFixOverride when a finding has no stored fix, without any new mutation path; the Phase 33 accept behavior is otherwise byte-unchanged.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_voice_pass_endpoints.py tests/test_findings_endpoints.py -x -q` green.
- `cd packages/pipeline && python -c "from eisenbalm_pipeline.api.main import app"` imports cleanly (router mounted).
- `cd packages/pipeline && uv run pytest -q` full suite green.
- Reconciliation note (Phase 35 lesson / Pitfall 7): this plan runs in Wave 2 in parallel with 36-02/36-04. Its `api/voice_pass.py`, `api/main.py`, `api/findings.py` changes MUST be reconciled onto master before Wave 3 (36-06's screen calls voice-recheck/voice-rewrite; 36-07's rewrite path calls the accept-override).
</verification>

<success_criteria>
The two-layer on-demand judge (voice-recheck) and the on-click rewrite (voice-rewrite + accept override) are live, tested, and mounted — VOX-04's judge half and VOX-02's rewrite mechanism, built from existing modules only.
</success_criteria>

<output>
After completion, create `.planning/phases/36-voice-pass-de-slop-screen/36-03-SUMMARY.md`.
</output>
