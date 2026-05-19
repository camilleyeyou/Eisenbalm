---
phase: 06-pdf-generation-webhook-chain
plan: 08
type: execute
wave: 3
depends_on:
  - 02
  - 03
  - 07
files_modified:
  - packages/pipeline/README.md
  - packages/pipeline/tests/test_pipeline_real_mode.py
autonomous: false
requirements_addressed:
  - PDF-01
  - PDF-02
  - PDF-03
  - PDF-04
  - WHK-01
  - WHK-02
  - WHK-03
  - WHK-04
  - WHK-05
  - WHK-06
  - WHK-07
  - WHK-08

must_haves:
  truths:
    - "packages/pipeline/README.md documents the Phase 6 surface: webhook URL, signature algorithm, deployment env vars, manual fallback usage, expected timings"
    - "An opt-in real-mode integration test exercises the Publisher coroutine against the latest Phase 5 draft (Sanity dev dataset) and confirms problemPdf is populated"
    - "Andrew can run the 6-step smoke (Sanity webhook config + first real publish + PDF download + manual fallback re-fire) following the README"
    - "Andrew confirms PDF-04: the /issue/[slug] page on Vercel renders the problemPdf download link AFTER the webhook chain runs"
  artifacts:
    - path: "packages/pipeline/README.md"
      provides: "Phase 6 onboarding section: env, webhook config, manual fallback, troubleshooting"
    - path: "packages/pipeline/tests/test_pipeline_real_mode.py"
      provides: "Opt-in real-mode test against Phase 5 runId 96ab834e96214671859322044a4b4683 — confirms PDF lands on Sanity"
  key_links:
    - from: "packages/pipeline/README.md"
      to: "Sanity Studio → API → Webhooks dashboard"
      via: "manual config instructions (URL, filter, secret)"
      pattern: "_type == \"weeklyIssue\""
---

<objective>
Close Phase 6 by:
  1. Documenting the Publisher surface in `packages/pipeline/README.md`: what env vars to set, how to configure the Sanity webhook in the Studio dashboard, how to use the manual `/run/{runId}/publish` fallback, what timings to expect.
  2. Adding an opt-in real-mode integration test that exercises `_run_publisher` against the Phase 5 draft (runId `96ab834e96214671859322044a4b4683`, issue 999) and confirms the PDF actually lands on `weeklyIssue.problemPdf`.
  3. Andrew runs the 6-step smoke test from the README on a Sanity dev dataset, confirming PDF-01/02/03/04 + WHK-01/02/05 + WHK-08 work end-to-end against real infrastructure.

Purpose: Phase 5 closed pending verification because Plan 05-15 smoke caught 7 production defects mocks missed; Phase 6 must do the same. The real-mode integration test is the automation; Andrew's smoke is the human-in-the-loop validation that the Sanity webhook actually fires and the PDF actually renders for a reader visiting /issue/[slug].
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md
@.planning/STATE.md
@packages/pipeline/README.md
@packages/pipeline/tests/test_pipeline_real_mode.py
@packages/pipeline/.env.example
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extend packages/pipeline/README.md with Phase 6 section</name>
  <read_first>
    - packages/pipeline/README.md (current Phase 4 onboarding doc)
    - packages/pipeline/.env.example (after Plan 06-03 — has SANITY_WEBHOOK_SECRET + VERCEL_DEPLOY_HOOK_URL)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Environment Availability — what Andrew configures)
  </read_first>
  <files>
    - packages/pipeline/README.md
  </files>
  <action>
APPEND a new top-level section to `packages/pipeline/README.md` titled `## Phase 6 — PDF Generation + Webhook Chain`. Place it AFTER the existing Phase 4/5 sections (the Phase 4 README was Plan 04-11's canonical onboarding doc).

Section content (paste verbatim — adjust the `<your-railway-url>` and `<your-sanity-project>` placeholders to match the real values from `.env.local` if known):

```markdown
## Phase 6 — PDF Generation + Webhook Chain

Phase 6 closes the loop between Andrew publishing in Sanity Studio and a live deployed issue on Vercel:

1. Andrew flips `weeklyIssue.status` from `draft` → `published` in Studio.
2. Sanity fires a webhook to Railway: `POST <RAILWAY_URL>/webhook/sanity-publish`.
3. Pipeline verifies HMAC signature + age + idempotency-key, returns 200 immediately.
4. In the background: GROQ-fetch issue, render Problem Statement PDF with WeasyPrint, upload to Sanity, sleep 30s for CDN propagation, fire Vercel deploy hook.
5. Convex `pipelineRuns.status` → `complete`; `publisher-deploy` event written.
6. Vercel rebuilds the site; reader visiting `/issue/[slug]` sees the new PDF download button.

### Required env vars (Phase 6 additions)

```bash
# Sanity webhook signing secret — see Sanity Studio → API → Webhooks
SANITY_WEBHOOK_SECRET=<32-byte-random>

# Vercel deploy hook URL — see Vercel project → Settings → Git → Deploy Hooks
# CRITICAL: per-environment URLs — staging Railway must NEVER point at the
# production hook (Pitfall 10 in 06-RESEARCH).
VERCEL_DEPLOY_HOOK_URL=https://api.vercel.com/v1/integrations/deploy/<hook-id>
```

The Phase 4/5 env vars are still required (`SUPABASE_POSTGRES_URL`, `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `NEXT_PUBLIC_SANITY_PROJECT_ID`, `SANITY_API_TOKEN`, `OPENROUTER_API_KEY`, `PIPELINE_TRIGGER_SECRET`).

### One-time setup

`railway.toml`'s `preDeployCommand` runs both DDL migrations idempotently on every deploy:

```toml
preDeployCommand = [
  "python -m eisenbalm_pipeline.cli setup-checkpointer",
  "python -m eisenbalm_pipeline.cli setup-webhook-idempotency",
]
```

Local setup mirrors that:

```bash
cd packages/pipeline
uv run python -m eisenbalm_pipeline.cli setup-checkpointer
uv run python -m eisenbalm_pipeline.cli setup-webhook-idempotency
```

### Configuring the Sanity webhook (Andrew, one-time per dataset)

1. In Sanity Studio: **API → Webhooks → Add webhook**.
2. **Name:** `Eisenbalm Publisher` (production) or `Eisenbalm Publisher (dev)` (dev dataset).
3. **URL:** `https://<your-railway-domain>/webhook/sanity-publish`.
4. **Trigger on:** `Create`, `Update` (NOT Delete).
5. **Filter:** `_type == "weeklyIssue" && status == "published"`.
6. **Projection:** `{_id, _type, status, issueNumber, "runId": pipelineMetadata.runId}`.
7. **HTTP method:** `POST`.
8. **HTTP headers:** none required (Sanity automatically sends `sanity-webhook-signature` + `idempotency-key`).
9. **Secret:** generate a 32-byte random string; paste here AND set as `SANITY_WEBHOOK_SECRET` in Railway env.
10. **Save**, then click **"Send test"** — confirm Railway logs show "Webhook scheduled Publisher".

### Manual fallback (WHK-08)

If the Sanity webhook fails to deliver (network blip, secret rotation, etc.):

```bash
curl -X POST \
  -H "X-Pipeline-Trigger-Secret: $PIPELINE_TRIGGER_SECRET" \
  "https://<your-railway-domain>/run/<runId>/publish"
```

`<runId>` is the `pipelineMetadata.runId` field on the Sanity draft. The pipeline looks up the issue via GROQ filter on `pipelineMetadata.runId == $runId` and runs the same Publisher coroutine the webhook does.

### Expected timings

| Step | Duration |
|------|----------|
| Webhook signature verify + idempotency check | < 50ms |
| GROQ fetch issue from Sanity | 100-500ms |
| WeasyPrint render PDF | 1-3 seconds |
| Sanity asset upload + patch | 500ms-2s |
| CDN propagation sleep | 30 seconds (fixed, WHK-05) |
| Vercel deploy hook POST | 200-500ms |
| Convex updateStatus + publisher-deploy | 100-300ms |
| **Total publisher chain wall-clock** | **~35-40 seconds** |
| Vercel build + deploy after hook fires | 1-3 minutes (visible in Vercel dashboard) |

### Troubleshooting

- **401 on every webhook**: SANITY_WEBHOOK_SECRET mismatch between Sanity and Railway. Regenerate in Sanity dashboard; update Railway env.
- **410 on every webhook**: clock skew. Run `date` on Railway and your dev box; if > 5 minutes off, NTP is broken.
- **PDF renders without theme fonts (DejaVu fallback)**: `FontConfiguration` wasn't passed to `write_pdf` (Pitfall 2) OR the requested font family is not vendored. Check `packages/pipeline/fonts/` and `agents/design/font_whitelist.py`.
- **`problemPdf` field is empty after publish**: check Railway logs for "Publisher: PDF uploaded" — if missing, the chain crashed BEFORE upload. Look for the previous log line to identify the crash point.
- **Vercel deploys but old content shows**: CDN propagation took longer than 30s. Manual refresh after another 30s, OR increase `CDN_PROPAGATION_DELAY_SEC` in `agents/publisher/__init__.py`.
- **Manual fallback returns 404**: no Sanity issue exists with `pipelineMetadata.runId == <runId>`. Either the runId is wrong, or the pipeline never wrote the draft (Phase 4 contract). Inspect Sanity Studio directly.

### Phase 6 dependencies on Phase 5 carryovers

Phase 5 closed with a known TODO: `langchain-openai` `with_structured_output` does not surface `usage_metadata`, so per-run cost readings are $0 even on real runs. This is NOT blocking for Phase 6 (cost tracking is an ops concern, not a publishing concern), but the carryover stays on the Phase 6 sprint board — see STATE.md Blockers section "[Phase 6 carryover] Fix langchain-openai cost-metadata capture."
```
  </action>
  <verify>
    <automated>grep -c "Phase 6 — PDF Generation + Webhook Chain" packages/pipeline/README.md && grep -c "SANITY_WEBHOOK_SECRET" packages/pipeline/README.md && grep -c "VERCEL_DEPLOY_HOOK_URL" packages/pipeline/README.md && grep -c "/run/<runId>/publish" packages/pipeline/README.md && grep -c "setup-webhook-idempotency" packages/pipeline/README.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "Phase 6 — PDF Generation + Webhook Chain" packages/pipeline/README.md` returns `1`
    - `grep -c "SANITY_WEBHOOK_SECRET" packages/pipeline/README.md` returns at least `2`
    - `grep -c "VERCEL_DEPLOY_HOOK_URL" packages/pipeline/README.md` returns at least `2`
    - `grep -c "setup-webhook-idempotency" packages/pipeline/README.md` returns at least `1`
    - `grep -c "manual fallback" packages/pipeline/README.md` returns at least `1`
    - `grep -c "Troubleshooting" packages/pipeline/README.md` returns at least `1`
    - Phase 4 / Phase 5 sections still present (no overwrite): `grep -c "Phase 4" packages/pipeline/README.md` returns at least `1`
  </acceptance_criteria>
  <done>
    README has a complete Phase 6 onboarding section: env vars, one-time setup, Sanity webhook config steps, manual fallback usage, expected timings, troubleshooting matrix.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add opt-in real-mode integration test exercising _run_publisher against Phase 5's runId</name>
  <read_first>
    - packages/pipeline/tests/test_pipeline_real_mode.py (current Phase 5 real-mode tests — pytest.mark.skipif on env)
    - .planning/STATE.md (Phase 5 First-Real-Run Cost Baseline — runId 96ab834e96214671859322044a4b4683, issue 999)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Validation Architecture — real-mode tests)
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py (after Plan 06-07 — _run_publisher + QUERY_ISSUE_BY_RUN_ID)
  </read_first>
  <files>
    - packages/pipeline/tests/test_pipeline_real_mode.py
  </files>
  <action>
APPEND a new test function to `packages/pipeline/tests/test_pipeline_real_mode.py` (do not modify existing tests). The test is OPT-IN — it skips unless explicitly enabled via `PHASE6_REAL_MODE=true`.

```python
# ── Phase 6: real-mode Publisher integration test ────────────────────────


@pytest.mark.skipif(
    os.environ.get("PHASE6_REAL_MODE", "").lower() != "true",
    reason="Phase 6 real-mode test — set PHASE6_REAL_MODE=true to enable",
)
@pytest.mark.asyncio
async def test_phase_6_publisher_against_phase_5_draft():
    """Real-mode end-to-end Publisher test (opt-in).

    Runs the Publisher coroutine against the existing Phase 5 draft on Sanity
    (runId 96ab834e96214671859322044a4b4683, issue 999) WITHOUT firing the
    Sanity webhook. Confirms:
      - PDF generation succeeds against real Sanity data
      - upload_pdf_to_issue actually writes to Sanity
      - weeklyIssue.problemPdf.asset is populated after the run

    The Convex update + Vercel deploy hook are skipped (mocked) so the test
    does NOT trigger an actual production deploy.

    Run with:
        PHASE6_REAL_MODE=true \\
        SUPABASE_POSTGRES_URL=... \\
        NEXT_PUBLIC_SANITY_PROJECT_ID=... \\
        SANITY_API_TOKEN=... \\
        uv run pytest tests/test_pipeline_real_mode.py::test_phase_6_publisher_against_phase_5_draft -xvs
    """
    from unittest.mock import AsyncMock, MagicMock

    import httpx

    from eisenbalm_pipeline.agents.publisher import _run_publisher
    from eisenbalm_pipeline.lib.sanity_client import groq_query, set_client

    # Phase 5 baseline run — captured in STATE.md "Phase 5 First-Real-Run".
    RUN_ID = "96ab834e96214671859322044a4b4683"
    ISSUE_NUMBER = 999
    ISSUE_ID = f"issue-{ISSUE_NUMBER}"

    project = os.environ["NEXT_PUBLIC_SANITY_PROJECT_ID"]
    sanity_http = httpx.AsyncClient(
        base_url=f"https://{project}.api.sanity.io", timeout=30.0
    )
    set_client(sanity_http)

    # Confirm the draft exists in Sanity before running Publisher.
    pre_check = await groq_query(
        '*[_type == "weeklyIssue" && _id == $id][0]{_id, issueNumber, "hasPdfContent": defined(problemStatement.pdfContent)}',
        params={"id": ISSUE_ID},
    )
    if not pre_check or (isinstance(pre_check, list) and not pre_check):
        pytest.skip(f"Phase 5 baseline draft {ISSUE_ID} not on this Sanity dataset")

    # Build a mock app with only the attributes _run_publisher reads.
    app = MagicMock()
    app.state = MagicMock()
    app.state.pool = None
    app.state.background_tasks = set()
    app.state.convex_http = MagicMock(spec=httpx.AsyncClient)

    try:
        # Patch the slow + deploy-triggering pieces.
        import eisenbalm_pipeline.agents.publisher as pub_mod
        original_sleep = pub_mod.asyncio.sleep
        original_vercel = pub_mod.trigger_vercel_deploy
        original_convex = pub_mod.convex_mutation_safe
        pub_mod.asyncio.sleep = AsyncMock(return_value=None)
        pub_mod.trigger_vercel_deploy = AsyncMock(return_value={"job": {"id": "test", "state": "READY", "createdAt": 1}})
        pub_mod.convex_mutation_safe = AsyncMock(return_value={"status": "success"})

        try:
            await _run_publisher(app, issue_id=ISSUE_ID, issue_number=ISSUE_NUMBER, run_id=RUN_ID)
        finally:
            pub_mod.asyncio.sleep = original_sleep
            pub_mod.trigger_vercel_deploy = original_vercel
            pub_mod.convex_mutation_safe = original_convex

        # Verify the Sanity write actually happened: query the issue back and
        # check problemPdf.asset is populated.
        post_check = await groq_query(
            '*[_type == "weeklyIssue" && _id == $id][0]{"hasAsset": defined(problemPdf.asset)}',
            params={"id": ISSUE_ID},
        )
        post = post_check[0] if isinstance(post_check, list) and post_check else post_check
        assert post and post.get("hasAsset") is True, (
            f"weeklyIssue.problemPdf.asset is NOT populated after Publisher run; "
            f"post-check result: {post_check}"
        )
    finally:
        await sanity_http.aclose()
```

Then verify the test is discovered (it should skip without `PHASE6_REAL_MODE=true`):

```bash
cd packages/pipeline
uv run pytest tests/test_pipeline_real_mode.py::test_phase_6_publisher_against_phase_5_draft 2>&1 | tail -3
# Expected: "1 skipped" with the documented skip reason.
```
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -c "test_phase_6_publisher_against_phase_5_draft" tests/test_pipeline_real_mode.py && grep -c "96ab834e96214671859322044a4b4683" tests/test_pipeline_real_mode.py && grep -c "PHASE6_REAL_MODE" tests/test_pipeline_real_mode.py && uv run pytest tests/test_pipeline_real_mode.py::test_phase_6_publisher_against_phase_5_draft 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "test_phase_6_publisher_against_phase_5_draft" packages/pipeline/tests/test_pipeline_real_mode.py` returns `1`
    - `grep -c "96ab834e96214671859322044a4b4683" packages/pipeline/tests/test_pipeline_real_mode.py` returns at least `1` (Phase 5 baseline runId)
    - `grep -c "PHASE6_REAL_MODE" packages/pipeline/tests/test_pipeline_real_mode.py` returns at least `1`
    - Test skips cleanly without `PHASE6_REAL_MODE=true`: `cd packages/pipeline && uv run pytest tests/test_pipeline_real_mode.py::test_phase_6_publisher_against_phase_5_draft 2>&1 | tail -1` shows `1 skipped`
    - Existing Phase 5 real-mode tests still present (untouched): the previously-existing test functions are still in the file
  </acceptance_criteria>
  <done>
    Real-mode test exists; defaults to skip; opt-in via env var; when run, exercises _run_publisher against the Phase 5 baseline draft.
  </done>
</task>

<task type="checkpoint:human-verify">
  <name>Task 3: Andrew runs the Phase 6 end-to-end smoke test on dev dataset</name>
  <what-built>
    The full Phase 6 surface:
      - WeasyPrint PDF renderer with 4 vendored TTFs + base64 @font-face inline
      - Sanity webhook handler with HMAC verify (corrected algorithm), 5-min age check, idempotency-key dedup
      - 30-second CDN propagation delay before Vercel deploy hook
      - Convex pipelineRuns.status='complete' + publisher-deploy event on success
      - Manual /run/{runId}/publish fallback (single shared coroutine — Pitfall 7)
      - Sanity schema extended with weeklyIssue.problemStatement.pdfContent
      - Documentation in packages/pipeline/README.md
  </what-built>
  <how-to-verify>
After Plan 06-07 deploys to Railway (or local Docker), run the following 6 steps. Each step verifies a specific requirement family. Capture screenshots / curl output for the Phase 6 SUMMARY.

**Step 1 — Configure Sanity webhook (WHK-01) [one-time]:**

1. Sanity Studio → API → Webhooks → Add webhook (or edit existing "Eisenbalm Publisher (dev)").
2. URL: `https://<railway-domain>/webhook/sanity-publish`.
3. Filter: `_type == "weeklyIssue" && status == "published"`.
4. Projection: `{_id, _type, status, issueNumber, "runId": pipelineMetadata.runId}`.
5. Trigger on: Create + Update.
6. Secret: paste the same `SANITY_WEBHOOK_SECRET` you set in Railway env.
7. Save → click **Send test** → expect 200 response in the Sanity Webhook Activity log.

**Step 2 — Publish a draft from Phase 5 (PDF-01 + WHK-01 + WHK-02 + WHK-05 + WHK-07):**

1. Open the existing Phase 5 baseline draft in Studio: `weeklyIssue.issueNumber == 999` (the draft from STATE.md Phase 5 baseline).
2. Click `Edit pdfContent` — verify the three fields render (Plan 06-02 schema patch).
3. If pdfContent is empty (Phase 5 didn't populate before schema patch landed), fill manually with three keyDataPoint entries.
4. Change status `draft` → `published`. Click Publish.
5. Within ~10 seconds: check Railway logs for `Webhook scheduled Publisher: issue_id=issue-999 ... ts_ms=...`.
6. Within ~5 seconds after that: `Publisher: PDF rendered (N bytes)` and `Publisher: PDF uploaded + problemPdf patched on Sanity.`
7. After 30 more seconds: `Publisher: Vercel deploy triggered — {...}` and `Publisher: Convex writes complete (status=complete, publisher-deploy emitted).`
8. **Total elapsed time**: ~35-40 seconds from publish click → Convex complete.

**Step 3 — Verify problemPdf populated on Sanity (PDF-03):**

In Studio, open issue 999 again. Confirm:
- `weeklyIssue.problemPdf` field now contains a file asset.
- Hover the asset; the filename is `dispatch-issue-999-problem-statement.pdf`.
- Click the asset; download the PDF locally.

**Step 4 — Visual PDF verification (PDF-01 + PDF-02):**

Open the downloaded PDF locally. Confirm:
- Headline uses Playfair Display (or whichever font the theme requested) — NOT a system serif fallback.
- Theme colors render (primaryColor for headings, backgroundColor for page, accentColor for accents).
- Three key data points appear with stat + source.
- Intervention mechanism appears in a left-bordered block.
- PDF file is plausibly sized (50KB - 1MB; smaller suggests fonts didn't inline, larger suggests all 17 fonts inlined).
- Inspect with `strings dispatch-issue-999-problem-statement.pdf | head -50` — confirm `fonts.googleapis.com` is NOT present (PDF-02 base64 inline requirement).

**Step 5 — Verify /issue/[slug] PDF download link (PDF-04):**

1. After Vercel finishes rebuilding (1-3 min — watch the Vercel dashboard):
2. Visit `https://<vercel-domain>/issue/issue-999`.
3. Look for the PDF download link in the Problem Statement section.
4. Click it — confirm the same PDF downloads.

**Step 6 — Manual fallback (WHK-08):**

```bash
curl -X POST \
  -H "X-Pipeline-Trigger-Secret: $PIPELINE_TRIGGER_SECRET" \
  "https://<railway-domain>/run/96ab834e96214671859322044a4b4683/publish"
```

Expected response (JSON):
```json
{"runId": "96ab834e96214671859322044a4b4683", "issueId": "issue-999", "issueNumber": 999, "scheduled": true}
```

Watch Railway logs — the SAME Publisher coroutine runs again. After ~35s, the Vercel deploy fires again.

**Bonus — idempotency-key dedup check (WHK-04):**

```bash
# Send the same webhook twice (synthetic, with valid signature)
# This requires the encode_sanity_signature helper from conftest.py — see
# packages/pipeline/tests/conftest.py for the algorithm.
# The second call should respond {"ok": true, "duplicate": true}.
```

If you don't run this manually, the `test_idempotency_dedup` test in
tests/api/test_webhook_sanity.py covers it automatically.

**Bonus — age rejection check (WHK-03):**

```bash
# Send a webhook with a stale signature (timestamp from 10 min ago).
# Expected: 410 Gone.
```

If skipped, `test_age_rejection` covers this automatically.

  </how-to-verify>
  <resume-signal>
Type "approved" and paste:
  1. The Railway log snippet showing the full Publisher chain (start → PDF rendered → uploaded → Vercel deploy → Convex complete).
  2. The Sanity Studio screenshot of issue 999 with problemPdf populated.
  3. The local downloaded PDF (or screenshot of the PDF rendered correctly).
  4. The Vercel dashboard deploy showing the new deploy fired.
  5. The /issue/issue-999 page on Vercel showing the PDF download link working.

If any step fails, describe the failure mode + which log lines you saw — Phase 6 cannot close until the chain works end-to-end on the dev dataset.
  </resume-signal>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_pipeline_real_mode.py 2>&1 | tail -2` — at least one skipped test_phase_6_publisher_against_phase_5_draft when PHASE6_REAL_MODE is unset
- `grep -c "Phase 6 — PDF Generation + Webhook Chain" packages/pipeline/README.md` returns `1`
- Andrew approves the smoke test with logs + screenshots attached to the SUMMARY
</verification>

<success_criteria>
1. packages/pipeline/README.md has a complete Phase 6 section with env vars, setup, webhook config, manual fallback, timings, troubleshooting
2. test_phase_6_publisher_against_phase_5_draft exists and skips cleanly by default
3. Andrew successfully publishes a draft in Sanity and observes the full chain firing within ~40 seconds
4. PDF lands on weeklyIssue.problemPdf; the file is downloadable + visually correct (theme colors + fonts)
5. /issue/[slug] on Vercel shows the PDF download link working
6. Manual fallback POST /run/{runId}/publish triggers the same chain
</success_criteria>

<output>
After completion, create `.planning/phases/06-pdf-generation-webhook-chain/06-pdf-generation-webhook-chain-08-SUMMARY.md` documenting:
  - Andrew's smoke test result (PASS / FAIL on each of the 6 steps)
  - Total elapsed time from publish click → Convex complete (target ~35-40s; record actual)
  - PDF file size + visual fidelity confirmation
  - Any production defects caught (mirror Plan 05-15's fix(05-15) prefix pattern if so)
  - Whether PHASE6_REAL_MODE test was opted-into AND its result (PDF asset populated on Sanity after run)
  - Status of the Phase 5 carryover (langchain-openai cost-metadata) — fixed in Phase 6 or carried to Phase 9
</output>
