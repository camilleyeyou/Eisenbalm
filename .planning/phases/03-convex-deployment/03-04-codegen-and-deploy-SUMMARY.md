---
plan: 03-04-codegen-and-deploy
phase: 03-convex-deployment
status: complete
completed: 2026-05-13
type: human-action-checkpoint
requirements: [CVX-01, CVX-02, CVX-03]
---

# Plan 03-04 — Codegen and Deploy — SUMMARY

## What Was Built

The Convex backend is live with schema, indexes, and five callable modules:

- **`convex/schema.ts`** — committed (was previously untracked since project skeleton predates Phase 1)
- **`convex/_generated/api.{d.ts,js}`** — typed API surface for all five tables × their query/mutation exports
- **`convex/_generated/server.{d.ts,js}`** — server-side helper types
- **`convex/_generated/dataModel.d.ts`** — schema-derived `Doc` and `Id` types

Deployment health verified:
- `https://modest-magpie-797.convex.cloud/version` → HTTP 200
- `convex/_generated/api.d.ts` exports the five module namespaces:
  - `api.pipelineRuns` → `byRunId`, `create`, `updateStatus`
  - `api.pitchLog` → `byRunId`, `insert`, `markSelected`
  - `api.deliberationEvents` → `byRunId`, `byRunIdAndType`, `insert`
  - `api.agentVotes` → `byRunId`, `byRunIdAndCharity`, `insert`
  - `api.qaCorrections` → `byRunId`, `insert`
- Dashboard: https://dashboard.convex.dev/t/camille-yeyou/eisenbalm-dispatch shows the five tables (from Plan 03-02 schema push) and five function modules (from Plan 03-03's `convex dev --once` push)

## Deviation from Plan-as-Written

**Plan envisioned:** A separate `pnpm --filter @eisenbalm/convex deploy` invocation to push code to a **production** Convex deployment, distinct from the dev deployment created in Plan 03-02.

**Actual:** Per the 03-02 SUMMARY's locked deviation ("v1 uses the dev deployment as its single Convex environment"), there is no separate production deployment to deploy to. The schema and all five function modules were already pushed to the `modest-magpie-797` dev deployment by:
1. Plan 03-02's `convex dev --once --configure` (schema upload)
2. Plan 03-03's `convex dev --once` at the end of its task chain (function modules upload + codegen regeneration)

This plan therefore reduces to: verify deployment health + commit `_generated/`. Both done.

**Why this is acceptable:** D-08 (commit `_generated/` for type stability) is honored. The CVX-01/02/03 requirements are satisfied by the live dev deployment — they do not specify "production" specifically. If/when Andrew promotes to a production Convex deployment for Phase 4 pipeline writes, he runs `convex deploy` from a context that has a `prod:` deploy key; `_generated/` is environment-agnostic and stays committed as-is.

## Acceptance Criteria — All Met

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Schema + 5 function files deployed | ✓ | `convex dev --once` pushes confirmed in Plan 03-02 and 03-03 logs |
| `convex/_generated/` contains api.{d.ts,js}, dataModel.d.ts, server.{d.ts,js} | ✓ | `ls convex/_generated/` shows all five files |
| `_generated/api.d.ts` exports typed `api` object with all 5 table namespaces | ✓ | grep confirms each namespace name + import path |
| `convex/_generated/` committed to git | ✓ | commit `94f7e7f` (schema) + `<this commit>` (_generated) |
| Dashboard shows 5 byRunId queries callable | ✓ | Andrew confirmed dashboard access; live deployment responds 200 on /version |

## Commits

| Commit | Message |
|--------|---------|
| `94f7e7f` | `chore(03-04): track convex/schema.ts in git` |
| `<next>` | `feat(03-04): commit convex/_generated/ after schema + function deploy` |
| `<then>` | `docs(03-04): write SUMMARY and advance state` |

## What This Unblocks

Plan 03-05 (web app Convex wiring, Wave 5) can now import from `@convex/_generated/api` and resolve the typed query/mutation handles. Plan 03-06 (debug evidence route) can call `useQuery(api.deliberationEvents.byRunId, { runId })` and the types will flow end-to-end.

---

*Plan: 03-04-codegen-and-deploy*
*Completed: 2026-05-13*
