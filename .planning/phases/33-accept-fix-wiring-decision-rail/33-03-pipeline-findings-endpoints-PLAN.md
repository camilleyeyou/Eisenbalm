---
phase: 33-accept-fix-wiring-decision-rail
plan: 03
type: execute
wave: 2
depends_on: [33-01]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/span_resolver.py
  - packages/pipeline/src/eisenbalm_pipeline/api/findings.py
  - packages/pipeline/src/eisenbalm_pipeline/api/review.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
  - packages/pipeline/tests/test_span_resolver.py
  - packages/pipeline/tests/test_findings_endpoints.py
  - packages/pipeline/tests/test_review_endpoints.py
autonomous: true
requirements: [EDT-04, GLY-04]

must_haves:
  truths:
    - "Accept re-resolves the quotedSpan server-side, replaces it with suggestedFix via the Phase 31 scoped patch, flips the Convex resolution, and writes an audit row"
    - "Dismiss requires a non-empty reason, flips resolution, and audits; reopen clears resolution and audits"
    - "The Python span resolver matches spanResolver.ts stage-for-stage and never guesses on ambiguity"
    - "publish_issue AND schedule_issue return 409 open_error_findings when unresolved error findings exist (orphaned included)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/span_resolver.py"
      provides: "Python port of spanResolver.ts (exact/quote-norm/whitespace + never-guess)"
      contains: "def resolve_span"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/findings.py"
      provides: "accept/dismiss/reopen endpoints"
      exports: ["router"]
    - path: "packages/pipeline/tests/test_findings_endpoints.py"
      provides: "endpoint matrix incl. all 409 branches"
      contains: "span_not_resolved"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/findings.py"
      to: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py::patch_issue_field"
      via: "accept applies the scoped patch"
      pattern: "patch_issue_field"
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/findings.py"
      to: "qaCorrections:setResolution"
      via: "_cc.convex_mutation"
      pattern: "qaCorrections:setResolution"
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/review.py::publish_issue"
      to: "qaCorrections:byRunId"
      via: "open-error-findings gate"
      pattern: "open_error_findings"
---

<objective>
Build the pipeline side of Phase 33: a Python span resolver (`lib/span_resolver.py`) that mirrors the TS resolver, a new `api/findings.py` router with accept/dismiss/reopen endpoints (D-02..D-08, EDT-04), the open-error-findings 409 gate added to BOTH `publish_issue` and `schedule_issue` (D-14, D-11b, GLY-04 server), and the `qaCorrections:setResolution` path added to the secret-injection set.

Purpose: This is the write engine — accept mutates the real Sanity draft through the Phase 31 scoped-patch machinery, flips Convex resolution through the secret-guarded mutation, and logs everything ("nothing silent"). The publish gate makes the block server-enforced, not cosmetic.
Output: Two new pipeline modules + gate edits + router registration, fully covered by pytest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md
@.planning/phases/33-accept-fix-wiring-decision-rail/33-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- Verified pipeline primitives the endpoints compose. -->
From packages/pipeline/src/eisenbalm_pipeline/api/content.py:
```python
async def _resolve_sanity_id(request, run_id, claims) -> tuple[convex_http, sanity_http, sanity_id, actor]
    # 404 if run missing; 409 {reason:"no_sanity_issue"} if sanityIssueId unset
```
From packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py:
```python
async def get_issue_draft(http, issue_id) -> dict   # returns sections[key]["blocks"] as {type,text}[] via pt_to_blocks
async def patch_issue_field(http, *, issue_id, field_path, value, if_revision_id) -> str  # returns new _rev; raises 409 {reason:"revision_mismatch"}
```
From packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py:
```python
def compose_section_body(blocks: list) -> list[dict]   # {type,text}[] -> Portable Text
```
From packages/pipeline/src/eisenbalm_pipeline/api/control.py:
```python
def _require_clerk_jwt_control(...)   # Depends() auth guard; dev-mode sentinel -> claims["sub"]="local-dev-operator"
async def _emit_audit(http, *, actor_id, action, resource_type, resource_id, before=None, after=None)
```
From packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py:
```python
async def convex_query(http, path, args) -> Any
async def convex_mutation(http, path, args) -> Any   # injects pipelineSecret ONLY for paths in _PIPELINE_SECRET_GUARDED_PATHS
_PIPELINE_SECRET_GUARDED_PATHS = frozenset({... "claimChecks:insertBatch", "reviewActions:record", "auditLog:record", ...})
```
Reference TS resolver (port target): apps/dispatch-control/lib/galley/spanResolver.ts
QA sectionName -> draft key map (mirror apps/dispatch-control/lib/galley/sectionIdMap.ts):
  origin_story->originStory · problem->problemStatement · founder_bio->founderBio · case_study->caseStudy · bonus->bonus (specAd only) · game-> NO block body (409 accept_unavailable)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Python span resolver port + parity tests</name>
  <read_first>
    - apps/dispatch-control/lib/galley/spanResolver.ts (the FULL algorithm to port 1:1 — three stages, normQuotes, disambiguate, never-guess)
    - apps/dispatch-control/__tests__/spanResolver.test.ts (mirror these cases for parity, if the file exists; otherwise derive from the TS resolver's documented behavior)
    - docs/API_CONTRACTS.md §33.5 (frozen resolver contract)
    - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py (block shape {type,text} the resolver operates on)
  </read_first>
  <behavior>
    - Exact match: quotedSpan present verbatim in exactly one block → resolved with correct start/end.
    - Curly-quote tolerance: quotedSpan uses straight quotes, block uses ‘’“” (or vice-versa) → resolved (length-preserving normalization; offsets index ORIGINAL text).
    - Whitespace tolerance: quotedSpan has single spaces, block has a newline/double space in the same run → resolved via `\s+` collapse.
    - Ambiguity: same quotedSpan appears in 2 blocks with no usable blockIndexHint → returns None (unresolved), NEVER a guess.
    - Hint disambiguation: 2 matches, blockIndexHint names one of them → that one wins; hint out of range / not a candidate → ambiguous → None.
    - No match: quotedSpan absent → None.
  </behavior>
  <action>
Create `packages/pipeline/src/eisenbalm_pipeline/lib/span_resolver.py` as a direct 1:1 port of `apps/dispatch-control/lib/galley/spanResolver.ts`. Expose `resolve_span(blocks: list[dict], quoted: str, block_index_hint: int | None) -> Match | None` where a `Match` (dataclass or namedtuple) carries `block_index: int`, `start: int`, `end: int`. Implement the three block-by-block stages IN ORDER, searching each block independently (NEVER against joined section text):
1. Exact: `block["text"].find(quoted)` per block.
2. Quote-normalized: `_norm_quotes(s)` replaces `‘’ → '` and `“” → "` (1:1, length-preserving); match `_norm_quotes(block_text).find(_norm_quotes(quoted))`; `end = idx + len(quoted)`.
3. Whitespace-tolerant: `pattern = re.sub(r"\s+", r"\\s+", re.escape(_norm_quotes(quoted)))`; `re.finditer(pattern, _norm_quotes(block_text))`; use `m.start()`/`m.end()` (offsets index the original text because normalization preserved length).
Disambiguation (identical to TS `disambiguate`): 0 → next stage; 1 → winner; 2+ → return the hinted candidate ONLY if `block_index_hint` is an int in `[0, len(blocks))` AND names an actual candidate block, else ambiguous → treated as unresolved (return None). Add a module docstring citing spanResolver.ts and §33.5, and the never-guess rule.

Create `packages/pipeline/tests/test_span_resolver.py` covering all six behaviors above (mirror the TS test cases where they exist).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/test_span_resolver.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/test_span_resolver.py -x -q` exits 0
    - `grep -q "def resolve_span" packages/pipeline/src/eisenbalm_pipeline/lib/span_resolver.py` succeeds
    - `grep -q "def _norm_quotes\|_norm_quotes" packages/pipeline/src/eisenbalm_pipeline/lib/span_resolver.py` succeeds (quote normalization present)
    - `grep -q "\\\\s+" packages/pipeline/src/eisenbalm_pipeline/lib/span_resolver.py` succeeds (whitespace-tolerant stage present)
    - test_span_resolver.py contains an ambiguity case asserting `resolve_span(...) is None` with 2+ matches and no valid hint
  </acceptance_criteria>
  <done>span_resolver.py mirrors spanResolver.ts stage-for-stage, offsets index the original text, ambiguity returns None, and the parity suite passes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: findings.py router (accept/dismiss/reopen) + register + secret path</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py (lines 58-105 _resolve_sanity_id; lines 229-274 patch_section for the compose_section_body → patch_issue_field pattern; lines 483-535 patch_bonus for the bonus.body field-path family)
    - packages/pipeline/src/eisenbalm_pipeline/api/review.py (the guard/audit/409-detail shape to clone; _emit_audit + _require_clerk_jwt_control imports)
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (_emit_audit signature incl. before/after; _require_clerk_jwt_control)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (_PIPELINE_SECRET_GUARDED_PATHS set + the docstring demanding sync)
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py (how content_router / review_router are include_router'd — findings_router registers the same way)
    - docs/API_CONTRACTS.md §33.3 (frozen endpoint flows, bodies, 409 reasons, return shapes)
    - packages/pipeline/src/eisenbalm_pipeline/lib/span_resolver.py (resolve_span from Task 1)
  </read_first>
  <behavior>
    - accept happy path: resolvable span + matching revision → patches {section}.body, flips resolution='accepted', audits before=quotedSpan/after=suggestedFix, returns {revisionId, findingId, resolution:"accepted"}.
    - accept 409 accept_unavailable: finding missing suggestedFix OR quotedSpan (D-07); and game/non-specAd-bonus sections (no block body).
    - accept 409 span_not_resolved: resolve_span returns None.
    - accept 409 revision_mismatch: patch_issue_field raises it (propagated, D-06).
    - accept 409 already_resolved: finding.resolution already set.
    - accept 404: finding id not found for the run.
    - dismiss: empty/whitespace reason → 422; valid → flips resolution='dismissed'+reason, audits after=reason, NO Sanity write.
    - reopen: resolved finding → clears resolution, audits; not-resolved finding → 409 not_resolved.
  </behavior>
  <action>
Create `packages/pipeline/src/eisenbalm_pipeline/api/findings.py` with `router = APIRouter()` and three Clerk-JWT-guarded POST routes exactly per §33.3. Compose existing primitives (do NOT reinvent): import `_resolve_sanity_id` from `api.content` (or clone per its existing precedent), `get_issue_draft`/`patch_issue_field` from `lib.sanity_client`, `compose_section_body` from `lib.portable_text`, `_emit_audit`/`_require_clerk_jwt_control` from `api.control`, `convex_query`/`convex_mutation` as `_cc`, and `resolve_span` from `lib.span_resolver`.

Define a module-level `_QA_SECTION_TO_DRAFT_KEY = {"origin_story":"originStory","problem":"problemStatement","founder_bio":"founderBio","case_study":"caseStudy","bonus":"bonus"}` mirroring sectionIdMap.ts (cite it in a comment; note `problem→problemStatement` is the non-obvious one). `game` is intentionally absent → accept 409 accept_unavailable.

Accept endpoint flow (per §33.3): load finding via `qaCorrections:byId` (404 if None or `runId` mismatch; 409 `already_resolved` if `resolution` truthy) → 409 `accept_unavailable` if no `suggestedFix`/`quotedSpan` OR section not in `_QA_SECTION_TO_DRAFT_KEY` OR (`section=="bonus"` and draft `bonusType != "specAd"`) → `get_issue_draft` → `blocks = draft["sections"][key]["blocks"]` (for bonus, use the `bonus.body` rows exactly as content.py::patch_bonus does; field_path is `"bonus.body"`, else `f"{key}.body"`) → `resolve_span(blocks, quotedSpan, blockIndexHint)`; None → 409 `span_not_resolved` with the §33.3 message → `blocks[m.block_index]["text"] = text[:m.start] + suggestedFix + text[m.end:]` → `patch_issue_field(sanity_http, issue_id=sanity_id, field_path=<path>, value=compose_section_body(blocks), if_revision_id=body.ifRevisionID)` (propagate its 409 revision_mismatch) → `_cc.convex_mutation(convex_http, "qaCorrections:setResolution", {"id": finding_id, "resolution":"accepted", "resolvedBy": actor, "resolvedAt": now_ms})` → `_emit_audit(action="finding.accepted", resource_type="finding", resource_id=f"{run_id}:{finding_id}", before=quotedSpan, after=suggestedFix)` → return `{"revisionId": new_rev, "findingId": finding_id, "resolution":"accepted"}`. Per Pitfall 6, if the Sanity patch succeeds but the Convex flip raises, surface a 500/502 with a message telling the operator the text was applied but the finding state was not updated (do NOT swallow — the flip is load-bearing for the gate).

Dismiss endpoint: body `{reason:str}`; strip/validate non-empty → 422 otherwise; load finding (404; 409 already_resolved) → `qaCorrections:setResolution` (resolution='dismissed', resolutionReason=reason, resolvedBy, resolvedAt) → `_emit_audit(action="finding.dismissed", after=reason)` → `{"findingId":..., "resolution":"dismissed"}`. No Sanity write.

Reopen endpoint: load finding (404; 409 `not_resolved` if `resolution` absent) → `qaCorrections:setResolution` with `resolution=None` (clears fields, accepted=false) → `_emit_audit(action="finding.reopened")` → `{"findingId":..., "resolution": None}`.

Register the router: add `app.include_router(findings_router)` in `api/main.py` alongside the existing content/review routers (import it the same way). In `lib/convex_client.py`, add `"qaCorrections:setResolution"` to `_PIPELINE_SECRET_GUARDED_PATHS` (the docstring mandates keeping this set in sync with `convex/*.ts`) — WITHOUT this, every accept/dismiss/reopen 500s with Unauthorized (Pitfall 3).

Create `packages/pipeline/tests/test_findings_endpoints.py` cloning the `test_content_patch_endpoints.py` TestClient harness (FastAPI app + include findings_router + `app.state.convex_http`/`sanity_http` MagicMocks; monkeypatch `_cc.convex_query`/`_cc.convex_mutation` and `eisenbalm_pipeline.api.findings.get_issue_draft`/`patch_issue_field`). Cover all behaviors listed above.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/test_findings_endpoints.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/test_findings_endpoints.py -x -q` exits 0
    - `grep -q "qaCorrections:setResolution" packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` succeeds (path added to the guarded set)
    - `grep -c "findings" packages/pipeline/src/eisenbalm_pipeline/api/main.py` returns ≥ 1 (router registered)
    - findings.py contains all three route decorators: `grep -c "@router.post" packages/pipeline/src/eisenbalm_pipeline/api/findings.py` returns ≥ 3
    - findings.py maps `"problem": "problemStatement"`: `grep -q '"problem": "problemStatement"' packages/pipeline/src/eisenbalm_pipeline/api/findings.py` succeeds
    - findings.py emits before/after audit on accept: `grep -q "before=" packages/pipeline/src/eisenbalm_pipeline/api/findings.py && grep -q "after=" packages/pipeline/src/eisenbalm_pipeline/api/findings.py` succeeds
    - test file asserts the four accept 409 reasons AND the dismiss-422: `grep -c "accept_unavailable\|span_not_resolved\|revision_mismatch\|already_resolved" packages/pipeline/tests/test_findings_endpoints.py` returns ≥ 4 and `grep -q "422" packages/pipeline/tests/test_findings_endpoints.py` succeeds
  </acceptance_criteria>
  <done>accept/dismiss/reopen endpoints compose the existing patch/audit/Convex primitives per §33.3, the setResolution path is secret-injected, the router is registered, and the endpoint matrix passes.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: open-error-findings publish gate on publish_issue + schedule_issue</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/review.py (publish_issue guard chain lines ~88-128; schedule_issue guard chain lines ~198-248 — the new gate slots in AFTER the claims-signoff gate in BOTH)
    - packages/pipeline/tests/test_review_endpoints.py (existing test file to EXTEND — clone the claims-gate test to cover the new open-error gate)
    - docs/API_CONTRACTS.md §33.4 (frozen 409 shape + Pitfall 8 gate parity)
  </read_first>
  <behavior>
    - publish_issue: a run with an unresolved error-severity finding → 409 {reason:"open_error_findings", count:n}; all findings resolved/dismissed OR only warning/info open → passes the gate.
    - An ORPHANED error finding (resolution absent, anchor would fail) STILL blocks (the gate is anchor-blind, D-11b).
    - schedule_issue: identical gate — a scheduled publish with an open error finding → 409 open_error_findings.
  </behavior>
  <action>
In `packages/pipeline/src/eisenbalm_pipeline/api/review.py`, add an identical guard to BOTH `publish_issue` and `schedule_issue`, inserted AFTER the existing `claimChecks:allSignedOff` gate (guard 3) and BEFORE the sanityIssueId guard (guard 4). The guard:
```python
findings = await _cc.convex_query(http, "qaCorrections:byRunId", {"runId": run_id}) or []
open_errors = [f for f in findings if f.get("severity") == "error" and not f.get("resolution")]
if open_errors:
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail={
        "reason": "open_error_findings",
        "message": f"{len(open_errors)} error finding(s) must be accepted or dismissed before publishing.",
        "count": len(open_errors)})
```
The `not f.get("resolution")` predicate is deliberately anchor-blind — an orphaned error finding (which still has no `resolution`) blocks (D-11b). Use the same message copy for schedule (or "…before scheduling." — either matches §33.4 intent). Do NOT change the ordering or wording of the existing guards.

Extend `packages/pipeline/tests/test_review_endpoints.py` with cases covering the three behaviors above for BOTH publish and schedule (monkeypatch `_cc.convex_query` so `qaCorrections:byRunId` returns rows with `severity:"error"` + no `resolution`, and separately with `resolution:"accepted"`).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/test_review_endpoints.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/test_review_endpoints.py -x -q` exits 0
    - `grep -c "open_error_findings" packages/pipeline/src/eisenbalm_pipeline/api/review.py` returns ≥ 2 (guard present in BOTH publish_issue and schedule_issue)
    - `grep -q 'severity") == "error" and not f.get("resolution")' packages/pipeline/src/eisenbalm_pipeline/api/review.py` succeeds (anchor-blind predicate, D-11b)
    - test_review_endpoints.py asserts a schedule call also 409s on open error findings: `grep -q "open_error_findings" packages/pipeline/tests/test_review_endpoints.py` succeeds with both a publish and a schedule assertion
    - Full pipeline suite still green: `cd packages/pipeline && uv run pytest -x -q` exits 0 (no regression from the guard insertion)
  </acceptance_criteria>
  <done>Both publish_issue and schedule_issue refuse (409 open_error_findings) when unresolved error findings exist, orphaned findings still block, and the extended review-endpoint suite plus the full pipeline suite pass.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_span_resolver.py tests/test_findings_endpoints.py tests/test_review_endpoints.py -x -q` all green.
- `cd packages/pipeline && uv run pytest -x -q` ≥ prior baseline passing.
- `grep qaCorrections:setResolution packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` present.
</verification>

<success_criteria>
- The pipeline can apply accept-fixes to the real draft, flip Convex resolution, log every action, and refuse to publish/schedule while error findings are open.
</success_criteria>

<output>
After completion, create `.planning/phases/33-accept-fix-wiring-decision-rail/33-03-SUMMARY.md`
</output>
