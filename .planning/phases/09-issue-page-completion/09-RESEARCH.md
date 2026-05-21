# Phase 9: Issue Page Completion + Visual Redesign — Research

**Researched:** 2026-05-21
**Domain:** Next.js 14 App Router / Convex React subscriptions / dark editorial CSS / HTML5 audio / accessibility
**Confidence:** HIGH (all findings grounded in actual codebase files at verified line numbers)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**HYBRID theme model:** Fixed dark atmosphere + structure becomes HOUSE STYLE (void/panel/card backgrounds, grain overlay, aurora gradients, vertical grid, gold-glow hover, section-navigator cards, two-column deliberation layout, hero ghost numeral, progress bar). Per-issue `--color-primary`/`--color-accent` still validated by `apps/web/lib/theme.ts` and drive the highlight/accent layer. Re-express mockup's hardcoded literals as `--color-*` variables using `color-mix()` for glow/tint derivations. `--font-ui` LOCKED (never themed). Dark-default becomes the new `:root` default.

**Hard constraints:**
- Game iframe MUST keep `sandbox="allow-scripts"` ONLY; content routed through `validateEmbedCode` (`apps/web/__tests__/game-sandbox.test.ts` enforces this); mockup's `loadGame()` srcdoc pattern is FORBIDDEN
- Exactly ONE `<main id="main">` per page (owned by `apps/web/app/layout.tsx`); bonus section is `<section>`, not `<main>`
- Mobile nav MUST NOT disappear — real hamburger/disclosure required at ≤960px
- ALL animation MUST respect `prefers-reduced-motion: reduce` guard already in `apps/web/app/globals.css`; JS-driven motions need explicit `matchMedia` early-returns
- WCAG AA: secondary tones must pass AA — `--cream-mute #615B4D` REJECTED, replace with `#938A77` (5.8:1 on dark bg); ember (`#C2502A`) is AA-large-only (4.19:1), must NOT be used for body-size text; warning note text must use `--color-text-dim` + ember border/icon
- Touch targets ≥44px for all interactive elements (from quick task 260520-0kt)
- Print stylesheet must strip chrome to black-on-white serif — dark atmosphere is screen-only
- `apps/web/lib/theme.ts` security contract NOT modified this phase: no new injection path, no `cssText` or `innerHTML` from theme values, `setProperty` only, `validateHex` + `FONT_WHITELIST` gate unchanged

**Fonts:**
- `Cormorant Garamond` — ALREADY in `FONT_WHITELIST` (theme.ts line 52)
- `Spectral` (body) and `IBM Plex Mono` (UI) — NOT whitelisted; PENDING Andrew/designer approval + WeasyPrint PDF compatibility check; phase ships with whitelisted fallbacks (Lora for body, Inter for UI); do NOT add them to `FONT_WHITELIST` without recording Andrew approval in STATE.md

**Data binding — no hardcoded content:**
- Article prose → Sanity Portable Text via existing `PortableTextRenderer`
- Pull-quotes → **UNRESOLVED** (planner must pin down: dedicated Sanity field vs. extraction rule) — do NOT hardcode mockup fixture quotes
- Deliberation → live Convex subscriptions (5 tables), keyed on `issue.runId`
- Hero meta → charity + issue Sanity fields
- Podcast → real `podcast.audioFile.asset->url` + transcript; "Audio coming soon." empty state
- Agent identity → Sanity `QUERY_AGENT_PROFILES` (§1.6) — NOT yet in queries.ts

**No-model-names rule (DEL-04 — CRITICAL SECURITY):** NO underlying model name ("Claude", "GPT", "Sonnet", "Haiku", "OpenRouter", "written by AI", etc.) anywhere in the deliberation UI, agent cards, payloads surfaced to the reader, tooltips, or alt text. Agents are named personas ONLY (`agentProfile.displayName`). The executor MUST NOT render `pipelineRuns.cost.modelVersions` or any model string to the reader. `pipelineRuns.cost` is a JSON string containing `modelVersions` (agent_id → model name dict) — this field must never reach the frontend render path.

### Claude's Discretion

- Section-navigator magnetic-glow implementation detail (JS mousemove vs CSS-only approach)
- Exact pull-quote extraction rule (if decided to extract rather than dedicated Sanity field)
- Confidence count-up implementation (JS interval vs CSS counter animation — both must early-return under reduced-motion)
- Atmosphere layer implementation: single `Atmosphere.tsx` component vs inline in issue layout
- Whether to implement custom audio player chrome or use native `<audio controls>` styled with CSS

### Deferred Ideas (OUT OF SCOPE)

- Phase 10 editorial design pass (superseded by Phase 9 — do not treat as separate)
- Suno API integration (V2-01)
- NotebookLM API integration (V2-02)
- Automatic weekly cron trigger (V2-03)
- Andrew accept/reject of QA corrections (Sanity Studio concern, not reader surface)
- `/agents/[agentId]` full agent profile page (Phase 9 only needs the LINK to that route; route creation can be a stub)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DEL-01 | Issue page subscribes via `useQuery` to all five Convex tables filtered by `issue.runId` | `ConvexClientProvider` already mounted in root layout; `convex/react` installed; all 5 query functions deployed; `issue.runId: string | null` already on Issue type; `"skip"` sentinel pattern confirmed for null-runId safety |
| DEL-02 | Deliberation UI renders advocate score bars, QA severity colors, agent identity cards (using agentProfile from Sanity), and a pitch log timeline | `agentVotes` has NO score field — scores come from `deliberationEvents` payload for `advocate-argument` events (`{ charityName, argument, score }`); QA severity values: `info|warning|error` (schema.ts truth); `QUERY_AGENT_PROFILES` documented in API_CONTRACTS §1.6 but MISSING from queries.ts — must add |
| DEL-03 | Deliberation UI is collapsed by default; reader can expand | `<details>/<summary>` progressive enhancement already used in current `DeliberationSlot.tsx` stub — keep and extend |
| DEL-04 | Deliberation UI does NOT expose underlying model names | `pipelineRuns.cost` is a JSON string with `modelVersions` dict — must NEVER render; agent cards bind only to `agentProfile.displayName`; `AgentProfile` type missing from types.ts — must add |
| DEL-05 | Graceful empty states for issues that predate Convex writes | Issue with `runId === null` OR all queries return `[]` → "This issue predates the open deliberation record." inside the collapsed section |
| DEL-06 | Each agent event links back to the agent's agentProfile page | Link target is `/agents/[agentId]` — route does NOT exist; Phase 9 must create a stub or minimal page at that route |
| POD-01 | HTML5 `<audio>` player when `podcast.audioFile` is populated | `PodcastSlot.tsx` already has functional `<audio controls src={audioUrl}>` logic — needs dark editorial restyle only |
| POD-02 | Collapsible transcript when `podcast.deliberationTranscript` populated | `PodcastSlot.tsx` already has `transcript && <details>` pattern — update label text to "Read full deliberation transcript", restyle |
| POD-03 | "Audio coming soon." empty state when `podcast.audioFile` is empty | `PodcastSlot.tsx` already has the null-audioUrl empty state — verify copy is "Audio coming soon." (period, no exclamation), restyle |
</phase_requirements>

---

## Summary

Phase 9 is a compound phase: a full visual redesign of the issue page to adopt the dark editorial art direction from `mockup-reference.html`, PLUS completion of two functional areas (deliberation layer with live Convex subscriptions, podcast section). The UI-SPEC at `09-UI-SPEC.md` is the visual + interaction source of truth; this research grounds the implementation in what actually exists vs. what must be built.

**Good news:** The Convex infrastructure is fully deployed and ready — `ConvexClientProvider` wraps the whole app (`apps/web/app/layout.tsx:128-129`), all five query functions are live (`convex/pipelineRuns.ts`, `convex/deliberationEvents.ts`, etc.), the `issue.runId` field is already typed and available in the page, and `PodcastSlot.tsx` already satisfies POD-01/02/03 functionally. `GameSlot.tsx` provides the canonical pattern for `'use client'` + `useMutation` + runId-null guard.

**Bad news (gaps that must ship in Phase 9):** `DeliberationSlot.tsx` is a pure stub with no props and no Convex wiring. `QUERY_AGENT_PROFILES` is missing from `apps/web/lib/sanity/queries.ts`. The `AgentProfile` TypeScript type is missing from `apps/web/lib/sanity/types.ts`. The `/agents/[agentId]` route does not exist. The global CSS tokens for the dark house palette do not exist yet. New layout components (Atmosphere, SectionNavigator, mobile nav disclosure on SiteHeader) must be created. The issue page's `<DeliberationSlot />` call in `page.tsx` passes no props.

**Primary recommendation:** Decompose execution into (1) CSS token foundation — replace `:root` light defaults with the dark house palette in `globals.css`; (2) data-layer additions — add `QUERY_AGENT_PROFILES` to queries.ts, `AgentProfile` type to types.ts, pass `runId` prop to `DeliberationSlot` in page.tsx; (3) rewrite `DeliberationSlot.tsx` with all 5 Convex subscriptions; (4) restyle `PodcastSlot.tsx`; (5) new components (Atmosphere, SectionNavigator); (6) restyle existing components in layout order; (7) SiteHeader mobile nav disclosure.

---

## What Dependencies Already Delivered

These items are complete and functional — Phase 9 must NOT re-implement them, only extend/restyle:

| Item | Evidence | Notes |
|------|----------|-------|
| `ConvexReactClient` + Provider | `apps/web/components/providers/ConvexClientProvider.tsx`; mounted in `apps/web/app/layout.tsx:128-129` | All `useQuery`/`useMutation` hooks work app-wide; graceful degradation when `NEXT_PUBLIC_CONVEX_URL` missing |
| All 5 Convex query functions | `convex/pipelineRuns.ts` (`byRunId`), `convex/deliberationEvents.ts` (`byRunId`), `convex/agentVotes.ts` (`byRunId`), `convex/qaCorrections.ts` (`byRunId`), `convex/pitchLog.ts` (`byRunId`) | All confirmed deployed and functional per CVX-02 |
| `issue.runId` typed and available | `apps/web/lib/sanity/types.ts` (`Issue` type, `runId: string | null`); populated in `apps/web/app/issue/[slug]/page.tsx` via GROQ | Already in the page's data — just not passed to `DeliberationSlot` yet |
| Podcast functional logic | `apps/web/components/issue/PodcastSlot.tsx:22-79` | `audioUrl ? <audio> : "Audio coming soon."` + `transcript && <details>` — correct behavior, needs restyle only |
| `IssuePodcast` type | `apps/web/lib/sanity/types.ts` (`audioUrl`, `podcastDescription`, `deliberationTranscript`, `duration`) | Complete |
| `'use client'` + `useMutation` + runId-null guard pattern | `apps/web/components/issue/GameSlot.tsx:1,32,46,61` | Canonical pattern: check `!runId` before any Convex write; `useMutation(api.qaCorrections.insert)` |
| `QUERY_ISSUE_RUN_ID` | `apps/web/lib/sanity/queries.ts` (§1.7) | Fetches `runId` from `weeklyIssue.pipelineMetadata.runId` |
| Phase 10 typography utilities | `apps/web/app/globals.css` (`.prose-measure`, `.drop-cap`, `.ornament-divider`, `.eyebrow`, `.metadata-block`) | Available for reuse in redesigned sections |
| `prefers-reduced-motion` guard | `apps/web/app/globals.css` (`@media (prefers-reduced-motion: reduce)` block forcing `animation-duration: 0.01ms !important` on `*`) | Guards all CSS animations/transitions; JS motions still need explicit `matchMedia` early-returns |
| Theme injection security | `apps/web/lib/theme.ts` + `apps/web/app/issue/[slug]/layout.tsx` | `serializeThemeCss(theme)` inlined server-side; `ThemeApplier` client-side; hex + font validation; NOT to be modified |
| Game security build guard | `apps/web/__tests__/game-sandbox.test.ts` | Asserts `sandbox="allow-scripts"` present, `allow-same-origin` absent; must remain green |
| lucide-react | Already a dep in `apps/web/package.json` | Do not add a second icon library |
| shadcn/ui Button + Tooltip | Already installed in `apps/web/components/ui/` | The only shadcn components for this phase; no Card/Dialog/Accordion/Tabs/Badge |
| Tailwind v4 with `@theme` | `apps/web/globals.css` | CSS-variable native; no `tailwind.config.*` file |
| Single `<main id="main">` | `apps/web/app/layout.tsx:131` | Root layout owns the only `<main>`; must not be duplicated |
| Skip-link | `apps/web/app/layout.tsx:119-127` | Already first focusable; targets `#main`; from quick task 260520-0kt |
| `next/font/google` fonts | `apps/web/app/layout.tsx:22-50` | Playfair Display (`--font-display-loaded`), Lora (`--font-body-loaded`), Inter (`--font-ui-loaded`) all loaded as CSS variables |

---

## What Phase 9 Must Build

### Data Layer (no visual work)

| Gap | File(s) | Action |
|-----|---------|--------|
| `QUERY_AGENT_PROFILES` missing | `apps/web/lib/sanity/queries.ts` | Add GROQ query per API_CONTRACTS §1.6; returns `[{ agentId, displayName, role, personality, avatarUrl }]` |
| `AgentProfile` TypeScript type missing | `apps/web/lib/sanity/types.ts` | Add type definition |
| `DeliberationSlot` receives no `runId` | `apps/web/app/issue/[slug]/page.tsx:232` | Change `<DeliberationSlot />` to `<DeliberationSlot runId={issue.runId ?? null} />` |

### Rewrite

| Component | File | What |
|-----------|------|------|
| `DeliberationSlot` | `apps/web/components/issue/DeliberationSlot.tsx` | Full rewrite: add `'use client'`; accept `runId: string | null` prop; add 5 `useQuery` subscriptions using `"skip"` sentinel; render two-column layout (pitch log + timeline); agent identity cards; advocate score bars; QA severity rows; editor confidence meter; collapse via `<details>/<summary>`; all loading/empty/error states |

### New Components

| Component | File | What |
|-----------|------|------|
| `Atmosphere` | `apps/web/components/issue/Atmosphere.tsx` (or `apps/web/app/issue/[slug]/layout.tsx`) | `position:fixed` aurora + bg-grid + grain + progress layers; decorative; `aria-hidden`; `pointer-events:none`; all animations in `@media (prefers-reduced-motion: reduce)` guard; JS progress-bar early-return under reduced-motion |
| `SectionNavigator` | `apps/web/components/issue/SectionNavigator.tsx` | 8-card grid; hover glow (`--color-primary`); magnetic-glow JS mousemove (early-return under reduced-motion); ≥44px targets; canonical anchor hrefs |
| `/agents/[agentId]` route | `apps/web/app/agents/[agentId]/page.tsx` | Minimal stub page (DEL-06 requires the link to work; full agent profile is out of scope for this phase) |
| Mobile nav disclosure | In `apps/web/components/SiteHeader.tsx` | Hamburger `<button aria-expanded aria-controls>` toggling menu panel at ≤960px; keyboard-operable; focus-trapped; Escape to close; ≥44px targets; reduced-motion: no slide animation |

### Restyle (logic preserved, visual treatment replaced)

- `apps/web/app/globals.css` — replace `:root` light defaults with dark house palette tokens (all variables from 09-UI-SPEC.md §Token re-expression); extend `@media print` hide-list with new decorative + functional surfaces
- `apps/web/components/SiteHeader.tsx` — fixed dark nav + `.scrolled` scroll-state blur/border
- `apps/web/components/issue/IssueHero.tsx` — ghost numeral; eyebrow; charity `<h1>`; italic mission with ember border; meta row; scroll cue
- `apps/web/components/issue/EditorialSection.tsx` — `§` section label; display headline; prose via PortableTextRenderer; drop cap on origin-story
- `apps/web/components/issue/CaseStudySection.tsx` — same article treatment + `.metadata-block` footnote panel
- `apps/web/components/issue/GameSlot.tsx` — dark click-to-load UX (existing security path unchanged; test must stay green)
- `apps/web/components/issue/BonusSection.tsx` — `<section id="bonus">` (never `<main>`); dark styling
- `apps/web/components/issue/PodcastSlot.tsx` — dark editorial styling; update transcript label text to "Read full deliberation transcript" / "Hide transcript"; copy "Audio coming soon." verified (period, no exclamation)
- `apps/web/components/issue/ShopCallout.tsx` — dark shop band
- `apps/web/components/PortableTextRenderer.tsx` — 19px/1.85 body `--color-text-dim`; blockquote → pull-quote with `--color-primary` border; link underline `--color-primary`

---

## Architecture Patterns

### Convex `useQuery` with null-runId guard — CANONICAL PATTERN

Source: `convex/.agents/skills/convex-performance-audit/references/subscription-cost.md:158-164` (project's own Convex skill).

```typescript
// In apps/web/components/issue/DeliberationSlot.tsx
'use client'

import { useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'

type Props = { runId: string | null }

export function DeliberationSlot({ runId }: Props) {
  // "skip" sentinel prevents subscription creation when runId is null.
  // Passing undefined to a v.string() arg throws — always use "skip".
  const pitchLog = useQuery(
    api.pitchLog.byRunId,
    runId ? { runId } : 'skip',
  )
  const events = useQuery(
    api.deliberationEvents.byRunId,
    runId ? { runId } : 'skip',
  )
  const votes = useQuery(
    api.agentVotes.byRunId,
    runId ? { runId } : 'skip',
  )
  const corrections = useQuery(
    api.qaCorrections.byRunId,
    runId ? { runId } : 'skip',
  )
  const run = useQuery(
    api.pipelineRuns.byRunId,
    runId ? { runId } : 'skip',
  )
  // ... rest of component
}
```

When `runId` is `null`, ALL five queries skip — no Convex subscription created, no error, no stale data. When `runId` becomes non-null (live run), subscriptions activate automatically.

### Loading / empty / error states

```typescript
// Loading: any query returns undefined
const isLoading = [pitchLog, events, votes, corrections, run].some(q => q === undefined)

// Empty: runId is null OR all queries resolved to empty
const isEmpty = !runId || (
  pitchLog?.length === 0 &&
  events?.length === 0 &&
  votes?.length === 0 &&
  corrections?.length === 0 &&
  !run
)

// Render
if (isLoading) return <p>Loading the deliberation.</p>
if (isEmpty) return <p>This issue predates the open deliberation record.</p>
```

### Advocate score extraction — NOT from agentVotes

`agentVotes` schema (`convex/schema.ts`) has no `score` field. Per API_CONTRACTS §3.4, scores live in `deliberationEvents` payload for `advocate-argument` events:

```typescript
// From deliberationEvents WHERE eventType == 'advocate-argument'
// payload is a JSON string: { charityName: string, argument: string, score: number | null }

const advocateScores: Map<string, number | null> = new Map()
events
  ?.filter(e => e.eventType === 'advocate-argument')
  .forEach(e => {
    try {
      const { charityName, score } = JSON.parse(e.payload)
      advocateScores.set(charityName, score ?? null)
    } catch { /* malformed payload — skip */ }
  })

// Null score copy: "Scores did not complete this cycle."
```

### Agent identity cards — GROQ join + no model names

```typescript
// GROQ query to add to apps/web/lib/sanity/queries.ts
export const QUERY_AGENT_PROFILES = groq`
  *[_type == "agentProfile"] {
    agentId { current },
    displayName,
    role,
    personality,
    "avatarUrl": avatar.asset->url
  }
`

// TypeScript type to add to apps/web/lib/sanity/types.ts
export type AgentProfile = {
  agentId: { current: string }
  displayName: string
  role: string
  personality: string | null
  avatarUrl: string | null
}

// In DeliberationSlot: fetch profiles server-side (or cache in parent)
// Render agent chip: displayName + role (NEVER agentId.current raw, NEVER model string)
// Link: <a href={`/agents/${agentProfile.agentId.current}`}>
```

**Critical:** `pipelineRuns.cost` is a JSON string containing `modelVersions: Record<string, string>` (maps agent_id to model name e.g. "claude-3-5-sonnet"). NEVER parse and render `modelVersions`. Never pass `run.cost` through any render path without explicitly stripping this field.

### CSS token foundation — dark house palette in globals.css

Replace the `:root` light default block in `apps/web/app/globals.css` with the dark house palette. Issue pages still override via `serializeThemeCss(theme)` injected inline `<style>` (existing pattern in `apps/web/app/issue/[slug]/layout.tsx`). All derived tokens use `color-mix()` to track whatever `--color-bg`/`--color-text` the theme resolves to:

```css
:root {
  /* Dark house defaults — issue themes override --color-bg, --color-text,
     --color-primary, --color-accent, --font-display, --font-body */
  --color-bg:            #0C0B0A;
  --color-surface:       #14110D;
  --color-card:          #1A1611;
  --color-card-hover:    #221D16;
  --color-text:          #F0EAD9;
  --color-text-dim:      #A89F8A;
  --color-text-mute:     #938A77;  /* NOT #615B4D — fails AA */
  --color-primary:       #CDA434;
  --color-primary-bright: color-mix(in srgb, var(--color-primary) 78%, white 22%);
  --color-primary-glow:  color-mix(in srgb, var(--color-primary) 40%, transparent);
  --color-accent:        #C2502A;
  --color-scout:         #8A9B7A;  /* house identity — NOT themed */
  --color-advocate:      #6E92B8;  /* house identity — NOT themed */
  --color-line:          color-mix(in srgb, var(--color-text) 8%, transparent);
  --color-line-strong:   color-mix(in srgb, var(--color-text) 16%, transparent);
}
```

### Print stylesheet extension

Add to existing `@media print` block in `globals.css`:

```css
@media print {
  .aurora,
  .bg-grid,
  .grain,
  .progress,
  nav.site-nav,
  .section-navigator,
  .agent-chip,
  .confidence-meter,
  .audio-player,
  [aria-hidden="true"] { display: none !important; }
}
```

### `<details>/<summary>` deliberation collapse — extend existing pattern

`DeliberationSlot.tsx` already uses `<details>/<summary>` (zero-JS, keyboard-operable). Keep it. Phase 9 rewrites the body but preserves the shell:

```tsx
<details id="deliberation" className="deliberation-slot">
  <summary className="deliberation-trigger">
    How this issue was made
    <AnchorCopyButton id="deliberation" />
  </summary>
  {/* two-column grid renders here */}
</details>
```

Chevron rotation on open uses CSS `details[open] .chevron { transform: rotate(180deg); }` — the existing `transition` guard neutralizes it under reduced-motion.

### Reduced-motion for JS animations — explicit early-returns

```typescript
// Pattern for ALL JS-driven motion in Phase 9:
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Confidence count-up
function animateConfidence(target: number, setter: (n: number) => void) {
  if (prefersReducedMotion) { setter(target); return }
  // interval-based animation
}

// Progress bar
window.addEventListener('scroll', () => {
  if (prefersReducedMotion) return
  // update progress bar width
})

// Section-card magnetic glow
card.addEventListener('mousemove', (e) => {
  if (prefersReducedMotion) return
  // update --mx / --my CSS custom properties
})

// IntersectionObserver reveal (CRITICAL — content must never be stuck invisible)
if (prefersReducedMotion) {
  // Immediately add .in to all observed elements
  document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'))
} else {
  // Normal IntersectionObserver setup
}
```

### Audio player pattern

Per the Podcast Contract in 09-UI-SPEC.md, native `<audio controls>` is the accessible fallback and source of truth. Custom dark chrome is additive:

```tsx
{audioUrl ? (
  <figure className="podcast-player">
    {/* Custom chrome (optional enhancement) */}
    <audio
      controls
      src={audioUrl}
      aria-label={`${podcast.podcastDescription ?? 'Episode'} — podcast audio`}
      className="sr-only" // visually hidden if custom chrome present; remove if native only
    />
    {/* Custom styled controls go here */}
  </figure>
) : (
  <p>Audio coming soon.</p>
)}
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Convex real-time subscriptions | Custom WebSocket / polling / SSE | `useQuery(api.table.byRunId, ...)` from `convex/react` | Already installed; handles reconnect, optimistic updates, subscription lifecycle automatically |
| Theme CSS variable injection | Template literals, innerHTML from theme values, new injection path | Existing `serializeThemeCss` + `ThemeApplier` in `apps/web/lib/theme.ts` + `apps/web/app/issue/[slug]/layout.tsx` | Security contract is locked; hex validation + FONT_WHITELIST enforcement already in place |
| Font loading | Manual `<link rel="stylesheet">` to Google Fonts or custom `@font-face` | Existing `next/font/google` variables (`--font-display-loaded`, `--font-body-loaded`, `--font-ui-loaded`) | Already loaded in root layout; zero FOUT; subsetted; CSS variable names are the hook |
| Game sandboxing | Inline `srcdoc` assignment, `loadGame()` pattern from mockup | Existing `validateEmbedCode` + `injectGameHead` in `GameSlot.tsx` | game-sandbox.test.ts enforces this; any other approach fails the build |
| Color contrast checking | Custom contrast math | The `contrastRatio()` already in `apps/web/lib/theme.ts` | Can be imported in unit tests to assert house secondary tones ≥ 4.5:1 |
| Accordion / collapse | Custom animation-based collapse with `overflow:hidden` + `max-height` | `<details>/<summary>` | Zero-JS; keyboard-operable; WCAG-friendly; existing pattern in `DeliberationSlot`; reduced-motion neutralizes transition automatically |
| Icon set | Custom SVGs for chevron, copy, etc. | `lucide-react` (already installed) | Single icon library; consistent stroke width; tree-shakeable |

---

## Common Pitfalls

### Pitfall 1: Rendering pipelineRuns.cost.modelVersions

**What goes wrong:** A developer parses `run.cost` JSON to show "cost" or "run info" and inadvertently renders `modelVersions`, exposing "claude-3-5-sonnet" to readers.
**Why it happens:** `pipelineRuns.cost` is a JSON string (not a structured type) containing both safe fields (totalCost, agentCosts) and the forbidden `modelVersions` field. The schema uses `v.optional(v.string())` with no sub-field types.
**How to avoid:** If rendering cost data at all, parse and destructure, explicitly whitelisting only safe fields: `const { totalCost } = JSON.parse(run.cost); // do NOT spread or render the whole object`.
**Warning signs:** Any variable named `cost`, `modelVersions`, `model`, or containing a model-name string in the render path.

### Pitfall 2: Advocate scores from agentVotes (wrong table)

**What goes wrong:** Developer queries `agentVotes` expecting a `score` field and gets `undefined`, then renders broken score bars or silently shows 0.
**Why it happens:** `agentVotes` schema (`convex/schema.ts`) has no `score` field. API_CONTRACTS §4.4 confirms: "No score field in agentVotes." Scores are in `deliberationEvents` payload for `eventType == 'advocate-argument'`.
**How to avoid:** Extract scores by parsing `deliberationEvents` payload JSON where `eventType === 'advocate-argument'`. Score may be `null` (real Issue 999 case) — render "Scores did not complete this cycle." not 0.
**Warning signs:** `agentVote.score` — property doesn't exist; TypeScript will catch this if `AgentVote` type is properly derived.

### Pitfall 3: Content stuck at opacity:0 under reduced-motion

**What goes wrong:** Reveal animations use `opacity:0` as the default state; under `prefers-reduced-motion: reduce`, the CSS `animation` guard kills the animation but the initial state remains, trapping content invisible.
**Why it happens:** `globals.css` guard sets `animation-duration: 0.01ms` — it makes animations instant, not sets `opacity:1`. If IntersectionObserver is required to add `.in`, and the observer never fires or JS is delayed, content stays hidden.
**How to avoid:** Under reduced-motion, skip the IntersectionObserver entirely and add `.in` (or set `opacity:1`) to all observed elements immediately. Pattern: `if (prefersReducedMotion) { allRevealEls.forEach(el => el.classList.add('in')); return; }`.
**Warning signs:** Elements with `opacity:0` default + class-toggle reveal that have no reduced-motion fallback.

### Pitfall 4: Passing undefined args to useQuery

**What goes wrong:** `useQuery(api.pitchLog.byRunId, { runId: undefined })` throws a Convex validation error at runtime ("Expected string, got undefined").
**Why it happens:** `pitchLog.byRunId` takes `{ runId: string }` (v.string(), not optional). Passing `undefined` or `null` fails Convex schema validation.
**How to avoid:** Always use the `"skip"` sentinel: `useQuery(api.pitchLog.byRunId, runId ? { runId } : "skip")`. When the second arg is `"skip"`, Convex creates no subscription and returns `undefined`.
**Warning signs:** `runId!` non-null assertions, or passing `{ runId: issue.runId ?? '' }` with a fallback empty string (which would query a non-existent runId instead of skipping).

### Pitfall 5: ember (#C2502A) on body-size text

**What goes wrong:** Developer uses `--color-accent` (ember, 4.19:1) for body-size warning note text, failing WCAG AA (requires ≥4.5:1 for text <18px).
**Why it happens:** The "below threshold — human review flagged" copy is naturally styled with an "urgent/warning" color. Ember looks right but fails AA.
**How to avoid:** For the warning note text, use `--color-text-dim` (#A89F8A, 7.5:1). Use ember ONLY for the border/icon/large heading adjacent to the note. Per 09-UI-SPEC.md: "ember constrained to large-text/borders only."
**Warning signs:** Any body-size text (< 18px regular / < 14px bold) in `--color-accent` or `#C2502A`.

### Pitfall 6: Anchor ids diverging from canonical set

**What goes wrong:** New section or navigator link uses mockup's id (e.g. `the-problem`, `the-game`) instead of the canonical id (`problem`, `game`), breaking `AnchorCopyButton` and breaking the section navigator links.
**Why it happens:** The mockup uses slightly different ids. The canonical set is defined in 09-UI-SPEC.md §Anchor-id reconciliation and must be respected exactly.
**How to avoid:** Use exactly these canonical ids: `origin-story`, `problem`, `founder-bio`, `case-study`, `game`, `bonus`, `deliberation`, `podcast`. Section navigator `href="#..."` targets these ids.

### Pitfall 7: Duplicate `<main>` element

**What goes wrong:** A new wrapper component or section emits `<main>` instead of `<section>` or `<article>`, adding a second `<main>` to the page.
**Why it happens:** The mockup has TWO `<main>` elements (article + bonus). This MUST NOT be reproduced.
**How to avoid:** Bonus section is `<section id="bonus">`. Article wrapper is `<article>`. The ONLY `<main id="main">` lives in `apps/web/app/layout.tsx:131`.

### Pitfall 8: Game security regression

**What goes wrong:** Restyling GameSlot inadvertently removes `sandbox="allow-scripts"`, adds `allow-same-origin`, or adopts the mockup's direct `srcdoc` assignment pattern. game-sandbox.test.ts fails.
**Why it happens:** The mockup's `loadGame()` function assigns `srcdoc` directly without going through `validateEmbedCode`. It's visually identical to the secure pattern but fundamentally different.
**How to avoid:** Keep the existing `validateEmbedCode` + `injectGameHead` path. Only change the visual wrapper (click-to-load placeholder styling). Run `npm run test:unit` in `apps/web/` after any GameSlot change to verify test still passes.

---

## Code Examples

### Adding QUERY_AGENT_PROFILES to queries.ts

```typescript
// Source: API_CONTRACTS.md §1.6
// Add to apps/web/lib/sanity/queries.ts

export const QUERY_AGENT_PROFILES = groq`
  *[_type == "agentProfile"] | order(agentId.current asc) {
    "agentId": agentId.current,
    displayName,
    role,
    personality,
    "avatarUrl": avatar.asset->url
  }
`
```

### Adding AgentProfile type to types.ts

```typescript
// Add to apps/web/lib/sanity/types.ts

export type AgentProfile = {
  agentId: string         // agentId.current from Sanity slug
  displayName: string
  role: string
  personality: string | null
  avatarUrl: string | null
}
```

### Passing runId to DeliberationSlot in page.tsx

```tsx
// apps/web/app/issue/[slug]/page.tsx line ~232
// Change from:
<DeliberationSlot />
// To:
<DeliberationSlot runId={issue.runId ?? null} />
```

### QA severity color mapping

```typescript
// Source: convex/schema.ts + 09-UI-SPEC.md §QA severity color-coding
// qaCorrections.severity is 'info' | 'warning' | 'error' (schema.ts truth)
// NOTE: API_CONTRACTS §3.6 shows legacy 'minor|moderate|major' — OUTDATED. Use schema.ts.

const QA_SEVERITY_COLOR: Record<string, string> = {
  info:    'var(--color-text-dim)',
  warning: 'var(--color-primary)',
  error:   'var(--color-accent)',
}

const QA_SEVERITY_LABEL: Record<string, string> = {
  info:    'Info',
  warning: 'Warning',
  error:   'Error',
}

// Always render BOTH label and color (WCAG 1.4.1 — color not sole signal):
// <span style={{ color: QA_SEVERITY_COLOR[correction.severity] }}>
//   {QA_SEVERITY_LABEL[correction.severity]}
// </span>
```

### Confidence meter with reduced-motion early-return

```typescript
// Source: 09-UI-SPEC.md §Motion Contract
function renderConfidence(confidence: number | null) {
  const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // confidence is editor_confidence from editor-decision event payload
  // Below 0.70 → ember warning note (text in --color-text-dim, ember border/icon)
  const belowThreshold = confidence !== null && confidence < 0.70

  // Count-up animation: skip under reduced-motion
  if (prefersReducedMotion) {
    // Set immediately to final value
  } else {
    // interval-based count-up from 0 to confidence * 100
  }
}
```

### Atmosphere component reduced-motion pattern

```tsx
// apps/web/components/issue/Atmosphere.tsx
'use client'

import { useEffect } from 'react'

export function Atmosphere() {
  useEffect(() => {
    const prefersReducedMotion =
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const updateProgress = () => {
      if (prefersReducedMotion) return
      const pct = window.scrollY / (document.body.scrollHeight - window.innerHeight) * 100
      document.documentElement.style.setProperty('--scroll-progress', `${pct}%`)
    }

    window.addEventListener('scroll', updateProgress, { passive: true })
    return () => window.removeEventListener('scroll', updateProgress)
  }, [])

  return (
    <>
      <div className="aurora" aria-hidden="true" />
      <div className="bg-grid" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <div className="progress" aria-hidden="true" />
    </>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 10 separate editorial pass | Phase 9 SUPERSEDES Phase 10 with full dark redesign | 2026-05-20 (09-CONTEXT.md) | Phase 10 is no longer a separate phase; its requirements (DES-01..06) are delivered here |
| `--cream-mute #615B4D` (mockup) | `--color-text-mute #938A77` (spec correction) | 09-UI-SPEC.md §Color WCAG AA gate | #615B4D fails AA (2.9:1); #938A77 passes (5.8:1) |
| `minor|moderate|major` severity (API_CONTRACTS §3.6 legacy) | `info|warning|error` (schema.ts + Phase 5) | Phase 5 | Use schema.ts values; API_CONTRACTS §3.6 is stale |
| No real mobile nav (mockup hides at ≤960px) | Real hamburger disclosure required | 09-CONTEXT.md locked | WCAG + product constraint |
| `agentVotes.score` (incorrect assumption) | Score in `deliberationEvents` payload for `advocate-argument` | Phase 5 schema design | Must parse event payload, not agentVotes |

---

## Open Questions

1. **Pull-quote data source (BLOCKER for EditorialSection restyle)**
   - What we know: 09-UI-SPEC.md says "see Data Binding" for pull-quotes; 09-CONTEXT.md says "a designated source (a Sanity highlight field OR an explicit extraction rule)"
   - What's unclear: Neither a dedicated `highlight` field nor an extraction rule exists today in `schemas/weeklyIssue.ts`
   - Recommendation: **Planner must decide before EditorialSection task.** Options: (A) add a `pullQuote: text` field to `weeklyIssue.editorialSections[]` in Sanity schema — pipeline would populate it; (B) extraction rule: first `blockquote` in the section's Portable Text body; (C) skip pull-quote rendering entirely until field exists. Option B (blockquote extraction) requires no schema change and no pipeline change — recommend unless Andrew wants curated pull-quotes.

2. **`/agents/[agentId]` page depth**
   - What we know: DEL-06 requires each agent event to LINK to `/agents/[agentId]`; the route does not exist
   - What's unclear: Is a minimal stub page (404-free "Agent profile coming soon") acceptable, or does full agent profile content need to ship with Phase 9?
   - Recommendation: Ship a minimal stub (renders agentProfile data from Sanity: displayName, role, personality). Full profile is low-complexity; avoids 404s for DEL-06 links.

3. **Confidence value source**
   - What we know: 09-UI-SPEC.md says "confidence meter from pipelineRuns + editor-decision event payload"
   - What's unclear: Is `editor_confidence` a field on `pipelineRuns` or only in the `editor-decision` event's payload JSON?
   - What to do: Parse `deliberationEvents` for `eventType === 'editor-decision'`, parse payload JSON for `{ charityName, editor_confidence }`. If `pipelineRuns` also has it, prefer the Convex query result for simplicity.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 9 is purely frontend code changes (Next.js components, CSS, TypeScript). No external tools, CLIs, databases, or services beyond the already-deployed Convex project and the Next.js build environment.

---

## Validation Architecture

nyquist_validation is enabled (`workflow.nyquist_validation: true` in `.planning/config.json`).

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.2.0 |
| Config file | `apps/web/vitest.config.ts` |
| Quick run command | `cd apps/web && npm run test:unit` (runs `vitest run`) |
| Full suite command | `cd apps/web && npm run test:unit` (same — full suite is in `__tests__/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEL-01 | All 5 Convex subscriptions wired, runId-null-safe | unit | `cd apps/web && npm run test:unit -- __tests__/deliberation-subscriptions.test.ts` | ❌ Wave 0 |
| DEL-02 | Advocate scores extracted from deliberationEvents payload (not agentVotes) | unit | `cd apps/web && npm run test:unit -- __tests__/deliberation-advocate-scores.test.ts` | ❌ Wave 0 |
| DEL-02 | QA severity colors: info→text-dim, warning→primary, error→accent | unit | `cd apps/web && npm run test:unit -- __tests__/deliberation-qa-severity.test.ts` | ❌ Wave 0 |
| DEL-04 | No model names rendered — pipelineRuns.cost.modelVersions never in output | unit (source scan, like game-sandbox.test.ts) | `cd apps/web && npm run test:unit -- __tests__/deliberation-no-model-names.test.ts` | ❌ Wave 0 |
| DEL-05 | Empty state when runId null | unit | `cd apps/web && npm run test:unit -- __tests__/deliberation-subscriptions.test.ts` | ❌ Wave 0 |
| POD-01/02/03 | Audio player / transcript / empty state logic | unit | `cd apps/web && npm run test:unit -- __tests__/podcast-slot.test.ts` | ❌ Wave 0 |
| GAM-01/03 | Game sandbox — must remain green after restyle | unit (source scan) | `cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts` | ✅ EXISTS |
| AA tones | House secondary tones pass AA (≥4.5:1 against #0C0B0A) | unit | `cd apps/web && npm run test:unit -- __tests__/theme-aa-tones.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts` (game security tripwire — must stay green after any GameSlot change)
- **Per wave merge:** `cd apps/web && npm run test:unit` (full suite)
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `apps/web/__tests__/deliberation-subscriptions.test.ts` — covers DEL-01, DEL-05 (useQuery with skip sentinel, null-runId returns empty state)
- [ ] `apps/web/__tests__/deliberation-advocate-scores.test.ts` — covers DEL-02 (score extraction from deliberationEvents payload, null-score fallback copy)
- [ ] `apps/web/__tests__/deliberation-qa-severity.test.ts` — covers DEL-02 (severity → color token mapping; label always rendered; no color-only signal)
- [ ] `apps/web/__tests__/deliberation-no-model-names.test.ts` — covers DEL-04 (source-scan style: assert `modelVersions` string never appears in DeliberationSlot source)
- [ ] `apps/web/__tests__/podcast-slot.test.ts` — covers POD-01, POD-02, POD-03 (audio player / transcript / empty state)
- [ ] `apps/web/__tests__/theme-aa-tones.test.ts` — covers WCAG AA constraint (import `contrastRatio` from `lib/theme.ts`; assert each house tone ≥ 4.5:1 on `#0C0B0A`)

---

## Project Constraints (from CLAUDE.md)

| Directive | Constraint |
|-----------|------------|
| Tech stack locked | Next.js 14+ App Router, Sanity v3, Convex, Vercel — no substitutions |
| GSD workflow enforcement | All file edits through a GSD command; no direct repo edits outside GSD workflow |
| Game security | iframe `sandbox="allow-scripts"` ONLY; `validateEmbedCode` required; game-sandbox.test.ts must stay green |
| Theme security | `theme.ts` security contract NOT modified; `setProperty` only; `validateHex` + `FONT_WHITELIST` gate unchanged |
| Jesse's voice | Dry, precise, no winking, no irony signaling; applied to all UI copy |
| No model names | NEVER render agent model strings to reader anywhere in the UI |
| Single `<main id="main">` | Root layout owns the only `<main>`; bonus is `<section>` |
| WCAG AA | All interactive surfaces; secondary tone corrections mandated |
| Touch targets ≥44px | All interactive elements; from quick task 260520-0kt |
| Print stylesheet | Must continue to strip chrome to black-on-white serif |

---

## Sources

### Primary (HIGH confidence)
- `apps/web/components/issue/DeliberationSlot.tsx` — current stub state, no props, no Convex wiring
- `apps/web/components/issue/PodcastSlot.tsx` — functional audio/transcript/empty logic
- `apps/web/components/issue/GameSlot.tsx` — canonical `'use client'` + `useMutation` + runId-null guard pattern
- `apps/web/app/issue/[slug]/page.tsx` — DeliberationSlot receives no props; runId available
- `apps/web/app/layout.tsx` — single `<main id="main">`, ConvexClientProvider wrapping, font variables
- `convex/schema.ts` — all 5 table shapes; `agentVotes` has NO score field; QA severity is `info|warning|error`
- `apps/web/lib/sanity/queries.ts` — `QUERY_ISSUE_RUN_ID` present; `QUERY_AGENT_PROFILES` absent
- `apps/web/lib/sanity/types.ts` — `Issue.runId: string | null` present; `AgentProfile` type absent
- `apps/web/lib/theme.ts` — `FONT_WHITELIST` (Cormorant Garamond in at line 52; Spectral/IBM Plex Mono absent); security contract
- `apps/web/app/globals.css` — reduced-motion guard; Phase 10 utilities; current light `:root`
- `apps/web/vitest.config.ts` — test framework config
- `apps/web/__tests__/game-sandbox.test.ts` — build tripwire; must remain green
- `convex/.agents/skills/convex-performance-audit/references/subscription-cost.md:158-164` — `"skip"` sentinel pattern
- `.planning/phases/09-issue-page-completion/09-UI-SPEC.md` — full visual + interaction contract (approved)
- `.planning/phases/09-issue-page-completion/09-CONTEXT.md` — locked decisions
- `.planning/REQUIREMENTS.md` — DEL-01..06, POD-01..03 (all unchecked = not yet implemented)
- `docs/API_CONTRACTS.md` §1.2, §1.6, §3.4, §4.x — interface shapes; §3.6 severity values STALE (use schema.ts)

### Secondary (MEDIUM confidence)
- `apps/studio/schemas/agentProfile.ts` — confirms `agentId` is slug type (`.current` is the string); `avatar` is `type: 'image'`
- `convex/pipelineRuns.ts`, `convex/deliberationEvents.ts`, `convex/agentVotes.ts`, `convex/qaCorrections.ts`, `convex/pitchLog.ts` — all `byRunId` queries confirmed deployed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in package.json and live files
- Architecture: HIGH — all patterns from actual codebase files at verified line numbers
- Pitfalls: HIGH — derived from schema mismatches and security constraints found in actual files
- Gaps identified: HIGH — verified by checking file contents, not just file existence

**Research date:** 2026-05-21
**Valid until:** 2026-06-21 (30 days; stable codebase)
