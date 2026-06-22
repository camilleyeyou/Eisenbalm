---
phase: 24-prompt-editor-versioning
plan: 06
subsystem: api
tags: [fastapi, langgraph, openrouter, voice-versioning, prompt-versions, pydantic, clerk-auth]

# Dependency graph
requires:
  - phase: 24-03
    provides: "RunConfig.voice_constraints field + load_prompt asset infra (config_loader hydration)"
  - phase: 24-05b
    provides: "seed_phase24_assets.py seed_assets() + SECTION_GUIDANCE/rubric byte-verified migration pattern"
  - phase: 16-choose-your-narrator
    provides: "assemble_voice(narrator) two-tier composition + import-time VOICE_CONSTRAINTS sentinel"
provides:
  - "VOICE_CONSTRAINTS as a versioned editable asset (voice_constraints prompt_versions row), fed at run start via assemble_voice db_voice_override"
  - "POST /agents/{key}/test-run FastAPI router — single-agent prompt evaluation with output + cost, four input modes, full real-table isolation"
  - "24-VALIDATION.md verification map populated; nyquist_compliant + wave_0_complete"
affects: [24-07, 24-08, dispatch-control prompt editor UI]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "db_voice_override pass-through: DB-hydrated asset returned verbatim, None preserves code-constant composition + import-time sentinel"
    - "Test-run isolation seam: direct acomplete call (transient run_id, no @agent_node decorator) so no agent_runs/agent_run_payloads/deliberationEvents writes"
    - "Optional-bearer auth wrapper (HTTPBearer auto_error=False) so dev-mode Clerk bypass is reachable header-free while prod still 401s"

key-files:
  created:
    - "packages/pipeline/src/eisenbalm_pipeline/prompts/voice_constraints.md"
    - "packages/pipeline/src/eisenbalm_pipeline/api/agents.py"
  modified:
    - "packages/pipeline/src/eisenbalm_pipeline/lib/voice.py"
    - "packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py"
    - "packages/pipeline/scripts/seed_phase24_assets.py"
    - "packages/pipeline/src/eisenbalm_pipeline/api/main.py"
    - ".planning/phases/24-prompt-editor-versioning/24-VALIDATION.md"

key-decisions:
  - "db_voice_override returns the DB value VERBATIM (the seeded row is the full assembled voice), bypassing narrator persona composition — keeps the import-time sentinel + test_voice.py invariants untouched by construction"
  - "Calibrator's {VOICE_CONSTRAINTS} system-prompt token now substitutes resolved_voice (db override when present) so operator voice edits take effect end-to-end, not only via style_brief['voice']"
  - "test-run uses a local _require_operator dependency with HTTPBearer(auto_error=False) instead of the shared auth.security — needed so the dev-mode {sub: local-dev-operator} bypass is header-free per the Plan-01 test contract, without weakening prod auth on other routes"

patterns-established:
  - "Versioned-asset run-start override: hydrate RunConfig field → thread as a *_override kwarg into the pure assembly helper, with None preserving the sentinel-guarded code constant"
  - "Prompt-evaluation utility endpoints call acomplete directly and emit nothing to operational tables (isolation contract)"

requirements-completed: [PRM-05, PRM-06]

# Metrics
duration: 22min
completed: 2026-06-22
---

# Phase 24 Plan 06: Voice Versioning + Single-Agent Test-Run Backend Summary

**VOICE_CONSTRAINTS becomes a versioned editable asset fed at run start via `assemble_voice(narrator, db_voice_override=...)` (sentinel-safe), plus a `POST /agents/{key}/test-run` router that evaluates an unsaved draft prompt through a direct `acomplete` call — returning output + cost with zero real-table writes.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-22T10:39Z (approx)
- **Completed:** 2026-06-22T11:02Z
- **Tasks:** 3
- **Files modified:** 7 (2 created, 5 modified)

## Accomplishments
- Externalized `VOICE_CONSTRAINTS` to `prompts/voice_constraints.md` byte-identical to `lib/voice.VOICE_CONSTRAINTS` (verified via `load_prompt`).
- Added `db_voice_override` to `assemble_voice`: returns the DB-hydrated voice verbatim; `None` preserves the existing two-tier composition and the Phase-16 import-time sentinel.
- Threaded `RunConfig.voice_constraints` through the Calibrator into both `assemble_voice` and the `{VOICE_CONSTRAINTS}` system-prompt token.
- Built `api/agents.py` `POST /agents/{key}/test-run` — four input modes (prior-real via `payloadByRunIdAgentKey` > manual `variables` > `SAMPLE_FIXTURES`), output + `cost_usd` + tokens + model + `duration_ms`, direct `acomplete` call with a transient `test-{uuid}` run_id, NO writes to agent_runs / agent_run_payloads / deliberationEvents / pipelineRuns.
- Extended `seed_phase24_assets.py` to seed `voice_constraints` with a byte-equivalence assert.
- Populated `24-VALIDATION.md`: backend rows flipped green, Wave 0 requirements checked, `nyquist_compliant: true` + `wave_0_complete: true`. Full pipeline suite: **311 passed, 33 skipped.**

## Task Commits

Each task was committed atomically:

1. **Task 1: Seed voice_constraints + db_voice_override + Calibrator thread** - `f2c2464` (feat)
2. **Task 2: POST /agents/{key}/test-run router** - `64a2f16` (feat)
3. **Task 3: Full regression + populate VALIDATION.md** - `82fd8e4` (docs)

_Plan-01-scaffolded tests (`test_voice_db_override.py`, `test_test_run.py`, `test_prompt_version_seeds.py::test_voice_constraints_seed_byte_equivalence`) were already RED scaffolds; this plan made them GREEN — no new test files were needed._

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/prompts/voice_constraints.md` - Editable voice asset, byte-identical to VOICE_CONSTRAINTS.
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` - `assemble_voice` gains `db_voice_override` (verbatim pass-through; sentinel untouched).
- `packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py` - Hydrates `db_voice` from `RunConfig`, threads it into `assemble_voice` + `_build_messages(resolved_voice=...)`.
- `packages/pipeline/scripts/seed_phase24_assets.py` - Seeds `voice_constraints` + `_assert_voice_byte_equivalence()`.
- `packages/pipeline/src/eisenbalm_pipeline/api/agents.py` - New test-run router (four input modes, SAMPLE_FIXTURES, isolation).
- `packages/pipeline/src/eisenbalm_pipeline/api/main.py` - Mounts `agents.router`.
- `.planning/phases/24-prompt-editor-versioning/24-VALIDATION.md` - Verification map populated; nyquist compliant.

## Decisions Made
- **db_voice_override returns verbatim:** the seeded row is the full assembled voice, so the override bypasses persona composition entirely. `assemble_voice(None)` (no override) is the only path tests hit, so the import-time sentinel + `test_voice.py` invariants stay green by construction (24-RESEARCH Pitfall 4).
- **Calibrator system prompt now uses resolved voice:** `{VOICE_CONSTRAINTS}` substitutes `resolved_voice` (db override when present) so operator voice edits propagate through the Calibrator's own prompt, not only via `style_brief['voice']`.
- **Local optional-bearer auth wrapper for test-run:** see Deviations (Rule 3).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] test-run auth gate 401'd header-free in dev mode**
- **Found during:** Task 2 (test-run router)
- **Issue:** The plan specified `Depends(require_clerk_jwt)`, but that dependency uses the shared `auth.security = HTTPBearer()` (auto_error=True), which raises 401/403 on a missing Authorization header BEFORE the dev-mode `CLERK_JWT_ISSUER_DOMAIN`-unset bypass can run. The Plan-01 `test_test_run.py` explicitly relies on no header being needed in dev mode (it documents the `{"sub": "local-dev-operator"}` sentinel path), so the endpoint returned 401 and the test failed.
- **Fix:** Added a local `_require_operator` dependency in `api/agents.py` using `HTTPBearer(auto_error=False)`. In dev mode (issuer unset) it returns the same sentinel header-free; in prod it 401s on a missing credential and otherwise delegates verification to the canonical `require_clerk_jwt`. Other routes' auth is untouched.
- **Files modified:** `packages/pipeline/src/eisenbalm_pipeline/api/agents.py`
- **Verification:** `tests/test_test_run.py` both cases pass; prod-path verification still delegates to `require_clerk_jwt` (single source of truth).
- **Committed in:** `64a2f16` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required to satisfy the Plan-01 test contract without weakening production auth on other routes. No scope creep — same sentinel semantics as `require_clerk_jwt`, scoped to the test-run endpoint.

## Issues Encountered
- Two prior executor attempts died from transient connection drops before committing. This run committed each task immediately after verification per the resilience directive; clean start confirmed (`git log --grep="24-06"` empty) before Task 1.

## User Setup Required
None - no external service configuration required. (The `voice_constraints` v1 row is seeded by `scripts/seed_phase24_assets.py` against live Convex when run with `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOY_KEY` — same operational step as the Plan 04b/05b seeds; not required for the pipeline to run, which falls back to the code constant.)

## Next Phase Readiness
- PRM-05 + PRM-06 backends are GREEN and tested. The dispatch-control editor UI plans (24-07, 24-08) can now call `POST /agents/{key}/test-run` for live prompt evaluation and treat `voice_constraints` as just another editable/versioned agentKey.
- No blockers. Remaining VALIDATION rows (Plan 02 Convex, 07/08 UI) belong to their own plans; their harnesses/scaffolds are already in place.

## Self-Check: PASSED

- All created files exist: `voice_constraints.md`, `api/agents.py`, `24-06-SUMMARY.md`.
- All task commits exist: `f2c2464`, `64a2f16`, `82fd8e4`.

---
*Phase: 24-prompt-editor-versioning*
*Completed: 2026-06-22*
