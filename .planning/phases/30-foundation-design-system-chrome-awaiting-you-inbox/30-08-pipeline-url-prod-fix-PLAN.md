---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 08
type: execute
wave: 4
depends_on: ["30-05"]
files_modified:
  - apps/dispatch-control/DEPLOY.md
autonomous: false
requirements: [CHR-05]
must_haves:
  truths:
    - "The deployed dashboard reaches the pipeline API in production — the test-run panel works live, no CORS error, no 'NEXT_PUBLIC_PIPELINE_URL is not set' error"
  artifacts:
    - path: "apps/dispatch-control/DEPLOY.md"
      provides: "A dated 'verified live' checklist entry for the CHR-05 two-sided fix"
      contains: "NEXT_PUBLIC_PIPELINE_URL"
  key_links:
    - from: "deployed dispatch-control (Vercel) test-run panel"
      to: "Railway pipeline /agents/{key}/test-run"
      via: "NEXT_PUBLIC_PIPELINE_URL + DASHBOARD_ALLOWED_ORIGINS CORS allowlist"
      pattern: "DASHBOARD_ALLOWED_ORIGINS"
---

<objective>
Close CHR-05: verify the deployed dashboard reaches the Railway pipeline API in production. Per RESEARCH Pattern 4, this fix is already fully documented in `apps/dispatch-control/DEPLOY.md` and requires no new code — the client files already throw a clear error when `NEXT_PUBLIC_PIPELINE_URL` is unset, and the FastAPI `CORSMiddleware` already reads `DASHBOARD_ALLOWED_ORIGINS`. This phase's job is a human checkpoint (Andrew sets the two env vars) plus verifying the test-run panel works end-to-end in production, then recording it.

Purpose: The existing test-run/control/review/score clients are dead in production until both env vars are set (D-14). This is the milestone's foundational ops fix.
Output: Vercel + Railway env vars set (human); a verified live test-run; a dated DEPLOY.md note.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-RESEARCH.md
@apps/dispatch-control/DEPLOY.md
</context>

<interfaces>
<!-- RESEARCH Pattern 4 — the fix is two-sided and already documented:
  Dashboard (Vercel, dispatch-control project): set NEXT_PUBLIC_PIPELINE_URL = live Railway pipeline URL.
    All 4 clients (lib/testRunClient.ts, pipelineControlClient.ts, reviewClient.ts, scoreClient.ts) share pipelineBaseUrl() which throws if unset.
  Pipeline (Railway, pipeline service): set DASHBOARD_ALLOWED_ORIGINS = dispatch-control production origin (comma-separated if multiple).
    Read at packages/pipeline/src/eisenbalm_pipeline/api/main.py:171-184; allow_credentials=True forbids wildcard "*" — must be an explicit origin.
  The test-run panel now lives at /prompt-lab/{agentKey} after the Plan 30-02 rename.
-->
</interfaces>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1: Andrew sets the two production env vars (Vercel + Railway)</name>
  <read_first>
    - apps/dispatch-control/DEPLOY.md (the documented CHR-05 two-sided fix)
  </read_first>
  <what-built>
    The dashboard's 4 pipeline clients and the FastAPI CORS middleware are already coded to read these two env vars; only the deployed values are missing. No code change is required.
  </what-built>
  <action>
    Andrew (human) sets two production environment variables, then exercises the live test-run panel to confirm the dashboard reaches the pipeline API. Claude cannot set Vercel/Railway env vars or drive the production deployment — this is the D-14 human checkpoint. The exact variables, values, and verification steps are in how-to-verify below.
  </action>
  <how-to-verify>
    1. In the Vercel `dispatch-control` project → Settings → Environment Variables, set `NEXT_PUBLIC_PIPELINE_URL` to the live Railway pipeline base URL (e.g. `https://<pipeline>.up.railway.app`). Redeploy the dashboard so the new value is baked into the client bundle.
    2. In the Railway pipeline service → Variables, set `DASHBOARD_ALLOWED_ORIGINS` to the dispatch-control production origin (e.g. `https://<dispatch-control>.vercel.app`) — exact origin, no trailing slash, no wildcard. Redeploy the pipeline service.
    3. Open the deployed dashboard, navigate via the nav to Prompt Lab → an agent → the test-run panel (`/prompt-lab/{agentKey}`), and run a test-run against sample input.
    4. Confirm in the browser devtools console: NO CORS error and NO "NEXT_PUBLIC_PIPELINE_URL is not set" thrown error; the test-run returns output + cost.
  </how-to-verify>
  <verify>
    <automated>MISSING — production verification is human-only (Vercel env + Railway CORS are prod-only, not automatable per RESEARCH Environment Availability)</automated>
  </verify>
  <acceptance_criteria>
    - Andrew confirms the deployed test-run panel returns output with no CORS error and no unset-URL error
  </acceptance_criteria>
  <resume-signal>Type "verified" once the test-run succeeds live, or paste the console error if it fails.</resume-signal>
  <done>Both production env vars are set and the live test-run panel reaches the pipeline API.</done>
</task>

<task type="auto">
  <name>Task 2: Record the verified-live result in DEPLOY.md</name>
  <read_first>
    - apps/dispatch-control/DEPLOY.md (existing CHR-05 documentation to append to)
  </read_first>
  <files>apps/dispatch-control/DEPLOY.md</files>
  <action>
    Append a checklist entry to the CHR-05 section of `DEPLOY.md` recording that `NEXT_PUBLIC_PIPELINE_URL` (Vercel dashboard project) and `DASHBOARD_ALLOWED_ORIGINS` (Railway pipeline service) are set and that the production test-run panel was verified working on the date of the checkpoint. If the checkpoint surfaced any issue (e.g. CORS origin mismatch), document the exact values used and the resolution. Keep the existing documentation intact — append, do not rewrite.
  </action>
  <verify>
    <automated>grep -q "NEXT_PUBLIC_PIPELINE_URL" apps/dispatch-control/DEPLOY.md && grep -q "DASHBOARD_ALLOWED_ORIGINS" apps/dispatch-control/DEPLOY.md</automated>
  </verify>
  <acceptance_criteria>
    - DEPLOY.md contains a dated "verified live" entry referencing both `NEXT_PUBLIC_PIPELINE_URL` and `DASHBOARD_ALLOWED_ORIGINS`
    - The existing DEPLOY.md content is preserved (append-only)
  </acceptance_criteria>
  <done>DEPLOY.md records the verified-live CHR-05 fix with the date and env-var values.</done>
</task>

</tasks>

<verification>
- Human confirms the deployed test-run panel reaches the pipeline API with no CORS / unset-URL error
- DEPLOY.md updated with the dated verification
</verification>

<success_criteria>
CHR-05: the deployed dashboard reaches the pipeline API; the test-run panel is functional in production; the fix is recorded.
</success_criteria>

<output>
After completion, create `.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-08-SUMMARY.md`
</output>
