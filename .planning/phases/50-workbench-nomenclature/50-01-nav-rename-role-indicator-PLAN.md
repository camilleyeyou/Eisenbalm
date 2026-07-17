---
phase: 50-workbench-nomenclature
plan: 01
type: execute
wave: 1
depends_on: ["50-00"]
files_modified:
  - apps/dispatch-control/lib/nav.ts
  - apps/dispatch-control/components/AppSidebar.tsx
  - apps/dispatch-control/app/(dashboard)/prompt-lab/page.tsx
  - apps/dispatch-control/app/(dashboard)/registry/page.tsx
  - apps/dispatch-control/app/(dashboard)/eval-center/page.tsx
  - apps/dispatch-control/__tests__/nav.test.ts
autonomous: true
requirements: [WBN-01]

must_haves:
  truths:
    - "The nav shows two visibly distinct groups: Editorial and System Workbench"
    - "The four System Workbench items read Run Details, Agent Instructions, Quality Tests, Editorial Memory"
    - "Each renamed screen's page heading matches its new nav label"
    - "The signed-in role (Editor-in-chief / Collaborator) is shown bottom-left of the sidebar"
    - "Route hrefs (/run-monitor, /prompt-lab, /eval-center, /registry) are unchanged"
  artifacts:
    - path: "apps/dispatch-control/lib/nav.ts"
      provides: "renamed System Workbench nav labels over unchanged hrefs"
      contains: "Run Details"
    - path: "apps/dispatch-control/components/AppSidebar.tsx"
      provides: "role indicator rendered bottom-left"
      contains: "useRole"
  key_links:
    - from: "apps/dispatch-control/components/AppSidebar.tsx"
      to: "apps/dispatch-control/lib/role.ts"
      via: "useRole() presentation-only role label"
      pattern: "useRole"
    - from: "apps/dispatch-control/lib/nav.ts"
      to: "apps/dispatch-control/lib/nomenclature.ts"
      via: "WORKBENCH_NAV_LABELS constants (or verbatim strings matching them)"
      pattern: "Run Details|Agent Instructions|Quality Tests|Editorial Memory"
---

<objective>
WBN-01. Rename the four System Workbench nav items + their screen headings to the v3 names, keep the existing two-group structure visibly distinct, and add the net-new signed-in role indicator bottom-left of the sidebar.

Purpose: The Editorial / System Workbench grouping already exists (D-04); this is a display-label rename over unchanged routes plus the presentation-only role indicator (D-05) sourced from Phase 49's `useRole()`. Role has never been shown as text before — this is the only net-new UI here.
Output: Renamed nav + headings, a role indicator, and a green nav test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/50-workbench-nomenclature/50-CONTEXT.md
@docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md
@docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md
@apps/dispatch-control/lib/nav.ts
@apps/dispatch-control/lib/role.ts
@apps/dispatch-control/components/AppSidebar.tsx
@apps/dispatch-control/lib/nomenclature.ts
@apps/dispatch-control/__tests__/nav.test.ts

<interfaces>
<!-- lib/role.ts (Phase 49) — presentation-only role hook. Returns undefined while Clerk loads. -->
export type Role = 'Editor-in-chief' | 'Collaborator'
export function useRole(): Role | undefined       // undefined = still loading; do NOT treat as Collaborator
export function useIsEditor(): boolean

<!-- lib/nomenclature.ts (50-00) -->
export const WORKBENCH_NAV_LABELS = { run_monitor: 'Run Details', prompt_lab: 'Agent Instructions', eval_center: 'Quality Tests', registry: 'Editorial Memory' }

<!-- Nav rename map (label ONLY — hrefs stay per D-02) -->
  { label: 'Run Monitor',  href: '/run-monitor' } → { label: 'Run Details',       href: '/run-monitor' }
  { label: 'Prompt Lab',   href: '/prompt-lab'  } → { label: 'Agent Instructions', href: '/prompt-lab'  }
  { label: 'Eval Center',  href: '/eval-center' } → { label: 'Quality Tests',      href: '/eval-center' }
  { label: 'Registry',     href: '/registry'    } → { label: 'Editorial Memory',   href: '/registry'    }

<!-- Page heading renames (single <h1>) -->
  prompt-lab/page.tsx:51  <h1>Prompts</h1>          → <h1>Agent Instructions</h1>
  registry/page.tsx:23    <h1>Charity Registry</h1> → <h1>Editorial Memory</h1>
  eval-center/page.tsx:61 "Eval Center"             → "Quality Tests"
  run-monitor/runs/_components/RunDetail.tsx already renders "Run Details" — no change here.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rename the four System Workbench nav labels + the three page headings</name>
  <files>apps/dispatch-control/lib/nav.ts, apps/dispatch-control/app/(dashboard)/prompt-lab/page.tsx, apps/dispatch-control/app/(dashboard)/registry/page.tsx, apps/dispatch-control/app/(dashboard)/eval-center/page.tsx</files>
  <read_first>
    - apps/dispatch-control/lib/nav.ts (NAV_GROUPS — the four items to rename; do NOT touch hrefs)
    - apps/dispatch-control/lib/nomenclature.ts (WORKBENCH_NAV_LABELS — use these constants)
    - apps/dispatch-control/app/(dashboard)/prompt-lab/page.tsx (line ~51 heading)
    - apps/dispatch-control/app/(dashboard)/registry/page.tsx (line ~23 heading)
    - apps/dispatch-control/app/(dashboard)/eval-center/page.tsx (line ~61 heading)
    - docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md §Nav (two-group contract)
  </read_first>
  <action>
    In `lib/nav.ts` NAV_GROUPS "System Workbench" group, change the four `label`s ONLY (hrefs unchanged), preferably referencing `WORKBENCH_NAV_LABELS` from `lib/nomenclature.ts` (import it) so the label source stays single:
      'Run Monitor' → 'Run Details'
      'Prompt Lab'  → 'Agent Instructions'
      'Eval Center' → 'Quality Tests'
      'Registry'    → 'Editorial Memory'
    Update the nav.ts header comment that says "the nomenclature pass … is Phase 50, not this plan" to note the rename has now landed. Leave the Editorial group (Issues, Issue Workspace, My Tasks) and Operations group unchanged. Keep the two groups visibly distinct (they already render as separate labeled groups in AppSidebar — do not merge).
    Then rename the three page headings to match:
      prompt-lab/page.tsx: `<h1 …>Prompts</h1>` → `Agent Instructions`
      registry/page.tsx:   `<h1 …>Charity Registry</h1>` → `Editorial Memory`
      eval-center/page.tsx: heading `Eval Center` → `Quality Tests`
    Do NOT touch route folder names, hrefs, or any deeper body copy on those pages (the sweep plan 50-06 owns remaining copy). RunDetail.tsx already says "Run Details" — leave it.
  </action>
  <acceptance_criteria>
    - `grep -n "Run Monitor\|Prompt Lab\|Eval Center\|'Registry'" apps/dispatch-control/lib/nav.ts` returns NO nav-label hits (only possibly comments referencing the old names historically).
    - `grep -n "Run Details\|Agent Instructions\|Quality Tests\|Editorial Memory" apps/dispatch-control/lib/nav.ts` shows all four new labels.
    - `grep -rn "href: '/run-monitor'\|href: '/prompt-lab'\|href: '/eval-center'\|href: '/registry'" apps/dispatch-control/lib/nav.ts` shows all four hrefs UNCHANGED.
    - The three page headings render the new text: `grep -n "Agent Instructions" prompt-lab/page.tsx`, `grep -n "Editorial Memory" registry/page.tsx`, `grep -n "Quality Tests" eval-center/page.tsx` each hit.
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control test -- --run nav</automated></verify>
  <done>The four Workbench nav labels + three page headings read the v3 names; all four hrefs are unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: Add the signed-in role indicator bottom-left + extend nav.test</name>
  <files>apps/dispatch-control/components/AppSidebar.tsx, apps/dispatch-control/__tests__/nav.test.ts</files>
  <read_first>
    - apps/dispatch-control/components/AppSidebar.tsx (the nav mount point; where the groups render)
    - apps/dispatch-control/lib/role.ts (useRole — returns undefined while loading; do NOT flash Collaborator)
    - apps/dispatch-control/components/LockedControl.tsx (Phase 49 presentation-only pattern reference)
    - docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md §Nav ("Role indicator bottom-left") and DERIVED-STATE §6 (role labels)
    - apps/dispatch-control/__tests__/nav.test.ts (the fixture to extend)
  </read_first>
  <action>
    In `AppSidebar.tsx`, render a role indicator at the BOTTOM-LEFT of the sidebar (below the nav groups / near the pinned "How to use", per §Nav). Use `useRole()` from `lib/role.ts`:
      - When role resolves to 'Editor-in-chief' or 'Collaborator', show a small label e.g. `Signed in as Editor-in-chief` / `Signed in as Collaborator` (plain text, 1c-system styling consistent with the sidebar; label + role, no color-only signal).
      - While `useRole()` returns `undefined` (Clerk still loading), render nothing or a neutral placeholder — do NOT default to "Collaborator" (would flash a wrong role for an editor mid-load).
      - Presentation-only: add a short comment noting the server remains the authoritative gate (mirrors lib/role.ts's own doc). If AppSidebar is a server component, add a small `'use client'` child component for the role readout rather than converting the whole file — follow whatever the existing file already is.
    Extend `apps/dispatch-control/__tests__/nav.test.ts`:
      - Assert NAV_GROUPS contains two distinct groups labeled 'Editorial' and 'System Workbench'.
      - Assert the System Workbench group items' labels are exactly ['Run Details','Agent Instructions','Quality Tests','Editorial Memory'] and their hrefs are exactly ['/run-monitor','/prompt-lab','/eval-center','/registry'] (rename-without-reroute).
      - Assert none of the old labels ('Run Monitor','Prompt Lab','Eval Center','Registry') appear as a nav item label.
      - Add a render test (or a DOM/component test if AppSidebar is testable) that the role indicator shows the role text when `useRole` is mocked to 'Editor-in-chief' and renders nothing when mocked `undefined`. If AppSidebar can't be mounted in vitest cheaply, cover the role readout via its extracted client child component instead.
  </action>
  <acceptance_criteria>
    - `grep -n "useRole" apps/dispatch-control/components/AppSidebar.tsx` (or the extracted role-readout child) shows the hook usage.
    - `pnpm --filter dispatch-control test -- --run nav` passes with the two-group + four-renamed-label + hrefs-unchanged + role-indicator assertions.
    - `pnpm --filter dispatch-control build` exits 0.
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control test -- --run nav && pnpm --filter dispatch-control build</automated></verify>
  <done>The sidebar shows the signed-in role bottom-left (never flashing a wrong role mid-load); nav.test asserts two distinct groups + the four renamed labels over unchanged hrefs + the role indicator.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- --run nav` green.
- `pnpm --filter dispatch-control build` exits 0 (CLAUDE.md strict gate — vitest does not type-check).
- rename-preservation tripwire (50-00) stays green (routes unchanged).
</verification>

<success_criteria>
- Two visibly distinct nav groups (Editorial / System Workbench) with the four Workbench items renamed to Run Details / Agent Instructions / Quality Tests / Editorial Memory over unchanged hrefs.
- Screen headings match the new nav labels.
- Signed-in role shown bottom-left of the sidebar, presentation-only.
</success_criteria>

<output>
After completion, create `.planning/phases/50-workbench-nomenclature/50-01-SUMMARY.md`.
</output>
