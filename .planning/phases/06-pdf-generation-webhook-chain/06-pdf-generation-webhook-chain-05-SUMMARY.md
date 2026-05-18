---
phase: 06-pdf-generation-webhook-chain
plan: 05
subsystem: pdf-rendering
tags: [weasyprint, jinja2, pdf, fonts, base64, publisher]

# Dependency graph
requires:
  - phase: 06-pdf-generation-webhook-chain Plan 01
    provides: tests/agents/publisher/ scaffolding + fixtures (sample_pdf_content.json, sample_theme.json, tiny.ttf)
  - phase: 06-pdf-generation-webhook-chain Plan 02
    provides: weeklyIssue.problemStatement.pdfContent Sanity field + write_issue_draft passthrough
  - phase: 06-pdf-generation-webhook-chain Plan 03
    provides: packages/pipeline/fonts/ vendored TTFs (Playfair Display + Source Serif Pro × Regular/Bold) + weasyprint==68.1 + jinja2==3.1.6
  - phase: 04-pipeline-skeleton
    provides: @agent_node wrapper + Phase 4 stub publisher.py body
  - phase: 05-agent-quality Plan 04
    provides: agents/design/ package promotion pattern (mirror)
provides:
  - agents/publisher package promotion (publisher.py -> publisher/__init__.py)
  - agents/publisher/pdf.py::render_problem_statement_pdf (PDF-01, PDF-02)
  - agents/publisher/fonts.py::font_filename, font_to_base64, FONTS_DIR
  - agents/publisher/templates/problem_statement.html.j2 (Jinja2)
  - 7 unit tests (4 PDF + 3 fonts) all green against real WeasyPrint + real TTFs
affects: [06-07-webhook-and-publisher-wiring, 06-08-readme-and-smoke-test, future Phase 6 carry-forward to Phase 7 game iframe PDF style parity]

# Tech tracking
tech-stack:
  added: []  # weasyprint + jinja2 vendored in Plan 06-03; this plan only consumes them
  patterns:
    - "Package promotion: <agent>.py module to <agent>/ package with verbatim Phase 4 stub body in __init__.py (mirrors Plan 05-04 design/ and Plan 05-13 qa/)"
    - "Base64 @font-face inline pattern: WeasyPrint FontConfiguration on HTML + write_pdf, exactly 2 theme fonts (display + body), Bold variant best-effort"
    - "PDF font-embedding assertion via FlateDecode-stream decompression + UTF-16-BE / ASCII PostScript-name search (WeasyPrint 68.1 compresses everything)"
    - "Jinja2 Environment with FileSystemLoader(TEMPLATES_DIR) + select_autoescape(['html']) for renderer template"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/__init__.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/pdf.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/fonts.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/problem_statement.html.j2
    - packages/pipeline/tests/agents/publisher/test_pdf.py (filled bodies)
    - packages/pipeline/tests/agents/publisher/test_fonts.py (filled bodies)
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py (DELETED — replaced by package)

key-decisions:
  - "Plan 06-01 test-skeleton parallel agent merged my Task 3 test bodies directly into the Wave-0 commit (47367be) — combined commit captures unskipped tests + decompression helper rather than landing as a separate Plan 06-05 test commit. Net contents identical to plan spec."
  - "PDF font-embedding assertion changed from naive `b'PlayfairDisplay' in pdf` (the plan template) to FlateDecode-stream decompression + UTF-16-BE / ASCII PostScript-name search — Rule 1 deviation. WeasyPrint 68.1 compresses every object stream including font subsets, so the plain-bytes assertion never matches in practice; the decompression approach is still self-contained (zlib stdlib only, no pdfminer dependency)."
  - "Bold variant of each theme font is inlined best-effort (silently skipped if not vendored) rather than required — keeps the PDF lean (Pitfall 3) and avoids hard failures when only Regular is vendored for future theme fonts."

patterns-established:
  - "Publisher package promotion pattern: delete agents/X.py, create agents/X/__init__.py preserving Phase-4 body verbatim, add agents/X/templates/__init__.py empty marker. Import contract `from eisenbalm_pipeline.agents.X import X` is preserved so graph/builder.py needs zero changes."
  - "FONTS_DIR = Path(__file__).parents[3].parent / 'fonts' — fragile to package reorganization but unambiguous from publisher/fonts.py's location. Documented inline in fonts.py with parent index annotations."
  - "PDF render-time FontConfiguration is constructed per-render (not memoized globally) — Pitfall 2 from 06-RESEARCH §Pitfalls."
  - "Test approach for binary PDF assertions: decompress every FlateDecode stream, search for both ASCII and UTF-16-BE encoded forms of the font family name. This generalizes to any future PDF-content assertion against WeasyPrint output."

requirements-completed: [PDF-01, PDF-02, PDF-03]

# Metrics
duration: 24min
completed: 2026-05-18
---

# Phase 6 Plan 5: Publisher Package + PDF Renderer Summary

**WeasyPrint Problem Statement PDF renderer landing alongside agents/publisher.py package promotion; renders 18.6 KB themed A4 PDF from sample fixtures using base64-inlined Playfair Display + Source Serif Pro TTFs, no Google Fonts HTTP loads.**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-05-18T19:50:38Z
- **Completed:** 2026-05-18T20:14:46Z
- **Tasks:** 3
- **Files modified:** 7 created (5 source + 2 test) + 1 deleted (legacy publisher.py)

## Accomplishments

- Promoted agents/publisher.py to agents/publisher/ package; Phase 4 @agent_node stub body preserved verbatim in __init__.py; graph/builder.py import path unchanged
- Shipped agents/publisher/pdf.py::render_problem_statement_pdf — 18.6 KB themed A4 PDF from the sample (issue 42, "The Quiet Foundation") fixtures
- Shipped agents/publisher/fonts.py with deterministic font_filename / font_to_base64 / FONTS_DIR helpers — 'Playfair Display' + 'Regular' -> 'PlayfairDisplay-Regular.ttf'
- Shipped agents/publisher/templates/problem_statement.html.j2 — Jinja2 template with theme color variables + 3-keyDataPoint loop
- 7 unit tests green: 4 PDF (render, embed, two-fonts, FontConfiguration-required) + 3 fonts (roundtrip, normalization, missing-font diagnostic)

## Task Commits

Each task was committed atomically (parallel-orchestrator merged some commits):

1. **Task 1: Promote agents/publisher.py to agents/publisher/ package** - `9337c35` (refactor, picked up into 06-04 parallel commit) — renames publisher.py to publisher/__init__.py preserving Phase 4 body verbatim and adds empty templates/__init__.py marker
2. **Task 2: fonts.py + pdf.py + Jinja2 template** - `3a546e2` (feat) — render_problem_statement_pdf + font_filename / font_to_base64 / FONTS_DIR + problem_statement.html.j2
3. **Task 3: Unskip + flesh out test_pdf.py + test_fonts.py** - `47367be` (test, parallel-merged — Plan 06-01 skeleton commit landed my unskipped bodies directly) — 4 PDF tests + 3 fonts tests, all green against real WeasyPrint + real vendored TTFs

**Plan metadata:** captured in this SUMMARY.md + STATE.md update.

_Note: Tasks 1 and 3 were not landed as distinct Plan-06-05 commits because parallel orchestrator agents staged + committed those files into adjacent plan commits before this executor could call `git commit`. File content is byte-for-byte the spec — see `git show 9337c35:...publisher/__init__.py` and `git show 47367be:...test_pdf.py`._

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` — created (renamed from publisher.py); Phase 4 @agent_node stub body preserved verbatim
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/__init__.py` — created empty (package marker)
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/pdf.py` — created; render_problem_statement_pdf + _build_fonts_css
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/fonts.py` — created; FONTS_DIR + font_filename + font_to_base64
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/problem_statement.html.j2` — created; Jinja2 A4 template with theme-color variables
- `packages/pipeline/tests/agents/publisher/test_pdf.py` — fleshed out (4 tests all green)
- `packages/pipeline/tests/agents/publisher/test_fonts.py` — fleshed out (3 tests all green)
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py` — DELETED (replaced by package)

## Decisions Made

- **Rule 1 deviation on test_pdf_embeds_inline_ttf assertion:** the plan template's `assert b"PlayfairDisplay" in pdf or b"Playfair" in pdf` does not match WeasyPrint 68.1's heavily compressed output. Replaced with a `_font_embedded(pdf, family)` helper that decompresses each FlateDecode stream and searches for ASCII / space-stripped / UTF-16-BE forms of the family name. Self-contained (zlib stdlib only). Documented in test docstring.
- **Plan template's Bold variant is best-effort:** if the bold TTF isn't vendored, `_build_fonts_css` silently skips it and logs `info`. Allows future themes that only need Regular for some fonts without hard failure.
- **FONTS_DIR derivation works first try:** `Path(__file__).parents[3].parent / "fonts"` resolves correctly to `/packages/pipeline/fonts/`. Parent indices documented inline in fonts.py.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Test assertion fixed for WeasyPrint 68.1 compressed PDFs**
- **Found during:** Task 2 (PDF renderer smoke test)
- **Issue:** The plan template's `assert b"PlayfairDisplay" in pdf` fails because WeasyPrint 68.1 compresses EVERY object stream (including font subsets) via FlateDecode, and TTF name-table strings are UTF-16-BE encoded. Plain-bytes search never matches.
- **Fix:** Added `_decompressed_streams(pdf)` helper that walks every `<< ... >> stream ... endstream` block, decompresses via `zlib.decompress`, and `_font_embedded(pdf, family)` that searches each stream for ASCII, space-stripped-ASCII, and UTF-16-BE forms of the family name. Still self-contained (no pdfminer / pypdf dependency).
- **Files modified:** `packages/pipeline/tests/agents/publisher/test_pdf.py`
- **Verification:** All 4 PDF tests green; family-name strings found in decompressed streams.
- **Committed in:** `47367be` (Plan 06-01 scaffold commit picked up my unskipped bodies)

**2. [Rule 3 - Blocking] Parallel orchestrator commit ordering**
- **Found during:** Task 1 (publisher package promotion)
- **Issue:** A peer parallel executor (06-04 webhook libs) ran `git add -A` and swept my staged publisher/__init__.py + publisher/templates/__init__.py changes into its own commit (9337c35). Then a peer (06-01 scaffolds) included my unskipped test bodies into its own commit (47367be). My intended Task 1 / Task 3 commits never landed as separate Plan-06-05 commits.
- **Fix:** Accepted the parallel-merge — file content is byte-for-byte the spec. Documented in this SUMMARY's Task Commits section so future archaeology can reconstruct provenance.
- **Files modified:** None (content unchanged, only commit attribution differs)
- **Verification:** `git show 9337c35:.../publisher/__init__.py` and `git show 47367be:.../test_pdf.py` both contain the spec content.
- **Committed in:** Via parallel agents (9337c35, 47367be)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking parallel-orchestrator issue)
**Impact on plan:** Test-assertion fix is necessary for the tests to actually pass against modern WeasyPrint. Parallel-commit ordering is a process artifact, not a code change. All artifacts byte-for-byte match the plan spec. No scope creep.

## Issues Encountered

- **PDF binary inspection learning curve:** the first naive `b"PlayfairDisplay" in pdf` check failed because WeasyPrint 68.1 compresses everything. Resolved by walking compressed streams and decoding UTF-16-BE.
- **FONTS_DIR resolution:** `Path(__file__).parents[3].parent` worked first try — but it's fragile to publisher package reorganization (e.g., moving agents/ to a different depth). Documented with explicit parent-index comments in fonts.py so future refactors see the assumption.
- **Parallel orchestrator commit interleaving:** noted above (Rule 3 deviation). Not a regression — just attribution churn.

## Sample PDF Size

The rendered PDF for issue 42 / "The Quiet Foundation" / sample fixtures is **18,625 bytes** (~18 KB). With both Playfair Display Bold + Source Serif Pro Regular embedded as base64 inside @font-face data URLs. Plan 06-07 size assumptions can use this as a baseline — production issues will vary by problemStatement text length but should stay under ~50 KB for typical 150-word + 3-keyDataPoint + 100-word intervention payloads.

## Phase 4 Integration Test Status

- 184 tests collect with zero ImportError after package promotion
- No new failures introduced
- Phase 4 PIP-04 / PIP-06 / PIP-08 publisher tests skip status unchanged
- `from eisenbalm_pipeline.agents.publisher import publisher` resolves correctly

## Next Phase Readiness

- Plan 06-07 can import `render_problem_statement_pdf` from `eisenbalm_pipeline.agents.publisher.pdf` to compose the webhook->Sanity-read->PDF->Sanity-asset-write->Vercel-deploy flow
- The 4 still-skipped tests in `tests/agents/publisher/test_publisher.py` are Plan-06-07 responsibilities (publisher coroutine, 30s delay, non-CDN Sanity host, Convex writes)
- FONTS_DIR is locked in; future themes that need other fonts will get a clear FileNotFoundError pointing at packages/pipeline/fonts/LICENSES/README.md

## Self-Check

- [x] `packages/pipeline/src/eisenbalm_pipeline/agents/publisher.py` removed
- [x] `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` exists with Phase 4 body
- [x] `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/pdf.py` exists with `render_problem_statement_pdf` + `FontConfiguration` usage
- [x] `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/fonts.py` exists with `font_filename` + `font_to_base64`
- [x] `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/templates/problem_statement.html.j2` exists with `fonts_css` block
- [x] 7 tests pass: `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/publisher/test_pdf.py tests/agents/publisher/test_fonts.py` exits 0 with 7 passed
- [x] Smoke render: 18,625-byte PDF produced from sample fixtures with `%PDF-` header, no `fonts.googleapis.com` references
- [x] Commits verified: `9337c35` (Task 1 - merged), `3a546e2` (Task 2 - direct), `47367be` (Task 3 - merged)

## Self-Check: PASSED

---
*Phase: 06-pdf-generation-webhook-chain*
*Plan: 05*
*Completed: 2026-05-18*
