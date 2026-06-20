---
phase: quick-260620-far
plan: 01
subsystem: pipeline
tags: [cli, railway, cron, ops, V2-03]
requires: ["POST /run/weekly endpoint (api/runs.py — pre-existing)", "PIPELINE_TRIGGER_SECRET env var"]
provides: ["trigger-weekly CLI subcommand", "PIPELINE_SELF_URL env var", "weekly-cron-service setup docs"]
affects: ["packages/pipeline/src/eisenbalm_pipeline/cli.py", "packages/pipeline/.env.example", "packages/pipeline/README.md"]
tech-stack:
  added: []
  patterns: ["httpx.AsyncClient POST with raise_for_status for fire-and-exit cron trigger", "stderr-message + sys.exit(nonzero) failure convention reused from _require_postgres_url"]
key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/cli.py
    - packages/pipeline/.env.example
    - packages/pipeline/README.md
decisions:
  - "Cron only FIRES the trigger (POST /run/weekly) rather than running the graph inline — the graph pauses at Editor Gate 1 for hours/days, far longer than a cron job should live."
  - "A SEPARATE Railway cron service runs trigger-weekly — railway.toml is intentionally left unchanged because a cronSchedule there would convert the always-on web API into a cron job and break it."
  - "trigger-weekly refuses to run (exit 2) when PIPELINE_TRIGGER_SECRET is unset — even though the endpoint skips the check when its own secret is unset, sending no header from a production cron is the unsafe path, so refusing is correct."
metrics:
  duration: ~6 min
  completed: 2026-06-20
---

# Phase quick-260620-far Plan 01: Add Automatic Weekly Railway Cron Trigger Summary

Added a `trigger-weekly` CLI subcommand that fires an authenticated `POST {PIPELINE_SELF_URL}/run/weekly` (X-Pipeline-Trigger-Secret header) and exits 0/nonzero so a separate Railway cron service can run the Thursday 14:00 UTC trigger and mark failures — plus the docs to stand up that cron service without touching the always-on web API.

## What Was Built

**Task 1 — `trigger-weekly` subcommand (`cli.py`):**
- Added `import httpx` and a `DEFAULT_PIPELINE_SELF_URL = "https://eisenbalm-pipeline-production.up.railway.app"` module constant.
- `async def trigger_weekly()`:
  - Reads `PIPELINE_TRIGGER_SECRET`; missing → stderr message + `sys.exit(2)`.
  - Resolves `base_url` from `PIPELINE_SELF_URL` (default = the production constant), `rstrip("/")`, builds `{base_url}/run/weekly`.
  - POSTs empty JSON `{}` with the `X-Pipeline-Trigger-Secret` header via `httpx.AsyncClient(timeout=30.0)`, `raise_for_status()`.
  - `httpx.HTTPStatusError` → stderr with status + truncated body, exit 1. `httpx.HTTPError` (network/DNS/timeout) → stderr, exit 1.
  - On success prints `Triggered weekly run: runId=<id>`.
- Registered `"trigger-weekly": trigger_weekly` in `_SUBCOMMANDS`, added the invocation line to `USAGE`, and documented it in the module docstring (Subcommands / Invocation / Used by — the SEPARATE-cron-service note).
- Existing `setup-checkpointer`, `setup-webhook-idempotency`, `_require_postgres_url`, and `main()` are untouched.

**Task 2 — docs (`.env.example`, `README.md`):**
- `.env.example`: added `PIPELINE_SELF_URL` near `PIPELINE_TRIGGER_SECRET` with a comment covering purpose, the production default, and that it is read ONLY by the cron service's `trigger-weekly`.
- `README.md`: added a `PIPELINE_SELF_URL` env-var table row and a new `### Weekly cron trigger (V2-03)` section (placed after the manual `setup-checkpointer` block, before `### Build & runtime config`) covering: WHAT (separate service running `trigger-weekly` on `0 14 * * 4`), WHY separate (cron must exit / web service must not — railway.toml left unchanged), WHY fire-only (Editor Gate 1 pause), the env vars the cron needs, and the manual Andrew handoff steps.

## Verification

- `uv run python -m eisenbalm_pipeline.cli` (no args) prints USAGE including `trigger-weekly` and exits 1.
- AST check confirms `trigger_weekly` is defined; module imports cleanly; function set is `{_require_postgres_url, main, setup_checkpointer, setup_webhook_idempotency, trigger_weekly}`.
- `.env.example` contains `PIPELINE_SELF_URL`; `README.md` contains `trigger-weekly` and `0 14 * * 4`.
- `git diff` over both commits touches exactly 3 files: cli.py, .env.example, README.md. `railway.toml` and `api/runs.py` are NOT in the diff.

## Deviations from Plan

None — plan executed exactly as written.

## Commits

- `c26b2e7` feat(quick-260620-far): add trigger-weekly CLI subcommand for Railway cron
- `0ff36d9` docs(quick-260620-far): document PIPELINE_SELF_URL + weekly cron service

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: packages/pipeline/src/eisenbalm_pipeline/cli.py (trigger_weekly registered)
- FOUND: packages/pipeline/.env.example (PIPELINE_SELF_URL)
- FOUND: packages/pipeline/README.md (Weekly cron trigger section)
- FOUND commit: c26b2e7
- FOUND commit: 0ff36d9
