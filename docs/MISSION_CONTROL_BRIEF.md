# The Eisenbalm Dispatch — Mission Control Dashboard
### Build Brief & Claude Code Handoff

> **Purpose:** A no-code control plane for the entire Dispatch agent pipeline. A non-technical operator can edit every agent's prompt, watch and control weekly issues, see exactly what each run costs, pause the automation, and approve issues before they go live. Designed from day one to be extractable into a standalone SaaS product.

> **Status note (added 2026-06-21):** This is the canonical spec for milestone **v2.0 (Mission Control Dashboard)**. Phase 0 of this brief was completed as quick-task `260621-fi4` — see `docs/CURRENT_STATE.md` for the codebase reconciliation. The four §8 decision forks were resolved with the user: **single-tenant + multi-tenant bones**, a **separate `dispatch-control` Next.js app**, **`require_review` default-on**, and a **Railway-cron scheduler** gated by a `schedule_enabled` kill switch.

---

## 0. Read this first (Claude Code: Phase Zero) — DONE

Phase 0 is complete. See `docs/CURRENT_STATE.md`. Headline reconciliations:

- **Prompts are already file-externalized** — 12 `.md` files loaded at runtime by `packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py::load_prompt()` via `importlib.resources`. So "externalize prompts into a DB" is a **loader swap + versioning + migration of 12 files**, NOT inline-string extraction.
- **Pipeline orchestration:** LangGraph in `graph/builder.py`, triggered by FastAPI `POST /run/weekly` (secret-guarded). The weekly cron CLI (`cli.py::trigger_weekly`, `0 14 * * 4`) is coded but the Railway cron service is **not provisioned** — runs are effectively manual today. No GitHub Actions, no Vercel cron.
- **Content lands split:** Sanity (canonical published content), Convex (deliberation events + run metadata/cost), Railway Postgres (LangGraph checkpointer; `SUPABASE_POSTGRES_URL` is a misnomer pointing at Railway after the Supabase project was deleted 2026-06-12).
- **Cost capture already exists** and is NOT fire-and-forget — per-call OpenRouter tokens+USD in `acomplete`, accumulated per-agent, persisted at pipeline end to Convex `pipelineRuns.cost`/`durationMs` and Sanity `pipelineMetadata.cost`.
- **Frontend auth is zero** — no middleware, no provider, no session; only Stripe checkout/webhook + email-unsubscribe routes. Dashboard auth is greenfield.

---

## 1. What we're building (the five asks, made precise)

| # | Ask | Precise requirement |
|---|-----|--------------------|
| 1 | Control all the agents | Every agent is a first-class object with editable config (prompt, model, temperature, on/off), shown in a dashboard that mirrors the real pipeline graph. |
| 2 | Non-coders edit prompts | Prompts live in a database, not code. Editing happens in a UI with variable hints, a test-run button, versioning, and one-click rollback. The pipeline loads prompts from the DB at runtime. |
| 3 | See spend per run | Every LLM call is metered (tokens × current model price). Cost rolls up per agent → per run → per issue → per week/month, with budget caps and alerts. |
| 4 | Manually control weekly issues | Trigger an issue on demand, re-roll individual agents, edit/approve before publish, schedule or unschedule, cancel an in-flight run. |
| 5 | Stop it running automatically | A master kill switch the scheduler checks before every tick, plus per-run cancel. Automation is *opt-in*, observable, and instantly pausable. |

**North star:** this should feel like a premium product, not an internal tool — because it may become one (see §6).

---

## 2. The one architectural decision everything depends on

**Externalize the pipeline configuration out of code and into a database.**

- **Prompts, model choices, temperatures, the agent graph, and the schedule** all become rows the dashboard writes and the pipeline reads at runtime.
- At the **start of every run**, the pipeline takes a **snapshot** of the active config and stores it on the run record. Each run is reproducible (you know which exact prompt produced which issue), and a mid-run edit can never corrupt a running issue.
- Editing a prompt **never overwrites** — it creates a new version. "Activate" flips which version is live.

> **Reconciliation note:** prompts are already files, not inline strings (Phase 0). The work here is a DB-backed loader + run-snapshot + versioning, plus migrating the 12 existing `.md` files into the store.

---

## 3. Feature specification

### A. Agent control & prompt editing
- Dashboard renders the pipeline as the real graph (Scout → Advocate/Editor deliberation → content generators). Each node is a card.
- Per agent: editable **system prompt** + **user-prompt template**, **model** picker, temperature, max tokens, enabled toggle, description.
- **Variable awareness:** the editor highlights available template variables and warns on unknown ones.
- **Test-run a single agent** against a sample or previous real input, see output + cost, without running the whole pipeline. Prioritize it.
- **Versioning:** every save = new version with author + timestamp + optional note. Diff any two versions. One-click rollback / activate.

### B. Cost & spend observability
- A `model_pricing` table (model → input/output price per 1M tokens), **editable from the dashboard**.
- Instrument **every** LLM call (model, tokens, cost, latency, agent, run). (LangGraph callback/handler is the clean injection point — partly done already.)
- Roll-ups: per agent → per run → per issue → per week/month.
- **Budget controls:** monthly cap, per-run cap, alert thresholds, optional hard stop.
- Projected monthly spend from schedule + trailing average run cost.

### C. Run control (manual issues, scheduling, kill switch)
- **Manual trigger:** "Run a new issue now" → `POST /pipeline/run`.
- **Master kill switch:** a single `schedule_enabled` flag. The scheduler calls `/pipeline/tick` which **checks this flag first and no-ops if off.** Control from data, not by disabling the cron.
- **Schedule editor:** cadence (day/time), pause/resume, next run, timezone explicit.
- **Cancel in-flight:** `POST /runs/{id}/cancel`.
- **Re-roll:** re-run a single agent within an existing issue.

### D. Live run observability
- Real-time run view: each agent lights up (queued → running → done/failed), live token/cost accrual + latency. **Convex subscriptions** are ideal.
- Full run history with status, trigger source, who triggered it, duration, cost, config snapshot.
- Per-agent input/output capture, error + retry surfacing.

### E. Content & charity management
- **Charity registry**: `candidate / featured / blocklisted`, `times_featured`, `last_featured_at`, dedup key. Scout checks this.
- **Issue lifecycle:** `draft → in_review → scheduled → published → archived`, as a board.
- Edit any generated section before publish (edit logged).

---

## 4. Additions (each addresses a real risk in this system)

1. **Human-in-the-loop review gate (highest priority).** `require_review` mode: a finished run lands in `awaiting_review`; the dashboard shows a rendered preview + deliberation + cost + flagged claims; operator chooses approve & publish / approve & schedule / re-roll / reject. `auto_publish` is explicit and off by default.
2. **Fact-check / claims gate.** Surface every number/name/date as a checklist for human sign-off before publish (optionally web-search-backed).
3. **Donation reconciliation per issue.** Pull Stripe per issue window → gross / fees / net-to-charity, payout tracker. Makes the "100% of proceeds" promise auditable.
4. **Reproducibility snapshots.** (See §2.) Each run stores the exact prompts/models used.
5. **Audit log.** Who changed which prompt, approved which issue, flipped the kill switch — with before/after.
6. **Notifications.** Slack/email on run complete, failed, awaiting review, budget threshold.
7. **Secrets handling.** Route API keys through a proper secrets store, not scattered env strings (needed for §6 per-workspace keys).

---

## 5. Technical architecture

**Where it lives.** A separate `dispatch-control` Next.js app (decision locked) — cleaner auth boundary + extraction path. Share types/schema with the existing frontend.

**Stack:**
- **Frontend:** Next.js + Vercel. Auth on the admin app from day one (greenfield — Clerk/Auth.js TBD).
- **Real-time + dashboard state:** Convex (runs, agent_runs, config, live progress).
- **Pipeline:** existing FastAPI + LangGraph on Railway, modified to (a) load config from DB at run start, (b) snapshot it onto the run, (c) emit per-agent progress + cost via a LangGraph callback handler, (d) check the kill switch before scheduled ticks.
- **Published content:** Sanity stays the publish target.
- **Commerce:** Stripe read API for reconciliation.

**Data model (Convex documents or Postgres tables):**
`agents` · `prompt_versions` · `pipeline_config` (incl. `schedule_enabled` kill switch, `auto_publish`, `require_review`) · `runs` (incl. `config_snapshot`) · `agent_runs` · `issues` · `charities` · `model_pricing` · `review_actions` · `audit_log` · `workspaces`/`users` (present from the start, single workspace).

**API surface (FastAPI additions):**
`POST /pipeline/run` · `POST /pipeline/tick` (checks `schedule_enabled` first) · `POST /runs/{id}/cancel` · `POST /agents/{key}/test-run` · `POST /issues/{id}/agents/{key}/rerun` · `POST /issues/{id}/publish` and `/schedule` · `GET` roll-ups + charity registry · config/prompt CRUD (or via Convex directly, pipeline reading the same store).

---

## 6. Productization path (single-tenant first, multi-tenant-ready bones)

- **Thread a `workspace_id` through everything now,** even with one workspace.
- **No hardcoded "eisenbalm" strings or charity-specific logic in the control plane.** Mental model: "a configurable graph of agents that produces a scheduled content artifact."
- **Treat the agent graph as config**, not just prompts (store the graph as data; no graph editor UI now).
- **Per-workspace API keys (BYO keys)** — hence the secrets store in §4.7.
- **Usage metering doubles as the billing meter** when productized.

---

## 7. Build phases

- **Phase 0 — Reconcile.** ✅ DONE (`docs/CURRENT_STATE.md`).
- **Phase 1 — Externalize config + read-only dashboard.** DB-backed config the pipeline loads + snapshots per run; LangGraph callback for tokens/cost (mostly exists); read-only dashboard (graph, run history, live run view, cost roll-ups). Foundation + biggest chunk.
- **Phase 2 — Prompt editing + versioning.** Editor with variable hints, save-as-new-version, diff, rollback, single-agent test-run. Audit log on every change.
- **Phase 3 — Run control.** Manual trigger, kill switch + scheduler tick check, cancel in-flight, schedule editor, single-agent re-roll. Budget caps + alerts.
- **Phase 4 — Review & publish workflow.** `require_review`/`auto_publish`, full preview, approve/schedule/reject/re-roll, claims/fact-check gate, charity registry + dedup.
- **Phase 5 — Money & polish.** Stripe donation reconciliation per issue, notifications, cost dashboard polish, projected spend.
- **Phase 6 — Productization prep.** Workspace scoping audit, per-workspace secrets, de-Eisenbalm-ify the control plane, graph-as-data.

---

## 8. Decisions (RESOLVED 2026-06-21)

1. **Productization timing** → **Single-tenant first with multi-tenant bones.** Thread `workspace_id`; no Eisenbalm-specific control-plane logic.
2. **Dashboard home** → **Separate `dispatch-control` Next.js app** in the monorepo.
3. **Review default** → **`require_review = true` by default.** Auto-publish is opt-in.
4. **Scheduler location** → **Railway cron** hitting `/pipeline/tick` (kill-switch-checked). Phase 0 confirmed nothing is provisioned today; this provisions it.

---

*Canonical v2.0 spec. Reconciled against the live codebase in Phase 0 (`docs/CURRENT_STATE.md`). Pairs with `docs/CLAUDE_CODE_BRIEF.md` (v1.0 product spec) and `docs/API_CONTRACTS.md` (interface boundaries).*
