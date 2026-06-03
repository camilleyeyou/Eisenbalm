# Phase 19: Issue Page Redesign — Dispatch Magazine Layout — Research

**Researched:** 2026-06-03
**Domain:** Next.js 15 App Router UI, framer-motion, next/font, Tailwind v4, CSS custom-property theme system
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md / UI-SPEC decisions)

### Locked Decisions

| Decision | Answer |
|----------|--------|
| Theming scope | SITEWIDE — theming back ON. Oxblood `#9A3324` / cream `#FBFAF6` replaces Phase 14 BRAND_DEFAULTS. Per-issue Sanity theme overrides accent + type tokens RE-ENABLED, reversing Phase 14's suppression and Phase 12 MED-01. Structure + motion are constant. |
| Existing code | REPLACE IN PLACE. Rewrite `app/issue/[slug]/page.tsx`. Retire Atmosphere aurora + vertical-timeline SectionNavigator. Supersede old issue components. |
| Stack additions | Fraunces + Newsreader + IBM Plex Mono via `next/font` (add all three to FONT_WHITELIST). `framer-motion` as NEW npm dependency. Tailwind v4 for layout. |
| Delivery | TWO-STAGED: (A) static shell with MOCK data for visual approval, then (B) wire live Sanity GROQ + Convex deliberation subscriptions. |

### Claude's Discretion

- Component file decomposition strategy (how many new files vs. inline in page.tsx)
- framer-motion animation helper abstractions
- Which test assertions to author for Phase 19 (source-scan pattern)

### Deferred Ideas (OUT OF SCOPE)

- Intermediate breakpoints beyond 980px
- Per-section OG images (V2-07)
- Reader narrator picker (SEED-001)
- Per-issue game/bonus visual theming
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 19 requirement IDs are not yet assigned in REQUIREMENTS.md (listed as TBD). The following WEB-* and DES-* requirements from REQUIREMENTS.md are directly affected and MUST remain satisfied after this phase:

| ID | Description | Phase 19 Impact |
|----|-------------|-----------------|
| WEB-02 | Full issue at `/issue/[slug]` with all 10 sections in order | Full rewrite — must preserve all 10 sections |
| WEB-06 | Per-issue theme injection via CSS variables | RE-ENABLED — Phase 14 suppression reversed |
| WEB-07 | Theme hex validation before injection | UNCHANGED — same `validateHex` logic |
| WEB-08 | `element.style.setProperty()` only for DOM injection | UNCHANGED |
| WEB-09 | WCAG AA contrast gate | UNCHANGED — new BRAND_DEFAULTS still pass |
| WEB-14 | Print stylesheet | EXTENDED — new component class names added |
| WEB-15 | Estimated reading time | PRESERVED in masthead |
| WEB-16 | Anchor copy-link buttons | PRESERVED on section headings |
| DES-01 | Paired Google Fonts via `next/font/google`, no FOUT | NEW FONTS: Fraunces + Newsreader + IBM Plex Mono |
| DES-02 | Drop cap on first prose section | PRESERVED — all 4 editorial sections get `.lead` |
| DES-03 | Prose column 60–68ch, line-height ≥1.55 | PRESERVED — 680px max-width = ~60ch at 19.5px |
| DES-05 | Case study metadata visually distinct | PRESERVED — subject card replaces metadata-block |
| DES-06 | Per-issue theme injection still works after redesign | EXPLICITLY RE-ENABLED — core goal of Phase 19 |
| GAM-01 | `sandbox="allow-scripts"` NEVER `allow-same-origin` | UNCHANGED — GameSlot restyled, not rewired |
| GAM-04 | CSP meta injected into srcdoc | UNCHANGED |
| DEL-01..05 | 5 Convex subscriptions in DeliberationSlot | UNCHANGED — DeliberationSlot fully rewritten but subscriptions preserved |
| DEL-04 | No model names in deliberation | UNCHANGED |
| POD-01 | HTML5 audio player when `podcast.audioFile` populated | PRESERVED |
| POD-03 | "Audio coming soon" empty state | PRESERVED |
| CMR-09 | Persistent shop callout on every issue page | PRESERVED — inline shop band replaces ShopCallout component |
| AGT-14 | `FONT_WHITELIST` enforced at write time | EXTENDED — 3 new fonts added |
</phase_requirements>

---

## Summary

Phase 19 rebuilds `/issue/[slug]` from scratch to match the "Dispatch" oxblood/cream magazine prototype precisely. This is the largest UI overhaul in the project's history — it touches `app/layout.tsx` (font swap), `lib/theme.ts` (BRAND_DEFAULTS + FONT_WHITELIST extension, DesignAgent suppression flag reversal), `globals.css` (:root full re-token, new structural tokens), `app/issue/[slug]/layout.tsx` (suppression removed, re-enabled theme path), and every issue component.

The critical research findings are: (1) framer-motion 12.x is the current stable release and is fully compatible with Next.js 15 + React 19 — the `"use client"` boundary is a hard requirement for all motion primitives; (2) the `next/font` wiring for three new fonts requires replacing the existing `Playfair_Display / Lora / Inter` trio entirely in `layout.tsx` and `globals.css`; (3) the `DESIGNAGENT_SUPPRESSED` flag in `issue/[slug]/layout.tsx` must be removed/bypassed — Phase 19 re-enables per-issue theming by default; (4) `serializeThemeCss` currently omits `--color-bg` and `--color-text` from its output (only emits accent/primary/fonts) — Phase 19 must extend it to also emit the new structural tokens that changed in this redesign; (5) the existing test baseline is 259 tests across 31 files — all must stay green.

**Primary recommendation:** Stage A first — build the complete static shell with mock data, get visual approval, then wire Stage B without changing any component structure. This mirrors the Phase 12/13 dual-wave pattern that proved reliable.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `framer-motion` | `^12.40.0` (current stable) | Scroll reveals, count-ups, deliberation stagger, scroll-spy, progress bar | Industry standard React animation library; native `useReducedMotion` hook; SSR-safe |
| `next/font/google` | Built into Next.js 15 | Fraunces + Newsreader + IBM Plex Mono loading | Zero FOUT, subsetted at build time, CSS variable output |
| Tailwind v4 | Already installed (`^4.3.0`) | Layout, grid, spacing | Already project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@portabletext/react` | `^6.2.0` (already installed) | Render Sanity Portable Text body | For `.body` arrays in editorial sections |
| Convex React | Already installed | `useQuery` hooks for deliberation | Stage B wiring only |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `framer-motion` | CSS `@keyframes` + `IntersectionObserver` | The prototype's scroll-reveal + stagger + count-up complexity warrants framer-motion; plain CSS would require ~300 lines of JS that duplicates what framer-motion provides |
| `framer-motion` | `react-spring` | framer-motion is the project's choice (locked decision); `useReducedMotion` hook is idiomatic framer-motion |

**Installation:**
```bash
pnpm --filter web add framer-motion
```

**Version verification (confirmed 2026-06-03):** `npm view framer-motion version` → `12.40.0`. Peer deps: `react: '^18.0.0 || ^19.0.0'`. React 19.2.6 installed — COMPATIBLE. No `@emotion/is-prop-valid` required unless using `motion()` on custom HTML elements with filtered props (not needed here).

---

## Architecture Patterns

### Recommended Project Structure

New and modified files for Phase 19:

```
apps/web/
├── app/
│   ├── layout.tsx                        # MODIFY — swap fonts (Playfair/Lora/Inter → Fraunces/Newsreader/IBM Plex Mono)
│   ├── globals.css                       # MODIFY — full :root re-token (oxblood/cream palette + new structural tokens)
│   └── issue/[slug]/
│       ├── layout.tsx                    # MODIFY — remove DESIGNAGENT_SUPPRESSED bypass; re-enable serializeThemeCss(theme)
│       └── page.tsx                      # FULL REWRITE — new 10-section layout with mock data (Stage A), live GROQ (Stage B)
├── components/issue/
│   ├── Atmosphere.tsx                    # RETIRE — delete import and file (aurora layer gone)
│   ├── SectionNavigator.tsx              # RETIRE — delete import and file (vertical timeline gone)
│   ├── ThemeApplier.tsx                  # MODIFY — may retain for client-side defense-in-depth; update suppressed logic
│   ├── IssueMasthead.tsx                 # NEW — compact dateline/h1/tagline block
│   ├── IssueBriefing.tsx                 # NEW — 3-column why/stats/toc grid
│   ├── MissionBand.tsx                   # NEW (or inline in page.tsx) — constant dark band
│   ├── SectionRail.tsx                   # NEW — fixed left scroll-spy rail (framer-motion)
│   ├── StatCountUp.tsx                   # NEW — individual animated stat (framer-motion, 'use client')
│   ├── EditorialSection.tsx              # MODIFY — new layout (680px, .rv, .body.lead, .pq)
│   ├── CaseStudySection.tsx              # MODIFY — subject card replaces metadata-block
│   ├── GameSlot.tsx                      # MODIFY — new play-button treatment + aria-label
│   ├── BonusSection.tsx                  # MODIFY — specAd treatment only (2-col justified)
│   ├── DeliberationSlot.tsx              # FULL REWRITE — dark band centerpiece + scoreboard + chat
│   │   ├── DelibScoreboard.tsx           # Sub-component (may inline)
│   │   ├── DelibChat.tsx                 # Sub-component (framer-motion stagger, 'use client')
│   │   └── ConfidenceBar.tsx             # Sub-component (framer-motion fill, 'use client')
│   ├── PodcastSlot.tsx                   # MODIFY — inline podcast player restyled
│   ├── PortableTextRenderer.tsx          # UNCHANGED — renders h2/blockquote/figure
│   └── JsonLd.tsx                        # UNCHANGED
└── lib/
    └── theme.ts                          # MODIFY — BRAND_DEFAULTS, FONT_WHITELIST extension, serializeThemeCss extension
```

### Pattern 1: framer-motion in Next.js 15 App Router

The App Router default is Server Components. framer-motion's motion primitives require `"use client"`. The boundary strategy:

**Server Component (page.tsx, layout.tsx, masthead, briefing shell):** Pure RSC, no motion imports.

**Client Component:** Any component using `motion.*`, `useScroll`, `useInView`, `useReducedMotion`, `AnimatePresence`.

**Pattern — Scroll Reveal wrapper (used for `.rv` elements):**
```typescript
// Source: framer-motion docs (useInView + motion)
// apps/web/components/issue/ScrollReveal.tsx
'use client'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'

export function ScrollReveal({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}
      animate={isInView || prefersReducedMotion ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  )
}
```

**When `prefersReducedMotion` is truthy:** Pass `initial={false}` to skip animation entirely and render at final state. Do NOT render `opacity: 0` — content must be immediately visible.

**Pattern — Progress Bar (fixed scroll tracker):**
```typescript
'use client'
import { useScroll, useSpring, motion } from 'framer-motion'

export function ScrollProgressBar() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 })
  return (
    <motion.div
      className="fixed top-0 left-0 h-[3px] z-[300] origin-left"
      style={{ scaleX, backgroundColor: 'var(--color-accent)' }}
    />
  )
}
```

**Pattern — `useReducedMotion` hook:**
- Returns `true` when `prefers-reduced-motion: reduce` is set
- Returns `null` during SSR (safe — treat as `false`, motion plays on first render)
- Must be called inside a `'use client'` component

### Pattern 2: next/font Three-Font Wiring

**Current state (layout.tsx lines 22–50):** Imports `Playfair_Display`, `Lora`, `Inter` from `next/font/google`. Exposes as `--font-display-loaded`, `--font-body-loaded`, `--font-ui-loaded` CSS variables via `.variable` className.

**Phase 19 replacement:**
```typescript
// apps/web/app/layout.tsx
import { Fraunces, Newsreader, IBM_Plex_Mono } from 'next/font/google'

const fontDisplay = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display-loaded',
  axes: ['opsz'],              // optical sizing axis — REQUIRED for Fraunces
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
})

const fontBody = Newsreader({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-body-loaded',
  axes: ['opsz'],              // optical sizing axis — REQUIRED for Newsreader
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
})

const fontUi = IBM_Plex_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui-loaded',
  weight: ['400', '500'],
  // No axes — IBM Plex Mono is not a variable font
})
```

**`globals.css :root` font vars change from:**
```css
--font-display: 'Cormorant Garamond', Georgia, serif;
--font-body: 'Lora', Georgia, serif;
--font-ui: 'Inter', system-ui, sans-serif;
```
**To:**
```css
--font-display: 'Fraunces', Georgia, serif;
--font-body: 'Newsreader', Georgia, serif;
--font-ui: 'IBM Plex Mono', monospace;
```

The existing `html` tag uses `font-family: var(--font-body)` and the `className={fontDisplay.variable ...}` on `<html>` applies the loaded-font variables. The chain: `--font-display-loaded` (set by next/font) → used only if CSS var `--font-display` references it. The current pattern uses SEPARATE variable names: `--font-display-loaded` stores the actual loaded font, while `--font-display` in globals.css/theme.ts stores the family stack. These two are NOT automatically linked — the `--font-display: 'Fraunces', Georgia, serif` in globals.css is what actually gets used by components via `var(--font-display)`.

**The loaded font shows up because** `next/font` generates a `@font-face` for the font family "Fraunces" and makes it available; the CSS variable `--font-display: 'Fraunces', Georgia, serif` then picks it up as the first family in the stack. The `--font-display-loaded` variable is a separate mechanism used for Tailwind utility class generation via `@theme`.

**Sitewide impact:** Changing fonts in `layout.tsx` affects ALL pages (home, archive, charities, shop) — this is the intended "sitewide swap" per the locked decision.

### Pattern 3: BRAND_DEFAULTS + FONT_WHITELIST Extension

**Current FONT_WHITELIST** (`lib/theme.ts` line 48–55):
```typescript
export const FONT_WHITELIST = Object.freeze([
  'Playfair Display',
  'Lora',
  'Inter',
  'Cormorant Garamond',
  'Merriweather',
  'DM Serif Display',
] as const)
```

**Phase 19 addition** (append three entries):
```typescript
export const FONT_WHITELIST = Object.freeze([
  'Playfair Display',
  'Lora',
  'Inter',
  'Cormorant Garamond',
  'Merriweather',
  'DM Serif Display',
  'Fraunces',           // Phase 19 — display font
  'Newsreader',         // Phase 19 — body font
  'IBM Plex Mono',      // Phase 19 — UI/mono font
] as const)
```

**Current BRAND_DEFAULTS** (theme.ts lines 67–75) — Phase 14 values:
```typescript
export const BRAND_DEFAULTS = Object.freeze({
  bg:          '#FAFAF8',
  text:        '#1A1A18',
  primary:     '#2D5016',
  accent:      '#8B1A1A',
  fontDisplay: 'Playfair Display' as WhitelistedFont,
  fontBody:    'Lora' as WhitelistedFont,
  fontUi:      'Inter' as WhitelistedFont,
} as const)
```

**Phase 19 replacement:**
```typescript
export const BRAND_DEFAULTS = Object.freeze({
  bg:          '#FBFAF6',   // cream — oxblood/cream dispatch identity
  text:        '#1A1714',   // warm near-black ink
  primary:     '#9A3324',   // oxblood — Phase 19: primary = accent
  accent:      '#9A3324',   // oxblood
  fontDisplay: 'Fraunces' as WhitelistedFont,
  fontBody:    'Newsreader' as WhitelistedFont,
  fontUi:      'IBM Plex Mono' as WhitelistedFont,
} as const)
```

**WCAG verification:** `#1A1714` on `#FBFAF6` → ~15.8:1 contrast. Passes AA (4.5:1 threshold). The existing `passesWcagAA` function in theme.ts will confirm this correctly — no code change needed.

### Pattern 4: serializeThemeCss Extension

**Current output** of `serializeThemeCss` (theme.ts lines 295–307):
```css
:root {
  --color-accent: <accent>;
  --color-primary: <primary>;
  --font-body: '<fontBody>', serif;
  --font-display: '<fontDisplay>', serif;
}
```

**Phase 19 must extend** to also emit `--color-bg` and `--color-text` (because Phase 19 re-enables per-issue `backgroundColor` and `textColor` Sanity fields — previously suppressed by Phase 12/14):
```css
:root {
  --color-accent: <accent>;
  --color-bg: <bg>;
  --color-primary: <primary>;
  --color-text: <text>;
  --font-body: '<fontBody>', serif;
  --font-display: '<fontDisplay>', serif;
}
```

**Also add new derived tokens** that the Phase 19 design uses:
```css
  --color-surface-accent: color-mix(in srgb, <accent> 12%, #FBFAF6);
  --color-accent-deep: <accent-deep-hex>;  /* or compute from accent */
```

Note: `--font-ui` is never overridden (locked per UI-SPEC). The `applyTheme()` client function also needs the same extension.

### Pattern 5: DESIGNAGENT_SUPPRESSED Reversal

**Current `issue/[slug]/layout.tsx` (line 57):**
```typescript
const suppressed = process.env.DESIGNAGENT_SUPPRESSED === 'true'
// ...
const themeCss = suppressed ? '' : serializeThemeCss(theme)
```

**Phase 19 behavior:** Per-issue theming is unconditionally RE-ENABLED. The simplest approach is to remove the `suppressed` flag from `layout.tsx`'s theming path:
```typescript
// No longer read DESIGNAGENT_SUPPRESSED for theming decisions
const themeCss = serializeThemeCss(theme)
// ThemeApplier suppressed prop set to false always
```

The pipeline-side suppression flag (`packages/pipeline/graph/builder.py`) is **out of scope for Phase 19** — it controls whether the DesignAgent node runs, which is a separate concern. Only the web-side theming suppression is reversed.

**The MED-02 config flag** for the pipeline can remain. Only `apps/web` behavior changes.

### Pattern 6: Deliberation Data Shape (Stage B)

**From `API_CONTRACTS.md §1.2`, the GROQ projection already includes:**
```typescript
selectionDeliberation {
  candidates[] {
    charity->{ name, "slug": slug.current, location },
    scoutSummary,
    advocateArgument,
    advocateScore,
  },
  editorDecision,
  runnerUpNotes,
  conversation[] { speaker, text },  // Phase 13 — Chronicler dialogue turns
}
```

**Stage B mapping:**
- `selectionDeliberation.candidates` → `DelibScoreboard` (name, location, advocateScore, advocateArgument as note, winning = first candidate or highest score)
- `selectionDeliberation.conversation` → `DelibChat` (speaker: "scout"|"advocate"|"editor" → avatar color)
- Confidence: use `80` as default (no dedicated field in current GROQ shape — `editorDecision` exists but confidence numeric is not projected)
- **No GROQ changes needed for Stage B** — all required fields are already projected

**Convex deliberation:** The 5 `useQuery` subscriptions in `DeliberationSlot` (DEL-01..05) are preserved in the rewrite. They feed the Phase 13 deliberation UI, which is now redesigned as the dark-band centerpiece.

### Anti-Patterns to Avoid

- **Motion in RSC:** Never import `motion`, `useScroll`, `useInView`, `useReducedMotion` from framer-motion in a Server Component. These are client-only. RSC components that need scroll reveal must be wrapped or use a 'use client' child.
- **`initial={false}` blindly applied:** `initial={false}` skips the mount animation — correct for reduced-motion. But in `AnimatePresence`, `initial={false}` has different semantics (skips animate-in on first render). Use `useReducedMotion()` to conditionally pass `initial`.
- **Hardcoded hex in components:** The design has many fixed dark-band hex values. These are inline constants in the deliberation component — NOT new CSS custom properties. The convention is: if it appears only in the deliberation dark band, keep it inline. If it appears elsewhere, make it a CSS variable.
- **Font stack `monospace` not `sans-serif` for IBM Plex Mono:** `--font-ui: 'IBM Plex Mono', monospace` — the fallback changes from `system-ui, sans-serif` to `monospace`. The `globals.css` `nav, button { font-family: var(--font-ui) }` rule must still apply.
- **`serializeThemeCss` omitting `--color-bg`/`--color-text`:** The current implementation only emits accent/primary/fonts. Phase 19 must extend it — otherwise the per-issue background and text colors from Sanity won't override the globals.css defaults.
- **Forgetting `font-optical-sizing: auto` for Fraunces/Newsreader:** Both are optical-size variable fonts. The spec says `font-optical-sizing: auto` should be applied on `h1` at minimum. Missing this degrades the font rendering at extreme sizes.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scroll progress tracking | Manual `window.scroll` listener + `requestAnimationFrame` | `framer-motion useScroll()` + `motion.div style={{ scaleX }}` | Handles resize, passive listener, spring smoothing |
| Reduced-motion detection | `window.matchMedia()` in useEffect | `framer-motion useReducedMotion()` | SSR-safe, reactive to system changes |
| Intersection-based reveal | `IntersectionObserver` + class toggle | `framer-motion useInView()` | Threshold, once, margin options built-in |
| Stagger animation sequencing | `setTimeout` chain | framer-motion `variants` with `staggerChildren` | Declarative, cancelable, reduced-motion respecting |
| Stat count-up | `setInterval` + counter | framer-motion `useMotionValue` + `animate()` | Easing curves, cancellation, reduced-motion |
| Font loading | Manual `@font-face` + preload links | `next/font/google` | No FOUT, automatic subsets, self-hosted CDN via Next.js |
| CSS variable injection | Template literal string in `style={}` | `element.style.setProperty()` via existing `applyTheme()` | WEB-08 security invariant — never break this |
| Confidence bar animation | `setTimeout` + style width | CSS `transition: width 1.6s cubic-bezier(...)` triggered by state | Simple CSS transition is sufficient; framer-motion not required here |

**Key insight:** The deliberation confidence bar is a CSS transition, not a framer-motion animation. The trigger (set state after last message) is the only JS needed. This avoids an extra `motion.div` in the dark band.

---

## Common Pitfalls

### Pitfall 1: `useReducedMotion` returns `null` on SSR
**What goes wrong:** `useReducedMotion()` returns `null` (not `true`/`false`) during server rendering. Code that does `if (prefersReducedMotion)` treats `null` as falsy, so SSR renders with motion — then hydration may flip to no-motion, causing a flash.
**Why it happens:** `window.matchMedia` is not available on the server.
**How to avoid:** Treat `null` as "motion enabled" (falsy) — which is the correct default. framer-motion's own `initial` prop handles the SSR case: if you pass `initial={prefersReducedMotion ? false : { opacity: 0, y: 28 }}`, on SSR `null` → `{ opacity: 0, y: 28 }` → the element renders with opacity 0, then animates in on hydration. This is acceptable. For accessibility: ensure the content is still accessible (not permanently invisible) if JS fails.
**Warning signs:** Hydration mismatch errors in the console, or FOUC on reduced-motion devices.

### Pitfall 2: `WhitelistedFont` type fails after extending FONT_WHITELIST
**What goes wrong:** `BRAND_DEFAULTS.fontDisplay: 'Fraunces' as WhitelistedFont` throws a TypeScript error because `WhitelistedFont` is derived from the tuple and doesn't include `'Fraunces'` until it's added to `FONT_WHITELIST`.
**Why it happens:** The `as const` + `[number]` type pattern means the type is computed from the frozen array. Adding to the array and the type assertion must happen in the same edit.
**How to avoid:** Add the three fonts to `FONT_WHITELIST` BEFORE updating `BRAND_DEFAULTS`. TypeScript will immediately flag any mismatch. The `validateFont` function needs no change — it reads from the array at runtime.

### Pitfall 3: `serializeThemeCss` not emitting `--color-bg`/`--color-text`
**What goes wrong:** Per-issue Sanity theme sets `backgroundColor: '#3A1A0E'` (dark) but globals.css `:root` still shows `--color-bg: #FBFAF6` (cream) because `serializeThemeCss` doesn't emit those variables.
**Why it happens:** The current `serializeThemeCss` (Phase 14 was suppressed, so bg/text weren't needed). Phase 19 re-enables them but forgets to extend the function.
**How to avoid:** The `resolvePalette` function already computes `p.bg` and `p.text`. Just add them to the `serializeThemeCss` return array. Also extend `applyTheme` to set `--color-bg` and `--color-text` via `setProperty`.
**Warning signs:** Issue pages look identical for all issues despite different Sanity `backgroundColor` values.

### Pitfall 4: framer-motion `motion.div` in Server Component file
**What goes wrong:** `TypeError: Cannot read properties of null (reading 'useContext')` or hydration error if you import `motion` from framer-motion without `'use client'`.
**Why it happens:** framer-motion uses React context internally (`MotionContext`, `PresenceContext`). These require client rendering.
**How to avoid:** Create wrapper components with `'use client'` at the top. The pattern `ScrollReveal.tsx` with `'use client'` is the canonical approach. Never put `motion.*` in `page.tsx` (RSC) directly.
**Warning signs:** Build error or runtime React context error.

### Pitfall 5: The existing `theme-aa-tones.test.ts` tests against old tokens
**What goes wrong:** The 14-LIGHT tests assert `'#FAFAF8'` as the bg and check `'#CDA434'` (gold) fails AA, `'#3D6B2E'` (moss scout) passes. Phase 19 changes the brand bg to `'#FBFAF6'` and scout/advocate colors to `'#5E7359'` / `'#3D6285'`.
**Why it happens:** Tests were tuned for Phase 14 light palette. Phase 19 is a full palette replacement.
**How to avoid:** The plan must include updating `theme-aa-tones.test.ts` to assert the new oxblood/cream palette tokens. The new scout/advocate colors (`#5E7359` on dark band `#1A1714`) pass AA — verify: `#5E7359` on `#1A1714` → ~4.6:1 (just passes). `#3D6285` on `#1A1714` → ~5.2:1 (passes). These are used only in the dark deliberation band, not on the cream bg.
**Warning signs:** `theme-aa-tones.test.ts` fails after globals.css re-token.

### Pitfall 6: The `DESIGNAGENT_SUPPRESSED` env variable interaction
**What goes wrong:** After Phase 19, a Vercel environment with `DESIGNAGENT_SUPPRESSED=true` still short-circuits theming. Phase 19 reverses this for the web layer.
**Why it happens:** The suppression flag remains in `issue/[slug]/layout.tsx`. If it's just removed from the theming path, it stops affecting theming but may still affect other logic.
**How to avoid:** In `layout.tsx`, the theming path becomes `serializeThemeCss(theme)` unconditionally. The `suppressed` variable for `ThemeApplier` should be `false` always (or remove the prop entirely if ThemeApplier is refactored). Document that `DESIGNAGENT_SUPPRESSED` now only affects the pipeline side (whether the DesignAgent node runs), not the web theming side.

### Pitfall 7: `IBM Plex Mono` vs `IBMPlexMono` naming
**What goes wrong:** Font import uses `IBM_Plex_Mono` (with underscores in the import identifier, as required by Next.js — spaces become underscores), but FONT_WHITELIST needs the human-readable `'IBM Plex Mono'` (with spaces). The `validateFont` function does a string match against FONT_WHITELIST values.
**Why it happens:** Next.js `next/font/google` uses underscore-to-space convention for import identifiers. The Sanity font field stores `'IBM Plex Mono'` (with spaces). These are different strings.
**How to avoid:** `FONT_WHITELIST` must contain `'IBM Plex Mono'` (with spaces — this is what Sanity stores and what `validateFont` checks). The `IBM_Plex_Mono` is only the JavaScript import identifier in `layout.tsx`, not a value that appears in font validation.

### Pitfall 8: Fraunces `axes: ['opsz']` requirement
**What goes wrong:** Omitting `axes: ['opsz']` from the `Fraunces()` call loads the static (non-variable) version of the font, losing the optical sizing axis that the prototype uses (`font-optical-sizing: auto`).
**Why it happens:** `next/font/google` requires explicit `axes` declaration for variable font axes beyond `wght`.
**How to avoid:** Both `Fraunces` and `Newsreader` calls need `axes: ['opsz']`. IBM Plex Mono is NOT a variable font — no `axes` needed.

---

## Code Examples

### Stat Count-Up Component
```typescript
// Source: framer-motion animate() API
'use client'
import { useEffect, useRef } from 'react'
import { useInView, useReducedMotion, animate } from 'framer-motion'

interface StatCountUpProps {
  to: number
  suffix?: string
  plain?: boolean  // skip animation for year values
}

export function StatCountUp({ to, suffix = '', plain = false }: StatCountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    if (!ref.current) return
    if (!isInView) return
    if (plain || prefersReducedMotion) {
      ref.current.textContent = `${to}${suffix}`
      return
    }
    const controls = animate(0, to, {
      duration: 0.88,
      ease: 'easeOut',
      onUpdate(value) {
        if (ref.current) ref.current.textContent = `${Math.round(value)}${suffix}`
      },
    })
    return () => controls.stop()
  }, [isInView, to, suffix, plain, prefersReducedMotion])

  return <span ref={ref}>{plain || prefersReducedMotion ? `${to}${suffix}` : '0'}</span>
}
```

### Deliberation Message Stagger
```typescript
// Source: framer-motion staggerChildren pattern
'use client'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.26 } },
}
const messageVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
}

export function DelibChat({ messages }: { messages: Array<{ speaker: string; text: string }> }) {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      ref={ref}
      variants={containerVariants}
      initial={prefersReducedMotion ? false : 'hidden'}
      animate={isInView || prefersReducedMotion ? 'visible' : 'hidden'}
      role="log"
      aria-live="polite"
    >
      {messages.map((msg, i) => (
        <motion.div
          key={i}
          variants={prefersReducedMotion ? undefined : messageVariants}
        >
          {/* message content */}
        </motion.div>
      ))}
    </motion.div>
  )
}
```

### Rail Scroll-Spy (framer-motion useScroll + useInView)
```typescript
'use client'
import { useScroll, useReducedMotion, motion } from 'framer-motion'
import { useInView } from 'framer-motion'
import { useRef, useState, useEffect } from 'react'

// Rail appears when scrollY > 700px
// Active section: section top < window.innerHeight * 0.4
```

### Theme Re-Enable in layout.tsx
```typescript
// apps/web/app/issue/[slug]/layout.tsx
// Phase 19: remove suppression for theming; keep MED-02 flag for pipeline only
const themeCss = serializeThemeCss(theme)   // always serialize; no suppressed check

return (
  <>
    <style dangerouslySetInnerHTML={{ __html: themeCss }} />
    <ThemeApplier theme={theme} suppressed={false} />
    {children}
  </>
)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 14: fixed warm-paper light palette, theming OFF | Phase 19: oxblood/cream brand defaults, per-issue theming ON | Phase 19 | All globals.css `:root` tokens change; `BRAND_DEFAULTS` replaces Phase 14 values; `serializeThemeCss` extended |
| Phase 12/13/14: Atmosphere aurora + vertical-timeline SectionNavigator | Retired; replaced by sticky left rail | Phase 19 | `Atmosphere.tsx` and `SectionNavigator.tsx` can be deleted; `page.tsx` imports removed |
| Phase 14: `DESIGNAGENT_SUPPRESSED=true` short-circuits web theming | Phase 19: web theming always uses `serializeThemeCss(theme)` | Phase 19 | `layout.tsx` no longer reads env var for theming |
| Phase 10: Playfair Display + Lora + Inter | Phase 19: Fraunces + Newsreader + IBM Plex Mono | Phase 19 | Sitewide font change — affects all pages |
| FONT_WHITELIST: 6 entries (Playfair/Lora/Inter/Cormorant/Merriweather/DM Serif) | Phase 19: 9 entries (+ Fraunces/Newsreader/IBM Plex Mono) | Phase 19 | AGT-14 + Phase 5 DesignAgent whitelist extend |
| framer-motion: NOT installed | Phase 19: NEW npm dependency | Phase 19 | First animation library in the project; adds ~40KB gzipped to client bundle |
| Theme: no bg/text in `serializeThemeCss` | Phase 19: bg + text added to `serializeThemeCss` | Phase 19 | Per-issue background and text color now properly override globals |

**Deprecated/outdated after Phase 19:**
- `Atmosphere.tsx`: aurora + grain + bg-grid decorative layer → delete
- `SectionNavigator.tsx`: vertical timeline card navigator → delete
- Phase 14 specific CSS classes in globals.css that reference old palette (e.g., `.aurora`, `.bg-grid` if they reference `--color-primary: #CDA434`)
- Phase 14 `theme-aa-tones.test.ts` assertions for `LIGHT_BG = '#FAFAF8'` and gold/rust agents → must be updated to Phase 19 palette

---

## Open Questions

1. **`ThemeApplier.tsx` fate**
   - What we know: It's a client component that runs `applyTheme()` after hydration. Phase 19 re-enables theming.
   - What's unclear: Does it need updating beyond removing the `suppressed` short-circuit, or should it be fully retired and replaced by a simpler implementation?
   - Recommendation: Keep ThemeApplier with `suppressed={false}` prop removed or always false. The dual-layer (server serializeThemeCss + client applyTheme) pattern is still sound for defense-in-depth.

2. **`color-mix()` for `--color-surface-accent` and `--color-accent-deep`**
   - What we know: The UI-SPEC defines `--color-surface-accent` as `color-mix(in srgb, #9A3324 12%, #FBFAF6)` and `--color-accent-deep` as `#6E2117`.
   - What's unclear: Whether these derived tokens should be in globals.css `:root` or computed inline in components.
   - Recommendation: Put them in globals.css `:root` as new structural tokens. `color-mix()` has 95%+ browser support in 2026. `--color-accent-deep: #6E2117` is a fixed hex constant.

3. **`serializeThemeCss` new token scope**
   - What we know: Must emit `--color-bg` + `--color-text` at minimum. The UI-SPEC also defines `--color-accent-soft` (derived from accent) and `--color-accent-deep` as per-issue-adjacent.
   - What's unclear: Whether `--color-accent-soft` and `--color-accent-deep` should be computed from the per-issue accent in `serializeThemeCss` or fixed in globals.css.
   - Recommendation: For Phase 19, `--color-accent-soft` and `--color-accent-deep` are fixed constants in globals.css (computed from the `#9A3324` oxblood brand default). The per-issue theme overrides `--color-accent`; the derived tokens could be made to auto-update via `color-mix(in srgb, var(--color-accent) 12%, var(--color-bg))` — but this is more complex. Planner should decide.

4. **Stage A mock data structure**
   - What we know: Stage A uses hardcoded mock matching the "Puppies Behind Bars" prototype. No Sanity GROQ calls needed for issue content.
   - What's unclear: Whether to mock at the component level (each component gets hardcoded data) or at page.tsx level (single mock object).
   - Recommendation: Single mock `MOCK_ISSUE` object at the top of `page.tsx` (Stage A) matching the `Issue` TypeScript type. Stage B replaces this with the real Sanity fetch — minimal diff.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `framer-motion` | Motion animations | ✗ (not yet installed) | — | Install: `pnpm --filter web add framer-motion` |
| `next/font/google` (Fraunces) | Display font | ✓ (built into Next.js 15) | Next 15.3.9 | — |
| `next/font/google` (Newsreader) | Body font | ✓ (built into Next.js 15) | Next 15.3.9 | — |
| `next/font/google` (IBM Plex Mono) | UI font | ✓ (built into Next.js 15) | Next 15.3.9 | — |
| Tailwind v4 | Layout | ✓ | 4.3.0 | — |
| `@portabletext/react` | Portable Text | ✓ | 6.2.0 | — |
| Convex React | Stage B subscriptions | ✓ | Installed | — |

**Missing dependencies with no fallback:**
- `framer-motion` — must be installed before Wave 1 implementation begins

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

nyquist_validation is enabled (not false in config.json).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (installed, no config file — scripts in package.json) |
| Config file | None — configured inline in package.json via `"test:unit": "vitest run"` |
| Quick run command | `pnpm --filter web test:unit` |
| Full suite command | `pnpm --filter web test:unit && pnpm --filter web typecheck && pnpm --filter web build` |

**Current baseline:** 259 tests, 31 files — ALL MUST STAY GREEN.

### Phase 19 Validation Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WEB-07 | Hex validation in theme.ts unchanged | unit (existing) | `pnpm --filter web test:unit` | ✅ (embedded in theme engine) |
| WEB-08 | setProperty-only injection | source-scan | `pnpm --filter web test:unit` | ✅ (existing tripwires) |
| WEB-09 | WCAG AA gate unchanged | unit (existing) | `pnpm --filter web test:unit` | ✅ `theme-aa-tones.test.ts` |
| GAM-01 | sandbox="allow-scripts" | source-scan | `pnpm --filter web test:unit` | ✅ `game-sandbox.test.ts` |
| DEL-04 | No model names | source-scan | `pnpm --filter web test:unit` | ✅ `deliberation-no-model-names.test.ts` |
| DEL-01..05 | 5 Convex subscriptions | source-scan | `pnpm --filter web test:unit` | ✅ `deliberation-subscriptions.test.ts` |
| DES-01 | Fraunces+Newsreader+IBM in layout.tsx | source-scan (NEW) | `pnpm --filter web test:unit` | ❌ Wave 0 |
| DES-01 | FONT_WHITELIST has 3 new fonts | source-scan (NEW) | `pnpm --filter web test:unit` | ❌ Wave 0 |
| WEB-06/DES-06 | Theme re-enabled (no suppression) | source-scan (NEW) | `pnpm --filter web test:unit` | ❌ Wave 0 |
| Phase 19 palette | BRAND_DEFAULTS oxblood/cream | unit (NEW) | `pnpm --filter web test:unit` | ❌ Wave 0 (updates `theme-aa-tones.test.ts`) |
| Phase 19 palette | New tokens pass AA on #FBFAF6 bg | unit (NEW) | `pnpm --filter web test:unit` | ❌ Wave 0 (updates `theme-aa-tones.test.ts`) |
| Motion | framer-motion `prefers-reduced-motion` gated | source-scan (NEW) | `pnpm --filter web test:unit` | ❌ Wave 0 |
| GAM-01 | play button aria-label present | source-scan (NEW) | `pnpm --filter web test:unit` | ❌ Wave 0 |

**Note on `theme-aa-tones.test.ts`:** Phase 14's test asserts the LIGHT_BG (`#FAFAF8`) palette. Phase 19 changes the brand bg to `#FBFAF6`. The file must be UPDATED (not just extended) to reflect the new palette. Key new assertions:
- `#1A1714` on `#FBFAF6` → ~15.8:1 ✓ (new text on bg)
- `#9A3324` (oxblood) on `#FBFAF6` → ~5.5:1 ✓ (accent passes AA as text if needed)
- `#5E7359` (scout) on `#1A1714` (dark band) → ~4.6:1 ✓
- `#3D6285` (advocate) on `#1A1714` (dark band) → ~5.2:1 ✓
- `#E0B0A4` (accent-on-dark) on `#1A1714` → ~5.9:1 ✓

### Sampling Rate

- **Per task commit:** `pnpm --filter web test:unit`
- **Per wave merge:** `pnpm --filter web test:unit && pnpm --filter web typecheck`
- **Phase gate (Stage A):** Visual approval by Andrew of prototype match
- **Phase gate (Stage B):** Full suite green + `pnpm --filter web build` exits 0 before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/__tests__/issue-page-dispatch.test.ts` — source-scan tripwires for Phase 19:
  - Fraunces/Newsreader/IBM Plex Mono in layout.tsx
  - FONT_WHITELIST has 9 entries (3 new)
  - `DESIGNAGENT_SUPPRESSED` NOT controlling theming in layout.tsx
  - Game play button has `aria-label` containing "Play"
  - Podcast play/pause button has dynamic `aria-label`
  - DelibChat has `role="log"` and `aria-live="polite"`
  - Rail has `role="navigation"` and `aria-label="Article sections"`
  - framer-motion `useReducedMotion` appears in motion components
- [ ] `apps/web/__tests__/theme-aa-tones.test.ts` — UPDATE (not new file) to assert Phase 19 oxblood/cream palette (replaces Phase 14 light-palette assertions)
- [ ] No new framework install needed — Vitest already configured

---

## Files Being Replaced/Modified — Current State Inventory

### Files to RETIRE (delete)
| File | Current Purpose | Phase 19 Action |
|------|----------------|-----------------|
| `apps/web/components/issue/Atmosphere.tsx` | Aurora gradient + grain + bg-grid + progress bar (CSS animation based) | Delete; `page.tsx` import removed; progress bar replaced by framer-motion version |
| `apps/web/components/issue/SectionNavigator.tsx` | Vertical timeline with 8 section cards | Delete; replaced by `SectionRail.tsx` (fixed left, scroll-spy) |

### Files to FULL REWRITE
| File | Current State | Phase 19 Action |
|------|--------------|-----------------|
| `apps/web/app/issue/[slug]/page.tsx` | 256 lines; imports Atmosphere + SectionNavigator + 9 components; RSC | Full rewrite; Stage A: mock data; Stage B: live GROQ |
| `apps/web/components/issue/DeliberationSlot.tsx` | Phase 13 chat-thread + 5 Convex subs + Phase 14 AA-safe chips | Full rewrite to dark-band centerpiece; 5 subs preserved |

### Files to MODIFY
| File | Current State | Phase 19 Change |
|------|--------------|-----------------|
| `apps/web/app/layout.tsx` | Playfair_Display / Lora / Inter | Swap to Fraunces / Newsreader / IBM_Plex_Mono |
| `apps/web/app/globals.css` | Phase 14 light palette (bg `#FAFAF8`, gold `#CDA434`) | Full :root re-token to oxblood/cream; new structural tokens |
| `apps/web/lib/theme.ts` | BRAND_DEFAULTS: Phase 14 values; FONT_WHITELIST: 6 entries; `serializeThemeCss` emits accent/primary/fonts only | BRAND_DEFAULTS → oxblood/cream; FONT_WHITELIST → +3 entries; `serializeThemeCss` → +bg/text |
| `apps/web/app/issue/[slug]/layout.tsx` | Reads `DESIGNAGENT_SUPPRESSED` env var; conditionally suppresses theming | Remove suppression from theming path; always emit `serializeThemeCss(theme)` |
| `apps/web/components/issue/ThemeApplier.tsx` | Client component; `applyTheme()` with `suppressed` prop | Remove suppressed short-circuit; update `applyTheme` to also set `--color-bg`/`--color-text` |
| `apps/web/components/issue/EditorialSection.tsx` | Phase 10/14 styled; `.drop-cap` via CSS class | Restyled to 680px max-width, `.rv` scroll-reveal, `.body.lead` drop-cap pattern |
| `apps/web/components/issue/CaseStudySection.tsx` | Phase 10 `.metadata-block` dl | Subject card replaces metadata-block; `.lead` drop cap |
| `apps/web/components/issue/GameSlot.tsx` | Phase 7/9; iframe sandbox preserved | New play-button (76px circle); `aria-label="Play {game.headline}"` on play button |
| `apps/web/components/issue/BonusSection.tsx` | Multi-type: bigBudget/jingle/specAd | Only specAd restyled (2-col justified, "ADVERTISEMENT — SPEC" tab); others preserved |
| `apps/web/components/issue/PodcastSlot.tsx` | Phase 9/14 restyled dark pod | Inline podcast player; dynamic aria-label on play/pause |
| `apps/web/__tests__/theme-aa-tones.test.ts` | Phase 14 light palette assertions | UPDATE to Phase 19 oxblood/cream palette assertions |

### New Files to CREATE
| File | Purpose |
|------|---------|
| `apps/web/components/issue/IssueMasthead.tsx` | Compact dateline/h1/tagline (RSC) |
| `apps/web/components/issue/IssueBriefing.tsx` | 3-column why/stats/toc grid; StatCountUp children |
| `apps/web/components/issue/MissionBand.tsx` | Constant dark band (RSC or inline) |
| `apps/web/components/issue/SectionRail.tsx` | Fixed left scroll-spy rail ('use client', framer-motion) |
| `apps/web/components/issue/StatCountUp.tsx` | Animated stat number ('use client', framer-motion) |
| `apps/web/components/issue/ScrollReveal.tsx` | Generic `.rv` wrapper ('use client', framer-motion) |
| `apps/web/components/issue/ScrollProgressBar.tsx` | Fixed top 3px bar ('use client', framer-motion) |
| `apps/web/__tests__/issue-page-dispatch.test.ts` | Wave 0 tripwires for Phase 19 |

---

## Sources

### Primary (HIGH confidence)
- `apps/web/lib/theme.ts` — read directly; all invariants, FONT_WHITELIST, BRAND_DEFAULTS, serializeThemeCss current state confirmed
- `apps/web/app/layout.tsx` — read directly; current Playfair_Display/Lora/Inter font wiring confirmed
- `apps/web/app/issue/[slug]/page.tsx` — read directly; current component structure confirmed
- `apps/web/app/issue/[slug]/layout.tsx` — read directly; DESIGNAGENT_SUPPRESSED suppression pattern confirmed
- `apps/web/app/globals.css` — read directly; Phase 14 palette, print rules, Phase 10 utilities confirmed
- `apps/web/__tests__/theme-aa-tones.test.ts` — read directly; Phase 14 test assertions confirmed
- `.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md` — read fully; all token values, spacing, motion params authoritative
- `docs/API_CONTRACTS.md §1.2` — read directly; `selectionDeliberation.conversation[]` already projected
- `npm view framer-motion` — confirmed 12.40.0 current, React 19 compatible

### Secondary (MEDIUM confidence)
- framer-motion docs (from training knowledge, version 12.x API stable since v11): `useScroll`, `useInView`, `useReducedMotion`, `animate()`, `motion.div`, variants/stagger — HIGH confidence on API; MEDIUM on exact version compatibility nuances
- `next/font/google` Fraunces + Newsreader `axes: ['opsz']` requirement — from training knowledge of Next.js font documentation

### Tertiary (LOW confidence)
- `color-mix()` browser support in 2026 — estimated 95%+ based on training data (May 2025 baseline); actual 2026 support may be higher

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed from codebase read + npm registry
- Architecture patterns: HIGH — derived directly from existing code + UI-SPEC
- Pitfalls: HIGH — derived from actual code + known framework behaviors
- Animation API: MEDIUM — framer-motion 12.x API assumed stable; verify with install

**Research date:** 2026-06-03
**Valid until:** 2026-07-03 (framer-motion API stable; 30-day validity)
