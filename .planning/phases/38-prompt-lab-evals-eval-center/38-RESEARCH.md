# Phase 38: Prompt Lab Evals + Eval Center - Research

**Researched:** 2026-07-09
**Domain:** Internal architecture composition (no new external dependencies) — extending Phase 24/28 prompt-versioning + eval primitives with a scenario runner, a server-enforced commit gate, an append-only drift scoreboard, and an isolated shadow-discovery preview.
**Confidence:** HIGH (all primitives, signatures, and write-paths below were read directly from source, not recalled from training data)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Golden scenarios (EVL-01)**
- D-01: Scenarios live as versioned repo fixtures (e.g. `packages/pipeline/.../evals/scenarios/`), one per file or a manifest, each shaped `{id, agentKey, description, whatItCatches, input (the test-run body payload for that agent), scoringTarget}`. The repo is the source of truth; the Eval Center reads them (no scenario data duplicated into Convex). Exact directory + format Claude's discretion.
- D-02: A scenario is a single-agent fixture executed through the EXISTING `POST /agents/{agent_key}/test-run` (produces output + cost) then `POST /agents/{agent_key}/score` (rubric overall + per-axis + rationale). No new scoring mechanism — reuse both endpoints as-is. No full-pipeline scenarios this phase.
- D-03: Seed a starter set for the highest-value agents (the voice-critical writers + scout/researcher) — enough to make the drawer + Eval Center real, with the fixture format designed so Andrew can add more incrementally without code changes.

**Eval drawer + commit gate (EVL-02/03)**
- D-04: Auto-select by agentKey. Editing agent X's prompt in the Prompt Lab selects the scenarios whose `agentKey === X`. The eval drawer runs exactly those, no manual picking (manual add/remove is a nice-to-have, not required).
- D-05: Scoreboard of deltas vs active. For each selected scenario, run it against BOTH the draft prompt and the active version (both via test-run→score), and show a per-scenario row with the draft score, the active score, and the delta — reusing the existing `TestRunPanel` draft-vs-active + score-delta pattern (Phase 28 D-08) scaled to N scenarios. An aggregate/target-metric summary sits on top.
- D-06: Server-enforced commit gate (EVL-03). Committing (activating) a prompt version is gated at the prompt activate/commit endpoint: block if the target metric is not up OR any scenario regresses (score down beyond a tolerance) vs the active version. This UPGRADES Phase 28 D-05/D-06 where "the score never gates any action." The gate is server-enforced (a disabled button alone is cosmetic — consistent with every v3.0 gate), and the eval results the gate reads must be fresh for the version being committed.
- D-07: Override-with-reason escape hatch, logged. The gate cannot deadlock: an operator can commit despite a red gate by supplying a typed reason, recorded to `audit_log` ("nothing silent"). This mirrors the phase's own success criterion ("logged override-with-reason so the gate cannot deadlock"). Exact endpoint shape Claude's discretion (contract-first).

**Eval Center (EVL-04)**
- D-08: Build out the `eval-center` stub (`app/(dashboard)/eval-center/page.tsx` exists) as: scenario cards (description, what-it-catches, last result) + an append-only scoreboard time-series (the editorial drift detector). Distinct surface from the Prompt Lab.
- D-09: New Convex append-only time-series table `eval_scores` — one row per scenario run: `{workspace_id, scenarioId, agentKey, promptVersion, overall, axes (JSON), costUsd, ranAt, source ('drawer'|'commit'|'manual')}`. Append-only (never updated/deleted) so the time-series IS the drift record. Scenarios themselves stay fixture-sourced (D-01) — the table stores results, not definitions. Contract-first: amend `docs/API_CONTRACTS.md` + add the table before code.
- D-10: The scoreboard renders the time-series per scenario (and/or per agent) across prompt versions so editorial drift over time is visible — not a single latest number. Scenario cards show the latest `eval_scores` row as "last result".

**Shadow run (EVL-05)**
- D-11: A read-only shadow endpoint runs the Scout discovery scenario against LIVE news (real search), returns the preview output (what a paid run would produce), and writes NOTHING to run state — no `pipelineRuns`, no `pitchLog`, no `agent_runs`, no publish, no pipeline mutation. Purely a preview. It reuses the Scout agent logic but in an isolated, side-effect-free path.
- D-12: Isolation is the contract. The shadow endpoint must be provably free of run-state writes (a test asserting no Convex run-table mutations / no pipeline state change). It is NOT the normal test-run (which is prompt-focused and offline-capable) — it deliberately hits live search to preview real discovery, but stays read-only.
- D-13: Triggered from the Eval Center (the "preview what a paid run would produce" affordance), showing the shadow output inline. Surface placement Claude's discretion within Eval Center.

### Claude's Discretion
- Scenario fixture directory + file format + the starter scenario contents; the scoring-target/threshold semantics (what "target metric up" and "regression tolerance" mean numerically).
- The eval-run orchestration endpoint(s): whether the drawer/commit run scenarios via a new batch endpoint or loops the existing per-agent test-run→score client-side; where `eval_scores` rows are written (pipeline vs a Convex mutation).
- The commit-gate + override endpoint shapes (contract-first: amend `docs/API_CONTRACTS.md` before code).
- The shadow endpoint's exact path/shape and how it guarantees read-only isolation; whether it caps cost/time.
- Eval Center card + time-series chart visuals within the 1c system; whether the drift view is a sparkline, table, or small chart.

### Deferred Ideas (OUT OF SCOPE)
- Registry coverage-memory strip — Phase 39.
- Multi-agent / full-pipeline eval scenarios — considered, not chosen (D-02 single-agent only); revisit if single-agent scenarios prove insufficient.
- Scenarios stored in Convex — considered, not chosen (D-01 repo fixtures are the source of truth); the Convex table stores results, not definitions.
- Auto-tuning / auto-commit on green — out of scope; the gate informs a human commit, never auto-commits.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVL-01 | Golden scenarios exist as fixtures runnable against single agents through the existing test-run/score endpoints. | `TestRunRequest`/`ScoreRequest` exact shapes documented below (agents.py:149-179, 296-332); confirms `input` = a `dict[str,str]` variables map, NOT the full request body; confirms which agentKeys the flat-substitution model actually supports (scout/advocate/calibrator/editor_gate1/editor_final/researcher/game/design/bonus_*) vs which don't (origin_story/problem/founder_bio_*/case_study_* — see Pitfall "Section-writer scenario gap"). |
| EVL-02 | The Prompt Lab eval drawer auto-selects scenarios affected by the edited asset, runs them, and shows a scoreboard with deltas vs the active version. | `TestRunPanel.tsx` (draft-vs-active pattern, lines 51-368) is the exact reusable pattern; `runAgentTest`/`runActiveVersionTest`/`scoreOutput` client signatures documented; scaling to N scenarios is client-side looping, matching the codebase's existing style. |
| EVL-03 | Prompt commit is gated on target-metric-up with no regressions, with an override-with-reason escape hatch (logged) so the gate cannot deadlock. | `promptVersions.ts::activate` (lines 145-210) is the ACTUAL commit chokepoint — a direct dashboard→Convex mutation, not a pipeline endpoint. Exact TOCTOU-safe `{blocked, reason}` pattern already established (in-progress-run guard) is the template to extend. `audit_log` write pattern for the override is documented (auditLog.ts + §34.6b precedent). |
| EVL-04 | The Eval Center shows scenario cards (description, what-it-catches, last result) and an append-only scoreboard time-series in new Convex tables. | `eval-center/page.tsx` stub confirmed (15 lines, placeholder only); `eval_scores` table design constraints (append-only, D-09 shape) cross-checked against existing append-only tables (`audit_log`, `deliberationEvents`) for Convex table/query conventions; naming convention confirmed (`evalScores.ts` file, camelCase, matching `promptVersions.ts`/`auditLog.ts`). |
| EVL-05 | Operator can run a shadow run — the discovery scenario against current real news, without publishing or affecting run state. | `scout.py` fully read (367 lines) — confirms Scout's REAL write surface (Sanity `write_charity` + Convex `pitchLog:insert` + `charities:upsertCandidate`) lives INSIDE the agent function body, not just the `@agent_node` wrapper — so a naive "call scout() directly" or "call scout.__wrapped__" does NOT achieve isolation. A pure-function extraction is required (documented below with an exact split point). |
</phase_requirements>

## Summary

This phase adds no new libraries or services — it is 100% composition of primitives that already exist and are already exercised by Phase 24/28: `POST /agents/{agent_key}/test-run`, `POST /agents/{agent_key}/score`, the `prompt_versions` Convex table + `activate` mutation, and `audit_log`. The research below is almost entirely about **exactly where the seams are** — because two of them are less uniform than the CONTEXT doc's phrasing implies, and getting the plan right depends on knowing this before writing tasks.

The single most consequential finding: **prompt commit/activation is currently a direct dashboard→Convex mutation (`promptVersions.ts::activate`), not a pipeline HTTP endpoint.** `VersionHistoryPanel.tsx` calls `useMutation(api.promptVersions.activate)` directly. The existing mutation already has a TOCTOU-safe `{blocked, reason}` return pattern (for the in-progress-run guard) that the D-06 eval gate should extend in place, rather than inventing a new pipeline endpoint. This keeps prompt-versioning entirely Convex-native, consistent with how it works today, and sidesteps the EDT-05 write-boundary rule (which governs Sanity content writes, not Convex-native entities like `prompt_versions`/`audit_log`/`eval_scores`).

The second consequential finding: **Scout's real-run write surface (Sanity `write_charity` + Convex `pitchLog:insert` + `charities:upsertCandidate`) is inside the agent function body itself**, not the `@agent_node` decorator. Calling `scout(state)` directly — or even `scout.__wrapped__(state)` to bypass the decorator — still creates real charity documents in Sanity and real Convex rows. True isolation (D-12) requires extracting Scout's pure discovery logic (registry-dedup read → Tavily search → LLM parse → Python dedup filter) into a new function that both the real `scout()` node and the new shadow endpoint call, with only `scout()` performing the writes afterward.

The third finding, more subtle: **the test-run endpoint's flat `{token}`-substitution model does not replicate every agent's real prompt assembly.** Six agentKeys (`origin_story`, `problem`, `founder_bio_verified/anonymous`, `case_study_verified/anonymous`) are "section-guidance" prose assets whose real-run prompts are built by `build_section_writer_prompt(...)` — a structured function taking `charity`/`research`/`style_brief` dicts, never called by `test-run`. Testing these agentKeys via `test-run` today only exercises the bare guidance text with a generic default user message — no charity/research context. The eight golden-scenario names in the design brief (`normal week`, `dry well`, `famous bait`, `ghost charity`, `radioactive week`, `repeat pressure`, `voice gauntlet`, `hallucination trap`) map cleanly onto Scout/Advocate/Editor/Researcher (6 of 8) plus voice/hallucination checks that can be satisfied via a `bonus_*` agentKey (which DOES use the same flat-substitution model as `test-run`) instead of the section-guidance keys — sidestepping the gap for the v1 starter set.

**Primary recommendation:** Extend `promptVersions.ts::activate` in place for the D-06 gate (Convex-native, TOCTOU-safe, matches existing pattern); write `eval_scores` rows via a new direct dashboard→Convex mutation (mirrors `prompt_versions`/`audit_log`, no new pipeline endpoint needed); extract a pure `discover_candidates()` helper from `scout.py` for the shadow endpoint; store scenario fixtures as JSON files under `packages/pipeline/.../evals/scenarios/` with a new pipeline `GET /eval/scenarios` read endpoint so the Next.js Eval Center can read the repo-sourced fixtures without duplicating them into Convex or into a hand-maintained TS mirror.

## Standard Stack

No new external dependencies. This phase is pure composition of existing infrastructure:

| Component | Already exists at | Reused as |
|---|---|---|
| Single-agent evaluation | `packages/pipeline/src/eisenbalm_pipeline/api/agents.py` (`POST /{agent_key}/test-run`, `POST /{agent_key}/score`) | The scenario execution primitive (D-02) |
| Voice-rubric scorer | `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py::score_output` | Unchanged — scores ONE output against the global rubric |
| Prompt versioning | `convex/promptVersions.ts` (`saveVersion`, `activate`, `listForAgent`, `getActive`) | `activate` gains the D-06/D-07 gate + override |
| Audit trail | `convex/auditLog.ts` (`write`, `record`, `listForWorkspace`) | D-07 override log target |
| Draft-vs-active UI pattern | `apps/dispatch-control/.../prompt-lab/_components/TestRunPanel.tsx` | The pattern D-05 scales from 1 to N scenarios |
| Convex test harness | `apps/dispatch-control/__tests__/convexAuthLockdown.test.ts` (`convex-test`, edge-runtime vitest) | Testing pattern for the extended `activate` gate logic |
| Pipeline isolation-test pattern | `packages/pipeline/tests/test_test_run.py`, `tests/api/test_score.py` | Testing pattern for the shadow endpoint's D-12 isolation proof |

**Version verification:** N/A — no new packages. `npm view` / `pip` checks are not applicable; every seam this phase touches is first-party code already in the repo.

## Architecture Patterns

### Recommended project structure (additive only)
```
packages/pipeline/src/eisenbalm_pipeline/
├── evals/                          # NEW
│   ├── __init__.py
│   ├── scenarios/                  # D-01 — one JSON file per scenario
│   │   ├── scout_normal_week.json
│   │   ├── scout_dry_well.json
│   │   ├── advocate_famous_bait.json
│   │   ├── researcher_ghost_charity.json
│   │   ├── scout_radioactive_week.json
│   │   ├── scout_repeat_pressure.json
│   │   ├── bonus_spec_ad_voice_gauntlet.json
│   │   └── researcher_hallucination_trap.json
│   └── loader.py                   # list_scenarios() / get_scenario(id) — Pydantic-validated
├── api/
│   └── eval.py                     # NEW — GET /eval/scenarios, POST /agents/scout/shadow-run (or /eval/shadow-run)
└── agents/
    └── scout.py                    # MODIFIED — extract discover_candidates() (pure, no writes)

convex/
├── evalScores.ts                   # NEW — record (dashboard-authenticated) + listForScenario / listForAgent (time-series reads)
└── promptVersions.ts               # MODIFIED — activate() gains eval-gate check + override arg

apps/dispatch-control/
├── lib/
│   └── evalScenarioClient.ts       # NEW — GET /eval/scenarios client (mirrors testRunClient.ts's pipelineBaseUrl() reuse)
├── app/(dashboard)/prompt-lab/_components/
│   └── EvalDrawer.tsx              # NEW — D-04/D-05, reuses runAgentTest/runActiveVersionTest/scoreOutput per scenario
└── app/(dashboard)/eval-center/
    ├── page.tsx                    # REPLACED — scenario cards + drift time-series + shadow-run trigger
    └── _components/
        ├── ScenarioCard.tsx
        ├── DriftScoreboard.tsx
        └── ShadowRunPanel.tsx
```

### Pattern 1 — Extend the existing `{blocked, reason}` gate, don't invent a new endpoint

**What:** `convex/promptVersions.ts::activate` (lines 145-210) already implements a server-enforced, TOCTOU-safe gate: it queries the `runs` table for a `status === 'running'` row INSIDE the same mutation and returns `{ blocked: true, reason }` without touching `isActive` when blocked, or performs the flip + `audit_log` write when clear.

**When to use:** For D-06, add a second guard of the identical shape immediately after (or instead of, depending on precedence you choose) the in-progress-run check: query the new `eval_scores` table for rows matching `{workspace_id, agentKey, promptVersion: version}` and the corresponding rows for the currently-active version; compute "target metric up + no regression beyond tolerance" across all scenarios for that `agentKey`; return `{ blocked: true, reason }` on failure. Add an `override: { reason: string }` optional arg that bypasses the eval-gate check (never the in-progress-run check) and instead writes an `audit_log` row with `action: 'prompt_version.activate_override'` and the reason in `after`.

**Example (existing pattern to extend, verbatim from source):**
```typescript
// Source: convex/promptVersions.ts:159-172 (existing in-progress-run guard —
// D-06 adds a structurally identical eval-gate guard beside this one)
const runningRun = await ctx.db
  .query('runs')
  .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
  .filter(q => q.eq(q.field('status'), 'running'))
  .first()

if (runningRun) {
  return {
    blocked: true,
    reason:
      'A run is in progress — activation will be available when it finishes.',
  }
}
```

**Why this is the right chokepoint (not a new pipeline endpoint):** `prompt_versions` is a Convex-native entity with no Sanity counterpart. The `EDT-05` write-boundary rule ("dashboard → pipeline API → Sanity for every write") governs *content* writes that land in Sanity; it does not apply to Convex-only entities, which is why `prompt_versions`, `audit_log`, `pipeline_config`, and `agents` are ALL already written directly from the dashboard via Convex mutations (see `promptVersions.ts`, no pipeline round-trip). Routing prompt-commit through a new pipeline endpoint would be a net-new asymmetry with no isolation benefit, since the gate only needs to read/write Convex tables the mutation already has direct access to.

### Pattern 2 — `eval_scores` rows are written directly from the dashboard, mirroring `prompt_versions`

**What:** After the eval drawer calls `runAgentTest` + `runActiveVersionTest` + `scoreOutput` (both sides) for a scenario, it calls a new `evalScores.record` Convex mutation directly — the same shape as how `TestRunPanel.tsx` already calls `promptVersions.getActive` via `useQuery` and `promptVersions.activate` via `useMutation`, with no pipeline round-trip.

**When to use:** Every drawer run (`source: 'drawer'`) and every pre-commit run (`source: 'commit'`) writes one `eval_scores` row per scenario per side (draft AND active) that was scored. A `manual` source covers any future ad-hoc "run this scenario" action outside the drawer/commit flows.

**Auth:** Use `requireOperator(ctx)` (the exact same guard `promptVersions.saveVersion`/`activate` already use) — this is a dashboard-authenticated write, not a pipeline-authenticated one, so it does NOT need `requirePipelineSecret` or an entry in `_PIPELINE_SECRET_GUARDED_PATHS`.

**Why not a pipeline endpoint:** The pipeline's `test-run`/`score` endpoints are explicitly documented as writing to NOTHING (`docs/API_CONTRACTS.md` §3A.1/§3A.2: "writes to NO real run / issue table"). Keeping that isolation contract airtight means the persistence step belongs to the CALLER (the dashboard), not the pipeline — exactly how `prompt_versions` already works.

### Pattern 3 — Extract Scout's pure discovery logic; do NOT call `scout()` or `scout.__wrapped__`

**What:** `scout()` (packages/pipeline/.../agents/scout.py:190-367) is decorated with `@agent_node(name="scout", emit_event=None, max_tool_calls=8)`. Its write surface is NOT limited to the decorator:
- Step 1 (line ~199-208): reads `charities:listForDedup` via Convex query — READ, safe.
- Steps 2-4 (lines 210-301): Tavily search (`web_search`, external, safe) → LLM parse via `acomplete` (transient, no Convex write inside `acomplete` itself — confirmed in `lib/openrouter_client.py`; cost is recorded only in-memory via `lib.cost.CostRecorder`, never auto-flushed to Convex) → Python dedup filter. **These four steps are pure — no writes.**
- Steps 5-6 (lines 303-357): for each surviving candidate, `write_charity(sanity_http, candidate)` — a REAL Sanity document write — then `convex_mutation_safe("pitchLog:insert", ...)` and `convex_mutation_safe("charities:upsertCandidate", ...)` — REAL Convex writes.

Because `functools.wraps` (used by `@agent_node`) sets `__wrapped__` on the returned function, `scout.__wrapped__(state)` IS reachable and WOULD skip the decorator's own bookkeeping (deliberationEvents — moot here since `emit_event=None` — and `record_cost`) — but it still executes steps 5-6 verbatim, because those live inside the function body the decorator wraps, not in the decorator itself. **This is the exact mistake D-12's isolation test must catch.**

**Recommended refactor (minimal diff):**
```python
# packages/pipeline/src/eisenbalm_pipeline/agents/scout.py — proposed split

async def discover_candidates(
    *, run_id: str, config: RunConfig | None = None,
) -> tuple[list[dict], list[str], dict]:
    """Pure discovery: registry read -> Tavily search -> LLM parse -> dedup.
    NO Sanity write. NO Convex mutation (charities:listForDedup is a READ).
    Returns (surviving_candidates, featured_keys, usage)."""
    # === steps 1-4 from the current scout() body, verbatim ===
    ...
    return surviving, featured_keys, usage


@agent_node(name="scout", emit_event=None, max_tool_calls=8)
async def scout(state: DispatchState) -> DispatchState:
    surviving, featured_keys, usage = await discover_candidates(
        run_id=state["run_id"], config=state.get("config"),
    )
    # === steps 5-6 (write_charity + pitchLog + registry writes) unchanged ===
    ...
```
The shadow endpoint calls `discover_candidates(run_id=f"shadow-{uuid4()}")` directly and returns `surviving` as the preview payload. It writes nothing. Note: `_build_messages` currently takes the full `state: DispatchState` only to read `state.get("config")` — the extracted function should accept `config` directly (not a full `DispatchState`) so the shadow endpoint doesn't need to fabricate pipeline state.

**Isolation test pattern to mirror (already established, D-12 should copy it exactly):**
```python
# Source: packages/pipeline/tests/test_test_run.py:37-44, tests/api/test_score.py:29-35
FORBIDDEN_MUTATION_PREFIXES = (
    "agentRuns", "agent_runs", "agent_run_payloads",
    "deliberationEvents", "pipelineRuns",
)
# D-12 must ALSO add: "pitchLog", "charities" (the two mutations scout() calls
# that test-run/score never needed to guard against) AND assert
# write_charity/sanity_client are never invoked — Sanity writes are a gap the
# existing test-run/score isolation tests don't need to cover but the shadow
# endpoint absolutely does.
```

### Anti-Patterns to Avoid
- **Calling `scout(state)` or `scout.__wrapped__(state)` from the shadow endpoint** — both execute the real Sanity `write_charity` + Convex `pitchLog`/`charities` writes. Only the extracted pure function is safe.
- **Routing prompt-commit through a new pipeline HTTP endpoint** — `prompt_versions` has no Sanity counterpart; the existing dashboard→Convex mutation pattern (with its already-proven `{blocked, reason}` TOCTOU-safe shape) is the correct and simpler chokepoint.
- **Treating `test-run`'s `variables` field as a full simulation of every agent's real prompt** — for `origin_story`/`problem`/`founder_bio_*`/`case_study_*`, the real prompt is assembled by `build_section_writer_prompt(charity=..., research=..., style_brief=..., ...)`, which `test-run` never calls. A scenario fixture for these agentKeys tests the bare guidance prose only, not a realistic in-context render.
- **Using `overall` alone as a cross-agent uniform target** without accounting for the fact that `score_output`'s `axes` are dynamic per the active rubric (gravity/sentiment/irony-signaling/precision) — an aggregate that averages `overall` across scenarios is fine as a headline, but a regression on a single scenario's `overall` should still be surfaced per-scenario (D-05 already requires this — do not collapse it into only the aggregate).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Scoring an agent output against voice rubric | A new scoring mechanism/rubric | `POST /agents/{agent_key}/score` → `judge.score_output` (packages/pipeline/.../agents/qa/judge.py:235-309) | D-02 explicitly forbids a new scoring mechanism; the existing endpoint is agent-agnostic (scores ANY output against the global rubric) and already returns `{overall, axes, rationale}` |
| Running a prompt draft against sample input | A new "run agent" endpoint | `POST /agents/{agent_key}/test-run` (agents.py:225-290) | Already isolation-proven (no writes), already the exact primitive D-02 mandates |
| TOCTOU-safe activation gating | A new locking/mutex mechanism | The existing `{blocked, reason}` return contract in `promptVersions.ts::activate` (lines 145-210) | Convex mutations are transactionally serialized per document — the existing in-progress-run check already demonstrates the safe pattern to extend |
| Audit trail for the override | A new logging table/mechanism | `audit_log` via `internal.auditLog.write` (auditLog.ts:37-50) | Every other v3.0 gate override (§34.6b bypass alert, §37.3 adjudication) uses this exact same table + pattern — "nothing silent" is already infrastructure, not a new feature |
| Reading which run is currently in-progress | A new run-status poll | `ctx.db.query('runs').filter(status === 'running')` — already inside `activate` | Reuse the same query the D-02 in-progress guard already performs in the same mutation |

**Key insight:** Every primitive this phase needs already exists somewhere in Phase 21-37's infrastructure. The actual work is (1) a scenario-fixture reader, (2) extending one Convex mutation with one more guard clause, (3) one new Convex table + mutation for time-series persistence, and (4) one pure-function extraction in `scout.py`. Resist the temptation to build a "scenario runner service" — it's a client-side loop over two endpoints that already exist.

## Runtime State Inventory

Not applicable — this is a greenfield feature phase (new tables, new endpoints, new UI), not a rename/refactor/migration phase.

## Common Pitfalls

### Pitfall 1: The commit-gate chokepoint is Convex, not pipeline — don't build the gate in the wrong place
**What goes wrong:** A plan that assumes "gate the prompt activate/commit endpoint" means a FastAPI endpoint will build a server-side check that the dashboard can trivially bypass by continuing to call `promptVersions.activate` directly (which is what `VersionHistoryPanel.tsx` does today, line 49).
**Why it happens:** The CONTEXT doc's phrasing ("gated at the prompt activate/commit endpoint") reads as if there's a single pipeline endpoint for this, mirroring the publish-gate pattern (`review.py`, §34.4) — but prompt versioning was never routed through the pipeline; it's Convex-native since Phase 24.
**How to avoid:** Confirm the gate lives inside `convex/promptVersions.ts::activate` itself (verified above). Any pipeline-side implementation would be dead code the client never calls.
**Warning signs:** A plan task that says "add gate logic to `api/control.py` or a new pipeline route" for prompt commit, with no corresponding change to `VersionHistoryPanel.tsx`'s `useMutation(api.promptVersions.activate)` call site.

### Pitfall 2: Shadow-run isolation must cover Sanity, not just Convex
**What goes wrong:** A D-12 isolation test that only monkeypatches `convex_mutation`/`convex_mutation_safe` and asserts no forbidden Convex paths were called will PASS even if the shadow endpoint accidentally calls `write_charity` — because that's a Sanity write via `sanity_client`, not a Convex mutation.
**Why it happens:** D-11/D-12's wording ("no pipelineRuns, no pitchLog, no agent_runs, no publish, no pipeline mutation") enumerates Convex tables; it doesn't explicitly say "no Sanity write," but a shadow "preview" that silently creates real charity draft documents in Sanity would violate the spirit of "without publishing or affecting run state" just as badly.
**How to avoid:** The isolation test must ALSO monkeypatch/assert against `eisenbalm_pipeline.lib.sanity_client.write_charity` (or the whole `sanity_client` module) never being called. Confirmed by reading `scout.py:303-318`: `write_charity` is called BEFORE the Convex writes in the per-candidate loop.
**Warning signs:** A test file that copies `FORBIDDEN_MUTATION_PREFIXES` from `test_test_run.py`/`test_score.py` verbatim without adding Sanity coverage.

### Pitfall 3: Commit-gate cost — 4 model calls per scenario, one pair of which is Opus-tier
**What goes wrong:** Running the eval gate check silently becomes expensive: for N selected scenarios, computing "draft vs active" requires, per scenario: `test-run` (draft) + `score` (draft) + `test-run` (active) + `score` (active) = 4 model calls. Both `score` calls always invoke `agent_id="qa"` (confirmed in `judge.score_output`, line ~168 equivalent call inside `score_output`), which resolves to `anthropic/claude-opus-4-7` (`lib/llm_config.py:17,28` — `MODEL_PIN_VOICE_CRITICAL`). For 3 scenarios that's 12 model calls including 6 Opus calls, every time the drawer runs or a commit is attempted.
**Why it happens:** Reusing `test-run`+`score` (D-02, correctly) means reusing their cost profile too — there's no cheaper batch path.
**How to avoid:** Do not auto-run the eval drawer on every keystroke (matches the existing `TestRunPanel` convention — `handleRun`/`handleCompare` are both explicit button clicks, never `onChange`-triggered). Consider showing an estimated cost/call-count before the operator triggers a scenario batch. Do NOT re-run scores that haven't changed (if `eval_scores` already has a fresh row for this exact prompt version + scenario, the gate can reuse it rather than forcing a re-run — see Pitfall 4 for what "fresh" should mean).
**Warning signs:** A plan that wires the drawer to fire on prompt-text change events, or a commit-gate check that re-runs all scenarios synchronously inside the `activate` mutation itself (Convex mutations cannot make outbound HTTP calls to the pipeline anyway — this would be a hard architectural error, not just a cost one).

### Pitfall 4: "Freshness" needs a precise definition, or the gate is unfalsifiable
**What goes wrong:** D-06 says "the eval results the gate reads must be fresh for the version being committed" — but the eval drawer naturally runs against the operator's UNSAVED draft text (D-04/D-05, before a version number exists via `saveVersion`). By the time `activate(version)` is called, the content is now "version N," but the `eval_scores` rows written during drafting were tagged against... what, exactly? There is no version number until `saveVersion` creates one.
**Why it happens:** The natural editing flow (edit → eval drawer → save version → activate) has an identity gap: the drawer's scores are computed on draft text that only RETROACTIVELY becomes "version N" once saved, and nothing currently re-associates them.
**How to avoid:** Recommend requiring a scenario run tagged to the SAVED version's exact content before `activate` will pass the gate — e.g., after `saveVersion` returns the new version row, the UI re-opens the eval drawer (or requires one) against that saved (but not yet active) version's `content` as `draft_prompt` (exactly how `runActiveVersionTest` already feeds the ACTIVE version's content into the same `runAgentTest` call — the same technique works for any saved-but-inactive version). Write `eval_scores` rows tagged `promptVersion: String(N)` at that point. The `activate` gate then requires, per selected scenario, an `eval_scores` row with `promptVersion === String(version)` and `ranAt >= ` the `prompt_versions` row's `createdAt` for that version. This is Claude's Discretion territory (flagged as such in CONTEXT) — surfaced here as an Open Question with a concrete recommended resolution, not a mandate.
**Warning signs:** A gate implementation that matches on wall-clock recency alone (e.g., "ran within the last hour") rather than tying to the specific version's content — that would let a stale score for DIFFERENT prompt text pass the gate for version N just because it ran recently.

### Pitfall 5: Section-writer scenario gap — `test-run` doesn't replicate `build_section_writer_prompt`
**What goes wrong:** D-03 calls for scenarios covering "the voice-critical writers" — but `origin_story`, `problem`, `founder_bio_verified/anonymous`, `case_study_verified/anonymous` are NOT tested faithfully by `test-run`: their real prompts are assembled by `build_section_writer_prompt(section_id=..., section_guidance=..., charity=..., research=..., style_brief=..., voice_constraints=..., claims=...)` (`lib/voice.py:250+`), which `test-run` never calls. `test-run` just sends the raw guidance text as the system message with a generic default user message (`"Run this agent against the supplied input and return your output."`) and empty `variables` (VARIABLE_REGISTRY confirms these six keys have `[]` — no tokens). A scenario built against one of these agentKeys tests "does this guidance prose alone sound like Jesse," not "does this guidance prose produce a good origin story for a specific charity."
**Why it happens:** `test-run`'s `{token}`-substitution model (`_substitute`, agents.py:181-190) was built for agents that use flat `.replace("{token}", value)` prompts (scout, advocate, calibrator, editor_gate1, editor_final, researcher, game, design, bonus_*) — confirmed these ALL use the identical `.replace("{...}", ...)` pattern in their own source (e.g. `bonus.py:139-150`). The four narrative section writers are architecturally different (structured-arg helper, not string substitution) by explicit design (AGT-09 voice isolation).
**How to avoid:** For the v1 starter set, satisfy the "voice-critical writer" scenario need via a `bonus_*` agentKey (which DOES use the flat-substitution model faithfully) rather than the section-guidance keys. The design brief's 8 named scenarios (`normal week`, `dry well`, `famous bait`, `ghost charity`, `radioactive week`, `repeat pressure`, `voice gauntlet`, `hallucination trap`) map cleanly: 6 are Scout/Advocate/Researcher-shaped (discovery/verification), leaving only `voice gauntlet` (and arguably `hallucination trap`) as writer-adjacent — both can be satisfied by `bonus_spec_ad`/`researcher` respectively without hitting this gap. Extending true section-writer coverage (origin_story etc.) would require either a `test-run` mode-5 that calls `build_section_writer_prompt` with fixture charity/research/style_brief dicts, or accepting the guidance-only limitation — flag this as an Open Question for the planner rather than silently scoping it in.
**Warning signs:** A scenario fixture for `origin_story` whose `input` dict is empty (`{}`) because VARIABLE_REGISTRY says it has no tokens — if the planner notices this and tries to "fix" it by inventing new `{charity_name}`-style tokens for these keys, that will trip PRM-02's unknown-variable warning gate (`findUnknownVariables`, VariableRegistry.ts:81-95) since the real pipeline code never substitutes such tokens for these keys.

### Pitfall 6: Eval Center needs a way to READ repo-fixture scenarios from a Next.js app
**What goes wrong:** D-01 locks scenarios as repo fixtures (Python-adjacent, pipeline-side), explicitly NOT duplicated into Convex. But the Eval Center (Next.js/dispatch-control) needs to render scenario cards (description, whatItCatches, last result) and the eval drawer needs each scenario's `input` variables to actually call `test-run`. Without an HTTP read path, the dashboard has no way to see the fixtures at all.
**Why it happens:** CONTEXT's discretion list covers "scenario fixture directory + file format" but doesn't explicitly call out that a NEW read endpoint is structurally required for a cross-process (Python fixtures, TypeScript UI) design to work without duplication.
**How to avoid:** Add a `GET /eval/scenarios` (optionally `?agentKey=`) read endpoint to the pipeline that parses and returns the fixture list as JSON (id, agentKey, description, whatItCatches, input, scoringTarget). This is the only way to honor D-01's "no scenario data duplicated" while still letting the dashboard drive `test-run` calls with the scenario's `input`.
**Warning signs:** A plan that hand-maintains a parallel TypeScript constant mirroring the Python fixtures (drifts immediately, silently, the first time someone edits one side).

### Pitfall 7: Score non-determinism vs. a hard regression gate
**What goes wrong:** `judge.score_output` is an LLM call — running the exact same output through `score` twice can return slightly different `overall`/`axes` values. A gate with zero tolerance ("must not go down AT ALL") will flap between pass/fail on identical content.
**Why it happens:** LLM-as-judge scoring is inherently non-deterministic (temperature, sampling), and this codebase does not pin a temperature=0 for the "qa" agent specifically (confirmed only that it's pinned to `claude-opus-4-7`, not that sampling is deterministic).
**How to avoid:** D-06 already anticipates this with "regression (score down beyond a tolerance)" — implement an explicit numeric tolerance (e.g. -0.5 on a 0-10 scale) rather than a strict `< active` comparison. Treat this tolerance as a single global constant for v1 (simpler, and Claude's Discretion per CONTEXT) rather than a per-scenario configurable value, unless a specific scenario clearly needs a tighter/looser bound.
**Warning signs:** A gate implementation using `draftScore.overall < activeScore.overall` (strict less-than, zero tolerance) instead of `draftScore.overall < activeScore.overall - TOLERANCE`.

### Pitfall 8: Parallel-worktree caution carries forward
**What goes wrong:** Phase 35 hit a worktree-strand problem from parallel execution; Phases 36-37 moved to sequential-in-main-checkout execution as a result (per STATE.md / phase history).
**Why it happens:** This phase touches `convex/schema.ts`, `convex/promptVersions.ts`, `apps/dispatch-control/`, and `packages/pipeline/.../scout.py` — a wide surface that's easy to fragment across worktrees.
**How to avoid:** Continue the Phase 36-37 convention: execute this phase's waves sequentially in the main checkout, not parallel worktrees, unless the plan explicitly reconciles branches before merging.

## Code Examples

### Existing test-run + score request/response shapes (verified from source, not docs)
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/api/agents.py:149-179
class TestRunRequest(BaseModel):
    workspace_id: str
    draft_prompt: str
    draft_user_template: Optional[str] = None
    variables: dict[str, str] = Field(default_factory=dict)
    prior_run_id: Optional[str] = None

class TestRunResponse(BaseModel):
    output: str
    cost_usd: float
    tokens_in: int
    tokens_out: int
    model: str
    duration_ms: int

# Source: packages/pipeline/src/eisenbalm_pipeline/api/agents.py:296-332
class ScoreRequest(BaseModel):
    workspace_id: str
    agent_key: str = ""       # advisory/labeling only — rubric is global
    output: str                # the SINGLE output to score (from a test-run's TestRunResponse.output)

class ScoreResponse(BaseModel):
    overall: float              # 0-10 headline
    axes: list[AxisOut]         # dynamic per active rubric
    rationale: str
    rubric_source: str          # "convex" | "disk"
    cost_usd: float
    tokens_in: int
    tokens_out: int
    model: str
    duration_ms: int
```
**Implication for scenario shape (D-01):** `scenario.input` should be exactly a `dict[str,str]` matching `TestRunRequest.variables` — NOT the full request body (the `draft_prompt` varies per run: draft vs active). `ScoreRequest.output` is always the PRIOR `TestRunResponse.output`, chained client-side (exactly as `TestRunPanel.tsx` already does at lines 120-128).

### Existing draft-vs-active + score-delta client pattern (the exact thing D-05 scales to N)
```typescript
// Source: apps/dispatch-control/.../prompt-lab/_components/TestRunPanel.tsx:105-134,138-164,172-176
async function handleRun() {
  const res = await runAgentTest(agentKey, { draft_prompt: draftPrompt, ...buildInputBody() }, token)
  setResult(res)
  const score = await scoreOutput(agentKey, res.output, token)
  setDraftScore(score)
}
async function handleCompare() {
  const res = await runActiveVersionTest(agentKey, active.content, buildInputBody(), token)
  setActiveResult(res)
  const score = await scoreOutput(agentKey, res.output, token)
  setActiveScore(score)
}
const scoreDelta = draftScore != null && activeScore != null
  ? draftScore.overall - activeScore.overall
  : null
```
For N scenarios, the eval drawer runs this exact 4-call sequence (test-run draft, score draft, test-run active, score active) once per scenario, using `scenario.input` as `variables` instead of the operator's manual/prior-run/fixture input modes.

### Existing TOCTOU-safe gate pattern to extend (the D-06 template)
```typescript
// Source: convex/promptVersions.ts:145-210 (activate mutation, abbreviated)
export const activate = mutation({
  args: { workspace_id: v.string(), agentKey: v.string(), version: v.number(), actorId: v.string() },
  handler: async (ctx, { workspace_id, agentKey, version }) => {
    const actor = await requireOperator(ctx)
    const runningRun = await ctx.db.query('runs')
      .withIndex('by_workspace', q => q.eq('workspace_id', workspace_id))
      .filter(q => q.eq(q.field('status'), 'running')).first()
    if (runningRun) return { blocked: true, reason: '...' }
    // D-06 ADDS HERE: query eval_scores for this agentKey/version vs active version,
    // compute target-up + no-regression, return { blocked: true, reason } on failure,
    // OR proceed if an `override` arg with a reason is supplied (write audit_log
    // action: 'prompt_version.activate_override' instead of blocking).
    // ...existing activate + audit_log write...
  },
})
```

### Existing Convex isolation-test harness (the pattern to reuse for the D-06 gate's tests)
```typescript
// Source: apps/dispatch-control/__tests__/convexAuthLockdown.test.ts:1-80 (pattern)
import { convexTest, schema } from './setup'
const modules = import.meta.glob('../../../convex/**/*.*s')
const t = convexTest({ schema, modules })
await t.run(async (ctx) => { await ctx.db.insert('eval_scores', { ... }) })  // seed fixture rows
const result = await t.withIdentity({ subject: 'user_operator' }).mutation(
  api.promptVersions.activate, { workspace_id, agentKey, version, actorId: 'user_operator' },
)
expect(result.blocked).toBe(true)   // or false, depending on seeded eval_scores
```

### Scout's real write surface (the exact lines D-12's isolation test must guard against)
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/agents/scout.py:303-353 (abbreviated)
for candidate in surviving:
    charity_id = await write_charity(sanity_http, candidate)        # SANITY WRITE
    await convex_mutation_safe("pitchLog:insert", {...})             # CONVEX WRITE
    await convex_mutation_safe("charities:upsertCandidate", {...})   # CONVEX WRITE
```

## State of the Art

| Old Approach (Phase 28) | Current Approach (Phase 38) | When Changed | Impact |
|--------------------------|------------------------------|---------------|--------|
| Voice score is advisory only — "never gates any action" (Phase 28 D-05/D-06, `TestRunPanel.tsx` comments at lines 17-20) | Voice score (via scenario scoreboards) becomes a hard server-enforced gate on commit, with a logged override escape hatch | This phase (EVL-03) | Every UI string in `TestRunPanel.tsx` that currently says "advisory — does not gate" (line 470: `rubric: {score.rubric_source} · advisory — does not gate`) describes the STANDALONE test-run score, which remains advisory. The NEW eval-drawer/commit-gate score is a DIFFERENT, additional surface — do not conflate the two or edit that advisory copy, since single-run test-run scoring is explicitly still non-gating per D-02/D-05's scope (only the scenario-batch commit gate is new). |
| No time-series of editorial quality — only a live single-run score | Append-only `eval_scores` time-series, drift visible per scenario/agent over prompt-version history | This phase (EVL-04, D-09/D-10) | First durable quality-over-time record in the codebase; distinct from `agent_runs`/`deliberationEvents` (per-pipeline-run observability) — this is per-agent-prompt-version observability |

**Deprecated/outdated:** Nothing is removed. Phase 28's `TestRunPanel` advisory scoring stays exactly as-is for the single ad-hoc test-run flow; this phase is additive.

## Open Questions

1. **Eval-score "freshness" identity: version number vs. content hash vs. wall-clock recency**
   - What we know: `eval_scores.promptVersion` (per D-09's locked shape) implies matching against `prompt_versions.version`, which only exists after `saveVersion`. The eval drawer naturally runs on unsaved draft text, before a version number exists.
   - What's unclear: whether the plan should require a SECOND scenario run against the saved-but-inactive version's content before `activate` unblocks (recommended, see Pitfall 4), or use a content-hash match instead so a draft-time run can satisfy the gate for the version later saved with identical content.
   - Recommendation: require a post-save run (simpler to reason about, avoids a content-hash column not in the locked D-09 shape); surface this explicitly in the plan so the two-step "save version → run evals against the saved version → activate" flow is a deliberate UX decision, not an accident.

2. **Batch orchestration endpoint vs. client-side loop for N scenarios**
   - What we know: `TestRunPanel.tsx` already loops sequentially for the single draft-vs-active case; extending this to N scenarios via `Promise.all`/sequential fetches is a direct extension with no new backend surface.
   - What's unclear: whether N scenarios × 4 calls each (test-run×2 + score×2, see Pitfall 3) run acceptably from a browser tab (timeouts, error-partial-completion UX) once N grows past the starter set (~8).
   - Recommendation: client-side loop for v1 (matches every existing pattern in this codebase); flag a batch endpoint as a fast-follow only if the starter set's actual N (after D-03 scoping, likely 6-8 scenarios total, fewer per agentKey) proves too slow in practice.

3. **`scoringTarget` numeric semantics**
   - What we know: D-09's `eval_scores` row shape has no `scoringTarget` field (it lives in the scenario fixture, D-01, not the result row). The `score` endpoint returns `overall` (0-10) uniformly across all agentKeys.
   - What's unclear: whether `scoringTarget` should be an absolute floor (e.g. `{min_overall: 7.0}`), a purely relative "must be >= active" flag, or per-axis targets.
   - Recommendation: an absolute floor per scenario (simple, meaningful even for the FIRST version of an agent with no active baseline yet) PLUS a single global relative regression tolerance applied uniformly across all scenarios at commit time (Pitfall 7) — avoids over-engineering per-scenario tolerance configuration for a v1 starter set.

## Environment Availability

Not applicable — this phase adds no new external tool/service dependencies. Everything used (OpenRouter via `acomplete`, Tavily via `web_search`, Convex, Sanity) is already configured and exercised by earlier phases (24, 28, 5).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Pipeline framework | pytest 8.3+ with `pytest-asyncio` (auto mode) — `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` |
| Pipeline config file | `packages/pipeline/pyproject.toml` (`testpaths = ["tests"]`) |
| Dashboard framework | vitest — `apps/dispatch-control/vitest.config.ts`; Convex-function tests run in the `edge-runtime` environment via `convex-test` |
| Quick run (pipeline) | `cd packages/pipeline && uv run pytest tests/test_scout_registry.py tests/test_test_run.py tests/api/test_score.py -x -q` |
| Quick run (dashboard) | `pnpm --filter dispatch-control test -- __tests__/convexAuthLockdown.test.ts` |
| Full suite (pipeline) | `cd packages/pipeline && uv run pytest -x -q` |
| Full suite (dashboard) | `pnpm --filter dispatch-control test` then `pnpm --filter dispatch-control build` (vitest doesn't type-check — confirmed project convention, MEMORY note "run-strict-build-before-frontend-phase-done") |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVL-01 | Scenario loader parses fixtures, validates shape (Pydantic), lists by agentKey | unit | `uv run pytest tests/evals/test_scenario_loader.py -x -q` | ❌ Wave 0 |
| EVL-01 | `GET /eval/scenarios` returns parsed fixtures as JSON | integration | `uv run pytest tests/api/test_eval_scenarios.py -x -q` | ❌ Wave 0 |
| EVL-02 | Eval drawer auto-selects scenarios matching `agentKey`, runs draft+active, shows deltas | component (vitest) | `pnpm --filter dispatch-control test -- __tests__/EvalDrawer.test.tsx` | ❌ Wave 0 |
| EVL-03 | `activate` blocks when target metric down / regression beyond tolerance | unit (convex-test) | `pnpm --filter dispatch-control test -- __tests__/promptVersionsEvalGate.test.ts` | ❌ Wave 0 |
| EVL-03 | `activate` with `override.reason` bypasses the eval gate and writes `audit_log` | unit (convex-test) | same file as above | ❌ Wave 0 |
| EVL-04 | `evalScores.record` inserts append-only; never patches/deletes existing rows | unit (convex-test) | `pnpm --filter dispatch-control test -- __tests__/evalScores.test.ts` | ❌ Wave 0 |
| EVL-04 | Eval Center renders scenario cards + last result from `eval_scores` | component (vitest) | `pnpm --filter dispatch-control test -- __tests__/EvalCenter.test.tsx` | ❌ Wave 0 |
| EVL-05 | Shadow endpoint returns discovery preview using live search | integration (respx-mocked Tavily, stub-mode LLM) | `uv run pytest tests/api/test_shadow_run.py -x -q` | ❌ Wave 0 |
| EVL-05 | Shadow endpoint writes NOTHING to Convex (`pitchLog`, `charities`, `agent_runs`, `deliberationEvents`, `pipelineRuns`) or Sanity (`write_charity`) — D-12 isolation proof | integration | same file, mirrors `tests/test_test_run.py:37-44` `FORBIDDEN_MUTATION_PREFIXES` pattern + Sanity assertion | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the quick-run commands above (scoped to the file(s) touched)
- **Per wave merge:** full pipeline suite (`uv run pytest -x -q`, baseline ≥ current passing count — check `.planning/STATE.md` velocity log or run once pre-phase to capture the baseline) + full dashboard suite + `pnpm --filter dispatch-control build`
- **Phase gate:** both full suites green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/pipeline/tests/evals/test_scenario_loader.py` — covers EVL-01 (fixture parsing/validation)
- [ ] `packages/pipeline/tests/api/test_eval_scenarios.py` — covers EVL-01 (`GET /eval/scenarios`)
- [ ] `packages/pipeline/tests/api/test_shadow_run.py` — covers EVL-05 (mirrors `test_test_run.py`/`test_score.py` harness: bare FastAPI app, `EISENBALM_STUB_MODE=true`, `_AGENTS_ROUTER_AVAILABLE`-style RED-state guard if built incrementally)
- [ ] `apps/dispatch-control/__tests__/promptVersionsEvalGate.test.ts` — covers EVL-03 (extends the existing `convexAuthLockdown.test.ts` harness/pattern — same `convexTest`/`modules` glob setup)
- [ ] `apps/dispatch-control/__tests__/evalScores.test.ts` — covers EVL-04 (append-only invariant)
- [ ] `apps/dispatch-control/__tests__/EvalDrawer.test.tsx` + `EvalCenter.test.tsx` — covers EVL-02/EVL-04 UI
- [ ] No new framework install needed — `pytest-asyncio`, `respx`, `vitest`, `convex-test` are all already dev dependencies.

## Sources

### Primary (HIGH confidence — read directly from source in this repo)
- `packages/pipeline/src/eisenbalm_pipeline/api/agents.py` (404 lines, read in full) — `TestRunRequest`/`TestRunResponse`/`ScoreRequest`/`ScoreResponse`, `SAMPLE_FIXTURES`, `_require_operator`, `_substitute`
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` (310 lines, read in full) — `score_output`, `VoiceScore`, `run_llm_judge`
- `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` (367 lines, read in full) — full write surface, `@agent_node` usage, `SCOUT_QUERIES`
- `packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py` (205 lines, read in full) — `agent_node` decorator's exact Convex writes
- `packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py` (partial — `acomplete` signature + docstring) — confirms no Convex write inside `acomplete`
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` (partial — `convex_mutation`/`convex_mutation_safe`/`convex_query`, `_PIPELINE_SECRET_GUARDED_PATHS`)
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` (partial — confirms in-memory `CostRecorder`, not auto-flushed to Convex)
- `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` (partial — confirms `qa` → `MODEL_PIN_VOICE_CRITICAL` = `anthropic/claude-opus-4-7`)
- `packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py` (175 lines, read in full) — confirms `build_section_writer_prompt` usage, NOT flat substitution
- `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` (partial — confirms flat `.replace("{token}", ...)` usage matching test-run's model)
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` (partial — `build_section_writer_prompt` signature)
- `packages/pipeline/tests/test_test_run.py`, `packages/pipeline/tests/api/test_score.py` (isolation-test patterns, read in full)
- `packages/pipeline/tests/agents/test_scout.py` (partial — confirms module-level exported helpers pattern)
- `convex/schema.ts` (lines 240-338 read) — `prompt_versions`, `audit_log`, `runs`, `agents`, `pipeline_config`, `agent_runs` table shapes
- `convex/promptVersions.ts` (322 lines, read in full) — `upsertActive`, `saveVersion`, `activate`, `listForAgent`, `listActiveForWorkspace`, `listSeedV1ForWorkspace`, `getByVersion`
- `convex/auditLog.ts` (99 lines, read in full) — `write`, `record`, `listForWorkspace`
- `convex/lib/auth.ts` (partial) — `requireOperator`, `requirePipelineSecret`, `requireOperatorOrPipeline`, `requireWebhookSecret`
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/TestRunPanel.tsx` (484 lines, read in full)
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx` (268 lines, read in full)
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts` (199 lines, read in full)
- `apps/dispatch-control/app/(dashboard)/prompt-lab/_components/agentList.ts` (79 lines, read in full)
- `apps/dispatch-control/app/(dashboard)/prompt-lab/[agentKey]/page.tsx` (partial)
- `apps/dispatch-control/app/(dashboard)/eval-center/page.tsx` (15 lines, read in full — confirms placeholder-only stub)
- `apps/dispatch-control/lib/testRunClient.ts` (109 lines, read in full)
- `apps/dispatch-control/lib/scoreClient.ts` (76 lines, read in full)
- `apps/dispatch-control/__tests__/convexAuthLockdown.test.ts` (200 lines, read in full) — `convex-test` harness pattern
- `docs/API_CONTRACTS.md` §3A.1/§3A.2 (lines 782-896, read in full), §34.4/§34.5/§34.6b (lines 3005-3086, read in full — gate/override/bypass-alert precedent), §37.3/§37.4 (lines 3596-3650, read in full — Clerk-guarded bridge endpoint pattern), full section index (grep of all `##`/`###` headers)
- `docs/design/dispatch-control-v2/README.md` (lines 1-60, read) — Prompt Lab / Eval Center screen descriptions, the 8 named golden scenarios, "Override + reason per audit R5"
- `docs/design/dispatch-control-v2/DECISIONS.md` (grepped for gate/override/"nothing silent" — lines 52-55, 11, 24, 69)
- `.planning/phases/38-prompt-lab-evals-eval-center/38-CONTEXT.md` (full file, 138 lines)
- `.planning/REQUIREMENTS.md` (EVL-01..05, lines 326-331; full v3.0 section for cross-reference)
- `.planning/STATE.md` (partial — confirms Phase 37 is the last completed phase, Phase 38 not started)
- `/Users/user/Desktop/Eisenbalm/CLAUDE.md` (contract-first hard rule, GSD workflow enforcement)

### Secondary (MEDIUM confidence)
- None — every claim above was verified directly against source in this repository; no WebSearch/Context7 lookups were needed since this phase has zero external-library surface.

### Tertiary (LOW confidence — flagged explicitly, needs validation during planning)
- The exact mapping of the 8 design-brief golden scenario names to specific agentKeys (Summary + Pitfall 5) is a RECOMMENDATION derived from the scenario names' apparent intent, not a locked decision — the planner should confirm/adjust this mapping, since CONTEXT leaves "starter scenario contents" to Claude's discretion.
- Whether `judge`'s "qa" model pin uses temperature=0 (relevant to Pitfall 7's non-determinism severity) was not directly confirmed — `llm_config.py` was only grepped for the model-pin mapping, not read in full for sampling parameters. Worth a quick check during planning if the regression-tolerance value needs precise calibration.

## Metadata

**Confidence breakdown:**
- Standard stack / composition: HIGH — no new dependencies, every primitive read directly from source
- Architecture (gate chokepoint, write-path recommendations, pure-function extraction): HIGH — verified against exact current call sites (`VersionHistoryPanel.tsx:49`, `scout.py:190-367`)
- Pitfalls: HIGH for isolation/cost/write-boundary findings (directly read); MEDIUM for the "freshness" and "scoringTarget" semantics (these are genuinely open design choices flagged as such, not verified facts)

**Research date:** 2026-07-09
**Valid until:** No external dependency, so effectively stable until the underlying `test-run`/`score`/`promptVersions`/`scout.py` seams themselves change (i.e., valid through this phase's execution; re-verify only if a prior phase's code is touched again before Phase 38 starts).
