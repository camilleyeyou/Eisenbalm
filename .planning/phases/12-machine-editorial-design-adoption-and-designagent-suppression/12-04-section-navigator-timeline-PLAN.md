---
phase: 12-machine-editorial-design-adoption-and-designagent-suppression
plan: 04
type: execute
wave: 1
depends_on: [01]
files_modified:
  - apps/web/components/issue/SectionNavigator.tsx
  - apps/web/app/globals.css
autonomous: true
requirements: [MED-04]

must_haves:
  truths:
    - "SectionNavigator renders a vertical timeline with a central spine, 8 section node-dots, per-section §NN numbers, READ STATUS readout, and a radial cursor glow"
    - "All 8 canonical anchor ids (#origin-story…#podcast) are preserved as the row hrefs"
    - "Reading progress binds to scroll position; the active section's node dot fills gold"
    - "Under prefers-reduced-motion the mousemove glow listener early-returns and motion is neutralized"
    - "Every row link is ≥44px tall; the nav lives inside the single root <main>; only FONT_WHITELIST fonts (Cormorant/Lora/Inter) are used"
  artifacts:
    - path: "apps/web/components/issue/SectionNavigator.tsx"
      provides: "Vertical Timeline rebuild with reading-progress + cursor glow"
      contains: "snw-timeline"
      min_lines: 150
    - path: "apps/web/app/globals.css"
      provides: "Phase 12 navigator + deliberation flow-line CSS classes (additive)"
      contains: "Phase 12 MED-04"
  key_links:
    - from: "SectionNavigator.tsx CARDS hrefs"
      to: "issue page section anchors (#origin-story … #podcast)"
      via: "IntersectionObserver on document.getElementById(sectionId)"
      pattern: "IntersectionObserver"
    - from: "SectionNavigator.tsx mousemove handler"
      to: ".snw-row::before radial-gradient (--mx/--my)"
      via: "element.style.setProperty('--mx', ...)"
      pattern: "--mx"
---

<objective>
Rebuild `SectionNavigator.tsx` from the current 8-card grid into the board's Vertical Timeline variant (MED-04): a full-width vertical list where each section is one row with a central spine, a node-dot, a `§ NN` number, a category tag pill, a Cormorant title (with one italic word), an editorial subtitle, and a right-aligned `READ STATUS: N%` machine-readout. A scroll-driven IntersectionObserver fills the active section's node dot gold and drives a spine progress fill. The existing `--mx`/`--my` cursor-glow pattern and the `prefers-reduced-motion` early-return are preserved. This plan also adds BOTH Phase 12 CSS blocks (navigator timeline AND deliberation flow-line) to globals.css under a single Phase 12 banner, so Plan 05 only touches DeliberationSlot.tsx.

Purpose: High-fidelity Machine Editorial navigator using only existing fonts, reduced-motion-safe, ≥44px targets, single <main>, WCAG AA.
Output: rebuilt SectionNavigator.tsx + additive Phase 12 globals.css classes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-CONTEXT.md
@.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-UI-SPEC.md
@.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md

@apps/web/components/issue/SectionNavigator.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add Phase 12 navigator + flow-line CSS blocks to globals.css (additive)</name>
  <files>apps/web/app/globals.css</files>
  <read_first>
    - apps/web/app/globals.css (the existing :root tokens lines ~42-64 — confirm --color-card-hover/--color-line-strong/--color-primary-glow/--color-text-mute/--color-text-dim/--color-scout/--color-advocate all exist; the @media print block at line ~108 hides .section-navigator; the @media (prefers-reduced-motion) guard at line ~293; the Phase 11 banner at line ~607; the ═══ banner separator style)
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-UI-SPEC.md (§Globals.css Extension Contract — copy BOTH the "Navigator Vertical Timeline additions" and "DeliberationSlot Flow Line additions" CSS blocks VERBATIM)
  </read_first>
  <action>
Append a new Phase 12 section to the END of `apps/web/app/globals.css`, following the existing `═══` banner convention used for the Phase 11 section (line ~607). Add a banner:
```css
/* ═══════════════════════════════════════════════════════════════════════
   PHASE 12 — MACHINE EDITORIAL DESIGN ADOPTION (MED-04 navigator + MED-05 flow)
   ═══════════════════════════════════════════════════════════════════════ */
```
Then paste, VERBATIM, BOTH CSS blocks from 12-UI-SPEC.md §Globals.css Extension Contract:
1. The full "Navigator Vertical Timeline additions" block — every class from `.snw-timeline` through the `@media (max-width: 480px)` override. It includes `.snw-module-label`, `.snw-title-plain`, `.snw-title-accent`, `.snw-spine`, `.snw-spine-line`, `.snw-spine-progress`, `.snw-node`, `.snw-node.active`, `.snw-section-num`, `.snw-row`, `.snw-row:first-child`, `.snw-row::before`, `.snw-row:hover::before`, `.snw-row:hover`, `.snw-row.active`, `.snw-content`, `.snw-tag-pill`, `.snw-row:hover .snw-tag-pill`/`.snw-row.active .snw-tag-pill`, `.snw-section-title`, `.snw-section-title em`, `.snw-subtitle`, `.snw-read-status`, `.snw-read-label`, `.snw-read-value`, `.snw-read-dash`, and the `@media (max-width: 480px)` block.
2. The full "DeliberationSlot Flow Line additions" block — `.del-flow`, `.del-flow-node`, `.del-flow-circle`, `.del-flow-connector`, `.del-flow-label`, `.del-flow-action`, `.del-confidence-bar-track`, `.del-confidence-bar-fill`, and the winner-glow comment.

DO NOT modify any existing `:root` variable, `.section-card`, `.section-cards`, `.pitch-card-list`, the print block, or the reduced-motion guard. The new `.snw-*` classes reference only existing `--color-*`/`--font-*` tokens — introduce NO new hex literals. The `.snw-row` `transition` + `transform`-on-hover and `.snw-spine-progress` `transition` are already neutralized by the global `@media (prefers-reduced-motion: reduce)` block — no per-class reduced-motion override needed.

Each Phase-12 CSS block must be tagged with the UI-SPEC's own comment header (`/* ── SECTION NAVIGATOR — VERTICAL TIMELINE (Phase 12 MED-04) ── */` and `/* ── DELIBERATION FLOW LINE (Phase 12 MED-05) ── */`) so the Wave 0 / future tripwires can grep `Phase 12 MED-04`.
  </action>
  <verify>
    <automated>pnpm --filter web build</automated>
  </verify>
  <acceptance_criteria>
    - globals.css contains `Phase 12 MED-04` and `Phase 12 MED-05` banner comments
    - globals.css contains `.snw-timeline`, `.snw-spine-progress`, `.snw-node.active`, `.snw-row::before`, `.snw-read-value`, `.del-flow`, `.del-confidence-bar-track`
    - No new hex literal added (grep for `#` inside the new block finds none outside comments — all colors via var(--color-*))
    - Existing `.section-card` / `.pitch-card-list` / `:root` declarations are unchanged (git diff shows additions only, at end of file)
    - `pnpm --filter web build` exits 0
  </acceptance_criteria>
  <done>Both Phase 12 CSS blocks are appended verbatim under a Phase 12 banner; no existing CSS modified; build green.</done>
</task>

<task type="auto">
  <name>Task 2: Rebuild SectionNavigator.tsx to the Vertical Timeline (MED-04)</name>
  <files>apps/web/components/issue/SectionNavigator.tsx</files>
  <read_first>
    - apps/web/components/issue/SectionNavigator.tsx (current: 'use client'; SectionCard interface; CARDS array with the 8 canonical hrefs; the useEffect mousemove handler lines ~94-129 with the prefers-reduced-motion early-return; the <nav className="section-navigator"> wrapper — KEEP this class so the print block keeps hiding it)
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-UI-SPEC.md (§SectionNavigator — Vertical Timeline (MED-04): Header Block, Section Row Anatomy, Radial Cursor Glow, Reading Progress, Row States, Reduced-Motion Checklist, Accessibility; §Copywriting Contract → SectionNavigator Subtitles table for the 8 subtitle + italicWord values)
    - .planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-RESEARCH.md (Pattern 4 + Pitfall 4 + Pitfall 5 + Code Examples "Reading-progress IntersectionObserver skeleton")
  </read_first>
  <action>
Replace the body of `apps/web/components/issue/SectionNavigator.tsx` with the Vertical Timeline implementation. Keep `'use client'` as line 1.

(1) Extend the `SectionCard` interface and CARDS data. Add `subtitle?: string` and `italicWord?: string`; the old `wide?`/`feature?` fields are unused in the timeline (you may drop them). Preserve the 8 canonical hrefs exactly. Populate `title`, `tag`, `subtitle`, `italicWord` from the UI-SPEC §Copywriting Contract table:
  - #origin-story: title "The Architecture of Absence" (italicWord "Absence"), tag "EDITORIAL", subtitle "How a thing with no funding found a reason to exist."
  - #problem: tag "ANALYSIS", subtitle "The precise mechanism by which the world fails this population.", italicWord "Problem"
  - #founder-bio: tag "PROFILE", subtitle "The person who decided this was worth doing.", italicWord "Bio"
  - #case-study: tag "IMPACT", subtitle "One documented instance. One outcome.", italicWord "Study"
  - #game: tag "INTERACTIVE", subtitle "A game about the stakes.", italicWord "Game"
  - #bonus: tag "EXTRA", subtitle "Something we could not leave out.", italicWord "Bonus"
  - #deliberation: tag "PROCESS", subtitle "A full audit of the candidate selection process.", italicWord "Deliberation"
  - #podcast: tag "AUDIO", subtitle "Listen to the decision being made.", italicWord "Podcast"
  Keep each row's `title` as the editorial label; render the `italicWord` inside the title as a `<em>` (split the title string on the italicWord, wrapping that token in `<em>`; if `italicWord` is absent or not found, render the title plain). Keep `number` as the 2-digit string ("01".."08").

(2) Preserve the cursor-glow useEffect VERBATIM in behavior (Pitfall 4): read `prefers-reduced-motion` inside the effect via `window.matchMedia('(prefers-reduced-motion: reduce)').matches`; if set, `return` (no mouse tracking). Attach mousemove to each ROW `<a>` (selector `.snw-row` instead of `.section-card`), setting `--mx`/`--my` as percentages — same math as today. Return a cleanup that removes the listeners.

(3) Add a SECOND useEffect for reading-progress (Pattern 4 + Pitfall 5):
  - Build `sectionIds = CARDS.map(c => c.href.slice(1))`.
  - `const [activeSection, setActiveSection] = useState<string | null>(null)`.
  - Create an `IntersectionObserver` (threshold 0.3) that on `entry.isIntersecting` calls `setActiveSection(entry.target.id)`. Observe each `document.getElementById(id)` that exists.
  - Optionally drive a spine fill fraction: track `scrollY / (scrollHeight - innerHeight)` via a scroll listener and set `navRef.current.style.setProperty('--spine-progress', `${fraction*100}%`)`; the `.snw-spine-progress` element uses `height: var(--spine-progress, 0%)`. (Planner discretion on exact fraction math.)
  - CRITICAL: return `() => observer.disconnect()` (and remove the scroll listener) to avoid state-update-after-unmount (Pitfall 5).
  - Under reduced-motion this observer STILL fires and sets state (the CSS transitions are neutralized by the global guard, so the dot/spine snap instantly — no extra JS bypass needed).

(4) Render structure (per UI-SPEC §Section Row Anatomy), keeping `<nav ref={navRef} aria-label="Sections" className="section-navigator">` as the outer element (KEEP `section-navigator` class — the print block hides it). Inside:
  - Header block: `<div>` with `<span className="snw-module-label">NAVIGATION MODULE 01-B</span>` and an `<h2>` (or span) `In this <span className="snw-title-accent">Issue</span>` styled by `.snw-title-plain`.
  - A `.snw-timeline` container. For each card, render an `<a className={'snw-row' + (activeSection === id ? ' active' : '')} href={card.href} aria-label={`§ ${card.number} ${card.title} — ${card.tag}`}>`:
    - `.snw-spine` column containing `.snw-spine-line`, `.snw-spine-progress`, a `.snw-node` (with `.active` when `activeSection === id`, `aria-hidden="true"`), and a `.snw-section-num` showing `§ {card.number}`.
    - `.snw-content` column containing `.snw-tag-pill` (the tag), `.snw-section-title` (title with the `<em>` italic word), and `.snw-subtitle` (subtitle) when present.
    - `.snw-read-status` column: a single `<span aria-live="polite" aria-label={`Read status: ${pct}%`}>` containing `.snw-read-label` ("READ STATUS:"), `.snw-read-value` (`${pct}%` — 0 by default, or live reading-progress for the active row; planner may render `0%` for all and only the active row as `100%`/in-progress per discretion), and `.snw-read-dash` ("——").
  - Node dots `aria-hidden="true"`; the spine/glow are decorative.

(5) Touch targets: `.snw-row` already has `min-height: 88px` from globals.css — confirm no inline override reduces it. Use ONLY Cormorant/Lora/Inter via the `--font-display`/`--font-body`/`--font-ui` tokens (all class-driven from globals.css). No new fonts, no hardcoded hex.

Do NOT add a `<main>` or `role="main"` — the nav lives inside the root layout's single `<main id="main">`.
  </action>
  <verify>
    <automated>pnpm --filter web test:unit -- machine-editorial-components && pnpm --filter web build</automated>
  </verify>
  <acceptance_criteria>
    - SectionNavigator.tsx contains all 8 canonical hrefs: `#origin-story`, `#problem`, `#founder-bio`, `#case-study`, `#game`, `#bonus`, `#deliberation`, `#podcast`
    - SectionNavigator.tsx contains `prefers-reduced-motion` (the early-return guard) and `IntersectionObserver` and `--mx`
    - SectionNavigator.tsx contains `snw-timeline`, `snw-row`, `snw-node`, `snw-section-num`, `snw-read-status`, `snw-module-label`, and `subtitle`/`italicWord` fields on SectionCard
    - SectionNavigator.tsx keeps `className="section-navigator"` on the outer `<nav>` and contains no `<main` tag
    - No hardcoded hex color in SectionNavigator.tsx (grep for `#` followed by 6 hex digits in JSX/style finds none)
    - `pnpm --filter web test:unit -- machine-editorial-components` exits 0 (anchor-id + reduced-motion tripwires green)
    - `pnpm --filter web build` exits 0
  </acceptance_criteria>
  <done>SectionNavigator renders the Vertical Timeline with reading-progress + cursor glow, preserves canonical anchor ids + reduced-motion early-return + ≥44px rows, uses only FONT_WHITELIST fonts, and the tripwires + build are green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web build` exits 0
- `pnpm --filter web test:unit` exits 0 (machine-editorial-components anchor-id + reduced-motion assertions green; issue-page-typography + theme-aa-tones + site-header-nav unchanged green)
- globals.css additions are at end-of-file under the Phase 12 banner; no existing CSS modified
- SectionNavigator preserves all 8 canonical anchor ids and the reduced-motion early-return
</verification>

<success_criteria>
- MED-04: SectionNavigator is a high-fidelity Vertical Timeline (spine, node dots, §NN, READ STATUS, cursor glow, reading progress) using only Cormorant/Lora/Inter
- Reduced-motion-safe: mousemove early-returns; spine/dot snap instantly under reduced-motion
- ≥44px row targets; single <main> preserved; WCAG AA tokens only
- No new npm deps; no new fonts; no hardcoded hex
</success_criteria>

<output>
After completion, create `.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-04-SUMMARY.md`
</output>
