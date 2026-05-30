# Phase 10 — UI Review (Retroactive, in light of Phases 9/10/12/13/14/16)

**Audited:** 2026-05-30
**Baseline:** Abstract 6-pillar standards anchored to CLAUDE.md's "magazine that happens to sell one product, not a newsletter" target. No UI-SPEC.md exists for Phase 10.
**Audit target:** `https://eisenbalm-web.vercel.app/issue/issue-999530` (Tamar Rescue Foundation, narrator: Werner Herzog)
**Screenshots:** captured (`.planning/ui-reviews/10-20260530-063454/{desktop,mobile,tablet}.png`, .gitignored)
**Live HTML reference:** `/tmp/issue-999530-v2.html` (~125 KB, full RSC render)
**User-reported failure mode (verbatim, 2026-05-30):** "the sections are present in very long reads, It's boring for someone to just come on and see a chunk of text, many people will find this boring and may not even start reading, I don't think this is how famous news papers present. Let's find a way to fix this and make interesting and easy to read"

---

## TL;DR

The user is right. The redesign succeeds at being **typographically beautiful** — Cormorant Garamond display + Lora body + warm-paper palette + drop cap + ornament fleurons is a real Atlantic/Harper's voice. It fails at being **editorially scannable**. The current page renders the five long-read sections as **uninterrupted ribbons of body prose** — between 287 and 551 words per section with **zero intra-section breaks**: 0 sub-heads, 0 pull quotes, 0 stat callouts, 0 inline figures across all five long-reads. Quantified evidence below.

Phase 10 shipped the typography vocabulary. **The agents never write to that vocabulary.** Pull-quote handling exists in `PortableTextRenderer` for `blockquote` blocks, but `grep -c '<blockquote' /tmp/issue-999530-v2.html` = **0**. The schema has structured `problemStatement.pdfContent.keyDataPoints[3]` (the stat trio) — never rendered on the page; locked away inside the PDF. The page has the bones of a magazine but the rendering of a Medium post.

**Overall: 14 / 24 (Acceptable-trending-poor — fails the magazine target on every density-related pillar)**

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 4/4 | Voice is right. Eyebrows specific. CTA non-generic. No template smells. |
| 2. Visuals | 1/4 | Five long-reads render as uninterrupted paragraph walls. 0 figures, 0 stat blocks, 0 pull quotes, 0 sub-heads across all body sections. |
| 3. Color | 3/4 | Warm-paper palette is correct; gold/rust restraint right. Loses 1pt: accent never reaches inline copy (no pull-quote color, no stat highlight) so the palette feels under-used. |
| 4. Typography | 3/4 | Display + body pairing is editorial-grade. Loses 1pt: only 2 in-document typography roles actually appear (h1 charity name, body p). The h2/h3/blockquote roles defined in `PortableTextRenderer` are **dead code at the live URL**. |
| 5. Spacing | 2/4 | Vertical rhythm between sections is generous; rhythm WITHIN sections is monotonous. 9 consecutive `<p>` with 61-word avg in Origin Story (no break). |
| 6. Experience Design | 1/4 | SectionNavigator is not sticky — disappears after viewport 1. No reading aids during 3,510-word long-read. CaseStudy `metadata-block` renders with empty `<dd></dd>` for this issue (`subjectName` missing) — visible empty panel. |

**Overall: 14 / 24**

---

## Top 5 Priority Fixes (Impact × Effort)

| # | Fix | Impact | Effort | Owner |
|---|-----|--------|--------|-------|
| 1 | **Force agents to emit at least 2 h2 sub-heads per long-read section** (write into ProblemWriter / OriginStoryWriter / FounderBioWriter / CaseStudyWriter Pydantic contracts; QA agent rejects on `block.style === 'h2' count < 2`). Renderer already handles `h2`/`h3`. Zero frontend work. | Massive — turns every wall-of-text into 3-4 scannable chunks | XS (prompt + QA rule) | Pipeline |
| 2 | **Render `problemStatement.pdfContent.keyDataPoints[3]` as inline stat callouts inside The Problem section.** Schema validates `length(3)` already. Build a small `StatRow` component (3 stats horizontal on desktop, stacked on mobile), gold numeral + small-caps source attribution. | Large — gives The Problem a focal point and turns latent schema data into visible editorial. | S (1 component + 1 render slot) | Web |
| 3 | **Make the first body paragraph of each section a "lede" (larger, lighter, distinct from the running 19px prose) — not just the drop cap on Origin Story.** Magazines use lede paragraph styling as the entry-point. Add `.lede` utility (e.g. `font-display 22px italic`, no drop cap conflict), wire to `EditorialSection.lead` prop AND extend it: every section gets a lede paragraph; only Origin Story gets the drop cap. | Medium — adds a second visual hook per section opener; doesn't depend on the pipeline. | XS (CSS + 1 line in `PortableTextRenderer`) | Web |
| 4 | **Pull-quote the most-quotable sentence per section.** Agents already produce strong founder/case quotes inside body. Two options: (a) writer agents emit one `block.style === 'blockquote'` per section; existing renderer pull-quote treatment fires immediately. (b) Add a `pullQuote: string` field on each section in `weeklyIssue.ts` + render via a `PullQuote` component between paragraphs 3 and 4. **Option (a) is zero-schema-change** (already documented "HYBRID locked decision" in `PortableTextRenderer.tsx` comments). | Large — converts every section into a Verge-style asymmetric layout. | XS for option (a); M for option (b) | Pipeline (option a) |
| 5 | **Make SectionNavigator sticky on desktop ≥1024px.** It's the only navigation aid during a 3,510-word read and currently scrolls off after the hero. A right-rail or top sticky TOC keeps it useful. The `.snw-spine-progress` element is already wired with a scroll-listener — it works invisibly when off-screen. | Medium — gives readers a "where am I?" anchor; cheap retention win. | S (`position: sticky` + container restructure) | Web |

---

## Detailed Findings

### Pillar 1 — Copywriting (4/4)

**Method:** Read every visible string in `/tmp/issue-999530-v2.html`; cross-checked against generic-label patterns.

**Evidence:**
- Voice is intact, dry, specific. Eyebrows: `ORIGIN STORY`, `THE PROBLEM`, `FOUNDER BIO`, `CASE STUDY`, `THE BONUS`. No "Read more" / "Learn more" / "Submit" / "Click here". Sub-label "THE SPEC AD" is non-generic.
- Hero byline `by Jesse A. Eisenbalm` (literal italic body serif) — masthead voice correct.
- Mission lede reads `Rescuing and rehabilitating victims of human trafficking while providing education and economic empowerment` — straight, no exclamation, no sentiment hedge. Matches CLAUDE.md voice contract.
- Narrator chip reads `Narrated by Werner Herzog` — Phase 16 affordance present and exact.
- Origin opener: `Lagos, 2009. A social worker named Kemi Asante encountered a teenage girl at a transit shelter who had been moved across three countries in eleven days.` — this is a real journalism lede. The voice contract is met.

**Verdict:** This pillar is fine. The complaint is not about words; it's about the rendering of words.

---

### Pillar 2 — Visuals (1/4)

**Method:** Counted breaks (h2, h3, blockquote, img, dl, ul, ol) within each editorial section in `/tmp/issue-999530-v2.html`. Result is dispositive.

**Per-section breaks INSIDE the body (after the section's display h2):**

| Section | <p> blocks | Avg words/<p> | Total words | h2 | h3 | blockquote | img | dl | ul | ol |
|---|---|---|---|---|---|---|---|---|---|---|
| origin-story | 9 | 61.2 | 551 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| problem | 7 | 64.4 | 451 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| founder-bio | 7 | 73.6 | 515 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| case-study | 10 | 54.9 | 549 | 0 | 0 | 0 | 0 | 1 (empty) | 0 | 0 |
| bonus | 4 | 71.8 | 287 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

**Whole-page:** 0 `<img>` inside any editorial body. 0 `<figure>`/`<figcaption>`. 0 `<blockquote>`. 1 `<dl class="metadata-block">` (rendered EMPTY — `<dd></dd>` because `subjectName` is null on this issue). The only intra-section visual element on the entire page is an empty caption block.

**Evidence:**
- `apps/web/components/issue/PortableTextRenderer.tsx:34-43` defines beautiful h2 (26px display) and h3 (20px display) treatments — **the agents never emit `block.style === 'h2'` or `'h3'` so this code is dead at the live URL.**
- `apps/web/components/issue/PortableTextRenderer.tsx:48-52` defines a pull-quote treatment (clamp(26px,3.2vw,38px), display italic, accent border). **The agents never emit `block.style === 'blockquote'`. Pull-quotes are zero-cost dead code today.**
- Inline figures only appear in `BonusSection.bigBudget` (storyboard grid at end-of-section) — never inside the four long-reads. Bonus storyboards land AFTER all body prose, not as figure-with-caption inside running prose.

**Fixes:**
1. **(Pipeline)** Update each long-read writer agent's Pydantic output schema to require `headings: list[{level: int, text: str, after_block_index: int}]` and post-process Portable Text to insert h2 blocks. Add QA rule `len([b for b in body if b.style == 'h2']) >= 2 for each long-read section` — reject otherwise. Same for at least one `blockquote` per section.
2. **(Web)** Build a `StatRow` component for The Problem section's `keyDataPoints` (see Fix #2). Lift `problemStatement.pdfContent.keyDataPoints` out of the GROQ projection (`apps/web/lib/sanity/queries.ts` currently only pulls `problemPdfUrl`).
3. **(Web)** Build a `FigureWithCaption` component so the FounderBio and CaseStudy sections can carry a portrait or a contextual photo inside the prose (mid-section), not at the end. Wire to a new `figures: list[{assetUrl, caption, position}]` array on each section schema. Backlog item.

---

### Pillar 3 — Color (3/4)

**Method:** Counted hex literals + CSS var references; surveyed where `--color-accent` and `--color-primary` actually land.

**Evidence:**
- Warm paper bg `#FAFAF8` + near-black ink `#1A1A1A` is correct for editorial; gold (`#CDA434`) + rust (`#C2502A`) restraint at decoration-only is right (Phase 14 honored this).
- No hardcoded hex outside of `globals.css :root` and per-issue theme injection.
- `--color-accent` reaches: mission lede left border (hero), section navigator hover glow, blockquote left-border (but no blockquote exists), metadata-block left-border (but content is empty), confidence meter (deliberation).
- `--color-primary` reaches: section headlines, h1 charity name, ornament dividers, drop cap initial letter, hero ghost numeral.
- **Gap:** because the long-reads contain no h2/h3/blockquote/dl/figure, the entire accent palette is under-used inside the editorial body. The reader sees the palette in the chrome (hero, navigator, dividers) and the chrome only.

**Fixes:**
1. Once Fix #2/#4 land, accent will naturally appear in the pull-quote border + stat-row numerals. No additional palette work needed.
2. Consider adding a `var(--color-primary-glow)` underline on the first paragraph's first sentence ("Lagos, 2009.") — a print-magazine lede convention.

---

### Pillar 4 — Typography (3/4)

**Method:** Grepped font-size and font-family classes in components + counted distinct sizes in the live DOM.

**Evidence:**
- Fonts loaded via `next/font/google` (Plan 10-01 contract preserved): Playfair Display (subsetted), Lora, Inter. Phase 14 swapped `--font-display` to Cormorant Garamond — also next/font safe.
- Distinct font-sizes in the editorial body that actually render at the live URL: **2** — the `clamp(38px,5vw,64px)` section headline and the 19px body `<p>`. The bonus section's `clamp(38px,5vw,64px)` headline is the same role.
- Defined-but-dead typography roles at the live URL: in-prose h2 (26px display, line 35), in-prose h3 (20px display, line 40), blockquote (clamp(26px,3.2vw,38px) display italic, line 49). All three are valid in `PortableTextRenderer` — zero of them have markup at the live URL.
- Drop cap renders correctly on the Origin Story section (`<div class="drop-cap"><p>Lagos, 2009. ...`) — confirmed in DOM.
- The display headline uses `font-weight: normal` (400) — feels Atlantic-y. Right call.

**Verdict:** The font stack is excellent and the styles are defined for richer hierarchy. The agents simply never emit the structural markers that activate them. This is the same root cause as Pillar 2.

**Fixes:**
1. Same as Pillar 2 — get agents to write sub-heads + pull quotes; the typography system will respond.
2. Consider adding a `.lede` utility for the first paragraph of every section: `font-display, font-light, italic, font-size: 22px, color: var(--color-text)` — a third in-document role. This is visible work for ~20 lines of code (CSS + a `lede` prop on `EditorialSection` similar to `lead`).

---

### Pillar 5 — Spacing (2/4)

**Method:** Compared `EditorialSection` margins + rhythm vs. magazine standards. Examined the `<p>` margin progression.

**Evidence:**
- Between-section rhythm is good: `EditorialSection` wraps in `.prose-measure` (68ch / responsive padding), opens with `.ornament-divider` (2.5rem block margin), closes with `mt-10` (~40px). The ornament fleuron is doing its job at the macro level.
- Within-section rhythm is monotonic: every body `<p>` has `mb-5` (20px). Across 9-10 paragraphs (Origin Story / Case Study), the reader sees: 20px gap, paragraph, 20px gap, paragraph, 20px gap — **identical rhythm 9 times in a row**. That's the wall-of-text texture the user is reporting.
- Long-section interior is 451–551 words at 19px/1.7 line-height. At 68ch measure, that's roughly **~280-350 vertical pixels per paragraph** on desktop, meaning a single section is **~2,500-3,500 vertical pixels of unbroken serif gray.** Confirmed visually in `.planning/ui-reviews/10-20260530-063454/desktop.png` (the full-page screenshot shows 4 of these gray ribbons stacked).
- Mobile (375px) view is worse: same word count narrows to ~37ch measure and runs much longer vertically. Screenshot file shows 4 long ribbons stacked.
- The 4 macro ornament dividers visible in DOM (between hero/origin, origin/problem, problem/founder, founder/case-study) are pleasant but they only break the BETWEEN-section rhythm. Inside any one section it's 451+ words of uninterrupted prose.
- Plan 10-02 Task 5 step 7 explicitly skipped the optional bonus→deliberation divider. Confirmed in DOM: no ornament between bonus and deliberation, no ornament after deliberation.

**Fixes:**
1. **Vary paragraph spacing with intent:** When a sub-head (Fix #1) lands, give it `mt-12 mb-6` (more breath above, less below) so the sub-head creates a visible "section-within-section" break.
2. **Sentence-case the first paragraph differently:** Tighter leading or larger font for paragraph 1, returning to 19px/1.7 for paragraph 2+. Magazines call this the lede paragraph and it's a near-universal pattern.
3. **Add the bonus→deliberation ornament divider** Plan 10-02 deferred. Same divider, one line, makes the page feel finished at the bottom.

---

### Pillar 6 — Experience Design (1/4)

**Method:** Walked the page top→bottom, identifying state coverage + reading-aid affordances.

**Evidence:**
- **SectionNavigator is not sticky.** DOM analysis: `<nav aria-label="Sections">` lives at byte 9819–16057. Origin Story starts at byte 16066. The navigator renders ONCE at the top of the article, between the hero and the first section, then scrolls out of view. There's no `position: sticky` rule on `.section-navigator` in `globals.css`. A 3,510-word read with no persistent "where am I" affordance — readers lose orientation.
- **CaseStudy metadata block renders EMPTY for this issue.** Live DOM excerpt: `<dl class="metadata-block" aria-label="Case study metadata"><dt>Subject</dt><dd></dd></dl>`. The `subjectName != null` guard in `CaseStudySection.tsx:55` returns `true` for `subjectName = ""` (empty string) — there's no `subjectName && subjectName.trim() !== ''` check. So an empty rust-bordered panel labelled "SUBJECT" hangs in the case study with no value. Bug.
- **No "back to top" or "next section" affordance** inside the long-reads. After 549 words of case study, the reader is asked to keep scrolling with no visible end-of-section cue beyond white space.
- **No reading progress in the foreground.** The scroll-progress bar at top is 2px and uses `var(--color-primary-glow)` — at the `12%` mix in Phase 14, it's nearly invisible against the warm-paper bg. Confirmed in screenshot (the top edge is featureless).
- **No anchor-copy feedback besides a button.** `AnchorCopyButton` is present per section but tiny; doesn't double as a section progress indicator.
- **No table-of-contents jump from inside a long-read.** Once you're 800 words into the page, the only nav is browser-back. Phase 12's vertical timeline carousel is hidden above you.
- **Print:** `@media print` block exists and hides chrome. Reasonable.
- **Reduced motion:** `@media (prefers-reduced-motion: reduce)` block exists. Good.
- **Mobile reading:** Screenshot shows the same wall-of-text problem amplified by the narrower column.

**Fixes:**
1. **Sticky the SectionNavigator on ≥1024px** — either as a top-rail (replace the giant block) or a right-rail (200px column reserved on `>=1280px`). The spine-progress logic is already wired; it just needs to be on-screen.
2. **Fix the empty metadata-block bug** — change `{subjectName != null && ...}` to `{subjectName?.trim() && ...}` in `apps/web/components/issue/CaseStudySection.tsx:55`. One-line fix.
3. **Add a thin "x / 8" or "Section 3 of 8" indicator** inside the editorial column, perhaps in the eyebrow row, so readers know they're 3/8 of the way through.
4. **Make the scroll-progress bar visible** — bump from `--color-primary-glow` (12% gold) to `--color-primary` solid + thicker (4px instead of 2px). Currently invisible on light bg.
5. **Add an end-of-section "next: THE PROBLEM →" link** — anchor jump to the next section's id; visible reading aid; 5 lines of JSX in `EditorialSection`.

---

## Files Audited

- `apps/web/app/issue/[slug]/page.tsx` (renders the 10-section flow)
- `apps/web/components/issue/EditorialSection.tsx` (long-read wrapper)
- `apps/web/components/issue/PortableTextRenderer.tsx` (body prose primitives — including the dead-coded h2/h3/blockquote roles)
- `apps/web/components/issue/IssueHero.tsx` (masthead)
- `apps/web/components/issue/CaseStudySection.tsx` (metadata-block bug source)
- `apps/web/components/issue/BonusSection.tsx` (storyboards as the only inline visual asset on any long-read)
- `apps/web/components/issue/SectionNavigator.tsx` (non-sticky top-only TOC)
- `apps/web/app/globals.css` (Phase 10 utilities, Phase 12 navigator timeline, Phase 14 light palette)
- `apps/studio/schemas/weeklyIssue.ts` (latent `keyDataPoints[3]` stat schema, never rendered)
- `apps/web/lib/sanity/queries.ts` (confirmed `keyDataPoints` not projected to the page)
- `/tmp/issue-999530-v2.html` (live RSC render — quantitative ground truth)
- `.planning/phases/10-editorial-design-pass/10-01-fonts-and-globals-{PLAN,SUMMARY}.md`
- `.planning/phases/10-editorial-design-pass/10-02-issue-page-redesign-{PLAN,SUMMARY}.md`
- `.planning/phases/10-editorial-design-pass/10-03-visual-regression-tests-{PLAN,SUMMARY}.md`
- `.planning/phases/10-editorial-design-pass/10-04-readme-and-uat-{PLAN,SUMMARY}.md`
- `CLAUDE.md` (magazine-not-newsletter contract — the audit baseline)

---

## Summary: where the gap is

Phase 10 successfully built the **typography vocabulary**. Phase 12 successfully built the **navigator and deliberation flow**. Phase 14 successfully built the **light palette**. Phase 16 successfully built the **narrator chip**.

None of those phases built **the editorial structure inside a section**. The renderer can show pull quotes; the agents don't emit pull-quote markers. The renderer can show sub-heads; the agents emit one block.style ("normal") only. The schema has stat triples; the GROQ query doesn't project them and no component consumes them.

**The shortest path to fixing the user complaint runs through the agents, not the frontend.**

Two pipeline-side changes (force ≥2 h2 sub-heads per long-read; force exactly 1 blockquote per long-read) would activate already-built typography immediately and turn every section from a wall into 3-4 scannable chunks with a visible quote. One web-side render (`keyDataPoints` as a stat row in The Problem) plus one bug fix (`subjectName.trim()` guard) plus making SectionNavigator sticky closes the rest.

Estimated total effort for Fixes #1-5: **~1 day pipeline + ~1 day web**. The typographic foundation laid by Phase 10 is sound; what's needed now is structural editorial markup, not a new design pass.
