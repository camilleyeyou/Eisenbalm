---
phase: 26-review-gate-charity-registry
plan: "04"
subsystem: apps/web
tags: [preview, csp, hmac, sanity, draft, security]
dependency_graph:
  requires: [26-01]
  provides: [RVW-02, preview-route, frame-ancestors-csp, preview-token-hmac]
  affects: [dispatch-control-review-iframe, apps/web/issue-pages]
tech_stack:
  added: []
  patterns:
    - HMAC-SHA256 5-minute sliding window token verification (timingSafeEqual)
    - Server-only Sanity previewDrafts client (SANITY_API_TOKEN never reaches browser)
    - Per-route frame-ancestors CSP (next.config.ts headers() scoped to /issue/:slug/preview)
    - IssueLayout shared component (D-09 fidelity: preview and published page use identical render tree)
key_files:
  created:
    - apps/web/lib/preview-token.ts
    - apps/web/lib/sanity/preview-client.ts
    - apps/web/app/issue/[slug]/preview/page.tsx
    - apps/web/components/issue/IssueLayout.tsx
  modified:
    - apps/web/lib/sanity/queries.ts
    - apps/web/app/issue/[slug]/page.tsx
    - apps/web/next.config.ts
    - apps/web/.env.example
    - apps/web/__tests__/preview-route.test.ts
decisions:
  - "IssueLayout extracted as shared component so preview page is byte-equivalent to published page — prevents render drift"
  - "frame-ancestors CSP scoped ONLY to /issue/:slug/preview in next.config.ts headers() — public issue pages unaffected (Pitfall 2)"
  - "verifyPreviewToken reads PREVIEW_SECRET at call time (not module init) — allows test env override via process.env mutation"
  - "meta robots noindex/nofollow inline in JSX (not metadata export) — preview is a Server Component with force-dynamic"
metrics:
  duration: "~10 min (continuation of interrupted plan)"
  completed_date: "2026-06-23"
  tasks: 3
  files: 9
---

# Phase 26 Plan 04: Web Draft Preview Route Summary

Token-guarded WYSIWYG draft preview route on `apps/web` that dispatch-control iframes for operator review — renders the exact Phase 19 magazine layout from the Sanity DRAFT via HMAC verification + `previewDrafts` perspective + per-route `frame-ancestors` CSP.

## Tasks Completed

### Task 1: HMAC token lib + server-only previewDrafts client + no-filter preview query (commit: 3b061e9)

Created `apps/web/lib/preview-token.ts` with `previewToken()` and `verifyPreviewToken()`:
- HMAC-SHA256 formula: `HMAC(PREVIEW_SECRET, "${runId}:${slug}:${Math.floor(Date.now()/300_000)}")`
- 5-minute sliding window: verifies current AND previous window (clock skew tolerance)
- `timingSafeEqual` for constant-time comparison; mismatched buffer lengths guarded before compare

Created `apps/web/lib/sanity/preview-client.ts` — SERVER ONLY:
- `createClient` with `perspective: 'previewDrafts'`, `useCdn: false`, `token: process.env.SANITY_API_TOKEN`
- Warning comment prevents accidental import from 'use client' components

Added `QUERY_ISSUE_PREVIEW_BY_SLUG` to `apps/web/lib/sanity/queries.ts`:
- Byte-identical projection to `QUERY_ISSUE_BY_SLUG`, removes `&& status == "published"` filter
- Original `QUERY_ISSUE_BY_SLUG` unchanged (published filter preserved)

### Task 2: Preview route page (token gate + draft render) (commit: 5dc45fc)

Created `apps/web/app/issue/[slug]/preview/page.tsx`:
- `export const dynamic = 'force-dynamic'` + `export const revalidate = 0` (no ISR/caching)
- `verifyPreviewToken()` called BEFORE any `sanityPreviewClient.fetch()` (token gate first)
- Invalid/missing/expired token → `<PreviewUnauthorized />` (401 copy)
- Draft not found → `<PreviewUnavailable />` (UI-SPEC error copy)
- `<meta name="robots" content="noindex,nofollow">` prevents draft indexing

Extracted `apps/web/components/issue/IssueLayout.tsx`:
- Shared magazine layout component used by both `page.tsx` (published) and `preview/page.tsx` (draft)
- D-09 fidelity: preview renders the exact same component tree as the published page — no drift possible
- Updated `apps/web/app/issue/[slug]/page.tsx` to use `IssueLayout` (byte-equivalent render)

### Task 3: Per-route frame-ancestors CSP + env docs + green preview tests (commit: da2fd7c)

Updated `apps/web/next.config.ts`:
- Added `async headers()` returning exactly ONE entry scoped to `/issue/:slug/preview`
- Header: `Content-Security-Policy: frame-ancestors 'self' ${PREVIEW_ALLOWED_ORIGIN}`
- Public issue pages have NO frame-ancestors CSP (Pitfall 2 avoidance — not site-wide)

Updated `apps/web/.env.example`:
- `SANITY_API_TOKEN` — server-only Sanity read token for draft access
- `PREVIEW_SECRET` — HMAC shared secret (must match dispatch-control)
- `PREVIEW_ALLOWED_ORIGIN` — dispatch-control origin for iframe embedding

Implemented `apps/web/__tests__/preview-route.test.ts` (all 43 test files pass):
- File-system existence checks for all 3 artifacts
- Source-scan: verifyPreviewToken, force-dynamic, noindex, unauthorized branch, call order
- Query invariants: QUERY_ISSUE_PREVIEW_BY_SLUG no-status-filter; QUERY_ISSUE_BY_SLUG unchanged
- next.config.ts: frame-ancestors present, scoped to /issue/:slug/preview, exactly one source
- .env.example: SANITY_API_TOKEN, PREVIEW_SECRET, PREVIEW_ALLOWED_ORIGIN documented
- Token round-trip: generate + verify, tampered token fails, different slug/runId fails, clock skew (previous window passes), expired (2 windows ago fails), missing secret returns false

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TS2532 "Object is possibly undefined" in preview-route.test.ts**
- **Found during:** Task 3 typecheck
- **Issue:** `origLines[i].trim()` in the GROQ query body extractor loop — TypeScript strict mode flags array indexing as potentially undefined
- **Fix:** Changed to `(origLines[i] ?? '').trim()` — nullish coalescing provides empty string fallback; semantically identical since an undefined line would never equal '`'
- **Files modified:** `apps/web/__tests__/preview-route.test.ts`
- **Commit:** da2fd7c

## Self-Check

- [x] `apps/web/lib/preview-token.ts` — exists, timingSafeEqual, 5-minute window
- [x] `apps/web/lib/sanity/preview-client.ts` — exists, SERVER ONLY comment, previewDrafts
- [x] `apps/web/app/issue/[slug]/preview/page.tsx` — exists, verifyPreviewToken before fetch, force-dynamic, noindex, Unauthorized branch
- [x] `apps/web/next.config.ts` — frame-ancestors, scoped to /issue/:slug/preview, one source only
- [x] `apps/web/.env.example` — SANITY_API_TOKEN, PREVIEW_SECRET, PREVIEW_ALLOWED_ORIGIN
- [x] `apps/web/__tests__/preview-route.test.ts` — 43 test files pass, token round-trip green
- [x] `QUERY_ISSUE_PREVIEW_BY_SLUG` — no status filter
- [x] `QUERY_ISSUE_BY_SLUG` — published filter intact
- [x] Commits 3b061e9, 5dc45fc, da2fd7c exist

## Self-Check: PASSED
