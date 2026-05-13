---
phase: 03-convex-deployment
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - convex/package.json
  - convex/tsconfig.json
  - convex/.gitignore
  - pnpm-workspace.yaml
  - package.json
  - .env.example
  - apps/web/.env.example
autonomous: true
requirements:
  - CVX-01
must_haves:
  truths:
    - "convex/ is a real pnpm workspace named @eisenbalm/convex"
    - "Running pnpm install resolves convex@^1.38.0 inside convex/node_modules"
    - "Root package.json has dev:convex and deploy:convex scripts"
    - "Root .env.example and apps/web/.env.example both document NEXT_PUBLIC_CONVEX_URL and CONVEX_DEPLOY_KEY"
    - "convex/.gitignore ignores .env.local but does NOT ignore _generated/"
  artifacts:
    - path: "convex/package.json"
      provides: "Workspace manifest naming @eisenbalm/convex and pinning convex@^1.38.0"
      contains: "@eisenbalm/convex"
    - path: "convex/tsconfig.json"
      provides: "TS config extending tsconfig.base.json so codegen typechecks"
      contains: "../tsconfig.base.json"
    - path: "convex/.gitignore"
      provides: "Allows _generated/ to be committed; gitignores .env.local"
      contains: ".env.local"
    - path: "pnpm-workspace.yaml"
      provides: "Includes convex/ as a workspace"
      contains: "convex"
  key_links:
    - from: "package.json (root scripts)"
      to: "convex workspace"
      via: "pnpm --filter @eisenbalm/convex"
      pattern: "@eisenbalm/convex"
    - from: ".env.example (root + apps/web)"
      to: "Convex Cloud deployment"
      via: "NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOY_KEY placeholders"
      pattern: "CONVEX_DEPLOY_KEY"
---

<objective>
Establish `convex/` as its own pnpm workspace `@eisenbalm/convex` so the Convex CLI has a workspace home (per D-05, D-06). Pin `convex@^1.38.0` (D-01), wire root scripts (`dev:convex`, `deploy:convex`), add the workspace glob, and document the two new env vars (`NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`) in both root `.env.example` and `apps/web/.env.example` (D-20, D-21).

Everything in this plan is autonomous and prepares the ground for Andrew's interactive `convex dev --once --configure` checkpoint in Plan 03-02. After this plan, `pnpm install` from repo root succeeds and the Convex CLI is invocable via `pnpm --filter @eisenbalm/convex exec convex --help`.

Purpose: Honors D-01 (version pin), D-05 (promote convex/ to workspace), D-06 (workspace glob), D-08 (`_generated/` checked in — `.gitignore` makes this explicit), D-20/D-21 (env wiring), D-09 (regenerate command script ready).
Output: A repo where `pnpm install` resolves the convex devDep, and root scripts can invoke Convex CLI commands.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/03-convex-deployment/03-CONTEXT.md
@.planning/phases/03-convex-deployment/03-RESEARCH.md
@package.json
@pnpm-workspace.yaml
@tsconfig.base.json
@.gitignore
@apps/web/.env.example
@convex/schema.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create convex/package.json, convex/tsconfig.json, convex/.gitignore</name>
  <files>convex/package.json, convex/tsconfig.json, convex/.gitignore</files>
  <read_first>
    - convex/schema.ts (existing file — verify it stays untouched)
    - tsconfig.base.json (the base TS config convex/tsconfig.json extends)
    - .gitignore (current gitignore patterns to mirror Phase 1 D-08/D-14 posture)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Code Examples §5, §8, §9, §10 (verbatim file contents)
    - apps/studio/package.json (existing workspace pattern for private, scripted workspace)
  </read_first>
  <action>
    Create exactly three files. Use the Write tool — never heredoc.

    **File 1: `convex/package.json`** — verbatim from 03-RESEARCH.md §Standard Stack "Installation (in convex/package.json)":

    ```jsonc
    {
      "name": "@eisenbalm/convex",
      "version": "0.0.0",
      "private": true,
      "description": "Convex schema + queries + mutations for The Eisenbalm Dispatch pipeline",
      "scripts": {
        "dev": "convex dev",
        "dev:once": "convex dev --once",
        "deploy": "convex deploy",
        "codegen": "convex codegen",
        "dashboard": "convex dashboard",
        "typecheck": "tsc --noEmit"
      },
      "devDependencies": {
        "convex": "^1.38.0",
        "typescript": "^5.6.0"
      }
    }
    ```

    **File 2: `convex/tsconfig.json`** — verbatim from 03-RESEARCH.md §Code Examples §8:

    ```jsonc
    {
      "extends": "../tsconfig.base.json",
      "compilerOptions": {
        "target": "ESNext",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "lib": ["ES2022", "DOM"],
        "noEmit": true,
        "isolatedModules": true,
        "skipLibCheck": true,
        "allowSyntheticDefaultImports": true,
        "esModuleInterop": true,
        "jsx": "preserve",
        "strict": true,
        "types": ["node"]
      },
      "include": ["**/*.ts", "_generated/**/*.ts"],
      "exclude": ["node_modules"]
    }
    ```

    **File 3: `convex/.gitignore`** — verbatim from 03-RESEARCH.md §Code Examples §9. Critical comment block per D-08 (mirror Phase 1 D-08/D-14 pattern — never ignore _generated/):

    ```gitignore
    # Convex CLI local config — NEVER commit (contains deployment URL + deploy key)
    .env.local
    .env

    # DO commit _generated/ so types travel with the repo (project D-08 — mirrors
    # Phase 1 D-14 sanity.types.ts pattern). If you find yourself adding a
    # `_generated/` rule below, stop and re-read .planning/phases/03-convex-deployment/03-CONTEXT.md D-08.
    ```

    No additional rules. The repo-root `.gitignore` already covers `node_modules/`.

    **Important about the `_generated` verification check:** The comment block above intentionally contains the substring `_generated` (as a human-readable warning). The verify regex below uses `! grep -qE '^[^#]*_generated' convex/.gitignore` — it ASSERTS THAT `_generated` does NOT appear on any active (non-comment) line. The check passes when `_generated` appears ONLY inside `#`-prefixed comment lines and fails if it appears as an actual gitignore rule.
  </action>
  <verify>
    <automated>test -f convex/package.json && test -f convex/tsconfig.json && test -f convex/.gitignore && grep -q "@eisenbalm/convex" convex/package.json && grep -q '"convex": "\^1.38.0"' convex/package.json && grep -q '"extends": "../tsconfig.base.json"' convex/tsconfig.json && grep -q '"types": \["node"\]' convex/tsconfig.json && grep -q "^.env.local" convex/.gitignore && ! grep -qE '^[^#]*_generated' convex/.gitignore</automated>
  </verify>
  <acceptance_criteria>
    - `convex/package.json` exists and parses as valid JSON (`node -e "JSON.parse(require('fs').readFileSync('convex/package.json','utf8'))"` exits 0)
    - `convex/package.json` contains `"name": "@eisenbalm/convex"`, `"private": true`, and `"convex": "^1.38.0"` in `devDependencies`
    - `convex/package.json` contains scripts `dev`, `dev:once`, `deploy`, `codegen`, `dashboard`, `typecheck`
    - `convex/tsconfig.json` extends `../tsconfig.base.json` and includes `_generated/**/*.ts`
    - `convex/.gitignore` ignores `.env.local` and `.env` but does NOT contain any ACTIVE (non-comment) line ignoring `_generated/` — checked via `! grep -qE '^[^#]*_generated' convex/.gitignore` (passes when `_generated` only appears in `#`-prefixed comments)
    - `git check-ignore convex/.env.local` exits 0 (file would be ignored when created)
    - `git check-ignore convex/_generated/api.ts` exits non-zero (file would NOT be ignored when created)
  </acceptance_criteria>
  <done>
    Three new files exist with exact content per 03-RESEARCH.md. The convex/ directory is now structurally ready to host the Convex CLI's workspace. The .gitignore explicitly preserves `_generated/` per D-08.
  </done>
</task>

<task type="auto">
  <name>Task 2: Update pnpm-workspace.yaml and root package.json to include @eisenbalm/convex workspace</name>
  <files>pnpm-workspace.yaml, package.json</files>
  <read_first>
    - pnpm-workspace.yaml (current globs: `apps/*` and `packages/*`)
    - package.json (current scripts list — preserve all existing entries)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Code Examples §10 (pnpm-workspace.yaml diff)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-06 ("Add `convex` as an explicit entry")
  </read_first>
  <action>
    **File 1: `pnpm-workspace.yaml`** — replace entire contents with (preserving the `'apps/*'` and `'packages/*'` entries and adding `'convex'` per D-06):

    ```yaml
    packages:
      - 'apps/*'
      - 'packages/*'
      - 'convex'
    ```

    **File 2: `package.json`** — add new scripts. Preserve all existing scripts and fields byte-for-byte. The final `scripts` block (alphabetical-by-action grouping kept consistent with current pattern) MUST contain these new entries appended after the existing Sanity/web entries:

    - `"dev:convex": "pnpm --filter @eisenbalm/convex dev"`
    - `"deploy:convex": "pnpm --filter @eisenbalm/convex deploy"`
    - `"codegen:convex": "pnpm --filter @eisenbalm/convex codegen"`
    - `"typecheck:convex": "pnpm --filter @eisenbalm/convex typecheck"`

    Do NOT touch `packageManager`, `engines`, `workspaces` (note: pnpm uses `pnpm-workspace.yaml`, but the root `workspaces` field is harmless and stays), `name`, `private`, `version`, `description`.

    After write, the scripts object should still contain every prior script (dev:studio, build:studio, deploy:studio, typegen, seed:agents, seed:demo, dev:web, build:web, lint:web, typecheck:web) AND the four new ones above.
  </action>
  <verify>
    <automated>grep -q "'convex'" pnpm-workspace.yaml && grep -q "dev:convex" package.json && grep -q "deploy:convex" package.json && grep -q "codegen:convex" package.json && grep -q "typecheck:convex" package.json && grep -q "dev:studio" package.json && grep -q "dev:web" package.json && node -e "const p=JSON.parse(require('fs').readFileSync('package.json','utf8')); if(!p.scripts['dev:convex']||!p.scripts['deploy:convex']||!p.scripts['codegen:convex']||!p.scripts['typecheck:convex'])process.exit(1);"</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm-workspace.yaml` contains `- 'convex'` on its own line under `packages:`
    - `pnpm-workspace.yaml` still contains `- 'apps/*'` and `- 'packages/*'` (no entries removed)
    - `package.json` parses as valid JSON
    - `package.json` `scripts` object contains all four new entries: `dev:convex`, `deploy:convex`, `codegen:convex`, `typecheck:convex`
    - `package.json` retains every previous script — `dev:studio`, `build:studio`, `deploy:studio`, `typegen`, `seed:agents`, `seed:demo`, `dev:web`, `build:web`, `lint:web`, `typecheck:web`
    - `package.json` `packageManager` is still `pnpm@9.15.4`
  </acceptance_criteria>
  <done>
    Running `pnpm install` from repo root will now resolve `@eisenbalm/convex` as a workspace member. All four new convex scripts are invokable from root (e.g. `pnpm typecheck:convex`).
  </done>
</task>

<task type="auto">
  <name>Task 3: Extend root .env.example and apps/web/.env.example with Convex env vars</name>
  <files>.env.example, apps/web/.env.example</files>
  <read_first>
    - apps/web/.env.example (current content — preserve existing Sanity + site URL entries)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-20, D-21 (env var contract: NEXT_PUBLIC_CONVEX_URL public, CONVEX_DEPLOY_KEY secret)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Code Examples §6 (Andrew's expected env values after init)
    - apps/web/.env.example (existing template — Phase 2 left it with Sanity + NEXT_PUBLIC_SITE_URL)
  </read_first>
  <action>
    **File 1: `apps/web/.env.example`** — REPLACE entire contents with (preserving the three existing entries and appending two Convex entries with explicit security comments per D-20):

    ```
    # Public Sanity config (safe to expose — production dataset is public reads only)
    NEXT_PUBLIC_SANITY_PROJECT_ID=6h1vd9mf
    NEXT_PUBLIC_SANITY_DATASET=production

    # Site base URL (used in sitemap.xml, feed.xml, JSON-LD, OG canonical URLs)
    # In production, set to https://eisenbalm.com via Vercel env vars.
    NEXT_PUBLIC_SITE_URL=http://localhost:3000

    # Public Convex deployment URL — safe to expose, used by ConvexReactClient
    # Set after Andrew runs `pnpm --filter @eisenbalm/convex exec convex dev --once --configure`.
    # Format: https://<adjective-animal-NNN>.convex.cloud
    NEXT_PUBLIC_CONVEX_URL=

    # Convex Production Deploy Key — SECRET. Grants full read/write to the Convex
    # deployment (deliberation events, pipeline runs, votes, corrections, pitches).
    # Treat like a database password. NEVER commit. NEVER expose via NEXT_PUBLIC_*.
    # Used by `convex deploy` (Vercel build step) and by the Python pipeline's
    # HTTP API mutation calls (Phase 4, Railway). Generate at:
    # Convex dashboard → Settings → Deploy Keys → Generate Production
    CONVEX_DEPLOY_KEY=
    ```

    **File 2: root `.env.example`** — CREATE this file (it does not yet exist). Contents — root env is shaped for the pipeline (Phase 4 will consume), but Phase 3 includes both vars here per D-21 for cross-workspace clarity:

    ```
    # ─── Convex (Phase 3) ─────────────────────────────────────────────────────
    # Both vars set by Andrew after running:
    #   pnpm --filter @eisenbalm/convex exec convex dev --once --configure

    # Public Convex deployment URL — safe to log
    NEXT_PUBLIC_CONVEX_URL=

    # Convex Production Deploy Key — SECRET
    # Used by Python pipeline (Phase 4) for HTTP API mutation calls.
    # Generate at: Convex dashboard → Settings → Deploy Keys → Production
    CONVEX_DEPLOY_KEY=

    # ─── Sanity (Phase 1) ─────────────────────────────────────────────────────
    # Public project ID
    NEXT_PUBLIC_SANITY_PROJECT_ID=6h1vd9mf
    NEXT_PUBLIC_SANITY_DATASET=production

    # Pipeline (Phase 4) write token — SECRET. Editor role on production dataset.
    SANITY_API_TOKEN=
    ```

    Use the Write tool to create both files. The root `.env.example` is new (the repo's existing `.gitignore` already excludes `.env.*` but explicitly negates `.env.example` — so this file IS commitable).
  </action>
  <verify>
    <automated>test -f .env.example && test -f apps/web/.env.example && grep -q "^NEXT_PUBLIC_CONVEX_URL=" .env.example && grep -q "^CONVEX_DEPLOY_KEY=" .env.example && grep -q "^NEXT_PUBLIC_CONVEX_URL=" apps/web/.env.example && grep -q "^CONVEX_DEPLOY_KEY=" apps/web/.env.example && grep -q "^NEXT_PUBLIC_SANITY_PROJECT_ID=6h1vd9mf" apps/web/.env.example && grep -q "^NEXT_PUBLIC_SITE_URL=" apps/web/.env.example && grep -qi "secret\|NEVER commit\|database password" apps/web/.env.example</automated>
  </verify>
  <acceptance_criteria>
    - `.env.example` exists at repo root and contains both `NEXT_PUBLIC_CONVEX_URL=` and `CONVEX_DEPLOY_KEY=` lines
    - `.env.example` also documents `NEXT_PUBLIC_SANITY_PROJECT_ID`, `NEXT_PUBLIC_SANITY_DATASET`, `SANITY_API_TOKEN` for pipeline cross-reference
    - `apps/web/.env.example` retains `NEXT_PUBLIC_SANITY_PROJECT_ID=6h1vd9mf`, `NEXT_PUBLIC_SANITY_DATASET=production`, `NEXT_PUBLIC_SITE_URL=http://localhost:3000` lines unchanged
    - `apps/web/.env.example` adds `NEXT_PUBLIC_CONVEX_URL=` and `CONVEX_DEPLOY_KEY=` with an explicit "SECRET" / "NEVER commit" / "NEXT_PUBLIC_*" warning comment for the deploy key
    - `git check-ignore .env.example` exits non-zero (file IS committable — root .gitignore negates `!.env.example`)
    - `git check-ignore apps/web/.env.example` exits non-zero
  </acceptance_criteria>
  <done>
    Both `.env.example` files document the two new Convex vars with explicit security wording. Andrew (Plan 03-02) will copy these names into `.env.local` after running the interactive init.
  </done>
</task>

</tasks>

<verification>
- `convex/package.json`, `convex/tsconfig.json`, `convex/.gitignore` exist with content matching 03-RESEARCH.md
- `convex/.gitignore` has `_generated` ONLY inside `#`-prefixed comment lines (no active rule): assert with `! grep -qE '^[^#]*_generated' convex/.gitignore`
- `pnpm-workspace.yaml` includes `'convex'` as a workspace entry
- Root `package.json` has the four new convex scripts and retains all prior scripts
- Both `.env.example` files document `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOY_KEY` with security comments
- `pnpm install` from repo root resolves `@eisenbalm/convex` workspace (will land in Plan 03-02 when convex is actually installed; nothing to verify here besides JSON validity)
- No file in apps/web has been touched in this plan — that is Plan 03-05's territory
- convex/schema.ts has NOT been modified
</verification>

<success_criteria>
- `convex/` is a real pnpm workspace named `@eisenbalm/convex`
- `convex@^1.38.0` is pinned in `convex/package.json`
- Root scripts `dev:convex`, `deploy:convex`, `codegen:convex`, `typecheck:convex` exist
- Two new env var names documented in both `.env.example` files
- `_generated/` is explicitly preserved by convex/.gitignore (mirroring Phase 1 D-08)
- Plan 03-02 (Andrew's interactive init) can now run `pnpm --filter @eisenbalm/convex exec convex dev --once --configure` and have it succeed
</success_criteria>

<output>
After completion, create `.planning/phases/03-convex-deployment/03-01-SUMMARY.md` recording (a) the files created and any deviation from verbatim content in 03-RESEARCH.md, (b) confirmation that `git status` does not show any modification to `convex/schema.ts`, and (c) the exact value of `convex` devDependency pin shipped (target: `^1.38.0` — note if npm registry has shifted).
</output>
</content>
</invoke>