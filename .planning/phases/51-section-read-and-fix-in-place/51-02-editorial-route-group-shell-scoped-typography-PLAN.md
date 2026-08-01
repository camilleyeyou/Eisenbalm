---
phase: 51-section-read-and-fix-in-place
plan: 02
type: execute
wave: 2
depends_on: ["51-00"]
files_modified:
  - apps/dispatch-control/app/(editorial)/layout.tsx
  - apps/dispatch-control/app/(dashboard)/layout.tsx
  - apps/dispatch-control/app/globals.css
autonomous: true
requirements: [READ-01]

must_haves:
  truths:
    - "A route inside the new (editorial) group renders with no AppSidebar and no Masthead"
    - "useInspector() does not throw inside the (editorial) group"
    - "Review Desk and Voice Pass typography is byte-unchanged — .galley-body is still 16.5px and the bare galley scroll-margin is still 88px"
  artifacts:
    - path: "apps/dispatch-control/app/(editorial)/layout.tsx"
      provides: "minimal editorial shell + its own provider stack"
      contains: "InspectorProvider"
    - path: "apps/dispatch-control/app/globals.css"
      provides: ".section-reader scoped reading measure and type"
      contains: ".section-reader"
  key_links:
    - from: "apps/dispatch-control/app/(editorial)/layout.tsx"
      to: "apps/dispatch-control/components/inspector/InspectorProvider.tsx"
      via: "second provider instance for the sibling route group"
      pattern: "InspectorProvider"
---

<objective>
Create the `(editorial)` route group shell — a minimal layout with its own provider stack — and the scoped reading typography, without touching a single rule Review Desk or Voice Pass depends on.

Purpose: `/s/[section]` is a sibling of `(dashboard)`, not a child. It needs its own layout (no `AppSidebar`, no `Masthead`) and its own `<InspectorProvider>`, because `useInspector()` throws outside one and the existing instance is not an ancestor here (Pitfall 3, orchestrator-locked decision 1). It also needs a `.section-reader` scope so the 760px measure, the 17.5px Lora body and the corrected `scroll-margin-top` apply here and NOWHERE else (D-04, Pitfall 6).

Output: `app/(editorial)/layout.tsx` (new), a corrected doc comment in `app/(dashboard)/layout.tsx`, and a `.section-reader` block appended to `app/globals.css`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/51-section-read-and-fix-in-place/51-CONTEXT.md
@.planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md
@.planning/phases/51-section-read-and-fix-in-place/51-RESEARCH.md

<interfaces>
<!-- Contracts the executor needs. Extracted from live source. Do not re-explore. -->

apps/dispatch-control/app/(dashboard)/layout.tsx — the existing provider stack and the
ORDERING CONSTRAINT that must be replicated (its comment at lines 65-69 is load-bearing:
ConfirmProvider + CommandPaletteProvider must sit OUTSIDE InspectorProvider, because
InspectorProvider renders the panel which calls useConfirm):

  import { InspectorProvider } from '@/components/inspector/InspectorProvider'
  import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
  import { CommandPaletteProvider } from '@/components/CommandPalette'
  // ...
  ConfirmProvider > CommandPaletteProvider > InspectorProvider > OnboardingProvider >
    (AppSidebar + Masthead + MobileNavDrawer + AutoPublishBanner + children)

Its doc comment currently claims InspectorProvider is "the ONE place it is ever mounted
app-wide" and says "Do NOT add a second <InspectorProvider> anywhere" — that claim is now
scoped to the (dashboard) group and the comment must say so.

apps/dispatch-control/app/globals.css rules that must NOT change:
  .galley-body { font-size: 16.5px; line-height: 1.7; /* … */ }
  [id^='galley-'] { scroll-margin-top: 88px; }
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create app/(editorial)/layout.tsx with its own provider stack and correct the (dashboard) doc comment</name>
  <files>apps/dispatch-control/app/(editorial)/layout.tsx, apps/dispatch-control/app/(dashboard)/layout.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/layout.tsx (full — the provider nesting order, the 'use client' boundary handling, and the doc comment being corrected)
    - apps/dispatch-control/components/inspector/InspectorProvider.tsx (the `useInspector must be used within an InspectorProvider` throw at ~line 108 and the provider's own doc comment)
    - apps/dispatch-control/app/layout.tsx (the root layout — confirms Lora is already wired as `--font-lora` → `--font-body`; NO new font work is in scope)
    - apps/dispatch-control/middleware.ts (confirms whether the new `/s/` route is already covered by the existing Clerk matcher)
  </read_first>
  <action>
Create `apps/dispatch-control/app/(editorial)/layout.tsx`. It is the minimal editorial shell — D-01: no `AppSidebar`, no `Masthead`, no `MobileNavDrawer`, no `AutoPublishBanner`, no nav of any kind, nothing operational (DOOR-03).

Doc comment (write it, it records the two non-obvious constraints):
  Phase 51 (D-01) — the (editorial) route group shell. A SIBLING of app/(dashboard)/,
  not a child. No AppSidebar, no Masthead, no nav — "a page to read, not a workspace to
  navigate." Phases 52 (`/`) and 54 (`/archive`) drop in as siblings sharing this shell.
  app/(dashboard)/ and every route inside it stays byte-unchanged.
  Provider stack (Pitfall 3, 51-RESEARCH): `useInspector()` THROWS outside an
  <InspectorProvider>, and the (dashboard) instance is not an ancestor of this group. A
  second, independent instance is mounted here so D-22's "Inspect how this was made" works
  on /s/[section]. Inspector state deliberately does not persist across a navigation
  between the two groups — they are separate, unrelated surfaces (D-24).
  ORDERING IS LOAD-BEARING (fast 260723, replicated from (dashboard)/layout.tsx):
  ConfirmProvider and CommandPaletteProvider must sit OUTSIDE InspectorProvider —
  InspectorProvider renders the inspector panel, which calls useConfirm.
  OnboardingProvider is NOT mounted here: the tour is a (dashboard) console concern.

Implementation:

  import type { ReactNode } from 'react'
  import { InspectorProvider } from '@/components/inspector/InspectorProvider'
  import { ConfirmProvider } from '@/components/ui/ConfirmDialog'
  import { CommandPaletteProvider } from '@/components/CommandPalette'

  export default function EditorialLayout({ children }: { children: ReactNode }) {
    return (
      <ConfirmProvider>
        <CommandPaletteProvider>
          <InspectorProvider>
            <div className="min-h-screen bg-[color:var(--background)]">{children}</div>
          </InspectorProvider>
        </CommandPaletteProvider>
      </ConfirmProvider>
    )
  }

If any of the three providers requires a `'use client'` directive at this boundary, replicate exactly how `(dashboard)/layout.tsx` handles it (its comment notes a `'use client'` InspectorProvider is fine and the children remain server components). Do not invent a different boundary strategy.

Do NOT add `app/(editorial)/page.tsx` — D-01 explicitly forbids Phase 51 from claiming `/` in the new group; that conflict is Phase 52's to resolve.

In `app/(dashboard)/layout.tsx`, change ONLY the doc comment: rescope the claim that `<InspectorProvider>` is "the ONE place it is ever mounted app-wide" and the instruction "Do NOT add a second <InspectorProvider> anywhere" to the `(dashboard)` route group — e.g. "the ONE place it is mounted for the (dashboard) route group; the sibling (editorial) group mounts its own independent instance in app/(editorial)/layout.tsx (Phase 51, D-01)." No code change in that file whatsoever.

Check `middleware.ts`: if its Clerk matcher does not already cover `/s/:path*`, add it so `/s/[section]` is authenticated exactly like every other console route. If the matcher is a catch-all that already covers it, change nothing.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx -t "inspect"</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/app/(editorial)/layout.tsx` exists
    - `grep -n "InspectorProvider" "apps/dispatch-control/app/(editorial)/layout.tsx"` matches at least twice (import + JSX)
    - `grep -n "ConfirmProvider" "apps/dispatch-control/app/(editorial)/layout.tsx"` matches
    - `grep -n "AppSidebar\|Masthead\|MobileNavDrawer\|AutoPublishBanner\|OnboardingProvider" "apps/dispatch-control/app/(editorial)/layout.tsx"` returns NO matches
    - `test ! -f "apps/dispatch-control/app/(editorial)/page.tsx"` succeeds
    - `grep -n "ONE place it is ever mounted app-wide" "apps/dispatch-control/app/(dashboard)/layout.tsx"` returns NO matches
    - `git diff -U0 "apps/dispatch-control/app/(dashboard)/layout.tsx" | grep '^[+-]' | grep -v '^[+-][+-]' | grep -v '^\s*[+-]\s*\*'` returns NO lines (proving comment-only edit)
  </acceptance_criteria>
  <done>`(editorial)` layout exists with its own Confirm → CommandPalette → Inspector stack and zero console chrome; the `(dashboard)` doc comment no longer makes a false app-wide claim; no page at the group's `/`.</done>
</task>

<task type="auto">
  <name>Task 2: Add the .section-reader scoped measure, body type and scroll-margin override to globals.css</name>
  <files>apps/dispatch-control/app/globals.css</files>
  <read_first>
    - apps/dispatch-control/app/globals.css (the `.galley-root`, `.galley-body`, `.galley-headline`, `.galley-section`, `.galley-claim` rules and `[id^='galley-'] { scroll-margin-top: 88px }` — every one of them must survive unchanged)
    - .planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md § Typography and § Layout Contract (the locked values reproduced verbatim below)
  </read_first>
  <action>
APPEND a new, clearly-commented block to the END of `app/globals.css`. Do NOT edit any existing rule — in particular `.galley-body` MUST stay `font-size: 16.5px; line-height: 1.7` and the bare `[id^='galley-']` rule MUST stay `scroll-margin-top: 88px` (D-04/D-24).

Exact block to append:

  /* ── Phase 51 (D-04) — the Section reading surface, scoped ──────────────────
     Every rule below is scoped under .section-reader so Review Desk and Voice
     Pass are untouched. NEVER edit .galley-body or the bare [id^='galley-']
     rule — both are shared with the v4.0 console.                             */

  .section-reader {
    max-width: 760px;
    margin-inline: auto;
    padding-inline: 24px;
  }

  /* D-04: 17.5px reading body, scoped. .galley-body stays 16.5px globally. */
  .section-reader .galley-body {
    font-size: 17.5px;
    line-height: 1.7;
  }

  /* Pitfall 6: the shared [id^='galley-'] { scroll-margin-top: 88px } was tuned
     for the v4 sticky stage-tab nav. This surface's header is not sticky (D-05),
     so this compound selector wins on specificity and corrects the offset. It
     ONLY takes effect if the page's wrapper element literally carries the
     .section-reader class — assert that in the render test, never assume it. */
  .section-reader [id^='galley-'] {
    scroll-margin-top: 16px;
  }

Values are locked by `51-UI-SPEC.md` — do not substitute a different measure, size or line-height. Do not add a media query or container query: the UI-SPEC resolved this explicitly (simple max-width + 24px padding, comfortable down to ~360px, nothing to reflow because no side content exists at any width).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && node --input-type=module -e "import fs from 'node:fs'; const s=fs.readFileSync('app/globals.css','utf8'); const ok = s.includes('.section-reader') && s.includes('max-width: 760px') && /font-size:\s*16\.5px/.test(s) && /scroll-margin-top:\s*88px/.test(s) && /scroll-margin-top:\s*16px/.test(s); if(!ok){console.error('globals.css invariant broken'); process.exit(1)} console.log('globals.css ok')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "^\.section-reader {" apps/dispatch-control/app/globals.css` matches
    - `grep -n "max-width: 760px" apps/dispatch-control/app/globals.css` matches
    - `grep -n "font-size: 17.5px" apps/dispatch-control/app/globals.css` matches
    - `grep -c "font-size: 16.5px" apps/dispatch-control/app/globals.css` returns at least 1 (`.galley-body` untouched)
    - `grep -c "scroll-margin-top: 88px" apps/dispatch-control/app/globals.css` returns at least 1 (shared rule untouched)
    - `grep -n "scroll-margin-top: 16px" apps/dispatch-control/app/globals.css` matches
    - `grep -n "@media\|@container" apps/dispatch-control/app/globals.css` shows no NEW occurrence inside the appended `.section-reader` block
    - `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx` exits 0
  </acceptance_criteria>
  <done>`.section-reader` scoping exists with the locked 760px / 17.5px / 16px values; `.galley-body` and the shared galley scroll-margin rule are provably unchanged.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx __tests__/PassageToolbar.test.tsx` exits 0
- `git diff --name-only` lists only `app/(editorial)/layout.tsx`, `app/(dashboard)/layout.tsx` and `app/globals.css`
- No new npm dependency: `package.json` and lockfiles are unmodified
</verification>

<success_criteria>
- `app/(editorial)/layout.tsx` mounts Confirm → CommandPalette → Inspector in that nesting order, with zero console chrome and no `page.tsx` at the group root.
- `useInspector()` has a provider ancestor inside the new group.
- `.section-reader` scoping exists; `.galley-body` is still 16.5px and the shared `[id^='galley-']` rule is still 88px.
</success_criteria>

<output>
After completion, create `.planning/phases/51-section-read-and-fix-in-place/51-02-SUMMARY.md`
</output>
