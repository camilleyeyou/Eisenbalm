# Phase 33: Accept-Fix Wiring + Decision Rail - Context

**Gathered:** 2026-07-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Operator can act on any QA finding directly from the galley — Accept fix / Edit inline / Dismiss with a one-line reason — with every action mutating the real draft via Phase 31's content-patch machinery and audit-logged ("nothing silent"). After any content patch, annotation anchors are re-resolved against the updated content; findings that can no longer anchor surface for operator review, never dropped. A blockers-first decision rail shows unresolved error-severity findings first and gates Publish until they're resolved, plus the editor memo, hook card, and a verification summary with an affirmative timestamp state. Requirements: GLY-03, GLY-04, EDT-04, EDT-06.

**Explicitly NOT in scope:** the two-sign-off publish gate + Studio bypass retirement (Phase 34 — but see D-14: this phase adds a server-side open-error-findings check to the existing publish endpoint, which Phase 34 extends with the sign-off pair); provenance sourced/unsourced rendering + source index (Phase 35); voice-pass machine-tell screen (Phase 36); hookClaim/hookVerified data model (Phase 37 Signal Desk — D-12 stands in with pitchLog data).

</domain>

<decisions>
## Implementation Decisions

### Finding lifecycle & dismiss
- **D-01:** **Resolution modeled as a status enum** on Convex `qaCorrections`: new optional fields `resolution: 'accepted' | 'dismissed'` (absent = open), `resolutionReason` (required for dismiss), `resolvedBy`, `resolvedAt`. The legacy `accepted: boolean` stays and is kept in sync (accept → `accepted: true`) for back-compat with Phase 26 surfaces.
- **D-02:** **Accept/dismiss writes go through new pipeline endpoints** (e.g. `POST /issues/{run_id}/findings/{finding_id}/accept|dismiss` — exact shapes at Claude's discretion, contract-first). The endpoint orchestrates: the Sanity content-patch (accept only), the Convex finding-state flip, and the audit row — following the Phase 26/31 pattern (Clerk-JWT guard, `_emit_audit`, 409 detail shapes). Zero direct Sanity writes from the dashboard is preserved; the Convex resolution flip also flows through the pipeline API, not a dashboard-side Convex mutation.
- **D-03:** **Dismissed findings are hidden** from galley spans and chip counts, exactly like Phase 32 D-08 accepted findings. History stays in the audit log and the Phase 26 review page. The galley remains a pure to-do surface.
- **D-04:** **Reopen action, no text revert.** A resolved finding (accepted or dismissed) can be reopened — logged like everything else — which returns it to open state and galley visibility. Reopen does NOT reverse the text change from an accept; Andrew re-edits via the section editor if needed.

### Accept-fix mechanics
- **D-05:** **Span replace, server-resolved.** The accept endpoint re-resolves `quotedSpan` (+ `blockIndexHint`) server-side against the current draft and replaces exactly that span with `suggestedFix` inside its block, applied through the Phase 31 scoped-patch machinery. If server-side resolution fails or is ambiguous → 409 with a reason; the popover tells Andrew to use Edit inline instead. Never apply a guessed anchor (mirrors Phase 32 D-12).
- **D-06:** **Revision guard on accept**, same as Phase 31 D-10 saves: the accept request carries the Sanity revision the galley rendered from; mismatch → 409, galley refetches + re-resolves, Andrew re-clicks on the fresh view. No compounding on top of unseen edits.
- **D-07:** **Accept is gated:** hidden/disabled when `suggestedFix` is absent OR the finding is unresolved/orphaned (nothing to anchor the replacement to). Those findings offer Edit inline + Dismiss only, and the popover states why Accept is unavailable.
- **D-08:** **Edit inline = open the Phase 31 section editor** (the Phase 32 D-01 edit affordance) for that section, scrolled/focused to the finding's block, with the finding's reason visible for reference. No second editing surface. Saving there triggers re-resolution naturally (D-09).

### Post-edit re-resolution & orphans
- **D-09:** **One bucket, one card.** "Orphaned" (anchor invalidated by an edit) and "unresolved" (never anchored) are the same state — the stateless Phase 32 resolver (D-13: fresh re-resolution on every draft/finding change via Convex reactivity) can't distinguish them and shouldn't try. Both render in Phase 32's section-end unresolved card with honest copy ("couldn't locate this text in the current draft"). EDT-06's re-resolution requirement is satisfied by the existing resolver recomputing after every patch; this phase's work is the review surface + actions, not a new resolution mechanism.
- **D-10:** **Section card + rail rollup.** The section-end card stays the in-context home; the decision rail also lists unresolved findings (error-severity ones among the blockers) with jump links. The rail answers "is anything unaccounted for"; the card gives full context.
- **D-11:** **Orphan/unresolved actions: Dismiss + Edit inline** from the section-end card (e.g. dismiss reason "fixed by my edit"). No Accept (consistent with D-07). No manual re-anchor UI this phase.
- **D-11b:** **Error-severity findings block Publish regardless of anchor state.** An error finding blocks until explicitly accepted or dismissed — losing its anchor must never silently un-block Publish.

### Decision rail composition
- **D-12:** **Hook card slot renders the selected charity from pitchLog** (name + `scoutSummary` — the closest existing thing to "the hook") since `hookClaim`/`hookVerified` don't exist until Phase 37. Phase 37 upgrades the card in place. Rail layout matches the design now, with no fake data.
- **D-13:** **Verification summary gets a real timestamp:** add `checkedAt: v.optional(v.number())` to Convex `claim_checks`, stamped when a claim flips to checked/skipped. Rail shows claims progress ("X/Y claims checked") + open QA finding counts + "last checked Nm ago". Optional field means legacy rows degrade to an honest "not yet checked" — the affirmative-state rule ("never blank") holds either way.
- **D-14:** **Publish gated client + server now.** The rail disables Publish with a reason ("1 blocker to clear"); AND the existing Phase 26 publish endpoint (`POST /issues/{run_id}/publish`) gains a 409 when open error-severity findings exist for the run. Phase 34 layers the two-sign-off pair on top of this check. UI-only blocking would be cosmetic.
- **D-15:** **All four rail actions ship, wired to existing backends:** Publish → Phase 26 publish endpoint (now gated per D-14); Hold → Phase 26 reject/hold flow; Re-run section ▾ → existing `rerun_agent` endpoint; Transcript → link/jump to the deliberation conversation. Wiring, not new capability.
- **D-16:** **Editor memo** sources from the `editor-final` deliberationEvents row (payload carries `editor_final_notes`).
- **D-17:** Rail headline follows the design: blocker/warning count summary line, Blocking-items checklist first, then memo, hook card, verification block, actions — per `docs/design/dispatch-control-v2/README.md` §Review Desk (336px, bg `#f1f0ea`).

### Claude's Discretion
- Exact endpoint shapes/granularity for accept/dismiss/reopen (contract-first: amend `docs/API_CONTRACTS.md` before code — CLAUDE.md hard rule).
- Whether reopen is its own endpoint or a state-transition parameter on one findings endpoint.
- Server-side span resolution implementation (port of the TS resolver's normalization rules to Python vs a simpler exact+normalized match — must honor D-05's never-guess rule).
- Popover action-row layout/affordances inside `AnnotationMark.tsx` (the Phase 32 placeholder), dismiss-reason input UX, optimistic-UI vs refetch-after-write.
- Rail blocking-item checklist micro-UX, estimated-minutes heuristic in the headline (design shows "~4 min" — fine to approximate or omit if noisy).
- How the rail's "warnings" count treats info-severity findings.
- Where the `checkedAt` stamp is written (Convex mutation used by the Phase 26 ClaimsChecklist).

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 33 — goal + 4 success criteria.
- `.planning/REQUIREMENTS.md` — GLY-03, GLY-04, EDT-04, EDT-06 (PUB-* two-sign-off items are Phase 34 — do not pull them in beyond D-14's error-findings check).
- `.planning/PROJECT.md` §Current Milestone — locked v3.0 decisions (write boundary, "nothing silent").

### Prior phase contexts (direct dependencies — decisions carried forward)
- `.planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md` — D-08 (accepted hidden), D-10 (popover gains actions in place), D-12 (never guess), D-13 (client resolver module reused for re-resolution).
- `.planning/phases/31-content-patch-endpoints-full-editing/31-CONTEXT.md` — D-07/D-09/D-10 (explicit save, audit snapshots, revision guard), endpoint patterns.

### v3.0 research
- `.planning/research/SUMMARY.md` — span-anchoring reconciliation note; scoped patches preserve block identity (the invariant re-resolution relies on).
- `.planning/research/ARCHITECTURE.md`, `.planning/research/PITFALLS.md` — resolver design + anchor-orphaning risk.

### Design handoff (binding)
- `docs/design/dispatch-control-v2/README.md` §Review Desk (line ~38-40) — decision rail spec: blockers-first headline, Blocking items checklist, Editor's memo, Hook card, Verification block with affirmative states, Actions (Publish/Hold/Re-run section ▾/Transcript); rail 336px bg `#f1f0ea`.
- `docs/design/dispatch-control-v2/Dispatch Control - Review Desk Directions.dc.html` — visual directions.
- `docs/design/dispatch-control-v2/Dispatch Control.dc.html` — 1c tokens.
- `docs/design/dispatch-control-v2/DECISIONS.md` — house rules ("nothing silent").

### Contract boundary (hard rule)
- `docs/API_CONTRACTS.md` — amend BEFORE code: new findings accept/dismiss/reopen endpoints (§33.x), the publish endpoint's new 409 condition, the `qaCorrections` resolution fields, and `claim_checks.checkedAt`.

### Existing code (build on these)
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/AnnotationMark.tsx` — the Phase 32 popover with the explicit Phase 33 action-row placeholder comment.
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/UnresolvedFindingCard.tsx` — section-end card that gains Dismiss + Edit inline actions (D-11).
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/` — `Galley.tsx`, `GallerySection.tsx`, `SectionChipList.tsx`, `SectionEditorPanel.tsx` (Edit-inline target, D-08).
- `apps/dispatch-control/lib/galley/spanResolver.ts` — the stateless client resolver (D-09 relies on its recompute-on-change behavior; D-05's server resolution should mirror its normalization rules).
- `apps/dispatch-control/lib/contentPatchClient.ts` — §31.7 client pattern for the new findings-action client.
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py` — publish/schedule/reject endpoints (D-14's 409 lands in `publish_issue`; D-15's Hold wiring); the Clerk-JWT + `_emit_audit` + 409-detail pattern to clone for findings endpoints.
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` — `_emit_audit`, `_require_clerk_jwt_control`, `rerun_agent` (D-15's Re-run section target).
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py` — Phase 31 scoped-patch machinery the accept endpoint applies through (D-05), incl. the `ifRevisionID` guard (D-06).
- `convex/schema.ts` — `qaCorrections` (~L70; D-01 fields land here), `claim_checks` (~L396; D-13 `checkedAt`), `pitchLog` (~L103; D-12 data source: `by_runId_and_selected` index), `deliberationEvents` (D-16 editor-final row).
- `convex/qaCorrections.ts` — currently `byRunId` query + `insert` mutation only; resolution-flip mutation(s) added here, called from the pipeline (D-02).
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/ClaimsChecklist.tsx` — where claim status flips (D-13 `checkedAt` stamp) — this page stays byte-functional (Phase 31 D-03 fallback).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Popover placeholder** — `AnnotationMark.tsx` was built (Phase 32 D-10) with a marked slot for the action row; already has keyboard/outside-click/escape handling and the finding payload (`findingId`, `severity`, `axis`, `reason`, `suggestedFix`, `quotedSpan`).
- **Resolver recomputes for free** — `spanResolver.ts` runs at render against live Convex findings + the draft-read; any content patch triggers re-resolution automatically. EDT-06's mechanism already exists; this phase builds the review surface.
- **Phase 31 patch machinery** — scoped section patches with `ifRevisionID`, audit rows with before/after snapshots; the accept endpoint composes these rather than reinventing.
- **Phase 26 endpoint skeleton** — `review.py` demonstrates the exact guard/audit/409 shape for the new findings endpoints; `publish_issue` is where the D-14 gate check inserts.
- **Rail data all queryable**: open findings via `qaCorrections.byRunId` (filter resolution absent), claims via `claim_checks.by_runId`, selected charity via `pitchLog.by_runId_and_selected`, editor memo via deliberationEvents `editor-final`.

### Established Patterns
- Contract-first: `docs/API_CONTRACTS.md` amended before any endpoint/schema code.
- "Nothing silent": every mutation gets an audit row with actor + content evidence.
- Dashboard → pipeline API → Sanity/Convex; no direct writes from dispatch-control (EDT-05 source scan enforces the Sanity side).
- Convex reactivity: rail counts and galley spans update live after each action — no manual refetch orchestration needed beyond the revision-guard reload path.
- 1c design system tokens/chrome (Phase 30) already wrap the Review Desk.

### Integration Points
- `/review-desk/[runId]` — the rail mounts as the design's right column (336px) beside the Phase 32 galley; popover + section-end card gain actions in place.
- `POST /issues/{run_id}/publish` — gains the open-error-findings 409 (D-14); Phase 34 extends the same gate with sign-offs.
- Convex `qaCorrections` — resolution fields (D-01) consumed by galley span filter (extends Phase 32's accepted-hidden logic), chip counts, and rail blockers.
- Phase 34 builds directly on D-14's server-side gate; Phase 35's source index later joins the rail; Phase 37 upgrades the D-12 hook card in place.

</code_context>

<specifics>
## Specific Ideas

- Roadmap success-criterion language to honor literally: "nothing is silent" (every accept and dismiss logged), and orphaned annotations are "surfaced for operator review, not dropped."
- The design README's rail spec is the layout north star: headline count ("1 blocker to clear · 2 warnings · ~4 min"), Blocking items checklist first, Editor's memo, Hook card, Verification block with affirmative states ("checked 2m ago" — never blank), Actions row.
- The gate philosophy from discussion: a UI-disabled Publish button alone is cosmetic — the server must refuse too (D-14). And losing an anchor must never quietly clear a blocker (D-11b).

</specifics>

<deferred>
## Deferred Ideas

- **Two-sign-off publish gate ("Facts cleared" + "Sounds human") + webhook re-validation + Studio bypass retirement** — Phase 34, layering on D-14's server check.
- **hookClaim/hookVerified data model + gate badges** — Phase 37 Signal Desk; D-12's pitchLog card upgrades in place.
- **Sourced/unsourced claims in the rail (source index, jump links)** — Phase 35.
- **Manual re-anchor UI for orphaned findings** (select text in galley to re-attach) — considered, not chosen (D-11); revisit only if dismiss-as-addressed proves lossy in real weekly use.
- **Distinct orphaned-vs-unresolved states with resolution history** — considered, not chosen (D-09); would require persisting resolver state.
- **Full undo with text revert from audit snapshots** — considered, not chosen (D-04); snapshots are truncated and interleaved edits make reverts unsafe.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 33-accept-fix-wiring-decision-rail*
*Context gathered: 2026-07-07*
