---
phase: 45-agent-revision
plan: 05
subsystem: ui
tags: [react, nextjs, galley, revision, portable-text, convex]

# Dependency graph
requires:
  - phase: 45-agent-revision (45-01)
    provides: blockIndexFromKey helper + Wave-0 test stubs
  - phase: 45-agent-revision (45-04)
    provides: RevisionFlow container (chips -> preview -> comparison card -> apply)
provides:
  - "data-block-index stamped on every rendered galley block (blockIndexFromKey)"
  - "PassageToolbar: a 6-action floating selection toolbar (Edit text / Ask agent to revise / Related facts & sources / Inspect how this was made LIVE; Compare with previous / Restore previous reserved-with-title)"
  - "Galley.tsx onRevise/onRelatedFacts props mounting PassageToolbar"
  - "ReviewDeskRunView + VoicePassRunView wired to a shared revisePassage/requestRevision/clearRevisePassage channel on InspectorProvider, rendering RevisionFlow on request with onApplied=reloadDraft"
  - "InspectorFooter 'Ask agent to revise' flipped from Always RESERVED to conditionally LIVE (onAskToRevise)"
  - "firstProseExcerpt(blocks): derives a real, non-empty, contiguous verbatim excerpt for span resolution"
  - "InspectorContainer wires real sectionBlocks/sectionName/onRequestRevision end-to-end from agent_run_payloads.outputSnapshot, so the inspector footer opens the SAME RevisionFlow as the galley toolbar"
affects: [45-07-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Selection-to-passage resolution via DOM data-block-index + closest() ancestor lookup (no new state store)"
    - "One shared cross-surface request channel (InspectorProvider's revisePassage/requestRevision/clearRevisePassage) bridging a globally-mounted panel (InspectorContainer) and a per-route surface that owns the actual mutation/reload (ReviewDeskRunView/VoicePassRunView)"
    - "Best-effort defensive JSON.parse of a truncated agent_run_payloads.outputSnapshot (mirrors the existing extractBonusType pattern) — honest undefined on truncation/malformed JSON, never a guess or a crash"

key-files:
  created:
    - apps/dispatch-control/components/galley/PassageToolbar.tsx
    - apps/dispatch-control/lib/firstProseExcerpt.ts
    - apps/dispatch-control/__tests__/firstProseExcerpt.test.ts
  modified:
    - apps/dispatch-control/components/galley/GallerySection.tsx
    - apps/dispatch-control/components/galley/Galley.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
    - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx
    - apps/dispatch-control/components/inspector/InspectorProvider.tsx
    - apps/dispatch-control/components/inspector/InspectorFooter.tsx
    - apps/dispatch-control/components/inspector/InspectorPanel.tsx
    - apps/dispatch-control/components/inspector/InspectorContainer.tsx
    - apps/dispatch-control/__tests__/PassageToolbar.test.tsx
    - apps/dispatch-control/__tests__/InspectorPanel.test.tsx
    - apps/dispatch-control/__tests__/InspectorProvider.test.tsx

key-decisions:
  - "InspectorPanel derives quotedText via firstProseExcerpt(sectionBlocks) and only wires onAskToRevise down to InspectorFooter when a sectionName AND a non-empty excerpt are both derivable — never seeds an empty quotedText (would 409 span_not_resolved the instant a direction chip is picked, since RevisionFlow has no passage-picker step)"
  - "RevisionFlow is mounted ONLY by the surface that owns reloadDraft (ReviewDeskRunView/VoicePassRunView) — InspectorPanel/InspectorContainer never mount it themselves; they call the shared requestRevision(passage) on InspectorProvider's context, and whichever surface is active picks up revisePassage and renders its own already-wired RevisionFlow"
  - "Extended InspectorContainer.tsx (outside this plan's originally-declared file list) to actually supply real sectionBlocks/sectionName/onRequestRevision from the SAME agent_run_payloads.outputSnapshot it already reads — without this, the inspector footer's onAskToRevise would always be undefined in production and the button would stay permanently reserved, contradicting this plan's own D-18 requirement that it be a real entry point, not a dead button (Rule 2 — auto-add missing critical functionality)"

patterns-established:
  - "Cross-surface shared-flow request channel: a context that carries only the REQUEST (revisePassage), never the flow component itself, so multiple independent mount points (a globally-mounted panel + a per-route page) can trigger the exact same flow instance without either owning the other"

requirements-completed: [REV-01, REV-04]

# Metrics
duration: 200min
completed: 2026-07-16
---

# Phase 45 Plan 05: Passage Toolbar + Surface Wiring Summary

**A 6-action passage-selection toolbar (data-block-index stamped galley blocks) plus a live InspectorFooter "Ask agent to revise" entry point, both routing into the shared 45-04 RevisionFlow via one cross-surface request channel.**

## Performance

- **Duration:** ~200 min (spans a mid-plan restart after a transient network error; Tasks 1-2 by a prior executor, Task 3 finished and committed by this continuation)
- **Started:** 2026-07-15T19:31:25-07:00 (Task 1 commit)
- **Completed:** 2026-07-16T05:51:44Z
- **Tasks:** 3 (all complete)
- **Files modified:** 11 (3 created, 8 modified) across the full plan

## Accomplishments

- Every rendered galley block now carries `data-block-index` (via the 45-01 `blockIndexFromKey` helper), so an arbitrary window text selection resolves back to its block/section.
- `PassageToolbar` renders the full REV-01 six-action set on selection: Edit text / Ask agent to revise / Related facts & sources / Inspect how this was made are live; Compare with previous / Restore previous render reserved-with-title (D-17, no content-version-history endpoint exists).
- Both Draft (`ReviewDeskRunView`) and Voice (`VoicePassRunView`) wire the toolbar's `onRevise`/`onRelatedFacts` and mount the shared `RevisionFlow`, reloading the draft on apply so reset claims and revoked Voice sign-off surface immediately.
- The Phase-44 `InspectorFooter`'s "Ask agent to revise" flips from Always RESERVED to conditionally LIVE: `InspectorPanel` derives a real, non-empty `quotedText` via the new `firstProseExcerpt` helper and only exposes the live button when a real passage is derivable.
- `InspectorContainer` was extended to actually supply that real passage end-to-end (best-effort extraction from `agent_run_payloads.outputSnapshot`, the same data it already reads, plus the existing `qaSectionToGalleyId` mapping) and to route the click through the SAME `InspectorProvider.requestRevision` channel the galley toolbar uses — so both entry points open the identical `RevisionFlow` instance (D-18's "one component, every surface").

## Task Commits

Each task was committed atomically:

1. **Task 1: Stamp data-block-index, thread onRevise, build PassageToolbar** - `60d2961` (feat)
2. **Task 2: Wire toolbar + RevisionFlow into Draft (ReviewDeskRunView) and Voice (VoicePassRunView)** - `9112a59` (feat)
3. **Task 3: Flip InspectorFooter "Ask agent to revise" from RESERVED to LIVE** - `b845f21` (feat)

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `apps/dispatch-control/components/galley/PassageToolbar.tsx` - the 6-action floating selection toolbar
- `apps/dispatch-control/components/galley/GallerySection.tsx` - stamps `data-block-index` on every block renderer
- `apps/dispatch-control/components/galley/Galley.tsx` - mounts `PassageToolbar`, threads `onRevise`/`onRelatedFacts`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx` - wires the toolbar + `RevisionFlow` for Draft
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/VoicePassRunView.tsx` - wires the toolbar + `RevisionFlow` for Voice
- `apps/dispatch-control/components/inspector/InspectorProvider.tsx` - adds the shared `revisePassage`/`requestRevision`/`clearRevisePassage` channel
- `apps/dispatch-control/components/inspector/InspectorFooter.tsx` - live-onClick `FooterAction` variant; "Ask agent to revise" live when `onAskToRevise` provided
- `apps/dispatch-control/components/inspector/InspectorPanel.tsx` - derives `quotedText` via `firstProseExcerpt`, wires `onAskToRevise` to `onRequestRevision`
- `apps/dispatch-control/components/inspector/InspectorContainer.tsx` - extracts real `sectionBlocks`/`sectionName` from `outputSnapshot`, supplies `onRequestRevision={requestRevision}`
- `apps/dispatch-control/lib/firstProseExcerpt.ts` - pure helper: leading verbatim excerpt of the first non-empty prose block
- `apps/dispatch-control/__tests__/PassageToolbar.test.tsx` / `firstProseExcerpt.test.ts` / `InspectorPanel.test.tsx` / `InspectorProvider.test.tsx` - coverage for all of the above

## Decisions Made

- **RevisionFlow mount ownership stays with the Draft/Voice surface, not the inspector.** InspectorPanel/InspectorContainer never render `<RevisionFlow>` themselves — they call the shared `requestRevision(passage)`, and whichever surface (Draft or Voice) is currently mounted picks up `revisePassage` from `InspectorProvider`'s context and renders its own already-wired flow (this was already anticipated by the Task 2 commit's comment: "Rendered regardless of viewMode so an inspector-footer-triggered request is never silently dropped").
- **Never seed an empty `quotedText`.** `firstProseExcerpt` returns `''` for any artifact with no prose (claim/rec/org/signal/qa, an empty section, or unresolved queries); `InspectorPanel` treats that as "no revisable passage" and keeps the footer reserved rather than wiring a button that would 409 `span_not_resolved` on the first click.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical Functionality] Wired InspectorContainer.tsx to supply real sectionBlocks/sectionName/onRequestRevision**
- **Found during:** Task 3 (finishing the inspector-footer live wiring)
- **Issue:** The plan's Task 3 `<files>` list scoped this task to `InspectorFooter.tsx` / `InspectorPanel.tsx` / `firstProseExcerpt.ts` only. `InspectorPanel` already declared the `sectionBlocks`/`sectionName`/`onRequestRevision` props and derived `onAskToRevise` correctly, but `InspectorContainer.tsx` (the only caller that mounts `InspectorPanel` in production) never supplied them. Left as-is, the inspector footer's "Ask agent to revise" would be permanently reserved in production — a dead button — directly contradicting this plan's own must-have truth ("it is a real entry point not a dead button", D-18).
- **Fix:** Added a defensive, best-effort extraction of the section's raw prose `body` blocks from the SAME `agent_run_payloads.outputSnapshot` `InspectorContainer` already reads (mirrors the existing `extractBonusType` JSON.parse pattern — never throws, honest `undefined` on truncated/malformed JSON or a non-drafted-section artifact), mapped the agentKey to its galley section id via the existing `qaSectionToGalleyId` helper, and passed `onRequestRevision={requestRevision}` from `useInspector()` (available since `InspectorContainer` is always rendered inside `InspectorProvider`).
- **Files modified:** `apps/dispatch-control/components/inspector/InspectorContainer.tsx`
- **Verification:** Full `npx vitest run` suite green (884 passed, 2 todo, 1 skipped); `npm run build` (strict Next.js build) succeeds.
- **Committed in:** `b845f21` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (missing critical functionality — completes the plan's own D-18 requirement)
**Impact on plan:** Necessary for the plan's stated success criteria to hold end-to-end in production. No scope creep beyond closing this specific gap — no new endpoints, no new data source, no new subscription.

## Issues Encountered

- A prior executor's session died mid-Task-3 on a transient network error (ECONNRESET) after Tasks 1-2 were already committed. This continuation verified those commits were intact (`60d2961`, `9112a59`), found `firstProseExcerpt.ts`/`InspectorFooter.tsx` already correctly complete from the prior session's uncommitted work, and finished the remaining `InspectorPanel.tsx` wiring + the `InspectorContainer.tsx` gap described above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- REV-01 and REV-04 are fully delivered: the passage toolbar and the inspector footer both open the same `RevisionFlow` instance in Draft and Voice.
- 45-07 (integration gate) can now exercise the full Annotations header demo leg (select the founder phrase in Draft/Voice → Ask agent to revise → apply → Voice Pass returns to "Review needed") plus the inspector-footer entry point, since both are live.
- No blockers identified for 45-06 (already summarized) or 45-07.

---
*Phase: 45-agent-revision*
*Completed: 2026-07-16*

## Self-Check: PASSED

All created files and all 3 task commits (60d2961, 9112a59, b845f21) verified present.
