---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 05
type: execute
wave: 3
depends_on: ["30-01", "30-02"]
files_modified:
  - apps/dispatch-control/lib/nav.ts
  - apps/dispatch-control/components/AppSidebar.tsx
  - apps/dispatch-control/__tests__/nav.test.ts
autonomous: true
requirements: [CHR-03]
must_haves:
  truths:
    - "The left nav is workflow-ordered in three labeled groups (Workflow / Craft & memory / Operations) with How-to-use pinned at the bottom"
    - "Every nav href resolves to a real page on disk (no dead links)"
    - "The nav renders in the 1c skin: 210px, #e3e5e8, active item = ink bg + 3px vermilion left border"
  artifacts:
    - path: "apps/dispatch-control/lib/nav.ts"
      provides: "Grouped NAV_GROUPS shape (3 groups) + How-to-use pinned item"
      contains: "Review Desk"
    - path: "apps/dispatch-control/components/AppSidebar.tsx"
      provides: "1c grouped sidebar rendering NAV_GROUPS with the dc.html active-state formula"
    - path: "apps/dispatch-control/__tests__/nav.test.ts"
      provides: "Rewritten coverage gate walking all groups + How-to-use, asserting each href has a page.tsx"
  key_links:
    - from: "apps/dispatch-control/components/AppSidebar.tsx"
      to: "apps/dispatch-control/lib/nav.ts"
      via: "imports grouped NAV structure and maps to Link elements with usePathname active state"
      pattern: "NAV_"
---

<objective>
Rewrite the left nav to the dc.html spec (D-01, D-06): three labeled groups — Workflow (Review Desk · Signal Desk · Run Monitor · Voice Pass), Craft & memory (Prompt Lab · Eval Center · Registry), Operations (Config · Finance · Settings) — with "How to use" pinned at the bottom. Rebuild `AppSidebar.tsx` to the 1c chrome (210px `#e3e5e8`, active = ink bg + 3px vermilion left border) and rewrite the `nav.test.ts` coverage gate in the same commit (RESEARCH Pitfall 4 — the flat 7-item assertion must not be left stale).

Purpose: CHR-03 nav; the grouped shape supersedes Phase 21's flat array + Graph-home.
Output: grouped `lib/nav.ts`; rewritten `AppSidebar.tsx`; rewritten `nav.test.ts` that walks every route across all groups + How-to-use and asserts a real page.tsx exists.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-RESEARCH.md
@apps/dispatch-control/lib/nav.ts
@apps/dispatch-control/components/AppSidebar.tsx
@apps/dispatch-control/__tests__/nav.test.ts
</context>

<interfaces>
<!-- Final route set (created in Plan 30-02) each group item links to:
  Workflow:      /review-desk · /signal-desk · /run-monitor · /voice-pass
  Craft & memory:/prompt-lab · /eval-center · /registry
  Operations:    /config · /finance · /settings
  Pinned bottom: /how-to-use
  run-monitor is active for /run-monitor and any /run-monitor/* subpath.
-->
<!-- Nav item style formula (RESEARCH Code Examples, verbatim from dc.html):
  padding 8px 16px; gap 11px; Space Grotesk 12.5px; letter-spacing .01em;
  font-weight 600 (active) | 500 (inactive);
  border-left 3px solid #e8471d (active) | transparent (inactive);
  background #17140e (active) | transparent; color #f4f2ec (active) | #4a453b (inactive).
  Group label: Space Grotesk 9px; letter-spacing .14em; uppercase; color #8b8778. -->
-->
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Grouped NAV structure in lib/nav.ts + rewritten nav.test.ts</name>
  <read_first>
    - apps/dispatch-control/lib/nav.ts (current flat NAV_ITEMS shape being replaced)
    - apps/dispatch-control/__tests__/nav.test.ts (current flat-array coverage gate — must be rewritten here, not left stale — Pitfall 4)
  </read_first>
  <files>apps/dispatch-control/lib/nav.ts, apps/dispatch-control/__tests__/nav.test.ts</files>
  <action>
    Replace the flat `NAV_ITEMS` export with a grouped structure. Define `interface NavItem { label: string; href: string }` and `interface NavGroup { label: string; items: NavItem[] }`, then export:
    ```ts
    export const NAV_GROUPS: NavGroup[] = [
      { label: 'Workflow', items: [
        { label: 'Review Desk', href: '/review-desk' },
        { label: 'Signal Desk', href: '/signal-desk' },
        { label: 'Run Monitor', href: '/run-monitor' },
        { label: 'Voice Pass',  href: '/voice-pass' },
      ]},
      { label: 'Craft & memory', items: [
        { label: 'Prompt Lab',  href: '/prompt-lab' },
        { label: 'Eval Center', href: '/eval-center' },
        { label: 'Registry',    href: '/registry' },
      ]},
      { label: 'Operations', items: [
        { label: 'Config',   href: '/config' },
        { label: 'Finance',  href: '/finance' },
        { label: 'Settings', href: '/settings' },
      ]},
    ]
    export const NAV_PINNED: NavItem = { label: 'How to use', href: '/how-to-use' }
    ```
    Drop the lucide icon imports (dc.html spec uses no icons — RESEARCH Don't-Hand-Roll). Rewrite `__tests__/nav.test.ts` to (1) assert the 3 group labels in order (Workflow, Craft & memory, Operations), (2) assert the Workflow group's first item is Review Desk `/review-desk` (Review Desk is home, D-04), and (3) walk EVERY item across all 3 groups PLUS NAV_PINNED and assert `app/(dashboard){href}/page.tsx` exists on disk (preserving the no-dead-links value). Note `/run-monitor` maps to `app/(dashboard)/run-monitor/page.tsx` (the tab shell from 30-02).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- --run nav</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "NAV_GROUPS" apps/dispatch-control/lib/nav.ts` and `grep -q "NAV_PINNED" apps/dispatch-control/lib/nav.ts`
    - `grep -q "Review Desk" apps/dispatch-control/lib/nav.ts` and `grep -q "Craft & memory" apps/dispatch-control/lib/nav.ts`
    - `grep -q "How to use" apps/dispatch-control/lib/nav.ts`
    - nav.test.ts no longer asserts `toHaveLength(7)` on a flat array; it walks groups + pinned and checks page.tsx existence
    - `pnpm --filter dispatch-control test -- --run nav` green (every href resolves to a page created in 30-02)
  </acceptance_criteria>
  <done>Grouped nav structure + rewritten coverage gate; all hrefs resolve; test green.</done>
</task>

<task type="auto">
  <name>Task 2: Rebuild AppSidebar.tsx to the 1c grouped chrome</name>
  <read_first>
    - apps/dispatch-control/components/AppSidebar.tsx (current flat sidebar — usePathname + UserButton patterns to keep)
    - apps/dispatch-control/lib/nav.ts (grouped structure from Task 1)
    - .planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-RESEARCH.md (nav style formula)
  </read_first>
  <files>apps/dispatch-control/components/AppSidebar.tsx</files>
  <action>
    Rewrite `AppSidebar.tsx` (keep `'use client'`) to render `NAV_GROUPS` then `NAV_PINNED` pinned at the bottom. Apply the exact dc.html formula (interfaces block):
    - `<aside>` width `w-[210px] bg-[color:var(--color-nav)] border-r border-[color:var(--color-ink)]/[.13] py-[14px]`, flex column, full height.
    - Group label: Space Grotesk 9px, `tracking-[.14em]`, uppercase, `text-[color:var(--color-faint)]`, padding per spec (first group `pt-1 pb-2 px-4`, subsequent `pt-4 pb-2 px-4`).
    - Nav item `<Link>`: `flex items-center gap-[11px] px-4 py-2` (ensure min tap target ≥44px — add `min-h-[44px]`), Space Grotesk 12.5px `tracking-[.01em]`; active (pathname === href OR startsWith(href + '/')) → `font-semibold border-l-[3px] border-[color:var(--color-vermilion)] bg-[color:var(--color-ink)] text-[color:var(--color-masthead-text)]`; inactive → `font-medium border-l-[3px] border-transparent text-[#4a453b]`. Keep `aria-current="page"` on active + a focus-visible ring.
    - Pin NAV_PINNED ("How to use") at the bottom via `mt-auto`, same item styling.
    - Remove the lucide `<Icon />` usage (no icons). Drop the old "Dispatch Control" brand header block (the masthead now owns the wordmark). Keep the Clerk `<UserButton />`? The masthead (30-04) now owns sign-out — REMOVE the duplicate UserButton from the sidebar footer to avoid two sign-out affordances.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- --run && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "NAV_GROUPS" apps/dispatch-control/components/AppSidebar.tsx` and `grep -q "NAV_PINNED" apps/dispatch-control/components/AppSidebar.tsx`
    - `grep -q "w-\[210px\]" apps/dispatch-control/components/AppSidebar.tsx`
    - `grep -q "var(--color-vermilion)" apps/dispatch-control/components/AppSidebar.tsx` (active left border)
    - `grep -q "min-h-\[44px\]" apps/dispatch-control/components/AppSidebar.tsx` (tap target)
    - no `neutral-` literal classes remain in AppSidebar.tsx
    - `pnpm --filter dispatch-control build` exits 0 and full test suite green
  </acceptance_criteria>
  <done>Sidebar renders the 3 grouped nav + pinned How-to-use in the 1c skin with correct active-state formula; build + tests green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- --run nav` green (no dead links)
- `pnpm --filter dispatch-control build` exits 0
</verification>

<success_criteria>
CHR-03 (nav): workflow-ordered 3-group nav + pinned How-to-use, 1c skin, every href resolves.
</success_criteria>

<output>
After completion, create `.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-05-SUMMARY.md`
</output>
