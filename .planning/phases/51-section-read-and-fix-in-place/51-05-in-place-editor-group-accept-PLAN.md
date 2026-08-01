---
phase: 51-section-read-and-fix-in-place
plan: 05
type: execute
wave: 4
depends_on: ["51-04"]
files_modified:
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/page.tsx
  - apps/dispatch-control/lib/galley/findingGroups.ts
  - apps/dispatch-control/components/galley/AnnotationMark.tsx
  - apps/dispatch-control/components/galley/GallerySection.tsx
  - apps/dispatch-control/components/galley/Galley.tsx
  - apps/dispatch-control/__tests__/findingGroups.test.ts
autonomous: true
requirements: [READ-04, READ-05]

must_haves:
  truths:
    - "Editor can edit the flagged passage in place, save it, and see a plain conflict message if the draft moved under them"
    - "Editor can accept a correction that recurs in the section in one action"
    - "A group accept that partly fails applies what worked and says so plainly, leaving the rest marked and openable"
    - "No structural block operation (add, delete, reorder, change type) is reachable from this surface"
  artifacts:
    - path: "apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx"
      provides: "the one flagged block's textarea with Save edit / Cancel edit"
      contains: "Save edit"
    - path: "apps/dispatch-control/lib/galley/findingGroups.ts"
      provides: "pure client-side grouping selector (axis + identical suggestedFix)"
      exports: ["groupFindings"]
  key_links:
    - from: "apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx"
      to: "apps/dispatch-control/lib/contentPatchClient.ts"
      via: "patchBonus for bonus, patchSection for the four long-reads"
      pattern: "patchBonus"
    - from: "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"
      to: "apps/dispatch-control/lib/findingsClient.ts"
      via: "sequential acceptFinding loop carrying the previous call's revisionId"
      pattern: "acceptFinding"
---

<objective>
Add the two remaining editor actions: fix the passage yourself in place (READ-05), and accept a correction that recurs in the section in one action (READ-04).

Purpose: READ-04 and READ-05 are the other two thirds of success criterion 4. Both must compose the shipped revision-guarded write path rather than routing around it — no server-side batch endpoint, no structural block editor, no autosave.

Output: an in-place `<textarea>` block editor wired to `Galley`'s `onEditSection`, a pure grouping selector, and a group-aware Accept threaded through the existing mark chain.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/51-section-read-and-fix-in-place/51-CONTEXT.md
@.planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md
@.planning/phases/51-section-read-and-fix-in-place/51-RESEARCH.md

<interfaces>
<!-- Contracts the executor needs. Extracted from live source. Do not re-explore. -->

lib/contentPatchClient.ts — the two save routes and the ALLOW-LIST that forces the branch:
  export interface ContentBlock { type: 'paragraph' | 'h2' | 'h3' | 'blockquote'; text: string }
  export interface SectionPatchPayload { ifRevisionID: string; blocks: ContentBlock[] }
  export interface BonusPatchPayload { ifRevisionID: string; [key: string]: unknown }
  export interface PatchResult { revisionId: string; warnings?: string[] }
  export class ContentPatchError extends Error { /* carries `reason` */ }
  patchSection(runId, sectionName, payload: SectionPatchPayload, token) -> PATCH /issues/{run_id}/sections/{section_name}
  patchBonus(runId, payload: BonusPatchPayload, token)                  -> PATCH /issues/{run_id}/bonus

  ** PATCH /issues/{run_id}/sections/{section_name} accepts EXACTLY four section_name
     values (docs/API_CONTRACTS.md:2619): originStory, problemStatement, founderBio,
     caseStudy. `bonus` is NOT in the allow-list — it MUST go to patchBonus. **

lib/findingsClient.ts:
  export async function acceptFinding(
    runId: string, findingId: string,
    payload: { ifRevisionID: string; suggestedFixOverride?: string },
    token: string | null,
  ): Promise<{ revisionId: string; findingId: string; resolution: 'accepted' }>
  export class FindingsError extends Error { /* reason: 'revision_mismatch' | 'span_not_resolved' | … */ }

components/galley/AnnotationMark.tsx — the existing single-accept shape to extend
(handleAccept at ~line 219; the accept button at ~line 305 inside the
`.galley-popover__actions` span). The popover is PHRASING CONTENT ONLY — every child is a
`<span style={{ display: 'block' }}>`, a `<button>` or an `<input>`. Never a `<div>`,
never a nested `<p>`.

app/(dashboard)/review-desk/[runId]/_components/BlockEditor.tsx — the controlled
`<textarea>` precedent to COPY THE PATTERN FROM (minHeight 44, local onChange, explicit
external Save/Cancel). Do NOT import it; D-18 forbids deep-linking into the old console's
editor and that file carries structural block controls this surface must not have.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: In-place block editor with Save edit / Cancel edit and the patchBonus branch</name>
  <files>apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx, apps/dispatch-control/app/(editorial)/s/[section]/page.tsx</files>
  <behavior>
    - "Edit myself" on a finding, and "Edit text" on the PassageToolbar, both open a textarea on the flagged block in place — never a panel, never a route change.
    - Save edit on originStory calls `patchSection('run_1', 'originStory', { ifRevisionID: 'rev_1', blocks }, token)`.
    - Save edit on the bonus section calls `patchBonus` and never `patchSection`.
    - A `revision_mismatch` rejection renders exactly: "This passage changed since you started editing — reload and try again."
    - Cancel edit makes no network call and restores the original text.
    - The dirty dot is visible the instant the textarea value differs from the original.
    - No add / delete / reorder / change-type control exists anywhere in the editor.
  </behavior>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/BlockEditor.tsx (full — the controlled textarea pattern to replicate: minHeight 44, local value state, explicit Save/Cancel; note which of its controls are STRUCTURAL and must NOT be copied)
    - apps/dispatch-control/lib/contentPatchClient.ts lines 62-80, 110-130, 224-240, 301-318 (ContentBlock, SectionPatchPayload, BonusPatchPayload, patchSection, patchBonus, ContentPatchError)
    - apps/dispatch-control/components/galley/AnnotationMark.tsx lines 219-250 (the 409 branch shape to mirror)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx (the existing dirty-dot visual vocabulary to reuse — do not design a new indicator)
    - apps/dispatch-control/app/(editorial)/s/[section]/page.tsx (the `TODO(51-05)` onEditSection stub left by plan 51-04)
    - .planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md § In-Place Editing Contract
  </read_first>
  <action>
Create `_components/InPlaceBlockEditor.tsx`.

**Implementation is a controlled `<textarea>`, not `contenteditable`** — UI-SPEC locked this, matching `BlockEditor.tsx`'s precedent. `minHeight: 44`, local `value` state, no autosize magic required.

**Text only (D-18).** No block-type selector, no add-block, no delete-block, no reorder. Do not copy those controls out of `BlockEditor.tsx`. The block's existing `type` (`paragraph` | `h2` | `h3` | `blockquote`) is preserved verbatim on save.

**Which block.** `Galley` calls `onEditSection(sectionId, findingId?)`. Resolve the target block index from the finding: use the same `resolveSectionFindings` output the galley already produced for this section (`ResolvedAnnotation.blockIndex`) — do not write a second resolver. When `findingId` is undefined (the `PassageToolbar` "Edit text" path), `PassageToolbar` gives you the selection's block via `data-block-index`; if only `sectionId` reaches you, open the editor on the first block and say so plainly rather than guessing silently.

**Save edit (D-19).** Explicit button labelled exactly `Save edit`. No save-on-blur, no debounced autosave — both fight the revision guard. Build the full `blocks` array for the section by copying the draft's current blocks and replacing only the edited index's `text`, then:

```ts
try {
  if (sectionId === 'bonus') {
    // Pitfall 5: `bonus` is NOT in patchSection's four-value allow-list.
    await patchBonus(runId, { ifRevisionID: draft.revisionId, body: nextBlocks }, token)
  } else {
    await patchSection(runId, sectionId, { ifRevisionID: draft.revisionId, blocks: nextBlocks }, token)
  }
  await reloadDraft()
  setEditing(false)
} catch (e) {
  if (e instanceof ContentPatchError && e.reason === 'revision_mismatch') {
    await reloadDraft()
    setNote('This passage changed since you started editing — reload and try again.')
  } else {
    setNote(e instanceof Error ? e.message : 'Save failed.')
  }
}
```
The 409 copy string is locked by UI-SPEC — reproduce it byte-for-byte, em dash included.

Only `originStory`, `problemStatement`, `founderBio`, `caseStudy` and `bonus` can reach this editor at all: the other four sections carry no inline findings (D-14) and therefore no "edit myself" entry point. If `sectionId` is one of those four, the editor must not open — render nothing rather than call an endpoint that will reject.

**Cancel edit.** Button labelled exactly `Cancel edit`. Reverts to the original text, closes the editor, makes no network call.

**Dirty state.** A small dot beside the block the moment `value !== original`, reusing `SectionChipList.tsx`'s existing dirty-dot visual vocabulary. Do not design a new indicator.

**Keyboard.** `Escape` = Cancel edit (matches `AnnotationMark`'s Escape-closes-popover convention). `Cmd/Ctrl+Enter` = Save edit — additive to the button, never a replacement for it.

Buttons are 11px/600 Space Grotesk uppercase with `.04em` tracking, `minHeight: 44`, `1px solid var(--color-faint)`, `borderRadius: 2`, `background: white`, `color: var(--color-ink)` — the exact `actionButtonStyle` shape already used by `AnnotationMark`/`ClaimMark`. Focus ring `2px solid var(--color-ink)`.

In `page.tsx`, replace the `TODO(51-05)` stub: hold `{ sectionId, findingId, blockIndex } | null` in page-local state, set it from `onEditSection`, and render `<InPlaceBlockEditor …>` in place of the targeted block. No deep-link to `SectionEditorPanel` or `BlockEditor`, no route change, no escape hatch back into the old console mid-read (D-18).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx -t "in-place edit"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Save edit" "apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx"` matches
    - `grep -n "Cancel edit" "apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx"` matches
    - `grep -n "patchBonus" "apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx"` matches
    - `grep -n "sectionId === 'bonus'" "apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx"` matches
    - `grep -n "This passage changed since you started editing — reload and try again." "apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx"` matches
    - `grep -n "ifRevisionID" "apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx"` matches
    - `grep -n "contentEditable" "apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx"` returns NO matches
    - `grep -rn "SectionEditorPanel\|BlockEditor" "apps/dispatch-control/app/(editorial)/"` returns NO matches
    - `grep -rn "TODO(51-05)" "apps/dispatch-control/app/(editorial)/"` returns NO matches
    - `cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx -t "in-place edit"` exits 0
  </acceptance_criteria>
  <done>The flagged block becomes an editable textarea in place with explicit Save edit / Cancel edit, a visible dirty dot, a plain 409 message, and the bonus section provably routed to `patchBonus`.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Pure grouping selector for recurring corrections</name>
  <files>apps/dispatch-control/lib/galley/findingGroups.ts, apps/dispatch-control/__tests__/findingGroups.test.ts</files>
  <behavior>
    - Two findings with the same `axis` and byte-identical `suggestedFix` group together even when their `quotedSpan` values differ.
    - Two findings with the same `suggestedFix` but different `axis` do NOT group.
    - A finding with no `suggestedFix` never groups with anything (it is always a group of one).
    - Grouping is scoped to the section's rows only — a caller passes rows for one section.
    - The function is pure: no Convex import, no React import, no fetch.
  </behavior>
  <read_first>
    - apps/dispatch-control/lib/galley/findingState.ts (`isOpenFinding` — the ONE shared open-finding predicate; the caller filters with it, this selector must not re-implement a `!accepted` check)
    - apps/dispatch-control/lib/galley/spanResolver.ts (the `QaFinding` / `ResolvedAnnotation` shapes this selector's input matches)
    - apps/dispatch-control/lib/derivedState.ts lines 270-320 (the established pure-selector style to match: plain function, typed record return, no side effects)
    - apps/dispatch-control/__tests__/derivedState.test.ts (the pure-selector test style to match)
  </read_first>
  <action>
Create `apps/dispatch-control/lib/galley/findingGroups.ts` — a pure derived selector, in the established `lib/derivedState.ts` style. No Convex, no React, no fetch.

```typescript
/**
 * Phase 51 (READ-04, D-10/D-11) — recurring-correction grouping.
 *
 * A "group" is SIBLING findings that share a fix, NOT one finding with an
 * ambiguous span: the rules layer emits one qaCorrections row per occurrence,
 * each with its own resolvable span and the same suggestedFix. Accepting the
 * group is the "one action" READ-04 asks for.
 *
 * Group key = `${axis ?? ''} ${suggestedFix}` — same axis AND byte-identical
 * suggestedFix, within one section. Quoted spans may differ (the same word
 * flagged inside two different sentences still groups).
 *
 * A finding with no suggestedFix is ALWAYS a group of one — there is no shared
 * fix to apply.
 *
 * This changes NOTHING about lib/galley/spanResolver.ts's ambiguity handling and
 * NOTHING about the accept endpoint's server-side resolution semantics (D-10).
 */
export interface GroupableFinding {
  _id: string
  axis?: string
  suggestedFix?: string
}

export interface FindingGroup {
  key: string
  findingIds: string[]
}

export function groupFindings(rows: ReadonlyArray<GroupableFinding>): FindingGroup[]

/** The group a given finding belongs to — `findingIds.length === 1` when it is alone. */
export function groupForFinding(rows: ReadonlyArray<GroupableFinding>, findingId: string): FindingGroup
```

`groupFindings` preserves input order within each group and returns groups in first-appearance order. Findings with no `suggestedFix` each get their own single-member group keyed on their `_id` so they can never collide.

Create `apps/dispatch-control/__tests__/findingGroups.test.ts` (`.test.ts`, node environment — it is a pure function, no jsdom) with one case per bullet in this task's `<behavior>` block, plus: an empty-input case returning `[]`, and a case proving two findings whose `suggestedFix` differs by a single trailing space do NOT group (byte-identical means byte-identical).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/findingGroups.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/lib/galley/findingGroups.ts` exists
    - `grep -n "export function groupFindings" apps/dispatch-control/lib/galley/findingGroups.ts` matches
    - `grep -n "export function groupForFinding" apps/dispatch-control/lib/galley/findingGroups.ts` matches
    - `grep -n "convex\|react\|fetch(" apps/dispatch-control/lib/galley/findingGroups.ts` returns NO matches
    - `cd apps/dispatch-control && npx vitest run __tests__/findingGroups.test.ts` exits 0 with at least 6 passing cases
  </acceptance_criteria>
  <done>A pure, tested grouping selector exists in `lib/galley/`; `spanResolver.ts` is untouched.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Group-aware Accept — count in the label, sequential loop, honest partial failure</name>
  <files>apps/dispatch-control/components/galley/AnnotationMark.tsx, apps/dispatch-control/components/galley/GallerySection.tsx, apps/dispatch-control/components/galley/Galley.tsx, apps/dispatch-control/app/(editorial)/s/[section]/page.tsx</files>
  <behavior>
    - A finding in a group of 3 renders the accept button labelled "Accept suggestion (applies to 3 places)".
    - A lone finding renders the plain accept label with no "(applies to" text.
    - Clicking a group accept calls `acceptFinding` once per member, sequentially, each call using the revisionId returned by the previous one.
    - Five members with two rejections renders exactly "3 of 5 applied — 2 still need you." and the two failures stay marked and openable.
    - Callers that do not pass the group prop (Review Desk, Voice Pass) render exactly today's single Accept.
  </behavior>
  <read_first>
    - apps/dispatch-control/components/galley/AnnotationMark.tsx lines 100-160 and 210-345 (labels, `isRewriteVariant` as modified by 51-01, `handleAccept`, and the phrasing-content-only action row)
    - apps/dispatch-control/components/galley/GallerySection.tsx lines 67-200 (props interface, the useMemo components object, and its dep array — new props MUST be added to it)
    - apps/dispatch-control/components/galley/Galley.tsx lines 119-200 and 355-425 (GalleyProps and the two GallerySection mounts)
    - apps/dispatch-control/lib/findingsClient.ts (acceptFinding's exact signature and return shape, FindingsError reasons)
    - apps/dispatch-control/lib/galley/findingGroups.ts (created in Task 2)
    - .planning/phases/51-section-read-and-fix-in-place/51-UI-SPEC.md § Recurring Correction / Group-Accept Contract
  </read_first>
  <action>
**Thread ONE new optional prop** `Galley` → `GallerySection` → `AnnotationMark`. Additive only; undefined leaves today's render byte-identical for Review Desk and Voice Pass (D-24):

```typescript
/**
 * Phase 51 (READ-04, D-10..D-13) — recurring-correction group accept.
 * `sizeFor` returns how many sibling findings share this finding's fix (1 when
 * it is alone); `acceptGroup` runs the sequential accept loop. Undefined
 * (Review Desk / Voice Pass) leaves the single-accept behaviour unchanged.
 */
findingGroup?: {
  sizeFor: (findingId: string) => number
  acceptGroup: (findingId: string) => Promise<void>
}
```
Add it to `GalleyProps`, `GallerySectionProps` and `AnnotationMarkProps`; pass it on both `<GallerySection>` mounts in `Galley.tsx`, on the `<AnnotationMark>` mount in `GallerySection.tsx`, AND add `findingGroup` to that `useMemo`'s dependency array.

**In `AnnotationMark`**, inside the existing accept button only:
```tsx
const groupSize = findingGroup?.sizeFor(value.findingId) ?? 1
const acceptText = groupSize >= 2 ? `${acceptLabel} (applies to ${groupSize} places)` : acceptLabel
```
and the click handler becomes `groupSize >= 2 ? () => void handleGroupAccept() : () => void handleAccept()`, where `handleGroupAccept` sets `busy`, awaits `findingGroup!.acceptGroup(value.findingId)`, and clears `busy`. While busy on a group, render the inline progress text `Applying {n} of {total}…` in place of the label — reuse the existing `busy`/disabled pattern, add no spinner and no new loading component. There is NO separate confirmation dialog: the count in the label already discloses the scope (UI-SPEC, locked).

Everything stays phrasing content — a `<button>` and `<span style={{ display: 'block' }}>`, never a `<div>`.

**In `page.tsx`**, supply `findingGroup` from the section's already-loaded rows using `groupForFinding` from Task 2, and implement `acceptGroup` as the sequential loop (D-12) — the revisionId for each call is the one the PREVIOUS call returned, never a stale closure value and never the same value twice:

```ts
async function acceptGroup(findingId: string) {
  const group = groupForFinding(sectionOpenFindings, findingId)
  let currentRevisionId = draft.revisionId
  let applied = 0
  const failed: string[] = []
  for (const id of group.findingIds) {
    try {
      const res = await acceptFinding(runId, id, { ifRevisionID: currentRevisionId }, await getToken())
      currentRevisionId = res.revisionId   // D-12 — fresh revision for the NEXT call
      applied += 1
    } catch {
      failed.push(id)                      // D-13 — keep going, never stop at first failure
    }
  }
  await reloadDraft()
  if (failed.length > 0) {
    setGroupNote(`${applied} of ${group.findingIds.length} applied — ${failed.length} still need you.`)
  }
}
```
Never fire the members in parallel against one `revisionId` — that would 409 most of the group against the Phase 33 D-06 guard. Never add a server-side batch endpoint; the backend is untouched this milestone. Never roll back — undoing applied content patches would need a server transaction the endpoint does not have. Failed members stay marked and individually openable; do not add a batch-retry control.

The partial-failure sentence is locked copy — `{X} of {Y} applied — {Z} still need you.` — reproduce it byte-for-byte, em dash included.

`sectionOpenFindings` is the rows for THIS section only, already filtered through the shared `isOpenFinding` predicate — do not re-implement a `!accepted` check.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx -t "group accept"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "findingGroup" apps/dispatch-control/components/galley/Galley.tsx apps/dispatch-control/components/galley/GallerySection.tsx apps/dispatch-control/components/galley/AnnotationMark.tsx` matches in all three files
    - `grep -n "applies to" apps/dispatch-control/components/galley/AnnotationMark.tsx` matches
    - `grep -n "findingGroup," apps/dispatch-control/components/galley/GallerySection.tsx` appears in the useMemo dep array region (lines 180-205)
    - `grep -n "still need you." "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -n "groupForFinding" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `grep -n "Promise.all\|Promise.allSettled" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` returns NO matches (D-12 forbids parallel accepts)
    - `grep -n "currentRevisionId = res.revisionId\|res.revisionId" "apps/dispatch-control/app/(editorial)/s/[section]/page.tsx"` matches
    - `cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx -t "group accept"` exits 0
    - `cd apps/dispatch-control && npx vitest run __tests__/AnnotationMark.test.tsx __tests__/Galley.test.tsx` exits 0 — Review Desk / Voice Pass single-accept unregressed
  </acceptance_criteria>
  <done>An accept on a recurring correction is one action that names its own scope, runs sequentially against a fresh revision each time, and reports partial success plainly.</done>
</task>

</tasks>

<verification>
- `cd apps/dispatch-control && npx vitest run __tests__/SectionReaderPage.test.tsx __tests__/findingGroups.test.ts` exits 0
- `cd apps/dispatch-control && npx vitest run __tests__/AnnotationMark.test.tsx __tests__/GallerySection.test.tsx __tests__/Galley.test.tsx __tests__/ClaimMark.test.tsx` exits 0
- `grep -rn "batch" apps/dispatch-control/lib/findingsClient.ts` returns no new endpoint — the backend is untouched
</verification>

<success_criteria>
- The editor can fix the passage themselves in place, with explicit Save edit / Cancel edit, a visible dirty state, and a plain conflict message.
- The bonus section provably saves through `patchBonus`, never `patchSection`.
- A recurring correction is accepted in one action whose label names its scope, applied sequentially against a fresh revision each time.
- Partial failure applies what worked and says so, leaving the rest marked.
- No structural block operation and no parallel accept exists on this surface.
</success_criteria>

<output>
After completion, create `.planning/phases/51-section-read-and-fix-in-place/51-05-SUMMARY.md`
</output>
