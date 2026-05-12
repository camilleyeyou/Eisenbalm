# Phase 2: Web Shell + Theme Engine - Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md.

**Date:** 2026-05-12
**Phase:** 02-web-shell-theme-engine
**Mode:** auto (recommended defaults; UI-SPEC.md already locked typography/color/spacing/components/copy/registry/security)
**Areas discussed:** Dev/demo content, Image/asset URL handling, Convex client timing, Studio preview mode, Font loading, Sanity datasets, Server vs Client Components, Sitemap/RSS plumbing, not-found page, Vercel provisioning, CSS-variable injection module, Anchor copy-link UX, Dependency boundary

## Dev/Demo Content Strategy

| Option | Description | Selected |
|---|---|---|
| Seed 1 stub charity + 1 stub published issue idempotently | Web shell renders against real data during dev; dev experience matches production reads | ✓ |
| No demo content; web shell relies on empty states | Saves a script but blocks dev iteration on issue-page rendering | |
| MSW or local mock layer | Adds a second source of truth; diverges from real GROQ behavior | |

**Rationale:** Matches the Phase 1 seed pattern (`apps/studio/scripts/seed-agents.ts`). Deterministic `_id`s keep re-runs idempotent. Demo issue must have a recognizable non-default theme so the CSS-variable injection is visibly working on first dev run.

## Image / Asset URL Handling

| Option | Description | Selected |
|---|---|---|
| `@sanity/image-url` + `next/image` | Sanity's official URL builder for transforms; Next handles optimization | ✓ |
| Pass raw Sanity asset URLs to `<img>` | No transforms, no responsive optimization | |
| Custom builder | Reinvents the wheel | |

**Rationale:** Standard pattern. PDF URLs resolve via GROQ projection (already specified in UI-SPEC).

## Convex Client Timing

| Option | Description | Selected |
|---|---|---|
| Wire Convex in Phase 9 (deliberation layer) | Keeps Phase 2 focused; placeholder slot per UI-SPEC | ✓ |
| Install + wire Convex client now | Adds surface area for no Phase 2 benefit | |

**Rationale:** Phase 2's deliberation UI is a placeholder per UI-SPEC; Phase 9 wires `@convex/react` when it ships the deliberation surface.

## Studio Preview Mode

| Option | Description | Selected |
|---|---|---|
| OUT of Phase 2 scope | No WEB-* requirement; Sanity Studio editing is sufficient | ✓ |
| Wire Sanity Presentation Tool to apps/web/preview route | Adds drafts mode; not required by brief or requirements | |

**Rationale:** No WEB-* requirement. Andrew edits via Studio + Vercel preview deployments when needed. Revisit if editing blind becomes a pain point.

## Font Loading

| Option | Description | Selected |
|---|---|---|
| `next/font/google` for defaults + `<link>` for per-issue whitelist fonts | Zero-CLS default load; dynamic per-issue from a curated list | ✓ |
| All Google Fonts via `<link>` | More CLS, no build-time subset | |
| Self-host all fonts | Phase 6 will base64-inline for PDF; web can mirror — but adds maintenance | |

**Rationale:** Standard Next.js 15 pattern. Whitelist is Phase 5 (DesignAgent); Phase 2 ships 4-6 safe defaults + the validation hook.

## Sanity Datasets

| Option | Description | Selected |
|---|---|---|
| `production` only | Single dataset, simpler | ✓ |
| `production` + `preview`/`staging` | Adds dataset management overhead with no current v1 use case | |

**Rationale:** No need yet. Defer to a future milestone.

## Server vs Client Components

| Option | Description | Selected |
|---|---|---|
| RSC default + Client where needed | Sanity reads cached at server; client only for interactive bits | ✓ |
| All Client Components | Loses Next 15's caching benefit | |
| All RSC | Anchor copy and search inputs need client interactivity | |

**Rationale:** Standard Next 15 App Router pattern. Reads → RSC. Interactive → Client.

## Sitemap / RSS Plumbing

| Option | Description | Selected |
|---|---|---|
| Next 15 Route Handlers with ISR revalidate 60s | Dynamic content, cached, low ops overhead | ✓ |
| Static at build time | Stale until next deploy; weekly cadence might miss | |
| Cron / external generator | Over-engineering | |

**Rationale:** ISR matches the weekly cadence and lets Publisher's deploy hook (Phase 6) refresh on every publish.

## not-found Handling

| Option | Description | Selected |
|---|---|---|
| Next 15 `not-found.tsx` with editorial copy | Standard, jesse voice ("This isn't here. Try the archive.") | ✓ |
| Redirect to home | Erases the URL context | |

**Rationale:** Editorial brand expects a graceful, voice-correct 404.

## Vercel Provisioning

| Option | Description | Selected |
|---|---|---|
| OUT of Phase 2 scope — Andrew runs `vercel link` manually when ready | Same pattern as Phase 1's `npx sanity init` step | ✓ |
| Automate via vercel CLI in plan | Andrew prefers control over deploy provisioning |  |

**Rationale:** Matches Phase 1's manual-checkpoint pattern. Document in `apps/web/README.md`.

## CSS-Variable Injection Module

| Option | Description | Selected |
|---|---|---|
| `apps/web/lib/theme.ts` with `applyTheme(theme)` — validates hex, whitelist fonts, checks WCAG AA, uses setProperty | Single source of truth for theme injection security | ✓ |
| Inline in each route layout | Risks divergence and missed validation paths | |

**Rationale:** UI-SPEC mandates security; centralized module makes Phase 5 DesignAgent integration cleaner.

## Anchor Copy-Link UX

| Option | Description | Selected |
|---|---|---|
| Client Component using `navigator.clipboard.writeText` + 1.5s "Copied" fade | Lightweight, no toast lib | ✓ |
| Sonner / radix-ui toast for "Copied" feedback | Adds a dep for one microinteraction | |
| Anchor only (no clipboard) | Reader has to manually copy URL — bad UX | |

**Rationale:** Per UI-SPEC. No new toast lib needed.

## Dependency Boundary

| Option | Description | Selected |
|---|---|---|
| Locked list: next, react, next-sanity@^12.4.5, @sanity/client, @sanity/image-url, @portabletext/react, tailwindcss@^4, lucide-react, @eisenbalm/shared | Anything outside this requires explicit approval | ✓ |
| Planner has free hand to add deps | Risks scope creep + surprise install conflicts | |

**Rationale:** Phase boundary discipline. Planner flags any new dep need rather than installing silently.

## Claude's Discretion

- Exact Next 15 ISR revalidation seconds (default 60s)
- Default fonts in Phase 2 whitelist (4-6 safe Google Fonts)
- Exact placeholder copy for the demo issue (Jesse voice, dry, brief)
- shadcn primitive scaffolding location (per shadcn CLI default)

## Deferred Ideas

- Sanity Studio Presentation Tool / `/preview` route
- Per-issue dynamic OG image generation (v2 differentiator)
- Vercel CLI automation
- i18n, analytics, comments, share-to-X, newsletter, email digest
- Multi-issue carousel / featured-issues UI
- Charity filter / focus-area browse
