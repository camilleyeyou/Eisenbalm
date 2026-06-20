---
phase: quick-260620-gfa
verified: 2026-06-20T00:00:00Z
status: passed
score: 6/6 truths verified
---

# Quick Task: Fix Weekly Issue Numbering Auto-Increment — Verification Report

**Task Goal:** Fix POST /run/weekly so an omitted issueNumber resolves to max(existing weeklyIssue.issueNumber)+1 (unique `issue-{N}` doc) instead of hardcoded 999; explicit issueNumber honored verbatim with no Sanity read; empty dataset falls back to base; Sanity read failure fails loudly.
**Verified:** 2026-06-20
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Empty body `{}` resolves UNIQUE number = max+1, never fixed 999 | ✓ VERIFIED | `_resolve_issue_number` (runs.py:44-80) returns `(max_num + 1)`; `RunWeeklyBody.issueNumber: Optional[int] = None` (L88); no `999` literal remains. Test `test_resolve_issue_number_auto_increments_from_max_list` → 8, `..._dict` → 13 (both pass). |
| 2 | Explicit issueNumber honored verbatim, NO Sanity read | ✓ VERIFIED | runs.py:64-65 returns `body_issue_number` before the local groq_query import. Test `test_resolve_issue_number_explicit_override_skips_read` asserts `==42` AND `fake_groq.assert_not_awaited()` (passes). |
| 3 | Empty dataset falls back to base 1 | ✓ VERIFIED | runs.py:79-80 `max_num = doc.get(...) if doc else None` → `return ... if isinstance(max_num,int) else 1`. Test `test_resolve_issue_number_empty_dataset_base_one` → 1 (passes). |
| 4 | Sanity read failure on auto path raises (5xx), no silent collide | ✓ VERIFIED | No try/except around `await groq_query(...)` (runs.py:71); error propagates. Test `test_resolve_issue_number_read_failure_propagates` uses `side_effect=RuntimeError` and `pytest.raises(RuntimeError)` (passes). |
| 5 | Resolved number used for BOTH Convex pipelineRuns:create AND initial_state, resolved before either | ✓ VERIFIED | runs.py:191 `issue_number = await _resolve_issue_number(body.issueNumber)` precedes `new_run_id()` (L194), Convex `"issueNumber": issue_number` (L209), and `initial_state["issue_number": issue_number]` (L217). |
| 6 | Existing pytest suite stays green (explicit-number + narratorSlug tests unaffected) | ✓ VERIFIED | `tests/api/test_runs.py`: 8 passed, 4 skipped. Full suite (excl. pre-existing respx error): 233 passed, 33 skipped, 0 failures. |

**Score:** 6/6 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` | `RunWeeklyBody.issueNumber: Optional[int]=None` + `_resolve_issue_number` wired before Convex row/initial_state | ✓ VERIFIED | Contains `_resolve_issue_number` (L44), `QUERY_MAX_ISSUE_NUMBER` (L39), GROQ `order(issueNumber desc)` (L40); `Optional[int] = None` (L88); no `999`. |
| `packages/pipeline/tests/api/test_runs.py` | Unit tests for max+1, empty base, override-skips-read, read-failure-raises, default-None | ✓ VERIFIED | Contains all 5 named tests (L147-221) + both dict/list normalization shapes; `_resolve_issue_number` imported. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `run_weekly` | `lib.sanity_client.groq_query` | `_resolve_issue_number` GROQ on None | ✓ WIRED | Local import `from eisenbalm_pipeline.lib.sanity_client import groq_query` (runs.py:69), `await groq_query(QUERY_MAX_ISSUE_NUMBER)` (L71). |
| `run_weekly` | Convex `pipelineRuns:create` + `initial_state.issue_number` | resolved `issue_number` var for both | ✓ WIRED | Single resolve (L191) consumed at L209 and L217. |

### Out-of-Scope Confirmation

| Item | Status | Evidence |
| ---- | ------ | -------- |
| `lib/sanity_client.py` id/slug construction unchanged | ✓ CONFIRMED | `git status --short` shows no modification. `issue_id = f"issue-{state['issue_number']}"` (L174) + matching slug (L182) via `createOrReplace` — unique `issue_number` → unique `issue-{N}` doc id, which is exactly what the fix leverages. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Targeted suite green | `python -m pytest tests/api/test_runs.py -q` | 8 passed, 4 skipped | ✓ PASS |
| 5 auto-increment unit tests | (per-test -v) | all 5 PASSED | ✓ PASS |
| Broader suite no regressions | `pytest tests/ -q --ignore=tests/lib/test_vercel_client.py` | 233 passed, 33 skipped, 0 failed | ✓ PASS |

### Anti-Patterns Found

None. No swallowed exceptions on the auto path, no hardcoded fallback number, no new HTTP client introduced.

### Notes

- The 4 skips in `test_runs.py` are env-dependent `client`-fixture tests (narratorSlug e2e, trigger-secret), consistent with the plan's documented acceptable skips — not regressions from this change.
- A suite-wide collection error exists in `tests/lib/test_vercel_client.py` (`ModuleNotFoundError: respx`) — pre-existing, unrelated to this task, and isolated to a module not touched here.

### Gaps Summary

No gaps. All six observable truths verified against the actual working-tree code, both artifacts present and substantive, both key links wired, out-of-scope `sanity_client.py` confirmed untouched and correctly leveraged, and the test suite is green.

---

_Verified: 2026-06-20_
_Verifier: Claude (gsd-verifier)_
