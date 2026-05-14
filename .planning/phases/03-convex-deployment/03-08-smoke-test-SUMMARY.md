---
plan: 03-08-smoke-test
phase: 03-convex-deployment
status: complete
completed: 2026-05-13
type: human-action-checkpoint
requirements: [CVX-01, CVX-02, CVX-03, CVX-04, CVX-05]
---

# Plan 03-08 — End-of-Phase Smoke Test — SUMMARY

## What Was Verified

Andrew completed the end-of-phase manual smoke test (D-23). All five CVX-* requirements verified observable against the live Convex deployment `modest-magpie-797` (dev tier).

| Step | Requirement | Result |
|------|-------------|--------|
| 1 | CVX-01 — Schema deployed | ✓ Dashboard shows 5 tables (0 rows each); 5 modules with correct function exports |
| 2 | CVX-02 — Query functions exist | ✓ All 5 `byRunId` queries return `null` (pipelineRuns) or `[]` (others) against `runId: "nonexistent-smoke-test"` |
| 3 | CVX-05 — `useQuery` returns empty without error | ✓ `localhost:3000/_debug/convex` renders 5-row dry table with `0 rows` each; no Convex-related console errors |
| 4 | CVX-03 — Mutations live + live reactivity | ✓ Dashboard `pipelineRuns:create` succeeded; debug page row updated from `0` to `1` reactively |
| 5 | CVX-03 + Phase 4 readiness — HTTP API | ✓ `POST /api/mutation` with `Authorization: Convex <key>` returned `{"status":"success","value":"jd73k99g64z1tv5as5htt1nd5n86p1d4"}` |
| 6 | CVX-04 — Vercel + Railway env | **Deferred** (per plan Case B) — projects don't exist yet; provisioning commands documented in both READMEs |

## Discovery: Deploy Key Quoting

**Symptom:** Step 5's HTTP API curl initially returned `{"code":"InvalidHeaderFailure","message":"Invalid authentication header"}`.

**Diagnosis:** The variable was loading as length 0. Convex deploy keys contain a literal `|` character (`dev:<deployment-name>|<jwt>`). When `source apps/web/.env.local` parses an unquoted line, the shell interprets `|` as a pipe operator and silently truncates the assignment.

**Fix:** Wrap deploy key value in single quotes in `.env.local`. Both `.env.example` templates (root and `apps/web/`) updated to ship the convention with explanatory comments (commit `3d00254`).

**Phase 4 implication:** The Python pipeline reads env vars via `os.environ` (Railway provides them directly to the process, no shell parsing), so this is a local-dev-only hazard. The `.env.example` documentation prevents the trap for future engineers.

## Validated Deviation: Dev Deployment as Single Environment

Confirmed Step 5 works with a `dev:` key (not only `prod:`). Combined with the 03-02 deviation note ("v1 uses dev deployment as single Convex environment"), this means:
- Phase 3 verification passes against the dev deployment
- Phase 4 pipeline writes will work against the dev deployment too — no production promotion required to start the pipeline
- Production deployment can be created later if/when separation of dev test data from production becomes important

## Acceptance Criteria — All Met

| Criterion | Status |
|-----------|--------|
| CVX-01: 5 tables visible on dashboard, `_generated/api.d.ts` references all 5 | ✓ |
| CVX-02: 5 `byRunId` queries callable, each returns empty against nonexistent runId | ✓ |
| CVX-03: `pipelineRuns:create` succeeds via dashboard and HTTP API | ✓ |
| CVX-04: Deploy key provisioned in `apps/web/.env.local`; Vercel/Railway commands documented; remote provisioning deferred per Case B | ✓ (deferred portion explicit) |
| CVX-05: `useQuery` returns 0-row counts without error; reactive updates work | ✓ |

## Commits

| Commit | Message |
|--------|---------|
| `3d00254` | `docs(03-08): document deploy-key quoting in .env.example files` |
| `<this>` | `docs(03-08): write SUMMARY and close Plan 03-08` |
| `<next>` | `docs(phase-03): complete phase execution` (closes Phase 3) |

## What This Closes

Phase 3 (Convex Deployment) is functionally complete. All five CVX-* requirements pass observable verification. Phase 4 (Pipeline Skeleton) is unblocked:
- Convex backend is live and reachable
- HTTP API auth pattern (`Authorization: Convex <key>`) verified working
- Web app subscribes to all five tables via `useQuery` without error
- `convex/_generated/api` provides typed handles for Python codegen reference

## Known Carry-Forward Items (Phase 4 Reference)

1. **Vercel env provisioning** for `apps/web` — when Phase 6+ deploys to Vercel, run `vercel env add NEXT_PUBLIC_CONVEX_URL production` and `vercel env add CONVEX_DEPLOY_KEY production` (commands in `apps/web/README.md`).
2. **Railway env provisioning** for the Python pipeline — when Phase 4's `pnpm-railway-bootstrap` plan runs, set both env vars per `convex/README.md`.
3. **Production deployment** — if the project ever needs to separate dev test data from production, run `pnpm --filter @eisenbalm/convex deploy` from a context with a `prod:` deploy key; otherwise stay on `modest-magpie-797` (dev tier) as the single environment.

---

*Plan: 03-08-smoke-test*
*Completed: 2026-05-13*
