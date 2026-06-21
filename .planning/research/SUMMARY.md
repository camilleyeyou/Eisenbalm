# Research Summary — Milestone v2.0: Mission Control Dashboard

**Synthesized:** 2026-06-21
**Sources:** `STACK.md`, `FEATURES.md`, `ARCHITECTURE.md`, `PITFALLS.md` (all v2.0; prior v1.0 versions are in git history) + `docs/MISSION_CONTROL_BRIEF.md` (spec) + `docs/CURRENT_STATE.md` (Phase 0 reconciliation)
**Overall confidence:** HIGH

---

## Executive Summary

The v2.0 Mission Control Dashboard adds a **Clerk-auth-gated `apps/dispatch-control` Next.js app** to the existing monorepo, plus new Convex tables and a small number of new Python files in the pipeline. The architectural foundation is **config externalization to Convex**: a `load_run_config()` reads all active prompts + pipeline settings once at run start, `snapshot_config()` writes the full config onto the `runs` record **before** `graph.ainvoke()` is called, and every agent reads from `state["config"]` rather than from the DB mid-run. This one decision makes every run reproducible, prevents mid-run edits from corrupting in-flight pipelines, and eliminates concurrent Convex round-trips during the parallel phase-2 superstep.

**Four convergent signals from all four research agents:**
1. **Clerk auth is the true Phase-1 blocker** — nothing in the dashboard is viewable or writable without it.
2. **The §2 keystone (config externalization + per-run snapshot) must be right before any other work begins.**
3. **Cost capture ALREADY EXISTS** (`acomplete` → `cost.py` → `pipelineRuns.cost`) — do NOT add a second recorder; surface it live.
4. **The new `runs` table AUGMENTS the frozen `pipelineRuns`** (same `run_id` join key, both written at run start; `pipelineRuns` contracts in `API_CONTRACTS.md §4` stay unchanged).

---

## Key Findings

### Stack (6 new packages; everything else reused)
- `@clerk/nextjs ^7.x` (Core 3) — auth; free at 50K MAU; native `ConvexProviderWithClerk`; Organization primitives ready for Phase 6 multi-tenancy. **Chosen over Auth.js v5 (beta) and Convex Auth (no org primitives). Do not revisit.**
- `@uiw/react-codemirror` + `@codemirror/view` + `@codemirror/state` — prompt editor; `{variable}` highlighting is a custom `StateField` + `Decoration.mark` extension (no third-party plugin). Not Monaco (too heavy for plain-text prompts).
- `react-diff-viewer-continued ^4.2.2` — prompt version diffs (maintained fork).
- `@slack/webhook ^7.x` — push notifications (needs Convex Node action, `'use node'`).
- **Reused, add nothing:** Stripe (`^21` already present, for reconciliation), Resend (`packages/emails`, for email notifications), Convex, Next.js 15 / React 19 / Tailwind v4.

### Architecture (decisions resolved)
- **Config lives in Convex** (not Railway Postgres) — dashboard writes via mutations; pipeline reads via `httpx` query at run start. Convex gives real-time subscriptions and the pipeline already speaks Convex HTTP.
- **Railway Postgres stays checkpointer-only** (LangGraph `AsyncPostgresSaver` tables). No app tables mixed in.
- **`deliberationEvents` event-type union is frozen** — dashboard live progress uses a new `agent_runs` table, not new event types.
- **`pipelineRuns` schema is frozen** — a new `runs` table is the dashboard-facing superset (`config_snapshot`, `trigger_source`, `triggered_by`, richer `status`), written alongside `pipelineRuns:create` on the same `run_id`.
- **Live progress + cost via `wrap_agent_node()`** in a new `lib/agent_wrapper.py`: emits `agent_runs:started` before a node and `agent_runs:completed` after, reading the **already-accumulated** in-memory cost from `cost.py` — **no second `record_cost()` call.**
- **Cancel is cooperative** — `/runs/{id}/cancel` sets `runs.status="cancelled"` in Convex; each wrapped node checks a cancel flag before starting (LangGraph has no native interrupt).
- **Prompt loader swap, not extraction** — new `lib/config_loader.py` queries active prompt versions from Convex with `lib/prompts.py::load_prompt()` (the 12 `.md` files) retained as fallback; 8 agent call sites switch to `state["config"].prompts[name]`. Migration seeds the 12 files as version-1 active rows.
- **Auth boundary:** Clerk on `dispatch-control` only; `apps/web` stays unauthenticated. FastAPI dashboard endpoints verify Clerk JWT; Railway cron keeps `X-Pipeline-Trigger-Secret`.

### Features already done (zero/low new work)
- Per-call cost capture — surface it, don't rebuild it.
- `awaiting_review` status is already set by the Publisher — the review gate subscribes to it.
- 12 `.md` prompt files already externalized — loader swap + versioning + migration, not string extraction.
- A budget soft-cap warning already exists in `cost.py` — hook notifications to that Convex event.
- `DESIGNAGENT_SUPPRESSED` env flag is a precursor for the DB-driven per-agent enable toggle.

### Pitfalls (phase-tagged, tied to real code)
- **Snapshot race (Phase 22):** the snapshot must be the FIRST awaited op before LangGraph is invoked, or the window between `create_task` and the snapshot commit is a real race.
- **Cost double-count (Phase 23):** `acomplete` already calls `record_cost()`; any callback/wrapper that ALSO records doubles spend, trips budget caps early, and poisons donation math. Wrapper must READ, not record.
- **`auto_publish` accidentally on (Phase 26):** catastrophic — bypasses the only human gate on real-charity/real-money content. Needs friction modal + rate-limit + audit + alert from day one; default `false` (NOT NULL).
- **Prompt DB fallback (Phase 22/24):** keep the 12 `.md` files; deleting them turns any Convex degradation into a pipeline outage. Variable-mangling by non-coders must be caught by editor validation + substitution preview before going live.
- **Kill switch / cancel (Phase 25):** rely on the `schedule_enabled` flag checked inside `/pipeline/tick`, never on disabling the cron; cancel cleanup order (Convex status → checkpoint marker → task cancel) must be verified under Railway redeploys.
- **`workspace_id` from day one (Phase 21):** must be on every new Convex table immediately; retrofitting at Phase 6/28 is a destructive migration over live run data. No Eisenbalm-specific logic in the control plane.

---

## Roadmap Implications

Suggested: **8 phases (21–28)**, continuing numbering from v1.0's Phase 20.

1. **Phase 21 — Auth + Convex schema + app shell.** Clerk first; new tables all carry `workspaceId`; seed `workspace_id="eisenbalm"`. Blocks everything.
2. **Phase 22 — Config externalization (§2 keystone).** `lib/config_loader.py` + `snapshot_config()` as first awaited op; 12-file migration with byte-comparison verification; 8 call-site swaps; `DispatchState.config` field.
3. **Phase 23 — Node wrappers + read-only dashboard.** `wrap_agent_node()` (no second recorder); `agent_runs` emissions; read-only views (graph, run history, live run, cost roll-ups); `lib/registry.py` for test-run.
4. **Phase 24 — Prompt editing + versioning.** CodeMirror + `{variable}` decoration; save-as-version + dedup; diff; activate/rollback with in-progress-run lock; `VOICE_CONSTRAINTS` as a first-class versioned asset; `POST /agents/{key}/test-run`.
5. **Phase 25 — Run control.** `/pipeline/tick` (flag check first) + provision Railway cron; cooperative cancel; schedule editor; single-agent re-roll via checkpoint; budget caps/alerts.
6. **Phase 26 — Review gate + charity registry.** `awaiting_review` queue; `apps/web` preview (iframe, not reimplementation); friction-gated `auto_publish`; claims gate (unchecked by default); charity registry + Scout dedup.
7. **Phase 27 — Money + notifications.** Stripe reconciliation (uses actual recorded cost, never `model_pricing`); Resend + Slack; `model_pricing` labeled as projection with staleness indicator.
8. **Phase 28 — Productization prep.** Workspace-scoping audit; `workspace_secrets` (AES-256-GCM in Convex); Clerk Organizations; "rename the brand" grep test; graph topology as JSON config.

---

## Research Flags

**Needs deeper research at plan-phase time:**
- Phase 22 prompt migration — `_extract()` correctness + byte-comparison test (a subtle extraction bug creates a corrupted baseline that looks correct).
- Phase 25 LangGraph single-node re-roll — `aget_state()` → node → `aupdate_state()` against the exact `langgraph-checkpoint-postgres` version in use.
- Phase 25 cancel atomicity — three-step cleanup order verified under Railway redeploy.

**Standard patterns (skip research-phase):** Clerk quickstart (P21); Convex subscriptions extension to `agent_runs` (P23); CodeMirror decoration + diff viewer (P24); Resend/`@slack/webhook` (P27).

---

## Open Gaps / Infra Notes
- `dispatch-control` likely needs its own Vercel project (env-var isolation from `apps/web`; Clerk config; Turborepo cache for the second app). Confirm during Phase 21.
- `SUPABASE_POSTGRES_URL` rename deferred to post-v2 (don't break `graph/checkpointer.py` mid-milestone).
- Railway cron provisioning lands in Phase 25 alongside `/pipeline/tick`.
- Convex vs Railway Postgres for the versioned config store: architecture agent resolved toward **Convex** (reactivity + existing HTTP path); Postgres would offer transactions/FKs. Worth a final nod at Phase 22 planning.

---

*Ready for the roadmapper to create phases 21–28 for milestone v2.0. Phase sequence, dependency chain, and pitfall mitigations are grounded in the live codebase state as of 2026-06-21.*
