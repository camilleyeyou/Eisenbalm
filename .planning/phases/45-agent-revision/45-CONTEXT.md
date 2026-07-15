# Phase 45: Agent Revision - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning
**Mode:** `--auto` (Claude selected recommended defaults; each logged in DISCUSSION-LOG.md)

<domain>
## Phase Boundary

Make **"Ask agent to revise"** a real editing verb available wherever a passage is selected. The phase delivers, end to end:

1. A passage-selection toolbar in Draft (Stage 2) offering the six actions in REV-01.
2. The **"Ask agent to revise"** flow: direction chips → a comparison card (original / proposed / what changed / explicit claim delta) shown **before** anything applies → Apply / Edit before applying / Try another approach / Discard.
3. Applying mutates the draft **through the existing content-patch write boundary** and logs to `audit_log`.
4. A **per-issue cost guard** on revision calls, surfaced against a cost-vs-budget readout in the workspace header.

This phase **generalizes the SAME FCT-06 endpoint pair** Phase 42 built (claim-scoped) to arbitrary passage revision — it does **not** fork a second endpoint. It reuses, not rebuilds: the content-patch machinery, the `_reset_touched_claims` hook, sign-off revocation, the shared galley + provenance card, and the Phase 44 inspector footer entry point.

**Not in scope (deferred / other phases):** general content version history for passages (see Deferred), the Brief entity and "Match the brief" full fidelity (Phase 47), role-gating the Apply action (Phase 49 wraps it — structure the control for it now, do not hide it).
</domain>

<decisions>
## Implementation Decisions

### A. Endpoint — generalize FCT-06, do not fork
- **D-01:** Extend the **existing** `factcheck.py` preview/apply pair (`/issues/{run_id}/claims/{claim_index}/evidence/preview` + `/evidence/apply`) into a passage-scoped revision endpoint pair. Phase 42 explicitly designed the request/response shape (`ifRevisionID` / source / rewritten text) to be claim-agnostic so Phase 45 extends it. **Do not build a second revision endpoint** (REV-04; §42.4a). Exact home (new passage route in `factcheck.py` vs a sibling `api/revision.py` that shares `_patch_claim_prose`/`_resolve_sanity_id`/`_emit_audit`) is planning-time discretion, bounded by "one shared apply path, not two."
- **D-02:** **Preview = read-only, no mutation, no audit row** (mirrors `voice_pass.py::voice_rewrite` and `evidence/preview` exactly). **Apply = atomic**: re-resolve the passage span against **current** Sanity content via `lib/span_resolver.py::resolve_span` (never `claimSpans`, §35.3), content-patch the prose, run `_reset_touched_claims` FIRST, revoke active sign-offs, then `_emit_audit`. This is the established `content.py` / `_patch_claim_prose` order (42-RESEARCH Pitfall 3).
- **D-03:** `ifRevisionID` mismatch returns **409** exactly like the `content.py` revision guard (§31.4). The apply path stays behind `_require_clerk_jwt_control` and the EDT-05 write boundary — **no direct console→Sanity write** (the `dispatch-control-no-sanity-write.test.ts` tripwire applies to the new route).

### B. Direction chips — parametrized single prompt
- **D-04:** The seven chips (Make clearer / Make more specific / Tighten / Match the brief / Reduce repetition / Try another approach / Custom) are **one parametrized house-voice prompt** with a per-chip directive clause — **not** seven agent definitions and **never a bare "Regenerate"** (REV-02). Mirror `voice_pass.py::voice_rewrite`'s structure: `VOICE_CONSTRAINTS` + a directive, `acomplete` with a structured `response_format`.
- **D-05:** **"Try another approach"** re-runs the same preview endpoint passing the **prior proposal(s) as avoid-context** (a `priorProposals` / `avoid` field on the request) so the agent diverges rather than repeats.
- **D-06:** **"Custom direction…"** passes the operator's free text verbatim as the directive clause.
- **D-07:** **"Match the brief"** uses the **best available brief context today** (Calibrator `style_brief` / issue premise) and is forward-compatible with the Phase 47 Brief entity — it must **degrade gracefully**, never hard-depend on a Brief that does not exist yet. Note the Phase 47 dependency in RESEARCH.
- **D-08:** Agent identity/voice: reuse the house-voice constraints path (like `voice_rewrite`). Whether to tag `agent_id` per the section's originating writer or use a single generic `revision` agent id is planning-time discretion — **default to a single revision agent id with `VOICE_CONSTRAINTS`** for simplicity.

### C. Claim delta — advisory narrative, deterministic enforcement
- **D-09:** The comparison card's **claim delta (added / removed / altered)** is produced by the revision agent as **structured output** relative to the original passage, rendered as the "What changed" line (DERIVED-STATE-CONTRACT §9's example is the target register: "Claims: 1 altered … No claims added or removed"). This delta is **advisory/explanatory only**.
- **D-10:** The **enforced** state change — claims returning to unchecked + the "changed since check" counter — remains the **deterministic block-level `_reset_touched_claims` hook** (§42.5, D-19/D-20) that already fires on every content patch. Increments **even when the replacement text is itself sourced**. The displayed delta never drives the actual claim reset; the touched-block diff does.
- **D-11:** "Edit before applying" sends the operator-edited text through the **same** apply endpoint. The card's delta is **not** re-computed on manual edit — the deterministic reset at apply is always correct regardless, so a stale advisory delta is acceptable (never silently wrong state).

### D. Per-issue cost guard (REV-05)
- **D-12:** **Reuse the existing per-run cost cap** (`cost.py::set_run_cap` / `per_run_cap_usd`, config `cost_cap_usd`) as the budget denominator — **do not invent a second budget system**. The header "cost-vs-budget" readout shows the issue's spend against that cap.
- **D-13:** **Revision LLM calls must record cost attributable to the issue's real run** so the guard can read it. **Do not** repeat `evidence/preview`'s throwaway `run_id=f"evidence-preview-{run_id}"` pattern for cost attribution — a prefixed pseudo-run-id means the cost is invisible to a per-issue guard. Record revision-call cost under (or queryable against) the issue's run.
- **D-14:** **Enforcement = hard-block with explanation.** When the projected next revision call would exceed the per-issue allowance, the **preview endpoint returns 409** (mirror `budget.py::would_exceed_monthly_cap`'s predicate shape) and the chip UI renders **disabled-with-explanation** — never a silent failure. Consistent with the milestone's §6 locked-render philosophy.
- **D-15:** The header readout is **net-new** in the workspace `FrameChrome` (`layout.tsx`, next to the existing `{tasks.length} open · ~{workMinutes} min` line); the value is exposed via `WorkspaceStateProvider` from data it already (or newly) subscribes to. Follow the never-blank honesty rule (unknown → refresh affordance, never a stale number).

### E. Toolbar completeness (REV-01)
- **D-16:** The Draft selection toolbar **offers all six** actions (SC1 "offers"). Wire the four with shipped backing + the new revision verb:
  - **Edit text** → existing `BlockEditor` flow.
  - **Related facts & sources** → shared `ClaimProvenanceCard`.
  - **Inspect how this was made** → Phase 44 `onInspect` (galley already threads the prop).
  - **Ask agent to revise** → this phase's new flow.
- **D-17:** **Compare with previous** and **Restore previous** render as **visible-but-reserved controls with an explanatory `title`** — there is **no shipped content-version endpoint** and building passage version history is out of this phase's scope (Deferred). This follows the exact D-08 precedent the shipped `InspectorFooter` set (reserved actions with titles) and the milestone rule "Locked controls render with an explanation, never hidden." **Fallback if verification demands functional behavior:** back Compare/Restore with the pre-revision passage text captured by THIS phase's apply endpoint (revision lineage only, not general versioning) — planner should escalate rather than silently expand scope.

### F. Entry-point surfaces
- **D-18:** Wire the revision flow as **one shared, surface-agnostic action** into the **shared galley selection toolbar** (covers Draft/Stage 2 — SC1 — and Voice/Stage 4, since the Annotations demo selects "the founder phrase" in "Draft/Voice") **plus** the **Phase 44 inspector footer** (flip its reserved "Ask agent to revise" button live). The revision flow is **one component + one endpoint** regardless of which surface invokes it.

### G. Contract-first + reuse discipline
- **D-19:** **Amend `docs/API_CONTRACTS.md` with a new §45 BEFORE writing code** — the passage-scoped request/response shape (span target, direction chip, avoid-context, claim-delta output, cost-guard 409), extending §42.4a. This is the established Ph35/38/39/42 pattern.
- **D-20:** **Reuse, do not rebuild:** `factcheck.py` preview/apply + `_patch_claim_prose`; `content.py` write-boundary helpers (`_resolve_sanity_id`, `_emit_audit`, `_revoke_active_signoffs`, `_reset_touched_claims`, `resolve_span`); `voice_pass.py::voice_rewrite` prompt pattern; `acomplete` + `web_search`; the shared galley, `ClaimProvenanceCard`, `BlockEditor`, `onInspect`; `WorkspaceStateProvider` + `FrameChrome`; `cost.py` + `budget.py`. **Sign-off revocation stays as Phase 34 built it** — voice approval IS revoked on applied revision (our wiring is correct; the prototype's "voiceDone survives" is a known bug — port the sentence, not the wiring).

### Claude's Discretion
- Exact endpoint home (`factcheck.py` passage route vs sibling `api/revision.py` sharing the apply path).
- `agent_id` tagging strategy for revision calls (single revision id vs per-section writer) — default single.
- Precise per-issue revision-cost storage/query mechanism (extend an existing table/query vs a small tally) — bounded by D-13.
- Whether the comparison-card diff view is word-level or block-level highlighting.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Binding design spec (v3)
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` — **§9** (Ask agent to revise: the seven direction chips, comparison-card-before-apply, "What changed" claim-delta line, Apply/Edit/Try another/Discard); **§10** (known prototype bug: voice approval revocation — port the sentence not the wiring); **§6** (role gating — `Apply revision 🔒 editor only`; structure for Phase 49, do not hide); **§4** (`changedCount` block-level touched-counter, "blank never means verified"); **§8** (inspector footer actions incl. "Ask agent to revise").
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — **§Stage 2 Draft** (the six-action selection toolbar; "Ask agent never offers bare Regenerate"; revision-touching-a-claim-returns-it-to-unchecked rule); **header demo path** (My Tasks → Fact Check → Ask agent for better evidence → Confirm → Draft/Voice: select founder phrase → Ask agent to revise → apply → Approve Voice → Publish); **§Permissions** (Collaborator: Apply revision locks with a label).
- `docs/design/dispatch-control-v3/README.md` — decisions + color semantics; the "port the sentence, not the wiring" sign-off-revocation decision.

### API contracts
- `docs/API_CONTRACTS.md` — **§42.4 / §42.4a** (the FCT-06 preview/apply contract this phase generalizes — READ FIRST); **§42.5** (`_reset_touched_claims` hook + index-drift discipline); **§42.6** (shared `ClaimProvenanceCard` shape); **§31** (`content.py` content-patch family: `_resolve_sanity_id`, `_emit_audit`, `_revoke_active_signoffs`, `ifRevisionID` 409 guard, EDT-05 boundary + `dispatch-control-no-sanity-write.test.ts` tripwire); **§35** (provenance substrate: `claimId`/`sourceUrl`/`retrievedAt`/`sectionName`/`blockIndexHint`, span resolution against current content not `claimSpans`); **§44** (inspector footer row: "Ask agent to revise" Always RESERVED, `title="Arrives in Phase 45"` — flip it live). **Amend a new §45 BEFORE code (D-19).**

### Project + requirements
- `.planning/PROJECT.md` — v4.0 locked decisions (2026-07-14), esp. "Sign-off revocation stays as Phase 34 built it," reconciliation facts (18-node pipeline today, provenance substrate, write boundary, RBAC unbuilt), and the design-system "do not rebuild" note.
- `.planning/REQUIREMENTS.md` — **REV-01…REV-05** (lines 387–391).
- `.planning/phases/42-fact-check-stage/42-CONTEXT.md` — the FCT-06 build decisions (D-17 the shared revision contract, D-19/D-20 the touched-claim reset, D-21 contract-first, D-22 reuse-don't-rebuild) this phase extends.
- `.planning/phases/44-inspect-how-this-was-made/44-CONTEXT.md` — the inspector footer entry-point decisions (D-08 reserved-with-explanation precedent).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py` — the FCT-06 preview/apply pair + `_patch_claim_prose` (shared apply path: span-resolve → patch → reset-touched-first → terminal-status-last). **The thing to generalize.**
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py` — `_resolve_sanity_id`, `_fetch_before`, `_patch_fields` (`ifRevisionID` 409), `_reset_touched_claims` (§42.5, index-drift-aware), `_revoke_active_signoffs`, `_emit_audit`. The write boundary.
- `packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py::voice_rewrite` — the read-only house-voice preview pattern (VOICE_CONSTRAINTS + directive + `acomplete` structured output) to mirror for direction chips.
- `packages/pipeline/src/eisenbalm_pipeline/lib/` — `span_resolver.py::resolve_span`, `search_client.py::web_search`, `openrouter_client.py::acomplete`, `cost.py` (`set_run_cap`, `get_recorder`, per-run cap), `budget.py` (`would_exceed_*` predicate shape for the guard).
- `apps/dispatch-control/components/inspector/InspectorFooter.tsx` — the RESERVED "Ask agent to revise" button to flip live (`ASK_TO_REVISE_TITLE`).
- `apps/dispatch-control/components/galley/*` — `Galley.tsx` (already threads `onInspect`), `ClaimMark`, `AnnotationMark`, spanResolver — the shared Draft/Voice passage surface where the selection toolbar mounts.
- `apps/dispatch-control/components/provenance/ClaimProvenanceCard.tsx` — "Related facts & sources".
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/BlockEditor.tsx` — "Edit text".
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx` (`FrameChrome`) + `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` — where the cost-vs-budget header readout mounts and sources its value.
- `convex/schema.ts` `claim_checks` (`blockIndexHint`, `importance`, `sectionName`, `status`, `changedSinceCheck`) + `convex/claimChecks.ts`; `agentRuns`/`model_calls` (`costUsd`, `runId`) for cost attribution.

### Established Patterns
- **Two-step preview→apply**, preview never mutates / never audits, apply is atomic + audited (FCT-06, voice-rewrite).
- **Block-level touched-counter** for claims-returning-to-unchecked (deterministic, `_reset_touched_claims`), NOT re-verification.
- **Contract-first** (§ amendment before code), **reserved-with-explanation** for not-yet-wired controls (never hidden), **never-blank** honesty in readouts.
- **Write boundary:** console → pipeline API → Sanity, audited, no direct Sanity write (EDT-05 source-scan tripwire).

### Integration Points
- New passage-revision route registered in `api/main.py` (like `factcheck.py`/`findings.py`/`voice_pass.py` routers).
- Selection toolbar mounts in the shared galley; inspector footer button flips live; cost readout mounts in `FrameChrome` header via `WorkspaceStateProvider`.
</code_context>

<specifics>
## Specific Ideas

- The load-bearing demo leg this phase must make live (Annotations header path): **Draft/Voice → select the founder phrase → Ask agent to revise → apply "a former county clerk" → the comparison card names the claim delta → Apply through the write boundary → Voice Pass returns to "Review needed" (sign-off revoked) → Publish.** The claim-delta register to hit verbatim in tone: *"Replaced unverifiable characterization with a sourced biographical fact. Claims: 1 altered … No claims added or removed."*
- Direction chip labels are fixed copy (REV-02): **Make clearer / Make more specific / Tighten / Match the brief / Reduce repetition / Try another approach / Custom** — never "Regenerate."
- Comparison card layout (DERIVED-STATE-CONTRACT §9): Original (strikethrough) | Proposed, a "What changed" line naming the claim delta, then Apply / Edit before applying / Try another approach / Discard.
</specifics>

<deferred>
## Deferred Ideas

- **General passage/content version history** — a real store of prior passage versions backing fully-functional "Compare with previous" / "Restore previous." This phase renders those two as reserved-with-explanation (D-17). If a future phase wants them live, either build passage versioning or back them with the revision lineage this phase's apply endpoint captures. (Flagged as the D-17 fallback if verification demands functional behavior now.)
- **Phase 47 Brief entity** — full-fidelity "Match the brief" against the editable Brief (premise/peg/central claim/reader effect/known risks/voice intention). This phase degrades "Match the brief" to available brief-like context (D-07).
- **Phase 49 role-gating** — wrapping Apply revision / Confirm evidence replacement with the `🔒 editor only` locked-render. This phase structures the Apply control so Phase 49 can gate it; it does not implement RBAC.
- **General "Restart from this step"** — the inspector footer's other reserved action; needs a generic resume mechanism that does not exist (only Gate-1 resume). Not this phase.

### Reviewed Todos (not folded)
None — `todo match-phase 45` returned zero matches.
</deferred>

---

*Phase: 45-agent-revision*
*Context gathered: 2026-07-15*
