---
phase: 51-section-read-and-fix-in-place
plan: 05
subsystem: ui
tags: [react, nextjs, dispatch-control, galley, vitest, patch-client]

# Dependency graph
requires:
  - phase: 51-04
    provides: "app/(editorial)/s/[section]/page.tsx (the reading surface, with the TODO(51-05) onEditSection stub), deriveSectionStates/EDITABLE_SECTIONS, the single-section Galley mount with generateFixOnAccept/showAxisTag/markSourcedClaims wired"
  - phase: 51-01
    provides: "lib/galley/spanResolver.ts's resolveSectionFindings + ResolvedAnnotation.blockIndex, lib/galley/findingState.ts's isOpenFinding, lib/galley/sectionIdMap.ts's qaSectionToGalleyId"
provides:
  - "InPlaceBlockEditor.tsx — the flagged block's controlled-textarea editor: Save edit / Cancel edit, a dirty dot, byte-exact 409 recovery copy, Escape=Cancel/Cmd+Enter=Save, and the patchBonus-vs-patchSection branch (bonus is NOT in patchSection's allow-list)"
  - "lib/galley/findingGroups.ts — groupFindings/groupForFinding, a pure client-side selector grouping findings by axis + byte-identical suggestedFix"
  - "findingGroup prop threaded Galley -> GallerySection -> AnnotationMark (sizeFor/acceptGroup), gating the 'Accept suggestion (applies to N places)' label and the group-accept click path; undefined leaves Review Desk/Voice Pass's single-accept byte-identical"
  - "page.tsx's acceptGroup — the sequential accept loop (each call carries the PREVIOUS call's fresh revisionId, never parallel) and the D-13 partial-failure sentence"
  - "The convex/react useQuery mock wiring in SectionReaderPage.test.tsx that the whole file's finding-dependent specs needed (flagged, not fixed, by 51-04's own SUMMARY)"
affects: [51-06, 51-07, 52]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "A page-level pure helper (qaFindingsForSection) re-derives the SAME QaFinding[] shape Galley builds internally from derivationInputs.qaFindings, so page.tsx can call the SAME exported resolveSectionFindings a second time (for block-index lookup) without writing a second resolution algorithm"
    - "TS does not narrow an outer state variable's null-check into a nested function DECLARATION's body (only into the same-scope statements after the guard) — capture the narrowed value in a local const (currentDraft/currentRunId) once, before defining the nested functions that close over it"
    - "A findingGroup?: { sizeFor, acceptGroup } prop threaded through three components unmodified, gated entirely on the caller passing it — the established Galley optional-prop convention (onInspect, onRevise, onRelatedFacts) extended one more time"

key-files:
  created:
    - "apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx"
    - "apps/dispatch-control/lib/galley/findingGroups.ts"
    - "apps/dispatch-control/__tests__/findingGroups.test.ts"
  modified:
    - "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"
    - "apps/dispatch-control/components/galley/AnnotationMark.tsx"
    - "apps/dispatch-control/components/galley/GallerySection.tsx"
    - "apps/dispatch-control/components/galley/Galley.tsx"
    - "apps/dispatch-control/__tests__/SectionReaderPage.test.tsx"

key-decisions:
  - "Wired __tests__/SectionReaderPage.test.tsx's bare convex/react useQuery mock (vi.fn() with no implementation) to read the same mockCurrentRun.derivationInputs fixture each test already configures, mirroring Galley.test.tsx's own mockImplementation pattern. Without this, Galley's internal useQuery(api.qaCorrections.byRunId)/useQuery(api.claimChecks.listByRunId) subscriptions always resolved to undefined -> [], so openFirstFinding() could never find a mark to click — every one of this plan's 9 owned specs would fail regardless of what the page did. 51-04's own SUMMARY flagged this exact gap as the next plan's prerequisite; classified as a Rule 3 (blocking) test-infrastructure fix."
  - "Rewrote one pre-existing assertion in the same test file (the Cancel-edit spec's 'restores the original text' check) from an exact-string screen.getByText to a container.textContent substring check that excludes the injected D-07 axis tag. The finding that makes 'Edit myself' reachable at all necessarily wraps 'in a garage' in a real <mark>, and the D-07 axis tag ('Fact') renders as its own sibling span immediately after it with no separating space — RTL's getByText only joins an element's OWN direct child text nodes (never nested elements'), so no single node's text ever equals the full original sentence once a real annotation (which this spec's own setup requires) is present. Classified as Rule 1 (bug in the test's own assumption, not a weakening of intent) — the fix asserts the meaningful thing (edited value discarded, untouched portions of the original sentence still present) instead of a structurally-impossible exact match."
  - "openInPlaceEditor resolves the flagged block's index via the SAME resolveSectionFindings Galley uses internally (called a second time from page.tsx, not a second resolution algorithm), falling back to block 0 with a plainly-noted isFallbackBlock flag when no findingId reaches the call (the PassageToolbar 'Edit text' path — Galley's existing onEditText={(sel) => onEditSection(sel.sectionId)} wiring does not forward sel.blockIndex, and this plan's files_modified list does not include changing that wiring) or when a finding's span never resolved onto this section's blocks."
  - "The group-accept 'Applying N places…' busy-state label (plan text's own example was 'Applying {n} of {total}…') uses the group's total size rather than a live per-step counter, since AnnotationMark has no visibility into acceptGroup's loop progress through the locked two-function findingGroup interface (sizeFor/acceptGroup) and the plan does not specify a third progress-callback prop. No test asserts the literal busy-state text; documented here as Claude's Discretion rather than left unexplained."
  - "Rendered InPlaceBlockEditor as an inline block directly below the Galley mount (not literally swapping the one paragraph's DOM node inside Galley's own PortableText render, and not styled as a bordered 'panel' like the existing Ask-agent-to-revise/Related-facts blocks) — Galley/GallerySection's block renderer has no prop for intercepting a single block's render, and the plan's files_modified list scopes Galley.tsx/GallerySection.tsx changes to the findingGroup thread only. This satisfies every locked test (none assert DOM position) while keeping 'in place' as literal as the file scope allows."

requirements-completed: [READ-04, READ-05]

# Metrics
duration: ~35min
completed: 2026-08-01
---

# Phase 51 Plan 05: In-Place Editor, Group Accept Summary

**A controlled-textarea in-place block editor (Save edit/Cancel edit, dirty dot, byte-exact 409 copy, patchBonus-vs-patchSection branch) plus a pure axis+suggestedFix grouping selector wired into a sequential, honestly-partial-failing group-accept action threaded through Galley → GallerySection → AnnotationMark.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-01T07:13:00Z
- **Tasks:** 3
- **Files modified:** 8 (3 created, 5 modified)

## Accomplishments

- `InPlaceBlockEditor.tsx` created: a controlled `<textarea>` (never `contenteditable`) opened on the one flagged block, with explicit `Save edit`/`Cancel edit` buttons, a dirty dot reusing `SectionChipList.tsx`'s existing visual vocabulary, `Escape`=Cancel/`Cmd|Ctrl+Enter`=Save, and the locked byte-exact 409 copy ("This passage changed since you started editing — reload and try again."). Text only — no block-type/add/delete/reorder control anywhere in the file.
- `page.tsx`'s `openInPlaceEditor` replaces plan 51-04's `TODO(51-05)` no-op stub: resolves the flagged block's exact index via `resolveSectionFindings` (the same resolver Galley itself uses, called a second time — never a second algorithm), and saves route to `patchBonus` for the bonus section (which is NOT in `patchSection`'s four-value allow-list, per `docs/API_CONTRACTS.md:2619`) or `patchSection` for the four long-reads.
- `lib/galley/findingGroups.ts` created: `groupFindings`/`groupForFinding`, a pure (no Convex/React/fetch) selector grouping findings that share `axis` + byte-identical `suggestedFix`; a finding with no `suggestedFix` is always its own group. 10 passing unit tests cover every `<behavior>` bullet plus empty-input and trailing-space edge cases.
- An optional `findingGroup?: { sizeFor, acceptGroup }` prop threaded unmodified through `Galley` → `GallerySection` → `AnnotationMark` (added to `GallerySection`'s `useMemo` dependency array). `AnnotationMark`'s Accept button shows `"Accept suggestion (applies to N places)"` when `sizeFor(findingId) >= 2` and routes the click to a new `handleGroupAccept` instead of the existing `handleAccept`; a lone finding or an omitted `findingGroup` (Review Desk, Voice Pass) renders exactly today's single-accept behavior, unchanged.
- `page.tsx`'s `acceptGroup` runs the accept loop **sequentially** — each `acceptFinding` call carries the PREVIOUS call's freshly-returned `revisionId`, never a stale value and never parallel (which would 409 most of the group against the Phase 33 D-06 guard) — and reports partial failure with the exact locked sentence `"{X} of {Y} applied — {Z} still need you."`; failed members stay marked and individually openable, no rollback, no batch-retry control, no server-side batch endpoint.
- Fixed a blocking test-infrastructure gap flagged by 51-04's own SUMMARY: `SectionReaderPage.test.tsx`'s `convex/react` `useQuery` mock was a bare `vi.fn()` with no implementation, so every one of this plan's 9 owned specs (which all depend on `openFirstFinding()` finding a real `<mark>`) would fail regardless of what the page did. Wired it to the same `mockCurrentRun.derivationInputs` fixture each test already configures.
- All 9 previously-red `in-place edit`/`group accept` specs are now green. Full `apps/dispatch-control` suite: 1233 passed / 2 failed / 2 todo — the 2 failures are exactly the pre-existing 51-07-owned cases (`AnnotationMark.test.tsx`'s evidence-card case, `Galley.test.tsx`'s `'D-09 and D-20 are independent'` case), confirmed byte-identical to their pre-plan state. `pnpm --filter dispatch-control build` passes clean.

## Task Commits

1. **Task 2 (built first — no dependency on Task 1/3): Pure grouping selector for recurring corrections** - `1803f0b` (feat)
2. **Task 1: In-place block editor with Save edit / Cancel edit and the patchBonus branch** - `325cfdf` (feat) — includes the blocking `useQuery` mock fix and the Cancel-edit assertion fix, both required for this task's own verify command to pass
3. **Task 3: Group-aware Accept — count in the label, sequential loop, honest partial failure** - `a89ded2` (feat)
4. **Strict-build fix (discovered running the plan's own success criteria, not a task)** - `e42b90d` (fix) — TS closure-narrowing + a `resolution` type mismatch, both invisible to vitest's transform-only pipeline and caught only by `next build`'s full type check

**Note on task ordering:** Task 2 has zero dependency on Tasks 1/3 (a standalone pure module) and was built and committed first so it could be verified and locked in independently. Tasks 1 and 3 both modify `page.tsx`; each commit contains only that task's own slice of the file (in-place editor helpers/render in Task 1's commit, group-accept helpers/render in Task 3's commit) — confirmed by running each task's own verify command against its own commit before starting the next.

**Plan metadata:** (this commit)

## Files Created/Modified

- `apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx` - The flagged block's controlled-textarea editor
- `apps/dispatch-control/lib/galley/findingGroups.ts` - Pure axis+suggestedFix grouping selector (`groupFindings`/`groupForFinding`)
- `apps/dispatch-control/__tests__/findingGroups.test.ts` - 10 unit tests for the grouping selector
- `apps/dispatch-control/app/(editorial)/s/[section]/page.tsx` - `openInPlaceEditor`/`blocksForSection`/`qaFindingsForSection`/`resolveBlockIndex` (Task 1); `sizeFor`/`acceptGroup`/`groupNote` render + `findingGroup` prop on the `Galley` mount (Task 3)
- `apps/dispatch-control/components/galley/AnnotationMark.tsx` - `findingGroup` prop, group-size-aware accept label/click handler, `groupBusy` state
- `apps/dispatch-control/components/galley/GallerySection.tsx` - `findingGroup` prop forwarded into `AnnotationMark`, added to the `useMemo` dependency array
- `apps/dispatch-control/components/galley/Galley.tsx` - `findingGroup` prop forwarded into both `GallerySection` mounts (long-reads loop + bonus)
- `apps/dispatch-control/__tests__/SectionReaderPage.test.tsx` - `useQuery` mock wiring (blocking fix) + one assertion fix (Cancel-edit "restores original text")

## Decisions Made

See frontmatter `key-decisions` for full rationale on: (1) the `useQuery` mock wiring fix, (2) the Cancel-edit assertion rewrite, (3) the block-index fallback for the PassageToolbar path, (4) the group-accept busy-state label's total-vs-live-count simplification, (5) rendering `InPlaceBlockEditor` inline rather than swapping Galley's own DOM node.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `SectionReaderPage.test.tsx`'s `convex/react` `useQuery` mock had no implementation**
- **Found during:** Task 1, first run of the `in-place edit` verify command
- **Issue:** `vi.mock('convex/react', () => ({ useQuery: vi.fn(), ... }))` had no `mockImplementation` configured anywhere in the file (confirmed by 51-04's own SUMMARY, which flagged this exact gap as the next plan's prerequisite). `Galley`'s internal `useQuery(api.qaCorrections.byRunId)`/`useQuery(api.claimChecks.listByRunId)` subscriptions therefore always resolved to `undefined` -> `[]`, so no `<mark>` ever rendered and `openFirstFinding()` (`screen.findAllByRole('button', { name: /qa warning finding/i })`) could never find anything to click — every one of this plan's 9 owned specs would fail regardless of page behavior.
- **Fix:** Added a `beforeEach`-scoped `mockImplementation` reading `mockCurrentRun.derivationInputs.qaFindings`/`.claimRows` (the same fixture each test already configures), mirroring `Galley.test.tsx`'s own `mockImplementation` pattern (query-ref string comparison).
- **Files modified:** `apps/dispatch-control/__tests__/SectionReaderPage.test.tsx`
- **Verification:** All 5 `in-place edit` specs and all 4 `group accept` specs pass; re-ran `renders`/`nav`/`inspect` (unaffected by design — they never call `openFirstFinding()`) to confirm zero regression.
- **Committed in:** `325cfdf` (Task 1 commit)

**2. [Rule 1 - Bug] The pre-existing Cancel-edit spec's exact-string `getByText` assertion cannot pass once a real annotation legitimately splits the sentence**
- **Found during:** Task 1, immediately after fixing deviation #1 (the mock fix is what first makes a real `<mark>` render in this test)
- **Issue:** `screen.getByText('The founder started in a garage in 1974.')` requires ONE element whose OWN direct child text nodes concatenate to that exact string (RTL's `getNodeText` never descends into nested elements — the same quirk 51-04's SUMMARY already documented for the header arrow). The finding that makes `'Edit myself'` reachable at all (this spec's own setup) necessarily wraps `'in a garage'` in a `<mark>`, and the D-07 axis tag renders `'Fact'` as an immediately-adjacent sibling span with no separating space — so the full sentence is structurally split across multiple nodes and no single element's direct-text-node join can ever equal it, regardless of Cancel/Save behavior.
- **Fix:** Replaced the exact-string match with `container.textContent` checks: the edited value (`'A completely different sentence.'`) is asserted absent, and the untouched portions of the original sentence on both sides of the marked span (`'The founder started'`, `'in 1974.'`) are asserted present — preserving the spec's actual intent (Cancel discards the edit, the original wording is intact) without relying on a DOM-structure assumption the real design (a real, visible finding) makes impossible.
- **Files modified:** `apps/dispatch-control/__tests__/SectionReaderPage.test.tsx`
- **Verification:** `Cancel edit makes no network call and restores the original text` passes; `patchSection`/`patchBonus` still asserted never-called.
- **Committed in:** `325cfdf` (Task 1 commit)

**3. [Rule 1 - Bug] Two TypeScript closure-narrowing errors and one type mismatch, invisible to vitest, caught only by the strict build**
- **Found during:** Post-Task-3, running the plan's own `pnpm --filter dispatch-control build` success criterion
- **Issue:** (a) TS does not carry an outer `useState`-backed variable's `if (!draft) return ...` null-check narrowing into a NESTED function DECLARATION's body (`blocksForSection`, `acceptGroup`) — the closure could in principle run after the state changes, so TS treats `draft`/`runId` as still-nullable inside them. (b) The page's local `QaCorrectionRow.resolution` type (widened to include `null`, matching the real Convex row shape) was assigned directly into `QaFinding.resolution` (`'accepted' | 'dismissed' | undefined`, no `null`) without normalization.
- **Fix:** Captured `draft`/`runId` in `const currentDraft = draft` / `const currentRunId = runId` once, right after the existing null-check, and read those (already-narrowed) locals inside the nested functions instead of the raw state variables. Normalized `resolution: row.resolution ?? undefined` in the `QaFinding` mapping.
- **Files modified:** `apps/dispatch-control/app/(editorial)/s/[section]/page.tsx`
- **Verification:** `pnpm --filter dispatch-control build` passes clean (`/s/[section]` in the route table); full `apps/dispatch-control` vitest suite unaffected (1233 passed / 2 failed / 2 todo, same as before this fix — vitest's esbuild transform doesn't type-check, so these errors were never visible to it).
- **Committed in:** `e42b90d` (separate fix commit, after Task 3)

---

**Total deviations:** 3 auto-fixed (1 blocking test-infrastructure gap, 1 bug in a pre-existing test's structural assumption, 1 bug caught only by full type-checking)
**Impact on plan:** All three were necessary for the plan's own verify commands and success criteria (`pnpm --filter dispatch-control build`) to pass. None weaken, skip, or re-scope any locked assertion; none touch product behavior beyond what the plan specifies.

## Known False-Positive in the Plan's Own Acceptance Criteria

Task 1's acceptance criteria includes `grep -rn "SectionEditorPanel\|BlockEditor" "apps/dispatch-control/app/(editorial)/"` returning NO matches. This literally cannot pass while also satisfying the SAME task's mandated file path (`_components/InPlaceBlockEditor.tsx`, specified in the plan's own frontmatter `files_modified` and `must_haves.artifacts`) — `InPlaceBlockEditor` contains `BlockEditor` as a raw substring, so the grep matches the new file's own name/type/function identifiers. Verified the check's REAL intent (no deep-link into the old review-desk console's editor, per the interfaces section and D-18) is honored with a precise check instead: `grep -rn "from '.*review-desk.*BlockEditor'\|from '.*SectionEditorPanel'\|import.*SectionEditorPanel\|import BlockEditor\b" "app/(editorial)/"` returns no matches — no import of either old-console component exists anywhere under `(editorial)/`. Not a deviation in behavior; documented so the literal grep's expected failure isn't mistaken for a regression.

## Issues Encountered

None beyond the deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 51-06 (integration gate, strict build) should find `pnpm --filter dispatch-control build` already passing clean and the full vitest suite at 1233 passed / 2 failed (the 2 pre-existing 51-07-owned cases) / 2 todo — no new work needed from this plan's surface area.
- Plan 51-07 (evidence in the finding popover) has its 2 known-red cases unchanged by this plan; `page.tsx`'s `Galley` mount still threads `showProvenance`/claim resolution through the same primitives 51-07 will extend, and the new `findingGroup` prop sits alongside those without touching claim/provenance wiring.
- `docs/API_CONTRACTS.md`'s content-patch endpoint family is untouched — no new backend endpoint, no batch accept route.
- No blockers.

---
*Phase: 51-section-read-and-fix-in-place*
*Completed: 2026-08-01*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx
- FOUND: apps/dispatch-control/lib/galley/findingGroups.ts
- FOUND: apps/dispatch-control/__tests__/findingGroups.test.ts
- FOUND: apps/dispatch-control/app/(editorial)/s/[section]/page.tsx
- FOUND: apps/dispatch-control/components/galley/AnnotationMark.tsx
- FOUND: apps/dispatch-control/components/galley/GallerySection.tsx
- FOUND: apps/dispatch-control/components/galley/Galley.tsx
- FOUND: apps/dispatch-control/__tests__/SectionReaderPage.test.tsx
- FOUND: .planning/phases/51-section-read-and-fix-in-place/51-05-SUMMARY.md
- FOUND commit: 1803f0b (Task 2 — findingGroups.ts)
- FOUND commit: 325cfdf (Task 1 — InPlaceBlockEditor)
- FOUND commit: a89ded2 (Task 3 — group-aware Accept)
- FOUND commit: e42b90d (strict-build fix)
