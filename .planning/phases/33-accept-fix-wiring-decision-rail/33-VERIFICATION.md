---
phase: 33-accept-fix-wiring-decision-rail
verified: 2026-07-08T06:45:00Z
status: human_needed
score: 4/4 must-haves verified
human_verification:
  - test: "Open a run's Review Desk galley, click an error annotation, click Accept fix"
    expected: "Suggested text replaces the quoted span in the live Sanity draft; the annotation disappears; an audit row (finding.accepted, before/after) appears in the audit viewer; blocker count in the rail decrements"
    why_human: "End-to-end path crosses live Sanity + Convex + pipeline deploys (Convex schema deploy and pipeline redeploy are ops steps outside the codebase; memory notes a stale pipeline CONVEX_DEPLOY_KEY)"
  - test: "Dismiss a finding from the popover without typing a reason, then with a reason"
    expected: "Submit is disabled until a non-empty reason is typed; after submit the finding vanishes from galley, chips, and rail, and appears in the rail's collapsed Resolved list with a 'dismissed' badge"
    why_human: "Visual/interaction flow across live Convex reactivity"
  - test: "With one unresolved error finding, attempt Publish from the decision rail"
    expected: "Publish button is disabled with a visible '1 blocker to clear' reason; hitting the endpoint directly returns 409 open_error_findings"
    why_human: "Live server gate + UI state; the layout of the 336px rail beside the galley also needs a visual once-over"
  - test: "Edit a section's text so a finding's quotedSpan no longer exists, save, return to galley"
    expected: "The invalidated annotation surfaces as an orphaned card at the section end (not dropped); its popover shows 'Accept unavailable' and offers Edit inline/Dismiss"
    why_human: "Re-resolution against real edited Portable Text is a visual outcome"
  - test: "Check the rail's verification block on a run with checked claims and on a fresh run"
    expected: "Shows 'X/Y claims checked · checked Nm ago' when checks exist; 'No claims extracted yet' / 'not yet checked' otherwise — never a blank region"
    why_human: "Timestamp phrasing and never-blank states are visual"
---

# Phase 33: Accept-Fix Wiring + Decision Rail — Verification Report

**Phase Goal:** Operator can act on any QA finding directly from the galley — accept the fix, edit inline, or dismiss with a reason — with every action mutating the real draft and logged, and the decision rail makes unresolved blockers impossible to miss.
**Verified:** 2026-07-08
**Status:** human_needed (all automated checks pass; live end-to-end items listed above)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP success criteria)

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Clicking an annotation opens a popover showing axis, severity, reason, suggested fix, with Accept fix / Edit inline / Dismiss actions | ✓ VERIFIED | `AnnotationMark.tsx` L172-240 renders `value.severity`, `value.axis`, `value.reason`, `Suggested: {value.suggestedFix}`, then the phrasing-content-only action row (Accept gated on `suggestedFix`, Edit inline → `onEditSection`, Dismiss with reason input). 8 jsdom tests pass incl. D-07 gating |
| 2 | Accepting a fix applies the suggested text via the Phase 31 content-patch endpoint and logs to audit; dismissing requires a one-line reason, also logged — nothing silent | ✓ VERIFIED | `api/findings.py` (334 lines): accept flow = `qaCorrections:byId` → `resolve_span` → `patch_issue_field(..., if_revision_id)` → `qaCorrections:setResolution` → `_emit_audit(action="finding.accepted", before=quotedSpan, after=suggestedFix)`; dismiss 422s on empty reason and audits `finding.dismissed` with the reason; reopen audits `finding.reopened`. All 409 branches (already_resolved, accept_unavailable, span_not_resolved, revision_mismatch, not_resolved) covered by `test_findings_endpoints.py` — 42 pipeline tests pass |
| 3 | After any content patch, anchors are re-resolved against updated content; invalidated annotations surface as orphaned, not dropped | ✓ VERIFIED | `page.tsx` L212 extracts `reloadDraft` (useCallback) and threads it → Galley → GallerySection → AnnotationMark; accept success AND revision_mismatch 409 both call `reloadDraft()` (AnnotationMark L139/143); Phase 32 `spanResolver.ts` re-runs on the fresh draft; unresolved findings render as `UnresolvedFindingCard`s ("nothing is ever silently dropped" — GallerySection); Python `span_resolver.py` (167 lines) mirrors the TS three-stage resolver with never-guess ambiguity (parity tests pass) |
| 4 | Decision rail shows unresolved error findings first, blocks Publish until resolved, shows editor memo, hook card, and verification summary with affirmative timestamp — never blank | ✓ VERIFIED | `DecisionRail.tsx` (389 lines): blockers-first ordering, Publish `disabled={blockers.length > 0}` with visible reason + server 409 `open_error_findings` surfaced; memo via `deliberationEvents.byRunIdAndType('editor-final')` parsing `.notes` with fallback; hook card via `pitchLog.selectedByRunId`; verification via `claimChecks.listByRunId` + `checkedAt` ("checked Nm ago" / "No claims extracted yet" / "not yet checked" / "Loading…"). 16 DecisionRail tests assert exactly these behaviors, incl. DOM ordering and never-blank ladder |

**Score:** 4/4 truths verified

### Required Artifacts (from plan must_haves)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `docs/API_CONTRACTS.md` §33 | Frozen contract before code | ✓ VERIFIED | `## Phase 33 — Accept-Fix Wiring + Decision Rail` at L2731, between §32 (L2705) and Error handling rules (L2913); all endpoint paths, `setResolution`, `checkedAt`, `open_error_findings`, `span_not_resolved` present |
| `convex/schema.ts` | resolution/resolutionReason/resolvedBy/resolvedAt + checkedAt (additive optional) | ✓ VERIFIED | L97-100 (qaCorrections) exact union shape; L409 (claim_checks) checkedAt |
| `convex/qaCorrections.ts` | secret-guarded `setResolution` + `byId`; public `insert` untouched | ✓ VERIFIED | `byId` L70, `setResolution` L88 with `requirePipelineSecret(pipelineSecret)` L103 and legacy sync `accepted: resolution === 'accepted'` L111; insert's GAM-05 public-exception comments intact |
| `convex/claimChecks.ts` | checkedAt stamp on checked/skipped only | ✓ VERIFIED | L108-109: conditional stamp; `requireOperator(ctx)` untouched |
| `convex/pitchLog.ts` | `selectedByRunId` on `by_runId_and_selected` index | ✓ VERIFIED | L18-23 |
| `convex/_generated/api.d.ts` | codegen captures new functions | ✓ VERIFIED | Uses `ApiFromModules<typeof qaCorrections>` structural codegen — function names are not enumerated by design; types flow via `typeof`. Not a gap |
| `packages/pipeline/.../lib/span_resolver.py` | 1:1 TS resolver port, never-guess | ✓ VERIFIED | 167 lines; `_norm_quotes`, `\s+` stage, ambiguity → None; parity suite passes |
| `packages/pipeline/.../api/findings.py` | accept/dismiss/reopen router | ✓ VERIFIED | 3 `@router.post` routes; `"problem": "problemStatement"` map; registered in `main.py` L202 |
| `packages/pipeline/.../lib/convex_client.py` | setResolution in guarded paths | ✓ VERIFIED | L70 `"qaCorrections:setResolution"` in `_PIPELINE_SECRET_GUARDED_PATHS` |
| `packages/pipeline/tests/test_findings_endpoints.py` | endpoint matrix incl. 409 branches | ✓ VERIFIED | 16KB; contains span_not_resolved (×3) and all 409 reasons; passes |
| `apps/dispatch-control/lib/findingsClient.ts` | 3 client fns + typed FindingsError | ✓ VERIFIED | acceptFinding/dismissFinding/reopenFinding, `FindingsError` with `.reason`; tested |
| `apps/dispatch-control/lib/galley/findingState.ts` | shared `isOpenFinding` | ✓ VERIFIED | `accepted !== true && resolution == null`; used by page.tsx L266, Galley.tsx L81, DecisionRail L108, ResolvedFindingsList L55 — no stray `accepted !== true` predicate remains in Galley (Pitfall 9) |
| `.../DecisionRail.tsx` | blockers-first 336px rail | ✓ VERIFIED | Mounted in page.tsx L432 inside `viewMode === 'galley'` branch with `lg:w-[336px] shrink-0` |
| `.../ResolvedFindingsList.tsx` | collapsed resolved list + Reopen (D-04) | ✓ VERIFIED | `reopenFinding` wired, `not_resolved` 409 handled inline, "No resolved findings yet" never-blank; zero occurrences of revert/reloadDraft/patchSection (D-04 no-revert) |
| Test files (qaCorrectionsResolution, findingsClient, AnnotationMark, UnresolvedFindingCard, DecisionRail, ResolvedFindingsList, Galley) | coverage | ✓ VERIFIED | All exist; qaCorrectionsResolution registered under edge-runtime in vitest.config.ts L38 |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| qaCorrections.ts::setResolution | lib/auth.ts::requirePipelineSecret | handler guard | ✓ WIRED | Called first in handler (L103); convex-test asserts no-secret call throws |
| findings.py | sanity_client.py::patch_issue_field | accept applies scoped patch | ✓ WIRED | L184 `patch_issue_field(...)` with `if_revision_id`; revision_mismatch propagated |
| findings.py | qaCorrections:setResolution | convex_mutation | ✓ WIRED | L198/269/322 (accept/dismiss/reopen); path secret-injected via convex_client L70 |
| review.py::publish_issue + schedule_issue | qaCorrections:byRunId | open-error-findings gate | ✓ WIRED | Gate inside publish_issue (L63→~L134) AND schedule_issue (L191→~L268), anchor-blind predicate `severity == "error" and not resolution`; both tested |
| AnnotationMark.tsx | findingsClient.ts | Accept/Dismiss handlers | ✓ WIRED | acceptFinding L138, dismissFinding L162, FindingsError reason branching (revision_mismatch → reloadDraft; span_not_resolved → "use Edit inline") |
| page.tsx | reloadDraft | refetch after accept / revision_mismatch | ✓ WIRED | useCallback L212, threaded page → Galley → GallerySection → AnnotationMark (EDT-06) |
| DecisionRail.tsx | reviewClient::publishIssue / rejectIssue, pipelineControlClient::rerollAgent | actions row | ✓ WIRED | L159/179/193; Transcript scrolls to `#galley-deliberation` L204 |
| DecisionRail.tsx | deliberationEvents.byRunIdAndType('editor-final') | memo, key `notes` | ✓ WIRED | L117/L127-128 with try/catch fallback (§33.6 key correction) |
| ResolvedFindingsList.tsx | findingsClient::reopenFinding | Reopen button | ✓ WIRED | L68; the only operator surface for resolved findings (D-04 reachability) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| DecisionRail | openFindings/blockers | `useQuery(api.qaCorrections.byRunId)` | Real Convex query (qaCorrections.ts L5) | ✓ FLOWING |
| DecisionRail | memo | `useQuery(api.deliberationEvents.byRunIdAndType)` | Real query (deliberationEvents.ts L17) | ✓ FLOWING |
| DecisionRail | pitch | `useQuery(api.pitchLog.selectedByRunId)` | New real indexed query (pitchLog.ts L18) | ✓ FLOWING |
| DecisionRail | claims/checkedAt | `useQuery(api.claimChecks.listByRunId)` | Real query (claimChecks.ts L120); checkedAt written by setStatus | ✓ FLOWING |
| AnnotationMark accept | draft revision | `revisionId` prop ← page.tsx `draft.revisionId` ← `getDraft()` pipeline fetch | Real draft fetch, refreshed by reloadDraft | ✓ FLOWING |
| ResolvedFindingsList | resolved rows | Same byRunId query, complement of isOpenFinding | Real | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 33 pipeline suites (resolver parity, endpoint matrix, publish/schedule gate) | `uv run pytest tests/test_span_resolver.py tests/test_findings_endpoints.py tests/test_review_endpoints.py -q` | 42 passed | ✓ PASS |
| Full pipeline suite (regression) | `uv run pytest -q` | 435 passed, 33 skipped | ✓ PASS |
| Phase 33 dashboard suites | `pnpm --filter dispatch-control test:unit <7 files> -- --run` | 61 passed (7 files) | ✓ PASS |
| Full dashboard suite incl. no-sanity-write + Phase 31/32 tripwires | `pnpm --filter dispatch-control test:unit -- --run` | 371 passed, 2 todo (44 files) | ✓ PASS |
| Strict production build (memory rule) | `pnpm --filter dispatch-control build` | Compiled successfully | ✓ PASS |
| tsc --noEmit | `pnpm --filter dispatch-control typecheck` | 133 errors, ALL in `__tests__/` (0 in app/lib code) | ⚠ PRE-EXISTING (see below) |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
| ----------- | -------------- | ----------- | ------ | -------- |
| GLY-03 | 33-01, 33-04 | Annotation popover: axis/severity/reason/fix + Accept/Edit/Dismiss | ✓ SATISFIED | Truth 1 |
| GLY-04 | 33-01, 33-02, 33-03, 33-05 | Blockers-first rail; error findings gate Publish; memo/hook/verification affirmative states | ✓ SATISFIED | Truths 4 + server gate (Truth 2/publish gate) |
| EDT-04 | 33-01, 33-02, 33-03, 33-04 | Accept applies fix via content-patch + audit; Dismiss requires reason; nothing silent | ✓ SATISFIED | Truth 2 |
| EDT-06 | 33-01, 33-02, 33-04 | Anchors re-resolved after patch; orphans surfaced not dropped | ✓ SATISFIED | Truth 3 |

No orphaned requirements: REQUIREMENTS.md maps exactly these four IDs to Phase 33 (L666-669) and all four are claimed by plans.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `apps/dispatch-control/__tests__/*` (incl. new qaCorrectionsResolution.test.ts) | various | `tsc --noEmit` fails with 133 errors, all in test files (`import.meta.glob` typing + strict-null in Phase 23-era convex-test harness pattern) | ⚠️ Warning (pre-existing) | tsconfig unchanged since Phase 21; erroring files date from Phase 23 — not a Phase 33 regression. Production build and all 371 tests pass. The new convex-test file deliberately mirrors the established (broken-under-tsc) harness pattern. Worth a cleanup quick-task: exclude `__tests__` from tsc or add vite client types |

No TODO/FIXME/placeholder/stub patterns in any Phase 33 production file (findings.py, span_resolver.py, review.py, findingsClient.ts, findingState.ts, DecisionRail.tsx, ResolvedFindingsList.tsx, AnnotationMark.tsx).

### Human Verification Required

See frontmatter `human_verification` — five items covering the live accept round-trip (Sanity + Convex + audit), dismiss reactivity, the publish gate + rail layout, orphan surfacing after a real edit, and the verification-block timestamp states. Note ops prerequisites before UAT: Convex schema deploy (`convex dev --once`) and a pipeline redeploy so the new findings router + gate are live (memory flags a stale pipeline `CONVEX_DEPLOY_KEY`).

### Gaps Summary

None. Every truth, artifact, and key link verified against the codebase; both full test suites and the strict production build are green. The only flag is pre-existing test-file typecheck debt (warning, not phase scope), plus standard visual/live-integration items routed to human verification.

---

_Verified: 2026-07-08_
_Verifier: Claude (gsd-verifier)_
