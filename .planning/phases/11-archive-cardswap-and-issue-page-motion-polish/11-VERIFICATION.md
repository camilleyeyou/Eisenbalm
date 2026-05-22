---
phase: 11-archive-cardswap-and-issue-page-motion-polish
verified: 2026-05-21T21:00:00Z
status: passed
score: 5/5 must-haves verified
re_verification: false
human_verification:
  - test: "Load /archive, observe 3D card cycle"
    expected: "Cards auto-advance every ~6s with a 3D perspective-stack effect; hovering pauses the timer; clicking the front card navigates to /issue/{slug}"
    why_human: "CSS 3D animation quality and pointer-interaction timing cannot be asserted by source-scan"
  - test: "Load /issue/[any-slug], observe hero charity-name reveal"
    expected: "Each word of the charity name clips upward and fades in sequentially (80ms stagger); under OS Reduce Motion the name appears instantly on load with no animation"
    why_human: "Animation playback and reduced-motion visual behavior require a browser render"
  - test: "Hover section-navigator cards; toggle OS Reduce Motion"
    expected: "Gold radial glow follows cursor under normal motion; under Reduce Motion glow is centred/static and no mousemove JS fires; cards remain keyboard-focusable at all times"
    why_human: "Cursor-tracking glow is a pointer-event visual that source-scan cannot exercise"
  - test: "Scroll the DeliberationSlot confidence meter into view"
    expected: "Counter animates 0 to its real value over ~1200ms; under Reduce Motion it shows the final value immediately with no count-up"
    why_human: "Scroll-triggered IntersectionObserver animation timing requires a browser render"
  - test: "Spot-check AA contrast on CardSwap badge + SectionNavigator cards"
    expected: "All new surfaces (CardSwap badge text, indicator dots, card copy) meet WCAG AA 4.5:1 contrast ratio against their backgrounds"
    why_human: "Contrast measurement requires rendered pixel values; theme CSS variables are runtime-injected"
---

# Phase 11: Archive CardSwap + Motion Polish — Verification Report

**Phase Goal:** The `/archive` page features a CSS-3D "CardSwap" component cycling through real past published issues (Sanity GROQ), and the dark issue page gains reduced-motion-safe motion polish: hero charity-name clip-path reveal, section-navigator magnetic gold cursor-glow, and deliberation confidence count-up + scroll-snap pitch-card carousel — all data-bound, no hardcoded content, within locked constraints.

**Verified:** 2026-05-21T21:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `/archive` CSS-3D CardSwap cycles real issues, pauses on hover, links to issue, static accessible list under `prefers-reduced-motion` | VERIFIED | `CardSwap.tsx` lines 64-78: `window.matchMedia('prefers-reduced-motion')` gate at mount; `if (reducedMotion) return` skips interval start; front card is `<a href="/issue/{slug}">` with `aria-label`; back cards `aria-hidden="true"`; `archive/page.tsx` line 43 mounts `<CardSwap issues={issues} />` from Sanity `QUERY_ARCHIVE` fetch |
| 2 | Issue hero charity name reveals via clip-path on load; instant under `prefers-reduced-motion` | VERIFIED | `IssueHero.tsx` lines 104-123: `@keyframes heroWordReveal` with `from { clip-path: inset(0 0 100% 0); transform: translateY(12px); opacity: 0 }` inside scoped `<style>` tag; `charity.name.split(' ')` maps to `.hero-word-span` spans with `animationDelay: {i * 80}ms`; `opacity:0` and `clip-path` only inside `@keyframes` (test strips keyframes block + `codeOnly()` to confirm); `globals.css` `prefers-reduced-motion` guard collapses `animation-duration` to `0.01ms` — words show instantly |
| 3 | Section-navigator cards show gold glow; no JS cursor tracking under `prefers-reduced-motion`; targets ≥44px | VERIFIED | `SectionNavigator.tsx` lines 95-100: `prefersReducedMotion` check + early `return` skips mousemove listener registration; `globals.css` line 490: `.section-card` has `min-height: 200px` (well above 44px); `globals.css` line 527: `.section-card:hover { transform: translateY(-4px) }` |
| 4 | Deliberation confidence meter animates 0 to real value on scroll-into-view; instantly under `prefers-reduced-motion`; pitch cards scroll-snap; no model names; Convex subscriptions intact | VERIFIED | `DeliberationSlot.tsx` lines 199-232: `IntersectionObserver` with `threshold: 0.4` triggers rAF count-up; `if (prefersReducedMotion) { setDisplayValue(target); return }` shows final value instantly; pitch container `className="pitch-card-list"` with `role="list"`; `globals.css` lines 612-642: `.pitch-card-list { scroll-snap-type: x mandatory }` base + `@media (min-width: 960px)` desktop override; no model names in component (DEL-04 test green); 5 Convex `useQuery` calls with `'skip'` sentinel byte-unchanged |
| 5 | No new npm deps; FONT_WHITELIST unchanged (6 entries); one `<main>` per page; AA contrast; security tests green | VERIFIED | `package.json` dependencies identical to pre-Phase-11 HEAD (git diff confirms no diff); `FONT_WHITELIST` in `theme.ts` still 6 entries (Playfair Display, Lora, Inter, Cormorant Garamond, Merriweather, DM Serif Display); `CardSwap.tsx` uses `<section>` not `<main>` (grep confirms 0 `<main>` in component); all 91 source-scan tests pass (see test results below); `GameSlot.tsx` last modified in Phase 9 — unchanged by Phase 11 |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web/components/archive/CardSwap.tsx` | CSS-3D card stack, data-bound, reduced-motion-safe | VERIFIED | 263 lines; `'use client'`; accepts `{ issues: ArchiveIssue[] }`; CSS perspective 1200px; `getCardStyle()` per-card 3D transforms; `prefers-reduced-motion` gate via `window.matchMedia`; hover pause/resume; `aria-label`, `aria-current`, `min-h-11 min-w-11` on controls; `data-print-hide="true"`; no CDN imports; no GSAP/framer-motion |
| `apps/web/app/archive/page.tsx` | Imports + mounts CardSwap above ArchiveList | VERIFIED | Line 6: `import { CardSwap }` from `@/components/archive/CardSwap`; line 43: `{issues && issues.length > 0 && <CardSwap issues={issues} />}` — guarded, data-bound to Sanity GROQ result |
| `apps/web/components/issue/IssueHero.tsx` | Word-split h1 with `@keyframes heroWordReveal`, per-span `animationDelay` | VERIFIED | Lines 104-123: `<style>` tag with `@keyframes heroWordReveal`; `charity.name.split(' ')` → `.hero-word-span` spans with `animationDelay: ${i * 80}ms`; no `'use client'`, no hooks; `opacity:0`/`clip-path` exclusively inside `@keyframes from{}` |
| `apps/web/app/globals.css` | `.section-card:hover { transform: translateY(-4px) }` + `.pitch-card-list { scroll-snap-type }` | VERIFIED | Line 527: `transform: translateY(-4px)` in `.section-card:hover`; lines 612-642: `.pitch-card-list` Phase 11 block with `scroll-snap-type: x mandatory` base + `@media (min-width: 960px)` desktop override restoring vertical layout |
| `apps/web/components/issue/DeliberationSlot.tsx` | `IntersectionObserver` count-up, `setDisplayValue`, `pitch-card-list` class, reduced-motion final-value branch | VERIFIED | Lines 197-232: full count-up implementation; line 312: `className="pitch-card-list" role="list"`; each pitch card has `role="listitem" tabIndex={0}`; `sr-only` hint present |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `archive/page.tsx` | Sanity GROQ | `QUERY_ARCHIVE` fetch → `ArchiveIssue[]` props | WIRED | Page fetches real issues; passes array to `<CardSwap issues={issues} />` |
| `archive/page.tsx` | `CardSwap.tsx` | `import { CardSwap }` + JSX render | WIRED | Import at line 6; render at line 43 guarded by `issues && issues.length > 0` |
| `DeliberationSlot.tsx` | Convex | 5 `useQuery` calls with `'skip'` sentinel | WIRED | All 5 subscriptions (`pipelineRuns`, `pitchLog`, `deliberationEvents`, `agentVotes`, `qaCorrections`) intact and unchanged |
| `IssueHero.tsx` | `@keyframes heroWordReveal` | `<style>` tag in Server Component JSX | WIRED | Keyframe defined in `<style>`, class `.hero-word-span` applied to each word span |
| `globals.css` `.section-card:hover` | `SectionNavigator.tsx` | CSS class `section-card` applied to each `<a>` | WIRED | `SectionNavigator` renders `.section-card` anchors; `globals.css` supplies the hover lift and glow via CSS |
| `globals.css` `.pitch-card-list` | `DeliberationSlot.tsx` | `className="pitch-card-list"` on pitch container | WIRED | Container uses the class; `globals.css` Phase 11 block provides scroll-snap behavior |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CardSwap.tsx` | `issues: ArchiveIssue[]` | Sanity `QUERY_ARCHIVE` fetched in `archive/page.tsx` server component | Yes — GROQ query against real Sanity dataset | FLOWING |
| `DeliberationSlot.tsx` | `editorConfidence` | `events` Convex subscription → `editor-decision` payload parse | Yes — live Convex query; graceful null when no data | FLOWING |
| `DeliberationSlot.tsx` | `pitchLog` | Convex `pitchLog.byRunId` subscription | Yes — live Convex query; empty-state guarded | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: Source-scan tests serve as the primary behavioral contract for this phase (no runnable API routes or CLI tools were added). All 91 tests pass as confirmed below.

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 8 Phase 11 test files (91 tests) | `pnpm --filter web test:unit __tests__/archive-cardswap.test.ts __tests__/issue-hero-motion.test.ts __tests__/motion-polish.test.ts __tests__/game-sandbox.test.ts __tests__/theme-aa-tones.test.ts __tests__/deliberation-no-model-names.test.ts __tests__/issue-page-typography.test.ts __tests__/site-header-nav.test.ts` | 91/91 pass, 8/8 files, 692ms | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| ARC-01 | 11-02-archive-cardswap-PLAN.md | CSS-3D CardSwap cycling real issues, no new deps, reduced-motion static list | SATISFIED | `CardSwap.tsx` + `archive/page.tsx` wiring verified; `archive-cardswap.test.ts` 14/14 green |
| MOT-01 | 11-03-issue-hero-clip-path-reveal-PLAN.md | Hero charity-name clip-path word reveal, Server Component only | SATISFIED | `IssueHero.tsx` `@keyframes heroWordReveal` + word splits verified; `issue-hero-motion.test.ts` 7/7 green |
| MOT-02 | 11-04-navigator-and-deliberation-motion-PLAN.md | Section-navigator gold glow + hover lift, no tracking under reduced-motion, ≥44px targets | SATISFIED | `globals.css` `translateY(-4px)` verified; `SectionNavigator.tsx` early-return guard verified; `motion-polish.test.ts` 9/9 green |
| MOT-03 | 11-04-navigator-and-deliberation-motion-PLAN.md | Confidence count-up on scroll-into-view + pitch-card scroll-snap, DEL-04 preserved, Convex intact | SATISFIED | `DeliberationSlot.tsx` `IntersectionObserver` + `setDisplayValue` verified; `globals.css` `pitch-card-list` block verified; `deliberation-no-model-names.test.ts` 3/3 green |

No orphaned requirements found — all 4 phase requirements (ARC-01, MOT-01, MOT-02, MOT-03) appear in plans and are satisfied.

---

### Anti-Patterns Found

No blockers or warnings found.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | — | — | — |

No `TODO`, `FIXME`, `placeholder`, or `not yet implemented` comments in any modified file. No hardcoded issue content in `CardSwap.tsx` (all values from `ArchiveIssue[]` props). No `return null` or empty implementations in new code paths. The `getCardStyle()` function returns `{ opacity: 0, pointerEvents: 'none' }` for cards beyond the visible stack (index ≥ 3) — this is intentional rendering logic (hide overflow cards), not a stub.

---

### Security Contracts Verified

| Contract | Status | Evidence |
|----------|--------|----------|
| `GameSlot.tsx` unchanged (`sandbox="allow-scripts"`, no `allow-same-origin`) | VERIFIED | `game-sandbox.test.ts` 3/3 green; `GameSlot.tsx` last modified in Phase 9 (commit `df0adcd`) — not touched by any Phase 11 commit |
| `FONT_WHITELIST` in `theme.ts` unchanged (6 entries, frozen) | VERIFIED | `theme.ts` `FONT_WHITELIST` has exactly 6 entries (Playfair Display, Lora, Inter, Cormorant Garamond, Merriweather, DM Serif Display); `archive-cardswap.test.ts` assertion green |
| `theme.ts` security contract (`setProperty` only) | VERIFIED | `theme-aa-tones.test.ts` 8/8 green; `theme.ts` not modified by Phase 11 |
| No new `:root` hex values | VERIFIED | `theme-aa-tones.test.ts` 8/8 green |
| DEL-04: no model names in `DeliberationSlot.tsx` | VERIFIED | `deliberation-no-model-names.test.ts` 3/3 green; no `claude`, `gpt`, `gemini`, `anthropic`, `mistral`, `llama`, `sonnet`, `haiku`, `opus` strings in component |

---

### Human Verification Required

5 items require a running browser to verify visual behavior. These are inherent to motion and interaction design — source-level contracts are fully satisfied.

**1. CardSwap 3D Cycle + Interaction**
- **Test:** Load `/archive`. Observe card stack; wait ~6 seconds. Then hover over the card stack. Then click the front card.
- **Expected:** Cards auto-advance with a visible 3D perspective-stack effect; hovering pauses auto-advance; clicking the front card navigates to `/issue/{slug}`
- **Why human:** CSS 3D animation visual quality and pointer-interaction timing cannot be asserted by source-scan

**2. Hero Charity Name Clip-Path Reveal**
- **Test:** Load `/issue/[any-slug]`. Observe the charity name `<h1>`. Then enable OS "Reduce Motion" (macOS: System Settings → Accessibility → Reduce Motion) and reload.
- **Expected:** Normal: each word clips and fades in sequentially (left-to-right, 80ms stagger). Reduced motion: all words appear instantly on load, fully visible
- **Why human:** Animation playback and reduced-motion visual behavior require a browser render

**3. Section Navigator Magnetic Gold Glow**
- **Test:** Hover section-navigator cards slowly. Then toggle OS Reduce Motion and hover again.
- **Expected:** Normal: gold radial glow follows cursor position within each card. Reduced motion: glow is centred/static (no cursor tracking); cards remain keyboard-focusable (Tab key cycles through them)
- **Why human:** Cursor-tracking CSS variable glow is a pointer-event visual that source-scan cannot exercise

**4. Deliberation Confidence Count-Up**
- **Test:** Open an issue page with deliberation data. Scroll down until the "Editor confidence" meter enters the viewport. Then enable OS Reduce Motion and reload.
- **Expected:** Normal: counter animates from 0 to its real value over ~1200ms. Reduced motion: final value shown immediately with no animation
- **Why human:** Scroll-triggered IntersectionObserver animation requires browser rendering

**5. WCAG AA Contrast on New Surfaces**
- **Test:** Open `/archive` and inspect the CardSwap badge ("N ISSUES"), indicator dots, and card copy in browser DevTools (Accessibility → Color Contrast or axe extension)
- **Expected:** All text/background combinations on new Phase 11 surfaces meet ≥4.5:1 contrast ratio. CardSwap uses CSS variables (`--color-primary`, `--color-text`, `--color-text-mute`) that inherit validated theme colors from the theme engine.
- **Why human:** Contrast measurement requires rendered pixel values; CSS variables are runtime-injected by the validated theme engine

---

### Gaps Summary

No gaps. All 5 observable truths are VERIFIED at source level. All 4 requirement IDs (ARC-01, MOT-01, MOT-02, MOT-03) are satisfied. All 91 source-scan tests pass. No new npm dependencies added. FONT_WHITELIST unchanged. Security contracts (`game-sandbox.test.ts`, `theme-aa-tones.test.ts`, `deliberation-no-model-names.test.ts`) remain green. `pnpm --filter web build` passes (confirmed by orchestrator).

The 5 human-verification items above are inherent to motion and visual design — they cannot be asserted by source-scan but the source-level contracts (correct CSS, correct guards, correct data bindings) are fully verified.

---

_Verified: 2026-05-21T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
