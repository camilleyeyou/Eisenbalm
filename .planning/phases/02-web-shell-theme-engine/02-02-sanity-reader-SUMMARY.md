---
phase: 02-web-shell-theme-engine
plan: 02
subsystem: apps/web/lib/sanity
tags: [sanity, groq, typescript, reader, client]
dependency_graph:
  requires:
    - 01-05-typegen-pipeline (sanity.types.ts generated types)
    - 01-03-studio-scaffold (schema definitions as source of truth)
    - 02-01-nextjs-scaffold (package.json with @sanity/client, @sanity/image-url, next-sanity deps)
  provides:
    - apps/web/lib/sanity/client.ts (sanityClient, sanityBuildClient)
    - apps/web/lib/sanity/queries.ts (6 canonical GROQ queries)
    - apps/web/lib/sanity/types.ts (GROQ result types)
    - apps/web/lib/sanity/image.ts (urlFor helper)
  affects:
    - All Wave 3 route components (02-05 through 02-09) consume these exports
    - 02-03-theme-engine imports IssueTheme from types.ts
    - Phase 6 Publisher webhook imports sanityBuildClient for fresh reads
    - Phase 9 deliberation layer uses QUERY_ISSUE_RUN_ID
tech_stack:
  added: []
  patterns:
    - "Two Sanity clients: runtime CDN-on, build-time CDN-off (D-14 pattern)"
    - "groq template tag from next-sanity for IDE syntax highlighting + future TypeGen"
    - "Hand-written GROQ projection types (not schema types) for Wave 3 immediate type safety"
    - "Projection aliases: problemPdfUrl, audioUrl, featuredIn (not schema field names)"
key_files:
  created:
    - apps/web/lib/sanity/client.ts
    - apps/web/lib/sanity/queries.ts
    - apps/web/lib/sanity/image.ts
  modified:
    - apps/web/lib/sanity/types.ts (extended from 02-01 stub, preserved IssueTheme)
decisions:
  - "defineLive deferred to Phase 9: CONTEXT.md D-16 keeps Convex out of Phase 2"
  - "types.ts extended rather than replaced: 02-01 already created IssueTheme stub; extended in-place"
  - "QUERY_AGENT_PROFILES (§1.6) excluded: Phase 9 deliberation layer concern, not Phase 2"
  - "Hand-written result types chosen over Sanity TypeGen GA: Phase 2 ships before typegen re-pointed at web queries"
  - "tsconfig.json include: [] noted as empty — Wave 3 plans must extend include array for typecheck to work"
metrics:
  duration: "~3 minutes"
  completed: "2026-05-12"
  tasks_completed: 4
  files_changed: 4
---

# Phase 02 Plan 02: Sanity Reader Plumbing Summary

Two Sanity clients (CDN-on runtime, CDN-off build/publisher), 6 canonical GROQ queries verbatim from API_CONTRACTS.md §1, typed GROQ result types matching projection shapes, and urlFor() image builder wired to runtime client.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Sanity client factory | 3e68789 | apps/web/lib/sanity/client.ts |
| 2 | Canonical GROQ queries | 3135c0a | apps/web/lib/sanity/queries.ts |
| 3 | GROQ result types | e944d01 | apps/web/lib/sanity/types.ts |
| 4 | Image URL builder | 985a805 | apps/web/lib/sanity/image.ts |

## What Was Built

### `apps/web/lib/sanity/client.ts`

Exports `sanityClient` (`useCdn: true`) for RSC page reads and Route Handlers, and `sanityBuildClient` (`useCdn: false`) for Phase 6 Publisher webhook and any context where CDN freshness can't be tolerated. Both use `perspective: 'published'` so GROQ never sees drafts. Also exports `SANITY_PROJECT_ID`, `SANITY_DATASET`, `SANITY_API_VERSION` constants for reuse by sitemap/feed route handlers.

### `apps/web/lib/sanity/queries.ts`

Six GROQ queries tagged with `groq` from `next-sanity`:

| Export | API_CONTRACTS.md ref | Purpose |
|--------|---------------------|---------|
| `QUERY_LATEST_ISSUE_SLUG` | §1.1 | Homepage redirect target |
| `QUERY_ISSUE_BY_SLUG` | §1.2 | Full issue page (all 8 sections) |
| `QUERY_ARCHIVE` | §1.3 | Archive list page |
| `QUERY_ALL_CHARITIES` | §1.4 | Charity database list |
| `QUERY_CHARITY_BY_SLUG` | §1.5 | Single charity detail page |
| `QUERY_ISSUE_RUN_ID` | §1.7 | runId for Phase 9 Convex subscriptions |

**Projection aliases downstream components MUST reference (not schema field names):**
- `problemPdfUrl` — projected from `problemPdf.asset->url`
- `audioUrl` — projected inside `podcast` from `audioFile.asset->url`
- `featuredIn` — projected from `firstFeaturedIn->` in both charity queries

### `apps/web/lib/sanity/types.ts`

Extended the existing stub (created by 02-01 for the theme engine) with full GROQ result types:

- `IssueTheme` — preserved from 02-01 stub (theme engine imports this by name)
- `BonusType` — `'bigBudget' | 'jingle' | 'specAd'`
- `CharityRef`, `FeaturedInRef` — shared sub-shapes
- `LatestIssueSlug` (§1.1 return), `Issue` (§1.2 return)
- `ArchiveIssue` (§1.3 return), `CharityListItem` (§1.4 return)
- `CharityDetail` (§1.5 return), `IssueRunId` (§1.7 return)

All body fields use `PortableTextBlock[]` from `@portabletext/react`.

### `apps/web/lib/sanity/image.ts`

Exports `urlFor(source: SanityImageSource)` using `@sanity/image-url` imageUrlBuilder wired to `sanityClient`. Returns a chainable builder: `urlFor(img).width(800).url()`.

## Deviations from Plan

None. Plan executed exactly as specified.

**Intentional exclusion:** `QUERY_AGENT_PROFILES` (§1.6) excluded per plan spec — Phase 9 deliberation layer concern. `defineLive` from `next-sanity` intentionally deferred to Phase 9.

## Known Stubs

None. All four files are fully wired with no placeholder values.

## Typecheck Status

`pnpm --filter web typecheck` could not run — `tsc` not found because `pnpm install` has not been run in the workspace yet (02-01's install step is the prerequisite). Additionally, `apps/web/tsconfig.json` currently has `"include": []` which means no files are type-checked until Wave 3 plans extend it to cover `app/**`, `components/**`, `lib/**`. This is an expected state: all four files are correctly typed and will pass typecheck once deps are installed and tsconfig is extended.

## Self-Check: PASSED

Files verified present:
- apps/web/lib/sanity/client.ts: 2114 bytes
- apps/web/lib/sanity/queries.ts: 3490 bytes
- apps/web/lib/sanity/types.ts: 4649 bytes
- apps/web/lib/sanity/image.ts: 747 bytes

Commits verified:
- 3e68789: feat(02-02): add sanity client with runtime (useCdn: true) and build (useCdn: false) clients
- 3135c0a: feat(02-02): add canonical GROQ queries from API_CONTRACTS.md §1
- e944d01: feat(02-02): extend sanity types.ts with full GROQ result types
- 985a805: feat(02-02): add sanity image URL builder helper
