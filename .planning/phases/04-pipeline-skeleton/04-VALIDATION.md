---
phase: 4
slug: pipeline-skeleton
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-13
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `.planning/phases/04-pipeline-skeleton/04-RESEARCH.md` §"Validation Architecture"

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pytest >=8.3` + `pytest-asyncio >=0.24` |
| **Config file** | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` (Wave 0 installs) |
| **Quick run command** | `cd packages/pipeline && uv run pytest -x` |
| **Full suite command** | `cd packages/pipeline && uv run pytest -v` |
| **Estimated runtime** | ~30 seconds full suite (in-process FastAPI via `ASGITransport`) |

---

## Sampling Rate

- **After every task commit:** Run `cd packages/pipeline && uv run pytest -x` (fail-fast on the first regression)
- **After every plan wave:** Run `cd packages/pipeline && uv run pytest -v` (full suite — must be green to merge wave)
- **Before `/gsd:verify-work`:** Full suite green AND Andrew's manual smoke test from CONTEXT.md D-42 succeeds (one curl + Sanity Studio + Convex dashboard check)
- **Max feedback latency:** 30 seconds (in-process; no Railway round-trip)

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists |
|--------|----------|-----------|-------------------|-------------|
| PIP-01 | Dockerfile builds with WeasyPrint deps | smoke | `docker build -t pipeline packages/pipeline/` (manual / Railway logs) | ❌ Wave 0 |
| PIP-02 | `POST /run/weekly` returns `{runId}` | integration | `uv run pytest tests/test_pipeline_e2e.py::test_returns_runId` | ❌ Wave 0 |
| PIP-03 | LangGraph runs all 14 nodes in sequence | integration | Covered by PIP-06 (asserts agentIds in `deliberationEvents`) | ❌ Wave 0 |
| PIP-04 | Each agent stub returns structurally valid `DispatchState` | unit | `uv run pytest tests/agents/test_stub_fixtures.py` (parametrize over all 14 agents) | ❌ Wave 0 |
| PIP-05 | `runId` generated once, threaded everywhere | integration | Covered by PIP-06 | ❌ Wave 0 |
| PIP-06 | Sanity `pipelineMetadata.runId == every Convex row's runId` | integration (e2e) | `uv run pytest tests/test_pipeline_e2e.py` — **the headline test** | ❌ Wave 0 |
| PIP-07 | Complete `weeklyIssue` draft written, deterministic charity `_id` | integration | Covered by PIP-06 + assertion on `_id == 'issue-{n}'` and `charity` ref shape | ❌ Wave 0 |
| PIP-08 | Convex writes for every event type | integration | `uv run pytest tests/test_pipeline_e2e.py::test_all_event_types_emitted` | ❌ Wave 0 |
| PIP-09 | `AsyncPostgresSaver` checkpoint persists; `setup()` is one-time + idempotent | unit | `uv run pytest tests/test_checkpointer.py::test_setup_idempotent` | ❌ Wave 0 |
| PIP-10 | Editor gate 1 `interrupt()` → `awaiting-review` → resume → terminal | integration | `uv run pytest tests/test_editor_gate_1_resume.py` | ❌ Wave 0 |
| PIP-11 | `pipelineRuns.cost` populated (0s in stub mode, shape valid) | integration | `uv run pytest tests/test_pipeline_e2e.py::test_cost_shape` | ❌ Wave 0 |
| PIP-12 | `pipelineRuns.durationMs > 0` | integration | `uv run pytest tests/test_pipeline_e2e.py::test_duration_ms` | ❌ Wave 0 |
| OPS-01 | Forced agent exception → `failed` status + agentId + errorMessage | integration | `uv run pytest tests/test_agent_failure.py` | ❌ Wave 0 |
| OPS-02 | `GET /run/{runId}/status` returns current state | integration | `uv run pytest tests/test_status_endpoint.py` | ❌ Wave 0 |
| OPS-03 | Cost JSON visible on Sanity `pipelineMetadata.cost` | manual + integration | Sanity assertion inside PIP-06 test + Andrew's manual smoke (CONTEXT D-42 step 6) | ❌ Wave 0 |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = file pending Wave 0 install*

---

## Wave 0 Requirements

Wave 0 is the FIRST plan in the phase — installs test infrastructure before any feature work begins so subsequent plans land green.

- [ ] `packages/pipeline/pyproject.toml` — `[tool.pytest.ini_options]` block: `asyncio_mode = "auto"`, `testpaths = ["tests"]`
- [ ] `packages/pipeline/pyproject.toml` — `[dependency-groups] dev = [...]` with `pytest>=8.3`, `pytest-asyncio>=0.24`, `respx>=0.21` (HTTP mocking for tests of Sanity/Convex clients)
- [ ] `packages/pipeline/tests/conftest.py` — shared fixtures: `client` (in-process via `httpx.AsyncClient(transport=ASGITransport(app=app))`), env loading helper, Convex cleanup helper, Sanity cleanup helper
- [ ] `packages/pipeline/tests/test_pipeline_e2e.py` — covers PIP-02, PIP-05, PIP-06, PIP-07, PIP-08, PIP-11, PIP-12 (the headline e2e test in CONTEXT D-35)
- [ ] `packages/pipeline/tests/test_editor_gate_1_resume.py` — covers PIP-10 (CONTEXT D-36)
- [ ] `packages/pipeline/tests/test_agent_failure.py` — covers OPS-01 (CONTEXT D-37)
- [ ] `packages/pipeline/tests/test_status_endpoint.py` — covers OPS-02
- [ ] `packages/pipeline/tests/test_checkpointer.py` — covers PIP-09 (idempotent `setup()`)
- [ ] `packages/pipeline/tests/agents/test_stub_fixtures.py` — covers PIP-04 (TypedDict shape check per agent, parametrized over the 14 agent stubs)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway Dockerfile build succeeds | PIP-01 | Requires Railway environment (build env not reproducible locally without Docker) | Andrew runs `railway up` after `railway link`; Railway dashboard shows green build + healthcheck pass |
| Supabase + Railway env wiring complete | PIP-09 dependency | One-time manual provisioning (CONTEXT D-29, D-30) — no autonomous path | Andrew runs `railway variables set SUPABASE_POSTGRES_URL=...` + 4 other env vars; verified via `railway run env \| grep SUPABASE_` |
| One-time `checkpointer.setup()` against Supabase | PIP-09 | One-shot migration on a managed Postgres — cannot be re-run in CI | `railway run python -m eisenbalm_pipeline.cli setup-checkpointer` returns 0; Supabase dashboard shows 4 tables (`checkpoints`, `checkpoint_writes`, `checkpoint_blobs`, `checkpoint_migrations`) |
| Cost JSON visible in Sanity Studio | OPS-03 | Sanity Studio is a manual UI surface; no headless equivalent | Andrew opens `issue-999` draft in Studio → confirms `pipelineMetadata.cost` field is populated (raw JSON string) |
| Convex schema patch (durationMs + cost on pipelineRuns) deployed | PIP-11, PIP-12 | Convex deploy is a manual step (CONTEXT D-22, D-23, D-39) | Engineer runs `pnpm --filter @eisenbalm/convex deploy`; Convex dashboard shows updated `pipelineRuns:updateStatus` signature accepting `cost?` and `durationMs?` |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Minimum coverage to detect regressions:** PIP-06 (e2e) + PIP-10 (interrupt-resume) + OPS-01 (failure path) = three tests cover the three load-bearing axes (happy path · pause-resume · error path). Everything else in the per-task map is fine-grained verification of the same shape.

**Approval:** pending
