---
phase: 02-web-shell-theme-engine
plan: "08"
subsystem: apps/web
tags: [charities, json-ld, seo, external-links, server-components]
dependency_graph:
  requires:
    - "02-01"  # Next.js app scaffold (sanityClient, site.ts, types.ts)
    - "02-02"  # Root layout + globals.css (CSS variables in scope)
    - "02-05"  # Sanity queries + types (QUERY_ALL_CHARITIES, QUERY_CHARITY_BY_SLUG)
  provides:
    - "/charities route — alphabetical charity list server component"
    - "/charities/[slug] route — detail page with NGO JSON-LD"
    - "CharityCard component (reusable in other surfaces)"
    - "CharityDetail component (reusable in other surfaces)"
  affects:
    - "Phase 7/9 — game/deliberation slot wiring (not touched here)"
    - "Phase 8 — Stripe shop (not touched here)"
tech_stack:
  added: []
  patterns:
    - "Server Component + sanityClient.fetch pattern (revalidate = 60)"
    - "generateStaticParams with QUERY_ALL_CHARITIES"
    - "generateMetadata with OG + Twitter + canonical"
    - "schema.org/NGO JSON-LD via <JsonLd> (safeJsonLdString escapes </ sequences)"
    - "External link safety: rel=noopener noreferrer + target=_blank on all user-supplied URLs"
    - "WebkitLineClamp: 2 for 2-line mission statement clamp (CharityCard)"
    - "Graceful null omission: featuredIn, foundingYear, scoutNotes, optional links"
key_files:
  created:
    - apps/web/components/charities/CharityCard.tsx
    - apps/web/components/charities/CharityDetail.tsx
    - apps/web/app/charities/page.tsx
    - apps/web/app/charities/[slug]/page.tsx
  modified: []
decisions:
  - "NGO JSON-LD only includes non-null fields (spreads conditional objects) to avoid emitting 'null' in structured data"
  - "featuredIn back-link omitted entirely when null — no placeholder, no empty element rendered"
  - "foundingDate in JSON-LD: String(foundingYear) per schema.org — schema stores number, JSON-LD expects string"
  - "Filtering UI for /charities deferred to v2 per UI-SPEC (dataset < 50 entries does not justify filter complexity)"
  - "CharityCard uses font-display class at 22px (Heading tier) per UI-SPEC §12, not Display 36px"
  - "CharityDetail uses font-display at 36px (Display tier) per UI-SPEC §13 — h1 anchor"
  - "External link comments explain rel=noopener noreferrer rationale inline for future maintainers"
metrics:
  duration_seconds: 179
  completed_date: "2026-05-12"
  tasks_completed: 4
  tasks_total: 4
  files_created: 4
  files_modified: 0
---

# Phase 02 Plan 08: Charities Routes Summary

**One-liner:** `/charities` alphabetical list and `/charities/[slug]` detail with `schema.org/NGO` JSON-LD, external link safety (`rel="noopener noreferrer"`), and ISR at 60s.

---

## What Was Built

### CharityCard (`apps/web/components/charities/CharityCard.tsx`)

Single row in the `/charities` alphabetical list. Renders:
- Charity name (Display/Heading 22px semibold) linking to `/charities/{slug}`
- Location + focus area metadata (UI 14px muted)
- Mission statement truncated to 2 lines via `WebkitLineClamp: 2`
- Optional "Featured in Issue {N}" back-link — omitted entirely when `featuredIn` is null

### CharityDetail (`apps/web/components/charities/CharityDetail.tsx`)

Full detail render consumed by `/charities/[slug]`. Renders:
- Charity name as `<h1>` (Display 36px/28px semibold) — primary visual anchor
- Metadata row: location, focus area, `Est. {year}` (omitted when null), asset range
- Mission statement full (Body 18px, no truncation on detail page)
- External links with `rel="noopener noreferrer"` + `target="_blank"` on every anchor:
  - "Visit {charity.name}" → `charity.website`
  - "View on Charity Navigator" → `charity.charityNavigatorUrl` (omitted when null)
  - "View on Candid" → `charity.guidestarUrl` (omitted when null)
- "About this charity" scout notes section (UI 14px uppercase label + Body 18px text)
- "This charity was featured in Issue {N} ({Month YYYY})" back-link (omitted when null)

### /charities list page (`apps/web/app/charities/page.tsx`)

Server component with `revalidate = 60`. Fetches `QUERY_ALL_CHARITIES` (alphabetical order enforced in GROQ via `order(name asc)`). Empty state: "No charities indexed yet." (Jesse voice, dry, no exclamation). Full `generateMetadata` with OG + Twitter card + canonical URL.

### /charities/[slug] detail page (`apps/web/app/charities/[slug]/page.tsx`)

Server component with `revalidate = 60`. Fetches `QUERY_CHARITY_BY_SLUG`, calls `notFound()` on null. Includes:
- `generateStaticParams` from all charity slugs (build-time static generation)
- `generateMetadata` with `charity.name` title, `missionStatement` truncated to 160 chars as description, OG + Twitter + canonical
- `schema.org/NGO` JSON-LD injected via `<JsonLd>` with null-field guards

---

## NGO JSON-LD Shape

```json
{
  "@context": "https://schema.org",
  "@type": "NGO",
  "name": "{charity.name}",
  "location": "{charity.location}",
  "description": "{charity.missionStatement}",  // omitted when null
  "url": "{charity.website}",                   // omitted when null
  "foundingDate": "{String(charity.foundingYear)}" // omitted when null; number → string
}
```

Injected via `<JsonLd data={ngoLd} />`. `JsonLd.tsx` uses `dangerouslySetInnerHTML` with `safeJsonLdString` which escapes `<` as `<` to prevent script-tag breakout.

---

## featuredIn Omission Pattern

`firstFeaturedIn` (Sanity schema field) is projected as `featuredIn` in both `QUERY_ALL_CHARITIES` and `QUERY_CHARITY_BY_SLUG`. Both components use a conditional render:

```tsx
{charity.featuredIn ? (
  <p>...</p>
) : null}
```

No placeholder, no empty element, no "Not yet featured" copy — the element simply does not exist in the DOM when `featuredIn` is null. This matches the UI-SPEC §12/§13 requirement: "omit if null."

---

## External Link Safety

All anchors to `charity.website`, `charity.charityNavigatorUrl`, and `charity.guidestarUrl` carry:

```tsx
target="_blank"
rel="noopener noreferrer"
```

- `noopener`: prevents opened page from accessing `window.opener` (tab-napping prevention)
- `noreferrer`: suppresses the Referer header (privacy + noopener fallback for older browsers)

Inline comments in `CharityDetail.tsx` explain the rationale for future maintainers.

---

## Deviations from Plan

None — plan executed exactly as written. All four tasks match the plan spec:
- Task 1: `CharityCard.tsx` — plan path `apps/web/components/charities/CharityCard.tsx`
- Task 2: `CharityDetail.tsx` — plan path `apps/web/components/charities/CharityDetail.tsx`
- Task 3: `/charities/page.tsx`
- Task 4: `/charities/[slug]/page.tsx`

Note: The plan frontmatter listed the component paths as `apps/web/components/charities/...` (matching the actual implementation) while the critical rules referred to `apps/web/components/charity/...` (singular). The plan frontmatter path was followed.

---

## Known Stubs

None. All fields render real Sanity data. Components gracefully omit null fields rather than rendering placeholder text.

---

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | f9ce3b1 | CharityCard component |
| 2 | 2a0e5c8 | CharityDetail component |
| 3 | b79f69a | /charities list page |
| 4 | 1747735 | /charities/[slug] detail page + NGO JSON-LD |

---

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| apps/web/components/charities/CharityCard.tsx | FOUND |
| apps/web/components/charities/CharityDetail.tsx | FOUND |
| apps/web/app/charities/page.tsx | FOUND |
| apps/web/app/charities/[slug]/page.tsx | FOUND |
| Commit f9ce3b1 (CharityCard) | FOUND |
| Commit 2a0e5c8 (CharityDetail) | FOUND |
| Commit b79f69a (/charities page) | FOUND |
| Commit 1747735 ([slug] page) | FOUND |
| pnpm --filter web typecheck | PASSED (exit 0) |
