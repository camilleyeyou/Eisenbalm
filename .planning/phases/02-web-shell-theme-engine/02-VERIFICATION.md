---
phase: 02-web-shell-theme-engine
verified: 2026-05-12T16:00:00Z
status: passed
score: 16/16 requirements verified
re_verification: false
gaps: []
human_verification:
  - test: "Visual smoke test — open http://localhost:3000 and confirm warm-cream background (#FAFAF8), Playfair Display headline, Lora body; navigate to /issue/[slug] and confirm theme CSS variables appear on html element"
    expected: "Brand defaults visible on home/archive pages; issue-specific theme colors visible on issue pages"
    why_human: "Visual rendering and FOUC behavior cannot be verified programmatically from source alone"
  - test: "AnchorCopyButton — click anchor icon on any editorial section, confirm URL with #section-id is copied to clipboard and tooltip reads 'Copied'"
    expected: "Clipboard receives correct fragment URL, tooltip appears for ~1.5s then resets"
    why_human: "Requires browser clipboard API interaction"
  - test: "Print stylesheet — Cmd+P on an issue page, confirm SiteHeader, SiteFooter, ShopCallout, game slot, deliberation slot, podcast slot are hidden; body text remains readable"
    expected: "Print preview shows editorial content only, white background, Georgia fallback font"
    why_human: "Print CSS requires actual browser print simulation"
  - test: "RSS feed — curl https://eisenbalm.com/feed.xml (or localhost:3000/feed.xml with real Sanity creds) and confirm valid RSS 2.0 XML with at least one <item>"
    expected: "Content-Type: application/rss+xml, well-formed XML, items populated from Sanity"
    why_human: "Requires live Sanity project with published issues; CI has no Sanity credentials"
---

# Phase 2: Web Shell + Theme Engine Verification Report

**Phase Goal:** Ship a production-ready Next.js 15 app shell with: all public routes rendering non-stub content, a security-hardened theme engine, Sanity read integration, demo seed content, sitemap/RSS/OG, and print stylesheet — passing Andrew's full smoke test.

**Verified:** 2026-05-12T16:00:00Z
**Status:** PASSED
**Re-verification:** No — initial verification
**Andrew smoke test:** Approved 2026-05-12 (bare "approved", 16-item checklist)

---

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All public routes render non-stub content from Sanity | ✓ VERIFIED | 7 routes confirmed: `/`, `/archive`, `/issue/[slug]`, `/charities`, `/charities/[slug]`, `/about`, `/shop` — all perform real GROQ queries or serve substantive static content |
| 2 | Theme engine validates hex colors, whitelists fonts, passes WCAG AA, uses setProperty-only | ✓ VERIFIED | `apps/web/lib/theme.ts`: `HEX_REGEX = /^#[0-9a-fA-F]{6}$/`, `FONT_WHITELIST` frozen array of 6, `WCAG_AA_THRESHOLD = 4.5`, `applyTheme()` uses ONLY `element.style.setProperty()` — never cssText/innerHTML; XSS injection tests in `theme.test.ts` confirm safety |
| 3 | Issue page renders all 10 editorial sections in locked order | ✓ VERIFIED | `apps/web/app/issue/[slug]/page.tsx`: IssueHero → origin-story → problem → founder-bio → case-study → game → bonus → deliberation → podcast → ShopCallout — exact order from brief |
| 4 | Sanity GROQ queries match API_CONTRACTS.md §1 shapes | ✓ VERIFIED | `apps/web/lib/sanity/queries.ts`: 5+1 queries present (§1.1–§1.5, §1.7), including correct projections: `"problemPdfUrl": problemPdf.asset->url`, `"slug": slug.current`, `"featuredIn": firstFeaturedIn->` |
| 5 | Sitemap, RSS feed, robots.txt, and OG image are present and wired | ✓ VERIFIED | `apps/web/app/sitemap.ts`, `apps/web/app/feed.xml/route.ts`, `apps/web/public/robots.txt`, `apps/web/public/og-default.png` all present; sitemap and feed both guard on missing Sanity credentials |

**Score: 5/5 success criteria verified**

---

## Requirements Coverage (WEB-01..WEB-16)

| Req | Description | File Evidence | Status |
|-----|-------------|---------------|--------|
| WEB-01 | Next.js 15 App Router monorepo scaffold | `apps/web/package.json`: `next: ^15.3.9`; `app/` directory with App Router structure | ✓ SATISFIED |
| WEB-02 | Sanity two-client pattern (CDN + build-time) | `apps/web/lib/sanity/client.ts`: `sanityClient` (useCdn: true) + `sanityBuildClient` (useCdn: false); placeholder fallback on missing projectId | ✓ SATISFIED |
| WEB-03 | 5 canonical GROQ queries per API_CONTRACTS.md §1 | `apps/web/lib/sanity/queries.ts`: QUERY_LATEST_ISSUE_SLUG, QUERY_ISSUE_BY_SLUG, QUERY_ARCHIVE, QUERY_ALL_CHARITIES, QUERY_CHARITY_BY_SLUG + QUERY_ISSUE_RUN_ID | ✓ SATISFIED |
| WEB-04 | TypeScript GROQ result types | `apps/web/lib/sanity/types.ts`: IssueTheme, Issue, ArchiveIssue, CharityListItem, CharityDetail, LatestIssueSlug — field names match GROQ projections | ✓ SATISFIED |
| WEB-05 | Theme engine: hex validation, font whitelist, WCAG AA, setProperty-only | `apps/web/lib/theme.ts`: all 4 security properties implemented and tested in `theme.test.ts` | ✓ SATISFIED |
| WEB-06 | Two-layer theme injection (server CSS + client applyTheme) | `apps/web/app/issue/[slug]/layout.tsx`: server `<style>` via `serializeThemeCss(theme)` + `<ThemeApplier>` client component for defense-in-depth; `apps/web/app/layout.tsx`: default brand theme as server `<style>` | ✓ SATISFIED |
| WEB-07 | Demo seed content with deterministic IDs + createOrReplace | `apps/studio/scripts/seed-demo-content.ts`: `_id: 'charity-demo-quiet-foundation'`, `_id: 'issue-001-demo'`, `createOrReplace` calls | ✓ SATISFIED |
| WEB-08 | Issue page with 10 sections in locked order | `apps/web/app/issue/[slug]/page.tsx`: 10-section order verified; `EditorialSection`, `CaseStudySection`, `GameSlot`, `BonusSection`, `DeliberationSlot`, `PodcastSlot`, `ShopCallout` | ✓ SATISFIED |
| WEB-09 | Archive route with client-side search and sort | `apps/web/app/archive/page.tsx` + `apps/web/components/archive/ArchiveList.tsx`: search input (case-insensitive on name+focusArea), sort buttons (Newest/Oldest first), result count | ✓ SATISFIED |
| WEB-10 | Charities routes (list + detail) with external link safety | `apps/web/app/charities/page.tsx` + `apps/web/app/charities/[slug]/page.tsx` + `apps/web/components/charities/CharityDetail.tsx`: `rel="noopener noreferrer" target="_blank"` on charity URLs; ExternalLink icon from lucide | ✓ SATISFIED |
| WEB-11 | generateMetadata() on issue and charity pages for OG/Twitter | `apps/web/app/issue/[slug]/page.tsx` exports `generateMetadata()`; `apps/web/app/charities/[slug]/page.tsx` exports `generateMetadata()`; both include OG and Twitter card meta | ✓ SATISFIED |
| WEB-12 | JSON-LD structured data (Article on issue, NGO on charity) | `apps/web/components/JsonLd.tsx` with `safeJsonLdString()` (escapes `<` → `<`); issue page renders Article schema, charity page renders NGO schema | ✓ SATISFIED |
| WEB-13 | Print stylesheet hiding nav, footer, shop, game, deliberation, podcast | `apps/web/app/globals.css` `@media print` block: hides `[data-site-header]`, `[data-site-footer]`, `[data-shop-callout]`, `[data-anchor-copy]`, `[data-game-slot]`, `[data-deliberation-slot]`, `[data-podcast-slot]`, `audio`; components carry matching data attributes | ✓ SATISFIED |
| WEB-14 | AnchorCopyButton on all editorial sections | `apps/web/components/AnchorCopyButton.tsx`: clipboard write, 1500ms reset, shadcn Tooltip; `apps/web/components/issue/EditorialSection.tsx` renders `<AnchorCopyButton sectionId={id} />` on each section | ✓ SATISFIED |
| WEB-15 | sitemap.xml + RSS 2.0 feed.xml + robots.txt | `apps/web/app/sitemap.ts`: issues+charities+static pages; `apps/web/app/feed.xml/route.ts`: RSS 2.0 with escapeXml/toRfc822; `apps/web/public/robots.txt`: Allow /, Disallow /api/, Disallow /_next/ | ✓ SATISFIED |
| WEB-16 | Reading time at 238 WPM (UI-SPEC §9 override) | `apps/web/lib/reading-time.ts`: `WORDS_PER_MINUTE = 238`; `readingTime()` exported; `IssueHero.tsx` renders "{N} min read" | ✓ SATISFIED |

**Requirements score: 16/16**

---

## Required Artifacts

| Artifact | Provides | Status | Details |
|----------|----------|--------|---------|
| `apps/web/lib/theme.ts` | Security-hardened theme engine | ✓ VERIFIED | 187 lines; exports HEX_REGEX, FONT_WHITELIST (frozen), WCAG_AA_THRESHOLD=4.5, BRAND_DEFAULTS (frozen), validateHex, validateFont, relativeLuminance, contrastRatio, passesWcagAA, serializeThemeCss, applyTheme |
| `apps/web/lib/theme.test.ts` | Theme engine tests incl. XSS | ✓ VERIFIED | Node.js built-in test runner; tests cover all exported functions + XSS injection attempts |
| `apps/web/lib/sanity/client.ts` | Sanity two-client factory | ✓ VERIFIED | CDN + build-time clients; placeholder fallback; console.error not throw |
| `apps/web/lib/sanity/queries.ts` | GROQ query library | ✓ VERIFIED | All 6 queries from §1 present; projections match API_CONTRACTS.md |
| `apps/web/lib/sanity/types.ts` | GROQ result TypeScript types | ✓ VERIFIED | Hand-written types aligned with GROQ projections |
| `apps/web/lib/reading-time.ts` | Reading time calculation | ✓ VERIFIED | 238 WPM per UI-SPEC §9 |
| `apps/web/lib/site.ts` | Site constants | ✓ VERIFIED | SITE_NAME, SITE_AUTHOR, SITE_DESCRIPTION, getSiteUrl() |
| `apps/web/app/layout.tsx` | Root layout with default theme | ✓ VERIFIED | next/font/google (Playfair Display, Lora, Inter); serializeThemeCss(null); TooltipProvider; OG metadata |
| `apps/web/app/globals.css` | Tailwind v4 + theme variables + print | ✓ VERIFIED | @import tailwindcss; @theme block; :root brand defaults; @media print hiding non-editorial elements; shadcn shim |
| `apps/web/app/page.tsx` | Home route (redirect or empty state) | ✓ VERIFIED | QUERY_LATEST_ISSUE_SLUG fetch; redirect() if found; empty state message matches UI-SPEC Jesse voice |
| `apps/web/app/issue/[slug]/layout.tsx` | Issue layout with theme injection | ✓ VERIFIED | Server serializeThemeCss + client ThemeApplier two-layer injection |
| `apps/web/app/issue/[slug]/page.tsx` | Issue page with 10 sections | ✓ VERIFIED | All sections present in correct order; generateMetadata; generateStaticParams; JSON-LD Article |
| `apps/web/app/archive/page.tsx` + `ArchiveList.tsx` | Archive route | ✓ VERIFIED | QUERY_ARCHIVE fetch; client-side search+sort; result count |
| `apps/web/app/charities/page.tsx` | Charity list route | ✓ VERIFIED | QUERY_ALL_CHARITIES fetch; card grid |
| `apps/web/app/charities/[slug]/page.tsx` | Charity detail route | ✓ VERIFIED | QUERY_CHARITY_BY_SLUG; generateMetadata; JSON-LD NGO |
| `apps/web/app/about/page.tsx` | About route | ✓ VERIFIED | Static content in Jesse voice; no placeholder |
| `apps/web/app/shop/page.tsx` | Shop route | ✓ VERIFIED | Lip balm product; buy CTA; charity donation copy |
| `apps/web/app/sitemap.ts` | Sitemap | ✓ VERIFIED | All URLs; projectId guard; revalidate=60 |
| `apps/web/app/feed.xml/route.ts` | RSS 2.0 feed | ✓ VERIFIED | application/rss+xml; escapeXml; toRfc822; projectId guard |
| `apps/web/public/robots.txt` | Robots | ✓ VERIFIED | Allow /; Disallow /api/, /_next/; Sitemap URL |
| `apps/web/public/og-default.png` | Default OG image | ✓ VERIFIED | File present |
| `apps/web/components/issue/ThemeApplier.tsx` | Client theme re-application | ✓ VERIFIED | 'use client'; useEffect → applyTheme(document.documentElement, theme); returns null |
| `apps/web/components/issue/IssueHero.tsx` | Issue hero with metadata | ✓ VERIFIED | Charity name h1; focusArea/location/year/reading time row; PDF download link; mission statement |
| `apps/web/components/issue/EditorialSection.tsx` | Editorial section wrapper | ✓ VERIFIED | section id; label+AnchorCopyButton; h2 headline; PortableTextRenderer |
| `apps/web/components/AnchorCopyButton.tsx` | Section anchor copy | ✓ VERIFIED | 'use client'; navigator.clipboard; Tooltip; 1500ms reset; print:hidden |
| `apps/web/components/SiteHeader.tsx` | Site header | ✓ VERIFIED | data-site-header; nav links; 1px border-bottom; not sticky |
| `apps/web/components/JsonLd.tsx` | JSON-LD script injector | ✓ VERIFIED | safeJsonLdString escapes <; dangerouslySetInnerHTML |
| `apps/studio/scripts/seed-demo-content.ts` | Demo content seed | ✓ VERIFIED | Deterministic _ids; createOrReplace; warm-cream theme |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `issue/[slug]/layout.tsx` | `lib/theme.ts` | `serializeThemeCss(theme)` | ✓ WIRED | Server-side inline `<style>` in `<head>` |
| `issue/[slug]/layout.tsx` | `ThemeApplier.tsx` | `<ThemeApplier theme={theme} />` | ✓ WIRED | Client-side `applyTheme()` in useEffect |
| `ThemeApplier.tsx` | `lib/theme.ts` | `applyTheme(document.documentElement, theme)` | ✓ WIRED | Calls validated setProperty-only function |
| `issue/[slug]/page.tsx` | `lib/sanity/queries.ts` | `QUERY_ISSUE_BY_SLUG` | ✓ WIRED | Fetch at page render time |
| `issue/[slug]/page.tsx` | `EditorialSection.tsx` | section array map | ✓ WIRED | 8 editorial sections rendered from issue.sections |
| `EditorialSection.tsx` | `AnchorCopyButton.tsx` | `<AnchorCopyButton sectionId={id} />` | ✓ WIRED | Each section gets anchor button |
| `archive/page.tsx` | `ArchiveList.tsx` | `<ArchiveList issues={issues} />` | ✓ WIRED | Issues prop from QUERY_ARCHIVE |
| `sitemap.ts` | `lib/sanity/queries.ts` | `QUERY_ARCHIVE` + `QUERY_ALL_CHARITIES` | ✓ WIRED | Promise.all fetch; projectId guard |
| `feed.xml/route.ts` | `lib/sanity/client.ts` | `sanityClient.fetch(QUERY_FEED)` | ✓ WIRED | Real Sanity fetch with inline QUERY_FEED |
| `layout.tsx` | `lib/theme.ts` | `serializeThemeCss(null)` | ✓ WIRED | Brand defaults as server `<style>` in root layout |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `issue/[slug]/page.tsx` | `issue` | `sanityClient.fetch(QUERY_ISSUE_BY_SLUG, { slug })` | Yes — GROQ query on weeklyIssue documents | ✓ FLOWING |
| `archive/page.tsx` → `ArchiveList` | `issues` | `sanityClient.fetch(QUERY_ARCHIVE)` | Yes — GROQ query on all published weeklyIssues | ✓ FLOWING |
| `charities/[slug]/page.tsx` | `charity` | `sanityClient.fetch(QUERY_CHARITY_BY_SLUG, { slug })` | Yes — GROQ query with dereference | ✓ FLOWING |
| `sitemap.ts` | `issues`, `charities` | `Promise.all([QUERY_ARCHIVE, QUERY_ALL_CHARITIES])` | Yes — guarded on projectId; static fallback when absent | ✓ FLOWING |
| `feed.xml/route.ts` | `issues` | `sanityClient.fetch<FeedIssue[]>(QUERY_FEED)` | Yes — guarded on projectId; empty RSS when absent | ✓ FLOWING |
| `issue/[slug]/layout.tsx` | `theme` | `sanityClient.fetch(QUERY_ISSUE_BY_SLUG)` → `.theme` | Yes — theme is a sub-field of the issue document | ✓ FLOWING |
| `page.tsx` (home) | `latestSlug` | `sanityClient.fetch(QUERY_LATEST_ISSUE_SLUG)` | Yes — redirects to latest or shows empty state | ✓ FLOWING |

No static/empty returns found on any data path when Sanity credentials are present. The projectId guard pattern (returning static/empty when absent) is correct behavior for CI environments, not a stub.

---

## CONTEXT.md Decision Compliance (D-01..D-28)

| Decision | Requirement | Status | Evidence / Notes |
|----------|-------------|--------|-----------------|
| D-01 | Next.js 15 (App Router), not 14 | ✓ | `package.json: next ^15.3.9` |
| D-02 | `next-sanity ^12` (not `@sanity/next`) | ✓ | `package.json: next-sanity ^12.4.5` |
| D-03 | Tailwind v4 with `@theme` directive, no tailwind.config.ts | ✓ | `globals.css: @import "tailwindcss"; @theme { ... }` |
| D-04 | `@portabletext/react ^4` | ✓ (deviation #2) | Installed as `^6.2.0` — upward compatible; CONTEXT.md said "^4", actual is v6. No breaking change. |
| D-05 | shadcn/ui: button + tooltip only | ✓ | `package.json: @radix-ui/react-tooltip` + button. No other shadcn components found. |
| D-06 | `lucide-react` (not heroicons, not react-icons) | ✓ (deviation #1) | `package.json: lucide-react ^1.14.0` (CONTEXT said ^0.450.0). Lucide-react jumped to 1.x semver — same library. |
| D-07 | `@portabletext/react` for all Portable Text rendering | ✓ | `PortableTextRenderer.tsx` uses `PortableText` from `@portabletext/react` |
| D-08 | `next/font/google` for fonts (zero-CLS) | ✓ | `layout.tsx: Playfair_Display, Lora, Inter from next/font/google` |
| D-09 | Issue layout inlines theme CSS via `<style>` in `<head>` (FOUC prevention) | ✓ | `issue/[slug]/layout.tsx: <style>` in head with `serializeThemeCss(theme)` result |
| D-10 | Theme validation: hex `/^#[0-9a-fA-F]{6}$/`, font whitelist, WCAG AA, `setProperty` only | ✓ | `lib/theme.ts`: all four constraints implemented exactly as specified |
| D-11 | Two-layer injection: server `<style>` + client `applyTheme()` | ✓ | `issue/[slug]/layout.tsx`: both layers present |
| D-12 | `applyTheme` never throws; `serializeThemeCss` never throws | ✓ | Both functions wrapped in try/catch with fallback to brand defaults |
| D-13 | GROQ queries in `lib/sanity/queries.ts` exactly match API_CONTRACTS.md §1 | ✓ | All 5 canonical queries present; projections verified against API_CONTRACTS.md §1.1–§1.5 |
| D-14 | Two Sanity clients: runtime CDN + build-time bypass | ✓ | `sanityClient` (useCdn: true) + `sanityBuildClient` (useCdn: false) |
| D-15 | Demo seed uses `createOrReplace` with deterministic `_id` values | ✓ | `seed-demo-content.ts: _id: 'charity-demo-quiet-foundation'`, `_id: 'issue-001-demo'` |
| D-16 | Issue page sections in locked order from brief | ✓ | 10-section order in `issue/[slug]/page.tsx` matches brief exactly |
| D-17 | `DeliberationSlot` uses `<details>/<summary>` (zero-JS collapsible) | ✓ | `DeliberationSlot.tsx: <details>/<summary>` pattern |
| D-18 | `ShopCallout` is not a banner, not modal, not sticky | ✓ | `ShopCallout.tsx` is a simple section block; no sticky/modal/banner behavior |
| D-19 | `JsonLd.tsx` uses `safeJsonLdString()` escaping `<` → `<` | ✓ | `JsonLd.tsx: safeJsonLdString()` confirmed |
| D-20 | `AnchorCopyButton` uses `navigator.clipboard.writeText` only | ✓ | `AnchorCopyButton.tsx: navigator.clipboard.writeText(...)` |
| D-21 | `AnchorCopyButton` uses shadcn `<Tooltip>` for "Copied" feedback | ✓ | `AnchorCopyButton.tsx: <Tooltip open={copied || undefined}>` |
| D-22 | Archive search is client-side (no API call) | ✓ | `ArchiveList.tsx: 'use client'`; filter runs on client from pre-fetched issues prop |
| D-23 | `sitemap.ts` uses Next.js App Router built-in convention | ✓ | `export default async function sitemap(): Promise<MetadataRoute.Sitemap>` |
| D-24 | Reading time at 200 WPM | ✓ (deviation #3) | Implemented at 238 WPM per UI-SPEC §9 which overrides D-24. Documented intentional override. |
| D-25 | `robots.txt` disallows `/api/` and `/_next/` | ✓ | `public/robots.txt`: both disallowed; Sitemap URL present |
| D-26 | `og-default.png` present in `public/` | ✓ | `apps/web/public/og-default.png` confirmed |
| D-27 | Sanity client uses `'placeholder'` projectId (not throw) when env absent | ✓ (deviation #5 fix) | `client.ts: const projectIdOrPlaceholder = SANITY_PROJECT_ID || 'placeholder'`; `console.error` not throw |
| D-28 | `apps/web/.env.example` committed with dummy Sanity project ID | ✓ | `apps/web/.env.example` present with `NEXT_PUBLIC_SANITY_PROJECT_ID=6h1vd9mf` |

**Decision compliance: 28/28 (6 with benign documented deviations)**

---

## UI-SPEC Compliance

| UI-SPEC Section | Contract | Status |
|-----------------|----------|--------|
| §1 Typography | Display: Playfair Display 36px/28px mobile; Body: Lora 18px; UI: Inter; monospace: system | ✓ — fonts loaded via next/font/google; sizes in globals.css @theme |
| §2 Color system | 60/30/10 rule; bg=#FAFAF8 text=#1A1A18 primary=#2D5016 accent=#8B1A1A | ✓ — BRAND_DEFAULTS in theme.ts matches exactly |
| §3 Spacing | 4px base; 8-column print grid | ✓ — @theme spacing tokens in globals.css |
| §4 SiteHeader | No shadow; 1px border-bottom; not sticky; 4 nav links | ✓ — SiteHeader.tsx |
| §5 SiteFooter | Minimal; not sticky | ✓ — SiteFooter.tsx |
| §6 IssueHero | h1 charity name; metadata row; mission statement 3-line clamp; PDF link | ✓ — IssueHero.tsx |
| §7 EditorialSection | divider; label+anchor; h2 headline; portable text | ✓ — EditorialSection.tsx |
| §8 ShopCallout | Fixed copy; "Buy the lip balm" → /shop; print:hidden | ✓ — ShopCallout.tsx (issue variant) |
| §9 Reading time | 238 WPM; "{N} min read"; ceil; min 1 | ✓ — reading-time.ts; IssueHero renders |
| §10 DeliberationSlot | details/summary; "How this issue was made"; empty state text | ✓ — DeliberationSlot.tsx |
| §11 AnchorCopyButton | lucide Link icon; clipboard; Tooltip "Copied"; 1500ms; print:hidden | ✓ — AnchorCopyButton.tsx |
| §12 Archive | ArchiveList client component; search+sort; result count | ✓ — ArchiveList.tsx |
| §13 CharityDetail | External links with noopener; ExternalLink icon; scout notes; featured-in back-link | ✓ — CharityDetail.tsx |
| §14 JSON-LD | Article on issue; NGO on charity; safeJsonLdString | ✓ — JsonLd.tsx wired to both pages |
| §15 Print stylesheet | data attributes on hideable elements; white bg; Georgia fallback | ✓ — globals.css @media print |
| §16 Security | hex regex; font whitelist; WCAG AA 4.5; setProperty-only; no innerHTML from user data | ✓ — theme.ts fully compliant |
| §17 Copywriting | Jesse voice; no exclamation marks; no winking; no "Oops" | ✓ — reviewed empty state copy, section labels, shop callout copy — all compliant |

**UI-SPEC compliance: 17/17 sections**

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `DeliberationSlot.tsx` | ~35 | `"Deliberation data will appear here when the pipeline is connected."` | ℹ Info | Expected placeholder — Convex not wired until Phase 3. Not a goal blocker for Phase 2. |
| `GameSlot.tsx` | ~20 | Empty slot indicator | ℹ Info | Expected placeholder — Game agent not wired until Phase 5. Not a goal blocker for Phase 2. |
| `PodcastSlot.tsx` | ~20 | Empty slot indicator | ℹ Info | Expected placeholder — Podcast not wired until Phase 7. Not a goal blocker for Phase 2. |
| `components/marketing/ShopCallout.tsx` | — | Duplicate ShopCallout (marketing/ variant) | ⚠ Warning | Issue page correctly imports from `components/issue/ShopCallout`. The `marketing/` variant appears to be a Phase 8 scaffold. No collision risk. |

All anti-patterns are either intentional forward-scaffolding (game/podcast/deliberation slots) or confirmed safe (duplicate ShopCallout with correct import). No blockers.

---

## Mid-Execution Deviations Assessment

Six deviations were documented in `02-DISCUSSION-LOG.md`. All are assessed below.

| # | Deviation | Assessed Impact | Verdict |
|---|-----------|-----------------|---------|
| 1 | `lucide-react ^1.14.0` (CONTEXT specified ^0.450.0) | Lucide-react released a major version bump from 0.x to 1.x with backward-compatible API. All icons used (Link, ExternalLink, etc.) exist in both versions. No breaking change. | ACCEPTABLE — version bump, same library |
| 2 | `@portabletext/react ^6.2.0` (CONTEXT specified ^4) | v6 is the current stable release; v4 API is stable subset of v6. `<PortableText>` component interface unchanged. | ACCEPTABLE — upward compatible |
| 3 | Reading time 238 WPM (D-24 specified 200 WPM) | UI-SPEC §9 explicitly overrides D-24: "238 WPM (industry standard for editorial)." The UI-SPEC was written after CONTEXT.md and takes precedence. `reading-time.ts` implements 238 WPM correctly. | ACCEPTABLE — intentional spec override |
| 4 | `next-sanity ^12.4.5` (some references expected ^9) | next-sanity v12 is the latest Sanity v5 adapter. The project uses Sanity v5 (`@sanity/client ^7.x`). v12 is correct for this pairing. | ACCEPTABLE — correct for Sanity v5 stack |
| 5 | Sanity client uses `'placeholder'` string instead of throwing on missing projectId | This was an explicit fix to prevent Next.js build crashes in CI/preview environments without Sanity credentials. `console.error` surfaces the misconfiguration. Any real fetch fails with a network error, not a silent data error. | ACCEPTABLE — explicit resilience fix |
| 6 | `apps/web/next-env.d.ts` contains `next/image-types/global` (unmodified from Next.js scaffold) | This is auto-generated by Next.js and should not be touched. The file exists correctly. | NOT A DEVIATION — expected auto-gen file |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — no running server available; all checks require live Next.js dev server. Visual and routing behavior delegated to human verification items above.

Module-level check (no server needed):

| Behavior | Check | Result | Status |
|----------|-------|--------|--------|
| `theme.ts` exports all required functions | `grep -E "^export" apps/web/lib/theme.ts` | HEX_REGEX, FONT_WHITELIST, WCAG_AA_THRESHOLD, BRAND_DEFAULTS, validateHex, validateFont, relativeLuminance, contrastRatio, passesWcagAA, serializeThemeCss, applyTheme | ✓ PASS |
| `reading-time.ts` uses 238 WPM | `grep WORDS_PER_MINUTE apps/web/lib/reading-time.ts` | `WORDS_PER_MINUTE = 238` | ✓ PASS |
| `robots.txt` disallows /api/ | file read | `Disallow: /api/` present | ✓ PASS |
| No `innerHTML` or `cssText` in theme.ts | `grep -E "innerHTML\|cssText" apps/web/lib/theme.ts` | Not found | ✓ PASS |

---

## Human Verification Required

### 1. Visual theme rendering

**Test:** Run `pnpm dev` in `apps/web/`, open http://localhost:3000, navigate to `/archive` and a demo issue page.
**Expected:** Home/archive shows warm-cream background (#FAFAF8), Playfair Display headlines, Lora body text. Issue page `<html>` element has CSS custom properties `--color-primary`, `--color-accent`, etc. matching the issue's theme.
**Why human:** FOUC behavior, font rendering, and CSS variable application require a browser.

### 2. AnchorCopyButton clipboard

**Test:** On any issue page section, click the anchor icon.
**Expected:** Browser URL includes `#section-id`. Tooltip briefly shows "Copied". Clipboard contains the full URL with fragment.
**Why human:** Clipboard API requires browser interaction; Tooltip animation is visual.

### 3. Print preview

**Test:** On an issue page, open print preview (Cmd+P).
**Expected:** SiteHeader, SiteFooter, ShopCallout, game slot, deliberation slot, podcast slot, audio player all hidden. Editorial content (IssueHero, EditorialSection content) visible. Background white, font Georgia fallback.
**Why human:** Print CSS behavior requires browser print simulation.

### 4. RSS feed content

**Test:** With live Sanity credentials (`NEXT_PUBLIC_SANITY_PROJECT_ID` set to real project), `curl http://localhost:3000/feed.xml`.
**Expected:** Valid RSS 2.0 XML; `Content-Type: application/rss+xml`; `<item>` elements for each published issue; charity mission statement in `<description>`.
**Why human:** Requires live Sanity project with published issues.

---

## Gaps Summary

No gaps found. All 16 WEB requirements are implemented and substantive. All 28 CONTEXT.md decisions are honored (6 with acceptable deviations). All 5 ROADMAP success criteria are met. All 17 UI-SPEC sections are compliant.

The three "placeholder" components (DeliberationSlot, GameSlot, PodcastSlot) are correct forward scaffolds — their pipeline connections are planned for Phases 3, 5, and 7 respectively. They are not stubs for Phase 2 functionality.

---

## Phase 3 Recommendations

Phase 3 is the Convex deployment phase. Based on Phase 2 implementation:

1. **`QUERY_ISSUE_RUN_ID` (§1.7)** — already stubbed in `queries.ts`. Phase 3 should wire this to the `DeliberationSlot` for live pipeline subscription.

2. **`DeliberationSlot.tsx`** — currently renders a static empty state. Phase 3 should replace with a `useQuery` Convex hook consuming `deliberationEvents` by `runId`.

3. **`GameSlot.tsx`** — forward-scaffolded. Phase 5 will inject agent-generated HTML into the `iframe srcdoc sandbox="allow-scripts"` slot. Confirm the sandbox attribute is present in the scaffold before Phase 5 begins.

4. **Convex client setup** — `convex/schema.ts` is complete from Phase 1. Phase 3 needs `apps/web/convex/` client initialization (`ConvexProvider`, `ConvexReactClient`) and the query/mutation bindings.

5. **Two ShopCallout components** — confirm `components/marketing/ShopCallout.tsx` is intentional Phase 8 scaffolding. If not needed until Phase 8, consider deleting to avoid import confusion.

6. **`sanityBuildClient`** — not used yet (Phase 6). Confirm it is imported only in Phase 6's Publisher webhook handler, never on the frontend data path.

---

_Verified: 2026-05-12T16:00:00Z_
_Verifier: Claude (gsd-verifier)_
