---
phase: 04-pipeline-skeleton
plan: 01
subsystem: pipeline-bootstrap
tags: [python, uv, fastapi, langgraph, railway, dockerfile, weasyprint]
requirements: [PIP-01]
dependency_graph:
  requires: []
  provides:
    - "Python project at packages/pipeline/ (uv-managed, src layout)"
    - "All Phase 4 deps pinned + locked (uv.lock)"
    - "Dockerfile with WeasyPrint apt deps preinstalled (PIP-01 evidence)"
    - "railway.toml with preDeployCommand setup-checkpointer (CONTEXT D-12)"
    - "Per-workspace .env.example + root .env.example reference"
    - "pnpm workspace bridge (pnpm --filter pipeline {dev,test,setup-checkpointer})"
  affects:
    - "Unblocks Plans 04-02..04-12 — every subsequent plan imports eisenbalm_pipeline and runs under uv run pytest"
tech_stack:
  added:
    - "Python 3.11 (>=3.11,<3.12)"
    - "uv 0.11.7 (local); ghcr.io/astral-sh/uv:0.5.10 (Docker)"
    - "fastapi==0.136.1"
    - "uvicorn[standard]==0.46.0"
    - "langgraph==1.1.10"
    - "langgraph-checkpoint-postgres==3.1.0"
    - "psycopg[binary]>=3.2,<4 (resolved to 3.3.4)"
    - "pydantic==2.13.4"
    - "httpx==0.28.1"
    - "langchain-openai==1.2.1"
    - "supabase==2.30.0"
    - "python-slugify==8.0.4"
    - "pytest>=8.3,<9 (dev)"
    - "pytest-asyncio>=0.24,<1 (dev)"
    - "respx>=0.21 (dev)"
  patterns:
    - "src/ layout (packages/pipeline/src/eisenbalm_pipeline/)"
    - "Multi-stage Dockerfile (builder + runtime) with uv binary copy from ghcr.io"
    - "Non-root Docker user (UID 10001)"
    - "Generated/locked artifacts committed (uv.lock) — mirrors Phase 1 sanity.types.ts and Phase 3 convex/_generated/"
    - "pnpm workspace bridge scripts shell to uv run (mirrors Phase 3 @eisenbalm/convex deploy)"
key_files:
  created:
    - "packages/pipeline/pyproject.toml"
    - "packages/pipeline/uv.lock"
    - "packages/pipeline/.gitignore"
    - "packages/pipeline/.dockerignore"
    - "packages/pipeline/Dockerfile"
    - "packages/pipeline/railway.toml"
    - "packages/pipeline/.env.example"
    - "packages/pipeline/src/eisenbalm_pipeline/__init__.py"
  modified:
    - "packages/pipeline/package.json (pnpm workspace bridge scripts)"
    - "packages/pipeline/README.md (Phase 4 placeholder; Plan 11 rewrites)"
    - ".env.example (appended Phase 4 reference block)"
  deleted:
    - "packages/pipeline/tsconfig.json (Python lives here, not TS)"
decisions:
  - "Sub-deps langgraph-checkpoint-postgres==3.1.0 + psycopg[binary]>=3.2,<4 added per RESEARCH §1 (CONTEXT D-04 omits them; research §1 flags as MANDATORY)"
  - "uv.lock committed (95 packages resolved) — reproducible builds match Phase 1+3 generated-artifact pattern"
  - "Dockerfile WeasyPrint deps installed in Phase 4 (CONTEXT D-28) even though Phase 6 owns PDF — avoids Dockerfile churn at phase boundary"
  - "railway.toml uses preDeployCommand (not release hook) for setup-checkpointer per RESEARCH §9 (CONTEXT D-12)"
  - ".env.example documents transaction-pooler and direct-connection as WRONG with comments (RESEARCH §7 + Pitfalls 1+2) — defensive onboarding"
metrics:
  duration_minutes: 4
  completed_date: "2026-05-14"
  tasks_completed: 4
  files_changed: 12
---

# Phase 04 Plan 01: Python Project Bootstrap Summary

Bootstrapped the `packages/pipeline/` Python project end-to-end with uv 0.11.7 + Python 3.11, generating a reproducible `uv.lock` (95 packages, including the two research §1 sub-deps `langgraph-checkpoint-postgres==3.1.0` + `psycopg[binary]>=3.2,<4` that CONTEXT D-04 omits), authored a multi-stage Dockerfile preinstalling all 13 WeasyPrint apt deps for Railway (PIP-01 evidence), wrote `railway.toml` with `preDeployCommand` invoking `setup-checkpointer` (CONTEXT D-12), documented all six new Phase 4 env vars in `packages/pipeline/.env.example` plus an additive reference block in root `.env.example`, wired the pnpm workspace bridge (`pnpm --filter pipeline dev|test|setup-checkpointer` shells to `uv run`), and deleted the Phase 1 `tsconfig.json` placeholder.

## What Shipped

### Task 1 — uv project scaffold (commit `807c1c6`)

- `pyproject.toml` with exact pin set from CONTEXT D-04 + the two research §1 sub-deps (load-bearing: `AsyncPostgresSaver` requires both)
- `[tool.uv] package = true` per CONTEXT D-03 enables editable install
- `[tool.pytest.ini_options] asyncio_mode = "auto"` per VALIDATION §Wave 0 — Plan 05 adds tests, doesn't configure pytest
- `src/eisenbalm_pipeline/__init__.py` with `__version__ = "0.1.0"` (package marker)
- `.gitignore` (Python + uv standards; `.venv/`, `.pytest_cache/`, `.env*`)
- `tsconfig.json` deleted via `git rm`
- `uv lock` resolved 95 packages; `uv sync --frozen` materializes `.venv/`; import smoke test passes

**Resolved versions of critical pins (from `uv.lock`):**

```toml
name = "fastapi"
version = "0.136.1"

name = "langgraph"
version = "1.1.10"

name = "langgraph-checkpoint-postgres"
version = "3.1.0"

name = "psycopg"
version = "3.3.4"   # resolved within >=3.2,<4
```

### Task 2 — Dockerfile + .dockerignore (commit `9853c4a`)

- Multi-stage `python:3.11-slim-bookworm` (builder + runtime)
- Builder: `uv` from `ghcr.io/astral-sh/uv:0.5.10` (pinned); cache mount + bind mount for layer caching; `uv sync --frozen --no-dev`
- Runtime: 13 WeasyPrint apt deps preinstalled (merged CONTEXT D-28 + RESEARCH §8 lists)
- Non-root `app` user (UID 10001); `PYTHONUNBUFFERED=1`; `.venv` on `PATH`
- `CMD` targets `eisenbalm_pipeline.api.main:app` (Plan 09 wires the actual FastAPI app)
- `.dockerignore` excludes `.venv/`, `tests/`, `.git/`, `.planning/`, keeps `README.md` (hatchling needs it)

### Task 3 — railway.toml + .env.example + root .env.example (commit `27011cb`)

- `railway.toml`: `[build] builder=DOCKERFILE`; `[deploy] healthcheckPath=/healthz` (60s timeout); `restartPolicyType=ON_FAILURE` (max 3); `preDeployCommand=["python -m eisenbalm_pipeline.cli setup-checkpointer"]`
- `packages/pipeline/.env.example`: 6 new Phase 4 vars + 4 reused from earlier phases; session-pooler URL format documented as CORRECT; transaction-pooler (port 6543) and direct-connection (`db.<ref>.supabase.co`) both shown as WRONG with full rationale (Pitfalls 1+2)
- Root `.env.example`: appended "Phase 4 — Pipeline" reference block (additive only; Phase 1-3 sections untouched)

### Task 4 — pnpm workspace bridge + README placeholder (commit `442fe05`)

- `package.json` scripts now shell to `uv run`: `dev` (uvicorn --reload), `test` (pytest -v), `test:quick` (pytest -x), `lint` (no-op for Phase 4), `setup-checkpointer` (CLI)
- `README.md` Phase 4 placeholder — minimal content so hatchling's `readme = "README.md"` field resolves; Plan 11 owns the full rewrite per CONTEXT D-40
- `pnpm --filter pipeline run lint` exits 0 (proves pnpm-workspace.yaml discovers the workspace)

## Deviations from Plan

None — plan executed exactly as written.

The two sub-dep additions (`langgraph-checkpoint-postgres==3.1.0` + `psycopg[binary]>=3.2,<4`) are *not* deviations from CONTEXT.md D-04 — they are the planner's intentional augmentation per RESEARCH §1, which calls out: "CONTEXT D-04 omits these but `AsyncPostgresSaver` requires both". The plan flagged this explicitly in its `<interfaces>` block.

## Verification Evidence

All `<verify>` blocks pass:

```bash
# Task 1
$ uv lock --check && uv sync --frozen && uv run python -c "import eisenbalm_pipeline; print(eisenbalm_pipeline.__version__)"
Resolved 95 packages in 5ms
Checked 93 packages in 2ms
0.1.0

# Task 2 — Dockerfile WeasyPrint deps present
$ grep -F "libpango-1.0-0|libcairo2|libgdk-pixbuf-2.0-0|shared-mime-info|fonts-liberation|libharfbuzz-subset0|python:3.11-slim-bookworm|useradd --create-home --uid 10001 app|uv sync --frozen --no-dev" Dockerfile
ALL PRESENT

# Task 3 — railway.toml + env.example
$ grep -F "preDeployCommand|setup-checkpointer|/healthz|SUPABASE_POSTGRES_URL|aws-0-REGION.pooler.supabase.com:5432|EISENBALM_STUB_MODE=true|PIPELINE_TRIGGER_SECRET|Phase 4 — Pipeline"
ALL PRESENT

# Task 4 — pnpm bridge
$ pnpm --filter pipeline run lint
> echo "Lint: not configured in Phase 4 — defer to Phase 5+" && exit 0
exit 0
```

## Confirmations

- `pnpm --filter pipeline run lint` exits 0 ✓
- `packages/pipeline/tsconfig.json` deleted (confirmed `! test -e ...`) ✓
- `uv run python -c "import eisenbalm_pipeline"` prints `0.1.0` ✓
- `uv.lock` committed (1490 lines, 95 packages) — reproducible builds ✓
- Root `.env.example` Phase 1-3 sections untouched (additive only) ✓

## Forward Links

The following plans are now unblocked and can run in Wave 1 (parallel after Plan 01):

- **Plan 04-02** (DispatchState + lib modules) — can now `import eisenbalm_pipeline` and add `graph/state.py`, `lib/sanity_client.py`, `lib/convex_client.py`, `lib/portable_text.py`
- **Plan 04-03** (Convex schema patch) — independent; adds `durationMs` + `cost` to `pipelineRuns` per CONTEXT D-39
- **Plan 04-04** (Sanity schema patch) — independent; adds `pipelineMetadata.cost` to `weeklyIssue` per CONTEXT D-24
- **Plan 04-05** (pytest infra) — can now write `tests/conftest.py` against the pytest config already in `pyproject.toml`

## Self-Check: PASSED

- `packages/pipeline/pyproject.toml` — FOUND (`grep -F "langgraph==1.1.10"` succeeds)
- `packages/pipeline/uv.lock` — FOUND (95 packages resolved)
- `packages/pipeline/.gitignore` — FOUND
- `packages/pipeline/Dockerfile` — FOUND (WeasyPrint deps present)
- `packages/pipeline/.dockerignore` — FOUND
- `packages/pipeline/railway.toml` — FOUND (preDeployCommand present)
- `packages/pipeline/.env.example` — FOUND (6 new vars present)
- `packages/pipeline/package.json` — UPDATED (uv run scripts present)
- `packages/pipeline/README.md` — UPDATED (Phase 4 placeholder)
- `packages/pipeline/src/eisenbalm_pipeline/__init__.py` — FOUND (`__version__`)
- `packages/pipeline/tsconfig.json` — DELETED
- `.env.example` — UPDATED (Phase 4 block appended)
- Commit `807c1c6` — FOUND in `git log`
- Commit `9853c4a` — FOUND in `git log`
- Commit `27011cb` — FOUND in `git log`
- Commit `442fe05` — FOUND in `git log`
