---
phase: 21
slug: auth-app-shell-convex-schema
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-21
---

# Phase 21 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Test seams and per-criterion assertions are derived from the "## Validation Architecture"
> section of `21-RESEARCH.md`. The planner fills the Per-Task Verification Map once tasks exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Frontend framework** | vitest (matches `apps/web/vitest.config.ts`); add `apps/dispatch-control/vitest.config.ts` in Plan 01 (Wave 1, Wave-0 role) |
| **Pipeline framework** | pytest (existing `packages/pipeline/tests/`) |
| **Convex** | `pnpm --filter @eisenbalm/convex typecheck` + `codegen` (schema compiles; validators type-check) |
| **Config files** | `apps/dispatch-control/vitest.config.ts` (Plan 01), `packages/pipeline/pyproject.toml` (exists) |
| **Quick run command** | `pnpm --filter dispatch-control test` · `cd packages/pipeline && uv run pytest tests/api -q` |
| **Full suite command** | `pnpm --filter dispatch-control test && pnpm --filter @eisenbalm/convex typecheck && cd packages/pipeline && uv run pytest -q` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick command (frontend vitest OR pipeline pytest OR convex typecheck)
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Success-Criterion → Validation Seam (from RESEARCH §Validation Architecture)

| # | Success Criterion | Requirement | How it's validated | Type |
|---|-------------------|-------------|--------------------|------|
| 1 | Unauthenticated → redirect to Clerk sign-in; after sign-in, shell renders with 7 nav items | AUTH-01 | Unit: `isPublicRoute` matcher test (Plan 03 T2) + nav-coverage test (Plan 05 T2). Manual: load unauth → redirect; sign in → 7 nav links (Plan 03 T3 + Plan 05 T3 checkpoints) | unit + manual |
| 2 | Every dashboard route/API returns redirect/401 without session; `apps/web` has zero Clerk dependency | AUTH-02 | Automated grep: `@clerk` absent from apps/web package.json + source (Plan 01 T2 / Plan 03 T2); middleware matcher unit test (Plan 03 T2). Manual: curl dashboard route unauth → redirect | automated grep + unit + manual |
| 3 | FastAPI dashboard endpoints reject without valid Clerk JWT; cron keeps `X-Pipeline-Trigger-Secret` | AUTH-03 | pytest: `require_clerk_jwt` 401 on missing/invalid/expired (JWKS mocked) + cron-path-unaffected (Plan 04 T2) | unit (pytest) |
| 4 | Audit log + run records carry operator attribution from day one | AUTH-04 | Convex typecheck: `audit_log`/`runs` define actorId/triggeredBy (Plan 02 T1); `upsertCurrentUser` writes Clerk sub + idempotency assertion (Plan 02 T2) | unit + typecheck |
| 5 | All 11 tables carry `workspace_id`; query by `workspace_id="eisenbalm"` returns seeded workspace | CFG-05 | Convex typecheck (11 `defineTable` + `by_workspace`, Plan 02 T1); seed idempotency + workspace query (Plan 02 T2) | unit/integration + typecheck |

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-T1 | 21-01 | 1 | AUTH-01/CFG-05 (scaffold) | typecheck | `pnpm --filter dispatch-control typecheck` | ✅ (created) | ⬜ pending |
| 01-T2 | 21-01 | 1 | AUTH-02 (no-leak grep) + harness | unit + pytest collect | `pnpm --filter dispatch-control test:unit && cd packages/pipeline && uv run pytest tests/api/test_clerk_auth.py --collect-only -q` | ✅ (created) | ⬜ pending |
| 02-T1 | 21-02 | 1 | CFG-05 (11 tables + workspace_id) | typecheck/static | `pnpm --filter @eisenbalm/convex typecheck` | ✅ (created) | ⬜ pending |
| 02-T2 | 21-02 | 1 | AUTH-04 (seed + JIT upsert) | unit + typecheck | `pnpm --filter @eisenbalm/convex typecheck` (+ convex-test/`npx convex run` idempotency) | ✅ (created) | ⬜ pending |
| 03-T1 | 21-03 | 2 | AUTH-01/AUTH-02 (middleware + providers) | typecheck | `pnpm --filter dispatch-control typecheck` | ✅ (created) | ⬜ pending |
| 03-T2 | 21-03 | 2 | AUTH-01/AUTH-02 (matcher + no-leak) | unit | `pnpm --filter dispatch-control test:unit` | ✅ (created) | ⬜ pending |
| 03-T3 | 21-03 | 2 | AUTH-01 (sign-in→Convex flow) | manual checkpoint | manual: unauth /graph redirect + sign-in no 401 + apps/web unaffected | n/a | ⬜ pending |
| 04-T1 | 21-04 | 2 | AUTH-03 (require_clerk_jwt + apply) | import smoke | `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.api.auth import require_clerk_jwt; from eisenbalm_pipeline.api.main import app; print('ok')"` | ✅ (created) | ⬜ pending |
| 04-T2 | 21-04 | 2 | AUTH-03 (401 cases + cron unaffected) | unit (pytest) | `cd packages/pipeline && uv run pytest tests/api/test_clerk_auth.py tests/api/test_runs.py -q` | ✅ (created) | ⬜ pending |
| 05-T1 | 21-05 | 3 | AUTH-01 (sidebar + dashboard layout) | typecheck | `pnpm --filter dispatch-control typecheck` | ✅ (created) | ⬜ pending |
| 05-T2 | 21-05 | 3 | AUTH-01 (7 routes + nav coverage) | unit | `pnpm --filter dispatch-control test:unit` | ✅ (created) | ⬜ pending |
| 05-T3 | 21-05 | 3 | AUTH-01 (shell visual flow) | manual checkpoint | manual: sign-in → /graph → 7 routes → active highlight → user button | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> Wave-0 role is fulfilled by Plan 01 (executes first in Wave 1; all other plans depend on it directly or transitively for the test harness).

- [x] `apps/dispatch-control/vitest.config.ts` + test setup — Plan 01 T2 (mirror `apps/web` vitest config)
- [x] `apps/dispatch-control/__tests__/` — Plan 01 T2 stubs for AUTH-01 (middleware matcher todo), AUTH-02 (no-Clerk-leak grep, live), AUTH-04/CFG-05 (workspace-upsert todo)
- [x] `packages/pipeline/tests/api/test_clerk_auth.py` — Plan 01 T2 stub (collectible, skipped) for AUTH-03; filled in Plan 04 T2
- [x] Convex schema test seam for CFG-05 / AUTH-04 — Plan 02 typecheck + seed/upsert assertion

*Plan 01 establishes the dispatch-control test harness (new app) before feature tasks land. It has no dependencies and runs first.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clerk JWT template named `"convex"` created in Clerk Dashboard | AUTH-01 | External dashboard config; no code substitute | Clerk Dashboard → JWT Templates → create template named exactly `convex`; set `CLERK_JWT_ISSUER_DOMAIN` on the Convex deployment (`npx convex env set`) |
| Full sign-in → shell render visual flow | AUTH-01 | End-to-end browser interaction | Plan 03 T3 + Plan 05 T3 checkpoints |
| Separate Vercel project env isolation | AUTH-02 | Deployment-time config | Confirm `CLERK_SECRET_KEY` set only on the dispatch-control Vercel project, never on apps/web (Pitfall 6) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (manual checkpoints additionally gated)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (dispatch-control test harness via Plan 01)
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-approved 2026-06-21
