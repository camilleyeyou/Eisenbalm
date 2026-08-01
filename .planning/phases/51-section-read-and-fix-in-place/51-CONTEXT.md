# Phase 51: Section — Read and Fix in Place - Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

One route — `/s/[section]` — where an editor reads a section of the **current** issue as full-width prose and resolves factual, voice, and unsourced-claim problems inline, without leaving the paragraph. Delivers READ-01 … READ-08.

**In scope:** the reading surface, the merged inline marking of all three problem kinds, the in-paragraph finding popover (reasoning + evidence + accept / edit / dismiss), group-accept of a recurring correction, in-place block text editing, prev/next section navigation, and a derived "sections that still need you" count.

**Out of scope (later phases):** the nine-section table of contents and the publish footer (Phase 52, `/`), the admin door (Phase 53, `/admin/*`), the archive (Phase 54, `/archive`). Also out of scope for the whole milestone: retiring any v4.0 route, and any backend change — pipeline, the 9 agents / 20 nodes, Convex schema, Sanity, and the content-patch API are untouched. **Zero schema changes.**
</domain>

<decisions>
## Implementation Decisions

### A. Route, shell & reading surface

- **D-01: New `(editorial)` route group.** The surface lives at `app/(editorial)/s/[section]/` with its own minimal layout — no `AppSidebar`, no `Masthead`. `app/(dashboard)/` and every route inside it stays **byte-unchanged** (additive-first). Phases 52 (`/`) and 54 (`/archive`) drop in as siblings sharing this shell.
  - ⚠️ **Flag for Phase 52, not this phase:** `app/(dashboard)/page.tsx` already owns `/`. When Phase 52 adds the editorial `/`, the two groups will conflict at the same path and that must be resolved then. Phase 51 must not pre-empt it by adding a page at `/` in the new group.
- **D-02: The issue is always the current run.** Resolve via the locked chain `runs.latest → pipelineRuns.byRunId → issueNumber`, reusing the existing `lib/useCurrentRun.ts` / `lib/currentRun.ts`. **Never `max(issueNumber)`** (quick 260730-ldn fixed that; do not regress). No issue number in the path, no `?issue=` override, no `/i/[n]/s/[section]` form. Past issues are Phase 54's read-only concern.
- **D-03: `[section]` is the internal galley id, verbatim** — `/s/originStory`, `/s/problemStatement`, `/s/founderBio`, `/s/caseStudy`, `/s/bonus`, `/s/game`, `/s/deliberation-conversation`, `/s/podcast`, `/s/theme`. Same vocabulary as `lib/galley/sectionIdMap.ts`, the `galley-{id}` anchors, and `Galley`'s `sections` prop. **No slug↔id map is introduced** — a second vocabulary is a drift surface for a URL nobody types. Unknown segment → not-found, never a guessed section.
- **D-04: New typography is scoped to this surface only.** The Section surface sets its own ~760px reading measure and Lora **17.5px** body. `.galley-body` in `app/globals.css` **stays 16.5px/1.7** so Review Desk and Voice Pass render exactly as they do today. Do not change the shared class.
  - Also revisit `[id^='galley-'] { scroll-margin-top: 88px }` for this surface — that value was tuned for the v4 sticky stage-tab nav, which this page does not have.
- **D-05: Chrome is one slim header.** The issue's real derived title, linking back to the issue; the section name renders as the prose headline. Not sticky — it scrolls away. Nothing else above the prose: no rails, no tabs, no stage nav, no form fields.

### B. One surface, three kinds of problem

- **D-06: All axes render together — the axis partition is not applied here.** `Galley`'s `includeAxes` prop is **omitted** on this surface so factual findings, voice/machine-tell findings, and unsourced claims appear in one read. This is the point of the phase: Fact Check and Voice stop being destinations. `FACTUAL_AXES` / `VOICE_AXES` in `lib/galley/axisPartition.ts` are **not modified** — Review Desk and Voice Pass keep passing them.
- **D-07: Each mark carries a small always-visible text tag adjacent to the span** — Fact / Voice / Source. Readable **without opening the popover**, so READ-02's "distinguishable by label as well as colour" is satisfied literally and survives greyscale and colour-blindness. Implemented as an additive change to `AnnotationMark` / `ClaimMark`, not a new mark component.
- **D-08: One neutral action vocabulary for every finding kind** — e.g. Accept suggestion / Edit myself / Dismiss — supplied through `Galley`'s **existing** `labels` prop at the Galley level. Voice tells do **not** keep "Accept rewrite / Write my own / Keep (not a tell)" here. No per-finding label plumbing through `GallerySection` into `AnnotationMark`.
  - Preserve the Voice-Pass mechanic that rides on the label variant: a rule-only tell with no stored `suggestedFix` must still be acceptable (generate on demand, then apply via `suggestedFixOverride`). If that behaviour is currently keyed off `labels.accept === 'Accept rewrite'`, it needs a non-label-based trigger before D-08 can land — **flag for research**.
- **D-09: Only unsourced claims are marked.** Sourced / checked claims render as plain prose. `showProvenance` is not used to wash every tracked claim — READ-02 names "unsourced-claim problems", and a verified fact is not a problem. No toggle control on this surface.

### C. Recurring corrections (READ-04)

- **D-10: READ-04 means sibling findings that share a fix**, not one finding with an ambiguous span. The rules layer emits one `qaCorrections` row per occurrence, each with its own resolvable span and the same `suggestedFix`; "one action" accepts the group. **No change to `lib/galley/spanResolver.ts` ambiguity handling and no change to the accept endpoint's server-side resolution semantics.**
- **D-11: A group = same `axis` + identical `suggestedFix`, within the section.** Grouped client-side as a derived selector over rows already loaded — the codebase's established derived-selector pattern. Quoted spans may differ (the same word flagged inside different sentences still groups).
- **D-12: Group accept runs sequentially, refreshing the revision between each call.** Accept → refetch draft → re-resolve → accept the next with the fresh `revisionId`. This **honours** the Phase 33 D-06 `ifRevisionID` guard rather than routing around it. Never fire the group in parallel against one `revisionId`. Never add a server-side batch endpoint (backend untouched).
- **D-13: Partial failure applies what worked and says so plainly** — "3 of 5 applied — 2 still need you" — with the failed findings still marked in the prose and openable. No stop-at-first-failure, no rollback (undoing applied content patches would need a server transaction the endpoint does not have).

### D. Navigation & the derived count

- **D-14: All nine `EDITABLE_SECTIONS` get a `/s/[section]` destination**, each honest about what it is: prose sections carry inline marks; `game` renders its sandboxed iframe, `podcast` its player, `theme` its swatches — each **stating plainly that it carries no inline findings** rather than looking empty or broken. Consistent with Phase 36 D-03 (game and podcast exempt from tell-lighting) and Phase 35 D-06.
- **D-15: Prev / next live at the end of the prose**, not in the header and not in both places. You finish reading and the next section is there. Order follows `EDITABLE_SECTIONS`; first and last degrade honestly rather than wrapping silently.
- **D-16: READ-08 counts any section with open findings** — not must-fix only, and not two numbers side by side. One plain sentence. The editor decides what is serious; the count does not pre-judge.
- **D-17: `deriveSectionStates` (`lib/derivedState.ts`) is the single source of truth**, extended if needed. It already iterates the nine `EDITABLE_SECTIONS`, filters with the shared `isOpenFinding`, maps names via `qaSectionToGalleyId`, and returns `openCount`. Phase 52's table of contents will read the same selector. **Do not** use `deriveRunSections` here and **do not** create a third selector.
  - **Required cleanup in this phase:** `lib/derivedState.ts:24` imports `EDITABLE_SECTIONS` *upward* from `app/(dashboard)/review-desk/[runId]/_components/SectionChipList` — a shared selector depending on old-console route-private internals. Promote `EDITABLE_SECTIONS` (and `SectionMeta`) into shared `lib/`, and re-export from the old location so Review Desk keeps compiling unchanged.

### E. In-place editing (READ-05)

- **D-18: The marked block becomes editable exactly where it sits — text only.** Saving patches that one block through the existing content-patch API with the same `ifRevisionID` guard. **Structural block operations are not on this surface at all**: no change-type, no add, no delete, no reorder. No deep-link to `SectionEditorPanel` / `BlockEditor`, and no escape hatch back into the old console mid-read. The `PassageToolbar`'s "Edit text" action and `AnnotationMark`'s "Edit myself" both route here — `Galley`'s required `onEditSection` prop is wired to the in-place editor, not to a panel.
- **D-19: Explicit Save / Cancel per block.** Visible dirty state; a 409 has an obvious owner and an obvious retry. No save-on-blur, no debounced autosave — both fight the revision guard and can commit text the editor did not knowingly commit.

### F. Reasoning + evidence in one popover (READ-03)

- **D-20: The finding popover mounts the shared `ClaimProvenanceCard`** beneath the reasoning when the finding links to a tracked claim — source, publisher, supporting passage, retrieved date — so evidence is read in the paragraph. Honours Phase 42 D-09's one-component rule; **never fork the card**.
  - **Hard constraint (Pitfall 5, `AnnotationMark`):** the popover renders inside the galley's paragraph elements, so everything in it is **phrasing content** — spans with `display:block`, buttons, inputs. Never a block-level container and never a nested paragraph. If `ClaimProvenanceCard` currently emits block-level markup, it needs a phrasing-safe rendering mode — **flag for research**.

### G. Honest states

- **D-21: Three visibly different renders.** Loading = skeleton, never a clean-looking page. Not generated = the first-class Editor's-note block `Galley` already renders for empty sections (Phase 41 WSP-07 — keep byte-identical with `draftSectionIdsFromDraft`). Clean = the prose with an **explicit** "no open findings" line, so absence of marks is stated, not inferred. **Never render "clean" until findings AND claims have both resolved.** Loading, absent and clean are three different states.

### H. Passage toolbar

- **D-22: `PassageToolbar` stays mounted, wired to the same four actions** — Edit text, Inspect how this was made, Ask agent to revise, Related facts. It only appears on deliberate text selection, so it costs nothing while reading, and "Ask agent to revise" is the natural third option beside accept-the-suggestion and edit-it-yourself. Zero new component work; it is already mounted inside `Galley`. "Edit text" routes to the D-18 in-place editor.

### I. Decided by analysis (not asked — recorded so they are not re-opened)

- **D-23: No Phase 49 role gate applies to this surface.** The six Editor-in-chief-only actions are apply revision, confirm evidence replacement, approve the Voice Pass, publish, make an instruction active, mark an organization Do not use. Accept-fix, dismiss, and edit-text are **none of them** — a Collaborator can do everything on `/s/[section]`. Do not add a gate that does not exist today. (If `PassageToolbar`'s "Ask agent to revise" leads to *applying* a revision, that apply step **is** gated — wrap it with the existing `LockedControl`, never hide it.)
- **D-24: Review Desk, Voice Pass, and every other v4.0 route are not modified.** Their `includeAxes` filtering, labels, editors and behaviour stay exactly as shipped. The only permitted touch to old-console files is the D-17 `EDITABLE_SECTIONS` promotion, which must be re-export-compatible.
- **D-25: `useReviewedSections` is deleted.** Remove `app/(dashboard)/review-desk/[runId]/_components/useReviewedSections.ts` and its usage in `ReviewDeskRunView.tsx`. No "mark reviewed", no "mark done", no localStorage bookkeeping anywhere. A section reads clean because it has **no open findings**, never because someone ticked it.

### Claude's Discretion

- Exact popover markup and layout within the phrasing-content constraint.
- The in-place block editor's implementation (textarea vs contenteditable), focus and keyboard handling.
- Visual design of the Fact / Voice / Source tags within the 1c token system (hard edges 0–2px, four fonts four jobs, status never colour alone).
- Responsive behaviour of the 760px measure at narrow widths.
- Test strategy and file layout.
- Whether group-accept shows a confirmation or preview before applying.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Milestone definition & binding decisions
- `.planning/PROJECT.md` § "Current Milestone: v5.0 The Editorial App" — product definition, locked decisions, reconciliation facts (reuse-don't-rebuild list, backend-untouched, honesty rules, the one current-run resolution)
- `.planning/ROADMAP.md` § "v5.0 Phase Details — The Editorial App" preamble — reuse discipline, additive-first, no-bookkeeping
- `.planning/ROADMAP.md` § "Phase 51: Section — Read and Fix in Place" — goal, dependencies, five success criteria
- `.planning/REQUIREMENTS.md` § "Section — read and fix in place (READ)" — READ-01 … READ-08
- **Design contract (binding):** Claude Design project `38e48d39-1983-4178-a622-b21299a6ca0c` — **preview 21 (Section)** is this phase's contract; preview 20 (architecture + 31-route disposition) for context. Treated the way `docs/design/dispatch-control-v3/` was for v4.0.

### Interface contracts
- `docs/API_CONTRACTS.md` § "Phase 31 — Content-Patch Endpoints + Full Editing" (line ~2593) — block patch shape, `ifRevisionID` guard, `pt_to_blocks` lossy rules
- `docs/API_CONTRACTS.md` § "Phase 33 — Accept-Fix Wiring + Decision Rail" (line ~2835) — findings accept/dismiss endpoints, 409 shapes
- `docs/API_CONTRACTS.md` § "§35 — Provenance" (line ~3230) — claim_checks provenance fields
- `docs/API_CONTRACTS.md` § "§42 — Fact Check Stage" (line ~4379) — `importance`, claim shape consumed by `ClaimProvenanceCard`
- `docs/API_CONTRACTS.md` § "§45 — Agent Revision" (line ~5265) — the revision flow `PassageToolbar` calls
- `docs/API_CONTRACTS.md` § "§49 — Roles & Permissions" (line ~6007) — the six gated actions and locked-render copy
- `docs/API_CONTRACTS.md` § "Error handling rules" (line ~4041)
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` — §4 derived counters and must-fix definition, §5 claim shape
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — annotation severity and "unsupported central statistic = Must fix"

### Prior phase decisions this phase composes
- `.planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md` — D-05 server-resolved span replace, D-06 revision guard, D-07 accept gating, D-08 edit-inline deep-link (**superseded here by D-18**), D-09 unresolved/orphan card, D-11 dismiss reason
- `.planning/phases/36-voice-pass-de-slop-screen/36-CONTEXT.md` — D-03 game/podcast exempt, D-07 axis partition, D-09 accept/dismiss reuse, D-10 AnnotationMark label variant
- `.planning/phases/42-fact-check-stage/42-CONTEXT.md` — D-05 must-fix derivation, D-08 blank-never-means-verified, D-09 one shared `ClaimProvenanceCard`, D-10 field sourcing
- `.planning/phases/41-issue-workspace-frame/41-CONTEXT.md` — WSP-07 not-generated Editor's-note, `draftSectionIdsFromDraft` lockstep rule
- `.planning/phases/49-roles-permissions/49-CONTEXT.md` — the six gated actions, `LockedControl` render-locked-not-hidden rule

### Project instructions
- `CLAUDE.md` — GSD workflow enforcement, schema-change prohibition, conventions
- `docs/CLAUDE_CODE_BRIEF.md` — project spec and voice constraints
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (compose — do NOT fork any of these)
- **`apps/dispatch-control/components/galley/Galley.tsx`** — the whole-issue galley. Already has a `sections?: ReadonlyArray<string>` whitelist prop (quick 260724-i5n) added expressly so a single-section surface can reuse it. Mount it with `sections: [thisSectionId]`, `includeAxes` omitted (D-06), `labels` set (D-08), `showProvenance` per D-09. Required props: `runId`, `draft`, `revisionId`, `reloadDraft`, `onEditSection`. Optional: `onInspect`, `onRevise`, `onRelatedFacts`, `onUnsourcedClaimClick`.
- **`components/galley/AnnotationMark.tsx`** — the in-paragraph finding popover: axis · severity · reason · suggested fix, plus Accept / Edit inline / Dismiss (one-line reason required). Carries `id="finding-{id}"` + `data-finding-id` anchors. **Pitfall 5: phrasing content only.** Self-clamps horizontally.
- **`components/galley/ClaimMark.tsx`** + **`components/provenance/ClaimProvenanceCard.tsx`** — unsourced-claim wash and the one shared evidence card (Phase 42 D-09).
- **`components/galley/GallerySection.tsx`**, **`GalleryGameSlot.tsx`** (sandboxed iframe), **`UnresolvedFindingCard.tsx`** (section-end card for findings the resolver cannot place), **`PassageToolbar.tsx`** (selection toolbar, D-22).
- **`lib/galley/spanResolver.ts`** — `resolveSectionFindings`; 2+ matches with no usable `blockIndexHint` → `'ambiguous'` → `UnresolvedFinding`. **Unchanged by D-10.**
- **`lib/galley/findingState.ts`** (`isOpenFinding`), **`sectionIdMap.ts`** (`qaSectionToGalleyId`), **`googleFontLoader.ts`** (whitelist-validated theme fonts/accent), **`axisPartition.ts`** (`FACTUAL_AXES` / `VOICE_AXES` — read-only here).
- **`lib/derivedState.ts`** — `deriveSectionStates` → `{ state, openCount }` over `EDITABLE_SECTIONS`; `draftSectionIdsFromDraft`; `deriveFactCheckSummary`.
- **`lib/findingsClient.ts`** (`acceptFinding`, `dismissFinding`, `FindingsError`), **`lib/contentPatchClient.ts`** (`DraftResponse`, block patch), **`lib/useCurrentRun.ts`** / **`lib/currentRun.ts`** (D-02 resolution), **`lib/revisionClient.ts`**, **`lib/role.ts`** + **`components/LockedControl.tsx`**.
- **Fonts already wired:** `app/layout.tsx` loads Lora as `--font-lora` → `--font-body`. No new font work — only a scoped size/measure (D-04).

### Established Patterns (constrain this phase)
- **Derived selectors, never stored state** — every count is a pure function of current rows (`lib/derivedState.ts` is the model). No counters, no localStorage.
- **Zero direct Sanity writes from the dashboard** — content mutations go through the pipeline API; only Convex status flips are called directly (`ClaimMark` → `claimChecks:setStatus` is the documented EDT-05 exception).
- **Revision-guarded writes** — every content patch carries the rendered `ifRevisionID`; mismatch → 409 → refetch → re-resolve → retry.
- **`Galley` is a render surface** — it performs no Convex mutation itself. Keep it that way; the in-place editor (D-18) is a child concern wired through `onEditSection`.
- **1c design tokens (Phase 30)** — hard edges 0–2px, four fonts four jobs, status never colour alone, no literal Tailwind greys (use `var(--color-*)`).

### Integration Points
- New: `app/(editorial)/layout.tsx` + `app/(editorial)/s/[section]/page.tsx`.
- Modified (shared): `lib/derivedState.ts` — extend `deriveSectionStates` if needed and fix the D-17 upward import.
- Modified (galley, additive/optional props only): `AnnotationMark.tsx`, `ClaimMark.tsx`, `Galley.tsx`, `GallerySection.tsx`.
- Moved: `EDITABLE_SECTIONS` / `SectionMeta` from `app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx` into shared `lib/`, re-exported from the old path.
- Deleted: `app/(dashboard)/review-desk/[runId]/_components/useReviewedSections.ts` and its usage in `ReviewDeskRunView.tsx` (D-25).
- New CSS scoped to the editorial surface in `app/globals.css` — **without** altering `.galley-body`.

### Known hazards
- `lib/derivedState.ts:24` reaches into an old-console route-private `_components` folder for `EDITABLE_SECTIONS` (D-17).
- `AnnotationMark`'s Voice-Pass on-demand-rewrite path may be keyed off `labels.accept === 'Accept rewrite'`; D-08 replaces those labels, so that trigger must be re-based first (D-08 flag).
- `ClaimProvenanceCard` may emit block-level markup that cannot legally nest in the popover (D-20 flag).
- `[id^='galley-'] { scroll-margin-top: 88px }` assumes a sticky nav this surface does not have (D-04).
- Convex functions must be live-synced after any `convex/*.ts` change — but this phase anticipates **none**.
- Run `pnpm --filter dispatch-control build` (strict) before declaring done; vitest does not type-check.
</code_context>

<specifics>
## Specific Ideas

- "A page to read, not a workspace to navigate" — the phrase to test every layout decision against.
- The editor never thinks "I am in the Fact Check stage"; they think "this sentence is wrong." Fact and Voice stop being destinations in this phase — that is the whole point, not a side effect.
- Navigation as the consequence of reading: you finish the section and the next one is there (D-15), rather than a control you scan for.
- Three consecutive UI passes were rejected before this milestone. The recorded lesson: **design in Claude Design and get sign-off before writing code.** Preview 21 is the contract, not a mood board.
- Group accept honesty: "3 of 5 applied — 2 still need you" is the shape of every partial-result message here.
</specifics>

<deferred>
## Deferred Ideas

- **The nine-section table of contents, derived per-section state display, the one honest sentence, and the publish footer** — Phase 52 (`/`), which reads the same `deriveSectionStates` selector this phase settles on.
- **Resolving the `/` route conflict** between `app/(dashboard)/page.tsx` and the new editorial `/` — Phase 52.
- **Relocating operational surfaces behind `/admin/*`** — Phase 53. Phase 51 must not link into operational tooling (DOOR-03).
- **Archive by title, subject search, published/held/scheduled labels** — Phase 54.
- **Retiring the v4.0 console routes** — explicitly out of scope for the entire v5.0 milestone; belongs to a later milestone. The old console must remain publishable throughout (DOOR-04).
- **Ambiguous-span "apply to all occurrences"** (one finding whose quoted text appears N times) — would require resolver and accept-endpoint changes, i.e. backend work. Not this milestone.
- **A server-side batch accept endpoint** — correct atomic semantics for group accept, but backend work; revisit only if D-12's sequential loop proves too slow in practice.
- **Multi-writer / non-charity topics** — stated future upgrade, explicitly out of scope for v5.0.
- **Responsive/mobile treatment of the reading measure, mid-flight section streaming, and bonus-variant renders (spec ad / jingle)** — raised but not discussed; left to research and planning discretion within the decisions above.
</deferred>

---

*Phase: 51-section-read-and-fix-in-place*
*Context gathered: 2026-07-31*
