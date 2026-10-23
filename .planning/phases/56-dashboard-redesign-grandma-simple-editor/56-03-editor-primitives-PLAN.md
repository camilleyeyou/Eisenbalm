---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 03
type: execute
wave: 2
depends_on: [56-01, 56-02]
files_modified:
  - apps/dispatch-control/components/editor/NextStepSlab.tsx
  - apps/dispatch-control/components/editor/StatusWord.tsx
  - apps/dispatch-control/components/editor/Stations.tsx
  - apps/dispatch-control/components/editor/StepList.tsx
  - apps/dispatch-control/components/editor/PartsList.tsx
  - apps/dispatch-control/__tests__/NextStepSlab.test.tsx
  - apps/dispatch-control/__tests__/Stations.test.tsx
  - apps/dispatch-control/__tests__/StepList.test.tsx
  - apps/dispatch-control/__tests__/PartsList.test.tsx
autonomous: true
requirements: [P56-A1, P56-A3, P56-B1, P56-B2]

must_haves:
  truths:
    - "The 'Your next step' slab renders one sentence and at most one cobalt primary button (marked data-primary), or a ghost button, or a non-interactive Working indicator — never a disabled button"
    - "Status words always render as text with their shape; colour is never the only signal"
    - "The four-station checklist is four columns from 640px up and a vertical list below 640px, with aria-current='step' on the current station"
    - "Unwritten parts render as non-link rows; written parts are full-row links"
  artifacts:
    - path: "apps/dispatch-control/components/editor/NextStepSlab.tsx"
      provides: "Slab primitive"
      contains: "data-primary"
    - path: "apps/dispatch-control/components/editor/Stations.tsx"
      provides: "Four-station checklist"
      contains: "aria-current"
    - path: "apps/dispatch-control/components/editor/StepList.tsx"
      provides: "Behind step list (22px dots on a 2px line)"
    - path: "apps/dispatch-control/components/editor/PartsList.tsx"
      provides: "Nine-parts list with phone 2-line card"
    - path: "apps/dispatch-control/components/editor/StatusWord.tsx"
      provides: "Word + marker from STATUS_WORDS"
  key_links:
    - from: "apps/dispatch-control/components/editor/StatusWord.tsx"
      to: "apps/dispatch-control/lib/nomenclature.ts"
      via: "STATUS_WORDS lookup"
      pattern: "STATUS_WORDS"
    - from: "apps/dispatch-control/components/editor/Stations.tsx"
      to: "apps/dispatch-control/lib/editorState.ts"
      via: "StationVM props"
      pattern: "StationVM"
---

<objective>
Build the five presentational primitives every Phase 56 screen composes: NextStepSlab, StatusWord, Stations, StepList, PartsList. Props-only, no Convex, no Clerk.

Purpose: Locked decisions 1 (slab), 2 (stations), 3 (status words), 5 (no mono caps, 15–17px UI text). Screens in wave 3 must not restyle these themselves.
Output: 5 components + 4 component tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/canvas/Main.dc.html
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/canvas/Home-Writing.dc.html
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/canvas/Behind.dc.html
@apps/dispatch-control/lib/editorState.ts
@apps/dispatch-control/lib/nomenclature.ts

<interfaces>
From lib/editorState.ts (plan 56-01):
```typescript
export interface StationVM { name: 'Pick charity'|'Write'|'Check'|'Publish'; word: StatusWord; line: string; current: boolean; complete: boolean }
export interface StepVM { key: string; name: string; word: StatusWord; line: string; error?: string }
export function partRowStatus(row, ctx: { published: boolean }): { text: string; word: StatusWord; linked: boolean }
export const PART_LABELS: Record<string, string>
```
From lib/nomenclature.ts: `STATUS_WORDS: Record<StatusWord, { colorVar: string; bold: boolean; marker: 'check'|'ring'|'hollow'|'line'|'exclamation' }>`
From lib/homeSections.ts: `HomeSectionRow { id, label, headline, state, agentChanges, href }`
Tokens (plan 56-02): --color-done, --color-amber-text, --color-problem, --color-wash, --color-current, --color-line, --color-line-strong; utilities `.editor-focus`, `.editor-pulse`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: StatusWord + NextStepSlab</name>
  <files>apps/dispatch-control/components/editor/StatusWord.tsx, apps/dispatch-control/components/editor/NextStepSlab.tsx, apps/dispatch-control/__tests__/NextStepSlab.test.tsx</files>
  <read_first>
    - 56-UI-SPEC.md § "1. 'Your next step' slab", § "Status words", § "Responsive contract" slab bullet
    - canvas/Main.dc.html slab block (copy spacing, the cobalt button markup)
    - canvas/Home-Writing.dc.html Working indicator markup
  </read_first>
  <behavior>
    - slab with `primary` renders exactly one `button[data-primary]` (or `a[data-primary]` when `primary.href` given) with the label; clicking calls onClick once; `busy` → button stays enabled-looking but `aria-busy="true"` and ignores further clicks (non-idempotent publish latch)
    - slab with `working` renders text "Working" and NO button
    - slab with `ghost` renders a link (not data-primary) with the label/href
    - `error` renders inline text with role="alert"
    - `link` renders a cobalt text link under the button; `external: true` → target="_blank" rel="noopener noreferrer"
    - section has aria-labelledby pointing at the eyebrow "Your next step"
    - StatusWord renders the word text, and for 'Problem' an svg with aria-hidden
    - no rendered element uses `disabled`
  </behavior>
  <action>
`StatusWord.tsx`: `export default function StatusWord({ word, text, className }: { word: StatusWord; text?: string; className?: string })` → `<span className="inline-flex items-center gap-2 font-[family-name:var(--font-ui)] text-[15px]" style={{ color: \`var(${STATUS_WORDS[word].colorVar})\` }}>` + marker (8px dot: ring/check/exclamation/hollow/line drawn as small inline SVG, aria-hidden) + `<span className={bold ? 'font-semibold' : ''}>{text ?? word}</span>`. Export also `StatusMarker({ marker, size })` (sizes 22 and 30 used by StepList/Stations): check = filled disc + white check path `M6 12l4 4 8-8` stroke 3; ring = white disc 3px cobalt ring + 12px centre dot (Stations) / amber for StepList; hollow = 2px ring rgba(85,81,74,.3); exclamation = filled `--color-problem` disc with white `!` (copy path from canvas/Behind-Run.dc.html); line = 2px grey bar. Disc fill colour is a prop (`fill: 'cobalt' | 'status'`): Stations uses cobalt for check/ring; StepList uses the status colour.

`NextStepSlab.tsx` ('use client'):
```typescript
export interface NextStepSlabProps {
  sentence: string
  explanation?: string
  primary?: { label: string; onClick?: () => void; href?: string; busy?: boolean }
  working?: boolean
  ghost?: { label: string; href: string }
  link?: { label: string; href: string; external?: boolean }
  error?: string | null
  live?: string            // polite announcement text (aria-live="polite", visually hidden)
}
```
Markup per UI-SPEC: `section aria-labelledby={id}` (useId), `bg-[color:var(--color-card)] border-2 border-[color:var(--color-ink)] p-4 sm:p-8 flex flex-col sm:flex-row sm:flex-wrap gap-x-8 gap-y-6`; text block `sm:flex-[1_1_440px]`: eyebrow `p#id` "Your next step" 15px/600 ink-soft; sentence `p` Newsreader `text-[26px] leading-[1.2] sm:text-[32px] sm:leading-[1.15] font-medium`; explanation Lora 17px/1.55 ink-soft max-w-[620px]. Right side `flex flex-col items-stretch sm:items-end gap-2`: primary = `button data-primary` `min-h-[56px] w-full sm:w-auto px-8 bg-[color:var(--color-cobalt)] text-[color:var(--color-card)] font-[family-name:var(--font-ui)] text-[18px] font-semibold hover:brightness-[.92] editor-focus` (when `busy`: `aria-busy="true"`, onClick no-ops); working = `div` amber dot (`editor-pulse`, 12px circle `bg-[color:var(--color-amber-text)]`) + "Working" 17px/600 amber; ghost = Link `min-h-[48px] px-6 border border-[color:var(--color-ink)] bg-[color:var(--color-card)] text-[17px] font-semibold inline-flex items-center justify-center editor-focus`; link 15px cobalt, `min-h-[48px] inline-flex items-center justify-center`; error `p role="alert"` 15px/600 `text-[color:var(--color-problem)]`. Render at most one of primary/working/ghost (priority: primary > working > ghost). No `disabled` attribute anywhere.

Tests in `__tests__/NextStepSlab.test.tsx` (jsdom, `import { describe, it, expect, vi } from 'vitest'`) cover every behavior bullet, including `container.querySelectorAll('[data-primary]').length` = 1 / 0 and `container.querySelector('[disabled]')` null.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/NextStepSlab.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "data-primary" apps/dispatch-control/components/editor/NextStepSlab.tsx` >= 1
    - `grep -nE "font-mono|uppercase|tracking-|disabled|text-\[(9|10|11|12|13|14|16)px\]" apps/dispatch-control/components/editor/NextStepSlab.tsx apps/dispatch-control/components/editor/StatusWord.tsx` returns nothing
    - NextStepSlab.test.tsx passes
  </acceptance_criteria>
  <done>Slab and status word primitives exist; one-primary and never-disabled rules are tested.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Stations + StepList</name>
  <files>apps/dispatch-control/components/editor/Stations.tsx, apps/dispatch-control/components/editor/StepList.tsx, apps/dispatch-control/__tests__/Stations.test.tsx, apps/dispatch-control/__tests__/StepList.test.tsx</files>
  <read_first>
    - 56-UI-SPEC.md § "2. Four-station checklist", § "8. Behind the scenes" step bullet, § "Responsive contract" checklist + Behind bullets
    - canvas/Main.dc.html and canvas/Home-Writing.dc.html station markup (connector + marker)
    - canvas/Behind.dc.html step list markup (22px dot, 2px vertical line)
  </read_first>
  <behavior>
    - Stations renders `ol[aria-label="Progress on this issue"]` with 4 `li`, names in order, each status line text visible
    - the station with current=true has aria-current="step"; no other li has it
    - ol has classes `grid-cols-1` and `sm:grid-cols-4` (phone vertical list, 4 columns from 640px)
    - StepList renders an `ol` with one `li` per StepVM showing name (17px/600) and line; Problem step contains an svg marker; Done line text e.g. 'Done · 9:04' visible
    - StepList `footer` prop renders a final line (cost line)
  </behavior>
  <action>
`Stations.tsx`: `export default function Stations({ stations }: { stations: StationVM[] })`. `ol aria-label="Progress on this issue" className="grid grid-cols-1 sm:grid-cols-4"`. Each `li` (aria-current="step" when current): phone = `flex sm:flex-col items-start sm:items-center gap-4 min-h-[56px]` with marker left and a 2px vertical connector below it (`bg-[color:var(--color-cobalt)]` when `complete`, else transparent); sm+ = top row `connector(2px, flex-1) – 30px StatusMarker – connector`, connectors cobalt when that side is complete, transparent at outer ends and after the current station. Marker: complete → check cobalt; current → ring cobalt; else hollow. Text: name `text-[17px] font-semibold font-[family-name:var(--font-ui)]`, line `<StatusWord word={s.word} text={s.line} />` without its own dot (pass `hideMarker`; add that optional prop to StatusWord in Task 1's file only if needed — StatusWord.tsx is owned by this plan).

`StepList.tsx`: `export default function StepList({ steps, footer, label }: { steps: StepVM[]; footer?: string | null; label: string })` → `h2` (Newsreader 26/600) `{label}`, `ol` with `relative` 2px vertical line `bg-[color:var(--color-line-strong)]` at left-[10px]; each `li` `flex gap-4 py-2`: 22px StatusMarker (fill 'status') + name 17px/600 + `<StatusWord word text={line} hideMarker />`. Footer `p` Lora 17px ink-soft.

Tests: `__tests__/Stations.test.tsx`, `__tests__/StepList.test.tsx` per behavior list (fixtures typed as StationVM / StepVM).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/Stations.test.tsx __tests__/StepList.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n 'aria-label="Progress on this issue"' apps/dispatch-control/components/editor/Stations.tsx` matches
    - `grep -n "sm:grid-cols-4" apps/dispatch-control/components/editor/Stations.tsx` matches
    - `grep -nE "font-mono|uppercase|tracking-|text-\[(9|10|11|12|13|14|16)px\]" apps/dispatch-control/components/editor/Stations.tsx apps/dispatch-control/components/editor/StepList.tsx` returns nothing
    - both tests pass
  </acceptance_criteria>
  <done>Checklist and step list primitives render the six words with shapes, responsive classes present.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: PartsList (nine parts, phone 2-line card)</name>
  <files>apps/dispatch-control/components/editor/PartsList.tsx, apps/dispatch-control/__tests__/PartsList.test.tsx</files>
  <read_first>
    - 56-UI-SPEC.md § "4. The nine parts list" and § "Responsive contract" part-rows bullet
    - canvas/Main.dc.html parts list markup; canvas/Home-Writing.dc.html non-link rows
    - apps/dispatch-control/lib/homeSections.ts HomeSectionRow
  </read_first>
  <behavior>
    - 9 rows → 9 `li`; numbering 1..9 and labels from PART_LABELS (Origin story … Look)
    - clean row → `a[href=row.href]` containing headline and 'Written · 2 fixes by the writers'
    - writing row → no `a`, text 'Working'; not-written → no `a`, 'Not yet'
    - published=true → every clean row status 'Published'
    - h2 "The nine parts" plus the hint text
    - each row has `min-h-[64px]`
  </behavior>
  <action>
`export default function PartsList({ rows, published, hint, hrefFor }: { rows: HomeSectionRow[]; published: boolean; hint: string; hrefFor?: (row: HomeSectionRow) => string })`. Header row: `h2` Newsreader 26/600 "The nine parts" + `p` 15px ink-soft hint (right-aligned sm+). List: `ol` `bg-[color:var(--color-card)] border border-[color:var(--color-line-strong)]`, `li + li` top border `--color-line`. Row content via `partRowStatus(row, { published })`: when `linked`, full-row `Link href={hrefFor?.(row) ?? row.href}` with `hover:bg-[color:var(--color-wash)] editor-focus`; else `div`. Row layout: phone (default) = 2 lines: line 1 flex justify-between: `{n} · {PART_LABELS[row.id] ?? row.label}` 15px ink-soft + StatusWord; line 2 headline Newsreader 23/500/1.25 (wraps, no truncate). sm+: `sm:flex sm:items-baseline sm:gap-6` with number col `sm:w-6`, label col `sm:w-[116px]`, title `flex-1`, status at end. Padding `px-4 py-4 sm:px-6`, `min-h-[64px]`. Headline fallback for unwritten rows: `row.headline || PART_LABELS[row.id]`.
Tests in `__tests__/PartsList.test.tsx` per behavior list.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/PartsList.test.tsx && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "The nine parts" apps/dispatch-control/components/editor/PartsList.tsx` matches
    - `grep -n "partRowStatus" apps/dispatch-control/components/editor/PartsList.tsx` matches (no locally re-derived status text)
    - `grep -nE "font-mono|uppercase|tracking-|text-\[(9|10|11|12|13|14|16)px\]" apps/dispatch-control/components/editor/PartsList.tsx` returns nothing
    - test passes and strict build exits 0
  </acceptance_criteria>
  <done>All five primitives exist, tested, building.</done>
</task>

</tasks>

<verification>
Four primitive tests green + strict build green.
</verification>

<success_criteria>
Screens in wave 3 can be assembled entirely from these primitives and lib/editorState.ts.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-03-SUMMARY.md` with the final props signatures.
</output>
