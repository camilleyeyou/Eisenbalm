---
phase: 39-registry-coverage-memory-strip
plan: 05
subsystem: ui
tags: [nextjs, react, clerk, vitest, tailwind-v4-tokens, registry, coverage-strip, MEM-01]

# Dependency graph
requires:
  - phase: 39-registry-coverage-memory-strip
    provides: "GET /registry/coverage-strip (39-02) — Convex charities:listRecentFeatured joined server-side to Sanity focusArea/location/scoutNotes, Clerk-guarded, returning ≤8 {name, sanityCharityId, lastFeaturedAt, cause, geo, signal} rows"
provides:
  - "apps/dispatch-control/lib/coverageStripClient.ts — authenticated GET fetch client for the coverage-strip endpoint (findingsClient.ts pattern)"
  - "apps/dispatch-control/app/(dashboard)/registry/_components/CoverageStrip.tsx — 8(≤8)-column cause/geo/signal chip strip mounted at the top of the Registry"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "GET-only fetch client mirroring findingsClient.ts's pipelineBaseUrl()/Bearer/typed-error shape, adapted from POST to a single unauthenticated-body GET (evalScenarioClient.ts's GET precedent used for the request shape)"
    - "1c token classes (var(--color-cobalt)/--color-green/--color-marigold-text/--color-faint) via text-[color:var(--color-x)] bracket syntax — matches review-desk/eval-center precedent, not the older neutral-* Tailwind classes still used elsewhere in RegistryTable.tsx"

key-files:
  created:
    - apps/dispatch-control/lib/coverageStripClient.ts
    - apps/dispatch-control/app/(dashboard)/registry/_components/CoverageStrip.tsx
    - apps/dispatch-control/__tests__/CoverageStrip.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/registry/page.tsx

key-decisions:
  - "Used the 1c CSS-custom-property token classes (var(--color-cobalt) etc., Tailwind v4 @theme block) for chip coloring, matching the newer review-desk/eval-center/voice-pass components rather than RegistryTable.tsx's older plain neutral-* Tailwind classes — satisfies the plan's 'do NOT hardcode hex if a token class exists' instruction"
  - "Signal chip is truncated (64 chars) with the full text as a title-hover, mirroring RegistryTable's truncateUrl pattern referenced in the plan"

requirements-completed: [MEM-01]

# Metrics
duration: ~4min
completed: 2026-07-10
---

# Phase 39 Plan 05: Coverage-Strip UI Summary

**The Registry page now opens with a "Coverage memory — last 8" strip: an authenticated client fetch of `GET /registry/coverage-strip` renders one column per recently-featured charity with stacked cause/geo/signal chips, so an operator sees thematic repetition (e.g. three "Housing" causes in a row) at a glance — purely visual, no computed diversity score.**

## Performance

- **Duration:** ~4 min
- **Tasks:** 3 completed
- **Files modified:** 4 (3 created, 1 modified)

## Accomplishments
- `coverageStripClient.ts` — a Sanity-free authenticated fetch client (`fetchCoverageStrip(token)`) that GETs `${pipelineBaseUrl()}/registry/coverage-strip` with a `Bearer` header, mirroring `findingsClient.ts`'s `pipelineBaseUrl()` + typed-error shape.
- `CoverageStrip.tsx` — a client component that fetches on mount via `useAuth().getToken()`, renders one column per returned row (already `lastFeaturedAt`-desc from the server), and stacks a Cause/Geo/Signal chip per column using the 1c design tokens (cobalt/green/marigold-text). A missing chip (legacy row with no `sanityCharityId`, or a null field) renders an explicit `data-testid="coverage-chip-empty"` "—" affordance — never `"undefined"`, never a crash.
- Mounted `<CoverageStrip />` at the top of `registry/page.tsx`, above `<RegistryTable />`, per D-01 — the page itself stays a Server Component (no `'use client'` added to `page.tsx`).
- `pnpm --filter dispatch-control build` exits 0; full dashboard `vitest` suite is green (510 passed, 2 todo, 1 skipped file) including the `dispatch-control-no-sanity-write` EDT-05 tripwire.

## Task Commits

Each task committed atomically:

1. **Task 1 (RED): failing test for CoverageStrip rendering** — `45ca2e9` (test)
2. **Task 2 (GREEN): coverageStripClient + CoverageStrip component** — `ed867ea` (feat)
3. **Task 3: mount CoverageStrip on the Registry page + strict build** — `2491f6e` (feat)

**Plan metadata:** (this commit) — docs: complete plan

_Task 1→2 is the TDD pair (RED test commit then GREEN implementation commit)._

## Files Created/Modified
- `apps/dispatch-control/lib/coverageStripClient.ts` — `CoverageColumn` interface + `fetchCoverageStrip(token)`, `CoverageStripError` typed error
- `apps/dispatch-control/app/(dashboard)/registry/_components/CoverageStrip.tsx` — the 8-column chip-strip component, self-fetching via `useAuth`
- `apps/dispatch-control/app/(dashboard)/registry/page.tsx` — `<CoverageStrip />` mounted above `<RegistryTable />`
- `apps/dispatch-control/__tests__/CoverageStrip.test.tsx` — loading/repetition/null-chip/empty-response coverage

## Decisions Made
- Followed the plan's fetch-client pattern (mirror `findingsClient.ts`) adapted for a GET with no body, matching `evalScenarioClient.ts`'s existing GET-shaped precedent for the request itself.
- Chose the 1c CSS-token classes over RegistryTable.tsx's older `neutral-*` Tailwind palette for the new component, since the plan explicitly calls for token classes and the newer sibling components (review-desk, eval-center, voice-pass) already establish that convention.

## Deviations from Plan

None — plan executed exactly as written (3 tasks: RED test, GREEN client+component, mount+strict-build).

## Issues Encountered

None.

## Next Phase Readiness

- MEM-01 is fully wired end-to-end: `charities:listRecentFeatured` (39-01) → `GET /registry/coverage-strip` (39-02) → `CoverageStrip.tsx` (this plan) → mounted on the Registry.
- Phase 39 is now complete (MEM-01/MEM-02/MEM-03 all landed across 39-01 through 39-05) — this is the final plan of the final v3.0 phase per PROJECT.md.
- No blockers.

---
*Phase: 39-registry-coverage-memory-strip*
*Completed: 2026-07-10*

## Self-Check: PASSED

- `apps/dispatch-control/lib/coverageStripClient.ts` — FOUND (`registry/coverage-strip`, `Bearer` present)
- `apps/dispatch-control/app/(dashboard)/registry/_components/CoverageStrip.tsx` — FOUND (`fetchCoverageStrip` present, no Sanity import, no diversity-score computation)
- `apps/dispatch-control/app/(dashboard)/registry/page.tsx` — `CoverageStrip` mounted before `RegistryTable` (line 31 vs line 33)
- `apps/dispatch-control/__tests__/CoverageStrip.test.tsx` — FOUND (4 tests, all passing)
- Commits `45ca2e9`, `ed867ea`, `2491f6e` — all verified present in `git log`
- `pnpm --filter dispatch-control build` — exit 0
- `cd apps/dispatch-control && npx vitest run` — 64 files passed / 1 skipped, 510 tests passed / 2 todo
