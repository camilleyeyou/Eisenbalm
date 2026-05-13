---
phase: 03-convex-deployment
plan: 01
subsystem: infra
tags: [convex, pnpm, monorepo, workspace, typescript, env-vars]

# Dependency graph
requires:
  - phase: 01-sanity-foundation
    provides: pnpm 9.15.4 workspace skeleton, tsconfig.base.json strict TS, .gitignore
  - phase: 02-web-shell-theme-engine
    provides: apps/web/.env.example pattern (NEXT_PUBLIC_SANITY_PROJECT_ID, NEXT_PUBLIC_SITE_URL), .env.example gitignore-negation pattern
provides:
  - convex/ promoted to pnpm workspace @eisenbalm/convex (D-05)
  - convex@^1.38.0 devDep pinned in convex/package.json (D-01)
  - convex/tsconfig.json extending tsconfig.base.json so codegen typechecks
  - convex/.gitignore that ignores .env.local but explicitly preserves _generated/ (D-08)
  - Root scripts dev:convex, deploy:convex, codegen:convex, typecheck:convex
  - NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOY_KEY documented in root .env.example and apps/web/.env.example (D-20, D-21)
affects: [03-02 convex-init-checkpoint, 03-03 query-mutation-functions, 03-04 codegen-and-deploy, 03-05 web-convex-wiring, 04 pipeline]

# Tech tracking
tech-stack:
  added: [convex@^1.38.0 (devDep, not installed yet — pnpm install in 03-02)]
  patterns:
    - "Promote convex/ to its own pnpm workspace (@eisenbalm/convex) while keeping the directory at repo root per brief"
    - "Workspace glob: explicit 'convex' entry alongside apps/* and packages/* in pnpm-workspace.yaml"
    - "Root scripts proxy via pnpm --filter @eisenbalm/convex {script} pattern"
    - "Env files: NEVER commit .env.local; commit .env.example with explicit security wording for secret keys"

key-files:
  created:
    - convex/package.json
    - convex/tsconfig.json
    - convex/.gitignore
    - .env.example (root)
  modified:
    - pnpm-workspace.yaml
    - package.json (root)
    - apps/web/.env.example

key-decisions:
  - "convex devDep pinned at ^1.38.0 (matches CONTEXT D-01 + STACK research; latest published 2026-05-08)"
  - "convex/.gitignore uses comment-only mention of _generated to make the no-ignore intent explicit (D-08 mirror of Phase 1 D-14 sanity.types.ts)"
  - "Root .env.example documents CONVEX_DEPLOY_KEY for pipeline (Phase 4) cross-workspace clarity in addition to apps/web/.env.example"

patterns-established:
  - "Workspace bootstrap pattern: package.json + tsconfig.json + .gitignore as the minimum viable workspace head for a non-build directory hosting a CLI"
  - "Comment-only mentions of intentionally NOT-ignored paths inside .gitignore to lock the policy"

requirements-completed: [CVX-01]

# Metrics
duration: 3m
completed: 2026-05-13
---

# Phase 03 Plan 01: Convex Workspace Bootstrap Summary

**Promoted `convex/` to a pnpm workspace `@eisenbalm/convex` with `convex@^1.38.0` pin, wired root scripts, and documented `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOY_KEY` in both `.env.example` files — ready for Andrew's interactive `convex dev --once --configure` in Plan 03-02.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-13T00:08:25Z
- **Completed:** 2026-05-13T00:10:57Z
- **Tasks:** 3
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments
- `convex/` is now a real pnpm workspace named `@eisenbalm/convex` with `convex@^1.38.0` pinned and standard scripts (`dev`, `dev:once`, `deploy`, `codegen`, `dashboard`, `typecheck`)
- `pnpm-workspace.yaml` includes `convex` alongside `apps/*` and `packages/*` (D-06)
- Root `package.json` proxies four new scripts: `dev:convex`, `deploy:convex`, `codegen:convex`, `typecheck:convex` — every previous script (studio + web) preserved byte-for-byte
- Both `.env.example` files document the two new Convex env vars with explicit security wording (`CONVEX_DEPLOY_KEY` marked "SECRET — NEVER commit — NEVER expose via NEXT_PUBLIC_*", "database password" caveat)
- `convex/.gitignore` explicitly preserves `_generated/` from gitignore via a clear comment block (mirroring Phase 1 D-14 sanity.types.ts policy)
- `convex/schema.ts` was NOT touched — verified untouched and remains in its pre-existing untracked state, exactly as required

## Task Commits

Each task was committed atomically:

1. **Task 1: Create convex/package.json, convex/tsconfig.json, convex/.gitignore** — `d923c4d` (feat)
2. **Task 2: Update pnpm-workspace.yaml and root package.json** — `32c39d2` (feat)
3. **Task 3: Extend root and apps/web .env.example with Convex env vars** — `f6fa4fe` (feat)

## Files Created/Modified

### Created
- `convex/package.json` — `@eisenbalm/convex` workspace manifest, `convex@^1.38.0` devDep, 6 scripts
- `convex/tsconfig.json` — Extends `../tsconfig.base.json`; ESNext + Bundler resolution; includes `_generated/**/*.ts`; `types: ["node"]`
- `convex/.gitignore` — Ignores `.env.local` and `.env`; explicit comment block preserving `_generated/`
- `.env.example` (root) — `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, plus Sanity vars for cross-workspace pipeline (Phase 4) reference

### Modified
- `pnpm-workspace.yaml` — Added `- 'convex'` entry under `packages:`
- `package.json` (root) — Appended 4 new scripts after `typecheck:web`; preserved `packageManager: pnpm@9.15.4` and all 10 prior scripts
- `apps/web/.env.example` — Appended `NEXT_PUBLIC_CONVEX_URL=` and `CONVEX_DEPLOY_KEY=` with multi-line security comment; preserved 3 prior entries

## Decisions Made

- **Content shipped verbatim from 03-RESEARCH.md.** No deviations from `§Standard Stack`, `§Code Examples §8`, `§Code Examples §9`, or `§Code Examples §10`. The `convex@^1.38.0` pin is exactly as specified in CONTEXT D-01 and STACK research (latest = `1.38.0`, published 2026-05-08 per research metadata).
- **Comment-only `_generated` mention in `convex/.gitignore`.** The verification regex `! grep -qE '^[^#]*_generated' convex/.gitignore` deliberately allows `_generated` to appear inside `#`-prefixed comments so the policy is self-documenting. Confirmed by `git check-ignore convex/_generated/api.ts` returning exit 1 (not ignored).
- **Root `.env.example` includes both Convex and Sanity vars.** Plan 03-01 explicitly creates this file with both for cross-workspace clarity per D-21 (the pipeline in Phase 4 needs both `CONVEX_DEPLOY_KEY` and `SANITY_API_TOKEN`).

## Deviations from Plan

None - plan executed exactly as written. The exact text in 03-RESEARCH.md §Standard Stack "Installation (in convex/package.json)", §Code Examples §8, §9, §10, and the body of Task 3 was reproduced verbatim. The `convex` devDep shipped at `^1.38.0` as specified (npm registry latest at research time = `1.38.0`; no version drift detected during execution).

## Issues Encountered

None. All three task verification checks passed on first attempt:
- Task 1 automated: JSON validity, all required substrings present, `_generated` only in comments, `.env.local` would be ignored, `_generated/api.ts` would NOT be ignored
- Task 2 automated: `convex` glob present, all 4 new scripts wired, `packageManager` intact
- Task 3 automated: Both `.env.example` files contain both Convex vars, security wording present, both committable (`git check-ignore` exits 1)

## User Setup Required

None for this plan. Andrew's manual interactive checkpoint (`pnpm --filter @eisenbalm/convex exec convex dev --once --configure`) belongs to Plan **03-02-convex-init-checkpoint**. This plan only prepared the ground.

## Next Phase Readiness

- **03-02 (Andrew's interactive init):** Unblocked. `pnpm install` from repo root will resolve `@eisenbalm/convex` as a workspace member; `pnpm --filter @eisenbalm/convex exec convex --help` will be invocable. Andrew can run `convex dev --once --configure` against the new workspace.
- **03-03 through 03-05:** Plumbing in place. The workspace has TS config that will typecheck the future `_generated/` artifacts.
- **`convex/schema.ts` verified untouched:** `git status --short convex/schema.ts` still shows it as untracked (`??`), exactly the state before Plan 03-01 began. The plan's instruction "do NOT modify convex/schema.ts" was honored.

## Self-Check: PASSED

- FOUND: convex/package.json (committed `d923c4d`)
- FOUND: convex/tsconfig.json (committed `d923c4d`)
- FOUND: convex/.gitignore (committed `d923c4d`)
- FOUND: pnpm-workspace.yaml updated (committed `32c39d2`)
- FOUND: package.json updated with 4 new scripts (committed `32c39d2`)
- FOUND: .env.example root (committed `f6fa4fe`)
- FOUND: apps/web/.env.example updated (committed `f6fa4fe`)
- FOUND commit: d923c4d
- FOUND commit: 32c39d2
- FOUND commit: f6fa4fe

---
*Phase: 03-convex-deployment*
*Completed: 2026-05-13*
