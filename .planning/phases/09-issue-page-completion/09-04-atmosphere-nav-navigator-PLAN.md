---
phase: 09-issue-page-completion
plan: 04
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/web/components/issue/Atmosphere.tsx
  - apps/web/components/issue/SectionNavigator.tsx
  - apps/web/components/SiteHeader.tsx
  - apps/web/app/issue/[slug]/page.tsx
  - apps/web/app/globals.css
autonomous: true
requirements: [DEL-03]
must_haves:
  truths:
    - "Decorative atmosphere layers (aurora/grid/grain/progress) render fixed, aria-hidden, pointer-events:none, behind content"
    - "All atmosphere motion respects prefers-reduced-motion (CSS guard + JS matchMedia early-return); no element trapped at opacity:0"
    - "The 8-card section navigator links to the canonical anchor ids and has ≥44px targets"
    - "SiteHeader has a real mobile disclosure (hamburger) that does NOT disappear at narrow widths; keyboard-operable, Escape to close, aria-expanded/aria-controls, ≥44px targets"
    - "Exactly one <main id=\"main\"> on the page (atmosphere + navigator do not introduce a second main)"
  artifacts:
    - path: "apps/web/components/issue/Atmosphere.tsx"
      provides: "Fixed decorative aurora/grid/grain/progress layers, reduced-motion safe"
      contains: "aria-hidden"
    - path: "apps/web/components/issue/SectionNavigator.tsx"
      provides: "8-card navigator with canonical anchor hrefs"
      contains: "#deliberation"
    - path: "apps/web/components/SiteHeader.tsx"
      provides: "Fixed dark nav with real mobile disclosure"
      contains: "aria-expanded"
  key_links:
    - from: "apps/web/components/issue/SectionNavigator.tsx"
      to: "issue section anchors"
      via: "href=#canonical-id"
      pattern: "href=\"#origin-story\""
    - from: "apps/web/app/issue/[slug]/page.tsx"
      to: "Atmosphere + SectionNavigator"
      via: "component mount"
      pattern: "<Atmosphere"
---

<objective>
Build the dark "house style" chrome: the decorative Atmosphere layer (aurora/grid/grain/scroll-progress), the 8-card SectionNavigator, and a real mobile-nav disclosure on SiteHeader — then mount Atmosphere + SectionNavigator into the issue page. All motion is reduced-motion-safe; the single-`<main>` rule and ≥44px touch targets are preserved.

Purpose: Adopt the mockup's dark editorial atmosphere and navigation per the UI-SPEC HYBRID house style, without breaking accessibility (mobile nav must not vanish), the single landmark, or the reduced-motion contract.
Output: Atmosphere.tsx, SectionNavigator.tsx, restyled SiteHeader.tsx, page.tsx mounting, and the supporting CSS keyframes/classes in globals.css.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/09-issue-page-completion/09-UI-SPEC.md
@.planning/phases/09-issue-page-completion/09-RESEARCH.md
@.planning/phases/09-issue-page-completion/mockup-reference.html

<interfaces>
<!-- The canonical anchor ids the navigator MUST target (UI-SPEC §Anchor-id reconciliation):
       origin-story, problem, founder-bio, case-study, game, bonus, deliberation, podcast
     The mockup's the-problem/the-game/the-bonus are FORBIDDEN as ids. Card COPY may stay
     editorial ("The Problem") but href targets the canonical id. -->

Atmosphere reduced-motion pattern (research §Atmosphere component; UI-SPEC §Motion Contract):
  'use client'; useEffect adds a passive scroll listener that early-returns when
  window.matchMedia('(prefers-reduced-motion: reduce)').matches; updates --scroll-progress
  via documentElement.style.setProperty. The 4 decorative divs are aria-hidden + pointer-events:none.
  CSS keyframes for aurora/grain are neutralized by the existing globals.css reduced-motion guard
  (animation-duration: 0.01ms !important). NEVER trap content at opacity:0.

SiteHeader mobile disclosure (UI-SPEC §Navigation — LOCKED: mobile nav must NOT disappear):
  Current SiteHeader is a Server Component with a plain <nav> that has no mobile treatment.
  Convert to a Client Component ('use client') OR add a small client child for the disclosure.
  Hamburger <button aria-expanded={open} aria-controls="mobile-menu" aria-label={open?'Close menu':'Open menu'}>,
  toggles a menu panel (#mobile-menu) with the 4 nav links + "Buy Lip Balm". Keyboard-operable, Escape closes,
  focus returns to the button on close. ≥44px targets. Closed by default. Visible at ≤960px; the inline link row
  is the desktop treatment ≥960px. Reduced-motion: no slide animation (rely on the globals.css guard; do not add
  a JS-driven slide).
  Keep data-site-header attribute (print hide-list) and the wordmark link. Add a `site-nav` class so the
  Plan 09-01 print hide-list (`.site-nav`) and scroll-state styling apply.

page.tsx mounting (this plan OWNS page.tsx this wave — Plan 09-01 already added the runId prop in Wave 1):
  Mount <Atmosphere /> once near the top of the returned <article> (it is fixed/decorative).
  Mount <SectionNavigator /> after IssueHero and before the first EditorialSection.
  Do NOT add a second <main>. Do NOT change the DeliberationSlot runId prop (Plan 09-01 set it; leave intact).
  Import Atmosphere + SectionNavigator from '@/components/issue/...'.

NavLinks shape (reuse SiteHeader's NAV array): Archive /archive, Charities /charities, About /about, Shop /shop,
  plus a "Buy Lip Balm" CTA → /shop (UI-SPEC Copywriting Contract: nav CTA copy is "Buy Lip Balm").
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create Atmosphere.tsx + SectionNavigator.tsx and their globals.css classes/keyframes</name>
  <read_first>
    - .planning/phases/09-issue-page-completion/mockup-reference.html (aurora/bg-grid/grain/progress markup + the 8-card section navigator + magnetic glow)
    - .planning/phases/09-issue-page-completion/09-UI-SPEC.md (§Atmosphere layer; §Section navigator; §Motion Contract; §Spacing touch-target rule)
    - .planning/phases/09-issue-page-completion/09-RESEARCH.md (§Atmosphere component reduced-motion pattern; §Reduced-motion for JS animations)
    - apps/web/app/globals.css (where to append new classes — below the reduced-motion guard; reference --color-* tokens only)
    - apps/web/components/AnchorCopyButton.tsx (existing ≥44px target + lucide-react usage as a styling reference)
  </read_first>
  <files>apps/web/components/issue/Atmosphere.tsx, apps/web/components/issue/SectionNavigator.tsx, apps/web/app/globals.css</files>
  <action>
1. Create `apps/web/components/issue/Atmosphere.tsx` — `'use client'`. Render four decorative divs: `<div className="aurora" aria-hidden="true" />`, `<div className="bg-grid" aria-hidden="true" />`, `<div className="grain" aria-hidden="true" />`, `<div className="progress" aria-hidden="true" />`. In a `useEffect`, add a passive scroll listener that updates `--scroll-progress` on `document.documentElement` via `setProperty`, with an early `if (prefersReducedMotion) return` (compute `prefersReducedMotion` from `window.matchMedia('(prefers-reduced-motion: reduce)').matches` once). Clean up the listener on unmount. No state; the component renders the same markup regardless.

2. Create `apps/web/components/issue/SectionNavigator.tsx` — may be a Server Component for the static card grid; if you add the magnetic-glow mousemove, make it a Client Component with a `useEffect` that attaches `mousemove` listeners updating `--mx`/`--my` CSS vars on each card and EARLY-RETURNS under reduced-motion (static centered glow only). Render a `<nav aria-label="Sections" className="section-navigator">` (NOT a `<main>`, NOT a duplicate landmark conflicting with primary nav — use `aria-label="Sections"`). 8 cards, each an `<a href="#canonical-id">` with a card title and ≥44px hit area (min-h target via padding). The href→title pairs (href uses the CANONICAL id; title may be editorial):
   - `#origin-story` → "Origin Story"
   - `#problem` → "The Problem"
   - `#founder-bio` → "Founder Bio"
   - `#case-study` → "Case Study"
   - `#game` → "The Game" (feature card)
   - `#bonus` → "The Bonus"
   - `#deliberation` → "The Deliberation" (wide feature)
   - `#podcast` → "The Podcast" (wide)
   Hover glow uses `--color-primary` / `--color-primary-glow`. Cards use `--color-card` / `--color-card-hover` / `--color-line`.

3. In `apps/web/app/globals.css`, append (below the reduced-motion guard, behind a `/* ═══ Phase 9 — Atmosphere + Section Navigator ═══ */` banner) the supporting classes:
   - `.aurora`, `.bg-grid`, `.grain`: `position: fixed; inset: 0; z-index: 0; pointer-events: none;` with the dark gradient/grid/grain treatments from the mockup, re-expressed against `--color-bg`/`--color-text`/`--color-primary` (use color-mix for tints). Aurora/grain keyframes via `@keyframes` — they are auto-neutralized by the existing reduced-motion guard (do not duplicate the guard).
   - `.progress`: `position: fixed; top: 0; left: 0; height: 2px; z-index: 200; width: var(--scroll-progress, 0%); background: var(--color-primary);` (the JS sets the width var; under reduced-motion the JS early-returns so it stays 0/static — acceptable per UI-SPEC).
   - `.section-navigator` grid + `.section-navigator a` card styling with hover glow referencing `--color-primary-glow`. Ensure card links have a min hit area ≥44px.
   - Content layering: ensure page content sits above the fixed atmosphere. Add a rule so the issue `<article>`/content has `position: relative; z-index: 1;` — apply via a utility class you add to the navigator/article or a global `article { position: relative; z-index: 1; }` scoped carefully so it doesn't disrupt other pages. PREFER scoping by adding `position: relative; z-index: 1` to `.section-navigator` and letting the atmosphere's `z-index: 0` sit beneath; verify no content is hidden.

   CRITICAL: NO new font `@import` or Google Fonts URL (the build forbids `fonts.googleapis.com` per Plan 10 SUMMARY). Use only the `--font-*` variables. NO color literals that are not derived from `--color-*` except the fixed house surface values already established.
  </action>
  <verify>
    <automated>cd apps/web && npm run test:unit -- __tests__/theme-aa-tones.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `apps/web/components/issue/Atmosphere.tsx` exists, starts with `'use client'`, contains `aria-hidden="true"` on all four divs, contains `matchMedia('(prefers-reduced-motion: reduce)')` and an early-return in the scroll handler, and contains `--scroll-progress`
    - `apps/web/components/issue/SectionNavigator.tsx` exists and contains all eight canonical hrefs: `#origin-story`, `#problem`, `#founder-bio`, `#case-study`, `#game`, `#bonus`, `#deliberation`, `#podcast`
    - SectionNavigator contains NEITHER `#the-problem` NOR `#the-game` NOR `#the-bonus` (forbidden mockup ids)
    - SectionNavigator contains NO `<main` element
    - `grep -c "fonts.googleapis.com" apps/web/app/globals.css` == 0
    - `grep -c "\.aurora" apps/web/app/globals.css` >= 1 and `grep -c "\.progress" apps/web/app/globals.css` >= 1 and `grep -c "\.section-navigator" apps/web/app/globals.css` >= 1
    - `cd apps/web && npm run test:unit -- __tests__/theme-aa-tones.test.ts` exits 0
    - `cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts` exits 0
  </acceptance_criteria>
  <done>Atmosphere + SectionNavigator exist with reduced-motion-safe motion, canonical anchor ids, no extra main, no Google Fonts URL; supporting CSS in globals.css.</done>
</task>

<task type="auto">
  <name>Task 2: Add the real mobile-nav disclosure to SiteHeader and mount Atmosphere + SectionNavigator in page.tsx</name>
  <read_first>
    - apps/web/components/SiteHeader.tsx (the file being edited — currently a Server Component with a plain nav and NO mobile treatment)
    - apps/web/app/layout.tsx (confirms the single <main id="main"> lives here; SiteHeader renders above it; do not add another main)
    - apps/web/app/issue/[slug]/page.tsx (the file being edited — Plan 09-01 set `<DeliberationSlot runId={issue.runId ?? null} />`; preserve it; mount Atmosphere + SectionNavigator)
    - .planning/phases/09-issue-page-completion/09-UI-SPEC.md (§Navigation mobile disclosure requirements; §Copywriting "Buy Lip Balm", mobile-nav aria-labels "Open menu"/"Close menu")
  </read_first>
  <files>apps/web/components/SiteHeader.tsx, apps/web/app/issue/[slug]/page.tsx</files>
  <action>
1. SiteHeader.tsx — add the mobile disclosure. Convert SiteHeader to a Client Component (`'use client'` line 1) OR keep it server and extract a small `'use client'` `MobileNav` child within the same file. Implementation:
   - Keep `data-site-header`, the wordmark link, and the desktop inline link row (visible ≥960px via `hidden lg:flex` or a `min-[960px]:` utility — the UI-SPEC breakpoint is 960px; Tailwind's `lg` is 1024px, so use an arbitrary `max-[960px]:` / `min-[960px]:` variant or a custom breakpoint class; if arbitrary variants are awkward, use `lg:` consistently and document the 64px delta in a comment).
   - Add a hamburger `<button>` shown only at the mobile breakpoint (`min-[960px]:hidden`), with `aria-expanded={open}`, `aria-controls="site-mobile-menu"`, `aria-label={open ? 'Close menu' : 'Open menu'}`, ≥44px (`min-h-11 min-w-11`). Use a lucide-react Menu/X icon (lucide-react is already a dep).
   - Render a `#site-mobile-menu` panel containing the 4 nav links (Archive/Charities/About/Shop) + a "Buy Lip Balm" CTA link to `/shop`. Closed by default (`open` state false). On open, the panel is visible; on close, hidden. Each link ≥44px (`min-h-11`, py-2). Add an Escape-key handler that closes the menu and returns focus to the button. Clicking a link closes the menu.
   - Add the `site-nav` class to the header element (so the Plan 09-01 print hide-list `.site-nav` and any scroll-state styling apply). Restyle to dark using `--color-*` tokens; replace the light `--color-border` border with `--color-line`.
   - Do NOT add slide/transform animation driven by JS; rely on the globals.css reduced-motion guard for any CSS transition.

2. page.tsx — mount the new chrome inside the returned `<article>`:
   - Add `import { Atmosphere } from '@/components/issue/Atmosphere'` and `import { SectionNavigator } from '@/components/issue/SectionNavigator'`.
   - Render `<Atmosphere />` as the first child inside `<article>` (it is fixed/decorative; placement is non-visual).
   - Render `<SectionNavigator />` immediately AFTER `<IssueHero ... />` and BEFORE the first `<EditorialSection id="origin-story" ... />`.
   - Do NOT add a `<main>`. Do NOT alter the `<DeliberationSlot runId={issue.runId ?? null} />` line. Do NOT alter any other section.
  </action>
  <verify>
    <automated>cd apps/web && npm run test:unit</automated>
  </verify>
  <acceptance_criteria>
    - `head -1 apps/web/components/SiteHeader.tsx` is `'use client'` (or the file contains a `'use client'` MobileNav child)
    - SiteHeader.tsx contains `aria-expanded`, `aria-controls`, `aria-label` with both `Open menu` and `Close menu`, and `Buy Lip Balm`
    - SiteHeader.tsx contains an Escape-key handler (`'Escape'` or `key === 'Escape'`)
    - SiteHeader.tsx contains NO `display:none`-only mobile treatment that leaves the nav inaccessible (the disclosure replaces it); contains `site-nav` class and `data-site-header`
    - SiteHeader.tsx contains NO `<main` element
    - page.tsx contains `<Atmosphere` and `<SectionNavigator` and STILL contains `<DeliberationSlot runId=`
    - `grep -c "<main" apps/web/app/issue/[slug]/page.tsx` == 0 (the single main is in layout.tsx)
    - `cd apps/web && npm run test:unit` exits 0 (full suite green, including game-sandbox)
  </acceptance_criteria>
  <done>SiteHeader has a keyboard-operable mobile disclosure that never disappears; Atmosphere + SectionNavigator mounted in page.tsx without adding a second main or disturbing the deliberation prop.</done>
</task>

</tasks>

<verification>
- Atmosphere + SectionNavigator exist; atmosphere motion is reduced-motion-safe and decorative (aria-hidden, pointer-events:none); navigator links use canonical ids; no Google Fonts URL.
- SiteHeader has a real mobile disclosure (aria-expanded/aria-controls, Escape, ≥44px); print hide-list class present.
- page.tsx mounts both, keeps a single main and the deliberation runId prop.
- Full unit suite green; game-sandbox green.
</verification>

<success_criteria>
- The dark house chrome is in place; mobile nav does not vanish; DEL-03 collapsed deliberation still reachable via the navigator anchor; single landmark + ≥44px + reduced-motion preserved.
</success_criteria>

<output>
After completion, create `.planning/phases/09-issue-page-completion/09-04-SUMMARY.md`.
</output>
