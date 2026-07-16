# Phase 47: Story & Brief Stage - Research

**Researched:** 2026-07-16
**Domain:** dispatch-control (Next.js/Convex) frontend stage replacement + one new cross-boundary Brief artifact (Convex table, FastAPI write boundary, LangGraph state field)
**Confidence:** HIGH — every claim below is grounded in direct reads of the actual code (file paths + line numbers cited). The one LOW-confidence item is explicitly flagged (§ Open Questions Q1).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Reuse strategy — generalize, don't fork (the phase's governing principle)**
- **D-01: Mount Stage 1 into the existing Phase-41 Workspace frame.** Replace `issues/[issueNumber]/story/StoryPanelContent.tsx` (the 131-line placeholder) with the full Story & Brief stage; reuse `issues/_components/` (`WorkspaceStateProvider`, `StageStrip`, `WorkspaceOutline`, `WorkspaceControls`) and `story/page.tsx`. Do NOT rebuild the frame or the stage tabs. Wire the StageStrip status mark for Stage 1.
- **D-02: Reuse the Phase-37 adjudication/resume WRITE PATH verbatim for BRF-04.** `apps/dispatch-control/lib/pipelineControlClient.ts::adjudicateGate1(runId, {selection:{charityName}, reason}, token)` → the Clerk-guarded `POST /issues/{run_id}/adjudicate` bridge → the single authoritative `_resume_paused_run` (`api/runs.py`, audit-BEFORE-resume, "nothing silent"). The UI becomes the richer two-option side-by-side card, but the resume machinery is UNCHANGED — no second resume path. Adapt `signal-desk/_components/AdjudicationPanel.tsx` + `CandidateSlate.tsx`, don't reinvent them.
- **D-03: Reuse the Phase-45 revision preview/apply pattern for BRF-06**, generalized to a Brief FIELD scope exactly as Phase 45 generalized FCT-06 from claim-scope to passage-scope. `api/revision.py` + the `components/revision/` kit (DirectionChips etc.) is the base; add a field-scoped wrapper. One shared revision core, no third fork.

**Lead cards (BRF-01) + Require/Remove (BRF-02)**
- **D-04: `LeadCard` reads the Phase-46 `storyLeads:byRunId` Convex query.** Shows ALL fields in full — premise, dated peg + source link, reader energy, charitable angle, category, confidence, and the brand-risk warning — **never truncated, never tooltip-hidden** (BRF-01 is explicit; mirror Phase 37's never-truncated `primaryConcern`). The brand-risk warning renders in full when present.
- **D-05: Require this lead / Remove — add reason** via a guarded, audit-logged mutation: reason MANDATORY on Remove, written to the Decision log + `audit_log` ("nothing silent"), mirroring the Phase-39 corrections / Phase-42 action audit pattern. Contract-first for any new mutation shape.

**Organization options grouped under the chosen lead (BRF-03)**
- **D-06: Org options join three existing sources under the chosen lead:** the Phase-46 `verificationRecords:byRunId` (verification record WITH DATES + domain/registration/obscurity), `pitchLog` (advocate case + confidence), and the charity registry (prior-coverage warning, Phase 39). Each option shows mechanism, verification record with dates, agent case, confidence, prior-coverage warning, and its **main concern ALWAYS visible** (never truncated/tooltip-hidden). Reuse/adapt Phase-37 `CandidateSlate` (its never-truncated-concern discipline is the precedent).

**"Needs your decision" adjudication + resume (BRF-04)**
- **D-07: The stage enters "Needs your decision"** when agents can't confidently choose — the label is literally **"Needs your decision"**, NEVER `requiresHumanInput`; the header System-activity chip flips to **"⏸ Paused for you"** (state model §105-110). Top two options side by side: what each makes possible, evidence quality, risk, burden. **Choose this story** requires a rationale, logged, and resumes via D-02.
- **D-08: The paused trigger is the EXISTING `editor_gate_1` interrupt** — `status === 'awaiting-review' && completedAt == null` (API_CONTRACTS §37.4(c), the same condition Phase 37 computes). The chosen org's `charityName` + reason go to `adjudicateGate1`. No new interrupt/resume mechanism is created.

**The Brief entity (BRF-05) — the one genuinely new artifact**
- **D-09: The Brief is NEW** — six fields: premise, current peg, central claim, reader effect, known risks, voice intention. It does not exist today (confirmed: only the Calibrator's `style_brief` and the "Match the brief" revision chip reference "brief").
- **D-10: Storage = a new Convex table (e.g. `briefs`), keyed by issue/run** — the editable source of truth in the console, with audit-logged edits. Contract-first: amend `docs/API_CONTRACTS.md` + `convex/schema.ts` before code. Because the section writers must draft FROM the Brief (BRF-05), the Brief shape is ALSO threaded into the pipeline `DispatchState` (contract-first §7) so the writers consume it. Cross-boundary artifact: Convex is the editable source of truth; the pipeline reads it.
- **D-11: Generation "after selection" — RESEARCH question, but PREFER MINIMAL.** Generate the Brief from the chosen lead + its verification record + research, reusing existing agent/endpoint infrastructure — do NOT add a whole new graph node (Phase 46 just grew the graph 18→20; avoid another node unless research proves it necessary). The Brief is generated after the operator chooses the org (post-resume), stored in Convex, then editable. Exact mechanism (a console-triggered pipeline endpoint vs. an inline post-selection assembly + one LLM pass) is resolved in RESEARCH; prefer reuse of the Researcher/Calibrator infra and the existing revision/LLM plumbing over new machinery.
- **D-12: The Brief is editable in the console** (field table) and section writers draft from the (possibly-edited) Brief. Edits write through the guarded content boundary (the Phase-42/45 EDT-05 write pattern — Clerk-guarded → store → `audit_log`; the no-silent-write tripwire stays green).

**Ask an agent to strengthen a field (BRF-06)**
- **D-13: Field-scoped revision, reusing D-03.** "Ask an agent to strengthen" a single Brief field = a preview (proposed stronger field value, read-only, NO mutation/audit — mirror `revise/preview`) + apply (write the field + `audit_log` + Decision-log entry — mirror `revise/apply`). One shared revision core; the Brief field is the new scope. Contract-first for the field-scoped endpoint.

**States + stage integration**
- **D-14: Empty / Loading / Error per the design (Annotations §Stage 1, L54).** Empty (before discovery) = the two Create paths inline (reuse `issues/_components/CreatePanel.tsx`). Loading = lead cards stream with "finding leads… (~40s)". Error = discovery failure surfaces a plain-language problem + "Restart discovery" + a link into Run Details.
- **D-15: After choose → Brief generated, decision + rationale logged, Draft unlocks.** Reuse the workspace stage-gate + StageStrip status; the Decision-log component (used everywhere) records the choice + rationale.

**UI design contract**
- **D-16: The binding visual/interaction spec is `docs/design/dispatch-control-v3/`** (Annotations §Stage 1 + §Issue Workspace + §State model + §Decision & audit, and DERIVED-STATE-CONTRACT) — the SAME design doc Phases 40–45 built against. No separate UI-SPEC.md is generated (project convention across 40–45); the 1c design tokens + component idioms come from the shipped dispatch-control components. When plan-phase's UI-SPEC gate fires (`UI hint: yes`), the answer is **continue without a separate UI-SPEC** — the design doc IS the contract.

### Claude's Discretion
- Exact `LeadCard` / org-option-card / Brief field-table layout within the 1c token system and the workspace canvas + context-panel split.
- The exact Convex `briefs` field set + indexes; whether Require/Remove and the Brief edits are Convex mutations or pipeline endpoints (match whichever the Phase-39/42 stage-action convention uses — planner confirms and stays consistent).
- The Brief-generation mechanism (D-11) after research.
- Whether the legacy standalone `/signal-desk` route is retired/redirected (not required this phase).
- The two-option "Needs your decision" card's exact comparison layout (what-each-makes-possible / evidence quality / risk / burden columns).

### Deferred Ideas (OUT OF SCOPE)
- **"Start from my brief" second pipeline entry point** (human premise skips discovery, enters at Researcher) → **Phase 48** — it consumes THIS phase's Brief artifact.
- **Roles/permissions enforcement** of the six Stage-1 actions (collaborator read-only + comment; primary actions Editor-gated) → **Phase 49**. The design shows the hints; the gating is a later phase.
- **Nomenclature / Workbench rename** ripple → **Phase 50**.
- **Retiring/redirecting the legacy standalone `/signal-desk` route** — optional cleanup; not required to deliver Stage 1 inside the Workspace.
- **A dedicated new "brief" pipeline graph node** — considered for D-11 but explicitly NOT preferred; reuse existing agent/endpoint infra unless research proves a node is required.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRF-01 | Lead cards: peg + source, reader energy, angle, category, confidence, brand-risk warning — never truncated | `storyLeads:byRunId` shape confirmed (§46.1/§46.5); never-truncated test pattern found in `CandidateSlate.test.tsx` (data-testid + `not.toMatch(/line-clamp|truncate/)`) — reuse verbatim |
| BRF-02 | Require a lead / Remove — mandatory logged reason | `story_leads` table currently has NO status field — must be added. Precedent split found: `claimChecks.keepAsWritten`/`remove` (FastAPI-routed, reason→decision-log) vs `charities.setStatus` (direct Convex + `requireOperator` + `internal.auditLog.writeDecision`). Recommendation below (§Architecture Patterns) |
| BRF-03 | Org options grouped under chosen lead: mechanism, verification w/ dates, agent case, confidence, prior-coverage, main concern always visible | Join key confirmed consistent across `pitchLog.charityId` / `verification_records.candidateId` / `agentVotes.charityId` — all `charity-{slugify(name)}` (advocate.py `_charity_id_for`, verify_candidates.py's own copy). **GAP found:** Scout does NOT consume `story_leads` — no lead↔org join key exists (§Common Pitfalls #1) |
| BRF-04 | "Needs your decision": top two options side by side, rationale required, resumes via existing interrupt/resume | `editor_gate_1`'s interrupt payload already computes `topTwoScores` server-side (editor.py:425-434) — but the dashboard doesn't read the interrupt payload directly; it reconstructs top-two client-side via the existing `joinCandidates` (CandidateSlate.tsx) sorted by `advocateScore`. `adjudicateGate1`/`_resume_paused_run` confirmed unchanged-reusable |
| BRF-05 | Editable Brief (6 fields), generated after selection, writers draft from it | **Central finding:** the graph runs `editor_gate_1 → chronicler → researcher → ... → publisher → END` with ZERO further `interrupt()` calls (builder.py:152-172) — full autonomous run to completion once Gate 1 resolves. This has major implications for "editable... generated after selection" — see §Architecture Patterns "Brief generation mechanism" and §Open Questions Q1 |
| BRF-06 | Ask an agent to strengthen any single Brief field | `build_section_writer_prompt`'s 4-param hard invariant (voice.py:250-291) is the writer-consumption seam; `revision.py`'s `_fetch_brief_context` ALREADY has a TODO-shaped stub anticipating the Phase 47 Brief entity (§Code Examples) |
</phase_requirements>

## Summary

This phase replaces a 131-line placeholder (`StoryPanelContent.tsx`, which just mounts the legacy `SignalDeskScreen`) with the full v3 Story & Brief stage, built entirely on data Phase 46 already produces (`story_leads`, `verification_records`) plus the existing Phase 37 candidate/adjudication substrate (`pitchLog`, `deliberationEvents` advocate-argument rows). Five of six requirements (BRF-01 through BRF-04, BRF-06) are genuinely additive UI work over already-shipped, well-tested patterns — the codebase already has a "never-truncated concern" component (`CandidateSlate`), a working adjudicate-and-resume write path (`AdjudicationPanel` → `adjudicateGate1` → `POST /issues/{run_id}/adjudicate` → `_resume_paused_run`), and a field-scoped-revision-ready engine (`revision.py`'s `preview`/`apply` pair, which already has a `_fetch_brief_context` stub explicitly anticipating this phase).

The one genuinely hard question — and the one CONTEXT flags as highest priority (D-11) — is BRF-05's Brief generation mechanism. Direct reading of `graph/builder.py` shows the pipeline graph has **no interrupt point between `editor_gate_1` and `publisher`**: once Gate 1 resolves (whether by auto-selection or by human adjudication-and-resume), the graph runs `chronicler → researcher → verify_research → [7 writers] → validate_sections → qa → editor_final → publisher → END` autonomously in one `graph.ainvoke()` call, with no further pause. This means there is no natural window for a human to edit an "editable Brief" *before* the writers consume it, unless the Brief is assembled synchronously and cheaply at (or immediately after) Gate 1 resolution — with genuine human editing serving primarily the audit trail, the "Match the brief" revision chip's context for *later* passage revisions, and Phase 48's hand-authored-brief entry point, rather than gating the very first drafting pass. The recommended mechanism (below) is a **zero-new-node, zero-new-LLM-call deterministic assembly performed inside `editor_gate_1` itself**, immediately after `winning_charity` is resolved — using data already in scope (the matched `StoryLead`, `VerificationRecord`, `decision.editorReasoning`, `style_brief`) — written to the new `briefs` Convex table and threaded into `DispatchState["brief"]` for the writers. This is the most literal reading of D-11's "prefer minimal machinery" and adds genuinely zero new graph nodes.

A second, independent architecture gap was found and must be designed around, not fixed (out of scope per CONTEXT): **Scout does not consume `story_leads`** — there is no `leadId`/`storyLeadIndex` field linking a `StoryLead` to the `CharityCandidate`s Scout finds. "Organization options grouped under the chosen lead" (BRF-03) is therefore not a real many-to-many join; it must be treated as "all of this run's orgs, grouped under whichever ONE lead is active" (the Signal Editor's `recommended` lead, or whichever lead the operator explicitly Requires via BRF-02) — because there is exactly one Scout pass per run today, this is a safe, honest simplification, not a workaround.

**Primary recommendation:** Build Stage 1 as five new components (`LeadCard`, `LeadActions` (Require/Remove), `OrgOptionCard`, `NeedsYourDecisionCard`, `BriefFieldTable`) composed inside a new `StoryBriefScreen.tsx` that replaces `SignalDeskScreen` as the Stage-1 mount (D-01), reusing `CandidateSlate`'s `joinCandidates` helper and `AdjudicationPanel`'s write path verbatim, adding one new Convex table (`briefs`) + one new FastAPI endpoint pair (`revise/preview`+`revise/apply` generalized to field scope, per D-03/D-13), one new status field on `story_leads` + a matching FastAPI action pair for Require/Remove (mirroring `claimChecks.keepAsWritten`/`remove`), and a small, surgical change to `editor_gate_1` + `build_section_writer_prompt` (new 5th `brief` parameter) to generate and thread the Brief.

## Standard Stack

This is an internal-monorepo phase — no new external packages are needed. The "stack" is which existing internal modules/patterns to build on.

### Core (frontend — apps/dispatch-control)
| Module | Purpose | Why Standard |
|--------|---------|---------------|
| `convex/react` `useQuery`/`useMutation` | Live Convex subscriptions + direct operator-authenticated writes | Every stage screen in the app uses this; `WorkspaceStateProvider` already centralizes 8 subscriptions this phase adds to |
| `@clerk/nextjs` `useAuth().getToken()` | Clerk JWT for FastAPI-bridge calls | Identical to `AdjudicationPanel.tsx`'s existing pattern |
| `apps/dispatch-control/lib/pipelineControlClient.ts` | Typed fetch wrappers around Clerk-guarded FastAPI endpoints | `adjudicateGate1` reused verbatim (D-02); add `requireLead`/`removeLead`, `strengthenBriefField`-preview/apply, `patchBrief` here following the existing export shape |
| `apps/dispatch-control/lib/revisionClient.ts` | `previewRevision`/`applyRevision` typed client (Phase 45) | BRF-06 generalizes this, does not fork it (D-03) |
| `components/revision/{DirectionChips,RevisionComparisonCard,RevisionFlow}.tsx` | Chips → preview → comparison-card → apply state machine | BRF-06 reuses `RevisionFlow`'s exact shape with a Brief-field-scoped `passage` prop instead of a section/quotedText passage |
| `components/decision-log/DecisionLog.tsx` | The one shared Decision Log, `runId`/`issueNumber`-scoped | Drop-in reuse for BRF-02/BRF-04 rationale display (D-15) — already accepts the right props, zero changes needed |

### Core (backend — packages/pipeline)
| Module | Purpose | Why Standard |
|--------|---------|---------------|
| `api/control.py::_require_clerk_jwt_control`, `_emit_audit`, `_revoke_active_signoffs` | Shared Clerk-guard + audit + sign-off-revocation helpers | Every EDT-0x/FCT-0x/REV-0x endpoint uses these three; new Brief endpoints must too |
| `api/revision.py::_build_directive`, `_fetch_brief_context` | Direction-chip vocabulary + the pre-existing (degraded) "Match the brief" context fetcher | `_fetch_brief_context` (lines 149-188) is explicitly written as a placeholder for "no Phase 47 Brief entity exists yet" — **this phase should replace its body with a real `briefs:byRunId` read**, not add a parallel mechanism |
| `lib/convex_client.py::convex_mutation`/`convex_query`, `_PIPELINE_SECRET_GUARDED_PATHS` | Central pipeline→Convex HTTP client, auto-injects `pipelineSecret` | New `briefs:insert`/`briefs:patch`/`storyLeads:setStatus` mutation names MUST be added to the guarded-paths frozenset (Phase 42-03 lesson, cited directly in API_CONTRACTS §46.6) |
| `lib/openrouter_client.py::acomplete` | The one LLM-call wrapper (cost recording, structured output) | If any Brief-generation or field-strengthen LLM call is added, it goes through this — no bespoke HTTP client |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Deterministic in-`editor_gate_1` Brief assembly (recommended) | A new dedicated `brief_generator` graph node | CONTEXT explicitly deprioritizes this (D-11: "avoid another node unless research proves it necessary"); a new node also doesn't solve the no-pause problem — see §Open Questions Q1 |
| Deterministic in-`editor_gate_1` Brief assembly (recommended) | A console-triggered `POST /issues/{run_id}/brief/generate` FastAPI endpoint that the operator/console calls after seeing the winner | Viable alternative; decouples Brief generation from the graph entirely. Tradeoff: races with the pipeline's own autonomous continuation to Researcher (which starts within seconds) — the writers would almost certainly NOT see an operator-edited Brief on the FIRST pass. Recommended only if the team explicitly accepts "Brief mainly informs later revision passes + Phase 48, not the first draft" (see Q1) |
| FastAPI-routed Require/Remove-lead (recommended) | Direct Convex `requireOperator` mutation (mirrors `charities.setStatus`) | Also viable and simpler for "Require" (no reason, no decision-log). For "Remove" (reason mandatory + decision-log), `factcheck.py`'s own module docstring explicitly argues AGAINST "simplifying to a bare dashboard Convex mutation" for exactly this shape — see §Architecture Patterns |

**Installation:** N/A — no new npm/pip packages. `python-slugify` (already a pipeline dependency, used by `verify_candidates.py`/`advocate.py`) is the only library dependency touched if Brief generation needs to re-derive a `candidateId`.

**Version verification:** N/A — internal-only phase, no third-party version pins change.

## Architecture Patterns

### Recommended Project Structure
```
apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/
├── page.tsx                          # REPLACED — resolves runId, mounts StoryBriefScreen (not SignalDeskScreen)
└── StoryPanelContent.tsx             # REPLACED or renamed — context-panel publisher (may become obsolete once
                                       #   the org-detail lives in the main canvas instead of the context panel)

apps/dispatch-control/app/(dashboard)/story-brief/_components/     # NEW directory (mirrors signal-desk/_components/)
├── StoryBriefScreen.tsx              # NEW — top-level Client Component shell (mirrors SignalDeskScreen.tsx)
├── LeadCard.tsx                      # NEW — BRF-01, full lead fields, never-truncated brand-risk warning
├── LeadActions.tsx                   # NEW — BRF-02, Require / Remove+reason buttons
├── OrgOptionSlate.tsx                # NEW — BRF-03, adapts CandidateSlate.tsx + joins verificationRecords + registry
├── NeedsYourDecisionCard.tsx         # NEW — BRF-04, adapts AdjudicationPanel.tsx to a 2-column comparison layout
├── BriefFieldTable.tsx               # NEW — BRF-05, 6-field editable table
└── BriefFieldStrengthen.tsx          # NEW — BRF-06, wraps RevisionFlow with a Brief-field-scoped passage shape

apps/dispatch-control/lib/
├── pipelineControlClient.ts          # AMENDED — add requireLead/removeLead, patchBriefField (or reuse revisionClient)
└── revisionClient.ts                 # AMENDED (or a sibling briefRevisionClient.ts) — field-scoped preview/apply

convex/
├── schema.ts                         # AMENDED — new `briefs` table; `story_leads` gains a status field
├── storyLeads.ts                     # AMENDED — new `setStatus` mutation (pipelineSecret-guarded, mirrors claimChecks)
└── briefs.ts                         # NEW — insert/patch/byRunId (pipelineSecret-guarded, mirrors storyLeads.ts)

packages/pipeline/src/eisenbalm_pipeline/
├── graph/state.py                    # AMENDED — new `Brief` TypedDict + `brief: Optional[Brief]` DispatchState field
├── agents/editor.py                  # AMENDED — Brief assembly appended to editor_gate_1's return, after winner resolves
├── lib/voice.py                      # AMENDED — build_section_writer_prompt gains a 5th `brief` param
├── agents/{origin_story,problem,founder_bio,case_study,game,bonus}.py + design.py  # AMENDED — pass state.get("brief")
├── api/revision.py                   # AMENDED — _fetch_brief_context reads the real briefs:byRunId row
├── api/brief.py                      # NEW (or extend revision.py) — PATCH /issues/{run_id}/brief,
│                                      #   POST /issues/{run_id}/brief/{field}/strengthen/preview + /apply
└── api/leads.py                      # NEW (or extend factcheck.py-style) — POST /issues/{run_id}/leads/{leadId}/require
                                       #   and /remove (body {reason})
```

### Pattern 1: The never-truncated card (BRF-01/BRF-03)
**What:** Render long text fields with zero clamp/truncate CSS classes; assert this in tests via `className` inspection.
**When to use:** Every field BRF-01/BRF-03 mark "never truncated or tooltip-hidden" — brand-risk warning, main concern, verification record notes.
**Example (verbatim precedent to copy):**
```tsx
// Source: apps/dispatch-control/app/(dashboard)/signal-desk/_components/CandidateSlate.tsx:197-208
{/* primaryConcern — ALWAYS visible, rendered in FULL, never clipped. */}
<div className="mt-2 border-t border-[color:var(--color-faint)] pt-1.5">
  <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-vermilion)]">
    Primary concern
  </span>
  <p
    data-testid={`primary-concern-${candidate.charityName}`}
    className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
  >
    {candidate.primaryConcern || '—'}
  </p>
</div>
```
The companion test (`__tests__/CandidateSlate.test.tsx:90-114`) is the exact tripwire pattern to reuse for BRF-01/BRF-03: `expect(el.textContent).toBe(longText)` + `expect(el.className).not.toMatch(/line-clamp|truncate/)`.

### Pattern 2: The Clerk-guarded FastAPI content boundary (EDT-05 lineage)
**What:** Every action that (a) requires a mandatory reason AND writes to `audit_log`, OR (b) mutates "content" (prose, structured fields meant to be read as authored text) goes through a FastAPI endpoint — `_require_clerk_jwt_control` → do the write(s) → `_emit_audit` (with `reason=`/`run_id=` kwargs when it's a decision) → return. It never becomes a bare dashboard `useMutation` call.
**When to use:** BRF-02 Remove (reason mandatory), BRF-05 direct field edits, BRF-06 strengthen-apply.
**Example — the exact precedent (`keep_claim`, factcheck.py:184-235), reason-required, no content-touch, still FastAPI-routed:**
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py:1-24 (module RATIONALE)
# "Confirm (dashboard -> claimChecks:setStatus, requireOperator) stays a direct
#  Convex mutation and is NOT in this router — only the content-touching and
#  decision-log-writing actions route through the pipeline boundary (D-14).
#  RATIONALE — 'Keep as written' is pipeline-side ON PURPOSE (checker Warning 4):
#  even though it mutates no Sanity content, it must write a D-18 decision-
#  log/audit_log entry, and convex/auditLog.ts::record is
#  requirePipelineSecret-guarded — so a decision-log write is ONLY
#  reachable from this pipeline layer. Do not 'simplify' Keep-as-written to
#  a bare dashboard Convex mutation; that would silently drop the
#  decision-log entry FCT-05/D-18 requires."
```
**Important nuance found in research:** this RATIONALE is slightly stronger than strictly necessary — `convex/auditLog.ts::writeDecision` is an `internalMutation` reachable from *any* Convex mutation via `ctx.runMutation(internal.auditLog.writeDecision, {...})`, and `convex/charities.ts::setStatus` (Phase 43) proves a **direct-Convex + `requireOperator` + `internal.auditLog.writeDecision`** path is also legitimate for a reason-required status flip (the "Do not use" flow). Both patterns exist in the codebase today. See §Architecture Patterns Pattern 3 for the recommendation and why FastAPI-routing is still the better fit here.

### Pattern 3: Require/Remove-lead — recommended shape (BRF-02, resolving D-05's discretion)
Two legitimate precedents exist; this research recommends the FastAPI-routed one, for these reasons:
1. `story_leads` rows are **pipeline-authored, per-run** artifacts (like `claim_checks`), not a long-lived cross-run registry (like `charities`) — `claimChecks` is the closer structural analog.
2. CONTEXT D-05 itself cites "the Phase-39 corrections / Phase-42 action audit pattern" — Phase 42 IS the FastAPI-routed `factcheck.py` pattern.
3. `claimChecks.ts` itself demonstrates the exact split needed: `setStatus` (no-reason "Confirm", direct-Convex `requireOperator`) vs. `keepAsWritten`/`remove` (reason-required, FastAPI-routed). Map this onto BRF-02 as: **Require this lead** (no reason) MAY be a direct Convex `requireOperator` mutation OR FastAPI-routed for consistency with Remove; **Remove — add reason** MUST be FastAPI-routed.
**Recommendation:** implement ONE new FastAPI endpoint pair mirroring `keep_claim`/`delete_claim` shape exactly:
```
POST   /issues/{run_id}/leads/{lead_id}/require        body {}          -> 200 {leadId, status: "required"}
POST   /issues/{run_id}/leads/{lead_id}/remove          body {reason}    -> 200 {leadId, status: "removed"}  (422 if reason empty)
```
Both call a NEW `storyLeads:setStatus` Convex mutation (pipelineSecret-guarded, mirrors `claimChecks.keepAsWritten`'s shape exactly — `ctx.db.patch(row._id, {status, ...})`), then `_emit_audit(..., reason=... , run_id=...)` (reason kwarg omitted for Require, present for Remove — matches `isDecisionRow`'s predicate in `auditLog.ts` so only Remove shows in `DecisionLog`, unless the team wants both to show, in which case always pass `reason` — planner's call, cheap either way).

`story_leads` needs a new field: `status: v.optional(v.union(v.literal('active'), v.literal('required'), v.literal('removed')))` (absent/`'active'` = default un-adjudicated state), NOT a breaking change to the existing insert shape (Phase 46's `storyLeads:insert` is untouched).

### Pattern 4: Brief generation mechanism — recommended (BRF-05, resolving D-11)

**Central finding (HIGH confidence, direct code read):** `graph/builder.py:152-172` wires
```python
builder.add_edge("editor_gate_1", "chronicler")
builder.add_edge("chronicler", "researcher")
builder.add_edge("researcher", "verify_research")
for writer in WRITERS:
    builder.add_edge("verify_research", writer)
    builder.add_edge(writer, "validate_sections")
builder.add_edge("validate_sections", "qa")
builder.add_edge("qa", "editor_final")
builder.add_edge("editor_final", "publisher")
builder.add_edge("publisher", END)
```
No `interrupt()` call exists anywhere in this chain (confirmed: `grep -rn "interrupt(" packages/pipeline/src/eisenbalm_pipeline/agents/` finds exactly one call site, `editor.py`'s Gate 1). `_resume_paused_run` (`api/runs.py:448-503`) schedules `graph.ainvoke(Command(resume=...), config=config)` as a **background asyncio task** — this one call runs the ENTIRE remainder of the graph (chronicler through publisher) to completion, unattended. The same is true for a run that never interrupts at all (auto-selected Gate 1): it's one continuous `ainvoke` from `START` to `END`.

**Consequence:** there is no natural pause between "org selected" and "writers run" for a human to review/edit a Brief. Any Brief-editing window that matters for the FIRST drafting pass would require either (a) a genuinely new pause point (contradicts D-11's strong preference), or (b) accepting that the Brief's practical editing value is mostly for the audit trail, for later revision passes ("Match the brief" — already stubbed in `revision.py`), and for Phase 48 (which authors a Brief by hand BEFORE the run even starts, so it has no race at all).

**Recommended mechanism — deterministic, zero-new-node, zero-new-LLM-call, inline in `editor_gate_1`:**

Insert this immediately after `winning_charity` is resolved in `editor.py` (right before the `return {**state, "winning_charity": winning_charity, ...}` block, ~line 488), using data ALREADY in scope in that function:

```python
# Illustrative — NOT verbatim final code, planner designs the exact assembly.
winning_lead = _match_lead_for_winner(state.get("story_leads") or [], winning_charity)
verification = _match_verification_record(state.get("verification_records") or [], winning_charity)
brief = {
    "premise": winning_lead.get("premise", "") if winning_lead else winning_charity.get("scoutSummary", ""),
    "currentPeg": winning_lead.get("datedPeg", "") if winning_lead else "",
    "centralClaim": decision.editorReasoning,   # already computed this call
    "readerEffect": winning_lead.get("readerEnergy", "") if winning_lead else "",
    "knownRisks": _assemble_known_risks(winning_lead, verification),  # brandRiskReason + repetitionWarning + killed-adjacent notes
    "voiceIntention": (state.get("style_brief") or {}).get("visualDirection", ""),
}
await convex_mutation_safe("briefs:insert", {"runId": run_id, **brief})
```
Then `return {**state, ..., "brief": brief}` so `DispatchState["brief"]` is populated for the writers with NO wait.

**Why this satisfies D-11 literally:** zero new graph nodes, zero new LLM calls (the six fields are all deterministic re-projections of data `editor_gate_1` already computed or that Phase 46 already produced), and it reuses the existing `convex_mutation_safe` + insert-mutation pattern verbatim.

**Why "editable" still matters even though the writers run within seconds:** (1) it is the audit-trail source of truth for what informed this issue; (2) `revision.py::_fetch_brief_context`'s stub (see §Code Examples) already anticipates reading this table for the "Match the brief" chip on LATER passage revisions — an operator edit made any time after generation immediately improves every subsequent revision pass; (3) it is the shape Phase 48 authors by hand before a run starts, so keeping the shape clean now pays off directly there. This should be stated plainly to the user/planner as an honest tradeoff, not hidden — see §Open Questions Q1 for the alternative (console-triggered generation) and its tradeoffs.

**If the team wants genuine pre-drafting edit time** (alternative, not recommended by this research but documented per the prompt's request): add a lightweight, NON-interrupt gate — the console could show Stage 1 with a "Generating brief…" state and a manual **"Start Draft"** button that the operator must click before Researcher effectively "counts" as begun; this is NOT achievable without a new interrupt() in `editor_gate_1` or a new node, and directly contradicts D-11. Flagged as Q1, not recommended.

### Pattern 5: Threading the Brief into section-writer prompts (BRF-05)
**What:** `lib/voice.py::build_section_writer_prompt` (lines 250-291) has a **hard, code-reviewed invariant**: it accepts ONLY 4 content params (`charity`, `research`, `style_brief`, `claims`) — the docstring explicitly states "this function accepts ONLY the four content blocks below... writers that try to inject other section content into the prompt must do so OUTSIDE this helper — which would be flagged in code review." Adding the Brief requires a deliberate, singular signature change here, not a workaround.
**Recommended smallest change:**
```python
# lib/voice.py — add ONE new optional keyword param
def build_section_writer_prompt(
    *,
    section_id: str,
    section_title: str,
    section_guidance: str,
    charity: dict[str, Any],
    research: dict[str, Any],
    style_brief: dict[str, Any],
    brief: dict[str, Any] | None = None,   # NEW — BRF-05, Phase 47
    voice_constraints: str = VOICE_CONSTRAINTS,
    claims: list[dict[str, Any]] | None = None,
) -> list[dict[str, str]]:
```
Render the 6 Brief fields into the user-message content block alongside `research`/`style_brief` (append, don't replace — mirrors how `style_brief`'s `bonusType`/`visualDirection` are already rendered there). Then each of the 7 call sites (`origin_story.py:125`, `problem.py`, `founder_bio.py`, `case_study.py`, `game.py`, `bonus.py`, `design.py`) adds one line: `brief=state.get("brief")`. This is a mechanical, low-risk, single-helper change — exactly the "smallest change to writer prompts/state" asked for.

### Pattern 6: Field-scoped revision for BRF-06 (generalizing D-03)
`api/revision.py`'s `preview_passage_revision`/`apply_passage_revision` pair is scoped to `{sectionName, quotedText, blockIndexHint}`. Generalizing to a Brief field requires a **parallel small scope struct**, not a fork of the whole endpoint — mirror how Phase 45 itself generalized FCT-06 (claim-scope → passage-scope) by extracting a shared core (`_patch_prose_span` in `content.py`) that both `factcheck.py::_patch_claim_prose` and `revision.py::apply_passage_revision` call. For the Brief:
```python
# Illustrative shape — planner finalizes exact routes/names.
POST /issues/{run_id}/brief/{field}/strengthen/preview
  body {currentValue: str, priorProposals?: list[str]}
  -> 200 {proposedText, whatChanged}   # no claimDelta — a Brief field is not claim-bearing prose
POST /issues/{run_id}/brief/{field}/strengthen/apply
  body {ifRevisionID?: str, newText: str}   # briefs table needs its own optimistic-concurrency token if edits can race
  -> 200 {resolution: "brief_field_strengthened"}
```
This reuses `_build_directive`'s clause vocabulary (or a smaller subset — "strengthen" doesn't need all 7 direction chips; BRF-06's own copy is just "Ask an agent to strengthen [a field]", a single action, not a chip-driven direction picker) and `acomplete` for the LLM call, `_emit_audit` for the audit row, and `RevisionFlow.tsx`'s state machine shape on the frontend (swap `passage: RevisionPassage` for a `briefField: {field, currentValue}` prop).

**Note on optimistic concurrency:** passage revision uses `ifRevisionID` sourced from Sanity's document revision (`get_issue_draft(...).revisionId`). The Brief lives in Convex, which has no equivalent built-in revision token exposed the same way. The planner should decide: either (a) skip optimistic-concurrency entirely for the Brief (lower risk than Sanity prose — a Brief field is single-operator-edited, rarely contended) and just always overwrite, logging before/after in the audit row for recoverability, or (b) add a `_rev: v.number()` counter field to `briefs` and increment-check on patch. Given the low collision risk (one operator per run), (a) is simpler and consistent with `story_leads`/`verification_records`' own lack of any revision-token concept.

### Anti-Patterns to Avoid
- **Building a second resume/interrupt mechanism for BRF-04.** D-08 is explicit and the codebase backs it up completely: `editor_gate_1`'s interrupt already carries everything BRF-04 needs (`topTwoScores`, `editorReasoning`); `adjudicateGate1`/`_resume_paused_run` need zero changes.
- **Trying to derive a real lead↔org join from existing data.** There isn't one (Scout doesn't read `story_leads`). Don't invent a fuzzy category-matching heuristic — treat it as one-active-lead-per-run (see §Common Pitfalls #1).
- **Routing Brief field edits through a bare Convex `useMutation` from the browser.** D-12 is explicit ("guarded content boundary... EDT-05 write pattern") and `factcheck.py`'s module RATIONALE argues the same point independently for a structurally similar case.
- **Forking a second revision engine for BRF-06.** `revision.py` already anticipates this exact need (`_fetch_brief_context`'s docstring literally says "no Phase 47 Brief entity exists yet") — wire into it, don't parallel it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Advocate-score join for candidate display | A new query/join helper | `CandidateSlate.tsx::joinCandidates` (exported, pure, unit-tested) | It already handles the `charityId`-then-`charityName` fallback match Research Pitfall 3 documented; BRF-03's org options need the identical join |
| Resume machinery for BRF-04 | A new `Command(resume=...)` call site or a second `/adjudicate`-style endpoint | `adjudicateGate1` (`pipelineControlClient.ts:186-211`) unchanged | There is exactly one resume implementation (`_resume_paused_run`) by explicit prior-phase design; a second path would violate that invariant |
| Reason-required audit trail | A bespoke "decisions" table/component | `convex/auditLog.ts::writeDecision`/`listDecisions` + `components/decision-log/DecisionLog.tsx` | Already generic over `runId`/`issueNumber`; zero changes needed to consume it for BRF-02/BRF-04 |
| Revision preview/apply state machine | A new Brief-specific React component tree | `components/revision/RevisionFlow.tsx` (surface-agnostic by design — D-18 in its own docstring: "knows nothing about the galley or inspector") | It was explicitly built surface-agnostic for exactly this kind of reuse |
| Cost-cap guard for the Brief-strengthen LLM call | A new budget check | `lib/budget.py::would_exceed_run_cap` (already used by `revision.py`'s preview endpoint) | Same per-issue cap, same enforcement point |

**Key insight:** Phase 47 is overwhelmingly a *composition* phase — nearly every hard problem (never-truncated rendering, resume machinery, audit/decision logging, revision preview/apply) has a working, tested precedent shipped in Phases 37/42/43/45. The only genuinely new engineering is the `briefs` Convex table + its two write boundaries (generation inside `editor_gate_1`; edits/strengthen through FastAPI) and the 7-writer prompt threading.

## Common Pitfalls

### Pitfall 1: Assuming a real lead↔organization join key exists
**What goes wrong:** Building `OrgOptionSlate` around a `story_leads[i].organizations` field or a `candidate.leadId` field that doesn't exist, discovering the gap mid-implementation.
**Why it happens:** BRF-03's copy ("Organization options grouped under the chosen lead") reads as if this is a real relational join. Direct reading of `agents/scout.py` shows Scout's `_build_queries`/`discover_candidates` never reads `state["story_leads"]` at all — Scout is fully decoupled from the Signal Editor's leads.
**How to avoid:** Treat the relationship as 1-lead-active : N-orgs-found (all of a run's Scout-discovered, `verify_candidates`-surviving candidates belong to whichever lead is currently active — the Signal Editor's `recommended` lead by default, or whichever lead the operator explicitly Requires via BRF-02). This is a safe, honest simplification because there is exactly one Scout pass per run today.
**Warning signs:** Any code that tries to filter `pitchLog` rows by a lead identifier, or that iterates `story_leads` expecting multiple distinct org-groups.

### Pitfall 2: Assuming there's meaningful time between Gate-1-resolved and Researcher-running
**What goes wrong:** Designing BRF-05/BRF-06 UI flows (or writing acceptance tests) that assume the operator routinely edits the Brief before the FIRST drafting pass consumes it.
**Why it happens:** The Annotations copy ("Brief: editable field table... generated after selection") and "Draft unlocks" phrasing read as if Draft is gated on human Brief approval.
**How to avoid:** Confirm with the plan (and if needed, flag to the user during plan review) that "Draft unlocks" is a WORKSPACE UI reveal (StageStrip/WorkspaceOutline progressively showing Stage 2 as `sectionStates` populate — the existing `deriveSectionStates`/`draftSectionIdsFromDraft` mechanism, `WorkspaceStateProvider.tsx:200-236`), not a pipeline-side gate. The pipeline runs autonomously to a full draft regardless of whether/when the operator visits Stage 1's Brief table.
**Warning signs:** A plan task that says "block Researcher until the Brief is confirmed" — this requires a new interrupt(), contradicting D-11.

### Pitfall 3: Conflating "needs-you" derivation for Gate-1-paused vs. "not there yet"
**What goes wrong:** `apps/dispatch-control/lib/derivedState.ts::deriveStoryStage` (lines 152-158) currently derives Stage 1's StageStrip state purely from `pitchRows` presence/selection: `pitchRows.length > 0 && none selected` → `'needs-you'`. This is TRUE during a genuine Gate-1 pause, but is ALSO (incorrectly) true for any moment between Scout writing `pitchLog` rows and `editor_gate_1` actually resolving (Advocate is still scoring, etc.) — a run that's merely mid-flight could flash "Needs you" prematurely.
**Why it happens:** `pitchLog:markSelected` is only called AFTER `editor_gate_1` resolves (`editor.py:469-472`, explicitly placed "AFTER any potential interrupt() pass"), so there's a real window where Scout has written candidates but no winner is marked yet, regardless of whether Gate 1 will pause or auto-resolve.
**How to avoid:** The planner should decide whether to leave `deriveStoryStage` as-is (accepting the pre-existing imprecision, out of this phase's explicit scope per CONTEXT's "does not alter Phase 46 logic" boundary — though this is Phase 40/41 code, not Phase 46) or tighten it using the SAME `status === 'awaiting-review' && completedAt == null` predicate (`§37.4(c)`) already used for `isPausedAtGate1` in `SignalDeskScreen.tsx:94`, which IS a precise signal. Flagging this as a plan-time decision, not silently working around it.
**Warning signs:** A Playwright/vitest test asserting StageStrip shows "Needs you" the instant `pitchLog` has rows, without checking `pipelineRuns.status`.

### Pitfall 4: Forgetting the `_PIPELINE_SECRET_GUARDED_PATHS` registration
**What goes wrong:** New Convex mutations (`briefs:insert`, `briefs:patch`, `storyLeads:setStatus`) called from FastAPI 500 with "Unauthorized" despite passing unit tests (which mock the Convex client).
**Why it happens:** `convex_client.py::_PIPELINE_SECRET_GUARDED_PATHS` is an explicit frozenset allowlist; Phase 42-03 hit this exact bug and API_CONTRACTS §46.6 calls it out by name for `storyLeads:insert`/`verificationRecords:insert`.
**How to avoid:** Add every new mutation path string to that frozenset in the same plan/task that introduces the mutation. Add a regression test asserting the set's membership (mirrors whatever Phase 46 did — check `tests/` for an existing `_PIPELINE_SECRET_GUARDED_PATHS` assertion pattern before writing a new one).
**Warning signs:** Real (non-mocked) FastAPI integration tests are green in CI but the feature 500s against a live Convex deployment.

### Pitfall 5: Convex schema/deploy drift
**What goes wrong:** `briefs` table + `storyLeads.setStatus` land in `convex/schema.ts`/`convex/*.ts` and get committed, but the plan is marked done without `pnpm --filter @eisenbalm/convex dev:once` — Phase 39's shipped 500 (per project memory `[[convex-functions-need-live-sync]]`) repeats.
**How to avoid:** Every plan touching `convex/` must include a live-sync task before verification, and the phase's verification step should independently confirm via `pnpm check:convex-parity` (used by Phase 46's own verification — `56 called functions all present on dev:modest-magpie-797`) that the new functions round-trip.

### Pitfall 6: Skipping the strict `next build`
**What goes wrong:** `vitest` (dispatch-control's `test`/`test:unit` scripts) does NOT type-check; a component with a type error can pass the full vitest suite and still fail on Vercel.
**How to avoid:** Per project memory `[[run-strict-build-before-frontend-phase-done]]`, run `pnpm --filter dispatch-control build` (strict `next build`) before declaring the phase done — this is a CLAUDE.md-adjacent hard rule already burned once (Phase 27).

## Code Examples

### The exact "editable Brief context, not yet built" stub this phase must replace
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/api/revision.py:149-188
async def _fetch_brief_context(sanity_http: Any, sanity_id: str) -> str:
    """Best-effort degraded "Match the brief" context (§45.1, D-07).

    ``style_brief`` itself is an ephemeral LangGraph-only value with no
    durable Sanity/Convex row to read back at review time EXCEPT the one
    field the DesignAgent carries forward verbatim onto
    ``theme.visualDirection``. This combines that with the winning charity's
    ``missionStatement``/``focusArea``/``scoutNotes`` (the closest existing
    proxy for "why this charity is overlooked" — no Phase 47 Brief entity
    exists yet). NEVER crashes: any failure degrades to "".
    """
    # ... GROQ query against Sanity, no Brief table read (doesn't exist yet)
```
Phase 47's job: give this function a real `briefs:byRunId` Convex read to prefer over the degraded Sanity-proxy fallback (keep the fallback for legacy runs / brief-generation failures — "never crashes" stays true).

### The resume payload BRF-04 must feed unchanged
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/api/runs.py:488-503
resume_payload = {"editorSelection": charity_name}
async def _resume_run_task() -> None:
    try:
        await graph.ainvoke(Command(resume=resume_payload), config=config)
    except Exception:
        log.exception("Resume task for %s raised", run_id)
task = asyncio.create_task(_resume_run_task())
```
The two-option "Needs your decision" card's "Choose this story" action feeds `charityName` (of whichever of the top-two the operator picked) through the UNCHANGED `adjudicateGate1(runId, {selection: {charityName}, reason}, token)` client call — no new payload shape.

### The joinCandidates helper BRF-03 reuses
```tsx
// Source: apps/dispatch-control/app/(dashboard)/signal-desk/_components/CandidateSlate.tsx:71-105
export function joinCandidates(
  pitchRows: PitchLogRow[],
  advocateRows: AdvocateArgumentRow[],
): Candidate[] {
  // charityId match, falls back to charityName match — Research Pitfall 3
  // (pitchLog does NOT carry advocateScore/advocateArgument/primaryConcern)
  ...
}
```
BRF-03 extends this by additionally joining `verificationRecords:byRunId` (matched on the SAME `candidateId`/`charityId` — confirmed identical `charity-{slugify(name)}` format across `pitchLog.charityId` (scout.py), `verification_records.candidateId` (verify_candidates.py's own `_charity_id_for` copy), and `agentVotes.charityId` (advocate.py's `_charity_id_for`)) and the charity registry (`charities:listByWorkspace` or similar, for prior-coverage — reuse whatever Phase 39/43's registry read helper is; `RegistryTable.tsx` at `apps/dispatch-control/app/(dashboard)/registry/_components/` is the existing consumer to check for the right query name).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| Stage 1 = legacy `SignalDeskScreen` (Phase 37, provisionally mounted by Phase 41) | Full v3 Story & Brief stage | This phase | The "Signal Desk" header/copy and the flat two-panel (slate + adjudication) layout are retired; replaced by lead cards → org options → Brief field table composition |
| `story_leads` has no operator-writable field | `story_leads` gains a `status` field | This phase | BRF-02 |
| No Brief entity anywhere in the stack | New `briefs` Convex table + `DispatchState["brief"]` + FastAPI write boundary | This phase | BRF-05/06; also the seam Phase 48 depends on |
| `build_section_writer_prompt` accepts exactly 4 content params (hard invariant) | Gains a 5th optional `brief` param | This phase | Touches all 7 section-writer call sites — small, mechanical, but touches every writer file |

**Deprecated/outdated:** The legacy standalone `/signal-desk` route (`app/(dashboard)/signal-desk/`) becomes fully superseded by the issue-keyed Stage 1 mount, but CONTEXT explicitly defers retiring/redirecting it (Claude's Discretion, "not required this phase").

## Open Questions

1. **Does the Brief need to gate the FIRST drafting pass, or is post-hoc editing acceptable?**
   - What we know: the graph has zero pause points between Gate 1 and Researcher (HIGH confidence, direct code read of `builder.py`). A deterministic, zero-new-node Brief assembly inside `editor_gate_1` (Pattern 4 above) satisfies D-11's "prefer minimal machinery" literally and gives the writers a real (if auto-generated) Brief on the first pass.
   - What's unclear: whether the PRODUCT intent behind "editable Brief... generated after selection, that the section writers draft from" requires the operator to have a genuine editing window BEFORE the first draft, which would require a new interrupt point (contradicting D-11) or accepting that edits typically land AFTER the first draft and inform revision/future runs instead.
   - Recommendation: proceed with the deterministic in-`editor_gate_1` assembly (Pattern 4) as the phase's mechanism, and have the plan/PROJECT.md state explicitly that "the writers draft from an auto-generated Brief; human edits refine it for revision passes and for Phase 48" — this is an honest, testable claim that satisfies BRF-05's literal text ("section writers draft *from* it" — they do, the auto-generated version) without inventing new pipeline pause machinery. If the user disagrees at plan-review time, the alternative (console-triggered generation, decoupled from the graph) is documented in §Standard Stack "Alternatives Considered" for them to choose instead.

2. **Exact Convex `briefs` table shape / index.**
   - What we know: 6 content fields (premise, currentPeg, centralClaim, readerEffect, knownRisks, voiceIntention) keyed by `runId`, one row per run (generate once, patch thereafter — NOT an append-only insert-per-edit table, since `briefs:byRunId` needs to resolve to ONE current Brief, unlike `story_leads`/`verification_records` which are naturally multi-row).
   - What's unclear: whether to also key by `issueNumber` (for cross-run Brief history, e.g. across a "Restart from this step" re-run) or `runId` alone is sufficient (each run gets its own Brief row, a restarted run gets a fresh one — simplest, matches how `sign_offs`/`claim_checks` scope to `runId`).
   - Recommendation: `runId`-scoped, single-row-per-run (use `.patch()` for edits after the initial `.insert()`, guard the insert to be idempotent/upsert-safe in case `editor_gate_1` re-runs after a restart — mirror the `pipelineRuns:updateStatus` upsert-safety pattern cited in `editor.py`'s own comments).

## Environment Availability

Skipped — this phase has no new external service/tool dependencies. All work is within the existing Next.js/Convex/FastAPI/LangGraph stack already running in this environment (confirmed via the extensive direct-code reads above; no new npm/pip packages, no new SaaS integration).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Frontend framework | Vitest (`apps/dispatch-control/package.json` — `"test": "vitest run"`, `"test:unit": "vitest run"`) + React Testing Library (confirmed via `__tests__/CandidateSlate.test.tsx`'s `screen`/`render` usage) |
| Frontend config | `apps/dispatch-control/vitest.config.ts` |
| Backend framework | pytest + pytest-asyncio (`packages/pipeline/pyproject.toml` — `asyncio_mode = "auto"`, `testpaths = ["tests"]`) |
| Backend config | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run (frontend) | `pnpm --filter dispatch-control test -- <TestFile>.test.tsx` |
| Quick run (backend) | `cd packages/pipeline && uv run pytest tests/agents/test_editor.py tests/test_revision_endpoints.py -q` (adjust filenames to whatever the plan creates) |
| Full suite (frontend) | `pnpm --filter dispatch-control test` |
| Full suite (backend) | `cd packages/pipeline && uv run pytest tests/ -q` |
| Strict build gate | `pnpm --filter dispatch-control build` (type-checks; vitest does NOT — see Pitfall 6) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| BRF-01 | Lead card shows all fields, brand-risk warning renders in full, no clamp class | unit (vitest) | `pnpm --filter dispatch-control test -- LeadCard.test.tsx` | ❌ Wave 0 — new component + test, mirror `CandidateSlate.test.tsx`'s never-truncated assertion pattern exactly |
| BRF-02 | Require sets status; Remove without reason 422s; Remove with reason writes audit_log + DecisionLog row | unit (vitest, component) + integration (pytest, endpoint) | `pnpm --filter dispatch-control test -- LeadActions.test.tsx`; `cd packages/pipeline && uv run pytest tests/test_leads_endpoints.py -q` | ❌ Wave 0 |
| BRF-03 | Org option card joins pitchLog+verificationRecords+registry, main concern never truncated | unit (vitest) | `pnpm --filter dispatch-control test -- OrgOptionSlate.test.tsx` | ❌ Wave 0 — extend `joinCandidates`-style pure-function unit tests plus a render test mirroring `CandidateSlate.test.tsx:90-114`'s tripwire |
| BRF-04 | Paused-at-Gate-1 detection renders 2-option card; Choose-this-story requires rationale; resumes via unchanged `adjudicateGate1` | unit (vitest) + integration (pytest, resume path — reuse existing `test_editor_gate_1_resume.py` pattern) | `pnpm --filter dispatch-control test -- NeedsYourDecisionCard.test.tsx`; `cd packages/pipeline && uv run pytest tests/test_editor_gate_1_resume.py -q` | Backend test file exists (Phase 5/37); frontend ❌ Wave 0 |
| BRF-05 | Brief generated after Gate 1 resolves with all 6 fields populated (auto-select AND resume paths); writers' prompts include the Brief; edits patch through FastAPI + audit | unit (pytest, `editor_gate_1` Brief-assembly helper) + integration (pytest, `voice.build_section_writer_prompt` new param) + unit (vitest, `BriefFieldTable.test.tsx`) | `cd packages/pipeline && uv run pytest tests/agents/test_editor.py tests/lib/test_voice.py -q`; `pnpm --filter dispatch-control test -- BriefFieldTable.test.tsx` | ❌ Wave 0 — both sides new |
| BRF-06 | Strengthen-preview is read-only (no audit row emitted); apply writes field + audit + DecisionLog; cost-cap 409 surfaces as disabled state | unit (pytest, mirrors `test_revision_endpoints.py`'s preview/apply pattern if it exists — check `packages/pipeline/tests/` for the Phase 45 REV test file name) + unit (vitest, `BriefFieldStrengthen.test.tsx` mirroring `RevisionFlow`'s existing tests if any) | `cd packages/pipeline && uv run pytest tests/test_brief_endpoints.py -q`; `pnpm --filter dispatch-control test -- BriefFieldStrengthen.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the relevant quick-run command above (component or endpoint file, not the full suite).
- **Per wave merge:** `pnpm --filter dispatch-control test` (frontend full) AND `cd packages/pipeline && uv run pytest tests/ -q` (backend full).
- **Phase gate:** both full suites green AND `pnpm --filter dispatch-control build` (strict) green before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `apps/dispatch-control/__tests__/LeadCard.test.tsx` — covers BRF-01, modeled directly on `__tests__/CandidateSlate.test.tsx`'s existing never-truncated pattern (lines 90-114)
- [ ] `apps/dispatch-control/__tests__/LeadActions.test.tsx` + `packages/pipeline/tests/test_leads_endpoints.py` — covers BRF-02
- [ ] `apps/dispatch-control/__tests__/OrgOptionSlate.test.tsx` — covers BRF-03
- [ ] `apps/dispatch-control/__tests__/NeedsYourDecisionCard.test.tsx` — covers BRF-04 (backend resume path already covered by existing `test_editor_gate_1_resume.py` — verify it still applies unmodified per D-02/D-08)
- [ ] `packages/pipeline/tests/agents/test_editor.py` additions (Brief-assembly helper) + `packages/pipeline/tests/lib/test_voice.py` additions (5th param) — covers BRF-05 backend
- [ ] `apps/dispatch-control/__tests__/BriefFieldTable.test.tsx` — covers BRF-05 frontend
- [ ] `packages/pipeline/tests/test_brief_endpoints.py` + `apps/dispatch-control/__tests__/BriefFieldStrengthen.test.tsx` — covers BRF-06
- [ ] A `_PIPELINE_SECRET_GUARDED_PATHS` membership assertion covering the new `briefs:insert`/`briefs:patch`/`storyLeads:setStatus` paths (mirror however Phase 46 asserted this for `storyLeads:insert`/`verificationRecords:insert` — check `packages/pipeline/tests/` for the existing pattern before writing a new one)

## Sources

### Primary (HIGH confidence — direct code reads, this session)
- `docs/API_CONTRACTS.md` §46 (L5307-5516), §37.3/§37.4 (L3598-3653) — StoryLead/VerificationRecord shapes, Convex tables, adjudicate bridge contract
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — full file, §Stage 1 (L48-55) is the binding UI contract
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` — full file, §7 (Run Details steps), §8 (Inspector artifact contract)
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` (L104-172) — full node/edge wiring, the "no pause after Gate 1" finding
- `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` (L1-497) — `editor_gate_1`, interrupt payload, resume-value handling, winner resolution
- `packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` — full file, confirmed unsuitable/unnecessary as a Brief-generation host
- `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` (L1-410, grepped for `story_leads`) — confirmed no lead↔candidate join
- `packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py` (`_charity_id_for`), `agents/verify_candidates.py` (own copy) — confirmed consistent join-key format
- `packages/pipeline/src/eisenbalm_pipeline/api/{control,runs,revision,factcheck,content}.py` — `_require_clerk_jwt_control`, `_emit_audit`, `_resume_paused_run`, `_fetch_brief_context`, `keep_claim`/`patch_claim`, `patch_section` (EDT-05 precedent)
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` (L250-291) — `build_section_writer_prompt`'s 4-param hard invariant
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` (L1-230) — `DispatchState`, `StyleBrief`, `CharityCandidate`, `StoryLead`, `VerificationRecord`
- `convex/{schema,storyLeads,verificationRecords,pitchLog,claimChecks,charities,auditLog}.ts` — table shapes, mutation patterns, `requireOperator`/`requirePipelineSecret`/`writeDecision` auth lanes
- `convex/lib/auth.ts` — the three-lane auth model (browser/pipeline/webhook)
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/{StoryPanelContent,page}.tsx` — the placeholder being replaced
- `apps/dispatch-control/app/(dashboard)/issues/_components/{WorkspaceStateProvider,StageStrip,CreatePanel}.tsx` — the frame Stage 1 mounts into
- `apps/dispatch-control/app/(dashboard)/signal-desk/_components/{AdjudicationPanel,CandidateSlate,SignalDeskScreen}.tsx` — the direct precedents for BRF-03/04
- `apps/dispatch-control/components/revision/RevisionFlow.tsx`, `apps/dispatch-control/lib/pipelineControlClient.ts` (`adjudicateGate1`) — the write-path precedents for BRF-04/06
- `apps/dispatch-control/components/decision-log/DecisionLog.tsx` — confirmed reusable as-is
- `apps/dispatch-control/lib/derivedState.ts` (`deriveStoryStage`, L152-158) — the existing Stage-1 StageStrip derivation, Pitfall 3
- `apps/dispatch-control/__tests__/CandidateSlate.test.tsx` — the never-truncated test tripwire pattern
- `packages/pipeline/pyproject.toml`, `apps/dispatch-control/package.json` — test/build commands

### Secondary (MEDIUM confidence)
- None — every claim in this document traces to a directly-read file in this session; no WebSearch/Context7 was needed (fully internal-monorepo phase).

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack / architecture patterns: HIGH — every recommendation is grounded in an existing, working precedent read directly from the codebase this session.
- Brief-generation mechanism (D-11, the phase's hardest question): MEDIUM-HIGH on the factual finding (no graph pause exists — HIGH confidence, directly verified), MEDIUM on the recommendation (a genuine product/scope tradeoff the user should confirm at plan-review — flagged explicitly as Open Question 1, not hidden).
- Pitfalls: HIGH — all five are drawn from direct code reads (existing docstrings/comments explicitly warning about the exact traps, or gaps found by grep/read verification) rather than speculation.

**Research date:** 2026-07-16
**Valid until:** ~14 days (fast-moving phase sequence; Phase 48 lands immediately after and may further clarify the Brief-generation timing question) or until Phase 47 planning begins, whichever is sooner.
