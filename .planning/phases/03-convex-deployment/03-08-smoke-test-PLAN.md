---
phase: 03-convex-deployment
plan: 08
type: execute
wave: 8
depends_on:
  - "03-07"
files_modified: []
autonomous: false
requirements:
  - CVX-01
  - CVX-02
  - CVX-03
  - CVX-04
  - CVX-05
must_haves:
  truths:
    - "Andrew has executed the 6-step smoke test from D-23 against the live deployment"
    - "Convex dashboard shows 5 tables (0 rows each) and 5 modules (with all expected function exports)"
    - "Each of the 5 byRunId queries returns the empty-state response (null for pipelineRuns.first(), [] for the four .collect() queries) when called from the dashboard with a non-existent runId"
    - "http://localhost:3000/_debug/convex renders a five-row table with counts of 0 (or — briefly), no errors in browser devtools console"
    - "A direct HTTP API curl against POST {NEXT_PUBLIC_CONVEX_URL}/api/mutation with `Authorization: Convex {CONVEX_DEPLOY_KEY}` for `pipelineRuns:create` returns a success response (proves Railway/Phase-4 pathway is alive)"
    - "Andrew has provisioned NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOY_KEY in Vercel (if the apps/web Vercel project exists yet) or has scheduled doing so when it exists — CVX-04 evidence"
  artifacts: []
  key_links:
    - from: "apps/web/.env.local"
      to: "Live Convex deployment"
      via: "browser → ConvexReactClient → websocket → 5 byRunId queries"
      pattern: "phase-3-smoke-test"
    - from: "Production Deploy Key"
      to: "Convex HTTP API"
      via: "Authorization: Convex <key> → POST /api/mutation"
      pattern: "Authorization: Convex"
---

<objective>
Execute the end-of-phase manual smoke test (D-23) with Andrew. The smoke test is the lockable, observable evidence that all five CVX-* requirements pass against the live deployment. No code change in this plan — purely verification.

This plan is `autonomous: false` because Andrew is the only one with browser access to the Convex dashboard, the Vercel/Railway env stores, and the dev server logs at `localhost:3000`.

Purpose: Honors D-23 (6-step smoke test sequence). Captures the final Phase 3 evidence and the deploy URL for the SUMMARY.
Output: Andrew-approved confirmation that all five CVX-* requirements are met. Phase 4 (Pipeline Skeleton) is unblocked.
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
@convex/README.md
@apps/web/README.md
@apps/web/.env.example
@apps/web/app/_debug/convex/page.tsx
</context>

<tasks>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 1: Andrew runs the end-of-phase smoke test and confirms CVX-01..05</name>
  <files>(none — Andrew runs commands locally and verifies in the browser; results recorded in SUMMARY)</files>
  <read_first>
    - convex/README.md (the canonical sequence Andrew follows)
    - apps/web/README.md (Convex section — explains /_debug/convex)
    - .planning/phases/03-convex-deployment/03-CONTEXT.md D-23 (the 6-step contract — match it exactly)
    - .planning/phases/03-convex-deployment/03-RESEARCH.md §Code Examples §6 (Andrew's full sequence verbatim)
    - apps/web/.env.local (must contain valid NEXT_PUBLIC_CONVEX_URL and CONVEX_DEPLOY_KEY from Plan 03-02)
    - .planning/ROADMAP.md (Phase 3 success criteria 1, 2, 3)
  </read_first>
  <what-built>
    Plans 03-01 through 03-07 produced:
    - `@eisenbalm/convex` pnpm workspace with pinned `convex@^1.38.0`
    - Convex production deployment provisioned via Andrew's interactive init (Plan 03-02)
    - Five function files in `convex/` byte-for-byte equal to API_CONTRACTS §4
    - `convex/_generated/` committed (mirrors Phase 1 D-08 pattern)
    - Web app wired: `convex` dep, `@convex/*` path alias, `ConvexClientProvider` mounted in root layout with D-16 graceful fallback
    - `/_debug/convex` route with five `useQuery` calls + TODO(Phase 9) cleanup comment
    - `Disallow: /_debug/` in robots.txt; sitemap.ts + feed.xml/route.ts updated with exclusion comments
    - `convex/README.md` (new) and `apps/web/README.md` (extended) with full Convex section

    What is not yet verified:
    - End-to-end behavior of the full stack (dashboard ↔ deployment ↔ web app ↔ HTTP API)
    - CVX-04: Vercel + Railway env provisioning (may be deferred if those projects do not yet exist)
    - The HTTP API curl pathway (proves Phase 4 will be unblocked)
  </what-built>
  <how-to-verify>
    Andrew, please complete the six steps below in order. They map directly to D-23. The executor will resume only after you approve.

    **Step 1 — Convex dashboard sanity (CVX-01).**

    Open https://dashboard.convex.dev → your `eisenbalm-dispatch` project (or whatever you named it in Plan 03-02). Verify:

    - **Data** tab: all 5 tables visible:
      - `pipelineRuns` (0 rows)
      - `deliberationEvents` (0 rows)
      - `agentVotes` (0 rows)
      - `qaCorrections` (0 rows)
      - `pitchLog` (0 rows)
    - **Functions** tab: all 5 modules visible, each with its expected exports:
      - `pipelineRuns` → `byRunId`, `create`, `updateStatus`
      - `pitchLog` → `byRunId`, `insert`, `markSelected`
      - `deliberationEvents` → `byRunId`, `byRunIdAndType`, `insert`
      - `agentVotes` → `byRunId`, `byRunIdAndCharity`, `insert`
      - `qaCorrections` → `byRunId`, `insert`

    Note the deployment URL (Settings → Deployment URL) — record it for the SUMMARY.

    **Step 2 — Dashboard query smoke (CVX-02).**

    Still in the Functions tab, for each of the five `byRunId` queries:

    1. Click the function name → "Run Query" pane opens
    2. Enter args: `{"runId": "nonexistent-smoke-test"}`
    3. Click Run

    Expected results:
    - `pipelineRuns:byRunId` → `null`
    - `pitchLog:byRunId` → `[]`
    - `deliberationEvents:byRunId` → `[]`
    - `agentVotes:byRunId` → `[]`
    - `qaCorrections:byRunId` → `[]`

    Record any unexpected results.

    **Step 3 — Local dev server + `/_debug/convex` (CVX-05).**

    From the repo root:

    ```bash
    pnpm dev:web
    ```

    Wait for "Local: http://localhost:3000". In a browser, navigate to:

    > http://localhost:3000/_debug/convex

    Expected: A table with the heading "Convex smoke test" and exactly five rows:

    | Query | Rows |
    |---|---|
    | pipelineRuns.byRunId | 0 |
    | pitchLog.byRunId | 0 |
    | deliberationEvents.byRunId | 0 |
    | agentVotes.byRunId | 0 |
    | qaCorrections.byRunId | 0 |

    Briefly, before the subscription resolves, some rows may show `—`. After 1–2 seconds all five should settle on `0`.

    Open browser devtools → Console tab. Expected: NO errors. Acceptable: any pre-existing Sanity-related warnings carried over from Phase 2. NOT acceptable: any error containing `Convex`, `useQuery`, `provider`, `WebSocket`, `400`, `401`, or stack trace pointing into `convex/`.

    Stop the dev server (Ctrl+C).

    **Step 4 — Mutation insert + query refresh (CVX-03 + live update).**

    To prove insertion mutations work AND that the web app's `useQuery` updates reactively, insert a synthetic row from the dashboard:

    1. Convex dashboard → Functions → `pipelineRuns:create` → Run Mutation pane
    2. Args: `{"runId": "phase-3-smoke-test", "issueNumber": 0, "startedAt": 1234567890000}`
    3. Click Run → expected: success, returns a new `_id`

    Now re-open http://localhost:3000/_debug/convex (in a tab where the dev server is running, OR re-start the dev server). The `pipelineRuns.byRunId` row should now show `1` (the page is using the matching synthetic runId `phase-3-smoke-test`).

    Cleanup: dashboard → Data → pipelineRuns → the new row → ⋯ → Delete. Or:

    ```bash
    # From the Functions tab, run any pipelineRuns:* mutation that deletes by id —
    # OR simply leave the row; it does no harm and is gone after dataset reset.
    ```

    **Step 5 — HTTP API curl smoke (CVX-03 + Phase 4 readiness).**

    Test the HTTP API pathway that Phase 4's Python pipeline will use:

    ```bash
    source apps/web/.env.local
    TS=$(node -e 'console.log(Date.now())')
    curl -X POST "${NEXT_PUBLIC_CONVEX_URL}/api/mutation" \
      -H 'Content-Type: application/json' \
      -H "Authorization: Convex ${CONVEX_DEPLOY_KEY}" \
      -d "{
        \"path\": \"pipelineRuns:create\",
        \"args\": {
          \"runId\": \"phase-3-curl-smoke-${TS}\",
          \"issueNumber\": 0,
          \"startedAt\": ${TS}
        },
        \"format\": \"json\"
      }"
    ```

    Expected response: a JSON body with `"status":"success"` and a `"value"` field containing the new `_id`. Status code 200.

    If you get `401 Unauthorized`:
    - Re-check `CONVEX_DEPLOY_KEY` value (starts with `prod:`)
    - Confirm it is a Production Deploy Key (not Preview, not Dev) at dashboard → Settings → Deploy Keys

    Cleanup: delete the `phase-3-curl-smoke-*` row from the dashboard (or leave it — it does not interfere with Phase 4).

    **Step 6 — Remote env provisioning (CVX-04).**

    This step is fully manual. The plan does not automate it (D-22). It has two cases:

    **Case A — Vercel project for `apps/web` already exists (Phase 2 deployed):**

    ```bash
    cd apps/web
    npx vercel env add NEXT_PUBLIC_CONVEX_URL production
    # Paste: https://<your-deployment>.convex.cloud
    npx vercel env add CONVEX_DEPLOY_KEY production
    # Paste: prod:<your-key>
    ```

    Verify:
    ```bash
    npx vercel env ls production | grep -E "NEXT_PUBLIC_CONVEX_URL|CONVEX_DEPLOY_KEY"
    ```
    Expected: both lines printed.

    **Case B — Vercel project does not yet exist:**

    Record in the SUMMARY that Vercel provisioning is deferred until Andrew creates the Vercel project. The web app currently runs from `localhost:3000` (Phase 2 did not require deploy per its Plan 02-11 SUMMARY: "Cloud deploy URL not captured — Andrew's local smoke test satisfied all four FND criteria"). Phase 3 is unblocked from completing; the Vercel env provisioning happens whenever the project is created.

    **Railway** (Phase 4 dependency, not Phase 3):

    Railway provisioning happens in Phase 4 when the Pipeline service is created. Record this in the SUMMARY as deferred. Phase 4's `pnpm-railway-bootstrap` plan will set:

    ```bash
    railway variables set NEXT_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
    railway variables set CONVEX_DEPLOY_KEY=prod:<your-key>
    ```

    Andrew records the actual provisioning state (done in Vercel, deferred for Railway, etc.) in the SUMMARY notes.
  </how-to-verify>
  <acceptance_criteria>
    **CVX-01 (schema deployed):**
    - Convex dashboard Data tab shows all 5 tables (pipelineRuns, deliberationEvents, agentVotes, qaCorrections, pitchLog), each with 0 rows
    - `convex/_generated/api.d.ts` references all 5 tables

    **CVX-02 (5 byRunId queries exist):**
    - Each of the 5 `byRunId` queries is callable from the dashboard
    - `pipelineRuns:byRunId` with `{"runId":"nonexistent"}` returns `null`
    - The other four return `[]`

    **CVX-03 (5 insertion mutations exist):**
    - `pipelineRuns:create` from the dashboard succeeds with synthetic args, returning a new `_id`
    - HTTP API curl in Step 5 returns `{"status":"success",...}` with HTTP 200
    - (Implicit: typecheck passed in Plans 03-03 and 03-04, proving all 13 functions across 5 files type-check against the schema)

    **CVX-04 (deploy key in Vercel + Railway):**
    - Either Vercel `vercel env ls production` shows both `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOY_KEY`
    - OR Andrew has noted in the SUMMARY that Vercel/Railway projects do not yet exist and provisioning is deferred to when they do — referencing the documented commands

    **CVX-05 (useQuery returns empty without error):**
    - http://localhost:3000/_debug/convex renders a 5-row table, all with `0` (or briefly `—`)
    - Browser devtools Console shows no Convex-related errors
    - When Step 4's insert is performed, the page's `pipelineRuns` row updates to `1` reactively (proves live subscription works)
  </acceptance_criteria>
  <resume-signal>
    Type "approved" once all five CVX-* acceptance criteria above are met (or note any deferred items explicitly — e.g. "CVX-04 Vercel done, Railway deferred to Phase 4"). Or describe any failure and the executor will help diagnose.

    Common failure modes:
    - Dashboard shows fewer than 5 modules → re-run `pnpm --filter @eisenbalm/convex deploy` (Plan 03-04) and check CLI output for typecheck failures
    - `/_debug/convex` shows "—" forever → check `apps/web/.env.local` has the correct `NEXT_PUBLIC_CONVEX_URL`; restart dev server after any env change (Next.js does not hot-reload env vars)
    - `/_debug/convex` console error "Could not find Convex client" → `ConvexClientProvider` did not mount (Plan 03-05); check `apps/web/app/layout.tsx` for the JSX wrap
    - HTTP API curl returns 401 → `CONVEX_DEPLOY_KEY` is the wrong key type (must be Production, not Preview/Dev); regenerate at dashboard → Settings → Deploy Keys
    - Insert in Step 4 works on dashboard but `/_debug/convex` does not update → dev server reload may have lost the websocket; refresh the page
  </resume-signal>
</task>

</tasks>

<verification>
After Andrew approves:
- A live Convex deployment URL is captured (in SUMMARY)
- All 5 dashboard queries returned empty-state responses
- /_debug/convex rendered the 5-row table without errors
- HTTP API curl succeeded (CVX-03 evidence + Phase 4 pathway proven)
- Vercel + Railway env state is documented (provisioned OR deferred with reason)
- `git ls-files convex/_generated/` lists committed files (D-08 respected)
- `git ls-files convex/convex.json` includes that file
- `git check-ignore convex/.env.local apps/web/.env.local` echoes both (gitignored)
- DeliberationSlot.tsx git diff is empty (not modified in Phase 3)
</verification>

<success_criteria>
All five CVX-* requirements observable and approved by Andrew:

- CVX-01 (schema deploys with 5 tables) — Convex dashboard Data tab
- CVX-02 (5 byRunId queries) — Convex dashboard Functions tab + dashboard query smoke
- CVX-03 (5 insertion mutations) — Convex dashboard Functions tab + HTTP API curl smoke
- CVX-04 (deploy key in Vercel + Railway) — `vercel env ls` and/or deferred-with-reason note
- CVX-05 (useQuery returns empty arrays without error) — /_debug/convex 5-row table renders cleanly

Phase 4 (Pipeline Skeleton) is unblocked. Phase 9 cleanup contract is locked in three places (TODO comment in page.tsx, convex/README.md, apps/web/README.md).
</success_criteria>

<output>
After completion, create `.planning/phases/03-convex-deployment/03-08-SUMMARY.md` recording:
  (a) the live Convex deployment URL (or placeholder note if Andrew prefers not to record — value lives only in `apps/web/.env.local`),
  (b) the project name and team chosen on the Convex dashboard,
  (c) for each of CVX-01 through CVX-05: PASS / DEFERRED-WITH-REASON,
  (d) the exact HTTP response from Step 5's curl smoke (just `"status":"success"` confirmation is sufficient — do not record the full `_id`),
  (e) Vercel env provisioning state: DONE (paste output of `vercel env ls production | grep CONVEX`) or DEFERRED (note the reason — e.g. "Vercel project not yet created per Phase 2 SUMMARY"),
  (f) Railway env provisioning state: DEFERRED-TO-PHASE-4 (Railway service does not exist until Phase 4 — this is the expected state),
  (g) any deviations from the README sequence Andrew encountered,
  (h) confirmation that Phase 9 cleanup contract appears in three locations (TODO in `apps/web/app/_debug/convex/page.tsx`, `convex/README.md`, `apps/web/README.md` — Andrew greps each).
</output>
