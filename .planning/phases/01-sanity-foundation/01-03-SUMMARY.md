---
phase: "01-sanity-foundation"
plan: "03"
subsystem: "sanity-studio"
tags: ["sanity", "studio", "schemas", "typescript", "monorepo"]
dependency_graph:
  requires: ["01-01"]
  provides: ["apps/studio scaffold", "schema relocation", "sanity.config.ts", "env template"]
  affects: ["01-05", "01-06", "01-07"]
tech_stack:
  added: ["sanity@^5.24.0", "@sanity/vision@^5.24.0", "@sanity/client@^7.22.0", "react@^19", "styled-components@^6", "tsx@^4"]
  patterns: ["Sanity defineConfig", "Sanity defineCliConfig", "pnpm workspace package"]
key_files:
  created:
    - apps/studio/schemas/charity.ts
    - apps/studio/schemas/weeklyIssue.ts
    - apps/studio/schemas/agentProfile.ts
    - apps/studio/schemas/index.ts
    - apps/studio/package.json
    - apps/studio/tsconfig.json
    - apps/studio/sanity.config.ts
    - apps/studio/sanity.cli.ts
    - apps/studio/.env.example
  modified: []
  deleted:
    - schemas/charity.ts
    - schemas/weeklyIssue.ts
    - schemas/agentProfile.ts
    - schemas/index.ts
decisions:
  - "Schema relocation to apps/studio/schemas/ is byte-for-byte; only agentProfile description string changed (D-11)"
  - "sanity.config.ts throws at startup if SANITY_STUDIO_PROJECT_ID is unset — fast-fail before Vite warms up"
  - "sanity.cli.ts is minimal for now; Plan 05 extends it with schema extraction path for TypeGen"
  - "apps/studio/.env.example is checked in via !apps/studio/.env.example gitignore negation per D-21"
metrics:
  duration_minutes: 6
  completed_date: "2026-05-11"
  tasks_completed: 4
  files_changed: 13
---

# Phase 01 Plan 03: Studio Scaffold + Schema Relocation Summary

Stand up `apps/studio/` as a deployable Sanity v5 Studio: relocate schemas from repo root (byte-for-byte), apply the D-11 agentProfile description fix (14 canonical agent IDs), and create all Studio config files including the checked-in env template.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Relocate schemas + D-11 fix | a2dca6b | apps/studio/schemas/{charity,weeklyIssue,agentProfile,index}.ts; deleted schemas/ |
| 2 | package.json + tsconfig.json | 3a859af | apps/studio/package.json, apps/studio/tsconfig.json |
| 3 | sanity.config.ts + sanity.cli.ts | 7247de4 | apps/studio/sanity.config.ts, apps/studio/sanity.cli.ts |
| 4 | .env.example (D-21) | 7adae24 | apps/studio/.env.example |

## What Was Built

### Schema Relocation (D-09, D-10)

All four schema files moved from `schemas/` at repo root to `apps/studio/schemas/`. Content is byte-for-byte identical except for the single D-11 description string change in `agentProfile.ts`. Field names, types, validation rules, helper functions (`editorialSection`), preview blocks, and sidebar order (`[weeklyIssue, charity, agentProfile]`) all preserved verbatim.

The repo-root `schemas/` directory is deleted. There is one canonical copy of each schema.

### D-11 Fix: agentProfile Description String

The `agentId` field description was updated from the stale 11-agent list (which included placeholder IDs `product | puzzle`) to the canonical 14-agent list:

```
calibrator | scout | advocate | editor | researcher | origin-story | problem-statement | founder-bio | case-study | game | bonus | design | qa | publisher
```

This is a description-string-only edit. The field name (`agentId`), type (`slug`), and all other fields are unchanged.

### Sanity Studio Configuration

- `apps/studio/sanity.config.ts` — wires `schemaTypes` from `./schemas`, registers `structureTool` and `visionTool` plugins, reads `projectId`/`dataset` from env vars, throws a descriptive error if `SANITY_STUDIO_PROJECT_ID` is unset
- `apps/studio/sanity.cli.ts` — minimal `defineCliConfig` with `api.projectId`/`api.dataset`; Plan 05 will extend with TypeGen schema extraction path
- `apps/studio/package.json` — `name: "studio"`, Sanity v5.24+, React 19, scripts: `dev/build/deploy/typegen/seed:agents`
- `apps/studio/tsconfig.json` — extends `../../tsconfig.base.json`, overrides to `module: ESNext` / `moduleResolution: Bundler` (Vite-compatible), `composite: false` / `noEmit: true` (application, not library)
- `apps/studio/.env.example` — three vars: `SANITY_STUDIO_PROJECT_ID=`, `SANITY_STUDIO_DATASET=production`, `SANITY_API_TOKEN=`; tracked in git via `.gitignore` negation per D-21

## Verification Results

All automated checks passed:

- `apps/studio/schemas/` contains all four files with correct content
- Repo-root `schemas/` directory deleted
- `convex/schema.ts` untouched
- D-11 description string present: `researcher | origin-story | problem-statement | founder-bio | case-study`
- Stale IDs `product | puzzle` absent from agentProfile.ts
- `[weeklyIssue, charity, agentProfile]` export order preserved
- All 5 config files exist
- `.env.example` is NOT gitignored (git check-ignore exits non-zero)

## Manual Smoke Test (Not Run — Deferred per Plan Note)

After Andrew populates `SANITY_STUDIO_PROJECT_ID` in `apps/studio/.env.local` (Plan 02 checkpoint), run:

1. `pnpm install` from repo root
2. `pnpm dev:studio`
3. Visit http://localhost:3333
4. Confirm: three document types in sidebar — Weekly Issue (first), Charity (second), Agent Profile (third)

This manual step is gated on Plan 02 (the sanity init checkpoint) providing a real `projectId`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. All files are wired and functional. Studio will not boot until `SANITY_STUDIO_PROJECT_ID` is set, but that is intentional behavior (fail-fast error message), not a stub.

## Self-Check: PASSED

All 9 files confirmed on disk. All 4 task commits confirmed in git history.
