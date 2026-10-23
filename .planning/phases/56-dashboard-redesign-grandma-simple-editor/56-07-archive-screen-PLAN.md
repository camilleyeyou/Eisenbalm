---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 07
type: execute
wave: 3
depends_on: [56-01, 56-02, 56-03]
files_modified:
  - apps/dispatch-control/app/(editorial)/archive/page.tsx
  - apps/dispatch-control/app/(editorial)/archive/_components/ArchiveBody.tsx
  - apps/dispatch-control/__tests__/ArchiveScreen.test.tsx
autonomous: true
requirements: [P56-A1, P56-A2, P56-A3, P56-B1]

must_haves:
  truths:
    - "Past issues lists every issue newest first as 'Issue 47 · 22 October 2026', charity name as a link, and a status word"
    - "Clicking a charity name opens that issue's Home view at /?run=<runId> (client bug 1)"
    - "Stopped and Problem issues sit in a collapsed 'Stopped or unfinished issues (N)' section at the bottom, each with a plain reason; Problem rows link 'What happened'"
    - "Stopped is told apart from Problem using the runs table (cancelled vs failed), not pipelineRuns.status"
    - "Search 'Find an issue' filters by charity name or issue number; no chips, no filter pills, no mono caps, no run ids"
    - "Old /issues/:n redirects still land on /archive?issue=:n and forward to that issue"
  artifacts:
    - path: "apps/dispatch-control/app/(editorial)/archive/_components/ArchiveBody.tsx"
      provides: "Pure archive view"
    - path: "apps/dispatch-control/app/(editorial)/archive/page.tsx"
      provides: "Data wrapper joining issues.listWithTitles + runs.listRecentForWorkspace"
      contains: "listRecentForWorkspace"
  key_links:
    - from: "archive/page.tsx"
      to: "lib/editorState.ts"
      via: "deriveArchiveRows"
      pattern: "deriveArchiveRows\\("
    - from: "ArchiveBody.tsx"
      to: "lib/issueRouteResolver.ts"
      via: "issueOpenHref → /?run="
      pattern: "issueOpenHref\\("
---

<objective>
Rebuild `/archive` to the Archive artboard using the pure `deriveArchiveRows` join, a plain search field, and the collapsed Stopped/unfinished list. Remove the HeldIssueRow import (the file itself is deleted in plan 56-12).

Purpose: Locked decision 7; client bugs 1 and 4; research finding 2 (Stopped vs Problem needs the runs table). No Convex change.
Output: rebuilt page + ArchiveBody + rewritten ArchiveScreen.test.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/canvas/Archive.dc.html
@apps/dispatch-control/app/(editorial)/archive/page.tsx
@apps/dispatch-control/app/(editorial)/archive/_components/ArchiveBody.tsx
@apps/dispatch-control/lib/editorState.ts

<interfaces>
```typescript
// Convex (no changes): api.issues.listWithTitles({ workspace_id }) ; api.runs.listRecentForWorkspace({ workspace_id }) -> runs rows (take 100) ; api.runs.latest({ workspace_id })
// lib/editorState.ts (56-01)
deriveArchiveRows({ issues, runs, currentRunId }): { listed: ArchiveRowVM[]; unfinished: ArchiveRowVM[] } | undefined
interface ArchiveRowVM { runId; issueNumber; dateLine; title; word: StatusWord; statusText; reason?; current: boolean; publishedUrl?: string | null }
COPY.archiveSlab, COPY.archiveSlabWaiting ('Issue {N} is waiting for you.'), COPY.thisWeeksIssue, COPY.emptyArchive, COPY.emptySearch
// lib/issueRouteResolver.ts: issueOpenHref(runId, currentRunId) -> '/' | '/?run=<id>' ; adminRunHref(runId) ; parseIssueNumber(param)
// components/editor: NextStepSlab, StatusWord
```
Current page.tsx reads `searchParams.issue` (forwarding from next.config.ts `/issues/:n` redirects, guarded by nextConfigRedirects.test.ts) — keep that forwarding: if `?issue=N` matches a row, `router.replace(issueOpenHref(row.runId, currentRunId))`.
Public link: reuse the website URL pattern the current ArchiveBody uses for "Read on the website" (find it in ArchiveBody.tsx; keep it identical).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: ArchiveBody pure view</name>
  <files>apps/dispatch-control/app/(editorial)/archive/_components/ArchiveBody.tsx, apps/dispatch-control/__tests__/ArchiveScreen.test.tsx</files>
  <read_first>
    - current ArchiveBody.tsx (to find the public website URL helper; everything else is replaced)
    - 56-UI-SPEC.md § "7. Past issues (/archive)" and § Responsive contract Archive bullet; Copywriting Archive row and empty states
    - canvas/Archive.dc.html
  </read_first>
  <behavior>
    - renders h1 'Past issues', subtitle 'Every issue so far, newest first.', a labelled input 'Find an issue' with placeholder 'Charity name or issue number'
    - listed rows: date line, charity name as a link to issueOpenHref(runId, currentRunId), StatusWord text ('Published' / 'Waiting for you · this week' / 'Working'), and for published rows a link 'Read on the website' (target _blank)
    - the current row has the class bg-[color:var(--color-current)]
    - typing 'kumasi' shows only matching rows; typing '47' shows Issue 47; no match → 'No issue matches "zzz". Try a charity name or an issue number.'
    - unfinished rows are inside a closed `details` whose summary reads 'Stopped or unfinished issues (2)'; each shows its reason in italic; Problem rows have 'What happened' → /admin/runs/<id>; section absent when there are none
    - empty listed and unfinished → 'No past issues yet. Once you publish an issue it will be listed here.'
    - slab: 'Nothing is waiting here. Open an issue to read it or change its words.' (or 'Issue 48 is waiting for you.' when a current row is Waiting for you) with ghost "This week's issue" → '/'; zero [data-primary]
    - textContent never matches EDITOR_BANNED_PATTERN or RUN_ID_PATTERN (fixture run ids are 12-hex strings)
  </behavior>
  <action>
Replace ArchiveBody.tsx entirely ('use client' for the search state). Props: `{ rows: { listed: ArchiveRowVM[]; unfinished: ArchiveRowVM[] } | undefined; currentRunId: string | null; websiteUrlFor: (issueNumber: number) => string | null }`. Delete GROUP_CHIP_META, filter pills, ArchiveGroupKey and all mono/uppercase styling. Markup:
- `NextStepSlab` (sentence per behavior, ghost `{ label: COPY.thisWeeksIssue, href: '/' }`).
- Header block: `h1` Newsreader `text-[32px] sm:text-[42px] font-semibold`; subtitle Lora 17px; search `label` 15px/600 + `input type="search"` `min-h-[48px] w-full sm:w-[360px] border border-[color:var(--color-ink)] bg-[color:var(--color-card)] px-4 text-[17px] focus:outline-[3px] focus:outline-[color:var(--color-cobalt)]`.
- List `ol` same chrome as PartsList (white, 1px line-strong, rows divided by 1px line). Row: phone 3 lines (date 15px / name Newsreader 23/500 link min-h-[48px] / status + website link); sm+ `sm:flex sm:items-baseline sm:gap-6` with date `sm:w-[200px]`, name flex-1, status, website link. `min-h-[64px] px-4 sm:px-6 py-4`. Current row tint.
- `details` (closed) `summary` full-width `min-h-[48px]` 17px/600 `Stopped or unfinished issues ({n})`; rows: date line, Lora italic 18px reason, StatusWord, Problem → Link 'What happened' (`adminRunHref`). Stopped/Problem names are not links (they redirect anyway).
- Filter: case-insensitive `title.includes(q)` or `String(issueNumber) === q.replace(/\D/g,'')`; applies to both lists.
- Loading (`rows === undefined`): SkeletonLine x4.
Rewrite `__tests__/ArchiveScreen.test.tsx` from scratch covering the behavior list (render ArchiveBody with fixture rows from real `deriveArchiveRows`).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/ArchiveScreen.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "GROUP_CHIP_META|font-mono|uppercase|tracking-|text-\[(9|10|11|12|13|14|16)px\]" "apps/dispatch-control/app/(editorial)/archive/_components/ArchiveBody.tsx"` returns nothing
    - `grep -n "issueOpenHref(" "apps/dispatch-control/app/(editorial)/archive/_components/ArchiveBody.tsx"` matches
    - `grep -n "Stopped or unfinished issues" "apps/dispatch-control/app/(editorial)/archive/_components/ArchiveBody.tsx"` matches
    - ArchiveScreen.test.tsx passes
  </acceptance_criteria>
  <done>Archive view matches the artboard and copy contract.</done>
</task>

<task type="auto">
  <name>Task 2: Archive data wrapper (join + ?issue= forwarding), drop HeldIssueRow import</name>
  <files>apps/dispatch-control/app/(editorial)/archive/page.tsx</files>
  <read_first>
    - current archive/page.tsx (searchParams + `?issue=` forwarding, HeldIssueRow import)
    - apps/dispatch-control/__tests__/nextConfigRedirects.test.ts (must stay green)
    - convex/issues.ts listWithTitles return fields and convex/runs.ts listRecentForWorkspace
  </read_first>
  <action>
Rewrite page.tsx ('use client', keep its existing searchParams handling style): `issues = useQuery(api.issues.listWithTitles, { workspace_id: DEFAULT_WORKSPACE_ID })`, `runs = useQuery(api.runs.listRecentForWorkspace, { workspace_id: DEFAULT_WORKSPACE_ID })`, `latest = useQuery(api.runs.latest, { workspace_id: DEFAULT_WORKSPACE_ID })`. `rows = issues === undefined ? undefined : deriveArchiveRows({ issues: issues.map(i => ({ issueNumber: i.issueNumber, title: i.title, published: i.published, runId: i.runId, publishedAt: i.publishedAt, runStartedAt: i.runStartedAt, scheduledFor: i.scheduledFor })), runs, currentRunId: latest?.runId ?? null })` (adapt field names to the actual listWithTitles return — read it; do not change Convex). `?issue=N`: once rows load, find the row with that issueNumber in listed or unfinished and `router.replace(issueOpenHref(row.runId, currentRunId))`. Render `<ArchiveBody rows={rows} currentRunId=... websiteUrlFor=... />`. Remove the `HeldIssueRow` import and its usage. No Convex file is touched (no dev:once needed).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/ArchiveScreen.test.tsx __tests__/nextConfigRedirects.test.ts && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "HeldIssueRow" "apps/dispatch-control/app/(editorial)/archive/page.tsx"` returns nothing
    - `grep -n "listRecentForWorkspace\|deriveArchiveRows(" "apps/dispatch-control/app/(editorial)/archive/page.tsx" | wc -l` >= 2
    - `git diff --name-only -- convex/` is empty
    - tests pass; strict build exits 0
  </acceptance_criteria>
  <done>Past issues is live; titles open the issue; stopped issues are collapsed with plain reasons.</done>
</task>

</tasks>

<verification>
ArchiveScreen + nextConfigRedirects green; strict build green.
</verification>

<success_criteria>
Archive artboard live; bug 1 closed; ASSUMPTION A5 (generic reasons) applied.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-07-SUMMARY.md`
</output>
