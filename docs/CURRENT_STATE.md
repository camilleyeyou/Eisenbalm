# Eisenbalm — Current State (Phase 0 Reconciliation)

This is the read-only ground-truth gate for the Mission Control dashboard. It
reconciles the dashboard brief's assumptions against the ACTUAL codebase as of
2026-06-21. No production code was changed during this investigation. Every
claim below carries a `path:line` citation (or an explicit "not found" with
search evidence). Planners MUST read this before scoping any dashboard phase.

---

## TL;DR

| Question | Answer | Key citation |
|---|---|---|
| Q1 — Where do agent prompts live? | Markdown files in `packages/pipeline/src/eisenbalm_pipeline/prompts/`, loaded at runtime by `lib/prompts.py::load_prompt()`. NOT in any database. | `lib/prompts.py:49-70` |
| Q2 — What orchestrates and triggers the pipeline? | LangGraph graph (`graph/builder.py`) + FastAPI (`api/runs.py`). Trigger is `POST /run/weekly` guarded by `X-Pipeline-Trigger-Secret`. Weekly cron is a SEPARATE Railway service calling `cli.py trigger-weekly` — **documented but NOT yet provisioned** (manual Andrew step). | `graph/builder.py:89-158`, `api/runs.py:177-241`, `cli.py:29-32` |
| Q3 — Where does generated content land? | Split three ways: Sanity (canonical content), Convex (deliberation / run events), Postgres checkpointer (LangGraph state). Postgres env var is now a misnomer. | `agents/publisher/__init__.py:59-77`, `graph/checkpointer.py:36` |
| Q4 — Per-run logging / cost capture? | Real OpenRouter tokens + USD captured per-call in `acomplete` (commits da6e43d/99d68b8), accumulated per-agent in `lib/cost.py`, persisted to Convex `pipelineRuns.cost` + `durationMs` and Sanity `pipelineMetadata.cost` at pipeline end. Not fire-and-forget. | `openrouter_client.py:112-128`, `cost.py:83-109`, `publisher/__init__.py:59-77` |
| Q5 — Frontend auth story? | None. No middleware, no auth provider, no login, no protected routes. Only server routes are Stripe checkout, Stripe webhook, and email unsubscribe. Public site. | Not found: searched `apps/web` for auth/login/session/middleware — zero matches |

---

## Q1 — Where Agent Prompts Live

**This is the most important finding for the dashboard.**

### Location

Prompts are markdown files at:

```
packages/pipeline/src/eisenbalm_pipeline/prompts/
  README.md
  advocate.md
  bonus-big-budget.md
  bonus-jingle.md
  bonus-spec-ad.md
  calibrator.md
  design.md
  editor-final.md
  editor.md
  game.md
  researcher.md
  scout.md
```

Confirmed present: `ls packages/pipeline/src/eisenbalm_pipeline/prompts/` — 12 files
including README.md. Note: no `chronicler.md` or `founder_bio.md` in the prompts
directory (those agents may inline their prompts or load from a different path;
not investigated further).

### Loader

`packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py:49-70`:

```python
def load_prompt(name: str) -> str:
    path = files("eisenbalm_pipeline").joinpath("prompts", f"{name}.md")
    raw: str = path.read_text("utf-8")
    return _extract(raw, name)
```

Resolution strategy: `importlib.resources.files("eisenbalm_pipeline").joinpath("prompts", ...)`
— works from an installed wheel on Railway AND from an editable install in dev.
Never uses `os.getcwd()` or bare relative paths.

Marker convention (`lib/prompts.py:26-46`): each `.md` has an editorial header
BEFORE `<!-- PROMPT START -->` and the verbatim prompt template BETWEEN
`<!-- PROMPT START -->` and `<!-- PROMPT END -->`. `load_prompt()` strips exactly
one leading and one trailing newline from the extracted content, returning
a `{token}`-placeholder template ready for `str.replace()` substitution.

### Agent call sites (confirmed)

| Agent file | Import line | Call line |
|---|---|---|
| `agents/scout.py` | `:34` | `:192` — `load_prompt("scout").replace(...)` |
| `agents/calibrator.py` | `:28` | `:109` — `load_prompt("calibrator")` |
| `agents/editor.py` | `:48` | `:194`, `:440` — `load_prompt("editor")`, `load_prompt("editor-final")` |
| `agents/advocate.py` | `:36` | `:67` — `load_prompt("advocate")` |
| `agents/researcher.py` | `:30` | `:85` — `load_prompt("researcher").replace(...)` |
| `agents/bonus.py` | `:39` | `:130`, `:144`, `:159` — all three bonus variants |
| `agents/game.py` | `:21` | `:61` — `load_prompt("game")` |
| `agents/design/__init__.py` | `:45` | `:99` — `load_prompt("design")` |

No agent embeds its system prompt inline. Every confirmed agent calls `load_prompt(name)`.

### Related prompt surfaces (also file-externalized)

- **Voice constraints:** `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py`
  — contains `VOICE_CONSTRAINTS` (Jesse persona block + universal hard-rule
  block), `assemble_voice(narrator)` (Phase 16), and
  `build_section_writer_prompt(...)`. Injected into agent prompts at call time
  via `str.replace("{VOICE_CONSTRAINTS}", VOICE_CONSTRAINTS)`.
- **QA rubric:** `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md`
  — loaded via the same `importlib.resources` mechanism.

### Implication for the dashboard

**Prompts are file-externalized in code (shipped in the wheel), NOT in any
database.** Moving prompts to a DB requires replacing the `load_prompt()` file
loader with a DB-backed loader at the call sites listed above. This is not an
extraction of hardcoded strings — it is a loader swap. Existing code would need
to continue working when the DB is unreachable (fallback to the file versions or
fail fast; the dashboard scope must decide).

---

## Q2 — Pipeline Orchestration and Trigger

### Orchestration

LangGraph `StateGraph` assembled in
`packages/pipeline/src/eisenbalm_pipeline/graph/builder.py:89-158`:

- `builder = StateGraph(DispatchState)` at `:98`
- 14 named nodes added (`:101-127`): calibrator, scout, advocate, editor_gate_1,
  chronicler, researcher, verify_research, 7 parallel section writers,
  validate_sections, qa, editor_final, publisher
- Sequential pre-fan-out edges (`:130-141`): `START → calibrator → scout →
  advocate → editor_gate_1 → chronicler → researcher → verify_research`
- 7-way fan-out from `verify_research` to the section writers (`:145-147`,
  Pattern A plain multi-target edges — no Annotated reducers needed because
  each writer mutates a distinct DispatchState field)
- Fan-in: all 7 writers → `validate_sections → qa → editor_final → publisher →
  END` (`:149-153`)
- Compiled once with checkpointer: `builder.compile(checkpointer=checkpointer)`
  at `:158`

FastAPI application: `packages/pipeline/src/eisenbalm_pipeline/api/main.py`.
Routes in `packages/pipeline/src/eisenbalm_pipeline/api/runs.py`.

### Trigger mechanism

`POST /run/weekly` route at `api/runs.py:177-241`:

- Guarded by `_require_trigger_secret()` at `:110-129` — checks
  `X-Pipeline-Trigger-Secret` header against `PIPELINE_TRIGGER_SECRET` env var.
  If `PIPELINE_TRIGGER_SECRET` is unset (local dev), the check is skipped with
  a logged warning (`:118-122`).
- Graph is `None` if the Postgres pool failed at startup; returns 503 via
  `_require_graph()` at `:132-149`.
- Launches a strong-ref'd `asyncio.create_task(_execute_run(...))` at `:235-239`
  and returns `{runId}` immediately — the run continues in background.

### Scheduler status

The trigger CLI is `packages/pipeline/src/eisenbalm_pipeline/cli.py::trigger_weekly`
(`:29-32`, `:120-127`): posts to `{PIPELINE_SELF_URL}/run/weekly` on cron
schedule `0 14 * * 4` (Thursday 14:00 UTC). The `.env.example` at line `:45`
references a "SEPARATE Railway weekly-cron service, not the always-on web API
(V2-03)."

**Standing up the cron is documented but is a MANUAL ANDREW STEP:**
`packages/pipeline/README.md:204-208` states it requires Railway auth and is
"out of scope for the code change that added `trigger-weekly`."

**Not found (scheduler absence evidence):**
- No `.github/` directory exists at the repo root (confirmed via `ls`).
- No `vercel.json` found at root or in `apps/web/` (confirmed via `find`).
- `convex/crons.ts` exists but contains only an email-retry-sweep (hourly at
  `:30`) — no pipeline trigger.
- `packages/pipeline/railway.toml` contains `preDeployCommand` (DDL setup) but
  NO cron/schedule config — Railway cron requires a separate service with its
  own `railway.toml`, which is not in the codebase.

**Conclusion:** The pipeline is currently triggered manually (or via a Railway
cron service that is not yet provisioned). The code for automated triggering
exists (`cli.py trigger-weekly`), but the infrastructure to schedule it weekly
is not in the repo and has not been set up per README.md.

---

## Q3 — Where Generated Content Lands

Content from a pipeline run lands in **three** destinations:

### Sanity (canonical published content)

`agents/publisher/__init__.py:68`:
```python
issue_id = await write_issue_draft(sanity_http, state, cost_payload)
```

`lib/sanity_client.py::write_issue_draft` (referenced at `publisher/__init__.py:37`).
Writes the full issue draft — all section content, portable text, PDF URL, cost
metadata — to Sanity as `weeklyIssue` document with `status='draft'`. Andrew
then publishes via Sanity Studio.

### Convex (real-time deliberation events, run metadata, votes, pitch log)

`agents/publisher/__init__.py:70-77`:
```python
await convex_mutation_safe(
    "pipelineRuns:updateStatus",
    {
        "runId": run_id,
        "status": "awaiting-review",
        "completedAt": ...,
        "durationMs": duration_ms,
        "cost": cost_payload_to_json(cost_payload),
    },
)
```

Five Convex tables: `pipelineRuns`, `deliberationEvents`, `agentVotes`,
`qaCorrections`, `pitchLog` (defined in `convex/schema.ts`). Pipeline emits
to these via `lib/convex_client.py::convex_mutation` (HTTP calls) throughout
execution. The `deliberationEvents` table is the real-time stream for the
frontend deliberation layer.

### Postgres checkpointer (LangGraph ephemeral state)

`graph/checkpointer.py:36`:
```python
return os.environ["SUPABASE_POSTGRES_URL"]
```

The `AsyncPostgresSaver` stores LangGraph checkpoint state (to survive
pipeline restarts at the Editor Gate 1 interrupt). These are the
`checkpoints` and `checkpoint_blobs` tables created by the
`setup-checkpointer` CLI subcommand (invoked by Railway `preDeployCommand`).

**SUPABASE_POSTGRES_URL is a misnomer.** Per project memory (recorded
2026-06-12): the original Supabase project was deleted. The env var now points
at a **Railway Postgres** service via `${{Postgres.DATABASE_URL}}` (internal
Railway reference). The code (`graph/checkpointer.py:28-43`) reads the URL
verbatim — the var name is the only artifact of the original Supabase origin.
`packages/pipeline/.env.example` (lines `:1-20`) still documents the old Supabase
URL format; it is stale for local dev.

---

## Q4 — Per-Run Logging and Cost Capture

### What acomplete captures

`lib/openrouter_client.py:112-128` (`_usage_from_message()`):

```python
um = getattr(msg, "usage_metadata", None) or {}
rm = getattr(msg, "response_metadata", None) or {}
token_usage = rm.get("token_usage") or {}
cost = token_usage.get("cost")
usd = float(cost) if cost is not None else 0.0
return {
    "tokens_in": int(um.get("input_tokens", 0) or 0),
    "tokens_out": int(um.get("output_tokens", 0) or 0),
    "usd": usd,
    "resolved_model": rm.get("model_name") or rm.get("model") or fallback_model,
}
```

**REAL usage, not estimated.** `tokens_in` / `tokens_out` come from OpenRouter's
`usage_metadata` on the `AIMessage`. `usd` comes from
`response_metadata["token_usage"]["cost"]` — OpenRouter's authoritative usage
accounting, enabled via `extra_body={"usage": {"include": True}}` at
`openrouter_client.py:95-96` (set when building the ChatOpenAI client).

Commits da6e43d and 99d68b8 confirmed to touch `openrouter_client.py` and
`cost.py`:
```
da6e43d fix(quick-260621-d31): capture real OpenRouter tokens+USD in acomplete
```

### Granularity

**Per-call, accumulated per-agent, reported per-run.** Each `acomplete()` call
invokes `record_cost(run_id, agent_id, ...)` at `openrouter_client.py:221-224`
(structured output path) and `:235-238` (plain string path). `lib/cost.py::record_cost`
(`cost.py:83-109`) is additive — multiple calls for the same `(run_id,
agent_id)` pair accumulate into one `AgentCost` entry. Final shape:

```json
{
  "total": 0.42,
  "agents": {
    "calibrator": {"tokens_in": 1200, "tokens_out": 800, "usd": 0.04, "duration_ms": 1200},
    "scout": { ... },
    ...
  }
}
```

### Persistence

`agents/publisher/__init__.py:59-77`:
```python
cost_payload, duration_ms = end_run(run_id)   # clears in-memory store
issue_id = await write_issue_draft(...)        # Sanity: pipelineMetadata.cost
await convex_mutation_safe(
    "pipelineRuns:updateStatus",
    {
        "durationMs": duration_ms,
        "cost": cost_payload_to_json(cost_payload),  # JSON-stringified
    },
)
```

Two persistence targets:
1. **Convex `pipelineRuns.cost`** — JSON string, `v.optional(v.string())`
2. **Sanity `weeklyIssue.pipelineMetadata.cost`** — same JSON string, `type: 'text'`

**Not fire-and-forget.** The Publisher node awaits the Convex mutation. A
soft cost-cap warn emits a fire-and-forget Convex event at 70% of cap
(`cost.py:244-261`) — that WARN is fire-and-forget, but the final cost persist
at pipeline end is awaited.

---

## Q5 — Frontend Auth

**No user authentication exists anywhere in `apps/web`.**

**Evidence (what was searched and what was found):**

| Search | Result |
|---|---|
| `find apps/web -name "middleware.ts"` | No matches |
| `grep -r "NextAuth\|clerk\|supabase-auth\|auth0\|next-auth\|withAuth\|getServerSession\|getSession\|useSession" apps/web` | No matches |
| `apps/web/app/api/` directory listing | Three routes only: `checkout/create-session/route.ts`, `email/unsubscribe/route.ts`, `stripe/webhook/route.ts` |
| Pattern search for auth/login/session in `apps/web/app/layout.tsx` | One hit: a comment in a JS string (`"no user input"`) — not auth code |

**Conclusion:** The site is fully public. No login, no session, no protected
routes. The Stripe checkout route is the only commerce-gated interaction, and
it is protected by Stripe signature verification — not user auth. If the
dashboard requires Andrew to log in (to view pipeline status, trigger runs,
approve charity selections), auth must be built from zero.

---

## Divergences from the Mission Control brief

The brief assumes certain architectural facts that differ from reality.

**(a) Prompts are files in code, not a database.**
The brief's premise — externalizing agent prompts out of code into a DB —
assumes they are currently hardcoded inline in Python files. They are NOT.
They are already externalized into `.md` files under
`packages/pipeline/src/eisenbalm_pipeline/prompts/` and loaded at runtime
by `lib/prompts.py::load_prompt()`. Moving to a DB means replacing a
file-based loader with a DB-backed loader, not extracting embedded strings.
Scope must include: loader swap, fallback strategy (file vs DB unavailable),
migration of the 12 existing `.md` files, and versioning semantics.

**(b) `SUPABASE_POSTGRES_URL` points at Railway Postgres, not Supabase.**
The env var name implies Supabase but the actual database as of 2026-06-12
is a Railway Postgres service. `packages/pipeline/.env.example` still documents
Supabase URL formats and session-pooler warnings that no longer apply. Dashboard
scope involving database access, infra docs, or env var configuration must use
the Railway Postgres reality, not the Supabase name. The rename to `POSTGRES_URL`
was offered but not done.

**(c) The weekly pipeline trigger is documented but not yet provisioned.**
The code for automated weekly triggering exists (`cli.py::trigger_weekly`,
cron `0 14 * * 4`). The infrastructure — a SEPARATE Railway cron service
running that command — is documented in `packages/pipeline/README.md:204-208`
as a manual Andrew step. The `POST /run/weekly` endpoint is live; the weekly
automation is not. The dashboard must account for this when presenting run
scheduling or status — it cannot rely on runs appearing automatically.

**(d) Frontend auth must be built from zero.**
If the dashboard requires any authenticated surface (Andrew viewing pipeline
status, triggering runs, approving charity selections), there is no existing
auth layer to extend. No NextAuth, no Clerk, no middleware, no session. Any
auth must be designed and implemented from scratch. The existing site is 100%
public.

**(e) No Vercel cron or GitHub Actions exist.**
No `.github/` directory at the repo root. No `vercel.json` with cron
configuration. Convex crons are wired only for email-retry-sweep (Phase 20),
not pipeline triggering. All cron infrastructure for the pipeline is
Railway-only and not yet provisioned.

**(f) DesignAgent is reversibly suppressed via env flag.**
`graph/builder.py:70-71`: `_SUPPRESSED = os.environ.get("DESIGNAGENT_SUPPRESSED", "").lower() in ("1", "true", "yes")`.
If the dashboard surfaces per-issue theme generation, it must account for this
flag. Setting `DESIGNAGENT_SUPPRESSED=true` removes the `design` node from the
graph entirely.

**(g) Per-issue theming was re-enabled in Phase 19, reversing Phase 12/14 locks.**
Per STATE.md roadmap evolution notes, per-issue Sanity theme overrides are
RE-ENABLED as of Phase 19. Earlier planning artifacts describing a "fixed
Machine Editorial dark aesthetic" (Phase 12) or "fixed warm-paper light palette"
(Phase 14) are superseded. The `DESIGNAGENT_SUPPRESSED` flag controls whether
the DesignAgent runs; when suppressed, the site falls back to hardcoded
BRAND_DEFAULTS (oxblood #9A3324 / cream #FBFAF6).
