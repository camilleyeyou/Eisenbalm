---
phase: quick-260625-2vb
plan: 01
subsystem: pipeline-api
tags: [cors, fastapi, dispatch-control, ops]
requires: []
provides:
  - "Env-driven CORSMiddleware on the pipeline FastAPI app (DASHBOARD_ALLOWED_ORIGINS)"
  - "Preflight allow + non-listed-origin deny test coverage"
  - "DASHBOARD_ALLOWED_ORIGINS documented in pipeline env docs + DEPLOY.md"
affects:
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
tech-stack:
  added: []
  patterns:
    - "Starlette CORSMiddleware with allow_credentials=True requires explicit origin list (no wildcard)"
key-files:
  created:
    - packages/pipeline/tests/api/test_cors.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py
    - packages/pipeline/.env.example
    - packages/pipeline/README.md
    - apps/dispatch-control/DEPLOY.md
decisions: []
requirements: [CORS-01]
metrics:
  tasks: 3
  files: 5
  completed: "2026-06-25"
---

# Quick 260625-2vb: Env-driven CORS for the FastAPI pipeline Summary

Added credentialed, env-driven CORSMiddleware to the pipeline FastAPI app so the dispatch-control dashboard (a browser app on a separate Vercel origin) can call the pipeline's `/agents/{key}/test-run`, `/agents/{key}/score`, `/pipeline/run`, `/runs/*`, and `/review` endpoints with its Clerk `Authorization: Bearer` token. Origins are read from `DASHBOARD_ALLOWED_ORIGINS` (comma-separated), defaulting to `http://localhost:3000`.

## What changed

- **`api/main.py`** — imports `CORSMiddleware` and registers it right after `app = FastAPI(...)` and before the `include_router` calls. Origins are parsed from `os.environ.get("DASHBOARD_ALLOWED_ORIGINS", "")` (comma-split, stripped, empties dropped), defaulting to `["http://localhost:3000"]` when unset/blank. Registered with `allow_credentials=True`, `allow_methods=["*"]`, `allow_headers=["*"]`. A comment notes that `allow_credentials=True` forbids a wildcard `"*"` origin (Starlette won't echo `"*"` for credentialed requests), so origins are an explicit list, and that `allow_headers=["*"]` is needed for the dashboard's `Authorization: Bearer` Clerk token.
- **`tests/api/test_cors.py`** (new) — two sync `TestClient` tests against the REAL composed app (`eisenbalm_pipeline.api.main.app`, where the middleware exists, unlike the bare single-router apps in `test_score.py`). Test 1: OPTIONS preflight from `http://localhost:3000` returns a matching `access-control-allow-origin`. Test 2: a preflight from `https://evil.example.com` does NOT receive that origin echoed back. Uses `/agents/scout/score` (a real mounted POST route) as the preflight target; `with TestClient(app)` runs lifespan and the degraded boot (graph=None, no Postgres) is expected and harmless.
- **`.env.example` / `README.md` / `DEPLOY.md`** — documented `DASHBOARD_ALLOWED_ORIGINS`: a commented entry with the default in the pipeline env example, a new env-table row in the pipeline README, and a callout in dispatch-control's DEPLOY.md clarifying that the **Railway pipeline service** (not the dispatch-control Vercel project) must set it to the dashboard's Vercel domain, placed next to the `NEXT_PUBLIC_PIPELINE_URL` reference.

## Verification

- `EISENBALM_STUB_MODE=1 uv run pytest tests/api/test_cors.py -x -q` → **2 passed**.
- `EISENBALM_STUB_MODE=1 uv run pytest tests/api -q` → **19 passed, 9 skipped** (CORS is additive; no behavior change to existing routes; skips are pre-existing).
- `app.user_middleware` contains `CORSMiddleware`.
- `grep DASHBOARD_ALLOWED_ORIGINS` finds the var in `main.py` + all three doc files.
- No `git push` / deploy performed — local commits only.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `43429fc` feat(quick-260625-2vb-01): wire env-driven CORSMiddleware into pipeline app
- `4b8242d` test(quick-260625-2vb-01): add CORS preflight allow + non-listed-origin deny tests
- `0d80222` docs(quick-260625-2vb-01): document DASHBOARD_ALLOWED_ORIGINS for ops

## Self-Check: PASSED

- FOUND: packages/pipeline/tests/api/test_cors.py
- FOUND: commit 43429fc
- FOUND: commit 4b8242d
- FOUND: commit 0d80222
