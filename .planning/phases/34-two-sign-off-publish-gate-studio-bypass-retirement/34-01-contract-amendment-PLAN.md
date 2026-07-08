---
phase: 34-two-sign-off-publish-gate-studio-bypass-retirement
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
autonomous: true
requirements: [PUB-01, PUB-02, PUB-03, PUB-04]

must_haves:
  truths:
    - "docs/API_CONTRACTS.md contains a Phase 34 section documenting the sign_offs table, sign-off endpoint, gate restructure, webhook re-validation, and Studio document-action BEFORE any code exists"
    - "The two-sign-off publish/schedule 409 (missing_signoffs) condition and the relocated facts-cleared prerequisites are documented"
    - "The webhook D-07 revert-to-in-review + block + alert behavior is documented, including the run_id=None case"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§34 contract for sign_offs table, sign-off endpoint, publish/schedule/webhook gate, Studio action override"
      contains: "## Phase 34"
  key_links: []
---

<objective>
Amend `docs/API_CONTRACTS.md` with a new Phase 34 section (§34) that freezes every interface boundary this phase introduces, BEFORE any endpoint or schema code is written. This is a CLAUDE.md HARD RULE (mirroring how §31/§32/§33 were each written first): the contract amendment is the first task of the phase, and plans 34-02..34-06 implement it verbatim with zero shape discretion.

Purpose: Fix the `sign_offs` table shape, the sign-off endpoint path + body, the restructured 409 conditions on publish/schedule, the webhook's re-validation + revert behavior, and the Studio document-action override — so no field name, path, literal, or 409 reason string is invented later.
Output: `docs/API_CONTRACTS.md` gains a `## Phase 34 — Two-Sign-Off Publish Gate + Studio Bypass Retirement` section inserted directly after the existing `## Phase 33 — Accept-Fix Wiring + Decision Rail` block (which ends near line 2911) and BEFORE the global `## Error handling rules` appendix (line ~2913).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-CONTEXT.md
@.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write §34 contract into docs/API_CONTRACTS.md</name>
  <read_first>
    - docs/API_CONTRACTS.md (lines ~2731-2913: read the existing §33 block and the trailing `## Error handling rules` appendix — §34 inserts between them, matching the §31/§32/§33 heading + prose style exactly)
    - .planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-CONTEXT.md (D-01..D-12 — the locked decisions §34 must encode)
    - .planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-RESEARCH.md (§Architecture Patterns 1-5 + §Open Questions — the verified endpoint shapes, payload keys, 409 reasons, and the resolved open questions)
    - convex/schema.ts lines 397-425 (claim_checks + review_actions tables — the exact defineTable/index style §34's sign_offs table must mirror)
    - convex/reviewActions.ts (record mutation + pipelineSecret pattern — the shape signOffs.ts will follow)
    - packages/pipeline/src/eisenbalm_pipeline/api/review.py lines 62-330 (publish_issue + schedule_issue current guard chains — §34 documents which guards relocate and which is added)
    - packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py (the sanity_publish guard chain — §34 documents the D-07 insertion point after idempotency, before asyncio.create_task)
    - apps/studio/schemas/weeklyIssue.ts lines 53-67 (status field values: 'draft' | 'in-review' | 'published' — pin 'in-review' as the D-07 revert target)
  </read_first>
  <action>
Insert a new `## Phase 34 — Two-Sign-Off Publish Gate + Studio Bypass Retirement` section into docs/API_CONTRACTS.md immediately after the §33 block (which ends with its italic "*All Phase 33 changes are additive...*" note near line 2911) and BEFORE the `## Error handling rules` heading (~line 2913). Document ALL of the following verbatim so plans 34-02..34-06 have zero discretion on shapes:

**§34.1 — Convex `sign_offs` table (D-02, additive, new table).** Append after the `review_actions` table (~convex/schema.ts:424). Frozen shape:
```typescript
sign_offs: defineTable({
  workspace_id: v.string(),
  runId: v.string(),
  kind: v.union(v.literal('facts-cleared'), v.literal('sounds-human')),
  actorId: v.string(),          // verified-upstream Clerk sub from the FastAPI endpoint
  signedAt: v.number(),         // Unix ms
  revokedAt: v.optional(v.number()),      // present = revoked; absent = active
  revokedReason: v.optional(v.string()),
})
  .index('by_runId', ['runId'])
  .index('by_runId_and_kind', ['runId', 'kind'])
  .index('by_workspace', ['workspace_id'])
```
Semantics: exactly ONE row per (runId, kind). "Active" = `revokedAt` absent. Revocation PATCHES the row's `revokedAt`/`revokedReason` (per Research Open Question #3 recommendation — the audit_log carries the immutable actor+timestamp+reason trail, so the row itself need not be an append log). Re-signing after a revocation PATCHES the same row (clears `revokedAt`/`revokedReason`, refreshes `actorId`/`signedAt`).

**§34.2 — `convex/signOffs.ts` functions.** Document these exact signatures:
- `record` (mutation, pipeline-lane — MUST call `requirePipelineSecret`, MUST be added to `_PIPELINE_SECRET_GUARDED_PATHS`): args `{ workspace_id: v.string(), runId: v.string(), kind: v.union(v.literal('facts-cleared'), v.literal('sounds-human')), actorId: v.string(), pipelineSecret: v.optional(v.string()) }`. Handler: upsert by (runId, kind) via the `by_runId_and_kind` index — if a row exists, PATCH `{ actorId, signedAt: Date.now(), revokedAt: undefined, revokedReason: undefined }`; else INSERT `{ workspace_id, runId, kind, actorId, signedAt: Date.now() }`.
- `revokeAll` (mutation, pipeline-lane — MUST call `requirePipelineSecret`, MUST be in `_PIPELINE_SECRET_GUARDED_PATHS`): args `{ runId: v.string(), reason: v.string(), pipelineSecret: v.optional(v.string()) }`. Handler: for every row with matching `runId` and `revokedAt` absent, PATCH `{ revokedAt: Date.now(), revokedReason: reason }`. No-op when none active.
- `activeByRunId` (query, PUBLIC — no guard, per the existing unguarded-read convention of `claimChecks:allSignedOff`/`qaCorrections:byRunId`; Research Pitfall 2): args `{ runId: v.string() }`. Returns an object keyed by kind for ACTIVE rows only, e.g. `{ 'facts-cleared': { actorId, signedAt }, 'sounds-human': { actorId, signedAt } }`. A kind absent from the returned object = not signed (or revoked).
- `listByRunId` (query, PUBLIC): args `{ runId: v.string() }`. Returns all rows for the run (active + revoked) for the rail's who-signed-when display.

**§34.3 — Sign-off record endpoint (D-01, D-05, D-06).** One new Clerk-JWT-guarded (`_require_clerk_jwt_control`) POST route in a NEW `api/signoffs.py` router:
- `POST /issues/{run_id}/sign-off` — body `{ kind: "facts-cleared" | "sounds-human" }` (Pydantic `Literal` — any other value → 422). Flow: run lookup via `pipelineRuns:byRunId` (404 if missing) → **if `kind == "facts-cleared"`** enforce the RELOCATED prerequisites (D-04): (a) `claimChecks:allSignedOff` → 409 `{reason:"claims_not_signed_off", message:"All claim checks must be signed off before clearing facts."}` when not all signed; (b) `qaCorrections:byRunId` open-error scan `[f for f in findings if f.severity=="error" and not f.resolution]` → 409 `{reason:"open_error_findings", message:"{n} error finding(s) must be accepted or dismissed before clearing facts.", count:n}` (anchor-blind, D-11b) → **if `kind == "sounds-human"`** NO prerequisites (D-06, ungated — nothing machine-checkable until Phase 36) → record via `signOffs:record({workspace_id:"eisenbalm", runId, kind, actorId=claims["sub"]})` → `_emit_audit(action="signoff.recorded", resource_type="run", resource_id=f"{run_id}:{kind}")` → return `{ "runId": run_id, "kind": kind, "signedAt": <ms> }`. NOTE: there is NO manual revoke endpoint — revocation happens ONLY via D-08 auto-revoke on content mutation (§34.6). NOTE: no override path (D-03) — a missing/ambiguous sign-off ALWAYS resolves to "not signed," never a lenient default (Research Anti-Pattern 4).

**§34.4 — Publish/schedule gate restructure (D-04, D-09, PUB-01).** In `review.py::publish_issue` AND `review.py::schedule_issue`: REMOVE the existing `claims_not_signed_off` guard AND the `open_error_findings` guard (both relocate to §34.3's facts-cleared sign-off). ADD, in their place (after the `wrong_status` guard, before the `no_sanity_issue` guard), a single new guard:
```python
active = await _cc.convex_query(http, "signOffs:activeByRunId", {"runId": run_id}) or {}
missing = [k for k in ("facts-cleared", "sounds-human") if k not in active]
if missing:
    raise HTTPException(status_code=409, detail={
        "reason": "missing_signoffs",
        "message": "Both sign-offs (Facts cleared + Sounds human) are required before publishing.",
        "missing": missing})
```
`schedule_issue` uses the identical guard (D-09 — a scheduled publish must not bypass by scheduling; the D-07 webhook re-check covers fire-time if a sign-off is revoked between scheduling and the tick). Message may say "…before scheduling." for schedule. The existing `wrong_status`, `no_sanity_issue`, `schedule_in_past` guards and the reviewActions/audit writes are UNCHANGED.

**§34.5 — Webhook re-validation + revert (D-07, PUB-02).** In `webhooks.py::sanity_publish`, insert ONE guard AFTER the idempotency-dedup block and BEFORE the `asyncio.create_task(_run_publisher(...))` call. Read `convex_http` and `sanity_http` from `request.app.state`. Logic: `run_id = payload.get("runId")`; `active = await _cc.convex_query(convex_http, "signOffs:activeByRunId", {"runId": run_id}) or {}` when `run_id` is truthy else `{}`; `missing = [k for k in ("facts-cleared","sounds-human") if k not in active]`. **BLOCK when `run_id` is None OR `missing` is non-empty** (Research Open Question #2 — a run-less Studio-authored draft can never carry sign-offs, so it blocks by default per D-03/D-07 spirit): call `_revert_sanity_status(sanity_http, issue_id, status="in-review")` (§34.7 helper), `_emit_audit(convex_http, actor_id="webhook", action="run.publish_bypass_blocked", resource_type="run", resource_id=run_id or issue_id, after=json.dumps({"missing": missing, "reason": "missing_signoffs" if run_id else "no_run_id"}))`, emit the D-07 alert (§34.6b), and `return {"ok": True, "blocked": "missing_signoffs", "missing": missing}` WITHOUT launching `_run_publisher`. Ordering fact (document it): the legitimate dashboard-publish path flips Sanity to `published` only AFTER its own §34.4 gate passed, so both sign-offs are already active when the webhook fires for a legit publish — the re-check passes naturally, no race. The ONLY failing case is a direct Studio status-flip that skipped the gate.

**§34.6 — D-08 auto-revoke on content mutation (D-08, PUB-01 integrity).** A shared helper `_revoke_active_signoffs(http, *, run_id, reason)` (co-located with `_emit_audit` in `api/control.py`, fail-open — a revoke failure must not block the content save) calls `signOffs:revokeAll({runId, reason})`. It is invoked (one extra line after the existing `_emit_audit` call) in EVERY content-mutating endpoint: all 9 `content.py` routes (patch_section, patch_headline, patch_theme, patch_game, patch_pdf_data_points, patch_bonus, patch_deliberation_conversation, patch_podcast_transcript, upload_content_asset), all 3 `findings.py` routes (accept_finding, dismiss_finding, reopen_finding — accept mutates the draft; dismiss/reopen change the facts-cleared prerequisite basis so they too void the sign-offs and close the gate-integrity hole created by relocating the error-findings check to §34.3), and `control.py::rerun_agent`. Revocation clears BOTH kinds (per CONTEXT discretion recommendation). Because `DecisionRail.tsx` subscribes to `signOffs:activeByRunId` live, any revocation flips the rail red with zero polling.

**§34.6b — D-07 bypass alert (Research Pitfall 3 / Open Question #1 — resolved to the precedent).** The bypass alert reuses the FROZEN `deliberationEvents.eventType` union (Phase 27 D-04 — do NOT add a new literal): insert a `deliberationEvents` row with outer `eventType: "cost-warning"` and an inner `payload` JSON `{ "eventType": "publish-bypass-blocked", "runId": <id>, "missing": <list> }`, exactly as the `auto-publish-enabled` alert did. Document the known label tradeoff in a code comment (the notification email subject renders "budget" — accepted codebase tradeoff, matches CONTEXT's "same pattern as the auto_publish alert").

**§34.7 — `_revert_sanity_status` helper (D-07).** A new helper in `lib/sanity_publish.py`, the mirror image of the existing `_flip_sanity_published`: same `POST /{_API_VERSION}/data/mutate/{dataset}` PATCH-mutate shape, `{"set": {"status": status}}` where `status` defaults to `"in-review"` (the valid non-published `weeklyIssue.status` value confirmed in apps/studio/schemas/weeklyIssue.ts).

**§34.8 — `_PIPELINE_SECRET_GUARDED_PATHS` additions.** `signOffs:record` and `signOffs:revokeAll` MUST be added to the frozenset in `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` (Research Pitfall 1 — a guarded mutation missing from this set 401s at runtime). Reads (`signOffs:activeByRunId`, `signOffs:listByRunId`) are PUBLIC queries — NOT added (Pitfall 2).

**§34.9 — Studio publish-action override (D-10, PUB-03).** `apps/studio/sanity.config.ts` gains a `document.actions` resolver gated by `process.env.SANITY_STUDIO_DISABLE_PUBLISH === 'true'`: when the flag is `'true'` and `context.schemaType === 'weeklyIssue'`, filter out the `'publish'` action; otherwise return `prev` unchanged. The flag defaults OFF (unset) during the soak; ending the soak = set the flag + redeploy Studio, no new code. `SANITY_STUDIO_*` vars are build-time-inlined (same convention as the existing `SANITY_STUDIO_PROJECT_ID`). The webhook re-check (§34.5) protects the gate regardless of flag state.

Close the section with an italic note (mirroring §31/§32/§33 style): "*All Phase 34 changes are additive: a new `sign_offs` table + `signOffs.ts`; the publish/schedule guards are restructured (two checks relocate to the facts-cleared sign-off, one new missing_signoffs guard added); no field is renamed; Phase 26/31/32/33 shapes are unchanged.*"

Do NOT introduce any Voice Pass detection (Phase 36) or source-bound-claims (Phase 35) shapes — "Sounds human" here is a pure ungated attestation.
  </action>
  <verify>
    <automated>grep -q "## Phase 34 — Two-Sign-Off Publish Gate" docs/API_CONTRACTS.md && grep -q "sign_offs: defineTable" docs/API_CONTRACTS.md && grep -q "missing_signoffs" docs/API_CONTRACTS.md && grep -q "run.publish_bypass_blocked" docs/API_CONTRACTS.md && grep -q "_revert_sanity_status" docs/API_CONTRACTS.md && grep -q "SANITY_STUDIO_DISABLE_PUBLISH" docs/API_CONTRACTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "facts-cleared" docs/API_CONTRACTS.md && grep -q "sounds-human" docs/API_CONTRACTS.md` succeed (both sign-off kinds documented)
    - `grep -q "/issues/{run_id}/sign-off" docs/API_CONTRACTS.md` succeeds (endpoint path documented)
    - `grep -q "signOffs:record" docs/API_CONTRACTS.md && grep -q "signOffs:revokeAll" docs/API_CONTRACTS.md && grep -q "signOffs:activeByRunId" docs/API_CONTRACTS.md` all succeed
    - `grep -q "requirePipelineSecret" docs/API_CONTRACTS.md && grep -q "_PIPELINE_SECRET_GUARDED_PATHS" docs/API_CONTRACTS.md` succeed within the §34 block (secret-guard wiring documented)
    - `grep -q "publish-bypass-blocked" docs/API_CONTRACTS.md && grep -q "cost-warning" docs/API_CONTRACTS.md` succeed (frozen-union alert reuse documented)
    - `grep -q "in-review" docs/API_CONTRACTS.md` succeeds within the §34 block (revert target pinned)
    - `grep -q "document.actions" docs/API_CONTRACTS.md && grep -q "weeklyIssue" docs/API_CONTRACTS.md` succeed (Studio override documented)
    - The §34 heading appears AFTER `## Phase 33` and BEFORE `## Error handling rules`: `awk '/## Phase 33/{p33=NR} /## Phase 34/{p34=NR} /## Error handling rules/{eh=NR} END{exit !(p33<p34 && p34<eh)}' docs/API_CONTRACTS.md` exits 0
    - No Phase 35/36 scope leaks: `grep -c "Voice Pass detection\|source-bound claim\|machine-tell" docs/API_CONTRACTS.md` unchanged from the pre-edit count
  </acceptance_criteria>
  <done>docs/API_CONTRACTS.md has a complete §34 section covering the sign_offs table + signOffs.ts functions, the sign-off endpoint with relocated facts prerequisites, the publish/schedule missing_signoffs gate, the webhook revert+block+alert (incl. run_id=None), the D-08 revoke helper, _revert_sanity_status, the guarded-path additions, and the Studio document-action override — positioned between §33 and the error-handling appendix, additive-only, no Phase 35/36 scope.</done>
</task>

</tasks>

<verification>
- `grep "## Phase 34" docs/API_CONTRACTS.md` returns the new heading.
- Every path, field name, and 409 reason string referenced by plans 34-02..34-06 exists verbatim in §34.
</verification>

<success_criteria>
- The frozen §34 contract exists; downstream plans can be implemented from it without inventing any shapes.
</success_criteria>

<output>
After completion, create `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-01-SUMMARY.md`
</output>
