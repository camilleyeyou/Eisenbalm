# packages/pipeline — FastAPI + LangGraph pipeline

**Status:** Placeholder workspace (Phase 1).
**Owner:** Phase 4 — Pipeline Skeleton (LangGraph + 14 stub agents).

This package is **Python**, not TypeScript. Phase 4 introduces the real
project via `uv init --python 3.11` plus a Dockerfile for Railway (WeasyPrint
requires system libs that Railway's default environment does not provide —
see `.planning/research/STACK.md` "Sharp Edges").

The empty `package.json` here exists so the directory is discoverable as a
pnpm workspace and so future cross-language scripts (e.g. orchestration
helpers) have a home if needed. The 14 agents, FastAPI app, LangGraph state
contract, and Convex/Sanity HTTP clients all land in Phase 4.
