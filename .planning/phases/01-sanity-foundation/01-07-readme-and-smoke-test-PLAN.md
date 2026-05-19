---
phase: 01-sanity-foundation
plan: 07
type: execute
wave: 4
depends_on:
  - "01-03"
  - "01-05"
  - "01-06"
files_modified:
  - apps/studio/README.md
autonomous: false
requirements:
  - FND-01
  - FND-02
  - FND-03
  - FND-04
must_haves:
  truths:
    - "apps/studio/README.md exists and walks Andrew through the full bootstrap (init → install → typegen → seed → dev → deploy)"
    - "After Andrew runs the documented sequence, Sanity Studio is deployed at <projectName>.sanity.studio and shows three schema types + 14 agent profiles"
    - "Andrew can create a draft weeklyIssue and save it without schema validation errors (FND-04)"
    - "Sanity TypeGen has been run at least once and apps/studio/sanity.types.ts is committed"
  artifacts:
    - path: "apps/studio/README.md"
      provides: "Andrew's onboarding doc — the canonical Phase 1 runbook"
      contains: "npx sanity@latest init"
  key_links:
    - from: "apps/studio/README.md"
      to: "apps/studio/.env.local"
      via: "documents how to populate SANITY_STUDIO_PROJECT_ID, SANITY_STUDIO_DATASET, SANITY_API_TOKEN"
      pattern: "SANITY_API_TOKEN"
    - from: "apps/studio/README.md"
      to: "deployed Sanity Studio URL"
      via: "documents `pnpm deploy:studio` step"
      pattern: "deploy:studio"
---

<objective>
Write the canonical onboarding README at `apps/studio/README.md` so Andrew can take Phase 1 from "fresh repo" to "deployed Studio with seeded agents and a draft issue saved" without guessing. Then perform the live smoke test together with Andrew, capturing the deployed Studio URL and verifying all four phase success criteria.

Purpose: Honors decisions D-19 (`pnpm seed:agents` documented as a step Andrew runs), D-20 (manual `npx sanity init` step documented), D-22 (no CI; local dev + Sanity-hosted deploy). Resolves requirements FND-01, FND-02, FND-03, FND-04 by validating each one in the smoke test.
Output: A README Andrew can follow, plus an end-to-end Phase 1 smoke test that produces a deployed Studio.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-sanity-foundation/01-CONTEXT.md
@.planning/ROADMAP.md
@CLAUDE.md
@docs/CLAUDE_CODE_BRIEF.md
@apps/studio/package.json
@apps/studio/sanity.config.ts
@apps/studio/sanity.cli.ts
@apps/studio/scripts/seed-agents.ts
@apps/studio/scripts/agents.json
@apps/studio/sanity.types.ts
@apps/studio/.env.example
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write apps/studio/README.md (Andrew's onboarding runbook)</name>
  <files>apps/studio/README.md</files>
  <read_first>
    - apps/studio/package.json (final scripts list — dev, build, deploy, schema:extract, typegen, seed:agents)
    - apps/studio/sanity.config.ts (env-var contract)
    - apps/studio/scripts/seed-agents.ts (the SANITY_API_TOKEN requirement)
    - apps/studio/.env.example (created in Plan 03 — the canonical checked-in env template; D-21)
    - .planning/phases/01-sanity-foundation/01-CONTEXT.md ("Specifics" section — Andrew's first-time experience step list)
  </read_first>
  <action>
    Create `apps/studio/README.md` with EXACTLY this content:

    ```markdown
    # apps/studio — Sanity Studio for The Eisenbalm Dispatch

    Andrew's editorial interface. Hosted by Sanity at
    `https://<projectName>.sanity.studio` after the first deploy.

    ---

    ## First-time setup (one machine, one time)

    ### Prerequisites

    - Node.js ≥ 18.18 — `node -v`
    - pnpm ≥ 9 — `pnpm -v` (install via `npm i -g pnpm@9` or Corepack)
    - A Sanity account — sign up free at https://www.sanity.io/login

    All commands below run from the repository root unless stated otherwise.

    ### 1. Provision the Sanity project (interactive, one time)

    From the repo root:

    ```bash
    cd apps/studio
    npx sanity@latest init
    cd ../..
    ```

    The CLI is interactive. Choose:
    - **Create new project** (project name suggestion: `Eisenbalm Dispatch`)
    - **Use the default dataset name** (`production`)
    - **Make the dataset public** (the brief has no auth wall)
    - **Output path:** `.` (the current directory `apps/studio`)

    The CLI prints a `projectId` — an 8-character lowercase string. Copy it. The
    init flow may scaffold a few starter files in `apps/studio/`; that is fine,
    the canonical `sanity.config.ts` and `sanity.cli.ts` already in this repo
    take precedence.

    ### 2. Populate `apps/studio/.env.local`

    The Studio reads its `projectId` and `dataset` from env vars at runtime
    (see `sanity.config.ts`). Create a local-only env file:

    ```bash
    cat > apps/studio/.env.local <<EOF
    SANITY_STUDIO_PROJECT_ID=<paste-the-projectId-here>
    SANITY_STUDIO_DATASET=production
    SANITY_API_TOKEN=<paste-an-Editor-write-token-here>
    EOF
    ```

    Generate the API token at:

    > https://www.sanity.io/manage → your project → API → Tokens → Add token
    > Name: `seed-agents`. Permissions: **Editor** (or any role with write
    > access to the production dataset). Copy the value once — Sanity does not
    > show it again.

    `apps/studio/.env.local` is gitignored. Do not commit it. The repo-tracked
    `apps/studio/.env.example` (created in Plan 03 per D-21) documents the same
    variables for reference — copy from it if you forget which vars are needed.

    ### 3. Install dependencies

    From the repo root:

    ```bash
    pnpm install
    ```

    pnpm resolves four workspaces: `studio`, `web`, `pipeline`, `@eisenbalm/shared`.
    `web` and `pipeline` are placeholders for Phase 2 / Phase 4 — do not be alarmed
    that they look empty.

    ### 4. Generate Sanity TypeScript types

    ```bash
    pnpm typegen
    ```

    This runs:
    - `sanity schema extract --enforce-required-fields` → writes
      `apps/studio/schema.json` (intermediate; gitignored)
    - `sanity typegen generate` → writes `apps/studio/sanity.types.ts`
      (committed to git, per project decision D-08)

    The `apps/studio/sanity.types.ts` file is then re-exported through
    `packages/shared/src/sanity-types.ts` so Phase 2 (`apps/web`) and any
    downstream TypeScript consumer can `import type { WeeklyIssue, Charity,
    AgentProfile } from '@eisenbalm/shared'`.

    Re-run `pnpm typegen` and commit the regenerated `sanity.types.ts`
    whenever you edit a file in `apps/studio/schemas/`.

    ### 5. Seed the 14 agent profile documents

    ```bash
    pnpm seed:agents
    ```

    The script reads `apps/studio/scripts/agents.json` and upserts 14
    `agentProfile` documents into the `production` dataset using deterministic
    `_id` values of the form `agent-{agentId}` (so re-runs are idempotent —
    safe to run again after editing copy in `agents.json`).

    Expected agentIds, in the order they are seeded:

    1. `calibrator`
    2. `scout`
    3. `advocate`
    4. `editor`
    5. `researcher`
    6. `origin-story`
    7. `problem-statement`
    8. `founder-bio`
    9. `case-study`
    10. `game`
    11. `bonus`
    12. `design`
    13. `qa`
    14. `publisher`

    ### 6. Run the Studio locally

    ```bash
    pnpm dev:studio
    ```

    Studio opens at http://localhost:3333. Sign in with the same Sanity account
    you used in step 1. The sidebar should list three document types in this
    order:

    - Weekly Issue
    - Charity
    - Agent Profile

    Open **Agent Profile** and verify the 14 seeded documents are visible. Open
    a draft Weekly Issue, fill any field, and click Save — there should be no
    schema validation error.

    ### 7. Deploy the Studio to `<projectName>.sanity.studio`

    ```bash
    pnpm deploy:studio
    ```

    The CLI prompts for a Studio hostname (e.g. `eisenbalm-dispatch`). After
    deploy, the Studio is live at `https://<hostname>.sanity.studio`. Bookmark
    the URL — that is where you do all weekly editorial work.

    Re-run `pnpm deploy:studio` whenever schemas change, after committing the
    regenerated `sanity.types.ts`.

    ---

    ## Day-to-day workflow

    | Task | Command (run from repo root) |
    |---|---|
    | Open Studio locally | `pnpm dev:studio` |
    | Build Studio bundle | `pnpm build:studio` |
    | Deploy Studio to Sanity | `pnpm deploy:studio` |
    | Regenerate TypeScript types | `pnpm typegen` |
    | Re-seed / update agent profiles | `pnpm seed:agents` |

    After editing schema files in `apps/studio/schemas/`, always:

    1. Run `pnpm typegen`
    2. Commit the updated `apps/studio/sanity.types.ts`
    3. Run `pnpm deploy:studio` (so the deployed Studio reflects the new schema)

    ---

    ## What lives where

    - `apps/studio/sanity.config.ts` — Studio config (plugins, schema wiring,
      env-driven projectId/dataset)
    - `apps/studio/sanity.cli.ts` — Sanity CLI config (TypeGen schema path)
    - `apps/studio/schemas/` — Sanity document and object types
      (`charity.ts`, `weeklyIssue.ts`, `agentProfile.ts`, `index.ts`)
    - `apps/studio/scripts/seed-agents.ts` — Idempotent agent seed script
    - `apps/studio/scripts/agents.json` — Editable seed copy (14 agents)
    - `apps/studio/sanity.types.ts` — Generated TypeScript types
      (committed to git)
    - `apps/studio/.env.local` — Your local env file (gitignored)
    ```

    Do NOT skip the `## What lives where` section — it is how a returning Andrew
    (or a new collaborator) reorients without re-reading every plan.
  </action>
  <verify>
    <automated>test -f apps/studio/README.md && grep -q "npx sanity@latest init" apps/studio/README.md && grep -q "pnpm install" apps/studio/README.md && grep -q "pnpm typegen" apps/studio/README.md && grep -q "pnpm seed:agents" apps/studio/README.md && grep -q "pnpm dev:studio" apps/studio/README.md && grep -q "pnpm deploy:studio" apps/studio/README.md && grep -q "SANITY_API_TOKEN" apps/studio/README.md && grep -q "calibrator" apps/studio/README.md && grep -q "publisher" apps/studio/README.md && grep -q "agent-{agentId}" apps/studio/README.md</automated>
  </verify>
  <done>
    - `apps/studio/README.md` exists and walks through every step from `npx sanity init` to `pnpm deploy:studio`
    - All five `pnpm` scripts are documented with their exact invocation
    - The 14 canonical agentIds are listed in the canonical order
    - The deterministic `_id` pattern (`agent-{agentId}`) is explicitly documented
    - The `SANITY_API_TOKEN` requirement (and its sanity.io/manage location) is documented before the seed step
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Andrew runs the Phase 1 end-to-end smoke test</name>
  <files>(none — Andrew runs commands and verifies in browser; the deployed Studio URL is captured in the SUMMARY)</files>
  <read_first>
    - apps/studio/README.md (just written in Task 1)
    - apps/studio/.env.local (must already contain SANITY_STUDIO_PROJECT_ID and SANITY_STUDIO_DATASET from Plan 02; Andrew adds SANITY_API_TOKEN before this task)
    - .planning/ROADMAP.md (Phase 1 success criteria 1-4)
  </read_first>
  <what-built>
    Plans 01-06 produced:
    - Monorepo skeleton (`package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore` — Plan 01) and `apps/studio/.env.example` (Plan 03, per D-21)
    - `apps/studio/` with relocated schemas, the D-11 agentProfile description fix, `sanity.config.ts`, `sanity.cli.ts`, and the typegen pipeline (`apps/studio/sanity.types.ts` committed)
    - `apps/web/` and `packages/pipeline/` as placeholders, `packages/shared` re-exporting Sanity types
    - `apps/studio/scripts/seed-agents.ts` + `apps/studio/scripts/agents.json` (14 canonical agents)
    - This README Andrew is following

    What Andrew has not yet done:
    - Added `SANITY_API_TOKEN` to `apps/studio/.env.local` (required by `pnpm seed:agents`)
    - Run `pnpm install`, `pnpm typegen`, `pnpm seed:agents`, `pnpm dev:studio`, `pnpm deploy:studio`
    - Verified the Phase 1 success criteria from ROADMAP.md
  </what-built>
  <how-to-verify>
    Andrew, please execute the steps below in order. The executor will resume only after you confirm.

    **Step A — Add SANITY_API_TOKEN.** Visit https://www.sanity.io/manage → select your Eisenbalm project → API → Tokens → Add token (name `seed-agents`, role **Editor**). Copy the token and append to `apps/studio/.env.local`:

    ```bash
    echo "SANITY_API_TOKEN=<paste-token-here>" >> apps/studio/.env.local
    ```

    Verify: `grep -q SANITY_API_TOKEN= apps/studio/.env.local && echo OK` should print `OK`.

    **Step B — Install + typegen.** From the repo root:

    ```bash
    pnpm install
    pnpm typegen
    ```

    Both should exit 0. After `pnpm typegen`, confirm:

    ```bash
    grep -E "^export type Charity\b" apps/studio/sanity.types.ts && \
      grep -E "^export type WeeklyIssue\b" apps/studio/sanity.types.ts && \
      grep -E "^export type AgentProfile\b" apps/studio/sanity.types.ts && \
      echo "FND-02 OK"
    ```

    Expected: `FND-02 OK`.

    **Step C — Seed agents.** From the repo root:

    ```bash
    pnpm seed:agents
    ```

    Expected: prints `✓ agent-calibrator` through `✓ agent-publisher` (14 lines), then `Seeded 14/14 agent profiles.` Re-run the same command — it should succeed identically with no errors and no duplicates (idempotency).

    **Step D — Local Studio smoke test (FND-01 + FND-04).** From the repo root:

    ```bash
    pnpm dev:studio
    ```

    Browser should open http://localhost:3333. Sign in with your Sanity account. In the sidebar:

    1. Confirm three document types are visible: **Weekly Issue**, **Charity**, **Agent Profile** (in that order).
    2. Open **Agent Profile** → confirm 14 documents are listed (calibrator through publisher). Click into any one and verify `agentId`, `displayName`, `role`, `personality` are populated.
    3. Open **Weekly Issue** → click **Create new** → fill the required fields (issueNumber `1`, slug `issue-1`, publishDate any date, status Draft, charity — pick or create a charity, bonusType any value, then write at least one headline + body in originStory and problemStatement). Click **Save / Publish to draft** — confirm it saves with no schema validation error.
    4. Open **Charity** → confirm you can create a charity with `name`, `slug`, `location` populated and save without error.

    Stop the dev server (`Ctrl+C`).

    **Step E — Deploy the Studio (FND-01 cloud verification).** From the repo root:

    ```bash
    pnpm deploy:studio
    ```

    The CLI prompts for a Studio hostname (e.g. `eisenbalm-dispatch`). Pick something memorable. After deploy, open `https://<hostname>.sanity.studio` in a browser, sign in, and repeat the smoke test from Step D against the deployed Studio (it talks to the same `production` dataset, so the same 14 agent profiles and your draft issue will appear).

    Record the deployed URL — Plan 07's SUMMARY.md will note it.

    **Step F — FND-03 verification.** From `https://www.sanity.io/manage` → your project → Datasets → production → confirm 14 documents of type `agentProfile` are listed (or use Vision: in Studio click 🔍 Vision in the sidebar, paste `*[_type == "agentProfile"]{_id, agentId, displayName} | order(displayName asc)`, click Run → expect exactly 14 rows).
  </how-to-verify>
  <acceptance_criteria>
    - **FND-01 (live Studio renders all schema types editable):** `https://<hostname>.sanity.studio` loads after `pnpm deploy:studio`; sidebar shows Weekly Issue / Charity / Agent Profile; you can edit fields on each type without errors.
    - **FND-02 (TypeGen generates types):** `pnpm typegen` exits 0 and `apps/studio/sanity.types.ts` exports `Charity`, `WeeklyIssue`, `AgentProfile`.
    - **FND-03 (14 agent profiles seeded):** Vision query `*[_type == "agentProfile"]` returns exactly 14 documents with `_id` values `agent-calibrator` through `agent-publisher`.
    - **FND-04 (Andrew can save weeklyIssue draft):** Step D action 3 succeeds — a draft `weeklyIssue` document persists with no schema validation error.
    - The deployed Studio hostname is recorded in `apps/studio/.env.local` notes or the Plan 07 SUMMARY.
    - `pnpm seed:agents` is idempotent (re-running produces the same `Seeded 14/14` output with no errors).
  </acceptance_criteria>
  <resume-signal>
    Type "approved" once all four acceptance criteria above pass and the deployed Studio URL is recorded. If any step fails, paste the error message and the failing command — do not approve. Common failure modes:

    - `pnpm install` fails → check Plans 01/03/04 outputs (root `package.json`, `pnpm-workspace.yaml`, all `package.json` files valid JSON)
    - `pnpm typegen` fails on missing env → confirm `apps/studio/.env.local` has `SANITY_STUDIO_PROJECT_ID` populated (Plan 02)
    - `pnpm seed:agents` fails on auth → confirm `SANITY_API_TOKEN` is in `apps/studio/.env.local` with Editor permissions
    - Studio loads but shows 0 schema types → confirm `apps/studio/sanity.config.ts` imports `schemaTypes` from `./schemas` (Plan 03)
  </resume-signal>
</task>

</tasks>

<verification>
After Andrew approves Task 2:
- The deployed Studio URL is recorded in the Plan 07 SUMMARY.
- All four FND-XX requirements are observably met in the Sanity dashboard and on disk.
- `apps/studio/sanity.types.ts` is committed.
- The 14 agentProfile documents are visible in the production dataset.
- The repo is in a state where Phase 2 (Web Shell + Theme Engine) can begin without further Phase 1 work.
</verification>

<success_criteria>
- `apps/studio/README.md` is the canonical bootstrap doc and stays accurate (every command in it actually works)
- All four Phase 1 success criteria from ROADMAP.md are observable:
  1. Andrew can edit each schema type at the deployed URL without errors (FND-01)
  2. `pnpm typegen` produces `sanity.types.ts` with no missing types (FND-02)
  3. 14 agent profiles exist as seeded documents (FND-03)
  4. Andrew can create and save a weeklyIssue draft (FND-04)
- The deployed Studio URL is captured for Phase 2 to reference
</success_criteria>

<output>
After completion, create `.planning/phases/01-sanity-foundation/01-07-SUMMARY.md` recording (a) the deployed Sanity Studio hostname (e.g. `eisenbalm-dispatch.sanity.studio`), (b) any deviations Andrew made from the README sequence, (c) confirmation that all four FND-XX requirements pass, and (d) anything Phase 2 should know — e.g. the Studio's projectId is in `apps/studio/.env.local` and Phase 2 should add `NEXT_PUBLIC_SANITY_PROJECT_ID` (mirror) to the web app's env when it scaffolds.
</output>
