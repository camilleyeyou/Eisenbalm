---
phase: 32-native-galley-read-only-span-resolver
plan: 07
type: execute
wave: 4
depends_on: [32-06]
files_modified:
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
autonomous: true
requirements: [GLY-05, GLY-01]
must_haves:
  truths:
    - "The galley is the default view at /review-desk/[runId]"
    - "Section chips show per-section open-finding counts (severity-aware) with an unresolved marker, and clicking a chip scrolls to that section in the galley"
    - "Each section has an Edit affordance that swaps into the Phase 31 section editor and returns to the galley"
    - "The Phase 31 iframe toggle stays reachable as the soak-cycle fallback"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"
      provides: "galley-default screen composition (galley | editor | iframe)"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx"
      provides: "chip strip with finding counts + scroll-to-section jump-nav"
  key_links:
    - from: "SectionChipList chip click"
      to: "galley section (#galley-{id})"
      via: "onSelect -> scrollIntoView in the galley"
      pattern: "scrollIntoView|onSelect"
    - from: "page.tsx"
      to: "Galley (default) + SectionEditorPanel (edit) + PreviewIframe (fallback)"
      via: "view-mode state"
      pattern: "Galley"
---

<objective>
Wire the galley into the Review Desk screen as the DEFAULT view (D-01), upgrade `SectionChipList` in place with per-section open-finding counts + scroll-to-section jump-nav (GLY-05, D-03), keep the Phase 31 section-editor reachable via an Edit affordance (D-01), and keep the Phase 31 iframe toggle mounted as the soak-cycle fallback (D-02). Turns `SectionChipList.test.tsx` green and completes GLY-01/GLY-05.

Purpose: one read-first screen where Andrew reads the galley, jumps by chip, edits per section, and can still flip to the iframe.
Output: upgraded `SectionChipList.tsx` + re-composed `page.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md

<interfaces>
Current SectionChipList props: { sections?, selected, onSelect, dirty? } — EDITABLE_SECTIONS (9 ids).
Current page.tsx: 'use client'; loads draft via getDraft(runId, token); state selectedSection + dirty + showPreview + previewUrl; renders SectionChipList (left) + SectionEditorPanel|PreviewIframe (right).
Plan 32-06 Galley: props { runId, draft }; sections wrapped `<section id="galley-{id}">`.
Convex query: api.qaCorrections.byRunId { runId } — the finding rows for chip counts.
Plan 32-03: qaSectionToGalleyId — maps QA sectionName → galley id for counting.
D-08: chips count OPEN findings only (accepted excluded). D-09: unresolved marker on the chip.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Upgrade SectionChipList in place — finding counts + scroll jump-nav</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx (current component — preserve `sections`/`selected`/`onSelect`/`dirty` props and the ≥44px keyboard-focusable button contract)
    - apps/dispatch-control/__tests__/SectionChipList.test.tsx (the RED spec — the new `counts` prop shape)
    - .planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md (D-03 counts severity-aware/open-only + jump-nav; D-09 unresolved marker)
  </read_first>
  <action>
    Extend `SectionChipListProps` with an OPTIONAL `counts?: Record<string, { open: number; error: number; warning: number; info: number; unresolved: number }>` (keyed by galley section id). Keep all existing props unchanged (backward compatible — the Phase 31 caller passes no `counts`). For each chip, when `counts[section.id]` exists and `open > 0`, render a count badge showing the `open` number, tinted by the highest present severity (error → `--color-vermilion`, else warning → `--color-marigold-text`, else info → `--color-cobalt`); when `unresolved > 0`, render an additional small unresolved marker (e.g. a `!` glyph or a dashed-border dot) with an `aria-label="{n} unresolved"`. Preserve the existing unsaved-`dirty` dot. Keep `onSelect(section.id)` on click and the min-h-[44px]/focus-visible styling. This is a presentational upgrade — the parent (Task 2) computes `counts` and owns scroll behavior.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/SectionChipList.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `SectionChipList.test.tsx` passes green
    - `SectionChipListProps` gains an optional `counts` prop; existing props unchanged (grep: `counts?:`)
    - A chip with `open > 0` renders the numeric count; `unresolved > 0` renders a marker with an aria-label
    - Chip stays a ≥44px keyboard-focusable `<button>` calling `onSelect(section.id)`
  </acceptance_criteria>
  <done>The chip strip shows severity-aware open-finding counts + unresolved markers and remains the jump-nav trigger (GLY-05).</done>
</task>

<task type="auto">
  <name>Task 2: Re-compose page.tsx — galley default view + counts + edit affordance + iframe fallback</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (current screen — preserve draft-load, dirty guard, PreviewIframe toggle, SectionEditorPanel wiring)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx (Plan 32-06 — the default body)
    - apps/dispatch-control/app/(dashboard)/settings/_components/AuditLogViewer.tsx (the `useQuery(api.qaCorrections...)` import pattern)
    - apps/dispatch-control/lib/galley/sectionIdMap.ts + spanResolver.ts (to compute per-section open/unresolved counts for the chips)
  </read_first>
  <action>
    Refactor page.tsx (stays `'use client'`) to a three-mode view driven by a `viewMode` state: `'galley'` (DEFAULT, D-01) | `'edit'` | `'iframe'`.
    - Add a `viewMode` state initialised to `'galley'`. Header controls: an "Edit section" toggle (enters `'edit'` for the currently `selectedSection`, D-01) and the EXISTING "Show/Hide preview" control repurposed to toggle `'iframe'` (D-02 — keep PreviewIframe + preview-url fetch exactly as-is). Selecting a chip in galley mode scrolls to `#galley-{selectedSection}` (`document.getElementById(\`galley-${id}\`)?.scrollIntoView({behavior:'smooth', block:'start'})`) rather than switching the editor; selecting a chip in edit mode selects the editor section (existing behavior). Keep the unsaved-`dirty` confirm guard when leaving an edited section.
    - Compute chip `counts`: `const findings = useQuery(api.qaCorrections.byRunId, { runId }) ?? []`; for each galley section id, filter findings to that section (via `qaSectionToGalleyId(row.sectionName) === id`), exclude `accepted`, run `resolveSectionFindings(draft.sections[id]?.blocks ?? [], mapped)` to split resolved/unresolved, and tally `{open: resolved.length+unresolved.length, error/warning/info by severity, unresolved: unresolved.length}`. Pass `counts` to `<SectionChipList>`. (Sections without draft blocks — game/podcast/theme/deliberation — count by severity only, unresolved 0.)
    - Body: `viewMode === 'galley'` → `<Galley runId={runId} draft={draft} />`; `'edit'` → the existing `<SectionEditorPanel .../>`; `'iframe'` → the existing `<PreviewIframe previewUrl=.../>`.
    - Keep the §31.9 rerun-clobber advisory note and the loading/error states.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run && pnpm --filter dispatch-control build 2>&1 | tail -8</automated>
  </verify>
  <acceptance_criteria>
    - page.tsx defaults to the galley view (grep: `useState<...>('galley')` or equivalent default) and renders `<Galley runId={runId} draft={draft} />`
    - The Phase 31 `PreviewIframe` toggle path is preserved (grep: `PreviewIframe`) and reachable via `viewMode === 'iframe'`
    - An Edit affordance swaps into `SectionEditorPanel` (grep: `SectionEditorPanel`) and returns to galley
    - Chip `counts` are computed from live `qaCorrections` via `resolveSectionFindings` + `qaSectionToGalleyId` and passed to `SectionChipList`; chip click in galley mode calls `scrollIntoView` on `#galley-{id}`
    - `pnpm --filter dispatch-control build` exits 0 (strict build — project memory: vitest doesn't type-check)
  </acceptance_criteria>
  <done>The Review Desk opens on the native galley with count-badged jump-nav chips, per-section Edit, and the iframe fallback preserved.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run` full suite green.
- `pnpm --filter dispatch-control build` exits 0.
- Manual (per 32-VALIDATION.md): open /review-desk/[runId] for a real run — galley is default, findings inline, chips jump, game sandboxed, iframe toggle still works.
</verification>

<success_criteria>
GLY-01 + GLY-05 complete: galley is the default read surface with jump-nav count chips and per-section editing, the iframe stays a fallback for the soak cycle, and the strict build passes.
</success_criteria>

<output>
After completion, create `.planning/phases/32-native-galley-read-only-span-resolver/32-07-SUMMARY.md`
</output>
