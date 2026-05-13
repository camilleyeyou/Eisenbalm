---
phase: 03-convex-deployment
plan: 06
type: execute
wave: 6
depends_on:
  - "03-05"
files_modified:
  - apps/web/app/_debug/convex/page.tsx
  - apps/web/public/robots.txt
  - apps/web/app/sitemap.ts
  - apps/web/app/feed.xml/route.ts
autonomous: true
requirements:
  - CVX-05
must_haves:
  truths:
    - "apps/web/app/_debug/convex/page.tsx exists, is a Client Component, calls useQuery on all 5 byRunId queries with runId='phase-3-smoke-test', renders a five-row table"
    - "page.tsx top of file contains a TODO(Phase 9) comment naming the cleanup contract (D-24)"
    - "apps/web/public/robots.txt adds `Disallow: /_debug/`"
    - "apps/web/app/sitemap.ts does NOT emit any /_debug URL (verified by positive grep on the explicit exclusion marker comment)"
    - "apps/web/app/feed.xml/route.ts does NOT emit any /_debug URL (verified by positive grep on the explicit exclusion marker comment)"
    - "Visiting http://localhost:3000/_debug/convex renders the table with all five query labels and counts of '0' (or '—' briefly) when run against the live Convex deployment from Plan 03-04"
  artifacts:
    - path: "apps/web/app/_debug/convex/page.tsx"
      provides: "CVX-05 evidence surface — 5 useQuery calls against a synthetic runId"
      contains: "phase-3-smoke-test"
      min_lines: 40
    - path: "apps/web/public/robots.txt"
      provides: "Search engine exclusion for /_debug/"
      contains: "Disallow: /_debug/"
  key_links:
    - from: "apps/web/app/_debug/convex/page.tsx useQuery calls"
      to: "Convex deployment + the 5 byRunId queries"
      via: "api.<table>.byRunId imported from @convex/_generated/api"
      pattern: "useQuery\\(api\\."
    - from: "apps/web/public/robots.txt Disallow rule"
      to: "Search engine crawlers"
      via: "robots.txt convention"
      pattern: "Disallow: /_debug/"
---

<objective>
Create the `/_debug/convex` route — Phase 3's CVX-05 evidence surface. The page is a Client Component that calls `useQuery` on all five `byRunId` queries with a synthetic `runId: "phase-3-smoke-test"`, renders the results in a dry table per Jesse voice. Add `Disallow: /_debug/` to `robots.txt`, add explicit exclusion-marker comments to `sitemap.ts` and `feed.xml` (so the implicit exclusion becomes a greppable contract), and add the `TODO(Phase 9):` cleanup comment at the top of the page (D-24).

This route ships in Phase 3 and is REMOVED in Phase 9 when the real DeliberationSlot subscriptions land. Do not skip the TODO comment.

Purpose: Honors D-18 (hidden debug route at exact path `/_debug/convex`), D-24 (TODO Phase 9 cleanup comment), Pitfall 7 (underscore folder IS a route per Next.js — the page.tsx makes it a route). Resolves CVX-05 (web app `useQuery` returns empty arrays without error against empty tables).
Output: A working browser-visible evidence page Andrew's smoke test (Plan 03-08) loads at `http://localhost:3000/_debug/convex`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-convex-deployment/03-CONTEXT.md
@.planning/phases/03-convex-deployment/03-RESEARCH.md
@apps/web/app/sitemap.ts
@apps/web/app/feed.xml/route.ts
@apps/web/public/robots.txt
@apps/web/components/providers/ConvexClientProvider.tsx
@convex/_generated/api.d.ts
@apps/web/components/issue/DeliberationSlot.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create apps/web/app/_debug/convex/page.tsx with 5 useQuery calls and TODO(Phase 9) comment</name>
  <files>apps/web/app/_debug/convex/page.tsx</files>
  <read_first>
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Code Examples §4 (verbatim page content with the rowCount helper handling undefined/null/array)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-18 (hardcoded runId, no nav linkage), D-24 (TODO Phase 9 comment), Claude's Discretion section (dry table, no decoration, no emojis, Jesse voice)
    - convex/_generated/api.d.ts (verify the api object surfaces all 5 byRunId — if file is missing or types are off, re-run Plan 03-04)
    - apps/web/components/providers/ConvexClientProvider.tsx (the provider this page consumes — confirms the boundary is right)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Pitfall 8 (useQuery returning null vs undefined vs [] — handled in rowCount helper)
  </read_first>
  <action>
    Create the file at the exact path `apps/web/app/_debug/convex/page.tsx`. This requires creating two new directories: `apps/web/app/_debug/` and `apps/web/app/_debug/convex/`. Next.js treats underscore-prefixed folders as routes ONLY when a `page.tsx` exists inside them (Pitfall 7).

    File content (verbatim from 03-RESEARCH §Code Examples §4, with D-24 cleanup comment expanded and explicit Jesse-voice copy):

    ```tsx
    /**
     * Convex smoke-test route — Phase 3 evidence surface for CVX-05.
     *
     * TODO(Phase 9): REMOVE THIS FILE.
     * Phase 9 replaces this debug page with live <DeliberationSlot> Convex
     * subscriptions on each /issue/[slug] page. When that lands:
     *   1. Delete this file
     *   2. Delete apps/web/app/_debug/ if no other debug routes were added
     *   3. Remove the `Disallow: /_debug/` line from apps/web/public/robots.txt
     *   4. Update apps/web/README.md to drop the "/_debug/convex" mention
     *
     * Contract source: .planning/phases/03-convex-deployment/03-CONTEXT.md D-18, D-24.
     *
     * This page calls all 5 byRunId queries with a synthetic runId guaranteed
     * to have no matching rows ("phase-3-smoke-test"). Expected output:
     *   - pipelineRuns.byRunId returns null (uses .first())
     *   - the other four return [] (use .collect())
     * The rowCount helper renders "0" for both empty cases and "—" while loading.
     */
    'use client'

    import { useQuery } from 'convex/react'
    import { api } from '@convex/_generated/api'

    const SMOKE_TEST_RUN_ID = 'phase-3-smoke-test'

    function rowCount(data: unknown): string {
      if (data === undefined) return '—'
      if (Array.isArray(data)) return String(data.length)
      if (data === null) return '0'
      return '1'
    }

    export default function DebugConvexPage() {
      const run = useQuery(api.pipelineRuns.byRunId, { runId: SMOKE_TEST_RUN_ID })
      const pitches = useQuery(api.pitchLog.byRunId, { runId: SMOKE_TEST_RUN_ID })
      const events = useQuery(api.deliberationEvents.byRunId, { runId: SMOKE_TEST_RUN_ID })
      const votes = useQuery(api.agentVotes.byRunId, { runId: SMOKE_TEST_RUN_ID })
      const corrections = useQuery(api.qaCorrections.byRunId, { runId: SMOKE_TEST_RUN_ID })

      const rows: [string, unknown][] = [
        ['pipelineRuns', run],
        ['pitchLog', pitches],
        ['deliberationEvents', events],
        ['agentVotes', votes],
        ['qaCorrections', corrections],
      ]

      return (
        <main className="mx-auto max-w-2xl px-6 py-12">
          <meta name="robots" content="noindex,nofollow" />
          <h1 className="font-display text-2xl mb-2">Convex smoke test</h1>
          <p className="font-ui text-sm opacity-60 mb-6">
            Run ID: {SMOKE_TEST_RUN_ID}. Empty by design.
          </p>
          <table className="w-full font-ui text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Query</th>
                <th className="text-right py-2">Rows</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([name, data]) => (
                <tr key={name} className="border-b last:border-b-0">
                  <td className="py-2">{name}.byRunId</td>
                  <td className="py-2 text-right">{rowCount(data)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </main>
      )
    }
    ```

    Critical:
    - File MUST start with `'use client'` (after the JSDoc/TODO comment block — `'use client'` is the first executable line). Server Components cannot use `useQuery` because it relies on React Context (which the provider supplies in the Client Component island).
    - Import path is `@convex/_generated/api` — uses the alias from Plan 03-05.
    - `SMOKE_TEST_RUN_ID = 'phase-3-smoke-test'` — synthetic ID, deliberately won't match any real run (Pitfall 4 — Phase 9's runIds will be UUIDs, never this string).
    - `<meta name="robots" content="noindex,nofollow" />` inside the JSX — Next.js will surface this via `<head>` in the rendered HTML (works for Client Components even though `metadata` export does not — research §Code Examples §4 inline note).
    - Voice: "Empty by design." — dry, no winking. No emojis, no decoration.
    - Tailwind classes use the same brand tokens as the rest of the site (`font-display`, `font-ui`, `opacity-60`, etc.) so the page matches the editorial register.
    - The TODO(Phase 9) comment is the lockable cleanup contract — do not rephrase or shorten it. Phase 9's planner will grep for `TODO(Phase 9)`.
  </action>
  <verify>
    <automated>test -f apps/web/app/_debug/convex/page.tsx && grep -q "'use client'" apps/web/app/_debug/convex/page.tsx && grep -q "TODO(Phase 9)" apps/web/app/_debug/convex/page.tsx && grep -q "from '@convex/_generated/api'" apps/web/app/_debug/convex/page.tsx && grep -q "phase-3-smoke-test" apps/web/app/_debug/convex/page.tsx && grep -q "useQuery(api.pipelineRuns.byRunId" apps/web/app/_debug/convex/page.tsx && grep -q "useQuery(api.pitchLog.byRunId" apps/web/app/_debug/convex/page.tsx && grep -q "useQuery(api.deliberationEvents.byRunId" apps/web/app/_debug/convex/page.tsx && grep -q "useQuery(api.agentVotes.byRunId" apps/web/app/_debug/convex/page.tsx && grep -q "useQuery(api.qaCorrections.byRunId" apps/web/app/_debug/convex/page.tsx && grep -q "function rowCount" apps/web/app/_debug/convex/page.tsx && grep -q "noindex,nofollow" apps/web/app/_debug/convex/page.tsx && cd apps/web && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - File exists at exact path `apps/web/app/_debug/convex/page.tsx`
    - File contains `'use client'` directive (after the leading comment block)
    - File contains `TODO(Phase 9)` comment with explicit removal instructions
    - File imports `useQuery` from `convex/react` and `api` from `@convex/_generated/api`
    - File contains exactly five `useQuery(api.<table>.byRunId, { runId: SMOKE_TEST_RUN_ID })` calls covering pipelineRuns, pitchLog, deliberationEvents, agentVotes, qaCorrections
    - File contains the `rowCount` helper handling `undefined` → `'—'`, array → `String(length)`, `null` → `'0'`, else → `'1'`
    - File contains `<meta name="robots" content="noindex,nofollow" />` inside JSX
    - `cd apps/web && pnpm typecheck` exits 0 (proves `@convex/_generated/api` resolves via the path alias)
  </acceptance_criteria>
  <done>
    The route exists. Navigating to `http://localhost:3000/_debug/convex` (with NEXT_PUBLIC_CONVEX_URL set in `apps/web/.env.local`) will render the smoke-test table. The TODO(Phase 9) cleanup contract is locked in.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add `Disallow: /_debug/` to apps/web/public/robots.txt</name>
  <files>apps/web/public/robots.txt</files>
  <read_first>
    - apps/web/public/robots.txt (current content — Phase 2 left it with Allow / + Disallow /api/ + Disallow /_next/ + Sitemap)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-18 (`Disallow: /_debug/`)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Pattern 6 ("Exclusion mechanics")
  </read_first>
  <action>
    Replace `apps/web/public/robots.txt` entire contents with:

    ```
    User-agent: *
    Allow: /
    Disallow: /api/
    Disallow: /_next/
    Disallow: /_debug/

    Sitemap: https://eisenbalm.com/sitemap.xml
    ```

    The only change vs Phase 2: a new `Disallow: /_debug/` line, placed after `Disallow: /_next/` for visual grouping of underscore-prefixed exclusions. The `Sitemap:` line stays unchanged (we have not changed the base URL).
  </action>
  <verify>
    <automated>test -f apps/web/public/robots.txt && grep -q "^Disallow: /_debug/" apps/web/public/robots.txt && grep -q "^Disallow: /api/" apps/web/public/robots.txt && grep -q "^Disallow: /_next/" apps/web/public/robots.txt && grep -q "^Allow: /" apps/web/public/robots.txt && grep -q "^Sitemap: https://eisenbalm.com/sitemap.xml" apps/web/public/robots.txt</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/public/robots.txt` contains the line `Disallow: /_debug/` on its own line
    - All four previous lines (`User-agent: *`, `Allow: /`, `Disallow: /api/`, `Disallow: /_next/`, `Sitemap: …`) are preserved
    - Total robots.txt has 6 non-empty lines (4 original + 1 new Disallow + 1 Sitemap)
  </acceptance_criteria>
  <done>
    Search engine crawlers honoring robots.txt will not index `/_debug/*`. The page itself also emits `<meta name="robots" content="noindex,nofollow">` for belt-and-suspenders coverage.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add explicit /_debug exclusion-marker comments to sitemap.ts and feed.xml/route.ts</name>
  <files>apps/web/app/sitemap.ts, apps/web/app/feed.xml/route.ts</files>
  <read_first>
    - apps/web/app/sitemap.ts (current content — emits only `/`, `/archive`, `/charities`, `/about`, `/shop`, plus issue + charity URLs)
    - apps/web/app/feed.xml/route.ts (current content — emits only published weeklyIssue entries)
    - apps/web/public/robots.txt (Task 2's output — already has `Disallow: /_debug/`)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Pattern 6 ("Exclusion mechanics") — verify by inspection that `_debug/*` is already excluded by virtue of these files only emitting known routes
  </read_first>
  <action>
    Both `sitemap.ts` and `feed.xml/route.ts` currently emit ONLY known, allow-listed routes (sitemap: hardcoded static list + issue + charity GROQ results; feed: weeklyIssue GROQ results). `/_debug/*` is implicitly excluded — there is no logic that would generate a URL with that prefix.

    The action is to add EXPLICIT, GREPPABLE EXCLUSION-MARKER COMMENTS to each file so the implicit exclusion becomes a positive, machine-checkable contract Phase 9 can verify.

    **Exclusion marker format (used as a positive-grep anchor):**

    The exact marker text — both files must contain a comment line whose content includes the substring `Exclusion: do not list /_debug/* routes (Phase 3 D-18)`. Use the appropriate comment syntax per filetype:
    - `apps/web/app/sitemap.ts` (TypeScript): `// Exclusion: do not list /_debug/* routes (Phase 3 D-18)`
    - `apps/web/app/feed.xml/route.ts` (TypeScript): `// Exclusion: do not list /_debug/* routes (Phase 3 D-18)`
    - `apps/web/public/robots.txt` already has `Disallow: /_debug/` from Task 2 — no marker comment needed there; the `Disallow:` line IS the contract.

    **File 1 — `apps/web/app/sitemap.ts`**: Add the marker as a line-level comment near where the static entries are returned (top of the function body, OR adjacent to the JSDoc — either is acceptable; the key is that it's on a `//`-prefixed line). Also extend the top JSDoc block. The existing JSDoc has a line that reads:

    ```
     * Exclusion: /api/, drafts, in-review — implicit: QUERY_ARCHIVE filters
     * on status == "published" and QUERY_ALL_CHARITIES returns approved charities.
    ```

    Extend the JSDoc to:

    ```
     * Exclusion: /api/, drafts, in-review — implicit: QUERY_ARCHIVE filters
     * on status == "published" and QUERY_ALL_CHARITIES returns approved charities.
     * Exclusion: /_debug/* — this file only emits the hardcoded `staticEntries`
     * list (5 entries) plus issue + charity URLs from GROQ. The /_debug/convex
     * route (Phase 3, removed in Phase 9) is intentionally not in any of those
     * sources, so it cannot leak into the sitemap. Also covered by
     * `Disallow: /_debug/` in apps/web/public/robots.txt.
    ```

    Then ADD a single inline `//`-prefixed marker comment INSIDE the function body (right above the `return` of the static entries, or right above the GROQ-result mapping — pick the cleanest spot in this specific file), with EXACT text:

    ```
    // Exclusion: do not list /_debug/* routes (Phase 3 D-18)
    ```

    This is the greppable contract anchor used by the verify step below.

    **File 2 — `apps/web/app/feed.xml/route.ts`**: Add a similar exclusion note to the top JSDoc block. After the existing line about RSS-specific projection, add:

    ```
     * Exclusion: /_debug/* — this handler only emits published weeklyIssue items
     * from QUERY_FEED. The /_debug/convex route (Phase 3, removed in Phase 9)
     * is not a weeklyIssue and cannot appear here.
    ```

    Then ADD the same single inline `//`-prefixed marker comment inside the function body, EXACT text:

    ```
    // Exclusion: do not list /_debug/* routes (Phase 3 D-18)
    ```

    No CODE change in either file — only added comments. The behaviour is unchanged. The comments are what locks the contract for Phase 9.

    If a future change adds a generic URL emitter to either file, the marker comment is the trigger to also add an `_debug/*` filter.
  </action>
  <verify>
    <automated>grep -q "Exclusion:.*\/_debug" apps/web/app/sitemap.ts && grep -q "Exclusion:.*\/_debug" apps/web/app/feed.xml/route.ts && grep -q "Disallow: /_debug/" apps/web/public/robots.txt && cd apps/web && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/app/sitemap.ts` contains a `//`-style or JSDoc-style comment line matching the regex `Exclusion:.*\/_debug` (positive assertion — the marker is present)
    - `apps/web/app/feed.xml/route.ts` contains a `//`-style or JSDoc-style comment line matching the regex `Exclusion:.*\/_debug` (positive assertion — the marker is present)
    - `apps/web/public/robots.txt` contains the line `Disallow: /_debug/` (covered by Task 2; re-verified here)
    - Neither `sitemap.ts` nor `feed.xml/route.ts` had any executable code changed — comments ONLY (verify by inspection of git diff)
    - `apps/web/app/sitemap.ts` still emits the five static entries (`/`, `/archive`, `/charities`, `/about`, `/shop`) and the issue/charity dynamic entries
    - `apps/web/app/feed.xml/route.ts` still emits the RSS channel with weeklyIssue items
    - `cd apps/web && pnpm typecheck` exits 0 (production build is run ONCE at the plan-level `<verification>` block, not per-task)
  </acceptance_criteria>
  <done>
    Both files explicitly document that `/_debug/*` is excluded with a greppable marker comment. The implicit exclusion is now an explicit contract Phase 9's planner can verify with a positive grep. No emitted URL changes.
  </done>
</task>

</tasks>

<verification>
End-of-plan integration check — run ONCE after all three tasks complete. This is the single authoritative production-build verification for this plan; individual tasks do NOT run `pnpm build`.

```bash
cd apps/web && pnpm typecheck && pnpm build
```

Expected: both exit 0.

Additional checks (positive assertions):
- `apps/web/app/_debug/convex/page.tsx` exists, is a Client Component with five useQuery calls, the TODO(Phase 9) comment, and the `phase-3-smoke-test` synthetic runId
- `apps/web/public/robots.txt` includes `Disallow: /_debug/`
- `apps/web/app/sitemap.ts` contains a comment line matching `Exclusion:.*\/_debug`
- `apps/web/app/feed.xml/route.ts` contains a comment line matching `Exclusion:.*\/_debug`
- DeliberationSlot.tsx is NOT modified
- convex/*.ts files are NOT modified
- convex/schema.ts is NOT modified
</verification>

<success_criteria>
- CVX-05 fully satisfied (modulo the live smoke test in Plan 03-08): browsing to `http://localhost:3000/_debug/convex` against the deployed Convex backend shows five rows in the table with counts `0` (or `—` momentarily during initial subscription resolution), no errors in browser console
- The Phase 9 cleanup contract is locked: page header TODO is the explicit greppable marker; robots.txt and the sitemap/feed marker comments all reference `/_debug/*`
- `/_debug/convex` is excluded from search-engine indexing (robots.txt) and from project URL surfaces (sitemap, RSS)
</success_criteria>

<output>
After completion, create `.planning/phases/03-convex-deployment/03-06-SUMMARY.md` recording:
  (a) the file `apps/web/app/_debug/convex/page.tsx` and its final line count,
  (b) the robots.txt diff (one line added),
  (c) the sitemap.ts + feed.xml/route.ts comment additions (no code changes; quote the exact marker comment line added to each file),
  (d) confirmation that `pnpm build` exits 0,
  (e) (if Andrew has already run the smoke test against the deployed Convex) the rendered table state at `/_debug/convex` — otherwise note that Plan 03-08 will perform that check.
</output>
</content>
</invoke>