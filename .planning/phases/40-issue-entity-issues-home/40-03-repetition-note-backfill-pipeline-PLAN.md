---
phase: 40-issue-entity-issues-home
plan: 03
type: execute
wave: 2
depends_on: ["40-01"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/registry.py
  - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
  - packages/pipeline/scripts/backfill_issues.py
autonomous: true
requirements: [ISS-03, ISS-01]

must_haves:
  truths:
    - "GET /registry/repetition-note returns a deterministic 'avoid X · avoid Y' note derived from the last-8 coverage memory, with no LLM call and no run required"
    - "At run start the pipeline defensively ensures the issues row exists via issues:ensureByNumber, so no trigger path can orphan a run — without resurrecting a Held issue"
    - "A one-shot backfill creates one issues row per distinct existing issueNumber, so Recently Published renders real history"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/registry.py"
      provides: "GET /registry/repetition-note endpoint"
      contains: "repetition-note"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/runs.py"
      provides: "issues:ensureByNumber call inside _start_run"
      contains: "issues:ensureByNumber"
    - path: "packages/pipeline/scripts/backfill_issues.py"
      provides: "D-05 one-shot issues backfill from pipelineRuns + Sanity published state"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/registry.py repetition-note"
      to: "convex charities:listRecentFeatured + Sanity groq_query"
      via: "same join as coverage-strip"
      pattern: "listRecentFeatured"
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/runs.py _start_run"
      to: "convex issues:ensureByNumber"
      via: "convex_mutation after issue-number resolution"
      pattern: "issues:ensureByNumber"
---

<objective>
Build the three pipeline-side pieces of Phase 40: the deterministic repetition-note endpoint (D-10), the defensive `ensureByNumber` call at run start (D-04), and the one-shot issues backfill (D-05).

Purpose: The repetition note must render BEFORE a run exists, so it cannot come from a run — it is the Calibrator's *rule* applied outside a run. The defensive ensure guarantees no trigger path (empty-body `/run/weekly`, a curl, a future cron) can orphan a run. The backfill makes "Recently published" show real history.
Output: `api/registry.py` (+endpoint), `api/runs.py` (+ensure call), `scripts/backfill_issues.py` (new).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@.planning/phases/40-issue-entity-issues-home/40-RESEARCH.md

<interfaces>
§40.4 (repetition-note endpoint) is BINDING — implement its response shape and algorithm verbatim.

Existing precedents to mirror:
- `packages/pipeline/src/eisenbalm_pipeline/api/registry.py` — the WHOLE `GET /registry/coverage-strip` endpoint. The new endpoint is the same file, same router, same `_require_clerk_jwt_control` guard, same `_cc.convex_query(convex_http, "charities:listRecentFeatured", {workspace_id, limit: 8})` + one `_sc.groq_query(..., params={"ids": ids})` join. It differs ONLY in that it computes over-representation and returns `{note, avoid, sampleSize}` instead of raw chip rows.
- `groq_query(query, *, params=None)` — NO positional http/client arg (calibrator.py:70 precedent). A wrong-arity call must fail loudly; the test patches it `autospec=True`.
- `_start_run` in `api/runs.py` — CFG-04 ordering is FIXED (do not reorder): step 1 `_resolve_issue_number`, step 3 `pipelineRuns:create`, step 4 `runs:create`, etc. `convex_mutation` is `_cc.convex_mutation(http, path, args)`; the pipeline secret is injected centrally inside `convex_client.py::convex_mutation`, so callers do NOT pass `pipelineSecret`.
- `scripts/backfill_charity_registry.py` — the standalone-httpx backfill precedent: `_build_convex_client()` reading `NEXT_PUBLIC_CONVEX_URL`, `_build_sanity_client()`, `_fetch_*` with a dry-run fallback when the token is unset, a loop of idempotent mutation calls, `asyncio.run(main())`.
</interfaces>

<naming_trap>
The pipeline's pre-existing `/issues/{run_id}/...` endpoints are runId-keyed and OUT OF SCOPE — do
NOT touch them. This plan touches `api/registry.py` (adds a NEW route), `api/runs.py` (`_start_run`),
and adds a NEW script. It renames nothing.
</naming_trap>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add GET /registry/repetition-note to api/registry.py</name>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/registry.py (the whole file — the coverage-strip endpoint is the template; copy its imports, router, guard, and Convex+Sanity join)
    - docs/API_CONTRACTS.md §40.4 (the exact response shape, REPETITION_THRESHOLD=3, the geo-before-cause sort, the signal-excluded rule, the at-most-2 cap)
    - packages/pipeline/tests/test_repetition_note.py (the RED test from 40-01 — the endpoint must satisfy every case it asserts)
  </read_first>

  <action>
Add a `@router.get("/registry/repetition-note")` async handler to `packages/pipeline/src/eisenbalm_pipeline/api/registry.py`, after the existing `coverage_strip` handler. Reuse the module's `WORKSPACE_ID`, `_cc`, `_sc`, and `_require_clerk_jwt_control` imports (already present).

Add a module-level constant `REPETITION_THRESHOLD = 3` near the top of the file.

Handler logic (implement §40.4 verbatim):
1. Guard with `claims: dict = Depends(_require_clerk_jwt_control)` (same as coverage_strip).
2. `rows = await _cc.convex_query(convex_http, "charities:listRecentFeatured", {"workspace_id": WORKSPACE_ID, "limit": 8}) or []`.
3. `sample_size = len(rows)`.
4. `ids = [r["sanityCharityId"] for r in rows if r.get("sanityCharityId")]`.
5. `sanity_rows = await _sc.groq_query('*[_type=="charity" && _id in $ids]{_id, focusArea, location}', params={"ids": ids}) if ids else []` — index by `_id`.
6. Build two case-insensitive counters — one for `cause` (Sanity `focusArea`), one for `geo` (Sanity `location`). Normalize each value with `.strip()`, skip falsy, key on `.lower()`, remember the first-seen original casing for display. **Do NOT count `scoutNotes`/signal.**
7. Collect `(dimension, display_value, count)` tuples where `count >= REPETITION_THRESHOLD`.
8. Sort by `count` DESC, then a fixed `dimension` order (`geo`=0, `cause`=1), then `display_value` ascending. Take the first 2.
9. `avoid = [{"dimension": d, "value": v, "count": c} for (d, v, c) in top]`.
10. `note = " · ".join(f"avoid {item['value']}" for item in avoid) or None`.
11. Return `{"note": note, "avoid": avoid, "sampleSize": sample_size}`.

Read `convex_http` from `request.app.state.convex_http` exactly as `coverage_strip` does. Read-only — no audit row.
  </action>

  <verify>
    <automated>cd packages/pipeline && grep -q "/registry/repetition-note" src/eisenbalm_pipeline/api/registry.py && grep -q "REPETITION_THRESHOLD = 3" src/eisenbalm_pipeline/api/registry.py && uv run pytest tests/test_repetition_note.py -q</automated>
  </verify>

  <acceptance_criteria>
    - `packages/pipeline/src/eisenbalm_pipeline/api/registry.py` defines `@router.get("/registry/repetition-note")`
    - `grep -q "REPETITION_THRESHOLD = 3" src/eisenbalm_pipeline/api/registry.py` succeeds
    - The handler counts only `focusArea` (cause) and `location` (geo) — `grep -q "scoutNotes" ` against the new handler body returns nothing (signal excluded)
    - `cd packages/pipeline && uv run pytest tests/test_repetition_note.py` exits 0 (the 40-01 RED scaffold now passes)
    - The existing `tests/test_registry_coverage.py` still passes (no regression to coverage-strip)
  </acceptance_criteria>

  <done>GET /registry/repetition-note returns a deterministic "avoid X · avoid Y" note; the 40-01 pipeline test is GREEN.</done>
</task>

<task type="auto">
  <name>Task 2: Defensive issues:ensureByNumber at run start</name>

  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/runs.py `_start_run` (the CFG-04 ordering comment block + steps 1-7; the ensure call goes AFTER issue-number resolution and BEFORE/at pipelineRuns:create — see action for exact placement)
    - docs/API_CONTRACTS.md §40.2 ensureByNumber (the DUAL-LANE signature; the pipeline lane passes no explicit pipelineSecret because convex_mutation injects it centrally)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py convex_mutation (confirms the central pipelineSecret injection — the caller does NOT pass it)
  </read_first>

  <action>
In `_start_run` (`packages/pipeline/src/eisenbalm_pipeline/api/runs.py`), after Step 1 resolves `issue_number` and after `http = getattr(app.state, "convex_http", None)` is available, add a defensive ensure call BEFORE the `pipelineRuns:create` mutation (Step 3):

```python
    # Phase 40 (D-04): defensively ensure the issues row exists so no trigger
    # path (empty-body /run/weekly, a curl, a future cron) can orphan a run.
    # ensureByNumber is a strict NO-OP on an existing row — it can NEVER
    # resurrect a Held issue (guard lives in convex/issues.ts). Pipeline lane:
    # convex_mutation injects the pipeline secret centrally, so no pipelineSecret
    # arg is passed here (same as every other _cc.convex_mutation call in this file).
    await _cc.convex_mutation(
        http,
        "issues:ensureByNumber",
        {"workspace_id": "eisenbalm", "issueNumber": issue_number},
    )
```

Do NOT reorder any existing CFG-04 step. Do NOT change the signature of `_start_run`. The ensure is additive and idempotent; if it fails, let it raise (same failure semantics as the adjacent `pipelineRuns:create` — a run that cannot record its issue row should surface loudly, not silently orphan).
  </action>

  <verify>
    <automated>cd packages/pipeline && grep -q "issues:ensureByNumber" src/eisenbalm_pipeline/api/runs.py && uv run pytest tests/test_control.py tests/test_test_run.py -q</automated>
  </verify>

  <acceptance_criteria>
    - `grep -q "issues:ensureByNumber" packages/pipeline/src/eisenbalm_pipeline/api/runs.py` succeeds
    - The ensure call appears BEFORE the `pipelineRuns:create` call in `_start_run` (`grep -n` line number of ensureByNumber < line number of `"pipelineRuns:create"`)
    - The ensure call passes `{"workspace_id": "eisenbalm", "issueNumber": issue_number}` and NO `pipelineSecret` (injected centrally)
    - The CFG-04 ordering comment is preserved and no existing step is reordered
    - `cd packages/pipeline && uv run pytest tests/test_control.py tests/test_test_run.py` exits 0
  </acceptance_criteria>

  <done>Every run start now ensures its issues row exists, idempotently and without touching a Held issue.</done>
</task>

<task type="auto">
  <name>Task 3: Create scripts/backfill_issues.py (D-05)</name>

  <read_first>
    - packages/pipeline/scripts/backfill_charity_registry.py (the whole file — the standalone-httpx backfill structure: `_build_convex_client`, dry-run token fallback, idempotent mutation loop, `asyncio.run(main())`, the required-env docstring)
    - docs/API_CONTRACTS.md §40.2 (`markPublished` + `ensureByNumber` — the two idempotent mutations this script calls)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (`convex_mutation`, `convex_query` signatures)
  </read_first>

  <action>
Create `packages/pipeline/scripts/backfill_issues.py`, structurally mirroring `backfill_charity_registry.py`. Its job (D-05): create one `issues` row per distinct existing `issueNumber` in `pipelineRuns`, deriving `published` from Sanity `status == 'published'`.

Steps in `main()`:
1. Build a Convex client (`_build_convex_client()` copied from the precedent).
2. Read distinct issue numbers from Convex: `convex_query(http, "pipelineRuns:...", ...)`. There is no "list all pipelineRuns" query today — so read via a Convex query you can rely on: call `convex_query(http, "runs:listForWorkspace", {"workspace_id": "eisenbalm"})` to enumerate runs, then map each run to its `issueNumber` via `convex_query(http, "pipelineRuns:byRunId", {"runId": run["runId"]})`. Collect the distinct `issueNumber` set. (This avoids adding a new Convex query just for a one-shot script.)
3. For each distinct `issueNumber`: call `convex_mutation(http, "issues:ensureByNumber", {"workspace_id": "eisenbalm", "issueNumber": n})` (idempotent — safe to re-run).
4. Read Sanity published issue numbers via a GROQ query (mirror `_build_sanity_client` + `_fetch_*` with the dry-run token fallback): `*[_type == "weeklyIssue" && status == "published"]{ issueNumber, "sanityId": _id }`.
5. For each published `issueNumber`: call `convex_mutation(http, "issues:markPublished", {"workspace_id": "eisenbalm", "issueNumber": n, "sanityIssueId": sanityId})`.
6. Print a summary line: `f"backfill_issues: ensured {len(numbers)} issues, marked {len(published)} published"`.

Include the required-env docstring (`NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `SANITY_API_TOKEN`) and the run command `cd packages/pipeline && uv run python scripts/backfill_issues.py`, exactly as the precedent does. The script MUST be idempotent and safe to run before OR after the Convex functions are deployed (if a mutation 404s because Convex isn't synced yet, print a clear error and exit non-zero — do not swallow it).

This script is NOT run by this plan (it needs the deployed Convex functions from 40-02 + 40-10's sync). It only needs to exist and import cleanly.
  </action>

  <verify>
    <automated>cd packages/pipeline && test -f scripts/backfill_issues.py && grep -q "issues:ensureByNumber" scripts/backfill_issues.py && grep -q "issues:markPublished" scripts/backfill_issues.py && uv run python -c "import ast; ast.parse(open('scripts/backfill_issues.py').read()); print('PARSE-OK')"
</automated>
  </verify>

  <acceptance_criteria>
    - `packages/pipeline/scripts/backfill_issues.py` exists and parses (`ast.parse` succeeds)
    - It calls both `issues:ensureByNumber` and `issues:markPublished`
    - It has the required-env docstring naming `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOY_KEY`, `SANITY_API_TOKEN`
    - It derives distinct issueNumbers from pipelineRuns (via runs:listForWorkspace + pipelineRuns:byRunId) and published state from Sanity `status == 'published'`
    - It adds no new Convex query function (uses only existing queries)
  </acceptance_criteria>

  <done>The one-shot issues backfill exists, imports cleanly, and is idempotent; running it (post-deploy) makes Recently Published render real history.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_repetition_note.py` is GREEN.
- `tests/test_registry_coverage.py`, `tests/test_control.py`, `tests/test_test_run.py` still pass (no regression).
- `scripts/backfill_issues.py` parses and references the two idempotent issues mutations.
- No pipeline `/issues/{run_id}/...` endpoint was renamed or touched.
</verification>

<success_criteria>
- GET /registry/repetition-note is deterministic, needs no run and no LLM call, and satisfies the 40-01 test.
- Run start defensively ensures the issues row (D-04) with no CFG-04 reordering and no Held-issue resurrection.
- The D-05 backfill exists and is idempotent.
</success_criteria>

<output>
After completion, create `.planning/phases/40-issue-entity-issues-home/40-03-SUMMARY.md`.
</output>
