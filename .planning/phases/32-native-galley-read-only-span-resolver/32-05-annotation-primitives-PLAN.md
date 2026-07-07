---
phase: 32-native-galley-read-only-span-resolver
plan: 05
type: execute
wave: 2
depends_on: [32-01, 32-03]
files_modified:
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard.tsx
  - apps/dispatch-control/app/globals.css
autonomous: true
requirements: [GLY-02]
must_haves:
  truths:
    - "A resolved QA finding underlines its span in a severity-tiered 1c color (error=vermilion, warning=marigold, info=cobalt dotted)"
    - "Clicking an annotation opens a read-only popover with axis · severity · reason · suggested fix (no action buttons this phase)"
    - "An unresolved finding renders as a section-end card showing full reason + original quoted text, labelled 'unresolved'"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx"
      provides: "@portabletext/react marks component: severity underline + read-only popover"
      exports: ["default"]
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard.tsx"
      provides: "D-09 section-end unresolved card"
      exports: ["default"]
  key_links:
    - from: "AnnotationMark"
      to: "the markDef finding payload (value prop)"
      via: "@portabletext/react marks component value"
      pattern: "value"
---

<objective>
Build the two annotation-render primitives (GLY-02) TDD-supported by Plan 32-01's `UnresolvedFindingCard.test.tsx` (and exercised further by `Galley.test.tsx` in Plan 32-06): the inline `AnnotationMark` (@portabletext/react marks component with the D-07 severity colors + D-10 read-only popover) and the D-09 section-end `UnresolvedFindingCard`. Add the galley annotation CSS to globals.css using the 1c tokens.

Purpose: severity is scannable and every finding is visible — resolved inline, unresolved as a card. Nothing silent.
Output: `AnnotationMark.tsx`, `UnresolvedFindingCard.tsx`, galley CSS.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md
@.planning/phases/32-native-galley-read-only-span-resolver/32-RESEARCH.md

<interfaces>
1c tokens (apps/dispatch-control/app/globals.css :root):
  --color-ink #17140e · --color-ink-soft #55514a · --color-card #ffffff ·
  --color-cobalt #253ad4 · --color-vermilion #e8471d · --color-marigold #f2b01e ·
  --color-marigold-text #9a6f04 · --color-green #148a52 · --font-ui / --font-body / --font-display

markDef payload AnnotationMark receives as `value` (from syntheticPortableText.ts):
  { _type:'annotation', _key, findingId, severity:'info'|'warning'|'error', axis?, reason, suggestedFix?, quotedSpan }

UnresolvedFinding (from spanResolver.ts): { findingId, sectionId, severity, axis?, reason, suggestedFix?, quotedSpan? }

D-07 severity treatment:
  error   -> vermilion underline + light tint  (--color-vermilion)
  warning -> marigold underline                (--color-marigold)
  info    -> cobalt dotted underline           (--color-cobalt)
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Galley annotation + unresolved CSS in globals.css</name>
  <files>apps/dispatch-control/app/globals.css</files>
  <read_first>
    - apps/dispatch-control/app/globals.css (:root token block ~L11-30 — use existing tokens; append a clearly-commented Phase 32 galley block at the END of the file)
    - .planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md (D-07 severity colors, D-04 type scale: Newsreader 52px headline, italic 22px deck, 16.5px/1.7 body)
  </read_first>
  <action>
    Append a `/* ── Phase 32: Native Galley ── */` block to apps/dispatch-control/app/globals.css. Define, using ONLY existing 1c tokens (rgba tints derived from vermilion are allowed):
    - `.galley-anno` base: `cursor:pointer; text-decoration:none;`
    - `.galley-anno[data-severity="error"]{ background: rgba(232,71,29,.13); border-bottom:2px solid var(--color-vermilion); }`
    - `.galley-anno[data-severity="warning"]{ border-bottom:2px solid var(--color-marigold); }`
    - `.galley-anno[data-severity="info"]{ border-bottom:1px dotted var(--color-cobalt); }`
    - `.galley-anno:focus-visible{ outline:2px solid var(--color-ink); }`
    - `.galley-popover{ position:absolute; z-index:40; max-width:340px; background:var(--color-card); border:1px solid var(--color-ink); box-shadow:5px 5px 0 var(--color-cobalt); padding:14px; font-family:var(--font-ui); font-size:12.5px; color:var(--color-ink); }` plus `.galley-popover__severity`, `.galley-popover__axis`, `.galley-popover__reason`, `.galley-popover__fix` label helpers (small uppercase tracked labels using marigold-text / cobalt tokens).
    - `.galley-unresolved{ border:1px dashed var(--color-vermilion); background:rgba(232,71,29,.06); padding:14px; margin-top:18px; }` with `.galley-unresolved__label{ text-transform:uppercase; letter-spacing:.08em; font-size:10px; color:var(--color-vermilion); }` and `.galley-unresolved__quote{ font-style:italic; color:var(--color-ink-soft); }`
    - Type scale (D-04): `.galley-headline{ font-family:var(--font-display); font-size:clamp(30px,4vw,52px); line-height:.98; }` · `.galley-deck{ font-family:var(--font-display); font-style:italic; font-size:22px; color:var(--color-ink-soft); }` · `.galley-body{ font-family:var(--font-body); font-size:16.5px; line-height:1.7; }` · `.galley-h2{ font-family:var(--font-display); font-size:28px; }` · `.galley-pullquote{ font-family:var(--font-display); font-style:italic; font-size:22px; border-left:3px solid var(--galley-accent, var(--color-cobalt)); padding-left:16px; }`
    - Paper background (D-04, explicit not implicit): `.galley-root{ background: var(--background); }` — the galley sits on the console's paper background as a deliberate rule, so a future white-card wrapper around the galley can never silently change the reading surface.
    Do NOT modify the existing `:root` block — append only.
  </action>
  <verify>
    <automated>grep -q 'data-severity="error"' apps/dispatch-control/app/globals.css && grep -q 'galley-unresolved' apps/dispatch-control/app/globals.css && grep -q 'galley-headline' apps/dispatch-control/app/globals.css && echo ok</automated>
  </verify>
  <acceptance_criteria>
    - globals.css contains `.galley-anno[data-severity="error"]` (vermilion), `[data-severity="warning"]` (marigold), `[data-severity="info"]` (cobalt dotted)
    - globals.css contains `.galley-popover`, `.galley-unresolved`, `.galley-headline`, `.galley-deck`, `.galley-body`
    - globals.css contains `.galley-root` with `background: var(--background)` (D-04 paper background, explicit)
    - The existing `:root{...}` token block is unchanged (only appended content)
  </acceptance_criteria>
  <done>Severity-tiered annotation styling, popover, unresolved card, and the D-04 type scale exist as galley CSS classes.</done>
</task>

<task type="auto">
  <name>Task 2: AnnotationMark.tsx — inline severity underline + read-only popover</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx</files>
  <read_first>
    - apps/dispatch-control/app/globals.css (the `.galley-anno` / `.galley-popover` classes from Task 1)
    - .planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md (D-10 — read-only popover: axis · severity · reason · suggested fix, NO action buttons; Phase 33 adds actions into THIS component)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx (an existing 'use client' component — match import/style conventions)
  </read_first>
  <action>
    Create `AnnotationMark.tsx` as a `'use client'` component to be used as the @portabletext/react `marks.annotation` component. Props: `{ value: AnnotationMarkDef; children: React.ReactNode }` where `AnnotationMarkDef = { findingId: string; severity: 'info'|'warning'|'error'; axis?: string; reason: string; suggestedFix?: string; quotedSpan?: string }` (define and export this type). Render a `<mark className="galley-anno" data-severity={value.severity} tabIndex={0} role="button" aria-label={\`QA ${value.severity} finding\`}>` wrapping `children`. On click and on Enter/Space keydown, toggle an `open` state. When open, render a `.galley-popover` (absolutely positioned relative to a wrapping `position:relative` span) containing: `.galley-popover__severity` (capitalized severity), `.galley-popover__axis` when `value.axis` is present, `.galley-popover__reason` (full `value.reason`), and `.galley-popover__fix` when `value.suggestedFix` is present (prefixed "Suggested: "). Close on Escape, outside-click, or re-click. Add `{/* Phase 33 (EDT-04): Accept/Edit/Dismiss action row mounts here */}` where the buttons will later go — NO action buttons this phase (D-10). Popover positioning may use a minimal absolute-position wrapper (no heavyweight lib needed for a read-only popover).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/Galley.test.tsx 2>&1 | tail -3; echo "---"; grep -rq "data-severity" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx" && echo ok</automated>
  </verify>
  <acceptance_criteria>
    - AnnotationMark.tsx exports the component + `AnnotationMarkDef` type; uses `className="galley-anno"` and `data-severity={value.severity}`
    - The popover renders `value.reason` and, when present, `value.axis` and `value.suggestedFix`; it renders NO Accept/Edit/Dismiss buttons (grep shows the Phase-33 placeholder comment, no `Accept`/`Dismiss` button text)
    - Mark is keyboard-openable (`tabIndex={0}`, Enter/Space handler) and closes on Escape
  </acceptance_criteria>
  <done>Inline annotations underline by severity and reveal a read-only popover with the finding detail.</done>
</task>

<task type="auto">
  <name>Task 3: UnresolvedFindingCard.tsx — D-09 section-end card</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/UnresolvedFindingCard.test.tsx (the RED spec — render props + assertions)
    - apps/dispatch-control/app/globals.css (`.galley-unresolved*` classes from Task 1)
    - .planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md (D-09: visible "unresolved" card at section end showing full reason + original quoted text; GLY-02 "never silently dropped")
  </read_first>
  <action>
    Create `UnresolvedFindingCard.tsx` (`'use client'` optional — pure presentational). Props: `{ finding: UnresolvedFinding }` (import `UnresolvedFinding` from `@/lib/galley/spanResolver`, or define a matching local prop type). Render a `.galley-unresolved` container with: a `.galley-unresolved__label` reading `UNRESOLVED · {severity}` (uppercase), the full `finding.reason` text, and — when `finding.quotedSpan` is present — a `.galley-unresolved__quote` showing the original quoted text in quotation marks (e.g. `“{quotedSpan}”`). When `finding.suggestedFix` is present, show it beneath the reason. Include `data-severity={finding.severity}` on the container for consistency. The card exists so a finding whose anchor failed is never dropped (D-09/GLY-02).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/UnresolvedFindingCard.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `UnresolvedFindingCard.test.tsx` passes green
    - The card renders both `finding.reason` and `finding.quotedSpan` verbatim and contains the literal text `UNRESOLVED` (case-insensitive match in the test)
    - Uses the `.galley-unresolved` class from globals.css
  </acceptance_criteria>
  <done>Unresolved findings surface as visible, labelled section-end cards — nothing silent.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run __tests__/UnresolvedFindingCard.test.tsx` green.
- AnnotationMark + galley CSS present; popover is read-only (no action buttons).
</verification>

<success_criteria>
GLY-02's visible language exists: severity-tiered inline annotations with a read-only popover, and section-end unresolved cards. Phase 33 extends AnnotationMark's popover with actions.
</success_criteria>

<output>
After completion, create `.planning/phases/32-native-galley-read-only-span-resolver/32-05-SUMMARY.md`
</output>
