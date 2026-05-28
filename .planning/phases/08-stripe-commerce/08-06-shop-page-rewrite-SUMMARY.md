---
phase: 08-stripe-commerce
plan: "06"
subsystem: ui
tags: [nextjs, sanity, stripe, server-component, shop]

requires:
  - phase: 08-04
    provides: BuyButton client component at @/components/marketing/BuyButton
  - phase: 08-01
    provides: CMR-01 and CMR-09 Wave 0 test gates

provides:
  - Functional /shop server-rendered page with BuyButton + dynamic charity callout
  - CMR-01 satisfied (server component, no 'use client', Sanity fetch, ISR revalidate=60)

affects: [08-07, 08-08]

tech-stack:
  added: []
  patterns:
    - "Server Component with Client Component island: async Server Component page embeds 'use client' BuyButton — no page-level client boundary"
    - "Defensive Sanity fetch: try/catch fallback to null — Sanity outage renders fallback copy instead of 500"

key-files:
  created: []
  modified:
    - apps/web/app/shop/page.tsx

key-decisions:
  - "Phase 2 metadata export (title, description, OG, Twitter card, canonical URL) preserved verbatim — no content change"
  - "QUERY_LATEST_CHARITY_NAME stays inline (single-consumer pattern from Phase 2) — not added to lib/sanity/queries.ts"
  - "try/catch wraps sanityClient.fetch: consistent with apps/web/app/issue/[slug]/page.tsx defensive posture"
  - "Tailwind canonical class warnings (text-text-muted etc.) left in `text-[color:var(--color-text-muted)]` form to preserve consistency with rest of Phase 2 shop layout"

patterns-established:
  - "Server Component + Client Island: page-level 'use client' forbidden; BuyButton is the sole client boundary"

requirements-completed:
  - CMR-01

duration: 4min
completed: "2026-05-28"
---

# Phase 08 Plan 06: Shop Page Rewrite Summary

**Replaced the Phase 2 disabled-button /shop shell with a server-rendered product page that fetches the live charity name from Sanity and presents the BuyButton from Plan 08-04 as the sole purchase trigger.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-28T16:33:45Z
- **Completed:** 2026-05-28T16:37:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- `/shop` is now the real product page: server-rendered, no `'use client'` directive, ISR revalidate=60
- Dynamic charity callout reads from Sanity at request time: "This week's proceeds benefit {name}." with "Proceeds go to our featured charity each week." fallback when Sanity returns null
- BuyButton (Plan 08-04) is wired in as the sole purchase trigger, replacing the disabled `<Button Coming soon />`
- Jesse-voice product description copy added ("One tube. Mineral-tinted, unscented…")
- CMR-01 Wave 0 test: 6/6 green
- CMR-09 ShopCallout tripwire: 5/5 green (component untouched)
- `pnpm --filter web build` exits 0; /shop compiles at 2.05 kB

## Task Commits

1. **Task 1: Rewrite shop page with BuyButton + charity callout** — `4c3abbf` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `apps/web/app/shop/page.tsx` — Rewrote Phase 2 placeholder: added BuyButton import + render, defensive try/catch around Sanity fetch, product description copy; kept metadata export + GROQ projection + revalidate=60 verbatim from Phase 2

## Decisions Made
- Phase 2 metadata export (title, OG, Twitter) preserved byte-for-byte — spec says "verbatim", no editorial change needed
- `QUERY_LATEST_CHARITY_NAME` kept inline (single consumer; Phase 2 decision documented in STATE.md)
- Defensive `try/catch` around `sanityClient.fetch` matches the issue page pattern — a Sanity CDN outage must not 500 the commerce path
- Tailwind `text-[color:var(--color-text-muted)]` form retained (style consistency with existing Phase 2 shop layout; build warnings, not errors)

## Deviations from Plan

None — plan executed exactly as written. The rewrite specification in the PLAN.md action block was followed without modification.

## Phase 2 Metadata Preservation Audit

| Field | Phase 2 value | Phase 8 value | Match |
|-------|--------------|---------------|-------|
| title | `'Shop'` | `'Shop'` | yes |
| description | `'Jesse A. Eisenbalm lip balm…'` | identical | yes |
| OG type | `'website'` | `'website'` | yes |
| OG title | `Shop — ${SITE_NAME}` | identical | yes |
| OG image | `'/og-default.png'` | `'/og-default.png'` | yes |
| Twitter card | `'summary_large_image'` | `'summary_large_image'` | yes |
| canonical | `${getSiteUrl()}/shop` | identical | yes |
| revalidate | `60` | `60` | yes |

All metadata preserved verbatim.

## Product Description Copy (Andrew can revise)

> One tube. Mineral-tinted, unscented, made by a small contract manufacturer in the Pacific Northwest. Ships flat-rate within the continental United States.

This is the current placeholder shape locked for audit. Andrew can edit via Sanity Studio or a future plan once product copy is finalized.

## Test Results

| Test file | Result |
|-----------|--------|
| `__tests__/shop-page.test.ts` (CMR-01) | 6/6 green |
| `__tests__/issue-page-shop-callout.test.ts` (CMR-09) | 5/5 green |
| `pnpm --filter web build` | exit 0 |

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness
- Plan 08-07 (thank-you page + legal) can proceed — `/shop` is functional
- Plan 08-08 (UAT) is the first plan that should involve a dev-server smoke of BuyButton click (live Stripe call). DO NOT click BuyButton in dev before 08-08 UAT context.

---
*Phase: 08-stripe-commerce*
*Completed: 2026-05-28*

## Self-Check: PASSED

- `apps/web/app/shop/page.tsx`: FOUND
- commit `4c3abbf`: FOUND
- CMR-01 tests: 6/6 green
- CMR-09 tests: 5/5 green
- build: exit 0
