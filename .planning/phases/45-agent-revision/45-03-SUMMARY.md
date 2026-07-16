---
phase: 45-agent-revision
plan: 03
subsystem: api
tags: [fastapi, python, convex, sanity, openrouter, cost-guard, revision]

# Dependency graph
requires:
  - phase: 45-agent-revision (Plan 45-01)
    provides: docs/API_CONTRACTS.md §45 contract + Wave-0 test_revision_endpoints.py stub this plan turns green
  - phase: 45-agent-revision (Plan 45-02)
    provides: content.py::_patch_prose_span (claim-agnostic apply core, caller-forwarded I/O seam), budget.py::would_exceed_run_cap, "revision" registered in llm_config.py
provides:
  - "api/revision.py — POST /issues/{run_id}/revise/preview + POST /issues/{run_id}/revise/apply, the passage-scoped generalization of §42.4a's FCT-06 claim-scoped preview/apply pair"
  - "_build_directive — one parametrized house-voice directive per the 7 DirectionChip identifiers (never a bare undirected rewrite)"
  - "revision.router mounted in api/main.py alongside factcheck.router"
affects: [45-04 (frontend-revision-flow-kit — the client this endpoint pair serves), 45-05 (passage-toolbar-and-surface-wiring), 45-06 (cost-vs-budget readout — reads the same agentRuns:byRunId rows this plan writes), 45-07 (integration-gate)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Passage-scoped endpoint pair composes 45-02's primitives rather than reimplementing them: preview mirrors voice_pass.py::voice_rewrite's read-only structured-output shape; apply forwards revision.py's own get_issue_draft/patch_issue_field bindings into the shared content.py::_patch_prose_span core exactly as factcheck.py's wrapper does (the caller-forwarded I/O seam 45-02 built specifically to support this)."
    - "Cost-cap guard runs BEFORE the LLM call (would_exceed_run_cap against durable agentRuns:byRunId, never lib/cost.py's in-memory store); cost recording runs AFTER, under the real run_id with a freshly-generated revision-{uuid} agentKey so agentRuns:completed's upsert-by-(runId,agentKey) never overwrites a real pipeline agent's row."
    - "Best-effort external-context fetch (\"Match the brief\" degradation) wrapped in a narrow try/except returning empty string on any failure — never blocks or crashes the read-only preview path."

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/api/revision.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py

key-decisions:
  - "\"Match the brief\" degraded context sources theme.visualDirection (the one style_brief field the DesignAgent persists to Sanity) plus the winning charity's missionStatement/focusArea/scoutNotes (scoutNotes is the closest existing Sanity-schema proxy for \"why overlooked\" — the DispatchState-only whyOverlooked field the RESEARCH doc names has no persisted Sanity counterpart). Wrapped in try/except so a Sanity round-trip failure degrades to an empty string rather than crashing the preview endpoint."
  - "Removed all literal occurrences of the word \"Regenerate\" from revision.py's comments/docstrings (rephrased as \"undirected rewrite action\") to satisfy the plan's exact grep-based acceptance criterion, while preserving the same documented intent (never a bare undirected regenerate)."
  - "Split the single-file implementation into two atomic commits matching the plan's two tasks: Task 1 (preview + directive builder + cost guard/recording, with get_issue_draft/patch_issue_field imported-but-unused ahead of Task 2 since the shared test-file `_wire()` helper monkeypatches them for every test in the module) then Task 2 (apply endpoint + main.py router mount)."

requirements-completed: [REV-02, REV-03, REV-04, REV-05]

# Metrics
duration: 25min
completed: 2026-07-16
---

# Phase 45 Plan 03: Pipeline Revision Endpoint Summary

**`api/revision.py` — the passage-scoped `revise/preview`/`revise/apply` endpoint pair generalizing FCT-06's claim-scoped contract, with a parametrized 7-chip house-voice prompt, a pre-call per-issue cost guard, and durable per-call cost recording under the real run_id.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-07-16
- **Tasks:** 2
- **Files modified:** 1 created (`api/revision.py`), 1 modified (`api/main.py`)

## Accomplishments

- `POST /issues/{run_id}/revise/preview` runs ONE parametrized house-voice direction-chip prompt (`_build_directive` covering all 7 `DirectionChip` identifiers: `make_clearer`/`make_more_specific`/`tighten`/`match_brief`/`reduce_repetition`/`try_another_approach`/`custom`), returns `{proposedText, whatChanged, claimDelta}`, mutates nothing and writes no audit row, and 409s `cost_cap_exceeded` via `would_exceed_run_cap` BEFORE spending an LLM call.
- Every preview LLM call records its own cost durably under the issue's REAL `run_id` with a freshly-generated `revision-{uuid4().hex[:12]}` `agentKey` via `agentRuns:completed` — never a throwaway pseudo-run-id, never a reused pipeline agentKey that would silently overwrite a real agent's historical cost row.
- `POST /issues/{run_id}/revise/apply` delegates to the SAME shared apply core (`content.py::_patch_prose_span`, built in Plan 45-02) that `factcheck.py`'s claim-scoped path calls — span-resolve against current Sanity content, content-patch, reset touched claims first, then revoke active sign-offs, then emit exactly one `passage_revised` audit row. 409s `revision_mismatch` on a stale `ifRevisionID` and `span_not_resolved` on an unresolvable quoted passage.
- `revision.router` mounted in `api/main.py` alongside `factcheck.router`; the full pipeline test suite (585 passed, 36 skipped, 0 failed, `--ignore=tests/lib/test_vercel_client.py` per the pre-existing unrelated `respx` gap) and the FCT-06 regression suite (`test_factcheck_endpoints.py`, 26/26) both stay green.

## Task Commits

Each task was committed atomically:

1. **Task 1: revise/preview — direction-chip prompt, structured output, cost recording, cost guard** - `0d1a01e` (feat)
2. **Task 2: revise/apply (atomic + audited) + mount router in main.py** - `52c58b8` (feat)

**Plan metadata:** (this commit) `docs: complete plan`

_Note: revision.py's `get_issue_draft`/`patch_issue_field` imports land in the Task 1 commit (unused until Task 2) because the test file's shared `_wire()` fixture monkeypatches both names for every test in the module, including the Task-1-only preview/directive/cost_attribution subset._

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/api/revision.py` - `_build_directive` + `_RevisionPick`/`_RevisionClaimDelta` structured-output models, `_fetch_brief_context` (best-effort "Match the brief" degradation), `preview_passage_revision` (read-only, cost-guarded, cost-recording), `apply_passage_revision` (atomic + audited via the shared `_patch_prose_span` core)
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` - imports and mounts `revision.router` alongside the other 12 routers

## Decisions Made

- **"Match the brief" degraded context:** `theme.visualDirection` (the persisted DesignAgent carry-forward of `style_brief.visualDirection`) plus the winning charity's `missionStatement`/`focusArea`/`scoutNotes` GROQ-projected in one round-trip, wrapped in try/except so any Sanity failure (or, in tests, an un-awaitable `MagicMock` transport) silently degrades to an empty string rather than crashing the read-only preview path — `style_brief.voice` has no persisted Sanity/Convex counterpart at review time, so it is intentionally omitted from the degraded context rather than fabricated.
- **No literal "Regenerate" in the file:** the plan's acceptance criterion is a strict `grep`-based textual check across the whole file (not just the direction-chip identifiers/labels); rephrased two doc comments that had used the word descriptively ("never a bare Regenerate") to "never a bare undirected-rewrite action" — same documented intent, passes the literal grep.
- **Two-commit split matching the plan's two tasks:** wrote Task 1's content (preview + directive builder + cost guard/recording) first and verified it in isolation against the plan's exact Task 1 test command before committing, then added Task 2's apply endpoint + router mount as a second commit — both commits pass their respective `<acceptance_criteria>` greps and test selectors independently.

## Deviations from Plan

None - plan executed exactly as written. The one adjustment (removing the literal word "Regenerate" from comments) is a same-task correction made while satisfying the plan's own stated acceptance criterion, not a deviation from the plan's design or behavior.

## Issues Encountered

None beyond the one self-caught grep-criterion fix above (found via the plan's own prescribed acceptance-criteria check, corrected before committing Task 1).

## User Setup Required

None - no external service configuration required. `"revision"` was already registered in `MODEL_BY_AGENT`/`SAMPLING_BY_AGENT` by Plan 45-02, so no `KeyError` risk on the first real (non-stub) `acomplete(agent_id="revision", ...)` call.

## Next Phase Readiness

- Plan 45-04 (`frontend-revision-flow-kit`) can now build `revisionClient.ts` against the exact request/response shapes this plan implements verbatim from §45.2/§45.3/§45.4 — `sectionName`/`quotedText`/`blockIndexHint`/`direction`/`customDirection`/`priorProposals` for preview, `ifRevisionID`/`sectionName`/`quotedText`/`blockIndexHint`/`newText` for apply.
- Plan 45-06 (cost-vs-budget readout) reads the SAME `agentRuns:byRunId` rows this plan's preview endpoint writes to (via `agentRuns:completed`) — no additional pipeline-side wiring needed for that plan to surface revision spend in the header readout.
- `tests/lib/test_vercel_client.py`'s pre-existing `respx` import-error gap (documented in `deferred-items.md` by Plan 45-01/45-02) remains unresolved and out of scope — this plan's full-suite verification continued using `--ignore=tests/lib/test_vercel_client.py`, consistent with every prior plan in this phase.

---
*Phase: 45-agent-revision*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: `packages/pipeline/src/eisenbalm_pipeline/api/revision.py`
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/api/main.py`
- FOUND: `.planning/phases/45-agent-revision/45-03-SUMMARY.md`
- FOUND commit: `0d1a01e`
- FOUND commit: `52c58b8`
