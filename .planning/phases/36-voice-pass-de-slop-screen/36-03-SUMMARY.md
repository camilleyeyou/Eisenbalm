---
phase: 36-voice-pass-de-slop-screen
plan: 03
subsystem: api
tags: [fastapi, convex, openrouter, qa-corrections, voice-pass]

# Dependency graph
requires:
  - phase: 36-voice-pass-de-slop-screen
    plan: 01
    provides: docs/API_CONTRACTS.md §36 contract (§36.4/§36.5/§36.6 shapes this plan implements verbatim) + machine-tell/structural-variety Convex axis literals
  - phase: 33-accept-fix-wiring-decision-rail
    provides: api/findings.py accept/dismiss/reopen endpoints + _AcceptBody this plan extends
  - phase: 5-agent-quality
    provides: agents/qa/judge.py::run_llm_judge (the judge this plan re-invokes on demand, never a new detector)
provides:
  - "api/voice_pass.py — POST /issues/{run_id}/voice-recheck (§36.4) + POST /issues/{run_id}/voice-rewrite (§36.5), registered on the FastAPI app"
  - "_AcceptBody.suggestedFixOverride (§36.6) — lets a rule-only tell (no stored suggestedFix) be applied through the existing accept path"
affects: [36-04-voice-pass-screen, 36-06-rewrite-popover-signoff]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "On-demand detector re-invocation: voice-recheck calls the EXISTING run_llm_judge (narrator=None) rather than building a parallel detector — VOX-04's binding reuse mandate"
    - "Dedup-by-supersede: before writing fresh on-demand findings, any still-open row from the SAME on-demand agentId is dismissed first (resolutionReason='superseded by re-check'), so repeated clicks never inflate the tell count"
    - "Text-generation-only endpoint: voice-rewrite calls acomplete and returns text — it never mutates Convex or Sanity; the caller applies the result through the pre-existing accept mutation via a body override field"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py
    - packages/pipeline/tests/test_voice_pass_endpoints.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py
    - packages/pipeline/src/eisenbalm_pipeline/api/findings.py
    - packages/pipeline/tests/test_findings_endpoints.py

key-decisions:
  - "Used the RAISING convex_mutation (not convex_mutation_safe) for every voice-recheck write — a live, synchronous, operator-triggered call must surface a Convex failure loudly rather than let the operator believe they got a fresh check when they got nothing (Research Pitfall 1's exact failure mode)."
  - "narrator is hardcoded to None in the voice-recheck call to run_llm_judge — narrator resolution is an in-memory, run-start-only concern with no persisted queryable record, so None is the documented byte-compatible legacy default (NRR-10), not a shortcut."

requirements-completed: [VOX-02, VOX-04]

# Metrics
duration: ~12min
completed: 2026-07-09
---

# Phase 36 Plan 03: Voice Pass On-Demand Endpoints Summary

**New `api/voice_pass.py` router (voice-recheck re-runs the existing Opus judge with dedup-supersede; voice-rewrite generates a house-voice suggestion via `acomplete`) plus `_AcceptBody.suggestedFixOverride` so a rule-only tell can be accepted through the existing Phase 33 accept path — zero new detector, zero new mutation.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 3 completed
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments
- `POST /issues/{run_id}/voice-recheck` re-reads the current (post-edit) Sanity draft via the existing `get_issue_draft`, flattens it into the same six-section shape the pipeline QA judge expects (`_draft_to_qa_sections`, mirroring `agents/qa/__init__.py::_extract_sections`), supersedes any still-open prior `agentId="qa-recheck"` findings (dismissed with `resolutionReason="superseded by re-check"`), then calls the EXISTING `run_llm_judge(narrator=None)` and writes fresh `qaCorrections` rows tagged `agentId="qa-recheck"` — repeated clicks never double the tell count, and rule-layer (`agentId="qa"`) findings are never touched
- `POST /issues/{run_id}/voice-rewrite` loads one finding by id (404 on missing/wrong-run), builds a rewrite instruction under `VOICE_CONSTRAINTS` over the finding's `quotedSpan`, and calls the existing `acomplete(agent_id="qa", ...)` wrapper (cost-recorded, never a raw OpenRouter/Anthropic client) to generate a structured `{suggestedFix}` — the endpoint only generates text; it never mutates the draft or the finding
- `api/findings.py::_AcceptBody` gains `suggestedFixOverride: Optional[str] = None`; `accept_finding` now resolves `suggested_fix = body.suggestedFixOverride or finding.get("suggestedFix")`, letting a Layer-1 rule finding (which never carries a stored `suggestedFix`) be accepted with an on-demand voice-rewrite result through the exact same span-resolve → patch → resolution-flip → audit flow as every other accept — no new mutation path

## Task Commits

Each task was committed atomically (TDD RED → GREEN per task):

1. **Task 1: voice-recheck endpoint (§36.4)** - `0206f42` (test, RED) + `3831623` (feat, GREEN)
2. **Task 2: voice-rewrite endpoint (§36.5)** - `ea92fcf` (test, RED) + `91141ff` (feat, GREEN)
3. **Task 3: accept_finding honors suggestedFixOverride (§36.6)** - `58a7437` (test, RED) + `e2fe063` (feat, GREEN)

**Plan metadata:** (this commit) - docs: complete plan

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py` - New router: `_draft_to_qa_sections` helper + `POST /issues/{run_id}/voice-recheck` + `POST /issues/{run_id}/voice-rewrite`
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` - `voice_pass` added to the router import tuple + `app.include_router(voice_pass.router)`
- `packages/pipeline/src/eisenbalm_pipeline/api/findings.py` - `_AcceptBody.suggestedFixOverride` field + one-line `suggested_fix` resolution change in `accept_finding`
- `packages/pipeline/tests/test_voice_pass_endpoints.py` - 10 tests: recheck dedup/supersede/rule-layer-exclusion/404/409, rewrite happy-path/404s/agent-id-and-quotedSpan-in-prompt, router registration
- `packages/pipeline/tests/test_findings_endpoints.py` - 3 new tests: override applies with no stored fix, no-override regression uses stored fix unchanged, 409 when neither is present

## Decisions Made
- Kept both endpoints in the single `api/voice_pass.py` module the plan specified (rather than splitting), since §36.4 and §36.5 share the router, the Clerk-JWT guard, and the audit/convex plumbing — no separate file gains anything.
- No new Pydantic response model for `voice-recheck`'s return shape — it returns a plain `{"runId": ..., "findingCount": ...}` dict exactly per §36.4, matching the existing plain-dict return convention in `findings.py`/`signoffs.py`.

## Deviations from Plan

None — plan executed exactly as written. All three tasks matched their `<action>`/`<acceptance_criteria>`/`<verify>` blocks with no auto-fixes required. §36.2/§36.3/§36.7 (Layer-1 axis passthrough, axis partition, sign-off prerequisite partition) were already implemented in Plan 36-02 and Plan 36-05 respectively, so this plan's scope stayed exactly to §36.4/§36.5/§36.6 as specified.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. The new endpoints reuse the already-configured Clerk JWT guard, Convex client, Sanity client, and OpenRouter client — no new environment variables or dashboard steps.

## Next Phase Readiness

- `docs/API_CONTRACTS.md` §36.4/§36.5/§36.6 are now fully implemented and tested — Plan 36-04 (Voice Pass screen) and Plan 36-06 (rewrite popover + sign-off) can call `POST /issues/{run_id}/voice-recheck`, `POST /issues/{run_id}/voice-rewrite`, and the extended accept endpoint exactly as documented, with no shape left to invent.
- Reconciliation note (Phase 35 lesson / Pitfall 7, per this plan's own `<verification>` block): this plan ran in Wave 2 alongside 36-02/36-04. Its changes to `api/voice_pass.py`, `api/main.py`, and `api/findings.py` are committed directly to `master` (no worktree was used for this execution) — no reconciliation step is needed before Wave 3 for this plan's files specifically, but confirm 36-04's own changes land on `master` before 36-06 begins.
- Full `packages/pipeline` pytest suite: **493 passed, 36 skipped** (pre-existing skips/warnings unrelated to this plan) — zero regressions.

---
*Phase: 36-voice-pass-de-slop-screen*
*Completed: 2026-07-09*

## Self-Check: PASSED

All claimed files exist on disk (`packages/pipeline/src/eisenbalm_pipeline/api/voice_pass.py`,
`packages/pipeline/tests/test_voice_pass_endpoints.py`,
`packages/pipeline/src/eisenbalm_pipeline/api/main.py`,
`packages/pipeline/src/eisenbalm_pipeline/api/findings.py`,
`packages/pipeline/tests/test_findings_endpoints.py`, this SUMMARY.md). All
claimed commit hashes (`0206f42`, `3831623`, `ea92fcf`, `91141ff`, `58a7437`,
`e2fe063`) are present in `git log --oneline --all`.
