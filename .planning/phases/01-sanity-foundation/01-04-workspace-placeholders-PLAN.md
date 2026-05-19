---
phase: 01-sanity-foundation
plan: 04
type: execute
wave: 2
depends_on:
  - "01-01"
files_modified:
  - packages/shared/package.json
  - packages/shared/tsconfig.json
  - packages/shared/src/index.ts
  - packages/shared/src/sanity-types.ts
  - apps/web/package.json
  - apps/web/tsconfig.json
  - apps/web/README.md
  - packages/pipeline/package.json
  - packages/pipeline/tsconfig.json
  - packages/pipeline/README.md
autonomous: true
requirements:
  - FND-02
must_haves:
  truths:
    - "`pnpm install` from repo root recognizes packages/shared as @eisenbalm/shared"
    - "packages/shared exports a placeholder `sanity-types` re-export ready for Plan 05 to populate"
    - "apps/web and packages/pipeline directories exist as placeholder workspaces (Phase 2 / Phase 4 fill them in)"
    - "No Phase 2 or Phase 4 implementation work begins here — only enough scaffolding for pnpm to resolve workspaces"
  artifacts:
    - path: "packages/shared/package.json"
      provides: "@eisenbalm/shared workspace package consumable by apps/web and packages/pipeline"
      contains: '"name": "@eisenbalm/shared"'
    - path: "packages/shared/src/sanity-types.ts"
      provides: "Re-export point for the canonical apps/studio/sanity.types.ts (populated by Plan 05)"
      contains: "TODO"
    - path: "packages/shared/src/index.ts"
      provides: "Public entrypoint of @eisenbalm/shared"
      contains: "sanity-types"
    - path: "apps/web/package.json"
      provides: "Placeholder workspace; Phase 2 owns the real Next.js scaffolding"
      contains: '"private": true'
    - path: "packages/pipeline/package.json"
      provides: "Placeholder workspace; Phase 4 owns the real FastAPI/LangGraph code (uv-managed Python)"
      contains: '"private": true'
  key_links:
    - from: "packages/shared/src/index.ts"
      to: "packages/shared/src/sanity-types.ts"
      via: "barrel re-export"
      pattern: "export \\* from"
    - from: "packages/shared/src/sanity-types.ts"
      to: "apps/studio/sanity.types.ts"
      via: "Plan 05 will replace the TODO with a real `export type * from '...'` line"
      pattern: "TODO"
---

<objective>
Create minimal placeholder workspaces so `pnpm install` resolves the full monorepo and Plan 05 has a real `packages/shared` to re-export Sanity types from. apps/web and packages/pipeline get only enough package.json to be valid workspaces — their actual code is Phase 2 and Phase 4 work.

Purpose: Honors decisions D-05 (placeholder web/pipeline directories), D-14 (packages/shared re-exports Sanity types as `@eisenbalm/shared`).
Output: Three workspace skeletons under `apps/web`, `packages/shared`, `packages/pipeline`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-sanity-foundation/01-CONTEXT.md
@CLAUDE.md
@docs/CLAUDE_CODE_BRIEF.md
@.planning/research/STACK.md
@.planning/codebase/STRUCTURE.md
@package.json
@tsconfig.base.json
@pnpm-workspace.yaml
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create packages/shared with placeholder Sanity types re-export</name>
  <files>packages/shared/package.json, packages/shared/tsconfig.json, packages/shared/src/index.ts, packages/shared/src/sanity-types.ts</files>
  <read_first>
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md (D-14: Re-export from `packages/shared/src/sanity-types.ts` so apps/web and pipeline consume via `@eisenbalm/shared`)
    - tsconfig.base.json (root config to extend)
    - .planning/codebase/STRUCTURE.md (packages/shared section: TypeScript shared types used by frontend and backend)
  </read_first>
  <action>
    Step 1 — Create directory: `mkdir -p packages/shared/src`.

    Step 2 — Create `packages/shared/package.json` with EXACTLY this content:

    ```json
    {
      "name": "@eisenbalm/shared",
      "version": "0.0.0",
      "private": true,
      "description": "Shared TypeScript types for The Eisenbalm Dispatch (re-exports Sanity-generated types and pipeline-mirror types)",
      "type": "module",
      "main": "./src/index.ts",
      "types": "./src/index.ts",
      "exports": {
        ".": {
          "types": "./src/index.ts",
          "default": "./src/index.ts"
        },
        "./sanity-types": {
          "types": "./src/sanity-types.ts",
          "default": "./src/sanity-types.ts"
        }
      },
      "scripts": {
        "typecheck": "tsc --noEmit"
      },
      "devDependencies": {
        "typescript": "^5.6.0"
      }
    }
    ```

    Notes:
    - Name is `@eisenbalm/shared` (D-14). Phase 2 and Phase 4 import from this name.
    - `main` and `types` point at the source `.ts` file. Because consumers are workspace packages with TypeScript build configured, source-resolution is the simplest pattern in 2026. No build step is required for placeholder content.
    - The `./sanity-types` subpath export lets Phase 2 do `import type { WeeklyIssue } from '@eisenbalm/shared/sanity-types'` if it wants a tighter import.

    Step 3 — Create `packages/shared/tsconfig.json` with EXACTLY this content:

    ```json
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "outDir": "./dist",
        "rootDir": "./src",
        "noEmit": false
      },
      "include": ["src/**/*.ts"],
      "exclude": ["node_modules", "dist"]
    }
    ```

    Step 4 — Create `packages/shared/src/sanity-types.ts` with EXACTLY this content (placeholder; Plan 05 replaces the TODO line with a real re-export of `apps/studio/sanity.types.ts`):

    ```typescript
    // ─── Sanity-derived types ─────────────────────────────────────────────
    // This file is the single import point for apps/web (Phase 2) and
    // packages/pipeline (Phase 4) to consume Sanity-generated types.
    //
    // Plan 05 replaces the TODO export below with a real re-export pointing
    // at apps/studio/sanity.types.ts. Keeping the indirection here means
    // schema changes only ripple through one path.
    //
    // TODO(plan-05): replace with `export type * from '../../../apps/studio/sanity.types'`
    // (or the path-mapped equivalent once Plan 05 wires the typegen output).
    export {}
    ```

    The empty `export {}` makes the file a valid TypeScript module with zero exports, which is enough for the build to succeed before Plan 05 lands.

    Step 5 — Create `packages/shared/src/index.ts` with EXACTLY this content:

    ```typescript
    // Public entrypoint for @eisenbalm/shared.
    // Sub-barrels are organized by domain.
    export * from './sanity-types'
    ```

    This barrel ensures Phase 2 / Phase 4 can do `import type { Foo } from '@eisenbalm/shared'` without knowing the internal file layout.
  </action>
  <verify>
    <automated>test -d packages/shared/src && test -f packages/shared/package.json && test -f packages/shared/tsconfig.json && test -f packages/shared/src/index.ts && test -f packages/shared/src/sanity-types.ts && grep -q "@eisenbalm/shared" packages/shared/package.json && grep -q "private" packages/shared/package.json && grep -q "TODO(plan-05)" packages/shared/src/sanity-types.ts && grep -q "sanity-types" packages/shared/src/index.ts && grep -q "tsconfig.base.json" packages/shared/tsconfig.json && node -e "JSON.parse(require('fs').readFileSync('packages/shared/package.json','utf8'))"</automated>
  </verify>
  <done>
    - `packages/shared/package.json` declares name=`@eisenbalm/shared`, private=true, with the `.` and `./sanity-types` subpath exports
    - `packages/shared/tsconfig.json` extends `../../tsconfig.base.json`
    - `packages/shared/src/sanity-types.ts` exists with the TODO marker for Plan 05
    - `packages/shared/src/index.ts` re-exports `./sanity-types`
  </done>
</task>

<task type="auto">
  <name>Task 2: Create apps/web placeholder workspace</name>
  <files>apps/web/package.json, apps/web/tsconfig.json, apps/web/README.md</files>
  <read_first>
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md (D-05: placeholder apps/web/ — real work in Phase 2)
    - .planning/ROADMAP.md (Phase 2: Web Shell + Theme Engine — confirms web app is later)
    - tsconfig.base.json (root config to extend)
  </read_first>
  <action>
    Step 1 — Create directory: `mkdir -p apps/web`.

    Step 2 — Create `apps/web/package.json` with EXACTLY this content:

    ```json
    {
      "name": "web",
      "version": "0.0.0",
      "private": true,
      "description": "Next.js 15 reader frontend — placeholder. Real scaffolding lands in Phase 2.",
      "scripts": {
        "dev": "echo \"apps/web is a Phase 2 placeholder. Scaffold lands in Phase 2.\" && exit 0"
      },
      "dependencies": {
        "@eisenbalm/shared": "workspace:*"
      }
    }
    ```

    The `@eisenbalm/shared` workspace dependency proves the workspace graph resolves. Phase 2 replaces this file wholesale with the real Next.js setup (next, react, next-sanity, convex/react, stripe, etc.).

    Step 3 — Create `apps/web/tsconfig.json` with EXACTLY this content:

    ```json
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "noEmit": true
      },
      "include": [],
      "exclude": ["node_modules", ".next"]
    }
    ```

    Empty `include` is intentional — Phase 2 supplies real source paths.

    Step 4 — Create `apps/web/README.md` with EXACTLY this content:

    ```markdown
    # apps/web — Next.js reader frontend

    **Status:** Placeholder workspace (Phase 1).
    **Owner:** Phase 2 — Web Shell + Theme Engine.

    Phase 2 will replace this README and the surrounding scaffolding with the real
    Next.js 15 + App Router setup that consumes `@eisenbalm/shared` for Sanity types.

    Until then, this directory exists only so `pnpm install` resolves the full
    workspace graph from the repo root.
    ```
  </action>
  <verify>
    <automated>test -d apps/web && test -f apps/web/package.json && test -f apps/web/tsconfig.json && test -f apps/web/README.md && grep -q "\"name\": \"web\"" apps/web/package.json && grep -q "@eisenbalm/shared" apps/web/package.json && grep -q "Phase 2" apps/web/README.md && grep -q "tsconfig.base.json" apps/web/tsconfig.json && node -e "JSON.parse(require('fs').readFileSync('apps/web/package.json','utf8'))"</automated>
  </verify>
  <done>
    - `apps/web/package.json` exists with `"name": "web"`, `"private": true`, and a workspace dep on `@eisenbalm/shared`
    - `apps/web/tsconfig.json` extends the root base
    - `apps/web/README.md` clearly marks the directory as a Phase 2 placeholder
  </done>
</task>

<task type="auto">
  <name>Task 3: Create packages/pipeline placeholder workspace</name>
  <files>packages/pipeline/package.json, packages/pipeline/tsconfig.json, packages/pipeline/README.md</files>
  <read_first>
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md (D-05: placeholder packages/pipeline/ — Phase 4 work)
    - .planning/ROADMAP.md (Phase 4: Pipeline Skeleton — FastAPI on Railway via uv)
    - .planning/research/STACK.md (Pipeline backend layer — Python, uv-managed)
  </read_first>
  <action>
    Step 1 — Create directory: `mkdir -p packages/pipeline`.

    Step 2 — Create `packages/pipeline/package.json` with EXACTLY this content. Note: the actual pipeline is a Python project managed by `uv` (see Phase 4 research), but having a `package.json` keeps it discoverable as a pnpm workspace and gives Plan 05 / Phase 2 a place to declare cross-language scripts later if useful.

    ```json
    {
      "name": "pipeline",
      "version": "0.0.0",
      "private": true,
      "description": "FastAPI + LangGraph pipeline (Python, uv-managed) — placeholder. Real scaffolding lands in Phase 4.",
      "scripts": {
        "dev": "echo \"packages/pipeline is a Phase 4 placeholder. Real Python project (uv + FastAPI + LangGraph) lands in Phase 4.\" && exit 0"
      }
    }
    ```

    No workspace dependency on `@eisenbalm/shared` — the pipeline is Python and consumes Sanity types via the Sanity HTTP API directly (research/STACK.md "no maintained Sanity Python SDK"). Cross-language type sharing is a Phase 4 concern.

    Step 3 — Create `packages/pipeline/tsconfig.json` with EXACTLY this content (so editor tooling treats the dir as TS-aware even though it's Python):

    ```json
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "noEmit": true
      },
      "include": [],
      "exclude": ["node_modules", ".venv", "__pycache__"]
    }
    ```

    Step 4 — Create `packages/pipeline/README.md` with EXACTLY this content:

    ```markdown
    # packages/pipeline — FastAPI + LangGraph pipeline

    **Status:** Placeholder workspace (Phase 1).
    **Owner:** Phase 4 — Pipeline Skeleton (LangGraph + 14 stub agents).

    This package is **Python**, not TypeScript. Phase 4 introduces the real
    project via `uv init --python 3.11` plus a Dockerfile for Railway (WeasyPrint
    requires system libs that Railway's default environment does not provide —
    see `.planning/research/STACK.md` "Sharp Edges").

    The empty `package.json` here exists so the directory is discoverable as a
    pnpm workspace and so future cross-language scripts (e.g. orchestration
    helpers) have a home if needed. The 14 agents, FastAPI app, LangGraph state
    contract, and Convex/Sanity HTTP clients all land in Phase 4.
    ```
  </action>
  <verify>
    <automated>test -d packages/pipeline && test -f packages/pipeline/package.json && test -f packages/pipeline/tsconfig.json && test -f packages/pipeline/README.md && grep -q "\"name\": \"pipeline\"" packages/pipeline/package.json && grep -q "private" packages/pipeline/package.json && grep -q "Phase 4" packages/pipeline/README.md && grep -q "tsconfig.base.json" packages/pipeline/tsconfig.json && node -e "JSON.parse(require('fs').readFileSync('packages/pipeline/package.json','utf8'))"</automated>
  </verify>
  <done>
    - `packages/pipeline/package.json` exists with `"name": "pipeline"`, `"private": true`
    - `packages/pipeline/tsconfig.json` extends the root base (editor compatibility only)
    - `packages/pipeline/README.md` clearly marks the directory as a Phase 4 placeholder and notes the Python/uv toolchain
  </done>
</task>

</tasks>

<verification>
After all three tasks:
- `test -f packages/shared/package.json && test -f apps/web/package.json && test -f packages/pipeline/package.json` exits 0
- All three `package.json` files parse as valid JSON
- `packages/shared` declares name `@eisenbalm/shared` and `apps/web` declares a workspace dependency on it (proving the workspace graph resolves)
- `packages/shared/src/sanity-types.ts` carries the explicit TODO marker for Plan 05 to fulfil
- After Plan 03 is merged, `pnpm install` from repo root should succeed and link the four workspaces (`studio`, `web`, `pipeline`, `@eisenbalm/shared`). This is the practical Wave 2 gate.
</verification>

<success_criteria>
- All three placeholder workspaces exist with valid `package.json` and `tsconfig.json`
- `packages/shared` is functional enough that Plan 05 can wire its types and Phase 2 can already import from `@eisenbalm/shared` (returning nothing, but resolving)
- `apps/web` and `packages/pipeline` README clearly mark them as future-phase placeholders so no executor accidentally backfills them now
- No real Phase 2 or Phase 4 work bleeds into Phase 1
</success_criteria>

<output>
After completion, create `.planning/phases/01-sanity-foundation/01-04-SUMMARY.md` listing the three workspaces created, the workspace-dep edge from `apps/web` to `@eisenbalm/shared`, and the explicit TODO that Plan 05 will resolve.
</output>
