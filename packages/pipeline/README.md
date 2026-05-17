# Eisenbalm Dispatch — Pipeline

FastAPI + LangGraph backend that runs the nine-agent editorial pipeline. Hosted on Railway. Reads from / writes to Sanity (canonical content), Supabase (pipeline state), Convex (real-time deliberation events), OpenRouter (model routing), and Tavily (web search).

The pipeline produces one complete weekly issue: one obscure charity, eight original sections, all in Jesse's voice, ready for Andrew to review in Sanity Studio.

---

## Quickstart

```bash
cd packages/pipeline
uv sync
cp .env.example .env
# fill in keys (see "Environment variables" below)
uv run pytest                       # unit tests (stub mode by default in CI)
uv run uvicorn eisenbalm_pipeline.api.main:app --reload --port 8080
```

Trigger a run:

```bash
curl -X POST http://localhost:8080/run \
  -H 'content-type: application/json' \
  -d '{"issueNumber": 1}'
```

---

## Pipeline overview

Nine agents, two human gates:

| Phase | Agents | Mode |
|---|---|---|
| **Phase 1 — Charity selection** (sequential) | Calibrator → Scout → Advocate → Editor Gate 1 | Real LLM + web search |
| **Human gate 1** | Andrew confirms or overrides Editor's choice in Sanity | Manual |
| **Phase 2 — Content production** (parallel after gate 1) | Researcher → OriginStoryWriter, ProblemWriter, FounderBioWriter, CaseStudyWriter, GameWriter, BonusWriter, DesignAgent → QA → Editor Final | Real LLM |
| **Human gate 2** | Andrew reviews draft in Sanity Studio, publishes | Manual |
| **Post-publish** | Publisher agent renders PDF, triggers Vercel deploy | Webhook-driven |

See `docs/CLAUDE_CODE_BRIEF.md` for the full agent specification and `docs/API_CONTRACTS.md` for interface shapes.

---

## Phase 5 — Real-Mode Operations

Phase 5 closes the stub-mode era. The pipeline now runs against real LLMs and real web search by default; stub mode remains available for fast unit tests and CI.

### Stub mode toggle (`EISENBALM_STUB_MODE`)

Per decision **D-22**, stub mode is now **opt-in**, not opt-out:

| Setting | Behavior | When to use |
|---|---|---|
| `EISENBALM_STUB_MODE=false` *(default)* | Agents call OpenRouter and Tavily; cost meter active; QA rubric enforced | Local dev with funded keys, staging runs, production |
| `EISENBALM_STUB_MODE=true` | Agents return deterministic canned responses; no network calls; cost meter no-op | Unit tests, CI, demos without API credit, offline development |

```bash
# Real-mode run (default)
EISENBALM_STUB_MODE=false uv run python -m eisenbalm_pipeline.run --issue 1

# Stub-mode run (offline)
EISENBALM_STUB_MODE=true uv run pytest tests/unit
```

The toggle is read once at process start via `eisenbalm_pipeline.config.settings`. Mixing modes mid-run is not supported.

### Environment variables (Phase 5 additions)

Beyond the Phase 4 baseline (`SANITY_API_TOKEN`, `CONVEX_DEPLOY_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`, etc.), real mode requires:

| Variable | Required when | Default | Purpose |
|---|---|---|---|
| `OPENROUTER_API_KEY` | `EISENBALM_STUB_MODE=false` | — | Routes all agent LLM calls. Get a key at https://openrouter.ai/keys. |
| `TAVILY_API_KEY` | `EISENBALM_STUB_MODE=false` | — | Web search for Scout and Researcher agents. Get a key at https://tavily.com. |
| `PIPELINE_COST_CAP_USD` | optional | `10.00` | Hard ceiling on OpenRouter spend per run. Pipeline aborts with `CostCapExceededError` if cumulative cost crosses this value. Tune after observing one real run (see Task 3 in plan 05-15). |
| `PIPELINE_COST_WARN_PCT` | optional | `0.80` | Fraction of `PIPELINE_COST_CAP_USD` at which a `cost-warning` `deliberationEvent` is emitted to Convex (and a `WARNING` log line is printed). |

See `.env.example` for the canonical template and full list of Phase 4 keys.

### Real-mode smoke test

`tests/test_pipeline_real_mode.py` is the gated end-to-end entrypoint that exercises the full nine-agent graph against live OpenRouter and Tavily:

```bash
# One-shot real-mode run from a clean state (no Convex/Sanity writes — uses in-memory adapters)
EISENBALM_STUB_MODE=false \
OPENROUTER_API_KEY=sk-or-... \
TAVILY_API_KEY=tvly-... \
PIPELINE_COST_CAP_USD=10.00 \
uv run pytest tests/test_pipeline_real_mode.py -s -v
```

The test is **skipped by default in CI** (no API keys). It is the primary tool Andrew uses to observe per-agent USD cost during the Phase 5 closeout smoke run (see plan `05-15-andrew-smoke-and-docs-PLAN.md`, Task 3).

Output includes:

- A per-agent cost table (USD, tokens in, tokens out, model used)
- A pipeline total
- A pass/fail check against `PIPELINE_COST_CAP_USD`
- The draft `weeklyIssue` payload that would have been written to Sanity (printed, not persisted)

### QA rubric

The QA agent's pass/fail criteria are no longer hard-coded. They live in `src/eisenbalm_pipeline/agents/qa/rubric.md` as a plain-Markdown checklist that the agent reads on each run and threads into its system prompt.

To edit the rubric:

```bash
$EDITOR packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md
uv run pytest tests/agents/test_qa.py    # validates rubric parses and rules are well-formed
```

Convention:

- One top-level `## Section` per category (Voice, Facts, Structure, Safety)
- Within a section, each `- [ ] Rule:` line is one checkable criterion
- Severity tags `(blocker)` / `(warning)` go at the end of the rule line
- Andrew is the rubric owner; the agent never edits it

### Approved font whitelist

Per decision **D-16**, the DesignAgent picks fonts only from `src/eisenbalm_pipeline/agents/design/font_whitelist.py`. The whitelist is human-curated by Andrew; the agent has no override. See plan `05-15-andrew-smoke-and-docs-PLAN.md` Task 2 for the sign-off marker convention.

---

## Phase 4 — Pipeline foundation

*(Phase 4 documentation will be re-attached here when those plan summaries land. Until then, see `docs/CLAUDE_CODE_BRIEF.md` and `docs/API_CONTRACTS.md` for the canonical agent specs and interface shapes.)*

---

## Directory layout

```
packages/pipeline/
├── README.md                      # this file
├── pyproject.toml                 # dependencies (uv-managed)
├── .env.example                   # canonical env var template
├── src/eisenbalm_pipeline/
│   ├── api/                       # FastAPI app + webhook handlers
│   ├── graph.py                   # LangGraph wiring
│   ├── state.py                   # DispatchState TypedDict
│   ├── config.py                  # settings (reads EISENBALM_STUB_MODE etc.)
│   ├── agents/
│   │   ├── calibrator/
│   │   ├── scout/
│   │   ├── advocate/
│   │   ├── editor_gate1/
│   │   ├── researcher/
│   │   ├── origin_story/
│   │   ├── problem/
│   │   ├── founder_bio/
│   │   ├── case_study/
│   │   ├── game/
│   │   ├── bonus/
│   │   ├── design/
│   │   │   └── font_whitelist.py  # D-16: Andrew-approved fonts only
│   │   ├── qa/
│   │   │   └── rubric.md          # editable checklist
│   │   ├── editor_final/
│   │   └── publisher/
│   └── lib/
│       ├── sanity_client.py
│       ├── convex_client.py
│       ├── portable_text.py
│       └── cost_meter.py          # tracks OpenRouter USD per run
└── tests/
    ├── unit/                      # stub-mode, fast, always run in CI
    └── test_pipeline_real_mode.py # gated real-mode smoke test
```

---

## Related docs

- `docs/CLAUDE_CODE_BRIEF.md` — full project spec, agent pipeline, build sequence
- `docs/API_CONTRACTS.md` — interface boundaries with exact shapes
- `.planning/phases/05-agent-quality/` — Phase 5 plans, context, and decisions (D-16, D-22, et al.)
- `.planning/STATE.md` — current build position and recorded decisions
