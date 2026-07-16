---
phase: 46-signal-editor-candidate-verification
plan: 03
subsystem: pipeline
tags: [langgraph, openrouter, prompts, config-loader, llm-config]

# Dependency graph
requires:
  - phase: 46-01
    provides: StoryLead/VerificationRecord Convex store contract + Wave-0 test scaffolding
provides:
  - "signal_editor" registered in MODEL_BY_AGENT/SAMPLING_BY_AGENT/MAX_TOKENS_BY_AGENT (Sonnet tier)
  - "signal_editor"/"signal_editor_user" registered in AGENT_KEY_TO_PROMPT_FILE + USER_TEMPLATE_KEYS
  - prompts/signal_editor.md + prompts/signal_editor_user.md (externalized, marker-wrapped)
  - scripts/seed_phase46_signal_editor.py (idempotent Convex prompt seed)
affects: [46-04-signal-editor-agent, 46-06-graph-wiring-and-consumer-sync]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "New agent registration order: llm_config.py FIRST (avoids acomplete() KeyError), then prompts, then seed script"
    - "New user-template keys extend USER_TEMPLATE_KEYS (superset), never the frozen 11-entry SYSTEM_PROMPT_KEYS tuple"

key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/prompts/signal_editor.md
    - packages/pipeline/src/eisenbalm_pipeline/prompts/signal_editor_user.md
    - packages/pipeline/scripts/seed_phase46_signal_editor.py
  modified:
    - packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py
    - packages/pipeline/tests/test_config_loader_assets.py

key-decisions:
  - "signal_editor model tier = Sonnet (anthropic/claude-sonnet-4-6), not Haiku (advocate's actual tier) or Opus — RESEARCH Pitfall 5 correction of CONTEXT's 'Advocate/Editor class' framing; leads are human-review proposals, not final/irreversible calls"
  - "signal_editor NOT added to SYSTEM_PROMPT_KEYS (frozen at exactly 11 since Phase 22) — registered only in the superset AGENT_KEY_TO_PROMPT_FILE map + USER_TEMPLATE_KEYS, which load_run_config()/seed scripts actually iterate"
  - "seed_phase46_signal_editor.py reuses seed_phase24_assets.seed_assets via a bare module import (scripts/ has no __init__.py; sys.path[0] is the script's own directory when run via `python scripts/foo.py`) rather than a scripts.* package import"

patterns-established:
  - "Pattern: registering a new LLM agent starts with llm_config.py (MODEL_BY_AGENT/SAMPLING_BY_AGENT/MAX_TOKENS_BY_AGENT) before any prompt or agent-module code is written, since ALL_AGENT_KEYS derives from MODEL_BY_AGENT and acomplete() KeyErrors otherwise"

requirements-completed: [SGE-01]

# Metrics
duration: 8min
completed: 2026-07-16
---

# Phase 46 Plan 03: Signal Editor Prompt and Model Registration Summary

**Registered the Signal Editor at the Sonnet model tier and shipped its two externalized, marker-wrapped prompts (brand-risk rubric + repetition-warning phrasing) plus an idempotent Convex seed script — the plumbing 46-04's agent body needs to run in real mode.**

## Performance

- **Duration:** 8 min
- **Tasks:** 3
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- `signal_editor` resolves a model/sampling/max_tokens triple in `lib/llm_config.py` (Sonnet tier, `anthropic/claude-sonnet-4-6`) — `acomplete(agent_id="signal_editor", ...)` will no longer raise `KeyError` (RESEARCH Pitfall 4 avoided)
- `signal_editor` + `signal_editor_user` registered in `config_loader.AGENT_KEY_TO_PROMPT_FILE` and `USER_TEMPLATE_KEYS` — `load_run_config()` now hydrates both from Convex with disk fallback; `SYSTEM_PROMPT_KEYS` stays frozen at exactly 11 (RESEARCH Pitfall 7 — the correct superset map/tuple, not the nonexistent `USER_PROMPT_KEYS`)
- `prompts/signal_editor.md` (system) encodes the SGE-01 lead-field contract, the SGE-02 brand-risk rubric (`recommended` never `true` when `brandRiskFlag` is `true`), and the SGE-05 repetition-warning phrasing via an `{avoid_note}` token
- `prompts/signal_editor_user.md` carries the `{results_block}` token, mirroring `scout_user.md`
- `scripts/seed_phase46_signal_editor.py` is a thin, idempotent wrapper reusing `seed_phase24_assets.seed_assets` — no reimplemented upsert/byte-verification

## Task Commits

Each task was committed atomically:

1. **Task 1: Register signal_editor in llm_config + config_loader** - `c0b3bd0` (feat)
2. **Task 2: Author signal_editor.md + signal_editor_user.md prompts** - `d0316b8` (feat)
3. **Task 3: Add the idempotent Phase-46 prompt seed script** - `90346a0` (feat, includes a Rule-1 test fix)

## Files Created/Modified
- `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` - added `signal_editor` to `MODEL_BY_AGENT` (Sonnet), `SAMPLING_BY_AGENT` (temp 0.4), `MAX_TOKENS_BY_AGENT` (16_000)
- `packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py` - added `signal_editor`/`signal_editor_user` to `AGENT_KEY_TO_PROMPT_FILE`; added `signal_editor_user` to `USER_TEMPLATE_KEYS`
- `packages/pipeline/src/eisenbalm_pipeline/prompts/signal_editor.md` - new externalized system prompt (lead contract, brand-risk rubric, repetition-warning phrasing, `{avoid_note}` token)
- `packages/pipeline/src/eisenbalm_pipeline/prompts/signal_editor_user.md` - new externalized user template (`{results_block}` token)
- `packages/pipeline/scripts/seed_phase46_signal_editor.py` - new idempotent seed script wrapping `seed_phase24_assets.seed_assets`
- `packages/pipeline/tests/test_config_loader_assets.py` - `test_asset_registries_counts` cardinality bumped 11→12 (direct consequence of Task 1's `USER_TEMPLATE_KEYS` addition)

## Decisions Made
- **Model tier = Sonnet, not "Advocate/Editor class."** Read `lib/llm_config.py` directly per RESEARCH Pitfall 5: `advocate` is pinned to the same Haiku tier as `scout`, not a distinct higher tier. Signal Editor's leads are proposals for human review (Phase 47), functionally closest to Researcher (tool-use + structured judgment feeding downstream consumers) — Sonnet, not Haiku (ruled out by CONTEXT) and not the full voice-critical Opus tier (reserved for final/irreversible calls). Flagged in-code as a discretion call with an explicit note that the plumbing is identical if Andrew later bumps it to the Opus pin.
- **`signal_editor` NOT added to `SYSTEM_PROMPT_KEYS`.** That tuple is commented "EXACTLY 11 entries... Frozen subset that the Phase 22 seed owns." Adding `signal_editor` to `MODEL_BY_AGENT` already extends `ALL_AGENT_KEYS` (`= tuple(MODEL_BY_AGENT) + bonus variants`) automatically, so `load_run_config()` hydrates it with no further wiring — confirmed by the verification command asserting `len(SYSTEM_PROMPT_KEYS) == 11` still holds.
- **Seed script uses a bare `from seed_phase24_assets import ...` import, not `scripts.seed_phase24_assets`.** `packages/pipeline/scripts/` has no `__init__.py`; when Python runs `python scripts/foo.py`, `sys.path[0]` is set to the `scripts/` directory itself (confirmed empirically), so `import scripts.X` raises `ModuleNotFoundError` while a bare `import X` (matching every existing script in that directory) resolves correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a direct test regression from the Task 1 `USER_TEMPLATE_KEYS` change**
- **Found during:** Task 3 (full pipeline test-suite verification per project-specific guidance)
- **Issue:** `tests/test_config_loader_assets.py::test_asset_registries_counts` hardcoded `len(USER_TEMPLATE_KEYS) == 11` (the Phase 24 cardinality). Task 1's addition of `signal_editor_user` to that tuple (an intentional, plan-required change) made the tuple length 12, failing this pre-existing assertion.
- **Fix:** Updated the assertion to `== 12` with a comment explaining the Phase 46 addition.
- **Files modified:** `packages/pipeline/tests/test_config_loader_assets.py`
- **Verification:** `cd packages/pipeline && uv run pytest tests/ -q` → 592 passed, 39 skipped (0 failed; the pre-existing skip count is unchanged from before this plan).
- **Committed in:** `90346a0` (part of Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix — a hardcoded test cardinality directly invalidated by this plan's intentional registry expansion)
**Impact on plan:** Necessary to keep the full suite green; no scope creep — the fix is a one-line assertion update tied directly to Task 1's registered change.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. (The seed script requires `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOY_KEY` to run against live Convex, matching the existing `seed_phase24_assets.py` requirement — running the seed itself is a follow-up step for whoever needs the prompts live in Convex, not a blocker for this plan's acceptance criteria, all of which were verified via `load_prompt`/disk-fallback paths.)

## Next Phase Readiness
- `acomplete(agent_id="signal_editor", ...)` resolves a model/sampling/max_tokens triple — 46-04 (Signal Editor agent body) can call it in real mode without a `KeyError`.
- `config.agents['signal_editor'].system_prompt` and `config.user_templates['signal_editor_user']` will hydrate at run start (Convex-first, disk-fallback) — 46-04 can build its `_build_messages()` against these directly.
- Both prompts encode the SGE-01 lead-field contract, the SGE-02 brand-risk/`recommended` gate, and the SGE-05 repetition-warning phrasing — 46-04 needs to enforce the `brandRiskFlag`→`recommended=False` invariant in Python (per RESEARCH's anti-pattern warning: never trust the LLM alone for this), not just rely on the prompt.
- No blockers for 46-04.

---
*Phase: 46-signal-editor-candidate-verification*
*Completed: 2026-07-16*

## Self-Check: PASSED

All created files found on disk; all 3 task commit hashes (`c0b3bd0`, `d0316b8`, `90346a0`) found in git history.
