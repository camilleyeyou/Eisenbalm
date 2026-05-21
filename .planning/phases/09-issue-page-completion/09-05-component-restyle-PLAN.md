---
phase: 09-issue-page-completion
plan: 05
type: execute
wave: 2
depends_on: [01]
files_modified:
  - apps/web/components/issue/IssueHero.tsx
  - apps/web/components/issue/EditorialSection.tsx
  - apps/web/components/issue/CaseStudySection.tsx
  - apps/web/components/issue/PortableTextRenderer.tsx
  - apps/web/components/issue/GameSlot.tsx
  - apps/web/components/issue/GameFallback.tsx
  - apps/web/components/issue/BonusSection.tsx
  - apps/web/components/issue/ShopCallout.tsx
autonomous: true
requirements: [DEL-03]
must_haves:
  truths:
    - "Hero, editorial sections, case study, game, bonus, and shop callout adopt the dark editorial treatment using --color-* tokens"
    - "GameSlot keeps sandbox=\"allow-scripts\" only and routes through validateEmbedCode/injectGameHead; game-sandbox.test.ts stays green"
    - "Bonus stays a <section id=\"bonus\">, never a <main>"
    - "Pull-quotes are extracted from the first blockquote in section body (zero schema change); no hardcoded fixture quotes"
    - "Section anchor ids remain the canonical set so AnchorCopyButton + SectionNavigator links keep working"
  artifacts:
    - path: "apps/web/components/issue/GameSlot.tsx"
      provides: "Dark click-to-load game UX via existing security path"
      contains: "sandbox=\"allow-scripts\""
    - path: "apps/web/components/issue/PortableTextRenderer.tsx"
      provides: "Dark body prose + blockquote→pull-quote treatment"
      contains: "blockquote"
  key_links:
    - from: "apps/web/components/issue/GameSlot.tsx"
      to: "apps/web/lib/game-validator"
      via: "validateEmbedCode + injectGameHead"
      pattern: "validateEmbedCode"
    - from: "apps/web/components/issue/EditorialSection.tsx"
      to: "section body blockquote"
      via: "pull-quote extraction"
      pattern: "blockquote"
---

<objective>
Restyle the remaining issue-page components to the dark editorial house style: IssueHero (ghost numeral, eyebrow, charity h1, mission), EditorialSection (§ label, display headline, drop-cap lead, pull-quote), CaseStudySection (metadata footnote panel), PortableTextRenderer (19px body + blockquote→pull-quote), GameSlot (dark click-to-load via the EXISTING security path), GameFallback, BonusSection (stays `<section>`), and ShopCallout. Pull-quotes are extracted from the first body blockquote (zero schema change). The game security tripwire stays green.

Purpose: Complete the dark editorial art direction across the article surfaces while preserving every locked constraint (game sandbox, single main, canonical anchor ids, ≥44px, reduced-motion, print, no hardcoded content).
Output: Eight restyled components, the game-sandbox test still green, pull-quote rendering from body blockquotes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/09-issue-page-completion/09-UI-SPEC.md
@.planning/phases/09-issue-page-completion/mockup-reference.html

<interfaces>
<!-- New dark tokens available from Plan 09-01 globals.css:
       --color-bg, --color-surface, --color-card, --color-card-hover,
       --color-text, --color-text-dim, --color-text-mute,
       --color-primary, --color-primary-bright, --color-primary-glow,
       --color-accent, --color-scout, --color-advocate,
       --color-line, --color-line-strong
     Phase 10 utilities still present: .prose-measure, .drop-cap, .ornament-divider, .eyebrow, .metadata-block -->

PULL-QUOTE = EXTRACT FROM BODY (orchestrator-locked decision #1; research Open Question 1 Option B):
  Render the FIRST Portable Text block of style 'blockquote' in a section's body as the pull-quote
  (accent-bordered, display font). NO Sanity schema change, NO pipeline change, NO API_CONTRACTS edit.
  Implement this in PortableTextRenderer's blockquote component map (already exists) — restyle the
  existing blockquote handler to the pull-quote treatment (display font, --color-accent left border,
  clamp(26px,3.2vw,38px) italic per UI-SPEC Typography). Sections with no blockquote render no pull-quote
  (graceful). Do NOT add a pullQuote field; do NOT hardcode the mockup's fixture quotes.

GameSlot SECURITY (LOCKED — GAM-01/GAM-03; game-sandbox.test.ts is the tripwire):
  - The iframe attribute MUST stay EXACTLY `sandbox="allow-scripts"` and the file MUST NOT contain
    the same-origin escape token literal anywhere (including comments). The test reads the raw file.
  - Content MUST keep routing through validateEmbedCode + injectGameHead. The mockup's loadGame() that
    assigns an unsanitized srcDoc directly is FORBIDDEN — do not copy it.
  - The validate-and-report useEffect (qaCorrections.insert on failure, runId-guarded, ref-guarded) is
    PRESERVED verbatim. Only the visual wrapper (dark click-to-load placeholder, ripple play button,
    fallback styling) changes.
  - Run `cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts` after editing GameSlot.

Single <main> (LOCKED): BonusSection stays `<section id="bonus">`. No component emits `<main>`.

Canonical anchor ids (LOCKED): origin-story, problem, founder-bio, case-study, game, bonus, podcast.
  EditorialSection takes an `id` prop (set by page.tsx). Do NOT change the ids. CaseStudySection's id is
  the literal "case-study". GameSlot/BonusSection ids are "game"/"bonus".

Hero meta binds to charity + issue fields already passed (IssueHero props unchanged: charity, issueNumber,
  publishDate, readingTimeMinutes, problemPdfUrl). Ghost numeral = issueNumber, aria-hidden, opacity ~.025.

Reduced-motion: any new CSS animation (ripple, hero reveal) is auto-neutralized by the globals.css guard.
  Do NOT introduce a JS animation that lacks a matchMedia early-return; prefer CSS so the guard covers it.

Touch targets ≥44px preserved (the PDF link in Hero already has min-h-11; keep it; play button is the 88px circle).
Print: keep print:hidden on game/shop (already present); article prose stays printable.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Restyle PortableTextRenderer (pull-quote from blockquote), EditorialSection, CaseStudySection, and IssueHero</name>
  <read_first>
    - apps/web/components/issue/PortableTextRenderer.tsx (existing component map — restyle blockquote → pull-quote here; body 19px)
    - apps/web/components/issue/EditorialSection.tsx (existing § label / headline / .drop-cap lead pattern; keep the id prop)
    - apps/web/components/issue/CaseStudySection.tsx (existing .metadata-block dl panel; keep id="case-study")
    - apps/web/components/issue/IssueHero.tsx (existing masthead; add ghost numeral + dark restyle)
    - .planning/phases/09-issue-page-completion/09-UI-SPEC.md (§Typography type scale; §Color accent-reserved list; §Layout IssueHero/EditorialSection/CaseStudySection contracts)
    - .planning/phases/09-issue-page-completion/mockup-reference.html (hero ghost numeral, § section label, pull-quote, case-study metadata treatment)
  </read_first>
  <files>apps/web/components/issue/PortableTextRenderer.tsx, apps/web/components/issue/EditorialSection.tsx, apps/web/components/issue/CaseStudySection.tsx, apps/web/components/issue/IssueHero.tsx</files>
  <action>
1. PortableTextRenderer.tsx — restyle to dark + pull-quote (PULL-QUOTE = blockquote extraction, the locked decision):
   - `block.normal` (p): keep body serif, 19px, line-height ~1.85, color `--color-text-dim` (per UI-SPEC body prose color; strong→`--color-text`). Update the existing `text-[color:var(--color-text)]` to `--color-text-dim` and set leading to `[1.85]`.
   - `block.blockquote`: this IS the pull-quote treatment. Restyle the existing blockquote handler to: display font (`font-display`), `clamp(26px,3.2vw,38px)` (use `text-[clamp(26px,3.2vw,38px)]`), italic, weight 300, `--color-text`, with a left border `border-l-2 border-[color:var(--color-accent)]` and generous padding. This renders the first (and any) blockquote block in a section's body as a pull-quote — no schema change, no hardcoded quote. Sections without a blockquote render no pull-quote (graceful — PortableText just won't emit one).
   - `block.h2`/`h3`: keep display font, `--color-primary`; adjust to dark (they already use the var).
   - `marks.link`: underline color `--color-primary` (the UI-SPEC accent-reserved list assigns link accents to primary). Keep external-link rel/target safety.
   - lists: 19px body, `--color-text-dim`.

2. EditorialSection.tsx — restyle to the dark `§` editorial treatment. KEEP the `id` prop, the `lead` prop (drop-cap), the AnchorCopyButton, and `.prose-measure`. Replace the `.eyebrow` label with the `§` section-label mark treatment per UI-SPEC: a `§` glyph in `--color-accent` followed by the label text in `--color-text-mute` ui font. Headline uses display font + `--color-primary` at the section-headline scale (`clamp(38px,5vw,64px)` acceptable, or keep the existing 32/44 — match the UI-SPEC §Typography section headline). Keep `.drop-cap` wrapping when `lead`. The drop-cap color is already `--color-primary` via globals.css. Do NOT change the id prop or section ordering.

3. CaseStudySection.tsx — restyle to dark. KEEP `id="case-study"`, the `.metadata-block` dl panel (it already uses `--color-accent` left border + tabular-nums), and the body via PortableTextRenderer. Apply the same `§`/headline treatment as EditorialSection for consistency. The metadata panel is the footnote-style treatment (DES-05 carried).

4. IssueHero.tsx — add the ghost numeral and dark restyle. KEEP the props and the eyebrow/byline/meta/mission/PDF structure. Add a decorative ghost numeral: a large `aria-hidden="true"` element rendering `issueNumber` in display font at `clamp(280px,40vw,560px)`, `opacity: .025`, positioned behind the hero content (absolute, pointer-events:none, behind the h1). The charity `<h1>` keeps `--color-primary` with a subtle text-shadow glow (`--color-primary-glow`). The mission gets an italic display lede treatment with an `--color-accent` left border (per UI-SPEC mission/lede). Meta row uses `.eyebrow` / `--color-text-mute`. Keep the PDF download link's `min-h-11` ≥44px target; restyle its color to `--color-primary`. No exclamation marks; "Est. {year}" never "Est. null" (guard already present — keep).
  </action>
  <verify>
    <automated>cd apps/web && npm run test:unit -- __tests__/issue-page-typography.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - PortableTextRenderer.tsx `blockquote` handler uses `font-display` (or `var(--font-display)`) and `border-[color:var(--color-accent)]` and a clamp size — i.e. it is the pull-quote treatment
    - PortableTextRenderer.tsx body `p` uses `var(--color-text-dim)` (or `text-text-dim`)
    - `grep -c "pullQuote\|pull-quote field\|hardcoded" apps/web/components/issue/PortableTextRenderer.tsx` == 0 (no schema field, no hardcoded quote)
    - EditorialSection.tsx still contains `id={id}` and the `lead` prop and `drop-cap` wiring and `AnchorCopyButton`
    - CaseStudySection.tsx still contains `id="case-study"` and `metadata-block`
    - IssueHero.tsx contains a ghost numeral element with `aria-hidden="true"` and references `issueNumber`; still contains the `min-h-11` PDF link
    - No file in this task contains `<main`
    - `cd apps/web && npm run test:unit -- __tests__/issue-page-typography.test.ts` exits 0 (Phase 10 typography tripwire still green — drop-cap/eyebrow/metadata-block/blockquote contracts intact)
    - `cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts` exits 0
  </acceptance_criteria>
  <done>Article prose, sections, case study, and hero adopt the dark editorial treatment; pull-quotes render from body blockquotes (no schema change, no hardcoded quotes); Phase 10 typography test stays green.</done>
</task>

<task type="auto">
  <name>Task 2: Restyle GameSlot (security-preserving), GameFallback, BonusSection, and ShopCallout</name>
  <read_first>
    - apps/web/components/issue/GameSlot.tsx (SECURITY-CRITICAL — read the whole file; the sandbox attr, validateEmbedCode/injectGameHead path, and the qaCorrections useEffect must be preserved)
    - apps/web/__tests__/game-sandbox.test.ts (the tripwire — it greps for `sandbox="allow-scripts"` present and `allow-same-origin` absent)
    - apps/web/components/issue/GameFallback.tsx (pure display; "Game unavailable." copy locked)
    - apps/web/components/issue/BonusSection.tsx (must stay `<section id="bonus">`; branches on bonusType)
    - apps/web/components/issue/ShopCallout.tsx (Phase 2 copy locked; restyle to dark band; print:hidden)
    - .planning/phases/09-issue-page-completion/09-UI-SPEC.md (§Game Contract; §Copywriting; §Layout BonusSection/ShopCallout)
  </read_first>
  <files>apps/web/components/issue/GameSlot.tsx, apps/web/components/issue/GameFallback.tsx, apps/web/components/issue/BonusSection.tsx, apps/web/components/issue/ShopCallout.tsx</files>
  <action>
1. GameSlot.tsx — DARK RESTYLE ONLY, security path UNCHANGED. Do NOT touch:
   - the `'use client'` directive (line 1),
   - `validateEmbedCode` / `injectGameHead` usage,
   - the `useEffect` that fires `insertQaCorrection` (runId-guarded, ref-guarded),
   - the `<iframe sandbox="allow-scripts" srcDoc={srcdoc} ...>` element — the `sandbox="allow-scripts"` literal MUST remain byte-identical and the file must contain NO same-origin escape token anywhere (including comments).
   Restyle the visual wrapper: the section header `THE GAME` label → `§`/`--color-accent` treatment; the game frame container → dark `--color-surface`/`--color-line-strong` border (keep the existing 280px/360px sizing and `overflow-hidden`); the "Game coming soon." empty-state copy stays exact. OPTIONAL: adopt the mockup's dark click-to-load placeholder UX by adding a placeholder + a real `<button aria-label="Play the game" className="...">` that, on click, sets a `started` state that swaps the placeholder for the EXISTING validated `<iframe>` (the iframe still renders `injectGameHead(embedCode)` with `sandbox="allow-scripts"`; the button does NOT bypass validateEmbedCode). If you add the ripple, use CSS keyframes (auto-neutralized by the reduced-motion guard) and ensure the button is ≥44px (the 88px circle satisfies this). If the click-to-load adds complexity/risk to the security path, you MAY skip it and just dark-restyle the always-rendered iframe — the validated render path is the priority. Run the game-sandbox test immediately after.

2. GameFallback.tsx — keep the locked copy `Game unavailable.` (period). Dark-restyle the container (`--color-text-dim`, `--color-surface`). No logic.

3. BonusSection.tsx — keep `<section id="bonus">` (NEVER `<main>`), keep the bonusType branching (bigBudget/jingle/specAd), keep the exact sub-labels ("BIG BUDGET TREATMENT"/"THE JINGLE"/"THE SPEC AD") and the jingle copy. Dark-restyle: `§`/label treatment, headline `--color-primary`, surfaces `--color-card`/`--color-line`, jingle `<audio>` retained. The storyboard `<img>` stays (next/image conversion is backlog item 999.1 — out of scope; keep the existing eslint-disable comment).

4. ShopCallout.tsx — keep the Phase 2 locked copy (the lip-balm sentence + "Buy the lip balm") and `print:hidden`. Restyle to the dark shop band: `--color-surface` background, `--color-text` sentence, the button uses `--color-accent` (or `--color-primary` per the UI-SPEC accent-reserved CTA list — UI-SPEC assigns shop button to primary; use `--color-primary` for the CTA bg with `--color-bg` text). Keep the ≥44px `min-h-[44px]` button and the focus-visible ring. (Phase 8 owns the shop checkout wiring; behavior unchanged here — restyle only.)
  </action>
  <verify>
    <automated>cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'sandbox="allow-scripts"' apps/web/components/issue/GameSlot.tsx` == 1
    - `grep -c "allow-same-origin" apps/web/components/issue/GameSlot.tsx` == 0
    - `grep -c "validateEmbedCode" apps/web/components/issue/GameSlot.tsx` >= 1 and `grep -c "injectGameHead" apps/web/components/issue/GameSlot.tsx` >= 1
    - `grep -c "insertQaCorrection" apps/web/components/issue/GameSlot.tsx` >= 1 (the qaCorrections write path preserved)
    - GameFallback.tsx still contains `Game unavailable.`
    - BonusSection.tsx contains `<section id="bonus"` and contains NO `<main`; still contains the three sub-labels
    - ShopCallout.tsx still contains `Buy the lip balm` and `print:hidden` and a `min-h-[44px]` (or `min-h-11`) button
    - No file in this task contains `<main`
    - `cd apps/web && npm run test:unit -- __tests__/game-sandbox.test.ts` exits 0
    - `cd apps/web && npm run test:unit` exits 0 (full suite)
  </acceptance_criteria>
  <done>Game, fallback, bonus, and shop are dark-restyled; the game security path and sandbox attribute are byte-preserved; bonus stays a section; shop copy locked; game-sandbox + full suite green.</done>
</task>

</tasks>

<verification>
- All eight components dark-restyled; pull-quotes render from the first body blockquote (no schema change, no hardcoded fixture quotes).
- GameSlot: `sandbox="allow-scripts"` only, validateEmbedCode/injectGameHead/qaCorrections path intact; game-sandbox.test.ts green.
- BonusSection is a `<section>`; no component emits a second `<main>`; canonical anchor ids unchanged.
- ShopCallout/GameFallback copy locked; print:hidden retained.
- issue-page-typography (Phase 10) test still green; full unit suite green.
</verification>

<success_criteria>
- The dark editorial art direction is complete across all article surfaces while every locked constraint (game sandbox, single main, canonical ids, ≥44px, reduced-motion, print, no hardcoded content) holds.
</success_criteria>

<output>
After completion, create `.planning/phases/09-issue-page-completion/09-05-SUMMARY.md`.
</output>
