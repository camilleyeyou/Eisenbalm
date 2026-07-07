---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 02
type: execute
wave: 2
depends_on: ["30-01"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/review-desk/page.tsx
  - apps/dispatch-control/app/(dashboard)/signal-desk/page.tsx
  - apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx
  - apps/dispatch-control/app/(dashboard)/eval-center/page.tsx
  - apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx
  - apps/dispatch-control/app/(dashboard)/run-monitor/
  - apps/dispatch-control/app/(dashboard)/prompt-lab/
  - apps/dispatch-control/app/(dashboard)/page.tsx
  - apps/dispatch-control/next.config.ts
  - apps/dispatch-control/components/_PlaceholderScreen.tsx
autonomous: true
requirements: [CHR-03]
must_haves:
  truths:
    - "The final v3.0 route set exists now: /review-desk, /signal-desk, /run-monitor, /voice-pass, /prompt-lab, /eval-center, /registry, /how-to-use"
    - "Visiting an old path (/graph, /runs, /prompts) redirects to its new home; no working screen becomes unreachable"
    - "The console home (/) lands on /review-desk"
    - "The existing Runs list and Graph visualizer both remain reachable, hosted as tabs under /run-monitor"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/page.tsx"
      provides: "1c phase-labeled placeholder for Review Desk (Phase 32-33)"
    - path: "apps/dispatch-control/app/(dashboard)/run-monitor/page.tsx"
      provides: "Tab shell hosting Runs + Graph (D-05)"
    - path: "apps/dispatch-control/next.config.ts"
      provides: "redirects() array old→new (D-03)"
      contains: "redirects"
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/page.tsx"
      to: "/review-desk"
      via: "redirect() (D-04, supersedes Phase 21 D-09)"
      pattern: "redirect\\('/review-desk'\\)"
    - from: "apps/dispatch-control/next.config.ts"
      to: "/run-monitor, /prompt-lab"
      via: "permanent redirects from /graph, /runs, /prompts"
      pattern: "source:"
---

<objective>
Land the final v3.0 route structure now (D-02/D-03/D-04/D-05) so Phases 31–39 build straight into their homes and the Phase 30 nav has real pages behind every link. Create 1c-styled phase-labeled placeholders for the not-yet-built screens, move the existing Runs + Graph under a `/run-monitor` tab shell, rename `/prompts` → `/prompt-lab`, redirect old paths, and point the home redirect at Review Desk.

Purpose: The nav coverage gate (Plan 30-05's `nav.test.ts`) asserts every nav href resolves to a real `page.tsx`. This plan guarantees that, and closes off dangling old routes with redirects.
Output: 4 placeholder pages + a how-to-use stub + a run-monitor tab shell + prompt-lab rename + next.config redirects + home redirect.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-CONTEXT.md
@.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-RESEARCH.md
@apps/dispatch-control/app/(dashboard)/page.tsx
@apps/dispatch-control/next.config.ts
</context>

<interfaces>
<!-- Current route tree (from research + fs scan): app/(dashboard)/ contains graph/, runs/ (with [runId]/ and [runId]/review/), config/, prompts/ (with [agentKey]/), registry/, finance/, settings/. Route group (dashboard) adds no URL segment, so (dashboard)/page.tsx resolves to '/'. -->
<!-- Pitfall 3: there is NO app/page.tsx today — the single home redirect edit point is app/(dashboard)/page.tsx. Do NOT create app/page.tsx (route conflict). -->
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: 1c placeholder pages for the four unbuilt screens + how-to-use stub</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/registry/page.tsx (an existing simple page to mirror structure/imports)
    - .planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-CONTEXT.md (D-02 honest-placeholder pattern)
  </read_first>
  <files>
    apps/dispatch-control/components/_PlaceholderScreen.tsx,
    apps/dispatch-control/app/(dashboard)/review-desk/page.tsx,
    apps/dispatch-control/app/(dashboard)/signal-desk/page.tsx,
    apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx,
    apps/dispatch-control/app/(dashboard)/eval-center/page.tsx,
    apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx
  </files>
  <action>
    Create a shared `components/_PlaceholderScreen.tsx` (Server Component, no `'use client'`) accepting props `{ title: string; phase: string; blurb: string }` and rendering a hard-edged 1c panel: a Newsreader display heading (`font-[family-name:var(--font-display)]`), a marigold "coming in {phase}" chip (`bg-[color:var(--color-marigold)] text-[color:var(--color-ink)]`, uppercase Space Grotesk 9.5px, `rounded-[2px]`), and the blurb in `text-[color:var(--color-ink-soft)]`. Use ONLY 1c token arbitrary-value classes (`bg-[color:var(--color-*)]`), never literal `neutral-*`/`white`.
    Then create four page.tsx files that render it:
    - `review-desk/page.tsx` → title "Review Desk", phase "Phase 32–33", blurb "Clear the facts: native galley, inline QA annotations, accept-fix, two-sign-off publish."
    - `signal-desk/page.tsx` → title "Signal Desk", phase "Phase 37", blurb "Steer discovery: candidate slate, Gate 1 decision panel, interrupt adjudication."
    - `voice-pass/page.tsx` → title "Voice Pass", phase "Phase 36", blurb "De-slop it: machine-tells lit over clean prose, house-voice rewrites, Sounds-human sign-off."
    - `eval-center/page.tsx` → title "Eval Center", phase "Phase 38", blurb "Improve the machine: golden scenarios, scoreboard time-series, drift detection."
    Create `how-to-use/page.tsx` as a minimal 1c stub for now (title "How to use" + one line "Weekly loop, color legend, and house rules — content lands in Plan 30-07."). Plan 30-07 fills the full content; this stub only needs to exist so the nav coverage gate passes.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - Files exist: `app/(dashboard)/{review-desk,signal-desk,voice-pass,eval-center,how-to-use}/page.tsx`
    - `grep -rq "coming in" apps/dispatch-control/components/_PlaceholderScreen.tsx` (honest placeholder copy present)
    - `grep -Lq "neutral-" apps/dispatch-control/components/_PlaceholderScreen.tsx` — file contains NO `neutral-` literal classes (uses 1c tokens)
    - `grep -q "Phase 32" apps/dispatch-control/app/(dashboard)/review-desk/page.tsx`
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>Five new route pages exist, 1c-styled, phase-labeled; build green.</done>
</task>

<task type="auto">
  <name>Task 2: Move Runs + Graph under /run-monitor (tabs) and rename /prompts → /prompt-lab</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/runs/[runId]/review/page.tsx and runs/_components/ReviewQueue.tsx (internal self-links that move)
    - apps/dispatch-control/app/(dashboard)/graph/page.tsx
    - apps/dispatch-control/app/(dashboard)/prompts/page.tsx and prompts/[agentKey]/
  </read_first>
  <files>apps/dispatch-control/app/(dashboard)/run-monitor/, apps/dispatch-control/app/(dashboard)/prompt-lab/</files>
  <action>
    Restructure with `git mv` to preserve history:
    - `git mv "app/(dashboard)/graph" "app/(dashboard)/run-monitor/graph"`
    - `git mv "app/(dashboard)/runs" "app/(dashboard)/run-monitor/runs"`
    - `git mv "app/(dashboard)/prompts" "app/(dashboard)/prompt-lab"`
    Create `app/(dashboard)/run-monitor/page.tsx` as a 1c tab shell (Client Component using `usePathname()`): two tab links — "Runs" → `/run-monitor/runs`, "Graph" → `/run-monitor/graph` — styled with the active tab in cobalt underline (`border-b-2 border-[color:var(--color-cobalt)]`); the shell `redirect('/run-monitor/runs')` on the bare `/run-monitor` path is acceptable (Runs is the default view, D-05). Tab mechanics are Claude's discretion — keep it minimal.
    Update every internal self-referential link that moved: any href/redirect string `'/runs'`, `/runs/${...}`, `/runs/{runId}/review`, `'/graph'`, `'/prompts'`, `/prompts/${agentKey}` inside the moved trees AND anywhere in `apps/dispatch-control/app` / `apps/dispatch-control/components` that points at them — repoint to the `/run-monitor/runs`, `/run-monitor/graph`, `/prompt-lab` prefixes. Grep the whole app first: `grep -rn "'/runs\|/runs/\|'/graph'\|'/prompts\|/prompts/" apps/dispatch-control/app apps/dispatch-control/components`.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `app/(dashboard)/run-monitor/page.tsx`, `app/(dashboard)/run-monitor/runs/page.tsx`, `app/(dashboard)/run-monitor/graph/page.tsx` all exist
    - `app/(dashboard)/prompt-lab/page.tsx` and `app/(dashboard)/prompt-lab/[agentKey]/` exist
    - old dirs `app/(dashboard)/graph`, `app/(dashboard)/runs`, `app/(dashboard)/prompts` no longer exist
    - `grep -rn "\"/runs/\|'/runs'\|'/graph'\|'/prompts" apps/dispatch-control/app apps/dispatch-control/components` returns no stale internal links to the old prefixes (all repointed)
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>Runs + Graph live under /run-monitor as tabs; prompts renamed to prompt-lab; all internal links repointed; build green.</done>
</task>

<task type="auto">
  <name>Task 3: Home redirect → /review-desk + next.config old→new redirects</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/page.tsx (Pitfall 3: this is the single home-redirect edit point)
    - apps/dispatch-control/next.config.ts
  </read_first>
  <files>apps/dispatch-control/app/(dashboard)/page.tsx, apps/dispatch-control/next.config.ts</files>
  <action>
    In `app/(dashboard)/page.tsx` change `redirect('/graph')` to `redirect('/review-desk')` (D-04 supersedes Phase 21 D-09). Do NOT create `app/page.tsx` (Pitfall 3 — route conflict with the dashboard group).
    In `next.config.ts` add a `redirects()` async function returning an array with `permanent: true` entries covering the moved paths:
    - `{ source: '/graph', destination: '/run-monitor/graph', permanent: true }`
    - `{ source: '/graph/:path*', destination: '/run-monitor/graph/:path*', permanent: true }`
    - `{ source: '/runs', destination: '/run-monitor/runs', permanent: true }`
    - `{ source: '/runs/:path*', destination: '/run-monitor/runs/:path*', permanent: true }`
    - `{ source: '/prompts', destination: '/prompt-lab', permanent: true }`
    - `{ source: '/prompts/:path*', destination: '/prompt-lab/:path*', permanent: true }`
    Keep the existing `reactStrictMode: true`.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "redirect('/review-desk')" apps/dispatch-control/app/(dashboard)/page.tsx`
    - `grep -q "async redirects" apps/dispatch-control/next.config.ts` (or `redirects()` method present)
    - `grep -q "/run-monitor/runs" apps/dispatch-control/next.config.ts` and `grep -q "/prompt-lab" apps/dispatch-control/next.config.ts`
    - no `app/page.tsx` exists at the app root
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>Home lands on /review-desk; old paths permanently redirect to new homes; build green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control build` exits 0
- All 8 final route pages resolve; old paths redirect; no dangling links
</verification>

<success_criteria>
Final v3.0 route set exists with placeholders + tab shell + rename; redirects close old paths; home → Review Desk.
</success_criteria>

<output>
After completion, create `.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-02-SUMMARY.md`
</output>
