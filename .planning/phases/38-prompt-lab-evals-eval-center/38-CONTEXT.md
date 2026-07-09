# Phase 38: Prompt Lab Evals + Eval Center - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all four areas accepted as recommended

<domain>
## Phase Boundary

The operator can validate a prompt edit against real scenarios before committing it, and can watch editorial quality over time instead of trusting a single green number. Golden scenario fixtures run against a single agent through the EXISTING `test-run`/`score` endpoints; editing a prompt in the Prompt Lab eval drawer auto-selects the scenarios it affects, runs them, and shows a scoreboard of deltas vs the active version; committing a prompt is gated on target-metric-up-with-no-regressions, with a logged override-with-reason escape hatch so the gate cannot deadlock; the Eval Center shows scenario cards (description, what-it-catches, last result) plus an append-only scoreboard time-series in new Convex tables — the editorial drift detector; and the operator can run a shadow run (the discovery scenario against current real news) to preview what a paid run would produce, without publishing or affecting run state. Requirements: EVL-01, EVL-02, EVL-03, EVL-04, EVL-05.

**Explicitly NOT in scope:** Registry coverage-memory strip (Phase 39); changing the scoring rubric or the judge itself; multi-agent/full-pipeline eval scenarios (single-agent only); replacing the Phase 24 prompt versioning model.

</domain>

<decisions>
## Implementation Decisions

### Golden scenarios (EVL-01)
- **D-01: Scenarios live as versioned repo fixtures** (e.g. `packages/pipeline/.../evals/scenarios/`), one per file or a manifest, each shaped `{id, agentKey, description, whatItCatches, input (the test-run body payload for that agent), scoringTarget}`. The repo is the source of truth; the Eval Center reads them (no scenario data duplicated into Convex). Exact directory + format Claude's discretion.
- **D-02: A scenario is a single-agent fixture** executed through the EXISTING `POST /agents/{agent_key}/test-run` (produces output + cost) then `POST /agents/{agent_key}/score` (rubric overall + per-axis + rationale). No new scoring mechanism — reuse both endpoints as-is. No full-pipeline scenarios this phase.
- **D-03: Seed a starter set for the highest-value agents** (the voice-critical writers + scout/researcher) — enough to make the drawer + Eval Center real, with the fixture format designed so Andrew can add more incrementally without code changes.

### Eval drawer + commit gate (EVL-02/03)
- **D-04: Auto-select by agentKey.** Editing agent X's prompt in the Prompt Lab selects the scenarios whose `agentKey === X`. The eval drawer runs exactly those, no manual picking (manual add/remove is a nice-to-have, not required).
- **D-05: Scoreboard of deltas vs active.** For each selected scenario, run it against BOTH the draft prompt and the active version (both via test-run→score), and show a per-scenario row with the draft score, the active score, and the delta — reusing the existing `TestRunPanel` draft-vs-active + score-delta pattern (Phase 28 D-08) scaled to N scenarios. An aggregate/target-metric summary sits on top.
- **D-06: Server-enforced commit gate (EVL-03).** Committing (activating) a prompt version is gated at the prompt activate/commit endpoint: block if the target metric is not up OR any scenario regresses (score down beyond a tolerance) vs the active version. This UPGRADES Phase 28 D-05/D-06 where "the score never gates any action." The gate is server-enforced (a disabled button alone is cosmetic — consistent with every v3.0 gate), and the eval results the gate reads must be fresh for the version being committed.
- **D-07: Override-with-reason escape hatch, logged.** The gate cannot deadlock: an operator can commit despite a red gate by supplying a typed reason, recorded to `audit_log` ("nothing silent"). This mirrors the phase's own success criterion ("logged override-with-reason so the gate cannot deadlock"). Exact endpoint shape Claude's discretion (contract-first).

### Eval Center (EVL-04)
- **D-08: Build out the `eval-center` stub** (`app/(dashboard)/eval-center/page.tsx` exists) as: scenario cards (description, what-it-catches, last result) + an append-only scoreboard time-series (the editorial drift detector). Distinct surface from the Prompt Lab.
- **D-09: New Convex append-only time-series table `eval_scores`** — one row per scenario run: `{workspace_id, scenarioId, agentKey, promptVersion, overall, axes (JSON), costUsd, ranAt, source ('drawer'|'commit'|'manual')}`. Append-only (never updated/deleted) so the time-series IS the drift record. Scenarios themselves stay fixture-sourced (D-01) — the table stores results, not definitions. Contract-first: amend `docs/API_CONTRACTS.md` + add the table before code.
- **D-10: The scoreboard renders the time-series** per scenario (and/or per agent) across prompt versions so editorial drift over time is visible — not a single latest number. Scenario cards show the latest `eval_scores` row as "last result".

### Shadow run (EVL-05)
- **D-11: A read-only shadow endpoint** runs the Scout discovery scenario against LIVE news (real search), returns the preview output (what a paid run would produce), and writes NOTHING to run state — no `pipelineRuns`, no `pitchLog`, no `agent_runs`, no publish, no pipeline mutation. Purely a preview. It reuses the Scout agent logic but in an isolated, side-effect-free path.
- **D-12: Isolation is the contract.** The shadow endpoint must be provably free of run-state writes (a test asserting no Convex run-table mutations / no pipeline state change). It is NOT the normal test-run (which is prompt-focused and offline-capable) — it deliberately hits live search to preview real discovery, but stays read-only.
- **D-13: Triggered from the Eval Center** (the "preview what a paid run would produce" affordance), showing the shadow output inline. Surface placement Claude's discretion within Eval Center.

### Claude's Discretion
- Scenario fixture directory + file format + the starter scenario contents; the scoring-target/threshold semantics (what "target metric up" and "regression tolerance" mean numerically).
- The eval-run orchestration endpoint(s): whether the drawer/commit run scenarios via a new batch endpoint or loops the existing per-agent test-run→score client-side; where `eval_scores` rows are written (pipeline vs a Convex mutation).
- The commit-gate + override endpoint shapes (contract-first: amend `docs/API_CONTRACTS.md` before code).
- The shadow endpoint's exact path/shape and how it guarantees read-only isolation; whether it caps cost/time.
- Eval Center card + time-series chart visuals within the 1c system; whether the drift view is a sparkline, table, or small chart.

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 38 — goal + 5 success criteria.
- `.planning/REQUIREMENTS.md` — EVL-01..EVL-05 (REG-* is Phase 39 — do not pull in).
- `.planning/PROJECT.md` §Current Milestone — locked v3.0 decisions.

### Design handoff (binding)
- `docs/design/dispatch-control-v2/README.md` §Prompt Lab + §Eval Center — the eval drawer scoreboard, commit gate, scenario cards, drift time-series, shadow-run affordance.
- `docs/design/dispatch-control-v2/DECISIONS.md` — house rules ("nothing silent"; gates the server enforces).
- `docs/design/dispatch-control-v2/Dispatch Control.dc.html` — 1c tokens.

### Contract boundary (hard rule)
- `docs/API_CONTRACTS.md` — §3/§3A cover test-run + score today; amend BEFORE code for: the eval-run/scoreboard read shape, the commit gate + override-with-reason on the prompt activate endpoint, the new `eval_scores` Convex table, and the shadow-run endpoint.

### Existing code (build on these)
- `packages/pipeline/src/eisenbalm_pipeline/api/agents.py` — `POST /{agent_key}/test-run` (TestRunBody/TestRunResponse, offline-capable) + `POST /{agent_key}/score` (ScoreBody/ScoreResponse, `judge.score_output`, overall+axes+rationale) — the eval primitives (D-02); the prompt activate/commit flow the gate wraps (D-06).
- `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` — the discovery agent the shadow run reuses read-only (D-11); its live-search path.
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` — `score_output` / rubric (the scoring the scenarios rely on; do not change it).
- `convex/schema.ts` — `prompt_versions` (~L296; the commit/activate + version the gate reads), `audit_log` (~L264; D-07 override log). New `eval_scores` table lands here (D-09).
- `convex/prompt_versions.ts` / `convex/auditLog.ts` — the versioning + audit query/mutation surfaces.
- `apps/dispatch-control/app/(dashboard)/prompt-lab/[agentKey]/page.tsx` + `_components/` — `TestRunPanel.tsx` (draft-vs-active + score-delta pattern D-05 scales up), `VersionHistoryPanel.tsx` (commit/activate UI the gate wraps), `AssembledPreview.tsx`, `agentList.ts`.
- `apps/dispatch-control/lib/testRunClient.ts` + `lib/scoreClient.ts` — the test-run + score clients the eval drawer reuses per scenario.
- `apps/dispatch-control/app/(dashboard)/eval-center/page.tsx` — the stub built out (D-08).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Eval primitives already exist** — `test-run` (output+cost) and `score` (rubric overall/axes/rationale) endpoints + their TS clients; scenarios are just fixtures fed through them (D-02). No new scoring engine.
- **Draft-vs-active + score-delta already built** — `TestRunPanel` (Phase 28 D-08) runs draft + active and shows the score delta; the eval drawer generalizes it to N scenarios (D-05).
- **Prompt versioning + activate flow** — Phase 24 `prompt_versions` + the activate/commit path the D-06 gate wraps (currently ungated — Phase 28 D-05/D-06).
- **Scout live-discovery** — reused read-only for the shadow run (D-11).
- **Audit infra** — `audit_log` + `_emit_audit` cover the override-with-reason log (D-07) with zero new machinery.
- **eval-center + prompt-lab surfaces scaffolded** — a stub and a full lab to build the drawer + center on.

### Established Patterns
- Contract-first: amend `docs/API_CONTRACTS.md` before the eval_scores table / commit gate / override / shadow endpoints.
- "Nothing silent": the commit override is audit-logged (D-07).
- Server-enforced gates, never just a disabled button (Phase 26/33/34) — D-06 applies it to prompt commit.
- Append-only time-series as the record of truth (mirrors deliberationEvents / audit_log) — D-09 eval_scores.
- Convex reactivity: the drawer scoreboard + Eval Center drift view update live via `useQuery`.
- Run strict `pnpm --filter dispatch-control build` before declaring frontend work done (vitest doesn't type-check).
- **Sequential-in-main-checkout execution** (Phases 36-37) — avoid the Phase 35 worktree-strand problem; reconcile branches before the next wave if worktrees are used.

### Integration Points
- `agents.py` test-run/score — the scenario execution primitive; the prompt activate endpoint gains the D-06 gate + D-07 override.
- New `eval_scores` Convex table — written on each eval run, read by the drawer + Eval Center.
- `scout.py` — the shadow-run read-only reuse.
- `prompt-lab` — the eval drawer (auto-select + scoreboard + gated commit).
- `eval-center` — scenario cards + drift time-series + shadow-run trigger.

</code_context>

<specifics>
## Specific Ideas

- Design README's Prompt Lab/Eval Center is the north star: an eval drawer scoreboard with deltas, a commit gate with override-with-reason, an append-only Eval Center scoreboard, and a shadow run.
- The phase goal's operative contrast — "watch editorial quality over time instead of trusting a single green number" — is why D-09/D-10 make the scoreboard an append-only TIME-SERIES (drift detector), not a latest-value readout.
- EVL-03's own wording is binding: the commit gate must have a "logged override-with-reason escape hatch so the gate cannot deadlock" — D-07 is not optional polish; it's a named requirement.
- EVL-05's shadow run "without publishing or affecting run state" is a hard isolation contract (D-12) — the endpoint must be provably side-effect-free on run tables.

</specifics>

<deferred>
## Deferred Ideas

- **Registry coverage-memory strip** — Phase 39.
- **Multi-agent / full-pipeline eval scenarios** — considered, not chosen (D-02 single-agent only); revisit if single-agent scenarios prove insufficient.
- **Scenarios stored in Convex** — considered, not chosen (D-01 repo fixtures are the source of truth); the Convex table stores results, not definitions.
- **Auto-tuning / auto-commit on green** — out of scope; the gate informs a human commit, never auto-commits.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 38-prompt-lab-evals-eval-center*
*Context gathered: 2026-07-09 via smart discuss (autonomous)*
