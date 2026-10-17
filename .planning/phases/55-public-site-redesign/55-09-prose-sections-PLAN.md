---
phase: 55-public-site-redesign
plan: 09
type: execute
wave: 2
depends_on: [55-01, 55-02, 55-03]
files_modified:
  - apps/web/components/dispatch/PullQuote.tsx
  - apps/web/components/dispatch/sections/OriginSection.tsx
  - apps/web/components/dispatch/sections/ProblemSection.tsx
  - apps/web/components/dispatch/sections/FounderSection.tsx
  - apps/web/components/dispatch/sections/CaseSection.tsx
  - apps/web/components/dispatch/sections.css
  - apps/web/__tests__/prose-sections.test.tsx
autonomous: true
requirements: [P55-SC1, P55-SC2, P55-SC6, PUB-05, PUB-11]

must_haves:
  truths:
    - "Sections 01-04 render as numbered colour blocks (white / blue / yellow / white+red) with the pipeline's real headlines and body text in multi-column prose that collapses to one column at 375px"
    - "The problem section shows up to three stat tiles parsed from keyDataPoints; long figures fall back to a sentence instead of overflowing"
    - "Pull quotes and the case timeline appear only when Andrew authored them; otherwise those blocks are omitted"
    - "Each section always exists with its fixed id so the sticky nav anchors resolve, even on a sparse issue"
  artifacts:
    - path: "apps/web/components/dispatch/sections/ProblemSection.tsx"
      provides: "#problem blue band with stat tiles + prose + PDF link"
      exports: ["ProblemSection"]
    - path: "apps/web/components/dispatch/sections/CaseSection.tsx"
      provides: "#case with timeline + prose + pull quote"
      exports: ["CaseSection"]
    - path: "apps/web/components/dispatch/sections/OriginSection.tsx"
      exports: ["OriginSection"]
    - path: "apps/web/components/dispatch/sections/FounderSection.tsx"
      exports: ["FounderSection"]
    - path: "apps/web/components/dispatch/PullQuote.tsx"
      exports: ["PullQuote"]
  key_links:
    - from: "apps/web/components/dispatch/sections/*.tsx"
      to: "apps/web/components/dispatch/NumberedSection.tsx"
      via: "wrapper with fixed id/number/label"
      pattern: "<NumberedSection"
    - from: "apps/web/components/dispatch/sections/*.tsx"
      to: "apps/web/components/issue/PortableTextRenderer.tsx"
      via: "body rendering inside .d-prose"
      pattern: "PortableTextRenderer"
---

<objective>
Build the four editorial colour-block sections (01 Origin, 02 Problem, 03 Founder, 04 Case) plus the PullQuote primitive, reusing PortableTextRenderer for bodies.

Purpose: SC-1 (eight numbered sections — first four), SC-2 (only real/authored copy, absent blocks omitted).
Output: 5 components, sections.css, 1 jsdom test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/55-public-site-redesign/55-UI-SPEC.md
@apps/web/app/dispatch.css
@apps/web/components/dispatch/NumberedSection.tsx
@apps/web/components/issue/PortableTextRenderer.tsx
@apps/web/components/issue/EditorialSection.tsx

<interfaces>
```typescript
// NumberedSection({ id, number, label, title?, compact?, className?, children })
// copy.ts: sectionMeta(id) -> { number, label, ... }
// derive.ts: type StatTile = { figure: string | null; caption: string; source: string | null }; FrontPageRow = { label: string; value: string }
// PortableTextRenderer({ value, className? })  — legacy colours neutralised inside .dispatch by dispatch.css
```
Created (Plan 11 composes):
```typescript
export function PullQuote(p: { text: string; tone: 'green' | 'red' }): JSX.Element
export function OriginSection(p: { headline: string | null | undefined; body: PortableTextBlock[] | null | undefined; pullQuote: string | null }): JSX.Element
export function ProblemSection(p: { headline: string | null | undefined; body: PortableTextBlock[] | null | undefined; tiles: StatTile[]; pdfUrl: string | null }): JSX.Element
export function FounderSection(p: { headline: string | null | undefined; body: PortableTextBlock[] | null | undefined }): JSX.Element
export function CaseSection(p: { headline: string | null | undefined; subjectName: string | null | undefined; body: PortableTextBlock[] | null | undefined; timeline: FrontPageRow[]; pullQuote: string | null }): JSX.Element
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: PullQuote + Origin + Founder sections</name>
  <files>apps/web/components/dispatch/PullQuote.tsx, apps/web/components/dispatch/sections/OriginSection.tsx, apps/web/components/dispatch/sections/FounderSection.tsx, apps/web/components/dispatch/sections.css, apps/web/__tests__/prose-sections.test.tsx</files>
  <read_first>
    - apps/web/components/dispatch/NumberedSection.tsx and apps/web/app/dispatch.css (.d-prose, .d-sec--origin, .d-sec--founder)
    - apps/web/components/issue/PortableTextRenderer.tsx
    - apps/web/__tests__/fixtures/issue.ts
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Page Structure" item 7 (01, 03) and Typography "Pull quotes"
  </read_first>
  <behavior>
    - OriginSection(fullIssue data): `section#origin.d-sec--origin`, disc '01', eyebrow 'How it started', h2 = headline, body paragraphs inside `.d-prose`, blockquote with the pull quote text
    - OriginSection with headline null, body null, pullQuote null: still renders `section#origin` with exactly one h2 (the label) and no blockquote and no `.d-prose`
    - FounderSection: `section#founder.d-sec--founder`, disc '03', `.d-founder-cols` wrapper containing the h2 column and the prose column
    - PullQuote renders `<blockquote class="d-pullquote">` with an inner span `.d-pullquote-mark--{tone}`
  </behavior>
  <action>
    1. PullQuote.tsx: `<blockquote className="d-pullquote"><p className="d-heading d-pullquote-text"><span className={`d-pullquote-mark d-pullquote-mark--${tone}`}>{text}</span></p></blockquote>`.
    2. OriginSection.tsx: `const m = sectionMeta('origin')`; `<NumberedSection id="origin" number={m.number} label={m.label} title={headline}>{body?.length ? <PortableTextRenderer value={body} className="d-prose" /> : null}{pullQuote && <PullQuote text={pullQuote} tone="green" />}</NumberedSection>`.
    3. FounderSection.tsx: NumberedSection id founder WITHOUT title prop (label becomes the h2 eyebrow) and render inside: `<div className="d-founder-cols"><p className="d-heading d-founder-title">{headline}</p>{body?.length ? <PortableTextRenderer value={body} className="d-founder-body" /> : null}</div>` only when headline or body exists. Rationale: UI-SPEC two-column "h2 left, prose right" — use NumberedSection with `title={headline}` instead if you can place the h2 in the left column; choose ONE approach and ensure exactly one h2 in the section (test enforces).
    4. sections.css (vars only; import from each section file with `import '../sections.css'` / `import './sections.css'`): `.d-pullquote{margin:48px 0 0;padding:0;border:0} .d-pullquote-text{font-weight:400;max-width:24ch} .d-pullquote-mark{box-decoration-break:clone;-webkit-box-decoration-break:clone;padding:0 8px} .d-pullquote-mark--green{background:var(--d-green);color:var(--d-ink)} .d-pullquote-mark--red{background:var(--d-red);color:var(--d-ink)} .d-founder-cols{display:flex;flex-wrap:wrap;gap:48px} .d-founder-cols > *{flex:1 1 min(100%, 420px);min-width:0} .d-sec-title{margin-bottom:24px}`.
    5. prose-sections.test.tsx (jsdom) — Origin/Founder/PullQuote behaviours using fixtures.
  </action>
  <verify>
    <automated>pnpm --filter web test -- prose-sections dispatch-css-responsive dispatch-a11y dispatch-voice brand-tokens && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Command above exits 0
    - `grep -n "<NumberedSection" apps/web/components/dispatch/sections/OriginSection.tsx apps/web/components/dispatch/sections/FounderSection.tsx` matches in both
    - `grep -n "box-decoration-break:clone" apps/web/components/dispatch/sections.css` matches
    - `grep -cE "#[0-9a-fA-F]{6}" apps/web/components/dispatch/sections.css` returns 0
  </acceptance_criteria>
  <done>Origin, Founder and PullQuote render real content and degrade by omission.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Problem (stat tiles) + Case (timeline) sections</name>
  <files>apps/web/components/dispatch/sections/ProblemSection.tsx, apps/web/components/dispatch/sections/CaseSection.tsx, apps/web/components/dispatch/sections.css, apps/web/__tests__/prose-sections.test.tsx</files>
  <read_first>
    - apps/web/components/issue/EditorialSection.tsx L85–115 (existing PDF link: href pdfUrl, aria-label 'Download the Problem Statement Deck as PDF', text '↓  Download the Problem Statement Deck (PDF)' — reuse that copy verbatim)
    - apps/web/components/issue/CaseStudySection.tsx (subjectName treatment)
    - apps/web/lib/dispatch/derive.ts (statTiles, caseTimeline output shapes)
    - .planning/phases/55-public-site-redesign/55-UI-SPEC.md §"Page Structure" item 7 (02, 04) and colour map rows 02/04 (stat numeral colours: tile 2 yellow, large text only)
  </read_first>
  <behavior>
    - ProblemSection with 3 tiles: `section#problem.d-sec--problem`, disc '02'; `.d-stats` grid with 3 `.d-stat`; a tile with figure shows `.d-stat-figure` (Heading tier) + caption; a tile with figure null shows only the caption sentence; PDF link present only when pdfUrl non-null, with the existing aria-label
    - ProblemSection with tiles [] renders no `.d-stats`
    - CaseSection with 4 timeline rows: `section#case.d-sec--case`, disc '04', `ol.d-timeline` of 4 `li`, the last having class `d-timeline-step--result`; pull quote with tone red; subjectName shown as a label line when present
    - CaseSection with timeline [] and pullQuote null: no `ol`, no blockquote
    - Long-word fixture headline renders inside `.d-heading` (overflow-wrap rule applies; no inline width styles)
  </behavior>
  <action>
    1. ProblemSection.tsx: NumberedSection id problem title=headline; then `{tiles.length > 0 && <div className="d-stats">{tiles.map((t, i) => <div key={i} className="d-stat">{t.figure ? <><p className="d-heading d-stat-figure">{t.figure}</p><p className="d-body d-stat-caption">{t.caption}</p></> : <p className="d-body d-stat-caption d-stat-caption--solo">{t.caption}</p>}</div>)}</div>}`; prose `.d-prose`; `{pdfUrl && <a href={pdfUrl} className="d-pill d-pill--paper d-pill--compact d-problem-pdf" aria-label="Download the Problem Statement Deck as PDF">↓ Download the Problem Statement Deck (PDF)</a>}`.
    2. CaseSection.tsx: NumberedSection id case title=headline; `{subjectName && <p className="d-label d-case-subject">{subjectName}</p>}`; `{timeline.length > 0 && <ol className="d-timeline">{timeline.map((s, i) => <li key={i} className={i === timeline.length - 1 ? 'd-timeline-step d-timeline-step--result' : 'd-timeline-step'}><p className="d-label">{s.label}</p><p className="d-timeline-value">{s.value}</p></li>)}</ol>}`; prose; `{pullQuote && <PullQuote text={pullQuote} tone="red" />}`.
    3. Append to sections.css: `.d-stats{display:grid;grid-template-columns:repeat(auto-fit, minmax(min(100%, 240px), 1fr));gap:24px;margin-bottom:48px} .d-stat{border-top:3px solid currentColor;padding-top:16px} .d-stat p{margin:0} .d-stat-caption{line-height:1.45;margin-top:8px} .d-stat:nth-child(2) .d-stat-figure{color:var(--d-yellow)} .d-stat:nth-child(4) .d-stat-figure{color:var(--d-green)} .d-problem-pdf{margin-top:24px;border-color:var(--d-paper)} .d-timeline{display:flex;flex-wrap:wrap;gap:0;list-style:none;margin:0 0 48px;padding:0} .d-timeline-step{flex:1 1 min(100%, 220px);border:2px solid var(--d-ink);padding:16px;margin:0 -2px -2px 0} .d-timeline-step p{margin:0} .d-timeline-value{font-size:18px;font-weight:800;line-height:1.35;margin-top:8px;overflow-wrap:anywhere} .d-timeline-step--result{background:var(--d-red);color:var(--d-ink)} .d-case-subject{margin:0 0 24px}`. (.d-stat-figure inherits Heading clamp min 28px/800 — satisfies the large-text exception for yellow/green on blue.)
    4. Extend prose-sections.test.tsx with these behaviours.
  </action>
  <verify>
    <automated>pnpm --filter web test -- prose-sections dispatch-css-responsive dispatch-a11y dispatch-voice brand-tokens && pnpm --filter web typecheck</automated>
  </verify>
  <acceptance_criteria>
    - Command above exits 0
    - `grep -n "d-timeline-step--result" apps/web/components/dispatch/sections/CaseSection.tsx` matches
    - `grep -n "Download the Problem Statement Deck as PDF" apps/web/components/dispatch/sections/ProblemSection.tsx` matches
    - `grep -n "minmax(min(100%, 240px), 1fr)" apps/web/components/dispatch/sections.css` matches
    - `grep -c "style={{" apps/web/components/dispatch/sections/*.tsx` totals 0
  </acceptance_criteria>
  <done>Problem and Case sections render tiles/timeline from real data with tested fallbacks.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test` full suite green; `pnpm --filter web typecheck` clean
</verification>

<success_criteria>
Sections 01–04 built per colour map; absent data omitted; tests green.
</success_criteria>

<output>
After completion, create `.planning/phases/55-public-site-redesign/55-09-SUMMARY.md`
</output>
