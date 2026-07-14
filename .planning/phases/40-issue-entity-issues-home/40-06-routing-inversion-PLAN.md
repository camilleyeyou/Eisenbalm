---
phase: 40-issue-entity-issues-home
plan: 06
type: execute
wave: 3
depends_on: ["40-02", "40-04"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/review/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/runs/[runId]/page.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
  - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx
  - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/page.tsx
  - apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx
  - apps/dispatch-control/app/(dashboard)/page.tsx
autonomous: true
requirements: [ISS-02]

must_haves:
  truths:
    - "Every console URL for the active issue is issue-keyed: /issues/[n]/review, /issues/[n]/voice, /issues/[n]/runs/[runId] all resolve and render the already-shipped screens with no rewrite of their internals"
    - "Old run-keyed console URLs (/review-desk/[runId], /voice-pass/[runId], the shells, and the dashboard index) redirect to their issue-keyed equivalents via a dynamic Convex lookup — never a static rewrite, never a run-keyed loop target"
    - "A pipeline run is reachable only as a historical record under its issue; Run Monitor remains functional but is no longer the editorial object"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/review/page.tsx"
      provides: "issue→run wrapper rendering the existing Review Desk galley"
      contains: "ReviewDeskRunView"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"
      provides: "redirect-only Server Component (runId→issueNumber→/issues/[n]/review)"
      contains: "redirect"
    - path: "apps/dispatch-control/app/(dashboard)/page.tsx"
      provides: "dashboard index redirect to /issues"
      contains: "/issues"
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/review/page.tsx"
      to: "convex pipelineRuns:byIssueNumber"
      via: "resolve issueNumber→runId server-side before rendering the client view"
      pattern: "byIssueNumber"
    - from: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"
      to: "apps/dispatch-control/lib/issueRouteResolver.ts legacyRedirectTarget"
      via: "runId→issueNumber lookup then redirect()"
      pattern: "legacyRedirectTarget"
---

<objective>
Perform the routing inversion (ISS-02): re-key the two editorial desks under `/issues/[issueNumber]`, expose a run as a historical record under its issue, and 30x the old run-keyed console URLs — all as THIN issue↔run translations around the already-shipped Review Desk and Voice Pass screens. Their internals are NOT rewritten (D-07); Phase 41 recomposes them into stage tabs at the same URLs.

Purpose: This makes success criterion 2 literally true at the end of Phase 40 and spares Phase 41 a second URL migration.
Output: three new `/issues/[n]/...` route wrappers; the two galley/voice Client Components moved to co-located non-route files; four redirect-only pages; the dashboard index redirect.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@.planning/phases/40-issue-entity-issues-home/40-RESEARCH.md

<naming_trap>
The pipeline's 18 `/issues/{run_id}/...` FastAPI endpoints are runId-keyed and OUT OF SCOPE — this plan
touches ONLY Next.js dashboard route files under `apps/dispatch-control/app/(dashboard)/`. It renames
NO pipeline endpoint.
</naming_trap>

<interfaces>
Resolver (Plan 40-04):
```typescript
parseIssueNumber(param): number | null
issueReviewHref(n) / issueVoiceHref(n) / issueRunHref(n, runId)
legacyRedirectTarget(surface: 'review'|'voice', issueNumber: number|null|undefined): string  // never run-keyed
```
Convex (Plan 40-02, unguarded reads):
```typescript
api.pipelineRuns.byIssueNumber({ issueNumber })  // most recent run for the issue → { runId, ... } | null
api.pipelineRuns.byRunId({ runId })              // existing → { issueNumber, ... } | null
```
Server-side Convex read pattern (existing precedent — copy it):
```typescript
// app/(dashboard)/run-monitor/runs/[runId]/review/page.tsx:23-55
import { ConvexHttpClient } from 'convex/browser'
function getConvexHttpClient() { const url = process.env.NEXT_PUBLIC_CONVEX_URL; return url ? new ConvexHttpClient(url) : null }
// await convex.query(api.xxx, {...}) inside an async Server Component, then redirect()/render
```
`redirect()` from `next/navigation` (an async Server Component may `await` a data fetch THEN redirect — the documented data-dependent-redirect pattern; a static `next.config` rewrite CANNOT do the Convex lookup).

The shipped screens (do NOT rewrite their internals):
- `app/(dashboard)/review-desk/[runId]/page.tsx` — default export `ReviewDeskRunPage({ params: Promise<{ runId }> })`, a `'use client'` component using `use(params)`.
- `app/(dashboard)/voice-pass/[runId]/page.tsx` — default export `VoicePassRunPage({ params })` AND named export `VoicePassScreen({ runId })`.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Move the galley + voice Client Components to co-located non-route files</name>

  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (the full galley Client Component — note its relative imports `./_components/...` and `../../run-monitor/runs/[runId]/review/_components/PreviewIframe`; keeping the file in the SAME directory preserves every one of them)
    - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx (the voice screen — has both a default `VoicePassRunPage` and a named `VoicePassScreen({ runId })`)
    - apps/dispatch-control/app/api/review-desk/[runId]/preview-url/route.ts (UNCHANGED — the galley still fetches this Route Handler; do not touch it)
  </read_first>

  <action>
This preserves the shipped screens intact while freeing their `page.tsx` paths to become redirects.

1. **Review Desk:** Copy the ENTIRE current contents of `app/(dashboard)/review-desk/[runId]/page.tsx` into a NEW file `app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx` in the SAME directory (so all relative imports stay valid). Keep it `'use client'`. Keep its default export (rename the exported function to `ReviewDeskRunView` for clarity, but a plain re-export is also fine) AND add a named export `ReviewDeskRunView` alongside the default. Do NOT change any internal logic, import path, state, or the `use(params)` signature.

2. **Voice Pass:** Copy the ENTIRE current contents of `app/(dashboard)/voice-pass/[runId]/page.tsx` into a NEW file `app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx` in the SAME directory. Keep `'use client'`, keep the named `VoicePassScreen({ runId })` export intact (this is the clean entry the new wrapper uses), and keep the default export. Do NOT change internals.

Both `page.tsx` files are REPLACED in Task 3 with redirect-only Server Components — but do that in Task 3, not here. In THIS task, the two `page.tsx` files still contain the original component (there will momentarily be a duplicate default export across the two files in each directory — that is fine; Task 3 overwrites the `page.tsx`).
  </action>

  <verify>
    <automated>cd apps/dispatch-control && test -f "app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx" && test -f "app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx" && grep -q "VoicePassScreen" "app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx" && grep -q "use client" "app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx"</automated>
  </verify>

  <acceptance_criteria>
    - `ReviewDeskRunView.tsx` and `VoicePassRunView.tsx` exist in their respective `[runId]` directories
    - Both retain `'use client'` and their original relative imports unchanged (`grep -q "./_components/" ReviewDeskRunView.tsx` succeeds)
    - `VoicePassRunView.tsx` exports `VoicePassScreen`
    - No file under `_components/` was moved or edited
    - `app/api/review-desk/[runId]/preview-url/route.ts` is unchanged
  </acceptance_criteria>

  <done>The shipped galley and voice screens live in co-located non-route files with internals untouched, ready to be mounted under issue-keyed routes.</done>
</task>

<task type="auto">
  <name>Task 2: Create the three issue-keyed route wrappers</name>

  <read_first>
    - docs/API_CONTRACTS.md §40.8 (the route tree + which existing component each wrapper mounts)
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/page.tsx (the async Server Component + ConvexHttpClient + await-query pattern to copy)
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/page.tsx (the existing RunDetail server page — the `/issues/[n]/runs/[runId]` wrapper renders the same `RunDetail` client component)
    - apps/dispatch-control/lib/issueRouteResolver.ts (parseIssueNumber, issueHref)
  </read_first>

  <action>
Create three async Server Component pages. Each resolves the route param via `parseIssueNumber`, does a server-side Convex read, then renders the existing client screen (or redirects when there is no run yet).

1. `app/(dashboard)/issues/[issueNumber]/review/page.tsx`:
```tsx
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { parseIssueNumber, issueHref } from '@/lib/issueRouteResolver'
import ReviewDeskRunView from '../../../review-desk/[runId]/ReviewDeskRunView'

export const dynamic = 'force-dynamic'

export default async function IssueReviewPage({ params }: { params: Promise<{ issueNumber: string }> }) {
  const { issueNumber } = await params
  const n = parseIssueNumber(issueNumber)
  if (n === null) redirect('/issues')
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const run = url ? await new ConvexHttpClient(url).query(api.pipelineRuns.byIssueNumber, { issueNumber: n }) : null
  if (!run) redirect(issueHref(n))            // no run yet — the overview page (Plan 40-07)
  return <ReviewDeskRunView params={Promise.resolve({ runId: run.runId })} />
}
```
2. `app/(dashboard)/issues/[issueNumber]/voice/page.tsx` — identical shape, but `import { VoicePassScreen } from '../../../voice-pass/[runId]/VoicePassRunView'` and render `<VoicePassScreen runId={run.runId} />` (the named export takes a plain runId — no params Promise needed).
3. `app/(dashboard)/issues/[issueNumber]/runs/[runId]/page.tsx` — a run as a historical record (D-08). Mirror the existing `run-monitor/runs/[runId]/page.tsx`: `const { runId } = await params;` render the existing `RunDetail` client component (`import RunDetail from '../../../../run-monitor/runs/_components/RunDetail'` — verify the exact relative depth against the tree) with `runId`. Add a small breadcrumb/back link to `issueHref(n)`. `export const dynamic = 'force-dynamic'`.

Verify each relative import path resolves (the `[issueNumber]/review` dir is three segments below `(dashboard)`, so `../../../review-desk/[runId]/ReviewDeskRunView` reaches the sibling desk dir — confirm by reading the tree, adjust `../` depth if the build complains).
  </action>

  <verify>
    <automated>cd apps/dispatch-control && for f in "issues/[issueNumber]/review/page.tsx" "issues/[issueNumber]/voice/page.tsx" "issues/[issueNumber]/runs/[runId]/page.tsx"; do test -f "app/(dashboard)/$f" || { echo "MISSING $f"; exit 1; }; done && grep -q "byIssueNumber" "app/(dashboard)/issues/[issueNumber]/review/page.tsx" && grep -q "VoicePassScreen" "app/(dashboard)/issues/[issueNumber]/voice/page.tsx" && pnpm exec tsc --noEmit -p tsconfig.json
</automated>
  </verify>

  <acceptance_criteria>
    - All three `/issues/[issueNumber]/...` page files exist
    - The review wrapper reads `api.pipelineRuns.byIssueNumber` server-side and renders `ReviewDeskRunView`; the voice wrapper renders `VoicePassScreen` with a plain runId
    - Each wrapper redirects to `issueHref(n)` when there is no run, and to `/issues` when `parseIssueNumber` returns null
    - The runs wrapper renders the existing `RunDetail` client component (no rewrite)
    - `pnpm --filter dispatch-control exec tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>The issue-keyed review/voice/runs routes resolve and render the shipped screens with no internal rewrite.</done>
</task>

<task type="auto">
  <name>Task 3: Legacy redirects + dashboard index</name>

  <read_first>
    - apps/dispatch-control/app/(dashboard)/page.tsx (the current index — redirects to /review-desk; change to /issues)
    - apps/dispatch-control/app/(dashboard)/review-desk/page.tsx and voice-pass/page.tsx (the current auto-focus shells — become simple redirects to /issues)
    - apps/dispatch-control/lib/issueRouteResolver.ts (legacyRedirectTarget — the runId→issueNumber redirect helper that NEVER returns a run-keyed URL)
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/page.tsx (the server-Convex-read pattern for the [runId] redirect pages)
  </read_first>

  <action>
Replace five files with redirect logic. Each `[runId]` redirect is an async Server Component that looks up the issueNumber then calls `redirect(legacyRedirectTarget(...))`.

1. `app/(dashboard)/review-desk/[runId]/page.tsx` — REPLACE the (now-duplicated) galley with a redirect-only Server Component:
```tsx
import { redirect } from 'next/navigation'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@convex/_generated/api'
import { legacyRedirectTarget } from '@/lib/issueRouteResolver'
export const dynamic = 'force-dynamic'
export default async function LegacyReviewDeskRedirect({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params
  const url = process.env.NEXT_PUBLIC_CONVEX_URL
  const pRun = url ? await new ConvexHttpClient(url).query(api.pipelineRuns.byRunId, { runId }) : null
  redirect(legacyRedirectTarget('review', pRun?.issueNumber ?? null))
}
```
2. `app/(dashboard)/voice-pass/[runId]/page.tsx` — same shape with `legacyRedirectTarget('voice', ...)`.
3. `app/(dashboard)/review-desk/page.tsx` — replace the auto-focus shell with `import { redirect } from 'next/navigation'; export default function ReviewDeskShellRedirect() { redirect('/issues') }`.
4. `app/(dashboard)/voice-pass/page.tsx` — same, `redirect('/issues')`.
5. `app/(dashboard)/page.tsx` — change the existing `redirect('/review-desk')` to `redirect('/issues')`.

Do NOT touch `/run-monitor/**` or `/signal-desk` — they stay functional (Run Monitor is nav-relocated in Plan 40-08, not moved here).
  </action>

  <verify>
    <automated>cd apps/dispatch-control && grep -q "redirect('/issues')" "app/(dashboard)/page.tsx" && grep -q "legacyRedirectTarget('review'" "app/(dashboard)/review-desk/[runId]/page.tsx" && grep -q "legacyRedirectTarget('voice'" "app/(dashboard)/voice-pass/[runId]/page.tsx" && ! grep -q "use client" "app/(dashboard)/review-desk/[runId]/page.tsx" && pnpm exec tsc --noEmit -p tsconfig.json</automated>
  </verify>

  <acceptance_criteria>
    - `app/(dashboard)/page.tsx` redirects to `/issues`
    - The `review-desk/[runId]` and `voice-pass/[runId]` pages are redirect-only Server Components (NOT `'use client'`) calling `legacyRedirectTarget`
    - `review-desk/page.tsx` and `voice-pass/page.tsx` redirect to `/issues`
    - `/run-monitor/**` and `/signal-desk/**` are unchanged (git diff shows no change under those dirs)
    - `pnpm --filter dispatch-control exec tsc --noEmit` exits 0
  </acceptance_criteria>

  <done>Every old run-keyed console URL and the dashboard index redirect to their issue-keyed equivalents via a dynamic Convex lookup; no run-keyed loop target is ever emitted.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control exec tsc --noEmit` exits 0 (all wrappers + redirects type-check).
- `grep -rq "review-desk" app/(dashboard)/issues` returns only the relative imports into `ReviewDeskRunView` (the moved component), never a nav or redirect target.
- Manual (deferred to 40-09 build gate): visiting an old `/review-desk/{runId}` URL in `pnpm dev` lands on `/issues/{n}/review`; `/issues/{n}/runs/{runId}` renders the run detail.
</verification>

<success_criteria>
- ISS-02: every active-issue console URL is issue-keyed; a run is reachable only under its issue; the old URLs 30x via a data-dependent redirect.
- The shipped Review Desk and Voice Pass screens are mounted under the new routes with zero rewrite of their internals (Phase 41 recomposes them in place).
</success_criteria>

<output>
After completion, create `.planning/phases/40-issue-entity-issues-home/40-06-SUMMARY.md`.
</output>
