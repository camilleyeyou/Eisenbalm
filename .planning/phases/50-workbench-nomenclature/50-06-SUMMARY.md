---
phase: 50-workbench-nomenclature
plan: 06
subsystem: ui
tags: [nextjs, react, vitest, nomenclature, source-scan-tripwire]

# Dependency graph
requires:
  - phase: 50-workbench-nomenclature (50-00)
    provides: the WBN-05 nomenclature.test.ts skip-guarded scaffold (FORBIDDEN_COPY_TERMS + ALLOWLIST authored, describe.skip) + rename-preservation.test.ts (routes/enums proven unchanged) + lib/nomenclature.ts (WORKBENCH_NAV_LABELS/PRODUCT_TERMS)
  - phase: 50-workbench-nomenclature (50-01..50-05)
    provides: nav/heading renames, Run Details action steps + diamonds, automation reframe + Do-not-use typed confirm, Agent Instructions origin-ref, failed-run recovery rail — the prior waves this plan's tripwire proves complete
provides:
  - Full nomenclature sweep of the how-to-use glossary (WEEKLY_LOOP screen labels, the reconciled two-deterministic-checks legend, the corrected typed-confirmation house rule) and Prompt Lab / Eval Center / Signal Desk operator copy
  - The 260710-k8y conflict vocabulary corrected everywhere it survived (Rehearsal, Make live/Making live, the LIVE badge, Draft vs. live)
  - The nomenclature-table tail rows corrected (Coverage memory, never seeded, Blocking items) plus three extra live hits a spec-keyed sweep would have missed (CreatePanel's two "Gate 1" mentions, MyTasksScreen's sign-off-gate tooltip, PromptMarkerExport's "copy -> commit" label)
  - nomenclature.test.ts un-skipped and green — proves no legacy term survives in app/ + components/ operator-facing copy
affects: [any future Workbench screen copy change; the phase-50 close-out / milestone verification]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-scan tripwire un-skip as a phase close-out gate: author the scaffold fully in Wave 0 (skip-guarded), sweep copy across waves, flip describe.skip -> describe as the LAST plan's proof step — never weaken the banned-term set to force green."
    - "Rename-caused test breakage is a same-task Rule 1 fix, not a deviation from scope: renaming visible copy that an existing test hard-asserts on requires updating that test's matcher in the same commit (EvalDrawer.test.tsx, DecisionRail.test.tsx, how-to-use.test.ts — mirrors Plan 50-03's Masthead.test.tsx precedent)."

key-files:
  modified:
    - apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/TestRunPanel.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptsListClient.tsx
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptMarkerExport.tsx
    - apps/dispatch-control/app/(dashboard)/eval-center/page.tsx
    - apps/dispatch-control/app/(dashboard)/eval-center/_components/ScenarioCard.tsx
    - apps/dispatch-control/app/(dashboard)/eval-center/_components/DriftScoreboard.tsx
    - apps/dispatch-control/app/(dashboard)/eval-center/_components/ShadowRunPanel.tsx
    - apps/dispatch-control/app/(dashboard)/signal-desk/_components/SignalDeskScreen.tsx
    - apps/dispatch-control/app/(dashboard)/signal-desk/_components/DecisionPanel.tsx
    - apps/dispatch-control/app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx
    - apps/dispatch-control/app/(dashboard)/registry/_components/CoverageStrip.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx
    - apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx
    - apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx
    - apps/dispatch-control/__tests__/nomenclature.test.ts
    - apps/dispatch-control/__tests__/how-to-use.test.ts
    - apps/dispatch-control/__tests__/EvalDrawer.test.tsx
    - apps/dispatch-control/__tests__/DecisionRail.test.tsx

key-decisions:
  - "The how-to-use WEEKLY_LOOP screen labels became a term-swap to CURRENT screen/stage names, not the spec's literal old->new pairs: 'Review Desk' -> 'Fact Check' (the Issue Workspace's actual current stage name per StageStrip.tsx's STAGE_LABELS, since 'Review Desk' itself already left the nav in Phase 41 and its content now lives in the Fact Check stage), 'Run Monitor'/'Prompt Lab'/'Eval Center' sourced live from WORKBENCH_NAV_LABELS so the page can never drift from lib/nav.ts's own source of truth."
  - "Corrected House Rule 4's stale claim that 'Publish...takes a typed confirmation' — Plan 50-03 already implemented and tripwired (publishNoTypedConfirm.test.ts) the D-15 milestone-locked fact that Publish carries NO typed confirmation (only Mark Do-not-use does); leaving the how-to-use page contradicting a proven, tested fact would be documentation that actively misleads the operator about a security procedure. Reworded to 'Marking an organization Do not use takes a typed confirmation...Human approval required is the default; the automation setting itself lives in Administration.'"
  - "'source: ...commit...' the STORED eval_scores enum literal (VersionHistoryPanel.tsx / EvalDrawer.tsx) is explicitly NOT renamed — D-14 requires the Phase 38 commit-gate/activate mutation wiring stay byte-unchanged. Only the OPERATOR-FACING labels around it (button text, placeholders, headings) were swept; the code identifier and stored value are untouched, consistent with the rename-preservation tripwire's D-02/D-03 guarantee."
  - "Extended the sweep past the plan's enumerated file list to three extra live hits a spec-keyed grep would miss: AgentPromptEditorView.tsx's 'This prompt has not been seeded yet.' (constraint-flagged), CreatePanel.tsx's two 'Gate 1' mentions (constraint-flagged), and — found only by running the ACTUAL tripwire regex logic against the whole tree — MyTasksScreen.tsx's 'sign-off gate' tooltip and PromptMarkerExport.tsx's 'copy -> commit' export label (both genuine misses outside the plan's file list, caught only by exhaustively simulating the un-skipped tripwire before flipping it live)."

patterns-established:
  - "Simulate the exact tripwire regex/extraction logic (FORBIDDEN_COPY_TERMS + the JSX-text/prop candidate extractor, not a blanket grep) as a pre-flight check before un-skipping a source-scan tripwire — catches files outside the plan's enumerated list that a narrower search would miss, without over- or under-fixing relative to what the automated gate actually enforces."

requirements-completed: [WBN-05]

# Metrics
duration: ~35min
completed: 2026-07-17
---

# Phase 50 Plan 06: Nomenclature Sweep — Tripwire Green Summary

**Full-tree sweep of the last legacy-nomenclature holdouts (how-to-use glossary, Prompt Lab/Eval Center/Signal Desk copy, the 260710-k8y "Rehearsal"/"Make live"/"Draft vs. live" conflict terms, and three extra live hits found only by simulating the actual tripwire) closes WBN-05 with `nomenclature.test.ts` un-skipped and green across the whole `app/` + `components/` tree.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-07-17T02:58Z (approx, from STATE.md session record)
- **Completed:** 2026-07-17T03:26Z
- **Tasks:** 3
- **Files modified:** 23 (19 source files, 4 test files)

## Accomplishments
- Swept the how-to-use glossary (the densest legacy-term hot spot) term-by-term against the binding nomenclature table, corrected the stale "three deterministic checks" legend to the reconciled truth (two checks — Verify organizations, Verify research — plus the Publisher's Prepare publication diamond, which is an action not a check), and fixed a stale factual claim that Publish requires a typed confirmation (it doesn't, per the D-15 milestone-locked decision already implemented in Plan 50-03).
- Corrected every surviving instance of the 260710-k8y conflict vocabulary — the highest-value catches, since a sweep keyed only to the spec's "old" column would have missed these newer-but-wrong strings entirely: "Rehearsal" -> "Test changes", "Make live"/"Making live..." -> "Make active"/"Making active...", the "LIVE" badge -> "Active", "Draft vs. live" -> "Compare results".
- Swept Prompt Lab, Eval Center, and Signal Desk operator copy against the spec's own "old" column (eval/evals, commit/rollback, golden scenario, shadow run, Gate 1) and the remaining nomenclature-table tail rows (Coverage memory, never seeded, Blocking items), while keeping the Phase 38 commit-gate/activate mutation wiring and the `eval_scores.source` stored enum values byte-unchanged.
- Un-skipped `nomenclature.test.ts` and iterated until green — proving, with an automated source-scan tripwire (not just a one-time grep), that no legacy term survives in `app/` + `components/` operator-facing copy — without weakening the banned-term set or over-broadening the allowlist to force a pass.

## Task Commits

Each task was committed atomically:

1. **Task 1: Sweep the how-to-use glossary + correct the deterministic-check legend** - `ca430d9` (feat)
2. **Task 2: Sweep Prompt Lab + Eval Center + Signal Desk + Editorial Memory copy incl. the 260710-k8y conflict terms + the nomenclature-table tail** - `28a024c` (feat)
3. **Task 3: Un-skip the nomenclature tripwire + phase gate** - `cbb0c61` (test)

**Plan metadata:** (this commit) - `docs(50-06): complete plan`

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx` - Glossary swept; reconciled two-check legend; WEEKLY_LOOP screen labels term-swapped via `WORKBENCH_NAV_LABELS`; House Rule 4 corrected
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/TestRunPanel.tsx` - "Rehearsal" -> "Test changes"; "Draft vs. live" -> "Compare results"; "Live"/"vs live" -> "Active"/"vs active"
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx` - "Make live"/"Making live..." -> "Make active"/"Making active..."; "LIVE" badge -> "Active"; "Commit anyway" -> "Make active anyway"; eval-gate placeholder -> failing-quality-test phrasing; "Run evals for v{N}" -> "Test changes for v{N}"
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/EvalDrawer.tsx` - "Eval scoreboard" -> "Quality test scoreboard"; "Run evals" -> "Test changes"; "golden scenarios" -> "standard test cases"; "for commit" -> "for activation"
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx` - "has not been seeded yet" -> "has no starting version yet" (extra live hit, constraint-flagged)
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptsListClient.tsx` - "never seeded" -> "no starting version"
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptMarkerExport.tsx` - "copy -> commit" export label -> "copy -> check into repo" (extra live hit, found only by simulating the tripwire)
- `apps/dispatch-control/app/(dashboard)/eval-center/page.tsx` - "Golden scenarios"/"golden-scenario cards"/"shadow run" -> "Standard test cases"/"standard test case cards"/"preview next run"
- `apps/dispatch-control/app/(dashboard)/eval-center/_components/{ScenarioCard,DriftScoreboard}.tsx` - "golden scenario(s)" -> "standard test case(s)"
- `apps/dispatch-control/app/(dashboard)/eval-center/_components/ShadowRunPanel.tsx` - "Shadow run" -> "Preview next run"; "Run shadow discovery" -> "Preview next run"
- `apps/dispatch-control/app/(dashboard)/signal-desk/_components/{SignalDeskScreen,DecisionPanel,AdjudicationPanel}.tsx` - "Gate 1" visible text/aria-labels -> "Story decision"/"choose the story"; `isPausedAtGate1`/`adjudicateGate1` code identifiers left unchanged
- `apps/dispatch-control/app/(dashboard)/registry/_components/CoverageStrip.tsx` - "Coverage memory" -> "Recent coverage"
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` - "Blocking items" -> "Must fix items"
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx` - "Blocking items" -> "Must fix items"
- `apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx` - two "Gate 1" mentions reworded (extra live hit, constraint-flagged)
- `apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx` - "sign-off gate" tooltip -> "sign-off" (extra live hit, found only by simulating the tripwire)
- `apps/dispatch-control/__tests__/nomenclature.test.ts` - un-skipped (`describe.skip` -> `describe`)
- `apps/dispatch-control/__tests__/how-to-use.test.ts` - screen-name assertions updated to match the renamed labels (Rule 1 fix)
- `apps/dispatch-control/__tests__/EvalDrawer.test.tsx` - button-name matchers updated from "run evals"/"run evals for v1" to "test changes"/"test changes for v1" (Rule 1 fix)
- `apps/dispatch-control/__tests__/DecisionRail.test.tsx` - "blocking items" text matchers updated to "must fix items" (Rule 1 fix)

## Decisions Made
- WEEKLY_LOOP screen labels sourced live from `WORKBENCH_NAV_LABELS` (via template literals for the Prompt Lab + Eval Center combined label) rather than re-typed verbatim strings, per D-06's "prefer referencing PRODUCT_TERMS/WORKBENCH_NAV_LABELS constants where the copy is dynamic."
- "Review Desk" -> "Fact Check" in the WEEKLY_LOOP screen label: confirmed via `StageStrip.tsx`'s `STAGE_LABELS` that "Fact Check" is the Issue Workspace's actual current stage name for the "Clear the facts" step's content (Review Desk itself left the nav in Phase 41 per `lib/nav.ts`'s header comment).
- Corrected the House Rule 4 "Publish...takes a typed confirmation" claim to match the already-implemented, already-tripwired D-15 fact (`publishNoTypedConfirm.test.ts` from Plan 50-03) rather than leaving stale, actively-wrong security-procedure documentation on the operator's own reference page — a Rule 1 bug fix, not scope creep, since the exact same sentence had to be touched anyway for the blocklist/auto-publish term swap.
- Left `source: 'commit'` (the stored `eval_scores` enum literal) byte-unchanged in both `VersionHistoryPanel.tsx` and `EvalDrawer.tsx` — D-14 requires the Phase 38 commit-gate/activate mutation wiring stay untouched; only the operator-facing labels around it were swept.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed how-to-use.test.ts's pre-existing screen-name assertions broken by the Task 1 rename**
- **Found during:** Task 1
- **Issue:** A pre-existing Phase-30 test (`how-to-use.test.ts`) hard-asserted the file contains the literal strings `'Run Monitor'`, `'Review Desk'`, and `'Prompt Lab + Eval Center'` — all three renamed by this plan's glossary sweep.
- **Fix:** Updated the assertions to check for the new source (`WORKBENCH_NAV_LABELS.run_monitor`, `'Fact Check'`, `WORKBENCH_NAV_LABELS.prompt_lab`/`WORKBENCH_NAV_LABELS.eval_center`) instead of the literal old strings.
- **Files modified:** `apps/dispatch-control/__tests__/how-to-use.test.ts`
- **Verification:** `pnpm --filter dispatch-control test -- --run how-to-use` — 19/19 passed.
- **Committed in:** `ca430d9` (Task 1 commit)

**2. [Rule 1 - Bug] Fixed EvalDrawer.test.tsx's pre-existing button-name matchers broken by the Task 2 "Run evals" -> "Test changes" rename**
- **Found during:** Task 2 full-suite verification
- **Issue:** `EvalDrawer.test.tsx` used `getByRole('button', { name: /run evals/i })` and `/run evals for v1/i` to drive its RTL interactions — both broken once the button text changed to "Test changes"/"Test changes for v1".
- **Fix:** Updated all four matchers (`/run evals/i` -> `/test changes/i`, `/run evals for v1/i` -> `/test changes for v1/i`, etc.) to the new text.
- **Files modified:** `apps/dispatch-control/__tests__/EvalDrawer.test.tsx`
- **Verification:** `pnpm --filter dispatch-control test -- --run EvalDrawer` — all passed.
- **Committed in:** `28a024c` (Task 2 commit)

**3. [Rule 1 - Bug] Fixed DecisionRail.test.tsx's pre-existing "blocking items" text matchers broken by the Task 2 "Blocking items" -> "Must fix items" rename**
- **Found during:** Task 2 full-suite verification (`pnpm --filter dispatch-control test -- --run` surfaced 2 failing tests)
- **Issue:** Two tests used `screen.getByText(/blocking items/i)` to locate the section — broken once the heading/aria-label changed to "Must fix items".
- **Fix:** Updated both matchers to `/must fix items/i`.
- **Files modified:** `apps/dispatch-control/__tests__/DecisionRail.test.tsx`
- **Verification:** `pnpm --filter dispatch-control test -- --run` — 126 files passed, 1024 tests passed.
- **Committed in:** `28a024c` (Task 2 commit)

**4. [Rule 2 - Missing critical] Swept two extra live hits outside the plan's enumerated file list, flagged by the plan's own critical_constraints**
- **Found during:** Task 2, pre-flight full-tree grep before touching files
- **Issue:** `AgentPromptEditorView.tsx:322` ("This prompt has not been seeded yet.") and `CreatePanel.tsx:123,134` (two "Gate 1" mentions) were explicitly called out in the executor prompt's constraints as live hits the plan's file-by-file task list would otherwise miss.
- **Fix:** Swept both to product vocabulary ("no starting version yet"; "choose the recommended story" / "the story decision").
- **Files modified:** `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx`, `apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx`
- **Verification:** Re-ran the tripwire-equivalent scan script — zero violations in both files.
- **Committed in:** `28a024c` (Task 2 commit)

**5. [Rule 2 - Missing critical] Swept two additional extra live hits found only by simulating the actual un-skipped tripwire against the whole tree**
- **Found during:** Task 3 pre-flight (before un-skipping, ran a Node script that reproduces `nomenclature.test.ts`'s exact FORBIDDEN_COPY_TERMS + JSX-candidate-extraction logic against `app/` + `components/`)
- **Issue:** `MyTasksScreen.tsx:210`'s `title="No single artifact anchors this sign-off gate..."` and `PromptMarkerExport.tsx:51`'s `".md export (copy → commit)"` both matched banned patterns (standalone "gate" and "commit") but were in neither the plan's file list nor the constraints' named extra hits — they would have failed the tripwire immediately on un-skip.
- **Fix:** Reworded both to gate-free/commit-free phrasing ("this sign-off — the inspector..."; "copy → check into repo").
- **Files modified:** `apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx`, `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/PromptMarkerExport.tsx`
- **Verification:** Re-ran the simulation script — 0 violations across the whole tree; then un-skipped `nomenclature.test.ts` for real and it passed first try.
- **Committed in:** `28a024c` (Task 2 commit, bundled since discovered before the Task 3 un-skip)

---

**Total deviations:** 5 auto-fixed (3 Rule 1 test-matcher fixes caused directly by this plan's own renames; 2 Rule 2 additive sweeps of copy the plan's file list and constraints didn't fully cover)
**Impact on plan:** All five were necessary to land a genuinely green, un-weakened tripwire and a passing full suite. No scope creep — every touched file is either in the plan's `files_modified` list, explicitly named in the executor's `critical_constraints`, or a pre-existing test whose own assertion this plan's copy change directly broke.

## Issues Encountered
- The automated tripwire's JSX-text-candidate regex (`>([^<>{}\n]+)</g`, applied per-line) has gaps relative to the plan's own grep-based acceptance criteria — e.g. it doesn't catch prose split across multiple JSX lines inside a `<>...</>` fragment (the how-to-use WEEKLY_LOOP body). Resolved by treating the plan's acceptance-criteria grep commands (full raw file content, not the narrower JSX-candidate extraction) as the real bar for "no legacy term survives," and doing the full sweep to that stricter standard rather than the minimum needed to pass the automated test alone.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- WBN-05 is closed: `nomenclature.test.ts` is un-skipped and green, `rename-preservation.test.ts` stays green (no route/enum was renamed to satisfy the sweep), the full `pnpm --filter dispatch-control test -- --run` suite passes (126 files, 1024 tests, 1 pre-existing skip, 2 pre-existing todos), `pnpm --filter dispatch-control build` exits 0, and the pipeline's `uv run pytest -x -q` stays green (698 passed, 38 skipped).
- This is the final plan (50-06) of Phase 50 (workbench-nomenclature) — all 6 WBN requirements (WBN-01..WBN-06) are now closed across the phase's plans. No blockers for phase completion / milestone verification.

---
*Phase: 50-workbench-nomenclature*
*Completed: 2026-07-17*

## Self-Check: PASSED
