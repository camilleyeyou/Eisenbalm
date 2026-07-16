# Phase 47: Story & Brief Stage - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Mode:** Smart discuss (`--auto`) — all seven areas auto-selected, recommended default locked per area

<domain>
## Phase Boundary

Stage 1 of the Issue Workspace is **REPLACED, not built from nothing**: the provisional Signal Desk that Phase 41 mounted as Stage 1 (`apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx`, a 131-line placeholder) is swapped out for the full v3 **Story & Brief** stage, built on the story leads + verification records **Phase 46 now produces**. The stage delivers:

1. **Lead cards** showing peg + source, reader energy, angle, category, confidence, and any brand-risk warning **in full — never truncated or tooltip-hidden** (BRF-01).
2. **Require a lead** / **Remove — add reason** (reason mandatory, logged) (BRF-02).
3. **Organization options grouped under the chosen lead**, each showing mechanism, verification record with dates, agent case, confidence, prior-coverage warning, and its **main concern always visible** (BRF-03).
4. A **"Needs your decision"** state when agents can't confidently choose — the top two options side by side (what each makes possible, evidence quality, risk, burden); the operator's choice requires a rationale and **resumes the run via the existing interrupt/resume endpoint** (BRF-04).
5. An **editable Brief** (premise, current peg, central claim, reader effect, known risks, voice intention) **generated after selection**, that the section writers **draft from** (BRF-05).
6. **"Ask an agent to strengthen"** any single Brief field (BRF-06).

Requirements: **BRF-01, BRF-02, BRF-03, BRF-04, BRF-05, BRF-06.** `UI hint: yes`.

**Depends on:** Phase 46 (the `storyLeads` + `verificationRecords` this stage renders) and Phase 41 (the Workspace frame + stage tabs Stage 1 mounts into, REPLACING the provisional Signal Desk). Primarily a **dispatch-control frontend** phase, PLUS one genuinely new cross-boundary artifact — the **Brief** — which lives in Convex (editable in the console) and is read by the pipeline (so section writers draft from it).

**Explicitly NOT in scope:**
- The **"Start from my brief"** second pipeline entry point → **Phase 48** (it depends on the Brief artifact THIS phase produces).
- **Roles/permissions enforcement** of the six actions → **Phase 49** (the design shows collaborator-vs-editor hints, but the gating is Phase 49).
- **Nomenclature / Workbench rename** pass → **Phase 50**.
- Any change to Phase 46's Signal Editor / `verify_candidates` logic — this phase RENDERS their output, it does not alter it.
- Retiring/redirecting the legacy standalone `/signal-desk` route (optional cleanup, not required).

</domain>

<decisions>
## Implementation Decisions

### Reuse strategy — generalize, don't fork (the phase's governing principle)
- **D-01: Mount Stage 1 into the existing Phase-41 Workspace frame.** Replace `issues/[issueNumber]/story/StoryPanelContent.tsx` (the 131-line placeholder) with the full Story & Brief stage; reuse `issues/_components/` (`WorkspaceStateProvider`, `StageStrip`, `WorkspaceOutline`, `WorkspaceControls`) and `story/page.tsx`. Do NOT rebuild the frame or the stage tabs. Wire the StageStrip status mark for Stage 1.
- **D-02: Reuse the Phase-37 adjudication/resume WRITE PATH verbatim for BRF-04.** `apps/dispatch-control/lib/pipelineControlClient.ts::adjudicateGate1(runId, {selection:{charityName}, reason}, token)` → the Clerk-guarded `POST /issues/{run_id}/adjudicate` bridge → the single authoritative `_resume_paused_run` (`api/runs.py`, audit-BEFORE-resume, "nothing silent"). The UI becomes the richer two-option side-by-side card, but the resume machinery is UNCHANGED — no second resume path. Adapt `signal-desk/_components/AdjudicationPanel.tsx` + `CandidateSlate.tsx`, don't reinvent them.
- **D-03: Reuse the Phase-45 revision preview/apply pattern for BRF-06**, generalized to a Brief FIELD scope exactly as Phase 45 generalized FCT-06 from claim-scope to passage-scope. `api/revision.py` + the `components/revision/` kit (DirectionChips etc.) is the base; add a field-scoped wrapper. One shared revision core, no third fork.

### Lead cards (BRF-01) + Require/Remove (BRF-02)
- **D-04: `LeadCard` reads the Phase-46 `storyLeads:byRunId` Convex query.** Shows ALL fields in full — premise, dated peg + source link, reader energy, charitable angle, category, confidence, and the brand-risk warning — **never truncated, never tooltip-hidden** (BRF-01 is explicit; mirror Phase 37's never-truncated `primaryConcern`). The brand-risk warning renders in full when present.
- **D-05: Require this lead / Remove — add reason** via a guarded, audit-logged mutation: reason MANDATORY on Remove, written to the Decision log + `audit_log` ("nothing silent"), mirroring the Phase-39 corrections / Phase-42 action audit pattern. Contract-first for any new mutation shape.

### Organization options grouped under the chosen lead (BRF-03)
- **D-06: Org options join three existing sources under the chosen lead:** the Phase-46 `verificationRecords:byRunId` (verification record WITH DATES + domain/registration/obscurity), `pitchLog` (advocate case + confidence), and the charity registry (prior-coverage warning, Phase 39). Each option shows mechanism, verification record with dates, agent case, confidence, prior-coverage warning, and its **main concern ALWAYS visible** (never truncated/tooltip-hidden). Reuse/adapt Phase-37 `CandidateSlate` (its never-truncated-concern discipline is the precedent).

### "Needs your decision" adjudication + resume (BRF-04)
- **D-07: The stage enters "Needs your decision"** when agents can't confidently choose — the label is literally **"Needs your decision"**, NEVER `requiresHumanInput`; the header System-activity chip flips to **"⏸ Paused for you"** (state model §105-110). Top two options side by side: what each makes possible, evidence quality, risk, burden. **Choose this story** requires a rationale, logged, and resumes via D-02.
- **D-08: The paused trigger is the EXISTING `editor_gate_1` interrupt** — `status === 'awaiting-review' && completedAt == null` (API_CONTRACTS §37.4(c), the same condition Phase 37 computes). The chosen org's `charityName` + reason go to `adjudicateGate1`. No new interrupt/resume mechanism is created.

### The Brief entity (BRF-05) — the one genuinely new artifact
- **D-09: The Brief is NEW** — six fields: premise, current peg, central claim, reader effect, known risks, voice intention. It does not exist today (confirmed: only the Calibrator's `style_brief` and the "Match the brief" revision chip reference "brief").
- **D-10: Storage = a new Convex table (e.g. `briefs`), keyed by issue/run** — the editable source of truth in the console, with audit-logged edits. Contract-first: amend `docs/API_CONTRACTS.md` + `convex/schema.ts` before code. Because the section writers must draft FROM the Brief (BRF-05), the Brief shape is ALSO threaded into the pipeline `DispatchState` (contract-first §7) so the writers consume it. Cross-boundary artifact: Convex is the editable source of truth; the pipeline reads it.
- **D-11: Generation "after selection" — RESEARCH question, but PREFER MINIMAL.** Generate the Brief from the chosen lead + its verification record + research, reusing existing agent/endpoint infrastructure — do NOT add a whole new graph node (Phase 46 just grew the graph 18→20; avoid another node unless research proves it necessary). The Brief is generated after the operator chooses the org (post-resume), stored in Convex, then editable. Exact mechanism (a console-triggered pipeline endpoint vs. an inline post-selection assembly + one LLM pass) is resolved in RESEARCH; prefer reuse of the Researcher/Calibrator infra and the existing revision/LLM plumbing over new machinery.
- **D-12: The Brief is editable in the console** (field table) and section writers draft from the (possibly-edited) Brief. Edits write through the guarded content boundary (the Phase-42/45 EDT-05 write pattern — Clerk-guarded → store → `audit_log`; the no-silent-write tripwire stays green).

### Ask an agent to strengthen a field (BRF-06)
- **D-13: Field-scoped revision, reusing D-03.** "Ask an agent to strengthen" a single Brief field = a preview (proposed stronger field value, read-only, NO mutation/audit — mirror `revise/preview`) + apply (write the field + `audit_log` + Decision-log entry — mirror `revise/apply`). One shared revision core; the Brief field is the new scope. Contract-first for the field-scoped endpoint.

### States + stage integration
- **D-14: Empty / Loading / Error per the design (Annotations §Stage 1, L54).** Empty (before discovery) = the two Create paths inline (reuse `issues/_components/CreatePanel.tsx`). Loading = lead cards stream with "finding leads… (~40s)". Error = discovery failure surfaces a plain-language problem + "Restart discovery" + a link into Run Details.
- **D-15: After choose → Brief generated, decision + rationale logged, Draft unlocks.** Reuse the workspace stage-gate + StageStrip status; the Decision-log component (used everywhere) records the choice + rationale.

### UI design contract
- **D-16: The binding visual/interaction spec is `docs/design/dispatch-control-v3/`** (Annotations §Stage 1 + §Issue Workspace + §State model + §Decision & audit, and DERIVED-STATE-CONTRACT) — the SAME design doc Phases 40–45 built against. No separate UI-SPEC.md is generated (project convention across 40–45); the 1c design tokens + component idioms come from the shipped dispatch-control components. When plan-phase's UI-SPEC gate fires (`UI hint: yes`), the answer is **continue without a separate UI-SPEC** — the design doc IS the contract.

### Claude's Discretion
- Exact `LeadCard` / org-option-card / Brief field-table layout within the 1c token system and the workspace canvas + context-panel split.
- The exact Convex `briefs` field set + indexes; whether Require/Remove and the Brief edits are Convex mutations or pipeline endpoints (match whichever the Phase-39/42 stage-action convention uses — planner confirms and stays consistent).
- The Brief-generation mechanism (D-11) after research.
- Whether the legacy standalone `/signal-desk` route is retired/redirected (not required this phase).
- The two-option "Needs your decision" card's exact comparison layout (what-each-makes-possible / evidence quality / risk / burden columns).

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 47 (~L1014) — goal + 6 success criteria; §Phase 48 (~L1028) for what CONSUMES the Brief (do NOT build the "Start from my brief" entry point here).
- `.planning/REQUIREMENTS.md` — BRF-01..06 (~L401).
- `.planning/PROJECT.md` §Current Milestone + §Validated (Phase 46 entry) — locked v4.0 decisions + the leads/records substrate.

### Design intent (BINDING — this is the UI contract; no separate UI-SPEC.md)
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` §Stage 1 — Story & Brief (~L48-55: leads, org options, paused-for-you, Brief field table, empty/loading/error, after-choose) + §Issue Workspace shared frame (~L45-46) + §State model (~L105-110: Issue status / System activity / Attention labels — "Needs your decision" never `requiresHumanInput`) + §Decision & audit (~L112-113: reason-required actions, one Decision log everywhere).
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` — the derived-state selectors + §8 Inspector artifact contract (`signal` = story leads, `org` = organization selection) + the 5-stage strip.

### Contract boundary (HARD RULE — amend BEFORE code)
- `docs/API_CONTRACTS.md` — §7 DispatchState (the Brief shape threaded to writers lands here first); §37.3/§37.4 the `adjudicate`→resume bridge + the `awaiting-review && completedAt==null` interrupt condition BRF-04 reuses; §46 the `storyLeads`/`verificationRecords` tables + `byRunId` queries Phase 46 landed (BRF-01/BRF-03 data source). Add a §47 for the new `briefs` table + Brief field-strengthen endpoint.

### Upstream phase context (build on these)
- `.planning/phases/46-signal-editor-candidate-verification/46-CONTEXT.md` + `46-VERIFICATION.md` — the `StoryLead` + `VerificationRecord` shapes and `storyLeads`/`verificationRecords` Convex tables this stage renders.
- `.planning/phases/41-issue-workspace-frame/41-CONTEXT.md` — the Workspace frame + stage tabs Stage 1 mounts into (the mount contract).
- `.planning/phases/37-run-monitor-v2-signal-desk/37-CONTEXT.md` — the Gate-1 candidate slate + side-by-side adjudication + resume (SIG-01..03) BRF-03/BRF-04 adapt.
- `.planning/phases/45-agent-revision/45-CONTEXT.md` + `.planning/phases/42-fact-check-stage/42-CONTEXT.md` — the revision preview/apply generalization (BRF-06) + the EDT-05 guarded-write / stage-build pattern.

### Existing code (reuse targets)
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx` + `story/page.tsx` — the provisional Stage 1 being REPLACED (D-01).
- `apps/dispatch-control/app/(dashboard)/issues/_components/` — `WorkspaceStateProvider.tsx`, `StageStrip.tsx`, `WorkspaceOutline.tsx`, `WorkspaceControls.tsx`, `CreatePanel.tsx` (frame + empty-state Create paths).
- `apps/dispatch-control/app/(dashboard)/signal-desk/_components/` — `AdjudicationPanel.tsx` (the BRF-04 template — pick + required reason → `adjudicateGate1`), `CandidateSlate.tsx` (never-truncated concern — BRF-03), `DecisionPanel.tsx`.
- `apps/dispatch-control/lib/pipelineControlClient.ts::adjudicateGate1` + `apps/dispatch-control/components/decision-log/DecisionLog.tsx` — the resume write path + the shared Decision log.
- `apps/dispatch-control/components/revision/` (DirectionChips etc.) + `packages/pipeline/src/eisenbalm_pipeline/api/revision.py` — the BRF-06 revision base (D-03/D-13).
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py::_resume_paused_run` + `api/control.py` `POST /run/{run_id}/resume` / `POST /issues/{run_id}/adjudicate` — the single authoritative resume (audit-before-resume).
- `convex/storyLeads.ts` + `convex/verificationRecords.ts` (`byRunId` queries) + `convex/pitchLog.ts` + `convex/schema.ts` (where `briefs` lands) + `convex/auditLog.ts`.
- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` + `agents/calibrator.py` + the section writers — the Brief-generation infra to REUSE (D-11) and the writers that draft FROM the Brief (BRF-05).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The BRF-04 write path already exists, whole:** `AdjudicationPanel` → `adjudicateGate1` → `POST /issues/{run_id}/adjudicate` (Clerk-guarded, audits before resume) → the single `_resume_paused_run`. BRF-04 only needs a richer two-option UI on top; the resume is untouched.
- **The BRF-03 never-truncated-concern discipline is Phase 37's `CandidateSlate`** — the exact "main concern always visible" precedent.
- **The BRF-06 revision engine is Phase 45's `api/revision.py` + revision kit** — generalize to field scope (Phase 45 already proved the generalize-not-fork move from FCT-06).
- **The data is already produced:** Phase 46's `storyLeads:byRunId` (BRF-01) + `verificationRecords:byRunId` (BRF-03) + existing `pitchLog` (advocate case/confidence) + registry (prior-coverage) — no new pipeline discovery work.
- **The frame + stage tabs + Decision log + CreatePanel + EDT-05 guarded-write** are all shipped (Phases 40–45) — Stage 1 composes them.

### Established Patterns
- **Contract-first** (CLAUDE.md hard rule): amend `docs/API_CONTRACTS.md` (§7 for the Brief-in-DispatchState, new §47 for the `briefs` table + field-strengthen endpoint) before code.
- **"Nothing silent":** every reason-required action (Remove a lead, override/choose in adjudication, Brief edit) writes an `audit_log` row + a Decision-log entry.
- **Convex functions need live sync** (memory `[[convex-functions-need-live-sync]]`): the new `briefs` table + functions must be synced to `dev:modest-magpie-797` (`pnpm --filter @eisenbalm/convex dev:once`) — committed ≠ deployed.
- **Run strict build before done** (memory `[[run-strict-build-before-frontend-phase-done]]`): `pnpm --filter dispatch-control build` (strict `next build`) MUST pass before the phase is called done — vitest doesn't type-check.
- **Sequential-in-main-checkout execution** (Phases 36–46) — no worktrees; avoids the strand problem.

### Integration Points
- `issues/[issueNumber]/story/` — the Stage 1 replacement mounts here (D-01).
- New `convex/briefs.ts` + `briefs` table + `DispatchState` Brief field — the cross-boundary Brief artifact (D-10).
- `api/revision.py` (or a sibling) — the BRF-06 field-strengthen endpoint (D-13).
- The section writers (`agents/*`) — consume the Brief (BRF-05).
- `adjudicateGate1` / `_resume_paused_run` — the BRF-04 resume (D-02).

</code_context>

<specifics>
## Specific Ideas

- The Annotations §Stage 1 (~L48-55) is the north star — it enumerates every element (lead fields, org-option fields, paused-for-you two-option card, Brief field table, empty/loading/error, after-choose). Build to it directly.
- The operative phrase "Stage 1 is REPLACED, not built from nothing" means the provisional `StoryPanelContent.tsx` is DELETED and its route re-filled — not extended. Phases 40 & 42 set the precedent (deleting placeholders they replaced).
- BRF-04's label discipline is load-bearing: the human-facing label is **"Needs your decision"**, and `requiresHumanInput` is the internal flag only — never surfaced (State model §107-109).
- BRF-01/BRF-03's "never truncated or tooltip-hidden" is a hard, testable constraint (mirrors Phase 37's never-truncated `primaryConcern` tripwire) — the brand-risk warning and the org "main concern" render in full.
- The Brief is the seam to Phase 48: keep its shape clean and console-editable, because "Start from my brief" (Phase 48) will author the same shape by hand.

</specifics>

<deferred>
## Deferred Ideas

- **"Start from my brief" second pipeline entry point** (human premise skips discovery, enters at Researcher) → **Phase 48** — it consumes THIS phase's Brief artifact.
- **Roles/permissions enforcement** of the six Stage-1 actions (collaborator read-only + comment; primary actions Editor-gated) → **Phase 49**. The design shows the hints; the gating is a later phase.
- **Nomenclature / Workbench rename** ripple → **Phase 50**.
- **Retiring/redirecting the legacy standalone `/signal-desk` route** — optional cleanup; not required to deliver Stage 1 inside the Workspace.
- **A dedicated new "brief" pipeline graph node** — considered for D-11 but explicitly NOT preferred; reuse existing agent/endpoint infra unless research proves a node is required.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 47-story-brief-stage*
*Context gathered: 2026-07-16 via smart discuss (`--auto`)*
