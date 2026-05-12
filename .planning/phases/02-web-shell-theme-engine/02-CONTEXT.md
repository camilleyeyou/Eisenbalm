# Phase 2: Web Shell + Theme Engine - Context

**Gathered:** 2026-05-12
**Status:** Ready for planning
**Mode:** auto (recommended defaults selected for every gray area not already locked by UI-SPEC.md)

<domain>
## Phase Boundary

Build the full reader-facing Next.js app (`apps/web/`) — all routes, per-issue CSS-variable theme injection, SEO/structured-data plumbing, sitemap, RSS, print stylesheet, reading time, anchor-link UI. The app reads from Sanity (already live from Phase 1) and renders against real (seeded) content.

**In scope:**
- Routes: `/`, `/issue/[slug]`, `/archive`, `/charities`, `/charities/[slug]`, `/about`, `/shop` (shell only)
- Per-issue theme via validated CSS variables (security-correct hex + setProperty + WCAG fallback)
- Persistent shop callout (one sentence + button — never a banner)
- `schema.org/Article` JSON-LD, OG/Twitter cards, sitemap.xml, feed.xml, print stylesheet
- Estimated reading time, anchor copy-link buttons
- Slots for game / deliberation / podcast with placeholder UI (Phase 7 / 9 / 10 wire the interactive content)
- 1 stub charity + 1 stub published `weeklyIssue` seeded for dev/demo
- Wiring `@eisenbalm/shared` types into `apps/web`

**Strictly NOT in this phase:**
- Stripe / checkout / `/shop/thank-you` (Phase 8)
- Convex deliberation subscriptions (Phase 9)
- Game iframe + sandbox validator (Phase 7)
- Real podcast player (Phase 9)
- LangGraph pipeline (Phase 4+)
- WeasyPrint PDF (Phase 6)
- Sanity Studio Presentation/preview mode
- Per-issue dynamic OG image generation (v2)
- Vercel project provisioning — manual step Andrew runs (`vercel link`) when ready

</domain>

<decisions>
## Implementation Decisions

Everything in `02-UI-SPEC.md` is locked design contract — typography, color, spacing, copy, components, registry, security. This CONTEXT.md captures decisions NOT in UI-SPEC.

### Stack & libraries

- **D-01:** Next.js `^15.3.x` (NOT 16) per UI-SPEC + research. App Router. RSC by default for issue/archive/charity reads; Client Components for `<AnchorCopyButton>`, `<ArchiveSearchInput>`, and the client-side WCAG contrast-fallback check.
- **D-02:** `next-sanity@^12.4.5` (NOT `@cache-components` tag). All Sanity GROQ reads use `defineLive` for ISR + on-demand revalidation. Build-time client uses `useCdn: false` so Publisher's Vercel deploy hook reads fresh content (Phase 6 dependency — encoded now).
- **D-03:** `@sanity/image-url@^1` for image URL builder + `next/image` for optimization. Helper at `apps/web/lib/sanity/image.ts` exports `urlFor(source)` and a typed wrapper for `next/image`.
- **D-04:** `@portabletext/react@^4` for rendering Portable Text bodies (origin story, founder bio, etc.). Component map lives at `apps/web/components/portable-text.tsx` and matches the Jesse-voice copy contract (no decorative paragraph styling that would break the dry register).
- **D-05:** Tailwind v4 via `@theme` CSS-variable directives (per UI-SPEC). PostCSS config minimal. No `tailwind.config.ts` v3 bridge.
- **D-06:** `lucide-react` for the small icon needs (anchor-copy icon, external link icon). No other icon libs.
- **D-07:** `shadcn/ui` registry: official `button` + `tooltip` only, scoped to the shop callout. Editorial surfaces are all custom — no shadcn components for charity / issue / archive UI.
- **D-08:** No new top-level deps beyond the list above without explicit user approval. Planner flags any new dep need rather than installing silently.
- **D-09:** Font loading: `next/font/google` for default brand fonts (zero CLS, build-time subset). Per-issue `theme.fontDisplay` / `theme.fontBody` loaded via `<link rel="stylesheet">` injected from a whitelist. The whitelist itself is Phase 5 (DesignAgent); Phase 2 ships 4-6 safe defaults + the validation hook.

### Theme engine (security-critical)

- **D-10:** CSS-variable injection lives at `apps/web/lib/theme.ts` exporting `applyTheme(theme)` which:
  1. Validates each hex string against `/^#[0-9a-fA-F]{6}$/`. Reject everything else.
  2. Validates each font name against the whitelist (Phase 2 ships a placeholder whitelist; Phase 5 extends it).
  3. Computes WCAG AA contrast between `text` and `bg`; if < 4.5:1, replaces ALL theme values with the brand fallback palette.
  4. Calls `element.style.setProperty('--color-primary', validHex)` etc. NEVER template-literal CSS strings.
- **D-11:** Server-rendered inline `<script>` injects theme on first paint to avoid FOUC. Client component re-validates on hydration as defense-in-depth.
- **D-12:** Default brand fallback palette (used when theme is missing or fails validation) is defined in `apps/web/lib/theme.ts`: off-white bg, deep-forest primary, deep-crimson accent, near-black text (matching UI-SPEC color contract).

### Data / reads

- **D-13:** Sanity reads use the GROQ queries documented in `docs/API_CONTRACTS.md §1`. Query files live at `apps/web/lib/sanity/queries.ts`. Each query exports its const + the result type (from `@eisenbalm/shared`).
- **D-14:** Sanity client is configured in `apps/web/lib/sanity/client.ts` with `useCdn: true` for runtime reads (fast, cached) and a separate `buildClient` with `useCdn: false` exposed for build-time and Publisher webhook contexts (Phase 6 dependency).
- **D-15:** `production` dataset only. No preview/staging dataset. Reflected in env: `NEXT_PUBLIC_SANITY_DATASET=production`.
- **D-16:** Convex client NOT wired in Phase 2. Deliberation slot renders empty placeholder per UI-SPEC. Phase 9 wires `@convex/react` and the subscription queries.

### Seed demo content

- **D-17:** Phase 2 ships an idempotent `apps/studio/scripts/seed-demo-content.ts` script that creates:
  - 1 stub `charity` document (deterministic `_id`: `charity-demo-quiet-foundation`)
  - 1 stub `weeklyIssue` document with `status: 'published'`, `issueNumber: 1`, referencing the stub charity (deterministic `_id`: `issue-001-demo`)
  - All required `weeklyIssue` fields populated with brief placeholder content in Jesse voice
- **D-18:** Demo content is OPTIONAL — engineers run `pnpm seed:demo` when they want to see the web shell render against real data. Production-quality issues replace these once Phase 4+5 produce them.
- **D-19:** Script reads `SANITY_API_TOKEN` from `apps/studio/.env.local` (same pattern as `seed-agents`). Use `tsx --env-file=.env.local` per the fix landed in Phase 1.

### Routes & layout

- **D-20:** Route structure under `apps/web/app/`:
  - `app/page.tsx` → `/` (server component, redirects to latest issue or renders empty state)
  - `app/issue/[slug]/page.tsx` → full issue
  - `app/issue/[slug]/layout.tsx` → applies per-issue theme via inline script + CSS variables
  - `app/archive/page.tsx` → archive list
  - `app/charities/page.tsx` → charity list
  - `app/charities/[slug]/page.tsx` → single charity
  - `app/about/page.tsx` → static about (copy from Andrew — placeholder OK in Phase 2)
  - `app/shop/page.tsx` → shell only ("Lip balm coming soon" + brand callout copy from UI-SPEC)
  - `app/not-found.tsx` → "This isn't here. Try the archive." (Jesse voice)
  - `app/layout.tsx` → root layout with default theme, default fonts, `<SiteHeader>`, `<SiteFooter>`
  - `app/sitemap.xml/route.ts` → dynamic sitemap, ISR revalidate 60s
  - `app/feed.xml/route.ts` → dynamic RSS, ISR revalidate 60s

### SEO / structured data

- **D-21:** Per-page `<head>` metadata via Next 15 `generateMetadata()` exports. Includes OG + Twitter card tags per UI-SPEC.
- **D-22:** `schema.org/Article` JSON-LD rendered inline in the issue page server component. Schema includes: `headline` (issue title or charity name), `author` (always "Jesse A. Eisenbalm"), `datePublished` (`weeklyIssue.publishDate`), `image` (OG image URL), `publisher`.
- **D-23:** Static fallback OG image at `apps/web/public/og-default.png` (brand mark + "The Eisenbalm Dispatch"). Per-issue dynamic OG image (theme-aware, charity name) is deferred to v2.

### Reading time & anchors

- **D-24:** Reading time computed from concatenated Portable Text body fields (origin story + problem statement + founder bio + case study), 200 WPM, rounded up to nearest minute. Helper at `apps/web/lib/reading-time.ts`. Renders as "{N} min read" (UI font 14px muted) in the issue hero.
- **D-25:** Each issue section has an `id` (e.g. `<section id="origin-story">`). `<AnchorCopyButton>` is a client component that copies `window.location.origin + window.location.pathname + '#' + sectionId` to clipboard. "Copied" microcopy fades after 1.5s.

### Print stylesheet

- **D-26:** Global print stylesheet in `apps/web/app/globals.css` `@media print` block: hide `<SiteHeader>`, `<SiteFooter>`, `<AnchorCopyButton>`, `<ShopCallout>`, game/deliberation/podcast slots, theme background. Keep all editorial copy. Fall back to default serif fonts (per UI-SPEC) for print legibility. Black-on-white only.

### Provisioning (manual, NOT planner work)

- **D-27:** `vercel link` is a manual step Andrew runs when he's ready to deploy. Phase 2 ships the code + `apps/web/README.md` with the provisioning steps documented. The planner does NOT attempt to `vercel deploy` autonomously.
- **D-28:** `apps/web/.env.local` (gitignored) needs: `NEXT_PUBLIC_SANITY_PROJECT_ID=6h1vd9mf`, `NEXT_PUBLIC_SANITY_DATASET=production`. Plan ships `apps/web/.env.example` (committed) with these var names.

### Claude's Discretion

- Exact Next 15 ISR revalidation seconds (default 60s; planner adjusts if a specific page needs different).
- Default fonts to ship in Phase 2's whitelist (UI-SPEC says 4-6 safe ones; planner picks specific Google Fonts that work for both web + WeasyPrint — Inter, Merriweather, IBM Plex Serif, Source Serif are reasonable starting points).
- Exact placeholder copy in the seed demo `weeklyIssue` — Jesse voice, dry, brief; planner drafts.
- Whether to scaffold `apps/web/components/ui/` for the few shadcn primitives or inline them — planner decides based on shadcn CLI's standard layout.

### Folded Todos

(None — no pending todos matched Phase 2 scope.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 2 specific

- `.planning/phases/02-web-shell-theme-engine/02-UI-SPEC.md` — LOCKED design contract. Typography, color, spacing, copy, components, registry, security. Planner must respect every line.

### Project / brand

- `CLAUDE.md` — project preface; "do not modify field names without checking API_CONTRACTS.md first" rule
- `docs/CLAUDE_CODE_BRIEF.md` — page structure for `/issue/[slug]` (10 sections), voice notes, brand posture
- `docs/API_CONTRACTS.md §1` — canonical GROQ queries the web app implements (QUERY_LATEST_ISSUE_SLUG, QUERY_ISSUE_BY_SLUG, QUERY_ARCHIVE, QUERY_ALL_CHARITIES, QUERY_CHARITY_BY_SLUG)

### Phase 1 outputs (consumed in Phase 2)

- `apps/studio/sanity.types.ts` — generated TS types (Charity, WeeklyIssue, AgentProfile). Consumed via `packages/shared/src/sanity-types.ts` re-export under `@eisenbalm/shared`
- `apps/studio/schemas/weeklyIssue.ts` — field source of truth for issue page
- `apps/studio/schemas/charity.ts` — field source of truth for charity page
- `apps/studio/scripts/agents.json` — the 14 agentProfile copy strings (Phase 9 surfaces these; Phase 2 reserves the slot)
- `packages/shared/src/sanity-types.ts` — re-export consumed by `apps/web`
- `package.json` (root) — pnpm workspaces; `apps/web` is already a workspace member with `@eisenbalm/shared: "workspace:*"`
- `apps/web/package.json` (placeholder from Phase 1) — extend, don't replace
- `tsconfig.base.json` — strict TS settings inherited by apps/web's tsconfig

### Research

- `.planning/research/STACK.md` — version pins for Next 15, next-sanity v12.4.5, Tailwind v4
- `.planning/research/PITFALLS.md` — theme injection security, CDN race, font loading, contrast
- `.planning/research/SUMMARY.md` — Phase 2 ordering rationale, build-order constraints
- `.planning/research/FEATURES.md` — table stakes per surface; anti-features (no popups, no urgency)

### Codebase map

- `.planning/codebase/STRUCTURE.md` — planned monorepo layout (now realized in Phase 1)
- `.planning/codebase/STACK.md` — current vs planned stack status
- `.planning/codebase/INTEGRATIONS.md` — Sanity / Convex / Stripe integration shapes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- `apps/studio/sanity.types.ts` — full TypeScript types for every schema. Consume via `import type { Charity, WeeklyIssue, AgentProfile } from '@eisenbalm/shared'`.
- `packages/shared/src/sanity-types.ts` — re-export from Phase 1. Adding new shared types (e.g. enriched GROQ result types) lands here, not in `apps/web`.
- `apps/studio/scripts/seed-agents.ts` — pattern for the demo content seed (`createOrReplace`, deterministic `_id`, idempotent, reads env via `tsx --env-file=.env.local`).
- `apps/web/package.json` — already exists as a placeholder workspace from Phase 1. Add `next`, `react`, `next-sanity`, etc. as deps here.
- `apps/web/tsconfig.json` — already extends `../../tsconfig.base.json`. Extend `include` to cover `app/**/*.tsx`, `components/**/*.tsx`, `lib/**/*.ts`.
- `apps/web/README.md` — placeholder readme from Phase 1, replace with the Phase 2 onboarding doc.

### Established Patterns

- **`@eisenbalm/shared` is the type bridge.** Anything `apps/web` and (later) `packages/pipeline` need to agree on goes through `packages/shared`.
- **Field names are LOCKED across schemas + contracts + types.** `weeklyIssue.problemPdf`, `charity.firstFeaturedIn`, etc. — never rename. Reads use GROQ projections (`problemPdfUrl`, `featuredIn`) per the contract.
- **`tsx --env-file=.env.local`** is the env-loading pattern for scripts. Phase 2 demo-seed script uses the same.
- **Deterministic `_id`s for upserts.** `agent-{id}`, `charity-{slug}`, `issue-{paddedNumber}-{slug}`. NEVER `_id`-less inserts that would create duplicates.
- **Jesse voice in ALL copy** — UI strings, empty states, loading states, sitemap labels, RSS title, OG titles, "Copied" microcopy. Dry, precise, no exclamations, no winking.

### Integration Points

- `apps/web` reads from Sanity at runtime. Configured via `NEXT_PUBLIC_SANITY_PROJECT_ID` and `NEXT_PUBLIC_SANITY_DATASET` (both safe to expose — Sanity public dataset).
- `apps/web/.env.local` (gitignored). `apps/web/.env.example` (checked in).
- Future: `apps/web` will subscribe to Convex (Phase 9) and call Stripe (Phase 8). Phase 2 leaves the integration slots empty but doesn't install those packages.

### Constraints from Existing Code

- `apps/web/package.json` placeholder must be replaced carefully — preserve the `@eisenbalm/shared: "workspace:*"` dep and the workspace name (`web` or `@eisenbalm/web` — match Phase 1).
- `next-sanity` v12 has a specific cache-components incompatibility with Next 16. We're on Next 15 — fine — but planner should pin Next at `15.3.x` not `^15` to prevent silent jumps.
- Tailwind v4 is the right choice but is still relatively new — if the planner finds blocking issues, fall back to Tailwind v3 with CSS-variable bridge. Document the choice + reasoning in the plan.

</code_context>

<specifics>
## Specific Ideas

- **Andrew's first run experience after Phase 2:** Plan must produce a clean `apps/web/README.md` so Andrew can:
  1. `pnpm install` from repo root
  2. Copy `apps/web/.env.example` → `apps/web/.env.local`, fill in projectId
  3. (Optional) `pnpm seed:demo` to populate the demo issue
  4. `pnpm --filter web dev` to launch Next on `localhost:3000`
  5. Browse to `/`, see redirect to demo issue
  6. Browse to `/archive`, `/charities`, `/about`, `/shop` — all render
- **Theme demonstration:** The demo seed issue should have a recognizable non-default theme (e.g. a warm cream bg, deep navy primary, mustard accent) so Andrew can SEE the CSS-variable injection working on first dev run. Don't ship a black-on-white demo that hides the theme engine.
- **The shop callout is a footnote, not a CTA.** UI-SPEC has the copy. Planner must not be "creative" here — the brand collapses if shop feels pushy.
- **Sitemap and RSS are real reader features, not afterthoughts.** RSS readers index the dispatch; charities link back to their featured page. Test both with a real RSS reader (e.g. NetNewsWire) before considering Phase 2 done.

</specifics>

<deferred>
## Deferred Ideas

- **Sanity Studio Presentation Tool / `/preview` route** — adds live drafts mode. Not required for Phase 2. Revisit once Andrew complains about editing blind.
- **Per-issue dynamic OG image generation** (e.g. via `@vercel/og`) — v2 differentiator. Phase 2 ships a static fallback OG image.
- **Vercel project provisioning automation** — manual `vercel link` step by Andrew. Defer any automation to a future milestone.
- **i18n / locales** — not on roadmap. English-only.
- **Web analytics / Plausible / Fathom integration** — not on roadmap.
- **Comments / share-to-X / social embed** — not on roadmap.
- **Newsletter signup / email capture** — explicitly OUT of scope (brand: "site is a destination, not a newsletter").
- **Per-issue email digest** — same.
- **Author multi-byline** — Jesse is the only voice. No co-bylines.
- **Multi-issue carousel / featured-issues bar** — the latest issue IS the homepage; the archive lists the rest. Don't add layering.
- **Charity comparison / "browse by focus area" filter UI** — `/charities` is a simple alphabetical list in Phase 2. Filtering by focus area is a reasonable v2 if `/charities` grows past ~50 entries.

### Reviewed Todos (not folded)

(None — no todos were reviewed.)

</deferred>

---

*Phase: 02-web-shell-theme-engine*
*Context gathered: 2026-05-12*
