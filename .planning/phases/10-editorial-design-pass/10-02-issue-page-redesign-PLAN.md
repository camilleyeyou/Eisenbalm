---
phase: 10-editorial-design-pass
plan: 02
type: execute
wave: 1
depends_on:
  - 10-01
files_modified:
  - apps/web/app/issue/[slug]/page.tsx
  - apps/web/components/issue/IssueHero.tsx
  - apps/web/components/issue/EditorialSection.tsx
  - apps/web/components/issue/CaseStudySection.tsx
  - apps/web/components/issue/PortableTextRenderer.tsx
autonomous: true
requirements:
  - DES-01
  - DES-02
  - DES-03
  - DES-04
  - DES-05
  - DES-06
must_haves:
  truths:
    - "Issue page section headers use the small-caps .eyebrow + serif headline pattern (no inline 0.1em letter-spacing strings)"
    - "Origin Story (first prose section) wraps its body in a .drop-cap container so the first paragraph's first letter renders as a drop cap"
    - "All editorial sections constrain prose to 68ch via .prose-measure or equivalent max-width"
    - "Section transitions render an .ornament-divider Unicode glyph instead of a default 1px <hr>-style horizontal rule"
    - "Case Study renders its structured metadata in a .metadata-block (subject footnote-style block) visually distinct from prose"
    - "ShopCallout.tsx is NOT modified — file content unchanged"
    - "GameSlot.tsx is NOT modified — Phase 7 source-scan tripwire still passes"
    - "Per-issue theme injection still works: page.tsx + layout.tsx still emit <style> with --color-primary/--color-accent/--color-bg/--color-text"
    - "Issue page remains a Server Component (no 'use client' at top of page.tsx)"
  artifacts:
    - path: "apps/web/components/issue/EditorialSection.tsx"
      provides: "Refactored to use .eyebrow + .prose-measure + .ornament-divider + .drop-cap (when lead=true) utilities"
      contains: "lead"
    - path: "apps/web/components/issue/CaseStudySection.tsx"
      provides: "Footnote-style structured metadata block via .metadata-block dl/dt/dd"
      contains: "metadata-block"
    - path: "apps/web/components/issue/IssueHero.tsx"
      provides: "Masthead-style charity header (larger display, italic byline, eyebrow metadata)"
      contains: "by Jesse A. Eisenbalm"
    - path: "apps/web/app/issue/[slug]/page.tsx"
      provides: "lead prop on Origin Story EditorialSection drives drop-cap container"
      contains: "lead"
    - path: "apps/web/components/issue/PortableTextRenderer.tsx"
      provides: "Body paragraph line-height bumped to >= 1.55 and font-size unified at 18px body, paragraphs gain margin-bottom"
      contains: "leading-\\[1.6"
  key_links:
    - from: "apps/web/components/issue/EditorialSection.tsx"
      to: "apps/web/app/globals.css"
      via: "className references .eyebrow, .prose-measure, .ornament-divider, .drop-cap"
      pattern: "eyebrow|prose-measure|ornament-divider|drop-cap"
    - from: "apps/web/app/issue/[slug]/page.tsx"
      to: "apps/web/components/issue/EditorialSection.tsx"
      via: "lead prop on Origin Story section"
      pattern: "lead"
    - from: "apps/web/app/issue/[slug]/layout.tsx"
      to: "apps/web/app/globals.css"
      via: "serializeThemeCss() still injects --color-* variables consumed by .drop-cap, .ornament-divider, .eyebrow"
      pattern: "var\\(--color-"
---

<objective>
Apply the Phase 10 editorial typography redesign to the issue page. Refactor the four
editorial-prose components (EditorialSection, CaseStudySection, IssueHero,
PortableTextRenderer) to consume the named utilities from Plan 10-01 (.prose-measure,
.eyebrow, .drop-cap, .ornament-divider, .metadata-block). Mark the Origin Story section
as the "lead" so it gets the drop cap. The Game iframe and Shop Callout are
SCRUPULOUSLY untouched — Phase 7's source-scan tripwire and Phase 2's ShopCallout
locked contract both regress immediately if those files change.

Purpose: This is where the page goes from "decent Phase 2 reader experience" to
"a magazine that happens to sell one product" (CLAUDE.md). The CSS vocabulary
landed in 10-01; this plan applies it.

Output: Five files modified to consume Phase 10 utility classes; lead-section
drop-cap pattern in place; case-study sidebar metadata block in place;
ornament dividers between sections; masthead header.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@apps/web/app/issue/[slug]/page.tsx
@apps/web/app/issue/[slug]/layout.tsx
@apps/web/app/globals.css
@apps/web/components/issue/EditorialSection.tsx
@apps/web/components/issue/CaseStudySection.tsx
@apps/web/components/issue/IssueHero.tsx
@apps/web/components/issue/PortableTextRenderer.tsx
@apps/web/components/issue/ShopCallout.tsx
@apps/web/components/issue/GameSlot.tsx

<interfaces>
<!-- Phase 10-01 added these CSS utility classes to globals.css. Use them by NAME — -->
<!-- do not duplicate the underlying CSS into component className strings. -->

From apps/web/app/globals.css (Plan 10-01 additions):
```css
.prose-measure { max-width: 68ch; margin-inline: auto; padding-inline: 1.25rem; }
.drop-cap > p:first-of-type::first-letter { font-family: var(--font-display); font-size: 3.5em; float: left; ... }
.ornament-divider { /* centered ❦ FLEURON U+2766 with vertical rhythm */ }
.eyebrow { font-family: var(--font-ui); font-size: 0.75rem; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.6; }
.metadata-block { border-left: 2px solid var(--color-accent); padding-left: 1rem; font-variant-numeric: tabular-nums; }
```

From apps/web/components/issue/ShopCallout.tsx (LOCKED — do not modify, only verify):
```typescript
export function ShopCallout({ shopUrl }: ShopCalloutProps) { /* … */ }
```

From apps/web/components/issue/GameSlot.tsx (LOCKED — do not modify):
```typescript
'use client'
// … sandbox="allow-scripts" — Phase 7 source-scan tripwire
```

From apps/web/app/issue/[slug]/page.tsx (current EditorialSection render calls):
```tsx
<EditorialSection id="origin-story" label="ORIGIN STORY" headline={...} body={...} />
<EditorialSection id="problem"      label="THE PROBLEM" headline={...} body={...} />
<EditorialSection id="founder-bio"  label="FOUNDER BIO" headline={...} body={...} />
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Refactor EditorialSection to use Phase 10 utilities + add lead prop for drop cap</name>
  <files>apps/web/components/issue/EditorialSection.tsx</files>
  <read_first>
    - apps/web/components/issue/EditorialSection.tsx (the file being modified — confirm the current structure: div divider, label span, h2 headline, PortableTextRenderer body)
    - apps/web/app/globals.css (confirm .eyebrow, .prose-measure, .ornament-divider, .drop-cap utilities exist — Plan 10-01 added them)
    - apps/web/components/issue/PortableTextRenderer.tsx (confirm how it wraps body — the .drop-cap selector targets the FIRST direct-child <p> of the wrapper, so the PortableText output's first <p> must remain a direct child)
  </read_first>
  <action>
Refactor apps/web/components/issue/EditorialSection.tsx with these EXACT changes.

1. Add a `lead?: boolean` prop to the `EditorialSectionProps` interface (defaults to
   false). JSDoc on the prop: "When true, applies the .drop-cap container to the body,
   giving the first paragraph's first letter a 3.5em drop cap. Set on the first prose
   section of an issue (typically Origin Story). DES-02."

2. Update the function signature to destructure `lead = false`.

3. Replace the section className from
   `mx-auto w-full max-w-[680px] px-4 sm:px-6 lg:px-8`
   to
   `prose-measure`
   (the Plan 10-01 utility handles max-width + horizontal padding).

4. Replace the top divider div (the `<div className="mb-8 h-px ..." style={{ opacity: 0.12 }} />` block) with:
   `<div className="ornament-divider" aria-hidden="true" />`
   Do NOT keep the old 1px rule. The ornament divider IS the section transition (DES-04).

5. Replace the label span (the `font-ui text-[14px] uppercase ... tracking-[0.1em] ...`
   inline span) with `<span className="eyebrow">{label}</span>`. The .eyebrow class
   supplies size, weight, letter-spacing, casing, color, opacity.

6. Replace the headline h2's inline-utility chain with a stable className that uses
   the display font + primary color + a generous editorial size:
   `<h2 className="mt-3 mb-8 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.005em] text-[color:var(--color-primary)] sm:text-[44px]">`
   Rationale: 32/44 (mobile/desktop) is bigger than Phase 2's 28/36 — the redesign's
   display hierarchy needs more presence. tracking -0.005em tightens optical spacing
   on large serif display.

7. Wrap the PortableTextRenderer call in a conditional drop-cap container. CRITICAL:
   the .drop-cap selector targets `.drop-cap > p:first-of-type::first-letter`, so the
   PortableTextRenderer's existing wrapper <div> would block selector matching.
   Solution: pass a className to PortableTextRenderer that adds .drop-cap to ITS
   wrapper div. PortableTextRenderer already accepts a className prop (Task 4 of this
   plan confirms / extends it). Wire it like:
   ```tsx
   <PortableTextRenderer value={body} className={lead ? 'drop-cap' : undefined} />
   ```
   This way the wrapper div itself gets .drop-cap, and the first <p> rendered by
   PortableText is a direct child of that wrapper — matching the selector exactly.

8. KEEP the anchor copy button next to the eyebrow label (Phase 2 contract WEB-16
   must not regress):
   ```tsx
   <div className="mb-4 flex items-center gap-2">
     <span className="eyebrow">{label}</span>
     <AnchorCopyButton sectionId={id} />
   </div>
   ```

9. KEEP the bottom breathing-room div (`<div className="mt-8" aria-hidden="true" />`).

10. Update the JSDoc header to add: `* Phase 10: refactored to consume .eyebrow,
    .prose-measure, .ornament-divider utilities from globals.css. lead prop opts into
    .drop-cap on the body. DES-02, DES-03, DES-04.`

Final structure:
```tsx
import type { PortableTextBlock } from '@portabletext/react'
import { PortableTextRenderer } from './PortableTextRenderer'
import { AnchorCopyButton } from '@/components/AnchorCopyButton'

interface EditorialSectionProps {
  id: string
  label: string
  headline?: string | null
  body?: PortableTextBlock[] | null
  className?: string
  /** When true, applies .drop-cap to the body wrapper so the first paragraph's first
   *  letter renders as a 3.5em drop cap. Set on the first prose section
   *  (typically Origin Story). DES-02. */
  lead?: boolean
}

export function EditorialSection({ id, label, headline, body, className, lead = false }: EditorialSectionProps) {
  return (
    <section id={id} className={['prose-measure', className ?? ''].join(' ').trim()}>
      <div className="ornament-divider" aria-hidden="true" />
      <div className="mb-4 flex items-center gap-2">
        <span className="eyebrow">{label}</span>
        <AnchorCopyButton sectionId={id} />
      </div>
      <h2 className="mt-3 mb-8 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.005em] text-[color:var(--color-primary)] sm:text-[44px]">
        {headline ?? 'Untitled Section'}
      </h2>
      <PortableTextRenderer value={body} className={lead ? 'drop-cap' : undefined} />
      <div className="mt-8" aria-hidden="true" />
    </section>
  )
}
```
  </action>
  <verify>
    <automated>grep -q "lead?: boolean" apps/web/components/issue/EditorialSection.tsx && grep -q 'className="eyebrow"' apps/web/components/issue/EditorialSection.tsx && grep -q 'className="ornament-divider"' apps/web/components/issue/EditorialSection.tsx && grep -q "drop-cap" apps/web/components/issue/EditorialSection.tsx && grep -q "prose-measure" apps/web/components/issue/EditorialSection.tsx</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "lead?: boolean" apps/web/components/issue/EditorialSection.tsx
    - grep -q "lead = false" apps/web/components/issue/EditorialSection.tsx
    - grep -q "prose-measure" apps/web/components/issue/EditorialSection.tsx
    - grep -q "ornament-divider" apps/web/components/issue/EditorialSection.tsx
    - grep -q "eyebrow" apps/web/components/issue/EditorialSection.tsx
    - grep -q "drop-cap" apps/web/components/issue/EditorialSection.tsx
    - grep -c "color:var(--color-primary)" apps/web/components/issue/EditorialSection.tsx returns ≥1 (theme variable consumption preserved)
    - grep -c "tracking-\[0.1em\]" apps/web/components/issue/EditorialSection.tsx returns 0 (old inline letter-spacing replaced by .eyebrow utility)
    - grep -c "AnchorCopyButton" apps/web/components/issue/EditorialSection.tsx returns ≥1 (WEB-16 not regressed)
  </acceptance_criteria>
  <done>
    EditorialSection consumes .prose-measure, .ornament-divider, .eyebrow utilities;
    accepts a lead prop that adds .drop-cap to the PortableTextRenderer wrapper.
    AnchorCopyButton retained.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Refactor CaseStudySection to use a .metadata-block sidebar for structured fields</name>
  <files>apps/web/components/issue/CaseStudySection.tsx</files>
  <read_first>
    - apps/web/components/issue/CaseStudySection.tsx (the file being modified — confirm the current structure: divider, label, subjectName line, h2 headline, PortableTextRenderer body)
    - apps/web/app/globals.css (confirm .metadata-block utility exists with dt/dd styling)
    - apps/web/lib/sanity/queries.ts (confirm what fields are available on caseStudy — only subjectName, headline, body per QUERY_ISSUE_BY_SLUG §1.2)
  </read_first>
  <action>
Refactor apps/web/components/issue/CaseStudySection.tsx with these EXACT changes.

1. Replace the section className from
   `mx-auto w-full max-w-[680px] px-4 sm:px-6 lg:px-8`
   to
   `prose-measure`.

2. Replace the top divider div (the `<div className="mb-8 h-px ..." />`) with:
   `<div className="ornament-divider" aria-hidden="true" />`.

3. Replace the inline label span with the `.eyebrow` utility:
   ```tsx
   <div className="mb-4 flex items-center gap-2">
     <span className="eyebrow">CASE STUDY</span>
     <AnchorCopyButton sectionId="case-study" />
   </div>
   ```

4. Replace the inline-utility h2 headline with the same editorial display style as
   EditorialSection Task 1:
   ```tsx
   <h2 className="mt-3 mb-6 font-display text-[32px] font-semibold leading-[1.1] tracking-[-0.005em] text-[color:var(--color-primary)] sm:text-[44px]">
     {headline ?? 'Untitled Section'}
   </h2>
   ```

5. Replace the current `<p>` for "Subject: {subjectName}" with a `.metadata-block <dl>`
   panel rendered ONLY when `subjectName` is non-null. This is the case-study
   footnote-style metadata treatment (DES-05):
   ```tsx
   {subjectName != null && (
     <dl className="metadata-block" aria-label="Case study metadata">
       <dt>Subject</dt>
       <dd>{subjectName}</dd>
     </dl>
   )}
   ```
   The .metadata-block utility from Plan 10-01 supplies: smaller type, monospace tabular
   numerals, accent-colored left border, dt small-caps label styling.

6. KEEP the PortableTextRenderer call for the body and the bottom breathing-room div.

7. Update the JSDoc header to add: `* Phase 10: structured metadata (subject) renders
   in a .metadata-block dl panel — footnote-style sidebar visually distinct from
   running prose. DES-05.`

Constraints:
- The GROQ query (queries.ts §1.2 caseStudy projection) only returns
  `subjectName, headline, body` — no other structured fields exist for case study
  at this point. The .metadata-block dl renders only subjectName. If/when Sanity
  schema grows additional fields (founded/AUM/focus per DES-05 example list), they
  slot into this dl trivially. Document this in the SUMMARY.
  </action>
  <verify>
    <automated>grep -q 'className="metadata-block"' apps/web/components/issue/CaseStudySection.tsx && grep -q 'className="ornament-divider"' apps/web/components/issue/CaseStudySection.tsx && grep -q 'className="eyebrow"' apps/web/components/issue/CaseStudySection.tsx && grep -q "prose-measure" apps/web/components/issue/CaseStudySection.tsx</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "metadata-block" apps/web/components/issue/CaseStudySection.tsx
    - grep -q "ornament-divider" apps/web/components/issue/CaseStudySection.tsx
    - grep -q "eyebrow" apps/web/components/issue/CaseStudySection.tsx
    - grep -q "prose-measure" apps/web/components/issue/CaseStudySection.tsx
    - grep -q "<dl" apps/web/components/issue/CaseStudySection.tsx
    - grep -q "<dt>" apps/web/components/issue/CaseStudySection.tsx
    - grep -q "<dd>" apps/web/components/issue/CaseStudySection.tsx
    - grep -c "AnchorCopyButton" apps/web/components/issue/CaseStudySection.tsx returns ≥1
    - grep -c "color:var(--color-primary)" apps/web/components/issue/CaseStudySection.tsx returns ≥1
  </acceptance_criteria>
  <done>
    CaseStudySection renders subjectName in a .metadata-block dl panel, consumes
    the Phase 10 utility classes, retains AnchorCopyButton.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Refactor IssueHero into a masthead-style charity header</name>
  <files>apps/web/components/issue/IssueHero.tsx</files>
  <read_first>
    - apps/web/components/issue/IssueHero.tsx (the file being modified — confirm current structure: issue label, h1 charity name, metadata row, mission statement, PDF link)
    - apps/web/app/globals.css (confirm .eyebrow utility for the "Issue {N} — {Date}" line)
    - apps/web/lib/site.ts (confirm SITE_AUTHOR — referenced in JSON-LD, not in the byline visible text)
  </read_first>
  <action>
Refactor apps/web/components/issue/IssueHero.tsx into a masthead-style charity header
with these EXACT changes.

1. Replace the header className from
   `mx-auto w-full max-w-[860px] px-4 pb-8 pt-12 sm:px-6 lg:px-8`
   to
   `prose-measure pt-16 pb-10 sm:pt-20`.
   Rationale: a magazine masthead breathes. Bigger top margin (64/80px), keep
   .prose-measure for column consistency with the editorial body below.

2. Replace the existing "Issue {N} — {Date}" line:
   ```tsx
   <p className="mb-4 font-ui text-[14px] leading-[1.5] text-[color:var(--color-text)] opacity-60">
     {issueLabel}
   </p>
   ```
   with:
   ```tsx
   <p className="eyebrow mb-6 block">
     {issueLabel}
   </p>
   ```
   The .eyebrow utility supplies size/casing/letter-spacing. `block` overrides the
   utility's inline-block default so it occupies its own line.

3. Replace the h1 charity name's inline-utility chain with a larger editorial display:
   ```tsx
   <h1 className="mb-6 font-display text-[44px] font-semibold leading-[1.05] tracking-[-0.01em] text-[color:var(--color-primary)] sm:text-[64px]">
     {charity.name}
   </h1>
   ```
   Rationale: 44/64 (mobile/desktop) — bigger than Phase 2's 28/36, matching a masthead.

4. Add an italic byline line BELOW the h1, ABOVE the metadata row:
   ```tsx
   <p className="mb-6 font-body text-[16px] italic leading-[1.55] text-[color:var(--color-text)] opacity-75">
     by Jesse A. Eisenbalm
   </p>
   ```
   This is the masthead byline (full name, italic, body serif). Hardcoded — the brand
   voice contract is fixed; this is not a templatable string.

5. KEEP the metadata row (focus area / location / Est. year / reading time) but
   replace the inline font-ui classes with the .eyebrow utility on each span. The row
   itself stays a flex container:
   ```tsx
   <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1">
     {charity.focusArea && <span className="eyebrow">{charity.focusArea}</span>}
     <span className="eyebrow">{charity.location}</span>
     {charity.foundingYear != null && <span className="eyebrow">Est. {charity.foundingYear}</span>}
     {readingTimeMinutes > 0 && (
       <span className="eyebrow ml-auto">{readingTimeMinutes} min read</span>
     )}
   </div>
   ```

6. KEEP the mission statement <p> but raise it to lede-style treatment (larger body
   text, 3-line clamp preserved):
   ```tsx
   {charity.missionStatement && (
     <p
       className="mb-8 font-body text-[20px] leading-[1.55] text-[color:var(--color-text)] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:3] overflow-hidden"
       aria-label={`Mission: ${charity.missionStatement}`}
     >
       {charity.missionStatement}
     </p>
   )}
   ```

7. KEEP the conditional PDF download link verbatim — its current styling is fine.

8. Update the JSDoc header to add: `* Phase 10: masthead treatment — larger charity
   name (44/64), italic byline, .eyebrow utility for issue label and metadata row,
   .prose-measure for column consistency. DES-01.`

Constraints:
- The h1 element MUST remain the charity name (WEB-10 JSON-LD pairs with it).
- formatPublishDate helper unchanged.
- All color references via existing CSS variables — per-issue theme injection still works.
- No <link>/<script>/font imports added.
  </action>
  <verify>
    <automated>grep -q 'className="eyebrow' apps/web/components/issue/IssueHero.tsx && grep -q "prose-measure" apps/web/components/issue/IssueHero.tsx && grep -q "by Jesse A. Eisenbalm" apps/web/components/issue/IssueHero.tsx && grep -q "text-\[44px\]" apps/web/components/issue/IssueHero.tsx</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "prose-measure" apps/web/components/issue/IssueHero.tsx
    - grep -q "by Jesse A. Eisenbalm" apps/web/components/issue/IssueHero.tsx
    - grep -q "text-\[44px\]" apps/web/components/issue/IssueHero.tsx
    - grep -q "sm:text-\[64px\]" apps/web/components/issue/IssueHero.tsx
    - grep -c '"eyebrow' apps/web/components/issue/IssueHero.tsx returns ≥3 (issue label + ≥2 metadata spans)
    - grep -c "<h1" apps/web/components/issue/IssueHero.tsx returns 1 (still exactly one h1 — the charity name; WEB-10 not regressed)
    - grep -c "charity.name" apps/web/components/issue/IssueHero.tsx returns ≥1
    - grep -c "color:var(--color-primary)" apps/web/components/issue/IssueHero.tsx returns ≥1
  </acceptance_criteria>
  <done>
    IssueHero renders a masthead-style header with .eyebrow-styled issue label,
    larger charity name (44/64), italic byline, and .eyebrow metadata row.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Tune PortableTextRenderer body prose for editorial measure + line-height</name>
  <files>apps/web/components/issue/PortableTextRenderer.tsx</files>
  <read_first>
    - apps/web/components/issue/PortableTextRenderer.tsx (the file being modified — confirm it already accepts a className prop on the wrapper div, the block.normal renders a <p>, and the marks.strong/em are present)
    - apps/web/app/globals.css (confirm html { line-height: 1.65 } and .drop-cap > p:first-of-type::first-letter selector — the rendered <p> must be a DIRECT child of the wrapper div for the drop cap to apply)
  </read_first>
  <action>
Tune apps/web/components/issue/PortableTextRenderer.tsx for the editorial body
treatment. The file already accepts a className prop and already renders block.normal
as a <p>, so the .drop-cap selector works as-is. Specific edits:

1. Bump the block.normal `<p>` className from `leading-[1.65]` to `leading-[1.7]`
   AND add `text-[19px]` (up from `text-[18px]`). This widens the body register
   so the editorial prose has more presence. The full p className becomes:
   `mb-5 font-body text-[19px] leading-[1.7] text-[color:var(--color-text)] last:mb-0`
   (also bumped mb-4 to mb-5 for 20px paragraph spacing instead of 16px — consistent
   vertical rhythm.) DES-03.

2. Update the block.h2 className. Old: `mb-3 mt-8 font-display text-[22px] font-semibold leading-[1.25] text-[color:var(--color-primary)]`.
   New: `mb-4 mt-10 font-display text-[26px] font-semibold leading-[1.2] text-[color:var(--color-primary)]`.
   Rationale: in-prose h2 needs more breathing room and slightly larger size to read
   as a section break within a section.

3. Update the block.h3 className. Old: `mb-2 mt-6 font-display text-[18px] font-semibold leading-[1.25] text-[color:var(--color-primary)]`.
   New: `mb-3 mt-8 font-display text-[20px] font-semibold leading-[1.3] text-[color:var(--color-primary)]`.

4. Update the blockquote className to widen the spacing and italicize for editorial
   restraint. Old: `my-6 border-l-2 border-[color:var(--color-border)] pl-4 font-body text-[18px] italic leading-[1.65] text-[color:var(--color-text)]`.
   New: `my-8 border-l-2 border-[color:var(--color-accent)] pl-6 font-body text-[20px] italic leading-[1.55] text-[color:var(--color-text)] opacity-90`.
   Note border now uses --color-accent (was --color-border) — pulls the per-issue accent into the blockquote treatment (DES-06).

5. Update bullet list <ul> className. Old: `mb-4 list-disc pl-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]`.
   New: `mb-5 list-disc pl-6 font-body text-[19px] leading-[1.7] text-[color:var(--color-text)]`.

6. Update number list <ol> className. Old: `mb-4 list-decimal pl-6 font-body text-[18px] leading-[1.65] text-[color:var(--color-text)]`.
   New: `mb-5 list-decimal pl-6 font-body text-[19px] leading-[1.7] text-[color:var(--color-text)]`.

7. Leave list items, marks.strong/em/link UNCHANGED.

8. Update the wrapper return so the className prop is merged onto the wrapper div
   (already supported — verify the current `<div className={className}>` line and
   keep it). If the wrapper is currently always rendered, leave it. The .drop-cap
   class will arrive via this className prop from EditorialSection Task 1.

9. Update the JSDoc header to add: `* Phase 10: body type up to 19px / 1.7
   line-height; blockquote uses --color-accent border-left. The component already
   accepts className on the wrapper div, which EditorialSection passes 'drop-cap'
   to for the lead section. DES-03, DES-06.`

Constraints:
- Do NOT change the marks (strong/em/link) — Phase 2 contract.
- Do NOT change the import of @portabletext/react.
- Do NOT change the wrapper-div pattern; the .drop-cap selector depends on
  `.drop-cap > p:first-of-type` matching the wrapper's first direct-child <p>.
- All color references use existing CSS variables.
  </action>
  <verify>
    <automated>grep -q "text-\[19px\]" apps/web/components/issue/PortableTextRenderer.tsx && grep -q "leading-\[1.7\]" apps/web/components/issue/PortableTextRenderer.tsx && grep -q "border-\[color:var(--color-accent)\]" apps/web/components/issue/PortableTextRenderer.tsx</automated>
  </verify>
  <acceptance_criteria>
    - grep -q "text-\[19px\]" apps/web/components/issue/PortableTextRenderer.tsx
    - grep -q "leading-\[1.7\]" apps/web/components/issue/PortableTextRenderer.tsx
    - grep -q "text-\[26px\]" apps/web/components/issue/PortableTextRenderer.tsx (h2 bump)
    - grep -q "border-\[color:var(--color-accent)\]" apps/web/components/issue/PortableTextRenderer.tsx (blockquote accent)
    - grep -c "PortableText" apps/web/components/issue/PortableTextRenderer.tsx returns ≥2 (import + usage preserved)
    - grep -c "marks:" apps/web/components/issue/PortableTextRenderer.tsx returns ≥1 (marks dict preserved)
    - grep -c "color:var(--color-text)" apps/web/components/issue/PortableTextRenderer.tsx returns ≥3 (theme variable consumption preserved across p/blockquote/lists)
  </acceptance_criteria>
  <done>
    PortableTextRenderer body p is 19px / 1.7 line-height; h2/h3 in-prose sizes
    bumped; blockquote uses --color-accent. Wrapper className still accepted so
    EditorialSection can pass .drop-cap through.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 5: Wire lead prop onto Origin Story in page.tsx; verify locked components untouched</name>
  <files>apps/web/app/issue/[slug]/page.tsx</files>
  <read_first>
    - apps/web/app/issue/[slug]/page.tsx (the file being modified — confirm it is a Server Component, the EditorialSection for Origin Story is the FIRST editorial body section, and ShopCallout + GameSlot are imported and rendered)
    - apps/web/components/issue/EditorialSection.tsx (after Task 1 — confirm lead?: boolean prop exists in the interface so the wiring compiles)
    - apps/web/components/issue/ShopCallout.tsx (read-only — confirm we are NOT modifying this file; the JSX call site must remain `<ShopCallout />`)
    - apps/web/components/issue/GameSlot.tsx (read-only — confirm we are NOT modifying this file; the JSX call site must remain `<GameSlot game={issue.game} runId={issue.runId ?? null} />`)
  </read_first>
  <action>
Edit apps/web/app/issue/[slug]/page.tsx with these EXACT minimal changes.

1. Find the first EditorialSection call site — the Origin Story:
   ```tsx
   <EditorialSection
     id="origin-story"
     label="ORIGIN STORY"
     headline={issue.originStory?.headline}
     body={issue.originStory?.body}
   />
   ```
   Add `lead` as the last prop (before the closing tag):
   ```tsx
   <EditorialSection
     id="origin-story"
     label="ORIGIN STORY"
     headline={issue.originStory?.headline}
     body={issue.originStory?.body}
     lead
   />
   ```
   This is the ONLY EditorialSection that gets the drop cap. DES-02.

2. Do NOT add `lead` to "THE PROBLEM" or "FOUNDER BIO" EditorialSection calls — only
   the first prose section gets the drop cap.

3. Do NOT modify the `<ShopCallout />` call site. Verify it still appears verbatim:
   `<ShopCallout />` (Phase 2 + CMR-09 contract).

4. Do NOT modify the `<GameSlot game={issue.game} runId={issue.runId ?? null} />`
   call site. Verify it still appears verbatim (Phase 7 contract).

5. Do NOT add `'use client'` directive at the top of page.tsx. The page MUST remain
   a Server Component. The drop cap is implemented via pure CSS in globals.css —
   no client-side hydration needed.

6. KEEP everything else — generateMetadata, generateStaticParams, JsonLd, ISR
   revalidate, reading-time call, all other section render calls.

7. Optional polish: between the BonusSection and DeliberationSlot, add a single
   `<div className="ornament-divider mx-auto max-w-[68ch]" aria-hidden="true" />` if
   you observe in Read that those sections currently lack an internal divider.
   This is a JUDGMENT CALL — only add it if the current page reads as flat between
   bonus → deliberation. If unsure, leave it out and document the decision in the SUMMARY.
  </action>
  <verify>
    <automated>grep -q 'id="origin-story"' apps/web/app/issue/[slug]/page.tsx && perl -0777 -ne 'exit !/id="origin-story"[^/]*lead/s' apps/web/app/issue/[slug]/page.tsx && grep -q '<ShopCallout />' apps/web/app/issue/[slug]/page.tsx && ! head -1 apps/web/app/issue/[slug]/page.tsx | grep -q "use client"</automated>
  </verify>
  <acceptance_criteria>
    - grep -q 'id="origin-story"' apps/web/app/issue/\[slug\]/page.tsx
    - perl -0777 -ne 'exit !/id="origin-story"[^/]*lead/s' apps/web/app/issue/\[slug\]/page.tsx exits 0 (the Origin Story EditorialSection has the lead prop)
    - grep -c 'lead\b' apps/web/app/issue/\[slug\]/page.tsx returns exactly 1 (only Origin Story is the lead — DES-02 single drop cap)
    - grep -c '<ShopCallout' apps/web/app/issue/\[slug\]/page.tsx returns ≥1 (CMR-09 + Phase 2 contract preserved)
    - grep -c '<GameSlot' apps/web/app/issue/\[slug\]/page.tsx returns ≥1 (Phase 7 contract preserved)
    - ! head -3 apps/web/app/issue/\[slug\]/page.tsx | grep -q "use client" (page remains a Server Component)
    - pnpm --filter web build exits 0
    - pnpm --filter web test:unit exits 0 (Phase 7 + Phase 2 + Phase 8 tests unchanged: game-sandbox source-scan, issue-page-shop-callout CMR-09, etc. still pass)
  </acceptance_criteria>
  <done>
    Origin Story EditorialSection has `lead` prop applied; ShopCallout and GameSlot
    call sites verified unchanged; page remains Server Component; build + unit tests
    still pass.
  </done>
</task>

</tasks>

<verification>
- pnpm --filter web build exits 0
- pnpm --filter web test:unit exits 0 — these pre-existing tests MUST still pass:
  - __tests__/game-sandbox.test.ts (Phase 7 GAM-03 source-scan tripwire)
  - __tests__/game-validator.test.ts (Phase 7)
  - __tests__/issue-page-shop-callout.test.ts (Phase 8 CMR-09 — confirms ShopCallout is still imported + rendered + has no banner/modal/popup/countdown patterns)
  - all other Phase 8 stubs that were passing pre-Phase 10
- grep -r "fonts.googleapis.com" apps/web returns 0 hits
- grep -r 'sandbox="allow-scripts"' apps/web/components/issue/GameSlot.tsx returns ≥1 hit (Phase 7 contract intact)
- The ShopCallout.tsx file content is byte-identical to its pre-Phase-10 state (best verified by `git diff apps/web/components/issue/ShopCallout.tsx` showing no changes)
</verification>

<success_criteria>
- EditorialSection consumes .prose-measure, .eyebrow, .ornament-divider; accepts a lead prop that passes .drop-cap onto PortableTextRenderer's wrapper
- CaseStudySection renders subjectName in a .metadata-block dl panel
- IssueHero renders as a masthead with .eyebrow issue label, 44/64 charity name, italic byline
- PortableTextRenderer body is 19px / 1.7 line-height; blockquote uses --color-accent border
- Origin Story in page.tsx has `lead` prop; no other section does
- ShopCallout.tsx and GameSlot.tsx are byte-unchanged
- Issue page remains a Server Component
- pnpm --filter web build + test:unit both still pass
</success_criteria>

<output>
After completion, create `.planning/phases/10-editorial-design-pass/10-02-issue-page-redesign-SUMMARY.md`
recording: which files were edited (and the file count), confirmation ShopCallout.tsx
and GameSlot.tsx were NOT edited, decision on the optional bonus→deliberation
ornament divider (Task 5 step 7), and confirmation that pnpm --filter web test:unit
still exits 0 with the existing Phase 7 / Phase 8 tests passing.
</output>
