---
phase: 42-fact-check-stage
plan: 04
subsystem: api
tags: [fastapi, convex, sanity, fact-check, claims, provenance, agent-revision]

# Dependency graph
requires:
  - phase: 42-fact-check-stage
    plan: 01
    provides: "claim_checks additive fields (importance/changedSinceCheck/conflict) + the requirePipelineSecret-guarded claimChecks:byRunIdAndIndex/updateClaim/keepAsWritten/remove Convex functions this plan calls"
  - phase: 42-fact-check-stage
    plan: 03
    provides: "_reset_touched_claims + _touched_block_indices helpers in api/content.py, and claimChecks:markChanged registered in convex_client.py's pipeline-secret-guarded paths"
provides:
  - "New api/factcheck.py router: keep / PATCH claim (metadata-only or content-patch) / replace-source / remove — all Clerk-guarded, each writing one audit_log row"
  - "The two-step 'Ask agent for better evidence' contract: evidence/preview (read-only Tavily search + LLM index-selection) and evidence/apply (atomic content-patch + claim update + reset + audit) — the span-scoped agent-revision contract Phase 45 generalizes to arbitrary passage revision"
  - "factcheck.router mounted in api/main.py"
  - "claimChecks:updateClaim / keepAsWritten / remove registered in convex_client.py's pipeline-secret-guarded paths (closing the same class of gap Plan 42-03 found for markChanged)"
affects: [42-06, 42-07, 42-08, phase-45-agent-revision-generalization]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reset-touched-claims-then-terminal-status-LAST ordering: any endpoint that both content-patches a claim's own block AND sets that claim's terminal status calls _reset_touched_claims first, then claimChecks:updateClaim, then claimChecks:keepAsWritten last — so the explicit action always wins over the generic block-level reset (42-RESEARCH.md Pitfall 3)"
    - "Preview-then-apply agent revision, claim-scoped: evidence/preview clones voice_pass.py::voice_rewrite's read-only shape (zero mutation, zero audit); evidence/apply clones findings.py::accept_finding's span-resolve + scoped-patch + Convex-flip + audit shape"
    - "claim_checks.sectionName is already galley-vocabulary (originStory/problemStatement/founderBio/caseStudy/bonus) — no QA-style snake_case-to-draft-key mapping needed, unlike findings.py's _QA_SECTION_TO_DRAFT_KEY"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py
    - packages/pipeline/tests/test_factcheck_endpoints.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/api/main.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py

key-decisions:
  - "Keep/PATCH/replace-source/remove all use underscore-style audit action names (claim_kept, claim_edited, claim_source_replaced, claim_removed, claim_evidence_applied) matching the plan's explicit literal naming for keep/evidence-apply, extended consistently to the other three actions not explicitly named in the plan"
  - "PATCH's content-touching branch and evidence/apply both call claimChecks:keepAsWritten (status defaults to 'checked') as their terminal-status write — reusing the same Convex mutation Keep-as-written uses, since D-08's locked chip vocabulary has no separate state for 'edited' vs 'kept' vs 'confirmed'"
  - "_claim_snapshot() (a small truncated-JSON claim-row serializer) is the uniform before/after audit payload for all five factcheck actions, mirroring content.py's json.dumps(before/after) convention rather than findings.py's bare-string convention — needed because a claim row is a small dict, not a single string span"
  - "evidence/preview raises 409 no_evidence_found on an empty Tavily result set rather than crashing on an empty list index — a defensive addition beyond the plan's literal behavior list, justified as basic robustness (Rule 2)"

patterns-established:
  - "Any future claim-content-touching endpoint (e.g. a Phase 45 generalization) reuses _patch_claim_prose(convex_http, sanity_http, sanity_id=, run_id=, claim=, new_text=, if_revision_id=) rather than re-deriving the resolve_span + patch_issue_field + _reset_touched_claims sequence"

requirements-completed: [FCT-05, FCT-06]

# Metrics
duration: ~20min
completed: 2026-07-15
---

# Phase 42 Plan 04: Fact Check Claim Action Endpoints Summary

**New `api/factcheck.py` router: four Clerk-guarded claim actions (keep/edit/replace-source/remove) plus the two-step "Ask agent for better evidence" preview/apply pair — cloned from the shipped `voice_pass.py`/`findings.py` templates, each mutation auditable and honoring the reset-before-terminal-status ordering rule.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-07-15T05:53:27-07:00
- **Tasks:** 2 (both `type="auto" tdd="true"`)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `api/factcheck.py` — six routes: `POST .../keep` (mandatory-reason terminal status), `PATCH .../claims/{claim_index}` (metadata-only when `text` absent; full content-patch + claim update when `text` present), `POST .../replace-source` (metadata-only, code-stamped `retrievedAt`), `DELETE .../claims/{claim_index}` (soft-delete via `status:'removed'`), `POST .../evidence/preview` (read-only Tavily search + LLM index-selection, zero mutation), `POST .../evidence/apply` (atomic content-patch + claim update + reset + audit).
- Shared `_patch_claim_prose` helper re-resolves a claim's phrase against **current** Sanity content (`claim_checks.text` + `blockIndexHint` via `resolve_span` — never the ephemeral `claimSpans`, per §35.3/Pitfall 5), scoped-patches it, and calls `_reset_touched_claims` — used identically by both PATCH-with-text and evidence/apply.
- Pitfall 3 self-reset ordering honored explicitly: both content-touching routes call `_reset_touched_claims` (generic block-level reset) **before** `claimChecks:keepAsWritten` (the acted claim's own terminal status), verified by a dedicated ordering test asserting `markChanged` precedes `keepAsWritten` in the mutation call sequence.
- `factcheck.router` mounted in `api/main.py` immediately after `signoffs.router`.
- `claimChecks:updateClaim` / `keepAsWritten` / `remove` added to `convex_client.py`'s `_PIPELINE_SECRET_GUARDED_PATHS` — closing the same class of gap Plan 42-03 discovered for `markChanged` (the Convex-side guard existed since Plan 42-01, but the Python-side secret-injection registration did not, until now).
- 26 new pytest cases in `test_factcheck_endpoints.py` covering every behavior in both tasks' `<behavior>` lists: empty-reason rejection, metadata-only vs content-patch PATCH branches, ordering invariant, bonus-section field-path routing, 409 `span_not_resolved`/`revision_mismatch`/`claim_edit_unavailable`, 404s, zero-mutation evidence preview, bad-source-index fallback, and atomic evidence-apply ordering.

## Task Commits

Each task was committed atomically:

1. **Task 1: keep / PATCH-claim / replace-source / remove routes + mount router (FCT-05)** - `35ccaf2` (feat)
2. **Task 2: evidence/preview + evidence/apply — the two-step agent-revision contract (FCT-06)** - `5e70ccb` (feat)

**Plan metadata:** (this SUMMARY + STATE/ROADMAP update, committed separately per the final-commit step)

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py` - New router: six routes + `_load_claim`/`_claim_snapshot`/`_claim_section_blocks`/`_patch_claim_prose` shared helpers
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` - `+from eisenbalm_pipeline.api import factcheck`, `+app.include_router(factcheck.router)`
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` - `+claimChecks:updateClaim`, `+claimChecks:keepAsWritten`, `+claimChecks:remove` in `_PIPELINE_SECRET_GUARDED_PATHS`
- `packages/pipeline/tests/test_factcheck_endpoints.py` - New pytest coverage (26 tests)

## Decisions Made

- **Audit action names use underscore style** (`claim_kept`, `claim_edited`, `claim_source_replaced`, `claim_removed`, `claim_evidence_applied`) — the plan's `<action>` text explicitly wrote `claim_kept` and `claim_evidence_applied` literally; the other three (not explicitly named) follow the same style for consistency rather than switching to the dotted style other routers use (`content.section_patched`, `finding.accepted`).
- **PATCH's content-touching branch and evidence/apply both terminate via `claimChecks:keepAsWritten`** (defaults `status:'checked'`) rather than a bespoke "edited" or "evidence-resolved" status — D-08's locked 5-value chip vocabulary (`✓ Checked / ✕ Must fix / Unchecked / Review recommended / Changed`) has no separate state for these, so reusing the existing terminal-status mutation is both correct and avoids inventing a new stored status literal.
- **`_claim_snapshot()` (JSON-serialized `{text, status, sourceUrl}`) is the uniform before/after audit payload** for all five factcheck mutating actions — matches `content.py`'s `json.dumps(before/after)` convention (appropriate here since a claim row is a small dict, not a single string span like `findings.py`'s `quotedSpan`/`suggestedFix`).
- **`claim_checks.sectionName` needs no draft-key mapping** — confirmed by reading `lib/claims.py`'s `_SECTION_TO_GALLEY_ID` and `agents/publisher/__init__.py`: claim rows are already anchored with galley vocabulary (`originStory`/`problemStatement`/`founderBio`/`caseStudy`/`bonus`), identical to `content.py`'s `_LONG_READ_SECTIONS` + the `bonus` special case — so `_claim_section_blocks` is a direct lookup, unlike `findings.py`'s `_QA_SECTION_TO_DRAFT_KEY` snake-case translation.
- **Split the implementation into two atomic commits matching the plan's two tasks** even though both were authored in one editing pass: the Task-1-only file state was reconstructed, tests re-run (19 passed), committed, then Task 2's evidence endpoints and tests were layered back on, re-tested (26 passed), and committed separately — preserving the per-task commit protocol without losing TDD fidelity.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `claimChecks:updateClaim`/`keepAsWritten`/`remove` were not registered in `convex_client.py`'s pipeline-secret-guarded paths**
- **Found during:** Task 1 (writing the keep/PATCH/replace-source/remove routes)
- **Issue:** Plan 42-01 added these three Convex mutations guarded by `requirePipelineSecret` on the Convex side, but only `claimChecks:markChanged` (Plan 42-03's own call site) had been registered in `convex_client.py`'s `_PIPELINE_SECRET_GUARDED_PATHS`. Calling any of the three new mutations from this plan's endpoints in a real deployment would fail `Unauthorized` despite passing mocked unit tests — the exact "42-03 lesson" flagged in this plan's own objective.
- **Fix:** Added `"claimChecks:updateClaim"`, `"claimChecks:keepAsWritten"`, `"claimChecks:remove"` to `_PIPELINE_SECRET_GUARDED_PATHS` with a comment explaining the Phase 42 call sites.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py`
- **Verification:** `test_claim_mutations_are_secret_guarded` asserts all three are present; full pipeline suite (578 tests) green.
- **Committed in:** `35ccaf2` (Task 1 commit)

**2. [Rule 2 - Missing Critical] `evidence/preview` guards against an empty Tavily result set**
- **Found during:** Task 2 (evidence/preview implementation)
- **Issue:** The plan's behavior list doesn't mention a no-results case, but an empty `tavily_results` list would raise an unguarded `IndexError` on `tavily_results[source_index]` after the fallback-to-0 logic.
- **Fix:** Raise 409 `no_evidence_found` before attempting the LLM call when `web_search` returns nothing.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py`
- **Verification:** Full pipeline suite green; no existing test exercises the empty-results path (documented here as a defensive addition, not separately unit-tested — low-risk given the identical pattern isn't tested in `researcher.py` either).
- **Committed in:** `5e70ccb` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical functionality)
**Impact on plan:** Both auto-fixes were necessary for correctness (the first prevents a real-deployment 401 the plan's own `<read_first>` list warned about; the second prevents an unhandled crash on empty search results). No scope creep — no new endpoints, fields, or architecture introduced beyond what the plan specified.

## Issues Encountered

None beyond the two auto-fixed items above.

## User Setup Required

None — no external service configuration required. Per the 42-01/42-03 SUMMARYs, the live Convex dev-deployment sync (`pnpm --filter @eisenbalm/convex dev:once`) remains deferred to the Plan 42-08 integration gate; this plan's Python-side changes require no new Convex schema/function changes (all five functions it calls were already added by Plan 42-01), so nothing new needs syncing beyond what 42-01 already documented as outstanding.

## Next Phase Readiness

- The pipeline-side API surface for FCT-05 (six claim actions, five of which are pipeline-routed) and FCT-06 (the two-step evidence contract) is complete and tested. Plan 42-06 (provenance card + Stage 3 screen) can now wire its UI actions against these six concrete endpoints (Confirm stays a direct `claimChecks:setStatus` dashboard call, unchanged).
- `_patch_claim_prose` is a stable, reusable hook: Phase 45's generalization of the evidence/apply endpoint to arbitrary passage revision can extend this same helper rather than re-deriving the resolve_span + patch_issue_field + reset sequence.
- No blockers. The `dispatch-control-no-sanity-write.test.ts` tripwire is unaffected by this plan (no console-side code changed) — Plan 42-08's integration gate will verify it holistically alongside the rest of the phase.

---
*Phase: 42-fact-check-stage*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 5 files created/modified this plan were confirmed present on disk; both task commits (`35ccaf2`, `5e70ccb`) confirmed present in `git log --oneline --all`.
