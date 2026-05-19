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
| `/_debug/convex` | `convex/*.ts` queries | **Phase 3 evidence only. Removed in Phase 9.** Hidden — not in nav, sitemap, or RSS. `Disallow: /_debug/` in robots.txt. Calls all 5 byRunId queries with synthetic runId `phase-3-smoke-test`. |

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
| `NEXT_PUBLIC_CONVEX_URL` | yes (when Convex is configured) | _none_ | Public Convex deployment URL (e.g. `https://adjective-animal-NNN.convex.cloud`). Web app uses it to construct `ConvexReactClient`. Set after running `pnpm --filter @eisenbalm/convex exec convex dev --once --configure`. When missing, the provider falls back to passing children through (no Convex subscriptions) — the rest of the site still renders. |
| `CONVEX_DEPLOY_KEY` | no (web app does not need it) | _none_ | **SECRET. NEVER commit. NEVER expose via NEXT_PUBLIC_*.** Convex Deploy Key (`dev:...` in Phase 3, `prod:...` after Andrew promotes the deployment). Used by `convex deploy` (CI / Vercel build step) and by the Phase 4 pipeline's HTTP API mutation calls. Kept in `apps/web/.env.local` for local HTTP API smoke tests. |

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

## Convex

Phase 3 (2026-05) wired the web app to a Convex deployment. The Convex backend hosts the deliberation stream (5 tables — `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`) and exposes 5 `byRunId` queries plus insertion mutations.

See [`convex/README.md`](../../convex/README.md) for the canonical Convex onboarding doc. The summary below is everything `apps/web` needs to know.

### Provider mount

[`apps/web/components/providers/ConvexClientProvider.tsx`](./components/providers/ConvexClientProvider.tsx) is a `'use client'` wrapper that constructs `new ConvexReactClient(NEXT_PUBLIC_CONVEX_URL)` at module scope (one websocket per browser session — never re-create per render). It is mounted in [`apps/web/app/layout.tsx`](./app/layout.tsx) so every descendant Client Component can call `useQuery`. The root layout remains a Server Component.

When `NEXT_PUBLIC_CONVEX_URL` is missing (e.g. Vercel preview deploys before Convex is provisioned), the provider passes children through without wrapping — the rest of the site renders, but any descendant calling `useQuery` will throw with a clear "no provider" message. This matches the pattern in [`apps/web/lib/sanity/client.ts`](./lib/sanity/client.ts) (placeholder projectId fallback, `useCdn: true` runtime client).

### Type imports

Convex's generated `api` object lives at `convex/_generated/api.{ts,d.ts}` (committed to git per project decision D-08 — mirrors Phase 1's `sanity.types.ts` posture). The [`apps/web/tsconfig.json`](./tsconfig.json) `paths` block aliases `@convex/*` → `../../convex/*`, so consumers `import { api } from '@convex/_generated/api'`.

### `/_debug/convex` (Phase 3 only — removed in Phase 9)

[`apps/web/app/%5Fdebug/convex/page.tsx`](./app/%5Fdebug/convex/page.tsx) is Phase 3's CVX-05 evidence surface. It calls all five `byRunId` queries with a synthetic `runId: "phase-3-smoke-test"` and renders a five-row table. Visit it locally at http://localhost:3000/_debug/convex.

> On-disk note: the folder is literally `%5Fdebug` (URL-encoded underscore) because Next.js 15's App Router treats any folder starting with a literal `_` as private and excludes it from routing. Using `%5F` in the folder name escapes the underscore so the served URL is the expected `/_debug/convex`. See Plan 03-06 deviation. The CONVEX_DEPLOY_KEY in `.env.local` is currently in `dev:` form (not `prod:`) per Plan 03-02 Deviation 1; the type does not change `apps/web`'s behavior.

The file carries a `TODO(Phase 9):` cleanup comment. Phase 9 (Issue Page Completion) will:

1. Delete `apps/web/app/%5Fdebug/convex/page.tsx`
2. Delete `apps/web/app/%5Fdebug/` if no other debug routes were added
3. Remove the `Disallow: /_debug/` line from `apps/web/public/robots.txt`
4. Drop this section from `apps/web/README.md` and the matching section in `convex/README.md`

Until then, the route exists as an empty-state checkpoint Andrew can hit to confirm the Convex pathway is alive without polluting the production site. It is excluded from `sitemap.xml` and `feed.xml` (those files only emit known editorial routes) and `Disallow:`-ed in `robots.txt`. The page also emits `<meta name="robots" content="noindex,nofollow">` for defense in depth.

### Vercel env provisioning (manual, D-22)

When the `apps/web` Vercel project exists (Phase 2 did not require it), Andrew runs:

```bash
cd apps/web
npx vercel env add NEXT_PUBLIC_CONVEX_URL production
npx vercel env add CONVEX_DEPLOY_KEY production
```

The plan does NOT automate this — env provisioning to remote services is Andrew's manual responsibility per D-22 (mirrors Phase 2 D-27).

### What happens in Phase 9

[`apps/web/components/issue/DeliberationSlot.tsx`](./components/issue/DeliberationSlot.tsx) — Phase 2's collapsed `<details>` placeholder — will gain `useQuery` calls against the issue's `runId` (fetched from Sanity via `QUERY_ISSUE_RUN_ID` in [`apps/web/lib/sanity/queries.ts`](./lib/sanity/queries.ts), already wired in Phase 2). The five queries flow into agent identity cards, advocate score bars, QA severity badges, and a pitch log timeline.

Phase 3 leaves `DeliberationSlot.tsx` untouched. The provider scaffolding is what Phase 9 will plug into.

### Shared with the pipeline (Phase 4)

> **Phase 4 note:** `CONVEX_DEPLOY_KEY` is also used by the FastAPI pipeline on Railway (`packages/pipeline/`). It's the same value in both environments — provision it in Vercel for the web app AND in Railway for the pipeline service. Both write to the same Convex deployment. See [`packages/pipeline/README.md`](../../packages/pipeline/README.md) for pipeline-side env var details.

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
| Live `<DeliberationSlot>` Convex subscriptions (uses Phase 3's infrastructure) | Phase 9 |
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

---

## Phase 7 — Game Rendering

Phase 7 wires the iframe game with security validation, CSP injection,
a "Game unavailable." fallback, and a Convex notification path for Andrew.

### Architecture

| File | Role |
|------|------|
| `apps/web/lib/game-validator.ts` | Pure validator + CSP/head injector (no React, no Convex) |
| `apps/web/components/issue/GameSlot.tsx` | Client Component: validates embedCode, renders iframe or fallback, fires Convex write on failure |
| `apps/web/components/issue/GameFallback.tsx` | Pure display: "Game unavailable." |
| `apps/web/__tests__/game-validator.test.ts` | Unit tests: every banned pattern + every CSP directive (GAM-02, GAM-04) |
| `apps/web/__tests__/game-sandbox.test.ts` | Source-scan tripwire: fails if `allow-same-origin` appears in GameSlot.tsx (GAM-03) |

### Security contract (LOCKED)

The iframe MUST use exactly `sandbox="allow-scripts"`. It must NEVER
contain `allow-same-origin` — that combination defeats the sandbox
(the sandboxed page can rewrite its own sandbox attribute via DOM
manipulation). The Vitest test in `apps/web/__tests__/game-sandbox.test.ts`
fails the build if `allow-same-origin` appears anywhere in
`apps/web/components/issue/GameSlot.tsx` (including comments). DO NOT
weaken or delete that test.

NEVER add allow-same-origin to the iframe sandbox attribute in GameSlot.tsx — the GAM-03 test will fail the build.

### Validator deny-list (mirrors Python FORBIDDEN_CONSTRUCTS)

The frontend deny-list in `apps/web/lib/game-validator.ts`
(`BANNED_PATTERNS`) mirrors the Python `FORBIDDEN_CONSTRUCTS` constant
in `packages/pipeline/src/eisenbalm_pipeline/agents/game.py`. Edits to
either list MUST be mirrored in the other (the frontend cannot import
from the Python package). Current entries (13):

- `window.parent`, `window.top`, `top.`, `parent.` — parent/top frame access
- `fetch(`, `XMLHttpRequest` — network requests
- `document.cookie`, `document.domain` — same-origin policy probes
- `localStorage` — storage access
- `eval(`, `import(` — dynamic code execution
- `<script src="...">`, `<link href="...">` — external resource references

`game-validator.ts` exports four symbols consumed by `GameSlot.tsx`:

- `BANNED_PATTERNS` — the deny-list array (readonly, 13 entries).
- `GAME_CSP_POLICY` — the 9-directive CSP string.
- `validateEmbedCode(embedCode: string): { valid: true } | { valid: false; reason: string }` — pure string scan; returns the first matching deny-list entry's label as `reason`.
- `injectGameHead(embedCode: string): string` — prepends the CSP meta tag, viewport meta, and mobile CSS reset to the embed code, always (never matches `<head>`).

Both functions are pure (no I/O, no React, no Convex). The Convex write on validation failure lives in `GameSlot.tsx`.

### CSP policy

Every game srcdoc has a `<meta http-equiv="Content-Security-Policy">`
prepended by `injectGameHead`. The policy is exported as
`GAME_CSP_POLICY` in `apps/web/lib/game-validator.ts`:

```
default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';
img-src data:; connect-src 'none'; frame-src 'none'; object-src 'none';
base-uri 'none'; form-action 'none'
```

The `connect-src 'none'` directive is the enforcement backstop against
`fetch()` / `XHR` / `WebSocket` calls that obfuscation might slip past
the string-match validator.

### Mobile responsiveness (GAM-06)

`injectGameHead` also prepends:

- `<meta name="viewport" content="width=device-width, initial-scale=1">`
- A CSS reset that sets `box-sizing: border-box` on `*`, `overflow-x: hidden`
  + `max-width: 100%` on `html, body`, and `max-width: 100% !important;
  height: auto;` on `canvas, svg, img`.

Combined with the iframe container's `overflow-hidden` (in `GameSlot.tsx`)
and the fixed heights `h-[280px] sm:h-[360px]`, this prevents the game
from breaking out of the 360px-wide viewport on mobile.

### Sandbox contract (validator → iframe vs fallback)

`GameSlot.tsx` is a Client Component (`'use client'`) that decides what to render based on a three-way decision:

1. `game === null` — no game on this issue; the slot shows a "Game coming soon." empty state. No iframe, no Convex write.
2. `validateEmbedCode(game.embedCode).valid === false` — the validator rejected the embed; the slot mounts `<GameFallback />` ("Game unavailable.") AND fires a `qaCorrections.insert` Convex mutation (see below). No iframe.
3. `validateEmbedCode(game.embedCode).valid === true` — the slot mounts a single `<iframe>` with `sandbox="allow-scripts"`, `srcDoc={injectGameHead(game.embedCode)}`. No fallback, no Convex write.

The iframe sandbox attribute is the literal string `"allow-scripts"` and nothing else. Adding any other token (especially the same-origin escape) trips the GAM-03 source-scan tripwire described above.

### Source-scan tripwire (GAM-03)

`apps/web/__tests__/game-sandbox.test.ts` reads `apps/web/components/issue/GameSlot.tsx` from disk at every test run via `readFileSync`. Three assertions run:

- Negative: `expect(source).not.toContain('allow-same-origin')` — fails the build if any future edit (code OR comment) reintroduces the forbidden token.
- Positive: `expect(source).toContain('sandbox="allow-scripts"')` — fails if a future edit removes the sandbox attribute entirely.
- Path: `expect(source.length).toBeGreaterThan(0)` — `readFileSync` raises `ENOENT` before this line runs if `GameSlot.tsx` is moved or renamed, forcing the maintainer to update `GAME_SLOT_PATH` rather than silently lose the guard.

If you rename or relocate `GameSlot.tsx`, update `GAME_SLOT_PATH` in `apps/web/__tests__/game-sandbox.test.ts`. Do not weaken the assertions — ESLint is not configured in `apps/web` (Phase 7 cost decision), so this Vitest source-scan is the only build-time enforcement of the sandbox contract.

### Fallback contract (GAM-05)

When `validateEmbedCode(game.embedCode)` returns `{valid: false}`:

1. `<GameFallback />` renders with the literal copy `Game unavailable.`
   (period; no exclamation; no "we're sorry"). This is a voice contract
   — see `CLAUDE.md`.
2. A `qaCorrections.insert` Convex mutation fires exactly once per
   component mount (guarded by `useRef`) with shape:
   ```
   {
     runId,                                       // from issue.runId
     sectionName: 'game',
     reason: `Game validator rejected embedCode: ${reason}`,
     severity: 'error',
     accepted: false,
     agentId: 'game-validator',
     axis: 'hard-rule',
   }
   ```
3. If `runId` is `null` (issue authored manually in Sanity without a
   pipeline run), the Convex write is skipped — `runId` is `v.string()`
   in the schema; passing undefined throws. The fallback UI still renders.

Andrew sees the row in the Phase 9 deliberation layer where
`agentId='game-validator'` is color-coded by `severity='error'`.

### Running the tests

The web workspace is named `web` in `apps/web/package.json` (not `apps/web` — that is the path, not the package name). pnpm's `--filter` flag takes the package name:

```bash
pnpm --filter web test:unit                       # full Vitest suite, < 10s
pnpm --filter web test:unit game-validator        # validator + CSP tests only
pnpm --filter web test:unit game-sandbox          # source-scan tripwire only
```

If you see the workspace path `pnpm --filter apps/web test:unit` in older docs or commit messages, treat it as a typo — `pnpm` resolves `--filter` against the `name` field, not the directory. Use `--filter web`. The npm script uses `vitest run` (not bare `vitest`) so there is no watch mode in CI.

Expected final state: `Test Files 2 passed (2), Tests 27 passed (27)`.

### Andrew's manual smoke test

Two requirements need a real browser + real Convex deployment:

**GAM-06 — 360px mobile rendering** (against the current published issue):

1. Open the current published issue at `https://<vercel-domain>/issue/<latest-slug>`
   (or `http://localhost:3000/issue/<latest-slug>` in dev).
2. In Chrome DevTools, set viewport to 360 x 640.
3. Scroll to the `#game` section.
4. Confirm:
   - The iframe container shows no horizontal scrollbar.
   - The game content is not clipped beyond the rounded container.
   - The "THE GAME" label + headline + description above the iframe
     are readable without horizontal scroll.

**GAM-05 — Validation failure → Convex write + fallback UI**:

1. In Sanity Studio, create a fixture `weeklyIssue` draft with a `game`
   object whose `embedCode` field contains the literal string
   `document.cookie` (e.g. `<script>document.cookie</script>`).
2. Publish the draft (or set status to `published` if your Studio
   workflow requires it).
3. Open the issue at `/issue/<fixture-slug>` in a browser.
4. Confirm in the browser:
   - The game section shows `Game unavailable.` (NOT the iframe).
   - No JavaScript errors in the console.
5. Confirm in the Convex dashboard (`qaCorrections` table):
   - A row exists with `sectionName='game'`, `severity='error'`,
     `agentId='game-validator'`, `accepted=false`.
   - The `reason` field contains "Game validator rejected embedCode:
     Forbidden construct: cookie access (document.cookie)".
   - The `runId` matches the issue's `pipelineMetadata.runId`.
6. Refresh the page; confirm the React `useRef` guard prevents a second
   row from being written on re-render (the row count for this `runId`
   + `sectionName='game'` remains 1, OR 2 if React Strict Mode is on in
   dev — production has Strict Mode off so it stays at 1 per mount).

After the smoke test passes, delete the fixture issue (or set its status
back to draft) so it does not appear in production.

### What to do if a test fails

- `game-validator.test.ts` red — the deny-list or CSP policy was edited
  without updating the test fixtures. Fix the test only if the edit was
  intentional and is mirrored in `packages/pipeline/.../game.py`.
- `game-sandbox.test.ts` red on the allow-same-origin assertion — an edit
  reintroduced the forbidden token. Revert the edit; do NOT weaken
  the test.
- `game-sandbox.test.ts` red on `sandbox="allow-scripts"` — the iframe
  was removed or the sandbox attribute was changed. Restore the
  contract.

### Pnpm command compatibility note

`pnpm --filter apps/web test:unit` is the workspace-path form of the filter (also written `pnpm --filter ./apps/web test:unit`). It will work when pnpm 9.x is invoked from the repo root and the workspace glob matches that path. The canonical name-based form is `pnpm --filter web test:unit` (matches the `name` field in `apps/web/package.json`). Both resolve to the same `test:unit` script (`vitest run`). Phase 7 internal docs use the name-based form; older plan text occasionally uses the path form — they are equivalent in this repo.
