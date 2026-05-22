# Phase 12: Machine Editorial Design Adoption + DesignAgent Suppression — Research

**Researched:** 2026-05-22
**Domain:** Next.js 14 Server Component env-flag plumbing; LangGraph conditional node exclusion; CSS custom property cascade; React reduced-motion-safe component rebuild
**Confidence:** HIGH — all findings derived directly from reading the live codebase (no inference from stale training data)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Fixed palette ALREADY lives in `globals.css :root`. Phase 12 stops the per-issue `theme` from overriding it — does NOT introduce new palette values.
- **D-02:** When suppression ON: web emits NO per-issue theme CSS override. Light `BRAND_DEFAULTS` (`#FAFAF8`/`#1A1A18`/Playfair) must NOT be reintroduced as override.
- **D-03:** Single env var `DESIGNAGENT_SUPPRESSED`. Flipped in Vercel + Railway dashboards. Default for v1 = ON (suppressed).
- **D-04:** Web reads flag server-side in `apps/web/app/issue/[slug]/layout.tsx`; passes boolean as prop to `ThemeApplier`. No `NEXT_PUBLIC_*` build-time bake. Redeploy/restart triggers flip, no rebuild.
- **D-05:** Pipeline reads flag in `build_graph()` (`graph/builder.py`). When ON: drop `"design"` from `SECTION_WRITERS` fan-out, skip `add_node("design", design)` + its two edges.
- **D-06:** One switch moves both effects together. No partial state.
- **D-07:** SectionNavigator → Vertical Timeline (board node #1): central spine, 8 section node-dots, reading-progress, radial cursor-following gold glow.
- **D-08:** Keep canonical anchor ids. Machine-readout labels use Inter + wide uppercase letter-spacing (no IBM Plex Mono). ≥44px targets, single `<main>`, WCAG AA.
- **D-09:** Reading-progress binds to scroll; static/final state instantly under reduced-motion.
- **D-10:** DeliberationSlot → Carousel & Flow (board node #4): horizontal candidate pitch-log, winner luminous glow, tape-reel confidence meter, Scout→Advocate→Editor flow line.
- **D-11:** Preserve 5 live Convex subscriptions byte-compatible, DEL-04, AGENT_LABELS. Confidence meter renders only when finite 0..1 value present. Reduced-motion: count-up shows final value instantly, no auto-scroll.
- **D-12:** Prompt-only change in `_build_messages`. Lock canvas/text feel, steer fonts to Cormorant Garamond/Lora, allow primary/accent to vary in dark metallic/ember range. 6-field ThemeOutput, `_validate_full`, regenerate-once, SAFE_THEME unchanged. FALLBACK_FONT_* constants unchanged.

### Claude's Discretion

- Exact timeline geometry (spine thickness, dot styling, spacing), reading-progress visual, tape-reel meter styling, flow-line rendering, which `globals.css` tokens to reuse — within locked constraints.
- Precise flag-plumbing mechanism (no-op serializer/applier vs. align defaults) and how absent `theme` is tolerated downstream.
- Phrasing of the DesignAgent envelope guidance, as long as it stays prompt-only and within the validation contract.

### Deferred Ideas (OUT OF SCOPE)

- Other board variants not chosen: navigator Masonry (#2) + Isometric 3D (#3); deliberation Orbital/Radial (#5) + Brutalist Schematic (#6).
- Spectral + IBM Plex Mono fonts.
- GSAP / framer-motion.
- Per-issue theming as a product feature.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MED-01 | Live site renders fixed Machine Editorial dark palette; web no longer applies per-issue DesignAgent `theme` overrides; `theme.ts` FONT_WHITELIST + hex/setProperty/WCAG unchanged | Mechanism: gate `serializeThemeCss` + `applyTheme` calls in layout.tsx + ThemeApplier at the env-flag level. Both are already isolated call sites. `theme.ts` is read-only. |
| MED-02 | Reversible config flag skips `design` LangGraph node in pipeline and makes web ignore per-issue `theme`; flipping back restores prior behavior with no code change | Pipeline: drop `"design"` from `SECTION_WRITERS` tuple + its two `add_edge` calls in `build_graph()` behind `os.environ.get("DESIGNAGENT_SUPPRESSED")`. Web: server env read in `layout.tsx` (Server Component, plain `process.env`), passed as prop to `ThemeApplier`. |
| MED-03 | DesignAgent system prompt encodes Machine Editorial language; existing 6-field ThemeOutput, hex/font/WCAG validation, regenerate-once, SAFE_THEME fallback unchanged | `_build_messages()` is the only prompt assembly site. Validation, fallback, Pydantic model, `_validate_full`, `FALLBACK_FONT_*` all untouched. Test assertions are on validation behavior, not prompt text. |
| MED-04 | `SectionNavigator` rebuilt to Vertical Timeline at high fidelity; FONT_WHITELIST only; reduced-motion-safe; ≥44px targets; single `<main>`; WCAG AA | Full spec in 12-UI-SPEC.md. CSS classes pre-drafted in UI-SPEC globals.css extension block. Existing `--mx`/`--my` pattern preserved. `CARDS` data extended with `subtitle?` and `italicWord?`. |
| MED-05 | `DeliberationSlot` rebuilt to Carousel & Flow; DEL-04 and 5 Convex subs intact; reduced-motion-safe | All 5 `useQuery` calls, `AGENT_LABELS` map, `confidenceSectionRef`/`animatedRef`/`displayValue` state pattern, `prefersReducedMotion` module-scope check all preserved byte-compatible. New flow-line Zone 2 is additive. |
</phase_requirements>

---

## Summary

Phase 12 has four coupled deliverables. The critical technical unknowns are now resolved by direct codebase inspection:

**MED-01/MED-02 (theme suppression):** The current `layout.tsx` is a 79-line Server Component. It calls `serializeThemeCss(theme)` for Layer 1 (inline `<style>`) and passes `theme` to `<ThemeApplier>` for Layer 2. The cleanest gate is: read `process.env.DESIGNAGENT_SUPPRESSED` in `layout.tsx` (Server Component — plain `process.env` works server-side without `NEXT_PUBLIC_`); if truthy, skip the Sanity theme fetch entirely and pass `theme = null` (or a sentinel) to both `serializeThemeCss` and `ThemeApplier`. The key insight: `serializeThemeCss(null)` currently resolves to `BRAND_DEFAULTS` (the LIGHT palette — `#FAFAF8`/`#1A1A18`/Playfair). That is the pitfall to avoid. The correct no-op when suppressed is to return an EMPTY CSS string `""` (no override at all), so `globals.css :root` wins the cascade. The `ThemeApplier` must similarly skip `applyTheme` entirely when suppressed.

**MED-02 (pipeline node skip):** `builder.py` is 149 lines. `SECTION_WRITERS` is a `tuple[str, ...]` declared at module level (line 71). The `for writer in SECTION_WRITERS: add_edge(...)` loop already handles fan-out and fan-in atomically. Removing `"design"` from the tuple is the complete fan-out change; the corresponding `builder.add_node("design", design)` call must also be conditioned. The `design` import at the top can remain (it does not execute the agent — it imports the function). `validate_sections.REQUIRED_FIELDS` includes `"theme"` and will fail if design is suppressed and `state['theme']` is absent. This MUST be updated alongside `SECTION_WRITERS`.

**MED-03 (DesignAgent prompt):** `_build_messages()` is a pure function at lines 83-125. It constructs a two-message list. Adding the Machine Editorial envelope requires inserting 4-6 additional lines into the `system` string. Nothing else in the file is touched. `test_design.py` assertions are on validation behavior (`_validate_full`, `SAFE_THEME`, `qaCorrections`), not on prompt text content — prompt changes are invisible to existing tests.

**MED-04/MED-05 (component rebuilds):** The UI-SPEC in `12-UI-SPEC.md` is comprehensive and pre-approved. The CSS class definitions are provided verbatim. The component rebuilds are surgical replacements of JSX/CSS with data bindings preserved.

**Primary recommendation:** Gate suppression in `layout.tsx` by returning `""` from a `suppressedThemeCss()` helper (not calling `serializeThemeCss` at all) and passing `suppressed={true}` to `ThemeApplier` which early-returns. Gate pipeline by removing `"design"` from `SECTION_WRITERS` and updating `REQUIRED_FIELDS` in `validate_sections` under the same flag. This keeps all mutation inside two isolated files.

---

## Standard Stack

### Core (all already present — no new installs)

| Library/API | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| Next.js App Router Server Components | 14+ | `process.env` server-side read | Server Components read `process.env` directly; no `NEXT_PUBLIC_` required |
| React `useEffect` + `IntersectionObserver` | 18 | scroll-driven reading progress, confidence count-up | No new dep; established Phase 11 pattern |
| CSS custom properties + `color-mix()` | Native | Token cascade, glow derivations | Already in `globals.css` |
| LangGraph `StateGraph` | already pinned | Conditional node exclusion | `add_node` / `add_edge` are conditional; `SECTION_WRITERS` tuple controls fan-out |
| `os.environ.get()` | Python stdlib | Pipeline env read | Standard Python; no new dep |

### Supporting

| Library/API | Version | Purpose | When to Use |
|-------------|---------|---------|-------------|
| `prefersReducedMotion` module-scope check | existing in `DeliberationSlot.tsx` | Reduced-motion gate | Already established; preserve verbatim |
| `useRef` + `animatedRef` | existing | One-shot IntersectionObserver guard | Already in Phase 11 pattern; preserve |

---

## Architecture Patterns

### Pattern 1: Env-Flag Gate in Server Component (MED-01/MED-02 Web)

**What:** Read `process.env.DESIGNAGENT_SUPPRESSED` in the `IssueLayout` Server Component. When truthy, skip the Sanity theme fetch and emit no theme override. Pass the suppression boolean as a prop to `ThemeApplier`.

**Critical detail:** `process.env` in a Server Component is read at request-time (not build-time). Changing the env var and redeploying (Vercel) or restarting (Railway) takes effect without a rebuild. No `NEXT_PUBLIC_*` is needed and must NOT be used (it would bake the value at build time).

**Gate location:** Layout.tsx — two call sites to gate:
1. `serializeThemeCss(theme)` → when suppressed, substitute an empty string `""` (not `serializeThemeCss(null)` — that emits `BRAND_DEFAULTS` light palette, which is wrong).
2. `<ThemeApplier theme={theme} />` → add `suppressed` prop; when `suppressed`, `ThemeApplier.useEffect` early-returns without calling `applyTheme`.

**Why NOT gate inside `serializeThemeCss`:** `theme.ts` is READ-ONLY. Validation logic must not be touched.

**Pattern:**
```typescript
// In IssueLayout (Server Component):
const suppressed = process.env.DESIGNAGENT_SUPPRESSED === 'true'
const themeCss = suppressed ? '' : serializeThemeCss(theme)

// <style> tag: dangerouslySetInnerHTML={{ __html: themeCss }}
// ThemeApplier receives suppressed={suppressed}
```

```typescript
// ThemeApplier:
export function ThemeApplier({ theme, suppressed }: ThemeApplierProps) {
  useEffect(() => {
    if (suppressed) return   // globals.css :root wins; no override
    applyTheme(document.documentElement, theme)
  }, [theme, suppressed])
  return null
}
```

### Pattern 2: Conditional LangGraph Node (MED-02 Pipeline)

**What:** In `build_graph()`, read the env flag before building the graph. When suppressed, exclude `"design"` from `SECTION_WRITERS` tuple AND skip the `add_node("design", design)` call AND its two edges (`verify_research → design`, `design → validate_sections`).

**Critical detail:** `validate_sections.REQUIRED_FIELDS` currently includes `"theme"`. When `design` is suppressed, `state['theme']` is absent — `validate_sections` will halt the graph with `partial-failure: missing sections ['theme']`. The REQUIRED_FIELDS tuple MUST be updated alongside `SECTION_WRITERS` to remove `"theme"` when suppressed. Two approaches:

**Option A (simpler, recommended):** Make `REQUIRED_FIELDS` in `validate_sections.py` drop `"theme"` when suppressed — read the same env var there.

**Option B:** Pass the suppression state through `DispatchState`. Not recommended — adds coupling.

**Pattern (builder.py):**
```python
import os

_SUPPRESSED = os.environ.get("DESIGNAGENT_SUPPRESSED", "").lower() in ("1", "true", "yes")

SECTION_WRITERS: tuple[str, ...] = (
    "origin_story",
    "problem",
    "founder_bio",
    "case_study",
    "game",
    "bonus",
    *([] if _SUPPRESSED else ["design"]),
)

def build_graph(checkpointer):
    builder = StateGraph(DispatchState)
    # ... other nodes ...
    if not _SUPPRESSED:
        builder.add_node("design", design)
    # ... fan-out loop handles SECTION_WRITERS automatically ...
```

**Pattern (validate.py):**
```python
import os

_SUPPRESSED = os.environ.get("DESIGNAGENT_SUPPRESSED", "").lower() in ("1", "true", "yes")

REQUIRED_FIELDS: tuple[str, ...] = (
    "origin_story",
    "problem_statement",
    "founder_bio",
    "case_study",
    "game",
    "bonus",
    *([] if _SUPPRESSED else ["theme"]),
)
```

**Publisher and web:** When `state['theme']` is absent or None, the publisher's `write_issue_draft` call will write `theme: null` to Sanity (or omit it) — the web side is already suppressed, so this is safe. No additional downstream changes needed.

### Pattern 3: DesignAgent Prompt Envelope (MED-03)

**What:** Edit only the `system` string in `_build_messages()`. Add Machine Editorial aesthetic constraints as an authoritative design brief section.

**What stays byte-unchanged:** `ThemeOutput` Pydantic, `_validate_full`, `FALLBACK_FONT_*`, `SAFE_THEME`, the retry logic, the `qaCorrections` write path. The only change is prose in the `system` string.

**Envelope content to encode:**
- Lock `backgroundColor` near `#0C0B0A` (warm near-black canvas) and `textColor` near `#F0EAD9` (warm cream) — tight range.
- Steer `fontDisplay` → Cormorant Garamond, `fontBody` → Lora as the first-choice recommendation.
- Allow `primaryColor` and `accentColor` to vary per issue within a dark metallic/ember range (e.g. gold/copper/ochre for primary, ember/terracotta/rust for accent) — this is the per-issue identity.
- Remind the agent that WCAG-AA (4.5:1 contrast between backgroundColor and textColor) is validated programmatically.
- Keep the existing font whitelist reference.

### Pattern 4: Vertical Timeline (SectionNavigator — MED-04)

**What:** Replace the 4-column `.section-cards` grid JSX with a `.snw-timeline` vertical list. Extend `SectionCard` interface with `subtitle?: string` and `italicWord?: string`. Add IntersectionObserver reading-progress tracking.

**What is preserved byte-for-byte:**
- The `useEffect` reduced-motion early-return guard (lines 95-100 of current SectionNavigator.tsx).
- The `--mx`/`--my` mousemove pattern (the handler loop, lines 106-128).
- All 8 `CARDS` entries with their `href` values (canonical anchor ids).

**New JS additions:**
- A second `useEffect` for reading-progress: `IntersectionObserver` on each section anchor (`#origin-story`, `#problem`, etc.). When a section enters the viewport, mark its row's node-dot `.active`. A `scroll` event listener or IntersectionObserver tracks overall scroll fraction for the spine fill.
- The spine fill height is set via `element.style.setProperty('--spine-progress', `${fraction * 100}%`)` and the `.snw-spine-progress` `::after` uses `height: var(--spine-progress, 0%)`.
- Under `prefers-reduced-motion`: the reading-progress observer still fires and sets state, but CSS transitions are globally neutralized to `0.01ms` by the existing globals.css guard — no additional JS bypass needed for the spine.

**Data additions to CARDS:**
```typescript
interface SectionCard {
  href: string
  number: string
  title: string
  tag: string
  subtitle?: string     // new — editorial tagline per UI-SPEC Copywriting
  italicWord?: string   // new — which title word gets <em>; if absent, render plain
  wide?: boolean        // existing — can be kept or dropped (no grid)
  feature?: boolean     // existing — can be kept or dropped (no grid)
}
```

The 8 subtitle + italicWord values are defined in the UI-SPEC Copywriting Contract and are ready to copy in.

### Pattern 5: Carousel & Flow (DeliberationSlot — MED-05)

**What:** Replace the `lg:grid-cols-[1fr_1fr]` two-column layout with a three-zone vertical stack. Restyle pitch card interiors. Add the Scout→Advocate→Editor flow-line (Zone 2). Move the confidence meter below the flow line.

**What is preserved byte-for-byte:**
- Lines 104-111: all 5 `useQuery` calls with `runId ? {...} : 'skip'` pattern.
- Lines 33-49: `AGENT_LABELS` map (all 15 entries).
- Lines 63-67: `QA_SEVERITY` map.
- Lines 96-98: `prefersReducedMotion` module-scope declaration.
- Lines 199-232: `confidenceSectionRef`, `displayValue`, `animatedRef` state + `useEffect` for count-up — preserved byte-identical.
- The `editorConfidence !== null` guard for the confidence meter.
- The `prefersReducedMotion ? setDisplayValue(target) : observer...` path.
- Lines 250-269: The `<details>/<summary>` accordion with `min-height: 44px`.
- DEL-04: `AGENT_LABELS` never exposes model names.

**Visual changes only:**
- Pitch card interior: `border-radius: 4px` (not `rounded`), left border `3px solid var(--color-primary)` when selected (existing behavior), add `box-shadow` glow when selected per UI-SPEC spec.
- Scout summary: change from `text-[14px]` to `text-[15px]` (Body token).
- Charity name: change from `text-[17px] font-medium` to `text-[15px] font-semibold` (Body size, weight 600).
- Winner card `box-shadow`: `0 0 32px color-mix(in srgb, var(--color-primary) 28%, transparent), 0 0 0 1px color-mix(in srgb, var(--color-primary) 18%, transparent)`.
- Confidence bar height: `h-1.5` (6px) → 8px tall bar (`del-confidence-bar-track` class from UI-SPEC CSS).
- Confidence value: preserve `text-[32px]` (maps to Display token `clamp(32px,3.5vw,48px)` — use the CSS class from globals.css rather than inline Tailwind for the clamp behavior).
- Add flow-line Zone 2 between pitch log and QA — rendered only when `pitchLog`, `editorWinner`, or `editorConfidence` is present.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Server env read in Next.js | `NEXT_PUBLIC_` env or custom fetch | `process.env.DESIGNAGENT_SUPPRESSED` in Server Component | Server Components read env at request-time natively; no build-time baking |
| Reading-progress calculation | Complex scroll library | `IntersectionObserver` per section anchor + optional `scrollY / scrollHeight` | Already established Phase 11 pattern; zero deps |
| Confidence count-up animation | Third-party counter lib | `rAF + IntersectionObserver` pattern already in `DeliberationSlot.tsx` lines 199-232 | Proven, reduced-motion-safe, no dep |
| Cursor-following glow | GSAP or animation library | `--mx`/`--my` mousemove CSS var pattern already in `SectionNavigator.tsx` lines 106-128 | Existing, no dep, reduced-motion-safe |
| Conditional LangGraph node | `conditional_edges` / `Send` API | Simple `if not suppressed: builder.add_node(...)` + conditional `SECTION_WRITERS` tuple | Pattern A fan-out is already plain `add_edge`; no routing logic needed |
| CSS glow effect | External grain SVG / external resource | `color-mix(in srgb, var(--color-primary) 40%, transparent)` + `radial-gradient` | Already in `globals.css :root` as `--color-primary-glow` |

---

## Runtime State Inventory

> Not applicable — this is a code/config/UI phase. No renames, no data migrations, no stored strings being changed.

**Stored data:** None — no Convex/Sanity field names change. `state['theme']` may be absent in new pipeline runs when suppressed; Sanity draft will have `theme: null` or omit the field. The web ignores it when suppressed. No migration of existing records needed.

**Live service config:** `DESIGNAGENT_SUPPRESSED` env var set in Vercel + Railway dashboards. No existing var with this name — new addition, no collision risk.

**OS-registered state:** None.

**Secrets/env vars:** `DESIGNAGENT_SUPPRESSED` — new, no secrets involved, plain string `"true"`.

**Build artifacts:** None — no package installs, no generated files.

---

## Common Pitfalls

### Pitfall 1: `serializeThemeCss(null)` emits the LIGHT BRAND_DEFAULTS palette

**What goes wrong:** Passing `null` to `serializeThemeCss` when suppressed returns `':root { --color-accent: #8B1A1A; --color-primary: #2D5016; --font-body: \'Lora\', serif; --font-display: \'Playfair Display\', serif; }'` — the light, forest-green palette from `BRAND_DEFAULTS`. This REGRESSES the dark house look (Phase 9/11 already fought this battle via quick task `260521-n4l`).

**Root cause:** `resolvePalette(null)` falls through to `BRAND_DEFAULTS` for all fields. `serializeThemeCss` is meant to always produce a CSS string — it has no "emit nothing" mode.

**How to avoid:** When suppressed, bypass `serializeThemeCss` entirely. Pass `''` (empty string) as `themeCss`. The `<style dangerouslySetInnerHTML={{ __html: '' }} />` tag is harmless. `globals.css :root` cascade wins undisturbed.

**Warning signs:** Dark background turns off-white on issue pages after deploying the flag. Check for any non-empty inline `<style>` in the issue page HTML head.

### Pitfall 2: `validate_sections` halts with `partial-failure: missing sections ['theme']`

**What goes wrong:** `REQUIRED_FIELDS` in `validate.py` includes `"theme"`. When `design` is dropped from `SECTION_WRITERS`, `state['theme']` is never populated. `validate_sections` raises `RuntimeError("partial-failure: missing sections ['theme']")` and the graph halts, updating Convex status to `failed`. Every pipeline run fails silently.

**Root cause:** `REQUIRED_FIELDS` and `SECTION_WRITERS` are independently maintained in two files with the same implicit set of values. Removing `"design"` from one without updating the other leaves them inconsistent.

**How to avoid:** Apply the same env-flag check in `validate.py`. Use the same truthiness logic (`os.environ.get("DESIGNAGENT_SUPPRESSED", "").lower() in ("1", "true", "yes")`). Tuple comprehension syntax: `*([] if _SUPPRESSED else ["theme"])`.

**Warning signs:** Pipeline runs succeed up to `validate_sections` then emit `status='failed'` with `errorMessage: 'partial-failure: missing sections [\'theme\']'`.

### Pitfall 3: `test_full_graph_runs_to_publisher` fails on `theme.primaryColor` assertion

**What goes wrong:** `test_pipeline_real_mode.py` line 468 asserts `result.get("theme", {}).get("primaryColor")`. If `design` is excluded but the test does not set `DESIGNAGENT_SUPPRESSED=true`, the patched graph still expects `design` to run (it's in the mock setup at line 367 which patches `eisenbalm_pipeline.agents.design.convex_mutation_safe`). The test will fail because `theme` is absent.

**Root cause:** The test's `_mock_acomplete` handles `ThemeOutput` (line 261) — this mock only fires if the design agent node is in the graph. When `_SUPPRESSED` is set at module import time but the test doesn't set the env var, the graph compiled at test-start includes `design`. If the env var IS set, the graph excludes `design` but the assertion at line 468 fails.

**How to avoid:** The executor must add a complementary test case: when `DESIGNAGENT_SUPPRESSED=true`, the graph must complete without `theme` in state and without the `theme.primaryColor` assertion. The existing test remains unchanged (it runs with suppression OFF, the default for test env). Add a second test parametrized with `monkeypatch.setenv("DESIGNAGENT_SUPPRESSED", "true")` that asserts `result.get("theme") is None` and that `validate_sections` does NOT raise.

**Warning signs:** `test_full_graph_runs_to_publisher` fails with `AssertionError: missing theme.primaryColor` after flag work.

### Pitfall 4: `prefersReducedMotion` declared module-scope — SSR hydration mismatch

**What goes wrong:** `DeliberationSlot.tsx` line 96-98 reads `window.matchMedia(...)` at module scope (outside a hook). This is intentional (Phase 11 decision, noted in STATE.md) and works because `'use client'` + the `typeof window !== 'undefined'` guard makes it safe — it returns `false` during SSR. The new SectionNavigator.tsx uses the same pattern (reading it inside `useEffect` from `window.matchMedia(...)` in the existing code, line 95). Preserve this exact guard.

**How to avoid:** In the rebuilt SectionNavigator, keep the `prefersReducedMotion` check inside `useEffect` (not module-scope) — consistent with Phase 11 SectionNavigator behavior. In DeliberationSlot, the module-scope pattern is already established and must be preserved.

### Pitfall 5: Reading-progress IntersectionObserver conflicts with the existing glow useEffect

**What goes wrong:** The rebuilt SectionNavigator will have two `useEffect` hooks: one for the mousemove glow (existing) and one for reading-progress (new). Both attach listeners to the nav element. If cleanup is mishandled, the reading-progress observer may fire after unmount, causing React state-update-on-unmounted-component warnings.

**How to avoid:** Return the observer disconnect from the reading-progress `useEffect`. Pattern: `return () => observer.disconnect()`. Mirror the cleanup pattern already present in `DeliberationSlot.tsx` lines 230-231.

### Pitfall 6: The `NEXT_PUBLIC_` trap for the suppression flag

**What goes wrong:** If the developer adds `NEXT_PUBLIC_DESIGNAGENT_SUPPRESSED` instead of `DESIGNAGENT_SUPPRESSED`, the value is baked into the JS bundle at build time. Flipping it in Vercel dashboard does NOT take effect without a rebuild — violating D-04.

**How to avoid:** The variable name must NOT start with `NEXT_PUBLIC_`. `process.env.DESIGNAGENT_SUPPRESSED` is only accessible in Server Components and API routes. The layout.tsx is a Server Component (no `'use client'` directive) — this is correct. Do not pass this value via React context or client props chain beyond `ThemeApplier`.

### Pitfall 7: New source-scan tripwire tests missing from Wave 0

**What goes wrong:** The UI-SPEC specifies 4 new source-scan tripwire tests (canonical anchor ids, `AGENT_LABELS` presence, model-name absence, `prefers-reduced-motion` early-return). If these are not added in Wave 0, the executor may rebuild the components correctly but leave the tripwire coverage gap — future edits could regress silently.

**How to avoid:** Wave 0 must include a new test file (e.g., `apps/web/__tests__/machine-editorial-components.test.ts`) with all 4 assertions. Pattern is `readFileSync + .toContain / .not.toContain` — identical to `game-sandbox.test.ts` and `issue-page-typography.test.ts`.

---

## Code Examples

### ENV flag read in Server Component (MED-02 web)

```typescript
// apps/web/app/issue/[slug]/layout.tsx (Server Component, no 'use client')
// process.env is available at request-time in Next.js Server Components.
// NEVER use NEXT_PUBLIC_ — that bakes at build time (Pitfall 6).
const suppressed = process.env.DESIGNAGENT_SUPPRESSED === 'true'

// When suppressed: emit empty string — globals.css :root wins undisturbed.
// When NOT suppressed: serializeThemeCss validates and emits per-issue override.
const themeCss = suppressed ? '' : serializeThemeCss(theme)
```

### ThemeApplier with suppressed prop (MED-02 web)

```typescript
// apps/web/components/issue/ThemeApplier.tsx
interface ThemeApplierProps {
  theme: IssueTheme
  suppressed?: boolean
}

export function ThemeApplier({ theme, suppressed }: ThemeApplierProps) {
  useEffect(() => {
    if (suppressed) return  // globals.css :root wins; setProperty not called
    applyTheme(document.documentElement, theme)
  }, [theme, suppressed])
  return null
}
```

### SECTION_WRITERS conditional exclusion (MED-02 pipeline)

```python
# packages/pipeline/src/eisenbalm_pipeline/graph/builder.py
import os

_SUPPRESSED = os.environ.get("DESIGNAGENT_SUPPRESSED", "").lower() in ("1", "true", "yes")

SECTION_WRITERS: tuple[str, ...] = (
    "origin_story",
    "problem",
    "founder_bio",
    "case_study",
    "game",
    "bonus",
    *(() if _SUPPRESSED else ("design",)),
)
```

### REQUIRED_FIELDS parallel update (MED-02 pipeline)

```python
# packages/pipeline/src/eisenbalm_pipeline/agents/validate.py
import os

_SUPPRESSED = os.environ.get("DESIGNAGENT_SUPPRESSED", "").lower() in ("1", "true", "yes")

REQUIRED_FIELDS: tuple[str, ...] = (
    "origin_story",
    "problem_statement",
    "founder_bio",
    "case_study",
    "game",
    "bonus",
    *(() if _SUPPRESSED else ("theme",)),
)
```

### DesignAgent prompt envelope addition (MED-03)

```python
# In _build_messages(), extend the system string:
system = (
    "You are the DesignAgent for The Eisenbalm Dispatch.\n\n"
    "AESTHETIC ENVELOPE (Machine Editorial):\n"
    "  backgroundColor: near-black warm canvas. Target range: #0A0908–#1A1511. "
    "Do NOT use white, light grey, or pastels for backgroundColor.\n"
    "  textColor: warm cream. Target range: #E8E0CE–#F5EFE0. "
    "Ensure ≥4.5:1 WCAG-AA contrast with your backgroundColor.\n"
    "  fontDisplay: strongly prefer Cormorant Garamond.\n"
    "  fontBody: strongly prefer Lora.\n"
    "  primaryColor + accentColor: vary per issue within dark metallic/ember register "
    "(gold, copper, ochre for primary; ember, terracotta, rust for accent). "
    "These are the per-issue identity variables. They will not be used as body text.\n\n"
    "Output exactly four six-digit hex colors and two font names. "
    "You will not invent a font. WCAG-AA contrast is a precondition, not a polish step.\n\n"
    f"fontDisplay must be one of: {display_list}\n"
    f"fontBody must be one of: {body_list}\n\n"
    "WCAG-AA: contrast ratio between backgroundColor and textColor "
    ">= 4.5:1. Your choices will be validated programmatically; a "
    "second failure forces a hardcoded fallback."
)
```

### Reading-progress IntersectionObserver skeleton (MED-04)

```typescript
// Second useEffect in rebuilt SectionNavigator:
useEffect(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Reading-progress still fires under reduced-motion (it sets state),
  // but CSS transitions are 0.01ms globally so there is no animation.
  
  const sectionIds = CARDS.map(c => c.href.slice(1)) // strip '#'
  const nodeMap = new Map<string, HTMLElement>()     // sectionId → row el
  
  // populate nodeMap from navRef...
  
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id)
        }
      }
    },
    { threshold: 0.3 },
  )
  
  for (const id of sectionIds) {
    const el = document.getElementById(id)
    if (el) observer.observe(el)
  }
  
  return () => observer.disconnect()
}, [])
```

### New tripwire test pattern (4 assertions — MED-04/MED-05)

```typescript
// apps/web/__tests__/machine-editorial-components.test.ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const NAV_PATH = resolve(__dirname, '../components/issue/SectionNavigator.tsx')
const DEL_PATH = resolve(__dirname, '../components/issue/DeliberationSlot.tsx')

describe('MED-04: SectionNavigator Vertical Timeline tripwires', () => {
  const navSrc = readFileSync(NAV_PATH, 'utf-8')
  
  it('canonical anchor ids present', () => {
    for (const id of ['#origin-story','#problem','#founder-bio','#case-study','#game','#bonus','#deliberation','#podcast']) {
      expect(navSrc).toContain(id)
    }
  })
  
  it('prefers-reduced-motion early-return present', () => {
    expect(navSrc).toContain('prefers-reduced-motion')
  })
})

describe('MED-05: DeliberationSlot tripwires (DEL-04)', () => {
  const delSrc = readFileSync(DEL_PATH, 'utf-8')
  
  it('AGENT_LABELS still present', () => {
    expect(delSrc).toContain('AGENT_LABELS')
  })
  
  it('no model names exposed', () => {
    for (const forbidden of ['model', 'claude', 'gpt', 'anthropic']) {
      // Case-insensitive check on lowercase source
      expect(delSrc.toLowerCase()).not.toMatch(
        new RegExp(`(?<!_)\\b${forbidden}\\b`)
      )
    }
  })
})
```

Note on the model-name check: The `AGENT_LABELS` map contains `'design': { displayName: 'The Designer', ... }` — verify the regex does not false-positive on `displayName`, `role`, or other legitimate strings. Use a negative-lookbehind or test against a code-only stripped version.

---

## State of the Art

| Old Approach | Current Approach | Changed | Impact for Phase 12 |
|---|---|---|---|
| `serializeThemeCss` always emits `:root {...}` | Same — but Phase 12 gates it | Quick task 260521-n4l already stopped --color-bg/--color-text override | Phase 12 extends: also suppress --color-primary/--color-accent/fonts by emitting nothing |
| `SECTION_WRITERS` is a fixed tuple | Becomes conditionally shorter | Phase 12 new | validate_sections.REQUIRED_FIELDS must track atomically |
| DesignAgent prompt has no aesthetic envelope | Gets Machine Editorial direction | Phase 12 new | Prompt-only; validation/fallback machinery frozen |
| SectionNavigator is a 4-column card grid | Vertical Timeline | Phase 12 new | All Phase 11 motion primitives reused |
| DeliberationSlot is a 2-column grid | Vertical 3-zone stack | Phase 12 new | All 5 Convex subs + confidence meter rAF preserved |

---

## Open Questions

1. **Model-name tripwire false-positive risk**
   - What we know: `AGENT_LABELS` in `DeliberationSlot.tsx` contains strings like `'The Designer'`, `'The Calibrator'` — none contain "claude", "gpt", "model", "anthropic".
   - What's unclear: The word "model" appears in `ThemeOutput` import comment and `model_versions` variable name in other files but DeliberationSlot.tsx doesn't import those. Need to verify the rebuilt file contains no incidental "model" occurrence.
   - Recommendation: Run the tripwire regex against the existing `DeliberationSlot.tsx` before writing the new one to confirm it would pass. The existing file has `// SECURITY: never read run.cost (it contains the model-version map)` in a comment — "model" appears there. Use `codeOnly()` comment-stripping helper from `issue-page-typography.test.ts` before checking.

2. **`suppressed` prop TypeScript interface propagation**
   - What we know: `ThemeApplier` currently has `interface ThemeApplierProps { theme: IssueTheme }`. Adding `suppressed?: boolean` is a one-line interface change.
   - What's unclear: Whether any other callsite passes `<ThemeApplier>` without the new prop. Search confirms the layout.tsx is the only caller.
   - Recommendation: Add `suppressed?: boolean` (optional with `?`) so existing tests/callers don't need updating.

3. **`pnpm --filter web build` type-check on empty `themeCss` string**
   - What we know: `<style dangerouslySetInnerHTML={{ __html: '' }} />` is valid React/TypeScript.
   - What's unclear: Whether Next.js has any special handling for empty inline styles that might warn.
   - Recommendation: Emit `<style dangerouslySetInnerHTML={{ __html: themeCss }} />` unconditionally — when `themeCss === ''`, the style element renders but injects nothing. This is the safest approach.

---

## Environment Availability

> Step 2.6: SKIPPED for most of this phase (no new external dependencies). All tools, runtimes, and services are already provisioned from Phases 1-11.

The only "new" environment concern is the `DESIGNAGENT_SUPPRESSED` env var itself — it must be set to `"true"` in both:
- **Vercel** dashboard (apps/web) — affects the Next.js Server Component read.
- **Railway** dashboard (packages/pipeline) — affects the LangGraph graph compilation.

For local development, add `DESIGNAGENT_SUPPRESSED=true` to `.env.local` (web) and `.env` / shell (pipeline).

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (web) | Vitest 3.x (`apps/web/vitest.config.ts`) |
| Framework (pipeline) | pytest (`packages/pipeline/`) |
| Quick run (web) | `pnpm --filter web test:unit` |
| Full suite (web) | `pnpm --filter web test:unit && pnpm --filter web build` |
| Full suite (pipeline) | `cd packages/pipeline && pytest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MED-01 | No per-issue theme override emitted when suppressed | unit | `pnpm --filter web test:unit -- theme` | Partially: `theme.test.ts` (theme.ts logic) — new test for suppression behavior needed |
| MED-02 (web) | `ThemeApplier` early-returns when `suppressed=true` | unit | `pnpm --filter web test:unit` | Wave 0 gap |
| MED-02 (pipeline) | `build_graph` excludes `design` node when `DESIGNAGENT_SUPPRESSED=true` | unit | `cd packages/pipeline && pytest tests/test_pipeline_real_mode.py` | Partially: existing test covers non-suppressed; suppressed case is Wave 0 gap |
| MED-02 (pipeline) | `validate_sections` does not require `theme` when suppressed | unit | `cd packages/pipeline && pytest tests/agents/test_validate.py` | Wave 0 gap (test_validate.py likely exists; check) |
| MED-03 | `_build_messages` prompt includes Machine Editorial envelope text | source-scan | `cd packages/pipeline && pytest tests/agents/test_design.py` | Partially: existing test doesn't assert prompt text — add one assertion checking envelope key phrase |
| MED-04 | Canonical anchor ids in rebuilt SectionNavigator.tsx | source-scan | `pnpm --filter web test:unit` | Wave 0 gap — new test file needed |
| MED-04 | `prefers-reduced-motion` early-return in SectionNavigator.tsx | source-scan | `pnpm --filter web test:unit` | Wave 0 gap — same new test file |
| MED-05 | `AGENT_LABELS` present in rebuilt DeliberationSlot.tsx | source-scan | `pnpm --filter web test:unit` | Wave 0 gap — same new test file |
| MED-05 | No model names in rebuilt DeliberationSlot.tsx | source-scan | `pnpm --filter web test:unit` | Wave 0 gap — same new test file |

### Sampling Rate

- **Per task commit:** `pnpm --filter web test:unit` (web tasks) or `cd packages/pipeline && pytest` (pipeline tasks)
- **Per wave merge:** `pnpm --filter web test:unit && pnpm --filter web build`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/__tests__/machine-editorial-components.test.ts` — 4 source-scan tripwires (MED-04/MED-05)
- [ ] Add `test_design_suppressed` test case in `test_pipeline_real_mode.py` — graph completes without `theme` when `DESIGNAGENT_SUPPRESSED=true`
- [ ] Verify `tests/agents/test_validate.py` exists and add suppressed-mode assertion; if missing, create it
- [ ] One assertion in `test_design.py` checking that `_build_messages` output contains the Machine Editorial envelope phrase (optional but validates MED-03)

*(If `tests/agents/test_validate.py` already exists with suppression-mode coverage, mark that gap closed.)*

---

## Sources

### Primary (HIGH confidence — direct codebase reads)

- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — full 149-line builder; `SECTION_WRITERS` tuple at line 71; fan-out loop lines 135-137; confirms Pattern A plain multi-target edges
- `packages/pipeline/src/eisenbalm_pipeline/agents/validate.py` — `REQUIRED_FIELDS` at line 23 includes `"theme"`; confirmed this MUST be updated alongside `SECTION_WRITERS`
- `packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` — `_build_messages` at lines 83-125; `ThemeOutput`, `_validate_full`, regenerate-once, `SAFE_THEME`, `FALLBACK_FONT_*` all confirmed unchanged scope
- `apps/web/app/issue/[slug]/layout.tsx` — 79-line Server Component; both `serializeThemeCss` and `ThemeApplier` call sites confirmed at lines 61 and 73
- `apps/web/lib/theme.ts` — full 384 lines; `serializeThemeCss(null)` confirmed to emit `BRAND_DEFAULTS` (light palette pitfall); `BRAND_DEFAULTS.bg = '#FAFAF8'` confirmed
- `apps/web/components/issue/ThemeApplier.tsx` — 34-line component; single `applyTheme` call site in `useEffect`
- `apps/web/components/issue/SectionNavigator.tsx` — 169-line current component; `--mx`/`--my` pattern lines 106-128; `prefersReducedMotion` early-return lines 95-100; `CARDS` array confirmed with all 8 entries and canonical anchor ids
- `apps/web/components/issue/DeliberationSlot.tsx` — 641-line component; all 5 `useQuery` lines 106-110 confirmed; `AGENT_LABELS` lines 33-49 confirmed; `confidenceSectionRef`/`animatedRef`/`displayValue`/count-up pattern lines 199-232 confirmed
- `apps/web/app/globals.css` — `:root` dark palette confirmed; `--color-primary-glow` confirmed; `--font-display` confirmed as `'Cormorant Garamond', Georgia, serif`
- `packages/pipeline/tests/test_pipeline_real_mode.py` — `_SUPPRESSED` env var not yet read; line 468 assertion `result.get("theme", {}).get("primaryColor")` confirmed as pitfall for suppressed mode
- `packages/pipeline/tests/agents/test_design.py` — assertions on validation behavior (hex, font whitelist, SAFE_THEME); NO assertions on prompt text — confirms prompt changes are invisible to existing tests
- `apps/web/__tests__/theme-aa-tones.test.ts` — 79 lines; WCAG ratios locked; confirmed does not touch palette values
- `apps/web/__tests__/game-sandbox.test.ts` — 52-line tripwire pattern reference; confirms `readFileSync + .toContain` pattern for new MED-04/MED-05 tripwires
- `apps/web/__tests__/issue-page-typography.test.ts` — confirms `codeOnly()` helper for comment-stripping before model-name regex
- `.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-UI-SPEC.md` — full approved CSS classes for both component rebuilds; copywriting contract; typography conformance; all motion contracts

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — quick task `260521-n4l` context (stopped --color-bg/--color-text override); Phase 11 decisions (scroll-snap `.pitch-card-list`, reduced-motion patterns)
- `.planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-CONTEXT.md` — locked constraints carried forward: no new deps, no CDN, no GSAP, reduced-motion on all motion

---

## Metadata

**Confidence breakdown:**

- MED-01/MED-02 (flag plumbing): HIGH — both call sites in layout.tsx identified; empty-string vs BRAND_DEFAULTS pitfall verified from source; pipeline fan-out mechanics confirmed from builder.py
- MED-02 (validate_sections): HIGH — REQUIRED_FIELDS read directly; pitfall documented with exact error message
- MED-03 (prompt change): HIGH — `_build_messages` structure read in full; test assertions confirmed not to cover prompt text
- MED-04 (SectionNavigator rebuild): HIGH — existing component read in full; UI-SPEC CSS classes pre-approved; reuse patterns confirmed
- MED-05 (DeliberationSlot rebuild): HIGH — existing component read in full; all preservation targets identified by line number

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable stack; 30-day window appropriate for locked Next.js/LangGraph versions)
