---
phase: 31-content-patch-endpoints-full-editing
plan: 06
subsystem: api
tags: [fastapi, sanity, pydantic, react, vitest, content-patch, data-loss-fix]

# Dependency graph
requires:
  - phase: 31-content-patch-endpoints-full-editing
    provides: content-patch endpoint family (patch_bonus, patch_pdf_data_points, get_issue_draft) and the Review Desk SectionEditorPanel save harness built in Plans 31-01 through 31-05
provides:
  - get_issue_draft() returning problemStatement.pdfContent verbatim and bonus.body decomposed via pt_to_blocks (with a bodyLossy sibling flag)
  - patch_bonus() that only sets fields the caller actually sent (omit-able blocks/body/lyrics/sunoPrompt) instead of unconditionally wiping siblings
  - SectionEditorPanel prefilling working.pdf and bonus.body/lossy from the extended draft, with pdf and specAd-body save steps gated on their own dirty state
  - a bonus PATCH payload that matches the server contract (required `variant`, specAd rows under `blocks` not `body`)
affects: [31-VERIFICATION, review-desk, andrew-editing-workflow]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server read-path completeness: every long-read-shaped field (bonus.body, problemStatement.pdfContent) must be decomposed/surfaced by get_issue_draft() the same way the canonical 4 long-reads are, or the editor silently starts blank"
    - "Omit-able PATCH fields: optional Pydantic fields on a scoped-patch body must be checked with `is not None`, never defaulted with `or []`/`or \"\"`, so an untouched sibling field is never re-written to an empty value"
    - "Frontend dirty-gating of chained save steps: a multi-step Save action must diff each sub-state against its own `loaded` snapshot before issuing that sub-state's patch call, not just the section's aggregate dirty flag"

key-files:
  created: []
  modified:
    - docs/API_CONTRACTS.md
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py
    - packages/pipeline/tests/test_content_patch_endpoints.py
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx"
    - apps/dispatch-control/__tests__/review-desk-editors.test.tsx

key-decisions:
  - "Amended docs/API_CONTRACTS.md §31.7 and §31.3 BEFORE touching code (contract-first per CLAUDE.md), documenting the extended draft-read shape and the omit-able /bonus payload"
  - "patch_bonus() returns the current revision unchanged with an empty warnings list (no Sanity mutate call) when the caller's payload results in an empty `fields` dict, rather than sending a no-op patch"
  - "Frontend dirty-gating only wraps the pdf and specAd-blocks sub-steps (the two proven clobber vectors); headline/blocks long-read steps and jingle lyrics/sunoPrompt steps were left unconditional per the plan, since each already patches only its own field with no cross-field clobber risk"

requirements-completed: [EDT-01, EDT-02]

# Metrics
duration: 24min
completed: 2026-07-07
---

# Phase 31 Plan 06: Draft-Read Completeness + Dirty-Gated Saves Summary

**Closed a confirmed data-loss defect where saving a problemStatement headline or a specAd bonus headline silently wiped the sibling PDF key-data-points / bonus body with blanks — fixed on both the Sanity read path (`get_issue_draft`) and the frontend save path (`SectionEditorPanel.saveSection`).**

## Performance

- **Duration:** 24 min
- **Started:** 2026-07-07T17:22:00Z (approx.)
- **Completed:** 2026-07-07T17:46:28Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- `get_issue_draft()` now surfaces `problemStatement.pdfContent` verbatim and decomposes `bonus.body` through `pt_to_blocks()` (with a sibling `bonus.bodyLossy` flag), mirroring the treatment already given to the 4 canonical long-reads
- `patch_bonus()` now patches ONLY the fields present in the caller's request — a headline-only specAd save no longer sends `bonus.body = []`; a lyrics-only jingle save no longer sends `bonus.body = ""`
- `SectionEditorPanel` prefills the PDF-data-points editor and the specAd bonus body editor with real content on load instead of a permanently-blank literal
- `saveSection('problemStatement')` only calls `patchPdfDataPoints` when `working.pdf` differs from `loaded.pdf`; `saveSection('bonus')` only includes `blocks` in the specAd payload when `working.bonus.body` differs from `loaded.bonus.body`
- The bonus PATCH payload now matches the server's `_BonusBody` contract: sends the required `variant` field (previously omitted entirely) and sends specAd rows under `blocks` (previously mis-sent under `body`, a field the server reserves for the bigBudget/jingle prose string)
- `docs/API_CONTRACTS.md` §31.7 and §31.3 amended contract-first, documenting the extended draft-read shape and the now-omit-able `/bonus` payload

## Task Commits

Each task was committed atomically:

1. **Task 1: Backend — §31.7 contract amendment, draft-read completeness, omit-able patch_bonus fields** - `262f857` (feat)
2. **Task 2: Frontend — prefill pdf/bonus, dirty-gate saves, fix bonus payload contract** - `6edada7` (feat)

**Plan metadata:** (this commit) `docs(31-06): complete draft-read-completeness-and-dirty-gated-saves plan`

## Files Created/Modified
- `docs/API_CONTRACTS.md` - §31.7 amended with `pdfContent` + decomposed `bonus.body`/`bodyLossy`; §31.3 documents the omit-able `/bonus` payload and required `variant`
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` - `get_issue_draft()` adds `pdfContent` to the problemStatement section shape and decomposes `bonus.body` via `pt_to_blocks()` with a `bodyLossy` sibling
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py` - `patch_bonus()` guards every optional field with `is not None`; returns the unchanged revision with no mutate call when the resulting `fields` dict is empty
- `packages/pipeline/tests/test_content_patch_endpoints.py` - 3 new tests: `test_draft_read_includes_pdf_content`, `test_draft_read_decomposes_bonus_body`, `test_bonus_headline_only_save_omits_body`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx` - prefills `working.pdf` from `draft.sections.problemStatement.pdfContent`, surfaces `bonus.bodyLossy`, adds `pdfDirty`/`bonusBodyDirty` gates around the chained patch steps, fixes the bonus payload to send `variant` + `blocks`
- `apps/dispatch-control/__tests__/review-desk-editors.test.tsx` - 5 new tests covering pdf prefill (incl. the 3-blank-row fallback), the prose-only save skipping `patchPdfDataPoints`, a pdf-dirty save calling it with the edited values, a headline-only specAd bonus save omitting `blocks`/`body`, and a body-dirty specAd save including `blocks`

## Decisions Made
- Contract-first: amended `docs/API_CONTRACTS.md` §31.7/§31.3 before any code change, per CLAUDE.md's hard rule and this repo's established pattern
- `patch_bonus()` short-circuits with a no-op response (`{"revisionId": body.ifRevisionID, "warnings": []}`) when the caller's payload yields an empty `fields` dict, rather than issuing an empty Sanity patch mutation
- Left the long-read headline/blocks save steps and the jingle lyrics/sunoPrompt save steps unconditional (not dirty-gated) since each already writes to a single dedicated field with no cross-field clobber risk — only the two proven clobber vectors (pdf sub-state, specAd body sub-state) needed gating

## Deviations from Plan

None - plan executed exactly as written. Both gaps from `31-VERIFICATION.md` were closed on both the read side (server) and the write side (frontend), plus the two adjacent contract mismatches (missing `variant`, `body` vs `blocks` naming) called out in the same plan.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Both verified data-loss gaps from `31-VERIFICATION.md` are closed at the root cause (read-path completeness + write-path dirty-gating), with automated non-clobber tests on both the pipeline (pytest) and frontend (vitest) sides
- Full pipeline pytest suite: 384 passed / 33 skipped (baseline 381 + 3 new)
- Full dispatch-control vitest suite: 258 passed / 2 todo (baseline 253 + 5 new)
- `pnpm --filter dispatch-control build` exits 0 with zero type errors
- Outstanding: the plan's "Human Verification Required" item from `31-VERIFICATION.md` (edit only the problem-statement headline on a real draft with populated `keyDataPoints`, confirm `problemStatement.pdfContent.keyDataPoints` is unchanged in Sanity after save) still requires a live Sanity dataset + Clerk auth and was not exercised in this environment — flagged for the phase-level re-verification pass
- No known stubs introduced by this plan; all changed code paths are exercised by the new automated tests

---
*Phase: 31-content-patch-endpoints-full-editing*
*Completed: 2026-07-07*

## Self-Check: PASSED
