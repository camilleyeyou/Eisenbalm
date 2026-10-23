# Phase 56 Pre-flight

Phase start commit: 58124eefba02ad39c724de489bf9c90b0667b551

## Env keys
- apps/dispatch-control/.env.local: NEXT_PUBLIC_PIPELINE_URL=http://localhost:8000
- packages/pipeline/.env (gitignored): DASHBOARD_ALLOWED_ORIGINS=http://localhost:3001

## Pipeline
- /health does not exist (404). The health route is /healthz: 200.
- IMPORTANT FINDING: `pnpm --filter pipeline dev` (uv run uvicorn) does NOT load packages/pipeline/.env. Started that way, CORS falls back to the default http://localhost:3000 and an OPTIONS probe from :3001 returns 400 "Disallowed CORS origin".
- Fix (no repo change): export the variable when starting the pipeline for browser QA:
  `cd packages/pipeline && DASHBOARD_ALLOWED_ORIGINS=http://localhost:3001 uv run uvicorn eisenbalm_pipeline.api.main:app --host 127.0.0.1 --port 8000`
- Probe: OPTIONS /runs/x/cancel with Origin http://localhost:3001 returned 200 with
  `access-control-allow-origin: http://localhost:3001`
- CORS: PASS (with the env var exported on the command line)
- Pipeline stopped after the probe.

## Baseline
Baseline: 108 files pass, 1 skipped (1024 tests pass, 2 todo, 0 failures). The previously noted SectionReaderPage failure is not present.

## Notes
OPENROUTER_API_KEY revoked 2026-10-22: Start a new issue / Rewrite this part cannot be exercised end-to-end until replaced on Railway + local .env.
Draft loading in a browser was not exercised here; that is covered by 56-13.
