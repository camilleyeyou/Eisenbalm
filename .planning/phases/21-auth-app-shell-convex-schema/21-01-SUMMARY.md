---
phase: 21-auth-app-shell-convex-schema
plan: "01"
subsystem: dispatch-control
tags: [scaffold, vitest, test-harness, workspace-constant, pnpm-workspace]
dependency_graph:
  requires: []
  provides:
    - apps/dispatch-control workspace package (Next 15 / React 19 / Tailwind v4)
    - DEFAULT_WORKSPACE_ID constant (lib/workspace.ts)
    - vitest harness + AUTH-01/AUTH-02/AUTH-04/CFG-05 test seams
    - pytest AUTH-03 stub (4 skip-marked tests)
    - Root package.json dispatch-control scripts
  affects:
    - package.json (5 new scripts)
    - packages/pipeline/tests/api/ (new test_clerk_auth.py)
tech_stack:
  added:
    - "apps/dispatch-control: Next.js ^15.3.9, React ^19.2.6, Tailwind ^4.3.0 (cloned from apps/web)"
    - "apps/dispatch-control: vitest ^3.2.0 + vite-tsconfig-paths ^5.1.0"
  patterns:
    - "pnpm workspace:* for @eisenbalm/shared + @eisenbalm/convex deps"
    - "Wave 0 test-seam pattern: it.todo() for later-phase seams, live test for immediate guards"
    - "pytest.mark.skip with reason= for stubs; module collectible from day one"
key_files:
  created:
    - apps/dispatch-control/package.json
    - apps/dispatch-control/tsconfig.json
    - apps/dispatch-control/next.config.ts
    - apps/dispatch-control/postcss.config.mjs
    - apps/dispatch-control/components.json
    - apps/dispatch-control/app/globals.css
    - apps/dispatch-control/app/layout.tsx
    - apps/dispatch-control/app/page.tsx
    - apps/dispatch-control/lib/utils.ts
    - apps/dispatch-control/lib/workspace.ts
    - apps/dispatch-control/.env.example
    - apps/dispatch-control/vitest.config.ts
    - apps/dispatch-control/__tests__/harness.test.ts
    - apps/dispatch-control/__tests__/middleware-matcher.test.ts
    - apps/dispatch-control/__tests__/apps-web-no-clerk.test.ts
    - apps/dispatch-control/__tests__/workspace-upsert.test.ts
    - packages/pipeline/tests/api/test_clerk_auth.py
  modified:
    - package.json (5 new dispatch-control scripts)
decisions:
  - "D-16: DEFAULT_WORKSPACE_ID = 'eisenbalm' lives only in lib/workspace.ts (constant) + seeded Convex data — no other hardcoded string in control-plane code"
  - "No @clerk deps in dispatch-control yet — Clerk added in Plan 03 per wave ordering"
  - "apps/web no-clerk guard runs as a live test (not todo) so it trips immediately if any future phase leaks Clerk"
  - "pytest stub uses @pytest.mark.skip (not pytest.mark.xfail) so suite stays green and collection is verified"
metrics:
  duration: "6 minutes"
  completed: "2026-06-21"
  tasks: 2
  files_created: 17
  files_modified: 1
---

# Phase 21 Plan 01: dispatch-control Scaffold + Test Harness Summary

**One-liner:** Next 15 / React 19 / Tailwind v4 workspace app scaffolded from apps/web toolchain with vitest harness, AUTH seam reservations, and 4-test FastAPI pytest stub — no Clerk yet.

## What Was Built

### Task 1: dispatch-control App Skeleton

Scaffolded `apps/dispatch-control/` as a pnpm workspace package cloning the exact dependency versions from `apps/web`. Key outcomes:

- **package.json** — name `dispatch-control`, port 3001, all 7 scripts including `test:unit`, zero `@clerk` references
- **tsconfig.json** — cloned from apps/web: `moduleResolution: Bundler`, `@/*` path alias, `@convex/*` alias
- **next.config.ts / postcss.config.mjs** — minimal Next 15 config; `@tailwindcss/postcss` plugin
- **components.json** — shadcn config: style `default`, `rsc: true`, `tsx: true`, neutral base, CSS variables, same aliases as apps/web
- **app/globals.css** — `@import "tailwindcss"`, `@plugin "tailwindcss-animate"`, neutral shadcn `:root` token block
- **app/layout.tsx** — plain Server Component root layout, imports globals.css, exports metadata with title `Eisenbalm Dispatch Control`; NO ClerkProvider (Plan 03)
- **app/page.tsx** — minimal placeholder `<main>Dispatch Control</main>`
- **lib/utils.ts** — `cn()` helper (clsx + tailwind-merge), byte-identical to apps/web
- **lib/workspace.ts** — `DEFAULT_WORKSPACE_ID = 'eisenbalm'` constant + `getCurrentWorkspace()` async helper with Phase 28 comment (D-16)
- **.env.example** — documents NEXT_PUBLIC_CONVEX_URL, Clerk env vars with CLERK_SECRET_KEY isolation warning (Pitfall 6)
- **root package.json** — 5 new scripts: `dev:dispatch-control`, `build:dispatch-control`, `lint:dispatch-control`, `typecheck:dispatch-control`, `test:dispatch-control`

Ran `pnpm install` to link the new workspace package. `pnpm --filter dispatch-control typecheck` exits 0.

### Task 2: Test Harness + Stubs

Established the test infrastructure so later plans can write failing tests first.

**Vitest (frontend):**
- `vitest.config.ts` — mirrors apps/web exactly (node env, tsconfigPaths, `__tests__/**/*.test.ts`)
- `harness.test.ts` — imports `DEFAULT_WORKSPACE_ID` from `@/lib/workspace`, asserts `'eisenbalm'`; proves vitest + path aliases work; **passes now**
- `apps-web-no-clerk.test.ts` — reads `apps/web/package.json` via `fs.readFileSync`, asserts zero `@clerk` occurrences; live AUTH-02 guard; **passes now**
- `middleware-matcher.test.ts` — `it.todo()` seams for AUTH-01 (filled Plan 03)
- `workspace-upsert.test.ts` — `it.todo()` seams for AUTH-04/CFG-05 (filled Plan 02)

**pytest (FastAPI):**
- `packages/pipeline/tests/api/test_clerk_auth.py` — 4 `@pytest.mark.skip` stub tests for AUTH-03: `test_require_clerk_jwt_missing_returns_401`, `test_require_clerk_jwt_expired_returns_401`, `test_require_clerk_jwt_valid_returns_claims`, `test_cron_trigger_secret_path_unaffected`; module docstring references Pattern 4 (PyJWT + JWKS)

**Suite results:**
- `pnpm --filter dispatch-control test:unit` → 2 passed, 4 todo, 0 failed
- `uv run pytest tests/api/test_clerk_auth.py --collect-only -q` → 4 tests collected, exits 0

## Deviations from Plan

None — plan executed exactly as written.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 | 8b73bff | feat(21-01): scaffold dispatch-control app skeleton + workspace constant |
| 2 | ab3e2c8 | test(21-01): vitest harness + AUTH/CFG test seams + FastAPI pytest stub |

## Known Stubs

None that affect this plan's goal. The `it.todo()` and `pytest.mark.skip` entries are intentional seam reservations for later plans, not content stubs.

## Self-Check: PASSED
