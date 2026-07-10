---
phase: 39-registry-coverage-memory-strip
plan: 05
type: execute
wave: 3
depends_on: ["39-02"]
files_modified:
  - apps/dispatch-control/lib/coverageStripClient.ts
  - apps/dispatch-control/app/(dashboard)/registry/_components/CoverageStrip.tsx
  - apps/dispatch-control/app/(dashboard)/registry/page.tsx
  - apps/dispatch-control/__tests__/CoverageStrip.test.tsx
autonomous: true
requirements: [MEM-01]
must_haves:
  truths:
    - "A coverage-memory strip at the top of the Registry visualizes the last 8 featured issues' cause/geo/signal chips"
    - "The strip fetches GET /registry/coverage-strip via an authenticated pipeline fetch (no Sanity client in dispatch-control)"
    - "Repetition is visible as side-by-side chips (no computed diversity score)"
    - "Columns for charities missing a chip render a dash/empty state without crashing"
  artifacts:
    - path: "apps/dispatch-control/lib/coverageStripClient.ts"
      provides: "authenticated fetch of the coverage-strip endpoint (findingsClient pattern)"
      contains: "coverage-strip"
    - path: "apps/dispatch-control/app/(dashboard)/registry/_components/CoverageStrip.tsx"
      provides: "8-column stacked cause/geo/signal chip strip"
      contains: "CoverageStrip"
    - path: "apps/dispatch-control/app/(dashboard)/registry/page.tsx"
      provides: "CoverageStrip mounted above RegistryTable"
      contains: "CoverageStrip"
  key_links:
    - from: "CoverageStrip.tsx"
      to: "GET /registry/coverage-strip"
      via: "coverageStripClient fetch + Bearer token"
      pattern: "coverage-strip"
    - from: "registry/page.tsx"
      to: "CoverageStrip"
      via: "component mount above RegistryTable"
      pattern: "CoverageStrip"
---

<objective>
Render the coverage-memory strip (MEM-01): a strip at the top of the Registry page visualizing the last 8 featured issues' cause/geo/signal chips so thematic repetition ("three housing causes in a row") is scannable at a glance — distinct from the Run Monitor cost/duration drift strip.

Purpose: The human pattern-spotting value of MEM-01 (D-04 keeps it visual, not a computed score). Data comes from the 39-02 server endpoint via an authenticated fetch — the dashboard has zero Sanity access (Pitfall 1).
Output: `coverageStripClient.ts` (authenticated fetch), `CoverageStrip.tsx` (8-column chip strip), mounted in `registry/page.tsx`, plus a Vitest file.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/39-registry-coverage-memory-strip/39-RESEARCH.md
@docs/design/dispatch-control-v2/README.md

<interfaces>
<!-- From 39-02 (already landed): -->
<!-- GET /registry/coverage-strip -> [{ name, sanityCharityId, lastFeaturedAt, cause, geo, signal }]  (≤8, lastFeaturedAt desc; any chip may be null) -->

Fetch-client pattern to mirror (apps/dispatch-control/lib/findingsClient.ts):
  - pipelineBaseUrl() reads NEXT_PUBLIC_PIPELINE_URL (throws if unset)
  - Bearer token from useAuth().getToken() passed as Authorization header
  - dispatch-control NEVER imports @sanity/client (dispatch-control-no-sanity-write.test.ts tripwire)

1c design tokens (docs/design/dispatch-control-v2/README.md §Design tokens; §Registry):
  ink #17140e, cobalt #253ad4, vermilion #e8471d, marigold #f2b01e, green #148a52; Space Grotesk micro-labels (9-9.5px uppercase tracked); hard edges, no rounded corners on magazine surfaces. Use the existing dispatch-control token classes already used by DriftStrip/other components — do NOT hardcode hex if a token class exists.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED test for CoverageStrip rendering</name>
  <read_first>
    - apps/dispatch-control/__tests__/DriftStrip.test.tsx (the sibling strip's test — render + mocked data assertions)
    - apps/dispatch-control/lib/findingsClient.ts (fetch-client shape being mirrored)
  </read_first>
  <behavior>
    - Given the client fetch is mocked to return 3 items [{name:"Acme", cause:"Housing", geo:"Detroit", signal:"overlooked rural..."}, {name:"Beta", cause:"Housing", geo:"Ohio", signal:null}, {name:"Gamma", cause:"Water", geo:null, signal:null}], CoverageStrip renders 3 columns; the two "Housing" cause chips are both present (repetition visible); the null geo/signal render a dash/empty affordance, not "undefined" or a crash.
    - A loading state renders before data resolves; an empty ([]) response renders an empty message.
  </behavior>
  <action>
    Author apps/dispatch-control/__tests__/CoverageStrip.test.tsx. Mock the coverageStripClient fetch function (vi.mock) and `@clerk/nextjs`'s useAuth (getToken) as the other dashboard tests do. Assert: 3 columns rendered; both "Housing" chips present; a null chip renders "—" (or an empty-chip element) and never the string "undefined"; loading + empty states render. Run — RED (component missing).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run CoverageStrip 2>&1 | grep -Eq "fail|error|Cannot find|No test files|passed"</automated>
  </verify>
  <acceptance_criteria>
    - File apps/dispatch-control/__tests__/CoverageStrip.test.tsx exists
    - `grep -qi "Housing" apps/dispatch-control/__tests__/CoverageStrip.test.tsx` succeeds (repetition assertion)
    - `grep -qi "undefined\|—\|empty\|dash" apps/dispatch-control/__tests__/CoverageStrip.test.tsx` succeeds (null-chip assertion)
    - `cd apps/dispatch-control && npx vitest run CoverageStrip` currently FAILS (RED)
  </acceptance_criteria>
  <done>A RED test encodes the 8-column repetition-visible rendering + null-chip graceful state.</done>
</task>

<task type="auto">
  <name>Task 2: coverageStripClient + CoverageStrip component</name>
  <read_first>
    - apps/dispatch-control/lib/findingsClient.ts (pipelineBaseUrl + Bearer fetch helper to copy)
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/DriftStrip.tsx (sibling strip layout/token usage — for visual consistency, NOT data pattern)
    - docs/design/dispatch-control-v2/README.md §Registry + §Design tokens
  </read_first>
  <action>
    Create apps/dispatch-control/lib/coverageStripClient.ts: export `interface CoverageColumn { name: string; sanityCharityId?: string | null; lastFeaturedAt?: number | null; cause?: string | null; geo?: string | null; signal?: string | null }` and `async function fetchCoverageStrip(token: string | null): Promise<CoverageColumn[]>` that GETs `${pipelineBaseUrl()}/registry/coverage-strip` with `Authorization: Bearer ${token}` (mirror findingsClient's fetch helper + error class). Reuse/duplicate the `pipelineBaseUrl()` helper from findingsClient (do not import Sanity).

    Create apps/dispatch-control/app/(dashboard)/registry/_components/CoverageStrip.tsx (`'use client'`):
    - `const { getToken } = useAuth()`; on mount (`useEffect`) call `fetchCoverageStrip(await getToken())`, store in state; handle loading/error/empty.
    - Render a horizontal strip of one column per returned charity (lastFeaturedAt-desc, so most recent left or right — match the design README §Registry intent). Each column stacks three chips: a **cause** chip (focusArea), a **geo** chip (location), and a **signal** chip (truncated scoutNotes with the full text as a `title` hover — mirror RegistryTable's truncateUrl truncation). Null/absent chips render "—" (an explicit empty-chip element), never "undefined".
    - Label the strip "Coverage memory — last 8" (a Space Grotesk micro-label per tokens). Purely visual: NO diversity score/number computed (D-04). Color chips by type using the 1c token classes (cause/geo/signal visually distinguishable); keep hard edges (no rounded corners), consistent with the anti-SaaS surface.
    Run the RED test — GREEN.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run CoverageStrip</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "registry/coverage-strip" apps/dispatch-control/lib/coverageStripClient.ts` succeeds
    - `grep -q "Bearer" apps/dispatch-control/lib/coverageStripClient.ts` succeeds
    - `grep -q "fetchCoverageStrip" apps/dispatch-control/app/(dashboard)/registry/_components/CoverageStrip.tsx` succeeds
    - CoverageStrip.tsx does NOT import Sanity: `grep -Eq "@sanity|createClient\(|api.sanity.io" apps/dispatch-control/app/(dashboard)/registry/_components/CoverageStrip.tsx apps/dispatch-control/lib/coverageStripClient.ts` returns NOTHING
    - CoverageStrip.tsx contains no diversity/score computation (D-04): `grep -Eiq "diversityScore|score\b" apps/dispatch-control/app/(dashboard)/registry/_components/CoverageStrip.tsx` returns NOTHING
    - `cd apps/dispatch-control && npx vitest run CoverageStrip` passes
  </acceptance_criteria>
  <done>An authenticated fetch client + an 8-column cause/geo/signal chip strip exist, with no Sanity import and no computed score.</done>
</task>

<task type="auto">
  <name>Task 3: Mount CoverageStrip on the Registry page + strict build</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/registry/page.tsx (Server Component; workspace resolution + current layout)
  </read_first>
  <action>
    Edit registry/page.tsx: import `CoverageStrip` and render `<CoverageStrip />` at the TOP of the page (above `<RegistryTable />`, below the "Charity Registry" heading row), per D-01 (strip mounts at the top of registry/page.tsx). CoverageStrip is a client component that self-fetches — no props needed beyond what it reads internally (workspace is fixed "eisenbalm" server-side in the endpoint). Keep the page a Server Component; do not add 'use client' to page.tsx.
    Then run the STRICT build (memory note: vitest does not type-check).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "CoverageStrip" apps/dispatch-control/app/(dashboard)/registry/page.tsx` succeeds
    - CoverageStrip appears BEFORE RegistryTable in page.tsx (grep line number of CoverageStrip < line number of RegistryTable JSX usage)
    - `pnpm --filter dispatch-control build` exits 0
    - `cd apps/dispatch-control && npx vitest run` full dashboard suite passes (incl. dispatch-control-no-sanity-write tripwire still green)
  </acceptance_criteria>
  <done>The coverage-memory strip renders at the top of the Registry; the strict dispatch-control build is clean and the no-Sanity tripwire stays green.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run CoverageStrip` green.
- `pnpm --filter dispatch-control build` exits 0.
- dispatch-control-no-sanity-write tripwire remains green (strip fetches via the pipeline endpoint, not Sanity).
- Strip shows side-by-side cause/geo/signal chips (repetition visible; no computed score).
</verification>

<success_criteria>
- MEM-01 satisfied end-to-end: last-8 featured charities' cause/geo/signal are visible as a scannable strip at the top of the Registry, sourced through the server endpoint.
</success_criteria>

<output>
After completion, create `.planning/phases/39-registry-coverage-memory-strip/39-05-SUMMARY.md`.
</output>
