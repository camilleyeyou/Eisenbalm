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
