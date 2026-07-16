---
phase: 45-agent-revision
verified: 2026-07-15T23:15:00Z
status: human_needed
score: 5/5 automated must-haves verified
human_verification:
  - test: "Draft/Voice → select the founder-bio phrase → Ask agent to revise → pick a direction chip"
    expected: "Toolbar shows all six actions with Compare/Restore visibly disabled-with-title; direction chips appear (never a bare Regenerate); a comparison card returns BEFORE anything applies, showing original (struck through), proposed, 'What changed', and the claim delta (added/removed/altered)"
    why_human: "End-to-end browser flow spanning real DOM text selection, a live LLM revision call, and visual rendering — not reproducible in a single headless harness"
  - test: "Apply the proposed revision to the founder phrase"
    expected: "The draft updates with the applied text; on the Voice stage, the Voice Pass sign-off returns to 'Review needed' (revoked, not surviving as in the old prototype bug)"
    why_human: "Requires a live Clerk session, a real run at Draft/Voice review, and cross-stage Convex subscription observation"
  - test: "Observe the header cost-vs-budget readout before and after the revision call"
    expected: "The readout increments (never blank/$0) reflecting the real LLM call cost"
    why_human: "Requires a live revision call against a real run_id with durable agentRuns rows, observed in a running browser session"
  - test: "Open 'Inspect how this was made' for a drafted section, click the InspectorFooter 'Ask agent to revise' button"
    expected: "Button is LIVE (not reserved/greyed), opens the same RevisionFlow scoped to a real passage; picking a chip returns a comparison card, not a 'span not resolved' error"
    why_human: "Requires a live browser session against a real drafted section to confirm the derived quotedText resolves against current Sanity content"
  - test: "Exhaust the per-issue revision cost cap and attempt another revision"
    expected: "Chips render disabled-with-explanation (409 cost guard) rather than a silent failure"
    why_human: "Requires driving real cumulative cost past a live run's per_run_cap_usd, only observable in a live session"
---

# Phase 45: Agent Revision Verification Report

**Phase Goal:** "Ask agent to revise" becomes an editing verb available everywhere a passage is selected, with direction chips and an explicit claim-delta comparison before anything applies, bounded by a per-issue cost guard.
**Verified:** 2026-07-15T23:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Selecting a passage in Draft offers Edit text, Ask agent to revise, Compare with previous, Restore previous, Related facts & sources, Inspect how this was made (Compare/Restore disabled-with-title, not hidden) | ✓ VERIFIED | `components/galley/PassageToolbar.tsx:168-204` renders all six buttons unconditionally; Compare (line 191) and Restore (line 194) are `disabled title={COMPARE_TITLE/RESTORE_TITLE}`, never omitted from the DOM. Wired into both `ReviewDeskRunView.tsx` (Draft) and `VoicePassRunView.tsx` (Voice) via the shared `Galley.tsx` (`onEditText`/`onRevise`/`onRelatedFacts`/`onInspect` all bound to real handlers, `onEditSection` is a required Galley prop). `__tests__/PassageToolbar.test.tsx` asserts all six render in order and Compare/Restore are reserved-with-title. |
| 2 | "Ask agent to revise" presents the 7 direction chips, never a bare "Regenerate" | ✓ VERIFIED | `components/revision/DirectionChips.tsx:29-37` renders exactly the 7 locked chips (make_clearer/make_more_specific/tighten/match_brief/reduce_repetition/try_another_approach/custom) with the exact REV-02 display copy; no "Regenerate" string anywhere in the component. `__tests__/DirectionChips.test.tsx` explicitly asserts 7 chips and absence of "Regenerate". Backend `api/revision.py`'s `DirectionChip` Literal type matches identically. |
| 3 | A revision request returns a comparison card with original, proposed, what-changed, and explicit claim delta BEFORE anything applies | ✓ VERIFIED | `POST /issues/{run_id}/revise/preview` (`api/revision.py:186-266`) is read-only — no Sanity write, no Convex content mutation, no audit row (confirmed by reading the function body: only a cost-guard check, an LLM call, and a cost-recording mutation). Returns `{proposedText, whatChanged, claimDelta}`. `components/revision/RevisionComparisonCard.tsx` renders original (strikethrough), proposed, "What changed" line, and a `ClaimDeltaBlock` (added/removed/altered, with an explicit "No claims added, removed, or altered" fallback). `test_revision_endpoints.py::test_preview_no_mutation_no_audit` asserts zero mutation/audit calls during preview. |
| 4 | Operator can Apply, Edit before applying, Try another approach, or Discard; Apply mutates the draft through the existing content-patch write boundary and logs to audit_log | ✓ VERIFIED | `RevisionComparisonCard.tsx:132-155` renders all four actions. `RevisionFlow.tsx` wires Apply/Edit-before-applying to the SAME `applyRevision` call (D-11: edited text replaces `proposedText`, delta not recomputed); Try-another accumulates `priorProposals` (D-05); Discard resets to chip view without losing prior-proposal history. Server-side, `POST /issues/{run_id}/revise/apply` (`api/revision.py:270-338`) calls `_patch_prose_span` (the shared D-01 core also used by `factcheck.py::_patch_claim_prose`), then `_revoke_active_signoffs`, then `_emit_audit(... action="passage_revised" ...)` exactly once — confirmed by reading `control.py::_emit_audit`, which writes via the `auditLog:record` Convex mutation into the `audit_log` table. `test_revision_endpoints.py::test_apply_patches_and_resets_and_audits_once` asserts exactly one audit call. |
| 5 | Revision calls are bounded by a per-issue cost guard, visible against the header's cost-vs-budget readout | ✓ VERIFIED | `lib/budget.py::would_exceed_run_cap` sums durable `agentRuns:byRunId` Convex rows (never `lib/cost.py`'s in-memory `_store`) and is called BEFORE the LLM call in `revise/preview`, returning 409 `cost_cap_exceeded` when exceeded. Revision cost is recorded under the real `run_id` with a fresh `agentKey=f"revision-{uuid.uuid4().hex[:12]}"` (distinct from any existing pipeline agentKey and from factcheck's `evidence-preview-{run_id}` pseudo-id pattern). Console: `app/(dashboard)/issues/[issueNumber]/layout.tsx`'s `FrameChrome`/`CostBudgetReadout` renders `data-testid="cost-vs-budget"`, showing "cost unknown — refresh" when `runCostUsd === undefined` (never `$0`) and `$spent / $cap` otherwise; `WorkspaceStateProvider.tsx` sources this from real `useQuery(api.agentRuns.byRunId)`/`useQuery(api.pipelineConfig.getAll)` subscriptions via `deriveRunCostUsd`/`deriveRunCapUsd` (`lib/derivedState.ts`). |

**Score:** 5/5 truths verified (automated evidence). The single live-session demo leg spanning all 5 truths together in one browser walkthrough remains manual (see Human Verification below).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/pipeline/src/eisenbalm_pipeline/api/revision.py` | preview (read-only, cost-guard 409) + apply (patch/audit) endpoints | ✓ VERIFIED | Both endpoints present, read carefully line-by-line; matches docs/API_CONTRACTS.md §45 exactly. Mounted via `app.include_router(revision.router)` in `api/main.py:212`. |
| `content.py::_patch_prose_span` | single shared apply core | ✓ VERIFIED | `content.py:274-351`; span-resolve → patch → reset-touched-claims-first, returns new revisionId. |
| `factcheck.py::_patch_claim_prose` | thin wrapper of the shared core (D-01) | ✓ VERIFIED | `factcheck.py:138-176` unpacks the claim dict and delegates to `_patch_prose_span` — no duplicate logic. |
| `budget.py::would_exceed_run_cap` | sums durable Convex `agentRuns` | ✓ VERIFIED | `budget.py:106-149`; queries `agentRuns:byRunId`, never touches `lib/cost.py`'s in-memory store. |
| `components/revision/DirectionChips.tsx` | 7 fixed chips | ✓ VERIFIED | Matches §45.1 identifiers/copy exactly. |
| `components/revision/RevisionComparisonCard.tsx` | original/proposed/what-changed/claim-delta + 4 actions | ✓ VERIFIED | All elements present, `data-testid="revision-comparison-card"`. |
| `components/revision/RevisionFlow.tsx` | chips→preview→card→apply orchestration | ✓ VERIFIED | State machine covers try-another (priorProposals accumulation), edit-before-applying, cost-cap handling, revision_mismatch handling. |
| `lib/revisionClient.ts` | pipeline-only client, no Sanity import | ✓ VERIFIED | `grep "@sanity/client"` → no match; calls `NEXT_PUBLIC_PIPELINE_URL` only. |
| `components/galley/PassageToolbar.tsx` | 6 actions, Compare/Restore reserved | ✓ VERIFIED | All six rendered; Compare/Restore disabled+titled. |
| `lib/firstProseExcerpt.ts` | real, non-empty quotedText for InspectorFooter entry | ✓ VERIFIED | Returns a verbatim contiguous excerpt of real prose, or `''` only when genuinely no prose exists (never seeded as quotedText per `InspectorPanel.tsx:509-512`). |
| `components/inspector/InspectorFooter.tsx` | "Ask agent to revise" flipped LIVE | ✓ VERIFIED | `ASK_TO_REVISE_TITLE` constant removed; `onAskToRevise` conditionally makes the button LIVE (`onClick`) vs RESERVED (`disabledTitle`). |
| `issues/[issueNumber]/layout.tsx` FrameChrome cost-vs-budget readout | never-blank, `data-testid="cost-vs-budget"` | ✓ VERIFIED | Confirmed both branches (loading refresh-affordance vs `$x.xx / $y.yy`). |
| `docs/API_CONTRACTS.md` §45 | locks 7 chip ids + preview/apply contract | ✓ VERIFIED | §45.1–§45.6 present, matches implementation verbatim. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `PassageToolbar` (Draft/Voice) | `RevisionFlow` | `onRevise` → `requestRevision` (via `useInspector()` context) → `RevisionFlow` mount | ✓ WIRED | Both `ReviewDeskRunView.tsx:519` and `VoicePassRunView.tsx:297` bind `onRevise={requestRevision}`, and both mount `<RevisionFlow .../>` (lines 581, 323 respectively). |
| `RevisionFlow` | pipeline `revise/preview`+`revise/apply` | `lib/revisionClient.ts` fetch calls | ✓ WIRED | `previewRevision`/`applyRevision` call `NEXT_PUBLIC_PIPELINE_URL` + `/issues/{runId}/revise/{preview,apply}`. |
| `revise/apply` | Sanity content patch | `content.py::_patch_prose_span` → `patch_issue_field` | ✓ WIRED | Confirmed by reading the call chain; `_patch_prose_span` invokes `do_patch_field` (defaults to `patch_issue_field`). |
| `revise/apply` | `audit_log` | `control.py::_emit_audit` → Convex `auditLog:record` mutation | ✓ WIRED | Exactly one call per apply, confirmed by code read + `test_apply_patches_and_resets_and_audits_once`. |
| `revise/preview` cost guard | `agentRuns:byRunId` (Convex) | `budget.py::would_exceed_run_cap` → `_cc.convex_query` | ✓ WIRED | Reads durable rows, sums `costUsd`, compares against `per_run_cap_usd`. |
| `FrameChrome` cost readout | `agentRuns:byRunId`/`pipelineConfig:getAll` | `WorkspaceStateProvider.tsx` `useQuery` | ✓ WIRED | Real Convex subscriptions, `deriveRunCostUsd`/`deriveRunCapUsd` pure derivations, both Convex query functions confirmed to already exist and unchanged (no `convex/` diff since Phase 45's first commit `4e4156e`). |
| `InspectorFooter` "Ask agent to revise" | `RevisionFlow` | `InspectorPanel.tsx` derives `quotedText` via `firstProseExcerpt`, passes `onAskToRevise` | ✓ WIRED | Confirmed conditional wiring — only live when `sectionName && quotedText && onRequestRevision` are all present. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `CostBudgetReadout` (`layout.tsx`) | `runCostUsd`/`capUsd` | `WorkspaceStateProvider` → `useQuery(api.agentRuns.byRunId)` / `useQuery(api.pipelineConfig.getAll)` → `deriveRunCostUsd`/`deriveRunCapUsd` | Yes — sums real `costUsd` from durable Convex rows; `undefined` while loading is preserved (never coerced to 0) | ✓ FLOWING |
| `RevisionComparisonCard` claim delta | `preview.claimDelta` | `revise/preview` LLM response (`_RevisionPick` Pydantic model), passed through unmodified | Yes — comes from the structured LLM output for THIS revision call, not a static default | ✓ FLOWING |
| `DirectionChips` cost-capped state | `costCapped`/`capInfo` | `RevisionFlow`'s `RevisionError` catch on `cost_cap_exceeded`, sourced from `would_exceed_run_cap`'s real spend computation | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Wave-0 revision/budget pytest suite | `python -m pytest -q tests/test_revision_endpoints.py tests/test_budget.py` | 10 passed | ✓ PASS |
| Full pipeline pytest suite | `python -m pytest -q --ignore=tests/lib/test_vercel_client.py` | 585 passed, 36 skipped, 0 failed | ✓ PASS |
| Full console vitest suite | `npm run test` (apps/dispatch-control) | 103 files / 884 passed, 2 todo, 0 failed | ✓ PASS |
| EDT-05 no-Sanity-write tripwire | `npx vitest run __tests__/dispatch-control-no-sanity-write.test.ts` | 2 passed | ✓ PASS |
| Phase-45 console component tests (targeted) | `npx vitest run __tests__/PassageToolbar.test.tsx __tests__/DirectionChips.test.tsx __tests__/RevisionComparisonCard.test.tsx __tests__/FrameChromeCostReadout.test.tsx` | 22 passed | ✓ PASS |
| Strict Next.js build | `npm run build` (apps/dispatch-control) | 31 routes, zero type errors | ✓ PASS |
| No forked second revision endpoint (D-01) | `grep -rl "revise/preview\|revise/apply" packages/pipeline/src/` | Only `api/revision.py` | ✓ PASS |
| Convex functions unchanged this phase | `git diff --stat 4e4156e -- convex/` | Zero changes | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| REV-01 | 45-01, 45-05 | Selecting a passage offers 6 actions | ✓ SATISFIED | PassageToolbar.tsx, InspectorFooter.tsx, both entry surfaces wired |
| REV-02 | 45-01, 45-03, 45-04 | 7 direction chips, never bare "Regenerate" | ✓ SATISFIED | DirectionChips.tsx + `api/revision.py` DirectionChip Literal |
| REV-03 | 45-01, 45-03, 45-04 | Comparison card with claim delta before apply | ✓ SATISFIED | RevisionComparisonCard.tsx + `revise/preview` read-only endpoint |
| REV-04 | 45-01, 45-02, 45-03, 45-04, 45-05 | Apply/Edit/Try-another/Discard, mutates via shared patch boundary, audits | ✓ SATISFIED | `_patch_prose_span` (D-01 shared core) + `_emit_audit` |
| REV-05 | 45-01, 45-02, 45-03, 45-06 | Per-issue cost guard, visible against cost-vs-budget readout | ✓ SATISFIED | `would_exceed_run_cap` + FrameChrome readout |

No orphaned requirements: REQUIREMENTS.md maps only REV-01..REV-05 to Phase 45 (lines 832-836), and all five appear in the `requirements:` frontmatter across plans 45-01 through 45-06. All five REV checkboxes are already marked `[x]` in REQUIREMENTS.md (lines 387-391). Note: the separate requirements-status *table* (lines 832-836) still shows "Planned" for REV-01..REV-05 — this appears to be a pre-existing staleness in that specific table (Phase 44's INS-01..INS-06 rows show the identical "Planned" staleness despite Phase 44 being a previously-completed phase per git history), not a Phase-45-specific gap; the authoritative checkbox list above is current.

### Anti-Patterns Found

None. Scanned all Phase 45 key files (`api/revision.py`, `lib/budget.py`, `DirectionChips.tsx`, `RevisionComparisonCard.tsx`, `RevisionFlow.tsx`, `PassageToolbar.tsx`, `revisionClient.ts`, `firstProseExcerpt.ts`) for TODO/FIXME/placeholder/stub patterns — the one `placeholder=` match in `DirectionChips.tsx` is a legitimate HTML `<textarea>` placeholder attribute, not a stub marker.

### Human Verification Required

The 8-step live-session Annotations demo leg is legitimately deferred (persisted in `.planning/phases/45-agent-revision/45-UAT.md`, `status: partial`, all items `result: pending`) — it requires a real Clerk session, a run parked at Draft/Voice review, real DOM text selection, and a live LLM call, none of which is reproducible headlessly. Every piece it depends on (PassageToolbar, DirectionChips, RevisionComparisonCard, RevisionFlow, FrameChromeCostReadout, blockIndexFromKey, `test_revision_endpoints.py`, `test_budget.py`) is independently verified above via code reading + passing automated tests. See the 5 human-verification items in this report's frontmatter — they mirror 45-UAT.md's 8 items, collapsed to the 5 that map onto this phase's 5 observable truths (items 4/7/8 in 45-UAT.md are variations/optional extensions of items already covered).

### Gaps Summary

No gaps. All 5 observable truths, all required artifacts (pipeline + console), all key links, and the full automated test/build suite are verified against the actual codebase — not merely against SUMMARY claims. Every file read line-by-line confirms the described behavior: `_patch_prose_span` is genuinely the single shared apply core (D-01), `would_exceed_run_cap` genuinely sums durable Convex rows (not the in-memory `_store`), the revision `agentKey` is genuinely fresh and distinct, the cost-vs-budget readout is genuinely never-blank and sourced from real Convex subscriptions, and the PassageToolbar/InspectorFooter genuinely offer all six actions with Compare/Restore visibly (not silently) reserved. The full pipeline pytest suite (585/0 failed), full console vitest suite (884/0 failed), and strict Next build were independently re-run during this verification and matched the SUMMARY's claimed tallies exactly.

The only remaining item is the single load-bearing cross-surface browser walkthrough (select → revise → apply → sign-off revocation → cost increment), which is manual-only by nature and was correctly deferred rather than fabricated as "passed." Recommend running `/gsd:audit-uat 45` or a live operator session before treating the milestone as fully closed.

---

*Verified: 2026-07-15T23:15:00Z*
*Verifier: Claude (gsd-verifier)*
