# apps/web — Next.js reader frontend

**Status:** Phase 2 complete. The reader-facing magazine.
**Stack:** Next.js 15.5.x (App Router) · React 19 · Tailwind v4 · next-sanity 12.4.5 · @portabletext/react v6.
**Reads from:** Sanity project `6h1vd9mf`, dataset `production` (wired in Phase 1).
**Writes:** none — `apps/web` is read-only at runtime.

---

## Routes

| Route | Source | Notes |
|---|---|---|
| `/` | `QUERY_LATEST_ISSUE_SLUG` → redirect | 307 to `/issue/{slug}` when an issue is published. Shows a Jesse-voice empty state otherwise. |
| `/issue/[slug]` | `QUERY_ISSUE_BY_SLUG` | 10 sections in locked order. Per-issue theme injected via validated CSS variables (two-layer: server + client). |
| `/archive` | `QUERY_ARCHIVE` | Client-side search (charity name / focus area) + newest/oldest sort. No external search lib. |
| `/charities` | `QUERY_ALL_CHARITIES` | Alphabetical list. Filtering deferred to v2. |
| `/charities/[slug]` | `QUERY_CHARITY_BY_SLUG` | `schema.org/NGO` JSON-LD. External links carry `rel="noopener noreferrer"`. |
| `/about` | static | Placeholder copy until Andrew supplies the real content. |
| `/shop` | inline GROQ | Phase 2 shell. Phase 8 wires Stripe Checkout. |
| `/sitemap.xml` | `app/sitemap.ts` | Static pages + all published issues + all charities. ISR 60s. |
| `/feed.xml` | `app/feed.xml/route.ts` | RSS 2.0. Item description is the charity mission statement (no full body — site is a destination). |
| `/robots.txt` | `public/robots.txt` | Allows `/`. Disallows `/api/` and `/_next/`. |

---

## Prerequisites

- Node `>=18.18.0`
- pnpm `9.x` (matches the root `package.json` workspace config)
- A live Sanity project. Phase 1 provisioned project `6h1vd9mf`.
- Optional: a write-scoped `SANITY_API_TOKEN` in `apps/studio/.env.local` if you want to seed demo content (see below).

---

## Setup

From the **repo root**:

```bash
# 1. Install all workspace dependencies.
pnpm install

# 2. Copy the env template and fill in the values.
cp apps/web/.env.example apps/web/.env.local
# The defaults in .env.example are correct for the production dataset.
# Edit NEXT_PUBLIC_SITE_URL to match your local or deployed URL.

# 3. (Optional) Seed demo content so /issue/issue-1 renders real data.
#    Requires apps/studio/.env.local with a valid SANITY_API_TOKEN.
pnpm seed:demo

# 4. Start the dev server.
pnpm dev:web
# → http://localhost:3000
```

The demo seed creates one charity (`The Quiet Foundation`) and one published issue (`issue-1`).
It is idempotent — running `pnpm seed:demo` a second time produces identical documents without duplicating anything.

---

## Environment variables

Defined in `apps/web/.env.example` (committed) and `apps/web/.env.local` (gitignored).

| Variable | Required | Default | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | yes | `6h1vd9mf` | Sanity project ID. Public dataset — safe to expose. |
| `NEXT_PUBLIC_SANITY_DATASET` | yes | `production` | Dataset name. |
| `NEXT_PUBLIC_SITE_URL` | yes | `http://localhost:3000` | Base URL for sitemap.xml, feed.xml, JSON-LD canonical, and OG images. Set to `https://eisenbalm.com` (or your chosen domain) in Vercel. |

No write token is needed for the web app at runtime. Phase 8 adds Stripe env vars to this list.

---

## Scripts

All scripts are exposed from the repo root via `pnpm <name>`:

| Script | Effect |
|---|---|
| `pnpm dev:web` | `next dev` on port 3000 |
| `pnpm build:web` | Production build (`next build`) |
| `pnpm lint:web` | `next lint` |
| `pnpm typecheck:web` | `tsc --noEmit` |
| `pnpm seed:demo` | Idempotent demo charity + issue seed (runs against `apps/studio`) |
| `pnpm typegen` | Regenerate `apps/studio/sanity.types.ts` from schemas (Phase 1, run when schemas change) |

---

## Architecture notes

### Sanity reader

All GROQ queries live at [`apps/web/lib/sanity/queries.ts`](./lib/sanity/queries.ts). They are byte-for-byte aligned with `docs/API_CONTRACTS.md §1`. Do not modify field names without updating both files together.

Two clients in [`apps/web/lib/sanity/client.ts`](./lib/sanity/client.ts):

- `sanityClient` — `useCdn: true`. Runtime reads. Hits the Sanity CDN (fast, cached).
- `sanityBuildClient` — `useCdn: false`. Build-time and Publisher webhook contexts (Phase 6 dependency). Reads fresh content without CDN lag.

Types are imported from `@eisenbalm/shared` (re-exports `apps/studio/sanity.types.ts`). Never import types directly from `apps/studio`.

### Theme engine (security-critical)

[`apps/web/lib/theme.ts`](./lib/theme.ts) is the single point where Sanity-supplied colors and fonts become CSS variables. Every value passes a strict hex regex (`/^#[0-9a-fA-F]{6}$/`) and a font whitelist before injection. Low-contrast pairs (WCAG AA body text < 4.5:1) fall back to the brand defaults for both background and text.

Theme injection runs in two layers per CONTEXT.md D-10/D-11:

- **Server layer (FOUC prevention):** `serializeThemeCss(theme)` produces an inline `<style>` block rendered in `app/issue/[slug]/layout.tsx` before the first paint. This is the only place theme CSS is serialized as a string — it uses `Array.join` to build the `:root { ... }` block, never template literals.
- **Client layer (defense-in-depth):** `<ThemeApplier theme={theme}>` runs `applyTheme(document.documentElement, theme)` inside `useEffect` on hydration. `applyTheme` uses `element.style.setProperty()` exclusively — never `cssText`, never `innerHTML`, never template-literal CSS strings.

Brand fallback palette (used when theme is missing or fails validation):

| Variable | Value | Notes |
|---|---|---|
| `--color-bg` | `#FAFAF8` | Off-white, warm editorial background |
| `--color-text` | `#1A1A18` | Near-black, contrast >15:1 on brand bg |
| `--color-primary` | `#2D5016` | Forest green |
| `--color-accent` | `#8B1A1A` | Deep crimson |

Font whitelist (Phase 2): Playfair Display, Lora, Inter, Cormorant Garamond, Merriweather, DM Serif Display. Phase 5 (DesignAgent) extends this list after Andrew approves additional fonts. Adding a font requires one line in `lib/theme.ts` — no other code change.

Unit tests for the theme engine: [`apps/web/lib/theme.test.ts`](./lib/theme.test.ts) (54 tests).
Run: `apps/studio/node_modules/.bin/tsx --test apps/web/lib/theme.test.ts` (tsx is workspace-resolvable; no extra dep needed in `apps/web`).

### Issue route

`/issue/[slug]` renders 10 sections in locked order (per `docs/CLAUDE_CODE_BRIEF.md`):

1. Hero (charity name, reading time, issue label, PDF download link)
2. Origin Story
3. Problem
4. Founder Bio
5. Case Study
6. Game (Phase 7 wires the iframe content; Phase 2 shows a placeholder)
7. Bonus (branches on `bonusType`: big-budget storyboard, jingle, or spec-ad)
8. Deliberation (Phase 9 wires Convex live data; Phase 2 shows an empty `<details>` accordion)
9. Podcast (Phase 9 wires audio; Phase 2 shows "Audio coming soon." when `sunoAudioUrl` is empty)
10. Shop callout (one sentence + "Buy the lip balm" button; Phase 8 wires Stripe href)

The game iframe uses `sandbox="allow-scripts"` and never `allow-same-origin`. This attribute is set correctly in Phase 2 so Phase 7's validator has the right foundation.

### Portable Text rendering

`@portabletext/react` v6 renders all body copy fields. Component map lives at [`apps/web/components/issue/PortableTextRenderer.tsx`](./components/issue/PortableTextRenderer.tsx). Heading scale: h2/h3 use the display font with primary color. Paragraphs use body font at 18px/1.65 line height. No decorative paragraph styling that would break the dry register.

### Anchor copy buttons

Each issue section has an `id` attribute (e.g., `<section id="origin-story">`). `<AnchorCopyButton>` is a client component that copies `window.location.origin + pathname + '#' + sectionId` to clipboard via `navigator.clipboard.writeText`. A shadcn `<Tooltip>` shows "Copied" for 1500ms. Renders with `data-anchor-copy` for print hiding.

### Reading time

Computed from concatenated Portable Text body fields (origin story + problem + founder bio + case study + bonus body). Rate: 238 WPM (UI-SPEC). Rounded up to nearest minute. Returns 0 for empty content. Helper: [`apps/web/lib/reading-time.ts`](./lib/reading-time.ts).

### SEO and structured data

- `generateMetadata()` per page emits OG + Twitter card tags.
- `<JsonLd>` server component emits `<script type="application/ld+json">`. Issue pages use `schema.org/Article` (headline, datePublished, author = "Jesse A. Eisenbalm", about = NGO). Charity pages use `schema.org/NGO`.
- `JsonLd` escapes `<` as `<` to prevent script-tag breakout from Sanity content.
- Static fallback OG image: `apps/web/public/og-default.png` (1200x630, brand background `#FAFAF8`). Andrew replaces this with real brand artwork before launch.

### Print stylesheet

Defined in [`apps/web/app/globals.css`](./app/globals.css) under `@media print`. Hides site chrome, anchor buttons, game/deliberation/podcast slots, and shop callout via `data-*` attribute selectors. Forces black-on-white 12pt Georgia serif output. All editorial copy is preserved.

Components that must carry their print-hide attribute:

| Component | Attribute |
|---|---|
| SiteHeader | `data-site-header` |
| SiteFooter | `data-site-footer` |
| ShopCallout | `data-shop-callout` |
| AnchorCopyButton | `data-anchor-copy` |
| GameSlot | `data-game-slot` |
| DeliberationSlot | `data-deliberation-slot` |
| PodcastSlot | `data-podcast-slot` |

### Tailwind v4 and shadcn

Tailwind v4 uses the `@theme` CSS-variable directive. There is no `tailwind.config.ts`. shadcn primitives: `button` and `tooltip` only (hand-written per v2 API — the CLI is fully interactive and unsuitable for automation). Editorial surfaces are all custom components; shadcn is only on the shop callout.

---

## What is not in Phase 2

The following land in later phases:

| Feature | Phase |
|---|---|
| Stripe / checkout / `/shop/thank-you` | Phase 8 |
| Convex deliberation live subscriptions | Phase 9 |
| Game iframe validator + real game content | Phase 7 |
| Real podcast player | Phase 9 |
| LangGraph pipeline | Phase 4 |
| WeasyPrint PDF generation | Phase 6 |
| Per-issue dynamic OG image | v2 (deferred) |
| Sanity Studio Presentation / preview mode | v2 (deferred) |
| Vercel project provisioning | Manual (Andrew, see below) |

---

## Deploying to Vercel

Phase 2 ships the code. Provisioning is Andrew's manual step (CONTEXT.md D-27).

```bash
# From apps/web/ (not the repo root):
cd apps/web
npx vercel link        # Link this workspace to a Vercel project (one-time setup)
npx vercel             # Deploy a preview
npx vercel --prod      # Deploy to production
```

Set these env vars in the Vercel project dashboard (or via `vercel env add`):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | `6h1vd9mf` |
| `NEXT_PUBLIC_SANITY_DATASET` | `production` |
| `NEXT_PUBLIC_SITE_URL` | `https://eisenbalm.com` (or your domain) |

No write token needed on the web side. Phase 8 adds Stripe variables to this list.

---

## Troubleshooting

**`Module not found: @sanity/client` or other workspace package after install.**
Run `pnpm install` from the **repo root**, not from `apps/web/`. Monorepo workspaces require the root install to resolve cross-package dependencies.

**Theme CSS variables are not applying on `/issue/[slug]`.**
View page source and find the inline `<style>:root { --color-bg: ...; ... }</style>` block in `<head>`. If it is there but shows brand defaults instead of the issue theme, the Sanity document's `theme.*Color` fields contain a value that failed hex validation (e.g., a named color instead of a 6-digit hex). The server console will log a `[theme]` warning. The client-side `<ThemeApplier>` also logs this warning via `applyTheme`.

**`/sitemap.xml` returns 500 or is empty.**
Check that `NEXT_PUBLIC_SANITY_PROJECT_ID` is set in `apps/web/.env.local`. The sitemap guard returns static-only entries (no issue/charity URLs) when the env var is absent, so a completely empty-looking sitemap in dev indicates a missing env var.

**`/feed.xml` shows an empty channel.**
Same cause as sitemap 500. Sanity project ID missing.

**OG image 404 on social previews.**
Confirm `apps/web/public/og-default.png` exists. Plan 02-10 ships a placeholder (solid `#FAFAF8`, valid 1200x630 PNG). Replace with real brand artwork at the same path before launch.

**`next-sanity` peer warning about Next 16.**
Expected. `next-sanity@12.4.5` declares a peer of `next@^16.0.0-0`. We intentionally stay on Next 15 to avoid the SanityLive 4-10x Vercel request overage bug documented in `.planning/research/STACK.md`. The warning does not affect functionality.

**Dev server shows empty state on `/` (no redirect).**
The demo seed has not been run, or it ran against the wrong project. Confirm `apps/studio/.env.local` has a valid `SANITY_API_TOKEN` and `SANITY_STUDIO_PROJECT_ID=6h1vd9mf`, then run `pnpm seed:demo` again. Expected output: `Seeded 2/2 demo documents.`

---

*Phase 2 owner: gsd-planner.*
*Phase 3 (next): Convex deployment + functions.*
