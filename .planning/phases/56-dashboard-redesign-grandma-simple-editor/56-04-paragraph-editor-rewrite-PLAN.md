---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 04
type: execute
wave: 2
depends_on: [56-01, 56-02]
files_modified:
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionArticle.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/ParagraphRow.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/RewriteThisPart.tsx
  - apps/dispatch-control/__tests__/SectionArticle.test.tsx
  - apps/dispatch-control/__tests__/RewriteThisPart.test.tsx
autonomous: true
requirements: [P56-B4, P56-A2]

must_haves:
  truths:
    - "Each paragraph can be clicked (or its pencil pressed, or Enter/Space when focused) to edit it in place in a textarea with Save and Cancel"
    - "Save calls patchSection (patchBonus for the bonus part) with the revision id read fresh at save time; on failure the words stay in the box with the UI-SPEC error sentence"
    - "Only one paragraph is open at a time; opening another with unsaved edits asks 'Leave without saving?'"
    - "Rewrite this part keeps the old text visible while rewriting, then offers Keep this version / Go back to the old one; Go back re-applies the old blocks"
  artifacts:
    - path: "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionArticle.tsx"
      provides: "Paragraph list with one-open-at-a-time in-place editing"
    - path: "apps/dispatch-control/app/(editorial)/s/[section]/_components/ParagraphRow.tsx"
      provides: "One paragraph: read mode with pencil, edit mode with textarea"
    - path: "apps/dispatch-control/app/(editorial)/s/[section]/_components/RewriteThisPart.tsx"
      provides: "Client-side keep/undo around rerollAgent"
  key_links:
    - from: "SectionArticle.tsx"
      to: "lib/contentPatchClient.ts"
      via: "patchSection / patchBonus"
      pattern: "patch(Section|Bonus)\\("
    - from: "RewriteThisPart.tsx"
      to: "lib/pipelineControlClient.ts"
      via: "rerollAgent then getDraft; Go back via patchSection/patchBonus"
      pattern: "rerollAgent\\("
---

<objective>
Build the Section page's two interactive pieces as standalone, tested components: the per-paragraph in-place editor (SectionArticle + ParagraphRow) and the "Rewrite this part" helper with client-side Keep / Go back.

Purpose: Locked decision 6 and client bug 5 (only Re-roll, no sentence edit). Research finding 1: the reroll endpoint overwrites the draft, so Keep/Go back is implemented client-side by snapshotting blocks and re-applying them through the content-patch API — backend unchanged.
Output: 3 components + 2 tests. The page wiring is plan 56-06.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/canvas/Section.dc.html
@apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx
@apps/dispatch-control/lib/contentPatchClient.ts
@apps/dispatch-control/lib/pipelineControlClient.ts
@apps/dispatch-control/lib/editorState.ts

<interfaces>
```typescript
// lib/contentPatchClient.ts
export interface ContentBlock { type: 'paragraph' | 'h2' | 'h3' | 'blockquote'; text: string }
export class ContentPatchError extends Error { reason?: string /* 'revision_mismatch' on 409 */ }
export async function patchSection(runId: string, sectionId: string, payload: { ifRevisionID: string; blocks: ContentBlock[] }, token: string | null): Promise<PatchResult>
export async function patchBonus(runId: string, payload: BonusPatchPayload /* { ifRevisionID, body, ... } — read the interface at line 113 */, token: string | null): Promise<PatchResult>
export async function getDraft(runId: string, token: string | null): Promise<DraftResponse>
// lib/pipelineControlClient.ts
export async function rerollAgent(runId: string, agentKey: string, token: string | null): Promise<RerollAgentResult>  // 409 while the run is running
// lib/editorState.ts (56-01)
export const AGENT_FOR_SECTION: Record<string, string>
export const COPY: { saveFailed; editReassurance; saved; discardTitle; discardBody; discardConfirm; discardCancel; rewriteButton; rewriteInProgress; rewriteResult; keepVersion; goBack; ... }
// components/ui/ConfirmDialog.tsx
useConfirm(): (opts: { title: string; body?: string; confirmLabel?: string; cancelLabel?: string; tone?: 'default'|'danger' }) => Promise<boolean>
```
InPlaceBlockEditor.tsx is the pattern to replicate for save semantics (copy blocks, replace one index's text, bonus branches to patchBonus, 409 handling, Escape/Cmd+Enter). It is deleted by plan 56-06, not here.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: SectionArticle + ParagraphRow (in-place paragraph editing)</name>
  <files>apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionArticle.tsx, apps/dispatch-control/app/(editorial)/s/[section]/_components/ParagraphRow.tsx, apps/dispatch-control/__tests__/SectionArticle.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx (save/409/bonus branch semantics to replicate)
    - apps/dispatch-control/lib/contentPatchClient.ts lines 60-130 and 224-320 (payload shapes, BonusPatchPayload)
    - 56-UI-SPEC.md § "6. Section page" paragraph + edit-mode bullets, § "Responsive contract" Section bullet, § "Accessibility" keyboard bullet
    - canvas/Section.dc.html (paragraph row, pencil SVG path, edit-mode block)
    - 56-RESEARCH.md Pitfall 9
  </read_first>
  <behavior>
    - renders one focusable row (tabIndex 0) per `paragraph`/`blockquote` block; h2/h3 render as headings, not editable
    - clicking paragraph text, pressing its pencil (`aria-label="Edit this paragraph"`), or Enter on the focused row opens a textarea prefilled with that text, label "Editing paragraph 3"
    - Save calls patchSection(runId, sectionId, { ifRevisionID: getRevisionId(), blocks }) where blocks equals the original array with ONLY that index's text replaced; for sectionId 'bonus' it calls patchBonus instead and never patchSection
    - after Save resolves: onSaved() called, textarea closes, "Saved" visible
    - Save rejects → text 'We couldn't save that change. Your words are still in the box. Press Save to try again.' and textarea keeps the typed value
    - Escape and Cancel close without calling patch; focus returns to the row
    - with paragraph 1 dirty, clicking paragraph 2 calls confirm with title 'Leave without saving?'; resolving false keeps paragraph 1 open
    - readOnly=true → no pencil buttons, clicking does nothing
  </behavior>
  <action>
`ParagraphRow.tsx` ('use client') props: `{ index: number; text: string; editing: boolean; readOnly: boolean; saving: boolean; error: string | null; justSaved: boolean; onOpen: () => void; onCancel: () => void; onSave: (text: string) => void; onDirtyChange: (dirty: boolean) => void }`. Read mode: `div tabIndex=0 role="group" aria-label={\`Paragraph ${index + 1}\`}` with classes `group relative -mx-3 px-3 py-2 pr-16 sm:pr-3 flex gap-4 hover:bg-[color:var(--color-wash)] focus-within:bg-[color:var(--color-wash)] editor-focus`; `p` Lora `text-[18px] leading-[1.7] sm:leading-[1.75]`; pencil `button aria-label="Edit this paragraph"` 48x48, `absolute right-0 top-0 sm:static`, `opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100` (always visible on touch), 20px pencil SVG (stroke 2) copied from canvas/Section.dc.html. Enter/Space on the row → onOpen. "Saved" `span` 15px `text-[color:var(--color-done)]` when justSaved. Edit mode: `label` "Editing paragraph {n}" 15px/600 (htmlFor textarea id); `textarea` Lora 18/1.75, `px-6 py-4 border-2 border-[color:var(--color-cobalt)] bg-[color:var(--color-card)] w-full resize-y`, rows 6 on phone / min 4 (`rows={6}`), autoFocus, `onFocus` → `scrollIntoView({ block: 'center' })` guarded for jsdom; Escape → onCancel; Cmd/Ctrl+Enter → onSave. Buttons: Save (`min-h-[48px] bg-[color:var(--color-cobalt)] text-[color:var(--color-card)] text-[17px] font-semibold`), Cancel (ghost 48px ink border); stacked full width on phone (`flex flex-col sm:flex-row gap-2`). Reassurance line 15px ink-soft: COPY.editReassurance. Error `p role="alert"` 15px/600 problem colour: COPY.saveFailed (do not show server text).

`SectionArticle.tsx` ('use client') props: `{ runId: string; sectionId: string; blocks: ContentBlock[]; getRevisionId: () => string; readOnly: boolean; onSaved: () => Promise<void> | void; bonusBody?: (blocks: ContentBlock[]) => BonusPatchPayload }`. State: `openIndex: number | null`, `dirty`, `saving`, `error`, `savedIndex` (cleared after 3000 ms via setTimeout, cleanup on unmount). `useAuth().getToken`. Opening a different index while dirty → `await confirm({ title: COPY.discardTitle, body: COPY.discardBody, confirmLabel: COPY.discardConfirm, cancelLabel: COPY.discardCancel })`. Save: `const next = blocks.map((b, i) => i === openIndex ? { ...b, text } : b)`; if sectionId === 'bonus' → `patchBonus(runId, bonusBody ? bonusBody(next) : { ifRevisionID: getRevisionId(), body: next } as BonusPatchPayload, token)` (match the real BonusPatchPayload field names from contentPatchClient.ts line 113; the revision id is always `getRevisionId()` at call time) else `patchSection(runId, sectionId, { ifRevisionID: getRevisionId(), blocks: next }, token)`. On success `await onSaved()` (caller reloads draft), close, focus the row (ref map), set savedIndex. On error (including ContentPatchError reason 'revision_mismatch') set COPY.saveFailed and keep open; for revision_mismatch also call `onSaved()` so the next Save uses the reloaded revision. Text column `max-w-[720px]`.

Test `__tests__/SectionArticle.test.tsx`: mock `@clerk/nextjs` (`useAuth: () => ({ getToken: async () => 't' })`), `@/lib/contentPatchClient` (vi.hoisted patchSection/patchBonus spies, keep real ContentPatchError via importActual), wrap in `ConfirmProvider` from `@/components/ui/ConfirmDialog` or mock `useConfirm`. Cover every behavior bullet.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/SectionArticle.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n 'aria-label="Edit this paragraph"' "apps/dispatch-control/app/(editorial)/s/[section]/_components/ParagraphRow.tsx"` matches
    - `grep -n "getRevisionId()" "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionArticle.tsx"` matches at least twice
    - `grep -nE "font-mono|uppercase|tracking-|text-\[(9|10|11|12|13|14|16)px\]|textTransform" "apps/dispatch-control/app/(editorial)/s/[section]/_components/ParagraphRow.tsx" "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionArticle.tsx"` returns nothing
    - `grep -n "sanity" -i "apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionArticle.tsx"` returns nothing (EDT-05: no Sanity writes from this app)
    - SectionArticle.test.tsx passes
  </acceptance_criteria>
  <done>Paragraph in-place editing works and is tested end to end against mocked patch calls.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: RewriteThisPart (client-side Keep / Go back)</name>
  <files>apps/dispatch-control/app/(editorial)/s/[section]/_components/RewriteThisPart.tsx, apps/dispatch-control/__tests__/RewriteThisPart.test.tsx</files>
  <read_first>
    - apps/dispatch-control/lib/pipelineControlClient.ts lines 189-214 (rerollAgent, error text format "... failed (409): detail")
    - 56-RESEARCH.md § "Pattern 3: Client-side keep/undo" and Open Question 2
    - 56-UI-SPEC.md § "6. Section page" toolbar bullet, § "Copywriting" Rewrite rows
  </read_first>
  <behavior>
    - renders a ghost button 'Rewrite this part' (not data-primary)
    - click → shows 'Rewriting this part…' (amber, aria-live polite), button hidden while busy, calls rerollAgent(runId, AGENT_FOR_SECTION[sectionId], token) once
    - after reroll resolves → calls onRewritten() (caller reloads the draft so new text shows) then shows 'Here is the new version. Keep it or go back to the old one.' with buttons 'Keep this version' and 'Go back to the old one'
    - Keep → result message disappears; no patch call
    - Go back → patchSection(runId, sectionId, { ifRevisionID: getRevisionId(), blocks: snapshot }) with the blocks captured BEFORE reroll (patchBonus for 'bonus'), then onRewritten()
    - reroll rejects → inline 'We couldn't rewrite this part just now. Wait a minute and press Rewrite this part again.' and the old text was never touched (no patch call)
    - the component renders nothing when `canRewrite` (from editorState) is false for the props given — ASSUMPTION A2: hidden for game, Look (theme), deliberation, podcast, non-specAd bonus, published issues and while writing
  </behavior>
  <action>
`RewriteThisPart.tsx` ('use client') props: `{ runId: string; sectionId: string; bonusType?: string; published: boolean; runStatus?: string; currentBlocks: ContentBlock[]; getRevisionId: () => string; onRewritten: () => Promise<void> | void; bonusBody?: (blocks: ContentBlock[]) => BonusPatchPayload }`. First line: `if (!canRewrite({ sectionId, bonusType, published, runStatus })) return null`. State machine `'idle' | 'rewriting' | 'choosing' | 'reverting' | 'error'`; snapshot `useRef<ContentBlock[] | null>`. On click: `snapshot.current = currentBlocks.map(b => ({ ...b }))`, set rewriting, `await rerollAgent(runId, AGENT_FOR_SECTION[sectionId], await getToken())`, `await onRewritten()`, set choosing. Go back: set reverting, patch with snapshot (same bonus branch as SectionArticle), `await onRewritten()`, idle. Errors in reroll → state error with the copy above (add constant `REWRITE_FAILED` locally — this file owns it; the string must not match EDITOR_BANNED_PATTERN); errors on Go back → COPY.saveFailed. Styling: ghost button `min-h-[48px] w-full sm:w-auto px-6 border border-[color:var(--color-ink)] bg-[color:var(--color-card)] text-[17px] font-semibold editor-focus`; Keep and Go back are BOTH ghost 48px buttons (UI-SPEC reserves cobalt for the slab primary, Save and focus; neither carries data-primary). Messages Lora 17px (`text-[color:var(--color-amber-text)]` for in-progress). Test file covers every behavior bullet with mocked `@/lib/pipelineControlClient` and `@/lib/contentPatchClient`.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/RewriteThisPart.test.tsx __tests__/SectionArticle.test.tsx && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "canRewrite(" "apps/dispatch-control/app/(editorial)/s/[section]/_components/RewriteThisPart.tsx"` matches
    - `grep -n "Re-roll\|Reroll\b\|re-roll" -i "apps/dispatch-control/app/(editorial)/s/[section]/_components/RewriteThisPart.tsx" | grep -v "rerollAgent"` returns nothing (no user-visible reroll wording)
    - `grep -c "data-primary" "apps/dispatch-control/app/(editorial)/s/[section]/_components/RewriteThisPart.tsx"` = 0
    - tests pass; strict build exits 0
  </acceptance_criteria>
  <done>Rewrite this part works with a real undo, using only existing endpoints.</done>
</task>

</tasks>

<verification>
SectionArticle.test.tsx + RewriteThisPart.test.tsx green; strict build green.
</verification>

<success_criteria>
P56-B4 component-level behaviours proven; bug 5 (no sentence-level edit) fixed at the component level.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-04-SUMMARY.md` recording ASSUMPTION A2 and the exact BonusPatchPayload mapping used.
</output>
