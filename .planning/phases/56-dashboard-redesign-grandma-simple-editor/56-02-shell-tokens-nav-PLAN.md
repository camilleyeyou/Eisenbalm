---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/phases/56-dashboard-redesign-grandma-simple-editor/56-PREFLIGHT.md
  - apps/dispatch-control/app/globals.css
  - apps/dispatch-control/components/editor/EditorShell.tsx
  - apps/dispatch-control/app/(editorial)/layout.tsx
  - apps/dispatch-control/app/admin/layout.tsx
  - apps/dispatch-control/lib/nav.ts
  - apps/dispatch-control/__tests__/nav.test.ts
  - apps/dispatch-control/__tests__/EditorShell.test.tsx
  - apps/dispatch-control/__tests__/AdminHub.test.tsx
autonomous: true
requirements: [P56-B3, P56-A1, P56-A4]

must_haves:
  truths:
    - "Local pipeline CORS is confirmed working for http://localhost:3001 before any UI work, and the baseline suite result is recorded"
    - "Every editor and admin page shows the same masthead with exactly three nav links: This week's issue, Past issues, Behind the scenes"
    - "No 'Admin' link, user-menu chrome, or command palette appears on any editor or admin page"
    - "The seven Behind-the-scenes dials carry plain labels (Money, Charities, Past issues step by step, What the writers are told, Quality tests, Schedule and limits, Settings)"
  artifacts:
    - path: "apps/dispatch-control/components/editor/EditorShell.tsx"
      provides: "Masthead + 3-link nav + main container"
      exports: ["default"]
    - path: "apps/dispatch-control/lib/nav.ts"
      provides: "EDITOR_NAV + relabelled ADMIN_ITEMS"
      contains: "export const EDITOR_NAV"
    - path: "apps/dispatch-control/app/globals.css"
      provides: "7 additive editor tokens"
      contains: "--color-done: #11764a"
  key_links:
    - from: "apps/dispatch-control/app/admin/layout.tsx"
      to: "apps/dispatch-control/components/editor/EditorShell.tsx"
      via: "layout wraps children in EditorShell"
      pattern: "<EditorShell"
    - from: "apps/dispatch-control/app/(editorial)/layout.tsx"
      to: "apps/dispatch-control/components/editor/EditorShell.tsx"
      via: "layout wraps children in EditorShell"
      pattern: "<EditorShell"
---

<objective>
Pre-flight the local QA path (pipeline CORS), add the editor colour tokens, and build the shared shell (masthead + three-link nav) that both the editorial and admin layouts mount. Relabel the admin dial items in plain words.

Purpose: Locked decision 4 (three-link nav, Admin renamed) and decision 5 (tokens). Memory `local-dev-pipeline-cors-gap`: Phase 51 lost its whole human verification to CORS — confirm first.
Output: 56-PREFLIGHT.md, tokens, EditorShell, two rewritten layouts, relabelled nav.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-RESEARCH.md
@apps/dispatch-control/app/globals.css
@apps/dispatch-control/app/(editorial)/layout.tsx
@apps/dispatch-control/app/admin/layout.tsx
@apps/dispatch-control/lib/nav.ts

<interfaces>
Current lib/nav.ts:
```typescript
export interface AdminItem { label: string; href: string; description: string; weekly?: boolean }
export const ADMIN_ITEMS: ReadonlyArray<AdminItem>   // 7 items, /admin/finance, /admin/charities, /admin/runs, /admin/agents, /admin/tests, /admin/automation, /admin/settings
```
Providers: `ConfirmProvider` (components/ui/ConfirmDialog), `InspectorProvider` (components/inspector/InspectorProvider), `CommandPaletteProvider` (components/CommandPalette) — only the two layouts import CommandPaletteProvider; nothing calls a palette hook elsewhere.
House class style: arbitrary-value token classes, e.g. `text-[color:var(--color-ink)]`, `font-[family-name:var(--font-ui)]`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pre-flight — local pipeline CORS + baseline suite</name>
  <files>.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-PREFLIGHT.md</files>
  <read_first>
    - apps/dispatch-control/.env.local (confirm `NEXT_PUBLIC_PIPELINE_URL=http://localhost:8000`; do NOT print secrets)
    - packages/pipeline/.env (confirm `DASHBOARD_ALLOWED_ORIGINS` contains `http://localhost:3001`; print only that key)
    - 56-RESEARCH.md § Pitfall 2 and § Environment Availability
  </read_first>
  <action>
0. Record the phase start commit: `git rev-parse HEAD` — write it into 56-PREFLIGHT.md as the line `Phase start commit: <full 40-char hash>`.
1. `grep -n "^NEXT_PUBLIC_PIPELINE_URL" apps/dispatch-control/.env.local` and `grep -n "^DASHBOARD_ALLOWED_ORIGINS" packages/pipeline/.env`.
2. Start the pipeline in the background: `pnpm --filter pipeline dev` (port 8000). Wait until `curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/health` (or `/docs` if /health is absent) returns 200, up to 60 s.
3. CORS probe: `curl -s -i -X OPTIONS http://localhost:8000/runs -H "Origin: http://localhost:3001" -H "Access-Control-Request-Method: GET" | grep -i "access-control-allow-origin"` must print `http://localhost:3001`.
4. Baseline: `pnpm --filter dispatch-control test 2>&1 | tail -15` — record pass/fail file counts (expected: 104 pass, 1 known fail in SectionReaderPage.test.tsx "Save edit calls patchBonus…").
5. Stop the background pipeline.
6. Write `56-PREFLIGHT.md` with: env keys found (values for the two URLs/origins only), health status code, the exact CORS header line, baseline counts, and the note "OPENROUTER_API_KEY revoked 2026-10-22: Start a new issue / Rewrite this part cannot be exercised end-to-end until replaced on Railway + local .env."
If step 3 fails, add `http://localhost:3001` to `DASHBOARD_ALLOWED_ORIGINS` in `packages/pipeline/.env` (local only, not committed — check `git check-ignore packages/pipeline/.env`), re-run the probe, and record the fix. Do not proceed with "CORS: FAIL" silently.
  </action>
  <verify>
    <automated>grep -n "CORS: PASS" /Users/user/Desktop/Eisenbalm/.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-PREFLIGHT.md</automated>
  </verify>
  <acceptance_criteria>
    - 56-PREFLIGHT.md contains a line matching `^Phase start commit: [0-9a-f]{40}$`
    - 56-PREFLIGHT.md exists and contains the literal `CORS: PASS` and a line matching `Baseline: \d+ files pass`
    - 56-PREFLIGHT.md contains no string matching `sk-|pk_|secret` (no secrets copied)
  </acceptance_criteria>
  <done>Browser QA at the end of the phase is known to be possible; baseline failure is recorded so it is not mistaken for a regression.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Editor tokens + EditorShell + EDITOR_NAV + relabelled ADMIN_ITEMS</name>
  <files>apps/dispatch-control/app/globals.css, apps/dispatch-control/components/editor/EditorShell.tsx, apps/dispatch-control/lib/nav.ts, apps/dispatch-control/__tests__/nav.test.ts, apps/dispatch-control/__tests__/EditorShell.test.tsx, apps/dispatch-control/__tests__/AdminHub.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/globals.css `@theme` block (lines 10-31) and __tests__/design-tokens.test.ts (existing values must not change)
    - 56-UI-SPEC.md § "Token mapping", § "Shell (every editor page)", § "8. Behind the scenes" (dial labels) and § "Responsive contract" masthead bullet
    - canvas/Main.dc.html masthead markup (wordmark + nav)
    - __tests__/nav.test.ts and __tests__/AdminHub.test.tsx (current assertions)
  </read_first>
  <behavior>
    - EditorShell renders `nav[aria-label="Pages"]` with exactly 3 links in order: "This week's issue" → "/", "Past issues" → "/archive", "Behind the scenes" → "/admin"
    - pathname "/" → first link aria-current="page"; "/s/founderBio" → first link current; "/archive" → second; "/admin/runs/abc" → third
    - wordmark "The Eisenbalm Dispatch" links to "/"
    - no element with text "Admin" exists in the shell
    - ADMIN_ITEMS labels in order: Money, Charities, Past issues, step by step, What the writers are told, Quality tests, Schedule and limits, Settings; Money + Charities weekly
  </behavior>
  <action>
1. `app/globals.css`: inside the existing `@theme { }` block, AFTER `--color-masthead-muted`, append exactly:
```css
  /* Phase 56 editor tokens (additive; never mutate the values above) */
  --color-done: #11764a;
  --color-amber-text: #8a6403;
  --color-problem: #c43a14;
  --color-wash: #f7f6f1;
  --color-current: #fffdf6;
  --color-line: rgba(23, 20, 14, 0.12);
  --color-line-strong: rgba(23, 20, 14, 0.2);
```
Also append at file end a utility block:
```css
/* Phase 56: editor focus ring + working-dot pulse */
.editor-focus:focus-visible { outline: 3px solid var(--color-cobalt); outline-offset: 2px; }
@keyframes editor-pulse { 0%, 100% { opacity: 1 } 50% { opacity: .35 } }
.editor-pulse { animation: editor-pulse 1.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .editor-pulse { animation: none; } }
```
2. `lib/nav.ts`: rewrite header comment (Phase 56: three-link editor nav; dials in plain words; route paths unchanged). Add:
```typescript
export interface EditorNavItem { label: string; href: string; match: (pathname: string) => boolean }
export const EDITOR_NAV: ReadonlyArray<EditorNavItem> = [
  { label: "This week's issue", href: '/', match: p => p === '/' || p.startsWith('/s/') },
  { label: 'Past issues', href: '/archive', match: p => p.startsWith('/archive') },
  { label: 'Behind the scenes', href: '/admin', match: p => p.startsWith('/admin') },
]
```
Relabel ADMIN_ITEMS (same hrefs, same order): Money `/admin/finance` "Sales, money sent to charities, and what the writing costs" weekly; Charities `/admin/charities` "Every charity we know about, and the ones never to use" weekly; "Past issues, step by step" `/admin/runs` "How each issue was made, and what stopped the ones that didn't finish"; "What the writers are told" `/admin/agents` "The instructions each writer follows, with earlier versions"; "Quality tests" `/admin/tests` "Check the writing still sounds right after a change"; "Schedule and limits" `/admin/automation` "When a new issue starts and how much it may cost"; "Settings" `/admin/settings` "Emails and the record of who changed what". (Descriptions must not match EDITOR_BANNED_PATTERN from 56-01: no run/agent/pipeline/token words.)
3. `components/editor/EditorShell.tsx` ('use client'): props `{ children: ReactNode }`; `usePathname()` from next/navigation. Markup:
   - outer `div.min-h-screen bg-[color:var(--color-rail)] text-[color:var(--color-ink)]`
   - `header` max-w-[1040px] mx-auto, `px-4 sm:px-6 lg:px-8 pt-6 pb-2`, `flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3`; wordmark `Link href="/"` Newsreader `font-[family-name:var(--font-display)] text-[23px] font-semibold editor-focus`; on phone the wordmark is its own line (`basis-full sm:basis-auto`).
   - `nav aria-label="Pages"` → `ul.flex flex-wrap gap-x-6 gap-y-1`; each link `inline-flex min-h-[48px] items-center font-[family-name:var(--font-ui)] text-[15px] editor-focus`; inactive `text-[color:var(--color-ink-soft)]`; current `aria-current="page"` + `text-[color:var(--color-ink)] font-semibold underline decoration-2 underline-offset-[6px]`.
   - `main` `mx-auto max-w-[1040px] px-4 sm:px-6 lg:px-8 pt-4 pb-16 flex flex-col gap-8 sm:gap-12`.
   No `font-mono`, no `uppercase`, no `tracking-`, no text size below 15px, no UserButton.
4. Tests: rewrite `__tests__/nav.test.ts` to assert the new ADMIN_ITEMS labels/order/hrefs, weekly = Money + Charities only, every description fails `/\b(runs?|agents?|pipeline|tokens?)\b/i`, keep the existing "every href has a real page file on disk" and "no retired console path survives" cases; add EDITOR_NAV cases (3 items, match()). Create `__tests__/EditorShell.test.tsx` (mock `next/navigation` usePathname via `vi.mock`) covering the behavior list. In `__tests__/AdminHub.test.tsx` update ONLY label strings that changed (Finance→Money etc.) so it stays green until plan 56-08 rewrites it; do not edit app/admin/page.tsx here.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/nav.test.ts __tests__/EditorShell.test.tsx __tests__/AdminHub.test.tsx __tests__/design-tokens.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "\-\-color-done: #11764a\|--color-amber-text: #8a6403\|--color-problem: #c43a14\|--color-wash: #f7f6f1\|--color-current: #fffdf6" apps/dispatch-control/app/globals.css` = 5
    - `grep -n "label: 'Finance'\|label: 'Runs'\|label: 'Automation'\|Agent instructions" apps/dispatch-control/lib/nav.ts` returns nothing
    - `grep -nE "font-mono|uppercase|tracking-|text-\[(9|10|11|12|13|14)px\]|UserButton" apps/dispatch-control/components/editor/EditorShell.tsx` returns nothing
    - listed tests pass (design-tokens.test.ts unchanged and green)
  </acceptance_criteria>
  <done>Tokens, shell and plain nav exist and are tested.</done>
</task>

<task type="auto">
  <name>Task 3: Mount EditorShell in both layouts; unmount the command palette</name>
  <files>apps/dispatch-control/app/(editorial)/layout.tsx, apps/dispatch-control/app/admin/layout.tsx</files>
  <read_first>
    - both layout files (provider ordering comment: ConfirmProvider must stay OUTSIDE InspectorProvider)
    - apps/dispatch-control/components/editor/EditorShell.tsx (from Task 2)
    - 56-RESEARCH.md § Retirement Inventory rows "Admin top bar" and "⌘K command palette"
  </read_first>
  <action>
1. `app/(editorial)/layout.tsx`: replace body with
```tsx
<ConfirmProvider>
  <InspectorProvider>
    <EditorShell>{children}</EditorShell>
  </InspectorProvider>
</ConfirmProvider>
```
Remove the `CommandPaletteProvider` import and wrapper. Keep InspectorProvider for now (the old section page still calls useInspector until plan 56-06; plan 56-12 removes it if unused). Update the header comment: "Phase 56: shared EditorShell (three-link nav). Command palette retired (it displayed run ids)."
2. `app/admin/layout.tsx`: same provider stack and `<EditorShell>`; delete the `BAR_LINK` constant, the `header` with "← Back to the issue" / "Admin" links, the `UserButton` import and the `h-screen overflow-hidden` shell. Stays a Server Component (EditorShell is the client boundary). Update header comment.
3. Do NOT delete `components/CommandPalette.tsx` here (plan 56-12 deletes it with a tripwire).
4. Run the strict build once: `pnpm --filter dispatch-control build`.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control build && pnpm --filter dispatch-control exec vitest run __tests__/homeRoute.test.ts __tests__/EditorShell.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -rn "CommandPalette" "apps/dispatch-control/app/(editorial)/layout.tsx" apps/dispatch-control/app/admin/layout.tsx` returns nothing
    - `grep -n ">\s*Admin\s*<\|UserButton\|Back to the issue" apps/dispatch-control/app/admin/layout.tsx` returns nothing
    - `grep -c "<EditorShell>" "apps/dispatch-control/app/(editorial)/layout.tsx" apps/dispatch-control/app/admin/layout.tsx` totals 2
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>Every editor and admin route renders inside the same three-link shell; no Admin link, no palette.</done>
</task>

</tasks>

<verification>
Strict build green; nav/EditorShell/AdminHub/design-tokens/homeRoute tests green.
</verification>

<success_criteria>
P56-B3 proven (three links, aria-current); pre-flight recorded with CORS PASS.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-02-SUMMARY.md`
</output>
