---
phase: 40-issue-entity-issues-home
plan: 08
type: execute
wave: 4
depends_on: ["40-02", "40-04", "40-05"]
files_modified:
  - apps/dispatch-control/components/Masthead.tsx
  - apps/dispatch-control/__tests__/Masthead.test.tsx
  - apps/dispatch-control/lib/nav.ts
  - apps/dispatch-control/__tests__/nav.test.ts
autonomous: true
requirements: [ISS-05, ISS-02]

must_haves:
  truths:
    - "The global header shows four SEPARATE, never-blended readouts — issue status, system activity, My Tasks count, cost vs budget — each carrying a label + icon (never color alone)"
    - "Issue status is the DERIVED status (deriveIssueStatus); system activity is runs.latest.status; they are visibly distinct and never share a container"
    - "The My Tasks readout shows the COUNT from the derivedState task projection (Plan 40-04) and still opens the existing AwaitingYouInbox dropdown — no capability lost, no dead button"
    - "Auto-publish OFF reads 'Human approval required'; when ON the existing vermilion warning is unchanged"
    - "The nav is restructured into Editorial / System Workbench / Operations; Review Desk, Signal Desk, and Voice Pass leave the nav; Issues is the Editorial destination"
  artifacts:
    - path: "apps/dispatch-control/components/Masthead.tsx"
      provides: "four separate label+icon readouts replacing the single blended pipeline-state chip"
      contains: "My Tasks"
    - path: "apps/dispatch-control/lib/nav.ts"
      provides: "NAV_GROUPS: Editorial / System Workbench / Operations"
      contains: "System Workbench"
  key_links:
    - from: "apps/dispatch-control/components/Masthead.tsx"
      to: "apps/dispatch-control/lib/derivedState.ts"
      via: "deriveIssueStatus + deriveTasks(...).length for the issue-status and My Tasks readouts"
      pattern: "deriveIssueStatus|deriveTasks"
    - from: "apps/dispatch-control/components/Masthead.tsx My Tasks readout"
      to: "apps/dispatch-control/components/AwaitingYouInbox.tsx"
      via: "clicking the labeled readout opens the existing dropdown (D-25)"
      pattern: "AwaitingYouInbox"
---

<objective>
Rebuild the global header (ISS-05) into four separate, never-blended readouts and restructure the nav (ISS-02 / D-31). Today's masthead blends system activity with a generic "status" chip and has no issue status at all; this splits them into Issue status · System activity · My Tasks · Cost vs budget, each with label + icon. The "Awaiting you" button becomes the labeled `My Tasks · N` readout that still opens the existing inbox dropdown. The nav collapses into Editorial / System Workbench / Operations.

Purpose: The four state systems the design separates must never read as one blended chip; a run stops being the editorial nav object (Run Monitor moves under System Workbench). My Tasks is COUNT-ONLY here — the full projection screen is Phase 43.
Output: `Masthead.tsx` (rebuilt) + its test; `nav.ts` (restructured) + its test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/40-issue-entity-issues-home/40-UI-SPEC.md
@docs/API_CONTRACTS.md

<interfaces>
Derivation (Plan 40-04): `deriveIssueStatus(inputs): IssueStatus`, `deriveTasks(inputs): DerivedTask[]` (`.length` = My Tasks count). Do NOT build a task screen — count only (Phase 43 owns the screen).
Existing Convex queries the current Masthead already wires (keep them): `api.runs.latest`, `api.pipelineRuns.byRunId`, `api.runs.monthToDateCost`, `api.pipelineConfig.getAll`. Add (Plan 40-02): `api.issues.byIssueNumber` for the issue's `held`/`published`, and the per-run sign-off/claim/qa/pitch queries the derivation needs (same set the home page assembles).
Existing component to keep: `AwaitingYouInbox` (unchanged) + `DEFAULT_WORKSPACE_ID`.
`api.nav` n/a — nav is a static module (`lib/nav.ts`).
</interfaces>

<ui_contract>
State & Icon Contract (40-UI-SPEC) — lucide-react import names are exact; every readout renders LABEL + ICON, never color alone; the four readouts NEVER share a container/blend.
- Issue status: Draft `FileEdit` ink-soft · Needs review `AlertTriangle` marigold-text · Ready to publish `CheckCircle2` green · Published `BadgeCheck` green · Held `PauseCircle` vermilion · (unknown) `AlertTriangle` vermilion + `State unknown — refresh`.
- System activity (from runs.latest.status): Idle `Circle` faint · Running `Loader2` (SPIN) cobalt · Paused for you `PauseCircle` marigold-text · Failed `AlertTriangle` vermilion · Complete `CheckCircle2` green. `Loader2` spin is RESERVED to System Activity "Running" (the stage strip must never spin).
- My Tasks: count 0 → `ListChecks` ink-soft `My Tasks · 0`; count > 0 → `ListChecks` vermilion `My Tasks · {n}` (still rendered — no dead button, D-25).
- Cost vs budget: under cap `CircleDollarSign` ink-soft `${mtd} / ${cap}` (`font-mono`); at/over cap `CircleDollarSign` vermilion, same figure.
Header rename: `Auto-publish OFF` → `Human approval required` (quiet reassurance, D-26). When auto-publish is ON, the existing vermilion warning + `AutoPublishBanner` stay exactly as loud as today.
Chip padding uses the existing pixel-exact values (`px-[9px] py-[3px]` etc.); the masthead stays the 52px ink bar.
Nav (D-31): three groups — Editorial (Issues) · System Workbench (Run Monitor, Prompt Lab, Eval Center, Registry) · Operations (Config, Finance, Settings). Review Desk / Signal Desk / Voice Pass leave the nav. `NAV_PINNED` (How to use) stays. `AppSidebar.tsx` needs NO change — it renders whatever NAV_GROUPS contains.
</ui_contract>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restructure lib/nav.ts + extend nav.test.ts (ISS-02 / D-31)</name>

  <read_first>
    - apps/dispatch-control/lib/nav.ts (the current 3-group structure — Workflow / Craft & memory / Operations; the `NavGroup`/`NavItem` types and `NAV_PINNED` stay)
    - apps/dispatch-control/__tests__/nav.test.ts (the existing test — it asserts group labels/order + that every href maps to a real page on disk; you must UPDATE its expectations, not replace the file)
    - docs/API_CONTRACTS.md §40.9 (the exact three-group structure + which items move where)
  </read_first>

  <action>
Rewrite `NAV_GROUPS` in `apps/dispatch-control/lib/nav.ts` to exactly (§40.9):
```typescript
export const NAV_GROUPS: NavGroup[] = [
  { label: 'Editorial', items: [
    { label: 'Issues', href: '/issues' },
  ] },
  { label: 'System Workbench', items: [
    { label: 'Run Monitor', href: '/run-monitor' },
    { label: 'Prompt Lab', href: '/prompt-lab' },
    { label: 'Eval Center', href: '/eval-center' },
    { label: 'Registry', href: '/registry' },
  ] },
  { label: 'Operations', items: [
    { label: 'Config', href: '/config' },
    { label: 'Finance', href: '/finance' },
    { label: 'Settings', href: '/settings' },
  ] },
]
```
Keep `NAV_PINNED = { label: 'How to use', href: '/how-to-use' }` and the `NavItem`/`NavGroup` types. Update the file header comment: the three groups are Editorial / System Workbench / Operations; Review Desk / Signal Desk / Voice Pass are now issue sub-routes reachable from `/issues/[n]`; nomenclature renames (Run Monitor → Run Details, Registry → Editorial Memory) are Phase 50. Add a one-line note distinguishing the console `/issues` route tree from the pipeline's runId-keyed `/issues/{run_id}` endpoints (the naming trap).

Update `apps/dispatch-control/__tests__/nav.test.ts`:
- `EXPECTED_GROUP_LABELS = ['Editorial', 'System Workbench', 'Operations']`.
- Replace the "Review Desk is the first Workflow item" assertion with: the first item of Editorial is `Issues` → `/issues`.
- Add an assertion that NONE of the nav hrefs is `/review-desk`, `/signal-desk`, or `/voice-pass` (they left the nav).
- Keep the "every href maps to a real page file on disk" check (it now requires `/issues/page.tsx`, which Plan 40-05 created — this is why this plan depends on 40-05).
  </action>

  <verify>
    <automated>cd apps/dispatch-control && grep -q "System Workbench" lib/nav.ts && grep -q "label: 'Issues', href: '/issues'" lib/nav.ts && ! grep -q "/review-desk" lib/nav.ts && pnpm vitest run __tests__/nav.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `lib/nav.ts` `NAV_GROUPS` labels are exactly `Editorial`, `System Workbench`, `Operations` in order
    - Editorial's only item is `Issues` → `/issues`; Run Monitor is under System Workbench
    - `grep -c "review-desk\|signal-desk\|voice-pass" lib/nav.ts` returns 0
    - `__tests__/nav.test.ts` asserts the new group labels and the absence of the three removed items
    - `pnpm --filter dispatch-control test -- __tests__/nav.test.ts` exits 0
  </acceptance_criteria>

  <done>The nav is restructured into three groups with Issues as the Editorial destination; the three old desk items are gone; the nav test passes with the /issues page on disk.</done>
</task>

<task type="auto">
  <name>Task 2: Rebuild Masthead.tsx into four separate readouts + extend Masthead.test.tsx (ISS-05)</name>

  <read_first>
    - apps/dispatch-control/components/Masthead.tsx (the current implementation — KEEP the cost-vs-cap query wiring `runs.monthToDateCost` + `pipelineConfig` `monthly_cap_usd`; KEEP the `AwaitingYouInbox` mount + `relative` wrapper; the single blended status chip is what gets split)
    - apps/dispatch-control/__tests__/Masthead.test.tsx (the existing test — extend it; it uses a query-reference-dispatch mock, NOT a positional sequence; add the four new issue-status queries to the mock map)
    - apps/dispatch-control/lib/derivedState.ts (deriveIssueStatus + deriveTasks — the header computes issue status + the My Tasks count from these)
    - apps/dispatch-control/components/AwaitingYouInbox.tsx (unchanged — the My Tasks readout still opens it; the dropdown already derives its own list)
    - .planning/phases/40-issue-entity-issues-home/40-UI-SPEC.md (State & Icon Contract for all five icon/label sets + the "Human approval required" rename)
  </read_first>

  <action>
Rebuild `apps/dispatch-control/components/Masthead.tsx` so the single blended chip becomes FOUR separate, visually-distinct readouts, each in its own bordered/spaced node (never sharing a container), each rendering a lucide icon + a text label:

1. **Issue status** (NEW). Resolve the current in-progress issue the same way the home page does: the latest run (`runs.latest`) → its issueNumber (`pipelineRuns.byRunId`) → `issues.byIssueNumber` for `held`/`published`, plus `signOffs.activeByRunId` (+ the claim/qa/pitch queries deriveIssueStatus needs) for the current runId. Compute `deriveIssueStatus(inputs)` and render the icon+label per the Issue-status contract. When the status is `'unknown'`, render `AlertTriangle` (vermilion) + `State unknown — refresh` — never a stale value.
2. **System activity** (relabel of today's chip). From `runs.latest.status`, map to Idle/Running/Paused for you/Failed/Complete with the exact icons — `Loader2` (spin) ONLY for Running. This readout must be a visibly separate node from Issue status (do not put them in the same pill).
3. **My Tasks** (replaces `AwaitingYouTrigger`). Compute `deriveTasks(inputs).length` (COUNT only — Phase 43 builds the screen). Render a button reading `My Tasks · {n}` with `ListChecks` (vermilion when n>0, else ink-soft). Clicking it still toggles the existing `AwaitingYouInbox` dropdown (keep the `relative` wrapper + backdrop). No capability lost, no dead button.
4. **Cost vs budget** (keep wiring). `runs.monthToDateCost` + `pipelineConfig` `monthly_cap_usd` → `CircleDollarSign` + `${mtd} / ${cap}` (`font-mono`), vermilion at/over cap. Unchanged data path.
Plus: rename the auto-publish label — when `auto_publish` is falsey render `Human approval required` (quiet, not a switch); when truthy, keep today's vermilion `Auto-publish ON` treatment exactly (and the separate `AutoPublishBanner` in the layout is untouched).

Extend `apps/dispatch-control/__tests__/Masthead.test.tsx`:
- Add the new query refs to the mock map (`issues:byIssueNumber`, `signOffs:activeByRunId`, `claimChecks:allSignedOff`, `qaCorrections:byRunId`, `pitchLog:byRunId` as needed).
- Assert all FOUR readouts render as distinct nodes: issue-status label present, system-activity label present, a `My Tasks · N` label present, and the `${mtd} / ${cap}` cost present — and that issue status and system activity are NOT the same element (query each by its distinct label/text).
- Assert each readout carries an icon (e.g. an svg/lucide element) alongside its label — never color alone.
- Assert `Human approval required` renders when `auto_publish` is false, and the vermilion `Auto-publish ON`-style treatment renders when true.
- Assert the ISS-06 header case: when the issue-status inputs are unresolved/failed (deriveIssueStatus → 'unknown'), the header shows `State unknown — refresh`, not a stale `Ready`.
  </action>

  <verify>
    <automated>cd apps/dispatch-control && grep -q "deriveIssueStatus" components/Masthead.tsx && grep -q "deriveTasks" components/Masthead.tsx && grep -q "My Tasks" components/Masthead.tsx && grep -q "Human approval required" components/Masthead.tsx && grep -q "AwaitingYouInbox" components/Masthead.tsx && pnpm vitest run __tests__/Masthead.test.tsx
</automated>
  </verify>

  <acceptance_criteria>
    - `components/Masthead.tsx` renders four distinct readouts: issue status (deriveIssueStatus), system activity (runs.latest.status), `My Tasks · {n}` (deriveTasks length), and cost vs budget — never blended into one chip
    - `grep -q "deriveIssueStatus" components/Masthead.tsx` and `grep -q "deriveTasks" components/Masthead.tsx` both succeed
    - `Loader2` appears only in the System Activity "Running" branch (`grep -c "Loader2" components/Masthead.tsx` and it is not used for any other readout)
    - The My Tasks readout still opens `AwaitingYouInbox` (the dropdown mount + `relative` wrapper are preserved)
    - `grep -q "Human approval required" components/Masthead.tsx` succeeds; the ON case keeps the vermilion `Auto-publish ON` treatment
    - The cost-vs-cap query wiring (`runs.monthToDateCost` + `pipelineConfig` `monthly_cap_usd`) is unchanged
    - `__tests__/Masthead.test.tsx` asserts four distinct readouts each with a label + icon, the `Human approval required` rename, and the ISS-06 `State unknown — refresh` header case
    - `pnpm --filter dispatch-control test -- __tests__/Masthead.test.tsx` exits 0
  </acceptance_criteria>

  <done>The global header shows four separate, never-blended, label+icon readouts; My Tasks is count-only and still opens the inbox; the auto-publish-OFF copy reads "Human approval required".</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- __tests__/nav.test.ts __tests__/Masthead.test.tsx` both GREEN.
- `pnpm --filter dispatch-control exec tsc --noEmit` exits 0.
- Manual (deferred to 40-09 build gate, greyscale check): all four header readouts remain distinguishable by label + icon with color removed (ISS-05 manual verification in 40-VALIDATION.md).
</verification>

<success_criteria>
- ISS-05: the header separates issue status, system activity, My Tasks count, and cost vs budget into four never-blended readouts, each with label + icon.
- ISS-02: the nav is restructured into Editorial / System Workbench / Operations with Run Monitor demoted to the Workbench and the three desks removed from the nav.
- My Tasks is count-only (Phase 43 owns the screen); no capability is lost and no dead button ships.
</success_criteria>

<output>
After completion, create `.planning/phases/40-issue-entity-issues-home/40-08-SUMMARY.md`.
</output>
