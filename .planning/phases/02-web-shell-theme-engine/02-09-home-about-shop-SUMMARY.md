---
phase: 02-web-shell-theme-engine
plan: 09
subsystem: ui
tags: [next.js, sanity, shadcn, groq, server-components, isr]

requires:
  - phase: 02-01
    provides: root layout (SiteHeader/SiteFooter chrome)
  - phase: 02-02
    provides: Sanity client, queries.ts (QUERY_LATEST_ISSUE_SLUG), lib/site.ts
  - phase: 02-05
    provides: shadcn Button component at @/components/ui/button

provides:
  - "app/page.tsx: homepage server component — redirects to /issue/{latestSlug} or renders Jesse-voice empty state"
  - "app/about/page.tsx: static about page with locked UI-SPEC placeholder copy + OG metadata"
  - "app/shop/page.tsx: Phase 2 shop shell — dynamic charity callout + shadcn Button disabled (Phase 8 replaces)"
  - "components/marketing/ShopCallout.tsx: reusable one-sentence + Button asChild component for /issue/[slug] bottom slot"

affects:
  - "02-06 (issue route) — imports ShopCallout from @/components/marketing/ShopCallout"
  - "08-stripe — replaces app/shop/page.tsx with full Stripe Checkout flow"

tech-stack:
  added: []
  patterns:
    - "Inline GROQ projection for page-scoped queries that don't warrant a slot in lib/sanity/queries.ts"
    - "export const revalidate = 60 for ISR on server components with Sanity reads"
    - "shadcn Button asChild + Link for navigation CTAs"
    - "UI-SPEC Copywriting Contract enforced verbatim — no rephrasing of locked copy strings"

key-files:
  created:
    - apps/web/app/about/page.tsx
    - apps/web/app/shop/page.tsx
    - apps/web/components/marketing/ShopCallout.tsx
  modified:
    - apps/web/app/page.tsx

key-decisions:
  - "QUERY_LATEST_CHARITY_NAME inlined in shop/page.tsx instead of added to lib/sanity/queries.ts — single consumer, Phase 8 rewrites the page entirely"
  - "ShopCallout accepts optional charityName prop — falls back to generic copy when no published issue exists"
  - "Tailwind CSS variable syntax kept as text-[color:var(--color-text)] (not canonical aliases) for consistency with existing Phase 2 files"
  - "IDE warnings about canonical Tailwind v4 class aliases ignored — existing codebase uses explicit var() syntax throughout"

patterns-established:
  - "Locked copy strings: all UI-SPEC Copywriting Contract strings used verbatim, including empty states and callout sentences"
  - "No urgency language, no exclamation marks, no countdown/email/newsletter elements on any route"
  - "Phase 2 shop shell pattern: disabled Button + inline GROQ + revalidate=60, to be replaced in Phase 8"

requirements-completed: [WEB-01, WEB-05, WEB-11]

duration: 8min
completed: 2026-05-11
---

# Phase 2 Plan 09: Home, About, Shop Summary

**Homepage redirect (QUERY_LATEST_ISSUE_SLUG), /about placeholder, Phase 2 /shop shell with dynamic charity callout, and reusable ShopCallout component for the issue page bottom slot**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-11T09:00:00Z
- **Completed:** 2026-05-11T09:08:00Z
- **Tasks:** 3 (+ ShopCallout as implicit Task 4 per critical_rules)
- **Files modified:** 4

## Accomplishments

- `app/page.tsx` — replaces the Plan 02-05 `HomePlaceholder` stub; server component fetches `QUERY_LATEST_ISSUE_SLUG`, redirects to `/issue/{slug}` when a published issue exists, renders Jesse-voice empty state otherwise
- `app/about/page.tsx` — static page with locked UI-SPEC copy ("The Eisenbalm Dispatch publishes weekly. This page is being written.") + OG/Twitter metadata
- `app/shop/page.tsx` — Phase 2 shell: inline `QUERY_LATEST_CHARITY_NAME` GROQ for charity callout, shadcn `<Button disabled size="lg">Coming soon</Button>`, `revalidate = 60`
- `components/marketing/ShopCallout.tsx` — server component: one sentence (dynamic or fallback), `<Button asChild size="lg"><Link href="/shop">Buy the lip balm</Link></Button>`, `print:hidden`

## Task Commits

All tasks committed atomically in a single feat commit:

1. **Task 1: homepage redirect/empty-state** — `ba1ca41`
2. **Task 2: /about static page** — `ba1ca41`
3. **Task 3: /shop Phase 2 shell** — `ba1ca41`
4. **ShopCallout component (critical_rules Task 4)** — `ba1ca41`

## Files Created/Modified

- `apps/web/app/page.tsx` — Modified: replaces stub; QUERY_LATEST_ISSUE_SLUG → redirect or empty state; export const revalidate = 60
- `apps/web/app/about/page.tsx` — Created: static about with locked placeholder copy, OG/Twitter metadata
- `apps/web/app/shop/page.tsx` — Created: Phase 2 shell; inline GROQ QUERY_LATEST_CHARITY_NAME; shadcn Button disabled; revalidate=60
- `apps/web/components/marketing/ShopCallout.tsx` — Created: ShopCallout component; charityName prop optional; Button asChild; print:hidden

## Decisions Made

- Inline `QUERY_LATEST_CHARITY_NAME` in `shop/page.tsx` rather than extending `lib/sanity/queries.ts` — only one consumer and Phase 8 replaces this page entirely with Stripe Checkout
- `ShopCallout` accepts optional `charityName?: string | null` prop so the issue page passes it from the fetched issue data; falls back to generic copy when null
- Kept `text-[color:var(--color-text)]` syntax (not Tailwind v4 canonical aliases like `text-text`) to match the existing pattern across all other Phase 2 files — IDE warnings are informational only
- All four files committed atomically in one feat commit per plan instructions (wave 3 parallel)

## Deviations from Plan

None — plan executed exactly as written. The `ShopCallout` component was listed in the plan's `critical_rules` and `<parallel_execution>` context, treated as an implicit Task 4 alongside the three explicit tasks.

## Issues Encountered

None. TypeScript typecheck (`pnpm --filter web typecheck`) passed clean on first attempt.

## Known Stubs

- `app/shop/page.tsx` — entire page is a Phase 2 shell. Phase 8 replaces it with Stripe Checkout session, real product images, and price display. The disabled Button CTA is intentional — not a bug.
- `app/about/page.tsx` — placeholder copy locked by UI-SPEC. Andrew supplies real copy in a later phase. File is a valid stub by design.

## Next Phase Readiness

- `<ShopCallout charityName={issue.charity.name} />` is importable by Plan 02-06's issue route from `@/components/marketing/ShopCallout`
- All three routes resolve without 404 — Andrew can browse `/`, `/about`, `/shop` by end of Wave 3
- `/` redirects to `/issue/issue-1` when the demo seed (Plan 02-04) has run
- Phase 8 will rewrite `app/shop/page.tsx` from scratch — no migration needed

---
*Phase: 02-web-shell-theme-engine*
*Completed: 2026-05-11*
