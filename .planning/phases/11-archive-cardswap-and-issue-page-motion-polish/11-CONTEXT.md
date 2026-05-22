# Phase 11: Archive CardSwap + Issue-Page Motion Polish — Context

**Gathered:** 2026-05-21
**Status:** Ready for UI design contract (UI-SPEC) → planning
**Source:** Conversation (Issue-042 "Machine Editorial" design spec, adapted to the live data-bound architecture)

<domain>
## Task Boundary

Additive polish on the ALREADY-SHIPPED Phase 9 dark issue page — do NOT duplicate components or hardcode content. Two deliverables:

1. **Archive CardSwap** (`/archive`): a CSS-3D card-cycling component that stacks REAL past published issues (from Sanity via the existing archive GROQ query) as 3D cards auto-advancing on a ~6s timer, pause-on-hover, click-to-open, optional indicator dots, "N issues" badge.
2. **Issue-page motion polish** drawn from the Issue-042 spec, applied to the EXISTING components:
   - IssueHero — charity-name line-by-line clip-path reveal on load
   - SectionNavigator — magnetic gold cursor-follow glow + hover translate
   - DeliberationSlot — confidence meter count-up on scroll-into-view + scroll-snap pitch-card carousel

This is the productive channel for the user's pasted "Issue 042 / Machine Editorial" design spec. The dark aesthetic itself is already live (Phase 9) — this phase adds the missing MOTION + the archive CardSwap, NOT a new design system.
</domain>

<decisions>
## Implementation Decisions (LOCKED — do not revisit)

### Fonts — APPROVED ONLY
- Display = Cormorant Garamond (already in FONT_WHITELIST — matches the spec).
- Body + labels = the already-approved fallbacks currently shipping (Lora body; whitelisted/Inter for UI labels).
- **Do NOT add Spectral or IBM Plex Mono.** FONT_WHITELIST is NOT modified (the spec's `@import` of those fonts is rejected — it bypasses the locked font governance + WeasyPrint PDF check).

### Animation — CSS 3D, NO new dependency
- CardSwap and all motion implemented with CSS perspective/transforms + minimal reduced-motion-safe JS (e.g. a timer + IntersectionObserver for count-up).
- **NO new npm dependency** (no `gsap`, no `framer-motion`).
- **NO CDN `<script>` tags** (the spec's `<script src="cdnjs…gsap">` / Iconify in `<head>` are rejected — CSP + bundling model).
- **NO external grain SVG** (the spec's `grainy-gradients.vercel.app/noise.svg` is rejected — use the existing globals.css grain/atmosphere layer).
- 'elastic' easing approximated with cubic-bezier.

### Data binding — NO hardcoded content
- Everything binds to Sanity/Convex. Zero hardcoded "Issue 042 / Project Solitude / Atacama / $45" content. Archive cards bind to real past issues; issue-page content stays Sanity/Convex-driven.

### Hard constraints (preserve — non-negotiable)
- `prefers-reduced-motion`: ALL new motion must respect it (auto-cycle off + static accessible list for CardSwap; instant reveals; no JS cursor tracking; count-up shows final value instantly).
- Single `<main id="main">` (root layout owns it) — new components add no second `<main>`.
- ≥44px touch targets (CardSwap controls, nav cards).
- WCAG AA contrast on all new surfaces.
- Print stylesheet still strips chrome to black-on-white serif (decorative/motion layers print-hidden).
- Game iframe security (`sandbox="allow-scripts"` + `validateEmbedCode`) and `theme.ts` security contract (hex validation, FONT_WHITELIST, setProperty-only) are NOT touched — `game-sandbox.test.ts` + theme tests stay green.
- DEL-04 (no model names) and the live Convex subscriptions in DeliberationSlot must NOT regress.

### Claude's Discretion
- Exact CardSwap geometry (cardDistance/verticalDistance/perspective), indicator-dot styling, count-up duration/easing, and which existing globals.css tokens to reuse — within the constraints above.
</decisions>

<specifics>
## Specific Ideas

- Source spec: the pasted "The Eisenbalm Dispatch: Issue 042 / Machine Editorial" design (dark `#0C0B0A` canvas, gold `#CDA434` accents, aurora, ledger grid). The dark palette + atmosphere already shipped in Phase 9 — reuse the existing `--color-*` tokens and Atmosphere/SectionNavigator components.
- CardSwap reference values from the spec (adapt, don't hardcode content): ~500×400 container, cardDistance ~50px, verticalDistance ~60px, 6000ms delay, pause-on-hover, click-to-open.
- The live issue page is `/issue/issue-999` (Foundation for Black Communities); archive shows prior issues.
</specifics>

<canonical_refs>
## Canonical References

- `apps/web/app/archive/` + `apps/web/components/archive/ArchiveList.tsx` — existing archive page/list to extend with CardSwap (also see backlog 999.1: archive pagination).
- `apps/web/components/issue/IssueHero.tsx`, `SectionNavigator.tsx`, `DeliberationSlot.tsx` — existing components to add motion to (do NOT rewrite their data binding).
- `apps/web/components/issue/Atmosphere.tsx` + `apps/web/app/globals.css` — existing dark atmosphere, `--color-*` tokens, grain, reduced-motion guard, print stylesheet to reuse.
- `apps/web/lib/theme.ts` — FONT_WHITELIST + security contract (READ ONLY — do not modify).
- `apps/web/lib/sanity/queries.ts` + `types.ts` — archive GROQ query + Issue type for binding CardSwap to real issues.
- `apps/web/__tests__/game-sandbox.test.ts`, `theme-aa-tones.test.ts`, `site-header-nav.test.ts` — tripwires that must stay green.
- ROADMAP Phase 11 goal + success criteria; REQUIREMENTS ARC-01, MOT-01, MOT-02, MOT-03.
</canonical_refs>

<deferred>
## Deferred Ideas

- Spectral + IBM Plex Mono fonts (would require FONT_WHITELIST governance + Andrew/designer sign-off + WeasyPrint PDF check) — deferred; using approved fallbacks instead.
- GSAP / framer-motion as animation libraries — deferred in favor of CSS-3D (no new dependency).
- A standalone static "Issue 042" showcase page — rejected in favor of enhancing the real data-bound page.
- Archive pagination / loading skeletons (backlog 999.1) — out of scope for this phase unless trivially co-located.
</deferred>

---

*Phase: 11-archive-cardswap-and-issue-page-motion-polish*
*Context captured: 2026-05-21 from conversation (Issue-042 spec adaptation). Phase mis-numbered 1000 by `phase add` (999.x backlog parsed as max integer); corrected to 11.*
