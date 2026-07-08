---
phase: 33-accept-fix-wiring-decision-rail
plan: 04
type: execute
wave: 3
depends_on: [33-01, 33-02, 33-03]
files_modified:
  - apps/dispatch-control/lib/findingsClient.ts
  - apps/dispatch-control/lib/galley/findingState.ts
  - apps/dispatch-control/lib/galley/spanResolver.ts
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx
  - apps/dispatch-control/__tests__/findingsClient.test.ts
  - apps/dispatch-control/__tests__/AnnotationMark.test.tsx
  - apps/dispatch-control/__tests__/Galley.test.tsx
  - apps/dispatch-control/__tests__/UnresolvedFindingCard.test.tsx
autonomous: true
requirements: [GLY-03, EDT-04, EDT-06]

must_haves:
  truths:
    - "Clicking an annotation shows Accept fix / Edit inline / Dismiss actions in the popover"
    - "Accept is hidden/disabled when suggestedFix is absent or the finding is orphaned; the popover states why"
    - "Dismiss requires a one-line reason before it will submit"
    - "Edit inline flips the page into the section editor scrolled to the finding's section with the reason visible"
    - "After a successful accept (or a revision_mismatch 409), the draft refetches so re-resolution runs against fresh text"
    - "Dismissed and accepted findings disappear from galley spans and the section-end unresolved cards"
  artifacts:
    - path: "apps/dispatch-control/lib/findingsClient.ts"
      provides: "acceptFinding/dismissFinding/reopenFinding with typed error branching"
      contains: "acceptFinding"
    - path: "apps/dispatch-control/lib/galley/findingState.ts"
      provides: "shared isOpenFinding helper used by all three surfaces"
      contains: "isOpenFinding"
  key_links:
    - from: "apps/dispatch-control/.../AnnotationMark.tsx"
      to: "apps/dispatch-control/lib/findingsClient.ts"
      via: "Accept/Dismiss action handlers"
      pattern: "acceptFinding|dismissFinding"
    - from: "apps/dispatch-control/.../page.tsx"
      to: "reloadDraft"
      via: "refetch after accept / on revision_mismatch"
      pattern: "reloadDraft"
---

<objective>
Wire the operator's action surface: a findings client mirroring `contentPatchClient.ts`, an Accept/Edit/Dismiss action row in the Phase 32 popover placeholder (GLY-03), Dismiss + Edit-inline actions on the section-end unresolved card (D-11), the Edit-inline deep-link into the Phase 31 section editor (D-08), and the draft-refetch plumbing that makes re-resolution run against fresh text after an accept (EDT-06, Pitfall 1). Extend the open-finding filter to hide dismissed findings via one shared helper (Pitfall 9).

Purpose: This is the "act on a finding from the galley" experience — everything the operator clicks flows through the pipeline API (D-02), the galley stays a pure to-do surface, and nothing is silently dropped.
Output: New client + shared helper + popover/card actions + editor deep-link + draft-refetch callback threaded down, all tested.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md
@.planning/phases/33-accept-fix-wiring-decision-rail/33-RESEARCH.md
@docs/API_CONTRACTS.md
@docs/design/dispatch-control-v2/README.md

<interfaces>
<!-- Existing client + component shapes to mirror/extend. -->
From apps/dispatch-control/lib/contentPatchClient.ts (the client to mirror EXACTLY — private pipelineBaseUrl() copy, ContentPatchError with {status, reason, message}):
```typescript
function pipelineBaseUrl(): string   // reads NEXT_PUBLIC_PIPELINE_URL, throws if unset
export class ContentPatchError extends Error { status; reason; message }
export interface PatchResult { revisionId: string }
export async function patchSection(runId, sectionId, payload:{ifRevisionID}, token): Promise<PatchResult>
export interface DraftResponse { revisionId: string; sections: Record<...>; bonusType; bonus; ... }
```
From AnnotationMark.tsx (Phase 32 — the placeholder comment `{/* Phase 33 (EDT-04): Accept/Edit/Dismiss action row mounts here */}` at line ~102 marks the mount point; popover uses ONLY <span display:block> phrasing content — Pitfall 5: no <div>/<form>/<p>):
```typescript
export interface AnnotationMarkDef { findingId; severity; axis?; reason; suggestedFix?; quotedSpan? }
```
From page.tsx: `const [draft,setDraft]=useState(...)`; the load useEffect (lines 173-200) calls `getDraft(runId, token)`; `openFindings = rawFindings.filter(row => row.accepted !== true)` (line 224); `viewMode`/`selectedSection` state drive galley|edit|iframe; `<Galley runId draft />` and `<SectionEditorPanel runId selectedSection draft onDirtyChange />`.
From Galley.tsx: `openFindings = rawFindings.filter(row => row.accepted !== true)` (line 65); passes resolved/unresolved into `<GallerySection>`.
From UnresolvedFindingCard.tsx: pure presentational, prints reason + quotedSpan + suggestedFix (no actions yet).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: findingsClient.ts + shared isOpenFinding helper</name>
  <read_first>
    - apps/dispatch-control/lib/contentPatchClient.ts (mirror the private pipelineBaseUrl(), ContentPatchError shape, fetch+Bearer+typed-error pattern EXACTLY — each client keeps its own copy per the header-comment precedent)
    - apps/dispatch-control/lib/galley/spanResolver.ts (the QaFinding interface gains optional `resolution`)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (QaCorrectionRow interface + the `accepted !== true` filter at L224 that isOpenFinding replaces)
    - docs/API_CONTRACTS.md §33.3 (endpoint paths, bodies, return shapes, 409 reasons)
  </read_first>
  <behavior>
    - acceptFinding POSTs to /issues/{runId}/findings/{findingId}/accept with {ifRevisionID}; returns {revisionId}; a 409 body {reason:"revision_mismatch"} surfaces as a FindingsError with .reason==='revision_mismatch'; {reason:"span_not_resolved"} surfaces .reason==='span_not_resolved'.
    - dismissFinding POSTs {reason} to /dismiss; a 422 surfaces as an error.
    - reopenFinding POSTs to /reopen (no body).
    - isOpenFinding(row) returns true only when row.accepted !== true AND row.resolution == null.
  </behavior>
  <action>
Create `apps/dispatch-control/lib/findingsClient.ts` mirroring `contentPatchClient.ts`: a private `pipelineBaseUrl()` copy, a `FindingsError extends Error` carrying `{ status: number; reason?: string; message: string }`, and three functions:
- `acceptFinding(runId, findingId, payload: { ifRevisionID: string }, token: string | null): Promise<{ revisionId: string }>` — POST `/issues/{runId}/findings/{findingId}/accept`.
- `dismissFinding(runId, findingId, payload: { reason: string }, token: string | null): Promise<{ findingId: string }>` — POST `/issues/{runId}/findings/{findingId}/dismiss`.
- `reopenFinding(runId, findingId, token: string | null): Promise<{ findingId: string }>` — POST `/issues/{runId}/findings/{findingId}/reopen`.
On a non-OK response, parse the JSON body and throw `FindingsError` with `reason` pulled from `body.detail?.reason` (matching the FastAPI 409 `{detail:{reason,message}}` shape — read how reviewClient.ts/contentPatchClient.ts unwrap `detail`). Include the Clerk Bearer token header exactly like contentPatchClient.

Create `apps/dispatch-control/lib/galley/findingState.ts` exporting `export function isOpenFinding(row: { accepted?: boolean; resolution?: 'accepted' | 'dismissed' | null }): boolean { return row.accepted !== true && row.resolution == null }`. Add optional `resolution?: 'accepted' | 'dismissed'` to the `QaFinding` interface in `spanResolver.ts` (the resolver already skips `accepted===true`; leave that untouched).

Create `apps/dispatch-control/__tests__/findingsClient.test.ts` mocking `fetch` (and NEXT_PUBLIC_PIPELINE_URL) to assert the behaviors above — especially the `.reason` branching for `revision_mismatch` vs `span_not_resolved`, and `isOpenFinding` truth table (open / accepted / dismissed).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test:unit __tests__/findingsClient.test.ts -- --run</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter dispatch-control test:unit __tests__/findingsClient.test.ts -- --run` exits 0
    - `grep -c "export async function \(accept\|dismiss\|reopen\)Finding" apps/dispatch-control/lib/findingsClient.ts` returns 3
    - `grep -q "export function isOpenFinding" apps/dispatch-control/lib/galley/findingState.ts` succeeds
    - findingsClient.test.ts asserts `.reason === 'revision_mismatch'` on a 409 and a distinct `.reason === 'span_not_resolved'` branch
    - `grep -q "resolution" apps/dispatch-control/lib/galley/spanResolver.ts` succeeds (QaFinding gained the optional field)
  </acceptance_criteria>
  <done>The findings client posts to all three endpoints with typed reason branching, and a single shared isOpenFinding helper exists for the galley/chip/rail surfaces to share.</done>
</task>

<task type="auto">
  <name>Task 2: page.tsx plumbing — reloadDraft, open-finding filter, edit-inline deep-link, prop threading</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (the FULL file — extract reloadDraft, swap the L224 filter, add onEditSection, thread callbacks into <Galley>)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx (swap the L65 filter to isOpenFinding; accept + forward action callbacks to GallerySection)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/GallerySection.tsx (how it renders AnnotationMark via @portabletext/react and the UnresolvedFindingCard — the callbacks pass through here)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx (props: runId, selectedSection, draft, onDirtyChange — add an optional finding-context banner + scroll)
    - apps/dispatch-control/lib/galley/findingState.ts (isOpenFinding from Task 1)
  </read_first>
  <action>
In `page.tsx`:
- Extract the draft loader from the mount `useEffect` (lines 173-200) into a stable `reloadDraft` callback (useCallback over `[runId, getToken]`) that re-runs `getDraft(runId, token)` and `setDraft(result)`; keep the mount effect calling it. Pass `reloadDraft` down to `<Galley>`.
- Replace `const openFindings = rawFindings.filter(row => row.accepted !== true)` (L224) with `rawFindings.filter(isOpenFinding)` (import from `@/lib/galley/findingState`), so dismissed findings drop from chip counts too (Pitfall 9). Add optional `resolution?: 'accepted' | 'dismissed'` to the local `QaCorrectionRow` interface and to the object pushed into `findingsByGalleyId` (~L232).
- Add an `onEditSection(sectionId: string, findingId?: string)` handler that sets `selectedSection = qaGalleyId→editable section id` (the galley section id already maps to EDITABLE_SECTIONS ids), sets `viewMode='edit'`, and stores the target finding in a new `editFinding` state (`{ sectionId, findingId } | null`) so the editor can show the finding's reason (D-08). Guard the unsaved-edit switch the same way `handleChipSelect` does. Pass `onEditSection` to `<Galley>`.
- Pass the current `draft.revisionId` down to `<Galley>` (the popover's accept needs `ifRevisionID`).
- Pass `editFinding` and the resolved finding reason to `<SectionEditorPanel>` as new optional props.

In `Galley.tsx`: swap the L65 `accepted !== true` filter to `isOpenFinding` (import it), accept new props `reloadDraft: () => Promise<void> | void`, `revisionId: string`, `onEditSection: (sectionId, findingId?) => void`, and forward them plus per-finding context down into each `<GallerySection>`.

In `GallerySection.tsx`: forward `runId`, `revisionId`, `reloadDraft`, and `onEditSection` into each rendered `AnnotationMark` (via the @portabletext/react `components.marks.annotation` — you may need to close over these via the components object built in this component) and into each `UnresolvedFindingCard`.

In `SectionEditorPanel.tsx`: add optional props `focusFindingId?: string` and `findingReason?: string`; when present, render a small non-intrusive banner above the editor showing the finding's reason (so Andrew edits with the finding in view — D-08), and scroll/focus toward the relevant block if the existing structure allows (best-effort; a visible reason banner satisfies D-08's "reason visible for reference"). Do NOT add a second editing surface — reuse this panel.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test:unit __tests__/Galley.test.tsx -- --run && pnpm --filter dispatch-control typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "reloadDraft" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` succeeds AND `grep -q "useCallback" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` succeeds
    - `grep -q "isOpenFinding" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` AND `grep -q "isOpenFinding" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx` both succeed (shared filter on both surfaces — Pitfall 9)
    - `grep -q "accepted !== true" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/Galley.tsx` returns NOTHING (old predicate fully replaced)
    - `grep -q "onEditSection" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` succeeds
    - `grep -q "focusFindingId\|findingReason" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx` succeeds
    - `pnpm --filter dispatch-control typecheck` exits 0 (prop threading type-clean — memory rule: vitest does not type-check)
  </acceptance_criteria>
  <done>page.tsx exposes reloadDraft + onEditSection, both galley surfaces filter via the shared isOpenFinding, revisionId + callbacks thread down to the marks and cards, and the section editor accepts finding context — all type-clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Accept/Edit/Dismiss action row in popover + card actions</name>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx (the placeholder comment at ~L102 marks the mount point; Pitfall 5 — the popover is inside a <p>, use ONLY <span display:block>/<button>/<input>/<textarea> phrasing content, NEVER <div>/<form>/<p>)
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard.tsx (gains Dismiss + Edit inline per D-11; no Accept)
    - apps/dispatch-control/lib/findingsClient.ts (acceptFinding/dismissFinding from Task 1)
    - .planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md (D-05/D-07/D-08/D-11 — accept gating + edit-inline + orphan actions)
    - docs/design/dispatch-control-v2/README.md §Review Desk (popover action affordances: Accept fix / Edit inline / Dismiss+reason)
  </read_first>
  <behavior>
    - The popover renders three affordances: Accept fix, Edit inline, Dismiss.
    - Accept is hidden/disabled when suggestedFix is absent (D-07); an inline note states "Accept unavailable — no suggested fix" (or "couldn't anchor this text"), still phrasing content.
    - Clicking Accept calls acceptFinding(runId, findingId, {ifRevisionID: revisionId}, token); on success calls reloadDraft(); on a revision_mismatch reason it calls reloadDraft() and shows a "draft changed — re-open and retry" note; on span_not_resolved it tells the operator to use Edit inline.
    - Dismiss reveals a one-line reason input; submit is disabled until the reason is non-empty; submitting calls dismissFinding then closes the popover.
    - Edit inline calls onEditSection(sectionId, findingId).
    - UnresolvedFindingCard shows Dismiss (with reason) + Edit inline, NO Accept (D-11).
  </behavior>
  <action>
Extend `AnnotationMark.tsx`: accept new props `runId: string`, `sectionId: string`, `revisionId: string`, `reloadDraft: () => Promise<void> | void`, `onEditSection: (sectionId: string, findingId?: string) => void`, and a `getToken` accessor (thread from the page via Galley/GallerySection, or read `useAuth().getToken()` directly inside this client component — prefer the latter to avoid deep prop drilling, matching how other client components obtain the token). At the placeholder comment (~L102), render an action row using ONLY phrasing content (Pitfall 5): a `<span style={{display:'block'}}>` container holding `<button>`s for Accept/Edit inline/Dismiss and, when Dismiss is engaged, a `<textarea>` or `<input>` for the reason plus a submit `<button>`. NO `<div>`, `<form>`, or `<p>`.
- Accept `<button>` is rendered only when `value.suggestedFix` is present (D-07); otherwise render an inline `<span display:block>` note stating Accept is unavailable and why. Accept onClick: `await acceptFinding(runId, value.findingId, { ifRevisionID: revisionId }, await getToken())`; on success `await reloadDraft()` + close; catch `FindingsError`: if `.reason==='revision_mismatch'` call `reloadDraft()` and show a retry note; if `.reason==='span_not_resolved'` show "Use Edit inline instead."; else show the message.
- Edit inline `<button>` onClick: `onEditSection(sectionId, value.findingId)`.
- Dismiss `<button>` toggles a reason input; submit disabled while the trimmed reason is empty; on submit `await dismissFinding(runId, value.findingId, { reason }, await getToken())` then close. Findings update reactively via Convex — no refetch needed for dismiss.

Extend `UnresolvedFindingCard.tsx`: accept new props `runId`, `sectionId`, `onEditSection`, and a token accessor; add Dismiss (with reason input) + Edit inline `<button>`s wired to `dismissFinding` / `onEditSection` (D-11). NO Accept button (consistent with D-07). Keep it presentational otherwise; the card container is already a `<div>` (it is NOT inside a `<p>`), so normal block elements are fine here — the phrasing-content constraint is ONLY inside AnnotationMark's in-`<p>` popover.

Create `apps/dispatch-control/__tests__/AnnotationMark.test.tsx` (jsdom) asserting: action row renders; Accept hidden when suggestedFix absent (D-07); Dismiss submit disabled until reason typed; Accept click invokes the client + reloadDraft (mock findingsClient). Extend `apps/dispatch-control/__tests__/UnresolvedFindingCard.test.tsx` for Dismiss + Edit inline presence and no-Accept.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test:unit __tests__/AnnotationMark.test.tsx __tests__/UnresolvedFindingCard.test.tsx -- --run && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter dispatch-control test:unit __tests__/AnnotationMark.test.tsx __tests__/UnresolvedFindingCard.test.tsx -- --run` exits 0
    - `grep -q "acceptFinding\|dismissFinding" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx` succeeds
    - AnnotationMark's popover action row uses NO block elements: `grep -c "<div\|<form\|<p>" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx` returns 0 (Pitfall 5 — phrasing content only)
    - `grep -q "reloadDraft" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx` succeeds (refetch after accept / on revision_mismatch — EDT-06)
    - `grep -q "onEditSection" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard.tsx` AND `grep -q "dismissFinding" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard.tsx` succeed
    - AnnotationMark.test.tsx asserts Accept is absent when suggestedFix is undefined (D-07 gating)
    - `pnpm --filter dispatch-control build` exits 0 (strict type-check — memory rule)
  </acceptance_criteria>
  <done>The popover offers Accept (gated) / Edit inline / Dismiss (reason-required) using phrasing-content-only markup, accept triggers reloadDraft, the unresolved card offers Dismiss + Edit inline, and the dashboard builds strict-clean.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test:unit __tests__/findingsClient.test.ts __tests__/AnnotationMark.test.tsx __tests__/Galley.test.tsx __tests__/UnresolvedFindingCard.test.tsx -- --run` green.
- `pnpm --filter dispatch-control typecheck && pnpm --filter dispatch-control build` both exit 0.
- `__tests__/dispatch-control-no-sanity-write.test.ts` still green (no new direct Sanity write path).
</verification>

<success_criteria>
- An operator can Accept/Edit/Dismiss a finding from the galley; accepts refetch the draft so re-resolution runs on fresh text; dismissed/accepted findings vanish from every open-finding surface via the shared helper.
</success_criteria>

<output>
After completion, create `.planning/phases/33-accept-fix-wiring-decision-rail/33-04-SUMMARY.md`
</output>
