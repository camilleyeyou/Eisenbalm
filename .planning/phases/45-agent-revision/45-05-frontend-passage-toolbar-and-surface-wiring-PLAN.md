---
phase: 45-agent-revision
plan: 05
type: execute
wave: 3
depends_on: ["45-01", "45-04"]
files_modified:
  - apps/dispatch-control/components/galley/GallerySection.tsx
  - apps/dispatch-control/components/galley/Galley.tsx
  - apps/dispatch-control/components/galley/PassageToolbar.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
  - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx
  - apps/dispatch-control/components/inspector/InspectorFooter.tsx
  - apps/dispatch-control/components/inspector/InspectorPanel.tsx
  - apps/dispatch-control/__tests__/PassageToolbar.test.tsx
autonomous: true
requirements: [REV-01, REV-04]
must_haves:
  truths:
    - "Selecting a passage in Draft (and Voice) surfaces a toolbar offering all six actions: Edit text, Ask agent to revise, Compare with previous, Restore previous, Related facts & sources, Inspect how this was made"
    - "Compare with previous and Restore previous render visible-but-reserved with an explanatory title (content version history is deferred, D-17)"
    - "Ask agent to revise opens the RevisionFlow scoped to the selected passage; on apply the draft reloads"
    - "The InspectorFooter 'Ask agent to revise' button is LIVE — the ASK_TO_REVISE_TITLE reserved path is gone"
  artifacts:
    - path: "apps/dispatch-control/components/galley/PassageToolbar.tsx"
      provides: "6-action floating selection toolbar with block/section capture"
      exports: ["PassageToolbar"]
    - path: "apps/dispatch-control/components/galley/GallerySection.tsx"
      provides: "data-block-index stamped per block + onRevise threading"
      contains: "data-block-index"
  key_links:
    - from: "components/galley/PassageToolbar.tsx"
      to: "components/revision/RevisionFlow.tsx"
      via: "Ask agent to revise → onRevise(passage) → surface mounts RevisionFlow"
      pattern: "onRevise"
    - from: "components/galley/GallerySection.tsx"
      to: "lib/blockIndexFromKey.ts"
      via: "data-block-index={blockIndexFromKey(value._key)}"
      pattern: "blockIndexFromKey"
---

<objective>
Deliver REV-01: the passage-selection toolbar. Stamp `data-block-index` onto every rendered galley
block (using the 45-01 helper), add a `PassageToolbar` that appears on text selection offering all
six actions (Edit text / Ask agent to revise / Compare with previous / Restore previous / Related
facts & sources / Inspect how this was made — Compare/Restore reserved-with-title, D-17), thread an
`onRevise` prop through the shared galley, and wire the toolbar + the 45-04 `RevisionFlow` into both
Draft (`ReviewDeskRunView`) and Voice (`VoicePassRunView`). Flip the Phase-44 InspectorFooter "Ask
agent to revise" button from RESERVED to LIVE (D-18).

Purpose: REV-01 + the second/third entry-point surfaces (D-18 "one component, every surface"). The
shared `Galley` instance backs both Draft and Voice, so wiring the toolbar there covers both.
Output: PassageToolbar.tsx, galley stamping/threading, Draft+Voice wiring, live InspectorFooter.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@.planning/phases/45-agent-revision/45-RESEARCH.md

<interfaces>
<!-- The onInspect threading precedent to mirror for onRevise (optional prop, forwarded unmodified). -->
Galley.tsx:121 onInspect?: (sectionId: string) => void                     // thread onRevise beside it
GallerySection.tsx:73 onInspect?: (sectionId: string) => void
GallerySection.tsx:122-129 block renderers ({children}) — add `value` param, stamp data-block-index

<!-- Selection capture inputs. -->
lib/blockIndexFromKey.ts::blockIndexFromKey(key) -> number|null            // 45-01
section DOM anchor: <section id={`galley-${sectionId}`}>                    // GallerySection.tsx:169

<!-- Kit to mount (45-04). -->
components/revision/RevisionFlow.tsx RevisionFlow({runId, passage:{sectionName, quotedText, blockIndexHint?}, onApplied, onClose})

<!-- Reserved→live flip. -->
InspectorFooter.tsx:46 ASK_TO_REVISE_TITLE (remove the reserved path); :121-125 the reserved button
InspectorPanel.tsx renders <InspectorFooter promptKey agentKey runId /> — thread onAskToRevise down

<!-- Existing per-surface Galley mounts to extend. -->
ReviewDeskRunView.tsx:459 <Galley ... onInspect={handleInspect} includeAxes={FACTUAL_AXES} />
VoicePassRunView.tsx:241 <Galley ... />   (Voice, VOICE_AXES)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Stamp data-block-index, thread onRevise, build PassageToolbar</name>
  <requirements>REV-01</requirements>
  <read_first>
    - apps/dispatch-control/components/galley/GallerySection.tsx (full) — block renderers to stamp + the onInspect prop threading to mirror for onRevise.
    - apps/dispatch-control/components/galley/Galley.tsx:107-183,318-364 — the onInspect prop shape + how it forwards to every GallerySection (mirror for onRevise).
    - apps/dispatch-control/components/inspector/InspectorFooter.tsx:50-87 — reserved disabled-with-title button classes for the Compare/Restore reserved controls.
    - apps/dispatch-control/lib/blockIndexFromKey.ts (45-01) — the parse helper.
    - apps/dispatch-control/__tests__/PassageToolbar.test.tsx — the it.todo stub to convert.
  </read_first>
  <behavior>
    - PassageToolbar renders nothing when there is no active selection
    - On a text selection inside a block it renders exactly six action buttons in REV-01 order
    - Edit text / Ask agent to revise / Related facts & sources / Inspect how this was made are LIVE (fire their callbacks)
    - Compare with previous / Restore previous are disabled and carry an explanatory title
    - Ask agent to revise fires onRevise({sectionName, quotedText, blockIndexHint})
  </behavior>
  <files>apps/dispatch-control/components/galley/GallerySection.tsx, apps/dispatch-control/components/galley/Galley.tsx, apps/dispatch-control/components/galley/PassageToolbar.tsx, apps/dispatch-control/__tests__/PassageToolbar.test.tsx</files>
  <action>
`GallerySection.tsx`: in the memoized `components.block` renderers (normal/h2/h3/blockquote), accept
`value` and stamp `data-block-index={blockIndexFromKey(value._key)}` on the rendered element (import
`blockIndexFromKey`). Add an optional `onRevise?: (passage:{sectionId:string; blockIndex:number; quotedText:string}) => void`
prop to `GallerySectionProps` (forwarded to the toolbar by the surface, not consumed here beyond
threading — actually the selection capture lives in PassageToolbar, so GallerySection only needs the
`data-block-index` stamp; thread `onRevise` through Galley→surface, NOT into GallerySection if the
toolbar mounts at the Galley/surface level — choose the Galley-level mount below).

`Galley.tsx`: add an optional `onRevise?: (passage:{sectionId:string; blockIndex:number; quotedText:string}) => void`
prop to `GalleyProps` (mirror `onInspect`'s optional-prop doc-comment + skip-when-undefined
semantics). Render a single `<PassageToolbar containerRef={containerRef} onRevise={onRevise} onEditText={...} onRelatedFacts={...} onInspect={onInspect} />` INSIDE the `galley-root` div (the toolbar reads selections within `containerRef`). When `onRevise` is undefined, the toolbar still renders the non-revise actions or is a no-op — keep existing callers (Approval, etc.) unaffected.

`PassageToolbar.tsx` (NEW): export `PassageToolbar({ containerRef, onRevise, onEditText, onRelatedFacts, onInspect })`. Internally:
- Attach a `mouseup`/`selectionchange` listener (cleaned up on unmount) that reads `window.getSelection()`; when the selection is non-empty AND its anchor node is inside `containerRef.current`, resolve the block via `anchorNode.parentElement?.closest('[data-block-index]')` → `data-block-index` number, and the section via `.closest('[id^="galley-"]')` → strip the `galley-` prefix for `sectionId`. Store `{sectionId, blockIndex, quotedText: selection.toString()}` + a screen position; clear on empty selection.
- Render nothing when there is no active selection. Otherwise render a floating toolbar (absolute-positioned near the selection) with SIX buttons in REV-01 order:
  1. Edit text → `onEditText?.(sel)` (LIVE)
  2. Ask agent to revise → `onRevise?.(passageFromSel)` where `passageFromSel = {sectionName: sel.sectionId, quotedText: sel.quotedText, blockIndexHint: sel.blockIndex}` (LIVE)
  3. Compare with previous → RESERVED: `disabled title="Version history for passages arrives later — this reads the revision lineage, not yet wired."`
  4. Restore previous → RESERVED: `disabled title="Restoring a prior passage version is not yet wired — content version history is deferred."`
  5. Related facts & sources → `onRelatedFacts?.(sel)` (LIVE)
  6. Inspect how this was made → `onInspect?.(sel.sectionId)` (LIVE)
Use the InspectorFooter reserved/live button classes for visual consistency.
Convert the Wave-0 `PassageToolbar.test.tsx` it.todo entries into real assertions for every
`<behavior>` case (render inside a container with `data-block-index` blocks; simulate a selection via
a mocked `window.getSelection`).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/PassageToolbar.test.tsx __tests__/blockIndexFromKey.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `components/galley/GallerySection.tsx` contains `data-block-index` stamped from `blockIndexFromKey(value._key)` on the block renderers.
    - `components/galley/PassageToolbar.tsx` exports `PassageToolbar`, renders six actions, and the "Ask agent to revise" button calls `onRevise`; Compare/Restore are `disabled` with a `title`.
    - `Galley.tsx` declares an optional `onRevise?` prop and mounts `<PassageToolbar>`.
    - `cd apps/dispatch-control && npx vitest run __tests__/PassageToolbar.test.tsx` exits 0 (six actions; Compare/Restore reserved; onRevise fires).
  </acceptance_criteria>
  <done>Blocks carry data-block-index; the galley mounts a six-action selection toolbar (Compare/Restore reserved-with-title); onRevise is threaded and fires with the selected passage.</done>
</task>

<task type="auto">
  <name>Task 2: Wire toolbar + RevisionFlow into Draft (ReviewDeskRunView) and Voice (VoicePassRunView)</name>
  <requirements>REV-01, REV-04</requirements>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx:440-480 — the `<Galley ... onInspect={handleInspect} reloadDraft={reloadDraft} />` mount + existing `handleEditSection`/`handleInspect` handlers to reuse for the toolbar's Edit text / Inspect actions.
    - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx:230-250 — the Voice `<Galley>` mount to extend identically.
    - components/revision/RevisionFlow.tsx (45-04) — the container to mount when Ask agent to revise fires.
    - components/galley/ClaimMark.tsx:190-205 + components/provenance/ClaimProvenanceCard.tsx — the shared provenance card the "Related facts & sources" action surfaces.
  </read_first>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx, apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx</files>
  <action>
In BOTH `ReviewDeskRunView` and `VoicePassRunView`:
- Add `const [revisePassage, setRevisePassage] = useState<{sectionName:string; quotedText:string; blockIndexHint?:number} | null>(null)`.
- Pass `onRevise={setRevisePassage}` to the `<Galley>` mount (alongside the existing `onInspect`/`reloadDraft`).
- When `revisePassage` is set, render `<RevisionFlow runId={runId} passage={revisePassage} onApplied={reloadDraft} onClose={() => setRevisePassage(null)} />` (in a panel/overlay next to the galley). `onApplied={reloadDraft}` re-fetches the draft so the applied text + reset claims + revoked sign-off surface immediately (the Voice surface's own subscription flips it back to "Review needed").
- Wire the toolbar's `onEditText` to the existing `handleEditSection(sectionId)` and `onInspect` to the existing `handleInspect(sectionId)` (both already present for the galley). Wire `onRelatedFacts` to surface the shared `ClaimProvenanceCard` for a tracked claim intersecting the selected block; when no tracked claim intersects, render an honest "No tracked claims in this passage." (reuse the section's already-resolved claim rows — do not add a new subscription).
Do NOT change axis scoping (`FACTUAL_AXES` in Draft, `VOICE_AXES` in Voice) or any other Galley prop.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx eslint "app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx" "app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx" && npm run build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - Both `ReviewDeskRunView.tsx` and `VoicePassRunView.tsx` pass `onRevise` to `<Galley>` and conditionally render `<RevisionFlow>` with `onApplied={reloadDraft}`.
    - `grep -q "RevisionFlow" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx"` and the same for VoicePassRunView.
    - `npx eslint` on both files passes; `npm run build` succeeds (strict Next build — catches the Vercel/Linux-only failures memory flags).
  </acceptance_criteria>
  <done>Selecting a passage in Draft or Voice opens the revision flow; applying reloads the draft, surfacing the reset claims and revoked Voice sign-off.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Flip InspectorFooter "Ask agent to revise" from RESERVED to LIVE</name>
  <requirements>REV-01</requirements>
  <read_first>
    - apps/dispatch-control/components/inspector/InspectorFooter.tsx (full) — `ASK_TO_REVISE_TITLE` + the reserved `FooterAction` for "Ask agent to revise" to convert; the LIVE `FooterAction` shape (a callback/href) to follow.
    - apps/dispatch-control/components/inspector/InspectorPanel.tsx — where `<InspectorFooter ... />` is rendered; thread an `onAskToRevise` prop from the panel/container so the footer button invokes it.
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md §6 — the Phase-49 role-gate note (structure the control for a later `🔒 editor only` wrap; do NOT hide or gate it now).
  </read_first>
  <behavior>
    - InspectorFooter no longer renders the ASK_TO_REVISE_TITLE reserved/disabled path for "Ask agent to revise"
    - When onAskToRevise is provided, "Ask agent to revise" is a live (enabled) button that calls it
    - The other five footer actions are unchanged
  </behavior>
  <files>apps/dispatch-control/components/inspector/InspectorFooter.tsx, apps/dispatch-control/components/inspector/InspectorPanel.tsx</files>
  <action>
In `InspectorFooter.tsx`: add an optional `onAskToRevise?: () => void` to `InspectorFooterProps`.
Support a live-onClick variant in `FooterAction` (accept an optional `onClick` that renders an
enabled `<button onClick=...>` — alongside the existing href/disabled variants). Change the "Ask
agent to revise" action from the RESERVED disabled-with-`ASK_TO_REVISE_TITLE` button to a LIVE button
that calls `onAskToRevise` when provided (fall back to the reserved rendering ONLY if the prop is
omitted, so surfaces that don't wire it stay honest). Remove the now-unused `ASK_TO_REVISE_TITLE`
constant once the live path is the default for wired callers. Leave "Restart from this step" reserved
(unchanged — §44.7). Do NOT add role-gating (Phase 49) — just structure `onAskToRevise` so a later
phase can wrap it.

In `InspectorPanel.tsx` (or the footer's parent container): thread an `onAskToRevise` down to
`<InspectorFooter>` that, when the artifact is a drafted section, opens the revision flow scoped to
that artifact's section (the container may reuse the same `setRevisePassage(...)` state the surface
owns, seeded with the artifact's `sectionName` and an empty `quotedText` so the operator then selects
the passage). Keep the exact seeding a small, honest wiring — the requirement is that the button is
LIVE and invokes the callback.

Update `InspectorFooter`'s existing test (or the panel test) so the "Ask agent to revise" button is
asserted LIVE (enabled, calls the callback) and the `ASK_TO_REVISE_TITLE` reserved path is gone.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && grep -q "ASK_TO_REVISE_TITLE" components/inspector/InspectorFooter.tsx && echo "STILL-RESERVED-FAIL" || echo OK ; npx vitest run __tests__/ 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `components/inspector/InspectorFooter.tsx` no longer contains `ASK_TO_REVISE_TITLE` (the reserved disabled path for revise is removed).
    - `InspectorFooter` accepts `onAskToRevise` and renders "Ask agent to revise" as a live button calling it.
    - Full console vitest (`npm run test`) stays green; the inspector footer/panel test asserts the live button.
  </acceptance_criteria>
  <done>The inspector footer's "Ask agent to revise" is live and opens the revision flow; the reserved ASK_TO_REVISE_TITLE path is gone; "Restart from this step" stays reserved.</done>
</task>

</tasks>

<verification>
- `npx vitest run __tests__/PassageToolbar.test.tsx` green (six actions, Compare/Restore reserved).
- `npm run build` succeeds (strict Next build).
- Full console vitest green; EDT-05 tripwire green.
</verification>

<success_criteria>
Selecting a passage in Draft and Voice surfaces the six-action toolbar (Compare/Restore reserved-
with-title); "Ask agent to revise" opens the RevisionFlow scoped to the passage and reloads the draft
on apply; the inspector footer's revise button is live.
</success_criteria>

<output>
After completion, create `.planning/phases/45-agent-revision/45-05-SUMMARY.md`.
</output>
