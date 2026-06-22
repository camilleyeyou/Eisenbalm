---
phase: 22-config-externalization
plan: 04
subsystem: prompt-seed-migration
tags: [config-externalization, convex, seed, byte-parity, idempotent, load-prompt, cfg-02]

# Dependency graph
requires:
  - phase: 22-config-externalization (Plan 02)
    provides: "Convex surface: agents:upsert, promptVersions:upsertActive (idempotent v1), pipelineConfig:upsert, promptVersions:getActive"
  - phase: 22-config-externalization (Plan 03)
    provides: "config_loader: AGENT_KEY_TO_PROMPT_FILE (11), ALL_AGENT_KEYS, _llm_key_for, WORKSPACE_ID"
  - phase: 04-pipeline-skeleton
    provides: "lib/prompts.load_prompt byte oracle + lib/convex_client.convex_mutation/convex_query + FastAPI lifespan AsyncClient construction pattern"
  - phase: 05-agent-quality
    provides: "lib/llm_config: MODEL_BY_AGENT / SAMPLING_BY_AGENT / MAX_TOKENS_BY_AGENT"
provides:
  - "scripts/seed_phase22.py: idempotent live-Convex seed of ALL_AGENT_KEYS agents + 11 v1 active prompts (content via load_prompt) + pipeline_config defaults"
  - "scripts/verify_prompt_seed.py: standalone live byte-parity check (getActive vs load_prompt) asserting v1/isActive, exit 1 on any diff/missing"
  - "tests/lib/test_prompt_seed.py: green CI-safe byte-parity (11) + idempotency (mocked convex_mutation), xfail marks removed"
affects: [22-05, prompt-seed-migration, plan-05-call-site-swap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Standalone seed/verify scripts build their own httpx.AsyncClient mirroring the FastAPI lifespan (base_url=NEXT_PUBLIC_CONVEX_URL.rstrip('/'))"
    - "Byte-mismatch guard: prompt content sourced EXCLUSIVELY via load_prompt() — no raw file read anywhere in either script (asserted by ast/grep gate)"
    - "Idempotency proven at the call-contract layer: seed never emits a `version` field, so re-run cannot increment v1 (relies on Plan-02 upsertActive patch semantics)"
    - "scripts/ imported in tests as top-level `from scripts import seed_phase22` (rootdir on sys.path; scripts/ is NOT part of the installed wheel package)"

key-files:
  created:
    - "packages/pipeline/scripts/seed_phase22.py"
    - "packages/pipeline/scripts/verify_prompt_seed.py"
  modified:
    - "packages/pipeline/tests/lib/test_prompt_seed.py"
    - ".planning/phases/22-config-externalization/deferred-items.md"

key-decisions:
  - "Both scripts construct a fresh AsyncClient (timeout=30s) rather than reusing convex_client._CLIENT — they run outside the FastAPI lifespan, so no set_client() has occurred"
  - "Test imports the seed via `from scripts import seed_phase22` (top-level), NOT `eisenbalm_pipeline.scripts` — scripts/ lives at the package root and is excluded from the hatch wheel (packages=['src/eisenbalm_pipeline']); pytest's prepend import mode puts rootdir on sys.path so the top-level import resolves"
  - "Idempotency test asserts byte-identical args across two runs + absence of a `version` field, rather than mocking Convex DB state — the Plan-02 upsertActive guarantees the patch-not-insert/no-bump semantics, so the seed's contract (never send version) is the correct thing to test in CI"

requirements-completed: [CFG-02]

# Metrics
duration: 12min
completed: 2026-06-22
---

# Phase 22 Plan 04: Prompt-Seed Migration + Byte-Verification (CFG-02) Summary

**CFG-02 is delivered: an idempotent `seed_phase22.py` writes the `ALL_AGENT_KEYS` agents rows (from `llm_config`), the 11 v1 active `prompt_versions` (content sourced exclusively through `load_prompt()`, never a raw file read), and the `pipeline_config` defaults; a standalone `verify_prompt_seed.py` performs a live zero-diff check (`getActive` vs `load_prompt`, asserting `version==1`/`isActive`) exiting non-zero on any mismatch; and `test_prompt_seed.py` is now green (11 byte-parity + 2 idempotency/content cases, fully mocked, CI-safe).**

## Performance

- **Duration:** ~12 min
- **Completed:** 2026-06-22
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- **`scripts/seed_phase22.py`** — runnable `async def main()` (guarded `asyncio.run`). Builds its own `httpx.AsyncClient(base_url=NEXT_PUBLIC_CONVEX_URL.rstrip("/"))` mirroring the FastAPI lifespan. Three idempotent passes: (1) `agents:upsert` for each `ALL_AGENT_KEYS` key with `model=MODEL_BY_AGENT[_llm_key_for(k)]`, `temperature`/`top_p` from `SAMPLING_BY_AGENT` (defaults 0.3/1.0), `max_tokens=MAX_TOKENS_BY_AGENT.get(...)`, `enabled=True`, `description=f"{k} agent"`; (2) `promptVersions:upsertActive` for each of the 11 `AGENT_KEY_TO_PROMPT_FILE` pairs with `content=load_prompt(file)` + `note="Phase 22 v1 seed"`; (3) `pipelineConfig:upsert` for `require_review=true`/`auto_publish=false`/`schedule_enabled=false` (JSON-encoded values). Per-row OK lines + final summary count. Uses `WORKSPACE_ID` from `config_loader` (no hardcoded literal in logic).
- **`scripts/verify_prompt_seed.py`** — standalone `async def main()`. For each of the 11 pairs: `expected = load_prompt(file)`, reads `promptVersions:getActive`, and on `None` → FAIL (missing); else asserts `content == expected` (printing first differing line index on mismatch) + `version == 1` + `isActive is True`. Tracks failures; `sys.exit(1)` on any diff/missing, `sys.exit(0)` + "11/11 byte-identical" on full success.
- **`tests/lib/test_prompt_seed.py`** — xfail marks removed; imports the real `AGENT_KEY_TO_PROMPT_FILE` (11 pairs). `test_seeded_content_byte_identical` (parametrized ×11) proves the seed-content contract; `test_seed_prompts_uses_load_prompt_content` runs the seed's `_seed_prompts()` against a recording `convex_mutation` mock and asserts all 11 `upsertActive` args carry `content == load_prompt(file)`; `test_seed_idempotent` runs the seed twice and asserts byte-identical args + absence of a `version` field. 13 passed.

## Task Commits

1. **Task 1: idempotent seed_phase22.py (agents + prompts + config)** — `4c2853b` (feat)
2. **Task 2: standalone verify_prompt_seed.py (live byte-parity)** — `574a8a5` (feat)
3. **Task 3: green mocked byte-parity + idempotency pytest** — `67fcbab` (test)

## Decisions Made

- **Fresh AsyncClient in both scripts** rather than the shared `convex_client._CLIENT`: the scripts run outside the FastAPI lifespan, so no `set_client()` has registered a singleton. Each builds its own client with `timeout=30s` and `aclose()`s it in a `finally`.
- **Test import path `from scripts import seed_phase22`** (top-level), not `eisenbalm_pipeline.scripts`: `scripts/` lives at the package root and is excluded from the hatch wheel (`packages = ["src/eisenbalm_pipeline"]`). Under pytest's default `prepend` import mode the rootdir (`packages/pipeline`) is on `sys.path`, so the top-level `scripts` namespace package resolves without an `__init__.py`.
- **Idempotency tested at the call-contract layer**: the seed NEVER emits a `version` field, so a re-run physically cannot bump it; combined with Plan-02's `upsertActive` patch-not-insert semantics, asserting two runs produce byte-identical args (and contain no `version` key) is the CI-safe proof — no live Convex DB-state simulation needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Docstring containing the literal substring `open(` tripped the no-raw-read gate**
- **Found during:** Task 1 verification.
- **Issue:** The Task-1 automated gate asserts `'open(' not in src` against the whole file text. My initial docstring + an inline comment referenced `` ``open(...).read()`` `` to explain the byte-mismatch guard, which contains the forbidden substring and failed the assertion (a false positive on prose, not actual raw-read logic).
- **Fix:** Reworded the docstring ("NEVER a raw file read") and the inline comment ("byte oracle, never a raw read") to remove every literal `open(` occurrence. No logic change — the seed already used `load_prompt()` exclusively.
- **Files modified:** `packages/pipeline/scripts/seed_phase22.py`
- **Commit:** `4c2853b`

## Deferred Issues

- **DEF-22-02** (logged to `deferred-items.md`): `tests/agents/test_calibrator.py::test_voice_constants` fails with `TypeError: _build_messages() missing 1 required keyword-only argument: 'state'`. Pre-existing and unrelated to this plan — `git diff f264f1e..HEAD` for 22-04 touched zero calibrator files (only the two scripts + the prompt-seed test). The `state` kwarg was added to `calibrator._build_messages` in an earlier phase (Phase 16 narrator-awareness) without updating this one test. Out of scope per the executor scope boundary; the rest of the suite is green (`279 passed, 1 failed, 33 skipped, 2 xfailed`).

## Verification Results

- `uv run pytest tests/lib/test_prompt_seed.py -q` → **13 passed** (11 byte-parity + 2 idempotency/content), 0 xfail, 0 failed.
- `uv run pytest -q -p no:randomly` (full suite) → **279 passed, 1 failed (pre-existing DEF-22-02), 33 skipped, 2 xfailed**. The single failure is out-of-scope and predates this plan.
- Both scripts `ast.parse` clean and contain `load_prompt(` with **zero** `open(` occurrences (byte-mismatch guard).
- All Task acceptance greps pass: `agents:upsert`/`promptVersions:upsertActive`/`pipelineConfig:upsert` + `AGENT_KEY_TO_PROMPT_FILE`/`ALL_AGENT_KEYS` in the seed; `promptVersions:getActive` + `sys.exit(1)` + `version`/`isActive` in the verifier; no `xfail` + real `config_loader` import in the test.

## Manual (post-deploy) Verification

Per 22-VALIDATION.md (Manual-Only Verifications), against live Convex once the four Plan-02 functions are deployed and `NEXT_PUBLIC_CONVEX_URL`/`CONVEX_DEPLOY_KEY` are set:

```bash
cd packages/pipeline
uv run python scripts/seed_phase22.py        # idempotent; re-runnable
uv run python scripts/verify_prompt_seed.py  # expect "11/11 byte-identical", exit 0
```

(Deferred to the live deployment, blocked by the same `CLERK_JWT_ISSUER_DOMAIN` Convex-deploy gate noted in 22-02-SUMMARY — not a code defect.)

## Known Stubs

None — both scripts are fully wired with real handlers and the test is fully green. `seed_phase22.py` and `verify_prompt_seed.py` are runnable end-to-end against a live deployment; the only un-exercised path is the live network round-trip itself (deferred per the Convex-deploy gate above), which is covered by the mocked CI test for logic and by the manual gate for bytes.

## Self-Check: PASSED

- FOUND: packages/pipeline/scripts/seed_phase22.py
- FOUND: packages/pipeline/scripts/verify_prompt_seed.py
- FOUND: packages/pipeline/tests/lib/test_prompt_seed.py
- FOUND: commit 4c2853b
- FOUND: commit 574a8a5
- FOUND: commit 67fcbab

---
*Phase: 22-config-externalization*
*Completed: 2026-06-22*
