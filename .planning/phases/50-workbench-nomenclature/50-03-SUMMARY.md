---
phase: 50-workbench-nomenclature
plan: 03
subsystem: ui
tags: [nextjs, react, vitest, convex, nomenclature, role-gating]

# Dependency graph
requires:
  - phase: 50-workbench-nomenclature (50-00)
    provides: rename-preservation tripwire (route folders + stored 'blocklisted' enum unchanged) + the D-06 nomenclature.ts source of truth
provides:
  - Masthead automation chip + AutoPublishBanner reworded off switch-framing (D-16); the OFF/normal case still reads "Human approval required"
  - RegistryTable's Mark Do-not-use gated behind a typed organization-name + required-reason confirm, Editor-in-chief only (D-15)
  - "Do not use" rendered label for the 'blocklisted' charity status (CharityStatusBadge + RegistryTable), stored enum unchanged (D-03)
  - registryDoNotUse.test.ts + publishNoTypedConfirm.test.ts source-scan/behavior tripwires
affects: [50-workbench-nomenclature (later plans sweeping remaining nomenclature), any future publish-surface or Do-not-use UI change]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Typed-name destructive-action confirm: a controlled text input compared exact-trimmed against the entity's real name gates the confirm button, layered on top of an existing required-reason field (RegistryTable Mark Do-not-use)."
    - "Source-scan tripwire scoped to an EXPECTED FILE LIST (not a whole directory) when sibling files in the same directory legitimately contain the pattern being forbidden elsewhere (roleGateInventory.test.ts precedent, reused for publishNoTypedConfirm.test.ts)."

key-files:
  created:
    - apps/dispatch-control/__tests__/registryDoNotUse.test.ts
    - apps/dispatch-control/__tests__/publishNoTypedConfirm.test.ts
  modified:
    - apps/dispatch-control/components/Masthead.tsx
    - apps/dispatch-control/app/(dashboard)/_components/AutoPublishBanner.tsx
    - apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx
    - apps/dispatch-control/app/(dashboard)/registry/_components/CharityStatusBadge.tsx
    - apps/dispatch-control/vitest.config.ts
    - apps/dispatch-control/__tests__/Masthead.test.tsx

key-decisions:
  - "Masthead ON chip reads 'Publishing automatically — managed in Administration' (D-16 discretion) — never 'Auto-publish ON/OFF' switch phrasing; the OFF case ('Human approval required') was already correct and is untouched."
  - "registryDoNotUse.test.ts and publishNoTypedConfirm.test.ts use React.createElement instead of JSX because the plan names them '.test.ts' and this project's esbuild config only parses JSX in '.tsx' files; registryDoNotUse.test.ts needed an explicit jsdom environmentMatchGlobs entry since '.test.ts' defaults to node."
  - "publishNoTypedConfirm.test.ts scans exactly the three publish-decision files (DecisionRail.tsx, PublishPreviewDialog.tsx, ReviewDecisionPanel.tsx), not their parent _components/ directories — those directories also hold unrelated content-editing components with legitimate <input> elements (AssetUploadSlot, TurnListEditor, StructuredFieldEditor, SchedulePublishDialog) that would otherwise false-positive a directory-wide scan."

patterns-established:
  - "Rendered-label-over-stored-enum: RegistryTable/CharityStatusBadge swap 'Blocklisted' -> 'Do not use' in every visible string and DOM id/htmlFor stays on the old identifier — the stored value, mutation call, and audit action are never touched (D-03)."

requirements-completed: [WBN-06, WBN-05]

# Metrics
duration: ~20min
completed: 2026-07-16
---

# Phase 50 Plan 03: Automation Reframe + Typed-Confirm Scoped to Do-not-use Summary

**Masthead/AutoPublishBanner drop automation switch-framing (D-16), Mark Do-not-use gains a typed org-name + reason confirm (D-15), and the rendered charity status reads "Do not use" over the unchanged stored `'blocklisted'` enum (D-03) — all proven by two new tripwire test files.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-07-16T18:40:00-07:00 (approx)
- **Completed:** 2026-07-16T18:57:39-07:00
- **Tasks:** 3
- **Files modified:** 8 (6 modified, 2 created)

## Accomplishments
- Masthead's automation chip and `AutoPublishBanner` no longer read as an operator-flippable switch; both now name Administration (Config) as the setting's real home, while the safe/normal "Human approval required" case is unchanged.
- `RegistryTable`'s Mark Do-not-use action requires the operator to type the organization's exact name (in addition to the existing required reason) before the confirm button unlocks — Editor-in-chief only, unchanged server/mutation gating.
- The `'blocklisted'` charity status renders as "Do not use" everywhere in the Registry UI (filter pill, trigger/confirm/restore button copy, status badge) while the stored Convex value, `setStatus` mutation call, and `charity.blocklisted` audit action are byte-unchanged.
- Verified (and now tripwired) that neither publish surface — `DecisionRail.tsx`, `PublishPreviewDialog.tsx`, `ReviewDecisionPanel.tsx` — carries any typed-confirmation input; Publish is gated solely by the sign-off/claims state (Phase 34 reversal, D-15).

## Task Commits

Each task was committed atomically:

1. **Task 1: Reframe the Masthead automation chip + AutoPublishBanner** - `67a571b` (feat)
2. **Task 2: Add typed org-name confirmation to Mark Do-not-use + swap the "Do not use" label** - `e5a8041` (feat)
3. **Task 3: Verify + guard that neither publish surface carries a typed confirmation** - `cb6ce8e` (test)

**Plan metadata:** (this commit) - `docs(50-03): complete plan`

## Files Created/Modified
- `apps/dispatch-control/components/Masthead.tsx` - ON chip reworded off switch-framing; points at Administration
- `apps/dispatch-control/app/(dashboard)/_components/AutoPublishBanner.tsx` - banner copy reworded; "Open Administration" link
- `apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` - typed org-name gate added to Mark Do-not-use confirm; labels renamed ("Do not use"/"Mark Do not use"/"Restore to consideration"); `status: 'blocklisted'` mutation unchanged
- `apps/dispatch-control/app/(dashboard)/registry/_components/CharityStatusBadge.tsx` - `'blocklisted'` renders "Do not use"
- `apps/dispatch-control/vitest.config.ts` - added a jsdom `environmentMatchGlobs` entry for `registryDoNotUse.test.ts`
- `apps/dispatch-control/__tests__/registryDoNotUse.test.ts` - new: typed-name gating, unchanged mutation value, "Do not use" label, no leftover "Blocklist(ed)" copy
- `apps/dispatch-control/__tests__/publishNoTypedConfirm.test.ts` - new: source-scan tripwire over the three publish-decision files
- `apps/dispatch-control/__tests__/Masthead.test.tsx` - updated the ON-chip test to match the D-16 reframe (Rule 1 fix)

## Decisions Made
- **ON-chip wording (D-16 discretion):** "Publishing automatically — managed in Administration" — an honest alert naming where the setting lives, never "Auto-publish ON/OFF" switch phrasing. The banner's link text changed from "Change in Config" to "Open Administration" to match.
- **Typed-confirm gate placement:** added `typedName` state alongside the existing `blocklistReason` state in `RegistryTable`, with the confirm button's `disabled` expression requiring both `typedName.trim() === charity.name.trim()` and a non-empty reason — defense-in-depth also re-checked inside `handleBlocklist` itself, not just the disabled prop.
- **Test file extension vs. JSX:** the plan names both new test files `.test.ts`. This project's `esbuild.jsx` config only parses JSX in `.tsx`-loader files (confirmed by a transform error), so `registryDoNotUse.test.ts` uses `React.createElement(...)` instead of JSX to stay `.ts` per the plan's exact filename, and needed an explicit `jsdom` override in `vitest.config.ts` (`.test.ts` defaults to `node` environment, and React Testing Library needs a DOM). `publishNoTypedConfirm.test.ts` is a pure fs/regex source scan with no rendering, so it needed no environment override.
- **Scan scope for the no-typed-confirm tripwire:** scoped to the three actual publish-decision files by name, not their parent `_components/` directories — those directories also contain unrelated content-editing components (`AssetUploadSlot`, `TurnListEditor`, `StructuredFieldEditor`, `SchedulePublishDialog`) with legitimate `<input>` elements that would otherwise false-positive a directory-wide `<input>` scan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a stale "Auto-publish ON" comment in Masthead.tsx that would have failed the Task 1 acceptance-criteria grep**
- **Found during:** Task 1
- **Issue:** After rewording the chip's ON-case text, a top-of-file doc comment still contained the literal string `"Auto-publish OFF"` in quotes (historical note about the D-26 rename), which the acceptance criterion `grep -rn "Auto-publish ON\|Auto-publish OFF" ...` returns NOTHING would have flagged.
- **Fix:** Reworded the comment to drop the literal quoted phrase while preserving its meaning.
- **Files modified:** `apps/dispatch-control/components/Masthead.tsx`
- **Verification:** Re-ran the exact acceptance-criteria grep — zero matches.
- **Committed in:** `67a571b` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Masthead.test.tsx's pre-existing "Auto-publish ON" assertion broken by the Task 1 copy change**
- **Found during:** full-suite `pnpm --filter dispatch-control test -- --run` after Task 3
- **Issue:** An existing test asserted `screen.getByText(/Auto-publish ON/)` for the ON-chip state — a direct, in-scope regression caused by Task 1's rename.
- **Fix:** Updated the test to assert the new copy (`/Publishing automatically/`, containing "managed in Administration") and to assert the old phrase is absent, keeping the vermilion-styling assertion.
- **Files modified:** `apps/dispatch-control/__tests__/Masthead.test.tsx`
- **Verification:** `pnpm --filter dispatch-control test -- --run` — 122 test files passed, 996 tests passed (1 pre-existing skip, 2 pre-existing todos, unrelated to this plan).
- **Committed in:** `cb6ce8e` (bundled with the Task 3 commit, since it surfaced only after Task 3's full-suite run)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs/regressions directly caused by this plan's own copy changes)
**Impact on plan:** Both fixes were necessary to keep the acceptance criteria and the existing test suite green. No scope creep — no files outside the plan's `files_modified` list (plus the pre-existing `Masthead.test.tsx`, which the plan's own change broke) were touched.

## Issues Encountered
- esbuild's `.ts` loader does not parse JSX (only `.tsx` does) under this project's vite/vitest config — `registryDoNotUse.test.ts` initially failed to transform. Resolved by using `React.createElement(...)` instead of JSX, keeping the plan's exact `.test.ts` filename.
- `.test.ts` files default to `node` environment in `environmentMatchGlobs`, but `registryDoNotUse.test.ts` needs `jsdom` for React Testing Library. Resolved with an explicit per-file override, matching the existing convention for other individually-named test files in that config.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The rename-preservation tripwire (50-00) and both new tripwires (`registryDoNotUse.test.ts`, `publishNoTypedConfirm.test.ts`) are all green, alongside the full existing suite (996 passed) and `pnpm --filter dispatch-control build` (exits 0).
- WBN-06 (automation reframe) and the WBN-05 Do-not-use label swap are both closed for this plan's scope. The broader WBN-05 nomenclature sweep (glossary, remaining screens) is tracked by later Phase 50 plans, not this one.
- No blockers for subsequent Phase 50 plans.

---
*Phase: 50-workbench-nomenclature*
*Completed: 2026-07-16*

## Self-Check: PASSED

All 9 files confirmed present on disk; all 3 task commits (`67a571b`, `e5a8041`, `cb6ce8e`) confirmed present in git history.
