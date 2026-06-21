# Feature Landscape

**Domain:** Agent-pipeline control plane (operator dashboard over a 9-agent LangGraph editorial pipeline)
**Researched:** 2026-06-21
**Milestone:** v2.0 Mission Control Dashboard

---

## Scope Reminder

This file covers ONLY the ten new dashboard capabilities. The following are
already shipped and must not be re-researched or re-scoped:

- Public magazine site (reader routes, issue page, archive, shop)
- 9-agent LangGraph pipeline (all agents, orchestration, Sanity writes)
- Sanity Studio editorial review workflow (Andrew's manual gate)
- Stripe checkout + webhook + email flow
- Per-call OpenRouter cost capture (real tokens+USD in `acomplete` → `cost.py`)
- File-externalized agent prompts (12 `.md` files, `lib/prompts.py::load_prompt()`)

---

## Feature Group 1 — DB-Backed Pipeline Config + Per-Run Snapshots

### What It Is

Prompts, model choices, temperatures, and the schedule currently live in
code (`.md` files + env vars). This feature moves them into a database that the
dashboard writes and the pipeline reads at run start. At run start, the pipeline
takes a complete snapshot of the active config onto the run record, so each
run is reproducible and mid-run edits cannot corrupt a live issue.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| DB-backed prompt loader | Without this nothing else works — the editing UI has no data layer | High | Loader swap in `lib/prompts.py`, not string extraction. 12 `.md` files must be migrated as seed data. Fallback strategy (file vs DB unavailable) must be decided before building. |
| Per-run config snapshot | The single biggest reproducibility guarantee — "which prompt produced this issue?" | Medium | Snapshot is a JSON blob stored on the run record at run start. Already partially supported: Convex `pipelineRuns.cost` holds a JSON blob; snapshot is the same pattern applied to config. |
| `model_pricing` table (editable) | Cost roll-ups (Group 3) require current per-token prices | Low | A simple table; admin edits it when OpenRouter prices change. |
| `pipeline_config` global record (`schedule_enabled`, `auto_publish`, `require_review`) | These three flags control the entire automation posture | Low | One-row config document. `schedule_enabled` is the kill-switch (Group 4). |
| `agents` table (per-agent metadata) | Foundation for every per-agent UI card | Low | Static-ish: 14 canonical agents. Stores `key`, `description`, `enabled`, defaults. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Snapshot diffing between runs | "Why did Issue 12 cost more than Issue 11?" — compare their config snapshots | Medium | Useful for post-mortems. Not needed at launch. |
| Graph-as-data (store the LangGraph topology as config, not code) | Productization: arbitrary pipelines, not just "the Eisenbalm pipeline" | High | Brief §6 explicitly defers the graph EDITOR UI. Store topology as data now; edit UI is post-v2. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Graph editor UI | Brief §6: "no graph editor UI now — store graph as data." Building a drag-and-drop graph editor is a product unto itself. | Store the graph topology as JSON config; the dashboard reads and displays it but cannot edit edges. |
| Inline-string extraction | Prompts are already `.md` files, not inline Python strings. Extraction work is zero. | Just swap the loader: `load_prompt(name)` reads from DB instead of file system. |
| Live config mutation mid-run | A snapshot at run start exists precisely to prevent this. | Enforce: the pipeline reads config once at `POST /pipeline/run`, snapshots it, and ignores subsequent DB changes until next run. |

### Dependencies on Existing Code

- `lib/prompts.py::load_prompt()` — the single call site to swap. All 8 agent files call it.
- `lib/voice.py::VOICE_CONSTRAINTS` — voice constraints are a separate surface (not in a `.md` file). Must decide: include in the DB config or keep in code. Recommendation: include, because it is what you would most want to edit.
- `agents/qa/rubric.md` — also loaded via `importlib.resources`. Include in migration.
- Convex `pipelineRuns` table — already has `cost` (JSON string). Add `configSnapshot` field (same pattern).
- Railway Postgres — already hosts the LangGraph checkpointer. Prompt versions and config can live here or in a new Convex table. Decision needed; the brief implies Convex.

---

## Feature Group 2 — Prompt Editing: Versioning, Diff, Rollback, Test-Run

### What It Is

A UI where the operator edits a prompt, sees which `{token}` variables are
available, saves as a new version (never overwrites), diffs any two versions,
rolls back or activates a prior version, and can fire a single-agent test-run
against a sample input to see output + cost without running the full pipeline.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Prompt editor with `{variable}` highlighting | Operators need to know which tokens are substituted at runtime so they do not break calls | Medium | The current convention is `{VOICE_CONSTRAINTS}`, `{charity_name}`, etc. The editor must parse `{...}` tokens and warn on unknowns. |
| Save-as-new-version (never overwrite) | Reproducibility requires an immutable version history | Low | `prompt_versions` table: `id`, `agent_key`, `content`, `author`, `created_at`, `note`, `active`. Activate = set `active=true` on one row. |
| Diff between any two versions | Operators want to see exactly what changed before activating | Medium | Server-side line diff (Python `difflib` or a JS diff library). Display as side-by-side or inline unified diff in the UI. |
| One-click rollback / activate | Errors in prompts must be recoverable in under 1 minute | Low | `PATCH /agents/{key}/prompt-versions/{id}/activate` flips the active flag. Audit log entry required (Group 9). |
| Variable hint panel | Operators cannot memorize every agent's available tokens | Medium | Per-agent, document the available substitution tokens. Maintained as static config alongside the agent definition. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Single-agent test-run | "Does my edited prompt produce valid output before I activate it?" — the most valuable prompt-editing safety net | High | `POST /agents/{key}/test-run` with a sample or previous real run's input. Returns the agent's output + cost. Requires the pipeline to support running a single node in isolation against injected state. The LangGraph `StateGraph` compiled with a checkpointer supports partial invocation via `graph.invoke({...}, thread_id=...)` with a targeted start node — feasible but requires care around shared state. |
| A/B version comparison on real run output | "Which version produced better output?" | Very High | Not at launch. Requires running the same run twice or a dedicated eval harness. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Rich-text / WYSIWYG prompt editor | Prompts are plain text with `{token}` markers. Markdown formatting is meaningful (`.md` convention). A rich-text editor will corrupt formatting. | Plain `<textarea>` with syntax highlight overlay for `{...}` tokens. Monospace font. |
| Auto-activate on save | Defeats the purpose of versioning. An unreviewed prompt edit could corrupt the next issue. | Always require explicit "Activate this version" action. Current active version stays live until explicitly replaced. |
| Prompt-level A/B testing automation | Requires a controlled eval harness that does not exist. | Manual test-run covers the use case for now. |

### Dependencies on Existing Code

- `lib/prompts.py::load_prompt()` — must be extended to accept an optional `version_id`; when absent, loads the active version from DB.
- `lib/voice.py` — `VOICE_CONSTRAINTS` and `JESSE_PERSONA_BLOCK` should be versioned too; they are the most voice-critical text in the system.
- FastAPI: new route `POST /agents/{key}/test-run`. Must be able to invoke a single LangGraph node against injected state. Non-trivial — requires an isolated subgraph or a mock-state harness.
- 12 existing `.md` files become seed data for `prompt_versions` table on first deploy.

---

## Feature Group 3 — Cost Observability Roll-Ups + Budget Caps + Projected Spend

### What It Is

Per-call cost is already captured (real OpenRouter tokens+USD via `acomplete`
→ `cost.py`). This feature surfaces it: roll-ups per agent → per run → per
issue → per week/month. Budget caps and alerts. Projected monthly spend from
schedule + trailing average run cost.

### Table Stakes (mostly surfacing, not instrumenting)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-agent cost on run record | Already captured in `pipelineRuns.cost` (JSON string). | Low | Zero new instrumentation. Parse `pipelineRuns.cost` JSON and render per-agent bars. |
| Per-run total cost | Already captured. | Low | Sum of `agents.*` in the cost JSON. |
| Per-issue cost (= per-run cost for weekly pipeline) | Each issue maps to exactly one run. | Low | Join `runs` to `issues` by `issue_id`. For the Eisenbalm Dispatch, this is a 1:1 relationship. |
| Weekly/monthly roll-up | "How much did we spend this month?" | Low | Aggregate `runs.total_cost` over date range. No new capture needed. |
| `model_pricing` table (editable) | Current token prices for projections | Low | Separate from cost capture; used for projecting future spend. OpenRouter already returns actual USD cost — projections are the only reason to maintain this table locally. |
| Budget cap enforcement (hard stop or soft alert) | Prevents runaway spend from a rogue prompt or model selection | Medium | `pipeline_config.monthly_cap` + `pipeline_config.per_run_cap`. The per-run soft warn already exists (`cost.py:244-261` fires at 70% of cap). Hard stop = `POST /runs/{id}/cancel` triggered automatically. |
| Alert thresholds | "Warn me before I hit the cap" | Low | Configurable % of monthly/per-run cap. Email or Slack (Group 10). |
| Projected monthly spend | "At this rate, what will this month cost?" | Medium | Trailing 4-run average x runs-remaining-this-month. Simple arithmetic; display-only. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-agent cost trend across runs | "Scout is getting more expensive — did the web search get slower?" | Medium | Time-series per agent. Useful for catching model price changes or prompt bloat. |
| Cost breakdown by token type (input vs output) | Output tokens are usually more expensive; knowing the ratio informs prompt optimization | Low | `tokens_in` / `tokens_out` already captured in `cost.py`. Surface in UI. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Re-implementing cost capture | Already done in `acomplete` → `cost.py`. Rebuilding it would create two sources of truth. | Surface the existing `pipelineRuns.cost` JSON. The `record_cost()` accumulation is correct; the display layer is what is missing. |
| Per-call cost logging to a separate table | Would duplicate what is already in `pipelineRuns.cost`. | Store cost at the run/agent level (already done). Per-call granularity is overkill for a weekly editorial pipeline. |
| Live cost streaming mid-run | Convex subscriptions already update `pipelineRuns` at end of run. A live per-call stream would require a new Convex event per `acomplete` call — high noise, low value. | Show accumulated agent costs as agents complete. The soft-cap warn at 70% is the live signal that matters. |

### Dependencies on Existing Code

- `cost.py::record_cost()` + `end_run()` — already produce the right data shape.
- `pipelineRuns.cost` (Convex) — JSON string field; parse it in the dashboard.
- The 70% soft-cap warn (`cost.py:244-261`) — already fires a Convex event; hook alerts to this.
- `model_pricing` — new table, seeded from current OpenRouter model prices.

---

## Feature Group 4 — Run Control: Manual Trigger, Kill Switch, Cancel, Re-Roll

### What It Is

Operator-level control over when and whether the pipeline runs: trigger a run
on demand, stop it cold (kill switch), cancel a specific in-flight run, and
re-run a single agent within an existing issue. The scheduler (Railway cron →
`/pipeline/tick`) checks the kill switch before every tick.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Manual trigger ("Run a new issue now") | The operator needs this for testing, catch-up issues, and pre-schedule validation | Low | `POST /pipeline/run` already exists as `POST /run/weekly` in `api/runs.py`. The dashboard button calls this endpoint. Auth-gated (dashboard session → X-Pipeline-Trigger-Secret header). |
| Master kill switch (`schedule_enabled`) | A single flag to halt all automation. The scheduler checks this before every tick — if off, the tick is a no-op. | Low | `pipeline_config.schedule_enabled` boolean. Dashboard toggle. `POST /pipeline/tick` reads it. The Railway cron service still runs; only the tick handler is gated. |
| `/pipeline/tick` endpoint | The Railway cron POSTs here; handler checks `schedule_enabled` | Low | New FastAPI route. Reads `schedule_enabled` from DB config. If true, calls the trigger logic. If false, returns 200 with `{"skipped": true}`. |
| Cancel in-flight run | Broken or runaway runs must be stoppable without Railway console access | Medium | `POST /runs/{id}/cancel`. LangGraph supports interrupt/cancel via the checkpointer. Sets run status to `cancelled` in Convex. The pipeline must poll for a cancellation flag or be interrupted via the graph's async task. |
| Schedule editor (day/time, timezone, pause/resume, next-run preview) | The operator needs to see and change when the weekly run fires without touching Railway CLI | Medium | Stored in `pipeline_config` (cron expression or structured day/time fields). Display "Next run: Thursday 14:00 UTC". The Railway cron itself is not reconfigurable via API — the schedule field controls only what `cli.py trigger-weekly` is expected to do; the Railway service must be reprovisioned if the cron expression changes. This is a known infrastructure constraint. |
| Single-agent re-roll | "The OriginStory writer produced weak output — re-run just that agent against the existing run's state" | High | `POST /issues/{id}/agents/{key}/rerun`. Most complex run-control feature. Must: (1) load the existing run's LangGraph checkpoint, (2) set the specific node's state to pending, (3) invoke the graph from that node, (4) merge new output back. LangGraph with checkpointer supports this via `graph.invoke({}, config={"configurable": {"thread_id": run_id}})` with a targeted start node, but requires careful state management to avoid corrupting other sections. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-agent enable/disable toggle | "Skip the DesignAgent for a fast test run" | Medium | `agents.enabled` flag. Pipeline checks this at graph build time (similar to existing `DESIGNAGENT_SUPPRESSED` env flag, but DB-driven). |
| Run history with trigger source (scheduled / manual / re-roll) and who triggered it | Audit trail for understanding automation behavior | Low | `runs.trigger_source` field + `runs.triggered_by` (user ID or "scheduler"). Already partially covered by audit log (Group 9). |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Killing the Railway cron service via the dashboard | Railway cron cannot be started/stopped via a simple webhook call — requires Railway CLI or console. | Kill switch is data-level: `schedule_enabled=false` makes the tick a no-op. The cron service keeps running (harmless). |
| Auto-retry on cancel | Cancellation is a deliberate operator action. Auto-retry after cancel defeats the purpose. | Require explicit manual trigger to start a new run after cancellation. |
| Run queuing / concurrency | The pipeline is single-issue-at-a-time by design. Queueing multiple runs would require significant orchestration and creates editorial confusion (which issue is "this week's"?). | Enforce at most one active run: `POST /pipeline/run` returns 409 if a run is already in state `running`. |

### Dependencies on Existing Code

- `api/runs.py::POST /run/weekly` — the existing trigger endpoint. Dashboard wraps this.
- `graph/builder.py` — the compiled LangGraph. Re-roll requires invoking it with a specific start node.
- `graph/checkpointer.py` — Railway Postgres checkpointer. Re-roll reads checkpoint state from here.
- `DESIGNAGENT_SUPPRESSED` env flag — the DB-driven per-agent enable toggle should eventually replace this.
- `cost.py` soft-cap warn — hard-stop cancel should be triggered by the budget cap logic here.

---

## Feature Group 5 — Live Run Observability via Convex Subscriptions

### What It Is

A real-time dashboard view of a running pipeline: each agent lights up as
queued → running → done / failed; live token and cost accrual; latency per
agent; per-agent input/output capture; full run history with status, cost,
and config snapshot.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Agent status progression (queued → running → done → failed) | Operators need to know which agent is running and how long it has been running | Medium | Convex `deliberationEvents` already streams agent events. A new `agent_runs` table (or richer event types in `deliberationEvents`) should carry `status`, `started_at`, `completed_at`, `tokens_in`, `tokens_out`, `usd`. Pipeline emits these via `convex_mutation` at agent start and end. |
| Live token/cost accrual | "How much has this run cost so far?" | Medium | The current model accumulates per-agent cost in memory (`cost.py`) and persists at pipeline end. For live display, the pipeline must emit intermediate cost events to Convex as each agent completes. |
| Agent latency | "Why did the Scout take 45 seconds?" | Low | `agent_runs.duration_ms` — captured by wrapping the agent call with `time.monotonic()`. |
| Per-agent input/output capture | "What did the Advocate receive and what did it return?" | Medium | Input/output are LangGraph state slices. Capturing them requires serializing the relevant state fields before and after each node. Storage concern: verbose for multi-KB outputs. Consider storing only the output (input is derivable from prior outputs). |
| Run history list (status, trigger source, duration, cost, config snapshot link) | Operators need to understand pattern over time | Low | Query `runs` table. Most data already exists in Convex `pipelineRuns`. |
| Error + retry surfacing | "The Scout failed — why?" | Medium | Agents have a retry-once-then-fail path in `acomplete`. Errors should be emitted to Convex with the exception message (not the full traceback — security). |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Estimated time remaining | "Based on trailing averages, this run has ~8 minutes left" | Medium | Average agent latencies from prior runs, sum remaining agents. |
| Side-by-side input/output diff vs prior run | "What changed in Scout's output between Issue 12 and 13?" | High | Not at launch. Requires storing full agent I/O, which has storage cost. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Per-call LLM streaming to the dashboard | A single `acomplete` call may make 3-5 token-streaming rounds. Piping raw token streams to Convex would flood it. | Surface per-agent completion events, not per-token events. |
| Storing full LLM input/output for all runs | Storage grows unboundedly; section content can be over 2 KB per agent. | Store output only (not input); implement a retention policy (e.g., keep last 12 runs' I/O). |

### Dependencies on Existing Code

- Convex `deliberationEvents` table — already receives agent events. May need new event types or a dedicated `agent_runs` table for the structured start/complete/error pattern.
- `acomplete()` in `openrouter_client.py` — already emits cost per call. Adding a Convex mutation call here (agent_start / agent_complete events) is the injection point.
- `pipelineRuns` Convex table — already has `status`, `cost`, `durationMs`. Add `configSnapshotId` reference.

---

## Feature Group 6 — Human Review Gate + Claims/Fact-Check Gate

### What It Is

When `require_review = true` (the default), a finished run lands in
`awaiting_review` instead of auto-publishing. The dashboard presents a full
preview of the generated issue, the deliberation trail, cost, and a list of
flagged claims (numbers, names, dates). The operator chooses: approve &
publish, approve & schedule for a future date, re-roll a specific section,
or reject the entire run.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| `awaiting_review` landing state | Without this, the feature does not exist. | Low | Already partially implemented: pipeline publisher sets `pipelineRuns.status = "awaiting-review"` (Convex) after writing draft to Sanity. The brief makes this the explicit trigger for the review gate. |
| Issue preview in the dashboard | Operator needs to read the generated content before approving | Medium | Render the Sanity draft (fetch by `weeklyIssue._id`, status='draft') inside the dashboard. The same GROQ queries used by the public site work here — just target the draft document. |
| Approve & publish action | One-click path from review to live | Medium | `POST /issues/{id}/publish` triggers Publisher agent (or calls the existing Sanity publish + Vercel deploy hook path). The current flow is Andrew flips status in Sanity Studio; this replaces that with a dashboard action. |
| Approve & schedule action | "Approve but publish Thursday at 9am" | Low | `POST /issues/{id}/schedule` with a `publish_at` timestamp. The Publisher agent (or a Convex scheduled function) fires at that time. |
| Reject run | "This is not good enough — discard and re-run" | Low | Sets run status to `rejected`. Operator can trigger a new run. |
| Re-roll individual section from review | "Approve everything except the FounderBio — re-run just that agent" | High | Same as single-agent re-roll (Group 4). Surface it from the review UI with one-click per section. |
| `require_review` / `auto_publish` config flags | Operator can opt out of manual review for fully automated publish | Low | `pipeline_config.require_review` (default true) and `auto_publish` (default false). When both are set correctly, the pipeline auto-publishes on completion. |

### Claims/Fact-Check Gate

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Claim extraction (numbers, dates, named entities, URLs) | Surface verifiable facts for human sign-off | Medium | Extract with a simple regex / NLP pass over the generated content (no LLM call needed for extraction; just highlight). The dashboard presents them as a checklist. |
| Human sign-off checklist on extracted claims | Makes the "100% human-reviewed" promise auditable | Low | Checkboxes per claim; must be fully checked before approve & publish is enabled (or a soft warning if unchecked). |
| Optional web-search verification of claims | "Is this charity's founding year correct?" | High | Requires a Tavily/Brave search call per claim. Very high cost and latency for potentially dozens of claims per issue. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Auto-approve based on QA agent score | The QA agent already runs in the pipeline and its score is a soft signal, not a publish gate. Auto-approving on QA score would defeat the purpose of the human review gate. | Use QA corrections as context in the review UI (show severity counts), not as a gate condition. |
| Replacing Sanity Studio as the editorial tool | Andrew's Sanity Studio access is the fallback for any dashboard failure. The dashboard ADDS a publish path; it does not REMOVE the Sanity one. | Keep the Sanity publish path alive in parallel. The dashboard `POST /issues/{id}/publish` should call the same underlying mechanism. |
| Web-search verification by default | High latency, API cost, and false negatives. Automated fact-checking of charity founding stories against the web is unreliable. | Make web-search verification an opt-in button per claim, not the default flow. |

### Dependencies on Existing Code

- `publisher/__init__.py` — the Publisher agent already handles PDF generation + Vercel deploy + Convex status update. `POST /issues/{id}/publish` should invoke this agent or call the same sequence.
- Convex `pipelineRuns.status = "awaiting-review"` — already set. The dashboard subscribes to this status to show the review queue.
- Sanity draft document (`weeklyIssue.status = 'draft'`) — the preview renders this via GROQ.
- `qaCorrections` Convex table — already populated. Surface severity counts in the review UI.

---

## Feature Group 7 — Charity Registry with Dedup

### What It Is

A registry of all charities the Scout has ever considered, with status
(`candidate / featured / blocklisted`) and metadata to prevent featuring the
same charity twice. The Scout checks this registry before proposing candidates.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Registry table (`name`, `slug`, `website`, `status`, `times_featured`, `last_featured_at`, `dedup_key`) | Without this, the Scout has no memory of prior charities | Medium | Convex `charities` table (or a new Convex table — `pitchLog` exists but is per-run, not a persistent registry). The `dedup_key` should be a normalized version of the charity name or website domain. |
| Status transitions (`candidate → featured`, `candidate → blocklisted`, `featured → blocklisted`) | Operator needs to blocklist a charity (e.g., discovered fraud) | Low | Simple status update via dashboard UI. |
| Scout integration — check registry before proposing | Prevents re-featuring or proposing blocklisted charities | Medium | The Scout agent must call the registry API (Convex query) during its web search loop. Currently the Scout writes to `pitchLog` but does not read from a persistent registry. |
| Dashboard charity list view (searchable, filterable by status) | Operator needs to manage the registry | Low | Simple CRUD UI over the `charities` Convex table. |
| Auto-promote featured charity from `candidate` on issue publish | When an issue goes live, the winning charity's registry entry should update to `featured` | Low | Triggered from the publish action (Group 6). |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Similarity dedup (fuzzy name match) | Catches "Quiet Foundation" vs "The Quiet Foundation" | Medium | Normalized string comparison or Levenshtein distance at insert time. Warn the Scout when a proposed charity is within N characters of an existing registry entry. |
| Import existing charity data from Sanity | `charity` documents already exist in Sanity (the canonical content store). Backfill from there. | Low | Seed script: fetch all Sanity `charity` docs, insert into registry with `status = 'featured'` and `times_featured = 1`. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Duplicating charity content in the registry | Sanity is the canonical store for charity editorial content (name, slug, mission statement, etc.). The registry is operational metadata only (status, times_featured, dedup_key). | Registry holds operational fields only. Charity editorial content stays in Sanity. Link by charity slug. |
| LLM-powered dedup | Too expensive and non-deterministic for a simple uniqueness check. | Normalized string comparison (lowercase, strip "The", strip punctuation) covers 95% of cases. Flag remainder for human review. |

### Dependencies on Existing Code

- Sanity `charity` documents — backfill source for existing charities.
- Convex `pitchLog` table — per-run Scout candidates. The persistent registry is a different concern (cross-run memory) but should be seeded from `pitchLog` history.
- `agents/scout.py` — must be modified to query the registry before proposing candidates.

---

## Feature Group 8 — Donation Reconciliation Per Issue

### What It Is

Pull Stripe payment data for the window of each issue (from publish date to
next issue's publish date) → gross revenue, Stripe fees, net-to-charity.
Make the "100% of proceeds" promise auditable with a per-issue ledger.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Per-issue revenue window (gross, fees, net) | The core accountability feature — "we raised $X for Charity Y in Issue Z" | Medium | Use Stripe Read API (list `PaymentIntents` or `Charges` filtered by date range). Stripe fee is ~2.9% + $0.30 per transaction. Net = gross minus fees. |
| Payout tracker (payout status, payout date, amount) | "Did we actually send the money?" | Medium | Manual entry initially (no Stripe payout API for charity disbursement — that is a separate bank transfer). Dashboard shows a payout record with status (pending/sent/confirmed) and operator-entered confirmation. |
| Per-issue donation summary on the public site | "This issue raised $X for [Charity]" — a trust signal | Medium | Read from the reconciliation table; surface on the issue page and charity page. |
| Historical reconciliation view | Cumulative totals across all issues | Low | Sum across all per-issue records. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Automated Stripe data pull on issue publish | Zero manual data entry for revenue figures | Medium | Webhook or scheduled job pulls Stripe data for the closed window when the next issue publishes. |
| Exportable reconciliation CSV | Useful for accounting and charity reporting | Low | Standard CSV export of the reconciliation table. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Automated bank transfer to charity via Stripe Connect | Stripe Connect (charity as recipient) requires charity onboarding, KYC, significant legal/compliance work. Not appropriate for a v2 build. | Manual payout: operator does the bank transfer, records confirmation in the dashboard. |
| Real-time revenue display on the public site | Exposes live Stripe data to the public; security and accuracy risks (disputes, refunds). | Show reconciled figures only after the issue window closes and figures are finalized. |

### Dependencies on Existing Code

- Stripe SDK — already present in `apps/web`. Reconciliation reads from Stripe via the server-side secret key.
- Convex `stripeOrders` table — already records orders per issue. This is the source for item count; Stripe is the source for revenue figures.
- Sanity `weeklyIssue.pipelineMetadata` — cost data lives here. Reconciliation data can live alongside it or in a new Convex/Postgres table.

---

## Feature Group 9 — Audit Log

### What It Is

An immutable record of every operator action: who changed which prompt, who
approved which issue, who flipped the kill switch, with before/after values
for edits.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Audit log table (`actor`, `action`, `entity_type`, `entity_id`, `before`, `after`, `timestamp`) | Accountability for every consequential action | Low | Append-only. Never deleted. `before`/`after` as JSON strings for prompt edits. |
| Logged actions: prompt version activate/rollback, kill switch toggle, issue approve/reject/schedule, charity status change, payout record edit | These are the consequential actions | Low | Each dashboard action calls `auditLog.insert` after the primary mutation. |
| Dashboard audit log view (filterable by actor, action type, date range) | Operators need to investigate "who did what when" | Low | Simple query UI over the audit log table. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Audit log alerts ("someone deactivated the kill switch") | Notify Andrew when a sensitive action is taken | Low | Combine with notification system (Group 10). |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Logging pipeline internal agent calls to the audit log | Agent LLM calls are not operator actions. The audit log is for human decisions, not machine events. | Keep agent events in `deliberationEvents`; keep operator decisions in the audit log. |
| Mutable audit log | Defeats the purpose. | Append-only. No update or delete endpoints for audit log rows. |

### Dependencies on Existing Code

- Convex — natural home for the audit log (real-time, schemaful). Or Postgres if stronger persistence guarantees matter more than real-time reactivity.
- All Group 2 (prompt versioning) and Group 4 (run control) actions must call audit log insert as an atomic companion.
- Dashboard auth (new, greenfield) — audit log entries require an authenticated actor ID.

---

## Feature Group 10 — Notifications

### What It Is

Operator-directed alerts for key pipeline events: run complete, run failed,
awaiting review, budget threshold crossed.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Run complete notification | "The Thursday issue is ready to review" — Andrew's primary workflow trigger | Low | Email (via Resend — already wired for the post-purchase email flow) or Slack webhook. |
| Run failed notification | "Something went wrong — check the logs" | Low | Same channels. Include run ID and first error message. |
| Awaiting review notification | Redundant with run complete (if `require_review=true`, complete → awaiting review), but should fire when the review queue has been waiting over N hours | Low | Reminder notification if Andrew has not reviewed within a configurable window. |
| Budget threshold notification | "You have reached 80% of your monthly budget" | Low | Already partially wired: the 70% soft-cap warn in `cost.py:244-261` fires a fire-and-forget Convex event. Hook a notification to this event. |
| Notification channel config in dashboard | Operator sets their Slack webhook URL / email address without touching env vars | Low | `pipeline_config.notification_email`, `notification_slack_webhook`. |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-event notification opt-in/opt-out | Operator chooses which events generate notifications | Low | Boolean flags per event type in `pipeline_config`. |
| Mobile push (PWA) | Dashboard-as-PWA with push notifications | High | Not at launch. Email + Slack covers the use case. |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| SMS notifications | High cost, carrier complexity, regulatory overhead for a single-operator tool. | Email + Slack covers all meaningful notification needs. |
| Notification digest (batch multiple events) | Andrew needs to act on each notification individually. Batching delays critical alerts (run failed). | Send immediately, one event per notification. |

### Dependencies on Existing Code

- Resend API key + `@eisenbalm/emails` package — already present for post-purchase emails. The same Resend client can send notification emails using a simple transactional template.
- `cost.py:244-261` — the 70% cap warn already fires a Convex event. Add a notification trigger here.
- Convex `pipelineRuns.status` — already updated at run complete/fail/awaiting-review. Convex scheduled functions or webhook triggers are the notification dispatch mechanism.

---

## Feature Group 11 — Foundation: Auth + Workspace Scoping

### What It Is

The dashboard requires authenticated access (Andrew is the only user today).
Auth must be built from zero — no existing auth layer. `workspace_id` must be
threaded through all new tables from day one so the control plane can later
be productized into multi-tenant SaaS.

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Dashboard auth (login, session, protected routes) | Without auth, anyone with the URL can trigger pipeline runs or rollback prompts | Medium | Greenfield. Clerk is the brief's TBD option. Auth.js is the alternative. Single user (Andrew) initially — simple email/password or magic link is sufficient. |
| `workspace_id` on all new tables | Multi-tenant bones from day one per brief §6 and §8 decision | Low | All new DB tables (agents, prompt_versions, pipeline_config, runs, charities, model_pricing, review_actions, audit_log) carry `workspace_id`. Single workspace now — scoping is a field, not a schema change. |
| `workspaces` + `users` tables | Foundation for multi-tenant; used from the first day even with one row each | Low | Single workspace: `{ id: "eisenbalm", name: "The Eisenbalm Dispatch" }`. Single user: Andrew. |
| Per-workspace secrets store | Route API keys through a secrets table instead of scattered env vars | Medium | `workspace_secrets` table: `workspace_id`, `key_name`, `encrypted_value`. Dashboard lets operator set/rotate keys via UI. Pipeline reads from secrets table at run start. Encryption at rest required (AES-256 or provider-managed). |

### Anti-Features

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Building multi-tenant UI now | Brief is explicit: single-tenant first. Building multi-user, multi-workspace UI is premature. | Thread `workspace_id` through data; the UI stays single-workspace for v2. |
| Eisenbalm-specific logic in the control plane | Brief §6: "no hardcoded 'eisenbalm' strings or charity-specific logic in the control plane." | The control plane should treat "weekly editorial issue pipeline with charity" as a generic configuration, not hardcode any Eisenbalm specifics. |

### Dependencies on Existing Code

- `dispatch-control` Next.js app — new, greenfield. Auth is the first thing to build.
- Railway FastAPI — must validate dashboard auth tokens for protected endpoints (manual trigger, re-roll, cancel). The existing `X-Pipeline-Trigger-Secret` header approach can be extended.
- Convex — workspace-scoped queries require `workspace_id` filter on every table. `@eisenbalm/convex` package will need schema additions.

---

## MVP Recommendation

Build in this order (mirrors the brief's Phase 1-6, with one reordering):

**Phase 1 — Foundation + Read-Only Dashboard**
Prioritize: DB-backed config (loader swap + 12-file migration + snapshot), `dispatch-control` app shell, auth, read-only dashboard (pipeline graph, run history, live run view via Convex subscriptions, cost roll-ups from existing data).
Defers: All write operations (prompt editing, run control, review gate).

**Phase 2 — Prompt Editing + Versioning**
Prioritize: Prompt editor with variable hints, version save/activate/rollback, diff view, audit log on prompt changes.
Defers: Single-agent test-run (highest-complexity feature in this group).

**Phase 3 — Run Control**
Prioritize: Manual trigger UI, kill switch toggle, schedule editor, cancel in-flight.
Defers: Single-agent re-roll (highest-complexity feature overall — requires LangGraph checkpoint manipulation).

**Phase 4 — Review Gate + Charity Registry**
Prioritize: `require_review` flow (awaiting_review queue, issue preview, approve/reject/schedule), claims checklist.
Defers: Web-search claim verification (opt-in button only), re-roll from review (blocked on Phase 3 re-roll completion).

**Phase 5 — Money + Notifications**
Prioritize: Stripe reconciliation per issue, payout tracker, notifications (email + Slack).
Defers: Public reconciliation display on issue page (needs design).

**Phase 6 — Productization**
Prioritize: Workspace scoping audit, per-workspace secrets store, de-Eisenbalm-ification audit.
Defers: Graph editor UI (explicitly out of scope for v2).

### Feature Complexity Summary

| Feature Group | Complexity | Risk | Phase |
|---------------|------------|------|-------|
| DB config + snapshots | High (loader swap + migration) | High (pipeline breaks if DB unreachable) | 1 |
| Auth + workspace scoping | Medium | Medium (greenfield, standard patterns) | 1 |
| Read-only dashboard + cost roll-ups | Low (surfacing existing data) | Low | 1 |
| Prompt versioning + editor | Medium | Low | 2 |
| Single-agent test-run | High | Medium (LangGraph partial invocation) | 2 |
| Manual trigger + kill switch | Low | Low | 3 |
| Cancel in-flight | Medium | Medium (async task cancellation) | 3 |
| Schedule editor | Medium | Low (data-level; Railway cron unchanged) | 3 |
| Single-agent re-roll | High | High (checkpoint manipulation) | 3 |
| Review gate (require_review flow) | Medium | Low | 4 |
| Claims/fact-check gate | Medium | Low | 4 |
| Charity registry + dedup | Medium | Low | 4 |
| Stripe reconciliation | Medium | Low | 5 |
| Notifications | Low | Low | 5 |
| Productization / workspace audit | Low | Low | 6 |

### Features That Are Mostly Already Done

| Feature | Status | Remaining Work |
|---------|--------|----------------|
| Per-call cost capture | DONE (`acomplete` → `cost.py`) | Zero new instrumentation. Only display/roll-up work. |
| `awaiting_review` status on pipeline completion | DONE (publisher sets it in Convex) | Wire the dashboard to subscribe to this status. |
| File-externalized prompts | DONE (12 `.md` files) | Loader swap + versioning layer + 12-file DB migration. |
| 70% budget soft-cap warn | DONE (`cost.py:244-261`) | Hook a notification to the existing Convex event. |
| Agent event streaming to Convex | DONE (`deliberationEvents`) | New `agent_runs` event types for structured start/complete/error. |

---

## Sources

- `docs/MISSION_CONTROL_BRIEF.md` — §1 (five asks), §3 (feature spec A-E), §4 (additions 1-7), §5 (data model), §7 (build phases)
- `docs/CURRENT_STATE.md` — Q1 (prompts), Q2 (pipeline trigger), Q4 (cost capture), Q5 (auth)
- `.planning/PROJECT.md` — validated requirements, out-of-scope constraints
- `packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py` — loader implementation (lines 49-70)
- `packages/pipeline/src/eisenbalm_pipeline/lib/cost.py` — cost capture and soft-cap warn (lines 83-109, 244-261)
- `packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py` — per-call cost in `_usage_from_message()` (lines 112-128)
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` — cost persistence (lines 59-77)
- `convex/schema.ts` — existing Convex table schemas
