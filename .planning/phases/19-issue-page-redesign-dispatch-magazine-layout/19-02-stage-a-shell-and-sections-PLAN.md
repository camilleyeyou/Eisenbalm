---
phase: 19-issue-page-redesign-dispatch-magazine-layout
plan: 02
type: execute
wave: 2
depends_on: [19-01]
files_modified:
  - apps/web/components/issue/ScrollReveal.tsx
  - apps/web/components/issue/ScrollProgressBar.tsx
  - apps/web/components/issue/StatCountUp.tsx
  - apps/web/components/issue/SectionRail.tsx
  - apps/web/components/issue/IssueMasthead.tsx
  - apps/web/components/issue/IssueBriefing.tsx
  - apps/web/components/issue/MissionBand.tsx
  - apps/web/components/issue/EditorialSection.tsx
  - apps/web/components/issue/CaseStudySection.tsx
  - apps/web/components/issue/GameSlot.tsx
  - apps/web/components/issue/BonusSection.tsx
  - apps/web/components/issue/PodcastSlot.tsx
  - apps/web/components/issue/ShopBand.tsx
  - apps/web/app/issue/[slug]/page.tsx
  - apps/web/app/globals.css
autonomous: true
requirements: [P19-01, P19-04, P19-07, DES-02, DES-03, DES-05, GAM-01, GAM-04, POD-01, POD-03, CMR-09, WEB-15, WEB-16]
must_haves:
  truths:
    - "page.tsx renders the locked 10-section order with MOCK data (Stage A) — no live GROQ"
    - "Atmosphere aurora and vertical-timeline SectionNavigator no longer appear"
    - "framer-motion drives scroll reveals, stat count-ups, scroll-progress bar, and scroll-spy rail"
    - "Under prefers-reduced-motion all content is immediately visible (no opacity:0 lock)"
    - "Game iframe keeps sandbox=allow-scripts + CSP; play button has aria-label"
    - "Podcast player has dynamic play/pause aria-label; empty state shows Audio coming soon"
    - "Sticky left scroll-spy rail is keyboard-navigable, role=navigation, hidden < 980px"
  artifacts:
    - path: "apps/web/app/issue/[slug]/page.tsx"
      provides: "10-section Dispatch layout with MOCK_ISSUE mock data (Stage A)"
      contains: "MOCK_ISSUE"
    - path: "apps/web/components/issue/ScrollReveal.tsx"
      provides: "'use client' framer-motion reveal wrapper, reduced-motion safe"
      contains: "useReducedMotion"
    - path: "apps/web/components/issue/SectionRail.tsx"
      provides: "fixed left scroll-spy rail, role=navigation aria-label='Article sections'"
      contains: "Article sections"
    - path: "apps/web/components/issue/StatCountUp.tsx"
      provides: "animated stat count-up, reduced-motion renders final value"
      contains: "useReducedMotion"
    - path: "apps/web/components/issue/ShopBand.tsx"
      provides: "inline shop band replacing ShopCallout; links to /shop"
      contains: "/shop"
  key_links:
    - from: "apps/web/app/issue/[slug]/page.tsx"
      to: "MOCK_ISSUE"
      via: "hardcoded mock object feeding all sections (Stage A)"
      pattern: "MOCK_ISSUE"
    - from: "apps/web/components/issue/GameSlot.tsx"
      to: "iframe sandbox"
      via: "sandbox=allow-scripts preserved"
      pattern: "allow-scripts"
---

<objective>
Build the complete static Dispatch issue-page shell with MOCK data (Stage A), excluding the deliberation centerpiece (Plan 03 owns that). Create the framer-motion primitives (ScrollReveal, ScrollProgressBar, StatCountUp, SectionRail), the new structural components (IssueMasthead, IssueBriefing, MissionBand, ShopBand), restyle the editorial/case/game/bonus/podcast components, and rewrite page.tsx to render all 10 sections in the locked order from a single MOCK_ISSUE object. Retire Atmosphere + SectionNavigator.

Purpose: This is half of Stage A — the reviewable static shell. It uses MOCK data only so visual fidelity to 19-PROTOTYPE.html can be approved before any live wiring (Plan 04 gate, Plan 05 wiring). All motion is reduced-motion-safe; all security/a11y invariants preserved.
Output: 9 new/restyled components + page.tsx rewrite + globals.css component classes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md
@.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-RESEARCH.md
@.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-PROTOTYPE.html

<interfaces>
Current page.tsx (apps/web/app/issue/[slug]/page.tsx) renders via these component props — preserve the prop SHAPES so Stage B (Plan 05) can swap MOCK_ISSUE for the live `Issue`:
- `IssueHero` → being REPLACED by IssueMasthead + IssueBriefing + MissionBand
- `EditorialSection { id, label, headline, body, lead? }` — RESTYLE, keep prop names
- `CaseStudySection { subjectName, headline, body }` — RESTYLE
- `GameSlot { game, runId }` — RESTYLE, keep sandbox
- `BonusSection { bonus, bonusType }` — RESTYLE specAd only
- `PodcastSlot { podcast }` — RESTYLE
- `ShopCallout` → REPLACED by `ShopBand { charityName }`
- `DeliberationSlot { runId, conversation }` — Plan 03 rewrites; in THIS plan render a placeholder `<section id="delib" data-deliberation-slot />` stub so page compiles; Plan 03 fills it.

framer-motion patterns (from RESEARCH §Code Examples, lines 145-200, 472-562):
- ScrollReveal: `useInView(ref,{once:true,amount:0.2})` + `useReducedMotion()`; `initial={prefersReducedMotion ? false : {opacity:0,y:28}}`
- StatCountUp: `animate(0,to,{duration:0.88,ease:'easeOut',onUpdate})`; reduced-motion → textContent = final
- ScrollProgressBar: `useScroll()` → `scaleX` via `useSpring`
- Rail: appears scrollY>700, active when section top < innerHeight*0.4

PortableTextRenderer (apps/web/components/issue/PortableTextRenderer.tsx) — UNCHANGED; renders h2/h3/blockquote. EditorialSection feeds `.body` array through it; blockquote → `.pq` pull-quote styling comes from globals.css `.pq` class on the renderer's blockquote output.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: framer-motion primitives + globals.css component classes + retire Atmosphere/SectionNavigator</name>
  <read_first>
    - apps/web/components/issue/Atmosphere.tsx + SectionNavigator.tsx (to be deleted — confirm no other importers via grep)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-RESEARCH.md (Patterns 1, Code Examples lines 472-562, Pitfalls 1+4)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md (§Motion Contract lines 612-655, §Section Layout 1/6/22px exception)
    - apps/web/app/globals.css (to add new component classes; reduced-motion @media query block)
  </read_first>
  <action>
    1. CREATE the four framer-motion primitives, each starting with `'use client'`:
       - `ScrollReveal.tsx`: wrapper per RESEARCH lines 161-177. Props `{children, className?, id?}`. `initial={prefersReducedMotion ? false : {opacity:0,y:28}}`, `animate={isInView||prefersReducedMotion ? {opacity:1,y:0} : {}}`, `transition={{duration:0.9, ease:[0.16,1,0.3,1]}}`.
       - `ScrollProgressBar.tsx`: per RESEARCH lines 184-197. Fixed top 3px bar, `z-[300]`, `backgroundColor: 'var(--color-accent)'`, `scaleX` from `useSpring(useScroll().scrollYProgress)`. Under reduced-motion the bar may stay at 0 (decorative — acceptable per UI-SPEC).
       - `StatCountUp.tsx`: per RESEARCH lines 472-507. Props `{to, suffix?, plain?}`. reduced-motion OR plain → render final value; else `animate(0,to,{duration:0.88,ease:'easeOut',onUpdate})`.
       - `SectionRail.tsx`: fixed left `left:24px top:50% translateY(-50%)`, `z-[100]`, `role="navigation"` `aria-label="Article sections"`. Appears when `scrollY>700` (useScroll + useMotionValueEvent or state). Tracks sections `#origin,#problem,#founder,#case,#game,#bonus,#delib,#pod` — active when `getBoundingClientRect().top < window.innerHeight*0.4`. Each item: anchor with `.tick` (18px×2px, active 28px + accent) + `.rl` label (IBM Plex Mono 9px uppercase). `display:none` below 980px via the `.rail` class. Keyboard-accessible anchors.
    2. DELETE apps/web/components/issue/Atmosphere.tsx and SectionNavigator.tsx (confirm via grep no importers remain after page.tsx rewrite in Task 4).
    3. ADD to globals.css the new component classes per UI-SPEC §Section Layout Contract verbatim values: `.masthead`, `.briefing`, `.brief-col`, `.brief-label`, `.stat`, `.toc`, `.mission-band` (padding 22px 32px — the NAMED PROTOTYPE EXCEPTION, do NOT use 22px elsewhere), `.rail`/`.tick`/`.rl`, `.sec`/`.sec-label` (margin-bottom 22px), `.body.lead > p:first-of-type::first-letter` drop cap (Fraunces 4.6em float left line-height 0.74 color var(--color-accent) weight 500), `.pq` pull-quote (Fraunces clamp(24px,3vw,32px) italic, border-left 3px solid var(--color-accent)), `.game`/`.ad`/`.pod`/`.shop` band classes. Add a `@media (prefers-reduced-motion: reduce)` rule disabling the game play-button ripple `::before` animation and any CSS-only motion.
    Use only `--color-*` tokens (no hardcoded hex outside the dark-band constants, which live in Plan 03's component).
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck 2>&1 | tail -5; ls components/issue/Atmosphere.tsx components/issue/SectionNavigator.tsx 2>&1</automated>
  </verify>
  <acceptance_criteria>
    - `ls apps/web/components/issue/Atmosphere.tsx` returns "No such file"
    - `ls apps/web/components/issue/SectionNavigator.tsx` returns "No such file"
    - Each of ScrollReveal/ScrollProgressBar/StatCountUp/SectionRail.tsx starts with `'use client'` (`head -1` matches)
    - `grep -l "useReducedMotion" apps/web/components/issue/ScrollReveal.tsx apps/web/components/issue/StatCountUp.tsx` lists both
    - `grep -c "Article sections" apps/web/components/issue/SectionRail.tsx` returns 1
    - `grep -c "prefers-reduced-motion" apps/web/app/globals.css` returns 1 or more
    - `grep -c "padding: 22px 32px\|padding:22px 32px" apps/web/app/globals.css` returns 1 (mission band exception)
    - `pnpm --filter web typecheck` exits 0
  </acceptance_criteria>
  <done>4 motion primitives created (reduced-motion safe); Atmosphere + SectionNavigator deleted; globals.css carries Dispatch component classes + reduced-motion guard.</done>
</task>

<task type="auto">
  <name>Task 2: Masthead, Briefing (3-col + stat count-ups + TOC), MissionBand, ShopBand</name>
  <read_first>
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md (§Section 3 Masthead, §4 Briefing lines 386-411, §5 Mission Band lines 413-420, §12 Shop Band lines 586-600, §Copywriting Contract lines 678-702)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-PROTOTYPE.html (masthead/briefing/mission/shop markup)
    - apps/web/components/issue/StatCountUp.tsx (created Task 1 — consume it)
    - apps/web/components/issue/ShopCallout.tsx (current — to be superseded; reuse /shop link + charity callout intent)
  </read_first>
  <action>
    CREATE four components (RSC except where motion requires client child):
    1. `IssueMasthead.tsx` (RSC) — props `{ issueNumber, charityName, tagline, publishDate, readingTimeMinutes }`. `max-width:1180px; padding:56px 32px 36px; text-align:center; border-bottom:1px solid var(--color-line)`. Dateline: IBM Plex Mono 11px uppercase ls .18em, issue# in `var(--color-accent)`, include publish date + reading time (WEB-15). h1: Fraunces clamp(40px,6vw,76px) weight 400 ls -.025em line-height 1.02 `font-optical-sizing:auto`, content = charityName. Tagline: Newsreader clamp(17px,2vw,21px) italic `var(--color-text-dim)` max-width 600px.
    2. `IssueBriefing.tsx` — props `{ why: string, stats: Array<{to:number, suffix?:string, plain?:boolean, label:string}>, toc: Array<{n:string, name:string, type:string, must?:boolean}> }`. Grid `1.2fr 1.3fr 1fr` → 1fr below 980px. Col1 "Why this charity" (brief-label + Newsreader 15px prose, `.rv`). Col2 "At a glance" 2×2 stat grid using `<StatCountUp to={...} suffix={...} plain={...} />` for the number (Fraunces 34px weight 500), IBM Plex Mono 9px label; center col bg `var(--color-surface)`; `.rv`. Col3 "What's inside" TOC `<ul>` no bullet, each item flex row, number (IBM Plex Mono 10px width 18px) + name (Newsreader 14.5px, italic on `.must`) + type tag (IBM Plex Mono 8px uppercase accent, margin-left auto); hover bg `var(--color-card-hover)`; TOC anchor items link to section ids; `.rv`. Each TOC link tap area ≥44px.
    3. `MissionBand.tsx` (RSC) — full-width `background:#1A1714; color:#FBFAF6; padding:22px 32px` (NAMED EXCEPTION). Copy is the CONSTANT sitewide string from §Copywriting Contract verbatim: "Every week, Jesse A. Eisenbalm spotlights one overlooked charity and donates **100% of lip balm proceeds** to fund it. No pledge, no percentage — every dollar." with the bold run as `<b style="color:#fff; font-style:normal; font-weight:500">`. Newsreader 16px italic max-width 760px margin 0 auto line-height 1.5, text color `#E8E3D6`.
    4. `ShopBand.tsx` (RSC) — props `{ charityName: string }`. `text-align:center; padding:96px 32px; background:var(--color-surface-accent); border-bottom:1px solid var(--color-line)`. Label "Jesse A. Eisenbalm" (IBM Plex Mono 11px uppercase ls .18em accent). h2 Fraunces clamp(32px,4.5vw,54px) weight 400: "Premium lip balm." + `<em>` "100% to {charityName}." (em italic accent). Sub Newsreader 18px italic. Buy button: IBM Plex Mono 12px weight 500 uppercase, `background:var(--color-accent); color:#fff; padding:16px 36px; min-height:44px`, hover `var(--color-accent-deep)`, text "Buy the Lip Balm →", links to `/shop`. Add `data-shop-callout` attribute (CMR-09 + print hide). Wrap in `<ScrollReveal>`.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - All four files exist under apps/web/components/issue/
    - `grep -c "StatCountUp" apps/web/components/issue/IssueBriefing.tsx` returns 1 or more
    - `grep -c "100% of lip balm proceeds" apps/web/components/issue/MissionBand.tsx` returns 1
    - `grep -c "/shop" apps/web/components/issue/ShopBand.tsx` returns 1
    - `grep -c "data-shop-callout" apps/web/components/issue/ShopBand.tsx` returns 1
    - `grep -c "font-optical-sizing" apps/web/components/issue/IssueMasthead.tsx` returns 1
    - `pnpm --filter web typecheck` exits 0
  </acceptance_criteria>
  <done>Masthead/Briefing/MissionBand/ShopBand built per UI-SPEC; briefing stats use StatCountUp; mission band carries constant copy; shop band links /shop with data-shop-callout.</done>
</task>

<task type="auto">
  <name>Task 3: Restyle EditorialSection, CaseStudySection, GameSlot, BonusSection, PodcastSlot</name>
  <read_first>
    - apps/web/components/issue/EditorialSection.tsx + CaseStudySection.tsx + GameSlot.tsx + BonusSection.tsx + PodcastSlot.tsx (current state — keep prop shapes, restyle)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md (§7 Article Sections lines 438-481, §8 Game lines 482-504, §9 Spec-Ad lines 505-518, §11 Podcast lines 572-584, §Accessibility lines 708-725)
    - apps/web/__tests__/game-sandbox.test.ts (sandbox tripwire that must stay green)
    - apps/web/__tests__/podcast-slot.test.ts (POD assertions that must stay green)
  </read_first>
  <action>
    Restyle in place (preserve prop shapes + all security/a11y contracts):
    1. `EditorialSection.tsx`: section `padding:84px 0; border-bottom:1px solid var(--color-line); max-width:680px; margin:0 auto`; wrap content in `<ScrollReveal className="rv">`. Eyebrow `.sec-label` (IBM Plex Mono 11px uppercase ls .16em var(--color-accent), `::before` literal `§`, margin-bottom 22px). h2 Fraunces clamp(30px,4vw,46px) weight 400 with em accent. Body via PortableTextRenderer with `.body` class; when `lead` prop true add `.lead` class so the drop-cap CSS (Task 1) applies to first paragraph (DES-02). Anchor copy-link button preserved (WEB-16). Keep the `id` prop wired to the section element.
    2. `CaseStudySection.tsx`: subject card replaces metadata-block — `background:var(--color-surface); border:1px solid var(--color-line); padding:14px 18px; margin-bottom:28px`, label IBM Plex Mono 9px uppercase var(--color-text-mute), value Fraunces 18px var(--color-text). Apply `.lead` drop cap. id="case".
    3. `GameSlot.tsx`: full-width game layout, section bg `var(--color-surface)`, head grid `1.3fr 1fr`. Play placeholder: 76px accent circle play button with **`aria-label="Play {game.headline}"`** (required — icon-only), title Fraunces 26px, desc Newsreader 13px italic. Ripple `::before` (disabled under reduced-motion via Task 1 CSS). Active state: `<iframe sandbox="allow-scripts" srcdoc={embedCode}>` (GAM-01 — NEVER allow-same-origin) + CSP meta injection preserved (GAM-04). id="game". runId prop preserved for Stage B GAM-05.
    4. `BonusSection.tsx`: ONLY restyle the `specAd` branch — ad box `max-width:760px; border:1px solid var(--color-text); padding:48px 56px; background:#FFFDF8`, "ADVERTISEMENT — SPEC" tab via `::before` (IBM Plex Mono 9px ls .16em var(--color-text-mute)), 2-col justified body (`column-count:2; text-align:justify`, collapse to 1-col below 980px) color var(--color-prose), accent hr (60px×2px). Other bonusTypes keep existing markup untouched. id="bonus". Wrap in ScrollReveal.
    5. `PodcastSlot.tsx`: inline player `max-width:680px; padding:84px 32px`. Player widget bg `var(--color-surface)`, 52px accent play/pause circle with **dynamic `aria-label`**: "Play episode" when paused / "Pause episode" when playing (POD-01). Progress bar 3px `var(--color-line-strong)` + accent fill. Empty state "Audio coming soon" when no audio (POD-03). id="pod".
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:unit 2>&1 | tail -12</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'sandbox="allow-scripts"\|sandbox={.allow-scripts' apps/web/components/issue/GameSlot.tsx` returns 1 or more
    - `grep -c "allow-same-origin" apps/web/components/issue/GameSlot.tsx` returns 0
    - `grep -c "aria-label" apps/web/components/issue/GameSlot.tsx` returns 1 or more (play button)
    - `grep -c "Play episode\|Pause episode" apps/web/components/issue/PodcastSlot.tsx` returns 1 or more
    - `grep -c "Audio coming soon" apps/web/components/issue/PodcastSlot.tsx` returns 1
    - `grep -c "ADVERTISEMENT" apps/web/components/issue/BonusSection.tsx` returns 1 or more
    - `grep -c "ScrollReveal\|sec-label\|\.lead\|lead" apps/web/components/issue/EditorialSection.tsx` returns 1 or more
    - `pnpm --filter web test:unit` exits 0 (game-sandbox + podcast-slot tripwires green)
  </acceptance_criteria>
  <done>5 components restyled to Dispatch layout; game sandbox + CSP + podcast POD contracts preserved; play buttons have aria-labels; specAd 2-col treatment in place.</done>
</task>

<task type="auto">
  <name>Task 4: Rewrite page.tsx with MOCK_ISSUE + 10-section order + delib placeholder stub</name>
  <read_first>
    - apps/web/app/issue/[slug]/page.tsx (current — preserve generateMetadata/generateStaticParams/JSON-LD/revalidate; rewrite the render body)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md (§Source of Truth + all §Section Layout + §Delivery Stages lines 760-776)
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-PROTOTYPE.html ("Puppies Behind Bars" content for MOCK_ISSUE values)
    - apps/web/lib/sanity/types.ts (Issue type — MOCK_ISSUE must be assignable for Stage B minimal-diff swap)
  </read_first>
  <action>
    Rewrite the IssuePage render body (Stage A — MOCK data):
    1. Define a single `const MOCK_ISSUE` object at the top of page.tsx matching the `Issue` TypeScript type shape (per RESEARCH Open Q4 — single mock object, not per-component), populated from the "Puppies Behind Bars" prototype: issueNumber 999, charity name, tagline, briefing why/stats/toc, mission (constant), origin/problem/founder/case body (use short Portable Text arrays with at least one blockquote each so pull-quotes render), game headline+description, specAd bonus, podcast description, deliberation mock (candidates + conversation) for Plan 03's stub.
    2. Render order inside `<article>`: `<ScrollProgressBar/>` → `<SectionRail/>` → `<IssueMasthead/>` → `<IssueBriefing/>` → `<MissionBand/>` → EditorialSection origin (id="origin", `lead`) → EditorialSection problem (id="problem", `lead`) → EditorialSection founder (id="founder", `lead`) → CaseStudySection (id="case", `lead`) → GameSlot (id="game") → BonusSection specAd (id="bonus") → **deliberation placeholder**: `<section id="delib" data-deliberation-slot aria-label="Deliberation" />` (Plan 03 replaces with the full DeliberationSlot rewrite) → PodcastSlot (id="pod") → ShopBand charityName={MOCK_ISSUE.charity.name}.
    3. Remove imports of Atmosphere, SectionNavigator, IssueHero, ShopCallout. Keep JsonLd. Keep generateMetadata, generateStaticParams, `export const revalidate = 60` (they still fetch live for metadata only — that is fine in Stage A; the RENDER body uses MOCK_ISSUE).
    4. Section ids MUST be exactly `origin, problem, founder, case, game, bonus, delib, pod` to match SectionRail tracking (Task 1).
    Note: this is Stage A — `params` slug is read but issue CONTENT comes from MOCK_ISSUE. Plan 05 swaps MOCK_ISSUE → `await sanityClient.fetch(QUERY_ISSUE_BY_SLUG,...)` with a minimal diff.
  </action>
  <verify>
    <automated>cd apps/web && pnpm typecheck 2>&1 | tail -5 && pnpm build 2>&1 | tail -8</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "MOCK_ISSUE" apps/web/app/issue/[slug]/page.tsx` returns 2 or more
    - `grep -c "Atmosphere\|SectionNavigator\|IssueHero\|ShopCallout" apps/web/app/issue/[slug]/page.tsx` returns 0
    - `grep -c 'id="origin"\|id="problem"\|id="founder"\|id="case"\|id="game"\|id="bonus"\|id="delib"\|id="pod"' apps/web/app/issue/[slug]/page.tsx` returns 8
    - `grep -c "IssueMasthead\|IssueBriefing\|MissionBand\|ShopBand\|SectionRail\|ScrollProgressBar" apps/web/app/issue/[slug]/page.tsx` returns 6 or more
    - `pnpm --filter web typecheck` exits 0
    - `pnpm --filter web build` exits 0
  </acceptance_criteria>
  <done>page.tsx renders the full 10-section Dispatch shell from MOCK_ISSUE with the delib stub; old components un-imported; build + typecheck clean.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit` exits 0 (baseline + game-sandbox + podcast green)
- `pnpm --filter web typecheck` exits 0
- `pnpm --filter web build` exits 0
- Atmosphere.tsx + SectionNavigator.tsx deleted
- All motion components reduced-motion-safe
</verification>

<success_criteria>
- 10-section Stage A shell renders from MOCK data (P19-01, P19-05 Stage A)
- framer-motion reveals/count-ups/progress/rail, reduced-motion safe (P19-04)
- Game sandbox + CSP + podcast contracts preserved (GAM-01, GAM-04, POD-01, POD-03)
- Drop caps + pull-quotes + case subject card + shop band (DES-02, DES-03, DES-05, CMR-09)
- Rail keyboard-nav + role=navigation + hidden <980px (P19-07)
</success_criteria>

<output>
After completion, create `.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-02-SUMMARY.md`
</output>
