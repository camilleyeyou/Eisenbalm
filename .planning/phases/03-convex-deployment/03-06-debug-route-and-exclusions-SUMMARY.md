---
phase: 03-convex-deployment
plan: 06
subsystem: ui
tags: [next.js, convex, react-19, useQuery, app-router, private-folders, robots.txt, sitemap, rss]

requires:
  - phase: 03-convex-deployment
    provides: ConvexClientProvider mounted in root layout; @convex/* TS path alias; convex@^1.38.0 dep (Plan 03-05)
  - phase: 03-convex-deployment
    provides: Five Convex byRunId queries deployed + typed via _generated/api (Plans 03-03, 03-04)
provides:
  - "/_debug/convex evidence route exercising all 5 useQuery calls against synthetic runId 'phase-3-smoke-test' — CVX-05 surface"
  - "Phase 9 cleanup contract locked via TODO(Phase 9) header comment + greppable exclusion markers in sitemap/feed/robots"
  - "Search-engine + URL-surface exclusion of /_debug/* (robots Disallow, sitemap+RSS marker comments, page-level noindex,nofollow meta)"
affects: [Phase 03 Plan 03-07 README, Phase 03 Plan 03-08 smoke test, Phase 9 DeliberationSlot wiring + /_debug/* removal]

tech-stack:
  added: []
  patterns:
    - "Next.js App Router private folder escape: source folder named %5Fdebug (URL-encoded underscore) routes to URL segment /_debug. Plain _debug is a private folder per Next 15 conventions and is excluded from routing entirely."
    - "Three-layer exclusion contract for hidden routes: robots.txt Disallow + greppable JSDoc/inline marker in every URL-emitting handler + page-level <meta name='robots' content='noindex,nofollow'>"
    - "useQuery loading vs. empty-result distinction: rowCount helper renders '—' for undefined (loading), '0' for null (.first) and [] (.collect), '1' for any other value"

key-files:
  created:
    - "apps/web/app/%5Fdebug/convex/page.tsx (74 lines) — Client Component with 5 useQuery calls; on-disk path uses URL-encoded underscore, public URL is /_debug/convex"
  modified:
    - "apps/web/public/robots.txt (1 line added: Disallow: /_debug/)"
    - "apps/web/app/sitemap.ts (JSDoc extended + inline marker comment, no code change)"
    - "apps/web/app/feed.xml/route.ts (JSDoc extended + inline marker comment, no code change)"

key-decisions:
  - "Folder renamed _debug → %5Fdebug to satisfy Next.js 15 private-folder convention. The public URL stays /_debug/convex; all URL-based contracts (robots.txt Disallow, sitemap/feed marker text, Plan 03-08 smoke URL) are unchanged."
  - "Used Tailwind brand tokens (font-display, font-ui, opacity-60) so the dry table matches the editorial register without inventing new styles. Voice copy: 'Convex smoke test' / 'Empty by design.' — no emojis, no decoration (per Jesse-voice constraint and CONTEXT.md Claude's Discretion)."
  - "Page-level <meta name='robots' content='noindex,nofollow'> placed inside JSX rather than via metadata export — metadata export does not run on Client Components but inline <meta> in JSX is surfaced by Next.js to the rendered <head>."

patterns-established:
  - "Hidden route escape with %5F: any future /_*/ debug or admin surface should use the %5F<name> folder pattern, not the literal underscore."
  - "Greppable exclusion marker text 'Exclusion: do not list /_debug/* routes (Phase 3 D-18)' as the positive-assertion anchor Phase 9 can verify with a single grep."

requirements-completed: [CVX-05]

duration: 7min
completed: 2026-05-13
---

# Phase 03 Plan 06: Debug Route and Exclusions Summary

**`/_debug/convex` evidence surface with 5 live Convex useQuery subscriptions, three-layer search-engine + URL exclusion contract, and Phase 9 cleanup TODO baked into the file header**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-13T17:31:59Z
- **Completed:** 2026-05-13T17:39:00Z (approx — folder-rename deviation added a build verification cycle)
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments
- Browser-reachable `/_debug/convex` route that runs all five `byRunId` Convex queries against the synthetic runId `"phase-3-smoke-test"` — verified by `curl -o - http://localhost:3000/_debug/convex` returning HTTP 200 with both the page title `Convex smoke test` and the synthetic runId rendered in the body.
- Phase 9 cleanup contract locked: `TODO(Phase 9): REMOVE THIS FILE.` at the top of `page.tsx` with explicit 4-step removal instructions covering the page file, the parent folder, the robots.txt line, and the README mention.
- `/_debug/*` excluded from every public URL surface: `Disallow: /_debug/` in `robots.txt`, `// Exclusion: do not list /_debug/* routes (Phase 3 D-18)` inline marker in both `sitemap.ts` and `feed.xml/route.ts`, and `<meta name="robots" content="noindex,nofollow" />` on the page itself.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create apps/web/app/_debug/convex/page.tsx with 5 useQuery calls and TODO(Phase 9) comment** — `ee66821` (feat)
2. **Task 2: Add `Disallow: /_debug/` to apps/web/public/robots.txt** — `1495890` (chore)
3. **Task 3: Add explicit /_debug exclusion-marker comments to sitemap.ts and feed.xml/route.ts (+ Rule 3 folder rename)** — `30e070c` (chore)

## Files Created/Modified

- `apps/web/app/%5Fdebug/convex/page.tsx` (created, 74 lines) — Client Component: `'use client'` directive, JSDoc with `TODO(Phase 9)` cleanup instructions, `SMOKE_TEST_RUN_ID = 'phase-3-smoke-test'`, `rowCount(data)` helper handling `undefined`/`null`/array/other, five `useQuery(api.<table>.byRunId, { runId: SMOKE_TEST_RUN_ID })` calls covering pipelineRuns, pitchLog, deliberationEvents, agentVotes, qaCorrections, dry table render in Jesse voice with Tailwind brand tokens, inline `<meta name="robots" content="noindex,nofollow" />`.
- `apps/web/public/robots.txt` (1 line added) — `Disallow: /_debug/` placed after `Disallow: /_next/` for visual grouping of underscore-prefixed exclusions. Diff: `+Disallow: /_debug/`.
- `apps/web/app/sitemap.ts` (comments only) — JSDoc extended with a new `Exclusion: /_debug/*` paragraph explaining why the hardcoded `staticEntries` list cannot leak `/_debug/*`; inline `// Exclusion: do not list /_debug/* routes (Phase 3 D-18)` comment added immediately above `const staticEntries`.
- `apps/web/app/feed.xml/route.ts` (comments only) — JSDoc extended with the same `Exclusion: /_debug/*` paragraph; inline `// Exclusion: do not list /_debug/* routes (Phase 3 D-18)` comment added immediately after `const base = getSiteUrl()` inside the route handler.

Exact marker comment line added to both files:
```
// Exclusion: do not list /_debug/* routes (Phase 3 D-18)
```

## Decisions Made

- **Folder name uses %5F (URL-encoded underscore) on disk; URL stays `/_debug/convex`.** Per Next.js 15 App Router private-folder convention, a folder literally named `_debug` is excluded from routing regardless of whether it contains a `page.tsx`. The documented escape is to name the folder `%5Fdebug` so the URL segment renders the literal underscore. This preserves every URL-based contract (robots.txt `Disallow: /_debug/`, sitemap/feed marker comments, Plan 03-08 smoke-test URL) byte-for-byte.
- **`<meta name="robots" content="noindex,nofollow" />` inline in JSX, not via the Metadata export.** Next.js's `export const metadata` does not run on Client Components — but Next.js does surface inline `<meta>` elements from the JSX into the rendered `<head>`. This is the only path that works for a `'use client'` page that needs `noindex,nofollow`.
- **Voice copy locked.** Page title is `Convex smoke test`, supporting text is `Run ID: phase-3-smoke-test. Empty by design.` — no emojis, no winking, no exclamation marks, no decorative chrome (per Jesse voice + CONTEXT.md Claude's Discretion).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Renamed source folder `_debug` → `%5Fdebug` to make the URL reachable**

- **Found during:** Task 3 plan-level integration check (`pnpm build` succeeded but `/_debug/convex` was absent from the route table; `curl http://localhost:3000/_debug/convex` returned HTTP 404).
- **Issue:** 03-RESEARCH.md Pitfall 7 claimed that "since `_debug/convex/page.tsx` exists, Next.js explicitly *does* turn it into a route" — this is **incorrect for Next.js 15**. Per the official App Router private-folders documentation, `_foldername` is *always* a private folder excluded from routing, regardless of whether it contains a `page.tsx`. Pitfall 7 even supplied the verification step ("If 404 happens, rename...") so the research authors had foreseen this exact failure mode. The success criterion in the plan ("Visiting `http://localhost:3000/_debug/convex` renders the table") could not be met with the literal `_debug` folder name.
- **Fix:** `git mv apps/web/app/_debug apps/web/app/%5Fdebug`. Per Next.js docs: "You can include an underscore in URL segments by prefixing the folder name with `%5F` (the URL-encoded form of an underscore)." The on-disk folder is now `%5Fdebug`, the URL segment renders as `_debug`, and every URL-based contract in this plan (robots.txt, sitemap markers, feed markers, page meta tag) is preserved exactly because they're all URL-string-based, not filesystem-based.
- **Files modified:** `apps/web/app/_debug/convex/page.tsx` → `apps/web/app/%5Fdebug/convex/page.tsx` (rename only, content unchanged).
- **Verification:**
  - `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/_debug/convex` → `200` (was `404` before the rename).
  - Curl body contains both `Convex smoke test` (title) and `phase-3-smoke-test` (synthetic runId).
  - `pnpm build` route table now lists `○ /_debug/convex` (was absent before the rename).
  - `find .next/server/app -path '*_debug*'` returns the compiled artifacts at the expected URL path.
  - The plan's verification grep `test -f apps/web/app/_debug/convex/page.tsx` was adapted to `test -f apps/web/app/%5Fdebug/convex/page.tsx`; every other check in the chain ran unchanged against the new file and all 12 markers passed.
- **Committed in:** `30e070c` (Task 3 commit — combined with the sitemap/feed marker comments so the entire `/_debug/*` URL-surface contract lands in a single commit).

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking, framework-convention mismatch).
**Impact on plan:** Necessary to satisfy the plan's own success criterion ("`/_debug/convex` renders the table"). No scope expansion — the URL surface, the file count, the line count (74), the test markers, and the Phase 9 cleanup contract are all unchanged. The only difference from the plan's literal text is the on-disk folder name; the plan's `files_modified` array reference to `apps/web/app/_debug/convex/page.tsx` is semantically satisfied (the URL is `/_debug/convex` and the page exists) even though the on-disk path now uses `%5F`. The plan-level verification regex `Exclusion:.*\/_debug` matches the URL-based exclusion markers verbatim.

## Issues Encountered

- None beyond the Pitfall-7-inversion documented in Deviations. `pnpm typecheck` and `pnpm build` exited 0 on the first attempt for Tasks 1 and 2, and on the first attempt after the Task 3 folder rename. No transient errors, no missing dependencies, no Convex API surface mismatches.

## Verification Run

Plan-level integration check executed after all three tasks:

```bash
# Adapted from the plan's <verification> block (only the file path token changed; all greps unchanged)
DEBUG_PAGE='apps/web/app/%5Fdebug/convex/page.tsx'
test -f "$DEBUG_PAGE" \
  && grep -q "'use client'" "$DEBUG_PAGE" \
  && grep -q "TODO(Phase 9)" "$DEBUG_PAGE" \
  && grep -q "from '@convex/_generated/api'" "$DEBUG_PAGE" \
  && grep -q "phase-3-smoke-test" "$DEBUG_PAGE" \
  && grep -q "useQuery(api.pipelineRuns.byRunId" "$DEBUG_PAGE" \
  && grep -q "useQuery(api.pitchLog.byRunId" "$DEBUG_PAGE" \
  && grep -q "useQuery(api.deliberationEvents.byRunId" "$DEBUG_PAGE" \
  && grep -q "useQuery(api.agentVotes.byRunId" "$DEBUG_PAGE" \
  && grep -q "useQuery(api.qaCorrections.byRunId" "$DEBUG_PAGE" \
  && grep -q "function rowCount" "$DEBUG_PAGE" \
  && grep -q "noindex,nofollow" "$DEBUG_PAGE" \
  && grep -q "Exclusion:.*\/_debug" apps/web/app/sitemap.ts \
  && grep -q "Exclusion:.*\/_debug" apps/web/app/feed.xml/route.ts \
  && grep -q "Disallow: /_debug/" apps/web/public/robots.txt \
  && cd apps/web && pnpm typecheck && pnpm build
# → ALL CHECKS PASS, pnpm build exit 0, /_debug/convex listed in route table
```

Live smoke test (Plan 03-08 owns the full version):

```
HTTP_STATUS:200
<h1 class="font-display text-2xl mb-2">Convex smoke test</h1>
<p class="font-ui text-sm opacity-60 mb-6">Run ID: phase-3-smoke-test. Empty by design.</p>
... five table rows (pipelineRuns / pitchLog / deliberationEvents / agentVotes / qaCorrections) ...
```

Cell values render `—` while the websocket warms up, then `0` for `pipelineRuns` (`null` from `.first()`), `0` for the other four (`[]` from `.collect()`). No errors in `pnpm dev` console.

## User Setup Required

None - all infrastructure (Convex deployment, env vars, provider wiring) was provisioned in Plans 03-01 through 03-05.

## Next Phase Readiness

- Plan 03-07 (documentation) can reference the live `/_debug/convex` route in `apps/web/README.md` and `convex/README.md`; the README must mention the `%5F` folder-name convention so future engineers don't re-introduce the literal `_debug` regression.
- Plan 03-08 (smoke test) can execute its 6-step verification using `http://localhost:3000/_debug/convex` exactly as written — the URL is unchanged from the original plan text.
- Phase 9 cleanup contract is locked: the `TODO(Phase 9)` header in `page.tsx`, the `Exclusion: /_debug/*` JSDoc paragraphs in `sitemap.ts` and `feed.xml/route.ts`, and the `Disallow: /_debug/` line in `robots.txt` are all greppable anchors for the Phase 9 planner's removal task.

## Self-Check: PASSED

All five files present on disk; all three task commits resolvable in `git log`.

---
*Phase: 03-convex-deployment*
*Completed: 2026-05-13*
