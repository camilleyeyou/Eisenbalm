---
phase: 39-registry-coverage-memory-strip
plan: 02
type: execute
wave: 2
depends_on: ["39-01"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/registry.py
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
  - packages/pipeline/tests/test_registry_coverage.py
autonomous: true
requirements: [MEM-01]
must_haves:
  truths:
    - "GET /registry/coverage-strip returns the last ≤8 featured charities each with cause/geo/signal chip data"
    - "The endpoint joins Convex charities:listRecentFeatured to Sanity focusArea/location/scoutNotes server-side (dispatch-control has zero Sanity access)"
    - "A featured charity lacking sanityCharityId renders empty chips and does not crash the request"
    - "The endpoint is Clerk-guarded and read-only (no audit row)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/registry.py"
      provides: "GET /registry/coverage-strip endpoint"
      contains: "coverage-strip"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/main.py"
      provides: "registry router registration"
      contains: "registry.router"
    - path: "packages/pipeline/tests/test_registry_coverage.py"
      provides: "endpoint join + missing-sanityCharityId fallback tests"
      contains: "coverage"
  key_links:
    - from: "registry.py coverage_strip"
      to: "charities:listRecentFeatured"
      via: "convex_query"
      pattern: "listRecentFeatured"
    - from: "registry.py coverage_strip"
      to: "Sanity focusArea/location/scoutNotes"
      via: "groq_query"
      pattern: "focusArea"
---

<objective>
Add the server-side `GET /registry/coverage-strip` FastAPI endpoint that joins the last-8 featured charities (Convex) to their Sanity `focusArea`/`location`/`scoutNotes` (cause/geo/signal). This MUST be a server endpoint — dispatch-control has zero Sanity access (EDT-05, tripwire-enforced).

Purpose: MEM-01's coverage strip needs cause+geo+signal, which live only on the Sanity charity doc; the dashboard cannot fetch Sanity directly, so the join happens here (mirroring the `GET /issues/{run_id}/draft` read-only precedent).
Output: A new `registry.py` router with `GET /registry/coverage-strip`, registered in `main.py`, plus pytest covering the join and the missing-`sanityCharityId` fallback.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/39-registry-coverage-memory-strip/39-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- From 39-01 (already landed): charities:listRecentFeatured({ workspace_id, limit? }) -> Doc<'charities'>[] -->
<!-- Each charities row: { name, sanityCharityId?, lastFeaturedAt?, dedupKey?, status, ... } -->

content.py precedents (packages/pipeline/src/eisenbalm_pipeline/api/content.py):
  import eisenbalm_pipeline.lib.convex_client as _cc      # _cc.convex_query(http, path, args)
  import eisenbalm_pipeline.lib.sanity_client as _sc      # _sc.groq_query(groq, params=...)  # NOTE: groq_query(query, *, params=None) — NO http arg; uses module-level client (calibrator.py:70 precedent)
  from eisenbalm_pipeline.api.control import _require_clerk_jwt_control
  router = APIRouter()
  @router.get("/issues/{run_id}/draft")
  async def get_content_draft(request, run_id, claims=Depends(_require_clerk_jwt_control)) -> dict: ...  # read-only, no audit

WORKSPACE_ID: the pipeline's workspace slug is the literal "eisenbalm" (see agents/scout.py WORKSPACE_ID usage). Use the same constant/literal the scout uses.
Convex query call shape: `await convex_query(http, "charities:listRecentFeatured", {"workspace_id": "eisenbalm", "limit": 8})`.
Sanity read shape: `await groq_query('*[_type=="charity" && _id in $ids]{_id, focusArea, location, scoutNotes}', params={"ids": ids})`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED tests for coverage-strip join + missing-sanityCharityId fallback</name>
  <read_first>
    - packages/pipeline/tests/agents/test_researcher.py (AsyncMock-patching style for Convex/Sanity helpers)
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py (get_content_draft ~L799 — endpoint signature + how convex_query/groq_query are called)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (convex_query signature ~L168)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (groq_query signature)
  </read_first>
  <behavior>
    - Given listRecentFeatured returns 2 featured rows (one WITH sanityCharityId "charity-a", one WITHOUT), and Sanity returns { _id: "charity-a", focusArea: "Housing", location: "Detroit", scoutNotes: "long note..." }, the endpoint returns 2 items ordered by lastFeaturedAt desc; item A has cause="Housing", geo="Detroit", signal starting "long note..."; the sanityCharityId-less item has empty/None cause/geo/signal and does NOT crash.
    - The endpoint calls convex charities:listRecentFeatured with limit 8 and issues at most one groq_query with the collected ids.
  </behavior>
  <action>
    Author packages/pipeline/tests/test_registry_coverage.py. Build the coverage handler's core join as a testable unit — call the endpoint's handler function directly (constructing a fake `request`/`http` per the content.py test precedent) with `_cc.convex_query` and `_sc.groq_query` patched. IMPORTANT: patch `groq_query` with `autospec=True` so the mock ENFORCES the real `groq_query(query, *, params=None)` signature — a bare AsyncMock would silently accept a wrong-arity call and let the endpoint ship broken. Two tests:
    - `test_coverage_strip_joins_cause_geo_signal`: assert the 2-item shape above, order preserved, chips populated for the sanityCharityId row.
    - `test_coverage_strip_skips_missing_sanity_id` (marker `missing_sanity_id`): the row without sanityCharityId yields empty chips (None/"" cause/geo/signal), no exception, and its _id is NOT in the groq `$ids` param.
    Run — fails RED (registry.py does not exist yet).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_registry_coverage.py -q 2>&1 | grep -Eq "error|Error|no tests ran|failed|passed"</automated>
  </verify>
  <acceptance_criteria>
    - File `packages/pipeline/tests/test_registry_coverage.py` exists
    - `grep -q "test_coverage_strip_joins_cause_geo_signal" packages/pipeline/tests/test_registry_coverage.py` succeeds
    - `grep -q "missing_sanity_id" packages/pipeline/tests/test_registry_coverage.py` succeeds
    - `cd packages/pipeline && uv run pytest tests/test_registry_coverage.py -q` currently FAILS (RED — endpoint not implemented)
  </acceptance_criteria>
  <done>Two RED tests encode the join shape and the missing-sanityCharityId graceful-skip (Pitfall 6).</done>
</task>

<task type="auto">
  <name>Task 2: registry.py router with GET /registry/coverage-strip + register in main.py</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py (L25-52 imports block; get_content_draft read-only endpoint ~L799)
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py (include_router block ~L198-208)
    - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py (WORKSPACE_ID constant)
  </read_first>
  <action>
    Create packages/pipeline/src/eisenbalm_pipeline/api/registry.py:
    - Imports mirror content.py: `from fastapi import APIRouter, Depends, Request`; `import eisenbalm_pipeline.lib.convex_client as _cc`; `import eisenbalm_pipeline.lib.sanity_client as _sc`; `from eisenbalm_pipeline.api.control import _require_clerk_jwt_control`; `import logging`. `log = logging.getLogger(__name__)`; `router = APIRouter()`.
    - `WORKSPACE_ID = "eisenbalm"` (or import scout's — match the existing literal).
    - `@router.get("/registry/coverage-strip")` async handler `coverage_strip(request: Request, claims: dict = Depends(_require_clerk_jwt_control)) -> list[dict]`:
      1. Get the shared AsyncClient the way content.py does (via request app state / the `_cc`/`_sc` helper convention — follow content.py exactly).
      2. `rows = await _cc.convex_query(http, "charities:listRecentFeatured", {"workspace_id": WORKSPACE_ID, "limit": 8})` (default to [] if None).
      3. `ids = [r["sanityCharityId"] for r in rows if r.get("sanityCharityId")]`.
      4. `sanity_rows = await _sc.groq_query('*[_type=="charity" && _id in $ids]{_id, focusArea, location, scoutNotes}', params={"ids": ids}) if ids else []`. IMPORTANT: `groq_query(query, *, params=None)` takes NO `http`/positional-client arg — it uses the module-level client registered at FastAPI lifespan (calibrator.py:70 precedent). Passing `http` as a first positional arg raises TypeError at runtime.
      5. Build a dict `by_id = {s["_id"]: s for s in sanity_rows}`. For each charities row (preserve listRecentFeatured order = lastFeaturedAt desc), emit `{ "name": r.get("name"), "sanityCharityId": r.get("sanityCharityId"), "lastFeaturedAt": r.get("lastFeaturedAt"), "cause": s.get("focusArea"), "geo": s.get("location"), "signal": s.get("scoutNotes") }` where `s = by_id.get(r.get("sanityCharityId")) or {}` — so rows with no sanityCharityId (or no Sanity match) get None chips, never crash (Pitfall 6).
      6. Return the list (≤8). No audit row (reads are not audited).
    - Register in main.py: `from eisenbalm_pipeline.api import ... registry` and `app.include_router(registry.router)` alongside the other routers.
    Run the RED tests — GREEN.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_registry_coverage.py -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q '@router.get("/registry/coverage-strip")' packages/pipeline/src/eisenbalm_pipeline/api/registry.py` succeeds
    - `grep -q "charities:listRecentFeatured" packages/pipeline/src/eisenbalm_pipeline/api/registry.py` succeeds
    - `grep -q "focusArea" packages/pipeline/src/eisenbalm_pipeline/api/registry.py` and `grep -q "scoutNotes" packages/pipeline/src/eisenbalm_pipeline/api/registry.py` succeed
    - `grep -q "_require_clerk_jwt_control" packages/pipeline/src/eisenbalm_pipeline/api/registry.py` succeeds
    - `grep -q "registry.router" packages/pipeline/src/eisenbalm_pipeline/api/main.py` succeeds
    - `cd packages/pipeline && uv run pytest tests/test_registry_coverage.py -q` passes (both tests GREEN)
    - `cd packages/pipeline && uv run pytest -q` full suite passes (no regression)
  </acceptance_criteria>
  <done>GET /registry/coverage-strip returns the last-8 featured charities joined to cause/geo/signal, gracefully skipping rows without sanityCharityId, registered and Clerk-guarded.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_registry_coverage.py -q` green (join + missing-id fallback).
- `cd packages/pipeline && uv run pytest -q` full suite green (router registration didn't break import/lifespan).
- Endpoint is Clerk-guarded, read-only, server-side join — no Sanity access added to dispatch-control.
</verification>

<success_criteria>
- The coverage strip UI (39-05) has a working authenticated endpoint returning ≤8 {name, cause, geo, signal} items.
- Legacy featured rows without sanityCharityId never 500 the request.
</success_criteria>

<output>
After completion, create `.planning/phases/39-registry-coverage-memory-strip/39-02-SUMMARY.md`.
</output>
