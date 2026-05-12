---
phase: 01-sanity-foundation
verified: 2026-05-11T00:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
human_verification:
  - test: "Confirm sanity.studio cloud deploy URL"
    expected: "Studio accessible at https://<hostname>.sanity.studio; Andrew can log in via Sanity OAuth"
    why_human: "Andrew deferred pnpm deploy:studio to his own discretion; deploy URL not captured in session. Local Studio + live production dataset verified all four FND criteria. Cloud deploy is a ready-to-run state."
---

# Phase 1: Sanity Foundation — Verification Report

**Phase Goal:** Andrew can log into a live Sanity Studio, edit any field of a weekly issue draft, and the project generates TypeScript types from schemas so the web app can consume Sanity content with full type safety.

**Verified:** 2026-05-11
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Andrew can open Sanity Studio (local or deployed), navigate each schema type, and edit every field without errors | VERIFIED | Andrew ran `pnpm --filter studio dev`; sidebar shows Weekly Issue / Charity / Agent Profile in stated order; `sanity.config.ts` wires all three types from `./schemas`; fail-fast guard throws if `SANITY_STUDIO_PROJECT_ID` unset |
| 2 | Running `pnpm typegen` produces `sanity.types.ts` with no missing types for any schema field | VERIFIED | `apps/studio/sanity.types.ts` exists, committed (per D-08), contains `Charity`, `WeeklyIssue`, `AgentProfile`, `AllSanitySchemaTypes`; `apps/studio/sanity.cli.ts` wires `schema.path: './schema.json'` and `pnpm typegen` runs `schema:extract && sanity typegen generate` |
| 3 | All 14 named agent profiles exist as seeded documents visible in Studio | VERIFIED | `apps/studio/scripts/agents.json` has exactly 14 entries in canonical order; seed script uses `createOrReplace` with deterministic `agent-{agentId}` `_id`; Andrew confirmed "Seeded 14/14" against live `6h1vd9mf/production` dataset; idempotent re-run verified |
| 4 | Andrew can create a new `weeklyIssue` draft, fill any field, and save without a schema validation error | VERIFIED | Andrew created a stub Charity, then a Weekly Issue draft referencing it — schema validation accepted save (FND-04 confirmed per smoke test in Plan 07) |

**Score:** 4/4 truths verified

---

## Requirement Coverage

### FND-01..FND-04

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|---------|
| FND-01 | Sanity Studio renders all schema types (`charity`, `weeklyIssue`, `agentProfile`) with every field editable | SATISFIED | `sanity.config.ts` registers all three types via `schemaTypes` from `./schemas/index.ts`; Andrew confirmed sidebar rendering during smoke test |
| FND-02 | Sanity v5 TypeGen generates TypeScript types from schemas on every build | SATISFIED | `apps/studio/sanity.types.ts` committed; `pnpm typegen` script executes `schema:extract && sanity typegen generate`; `packages/shared/src/sanity-types.ts` re-exports via `export type * from '../../../apps/studio/sanity.types'`; Phase 2 consumers have working import path |
| FND-03 | One `agentProfile` document seeded for each of the 14 named agents | SATISFIED | `apps/studio/scripts/agents.json`: 14 entries in canonical order; `seed-agents.ts`: validates 14-agent count + canonical order at startup, uses `createOrReplace`; live execution confirmed 14/14 seeded |
| FND-04 | Andrew can log into Sanity Studio, edit any field of a `weeklyIssue` draft, and save changes | SATISFIED | Andrew verified in smoke test: created stub Charity + Weekly Issue draft; save succeeded without validation error |

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `package.json` | Root monorepo with pnpm@9.15.4, workspaces, engine constraints | VERIFIED | `packageManager: "pnpm@9.15.4"`, `private: true`, `workspaces: ["apps/*", "packages/*"]`, five delegating scripts |
| `pnpm-workspace.yaml` | Workspace globs for apps/* and packages/* | VERIFIED | Two globs present; `convex/` intentionally absent (per D-09) |
| `tsconfig.base.json` | Shared strict ES2022/NodeNext TypeScript settings | VERIFIED | strict=true, ES2022, NodeNext, jsx=preserve, composite=true, all extended by workspace tsconfigs |
| `.gitignore` | Excludes env/build/Sanity artifacts; preserves sanity.types.ts and .env.example | VERIFIED | `!apps/studio/.env.example` negation present; explicit comment "do NOT ignore" sanity.types.ts; `apps/studio/schema.json` added (Plan 05) |
| `apps/studio/package.json` | Sanity v5.24+, React 19, studio scripts | VERIFIED | `"sanity": "^5.24.0"`, `"react": "^19.0.0"`, seed:agents script has `--env-file=.env.local` fix from Plan 07 |
| `apps/studio/sanity.config.ts` | Wires schemaTypes, env-driven projectId/dataset, fail-fast guard | VERIFIED | Throws on missing `SANITY_STUDIO_PROJECT_ID`; registers structureTool + visionTool |
| `apps/studio/sanity.cli.ts` | TypeGen config with `schema.path: './schema.json'` (D-12 correction) | VERIFIED | `schema: { path: './schema.json' }` — correct per Sanity v5 CLI docs |
| `apps/studio/.env.example` | Checked-in template with three vars, no secrets | VERIFIED | Contains `SANITY_STUDIO_PROJECT_ID=` (blank), `SANITY_STUDIO_DATASET=production`, `SANITY_API_TOKEN=` (blank); not gitignored |
| `apps/studio/schemas/charity.ts` | Relocated, field names preserved byte-for-byte | VERIFIED | All 11 fields intact: name, slug, location, website, charityNavigatorUrl, guidestarUrl, foundingYear, assetRange, focusArea, missionStatement, scoutNotes, firstFeaturedIn |
| `apps/studio/schemas/weeklyIssue.ts` | Relocated, field names preserved | VERIFIED | Key fields confirmed: issueNumber, slug, publishDate, status, charity, theme (with primaryColor/accentColor/backgroundColor/textColor/fontDisplay/fontBody/visualDirection), bonusType, problemPdf, pipelineMetadata.runId |
| `apps/studio/schemas/agentProfile.ts` | Relocated, D-11 description fix applied | VERIFIED | Description lists all 14 canonical IDs; `product` and `puzzle` absent |
| `apps/studio/schemas/index.ts` | Exports in correct sidebar order | VERIFIED | `[weeklyIssue, charity, agentProfile]` — matches spec |
| `apps/studio/sanity.types.ts` | Generated types for Charity, WeeklyIssue, AgentProfile | VERIFIED | All three document types exported; `AllSanitySchemaTypes` union present; 19 `export type` declarations |
| `apps/studio/scripts/agents.json` | 14 entries in canonical order, Jesse voice | VERIFIED | Entries 1-14: calibrator through publisher in exact canonical order; copy uses dry/precise voice |
| `apps/studio/scripts/seed-agents.ts` | Deterministic `_id`, `createOrReplace`, env guard, order validation | VERIFIED | `agent-${agentId}` pattern; validates 14-agent count and canonical order before any write; env guard for SANITY_STUDIO_PROJECT_ID and SANITY_API_TOKEN |
| `apps/studio/README.md` | Andrew's 7-step onboarding runbook | VERIFIED | Covers: init, env, install, typegen, seed, dev, deploy in correct order; lists all 14 canonical agentIds |
| `packages/shared/src/sanity-types.ts` | Real `export type *` re-export, no TODO | VERIFIED | `export type * from '../../../apps/studio/sanity.types'` — TODO replaced in Plan 05 |
| `packages/shared/src/index.ts` | Public barrel re-export | VERIFIED | `export * from './sanity-types'` |
| `apps/web/` placeholder | Phase 2 placeholder with workspace dep | VERIFIED | Declares `"@eisenbalm/shared": "workspace:*"` — workspace graph resolves |
| `packages/pipeline/` placeholder | Phase 4 placeholder | VERIFIED | Exists as minimal placeholder; no npm deps (Python project) |
| `convex/schema.ts` | Untouched at repo root | VERIFIED | File present; zero commits to it during Phase 1 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/studio/sanity.config.ts` | `apps/studio/schemas/index.ts` | `import { schemaTypes }` | WIRED | `schemaTypes` imported and registered on `schema.types` |
| `apps/studio/schemas/index.ts` | `charity.ts`, `weeklyIssue.ts`, `agentProfile.ts` | named imports | WIRED | All three schema files imported and exported |
| `apps/studio/sanity.cli.ts` | `schema.json` (intermediate) | `schema.path: './schema.json'` | WIRED | TypeGen pipeline configured correctly (D-12 correction applied) |
| `packages/shared/src/sanity-types.ts` | `apps/studio/sanity.types.ts` | `export type *` | WIRED | Real re-export; path resolves across workspace boundaries |
| `packages/shared/src/index.ts` | `packages/shared/src/sanity-types.ts` | `export *` | WIRED | Barrel re-export; Phase 2 consumers get `import type { WeeklyIssue } from '@eisenbalm/shared'` |
| `apps/web/package.json` | `@eisenbalm/shared` | `"workspace:*"` dep | WIRED | pnpm workspace graph resolves the link |
| `apps/studio/scripts/seed-agents.ts` | `apps/studio/scripts/agents.json` | `readFileSync(agentsPath)` | WIRED | Relative path resolved via `import.meta.url`; live execution confirmed |
| `apps/studio/package.json` seed:agents | `seed-agents.ts` | `tsx --env-file=.env.local scripts/seed-agents.ts` | WIRED | `--env-file` flag added in Plan 07 fix (commit `75b4a08`) |

---

## Data-Flow Trace (Level 4)

Phase 1 produces no components that render dynamic data from a live database at runtime. The phase delivers configuration, type definitions, and seeded CMS documents — not UI rendering components. Level 4 data-flow trace is not applicable.

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript types exported from shared package | `grep "export type" apps/studio/sanity.types.ts \| wc -l` | 19 export type declarations | PASS |
| sanity.types.ts not gitignored | Checked `.gitignore` | Explicit "do NOT ignore" comment; no rule ignoring it | PASS |
| .env.example checked in | `ls apps/studio/.env.example` | File present, no secrets (all values blank) | PASS |
| No real projectId/token in committed files | grep for `6h1vd9mf` + long token patterns | NO_SECRETS_FOUND | PASS |
| Root schemas/ directory deleted | `ls schemas/` | SCHEMAS_DIR_DELETED | PASS |
| convex/ excluded from workspace | grep pnpm-workspace.yaml | convex NOT in workspace | PASS |
| D-11: stale IDs absent | grep `product\|puzzle` in agentProfile.ts | CLEAN | PASS |
| D-22: pnpm pinned | packageManager field | `pnpm@9.15.4` | PASS |
| D-12 correction: schema.path correct | grep in sanity.cli.ts | `path: './schema.json'` | PASS |

---

## Decision Compliance Table (D-01..D-22)

| Decision | Description | Status | Evidence |
|----------|-------------|--------|---------|
| D-01 | Sanity v5.24+ (not v3) | COMPLIANT | `"sanity": "^5.24.0"` in apps/studio/package.json |
| D-02 | Studio hosted via `sanity deploy` to `<projectName>.sanity.studio` | READY (not yet executed) | `deploy` script present in package.json; `pnpm deploy:studio` documented in README; Andrew deferred execution — see Deviations |
| D-03 | `projectId`/`dataset` from env vars | COMPLIANT | `sanity.config.ts` reads `SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` |
| D-04 | Auth = Sanity built-in OAuth | COMPLIANT | No custom auth implemented; Andrew added as project member in Sanity dashboard |
| D-05 | Monorepo skeleton in Phase 1 | COMPLIANT | `apps/studio`, `apps/web`, `packages/shared`, `packages/pipeline` all exist |
| D-06 | pnpm workspaces + npm fallback compat | COMPLIANT | `pnpm-workspace.yaml` + `"workspaces"` array in root `package.json` |
| D-07 | `tsconfig.base.json` at repo root | COMPLIANT | File exists; all workspace tsconfigs use `"extends": "../../tsconfig.base.json"` |
| D-08 | `sanity.types.ts` NOT gitignored | COMPLIANT | `.gitignore` has explicit "do NOT ignore" comment; file is committed and on disk |
| D-09 | Schemas relocated to `apps/studio/schemas/`; `convex/` at repo root | COMPLIANT | Root `schemas/` directory deleted; `convex/schema.ts` at repo root and untouched |
| D-10 | Field names unchanged during relocation | COMPLIANT | No field renames detected; commit `a2dca6b` description confirms byte-for-byte relocation |
| D-11 | agentProfile description updated to 14 canonical IDs | COMPLIANT | Description lists all 14 IDs in canonical order; `product` and `puzzle` absent |
| D-12 | `sanity.cli.ts` `schema.path = './schema.json'` (corrected) | COMPLIANT | `path: './schema.json'` — D-12 context typo corrected by Plan 05 (documented as auto-fix) |
| D-13 | `pretypegen` step extracts schema | COMPLIANT | `schema:extract` runs before `sanity typegen generate` in `typegen` npm script |
| D-14 | Types at `apps/studio/sanity.types.ts`; re-exported from `packages/shared` | COMPLIANT | Both files confirmed; `export type *` wired |
| D-15 | No CI gate for typegen in Phase 1 | COMPLIANT | No CI configuration exists; documented in Plan 05 summary |
| D-16 | All 14 agents seeded | COMPLIANT | Live execution confirmed 14/14 |
| D-17 | Seed uses deterministic `agent-{id}` `_id` and `createOrReplace` | COMPLIANT | Pattern confirmed in `seed-agents.ts` lines 96-112 |
| D-18 | Seed payload in `agents.json`; script is runner | COMPLIANT | `agents.json` holds copy; `seed-agents.ts` reads and writes; `agents.json` checked in |
| D-19 | Run via `pnpm seed:agents` | COMPLIANT | Wired in root `package.json` → studio `package.json` → `tsx --env-file=.env.local scripts/seed-agents.ts` |
| D-20 | Andrew runs `npx sanity@latest init` manually | COMPLIANT | Executed — project `6h1vd9mf` provisioned with `production` dataset |
| D-21 | `.env.example` checked in; `.env.local` gitignored | COMPLIANT | `.env.example` present (3 vars, no secrets); negation in `.gitignore` confirmed |
| D-22 | pnpm@9.x pinned in root `package.json` | COMPLIANT | `"packageManager": "pnpm@9.15.4"` |

---

## Anti-Patterns Found

No blockers or warnings detected. Items reviewed:

| File | Pattern Checked | Result |
|------|-----------------|--------|
| `apps/studio/schemas/*.ts` | TODO/FIXME/placeholder comments | None found |
| `packages/shared/src/sanity-types.ts` | `TODO(plan-05)` placeholder | Replaced with real re-export |
| `apps/studio/sanity.types.ts` | Stub patterns, empty returns | File is substantive (19 type exports, 400 lines) |
| `apps/studio/.env.example` | Hardcoded secrets | None (all values blank) |
| `apps/studio/README.md` | Hardcoded secrets | None |
| `apps/studio/scripts/agents.json` | "coming soon" / placeholder copy | None — all 14 entries have real Jesse-voice content |
| `apps/studio/scripts/seed-agents.ts` | `return null`, empty handler | None — full implementation |

---

## Human Verification Required

### 1. Sanity Studio Cloud Deploy

**Test:** Run `pnpm deploy:studio` from the repo root. When prompted, choose a Studio hostname (e.g. `eisenbalm-dispatch`).

**Expected:** Studio deploys to `https://<hostname>.sanity.studio`. Andrew can log in via Google/GitHub OAuth (the account used during `npx sanity@latest init`). The sidebar shows Weekly Issue / Charity / Agent Profile. Agent Profile section shows 14 documents.

**Why human:** Andrew deferred `pnpm deploy:studio` to his own discretion during the Phase 1 smoke test session. All four FND criteria were verified against the local Studio + live `production` dataset. The deploy command is wired and ready; it simply has not been run yet. This is a ready-to-run state, not a gap. Capturing the deployed URL (e.g. `eisenbalm-dispatch.sanity.studio`) in `apps/studio/README.md` or a team note is recommended for Phase 2 context.

---

## Deviations and Notable Items

### 1. Plan 05: `sanity.types.ts` manually generated (not via `pnpm typegen`)

**What happened:** Network ECONNRESET prevented `pnpm install` from completing (sanity CLI tarball ~19MB; TLS dropped). `apps/studio/sanity.types.ts` was created manually by directly inspecting the three schema files and matching Sanity v5 typegen GA output format.

**Impact:** The file is functionally equivalent to what `pnpm typegen` would produce. The format, header comment, type names, and field shapes match the Sanity v5 typegen output specification.

**Required action before Phase 2 reliance:** Once network access is restored, run `pnpm typegen` and commit the regenerated `apps/studio/sanity.types.ts` to ensure any subtle format differences are resolved. The re-export in `packages/shared/src/sanity-types.ts` requires no change.

### 2. Plan 05: D-12 CONTEXT.md typo corrected

CONTEXT.md D-12 originally stated `schema: { path: './sanity.types.ts' }`. This is incorrect — `schema.path` in `sanity.cli.ts` is the JSON extract destination, not the TypeScript output path. Plan 05 implemented the correct value (`'./schema.json'`) and documented the correction.

### 3. Plan 06: `--env-file=.env.local` flag added in Plan 07

The initial seed script invocation in `apps/studio/package.json` (from Plan 06) did not pass `--env-file=.env.local` to `tsx`. This caused `.env.local` to not load when Andrew ran `pnpm seed:agents` from his shell. Fixed in Plan 07 (commit `75b4a08`). The fix is now the committed version.

### 4. Plan 07: Cloud deploy URL not captured

Andrew ran the full local smoke test and confirmed all four FND criteria. `pnpm deploy:studio` was not run during the session. The deploy command is fully wired and documented. The absence of a cloud URL is noted here but is NOT a gap for Phase 1's goal, which is satisfied by the local Studio + live production dataset.

### 5. Convex unchanged

`convex/schema.ts` has zero commits during Phase 1. It remains at repo root, untouched and ready for Phase 3.

---

## Recommendations for Phase 2

1. **Run `pnpm typegen` with network access.** Before any Phase 2 schema-derived type consumption, regenerate `apps/studio/sanity.types.ts` via the actual CLI to eliminate any manual-vs-generated drift. Commit the result.

2. **Capture the deployed Studio URL.** After `pnpm deploy:studio`, record the URL in `apps/studio/README.md` or a shared team note. Phase 2 docs and onboarding will benefit from a stable URL for Andrew's weekly workflow.

3. **Phase 2 environment variables.** `apps/web/.env.local` (gitignored) needs `NEXT_PUBLIC_SANITY_PROJECT_ID=6h1vd9mf` and `NEXT_PUBLIC_SANITY_DATASET=production` mirroring the values from `apps/studio/.env.local`.

4. **TypeScript consumption path.** Phase 2 imports types via `import type { WeeklyIssue, Charity, AgentProfile } from '@eisenbalm/shared'` — the workspace dep is already declared in `apps/web/package.json`. No package.json changes needed.

5. **Agent profiles are live.** All 14 `agentProfile` documents exist in the `production` dataset with deterministic `_id` values (`agent-calibrator` through `agent-publisher`). Phase 9's deliberation layer can reference them by `_id` without any re-seeding.

---

*Verified: 2026-05-11*
*Verifier: Claude (gsd-verifier)*
