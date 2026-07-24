---
phase: quick-260724-lp1
plan: 01
subsystem: ui
tags: [dispatch-control, design-system, tailwind, 1c-tokens, run-monitor, prompt-lab, registry, restyle]

# Dependency graph
requires:
  - phase: quick-260722-v01
    provides: "The var(--color-*) / bracket-pixel 1c token system RunsTable/ReviewQueue/RunDetail/RunControlBar were already partially migrated onto, giving this pass a consistent starting point"
provides:
  - "Run Monitor, Prompt Lab, and Registry restyled onto the uniform System Sheet vocabulary (mockups 05/06/07/08): hard edges (radius 0-2px, no rounded-lg/md/xl/full text pills), 1c color tokens only, square mono-caps status/filter chips, mono-caps table headers with mono numeral cells, status-rule top-border cards, kicker-to-h1-to-italic-dek page heads"
  - "issueDraftHref routing for the signoff-facts task CTA and the Run Monitor awaiting-review 'Review ->' CTA (previously issueApprovalHref) — reviewers land on the Draft/Story Desk stage instead of dead-ending at Approval"
affects: [dispatch-control, run-monitor, prompt-lab, registry]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Uniform square status/filter chip recipe: `inline-block border px-2 py-[3px] font-[family-name:var(--font-mono)] text-[9.5px] tracking-[.09em] uppercase` + a per-status border+tinted-fill pair (vermilion is the only solid-fill chip)"
    - "Uniform table recipe: hard-edged card wrapper, mono-caps 9.5px faint `<th>`, mono 11px ink-soft numeral `<td>` cells, manual border-b per row (last row unbordered) instead of `divide-y`, `hover:bg-card-alt`"
    - "Uniform status-rule card: bg card, 1px faint border, 3px top border carrying status color (nav grey at rest -> cobalt on hover, or a fixed status color when the card has a persistent state like 'edited')"
    - "Uniform page head: mono-caps cobalt kicker 'System Workbench' -> Newsreader ~32px h1 (using the existing WORKBENCH_NAV_LABELS constant, unchanged) -> Lora italic dek"

key-files:
  modified:
    - "apps/dispatch-control/lib/derivedState.ts"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/ReviewQueue.tsx"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunsTable.tsx"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunDetail.tsx"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunControlBar.tsx"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/CancelRunButton.tsx"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/CostRollup.tsx"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/BudgetAlertBanner.tsx"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/layout.tsx"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/WriterExpansion.tsx"
    - "apps/dispatch-control/app/(dashboard)/registry/page.tsx"
    - "apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx"
    - "apps/dispatch-control/app/(dashboard)/registry/_components/CharityStatusBadge.tsx"
    - "apps/dispatch-control/app/(dashboard)/registry/_components/CoverageStrip.tsx"
    - "apps/dispatch-control/app/(dashboard)/registry/_components/AddCharityDialog.tsx"
    - "apps/dispatch-control/app/(dashboard)/registry/_components/AddCharityDialogTrigger.tsx"
    - "apps/dispatch-control/app/(dashboard)/registry/_components/CorrectionsList.tsx"
    - "apps/dispatch-control/app/(dashboard)/registry/_components/AddCorrectionDialog.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/page.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptsListClient.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/DiffViewer.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptEditor.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptSaveDialog.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableChips.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AssembledPreview.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptMarkerExport.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/TestRunPanel.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/_CodeMirrorInner.tsx"
    - "apps/dispatch-control/__tests__/derivedState.test.ts"
    - "apps/dispatch-control/__tests__/runControl.test.tsx"

key-decisions:
  - "STATUS_CLASSES.cancelled (RunsTable.tsx, exported and directly asserted by runControl.test.tsx) needed its exact string changed to add the new square-chip border — updated the one test that pinned the literal old value rather than leaving RunsTable's chip half-converted; this is styling, not behavior, and the plan's own success criteria anticipated it ('no test asserts an old class')"
  - "RunDetail.tsx's inline status chips got geometry + typography squared off (border + mono-caps uppercase) but kept their EXACT existing bg/text color-token values, per the plan's explicit 'GEOMETRY SQUARE-OFF ONLY... do not recolour' instruction for that file — this is a deliberately different (lighter) treatment than RunsTable's/RegistryTable's/CharityStatusBadge's full chip-recipe rewrite"
  - "Added a Lora-italic dek line to the Registry and Prompt Lab page heads (mockup 07/06 copy) where none existed before, and left Run Monitor's RunControlBar with kicker+h1 only (no dek) — matching each file's own task instruction (Registry/Prompt Lab explicitly spec the 3-part kicker/h1/dek head; RunControlBar's instruction was an 'optional light touch' kicker addition only)"
  - "PromptsListClient's per-card kicker uses the real GROUP_LABELS[group] value (System/Asset/Section Guidance/User Template) instead of mockup 06's literal hardcoded 'Agent' text, since the four real groups aren't all literally agents — more informative and still real data, no fabrication"
  - "Kept every existing content element that had no mockup equivalent (RegistryTable's org sub-line has none in real data so it was omitted rather than invented; PromptsListClient's live-content preview snippet and CorrectionsList/AddCorrectionDialog have no mockup counterpart at all) — token/radius hygiene only for those, never invented copy"

requirements-completed: [UI-UNIFORM, ROUTE-DRAFT]

# Metrics
duration: ~50min (executor)
completed: 2026-07-24
commits:
  - "eed3e82 fix(quick-260724-lp1): route Review CTAs to Draft stage, not Approval"
  - "c3e812b feat(quick-260724-lp1): restyle Run Monitor + Registry to the uniform system"
  - "302f546 feat(quick-260724-lp1): restyle Prompt Lab to the uniform system"
---

# Quick Task 260724-lp1: Uniform visual pass on Run Monitor, Prompt Lab, Registry + Draft-stage routing fix

**One-liner:** Restyled the three remaining generic-Tailwind workbench surfaces (Run Monitor, Prompt Lab, Registry — ~30 files) onto the house 1c hard-edge design system, and flipped the two "Review" CTAs from the Approval gate to the Draft/Story Desk stage.

## What shipped

### Task 1 — Routing fix
- `lib/derivedState.ts`: the `signoff-facts` task's CTA now resolves via `issueDraftHref(n)` instead of `issueApprovalHref(n)` (the now-unused `issueApprovalHref` import was removed — required for the strict build gate). `where: 'Approval'` / `stage: 5` left unchanged (only the navigation target moved).
- `ReviewQueue.tsx`: the Run Monitor awaiting-review card's "Review →" CTA now resolves `issueDraftHref(pRun.issueNumber)`. The legacy run-keyed loading-state fallback URL is untouched (out of scope, still redirects to Approval).
- `__tests__/derivedState.test.ts`: the one test asserting the old `/issues/7/approval` href now asserts `/issues/7/draft`.

### Task 2 — Run Monitor + Registry restyle
- **Run Monitor:** `RunsTable.tsx` (uniform table + rewritten square `STATUS_CLASSES`), `ReviewQueue.tsx` (mockup-05 `q-card` treatment), `layout.tsx` (mono-caps 3px-cobalt underline tabs), `RunControlBar.tsx` (kicker added, buttons squared), `RunDetail.tsx` (geometry-only square-off, colors preserved per its own instruction), plus hygiene passes on `RecoveryRail.tsx`, `CostRollup.tsx`, `CancelRunButton.tsx`, `BudgetAlertBanner.tsx`, `AgentNode.tsx`, `WriterExpansion.tsx`.
- **Registry:** `page.tsx` (full kicker/h1/dek head), `RegistryTable.tsx` (full uniform-table rewrite — filter pills to square `.f-chip`s, mono headers/numerals), `CharityStatusBadge.tsx` (3-state square chip, remapped featured→cobalt / candidate→marigold / blocklisted→solid vermilion), `CoverageStrip.tsx` (3px cobalt top-border card idiom — its per-charity coverage columns are a different feature from mockup 07's stat-tile+meter layout, so only geometry/typography carried over, not that structure), plus hygiene on `AddCharityDialog(Trigger)`, `CorrectionsList`, `AddCorrectionDialog`.
- Verified zero `text-neutral-*/bg-neutral-*/border-neutral-*/text-gray-*/bg-gray-*/text-slate-*` and zero `rounded-lg/md/xl/2xl` remain in either subtree (the plan's exact grep passes clean); the one `rounded-full` left in run-monitor is `AgentNode.tsx`'s 8px status dot, which house rules explicitly exempt.

### Task 3 — Prompt Lab restyle + gate
- `page.tsx` (kicker/h1/dek head), `PromptsListClient.tsx` (mockup-06 status-rule agent-card grid — mono kicker → Newsreader h3 → Lora italic description → square Stock/Edited footer chip + mono version meta), `AgentPromptEditorView.tsx` (editor-card idiom: mono kicker + Newsreader heading, hard-edged ghost/primary buttons, card-alt code pane, square variable/drift chips).
- Hygiene sweep (token/radius only, no restructure) across `VersionHistoryPanel.tsx`, `DiffViewer.tsx`, `PromptEditor.tsx`, `PromptSaveDialog.tsx`, `VariableChips.tsx`, `AssembledPreview.tsx`, `PromptMarkerExport.tsx`, `TestRunPanel.tsx`, `EvalDrawer.tsx`, `_CodeMirrorInner.tsx`.
- Final gate: full `pnpm --filter dispatch-control test` (137 files / 1101 tests) and `pnpm --filter dispatch-control build` (strict, `next build`) both pass clean with zero type/lint errors.

## Task Commits

1. **Task 1: Flip the two "Review" CTAs to the Draft stage + update the one test** - `eed3e82` (fix)
2. **Task 2: Restyle Run Monitor + Registry to the uniform system** - `c3e812b` (feat)
3. **Task 3: Restyle Prompt Lab to the uniform system + FULL verification gate** - `302f546` (feat)

## Files Created/Modified

See `key-files.modified` in frontmatter above — 33 source files across `lib/`, `run-monitor/`, `registry/`, and `prompt-lab/`, plus 2 test files.

## Decisions Made

See `key-decisions` in frontmatter above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two JSDoc comments containing a literal `-*/ ` sequence broke esbuild's block-comment parsing**
- **Found during:** Task 2 (`RegistryTable.tsx`) and Task 3 (`VersionHistoryPanel.tsx`)
- **Issue:** A header comment describing the token migration used the literal substring `text-neutral-*/bg-neutral-*` (and similarly `-blue-*` etc.) — the `*/` inside that string terminates the JSDoc block comment early, producing a syntax error (`Unexpected "*"`) that failed the affected test file's transform
- **Fix:** Reworded both comments to avoid any `<word>-*/` sequence (e.g. "off the generic Tailwind grey/amber/red/green/blue palette and onto 1c tokens" instead of listing literal class-name globs)
- **Files modified:** `apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx`, `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx`
- **Verification:** `pnpm --filter dispatch-control test -- registryDoNotUse` / `-- EvalDrawer` both green after the fix; confirmed no other `-*/ ` occurrences anywhere in the three restyled subtrees
- **Committed in:** c3e812b, 302f546 (part of each task's commit — caught and fixed before committing)

---

**Total deviations:** 1 auto-fixed (1 bug — self-inflicted comment syntax error caught by the test gate before commit)
**Impact on plan:** No scope creep; purely a self-correction during the restyle itself.

## Issues Encountered

None beyond the deviation above.

## Follow-ups (locked decision 4, per plan's `<output>` instructions)

- **Eval Center does NOT share any components with Prompt Lab or the other two restyled surfaces** (checked: `DriftScoreboard.tsx`, `ScenarioCard.tsx`, `ShadowRunPanel.tsx`, `eval-center/page.tsx` — no cross-imports either direction with `prompt-lab/_components/*`).
- **Eval Center is already clean** — a grep for `text-neutral-*/bg-neutral-*/border-neutral-*/text-gray-*/bg-gray-*/text-slate-*` and `rounded-lg/md/xl/2xl` across `app/*/eval-center` returns zero hits. No follow-up needed.
- **Prompt Lab deep drawers received token/radius hygiene only, not full mockup treatment** (mockup 06 doesn't depict them): `VersionHistoryPanel.tsx`, `DiffViewer.tsx`, `TestRunPanel.tsx`, `EvalDrawer.tsx`, `PromptEditor.tsx`, `PromptSaveDialog.tsx`, `VariableChips.tsx`, `AssembledPreview.tsx`, `PromptMarkerExport.tsx`, `_CodeMirrorInner.tsx` — all are now on 1c tokens with hard edges, but their layouts/structure are unchanged from before this task.

## User Setup Required

None — no external service configuration required. No deploy performed (per constraints); Vercel will pick up these commits on the next normal deploy.

## Next Phase Readiness

- Full vitest suite (137 files, 1101 tests, 2 todo) green; strict `next build` (type-check + lint + static generation) green.
- All three restyled subtrees verified clean of neutral/gray/slate classes and non-2px-or-less radii via the plan's exact grep commands.
- No behavior, data, handler, query, or testid changes anywhere — confirmed by the full test suite passing unmodified except the one test (`runControl.test.tsx`) whose literal-string assertion was updated to match the new (intentionally changed) square-chip class, and the one href test (`derivedState.test.ts`) the routing fix required.

---
*Quick task: 260724-lp1*
*Completed: 2026-07-24*

## Self-Check: PASSED

All key modified files verified present on disk (derivedState.ts, ReviewQueue.tsx, RunsTable.tsx, RegistryTable.tsx, PromptsListClient.tsx, AgentPromptEditorView.tsx, this SUMMARY, the PLAN). All 3 commit hashes (eed3e82, c3e812b, 302f546) verified present in git history.
