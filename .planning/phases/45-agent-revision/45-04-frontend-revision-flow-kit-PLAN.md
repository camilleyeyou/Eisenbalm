---
phase: 45-agent-revision
plan: 04
type: execute
wave: 2
depends_on: ["45-01"]
files_modified:
  - apps/dispatch-control/lib/revisionClient.ts
  - apps/dispatch-control/components/revision/DirectionChips.tsx
  - apps/dispatch-control/components/revision/RevisionComparisonCard.tsx
  - apps/dispatch-control/components/revision/RevisionFlow.tsx
  - apps/dispatch-control/__tests__/DirectionChips.test.tsx
  - apps/dispatch-control/__tests__/RevisionComparisonCard.test.tsx
  - apps/dispatch-control/__tests__/RevisionFlow.test.tsx
autonomous: true
requirements: [REV-02, REV-03, REV-04]
must_haves:
  truths:
    - "revisionClient.ts calls the pipeline's revise/preview + revise/apply over NEXT_PUBLIC_PIPELINE_URL only (never Sanity), surfacing a typed error incl. cost_cap_exceeded"
    - "DirectionChips renders the 7 REV-02 chips in fixed copy, never a bare Regenerate, and renders disabled-with-title when cost-capped"
    - "RevisionComparisonCard shows original / proposed / what-changed / claim-delta and offers Apply / Edit before applying / Try another approach / Discard"
    - "RevisionFlow orchestrates chips → preview → card → apply, passing prior proposals as avoid-context on Try another approach and edited text on Edit before applying, obtaining a fresh ifRevisionID at apply"
  artifacts:
    - path: "apps/dispatch-control/lib/revisionClient.ts"
      provides: "previewRevision + applyRevision fetch wrappers + RevisionError"
      exports: ["previewRevision", "applyRevision", "RevisionError"]
    - path: "apps/dispatch-control/components/revision/DirectionChips.tsx"
      provides: "7 fixed-copy direction chips + custom free-text + cost-capped disabled state"
      exports: ["DirectionChips"]
    - path: "apps/dispatch-control/components/revision/RevisionComparisonCard.tsx"
      provides: "original/proposed/what-changed/claim-delta card with 4 actions"
      exports: ["RevisionComparisonCard"]
    - path: "apps/dispatch-control/components/revision/RevisionFlow.tsx"
      provides: "stateful container: passage → chips → preview → card → apply"
      exports: ["RevisionFlow"]
  key_links:
    - from: "components/revision/RevisionFlow.tsx"
      to: "lib/revisionClient.ts::previewRevision / applyRevision"
      via: "chips select → previewRevision; card Apply → applyRevision"
      pattern: "previewRevision|applyRevision"
---

<objective>
Build the surface-agnostic revision UX as one mountable kit (D-18 "one component"): a
`revisionClient.ts` that talks to the §45 pipeline endpoints, `DirectionChips` (the 7 REV-02 chips,
never "Regenerate"), `RevisionComparisonCard` (original / proposed / what-changed / claim-delta with
Apply / Edit before applying / Try another approach / Discard), and a `RevisionFlow` container that
orchestrates chips → preview → card → apply. This kit knows nothing about the galley or inspector —
45-05 mounts it.

Purpose: REV-02/REV-03/REV-04 client surface. Keeping it a self-contained kit lets 45-05 wire it
identically into Draft, Voice, and the inspector footer.
Output: revisionClient.ts, DirectionChips.tsx, RevisionComparisonCard.tsx, RevisionFlow.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@.planning/phases/45-agent-revision/45-RESEARCH.md

<interfaces>
<!-- Client pattern to clone (factCheckClient.ts + FactCheckScreen's EvidenceComparisonCard). -->
lib/factCheckClient.ts — pipelineBaseUrl()/FactCheckError/_factCheckFetch: mirror shape exactly.
FactCheckScreen.tsx:116-160 EvidenceComparisonCard — original(line-through)|proposed|what-changed|actions.
FactCheckScreen.tsx:263-294 handleAskAgent/handleConfirmEvidence — preview then fresh-ifRevisionID apply.
lib/contentPatchClient.ts::getDraft(runId, token) -> {revisionId, ...} — source of the FRESH ifRevisionID at apply.

<!-- §45 request/response shapes (locked in 45-01). -->
POST /issues/{runId}/revise/preview {sectionName, quotedText, blockIndexHint?, direction, customDirection?, priorProposals?[]}
   -> {proposedText, whatChanged, claimDelta:{added[],removed[],altered[]}}  | 409 {reason:"cost_cap_exceeded", spentUsd, projectedUsd, capUsd}
POST /issues/{runId}/revise/apply {ifRevisionID, sectionName, quotedText, blockIndexHint?, newText}
   -> {revisionId, resolution:"revision_applied"}  | 409 {reason:"revision_mismatch"|"span_not_resolved"|"claim_edit_unavailable"}

<!-- The 7 chips (identifier → display copy, §45.1). -->
make_clearer "Make clearer" · make_more_specific "Make more specific" · tighten "Tighten"
match_brief "Match the brief" · reduce_repetition "Reduce repetition" · try_another_approach "Try another approach" · custom "Custom"
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: revisionClient.ts (preview + apply + typed error)</name>
  <requirements>REV-04</requirements>
  <read_first>
    - apps/dispatch-control/lib/factCheckClient.ts (full) — clone `pipelineBaseUrl()`, the `_factCheckFetch` error-unwrap, and the module-header note "this app NEVER imports the Sanity SDK" (the EDT-05 tripwire passes by construction, RESEARCH Pitfall 7).
    - docs/API_CONTRACTS.md §45.2 — the exact request/response/409 shapes.
  </read_first>
  <files>apps/dispatch-control/lib/revisionClient.ts</files>
  <action>
Create `apps/dispatch-control/lib/revisionClient.ts` mirroring `factCheckClient.ts`:
- private `pipelineBaseUrl()` (reads `NEXT_PUBLIC_PIPELINE_URL`, throws if unset, strips trailing slash) — own private copy, matching the per-client precedent.
- `export class RevisionError extends Error { constructor(public status:number, public reason:string, message:string) }`.
- Exported types: `DirectionChip` (the 7 identifiers union), `RevisePreviewBody`, `RevisionClaimDelta {added:string[];removed:string[];altered:string[]}`, `RevisePreviewResult {proposedText:string; whatChanged:string; claimDelta:RevisionClaimDelta}`, `ReviseApplyBody`, `ReviseApplyResult {revisionId:string; resolution:string}`.
- private `_revisionFetch<T>(method, path, token, body)` — clone `_factCheckFetch`'s FastAPI-detail unwrap so a 409 surfaces `{status, reason, message}` (callers branch on `cost_cap_exceeded` / `revision_mismatch` / `span_not_resolved` / `claim_edit_unavailable`). For `cost_cap_exceeded`, also carry `spentUsd/projectedUsd/capUsd` from the detail onto the error (add optional fields to `RevisionError`).
- `export async function previewRevision(runId, body: RevisePreviewBody, token): Promise<RevisePreviewResult>` → POST `/issues/{runId}/revise/preview`.
- `export async function applyRevision(runId, body: ReviseApplyBody, token): Promise<ReviseApplyResult>` → POST `/issues/{runId}/revise/apply`.
This module must import NOTHING from `@sanity/client` and call ONLY `NEXT_PUBLIC_PIPELINE_URL`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx tsc --noEmit -p tsconfig.json 2>&1 | grep -q "revisionClient" && echo "TSC-ERROR" || echo OK ; npx vitest run __tests__/dispatch-control-no-sanity-write.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/lib/revisionClient.ts` exports `previewRevision`, `applyRevision`, `RevisionError`, and `DirectionChip`.
    - The file contains NO `@sanity/client` / `createClient(` import; `npx vitest run __tests__/dispatch-control-no-sanity-write.test.ts` stays green.
    - The file references `NEXT_PUBLIC_PIPELINE_URL`, `revise/preview`, and `revise/apply`.
  </acceptance_criteria>
  <done>The client talks only to the pipeline, exposes typed preview/apply fns, and surfaces cost_cap_exceeded / revision_mismatch / span_not_resolved as typed errors; the EDT-05 tripwire is green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: DirectionChips + RevisionComparisonCard presentational components</name>
  <requirements>REV-02, REV-03</requirements>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx:116-165 — the `EvidenceComparisonCard` layout (original line-through | proposed | what-changed | action buttons + `data-testid`) to clone in spirit.
    - apps/dispatch-control/components/inspector/InspectorFooter.tsx:56-87 — the disabled-with-`title` reserved-control pattern to reuse for cost-capped chips.
    - docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md §9 — the comparison card register + the "What changed" claim-delta sentence ("Claims: 1 altered … No claims added or removed").
    - apps/dispatch-control/__tests__/DirectionChips.test.tsx + RevisionComparisonCard.test.tsx — the Wave-0 it.todo stubs to convert.
  </read_first>
  <behavior>
    - DirectionChips renders exactly 7 buttons with copy: Make clearer / Make more specific / Tighten / Match the brief / Reduce repetition / Try another approach / Custom
    - DirectionChips never renders the text "Regenerate"
    - When costCapped prop is set, all chips are disabled and carry an explanatory title (spent/cap)
    - Selecting "Custom" reveals a free-text input and fires onSelect('custom', text)
    - RevisionComparisonCard renders original (line-through), proposed, a "What changed" line, and the claim delta (added/removed/altered)
    - RevisionComparisonCard renders 4 actions: Apply, Edit before applying, Try another approach, Discard
  </behavior>
  <files>apps/dispatch-control/components/revision/DirectionChips.tsx, apps/dispatch-control/components/revision/RevisionComparisonCard.tsx, apps/dispatch-control/__tests__/DirectionChips.test.tsx, apps/dispatch-control/__tests__/RevisionComparisonCard.test.tsx</files>
  <action>
`DirectionChips.tsx` — export `DirectionChips({ onSelect, costCapped, capInfo }: { onSelect:(d:DirectionChip, customText?:string)=>void; costCapped?: boolean; capInfo?: {spentUsd:number; capUsd:number} })`. Render the 7 chips from a `const CHIPS: {id:DirectionChip; label:string}[]` array in the §45.1 fixed copy order — NEVER a "Regenerate" chip. Clicking a chip calls `onSelect(id)`; clicking "Custom" reveals a small text input + confirm that calls `onSelect('custom', text)`. When `costCapped`, render every chip `disabled` with `title={`Revision paused — $${capInfo?.spentUsd?.toFixed(2)} of $${capInfo?.capUsd?.toFixed(2)} used`}` (reuse InspectorFooter's disabled reserved-control classes).

`RevisionComparisonCard.tsx` — export `RevisionComparisonCard({ original, preview, busy, onApply, onEdit, onTryAnother, onDiscard })` where `preview: RevisePreviewResult`. Layout (clone `EvidenceComparisonCard`): `data-testid="revision-comparison-card"`, original in a `line-through` paragraph, proposed below, a "What changed:" line rendering `preview.whatChanged`, then a claim-delta block rendering `claimDelta.added/removed/altered` (label each group; when all three are empty render "No claims added, removed, or altered."). Four action buttons: Apply / Edit before applying / Try another approach / Discard, each `disabled={busy}` and wired to the matching callback. "Edit before applying" reveals an editable textarea prefilled with `preview.proposedText` and its confirm calls `onEdit(editedText)`.

Convert the Wave-0 `DirectionChips.test.tsx` + `RevisionComparisonCard.test.tsx` it.todo entries into
real render/interaction assertions covering every `<behavior>` case (mirror `FactCheckScreen.test.tsx`
render conventions; no Convex/network needed — these are presentational).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/DirectionChips.test.tsx __tests__/RevisionComparisonCard.test.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `DirectionChips.tsx` exports `DirectionChips`; a grep of the file finds all 7 labels ("Make clearer","Make more specific","Tighten","Match the brief","Reduce repetition","Try another approach","Custom") and finds NO "Regenerate".
    - `RevisionComparisonCard.tsx` exports `RevisionComparisonCard` with `data-testid="revision-comparison-card"` and the four action labels (Apply / Edit before applying / Try another approach / Discard).
    - `cd apps/dispatch-control && npx vitest run __tests__/DirectionChips.test.tsx __tests__/RevisionComparisonCard.test.tsx` exits 0 with the it.todo stubs now real and passing.
  </acceptance_criteria>
  <done>The chips render fixed copy (never Regenerate) with a cost-capped disabled state; the card shows original/proposed/what-changed/claim-delta and the four actions; both component tests are green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: RevisionFlow container (chips → preview → card → apply)</name>
  <requirements>REV-04</requirements>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx:210-300 — the state machine to mirror: preview into local state, obtain a FRESH `ifRevisionID` via `getDraft(runId, token)` immediately before apply, error branching.
    - apps/dispatch-control/lib/contentPatchClient.ts::getDraft — the fresh-revision source.
    - lib/revisionClient.ts (Task 1) + components/revision/DirectionChips.tsx + RevisionComparisonCard.tsx (Task 2).
    - apps/dispatch-control/__tests__/RevisionFlow.test.tsx — the Wave-0 `it.todo` stub to convert into real orchestration assertions.
    - apps/dispatch-control/__tests__/FactCheckScreen.test.tsx — the `vi.mock` convention for stubbing the pipeline client (previewRevision/applyRevision) + `getDraft` in a container test.
  </read_first>
  <behavior>
    - Apply fetches a FRESH ifRevisionID via `getDraft(runId, token)` immediately before `applyRevision`, and passes it as `ifRevisionID`
    - `priorProposals` accumulates across repeated "Try another approach" (each `previewRevision` call carries the growing array as avoid-context)
    - "Edit before applying" sends the operator-edited `newText` to `applyRevision` (not the original `proposedText`)
    - A `previewRevision` rejection with `RevisionError` `reason==='cost_cap_exceeded'` drives `DirectionChips` into the disabled/cost-capped state
  </behavior>
  <files>apps/dispatch-control/components/revision/RevisionFlow.tsx, apps/dispatch-control/__tests__/RevisionFlow.test.tsx</files>
  <action>
Export `RevisionFlow({ runId, passage, onApplied, onClose }: { runId:string; passage:{sectionName:string; quotedText:string; blockIndexHint?:number}; onApplied:()=>void|Promise<void>; onClose:()=>void })`. Use `useAuth().getToken()` for the bearer token. State machine:
1. Initial: render `<DirectionChips onSelect={handleSelect} costCapped={capped} capInfo={capInfo} />`.
2. `handleSelect(direction, customText)`: call `previewRevision(runId, {sectionName, quotedText, blockIndexHint, direction, customDirection: customText, priorProposals}, token)`. On `RevisionError` with `reason==='cost_cap_exceeded'`, set `capped=true` + `capInfo={spentUsd, capUsd}` (chips render disabled-with-title). On success, store `preview` + push its `proposedText` onto `priorProposals`, show `<RevisionComparisonCard original={quotedText} preview={preview} ... />`.
3. Card `onApply`: `const { revisionId } = await getDraft(runId, token)` (FRESH ifRevisionID), then `applyRevision(runId, {ifRevisionID: revisionId, sectionName, quotedText, blockIndexHint, newText: preview.proposedText}, token)`; on success `await onApplied()` then `onClose()`. Surface a `revision_mismatch` 409 as a "changed since you loaded it — reload" message (mirror FactCheckScreen).
4. Card `onEdit(editedText)`: same apply path with `newText: editedText` (D-11 — delta not recomputed).
5. Card `onTryAnother`: re-call `previewRevision` with the SAME direction and the accumulated `priorProposals` as avoid-context (D-05), replacing the shown card.
6. Card `onDiscard`: clear `preview`, return to chips (keep `priorProposals` so a later Try-another still diverges).
This container is surface-agnostic — it receives a `passage` and reports `onApplied`; 45-05 supplies both.

Then convert the Wave-0 `__tests__/RevisionFlow.test.tsx` `it.todo` entries into real assertions. Mock
`previewRevision`/`applyRevision` (from `revisionClient`) and `getDraft` (from `contentPatchClient`) with
`vi.mock`, and cover every `<behavior>` case: (a) on Apply, assert `getDraft` is called and its returned
`revisionId` is passed as `applyRevision`'s `ifRevisionID` (fresh at apply); (b) drive "Try another
approach" twice and assert the second `previewRevision` call receives the accumulated `priorProposals`;
(c) use "Edit before applying" and assert `applyRevision` receives the edited `newText`, not
`preview.proposedText`; (d) make `previewRevision` reject with `new RevisionError(409,'cost_cap_exceeded',...)`
and assert the chips render disabled (cost-capped). No live network — all pipeline calls are mocked.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/RevisionFlow.test.tsx __tests__/RevisionComparisonCard.test.tsx __tests__/DirectionChips.test.tsx && npx eslint components/revision/RevisionFlow.tsx</automated>
  </verify>
  <acceptance_criteria>
    - `components/revision/RevisionFlow.tsx` exports `RevisionFlow`, imports `previewRevision`+`applyRevision` from `revisionClient`, and imports `getDraft` from `contentPatchClient` (fresh ifRevisionID at apply).
    - The apply branch passes `newText` (proposed OR edited) and a freshly-fetched `ifRevisionID`; the try-another branch forwards `priorProposals` (`grep -q "priorProposals" components/revision/RevisionFlow.tsx`).
    - `__tests__/RevisionFlow.test.tsx` is real (no remaining `it.todo`) and asserts all four `<behavior>` cases — fresh-ifRevisionID-before-apply, `priorProposals` accumulation, edited-`newText` on Edit-before-applying, and the `cost_cap_exceeded` 409 disabled-chips branch — with `previewRevision`/`applyRevision`/`getDraft` mocked.
    - `cd apps/dispatch-control && npx vitest run __tests__/RevisionFlow.test.tsx` exits 0.
    - `npx eslint components/revision/RevisionFlow.tsx` passes; the component test files stay green.
  </acceptance_criteria>
  <done>RevisionFlow drives chips→preview→card→apply with try-another avoid-context, edit-before-applying, and a fresh ifRevisionID at apply, with its orchestration covered by a dedicated RevisionFlow.test.tsx — a self-contained kit ready to mount.</done>
</task>

</tasks>

<verification>
- `npx vitest run __tests__/DirectionChips.test.tsx __tests__/RevisionComparisonCard.test.tsx __tests__/RevisionFlow.test.tsx` green.
- `npx vitest run __tests__/dispatch-control-no-sanity-write.test.ts` green.
- `npx eslint components/revision lib/revisionClient.ts` clean.
</verification>

<success_criteria>
A mountable revision kit: the client hits only the pipeline endpoints, the chips are the 7 REV-02
options (never Regenerate) with a cost-capped disabled state, the card shows the full comparison +
claim delta with four actions, and RevisionFlow orchestrates the whole preview→apply cycle.
</success_criteria>

<output>
After completion, create `.planning/phases/45-agent-revision/45-04-SUMMARY.md`.
</output>
