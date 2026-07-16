# Phase 48: Brief Entry Point - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Mode:** Smart discuss (`--auto`) — all eight gray areas auto-selected, recommended default locked per area

<domain>
## Phase Boundary

Make **"Start from my brief" a real second pipeline entry point** — not the stub the prototype ships (`DERIVED-STATE-CONTRACT.md` §10: "both Create cards call the same handler"). A human supplies a **premise, peg, organization, and optional source material**; the run **skips Signal Editor, Scout, Advocate, and Gate 1** and **enters at the Researcher**; the human-supplied organization is **still put through `verify_candidates`** so its verification record is never absent. Both Create paths land in the **Issue Workspace at Stage 1 (Story & Brief)** — the editor never "triggers a pipeline."

This phase delivers exactly four requirements:
1. **ENT-01** — Create issue offers two equal paths ("Find a story with agents" / "Start from my brief"), both landing at Stage 1.
2. **ENT-02** — Operator submits premise, peg, organization, optional source material; the run skips Signal Editor/Scout/Advocate/Gate 1 and enters at the Researcher.
3. **ENT-03** — A brief-started run produces the **same downstream artifacts** (research, sections, QA, claims, sign-offs) as an agent-discovered run and is **indistinguishable at Stages 2–5**.
4. **ENT-04** — The human-supplied organization is still run through `verify_candidates`, so the verification record is never absent.

**Depends on:** Phase 47 (the editable 6-field **Brief** artifact + `briefs` Convex table this entry point's human input maps to) and Phase 46 (`verify_candidates` + `verificationRecords`). This is a **cross-boundary** phase: dispatch-control frontend (the second Create card + intake form) **+** pipeline (a second graph entry path + a new brief-trigger endpoint) **+** Convex (`briefs` row authored before the run, `entry_mode` on the run).

**The governing principle (inherited from Phase 47): reuse/generalize, don't fork.** The entire downstream — Researcher → verify_research → 7 writers → validate_sections → QA → editor_final → publisher — is reused **verbatim**. Phase 48 adds only the *entry seam*: a branch at `START`, a deterministic seed of the human input into `DispatchState`, and one new Clerk-guarded trigger endpoint reusing `_start_run`.

**Explicitly NOT in scope:**
- **Roles/permissions enforcement** of who may start a brief run → **Phase 49** (the design shows collaborator-vs-editor hints; gating is Phase 49).
- **Nomenclature / Workbench rename** pass → **Phase 50**.
- Any change to Phase 46's `verify_candidates` **logic** — this phase *invokes* it on a human org, it does not alter its checks.
- Any change to the Phase 47 Stage-1 Story & Brief UI beyond what's needed to render a brief-started run's Stage 1 (single verified org instead of a leads slate).
- File/asset uploads for source material (free-text only this phase).

</domain>

<decisions>
## Implementation Decisions

### Graph entry & branching (the crux) — ENT-02/ENT-03
- **D-01: One graph, a conditional entry at `START`.** Add `builder.add_conditional_edges(START, route_by_entry_mode, {...})` keyed on a new `DispatchState['entry_mode']` flag (`'discovery'` | `'brief'`). Discovery runs keep the existing `START → calibrator → signal_editor → scout → verify_candidates → advocate → editor_gate_1 → chronicler → researcher → …` chain byte-unchanged. Brief runs route `START → calibrator → verify_candidates → researcher → …`. **One compiled graph, one checkpointer, downstream (researcher onward) reused verbatim** — no second graph, no per-node short-circuit scattering. Exact edge/router placement is a RESEARCH item; the *mechanism* (a `START` conditional edge on `entry_mode`) is locked.
- **D-02: Calibrator still runs in brief mode.** It sets `style_brief` (voice, `bonusType`, `visualDirection`, `previousBonusTypes`) and resolves the narrator — the section writers require these. Do NOT skip it. Only Signal Editor, Scout, Advocate, and Gate 1 are skipped (ENT-02's literal list).
- **D-03: `verify_candidates` runs on the brief path.** It must sit on the brief branch (after calibrator, before researcher) so the human org gets a persisted `VerificationRecord` (ENT-04). It reads `state['candidates']` (seeded from the human org, D-05) and writes `verificationRecords` exactly as today — no logic change.

### Winner/candidate/Brief seeding (Gate 1 is skipped) — ENT-02/ENT-04
- **D-04: The human brief IS the source of truth; seed it into `initial_state` at run start.** Gate 1 — which in discovery mode resolves `winning_charity` and deterministically assembles + persists the Brief (`editor.py::_assemble_brief` → `briefs:insert`, §47.3) — is skipped. In brief mode, `_start_run` (brief-aware) seeds `entry_mode='brief'`, `winning_charity` (from the human org), `candidates=[human org]`, and `brief` (the 6-field Brief, D-06) directly into `initial_state`. The Researcher reads `state['winning_charity']` unchanged; the writers read `state['brief']` unchanged.
- **D-05: The `candidates` list is seeded with the single human org** so `verify_candidates` has its input (it iterates `state['candidates']`). `_charity_id_for(name)` (the shared `charity-{slugify(name)}` join key) binds the org to its verification record and any registry prior-coverage.
- **D-06: The `briefs` Convex row is written at intake — deterministic, no LLM, mirroring `_assemble_brief` but sourced from the human input.** Because the operator hand-authors the Brief, this is NOT an `_assemble_brief` re-projection of leads/records; it is a direct map of the entry form onto the 6 Brief fields (D-08). Where the `briefs:insert` write happens — console-side before triggering, in the brief-trigger endpoint, or a tiny deterministic pre-graph seed — is **Claude's discretion / RESEARCH**; the constraint is that a `briefs` row exists for the run before the writers draft (mirroring the §47.3 write, sourced from the human).

### Entry form fields + Brief mapping — ENT-02
- **D-07: Collect exactly ENT-02's set — premise, peg, organization, optional source material — nothing more.** Do NOT force the operator to author all six Brief fields up front; that contradicts ENT-02 and inflates burden.
- **D-08: Map the form onto the 6-field Brief; leave the rest blank for BRF-06 strengthen.** `premise → premise`, `peg → currentPeg`, `organization → winning_charity + candidate`. `centralClaim`, `readerEffect`, `knownRisks`, `voiceIntention` start **blank** (or `voiceIntention` defaulted from `style_brief.visualDirection`, D-02) and the operator fills/sharpens them in Stage 1 using the **shipped BRF-06 field-strengthen** (`api/brief.py` preview/apply) and BRF-05 direct edit — no new editing surface. This reuses Phase 47's editable Brief exactly.
- **D-09: `organization` capture is a name (+ optional website/registration id).** `verify_candidates` needs a website URL to run the domain-live check and a registration id for the registration-ID check; the form should collect at least the org name and ideally its website so the verification record is meaningful (a name-only org still verifies, just with more `unverified` checks — acceptable per `verify_candidates`' conservative posture).

### "Optional source material" — ENT-02
- **D-10: A single optional free-text field (URLs + pasted notes) threaded to the Researcher as seed context.** Stored on the run/brief; made available to the Researcher as prioritized seed sources (the Researcher already does web search — source material seeds/anchors it). **No file/asset upload this phase.** "Optional" is literal: a brief run works with the field empty. Exact threading (a new `DispatchState` field vs. an existing research-seed slot) is a RESEARCH item.

### `verify_candidates` posture on a human org — ENT-04
- **D-11: Verification is ADVISORY on a brief run — it produces the record (ENT-04) but never kills the org or halts the run.** In discovery mode, `verify_candidates` can definitively kill a candidate and Advocate/Gate 1 re-slate. In brief mode there is exactly one org, no slate, and the human deliberately chose it. So: run the checks, persist the `VerificationRecord`, surface its concerns prominently in Stage 1's org card (never truncated — the Phase 37/47 discipline), but a definitive-fail check does **not** remove the org or pause the run. The operator sees the concern and proceeds knowingly (or uses the existing **Hold issue** control if the record looks disqualifying). This honors `verify_candidates`' own "never kill on ambiguous, false-negatives-are-acceptable" conservatism.

### Deliberation / chronicler in a brief run — ENT-03
- **D-12: Skip the chronicler; the deliberation artifact is legitimately absent for brief runs.** A brief run has no Scout findings, no Advocate scores, no Gate-1 debate to dramatize — fabricating one would undercut the milestone's whole verification/trust story. The brief branch does not route through `chronicler`; `deliberation_conversation` / `deliberation_transcript` stay `None` (both are `Optional`), and the reader-facing `DeliberationSlot` renders its existing absent state. **This is the one honest divergence from a discovery run** — and it is *outside* ENT-03's enumerated "same downstream artifacts" set (research, sections, QA, claims, sign-offs) and its "indistinguishable at Stages 2–5" scope. Flagged in `<specifics>` for Andrew; the "dramatize the editor's decision-to-run-this-brief" alternative is noted in `<deferred>` (not built).

### Create-panel UI + intake flow — ENT-01
- **D-13: Fill the reserved second grid cell in `CreatePanel.tsx` with the "Start from my brief" card.** D-28 (Phase 40) already left the cell **absent, not a dead button**, specifically for this phase. The card reveals the brief-intake form (inline expand or modal — **Claude's discretion**, within the 1c token system); on submit it: `issues:ensureByNumber` → the new brief-trigger client call (D-14) → `router.push(issueHref(n))` to the Workspace at Stage 1. Both paths land at Stage 1 (ENT-01), reusing `issueHref` and the CreatePanel grid.
- **D-14: A new `triggerBriefRun`-style client** in `lib/pipelineControlClient.ts` (sibling of `triggerRun`) posts the human brief payload with the Clerk token. No change to the existing `triggerRun` / "Find a story with agents" path.

### Brief-entry API endpoint — ENT-02
- **D-15: A new dedicated Clerk-guarded endpoint (e.g. `POST /pipeline/run/brief` or `POST /issues/brief`) reusing an `entry_mode`-extended `_start_run`.** It validates the human brief, seeds `entry_mode='brief'` + winner/candidates/brief (D-04), ensures the `briefs` row (D-06), and calls `_start_run` so **all shared run-launch discipline is preserved**: the one-at-a-time gate (409 if a run is running), the RUN-06 budget start-gate, the config load+snapshot, and the `agentRuns:queueForRun` pre-population. Do NOT overload `RunWeeklyBody` / `/pipeline/run`. Contract-first: add a **§48** to `docs/API_CONTRACTS.md` for the endpoint + `entry_mode` field + the brief-run seed shape.
- **D-16: The `agentRuns:queueForRun` list for a brief run is the SHORTER node set** — `calibrator, verify_candidates, researcher, verify_research, *SECTION_WRITERS, validate_sections, qa, editor_final, publisher` (no `signal_editor`, `scout`, `advocate`, `editor_gate_1`, `chronicler`). So the live-progress rail + Run Details reflect the *real* brief path, not phantom skipped steps. `_start_run` currently hard-codes the full 20-step list; brief mode passes the reduced list.

### Claude's Discretion
- Inline-expand vs. modal for the brief-intake form; exact field layout within the 1c token system.
- Where the `briefs:insert` write happens for a brief run (console pre-trigger, the trigger endpoint, or a tiny deterministic pre-graph seed) — as long as a row exists before the writers draft (D-06).
- Exact `route_by_entry_mode` router signature + edge placement (D-01).
- Exact threading of source material into the Researcher (new `DispatchState` field vs. existing research-seed slot) (D-10).
- Whether `voiceIntention` defaults from `style_brief.visualDirection` or starts blank (D-08).
- Whether the endpoint is named `/pipeline/run/brief` or `/issues/brief` (D-15) — match whichever sibling convention the planner finds cleanest.

### Folded Todos
None — no pending todos matched this phase (`todo match-phase 48` → 0 matches).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner) MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 48 (~L1043) — goal + 4 success criteria; §Phase 47 (~L1021) for the Brief this consumes; §Phase 49/50 for what is explicitly NOT in scope.
- `.planning/REQUIREMENTS.md` — **ENT-01..ENT-04** (~L409–412).
- `.planning/PROJECT.md` §Current Milestone (locked decision: "'Start from my brief' is in scope as a real pipeline entry point, not a stub" ~L33) + §Reconciliation facts (the 18→20 node reality, the write boundary, `verify_candidates` ~L44).

### Design intent (BINDING — this is the UI/behavior contract; no separate UI-SPEC.md, per the 40–47 convention)
- `docs/design/dispatch-control-v3/README.md` §Decision 1 (~L34) — "Second pipeline entry point: human supplies premise/peg/organization; Scout + Gate 1 are skipped; the run enters at Researcher."
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` §10 (~L152) — "'Start from my brief' is unwired… build it as a real second pipeline entry point (skip Scout + Gate 1, enter at Researcher)"; §the 5-stage strip + derived selectors.
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` §Primary action (~L25) — "Create issue → two equal paths… both landing in the same Issue Workspace at Story & Brief" + §Stage 1 (leads-vs-brief-started Stage 1) + §State model.

### Contract boundary (HARD RULE — amend BEFORE code)
- `docs/API_CONTRACTS.md` — **§7 DispatchState** (add `entry_mode`; the brief-seed shape); **§47.1–47.5** (the `briefs` table + Brief TypedDict + `briefs:insert`/`patch` this phase authors from human input; §47.3 documents the discovery-mode assembly this phase parallels; §47.3's own note anticipates "seed Phase 48's 'Start from my brief' hand-authored entry point"); add a new **§48** for the brief-trigger endpoint + `entry_mode` routing + the reduced agent_runs queue.

### Upstream phase context (build on these)
- `.planning/phases/47-story-brief-stage/47-CONTEXT.md` + `47-VERIFICATION.md` — the Brief artifact (6 fields), `briefs` table, `api/brief.py` BRF-05/BRF-06 edit+strengthen this phase reuses for the blank fields, and the "keep the Brief shape clean and console-editable because Phase 48 authors the same shape by hand" seam note (47 `<specifics>`).
- `.planning/phases/46-signal-editor-candidate-verification/46-CONTEXT.md` + `46-VERIFICATION.md` — `verify_candidates` node behavior, `VerificationRecord` shape, `verificationRecords` table (ENT-04).
- `.planning/phases/40-issue-entity-issues-home/40-CONTEXT.md` — D-28 ("no dead button in the primary CTA"; the reserved second Create-panel cell) and the issue-keyed routing/`issueHref` this lands into.

### Existing code (reuse / touch targets)
- `apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx` — the ONE Create card + the **reserved-but-absent second cell** (D-13); the `ensureByNumber` + `triggerRun` + `issueHref` flow to mirror.
- `apps/dispatch-control/lib/pipelineControlClient.ts` — `triggerRun` (the sibling for the new `triggerBriefRun`, D-14); `adjudicateGate1` (the Clerk-token client idiom).
- `apps/dispatch-control/lib/briefClient.ts` + `app/(dashboard)/story-brief/_components/BriefFieldTable.tsx` + `BriefFieldStrengthen.tsx` — the shipped Brief edit/strengthen UI the blank fields (D-08) get filled with, unchanged.
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — the `START → calibrator → …` chain (D-01 adds the conditional entry); `SECTION_WRITERS`.
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py::_start_run` — the shared launcher to extend with `entry_mode` + the brief seed + the reduced agent_runs list (D-15/D-16); `RunWeeklyBody` (do NOT overload).
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py::pipeline_run` + `_require_clerk_jwt_control` + `_emit_audit` — the Clerk-guarded trigger + audit idiom the brief endpoint mirrors.
- `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py::_assemble_brief` (§47.3) + `agents/verify_candidates.py` + `agents/researcher.py` — the discovery-mode Brief assembly this parallels (from human input), the verification node reused on the org (ENT-04), and the Researcher entry the brief run lands at (reads `winning_charity`, D-04).
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — `DispatchState` (add `entry_mode`); `Brief`, `CharityCandidate`, `StyleBrief` TypedDicts.
- `convex/briefs.ts` + `convex/schema.ts` (`briefs`, the run/`entry_mode` field) + `convex/verificationRecords.ts` + `convex/auditLog.ts` — **must be live-synced** (`pnpm --filter @eisenbalm/convex dev:once`) after any function/schema touch (memory `[[convex-functions-need-live-sync]]`).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The entire downstream is reused verbatim:** Researcher → verify_research → 7 writers → validate_sections → QA → editor_final → publisher already read `winning_charity` / `brief` / `research` from state — seeding those from the human input (D-04) is the only pipeline change on the content side.
- **`verify_candidates` already exists and is conservative** (Phase 46): it never kills on ambiguous checks and persists a `VerificationRecord` per candidate — exactly the "advisory record, never halt" posture D-11 wants, just invoked on a single human org.
- **`_start_run` is the single shared launcher** with the one-at-a-time gate, budget gate, config snapshot, and agent_runs queue already factored out (Phase 25) — the brief endpoint extends it (D-15), it does not reinvent trigger discipline.
- **The Brief edit + strengthen UI is shipped whole** (Phase 47 `api/brief.py` + `briefClient.ts` + `BriefFieldTable`/`BriefFieldStrengthen`) — the blank Brief fields (D-08) are filled with it, no new editing surface.
- **The CreatePanel reserved cell was designed for this** (Phase 40 D-28) — the second card drops into an intentionally-empty grid slot, not a redesign.
- **The Brief entity + shape already exists** (Phase 47) — Phase 48 authors the same 6-field shape by hand; the API contract §47.3 explicitly anticipates it.

### Established Patterns
- **Contract-first** (CLAUDE.md hard rule): amend `docs/API_CONTRACTS.md` §7 (`entry_mode` + brief seed) and add §48 (endpoint + routing) BEFORE code; `convex/schema.ts` (`entry_mode` on the run) before the mutation.
- **"Nothing silent":** the brief-trigger emits an `audit_log` row (`run.triggered` with an entry_mode marker), mirroring `control.py::pipeline_run`.
- **Convex functions need live sync** (`[[convex-functions-need-live-sync]]`): any new/changed Convex function or schema field must be synced to `dev:modest-magpie-797` — committed ≠ deployed.
- **Run strict build before done** (`[[run-strict-build-before-frontend-phase-done]]`): `pnpm --filter dispatch-control build` MUST pass — vitest doesn't type-check.
- **Sequential-in-main-checkout execution** (Phases 36–47) — no worktrees; avoids the strand problem (`[[gsd-worktree-strands-code-on-branches]]`).

### Integration Points
- `START` conditional edge in `graph/builder.py` (D-01) — the one graph-topology change.
- `DispatchState['entry_mode']` (`graph/state.py`, §7) — the routing + seed flag.
- `_start_run` (`api/runs.py`) — extended with `entry_mode` + brief seed + reduced agent_runs list (D-15/D-16).
- A new brief-trigger endpoint (`api/control.py` or a sibling) — Clerk-guarded, reuses `_start_run`.
- `CreatePanel.tsx` reserved cell + a new `triggerBriefRun` client (`lib/pipelineControlClient.ts`) (D-13/D-14).
- `convex/briefs.ts` insert-from-human-input + `entry_mode` on the run row (D-06).

</code_context>

<specifics>
## Specific Ideas

- The API contract **already anticipates this phase**: §47.3 states the discovery-mode auto-Brief "seeds Phase 48's 'Start from my brief' hand-authored entry point, which has no such race (it authors a Brief before any run starts)." Build to that — the brief is authored *before* the run, so there is no writers-draft-before-edit race that discovery mode has.
- **The one honest divergence to flag for Andrew (D-12):** a brief-started issue has **no deliberation section** (there was no scout/advocate/gate-1 debate to chronicle). This is deliberate and correct — a fabricated deliberation would undercut the milestone's verification/trust story. It sits outside ENT-03's "same downstream artifacts" list and its "indistinguishable at Stages 2–5" scope. If Andrew wants a deliberation-equivalent for brief runs later, the "dramatize the editor's decision-to-run-this-brief" option is captured in `<deferred>`.
- **ENT-03's "indistinguishable" is scoped precisely:** the enumerated artifacts are research, sections, QA, claims, sign-offs — and Stages 2–5. A reviewer opening a brief-started issue at Draft/Fact Check/Voice Pass/Approval should not be able to tell it came from a brief. Stage 1 legitimately differs (a single human-authored brief + one verified org vs. a leads slate) — that is the point of the entry point, not a defect.
- **ENT-04 is the trust anchor:** the whole milestone's story rests on "the verification record is never absent." A human-chosen org is the *most* important one to verify — so `verify_candidates` runs even though the human already decided (D-11). The record is advisory, but it must exist.
- The "two equal paths" language (ENT-01, Annotations §25) is load-bearing: the second card is a **peer**, not a secondary/muted option — equal visual weight in the CreatePanel grid.

</specifics>

<deferred>
## Deferred Ideas

- **A deliberation-equivalent for brief runs** — a chronicler variant that dramatizes the editor's decision to run this particular brief (rather than a scout/advocate debate). Considered for D-12 but explicitly NOT built: it risks fabricating a "deliberation" that never happened. Revisit only if Andrew wants brief-started issues to carry a deliberation section. → future/backlog.
- **File/asset upload for source material** — this phase is free-text only (D-10). Richer source ingestion (PDFs, images, uploaded documents) is out of scope; Phase 31's asset-upload infra is for issue content, not brief seeds. → backlog.
- **Roles/permissions gating of who may start a brief run** → **Phase 49** (the six server-enforced gated actions).
- **Nomenclature / Workbench rename** ripple (Run Details naming the brief-run steps) → **Phase 50**.
- **LLM expansion of the minimal brief into a full 6-field Brief at intake** — considered for D-08 but NOT chosen: the operator fills the remaining fields with the shipped BRF-06 strengthen on demand, avoiding a new LLM call at trigger time.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 48-brief-entry-point*
*Context gathered: 2026-07-16 via smart discuss (`--auto`)*
