---
phase: 01-sanity-foundation
plan: 03
type: execute
wave: 2
depends_on:
  - "01-01"
  - "01-02"
files_modified:
  - apps/studio/package.json
  - apps/studio/tsconfig.json
  - apps/studio/sanity.config.ts
  - apps/studio/sanity.cli.ts
  - apps/studio/.env.example
  - apps/studio/schemas/charity.ts
  - apps/studio/schemas/weeklyIssue.ts
  - apps/studio/schemas/agentProfile.ts
  - apps/studio/schemas/index.ts
  - schemas/charity.ts  # deleted (moved to apps/studio/schemas/)
  - schemas/weeklyIssue.ts  # deleted (moved to apps/studio/schemas/)
  - schemas/agentProfile.ts  # deleted (moved to apps/studio/schemas/)
  - schemas/index.ts  # deleted (moved to apps/studio/schemas/)
autonomous: true
requirements:
  - FND-01
  - FND-04
must_haves:
  truths:
    - "Sanity Studio loads in dev with the three schema types visible: weeklyIssue, charity, agentProfile"
    - "Studio sidebar order is preserved from schemas/index.ts (weeklyIssue first, charity second, agentProfile third)"
    - "agentProfile description string lists the canonical 14 agentIds from the brief (per D-11)"
    - "All Sanity field names from the original schemas/*.ts are preserved unchanged (per CLAUDE.md and D-10)"
    - "schemas/ folder at repo root is removed (no duplicate copies)"
    - "apps/studio/.env.example exists and lists every Studio env var (per D-21)"
  artifacts:
    - path: "apps/studio/sanity.config.ts"
      provides: "Studio configuration wiring schemas, projectId, dataset, plugins"
      contains: "schemaTypes"
    - path: "apps/studio/sanity.cli.ts"
      provides: "Sanity CLI config (projectId, dataset, schema extract/typegen settings for Plan 05)"
      contains: "defineCliConfig"
    - path: "apps/studio/.env.example"
      provides: "Checked-in env template listing every var apps/studio/.env.local must populate (D-21)"
      contains: "SANITY_STUDIO_PROJECT_ID"
    - path: "apps/studio/schemas/agentProfile.ts"
      provides: "Agent profile schema with corrected 14-agent description string"
      contains: "origin-story | problem-statement | founder-bio | case-study"
    - path: "apps/studio/schemas/index.ts"
      provides: "schemaTypes export array in original [weeklyIssue, charity, agentProfile] order"
      contains: "schemaTypes"
    - path: "apps/studio/package.json"
      provides: "Studio workspace package.json with name=studio and dev/build/deploy scripts"
      contains: '"name": "studio"'
    - path: "apps/studio/tsconfig.json"
      provides: "Studio TypeScript config extending repo base"
      contains: "../../tsconfig.base.json"
  key_links:
    - from: "apps/studio/sanity.config.ts"
      to: "apps/studio/schemas/index.ts"
      via: "import { schemaTypes } from './schemas'"
      pattern: "from ['\"]\\./schemas['\"]"
    - from: "apps/studio/sanity.config.ts"
      to: "apps/studio/.env.local (via process.env)"
      via: "projectId/dataset read from SANITY_STUDIO_PROJECT_ID/SANITY_STUDIO_DATASET (apps/studio/.env.example documents both)"
      pattern: "process\\.env\\.SANITY_STUDIO_PROJECT_ID"
---

<objective>
Stand up `apps/studio/` as a deployable Sanity v5 Studio: create `package.json`, `tsconfig.json`, `sanity.config.ts`, `sanity.cli.ts`, `.env.example`, and `schemas/` (relocated from repo-root `schemas/`). Apply the agentProfile description fix from D-11. Delete the now-duplicate repo-root `schemas/` so there is one canonical copy.

Per D-21, this plan also creates the canonical `apps/studio/.env.example` (deferred from Plan 01 to here, where the `apps/studio/` directory first comes into existence).

Purpose: Honors decisions D-01 (Sanity v5.24+), D-02 (Sanity-hosted via `sanity deploy`), D-03 (config wires schemas + env vars), D-09/D-10/D-11 (relocate schemas, preserve field names, fix the agentProfile description string), D-21 (apps/studio/.env.example checked in alongside gitignored apps/studio/.env.local).
Output: A locally-runnable Studio that opens, lists three schema types, and connects to Andrew's Sanity project.
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
@docs/API_CONTRACTS.md
@.planning/research/STACK.md
@.planning/codebase/CONVENTIONS.md
@schemas/charity.ts
@schemas/weeklyIssue.ts
@schemas/agentProfile.ts
@schemas/index.ts
@package.json
@tsconfig.base.json
</context>

<interfaces>
<!-- Existing schemas at repo-root schemas/ — relocate verbatim except for the agentProfile description fix per D-11. -->
<!-- Field names are LOCKED (CLAUDE.md + D-10). The only content edit allowed in this plan is the description STRING in agentProfile.ts. -->

From schemas/index.ts:
```typescript
import charity from './charity'
import weeklyIssue from './weeklyIssue'
import agentProfile from './agentProfile'

// Document type order controls Sanity Studio sidebar ordering
export const schemaTypes = [weeklyIssue, charity, agentProfile]
```

From schemas/agentProfile.ts (current — line 15 description string is the ONLY content that changes):
```typescript
description: 'Must match pipeline agent ID exactly: calibrator | scout | advocate | editor | product | puzzle | game | design | bonus | qa | publisher',
```

After D-11 fix:
```typescript
description: 'Must match pipeline agent ID exactly: calibrator | scout | advocate | editor | researcher | origin-story | problem-statement | founder-bio | case-study | game | bonus | design | qa | publisher',
```

Canonical 14 agentIds (must appear in this exact order, kebab-case): calibrator, scout, advocate, editor, researcher, origin-story, problem-statement, founder-bio, case-study, game, bonus, design, qa, publisher
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Relocate schemas from repo root to apps/studio/schemas/ and apply D-11 fix</name>
  <files>apps/studio/schemas/charity.ts, apps/studio/schemas/weeklyIssue.ts, apps/studio/schemas/agentProfile.ts, apps/studio/schemas/index.ts, schemas/charity.ts (deleted), schemas/weeklyIssue.ts (deleted), schemas/agentProfile.ts (deleted), schemas/index.ts (deleted)</files>
  <read_first>
    - schemas/charity.ts (current contents — copy verbatim, no field changes)
    - schemas/weeklyIssue.ts (current contents — copy verbatim including the editorialSection helper and ASCII section headers)
    - schemas/agentProfile.ts (current contents — copy verbatim EXCEPT line 15 description string per D-11)
    - schemas/index.ts (current contents — preserve [weeklyIssue, charity, agentProfile] order per "Reusable Assets" in CONTEXT.md)
    - CLAUDE.md (line 7-8: "Schema files are in schemas/ and convex/schema.ts — do not modify field names without checking API_CONTRACTS.md first")
    - docs/API_CONTRACTS.md (field-name authority)
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md (D-09, D-10, D-11)
  </read_first>
  <action>
    Step 1 — Create the destination directory: `mkdir -p apps/studio/schemas`.

    Step 2 — Copy `schemas/charity.ts` to `apps/studio/schemas/charity.ts` BYTE-FOR-BYTE (no edits). Use the Read tool to load the original, then Write the same content to the new path.

    Step 3 — Copy `schemas/weeklyIssue.ts` to `apps/studio/schemas/weeklyIssue.ts` BYTE-FOR-BYTE (no edits). The `editorialSection()` helper, the ASCII section headers (`// ─── Identity ──` etc.), the slug source function `(doc: any) => \`issue-\${doc.issueNumber}\``, and every defineField call must be preserved verbatim.

    Step 4 — Copy `schemas/index.ts` to `apps/studio/schemas/index.ts` BYTE-FOR-BYTE. The export order MUST remain `[weeklyIssue, charity, agentProfile]` (CONTEXT.md "Reusable Assets" — sidebar order).

    Step 5 — Copy `schemas/agentProfile.ts` to `apps/studio/schemas/agentProfile.ts` with EXACTLY ONE content change: replace the description string on the `agentId` field. The line that currently reads:

    ```typescript
    description: 'Must match pipeline agent ID exactly: calibrator | scout | advocate | editor | product | puzzle | game | design | bonus | qa | publisher',
    ```

    must become:

    ```typescript
    description: 'Must match pipeline agent ID exactly: calibrator | scout | advocate | editor | researcher | origin-story | problem-statement | founder-bio | case-study | game | bonus | design | qa | publisher',
    ```

    Per D-11, this is a description-string-only edit. Do NOT touch:
    - the field `name` (`agentId`)
    - the field `type` (`slug`)
    - any other field in the file (displayName, role, personality, avatar)
    - the preview block

    Step 6 — Delete the original repo-root `schemas/` directory and its four files (so there is one canonical copy of each schema). Use `rm schemas/charity.ts schemas/weeklyIssue.ts schemas/agentProfile.ts schemas/index.ts && rmdir schemas`. The brief's repository structure puts schemas under `apps/studio/schemas/`; keeping a duplicate at repo root would invite drift.

    Note: `convex/schema.ts` and `convex/` stay at repo root (D-09). This task only removes the Sanity `schemas/` folder, not the Convex one.
  </action>
  <verify>
    <automated>test -d apps/studio/schemas && test -f apps/studio/schemas/charity.ts && test -f apps/studio/schemas/weeklyIssue.ts && test -f apps/studio/schemas/agentProfile.ts && test -f apps/studio/schemas/index.ts && ! test -d schemas && grep -q "origin-story | problem-statement | founder-bio | case-study | game | bonus | design | qa | publisher" apps/studio/schemas/agentProfile.ts && ! grep -q "product | puzzle" apps/studio/schemas/agentProfile.ts && grep -q "calibrator | scout | advocate | editor | researcher" apps/studio/schemas/agentProfile.ts && grep -q "schemaTypes = \[weeklyIssue, charity, agentProfile\]" apps/studio/schemas/index.ts && grep -q "editorialSection" apps/studio/schemas/weeklyIssue.ts && grep -q "missionStatement" apps/studio/schemas/charity.ts && test -f convex/schema.ts</automated>
  </verify>
  <done>
    - `apps/studio/schemas/` contains all four files (charity, weeklyIssue, agentProfile, index)
    - Repo-root `schemas/` directory is gone
    - Repo-root `convex/schema.ts` is untouched
    - `apps/studio/schemas/agentProfile.ts` description string lists the 14 canonical agentIds (per D-11)
    - The string `product | puzzle` no longer appears in the relocated agentProfile.ts
    - `apps/studio/schemas/index.ts` preserves the `[weeklyIssue, charity, agentProfile]` export order
    - No field names changed (CLAUDE.md rule + D-10)
  </done>
</task>

<task type="auto">
  <name>Task 2: Create apps/studio/package.json and tsconfig.json</name>
  <files>apps/studio/package.json, apps/studio/tsconfig.json</files>
  <read_first>
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md (D-01: Sanity v5.24+; D-03: config and env vars; D-12/D-13: typegen scripts in this package)
    - .planning/research/STACK.md (verifies sanity@^5.24.0 and @sanity/vision@^5.24.0)
    - tsconfig.base.json (root config to extend)
    - apps/studio/.env.local (created in Plan 02 — referenced by Studio at runtime)
    - Verify path: `test ! -f apps/studio/package.json` (should not exist yet; if Sanity init scaffolded one, you will overwrite it)
  </read_first>
  <action>
    Create `apps/studio/package.json` with EXACTLY this content:

    ```json
    {
      "name": "studio",
      "version": "0.0.0",
      "private": true,
      "description": "Sanity Studio for The Eisenbalm Dispatch",
      "type": "module",
      "scripts": {
        "dev": "sanity dev",
        "start": "sanity start",
        "build": "sanity build",
        "deploy": "sanity deploy",
        "deploy-graphql": "sanity graphql deploy",
        "schema:extract": "sanity schema extract --enforce-required-fields",
        "typegen": "pnpm schema:extract && sanity typegen generate",
        "seed:agents": "tsx scripts/seed-agents.ts"
      },
      "dependencies": {
        "@sanity/client": "^7.22.0",
        "@sanity/vision": "^5.24.0",
        "react": "^19.0.0",
        "react-dom": "^19.0.0",
        "sanity": "^5.24.0",
        "styled-components": "^6.1.13"
      },
      "devDependencies": {
        "@types/react": "^19.0.0",
        "tsx": "^4.19.0",
        "typescript": "^5.6.0"
      }
    }
    ```

    Notes:
    - `"name": "studio"` matches the `pnpm --filter studio` references in root `package.json` (Plan 01).
    - Versions follow research/STACK.md (sanity@^5.24.0, @sanity/vision@^5.24.0, @sanity/client@^7.22.0). React 19 is required by Sanity v5 (D-01).
    - `tsx` is used by `seed:agents` (Plan 06) to run `scripts/seed-agents.ts` directly without a build step.
    - `schema:extract` uses `--enforce-required-fields` per D-13 so generated types match runtime validation. Plan 05 finalizes the typegen wiring.
    - `styled-components` is a Sanity Studio peer dependency for v5 — install explicitly to silence install warnings.

    TypeScript pin: research/STACK.md mentions TS 6.0.3 for the web app (Phase 2). For the Studio package we use the TS 5.6 series because Sanity v5.24 templates target that version. Phase 2 may bump web's TS to 6.x without affecting the Studio.

    Create `apps/studio/tsconfig.json` with EXACTLY this content:

    ```json
    {
      "extends": "../../tsconfig.base.json",
      "compilerOptions": {
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "target": "ES2022",
        "jsx": "preserve",
        "lib": ["ES2022", "DOM", "DOM.Iterable"],
        "types": ["node"],
        "noEmit": true,
        "composite": false,
        "incremental": false,
        "declaration": false,
        "declarationMap": false,
        "sourceMap": true
      },
      "include": ["sanity.config.ts", "sanity.cli.ts", "schemas/**/*.ts", "scripts/**/*.ts"],
      "exclude": ["node_modules", "dist", ".sanity"]
    }
    ```

    Why override `module`/`moduleResolution`: the Sanity Studio bundler uses Vite-style bundler resolution, not NodeNext. The base `composite: true` is overridden to `false` because Studio is an application, not a library — it doesn't need project references.
  </action>
  <verify>
    <automated>test -f apps/studio/package.json && test -f apps/studio/tsconfig.json && grep -q '"name": "studio"' apps/studio/package.json && grep -q 'sanity": "\^5\.24' apps/studio/package.json && grep -q '"dev": "sanity dev"' apps/studio/package.json && grep -q '"deploy": "sanity deploy"' apps/studio/package.json && grep -q '"typegen":' apps/studio/package.json && grep -q '"seed:agents":' apps/studio/package.json && grep -q '"extends": "\.\./\.\./tsconfig\.base\.json"' apps/studio/tsconfig.json && grep -q '"moduleResolution": "Bundler"' apps/studio/tsconfig.json && node -e "JSON.parse(require('fs').readFileSync('apps/studio/package.json','utf8'))" && node -e "JSON.parse(require('fs').readFileSync('apps/studio/tsconfig.json','utf8'))"</automated>
  </verify>
  <done>
    - `apps/studio/package.json` exists, name=studio, depends on sanity@^5.24.0 and react@^19, has dev/build/deploy/typegen/seed:agents scripts
    - `apps/studio/tsconfig.json` extends `../../tsconfig.base.json` with bundler-resolution overrides
    - Both files are valid JSON
  </done>
</task>

<task type="auto">
  <name>Task 3: Create apps/studio/sanity.config.ts and apps/studio/sanity.cli.ts</name>
  <files>apps/studio/sanity.config.ts, apps/studio/sanity.cli.ts</files>
  <read_first>
    - apps/studio/schemas/index.ts (just created in Task 1 — confirm `schemaTypes` export name)
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md (D-03: env-driven projectId/dataset; D-12/D-13: TypeGen wiring; "Claude's Discretion" allows default plugins)
    - .planning/research/STACK.md (Sanity v5 best-practices section: defineConfig, defineCliConfig, schemaExtraction + typegen settings)
  </read_first>
  <action>
    Create `apps/studio/sanity.config.ts` with EXACTLY this content:

    ```typescript
    import { defineConfig } from 'sanity'
    import { structureTool } from 'sanity/structure'
    import { visionTool } from '@sanity/vision'
    import { schemaTypes } from './schemas'

    const projectId = process.env.SANITY_STUDIO_PROJECT_ID
    const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production'

    if (!projectId) {
      throw new Error(
        'Missing SANITY_STUDIO_PROJECT_ID. ' +
        'Run `npx sanity@latest init` (see apps/studio/README.md) and ' +
        'populate apps/studio/.env.local before starting the Studio.',
      )
    }

    export default defineConfig({
      name: 'eisenbalm-dispatch',
      title: 'The Eisenbalm Dispatch',
      projectId,
      dataset,
      plugins: [
        structureTool(),
        visionTool(),
      ],
      schema: {
        types: schemaTypes,
      },
    })
    ```

    Key points:
    - `projectId` and `dataset` come from env vars (D-03). Dataset defaults to `'production'` per CONTEXT.md.
    - The Studio fails fast with a helpful error if env vars are missing — saves a Phase 2 debugging cycle.
    - Plugins: `structureTool` (default desk; required for Studio nav) and `visionTool` (GROQ playground — research/STACK.md notes this as a dev tool for Andrew). Both are minimal/default per "Claude's Discretion" in D-22.
    - `schema.types` consumes the `schemaTypes` array from Task 1 unchanged. Sidebar order is `[weeklyIssue, charity, agentProfile]`.

    Create `apps/studio/sanity.cli.ts` with EXACTLY this content:

    ```typescript
    import { defineCliConfig } from 'sanity/cli'

    const projectId = process.env.SANITY_STUDIO_PROJECT_ID
    const dataset = process.env.SANITY_STUDIO_DATASET ?? 'production'

    export default defineCliConfig({
      api: {
        projectId,
        dataset,
      },
      // Sanity v5 TypeGen — finalized in Plan 05.
      // Plan 05 adds the explicit `schema: { path: './schema.json' }` block that
      // `sanity schema extract` reads, then `sanity typegen generate` consumes
      // schema.json and emits apps/studio/sanity.types.ts.
      // Files: schema.json (intermediate, gitignored)
      //        sanity.types.ts (committed per D-08, D-14).
    })
    ```

    Plan 05 extends `sanity.cli.ts` with the explicit `schema.path` block. For now, the minimal config is enough to let the Studio run.
  </action>
  <verify>
    <automated>test -f apps/studio/sanity.config.ts && test -f apps/studio/sanity.cli.ts && grep -q "defineConfig" apps/studio/sanity.config.ts && grep -q "from './schemas'" apps/studio/sanity.config.ts && grep -q "schemaTypes" apps/studio/sanity.config.ts && grep -q "structureTool" apps/studio/sanity.config.ts && grep -q "visionTool" apps/studio/sanity.config.ts && grep -q "process.env.SANITY_STUDIO_PROJECT_ID" apps/studio/sanity.config.ts && grep -q "process.env.SANITY_STUDIO_DATASET" apps/studio/sanity.config.ts && grep -q "defineCliConfig" apps/studio/sanity.cli.ts</automated>
  </verify>
  <done>
    - `apps/studio/sanity.config.ts` imports `schemaTypes` from `./schemas`, registers `structureTool` and `visionTool` plugins, reads `projectId` + `dataset` from env, and throws a helpful error if `SANITY_STUDIO_PROJECT_ID` is missing
    - `apps/studio/sanity.cli.ts` exports a `defineCliConfig` with `api.projectId` and `api.dataset` from env (Plan 05 will expand it)
  </done>
</task>

<task type="auto">
  <name>Task 4: Create apps/studio/.env.example (D-21)</name>
  <files>apps/studio/.env.example</files>
  <read_first>
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md (D-21: checked-in `apps/studio/.env.example` mirrors the gitignored `apps/studio/.env.local`)
    - apps/studio/sanity.config.ts (just created in Task 3 — env var names must match: SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET)
    - apps/studio/package.json (just created in Task 2 — `seed:agents` script needs SANITY_API_TOKEN)
    - .gitignore (created in Plan 01 — confirm `!apps/studio/.env.example` negation exists so this file can be tracked)
    - Verify the file does NOT already exist: `test ! -f apps/studio/.env.example`
  </read_first>
  <action>
    Per D-21, this file is the canonical env template for the Studio package. It is checked into git and mirrors the variable list of the gitignored `apps/studio/.env.local`. It lives at `apps/studio/.env.example` (NOT at the repo root) because:
    - the variables are Studio-scoped (consumed by `apps/studio/sanity.config.ts` and `apps/studio/scripts/seed-agents.ts`)
    - colocation with the Studio package keeps the contract obvious to anyone editing in `apps/studio/`
    - D-21 explicitly names this path

    Create `apps/studio/.env.example` with EXACTLY this content:

    ```sh
    # ─── Sanity Studio ─────────────────────────────────────────────
    # Set these after running `npx sanity@latest init` (see apps/studio/README.md).
    # Project ID and dataset created by the init flow; copy values here AND into
    # apps/studio/.env.local (which is gitignored).
    SANITY_STUDIO_PROJECT_ID=
    SANITY_STUDIO_DATASET=production

    # ─── Sanity API token (write-scoped) ───────────────────────────
    # Used by apps/studio/scripts/seed-agents.ts to upsert agent profile
    # documents. Create at https://sanity.io/manage > API > Tokens with
    # "Editor" or "Write" permissions.
    SANITY_API_TOKEN=
    ```

    Only Sanity-related env vars belong here in Phase 1. Convex, OpenRouter, Stripe, etc. are added by their respective phases (Phase 3+) into separate env files (e.g. `apps/web/.env.example`, `convex/.env.example`).

    Note: Plan 01's `.gitignore` includes a `!apps/studio/.env.example` negation rule so this file is tracked despite the broader `.env.*` exclusion. If the negation is missing for any reason, fix Plan 01's `.gitignore` rather than working around it here.
  </action>
  <verify>
    <automated>test -f apps/studio/.env.example && grep -q "SANITY_STUDIO_PROJECT_ID" apps/studio/.env.example && grep -q "SANITY_STUDIO_DATASET=production" apps/studio/.env.example && grep -q "SANITY_API_TOKEN" apps/studio/.env.example && ! git check-ignore apps/studio/.env.example</automated>
  </verify>
  <done>
    - `apps/studio/.env.example` exists with the three Sanity env vars (`SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET=production`, `SANITY_API_TOKEN`)
    - The file is NOT gitignored (`git check-ignore` exits non-zero) — D-21 requires it to be checked in
    - The variable names exactly match those consumed by `apps/studio/sanity.config.ts` and `apps/studio/scripts/seed-agents.ts` (created in Plan 06)
  </done>
</task>

</tasks>

<verification>
After all four tasks:
- `test -d apps/studio/schemas && ! test -d schemas` (relocation complete, no duplicates)
- `test -f apps/studio/sanity.config.ts && test -f apps/studio/sanity.cli.ts && test -f apps/studio/package.json && test -f apps/studio/tsconfig.json && test -f apps/studio/.env.example`
- `grep -q "researcher | origin-story" apps/studio/schemas/agentProfile.ts` (D-11 fix landed)
- `! grep -q "product | puzzle" apps/studio/schemas/agentProfile.ts` (old description string is gone)
- `! git check-ignore apps/studio/.env.example` (D-21: file is tracked, not gitignored)
- After `pnpm install` and Andrew populating `apps/studio/.env.local` (Plan 02), `cd apps/studio && pnpm dev` should boot Sanity Studio at http://localhost:3333 and display three document types in the sidebar (weeklyIssue first). This is a manual smoke check; document it in the SUMMARY.md.
</verification>

<success_criteria>
- All four schema files live at `apps/studio/schemas/` with field names unchanged (D-10)
- The repo-root `schemas/` directory is gone
- `apps/studio/schemas/agentProfile.ts` description lists the 14 canonical agentIds in the D-11 order
- `apps/studio/sanity.config.ts` wires schemas, plugins, and env-driven projectId/dataset
- `apps/studio/sanity.cli.ts` is the foundation Plan 05 will extend for TypeGen
- `apps/studio/.env.example` is checked in and lists every Studio env var (D-21)
- `apps/studio/package.json` declares Sanity v5.24+ + React 19 + the dev/build/deploy/typegen/seed:agents scripts
- `apps/studio/tsconfig.json` extends `../../tsconfig.base.json` with bundler resolution
</success_criteria>

<output>
After completion, create `.planning/phases/01-sanity-foundation/01-03-SUMMARY.md` listing every file created or modified (including the four `schemas/*.ts` deletions and the new `apps/studio/.env.example`), confirming the relocation+description fix landed, and including the manual smoke-test instruction "run `pnpm install` from repo root, then `pnpm dev:studio` — Studio should boot and show three document types".
</output>
