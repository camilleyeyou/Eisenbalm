---
phase: 05-agent-quality
plan: 12
subsystem: agents
tags: [design-agent, wcag, hex-validation, font-whitelist, haiku, openrouter, pydantic]

# Dependency graph
requires:
  - phase: 05-agent-quality
    provides: lib/wcag.validate_theme + SAFE_THEME (Plan 05-03), agents/design/font_whitelist.FONT_WHITELIST (Plan 05-04), lib/openrouter_client.acomplete (Plan 05-03), agents/_wrapper.agent_node (Phase 4 Plan 04-06), qaCorrections.severity union info|warning|error (Plan 05-01)
provides:
  - Real Haiku-driven DesignAgent body in agents/design/__init__.py
  - ThemeOutput Pydantic schema (4 hex + 2 fonts; visualDirection carried from style_brief)
  - _validate_full() = hex regex + WCAG-AA contrast + font whitelist (single source of truth for theme validity)
  - Regenerate-once retry pattern (D-15) with prior errors injected into retry prompt
  - SAFE_THEME + FALLBACK_FONT_* fallback on second validation failure
  - qaCorrections severity='warning' annotation when fallback triggers (operational notice for Andrew, not brand-failure)
  - AGT-17 modelVersions write for the 'design' agent_id
  - 10-test pytest suite covering hex/WCAG/font/retry/fallback paths
affects: [Plan 05-13 (QA reads qaCorrections), Plan 05-14 (real-mode integration test), Plan 05-15 (Andrew smoke), Phase 6 Publisher (consumes state['theme'] for Sanity write), Phase 7 issue page render (consumes theme via CSS variables)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Post-LLM programmatic validation + regenerate-once + safe-default fallback (unique among Phase 5 agents — others fail-fast on schema parse error)"
    - "Single-source-of-truth validator _validate_full delegates hex/WCAG to lib/wcag and font check to FONT_WHITELIST so Phase 2 render-time validator and Phase 5 pre-write validator can never drift"
    - "qaCorrections:insert as operational notice channel (severity='warning', accepted=false) — not a QA correction in the editorial sense, but an Andrew-facing log entry"

key-files:
  created: []
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
    - packages/pipeline/tests/agents/test_design.py

key-decisions:
  - "DesignAgent body lives in agents/design/__init__.py (the Plan 05-04 package shell) — not agents/design.py — because Plan 05-04 promoted agents/design.py to a package to make room for font_whitelist.py. The plan template still referred to agents/design.py; Rule 3 (blocking) deviation: re-targeted writes to __init__.py."
  - "qaCorrections fallback uses Convex-validator-correct keys (sectionName, reason, accepted=false) — plan template specified section, reasoning, acceptance='pending' which would have failed convex/qaCorrections.ts v.string()/v.boolean() validators. Rule 1 (bug) deviation."
  - "ThemeOutput Pydantic uses str defaults (empty string) for all 6 fields so model_construct() succeeds in stub mode — same pattern as Plan 05-05 StyleBriefOutput. Real-mode validation still enforces via with_structured_output."
  - "acomplete called with kwargs-only signature (agent_id=, run_id=, messages=, response_format=) — plan template showed positional form. Documented in repo as a known plan-quality issue across Phase 5."
  - "visualDirection is NOT LLM-emitted — it's carried verbatim from style_brief.visualDirection (set by Calibrator). DesignAgent emits the 6 design properties; the 7th Theme field is editorial copy from one stage upstream."
  - "Fallback fonts use FALLBACK_FONT_DISPLAY ('Playfair Display') + FALLBACK_FONT_BODY ('Source Serif Pro') from agents/design/font_whitelist, NOT SAFE_THEME['fontBody']='Lora'. Both are in FONT_WHITELIST; the spread {**SAFE_THEME, fontDisplay: FALLBACK_FONT_DISPLAY, fontBody: FALLBACK_FONT_BODY} ensures the final theme is whitelist-clean."

patterns-established:
  - "Post-LLM validation + regenerate-once + fallback: agent body calls _call_llm twice maximum, then falls back to a hardcoded safe value + qaCorrections warning"
  - "Single-call-site helper _call_llm(*, run_id, charity, style_brief, retry_errors=None) — both attempts go through the same wrapper so retry-prompt injection is centralized"
  - "_validate_full as the single validation choke point — combines lib/wcag rules with font whitelist; never duplicate this logic elsewhere"

requirements-completed: [AGT-13, AGT-14]

# Metrics
duration: 9min
completed: 2026-05-17
---

# Phase 5 Plan 12: DesignAgent Summary

**Haiku-driven theme generation with WCAG-AA + font-whitelist pre-write validation, regenerate-once retry, and SAFE_THEME fallback that logs a qaCorrections warning for Andrew.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-17T18:39:00Z (after Plan 05-09 close-out)
- **Completed:** 2026-05-17T18:48:00Z
- **Tasks:** 2 (Task 1 TDD: RED + GREEN; Task 2 covered by Task 1 test file replacement)
- **Files modified:** 2

## Accomplishments

- Replaced the Phase 4 DesignAgent stub (returned fixtures.design_output()) with a real Haiku-driven implementation
- Established the unique-to-DesignAgent pattern of post-LLM programmatic validation + regenerate-once + safe-fallback
- Wired the Phase 2 / Phase 5 validation contract: lib/wcag.validate_theme (Phase 2 algorithm port, 0.03928 sRGB threshold) is the single source of truth for both render-time and pre-write theme checks
- Closed the Plan 05-04 deferred TODO: agents/design/__init__.py now imports + enforces FONT_WHITELIST from the Plan 05-04 candidate list
- 10 pytest tests pass (6 pure validator + 4 end-to-end agent behavior covering happy path, retry, font-failure retry, fallback)

## Task Commits

1. **Task 1 RED + Task 2: failing tests for DesignAgent validation pipeline** — `878155c` (test)
2. **Task 1 GREEN: implement Haiku-driven DesignAgent with regenerate-once + safe-theme fallback** — `a9ac925` (feat)

_Note: Plan tasks 1 and 2 collapsed into 2 TDD commits (RED + GREEN). Task 2's deliverable (test_design.py final content) is identical to Task 1's RED phase, so a separate refactor commit would have been a no-op._

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` — Real DesignAgent: ThemeOutput Pydantic, _validate_full helper, _build_messages with whitelist injection + retry-error pass-through, _call_llm wrapper, design @agent_node body with regenerate-once + SAFE_THEME fallback
- `packages/pipeline/tests/agents/test_design.py` — 10 tests: hex validation pass/fail, font whitelist pass/fail (display + body), WCAG contrast detection, SAFE_THEME fonts in whitelist sanity guard, valid-first-try, invalid→regenerate→valid, bad-font→regenerate→valid, double-failure→fallback with qaCorrections warning

## Decisions Made

- **DesignAgent lives in `agents/design/__init__.py`** (package shell from Plan 05-04), not `agents/design.py`. Rule 3 (blocking) deviation — plan template still referenced the file path that existed before Plan 05-04's package promotion.
- **qaCorrections payload uses Convex-validator field names** — `sectionName` (not `section`), `reason` (not `reasoning`), `accepted=false` (not `acceptance='pending'`). Rule 1 (bug) deviation — plan template would have produced ArgumentValidationError from convex/qaCorrections.ts.
- **acomplete invoked with kwargs only** — `agent_id=`, `run_id=`, `messages=`, `response_format=`. The plan template showed positional form, which would have raised TypeError given `acomplete(*, ...)` signature.
- **visualDirection is not LLM-emitted** — carried verbatim from `state['style_brief']['visualDirection']`. ThemeOutput Pydantic has 6 fields (4 hex + 2 fonts); the agent body sets `theme['visualDirection']` from style_brief before returning.
- **Fallback fonts use FALLBACK_FONT_DISPLAY/BODY constants** from agents/design/font_whitelist (not SAFE_THEME's fonts) — the spread `{**SAFE_THEME, fontDisplay: FALLBACK_FONT_DISPLAY, fontBody: FALLBACK_FONT_BODY}` guarantees the fallback theme passes the font whitelist (SAFE_THEME['fontBody']='Lora' is also whitelisted, but FALLBACK_FONT_BODY='Source Serif Pro' is the Plan 05-04 designated fallback).
- **agent_node emit_event='section-draft'** — the Convex deliberationEvents eventType union (9 literals post-05-01 patch) does not include a 'design-theme' literal; section-draft is the closest fit since theme is treated as a section in the Phase 4 stub and downstream consumers.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Target file path: `agents/design.py` → `agents/design/__init__.py`**
- **Found during:** Task 1 (replacing DesignAgent stub)
- **Issue:** Plan frontmatter and `<files>` blocks specified `packages/pipeline/src/eisenbalm_pipeline/agents/design.py`, but Plan 05-04 already promoted that module to a package at `agents/design/` with the Phase 4 stub preserved in `__init__.py`. Writing to `agents/design.py` would have either (a) created a sibling module that shadows the package, or (b) been ignored if the package took precedence on import.
- **Fix:** Wrote the real DesignAgent body to `agents/design/__init__.py`, replacing the Phase 4 stub there. All imports (`from eisenbalm_pipeline.agents.design import design`) continue to resolve through the package layer, unchanged from Phase 4.
- **Files modified:** packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
- **Verification:** `EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_design.py -x` passes 10/10.
- **Committed in:** a9ac925

**2. [Rule 1 — Bug] qaCorrections payload field names mismatched Convex validator**
- **Found during:** Task 1 (implementing fallback path)
- **Issue:** Plan template specified `section`, `reasoning`, `acceptance='pending'` for the qaCorrections:insert payload. `convex/qaCorrections.ts` requires `sectionName: v.string()`, `reason: v.string()`, `accepted: v.boolean()`. The plan template payload would have failed Convex's `ArgumentValidationError` at runtime — caught only when DesignAgent actually falls back (not on the happy path), so this could have been a latent prod-only bug.
- **Fix:** Rewrote the qaCorrections:insert args to match the Convex schema: `sectionName="theme"`, `reason=fallback_summary`, `accepted=False`. Kept the optional `axis`, `quotedSpan`, `suggestedFix`, `agentId` fields as plan specified.
- **Files modified:** packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
- **Verification:** Compared against `convex/qaCorrections.ts` insert mutation args. Tests assert `qa_calls[0].args[1]["severity"] == "warning"` and `args["runId"]` / `args["agentId"]` shape; the validator-correct payload would pass Convex's checks (live verification deferred to Plan 05-14 real-mode integration test).
- **Committed in:** a9ac925

**3. [Rule 1 — Bug] acomplete called with kwargs, not positional**
- **Found during:** Task 1 (implementing _call_llm helper)
- **Issue:** Plan template showed `acomplete("design", messages, response_format=ThemeOutput)` (positional first arg). `lib/openrouter_client.acomplete` signature is `acomplete(*, agent_id, run_id, messages, response_format=None)` — kwargs-only with required `run_id`. Positional form would have raised `TypeError: acomplete() takes 0 positional arguments but 2 were given`.
- **Fix:** All call sites use kwargs: `acomplete(agent_id="design", run_id=run_id, messages=messages, response_format=ThemeOutput)`. `_call_llm` accepts `run_id` as a kwarg and threads it through.
- **Files modified:** packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
- **Verification:** Tests pass (mocks accept *args, **kwargs); manual `uv run python -c "from eisenbalm_pipeline.agents.design import design"` import succeeds. This is the 6th consecutive Phase 5 plan with the same acomplete signature mismatch — STATE.md notes the systemic plan-quality issue.
- **Committed in:** a9ac925

**4. [Rule 2 — Missing Critical] visualDirection field needed to be carried through**
- **Found during:** Task 1 (state['theme'] must match graph.state.Theme TypedDict)
- **Issue:** `graph/state.Theme` TypedDict has 7 fields (4 hex + 2 fonts + visualDirection). The plan's ThemeOutput Pydantic has 6 (no visualDirection). Returning state['theme'] without visualDirection would have left it `None`/missing at Sanity write time (Publisher), breaking the Phase 6 contract.
- **Fix:** Agent body sets `theme["visualDirection"] = style_brief.get("visualDirection", "")` after validation, before returning. visualDirection is carried verbatim from Calibrator's style_brief.
- **Files modified:** packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py
- **Verification:** state['theme'] now has all 7 fields. Tests don't assert visualDirection presence (mocks set style_brief with `visualDirection: "warm"`); manual verification confirms field populated.
- **Committed in:** a9ac925

---

**Total deviations:** 4 auto-fixed (1 blocking — wrong path; 2 bugs — wrong API shapes; 1 missing critical — Theme field)
**Impact on plan:** All four deviations were necessary for the agent to work at all. Three were plan-template-vs-codebase mismatches (paths/signatures/schemas changed since the plan was authored), one was a Theme field omission. Zero scope creep — all changes within the plan's stated objective.

## Issues Encountered

- **Pre-existing test failure in `tests/agents/test_founder_bio.py`** — `ImportError: cannot import name 'FounderBioOutput' from 'eisenbalm_pipeline.agents.founder_bio'`. This is from Plan 05-10 (section writers, not yet implemented). Out of scope per the scope_boundary rule; logged to deferred-items.md is not necessary since Plan 05-10 is the explicit owner.
- **Per-plan acomplete signature mismatches keep recurring** — every Phase 5 plan template shows positional form; every agent body must convert to kwargs. Already noted in STATE.md from Plan 05-09. No action this plan, but Plan 05-15 (docs) should consider a `grep acomplete(` lint or a one-line pre-publish check for future phases.

## User Setup Required

None — no external service configuration required for this plan. DesignAgent's real-mode LLM call exercises OPENROUTER_API_KEY (already in `.env.example`, configured in Phase 5 Plan 05-02) and qaCorrections:insert hits the Convex deployment (configured in Phase 3). Both env vars are unchanged.

## Next Phase Readiness

- **DesignAgent body complete** — Plan 05-13 (QA + Editor Final) can read qaCorrections including DesignAgent fallback warnings; Plan 05-14 (real-mode integration test) can exercise the regenerate-once path live against OpenRouter; Plan 05-15 (Andrew smoke) can verify the qaCorrections warning surfaces in the deliberation layer.
- **Font whitelist remains a Plan 05-15 deliverable** — agents/design/font_whitelist.py still carries the Plan 05-04 TODO(Andrew); the DesignAgent already enforces the candidate list, so when Andrew approves the final list in Plan 05-15, only `font_whitelist.py` changes — DesignAgent body is unaffected.
- **No new blockers introduced.**

## Self-Check: PASSED

- Agent file exists: FOUND `packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` (231 lines)
- Test file exists: FOUND `packages/pipeline/tests/agents/test_design.py` (244 lines)
- Test commit exists: FOUND `878155c` in `git log`
- Impl commit exists: FOUND `a9ac925` in `git log`
- All 10 tests pass: VERIFIED via `EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_design.py -x` (10 passed)
- Grep verification: `validate_theme` 4 refs, `FONT_WHITELIST` 3 refs, `severity.*warning` 2 refs, `_call_llm` 3 call sites (≥ 2 required for regenerate-once pattern) — ALL PASS

---
*Phase: 05-agent-quality*
*Completed: 2026-05-17*
