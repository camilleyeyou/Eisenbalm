# Phase 1: Sanity Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 01-sanity-foundation
**Mode:** auto (recommended option selected for each gray area)
**Areas discussed:** Sanity version, Studio hosting, Monorepo structure, Package manager, Schema relocation, agentProfile description discrepancy, TypeGen pipeline, Agent profile seeding, Authentication, Environment bootstrap

---

## Sanity Version

| Option | Description | Selected |
|--------|-------------|----------|
| Sanity v3 | Brief explicitly says v3; backward compatibility | |
| Sanity v5.24+ | Current stable; React 19; TypeGen GA; brief was written before v5 stabilized | ✓ |
| Sanity v4 | Bridge release; deprecated by v5 | |

**Selection rationale:** Per `.planning/research/STACK.md`, the brief's "v3" was generic at write time; v5 is the current stable, fully backward compatible at the schema API level, and adds TypeGen GA which we want from day one (D-12, D-13). Hold `next-sanity` at `^11` and Next.js at 15 (Phase 2) due to documented next-sanity v11 + Next 16 4-10x request overage bug.

---

## Studio Hosting

| Option | Description | Selected |
|--------|-------------|----------|
| Sanity-hosted (`sanity deploy`) | Free, stable URL `<project>.sanity.studio`, no infra | ✓ |
| Self-hosted | Deploy as static site to Vercel/Netlify; more control, more work | |
| Embedded into apps/web | Studio mounted inside the Next.js app at `/studio` | |

**Selection rationale:** Andrew is the only Studio user; he needs a stable URL with no maintenance overhead. Sanity-hosted is free and zero-infra. Embedding in apps/web couples editorial deploys to web deploys, which is harmful for the Andrew gate (he should be able to edit even if web is mid-deploy).

---

## Monorepo Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Set up monorepo skeleton now | Create `apps/{studio,web}`, `packages/{shared,pipeline}` even though only studio gets real work this phase | ✓ |
| Standalone `apps/studio` only | Defer monorepo setup to Phase 2 | |
| Flat repo (no apps/, no packages/) | Drop the monorepo intent, just put code at root | |

**Selection rationale:** Brief's repo structure shows the monorepo split. Phase 2 needs `apps/web/`, Phase 4 needs `packages/pipeline/`, Phase 1 needs `packages/shared/` for the TypeGen re-export (D-14). Setting up the skeleton now is a one-time cost; doing it incrementally each phase is busywork.

---

## Package Manager

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm | Fast, workspace-native, strict node_modules | ✓ |
| npm workspaces | Built-in, no extra install | |
| yarn | Mature, Berry split fragmented community | |
| bun | Fastest but newer; ecosystem compatibility risk | |

**Selection rationale:** pnpm has the best workspace ergonomics, smallest disk footprint, and most predictable dependency resolution. `packageManager: "pnpm@9.x"` pinned in root package.json (D-06).

---

## Schema Relocation

| Option | Description | Selected |
|--------|-------------|----------|
| Move `schemas/*.ts` → `apps/studio/schemas/` | Per brief; canonical home for Sanity schemas | ✓ |
| Keep at repo root, symlink into apps/studio | Avoids file move; weird import paths | |
| Duplicate (root + apps/studio) | Risk of drift between copies | |

**Selection rationale:** Brief explicitly says "Drop them in `apps/studio/schemas/`." Single canonical location prevents drift. Move now in Phase 1 before any Phase 2+ code references the old paths.

---

## agentProfile.ts Description Discrepancy

| Option | Description | Selected |
|--------|-------------|----------|
| Update description to match brief's 14 agents | Edit description string only; field name unchanged | ✓ |
| Update brief to match schema's 11 agents | Brief is the spec; schema description should follow it | |
| Leave both as-is (note discrepancy) | Defers reconciliation; risks downstream confusion | |

**Selection rationale:** The brief is the canonical 14-agent spec. The schema description was written from an older agent list. Description is a comment/help string — updating it doesn't violate the CLAUDE.md "do not modify field names without checking API_CONTRACTS.md" rule because no field name or type changes. Reconciling now (D-11) prevents Phase 4 confusion when seeding.

---

## TypeGen Pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Sanity v5 TypeGen, types canonical in apps/studio, re-exported from packages/shared | One source of truth; consumers via shared package | ✓ |
| Hand-write TypeScript types | Brittle; gets out of sync with schemas | |
| Use third-party type generator | Adds dependency for no benefit over Sanity's built-in TypeGen | |
| Skip type generation in Phase 1 | Phase 2 needs them; deferring just creates churn | |

**Selection rationale:** Sanity v5 ships TypeGen GA. Generated `apps/studio/sanity.types.ts` is canonical and committed (so CI/dev parity is preserved without running typegen on every fresh checkout). `packages/shared/src/sanity-types.ts` re-exports for `apps/web` (Phase 2) and `packages/pipeline` (Phase 4) under `@eisenbalm/shared`.

---

## Agent Profile Seeding

| Option | Description | Selected |
|--------|-------------|----------|
| Idempotent seed script using @sanity/client + deterministic _ids | `pnpm seed:agents`, re-runs are safe via createOrReplace | ✓ |
| Manual creation in Sanity Studio UI | Human error prone for 14 agents; not reproducible | |
| Sanity migrations CLI | Heavyweight for a one-shot seed | |
| Document import (NDJSON) | Fine but less flexible than a TypeScript script | |

**Selection rationale:** Idempotent script with deterministic `_id`s (D-17) lets Andrew or any teammate re-run seeding safely. Copy lives in `apps/studio/scripts/agents.json` (D-18) so the agent personality copy can be edited without touching TypeScript — important because the Phase 9 deliberation UI surfaces these `personality` strings.

---

## Authentication

| Option | Description | Selected |
|--------|-------------|----------|
| Sanity built-in OAuth (Google/GitHub) | Zero config, secure, free | ✓ |
| Custom auth provider | Unnecessary work; Andrew is the only user | |
| Email/password | Built-in but discouraged by Sanity | |

**Selection rationale:** Andrew adds himself via the Sanity project dashboard once. No custom auth code, no auth surface area to maintain.

---

## Environment Bootstrap

| Option | Description | Selected |
|--------|-------------|----------|
| Andrew runs `npx sanity init` once; commit `apps/studio/.env.example`; `apps/studio/.env.local` is local-only | Captures projectId/dataset; no secrets in git | ✓ |
| Hardcode projectId in `sanity.config.ts` | projectId isn't sensitive; simpler — but couples config to one env | |
| Set up dotenv-vault or similar | Overkill for a 1-secret env | |

**Selection rationale:** Standard workflow. `apps/studio/.env.example` documents the variable names; `.env.local` (gitignored) holds actual values. Phase 1 plan documents the manual `npx sanity init` step in `apps/studio/README.md` (D-20, D-21).

---

## Claude's Discretion

- Studio plugin selection (defaults are fine unless planner finds a need)
- Slug field UX details (Sanity defaults)
- Seed copy in `agents.json` (derived from brief; planner may polish)
- Whether to add Prettier/ESLint configs in Phase 1 (recommended yes; planner specifies)
- Pinned pnpm version (planner picks current LTS)

## Deferred Ideas

- Custom Studio desk structure (until friction surfaces)
- Per-env datasets beyond `production` (only if needed)
- Studio preview mode (Phase 2)
- Schema migration versioning (Sanity handles implicitly)
- CI gates (later milestone)
- Sanity v6 / Next.js 16 upgrade (track, do not act)
