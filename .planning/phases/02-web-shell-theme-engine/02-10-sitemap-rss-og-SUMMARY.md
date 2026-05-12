---
phase: "02"
plan: "10"
subsystem: apps/web
tags: [seo, sitemap, rss, robots, og-image, next-js, sanity]
dependency_graph:
  requires: ["02-01", "02-02", "02-05"]
  provides: ["/sitemap.xml dynamic route", "/feed.xml RSS 2.0", "/robots.txt", "/og-default.png"]
  affects: ["02-11"]
tech_stack:
  added: []
  patterns:
    - "Next.js App Router sitemap.ts convention (MetadataRoute.Sitemap)"
    - "RSS 2.0 hand-built XML (no rss-lib dep)"
    - "Inline QUERY_FEED GROQ projection (separate from canonical QUERY_ARCHIVE)"
    - "Guard pattern: check NEXT_PUBLIC_SANITY_PROJECT_ID before Sanity fetch"
    - "client.ts placeholder projectId to prevent module-init throw in CI"
key_files:
  created:
    - apps/web/app/sitemap.ts
    - apps/web/app/feed.xml/route.ts
    - apps/web/public/robots.txt
    - apps/web/public/og-default.png
  modified:
    - apps/web/lib/sanity/client.ts
decisions:
  - "QUERY_FEED is inline in feed.xml/route.ts (not added to canonical queries.ts) to avoid mutating API_CONTRACTS.md §1.3 shape; RSS is the only consumer"
  - "robots.txt is a static file in public/ (per UI-SPEC §robots.txt) not a Next.js app/robots.ts Route — matches plan artifact spec"
  - "og-default.png is a 1200x630 off-white (#FAFAF8) placeholder PNG generated via Node.js zlib; Andrew replaces with real brand artwork before launch"
  - "client.ts uses 'placeholder' projectId fallback so createClient does not throw at module load in unconfigured builds; callers guard on NEXT_PUBLIC_SANITY_PROJECT_ID before fetching"
  - "Removed force-static from feed.xml/route.ts — revalidate=60 (ISR) is sufficient and avoids build-time static collection issues"
metrics:
  duration_minutes: 18
  completed_date: "2026-05-12"
  tasks_completed: 4
  files_modified: 5
---

# Phase 02 Plan 10: Sitemap, RSS Feed, Robots, OG Placeholder — Summary

Shipped the SEO and syndication infrastructure: dynamic sitemap, RSS 2.0 feed, robots.txt, and a static OG fallback image. All four requirements (WEB-11, WEB-12, WEB-13) satisfied.

## What Was Built

### Task 1 — `apps/web/app/sitemap.ts`

Next.js App Router `sitemap.ts` convention producing `/sitemap.xml`. Returns `MetadataRoute.Sitemap` array with:

- **5 static entries**: `/` (1.0), `/archive` (0.7), `/charities` (0.6), `/about` (0.3), `/shop` (0.5)
- **N issue entries** from `QUERY_ARCHIVE` (priority 0.9, `changeFrequency: 'yearly'`, `lastModified` from `publishDate`)
- **M charity entries** from `QUERY_ALL_CHARITIES` (priority 0.7, `changeFrequency: 'monthly'`)
- ISR `revalidate = 60`
- Guard: returns static-only entries if `NEXT_PUBLIC_SANITY_PROJECT_ID` is absent (CI/unconfigured builds)

### Task 2 — `apps/web/app/feed.xml/route.ts`

RSS 2.0 Route Handler at `/feed.xml`. Key design decisions:

- **Inline `QUERY_FEED`** projection: adds `charity->{ name, missionStatement }` not present in `QUERY_ARCHIVE`. Kept separate to avoid mutating the canonical API contract.
- **Hand-built XML** with `escapeXml()` and `toRfc822()` helpers — no rss library dep added.
- **Item title format** per UI-SPEC: `{charity.name} — Issue {N}` (em dash, no exclamation marks)
- **Item description**: `charity.missionStatement` (no full body — keeps site as destination)
- `<atom:link>` self-reference for feed reader compatibility
- `Content-Type: application/rss+xml; charset=utf-8`
- `Cache-Control: public, max-age=60, s-maxage=60`
- Guard: returns minimal valid empty channel when `NEXT_PUBLIC_SANITY_PROJECT_ID` is absent

### Task 3 — `apps/web/public/robots.txt`

Static file per UI-SPEC §robots.txt:

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /_next/

Sitemap: https://eisenbalm.com/sitemap.xml
```

### Task 4 — `apps/web/public/og-default.png`

1200x630 PNG generated via Node.js built-in `zlib` (no external deps). Solid off-white `#FAFAF8` background. File is **a placeholder** — Andrew should replace with real brand artwork (logotype + "The Eisenbalm Dispatch" typeset properly) before production launch. The file is a valid PNG (confirmed: `PNG image data, 1200 x 630, 8-bit/color RGB, non-interlaced`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Sanity `createClient` throws at module load with empty projectId**
- **Found during:** Task 1 verification (build run)
- **Issue:** `apps/web/lib/sanity/client.ts` calls `createClient({ projectId: '' })` which Sanity's SDK throws on immediately at module initialization. Next.js "collecting page data" phase evaluates all route modules, triggering the throw.
- **Fix:** Added `const projectIdOrPlaceholder = SANITY_PROJECT_ID || 'placeholder'` in `client.ts`. Sanity SDK accepts 'placeholder' without throwing; actual fetches with 'placeholder' receive a 404 from Sanity's API, which is catchable in route handlers.
- **Files modified:** `apps/web/lib/sanity/client.ts`
- **Commit:** be814a1

**2. [Rule 2 - Missing error handling] No guard for missing projectId in sitemap and feed routes**
- **Found during:** Task 1 + Task 2 verification (build run)
- **Issue:** `sitemap.ts` is always statically collected by Next.js at build time. Without a projectId guard, it would attempt a Sanity fetch and fail in CI/unconfigured environments.
- **Fix:** Added `if (!projectId) return [staticEntries]` guard in `sitemap.ts` and an equivalent guard in `feed.xml/route.ts` that returns a minimal valid empty RSS channel.
- **Files modified:** `apps/web/app/sitemap.ts`, `apps/web/app/feed.xml/route.ts`
- **Commit:** be814a1

**3. [Rule 3 - Blocking] Removed `force-static` from `feed.xml/route.ts`**
- **Found during:** Task 2 verification
- **Issue:** `export const dynamic = 'force-static'` caused Next.js to statically collect the feed route at build time, which attempted a Sanity network call. `revalidate = 60` (ISR) is sufficient for caching without forcing static generation.
- **Fix:** Removed `export const dynamic = 'force-static'`.
- **Commit:** be814a1

### Out-of-scope Pre-existing Issue

**`/charities/[slug]` build failure** — `apps/web/app/charities/[slug]/page.tsx` (plan 02-08) calls `generateStaticParams()` which hits the Sanity API at build time. With 'placeholder' projectId this returns a 404. This is out of scope for plan 02-10 and logged in deferred-items.

## Known Stubs

- `apps/web/public/og-default.png` — solid `#FAFAF8` placeholder (1200x630 valid PNG). Andrew must replace with real brand artwork (logotype, typeset brand name, correct brand colors) before launch. No code change required — drop in a replacement PNG at the same path.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `apps/web/app/sitemap.ts` exists | FOUND |
| `apps/web/app/feed.xml/route.ts` exists | FOUND |
| `apps/web/public/robots.txt` exists | FOUND |
| `apps/web/public/og-default.png` exists (valid PNG) | FOUND |
| Commit be814a1 exists | FOUND |
