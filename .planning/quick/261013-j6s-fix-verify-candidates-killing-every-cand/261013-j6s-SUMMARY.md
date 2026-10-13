# Quick 261013-j6s: Fix verify_candidates killing every candidate

**One-liner:** Press scan now uses an exact-phrase query and counts only third-party results that name the org (own domain excluded); only 404/410 domain answers kill, other 4xx become unverified.

## Root cause
Tavily returns ~10 results for almost any query, so `len(results)` hit 10/10 for any name and tripped the >=9 kill rule. 401/403/429 WAF blocks also counted as definitive dead domains.

## Changes
- `packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py`: added `_normalize`, `_mentions_org`, `_host`; `_obscurity_press_scan(name, website)` filters by relevance and own-host; `_check_domain_live` kills only on 404/410; kill-reason string and docstrings updated. Thresholds unchanged.
- `packages/pipeline/tests/agents/test_verify_candidates_relevance.py`: new mocked regression tests (relevance, own-domain exclusion, status codes, end-to-end survive/kill).

## Tasks / commits
- Task 1 and Task 2: single commit (see git log, "fix(quick-261013-j6s)"). Task 2 required no test edits; the full suite passed unchanged.

## Verification
Full suite: 750 passed, 38 skipped.

## Deviations
None. (Test fixtures needed the `score` field on `SearchResult`; fixed in the new test file.)

## Known Stubs
None.
