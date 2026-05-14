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
- `apps/web/README.md` — Phase 2 Next.js documentation (consumer of Sanity drafts via GROQ)
