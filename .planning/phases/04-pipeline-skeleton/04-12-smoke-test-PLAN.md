---
phase: 04-pipeline-skeleton
plan: 12
type: execute
wave: 5
depends_on:
  - "04-11"
files_modified: []
autonomous: false
requirements:
  - PIP-01
  - PIP-02
  - PIP-03
  - PIP-04
  - PIP-05
  - PIP-06
  - PIP-07
  - PIP-08
  - PIP-09
  - PIP-10
  - PIP-11
  - PIP-12
  - OPS-01
  - OPS-02
  - OPS-03
must_haves:
  truths:
    - "Andrew has provisioned the Railway project + Supabase project per CONTEXT D-29 and D-30"
    - "All Phase 4 env vars are set in Railway (SUPABASE_POSTGRES_URL session pooler, NEXT_PUBLIC_CONVEX_URL, CONVEX_DEPLOY_KEY, NEXT_PUBLIC_SANITY_PROJECT_ID, SANITY_API_TOKEN, OPENROUTER_API_KEY placeholder, TAVILY_API_KEY placeholder, EISENBALM_STUB_MODE=true, PIPELINE_TRIGGER_SECRET)"
    - "`setup-checkpointer` ran once successfully against Supabase (4 LangGraph tables visible in Supabase dashboard)"
    - "POST /run/weekly returns {runId} within 1 second; the run completes within 30 seconds with status=awaiting-review"
    - "Sanity Studio shows the draft issue-999 with every section populated AND pipelineMetadata.runId == Convex pipelineRuns.runId AND pipelineMetadata.cost is a JSON string"
    - "Convex dashboard shows rows in all five tables with the same runId"
    - "Optional interrupt/resume smoke confirms POST /run/{runId}/resume re-attaches to the paused thread and runs to terminal"
    - "Andrew confirms all 15 PIP-* and OPS-* requirements"
  artifacts: []
  key_links:
    - from: "Andrew's local terminal"
      to: "Live Railway pipeline + production Supabase + production Sanity + production Convex"
      via: "curl POST /run/weekly + Sanity Studio + Convex dashboard"
      pattern: "X-Pipeline-Trigger-Secret"
---

<objective>
Andrew runs the end-of-phase smoke test from `packages/pipeline/README.md` (verbatim from CONTEXT D-42) against the live, deployed Railway pipeline. This is the canonical Phase 4 acceptance evidence — when this plan closes, Phase 4 is complete and Phase 5 (Agent Quality) is unblocked.

This plan is `autonomous: false` because:
1. Railway + Supabase provisioning is manual (CONTEXT D-29, D-30 — Andrew has the accounts).
2. The smoke test verifies via Sanity Studio (UI) and Convex dashboard (UI) — no headless equivalent exists.
3. `OPS-03` requires Andrew to confirm the cost JSON renders in Sanity Studio's pipelineMetadata.cost field.

Purpose: Final acceptance for all 15 Phase 4 requirements. The README authored in Plan 11 is the script Andrew follows.
Output: A SUMMARY recording the Railway URL, the test runId, screenshots/notes from Sanity Studio + Convex dashboard, and Andrew's sign-off.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/phases/04-pipeline-skeleton/04-CONTEXT.md
@.planning/phases/04-pipeline-skeleton/04-RESEARCH.md
@packages/pipeline/README.md
@packages/pipeline/.env.example
@packages/pipeline/railway.toml
@packages/pipeline/Dockerfile
@convex/README.md
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Andrew provisions Railway + Supabase</name>
  <files>(none — Andrew creates external resources)</files>
  <read_first>
    - packages/pipeline/README.md "Deploy workflow" section
    - packages/pipeline/README.md "First-time setup" section
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-29 (Railway provisioning steps)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-30 (Supabase provisioning steps)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md §7 (Supabase session pooler URL format — IMPORTANT: port 5432 host aws-0-<region>.pooler.supabase.com)
  </read_first>
  <what-built>
    Plans 01-11 produced a complete, deployable Phase 4 pipeline:
    - Python project at `packages/pipeline/` with FastAPI + LangGraph + AsyncPostgresSaver
    - Dockerfile with WeasyPrint system deps preinstalled (PIP-01 scaffolding)
    - railway.toml with `/healthz` healthcheck + preDeployCommand running `setup-checkpointer`
    - 14 stub agents + the `@agent_node` wrapper + the LangGraph builder
    - Three-datastore write discipline (Sanity drafts + Convex events + Supabase checkpoints)
    - Integration test suite with PIP-04/06/10 + OPS-01 covered

    What's needed now: a live Railway deployment + a Supabase project + the one-time `setup-checkpointer` migration.
  </what-built>
  <how-to-verify>
    Andrew completes the following provisioning steps:

    **A. Create the Supabase project:**
    1. Visit https://supabase.com/dashboard → New project → Name: `eisenbalm-pipeline` → choose a region near where Railway will deploy → set a strong DB password.
    2. Wait ~2 minutes for provisioning.
    3. Project Settings → Database → "Connection string" tab → select **Session pooler** (port 5432, host `aws-0-<region>.pooler.supabase.com`). NOT Transaction pooler. NOT Direct connection.
    4. Copy the session pooler URL and append `?sslmode=require`. Save it for step B-3.

    **B. Create the Railway project:**
    1. From `packages/pipeline/`:
       ```
       railway login
       railway init
       railway link
       ```
    2. Set every required env var from the table in `packages/pipeline/README.md`:
       ```
       railway variables set SUPABASE_POSTGRES_URL='postgres://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require'
       railway variables set NEXT_PUBLIC_CONVEX_URL='https://...'
       railway variables set CONVEX_DEPLOY_KEY='prod:...'
       railway variables set NEXT_PUBLIC_SANITY_PROJECT_ID='6h1vd9mf'
       railway variables set NEXT_PUBLIC_SANITY_DATASET='production'
       railway variables set SANITY_API_TOKEN='sk...'
       railway variables set OPENROUTER_API_KEY='sk-or-PLACEHOLDER'
       railway variables set TAVILY_API_KEY='tvly-PLACEHOLDER'
       railway variables set EISENBALM_STUB_MODE='true'
       railway variables set PIPELINE_TRIGGER_SECRET="$(python -c 'import secrets; print(secrets.token_urlsafe(32))')"
       ```
    3. First deploy:
       ```
       railway up
       ```

    **C. Verify the deploy:**
    1. Railway dashboard shows green build + healthcheck pass on `/healthz`.
    2. The preDeployCommand log shows `Checkpointer tables created / verified.` (PIP-09 + setup-checkpointer auto-ran).
    3. Supabase dashboard → Tables shows 4 new tables: `checkpoints`, `checkpoint_writes`, `checkpoint_blobs`, `checkpoint_migrations`.
    4. `curl https://<your-railway-url>/healthz` returns `{"ok":true,"checkpointer":"connected","stubMode":true}`.

    Record the Railway URL for Task 2.

    If the deploy or healthcheck fails: check the README's "Where to look when something breaks" troubleshooting table. The two most common causes are: (a) wrong Supabase pooler mode → swap to session pooler 5432; (b) missing env var → check `railway variables`.
  </how-to-verify>
  <resume-signal>
    Type "deployed" when:
    - Supabase project exists and the session-pooler URL is saved as the SUPABASE_POSTGRES_URL env var in Railway
    - All 9 env vars are set in Railway
    - `railway up` succeeded
    - `curl https://<railway-url>/healthz` returns 200 with `ok: true`
    - The Supabase dashboard shows the 4 LangGraph checkpoint tables
    - The Railway URL is recorded for Task 2
  </resume-signal>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Andrew runs the 8-step smoke test from CONTEXT D-42 against the live deployment</name>
  <files>(none — Andrew runs commands locally and verifies in Sanity Studio + Convex dashboard)</files>
  <read_first>
    - packages/pipeline/README.md "Andrew's end-of-phase smoke test" section (full 8-step recipe)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-42 (9-step canonical smoke test)
    - .planning/ROADMAP.md Phase 4 success criteria
    - .planning/REQUIREMENTS.md PIP-* + OPS-* (the 15 requirements that close)
  </read_first>
  <what-built>
    Task 1 stood up the live Railway pipeline. Task 2 exercises it end-to-end and confirms all 15 Phase 4 requirements.
  </what-built>
  <how-to-verify>
    Follow the "Andrew's end-of-phase smoke test" section in `packages/pipeline/README.md` step-by-step. Key checkpoints:

    **Step 1 (PIP-02):** `POST /run/weekly` returns `{runId}` within 1 second.

    **Step 2 (PIP-03 + PIP-05):** Wait ~30 seconds. The Railway logs show all 14 agent nodes executed in order: Calibrator → Scout → Advocate → Editor[gate 1] → Researcher → fan-out (7 writers) → validate_sections → QA → Editor[final] → Publisher.

    **Step 3 (OPS-02 + PIP-11 + PIP-12):** `GET /run/{runId}/status` returns:
    - `status: "awaiting-review"` (NOT `complete` — stub Publisher leaves it there per CONTEXT D-18 step 12)
    - `durationMs` populated (> 0)
    - `completedAt` populated
    - `errorMessage` null

    **Step 4 (PIP-07 + PIP-05 + OPS-03):** Open Sanity Studio → find draft `issue-999`. Confirm:
    - Every section field (originStory, problemStatement, founderBio, caseStudy, game, bonus, podcast, selectionDeliberation) is populated with stub content
    - The charity reference points to "The Quiet Foundation" (from Phase 2 demo seed)
    - `pipelineMetadata.runId` equals the runId from Step 1
    - `pipelineMetadata.cost` shows a JSON string with shape `{"total": 0.0, "agents": {...}}` (OPS-03 evidence — read-only in Studio per CONTEXT D-24)
    - `pipelineMetadata.modelVersions` shows `"{}"` (empty in stub mode)

    **Step 5 (PIP-06 + PIP-08):** Open Convex dashboard → check all 5 tables filtered by runId:
    - `pipelineRuns`: 1 row, runId matches, status='awaiting-review', durationMs > 0, cost JSON populated
    - `pitchLog`: 3 rows (Scout's 3 candidates — one is "The Quiet Foundation", selected=true)
    - `agentVotes`: 3 rows (Advocate scored each candidate)
    - `deliberationEvents`: 12+ rows covering eventTypes: `advocate-argument` (3), `editor-decision` (1), `section-draft` (7), `qa-correction` (1), `editor-final` (1), `publisher-deploy` (1)
    - `qaCorrections`: 0 rows (stub QA finds nothing — CONTEXT D-18 step 9)

    **Step 6 (PIP-09 + PIP-04):** From a local clone of the repo:
    ```
    cd packages/pipeline
    uv sync
    cp .env.example .env  # fill in the SAME values as Railway
    uv run pytest -v
    ```
    All tests should pass (15+ stub-fixture parametrized tests + e2e + resume + failure + status + checkpointer).

    **Step 7 (OPS-01) — failure path:**
    ```
    curl -X POST $RAILWAY_URL/run/weekly \
         -H "X-Pipeline-Trigger-Secret: $SECRET" \
         -d '{"forceFailAgent": "researcher", "issueNumber": 999001}'
    ```
    Within 10 seconds:
    ```
    curl $RAILWAY_URL/run/{runId}/status
    ```
    Should return:
    - `status: "failed"`
    - `errorMessage: "researcher: RuntimeError: Forced failure for testing (agent=researcher)"` (or similar — must start with `researcher:`)
    - `completedAt` populated

    **Step 8 (PIP-10) — interrupt/resume path:**
    ```
    curl -X POST $RAILWAY_URL/run/weekly \
         -H "X-Pipeline-Trigger-Secret: $SECRET" \
         -d '{"forceNoWinner": true, "issueNumber": 999002}'
    ```
    Wait 5 seconds:
    ```
    curl $RAILWAY_URL/run/{runId}/status
    ```
    Should return `status: "awaiting-review"` (Editor gate 1 paused at interrupt). Then:
    ```
    curl -X POST $RAILWAY_URL/run/{runId}/resume \
         -H "X-Pipeline-Trigger-Secret: $SECRET" \
         -d '{"selection": {"charityName": "The Quiet Foundation"}}'
    ```
    Should return `{"runId": "...", "resumed": true}`. Wait 30 seconds:
    ```
    curl $RAILWAY_URL/run/{runId}/status
    ```
    Should return `status: "awaiting-review"` (final, post-Publisher) with `durationMs` populated.

    Confirm Sanity draft `issue-999002` exists with charity ref `charity-the-quiet-foundation`.

    **Clean up (optional):** Delete the test Sanity drafts (`issue-999`, `issue-999001`, `issue-999002`) via Studio so they don't appear in `/archive`.

    Record outcomes for the SUMMARY:
    - The Railway URL
    - The 3 test runIds (success, failure, interrupt/resume)
    - Confirmation that pipelineMetadata.cost rendered in Sanity Studio (OPS-03)
    - Any environmental issues encountered + how they were resolved
  </how-to-verify>
  <resume-signal>
    Type "approved" when all 8 steps succeed AND:
    - PIP-01: green Railway build with WeasyPrint deps in the image
    - PIP-02: `POST /run/weekly` returns {runId}
    - PIP-03: Railway logs show all 14 agents executing in sequence
    - PIP-04: `uv run pytest tests/agents/test_stub_fixtures.py` passes
    - PIP-05: runId in Sanity == runId in every Convex row
    - PIP-06: integration test asserts the runId-threading invariant
    - PIP-07: Sanity draft populated correctly with deterministic charity ref
    - PIP-08: 5 Convex tables show the expected row counts + event types
    - PIP-09: 4 Supabase tables present; setup() ran via preDeployCommand
    - PIP-10: interrupt/resume cycle works end-to-end
    - PIP-11: pipelineRuns.cost JSON populated
    - PIP-12: pipelineRuns.durationMs > 0
    - OPS-01: forceFailAgent test produces `status=failed` + `researcher:` errorMessage prefix
    - OPS-02: status endpoint returns the canonical response shape + 404 on unknown runId
    - OPS-03: pipelineMetadata.cost JSON renders in Sanity Studio

    Or describe issues encountered for follow-up.
  </resume-signal>
</task>

</tasks>

<verification>
This plan is verification — there is no automated check beyond Andrew's manual confirmation. Plan 10's integration test (`uv run pytest -v`) is the proxy when env vars are set.

After approval:
- All 15 Phase 4 requirements are met
- ROADMAP.md Phase 4 success criteria satisfied
- Phase 5 (Agent Quality) is unblocked

If any step fails:
- Document the failure in the SUMMARY with the exact error
- Open a follow-up plan (e.g., `04-13-gap-closure-PLAN.md` via `/gsd:plan-phase --gaps`)
</verification>

<success_criteria>
- Andrew confirms all 8 smoke-test steps succeed
- All 15 PIP-* + OPS-* requirements have evidence (combination of Railway logs, Sanity Studio screenshots, Convex dashboard screenshots, and the integration test pytest output)
- Railway URL + 3 test runIds recorded in SUMMARY
- Phase 4 marked complete in STATE.md + ROADMAP.md
</success_criteria>

<output>
Create `.planning/phases/04-pipeline-skeleton/04-12-smoke-test-SUMMARY.md` recording:
- The Railway URL of the deployed pipeline
- The 3 test runIds (success, failure, interrupt/resume) — for future reference
- Confirmation per requirement (PIP-01 through OPS-03) with the specific evidence
- Any environmental gotchas Andrew hit (e.g., "had to retry railway up after first SUPABASE_POSTGRES_URL had the wrong region in the pooler host")
- The Sanity Studio screenshot URL or note confirming pipelineMetadata.cost renders (OPS-03)
- Andrew's approval signature + date
- Phase 4 ROADMAP status update: "Complete" with completion date
</output>
