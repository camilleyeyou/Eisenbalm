---
phase: 31-content-patch-endpoints-full-editing
plan: 03
subsystem: api
tags: [fastapi, sanity, content-patch, audit, clerk-jwt]

# Dependency graph
requires:
  - phase: 31-content-patch-endpoints-full-editing
    provides: "Plan 31-01's docs/API_CONTRACTS.md §31 contract + Plan 31-02's patch_issue_field()/get_issue_draft()/upload_asset() Sanity-client primitives"
provides:
  - "api/content.py — the Clerk-JWT-guarded content-patch endpoint router: 8 PATCH routes (sections, headlines, theme, game, pdf-data-points, bonus, deliberation-conversation, podcast-transcript), 1 POST (asset upload), 1 GET (draft read)"
  - "_resolve_sanity_id(request, run_id, claims) — the shared run_id -> sanityIssueId resolve+actor helper every content-patch route calls first"
  - "_patch_fields() — a multi-field one-mutation dotted-path patch primitive (new, beyond Plan 31-02's single-field patch_issue_field) used by the variant-shaped /bonus route so sibling bonus fields are never clobbered by a partial-variant save"
  - "content.router mounted in api/main.py — the write boundary is now live on the FastAPI app"
affects: [31-content-patch-endpoints-full-editing, 32-native-galley, 33-accept-fix-decision-rail, 34-two-sign-off-publish-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every content-patch endpoint reads a 'before' snapshot via get_issue_draft() (or a scoped _fetch_before() GROQ read for fields get_issue_draft doesn't surface, e.g. problemStatement.pdfContent) BEFORE calling patch_issue_field(), so the audit row's before/after pair reflects real prior content, not a guess"
    - "Multi-sibling-field patches (the variant-shaped /bonus route) go through a single mutation with several dotted-path keys in one 'set' object — never two sequential patch_issue_field() calls with the same stale ifRevisionID, which would 409 on the second call once the first advances the document revision"
    - "Theme/game validation runs BEFORE any Convex/Sanity network call (fail fast on operator input errors, no wasted round-trips)"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py
  modified:
    - packages/pipeline/tests/test_content_patch_endpoints.py
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py

key-decisions:
  - "Added _patch_fields() as a new sibling primitive to Plan 31-02's patch_issue_field() rather than reusing it for the /bonus route — patch_issue_field() only supports one field_path/value pair, and the variant-shaped bonus payload (headline + body, or body + lyrics + sunoPrompt) needs several sibling fields set atomically in one revision-guarded mutation so an operator's jingle save can never silently wipe sunoAudioUrl/storyboards by omission."
  - "All content.py audit action names were taken verbatim from docs/API_CONTRACTS.md §31.8 (content.section_patched, content.headline_patched, content.theme_patched, content.game_patched, content.pdf_data_points_patched, content.bonus_patched, content.deliberation_conversation_patched, content.podcast_transcript_patched, content.asset_uploaded) rather than the shorter names sketched in the plan's task prose (e.g. 'content.pdf_patched', 'content.conversation_patched') — the contract is the authoritative source per CLAUDE.md's contract-first rule."
  - "bonus.headline is accepted as an optional field on ALL three /bonus variants (not just bigBudget/jingle as the plan's action text literally lists) — the schema only has one bonus.headline field regardless of bonusType, and D-04 ('ALL prose surfaces are editable') implies specAd's headline should be editable too; omitting it from a specAd save simply leaves it unpatched (no fields['bonus.headline'] key added when body.headline is None)."
  - "The bigBudget bonus variant patches only bonus.headline/bonus.body through this route — bonus.storyboards is an array<image> in the Sanity schema with no structured caption sub-fields, so per-storyboard editing is asset-upload-only (POST /assets/storyboard-{i}), never a text PATCH through /bonus."

requirements-completed: [EDT-01, EDT-02, EDT-03]

# Metrics
duration: 25min
completed: 2026-07-07
---

# Phase 31 Plan 03: Content-Patch Endpoint Router Summary

**A new Clerk-JWT-guarded `api/content.py` router — 8 PATCH + 1 POST + 1 GET routes, all resolving `run_id -> sanityIssueId`, HARD-validating theme/game, WARN-only on the editorial structural floor, and auditing a truncated before/after snapshot on every mutation — mounted live in `api/main.py`.**

## Performance

- **Duration:** ~25 min
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 modified)

## Accomplishments

- **Task 1 — prose + structured-field endpoints (EDT-01/EDT-02):** `PATCH /issues/{run_id}/sections/{section_name}` (4 long-reads, WARN-only structural floor via `structural_floor_warnings`), `PATCH /issues/{run_id}/headlines/{section_name}`, `PATCH /issues/{run_id}/theme` (HARD-validates hex + font whitelist via `validate_theme_fields`, 422 `{reason:"validation_failed", fields:[...]}` on failure), `PATCH /issues/{run_id}/game` (HARD-caps embed size via `validate_game_embed`), `PATCH /issues/{run_id}/pdf-data-points` (rejects `keyDataPoints` counts != 3), `PATCH /issues/{run_id}/deliberation-conversation`, `PATCH /issues/{run_id}/podcast-transcript`, and the variant-shaped `PATCH /issues/{run_id}/bonus` (409s `{reason:"wrong_bonus_variant"}` on a `variant` != stored `bonusType`; specAd patches `bonus.body` via `compose_section_body` + WARN-only floor check; bigBudget/jingle patch headline/body as plain-text `text_to_portable_text`; jingle additionally patches `lyrics`/`sunoPrompt`).
- **Task 2 — asset upload + draft read (EDT-03):** `POST /issues/{run_id}/assets/{slot}` reads `await request.body()` (never FastAPI's multipart form-parsing — `python-multipart` is not installed). Slot mapping: `podcast-audio` -> `podcast.audioFile` (file ref), `suno-audio` -> `bonus.sunoAudioUrl` as a **plain CDN URL string** (§31.6 exception — never a `{_type:'file', asset:{_ref}}` object, implemented via a new `_upload_asset_as_url()` helper), `storyboard-{i}` -> positional `bonus.storyboards[{i}]` (image ref, `_existing_asset_ref()` reads the prior `_ref` for the overwrite-swap audit). Unknown slots 400 immediately. `GET /issues/{run_id}/draft` returns `get_issue_draft()`'s shape verbatim with no audit row (read-only).
- **Task 3 — router mount:** `content` added to `api/main.py`'s import list and `app.include_router(content.router)` added alongside `review.router`. `sanity_http` was already registered on `app.state` by the existing lifespan (no lifespan change needed).
- All 16 tests in `test_content_patch_endpoints.py` pass, 0 skipped (was 1 real pair + 8 real + 1 skip after Plan 31-02; now every scaffold placeholder is a real endpoint-layer assertion against a `FastAPI TestClient`, mirroring `test_review_endpoints.py`'s monkeypatch-on-module-attribute pattern).
- Full pipeline suite: **388 passed / 33 skipped** (was 379 passed / 38 skipped after Plan 31-02 — net +9 real tests, 5 prior skips converted to green, 4 new endpoint-layer tests added: `test_asset_overwrite_audit_swap_records_audit`, `test_suno_audio_sets_url_string`, `test_storyboard_slot_field_path`, `test_upload_asset_unknown_slot_400`, `test_get_draft_endpoint_returns_get_issue_draft_result`).

## Task Commits

1. **Task 1: content.py prose + structured-field patch endpoints (EDT-01, EDT-02)** - `a6be62d` (feat)
2. **Task 2: asset-upload POST (raw-binary) + draft-read GET (EDT-03)** - `ac03836` (feat)
3. **Task 3: mount content router in api/main.py** - `bf89734` (chore)

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/api/content.py` (new) — the full content-patch router: `_resolve_sanity_id`, `_fetch_before`, `_patch_fields`, `_resolve_asset_slot`, `_existing_asset_ref`, `_upload_asset_as_url` helpers; 10 Pydantic request-body models; 8 `@router.patch`, 1 `@router.post`, 1 `@router.get` route handlers.
- `packages/pipeline/tests/test_content_patch_endpoints.py` — added a `FastAPI` `TestClient` app (`_content_app`/`_content_client`) mounting `content.router`; un-skipped and implemented `test_theme_patch_validation`, `test_structural_floor_warns_not_blocks`, `test_audit_row_truncated_snapshot`, `test_bonus_patch_variant_shaped`, `test_asset_overwrite_audit_swap_records_audit`; added `test_suno_audio_sets_url_string`, `test_storyboard_slot_field_path`, `test_upload_asset_unknown_slot_400`, `test_get_draft_endpoint_returns_get_issue_draft_result`.
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` — `content` added to the `api` import list; `app.include_router(content.router)`.

## Decisions Made

- `_patch_fields()` added as a new multi-field-in-one-mutation primitive (see key-decisions above) rather than reusing Plan 31-02's single-field `patch_issue_field()` for the `/bonus` route.
- Audit action names taken verbatim from `docs/API_CONTRACTS.md` §31.8 rather than the plan's shorthand task-prose names (contract-first per CLAUDE.md).
- `bonus.headline` accepted as optional on all three bonus variants, not just bigBudget/jingle.
- `bonus.storyboards` (an `array<image>` with no text sub-fields in the Sanity schema) is asset-upload-only — the `/bonus` route's bigBudget branch never attempts to PATCH storyboard captions/text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed literal "UploadFile"/"File(" substrings from content.py's docstrings to satisfy the plan's own acceptance grep**
- **Found during:** Task 2 verification
- **Issue:** The plan's acceptance criteria requires `grep -n "UploadFile\|File("` against `content.py` to return zero hits (proving multipart parsing is never used). My first draft's module docstring and the asset-upload handler's docstring explained the design choice using the literal phrases `UploadFile`/`File(...)`, which matched that grep pattern despite the code itself never importing or calling either symbol.
- **Fix:** Reworded both docstrings to say "FastAPI's multipart form-parsing helpers" instead of naming the specific symbols.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/api/content.py`
- **Verification:** `grep -n "UploadFile\|File(" packages/pipeline/src/eisenbalm_pipeline/api/content.py` returns no hits; full pytest suite still green.
- **Commit:** `ac03836`

---

**Total deviations:** 1 auto-fixed (docstring wording, Rule 1). No architectural changes, no scope changes.
**Impact on plan:** None on functionality or test coverage.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- `api/content.py` is live and mounted; every route resolves `run_id -> sanityIssueId`, HARD-validates theme/game, WARN-only structural-floor on prose edits, and audits before/after on every mutation.
- Plans 31-04 (frontend foundation) and 31-05 (editor components) can now wire real fetch calls against this router instead of stubs — the response shapes (`{revisionId, warnings}` for prose/theme/game/bonus patches, `{assetUrl, assetId, revisionId}` for uploads, the full draft shape for the GET) match `docs/API_CONTRACTS.md` §31.3/§31.6/§31.7 exactly.
- The known interaction risk documented in `docs/API_CONTRACTS.md` §31.9 (a `rerun_agent` re-roll after an operator content-patch edit will overwrite that edit via `write_issue_draft`'s full-document rewrite) is unchanged by this plan — still a documented ordering rule, not a code guard, per the contract.
- Full pipeline pytest suite: 388 passed / 33 skipped.

---
*Phase: 31-content-patch-endpoints-full-editing*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: `packages/pipeline/src/eisenbalm_pipeline/api/content.py`
- FOUND: `packages/pipeline/tests/test_content_patch_endpoints.py`
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/api/main.py`
- FOUND commit `a6be62d` (Task 1)
- FOUND commit `ac03836` (Task 2)
- FOUND commit `bf89734` (Task 3)
