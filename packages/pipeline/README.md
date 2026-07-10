# packages/pipeline — Eisenbalm Dispatch Pipeline

FastAPI + LangGraph application orchestrating the 14-agent editorial pipeline that produces a weekly issue of The Eisenbalm Dispatch.

**Status:** Phase 4 (Pipeline Skeleton) — all 14 stub agents wired in the brief's exact sequence, three-datastore writes (Sanity draft + Convex events + Supabase checkpoint) verified, and the `interrupt()`/resume cycle proven against Supabase Postgres. Phase 5 will replace the stubs with real LLM-driven agents — no infrastructure changes, only agent function bodies + `lib/openrouter_client.py`.

> **Architecture:** see `.planning/phases/04-pipeline-skeleton/04-CONTEXT.md` and `04-RESEARCH.md`. Contracts are in `docs/API_CONTRACTS.md` (§2 Pipeline → Sanity, §3 Pipeline → Convex, §5 Sanity webhook, §7 LangGraph state).

---

## What this is

The Eisenbalm Dispatch pipeline is a FastAPI service that runs a LangGraph `StateGraph` of **14 agents** — Calibrator → Scout → Advocate → Editor (gate 1, with `interrupt()`) → Researcher → seven parallel section writers (OriginStory, Problem, FounderBio, CaseStudy, Game, Bonus, Design) → QA → Editor (final) → Publisher.

In **Phase 4 the agents are stubs**: each returns a deterministic, structurally valid fixture matching the `DispatchState` contract. No OpenRouter calls, no Tavily searches, no real spend. The skeleton exists so every contract Phase 5+ relies on — the `@agent_node` wrapper, the three-datastore write order, cost/duration tracking, the Editor gate 1 pause/resume — is already proven by an integration test before any real LLM money is spent.

**Phase 5 flips `EISENBALM_STUB_MODE` and fills in the agent bodies.** Nothing else changes.

---

## Prerequisites

- **Python 3.11** (exact — pinned in `pyproject.toml`: `requires-python = ">=3.11,<3.12"`)
- **uv** — modern Python package manager. Install: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **Railway CLI** — `npm i -g @railway/cli` (or use the Railway web UI)
- **A Supabase project** — provisioned by Andrew; see "Deployment" below
- **A Railway project** — provisioned by Andrew; see "Deployment" below
- **Sanity + Convex deployments** — already provisioned in Phases 1 + 3; the pipeline re-uses their env vars

Optional:
- **Docker** — only needed for local Dockerfile builds. Railway builds the Dockerfile remotely from the pushed source.

---

## Environment variables

Copy `packages/pipeline/.env.example` to `packages/pipeline/.env` and fill in real values for local dev (`.env` is gitignored). In Railway, set every var via `railway variables set KEY=VALUE`.

| Variable | Purpose / Where to get it |
|---|---|
| `SUPABASE_POSTGRES_URL` | Postgres DSN for the LangGraph `AsyncPostgresSaver` checkpointer. **MUST be the Supabase session pooler URL (port 5432).** See "Sharp edge" below. Supabase dashboard → Project Settings → Database → Connection string → **Session pooler**. |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL. Shared with `apps/web` — provisioned in Phase 3. Convex dashboard → Settings → URL. |
| `CONVEX_DEPLOY_KEY` | Convex deploy key. Shared with `apps/web` — provisioned in Phase 3. The pipeline calls Convex `POST /api/mutation` with header `Authorization: Convex {key}`. Convex dashboard → Settings → Deploy Keys. |
| `NEXT_PUBLIC_SANITY_PROJECT_ID` | Sanity project ID. Shared with `apps/studio` and `apps/web` — provisioned in Phase 1 (`6h1vd9mf`). |
| `NEXT_PUBLIC_SANITY_DATASET` | Sanity dataset. Defaults to `production`. |
| `SANITY_API_TOKEN` | Sanity **write** token (Editor role) — NOT Studio's read token. Sanity dashboard → API → Tokens → create a token with Editor permissions. |
| `OPENROUTER_API_KEY` | OpenRouter API key. Placeholder OK in Phase 4 (stub mode never calls it). Required in Phase 5. |
| `TAVILY_API_KEY` | Tavily search API key. Placeholder OK in Phase 4. Required in Phase 5. |
| `EISENBALM_STUB_MODE` | `true` in Phase 4 (default if unset). Phase 5 flips the default. Controls whether agents use stub fixtures or real LLM calls. |
| `PIPELINE_TRIGGER_SECRET` | Shared secret required as the `X-Pipeline-Trigger-Secret` header on `POST /run/weekly`, `/run/{runId}/resume`, and `/run/{runId}/publish`. Generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`. When unset locally, the check is skipped (with a logged warning) so local dev works without provisioning it. |
| `PIPELINE_SELF_URL` | Base URL the `trigger-weekly` CLI subcommand POSTs to (its `/run/weekly`). Read **only** by the separate Railway weekly-cron service (V2-03), not the always-on web API. Defaults to `https://eisenbalm-pipeline-production.up.railway.app` when unset; point it at a staging URL to trigger a non-prod deploy. |
| `DASHBOARD_ALLOWED_ORIGINS` | Comma-separated browser origins permitted to make cross-origin (CORS) calls from the dispatch-control dashboard (test-run, scoring, run-control, review). Defaults to `http://localhost:3000` when unset. In Railway, set to the dispatch-control Vercel domain(s). |

### Sharp edge: Supabase pooler mode

The pipeline ONLY works correctly with Supabase's **session pooler** (port **5432**, host `aws-0-<region>.pooler.supabase.com`).

- **Transaction pooler (port 6543)** does NOT support prepared statements and breaks `AsyncPostgresSaver` after the first checkpoint read with `psycopg.errors.InvalidSqlStatementName`.
- **Direct connection** (`db.<ref>.supabase.co:5432`) is IPv6-only; Railway egress is IPv4-only — the direct connection hangs forever on Railway.

```
# CORRECT — session pooler (IPv4-compatible, supports prepared statements)
SUPABASE_POSTGRES_URL=postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require

# WRONG — transaction pooler (breaks AsyncPostgresSaver on the second checkpoint read)
# SUPABASE_POSTGRES_URL=postgres://postgres:<password>@<ref>.pooler.supabase.com:6543/postgres

# WRONG — direct connection (IPv6-only; Railway can't reach it)
# SUPABASE_POSTGRES_URL=postgres://postgres:<password>@db.<ref>.supabase.co:5432/postgres
```

Append `?sslmode=require` — Supabase enforces TLS on the pooler and the explicit flag is harmless. See `.planning/phases/04-pipeline-skeleton/04-RESEARCH.md` §7 + Pitfall 1 + Pitfall 2 for the full diagnosis.

---

## Local development

```bash
cd packages/pipeline
uv sync                       # install Python deps (creates .venv/)
cp .env.example .env          # then fill in real values

# ── Run the FastAPI app locally ──
pnpm --filter pipeline dev    # OR: uv run uvicorn eisenbalm_pipeline.api.main:app --reload
```

`EISENBALM_STUB_MODE` defaults to `true` — local runs use stub fixtures and never touch OpenRouter or Tavily.

The app starts on `http://localhost:8000` and exposes:

| Method | Path | Purpose |
|---|---|---|
| POST | `/run/weekly` | Trigger a new pipeline run. Generates a `runId`, returns `{runId}` within ~1s; the graph runs in a background task. |
| GET  | `/run/{runId}/status` | Read current pipeline state from Convex. |
| POST | `/run/{runId}/resume` | Resume a paused run (after the Editor gate 1 `interrupt()`). Body: `{"selection": {"charityName": "..."}}`. |
| POST | `/run/{runId}/publish` | Manual fallback — Phase 4 stub; Phase 6 wires the real PDF generation. |
| POST | `/webhook/sanity-publish` | Phase 4 stub returning 200; Phase 6 hardens it with HMAC + idempotency. |
| GET  | `/healthz` | Railway healthcheck. Returns `{ok, checkpointer, stubMode}`. |

All routes except `/healthz` and `/run/{runId}/status` require the `X-Pipeline-Trigger-Secret` header (skipped locally when `PIPELINE_TRIGGER_SECRET` is unset).

> If `SUPABASE_POSTGRES_URL` is unset or Supabase is unreachable, the app still boots (with a logged warning) so `/healthz` responds and the test suite imports — but `/run/weekly` and `/run/{runId}/resume` return `503` until the checkpointer is connected.

---

## One-time setup: `setup-checkpointer`

The LangGraph checkpointer tables (`checkpoints`, `checkpoint_writes`, `checkpoint_blobs`, `checkpoint_migrations`) must be created **once per fresh Supabase database** before the first `POST /run/weekly`. The migration is idempotent — safe to run repeatedly.

```bash
# locally, against your .env's SUPABASE_POSTGRES_URL:
pnpm --filter pipeline setup-checkpointer
# OR: uv run python -m eisenbalm_pipeline.cli setup-checkpointer
```

Expected output: `Checkpointer tables created / verified.`

On Railway this runs automatically — `railway.toml` declares `preDeployCommand = ["python -m eisenbalm_pipeline.cli setup-checkpointer"]`, so every `railway up` runs the migration before traffic flows. The manual command above is for local dev and for re-verifying against a fresh Supabase project.

The app **never auto-creates** these tables on startup — the FastAPI lifespan asserts they exist and fails fast with a descriptive error (`Run: python -m eisenbalm_pipeline.cli setup-checkpointer`) if they're missing.

Verify in the Supabase dashboard → Table Editor: 4 tables present (`checkpoints`, `checkpoint_writes`, `checkpoint_blobs`, `checkpoint_migrations`).

---

## Stub mode vs real mode

Phase 4 ships with `EISENBALM_STUB_MODE=true`. Stub agents return deterministic fixtures from `src/eisenbalm_pipeline/stubs/fixtures.py` — no OpenRouter calls, no Tavily searches, no real costs. The same `@agent_node` decorator wraps both stub and real agents (CONTEXT D-15), so **Phase 5 only changes agent function bodies plus `lib/openrouter_client.py`** — not the lifecycle plumbing, the wrapper, the graph, the routers, or the datastore clients.

Phase 5 flips the `EISENBALM_STUB_MODE` default to `false` and adds the real-mode code path inside the OpenRouter client. Agent code never branches on the flag directly — the toggle lives in the client module.

---

## Running tests

```bash
cd packages/pipeline
uv run pytest -v       # full suite
uv run pytest -x       # fail-fast iteration
# OR: pnpm --filter pipeline test
```

The integration tests run in-process via `httpx.ASGITransport` against the real FastAPI app and hit the real production Sanity + Convex. They use unique `issueNumber`s (`999000 + random`) to avoid clobbering the Phase 2 demo issue, and clean up Sanity drafts on teardown.

Tests automatically **skip** with informative messages when required env vars are missing (`SUPABASE_POSTGRES_URL`, `CONVEX_DEPLOY_KEY`, etc.). 9 tests skip without `SUPABASE_POSTGRES_URL` set; they go green once Supabase is provisioned and `.env` is filled in. The suite stays green from a clean checkout — skips are not failures.

---

## Deployment (manual — Andrew runs these)

Railway and Supabase provisioning is **manual**, mirroring the Phase 1 Sanity init and Phase 3 Convex init checkpoints. The steps are documented here; the plan does NOT autonomously provision anything (CONTEXT D-29, D-30).

### 1. Create the Supabase project

1. In the Supabase dashboard, create a new project.
2. Project Settings → Database → Connection string → **Session pooler** tab.
3. Copy the connection string. It looks like `postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`. Append `?sslmode=require`.
4. This value becomes `SUPABASE_POSTGRES_URL` in Railway (next step). **Do not use the transaction pooler or direct connection** — see "Sharp edge" above.

### 2. Create and deploy the Railway service

```bash
cd packages/pipeline

railway init           # create the Railway project, link it to this directory
railway link           # link the local packages/pipeline/ directory to the service

# Set every env var from the table above:
railway variables set SUPABASE_POSTGRES_URL='postgres://...session-pooler...:5432/postgres?sslmode=require'
railway variables set NEXT_PUBLIC_CONVEX_URL=https://...
railway variables set CONVEX_DEPLOY_KEY='prod:...'
railway variables set NEXT_PUBLIC_SANITY_PROJECT_ID=6h1vd9mf
railway variables set NEXT_PUBLIC_SANITY_DATASET=production
railway variables set SANITY_API_TOKEN='sk...'
railway variables set OPENROUTER_API_KEY='sk-or-...'   # placeholder OK in Phase 4
railway variables set TAVILY_API_KEY='tvly-...'        # placeholder OK in Phase 4
railway variables set EISENBALM_STUB_MODE=true
railway variables set PIPELINE_TRIGGER_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"

railway up             # builds the Dockerfile, runs preDeployCommand (setup-checkpointer), starts uvicorn
```

The `preDeployCommand` runs `setup-checkpointer` on every deploy, so once `SUPABASE_POSTGRES_URL` is set the checkpointer tables are created automatically on the first `railway up`. If you need to run it by hand:

```bash
railway run python -m eisenbalm_pipeline.cli setup-checkpointer
```

### Weekly cron trigger (V2-03)

The Thursday 14:00 UTC weekly issue is fired by a **separate Railway service** running:

```bash
python -m eisenbalm_pipeline.cli trigger-weekly
```

on cron schedule `0 14 * * 4` (Thursday 14:00 UTC). This subcommand POSTs an empty JSON body to `{PIPELINE_SELF_URL}/run/weekly` with the `X-Pipeline-Trigger-Secret` header. It exits `0` (printing the returned `runId`) on success and exits nonzero with a stderr message on a missing secret, a non-2xx response, or a network error — so Railway marks the cron run as **failed** and surfaces it.

**Why a SEPARATE service — not a `cronSchedule` on the web API.** A cron job must start, do its work, and **exit**. The always-on web service must **never** exit: it serves traffic and runs the pipeline graph inside long-lived background tasks. Adding a `cronSchedule` to the existing web service's `railway.toml` would convert the always-on API into a cron job and break it — which is exactly why `railway.toml` is intentionally left unchanged.

**Why the cron only FIRES the trigger (POST `/run/weekly`) instead of running the graph inline.** The pipeline pauses at the Editor Gate 1 human gate for potentially hours or days — far longer than a cron job should live. The always-on web service owns the long-lived background graph execution; the cron is a lightweight fire-and-exit trigger.

**Env vars the cron service needs:** `PIPELINE_TRIGGER_SECRET` (the same value the web service validates) and optionally `PIPELINE_SELF_URL` (defaults to the production domain; point it at a staging URL to trigger a non-prod deploy).

**Standing up the cron service is a MANUAL Andrew step** (it requires Railway auth) — out of scope for the code change that added `trigger-weekly`. The rough steps:

1. In the **same Railway project**, create a **new service** from this repo / `packages/pipeline/Dockerfile`.
2. Set its start (cron) command to `python -m eisenbalm_pipeline.cli trigger-weekly`.
3. Set the cron schedule to `0 14 * * 4` (Thursday 14:00 UTC).
4. Set `PIPELINE_TRIGGER_SECRET` (same value as the web service) — and `PIPELINE_SELF_URL` only if the target is not production.

### Build & runtime config

- **`Dockerfile`** — `python:3.11-slim-bookworm`, multi-stage (builder + runtime), `uv`-managed. The WeasyPrint system deps (libpango, libcairo, libgdk-pixbuf, etc.) are pre-installed even though Phase 4 doesn't generate PDFs — this keeps the Dockerfile stable across phases (Phase 6 doesn't have to revisit infra).
- **`railway.toml`** declares: Dockerfile builder, `startCommand` (`uvicorn ... --port $PORT`), `/healthz` healthcheck with 60s timeout, `ON_FAILURE` restart policy (max 3 retries), and the `preDeployCommand` running `setup-checkpointer`.

---

## Andrew's end-of-phase smoke test (Phase 4 acceptance — CONTEXT D-42)

Run this after Railway + Supabase are provisioned and the first deploy succeeded. This is the script Plan 12 follows. If all steps pass, Phase 4 is complete and Phase 5 (Agent Quality) is unblocked.

```bash
# 1. Verify the Supabase checkpointer tables exist
railway run python -m eisenbalm_pipeline.cli setup-checkpointer
# → "Checkpointer tables created / verified."

# 2. Trigger a stub run
RAILWAY_URL="https://your-pipeline.up.railway.app"
SECRET="$(railway variables get PIPELINE_TRIGGER_SECRET)"
curl -X POST $RAILWAY_URL/run/weekly \
     -H "X-Pipeline-Trigger-Secret: $SECRET" \
     -H "Content-Type: application/json" \
     -d '{}'
# → {"runId": "..."}  (within ~1 second)
RUN_ID="<paste runId>"

# 3. Wait ~30 seconds for the stub pipeline to finish

# 4. Read status
curl $RAILWAY_URL/run/$RUN_ID/status
# → {"runId": "...", "status": "awaiting-review",
#    "durationMs": <int>, "completedAt": <ms>,
#    "errorMessage": null, ...}

# 5. In Sanity Studio:
#    - Find the draft issue-999 (or whatever issueNumber you used)
#    - Confirm every section is populated with stub content
#    - Confirm pipelineMetadata.runId == $RUN_ID
#    - Confirm pipelineMetadata.cost is a JSON string with shape {total, agents}

# 6. In the Convex dashboard:
#    - pipelineRuns: 1 row with runId=$RUN_ID, status=awaiting-review, durationMs set, cost set
#    - pitchLog: 3 rows (Scout's 3 candidates)
#    - agentVotes: 3 rows (Advocate scored each candidate)
#    - deliberationEvents: ~12 rows (advocate-argument × 3, editor-decision,
#      section-draft × 7, qa-correction, editor-final, publisher-deploy)
#    - qaCorrections: 0 rows (stub QA records no corrections)

# 7. Run the integration test (cleanup verification)
cd packages/pipeline
uv run pytest -k test_pipeline_e2e -v
# → green

# 8. (Optional) Test interrupt/resume:
curl -X POST $RAILWAY_URL/run/weekly \
     -H "X-Pipeline-Trigger-Secret: $SECRET" \
     -H "Content-Type: application/json" \
     -d '{"forceNoWinner": true}'
# → {"runId": "..."}
RUN_ID_2="<paste runId>"
# wait 5 seconds
curl $RAILWAY_URL/run/$RUN_ID_2/status
# → status: "awaiting-review" (paused at Editor gate 1)
curl -X POST $RAILWAY_URL/run/$RUN_ID_2/resume \
     -H "X-Pipeline-Trigger-Secret: $SECRET" \
     -H "Content-Type: application/json" \
     -d '{"selection": {"charityName": "The Quiet Foundation"}}'
# → {"runId": "...", "resumed": true}
# wait 20 seconds
curl $RAILWAY_URL/run/$RUN_ID_2/status
# → status: "awaiting-review" (final, post-Publisher); durationMs set
```

---

## File layout

```
packages/pipeline/
├── Dockerfile            # Multi-stage, WeasyPrint deps preinstalled
├── pyproject.toml        # uv-managed, pinned deps
├── uv.lock               # committed for reproducible builds
├── railway.toml          # Railway config-as-code
├── .env.example          # env var documentation
├── README.md             # this file
├── src/eisenbalm_pipeline/
│   ├── cli.py            # python -m eisenbalm_pipeline.cli setup-checkpointer
│   ├── api/              # FastAPI app + routers (runs, webhooks, health)
│   ├── graph/            # DispatchState, builder, AsyncPostgresSaver factory
│   ├── agents/           # 14 stub agents + @agent_node wrapper + validate_sections
│   ├── lib/              # sanity_client, convex_client, portable_text, cost, ids
│   └── stubs/            # deterministic fixtures + fake OpenRouter (Phase 5 swap point)
└── tests/                # pytest integration tests (ASGITransport, in-process)
```

---

## Where to look when something breaks

| Symptom | Likely cause | Fix |
|---|---|---|
| `AsyncPostgresSaver tables not found` on startup | One-time setup not run | `railway run python -m eisenbalm_pipeline.cli setup-checkpointer` (or `pnpm --filter pipeline setup-checkpointer` locally) |
| `psycopg.errors.InvalidSqlStatementName` | Pointing at the transaction pooler (port 6543) | Switch `SUPABASE_POSTGRES_URL` to the session pooler (port 5432) |
| Lifespan hangs on `await pool.open()` on Railway | IPv6-only direct Supabase connection | Switch to the session pooler |
| `/run/weekly` returns 503 | Checkpointer not connected — `SUPABASE_POSTGRES_URL` unset or Supabase unreachable | Set the env var; verify the session pooler URL |
| `Convex mutation failed: ArgumentValidationError: cost` | Phase 4 Convex schema patch not deployed | `pnpm --filter @eisenbalm/convex deploy` |
| `pipelineRuns.cost` empty after a run | Cost JSON dropped in transit | Check `lib/cost.py` invariants in `agents/publisher.py` |
| `POST /run/{runId}/resume` returns 409 | Graph not paused — already completed | Trigger a new run; resume cannot un-complete a finished graph |

---

## Cross-references

- `docs/API_CONTRACTS.md` §2 — Pipeline → Sanity (Python write contracts)
- `docs/API_CONTRACTS.md` §3 — Pipeline → Convex (HTTP API)
- `docs/API_CONTRACTS.md` §5 — Sanity → Pipeline (webhook, Phase 6 hardening target)
- `docs/API_CONTRACTS.md` §7 — LangGraph state (`DispatchState` contract)
- `.planning/phases/04-pipeline-skeleton/04-CONTEXT.md` — Phase 4 architectural decisions
- `.planning/phases/04-pipeline-skeleton/04-RESEARCH.md` — pattern walk-throughs + sharp edges
- `convex/README.md` — Phase 3 Convex documentation (sibling — pipeline is the first real caller)
- `convex/README.md` "Deploy parity" — any `module:function` Convex path called from this package must be synced (`pnpm --filter @eisenbalm/convex dev:once`) and verified with `pnpm check:convex-parity` (must exit `0`) before the phase touching it is marked done
- `apps/web/README.md` — Phase 2 Next.js documentation (consumer of Sanity drafts via GROQ)

---

## Phase 5 — Real-Mode Operations

Phase 5 ships the real LLM-driven agents. Stub mode remains available as a fallback for testing.

### Toggle: `EISENBALM_STUB_MODE`

| Value | Behavior |
|-------|----------|
| `false` (default since Phase 5 D-22) | Live OpenRouter + Tavily calls; live Convex + Sanity writes |
| `true` | All LLM/Tavily calls return canned fixtures from `stubs/fixtures.py`; zero token usage; useful for Phase 4 PIP-06 regression smoke |

The toggle is resolved once at the `acomplete` / `web_search` call boundary in `lib/openrouter_client.py` and `lib/search_client.py` — agent code itself never branches on the flag.

### Required environment variables (Phase 5 additions)

Beyond the Phase 4 baseline (above), real mode requires:

| Var | Purpose | Where to set |
|-----|---------|--------------|
| `OPENROUTER_API_KEY` | OpenRouter authentication (Claude routing) | Railway env + `.env` for dev |
| `TAVILY_API_KEY` | Tavily web search (Scout + Researcher) | Railway env + `.env` for dev |
| `PIPELINE_COST_CAP_USD` | Hard per-run cost cap (default: `10.0`) | Railway env; tune after first 5 real runs (see Plan 05-15 Task 3) |
| `PIPELINE_COST_WARN_PCT` | Soft-warn threshold as fraction of cap (default: `0.7`) | Railway env |

`SANITY_API_TOKEN` (Phase 1) and `CONVEX_DEPLOY_KEY` (Phase 3) are unchanged from prior phases. See `.env.example` for the canonical template.

### Running the real-mode test

The real-mode smoke test entrypoint is `tests/test_pipeline_real_mode.py`. It runs the full compiled LangGraph (Calibrator → ... → Editor Final → Publisher) with `EISENBALM_STUB_MODE=false` but with every external integration (`acomplete`, `web_search`, Convex/Sanity HTTP, `verify._fetch_text`) patched to deterministic mocks — no API credit consumed, no live writes.

```bash
cd packages/pipeline
uv run pytest tests/test_pipeline_real_mode.py -x -v
```

This is the mechanical pre-flight that proves:
- every agent runs in the correct order
- `model_versions` is populated for the four voice-critical agents (AGT-17)
- the three-datastore write order holds
- the graph completes without exception under real-mode codepaths

Live-API runs against Railway happen under Andrew's eye (Plan 05-15 Task 3) — not automated.

### Editing the QA rubric (`agents/qa/rubric.md`)

The Layer-2 LLM-as-judge prompt lives at:

```
packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md
```

It is version-controlled plain Markdown. After 3+ real-mode issues, Andrew reviews flagged `qaCorrections` rows and edits the rubric to add forbidden constructs, adjust severity thresholds, or refine the evaluation axes. No code change required — the rubric is loaded from disk on each QA run.

Convention:
- One top-level `## Section` per category (Voice, Forbidden, Evaluation Axes, etc.)
- Andrew is the rubric owner; the agent never edits it
- Edits are committed alongside any related `qaCorrections` analysis

### Per-agent model pinning (AGT-17)

| Tier | Agents | Model |
|------|--------|-------|
| Voice-critical | Calibrator, Editor gate 1, Editor Final, QA | `anthropic/claude-opus-4-7` (pinned) |
| Section writers | OriginStory, Problem, FounderBio, CaseStudy, Bonus, Game, Researcher | `anthropic/claude-sonnet-4-6` (latest alias) |
| Mechanical | Scout, Advocate, DesignAgent | `anthropic/claude-haiku-4-5` (latest alias) |

Resolved model IDs (OpenRouter's snapshot pin, e.g. `anthropic/claude-opus-4-7-20251101`) are accumulated into `state['model_versions']` on every agent call and flushed to `weeklyIssue.pipelineMetadata.modelVersions` (JSON string) at run end — the observability surface for AGT-17.

### Cost observability (D-08)

- Soft alert at `PIPELINE_COST_WARN_PCT` (default 70%) of `PIPELINE_COST_CAP_USD` — emits a Convex `deliberationEvents` row with `eventType='cost-warning'` (one per run).
- Hard halt at 100% raises `CostCapExceeded`; the `@agent_node` wrapper catches and sets `pipelineRuns.status='failed'` with `errorMessage='cost-cap-exceeded: $X.XX of $Y.YY (agent: Z)'`.
- Per-agent cost record (`{tokens_in, tokens_out, usd, duration_ms}` per agent + `total`) flushed to `pipelineRuns.cost` JSON at run end.

### Approved font whitelist (D-16)

DesignAgent picks fonts only from `src/eisenbalm_pipeline/agents/design/font_whitelist.py`. The whitelist is human-curated by Andrew (see Plan 05-15 Task 2 for the approval marker convention); the agent has no override path. Out-of-whitelist outputs trigger one regenerate, then fall back to `FALLBACK_FONT_DISPLAY` / `FALLBACK_FONT_BODY` constants in the same file.

---

## Phase 6 — PDF Generation + Webhook Chain

Phase 6 closes the loop between Andrew publishing in Sanity Studio and a live deployed issue on Vercel:

1. Andrew flips `weeklyIssue.status` from `draft` → `published` in Studio.
2. Sanity fires a webhook to Railway: `POST <RAILWAY_URL>/webhook/sanity-publish`.
3. Pipeline verifies HMAC signature + age + idempotency-key, returns 200 immediately.
4. In the background: GROQ-fetch issue, render Problem Statement PDF with WeasyPrint, upload to Sanity, sleep 30s for CDN propagation, fire Vercel deploy hook.
5. Convex `pipelineRuns.status` → `complete`; `publisher-deploy` event written.
6. Vercel rebuilds the site; reader visiting `/issue/[slug]` sees the new PDF download button.

### Required env vars (Phase 6 additions)

```bash
# Sanity webhook signing secret — see Sanity Studio → API → Webhooks
SANITY_WEBHOOK_SECRET=<32-byte-random>

# Vercel deploy hook URL — see Vercel project → Settings → Git → Deploy Hooks
# CRITICAL: per-environment URLs — staging Railway must NEVER point at the
# production hook (Pitfall 10 in 06-RESEARCH).
VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/<hook-id>
```

The Phase 4/5 env vars are still required (`SUPABASE_POSTGRES_URL`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `SANITY_API_TOKEN`, `OPENROUTER_API_KEY`, `PIPELINE_TRIGGER_SECRET`).

### One-time setup

`railway.toml`'s `preDeployCommand` runs both DDL migrations idempotently on every deploy:

```toml
preDeployCommand = [
  "python -m eisenbalm_pipeline.cli setup-checkpointer",
  "python -m eisenbalm_pipeline.cli setup-webhook-idempotency",
]
```

Local setup mirrors that:

```bash
cd packages/pipeline
uv run python -m eisenbalm_pipeline.cli setup-checkpointer
uv run python -m eisenbalm_pipeline.cli setup-webhook-idempotency
```

### Configuring the Sanity webhook (Andrew, one-time per dataset)

1. In Sanity Studio: **API → Webhooks → Add webhook**.
2. **Name:** `Eisenbalm Publisher` (production) or `Eisenbalm Publisher (dev)` (dev dataset).
3. **URL:** `https://<your-railway-domain>/webhook/sanity-publish`.
4. **Trigger on:** `Create`, `Update` (NOT Delete).
5. **Filter:** `_type == "weeklyIssue" && status == "published"`.
6. **Projection:** `{_id, _type, status, issueNumber, "runId": pipelineMetadata.runId}`.
7. **HTTP method:** `POST`.
8. **HTTP headers:** none required (Sanity automatically sends `sanity-webhook-signature` + `idempotency-key`).
9. **Secret:** generate a 32-byte random string; paste here AND set as `SANITY_WEBHOOK_SECRET` in Railway env.
10. **Save**, then click **"Send test"** — confirm Railway logs show "Webhook scheduled Publisher".

### Manual fallback (WHK-08)

If the Sanity webhook fails to deliver (network blip, secret rotation, etc.), Andrew can trigger the same Publisher chain by hand via the manual fallback endpoint:

```bash
curl -X POST \
  -H "X-Pipeline-Trigger-Secret: $PIPELINE_TRIGGER_SECRET" \
  "https://<your-railway-domain>/run/<runId>/publish"
```

`<runId>` is the `pipelineMetadata.runId` field on the Sanity draft. The pipeline looks up the issue via GROQ filter on `pipelineMetadata.runId == $runId` and runs the same Publisher coroutine the webhook does.

### Expected timings

| Step | Duration |
|------|----------|
| Webhook signature verify + idempotency check | < 50ms |
| GROQ fetch issue from Sanity | 100-500ms |
| WeasyPrint render PDF | 1-3 seconds |
| Sanity asset upload + patch | 500ms-2s |
| CDN propagation sleep | 30 seconds (fixed, WHK-05) |
| Vercel deploy hook POST | 200-500ms |
| Convex updateStatus + publisher-deploy | 100-300ms |
| **Total publisher chain wall-clock** | **~35-40 seconds** |
| Vercel build + deploy after hook fires | 1-3 minutes (visible in Vercel dashboard) |

### Troubleshooting

- **401 on every webhook**: SANITY_WEBHOOK_SECRET mismatch between Sanity and Railway. Regenerate in Sanity dashboard; update Railway env.
- **410 on every webhook**: clock skew. Run `date` on Railway and your dev box; if > 5 minutes off, NTP is broken.
- **PDF renders without theme fonts (DejaVu fallback)**: `FontConfiguration` wasn't passed to `write_pdf` (Pitfall 2) OR the requested font family is not vendored. Check `packages/pipeline/fonts/` and `agents/design/font_whitelist.py`.
- **`problemPdf` field is empty after publish**: check Railway logs for "Publisher: PDF uploaded" — if missing, the chain crashed BEFORE upload. Look for the previous log line to identify the crash point.
- **Vercel deploys but old content shows**: CDN propagation took longer than 30s. Manual refresh after another 30s, OR increase `CDN_PROPAGATION_DELAY_SEC` in `agents/publisher/__init__.py`.
- **Manual fallback returns 404**: no Sanity issue exists with `pipelineMetadata.runId == <runId>`. Either the runId is wrong, or the pipeline never wrote the draft (Phase 4 contract). Inspect Sanity Studio directly.
- **Vercel never receives a deploy after a successful upload**: confirm `VERCEL_DEPLOY_HOOK_URL` is set in Railway env AND points at the *production* hook for the current environment (Pitfall 10) — a stale staging hook will succeed-silently with the wrong project.

### Phase 6 dependencies on Phase 5 carryovers

Phase 5 closed with a known TODO: `langchain-openai` `with_structured_output` does not surface `usage_metadata`, so per-run cost readings are $0 even on real runs. This is NOT blocking for Phase 6 (cost tracking is an ops concern, not a publishing concern), but the carryover stays on the Phase 6 sprint board — see STATE.md Blockers section "[Phase 6 carryover] Fix langchain-openai cost-metadata capture."
