# Phase 47: Story & Brief Stage - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 47-story-brief-stage
**Mode:** discuss (`--auto` — all areas auto-selected, recommended default locked per question)
**Areas discussed:** Reuse strategy, Lead cards + Require/Remove, Organization options, "Needs your decision" adjudication + resume, The Brief entity, Ask-agent-to-strengthen-a-field, States + UI contract

---

## Reuse strategy (generalize, don't fork)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase-41 frame + Phase-37 adjudication/resume + Phase-45 revision, adapt in place | Mount Stage 1 in the existing frame; reuse `adjudicateGate1`→resume + `api/revision.py` | ✓ |
| Build Stage 1 + a fresh adjudication + a fresh revision path | More control, but forks 3 shipped systems | |
| Extend the provisional `StoryPanelContent.tsx` in place | Roadmap says REPLACED, not extended | |

**Auto-selected:** replace `StoryPanelContent.tsx` inside the Phase-41 frame; reuse Phase-37 `adjudicateGate1`→`_resume_paused_run` verbatim for BRF-04; reuse/generalize Phase-45 `api/revision.py` for BRF-06 (field scope). No new frame, no second resume path, no third revision fork.
**Notes:** Matches the project's strong reuse discipline (Phase 42 reused the provenance card; Phase 45 generalized FCT-06 rather than forking).

## Lead cards (BRF-01) + Require/Remove (BRF-02)

| Option | Description | Selected |
|--------|-------------|----------|
| `LeadCard` from `storyLeads:byRunId`, all fields in full; Require/Remove = guarded audit-logged mutation, reason mandatory on Remove | Never truncated/tooltip; mirror Phase-37 never-truncated concern | ✓ |
| Truncate long fields with a "show more"/tooltip | Violates BRF-01 "never truncated or tooltip-hidden" | |

**Auto-selected:** LeadCard reads Phase-46 `storyLeads:byRunId`, renders every field (incl. brand-risk warning) in full; Require/Remove via guarded mutation with mandatory logged reason on Remove (Decision log + `audit_log`).
**Notes:** BRF-01's "never truncated" is a hard, testable constraint.

## Organization options grouped under the chosen lead (BRF-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Join `verificationRecords:byRunId` + `pitchLog` + registry under the lead; adapt Phase-37 `CandidateSlate`; main concern always visible | Reuses the never-truncated-concern precedent | ✓ |
| New standalone org-options component from scratch | Ignores the CandidateSlate precedent | |

**Auto-selected:** org options grouped under the chosen lead, joining Phase-46 verification records (with dates) + pitchLog (agent case/confidence) + registry (prior-coverage); adapt `CandidateSlate`; main concern always visible.
**Notes:** Data all exists; no new pipeline work.

## "Needs your decision" adjudication + resume (BRF-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Existing `editor_gate_1` interrupt → two-option side-by-side + mandatory rationale → `adjudicateGate1`→resume | Reuse the whole write/resume path; label "Needs your decision" | ✓ |
| A new interrupt + new resume endpoint for story selection | Duplicates the single authoritative resume | |

**Auto-selected:** trigger = existing `awaiting-review && completedAt==null` interrupt (§37.4c); two options side by side (what each makes possible, evidence quality, risk, burden); Choose-this-story requires rationale, logged, resumes via `adjudicateGate1`. Label "Needs your decision", never `requiresHumanInput`; header → "⏸ Paused for you".
**Notes:** `AdjudicationPanel` already does pick+reason→resume; BRF-04 just enriches the UI.

## The Brief entity (BRF-05)

| Option | Description | Selected |
|--------|-------------|----------|
| New Convex `briefs` table (editable, audited) + Brief threaded into DispatchState; generation reuses existing infra (no new graph node) | Cross-boundary; console edits, pipeline reads; minimal pipeline change | ✓ |
| A whole new "brief" pipeline graph node generates it | Phase 46 just grew the graph; avoid another node | |
| Store the Brief only in pipeline state (not editable in console) | BRF-05 requires it editable in the console | |

**Auto-selected:** new Convex `briefs` table = editable source of truth (audit-logged edits, contract-first); Brief shape also threaded into `DispatchState` so writers draft from it; generated after selection reusing existing agent/endpoint infra — exact mechanism a RESEARCH question, prefer reuse over a new node.
**Notes:** The Brief is the seam to Phase 48 ("Start from my brief" authors the same shape). Biggest new artifact this phase.

## Ask an agent to strengthen a field (BRF-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase-45 revision preview/apply, field-scoped | Generalize like FCT-06→REV; preview (no mutation) + apply (audit) | ✓ |
| A fresh field-strengthen endpoint from scratch | Third revision fork | |

**Auto-selected:** field-scoped revision reusing `api/revision.py` + the revision kit — preview a stronger field value (read-only), apply writes the field + `audit_log` + Decision-log entry. Contract-first for the field-scoped endpoint.
**Notes:** One shared revision core across claim (FCT-06), passage (REV), and now Brief field.

## States + UI contract

| Option | Description | Selected |
|--------|-------------|----------|
| Empty (CreatePanel) / Loading (streaming ~40s) / Error (Restart discovery + Run Details); design doc IS the UI spec | Per Annotations §Stage 1; no separate UI-SPEC.md (matches 40–45) | ✓ |
| Generate a fresh UI-SPEC.md | Phases 40–45 built against the design doc directly | |

**Auto-selected:** implement empty/loading/error per Annotations §Stage 1 (reuse CreatePanel for empty); after-choose → Brief generated + logged + Draft unlocks; the binding UI contract is `docs/design/dispatch-control-v3/` — continue without a separate UI-SPEC when plan-phase's UI gate fires.
**Notes:** Consistent with the Phase 40–45 convention.

## Claude's Discretion

- LeadCard / org-option / Brief field-table layout within the 1c tokens + canvas/context-panel split.
- `briefs` field set + indexes; mutation-vs-endpoint for Require/Remove + Brief edits (match Phase-39/42 convention).
- Brief-generation mechanism (post-research).
- Legacy `/signal-desk` route retirement (optional).

## Deferred Ideas

- "Start from my brief" entry point → Phase 48.
- Roles/permissions enforcement of the six actions → Phase 49.
- Nomenclature/Workbench rename → Phase 50.
- Retiring the legacy `/signal-desk` route → optional.
- A dedicated new "brief" graph node → not preferred; reuse existing infra.
