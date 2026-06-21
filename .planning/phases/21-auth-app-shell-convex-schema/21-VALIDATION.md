---
phase: 21
slug: auth-app-shell-convex-schema
status: draft
nyquist_compliant: false
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
| **Frontend framework** | vitest (matches `apps/web/vitest.config.ts`); add `apps/dispatch-control/vitest.config.ts` in Wave 0 |
| **Pipeline framework** | pytest (existing `packages/pipeline/tests/`) |
| **Convex** | `pnpm --filter @eisenbalm/convex typecheck` + `codegen` (schema compiles; validators type-check) |
| **Config files** | `apps/dispatch-control/vitest.config.ts` (Wave 0), `packages/pipeline/pyproject.toml` (exists) |
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
| 1 | Unauthenticated → redirect to Clerk sign-in; after sign-in, shell renders with 7 nav items | AUTH-01 | Unit: assert `clerkMiddleware` + `createRouteMatcher` protects all routes (matcher config test). Manual: load app unauthenticated → redirect; sign in → 7 nav links present | unit + manual |
| 2 | Every dashboard route/API returns redirect/401 without session; `apps/web` has zero Clerk dependency | AUTH-02 | Automated: grep test asserting `@clerk` absent from `apps/web` deps + source; middleware matcher unit test. Manual: curl a dashboard route unauth → 307/401 | automated grep + unit + manual |
| 3 | FastAPI dashboard endpoints reject without valid Clerk JWT; cron keeps `X-Pipeline-Trigger-Secret` | AUTH-03 | pytest: `require_clerk_jwt` dependency returns 401 on missing/invalid/expired token (JWKS mocked); cron-secret path test still passes unchanged | unit (pytest) |
| 4 | Audit log + run records carry operator attribution from day one | AUTH-04 | Convex schema test/typecheck: `audit_log` + `runs` define `actorId`/`triggered_by`; users JIT-upsert mutation writes Clerk `sub`; unit test on upsert keyed by Clerk id | unit + typecheck |
| 5 | All 11 tables carry `workspace_id`; query by `workspace_id="eisenbalm"` returns seeded workspace | CFG-05 | Convex typecheck (all 11 `defineTable` have `workspace_id` + `by_workspace`); convex-test/integration: run seed mutation → query `by_workspace("eisenbalm")` returns 1 workspace row | unit/integration |

---

## Per-Task Verification Map

*Planner fills this once PLAN.md tasks exist. Every task maps to an automated command or a Wave 0 dependency.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | — | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/dispatch-control/vitest.config.ts` + test setup — mirror `apps/web` vitest config
- [ ] `apps/dispatch-control/__tests__/` — stubs for AUTH-01, AUTH-02 (middleware matcher, nav render, no-Clerk-leak grep)
- [ ] `packages/pipeline/tests/api/test_clerk_auth.py` — stubs for AUTH-03 (JWKS-mocked 401 + cron-secret-unaffected)
- [ ] Convex schema test seam for CFG-05 / AUTH-04 (convex-test or typecheck-based assertion that all 11 tables carry `workspace_id` + indexes, seed returns the workspace)

*Wave 0 establishes the dispatch-control test harness (new app) before feature tasks land.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clerk JWT template named `"convex"` created in Clerk Dashboard | AUTH-01 | External dashboard config; no code substitute | In Clerk Dashboard → JWT Templates → create template named exactly `convex`; set `CLERK_JWT_ISSUER_DOMAIN` on the Convex deployment |
| Full sign-in → shell render visual flow | AUTH-01 | End-to-end browser interaction | Run dispatch-control dev; visit `/`; confirm redirect to Clerk; sign in; confirm sidebar with Graph/Runs/Config/Prompts/Registry/Finance/Settings + user button |
| Separate Vercel project env isolation | AUTH-02 | Deployment-time config | Confirm `CLERK_SECRET_KEY` set only on the dispatch-control Vercel project, never on apps/web |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (dispatch-control test harness)
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
