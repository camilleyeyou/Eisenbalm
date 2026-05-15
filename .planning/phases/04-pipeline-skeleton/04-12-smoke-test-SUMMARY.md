# Plan 04-12 — Smoke Test SUMMARY

**Plan:** `04-12-smoke-test-PLAN.md`
**Status:** ✓ Complete
**Completed:** 2026-05-15
**Autonomous:** false (Andrew ran the live tests; orchestrator interpreted results + patched two bugs that surfaced)
**Requirements closed:** PIP-01, PIP-02, PIP-03, PIP-04, PIP-05, PIP-06, PIP-07, PIP-08, PIP-09, PIP-10, PIP-11, PIP-12, OPS-01, OPS-02, OPS-03

## Live deployment

- **Railway URL:** `https://eisenbalm-pipeline-production.up.railway.app`
- **Railway project:** `eisenbalm-pipeline` (id `d8dbd80f-7d8b-4c4e-9783-a0062cab9c86`)
- **Supabase project:** session pooler at `aws-1-us-east-1.pooler.supabase.com:5432` (4 LangGraph checkpoint tables verified — `Checkpointer tables created / verified.` logged at every deploy via `preDeployCommand`)
- **Stub mode:** `EISENBALM_STUB_MODE=true` (Phase 5 will flip this)

## Smoke test runIds (live evidence)

| Test | runId | issueNumber | Expected | Actual | Verdict |
|------|-------|-------------|----------|--------|---------|
| 1 — happy path | `9f0e9f4879e64d4d816f9d22a77890fc` (first attempt, surfaced bug) → `e9ac2ec9c068489aa5f55969197bcdd2` (post-fix) | 999 | `awaiting-review` + 14-agent cost JSON | `awaiting-review`, `durationMs: 5900`, 14 agents in cost JSON, `errorMessage: null` | ✓ |
| 2 — error path | `0ce55b1a533441fd880e8df8737b6ed0` | 999001 | `failed` + `errorMessage` starting `researcher:` | `failed`, `errorMessage: "researcher: RuntimeError: Forced failure for testing (agent=researcher)"` | ✓ |
| 3 — pause/resume | `c202e719ace243b1ab7d86f69fe8bc80` (first attempt, surfaced bug) → `b10d959d931a47dbb3b23f19205fc396` (post-fix) | 999002, 999003 | pause→`awaiting-review` · resume→`{resumed:true}` · final→`awaiting-review` w/ cost+duration | All three stages green, `durationMs: 102602` (includes user-paced pause window), `errorMessage: null` | ✓ |

## Editorial side verified

- **Sanity Studio** — Andrew confirmed `issue-999` draft (the happy-path run) renders cleanly: every section populated with stub copy, charity reference resolves to "The Quiet Foundation" (Phase 2 demo seed), `pipelineMetadata.runId` matches the smoke runId, `pipelineMetadata.cost` shows the 14-agent JSON string (closes OPS-03).
- **Convex dashboard** — rows present in all five tables filtered by runId (closes PIP-06 and PIP-08 against the live deployment, not just the in-process integration test).

## Per-requirement closure evidence

| REQ | Evidence |
|-----|----------|
| PIP-01 | Railway build green with all 13 WeasyPrint apt deps installed (libpango, libpangoft2, libpangocairo, libcairo2, libgdk-pixbuf-2.0-0, libharfbuzz0b, libharfbuzz-subset0, libjpeg62-turbo, libopenjp2-7, libffi-dev, shared-mime-info, fontconfig, fonts-liberation) — visible in deploy log layer `[runtime 2/5]` |
| PIP-02 | All three smoke tests received `{"runId": "..."}` within 1 second of `POST /run/weekly` |
| PIP-03 | Cost JSON in Test 1 + Test 3 final state lists all 14 agent IDs (calibrator, scout, advocate, editor, researcher, problem-statement, founder-bio, bonus, case-study, design, origin-story, game, qa, plus editor's second invocation as editor_final). Sequence confirmed in Railway runtime logs: `httpx — POST .../api/mutation` calls fire in order. |
| PIP-04 | Local `uv run pytest tests/agents/test_stub_fixtures.py` → 14 parametrized tests pass (verified in Plan 04-10) |
| PIP-05 | `pipelineMetadata.runId == runId` in Sanity draft AND every Convex row carries matching runId (Andrew's eyeball verification + status endpoint output) |
| PIP-06 | Test 1 cleanly threaded the same runId through `pipelineRuns:create` → 3× `pitchLog:insert` → `write_charity` → 3× `agentVotes:insert` → 7× `deliberationEvents:insert{section-draft}` → `write_issue_draft` → `pipelineRuns:updateStatus{awaiting-review}` (Convex+Sanity round-trip visible in Railway logs) |
| PIP-07 | `issue-999` document exists in Sanity at deterministic `_id`, all 10 section fields populated, charity reference resolved |
| PIP-08 | All 5 Convex tables show rows for the smoke runIds (Andrew verified in dashboard) |
| PIP-09 | Supabase dashboard shows 4 LangGraph tables (`checkpoints`, `checkpoint_writes`, `checkpoint_blobs`, `checkpoint_migrations`) created by `preDeployCommand` running `python -m eisenbalm_pipeline.cli setup-checkpointer` once per deploy (idempotent) |
| PIP-10 | Test 3 (post-fix): pause status correctly `awaiting-review` with `errorMessage: null`, resume succeeds, final state has `durationMs` + populated cost JSON |
| PIP-11 | Cost JSON in Test 1 + Test 3 final state contains 14 per-agent `{tokens_in, tokens_out, usd, duration_ms}` entries, `total: 0.0` (stub mode) |
| PIP-12 | Test 1 `durationMs: 5900`; Test 3 `durationMs: 102602` (large because Andrew waited at the pause); Test 2 `durationMs: null` (the wrapper writes status='failed' without duration — by design, duration is only recorded at successful Publisher completion) |
| OPS-01 | Test 2 status: `"failed"` with `errorMessage: "researcher: RuntimeError: Forced failure for testing (agent=researcher)"` — agentId prefix per CONTEXT D-27 ✓ |
| OPS-02 | All 6 status-endpoint hits during the three smoke tests returned the canonical shape `{runId, status, startedAt, completedAt?, durationMs?, cost?, errorMessage?}` |
| OPS-03 | Sanity Studio renders `pipelineMetadata.cost` as a JSON text field (raw display per CONTEXT D-24 — v1 acceptable) |

## Bugs surfaced + patched during smoke

Three production bugs that local tests didn't catch — surfaced ONLY by live Railway integration:

1. **`7f3152f` — Dockerfile BuildKit cache-mount rejection.** Railway's BuildKit refused the `--mount=type=cache` directive without an explicit `id`. Replaced with plain `COPY+RUN` (~30s slower per deploy, works on every BuildKit version).

2. **`8a81f03` + `9878f56` — port binding.** Dockerfile CMD hardcoded port 8000 in exec-form (no shell var expansion), and railway.toml's `startCommand` passed `$PORT` literally because Railway doesn't run it through a shell. Switched Dockerfile CMD to shell form with `${PORT:-8000}` default and removed the conflicting `startCommand` from railway.toml.

3. **`265e555` — LangGraph parallel-write error.** All 14 agents used `return {**state, **fixture_output()}` which returned the entire state dict. In the 7-way parallel fan-out, all branches simultaneously "wrote" every shared key (run_id, issue_number, etc.) and LangGraph raised `InvalidUpdateError: At key 'run_id': Can receive only one value per step`. Patched all 13 buggy return sites to return only the agent's delta. The graph still compiles to 18 nodes; sequential agents are unaffected.

4. **`ab7be28` — GraphInterrupt mis-classified as failure.** The `@agent_node` wrapper's `except Exception` block caught LangGraph's `GraphInterrupt` (the normal pause signal) and wrote `status='failed'` with a misleading errorMessage. Editor gate 1 already writes `status='awaiting-review'` BEFORE calling `interrupt()` (per CONTEXT D-13 + RESEARCH §2 idempotency-before-interrupt), so the wrapper now has an explicit `except GraphInterrupt: raise` that re-propagates without touching Convex. This is the bug that caused Test 3's first attempt to show `failed` during the pause window — verified fixed by Test 3 redo with runId `b10d959d931a47dbb3b23f19205fc396`.

All four fixes are additive — no decision in CONTEXT.md was reversed. Each fix has a one-line rationale comment in the patched file so future engineers see WHY the obvious-looking alternative was rejected.

## What's left for Phase 5

This phase shipped the stable foundation Phase 5 is going to swap real LLM agents into. **Nothing in the wrapper, the graph builder, the state contract, the FastAPI surface, or the datastore clients should need to change in Phase 5.** Phase 5 only replaces:

- The 14 agent function bodies (currently stub fixtures) with real OpenRouter calls
- `stubs/fake_openrouter.py` with a real `lib/openrouter_client.py` that respects iteration limits + records actual token counts
- The `EISENBALM_STUB_MODE=true` env toggle flips to `false`
- The 4 placeholder env vars become real keys: `OPENROUTER_API_KEY`, `TAVILY_API_KEY`

Andrew's existing Railway env wiring + Supabase deployment carry forward unchanged.

---

*Plan 04-12 ships Phase 4. Phase 5 (Agent Quality) is now unblocked.*
