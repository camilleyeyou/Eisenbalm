---
phase: 03-convex-deployment
plan: 04
type: execute
wave: 4
depends_on:
  - "03-03"
files_modified:
  - convex/_generated/api.ts
  - convex/_generated/api.d.ts
  - convex/_generated/api.js
  - convex/_generated/dataModel.d.ts
  - convex/_generated/server.d.ts
  - convex/_generated/server.js
autonomous: false
requirements:
  - CVX-01
  - CVX-02
  - CVX-03
must_haves:
  truths:
    - "`pnpm --filter @eisenbalm/convex deploy` (or `convex dev --once`) succeeds, pushing schema + 5 function files to the Convex production deployment"
    - "convex/_generated/ contains api.{ts,d.ts,js}, dataModel.d.ts, server.{d.ts,js}"
    - "convex/_generated/api.d.ts exports a typed `api` object with all 5 table namespaces (pipelineRuns, pitchLog, deliberationEvents, agentVotes, qaCorrections)"
    - "convex/_generated/ is committed to git (D-08 — mirrors Phase 1 sanity.types.ts pattern)"
    - "From the Convex dashboard, all 5 byRunId queries are listed and callable; calling each with runId='nonexistent' returns empty array (or null for pipelineRuns)"
  artifacts:
    - path: "convex/_generated/api.d.ts"
      provides: "Typed api object for web app and pipeline consumers"
      contains: "pipelineRuns"
    - path: "convex/_generated/server.d.ts"
      provides: "Server-side helper types (query, mutation, internalQuery, internalMutation, action)"
      contains: "DatabaseReader"
  key_links:
    - from: "Convex Cloud production deployment"
      to: "convex/schema.ts + convex/*.ts function files"
      via: "`convex deploy` upload — schema indexes + function module bodies"
      pattern: "indexes: by_runId"
    - from: "convex/_generated/api.d.ts"
      to: "apps/web/app/_debug/convex/page.tsx (Plan 03-06)"
      via: "TypeScript `api.<table>.<function>` resolution via @convex/* path alias"
      pattern: "export.*api"
---

<objective>
Run `pnpm --filter @eisenbalm/convex deploy` (Andrew-supervised so OAuth-cached creds work; the deploy operation is idempotent and non-interactive once the CLI is configured) to push the schema and the five function files to the production Convex deployment and emit `convex/_generated/`. Then commit `convex/_generated/` per D-08.

After this plan: the Convex dashboard shows 5 tables (already there since Plan 03-02's schema push) + 5 modules (pipelineRuns, pitchLog, deliberationEvents, agentVotes, qaCorrections) each with their named functions. From the dashboard, each `byRunId` query is callable.

Purpose: Honors D-08 (commit `_generated/`), D-09 (deploy command documented). Closes the loop on CVX-01 (schema deployed) and CVX-02/CVX-03 (functions live).
Output: A deployed Convex backend with all queries/mutations live + checked-in generated types.

Why `autonomous: false`: The deploy uses OAuth-cached credentials from Plan 03-02. Strictly speaking the deploy command itself is non-interactive, but if the CLI's auth has expired or the deploy emits a typecheck warning Andrew must adjudicate, we want the checkpoint pattern. Andrew can quickly approve a successful deploy and the executor commits `_generated/`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/03-convex-deployment/03-CONTEXT.md
@.planning/phases/03-convex-deployment/03-RESEARCH.md
@convex/schema.ts
@convex/pipelineRuns.ts
@convex/pitchLog.ts
@convex/deliberationEvents.ts
@convex/agentVotes.ts
@convex/qaCorrections.ts
@convex/convex.json
@convex/package.json
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Andrew runs `pnpm --filter @eisenbalm/convex deploy` and confirms dashboard shows 5 modules</name>
  <files>convex/_generated/api.ts, convex/_generated/api.d.ts, convex/_generated/api.js, convex/_generated/dataModel.d.ts, convex/_generated/server.d.ts, convex/_generated/server.js</files>
  <read_first>
    - convex/package.json (verify `deploy` script = `convex deploy`)
    - convex/convex.json (verify `"functions": "./"` is set per Plan 03-02 Step D)
    - convex/.env.local (must contain `CONVEX_DEPLOYMENT=` — CLI reads this for deploy target)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Code Examples §6 (Andrew's command sequence step 4 — `pnpm --filter @eisenbalm/convex deploy`)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-08 (`_generated/` is checked in)
  </read_first>
  <what-built>
    Plan 03-01 made `convex/` a workspace. Plan 03-02 created the Convex Cloud deployment + `convex.json` + `convex/.env.local`. Plan 03-03 added the five function files. The schema may already be on the deployment (Plan 03-02's `--configure` would have pushed it), but the function files are not yet deployed — Plan 03-02 ran BEFORE Plan 03-03 created them.

    This plan deploys the latest schema + all five function files and emits `convex/_generated/`.
  </what-built>
  <how-to-verify>
    Andrew, please complete the following steps in order.

    **Step A — Verify pre-conditions.** From the repo root:

    ```bash
    test -f convex/convex.json && \
      grep -q '"functions"[[:space:]]*:[[:space:]]*"\./"' convex/convex.json && \
      test -f convex/.env.local && \
      grep -q "^CONVEX_DEPLOYMENT=" convex/.env.local && \
      test -f convex/pipelineRuns.ts && \
      test -f convex/pitchLog.ts && \
      test -f convex/deliberationEvents.ts && \
      test -f convex/agentVotes.ts && \
      test -f convex/qaCorrections.ts && \
      echo "PRECONDITIONS OK"
    ```
    Expected output: `PRECONDITIONS OK`. If anything fails, re-run Plans 03-01 through 03-03 first.

    **Step B — Deploy schema + functions.** From the repo root:

    ```bash
    pnpm --filter @eisenbalm/convex deploy
    ```

    Expected output (paraphrased — actual wording varies by Convex CLI version):
    - "Deploying convex schema to <deployment-name>..."
    - "✓ Deployed schema"
    - "✓ Pushed 5 modules (pipelineRuns, pitchLog, deliberationEvents, agentVotes, qaCorrections)"
    - "Generated convex/_generated/"

    If the deploy fails with `not authenticated`, run `pnpm --filter @eisenbalm/convex exec convex login` first (browser OAuth flow).

    If the deploy fails with a TypeScript error, fix the function file (re-check Plan 03-03 verbatim copy) and re-run.

    **Step C — Verify generated files exist.** From the repo root:

    ```bash
    ls -la convex/_generated/
    test -f convex/_generated/api.d.ts && \
      test -f convex/_generated/api.js && \
      test -f convex/_generated/server.d.ts && \
      test -f convex/_generated/server.js && \
      test -f convex/_generated/dataModel.d.ts && \
      echo "GENERATED OK"
    ```
    Expected: `GENERATED OK`. (Note: Convex 1.38 emits `.d.ts` + `.js` pairs; the `.ts` versions of `api.ts` may or may not exist depending on CLI version — `.d.ts` is what TypeScript consumes.)

    Verify the generated `api.d.ts` references all five tables:

    ```bash
    grep -q "pipelineRuns" convex/_generated/api.d.ts && \
      grep -q "pitchLog" convex/_generated/api.d.ts && \
      grep -q "deliberationEvents" convex/_generated/api.d.ts && \
      grep -q "agentVotes" convex/_generated/api.d.ts && \
      grep -q "qaCorrections" convex/_generated/api.d.ts && \
      echo "API TYPED OK"
    ```
    Expected: `API TYPED OK`.

    **Step D — Verify dashboard.** Open https://dashboard.convex.dev → your project. In the left sidebar:

    1. **Data** tab: confirm all 5 tables are listed (pipelineRuns, deliberationEvents, agentVotes, qaCorrections, pitchLog). Each shows "0 rows" (empty by design — Phase 4 populates).
    2. **Functions** tab: confirm all 5 modules are listed. Click each module and confirm all expected functions appear:
       - `pipelineRuns`: `byRunId`, `create`, `updateStatus`
       - `pitchLog`: `byRunId`, `insert`, `markSelected`
       - `deliberationEvents`: `byRunId`, `byRunIdAndType`, `insert`
       - `agentVotes`: `byRunId`, `byRunIdAndCharity`, `insert`
       - `qaCorrections`: `byRunId`, `insert`

    **Step E — Smoke-test queries from dashboard.** Still in the **Functions** tab → click `pipelineRuns:byRunId` → use the "Run Query" pane → enter `{"runId": "nonexistent-test"}` → click Run. Expected result: `null` (no row found).

    Repeat for each of the four `.collect()` queries — expected result: `[]` (empty array).
       - `pitchLog:byRunId` → `{"runId":"nonexistent-test"}` → `[]`
       - `deliberationEvents:byRunId` → `{"runId":"nonexistent-test"}` → `[]`
       - `agentVotes:byRunId` → `{"runId":"nonexistent-test"}` → `[]`
       - `qaCorrections:byRunId` → `{"runId":"nonexistent-test"}` → `[]`

    This validates CVX-02 (queries exist) and partially validates CVX-05 (queries return empty without error).

    **Step F — Stage `_generated/` for commit.** From the repo root:

    ```bash
    git status convex/_generated/
    # Confirm files show as untracked / new
    git check-ignore convex/_generated/api.d.ts
    # Expected: non-zero exit code (NOT ignored — per D-08)
    git add convex/_generated/
    git status
    # Confirm all _generated files are staged
    ```

    Do not commit yet — the executor commits at the end of the phase per the project's existing GSD pattern, or commits this plan in isolation depending on the orchestrator's cadence.
  </how-to-verify>
  <acceptance_criteria>
    - `pnpm --filter @eisenbalm/convex deploy` exits 0 from repo root
    - `convex/_generated/api.d.ts` exists and contains references to all five table names (`pipelineRuns`, `pitchLog`, `deliberationEvents`, `agentVotes`, `qaCorrections`)
    - `convex/_generated/server.d.ts` exists
    - `convex/_generated/dataModel.d.ts` exists
    - `git check-ignore convex/_generated/api.d.ts` exits non-zero (file is NOT gitignored — D-08 respected)
    - Convex dashboard shows 5 tables under **Data** and 5 modules under **Functions**
    - Calling `pipelineRuns:byRunId` from dashboard with `{"runId":"nonexistent-test"}` returns `null`
    - Calling each of the four `.collect()` queries (`pitchLog:byRunId`, `deliberationEvents:byRunId`, `agentVotes:byRunId`, `qaCorrections:byRunId`) with the same args returns `[]`
    - `convex/_generated/` is staged for commit (`git status` shows it under "Changes to be committed")
  </acceptance_criteria>
  <resume-signal>
    Type "approved" once the deploy succeeded, `convex/_generated/` exists with all expected files, and the dashboard smoke test from Step E showed `null` / `[]` for all five queries. Or describe any failure (CLI error, typecheck issue, missing module, unexpected dashboard state).

    Common failure modes:
    - `convex deploy` fails with "not authenticated" → run `pnpm --filter @eisenbalm/convex exec convex login` and retry
    - `convex deploy` fails with `Cannot find module './_generated/server'` → expected on FIRST deploy; the CLI generates `_generated/` AS PART of deploy. Retry — should succeed on second run. (Confirmed in Convex 1.38 docs.)
    - `convex deploy` typecheck error → re-check the file mentioned in the error against API_CONTRACTS §4 verbatim copy (Plan 03-03)
    - Dashboard shows only 4 modules → look at the missing module file's content; the CLI silently skips files with syntax errors. Run `pnpm --filter @eisenbalm/convex typecheck` locally to surface the error.
    - Dashboard query returns "function not found" → the deploy did not push the function file. Re-deploy.
  </resume-signal>
</task>

</tasks>

<verification>
After Andrew approves:
- `test -d convex/_generated` exits 0
- `test -f convex/_generated/api.d.ts && test -f convex/_generated/server.d.ts && test -f convex/_generated/dataModel.d.ts` exits 0
- `grep -q "pipelineRuns" convex/_generated/api.d.ts && grep -q "pitchLog" convex/_generated/api.d.ts && grep -q "deliberationEvents" convex/_generated/api.d.ts && grep -q "agentVotes" convex/_generated/api.d.ts && grep -q "qaCorrections" convex/_generated/api.d.ts` exits 0
- `git check-ignore convex/_generated/api.d.ts` exits non-zero
- Convex dashboard reflects 5 modules + 5 tables (manual verification, recorded in SUMMARY)
</verification>

<success_criteria>
- CVX-01 satisfied: schema deployed (5 tables visible in dashboard)
- CVX-02 satisfied: 5 `byRunId` queries live and callable from dashboard
- CVX-03 satisfied: all insertion mutations + `updateStatus` + `markSelected` + `byRunIdAndType` + `byRunIdAndCharity` live
- `convex/_generated/` exists and is staged for commit per D-08
- Plan 03-05 (web app wiring) is unblocked — `@convex/_generated/api` will type-check
</success_criteria>

<output>
After completion, create `.planning/phases/03-convex-deployment/03-04-SUMMARY.md` recording:
  (a) the deploy command output (modules pushed, any warnings),
  (b) the list of files generated in `convex/_generated/` (filenames + line counts),
  (c) screenshot URLs or text descriptions from the dashboard confirming the 5 modules + 5 tables (Andrew's notes),
  (d) the empty-state query results for each of the five `byRunId` queries from the dashboard (validates CVX-05 partially — full CVX-05 evidence is the `/_debug/convex` page in Plan 03-06),
  (e) any CLI version drift from the pinned `convex@^1.38.0` (note actual version that was resolved).
</output>
