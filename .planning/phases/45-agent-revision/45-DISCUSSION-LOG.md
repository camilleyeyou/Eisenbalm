# Phase 45: Agent Revision - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 45-agent-revision
**Mode:** `--auto` — Claude auto-selected all gray areas and picked the recommended default for each (no interactive prompts).
**Areas discussed:** Toolbar completeness · Claim-delta computation · Per-issue cost guard · Direction-chip strategy · Entry-point surfaces · Apply mechanics

---

## Toolbar completeness (REV-01) — Compare/Restore previous

| Option | Description | Selected |
|--------|-------------|----------|
| Reserved-with-explanation | Offer all six; Compare/Restore previous render visible-but-disabled with a `title` (D-08 inspector precedent) | ✓ |
| Revision-lineage-backed | Back Compare/Restore with pre-revision text captured by this phase's apply endpoint | (fallback) |
| Full content version history | General passage versioning (Sanity history-backed) | |

**Auto-selected:** Reserved-with-explanation.
**Rationale:** No shipped content-version endpoint exists; the phase Goal centers on the revision verb; SC1 requires the actions be "offered," which reserved-with-explanation satisfies. Consistent with the shipped `InspectorFooter` pattern and the milestone's "locked controls render with an explanation, never hidden." Lineage-backed noted as the fallback if verification demands functional behavior. → D-16, D-17.

---

## Claim-delta computation (REV-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic set-diff only | Diff `claim_checks` anchored to touched blocks | |
| Agent structured delta (advisory) + deterministic reset (enforced) | Agent emits added/removed/altered for the card; `_reset_touched_claims` enforces claim→unchecked | ✓ |
| Agent-only, drives state | LLM delta drives the actual claim reset | |

**Auto-selected:** Agent structured delta for display + deterministic hook for enforcement.
**Rationale:** "Added" claims can't be found by set-diff (no claim extractor at revision time); the DERIVED-STATE-CONTRACT §9 example reads as agent-produced narrative. But state correctness must not depend on the LLM — the existing block-level touched-counter stays authoritative. → D-09, D-10, D-11.

---

## Per-issue cost guard (REV-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing per-run cost cap + hard-block at cap | Accumulate revision cost under the issue's run; 409 + disabled chips at cap; header shows spent-vs-cap | ✓ |
| New dedicated revision budget config + warn-only | Separate budget key; surface overage but allow | |

**Auto-selected:** Reuse existing cap, hard-block with explanation.
**Rationale:** "cost-vs-budget" implies the existing budget denominator — don't invent a second system. Hard-block mirrors `budget.py::would_exceed_monthly_cap` and the §6 locked-render philosophy. Critical sub-decision: revision calls must record cost under the issue's REAL run (not `evidence-preview-*` throwaway ids) so the guard can read it. → D-12, D-13, D-14, D-15.

---

## Direction-chip strategy (REV-02)

| Option | Description | Selected |
|--------|-------------|----------|
| One parametrized house-voice prompt + per-chip directive | Mirror `voice_rewrite`; "Try another" passes avoid-context; "Custom" free-text; "Match brief" degrades to available context | ✓ |
| Seven distinct agent definitions | One prompt/agent per chip | |

**Auto-selected:** Parametrized single prompt.
**Rationale:** Reuses the shipped `voice_rewrite` pattern; keeps "never a bare Regenerate" intact; "Match the brief" degrades gracefully since the Brief entity is Phase 47. → D-04..D-08.

---

## Entry-point surfaces (SC1 + demo path)

| Option | Description | Selected |
|--------|-------------|----------|
| Shared galley action (Draft + Voice) + inspector footer | One component/endpoint wired into the shared surface + flip the reserved footer button live | ✓ |
| Draft only | Only the SC1-required Stage 2 toolbar | |

**Auto-selected:** Shared galley + inspector footer.
**Rationale:** The galley is shared between Draft and Voice; the Annotations demo selects the founder phrase in "Draft/Voice"; the Phase 44 footer already reserved the button. One shared flow covers all surfaces cheaply. → D-18.

---

## Apply mechanics (REV-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Single generalized apply endpoint; edit-before-applying reuses it | Final text (proposed or edited) routes through the same write-boundary apply; delta advisory, reset deterministic | ✓ |
| Separate apply paths for proposed vs edited text | Two endpoints | |

**Auto-selected:** Single generalized apply endpoint.
**Rationale:** Edit-before-applying is just "send edited text instead of the proposal" — same atomic apply (content-patch + reset-touched + revoke sign-offs + audit). Delta not recomputed on manual edit because the deterministic reset is always correct. → D-01, D-02, D-11.

## Claude's Discretion

- Endpoint home (`factcheck.py` passage route vs sibling `api/revision.py`).
- `agent_id` tagging for revision calls (default: single revision id).
- Per-issue revision-cost storage/query mechanism (bounded by D-13).
- Comparison-card diff granularity (word vs block).

## Deferred Ideas

- General passage/content version history (D-17 fallback).
- Phase 47 Brief entity / full "Match the brief."
- Phase 49 role-gating of Apply.
- General "Restart from this step" (needs generic resume; only Gate-1 resume exists).
