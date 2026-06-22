# Phase 22: Config Externalization - Context

**Gathered:** 2026-06-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Make the pipeline read all agent config (system prompts + model/temperature/max-tokens/enabled) from Convex once at run start, snapshot the full resolved config onto the `runs` record BEFORE the LangGraph graph is invoked, migrate the existing prompt `.md` files into Convex `prompt_versions` as version-1 active rows with byte-verification, switch the agent call sites to read from `state["config"]`, and retain the on-disk `.md` files (and in-code defaults) as fallback.

This is the §2 keystone: it makes every run reproducible (the exact prompt/model that produced an issue is recorded) and prevents a mid-run dashboard edit from corrupting an in-flight run.

**Explicitly in scope:**
- `lib/config_loader.py` — `load_run_config()` (single Convex read of active prompts + per-agent settings + pipeline_config at run start) and `snapshot_config()` (writes full resolved config to `runs.configSnapshot`)
- Snapshot is the FIRST awaited op before `graph.ainvoke()`; `runs` row written alongside `pipelineRuns:create` on the same `runId`
- `DispatchState` gains a `config` field; the 11 `load_prompt` call sites read `state["config"]` instead of disk
- Migrate the **11** `.md` system-prompt files into Convex `prompt_versions` as v1 active rows + a byte-comparison verification script (zero diff vs originals)
- Seed `agents` rows (model/temp/tokens/enabled) for ALL pipeline agent keys
- Flesh out the Phase-21 stub tables `agents`, `prompt_versions`, `pipeline_config` as needed for the above
- Disk `.md` + in-code defaults retained as fallback (CFG-03)

**Explicitly NOT in scope (deferred):**
- Section-writer prompt externalization (origin_story/problem/founder_bio/case_study inline `SECTION_GUIDANCE`) → Phase 24
- User-prompt templates, `qa/rubric.md`, `VOICE_CONSTRAINTS` as separately versioned/editable assets → Phase 24
- Prompt-editing UI, diff, rollback, single-agent test-run → Phase 24
- Actual per-agent skip-gating from the `enabled` flag → Phase 23/25
- Node wrappers / live dashboard / read-only views → Phase 23

</domain>

<decisions>
## Implementation Decisions

### Config scope & the "12 files" reconciliation (the area discussed in detail)
- **D-01:** **Migrate exactly the 11 `.md` system-prompt files** into `prompt_versions` as v1 active rows. The set is the `load_prompt` corpus: `scout`, `advocate`, `editor`, `editor-final`, `calibrator`, `researcher`, `design`, `game`, `bonus-big-budget`, `bonus-jingle`, `bonus-spec-ad`. The brief's "12 files" is imprecise (the `prompts/README.md` is editorial, not a prompt). Byte-verification runs against these 11 real files — zero diff required (CFG-02).
- **D-02:** **Section-writer prompts deferred to Phase 24.** `origin_story`, `problem`, `founder_bio`, `case_study` keep reading their inline `SECTION_GUIDANCE` strings this phase — they are NOT migrated to `prompt_versions` yet. Rationale: extracting inline strings to byte-verifiable assets carries the same `_extract()`-correctness risk the research flagged; do it deliberately with the prompt-editing UI in Phase 24. This is a known, documented gap, not an oversight.
- **D-03:** **System prompts only this phase.** `prompt_versions.content` stores the system-prompt text (the `.md` body between `<!-- PROMPT START/END -->`). User-prompt templates stay code-built (the existing `str.replace("{token}", …)` substitution pattern is untouched). Capturing/editing user-templates lands with the editor UI in Phase 24.
- **D-04:** **Seed `agents` rows for ALL pipeline agent keys**, not just the 11 with migrated prompts. Use the full `llm_config.MODEL_BY_AGENT` / `AGENT_GEN_PARAMS` key set (~15: calibrator, chronicler, editor_gate1, editor_final, qa, researcher, scout, advocate, design, origin_story, problem, founder_bio, case_study, bonus, game). This gives Phase 23's dashboard graph a complete agent roster and a home for model/temp/tokens/enabled now; `prompt_versions` simply has no rows yet for the not-yet-migrated agents. Reconcile agent-key naming between `llm_config` keys, `prompt_versions.agentKey`, and `agents.agentKey` so the loader can join them (note: `editor`/`editor-final` .md vs `editor_gate1`/`editor_final` llm_config keys — the planner must define the canonical `agentKey` mapping).

### llm_config.py disposition (Claude's discretion — locked from brief/research)
- **D-05:** **Keep `llm_config.py` as the in-code fallback default set.** Convex `agents` rows override at runtime; `llm_config.py` (`MODEL_BY_AGENT`, `AGENT_GEN_PARAMS`, `MODEL_PIN_VOICE_CRITICAL`) becomes the disk-side default — exactly the role the `.md` files play for prompts. The Phase 22 `agents` seed is generated FROM `llm_config.py` so Convex and disk start byte/semantically identical. Do NOT delete `llm_config.py`.

### Fallback granularity — CFG-03 (Claude's discretion — locked from brief/research)
- **D-06:** **All-or-nothing at the loader on hard failure.** If the single `load_run_config()` Convex query fails (unreachable/timeout/error), the pipeline uses ALL disk/code defaults (`.md` prompts + `llm_config.py` model/temp) for the whole run and logs a single structured **WARNING** (not silent, not crash). The run still snapshots the resolved (fallback) config so the record reflects what actually ran.
- **D-07:** **Per-key fallback on partial gaps.** If Convex is reachable but an individual prompt/agent row is missing or malformed, that single agent falls back to its disk default and logs a per-agent WARNING; the rest use Convex values. Never crash on a single missing row.

### enabled flag behavior (Claude's discretion — locked from brief/research)
- **D-08:** **Store + snapshot only this phase.** The per-agent `enabled` flag is read into `state["config"]` and captured in the snapshot, but Phase 22 does NOT add skip-gating logic. The existing `DESIGNAGENT_SUPPRESSED` env precursor is left untouched. Wiring `enabled=false → agent skipped` is deferred to Phase 23/25.

### Snapshot shape & boundary (Claude's discretion — locked from brief/research)
- **D-09:** `runs.configSnapshot` stores a JSON string of the FULL resolved run config: per-agent `{model, temperature, top_p, max_tokens, enabled, systemPrompt}` for every agent in the run + relevant `pipeline_config` values. It captures the actual resolved values used (post-fallback), so the snapshot is always an accurate record.
- **D-10:** The snapshot write is the FIRST awaited op after `runs`/`pipelineRuns:create` and BEFORE `graph.ainvoke()` — confirmed (awaited, error-checked) so a mid-run edit cannot alter the in-flight run (snapshot-race pitfall). `runs` is created on the same `runId` as `pipelineRuns:create`.

### Claude's Discretion
- Exact `config_loader.py` function signatures, the in-memory `RunConfig`/`config` TypedDict shape on `DispatchState`, and the agentKey canonical-mapping table.
- Whether to add `max_tokens`/`top_p`/`description` columns to the `agents` table now or fold into the JSON — planner to align with brief §3A and the Phase-21 stub (`agents` currently has `agentKey, enabled, model, temperature`).
- The byte-comparison verification script's location/form (standalone script vs pytest), as long as it proves zero diff between seeded `prompt_versions` rows and the 11 `.md` files.
- Migration mechanism (idempotent Convex seed mutation vs one-shot script), consistent with the project's deterministic-upsert convention and the Phase-21 `seedEisenbalm` pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.0 spec & keystone
- `docs/MISSION_CONTROL_BRIEF.md` §2 (the one architectural decision: externalize config + per-run snapshot; "editing never overwrites — new version; activate flips live"), §3A (agent control: system prompt + user template + model/temp/tokens/enabled), §5 (data model: agents · prompt_versions · pipeline_config · runs incl. config_snapshot).
- `docs/CURRENT_STATE.md` — Phase 0: prompts ALREADY file-externalized (loader swap, not string extraction); content lands split (Sanity / Convex / Railway-Postgres checkpointer).

### Research (v2.0 milestone)
- `.planning/research/SUMMARY.md` — config externalization is the keystone; `load_run_config()` + `snapshot_config()` as first awaited op; loader swap with `.md` fallback; 8(≈11)-call-site swap; migration seeds files as v1 active rows; `runs` augments frozen `pipelineRuns`.
- `.planning/research/ARCHITECTURE.md` — config-in-Convex (not Postgres) rationale; `DispatchState.config` field; snapshot-before-invoke design.
- `.planning/research/PITFALLS.md` — **Snapshot race (Phase 22): snapshot must be the FIRST awaited op before LangGraph is invoked.** Prompt DB fallback (keep the .md files; deleting them turns Convex degradation into an outage).

### Existing code (the migration/loader targets)
- `packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py` — `load_prompt()` + `_extract()` (PROMPT START/END markers, byte-exact). The byte-verification baseline.
- `packages/pipeline/src/eisenbalm_pipeline/prompts/*.md` — the 11 prompt files to migrate.
- `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` — `MODEL_BY_AGENT`, `AGENT_GEN_PARAMS`, `MODEL_PIN_VOICE_CRITICAL` (the fallback default set; source for the `agents` seed).
- The 11 `load_prompt` call sites: `agents/{game,editor,calibrator,advocate,scout,bonus,design,researcher}.py` (editor ×2, bonus ×3) — to swap to `state["config"]`.
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` — `pipelineRuns:create` (line ~206) and `graph.ainvoke()` (lines ~161, ~310): where the `runs` write + snapshot must land before invoke.
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — `DispatchState` TypedDict (add `config`).
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` — `convex_query` / `convex_mutation` / `convex_mutation_safe` (the Convex HTTP path the loader uses).
- `convex/schema.ts` — Phase-21 stubs `agents` (agentKey, enabled, model, temperature), `prompt_versions` (agentKey, version, content, isActive, createdAt, createdBy, note), `pipeline_config` (key/value JSON), and `runs` (`configSnapshot: v.optional(v.string())` already present). Flesh these out; do NOT modify frozen `pipelineRuns`/`deliberationEvents`.
- `docs/API_CONTRACTS.md` — frozen `pipelineRuns` (§4); `DispatchState` contract (§7) — amend §7 for the new `config` field BEFORE code (CLAUDE.md hard rule).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `load_prompt()` / `_extract()` — the byte-exact marker extraction is the verification oracle; the migration reads via `load_prompt()` so seeded rows match what the pipeline currently sends.
- `llm_config.py` maps — directly seed `agents` rows from these (single source for the disk fallback + the Convex seed).
- `convex_client.py` async HTTP helpers — `convex_query` for the run-start read; `convex_mutation` for the `runs`/snapshot write. Mirror the Phase-21 `seedEisenbalm` idempotent-seed pattern for the prompt/agent migration.
- Phase-21 `runs` table already carries `configSnapshot` + `triggeredBy` + `triggerSource` — Phase 22 populates `configSnapshot`.

### Established Patterns
- Prompt token substitution is `str.replace("{token}", value)`, NOT `str.format()` — preserve when reading from `state["config"]`.
- Convex tables: `defineTable` + `v.*` + `by_workspace` index; deterministic/idempotent upserts; `workspace_id: v.string()` ("eisenbalm").
- Voice byte-equivalence is contract-tested (e.g. `test_voice.py`, `test_section_writer_voice_propagation.py`) — the loader swap must keep the assembled system strings byte-identical when Convex values equal the seeded defaults.

### Integration Points
- `api/runs.py` run-start sequence: create `pipelineRuns` + `runs` → `load_run_config()` → `snapshot_config()` (awaited, confirmed) → build `initial_state` with `config` → `graph.ainvoke()`.
- `DispatchState.config` consumed by the 11 swapped call sites.
- `convex/schema.ts` `agents` / `prompt_versions` / `pipeline_config` get their real shape + seed mutations here.

</code_context>

<specifics>
## Specific Ideas

- Keystone discipline: the snapshot is the reproducibility guarantee — capture the RESOLVED config (post-fallback), so the record is always truthful about what ran.
- Brand-agnostic control plane (brief §6): no Eisenbalm-specific logic; agent roster + config are data keyed by `workspace_id`.
- The "loader swap, not extraction" framing is the safety rail — keep the 11 `.md` and `llm_config.py` as fallback; deleting either turns a Convex hiccup into a pipeline outage.

</specifics>

<deferred>
## Deferred Ideas

- Section-writer prompt externalization (origin_story/problem/founder_bio/case_study `SECTION_GUIDANCE`) — **Phase 24**.
- User-prompt templates, `qa/rubric.md`, `VOICE_CONSTRAINTS` as separately versioned/editable assets — **Phase 24**.
- Prompt-editing UI (CodeMirror + `{variable}` highlighting), diff, rollback, single-agent test-run — **Phase 24**.
- Per-agent `enabled → skip` execution gating — **Phase 23/25**.
- `wrap_agent_node()`, `agent_runs` live emissions, read-only dashboard, `lib/registry.py` — **Phase 23**.
- Run control (`/pipeline/tick`, cancel, schedule, budget caps) — **Phase 25**.

</deferred>

---

*Phase: 22-config-externalization*
*Context gathered: 2026-06-22*
