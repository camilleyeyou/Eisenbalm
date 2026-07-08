# Phase 34: Two-Sign-Off Publish Gate + Studio Bypass Retirement - Research

**Researched:** 2026-07-08
**Domain:** Server-enforced dual-attestation publish gate (FastAPI + Convex) + Sanity Studio document-action override
**Confidence:** HIGH — every integration point was read directly from the working codebase; the one external-library claim (Sanity `document.actions`) was verified against current Sanity docs/discussions, not training-data recall.

## Summary

This phase adds exactly one new Convex table (`sign_offs`), two-ish new FastAPI endpoints (record / revoke, method TBD by planner), a restructured 409-gate on three existing endpoints (`publish_issue`, `schedule_issue`, and the webhook's `sanity_publish` handler), a revocation side-effect hooked onto ~9 existing content-mutation endpoints, and one Studio-side `document.actions` override behind an env flag. Nothing here is greenfield — every piece extends a pattern that already shipped in Phases 26, 31, or 33, and the codebase is unusually well-documented about exactly where those seams are.

The single most important fact this research surfaces: **the webhook already receives `runId` in its payload** (`{_id, _type, status, issueNumber, "runId": pipelineMetadata.runId}`, configured in the Sanity webhook projection and confirmed live in `api/webhooks.py:121` via `payload.get("runId")`). This means D-07's "how does the webhook identify the run for a Sanity issue ID" question is **already answered by existing infrastructure** — no new `bySanityIssueId` Convex lookup is needed; the run-lookup is a straight `pipelineRuns:byRunId` call identical to `review.py`'s existing pattern. This closes one of the CONTEXT.md discretion items with certainty.

The second most important fact: the codebase's notification/alert transport has a **frozen `deliberationEvents.eventType` union** (Phase 27 D-04 — "do NOT add new literals"). The established workaround, precedented by the `auto_publish` alert (Phase 26 D-11 / RVW-04), is to insert a `deliberationEvents` row with the outer `eventType: 'cost-warning'` literal (which is the one literal wired to notification dispatch) and an inner JSON `payload.eventType` string carrying the real semantic name (e.g. `'auto-publish-enabled'`). This routes through the existing `notify_on_budget` flag and produces a generic "budget" email subject line — a known, accepted tradeoff in this codebase, not a bug. D-07's bypass alert should follow the identical precedent unless the planner decides the semantic mismatch (a security bypass attempt showing up as a "budget" email) is bad enough to warrant a small Phase 27 extension. This is flagged as an open question below.

**Primary recommendation:** Restructure `review.py`'s existing 409-gate stack (already a proven multi-guard pattern) to check `sign_offs` instead of `claimChecks:allSignedOff` + open-error-findings directly; relocate those two checks into a new "Facts cleared" sign-off endpoint's own prerequisite guard. Reuse `_flip_sanity_published`'s inverse (a second small helper, `_revert_sanity_status`) for the webhook's D-07 revert. Add `sign_offs` mutations to `_PIPELINE_SECRET_GUARDED_PATHS` in `convex_client.py` — this is a load-bearing, easy-to-forget step (see Pitfall 1 below).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PUB-01 | Publishing requires two independent server-enforced sign-offs ("Facts cleared" + "Sounds human"); publish endpoint 409s unless both recorded | `review.py::publish_issue` gate-stack pattern (existing 409 guards to restructure); new `sign_offs` table design below |
| PUB-02 | The Sanity publish webhook handler verifies sign-off state before running the publisher — closes the Studio status-flip bypass | `webhooks.py::sanity_publish` — confirmed `runId` already in payload; insertion point identified after existing HMAC/age/status guards, before `_run_publisher` launch |
| PUB-03 | Sanity Studio's publish action for `weeklyIssue` is disabled/removed after a soak period, documented as read-only fallback | Verified Sanity `document.actions` resolver API (Sanity docs, current); `apps/studio/sanity.config.ts` confirmed vanilla (no existing document-actions override) |
| PUB-04 | Every sign-off, publish attempt, and override is audit-logged with actor + timestamp | `_emit_audit` helper (`api/control.py`) — reusable as-is; `auditLog:record` Convex mutation already supports arbitrary `action`/`resourceType`/`resourceId`/`before`/`after` |

</phase_requirements>

## Standard Stack

No new external dependencies. This phase is 100% internal-pattern reuse:

| Component | Version | Purpose | Why Standard (already in this codebase) |
|-----------|---------|---------|-------------------------------------------|
| FastAPI + Pydantic | existing (`packages/pipeline`) | New sign-off endpoints | Every Phase 26/31/33 endpoint uses this exact shape |
| Convex (`defineTable`/`mutation`/`query`) | existing (`convex/`) | New `sign_offs` table + mutations | Matches `claim_checks`/`review_actions` table conventions exactly |
| Sanity Studio `document.actions` resolver | Sanity Studio `^5.24.0` (`apps/studio/package.json:25`) | D-10 flag-gated publish-action removal | Confirmed current API — see Code Examples below |

**Installation:** None required — no new packages.

**Version verification:** `apps/studio/package.json` pins `"sanity": "^5.24.0"`. The `document.actions` config-level API (as opposed to the older plugin-based `parts:...actions` API from Studio v2) has been stable since Sanity Studio v3 and is unchanged in v5 per current Sanity docs (verified via web search, not training-data recall — see Sources).

## Architecture Patterns

### Recommended file additions

```
packages/pipeline/src/eisenbalm_pipeline/
├── api/
│   ├── review.py           # EDIT: publish_issue/schedule_issue gate restructure (D-04/D-09)
│   ├── webhooks.py         # EDIT: sanity_publish re-validation + revert (D-07)
│   ├── content.py          # EDIT: revocation hook call after each successful patch (D-08)
│   ├── control.py          # EDIT: revocation hook call in rerun_agent (D-08)
│   ├── signoffs.py         # NEW: POST /issues/{run_id}/sign-off, POST /issues/{run_id}/sign-off/{kind}/revoke (or similar — Claude's discretion)
│   └── findings.py         # (unchanged — precedent file to model signoffs.py on)
└── lib/
    └── sanity_publish.py   # EDIT: add _revert_sanity_status (inverse of _flip_sanity_published)

convex/
├── schema.ts                # EDIT: new sign_offs table (append after review_actions, ~L424)
├── signOffs.ts               # NEW: record / revoke / activeByRunId / listByRunId
└── lib/auth.ts               # unchanged — requirePipelineSecret is reused as-is

apps/dispatch-control/
├── lib/
│   └── signOffClient.ts      # NEW: mirrors reviewClient.ts's _reviewFetch pattern
└── app/(dashboard)/review-desk/[runId]/_components/
    └── DecisionRail.tsx      # EDIT: add sign-off controls (D-01/D-05), gate Publish button on both

apps/studio/
├── sanity.config.ts          # EDIT: document.actions resolver behind SANITY_STUDIO_DISABLE_PUBLISH
├── README.md                 # EDIT: read-only-fallback note (D-12)
└── EDITOR_GUIDE.md           # EDIT: soak-criterion + read-only-fallback note (D-11/D-12)
```

### Pattern 1: The existing 409-gate stack (restructure target)

**What:** `review.py::publish_issue` and `schedule_issue` already stack ordered guards, each raising a distinct `HTTPException(409, detail={"reason": ..., "message": ...})`. This is the established shape for "server refuses, UI merely explains" (Phase 26 Pitfall 6, Phase 33 D-14) — never a client-side-only disabled button.

**Current order in `publish_issue`** (`packages/pipeline/src/eisenbalm_pipeline/api/review.py:62-184`):
1. Run lookup → 404
2. `run.status == "awaiting-review"` → 409 `wrong_status`
3. `claimChecks:allSignedOff` → 409 `claims_not_signed_off`
4. Open error-severity findings → 409 `open_error_findings`
5. `sanityIssueId` present → 409 `no_sanity_issue`
6. Action: `_flip_sanity_published` + `reviewActions:record` + `_emit_audit`

**Per D-04, the restructure:** guards 3 and 4 move OUT of `publish_issue`/`schedule_issue` and INTO the new "Facts cleared" sign-off-recording endpoint's own prerequisite check (a 409 there, not at publish time). `publish_issue`/`schedule_issue` gain a single new guard in their place: "both sign-offs recorded and not revoked" → 409 `missing_signoffs` (or per-kind detail — Claude's discretion per CONTEXT). This keeps the guard-stack SHAPE identical (ordered 409s with `{reason, message}` detail) — only the checks it contains change.

**Example (existing code, to be modified):**
```python
# packages/pipeline/src/eisenbalm_pipeline/api/review.py:106-141 (current)
signoff = await _cc.convex_query(
    http, "claimChecks:allSignedOff", {"runId": run_id}
) or {}
if not signoff.get("allSignedOff"):
    raise HTTPException(status_code=409, detail={"reason": "claims_not_signed_off", ...})

findings = await _cc.convex_query(http, "qaCorrections:byRunId", {"runId": run_id}) or []
open_errors = [f for f in findings if f.get("severity") == "error" and not f.get("resolution")]
if open_errors:
    raise HTTPException(status_code=409, detail={"reason": "open_error_findings", ...})
```
becomes (in the new sign-off endpoint, gating the "facts-cleared" kind specifically):
```python
# New: inside POST /issues/{run_id}/sign-off (kind == "facts-cleared")
signoff = await _cc.convex_query(http, "claimChecks:allSignedOff", {"runId": run_id}) or {}
if not signoff.get("allSignedOff"):
    raise HTTPException(status_code=409, detail={"reason": "claims_not_signed_off", ...})
# ... open_errors check, identical ...
# THEN: record the sign_offs row.
```
and `publish_issue` gains, in place of the two removed blocks:
```python
active = await _cc.convex_query(http, "signOffs:activeByRunId", {"runId": run_id}) or {}
missing = [k for k in ("facts-cleared", "sounds-human") if k not in active]
if missing:
    raise HTTPException(status_code=409, detail={"reason": "missing_signoffs", "missing": missing, ...})
```

### Pattern 2: Webhook re-validation + revert (D-07 insertion point)

**What:** `webhooks.py::sanity_publish` already has an ordered guard chain (HMAC → age → status → idempotency) before launching `_run_publisher` in the background. D-07 inserts ONE more guard in that chain, after idempotency dedup and before the `asyncio.create_task(_run_publisher(...))` call.

**Confirmed fact (not assumption):** the webhook payload already contains `runId` — see `docs/API_CONTRACTS.md:1551` (`Projection: { _id, _type, status, issueNumber, "runId": pipelineMetadata.runId }`) and the live handler at `api/webhooks.py:121` (`run_id = payload.get("runId")`). **No Sanity webhook configuration change is needed.** The existing code already tolerates `run_id` being `None` ("may be None for manually-authored drafts") — this is the exact case D-07 must handle: a run-less or sign-off-less publish attempt.

**Insertion point** (`packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py`, after line ~110, before the `asyncio.create_task` call at line 123):
```python
# D-07: re-validate sign-off state before launching the publisher.
if run_id:
    active = await _cc.convex_query(convex_http, "signOffs:activeByRunId", {"runId": run_id}) or {}
    missing = [k for k in ("facts-cleared", "sounds-human") if k not in active]
    if missing:
        log.warning("Webhook publish BLOCKED — missing sign-offs run=%s missing=%s", run_id, missing)
        await _revert_sanity_status(sanity_http, issue_id, status="in-review")
        await _emit_audit(convex_http, actor_id="webhook", action="run.publish_bypass_blocked", ...)
        # emit alert event (Phase 27 seam — see Open Questions)
        return {"ok": True, "blocked": "missing_signoffs", "missing": missing}
else:
    # No runId in payload at all (manually-authored Studio draft with no
    # pipeline run) — cannot have any sign-offs; MUST also block per D-07's
    # "Sanity never claims published for content that didn't deploy [without
    # attestation]" principle. This is a case the CURRENT code silently
    # ALLOWS (run_id=None just flows into _run_publisher with run_id=None) —
    # confirm with planner whether run-less publishes are a real scenario in
    # this app (Studio-authored-from-scratch issues) or dead code.
    ...
```
`convex_http` and `sanity_http` are already available via `request.app.state.convex_http` / `request.app.state.sanity_http` (same pattern as `review.py`) — the webhook handler currently only reads `request.app.state.pool` and `request.app.state.background_tasks`; it will need to also read these two.

The revert helper is the mirror image of the existing `_flip_sanity_published` (`packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py:39-75`) — same PATCH-mutate shape, opposite `set` value:
```python
async def _revert_sanity_status(http: AsyncClient, sanity_issue_id: str, *, status: str = "in-review") -> None:
    """Inverse of _flip_sanity_published — reverts a Studio-flip bypass attempt."""
    # identical PATCH /v2024-01-01/data/mutate/{dataset} shape, {"set": {"status": status}}
```

**Ordering fact that matters (already true, and CONTEXT.md flags it):** the LEGITIMATE dashboard-publish path (`review.py::publish_issue`) only calls `_flip_sanity_published` AFTER its own sign-off gate already passed. So by the time the webhook fires for a legitimate publish, sign-offs are already recorded and active — the webhook's re-check passes naturally, no race. The ONLY way the webhook's re-check fails is a direct Studio status-flip that skipped the dashboard endpoint entirely — exactly the bypass D-07 targets.

### Pattern 3: Revocation hook (D-08) — single call-site insertion, not a new subsystem

**What:** Every content-mutating endpoint in `content.py` (9 routes: `patch_section`, `patch_headline`, `patch_theme`, `patch_game`, `patch_pdf_data_points`, `patch_bonus`, `patch_deliberation_conversation`, `patch_podcast_transcript`, `upload_content_asset`) and `control.py::rerun_agent` already resolve `run_id` up front and already call `_emit_audit` exactly once per mutation, right before `return`. D-08's revocation is a single new call inserted alongside each existing `_emit_audit` call — NOT a new endpoint family, NOT a scan for "all write paths" (the write boundary is already a single choke point per CONTEXT.md and confirmed by reading `content.py` end-to-end: every route funnels through `_resolve_sanity_id`).

**Recommended shape** (a new shared helper, likely in `api/control.py` alongside `_emit_audit` since both are imported everywhere):
```python
async def _revoke_active_signoffs(http, *, run_id: str, reason: str) -> None:
    """Auto-revoke both sign-off kinds on content mutation (D-08). Non-blocking
    on failure — mirrors _emit_audit's fail-open philosophy (a revoke failure
    must not block the content save the operator is actively doing)."""
    try:
        await _cc.convex_mutation(http, "signOffs:revokeAll", {"runId": run_id, "reason": reason})
    except Exception:
        log.warning("signOffs:revokeAll failed for run=%s (non-blocking)", run_id)
```
Called as one extra line in each of the ~9-10 endpoints, right after the existing `_emit_audit(...)` call. The accept-fix / dismiss endpoints in `findings.py` (Phase 33) are ALSO content-mutating in the sense that they change what will be published — CONTEXT.md's canonical_refs explicitly names `content.py` (Phase 31 patches, accept-fix machinery) as the D-08 hook point, so `findings.py`'s accept/dismiss routes should get the same hook.

**Convex reactivity note:** because `DecisionRail.tsx` already subscribes live via `useQuery` (e.g. `api.qaCorrections.byRunId`), adding a `useQuery(api.signOffs.activeByRunId, {runId})` subscription there means a revocation from ANY content-mutation endpoint will make the rail go red live with zero polling — this is a direct extension of the existing pattern, not new plumbing.

### Pattern 4: Pipeline-secret-guarded Convex mutations (mandatory for new mutations)

**What:** Every Convex mutation the FastAPI pipeline calls with attribution (not the browser directly) MUST (a) declare an optional `pipelineSecret: v.optional(v.string())` arg, (b) call `requirePipelineSecret(pipelineSecret)` as the first handler line, and (c) be added to `_PIPELINE_SECRET_GUARDED_PATHS` in `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py:54-78`. This is a THREE-PLACE change, not one — see Pitfall 1.

**Example to follow exactly** (`convex/qaCorrections.ts:88-114`'s `setResolution` — nearly identical shape to what `sign_offs` needs):
```typescript
export const setResolution = mutation({
  args: {
    id: v.id('qaCorrections'),
    resolution: v.optional(v.union(v.literal('accepted'), v.literal('dismissed'))),
    resolutionReason: v.optional(v.string()),
    resolvedBy: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { id, resolution, resolutionReason, resolvedBy, resolvedAt, pipelineSecret }) => {
    requirePipelineSecret(pipelineSecret)
    await ctx.db.patch(id, { resolution, resolutionReason, resolvedBy, resolvedAt, accepted: resolution === 'accepted' })
  },
})
```

### Pattern 5: Sanity Studio `document.actions` override (D-10)

**What:** Sanity Studio v3+ (confirmed unchanged in the pinned v5.24.0) exposes a `document.actions` resolver in `defineConfig()` that receives the previously-resolved action array and a context object (including `context.schemaType`), and returns a filtered/modified array. This is the correct, current API — not a deprecated `parts:...` plugin override.

**Example (Sanity official pattern, adapted for this phase's env-flag requirement):**
```typescript
// apps/studio/sanity.config.ts
export default defineConfig({
  // ...existing config...
  document: {
    actions: (prev, context) => {
      const disablePublish = process.env.SANITY_STUDIO_DISABLE_PUBLISH === 'true'
      if (disablePublish && context.schemaType === 'weeklyIssue') {
        return prev.filter(({ action }) => action !== 'publish')
      }
      return prev
    },
  },
})
```
Source: [Sanity Document Actions docs](https://www.sanity.io/docs/studio/document-actions), [Document Actions API reference](https://www.sanity.io/docs/studio/document-actions-api).

**Important scoping fact confirmed by reading `content.py`'s docstring (§31.1):** this app's pipeline writes NEVER use Sanity's drafts/publish document model (`createOrReplace` directly onto plain `issue-{n}` ids, no `drafts.` prefix). Only Andrew's manual Studio edits use Sanity's native draft/publish workflow (since `sanity.config.ts` has no custom document layer disabling drafts). This means the `document.actions` "publish" action IS the literal Sanity draft→published merge action Andrew currently uses when hand-editing in Studio — removing it does not touch the pipeline's write path at all, only Andrew's manual Studio-UI publish button. `SANITY_STUDIO_*`-prefixed env vars are build-time-inlined by Sanity's Vite-based build (same convention already used for `SANITY_STUDIO_PROJECT_ID`/`SANITY_STUDIO_DATASET` in the existing `sanity.config.ts`) — flipping the flag requires a Studio rebuild+redeploy, exactly as D-10/D-11 specify ("flip flag + redeploy Studio, no new code").

### Anti-Patterns to Avoid

- **Client-side-only gating of Publish.** `DecisionRail.tsx` already disables the Publish button on `blockers.length > 0` — this is UX, not security (Phase 26 Pitfall 6, restated in Phase 33 D-14). The sign-off gate MUST be enforced server-side in `publish_issue`/`schedule_issue`/the webhook, with the client disable as a courtesy only.
- **Adding a new `deliberationEvents.eventType` literal for the D-07 alert.** The union is explicitly FROZEN (Phase 27 D-04, restated in `deliberationEvents.ts:63-67`'s own comment). Reuse `'cost-warning'` + inner payload discriminator, exactly as `auto-publish-enabled` did — see Open Questions for the tradeoff this creates.
- **Forgetting the `_PIPELINE_SECRET_GUARDED_PATHS` update.** A new `signOffs:record`/`signOffs:revokeAll` mutation that declares `requirePipelineSecret` but is NOT added to this frozenset will 401/error at runtime the first time the pipeline calls it — see Pitfall 1.
- **Treating "no `blockIndexHint`"-style silent degradation as acceptable for sign-off state.** Unlike QA finding anchors (which have an explicit "anchor-blind" fallback per D-11b), sign-off state has NO override path (D-03) — a missing or ambiguous sign-off state must always resolve to "not signed," never to a lenient default.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Constant-time secret comparison | A custom `===` check for `pipelineSecret` | `convex/lib/auth.ts::requirePipelineSecret` (already XOR-accumulates, already used everywhere) | Timing side-channel already solved once in this codebase; a second implementation is a second place to get subtly wrong |
| Actor attribution | Trusting a client-supplied `actorId` field | `claims.get("sub")` from the verified Clerk JWT (`_require_clerk_jwt_control`) on the FastAPI side, `requireOperator(ctx)` on any Convex mutation a browser calls directly | `convex/lib/auth.ts` docstring explicitly warns: "never trust an incoming `actorId` arg for identity" |
| Webhook signature/age verification | A new verifier for a "sign-off re-check" concept | N/A — D-07 doesn't need a NEW signature scheme, it reuses the EXISTING verified webhook (HMAC+age already checked before D-07's guard runs) | The webhook is already authenticated by the time D-07's guard executes; D-07 only needs a Convex read, not new crypto |
| Sanity status revert | A generic "undo last Sanity mutation" | A dedicated `_revert_sanity_status` mirroring `_flip_sanity_published`'s exact PATCH shape | The existing helper is the proven, tested pattern for this exact kind of single-field Sanity patch; mirroring it minimizes new surface area |

**Key insight:** This entire phase is "restructure existing gates + add one table + wire one Studio override." The temptation to over-build (a generic sign-off framework, a pluggable revocation-rule engine, a new alerting transport) should be resisted — every comparable prior phase (26, 31, 33) shipped by extending the smallest possible seam.

## Common Pitfalls

### Pitfall 1: Forgetting the three-place Convex mutation wiring
**What goes wrong:** A new pipeline-called Convex mutation (`signOffs:record`, `signOffs:revokeAll`) is added to `convex/signOffs.ts` and called from FastAPI, but omitted from `_PIPELINE_SECRET_GUARDED_PATHS` in `convex_client.py`. Convex either rejects the call with "Unexpected field: pipelineSecret" (if the mutation declares the arg but it's never sent) — or, worse, the mutation's `requirePipelineSecret` call throws "Unauthorized" because no secret was injected.
**Why it happens:** The secret injection is centralized (by design, per Phase 29 D-1) at `convex_client.py:101+`, one level removed from where the actual `convex_mutation(http, "signOffs:record", {...})` call site is written. It's easy to write the Convex mutation + Python call site and forget the third file.
**How to avoid:** After writing the new Convex mutations, grep `_PIPELINE_SECRET_GUARDED_PATHS` and add both new path strings in the same commit/task.
**Warning signs:** A 401/`RuntimeError` from `convex_mutation` in tests or logs the first time a sign-off is recorded; `requirePipelineSecret` throwing.

### Pitfall 2: Sign-off endpoint auth model mismatch with the webhook's re-check
**What goes wrong:** The `POST /issues/{run_id}/sign-off` endpoint is (correctly) Clerk-JWT-guarded like every other review/content endpoint. But the WEBHOOK's re-validation read (`signOffs:activeByRunId`) is a `query`, not a `mutation` — queries in this codebase are consistently PUBLIC (no `pipelineSecret`/`requireOperator` guard; see `claimChecks:allSignedOff`, `qaCorrections:byRunId`, `pipelineRuns:byRunId` — all unguarded queries). This is fine and matches precedent (read access to review-state is not secret), but a planner unfamiliar with the pattern might mistakenly try to guard the read path too, which would break the webhook's re-check since the webhook has no Clerk JWT.
**Why it happens:** The mental model "sign-offs are security-critical" over-generalizes from writes to reads.
**How to avoid:** Follow `claimChecks:allSignedOff`'s existing unguarded-query precedent exactly — sign-off READS are public queries; only the RECORD/REVOKE mutations need the pipeline-secret (or Clerk, for any mutation a browser calls directly) guard.
**Warning signs:** Webhook re-check silently returns empty/errors because it can't authenticate a query call.

### Pitfall 3: The D-07 alert reusing `'cost-warning'` produces a misleading email
**What goes wrong:** Following the established `auto-publish-enabled` precedent literally means a security-relevant "someone tried to bypass the publish gate via Studio" event fires with subject line `"Eisenbalm run <sentinel>: budget"` (since `notificationActions.ts` hardcodes `` `Eisenbalm run ${runId}: ${eventType}` `` and `eventType` is always the OUTER dispatch value `'budget'`, never the inner payload discriminator).
**Why it happens:** `deliberationEvents.eventType` is frozen (D-04) and the notification dispatch seam only recognizes 3 outer literals (`complete`/`failed`/`awaiting-review` from `pipelineRuns:updateStatus`, `budget` from `cost-warning`).
**How to avoid:** Flag this explicitly to the planner (done — see Open Questions). Either (a) accept the generic "budget" label as the established codebase tradeoff (matches CONTEXT.md's literal instruction to reuse "the same pattern as the auto_publish alert"), or (b) scope a minimal Phase 27 extension (a new `notify_on_publish_bypass` flag + a 4th eventType branch in `notificationActions.ts`) as an explicit task in this phase's plan, since D-07 calls this "loud" — a misleadingly-labeled email may not satisfy that intent.
**Warning signs:** UAT reviewer confused by a "budget" email that's actually a security alert.

### Pitfall 4: `schedule_issue`'s two-table status split
**What goes wrong:** `schedule_issue` checks `run.status` from `pipelineRuns:byRunId`, but writes `scheduledPublishAt` via `runs:setScheduledPublish` — a DIFFERENT Convex table (`runs`, not `pipelineRuns`) that separately mirrors status (`runs.status` "mirrors pipelineRuns.status; updated alongside it" per `convex/schema.ts:252`). If a new sign-off gate is added only to one of the two status-tracking tables' read paths, the tick sweep (`runs:dueForPublish`, which reads the `runs` table) could diverge from the publish endpoint's gate (which reads `pipelineRuns`).
**Why it happens:** This is a pre-existing dual-table design (not something Phase 34 introduces), but any new gate touching status/schedule state must respect both tables consistently.
**How to avoid:** The `sign_offs` table is independent of both `pipelineRuns` and `runs` (keyed only by `runId` string, which is the shared join key across both) — so this phase's new gate reads `sign_offs` directly and is naturally immune to the dual-table split. Confirm this explicitly when reviewing `pipeline_tick`'s scheduled-publish sweep (`api/control.py:286-324`) — it calls `_flip_sanity_published` directly for due runs, which per D-09/D-07 will now ALSO need the webhook's re-check to catch a sign-off revoked between scheduling and tick-firing (already covered naturally, since the webhook fires downstream of every `_flip_sanity_published` call regardless of caller).

### Pitfall 5: The `run_id=None` webhook case is live, not hypothetical
**What goes wrong:** `api/webhooks.py`'s docstring and code explicitly handle `run_id = payload.get("runId")` being `None` — "may be None for manually-authored drafts." If Andrew (or anyone) creates a `weeklyIssue` document directly in Studio with no pipeline run behind it, and later manually flips its status to `published`, the webhook fires with `runId: None` (Sanity's projection would return `null` since `pipelineMetadata.runId` doesn't exist on that document). Since a run-less document can never have `sign_offs` rows (they're keyed by `runId`), D-07's re-check must decide: does "no runId at all" ALSO block (safest, matches D-07's spirit), or is it out of scope (only in-scope runs need sign-offs)?
**Why it happens:** This is a genuine, currently-live edge case in the existing code, not a new one introduced by this phase — it just becomes security-relevant once the gate exists.
**How to avoid:** Surface as an explicit planning decision (see Open Questions) rather than letting `if run_id:` silently fall through to "allow" by omission.
**Warning signs:** A manually-Studio-created issue publishes with zero sign-offs and zero block — the exact bypass D-07 exists to prevent, just via document creation instead of document-status-flip.

## Code Examples

### `_emit_audit` — reused verbatim for PUB-04
```python
# packages/pipeline/src/eisenbalm_pipeline/api/control.py:134-172
async def _emit_audit(
    http, *, actor_id: str, action: str,
    resource_type: str | None = None, resource_id: str | None = None,
    before: str | None = None, after: str | None = None,
) -> None:
    """Non-blocking — audit failure must never block the action it's logging."""
    ...
```
Every sign-off record/revoke and every publish/schedule/webhook-block call site should call this exactly as `content.py` and `review.py` already do — no new audit machinery needed.

### `_require_clerk_jwt_control` — reused verbatim for the sign-off endpoints
```python
# packages/pipeline/src/eisenbalm_pipeline/api/control.py:80-129
async def _require_clerk_jwt_control(credentials=Depends(_optional_bearer)) -> dict:
    """Dev-mode-safe Clerk JWT guard — returns {"sub": "local-dev-operator"}
    when CLERK_JWT_ISSUER_DOMAIN is unset locally, requires+verifies a real
    token in any deployed environment."""
```

### Sanity `document.actions` — verified current API
```typescript
// Source: https://www.sanity.io/docs/studio/document-actions-api
document: {
  actions: (prev, context) => {
    if (context.schemaType === 'yourDocumentType') {
      return prev.filter(({ action }) => action !== 'publish')
    }
    return prev
  },
}
```
`action` values include `'publish'`, `'delete'`, `'duplicate'`, `'unpublish'`, `'discardChanges'`, `'restore'`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| `publish_issue`/`schedule_issue` gate directly on `claimChecks:allSignedOff` + open-error-findings | Gate on `sign_offs` (both kinds active); those two checks relocate to be prerequisites of recording the "facts-cleared" sign-off | This phase (D-04) | One conceptual publish-time gate ("missing sign-off(s)") instead of three independent 409 reasons stacked at publish time |
| Sanity Studio status-flip → webhook → unconditional publish | Webhook re-validates sign-off state before launching the publisher | This phase (D-07) | Closes the only remaining bypass of the review gate — the dashboard was already gated (Phase 26), Studio was not |
| No `document.actions` override in `sanity.config.ts` | Flag-gated removal of the `publish` action for `weeklyIssue` | This phase (D-10) | Studio's publish button visually disappears once the flag flips post-soak; the webhook gate (D-07) protects the truth regardless of flag state the whole time |

**Deprecated/outdated:** Nothing in this phase deprecates a previously-shipped mechanism outright — `claimChecks:allSignedOff` and the open-error-findings check remain fully live, just relocated to gate sign-off recording instead of publish directly.

## Open Questions

1. **Does the D-07 bypass alert reuse `'cost-warning'`→`'budget'` (Phase 26 precedent) or warrant a minimal Phase 27 extension (new `notify_on_publish_bypass` flag)?**
   - What we know: The `deliberationEvents.eventType` union is explicitly frozen (D-04); the ONLY precedent for a config/security-style alert (`auto-publish-enabled`) reused `'cost-warning'` and consequently emits a "budget" labeled email.
   - What's unclear: Whether "loud" (D-07's own word) is satisfied by a mislabeled-but-present email, or whether the planner should scope a small `notificationActions.ts` extension in this phase.
   - Recommendation: Default to the precedent (reuse `'cost-warning'`, document the label mismatch in a code comment exactly as `pipelineConfig.ts:187` already does — "re-using closest existing literal"). Only extend `notificationActions.ts` if the plan's author judges the mislabeling to be a real UAT concern; either choice is a small, contained change either way.

2. **Does a webhook firing with `run_id: None` (no `pipelineMetadata.runId` on the Sanity document at all) block, or pass through unchanged?**
   - What we know: This is existing, live behavior — not new to this phase — and the current code comment says it "may be None for manually-authored drafts."
   - What's unclear: Whether "manually-authored drafts" (a document created directly in Studio, never touched by the pipeline) is a real production scenario for this single-operator system, or dead/legacy code path.
   - Recommendation: Block by default (a run-less document can never satisfy "two sign-offs recorded," so the safest reading of D-03's "no override path" extends naturally to "no run-id, no sign-offs, no publish"). Confirm with the phase's CONTEXT owner if this contradicts any known workflow.

3. **Exact `sign_offs` revoke semantics: patch the same row's `revokedAt`, or insert a new terminal row?**
   - What we know: D-02 says "append-friendly and audit-shaped... revocations are recorded, not field-flips that lose history." The closest precedent, `qaCorrections:setResolution`, PATCHES fields onto the existing row (not append-only) — but that table's "history" is preserved by the audit_log's separate before/after snapshot, not by the qaCorrections row itself.
   - What's unclear: Whether "revocations are recorded" is satisfied by patching `revokedAt`/`revokedReason` onto the sign row (simple, one row per (run, kind), queryable via a single index) or requires literally inserting new rows so `sign_offs` becomes a pure append log (more rows, requires "most recent per kind" query logic, but a stricter reading of "append-friendly").
   - Recommendation: Patch-the-row (mirrors `qaCorrections:setResolution` exactly, simpler queries for `activeByRunId`); the audit_log already captures the separate revocation event with actor+timestamp+reason per D-08's own "every revocation gets an audit row" requirement, which satisfies the "recorded, not silently lost" spirit without needing the sign_offs table itself to be a pure event log. This is explicitly marked Claude's discretion in CONTEXT.md — flagging both readings so the planner can decide deliberately.

## Environment Availability

Not applicable — this phase has no new external service/tool dependencies. Sanity, Convex, and Clerk are all already-provisioned, already-used-elsewhere dependencies (confirmed live in the codebase, not merely configured).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (pipeline) | pytest + `pytest.mark.anyio` (async), `TestClient`/in-process ASGITransport `client` fixture from conftest |
| Config file | `packages/pipeline/pyproject.toml` (existing — no changes needed) |
| Quick run command | `cd packages/pipeline && uv run pytest tests/test_review_endpoints.py tests/api/test_webhook_sanity.py -x -q` |
| Full suite command | `cd packages/pipeline && uv run pytest -x -q` |

Frontend (dispatch-control) has its own Vitest suite (`pnpm --filter dispatch-control test`, if present — no existing `DecisionRail.test.tsx` was found; this phase likely adds the first one).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PUB-01 | `publish_issue` 409s `missing_signoffs` when either sign-off absent | unit (FastAPI monkeypatch, mirrors `test_publish_requires_claims_signoff`) | `uv run pytest tests/test_review_endpoints.py -k signoff -x -q` | ❌ Wave 0 — extend `test_review_endpoints.py` |
| PUB-01 | `publish_issue` 200s once both sign-offs active | unit | same file | ❌ Wave 0 |
| PUB-01 | "Facts cleared" sign-off endpoint 409s when claims not all signed off / open error findings exist | unit | new test module or extend `test_review_endpoints.py` | ❌ Wave 0 — new `signoffs.py` has no test file yet |
| PUB-02 | `sanity_publish` webhook reverts status + blocks `_run_publisher` when sign-offs missing | unit (mirrors `test_signature_accept_and_reject` pattern, `client`/`sanity_signature_encoder` fixtures) | `uv run pytest tests/api/test_webhook_sanity.py -k signoff -x -q` | ❌ Wave 0 — extend `test_webhook_sanity.py` |
| PUB-02 | webhook proceeds to `_run_publisher` when both sign-offs active (legit dashboard-publish path) | unit | same file | ❌ Wave 0 |
| PUB-03 | `document.actions` resolver removes `publish` for `weeklyIssue` when flag is `'true'`, leaves it when unset | Studio has no existing test harness found (`apps/studio` — no `*.test.ts` located in a quick scan); likely manual/UAT verification per D-11's "Andrew flips the flag when met" | manual (per `apps/studio/EDITOR_GUIDE.md` soak-criterion doc) | N/A — document as manual verification, not automated |
| PUB-04 | Every sign-off/revoke/publish/block writes exactly one `auditLog:record` row | unit (assert `_emit_audit` called with expected `action` string, mirrors existing `_emit_audit` call-site tests) | `uv run pytest tests/test_review_endpoints.py tests/test_content_endpoints.py -k audit -x -q` (verify `test_content_endpoints.py` exists) | Partially — audit-call assertions exist for Phase 31/33 endpoints; new sign-off actions need equivalent coverage |

### Sampling Rate
- **Per task commit:** `cd packages/pipeline && uv run pytest tests/test_review_endpoints.py tests/api/test_webhook_sanity.py -x -q`
- **Per wave merge:** `cd packages/pipeline && uv run pytest -x -q` (full pipeline suite — confirm no regression in the ~200+ existing tests referenced by prior phases' REQUIREMENTS.md entries)
- **Phase gate:** Full suite green + a manual UAT pass on the Studio publish-action removal (D-11's flag/soak mechanism is inherently non-automatable — it depends on Andrew's real weekly usage)

### Wave 0 Gaps
- [ ] `tests/test_review_endpoints.py` — extend with sign-off-gate cases for `publish_issue`/`schedule_issue` (covers PUB-01)
- [ ] `tests/api/test_webhook_sanity.py` — extend with D-07 re-validation + revert cases (covers PUB-02)
- [ ] A new test module for the sign-off record/revoke endpoints themselves (whatever file `signoffs.py`'s router lands in) — no existing file to extend, unlike the two above
- [ ] Convex-side: confirm whether this repo has any Convex mutation unit tests (a quick scan found none referenced in `docs/API_CONTRACTS.md`'s testing conventions — Convex logic here appears to be validated only via the FastAPI-level integration tests that monkeypatch `_cc.convex_query`/`convex_mutation`); if so, no gap — if not, this is consistent with existing project convention (not a phase-specific gap)
- [ ] Frontend: no `DecisionRail` test file currently exists (`apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/` — only the component and `ResolvedFindingsList` were found); adding sign-off UI controls without a corresponding test is consistent with the existing Phase 33 pattern (no test found for `DecisionRail.tsx` either) — flag as a possible existing gap, not new to this phase

## Project Constraints (from CLAUDE.md)

- **Contract-first (hard rule):** `docs/API_CONTRACTS.md` MUST be amended (new `§34` section: `sign_offs` table shape, the sign-off/revoke endpoint request/response shapes, the publish/schedule endpoints' revised 409 conditions, the webhook's new re-validation + revert behavior) BEFORE any endpoint or schema code is written. This mirrors exactly how §31, §32, §33 were each written before their respective phase's implementation.
- **Schema field names:** Do not modify existing field names in `convex/schema.ts` or `schemas/*.ts` without checking `docs/API_CONTRACTS.md` first — this phase is purely additive (new `sign_offs` table; no renames anywhere).
- **GSD workflow enforcement:** All file-changing work must go through a GSD command (`/gsd:execute-phase`, etc.) — not a constraint on the plan's content, but on how it gets executed.
- **Voice/brand constraints:** Not directly applicable — this phase is pipeline/dashboard/Studio infrastructure, no reader-facing or Jesse-voice content.
- **"Nothing silent" (project-wide convention, not CLAUDE.md verbatim but load-bearing per PROJECT.md and every recent phase's CONTEXT.md):** every sign-off, revocation, publish attempt, and bypass-block writes an audit row — carried through as PUB-04 and D-08 above.

## Sources

### Primary (HIGH confidence — read directly from the working codebase)
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py` — full read, existing gate-stack pattern
- `packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` — full read, confirmed `runId` already in webhook payload
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py` — full read, all 9 content-mutation routes + shared `_resolve_sanity_id`/`_emit_audit` helpers
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` — full read, `_emit_audit`, `_require_clerk_jwt_control`, `rerun_agent`, `pipeline_tick` scheduled-publish sweep
- `packages/pipeline/src/eisenbalm_pipeline/api/findings.py` — partial read, Phase 33 pipeline-lane endpoint pattern to model new sign-off endpoints on
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_publish.py` — full read, `_flip_sanity_published` (mirror target for the D-07 revert helper)
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` — read `_PIPELINE_SECRET_GUARDED_PATHS` + `convex_mutation` injection logic in full
- `convex/schema.ts` — read `pipelineRuns`, `runs`, `audit_log`, `claim_checks`, `review_actions` table definitions in full (templates for `sign_offs`)
- `convex/auditLog.ts`, `convex/qaCorrections.ts`, `convex/reviewActions.ts`, `convex/lib/auth.ts` (partial) — full/partial reads confirming mutation-guard and audit conventions
- `convex/deliberationEvents.ts`, `convex/notificationActions.ts`, `convex/pipelineConfig.ts` — confirmed the frozen `eventType` union and the `auto-publish-enabled` alert precedent in full
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` — full read, rail composition + live Convex subscription pattern
- `apps/dispatch-control/lib/pipelineControlClient.ts`, `apps/dispatch-control/lib/reviewClient.ts` — full reads, client-fetch conventions to mirror for the new sign-off client
- `apps/studio/sanity.config.ts` — full read, confirmed vanilla (no existing `document.actions`)
- `apps/studio/package.json` — confirmed `sanity@^5.24.0`
- `docs/API_CONTRACTS.md` §5 (webhook payload/config), §26 (review gate), §31 (content-patch), §32 (span resolver), §33 (accept-fix) — read in full for pattern precedent
- `packages/pipeline/tests/test_review_endpoints.py`, `packages/pipeline/tests/api/test_webhook_sanity.py` — read for test-pattern precedent (monkeypatch conventions, fixtures)
- `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-CONTEXT.md` — locked decisions D-01..D-12
- `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` §Phase 34, `.planning/STATE.md`, `.planning/PROJECT.md` — requirement/roadmap/state context

### Secondary (MEDIUM confidence — verified via web search against official docs)
- [Document actions | Sanity Docs](https://www.sanity.io/docs/studio/document-actions) — `document.actions` resolver overview
- [Document Actions reference | Sanity Docs](https://www.sanity.io/docs/studio/document-actions-api) — action value enum (`publish`, `delete`, `duplicate`, `unpublish`, `discardChanges`, `restore`)
- [Controlling document actions for a specific document · sanity-io/sanity Discussion #3341](https://github.com/sanity-io/sanity/discussions/3341) — community-confirmed filter-by-`schemaType` pattern, consistent with official docs

### Tertiary (LOW confidence)
None — every claim in this document is either a direct code read or a docs-verified library API; no unverified training-data-only claims are asserted as fact.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, every pattern read from working code
- Architecture: HIGH — every integration point (gate stack, webhook payload, revocation call-sites, secret-guard wiring) confirmed by direct file reads, not inference
- Pitfalls: HIGH — Pitfalls 1, 2, 4, 5 are drawn from exact code mechanics already present; Pitfall 3 is a judgment call flagged honestly as an open question, not asserted as a hard fact

**Research date:** 2026-07-08
**Valid until:** 30 days (stable internal codebase; the one external dependency — Sanity Studio's `document.actions` API — has been stable across major versions and is not fast-moving)
