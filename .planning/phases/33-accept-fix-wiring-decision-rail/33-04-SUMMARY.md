---
phase: 33-accept-fix-wiring-decision-rail
plan: 04
subsystem: dispatch-control
tags: [react, galley, qa-findings, popover, edit-inline, convex, clerk]
requires:
  - 33-01 (§33.3 frozen contract — endpoint paths, bodies, 409 reasons)
  - 33-02 (qaCorrections.resolution field + setResolution/byId — the reactive drop signal)
  - 33-03 (live accept/dismiss/reopen endpoints + server span resolver)
  - Phase 32 galley (AnnotationMark popover placeholder, GallerySection, span resolver)
  - Phase 31 SectionEditorPanel + contentPatchClient.getDraft
provides:
  - apps/dispatch-control/lib/findingsClient.ts (acceptFinding/dismissFinding/reopenFinding + FindingsError)
  - apps/dispatch-control/lib/galley/findingState.ts (isOpenFinding — the ONE shared open-finding predicate)
  - AnnotationMark Accept/Edit/Dismiss action row (phrasing-content-only popover)
  - UnresolvedFindingCard Dismiss + Edit inline (no Accept, D-11)
  - page.tsx reloadDraft refetch seam (EDT-06) + onEditSection deep-link (D-08)
  - SectionEditorPanel focusFindingId/findingReason banner
affects:
  - 33-05 (decision rail reuses findingsClient + isOpenFinding; reopen affordance lives there)
tech-stack:
  added: []
  patterns:
    - per-client private pipelineBaseUrl() copy (reviewClient/contentPatchClient precedent)
    - FastAPI error unwrap handles BOTH {detail:{reason,message}} envelope and flat {reason,message}
    - per-render @portabletext components object memoized on action context (marks close over runId/revisionId/callbacks)
    - action buttons render only when action-context props are present (read-only fallback preserved)
key-files:
  created:
    - apps/dispatch-control/lib/findingsClient.ts
    - apps/dispatch-control/lib/galley/findingState.ts
    - apps/dispatch-control/__tests__/findingsClient.test.ts
    - apps/dispatch-control/__tests__/AnnotationMark.test.tsx
  modified:
    - apps/dispatch-control/lib/galley/spanResolver.ts
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx
    - apps/dispatch-control/__tests__/Galley.test.tsx
    - apps/dispatch-control/__tests__/UnresolvedFindingCard.test.tsx
decisions:
  - "FindingsError unwraps FastAPI's {detail:{reason,message}} envelope FIRST, then falls back to a flat {reason,message} body — the older clients read only the flat shape, which misses uvicorn's actual envelope"
  - "AnnotationMark reads the Clerk token via useAuth().getToken() directly (per plan preference) instead of threading a getToken prop through Galley/GallerySection"
  - "Action-context props on AnnotationMark/UnresolvedFindingCard are optional — without them the components stay Phase 32 read-only (keeps them portable and the old tests honest)"
  - "editFinding deep-link state clears on chip-select and on leaving edit mode, so the QA banner never lingers on an unrelated section"
  - "Dismiss needs no draft refetch — the finding drops from spans/cards/chips reactively via the Convex qaCorrections subscription through isOpenFinding"
metrics:
  duration: 17min
  completed: 2026-07-08
---

# Phase 33 Plan 04: Popover Actions + Re-resolution Summary

Accept/Edit/Dismiss wired from the galley through a typed findingsClient to the live pipeline endpoints, with accept-triggered draft refetch (EDT-06) and one shared isOpenFinding predicate dropping resolved findings from every surface.

## What was built

**Task 1 — findingsClient + isOpenFinding (TDD).** `lib/findingsClient.ts` mirrors `contentPatchClient.ts` exactly (private `pipelineBaseUrl()`, Bearer token, typed `FindingsError {status, reason, message}`) and POSTs to the three §33.3 endpoints. The error unwrap handles the FastAPI `{detail:{reason,message}}` envelope (what the endpoints actually emit) with a flat-body fallback, so the popover can branch on `revision_mismatch` vs `span_not_resolved` vs `accept_unavailable`. `lib/galley/findingState.ts` exports `isOpenFinding(row)` — `accepted !== true && resolution == null` — and `spanResolver.ts`'s `QaFinding` gained the optional `resolution` field. 11 tests.

**Task 2 — page.tsx plumbing.** The mount-effect draft loader is now a stable `reloadDraft` `useCallback` passed down to `<Galley>`; both the chip-count filter (page.tsx) and the galley filter dropped the stale `accepted !== true` predicate for the shared `isOpenFinding` (Pitfall 9 — dismissed findings vanish from chips and spans simultaneously). `handleEditSection(sectionId, findingId?)` flips into edit mode with the unsaved-edit guard, stores `editFinding`, and `SectionEditorPanel` renders the finding's reason in a marigold banner above the editor (D-08). `revisionId` + callbacks thread page → Galley → GallerySection → marks/cards via a memoized per-render `components` object.

**Task 3 — action surfaces (TDD).** The Phase 32 popover placeholder is now a phrasing-content-only action row (`<span display:block>` + `<button>` + `<input>` — zero `div`/`form`/`p`, verified by grep AND a jsdom structural test): Accept fix renders only when `suggestedFix` exists (D-07, with an inline "Accept unavailable" note otherwise), calls `acceptFinding` with the current `ifRevisionID` then `reloadDraft()`; a `revision_mismatch` 409 also refetches and shows a retry note; `span_not_resolved` points at Edit inline. Dismiss reveals a reason input whose submit stays disabled until non-empty. `UnresolvedFindingCard` gained Dismiss (reason-required) + Edit inline and deliberately NO Accept (D-11 — an orphaned anchor can't be auto-applied). 8 + 4 new tests.

## Verification

- `findingsClient` + `AnnotationMark` + `Galley` + `UnresolvedFindingCard` + `dispatch-control-no-sanity-write` suites: **34/34 green**
- Full dispatch-control vitest: **348 passed / 2 todo** (zero regressions)
- `pnpm --filter dispatch-control build` exits 0 (strict type gate per memory rule)
- Pitfall 5 grep: `grep -c "<div\|<form\|<p>" AnnotationMark.tsx` → 0

## Deviations from Plan

**1. [Scope boundary] Task 2's "`typecheck` exits 0" acceptance criterion is unattainable — pre-existing failures**
- **Found during:** Task 2 verification
- **Issue:** `pnpm --filter dispatch-control typecheck` (`tsc --noEmit`) fails with 133 errors, ALL in pre-existing `__tests__/*.test.ts(x)` files (`ImportMeta.glob` typing, convex-test non-null issues). Verified via `git stash`: identical 133 on the pre-plan baseline; this plan added zero errors and none exist outside `__tests__/`.
- **Action:** Not fixed (CLAUDE.md SCOPE BOUNDARY — pre-existing failures in unrelated files). Logged to `deferred-items.md`. The enforceable strict type gate — `next build`, which type-checks app source — passes.

**2. [Rule 2 - Missing critical wiring] Galley.test.tsx needed a Clerk mock**
- **Found during:** Task 3
- **Issue:** AnnotationMark/UnresolvedFindingCard now call `useAuth()`; Galley.test.tsx renders them transitively and had no `@clerk/nextjs` mock (would throw outside ClerkProvider).
- **Fix:** Added the same `useAuth → getToken` mock used by review-desk-editors.test.tsx. File was in the plan's `files_modified` list.
- **Commit:** 4c1a3f5

No other deviations — plan executed as written.

## Known follow-ups (for 33-05)

- `reopenFinding` is exported and tested but has no UI caller yet — the decision rail (33-05) owns the reopen affordance on resolved findings.
- SectionEditorPanel's finding banner is reason-only; block-level scroll/focus was declared best-effort in the plan (the panel has no block-index knowledge) and the banner satisfies D-08's "reason visible for reference".

## Self-Check: PASSED

- All 4 created files exist on disk (findingsClient.ts, findingState.ts, findingsClient.test.ts, AnnotationMark.test.tsx)
- Commits 7a4c71f, 3f0b7f1, 59f3206, 06a26fb, 4c1a3f5 all present in git log
