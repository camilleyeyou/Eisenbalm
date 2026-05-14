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
