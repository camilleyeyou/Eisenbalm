# Mission Control Dashboard — Integration Pitfalls

**Domain:** Adding a no-code control plane to a live single-tenant LLM pipeline (v2.0 Mission Control)
**Researched:** 2026-06-21
**Scope:** Pitfalls specific to ADDING this control plane to THIS live system. Generic dashboard advice excluded.
**Confidence:** HIGH for pitfalls grounded in the actual codebase mechanics (acomplete, load_prompt, LangGraph checkpointer, Convex pipelineRuns). MEDIUM for auth and multi-tenant patterns (ecosystem patterns, verified against official docs).

> **Prerequisite reading:** `docs/CURRENT_STATE.md` (Phase 0 reconciliation) and `docs/MISSION_CONTROL_BRIEF.md` (v2.0 spec). This document is tied to specific codebase paths and mechanics — do not read without those two documents in hand.

---

## Category 1: Config Externalization — Race Conditions, Mid-Run Edits, DB Unavailability

### Pitfall 1.1: Snapshot Exists But the Config Object Was Already Mutated Before Snapshot Was Taken

**Severity: HIGH**

**What goes wrong:**
The brief's snapshot rationale (§2) is sound: at the start of every run, snapshot the active config onto the run record, so mid-run edits cannot corrupt a running issue. But the snapshot is only safe if it is taken as the FIRST action in `_execute_run()` BEFORE any agent reads config. If any agent reads from the live config table before the snapshot is written — even one `load_prompt()` call that hits the DB — and Andrew edits that prompt between that read and the snapshot commit, the run is now executing with config that does not match its own snapshot. The snapshot record says "prompt v3" but the Calibrator ran with "prompt v4."

**Why it happens:**
Timing: `_execute_run()` launches a `create_task` and returns the `runId` immediately (`api/runs.py:235-239`). If config reads are interleaved with the snapshot write (e.g., Calibrator starts before the Publisher has confirmed the snapshot is committed to DB), the race exists. Async task startup delay (Railway cold container) makes the window real.

**Specific codebase risk:** The current `_execute_run()` background task pattern returns immediately. The config snapshot must be the FIRST awaited operation in that task body, before the LangGraph graph is invoked at all.

**Prevention:**
1. Make config snapshot a synchronous pre-condition of the run, not part of the async task: write the snapshot BEFORE returning `{runId}` to the caller. The `/pipeline/run` endpoint should: (a) load active config, (b) write snapshot to run record in Convex, (c) only then create the background task and return `runId`. If the snapshot write fails, the endpoint returns 503 — no run starts.
2. Pass the snapshot config object directly into the LangGraph invocation as part of `DispatchState` initial state — agents NEVER read from the live config table mid-run. All config reads during a run must come from `state["config_snapshot"]`, not from the DB.
3. Add a snapshot-integrity assertion: at pipeline end (Publisher node), re-read the snapshot from Convex and assert it matches the config that was injected into `DispatchState`. If it doesn't, flag the run as `snapshot_mismatch` and notify — do not publish.

**Warning signs:**
- Run records in Convex where `config_snapshot.prompt_version != agent_run.prompt_version_used`
- A/B differences in output between two runs triggered within 30 seconds of each other (one caught the edit, one didn't)
- Andrew edits a prompt, triggers a run immediately, and the run uses the old prompt (opposite edge: snapshot was taken before the edit)

**Phase to address:** Phase 1 (config externalization is the foundation — snapshot semantics must be correct before any agent reads DB-backed prompts)

---

### Pitfall 1.2: DB Unavailability Breaks the Pipeline When the File Loader Is Gone

**Severity: HIGH**

**What goes wrong:**
Today, `load_prompt(name)` uses `importlib.resources.files("eisenbalm_pipeline").joinpath("prompts", name + ".md")` — it reads from the installed wheel. This NEVER fails due to network issues. After the loader swap to a DB-backed loader, every `load_prompt()` call becomes a network call to Convex (or Postgres). If Convex is degraded (their managed service has had multi-hour incidents), the entire pipeline fails to start. The 12 `.md` files in `packages/pipeline/src/eisenbalm_pipeline/prompts/` become dead code and are potentially removed — destroying the fallback.

**Specific codebase risk:** The existing call sites (`agents/scout.py:192`, `agents/calibrator.py:109`, `agents/editor.py:194`, `agents/advocate.py:67`, `agents/researcher.py:85`, `agents/bonus.py:130/144/159`, `agents/game.py:61`, `agents/design/__init__.py:99`) would all become DB-dependent. A single Convex hiccup cascades to all 9 agents.

**Prevention:**
1. Do NOT delete the `.md` files during the migration. Keep them as the fallback source. The new loader should be: (1) try DB, (2) on any exception, fall back to `importlib.resources` file, (3) log the fallback as a WARNING (so Andrew sees it in Railway logs, knows the dashboard config was bypassed).
2. Implement a warm cache: at pipeline start (before `_execute_run` even begins), bulk-load all active prompts from DB into an in-memory dict keyed by agent name. Individual agent `load_prompt()` calls hit the cache, not the DB. Cache is populated once per run with a 5-second timeout; on timeout, fall back to files.
3. Write a health-check into `POST /run/weekly`: before starting a run, verify the config DB is reachable and returns valid prompts. If not, return `503 config_unavailable` rather than starting a run that will silently use stale file-based prompts.
4. Track which source was used (`db` vs `file_fallback`) in the run's config snapshot. If `source: "file_fallback"` appears in the snapshot, surface it prominently in the dashboard run detail view.

**Warning signs:**
- Railway logs show `load_prompt: using file fallback for [agent]` during a run
- Config snapshot has `source: "file_fallback"` while the dashboard shows a custom prompt version
- Pipeline completes successfully but the prompt version in the snapshot doesn't match what Andrew set in the dashboard

**Phase to address:** Phase 1 (the fallback strategy must be designed before the first DB-backed `load_prompt()` call is written)

---

### Pitfall 1.3: Mid-Run Config Edit Corrupts Agent-to-Agent State That Carries Forward

**Severity: MEDIUM**

**What goes wrong:**
The snapshot mitigates "an agent reads the wrong prompt version." But it does NOT prevent a subtler problem: even if all agents read from the snapshot, if an operator changes the Calibrator's prompt mid-run (while agents after Calibrator are still running), the `style_brief` that Calibrator wrote to `DispatchState` was produced by the old prompt. The new prompt changes Calibrator's voice framing — but Calibrator already ran. The OriginStoryWriter receives a `style_brief` generated by the old Calibrator, while Andrew sees the new Calibrator prompt in the dashboard and thinks the run used it.

**Note:** The snapshot fixes this IF AND ONLY IF the entire config is frozen at run start (Pitfall 1.1 prevention). This pitfall is about dashboard UX misleading Andrew, not a technical corruption.

**Prevention:**
1. The dashboard must clearly show: "This run used config snapshot from [timestamp]" with a link to the exact prompt versions. Never show the current live prompt versions on a run detail page — only the snapshot.
2. Add a "run in progress" lock indicator in the dashboard: while a run is active, the prompt editor for any agent in that run shows "Locked — edit will apply to next run." This prevents Andrew from thinking he changed something mid-run.

**Warning signs:**
- Operator reports "I updated the Calibrator prompt during a run but the output didn't change" — they are confused because the snapshot locked it. This is correct behavior but needs UI clarity.
- Andrew edits a prompt during a run and expects the currently-running section writers to pick it up.

**Phase to address:** Phase 2 (prompt editing UI must communicate snapshot semantics clearly)

---

### Pitfall 1.4: Voice Constraints in voice.py Are Not DB-Backed — Edited Prompts May Silently Diverge

**Severity: MEDIUM**

**What goes wrong:**
`lib/voice.py` contains `VOICE_CONSTRAINTS` (the Jesse persona block + universal hard rules), which is injected into agent prompts via `str.replace("{VOICE_CONSTRAINTS}", VOICE_CONSTRAINTS)` at call time. This string is NOT in any of the 12 prompt `.md` files — it is hardcoded in `voice.py`. If the dashboard externalizes the 12 prompt files into DB but does NOT externalize `VOICE_CONSTRAINTS`, an operator editing an agent's prompt in the dashboard sees the prompt template with `{VOICE_CONSTRAINTS}` as a literal placeholder — they cannot see what it resolves to. They may inadvertently remove the `{VOICE_CONSTRAINTS}` substitution marker, thinking it is a mistake, and silently kill Jesse's voice across all agents.

**Specific codebase risk:** `voice.py` also has a Phase 16 byte-equivalence sentinel (`_PHASE_14_VOICE_CONSTRAINTS_BASELINE`) that asserts the string is unchanged at module load time. Editing `voice.py` to add DB-backed loading would need to carefully not break this sentinel.

**Prevention:**
1. Treat `VOICE_CONSTRAINTS` as a first-class prompt asset in the dashboard — not a hardcoded string in `voice.py`. Migrate it to the DB as a special `voice_constraints` agent record, separate from the 12 operational prompt files.
2. In the prompt editor, render `{VOICE_CONSTRAINTS}` as a readonly "voice block" chip that expands to show the full content on hover. The operator can see what it resolves to but cannot accidentally delete it.
3. Add a variable validation rule: when saving a prompt edit, if the original prompt contained `{VOICE_CONSTRAINTS}` and the new version does not, block the save with: "This prompt is missing the {VOICE_CONSTRAINTS} block. Voice constraints are required for Jesse's voice."
4. Update the byte-equivalence sentinel in `voice.py` to read from DB (or remove it and replace with a test that asserts the DB record matches the canonical baseline).

**Warning signs:**
- A prompt edit saves successfully but `{VOICE_CONSTRAINTS}` is absent from the stored version
- Run output loses Jesse's dry register without any QA flags (QA is also using the same broken voice constraint)
- Dashboard shows "voice_constraints variable: missing" in variable hint panel

**Phase to address:** Phase 2 (prompt editing — variable awareness must cover the voice injection point)

---

## Category 2: Prompt Versioning — Migration Mapping, Activate/Rollback Races, Template Variable Safety

### Pitfall 2.1: The File-to-DB Migration Loses the Source-of-Truth Mapping

**Severity: HIGH**

**What goes wrong:**
The migration of 12 `.md` files to the DB creates "version 1" for each agent. If the migration script is run more than once (common for idempotency), or if it runs against a partially-migrated state (migration interrupted after 7 of 12 files), some agents end up with duplicate "version 1" entries in the DB. When the dashboard activates a version for an agent, it may activate a duplicate instead of the canonical baseline.

**More critically:** the `.md` files have a specific format — an editorial header BEFORE `<!-- PROMPT START -->` and the actual prompt template between `<!-- PROMPT START -->` and `<!-- PROMPT END -->` (`lib/prompts.py:26-46`). If the migration script does NOT apply the same `_extract()` function that `load_prompt()` applies, it migrates the raw file content (including editorial header) rather than the extracted prompt. Every agent then runs with its system prompt prefixed by the editorial header comments.

**Prevention:**
1. The migration script MUST use `load_prompt(name)` (or its exact extraction logic) to extract the prompt content — not raw file reads. This ensures the same stripping of `<!-- PROMPT START -->`/`<!-- PROMPT END -->` markers that the live loader performs.
2. Make the migration idempotent by keying on `(agent_name, content_hash)`: if a version with the same hash already exists for that agent, skip — do not create a duplicate. Use SHA-256 of the extracted content as the deduplication key.
3. After migration, run a verification step: for each of the 12 agents, call `load_prompt(name)` (file-based) and compare the result against the DB-retrieved active version. They must be byte-identical. If not, abort and report which agents have diverged.
4. Store the source file path and original file hash on every migrated version record. This makes it trivially easy to verify that "version 1" in the DB is the authentic original from the file.

**Warning signs:**
- `prompt_versions` table has more than 12 rows with `version_number: 1` (migration ran multiple times)
- Agent runs with editorial header text in the system prompt (visible in OpenRouter usage logs as unexpectedly long `tokens_in`)
- Migration "succeeded" but a test run produces output that doesn't match the pre-migration baseline

**Phase to address:** Phase 1 (migration is part of config externalization) — must be verified with the byte-comparison test BEFORE switching the live loader to DB-backed

---

### Pitfall 2.2: Activate/Rollback Race Leaves Two Versions "Active" Simultaneously

**Severity: HIGH**

**What goes wrong:**
The dashboard activates a new prompt version for Scout (version 3 → version 4). The activation write to Convex sets `scout.active_version_id = v4_id`. Simultaneously, a pipeline run that was triggered 2 seconds ago is in its Calibrator phase (the first agent) and will reach Scout in 8–12 minutes. At the moment of Scout's `load_prompt()` call:

- If using live DB reads (no snapshot): Scout reads version 4 (correct — it's what Andrew wanted)
- If using run-start snapshot (correct architecture): Scout reads version 3 (the snapshot was taken before the activation)
- If the snapshot write and the activation write race: Scout could read version 4 in the snapshot but version 3 was what actually ran (if activation happened between snapshot write and Scout's execution)

Additionally: rollback from v4 to v3 sets `active_version_id = v3_id`. If two operators are in the dashboard simultaneously (unlikely but possible), a rollback can collide with an activation.

**Why it matters for this system:** Andrew IS the sole operator, so multi-operator collision is low risk. But the race between "activate" and "in-flight run" is real.

**Prevention:**
1. Activation is only safe to perform when no run is active. The dashboard should: check Convex `pipelineRuns` for any run with status `running`; if found, show "A run is in progress — activation will apply to the next run" and queue the activation for after the current run completes.
2. Make activation and snapshot atomic: when starting a run, the FIRST DB write is "create run record + snapshot current active versions" as a single Convex transaction. No activation can modify active versions while this transaction is in flight (Convex document-level transactions prevent this if done correctly).
3. In the dashboard, show "pending activation" separately from "active version" — an activation queued for "after current run" is visually distinct from an immediately-active change.

**Warning signs:**
- Dashboard shows "v4 is active" but the last run's snapshot shows "v3 was used" with no explanation shown to Andrew
- Rollback fires during a run and the run log shows the agent used a different version than both the pre-rollback and post-rollback states
- Two consecutive runs with identical config produce different outputs (race happened)

**Phase to address:** Phase 2 (prompt versioning) — activation semantics must be explicitly designed; do not default to "write to DB and immediately active"

---

### Pitfall 2.3: Non-Coders Mangle Template Variables and Break Runs

**Severity: HIGH**

**What goes wrong:**
Agent prompts contain template variables like `{charity_name}`, `{voice_constraints}`, `{research_summary}`, `{VOICE_CONSTRAINTS}`. The current code substitutes these via `str.replace("{charity_name}", state.charity_name)` (Scout: `agents/scout.py:192`). If a non-coder editing Scout's prompt in the dashboard accidentally:
- Removes a required variable: `{charity_name}` becomes `charity name` (no braces) → `str.replace` finds nothing → the literal `{charity_name}` is passed to the LLM as prompt text or the replacement silently fails
- Renames a variable: changes `{voice_constraints}` to `{jesse_voice}` → the substitution never fires → `{voice_constraints}` is passed verbatim to the LLM as the system prompt text
- Double-curly-braces it: `{{charity_name}}` → Python f-string rendering would strip one pair but raw `str.replace` would fail
- Uses a variable name that doesn't exist in the substitution map → same silent failure

Silent failures are worse than loud ones here: the pipeline will complete, QA will not flag it (QA doesn't know what variables were supposed to be substituted), and Andrew will publish an issue where the Scout saw `{charity_name}` literally instead of the real charity name.

**Specific risk:** The `str.replace()` pattern used in the codebase does not raise on unknown variables. It silently does nothing, returning the template with the unresolved placeholder intact.

**Prevention:**
1. Replace all `str.replace("{var}", value)` substitution with a custom template formatter that raises `MissingVariableError` if the template contains `{...}` patterns that have no corresponding substitution value. This makes broken prompts loud (run fails at startup) rather than silent.
2. In the dashboard prompt editor: parse the prompt text in real-time and highlight all `{variable}` patterns. Show a sidebar with: (a) "Known variables" — the ones this agent's code will substitute; (b) "Unknown variables" — any `{...}` patterns in the prompt that will NOT be substituted. Unknown variables are shown in red with a tooltip: "This variable will be passed verbatim to the LLM."
3. When saving a prompt edit: validate that all `{...}` patterns in the new version are either known substitution variables OR have been explicitly flagged by the editor as "intentional literal." Warn (not block) on unknown variables — the operator may want `{example}` literally in an example block.
4. Add a "test substitution" preview in the editor: show the prompt with variables substituted using mock values so the editor can see exactly what the LLM will receive.

**Warning signs:**
- A run's OpenRouter call has `tokens_in` dramatically higher or lower than baseline (un-substituted large block vs. missing section)
- Pipeline completes but Scout's `pitchLog` entries show charity name as the literal string `{charity_name}`
- QA agent produces no corrections for a run (the prompt was garbled, QA ran on the garbled output and also produced garbled QA)

**Phase to address:** Phase 2 (prompt editing) — variable validation must be built before any non-coder touches a prompt

---

### Pitfall 2.4: Rollback to "Working Version" Is Not Actually the File Baseline

**Severity: MEDIUM**

**What goes wrong:**
An operator makes prompt edits over 3 versions (v1 → v2 → v3) and discovers v3 is producing bad output. They "rollback to v1." But v1 in the DB was the result of the migration (Pitfall 2.1) — and if the migration had a subtle bug (e.g., did not correctly strip the `<!-- PROMPT END -->` marker, leaving a trailing newline), "v1" in the DB is not byte-identical to the file baseline. The rollback "fixes" the operator's changes but lands on a slightly corrupted baseline.

**Prevention:**
1. The original file-migrated version of each prompt should be permanently marked `origin: "file_migration"` and locked read-only. It should never be possible to overwrite or delete the origin version — it is the canonical baseline.
2. The dashboard should offer a "Reset to file baseline" action separately from "Rollback." Reset to file baseline re-reads the `.md` file (which is still in the deployed wheel), applies `load_prompt()` extraction, and creates a new version from that content. This is always available as a recovery option.
3. The migration verification test (from Pitfall 2.1) — byte-comparison between file `load_prompt()` and DB active version — should be run and its result stored alongside the migration record. If the test showed divergence, the origin version is flagged as "migration_suspect."

**Warning signs:**
- v1 in the DB has a trailing newline where the file doesn't (or vice versa) — visible in a diff of DB content vs `importlib.resources` load
- "Reset to baseline" produces different output than "Rollback to v1"
- Prompt diff between DB v1 and current `.md` file shows differences beyond whitespace

**Phase to address:** Phase 2 (versioning semantics) — "rollback" and "reset to baseline" are distinct operations and both must work correctly

---

## Category 3: Cost / Budget — Double-Counting, Hard-Stop Orphan State, Pricing Drift

### Pitfall 3.1: Cost Double-Counting After the Dashboard Adds a Second Instrumentation Layer

**Severity: HIGH**

**What goes wrong:**
Per-call OpenRouter cost capture already exists in `acomplete` (`openrouter_client.py:221-224`, `235-238`), which calls `record_cost(run_id, agent_id, ...)`. The `@agent_node` wrapper (referenced in the brief as a "LangGraph callback/handler") is the proposed injection point for the dashboard's instrumentation. If the dashboard adds a LangGraph callback handler that ALSO records cost from the same OpenRouter response (e.g., by reading `response_metadata["token_usage"]["cost"]` from the LangGraph event stream), every LLM call gets recorded twice: once by `acomplete` and once by the LangGraph callback.

The published run cost in Convex `pipelineRuns.cost` would then be 2× actual spend. Budget caps would fire at half the real threshold. Monthly roll-ups would be wrong. The "100% of proceeds donated" brand promise rests partly on accurate financial transparency — double-counted spend figures erode that trust.

**Specific codebase risk:** `cost.py:83-109` uses additive accumulation: `record_cost` appends to an in-memory dict. If called twice per LLM call, every agent's cost is doubled. The current cost path: `acomplete` → `_usage_from_message()` → `record_cost()`. A LangGraph callback that also calls `record_cost()` on `on_llm_end` would double every entry.

**Prevention:**
1. Audit the cost capture path BEFORE adding any dashboard instrumentation. Map every place that calls `record_cost()`. Add a test: for a single `acomplete()` call, assert that `record_cost` was called exactly once, and that `get_run_cost(run_id)` returns a total matching exactly one call's worth.
2. Choose ONE source of truth for cost: either `acomplete`'s `_usage_from_message()` path (current) OR the LangGraph callback — not both. The dashboard can read the cost from Convex (which `acomplete` already populates) without needing to add a second instrumentation layer.
3. If the LangGraph callback is needed for real-time cost accrual in the dashboard's live run view, use it ONLY for streaming partial cost to the UI — do NOT use it to call `record_cost()`. The final authoritative cost persist at pipeline end remains the `acomplete` path.
4. Add a post-run sanity check: compare `sum(agent_runs.cost for agent_run in run)` against `pipelineRuns.cost`. If they diverge by more than 1%, flag the run as `cost_accounting_suspect`.

**Warning signs:**
- Monthly OpenRouter dashboard shows spend = $X but Convex roll-up shows $2X
- Per-run costs in Convex are consistently 2× the per-run cost shown in the OpenRouter usage API
- Budget cap fires mid-run at 50% of the configured threshold

**Phase to address:** Phase 1 (read-only dashboard, cost roll-ups) — the instrumentation architecture must be decided BEFORE adding any new cost instrumentation. Phase 3 (budget caps) — the hard-stop mechanism depends on accurate cost numbers.

---

### Pitfall 3.2: Budget Hard-Stop Mid-Run Leaves LangGraph Checkpoints Inconsistent

**Severity: HIGH**

**What goes wrong:**
The dashboard adds a `per_run_budget_cap`. When a run exceeds the cap, the pipeline hard-stops via `POST /runs/{id}/cancel`. The cancel endpoint raises a `CancellationError` or sets a cancellation flag that agents check. But LangGraph's `AsyncPostgresSaver` checkpoint state is written at each node boundary — if the stop happens between two checkpoints, the checkpointer has recorded "Researcher completed successfully" but the actual run is cancelled. A subsequent retry (if Andrew triggers a re-run of the same `runId`) finds a partial checkpoint: LangGraph resumes from after Researcher with no record that the budget was exceeded, and the partial run picks up where it left off — potentially exceeding the budget again.

**Specific codebase risk:** `graph/checkpointer.py:36` reads `SUPABASE_POSTGRES_URL` (which now points at Railway Postgres). The `AsyncPostgresSaver` writes to `checkpoints` and `checkpoint_blobs` tables. A mid-run cancel leaves these tables with a valid partial checkpoint, indistinguishable from a legitimate Editor Gate 1 pause.

**Prevention:**
1. Budget hard-stop must write a `cancelled` marker to the checkpoint state BEFORE aborting. The marker must include `reason: "budget_cap_exceeded"` and `final_cost`. Without this, the checkpointer state looks like a clean pause.
2. The Convex `pipelineRuns` record must be updated to `status: "cancelled"` with `cancel_reason: "budget_exceeded"` synchronously (not fire-and-forget) before the LangGraph task is terminated. If Convex update fails, do not cancel — log the failure and alert instead.
3. Re-run (re-triggering with the same `runId`) should check the Convex run status: if the previous run was `cancelled` due to budget, refuse to resume from checkpoint without operator confirmation. The dashboard must show "This run was cancelled for budget reasons — resume will use a new checkpoint" and require Andrew to click confirm.
4. The cancel endpoint should also clean up the checkpoint blobs for cancelled runs — or at minimum mark them as stale in a metadata field.

**Warning signs:**
- A run shows `status: running` in Convex but no activity in Railway logs (cancelled but Convex not updated)
- Andrew retriggers a cancelled run and it completes instantly — the checkpoint short-circuited the entire run
- `pipelineRuns.cost` shows the final cost from the cancelled partial run, but subsequent runs for the same issue add on top of it (cost accumulation not reset)

**Phase to address:** Phase 3 (run control — cancel endpoint must be designed with checkpoint consistency in mind); Phase 1 (cost capture must distinguish "in-progress" from "cancelled" cost entries)

---

### Pitfall 3.3: model_pricing Table Drift Makes Cost Numbers Lie

**Severity: MEDIUM**

**What goes wrong:**
The dashboard proposes a `model_pricing` table editable from the dashboard (brief §3B). The current system captures REAL USD cost from OpenRouter's response metadata (`token_usage.cost` at `openrouter_client.py:245`) — this is authoritative because OpenRouter tells us what we were charged. The `model_pricing` table is for PROJECTED spend (monthly estimates, per-run budget projections). If these two are conflated — i.e., if the dashboard starts recalculating historical costs using the `model_pricing` table values instead of the stored actual costs — historical cost data becomes wrong every time the pricing table is updated.

Additionally: OpenRouter's model pricing changes without notice (model price drops are common). If the `model_pricing` table is not updated promptly, projected spend calculations are wrong, budget cap calculations are wrong, and "remaining budget" numbers in the dashboard are misleading.

**Specific codebase risk:** The current authoritative cost path (`acomplete` → `cost.py` → Convex `pipelineRuns.cost`) uses REAL USD from OpenRouter. Do NOT replace or re-derive this with `model_pricing × tokens`. The `model_pricing` table is ONLY for projections.

**Prevention:**
1. Store and display two numbers separately, always: (a) ACTUAL cost — from `acomplete`'s OpenRouter response, immutable after the run (use this for history, auditing, and donation reconciliation); (b) PROJECTED cost — from `model_pricing × trailing average tokens` (use this for "next run will cost approximately $X").
2. The `model_pricing` table must be clearly labeled in the dashboard as "Projection pricing" — not "Cost pricing." Changing a value in `model_pricing` updates projections only, not historical run costs.
3. Add a staleness indicator to the `model_pricing` table: if any model's pricing entry is older than 30 days, show a yellow "stale — verify with OpenRouter" warning. OpenRouter pricing page URL should be linked.
4. For the donation reconciliation feature (Phase 5), use ACTUAL costs from `pipelineRuns.cost`, never `model_pricing`-derived estimates.

**Warning signs:**
- Dashboard shows "Run cost: $4.20" but OpenRouter usage dashboard shows "$2.10" for the same period (model_pricing-derived vs actual)
- A pricing table update causes historical run cost numbers to change retroactively
- Budget cap fires or doesn't fire based on projected cost instead of actual cost

**Phase to address:** Phase 1 (cost architecture — must distinguish actual vs projected before adding model_pricing table); Phase 5 (donation reconciliation must only use actual costs)

---

## Category 4: Kill Switch / Scheduler — Cron Disable vs Flag, tick No-Op, Cancel-in-Flight

### Pitfall 4.1: Disabling the Railway Cron Instead of Checking the schedule_enabled Flag

**Severity: HIGH**

**What goes wrong:**
The brief's kill switch design is: `schedule_enabled` flag in DB → Railway cron calls `/pipeline/tick` → `tick` checks the flag and no-ops if false. The common mistake is operating personnel disabling the kill switch by going to Railway and stopping/deleting the cron service, rather than flipping `schedule_enabled` to false in the dashboard. This means: (a) the kill switch in the DB still shows `schedule_enabled: true` (the dashboard shows automation as "on" but it's actually off — misleading); (b) re-enabling requires Railway console access, not a dashboard click; (c) the change is not audit-logged.

**Specific codebase risk:** The Railway cron is currently "documented but NOT yet provisioned" (CURRENT_STATE.md). When it IS provisioned, the provisioning PR will be the moment to lock in which method is canonical. If the Railway service is created in a way that can be paused from Railway console, that option will be used when panic-stopping is needed.

**Prevention:**
1. The Railway cron service should be configured to be hard to pause: set it up as a non-interruptible "deploy on push" service rather than a toggleable service. This removes the temptation to use Railway console as the kill switch.
2. The `/pipeline/tick` endpoint's `schedule_enabled` check must be the FIRST operation, before any auth or startup cost. Even if the Railway cron fires, `tick` must no-op in under 100ms when the flag is false.
3. The dashboard kill switch must be the ONLY documented kill switch method. The Railway console method must be explicitly called out as "breaks audit log, breaks dashboard state" in any runbook.
4. Add a reconciliation check: if `schedule_enabled = true` in the DB but no runs have been triggered for 8+ days, surface an alert: "Scheduler may be broken — expected a run but none started." This catches the Railway-cron-disabled-but-flag-still-on scenario.

**Warning signs:**
- Dashboard shows `schedule_enabled: true` but no weekly runs are starting
- Railway logs for the cron service show no activity for > 7 days
- Andrew uses Railway console to stop a run instead of the dashboard cancel button

**Phase to address:** Phase 3 (run control / kill switch implementation) — the cron provisioning and flag check must be done atomically in the same phase

---

### Pitfall 4.2: /pipeline/tick Not Actually No-Oping When schedule_enabled Is False

**Severity: HIGH**

**What goes wrong:**
`tick` is a new endpoint (does not exist today — it must be built). If the implementation of `tick` starts the pipeline and THEN checks the flag (instead of checking first), a race exists: the flag check happens 50ms into a run that has already started. Alternatively, if `tick` delegates to `POST /run/weekly` via an HTTP call internally, and `/run/weekly` does not check `schedule_enabled` (it checks `X-Pipeline-Trigger-Secret` instead), then flipping the kill switch has no effect on cron-triggered runs — only on direct API triggers.

**Specific codebase risk:** `POST /run/weekly` at `api/runs.py:177-241` is the existing trigger endpoint. It only validates `X-Pipeline-Trigger-Secret`. If `tick` is simply a wrapper that posts to `/run/weekly`, the kill switch must be checked in `tick` BEFORE calling `/run/weekly`.

**Prevention:**
1. `tick` must be its own endpoint, NOT a wrapper around `/run/weekly`. It reads `schedule_enabled` from Convex, and only if `true` does it call the internal run trigger logic.
2. The `schedule_enabled` read in `tick` must be a synchronous await BEFORE any work is started. The pattern must be: read flag → if false, return 200 with `{"status": "skipped", "reason": "schedule_disabled"}` immediately.
3. Write an automated test for `tick`'s no-op behavior: mock `schedule_enabled = false`, call `/pipeline/tick`, assert (a) the pipeline was NOT triggered, (b) no LangGraph tasks were created, (c) response is 200 with `status: "skipped"`.
4. `tick` should still require the `X-Pipeline-Trigger-Secret` header — the Railway cron service must set this header. Without it, any unauthorized caller could trigger `tick` even when the kill switch is off.

**Warning signs:**
- A run starts after the kill switch was set to `schedule_enabled: false`
- `tick` logs show it completed successfully but the pipeline did not run — unclear if the flag was actually checked or if this was a coincidence
- Test: set kill switch off, manually POST to `/pipeline/tick` with the trigger secret, observe if a run was created in Convex

**Phase to address:** Phase 3 (run control — this is the core kill switch implementation)

---

### Pitfall 4.3: Cancel-in-Flight Leaves LangGraph Checkpoints in an Ambiguous State

**Severity: HIGH**

**What goes wrong:**
`POST /runs/{id}/cancel` must stop an in-flight LangGraph run. The LangGraph graph is invoked as `asyncio.create_task(_execute_run(...))`. Cancelling this task via `task.cancel()` raises `asyncio.CancelledError` inside the graph at the current await point — which could be anywhere (mid-agent, mid-tool-call, mid-Convex mutation, mid-Sanity write). The `AsyncPostgresSaver` may have written a checkpoint for the last completed node but NOT for the partially-completed current node. The Convex `pipelineRuns` record still shows `status: running`.

This creates an inconsistency: the DB (Railway Postgres) shows the graph paused at a specific node; Convex shows `running`; the actual task is gone.

**Specific codebase risk:** `api/runs.py:235-239` uses `asyncio.create_task(_execute_run(...))` with a strong reference pattern. The strong reference stores the task for cancellation. BUT: if the Railway instance restarts (common after a deploy), all in-flight tasks disappear without any cleanup. After restart, Convex still shows `running` for orphaned runs.

**Prevention:**
1. The cancel endpoint must: (a) cancel the asyncio task; (b) await a cleanup coroutine that updates Convex `pipelineRuns.status = "cancelled"`; (c) write a "cancelled" sentinel to the LangGraph checkpoint. All three steps must complete or the cancellation is incomplete. If step (b) or (c) fails, log the failure but do not claim the cancellation succeeded — return 500 with the partial state.
2. Add a Railway startup check: on FastAPI startup, query Convex for any runs with `status: running`. If found, check if there is an active asyncio task for that `runId`. If not (instance restarted), update those runs to `status: interrupted` and write an alert to Convex.
3. The cancel endpoint should be idempotent: calling cancel on an already-cancelled run should return 200 with `{"status": "already_cancelled"}`, not an error.
4. The LangGraph checkpoint for a cancelled run must be explicitly marked as "cancelled, do not resume" — use a dedicated checkpoint thread ID suffix like `{thread_id}_cancelled` or a metadata field on the checkpoint.

**Warning signs:**
- Convex shows `status: running` for a run that has no recent activity in Railway logs
- Railway redeploy causes all `status: running` runs to never complete and never transition to failed/cancelled
- Cancel button in dashboard shows success but the run is still listed as running

**Phase to address:** Phase 3 (run control — cancel must be designed for both graceful stop and crash recovery)

---

## Category 5: Review Gate — auto_publish Risk, False Confidence, Unreviewed Issue Going Live

### Pitfall 5.1: auto_publish Accidentally Enabled — Unreviewed AI Content About Real Charities Goes Live

**Severity: CRITICAL**

**What goes wrong:**
The brief mandates `require_review = true` by default and `auto_publish` as explicit and off by default (§4, §8). If the dashboard's config editor presents `auto_publish` as a boolean toggle with no friction (a single click enables it), a non-coder operator accidentally enables it. The next pipeline run completes and the Publisher agent skips the `awaiting-review` state, calling `POST /issues/{id}/publish` directly. An unreviewed AI-generated issue about a real charity — with potentially hallucinated founder names, unverified case study subjects, or wrong asset figures — goes live on a site that is currently selling a real product and donating real money.

**Specific brand risk:** The brief explicitly states "only Andrew can flip status to published" (out-of-scope section) and "Andrew is the manual guard." Auto-publish bypasses the single human control that the brand is built on. This is not an abstract risk — it is the catastrophic failure mode for this system.

**Prevention:**
1. `auto_publish` must NOT be a simple toggle in the dashboard. It must require: (a) an explicit "I understand this will publish without human review" confirmation modal with non-dismissible text; (b) a second confirmation 5 minutes later (rate-limited by a server-side flag that clears); (c) an audit log entry that records who enabled it and when; (d) an email notification to Andrew immediately when it is enabled, regardless of who enabled it.
2. `auto_publish = true` should be visually alarming in the dashboard: red background on the pipeline config card, persistent banner on the run history page, orange border on every run card when it was used.
3. The default state in the DB, on any new workspace creation, must be `auto_publish = false`. This must be enforced in the schema as a NOT NULL DEFAULT false — not a nullable field where null could be misinterpreted as "not configured."
4. The Publisher agent MUST check `require_review` from the run's config snapshot (not the current live config) before proceeding to publish. Even if the live config has been flipped to `auto_publish = true` AFTER the run started, the run uses its snapshot value.

**Warning signs:**
- Dashboard shows `auto_publish: true` with no warning indicator
- A run transitions directly from `running` to `published` without passing through `awaiting_review`
- Andrew receives no notification of a published issue

**Phase to address:** Phase 4 (review gate is the highest-priority Phase 4 feature per the brief). This is a pre-flight check, not a post-hoc fix.

---

### Pitfall 5.2: Claims/Fact-Check Gate Gives False Confidence, Unverified Claims Pass

**Severity: HIGH**

**What goes wrong:**
The brief proposes surfacing "every number/name/date as a checklist for human sign-off before publish (optionally web-search-backed)" (§4). The implementation risk: the claims extraction is itself an LLM call. If the extractor hallucinates that it found no problematic claims, or if it extracts claims correctly but the UI presents them in a way that makes "no flag needed" the path of least resistance (e.g., pre-checked checkboxes), Andrew clicks through without actually reading each claim.

A second risk: a web-search-backed claim checker that returns "verified" based on a Google snippet that itself is wrong (LLMs reading stale or incorrect search results as authoritative). The fact-check gate provides a veneer of verification without actual verification.

**Prevention:**
1. The claims extractor must enumerate ALL named entities (people, organizations, numbers, dates) — not just ones it judges "risky." Andrew sees the full list, not a curated subset. Completeness is more valuable than precision here.
2. Claims requiring sign-off must be UNCHECKED by default. Andrew must affirmatively check each one. Pre-checked checkboxes are not acceptable.
3. For claims where a source URL is available (from the Researcher's `sourceUrl` field), show the URL inline as "Source: [link]." For claims with no source URL, show "No source — verify manually" in red. The presence of a source URL should NOT be conflated with "claim verified."
4. The claims gate should explicitly NOT be called "fact-check" in the UI — it should be called "claims review" to avoid implying automated verification. The UI should say: "Review these claims before publishing. We found sources for some — verify the rest manually."

**Warning signs:**
- Andrew reports completing the claims review in < 2 minutes for a 10-section issue (not reading them)
- A claim with no source URL was checked off without manual verification
- The claims extractor returned 0 claims for an issue with 10 sections containing 50+ named entities

**Phase to address:** Phase 4 (review gate) — claims UI design must default to skepticism, not trust

---

### Pitfall 5.3: Issue Preview in Dashboard Renders Differently Than Live Site — Andrew Approves Based on Wrong Preview

**Severity: MEDIUM**

**What goes wrong:**
The dashboard's issue preview (shown during `awaiting_review`) renders the issue content from Sanity in the dashboard's own component tree. The live site renders the same Sanity content through `apps/web`'s issue page (`issue/[slug]/page.tsx`) with the full Phase 19 layout, theme injection, game iframe sandbox, deliberation slot, etc. If the dashboard preview uses simplified rendering (e.g., just renders Portable Text blocks as plain HTML), Andrew's approval is based on an inaccurate representation of what will go live. He approves a clean preview and the live site has a broken game iframe or a contrast issue.

**Prevention:**
1. The dashboard issue preview should render the SAME components as the live site, not a simplified version. This means embedding a sandboxed `<iframe>` pointing at a preview route in `apps/web` (e.g., `/issue/[slug]?preview=true`), not reimplementing the layout in the dashboard.
2. If a full `apps/web` preview is not feasible in Phase 4, the dashboard must clearly label the preview as "Simplified — verify on live preview before publishing" and provide a direct link to the Sanity Studio draft preview URL.
3. The game section specifically must render in the dashboard preview with the SAME `sandbox="allow-scripts"` iframe — not as decoded HTML or a code block. Andrew must see the actual game functioning (or failing) before approving.

**Warning signs:**
- Andrew approves an issue that has a broken game iframe on the live site
- The dashboard preview shows correctly-formatted text but the live site has a CSS variable that's a fallback (the preview didn't test theme injection)
- A claim in the Portable Text renders differently in the dashboard preview vs. the live PortableTextRenderer

**Phase to address:** Phase 4 (review gate) — preview fidelity is a requirement of the review gate's value proposition

---

## Category 6: Auth on a Greenfield Admin App

### Pitfall 6.1: Exposing the Control Plane Publicly Without Auth

**Severity: CRITICAL**

**What goes wrong:**
The existing `apps/web` site is 100% public (CURRENT_STATE.md Q5). If the new `dispatch-control` Next.js app inherits the same zero-auth pattern (easy to do when copy-pasting project structure), every dashboard route — prompt editing, pipeline triggering, kill switch, cost data — is publicly accessible without login. Anyone who discovers the URL can trigger pipeline runs (at OpenRouter cost), edit agent prompts, toggle `auto_publish`, or read all cost and charity data.

**Specific risk:** The FastAPI endpoints (`POST /pipeline/run`, `POST /runs/{id}/cancel`, `POST /agents/{key}/test-run`) are currently protected only by `X-Pipeline-Trigger-Secret`. If the dashboard calls these endpoints client-side (Next.js client component → fetch → Railway), the trigger secret is exposed in the browser's network tab.

**Prevention:**
1. Auth must be the FIRST feature built in `dispatch-control` — before any other dashboard functionality. A dashboard page that accidentally deploys without auth protection is worse than a blank page. Ship the auth layer, verify it, THEN add dashboard features behind it.
2. All Railway FastAPI endpoints called by the dashboard must be called via Next.js server actions or API routes — NEVER directly from browser-side JavaScript. Server actions keep the trigger secret server-side.
3. The `dispatch-control` Vercel deployment must have separate environment variables from `apps/web`. Sharing `.env.local` variables between the two apps is a mistake that could expose admin secrets on the public site.
4. Add a smoke test to the `dispatch-control` CI: attempt to access a protected route without auth, assert redirect to login. This must pass before any deploy.

**Warning signs:**
- `dispatch-control` deploys to Vercel and the `/dashboard` route renders without a login redirect
- Browser dev tools network tab shows `X-Pipeline-Trigger-Secret` header in a request from the dashboard
- The Railway FastAPI logs show requests from `*.vercel.app` origins without auth headers

**Phase to address:** Phase 1 (auth is the prerequisite for any dashboard functionality — it is not "Phase 6 productization," it is Phase 1 day one)

---

### Pitfall 6.2: Leaking Pipeline Secrets Through the Dashboard API

**Severity: HIGH**

**What goes wrong:**
The dashboard reads config from Convex: agent settings, model names, temperatures. If the config store also holds API keys (OpenRouter key, Sanity token, Stripe secret, Convex deploy key) and these are returned in dashboard API responses, every session that can read config can read all pipeline secrets. The dashboard might display the OpenRouter key in an "Agent settings" panel "for convenience."

**Specific risk:** The brief mentions "per-workspace secrets handling" and "route API keys through a proper secrets store" (§4.7, §6). Until the secrets store is built, there is a temptation to store secrets alongside other config in Convex — where they would be readable by any authenticated dashboard user (and, without auth, by anyone).

**Prevention:**
1. Secrets (API keys, webhook secrets, Stripe keys) must NEVER be stored in Convex. Convex is observable and queryable. Use Railway environment variables for Railway-side secrets and Vercel environment variables for Next.js-side secrets. These are not accessible via API.
2. The dashboard must NEVER display the value of any secret. It can display "OpenRouter API key: configured (last 4: xxxx)" — never the full key.
3. Config stored in Convex must be explicitly partitioned into: "operator-visible config" (model choices, temperatures, `schedule_enabled`) and "infrastructure secrets" (API keys) — which live in environment variables only.
4. When Phase 6 (productization) adds a secrets store, the migration must audit every Convex document for any field that looks like an API key (regex: `sk_|Bearer |OPENROUTER|SANITY_API`) and alert if found.

**Warning signs:**
- Convex dashboard (at convex.dev) shows a document with a field named `openrouterKey` or similar
- Dashboard API response includes any string matching the pattern of an API key
- `dispatch-control` env var `OPENROUTER_API_KEY` appears in a browser network response body

**Phase to address:** Phase 1 (auth architecture must include secret partitioning from day one)

---

### Pitfall 6.3: Auth on dispatch-control Doesn't Protect the FastAPI Backend

**Severity: HIGH**

**What goes wrong:**
The `dispatch-control` Next.js app has auth (Clerk or Auth.js). A user must log in to see the dashboard. But the FastAPI endpoints on Railway (`POST /pipeline/run`, `POST /runs/{id}/cancel`, etc.) only check `X-Pipeline-Trigger-Secret`. If someone discovers the Railway URL and the trigger secret (e.g., from a commit, a Railway log snippet, or a support ticket), they can trigger pipeline runs, cancel runs, or run test agents directly against Railway — bypassing the dashboard auth entirely.

**Prevention:**
1. The `X-Pipeline-Trigger-Secret` must be treated like a password: never committed, rotated after any possible exposure, and not logged in Railway logs.
2. For dashboard-to-Railway calls, the pattern must be: browser → Next.js server action (auth-checked) → Railway FastAPI (secret-checked). The secret is only in the Next.js server environment.
3. Consider adding IP allowlisting at Railway: only accept requests from Vercel's IP range + localhost. This is Railway-level protection independent of the application-level secret check.
4. Rate-limit the Railway trigger endpoints: max 5 calls per hour per source IP. Protects against brute-force trigger attempts even if the secret is unknown.

**Warning signs:**
- Railway logs show `/pipeline/run` calls from IP addresses that are not Vercel's
- The trigger secret appears in a Railway build log or stdout log
- A pipeline run starts that wasn't triggered from the dashboard

**Phase to address:** Phase 1 (auth and secret management are the same concern — both must be designed together)

---

## Category 7: Multi-Tenant Bones — workspace_id Retrofit Risk, Brand Leakage

### Pitfall 7.1: Skipping workspace_id Now Means a Full Rewrite Later

**Severity: HIGH**

**What goes wrong:**
The brief mandates threading `workspace_id` through everything "from the start" (§6). The failure mode: Phase 1 through Phase 5 are built without `workspace_id` because "it's just one workspace, it doesn't matter." Every Convex query, every DB row, every FastAPI endpoint, and every config table is built assuming exactly one workspace. In Phase 6, adding `workspace_id` requires adding the column to every table, adding the filter to every query, updating every FastAPI endpoint to scope to a workspace, and auditing every place where "all runs" is really "all runs for workspace X." This is not a small migration — it is a rewrite of every data layer.

**Prevention:**
1. Every Convex table that touches pipeline data MUST have a `workspaceId` field from the first create statement. For v1 (single tenant), every document uses the same hardcoded workspace ID (e.g., `"eisenbalm"`). The field is present but always the same value — zero query complexity cost, but the schema slot is reserved.
2. Every FastAPI endpoint that returns or modifies data must accept a workspace scope, even if it always defaults to the single workspace. This means the endpoint signature handles workspace scoping from day one.
3. The Convex schema migration from "no workspaceId" to "has workspaceId" is a destructive operation if data already exists. If the field is not added now, the migration requires backfilling all historical run records with a workspace ID — which could fail or produce inconsistencies for runs that completed before the migration.

**Warning signs:**
- A Phase 1 Convex mutation does not include `workspaceId` in its schema
- FastAPI endpoint `/runs/{id}` looks up a run without any workspace filter (any user of any workspace could access any run's data)
- Phase 6 planning discovers that adding `workspaceId` requires rewriting 40+ Convex queries

**Phase to address:** Phase 1 (every table schema must include `workspaceId` before any data is written)

---

### Pitfall 7.2: Eisenbalm-Specific Logic Leaking Into the Control Plane

**Severity: MEDIUM**

**What goes wrong:**
The brief explicitly prohibits Eisenbalm-specific logic in the control plane (§6): "No hardcoded 'eisenbalm' strings or charity-specific logic in the control plane." The failure modes:

- The charity registry feature is built with columns specific to Eisenbalm's charity focus criteria (`assetRange`, `focusArea`, `notableObscurity`) hardcoded as UI fields — instead of generic "charity metadata" that any workspace could configure.
- The `schedule_enabled` kill switch is described as "controls whether Eisenbalm Dispatch runs Thursday" — the schedule is hardcoded to Thursday in the pipeline instead of being a configurable cadence.
- The pipeline graph structure (Scout → Advocate → Editor deliberation → parallel section writers) is hardcoded in `graph/builder.py` and cannot be reconfigured from the dashboard — contradicting the "treat the agent graph as config" principle.
- The "Jesse's voice" framing appears in the dashboard prompt editing UI as "Jesse's Voice Constraints" — instead of "Voice Constraints (narrator-configurable)."

**Prevention:**
1. Every UI label in the dashboard must be generic: not "Charity Registry" but "Subject Registry"; not "Jesse's Voice" but "Narrator Voice"; not "Thursday Schedule" but "Schedule Cadence."
2. The pipeline graph configuration must be stored as data, not as `graph/builder.py` code, from Phase 1 onwards — even if there is no graph editor UI. The graph topology (which nodes run in what order) should be readable from the config store by the dashboard, not hard-coded.
3. Do a "rename the brand" test in Phase 6: search the entire `dispatch-control` codebase for "eisenbalm", "Jesse", "charity", "lip balm", "Dispatch" — any occurrence in non-display text (i.e., not in demo data or UI copy that Andrew wrote) is a portability violation.

**Warning signs:**
- The dashboard codebase has `if workspace.type === "charity_dispatch"` conditional logic
- A Convex table has a field named `charityId` instead of `subjectId` or `entityId`
- The pipeline `builder.py` graph topology cannot be loaded from a DB config — it always runs the same 14-node structure

**Phase to address:** Phase 1 (schema design) and Phase 6 (audit and rename) — Phase 1 must avoid locking in Eisenbalm-specific field names; Phase 6 must verify the audit passes

---

### Pitfall 7.3: Single-Workspace Auth Assumptions Baked Into Session Model

**Severity: MEDIUM**

**What goes wrong:**
The auth layer (Clerk or Auth.js) is built for a single user (Andrew) with a single workspace. Session tokens carry no `workspace_id` claim because there is only one workspace. When Phase 6 adds multi-tenancy, every server action and API route must be updated to: (a) extract `workspace_id` from the session token (which doesn't have it), (b) look up the user's workspace from the DB, and (c) scope every query to that workspace. If this lookup is not in the original auth session design, every data access point must be refactored.

**Prevention:**
1. Even for a single workspace, the session token / Clerk organization model must include `workspaceId` as a session claim from day one. For v1, it is always `"eisenbalm"` — but it is present in the session, and every server action reads it from the session rather than from a constant.
2. Create a `getCurrentWorkspace()` server utility that reads `workspaceId` from the session and returns the workspace config. All server actions use this utility — never hardcode `"eisenbalm"` in server action code.
3. Document the "adding a second workspace" procedure in the dashboard Phase 6 plan: what changes in the auth layer, what changes in the DB queries, what changes in the FastAPI endpoints.

**Warning signs:**
- Server actions have `const workspaceId = "eisenbalm"` hardcoded
- Adding a second user to the dashboard immediately sees all of the first workspace's runs and data (no scoping)
- Phase 6 planning discovers that `workspaceId` is not in any session token and must be added

**Phase to address:** Phase 1 (auth design) — session token must include `workspaceId` from the first session

---

## Phase-Specific Warning Matrix

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|---------------|------------|
| Phase 1 | Config snapshot timing | 1.1 — snapshot taken after some agents read config | Snapshot must be FIRST awaited op in run execution, before LangGraph invoke |
| Phase 1 | DB-backed loader | 1.2 — DB unavailable kills pipeline | Keep `.md` files, implement warm cache + file fallback |
| Phase 1 | Cost instrumentation | 3.1 — double-counting from @agent_node + acomplete | Audit existing cost path; use ONE source of truth per LLM call |
| Phase 1 | workspace_id | 7.1 — retrofit rewrite | Every Convex table must include `workspaceId` from first migration |
| Phase 1 | Auth architecture | 6.1, 6.2, 6.3 — public control plane, leaked secrets | Auth FIRST; server actions only; secret partitioning from day one |
| Phase 2 | File-to-DB migration | 2.1 — corrupted migration mapping | Use `load_prompt()` extraction logic; byte-comparison verification test |
| Phase 2 | Activate/rollback race | 2.2 — two versions "active" simultaneously | Activation blocked while run is in progress; snapshot is atomic with run creation |
| Phase 2 | Template variables | 2.3 — non-coders delete `{charity_name}` | Variable parser + real-time highlight + substitution preview in editor |
| Phase 2 | Voice constraints | 1.4 — `{VOICE_CONSTRAINTS}` accidentally removed | Treat voice.py `VOICE_CONSTRAINTS` as a first-class prompt asset with a delete guard |
| Phase 3 | Kill switch | 4.1 — disabling Railway cron vs. flag | Cron must be hard to pause from Railway; flag check is canonical |
| Phase 3 | tick no-op | 4.2 — tick starts run before checking flag | Flag check is FIRST synchronous operation; test confirms no-op |
| Phase 3 | Cancel consistency | 3.2, 4.3 — checkpoint orphan after cancel | Cancel writes "cancelled" to checkpoint + Convex atomically before task.cancel() |
| Phase 3 | Budget hard-stop | 3.2 — orphaned state after budget cut | See cancel consistency above; budget stop uses same cancel path |
| Phase 4 | auto_publish | 5.1 — unreviewed issue goes live | Friction + confirmation modal + audit log + email alert; visual alarm state |
| Phase 4 | Claims gate | 5.2 — false confidence from automated check | Unchecked by default; label as "claims review" not "fact-check" |
| Phase 4 | Issue preview | 5.3 — dashboard preview differs from live site | Embed apps/web preview iframe; same components as live |
| Phase 5 | model_pricing drift | 3.3 — projections lie after pricing update | Actual cost (from OpenRouter) ≠ projected cost (from model_pricing); never recalculate historical with model_pricing |
| Phase 6 | Brand leakage | 7.2 — Eisenbalm logic in control plane | "Rename the brand" test; generic field names from Phase 1 |
| Phase 6 | Workspace session | 7.3 — workspaceId not in session token | getCurrentWorkspace() utility uses session claim, not constant |

---

## Integration Gotchas Specific to Mission Control

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| `acomplete` + dashboard cost instrumentation | Adding LangGraph callback that also calls `record_cost()` | Dashboard reads cost FROM Convex (written by acomplete); callback streams to UI only, no record_cost() call |
| `load_prompt()` loader swap | Migrating raw `.md` content including `<!-- PROMPT START -->` markers | Use the existing `_extract()` function from `lib/prompts.py` for migration; byte-compare against file baseline |
| LangGraph checkpoint + cancel | Using `task.cancel()` then immediately returning 200 | Cancel must await cleanup coroutine: checkpoint marker write + Convex status update before returning |
| Railway cron + kill switch | Stopping the Railway cron service to "pause automation" | Flip `schedule_enabled` in DB via dashboard; `/pipeline/tick` checks flag before doing anything |
| Convex `pipelineRuns` + new `agent_runs` table | Using pipelineRuns.cost for both per-agent and per-run rollup | Separate tables: `agent_runs` for per-agent data, `pipelineRuns.cost` for run-total (sum of agent_runs) |
| `dispatch-control` Next.js + Railway FastAPI | Browser-side fetch with trigger secret in Authorization header | All Railway calls via Next.js server actions; secret never reaches browser |
| Prompt versioning + `str.replace()` substitution | Using `str.replace("{var}", value)` which silently no-ops on unknown vars | Custom template formatter that raises on unknown `{var}` patterns; variable validation in editor saves |
| `SUPABASE_POSTGRES_URL` (LangGraph checkpointer) | Treating the var as pointing to Supabase (it now points to Railway Postgres) | Read from Railway Postgres directly; update `.env.example` to reflect Railway URL; rename var to `POSTGRES_URL` |

---

## "Looks Done But Isn't" Checklist for Mission Control

- [ ] **Config snapshot:** A prompt edit during a running pipeline does NOT change the running run's output. Test: trigger a run, edit an agent's prompt 30 seconds in, wait for completion, confirm config snapshot shows pre-edit version.
- [ ] **DB-unavailable fallback:** Kill the Convex connection during a run. Confirm the pipeline completes using file-based fallback prompts AND the run log records `source: "file_fallback"`.
- [ ] **Cost double-counting:** Run a single `acomplete()` call in isolation. Confirm `record_cost()` was called exactly once. Run a full pipeline and compare total Convex cost against OpenRouter usage dashboard total for that API key on that day.
- [ ] **Kill switch:** Set `schedule_enabled = false`. POST to `/pipeline/tick` with the trigger secret. Confirm no run was created in Convex `pipelineRuns`.
- [ ] **auto_publish protection:** Enable `auto_publish = true`. Confirm the dashboard shows a visual alarm, an email was sent to Andrew, and the audit log recorded the change with actor and timestamp.
- [ ] **Auth coverage:** Without logging in, attempt to access every `dispatch-control` route. Confirm all redirect to login. Confirm no Next.js server action can be called without a valid session (test by forging requests with no session cookie).
- [ ] **workspace_id scoping:** Every Convex table created for the dashboard has a `workspaceId` field. Run `grep -r "defineTable" convex/` and confirm every table definition includes `workspaceId: v.string()`.
- [ ] **Template variable guard:** In the prompt editor, remove `{charity_name}` from Scout's prompt and save. Confirm the save is blocked (or warned) and a triggered run fails loudly rather than passing `{charity_name}` verbatim to the LLM.
- [ ] **Cancel consistency:** Trigger a run, immediately cancel it. Confirm Convex shows `status: "cancelled"`, LangGraph checkpoint has a `cancelled` marker, and no further agent nodes were executed after the cancel point.
- [ ] **Railway cron vs. flag reconciliation:** With `schedule_enabled: true` in DB, confirm Railway cron triggers a run. Set `schedule_enabled: false`, wait for next tick, confirm no run is created — even though the Railway cron service is still running.

---

## Sources

- `docs/CURRENT_STATE.md` — Phase 0 reconciliation; `acomplete` cost path at `openrouter_client.py:221-238`; `load_prompt()` at `lib/prompts.py:49-70`; LangGraph checkpoint at `graph/checkpointer.py:36`; scheduler status; frontend auth absence
- `docs/MISSION_CONTROL_BRIEF.md` — §2 snapshot rationale; §3B cost spec; §4 additions (review gate, claims gate); §6 productization requirements; §8 resolved decisions
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py:83-109` — `record_cost()` additive accumulation pattern
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py:177-241` — `POST /run/weekly` trigger; `asyncio.create_task` pattern
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` — `VOICE_CONSTRAINTS` hardcoded string + Phase 16 byte-equivalence sentinel
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py:89-158` — LangGraph `StateGraph` assembly; 14 nodes; `compile(checkpointer=checkpointer)`
- `convex/schema.ts` — `pipelineRuns` table with `cost: v.optional(v.string())`; `deliberationEvents` table; no `workspaceId` fields present today
- [LangGraph — AsyncPostgresSaver checkpoint behavior](https://langchain-ai.github.io/langgraph/reference/checkpoints/)
- [Convex — Document-level transactions and atomicity](https://docs.convex.dev/database/transactions)
- [Railway — Cron jobs as separate services](https://docs.railway.app/guides/cron-jobs)
- [Clerk — Organizations and workspace scoping in multi-tenant apps](https://clerk.com/docs/organizations/overview)
- [Next.js — Server actions and secrets handling](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [OpenRouter — Usage tracking and cost fields in response metadata](https://openrouter.ai/docs/api-reference/chat-completion)

---

*Mission Control Dashboard pitfalls for: The Eisenbalm Dispatch (v2.0 milestone)*
*Researched: 2026-06-21*
*Scope: Integration pitfalls specific to adding this control plane to this live system*
