---
phase: 03-convex-deployment
plan: 07
type: execute
wave: 7
depends_on:
  - "03-06"
files_modified:
  - convex/README.md
  - apps/web/README.md
autonomous: true
requirements:
  - CVX-04
  - CVX-05
must_haves:
  truths:
    - "convex/README.md is the canonical onboarding doc for the Convex workspace, covering: what lives there, the manual `convex dev --configure` checkpoint, regenerating _generated/, env vars, deploy workflow, link to API_CONTRACTS §3-4"
    - "convex/README.md documents the 6-step Andrew smoke test from D-23 (CLI init → deploy → dashboard verify → dashboard query → /_debug/convex browser → curl HTTP API)"
    - "convex/README.md calls out CONVEX_DEPLOY_KEY as a SECRET that must never be in NEXT_PUBLIC_* or committed"
    - "apps/web/README.md has a new Convex section documenting: env vars added, /_debug/convex purpose + Phase 9 cleanup, ConvexClientProvider mount location"
    - "Both READMEs reference the Phase 9 cleanup of /_debug/convex (lockable contract)"
  artifacts:
    - path: "convex/README.md"
      provides: "Onboarding doc for the @eisenbalm/convex workspace"
      contains: "convex dev --once --configure"
      min_lines: 100
    - path: "apps/web/README.md"
      provides: "Updated onboarding doc with Convex section"
      contains: "NEXT_PUBLIC_CONVEX_URL"
  key_links:
    - from: "convex/README.md"
      to: "Andrew's smoke test sequence"
      via: "documents pnpm --filter @eisenbalm/convex exec convex dev --once --configure"
      pattern: "exec convex dev --once --configure"
    - from: "apps/web/README.md"
      to: "/_debug/convex route"
      via: "documents it as Phase 3's CVX-05 evidence + Phase 9 removal target"
      pattern: "/_debug/convex"
---

<objective>
Create the new `convex/README.md` and extend `apps/web/README.md` so a returning Andrew (or new engineer) can take Phase 3 from "fresh repo" to "live Convex + working `/_debug/convex` page" without re-reading the plan files. Honors D-25 (new doc) and D-26 (update existing doc).

Purpose: Phase 3's onboarding contract. The READMEs are the source of truth Andrew will follow during Plan 03-08's smoke test and any future re-bootstrap from a fresh clone.
Output: Two README files committed to git with the full bootstrap sequence + the Phase 9 cleanup contract documented.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-convex-deployment/03-CONTEXT.md
@.planning/phases/03-convex-deployment/03-RESEARCH.md
@apps/web/README.md
@convex/package.json
@convex/schema.ts
@apps/web/.env.example
@.env.example
@docs/API_CONTRACTS.md
@apps/studio/README.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create convex/README.md as the @eisenbalm/convex workspace onboarding doc</name>
  <files>convex/README.md</files>
  <read_first>
    - convex/package.json (final scripts list — dev, dev:once, deploy, codegen, dashboard, typecheck)
    - convex/schema.ts (five tables — quote table list verbatim from this file)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Code Examples §6 (Andrew's full 7-step init sequence — adapt verbatim into README)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-25 (create convex/README.md), D-23 (6-step smoke test contents)
    - apps/studio/README.md (existing pattern for workspace onboarding READMEs — same headings/structure)
    - docs/API_CONTRACTS.md §3 + §4 (linked from the README's "Reference" section)
  </read_first>
  <action>
    Create `convex/README.md` with this exact content:

    ```markdown
    # @eisenbalm/convex — Convex schema + queries + mutations

    **Status:** Phase 3 deployed. Live backend for the Pipeline's deliberation stream and the web app's `useQuery` subscriptions.
    **Stack:** Convex 1.38.x (cloud production deployment).
    **Owns:** the schema (`convex/schema.ts`) and the five query/mutation modules.
    **Consumed by:**
    - `apps/web` — via `@convex/_generated/api` (browser `useQuery` subscriptions)
    - `packages/pipeline` (Phase 4) — via the Convex HTTP API (`POST /api/mutation`, `Authorization: Convex <DEPLOY_KEY>`)

    ---

    ## Tables

    Defined in [`convex/schema.ts`](./schema.ts). Five tables, one row per logical event:

    | Table | Purpose | Indexes |
    |---|---|---|
    | `pipelineRuns` | One row per weekly pipeline run; status flips `running → awaiting-review → complete` (or `failed`) | `by_runId`, `by_issueNumber` |
    | `deliberationEvents` | Every agent event during a run — the raw deliberation stream (scout-finding, advocate-argument, editor-decision, section-draft, qa-correction, editor-final, publisher-deploy) | `by_runId`, `by_runId_and_type` |
    | `agentVotes` | Subset of deliberationEvents but queryable — for/against/abstain with reasoning | `by_runId`, `by_runId_and_charity` |
    | `qaCorrections` | What QA caught and why — severity minor/moderate/major | `by_runId`, `by_runId_and_section` |
    | `pitchLog` | Scout's candidate pitches before deliberation — `selected` flag flipped after Editor gate 1 | `by_runId`, `by_runId_and_selected` |

    Do not modify `schema.ts` field names without checking [`docs/API_CONTRACTS.md`](../docs/API_CONTRACTS.md) §3 (mutation call shapes) and §4 (query handler bodies) first. Field names are locked across schema + contracts + types per [`CLAUDE.md`](../CLAUDE.md).

    ---

    ## Function files

    One file per table — five files total. Filenames are the API surface: `convex/pipelineRuns.ts` produces `api.pipelineRuns.byRunId`, etc. Each file is a verbatim copy of `docs/API_CONTRACTS.md` §4.

    | File | Queries | Mutations |
    |---|---|---|
    | `pipelineRuns.ts` | `byRunId` | `create`, `updateStatus` |
    | `pitchLog.ts` | `byRunId` | `insert`, `markSelected` |
    | `deliberationEvents.ts` | `byRunId`, `byRunIdAndType` | `insert` |
    | `agentVotes.ts` | `byRunId`, `byRunIdAndCharity` | `insert` |
    | `qaCorrections.ts` | `byRunId` | `insert` |

    Every insertion mutation sets `timestamp: Date.now()` server-side — never trust the caller's clock. Every enum-like argument uses `v.literal(...)` unions matching `schema.ts` byte-for-byte.

    ---

    ## First-time setup (one machine, one time)

    ### Prerequisites

    - Node.js ≥ 18.18 — `node -v`
    - pnpm ≥ 9 — `pnpm -v`
    - A Convex Cloud account — free tier is fine, sign up at https://dashboard.convex.dev (GitHub OAuth recommended)

    All commands run from the repository root unless stated.

    ### 1. Install dependencies

    ```bash
    pnpm install
    ```

    pnpm resolves the new `@eisenbalm/convex` workspace (added in Phase 3) plus the existing `studio`, `web`, `pipeline`, `@eisenbalm/shared`.

    ### 2. Provision the Convex production deployment (interactive, one time)

    From the repo root:

    ```bash
    pnpm --filter @eisenbalm/convex exec convex dev --once --configure
    ```

    The CLI is interactive. Choose:
    - **A new project**
    - Project name suggestion: `eisenbalm-dispatch`
    - Pick your Convex team
    - For "How would you like to use Convex?" → **Cloud** (we run a single production deployment per project decision D-02; no dev/staging cloud deployments)

    The CLI writes:
    - `convex/convex.json` (CLI config — committed)
    - `convex/.env.local` (deployment hint — gitignored, contains `CONVEX_DEPLOYMENT=<dev-deployment-name>`)
    - `convex/_generated/{api,server,dataModel}.{ts,d.ts,js}` (codegen output — committed per project decision D-08)

    The CLI also pushes `schema.ts` to the new deployment.

    ### 3. Verify `convex.json` has `"functions": "./"`

    Our layout has `convex/package.json` and `convex/schema.ts` as siblings, NOT under a nested `convex/convex/`. The CLI defaults assume the nested layout, so `convex.json` may need a hand-correction:

    ```bash
    cat convex/convex.json
    ```

    If the file does not contain `"functions": "./"`, replace its contents with:

    ```json
    {
      "$schema": "https://convex.dev/schemas/convex.json",
      "functions": "./"
    }
    ```

    Commit `convex/convex.json`.

    ### 4. Capture the deployment URL and Production Deploy Key

    Open https://dashboard.convex.dev → your new project → **Settings**.

    - **Deployment URL** — looks like `https://<adjective>-<animal>-<number>.convex.cloud`. This is `NEXT_PUBLIC_CONVEX_URL` (public).
    - **Deploy Keys** section → **Generate Production Deploy Key** → starts with `prod:`. This is `CONVEX_DEPLOY_KEY` (SECRET). **You will not see it again** — save it somewhere safe immediately.

    > ⚠️ `CONVEX_DEPLOY_KEY` grants full read/write to every Convex mutation. Treat it like a database password. NEVER commit. NEVER expose via `NEXT_PUBLIC_*`. NEVER log.

    Add both values to `apps/web/.env.local` (gitignored):

    ```bash
    echo "NEXT_PUBLIC_CONVEX_URL=https://<your-deployment>.convex.cloud" >> apps/web/.env.local
    echo "CONVEX_DEPLOY_KEY=prod:<your-key>" >> apps/web/.env.local
    ```

    ### 5. Push the function files to production

    ```bash
    pnpm --filter @eisenbalm/convex deploy
    ```

    The CLI emits 5 modules (pipelineRuns, pitchLog, deliberationEvents, agentVotes, qaCorrections) and regenerates `convex/_generated/`. Commit any changes to `convex/_generated/` after this step (per project decision D-08).

    ### 6. Verify in the Convex dashboard

    Open https://dashboard.convex.dev → your project:

    1. **Data** tab: 5 tables visible, each with 0 rows.
    2. **Functions** tab: 5 modules visible. Click each — confirm the expected query/mutation exports are listed (see the **Function files** table above).
    3. Pick `pipelineRuns:byRunId` → **Run Query** pane → enter `{"runId": "nonexistent"}` → click Run → expected result: `null`.
    4. Pick any of the four `.collect()` queries (e.g. `pitchLog:byRunId`) → same args → expected result: `[]`.

    ### 7. Verify from the web app

    ```bash
    pnpm dev:web
    ```

    Browse to http://localhost:3000/_debug/convex — see a five-row table with counts of `0` (or `—` briefly while the subscription resolves). No errors in browser console.

    ---

    ## Day-to-day workflow

    | Task | Command (run from repo root) |
    |---|---|
    | Open the Convex dashboard | `pnpm --filter @eisenbalm/convex dashboard` |
    | Deploy schema + functions after edits | `pnpm deploy:convex` |
    | Regenerate `_generated/` only (no deploy) | `pnpm codegen:convex` |
    | Typecheck the workspace | `pnpm typecheck:convex` |
    | Watch mode (rare — Phase 4+) | `pnpm dev:convex` |

    After editing `convex/schema.ts` or any function file:

    1. Run `pnpm deploy:convex` (pushes + regenerates `_generated/`)
    2. Commit both the source change AND the updated `convex/_generated/` files

    No CI gate is currently configured (project decision D-22 / Phase 1 D-15). Engineers run typechecks locally.

    ---

    ## Environment variables

    Defined in [`convex/.env.local`](./.env.local) (gitignored, auto-managed by the CLI) and at the workspaces that consume Convex:

    | Variable | Value | Required by |
    |---|---|---|
    | `CONVEX_DEPLOYMENT` | CLI-managed deployment name (e.g. `prod:adjective-animal-NNN`) | Convex CLI (auto-written to `convex/.env.local` by `--configure`) |
    | `NEXT_PUBLIC_CONVEX_URL` | `https://<deployment>.convex.cloud` | `apps/web` (browser `ConvexReactClient`), and Phase 4 pipeline (HTTP API base URL) |
    | `CONVEX_DEPLOY_KEY` | `prod:<key>` — SECRET | `convex deploy` (CI / build step), Phase 4 pipeline (`Authorization: Convex <key>` for HTTP API mutations) |

    The two env vars Andrew populates manually are documented in:
    - [`apps/web/.env.example`](../apps/web/.env.example) — for the web app
    - [`.env.example`](../.env.example) at repo root — for the Phase 4 pipeline reference

    ---

    ## Vercel + Railway env provisioning (manual)

    Project decision D-22: env provisioning to remote services is Andrew's manual step. Documented here so a fresh hand can complete it.

    **Vercel** (when the `apps/web` Vercel project exists — Phase 2 did not require it):

    ```bash
    cd apps/web
    npx vercel env add NEXT_PUBLIC_CONVEX_URL production
    npx vercel env add CONVEX_DEPLOY_KEY production
    ```

    Paste the values when prompted. (`CONVEX_DEPLOY_KEY` is needed by the Vercel build step — the official Convex hosting pattern is `npx convex deploy --cmd 'npm run build'`, which uses the deploy key to push functions before Next.js builds. Not in scope for Phase 3, but the env var should be present.)

    **Railway** (when the Phase 4 pipeline service exists — Phase 4 sets this):

    ```bash
    railway variables set NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
    railway variables set CONVEX_DEPLOY_KEY=prod:<key>
    ```

    ---

    ## HTTP API smoke (Phase 4 readiness)

    Phase 4 (Pipeline Skeleton) will call Convex mutations from Python via HTTP. The same Production Deploy Key authenticates that channel. To verify the pathway works before Phase 4 lands, run this curl:

    ```bash
    source apps/web/.env.local
    curl -X POST "${NEXT_PUBLIC_CONVEX_URL}/api/mutation" \
      -H 'Content-Type: application/json' \
      -H "Authorization: Convex ${CONVEX_DEPLOY_KEY}" \
      -d "{
        \"path\": \"pipelineRuns:create\",
        \"args\": {
          \"runId\": \"smoke-test-curl-$(date +%s)\",
          \"issueNumber\": 0,
          \"startedAt\": $(node -e 'console.log(Date.now())')
        },
        \"format\": \"json\"
      }"
    ```

    Expected response: `{"status":"success","value":"<convex_id>","logLines":[]}`.

    Cleanup: delete the test row via the Convex dashboard (Data → pipelineRuns → row → ⋯ → Delete) or another mutation call. The synthetic `runId` does not correspond to any Sanity document, so it is safe to leave but tidy to remove.

    ---

    ## /_debug/convex route (Phase 3 evidence, Phase 9 cleanup)

    `apps/web/app/_debug/convex/page.tsx` is Phase 3's CVX-05 evidence surface. It calls all five `byRunId` queries with a synthetic `runId: "phase-3-smoke-test"` and renders a five-row table.

    **It will be REMOVED in Phase 9** when the real `<DeliberationSlot>` Convex subscriptions land on `/issue/[slug]`. The file carries a `TODO(Phase 9):` comment naming the cleanup steps. Phase 9's planner can grep for it.

    Until Phase 9: visit http://localhost:3000/_debug/convex (or `<prod-url>/_debug/convex`) to confirm the web → Convex pathway is alive. The route is excluded from `sitemap.xml`, `feed.xml`, and is `Disallow:` in `robots.txt`.

    ---

    ## What lives where

    - [`convex/schema.ts`](./schema.ts) — 5 table definitions + indexes (existing from before Phase 3, do not modify)
    - [`convex/pipelineRuns.ts`](./pipelineRuns.ts) — `byRunId` query + `create`/`updateStatus` mutations
    - [`convex/pitchLog.ts`](./pitchLog.ts) — `byRunId` query + `insert`/`markSelected` mutations
    - [`convex/deliberationEvents.ts`](./deliberationEvents.ts) — `byRunId`/`byRunIdAndType` queries + `insert` mutation
    - [`convex/agentVotes.ts`](./agentVotes.ts) — `byRunId`/`byRunIdAndCharity` queries + `insert` mutation
    - [`convex/qaCorrections.ts`](./qaCorrections.ts) — `byRunId` query + `insert` mutation
    - [`convex/_generated/`](./_generated/) — codegen output, committed to git (project decision D-08)
    - [`convex/convex.json`](./convex.json) — CLI config (`"functions": "./"`)
    - [`convex/package.json`](./package.json) — workspace manifest (`@eisenbalm/convex`)
    - [`convex/tsconfig.json`](./tsconfig.json) — TS config extending `tsconfig.base.json`
    - [`convex/.env.local`](./.env.local) — CLI-managed local deployment hint (gitignored)

    ---

    ## Troubleshooting

    **`pnpm --filter @eisenbalm/convex exec convex dev` says "not in a Convex project".**
    Run from repo root (not from inside `convex/`). The `--filter @eisenbalm/convex` selects the right workspace.

    **`convex.json` was written with `"functions": "convex/"`.**
    The CLI defaults assume the nested layout. Hand-correct to `"functions": "./"` per step 3 above.

    **`convex deploy` fails with `Cannot find module './_generated/server'`.**
    Expected on the FIRST deploy after the function files land — the CLI generates `_generated/` as part of deploy. Retry; should succeed.

    **`/_debug/convex` shows "—" forever.**
    `NEXT_PUBLIC_CONVEX_URL` is not set in `apps/web/.env.local`, or it points at a different deployment than the one the function files are deployed to. Re-run step 4.

    **`/_debug/convex` shows "no provider" runtime error.**
    `apps/web/components/providers/ConvexClientProvider.tsx` did not mount, OR the page is being rendered as a Server Component (missing `'use client'` directive). Re-check Plans 03-05 and 03-06.

    **`401 Unauthorized` from `/api/mutation` curl.**
    The `CONVEX_DEPLOY_KEY` is from a different deployment or is a non-Production key type. Regenerate at dashboard → Settings → Deploy Keys → **Production**.

    **`convex deploy` reports "Schema validation failed" with kebab-case literal errors.**
    A function file's `v.literal(...)` union does not match `schema.ts` exactly. `awaiting-review` (not `awaitingReview`), `scout-finding` (not `scoutFinding`), etc.

    ---

    *Phase 3 owner: gsd-planner.*
    *Phase 4 (next): Pipeline Skeleton — will write to all five tables via HTTP API.*
    *Phase 9: removes `/_debug/convex` and wires real subscriptions into `<DeliberationSlot>`.*
    ```

    Do NOT skip the `## What lives where`, `## Troubleshooting`, or `## /_debug/convex route` sections — they are the Phase 9 cleanup contract and the onboarding lifeline.
  </action>
  <verify>
    <automated>test -f convex/README.md && grep -q "pnpm --filter @eisenbalm/convex exec convex dev --once --configure" convex/README.md && grep -q "convex/_generated/" convex/README.md && grep -q "CONVEX_DEPLOY_KEY" convex/README.md && grep -q "SECRET\|database password\|NEVER commit" convex/README.md && grep -q "/_debug/convex" convex/README.md && grep -q "TODO(Phase 9)" convex/README.md && grep -q "pipelineRuns" convex/README.md && grep -q "deliberationEvents" convex/README.md && grep -q "qaCorrections" convex/README.md && grep -q "agentVotes" convex/README.md && grep -q "pitchLog" convex/README.md && grep -q '"functions"' convex/README.md && grep -q '"./"' convex/README.md && grep -q "/api/mutation" convex/README.md && grep -q "Authorization: Convex" convex/README.md && [ $(wc -l < convex/README.md) -ge 100 ]</automated>
  </verify>
  <acceptance_criteria>
    - `convex/README.md` exists and is at least 100 lines long
    - Contains the exact init command `pnpm --filter @eisenbalm/convex exec convex dev --once --configure`
    - Documents all 5 tables (pipelineRuns, deliberationEvents, agentVotes, qaCorrections, pitchLog) with their indexes
    - Documents all 5 function files with their query/mutation exports
    - Calls out `CONVEX_DEPLOY_KEY` as SECRET with "NEVER commit" / "NEVER expose via NEXT_PUBLIC_*" / "database password" wording
    - References the `"functions": "./"` requirement for convex.json (Pitfall 6)
    - Documents the HTTP API smoke curl pattern (`Authorization: Convex <key>` against `/api/mutation`)
    - Documents the `/_debug/convex` Phase 3 / Phase 9 cleanup contract
    - Lists the 6-step (or equivalent) Andrew smoke test
    - Has a `What lives where` section + `Troubleshooting` section
    - References `docs/API_CONTRACTS.md` §3 and §4 as the canonical contract
  </acceptance_criteria>
  <done>
    The README is the canonical bootstrap doc for the Convex workspace. Andrew can take a fresh clone to a live deployment by following only this file.
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend apps/web/README.md with a Convex section</name>
  <files>apps/web/README.md</files>
  <read_first>
    - apps/web/README.md (current content — preserve every Phase 2 section; we ADD a new Convex section and update the "What is not in Phase 2" + environment-variables tables)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-26 (update apps/web/README.md with Convex section)
    - convex/README.md (just written — the new Convex doc to link to)
    - **VERIFY the following heading anchors exist before editing.** Run BOTH greps and record exit codes:
      ```bash
      grep -n '^### Reading time' apps/web/README.md
      grep -n '^### SEO and structured data' apps/web/README.md
      ```
      - If BOTH exit 0 (headings present): use the **primary placement** described in `<action>` Addition 3 below — insert the new `## Convex` section AFTER `### Reading time` and BEFORE `### SEO and structured data`.
      - If EITHER exit non-zero (one or both headings missing — drift since planning): use the **fallback placement** — add the new `## Convex` section as the LAST subsection inside the existing top-level `## Architecture notes` section. If `## Architecture notes` itself does not exist, fall back to placing `## Convex` as a new top-level section AFTER the existing `## Routes` section and BEFORE any top-level `## What is not in Phase 2` / `## References` / footer section. Record which placement (primary vs fallback A vs fallback B) was used in the SUMMARY file.
      - Critical: the acceptance test (below) anchors on the EXISTENCE of `## Convex` and the EXISTENCE of its required content — NOT on its position relative to specific neighbouring headings. The placement guidance above is to keep the doc readable; the contract is "the section exists with the required content".
  </read_first>
  <action>
    Edit `apps/web/README.md`. Make THREE targeted additions while preserving every existing section, table, and code block byte-for-byte.

    **Addition 1 — Update the routes table.** In the existing `## Routes` table, ADD a new row at the bottom (after `/robots.txt` row) for `/_debug/convex`:

    ```
    | `/_debug/convex` | `convex/*.ts` queries | **Phase 3 evidence only. Removed in Phase 9.** Hidden — not in nav, sitemap, or RSS. `Disallow: /_debug/` in robots.txt. Calls all 5 byRunId queries with synthetic runId `phase-3-smoke-test`. |
    ```

    **Addition 2 — Update the environment variables table.** In the existing `## Environment variables` section, ADD two new rows to the table (after the `NEXT_PUBLIC_SITE_URL` row):

    ```
    | `NEXT_PUBLIC_CONVEX_URL` | yes (when Convex is configured) | _none_ | Public Convex deployment URL (e.g. `https://adjective-animal-NNN.convex.cloud`). Web app uses it to construct `ConvexReactClient`. Set after running `pnpm --filter @eisenbalm/convex exec convex dev --once --configure`. When missing, the provider falls back to passing children through (no Convex subscriptions) — the rest of the site still renders. |
    | `CONVEX_DEPLOY_KEY` | no (web app does not need it) | _none_ | **SECRET. NEVER commit. NEVER expose via NEXT_PUBLIC_*.** Convex Production Deploy Key (`prod:...`). Used by `convex deploy` (CI / Vercel build step) and by the Phase 4 pipeline's HTTP API mutation calls. Kept in `apps/web/.env.local` for local HTTP API smoke tests. |
    ```

    **Addition 3 — Add a new `## Convex` section.** Placement is determined by the precondition checks in `<read_first>`:

    - **Primary placement** (when both heading anchors exist): insert the entire `## Convex` section block below AFTER the existing `### Reading time` subsection and BEFORE the existing `### SEO and structured data` subsection.
    - **Fallback A** (when one or both of those headings are missing but `## Architecture notes` exists): append the entire `## Convex` section block below as the LAST subsection under `## Architecture notes` (before the next top-level `##` heading).
    - **Fallback B** (when `## Architecture notes` does not exist either): place `## Convex` as a new top-level section AFTER the existing `## Routes` section and before any top-level "What is not in Phase 2" / "References" / footer section.

    The acceptance criteria only require that `## Convex` exists in the file with the listed required content; the placement above is editorial only. Record the chosen placement in the SUMMARY.

    ```markdown
    ## Convex

    Phase 3 (2026-05) wired the web app to a Convex production deployment. The Convex backend hosts the deliberation stream (5 tables — `pipelineRuns`, `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`) and exposes 5 `byRunId` queries plus insertion mutations.

    See [`convex/README.md`](../../convex/README.md) for the canonical Convex onboarding doc. The summary below is everything `apps/web` needs to know.

    ### Provider mount

    [`apps/web/components/providers/ConvexClientProvider.tsx`](./components/providers/ConvexClientProvider.tsx) is a `'use client'` wrapper that constructs `new ConvexReactClient(NEXT_PUBLIC_CONVEX_URL)` at module scope (one websocket per browser session — never re-create per render). It is mounted in [`apps/web/app/layout.tsx`](./app/layout.tsx) so every descendant Client Component can call `useQuery`. The root layout remains a Server Component.

    When `NEXT_PUBLIC_CONVEX_URL` is missing (e.g. Vercel preview deploys before Convex is provisioned), the provider passes children through without wrapping — the rest of the site renders, but any descendant calling `useQuery` will throw with a clear "no provider" message. This matches the pattern in [`apps/web/lib/sanity/client.ts`](./lib/sanity/client.ts) (placeholder projectId fallback).

    ### Type imports

    Convex's generated `api` object lives at `convex/_generated/api.{ts,d.ts}` (committed to git per project decision D-08 — mirrors Phase 1's `sanity.types.ts` posture). The [`apps/web/tsconfig.json`](./tsconfig.json) `paths` block aliases `@convex/*` → `../../convex/*`, so consumers `import { api } from '@convex/_generated/api'`.

    ### `/_debug/convex` (Phase 3 only — removed in Phase 9)

    [`apps/web/app/_debug/convex/page.tsx`](./app/_debug/convex/page.tsx) is Phase 3's CVX-05 evidence surface. It calls all five `byRunId` queries with a synthetic `runId: "phase-3-smoke-test"` and renders a five-row table. Visit it locally at http://localhost:3000/_debug/convex.

    The file carries a `TODO(Phase 9):` cleanup comment. Phase 9 (Issue Page Completion) will:

    1. Delete `apps/web/app/_debug/convex/page.tsx`
    2. Delete `apps/web/app/_debug/` if no other debug routes were added
    3. Remove the `Disallow: /_debug/` line from `apps/web/public/robots.txt`
    4. Drop this section from `apps/web/README.md`

    Until then, the route exists as an empty-state checkpoint Andrew can hit to confirm the Convex pathway is alive without polluting the production site. It is excluded from `sitemap.xml` and `feed.xml` (those files only emit known editorial routes) and `Disallow:`-ed in `robots.txt`. The page also emits `<meta name="robots" content="noindex,nofollow">` for defense in depth.

    ### What happens in Phase 9

    [`apps/web/components/issue/DeliberationSlot.tsx`](./components/issue/DeliberationSlot.tsx) — Phase 2's collapsed `<details>` placeholder — will gain `useQuery` calls against the issue's `runId` (fetched from Sanity via `QUERY_ISSUE_RUN_ID` in [`apps/web/lib/sanity/queries.ts`](./lib/sanity/queries.ts), already wired in Phase 2). The five queries flow into agent identity cards, advocate score bars, QA severity badges, and a pitch log timeline.

    Phase 3 leaves `DeliberationSlot.tsx` untouched. The provider scaffolding is what Phase 9 will plug into.
    ```

    Be careful: the `## What is not in Phase 2` table at the end of the README claims certain features land in later phases. Update that table to reflect the Phase 3 progress — change the row about "Convex deliberation live subscriptions" to clarify that Phase 3 has provisioned the infrastructure (provider mounted, queries deployed) and Phase 9 will wire the actual live `<DeliberationSlot>` subscriptions. Keep the row but adjust the wording:

    Find this row in the existing table:
    ```
    | Convex deliberation live subscriptions | Phase 9 |
    ```

    Change to:
    ```
    | Live `<DeliberationSlot>` Convex subscriptions (uses Phase 3's infrastructure) | Phase 9 |
    ```

    If that exact row text does not exist (drift), record this in the SUMMARY and skip the edit — the section-header existence test below does NOT depend on this row update.

    Do not touch any other row in that table.
  </action>
  <verify>
    <automated>grep -q "^## Convex" apps/web/README.md && grep -q "NEXT_PUBLIC_CONVEX_URL" apps/web/README.md && grep -q "CONVEX_DEPLOY_KEY" apps/web/README.md && grep -q "ConvexClientProvider" apps/web/README.md && grep -q "/_debug/convex" apps/web/README.md && grep -q "TODO(Phase 9)" apps/web/README.md && grep -q "DeliberationSlot" apps/web/README.md && grep -q "@convex/\*" apps/web/README.md && grep -q "phase-3-smoke-test" apps/web/README.md && grep -q "convex/README.md" apps/web/README.md && grep -q "Phase 2" apps/web/README.md && grep -q "useCdn: true" apps/web/README.md</automated>
  </verify>
  <acceptance_criteria>
    - The section header line `## Convex (Phase 3)` OR `## Convex` exists in `apps/web/README.md` — verified by `grep -q "^## Convex" apps/web/README.md`
    - The `## Convex` section contains ALL of the following content greps (positive-grep contract, anchored to the section's content NOT its position):
      - `grep -q "ConvexClientProvider" apps/web/README.md` (provider component name documented)
      - `grep -q "NEXT_PUBLIC_CONVEX_URL" apps/web/README.md` (public env var documented)
      - `grep -q "CONVEX_DEPLOY_KEY" apps/web/README.md` (secret env var documented)
      - `grep -q "/_debug/convex" apps/web/README.md` (debug route path documented)
      - `grep -q "TODO(Phase 9)" apps/web/README.md` (cleanup contract documented)
      - `grep -q "DeliberationSlot" apps/web/README.md` (Phase 9 connection documented)
      - `grep -q "@convex/\*" apps/web/README.md` (path alias documented)
      - `grep -q "phase-3-smoke-test" apps/web/README.md` (synthetic runId documented)
      - `grep -q "convex/README.md" apps/web/README.md` (link to canonical doc)
    - The routes table includes a row for `/_debug/convex`
    - The environment variables table includes rows for `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOY_KEY` with the SECRET / NEVER-commit wording for the latter
    - The "What is not in Phase 2" table row about Convex subscriptions is updated to clarify Phase 3 already delivered the infrastructure (OR — if the exact row text doesn't exist due to drift — this is noted in the SUMMARY and skipped)
    - All existing Phase 2 sections (Routes table other rows, Setup, Sanity reader, Theme engine, Issue route, Portable Text, Anchor copy, Reading time, SEO, Print stylesheet, Tailwind, Deploying to Vercel, Troubleshooting) are preserved unchanged when they exist; SUMMARY records any Phase 2 section names that have drifted
    - Links to `../../convex/README.md`, `./components/providers/ConvexClientProvider.tsx`, `./app/_debug/convex/page.tsx`, `./components/issue/DeliberationSlot.tsx`, `./lib/sanity/queries.ts` are present and use correct relative paths
  </acceptance_criteria>
  <done>
    `apps/web/README.md` is updated with the Phase 3 Convex section. Andrew can find the provider mount location, env var requirements, and the Phase 9 cleanup contract from this file alone. The acceptance contract is anchored to the existence of `## Convex` and its required content, not to brittle relative-position assertions.
  </done>
</task>

</tasks>

<verification>
- `convex/README.md` exists (new file)
- `apps/web/README.md` has a `## Convex` section (positive grep: `grep -q "^## Convex" apps/web/README.md`) and updated tables
- Both files reference the Phase 9 cleanup contract for `/_debug/convex`
- Both files call out `CONVEX_DEPLOY_KEY` as SECRET with explicit warnings
- Both files document `NEXT_PUBLIC_CONVEX_URL` provisioning
- No code files were touched in this plan
- DeliberationSlot.tsx, convex/schema.ts, convex/*.ts are all unmodified
</verification>

<success_criteria>
- CVX-04 documented: README explains how to provision Vercel + Railway env (manual per D-22) — actual provisioning is Andrew's final smoke step in Plan 03-08
- CVX-05 documented: README explains the `/_debug/convex` evidence surface and how to read it
- Phase 9 cleanup contract is locked in three places: TODO(Phase 9) in `page.tsx` (Plan 03-06), `convex/README.md` (this plan), `apps/web/README.md` (this plan)
- A fresh engineer (or future Andrew after weeks away) can take a clean clone to a working deployment by following `convex/README.md` alone
</success_criteria>

<output>
After completion, create `.planning/phases/03-convex-deployment/03-07-SUMMARY.md` recording:
  (a) the two files touched and their final line counts,
  (b) confirmation that `git diff` of `apps/web/README.md` shows only ADDITIONS plus the one targeted edit to the "What is not in Phase 2" table row (no deletions of existing content),
  (c) confirmation that Phase 9 cleanup contract is documented in three places (the TODO in page.tsx, both READMEs),
  (d) the exact wording of the `CONVEX_DEPLOY_KEY` security warning so future plans can lift it verbatim (it should appear in both READMEs and both `.env.example` files),
  (e) which placement was used for the new `## Convex` section: primary (after `### Reading time`, before `### SEO and structured data`), fallback A (last subsection of `## Architecture notes`), or fallback B (new top-level section after `## Routes`).
</output>
</content>
</invoke>