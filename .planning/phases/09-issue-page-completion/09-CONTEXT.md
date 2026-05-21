# Phase 9: Issue Page Completion + Visual Redesign — Context

**Gathered:** 2026-05-20
**Status:** Ready for UI design contract (UI-SPEC)

<domain>
## Task Boundary

Two things converge on the issue page (`apps/web/app/issue/[slug]` + `apps/web/components/issue/*`):

1. **Phase 9 functional core (from ROADMAP):** complete the deliberation layer (live Convex subscriptions across all 5 tables — `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`), rendering advocate score bars, QA severity color-coding, and named agent identity cards (NO model names like "Claude" anywhere) in a **collapsed-by-default** accordion; complete the podcast section (HTML5 audio player + collapsible transcript when `podcast.audioFile` is populated, else "Audio coming soon"). Requirements: DEL-01..06, POD-01..03. Real-time updates while the pipeline runs.

2. **Visual redesign (user-provided mockup):** adopt the dark editorial art direction in `mockup-reference.html` (this directory) for the whole issue page — fixed nav, hero with ghost numeral, 8-card section navigator, article sections, game frame, two-column deliberation, podcast player, shop callout, footer.

The UI-SPEC must cover the WHOLE issue page as one coherent visual+interaction contract, with the Phase 9 deliberation/podcast functionality as its functional heart. This SUPERSEDES the Phase 10 "editorial design pass" visual treatment (Phase 10 was a lighter pass on the same page).
</domain>

<decisions>
## Implementation Decisions (LOCKED — do not revisit)

### Theme model = HYBRID
- The fixed dark **atmosphere + structure** becomes the HOUSE STYLE: void/panel/card backgrounds, grain overlay, aurora gradients, vertical grid, gold-glow hover treatment, section-navigator cards, two-column deliberation layout, hero ghost numeral, progress bar.
- Per-issue theming STAYS meaningful: the DesignAgent's per-issue `--color-primary` and `--color-accent` (already validated by `apps/web/lib/theme.ts`) drive the **highlight/accent layer** — section-label `§` mark, pull-quote borders, confidence bar fill, card hover glow, link accents, the "selected" pitch-card treatment.
- Re-express the mockup's hardcoded `--gold` / `--ember` / `--sage` literals as `--color-*` variables, using `color-mix()` for the glow/tint derivations (mirrors the existing derived-color pattern in globals.css).
- `--font-ui` stays LOCKED (never themed) per the existing theme.ts invariant. The dark-default house palette becomes the new `:root` default (issue pages still override via theme injection).

### Hard constraints (from existing system + 2026-05-20 audit)
- **Game security:** the iframe MUST keep `sandbox="allow-scripts"` ONLY and route content through `validateEmbedCode` (build test `apps/web/__tests__/game-sandbox.test.ts` enforces this). The mockup's unsandboxed `loadGame()` srcdoc pattern is FORBIDDEN — adopt its click-to-load UX but render through the existing `GameSlot` security path.
- **Single landmark:** exactly ONE `<main id="main">` per page (owned by `apps/web/app/layout.tsx`). The mockup's TWO `<main>` elements (article + bonus) must NOT be reproduced — the bonus is a `<section>`.
- **Mobile nav:** must NOT disappear. The mockup hides `.nav-links` at ≤960px with no replacement; the spec must define a real mobile menu (hamburger/disclosure).
- **Reduced motion:** ALL animation (aurora, grain, line reveals, ripple, confidence count-up, scroll reveals, progress bar) MUST respect the `prefers-reduced-motion: reduce` guard already in `apps/web/app/globals.css` (added 2026-05-20).
- **Contrast (WCAG AA):** secondary text tones (the mockup's `--cream-dim` #A89F8A, `--cream-mute` #615B4D on dark bg) must pass AA for the text sizes they're used at. The theme engine's contrast gate only checks the bg+text pair — secondary tones are NOT gated, so the spec must specify AA-passing values.
- **Touch targets:** preserve the ≥44px targets established in quick task 260520-0kt (nav links, copy buttons, etc.).
- **Print/PDF:** the existing print stylesheet must still strip chrome to black-on-white serif (WeasyPrint Phase 6 + `@media print` in globals.css). The dark atmosphere is screen-only.

### Fonts
- `Cormorant Garamond` (display) is ALREADY in `FONT_WHITELIST` (theme.ts) — OK to use.
- `Spectral` (body) and a monospace UI face (mockup uses `IBM Plex Mono`) are NOT whitelisted. Treat as a flagged dependency: whitelist append + Andrew/designer approval + WeasyPrint PDF compatibility check (same governance as the prior whitelist round, per STATE.md). The spec may propose them but must mark them PENDING approval and provide whitelisted fallbacks (e.g. body falls back to Lora; UI stays Inter) so the phase is not blocked.

### Data binding (no hardcoded content)
- Article prose (origin/problem/founder/case/bonus) → Sanity Portable Text via existing `PortableTextRenderer`.
- Pull-quotes → need a designated source (a Sanity highlight field OR an explicit extraction rule); the spec must define which.
- Deliberation pitch cards / timeline / confidence / advocate scores / QA severity → live Convex subscriptions (the 5 tables). Empty-state required when a run has no Convex data.
- Hero meta (location, founding year, mandate, read time) → charity + issue fields.
- Podcast → real `podcast.audioFile` URL + transcript; "Audio coming soon" empty state.
- The mockup's hardcoded content matches REAL Issue 999 data (FBC winner; Centre for Social Justice + Steve Morgan runner-ups; Advocate scores null; Editor confidence 62% below 0.70 → human-review flag) — useful as a fixture, but the components bind to live data.
</decisions>

<specifics>
## Specific Ideas

- Primary visual reference: `mockup-reference.html` (this directory) — full dark editorial layout with nav, hero, section navigator, article, game, deliberation (two-column: pitch log + timeline), podcast, shop, footer.
- Section ids in the mockup differ slightly from existing component ids (`the-problem` vs `problem`, `the-game` vs `game`, `the-bonus` vs `bonus`) — reconcile to the existing ids (`origin-story`, `problem`, `founder-bio`, `case-study`, `game`, `bonus`, `deliberation`, `podcast`) so anchors/`AnchorCopyButton` keep working.
- Agent identity cards must show the named persona (Scout / Advocate / Editor etc. from `agentProfile`) and link to the agentProfile page — NEVER the underlying model name.
- The mockup's confidence count-up + below-threshold "human review flagged" note maps to the real `editor_confidence` + 0.70 threshold.
</specifics>

<canonical_refs>
## Canonical References

- `apps/web/lib/theme.ts` — theme engine invariants (hex regex, FONT_WHITELIST, WCAG AA gate, setProperty-only injection). Do NOT modify its security contract.
- `apps/web/app/globals.css` — CSS-variable wiring, derived colors (color-mix), Phase 10 utilities (.drop-cap, .ornament-divider, .eyebrow, .metadata-block), the print stylesheet, and the prefers-reduced-motion guard.
- `apps/web/components/issue/*` — existing components to restyle/extend: IssueHero, EditorialSection, GameSlot (+ GameFallback), DeliberationSlot, PodcastSlot, BonusSection, AnchorCopyButton.
- `apps/web/__tests__/game-sandbox.test.ts` — build guard for the iframe sandbox.
- `convex/schema.ts` — the 5 deliberation tables (pipelineRuns, deliberationEvents, agentVotes, qaCorrections, pitchLog).
- `.planning/REQUIREMENTS.md` — DEL-01..06, POD-01..03.
- `docs/API_CONTRACTS.md` — interface shapes (GROQ returns, Convex queries, IssueTheme).
- ROADMAP Phase 9 goal + success criteria (deliberation accordion collapsed-by-default, advocate score bars, QA severity colors, named agent cards, no model names; podcast player/transcript or "Audio coming soon"; real-time updates).
</canonical_refs>

<planner_followups>
## Planner Follow-ups (from gsd-ui-checker, non-blocking — resolve during /gsd:plan-phase 9)

1. **Pull-quote data source — MUST pin down before EditorialSection restyle.** The UI-SPEC references "see Data Binding" for pull-quotes, but the data-binding tables cover deliberation/podcast only. Decide: a dedicated Sanity highlight/pull-quote field vs. an explicit extraction rule — so the executor does NOT hardcode the mockup's fixture quotes.
2. **Ember warning-note — encode a concrete value.** The "Below 0.70 threshold — human review flagged" note must NOT be ember body-size text (ember is AA-large-only, 4.19:1). Plan it as `--color-text-dim` at body size + an ember icon/border, so the executor can't accidentally ship failing-contrast body text.
3. **Typography scale breadth — guard against creep.** The editorial scale (~12 size roles, 3 weights/face) is intentionally wider than the SaaS guideline and is approved as art direction. During execution: confirm 9–11px UI sizes never carry body-length copy, and have the confidence count-up (32px) reuse the display-headline token rather than introduce a new size.
</planner_followups>
