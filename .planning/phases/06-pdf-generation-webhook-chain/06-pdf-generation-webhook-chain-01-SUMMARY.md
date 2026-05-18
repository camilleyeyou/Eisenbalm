---
phase: 06-pdf-generation-webhook-chain
plan: 01
subsystem: tests
tags: [pytest, fixtures, scaffolding, skip-markers, conftest, hmac-helper, weasyprint, ttf]

# Dependency graph
requires:
  - phase: 05-agent-quality
    provides: "ProblemWriter's PdfContent shape and DesignAgent's theme shape (used by sample_pdf_content.json and sample_theme.json fixtures)"
provides:
  - "Skip-marked pytest skeletons for every PDF-* and WHK-* requirement — Wave 0 contract layer"
  - "encode_sanity_signature helper in conftest.py — canonical HMAC encoder for downstream signature tests"
  - "Vendored fixtures: tiny.ttf (Liberation Sans), sample_pdf_content.json (Phase 5 PdfContent shape), sample_theme.json (2 whitelist fonts + 4 valid hex)"
  - "tests/agents/publisher/ + tests/api/ package skeletons (Python-importable)"
affects: [06-04-webhook-and-idempotency-libs, 06-05-publisher-package-and-pdf-renderer, 06-07-webhook-and-publisher-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 scaffolding pattern — skip-marked tests checked in BEFORE implementation lock in test names and prevent plan-vs-codebase drift (Phase 5 regression — kwargs-mismatch hit 7+ plans)"
    - "Canonical helper in conftest.py — encode_sanity_signature implementation used by both tests/api/ and tests/lib/ to keep signature encoding in one place"
    - "Vendored font fixture (tiny.ttf) — eliminates network dependency for WeasyPrint @font-face round-trip tests"

key-files:
  created:
    - "packages/pipeline/tests/agents/publisher/__init__.py"
    - "packages/pipeline/tests/agents/publisher/fixtures/__init__.py"
    - "packages/pipeline/tests/agents/publisher/fixtures/sample_pdf_content.json"
    - "packages/pipeline/tests/agents/publisher/fixtures/sample_theme.json"
    - "packages/pipeline/tests/agents/publisher/fixtures/tiny.ttf"
    - "packages/pipeline/tests/agents/publisher/test_pdf.py"
    - "packages/pipeline/tests/agents/publisher/test_publisher.py"
    - "packages/pipeline/tests/agents/publisher/test_fonts.py"
    - "packages/pipeline/tests/api/__init__.py"
    - "packages/pipeline/tests/api/test_webhook_sanity.py"
    - "packages/pipeline/tests/api/test_runs.py"
    - "packages/pipeline/tests/lib/test_sanity_webhook.py"
    - "packages/pipeline/tests/lib/test_idempotency.py"
    - "packages/pipeline/tests/lib/test_vercel_client.py"
  modified:
    - "packages/pipeline/tests/conftest.py — encode_sanity_signature helper + webhook_idempotency fixture stub"

key-decisions:
  - "Test names are LOCKED in Plan 06-01 — downstream plans (06-05, 06-07) unskip + flesh out bodies, never rename"
  - "Tiny TTF (Liberation Sans Regular) vendored under fixtures/ to keep WeasyPrint @font-face tests offline and fast"
  - "Sample fixtures match Phase 5 ProblemWriter (PdfContent: 3 keyDataPoints) and DesignAgent (4 hex + 2 fonts from whitelist) shapes exactly"

patterns-established:
  - "Wave 0 = checked-in test contracts before any production code, downstream unskip-only"

requirements-touched:
  - "PDF-01 (scaffolded — unskipped by 06-05)"
  - "PDF-02 (scaffolded — unskipped by 06-05)"
  - "PDF-03 (scaffolded — unskipped by 06-07)"
  - "PDF-04 (scaffolded)"
  - "WHK-01 through WHK-08 (scaffolded — unskipped by 06-04 and 06-07)"

# Execution
tasks-completed:
  - "Task 1: vendor fixtures + tiny TTF"
  - "Task 2: extend conftest.py with encode_sanity_signature + webhook_idempotency stub"
  - "Task 3: add skip-marked test skeletons for every PDF-* and WHK-* requirement"

commits:
  - "0408f16 test(06-01): vendor publisher/api test fixtures and tiny.ttf"
  - "ffa6096 test(06-01): extend conftest.py with Phase 6 fixtures"
  - "47367be test(06-01): add skip-marked test skeletons for PDF + webhook chain"

deviations:
  - "Original executor agent hit usage limit before committing Task 3 (test skeletons); orchestrator committed them and authored this SUMMARY post-hoc. All 14 files from plan key-files.created are now tracked; pytest --collect-only reports 184 tests with zero ImportError."
  - "By the time the orchestrator inspected the working tree, Plan 06-05 had already unskipped + filled bodies for test_pdf.py and test_fonts.py — they landed in commit 47367be under 06-01's commit message rather than under a separate 06-05 unskip commit. The functional outcome (7 tests passing) is correct; the git history attributes the unskip to the wrong plan."

verification:
  - "pytest --collect-only succeeds: 184 tests collected, 0 errors"
  - "All test_*.py files import-clean (no ImportError at collection time)"
  - "Fixture files exist on disk: tiny.ttf valid TrueType, sample_*.json valid JSON"
  - "encode_sanity_signature helper present in tests/conftest.py and usable from tests/api/ + tests/lib/"
