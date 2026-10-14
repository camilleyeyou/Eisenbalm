# Quick 261014-kor: Stop Scout registry dedup from emptying candidates

**One-liner:** Scout dedup now ignores aggregator (guidestar.org etc.) and degenerate ("." / dotless) domains on both candidate and registry sides, with removal logging and accurate empty-candidates interrupt text.

## Changes
- `scout.py`: `_NON_IDENTITY_HOSTS`, `_is_usable_domain()` (dot-boundary subdomain match); applied in `_candidate_keys` and `_load_registry_keys`; per-candidate INFO log with matched keys and WARNING when dedup removes all.
- `verify_candidates.py`: start/done count logging (input, survivors, killed).
- `editor.py`: interrupt prompt/transcript/decision text now say "No candidates survived Scout dedup and verification"; `reason` "all-candidates-killed" and payload unchanged.
- `tests/agents/test_scout_dedup_domains.py`: 19 new regression tests.

## Verification
Full pipeline suite: 820 passed, 38 skipped, 0 failures (baseline 802 passed).

## Deviations
None.

## Notes
Convex registry rows "through evely's eyes" (domain guidestar.org) and "be a dear and donate a brassiere" (domain ".") still store those domains; now harmless (filtered at load). Could be cleaned later via a Convex data fix. No Convex code or data was touched.
