---
phase: "09"
plan: "05"
subsystem: apps/web/components/issue
tags: [ui, dark-editorial, component-restyle, game-security, pull-quote]
dependency_graph:
  requires: [09-01-css-tokens-and-data-layer, 09-04-atmosphere-nav-navigator]
  provides: [dark-editorial-components, game-click-to-load-ux]
  affects: [apps/web/app/issue]
tech_stack:
  added: []
  patterns:
    - "Dark editorial house style via CSS custom property tokens"
    - "Click-to-load iframe UX with unchanged security path (validateEmbedCode + injectGameHead)"
    - "Pull-quote rendered from first Portable Text blockquote block (zero schema change)"
    - "animate-ping Tailwind ripple (no custom keyframes in globals.css)"
key_files:
  created: []
  modified:
    - apps/web/components/issue/PortableTextRenderer.tsx
    - apps/web/components/issue/EditorialSection.tsx
    - apps/web/components/issue/CaseStudySection.tsx
    - apps/web/components/issue/IssueHero.tsx
    - apps/web/components/issue/GameSlot.tsx
    - apps/web/components/issue/GameFallback.tsx
    - apps/web/components/issue/BonusSection.tsx
    - apps/web/components/issue/ShopCallout.tsx
decisions:
  - "Kept .eyebrow class alongside § glyph prefix to satisfy Phase 10 source-scan tripwire (42 assertions)"
  - "Used leading-[1.7] in PortableTextRenderer body text — required by Phase 10 tripwire, not 1.85 from UI-SPEC"
  - "GameSlot click-to-load uses useState(started) gating only the render; security path (validateEmbedCode + injectGameHead + insertQaCorrection) runs regardless of started state"
  - "Ripple ring uses Tailwind animate-ping (built-in) rather than custom @keyframes to avoid globals.css modification"
  - "BonusSection stays <section id=bonus> (never <main>) to preserve single-main rule"
metrics:
  duration: "~40 min"
  completed_date: "2026-05-21"
  tasks_completed: 2
  files_modified: 8
---

# Phase 09 Plan 05: Component-Restyle Summary

Dark editorial restyle of 8 issue-page components — PortableTextRenderer, EditorialSection, CaseStudySection, IssueHero, GameSlot (with click-to-load UX), GameFallback, BonusSection, ShopCallout — to the Phase 9 UI-SPEC dark house style using CSS custom property tokens, while preserving GameSlot iframe security and Phase 10 source-scan tripwire contracts.

## Objective Achieved

Both tasks completed. All 8 components restyled to the dark editorial house style (§ label treatment, `--color-primary` display headlines, `--color-surface`/`--color-card` surfaces, `--color-line`/`--color-line-strong` borders). GameSlot gained click-to-load UX with security path unchanged. Tests: `game-sandbox.test.ts` 3/3 ✓, `issue-page-typography.test.ts` 42/42 ✓, full suite 138 passed + 29 pre-existing Phase 8 Stripe failures (out of scope).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | d69d40d | feat(09-05): restyle PortableTextRenderer, EditorialSection, CaseStudySection, IssueHero |
| 2 | df0adcd | feat(09-05): restyle GameSlot, GameFallback, BonusSection, ShopCallout |

## Task 1: PortableTextRenderer, EditorialSection, CaseStudySection, IssueHero

**PortableTextRenderer.tsx:**
- Body paragraphs: `font-body text-[19px] font-light leading-[1.7] text-[color:var(--color-text-dim)]`
- Blockquote → pull-quote: `font-display clamp(26px,3.2vw,38px) font-light italic leading-[1.3] text-[color:var(--color-text)] border-l-2 border-[color:var(--color-accent)] pl-7 my-10`
- h2/h3: `font-display font-normal` (was `font-semibold`); `--color-primary` for h2
- `strong`: `font-medium text-[color:var(--color-text)]`
- Links: underline decoration `--color-primary`
- Lists: `font-light text-[color:var(--color-text-dim)]`

**EditorialSection.tsx:**
- Label row: `§` aria-hidden glyph in `font-ui text-[14px] text-[color:var(--color-accent)]` + `<span className="eyebrow">{label}</span>`
- Headline: `clamp(38px,5vw,64px) font-normal leading-[1.05] tracking-[-0.015em] text-[color:var(--color-primary)]`
- All structure (id, lead, AnchorCopyButton, ornament-divider, prose-measure) preserved

**CaseStudySection.tsx:**
- Same § + `.eyebrow` label treatment
- Headline at `clamp(38px,5vw,64px) font-normal --color-primary`
- Metadata dl, ornament-divider, prose-measure preserved

**IssueHero.tsx:**
- Ghost numeral: `clamp(280px,40vw,560px)` display font, `opacity: 0.025`, `aria-hidden`, `pointer-events-none`, behind content via `zIndex: 0`
- Issue eyebrow `<p>`: `className="eyebrow"` with decorative `h-px w-9` accent line prefix, `text-[color:var(--color-primary)]`
- Charity `<h1>`: `clamp(56px,10.5vw,148px) font-display font-normal leading-[0.92] tracking-[-0.02em] text-[color:var(--color-primary)]` + `textShadow: '0 0 80px var(--color-primary-glow, rgba(205,164,52,.12))'`
- Byline: `font-body text-[16px] italic leading-[1.55] text-[color:var(--color-text-dim)]`
- Mission: `border-l-2 border-[color:var(--color-accent)] pl-6 font-display font-light italic clamp(22px,2.6vw,32px)`
- Meta row: `.eyebrow` spans in `border-t border-b border-[color:var(--color-line)]` container
- PDF link: `min-h-11` touch target preserved

## Task 2: GameSlot, GameFallback, BonusSection, ShopCallout

**GameSlot.tsx:**
- Added `useState(false)` for `started` — gates only the render branch, not the security path
- Click-to-load placeholder: dark `--color-surface` container, 88px play button with `animate-ping` ripple ring (Tailwind built-in; prefers-reduced-motion handled by existing globals.css guard), radial glow overlay
- Iframe still uses `sandbox="allow-scripts"` (one token) + `srcDoc={srcdoc}` (through `injectGameHead`) — security unchanged
- `validateEmbedCode` call, `insertQaCorrection` useEffect (guarded by `reportedRef + !runId + !validation.valid`) all preserved verbatim
- game-sandbox.test.ts tripwire: 3/3 passed

**GameFallback.tsx:**
- Dark `--color-text-mute` text, centered in flex container
- Locked copy "Game unavailable." (period, no exclamation) preserved

**BonusSection.tsx:**
- `<section id="bonus">` kept (not `<main>`)
- § + `.eyebrow` label + sub-label (BIG BUDGET TREATMENT / THE JINGLE / THE SPEC AD)
- Headline: `clamp(38px,5vw,64px) --color-primary`
- bigBudget: storyboard `<img>` with `eslint-disable-next-line @next/next/no-img-element` (backlog 999.1)
- jingle: `<audio controls>` retained; `--color-card` lyrics box
- specAd: body-only

**ShopCallout.tsx:**
- `bg-[color:var(--color-surface)]` + `border-t border-[color:var(--color-line-strong)]`
- Locked copy: "Jesse A. Eisenbalm lip balm. 100% of proceeds go to this week's featured charity."
- Button: `[background-color:var(--color-primary)] text-[color:var(--color-bg)]` (UI-SPEC primary CTA accent-reserved)
- Hover: `[background-color:var(--color-primary-bright)]` + glow shadow
- `min-h-[44px]` touch target + `print:hidden` preserved

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] leading-[1.7] vs leading-[1.85] in PortableTextRenderer**
- **Found during:** Task 1 — running `issue-page-typography.test.ts`
- **Issue:** Initial body text used `leading-[1.85]` matching the UI-SPEC line-height guidance, but Phase 10 source-scan tripwire (line 137) asserts `/leading-\[1\.7\]/`
- **Fix:** Changed to `leading-[1.7]` to satisfy the locked Phase 10 contract
- **Files modified:** `apps/web/components/issue/PortableTextRenderer.tsx`
- **Commit:** d69d40d

**2. [Rule 1 - Bug] EditorialSection removed .eyebrow class breaking Phase 10 tripwire**
- **Found during:** Task 1 — running `issue-page-typography.test.ts`
- **Issue:** Initial rewrite dropped `.eyebrow` class, replacing with custom `font-ui` classes; Phase 10 tripwire line 180-182 asserts `className='eyebrow'` exists
- **Fix:** Kept `<span className="eyebrow">{label}</span>` alongside the new `§` prefix span
- **Files modified:** `apps/web/components/issue/EditorialSection.tsx`
- **Commit:** d69d40d

**3. [Rule 1 - Bug] IssueHero had zero .eyebrow usages breaking Phase 10 tripwire**
- **Found during:** Task 1 — running `issue-page-typography.test.ts`
- **Issue:** Initial rewrite replaced all `.eyebrow` with `font-ui` custom classes; Phase 10 tripwire line 184-188 asserts `matches.length >= 2` for `/["']eyebrow/g`
- **Fix:** Applied `.eyebrow` class on issue label `<p>` and all metadata `<span>` elements
- **Files modified:** `apps/web/components/issue/IssueHero.tsx`
- **Commit:** d69d40d

**4. [Rule 3 - Blocking] GameSlot ripple used custom keyframes unavailable without globals.css**
- **Found during:** Task 2 — design review
- **Issue:** Custom `@keyframes ripple` animation required globals.css modification (out of scope for this plan)
- **Fix:** Switched to Tailwind built-in `animate-ping` which renders correctly; prefers-reduced-motion handled by existing globals.css `animation-duration: 0.001ms` guard
- **Files modified:** `apps/web/components/issue/GameSlot.tsx`
- **Commit:** df0adcd

## Known Stubs

None. All 8 components render from live props (no hardcoded fixtures, no TODO placeholders). The pull-quote derives from the first Portable Text blockquote block in the live section body (zero schema change). ShopCallout accepts a live `shopUrl` prop (Phase 8 populates it; Phase 2 fallback `/shop` preserved).

## Self-Check: PASSED

All 8 modified files exist on disk. Both task commits (d69d40d, df0adcd) confirmed in git log.
