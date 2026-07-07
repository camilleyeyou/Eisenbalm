---
phase: 31-content-patch-endpoints-full-editing
plan: 03
type: execute
wave: 3
depends_on: [1, 2]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/content.py
  - packages/pipeline/src/eisenbalm_pipeline/api/main.py
  - packages/pipeline/tests/test_content_patch_endpoints.py
autonomous: true
requirements: [EDT-01, EDT-02, EDT-03]
user_setup: []

must_haves:
  truths:
    - "A Clerk-JWT-guarded content router exposes prose, structured-field, asset-upload, and draft-read routes that resolve run_id to sanityIssueId before any write"
    - "Theme/game edits HARD-block on invalid hex/font/oversized-embed; long-read prose edits WARN (never block) on structural-floor misses"
    - "Every content mutation emits one audit row with truncated before/after snapshots"
    - "Asset uploads accept raw-binary bodies (no python-multipart) and overwrite records a swap audit row"
    - "The router is mounted in api/main.py and the app imports without error"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/content.py"
      provides: "content-patch endpoint family (EDT-01/02/03)"
      contains: "_require_clerk_jwt_control"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/main.py"
      provides: "content router mount"
      contains: "content"
  key_links:
    - from: "api/content.py"
      to: "lib/sanity_client.patch_issue_field/upload_asset/get_issue_draft"
      via: "run_id -> sanityIssueId resolution then scoped write"
      pattern: "patch_issue_field|upload_asset|get_issue_draft"
    - from: "api/content.py"
      to: "_emit_audit before/after"
      via: "truncated snapshot per save (D-09)"
      pattern: "_emit_audit"
    - from: "api/main.py"
      to: "content.router"
      via: "app.include_router"
      pattern: "include_router"
---

<objective>
Build `api/content.py` — the Clerk-JWT-guarded content-patch endpoint family (cloning `review.py`'s skeleton) — wiring Plan 02's lib helpers behind the §31 routes: per-section prose (EDT-01), structured fields incl. HARD-validated theme + capped game embed (EDT-02), variant-shaped bonus + deliberation + transcript, raw-binary asset upload (EDT-03), and the draft-read GET. Every mutation resolves `run_id -> sanityIssueId`, applies the D-08 validation split, and emits a before/after audit row (D-09). Mount the router in `api/main.py`.

Purpose: The load-bearing write boundary — the only server-side path through which the dashboard mutates Sanity content.
Output: A new router + main.py mount + real assertions replacing the remaining scaffold placeholders.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/31-content-patch-endpoints-full-editing/31-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- review.py skeleton to clone (guard order + 404/409 shapes): -->
@router.post("/issues/{run_id}/publish")
async def publish_issue(request, run_id, claims=Depends(_require_clerk_jwt_control)):
    http = getattr(request.app.state, "convex_http", None)
    actor = claims.get("sub") or "unknown"
    run = await _cc.convex_query(http, "pipelineRuns:byRunId", {"runId": run_id})
    if run is None: raise HTTPException(404, ...)
    sanity_id = run.get("sanityIssueId")
    # sanity_http = getattr(request.app.state, "sanity_http", None)

<!-- From Plans 01 + 02: -->
from eisenbalm_pipeline.lib.sanity_client import patch_issue_field, get_issue_draft, upload_asset
from eisenbalm_pipeline.lib.portable_text import compose_section_body
from eisenbalm_pipeline.lib.theme_validation import validate_theme_fields, validate_game_embed
from eisenbalm_pipeline.lib.structural_floor import structural_floor_warnings
from eisenbalm_pipeline.api.control import _emit_audit, _require_clerk_jwt_control  # _emit_audit now takes before/after
# _truncate(s): 2000-char cap + "...[truncated]" — reuse from lib/agent_wrapper.py
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: content.py prose + structured-field patch endpoints (EDT-01, EDT-02) with validation split + audit</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/content.py, packages/pipeline/tests/test_content_patch_endpoints.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/review.py (full — clone the guard order, 404/409 detail shapes, actor extraction)
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (_emit_audit now with before/after; _require_clerk_jwt_control)
    - packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py (_truncate — reuse for snapshots)
    - docs/API_CONTRACTS.md §31.2/§31.3/§31.5/§31.8 (routes, payloads, validation split, audit)
    - packages/pipeline/tests/test_content_patch_endpoints.py (test_theme_patch_validation, test_structural_floor_warns_not_blocks, test_audit_row_truncated_snapshot)
  </read_first>
  <behavior>
    - Test test_theme_patch_validation: PATCH theme with primaryColor="red" or fontDisplay="Spectral" returns 4xx {reason:"validation_failed", fields:[...]}; a valid theme (hex + whitelisted font) returns 200
    - Test test_structural_floor_warns_not_blocks: PATCH a long-read section body with 0 h2 + 0 blockquote returns 200 with a non-empty warnings list (NOT a 4xx)
    - Test test_audit_row_truncated_snapshot: a section save calls _emit_audit with before/after strings truncated to <=2000 chars + "...[truncated]"
  </behavior>
  <action>
Create `packages/pipeline/src/eisenbalm_pipeline/api/content.py` with `router = APIRouter()` and a shared helper `async def _resolve_sanity_id(request, run_id) -> tuple` returning `(convex_http, sanity_http, sanity_id, actor)` cloning review.py's lookup: 404 if run missing, 409 `{reason:"no_sanity_issue"}` if `sanityIssueId` unset. Then these endpoints (each `Depends(_require_clerk_jwt_control)`, each writing a before/after audit row via `_emit_audit`):

`PATCH /issues/{run_id}/sections/{section_name}` (EDT-01) — Pydantic body `{ifRevisionID: str, blocks: list[{type,text}]}`; reject `section_name` not in `{"originStory","problemStatement","founderBio","caseStudy"}` with 400; `warnings = structural_floor_warnings(blocks)` (WARN-only — NEVER block); read the prior body for the `before` snapshot; `patch_issue_field(field_path=f"{section_name}.body", value=compose_section_body(blocks), if_revision_id=...)`; `_emit_audit(action="content.section_patched", before=_truncate(before_str), after=_truncate(after_str), resource_type="issue", resource_id=sanity_id)`; return `{revisionId, warnings}`.

`PATCH /issues/{run_id}/headlines/{section_name}` (EDT-02) — `{ifRevisionID, headline}` -> `patch_issue_field(field_path=f"{section_name}.headline", value=headline, ...)`; audit `content.headline_patched`.

`PATCH /issues/{run_id}/theme` (EDT-02, HARD-validate) — body: 4 hex fields + fontDisplay + fontBody + visualDirection; `failed = validate_theme_fields(body_dict)`; if failed -> `HTTPException(422, detail={"reason":"validation_failed","message":"Invalid theme field(s).","fields":failed})`; else patch the whole `theme` object in one `set`; audit `content.theme_patched`.

`PATCH /issues/{run_id}/game` (EDT-02) — `{ifRevisionID, headline, description, embedCode}`; if `not validate_game_embed(embedCode)` -> 422 `{reason:"validation_failed","fields":["embedCode"],"message":"Game embed exceeds 50KB."}`; patch `game`; audit `content.game_patched`.

`PATCH /issues/{run_id}/pdf-data-points` (EDT-02) — `{ifRevisionID, problemStatement, keyDataPoints:[{stat,source}], interventionMechanism}`; reject `len(keyDataPoints)!=3` with 400; patch `problemStatement.pdfContent`; audit `content.pdf_patched`.

`PATCH /issues/{run_id}/deliberation-conversation` (EDT-01) — `{ifRevisionID, turns:[{speaker,text}]}`; assign `_key = f"turn-{i:03d}"` per turn; patch `selectionDeliberation.conversation`; audit `content.conversation_patched`.

`PATCH /issues/{run_id}/podcast-transcript` (EDT-01) — `{ifRevisionID, transcript}` -> patch `podcast.deliberationTranscript`; audit `content.transcript_patched`.

Factor the resolve+audit boilerplate so each endpoint stays ~15-25 lines. Reuse `_truncate` from lib/agent_wrapper.py (inline the 2000-char helper only if an import cycle appears).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py::test_theme_patch_validation tests/test_content_patch_endpoints.py::test_structural_floor_warns_not_blocks tests/test_content_patch_endpoints.py::test_audit_row_truncated_snapshot -q 2>&1 | tail -6</automated>
  </verify>
  <acceptance_criteria>
    - `packages/pipeline/src/eisenbalm_pipeline/api/content.py` exists with `router = APIRouter()`
    - `grep -c "@router.patch" packages/pipeline/src/eisenbalm_pipeline/api/content.py` returns >= 7
    - `grep -q "validate_theme_fields" packages/pipeline/src/eisenbalm_pipeline/api/content.py` and `grep -q "structural_floor_warnings" packages/pipeline/src/eisenbalm_pipeline/api/content.py`
    - theme endpoint returns HTTP 422 with `detail["reason"]=="validation_failed"` for invalid hex/font; section endpoint returns 200 + `warnings` for a floor miss (never 4xx)
    - `grep -q "content.section_patched" packages/pipeline/src/eisenbalm_pipeline/api/content.py` and every mutating endpoint calls `_emit_audit` with `before=` and `after=`
    - `grep -q "drafts\." packages/pipeline/src/eisenbalm_pipeline/api/content.py` returns NO hits
    - the three named tests pass (un-skipped)
  </acceptance_criteria>
  <done>content.py exposes 7 Clerk-guarded PATCH endpoints resolving run_id->sanityIssueId, HARD-validating theme/game, WARN-only on structural floor, and auditing before/after; the three scaffold tests are green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: asset-upload POST (raw-binary) + draft-read GET (EDT-03) with overwrite-swap audit</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/content.py, packages/pipeline/tests/test_content_patch_endpoints.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py (Task 1 — extend the same router)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (upload_asset, get_issue_draft from Plan 02)
    - docs/API_CONTRACTS.md §31.6/§31.7 (raw-binary upload + draft-read shapes)
    - .planning/phases/31-content-patch-endpoints-full-editing/31-RESEARCH.md (Pitfall 3 — python-multipart absent; use request.body())
    - packages/pipeline/tests/test_content_patch_endpoints.py (remaining scaffolds; test_asset_overwrite_audit_swap)
  </read_first>
  <behavior>
    - Test: POST asset with raw bytes body + X-Filename/Content-Type headers resolves the slot field path and returns {assetUrl, assetId, revisionId}; NO python-multipart import path is exercised
    - Test test_asset_overwrite_audit_swap: uploading over a slot that already had an asset emits an audit row with action "content.asset_uploaded" carrying before(old assetId)/after(new assetId)
    - Test: GET /issues/{run_id}/draft returns the get_issue_draft dict (revisionId + sections + lossy)
  </behavior>
  <action>
Add to `api/content.py`:

`POST /issues/{run_id}/assets/{slot}` (EDT-03) — read `raw = await request.body()` (NEVER FastAPI `UploadFile`/`File(...)` — `python-multipart` is not installed, RESEARCH Pitfall 3); read `filename = request.headers.get("X-Filename")`, `content_type = request.headers.get("Content-Type")`, `if_revision_id = request.headers.get("X-If-Revision-Id")`. Map `slot -> (field_path, asset_kind)`:
  - `podcast-audio` -> `("podcast.audioFile", "file")`
  - `suno-audio` -> `("bonus.sunoAudioUrl", "file")`  (per Field Inventory; confirm the field name against apps/studio/schemas/weeklyIssue.ts at implement time — if the schema field is a `file` type use that path, else the closest audio slot)
  - `storyboard-{i}` -> `(f"bonus.storyboards[{i}]", "image")`  (index parsed from the slot suffix)
Reject unknown slot with 400. Read the prior asset ref (for the `before` snapshot / overwrite detection) via `get_issue_draft` or a targeted read; call `upload_asset(...)`; `_emit_audit(action="content.asset_uploaded", before=_truncate(old_asset_id or ""), after=_truncate(new_asset_id), resource_type="issue", resource_id=sanity_id)`; return the upload_asset result. D-12 overwrite confirmation is enforced in the UI (Plan 05) — the endpoint always records the swap.

`GET /issues/{run_id}/draft` — resolve sanity_id, `return await get_issue_draft(sanity_http, sanity_id)`. No audit (read-only).

Un-skip and implement the remaining scaffold tests using `httpx.MockTransport` for the Sanity side and `monkeypatch` on `_cc.convex_query`/`_cc.convex_mutation` for Convex (mirror test_review_endpoints.py). Capture `_emit_audit` args to assert the before/after swap.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py -q 2>&1 | tail -6</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "@router.post" packages/pipeline/src/eisenbalm_pipeline/api/content.py` (assets route present) and `grep -q "@router.get" packages/pipeline/src/eisenbalm_pipeline/api/content.py` (draft route present)
    - `grep -q "await request.body()" packages/pipeline/src/eisenbalm_pipeline/api/content.py` and `grep -q "UploadFile\|File(" packages/pipeline/src/eisenbalm_pipeline/api/content.py` returns NO hits (no multipart)
    - the assets endpoint maps `podcast-audio`, `suno-audio`, `storyboard-{i}` to field paths and passes the correct `asset_kind`
    - test_asset_overwrite_audit_swap asserts `_emit_audit` called with `action=="content.asset_uploaded"` and distinct before/after asset ids
    - ALL tests in `tests/test_content_patch_endpoints.py` pass (0 skipped remaining, 0 failures)
  </acceptance_criteria>
  <done>Asset upload accepts raw-binary bodies (no python-multipart), maps slots to Sanity field paths, records overwrite swaps in audit, and the draft-read GET returns the editor payload; every scaffold test is now real and green.</done>
</task>

<task type="auto">
  <name>Task 3: Mount content router in api/main.py + register sanity_http on app state if needed</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/main.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py (lines 31-45 imports + 186-191 include_router block; lifespan where convex_http/sanity_http are set on app.state)
    - packages/pipeline/src/eisenbalm_pipeline/api/review.py (uses request.app.state.sanity_http — confirm it is already registered in main.py lifespan)
  </read_first>
  <action>
In `api/main.py`:
- Add `content` to the import line: `from eisenbalm_pipeline.api import agents, content, control, health, review, runs, webhooks`.
- Add `app.include_router(content.router)` alongside the existing `app.include_router(review.router)` block (~L191).
- Verify `app.state.sanity_http` is already set in the lifespan (review.py depends on it — it should be). If it is NOT registered (grep `sanity_http` in main.py lifespan), register the shared Sanity `AsyncClient` on `app.state.sanity_http` mirroring how `convex_http` is registered, using the same base_url pattern sanity_client uses. Do not change CORS (Phase 30 already allows the dashboard origin).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.api.main import app; paths=[r.path for r in app.routes]; assert any('/issues/{run_id}/sections/{section_name}' in p for p in paths), paths; assert any('/issues/{run_id}/assets/{slot}' in p for p in paths), paths; assert any(p=='/issues/{run_id}/draft' for p in paths), paths; print('OK mounted')" && cd packages/pipeline && uv run pytest -x -q 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "import agents, content" packages/pipeline/src/eisenbalm_pipeline/api/main.py` (or content present in the api import list)
    - `grep -q "include_router(content" packages/pipeline/src/eisenbalm_pipeline/api/main.py`
    - the python import check prints `OK mounted` (all three representative content routes registered)
    - `grep -q "sanity_http" packages/pipeline/src/eisenbalm_pipeline/api/main.py` (app.state.sanity_http is available to the router)
    - `cd packages/pipeline && uv run pytest -x -q` full suite reports 0 failures
  </acceptance_criteria>
  <done>content.router is mounted, its routes are registered on the FastAPI app, sanity_http is available on app.state, and the full pipeline suite is green.</done>
</task>

</tasks>

<verification>
- `uv run pytest tests/test_content_patch_endpoints.py -q` — all endpoint tests green, 0 skipped
- app import check prints `OK mounted`
- `uv run pytest -x -q` — full pipeline suite green
</verification>

<success_criteria>
- 7 PATCH + 1 POST(upload) + 1 GET(draft) content routes exist, Clerk-guarded, resolving run_id->sanityIssueId
- D-08 validation split enforced (theme/game hard-block; structural floor warn-only)
- Every mutation audits before/after; asset overwrite records a swap; no drafts. prefix; no python-multipart
- Router mounted; full suite green
</success_criteria>

<output>
After completion, create `.planning/phases/31-content-patch-endpoints-full-editing/31-03-SUMMARY.md`
</output>
