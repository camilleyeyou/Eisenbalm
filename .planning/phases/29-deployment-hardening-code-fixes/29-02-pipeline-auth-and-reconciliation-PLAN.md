---
phase: 29-deployment-hardening-code-fixes
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/pipeline/pyproject.toml
  - packages/pipeline/src/eisenbalm_pipeline/api/auth.py
  - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
  - packages/pipeline/src/eisenbalm_pipeline/api/control.py
  - packages/pipeline/src/eisenbalm_pipeline/api/agents.py
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
  - packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py
  - packages/pipeline/tests/api/test_fail_closed.py
  - packages/pipeline/tests/api/test_reconciliation.py
  - packages/pipeline/tests/api/test_runs.py
autonomous: true
requirements: [D-2, D-3, D-4, D-5]
must_haves:
  truths:
    - "In a deployed environment (RAILWAY_ENVIRONMENT_NAME set) with a required auth secret unset, the pipeline fails closed instead of granting a local-dev-operator sentinel"
    - "In local dev (no RAILWAY_ENVIRONMENT_NAME) the existing convenience/fail-open dev behavior is unchanged"
    - "The trigger-secret comparison uses hmac.compare_digest, not != "
    - "On process startup, any Convex run stuck in 'running' with no live in-process task is marked terminal so the one-at-a-time gate cannot deadlock"
    - "PyJWT and requests are declared directly in pyproject.toml dependencies"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py"
      provides: "reconcile_orphaned_runs() startup sweep"
      contains: "reconcile_orphaned_runs"
    - path: "packages/pipeline/tests/api/test_fail_closed.py"
      provides: "RAILWAY_ENVIRONMENT_NAME-gated hard-fail coverage"
    - path: "packages/pipeline/tests/api/test_reconciliation.py"
      provides: "orphaned-run sweep coverage"
  key_links:
    - from: "api/main.py lifespan"
      to: "reconcile_orphaned_runs"
      via: "called after convex_client.set_client, before yield, clean-boot path only"
      pattern: "reconcile_orphaned_runs"
    - from: "api/main.py lifespan"
      to: "PIPELINE_TRIGGER_SECRET + CLERK_JWT_ISSUER_DOMAIN"
      via: "boot-time assertion when RAILWAY_ENVIRONMENT_NAME present"
      pattern: "RAILWAY_ENVIRONMENT_NAME"
---

<objective>
Harden the pipeline runtime for deployment: (D-2) auth guards must FAIL CLOSED in a deployed env when their secret is unset (they currently degrade open with a `local-dev-operator` sentinel); (D-3) the trigger-secret compare must be constant-time; (D-4) a startup sweep must unstick Convex runs orphaned by a Railway restart so the one-at-a-time gate can never deadlock; (D-5) declare the `PyJWT`/`requests` deps that `api/auth.py` imports.

Purpose: a misconfigured deployed pipeline refuses traffic instead of opening the door, timing side-channels are removed, and a mid-run restart cannot permanently block all future runs.
Output: fail-closed auth, constant-time compare, a reconciliation sweep in the lifespan, declared deps, and unit tests for each.

Follow 29-RESEARCH.md § "Pipeline FastAPI Fail-Closed Auth" and § "Pipeline Restart Reconciliation" exactly. The deployment marker is `RAILWAY_ENVIRONMENT_NAME` (NOT `RAILWAY_ENVIRONMENT` — the CONTEXT's literal guess is wrong).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/29-deployment-hardening-code-fixes/29-RESEARCH.md

<interfaces>
Three fail-open sites to harden (all follow the identical "unset → return sentinel" idiom):
- api/auth.py::require_clerk_jwt — `if not os.environ.get("CLERK_JWT_ISSUER_DOMAIN"): return {"sub":"local-dev-operator"}`
- api/control.py::_require_clerk_jwt_control — near-duplicate, same env var + sentinel
- api/runs.py::_require_trigger_secret (~line 131-146) — `if not expected: log.warning(...); return`
- api/agents.py — same CLERK_JWT_ISSUER_DOMAIN sentinel branch (~line 67)

Constant-time compare (D-3), current runs.py ~line 146:
```python
provided = request.headers.get("X-Pipeline-Trigger-Secret")
if not provided or provided != expected:      # BEFORE
    raise HTTPException(...)
# AFTER (keep the falsy-check FIRST — compare_digest raises TypeError on None):
import hmac
if not provided or not hmac.compare_digest(provided, expected):
    raise HTTPException(...)
```

Reconciliation (D-4): a run executes as `asyncio.create_task(_execute_run(...))` strong-ref'd in `app.state.background_tasks` (rebuilt empty every boot). Any Convex run `status == "running"` at boot is by definition orphaned (single-process architecture). Reuse the EXISTING termination mutations already used by the RunCancelled/CostCapExceeded path in `_execute_run`: `runs:updateStatus` (status "failed" + completedAt) and `pipelineRuns:updateStatus` (status "failed" + errorMessage). Read orphans via the existing `runs:listForWorkspace` query (no status filter — filter in Python). No new Convex schema/function.

Lifespan (api/main.py): clean-boot path builds pool/graph/clients then registers `convex_client.set_client(convex_http)`; degraded path leaves graph None. Boot-time assertion + reconcile sweep both belong on the CLEAN-boot path, after set_client, before `yield`. Do NOT run the sweep in the degraded branch.
</interfaces>

Note: this plan and Plan 01 both edit `packages/pipeline/.env.example`? No — Plan 01 adds the Convex secret var; this plan does NOT touch `.env.example`. The D-6/D-13 pipeline env-doc edits are in Plan 05.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Declare deps (D-5) + fail-closed auth (D-2) + constant-time compare (D-3)</name>
  <files>packages/pipeline/pyproject.toml, packages/pipeline/src/eisenbalm_pipeline/api/auth.py, packages/pipeline/src/eisenbalm_pipeline/api/control.py, packages/pipeline/src/eisenbalm_pipeline/api/agents.py, packages/pipeline/src/eisenbalm_pipeline/api/runs.py</files>
  <read_first>
    - packages/pipeline/pyproject.toml (dependencies list, ~lines 7-23)
    - packages/pipeline/src/eisenbalm_pipeline/api/auth.py (require_clerk_jwt sentinel)
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (_require_clerk_jwt_control)
    - packages/pipeline/src/eisenbalm_pipeline/api/agents.py (CLERK_JWT_ISSUER_DOMAIN branch)
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py (_require_trigger_secret ~line 131)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py (reference fail-closed tone)
  </read_first>
  <action>
    1. (D-5) Add `"pyjwt>=2.8.0"` and `"requests>=2.31.0"` to `[project] dependencies` in `packages/pipeline/pyproject.toml` (both are imported directly in api/auth.py, currently only transitive). Run `uv lock` in packages/pipeline. Dropping the dead `supabase` dep is optional — leave it unless trivially clean.
    2. (D-2) Define ONE shared fail-closed helper (e.g. in api/auth.py) `def _deployed() -> bool: return bool(os.environ.get("RAILWAY_ENVIRONMENT_NAME"))`. At each of the three sentinel/skip branches (auth.py::require_clerk_jwt, control.py::_require_clerk_jwt_control, agents.py's CLERK branch, runs.py::_require_trigger_secret), wrap the existing "secret unset → sentinel/skip" branch so that when `_deployed()` is true it instead `raise HTTPException(status_code=500, detail="<SECRET_VAR> must be set in a deployed environment")`. Local dev (marker absent) keeps the current sentinel/skip behavior byte-for-byte.
    3. (D-2, primary) Add a boot-time assertion in api/main.py lifespan (Task 3 of this plan wires main.py; put the assertion helper here and call it from main.py): when `_deployed()` is true, require BOTH `PIPELINE_TRIGGER_SECRET` and `CLERK_JWT_ISSUER_DOMAIN` to be non-empty, else raise a fatal error that prevents a healthy boot (mirror the existing `assert_tables_exist` fail-fast). (The actual call is added in Task 3; expose it here as `assert_deployed_secrets()`.)
    4. (D-3) In runs.py::_require_trigger_secret, replace `provided != expected` with `not hmac.compare_digest(provided, expected)`, keeping the `if not provided or ...` falsy-guard FIRST. Add `import hmac` at module top.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "import jwt, requests" && uv run pytest -q tests/api/test_clerk_auth.py tests/api/test_runs.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "pyjwt" packages/pipeline/pyproject.toml` && `grep -q "requests" packages/pipeline/pyproject.toml`
    - `cd packages/pipeline && uv run python -c "import jwt, requests"` exits 0
    - `grep -q "RAILWAY_ENVIRONMENT_NAME" packages/pipeline/src/eisenbalm_pipeline/api/auth.py`
    - `grep -q "compare_digest" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` and `grep -c "provided != expected" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` == 0
    - `grep -q "assert_deployed_secrets" packages/pipeline/src/eisenbalm_pipeline/api/auth.py`
    - Existing dev-mode tests still pass: `cd packages/pipeline && uv run pytest -q tests/api/test_clerk_auth.py tests/api/test_runs.py` exits 0
  </acceptance_criteria>
  <done>Deps are declared; deployed-env auth fails closed; trigger-secret compare is constant-time; existing dev-mode tests stay green.</done>
</task>

<task type="auto">
  <name>Task 2: Restart reconciliation sweep (D-4) + wire into lifespan</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py, packages/pipeline/src/eisenbalm_pipeline/api/main.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py (lifespan clean-boot block + degraded branch)
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py (_execute_run termination path — the exact updateStatus mutation calls to reuse)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (convex_query / convex_mutation)
    - convex/runs.ts (listForWorkspace — returns every row, no status filter) and convex/pipelineRuns.ts (updateStatus)
  </read_first>
  <action>
    Create `packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py` exporting `async def reconcile_orphaned_runs(convex_http) -> int`:
    - Query `runs:listForWorkspace` (use the pipeline workspace id constant already used elsewhere) via `convex_query`.
    - For each row with `status == "running"`, call `runs:updateStatus` with `{status:"failed", completedAt: <now ms>}` and `pipelineRuns:updateStatus` with `{status:"failed", errorMessage:"Orphaned by service restart — no live task after reboot", completedAt:<now ms>}` — the SAME mutation pair the RunCancelled path already uses. Because these are now secret-guarded (Plan 01), rely on `convex_client.convex_mutation`'s central `pipelineSecret` injection (no extra arg needed here).
    - Return the count of reconciled runs; wrap the whole sweep so a Convex failure logs a warning and returns 0 (never crash boot).
    Wire into api/main.py lifespan on the CLEAN-boot path only, AFTER `convex_client.set_client(convex_http)` and BEFORE `yield`: `await reconcile_orphaned_runs(convex_http)` inside the try block (so it degrades with the rest of lifespan). Also call `assert_deployed_secrets()` (from Task 1) at the top of the clean-boot try block so a misconfigured deployed process never reaches a healthy state.
    Do NOT add checkpointer resume (explicitly deferred).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest -q tests/api/test_reconciliation.py</automated>
  </verify>
  <acceptance_criteria>
    - `test -f packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py` && `grep -q "reconcile_orphaned_runs" packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py`
    - `grep -q "reconcile_orphaned_runs" packages/pipeline/src/eisenbalm_pipeline/api/main.py` (wired into lifespan)
    - `grep -q "assert_deployed_secrets" packages/pipeline/src/eisenbalm_pipeline/api/main.py`
    - reconcile.py reuses `runs:listForWorkspace` + `runs:updateStatus` + `pipelineRuns:updateStatus` (`grep -q "listForWorkspace" packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py`)
    - No new Convex function/schema referenced (`grep -c "internalMutation\|schema" packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py` == 0)
    - `cd packages/pipeline && uv run pytest -q tests/api/test_reconciliation.py` exits 0
  </acceptance_criteria>
  <done>A startup sweep marks orphaned 'running' runs terminal via existing mutations; lifespan calls it on clean boot; no gate deadlock survives a restart.</done>
</task>

<task type="auto">
  <name>Task 3: Unit tests for fail-closed auth, constant-time compare, and reconciliation</name>
  <files>packages/pipeline/tests/api/test_fail_closed.py, packages/pipeline/tests/api/test_reconciliation.py, packages/pipeline/tests/api/test_runs.py</files>
  <read_first>
    - packages/pipeline/tests/api/test_clerk_auth.py (existing dev-mode / cron-secret tests — the regression baseline; monkeypatch patterns)
    - packages/pipeline/tests/api/test_runs.py (existing trigger-secret tests)
    - packages/pipeline/src/eisenbalm_pipeline/api/reconcile.py (from Task 2)
  </read_first>
  <action>
    1. Create `packages/pipeline/tests/api/test_fail_closed.py`:
       - With `monkeypatch.setenv("RAILWAY_ENVIRONMENT_NAME","production")` and `monkeypatch.delenv("PIPELINE_TRIGGER_SECRET", raising=False)` → assert the trigger-secret guard / `assert_deployed_secrets()` raises (does NOT return the sentinel / does NOT skip).
       - Same with `CLERK_JWT_ISSUER_DOMAIN` unset → `require_clerk_jwt` / `assert_deployed_secrets()` raises.
       - Regression: WITHOUT `RAILWAY_ENVIRONMENT_NAME`, both unset → existing sentinel/skip behavior preserved (returns `{"sub":"local-dev-operator"}` / skips).
    2. Add a D-3 correctness case to `packages/pipeline/tests/api/test_runs.py` (or test_fail_closed.py): with `PIPELINE_TRIGGER_SECRET` set, a wrong `X-Pipeline-Trigger-Secret` is rejected (401) and the correct one is accepted — proves the compare_digest swap preserves behavior.
    3. Create `packages/pipeline/tests/api/test_reconciliation.py`: mock `convex_query` to return a mix of statuses (`running`, `complete`, `failed`) and assert `reconcile_orphaned_runs` issues `updateStatus`→`failed` calls for ONLY the `running` rows (assert the mocked `convex_mutation` was called with the right paths/args and NOT for non-running rows).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest -q</automated>
  </verify>
  <acceptance_criteria>
    - `test -f packages/pipeline/tests/api/test_fail_closed.py` && `test -f packages/pipeline/tests/api/test_reconciliation.py`
    - `grep -q "RAILWAY_ENVIRONMENT_NAME" packages/pipeline/tests/api/test_fail_closed.py`
    - `cd packages/pipeline && uv run pytest -q tests/api/test_fail_closed.py tests/api/test_reconciliation.py` exits 0
    - Full suite green: `cd packages/pipeline && uv run pytest -q` exits 0 (all prior ~354/387 tests + new ones)
  </acceptance_criteria>
  <done>New pytest coverage proves fail-closed behavior in a deployed env, dev-mode regression, constant-time compare correctness, and the orphaned-run sweep; the full pipeline suite is green.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest -q` green
- `cd packages/pipeline && uv run python -c "import jwt, requests"` exits 0
- grep confirms `compare_digest` in runs.py and `RAILWAY_ENVIRONMENT_NAME` gating in auth.py + main.py
</verification>

<success_criteria>
A Railway-deployed pipeline with a missing required secret refuses to serve; the trigger-secret compare is timing-safe; a restart mid-run cannot permanently block the run gate; and the auth deps are declared. Manual post-deploy check (flagged, not automatable locally): confirm the boot assertion fires on a Railway preview when a secret is deliberately unset.
</success_criteria>

<output>
After completion, create `.planning/phases/29-deployment-hardening-code-fixes/29-02-SUMMARY.md`
</output>
