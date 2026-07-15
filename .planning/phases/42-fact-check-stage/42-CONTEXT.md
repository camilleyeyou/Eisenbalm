# Phase 42: Fact Check Stage - Context

**Gathered:** 2026-07-15 (`--auto` mode — recommended defaults auto-selected; see DISCUSSION-LOG.md)
**Status:** Ready for planning

<domain>
## Phase Boundary

Stage 3 (Fact Check) goes live inside the Phase 41 Issue Workspace frame — **the only genuinely new stage in the v4.0 milestone**. It replaces the Phase 41 first-class placeholder (`fact-check/FactCheckPlaceholder.tsx` + `FactCheckPanelContent.tsx`) with the real claim-verification workspace, built on the Phase 35 provenance substrate (`claim_checks` with `claimId`/`sourceUrl`/`retrievedAt`/`sectionName`) plus **one new Researcher-emitted field: `importance`**.

The stage delivers, for one issue run:
1. An **affirmative summary** (claims checked X of Y · must fix · conflicting sources · checks not run · changed since check · last verified) where **blank never stands in for verified** (FCT-02).
2. A **filterable claim table** (must fix / unchecked / changed / numbers & dates / people & titles / organization claims / weak source) (FCT-03).
3. A **provenance card** on claim selection — the SAME component reused in Draft (Stage 2), Approval (Stage 5), and the Phase 44 inspector (FCT-04).
4. **Six claim actions** — Confirm · Edit claim · Replace source · Remove claim · Keep as written (+required reason) — each updating counters, My Tasks, Approval readiness, and header status (FCT-05).
5. **"Ask agent for better evidence"** — returns a replacement source AND a rewritten claim together; confirming applies both atomically (content patch + claim update) and records a decision-log entry (FCT-06). This ESTABLISHES the shared span-scoped agent-revision endpoint contract, claim-scoped first.
6. **Revision → unchecked**: a content revision touching a claim's block returns that claim to unchecked and increments the "changed since check" counter, even when the replacement text is itself sourced (FCT-07).

**Pipeline change (the one net-new backend concept):** the Researcher emits an `importance` tier (Load-bearing / Supporting / Incidental) on every claim, carried through to `claim_checks` (FCT-01).

**Not in this phase (deferred):**
- The Phase 45 **generalization** of the FCT-06 revision endpoint to arbitrary passage revision (Phase 42 builds the claim-scoped endpoint; Phase 45 generalizes the SAME one — do not build a second).
- The Phase 44 **"Inspect how this was made"** panel itself (Phase 42 builds the reusable provenance card and an "Inspect" entry point, but the 7-tab inspector is Phase 44).
- The Phase 43 **My Tasks screen** and the formal shared **Decision Log** component (the derived task projection and `audit_log` trail already exist; Phase 42 writes to them, it does not build the Phase 43 screen/component).
- **Role/permission gating** of the six actions — locked-control *rendering* is Phase 49 (Phase 42 builds the actions for the editor; structure the controls so §6 role-gating wraps them).
- Console-wide **nomenclature ripple** — Phase 50.

</domain>

<decisions>
## Implementation Decisions

### A. `importance` field — the one pipeline change (FCT-01)

- **D-01: `importance` is a NEW optional field on the `claim_checks` Convex table** (`importance: v.optional(v.union(v.literal('Load-bearing'), v.literal('Supporting'), v.literal('Incidental')))`), additive exactly like the Phase 35 provenance fields (legacy rows omit it). Extend `convex/claimChecks.ts::insertBatch` args and `convex/schema.ts`. Contract-first: amend `docs/API_CONTRACTS.md` (new §42) before code, per the Ph35/38/39 pattern.
- **D-02: The Researcher emits `importance` per claim; it flows to `claim_checks` at publish-time claim merge.** The Researcher (`packages/pipeline/.../agents/researcher.py`) tags each fact it surfaces with an importance tier; the publisher binds that tier onto the writer-bound (sourced) `claim_checks` rows via the existing `claimId` linkage (§35.5 merge). **Exact Researcher prompt/schema plumbing and the claimId→importance join is for the phase-researcher to map** — the decision here locks that importance is Researcher-emitted and lands on `claim_checks`, not how the LLM call is shaped.
- **D-03: Deterministic-only (unsourced) claims and legacy rows get a defined `importance` fallback so the summary math is total.** Today's `lib/claims.py` extractor is deterministic (regex; number/date/proper_noun) with no importance concept and produces the unsourced rows. Because `mustFixCount = unsourced load-bearing claims` (DERIVED-STATE-CONTRACT §4), an unsourced row must have a resolvable importance to be counted or excluded. **Fallback = `Supporting`** (never silently `Load-bearing`, so a deterministic unsourced number never fabricates a must-fix) unless the phase-researcher finds a cheap heuristic to promote clearly load-bearing unsourced statistics. Legacy rows with no `importance` render as `Supporting` in the card and are excluded from must-fix — **but never render blank** (D-08).

### B. Summary counters & severity — derived, not stored (FCT-02, FCT-05)

- **D-04: The affirmative summary is a PURE DERIVED SELECTOR over the `claim_checks` rows**, following DERIVED-STATE-CONTRACT §4 verbatim — mirroring the established `lib/derivedState.ts` selector pattern. Add `deriveFactCheckSummary(claimRows)` returning `{ factCoverage: "X of Y", mustFixCount, changedCount, uncheckedCount, conflictsCount, checksNotRunCount, lastVerifiedAt }`. No stored counters — the numbers are always a function of current rows, which is why "each action updates counters/My Tasks/Approval/header" needs no explicit fan-out wiring (all four surfaces read derived selectors).
- **D-05: Severity is derived per claim, not stored.** `Must fix = importance === 'Load-bearing' && !sourceUrl` (unsupported central statistic). Everything else = `Review recommended` / `Information` (unsourced atmospheric detail). This is the DERIVED-STATE-CONTRACT §4 mustFix definition and the §Annotations "unsupported central statistic = Must fix" rule, made mechanical.
- **D-06: `changedCount` is a block-level touched-counter, not re-verification** (§4). It counts `claim_checks` rows whose block was touched by an applied revision since their last check — implemented via the D-14 "changed since check" marker. Increments even when the replacement text is itself sourced.
- **D-07: `conflictsCount` and `checksNotRunCount` get pragmatic, honest derivations — never blank-as-verified.** Recommended default: `checksNotRunCount` = rows that are `pending` AND have no `sourceUrl` AND were never through a check attempt (i.e. the pipeline never verified them); `conflictsCount` = rows carrying an explicit conflict marker (a new optional `claim_checks.conflict` boolean set only by Replace-source / Ask-agent flows that detect a source disagreement) — `0` until such a flow sets it, surfaced as an explicit "0 conflicting sources", never omitted. **Exact predicates are Claude/phase-researcher discretion**, bounded by: every claim renders one explicit state and blank never means verified (§4, FCT-02).
- **D-08: "Blank never means verified" is a hard rule.** Every claim renders an explicit state chip (`✓ Checked` / `✕ Must fix` / `Unchecked` / `Review recommended` / `Changed`). The summary renders every counter even at zero ("0 conflicting sources", "0 changed since check"). This carries the Phase 41 placeholder's honesty rule forward.

### C. The reused provenance card component (FCT-04)

- **D-09: Build ONE shared provenance card component** (e.g. `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx`) rendering the DERIVED-STATE-CONTRACT §5 claim shape: `{ text, importance, status, sourceUrl, sourcePublisher, supportingPassage, retrievedAt, agent, confidence }`. It is consumed by **Stage 3 Fact Check** (context-panel claim detail), **Stage 2 Draft** (on claim selection — replacing/feeding the current `ClaimMark`/`AnnotationMark` popover surface), **Stage 5 Approval** (replacing/feeding `SourceIndex.tsx`'s per-claim rows), and the **Phase 44 inspector** (Sources tab). Do NOT fork three copies — this is a named FCT-04 requirement ("the same component reused").
- **D-10: Field sourcing — only `importance` is genuinely new; the rest derive** (DERIVED-STATE-CONTRACT §5: "New field required: importance"). `text`/`status`/`sourceUrl`/`retrievedAt`/`sectionName` come straight from `claim_checks`; `sourcePublisher` = derived from `sourceUrl` host; `supportingPassage` = `context` (± `blockIndexHint` window); `agent` = derived from `sectionName → writer` map (mirrors §8 `sectionName → writer → agent_runs`); `confidence` = sourced-claim metadata if the writer/Researcher recorded it, else rendered "—" (never blank-as-verified). Any field that needs a new stored value beyond `importance` must be justified against the "only importance is new" contract stance during planning.
- **D-11: The six actions live on the card, structured for Phase 49 role-gating.** Render the action controls (Confirm · Edit claim · Replace source · Ask agent for better evidence · Remove claim · Keep as written · Open source · Inspect) for the editor now; structure them so Phase 49 can wrap them with the §6 locked-render ("Apply revision 🔒 editor only"). Do NOT hide controls; Phase 49 renders locked-with-explanation.

### D. Claim table filters (FCT-03)

- **D-12: Filters are pure client-side derived predicates over the loaded claim list — no new Convex queries.** Multi-select filter chips: `must fix` (D-05), `unchecked` (`status === 'pending'`), `changed` (D-14 marker), `numbers & dates` (`claimType ∈ {number, date}`), `people & titles` + `organization claims` (both `claimType === 'proper_noun'` today), `weak source`.
- **D-13: `people & titles` vs `organization claims`, and `weak source`, use documented heuristics — refinement deferred to research.** Today `claimType` is only `number|date|proper_noun` (no person/org split). Recommended default: a light heuristic splits proper_noun via org-suffix detection (Trust/Foundation/Society/Inc/LLC/Institute → org; else person/title); `weak source` = unsourced OR a sourced claim whose source fails a quality heuristic (no resolvable publisher / low-authority TLD). **Exact heuristics are phase-researcher discretion.** If a heuristic proves unreliable, ship both proper_noun filters against the same set with a documented limitation rather than inventing a stored subtype — do not expand `claimType`'s stored vocabulary in this phase without contract amendment.

### E. The six claim actions & their write boundaries (FCT-05)

- **D-14: Status-only actions are dashboard Convex mutations; content-touching actions go through the pipeline write boundary.**
  - **Confirm** → `convex/claimChecks.ts::setStatus('checked')` (exists, operator-guarded). No content mutation.
  - **Keep as written (+required reason)** → a `checked`-equivalent terminal status + a decision-log entry (D-18). Reason is mandatory (empty reason rejected).
  - **Edit claim · Replace source · Remove claim** mutate the claim record and/or issue content, so they go **dashboard → pipeline API → Convex/Sanity, logged to `audit_log`** (EDT-05 write boundary). New endpoints (recommended home: a new `api/factcheck.py` router, or extend `api/content.py`), each guarded by `_require_clerk_jwt_control` and emitting a truncated before/after audit row via `_emit_audit` — mirroring the existing `content.py` pattern. The standing `dispatch-control-no-sanity-write.test.ts` source-scan tripwire forbids direct Sanity writes from the console — these actions honor it.
- **D-15: "Edit claim" edits the claim record via the pipeline boundary, and if the edit changes the underlying prose it also content-patches Sanity.** Replace source updates `sourceUrl` (+ code-stamped `retrievedAt`); Remove claim removes/tombstones the `claim_checks` row. **Exact split of what lives in `claim_checks` vs Sanity content for "Edit claim" is planning-time discretion**, bounded by the write-boundary rule and contract-first amendment.
- **D-16: No explicit cross-surface update wiring.** Because counters (D-04), My Tasks (Phase 40 derived projection), Approval readiness (DERIVED-STATE-CONTRACT §1), and header status are all derived selectors over the same Convex data, a single mutation propagates to all four via Convex reactivity. FCT-05's "updates counters, My Tasks, Approval readiness, header status" is a **verification target**, not a set of manual writes.

### F. "Ask agent for better evidence" — the shared revision endpoint (FCT-06)

- **D-17: Two-step endpoint — preview then apply — that ESTABLISHES the span-scoped agent-revision contract (claim-scoped first; Phase 45 generalizes the SAME endpoint).** Step 1: a request endpoint asks the evidence agent (Researcher lane) for a replacement source + rewritten claim and returns BOTH for a comparison card — **no mutation**. Step 2: a confirm endpoint applies both **atomically** — content patch (rewrites the claim's prose in Sanity through the existing `content.py` machinery) + `claim_checks` update (new `sourceUrl`/`retrievedAt`/`text`, status) — and records a decision-log entry (D-18). Design the request/response shape to generalize to arbitrary passage revision so Phase 45 extends it rather than forking. Contract-first in `docs/API_CONTRACTS.md` §42. Sits behind EDT-05; logged to `audit_log`; no direct console→Sanity write.
- **D-18: "Decision-log entry" = write to the existing `audit_log` trail for now; the formal Decision Log component is Phase 43.** Every reason-requiring action here (Keep as written, Ask-agent confirm) writes an `audit_log` row (actor, action, before/after, reason). Phase 43 builds the shared Decision Log as a projection over this same trail — do NOT build a separate decision store in Phase 42.

### G. Revision → unchecked + "changed since check" (FCT-07)

- **D-19: Extend the existing `content.py` patch endpoints to reset touched claims, reusing the sign-off-revocation hook point.** Every content-patch endpoint in `api/content.py` already calls `_revoke_active_signoffs(...)` after a mutation. Add a parallel `_reset_touched_claims(run_id, sectionName, blockIndexHint)` that, for any `claim_checks` row anchored to a touched block (`sectionName` + `blockIndexHint`, the anchors Phase 35 already stores), sets `status = 'pending'` (returns it to unchecked) and sets the D-14 "changed since check" marker — **even when the replacement text is itself sourced** (block-level touched-counter, §4).
- **D-20: The "changed since check" marker is a new optional `claim_checks` field** (e.g. `changedSinceCheck: v.optional(v.boolean())` or a `changedAt` timestamp), set by a new operator/pipeline Convex mutation the content endpoints call; `changedCount` (D-06) counts set rows. Cleared when the claim is next checked. Additive/optional like all Phase 35 fields.

### H. Cross-cutting discipline (applies to every decision above)

- **D-21: Contract-first.** Amend `docs/API_CONTRACTS.md` with a new **§42** (claim shape + `importance` field + the six action endpoints + the FCT-06 request/apply contract + the `changedSinceCheck`/`conflict` fields) BEFORE writing code — the established Ph35/38/39 pattern the Phase 41 CONTEXT also mandates.
- **D-22: Reuse, do not rebuild.** Consume `lib/derivedState.ts`, the Phase 35 claim rendering (`ClaimMark`/`AnnotationMark`/`spanResolver`), the `content.py` write-boundary + audit pattern, and `convex/claimChecks.ts`. New net-new: the `importance`/`changedSinceCheck`/`conflict` fields, the fact-check summary selector, the shared provenance card, the six-action endpoints, and the FCT-06 revision endpoint. Everything else is additive on shipped substrate.
- **D-23: Every state renders label + icon, never color alone** (design-system rule); the claim table and summary follow it.

### Claude's Discretion
- Exact Researcher prompt/schema for emitting `importance`, and the publisher claimId→importance join mechanics (D-02).
- Whether unsourced deterministic claims get a flat `Supporting` fallback or a light load-bearing heuristic (D-03).
- Concrete predicates for `conflictsCount` / `checksNotRunCount` and whether `conflict` needs a stored field (D-07).
- Heuristics for `people & titles` vs `organization claims` and `weak source` (D-13).
- Endpoint home for the six actions (`api/factcheck.py` new router vs extending `api/content.py`) and the FCT-06 request/apply split (D-14, D-17).
- What "Edit claim" splits between `claim_checks` and Sanity content (D-15).
- Provenance card file location and the exact refactor path for Draft/Approval to consume it without regressing shipped surfaces (D-09).
- Precise copy for the summary line, filter chips, empty/zero states, and the comparison card.

### Folded Todos
None — `todo match-phase 42` returned no matches (the multi-milestone CLI quirk applies; no relevant todos surfaced for this phase's scope).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Binding design spec (v4.0 milestone)
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` — **§4** (Fact Check counters — `factCoverage`, `mustFixCount = unsourced load-bearing`, `changedCount` block-level touched-counter, "blank never means verified"), **§5** (claim shape + "New field required: importance — emitted by the Researcher" + the six actions + the Ask-agent-for-better-evidence content-patch+claim-update+decision-log flow), **§1** (publish unlock = `factDone && voiceDone` — Fact Check completion feeds the Approval gate), **§6** (role gating — the six actions; Phase 49 renders locked, but structure controls for it), **§8** (inspector claim artifact + `sectionName → writer → agent_runs`; the provenance card is reused here), **§9** (revision comparison card — direction/claim-delta shape the FCT-06 preview mirrors).
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — **§Stage 3 — Fact Check** (affirmative summary, filters, claim-detail provenance card, the six actions, severity tiers "unsupported central statistic = Must fix"), **§Stage 2 Draft** (claim marks + the revision-returns-claim-to-unchecked rule, FCT-07), **§Inspect how this was made** (the provenance card is the same component; Phase 44), **header** demo path (My Tasks → Fact Check claim detail → Ask agent for better evidence → Confirm).
- `docs/design/dispatch-control-v3/README.md` — milestone locked decisions + color semantics (every state label + icon, never color alone).

### Contracts & schema
- `docs/API_CONTRACTS.md` — **§31** (`api/content.py` content-patch endpoint family — the EDT-05 write boundary, audit-row + sign-off-revocation pattern the FCT-05/06/07 endpoints extend), **§35** (provenance merge — sourced vs unsourced claim rows, `claimId`/`sourceUrl`/`retrievedAt`/`sectionName`/`blockIndexHint`), **§26.2/§26.6** (`claim_checks` table + `claimChecks.ts` functions). **Amend a new §42 BEFORE code (D-21).** The EDT-05 rule and the `dispatch-control-no-sanity-write.test.ts` source-scan tripwire (§ around line 3918) apply to every new endpoint.
- `convex/schema.ts` — `claim_checks` table (lines 431-452); add `importance`, `changedSinceCheck`, and possibly `conflict` (additive optional).
- `convex/claimChecks.ts` — `insertBatch` (extend args with `importance`), `setStatus` (Confirm/reset-to-unchecked), `listByRunId`, `allSignedOff`. New mutations for the changed-marker + content-touching actions.
- `packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` — deterministic extractor (`extract_claims_by_block`, `block_index_hint`) — the source of unsourced rows + the `sectionName`/`blockIndexHint` anchors D-19 matches on.
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py` — the endpoint pattern to mirror (`_resolve_sanity_id`, `_emit_audit`, `_revoke_active_signoffs`, `_require_clerk_jwt_control`); extend with `_reset_touched_claims` (D-19).

### Project constraints
- `.planning/PROJECT.md` §Current Milestone — locked decisions + reconciliation facts (write boundary dashboard → pipeline API → Sanity/Convex → `audit_log`; RBAC unbuilt → Phase 49; DO NOT REBUILD the design system / provenance substrate).

### Prior-phase context this phase builds on
- `.planning/phases/41-issue-workspace-frame/41-CONTEXT.md` — **D-11/D-12** (the Stage-3 placeholder this phase replaces; the "Fact Check complete" gate term), **D-19** (the shared context panel the claim detail publishes into), **D-20** (galley claim rendering + unchecked click-through → Stage 3).
- `.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-CONTEXT.md` — the provenance merge + sourced/unsourced claim model this phase consumes.
- `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-CONTEXT.md` — the `facts-cleared` sign-off Fact Check completion feeds.

</canonical_refs>

<code_context>
## Existing Code Insights

*(Console app: `apps/dispatch-control/`, Next.js App Router, route group `app/(dashboard)/`. Pipeline: `packages/pipeline/src/eisenbalm_pipeline/`. Convex: `convex/`. Confirmed via codebase scan 2026-07-15.)*

### Reusable Assets
- **`convex/claimChecks.ts`** — `insertBatch` (idempotent per-run; extend args with `importance`), `setStatus` (`pending`/`checked`/`skipped`, stamps `checkedAt`), `listByRunId`, `allSignedOff`. Operator-guarded (`requireOperator`) for dashboard mutations; `requirePipelineSecret` for pipeline inserts.
- **`convex/schema.ts` `claim_checks`** (431-452) — has `claimId`/`sourceUrl`/`retrievedAt`/`sectionName`/`blockIndexHint` (Phase 35, all additive optional). `importance` + `changedSinceCheck` + optional `conflict` slot in the same way.
- **`packages/pipeline/.../lib/claims.py`** — deterministic extractor; `extract_claims_by_block` yields `{sectionName, blockIndexHint, text, claimType, context}`; `block_index_hint` resolves an `asWritten` span to a block index. This is the unsourced-row source and the anchor vocabulary the touched-claim reset (D-19) matches on.
- **`packages/pipeline/.../api/content.py`** — the content-patch endpoint family: `_resolve_sanity_id`, `_emit_audit` (truncated before/after audit row), `_revoke_active_signoffs` (called after every mutation), `_require_clerk_jwt_control`, revision-guarded `patch_issue_field`/`_patch_fields` (409 on `ifRevisionID` mismatch). The FCT-05/06/07 endpoints clone this pattern.
- **`lib/derivedState.ts`** (console) — the pure-selector pattern to mirror for `deriveFactCheckSummary`; already defines the 5 stages incl. `'Fact Check'` and `deriveFactCheckStage`.
- **Provenance rendering (Phase 35):** `components/galley/ClaimMark.tsx`, `components/galley/AnnotationMark.tsx`, `lib/galley/spanResolver.ts`, `.galley-claim`/marigold tokens in `app/globals.css`; `review-desk/[runId]/_components/SourceIndex.tsx` (the Approval per-claim source list). These feed / get refactored behind the shared provenance card (D-09).
- **Phase 41 Stage-3 placeholder to replace:** `app/(dashboard)/issues/[issueNumber]/fact-check/{page.tsx, FactCheckPlaceholder.tsx, FactCheckPanelContent.tsx}` — carry forward their "never blank" honesty ladder + status vocabulary.
- **`WorkspaceStateProvider`** (`issues/[issueNumber]/_components/`) — already subscribes to `claimRows` and exposes `setPanelContent`; the claim-detail card publishes into the frame's context panel through it (Phase 41 D-19), zero new subscriptions.

### Established Patterns
- **Write boundary:** dashboard → pipeline API (`_require_clerk_jwt_control`) → Sanity/Convex, one truncated `audit_log` row per mutation, active sign-offs revoked. The `dispatch-control-no-sanity-write.test.ts` source-scan tripwire forbids direct console→Sanity writes.
- **Contract-first:** amend `docs/API_CONTRACTS.md` before code (Ph35/38/39).
- **Additive-optional schema evolution:** every Phase 35 provenance field is `v.optional(...)`; legacy rows omit them and render an explicit non-blank state.
- **Derived over stored:** counters, tasks, readiness, header all derive from Convex data via pure selectors (no stored aggregates) — one mutation propagates everywhere via reactivity.

### Integration Points
- **`convex/schema.ts` + `convex/claimChecks.ts`** — new fields + mutations (importance, changed-marker, content-touching actions).
- **`packages/pipeline/.../agents/researcher.py`** — emit `importance` (D-02).
- **`packages/pipeline/.../api/content.py`** (or new `api/factcheck.py`) — the six-action + FCT-06 endpoints + `_reset_touched_claims` hook (D-19); register the router in `api/main.py`.
- **`app/(dashboard)/issues/[issueNumber]/fact-check/`** — replace the placeholder with the real stage (table, summary, filters, card); publish the card into the context panel.
- **Draft (Stage 2) + Approval (Stage 5)** — refactor to consume the shared provenance card (FCT-04) without regressing shipped rendering.
- **`docs/API_CONTRACTS.md`** — new §42.

### Watch-items (net-new inside a substrate-reuse phase)
1. **`importance` is the only truly new stored concept** — resist adding stored `sourcePublisher`/`agent`/`confidence`/subtype fields; DERIVED-STATE-CONTRACT §5 says only `importance` is new, the rest derive.
2. **The FCT-06 endpoint must be built to generalize** (Phase 45 extends the same one) — don't hard-code claim-only assumptions into its request/response shape.
3. **The touched-claim reset (D-19) rides the existing content-patch endpoints** — it is a pipeline change to `content.py`, not console-side logic, so a Sanity edit made anywhere still returns the right claims to unchecked.

</code_context>

<specifics>
## Specific Ideas

- The load-bearing demo leg (Annotations header) Phase 42 must make live: **My Tasks → "Resolve an unsupported statistic" → Fact Check claim detail → *Ask agent for better evidence* → *Confirm replacement*** — an unsourced `"demand outpaces supply four to one"` becomes `"demand outpaces installations roughly four to one"` + Post & Courier (Jun 2025), applied as content-patch + claim update + decision-log entry (DERIVED-STATE-CONTRACT §5). Phase 41 delivered the frame + the Draft/Voice/Approval legs; Phase 42 delivers this Fact-Check leg + the evidence verb.
- Severity is editorial, not statistical: "unsupported central statistic = Must fix; unsourced atmospheric detail = Review recommended / Information" — encoded as `mustFix = unsourced load-bearing`.

</specifics>

<deferred>
## Deferred Ideas

- **Generalizing the FCT-06 revision endpoint to arbitrary passage revision** — Phase 45 (extends the SAME endpoint; Phase 42 builds it claim-scoped).
- **The 7-tab "Inspect how this was made" panel** — Phase 44 (Phase 42 builds the reusable provenance card + an Inspect entry point only).
- **My Tasks screen + the formal shared Decision Log component** — Phase 43 (Phase 42 writes to the derived task projection + `audit_log`, doesn't build the screen/component).
- **Role/permission gating (locked-control rendering) of the six actions** — Phase 49 (Phase 42 builds actions for the editor; structures them for §6 wrapping).
- **Console-wide nomenclature ripple** — Phase 50.
- **Expanding `claimType`'s stored vocabulary (person vs org)** — deferred; Phase 42 uses derived heuristics for the people/org filters (D-13), no stored subtype without a contract amendment.

### Reviewed Todos (not folded)
None — `todo match-phase 42` surfaced no relevant todos.

</deferred>

---

*Phase: 42-fact-check-stage*
*Context gathered: 2026-07-15*
