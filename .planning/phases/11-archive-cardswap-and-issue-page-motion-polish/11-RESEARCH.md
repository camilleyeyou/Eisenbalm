# Phase 11: Archive CardSwap + Issue-Page Motion Polish — Research

**Researched:** 2026-05-22
**Domain:** CSS-3D animation, React motion patterns, additive UI polish on existing Next.js 15 components
**Confidence:** HIGH — all findings verified against live source files; no external library research required (no new deps permitted)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **Fonts:** Display = Cormorant Garamond (already whitelisted). Body + labels = Lora/Inter. Do NOT add Spectral or IBM Plex Mono. FONT_WHITELIST is NOT modified.
- **Animation:** CSS 3D + minimal reduced-motion-safe JS only. NO new npm dependency (no gsap, no framer-motion). NO CDN `<script>` tags. NO external grain SVG. 'elastic' easing approximated with `cubic-bezier(0.34, 1.56, 0.64, 1)`.
- **Data binding:** Everything binds to Sanity/Convex. Zero hardcoded issue content. Archive cards bind to real `ArchiveIssue[]`; issue-page content stays Sanity/Convex-driven.
- **Hard constraints (all non-negotiable):**
  - `prefers-reduced-motion`: ALL new motion must respect it (auto-cycle off + static accessible list for CardSwap; instant reveals; no JS cursor tracking; count-up shows final value instantly)
  - Single `<main id="main">` (root layout owns it)
  - ≥44px touch targets (CardSwap controls, nav cards)
  - WCAG AA contrast on all new surfaces
  - Print stylesheet strips chrome to black-on-white (decorative/motion layers print-hidden via `data-print-hide="true"`)
  - Game iframe security (`sandbox="allow-scripts"` + `validateEmbedCode`) and `theme.ts` security contract are NOT touched
  - DEL-04 (no model names) and live Convex subscriptions in DeliberationSlot must NOT regress

### Claude's Discretion

- Exact CardSwap geometry (cardDistance/verticalDistance/perspective), indicator-dot styling, count-up duration/easing, and which existing globals.css tokens to reuse — within the constraints above.

### Deferred Ideas (OUT OF SCOPE)

- Spectral + IBM Plex Mono fonts — deferred
- GSAP / framer-motion as animation libraries — deferred
- A standalone static "Issue 042" showcase page — rejected
- Archive pagination / loading skeletons (backlog 999.1) — out of scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ARC-01 | CSS-3D CardSwap on `/archive` cycling real past issues — auto-advance ~6s, pause-on-hover, click-to-open, indicator dots, "N issues" badge, no new npm deps, prefers-reduced-motion guard | ArchiveIssue type confirmed; QUERY_ARCHIVE fields verified; CSS-3D approach documented below |
| MOT-01 | IssueHero charity name clip-path line-by-line reveal on load; instant under reduced-motion | IssueHero.tsx structure confirmed; `<h1>` is a single unsplit element; word-span approach documented |
| MOT-02 | SectionNavigator magnetic gold cursor-glow + hover translateY; reduced-motion: no JS cursor tracking | SectionNavigator.tsx magnetic glow JS confirmed present; `.section-card:hover` rule in globals.css confirmed; one CSS value addition |
| MOT-03 | DeliberationSlot confidence count-up (scroll-into-view) + pitch-card scroll-snap carousel; DEL-04 intact, Convex subscriptions intact | DeliberationSlot.tsx structure fully read; confidence meter location confirmed; pitch card list location confirmed |
</phase_requirements>

---

## Summary

Phase 11 is entirely additive — it touches five files (one new component, four existing components, possibly one CSS rule addition to globals.css) without rewriting any data binding, Convex subscriptions, or security contracts. All the building blocks are already in place.

The CardSwap component is a new `apps/web/components/archive/CardSwap.tsx` ('use client') that receives the already-fetched `issues: ArchiveIssue[]` prop from the archive page. It uses CSS `perspective` + `transform-style: preserve-3d` on a scene container, with per-card inline `style` props for `translateZ`/`translateY`/`rotateX` offsets calculated from card index. A `setInterval` drives auto-advance; `window.matchMedia('(prefers-reduced-motion: reduce)')` gates the timer at mount. The UI-SPEC geometry (500×400, 1200px perspective, 50px depth step, 18px y-step, 2deg tilt, 6000ms, `cubic-bezier(0.34,1.56,0.64,1)`) is already decided.

The three issue-page motion treatments all extend existing components without touching their data layer. MOT-01 adds word-span animation to the `<h1>` in IssueHero (currently a plain string render — the component is a Server Component, so animation logic must use CSS-only `animation-delay` inline styles, not `useEffect`). MOT-02 is a single `translateY(-4px)` CSS addition to `.section-card:hover` in globals.css (the existing transition already includes `transform 0.3s`). MOT-03 adds an `IntersectionObserver` + `requestAnimationFrame` count-up to DeliberationSlot (already 'use client') and converts the pitch-card container to a horizontal scroll-snap on mobile.

**Primary recommendation:** Plan four focused tasks in execution order — (1) CardSwap component + archive page integration; (2) IssueHero word-reveal (CSS-only animation, no JS); (3) globals.css hover translate + pitch-card scroll-snap CSS (pure CSS, zero JS); (4) DeliberationSlot confidence count-up (IntersectionObserver + rAF, scoped to the existing 'use client' component).

---

## Standard Stack

### Core (already installed — NO new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 19 | `^19.2.6` | Component authoring, `useState`/`useEffect`/`useRef` | Already installed |
| Next.js 15 | `^15.3.9` | App Router, Server Components, 'use client' boundary | Already installed |
| lucide-react | `^1.14.0` | ChevronLeft/ChevronRight icons for CardSwap prev/next controls | Already installed; no Iconify |
| Tailwind v4 | `^4.3.0` | CSS variable-native utility classes | Already installed |

**No new npm packages.** `package.json` must be byte-identical after Phase 11 (except for zero-dep changes). The `theme-aa-tones.test.ts` tripwire and `issue-page-typography.test.ts` tripwire both perform source-scan checks that remain green so long as no new `:root` hex values and no new Google Fonts `<link>` tags are introduced.

### Supporting (browser APIs, no install)

| API | Purpose | Notes |
|-----|---------|-------|
| `window.matchMedia('(prefers-reduced-motion: reduce)')` | Reduced-motion gate in CardSwap + DeliberationSlot | Pattern already used in `SectionNavigator.tsx` and `Atmosphere.tsx`; use same pattern |
| `setInterval` / `clearInterval` | CardSwap auto-advance timer | Standard browser; cleanup in `useEffect` return |
| `IntersectionObserver` | Count-up trigger on scroll-into-view | Already a browser standard; no polyfill needed for modern browsers |
| `requestAnimationFrame` | Count-up animation loop | Standard; cancel with `cancelAnimationFrame` in cleanup |
| CSS `scroll-snap-type` / `scroll-snap-align` | Pitch-card carousel | Pure CSS; no JS needed; supported in all modern browsers |

---

## Architecture Patterns

### Recommended File Change Map

```
apps/web/
├── components/archive/
│   └── CardSwap.tsx          NEW ('use client') — CSS-3D card stack
├── app/archive/
│   └── page.tsx              MODIFY — add <CardSwap issues={issues}> above <ArchiveList>
├── components/issue/
│   ├── IssueHero.tsx         MODIFY — word-span <h1> + CSS animation
│   ├── SectionNavigator.tsx  MODIFY — add translateY(-4px) to hover (one line or Tailwind class)
│   └── DeliberationSlot.tsx  MODIFY — confidence count-up + pitch-card scroll-snap
└── app/globals.css           MODIFY — add translateY to .section-card:hover + scroll-snap CSS
```

### Pattern 1: CSS-3D CardSwap

**What:** A `perspective`-wrapped scene containing absolutely-positioned cards. Each card's depth/tilt/opacity is derived from its relative index to the current front card.

**Implementation sketch (no library):**

```tsx
// CardSwap.tsx — 'use client'
// Scene:  position: relative; perspective: 1200px; width: 500px; height: 400px
// Cards:  position: absolute; width: 100%; height: 100%;
//         transition: transform 500ms cubic-bezier(0.34,1.56,0.64,1), opacity 500ms ease;
//
// Per-card transform derived from relativeIndex = (index - activeIndex + N) % N:
//   relativeIndex 0: translateZ(0) rotateX(0deg)   opacity 1
//   relativeIndex 1: translateZ(-50px) translateY(18px) rotateX(2deg)  opacity 0.55
//   relativeIndex 2: translateZ(-100px) translateY(36px) rotateX(4deg) opacity 0.35
//   relativeIndex > 2: opacity 0; pointer-events: none
//
// Advance: increment activeIndex state, triggering re-render
// setInterval(advance, 6000) in useEffect; clearInterval on mouseenter/mouseleave
// Reduced-motion: skip timer, set transitions to 'none', keep dots functional
```

**Key correctness points confirmed by source reading:**
- `ArchiveIssue` has: `issueNumber`, `publishDate`, `slug`, `charity.name`, `charity.focusArea`, `charity.assetRange`. No `missionStatement` (not in `QUERY_ARCHIVE`). The UI-SPEC correctly omits missionStatement from card content.
- `formatMonthYear(issue.publishDate)` helper already exists (used in `ArchiveItem.tsx`) — CardSwap should reuse `@/lib/format` for date formatting.
- The front card is `<a href={/issue/${slug}}>`. The aria contract: `<section aria-label="Archive preview">` wraps everything.

### Pattern 2: IssueHero Word-Span Reveal (CSS-only, no 'use client')

**What:** IssueHero.tsx is currently a pure Server Component (no 'use client' directive, no hooks). This is critical: the clip-path reveal must be implemented with CSS animations + inline `style={{ animationDelay }}` per span, NOT with `useEffect`/`useState`. Adding hooks would force 'use client' on a Server Component, which is unnecessarily expensive.

**Confirmed current `<h1>` render:**
```tsx
// IssueHero.tsx line 91-98 — current:
<h1
  className="mb-10 max-w-[14ch] font-display font-normal ..."
  style={{ fontSize: 'clamp(56px,...)', textShadow: '...' }}
>
  {charity.name}
</h1>
```

**New pattern:** Split `charity.name` into words using `.split(' ')`. Each word becomes a `<span>` with inline `animationDelay`. The `@keyframes heroWordReveal` animation is defined via a `<style>` tag within the component JSX (scoped to the component; does not pollute globals.css). The `clip-path` and initial `transform` values MUST be set only inside `@keyframes from {}` — never as base styles — so content is visible without animation.

```tsx
// Server Component — no hooks needed
const words = charity.name.split(' ')
// ...
<h1 ...>
  <style>{`
    @keyframes heroWordReveal {
      from { clip-path: inset(0 0 100% 0); transform: translateY(12px); opacity: 0; }
      to   { clip-path: inset(0 0 0% 0);   transform: translateY(0);    opacity: 1; }
    }
    .hero-word-span {
      display: inline-block;
      animation: heroWordReveal 600ms cubic-bezier(0.4, 0, 0.2, 1) both;
    }
  `}</style>
  {words.map((word, i) => (
    <span
      key={i}
      className="hero-word-span"
      style={{ animationDelay: `${i * 80}ms` }}
    >
      {word}{i < words.length - 1 ? ' ' : ''}
    </span>
  ))}
</h1>
```

**Reduced-motion:** The existing globals.css guard (`animation-duration: 0.01ms !important`) collapses the animation to ~0ms, making spans immediately visible. No additional JS guard needed. Content is never trapped at `opacity: 0` because opacity is only inside `@keyframes from {}`.

**Critical caveat:** The `issue-page-typography.test.ts` tripwire at line 185 asserts `IssueHero.tsx` has at least 2 `.eyebrow` class usages. That test reads the raw source file. After the word-span change, the `.eyebrow` class on the eyebrow `<p>` (line 83) and the `.eyebrow` spans in the meta row remain — count stays ≥2. Verified.

**Note on inline `<style>` in Server Components:** React 19 + Next.js 15 support `<style>` tags inside Server Component JSX without hydration warnings (React 19 promotes them to `<head>` deduplication). This is the correct pattern for component-scoped keyframes that don't belong in globals.css.

### Pattern 3: SectionNavigator Hover Translate (One CSS Value)

**What:** The `.section-card:hover` rule in globals.css (line 521-527) already has `background`, `border-color`, and `box-shadow`. The existing `.section-card` rule (line 486-500) already has `transition: background 0.3s, border-color 0.3s, transform 0.3s, box-shadow 0.3s`.

**Confirmed current hover rule (globals.css line 521-527):**
```css
.section-card:hover {
  background: var(--color-card-hover);
  border-color: var(--color-primary);
  box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.7),
    0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent);
}
```

**Change:** Add `transform: translateY(-4px);` to that rule. One line. The `transition: transform 0.3s` is already on `.section-card`. Under reduced-motion, the globals.css guard sets `transition-duration: 0.01ms !important` so the translate is instant — the static hover state (different bg, gold border) remains as the non-motion signal.

Alternative: use Tailwind `hover:-translate-y-1` on the anchor. Either approach is equivalent. The globals.css approach is preferred to keep all `.section-card` appearance in one place.

**Note:** MOT-02 does NOT add new JS. The magnetic glow JS in SectionNavigator.tsx already has its `prefersReducedMotion` early-return (line 96-101). That code path is untouched.

### Pattern 4: DeliberationSlot Confidence Count-Up + Scroll-Snap

**Existing 'use client' boundary:** DeliberationSlot.tsx is already `'use client'` with the existing `prefersReducedMotion` const at module scope (line 95-97):
```tsx
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
```
This is already used to gate the bar fill transition at line 367 and line 513. The same `prefersReducedMotion` const is reused for the count-up guard.

**Count-up — current confidence meter location (lines 487-534):**
```tsx
{editorConfidence !== null && (
  <div>
    {/* ... label row ... */}
    <span className="font-display text-[32px] ...">{Math.round(editorConfidence * 100)}%</span>
    {/* ... bar fill div ... */}
  </div>
)}
```

**New behavior:** Replace the static `Math.round(editorConfidence * 100)` value with a `useState(displayValue)` that starts at `0` and animates up via `requestAnimationFrame` once `IntersectionObserver` fires on the section. The bar fill div's `width` style should also start at `'0%'` and update to `${editorConfidence * 100}%` after intersection.

```tsx
// Additional hooks at top of component:
const confidenceSectionRef = useRef<HTMLDivElement>(null)
const [displayValue, setDisplayValue] = useState(0)
const animatedRef = useRef(false)  // one-shot guard

useEffect(() => {
  if (editorConfidence === null) return
  const target = Math.round(editorConfidence * 100)

  if (prefersReducedMotion) {
    setDisplayValue(target)  // instant, no rAF
    return
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !animatedRef.current) {
        animatedRef.current = true
        observer.disconnect()
        const duration = 1200
        const start = performance.now()
        function tick(now: number) {
          const elapsed = now - start
          const progress = Math.min(elapsed / duration, 1)
          setDisplayValue(Math.round(progress * target))
          if (progress < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    },
    { threshold: 0.4 },
  )
  if (confidenceSectionRef.current) observer.observe(confidenceSectionRef.current)
  return () => observer.disconnect()
}, [editorConfidence, prefersReducedMotion])
```

The confidence meter section wrapper gets `ref={confidenceSectionRef}`. The displayed span changes from `{Math.round(editorConfidence * 100)}%` to `{displayValue}%`. The span gets `aria-live="polite"` for screen reader announcement after animation completes.

**DEL-04 compliance:** This change adds `useState`, `useRef`, `useEffect` and reads `editorConfidence` (already extracted from Convex payload above). It does NOT read `run?.cost`, `modelVersions`, or any model-name literals. The `deliberation-no-model-names.test.ts` source-scan strips comments and checks for those specific strings — the new code is clean.

**Pitch-card scroll-snap (lines 272-393):** The pitch card container (line 273: `<div className="flex flex-col gap-4">`) changes to horizontal scroll-snap on mobile (< 960px) via a responsive CSS approach:

```tsx
// Replace the container className:
<div
  className="flex flex-col gap-4 lg:flex-row lg:overflow-x-auto"
  // at ≥960px = two-column grid, so flex-col is still fine for the left column
  // at <960px = single column, want horizontal scroll
>
```

Wait — examining the actual layout: the two-column grid is `lg:grid-cols-[1fr_1fr]` (line 261), breaking at `lg:` (1024px by Tailwind default, but this uses explicit class). The pitch cards are in the LEFT column of this grid. On mobile/tablet, the grid collapses to single-column, and the pitch cards become a tall vertical list. The scroll-snap carousel converts this to horizontal snap on narrow screens.

The UI-SPEC specifies the breakpoint as `< 960px`. The existing grid uses `lg:grid-cols-[1fr_1fr]` which in Tailwind v4 is 1024px. At the 960px specification, we need a custom responsive approach. Options:

1. Add CSS classes to globals.css for the pitch-card container at < 960px breakpoint.
2. Use inline style with JS media query check (adds JS, avoid).
3. Use a CSS custom breakpoint with Tailwind v4 `@custom-variant` or `min-960:` syntax.

**Recommended:** Define the scroll-snap CSS in globals.css under a media query:

```css
/* In globals.css — under the Phase 11 section */
.pitch-card-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 959px) {
  .pitch-card-list {
    flex-direction: row;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .pitch-card-list::-webkit-scrollbar { display: none; }

  .pitch-card-list > * {
    scroll-snap-align: start;
    flex: 0 0 85vw;
    max-width: 400px;
  }
}
```

Then apply `className="pitch-card-list"` to the container div. Each pitch card `<div>` gets `tabIndex={0}` for keyboard accessibility.

The `.pitch-card-list` container also needs `role="list"` and the sr-only hint per UI-SPEC. Individual cards get `role="listitem"`.

### Anti-Patterns to Avoid

- **Adding 'use client' to IssueHero:** The component is a Server Component. Adding hooks just for word-span animation is unnecessary — CSS `animation-delay` on inline spans works in Server Components. Do not add `'use client'`.
- **Hardcoding content in CardSwap:** No `"Issue 042"`, `"Project Solitude"`, or any literal content. All card text derives from `ArchiveIssue` prop fields.
- **Setting `opacity: 0` or `clip-path: inset(0 0 100% 0)` as base styles on hero word spans:** These values must only appear in `@keyframes from {}`. If animation is skipped (reduced-motion, SSR, old browser), the content must be visible.
- **Reading `run?.cost` in DeliberationSlot modifications:** The DEL-04 source-scan checks `codeOnly(source)` for `run?.cost`. The new count-up code must not accidentally reference this. Keep changes to the confidence section only.
- **Adding a second `<main>`:** CardSwap is a `<section>` not a `<main>`. Archive page has no `<main>` (root layout owns it). Verify.
- **Using CDN scripts or external SVGs:** The `grain` layer in globals.css uses a data-URI SVG inline. CardSwap must not reference external URLs for decoration.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Card z-ordering | Complex DOM manipulation | CSS `transform: translateZ()` stacking + `z-index` derived from index | CSS handles 3D natively with `perspective` + `preserve-3d` |
| Reduced-motion detection | Custom hook | `window.matchMedia('(prefers-reduced-motion: reduce)')` at mount, same as SectionNavigator.tsx and Atmosphere.tsx patterns already in codebase | Already established pattern; consistent |
| Date formatting | Custom formatter | `formatMonthYear()` from `@/lib/format` (already used by ArchiveItem.tsx) | Already exists, already tested |
| Confidence percentage display | New state/component | `useState(displayValue)` in existing DeliberationSlot | Already 'use client'; simpler to extend than extract |
| Scroll snap | JavaScript scroll controller | CSS `scroll-snap-type: x mandatory` + `scroll-snap-align: start` | Native CSS; no JS required; accessible by default |
| Word splitting for animation | Complex text measurement | `.split(' ')` + `<span>` per word | Simple; avoids ResizeObserver line-break detection |

**Key insight:** Every technique in this phase is achievable with native browser CSS + minimal React state. The constraint against new npm dependencies actually simplifies implementation by ruling out over-engineered solutions.

---

## Existing Component State — Precise Shapes

This section documents the current state of each component that will be modified, so the planner can write tasks that extend them precisely.

### `apps/web/components/archive/ArchiveList.tsx`

- `'use client'` directive, line 1
- Props: `{ issues: ArchiveIssue[] }`
- Renders: search `<input>`, sort buttons, `role="status"` count, `<ul>` of `<ArchiveItem>`
- No changes needed to ArchiveList — CardSwap is inserted ABOVE it in archive/page.tsx

### `apps/web/app/archive/page.tsx`

- Server Component (no 'use client')
- Fetches `issues` via `sanityClient.fetch<ArchiveIssue[]>(QUERY_ARCHIVE)`
- Currently renders: heading, description, conditional `<ArchiveList issues={issues}>` inside a `<div className="mt-8">`
- **Required change:** Import and render `<CardSwap issues={issues} />` above the `<div className="mt-8">` that wraps ArchiveList. The `issues` variable is already available. No new fetch needed.

### `apps/web/components/issue/IssueHero.tsx`

- Server Component (no 'use client', no hooks)
- Props: `{ charity: IssueCharity, issueNumber, publishDate, readingTimeMinutes, problemPdfUrl }`
- `IssueCharity` has: `name` (string), `slug`, `location`, `website`, `charityNavigatorUrl`, `foundingYear`, `assetRange`, `focusArea`, `missionStatement`
- Current `<h1>`: single text node `{charity.name}` — no spans, no existing word-split
- Eyebrow class usage count: 2 (eyebrow on `<p>` line 83 + 4 `<span className="eyebrow">` in meta row lines 121-138). The `issue-page-typography.test.ts` DES-04 test requires ≥2 matches for `["']eyebrow` — currently at 5. After word-span change, the eyebrow spans are untouched. Count stays ≥2. Safe.

### `apps/web/components/issue/SectionNavigator.tsx`

- `'use client'` directive, line 1
- No props
- Already has magnetic glow JS with `prefersReducedMotion` early-return at line 96-101
- Renders `.section-navigator` > `.snw-head` + `.section-cards` > 8 `.section-card` anchors
- The hover `transform` in globals.css does NOT yet exist — confirmed by reading globals.css lines 521-527: only `background`, `border-color`, `box-shadow` in `.section-card:hover`

### `apps/web/components/issue/DeliberationSlot.tsx`

- `'use client'` directive, line 1
- Props: `{ runId: string | null }`
- Module-scope `prefersReducedMotion` const at lines 95-97 — reuse this directly
- 5 Convex subscriptions (lines 105-109): `run`, `pitchLog`, `events`, `votes`, `corrections` — DO NOT touch
- Confidence meter: inside `{editorConfidence !== null && (` block at lines 487-534
  - The value `Math.round(editorConfidence * 100)` at line 500 — this is what becomes `displayValue`
  - The bar fill `div` at lines 506-514 has `width: \`${editorConfidence * 100}%\`` — this also starts at `'0%'`
  - Existing `transition: prefersReducedMotion ? 'none' : 'width 0.6s ease'` at line 513 — KEEP this
- Pitch card container: `<div className="flex flex-col gap-4">` at line 273
  - Each card: `<div key={card._id} className="rounded p-6" style={{...}}>` at line 279
  - Cards are in the left column of `<div className="grid gap-12 lg:grid-cols-[1fr_1fr]">` at line 261
- DEL-04 tripwire will re-scan the modified file — the changes must not introduce `modelVersions`, `run?.cost`, `run.cost`, `claude`, `gpt`, `sonnet`, `haiku`, or `openrouter` in code (not comments)

### `apps/web/app/globals.css`

- Tailwind v4 (`@import "tailwindcss"` at line 1)
- Existing `@media (prefers-reduced-motion: reduce)` guard at lines 293-302 — DO NOT duplicate; it covers `animation-duration: 0.01ms !important` AND `transition-duration: 0.01ms !important`
- `.section-card:hover` at lines 521-527 — add `transform: translateY(-4px);`
- `.section-card` transition at line 497: `transition: background 0.3s, border-color 0.3s, transform 0.3s, box-shadow 0.3s` — already includes `transform 0.3s`. No change needed to the base rule.
- Print stylesheet at lines 108-162 — `[data-print-hide="true"] { display: none !important; }` at line 110 already covers CardSwap wrapper. Confirmed.
- Phase 11 additions to globals.css: (a) `transform: translateY(-4px)` in `.section-card:hover`; (b) `.pitch-card-list` scroll-snap rules. Both go in a new `Phase 11` section following the existing Phase 9 section.

### `apps/web/lib/sanity/queries.ts` + `apps/web/lib/sanity/types.ts`

**QUERY_ARCHIVE** (lines 100-115 of queries.ts) returns:
```
issueNumber, publishDate, slug (= slug.current), bonusType
charity -> { name, slug (= slug.current), location, focusArea, assetRange }
```

**ArchiveIssue type** (lines 134-146 of types.ts):
```typescript
type ArchiveIssue = {
  issueNumber: number
  publishDate: string          // ISO-8601 string e.g. "2025-06-05"
  slug: string                 // used for href="/issue/{slug}"
  bonusType: BonusType
  charity: {
    name: string               // charity name for card headline
    slug: string               // available but not displayed per UI-SPEC
    location: string           // available but not displayed in compact card
    focusArea: string | null   // displayed as meta line
    assetRange: string | null  // displayed as meta line
  }
}
```

**Not in ArchiveIssue (important):** `missionStatement`, `theme.primaryColor`, `foundingYear`. The UI-SPEC correctly uses `focusArea` and `assetRange` as the two meta fields. There is no per-card accent color available from the archive query — CardSwap uses the house `--color-primary` for all cards equally.

**Confirmed: no new GROQ query needed.** The existing `QUERY_ARCHIVE` provides all required fields.

### `apps/web/lib/theme.ts` — READ ONLY

- `FONT_WHITELIST`: `['Playfair Display', 'Lora', 'Inter', 'Cormorant Garamond', 'Merriweather', 'DM Serif Display']` — 6 entries, frozen. Do NOT modify.
- `validateHex`, `validateFont`, `serializeThemeCss`, `applyTheme` — DO NOT touch any function.
- Phase 11 does not use theme.ts at all (CardSwap reads CSS variables, not theme injection).

---

## Tripwire Test Inventory

All tests must stay green. Here is what each relevant test asserts and how Phase 11 changes interact:

### `game-sandbox.test.ts`

- Reads `GameSlot.tsx` from disk
- Asserts: no `allow-same-origin`; contains `sandbox="allow-scripts"`; file exists
- **Phase 11 impact:** GameSlot.tsx is NOT touched. Green by default.

### `theme-aa-tones.test.ts`

- Imports `contrastRatio` from `@/lib/theme`
- Tests specific hex values against `#0C0B0A` background
- **Phase 11 impact:** No new hex values introduced in `:root`. globals.css additions are class-scoped rules (`.section-card:hover`, `.pitch-card-list`). No new `:root` color variables. Green by default.

### `site-header-nav.test.ts`

- Reads `SiteHeader.tsx`
- Asserts: `aria-expanded`, `aria-controls`, Escape handler, "Open menu", "Close menu"
- **Phase 11 impact:** SiteHeader.tsx is NOT touched. Green by default.

### `issue-page-typography.test.ts`

- Reads `IssueHero.tsx`, `globals.css`, `EditorialSection.tsx`, `CaseStudySection.tsx`, `PortableTextRenderer.tsx`, `app/issue/[slug]/page.tsx`, `ShopCallout.tsx`, `GameSlot.tsx`
- DES-04 assertion: IssueHero has ≥2 `["']eyebrow` matches — currently 5 (one on `<p>` + four `<span className="eyebrow">`). After word-span change, eyebrow spans are untouched. Count stays at 5. **Green.**
- DES-06 assertions: `globals.css` still defines `--color-primary`, `--color-accent`, `--color-bg`, `--color-text` — these are existing `:root` rules, untouched. **Green.**
- DES-06: `GameSlot.tsx` has `sandbox="allow-scripts"` and no `allow-same-origin` — untouched. **Green.**
- DES-06: issue page is a Server Component — untouched. **Green.**

### `deliberation-no-model-names.test.ts`

- Reads `DeliberationSlot.tsx`, strips comments, checks for `modelVersions`, `run?.cost`, `run.cost`, and model-name literals
- **Phase 11 impact:** New code adds `useRef`, `useState`, `useEffect`, `IntersectionObserver`. None of these trigger the forbidden patterns. The new code reads `editorConfidence` (a local variable already present). It does NOT read `run?.cost` or `modelVersions`. **Green** if written correctly.
- **Risk:** An accidental copy-paste introducing a comment with "claude" or "sonnet" would fail. The test strips comments via `codeOnly()`, so only code literals are checked. Still, avoid all model-name strings in new code.

### All other test files

Phase 11 does not touch: `checkout-create-session`, `deliberation-advocate-scores`, `deliberation-agent-cards`, `deliberation-qa-severity`, `deliberation-subscriptions`, `game-validator`, `issue-page-shop-callout`, `legal-pages`, `podcast-slot`, `shop-page`, `stripe-webhook*`, `thank-you-source`. All green by default.

---

## Common Pitfalls

### Pitfall 1: Hero word spans trapped at opacity 0 without animation

**What goes wrong:** If `opacity: 0` or `clip-path: inset(0 0 100% 0)` is set as a base inline style on the word spans (outside `@keyframes from {}`), then under `prefers-reduced-motion` the animation is collapsed to ~0ms, the `from {}` state applies, and then the `to {}` state applies immediately — but if the values are also set as base styles, the spec cascade may leave them invisible after animation.

**Why it happens:** Confusing "initial animation state" with "base element style."

**How to avoid:** Set `opacity` and `clip-path` ONLY inside `@keyframes from {}`. The word span's base style has no `opacity` or `clip-path`. The `animation: heroWordReveal ... both` fill mode handles the pre-animation state.

**Warning signs:** Under reduced-motion (in devtools), charity name not visible on load.

### Pitfall 2: CardSwap timer not cleaned up

**What goes wrong:** `setInterval` inside `useEffect` without `clearInterval` in the cleanup function causes the timer to keep running after the component unmounts, triggering state updates on an unmounted component.

**How to avoid:** Always store the interval ID in a ref and call `clearInterval(intervalRef.current)` in the `useEffect` cleanup return and on `mouseenter`.

### Pitfall 3: IntersectionObserver not disconnected

**What goes wrong:** If the observer is not disconnected after firing, it will continue to call the callback on each intersection event, potentially re-triggering the count-up animation.

**How to avoid:** Call `observer.disconnect()` inside the callback after first intersection fires. Use a `useRef` one-shot guard (`animatedRef.current = true`) as defense-in-depth. Also disconnect in `useEffect` cleanup.

### Pitfall 4: DeliberationSlot count-up showing `0` under reduced-motion

**What goes wrong:** If the `prefersReducedMotion` early-return branch skips `setDisplayValue(target)`, the displayed value stays at `0` forever.

**How to avoid:** Under reduced-motion, the IntersectionObserver still fires but skips the rAF loop and instead calls `setDisplayValue(target)` directly. The value must update — only the animation is skipped, not the final value assignment.

**Warning signs:** Under reduced-motion, confidence shows "0%" instead of the real value.

### Pitfall 5: CardSwap card link vs button conflict

**What goes wrong:** Making the entire card a `<button>` that calls navigate is wrong because navigation should use `<a>`. If the card is an `<a>`, the prev/next controls and indicator dots must be siblings (not descendants) to avoid nested interactive elements.

**How to avoid:** The front card is `<a href="/issue/{slug}">`. Prev/next `<button>` elements and indicator `<button>` elements are siblings to the card `<a>`, not children. The card link only covers the card face, not the dots.

### Pitfall 6: `formatMonthYear` not imported in CardSwap

**What goes wrong:** CardSwap needs to format `publishDate` (ISO string) as "MAY 2026". This utility already exists in `@/lib/format` (used by ArchiveItem.tsx). Reimplementing it inline would be duplicate code.

**How to avoid:** Import `formatMonthYear` from `@/lib/format` in CardSwap.tsx. Confirm it handles ISO-8601 date strings correctly (same format as ArchiveIssue.publishDate).

---

## Code Examples

### CardSwap: CSS 3D inline style calculation

```tsx
// Source: verified against UI-SPEC geometry + CSS 3D spec
function getCardStyle(relativeIndex: number, isTransitioning: boolean): React.CSSProperties {
  if (relativeIndex === 0) {
    return {
      transform: 'translateZ(0) rotateX(0deg)',
      opacity: 1,
      zIndex: 3,
      transition: isTransitioning
        ? 'transform 500ms cubic-bezier(0.34,1.56,0.64,1), opacity 500ms ease'
        : 'none',
    }
  }
  if (relativeIndex === 1) {
    return {
      transform: 'translateZ(-50px) translateY(18px) rotateX(2deg)',
      opacity: 0.55,
      zIndex: 2,
      transition: isTransitioning
        ? 'transform 500ms cubic-bezier(0.34,1.56,0.64,1), opacity 500ms ease'
        : 'none',
    }
  }
  if (relativeIndex === 2) {
    return {
      transform: 'translateZ(-100px) translateY(36px) rotateX(4deg)',
      opacity: 0.35,
      zIndex: 1,
      transition: isTransitioning
        ? 'transform 500ms cubic-bezier(0.34,1.56,0.64,1), opacity 500ms ease'
        : 'none',
    }
  }
  // Hidden cards
  return { opacity: 0, pointerEvents: 'none', zIndex: 0, transition: 'none' }
}
```

### DeliberationSlot: reduced-motion-safe count-up hook pattern

```tsx
// Source: based on DeliberationSlot.tsx existing patterns
// Add to existing DeliberationSlot.tsx imports: useRef (already available via React)
// prefersReducedMotion is already declared at module scope

const confidenceSectionRef = useRef<HTMLDivElement>(null)
const [displayValue, setDisplayValue] = useState(0)
const animatedRef = useRef(false)

useEffect(() => {
  if (editorConfidence === null) return
  const target = Math.round(editorConfidence * 100)

  if (prefersReducedMotion) {
    setDisplayValue(target)
    return
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !animatedRef.current) {
        animatedRef.current = true
        observer.disconnect()
        const duration = 1200
        const start = performance.now()
        function tick(now: number) {
          const elapsed = now - start
          const t = Math.min(elapsed / duration, 1)
          setDisplayValue(Math.round(t * target))
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    },
    { threshold: 0.4 },
  )
  const el = confidenceSectionRef.current
  if (el) observer.observe(el)
  return () => observer.disconnect()
}, [editorConfidence])
// Note: prefersReducedMotion is module-scope (not reactive), so it's fine to omit from deps
```

### globals.css scroll-snap addition

```css
/* ── PHASE 11 — Archive CardSwap + Motion Polish ─────────────────────────── */

/* MOT-02: hover translate on section navigator cards (additive — one new value) */
.section-card:hover {
  /* existing values preserved; this adds transform */
  transform: translateY(-4px);
}

/* MOT-03: Pitch-card scroll-snap carousel on narrow screens */
.pitch-card-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 959px) {
  .pitch-card-list {
    flex-direction: row;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .pitch-card-list::-webkit-scrollbar {
    display: none;
  }
  .pitch-card-list > [role="listitem"] {
    scroll-snap-align: start;
    flex: 0 0 85vw;
    max-width: 400px;
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| GSAP for CSS-3D card stacks | Native CSS `perspective` + `transform-style: preserve-3d` | No new deps; GSAP locked by CONTEXT.md decision |
| `framer-motion` for clip-path reveals | CSS `@keyframes` + `animation-delay` inline style | No new deps; works in Server Components |
| `window.onscroll` for intersection | `IntersectionObserver` | Standard; no scroll jank; already used in modern browsers |
| `setTimeout` for animation timing | `requestAnimationFrame` | Smoother; automatically pauses in background tabs |
| JS-driven scroll carousel | CSS `scroll-snap-type: x mandatory` | No JS; keyboard accessible; native gesture support |

**Deprecated/outdated:**
- `transform-style: preserve-3d` on individual cards without the parent `perspective`: each card needs the parent's perspective context. The scene wrapper must have `perspective: 1200px` and the cards themselves have `transform-style: preserve-3d` if they have children. For flat cards (no backface content), `transform-style` is not strictly required on the cards — only `perspective` on the scene parent.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 11 is purely web frontend code changes. No external tools, services, CLIs, runtimes, or databases are added. All required browser APIs (`IntersectionObserver`, `requestAnimationFrame`, `matchMedia`, CSS scroll-snap) are available in all modern browsers and require no installation.

---

## Validation Architecture

`workflow.nyquist_validation` is `true` in `.planning/config.json`. Include validation section.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.0 |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `pnpm --filter web test:unit` |
| Full suite command | `pnpm --filter web test:unit` (same — all tests in `__tests__/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ARC-01 | CardSwap binds to real `ArchiveIssue[]`, no hardcoded content | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0: `__tests__/archive-cardswap.test.ts` |
| ARC-01 | `package.json` unchanged (no new npm dep) | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0 |
| ARC-01 | No CDN `<script>` tags in CardSwap.tsx | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0 |
| ARC-01 | CardSwap auto-cycle disabled under `prefers-reduced-motion` (timer not started) | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0 |
| ARC-01 | Indicator dots have `aria-label="Issue N"` and `aria-current` | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0 |
| ARC-01 | CardSwap wrapper has `data-print-hide="true"` | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0 |
| MOT-01 | `<h1>` contains word spans (charity name split) | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0: `__tests__/issue-hero-motion.test.ts` |
| MOT-01 | Word spans have no base `opacity: 0` or `clip-path` style (only in `@keyframes from`) | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0 |
| MOT-01 | IssueHero.tsx still has ≥2 `.eyebrow` usages (DES-04 inheritance) | source-scan (existing) | `pnpm --filter web test:unit` | ✅ `issue-page-typography.test.ts` |
| MOT-02 | `.section-card:hover` has `transform: translateY` in globals.css | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0 |
| MOT-02 | `SectionNavigator.tsx` magnetic glow `prefersReducedMotion` early-return preserved | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0 |
| MOT-03 | `DeliberationSlot.tsx` has `IntersectionObserver` for count-up | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0 |
| MOT-03 | `prefersReducedMotion` branch sets `displayValue` to final value (not 0) | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0 |
| MOT-03 | `.pitch-card-list` in globals.css has `scroll-snap-type` | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0 |
| DEL-04 | `DeliberationSlot.tsx` no model names after Phase 11 changes | source-scan (existing) | `pnpm --filter web test:unit` | ✅ `deliberation-no-model-names.test.ts` |
| Security | `GameSlot.tsx` unchanged: `sandbox="allow-scripts"`, no `allow-same-origin` | source-scan (existing) | `pnpm --filter web test:unit` | ✅ `game-sandbox.test.ts` |
| Security | `FONT_WHITELIST` unchanged in `theme.ts` | source-scan (new) | `pnpm --filter web test:unit` | ❌ Wave 0 |
| WCAG | No new `:root` hex values (theme-aa-tones inherits) | source-scan (existing) | `pnpm --filter web test:unit` | ✅ `theme-aa-tones.test.ts` |
| Constraint | Single `<main>`: CardSwap uses `<section>` not `<main>` | source-scan | `pnpm --filter web test:unit` | ❌ Wave 0 |
| Build | `pnpm --filter web build` passes TypeScript check | build | `pnpm --filter web build` | N/A (manual check) |

### Sampling Rate

- **Per task commit:** `pnpm --filter web test:unit`
- **Per wave merge:** `pnpm --filter web test:unit` + `pnpm --filter web build`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

New test files to create before or alongside implementation:

- [ ] `apps/web/__tests__/archive-cardswap.test.ts` — covers ARC-01: source-scan of CardSwap.tsx (no hardcoded content, no CDN scripts, data-print-hide, reduced-motion guard present, indicator aria-labels, no `<main>`); source-scan of archive/page.tsx (imports CardSwap); package.json unchanged (no new "dependencies" keys vs baseline)
- [ ] `apps/web/__tests__/issue-hero-motion.test.ts` — covers MOT-01: source-scan of IssueHero.tsx (contains `.split`, contains `animationDelay`, no base `opacity: 0` outside keyframes, no `clip-path` as inline style outside keyframes; eyebrow count ≥2 inherited from existing test)
- [ ] `apps/web/__tests__/motion-polish.test.ts` — covers MOT-02 + MOT-03: source-scan of globals.css (`.section-card:hover` has `translateY`, `.pitch-card-list` has `scroll-snap-type`); source-scan of DeliberationSlot.tsx (has `IntersectionObserver`, has `setDisplayValue`, no model names — inherits existing DEL-04 assertions); source-scan of SectionNavigator.tsx (still has `prefersReducedMotion` early-return)
- [ ] Add to `archive-cardswap.test.ts`: `FONT_WHITELIST` source-scan of theme.ts (array length still 6, no new entries)

**Pattern:** All new tests follow the established `readFileSync` + source-scan pattern from `game-sandbox.test.ts` and `issue-page-typography.test.ts`. No DOM, no React render, no mocks. Pure file content grep assertions. This pattern works correctly with the `node` test environment in `vitest.config.ts`.

---

## Open Questions

1. **`formatMonthYear` function signature**
   - What we know: `ArchiveItem.tsx` imports `formatMonthYear` from `@/lib/format` and calls `formatMonthYear(issue.publishDate)`. The output in the archive list looks like "May 2026" based on context.
   - What's unclear: The exact return format (lowercase "May 2026" vs uppercase "MAY 2026"). CardSwap's UI-SPEC wants "MONTH YYYY" in uppercase (e.g., "ISSUE 09 · MAY 2026"). CardSwap may need `.toUpperCase()` on the result or its own `toLocaleString` call.
   - Recommendation: Import and call `formatMonthYear`, apply `.toUpperCase()` for the CardSwap eyebrow label. If `lib/format.ts` doesn't export `formatMonthYear`, it's a minor utility to add inline.

2. **Archive page `<div>` structure for CardSwap insertion**
   - What we know: The archive page currently renders: `<div className="mx-auto max-w-[1100px] px-4 py-12 md:px-6 lg:px-8">` > heading > description > `<div className="mt-8">` > `<ArchiveList>`. The `max-w-[1100px]` column provides the centering context.
   - What's unclear: Should CardSwap go inside the `max-w-[1100px]` wrapper (inheriting centering + padding) or as a full-bleed section above it?
   - Recommendation: Place CardSwap INSIDE the `max-w-[1100px]` wrapper, before the `<div className="mt-8">` that wraps ArchiveList. This matches the UI-SPEC statement: "Container is centered within the archive page's existing `max-w-[1100px]` column."

3. **`useEffect` dependency array for DeliberationSlot count-up**
   - What we know: `editorConfidence` is derived from `editorEvent` which derives from `events` (a Convex `useQuery` result). On initial render, `events` may be `undefined`, making `editorConfidence` null. The effect re-runs when `editorConfidence` changes from null to a real value.
   - What's unclear: Whether the `animatedRef.current` guard is sufficient to prevent double-animation on subsequent re-renders after the data loads.
   - Recommendation: The `animatedRef.current = true` guard (set before the rAF loop) is sufficient — once true, the IntersectionObserver callback early-returns on all subsequent firings. The `useEffect` dependency on `editorConfidence` is correct.

---

## Sources

### Primary (HIGH confidence)

- Live source file: `apps/web/components/archive/ArchiveList.tsx` — props, filtering, rendering confirmed
- Live source file: `apps/web/app/archive/page.tsx` — data fetching, current render structure confirmed
- Live source file: `apps/web/components/issue/IssueHero.tsx` — Server Component, `<h1>` structure, eyebrow count confirmed
- Live source file: `apps/web/components/issue/SectionNavigator.tsx` — existing magnetic glow JS, reduced-motion early-return confirmed
- Live source file: `apps/web/components/issue/DeliberationSlot.tsx` — 'use client', Convex hooks, confidence meter location, pitch card container, DEL-04 guarded sections confirmed
- Live source file: `apps/web/components/issue/Atmosphere.tsx` — scroll-progress pattern (reference for reduced-motion early-return pattern)
- Live source file: `apps/web/app/globals.css` — existing tokens, `.section-card:hover` rule, `@media (prefers-reduced-motion)` guard, print stylesheet confirmed
- Live source file: `apps/web/lib/theme.ts` — FONT_WHITELIST (6 entries, frozen), security contract confirmed read-only
- Live source file: `apps/web/lib/sanity/queries.ts` — QUERY_ARCHIVE fields confirmed
- Live source file: `apps/web/lib/sanity/types.ts` — ArchiveIssue type shape confirmed
- Live source file: `apps/web/__tests__/game-sandbox.test.ts` — assertions confirmed
- Live source file: `apps/web/__tests__/theme-aa-tones.test.ts` — assertions confirmed
- Live source file: `apps/web/__tests__/site-header-nav.test.ts` — assertions confirmed
- Live source file: `apps/web/__tests__/deliberation-no-model-names.test.ts` — assertions and `codeOnly()` logic confirmed
- Live source file: `apps/web/__tests__/issue-page-typography.test.ts` — all 42 DES-01..DES-06 assertions confirmed; DES-04 eyebrow count requirement confirmed
- Live source file: `apps/web/package.json` — dependency list confirmed; lucide-react ^1.14.0 available
- Live source file: `apps/web/vitest.config.ts` — `environment: 'node'`; `test:unit` command confirmed

### Secondary (MEDIUM confidence)

- MDN CSS `perspective` + `transform-style: preserve-3d` behavior — well-established CSS 3D standard, no verification needed
- MDN `IntersectionObserver` API — standard, widely supported
- React 19 `<style>` in Server Component JSX — React 19 documentation confirms style hoisting to `<head>` with deduplication
- CSS `scroll-snap-type` + `scroll-snap-align` — CSS Scroll Snap specification, Level 1 (widely supported)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new deps; all patterns verified in live source
- Architecture: HIGH — all component shapes read directly from source; data types confirmed from types.ts
- Pitfalls: HIGH — sourced from reading actual code; pitfalls are about what the code currently does/doesn't do
- Test strategy: HIGH — follows established source-scan pattern already used in 4 existing test files

**Research date:** 2026-05-22
**Valid until:** 2026-07-22 (stable — no external dependencies; validity is gated by source file changes, not library updates)
