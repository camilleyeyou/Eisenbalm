---
phase: 31-content-patch-endpoints-full-editing
plan: 01
subsystem: api
tags: [fastapi, pydantic, sanity, portable-text, audit-log, contract-first]

# Dependency graph
requires:
  - phase: 26-review-gate-charity-registry
    provides: "_emit_audit / _require_clerk_jwt_control pattern in api/control.py, reviewActions + auditLog convex plumbing"
  - phase: 18-magazine-editorial-layout-writers
    provides: "BodyBlock discriminated-flat model + compose_section_body serializer (the write-side this plan's pt_to_blocks inverts)"
provides:
  - "§31 API_CONTRACTS.md contract for the full content-patch endpoint family (10 routes) — written before any endpoint code"
  - "pt_to_blocks() reverse Portable-Text mapper with lossy detection, for the draft-read GET"
  - "lib/theme_validation.py — canonical 9-font operator-facing theme validator + game embed byte-cap"
  - "lib/structural_floor.py — warn-only structural-floor counter (distinct from the raise-based agent validators)"
  - "_emit_audit extended with optional before/after snapshot kwargs (D-09)"
  - "Wave-0 pytest scaffold (test_content_patch_endpoints.py) with 10 named skipped placeholders for Plan 31-02/03"
affects: [31-02-backend-lib, 31-03-endpoints, 31-04-frontend, 31-05-frontend-advisory]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first: §31 written into docs/API_CONTRACTS.md before any endpoint/UI code touches the shape (CLAUDE.md hard rule)"
    - "HARD vs WARN validation split — theme/font/embed HARD-block 4xx, structural floor WARN-only 200+warnings"
    - "Reverse-mapper pattern: pt_to_blocks() is the read-side inverse of the existing compose_section_body() write-side serializer"
    - "Audit before/after snapshot extension is purely additive kwargs — zero changes required at any existing call site"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/lib/theme_validation.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/structural_floor.py
    - packages/pipeline/tests/test_content_patch_endpoints.py
  modified:
    - docs/API_CONTRACTS.md
    - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py

key-decisions:
  - "Theme validator canonicalizes on the 9-font apps/web/lib/theme.ts FONT_WHITELIST (render-time gate), NOT the drifted 17-entry agents/design/font_whitelist.py list — documented as a separate, out-of-scope divergence"
  - "structural_floor_warnings() is a standalone warn-only counter; the existing raise-based Pydantic _enforce_structural_floor validators in agents/*.py are left byte-unchanged, not reused"
  - "suno-audio asset-upload slot is documented (§31.6) as writing a plain CDN URL string into bonus.sunoAudioUrl, not a Sanity asset reference — matches the existing type:'url' schema field, no schema change needed"
  - "rerun-clobber interaction with content-patch edits is a documented ordering rule (§31.9) for v1, not a code guard — deferred re-read-current-Sanity merge to a later phase"

patterns-established:
  - "Wave-0 scaffold pattern: one real passing test + N named-and-skipped placeholders, so later-wave plans have a fixed test-name contract to fill in (not free to invent names)"

requirements-completed: [EDT-01, EDT-02, EDT-03, EDT-05]

# Metrics
duration: 12min
completed: 2026-07-07
---

# Phase 31 Plan 01: Contracts and Shared Foundation Summary

**§31 content-patch endpoint contract (10 routes, revision guard, validation split, asset flow, rerun-clobber rule) plus three dependency-free lib primitives (pt_to_blocks reverse mapper, 9-font theme validator, warn-only structural-floor counter) and an additive _emit_audit before/after extension — all Wave-0 blocking work for Waves 2-3.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-07-07T10:26:49Z
- **Completed:** 2026-07-07T10:29:58Z
- **Tasks:** 3 completed
- **Files modified:** 6 (1 doc, 3 lib modules touched/created, 1 api module, 1 test file)

## Accomplishments
- `docs/API_CONTRACTS.md` §31 now documents all 10 content-patch routes, the top-level `ifRevisionID` revision guard + 409 shape, the HARD/WARN validation split (9-font whitelist + 50KB embed cap vs. structural-floor warnings), the raw-binary asset-upload flow (including the `suno-audio` URL-string exception), the draft-read GET response shape (`bonusType` + per-section `lossy` flag), the audit shape, and the rerun-clobber ordering rule — landed before any endpoint code exists.
- `pt_to_blocks()` added to `lib/portable_text.py` as the reverse of the existing `compose_section_body()`, with lossy-block detection (`markDefs` or multi-span children) and a logged warning on lossy conversion.
- New `lib/theme_validation.py` — the single canonical 9-font operator-facing validator (`CONTENT_FONT_WHITELIST`, `HEX_REGEX`, `validate_theme_fields()`, `validate_game_embed()` at a 50000-byte cap), deliberately mirroring `apps/web/lib/theme.ts` rather than the drifted `agents/design/font_whitelist.py` list.
- New `lib/structural_floor.py` — `structural_floor_warnings()`, a warn-only counter that never raises, kept fully separate from the existing raise-based Pydantic validators in the five long-read writer agents.
- `_emit_audit` in `api/control.py` extended with optional `before`/`after` kwargs, forwarded into the Convex mutation args dict only when supplied — every existing caller (review.py, control.py, runs.py) is unaffected.
- Wave-0 pytest scaffold `test_content_patch_endpoints.py` created with 2 real passing tests (RED→GREEN against the `_emit_audit` extension) and 10 named skipped placeholders for Plan 31-02/03 to fill in.

## Task Commits

Each task was committed atomically:

1. **Task 1: Amend docs/API_CONTRACTS.md with §31** - `557482a` (docs)
2. **Task 2: pt_to_blocks / theme_validation / structural_floor** - `463f0b4` (feat)
3. **Task 3: Wave-0 scaffold + _emit_audit extension (TDD)** - `59a6390` (test, RED) → `c11c727` (feat, GREEN)

## Files Created/Modified
- `docs/API_CONTRACTS.md` - §31 content-patch endpoint family contract (10 routes, revision guard, validation split, asset flow, draft-read shape, audit shape, rerun-clobber rule)
- `packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` - added `pt_to_blocks()` reverse mapper with lossy detection + logging
- `packages/pipeline/src/eisenbalm_pipeline/lib/theme_validation.py` - new: `CONTENT_FONT_WHITELIST` (9 fonts), `HEX_REGEX`, `validate_theme_fields()`, `validate_game_embed()`
- `packages/pipeline/src/eisenbalm_pipeline/lib/structural_floor.py` - new: `structural_floor_warnings()` warn-only counter
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` - `_emit_audit` extended with optional `before`/`after` kwargs
- `packages/pipeline/tests/test_content_patch_endpoints.py` - new Wave-0 scaffold (2 real tests + 10 skipped placeholders)

## Decisions Made
- Theme validator canon = the 9-font `apps/web/lib/theme.ts` list (render-time gate that actually breaks the site), not the drifted 17-entry `agents/design/font_whitelist.py` list used by the DesignAgent — the two lists' divergence is documented as a separate, out-of-scope concern.
- Structural-floor warn-only counter is a standalone helper, not a refactor of the existing raise-based agent validators — keeps the Wave-0 plan's zero-touch guarantee on `agents/*.py` intact (verified via `git diff --stat`).
- The `suno-audio` asset slot is documented to use a plain URL-string `set` (matching the existing `type:'url'` schema field) rather than a Sanity asset reference, avoiding any schema change.

## Deviations from Plan

None - plan executed exactly as written. The TDD task (Task 3) followed RED→GREEN as specified: the `_emit_audit` before/after test failed first with `TypeError: _emit_audit() got an unexpected keyword argument 'before'`, then passed after the additive kwarg extension.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The §31 contract is now the fixed reference for Plan 31-02 (backend lib), 31-03 (endpoints), and 31-04/05 (frontend) — all three can proceed against a locked shape.
- `pt_to_blocks`, `theme_validation`, and `structural_floor` are import-verified and ready to be wired into the actual endpoint handlers in Plan 31-02/03.
- `_emit_audit(before=..., after=...)` is ready for every content-patch mutation to call.
- The 10 named skipped placeholders in `test_content_patch_endpoints.py` give Plan 31-02/03 a fixed test-name contract rather than inventing new names.
- Full pipeline pytest suite: 374 passed / 43 skipped (no regression from the prior 340-passed baseline).

---
*Phase: 31-content-patch-endpoints-full-editing*
*Completed: 2026-07-07*

## Self-Check: PASSED

All 7 created/modified files confirmed present on disk; all 4 task commit
hashes (557482a, 463f0b4, 59a6390, c11c727) confirmed in git log.
