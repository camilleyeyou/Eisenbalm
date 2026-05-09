# Architecture Research

**Domain:** Multi-agent LangGraph pipeline with human-in-the-loop gates, three-datastore content/observability/state split, webhook-triggered finalization, monorepo across TypeScript and Python
**Researched:** 2026-05-09
**Confidence:** HIGH (LangGraph patterns verified against official docs; Sanity webhook patterns verified against Sanity official docs; monorepo patterns from Turborepo official docs)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     BROWSER / READER                                │
│  Next.js (Vercel) ─── Sanity GROQ reads (CDN) ──────────────────┐  │
│  React components ─── Convex useQuery subscriptions (live) ──┐  │  │
└──────────────────────────────────────────────────────────────┼──┼──┘
                                                               │  │
┌──────────────────────────────────────────────────────────────┼──┼──┐
│                     SANITY CMS (cloud)                        │  │  │
│  weeklyIssue (draft/published) ──────────────────────────────┘  │  │
│  charity ─ agentProfile                                          │  │
│  On status→published: fires webhook ──────────────────────────┐ │  │
└───────────────────────────────────────────────────────────────┼─┼──┘
                                                                │ │
┌───────────────────────────────────────────────────────────────┼─┼──┐
│                     CONVEX (cloud)                             │ │  │
│  pipelineRuns ─ deliberationEvents ─ agentVotes ──────────────┘ │  │
│  qaCorrections ─ pitchLog                          ◄────────────┘  │
│  Written by: pipeline (HTTP API) / Read by: frontend (useQuery)     │
└───────────────────────────────────────────────────────────────────┘
                             ▲ HTTP mutations
┌────────────────────────────┼────────────────────────────────────────┐
│         FASTAPI + LANGGRAPH (Railway)                               │
│                            │                                        │
│  POST /run ──► LangGraph graph (compiled with AsyncPostgresSaver)   │
│                            │                                        │
│  Phase 1 — Sequential:     │                                        │
│  Calibrator → Scout → Advocate → Editor[interrupt?] ───────────┐   │
│                            │                                    │   │
│  Phase 2 — Parallel (Send API fan-out):                         │   │
│  Researcher → [OriginStory │ Problem │ FounderBio │ CaseStudy   │   │
│               │ Game │ Bonus │ Design] → QA → EditorFinal       │   │
│                            │                                    │   │
│  Sanity write (draft) ─────┘                                    │   │
│  Convex pipelineRuns: awaiting-review                           │   │
│                                                                 │   │
│  POST /webhook/sanity-publish ◄─── Sanity webhook (HMAC) ──────┘   │
│           │                                                         │
│           └──► Publisher (background) → PDF → Sanity → Vercel      │
└─────────────────────────────────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────┐
│         SUPABASE (Postgres)                                         │
│  AsyncPostgresSaver checkpoint tables (LangGraph built-in schema)   │
│  Stores: thread checkpoints, channel blobs, pending sends           │
│  Purpose: pause/resume after interrupt, crash recovery              │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architectural Seam 1 — LangGraph State, Checkpointing, and Interrupts

### State Schema Pattern

The `DispatchState` TypedDict (defined in `packages/pipeline/types.py`, documented in `docs/API_CONTRACTS.md §7`) is the single state object threaded through the entire graph. Every agent node reads from it and returns a dict of updates — LangGraph merges writes back into the shared state automatically.

**Key design rule:** Fields for Phase 2 outputs (`origin_story`, `problem_statement`, etc.) are all `Optional`. The state schema must declare a reducer for any field that multiple parallel nodes can write. For the seven section writers, each writes to a *distinct* key, so no reducer is needed — the default overwrite behaviour is correct. Do not use `Annotated[list, operator.add]` unless you genuinely need accumulation.

```python
# packages/pipeline/graph.py — canonical structure
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

builder = StateGraph(DispatchState)

# Phase 1 — sequential
builder.add_node("calibrator", calibrator_node)
builder.add_node("scout", scout_node)
builder.add_node("advocate", advocate_node)
builder.add_node("editor_gate1", editor_gate1_node)

# Phase 2 — parallel fan-out via conditional edges
builder.add_node("researcher", researcher_node)
builder.add_node("origin_story", origin_story_node)
# ... other section writer nodes ...
builder.add_node("qa", qa_node)
builder.add_node("editor_final", editor_final_node)
builder.add_node("sanity_write", sanity_write_node)

# Sequential edges for phase 1
builder.add_edge("calibrator", "scout")
builder.add_edge("scout", "advocate")
builder.add_edge("advocate", "editor_gate1")

# Fan-out from researcher (runs after editor_gate1 completes)
# All 7 section writers start simultaneously
builder.add_edge("editor_gate1", "researcher")
builder.add_conditional_edges(
    "researcher",
    lambda state: ["origin_story", "problem_statement",
                   "founder_bio", "case_study", "game", "bonus", "design"],
    ["origin_story", "problem_statement",
     "founder_bio", "case_study", "game", "bonus", "design"],
)
# Fan-in — all writers must finish before QA
for writer in ["origin_story", "problem_statement",
                "founder_bio", "case_study", "game", "bonus", "design"]:
    builder.add_edge(writer, "qa")

builder.add_edge("qa", "editor_final")
builder.add_edge("editor_final", "sanity_write")
builder.add_edge("sanity_write", END)

# Compile with Postgres checkpointer
async with AsyncPostgresSaver.from_conn_string(SUPABASE_URL) as checkpointer:
    await checkpointer.setup()   # run once (CI/CD migration, not every startup)
    graph = builder.compile(checkpointer=checkpointer)
```

**Fan-out execution rule:** When multiple edges leave a single node pointing to different destination nodes, LangGraph groups those destinations into a *superstep* and executes them concurrently. If **any** node in a superstep raises an exception, the entire superstep fails atomically — no partial state is saved. This means the seven section writers must each have internal retry logic or safe fallback returns.

### Human-in-the-Loop: Editor Gate 1 Interrupt

The `interrupt()` function (LangGraph ≥ 0.2) is the correct pattern. It is not a breakpoint — it pauses mid-node execution, serialises the payload into the checkpoint, and marks the thread as `interrupted`. The node re-executes from the beginning on resume, so all logic before the `interrupt()` call must be idempotent.

```python
# packages/pipeline/agents/editor_gate1.py
from langgraph.types import interrupt, Command

async def editor_gate1_node(state: DispatchState) -> dict:
    # Deterministic: pick the winner from candidate array
    result = await llm_call(editor_prompt(state["candidates"]))

    if result["confidence"] < CONFIDENCE_THRESHOLD:
        # Pause — surfaces to Andrew via Convex pipelineRuns status
        await convex_mutation("pipelineRuns:updateStatus", {
            "runId": state["run_id"],
            "status": "awaiting-editor-decision",
        })
        # interrupt() serialises `result` into the checkpoint
        # Execution halts here; thread is marked interrupted
        human_input = interrupt({
            "reason": "no_clear_winner",
            "candidates": state["candidates"],
            "partial_analysis": result,
        })
        # Resumes here when Command(resume=...) is invoked
        # human_input contains whatever Andrew sent
        chosen_id = human_input["chosen_id"]
    else:
        chosen_id = result["winner_id"]

    winning_charity = next(
        c for c in state["candidates"] if c["name"] == chosen_id
    )
    return {
        "winning_charity": winning_charity,
        "editor_decision": result["rationale"],
        "runner_up_notes": result["runner_up_notes"],
        "deliberation_transcript": result["transcript"],
    }
```

**Resume from interrupt:** The FastAPI app exposes a `POST /run/{run_id}/resume` endpoint. Andrew (or a Convex-triggered webhook) calls it with the chosen charity. The endpoint invokes the graph with `Command(resume={"chosen_id": "..."})` on the same `thread_id`:

```python
# packages/pipeline/api/main.py
@app.post("/run/{run_id}/resume")
async def resume_run(run_id: str, body: ResumeBody):
    config = {"configurable": {"thread_id": run_id}}
    await graph.ainvoke(Command(resume=body.dict()), config=config)
    return {"ok": True}
```

### Checkpointer: Supabase as Postgres Backend

Supabase is a managed Postgres instance. `AsyncPostgresSaver` from `langgraph-checkpoint-postgres` connects directly via the Supabase connection string. This is the correct and only role for Supabase in this system.

```python
# packages/pipeline/lib/checkpointer.py
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

SUPABASE_POSTGRES_URL = os.environ["SUPABASE_URL"]  # direct postgres:// URL

async def get_checkpointer():
    return AsyncPostgresSaver.from_conn_string(SUPABASE_POSTGRES_URL)
```

`checkpointer.setup()` creates three tables: `checkpoints` (state snapshots keyed by `thread_id` + monotonically increasing `checkpoint_id`), `checkpoint_blobs` (overflow for large payloads), and `checkpoint_writes` (pending writes within a superstep). Call `setup()` exactly once during Railway deploy, not on every app startup.

**Thread ID convention:** Use `run_id` (UUID generated at pipeline start) as the `thread_id`. This means every weekly run has a unique, stable checkpoint namespace that can be resumed, forked, or inspected for debugging.

### Common Failure Modes — LangGraph Seam

| Failure | Mechanism | Prevention |
|---|---|---|
| Section writer raises exception | Entire parallel superstep rolls back — no partial writes | Add `try/except` inside each writer node; return a sentinel value on failure rather than raising |
| Interrupt node re-executes on resume | Logic before `interrupt()` runs twice | All pre-interrupt logic must be idempotent (safe to re-run) |
| `checkpointer.setup()` called on every startup | Migration runs repeatedly, fails on concurrent starts | Run only in CI/CD deploy step, not in `on_startup` |
| State key collision in parallel writers | Two nodes overwrite the same key | Each section writer writes only its own key; verify state schema before wiring |
| `thread_id` reuse across runs | Checkpoint from last week's run interferes | Always generate a fresh UUID `run_id` per weekly pipeline trigger |

---

## Architectural Seam 2 — Three-Datastore Boundaries

### Ownership Rules (Explicit)

| Data Entity | Source of Truth | Transient Mirror | Ownership Rule |
|---|---|---|---|
| `charity` document | **Sanity** | Convex `pitchLog` (name/location only) | Sanity is canonical; Convex `pitchLog` is a read-ahead for real-time UI during the run. After publish, `pitchLog` is stale — always re-read charity data from Sanity |
| `weeklyIssue` document | **Sanity** | Convex `pipelineRuns` (status only) | Sanity owns content, editorial state, and publish status. Convex owns pipeline execution state (running/awaiting/complete/failed) |
| `agentProfile` document | **Sanity** | None — cached in React state | Seeded once, read-only. No pipeline writes. |
| Pipeline run events | **Convex** | None | `deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog` live only in Convex. They are never written back to Sanity. They are not canonical content. |
| LangGraph graph checkpoint | **Supabase (Postgres)** | None | LangGraph internal state for pause/resume. Not queryable by the frontend. Never exposed via API. |

### What Lives Where — Decision Rules

**Write to Sanity when:** The data is content that Andrew will read, edit, or publish. Sanity is the record of what shipped.

**Write to Convex when:** The data is a pipeline event that the frontend needs to observe in real-time during a run. Convex has no edit UI — it is a write-ahead log for the deliberation layer.

**Write to Supabase (via checkpointer) when:** LangGraph needs to persist state for fault recovery or interrupt/resume. This is fully managed by the checkpointer — do not write to Supabase manually.

### Preventing Drift Between Stores

The most dangerous drift pattern: Sanity `charity` document gets edited by Andrew after the pipeline wrote it, but Convex `pitchLog` still shows the original Scout data. This is acceptable by design — the deliberation layer shows what the pipeline *decided*, not the current canonical state. Never attempt to sync Convex back to Sanity.

The second dangerous drift: `weeklyIssue.pipelineMetadata.runId` in Sanity does not match any `pipelineRuns` record in Convex. This happens if the Convex mutation fails after the Sanity write. Write Convex `pipelineRuns:create` **before** the LangGraph graph starts — not after — so the run record always precedes any content writes.

**Write order discipline:**
```
1. Convex pipelineRuns:create           ← first write, always
2. LangGraph graph.ainvoke()            ← pipeline runs
3. Convex mutations during run          ← non-blocking, log errors
4. Sanity write_issue_draft()           ← blocking, halt on failure
5. Convex pipelineRuns:updateStatus()  ← awaiting-review
```

### Common Failure Modes — Datastore Seam

| Failure | Mechanism | Prevention |
|---|---|---|
| Convex `pipelineRuns` missing for an issue | Convex write failed or not called | Always write `pipelineRuns:create` before graph starts |
| `runId` on Sanity issue doesn't match Convex | Sanity write used a different `run_id` | `run_id` set once at pipeline start, passed through all of `DispatchState`, never regenerated |
| Frontend deliberation layer shows blank | `runId` missing from `weeklyIssue.pipelineMetadata` | Verify `pipelineMetadata.runId` is populated in `write_issue_draft()` before committing |
| Charity data in Convex `pitchLog` contradicts Sanity | Andrew edited the charity in Studio after run | Expected and acceptable — `pitchLog` is immutable run history |

---

## Architectural Seam 3 — Webhook Reliability (Sanity → Publisher)

### Sanity Webhook Behaviour

Sanity delivers webhooks with at-least-once semantics. It retries **twice** after the initial attempt, with a 30-second interval between retries. It expects a response within 30 seconds or it considers the delivery failed and will retry. Key headers:

| Header | Value | Use |
|---|---|---|
| `sanity-webhook-signature` | `sha256=<hex>` | HMAC-SHA256 signature for verification |
| `sanity-transaction-time` | ISO 8601 datetime | Age check — reject webhooks older than 5 minutes |
| `idempotency-key` | Stable UUID per delivery attempt group | Deduplication key across retries |

### Signature Verification — Correct Pattern

The contract in `docs/API_CONTRACTS.md §5.3` has a bug: `hmac.new(secret, body, hashlib.sha256)` should be `hmac.new(secret, body, hashlib.sha256).hexdigest()` and must use `hmac.compare_digest` on the full `sha256=<hex>` format. The correct implementation:

```python
# packages/pipeline/api/webhooks.py
import hmac
import hashlib
import time
from datetime import datetime, timezone

@router.post("/webhook/sanity-publish")
async def sanity_publish(request: Request, background_tasks: BackgroundTasks):
    body = await request.body()

    # 1. Verify HMAC-SHA256 signature
    signature = request.headers.get("sanity-webhook-signature", "")
    secret = os.environ["SANITY_WEBHOOK_SECRET"].encode()
    computed = "sha256=" + hmac.new(secret, body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed, signature):
        raise HTTPException(status_code=401, detail="Invalid signature")

    # 2. Age check — reject stale webhooks (clock skew attacks)
    tx_time_str = request.headers.get("sanity-transaction-time", "")
    if tx_time_str:
        tx_time = datetime.fromisoformat(tx_time_str.rstrip("Z")).replace(
            tzinfo=timezone.utc
        )
        age_seconds = (datetime.now(timezone.utc) - tx_time).total_seconds()
        if age_seconds > 300:   # 5 minutes
            return {"ok": True, "skipped": True, "reason": "stale"}

    # 3. Idempotency deduplication via idempotency-key header
    idempotency_key = request.headers.get("idempotency-key", "")
    if idempotency_key and await is_already_processed(idempotency_key):
        return {"ok": True, "skipped": True, "reason": "duplicate"}

    # 4. Parse and guard
    payload = await request.json()
    if payload.get("status") != "published":
        return {"ok": True, "skipped": True}

    # 5. Mark processed before enqueuing (atomic — prevents race)
    if idempotency_key:
        await mark_processed(idempotency_key)   # TTL: 1 hour minimum

    # 6. Enqueue Publisher — return 200 immediately, never wait
    background_tasks.add_task(
        run_publisher_with_retry,
        issue_id=payload["_id"],
        issue_number=payload["issueNumber"],
        run_id=payload["runId"],
    )

    return {"ok": True}
```

**Idempotency store:** Use a simple Supabase table or Redis with a 1-hour TTL. A Supabase `webhook_idempotency` table with `key TEXT UNIQUE, processed_at TIMESTAMPTZ` and a unique constraint on `key` gives atomic deduplication without Redis. Insert with `ON CONFLICT DO NOTHING`, then check `affected rows == 1` to determine if this is the first delivery.

### Publisher Retry Pattern

FastAPI's `BackgroundTasks` is fire-and-forget — if `run_publisher()` fails, nothing retries it. The production pattern is to wrap the Publisher in a retry loop and update Convex with failure state:

```python
# packages/pipeline/agents/publisher.py
async def run_publisher_with_retry(issue_id: str, issue_number: int, run_id: str):
    max_attempts = 3
    for attempt in range(max_attempts):
        try:
            await run_publisher(issue_id, issue_number, run_id)
            return
        except Exception as e:
            if attempt == max_attempts - 1:
                await convex_mutation("pipelineRuns:updateStatus", {
                    "runId": run_id,
                    "status": "failed",
                    "errorMessage": f"Publisher failed after {max_attempts} attempts: {e}",
                })
                raise
            await asyncio.sleep(2 ** attempt * 5)   # 5s, 10s, 20s
```

**Missing fallback trigger:** The only way to re-trigger Publisher after a failure is currently to unpublish and re-publish in Sanity. Add a `POST /run/{run_id}/publish` endpoint on FastAPI that bypasses the webhook and directly calls `run_publisher_with_retry`. Andrew can use this if the webhook delivery fails silently.

### Common Failure Modes — Webhook Seam

| Failure | Mechanism | Prevention |
|---|---|---|
| Webhook fires twice (Sanity retry) | Sanity retries on no-response | Deduplicate on `idempotency-key` header |
| Publisher silently fails | `BackgroundTasks` is fire-and-forget | Wrap in retry loop; update Convex status on failure |
| Stale webhook replays an old publish | No age check | Check `sanity-transaction-time` header; reject if >5 minutes old |
| Vercel deploy hook times out | 30s Vercel timeout for deploy hook POST | Run deploy hook with `timeout=30.0`; if it times out, log and continue — Vercel usually still processes it |
| Railway is down when Sanity fires | Sanity retries twice (30s apart), then gives up | Add a manual re-trigger endpoint; log all failures to Convex so Andrew can see the failure state |

---

## Architectural Seam 4 — Monorepo Type Sharing

### Repository Structure

```
eisenbalm/
├── apps/
│   ├── web/                    # Next.js 14+ App Router
│   │   ├── lib/sanity/
│   │   │   ├── client.ts       # @sanity/client instance
│   │   │   └── queries.ts      # All GROQ queries (typed returns)
│   │   ├── types/
│   │   │   └── issue.ts        # Frontend-facing TypeScript types
│   │   └── convex/             # Symlink or re-export from root convex/
│   └── studio/                 # Sanity Studio v3
│       └── schemas/            # Drop-in from /schemas/
├── packages/
│   ├── pipeline/               # FastAPI + LangGraph (Python)
│   │   ├── types.py            # DispatchState TypedDict (Python source of truth)
│   │   ├── agents/             # One file per agent
│   │   ├── lib/                # sanity_client.py, convex_client.py, etc.
│   │   └── api/                # FastAPI app, webhook handler
│   └── shared/                 # TypeScript shared types
│       ├── package.json        # name: "@eisenbalm/shared"
│       ├── tsconfig.json       # composite: true
│       └── src/
│           ├── index.ts        # re-exports everything
│           ├── dispatch-state.ts  # TypeScript mirror of DispatchState
│           └── api-contracts.ts   # Typed contracts from API_CONTRACTS.md
├── convex/                     # Convex schema + function files
│   ├── schema.ts               # Convex schema (already complete)
│   ├── pipelineRuns.ts
│   ├── deliberationEvents.ts
│   ├── agentVotes.ts
│   ├── qaCorrections.ts
│   └── pitchLog.ts
├── schemas/                    # Sanity schemas (already complete)
├── turbo.json                  # Turborepo pipeline config
└── package.json                # pnpm workspaces root
```

### Type Sharing Strategy: Two Sources of Truth, Never One

A TypeScript→Python code generator (pydantic2zod or similar) is appealing but fragile for this project. The API contracts are small and stable. The correct strategy is **dual maintenance with a contract test**:

1. `packages/pipeline/types.py` — Python `DispatchState` TypedDict is the authoritative definition of inter-agent state. Python owns this.
2. `packages/shared/src/dispatch-state.ts` — TypeScript mirror for the frontend types (used only for the deliberation layer's type safety). TypeScript owns the mapping.
3. `docs/API_CONTRACTS.md §7` — The contract document is the specification. Both files must match it.

**Contract test:** A Python test that serialises a `DispatchState` to JSON and validates it against the TypeScript Zod schema (exported from `packages/shared`) catches drift at CI time.

### Turborepo Configuration

```json
// turbo.json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

```jsonc
// packages/shared/tsconfig.json
{
  "compilerOptions": {
    "composite": true,          // required for project references
    "declaration": true,
    "declarationMap": true,
    "moduleResolution": "NodeNext",
    "module": "NodeNext"
  }
}
```

**Package reference pattern:**
```json
// apps/web/package.json
{
  "dependencies": {
    "@eisenbalm/shared": "workspace:*"
  }
}
```

```json
// apps/web/tsconfig.json
{
  "references": [
    { "path": "../../packages/shared" }
  ]
}
```

This pattern ensures Turborepo builds `packages/shared` before `apps/web`, type changes propagate correctly, and there is no compiled JavaScript to keep in sync.

### The Convex Generated Types

Convex generates `convex/_generated/api.d.ts` and `convex/_generated/server.d.ts` from schema. These are the authoritative types for all Convex queries and mutations. Do not manually write types for Convex table shapes — use the generated types and let Convex's validator system enforce shapes at runtime.

The `convex/` directory at the monorepo root is consumed by both the Convex cloud deployment and `apps/web` (via `NEXT_PUBLIC_CONVEX_URL`). Never duplicate Convex function files into `apps/web/` — reference `convex/_generated/api` from the root.

### Common Failure Modes — Type Sharing Seam

| Failure | Mechanism | Prevention |
|---|---|---|
| Python `DispatchState` gains a field, TypeScript mirror doesn't | Dual maintenance drift | Contract test in CI that validates both against `docs/API_CONTRACTS.md §7` |
| Convex `_generated` types stale | `npx convex dev` not run after schema change | Include `convex codegen` in the `dev` task; never commit without regenerating |
| `packages/shared` build not listed in `turbo.json` dependency | `apps/web` builds without latest shared types | Ensure `shared#build` is in `dependsOn` for `web#build` |
| `moduleResolution` mismatch | `apps/web` uses `bundler`, `shared` uses `NodeNext` | Align `moduleResolution` across all packages or use `"exports"` field correctly |

---

## Data Flow Diagrams

### 1. Weekly Run Trigger

```
Every Thursday (cron or manual)
    │
    ▼
POST /run  (FastAPI on Railway)
    │
    ├─ Generate run_id (UUID)
    ├─ Set issue_number, publish_date
    ├─ Convex: pipelineRuns:create {runId, issueNumber, startedAt}
    │
    ▼
graph.ainvoke(initial_state, config={"configurable": {"thread_id": run_id}})
    │
    ├─ Calibrator node ──► writes StyleBrief to state
    │
    ├─ Scout node
    │   ├─ For each candidate found:
    │   │   ├─ Sanity: write_charity() (deterministic _id)
    │   │   ├─ Convex: pitchLog:insert (live feed to frontend)
    │   │   └─ Convex: deliberationEvents:insert (scout-finding)
    │   └─ Returns candidates[] in state
    │
    ├─ Advocate node
    │   └─ For each candidate:
    │       ├─ Convex: deliberationEvents:insert (advocate-argument)
    │       └─ Convex: agentVotes:insert
    │
    ├─ Editor Gate 1 node
    │   ├─ If confidence high:
    │   │   └─ Returns winning_charity, editor_decision in state
    │   └─ If confidence low:
    │       ├─ Convex: pipelineRuns:updateStatus (awaiting-editor-decision)
    │       └─ interrupt({reason, candidates})  ◄── PAUSES HERE
    │           ... Andrew reviews Convex deliberation layer ...
    │           POST /run/{run_id}/resume with chosen_id
    │           └─ graph resumes from interrupt() return value
    │
    ├─ [PARALLEL SUPERSTEP]
    │   Researcher ──────────────────────────────────────────────────┐
    │   ├─ OriginStoryWriter ─────────────────────────────────────┐  │
    │   ├─ ProblemWriter ────────────────── Convex: section-draft │  │
    │   ├─ FounderBioWriter ────────────── events per agent       │  │
    │   ├─ CaseStudyWriter ──────────────────────────────────────┐│  │
    │   ├─ GameWriter ───────────────────────────────────────────┘│  │
    │   ├─ BonusWriter ──────────────────────────────────────────┘│  │
    │   └─ DesignAgent ─────────────────────────────────────────────┘
    │   [All complete before QA starts]
    │
    ├─ QA node ──► Convex: qaCorrections:insert (per correction)
    ├─ Editor Final node ──► Convex: deliberationEvents:insert (editor-final)
    │
    ├─ Sanity: write_issue_draft() (status='draft')  ◄── BLOCKING
    │
    └─ Convex: pipelineRuns:updateStatus (awaiting-review)

Pipeline exits. Andrew sees draft in Studio.
```

### 2. Agent Handoffs (Phase 2 Parallel → QA Fan-In)

```
State after Editor Gate 1:
  winning_charity: {name, location, ...}
  style_brief: {voice, constraints, bonusType, visualDirection}

Researcher runs (sequential, before parallel writers):
  → Adds to state: research: {foundingMoment, founderName, ...}

Parallel superstep (all start simultaneously, share state snapshot):
  ┌─ OriginStoryWriter ─── reads: research, style_brief
  │                         writes: origin_story: {headline, body}
  │
  ├─ ProblemWriter ──────── reads: research, style_brief
  │                         writes: problem_statement, problem_pdf_content
  │
  ├─ FounderBioWriter ───── reads: research, style_brief
  │                         writes: founder_bio: {headline, body}
  │
  ├─ CaseStudyWriter ─────── reads: research, style_brief
  │                         writes: case_study: {subjectName, headline, body}
  │
  ├─ GameWriter ─────────── reads: research, style_brief, winning_charity
  │                         writes: game: {headline, description, embedCode}
  │
  ├─ BonusWriter ─────────── reads: research, style_brief, bonusType
  │                         writes: bonus: {headline, body, [lyrics, sunoPrompt]}
  │
  └─ DesignAgent ─────────── reads: style_brief, winning_charity
                            writes: theme: {primaryColor, ..., fontDisplay, fontBody}

All 7 writers complete → LangGraph merges all writes into shared state
(No reducer needed — each writer owns a distinct state key)

QA node starts:
  reads: ALL section outputs from state
  writes: qa_corrections[], corrected section content back into state

Editor Final node starts:
  reads: QA output
  writes: editor_final_notes, may patch individual section fields
```

### 3. Andrew Publishes → Vercel Deploys

```
Andrew in Sanity Studio:
    Opens weeklyIssue (status='draft')
    Reviews all sections
    Sets status → 'published'
    Clicks Publish
         │
         ▼
Sanity Content Lake
    Detects: _type == "weeklyIssue" && status == "published"
    Fires webhook to: https://<railway-domain>/webhook/sanity-publish
    Headers: sanity-webhook-signature, sanity-transaction-time, idempotency-key
    Body: { _id, _type, status, issueNumber, runId }
         │
         ▼
FastAPI webhook handler (Railway):
    ① Verify HMAC-SHA256 signature (reject 401 if invalid)
    ② Check sanity-transaction-time age (<5 min)
    ③ Check idempotency-key not already processed
    ④ Guard: status == "published"
    ⑤ Mark idempotency-key processed
    ⑥ Enqueue Publisher (BackgroundTasks) — return 200 immediately
         │
         ▼  (async, Sanity does not wait)
Publisher agent (Railway background task):
    │
    ├─ Generate PDF via WeasyPrint from problem_pdf_content
    │   (themed to issue.theme colors and fonts)
    │
    ├─ Upload PDF to Sanity:
    │   sanity.assets.upload('file', pdf_bytes, filename)
    │   sanity.patch(issue_id).set({problemPdf: {_ref: asset._id}}).commit()
    │
    ├─ Set charity.firstFeaturedIn (if not already set)
    │
    ├─ Trigger Vercel deploy hook:
    │   POST VERCEL_DEPLOY_HOOK_URL (timeout=30s)
    │
    ├─ Convex: pipelineRuns:updateStatus (complete)
    └─ Convex: deliberationEvents:insert (publisher-deploy)

         │
         ▼  (async, after Vercel build completes ~2-5 minutes)
Vercel deploys new Next.js build:
    getStaticProps/generateStaticParams re-runs
    Fetches latest published issue from Sanity CDN
    New issue page live at /issue/[slug]
    Homepage redirects to new issue slug

Readers see new issue. Deliberation layer reads Convex by runId.
```

---

## Build Order Implications

### Why Convex Schema Deploys Before Pipeline Skeleton

The pipeline skeleton (Phase 4 per brief) writes to Convex during every agent step. If Convex is not deployed when the skeleton is wired, every mutation silently fails or errors. More critically, the `convex/_generated/api.ts` types that the frontend uses to subscribe to queries do not exist until `npx convex dev` (or `npx convex deploy`) has run against a live Convex project.

**Phase 3 (Convex setup) must complete before Phase 4 (Pipeline skeleton)** because:
1. Pipeline skeleton imports `convex_client.py` which needs `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOY_KEY`
2. Frontend deliberation components need `convex/_generated/api.d.ts` to type-check
3. The `pipelineRuns:create` mutation must succeed before any agent runs

Convex schema deployment is a one-command operation (`npx convex deploy`) with no application code dependencies. Do it first.

### Whether Section Writers Should Be Parallel Within a Phase

Yes — build all seven section writers in **one phase** rather than one at a time, because:
1. They share the same inputs (ResearchOutput + StyleBrief) and the same output pattern ({headline, body})
2. The LangGraph fan-out is wired once; adding a node is a one-line `builder.add_node()` call
3. Stub implementations (returning hardcoded strings) can be swapped in before real LLM calls
4. Testing them independently means verifying the fan-out works once, then adding nodes

The exception: GameWriter is meaningfully different (produces HTML/JS, not text) and DesignAgent is different (produces theme object, not prose). These can be stubbed in Phase 4 and filled in Phase 7 (Game) / Phase 5 (Design, as part of agent quality).

### Where PDF Generation Belongs in the Sequence

PDF generation (Publisher agent, WeasyPrint) is only testable end-to-end when:
1. ProblemWriter produces `problem_pdf_content` (requires Phase 5 agent quality)
2. DesignAgent produces a valid `theme` object with hex colors (Phase 5)
3. Sanity `weeklyIssue.problemPdf` field exists in schema (Phase 1 — already done)
4. Sanity webhook triggers the Publisher (Phase 4 skeleton — webhook endpoint exists)

PDF generation belongs in **Phase 6** (after agent quality, before Game rendering). The stub Publisher in Phase 4 should write a dummy PDF path to Sanity. Real WeasyPrint rendering lands in Phase 6 once ProblemWriter and DesignAgent have real outputs.

### Test and Deploy Strategy for Three-Datastore Sync

The datastores cannot be tested in isolation — they are coupled by `run_id`. The correct test strategy is layered:

**Layer 1 — Unit tests (no live services):**
- Test `text_to_portable_text()` output matches valid Portable Text JSON
- Test each agent node function with mock LLM responses and assert state shape matches `DispatchState`
- Test `write_issue_draft()` constructs the correct Sanity document dict (without calling Sanity)

**Layer 2 — Integration tests (each service individually):**
- Test Sanity writes: call `write_charity()` against a Sanity test dataset; verify document shape
- Test Convex mutations: call `pipelineRuns:create` against the dev Convex deployment; verify record exists
- Test LangGraph checkpointing: run a two-node graph with `AsyncPostgresSaver` against test Postgres; verify checkpoint record in DB

**Layer 3 — End-to-end smoke test (all three together):**
- Run the full pipeline with stub agent responses (no live LLM calls, no web search)
- Verify: Convex has a `pipelineRuns` record, Sanity has a `weeklyIssue` draft, Supabase checkpoint exists
- Verify: `runId` matches across all three systems

**Deploy order per environment:**
1. Deploy Supabase migration (run `checkpointer.setup()` once via `railway run` command)
2. Deploy Convex schema (`npx convex deploy`)
3. Deploy Railway (FastAPI app, which uses both)
4. Deploy Vercel (Next.js, which reads from Sanity and Convex)

Staging environment must mirror this order. Never deploy Railway before Convex — the pipeline will attempt mutations to a schema that doesn't exist.

---

## Anti-Patterns

### Anti-Pattern 1: Writing to Supabase Manually

**What teams do:** See Supabase in the stack, create tables for pipeline run history, agent outputs, search indexes.

**Why it's wrong:** Supabase's only role here is Postgres for `AsyncPostgresSaver`. Its schema is entirely managed by LangGraph's `checkpointer.setup()`. Adding manual tables creates confusion about ownership and risks schema conflicts with LangGraph's checkpoint tables (which use names like `checkpoints`, `checkpoint_blobs`).

**Do this instead:** Convex owns all pipeline observability data. If you need a permanent record of agent outputs beyond the weekly run, add a Convex table. Do not write to Supabase directly.

### Anti-Pattern 2: Syncing Convex Back to Sanity

**What teams do:** After the pipeline run, read from Convex `deliberationEvents` and write a summary back to Sanity `weeklyIssue.deliberationSummary`.

**Why it's wrong:** Creates a two-way dependency — Sanity → Convex (via `runId`) and Convex → Sanity (via sync). Any failure in the sync step corrupts the Sanity document. The deliberation layer's entire value is that it reads Convex directly, not through Sanity.

**Do this instead:** Let Sanity hold only the `runId` reference. The frontend fetches Sanity for content, then uses `runId` to query Convex for the deliberation stream. Never write deliberation data back to Sanity.

### Anti-Pattern 3: Using `interrupt_before` Breakpoints Instead of `interrupt()`

**What teams do:** Compile the graph with `interrupt_before=["editor_gate1"]` to pause before the node runs.

**Why it's wrong:** Breakpoints pause *before* the node runs, which means Editor Gate 1 never executes its LLM call. The interrupt needs to happen *inside* the node, after the LLM has evaluated the candidates and determined confidence is too low. Only `interrupt()` inside the node body gives this conditional behaviour.

**Do this instead:** Use `interrupt()` inside the node function, after the LLM call, only when confidence is below threshold. Compile the graph without `interrupt_before`.

### Anti-Pattern 4: Generating New `run_id` After a Resume

**What teams do:** On resume, generate a new UUID for the run to "restart" the pipeline.

**Why it's wrong:** The `thread_id` in the LangGraph checkpointer is keyed to `run_id`. If you change `run_id` on resume, the checkpointer loads the wrong (or no) state, and the pipeline starts from scratch without the candidates, StyleBrief, or earlier Convex writes.

**Do this instead:** The `run_id` is immutable after pipeline start. Resume always uses the same `run_id` as the `thread_id`. If you need to restart from scratch (not resume), generate a new `run_id` and start a new graph invocation.

### Anti-Pattern 5: BackgroundTasks Without Observability

**What teams do:** Fire `background_tasks.add_task(run_publisher, ...)` and assume it runs.

**Why it's wrong:** FastAPI's `BackgroundTasks` runs in the same process. If Railway restarts the server while the Publisher is running (e.g., deploy), the Publisher task is killed with no record of failure. There is no retry, no alert, no way to detect the failure from the outside.

**Do this instead:** At minimum, write the Publisher start and outcome to Convex `deliberationEvents` and `pipelineRuns`. If Railway restarts mid-Publisher, the Convex record will show no `publisher-deploy` event — this is the observable signal that Publisher failed and needs re-triggering via the manual `/run/{run_id}/publish` endpoint.

---

## Recommended Project Structure

```
eisenbalm/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── page.tsx                    # redirects to latest issue
│   │   │   ├── issue/[slug]/page.tsx
│   │   │   ├── archive/page.tsx
│   │   │   ├── charities/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [slug]/page.tsx
│   │   │   ├── shop/
│   │   │   │   ├── page.tsx
│   │   │   │   └── thank-you/page.tsx
│   │   │   └── api/
│   │   │       ├── checkout/route.ts
│   │   │       └── webhooks/stripe/route.ts
│   │   ├── components/
│   │   │   └── DeliberationLayer.tsx       # Convex useQuery hooks here
│   │   ├── lib/
│   │   │   └── sanity/
│   │   │       ├── client.ts
│   │   │       └── queries.ts              # typed GROQ from API_CONTRACTS.md §1
│   │   ├── types/
│   │   │   └── issue.ts
│   │   └── tsconfig.json                   # references: [{path: "../../packages/shared"}]
│   └── studio/
│       ├── schemas/                         # copied from /schemas/
│       └── sanity.config.ts
├── packages/
│   ├── pipeline/
│   │   ├── types.py                         # DispatchState TypedDict (Python source)
│   │   ├── graph.py                         # LangGraph graph definition
│   │   ├── agents/
│   │   │   ├── calibrator.py
│   │   │   ├── scout.py
│   │   │   ├── advocate.py
│   │   │   ├── editor_gate1.py              # contains interrupt()
│   │   │   ├── researcher.py
│   │   │   ├── section_writers/
│   │   │   │   ├── origin_story.py
│   │   │   │   ├── problem_statement.py
│   │   │   │   ├── founder_bio.py
│   │   │   │   ├── case_study.py
│   │   │   │   ├── game.py
│   │   │   │   ├── bonus.py
│   │   │   │   └── design.py
│   │   │   ├── qa.py
│   │   │   ├── editor_final.py
│   │   │   └── publisher.py
│   │   ├── lib/
│   │   │   ├── checkpointer.py              # AsyncPostgresSaver factory
│   │   │   ├── convex_client.py             # httpx HTTP API wrapper
│   │   │   ├── sanity_client.py             # Python Sanity client
│   │   │   ├── portable_text.py             # text_to_portable_text helper
│   │   │   └── search_client.py             # Tavily/Brave wrapper
│   │   ├── api/
│   │   │   ├── main.py                      # FastAPI app, /run endpoint
│   │   │   └── webhooks.py                  # /webhook/sanity-publish handler
│   │   └── tests/
│   │       ├── test_portable_text.py
│   │       ├── test_dispatch_state.py       # validates state schema
│   │       └── test_pipeline_smoke.py       # stub agents, full graph run
│   └── shared/
│       ├── package.json                     # name: "@eisenbalm/shared"
│       ├── tsconfig.json                    # composite: true
│       └── src/
│           ├── index.ts
│           ├── dispatch-state.ts            # TypeScript mirror of DispatchState
│           └── api-contracts.ts            # typed shapes from API_CONTRACTS.md
├── convex/
│   ├── schema.ts                            # already complete
│   ├── pipelineRuns.ts
│   ├── deliberationEvents.ts
│   ├── agentVotes.ts
│   ├── qaCorrections.ts
│   └── pitchLog.ts
├── schemas/                                 # Sanity schemas (already complete)
├── turbo.json
├── package.json                             # pnpm workspaces
└── pnpm-workspace.yaml
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---|---|---|
| Sanity CMS | Python: `sanity` SDK for writes; TypeScript: `@sanity/client` for reads | Two clients, two auth tokens (write token for pipeline, CDN token for frontend) |
| Convex | Pipeline: HTTP API (`httpx` POST to `/api/mutation`); Frontend: `convex/react` `useQuery` hooks | Never share deploy key with frontend; use `NEXT_PUBLIC_CONVEX_URL` only |
| Supabase (Postgres) | LangGraph `AsyncPostgresSaver` only — direct Postgres connection string | Do not use Supabase JS SDK or REST API — only the Postgres wire protocol |
| OpenRouter | `httpx` with `Authorization: Bearer` header; one shared client in `packages/pipeline/lib/` | Per-agent model selection via params, not separate clients |
| Vercel | `POST VERCEL_DEPLOY_HOOK_URL` — fire-and-forget from Publisher | 30s timeout; log the HTTP response code; non-blocking on failure |
| Stripe | `stripe` npm SDK in `apps/web/app/api/`; webhook handler in `apps/web/app/api/webhooks/stripe/route.ts` | Verify signature with `stripe.webhooks.constructEvent`; always return 200 |

### Internal Boundaries

| Boundary | Communication | Notes |
|---|---|---|
| Pipeline ↔ Sanity | Python `sanity` client over HTTPS | Writes blocked on failure; no retry in v1 (add in Phase 5) |
| Pipeline ↔ Convex | Python `httpx` HTTP mutations | Non-blocking; log failures but continue |
| Pipeline ↔ Supabase | LangGraph `AsyncPostgresSaver` (Postgres) | Managed by checkpointer; never bypass |
| Frontend ↔ Sanity | `@sanity/client` GROQ with CDN | Read-only; all writes go through pipeline |
| Frontend ↔ Convex | `convex/react` `useQuery` WebSocket subscriptions | Real-time; no auth on public queries |
| Sanity → Pipeline | GROQ webhook POST | HMAC verification + idempotency-key deduplication |

---

## Sources

- [LangGraph Human-in-the-Loop — interrupt() pattern](https://www.langchain.com/blog/making-it-easier-to-build-human-in-the-loop-agents-with-interrupt)
- [Architecting Human-in-the-Loop Agents in LangGraph](https://medium.com/data-science-collective/architecting-human-in-the-loop-agents-interrupts-persistence-and-state-management-in-langgraph-fa36c9663d6f)
- [LangGraph Persistence Guide 2026](https://fast.io/resources/langgraph-persistence/)
- [LangGraph AsyncPostgresSaver — PyPI](https://pypi.org/project/langgraph-checkpoint-postgres/)
- [LangGraph Parallel Execution — Best Practices](https://forum.langchain.com/t/best-practices-for-parallel-nodes-fanouts/1900)
- [LangGraph Map-Reduce with Send API](https://machinelearningplus.com/gen-ai/langgraph-map-reduce-parallel-execution/)
- [Sanity Webhook Best Practices](https://www.sanity.io/docs/content-lake/webhook-best-practices)
- [Sanity GROQ Webhooks Documentation](https://www.sanity.io/docs/content-lake/webhooks)
- [Sanity Webhook Toolkit (GitHub)](https://github.com/sanity-io/webhook-toolkit)
- [Turborepo TypeScript Guide](https://turbo.build/repo/docs/handbook/linting/typescript)
- [FastAPI + LangGraph Production Pattern](https://ranjankumar.in/building-production-ready-ai-agent-services-fastapi-langgraph-template-deep-dive)

---
*Architecture research for: The Eisenbalm Dispatch — 9-agent LangGraph pipeline with three datastores*
*Researched: 2026-05-09*
