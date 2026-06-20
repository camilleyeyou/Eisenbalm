---
phase: quick-260620-far
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/cli.py
  - packages/pipeline/.env.example
  - packages/pipeline/README.md
autonomous: true
requirements: [V2-03]
must_haves:
  truths:
    - "`python -m eisenbalm_pipeline.cli trigger-weekly` POSTs to {PIPELINE_SELF_URL}/run/weekly with the X-Pipeline-Trigger-Secret header and exits 0 on a 2xx response"
    - "The command exits nonzero with a stderr message on missing secret, non-2xx response, or network error (so Railway marks the cron run as failed)"
    - "The command prints the returned runId on success"
    - "PIPELINE_SELF_URL defaults to https://eisenbalm-pipeline-production.up.railway.app when unset"
    - ".env.example documents PIPELINE_SELF_URL; README documents the separate Railway cron service setup"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/cli.py"
      provides: "trigger-weekly async subcommand registered in _SUBCOMMANDS, listed in USAGE, documented in module docstring"
      contains: "trigger-weekly"
    - path: "packages/pipeline/.env.example"
      provides: "PIPELINE_SELF_URL documented with purpose + default"
      contains: "PIPELINE_SELF_URL"
    - path: "packages/pipeline/README.md"
      provides: "Weekly cron service setup section (separate service, cron 0 14 * * 4, why-separate rationale)"
      contains: "trigger-weekly"
  key_links:
    - from: "cli.py trigger-weekly"
      to: "{PIPELINE_SELF_URL}/run/weekly"
      via: "httpx.AsyncClient POST with X-Pipeline-Trigger-Secret header"
      pattern: "X-Pipeline-Trigger-Secret"
---

<objective>
Add automatic weekly Railway cron triggering for the pipeline (deferred requirement V2-03).

A new `trigger-weekly` CLI subcommand fires an authenticated POST to the pipeline's existing `/run/weekly` endpoint and exits with an appropriate code so a Railway cron service can mark failures. Plus the docs needed to stand up a SEPARATE Railway cron service (the always-on web API must never be converted into a cron job).

Purpose: Enable the Thursday 14:00 UTC weekly trigger without an operator manually curling the endpoint. The cron only FIRES the trigger; the always-on web service runs the actual graph in a background task (the graph pauses at Editor Gate 1 for hours/days — far longer than a cron job should live).
Output: Extended cli.py, documented PIPELINE_SELF_URL in .env.example, and a cron-setup section in README.md.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@packages/pipeline/src/eisenbalm_pipeline/cli.py
@packages/pipeline/.env.example
@packages/pipeline/README.md

<interfaces>
<!-- Existing /run/weekly endpoint contract — from packages/pipeline/src/eisenbalm_pipeline/api/runs.py. DO NOT MODIFY that file. -->

Endpoint (already exists, out of scope to change):
  POST /run/weekly
  - Auth header: X-Pipeline-Trigger-Secret (must equal env PIPELINE_TRIGGER_SECRET)
  - Request body: RunWeeklyBody — all fields optional with defaults; an empty JSON `{}` is valid.
  - Success response: 200 with JSON `{"runId": "<id>"}`

Existing cli.py contract the new subcommand MUST follow:
  - Module docstring lists each subcommand with a one-line description + an "Invocation:" block.
  - USAGE string (printed to stderr on bad args) lists every invocation line.
  - Subcommands are `async def` functions registered in the `_SUBCOMMANDS: dict[str, Callable]` map.
  - `main()` does: `asyncio.run(_SUBCOMMANDS[sys.argv[1]]())` — so the new func is `async def` taking no args.
  - Existing failure helper pattern: print to `sys.stderr` then `sys.exit(<nonzero>)` (see `_require_postgres_url` → exit 2).
  - `httpx` is already a pipeline dependency.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add trigger-weekly subcommand to cli.py</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/cli.py</files>
  <action>
Add a new `async def trigger_weekly() -> None` subcommand that fires the weekly run, following the EXISTING cli.py pattern exactly (do not restructure existing subcommands).

Implementation:
1. Add `import httpx` to the imports block (alongside `psycopg`).
2. Add a module constant for the production default base URL:
   `DEFAULT_PIPELINE_SELF_URL = "https://eisenbalm-pipeline-production.up.railway.app"`
3. Write `async def trigger_weekly() -> None`:
   - Read the secret: `secret = os.environ.get("PIPELINE_TRIGGER_SECRET")`. If falsy, print to stderr a clear message (e.g. `"ERROR: PIPELINE_TRIGGER_SECRET is not set — cannot authenticate /run/weekly."`) and `sys.exit(2)`. (The endpoint skips the check when its own secret is unset, but the cron MUST send the header; refusing to run without a secret is the safe behavior.)
   - Resolve base URL: `base_url = os.environ.get("PIPELINE_SELF_URL", DEFAULT_PIPELINE_SELF_URL).rstrip("/")`.
   - `url = f"{base_url}/run/weekly"`.
   - POST with httpx in a try/except so ANY failure exits nonzero:
     ```python
     try:
         async with httpx.AsyncClient(timeout=30.0) as client:
             resp = await client.post(
                 url,
                 headers={"X-Pipeline-Trigger-Secret": secret},
                 json={},
             )
             resp.raise_for_status()
     except httpx.HTTPStatusError as exc:
         print(
             f"ERROR: POST {url} returned {exc.response.status_code}: "
             f"{exc.response.text[:500]}",
             file=sys.stderr,
         )
         sys.exit(1)
     except httpx.HTTPError as exc:
         print(f"ERROR: request to {url} failed: {exc}", file=sys.stderr)
         sys.exit(1)
     run_id = resp.json().get("runId")
     print(f"Triggered weekly run: runId={run_id}")
     ```
   - Use `raise_for_status()` so any non-2xx becomes a nonzero exit (Railway marks the cron run failed). Network errors (DNS, connect, timeout) subclass `httpx.HTTPError` and also exit nonzero.
4. Register in `_SUBCOMMANDS`: add `"trigger-weekly": trigger_weekly,`.
5. Extend the `USAGE` string with the new invocation line:
   `"  python -m eisenbalm_pipeline.cli trigger-weekly"`.
6. Update the module docstring:
   - Add a `trigger-weekly` entry under "Subcommands:" describing it (POSTs to {PIPELINE_SELF_URL}/run/weekly with the X-Pipeline-Trigger-Secret header; exits 0 on success / nonzero on failure so a Railway cron service marks failed runs; reads PIPELINE_TRIGGER_SECRET + PIPELINE_SELF_URL from env; implements V2-03).
   - Add its invocation line under "Invocation:".
   - Note under "Used by:" that it is run by a SEPARATE Railway cron service (schedule `0 14 * * 4`), NOT by the always-on web service.

Do NOT touch the existing setup-checkpointer / setup-webhook-idempotency functions, the Postgres helper, or main().
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -m eisenbalm_pipeline.cli 2>&1 | grep -q "trigger-weekly" && uv run python -c "import ast,sys; t=ast.parse(open('src/eisenbalm_pipeline/cli.py').read()); names={n.name for n in ast.walk(t) if isinstance(n,(ast.AsyncFunctionDef,ast.FunctionDef))}; assert 'trigger_weekly' in names, names; print('OK')"</automated>
  </verify>
  <done>Running `python -m eisenbalm_pipeline.cli` with no args prints USAGE including the `trigger-weekly` line; `trigger_weekly` is an async def registered in `_SUBCOMMANDS`; the module imports successfully; existing subcommands are untouched.</done>
</task>

<task type="auto">
  <name>Task 2: Document PIPELINE_SELF_URL and the weekly cron service</name>
  <files>packages/pipeline/.env.example, packages/pipeline/README.md</files>
  <action>
Two documentation edits. Do NOT modify railway.toml (adding cronSchedule there would convert the always-on web service into a cron job and break the API).

(A) packages/pipeline/.env.example — add `PIPELINE_SELF_URL` near the existing `PIPELINE_TRIGGER_SECRET` block (around line 39-41). Add an explanatory comment covering: its purpose (base URL the `trigger-weekly` CLI subcommand POSTs to), the default when unset (`https://eisenbalm-pipeline-production.up.railway.app`), that it is read ONLY by the `trigger-weekly` subcommand (the Railway cron service), and that the always-on web service does not need it. Example:
```
# Base URL the `trigger-weekly` CLI subcommand POSTs to (its /run/weekly).
# Read ONLY by `python -m eisenbalm_pipeline.cli trigger-weekly` — i.e. the
# SEPARATE Railway weekly-cron service, not the always-on web API.
# Defaults to the production Railway domain when unset.
PIPELINE_SELF_URL=https://eisenbalm-pipeline-production.up.railway.app
```

(B) packages/pipeline/README.md — add a new section documenting the weekly cron setup. Place it after the "Deployment (manual — Andrew runs these)" section (after its `railway run ... setup-checkpointer` block near line 185, before "### Build & runtime config"), OR as a clearly-titled `## Weekly cron trigger (V2-03)` section — pick whichever keeps the doc readable. The section MUST cover:
  - WHAT: a separate Railway service (not the web API) that runs `python -m eisenbalm_pipeline.cli trigger-weekly` on cron schedule `0 14 * * 4` (Thursday 14:00 UTC).
  - WHY a SEPARATE service: a cron job must start, do its work, and EXIT; the web service must never exit (it serves traffic + runs graphs in background tasks). Putting a `cronSchedule` on the existing web service's railway.toml would convert the always-on API into a cron job and break it — so railway.toml is intentionally left unchanged.
  - WHY the cron only FIRES the trigger (POST /run/weekly) instead of running the graph inline: the pipeline pauses at the Editor Gate 1 human gate for potentially hours or days — far longer than a cron job should live. The always-on web service owns the long-lived background graph execution; the cron is a lightweight fire-and-exit trigger.
  - The env vars the cron service needs: `PIPELINE_TRIGGER_SECRET` (same value the web service validates) and optionally `PIPELINE_SELF_URL` (defaults to the production domain; point it at a staging URL if triggering a non-prod deploy).
  - That standing up the actual Railway cron service is a MANUAL Andrew step (requires Railway auth) — out of scope for this code change — with the rough steps: create a new service in the same Railway project from this repo/Dockerfile, set its start/cron command to `python -m eisenbalm_pipeline.cli trigger-weekly`, set the cron schedule `0 14 * * 4`, and set `PIPELINE_TRIGGER_SECRET` (+ `PIPELINE_SELF_URL` if not prod).

Keep the prose in the README's existing dry, precise voice. Optionally add a row to the existing env-var table for `PIPELINE_SELF_URL` for completeness.
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -q "PIPELINE_SELF_URL" .env.example && grep -q "trigger-weekly" README.md && grep -q "0 14 \* \* 4" README.md && echo OK</automated>
  </verify>
  <done>.env.example documents PIPELINE_SELF_URL with purpose + default; README has a weekly-cron section explaining the separate-service requirement, the `0 14 * * 4` schedule, the fire-and-exit rationale, and the manual Andrew handoff; railway.toml is unchanged.</done>
</task>

</tasks>

<verification>
- `git diff --stat` shows exactly three files changed: cli.py, .env.example, README.md. railway.toml is NOT in the diff.
- `cd packages/pipeline && uv run python -m eisenbalm_pipeline.cli` (no args) exits 1 and prints USAGE including `trigger-weekly`.
- The cli.py module imports cleanly (the ast check in Task 1 confirms `trigger_weekly` exists).
- `api/runs.py` is unchanged (the /run/weekly endpoint is out of scope).
</verification>

<success_criteria>
- New `trigger-weekly` async subcommand POSTs an empty JSON body to `{PIPELINE_SELF_URL or default}/run/weekly` with the `X-Pipeline-Trigger-Secret` header, prints the returned runId on success (exit 0), and exits nonzero with a stderr message on missing secret / non-2xx / network error.
- Subcommand follows the existing cli.py convention (registered in `_SUBCOMMANDS`, listed in USAGE, documented in module docstring).
- `PIPELINE_SELF_URL` is documented in .env.example with purpose + default.
- README documents the separate Railway cron service, the `0 14 * * 4` schedule, why it must be separate, why it only fires the trigger, and the manual Andrew handoff.
- railway.toml is NOT modified.
</success_criteria>

<output>
After completion, create `.planning/quick/260620-far-add-automatic-weekly-railway-cron-trigge/260620-far-SUMMARY.md`
</output>
