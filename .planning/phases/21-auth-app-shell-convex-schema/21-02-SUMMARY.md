---
phase: 21-auth-app-shell-convex-schema
plan: 02
subsystem: convex
tags: [convex, schema, auth, workspace, seeding, clerk]
dependency_graph:
  requires: []
  provides:
    - convex/schema.ts#11-mission-control-tables
    - convex/auth.config.ts
    - convex/workspace.ts#seedEisenbalm
    - convex/users.ts#upsertCurrentUser
  affects:
    - dispatch-control (consumes users.upsertCurrentUser on first sign-in)
    - Phase 22 (pipeline_config, agents stubs ready to flesh out)
    - Phase 23 (agent_runs, runs stubs ready)
    - Phase 24 (prompt_versions stub ready)
    - Phase 26 (charities, review_actions stubs ready)
    - Phase 27 (model_pricing stub ready)
tech_stack:
  added: []
  patterns:
    - idempotent-upsert-by-index (seedEisenbalm mirrors stripeEvents.claim pattern)
    - jit-user-provisioning (upsertCurrentUser on first authenticated call)
    - workspace-scoped-tables (workspace_id: v.string() on all 11 new tables)
    - deployment-level-auth-config (convex/auth.config.ts separate from app-level)
key_files:
  created:
    - convex/auth.config.ts
    - convex/workspace.ts
    - convex/users.ts
  modified:
    - convex/schema.ts
decisions:
  - D-14 confirmed: workspace_id is v.string() slug, NOT v.id('workspaces')
  - D-16 confirmed: 'eisenbalm' literal appears only in seed data + DEFAULT_WORKSPACE_ID constant
  - D-17 confirmed: pipelineRuns and deliberationEvents are FROZEN — untouched
  - TDD choice: convex-test not installed in @eisenbalm/convex package; manual npx convex run x2 documented as CFG-05 idempotency proof
metrics:
  duration: ~4 minutes
  completed: "2026-06-21"
  tasks_completed: 2
  files_modified: 4
---

# Phase 21 Plan 02: Convex Schema Extension + Auth Config Summary

**One-liner:** 11 workspace-scoped Mission Control tables appended to Convex schema (4 full-shape with attribution, 7 stubs) + Clerk JWT trust config + idempotent eisenbalm seed + JIT user upsert keyed by Clerk sub.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Append 11 Mission Control tables to convex/schema.ts | c789a1f | convex/schema.ts |
| 2 | auth.config.ts + idempotent seed + JIT user upsert | bbe1ca2 | convex/auth.config.ts, convex/workspace.ts, convex/users.ts |

## What Was Built

### Task 1: 11 New Convex Tables

Appended below the existing `emailSends` table, led by the ASCII section header:
`// ── Mission Control v2.0 — Phase 21 ─────────────────────────────────────────`

**Full-shape tables (all fields, used by Phase 21 auth/seed flows):**
- `workspaces`: `workspace_id`, `name`, `createdAt`
- `users`: `workspace_id`, `clerkUserId`, `email`, `displayName?`, `role?`, `createdAt`, `lastSeenAt`
- `runs`: `workspace_id`, `runId` (join key for frozen `pipelineRuns`), `triggerSource`, `triggeredBy?`, `configSnapshot?`, `status`, `startedAt`, `completedAt?`, `cost?`, `durationMs?`
- `audit_log`: `workspace_id`, `actorId`, `action`, `resourceType?`, `resourceId?`, `before?`, `after?`, `timestamp`

**Stub tables (workspace_id + minimal keys; owning phase fleshes out):**
- `agents` (Phase 22), `prompt_versions` (Phase 24), `pipeline_config` (Phase 22)
- `agent_runs` (Phase 23), `charities` (Phase 26), `model_pricing` (Phase 27), `review_actions` (Phase 26)

Every table carries `workspace_id: v.string()` and `.index('by_workspace', ['workspace_id'])` (CFG-05, D-05, D-14).

### Task 2: Auth Config + Seed + Upsert

**`convex/auth.config.ts`:** Configures the Convex deployment to trust Clerk-issued JWTs. `applicationID: "convex"` must match the Clerk JWT template name exactly (Pitfall 1 from research). Includes full manual setup instructions in comments.

**`convex/workspace.ts`:** `seedEisenbalm` mutation — queries `workspaces` by `by_workspace` for `workspace_id = 'eisenbalm'`; returns `{ seeded: false }` if found; inserts `workspaces` row + `audit_log` row (actorId `system:seed`, action `workspace.seed`) and returns `{ seeded: true }` on first call.

**`convex/users.ts`:** `upsertCurrentUser` mutation — calls `ctx.auth.getUserIdentity()`, throws `'Not authenticated'` if null; queries `users` by `by_clerkUserId` for `identity.subject`; patches `lastSeenAt` on repeat call; inserts full `users` row (workspace_id `DEFAULT_WORKSPACE_ID`) on first call.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `args: {}` to seedEisenbalm to fix TS2742**
- **Found during:** Task 2 typecheck
- **Issue:** `tsc --noEmit` reported `TS2742: The inferred type of 'seedEisenbalm' cannot be named without a reference to './node_modules/convex/...'` — Convex requires explicit args declaration for the type to be portable
- **Fix:** Added `args: {}` (also added `v` import for future use) to make the type annotation explicit
- **Files modified:** convex/workspace.ts
- **Commit:** bbe1ca2

## TDD / Automated Assertions

**Chosen path: `npx convex run workspace:seedEisenbalm` x2 manual proof (documented fallback)**

`convex-test` is not installed as a devDependency in the `@eisenbalm/convex` package, and there is no vitest config in that package. Installing convex-test would require adding `vitest` + `@convex-dev/test-utils` as devDependencies — a non-trivial change to the Convex package that the plan says to skip if the "lightest path" is available.

The lightest path is the manual CLI proof:

```bash
# First call — expect { seeded: true }
npx convex run workspace:seedEisenbalm
# Second call — expect { seeded: false, message: 'eisenbalm workspace already exists' }
npx convex run workspace:seedEisenbalm
```

**Static assurance (fully automated):** `pnpm --filter @eisenbalm/convex typecheck` exits 0, proving the schema compiles correctly with all 11 tables, the mutations have correct types, and the query/patch/insert patterns are type-safe.

**Future:** A `convex/__tests__/workspace.test.ts` using convex-test can be added by Phase 23 when the `@eisenbalm/convex` package gets a proper vitest config.

## Manual Setup Required Before Live Auth Works

Per `convex/auth.config.ts` comments and 21-02-PLAN.md `user_setup`:

1. **Clerk JWT template:** Create a JWT template named exactly `"convex"` in Clerk Dashboard → JWT Templates → Add Template → Convex preset.
2. **Set env var on Convex deployment:**
   ```bash
   npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-frontend-api.clerk.accounts.dev
   ```
   (value = Clerk Dashboard → API Keys → Frontend API URL)
3. **Sync config:**
   ```bash
   npx convex dev   # or npx convex deploy for prod
   ```

Without step 1, `ConvexProviderWithClerk` will throw auth errors even though Clerk sign-in works.

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm --filter @eisenbalm/convex typecheck` exits 0 | PASS |
| `grep -c "defineTable" convex/schema.ts` increased by exactly 11 | PASS (10 → 21) |
| `grep -c "by_workspace'" convex/schema.ts` ≥ 11 | PASS (11) |
| `grep -c "workspace_id: v.string()" convex/schema.ts` = 11 | PASS (11) |
| `convex/auth.config.ts` exists with applicationID + CLERK_JWT_ISSUER_DOMAIN | PASS |
| `convex/workspace.ts` exports seedEisenbalm with workspaces + audit_log inserts | PASS |
| `convex/workspace.ts` returns seeded:false on existing-row branch | PASS |
| `convex/users.ts` exports upsertCurrentUser, calls getUserIdentity, throws on null | PASS |
| `convex/users.ts` patches lastSeenAt on repeat (no duplicate) | PASS |
| 9 existing tables untouched (pipelineRuns, deliberationEvents frozen) | PASS |
| `charities.timesFeatured` correct camelCase (not `timesFeatureD`) | PASS |

## Known Stubs

7 stub tables are intentionally minimal — they carry only `workspace_id` + natural identifying keys. No data flows to them from Phase 21. They exist to satisfy the "workspace_id on every new table from day one" contract (D-05, Pitfall 5). Each owning phase is tagged in the schema comments.

No stubs exist that prevent Phase 21's goal from being achieved — the plan's goal is schema definition + auth config + seed/upsert mutations, not live data flowing through stub tables.

## Self-Check: PASSED

- `/Users/user/Desktop/Eisenbalm/convex/schema.ts` — FOUND, 11 new defineTable blocks confirmed
- `/Users/user/Desktop/Eisenbalm/convex/auth.config.ts` — FOUND
- `/Users/user/Desktop/Eisenbalm/convex/workspace.ts` — FOUND
- `/Users/user/Desktop/Eisenbalm/convex/users.ts` — FOUND
- Commit c789a1f — FOUND (feat: append 11 Mission Control tables)
- Commit bbe1ca2 — FOUND (feat: auth.config.ts + seed + upsert)
