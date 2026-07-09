# Phase 37: Run Monitor v2 + Signal Desk - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all four areas accepted as recommended

<domain>
## Phase Boundary

Two operator surfaces over EXISTING run data (no schema/endpoint dependency on Phases 31-36). **Run Monitor v2:** a run renders as a vertical forensic spine — LLM agents as dots, code gates (`verify_research`, `validate_sections`) as marigold diamonds — each showing per-node cost, latency, model chip, and retry count; clicking a node shows the upstream→node→downstream handoff human-readably first with raw JSON behind a toggle; the 7-writers node expands into per-section rows with a QA-derived strength score (0-100 colored bar) and flag counts, each section individually re-runnable; a drift strip compares the current run's cost and duration against the trailing 8 runs. **Signal Desk:** the Gate 1 candidate slate (pitchLog scout summaries, Advocate scores with expandable arguments, `primaryConcern` always visible, never truncated) + the winner/confidence/reasoning panel in full; when the pipeline interrupts at Gate 1 the screen enters side-by-side adjudication and the operator's pick plus a logged reason resumes the run via the existing `POST /run/{run_id}/resume`. Requirements: MON-01, MON-02, MON-03, MON-04, SIG-01, SIG-02, SIG-03.

**Explicitly NOT in scope:** Prompt Lab Evals / Eval Center (Phase 38); Registry coverage-memory strip (Phase 39); changing the pipeline graph topology or the agent set; the `hookClaim`/`hookVerified` data model (still deferred — Signal Desk uses pitchLog data as-is).

</domain>

<decisions>
## Implementation Decisions

### Forensic spine surface & node model (MON-01/02)
- **D-01: Rebuild the existing `run-monitor/graph` view in place** into the vertical forensic spine ("Run Monitor v2" = upgrade v1, not a new route). The `run-monitor/runs/[runId]` list and `run-monitor/runs/[runId]/review` page stay. The spine reads `agent_runs` (by_runId) for the node timeline.
- **D-02: Agents = dots, code gates = marigold diamonds.** `verify_research` and `validate_sections` are already `wrap_agent_node`-wrapped and emit `agent_runs` rows — the spine distinguishes them as diamonds via a known gate-key set (`{verify_research, validate_sections}`) rather than a schema change. Each node shows cost (`costUsd`), latency (`durationMs`), model chip (from `model_versions`/payload), and retry count.
- **D-03: Add `retryCount: v.optional(v.number())` to `agent_runs`** (additive), populated by the agent wrapper (`_wrapper.py` already surfaces `attempts` on retry) — legacy rows render 0. Contract-first: amend `docs/API_CONTRACTS.md` before the schema/wrapper change. This is the only schema change in the phase.
- **D-04: Handoff inspector (MON-02) renders `agent_run_payloads`** input/output snapshots human-readably first (upstream output → this node's input/output → downstream input, formatted), with the raw JSON snapshot behind a toggle. No new payload capture — reuse the Phase 23 `inputSnapshot`/`outputSnapshot` (truncated ~2000 chars; note the truncation in the UI).

### 7-writers strength score & re-run (MON-03)
- **D-05: Deterministic QA-derived strength score, 0-100 per section.** Start at 100, subtract a severity-weighted penalty per OPEN `qaCorrections` finding in that section (error ≫ warning > info — exact weights Claude's discretion, e.g. error −25 / warning −8 / info −2), floor at 0. A colored bar (green/amber/red by threshold). Deterministic and explainable — no LLM scoring, no new pipeline call.
- **D-06: Per-section re-run reuses the existing `rerun_agent` endpoint** (the Phase 33 D-15 target) — one row per writer section, each individually re-runnable from the expanded 7-writers node.
- **D-07: Flag counts = open `qaCorrections` per section grouped by severity** (consistent with the Review Desk/Voice Pass open-finding predicate). The 7-writers node maps section rows to writer agentKeys.

### Drift strip (MON-04)
- **D-08: Client-side aggregation over the trailing 8 completed runs — no new table.** For each of the last 8 runs (plus the current), aggregate its `agent_runs` rows (Σ `costUsd`, Σ `durationMs` or run wall-clock from first-start→last-complete). Compare the current run's cost + duration against the trailing-8 mean with an over/under indicator. If profiling later shows this is too heavy, a run-summary rollup is the fallback — but ship the client aggregate first (existing data, zero migration).

### Signal Desk + Gate 1 adjudication (SIG-01/02/03)
- **D-09: Build out the `signal-desk` stub** (`app/(dashboard)/signal-desk/page.tsx` exists) as the Gate 1 candidate slate + decision panel + adjudication — a surface distinct from the forensic Run Monitor (Run Monitor = "what happened"; Signal Desk = "the charity decision").
- **D-10: Candidate slate from existing data (SIG-01):** `pitchLog` scoutSummary + advocateScore + expandable advocateArgument + `primaryConcern` ALWAYS visible and NEVER truncated (the roadmap's explicit anti-truncation rule). Read via the existing pitchLog Convex query (by_runId).
- **D-11: Decision panel (SIG-02):** winner + a confidence meter + editor reasoning IN FULL, sourced from the `deliberationEvents` editor-gate-1 / editor-decision row payload (winner, confidence, reasoning). Never truncated.
- **D-12: Adjudication on Gate 1 interrupt (SIG-03):** when the run is paused at Gate 1 (`graph.aget_state` has `state.next` non-empty — the resume endpoint's own paused-check), the Signal Desk enters side-by-side adjudication. The operator picks a candidate and types a reason; the pick + reason resume the run via the existing `POST /run/{run_id}/resume` (which passes `Command(resume={editorSelection: charityName})`).
- **D-13: Clerk-guarded adjudication bridge.** The resume endpoint is `_require_trigger_secret`-guarded (server-to-server), but the dashboard is Clerk-guarded. Add a Clerk-JWT-guarded control endpoint (e.g. `POST /issues/{run_id}/adjudicate` in `api/control.py` or `runs.py`) that (a) records the operator's pick + reason as an audit row (`_emit_audit`, "nothing silent") and a deliberation/decision event, then (b) invokes the resume path server-side with the chosen `charityName`. Extend the resume pick to carry the operator `reason` for the log. Contract-first: amend `docs/API_CONTRACTS.md` before the endpoint. The operator NEVER handles the trigger secret.

### Claude's Discretion
- Exact strength-score penalty weights + color thresholds; model-chip source field; spine layout/scroll mechanics; diamond vs dot visual treatment within the 1c system.
- Drift-strip aggregation window edge cases (fewer than 8 prior runs → compare against what exists; label the n); mean vs median.
- The adjudication bridge endpoint's exact path/shape and whether it reuses `runs.py::resume_run` internals or calls it; how the operator reason is stored (audit row + deliberationEvents editor-decision vs a dedicated field).
- Whether the 7-writers node maps sections→writer agentKeys via the existing section/agent map or a new lookup.
- Signal Desk chrome, confidence-meter visual, expandable-argument interaction.

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 37 — goal + 6 success criteria.
- `.planning/REQUIREMENTS.md` — MON-01..MON-04, SIG-01..SIG-03 (EVL-*/REG-* are Phases 38/39 — do not pull in).
- `.planning/PROJECT.md` §Current Milestone — locked v3.0 decisions.

### Design handoff (binding)
- `docs/design/dispatch-control-v2/README.md` §Run Monitor + §Signal Desk — the forensic spine (dots/diamonds, per-node chips), 7-writers expansion with strength bars, drift strip, Gate 1 slate + adjudication layout.
- `docs/design/dispatch-control-v2/Dispatch Control.dc.html` — 1c tokens (marigold `#f2b01e` diamonds, etc.).
- `docs/design/dispatch-control-v2/DECISIONS.md` — house rules (`primaryConcern` never truncated; "nothing silent").

### Contract boundary (hard rule)
- `docs/API_CONTRACTS.md` — amend BEFORE code: the `agent_runs.retryCount` additive field, the Clerk-guarded adjudication bridge endpoint (pick + reason → resume), and any drift/strength read shapes if new queries are added.

### Existing code (build on these)
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/page.tsx` + `_components/` — the v1 graph view rebuilt into the forensic spine (D-01).
- `apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/` — the runs list + review page (stay; D-01).
- `apps/dispatch-control/app/(dashboard)/signal-desk/page.tsx` — the stub built out into the Gate 1 slate + adjudication (D-09).
- `convex/schema.ts` — `agent_runs` (~L322; D-03 retryCount lands here), `agent_run_payloads` (~L339; MON-02 handoff source), `pitchLog` (~L110; SIG-01), `deliberationEvents` (editor-gate-1/decision; SIG-02), `qaCorrections` (strength/flag source, D-05/D-07), `audit_log` (D-13).
- `convex/agentRuns.ts` / `convex/pitchLog.ts` / `convex/qaCorrections.ts` / `convex/deliberationEvents.ts` — the read queries the two screens subscribe to.
- `packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py` — `wrap_agent_node`; surfaces `attempts` on retry (D-03 populates retryCount here) and writes `agent_runs`.
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — the graph topology (which nodes exist, gate placement) the spine mirrors; `verify_research`/`validate_sections` node registration (D-02).
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` — `POST /run/{run_id}/resume` (`resume_run`, `ResumeBody`, `_require_trigger_secret`, the paused-state check); D-12/D-13 build the adjudication bridge around this.
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` — `_emit_audit`, `_require_clerk_jwt_control`, `rerun_agent` (D-06 per-section re-run; D-13 bridge auth + audit patterns).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Per-node telemetry already captured** — `agent_runs` has costUsd/durationMs/tokensIn/tokensOut/status/error per (runId, agentKey); the spine reads it directly. Only `retryCount` is missing (D-03).
- **Handoff snapshots exist** — `agent_run_payloads.inputSnapshot`/`outputSnapshot` (Phase 23 OBS-05) feed MON-02 with no new capture.
- **Code gates already emit rows** — `verify_research`/`validate_sections` are wrapped nodes, so they appear in `agent_runs` and just need diamond rendering (D-02).
- **Candidate + decision data exist** — `pitchLog` (scoutSummary/advocateScore/advocateArgument/primaryConcern) and `deliberationEvents` (editor-gate-1) cover SIG-01/02 with no pipeline change.
- **Resume endpoint exists** — `POST /run/{run_id}/resume` with the paused-state guard; D-12 reuses it, D-13 adds the Clerk-guarded bridge + operator-reason logging.
- **rerun_agent exists** — the per-section re-run target (D-06), already used by Phase 33's rail.
- **run-monitor/graph + signal-desk stub** — both surfaces have a scaffold to build on.

### Established Patterns
- Contract-first: amend `docs/API_CONTRACTS.md` before the retryCount field + adjudication endpoint.
- "Nothing silent": the adjudication pick + reason gets an audit row + deliberation event (D-13).
- Server-guarded: dashboard → Clerk-JWT control endpoint → server-to-server resume (never expose the trigger secret to the client).
- Convex reactivity: spine, strength bars, drift strip, and the slate update live via `useQuery` — no polling.
- 1c design tokens/chrome (Phase 30) wrap both screens; `primaryConcern` never truncated (design DECISIONS.md).
- Run strict `pnpm --filter dispatch-control build` before declaring frontend work done (vitest doesn't type-check).
- **Parallel worktree caution:** Phase 36 ran its wave sequentially in the main checkout to avoid the Phase 35 worktree-strand problem — do the same or reconcile branches onto master before the next wave.

### Integration Points
- `run-monitor/graph` — the forensic spine (MON-01/02/03/04).
- `signal-desk` — the Gate 1 slate + decision panel + adjudication (SIG-01/02/03).
- `agent_runs` (+ retryCount) / `agent_run_payloads` / `pitchLog` / `deliberationEvents` / `qaCorrections` — the read model.
- `_wrapper.py` — retryCount population (D-03).
- `api` — the Clerk-guarded adjudication bridge → `resume_run` (D-13); `rerun_agent` for per-section re-run (D-06).

</code_context>

<specifics>
## Specific Ideas

- Design README §Run Monitor is the north star: a vertical spine, dots for LLM agents, marigold diamonds for the two code gates, per-node cost/latency/model/retry chips; the 7-writers node expands into per-section strength bars; a drift strip vs the trailing 8.
- `primaryConcern` "always visible, never truncated" and the editor reasoning "in full" are literal anti-truncation rules from the roadmap/DECISIONS.md — honor them exactly (no line-clamp on those fields).
- The adjudication is the one write action: everything else on both screens is read-only observability. The write (pick + reason → resume) must be server-guarded and audit-logged like every other v3.0 mutation.

</specifics>

<deferred>
## Deferred Ideas

- **Prompt Lab Evals + Eval Center** — Phase 38.
- **Registry coverage-memory strip** — Phase 39.
- **hookClaim/hookVerified data model** — still deferred; Signal Desk uses pitchLog as-is (the Phase 33 D-12 hook card upgrades later if that model ever lands).
- **Run-summary rollup table for drift** — considered, not chosen (D-08 client-aggregates existing data); revisit only if the trailing-8 aggregation is too heavy in practice.
- **`nodeType` schema field for dot/diamond** — considered, not chosen (D-02 uses a known gate-key set); revisit if the gate set grows.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 37-run-monitor-v2-signal-desk*
*Context gathered: 2026-07-09 via smart discuss (autonomous)*
