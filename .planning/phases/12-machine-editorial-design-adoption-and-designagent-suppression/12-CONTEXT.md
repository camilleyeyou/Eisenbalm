# Phase 12: Machine Editorial Design Adoption + DesignAgent Suppression — Context

**Gathered:** 2026-05-22
**Status:** Ready for UI design contract (UI-SPEC) → planning
**Source:** Conversation + superdesign board "Eisenbalm dispatch" (variant nodes fetched from the board API)

<domain>
## Phase Boundary

Four coupled deliverables, all within the existing dark issue page (Phases 9–11). Do NOT introduce a new palette, new fonts, new deps, or a second `<main>`.

1. **Lock the live web app to the single fixed "Machine Editorial" dark palette (MED-01).** The web app stops applying per-issue DesignAgent `theme` overrides; the fixed house palette wins on every issue. The palette already ships in `globals.css :root`.
2. **Reversible suppression flag (MED-02).** One environment variable that both (a) skips the `design` LangGraph node in the pipeline and (b) makes web ignore per-issue `theme`. Flipping it back restores prior per-issue theming with no code change.
3. **Teach the DesignAgent the aesthetic (MED-03).** Prompt-only: encode the Machine Editorial design language so re-enabled output stays on-brand. Validation/fallback machinery unchanged.
4. **Rebuild `SectionNavigator` + `DeliberationSlot` to chosen board variants (MED-04, MED-05)** at high fidelity, using only FONT_WHITELIST fonts.

Out of scope: changing `theme.ts` security/validation logic, FONT_WHITELIST, the game-sandbox contract, DEL-04, or the 5 Convex subscriptions.

</domain>

<decisions>
## Implementation Decisions

### Fixed palette adoption (MED-01)
- **D-01:** The exact target palette ALREADY lives in `globals.css :root` from Phase 9 — `--color-bg #0C0B0A`, `--color-text #F0EAD9`, `--color-primary #CDA434`, `--color-accent #C2502A`, agent colors `--color-scout #8A9B7A` / `--color-advocate #6E92B8`, `--font-display Cormorant Garamond`, `--font-body Lora`, `--font-ui Inter`. Phase 12 does **not** introduce new palette values — it stops the per-issue `theme` from overriding them.
- **D-02:** When suppression is ON, the web emits **no** per-issue theme CSS override at all — the `globals.css :root` house palette is the sole source of colors + fonts. The light `BRAND_DEFAULTS` in `theme.ts` (`#FAFAF8`/`#1A1A18`/Playfair) must **not** be reintroduced as a `:root` override (it would regress the dark look — quick task `260521-n4l` already stopped the `--color-bg`/`--color-text` override; this phase extends that to `--color-primary`/`--color-accent`/fonts). Researcher/planner decide the cleanest mechanism (no-op the serializer/applier behind the flag vs. align defaults); either way `theme.ts` validation logic (hex regex, FONT_WHITELIST, `setProperty`-only, WCAG-AA) stays byte-unchanged.

### Suppression flag (MED-02)
- **D-03:** Single **environment variable**, one shared name (working name `DESIGNAGENT_SUPPRESSED`) read by both runtimes. Flipped in the Vercel + Railway dashboards — true "no code change." Default for v1 = **ON / suppressed** (site locked to Machine Editorial). `OFF` (or unset → planner picks the safe default; ON is the v1 intent) restores prior per-issue theming.
- **D-04:** Web reads the flag **server-side** in `apps/web/app/issue/[slug]/layout.tsx` and passes the boolean as a prop to `ThemeApplier` (server→client) so no `NEXT_PUBLIC_*` build-time bake is required — flipping needs a redeploy/restart, not a rebuild + code edit. (Planner confirms exact env plumbing.)
- **D-05:** Pipeline reads the flag in `build_graph()` (`graph/builder.py`). When ON: drop `"design"` from the `SECTION_WRITERS` fan-out and skip `builder.add_node("design", design)` + its two edges so the `design` node never runs. `state['theme']` is then simply absent — confirm `validate_sections` / `publisher` tolerate a missing `theme` (web ignores it anyway).
- **D-06:** One switch moves both effects together (suppress agent AND ignore theme). No partial state — the spec's singular "a config flag."

### SectionNavigator rebuild → Vertical Timeline (MED-04)
- **D-07:** Rebuild to the board's **Vertical Timeline** variant (board node #1): central vertical spine, 8 section node-dots, a reading-progress indicator, and a radial cursor-following gold glow.
- **D-08:** Keep the canonical anchor ids (`#origin-story #problem #founder-bio #case-study #game #bonus #deliberation #podcast`) and the existing `CARDS` data + editorial labels. Preserve/extend the magnetic-glow `prefers-reduced-motion` early-return. Machine-readout labels use **Inter + wide uppercase letter-spacing** (NO IBM Plex Mono). ≥44px targets, single `<main>`, WCAG AA.
- **D-09:** Reading-progress binds to scroll position; shows a static/final state instantly under reduced-motion (no JS cursor tracking when reduced-motion is set).

### DeliberationSlot rebuild → Carousel & Flow (MED-05)
- **D-10:** Rebuild to the board's **Carousel & Flow** variant (board node #4): horizontal candidate pitch-log (extends Phase 11's `.pitch-card-list` scroll-snap), winner with luminous glow, a tape-reel confidence meter (extends Phase 11's IntersectionObserver + rAF count-up), and a Scout → Advocate → Editor flow line.
- **D-11:** Preserve the **5 live Convex subscriptions** byte-compatible, **DEL-04** (no model names), and the `AGENT_LABELS` persona names. Confidence meter renders only when a finite `0..1` value is present (Phase 9 behavior). Reduced-motion: count-up shows the final value instantly; no auto-scroll/auto-advance.

### DesignAgent prompt (MED-03)
- **D-12:** **Prompt-only** change in `agents/design/__init__.py` (`_build_messages`). Encode the Machine Editorial language as an **envelope**: lock canvas/text to the warm-near-black + cream feel, steer `fontDisplay → Cormorant Garamond` and `fontBody → Lora`, but allow `primaryColor`/`accentColor` to vary per issue within a dark metallic/ember range (keeps per-issue identity). The 6-field `ThemeOutput`, `_validate_full` (hex + WCAG + whitelist), regenerate-once, and `SAFE_THEME` fallback are **unchanged**. Leave the agent's `FALLBACK_FONT_DISPLAY`/`FALLBACK_FONT_BODY` constants (Playfair Display / Source Serif Pro) as-is for safe regenerate-once-then-fallback semantics — only the system-prompt steering changes.

### Claude's Discretion
- Exact timeline geometry (spine thickness, dot styling, spacing), reading-progress visual, tape-reel meter styling, flow-line rendering, and which `globals.css` tokens to reuse — within the locked constraints.
- The precise flag-plumbing mechanism (no-op serializer/applier vs. align defaults) and how the absent `theme` is tolerated downstream.
- Phrasing of the DesignAgent envelope guidance, as long as it stays prompt-only and within the validation contract.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase requirements & spec
- `.planning/ROADMAP.md` — Phase 12 goal + 6 success criteria.
- `.planning/REQUIREMENTS.md` — MED-01, MED-02, MED-03, MED-04, MED-05.
- `.planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-CONTEXT.md` — the locked Machine Editorial constraints (fonts, no-dep, reduced-motion, security) carried into this phase verbatim.

### Source design (superdesign board)
- Board share link: `https://app.superdesign.dev/share/7d2cb9d17c275d5d9d4cfae3cd7d8cc11cdb69c1c9531bcf5d49258ae2fede88` (client-rendered SPA).
- Board JSON API: `https://api.superdesign.dev/v1/projects/shared/7d2cb9d17c275d5d9d4cfae3cd7d8cc11cdb69c1c9531bcf5d49258ae2fede88` — design variants live in `project.canvasData.nodes`.
- **Chosen navigator variant (node #1 "Section Navigator: Vertical Timeline Edition")** screenshot: `https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/screenshots/drafts/1780c0ca-dab3-4ae9-8bda-8b83c3892c97/1779398124189.png`
- **Chosen deliberation variant (node #4 "Deliberation Carousel & Flow")** screenshot: `https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/screenshots/drafts/3137b022-49a0-40c8-9243-919b901b5e84/1779398160136.png`
- Machine Editorial design-system post-it (board node #7): aesthetic direction + palette + typography intent (the source of the locked palette).

### Web — components to rebuild (MED-04 / MED-05)
- `apps/web/components/issue/SectionNavigator.tsx` — 169-line current 8-card grid; rebuild target → Vertical Timeline. Keep canonical anchor ids + `CARDS`.
- `apps/web/components/issue/DeliberationSlot.tsx` — 641-line current slot; rebuild target → Carousel & Flow. Keep 5 Convex subs + `AGENT_LABELS` + DEL-04.

### Web — theme suppression (MED-01 / MED-02)
- `apps/web/app/issue/[slug]/layout.tsx` — server-side `serializeThemeCss(issue.theme)` inline `<style>` + `<ThemeApplier>`; gate per-issue theme behind the flag here.
- `apps/web/components/issue/ThemeApplier.tsx` — client `applyTheme` on hydration; receives the flag as a prop.
- `apps/web/lib/theme.ts` — `serializeThemeCss`, `applyTheme`, `validateHex/validateFont`, `BRAND_DEFAULTS` (currently the LIGHT palette — do NOT reintroduce as an override), security contract. **Validation logic is READ-ONLY.**
- `apps/web/app/globals.css` — `:root` house palette (already the exact target), `--font-*`, agent colors, reduced-motion guard, print stylesheet, `.section-card`/`.pitch-card-list` motion utilities to reuse.
- `apps/web/components/issue/Atmosphere.tsx` — existing dark atmosphere layer.

### Pipeline — node skip + prompt (MED-02 / MED-03)
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — `SECTION_WRITERS` tuple + `add_node("design", design)` + fan-out/join edges (lines ~70–145); gate the design node behind the flag here.
- `packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` — `_build_messages` system prompt (MED-03 envelope); `ThemeOutput`, `_validate_full`, regenerate-once, SAFE_THEME (UNCHANGED).
- `packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py` — whitelist + `FALLBACK_FONT_DISPLAY/BODY` (leave as-is).

### Tests that must stay green
- `apps/web/__tests__/game-sandbox.test.ts`, `theme-aa-tones.test.ts`, `site-header-nav.test.ts`, `issue-page-typography.test.ts`; `apps/web/lib/theme.test.ts`.
- `packages/pipeline/tests/agents/test_design.py`, `tests/agents/test_stub_fixtures.py`, `tests/test_pipeline_real_mode.py`.
- Build gate: `pnpm --filter web build`; pipeline `pytest` green.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 11 motion primitives** in `globals.css`: `.pitch-card-list` scroll-snap and the IntersectionObserver+rAF count-up meter in `DeliberationSlot.tsx` → directly feed the Carousel & Flow rebuild (pitch log + tape-reel meter).
- **Phase 11 hover-glow** in `SectionNavigator.tsx` (`--mx`/`--my` mousemove + `prefers-reduced-motion` early-return) → reused by the Vertical Timeline's radial cursor glow.
- **`globals.css :root`** already holds the full Machine Editorial palette + agent colors + Cormorant/Lora/Inter — the rebuild and the suppression both lean on it as the single source of truth.
- **Pattern A fan-out** in `builder.py`: each writer mutates a distinct `DispatchState` field with no reducer — removing `"design"` from `SECTION_WRITERS` is a clean, local subtraction.

### Established Patterns
- **Two-layer theme injection** (server inline `<style>` + client `ThemeApplier`) — the flag must gate BOTH layers consistently.
- **`prefers-reduced-motion` early-return** is the house pattern for every motion (count-up shows final value instantly; glow stays centred). Both rebuilds follow it.
- **Source-scan tripwire tests** (`readFileSync` + grep, e.g. `issue-page-typography.test.ts`, `game-sandbox.test.ts`) — expect new tripwires to lock the rebuilds; keep canonical anchor ids and DEL-04 phrasing greppable.
- **Two-name convention** (Python import name vs. config key) is pervasive in the pipeline — keep the design node's identity stable when gating.

### Integration Points
- Web flag enters at `issue/[slug]/layout.tsx` (server) → prop into `ThemeApplier` (client).
- Pipeline flag enters at `build_graph()` (`graph/builder.py`) and conditionally omits the `design` node + edges.
- Both rebuilds are issue-page components mounted under the single root-layout `<main id="main">`.

</code_context>

<specifics>
## Specific Ideas

- **Navigator = Vertical Timeline** (board node #1): central spine, node dots per section, reading-progress, radial gold cursor glow — "high-end machine editorial."
- **Deliberation = Carousel & Flow** (board node #4): horizontal candidate pitch-log, winner luminous glow, animated tape-reel confidence meter, Scout→Advocate→Editor flow line.
- Both were chosen as the **lowest fidelity-risk** options because they extend what Phase 11 already shipped, and they avoid the board's IBM-Plex-Mono-dependent treatments (masonry/brutalist) and the heaviest layouts (isometric/orbital).
- Machine-readout labels everywhere = **Inter + wide uppercase letter-spacing** (the locked approximation of the board's IBM Plex Mono).

</specifics>

<deferred>
## Deferred Ideas

- **Other board variants not chosen this phase:** navigator Masonry (#2) + Isometric 3D (#3); deliberation Orbital/Radial (#5) + Brutalist Schematic (#6). They remain on the board if ever revisited (Brutalist + Masonry + Orbital would need IBM Plex Mono → FONT_WHITELIST governance first).
- **Spectral + IBM Plex Mono fonts** — would require FONT_WHITELIST governance + Andrew/designer sign-off + WeasyPrint PDF check; deferred (approximate with Inter uppercase tracking).
- **GSAP / framer-motion** — deferred in favor of CSS + minimal reduced-motion-safe JS (no new dependency).
- **Per-issue theming as a product feature** — intentionally suppressed for v1; the reversible flag preserves the option without committing to it.

</deferred>

---

*Phase: 12-machine-editorial-design-adoption-and-designagent-suppression*
*Context gathered: 2026-05-22. Phase was mis-numbered 1000 by `phase add` (999.x backlog parsed as max integer); corrected to 12.*
