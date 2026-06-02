---
phase: 17-ui-ux-audit-follow-ups
plan: 03
type: execute
wave: 2
depends_on: [17-01]
files_modified:
  - apps/web/components/archive/ArchiveList.tsx
autonomous: true
requirements: [P17-03, P17-07]
user_setup: []

must_haves:
  truths:
    - "The archive shows the first PAGE_SIZE (10) issues initially and reveals 10 more per 'Load more' click"
    - "Searching or changing sort order resets the visible count to PAGE_SIZE (no stale 0-of-N state)"
    - "The 'Load more' button only appears when more filtered issues remain (hasMore) and is a ≥44px touch target"
    - "CardSwap in archive/page.tsx still receives the full issues array (unchanged); GROQ QUERY_ARCHIVE unchanged"
    - "archive-pagination.test.ts is GREEN; dep count stays 17; 234 baseline preserved"
  artifacts:
    - path: "apps/web/components/archive/ArchiveList.tsx"
      provides: "Client-side load-more: PAGE_SIZE const, visibleCount state, useEffect reset, sliced render, hasMore button"
      contains: "const PAGE_SIZE"
  key_links:
    - from: "apps/web/components/archive/ArchiveList.tsx"
      to: "filtered (existing useMemo result)"
      via: "filtered.slice(0, visibleCount) for display + filtered.length > visibleCount for hasMore"
      pattern: "slice\\(0, visibleCount\\)"
    - from: "useEffect([query, order])"
      to: "setVisibleCount(PAGE_SIZE)"
      via: "reset visible window when search/sort changes (Pitfall 3)"
      pattern: "setVisibleCount\\(PAGE_SIZE\\)"
---

<objective>
Add client-side "load more" pagination to ArchiveList.tsx so the archive renders the first 10 issues immediately and reveals 10 more per click, instead of dumping every published issue into one payload. All state stays inside the already-`'use client'` ArchiveList; the GROQ query, the IssueBonus/ArchiveIssue types, and the CardSwap full-list feed are untouched.

Purpose: Keep the archive payload and DOM bounded as the weekly Dispatch accumulates issues, without a contract-touching GROQ cursor change.
Output: ArchiveList.tsx with PAGE_SIZE/visibleCount/load-more; archive-pagination.test.ts GREEN; dep count still 17.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/17-ui-ux-audit-follow-ups/17-RESEARCH.md

<interfaces>
<!-- Current ArchiveList signature + state (apps/web/components/archive/ArchiveList.tsx): -->
<!--   'use client'; imports { useMemo, useState } from 'react'; props { issues: ArchiveIssue[] } -->
<!--   const filtered = useMemo(...) — search + sort over issues; returns sorted array -->
<!--   renders: search input, two sort buttons (each already min-h-11), a role="status" count <p>, and a <ul> mapping filtered -> ArchiveItem -->
<!-- CardSwap lives in archive/page.tsx and receives the FULL issues array — DO NOT touch page.tsx. -->
<!-- QUERY_ARCHIVE is in docs/API_CONTRACTS.md §1.3 — DO NOT change the GROQ (Anti-pattern in research). -->

Current count paragraph (preserve role/aria, update the number to show visible-of-filtered):
```tsx
<p role="status" aria-live="polite" className="mt-6 font-ui text-[14px] text-[color:var(--color-text-muted)]">
  Showing {filtered.length} {filtered.length === 1 ? 'issue' : 'issues'}
</p>
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add client-side load-more to ArchiveList</name>
  <files>apps/web/components/archive/ArchiveList.tsx</files>
  <read_first>
    - apps/web/components/archive/ArchiveList.tsx (full file — current useMemo `filtered`, the count <p> at L64-70, the <ul> map at L76-81)
    - apps/web/components/archive/ArchiveItem.tsx (confirm it keys on `issue.slug` — the map key stays the same)
    - .planning/phases/17-ui-ux-audit-follow-ups/17-RESEARCH.md (Pattern 2 full code; Pitfall 3 search/sort reset)
    - apps/web/__tests__/archive-pagination.test.ts (the 5 ArchiveList assertions + dep guard this task must satisfy)
  </read_first>
  <action>
    1. Update the React import to include useEffect: `import { useEffect, useMemo, useState } from 'react'`.
    2. Add a module-level constant ABOVE the component: `const PAGE_SIZE = 10` with a one-line comment `// Initial visible count + increment per "Load more" (P17-03; tunable single source of truth).`
    3. Add state inside the component: `const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)`.
    4. After the existing `filtered` useMemo, derive: `const visible = filtered.slice(0, visibleCount)` and `const hasMore = filtered.length > visibleCount`.
    5. Add a reset effect: `useEffect(() => { setVisibleCount(PAGE_SIZE) }, [query, order])` (Pitfall 3 — without this, clearing a search can show a stale window).
    6. Change the count paragraph text to reflect the window: `Showing {visible.length} of {filtered.length} {filtered.length === 1 ? 'issue' : 'issues'}` — keep `role="status"`, `aria-live="polite"`, and all classes verbatim.
    7. Change the `<ul>` map to iterate `visible` instead of `filtered` (key stays `issue.slug`).
    8. After the `<ul>` (still inside the non-empty branch), render the load-more button only when `hasMore`:
       ```tsx
       {hasMore && (
         <button
           type="button"
           onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
           className="mt-6 inline-flex items-center justify-center min-h-11 rounded border border-[color:var(--color-border)] px-4 font-ui text-[14px] text-[color:var(--color-text)] hover:text-[color:var(--color-text)] focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)] focus-visible:outline-offset-2"
         >
           Load {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more
         </button>
       )}
       ```
    All colors MUST use `var(--color-*)` tokens (no hex). The empty-search branch ("No issues match that search.") stays unchanged. Do NOT edit archive/page.tsx, the GROQ query, or any type.
  </action>
  <acceptance_criteria>
    - `grep -q "const PAGE_SIZE = 10" apps/web/components/archive/ArchiveList.tsx` exits 0
    - `grep -q "visibleCount" apps/web/components/archive/ArchiveList.tsx` exits 0
    - `grep -q "filtered.slice(0, visibleCount)" apps/web/components/archive/ArchiveList.tsx` exits 0
    - `grep -q "setVisibleCount(PAGE_SIZE)" apps/web/components/archive/ArchiveList.tsx` exits 0
    - `grep -q "hasMore" apps/web/components/archive/ArchiveList.tsx` exits 0
    - `grep -q "min-h-11" apps/web/components/archive/ArchiveList.tsx` exits 0 (load-more button touch target)
    - `grep -q "useEffect" apps/web/components/archive/ArchiveList.tsx` exits 0
    - `grep -c "#[0-9a-fA-F]\{6\}" apps/web/components/archive/ArchiveList.tsx` returns 0 (no hardcoded hex introduced)
    - `pnpm --filter web test:unit -- --run archive-pagination` exits 0 (5 ArchiveList assertions + dep-count guard at 17 all GREEN)
  </acceptance_criteria>
  <verify>
    <automated>cd apps/web && pnpm test:unit -- --run archive-pagination 2>&1 | grep -E "passed|failed"</automated>
  </verify>
  <done>ArchiveList renders `visible` (sliced to visibleCount), resets to PAGE_SIZE on search/sort change, shows a ≥44px "Load N more" button only when hasMore, and archive-pagination.test.ts (incl. the dep-count===17 guard) is GREEN.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit` — archive-pagination.test.ts GREEN; 234 baseline GREEN; archive-cardswap.test.ts dep-count assertion still GREEN (17).
- `pnpm --filter web build` exits 0.
- No hardcoded hex in ArchiveList.tsx; CardSwap still gets the full list (archive/page.tsx unchanged).
</verification>

<success_criteria>
- PAGE_SIZE=10 single named const; visibleCount state; useEffect reset on [query, order]; sliced `visible` render; hasMore-gated ≥44px load-more button.
- archive-pagination.test.ts GREEN; dep count 17; build exits 0; GROQ + page.tsx + types unchanged.
</success_criteria>

<output>
After completion, create `.planning/phases/17-ui-ux-audit-follow-ups/17-03-SUMMARY.md`
</output>
