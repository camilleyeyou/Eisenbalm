---
phase: 04-pipeline-skeleton
plan: 11
type: execute
wave: 4
depends_on:
  - "04-09"
  - "04-10"
files_modified:
  - packages/pipeline/README.md
  - apps/web/README.md
  - .env.example
autonomous: true
requirements: []
must_haves:
  truths:
    - "packages/pipeline/README.md is the canonical onboarding doc per CONTEXT D-40 — sections: prerequisites, env vars, local dev, one-time setup-checkpointer, stub-mode toggle, running the integration test, deploy workflow, link to API_CONTRACTS"
    - "Andrew's end-of-phase smoke test sequence from CONTEXT D-42 lives in the README as a copy-paste recipe"
    - "apps/web/README.md Convex section is amended to note CONVEX_DEPLOY_KEY is shared with Railway/pipeline (CONTEXT D-41)"
    - "Root .env.example Phase 4 block is correct (Plan 01 wrote a draft; this plan verifies + finalizes per CONTEXT D-32)"
  artifacts:
    - path: "packages/pipeline/README.md"
      provides: "Canonical onboarding doc"
      contains: "setup-checkpointer"
    - path: "apps/web/README.md"
      provides: "Updated Convex section noting CONVEX_DEPLOY_KEY shared with pipeline"
      contains: "Railway"
  key_links:
    - from: "packages/pipeline/README.md Andrew's smoke test section"
      to: "CONTEXT.md D-42"
      via: "Verbatim 9-step sequence"
      pattern: "setup-checkpointer"
---

<objective>
Rewrite `packages/pipeline/README.md` from the Plan 01 placeholder to the canonical onboarding doc per CONTEXT D-40. Cross-reference from `apps/web/README.md` per CONTEXT D-41. Verify root `.env.example` Phase 4 block (Plan 01 wrote a draft).

Purpose: Operational handoff to Andrew and to future engineers. Plan 12 (Andrew's smoke test) uses the README as the script — if Andrew can complete the 6-step smoke test by following only the README, Phase 4 is done.
Output: Three documentation files updated; no code changes.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-pipeline-skeleton/04-CONTEXT.md
@.planning/phases/04-pipeline-skeleton/04-RESEARCH.md
@packages/pipeline/README.md
@apps/web/README.md
@packages/pipeline/.env.example
@.env.example
@convex/README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Rewrite packages/pipeline/README.md (canonical onboarding doc — CONTEXT D-40)</name>
  <files>packages/pipeline/README.md</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-40 (README sections: prerequisites, env vars table, local dev, one-time setup, stub mode toggle, integration test, deploy workflow, links to API_CONTRACTS §2/§3/§5/§7, Andrew's smoke test)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-42 (Andrew's full 9-step smoke test sequence — copy verbatim into README)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-29, D-30 (Railway + Supabase provisioning steps)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §7 (Supabase session pooler URL format — include WRONG examples as warnings)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §9 (Railway specifics — preDeployCommand, healthcheck timeout)
    - packages/pipeline/README.md (current — Plan 01 placeholder, to be replaced wholesale)
    - apps/studio/README.md (Phase 1 — read for tone / structure precedent)
    - convex/README.md (Phase 3 — read for cross-link style)
  </read_first>
  <action>
    Replace `packages/pipeline/README.md` with the canonical onboarding doc:

    ````markdown
    # packages/pipeline — Eisenbalm Dispatch Pipeline

    FastAPI + LangGraph application orchestrating the 14-agent editorial pipeline that produces a weekly issue of The Eisenbalm Dispatch.

    **Status:** Phase 4 (Pipeline Skeleton) — all 14 stub agents wired, three-datastore writes verified, `interrupt()`/resume cycle proven against Supabase Postgres. Phase 5 will replace stubs with real LLM-driven agents.

    > **Architecture:** see `.planning/phases/04-pipeline-skeleton/04-CONTEXT.md` and `04-RESEARCH.md`. Contracts are in `docs/API_CONTRACTS.md` (§2 Pipeline → Sanity, §3 Pipeline → Convex, §5 Sanity webhook, §7 LangGraph state).

    ---

    ## Prerequisites

    - **Python 3.11** (exact — pinned in `pyproject.toml` `requires-python = ">=3.11,<3.12"`)
    - **uv** — modern Python package manager. Install: `curl -LsSf https://astral.sh/uv/install.sh | sh`
    - **Railway CLI** — `npm i -g @railway/cli` (or use the Railway web UI)
    - **Supabase project** — provisioned by Andrew; see "First-time setup" below
    - **Sanity + Convex deployments** — already provisioned in Phases 1 + 3

    Optional:
    - **Docker** — only needed for local Dockerfile builds; Railway builds remotely from the pushed Dockerfile.

    ---

    ## Environment variables

    Copy `packages/pipeline/.env.example` to `packages/pipeline/.env` and fill in real values for local dev. In Railway, set every var via `railway variables set KEY=VALUE`.

    | Variable | Source / Notes |
    |---|---|
    | `SUPABASE_POSTGRES_URL` | Supabase **session pooler** (port 5432). Required. See "Sharp edge" below. |
    | `NEXT_PUBLIC_CONVEX_URL` | Shared with `apps/web` — Phase 3. |
    | `CONVEX_DEPLOY_KEY` | Shared with `apps/web` — Phase 3. Pipeline calls Convex `/api/mutation` with `Authorization: Convex {key}`. |
    | `NEXT_PUBLIC_SANITY_PROJECT_ID` | Shared with `apps/studio` and `apps/web` — Phase 1. |
    | `NEXT_PUBLIC_SANITY_DATASET` | Defaults to `production`. |
    | `SANITY_API_TOKEN` | **Write** token (NOT Studio's read token). |
    | `OPENROUTER_API_KEY` | Placeholder in Phase 4. Required in Phase 5. |
    | `TAVILY_API_KEY` | Placeholder in Phase 4. Required in Phase 5. |
    | `EISENBALM_STUB_MODE` | `true` in Phase 4. Phase 5 flips default. |
    | `PIPELINE_TRIGGER_SECRET` | Generate with `python -c "import secrets; print(secrets.token_urlsafe(32))"`. Required on `POST /run/weekly` + `/resume` + `/publish` via `X-Pipeline-Trigger-Secret` header. |

    ### Sharp edge: Supabase pooler mode

    The pipeline ONLY works with Supabase's **session pooler** (port 5432, host `aws-0-<region>.pooler.supabase.com`). The transaction pooler (port 6543) does not support prepared statements and breaks `AsyncPostgresSaver` after the first checkpoint write with `psycopg.errors.InvalidSqlStatementName`. The direct connection (`db.<ref>.supabase.co:5432`) is IPv6-only; Railway egress is IPv4-only — direct connection hangs forever.

    ```
    # CORRECT — session pooler
    SUPABASE_POSTGRES_URL=postgres://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require

    # WRONG — transaction pooler (breaks AsyncPostgresSaver)
    # SUPABASE_POSTGRES_URL=postgres://postgres:<password>@<ref>.pooler.supabase.com:6543/postgres

    # WRONG — direct connection (IPv6-only; Railway can't reach it)
    # SUPABASE_POSTGRES_URL=postgres://postgres:<password>@db.<ref>.supabase.co:5432/postgres
    ```

    See `.planning/phases/04-pipeline-skeleton/04-RESEARCH.md` §7 + Pitfall 1 + Pitfall 2 for the full diagnosis.

    ---

    ## Local development

    ```bash
    cd packages/pipeline
    uv sync                       # install Python deps (creates .venv/)
    cp .env.example .env          # fill in real values
    # ── Run the FastAPI app locally ──
    pnpm --filter pipeline dev    # OR: uv run uvicorn eisenbalm_pipeline.api.main:app --reload
    ```

    The app starts on `http://localhost:8000` and exposes:

    | Method | Path | Purpose |
    |---|---|---|
    | POST | `/run/weekly` | Trigger a new pipeline run. Returns `{runId}`. |
    | GET  | `/run/{runId}/status` | Read current pipeline state from Convex. |
    | POST | `/run/{runId}/resume` | Resume a paused run (after Editor gate 1 `interrupt()`). |
    | POST | `/run/{runId}/publish` | Manual fallback — Phase 4 stub; Phase 6 wires real PDF. |
    | POST | `/webhook/sanity-publish` | Phase 4 stub returning 200; Phase 6 hardens. |
    | GET  | `/healthz` | Railway healthcheck. |

    All routes except `/healthz` + `/run/{runId}/status` require the `X-Pipeline-Trigger-Secret` header.

    ---

    ## First-time setup (one-time per Supabase project)

    The LangGraph checkpointer tables (`checkpoints`, `checkpoint_writes`, `checkpoint_blobs`, `checkpoint_migrations`) must be created once per fresh Supabase database. The migration is idempotent.

    **Option A — Railway preDeployCommand (automatic):** `railway.toml` declares `preDeployCommand = ["python -m eisenbalm_pipeline.cli setup-checkpointer"]`. Every `railway up` runs the migration before traffic flows. No manual step needed once env vars are set.

    **Option B — Manual:** From your local machine after `railway link`:

    ```bash
    railway run python -m eisenbalm_pipeline.cli setup-checkpointer
    ```

    Expected output: `Checkpointer tables created / verified.`

    Verify in the Supabase dashboard → Tables: 4 tables present (`checkpoints`, `checkpoint_writes`, `checkpoint_blobs`, `checkpoint_migrations`).

    ---

    ## Stub mode toggle

    Phase 4 ships with `EISENBALM_STUB_MODE=true`. Stub agents return deterministic fixtures from `src/eisenbalm_pipeline/stubs/fixtures.py` — no OpenRouter calls, no Tavily searches, no real costs. The same `@agent_node` decorator wraps both stub and real agents (CONTEXT D-15) — Phase 5 only changes agent function bodies, not the lifecycle plumbing.

    ---

    ## Tests

    ```bash
    cd packages/pipeline
    uv run pytest -v       # full suite (~30s when env vars set)
    uv run pytest -x       # fail-fast iteration
    ```

    The integration tests run in-process via `httpx.ASGITransport` against the real FastAPI app and hit the real production Sanity + Convex. They use unique issueNumbers (`999000 + random`) and clean up Sanity drafts on teardown.

    Tests automatically skip with informative messages when required env vars are missing (`SUPABASE_POSTGRES_URL`, `CONVEX_DEPLOY_KEY`, etc.).

    ---

    ## Deploy workflow

    ```bash
    # First time only:
    railway init           # create Railway project, link to this directory
    railway link           # link local packages/pipeline/ to the service

    # Set env vars (every one in the table above)
    railway variables set SUPABASE_POSTGRES_URL=postgres://...
    railway variables set NEXT_PUBLIC_CONVEX_URL=https://...
    railway variables set CONVEX_DEPLOY_KEY=prod:...
    # ... etc.

    # Deploy
    railway up             # builds Dockerfile, runs preDeployCommand, starts uvicorn
    ```

    The `Dockerfile` uses `python:3.11-slim-bookworm` and pre-installs the WeasyPrint system deps (libpango, libcairo, etc.) even though Phase 4 doesn't generate PDFs yet — keeps the Dockerfile stable across phases.

    The `railway.toml` declares:
    - Dockerfile builder
    - `/healthz` healthcheck with 60s timeout
    - `ON_FAILURE` restart policy (max 3 retries)
    - `preDeployCommand` running `setup-checkpointer`

    ---

    ## Andrew's end-of-phase smoke test (Phase 4 acceptance — CONTEXT D-42)

    Run after Railway + Supabase are provisioned and the first deploy succeeded.

    ```bash
    # 1. Verify Supabase tables created (Option B from "First-time setup")
    railway run python -m eisenbalm_pipeline.cli setup-checkpointer
    # → "Checkpointer tables created / verified."

    # 2. Trigger a stub run
    RAILWAY_URL="https://your-pipeline.up.railway.app"
    SECRET="$(railway variables get PIPELINE_TRIGGER_SECRET)"
    curl -X POST $RAILWAY_URL/run/weekly \
         -H "X-Pipeline-Trigger-Secret: $SECRET" \
         -H "Content-Type: application/json" \
         -d '{}'
    # → {"runId": "..."}  (within 1 second)
    RUN_ID="<paste runId>"

    # 3. Wait ~30 seconds for the stub pipeline to finish

    # 4. Read status
    curl $RAILWAY_URL/run/$RUN_ID/status
    # → {"runId": "...", "status": "awaiting-review",
    #    "durationMs": <int>, "completedAt": <ms>,
    #    "errorMessage": null, ...}

    # 5. In Sanity Studio:
    #    - Find draft issue-999 (or whatever issueNumber you used)
    #    - Confirm every section is populated with stub content
    #    - Confirm pipelineMetadata.runId == $RUN_ID
    #    - Confirm pipelineMetadata.cost is a JSON string with shape {total, agents}

    # 6. In Convex dashboard:
    #    - pipelineRuns: 1 row with runId=$RUN_ID, status=awaiting-review, durationMs set, cost set
    #    - pitchLog: 3 rows (Scout's 3 candidates)
    #    - agentVotes: 3 rows (Advocate scored each candidate)
    #    - deliberationEvents: ~12 rows (advocate-argument × 3, editor-decision, section-draft × 7, qa-correction, editor-final, publisher-deploy)
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

    If all 8 steps succeed, Phase 4 is complete and Phase 5 (Agent Quality) is unblocked.

    ---

    ## File layout

    ```
    packages/pipeline/
    ├── Dockerfile            # Multi-stage, WeasyPrint deps preinstalled
    ├── pyproject.toml        # uv-managed, pinned deps
    ├── uv.lock               # committed for reproducibility
    ├── railway.toml          # Railway config-as-code
    ├── .env.example          # env var documentation
    ├── README.md             # this file
    ├── src/eisenbalm_pipeline/
    │   ├── cli.py            # python -m eisenbalm_pipeline.cli setup-checkpointer
    │   ├── api/              # FastAPI app + 4 routers
    │   ├── graph/            # DispatchState, builder, AsyncPostgresSaver factory
    │   ├── agents/           # 14 stub agents + @agent_node wrapper + validate_sections
    │   ├── lib/              # sanity_client, convex_client, portable_text, cost, ids
    │   └── stubs/            # deterministic fixtures + fake OpenRouter (Phase 5 swap point)
    └── tests/                # pytest integration tests (ASGITransport in-process)
    ```

    ---

    ## Where to look when something breaks

    | Symptom | Likely cause | Fix |
    |---|---|---|
    | `RuntimeError: AsyncPostgresSaver tables not found` on startup | First-time setup not run | `railway run python -m eisenbalm_pipeline.cli setup-checkpointer` |
    | `psycopg.errors.InvalidSqlStatementName` | Pointing at transaction pooler (port 6543) | Switch to session pooler (port 5432) in `SUPABASE_POSTGRES_URL` |
    | Lifespan hangs on `await pool.open()` on Railway | IPv6-only direct Supabase connection | Switch to session pooler |
    | `Convex mutation failed: ... ArgumentValidationError: cost` | Phase 4 Convex schema patch not deployed | `pnpm --filter @eisenbalm/convex deploy` |
    | `pipelineRuns.cost` empty after a run | Cost JSON dropped in transit | Check `lib/cost.py:end_run` invariants in `agents/publisher.py` |
    | `POST /run/{runId}/resume` returns 409 | Graph not paused — already completed | Trigger a new run; resume cannot un-complete a finished graph |

    ---

    ## Cross-references

    - `docs/API_CONTRACTS.md` §2 — Pipeline → Sanity (Python write contracts)
    - `docs/API_CONTRACTS.md` §3 — Pipeline → Convex (HTTP API)
    - `docs/API_CONTRACTS.md` §5 — Sanity → Pipeline (webhook, Phase 6 hardening target)
    - `docs/API_CONTRACTS.md` §7 — LangGraph state (DispatchState contract)
    - `.planning/phases/04-pipeline-skeleton/04-CONTEXT.md` — Phase 4 architectural decisions
    - `.planning/phases/04-pipeline-skeleton/04-RESEARCH.md` — Pattern walk-throughs + sharp edges
    - `convex/README.md` — Phase 3 Convex documentation (sibling)
    - `apps/web/README.md` — Phase 2 Next.js documentation (consumer of Sanity drafts via GROQ)
    ````
  </action>
  <verify>
    <automated>grep -F "setup-checkpointer" packages/pipeline/README.md && grep -F "X-Pipeline-Trigger-Secret" packages/pipeline/README.md && grep -F "Andrew's end-of-phase smoke test" packages/pipeline/README.md && grep -F "session pooler" packages/pipeline/README.md && grep -F "InvalidSqlStatementName" packages/pipeline/README.md && grep -F "API_CONTRACTS.md" packages/pipeline/README.md && grep -F "EISENBALM_STUB_MODE" packages/pipeline/README.md</automated>
  </verify>
  <done>
    - README has all sections from CONTEXT D-40: prerequisites, env vars, local dev, first-time setup, stub mode toggle, tests, deploy workflow, Andrew's smoke test, file layout, troubleshooting, cross-references
    - CONTEXT D-42 9-step smoke test sequence is verbatim in the README
    - Supabase session-pooler warning prominent (research §7 + Pitfall 1)
    - All 6 routes listed in the local-dev table
    - Plan 01's placeholder content removed
  </done>
</task>

<task type="auto">
  <name>Task 2: Update apps/web/README.md Convex section + verify root .env.example Phase 4 block</name>
  <files>apps/web/README.md, .env.example</files>
  <read_first>
    - apps/web/README.md (Phase 2 + Phase 3 — find the "Convex" section per Phase 3 D-25)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-41 (cross-reference from apps/web/README.md Convex section noting CONVEX_DEPLOY_KEY is shared with Railway/pipeline)
    - .env.example (Plan 01 wrote the Phase 4 block — verify content matches CONTEXT D-32)
    - .planning/STATE.md "Phase 03 P07" entry (apps/web/README.md Convex section was added as PRIMARY placement after Reading time, before SEO; preserve that)
  </read_first>
  <action>
    **Step A — Append a Phase 4 cross-reference paragraph to the existing `## Convex` section in `apps/web/README.md`.** Find the Convex section (added in Phase 3 Plan 03-07). Append at the end of the section (do NOT modify Phase 3's existing content):

    ```markdown

    > **Phase 4 note:** `CONVEX_DEPLOY_KEY` is also used by the FastAPI pipeline on Railway (`packages/pipeline/`). It's the same value in both environments — provision it in Vercel for the web app AND in Railway for the pipeline service. See `packages/pipeline/README.md` for pipeline-side env var details.
    ```

    **Step B — Verify root `.env.example` Phase 4 block** (Plan 01 wrote it). Read the file and confirm the "Phase 4 — Pipeline (FastAPI + LangGraph on Railway)" section is present and accurate. If anything is off, correct it. The block should reference `packages/pipeline/.env.example` for full details and list:
    - `SUPABASE_POSTGRES_URL`, `SANITY_API_TOKEN`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `EISENBALM_STUB_MODE`, `PIPELINE_TRIGGER_SECRET`
    - And note the shared vars: `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`

    No code changes — purely documentation alignment.
  </action>
  <verify>
    <automated>grep -F "Phase 4 note" apps/web/README.md && grep -F "packages/pipeline/" apps/web/README.md && grep -F "Phase 4 — Pipeline" .env.example && grep -F "SUPABASE_POSTGRES_URL" .env.example && grep -F "EISENBALM_STUB_MODE" .env.example</automated>
  </verify>
  <done>
    - `apps/web/README.md` Convex section has a "Phase 4 note" paragraph at the end noting CONVEX_DEPLOY_KEY shared with Railway/pipeline
    - Root `.env.example` Phase 4 block exists with all 6 pipeline-only vars + the 4 shared vars
    - No Phase 1-3 content disturbed
  </done>
</task>

</tasks>

<verification>
After both tasks:

1. `grep -F "Andrew's end-of-phase smoke test" packages/pipeline/README.md` succeeds.
2. `grep -F "Phase 4 note" apps/web/README.md` succeeds.
3. `grep -F "Phase 4 — Pipeline" .env.example` succeeds.
4. Plan 01's `README.md` placeholder ("This README is a Phase 4 placeholder") is gone.

The README is the script Plan 12 follows.
</verification>

<success_criteria>
- packages/pipeline/README.md is the canonical onboarding doc per CONTEXT D-40 — 6+ sections, troubleshooting table, full Andrew smoke test recipe.
- apps/web/README.md updated to note shared CONVEX_DEPLOY_KEY (CONTEXT D-41).
- Root .env.example Phase 4 block confirmed (CONTEXT D-32).
- Plan 12 can succeed by following the README alone.
</success_criteria>

<output>
Create `.planning/phases/04-pipeline-skeleton/04-11-documentation-SUMMARY.md` recording:
- Confirmation that README sections match CONTEXT D-40 enumeration
- Confirmation that CONTEXT D-42 smoke test sequence is verbatim
- Forward link to Plan 12 (Andrew's smoke test against the live Railway deployment uses this README)
</output>
