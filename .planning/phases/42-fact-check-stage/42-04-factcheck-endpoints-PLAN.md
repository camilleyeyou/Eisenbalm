---
phase: 42-fact-check-stage
plan: 04
type: execute
wave: 3
depends_on: ["42-01", "42-03"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
  - packages/pipeline/tests/test_factcheck_endpoints.py
autonomous: true
requirements: [FCT-05, FCT-06]

must_haves:
  truths:
    - "The content-touching claim actions (Edit claim when text changes, Ask-agent evidence apply) go dashboard -> pipeline API -> Sanity/Convex, each logged to audit_log; the dispatch-control-no-sanity-write tripwire stays green"
    - "Keep-as-written rejects an empty reason and writes a terminal status + audit row; Remove tombstones the row (status='removed'); Replace-source updates sourceUrl + code-stamped retrievedAt"
    - "Ask agent for better evidence is two-step: a read-only preview returns a replacement source AND a rewritten claim (no mutation); a separate apply atomically content-patches Sanity + updates the claim + audits + resets touched claims — designed to generalize to arbitrary passage revision (Phase 45 extends the SAME endpoint)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py"
      provides: "keep / PATCH claim / replace-source / remove / evidence-preview / evidence-apply routes, all _require_clerk_jwt_control"
      exports: ["router"]
      min_lines: 120
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/main.py"
      provides: "factcheck router mounted"
      contains: "factcheck.router"
  key_links:
    - from: "api/factcheck.py evidence/apply + PATCH(text)"
      to: "lib/span_resolver.py resolve_span + lib/sanity_client.py patch_issue_field + content.py _reset_touched_claims + _emit_audit"
      via: "server-side span re-resolution against CURRENT Sanity blocks, then patch + reset + audit (mirrors findings.py::accept_finding)"
      pattern: "resolve_span"
    - from: "api/factcheck.py evidence/preview"
      to: "lib/search_client.py web_search + lib/openrouter_client.py acomplete"
      via: "Tavily numbered-results + index-selection discipline (mirrors researcher.py), no mutation"
      pattern: "web_search"
---

<objective>
Build the new `api/factcheck.py` router owning the six claim actions and the two-step "Ask agent for better evidence" flow (FCT-05, FCT-06), cloning the already-shipped `findings.py::accept_finding` (apply) + `voice_pass.py::voice_rewrite` (preview) templates. This ESTABLISHES the span-scoped agent-revision contract claim-scoped first — Phase 45 generalizes the SAME endpoint.

Purpose: These are the operator verbs of Stage 3. Status-only actions (Confirm) stay direct Convex; content-touching actions (Edit-claim-with-text, evidence-apply) must flow through the pipeline write boundary so every mutation gets an audit row and the no-direct-Sanity-write tripwire stays green (EDT-05, D-14).

RATIONALE — Keep-as-written is pipeline-side ON PURPOSE (checker Warning 4): even though "Keep as written" mutates no Sanity content, it must write a D-18 decision-log/audit_log entry, and `convex/auditLog.ts::record` is `requirePipelineSecret`-guarded (convex/auditLog.ts:64-76) — so a decision-log write is ONLY reachable from the pipeline layer. Therefore Keep-as-written routes through the Clerk-guarded `POST .../keep` endpoint → `requirePipelineSecret`-guarded `keepAsWritten` + `_emit_audit`, NOT a bare dashboard Convex mutation. Do not "simplify" it to a direct dashboard mutation — that would silently drop the decision-log entry FCT-05/D-18 requires.
Output: factcheck.py with 6 routes, mounted in main.py; pytest coverage mirroring test_content_patch_endpoints.py / test_findings_endpoints.py.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/42-fact-check-stage/42-CONTEXT.md
@.planning/phases/42-fact-check-stage/42-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- Verified from the current repo tree. Clone these two files' structure. -->

api/findings.py::accept_finding  (~line 112) — the APPLY template:
  @router.post("/issues/{run_id}/findings/{finding_id}/accept")
  load finding -> 409 guards -> get_issue_draft(run_id) -> resolve_span(blocks, quoted_span, blockIndexHint)
    (None -> 409 span_not_resolved) -> patch_issue_field(...) (stale rev -> 409 revision_mismatch)
    -> Convex flip -> _emit_audit(...) -> return {revisionId, ...}
  imports: _emit_audit, _require_clerk_jwt_control (from api.control/content helpers),
           get_issue_draft, patch_issue_field (lib.sanity_client), resolve_span (lib.span_resolver)
  dismiss_finding (~line 253) rejects empty reason — the "Keep as written" reason-guard template.

api/voice_pass.py::voice_rewrite (~line 150) — the PREVIEW template:
  @router.post("/issues/{run_id}/voice-rewrite")  — ONLY generates text (acomplete), never mutates.
  imports: acomplete (lib.openrouter_client)

api/content.py (Plan 42-03): _reset_touched_claims, _touched_block_indices, _revoke_active_signoffs — importable helpers.
lib/search_client.py::web_search(query, *, max_results=5) -> numbered Tavily results (each .url).
convex/auditLog.ts::record — requirePipelineSecret-guarded (so _emit_audit/decision-log writes are pipeline-only).
Convex (Plan 42-01): claimChecks:byRunIdAndIndex, updateClaim, keepAsWritten, remove (all requirePipelineSecret except byRunIdAndIndex).
api/main.py mounts routers (~lines 199-208): app.include_router(signoffs.router) is the last one today.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: keep / PATCH-claim / replace-source / remove routes + mount router (FCT-05)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py, packages/pipeline/src/eisenbalm_pipeline/api/main.py, packages/pipeline/tests/test_factcheck_endpoints.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/findings.py (accept_finding + dismiss_finding — the router scaffold, 409 guards, _emit_audit call, empty-reason rejection to clone)
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py (_reset_touched_claims, _revoke_active_signoffs, _resolve_sanity_id, the get_issue_draft/patch_issue_field usage pattern, _require_clerk_jwt_control import)
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py (router mount block ~lines 199-208)
    - convex/auditLog.ts (record is requirePipelineSecret-guarded — the reason Keep-as-written is pipeline-side, per this plan's objective RATIONALE)
    - docs/API_CONTRACTS.md §42.4 (the endpoint paths/bodies/guards just written in Plan 42-01)
    - packages/pipeline/tests/test_findings_endpoints.py (the pytest monkeypatch style for these endpoints)
  </read_first>
  <behavior>
    - POST /issues/{run_id}/claims/{claim_index}/keep with empty/whitespace reason => 400/422 (rejected, mirrors dismiss_finding); with a reason => claimChecks:keepAsWritten(status='checked') + one _emit_audit row (action, before/after, reason). No Sanity write, but pipeline-side because the audit/decision-log write requires the pipeline secret.
    - PATCH /issues/{run_id}/claims/{claim_index} with only sourceUrl/retrievedAt (no text) => claimChecks:updateClaim, no Sanity patch, one audit row.
    - PATCH with `text` present => get_issue_draft -> resolve_span(current_blocks, claim_row.text, claim_row.blockIndexHint) (None => 409 span_not_resolved) -> patch_issue_field (stale rev => 409 revision_mismatch) -> _reset_touched_claims (BEFORE) -> claimChecks:updateClaim(text=...) + terminal status set LAST (Pitfall 3 ordering) -> _revoke_active_signoffs -> _emit_audit.
    - POST .../replace-source {sourceUrl, retrievedAt?} => claimChecks:updateClaim(sourceUrl, retrievedAt=body.retrievedAt or now-ms code-stamped), audit row, no Sanity write.
    - DELETE /issues/{run_id}/claims/{claim_index} {reason?} => claimChecks:remove (status='removed'), audit row, no Sanity write.
    - Every route requires _require_clerk_jwt_control (401 without a valid token).
  </behavior>
  <action>
Create api/factcheck.py with `router = APIRouter()` and four routes, cloning findings.py's structure (imports, Depends(_require_clerk_jwt_control), Pydantic request bodies, 409/400 error shapes, _emit_audit calls). Resolve the target claim via claimChecks:byRunIdAndIndex(runId, claimIndex) (404 if absent). Use the exact paths from §42.4:
  - POST `/issues/{run_id}/claims/{claim_index}/keep` body `_KeepBody{reason: str}` — reject empty reason exactly like dismiss_finding; call claimChecks:keepAsWritten with pipelineSecret; _emit_audit(action="claim_kept", before=claim_row, after={status:'checked'}, reason=body.reason). (Pipeline-side because the audit/decision-log write is requirePipelineSecret-guarded — see objective RATIONALE.)
  - PATCH `/issues/{run_id}/claims/{claim_index}` body `_PatchClaimBody{ifRevisionID: str | None, text: str | None, sourceUrl: str | None, retrievedAt: int | None}`. If text is None: just claimChecks:updateClaim(sourceUrl?, retrievedAt?) + audit. If text present: the full content-patch path above, calling `_reset_touched_claims` FIRST then setting the acted claim's terminal status LAST (Pitfall 3 self-reset ordering), and clearing the acted claim's changedSinceCheck via keepAsWritten/updateClaim so the explicit action wins.
  - POST `/issues/{run_id}/claims/{claim_index}/replace-source` body `_ReplaceSourceBody{sourceUrl: str, retrievedAt: int | None}` — claimChecks:updateClaim(sourceUrl, retrievedAt = body.retrievedAt or int(time.time()*1000)); audit.
  - DELETE `/issues/{run_id}/claims/{claim_index}` body `_RemoveBody{reason: str | None}` — claimChecks:remove; audit(action="claim_removed", reason).
Reuse the pipeline-secret constant/env the other routers use when calling the requirePipelineSecret mutations.

In api/main.py, add `from eisenbalm_pipeline.api import factcheck` (matching the existing import style) and `app.include_router(factcheck.router)` after the signoffs mount.

Write packages/pipeline/tests/test_factcheck_endpoints.py covering the <behavior> list, monkeypatching get_issue_draft/patch_issue_field/resolve_span and the Convex mutation/query boundary exactly like test_content_patch_endpoints.py / test_findings_endpoints.py, and asserting: the empty-reason rejection; the PATCH-without-text no-Sanity path; the PATCH-with-text ordering (reset called before the acted claim's terminal status); one _emit_audit row per mutating call.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_factcheck_endpoints.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "app.include_router(factcheck.router)" packages/pipeline/src/eisenbalm_pipeline/api/main.py` matches
    - factcheck.py contains route decorators for `/keep`, `PATCH ".../claims/{claim_index}"`, `/replace-source`, and a `DELETE` claim route, each with `Depends(_require_clerk_jwt_control)`
    - factcheck.py contains `_reset_touched_claims`, `_emit_audit`, and `claimChecks:keepAsWritten` / `claimChecks:remove` / `claimChecks:updateClaim` references
    - `cd packages/pipeline && uv run pytest tests/test_factcheck_endpoints.py -x -q` exits 0
  </acceptance_criteria>
  <done>The four non-evidence claim actions exist behind the Clerk-guarded pipeline boundary, each auditable; Keep rejects empty reasons and stays pipeline-side so its decision-log entry is writable; content-touching PATCH resolves against current Sanity blocks and orders reset-before-terminal-status; the router is mounted.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: evidence/preview + evidence/apply — the two-step agent-revision contract (FCT-06)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py, packages/pipeline/tests/test_factcheck_endpoints.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py (voice_rewrite — the read-only preview template: acomplete call, response-model shape, NO mutation/NO audit)
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py (the web_search numbered-results + sourceIndex-selection discipline lines ~190-244 — reuse so a hallucinated URL is structurally impossible)
    - packages/pipeline/src/eisenbalm_pipeline/api/findings.py (accept_finding — the apply template being cloned for evidence/apply)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (get_issue_draft / patch_issue_field; and the small scoped GROQ projection pattern for charity name — 42-RESEARCH Pitfall 6)
    - .planning/phases/42-fact-check-stage/42-RESEARCH.md (Pattern 1 lines 160-183, Pattern 2 lines 185-200, Pitfall 5 lines 296-300, Pitfall 6 lines 302-306)
  </read_first>
  <behavior>
    - POST .../evidence/preview {} => forms a Tavily query from claim_row.text + charity name/website (small scoped GROQ projection), runs web_search, has the LLM select a sourceIndex (never emit a raw URL) + produce a rewrittenClaim; returns {sourceUrl, sourcePublisher, retrievedAt, rewrittenClaim}. NO Convex mutation, NO Sanity patch, NO audit row.
    - preview never mutates: a test asserts zero calls to patch_issue_field / claimChecks mutations / _emit_audit during preview.
    - POST .../evidence/apply {ifRevisionID, sourceUrl, retrievedAt, rewrittenClaim} => get_issue_draft -> resolve_span(current_blocks, claim_row.text, blockIndexHint) (None => 409 span_not_resolved) -> patch_issue_field replacing the claim's prose with rewrittenClaim (stale rev => 409) -> _reset_touched_claims FIRST -> claimChecks:updateClaim(text=rewrittenClaim, sourceUrl, retrievedAt) + terminal status set LAST -> _revoke_active_signoffs -> _emit_audit (action="claim_evidence_applied", before/after, includes the source swap). Atomic ordering: any 409 aborts before the Convex claim update.
    - The request/response shapes are span-scoped and claim-agnostic enough that Phase 45 can reuse them for arbitrary passages (documented in a docstring; do not hard-code claim-only field names into the wire shape beyond claim_index in the path).
  </behavior>
  <action>
Add two routes to api/factcheck.py:
  - POST `/issues/{run_id}/claims/{claim_index}/evidence/preview` — clone voice_rewrite's read-only shape. Resolve claim via byRunIdAndIndex. Fetch charity context with a scoped GROQ projection `*[_id == $id][0]{"charityName": charity->name, "charityWebsite": charity->website}` (mirror content.py::_fetch_before's pattern; do NOT expand get_issue_draft). Build a query string from claim_row.text + charityName; `batch = await web_search(query, max_results=5)`; number results `[S0]..[Sn]`; call `acomplete(agent_id="researcher", run_id=f"evidence-preview-{run_id}", ...)` with a small Pydantic response model `_EvidencePick{sourceIndex: int, rewrittenClaim: str}`; resolve sourceUrl = results[sourceIndex].url (guard bounds), sourcePublisher = host of sourceUrl, retrievedAt = now-ms. Return {sourceUrl, sourcePublisher, retrievedAt, rewrittenClaim}. NO mutation, NO audit.
  - POST `/issues/{run_id}/claims/{claim_index}/evidence/apply` body `_EvidenceApplyBody{ifRevisionID: str, sourceUrl: str, retrievedAt: int, rewrittenClaim: str}` — clone accept_finding's apply path exactly, substituting claim_row for the finding: resolve_span against CURRENT blocks using claim_row.text + claim_row.blockIndexHint (Pitfall 5: never use claimSpans, they are ephemeral), patch_issue_field with rewrittenClaim, then `_reset_touched_claims` FIRST, then claimChecks:updateClaim(text=rewrittenClaim, sourceUrl, retrievedAt) + terminal status LAST (Pitfall 3), then _revoke_active_signoffs, then _emit_audit. Return {revisionId, claimIndex, resolution:"evidence_applied"}.
Add a docstring on both routes noting this establishes the span-scoped agent-revision contract that Phase 45 generalizes (do not fork a second endpoint).

Extend test_factcheck_endpoints.py: monkeypatch web_search + acomplete to return a fixed numbered batch + pick; assert preview returns the derived sourceUrl/sourcePublisher and makes ZERO mutating calls; assert apply performs patch + updateClaim + audit in the correct order and 409s on span_not_resolved / revision_mismatch.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_factcheck_endpoints.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - factcheck.py contains route decorators for `.../evidence/preview` and `.../evidence/apply`
    - `grep -n "web_search" packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py` matches (preview reuses Tavily, not a hand-rolled fetch)
    - `grep -n "resolve_span" packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py` matches (apply resolves against current blocks)
    - The preview route contains NO `_emit_audit` and NO `patch_issue_field` call (verify by reading it)
    - `cd packages/pipeline && uv run pytest tests/test_factcheck_endpoints.py -x -q` exits 0
  </acceptance_criteria>
  <done>"Ask agent for better evidence" is a read-only preview (source + rewritten claim, no mutation) plus an atomic apply (content patch + claim update + reset + audit), built as a span-scoped contract Phase 45 can generalize.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_factcheck_endpoints.py -x -q` green.
- Router mounted; all routes Clerk-guarded; content-touching routes audit + reset; preview is side-effect-free; Keep-as-written stays pipeline-side for its decision-log write.
- The console still has no direct Sanity write path — these are all pipeline-side (verified holistically in Plan 42-08's no-sanity-write tripwire).
</verification>

<success_criteria>
FCT-05 (six actions with correct write boundaries + audit) and FCT-06 (two-step evidence preview/apply, atomic content-patch + claim update + decision-log) are satisfied at the API layer, behind EDT-05, with the shared span-scoped contract established claim-scoped.
</success_criteria>

<output>
After completion, create `.planning/phases/42-fact-check-stage/42-04-SUMMARY.md`.
</output>
