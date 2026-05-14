# Phase 4: Pipeline Skeleton - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 04-pipeline-skeleton
**Mode:** auto (`/gsd:discuss-phase 4 --auto`) — Claude auto-selected the recommended option for every gray area without interactive prompts
**Areas discussed:** Python project & tooling, FastAPI surface, LangGraph + checkpointer, runId discipline, stub agent strategy, three-datastore write discipline, cost & duration tracking, error envelope, Railway deployment, schema patches, testing strategy

---

## Area 1 — Python project & tooling

| Option | Description | Selected |
|--------|-------------|----------|
| `uv` (Recommended) | Modern fast Python package manager; matches placeholder README and brief | ✓ |
| `pip` + `requirements.txt` | Traditional, broadest compatibility | |
| `Poetry` | Mature lockfile-based manager | |

**Auto-selected:** `uv` (recommended default — already named in `packages/pipeline/README.md` placeholder and `.planning/research/STACK.md`).
**Notes:** Pinned via `pyproject.toml` `requires-python = ">=3.11,<3.12"`. `uv.lock` committed for reproducibility.

| Option | Description | Selected |
|--------|-------------|----------|
| `src/` layout (Recommended) | `packages/pipeline/src/eisenbalm_pipeline/...` — clean import boundary | ✓ |
| Flat layout | `packages/pipeline/eisenbalm_pipeline/...` | |

**Auto-selected:** `src/` layout.

---

## Area 2 — FastAPI surface & module layout

| Option | Description | Selected |
|--------|-------------|----------|
| Modular with `APIRouter` (Recommended) | `api/{main,runs,webhooks,health}.py` — phase-stable | ✓ |
| Single `main.py` | Everything in one file | |

**Auto-selected:** Modular. Phase 6 + 8 (webhooks) and Phase 9 (status streaming) will all want their own router files.

| Option | Description | Selected |
|--------|-------------|----------|
| `BackgroundTasks` for `/run/weekly` (Recommended) | Built into FastAPI, returns to client immediately | ✓ |
| Raw `asyncio.create_task` | More flexible but reinvents the wheel | |
| Synchronous (block until done) | Simpler but blocks Railway request handler for ~30 seconds | |

**Auto-selected:** `BackgroundTasks` returning `{runId}` within ~10ms.

---

## Area 3 — LangGraph integration

| Option | Description | Selected |
|--------|-------------|----------|
| `AsyncPostgresSaver` against Supabase (Recommended; required by PIP-09) | Production-grade checkpoint + resume; survives Railway restarts | ✓ |
| `MemorySaver` | Simpler but loses state on restart | |
| `SqliteSaver` | File-backed; doesn't survive Railway ephemeral filesystem | |

**Auto-selected:** `AsyncPostgresSaver` — locked by PIP-09 requirement.

| Option | Description | Selected |
|--------|-------------|----------|
| Native `interrupt()` + `Command(resume=...)` (Recommended) | LangGraph 1.x idiom; resume-from-checkpoint is automatic | ✓ |
| Hand-rolled pause via state polling | More code, harder to reason about | |
| Branching control flow (no pause) | Doesn't satisfy PIP-10 awaiting-review semantics | |

**Auto-selected:** Native `interrupt()`. Research flag in ROADMAP.md signals dedicated researcher investigation of resume semantics.

| Option | Description | Selected |
|--------|-------------|----------|
| `checkpointer.setup()` as one-time CLI (Recommended; required by PIP-09) | Explicit migration step, not every-startup | ✓ |
| Run on every startup | Defies PIP-09 explicit requirement | |

**Auto-selected:** CLI subcommand `python -m eisenbalm_pipeline.cli setup-checkpointer`.

---

## Area 4 — runId discipline

| Option | Description | Selected |
|--------|-------------|----------|
| Generate in `POST /run/weekly` handler (Recommended; PIP-05) | Single source, deterministic threading | ✓ |
| Generate inside Calibrator agent | Couples runId to first agent; complicates resume | |
| Generate inside the StateGraph entry node | Requires entry node; less explicit | |

**Auto-selected:** Generate in FastAPI handler before invoking the graph.

| Option | Description | Selected |
|--------|-------------|----------|
| UUID v4 hex (no dashes) (Recommended) | Matches API_CONTRACTS.md §7 "UUID string"; what apps/web examples imply | ✓ |
| UUID v7 (time-ordered) | Newer, sortable, but no Python stdlib support | |
| UUID v4 with dashes | Same value, different format | |

**Auto-selected:** `uuid.uuid4().hex` — plain hex.

| Option | Description | Selected |
|--------|-------------|----------|
| `thread_id == runId` for AsyncPostgresSaver (Recommended) | One-to-one mapping, no side index | ✓ |
| Separate `thread_id` (e.g., `issueNumber`) | Decouples resume from runId; needs extra mapping | |

**Auto-selected:** Identity mapping.

---

## Area 5 — Stub agent strategy

| Option | Description | Selected |
|--------|-------------|----------|
| `@agent_node` wrapper decorator (Recommended) | Single source of try/except, Convex events, cost, iteration limits — Phase 5 swap point | ✓ |
| Boilerplate inline per agent | Repeats wrapping logic 14 times | |
| Middleware via LangGraph node hooks | Less idiomatic in LangGraph 1.x | |

**Auto-selected:** Wrapper decorator.

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic fixtures (Recommended) | Repeatable PIP-06 integration test | ✓ |
| Randomized stub outputs | Closer to "real" but breaks test repeatability | |
| Live OpenRouter calls in Phase 4 | Defies the cheap-skeleton phase boundary | |

**Auto-selected:** Deterministic fixtures in `stubs/fixtures.py`.

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Phase 2 demo charity "The Quiet Foundation" (Recommended) | Avoids polluting Sanity with fake test entries | ✓ |
| Generate fresh fake charities per run | Duplicates accumulate; deterministic IDs help but namespace churn anyway | |

**Auto-selected:** Reuse Phase 2 demo charity.

| Option | Description | Selected |
|--------|-------------|----------|
| `EISENBALM_STUB_MODE` env toggle, default `true` in Phase 4 (Recommended) | Single Phase 5 swap point | ✓ |
| Code-level constant | Requires code change to flip; less ops-friendly | |
| Per-agent flag | Over-engineered for v1 | |

**Auto-selected:** Single env toggle.

---

## Area 6 — Three-datastore write discipline

| Option | Description | Selected |
|--------|-------------|----------|
| Per-event Convex writes, single end-of-pipeline Sanity draft write (Recommended; matches API_CONTRACTS.md §3) | Live deliberation visibility; one canonical content write | ✓ |
| Batch Convex events at agent end | Defies "writes each candidate as it finds them" (AGT-03) and API_CONTRACTS.md §3.3 | |
| Sanity-first writes (per agent) | High latency, no transactional guarantee | |

**Auto-selected:** Per-event Convex + end-of-pipeline Sanity (canonical order in D-18).

| Option | Description | Selected |
|--------|-------------|----------|
| Sanity halt on failure, Convex log+continue (Recommended; matches API_CONTRACTS.md §"Error handling") | Content is canonical; deliberation is observable | ✓ |
| Both halt on failure | Convex failure shouldn't lose Sanity write | |
| Both log+continue | Sanity failure means no draft for Andrew | |

**Auto-selected:** Asymmetric error handling per API_CONTRACTS.md.

| Option | Description | Selected |
|--------|-------------|----------|
| Deterministic `_id`s, new `runId` per run (Recommended) | Sanity dedupes by `_id`; Convex preserves run history by `runId` | ✓ |
| Convex deduplication by `runId` | Loses re-run observability | |

**Auto-selected:** Existing Phase 1/2 pattern.

---

## Area 7 — Cost & duration tracking

| Option | Description | Selected |
|--------|-------------|----------|
| `CostRecorder` context manager + JSON-stringified `cost` field on Convex `pipelineRuns` (Recommended) | Mirrors existing `modelVersions` JSON-string pattern in API_CONTRACTS.md §2.2 | ✓ |
| Strongly-typed nested object in Convex schema | Better validation but adds schema cascade | |
| Skip cost tracking in Phase 4 | Defies PIP-11; loses Phase 5 baseline measurement | |

**Auto-selected:** Context manager + JSON-string field. Two additive Convex schema patches (D-39) document the addendum to Phase 3's deployed contract.

| Option | Description | Selected |
|--------|-------------|----------|
| `durationMs` on Convex `pipelineRuns` table (Recommended; PIP-12) | Pipeline wall-clock visible without computing from start/complete | ✓ |
| Compute on the fly from `startedAt`/`completedAt` | Forces every reader to do math; loses precision | |

**Auto-selected:** Dedicated field, additive Convex schema patch.

---

## Area 8 — Error envelope

| Option | Description | Selected |
|--------|-------------|----------|
| Route `validate_sections` failures to `failed + errorMessage` (Recommended) | No new schema state | ✓ |
| Add `'partial-failure'` to `pipelineRuns.status` enum | Cascades through Phase 3's deployed contract | |

**Auto-selected:** Reuse existing `failed` status with descriptive `errorMessage`.

| Option | Description | Selected |
|--------|-------------|----------|
| `f'{agentId}: {exception_class}: {message}'` format (Recommended) | Grep-able first segment for failure counting by agent | ✓ |
| Plain exception string | Loses agent attribution | |
| Structured JSON in `errorMessage` | Schema-typed `errorMessage` is `v.string()` — JSON-in-string acceptable but adds parsing overhead | |

**Auto-selected:** Prefixed format.

---

## Area 9 — Railway deployment & infra

| Option | Description | Selected |
|--------|-------------|----------|
| Custom Dockerfile with WeasyPrint deps pre-installed in Phase 4 (Recommended; PIP-01) | Phase 6 doesn't churn infra later | ✓ |
| Nixpacks autodetection | Doesn't include `libpango`/`libcairo` for WeasyPrint | |
| Procfile + buildpack | Same WeasyPrint problem | |
| Install WeasyPrint deps in Phase 6 | Defies PIP-01 explicit requirement; churns Dockerfile across phases | |

**Auto-selected:** Custom Dockerfile now, even though Phase 6 owns the real PDF.

| Option | Description | Selected |
|--------|-------------|----------|
| Single production Railway + Supabase (Recommended) | Mirrors Phase 2 D-15 and Phase 3 D-02 single-env discipline | ✓ |
| Staging + production | Doubles ops cost; no second engineer to benefit | |

**Auto-selected:** Single production deployment.

| Option | Description | Selected |
|--------|-------------|----------|
| Manual Andrew checkpoint for Railway + Supabase provisioning (Recommended) | Mirrors Phase 1 sanity init + Phase 3 convex init patterns | ✓ |
| Auto-provision via CLI | Requires service-account credentials Andrew doesn't have yet | |

**Auto-selected:** Manual checkpoint with documented commands.

---

## Area 10 — Schema patches

| Option | Description | Selected |
|--------|-------------|----------|
| Additive Convex schema patch (`durationMs` + `cost` on `pipelineRuns`) (Recommended) | Mirrors Phase 2/3 patterns; redeploy after via `pnpm --filter @eisenbalm/convex deploy` | ✓ |
| Extend existing `modelVersions` JSON to include cost | Conflates two concerns | |
| Defer cost field to Phase 5 | Defies PIP-11 and forces a schema patch later anyway | |

**Auto-selected:** Two new optional fields on existing table.

| Option | Description | Selected |
|--------|-------------|----------|
| Add `pipelineMetadata.cost` (text/JSON) to Sanity `weeklyIssue` schema (Recommended) | Required by OPS-03 for read-only display in Studio | ✓ |
| Read cost from Convex inside Studio | Convex isn't a Sanity input plugin source | |

**Auto-selected:** Additive Sanity schema field + TypeGen regen.

---

## Area 11 — Testing strategy

| Option | Description | Selected |
|--------|-------------|----------|
| pytest + `pytest-asyncio` against deployed Railway URL OR local uvicorn (Recommended) | Repeatable, no CI requirement (Phase 1 D-15 deferred CI) | ✓ |
| Manual smoke only | Defies PIP-06's "integration test" requirement | |
| CI-gated test on every push | Violates Phase 1 D-15 no-CI-gates posture | |

**Auto-selected:** pytest, local-only execution.

| Option | Description | Selected |
|--------|-------------|----------|
| Three named tests: e2e, interrupt-resume, failure-path (Recommended) | Covers all four PIP success criteria explicitly | ✓ |
| Single test_pipeline.py with subcases | Harder to interpret failures | |

**Auto-selected:** Three named tests in `packages/pipeline/tests/`.

---

## Claude's Discretion

Captured in `04-CONTEXT.md` → "Claude's Discretion" subsection. Planner decides:
- Exact Dockerfile multi-stage layout
- Exact wording of stub fixtures (Jesse-voice-ish vs lorem-style)
- Whether `validate_sections` is its own module or inline in graph builder
- Logging library (stdlib vs structlog vs loguru — recommend stdlib JSON)
- `BaseModel` vs raw dicts for FastAPI request bodies (recommend `BaseModel`)
- Per-agent payload-builder hook signature inside the wrapper decorator

## Deferred Ideas

Captured in `04-CONTEXT.md` → `<deferred>` block. Highlights:
- LangSmith tracing → Phase 5
- Retry logic with exponential backoff → Phase 5
- Cron-triggered weekly run → v2
- Per-section retry → Phase 5/7
- Real OpenRouter / Tavily / WeasyPrint / Vercel deploy calls → Phase 5/6
- `partial-failure` status value → not introduced (route through `failed + errorMessage` instead)
- Per-developer Supabase databases → v2

## Scope creep redirected

None during this auto session — no prompts were issued.
