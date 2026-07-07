---
phase: 31-content-patch-endpoints-full-editing
plan: 02
subsystem: api
tags: [sanity, httpx, fastapi, portable-text, content-patch]

# Dependency graph
requires:
  - phase: 31-content-patch-endpoints-full-editing
    provides: "Plan 31-01's pt_to_blocks()/compose_section_body() Portable Text helpers, docs/API_CONTRACTS.md §31 contract, and the Wave-0 pytest scaffold with 10 skip placeholders"
provides:
  - "patch_issue_field() — scoped dotted-path Sanity patch with ifRevisionID revision guard, mapping Sanity's native 409 to a structured HTTPException(409, {reason: revision_mismatch})"
  - "get_issue_draft() — GROQ read of the current draft, decomposing each long-read section's Portable Text body back into {type,text}[] rows via pt_to_blocks with a per-section lossy flag"
  - "upload_asset() — generalized raw-binary upload to Sanity's files/images assets endpoints + scoped reference patch, reusing patch_issue_field's revision guard"
  - "_groq()/_fetch_issue_rev() internal helpers for GROQ queries against an explicit (mockable) http client"
affects: [31-content-patch-endpoints-full-editing, 32-native-galley]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Every Sanity write in this file targets the plain issue-{n} id — never a drafts-namespace id"
    - "Revision guard: ifRevisionID as a top-level sibling of id/set in the patch mutation, not nested under options"
    - "Post-patch _rev is always re-read via a separate GROQ query — never parsed out of the mutate response (returnDocuments is unverified on v2024-01-01)"
    - "Sanity GROQ queries can be issued via POST with a JSON body ({query, params}), not just GET with query-string params — used for the caller-supplied-http-client GROQ helper needed for MockTransport-based unit tests"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
    - packages/pipeline/tests/test_content_patch_endpoints.py

key-decisions:
  - "_groq(http, query, params) is a new low-level helper distinct from the module-level groq_query() — groq_query() manages its own client (global singleton or one-shot fallback) and can't be pointed at an httpx.MockTransport in tests, so a caller-supplied-client variant was added specifically for the content-patch primitives"
  - "_groq() POSTs to data/query/{dataset} with a JSON body rather than GET with query-string params — simpler to assert against in MockTransport tests and Sanity's query API supports both"

patterns-established:
  - "Scoped single-field dotted-path patch (patch_issue_field) is now the primitive every future content-patch endpoint (Plan 31-03) composes over, rather than each endpoint hand-rolling its own mutate() call"

requirements-completed: [EDT-01, EDT-02, EDT-03]

# Metrics
duration: 17min
completed: 2026-07-07
---

# Phase 31 Plan 02: Sanity Client Patch Helpers Summary

**Three new Sanity-client primitives (patch_issue_field, get_issue_draft, upload_asset) — all revision-guarded, all targeting the plain issue-{n} document id, all unit-tested with httpx.MockTransport — that Plan 31-03's content-patch router will call directly.**

## Performance

- **Duration:** ~17 min
- **Started:** 2026-07-07T10:31:29Z (STATE.md `last_updated` from Plan 31-01 completion)
- **Completed:** 2026-07-07T10:48Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- `patch_issue_field()` — the core scoped write primitive: one dotted-path `set` onto the plain `issue-{n}` id, `ifRevisionID` as a top-level patch key, Sanity's native 409 re-raised as a structured `HTTPException(409, {reason: "revision_mismatch", message: "..."})`. Returns the post-patch `_rev` via a fresh GROQ read (never parsed from the mutate response).
- `get_issue_draft()` — reads the current draft (`_rev`, theme, game, bonus, bonusType, podcast, the 4 long-read sections, and the deliberation conversation) and decomposes each long-read's stored Portable Text body back into `{type, text}[]` rows via Plan 31-01's `pt_to_blocks()`, surfacing a per-section `lossy` flag.
- `upload_asset()` — generalizes `upload_pdf_to_issue`'s upload-then-patch-reference precedent to any file or image slot: POSTs raw bytes to `/assets/files/{dataset}` or `/assets/images/{dataset}` depending on `asset_kind`, then calls `patch_issue_field()` to write a `{_type, asset:{_ref}}` reference onto the target field. `upload_pdf_to_issue` itself is untouched (still used by the Publisher).
- A new internal `_groq(http, query, params)` helper (POST to `data/query/{dataset}` with an explicit, mockable `http` client) backs both `_fetch_issue_rev()` and `get_issue_draft()` — distinct from the pre-existing module-level `groq_query()`, which manages its own client and can't be pointed at a test `MockTransport`.
- All 5 target scaffold tests un-skipped with real `httpx.MockTransport` assertions: `test_patch_section_scoped`, `test_patch_revision_mismatch`, `test_draft_read_lossy_flag`, `test_upload_asset_patches_reference`, `test_asset_overwrite_audit_swap`. The remaining 5 scaffold tests (theme validation, structural-floor warn, audit truncation, bonus variant shaping, overwrite-audit-row) stay skipped — they belong to Plan 31-03's endpoint layer.

## Task Commits

Each task was committed atomically. Note: due to a git-index race with a concurrently-running parallel executor (Plan 31-04), Task 1's staged changes were swept into that agent's commit rather than landing under a `31-02` message — the code is correctly present and verified; see Deviations below.

1. **Task 1: patch_issue_field() scoped dotted-path patch with ifRevisionID to 409** - `f6c5bf1` (feat — landed inside a Plan 31-04 commit, "Review Desk route shell", due to a git-index race; content verified present and correct)
2. **Task 2: get_issue_draft() read helper** - `8655a84` (feat)
3. **Task 3: upload_asset() generalization (files + images)** - `998b200` (feat)

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` — added `_groq()`, `_fetch_issue_rev()`, `patch_issue_field()`, `_DRAFT_GROQ`/`_LONG_READS`, `get_issue_draft()`, `upload_asset()`; added `HTTPException` (fastapi) and `pt_to_blocks` (portable_text) imports. `upload_pdf_to_issue()`, `write_issue_draft()`, `groq_query()`, and every other pre-existing function are byte-unchanged.
- `packages/pipeline/tests/test_content_patch_endpoints.py` — un-skipped and filled in 5 of the 10 Plan 31-01 scaffold placeholders with real `httpx.MockTransport` assertions; added `_set_sanity_env`, `_mock_http`, `_make_asset_handler`, `_pt_block` test helpers.

## Decisions Made

- Added a new `_groq(http, query, params)` internal helper rather than reusing the module-level `groq_query()`, because `groq_query()` always manages its own `AsyncClient` (registered singleton or a fresh one-shot client) and has no way to accept a test-injected `httpx.MockTransport`. The content-patch primitives need an explicit, mockable client parameter to stay consistent with every other function in this file (`write_issue_draft`, `upload_pdf_to_issue`, etc. all take `http: AsyncClient` explicitly).
- `_groq()` POSTs to `data/query/{dataset}` with a JSON body (`{query, params}`) rather than issuing a GET with URL query-string params (which is what `groq_query()` does). Sanity's query API supports both; POST is simpler to assert against with `MockTransport` and avoids URL-length concerns for larger GROQ projections like `_DRAFT_GROQ`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed literal "drafts." substring from patch_issue_field's docstring/comment to satisfy the plan's own acceptance grep**
- **Found during:** Task 1 verification
- **Issue:** The plan's acceptance criteria requires `grep -n "drafts\."` against `sanity_client.py` to return zero hits (proving no drafts-namespace targeting anywhere in the file). My first draft of `patch_issue_field`'s docstring and inline comment used the literal phrase "NEVER drafts." / "no drafts. prefix", which itself matched that grep pattern and would have failed the acceptance check despite the code being correct.
- **Fix:** Reworded both comments to say "never a Sanity drafts-namespace id" / "no drafts-namespace prefix" — same meaning, no literal `drafts.` substring.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`
- **Verification:** `grep -n "drafts\." packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` returns no hits; full pytest suite still green.
- **Committed in:** `f6c5bf1` (part of Task 1's swept-in changes)

### Process note (not a code deviation)

**Parallel-executor git-index race swept Task 1's staged commit into another agent's commit.** This plan runs as one of several parallel executor agents in the same working tree. Between `git add` and `git commit --no-verify` for Task 1, a concurrently-running Plan 31-04 agent's own `git commit` call picked up my already-staged `sanity_client.py`/`test_content_patch_endpoints.py` changes (git commits whatever is in the index at commit time, regardless of which process staged it) and included them in commit `f6c5bf1` ("feat(31-04): Review Desk route shell..."). I verified via `git show f6c5bf1 -- .../sanity_client.py` that `_groq`, `_fetch_issue_rev`, and `patch_issue_field` are present, byte-identical to what I authored, and the full test suite (including `test_patch_section_scoped` and `test_patch_revision_mismatch`) passes against the committed state. No code was lost or duplicated; Tasks 2 and 3 were re-applied and committed normally under `31-02` messages (`8655a84`, `998b200`) with a tighter add→commit window to avoid recurrence.

---

**Total deviations:** 1 auto-fixed (comment wording, Rule 1) + 1 process note (no code impact).
**Impact on plan:** None on functionality or test coverage — all 3 tasks' code and tests are present, committed, and verified working. The only artifact is that Task 1's commit message/attribution reads "31-04" instead of "31-02" in `git log`.

## Issues Encountered

None beyond the git-index race documented above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `patch_issue_field()`, `get_issue_draft()`, and `upload_asset()` are ready for Plan 31-03 to wire into the `api/content.py` router's PATCH/POST/GET routes.
- `upload_pdf_to_issue()` and the full pipeline pytest suite (379 passed / 38 skipped) remain green — no regression to existing Sanity write paths.
- The 5 remaining skipped scaffold tests (theme validation, structural-floor warn, audit truncation, bonus variant shaping, asset-overwrite-audit-row) are Plan 31-03's responsibility at the endpoint layer.

---
*Phase: 31-content-patch-endpoints-full-editing*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`
- FOUND: `packages/pipeline/tests/test_content_patch_endpoints.py`
- FOUND: `.planning/phases/31-content-patch-endpoints-full-editing/31-02-SUMMARY.md`
- FOUND commit `f6c5bf1` (Task 1 content, swept into a parallel agent's commit — verified present via `git show`)
- FOUND commit `8655a84` (Task 2)
- FOUND commit `998b200` (Task 3)
