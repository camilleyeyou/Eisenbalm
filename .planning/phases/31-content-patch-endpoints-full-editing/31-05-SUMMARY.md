---
phase: 31-content-patch-endpoints-full-editing
plan: 05
subsystem: ui
tags: [dispatch-control, nextjs, clerk, review-desk, block-editor, asset-upload, source-scan-tripwire]

# Dependency graph
requires:
  - phase: 31-content-patch-endpoints-full-editing
    plan: 04
    provides: "contentPatchClient.ts (typed fetch client for every §31 route + ContentPatchError), the /review-desk + /review-desk/[runId] route shell with SectionChipList + EDITABLE_SECTIONS + a toggleable reused PreviewIframe"
provides:
  - "BlockEditor.tsx — full block-row editor for the 5 long-reads (edit/change-type/add/delete/move-up-down, D-06) with a lossy-formatting banner"
  - "TurnListEditor.tsx — {speaker,text} turn-list editor for the deliberation conversation (D-04)"
  - "StructuredFieldEditor.tsx — HeadlineEditor/ThemeEditor/GameEditor/PdfDataPointsEditor/BonusEditor (EDT-02, D-05, D-08 client-side mirrors)"
  - "AssetUploadSlot.tsx — inline upload with overwrite-confirm + CDN preview (EDT-03, D-11/D-12/D-13)"
  - "SectionEditorPanel.tsx — dispatches by selected section and owns the explicit-save/dirty/beforeunload/409-reload harness (D-07/D-10)"
  - "Awaiting-you inbox 'Awaiting review' items now route to /review-desk/[runId] (CHR-04/D-11 re-point)"
affects: [32-native-galley, 33-accept-fix-decision-rail, 34-two-sign-off-publish-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Presentational block/turn-list editors take (value, onChange) and never touch the network — the parent panel owns dirty-state and the save call"
    - "Asset uploads save immediately, independent of the section's explicit-save harness (AssetUploadSlot owns its own useAuth()+uploadAsset() call)"
    - "Font whitelist is duplicated locally in StructuredFieldEditor.tsx (not cross-imported from apps/web/lib/theme.ts) — matches the established per-module pipelineBaseUrl() duplication precedent from contentPatchClient.ts"
    - "Section dirty-state is computed by JSON.stringify-diffing a per-section slice of a local 'working' state against the last-loaded/saved snapshot, not per-field flags"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/BlockEditor.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/TurnListEditor.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StructuredFieldEditor.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AssetUploadSlot.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx
    - apps/dispatch-control/__tests__/review-desk-editors.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
    - apps/dispatch-control/components/AwaitingYouInbox.tsx
    - apps/dispatch-control/__tests__/AwaitingYouInbox.test.tsx
    - apps/dispatch-control/lib/contentPatchClient.ts

key-decisions:
  - "A single Save click for a long-read section chains patchHeadline -> patchSection (-> patchPdfDataPoints for problemStatement), passing the revisionId returned by each call into the next — the document's Sanity revision changes with every patch, so sequential single-field patches must chain, not reuse the pre-save revisionId"
  - "Re-pointed only the AwaitingYouInbox 'Awaiting review' item's href from /run-monitor/runs/[runId]/review to /review-desk/[runId]; the QA-blocker and claim-sign-off items (same file, same currentDraftRunId) intentionally keep their existing review-page route since those findings live there, not in the editor"
  - "bonusType-branching lives inside BonusEditor (StructuredFieldEditor.tsx), not SectionEditorPanel — SectionEditorPanel only knows 'save the bonus section', BonusEditor knows which fields that means per variant"
  - "The unsaved-changes in-app nav guard (confirm-before-switch) is implemented in page.tsx (where the section-chip onSelect handler lives), not inside SectionEditorPanel; SectionEditorPanel owns the beforeunload handler and the dirty map that page.tsx consults"

patterns-established:
  - "PATCH-chaining: any Save action touching multiple document sub-paths must thread the returned revisionId from each patch call into the next, never reuse a stale revisionId across sequential calls"

requirements-completed: [EDT-01, EDT-02, EDT-03]

# Metrics
duration: 37min
completed: 2026-07-07
---

# Phase 31 Plan 05: Editor Components and Wiring Summary

**Five section editors (BlockEditor, TurnListEditor, StructuredFieldEditor's Headline/Theme/Game/PdfDataPoints/Bonus sub-editors, AssetUploadSlot) wired into a SectionEditorPanel dispatcher that owns explicit-save + dirty-state + unsaved-nav + 409-revision-reload, completing the operator-facing editing surface for every prose, structured, and asset field in an issue.**

## Performance

- **Duration:** ~37 min
- **Started:** 2026-07-07T10:35:00Z (approx)
- **Completed:** 2026-07-07T11:12:03Z
- **Tasks:** 3 completed
- **Files:** 6 created, 4 modified

## Accomplishments

- `BlockEditor.tsx` supports all 5 D-06 block ops (edit text, change type via a paragraph/h2/h3/blockquote select, add, delete, reorder via up/down buttons — no drag library) and renders a visible "rich formatting that the block editor can't fully represent" banner when a section's `lossy` flag is set.
- `TurnListEditor.tsx` edits the deliberation `{speaker,text}` conversation with the same add/delete/reorder op set.
- `StructuredFieldEditor.tsx` exports `HeadlineEditor`, `ThemeEditor` (hex-with-swatch inputs + 9-font-whitelist `<select>` dropdowns for `fontDisplay`/`fontBody` + a visual-direction textarea), `GameEditor` (embed-code textarea with a live byte-count that turns red past the 50000-byte server cap), `PdfDataPointsEditor` (exactly 3 fixed `{stat,source}` rows, no add/remove, mirroring the Sanity `Rule.length(3)` schema), and `BonusEditor` (branches on `bonusType`: specAd renders `BlockEditor`; bigBudget renders one `AssetUploadSlot` per storyboard frame plus an empty "add" slot; jingle renders lyrics + Suno-prompt textareas and a `suno-audio` `AssetUploadSlot`).
- `AssetUploadSlot.tsx` uploads immediately on file select (or, if a slot already has an asset, first shows an inline "Replace the existing asset?" confirm panel — D-12), then renders a native `<audio>` player or `<img>` thumbnail from the returned CDN url (D-13).
- `SectionEditorPanel.tsx` dispatches to the right editor(s) per `selectedSection`, maintains a local working copy diffed against the last-saved snapshot to compute per-section dirty state, exposes one explicit Save button per section (disabled when clean) that chains the correct `contentPatchClient` patch call(s) with the live `ifRevisionID`, shows a reload-and-reapply prompt on a `revision_mismatch` 409, surfaces structural-floor `warnings`, and installs a `beforeunload` guard.
- `review-desk/[runId]/page.tsx` now mounts `SectionEditorPanel` in the right pane and guards the section-chip `onSelect` with a confirm prompt when the current section is dirty; the dirty map feeds `SectionChipList`'s unsaved-dot.
- The Awaiting-you inbox's "Awaiting review" item now routes to `/review-desk/[runId]` (CHR-04/D-11); the QA-blocker and claim-sign-off items above it are unchanged.

## Task Commits

Each task was committed atomically:

1. **Task 1: BlockEditor (D-06 full block ops) + TurnListEditor** - `2d5f911` (feat)
2. **Task 2: StructuredFieldEditor + AssetUploadSlot** - `cc68d7c` (feat)
3. **Task 3: SectionEditorPanel dispatch + save/dirty/unsaved-nav/409 harness + inbox re-point + tests** - `a0c68cc` (feat)

## Files Created/Modified

- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/BlockEditor.tsx` - new: long-read block-row editor (D-06)
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/TurnListEditor.tsx` - new: deliberation turn-list editor
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/StructuredFieldEditor.tsx` - new: Headline/Theme/Game/PdfDataPoints/Bonus editors
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AssetUploadSlot.tsx` - new: inline upload + overwrite-confirm + preview
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx` - new: section dispatch + save/dirty/409 harness
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` - modified: mounts SectionEditorPanel, guards chip nav when dirty
- `apps/dispatch-control/components/AwaitingYouInbox.tsx` - modified: "Awaiting review" item now routes to /review-desk/[runId]
- `apps/dispatch-control/__tests__/AwaitingYouInbox.test.tsx` - modified: href assertion updated for the re-point
- `apps/dispatch-control/__tests__/review-desk-editors.test.tsx` - new: BlockEditor/TurnListEditor op tests + SectionEditorPanel dirty-state and 409 tests
- `apps/dispatch-control/lib/contentPatchClient.ts` - modified: fixed `PdfDataPointsPatchPayload.keyDataPoints` type + `DraftResponse`'s stray `deliberation` field (see Deviations)

## Decisions Made

See `key-decisions` in frontmatter — PATCH-chaining across multi-field section saves, the inbox re-point scope (only the "Awaiting review" item), bonusType-branching ownership, and the split of the unsaved-nav guard (beforeunload in the panel, in-app confirm in the page).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `PdfDataPointsPatchPayload.keyDataPoints` type mismatch**
- **Found during:** Task 2
- **Issue:** Plan 04's `contentPatchClient.ts` typed `keyDataPoints?: string[]`, but the Sanity schema (and this plan's own RESEARCH.md Field Inventory) requires exactly 3 `{stat, source}` objects. The wrong type would have made `PdfDataPointsEditor` either not compile against the real payload shape or silently send malformed data.
- **Fix:** Added a `KeyDataPoint { stat: string; source: string }` interface and retyped the field `keyDataPoints?: KeyDataPoint[]`.
- **Files modified:** `apps/dispatch-control/lib/contentPatchClient.ts`
- **Commit:** `cc68d7c`

**2. [Rule 1 - Bug] Fixed `DraftResponse`'s stray `deliberation` field**
- **Found during:** Task 2 (read of `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`'s `get_issue_draft()` while implementing the TurnListEditor wiring)
- **Issue:** Plan 04's `DraftResponse` type declared `deliberation: Record<string, any>`, but the real pipeline `get_issue_draft()` (Plan 31-02, already merged) returns the turn list under a top-level `conversation` key — matching this plan's own `<interfaces>` contract note (`getDraft(...) -> {..., conversation}`), not `deliberation`. The old field name was unused anywhere else in the codebase and would have silently returned no data for the TurnListEditor.
- **Fix:** Renamed the field to `conversation: DeliberationTurn[]`.
- **Files modified:** `apps/dispatch-control/lib/contentPatchClient.ts`
- **Commit:** `cc68d7c`

---

**Total deviations:** 2 auto-fixed (both Rule 1 — type-correctness bugs in Plan 04's committed client that would have broken this plan's own wiring). No scope creep — both fixes are minimal, additive-safe, and directly required for the editors this plan builds to function against the real contract.

## Known Stubs / Follow-ups

Two known upstream gaps in `get_issue_draft()` (Plan 31-02/31-03, pipeline-side, out of scope for this frontend-only plan) mean two fields start blank on load rather than pre-filled, even though their Save paths are fully wired and functional:

- **`problemStatement.pdfContent` (PDF data points) is not yet returned by `GET /issues/{run_id}/draft`.** `get_issue_draft()`'s GROQ projection currently only pulls `headline`/`body` for the 4 long-reads, not `pdfContent`. `PdfDataPointsEditor` renders 3 blank rows on first load; typing into them and clicking Save calls `patchPdfDataPoints` correctly, but there is no way to see existing PDF data-point values in the console until a future plan extends the read projection. Tracked for Plan 31 follow-up or Phase 32/33.
- **`bonus.body` (specAd bonus) is not run through `pt_to_blocks()` server-side.** `get_issue_draft()` decomposes the 4 long-reads' Portable Text bodies into `{type,text}` rows, but not `bonus.body`. `BonusEditor`'s specAd branch defensively coerces `draft.bonus.body` to `[]` unless it already happens to match the `{type,text}` shape (it won't, from the raw backend today), so the block editor starts empty for a specAd bonus on first load. Save still works correctly once content is typed in.

Neither gap blocks this plan's goal (every field is save-able through the documented contract); both are pre-fill/read-path completeness gaps in a still-in-flight backend plan (31-02/31-03) that this frontend plan does not own.

## Issues Encountered

- `noUncheckedIndexedAccess` (repo-wide `tsconfig.base.json` strict flag) required non-null assertions at every `Record<string, T>[key]` read in `BlockEditor.tsx`/`TurnListEditor.tsx` (array-destructuring `.splice()` results) and `SectionEditorPanel.tsx` (long-read section lookups) — caught immediately by `pnpm --filter dispatch-control build`'s type-check step and fixed before the final build pass.
- `@testing-library/jest-dom` matchers (e.g. `toBeDisabled`) are not globally registered in this app's vitest setup — switched the one assertion that needed it to a plain `hasAttribute('disabled')` check rather than adding a new global setup file out of scope for this plan.

## User Setup Required

None — no external service configuration required. Manual verification against a real Sanity dataset (editing a section + confirming the audit row, uploading a podcast audio + confirming inline playback) is deferred to the phase's `<verification>` manual step, same as noted in the plan.

## Next Phase Readiness

- Every editable surface from the Field Inventory (5 long-reads + PDF data points + theme + game + bonus variants + deliberation conversation + podcast transcript/audio) now has a working editor and save path against `contentPatchClient.ts`.
- Phase 32 (native galley) and Phase 33 (accept-fix wiring) can build on `SectionEditorPanel`'s dirty/save/reload harness pattern directly.
- The two upstream read-path gaps documented above (PDF data points prefill, bonus.body prefill) should be closed in a small follow-up to `get_issue_draft()` before Andrew's first real weekly edit session, so existing content is visible on load rather than appearing blank.

---
*Phase: 31-content-patch-endpoints-full-editing*
*Completed: 2026-07-07*

## Self-Check: PASSED

All 6 created files confirmed present on disk; all 3 task commit hashes
(2d5f911, cc68d7c, a0c68cc) confirmed in git log.
