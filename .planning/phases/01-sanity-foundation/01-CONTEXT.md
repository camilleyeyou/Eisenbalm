# Phase 1: Sanity Foundation - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning
**Mode:** auto (decisions below selected from recommended defaults)

<domain>
## Phase Boundary

Wire the existing Sanity schemas (`schemas/charity.ts`, `schemas/weeklyIssue.ts`, `schemas/agentProfile.ts`, `schemas/index.ts`) into a deployable Sanity v5 Studio that Andrew can log into and edit; enable Sanity TypeGen so downstream phases consume schema-derived TypeScript types; seed all 14 named agent profile documents; establish the monorepo workspace layout that Phase 2 (apps/web) and Phase 4 (packages/pipeline) will consume.

**Strictly NOT in this phase:**
- Reading content into a Next.js app (Phase 2)
- Convex deployment (Phase 3)
- Pipeline code (Phase 4)
- Stripe (Phase 8)
- Webhook handlers, deploy hooks (Phase 6)

</domain>

<decisions>
## Implementation Decisions

### Sanity Studio

- **D-01:** Use Sanity v5.24+ (NOT v3 as the brief says). Brief was written before v5 stabilized; v5 is current stable, requires React 19, and includes TypeGen GA. Keep `next-sanity` at `^11` and Next.js at 15 in Phase 2 to avoid the documented next-sanity v11 + Next.js 16 4-10x request overage bug.
- **D-02:** Studio hosting: Sanity-hosted via `sanity deploy` to `<projectName>.sanity.studio`. Free, stable URL for Andrew, no infra. Standalone `apps/studio/` with its own `pnpm deploy:studio` script.
- **D-03:** Studio entry config at `apps/studio/sanity.config.ts`. Wires schemas from `apps/studio/schemas/index.ts`. `projectId` and `dataset` from `process.env.SANITY_STUDIO_PROJECT_ID` and `SANITY_STUDIO_DATASET` (defaulting to `"production"`).
- **D-04:** Authentication = Sanity's built-in OAuth (Google/GitHub). Andrew adds himself as a member via Sanity project dashboard. No custom auth.

### Monorepo & Package Manager

- **D-05:** Establish monorepo skeleton in this phase using pnpm workspaces. Create `apps/studio/`, placeholder `apps/web/` (real work in Phase 2), `packages/shared/`, placeholder `packages/pipeline/` (real work in Phase 4). Keep `convex/` at repo root per brief.
- **D-06:** Package manager: pnpm. Add `pnpm-workspace.yaml` listing `apps/*` and `packages/*`. Add root `package.json` with `"private": true`, `"workspaces": ["apps/*", "packages/*"]` (npm fallback compat), and a few delegating scripts (`pnpm dev:studio`, `pnpm typegen`, `pnpm seed:agents`).
- **D-07:** Add `tsconfig.base.json` at repo root with shared compiler options (target=ES2022, moduleResolution=NodeNext, strict=true, jsx=preserve, composite=true). Each workspace `tsconfig.json` extends it.
- **D-08:** Add a repo-level `.gitignore` covering `node_modules/`, `.next/`, `.env*` (except `.env.example`), `apps/studio/dist/`, `apps/studio/.sanity/`. Do NOT gitignore generated `sanity.types.ts` — type stability across CI/dev requires checking it in.

### Schema Relocation

- **D-09:** Move existing `schemas/*.ts` files (`charity.ts`, `weeklyIssue.ts`, `agentProfile.ts`, `index.ts`) into `apps/studio/schemas/` per the brief's repository structure. Keep `convex/schema.ts` and `convex/` at repo root per the brief. Update any cross-references.
- **D-10:** Existing schemas remain functionally unchanged. Field names are NOT modified (per `CLAUDE.md` and `docs/API_CONTRACTS.md` rule). Only the file location changes.
- **D-11:** Resolve agentId list discrepancy in `schemas/agentProfile.ts`: the current `description` lists `calibrator | scout | advocate | editor | product | puzzle | game | design | bonus | qa | publisher` (11 ids, mismatched with the build brief's 14-agent pipeline). Update the description string ONLY (not any field name) to: `calibrator | scout | advocate | editor | researcher | origin-story | problem-statement | founder-bio | case-study | game | bonus | design | qa | publisher`. This is a description-only edit and does not violate the API_CONTRACTS field-name rule.

### TypeGen

- **D-12:** Sanity v5 TypeGen is the source of truth for type generation. Configure `apps/studio/sanity.cli.ts` with `schema: { path: './sanity.types.ts' }`. Run `sanity typegen generate` via the npm script `pnpm typegen`.
- **D-13:** Add `pretypegen` step that extracts the schema graph (`sanity schema extract --enforce-required-fields`) so generated types match runtime validation rules.
- **D-14:** Generated types live at `apps/studio/sanity.types.ts` (canonical, checked into git). Re-export from `packages/shared/src/sanity-types.ts` so `apps/web` (Phase 2) and the pipeline (Phase 4) both consume them via `@eisenbalm/shared`.
- **D-15:** No CI gate for typegen in this phase. Document in plan that engineers should run `pnpm typegen` after schema edits; a Phase 5+ CI step can enforce it.

### Agent Profile Seeding

- **D-16:** All 14 agents (per the build brief — see D-11 for the canonical list) are seeded as `agentProfile` documents.
- **D-17:** Seed script lives at `apps/studio/scripts/seed-agents.ts`. Uses `@sanity/client` with a Sanity API token (`SANITY_API_TOKEN` from env, write-scoped). Each document's `_id` is deterministic (`agent-calibrator`, `agent-scout`, …, `agent-publisher`) so re-runs are idempotent (`createOrReplace`).
- **D-18:** Seed payload includes `agentId` (slug), `displayName`, `role` (one-liner), and `personality` (3-4 sentences). Derived from the brief's voice notes and agent role descriptions; checked into a `apps/studio/scripts/agents.json` so non-developers (Andrew) can edit copy without TypeScript.
- **D-19:** Run via `pnpm seed:agents`; documented in `apps/studio/README.md` as a step Andrew runs after first deploy.

### Environment & Bootstrap

- **D-20:** Andrew (or whoever runs setup) must run `npx sanity@latest init --project-id <new-id>` once to create the Sanity project + `production` dataset. The CLI is interactive; this step is documented in `apps/studio/README.md` and is a manual prerequisite for the rest of the phase.
- **D-21:** After init, capture `projectId` and `dataset` into `apps/studio/.env.local` (gitignored) AND a checked-in `apps/studio/.env.example`.
- **D-22:** No CI for this phase. Local dev = `pnpm dev:studio`; deploy = `pnpm deploy:studio`. Both run from repo root.

### Claude's Discretion

- Studio plugin selection (vision, structure tool, etc.) — keep to Sanity defaults unless plan/research surfaces a need.
- Slug field UX (auto-generate on blur vs explicit button) — Sanity defaults are fine.
- Seed copy in `agents.json` — derived from brief; planner may polish wording.
- pnpm version — pin to a current LTS (`packageManager: "pnpm@9.x"` in root package.json).
- Whether to add Prettier/ESLint configs in Phase 1 — recommended yes (lightweight setup; everything Phase 2+ will rely on); planner decides specifics.

### Folded Todos

(None — no pending todos matched Phase 1 scope.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project / Brand

- `CLAUDE.md` — Project preface; "do not modify field names without checking API_CONTRACTS.md first" rule
- `docs/CLAUDE_CODE_BRIEF.md` — Build brief; canonical 14-agent list, voice notes, repository structure (the `apps/studio/schemas/` target for the relocation)
- `docs/API_CONTRACTS.md` — Field-name authority. Section references: §1 (GROQ reads — defines what fields the web shell will consume in Phase 2), §2 (Sanity write contracts), §7 (LangGraph state — informs `weeklyIssue.pipelineMetadata.runId`).

### Schemas (in repo)

- `schemas/charity.ts` — Charity document type (current location; will move to `apps/studio/schemas/charity.ts`)
- `schemas/weeklyIssue.ts` — Weekly issue document type (will move to `apps/studio/schemas/weeklyIssue.ts`)
- `schemas/agentProfile.ts` — Agent profile document type (will move to `apps/studio/schemas/agentProfile.ts`); description string requires the agentId-list update from D-11
- `schemas/index.ts` — Schema export index (will move to `apps/studio/schemas/index.ts`)

### Codebase Map

- `.planning/codebase/STACK.md` — Stack notes including the Sanity v3-vs-v5 status
- `.planning/codebase/STRUCTURE.md` — Current vs planned directory layout (this phase moves the layout from "current" toward "planned")
- `.planning/codebase/CONVENTIONS.md` — Sanity `defineType`/`defineField` pattern; field-naming conventions to preserve

### Research

- `.planning/research/STACK.md` — Sanity v5.24+ specifics, TypeGen GA, next-sanity v11 + Next.js 16 overage bug, package version verifications
- `.planning/research/SUMMARY.md` — Roadmap-level rationale for Phase 1 ordering and the "TypeGen day one" recommendation
- `.planning/research/PITFALLS.md` — `agentProfile` schema description outdated vs brief (Pitfall surfaced; resolved here in D-11)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`schemas/*.ts`** (4 files, ~21KB) — Production-ready Sanity schemas. Use as-is, just relocate.
- **`schemas/index.ts`** ordering — `[weeklyIssue, charity, agentProfile]` controls Sanity Studio sidebar order; preserve.
- **`schemas/weeklyIssue.ts` `editorialSection()` helper** — internal helper for repeated section structures; inspect during planning to ensure relocation doesn't break imports.
- **`schemas/charity.ts` slug source: `(doc) => …`** — dynamic slug; keep working after relocation.

### Established Patterns

- **Functional builder pattern:** all schemas use `defineType({ … defineField(…) … })`. Maintain consistency in any new schema work.
- **Default exports:** every schema file does `export default defineType(...)`. The `index.ts` collects them via named imports → named exports.
- **camelCase field names:** preserve verbatim; never rename (per CLAUDE.md rule).
- **`description:` strings** explain editorial intent and constraints (e.g., "Jesse voice, played completely straight"). Updating the agentProfile.ts description per D-11 is a content fix, not a structural change.
- **No existing test setup, no linter config, no Prettier config.** Phase 1 may introduce minimal lint/format setup if planner recommends.

### Integration Points

- **`convex/schema.ts`** stays at repo root and is untouched by this phase. Phase 3 deploys it.
- **`docs/API_CONTRACTS.md`** is the cross-system contract spec; changes to schema field names would require contract updates. Phase 1 makes no field-name changes.
- **`packages/shared/src/sanity-types.ts`** (created here) becomes the import point for Phase 2 (web app GROQ result typing) and Phase 4 (pipeline writes). Keep this file as a thin re-export from `apps/studio/sanity.types.ts` so the Sanity-generated types stay authoritative.

### Constraints from Existing Code

- The `agentId` description in `schemas/agentProfile.ts` lists 11 IDs with names that don't match the build brief (`product | puzzle` etc.). This must be reconciled in this phase (D-11). The schema's `agentId` FIELD NAME and TYPE remain unchanged.

</code_context>

<specifics>
## Specific Ideas

- **Andrew's first-time experience:** Plan must produce a clear `apps/studio/README.md` so Andrew can run, in order:
  1. `npx sanity@latest init` (interactive, creates project + dataset)
  2. Copy values into `apps/studio/.env.local`
  3. `pnpm install` from repo root
  4. `pnpm typegen`
  5. `pnpm seed:agents`
  6. `pnpm dev:studio` (verify locally)
  7. `pnpm deploy:studio` (publish to `<project>.sanity.studio`)
- **The 14-agent canonical list:** `calibrator, scout, advocate, editor, researcher, origin-story, problem-statement, founder-bio, case-study, game, bonus, design, qa, publisher`. Plan and seed script must use exactly these IDs in this order.
- **Voice tone of seeded agent profiles:** Match Jesse's voice (dry, precise, absurdly serious — no winking). The seed copy itself becomes part of the deliberation layer in Phase 9; getting it right now saves a Phase 9 rewrite.

</specifics>

<deferred>
## Deferred Ideas

- **Sanity Studio custom desk structure** — defer until Andrew's actual editing workflow surfaces friction. Default Studio is sufficient for Phase 1.
- **Per-environment datasets (development / staging / production)** — only `production` is needed for v1. Add staging dataset only if Andrew requests it.
- **Sanity preview mode in Studio** — defer to Phase 2 when there's a `apps/web/` to preview into.
- **Lockstep schema migrations / version control of schema changes** — defer; Sanity handles this implicitly via the deployed schema.
- **CI integration (lint, type-check, deploy gate)** — defer to a later milestone after weekly cadence is proven.
- **Sanity v6 / Next.js 16 upgrade plan** — wait for `next-sanity` v12 to ship; track but do not act on.

### Reviewed Todos (not folded)

(None — no todos were reviewed.)

</deferred>

---

*Phase: 01-sanity-foundation*
*Context gathered: 2026-05-09*
