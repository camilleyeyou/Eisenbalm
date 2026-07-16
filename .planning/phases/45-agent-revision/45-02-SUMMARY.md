---
phase: 45-agent-revision
plan: 02
subsystem: api
tags: [fastapi, python, convex, sanity, cost-guard, refactor]

# Dependency graph
requires:
  - phase: 45-agent-revision (Plan 45-01)
    provides: docs/API_CONTRACTS.md §45 contract + Wave-0 test stubs (test_revision_endpoints.py import-skipped, test_budget.py skipif'd) this plan turns green/unlocked
provides:
  - "content.py::_patch_prose_span — the ONE claim-agnostic prose-patch apply core (span-resolve -> patch -> reset-touched-claims-first)"
  - "content.py::_section_blocks — relocated, section-name-generic (blocks, field_path) resolver"
  - "factcheck.py::_patch_claim_prose — now a thin wrapper delegating to _patch_prose_span"
  - "budget.py::would_exceed_run_cap — REV-05 per-issue cost-guard predicate reading durable agentRuns:byRunId"
  - "llm_config.py — 'revision' registered in MODEL_BY_AGENT + SAMPLING_BY_AGENT"
affects: [45-03 (pipeline-revision-endpoint — pure composition over these primitives), 45-06 (cost-vs-budget readout)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Claim-agnostic apply-path extraction: a passage-mutation core lives once in content.py; per-caller wrappers (factcheck.py today, revision.py in 45-03) unpack their own row shape into the shared core's flat (section_name, quoted_text, block_index_hint) parameters (D-01/D-20)."
    - "Caller-forwarded I/O seam for shared cores: _patch_prose_span accepts optional _get_issue_draft/_patch_issue_field overrides (default: None -> resolved via content.py's own globals at call time) so each router's existing test suite keeps monkeypatching ITS OWN module-local Sanity I/O binding without the shared core forking per-caller copies."
    - "Durable-over-ephemeral cost accounting: per-issue guards must sum Convex agentRuns:byRunId, never a pipeline-local in-memory cost store that gets cleared before human-review stages begin."

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py
    - packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/budget.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py
    - packages/pipeline/tests/test_budget.py
    - .planning/phases/45-agent-revision/deferred-items.md

key-decisions:
  - "Gave _patch_prose_span an optional _get_issue_draft/_patch_issue_field caller-injection seam (not in the plan's literal signature) to preserve the existing FCT-06 test suite's monkeypatch strategy (which patches factcheck.py's own imported bindings, not content.py's) without forking a second apply-path implementation."
  - "MAX_TOKENS_BY_AGENT gets no 'revision' entry, mirroring 'qa' (also absent there) — the default OpenRouter token cap applies."

requirements-completed: [REV-04, REV-05]

# Metrics
duration: 25min
completed: 2026-07-16
---

# Phase 45 Plan 02: Pipeline Shared Prose-Patch Core and Cost Primitives Summary

**Extracted `content.py::_patch_prose_span` as the one claim-agnostic apply path both the existing claim endpoints and Plan 45-03's passage-revision endpoint will share, plus a durable-`agentRuns`-backed `would_exceed_run_cap` cost guard and a registered `"revision"` LLM agent identity.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-16
- **Tasks:** 2
- **Files modified:** 5 code files + 1 phase-tracking doc

## Accomplishments

- `content.py` now owns the ONE prose-patch apply implementation (`_patch_prose_span` + relocated `_section_blocks`); `factcheck.py::_patch_claim_prose` is a 20-line wrapper that unpacks a claim dict into the shared core's flat parameters — zero forked logic (D-01/D-20).
- `budget.py::would_exceed_run_cap` sums durable `agentRuns:byRunId` rows (never the in-memory, Publisher-cleared `lib/cost.py` store) and returns the `would_exceed_monthly_cap`-shaped `(over, info)` tuple REV-05's 409 guard needs.
- `"revision"` is now a registered `MODEL_BY_AGENT`/`SAMPLING_BY_AGENT` identity (voice-critical pin, mirrors `"qa"`'s low-temperature sampling), so 45-03's `acomplete(agent_id="revision", ...)` calls will not `KeyError`.
- The Wave-0 `test_budget.py`'s 3 `run_cap` tests flipped from `skipif`'d to green; the skip guard itself was removed per the plan.

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract `_patch_prose_span` + `_section_blocks` into content.py; make `_patch_claim_prose` a wrapper** - `e88bfa1` (feat)
2. **Task 2: `would_exceed_run_cap` predicate + `'revision'` agent registration** - `637ec74` (feat)

**Plan metadata:** (this commit) `docs: complete plan`

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/api/content.py` - adds `_section_blocks` (relocated) + `_patch_prose_span` (extracted claim-agnostic core), plus a new `resolve_span` import
- `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py` - removes the local `_LONG_READ_SECTIONS`/`_claim_section_blocks` duplicate; `_patch_claim_prose` becomes a thin wrapper over `content._patch_prose_span`, forwarding its own `get_issue_draft`/`patch_issue_field` bindings
- `packages/pipeline/src/eisenbalm_pipeline/lib/budget.py` - adds `_DEFAULT_REVISION_COST_ESTIMATE_USD` + `would_exceed_run_cap`
- `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` - adds `"revision"` to `MODEL_BY_AGENT` and `SAMPLING_BY_AGENT`
- `packages/pipeline/tests/test_budget.py` - removes the Wave-0 `skipif` guard (module docstring updated); the 3 `run_cap` tests were already real assertions and now run unconditionally
- `.planning/phases/45-agent-revision/deferred-items.md` - re-confirms the pre-existing, unrelated `respx` collection error and records the updated full-suite pass/skip counts

## Decisions Made

- **Caller-forwarded I/O seam, not a signature deviation for its own sake:** `_patch_prose_span` takes optional `_get_issue_draft`/`_patch_issue_field` keyword params (default `None`, resolved via content.py's own module globals at call time when absent). This was required, not cosmetic — see Deviations below; without it the existing FCT-06 suite regresses because `test_factcheck_endpoints.py` monkeypatches `factcheck.get_issue_draft`/`factcheck.patch_issue_field` (factcheck.py's OWN imported bindings), which have zero effect on a function body that resolves those names via `content.py`'s separate module namespace. `factcheck.py`'s wrapper now explicitly forwards its own current bindings so the shared core still honors each router's patchable Sanity I/O seam.
- **`MAX_TOKENS_BY_AGENT` left untouched for `"revision"`:** mirrors `"qa"`, which also has no entry there (falls through to OpenRouter's default cap) — consistent with the plan's "mirroring the qa values" instruction where qa itself is absent from that particular dict.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `_patch_prose_span`'s literal-as-specified design broke the existing FCT-06 regression suite**
- **Found during:** Task 1, running `pytest tests/test_factcheck_endpoints.py -x` per the task's own verification step
- **Issue:** The plan's action text specifies `_patch_prose_span` calling the bare names `get_issue_draft`/`patch_issue_field` (resolved via content.py's own module globals at call time). `test_factcheck_endpoints.py`'s `_wire()` helper monkeypatches `factcheck.get_issue_draft`/`factcheck.patch_issue_field` — a DIFFERENT module's namespace attribute. Once `_patch_claim_prose`'s real logic moved into content.py, those two names in factcheck.py's own namespace became dead (nothing in factcheck.py called them anymore), so the test's monkeypatch had zero effect: the REAL (unmocked) `get_issue_draft` ran, returned an unrelated/empty draft shape (because the also-globally-patched `_sc._groq` mock in that test file returns charity-lookup fields, not a real draft document), and `resolve_span` 409'd with `span_not_resolved` on a test that expected 200. Reproduced and confirmed exactly this failure mode (`test_patch_with_text_ordering_reset_before_terminal_status` failed 409 instead of 200) before applying the fix.
- **Fix:** Added two optional keyword parameters to `_patch_prose_span` (`_get_issue_draft`, `_patch_issue_field`, default `None`) that fall back to content.py's own bare-name lookup (`_get_issue_draft or get_issue_draft`) evaluated at call time when absent. `factcheck.py`'s thin wrapper now explicitly passes its own current `get_issue_draft`/`patch_issue_field` bindings through, so the test's monkeypatch of `factcheck.get_issue_draft`/`factcheck.patch_issue_field` is picked up exactly as before the refactor. This also pre-empts the identical risk for Plan 45-03's `api/revision.py` (its Wave-0 `test_revision_endpoints.py` stub monkeypatches `revision.get_issue_draft`/`revision.patch_issue_field` in the same pattern) — 45-03's wrapper should forward its own bindings the same way.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/api/content.py`, `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py`
- **Verification:** `pytest tests/test_factcheck_endpoints.py -x` — 26/26 passed (was 1 failure before the fix). Full suite re-run after: 578 passed / 37 skipped (0 failed), matching the pre-change baseline plus the 3 newly-unlocked `run_cap` tests from Task 2.
- **Committed in:** `e88bfa1` (Task 1 commit — the fix is part of the same task, not a separate commit, since it was discovered and resolved before the task's own verification gate passed)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for the plan's own explicit "zero regression" acceptance criterion. No scope creep — the fix is a narrow, backward-compatible seam addition to the exact function the plan specifies, not a redesign.

## Issues Encountered

None beyond the deviation above (which was found via the plan's own prescribed verification step, not separately discovered).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 45-03 (`api/revision.py`) can now compose `content.py::_patch_prose_span` directly for the passage-revision apply path (§45.4) and `budget.py::would_exceed_run_cap` for the preview 409 guard (§45.5) — both primitives are green and match their documented shapes exactly.
- Flagging forward: 45-03's own wrapper/handler should forward its own `get_issue_draft`/`patch_issue_field` bindings into `_patch_prose_span` the same way `factcheck.py`'s wrapper now does, since its Wave-0 `test_revision_endpoints.py` stub monkeypatches `revision.get_issue_draft`/`revision.patch_issue_field` in the identical pattern that motivated this plan's Deviation #1.
- `tests/lib/test_vercel_client.py`'s pre-existing `respx` import error remains unresolved (out of scope, tracked in `deferred-items.md`) — full-suite verification for this and future plans should keep using `--ignore=tests/lib/test_vercel_client.py` until that dependency gap is addressed separately.

---
*Phase: 45-agent-revision*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: `packages/pipeline/src/eisenbalm_pipeline/api/content.py`
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py`
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/lib/budget.py`
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py`
- FOUND: `packages/pipeline/tests/test_budget.py`
- FOUND: `.planning/phases/45-agent-revision/deferred-items.md`
- FOUND: `.planning/phases/45-agent-revision/45-02-SUMMARY.md`
- FOUND commit: `e88bfa1`
- FOUND commit: `637ec74`
