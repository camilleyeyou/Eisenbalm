---
phase: 01-sanity-foundation
plan: "01"
subsystem: infra
tags: [pnpm, monorepo, typescript, tsconfig, gitignore]

# Dependency graph
requires: []
provides:
  - "Root package.json with pnpm@9.15.4, private:true, workspace scripts, and engine constraints"
  - "pnpm-workspace.yaml declaring apps/* and packages/* workspace globs"
  - "tsconfig.base.json with strict ES2022/NodeNext TypeScript settings inheritable by all workspaces"
  - ".gitignore excluding node_modules, build artifacts, .env*, and Sanity build dirs; preserving sanity.types.ts and .env.example files"
affects:
  - 01-02-studio-scaffold
  - 01-03-schema-relocation
  - 01-04-typegen
  - 01-05-agent-seed
  - all subsequent phases (inherit tsconfig, gitignore, workspace layout)

# Tech tracking
tech-stack:
  added:
    - "pnpm@9.15.4 (packageManager pin)"
    - "Node.js >=18.18.0 engine constraint"
  patterns:
    - "Monorepo workspace root with delegating scripts (pnpm --filter studio <cmd>)"
    - "Strict TypeScript base config inherited via extends in each workspace"
    - ".env.* gitignore with explicit negation for .env.example files (D-08, D-21)"

key-files:
  created:
    - package.json
    - pnpm-workspace.yaml
    - tsconfig.base.json
    - .gitignore
  modified: []

key-decisions:
  - "pnpm pinned at 9.15.4 (current 9.x LTS per D-22 Claude's Discretion)"
  - "workspaces array kept in package.json as npm fallback compat declaration (D-06)"
  - "convex/ excluded from workspace globs — stays at repo root, deployed independently (D-09)"
  - "sanity.types.ts NOT gitignored — generated types checked in for CI/dev stability (D-08)"
  - "apps/studio/.env.example NOT created here — deferred to Plan 03 where apps/studio/ first comes into existence (D-21)"

patterns-established:
  - "Workspace scripts delegate via pnpm --filter: all root commands target the studio workspace"
  - "tsconfig inheritance: each workspace tsconfig.json uses extends: ../../tsconfig.base.json"
  - "Gitignore negation pattern: .env.* blocked, !.env.example and !apps/studio/.env.example permitted"

requirements-completed:
  - FND-01

# Metrics
duration: 1min
completed: "2026-05-10"
---

# Phase 01 Plan 01: Repo Bootstrap Summary

**pnpm@9.15.4 monorepo root with strict ES2022/NodeNext TypeScript base, workspace globs for apps/* and packages/*, and gitignore preserving sanity.types.ts and .env.example**

## Performance

- **Duration:** 1 min
- **Started:** 2026-05-10T00:04:59Z
- **Completed:** 2026-05-10T00:06:17Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments
- Created `package.json` with pnpm@9.15.4 packageManager pin, `private: true`, workspace globs, engine constraints, and five delegating scripts for Andrew's editorial workflow
- Created `pnpm-workspace.yaml` declaring `apps/*` and `packages/*` workspace globs (convex/ intentionally excluded per D-09)
- Created `tsconfig.base.json` with strict TypeScript: ES2022 target, NodeNext module resolution, jsx=preserve, composite=true, and additional strict checks (noUncheckedIndexedAccess, noImplicitOverride, forceConsistentCasingInFileNames)
- Created `.gitignore` that excludes all build artifacts and .env files while preserving `sanity.types.ts` (D-08) and allowing `!apps/studio/.env.example` (D-21)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create root package.json and pnpm-workspace.yaml** - `0091d1a` (chore)
2. **Task 2: Create tsconfig.base.json** - `43a6fcb` (chore)
3. **Task 3: Create .gitignore** - `ffb29c6` (chore)

## Files Created/Modified
- `package.json` — Monorepo root: pnpm@9.15.4, private:true, workspaces, engine constraints, five studio-delegating scripts
- `pnpm-workspace.yaml` — Workspace globs: apps/* and packages/* (not convex/)
- `tsconfig.base.json` — Shared TypeScript compiler settings: strict, ES2022, NodeNext, jsx=preserve, composite=true
- `.gitignore` — Excludes node_modules, .env*, .next, .sanity, dist; preserves sanity.types.ts and .env.example files

## Decisions Made
- pnpm pinned at `9.15.4` — current 9.x LTS at time of execution (per D-22 Claude's Discretion)
- `workspaces` array included in `package.json` as npm fallback compat alongside `pnpm-workspace.yaml` (per D-06)
- `convex/` NOT added to workspace globs — stays at repo root, deployed independently in Phase 3 (per D-09)
- `apps/studio/.env.example` NOT created in this plan — it is created in Plan 03 where `apps/studio/` first comes into existence (per D-21)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. All four files verified against plan specifications. JSON files validated with `node -e "JSON.parse(...)"`. Gitignore negation rules confirmed present.

## Known Stubs

None. This plan creates configuration files only — no data stubs or placeholder values.

## Next Phase Readiness

- Monorepo skeleton is in place; `pnpm install` from repo root will work once Plan 03 creates `apps/studio/package.json`
- `tsconfig.base.json` ready to be extended by all workspace `tsconfig.json` files created in Plans 03 and 04
- `.gitignore` rules are complete for the full project; `apps/studio/.env.example` (Plan 03) will not be excluded
- `pnpm dev:studio`, `pnpm typegen`, `pnpm seed:agents` scripts are wired and waiting for the studio workspace (Plan 03)
- No blockers for Plans 02-05 in Phase 1

---
*Phase: 01-sanity-foundation*
*Completed: 2026-05-10*
