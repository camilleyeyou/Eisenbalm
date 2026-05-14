---
phase: 04-pipeline-skeleton
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - packages/pipeline/pyproject.toml
  - packages/pipeline/uv.lock
  - packages/pipeline/.env.example
  - packages/pipeline/.gitignore
  - packages/pipeline/Dockerfile
  - packages/pipeline/.dockerignore
  - packages/pipeline/railway.toml
  - packages/pipeline/package.json
  - packages/pipeline/tsconfig.json
  - packages/pipeline/README.md
  - packages/pipeline/src/eisenbalm_pipeline/__init__.py
  - .env.example
autonomous: true
requirements:
  - PIP-01
must_haves:
  truths:
    - "packages/pipeline/ is a Python project managed by uv (Python 3.11) — pyproject.toml + uv.lock checked in"
    - "Dockerfile builds a multi-stage image on python:3.11-slim-bookworm with all WeasyPrint system deps preinstalled (libpango, libcairo, libffi, libgdk-pixbuf-2.0-0, shared-mime-info, fonts-liberation, libharfbuzz0b, libharfbuzz-subset0, libjpeg62-turbo, libopenjp2-7, fontconfig)"
    - "railway.toml declares the Dockerfile builder, /healthz healthcheck (60s), restart policy, and preDeployCommand running `python -m eisenbalm_pipeline.cli setup-checkpointer`"
    - "All Phase 4 env vars are documented in packages/pipeline/.env.example (placeholder values) + root .env.example references the new vars"
    - "pnpm workspace bridge: pnpm --filter pipeline dev shells to `uv run uvicorn` and pnpm --filter pipeline test shells to `uv run pytest`"
    - "Old TypeScript artifact tsconfig.json is removed"
  artifacts:
    - path: "packages/pipeline/pyproject.toml"
      provides: "Python project metadata + pinned deps + dev-deps + pytest config"
      contains: "langgraph==1.1.10"
    - path: "packages/pipeline/Dockerfile"
      provides: "Multi-stage Docker image for Railway with WeasyPrint deps"
      contains: "libpango-1.0-0"
    - path: "packages/pipeline/railway.toml"
      provides: "Railway config-as-code: build, healthcheck, preDeployCommand"
      contains: "preDeployCommand"
    - path: "packages/pipeline/.env.example"
      provides: "Documented placeholders for SUPABASE_POSTGRES_URL, OPENROUTER_API_KEY, TAVILY_API_KEY, SANITY_API_TOKEN, EISENBALM_STUB_MODE, PIPELINE_TRIGGER_SECRET"
      contains: "SUPABASE_POSTGRES_URL"
    - path: "packages/pipeline/src/eisenbalm_pipeline/__init__.py"
      provides: "Package marker — confirms src/ layout"
      contains: "__version__"
  key_links:
    - from: "packages/pipeline/pyproject.toml"
      to: "packages/pipeline/src/eisenbalm_pipeline/"
      via: "[tool.hatch.build.targets.wheel] packages line OR [tool.uv] package=true + src layout"
      pattern: "eisenbalm_pipeline"
    - from: "packages/pipeline/railway.toml"
      to: "packages/pipeline/Dockerfile"
      via: "[build] builder=DOCKERFILE dockerfilePath=Dockerfile"
      pattern: "builder = \"DOCKERFILE\""
    - from: "pnpm-workspace.yaml"
      to: "packages/pipeline/package.json"
      via: "packages/* glob; package.json keeps `pipeline` workspace name"
      pattern: "\"name\": \"pipeline\""
---

<objective>
Bootstrap the `packages/pipeline/` Python project end-to-end so every Wave 1+ plan has the structural prerequisites it needs. This plan is the load-bearing foundation: pyproject.toml with every pinned dep (including the two sub-deps research §1 surfaced — `langgraph-checkpoint-postgres==3.1.0` + `psycopg[binary]>=3.2`), uv.lock generated, src/ layout, Dockerfile with all WeasyPrint system deps from research §8, railway.toml from research §9, env.example documenting every Phase 4 env var, pnpm workspace bridge so `pnpm --filter pipeline dev` works, and README placeholder (Plan 11 rewrites it). Deletes the Phase 1 `tsconfig.json` placeholder (Python lives here now).

Purpose: PIP-01 — Dockerfile builds + deploys to Railway with WeasyPrint deps preinstalled. Every other Phase 4 plan imports from `eisenbalm_pipeline` and runs under `uv run pytest`; both require this plan first.
Output: A functional Python project that builds locally with `uv sync`, builds remotely on Railway via `railway up`, exposes nothing yet (no FastAPI app — Plan 09 wires that), but is structurally complete.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/04-pipeline-skeleton/04-CONTEXT.md
@.planning/phases/04-pipeline-skeleton/04-RESEARCH.md
@.planning/phases/04-pipeline-skeleton/04-VALIDATION.md
@packages/pipeline/README.md
@packages/pipeline/package.json
@packages/pipeline/tsconfig.json
@.env.example
@CLAUDE.md
</context>

<interfaces>
<!-- Pinned dependency set verified in research §"Standard Stack" + §1. -->
<!-- Copy these pins verbatim into pyproject.toml. -->

Core deps (locked by CONTEXT D-04 + research §"Standard Stack"):
- fastapi==0.136.1
- uvicorn[standard]==0.46.0
- langgraph==1.1.10
- langgraph-checkpoint-postgres==3.1.0      # ← research §1 sub-dep, NOT in CONTEXT D-04
- psycopg[binary]>=3.2,<4                    # ← research §1 sub-dep, NOT in CONTEXT D-04
- pydantic==2.13.4
- httpx==0.28.1
- langchain-openai==1.2.1
- supabase==2.30.0
- python-slugify==8.0.4

Dev deps (Wave 0 validation infrastructure per VALIDATION §"Wave 0 Requirements"):
- pytest>=8.3,<9
- pytest-asyncio>=0.24,<1
- respx>=0.21                                # ← research VALIDATION §Wave 0 — HTTP mocking for Sanity/Convex client unit tests

WeasyPrint apt packages (research §8 final list):
libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 libcairo2
libgdk-pixbuf-2.0-0 libharfbuzz0b libharfbuzz-subset0
libjpeg62-turbo libopenjp2-7 libffi-dev
shared-mime-info fontconfig fonts-liberation

Env vars introduced (CONTEXT D-31):
- SUPABASE_POSTGRES_URL      (session pooler URL — research §7)
- OPENROUTER_API_KEY         (placeholder OK in stub mode)
- TAVILY_API_KEY             (placeholder OK in stub mode)
- SANITY_API_TOKEN           (write token for raw httpx Sanity client)
- EISENBALM_STUB_MODE        ('true' default in Phase 4)
- PIPELINE_TRIGGER_SECRET    (poor-man's auth for /run/weekly)

Reused env vars (do NOT redefine, just reference in .env.example comment):
- NEXT_PUBLIC_CONVEX_URL     (Phase 3)
- CONVEX_DEPLOY_KEY          (Phase 3)
- NEXT_PUBLIC_SANITY_PROJECT_ID  (Phase 1)
- NEXT_PUBLIC_SANITY_DATASET     (Phase 1; defaults to "production")
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Initialize uv project + pyproject.toml + uv.lock + delete tsconfig.json</name>
  <files>packages/pipeline/pyproject.toml, packages/pipeline/uv.lock, packages/pipeline/.gitignore, packages/pipeline/src/eisenbalm_pipeline/__init__.py, packages/pipeline/tsconfig.json (DELETED), packages/pipeline/package.json (UPDATED)</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md decisions D-01, D-02, D-03, D-04 (uv-managed, Python 3.11, src/ layout, pinned deps)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §"Standard Stack" + §1 "LangGraph 1.1.10 + AsyncPostgresSaver + Supabase Postgres" (sub-deps `langgraph-checkpoint-postgres==3.1.0` + `psycopg[binary]>=3.2` MUST be added — research §1 calls out that CONTEXT D-04 omits these)
    - .planning/phases/04-pipeline-skeleton/04-VALIDATION.md §"Wave 0 Requirements" (pytest>=8.3, pytest-asyncio>=0.24, respx>=0.21; `[tool.pytest.ini_options]` asyncio_mode = "auto", testpaths = ["tests"])
    - packages/pipeline/package.json (current content — keep "name": "pipeline", "private": true; replace placeholder scripts with the bridge scripts in Task 4)
    - packages/pipeline/tsconfig.json (current placeholder — confirm contents before deletion)
    - CLAUDE.md (do not modify field names; uv lock must be reproducible)
  </read_first>
  <action>
    Run from `packages/pipeline/`:

    1. **Delete** `packages/pipeline/tsconfig.json` — Python project, no TS needed (CONTEXT D-03 implicit; CONTEXT.md Code Context confirms).

    2. **Write `packages/pipeline/pyproject.toml`** (do NOT use `uv init` — write directly so the file is deterministic):

       ```toml
       [project]
       name = "eisenbalm-pipeline"
       version = "0.1.0"
       description = "Eisenbalm Dispatch pipeline — FastAPI + LangGraph + 14 stub agents (Phase 4 skeleton)"
       requires-python = ">=3.11,<3.12"
       readme = "README.md"
       dependencies = [
         "fastapi==0.136.1",
         "uvicorn[standard]==0.46.0",
         "langgraph==1.1.10",
         "langgraph-checkpoint-postgres==3.1.0",
         "psycopg[binary]>=3.2,<4",
         "pydantic==2.13.4",
         "httpx==0.28.1",
         "langchain-openai==1.2.1",
         "supabase==2.30.0",
         "python-slugify==8.0.4",
       ]

       [dependency-groups]
       dev = [
         "pytest>=8.3,<9",
         "pytest-asyncio>=0.24,<1",
         "respx>=0.21",
       ]

       [build-system]
       requires = ["hatchling"]
       build-backend = "hatchling.build"

       [tool.hatch.build.targets.wheel]
       packages = ["src/eisenbalm_pipeline"]

       [tool.uv]
       package = true

       [tool.pytest.ini_options]
       asyncio_mode = "auto"
       testpaths = ["tests"]
       filterwarnings = ["ignore::DeprecationWarning"]
       ```

       Rationale notes (for executor):
       - `langgraph-checkpoint-postgres==3.1.0` and `psycopg[binary]>=3.2` are research §1 mandatory sub-deps that CONTEXT D-04 implies but doesn't pin — must be explicit.
       - `requires-python = ">=3.11,<3.12"` per CONTEXT D-02.
       - `[tool.uv] package = true` per CONTEXT D-03 enables editable installs.
       - `[tool.pytest.ini_options]` is VALIDATION §Wave 0's requirement — installed here so Plan 05 only has to add tests, not configure pytest.

    3. **Create `packages/pipeline/src/eisenbalm_pipeline/__init__.py`** with one line:

       ```python
       __version__ = "0.1.0"
       ```

       This confirms src/ layout works and makes the package importable.

    4. **Create `packages/pipeline/.gitignore`** (Python + uv standard ignores):

       ```
       # Python
       __pycache__/
       *.py[cod]
       *$py.class
       *.so
       .Python

       # Virtual env
       .venv/
       venv/

       # uv
       # uv.lock is committed (research §"Established Patterns")

       # pytest
       .pytest_cache/

       # Local env
       .env
       .env.local

       # IDE
       .vscode/
       .idea/
       ```

    5. **Run `uv lock`** to generate `packages/pipeline/uv.lock`. This file is committed (matches Phase 1 `sanity.types.ts` + Phase 3 `convex/_generated/` patterns per CONTEXT D-03 "Established Patterns").

    6. **Run `uv sync`** to materialize `.venv/` locally and verify the lock resolves cleanly.

    Do NOT commit `.venv/`. Do NOT modify packages/pipeline/package.json yet (Task 4 handles it).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv lock --check && uv sync --frozen && uv run python -c "import eisenbalm_pipeline; print(eisenbalm_pipeline.__version__)"</automated>
  </verify>
  <done>
    - `packages/pipeline/pyproject.toml` contains exactly the pin set listed above (grep `langgraph==1.1.10` AND `langgraph-checkpoint-postgres==3.1.0` AND `psycopg[binary]>=3.2` AND `pytest-asyncio>=0.24` AND `respx>=0.21`)
    - `packages/pipeline/uv.lock` exists and resolves without error (`uv lock --check` exits 0)
    - `packages/pipeline/src/eisenbalm_pipeline/__init__.py` exists with `__version__`
    - `packages/pipeline/.gitignore` exists; `.venv/` listed
    - `packages/pipeline/tsconfig.json` no longer exists (`! test -e packages/pipeline/tsconfig.json`)
    - `uv run python -c "import eisenbalm_pipeline; print(eisenbalm_pipeline.__version__)"` prints `0.1.0`
  </done>
</task>

<task type="auto">
  <name>Task 2: Write Dockerfile + .dockerignore (multi-stage, WeasyPrint deps preinstalled per PIP-01)</name>
  <files>packages/pipeline/Dockerfile, packages/pipeline/.dockerignore</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-28 (custom Dockerfile, python:3.11-slim-bookworm base, WeasyPrint deps installed in Phase 4 even though Phase 6 owns PDF)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §8 "Dockerfile (WeasyPrint deps pre-installed per D-28)" — full multi-stage Dockerfile with comprehensive apt list (research's recommended set, NOT the shorter CONTEXT.md list)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §9 "Railway deployment specifics" (EXPOSE 8000, startCommand uses $PORT — Railway overrides CMD)
    - The pyproject.toml just written in Task 1 (Dockerfile copies it + uv.lock with `--mount=type=bind` for layer caching)
  </read_first>
  <action>
    Write `packages/pipeline/Dockerfile` VERBATIM from research §8 (with the comprehensive WeasyPrint deps — both research's recommended list AND CONTEXT D-28's explicit list merged):

    ```dockerfile
    # packages/pipeline/Dockerfile
    # syntax=docker/dockerfile:1.7

    # ── Builder stage ────────────────────────────────────────────────
    FROM python:3.11-slim-bookworm AS builder

    ENV UV_LINK_MODE=copy \
        UV_COMPILE_BYTECODE=1 \
        UV_PYTHON_DOWNLOADS=never

    COPY --from=ghcr.io/astral-sh/uv:0.5.10 /uv /bin/uv

    WORKDIR /app

    # Install Python deps first for layer caching
    RUN --mount=type=cache,target=/root/.cache/uv \
        --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
        --mount=type=bind,source=uv.lock,target=uv.lock \
        uv sync --frozen --no-dev --no-install-project

    # Copy source, install project
    COPY src/ ./src/
    COPY pyproject.toml uv.lock README.md ./
    RUN --mount=type=cache,target=/root/.cache/uv \
        uv sync --frozen --no-dev

    # ── Runtime stage ────────────────────────────────────────────────
    FROM python:3.11-slim-bookworm AS runtime

    # WeasyPrint system deps (Phase 4 installs even though Phase 6 owns PDF)
    # Source: research §8 (merged CONTEXT D-28 list + research's comprehensive list)
    RUN apt-get update && apt-get install -y --no-install-recommends \
            libpango-1.0-0 libpangoft2-1.0-0 libpangocairo-1.0-0 libcairo2 \
            libgdk-pixbuf-2.0-0 libharfbuzz0b libharfbuzz-subset0 \
            libjpeg62-turbo libopenjp2-7 libffi-dev \
            shared-mime-info fontconfig fonts-liberation \
        && rm -rf /var/lib/apt/lists/*

    # Non-root user
    RUN useradd --create-home --uid 10001 app
    WORKDIR /app

    # Copy installed venv from builder
    COPY --from=builder --chown=app:app /app /app

    USER app
    ENV PATH="/app/.venv/bin:$PATH" \
        PYTHONUNBUFFERED=1

    EXPOSE 8000
    CMD ["uvicorn", "eisenbalm_pipeline.api.main:app", \
         "--host", "0.0.0.0", "--port", "8000"]
    ```

    Then write `packages/pipeline/.dockerignore` to keep the build context small:

    ```
    # Local virtualenv
    .venv/
    venv/

    # Python caches
    __pycache__/
    *.py[cod]
    .pytest_cache/

    # Local env
    .env
    .env.local

    # Tests (not needed in production image)
    tests/

    # Docs / planning artifacts
    README.md
    docs/
    .planning/

    # Git
    .git/
    .gitignore

    # IDE
    .vscode/
    .idea/
    ```

    Notes for executor:
    - Do NOT add `README.md` to the runtime image — hatchling requires it for the build step (referenced in pyproject.toml `readme = "README.md"`); .dockerignore excludes it from non-build context only via the explicit `COPY` whitelist in builder stage.
    - Wait — re-read: `.dockerignore` excludes from ALL stages; the builder needs README.md. Resolution: REMOVE `README.md` from .dockerignore (let it be copied in builder stage's explicit `COPY pyproject.toml uv.lock README.md ./`). Update the .dockerignore above accordingly: delete the `README.md` line.
    - `EXPOSE 8000` is documentation; railway.toml (Task 3) sets the actual startCommand with `$PORT`.
    - `uv:0.5.10` pin from research §8 — keep it pinned for reproducibility.
  </action>
  <verify>
    <automated>grep -F "libpango-1.0-0" packages/pipeline/Dockerfile && grep -F "libcairo2" packages/pipeline/Dockerfile && grep -F "libgdk-pixbuf-2.0-0" packages/pipeline/Dockerfile && grep -F "shared-mime-info" packages/pipeline/Dockerfile && grep -F "fonts-liberation" packages/pipeline/Dockerfile && grep -F "libharfbuzz-subset0" packages/pipeline/Dockerfile && grep -F "python:3.11-slim-bookworm" packages/pipeline/Dockerfile && grep -F "useradd --create-home --uid 10001 app" packages/pipeline/Dockerfile && grep -F "uv sync --frozen --no-dev" packages/pipeline/Dockerfile</automated>
  </verify>
  <done>
    - `packages/pipeline/Dockerfile` exists; multi-stage (builder + runtime)
    - Builder uses `python:3.11-slim-bookworm` and `ghcr.io/astral-sh/uv:0.5.10`
    - Runtime stage installs ALL of: libpango-1.0-0, libpangoft2-1.0-0, libpangocairo-1.0-0, libcairo2, libgdk-pixbuf-2.0-0, libharfbuzz0b, libharfbuzz-subset0, libjpeg62-turbo, libopenjp2-7, libffi-dev, shared-mime-info, fontconfig, fonts-liberation
    - Runtime drops to non-root `app` user (UID 10001)
    - CMD targets `eisenbalm_pipeline.api.main:app` (Plan 09 creates this module)
    - `packages/pipeline/.dockerignore` excludes `.venv/`, tests/, .git/, .planning/ (but NOT README.md, which builder needs)
  </done>
</task>

<task type="auto">
  <name>Task 3: Write railway.toml + .env.example + update root .env.example</name>
  <files>packages/pipeline/railway.toml, packages/pipeline/.env.example, .env.example</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-12 (`checkpointer.setup()` as one-time deploy step), D-29 (manual Railway provisioning), D-31 (env vars list — verbatim), D-32 (env wiring: per-workspace .env.example + root .env.example reference), D-34 (/healthz contract)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §9 "Railway deployment specifics" — full `railway.toml` content (verbatim)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §7 "Supabase Postgres URL format for Railway" — session pooler URL format with `?sslmode=require` annotation
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §"Common Pitfalls" Pitfall 1 + 2 (session pooler is mandatory; document the WRONG URL format too as a warning)
    - .env.example (current root file — additive only; do not break existing Phase 1-3 vars)
    - convex/README.md (Phase 3 sibling — extends pipeline env comment per CONTEXT D-41)
  </read_first>
  <action>
    **Step A — Write `packages/pipeline/railway.toml`** (research §9 verbatim, with `preDeployCommand` as the canonical home for `setup-checkpointer` per CONTEXT D-12):

    ```toml
    # packages/pipeline/railway.toml
    [build]
    builder = "DOCKERFILE"
    dockerfilePath = "Dockerfile"

    [deploy]
    startCommand = "uvicorn eisenbalm_pipeline.api.main:app --host 0.0.0.0 --port $PORT"
    healthcheckPath = "/healthz"
    healthcheckTimeout = 60
    restartPolicyType = "ON_FAILURE"
    restartPolicyMaxRetries = 3

    # Phase 4: one-time setup runs as preDeployCommand (CONTEXT D-12).
    # Idempotent — safe to run on every deploy. Requires SUPABASE_POSTGRES_URL
    # to be set via `railway variables set` BEFORE first deploy (D-29, D-30).
    preDeployCommand = ["python -m eisenbalm_pipeline.cli setup-checkpointer"]
    ```

    **Step B — Write `packages/pipeline/.env.example`** documenting every Phase 4 env var per CONTEXT D-31 plus reused vars per CONTEXT D-32:

    ```bash
    # ─────────────────────────────────────────────────────────────────────────────
    # Eisenbalm Pipeline — Environment Variables (Phase 4)
    # Copy to packages/pipeline/.env for local dev (gitignored).
    # Provision in Railway via `railway variables set KEY=VALUE` (CONTEXT D-29).
    # ─────────────────────────────────────────────────────────────────────────────

    # ─── LangGraph Checkpointer (Supabase Postgres) ──────────────────────────────
    # CRITICAL: Use the SESSION POOLER (port 5432) — not the transaction pooler.
    #
    # Why: AsyncPostgresSaver uses prepared statements via psycopg.
    # The transaction pooler (port 6543) does NOT support prepared statements →
    # causes psycopg.errors.InvalidSqlStatementName on second checkpoint read.
    # The direct connection (db.<ref>.supabase.co:5432) is IPv6-only;
    # Railway egress is IPv4-only — direct connection hangs forever.
    #
    # Reference: 04-RESEARCH.md §7 + Pitfall 1 + Pitfall 2
    #
    # ✓ CORRECT — session pooler, IPv4-compatible, supports prepared statements
    SUPABASE_POSTGRES_URL=postgres://postgres.PROJECTREF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require
    #
    # ✗ WRONG — transaction pooler (breaks AsyncPostgresSaver)
    # SUPABASE_POSTGRES_URL=postgres://postgres:PASSWORD@<ref>.pooler.supabase.com:6543/postgres
    #
    # ✗ WRONG — direct connection (IPv6-only; Railway can't reach it)
    # SUPABASE_POSTGRES_URL=postgres://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres

    # ─── Convex (re-used from Phase 3) ───────────────────────────────────────────
    # Pipeline calls Convex via HTTP at /api/mutation. Same key as apps/web.
    # Reference: 04-RESEARCH.md §6
    NEXT_PUBLIC_CONVEX_URL=https://YOUR-DEPLOYMENT.convex.cloud
    CONVEX_DEPLOY_KEY=prod:YOUR-DEPLOY-KEY

    # ─── Sanity (re-used from Phase 1, plus write token) ─────────────────────────
    # Pipeline writes drafts via raw httpx (no maintained Python SDK — research §5).
    NEXT_PUBLIC_SANITY_PROJECT_ID=YOUR-PROJECT-ID
    NEXT_PUBLIC_SANITY_DATASET=production
    SANITY_API_TOKEN=skYOUR-WRITE-TOKEN

    # ─── OpenRouter (placeholder in Phase 4; required in Phase 5) ────────────────
    OPENROUTER_API_KEY=sk-or-PLACEHOLDER

    # ─── Tavily (placeholder in Phase 4; required in Phase 5) ────────────────────
    TAVILY_API_KEY=tvly-PLACEHOLDER

    # ─── Pipeline behavior flags ─────────────────────────────────────────────────
    # Phase 4 default: stub mode (no real LLM/web calls). Phase 5 flips to false.
    EISENBALM_STUB_MODE=true

    # Shared-secret header on /run/weekly and /run/{runId}/resume (CONTEXT D-31).
    # Generate locally: `python -c "import secrets; print(secrets.token_urlsafe(32))"`
    PIPELINE_TRIGGER_SECRET=CHANGE-ME-RANDOM-32-BYTES
    ```

    **Step C — Update root `.env.example`** — APPEND a "Phase 4 — Pipeline" block at the end (do NOT touch existing Phase 1-3 vars). After reading the current file, append:

    ```bash

    # ─── Phase 4 — Pipeline (FastAPI + LangGraph on Railway) ─────────────────────
    # The pipeline workspace has its own .env.example with the full set.
    # See: packages/pipeline/.env.example
    #
    # Pipeline-only env vars (set via `railway variables set` on the Railway service):
    #   SUPABASE_POSTGRES_URL    — Postgres session pooler URL for LangGraph checkpoints
    #   SANITY_API_TOKEN         — Sanity write token (NOT Studio's read token)
    #   OPENROUTER_API_KEY       — placeholder in Phase 4
    #   TAVILY_API_KEY           — placeholder in Phase 4
    #   EISENBALM_STUB_MODE      — 'true' in Phase 4; 'false' in Phase 5
    #   PIPELINE_TRIGGER_SECRET  — shared secret for /run/weekly auth
    #
    # Re-used from earlier phases (already set on Vercel; mirror to Railway):
    #   NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET,
    #   NEXT_PUBLIC_CONVEX_URL, CONVEX_DEPLOY_KEY
    ```

    Notes for executor:
    - `?sslmode=require` is research §7's explicit recommendation.
    - The "WRONG" comments are intentional documentation — they're the most common misconfigurations (research §"Common Pitfalls" 1 + 2).
    - Generate-secret tip is a research §"User Setup" hint to keep onboarding self-serve.
  </action>
  <verify>
    <automated>grep -F "preDeployCommand" packages/pipeline/railway.toml && grep -F "python -m eisenbalm_pipeline.cli setup-checkpointer" packages/pipeline/railway.toml && grep -F "healthcheckPath = \"/healthz\"" packages/pipeline/railway.toml && grep -F "SUPABASE_POSTGRES_URL" packages/pipeline/.env.example && grep -F "aws-0-REGION.pooler.supabase.com:5432" packages/pipeline/.env.example && grep -F "EISENBALM_STUB_MODE=true" packages/pipeline/.env.example && grep -F "PIPELINE_TRIGGER_SECRET" packages/pipeline/.env.example && grep -F "Phase 4 — Pipeline" .env.example</automated>
  </verify>
  <done>
    - `packages/pipeline/railway.toml` declares Dockerfile builder, /healthz healthcheck (60s timeout), `restartPolicyType=ON_FAILURE` (max 3 retries), and `preDeployCommand` running the setup-checkpointer CLI
    - `packages/pipeline/.env.example` lists ALL six new Phase 4 env vars (SUPABASE_POSTGRES_URL, OPENROUTER_API_KEY, TAVILY_API_KEY, SANITY_API_TOKEN, EISENBALM_STUB_MODE, PIPELINE_TRIGGER_SECRET) AND references the four reused vars (NEXT_PUBLIC_CONVEX_URL, CONVEX_DEPLOY_KEY, NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SANITY_DATASET)
    - SUPABASE_POSTGRES_URL example uses session pooler format `aws-0-REGION.pooler.supabase.com:5432` with `?sslmode=require`; transaction pooler + direct connection variants documented as WRONG with comments
    - Root `.env.example` has a "Phase 4 — Pipeline" block appended without touching Phase 1-3 sections
  </done>
</task>

<task type="auto">
  <name>Task 4: Wire pnpm workspace bridge + README placeholder</name>
  <files>packages/pipeline/package.json, packages/pipeline/README.md</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md "Code Context → Constraints from Existing Code" (packages/pipeline/package.json stays empty so pnpm sees the workspace; pnpm-workspace.yaml already includes packages/* per Phase 1 D-06)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-40 (README is rewritten in Plan 11 — this plan only writes a temporary placeholder so the package.json `readme` field resolves during hatchling build)
    - .planning/STATE.md "Phase 3" entries (pattern: `pnpm --filter @eisenbalm/convex deploy` — Phase 4 mirrors with `pnpm --filter pipeline dev`)
    - packages/pipeline/package.json (current — keep "name": "pipeline", "private": true)
    - packages/pipeline/README.md (current placeholder — REPLACE with skeleton noting Plan 11 owns the full rewrite)
  </read_first>
  <action>
    **Step A — Replace `packages/pipeline/package.json`** with the workspace bridge scripts:

    ```json
    {
      "name": "pipeline",
      "version": "0.0.0",
      "private": true,
      "description": "FastAPI + LangGraph pipeline (Python, uv-managed). Phase 4 skeleton.",
      "scripts": {
        "dev": "uv run uvicorn eisenbalm_pipeline.api.main:app --reload --host 0.0.0.0 --port ${PORT:-8000}",
        "test": "uv run pytest -v",
        "test:quick": "uv run pytest -x",
        "lint": "echo \"Lint: not configured in Phase 4 — defer to Phase 5+\" && exit 0",
        "setup-checkpointer": "uv run python -m eisenbalm_pipeline.cli setup-checkpointer"
      }
    }
    ```

    Rationale:
    - Mirrors Phase 3 D-04's `pnpm --filter @eisenbalm/convex deploy` pattern with `pnpm --filter pipeline dev|test|setup-checkpointer`.
    - `dev` invokes `uvicorn` against `eisenbalm_pipeline.api.main:app` (Plan 09 wires this).
    - Scripts will fail with friendly errors before Plan 09 lands (eisenbalm_pipeline.api.main does not yet exist) — that's expected; Wave 0 only establishes the structural shape.
    - Keeping `name: "pipeline"` matches the Phase 1 placeholder name (pnpm-workspace.yaml expects it).

    **Step B — Write a placeholder `packages/pipeline/README.md`** so hatchling's `readme = "README.md"` field resolves. Plan 11 owns the full rewrite per CONTEXT D-40:

    ```markdown
    # packages/pipeline — Eisenbalm Pipeline (Phase 4 skeleton)

    > **This README is a Phase 4 placeholder.** Plan 04-11 (Documentation) rewrites it to the canonical onboarding doc per CONTEXT D-40. Until then, see `.planning/phases/04-pipeline-skeleton/04-CONTEXT.md` and `04-RESEARCH.md` for the full design.

    ## What this is

    The Eisenbalm Dispatch pipeline — a FastAPI + LangGraph application that orchestrates 14 stub agents (Phase 4) and, in Phase 5, real LLM-driven agents.

    ## Quick reference

    | Command                                                 | What it does                                            |
    |---------------------------------------------------------|---------------------------------------------------------|
    | `uv sync`                                               | Install Python deps locally                             |
    | `uv run pytest -v`                                      | Run the test suite                                      |
    | `pnpm --filter pipeline dev`                            | Start FastAPI on `localhost:8000` (Plan 09+ required)   |
    | `pnpm --filter pipeline setup-checkpointer`             | One-time Supabase migration (Plan 08+ required)         |

    ## Stack

    - Python 3.11
    - `uv` package manager
    - FastAPI 0.136.1
    - LangGraph 1.1.10 + `langgraph-checkpoint-postgres` 3.1.0 + `psycopg[binary]>=3.2`
    - Supabase Postgres (session pooler, port 5432)
    - Railway (Dockerfile-based deployment)

    See `pyproject.toml` for the full pin set. See `.env.example` for env vars.

    ## Status

    Phase 4 (Pipeline Skeleton) — in progress. Andrew's end-of-phase smoke test contract lives in CONTEXT.md D-42.
    ```
  </action>
  <verify>
    <automated>grep -F "\"name\": \"pipeline\"" packages/pipeline/package.json && grep -F "uv run uvicorn eisenbalm_pipeline.api.main:app" packages/pipeline/package.json && grep -F "uv run pytest" packages/pipeline/package.json && grep -F "python -m eisenbalm_pipeline.cli setup-checkpointer" packages/pipeline/package.json && test -f packages/pipeline/README.md && grep -F "Phase 4 placeholder" packages/pipeline/README.md && pnpm --filter pipeline run lint</automated>
  </verify>
  <done>
    - `packages/pipeline/package.json` has scripts `dev`, `test`, `test:quick`, `lint`, `setup-checkpointer` — `dev` and `test` shell to `uv run`
    - `pnpm --filter pipeline run lint` exits 0 (proves pnpm workspace discovers the package)
    - `packages/pipeline/README.md` exists with a "Phase 4 placeholder — Plan 11 rewrites" note; hatchling can resolve the `readme = "README.md"` reference during build
    - Plan 11 owns the full rewrite — this is intentionally minimal
  </done>
</task>

</tasks>

<verification>
After all four tasks land:

1. `cd packages/pipeline && uv sync --frozen` exits 0 (uv.lock is reproducible).
2. `cd packages/pipeline && uv run python -c "import eisenbalm_pipeline; print(eisenbalm_pipeline.__version__)"` prints `0.1.0`.
3. `pnpm --filter pipeline run lint` exits 0.
4. `grep -F "libpango-1.0-0" packages/pipeline/Dockerfile` AND `grep -F "libcairo2"` AND `grep -F "fonts-liberation"` all succeed (PIP-01 evidence — WeasyPrint deps preinstalled).
5. `grep -F "preDeployCommand" packages/pipeline/railway.toml` succeeds (CONTEXT D-12 evidence).
6. `! test -e packages/pipeline/tsconfig.json` (TypeScript artifact deleted).
7. Root `.env.example` references the Phase 4 vars without touching Phase 1-3 sections.

Manual verification (deferred to Plan 12 / Andrew):
- Actual `docker build` against Railway only — local Docker is optional per VALIDATION §Manual-Only.
- Actual `railway up` only after Andrew provisions the Railway project (Plan 12, CONTEXT D-29).
</verification>

<success_criteria>
- PIP-01 evidence: Dockerfile exists with all WeasyPrint system deps preinstalled; railway.toml declares the build, healthcheck, and preDeployCommand. Andrew's Plan 12 smoke test closes PIP-01 by running `railway up` and observing the green build + healthcheck.
- Foundation is sealed for Wave 1+: every subsequent plan can `import eisenbalm_pipeline...`, run `uv run pytest`, and assume the env vars in `.env.example`.
- No Phase 3 contract churn: Convex queries/mutations untouched; Sanity schemas untouched; pnpm-workspace.yaml untouched.
</success_criteria>

<output>
After completion, create `.planning/phases/04-pipeline-skeleton/04-01-python-project-bootstrap-SUMMARY.md` recording:
- The actual exact dep pins resolved by `uv lock` (paste the relevant section of uv.lock for langgraph + langgraph-checkpoint-postgres + psycopg + fastapi as evidence)
- Any deviation from CONTEXT.md D-04 (the two sub-dep additions ARE expected — research §1 flags them)
- Confirmation that `pnpm --filter pipeline run lint` exits 0
- Confirmation that `packages/pipeline/tsconfig.json` was deleted
- Forward link to Plan 02 (DispatchState + lib modules), Plan 03 (Convex schema patch), Plan 04 (Sanity schema patch), Plan 05 (pytest infra) which can now run in parallel
</output>
