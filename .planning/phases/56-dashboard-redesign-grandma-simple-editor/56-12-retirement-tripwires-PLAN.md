---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 12
type: execute
wave: 4
depends_on: [56-05, 56-06, 56-07, 56-08, 56-09, 56-10, 56-10b, 56-11, 56-11b]
files_modified:
  - apps/dispatch-control/app/(editorial)/_components/HeldIssueRow.tsx
  - apps/dispatch-control/components/CommandPalette.tsx
  - apps/dispatch-control/components/StopRunButton.tsx
  - apps/dispatch-control/app/admin/runs/_components/RunDetail.tsx
  - apps/dispatch-control/app/admin/runs/_components/RecoveryRail.tsx
  - apps/dispatch-control/app/admin/runs/_components/RerollButton.tsx
  - apps/dispatch-control/app/(editorial)/layout.tsx
  - apps/dispatch-control/app/admin/layout.tsx
  - apps/dispatch-control/lib/homeSections.ts
  - apps/dispatch-control/__tests__/homeSections.test.ts
  - apps/dispatch-control/__tests__/RecoveryRail.test.tsx
  - apps/dispatch-control/__tests__/runDetailActionNames.test.ts
  - apps/dispatch-control/__tests__/runControl.test.tsx
  - apps/dispatch-control/__tests__/editorCopy.test.tsx
  - apps/dispatch-control/__tests__/editorStyle.test.ts
  - apps/dispatch-control/__tests__/editorRetirement.test.ts
autonomous: true
requirements: [P56-B5, P56-A3, P56-A4]

must_haves:
  truths:
    - "Every retired component is deleted, and a test fails if any of them comes back or is imported again (Phase 34 lesson)"
    - "Rendering all seven screens with fixture data shows no banned word, no run id, no raw error outside Technical details, exactly one h1, and at most one [data-primary]"
    - "No editor file uses font-mono, uppercase, tracking-, or text below 15px (the Behind-Run technical <pre> is the one exception)"
    - "Strict build and the full vitest suite pass with zero failures"
  artifacts:
    - path: "apps/dispatch-control/__tests__/editorRetirement.test.ts"
      provides: "Retirement tripwire"
    - path: "apps/dispatch-control/__tests__/editorCopy.test.tsx"
      provides: "Render-level copy/one-primary scan over the 7 screens"
    - path: "apps/dispatch-control/__tests__/editorStyle.test.ts"
      provides: "Source-level style scan"
  key_links:
    - from: "editorCopy.test.tsx"
      to: "lib/editorState.ts"
      via: "EDITOR_BANNED_PATTERN + RUN_ID_PATTERN"
      pattern: "EDITOR_BANNED_PATTERN"
---

<objective>
Finish the retirement half as a first-class deliverable: delete every leftover old component, drop dead copy constants, unmount the inspector if nothing uses it, and add the three tripwire tests. Then run the strict build and the full suite.

Purpose: Success criteria 3 and 4; memory `phase34-retirement-half-done` (a past phase shipped the new surface and left the old one live for 9 days).
Output: deletions + 3 tripwire tests + green build/suite.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-RESEARCH.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-VALIDATION.md
@apps/dispatch-control/lib/editorState.ts
@apps/dispatch-control/__tests__/helpers/jargonScan.ts

<interfaces>
Views available for render scans (props-only): IssueHomeView (56-05), ArchiveBody (56-07), BehindHubView (56-08), BehindRunView (56-09). Section: render `app/(editorial)/s/[section]/page.tsx` with the mock setup from __tests__/SectionReaderPage.test.tsx (56-06). Fixture builders: use real `deriveEditorHome`, `homeSlabCopy`, `deriveArchiveRows`, `deriveBehindSteps` outputs.
`EDITOR_BANNED_PATTERN`, `RUN_ID_PATTERN` from lib/editorState.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Delete leftovers, drop dead copy, unmount unused providers</name>
  <files>apps/dispatch-control/app/(editorial)/_components/HeldIssueRow.tsx, apps/dispatch-control/components/CommandPalette.tsx, apps/dispatch-control/components/StopRunButton.tsx, apps/dispatch-control/app/admin/runs/_components/RunDetail.tsx, apps/dispatch-control/app/admin/runs/_components/RecoveryRail.tsx, apps/dispatch-control/app/admin/runs/_components/RerollButton.tsx, apps/dispatch-control/app/(editorial)/layout.tsx, apps/dispatch-control/app/admin/layout.tsx, apps/dispatch-control/lib/homeSections.ts, apps/dispatch-control/__tests__/homeSections.test.ts, apps/dispatch-control/__tests__/RecoveryRail.test.tsx, apps/dispatch-control/__tests__/runDetailActionNames.test.ts, apps/dispatch-control/__tests__/runControl.test.tsx</files>
  <read_first>
    - `grep -rn "HeldIssueRow\|CommandPalette\|StopRunButton\|RunDetail\|RecoveryRail\|RerollButton\|useInspector\|RUNNING_SENTENCE\|READY_SENTENCE\|NONE_SENTENCE\|FAILED_SENTENCE\|GATE1_SENTENCE\|STOPPED_SENTENCE\|rowNote" apps/dispatch-control/app apps/dispatch-control/components apps/dispatch-control/lib apps/dispatch-control/__tests__`
    - 56-RESEARCH.md § Retirement Inventory
  </read_first>
  <action>
1. Confirm (grep above) nothing outside the files being deleted imports them; if something unexpected still imports one, STOP and report it rather than editing a file another plan owns.
2. `git rm` HeldIssueRow.tsx, components/CommandPalette.tsx, components/StopRunButton.tsx, RunDetail.tsx, RecoveryRail.tsx, RerollButton.tsx, __tests__/RecoveryRail.test.tsx, __tests__/runDetailActionNames.test.ts.
3. `__tests__/runControl.test.tsx`: delete the RerollButton import and its `describe('RerollButton', …)` block only.
4. `lib/homeSections.ts`: delete RUNNING_SENTENCE, READY_SENTENCE, NONE_SENTENCE, FAILED_SENTENCE, GATE1_SENTENCE, STOPPED_SENTENCE and `rowNote` (no remaining importers); update the `SECTION_DESCRIPTORS` values to plain words: deliberation-conversation 'How the writers chose this charity', podcast "This week's episode", theme 'Colours and fonts for this issue'. Keep `deriveHomeSections`/`deriveHomeFooter` byte-identical. In `__tests__/homeSections.test.ts` delete the 'rowNote copy' and 'copy constants' cases and update the descriptor expectation.
5. Layouts: if `grep -rn "useInspector" apps/dispatch-control/app` returns nothing, remove `InspectorProvider` from both layouts (keep ConfirmProvider + EditorShell); otherwise leave it and record why in SUMMARY.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/homeSections.test.ts __tests__/runControl.test.tsx && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn "HeldIssueRow\|CommandPalette\|StopRunButton\|RecoveryRail\|RerollButton\|_components/RunDetail" apps/dispatch-control/app apps/dispatch-control/components apps/dispatch-control/lib apps/dispatch-control/__tests__ | grep -v editorRetirement` returns nothing
    - `grep -n "_SENTENCE\|rowNote" apps/dispatch-control/lib/homeSections.ts` returns nothing
    - strict build exits 0
  </acceptance_criteria>
  <done>No retired component exists or is imported.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Tripwires — editorRetirement, editorStyle, editorCopy</name>
  <files>apps/dispatch-control/__tests__/editorRetirement.test.ts, apps/dispatch-control/__tests__/editorStyle.test.ts, apps/dispatch-control/__tests__/editorCopy.test.tsx</files>
  <read_first>
    - 56-VALIDATION.md per-requirement map (P56-A3, P56-B5)
    - __tests__/SectionReaderPage.test.tsx mock setup (to render the Section page)
    - 56-UI-SPEC.md § Typography (allowed sizes 15/17/18/23/26/32/42/48; 14px only in the technical pre)
  </read_first>
  <behavior>
    - editorRetirement: each of PublishFooter.tsx, StoryRow.tsx, StartIssueButton.tsx, HoldDialog.tsx, HoldControl.tsx, HeldIssueRow.tsx, EarlierIssueBanner.tsx, InPlaceBlockEditor.tsx, components/CommandPalette.tsx, components/StopRunButton.tsx, RunDetail.tsx, RecoveryRail.tsx, RerollButton.tsx does NOT exist; no file under app/ or components/ contains the import specifiers of any of them; app/admin/layout.tsx and components/editor/EditorShell.tsx contain no '>Admin<' text and no 'UserButton'; lib/nav.ts has no `label: 'Admin'`; no file under app/ contains the strings 'Restart from this step', 'Improve this agent', 'Trigger Run', 'Run Detail'
    - editorStyle: for every file under components/editor/, app/(editorial)/, app/admin/page.tsx, app/admin/_components/, app/admin/runs/_components/BehindRun*.tsx, app/admin/layout.tsx: no `font-mono`, no `uppercase`, no `tracking-[`, no `textTransform`, no `text-[Npx]` with N outside {15,17,18,23,26,32,42,48} — except exactly one `text-[14px]` in BehindRunView.tsx on the line that also contains `font-[monospace]`; no `bg-[color:var(--color-paper)]`
    - editorCopy: render each screen state — Home (ready, writing, held, published, empty, problem, stopped, stuck, ready-collab, loading), Section (founderBio, game, published), Archive (with rows, empty), Behind, Behind-Run (problem, paused, stuck) — and for each: text outside `pre` fails EDITOR_BANNED_PATTERN and RUN_ID_PATTERN and contains no 'Interrupt('; `querySelectorAll('h1').length === 1`; `querySelectorAll('[data-primary]').length <= 1`; no `[disabled]` element
  </behavior>
  <action>
Write the three tests (`import { describe, it, expect } from 'vitest'`; .ts tests run in node env, .tsx in jsdom). editorStyle walks directories with `fs.readdirSync` recursively (only .tsx/.ts, skip none). editorCopy uses fixture run ids like 'a1b2c3d4e5f6a7b8' so RUN_ID_PATTERN is meaningful, and charity names without banned words (e.g. 'Kumasi Roofless Schools Trust'). To read text outside `pre`: clone `container`, remove all `pre` elements, use `textContent`. If a tripwire fails, fix the offending UI string in the file that renders it ONLY if that file is in this plan's files_modified; otherwise record the failure in the SUMMARY and fix it via a follow-up commit referencing the owning plan (wave 3 is complete at this point, so editing those files is safe — list each edited file in the SUMMARY).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/editorRetirement.test.ts __tests__/editorStyle.test.ts __tests__/editorCopy.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - the three files exist; `grep -n "EDITOR_BANNED_PATTERN" apps/dispatch-control/__tests__/editorCopy.test.tsx` matches; `grep -n "data-primary" apps/dispatch-control/__tests__/editorCopy.test.tsx` matches
    - all three pass
  </acceptance_criteria>
  <done>Retirement, style and copy rules are enforced by tests.</done>
</task>

<task type="auto">
  <name>Task 3: Phase gate — strict build + full suite</name>
  <files>apps/dispatch-control/__tests__/editorRetirement.test.ts</files>
  <read_first>
    - .planning/phases/56-dashboard-redesign-grandma-simple-editor/56-PREFLIGHT.md (baseline counts)
  </read_first>
  <action>
Run `pnpm --filter dispatch-control build` then `pnpm --filter dispatch-control test`. Both must exit 0 with zero failing tests (the baseline SectionReaderPage failure was replaced in 56-06). Also read the start hash: `START=$(sed -n 's/^Phase start commit: \([0-9a-f]\{40\}\)$/\1/p' .planning/phases/56-dashboard-redesign-grandma-simple-editor/56-PREFLIGHT.md)` (fail loudly if empty), then confirm `git diff --name-only "$START"..HEAD -- convex/ packages/pipeline/` is empty (backend kept; if not empty, run `pnpm --filter @eisenbalm/convex dev:once` and record it). Record final counts (files/tests) in the SUMMARY. If anything fails, fix it (any file) and re-run; list each fix.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control build && pnpm --filter dispatch-control test</automated>
  </verify>
  <acceptance_criteria>
    - build exits 0
    - `git diff --name-only "$START"..HEAD -- convex/ packages/pipeline/` printed nothing (or the dev:once sync is recorded)
    - vitest summary shows `0 failed` (no "failed" count above zero)
  </acceptance_criteria>
  <done>Success criterion 4 met.</done>
</task>

</tasks>

<verification>
Strict build + full suite green; three tripwires green.
</verification>

<success_criteria>
P56-B5, P56-A3 and P56-A4 proven automatically.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-12-SUMMARY.md` with final suite counts.
</output>
