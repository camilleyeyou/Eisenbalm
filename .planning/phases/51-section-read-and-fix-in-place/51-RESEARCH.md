# Phase 51: Section — Read and Fix in Place - Research

**Researched:** 2026-07-31
**Domain:** Next.js App Router composition over an existing bespoke "galley" annotation/finding system (dispatch-control, `apps/dispatch-control`)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. Route, shell & reading surface**
- **D-01:** New `(editorial)` route group. `app/(editorial)/s/[section]/` with its own minimal layout — no `AppSidebar`, no `Masthead`. `app/(dashboard)/` stays **byte-unchanged** (additive-first). Flag for Phase 52 (not this phase): the `/` conflict between `app/(dashboard)/page.tsx` and the future editorial `/`. Phase 51 must not add a page at `/` in the new group.
- **D-02:** The issue is always the current run. Resolve via `runs.latest → pipelineRuns.byRunId → issueNumber`, reusing `lib/useCurrentRun.ts` / `lib/currentRun.ts`. Never `max(issueNumber)`. No issue number in the path, no `?issue=` override, no `/i/[n]/s/[section]` form.
- **D-03:** `[section]` is the internal galley id, verbatim — `/s/originStory`, `/s/problemStatement`, `/s/founderBio`, `/s/caseStudy`, `/s/bonus`, `/s/game`, `/s/deliberation-conversation`, `/s/podcast`, `/s/theme`. Same vocabulary as `lib/galley/sectionIdMap.ts`, `galley-{id}` anchors, `Galley`'s `sections` prop. No slug↔id map. Unknown segment → not-found, never a guessed section.
- **D-04:** New typography scoped to this surface only. ~760px reading measure, Lora **17.5px** body. `.galley-body` in `app/globals.css` **stays 16.5px/1.7**. Also revisit `[id^='galley-'] { scroll-margin-top: 88px }` for this surface (tuned for the v4 sticky stage-tab nav this page doesn't have).
- **D-05:** Chrome is one slim header. The issue's real derived title, linking back to the issue; the section name renders as the prose headline. Not sticky. Nothing else above the prose.

**B. One surface, three kinds of problem**
- **D-06:** All axes render together — `includeAxes` is **omitted** on this surface. `FACTUAL_AXES` / `VOICE_AXES` in `lib/galley/axisPartition.ts` are **not modified**.
- **D-07:** Each mark carries a small always-visible text tag adjacent to the span — Fact / Voice / Source. Additive change to `AnnotationMark` / `ClaimMark`, not a new mark component.
- **D-08:** One neutral action vocabulary for every finding kind — Accept suggestion / Edit myself / Dismiss — via `Galley`'s **existing** `labels` prop. No per-finding label plumbing through `GallerySection` into `AnnotationMark`. Preserve the Voice-Pass on-demand-rewrite mechanic: if currently keyed off `labels.accept === 'Accept rewrite'`, it needs a non-label-based trigger before D-08 can land — **flagged for research** (see Common Pitfalls).
- **D-09:** Only unsourced claims are marked. Sourced/checked claims render as plain prose. `showProvenance` is not used to wash every tracked claim. No toggle control on this surface.

**C. Recurring corrections (READ-04)**
- **D-10:** READ-04 means sibling findings that share a fix, not one finding with an ambiguous span. One `qaCorrections` row per occurrence, each with its own resolvable span and the same `suggestedFix`; "one action" accepts the group. **No change to `lib/galley/spanResolver.ts` ambiguity handling and no change to the accept endpoint's server-side resolution semantics.**
- **D-11:** A group = same `axis` + identical `suggestedFix`, within the section. Grouped client-side as a derived selector over rows already loaded. Quoted spans may differ.
- **D-12:** Group accept runs sequentially, refreshing the revision between each call. Accept → refetch draft → re-resolve → accept the next with the fresh `revisionId`. Honours the Phase 33 D-06 `ifRevisionID` guard. Never fire in parallel against one `revisionId`. Never add a server-side batch endpoint.
- **D-13:** Partial failure applies what worked and says so plainly — "3 of 5 applied — 2 still need you" — failed findings stay marked and openable. No stop-at-first-failure, no rollback.

**D. Navigation & the derived count**
- **D-14:** All nine `EDITABLE_SECTIONS` get a `/s/[section]` destination, each honest about what it is: prose sections carry inline marks; `game` renders its sandboxed iframe, `podcast` its player, `theme` its swatches — each stating plainly it carries no inline findings.
- **D-15:** Prev/next live at the end of the prose, not in the header, not both. Order follows `EDITABLE_SECTIONS`; first and last degrade honestly rather than wrapping silently.
- **D-16:** READ-08 counts any section with open findings — not must-fix only, not two numbers side by side.
- **D-17:** `deriveSectionStates` (`lib/derivedState.ts`) is the single source of truth, extended if needed. It already iterates the nine `EDITABLE_SECTIONS`, filters with `isOpenFinding`, maps names via `qaSectionToGalleyId`, returns `openCount`. Phase 52's table of contents will read the same selector. Do **not** use `deriveRunSections` and do **not** create a third selector. **Required cleanup:** `lib/derivedState.ts:24` imports `EDITABLE_SECTIONS` *upward* from `app/(dashboard)/review-desk/[runId]/_components/SectionChipList` — promote `EDITABLE_SECTIONS` (and `SectionMeta`) into shared `lib/`, re-export from the old location so Review Desk keeps compiling unchanged.

**E. In-place editing (READ-05)**
- **D-18:** The marked block becomes editable exactly where it sits — text only. Saves patch that one block through the existing content-patch API with the same `ifRevisionID` guard. No structural block operations on this surface (no change-type, add, delete, reorder). No deep-link to `SectionEditorPanel` / `BlockEditor`, no escape hatch into the old console mid-read. `PassageToolbar`'s "Edit text" and `AnnotationMark`'s "Edit myself" both route here — `Galley`'s required `onEditSection` prop is wired to the in-place editor, not to a panel.
- **D-19:** Explicit Save/Cancel per block. Visible dirty state; a 409 has an obvious owner and obvious retry. No save-on-blur, no debounced autosave.

**F. Reasoning + evidence in one popover (READ-03)**
- **D-20:** The finding popover mounts the shared `ClaimProvenanceCard` beneath the reasoning when the finding links to a tracked claim. Honours Phase 42 D-09's one-component rule; never fork the card. **Hard constraint (Pitfall 5, `AnnotationMark`):** the popover renders inside the galley's paragraph elements — everything is phrasing content. Never block-level, never a nested paragraph. If `ClaimProvenanceCard` currently emits block-level markup, it needs a phrasing-safe rendering mode — **flagged for research** (confirmed true; see Common Pitfalls).

**G. Honest states**
- **D-21:** Three visibly different renders. Loading = skeleton, never a clean-looking page. Not generated = the existing WSP-07 Editor's-note block (keep byte-identical with `draftSectionIdsFromDraft`). Clean = prose with an explicit "no open findings" line. Never render "clean" until findings AND claims have both resolved.

**H. Passage toolbar**
- **D-22:** `PassageToolbar` stays mounted, wired to the same four actions — Edit text, Inspect how this was made, Ask agent to revise, Related facts. Zero new component work; already mounted inside `Galley`. "Edit text" routes to the D-18 in-place editor.

**I. Decided by analysis**
- **D-23:** No Phase 49 role gate applies to this surface. Accept-fix, dismiss, edit-text are none of the six gated actions — a Collaborator can do everything on `/s/[section]`. If "Ask agent to revise" leads to *applying* a revision, that apply step **is** gated — wrap with the existing `LockedControl`, never hide it. (Confirmed: `RevisionFlow` — the component this reuses — already self-gates its Apply action via `useRole()`; no extra wrapper needed if `RevisionFlow` is reused verbatim.)
- **D-24:** Review Desk, Voice Pass, and every other v4.0 route are not modified. The only permitted touch to old-console files is the D-17 `EDITABLE_SECTIONS` promotion, which must be re-export-compatible.
- **D-25:** `useReviewedSections` is deleted. Remove `app/(dashboard)/review-desk/[runId]/_components/useReviewedSections.ts` and its usage in `ReviewDeskRunView.tsx`. No "mark reviewed", no localStorage bookkeeping anywhere. A section reads clean because it has no open findings, never because someone ticked it.

### Claude's Discretion
- Exact popover markup and layout within the phrasing-content constraint.
- The in-place block editor's implementation (textarea vs contenteditable), focus and keyboard handling. **(UI-SPEC already resolved this: `<textarea>`, matching `BlockEditor.tsx` precedent.)**
- Visual design of the Fact / Voice / Source tags within the 1c token system.
- Responsive behaviour of the 760px measure at narrow widths. **(UI-SPEC already resolved: simple max-width + padding, no container-query reflow, 24px padding down to ~360px.)**
- Test strategy and file layout.
- Whether group-accept shows a confirmation or preview before applying. **(UI-SPEC already resolved: no separate confirmation — the count-in-label already discloses scope.)**

### Deferred Ideas (OUT OF SCOPE)
- The nine-section table of contents, per-section state display, the one honest sentence, the publish footer — Phase 52 (`/`), reading the same `deriveSectionStates` selector.
- Resolving the `/` route conflict between `app/(dashboard)/page.tsx` and the new editorial `/` — Phase 52.
- Relocating operational surfaces behind `/admin/*` — Phase 53. Phase 51 must not link into operational tooling.
- Archive by title, subject search, published/held/scheduled labels — Phase 54.
- Retiring the v4.0 console routes — out of scope for the entire v5.0 milestone.
- Ambiguous-span "apply to all occurrences" (one finding whose quoted text appears N times) — backend work, not this milestone.
- A server-side batch accept endpoint — backend work; revisit only if D-12's sequential loop proves too slow.
- Multi-writer / non-charity topics — out of scope for v5.0.
- Mid-flight section streaming, bonus-variant renders beyond what's resolved in UI-SPEC — left to research/planning discretion.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| READ-01 | Editor reads a section as full-width prose with no side rails and a reading measure, not a form. | `app/(editorial)/s/[section]/` new route group (D-01), 760px measure scoped CSS (D-04), reuse `Galley` with `sections={[id]}` whitelist prop (already exists, quick 260724-i5n). |
| READ-02 | Editor sees factual, voice and unsourced-claim problems marked in the sentence they affect, distinguishable by label as well as colour. | `includeAxes` omitted on `Galley` (D-06); additive Fact/Voice/Source tag in `AnnotationMark.tsx`/`ClaimMark.tsx` (D-07), driven by `FACTUAL_AXES`/`VOICE_AXES` (`lib/galley/axisPartition.ts`) and `value.provenance` respectively. |
| READ-03 | Editor can open a marked problem and see the agent's reasoning and its evidence without leaving the paragraph. | `AnnotationMark`'s existing popover (reason/suggestedFix) + mount `ClaimProvenanceCard` inside it (D-20) — requires a phrasing-safe render mode (confirmed gap, see Common Pitfalls). |
| READ-04 | Editor can accept the agent's suggested correction in one action, including when it applies in more than one place. | Client-derived grouping (same `axis` + identical `suggestedFix`) over `qaCorrections` rows already subscribed by `Galley`; sequential accept loop reusing `acceptFinding`/`reloadDraft` (D-10–D-13). |
| READ-05 | Editor can edit the passage themselves instead of accepting the suggestion. | New in-place `<textarea>` editor (pattern lifted from `BlockEditor.tsx`), wired to `Galley`'s required `onEditSection` prop; saves via `patchSection` (4 long-reads) or `patchBonus` (specAd bonus) in `lib/contentPatchClient.ts` with `ifRevisionID` guard (D-18/D-19). |
| READ-06 | Editor can dismiss a finding that is not a problem, with the reason the existing annotation system already requires. | Reused verbatim: `AnnotationMark`'s dismiss flow (`dismissFinding`, one-line reason, `lib/findingsClient.ts`) and `UnresolvedFindingCard`'s Dismiss action — zero new code. |
| READ-07 | Editor can move to the previous or next section without returning to the issue. | New end-of-prose prev/next block using `EDITABLE_SECTIONS` order (post D-17 promotion) — first/last omit the missing side (D-15). |
| READ-08 | Editor sees how many sections still need them, derived from open findings and never from a manual mark. | `deriveSectionStates(inputs, draftSectionIdsFromDraft(draft))` → count entries with `openCount > 0` (D-16/D-17); `useReviewedSections` deleted (D-25). |
</phase_requirements>

## Summary

Phase 51 is almost entirely composition over a mature, already-shipped annotation/finding system (`components/galley/*`, `lib/galley/*`, `lib/derivedState.ts`, `lib/findingsClient.ts`, `lib/contentPatchClient.ts`) built across Phases 32/33/35/36/41/42/44/45. `Galley.tsx` already has a `sections?: ReadonlyArray<string>` whitelist prop (added in quick 260724-i5n *expressly* for a single-section reuse case) and every prop the CONTEXT.md names (`onEditSection`, `onInspect`, `onRevise`, `onRelatedFacts`, `showProvenance`, `includeAxes`, `labels`, `onUnsourcedClaimClick`) is verified present with the exact signature the CONTEXT.md describes. No backend change is required or possible within scope; every accept/dismiss/patch call goes through already-shipped pipeline endpoints (`lib/findingsClient.ts`, `lib/contentPatchClient.ts`).

Three genuine gaps exist beneath the CONTEXT.md's own flags, all confirmed by direct source inspection: (1) `ClaimProvenanceCard.tsx` unconditionally renders `<div>`/`<p>` block-level markup and has no phrasing-safe mode — it cannot be mounted inside `AnnotationMark`'s popover as-is; (2) `AnnotationMark`'s on-demand voice-rewrite trigger (`isRewriteVariant = labels?.accept === 'Accept rewrite'`) will silently break the moment D-08's neutral labels are applied, exactly as CONTEXT.md warns, and needs a new non-label-based prop; (3) **a hazard CONTEXT.md/UI-SPEC do not mention**: `PassageToolbar`'s "Inspect how this was made" action (required by D-22) and `AnnotationMark`/`UnresolvedFindingCard`'s "Inspect how this was made" action both require `useInspector()`, whose provider (`<InspectorProvider>`) is mounted exactly once, at `app/(dashboard)/layout.tsx`, and is documented in its own source as "the ONE place it is ever mounted app-wide." Since D-01 puts `/s/[section]` in a sibling `(editorial)` route group outside `(dashboard)`, that context is not an ancestor there. This must be resolved in planning (recommended: mount a second `<InspectorProvider>` in the new `app/(editorial)/layout.tsx`; `onRevise`/`onRelatedFacts` do **not** have this problem — see Common Pitfalls).

A fourth finding sharpens D-25's blast radius: deleting `useReviewedSections` is not a one-file change. `reviewedIds`/`reviewed`/`onToggleReviewed` are **required, load-bearing props** of `StoryDeskGrid.tsx` (card "done" status, progress header, "✓ Reviewed" badge) and `StoryFocusView.tsx` ("Mark reviewed" button, unreviewed-count copy, `nextUnreviewed` footer) — both v4.0 Review Desk components that D-24 says must not be touched beyond the D-17 promotion. D-25 is an explicit, already-locked milestone-level decision ("the `useReviewedSections` localStorage layer is DELETED... section state is derived from open findings, never a manual mark" — ROADMAP.md preamble), so it overrides D-24's narrower "don't touch old-console files" statement for this one hook — but the planner must budget real work in `StoryDeskGrid.tsx`/`StoryFocusView.tsx` to replace the deleted state with a `deriveSectionStates`-backed equivalent (or drop the affordance), not just delete the hook file and its import line.

**Primary recommendation:** Treat this phase as a new page (`app/(editorial)/s/[section]/page.tsx` + `layout.tsx`) that (a) resolves the current run via `useCurrentRun()`, (b) loads the draft via `getDraft`/`patchSection` exactly as `ReviewDeskRunView.tsx` already does, (c) mounts `<Galley sections={[sectionId]} includeAxes={undefined} labels={{accept:'Accept suggestion', editInline:'Edit myself', dismiss:'Dismiss'}} showProvenance />` inside a scoped `.section-reader` wrapper, (d) supplies a **new** `onEditSection` implementation (the in-place textarea editor, not a panel), and (e) computes the READ-08 count and READ-07 prev/next from `deriveSectionStates`/`EDITABLE_SECTIONS` after the D-17 promotion. Everything else is either already correct as shipped or needs a small, additive prop on an existing component.

## Standard Stack

No new libraries. This phase is 100% composition inside an existing Next.js 15 (App Router) + React 18 + TypeScript + Convex + Clerk + Tailwind stack already installed in `apps/dispatch-control`.

### Core (already present, reused verbatim)
| Library | Version (installed) | Purpose | Why Standard (for this codebase) |
|---------|---------|---------|--------------|
| `next` | see `apps/dispatch-control/package.json` (App Router, route groups) | Routing — new `(editorial)` route group | Existing convention; every other surface (`(dashboard)`) is a route group with its own `layout.tsx` |
| `@portabletext/react` | existing dep | Renders `GallerySection`'s synthetic Portable Text blocks with `marks.annotation`/`marks.claimSpan` | Already the rendering substrate for every galley surface — do not fork |
| `convex/react` | existing dep | `useQuery(api.qaCorrections.byRunId, …)`, `useQuery(api.claimChecks.listByRunId, …)` inside `Galley.tsx` | Already wired inside `Galley`; the new page never queries these directly |
| `@clerk/nextjs` | existing dep | `useAuth()` (bearer token for findings/content-patch calls), `useUser()`/`useRole()` (D-23) | Already the auth pattern in every mutating client call |

### Don't add
No new npm packages are needed for this phase. `lucide-react` exists as a project dependency but the UI-SPEC explicitly forbids introducing it into the galley/annotation surfaces (plain-text labels + existing unicode glyphs only, matching `ClaimProvenanceCard`'s `✓ ✕ ○ △ ⟳` convention).

**Version verification:** not applicable — no package.json changes anticipated. If the plan touches `package.json` for any reason, run `npm view <package> version` first per the Nyquist checklist, but current evidence (CONTEXT.md "Zero new icons", UI-SPEC "no shadcn UI blocks are introduced") indicates it should not be necessary.

## Architecture Patterns

### Recommended Project Structure (additive only)
```
apps/dispatch-control/
├── app/
│   ├── (dashboard)/                         # UNCHANGED (D-01, D-24)
│   └── (editorial)/                         # NEW route group
│       ├── layout.tsx                       # NEW — minimal shell, own InspectorProvider (see Pitfall 3)
│       └── s/
│           └── [section]/
│               └── page.tsx                 # NEW — the whole phase's entry point
├── components/
│   ├── galley/
│   │   ├── Galley.tsx                       # MODIFIED — additive only (no signature break)
│   │   ├── AnnotationMark.tsx                # MODIFIED — additive: Fact/Voice/Source tag (D-07), generateFixOnAccept (D-08 fix)
│   │   ├── ClaimMark.tsx                     # MODIFIED — additive: Source tag (D-07)
│   │   └── GallerySection.tsx                # touched only if new props must thread through
│   └── provenance/
│       └── ClaimProvenanceCard.tsx           # MODIFIED — needs a phrasing-safe render mode (see Pitfall 2)
├── lib/
│   ├── derivedState.ts                       # MODIFIED — fix the upward EDITABLE_SECTIONS import (D-17)
│   ├── editableSections.ts                   # NEW (suggested name) — EDITABLE_SECTIONS + SectionMeta promoted here
│   └── galley/ (unchanged: sectionIdMap.ts, axisPartition.ts, findingState.ts, spanResolver.ts)
└── app/(dashboard)/review-desk/[runId]/_components/
    ├── SectionChipList.tsx                   # MODIFIED — re-exports EDITABLE_SECTIONS/SectionMeta from lib/
    ├── StoryDeskGrid.tsx                      # MODIFIED — reviewedIds prop removed/replaced (D-25 blast radius)
    ├── StoryFocusView.tsx                     # MODIFIED — reviewed/onToggleReviewed props removed/replaced (D-25 blast radius)
    └── useReviewedSections.ts                 # DELETED (D-25)
```

### Pattern 1: Reuse `Galley` with the `sections` whitelist (already shipped)
**What:** `Galley` already supports scoping its render to exactly one section id via an optional `sections?: ReadonlyArray<string>` prop — added in quick 260724-i5n specifically so the Story Desk's per-story Draft tab (`StoryFocusView.tsx`) could reuse the whole-issue galley for a single section "instead of forking the annotation/claim rendering." This is the exact mechanism this phase needs.
**When to use:** Every render of `/s/[section]`.
**Verified signature (`components/galley/Galley.tsx:119-186`):**
```typescript
interface GalleyProps {
  runId: string
  draft: DraftResponse
  revisionId: string
  reloadDraft: () => Promise<void> | void
  onEditSection: (sectionId: string, findingId?: string) => void   // REQUIRED
  onInspect?: (sectionId: string) => void
  onRevise?: (passage: RevisionPassageFromSelection) => void
  onRelatedFacts?: (sel: PassageSelection) => void
  showProvenance?: boolean              // default true
  includeAxes?: ReadonlySet<string>     // omit for this surface (D-06)
  labels?: { accept?: string; editInline?: string; dismiss?: string; dismissReasonDefault?: string }
  onUnsourcedClaimClick?: (claimIndex: number) => void
  sections?: ReadonlyArray<string>      // ← the LD-4 whitelist; pass [sectionId]
}
```
**Existing precedent to copy (`StoryFocusView.tsx`'s Draft tab)** is the closest analog in the codebase for "one section rendered via `Galley`" — read it for how `resolveSectionFindings`/`chipCounts` are shaped before it hands rows to `Galley`, but do NOT reuse `StoryFocusView.tsx` itself (it is route-scoped to the old console and D-24 forbids modifying it beyond the D-17 promotion touch).

### Pattern 2: `onEditSection` → new in-place textarea editor, not a panel (D-18)
**What:** `Galley`'s required `onEditSection: (sectionId: string, findingId?: string) => void` prop is called by three places today: `AnnotationMark`'s "Edit inline" button, `UnresolvedFindingCard`'s "Edit inline" button, and (via `Galley.tsx:355`) `PassageToolbar`'s "Edit text" button (`onEditText={(sel) => onEditSection(sel.sectionId)}`). On every existing v4.0 caller, this opens `SectionEditorPanel`/`BlockEditor`. D-18 forbids that deep-link on this surface — the new `onEditSection` implementation must instead open an in-place `<textarea>` scoped to the one flagged block.
**Precedent to copy (not import — the UI-SPEC explicitly cites this as the pattern to match, not a component to reuse):** `app/(dashboard)/review-desk/[runId]/_components/BlockEditor.tsx` — a controlled `<textarea>` per block, `min-height: 44px`, `onChange` local, explicit external Save/Cancel. It has zero import dependency on the review-desk route and can be read as a template without any coupling risk.
**Save routing (confirmed from `lib/contentPatchClient.ts` + `docs/API_CONTRACTS.md:2619`):**
- `originStory` / `problemStatement` / `founderBio` / `caseStudy` → `patchSection(runId, sectionName, { ifRevisionID, blocks }, token)` — `PATCH /issues/{run_id}/sections/{section_name}`. **`section_name` allow-list is exactly these four** — `bonus` is NOT accepted by this route (confirmed at `docs/API_CONTRACTS.md:2619`).
- `bonus` (specAd only — D-14 says other bonus variants are exempt from inline findings) → `patchBonus(runId, { ifRevisionID, body: [...] }, token)` (`BonusPatchPayload` is a loose `[key: string]: unknown` record, variant-shaped by `bonusType`).
- `game` / `podcast` / `theme` / `deliberation-conversation` are D-14 exempt sections (no inline findings) — no in-place text editor is needed for them under READ-05's scope (they carry no marked spans to "edit myself" out of).
**Example — the exact 409 branch to reuse (mirrors `AnnotationMark`'s own accept-flow pattern, `AnnotationMark.tsx:237-248`):**
```typescript
// Source: apps/dispatch-control/components/galley/AnnotationMark.tsx (existing pattern to mirror)
try {
  await patchSection(runId, sectionName, { ifRevisionID: revisionId, blocks }, await getToken())
  await reloadDraft()
  setEditing(false)
} catch (e) {
  if (e instanceof ContentPatchError && e.reason === 'revision_mismatch') {
    await reloadDraft()
    setNote('This passage changed since you started editing — reload and try again.') // D-19 copy, UI-SPEC
  } else {
    setNote(e instanceof Error ? e.message : 'Save failed.')
  }
}
```

### Pattern 3: Fact/Voice/Source tag — additive prop on `AnnotationMark`/`ClaimMark` (D-07)
**What:** Both components already render everything needed to derive the tag text from data already on the `value` prop — `value.axis` (`AnnotationMark`) and `value.provenance` (`ClaimMark`) — no new data fetch. The UI-SPEC's exact mapping table (axis ∈ `FACTUAL_AXES` → "Fact"; axis ∈ `VOICE_AXES` → "Voice"; axis `undefined` → "Fact" conservative default per the existing `axisPartition.ts` convention; `provenance === 'unsourced'` → "Source") requires only `FACTUAL_AXES`/`VOICE_AXES` (already imported one layer up in `Galley.tsx`, not currently in `AnnotationMark.tsx` — needs a new import there) and a new boolean prop, e.g. `showAxisTag?: boolean`, so Review Desk/Voice Pass (which must stay byte-identical per D-24) don't suddenly grow a tag.
**When to use:** Only on `/s/[section]`'s `Galley` mount (`showAxisTag={true}` or similar — naming is planner/Claude's discretion, not locked).

### Pattern 4: Group-accept as a client-derived selector + sequential loop (D-10–D-13)
**What:** No new query. `Galley.tsx` already subscribes to `api.qaCorrections.byRunId` and filters to `openFindings` (`Galley.tsx:234-236`). A grouping selector needs only to run over `findingsByGalleyId.get(sectionId)` (or the equivalent rows already resolved for the one rendered section) and bucket by `(axis, suggestedFix)`.
**Sequential accept — exact existing primitives to chain (`lib/findingsClient.ts`):**
```typescript
// Source: apps/dispatch-control/lib/findingsClient.ts (existing exports, unmodified)
export async function acceptFinding(
  runId: string,
  findingId: string,
  payload: { ifRevisionID: string; suggestedFixOverride?: string },
  token: string | null,
): Promise<{ revisionId: string; findingId: string; resolution: 'accepted' }>
```
A group-accept loop calls this once per member, using the **`revisionId` returned by the previous call** (not a stale closure value) for the next, per D-12 — mirroring `AnnotationMark.handleAccept`'s existing single-accept shape (`AnnotationMark.tsx:219-249`) but looping and re-deriving `revisionId` between iterations instead of calling `reloadDraft()` and re-reading a prop (either approach satisfies D-12's "refresh between each call"; using the direct return value is one fewer round trip).

### Pattern 5: READ-08 count + READ-07 prev/next from the one shared selector
**Verified signature (`lib/derivedState.ts:291-315`):**
```typescript
export function deriveSectionStates(
  i: DerivationInputs,
  draftSectionIds: ReadonlySet<string>,
): Record<string, SectionStateResult>   // SectionStateResult = { state, openCount }
```
`draftSectionIds` comes from `draftSectionIdsFromDraft(draft)` (`lib/derivedState.ts:344`) — already exported, already used by `WorkspaceOutline.tsx`. `DerivationInputs` is the same shape `useCurrentRun()` already assembles (`lib/useCurrentRun.ts:96-108` builds exactly this object) — the new page can call `useCurrentRun()` and pass `derivationInputs` straight through with zero new Convex queries.
```typescript
// Source: apps/dispatch-control/lib/derivedState.ts (existing, unmodified logic)
const draftSectionIds = draftSectionIdsFromDraft(draft)
const states = deriveSectionStates(derivationInputs, draftSectionIds)
const needCount = Object.values(states).filter(s => s.openCount > 0).length
// READ-08 copy (UI-SPEC, locked):
// needCount > 0 → `${needCount} of 9 sections still need you.`
// needCount === 0 → `All 9 sections are clean — nothing needs you.`
```
Prev/next: after the D-17 promotion, `EDITABLE_SECTIONS.findIndex(s => s.id === sectionId)` ± 1, omitting the missing side at the boundaries — exact pattern already at `StoryFocusView.tsx:170-174` (read as precedent, don't import from that file).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Span-to-text anchoring / ambiguity | A second fuzzy matcher for the single-section case | `resolveSectionFindings` (`lib/galley/spanResolver.ts`) — already what `Galley.tsx` calls per section | D-10 explicitly forbids changing this; it already handles exact/quote-normalized/whitespace-tolerant matching + `blockIndexHint` disambiguation + `'ambiguous'` fallback |
| "Which findings are still open" | A local `!accepted` check | `isOpenFinding` (`lib/galley/findingState.ts`) | The ONE shared predicate every open-finding surface must filter through (Pitfall 9) — a dismissed-only row (`resolution: 'dismissed'`, `accepted` unset) would leak through a naive `!accepted` check |
| QA↔galley section-id translation | A second name map | `qaSectionToGalleyId` / `galleyIdToQaSection` (`lib/galley/sectionIdMap.ts`) | The ONE authority for this bridge; `bonus`↔`bonus`, `problem`↔`problemStatement` etc. are non-obvious and already solved |
| "Which sections exist in this draft" | Re-deriving presence from findings/claims | `draftSectionIdsFromDraft` (`lib/derivedState.ts`) | Must stay in lockstep with `Galley.tsx`'s own `NotGeneratedBlock` presence check (`(section?.blocks ?? []).length === 0`) — the file's own comment calls this out explicitly |
| Claim evidence card | A lighter/forked provenance summary for the popover | `ClaimProvenanceCard` (`components/provenance/ClaimProvenanceCard.tsx`), given a phrasing-safe mode | Phase 42 D-09 forbids a third copy; the six actions (Confirm/Edit/Replace source/Ask agent/Remove/Keep) and the D-08 5-state chip vocabulary already live here |
| Passage-selection toolbar | A section-local selection listener | `PassageToolbar` (`components/galley/PassageToolbar.tsx`) — already mounted once inside `Galley.tsx:352-358` | It already resolves `window.getSelection()` against `data-block-index`/`galley-{sectionId}` DOM stamps; a second listener would double-fire on the same selection |
| "Ask agent to revise" flow | A new preview/apply/compare UI | `RevisionFlow` (`components/revision/RevisionFlow.tsx`) — surface-agnostic (`runId`, `passage`, `onApplied`, `onClose`) | Already self-gates Apply via `useRole()` (satisfies D-23 for free); mirrors `FactCheckScreen.tsx`'s exact preview/apply state machine |

**Key insight:** almost nothing in this phase should be new *logic* — the risk surface is almost entirely in (a) correctly threading a handful of new optional props through 3 existing files without breaking the two other callers (Review Desk, Voice Pass) that must render byte-identically, and (b) the one file (`ClaimProvenanceCard.tsx`) that must change its DOM element types without changing its visual output or its two other call sites (`ClaimMark.tsx`'s popover, and presumably a Stage 3/Approval screen — see Pitfall 2).

## Common Pitfalls

### Pitfall 1: `ClaimProvenanceCard` cannot legally mount inside `AnnotationMark`'s popover today (confirmed, not hypothetical)
**What goes wrong:** D-20 requires mounting `ClaimProvenanceCard` inside `AnnotationMark`'s popover, which is phrasing content (renders inside a `@portabletext/react` paragraph). `ClaimProvenanceCard.tsx` (read in full, 523 lines) unconditionally returns a top-level `<div className="flex flex-col gap-3 ...">` containing multiple nested `<div>` sections, each with a `<h3>`/`<p>` pair, and `<textarea>`/`<input>` inside further `<span>`/`<div>` wrappers for its inline edit/replace/keep/remove forms. This is not a partial issue — every field group (`Claim`, `Source`, `Supporting passage`, `Agent`, the action row) uses `<div>`. `<div>` and `<h3>` are not phrasing content and cannot be a descendant of `<p>` per the HTML spec; React will not throw, but it produces invalid DOM and `AnnotationMark`'s own popover today is careful to use only `<span style={{display:'block'}}>` for exactly this reason (see `AnnotationMark.tsx:290-398` — every popover child is a `<span>`, never a `<div>`).
**Why it happens:** `ClaimProvenanceCard` was built for `ClaimMark`'s popover, which the code comments confirm is *also* phrasing content today (`ClaimMark.tsx` popover is a `<span role="dialog">` at line 190) — meaning `ClaimMark.tsx` may **already** have this same latent DOM-nesting problem in production, since it renders `<ClaimProvenanceCard>` (full `<div>`-based component) directly inside its own `<span className="galley-popover">`. This existing violation isn't something Phase 51 introduces — it inherits/exposes it.
**How to avoid:** UI-SPEC already specifies the fix precisely: a phrasing-safe render mode where every `<div>`→`<span style={{display:'block'}}>` and every `<p>`/`<h3>`→`<span style={{display:'block'}}>`, mirroring `AnnotationMark`'s own popover convention (`AnnotationMark.tsx:290-306`) and `ClaimMark`'s own action row (`ClaimMark.tsx:205-214`, already `<span>`-based). Recommend a boolean prop, e.g. `phrasingSafe?: boolean`, so Stage 3/Approval callers (if any exist outside the galley — worth a grep during planning: `ClaimProvenanceRow` at the bottom of the same file is a separate, lighter, deliberately `<div>`-based component for Approval's `SourceIndex`, confirmed NOT phrasing-content-constrained) keep their current block markup unchanged.
**Warning signs:** React DevTools/hydration warnings about invalid DOM nesting (`<div> cannot appear as a descendant of <p>`); Testing Library `container.innerHTML` assertions that pass in jsdom (jsdom doesn't validate nesting) will NOT catch this — a real-browser or `@testing-library/jest-dom`'s `toBeValid`-style check, or a manual visual QA pass, is needed. jsdom-only test coverage will give false confidence here.

### Pitfall 2: D-08's neutral labels will silently break Voice Pass's on-demand-rewrite Accept path
**What goes wrong:** `AnnotationMark.tsx:146` computes `const isRewriteVariant = labels?.accept === 'Accept rewrite'`. This flag gates two behaviors: (a) whether Accept is available even with no stored `suggestedFix` (line 310: `canAct && (isRewriteVariant || value.suggestedFix)`), and (b) whether Accept calls `voicePassClient.rewrite` first (line 224-228: `if (!value.suggestedFix) { … rewrite(...) }`). On `/s/[section]`, D-08 sets `labels.accept = 'Accept suggestion'` (not `'Accept rewrite'`), so `isRewriteVariant` becomes `false` for a rule-only voice tell that has never had a `suggestedFix` generated — the Accept button disappears entirely for that finding (falls into the `!isRewriteVariant && !value.suggestedFix` branch, which renders "Accept unavailable — no suggested fix" instead of a working button), silently breaking one of the three merged finding kinds this phase exists to unify.
**Why it happens:** the trigger is keyed off a UI *label string* rather than the finding's own data (`value.axis`). This was a deliberate choice when there were only two callers with two fixed label sets (Review Desk vs Voice Pass) — Phase 51 introduces a third caller with a third label set, breaking the assumption.
**How to avoid:** CONTEXT.md already recommends the fix and UI-SPEC restates it precisely: add a new, explicit, optional boolean prop — e.g. `generateFixOnAccept?: boolean` — threaded `Galley` → `GallerySection` → `AnnotationMark`, computed by the CALLER as `axis !== undefined && VOICE_AXES.has(axis) && !suggestedFix` (or simply always pass `true` for voice findings and let the `!value.suggestedFix` check inside `handleAccept` gate the actual rewrite call, since that check already exists at line 225). Replace `isRewriteVariant` internally with `(generateFixOnAccept || labels?.accept === 'Accept rewrite')` so Voice Pass's existing behavior is preserved bit-for-bit (regression-safe) while the new surface sets the new prop instead of relying on label text.
**Warning signs:** a voice-axis finding with no `suggestedFix` shows "Accept unavailable" on `/s/[section]` but a working "Accept rewrite" button on Voice Pass for the identical row — a good targeted test case (fixture: one `qaFindings` row with `axis: 'machine-tell'`, no `suggestedFix`).

### Pitfall 3: `useInspector()` / `<InspectorProvider>` is not an ancestor of the new route group (confirmed by source inspection; not mentioned in CONTEXT.md or UI-SPEC)
**What goes wrong:** D-22 requires `PassageToolbar` "wired to the same four actions" including "Inspect how this was made," and `AnnotationMark`/`UnresolvedFindingCard` both render their own "Inspect how this was made" button whenever `onInspect` is supplied. Every existing caller obtains `onInspect`/`onRevise` from `useInspector()` (`components/inspector/InspectorProvider.tsx`), whose `<InspectorProvider>` is mounted **exactly once**, at `app/(dashboard)/layout.tsx`, with its own doc comment stating "Mounted exactly ONCE, at the `(dashboard)` root layout... so every route under `(dashboard)`... shares the same opener." `useInspector()` **throws** (`InspectorProvider.tsx:108-110`: `throw new Error('useInspector must be used within an InspectorProvider')`) if called without that ancestor. D-01 places `/s/[section]` in a **sibling** `(editorial)` route group, not nested under `(dashboard)` — so as currently architected, wiring `onInspect` on this surface is not possible without a code change to the inspector's mounting.
**Why it happens:** the inspector system was built (Phase 44) assuming exactly one route tree ever needed it; Phase 51 is the first phase to add a second, parallel top-level route group.
**How to avoid — two viable options, planner must pick one:**
1. **(Recommended)** Mount a second `<InspectorProvider>` inside the new `app/(editorial)/layout.tsx`. This is a real, working fix — React context provider instances are independent; this simply means `/s/[section]`'s inspector state (which artifact is open, which revision is being requested) does not persist across a navigation to/from `(dashboard)` routes, which is correct behavior anyway (those are separate, unrelated surfaces per D-24). Requires updating the stale "the ONE place it is ever mounted app-wide" comment at `(dashboard)/layout.tsx` to scope that claim to the `(dashboard)` route group (a doc fix, zero functional risk).
2. Omit `onInspect` wiring on this surface for this phase (the prop is optional everywhere it's consumed — "Undefined leaves today's render unaffected"). This directly under-delivers D-22's "wired to the same four actions," so option 1 is preferred unless the planner explicitly re-scopes D-22 with a new user decision.
- **`onRevise`/`onRelatedFacts` do NOT have this problem.** Confirmed: `onRelatedFacts` is wired via a page-local `useState<PassageSelection | null>` in every existing caller (`ReviewDeskRunView.tsx:446`), not the shared context — trivially reproducible on the new page with zero dependency. `onRevise`/`RevisionFlow` is *currently* routed through the shared context in `ReviewDeskRunView.tsx` (`requestRevision`/`revisePassage`/`clearRevisePassage`) only because the Inspector's own footer ALSO needs to trigger it from a second entry point — but `RevisionFlow` itself (`components/revision/RevisionFlow.tsx`) is fully surface-agnostic (`{runId, passage, onApplied, onClose}`) and can be driven by a page-local `useState` on `/s/[section]` exactly like `relatedFacts`, with no shared-context dependency, **unless** the planner also wants the Inspector footer's own revise entry point to reach this surface (out of scope here).
**Warning signs:** a runtime error "useInspector must be used within an InspectorProvider" the first time `onInspect` (or any inspector call) is exercised on `/s/[section]` in dev/test; this will NOT be caught by `tsc`/`next build` (it's a runtime React error, not a type error) — must be caught by an actual render test or manual click-through.

### Pitfall 4: Deleting `useReviewedSections` has a wider blast radius than CONTEXT.md's own wording suggests
**What goes wrong:** D-25 states the deletion is of the hook file "and its usage in `ReviewDeskRunView.tsx`." Direct inspection shows `ReviewDeskRunView.tsx` does not merely *use* `reviewedIds`/`isReviewed`/`toggleReviewed` locally — it passes them down as **required props** to two other v4.0 components:
- `StoryDeskGrid.tsx` — `reviewedIds: ReadonlySet<string>` is a required prop (`StoryDeskGrid.tsx:20`), consumed by `statusFor()` (line 108: `if (reviewed) return 'done'`), the "N of 9 reviewed" progress header (lines 129/140/156), the per-card "✓ Reviewed" badge (lines 200-204), and to exclude reviewed sections from the must-fix/review tallies (line 134).
- `StoryFocusView.tsx` — `reviewed: boolean` and `onToggleReviewed: () => void` are required props (`StoryFocusView.tsx:43-44`), consumed by the "unreviewed"/"reviewed" meta text (line 271), the "✓ Mark reviewed" / "Reviewed" button (lines 275-281), and (via `ReviewDeskRunView.tsx`'s `nextUnreviewedAfter`, lines 467-476, which calls `isReviewed`) the footer's "Next unreviewed: {label} →" nav (`StoryFocusView.tsx:437-439`).

Simply deleting the hook and its import line in `ReviewDeskRunView.tsx` without touching these two components will not compile (`reviewedIds`/`reviewed`/`onToggleReviewed` become undefined-required-prop errors) — `pnpm --filter dispatch-control build` (strict TS) would fail.
**Why it happens:** D-25's phrasing describes the mechanism (a hook + one call site) but the *behavior it powers* is threaded three components deep into the v4.0 Story Desk UI.
**How to avoid:** treat D-25 (an explicit, already-locked, milestone-level decision — "the `useReviewedSections` localStorage layer is DELETED... section state is derived from open findings, never a manual mark," ROADMAP.md preamble) as authoritative over D-24's narrower "don't touch old-console files beyond the D-17 promotion" — it is itself one of the phase's own locked decisions, not a violation of D-24, but it does require the plan to include tasks that touch `StoryDeskGrid.tsx` and `StoryFocusView.tsx`. Two resolution shapes for the planner to choose between (not decided by research):
1. Replace the "reviewed" concept in both files with a `deriveSectionStates`-backed "clean" (`openCount === 0`) state — the badge becomes "Clean" (already exact copy used elsewhere, e.g. `StoriesPickerMark`'s own `Clean`/`{n} open`/`{n} must fix` pattern at `StoryFocusView.tsx:112-134`, which is a SEPARATE, ALREADY-DERIVED mark sitting right next to the manual one) instead of "Reviewed," and the "Mark reviewed" button is removed entirely (there is nothing left to toggle).
2. Minimal-diff: delete only the hook + its call site, replace `reviewedIds`/`reviewed`/`onToggleReviewed` in the two child components with derived equivalents computed from `chipCounts` (already passed to both components) — `openCount === 0` — with no behavior removed from the *button*, only its meaning (a "mark reviewed" button with nothing to write to no longer makes sense, so this likely collapses to option 1 in practice).
Either way, budget explicit plan tasks/waves for `StoryDeskGrid.tsx` and `StoryFocusView.tsx`, not just the hook file.
**Warning signs:** `tsc --noEmit` / `next build` failures citing missing required props on `<StoryDeskGrid>`/`<StoryFocusView>` inside `ReviewDeskRunView.tsx` the moment the hook import is removed without touching the two children.

### Pitfall 5: `bonus` is not a valid `patchSection` target
**What goes wrong:** if the in-place editor (Pattern 2) is implemented generically as "call `patchSection(runId, sectionId, …)`" for whichever section is open, it will 404/422 the moment an editor opens `/s/[section='bonus']` (specAd) and tries to save an edit — the confirmed API allow-list for `PATCH /issues/{run_id}/sections/{section_name}` is `originStory, problemStatement, founderBio, caseStudy` only (`docs/API_CONTRACTS.md:2619`).
**Why it happens:** `bonus` is structurally different (`draft.bonus`, not `draft.sections.bonus`) and already has its own patch route (`patchBonus`) and its own `BonusPatchPayload` shape in `contentPatchClient.ts`.
**How to avoid:** branch the in-place editor's save call on `sectionId === 'bonus' ? patchBonus(...) : patchSection(...)`, matching how `Galley.tsx` itself already branches rendering (`draft.bonusType === 'specAd'` gets a `GallerySection`, others get a raw `<section>`). `game`/`podcast`/`theme`/`deliberation-conversation` never reach the editor at all under D-14 (no inline findings to "edit myself" out of on those four), so no third/fourth branch is needed for READ-05's scope.
**Warning signs:** a save attempt on the bonus section returns a 4xx from the pipeline with a reason unrelated to `revision_mismatch` (likely a 404/405 route-not-found or a `validation_failed` on an unexpected body shape).

### Pitfall 6: `[id^='galley-'] { scroll-margin-top: 88px }` is a global rule, not scoped
**What goes wrong:** this rule (`app/globals.css:228-230`) applies to every element whose `id` starts with `galley-` anywhere in the app, with no existing scoping selector. D-04/UI-SPEC's fix (`.section-reader [id^='galley-'] { scroll-margin-top: 16px }`) works via CSS specificity (a compound selector beats the bare attribute selector) — confirmed viable, but the new page's outer wrapper **must** literally carry a `.section-reader` class (or whatever class name the plan settles on) for this override to take effect; if the wrapper element is missing or misnamed, in-page anchor scrolling (if this surface ever scrolls to `#galley-{id}`) will silently regress to the wrong offset instead of erroring.
**How to avoid:** name the scoping wrapper once, use it consistently in both the CSS selector and the JSX, and add a render-test assertion (`container.querySelector('.section-reader')` exists) rather than relying on visual QA alone.

## Code Examples

### The exact `resolveCurrentRun` chain this phase must reuse (D-02)
```typescript
// Source: apps/dispatch-control/lib/currentRun.ts (existing, unmodified)
export type CurrentRunState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'run'; runId: string; issueNumber: number | null }

export function resolveCurrentRun(
  latest: { runId: string } | null | undefined,
  pipelineRun: { issueNumber: number } | null | undefined,
): CurrentRunState { /* runs.latest -> pipelineRuns.byRunId -> issueNumber, never max(issueNumber) */ }
```
```typescript
// Source: apps/dispatch-control/lib/useCurrentRun.ts (existing, unmodified) — the ONE hook to call
const { state, runId, issueNumber, title, derivationInputs, qaFindings, claimRows } = useCurrentRun()
// state.kind === 'loading' | 'none' | 'run' — branch the page's loading/empty/error render on this
```

### The exact draft-load + save-loop shape to mirror (from `ReviewDeskRunView.tsx`, read-only precedent)
```typescript
// Pattern already proven in apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx
const [draft, setDraft] = useState<DraftResponse | null>(null)
const [loading, setLoading] = useState(true)
const [error, setError] = useState<string | null>(null)

const reloadDraft = useCallback(async () => {
  try {
    const token = await getToken()
    const fresh = await getDraft(runId, token)   // lib/contentPatchClient.ts
    setDraft(fresh)
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Failed to load draft.')
  } finally {
    setLoading(false)
  }
}, [runId, getToken])
```

### Group-accept sequential loop (new, composed entirely from existing primitives)
```typescript
// New code for this phase — composed from acceptFinding (lib/findingsClient.ts) + reloadDraft
async function acceptGroup(findingIds: string[], runId: string, revisionId: string, token: string | null) {
  let currentRevisionId = revisionId
  const results: Array<{ id: string; ok: boolean }> = []
  for (const findingId of findingIds) {
    try {
      const res = await acceptFinding(runId, findingId, { ifRevisionID: currentRevisionId }, token)
      currentRevisionId = res.revisionId   // D-12: fresh revision for the NEXT call
      results.push({ id: findingId, ok: true })
    } catch {
      results.push({ id: findingId, ok: false })   // D-13: keep going, report partial success
    }
  }
  return results   // caller renders "{applied} of {total} applied — {failed} still need you" (D-13/UI-SPEC copy)
}
```

## State of the Art

Not applicable in the conventional sense (no external ecosystem shift) — but internally, this phase is itself the "state of the art" migration point for two conventions:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Per-finding-kind label vocabularies (`Accept fix`/`Accept rewrite`) driving behavior via string comparison | A single neutral label vocabulary (D-08) with behavior driven by explicit typed props | This phase | `AnnotationMark`'s `isRewriteVariant` must be re-based (Pitfall 2) before a third caller can safely reuse the component |
| Manual "mark reviewed" bookkeeping (`localStorage`, `useReviewedSections`) as the signal for "done" | Fully derived state from `deriveSectionStates`/`isOpenFinding` (D-16/D-17/D-25) | This phase (milestone-level, stated in ROADMAP.md preamble) | Old-console components (`StoryDeskGrid`, `StoryFocusView`) still read the old signal today and must be migrated (Pitfall 4) — this phase is the first to actually delete the mechanism, not just add an alternative alongside it |

**Deprecated/outdated by this phase:** `app/(dashboard)/review-desk/[runId]/_components/useReviewedSections.ts` (deletion target, D-25) and the `reviewDesk:reviewed:<runId>` localStorage key it reads/writes.

## Open Questions

1. **Where does the second `<InspectorProvider>` (Pitfall 3) get mounted, and does the plan re-scope D-22 instead?**
   - What we know: `useInspector()` throws outside a provider; the existing one lives only in `(dashboard)/layout.tsx`; mounting a second instance in `(editorial)/layout.tsx` is technically straightforward and matches the existing per-provider-instance pattern already used for `ConfirmProvider`/`CommandPaletteProvider` at the same layout level.
   - What's unclear: whether the planner wants "Inspect how this was made" on this surface at all in v1, given D-22 was analyzed (not asked to the user) rather than explicitly confirmed against this specific hazard.
   - Recommendation: default to mounting a second `<InspectorProvider>` (Pitfall 3, option 1) since D-22 is explicit and the fix is low-risk; flag the doc-comment update at `(dashboard)/layout.tsx` as a one-line task.

2. **Exact scope of the `StoryDeskGrid.tsx`/`StoryFocusView.tsx` rewrite for D-25 (Pitfall 4)**
   - What we know: both components have required props that no longer have a data source once `useReviewedSections` is deleted; a derived "Clean" (openCount===0) replacement is directly available from `chipCounts`, already passed to both.
   - What's unclear: whether the "Mark reviewed" *button* should be removed outright (nothing left to toggle) or whether product wants some other action in its place — CONTEXT.md doesn't decide this, and it's arguably outside a strict reading of "Section — Read and Fix in Place" scope (it's a Review Desk UI change, not a `/s/[section]` change) even though D-25 mandates it.
   - Recommendation: scope this as a small, explicitly-named task/wave in the plan (e.g. "D-25 cleanup: replace reviewed-state in StoryDeskGrid/StoryFocusView with derived clean state") rather than folding it silently into "delete the hook," so it's reviewable/verifiable on its own.

3. **Does `ClaimMark.tsx`'s existing popover already have the Pitfall 1 DOM-nesting problem in production?**
   - What we know: `ClaimMark.tsx`'s popover wrapper is a `<span role="dialog">` (phrasing-safe), but it renders the current (block-level) `ClaimProvenanceCard` directly inside it today, on every already-shipped surface (Review Desk, Voice Pass) that shows claim marks.
   - What's unclear: whether this is a pre-existing, already-shipped bug outside this phase's scope, or something Phase 51 should opportunistically fix while adding the phrasing-safe mode (since the fix is the same work either way — add a `phrasingSafe` prop and use it in both `ClaimMark.tsx` and the new `AnnotationMark.tsx` mount).
   - Recommendation: fix `ClaimMark.tsx` too when adding the phrasing-safe mode (near-zero incremental cost, removes a latent invalid-DOM bug from two more already-shipped surfaces) — but do not expand this phase's scope to include new tests/verification of Review Desk/Voice Pass beyond confirming they still render (D-24 byte-identical behavior, not byte-identical markup internals).

## Environment Availability

Skipped — this phase adds no new external dependency, service, or tool. It composes existing, already-integrated services (Convex, Clerk, the pipeline API at `NEXT_PUBLIC_PIPELINE_URL`) that every other dashboard route already depends on and are exercised by the existing test suite/dev environment.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (`vitest.config.ts`, `apps/dispatch-control`) |
| Config file | `apps/dispatch-control/vitest.config.ts` — `environment: 'node'` default, `environmentMatchGlobs` overrides `*.test.tsx` → `jsdom` (component tests) and a short list of named `.test.ts` files → `edge-runtime` (Convex-test files) |
| Quick run command | `pnpm --filter dispatch-control vitest run __tests__/<NewFile>.test.tsx` (or `npx vitest run <path>` from `apps/dispatch-control`) |
| Full suite command | `pnpm --filter dispatch-control test` (→ `vitest run`, whole `__tests__/` tree) |

**Critical project rule (confirmed in `package.json` scripts — `test`/`test:unit` both map to `vitest run` only, no `tsc` step):** Vitest does **not** type-check. A strict `pnpm --filter dispatch-control build` (→ `next build`, which runs the TypeScript compiler) **must** be run before declaring this phase done — this is how Pitfall 4's "missing required prop" class of break would actually surface; Vitest alone would not catch it unless a test explicitly renders the affected component tree.

### Existing Test Coverage This Phase Builds On (confirmed present, do not re-test from scratch)
| File | Covers | Reuse for this phase |
|------|--------|----------------------|
| `__tests__/Galley.test.tsx` (400 lines) | Full `Galley` render, `sections` whitelist behavior, `includeAxes` filtering, `showProvenance`, WSP-07 not-generated block. Establishes the exact mock pattern (`vi.mock('convex/react', …)`, `vi.mock('@clerk/nextjs', …)`, `vi.mock('@convex/_generated/api', …)`, jsdom via `.test.tsx` glob) | Copy the mock scaffold verbatim for the new page's render test; do not re-derive a mock strategy |
| `__tests__/AnnotationMark.test.tsx` (335 lines) | Popover open/close, Accept/Edit/Dismiss actions, 409 branches | Extend (not replace) with new cases for the Fact/Voice/Source tag (Pitfall 3-target D-07) and the `generateFixOnAccept` fix (Pitfall 2) |
| `__tests__/ClaimMark.test.tsx`, `__tests__/ClaimProvenanceCard.test.tsx` (244 lines) | Claim popover, card fields/actions/chip derivation | Extend with a phrasing-safe-mode assertion (Pitfall 1) — note jsdom will NOT catch invalid nesting; consider an explicit `expect(container.querySelector('.galley-popover div')).toBeNull()` structural assertion as a proxy check |
| `__tests__/PassageToolbar.test.tsx` | Selection resolution, four-action render | Confirm `onInspect`/`onRevise` wiring still fires correctly once Pitfall 3 is resolved |
| `__tests__/derivedState.test.ts` (1032 lines) | `deriveSectionStates`, `draftSectionIdsFromDraft`, `isMustFix`, etc. | Extend if `deriveSectionStates` needs any change (D-17 says "extended if needed" — likely none, since READ-08's "any open finding" maps directly to existing `openCount > 0`) |
| `__tests__/SectionChipList.test.tsx` | `EDITABLE_SECTIONS`/`SectionMeta` shape and chip rendering | Confirm the re-export from the new promoted location still passes this file's existing assertions unmodified (D-17's "re-export-compatible" requirement) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| READ-01 | `/s/[section]` renders one section as prose, no rails/tabs/forms | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "renders"` | ❌ Wave 0 (new file) |
| READ-02 | Fact/Voice/Source tag renders adjacent to every marked span, readable without opening popover | component (jsdom), extends `AnnotationMark.test.tsx`/`ClaimMark.test.tsx` | `pnpm --filter dispatch-control vitest run __tests__/AnnotationMark.test.tsx` | ✅ (extend) |
| READ-03 | Popover shows reasoning + `ClaimProvenanceCard` evidence, valid phrasing content | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/ClaimProvenanceCard.test.tsx` | ✅ (extend) |
| READ-04 | Group-accept applies to all sibling findings sharing axis+fix, partial-failure copy | component (jsdom) or pure-fn unit for the grouping selector | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "group accept"` | ❌ Wave 0 (new file/case) |
| READ-05 | In-place textarea Save/Cancel patches the block, 409 recovery copy | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "in-place edit"` | ❌ Wave 0 (new file/case) |
| READ-06 | Dismiss with required reason (reused verbatim) | component (jsdom), existing coverage | `pnpm --filter dispatch-control vitest run __tests__/AnnotationMark.test.tsx -t "dismiss"` | ✅ (no new test strictly required — verify via existing suite) |
| READ-07 | Prev/next nav, first/last omit missing side | pure-fn unit (`EDITABLE_SECTIONS` index math) + component | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "nav"` | ❌ Wave 0 (new file/case) |
| READ-08 | "N of 9 sections still need you" derived from `deriveSectionStates`, never `useReviewedSections` | pure-fn unit, extends `derivedState.test.ts` | `pnpm --filter dispatch-control vitest run __tests__/derivedState.test.ts` | ✅ (extend if `deriveSectionStates` changes; else assert via a new page-level test) |
| D-17 cleanup | `EDITABLE_SECTIONS` promoted + re-exported; Review Desk unaffected | existing regression | `pnpm --filter dispatch-control vitest run __tests__/SectionChipList.test.tsx __tests__/derivedState.test.ts __tests__/runSections.test.ts __tests__/WorkspaceOutline.test.tsx` | ✅ (regression gate) |
| D-25 cleanup | `useReviewedSections` deleted; `StoryDeskGrid`/`StoryFocusView` compile + render with derived state | existing regression + strict build | `pnpm --filter dispatch-control build` | N/A — this is exactly the class of break `vitest` won't catch (Pitfall 4) |

### Sampling Rate
- **Per task commit:** the single new/changed test file's quick command above.
- **Per wave merge:** `pnpm --filter dispatch-control test` (full Vitest suite) — this app's suite includes `edge-runtime` Convex-test files unrelated to this phase; a full green run confirms no regression to Review Desk/Voice Pass (D-24).
- **Phase gate:** `pnpm --filter dispatch-control test` AND `pnpm --filter dispatch-control build` both green before `/gsd:verify-work` — the strict build step is non-negotiable per this app's own documented rule (STATE.md memory: "vitest doesn't type-check; run `pnpm --filter <app> build` before declaring any frontend phase done — Phase 27 shipped 2 latent bugs that only failed on Vercel/Linux").

### Wave 0 Gaps
- [ ] `__tests__/SectionReaderPage.test.tsx` (or equivalent name for the new `app/(editorial)/s/[section]/page.tsx`) — covers READ-01, READ-04, READ-05, READ-07; needs a draft fixture (can copy `Galley.test.tsx`'s existing fixture) plus mocks for `useCurrentRun`, `getDraft`/`patchSection`/`patchBonus`, `acceptFinding`.
- [ ] Extend `__tests__/AnnotationMark.test.tsx` — Fact/Voice/Source tag cases (READ-02), `generateFixOnAccept` regression case for Voice Pass (Pitfall 2 — a test that currently would NOT exist and would NOT fail today, but MUST be added to prove the fix is safe).
- [ ] Extend `__tests__/ClaimMark.test.tsx` / `__tests__/ClaimProvenanceCard.test.tsx` — phrasing-safe mode structural assertion (Pitfall 1).
- [ ] No new test-framework install needed — Vitest + Testing Library + jsdom are already configured and exercised by the six existing galley test files listed above.

## Sources

### Primary (HIGH confidence — direct source-code inspection, this repo)
- `apps/dispatch-control/components/galley/Galley.tsx` (full file, 477 lines) — props, `sections` whitelist, `includeAxes`, `labels`, section-render branches, `bonusType` gating
- `apps/dispatch-control/components/galley/AnnotationMark.tsx` (full file, 403 lines) — popover structure, `isRewriteVariant` label-keyed trigger, accept/dismiss flow, phrasing-content-only popover convention
- `apps/dispatch-control/components/galley/ClaimMark.tsx` (full file, 219 lines) — popover structure, `ClaimProvenanceCard` mount, `onUnsourcedClaimClick`
- `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx` (full file, 523 lines) — confirmed block-level (`<div>`/`<p>`/`<h3>`) markup throughout; `ClaimProvenanceRow` as a separate non-phrasing-constrained sibling export
- `apps/dispatch-control/components/galley/GallerySection.tsx`, `PassageToolbar.tsx`, `GalleryGameSlot.tsx`, `UnresolvedFindingCard.tsx` (full files)
- `apps/dispatch-control/lib/derivedState.ts` (relevant sections, lines 1-380) — `deriveSectionStates`, `draftSectionIdsFromDraft`, `EDITABLE_SECTIONS` upward import at line 24
- `apps/dispatch-control/lib/galley/sectionIdMap.ts`, `axisPartition.ts`, `findingState.ts`, `spanResolver.ts` (full files)
- `apps/dispatch-control/lib/useCurrentRun.ts`, `currentRun.ts`, `findingsClient.ts`, `contentPatchClient.ts` (relevant sections), `role.ts`, `issueTitle.ts` (full files)
- `apps/dispatch-control/components/LockedControl.tsx`, `components/inspector/InspectorProvider.tsx`, `components/revision/RevisionFlow.tsx` (relevant sections) — confirmed `useInspector()` throw behavior, confirmed `RevisionFlow`'s self-contained role gate
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/ReviewDeskRunView.tsx`, `_components/SectionChipList.tsx`, `_components/useReviewedSections.ts`, `_components/StoryDeskGrid.tsx` (full file), `_components/StoryFocusView.tsx` (relevant sections), `_components/BlockEditor.tsx` (full file) — D-17/D-25 blast-radius confirmation
- `apps/dispatch-control/app/globals.css` (relevant sections) — `.galley-body`, `[id^='galley-'] { scroll-margin-top }`, `.galley-root`, `.galley-claim`
- `apps/dispatch-control/app/layout.tsx`, `app/(dashboard)/page.tsx`, `app/(dashboard)/layout.tsx` (relevant sections), `middleware.ts` (full file) — route-group/auth structure confirmation
- `apps/dispatch-control/vitest.config.ts`, `apps/dispatch-control/package.json` scripts — test framework/commands confirmation
- Grep across `apps/dispatch-control` for `EDITABLE_SECTIONS`/`useReviewedSections` importers (exhaustive — 8 and 2 files respectively found and individually confirmed)
- `docs/API_CONTRACTS.md` line 2612-2619 (§31.2 endpoint family, `patchSection` allowed `section_name` set)
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` §5 (claim shape), §6 (six gated actions)
- `.planning/config.json` — `workflow.nyquist_validation: true`

### Secondary (MEDIUM confidence)
- None used beyond primary source inspection — this phase required no external/web research; all facts are verifiable directly against this repository's own source and its own governance documents (CONTEXT.md, UI-SPEC.md, DISCUSSION-LOG.md, ROADMAP.md, REQUIREMENTS.md).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; every reused API verified against live source, not documentation/memory.
- Architecture: HIGH — every prop/function signature quoted in this document was read directly from the current file, not inferred or recalled from training data.
- Pitfalls: HIGH for Pitfalls 1/2/4/5/6 (directly confirmed by reading the exact code paths involved); HIGH for Pitfall 3 (confirmed via the `throw` in `InspectorProvider.tsx` and the exhaustive grep of who calls `useInspector()`) — this is a genuinely new finding beyond what CONTEXT.md/UI-SPEC flagged and should be treated as the single highest-priority open item for planning.

**Research date:** 2026-07-31
**Valid until:** this research is tied to the current state of `apps/dispatch-control`'s source tree, not a time-decaying external fact — treat it as valid until any of the cited files are modified by a phase landing between now and Phase 51's execution (check `git log` on the cited files if execution is delayed by more than a few phases).
