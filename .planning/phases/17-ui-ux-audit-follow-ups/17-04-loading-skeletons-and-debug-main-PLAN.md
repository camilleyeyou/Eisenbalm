---
phase: 17-ui-ux-audit-follow-ups
plan: 04
type: execute
wave: 2
depends_on: [17-01]
files_modified:
  - apps/web/app/issue/[slug]/loading.tsx
  - apps/web/app/archive/loading.tsx
  - apps/web/app/charities/loading.tsx
  - apps/web/app/charities/[slug]/loading.tsx
  - apps/web/app/%5Fdebug/convex/page.tsx
autonomous: true
requirements: [P17-04, P17-06, P17-07]
user_setup: []

must_haves:
  truths:
    - "Navigating to /issue/[slug], /archive, /charities, /charities/[slug] shows a shimmer skeleton mirroring the page layout while the Server Component resolves"
    - "Every loading.tsx uses <div> or <article> as its root — NEVER <main> (root layout owns the single <main id=\"main\">)"
    - "Skeleton bars use the --color-line token + Tailwind animate-pulse (no hardcoded hex, no new CSS class, no new dep)"
    - "/_debug/convex renders a <div> wrapper, no longer nesting a second <main> inside the root layout's <main>"
    - "loading-skeletons.test.ts and debug-route.test.ts are GREEN; 234 baseline preserved"
  artifacts:
    - path: "apps/web/app/issue/[slug]/loading.tsx"
      provides: "Issue page skeleton (hero block + body lines), root <article>, animate-pulse"
      contains: "animate-pulse"
    - path: "apps/web/app/archive/loading.tsx"
      provides: "Archive skeleton (title + cardswap block + list rows), root <div>"
      contains: "animate-pulse"
    - path: "apps/web/app/charities/loading.tsx"
      provides: "Charities list skeleton, root <div>, max-w-[1100px]"
      contains: "animate-pulse"
    - path: "apps/web/app/charities/[slug]/loading.tsx"
      provides: "Single-charity skeleton, root <div>"
      contains: "animate-pulse"
    - path: "apps/web/app/%5Fdebug/convex/page.tsx"
      provides: "<div> wrapper (was <main>), single-main-landmark restored"
      contains: "max-w-2xl"
  key_links:
    - from: "each loading.tsx"
      to: "Tailwind animate-pulse + var(--color-line)"
      via: "bg-[color:var(--color-line)] skeleton bars under an animate-pulse root"
      pattern: "bg-\\[color:var\\(--color-line\\)\\]"
    - from: "apps/web/app/%5Fdebug/convex/page.tsx"
      to: "root layout <main id='main'>"
      via: "page uses <div> so the landmark is never nested"
      pattern: "<div className=\"mx-auto max-w-2xl"
---

<objective>
Create four Next.js App Router `loading.tsx` skeleton files (issue, archive, charities, single-charity) and fix the duplicate `<main>` in the `/_debug/convex` route. Skeletons mirror each page's layout shape with `animate-pulse` shimmer bars using the `--color-line` token; none introduce a `<main>` (the root layout owns the only one). The debug-route fix is the same `<main>`→`<div>` one-liner applied to archive/charities in the sibling a11y task.

Purpose: Smooth perceived-performance transitions (no content jump) on the four async routes, and restore the single-main-landmark invariant on the debug route (WCAG 1.3.1).
Output: 4 new loading.tsx files + 1 edited debug page; loading-skeletons.test.ts and debug-route.test.ts GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/17-ui-ux-audit-follow-ups/17-RESEARCH.md
@.planning/quick/260520-0kt-wcag-aa-accessibility-conformance-pass-o/260520-0kt-SUMMARY.md

<interfaces>
<!-- Page-wrapper classes to MIRROR in each skeleton (confirmed in codebase): -->
<!--   issue/[slug]/page.tsx return root: <article className="pb-0">; hero container max-w-[860px] px-4 py-16 sm:px-6 lg:px-8; body section max-w-[680px] -->
<!--   archive/page.tsx list container: max-w-[1100px] px-4 md:px-6 lg:px-8 py-12 (CardSwap above ArchiveList) -->
<!--   charities/page.tsx return root: <div className="mx-auto max-w-[1100px] px-4 md:px-6 lg:px-8 py-12"> with h1 then grid of CharityCard -->
<!--   charities/[slug]/page.tsx renders <CharityDetail> (detail layout) -->
<!-- Token: --color-line is defined in globals.css L65 (color-mix 8% of text) — neutral hairline, reads on warm paper. -->
<!-- App Router: loading.tsx is auto-wrapped in <Suspense> by the framework; NO <Suspense> in page.tsx, NO 'use client'. -->

%5Fdebug/convex/page.tsx current wrapper (the ONLY change in that file):
```tsx
<main className="mx-auto max-w-2xl px-6 py-12">   // L50  -> change to <div ...>
  ...
</main>                                            // L72  -> change to </div>
```
(The `'use client'` directive, the useQuery calls, the <meta robots> and the table all stay.)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create the four loading.tsx skeleton files</name>
  <files>apps/web/app/issue/[slug]/loading.tsx, apps/web/app/archive/loading.tsx, apps/web/app/charities/loading.tsx, apps/web/app/charities/[slug]/loading.tsx</files>
  <read_first>
    - apps/web/app/issue/[slug]/page.tsx (L181-182 — root `<article className="pb-0">`, hero/body container widths to mirror)
    - apps/web/app/charities/page.tsx (L48 — `<div className="mx-auto max-w-[1100px] px-4 md:px-6 lg:px-8 py-12">`, h1 + card grid to mirror)
    - apps/web/app/archive/page.tsx (confirm the list container max-w-[1100px] and that CardSwap sits above ArchiveList)
    - apps/web/app/error.tsx (existing route-level component that uses <section>, not <main> — confirms the no-<main> convention)
    - apps/web/app/globals.css (L65 — confirm --color-line token exists)
    - .planning/phases/17-ui-ux-audit-follow-ups/17-RESEARCH.md (Pattern 3 + Code Examples "loading.tsx — /archive skeleton" and "loading.tsx — /issue/[slug] skeleton"; Pitfall 4 no-<main>)
    - apps/web/__tests__/loading-skeletons.test.ts (existence + no-<main> assertions to satisfy)
  </read_first>
  <action>
    Create exactly these four files. Each: default-exported function component, NO 'use client', root element is <article> or <div> with `animate-pulse`, skeleton bars are `rounded bg-[color:var(--color-line)]` with explicit heights/widths, every decorative bar carries `aria-hidden="true"`. Mirror each page's container width so the content snap-in is smooth.

    1. apps/web/app/issue/[slug]/loading.tsx — root `<article className="pb-0 animate-pulse">`.
       Hero block: `<div className="mx-auto max-w-[860px] px-4 py-16 sm:px-6 lg:px-8">` containing 4 bars — eyebrow `h-3 w-20`, two title bars `h-12 w-3/4` and `h-12 w-1/2`, meta `h-3 w-48`.
       Body block: `<div className="mx-auto max-w-[680px] px-4 sm:px-6 lg:px-8 space-y-3 mt-8">` rendering 6 bars via `Array.from({ length: 6 }).map((_, i) => ...)`, each `h-4 rounded bg-[color:var(--color-line)]` with width `w-4/5` when `i % 3 === 2` else `w-full`, key={i}, aria-hidden.

    2. apps/web/app/archive/loading.tsx — root `<div className="mx-auto max-w-[1100px] px-4 py-12 md:px-6 lg:px-8 animate-pulse">`.
       Title bar `h-8 w-32`, subtitle bar `h-3 w-64`, a CardSwap-area block `h-48 w-full`, then `<div className="space-y-4">` with 5 row bars `h-16 w-full` via Array.from({length:5}). All bars `rounded bg-[color:var(--color-line)]` + aria-hidden.

    3. apps/web/app/charities/loading.tsx — root `<div className="mx-auto max-w-[1100px] px-4 md:px-6 lg:px-8 py-12 animate-pulse">`.
       Title bar `h-9 w-40`, subtitle bar `h-3 w-72`, then a card grid `<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">` with 6 card bars `h-32 w-full rounded bg-[color:var(--color-line)]` via Array.from({length:6}), aria-hidden.

    4. apps/web/app/charities/[slug]/loading.tsx — root `<div className="mx-auto max-w-[760px] px-4 md:px-6 lg:px-8 py-16 animate-pulse">`.
       Name bar `h-10 w-2/3`, meta row `h-3 w-40`, then `<div className="space-y-3 mt-8">` with 5 prose bars (`h-4 w-full`, last `w-3/4`) via Array.from({length:5}), aria-hidden.

    Rules for all four: no `<main>`; no 'use client'; no hardcoded hex (only `var(--color-line)`); no new CSS class (use Tailwind `animate-pulse` which ships with Tailwind v4); no <Suspense> anywhere.
  </action>
  <acceptance_criteria>
    - `test -f "apps/web/app/issue/[slug]/loading.tsx" && test -f apps/web/app/archive/loading.tsx && test -f apps/web/app/charities/loading.tsx && test -f "apps/web/app/charities/[slug]/loading.tsx"` exits 0
    - `grep -L "<main" apps/web/app/issue/[slug]/loading.tsx apps/web/app/archive/loading.tsx apps/web/app/charities/loading.tsx "apps/web/app/charities/[slug]/loading.tsx"` lists all four files (none contains `<main`)
    - `grep -l "animate-pulse" apps/web/app/issue/[slug]/loading.tsx apps/web/app/archive/loading.tsx apps/web/app/charities/loading.tsx "apps/web/app/charities/[slug]/loading.tsx" | wc -l` returns 4
    - `grep -rL "bg-\[color:var(--color-line)\]" apps/web/app/archive/loading.tsx` returns empty (the token is present)
    - `grep -rc "#[0-9a-fA-F]\{6\}" apps/web/app/archive/loading.tsx apps/web/app/charities/loading.tsx` returns 0 for each (no hex)
    - `grep -c "use client" apps/web/app/archive/loading.tsx` returns 0
    - `pnpm --filter web test:unit -- --run loading-skeletons` passes the existence + no-<main> assertions
  </acceptance_criteria>
  <verify>
    <automated>cd apps/web && pnpm test:unit -- --run loading-skeletons 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <done>Four loading.tsx files exist, each mirrors its page container width with animate-pulse + --color-line bars, none uses <main>/'use client'/hex, and loading-skeletons.test.ts is GREEN.</done>
</task>

<task type="auto">
  <name>Task 2: Fix duplicate <main> in /_debug/convex route</name>
  <files>apps/web/app/%5Fdebug/convex/page.tsx</files>
  <read_first>
    - apps/web/app/%5Fdebug/convex/page.tsx (L50 `<main className="mx-auto max-w-2xl px-6 py-12">`, L72 closing `</main>`)
    - apps/web/app/layout.tsx (the root `<main id="main">` landmark — confirm it is the sole intended main)
    - .planning/quick/260520-0kt-wcag-aa-accessibility-conformance-pass-o/260520-0kt-SUMMARY.md (Task 4 — identical <main>→<div> pattern already applied to archive/charities)
    - .planning/phases/17-ui-ux-audit-follow-ups/17-RESEARCH.md (Pattern 5 — exact one-line fix)
    - apps/web/__tests__/debug-route.test.ts (the no-<main> assertion to satisfy)
  </read_first>
  <action>
    In apps/web/app/%5Fdebug/convex/page.tsx, change the opening `<main className="mx-auto max-w-2xl px-6 py-12">` (L50) to `<div className="mx-auto max-w-2xl px-6 py-12">` and the corresponding closing `</main>` (L72) to `</div>`. Keep ALL classes, the `<meta name="robots">`, the heading, paragraph, and table exactly as-is. Do NOT touch the `'use client'` directive, the TODO(Phase 9) header comment, the useQuery calls, or the %5F-escaped folder name (it preserves the /_debug/convex URL — Phase 3 decision). No other file changes.
  </action>
  <acceptance_criteria>
    - `grep -c "<main" apps/web/app/%5Fdebug/convex/page.tsx` returns 0
    - `grep -q '<div className="mx-auto max-w-2xl px-6 py-12">' apps/web/app/%5Fdebug/convex/page.tsx` exits 0
    - `grep -q "Convex smoke test" apps/web/app/%5Fdebug/convex/page.tsx` exits 0 (content untouched)
    - `grep -q "use client" apps/web/app/%5Fdebug/convex/page.tsx` exits 0 (directive preserved)
    - `pnpm --filter web test:unit -- --run debug-route` exits 0 (no-<main> assertion GREEN)
  </acceptance_criteria>
  <verify>
    <automated>cd apps/web && pnpm test:unit -- --run debug-route 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <done>%5Fdebug/convex/page.tsx wraps in <div> (no <main>), all content preserved, and debug-route.test.ts is GREEN.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit` — loading-skeletons.test.ts + debug-route.test.ts GREEN; all prior 234 tests GREEN.
- `pnpm --filter web build` exits 0 (App Router picks up the 4 loading.tsx files; no TS error).
- Single-main invariant: only apps/web/app/layout.tsx contains `<main` across the route tree.
</verification>

<success_criteria>
- 4 loading.tsx skeletons (animate-pulse + --color-line, no <main>, no hex, no 'use client') mirror their page layouts.
- /_debug/convex uses <div>; loading-skeletons.test.ts + debug-route.test.ts GREEN; 234 baseline + build green.
</success_criteria>

<output>
After completion, create `.planning/phases/17-ui-ux-audit-follow-ups/17-04-SUMMARY.md`
</output>
