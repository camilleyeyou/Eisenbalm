---
phase: 45-agent-revision
plan: 03
type: execute
wave: 3
depends_on: ["45-01", "45-02"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/revision.py
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
autonomous: true
requirements: [REV-02, REV-03, REV-04, REV-05]
must_haves:
  truths:
    - "POST /issues/{run_id}/revise/preview returns proposedText/whatChanged/claimDelta, mutates nothing, writes no audit row, and records the LLM call cost under the real run_id with a distinct revision-* agentKey"
    - "POST /issues/{run_id}/revise/apply patches the passage via the shared _patch_prose_span, revokes active sign-offs, and emits exactly one passage_revised audit row"
    - "preview returns 409 cost_cap_exceeded when the projected next call would exceed per_run_cap_usd; apply returns 409 on stale ifRevisionID and on an unresolved span"
    - "the direction-chip prompt is one parametrized house-voice call — never a bare Regenerate — with custom/try-another/match-brief handled"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/revision.py"
      provides: "revise/preview + revise/apply endpoints, _build_directive, _RevisionPick structured output, cost recording, cost guard"
      contains: "async def preview_passage_revision"
      min_lines: 150
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/main.py"
      provides: "revision.router mounted"
      contains: "revision.router"
  key_links:
    - from: "revision.py::apply_passage_revision"
      to: "content.py::_patch_prose_span"
      via: "shared apply path (D-01)"
      pattern: "_patch_prose_span"
    - from: "revision.py::preview_passage_revision"
      to: "budget.py::would_exceed_run_cap"
      via: "pre-call cost guard → 409 cost_cap_exceeded"
      pattern: "would_exceed_run_cap"
    - from: "revision.py (each LLM call)"
      to: "agentRuns:completed"
      via: "distinct agentKey revision-{uuid4} under real run_id"
      pattern: "agentRuns:completed"
---

<objective>
Add the passage-revision endpoint pair `api/revision.py` — the SINGLE generalization of §42.4a's
FCT-06 preview/apply contract to arbitrary passages (D-01, do NOT fork). Preview is read-only,
runs the parametrized direction-chip house-voice prompt, emits `{proposedText, whatChanged,
claimDelta}`, records its LLM cost durably, and 409s when the per-issue cost cap would be exceeded.
Apply is atomic + audited via the shared `_patch_prose_span` (45-02). Mount the router in `main.py`.

Purpose: this is the REV-02/REV-03/REV-04/REV-05 backend — the load-bearing endpoint the demo leg
("select founder phrase → Ask agent to revise → apply → Voice returns to Review needed") runs on.
Output: `revision.py` (preview + apply + prompt + cost recording + guard), `main.py` mount.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@.planning/phases/45-agent-revision/45-RESEARCH.md

<interfaces>
<!-- The pattern to clone (factcheck evidence/preview + evidence/apply). READ factcheck.py in full. -->
factcheck.py:495 async def preview_claim_evidence(...)   # read-only mirror; NO mutation, NO audit
factcheck.py:603 async def apply_claim_evidence(...)      # _patch_prose_span → updateClaim → keepAsWritten → _revoke_active_signoffs → _emit_audit

<!-- Shared helpers to import (45-02 + existing). -->
content.py::_resolve_sanity_id(request, run_id, claims) -> (convex_http, sanity_http, sanity_id, actor)
content.py::_patch_prose_span(convex_http, sanity_http, *, sanity_id, run_id, section_name, quoted_text, block_index_hint, new_text, if_revision_id) -> new_rev   # 45-02
control.py::_require_clerk_jwt_control, _emit_audit, _revoke_active_signoffs
lib/openrouter_client.py::acomplete(agent_id, run_id, messages, response_format) -> (pick, usage)
lib/config_loader.py::load_run_config(http) -> RunConfig(.per_run_cap_usd default 10.0)
lib/budget.py::would_exceed_run_cap(http, *, run_id, per_run_cap_usd, prior_revision_costs) -> (over, info)   # 45-02
lib/voice.py VOICE_CONSTRAINTS (house-voice), agents/calibrator.py StyleBriefOutput{voice, visualDirection}

<!-- Cost mutation (durable). convex/agentRuns.ts:95 completed(workspace_id, runId, agentKey, completedAt, costUsd, durationMs, tokensIn, tokensOut) — UPSERT by (runId, agentKey). -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: revise/preview — direction-chip prompt, structured output, cost recording, cost guard</name>
  <requirements>REV-02, REV-03, REV-05</requirements>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py:495-597 — `preview_claim_evidence` (the read-only preview to mirror: `_resolve_sanity_id`, charity GROQ projection, `acomplete` with structured `response_format`, the `hasattr/isinstance` pick-unwrap).
    - packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py:150-205 — `voice_rewrite` (VOICE_CONSTRAINTS + directive + `acomplete` structure to mirror for the chip prompt).
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py::acomplete — confirm the EXACT keys on the returned `usage` dict (map them into the agentRuns:completed args; RESEARCH assumes usd/tokens_in/tokens_out — verify before wiring).
    - packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py:38-52 — `StyleBriefOutput` only has voice/bonusType/visualDirection (RESEARCH Pitfall 5 — match_brief degradation source).
    - docs/API_CONTRACTS.md §45.1/§45.3/§45.5 — chip identifiers, read-only preview, cost guard/recording rules.
    - packages/pipeline/tests/test_revision_endpoints.py — the Wave-0 stub whose `directive`/`preview`/`cost_attribution` tests this turns green.
  </read_first>
  <behavior>
    - _build_directive returns the fixed clause for make_clearer/make_more_specific/tighten/reduce_repetition
    - _build_directive('custom', custom_direction='punchier') returns 'punchier' verbatim
    - _build_directive('match_brief', brief_context=...) embeds the degraded style_brief/charity context
    - preview mutates nothing (no patch_issue_field, no _emit_audit) and returns proposedText/whatChanged/claimDelta{added,removed,altered}
    - preview records cost via agentRuns:completed with runId==run_id and agentKey matching ^revision-
    - preview returns 409 cost_cap_exceeded when would_exceed_run_cap is True
  </behavior>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/revision.py</files>
  <action>
Create `packages/pipeline/src/eisenbalm_pipeline/api/revision.py` with `router = APIRouter()`.

Define the chip vocabulary (§45.1):
```python
DirectionChip = Literal["make_clearer","make_more_specific","tighten","match_brief","reduce_repetition","try_another_approach","custom"]
_DIRECTION_CLAUSES = {
  "make_clearer": "Make this clearer — simplify sentence structure without losing precision.",
  "make_more_specific": "Make this more specific — add concrete, honestly-available detail.",
  "tighten": "Tighten this — cut words without losing meaning.",
  "reduce_repetition": "Reduce repetition — vary sentence rhythm and word choice from the surrounding prose.",
}
def _build_directive(direction, *, custom_direction, brief_context) -> str:
    if direction == "custom": return (custom_direction or "").strip() or "Revise this passage."
    if direction == "match_brief": return f"Align this passage more closely with the story's voice and premise: {brief_context}"
    # make_clearer/make_more_specific/tighten/reduce_repetition and try_another_approach share the clause map
    return _DIRECTION_CLAUSES.get(direction, "Revise this passage.")
```
Pydantic bodies + structured output:
```python
class _RevisionClaimDelta(BaseModel): added: list[str] = []; removed: list[str] = []; altered: list[str] = []
class _RevisionPick(BaseModel): proposedText: str; whatChanged: str; claimDelta: _RevisionClaimDelta
class _RevisePreviewBody(BaseModel):
    sectionName: str; quotedText: str; blockIndexHint: Optional[int] = None
    direction: DirectionChip; customDirection: Optional[str] = None; priorProposals: list[str] = []
```
`POST /issues/{run_id}/revise/preview` (`Depends(_require_clerk_jwt_control)`):
1. `_resolve_sanity_id` → convex_http/sanity_http/sanity_id/actor.
2. Cost guard FIRST (§45.5): `cfg = await load_run_config(convex_http)`; `over, info = await would_exceed_run_cap(convex_http, run_id=run_id, per_run_cap_usd=cfg.per_run_cap_usd, prior_revision_costs=[])`; if `over` → raise `HTTPException(409, detail={"reason":"cost_cap_exceeded","message":"...", **info})`.
3. Build `brief_context` (match_brief degradation, Pitfall 5): a scoped GROQ projection for charity `missionStatement`/`whyOverlooked`/`focusArea` + `style_brief` voice/visualDirection where available (best-effort; empty string when absent — never crash). Reuse the `_sc._groq` projection pattern from `preview_claim_evidence`.
4. `directive = _build_directive(body.direction, custom_direction=body.customDirection, brief_context=brief_context)`; append an avoid-block when `body.priorProposals` is non-empty (D-05): `"\n\nPrevious attempt(s) to avoid repeating:\n" + "\n".join("- "+p ...)`.
5. `messages = [{system: VOICE_CONSTRAINTS + "Rewrite the QUOTED PASSAGE per the directive; keep Jesse's dry, precise, Fortune-500 register; no AI self-reference/hedging. Also report the claim delta (added/removed/altered) of factual assertions relative to the original."}, {user: f"DIRECTIVE: {directive}\nQUOTED PASSAGE: {body.quotedText}{avoid_block}"}]`.
6. `pick, usage = await acomplete(agent_id="revision", run_id=run_id, messages=messages, response_format=_RevisionPick)` — REAL run_id (D-13), agent_id "revision" (registered in 45-02). Unwrap `proposedText`/`whatChanged`/`claimDelta` with the same hasattr/isinstance fallback `preview_claim_evidence` uses; default proposedText to `body.quotedText` if empty.
7. Record cost durably (D-13, Pitfall 2): `await _cc.convex_mutation(convex_http, "agentRuns:completed", {"workspace_id":"eisenbalm","runId":run_id,"agentKey":f"revision-{uuid.uuid4().hex[:12]}","completedAt":int(time.time()*1000),"costUsd":<usage cost>,"durationMs":0,"tokensIn":<usage in>,"tokensOut":<usage out>})` — map the usage keys per the acomplete return shape you confirmed. NEVER reuse a pipeline agentKey.
8. Return `{"proposedText":..., "whatChanged":..., "claimDelta": {...}}`. NO Sanity patch, NO `_emit_audit`.
Register the router in `main.py` (Task 2). Convert the Wave-0 `directive`/`preview`/`cost_attribution` tests to real assertions and remove the module `importorskip` guard only after `revision.py` exists (the guard auto-activates the module).
  </action>
  <verify>
    <automated>cd packages/pipeline && python -m pytest tests/test_revision_endpoints.py -k "directive or preview or cost_attribution" -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "async def preview_passage_revision\|revise/preview" packages/pipeline/src/eisenbalm_pipeline/api/revision.py` (route present).
    - `grep -q "def _build_directive" packages/pipeline/src/eisenbalm_pipeline/api/revision.py` and all 7 chip identifiers appear (`make_clearer`…`custom`); the file contains NO occurrence of the word `Regenerate`.
    - preview handler calls `would_exceed_run_cap` and raises 409 `cost_cap_exceeded` (`grep -q "cost_cap_exceeded" packages/pipeline/src/eisenbalm_pipeline/api/revision.py`).
    - preview records cost with a distinct agentKey (`grep -q "revision-" packages/pipeline/src/eisenbalm_pipeline/api/revision.py` and `grep -q "agentRuns:completed" packages/pipeline/src/eisenbalm_pipeline/api/revision.py`) under `run_id=run_id` (NOT an `evidence-preview-`/`revise-preview-` pseudo-id).
    - `cd packages/pipeline && python -m pytest tests/test_revision_endpoints.py -k "directive or preview or cost_attribution" -x` exits 0.
  </acceptance_criteria>
  <done>The preview endpoint runs the parametrized chip prompt, returns the comparison payload with a claim delta, records its cost durably under the real run_id with a fresh agentKey, and 409s on cost cap — validated by the directive/preview/cost tests.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: revise/apply (atomic + audited) + mount router in main.py</name>
  <requirements>REV-04</requirements>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py:603-687 — `apply_claim_evidence` (the atomic apply to mirror: `_patch_prose_span` → sign-off revoke → `_emit_audit` one row; 409 handling).
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py:200-212 — the `app.include_router(...)` block to append to.
    - docs/API_CONTRACTS.md §45.4 — apply ordering + reason strings (revision_mismatch/span_not_resolved/claim_edit_unavailable) + one audit row.
    - packages/pipeline/tests/test_revision_endpoints.py — the `apply` tests this turns green.
  </read_first>
  <behavior>
    - apply patches Sanity via _patch_prose_span then _revoke_active_signoffs then exactly one _emit_audit(action='passage_revised')
    - stale ifRevisionID → 409 revision_mismatch (propagated from patch_issue_field)
    - unresolved span → 409 span_not_resolved (from _patch_prose_span)
    - bonus on a non-specAd issue → 409 claim_edit_unavailable
    - response {revisionId, resolution:'revision_applied'}
  </behavior>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/revision.py, packages/pipeline/src/eisenbalm_pipeline/api/main.py</files>
  <action>
Add to `revision.py`:
```python
class _ReviseApplyBody(BaseModel):
    ifRevisionID: str; sectionName: str; quotedText: str
    blockIndexHint: Optional[int] = None; newText: str
```
`POST /issues/{run_id}/revise/apply` (`Depends(_require_clerk_jwt_control)`):
1. `convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(request, run_id, claims)`.
2. `new_rev = await _patch_prose_span(convex_http, sanity_http, sanity_id=sanity_id, run_id=run_id, section_name=body.sectionName, quoted_text=body.quotedText, block_index_hint=body.blockIndexHint, new_text=body.newText, if_revision_id=body.ifRevisionID)` — this raises 409 `span_not_resolved` / `revision_mismatch` / `claim_edit_unavailable` and runs `_reset_touched_claims` FIRST internally (45-02).
3. `await _revoke_active_signoffs(convex_http, run_id=run_id, reason="passage revised")` — Phase-34 revocation IS applied (DERIVED-STATE-CONTRACT §10: port the sentence, not the prototype bug where voiceDone survives).
4. `await _emit_audit(convex_http, actor_id=actor, action="passage_revised", resource_type="passage", resource_id=f"{run_id}:{body.sectionName}", before=<truncated {sectionName, quotedText}>, after=<truncated {newText}>, run_id=run_id)` — exactly ONE row (D-18).
5. Return `{"revisionId": new_rev, "resolution": "revision_applied"}`.
Passage revision has no claim-specific terminal status, so no reset-first/terminal-last ordering
concern applies here (RESEARCH Pitfall 4) — do NOT add a claimChecks write.
End the module with `__all__ = ["router"]`.

In `main.py`: `from eisenbalm_pipeline.api import ... revision ...` (extend the existing grouped
import at line ~31) and add `app.include_router(revision.router)` in the include block (after
`factcheck.router`). Convert the `apply` Wave-0 tests to real assertions.
  </action>
  <verify>
    <automated>cd packages/pipeline && python -m pytest tests/test_revision_endpoints.py -k apply -x && python -c "from eisenbalm_pipeline.api.main import app; print('mounted' if any('/revise/apply' in getattr(r,'path','') for r in app.routes) else 'MISSING')" | grep mounted</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "revise/apply" packages/pipeline/src/eisenbalm_pipeline/api/revision.py` and the handler calls `_patch_prose_span`, `_revoke_active_signoffs`, and `_emit_audit` (all three greppable in the file).
    - `grep -q "passage_revised" packages/pipeline/src/eisenbalm_pipeline/api/revision.py` (single audit action).
    - `grep -q "revision.router" packages/pipeline/src/eisenbalm_pipeline/api/main.py`.
    - `cd packages/pipeline && python -m pytest tests/test_revision_endpoints.py -k apply -x` exits 0 (patch + revoke + one audit; 409 on stale revision + unresolved span).
    - `python -m pytest` (full pipeline suite) stays green.
  </acceptance_criteria>
  <done>The apply endpoint mutates the passage through the shared write boundary, revokes active sign-offs, emits exactly one passage_revised audit row, and 409s correctly; the router is mounted; the full pipeline suite is green.</done>
</task>

</tasks>

<verification>
- `pytest tests/test_revision_endpoints.py -x` green (directive/preview/apply/cost).
- Router mounted: app exposes `/issues/{run_id}/revise/preview` and `/revise/apply`.
- Full `python -m pytest` green.
</verification>

<success_criteria>
The passage-revision endpoint pair generalizes FCT-06 (one apply path), runs the chip prompt with a
claim delta, records cost durably under the real run_id, enforces the per-issue cost cap via 409,
and applies atomically with sign-off revocation + one audit row.
</success_criteria>

<output>
After completion, create `.planning/phases/45-agent-revision/45-03-SUMMARY.md`.
</output>
