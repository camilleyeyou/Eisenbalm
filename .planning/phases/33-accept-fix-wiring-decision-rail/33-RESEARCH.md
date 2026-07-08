# Phase 33: Accept-Fix Wiring + Decision Rail - Research

**Researched:** 2026-07-07
**Domain:** Full-stack wiring — FastAPI findings endpoints + Python span resolution + Convex resolution state + React decision rail (no new technology)
**Confidence:** HIGH (all findings verified by direct reads of the live codebase; zero reliance on external docs)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Finding lifecycle & dismiss
- **D-01:** **Resolution modeled as a status enum** on Convex `qaCorrections`: new optional fields `resolution: 'accepted' | 'dismissed'` (absent = open), `resolutionReason` (required for dismiss), `resolvedBy`, `resolvedAt`. The legacy `accepted: boolean` stays and is kept in sync (accept → `accepted: true`) for back-compat with Phase 26 surfaces.
- **D-02:** **Accept/dismiss writes go through new pipeline endpoints** (e.g. `POST /issues/{run_id}/findings/{finding_id}/accept|dismiss` — exact shapes at Claude's discretion, contract-first). The endpoint orchestrates: the Sanity content-patch (accept only), the Convex finding-state flip, and the audit row — following the Phase 26/31 pattern (Clerk-JWT guard, `_emit_audit`, 409 detail shapes). Zero direct Sanity writes from the dashboard is preserved; the Convex resolution flip also flows through the pipeline API, not a dashboard-side Convex mutation.
- **D-03:** **Dismissed findings are hidden** from galley spans and chip counts, exactly like Phase 32 D-08 accepted findings. History stays in the audit log and the Phase 26 review page. The galley remains a pure to-do surface.
- **D-04:** **Reopen action, no text revert.** A resolved finding (accepted or dismissed) can be reopened — logged like everything else — which returns it to open state and galley visibility. Reopen does NOT reverse the text change from an accept; Andrew re-edits via the section editor if needed.

#### Accept-fix mechanics
- **D-05:** **Span replace, server-resolved.** The accept endpoint re-resolves `quotedSpan` (+ `blockIndexHint`) server-side against the current draft and replaces exactly that span with `suggestedFix` inside its block, applied through the Phase 31 scoped-patch machinery. If server-side resolution fails or is ambiguous → 409 with a reason; the popover tells Andrew to use Edit inline instead. Never apply a guessed anchor (mirrors Phase 32 D-12).
- **D-06:** **Revision guard on accept**, same as Phase 31 D-10 saves: the accept request carries the Sanity revision the galley rendered from; mismatch → 409, galley refetches + re-resolves, Andrew re-clicks on the fresh view. No compounding on top of unseen edits.
- **D-07:** **Accept is gated:** hidden/disabled when `suggestedFix` is absent OR the finding is unresolved/orphaned (nothing to anchor the replacement to). Those findings offer Edit inline + Dismiss only, and the popover states why Accept is unavailable.
- **D-08:** **Edit inline = open the Phase 31 section editor** (the Phase 32 D-01 edit affordance) for that section, scrolled/focused to the finding's block, with the finding's reason visible for reference. No second editing surface. Saving there triggers re-resolution naturally (D-09).

#### Post-edit re-resolution & orphans
- **D-09:** **One bucket, one card.** "Orphaned" (anchor invalidated by an edit) and "unresolved" (never anchored) are the same state — the stateless Phase 32 resolver (D-13: fresh re-resolution on every draft/finding change via Convex reactivity) can't distinguish them and shouldn't try. Both render in Phase 32's section-end unresolved card with honest copy ("couldn't locate this text in the current draft"). EDT-06's re-resolution requirement is satisfied by the existing resolver recomputing after every patch; this phase's work is the review surface + actions, not a new resolution mechanism.
- **D-10:** **Section card + rail rollup.** The section-end card stays the in-context home; the decision rail also lists unresolved findings (error-severity ones among the blockers) with jump links. The rail answers "is anything unaccounted for"; the card gives full context.
- **D-11:** **Orphan/unresolved actions: Dismiss + Edit inline** from the section-end card (e.g. dismiss reason "fixed by my edit"). No Accept (consistent with D-07). No manual re-anchor UI this phase.
- **D-11b:** **Error-severity findings block Publish regardless of anchor state.** An error finding blocks until explicitly accepted or dismissed — losing its anchor must never silently un-block Publish.

#### Decision rail composition
- **D-12:** **Hook card slot renders the selected charity from pitchLog** (name + `scoutSummary` — the closest existing thing to "the hook") since `hookClaim`/`hookVerified` don't exist until Phase 37. Phase 37 upgrades the card in place. Rail layout matches the design now, with no fake data.
- **D-13:** **Verification summary gets a real timestamp:** add `checkedAt: v.optional(v.number())` to Convex `claim_checks`, stamped when a claim flips to checked/skipped. Rail shows claims progress ("X/Y claims checked") + open QA finding counts + "last checked Nm ago". Optional field means legacy rows degrade to an honest "not yet checked" — the affirmative-state rule ("never blank") holds either way.
- **D-14:** **Publish gated client + server now.** The rail disables Publish with a reason ("1 blocker to clear"); AND the existing Phase 26 publish endpoint (`POST /issues/{run_id}/publish`) gains a 409 when open error-severity findings exist for the run. Phase 34 layers the two-sign-off pair on top of this check. UI-only blocking would be cosmetic.
- **D-15:** **All four rail actions ship, wired to existing backends:** Publish → Phase 26 publish endpoint (now gated per D-14); Hold → Phase 26 reject/hold flow; Re-run section ▾ → existing `rerun_agent` endpoint; Transcript → link/jump to the deliberation conversation. Wiring, not new capability.
- **D-16:** **Editor memo** sources from the `editor-final` deliberationEvents row (payload carries `editor_final_notes`).
- **D-17:** Rail headline follows the design: blocker/warning count summary line, Blocking-items checklist first, then memo, hook card, verification block, actions — per `docs/design/dispatch-control-v2/README.md` §Review Desk (336px, bg `#f1f0ea`).

### Claude's Discretion
- Exact endpoint shapes/granularity for accept/dismiss/reopen (contract-first: amend `docs/API_CONTRACTS.md` before code — CLAUDE.md hard rule).
- Whether reopen is its own endpoint or a state-transition parameter on one findings endpoint.
- Server-side span resolution implementation (port of the TS resolver's normalization rules to Python vs a simpler exact+normalized match — must honor D-05's never-guess rule).
- Popover action-row layout/affordances inside `AnnotationMark.tsx` (the Phase 32 placeholder), dismiss-reason input UX, optimistic-UI vs refetch-after-write.
- Rail blocking-item checklist micro-UX, estimated-minutes heuristic in the headline (design shows "~4 min" — fine to approximate or omit if noisy).
- How the rail's "warnings" count treats info-severity findings.
- Where the `checkedAt` stamp is written (Convex mutation used by the Phase 26 ClaimsChecklist).

### Deferred Ideas (OUT OF SCOPE)
- **Two-sign-off publish gate ("Facts cleared" + "Sounds human") + webhook re-validation + Studio bypass retirement** — Phase 34, layering on D-14's server check.
- **hookClaim/hookVerified data model + gate badges** — Phase 37 Signal Desk; D-12's pitchLog card upgrades in place.
- **Sourced/unsourced claims in the rail (source index, jump links)** — Phase 35.
- **Manual re-anchor UI for orphaned findings** (select text in galley to re-attach) — considered, not chosen (D-11); revisit only if dismiss-as-addressed proves lossy in real weekly use.
- **Distinct orphaned-vs-unresolved states with resolution history** — considered, not chosen (D-09); would require persisting resolver state.
- **Full undo with text revert from audit snapshots** — considered, not chosen (D-04); snapshots are truncated and interleaved edits make reverts unsafe.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GLY-03 | Clicking an annotation opens a popover showing axis, severity, reason, and suggested fix, with Accept fix / Edit inline / Dismiss actions | `AnnotationMark.tsx` already renders the read-only popover with an explicit Phase 33 placeholder comment (line 102); action row mounts there. HTML-nesting constraint documented (Pitfall 5). Findings client pattern from `contentPatchClient.ts` documented below |
| GLY-04 | Decision rail is blockers-first: unresolved error-severity findings gate Publish; rail shows editor memo, hook card, verification summary with affirmative states | All four data sources verified: `qaCorrections.byRunId` (filter resolution absent), `deliberationEvents.byRunIdAndType('editor-final')` payload = `{approved, notes}`, `pitchLog` selected row, `claimChecks.listByRunId` + new `checkedAt`. Rail actions map to existing `reviewClient.publishIssue/rejectIssue` + `pipelineControlClient.rerollAgent`. Server gate lands in `review.py::publish_issue` after the claims gate |
| EDT-04 | Accept-fix applies suggested text via content-patch and logs it; Dismiss requires one-line reason; every mutation audit-logged | Accept endpoint flow fully specified: `_resolve_sanity_id` → Python span resolution → `patch_issue_field(f"{section}.body", compose_section_body(...), ifRevisionID)` → Convex resolution flip → `_emit_audit(before=quotedSpan, after=suggestedFix)`. Dismiss = Convex flip + audit only. `_emit_audit` before/after extension already exists |
| EDT-06 | After any content patch, annotation anchors re-resolve; invalidated annotations surface as orphaned for operator review | The stateless resolver already recomputes at render (Phase 32 mechanism); the gap is that the DRAFT is a one-shot fetch, not reactive — page must refetch draft after accept/edit (Pitfall 1). `UnresolvedFindingCard` gains Dismiss + Edit inline actions (D-11) |
</phase_requirements>

## Summary

Phase 33 is pure wiring on an existing, well-shaped stack — **no new dependencies, no new services**. Every building block was verified in the codebase: the Phase 32 popover has a marked action-row slot; the Phase 31 patch machinery (`get_issue_draft` → `{type,text}[]` blocks → `compose_section_body` → `patch_issue_field` with `ifRevisionID`) is exactly the pipeline the accept endpoint composes; the Phase 26 endpoint skeleton (`review.py`) shows the guard/audit/409 shape to clone; and all four decision-rail data sources exist as Convex queries today (one small indexed query worth adding for the selected pitch).

The riskiest technical piece is the **Python port of the span resolver**. Good news: the server operates on the *same* `{type, text}[]` block rows the TS resolver does (`get_issue_draft` returns them via `pt_to_blocks`), so the port is a direct 1:1 translation of `spanResolver.ts`'s three stages (exact → curly-quote-normalized → whitespace-tolerant regex) with the same never-guess disambiguation. The length-preserving quote normalization means match offsets index the original text directly — the replacement is `text[:start] + suggestedFix + text[end:]` on the original string. Parity unit tests against the TS test fixtures are the correctness net.

The subtlest correctness trap is **draft staleness**: the Review Desk fetches the draft exactly once (`getDraft` on mount) while findings stream reactively from Convex. After an accept mutates Sanity, the galley must refetch the draft or re-resolution runs against stale text and every finding in the patched section appears falsely orphaned. A `reloadDraft()` callback threaded from `page.tsx` down to the popover is the minimal fix. Second trap: the CONTEXT's D-16 wording says the editor-final payload carries `editor_final_notes` — the actual payload key is **`notes`** (`{"approved": true, "notes": "..."}` per `agents/editor.py::_editor_final_payload`).

**Primary recommendation:** Amend `docs/API_CONTRACTS.md` §33 first (hard rule), then build in three seams: (1) pipeline — Python resolver module + `api/findings.py` (accept/dismiss/reopen) + publish-gate 409 in `review.py`; (2) Convex — additive `qaCorrections` resolution fields + secret-guarded `setResolution` mutation + `claim_checks.checkedAt`; (3) dashboard — popover action row + findings client + decision rail + draft-refetch plumbing.

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement:** all file changes flow through GSD commands (`/gsd:execute-phase` for this work).
- **Contract-first (hard rule):** `docs/API_CONTRACTS.md` must be amended BEFORE code for: findings accept/dismiss/reopen endpoints, the publish endpoint's new 409 condition, `qaCorrections` resolution fields, `claim_checks.checkedAt`, and any new Convex function signatures. Do not modify schema field names without checking API_CONTRACTS.md.
- **Stack locked:** Next.js/Vercel · Sanity v3 · FastAPI/Railway · Convex · Clerk — no substitutions; this phase introduces no new packages.
- **Write boundary (EDT-05, source-scan enforced):** dashboard never writes to Sanity directly, and per D-02 the Convex *resolution flip* also flows through the pipeline API. Dashboard→Convex *reads* (useQuery) are the established pattern and stay.
- **"Nothing silent":** every mutation gets an audit row with actor + content evidence (`_emit_audit` with before/after).
- **Voice/naming conventions:** camelCase fields, kebab-case enum literals, `*At` timestamp suffix (`resolvedAt`, `checkedAt` follow this).
- **Convex note:** `convex/CLAUDE.md` says to read `convex/_generated/ai/guidelines.md` before Convex work — **that file does not exist in the repo** (verified). Follow the established patterns in `convex/*.ts` (e.g. `claimChecks.ts`, `lib/auth.ts`) instead.
- **Memory rule (frontend gate):** vitest does not type-check — run `pnpm --filter dispatch-control typecheck && pnpm --filter dispatch-control build` before declaring any frontend plan done (Phase 27 shipped 2 latent bugs that only failed on Vercel/Linux).

## Standard Stack

### Core (all already installed — zero new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI + pydantic | installed (pipeline) | findings endpoints, publish gate | Phase 26/31 endpoint pattern cloned verbatim |
| httpx AsyncClient | installed (pipeline) | Convex HTTP API + Sanity mutate API | `lib/convex_client.py` / `lib/sanity_client.py` shared clients on `app.state` |
| Convex (`convex/react`, `convex-test` 0.0.53) | installed | resolution fields, `setResolution` mutation, rail queries | All rail data already lives in Convex tables with the needed indexes |
| Next.js 15 / React (dispatch-control) | installed | popover action row, decision rail, findings client | Existing Review Desk page + component conventions |
| `@portabletext/react` | installed | galley annotation marks (unchanged) | Phase 32 synthetic-PT adapter feeds `AnnotationMark` |
| Clerk (`@clerk/nextjs`, PyJWT server-side) | installed | auth on new endpoints | `_require_clerk_jwt_control` dependency reused |
| vitest 3.2 + @testing-library/react + convex-test | installed | dashboard tests | `vitest.config.ts` environmentMatchGlobs: `.test.tsx` → jsdom, convex-test files → edge-runtime |
| pytest (+anyio) via uv | installed | pipeline tests | `test_content_patch_endpoints.py` is the exact template |

**Installation:** none. **Version verification:** skipped intentionally — no new packages are recommended; all libraries are pinned in the existing lockfiles.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Python port of full 3-stage resolver | Simpler exact+quote-normalized only (skip whitespace-tolerant) | Fewer LOC but accepts fail on findings the galley successfully rendered (galley resolves stage B matches → popover shows Accept → server 409s). Full port keeps client/server resolution agreeing — recommended |
| New `api/findings.py` router | Adding routes to `review.py` | Separate module mirrors the content.py/review.py split; keeps review.py focused on run-level decisions. New file recommended |
| Draft refetch after accept | Making draft reactive via Convex | Draft lives in Sanity, not Convex — reactivity would require mirroring content. Refetch callback is the honest minimal fix |

## Architecture Patterns

### Recommended File Layout (new/changed)
```
docs/API_CONTRACTS.md                          # §33.x amended FIRST
packages/pipeline/src/eisenbalm_pipeline/
├── lib/span_resolver.py                       # NEW — Python port of spanResolver.ts
├── api/findings.py                            # NEW — accept / dismiss / reopen endpoints
├── api/review.py                              # publish_issue gains open-error-findings 409 (D-14)
├── api/main.py (or wherever routers register) # include findings router
└── lib/convex_client.py                       # add "qaCorrections:setResolution" to _PIPELINE_SECRET_GUARDED_PATHS
convex/
├── schema.ts                                  # qaCorrections +4 optional fields; claim_checks +checkedAt
├── qaCorrections.ts                           # NEW setResolution mutation (requirePipelineSecret), optional byId query
├── claimChecks.ts                             # setStatus stamps checkedAt; pitchLog.ts optional selectedByRunId query
apps/dispatch-control/
├── lib/findingsClient.ts                      # NEW — mirrors contentPatchClient.ts
├── app/(dashboard)/review-desk/[runId]/page.tsx           # 3rd column (rail), reloadDraft(), edit-inline deep link
├── .../_components/AnnotationMark.tsx         # action row in the marked placeholder
├── .../_components/UnresolvedFindingCard.tsx  # Dismiss + Edit inline actions (D-11)
├── .../_components/DecisionRail.tsx           # NEW — blockers-first rail (336px, #f1f0ea)
└── .../_components/Galley.tsx                 # dismissed filter + action callbacks threaded down
```

### Pattern 1: Accept endpoint composition (D-05/D-06 — the core flow)
All primitives exist; the endpoint is pure composition. Verified against `content.py::patch_section` (lines 229–274) and `sanity_client.py`:

```python
# packages/pipeline/src/eisenbalm_pipeline/api/findings.py (shape)
@router.post("/issues/{run_id}/findings/{finding_id}/accept")
async def accept_finding(request, run_id, finding_id, body: _AcceptBody,
                         claims: dict = Depends(_require_clerk_jwt_control)) -> dict:
    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(request, run_id, claims)

    # 1. Load the finding (new Convex query qaCorrections:byId, or byRunId + filter _id)
    finding = ...  # 404 if missing / wrong run; 409 already_resolved if resolution set
    if not finding.get("suggestedFix") or not finding.get("quotedSpan"):
        raise HTTPException(409, detail={"reason": "accept_unavailable", ...})   # D-07

    # 2. Map QA sectionName -> draft section key (Python mirror of sectionIdMap.ts)
    #    origin_story->originStory, problem->problemStatement, founder_bio->founderBio,
    #    case_study->caseStudy, bonus->bonus (specAd only). game -> no blocks -> 409.
    draft = await get_issue_draft(sanity_http, sanity_id)
    blocks = draft["sections"][section]["blocks"]        # same {type,text}[] the TS resolver sees

    # 3. Server-side resolution (lib/span_resolver.py — port of spanResolver.ts)
    match = resolve_span(blocks, finding["quotedSpan"], finding.get("blockIndexHint"))
    if match is None:   # no match OR ambiguous — never guess (D-05)
        raise HTTPException(409, detail={"reason": "span_not_resolved",
            "message": "Couldn't locate this text in the current draft. Use Edit inline instead."})

    # 4. Replace span in the ORIGINAL block text (offsets are original-text offsets)
    b = blocks[match.block_index]
    b["text"] = b["text"][:match.start] + finding["suggestedFix"] + b["text"][match.end:]

    # 5. Phase 31 scoped patch — 409 revision_mismatch propagates from patch_issue_field (D-06)
    new_rev = await patch_issue_field(sanity_http, issue_id=sanity_id,
        field_path=f"{section}.body", value=compose_section_body(blocks),
        if_revision_id=body.ifRevisionID)
    # NOTE: bonus (specAd) writes to "bonus.body" — same path family as content.py's patch_bonus.

    # 6. Convex resolution flip (D-01/D-02) — pipeline-lane secret-guarded mutation
    await _cc.convex_mutation(convex_http, "qaCorrections:setResolution", {
        "id": finding_id, "resolution": "accepted",
        "resolvedBy": actor, "resolvedAt": now_ms})   # mutation also sets accepted=True (back-compat)

    # 7. Audit — "nothing silent"
    await _emit_audit(convex_http, actor_id=actor, action="finding.accepted",
        resource_type="finding", resource_id=f"{run_id}:{finding_id}",
        before=_truncate(finding["quotedSpan"]), after=_truncate(finding["suggestedFix"]))

    return {"revisionId": new_rev, "findingId": finding_id, "resolution": "accepted"}
```

**Dismiss** is the same skeleton minus steps 2–5: validate non-empty `reason` (422 otherwise), flip `resolution='dismissed'` + `resolutionReason`, audit `finding.dismissed` with `after=reason`. **Reopen** (D-04): clear resolution fields (Convex `ctx.db.patch(id, {resolution: undefined, ...})` removes optional fields), set `accepted=false`, audit `finding.reopened`. One endpoint per action keeps the 409 vocabularies clean; a single `/resolution` endpoint with a state param is equally valid (discretion) — but three verbs read better in the audit log.

### Pattern 2: Python span-resolver port (mirror `spanResolver.ts` exactly)
The TS resolver (verified, `apps/dispatch-control/lib/galley/spanResolver.ts`) runs three stages per finding, each searched block-by-block (never against joined text):
1. **Exact** `str.find(quoted)` per block.
2. **Quote-normalized:** map `‘’ → '` and `“” → "` on BOTH sides (1:1 char swap — length-preserving, so offsets computed on normalized text index the original text directly), then exact substring.
3. **Whitespace-tolerant:** `re.escape(normalized_quoted)` with `\s+` collapsed to `\s+`, run with `re.finditer` over the quote-normalized block text; `match.start()/match.end()` index the original text (normalization preserved length; the matched run in the TEXT may differ in length from `quotedSpan` — use the match's own end, exactly as the TS Stage B does).

Disambiguation (identical to TS `disambiguate`): 0 matches → next stage; 1 match → winner; 2+ → `blockIndexHint` only wins if it names an actual candidate block; otherwise **ambiguous = unresolved = 409**. TS quirk to preserve or consciously fix: Stage A (`quoteNormalizedMatchesFor`) computes `end = idx + quoted.length` — same as match length since normalization is 1:1. Port tests should mirror `__tests__/spanResolver.test.ts` cases for parity.

### Pattern 3: Publish gate (D-14) — insert after the claims gate in `publish_issue`
`review.py::publish_issue` already has an ordered guard chain (404 → wrong_status → claims_not_signed_off → no_sanity_issue). The new check slots in as guard 3b, using the existing read pattern:

```python
findings = await _cc.convex_query(http, "qaCorrections:byRunId", {"runId": run_id}) or []
open_errors = [f for f in findings
               if f.get("severity") == "error" and not f.get("resolution")]
if open_errors:
    raise HTTPException(409, detail={
        "reason": "open_error_findings",
        "message": f"{len(open_errors)} error finding(s) must be accepted or dismissed before publishing.",
        "count": len(open_errors)})
```
Note this implements D-11b for free: the check is anchor-state-blind — an orphaned error finding still blocks. `reviewClient.ts::publishIssue` already surfaces `{reason, message}` detail; the rail branches on `reason`.

### Pattern 4: Decision rail data sources (all verified)
| Rail element | Source | Shape / gotcha |
|---|---|---|
| Blockers + warnings counts | `useQuery(api.qaCorrections.byRunId)` filtered `!row.resolution` | Blockers = severity `error` (any anchor state, D-11b); warnings = `warning` (info handling = discretion) |
| Unresolved-findings list w/ jump links | same query + the per-section resolver output already computed in `page.tsx::chipCounts` | Jump via existing `galleyAnchorFor(sectionId)` scrollIntoView pattern |
| Editor memo | `useQuery(api.deliberationEvents.byRunIdAndType, {runId, eventType: 'editor-final'})` | `payload` is a JSON **string**: `JSON.parse(payload).notes` — the key is `notes`, NOT `editor_final_notes` (verified `agents/editor.py::_editor_final_payload`) |
| Hook card (D-12) | `pitchLog` — either `byRunId` + client filter `selected === true`, or add `selectedByRunId` query on the existing `by_runId_and_selected` index | Index exists in schema (L116) but **no query uses it today**; adding one is a 6-line public query. Render `charityName` + `scoutSummary` |
| Verification summary (D-13) | `useQuery(api.claimChecks.listByRunId)` | X/Y = `status !== 'pending'` count; "last checked Nm ago" = `max(checkedAt)`; no rows → "No claims extracted yet"; rows w/o `checkedAt` → "not yet checked" (never blank) |
| Actions | `reviewClient.publishIssue` / `rejectIssue` (Hold), `pipelineControlClient.rerollAgent` (`POST /runs/{id}/agents/{key}/rerun`, keys: origin_story/problem/founder_bio/case_study/game/bonus/design), Transcript → scroll to `#galley-deliberation` | All clients exist; only wiring |

`checkedAt` stamp (D-13 discretion answered): write it inside `claimChecks.ts::setStatus` (`ctx.db.patch(row._id, { status, checkedAt: Date.now() })` when status is checked/skipped) — the Phase 26 `ClaimsChecklist.tsx` component then needs **zero changes**, honoring the "run-monitor review page stays byte-functional" constraint.

### Pattern 5: Client wiring — refetch + filters + deep links
- **Draft refetch (EDT-06 critical):** `page.tsx` loads the draft once in a `useEffect`. Extract the loader into a `reloadDraft()` callback and thread it (with `runId` + `draft.revisionId`) down through `Galley` → `GallerySection` → `AnnotationMark`/`UnresolvedFindingCard`. After a successful accept (or a `revision_mismatch` 409), call `reloadDraft()`. Findings themselves update reactively via Convex, so dismiss needs no refetch.
- **Open-findings filter (D-03):** both `Galley.tsx` (L65) and `page.tsx` (L224) currently filter `row.accepted !== true`. Extend to `row.accepted !== true && row.resolution == null` (covers dismissed). The `QaFinding`/`QaCorrectionRow` interfaces gain optional `resolution`.
- **Edit inline (D-08):** the popover/card needs to flip the page into `viewMode='edit'` with `selectedSection` set — today `Galley` receives no such callback. Add `onEditSection(sectionId, findingId?)` prop chain; `SectionEditorPanel` gains an optional scroll/focus-to-block + finding-reason banner (props extension; current props are `runId, selectedSection, draft, onDirtyChange`).
- **Rail layout:** the page is currently `chips (lg:w-64) | main`. The rail mounts as a third column (`lg:w-[336px]`, bg `#f1f0ea`, hard edges per 1c tokens) visible in galley mode.

### Anti-Patterns to Avoid
- **Dashboard-side Convex mutation for resolution flips** — D-02 explicitly routes accept/dismiss/reopen through the pipeline API. (`claimChecks.setStatus` from the dashboard is the *existing* Phase 26 exception and stays.)
- **Copying `qaCorrections:insert`'s public no-auth pattern** for `setResolution` — insert is a deliberate GAM-05 public exception. `setResolution` must call `requirePipelineSecret` and be added to `_PIPELINE_SECRET_GUARDED_PATHS` in `convex_client.py` (the set's docstring demands sync).
- **Resolving against joined section text** — cross-block matches are not real matches (resolver header comment; 32-RESEARCH Pattern 2).
- **UI-only publish blocking** — D-14: server must refuse too.
- **Guessing on ambiguity** — 2+ matches without a validating hint = 409, always.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scoped Sanity patch + revision guard | New mutate call | `sanity_client.patch_issue_field` (+ `_patch_fields` for multi-field) | Already returns fresh `_rev`, raises structured 409 `revision_mismatch` |
| Blocks → Portable Text | Manual block dicts | `portable_text.compose_section_body` | Handles h2/h3/blockquote/paragraph mapping + `_key` generation |
| Draft read | New GROQ | `sanity_client.get_issue_draft` | Already converts PT → `{type,text}[]` via `pt_to_blocks` + lossy flag |
| Endpoint auth | New JWT verify | `Depends(_require_clerk_jwt_control)` | Dev-mode sentinel + JWKS verification, used by every control endpoint |
| Audit rows | Direct Convex insert | `_emit_audit(before=, after=)` | Non-blocking, truncated snapshots via `_truncate`, `auditLog:record` args already include before/after |
| run→sanityIssueId resolution | Re-implementation | `content.py::_resolve_sanity_id` (import or clone per existing precedent) | 404/409 shapes standardized |
| Pipeline→Convex calls | Raw httpx | `_cc.convex_query` / `_cc.convex_mutation` | Central `pipelineSecret` injection for guarded paths |
| Dashboard→pipeline fetch | Ad-hoc fetch | Clone `contentPatchClient.ts` (`pipelineBaseUrl` + typed error + Bearer token) | Each client keeps a private copy by explicit precedent (see its header comment) |
| Section-name mapping (TS side) | New map | `sectionIdMap.ts` (`galleyIdToQaSection`/`qaSectionToGalleyId`) | "The ONLY authority for that mapping" — the Python endpoint needs its own mirror (snake_case QA name → draft key), which should cite it |

**Key insight:** every server primitive the accept endpoint needs already exists and is individually tested; the phase's server work is one new pure module (the resolver port) plus composition.

## Common Pitfalls

### Pitfall 1: Stale draft after accept → false orphans (EDT-06 killer)
**What goes wrong:** The Review Desk fetches the draft exactly once on mount (`page.tsx` useEffect). Findings are Convex-reactive; the draft is not. After an accept patches Sanity, the resolver re-runs against the OLD blocks — the accepted finding vanishes (resolution filter) but every *other* finding in that section may now mis-anchor, and the next accept will 409 on `revision_mismatch` because the client still holds the old `revisionId`.
**How to avoid:** `reloadDraft()` after every successful accept AND on any `revision_mismatch` 409 (the D-06 reload path). The CONTEXT's "no manual refetch orchestration needed" line applies to Convex data only — the draft-read is the documented exception.
**Warning signs:** accepts work once then 409 forever; findings flicker to "unresolved" after an accept.

### Pitfall 2: Editor memo payload key mismatch
**What goes wrong:** D-16 says the payload "carries `editor_final_notes`" — the actual emitted payload (verified `agents/editor.py` L234–238) is `{"approved": true, "notes": "..."}` serialized as a JSON string in `deliberationEvents.payload`. Reading `editor_final_notes` renders an empty memo forever.
**How to avoid:** `JSON.parse(payload).notes`, with a try/catch and an honest empty state ("No editor memo for this run") for legacy/malformed rows.

### Pitfall 3: New Convex mutation not secret-guarded / not in the injection set
**What goes wrong:** Two failure modes. (a) `setResolution` written without `requirePipelineSecret` → anyone can flip findings (it gates Publish — security-relevant). (b) Guarded correctly but the path isn't added to `_PIPELINE_SECRET_GUARDED_PATHS` in `convex_client.py` → the pipeline's own calls omit the secret and every accept/dismiss 500s with 'Unauthorized'.
**How to avoid:** Both edits land in the same plan task; `convexAuthLockdown.test.ts` (edge-runtime, convex-test) is the existing tripwire pattern to extend.

### Pitfall 4: Convex codegen + deployment ordering
**What goes wrong:** New schema fields and functions don't exist in `convex/_generated/api.d.ts` until codegen runs against the dev deployment (`npx convex dev --once` / `npx convex codegen`); dashboard `typecheck`/`build` fail, or worse, tests pass locally with `api as any` casts (the Phase 26 `ClaimsChecklist` workaround) and break in prod. Also note (memory): the *pipeline's* `CONVEX_DEPLOY_KEY` was stale at one point — deploy Convex functions from the repo root/dashboard tooling, and verify the deployed function exists before wiring the pipeline call.
**How to avoid:** Schema+functions plan runs codegen and commits `_generated`; avoid new `api as any` casts.

### Pitfall 5: Invalid HTML nesting inside the popover
**What goes wrong:** `AnnotationMark`'s popover renders INSIDE a `<p>` (via `@portabletext/react` marks). The Phase 32 component deliberately uses only `<span style={{display:'block'}}>` elements. Adding a `<div>`, `<form>`, or `<p>` for the action row/dismiss-reason input produces invalid HTML → React hydration warnings/DOM-corrected trees.
**How to avoid:** Action row = `<span display:block>` + `<button>` + `<input>`/`<textarea>` (all phrasing content). No `<form>` — handle submit on the button. Same constraint applies to any inline "why Accept is unavailable" note (D-07).

### Pitfall 6: Accept succeeded in Sanity, Convex flip failed → split state
**What goes wrong:** Step 5 (Sanity patch) succeeds, step 6 (Convex flip) throws → the text is fixed but the finding stays open and blocks Publish. The house rule "Convex mutations are non-blocking" does NOT apply here — the flip is load-bearing for the gate.
**How to avoid:** Fail loudly (surface a 502/500 with a "text was applied; finding state not updated — retry or dismiss" message). The degraded path is safe-by-direction (over-blocking, never under-blocking): the operator dismisses with reason "fix already applied". Note a retried *accept* will 409 `span_not_resolved` because `quotedSpan` no longer exists — the error copy should say to dismiss, not re-accept.

### Pitfall 7: Bonus/game sections in accept
**What goes wrong:** QA emits findings for `game` and `bonus` too. `game` has no block body (accept must 409/be hidden — nothing to anchor). `bonus` blocks exist only for `specAd` (draft returns `bonus.body` rows; field path is `bonus.body`, not `{section}.body`), and bonus body patches ride the multi-field `_patch_fields`/`compose_section_body` path. `problem` maps to `problemStatement` (the one non-obvious mapping).
**How to avoid:** Python section map mirrors `sectionIdMap.ts` exactly; explicit 409 `accept_unavailable` for game/non-specAd-bonus; test each mapping.

### Pitfall 8: Forgetting the schedule endpoint (gate parity)
**What goes wrong:** D-14 names only `publish`. But Phase 26 put the claims gate on BOTH `publish_issue` and `schedule_issue` — a scheduled publish would bypass the error-findings gate via the tick sweep.
**How to avoid:** Mirror the open-error-findings 409 on `schedule_issue` (recommended; within discretion since D-14's intent is "server must refuse"). Flag in the contract amendment either way.

### Pitfall 9: Rail/galley disagreement on "open"
**What goes wrong:** Three surfaces filter findings (Galley.tsx, page.tsx chipCounts, new rail). If one keeps the old `accepted !== true` predicate while others add `resolution == null`, dismissed findings show in chips but not the galley (or vice-versa).
**How to avoid:** Extract one shared `isOpenFinding(row)` helper (e.g. in `lib/galley/` or the findings client) used by all three; source-scan/unit test it.

## Code Examples

All verified from the repo (paths absolute from project root):

### Endpoint test harness (clone for `test_findings_endpoints.py`)
```python
# packages/pipeline/tests/test_content_patch_endpoints.py L38-46 (verified)
_content_app = FastAPI()
_content_app.include_router(content_router)
_content_app.state.convex_http = MagicMock()
_content_app.state.sanity_http = MagicMock()
_content_client = TestClient(_content_app, raise_server_exceptions=True)
# monkeypatch targets: _cc.convex_query / _cc.convex_mutation,
# eisenbalm_pipeline.api.findings.get_issue_draft / patch_issue_field
```

### Convex resolution mutation (pattern from claimChecks.ts + lib/auth.ts)
```typescript
// convex/qaCorrections.ts addition — pipeline lane (D-02)
export const setResolution = mutation({
  args: {
    id: v.id('qaCorrections'),
    resolution: v.optional(v.union(v.literal('accepted'), v.literal('dismissed'))), // absent = reopen
    resolutionReason: v.optional(v.string()),
    resolvedBy: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    pipelineSecret: v.optional(v.string()),
  },
  handler: async (ctx, { pipelineSecret, id, ...fields }) => {
    requirePipelineSecret(pipelineSecret)          // NOT the public insert pattern
    // reopen: patch with undefined values removes optional fields in Convex
    await ctx.db.patch(id, {
      ...fields,
      accepted: fields.resolution === 'accepted',  // D-01 legacy sync
    })
  },
})
```
(Exact arg shape at planner's discretion — reopen-as-absent vs a separate mutation; keep `accepted` in sync either way.)

### Schema additions (additive — matches existing conventions)
```typescript
// convex/schema.ts qaCorrections (~L96, before timestamp)
resolution: v.optional(v.union(v.literal('accepted'), v.literal('dismissed'))), // Phase 33 D-01: absent = open
resolutionReason: v.optional(v.string()),   // required-for-dismiss enforced at the endpoint, not schema
resolvedBy: v.optional(v.string()),
resolvedAt: v.optional(v.number()),
// claim_checks (~L403)
checkedAt: v.optional(v.number()),          // Phase 33 D-13: stamped by setStatus on checked/skipped
```

### Findings client (mirror contentPatchClient.ts exactly)
```typescript
// apps/dispatch-control/lib/findingsClient.ts — private pipelineBaseUrl() copy (precedent),
// ContentPatchError-style typed error with {status, reason, message}
export async function acceptFinding(runId: string, findingId: string,
  payload: { ifRevisionID: string }, token: string | null): Promise<{revisionId: string}> { ... }
export async function dismissFinding(runId: string, findingId: string,
  payload: { reason: string }, token: string | null): Promise<{findingId: string}> { ... }
```

### Rail "checked Nm ago" (D-13, never blank)
```typescript
const claims = useQuery(api.claimChecks.listByRunId, { runId })  // undefined while loading
const done = claims?.filter(c => c.status !== 'pending') ?? []
const lastChecked = Math.max(0, ...done.map(c => c.checkedAt ?? 0))
// render: claims === undefined → "Loading…" ; total 0 → "No claims extracted yet"
// lastChecked > 0 → `checked ${relative(lastChecked)} ago` ; else → "not yet checked"
```

## State of the Art (repo-local)

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `accepted: boolean` as the only finding state | `resolution` enum + legacy `accepted` kept in sync | Phase 33 (D-01) | Filters become `resolution == null`; Phase 26 surfaces keep working |
| Publish gated on claims sign-off only | + open-error-findings 409 | Phase 33 (D-14) | Phase 34 stacks two sign-offs on the same guard chain |
| Popover read-only (Phase 32 D-10) | Popover with Accept/Edit/Dismiss action row | Phase 33 | The placeholder comment at `AnnotationMark.tsx` L102 marks the mount point |
| Preview iframe as review fallback | Native galley default since Phase 32; iframe kept for soak | Phase 32 D-01/D-02 | Rail mounts beside the galley, not the iframe |

**Deprecated/outdated:** `convex/_generated/ai/guidelines.md` referenced by `convex/CLAUDE.md` does not exist — treat repo `convex/*.ts` patterns as authoritative.

## Open Questions

1. **Does the open-error-findings gate also apply to `schedule_issue`?**
   - What we know: D-14 names only publish; Phase 26 applied the claims gate to both publish AND schedule; scheduled runs publish via the tick sweep without re-checking.
   - Recommendation: yes, mirror it on schedule (Pitfall 8); document in §33 contract. Low cost, closes a bypass.
2. **Where does the reopen affordance live?**
   - What we know: D-04 requires the capability + logging; the galley hides resolved findings (D-03); history lives in the audit log and Phase 26 review page.
   - Recommendation: ship the endpoint + a minimal "Resolved" collapsed list (rail or Phase 26 review page) with a Reopen button. Endpoint-only with no UI would make D-04 untestable by an operator.
3. **How to fetch a single finding by `_id` from the pipeline?**
   - What we know: only `qaCorrections:byRunId` exists; Convex `v.id('qaCorrections')` accepts the string id the popover already holds.
   - Recommendation: add a tiny public `byId` query (reads are public per existing convention), or filter the `byRunId` result server-side — either is fine; `byId` is cleaner and validates the id type.
4. **Info-severity findings in the rail's warnings count (discretion item):** recommend counting only `warning` as "warnings" and folding `info` into a muted tertiary count or omitting — Out-of-Scope table allows bulk-dismiss of info noise later; don't inflate the headline.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | dashboard build/tests | ✓ | v24.13.0 | — |
| pnpm | workspace scripts | ✓ | 9.15.4 | — |
| uv (Python) | pipeline tests | ✓ | 0.11.7 (Python 3.11.11 in venv) | — |
| Convex dev deployment | codegen for new schema/functions | ✓ (modest-magpie-797 per project memory) | — | `npx convex codegen` offline for types; deploy needed before runtime wiring |
| Pipeline env (Clerk/Sanity/Convex keys) | live endpoint testing | dev-mode sentinel covers local (`CLERK_JWT_ISSUER_DOMAIN` unset → `local-dev-operator`) | — | pytest monkeypatch harness needs no env |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none blocking — note the project-memory caveat that the *pipeline's* `CONVEX_DEPLOY_KEY` was stale (401 on seeding); if new Convex functions are deployed via the pipeline path, verify first.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Frameworks | pytest (+anyio, via uv) — pipeline; vitest 3.2 (+@testing-library/react, convex-test 0.0.53) — dashboard/Convex |
| Config files | `packages/pipeline/pyproject.toml`; `apps/dispatch-control/vitest.config.ts` (environmentMatchGlobs: `*.test.tsx` → jsdom, listed convex-test files → edge-runtime) |
| Quick run command | `cd packages/pipeline && uv run pytest tests/test_findings_endpoints.py -x -q` · `pnpm --filter dispatch-control test:unit __tests__/AnnotationMark.test.tsx` |
| Full suite command | `cd packages/pipeline && uv run pytest -x -q` · `pnpm --filter dispatch-control test:unit && pnpm --filter dispatch-control typecheck && pnpm --filter dispatch-control build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GLY-03 | Popover renders action row; Accept gated on suggestedFix/anchor (D-07); Dismiss requires reason | component (jsdom) | `pnpm --filter dispatch-control test:unit __tests__/AnnotationMark.test.tsx` | ❌ Wave 0 |
| GLY-04 | Rail blockers-first ordering; Publish disabled w/ reason; memo/hook/verification render incl. "never blank" states | component (jsdom) | `pnpm --filter dispatch-control test:unit __tests__/DecisionRail.test.tsx` | ❌ Wave 0 |
| GLY-04 (server) | `publish_issue` 409 `open_error_findings` on unresolved error findings (incl. orphaned, D-11b); passes when all resolved | unit (pytest) | `uv run pytest tests/test_review_endpoints.py -x -q` (extend existing file) | ✅ extend |
| EDT-04 | Accept: resolves span, patches `{section}.body`, flips resolution, emits audit before/after; 409s: span_not_resolved, revision_mismatch, accept_unavailable, already_resolved. Dismiss: empty reason 422; flip + audit | unit (pytest, TestClient harness) | `uv run pytest tests/test_findings_endpoints.py -x -q` | ❌ Wave 0 |
| EDT-04 (resolver) | Python resolver parity with spanResolver.ts (exact / curly-quotes / whitespace / ambiguity / hint rules) | unit (pytest) | `uv run pytest tests/test_span_resolver.py -x -q` | ❌ Wave 0 |
| EDT-04 (Convex) | `setResolution` enforces pipelineSecret; syncs legacy `accepted`; reopen clears fields; `checkedAt` stamped by setStatus | convex-test (edge-runtime) | `pnpm --filter dispatch-control test:unit __tests__/qaCorrectionsResolution.test.ts` (register in environmentMatchGlobs) | ❌ Wave 0 |
| EDT-06 | Dismissed/resolved findings excluded from galley + chips (shared `isOpenFinding`); unresolved card exposes Dismiss + Edit inline; refetch-after-accept path invoked | component (jsdom) — extend `Galley.test.tsx`, `UnresolvedFindingCard.test.tsx` | `pnpm --filter dispatch-control test:unit __tests__/Galley.test.tsx __tests__/UnresolvedFindingCard.test.tsx` | ✅ extend |
| all | No new direct Sanity write path from dashboard | source-scan (existing tripwire) | `pnpm --filter dispatch-control test:unit __tests__/dispatch-control-no-sanity-write.test.ts` | ✅ exists |
| manual | Live end-to-end: accept on a real awaiting-review run mutates the draft + galley re-resolves + rail count drops | manual-only (needs deployed Convex + Sanity + a real run) | — documented in phase UAT | — |

### Sampling Rate
- **Per task commit:** the quick run command for the touched surface (pipeline OR dashboard file-scoped vitest).
- **Per wave merge:** both full suites (`uv run pytest -x -q` ≥ current baseline; `pnpm --filter dispatch-control test:unit`) + `typecheck` + `build` (memory rule — vitest does not type-check).
- **Phase gate:** full suites green + `pnpm --filter dispatch-control build` exit 0 before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `packages/pipeline/tests/test_findings_endpoints.py` — EDT-04 endpoint matrix (clone `test_content_patch_endpoints.py` harness)
- [ ] `packages/pipeline/tests/test_span_resolver.py` — resolver parity suite (mirror `__tests__/spanResolver.test.ts` cases)
- [ ] `apps/dispatch-control/__tests__/AnnotationMark.test.tsx` — GLY-03 (jsdom via existing glob)
- [ ] `apps/dispatch-control/__tests__/DecisionRail.test.tsx` — GLY-04
- [ ] `apps/dispatch-control/__tests__/findingsClient.test.ts` — client error branching (`span_not_resolved` vs `revision_mismatch`)
- [ ] `apps/dispatch-control/__tests__/qaCorrectionsResolution.test.ts` — convex-test; MUST be added to `vitest.config.ts` environmentMatchGlobs (edge-runtime)
- [ ] Framework install: none — all frameworks present

## Sources

### Primary (HIGH confidence — direct codebase reads, 2026-07-07)
- `apps/dispatch-control/lib/galley/spanResolver.ts` — full resolver algorithm + normalization rules
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx`, `_components/{Galley,AnnotationMark,UnresolvedFindingCard,GallerySection}.tsx`, `lib/galley/{sectionIdMap,syntheticPortableText}.ts` — client integration points, filters, one-shot draft fetch
- `apps/dispatch-control/lib/{contentPatchClient,reviewClient,pipelineControlClient}.ts` — client patterns + existing action wiring
- `packages/pipeline/src/eisenbalm_pipeline/api/{content.py,review.py,control.py}` — patch machinery, publish guard chain, `_emit_audit`, `_require_clerk_jwt_control`, `rerun_agent` route
- `packages/pipeline/src/eisenbalm_pipeline/lib/{sanity_client.py,portable_text.py,convex_client.py}` — `get_issue_draft`/`patch_issue_field`/`compose_section_body`/`pt_to_blocks`, `_PIPELINE_SECRET_GUARDED_PATHS`
- `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` L234–238 — editor-final payload = `{approved, notes}`
- `convex/{schema.ts,qaCorrections.ts,claimChecks.ts,pitchLog.ts,deliberationEvents.ts,auditLog.ts,lib/auth.ts}` — tables, indexes, existing mutations/queries, auth lanes
- `docs/API_CONTRACTS.md` section index (§26, §31, §32 conventions; §33 lands after §32) · `docs/design/dispatch-control-v2/README.md` §1 Review Desk (rail spec, tokens)
- `packages/pipeline/tests/{test_content_patch_endpoints.py,test_review_endpoints.py}`, `apps/dispatch-control/{vitest.config.ts,__tests__/}` — test harness patterns
- Toolchain probes: node v24.13.0, pnpm 9.15.4, uv 0.11.7 / Python 3.11.11

### Secondary (MEDIUM)
- Project memory: strict-build-before-done rule; stale pipeline CONVEX_DEPLOY_KEY caveat; Convex deployment modest-magpie-797

### Tertiary (LOW)
- None — no external web research was needed; the phase is entirely intra-repo wiring.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; everything verified installed and in use
- Architecture: HIGH — every integration point read directly; the two contradictions found (draft not reactive; `notes` vs `editor_final_notes`) are documented with evidence
- Pitfalls: HIGH — each derived from a specific verified code path, not speculation

**Research date:** 2026-07-07
**Valid until:** ~30 days (intra-repo findings; re-verify only if Phases 31/32 files are touched by quick fixes in the interim)
