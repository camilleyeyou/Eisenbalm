---
phase: 02-web-shell-theme-engine
plan: "07"
subsystem: apps/web
tags: [next.js, sanity, archive, search, sort, rsc, client-component]
dependency_graph:
  requires: ["02-01", "02-02", "02-05"]
  provides: ["/archive route", "ArchiveItem", "ArchiveList"]
  affects: ["apps/web/app/archive/page.tsx", "apps/web/components/archive/"]
tech_stack:
  added: []
  patterns:
    - RSC page delegates data fetch; client component owns interactive state
    - useMemo for derived filtered+sorted list (no external search lib)
    - CSS variable typography classes (font-display, font-ui)
key_files:
  created:
    - apps/web/app/archive/page.tsx
    - apps/web/components/archive/ArchiveItem.tsx
    - apps/web/components/archive/ArchiveList.tsx
  modified:
    - apps/web/components/issue/IssueHero.tsx (pre-existing TS error fix)
decisions:
  - "Empty-list state ('Nothing to read yet.') rendered in the RSC; empty-search state ('No issues match that search.') rendered in the client ArchiveList"
  - "Auto-fixed pre-existing TS2769 in IssueHero.tsx (array destructure of map(Number)) so typecheck passes — out-of-scope bug but blocked success criterion"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-11"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 1
requirements:
  - WEB-03
  - WEB-11
---

# Phase 02 Plan 07: Archive Route Summary

One-liner: `/archive` RSC fetches QUERY_ARCHIVE and passes results to `ArchiveList` — a client component with case-insensitive substring search on `charity.name`/`focusArea` and a newest/oldest sort toggle.

## What Was Built

### `apps/web/app/archive/page.tsx`

Server component. Exports `revalidate = 60` and `metadata` (title, description, OG/Twitter cards matching UI-SPEC §SEO). Fetches `QUERY_ARCHIVE` via `sanityClient`. Renders:
- `<h1>` "Archive" (Display font, 28px mobile / 36px desktop)
- Subtitle "Every issue of The Eisenbalm Dispatch." (UI font, 14px, muted)
- `<ArchiveList issues={issues} />` when there are published issues
- Empty state "Nothing to read yet." when `issues` is empty or null

### `apps/web/components/archive/ArchiveItem.tsx`

Server-compatible (no client hooks). Renders one issue row per UI-SPEC §10:
- Issue number label (UI font, 14px, muted)
- Charity name as `<Link>` to `/issue/{slug}` (Display font, 22px semibold, primary color, accent on hover with underline)
- Focus area, location, publish date (formatted as "Month YYYY" via `formatMonthYear`), asset range (12px, appended "assets"), bonus type label via `BONUS_LABEL` map
- 1px `--color-border` bottom border, 24px vertical padding

### `apps/web/components/archive/ArchiveList.tsx`

`'use client'`. Owns `query` (string) and `order` (`'newest' | 'oldest'`) state. Filtering logic in `useMemo`:
- Trims and lowercases the search query
- Matches `charity.name.toLowerCase().includes(q)` OR `charity.focusArea.toLowerCase().includes(q)`
- Sorts by `issueNumber` descending (newest) or ascending (oldest)
- Spread-copies the matched array before sorting to avoid mutation

UI elements per UI-SPEC §11:
- `<input type="search">` (100% mobile, 320px desktop, plain Tailwind — no shadcn)
- "Newest first" / "Oldest first" text buttons with active underline state
- `<p role="status" aria-live="polite">Showing {N} issue[s]</p>`
- Empty-search state: "No issues match that search." (UI font, centered)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing TS2769 in IssueHero.tsx**
- **Found during:** Task 3 verification (`pnpm --filter web typecheck`)
- **Issue:** `const [year, month, day] = dateStr.split('-').map(Number)` — TypeScript infers destructured elements as `number | undefined` because `Array.prototype.map` returns `number[]`, not a tuple. `Date.UTC(year, month - 1, day)` then errors on possibly-undefined args.
- **Fix:** Replaced destructure with indexed access + nullish coalesce fallback values (`?? 2000`, `?? 1`, `?? 1`). Zero behavior change since Sanity always stores ISO-8601 date strings with all three parts.
- **Files modified:** `apps/web/components/issue/IssueHero.tsx` line 22
- **Commit:** f94c4e5

### Scope Clarification

The plan specified `ArchiveSearchInput` as a separate component file; the UI-SPEC and plan body use `ArchiveList` as the client component name. Following the plan body and UI-SPEC — the search input is embedded inside `ArchiveList.tsx` per the spec ("Client component: search input + sort buttons + filtered list"). No separate `ArchiveSearchInput.tsx` was created; this matches the plan's `files_modified` artifacts list which names `ArchiveList.tsx`.

## Known Stubs

None. The archive page is fully wired: fetch → filter → render. The empty state ("Nothing to read yet.") displays correctly when Sanity has no published issues.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `apps/web/app/archive/page.tsx` exists | FOUND |
| `apps/web/components/archive/ArchiveItem.tsx` exists | FOUND |
| `apps/web/components/archive/ArchiveList.tsx` exists | FOUND |
| Commit f94c4e5 exists | FOUND |
| typecheck exits 0 | PASS |
| No exclamation marks in new files | PASS |
