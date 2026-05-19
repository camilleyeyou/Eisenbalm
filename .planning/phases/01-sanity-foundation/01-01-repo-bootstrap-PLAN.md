---
phase: 01-sanity-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - package.json
  - pnpm-workspace.yaml
  - tsconfig.base.json
  - .gitignore
autonomous: true
requirements:
  - FND-01
must_haves:
  truths:
    - "pnpm install runs cleanly from repo root"
    - "Workspaces apps/* and packages/* are recognized by pnpm"
    - "Root tsconfig.base.json provides strict TypeScript settings inheritable by every workspace"
    - ".env values are gitignored except .env.example (the example file itself is created in Plan 03 at apps/studio/.env.example per D-21)"
    - "Generated sanity.types.ts is NOT gitignored (per D-08)"
  artifacts:
    - path: "package.json"
      provides: "Monorepo root with packageManager pnpm@9.x and workspace scripts"
      contains: '"private": true'
    - path: "pnpm-workspace.yaml"
      provides: "Workspace globs"
      contains: "apps/*"
    - path: "tsconfig.base.json"
      provides: "Shared compiler settings (strict, ES2022, NodeNext)"
      contains: '"strict": true'
    - path: ".gitignore"
      provides: "Excludes node_modules, .env*, .next, .sanity, dist; preserves sanity.types.ts"
      contains: "node_modules"
  key_links:
    - from: "package.json"
      to: "pnpm-workspace.yaml"
      via: "pnpm reads packageManager and workspace globs"
      pattern: "pnpm@9"
    - from: "tsconfig.base.json"
      to: "every workspace tsconfig.json"
      via: "extends path"
      pattern: '"extends": "../../tsconfig.base.json"'
---

<objective>
Establish the monorepo skeleton: root `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`. After this plan, `pnpm install` runs cleanly from the repo root and recognizes `apps/*` and `packages/*` workspaces — even though those directories are still empty (Plans 03 and 04 fill them in).

Note: `apps/studio/.env.example` is created in Plan 03 (studio scaffold) per D-21, where the `apps/studio/` directory first comes into existence. Plan 01 stays focused on REPO-LEVEL bootstrap.

Purpose: Honors decisions D-05, D-06, D-07, D-08. Every later workspace inherits TypeScript settings, scripts, and gitignore rules from this layer. (D-21 — `.env.example` placement — is honored by Plan 03.)
Output: Four files at repo root that make the workspace structure real.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/01-sanity-foundation/01-CONTEXT.md
@CLAUDE.md
@docs/CLAUDE_CODE_BRIEF.md
@.planning/research/STACK.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create root package.json and pnpm-workspace.yaml</name>
  <files>package.json, pnpm-workspace.yaml</files>
  <read_first>
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md (decisions D-05 through D-08, D-22; "Claude's Discretion" notes pnpm@9.x LTS)
    - .planning/research/STACK.md (verifies pnpm + Sanity v5 expectations)
    - CLAUDE.md (project preface)
    - Verify the files do NOT already exist: `test ! -f package.json && test ! -f pnpm-workspace.yaml`
  </read_first>
  <action>
    Create `package.json` at repo root with EXACTLY this content:

    ```json
    {
      "name": "eisenbalm",
      "private": true,
      "version": "0.0.0",
      "description": "The Eisenbalm Dispatch — weekly editorial site, multi-agent pipeline, one-product commerce",
      "packageManager": "pnpm@9.15.4",
      "workspaces": ["apps/*", "packages/*"],
      "engines": {
        "node": ">=18.18.0",
        "pnpm": ">=9.0.0"
      },
      "scripts": {
        "dev:studio": "pnpm --filter studio dev",
        "build:studio": "pnpm --filter studio build",
        "deploy:studio": "pnpm --filter studio deploy",
        "typegen": "pnpm --filter studio typegen",
        "seed:agents": "pnpm --filter studio seed:agents"
      }
    }
    ```

    Notes:
    - `packageManager: "pnpm@9.15.4"` pins pnpm to the current 9.x LTS (per D-22 "Claude's Discretion" — current LTS).
    - `workspaces` array is the npm-fallback compat declaration (per D-06).
    - The five script delegators above match the workflow Andrew runs from repo root (per "Andrew's first-time experience" specifics in CONTEXT.md).

    Create `pnpm-workspace.yaml` at repo root with EXACTLY:

    ```yaml
    packages:
      - 'apps/*'
      - 'packages/*'
    ```

    Do NOT add convex/ to workspace globs — `convex/` stays at repo root per D-09 and is deployed independently (Phase 3). Do NOT add a `schemas/*` glob — schemas relocate to `apps/studio/schemas/` in Plan 03.
  </action>
  <verify>
    <automated>test -f package.json && test -f pnpm-workspace.yaml && grep -q '"private": true' package.json && grep -q 'pnpm@9' package.json && grep -q "apps/\*" pnpm-workspace.yaml && grep -q "packages/\*" pnpm-workspace.yaml && grep -q "dev:studio" package.json && grep -q "deploy:studio" package.json && grep -q "typegen" package.json && grep -q "seed:agents" package.json</automated>
  </verify>
  <done>
    - `package.json` exists at repo root with `"private": true`, `"packageManager": "pnpm@9.x"`, `workspaces: ["apps/*", "packages/*"]`, and the five script delegators
    - `pnpm-workspace.yaml` exists at repo root listing `apps/*` and `packages/*`
    - `pnpm install` from repo root would succeed (note: cannot fully test until Plan 03 creates apps/studio/package.json — that is expected)
  </done>
</task>

<task type="auto">
  <name>Task 2: Create tsconfig.base.json</name>
  <files>tsconfig.base.json</files>
  <read_first>
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md (decision D-07)
    - Verify file does NOT exist: `test ! -f tsconfig.base.json`
  </read_first>
  <action>
    Create `tsconfig.base.json` at repo root with EXACTLY this content:

    ```json
    {
      "$schema": "https://json.schemastore.org/tsconfig",
      "compilerOptions": {
        "target": "ES2022",
        "module": "NodeNext",
        "moduleResolution": "NodeNext",
        "lib": ["ES2022", "DOM", "DOM.Iterable"],
        "jsx": "preserve",
        "strict": true,
        "noUncheckedIndexedAccess": true,
        "noImplicitOverride": true,
        "esModuleInterop": true,
        "resolveJsonModule": true,
        "skipLibCheck": true,
        "forceConsistentCasingInFileNames": true,
        "isolatedModules": true,
        "incremental": true,
        "composite": true,
        "declaration": true,
        "declarationMap": true,
        "sourceMap": true
      },
      "exclude": ["node_modules", "dist", ".next", ".sanity"]
    }
    ```

    Each workspace `tsconfig.json` (created in Plans 03 and 04) will use `"extends": "../../tsconfig.base.json"` and may override `module`/`moduleResolution` (Sanity Studio uses bundler resolution; placeholders inherit verbatim).

    Per D-07, this MUST include `target=ES2022`, `moduleResolution=NodeNext`, `strict=true`, `jsx=preserve`, `composite=true`. The additional flags above (`noUncheckedIndexedAccess`, `forceConsistentCasingInFileNames`, etc.) are recommended modern defaults — planner discretion per D-22.
  </action>
  <verify>
    <automated>test -f tsconfig.base.json && grep -q '"strict": true' tsconfig.base.json && grep -q '"target": "ES2022"' tsconfig.base.json && grep -q '"moduleResolution": "NodeNext"' tsconfig.base.json && grep -q '"jsx": "preserve"' tsconfig.base.json && grep -q '"composite": true' tsconfig.base.json</automated>
  </verify>
  <done>
    - `tsconfig.base.json` exists at repo root
    - Compiler options include `target=ES2022`, `moduleResolution=NodeNext`, `strict=true`, `jsx=preserve`, `composite=true` (D-07)
    - File parses as valid JSON (verify with `node -e "JSON.parse(require('fs').readFileSync('tsconfig.base.json','utf8'))"`)
  </done>
</task>

<task type="auto">
  <name>Task 3: Create .gitignore</name>
  <files>.gitignore</files>
  <read_first>
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md (decisions D-08, D-21)
    - Verify file does NOT exist: `test ! -f .gitignore`
  </read_first>
  <action>
    Create `.gitignore` at repo root with EXACTLY this content:

    ```gitignore
    # Dependencies
    node_modules/
    .pnpm-store/

    # Build output
    dist/
    build/
    .next/
    .turbo/

    # Sanity
    apps/studio/dist/
    apps/studio/.sanity/
    # NOTE: apps/studio/sanity.types.ts is checked in (per D-08, D-14) — do NOT ignore it.

    # Environment files (gitignored except .env.example)
    .env
    .env.*
    !.env.example
    !apps/studio/.env.example

    # Editor / OS
    .DS_Store
    .idea/
    .vscode/*
    !.vscode/extensions.json
    *.swp
    *.swo

    # Logs
    *.log
    npm-debug.log*
    pnpm-debug.log*

    # TypeScript build info
    *.tsbuildinfo

    # Coverage
    coverage/
    .nyc_output/
    ```

    The negation rules `!.env.example` and `!apps/studio/.env.example` and the explicit comment "do NOT ignore sanity.types.ts" are load-bearing:
    - D-08 requires the generated types file to be checked in.
    - D-21 requires `apps/studio/.env.example` to be checked in. Plan 03 creates that file; this gitignore must not exclude it. The repo-root `!.env.example` rule is kept defensively in case a future plan adds a repo-root example.

    Note: This plan does NOT create `.env.example` itself. Per D-21, the canonical env example lives at `apps/studio/.env.example` and is created in Plan 03 alongside `apps/studio/sanity.config.ts` (where the `apps/studio/` directory first comes into existence).
  </action>
  <verify>
    <automated>test -f .gitignore && grep -q "node_modules" .gitignore && grep -q ".env" .gitignore && grep -q "!.env.example" .gitignore && grep -q "!apps/studio/.env.example" .gitignore && grep -q "apps/studio/.sanity" .gitignore && ! grep -E "^sanity\.types\.ts$|^apps/studio/sanity\.types\.ts$" .gitignore</automated>
  </verify>
  <done>
    - `.gitignore` excludes `node_modules/`, `.env*` (with `!.env.example` and `!apps/studio/.env.example` negations), `apps/studio/.sanity/`, `dist/`, `.next/`
    - `.gitignore` does NOT contain a rule that would match `apps/studio/sanity.types.ts` (D-08)
    - `apps/studio/.env.example` (created in Plan 03) will not be excluded by the `.env.*` rule
  </done>
</task>

</tasks>

<verification>
After all three tasks:
- `test -f package.json && test -f pnpm-workspace.yaml && test -f tsconfig.base.json && test -f .gitignore` exits 0
- `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` exits 0 (valid JSON)
- `node -e "JSON.parse(require('fs').readFileSync('tsconfig.base.json','utf8'))"` exits 0 (valid JSON)
- The four files together unblock all subsequent Phase 1 plans without yet creating the actual workspace directories.
- `apps/studio/.env.example` is intentionally NOT created here — Plan 03 owns it (per D-21, since `apps/studio/` is first scaffolded in Plan 03).
</verification>

<success_criteria>
- All four root configuration files exist with the contents specified above
- `package.json` declares pnpm@9.x as packageManager
- `pnpm-workspace.yaml` declares the two workspace globs
- `tsconfig.base.json` provides strict TypeScript settings inheritable by every workspace
- `.gitignore` does not accidentally ignore the generated `sanity.types.ts` (D-08)
- `.gitignore` includes a `!apps/studio/.env.example` negation so Plan 03's env example file can be tracked (D-21)
</success_criteria>

<output>
After completion, create `.planning/phases/01-sanity-foundation/01-01-SUMMARY.md` describing which files were created, exact pnpm version pinned, and noting that `pnpm install` cannot succeed until Plan 03 produces `apps/studio/package.json`. Also note that `apps/studio/.env.example` (D-21) is intentionally deferred to Plan 03.
</output>
