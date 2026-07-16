# Phase 46: Signal Editor & Candidate Verification - Research

**Researched:** 2026-07-15
**Domain:** LangGraph pipeline agent addition (Python/FastAPI backend) + Convex data model extension
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Graph wiring & node placement**
- D-01: Insert order is `calibrator → signal_editor → scout → verify_candidates → advocate`. Current `calibrator → scout` and `scout → advocate` edges are replaced with the chain above.
- D-02: `signal_editor` is an LLM `@agent_node`; `verify_candidates` is a plain non-LLM node wired directly with `add_edge`, exactly mirroring the existing `verify_research` precedent.
- D-03: Node count becomes 20. Update `tests/test_builder_wiring.py` node/edge expectations. Both new nodes sit on the sequential pre-fan-out spine — no change to the 7-writer fan-out or the `validate_sections` join.

**Story-lead contract (SGE-01)**
- D-04: Add a `StoryLead` TypedDict with exactly the SGE-01 fields: `premise`, `datedPeg`, `pegSourceUrl`, `readerEnergy`, `charitableAngle`, `category`, `confidence`, `brandRiskFlag: bool`, `brandRiskReason: Optional[str]` (populated only when flagged), plus `repetitionWarning: Optional[str]` (SGE-05) and `recommended: bool` (SGE-02 gate). A Pydantic model enforces the shape at the agent boundary.
- D-05: Add `story_leads: Optional[list[StoryLead]]` to `DispatchState`. JSON-serializable `list[dict]` (mirror the `featured_charity_keys` / `claims` precedents so it survives the Postgres checkpoint — SGE-04).
- D-06: Contract-first. Amend `docs/API_CONTRACTS.md` §7 (DispatchState + the `StoryLead` shape) **before** touching `state.py`. Also record the `signal` inspector artifact / `signal_editor` step (§ derived-state, already stubbed at API_CONTRACTS ~L4883).
- D-07: Emit leads to the deliberation layer so Phase 47 can render them (as the `signal` artifact type). Persist via a new `deliberationEvents` event type and/or a dedicated store — the exact Convex shape is contract-first and resolved in RESEARCH, reusing the `pitchLog:insert` / `deliberationEvents` emission precedent Scout already uses. "Nothing silent."

**Brand-risk routing (SGE-02)**
- D-08: `recommended` is never `true` when `brandRiskFlag` is `true`. Never suppressed and never auto-chosen — "routes the decision to the human" means no auto-select, given there is no selection UI in this phase.
- D-09: Brand-risk detection is the Signal Editor's own LLM judgment, driven by its prompt/rubric, and it must attach a concrete `brandRiskReason`. No downstream node overrides or re-derives the flag.

**verify_candidates design (SGE-03)**
- D-10: Deterministic, non-LLM, conservative — mirror `agents/verify.py`. `httpx` (~10s timeout, follow_redirects, desktop UA) + reuse Scout's `web_search` client for the press scan. No LLM call, no cost recording. Operates on `state['candidates']` (`list[CharityCandidate]`).
- D-11: Three checks per organization: domain live (httpx GET, DNS-resolves + 2xx/3xx after redirects); registration ID (presence + reachability, reusing `charityNavigatorUrl`/`guidestarUrl` — exact authoritative source is a RESEARCH question, prefer no new paid/government API); obscurity/press scan (bounded search via Scout's Tavily `web_search`, low hit-count ⇒ pass).
- D-12: Kill only on DEFINITIVE failure. Transient/ambiguous errors ⇒ candidate KEPT with that check marked `unverified` — the `verify_research` conservative posture.
- D-13: `VerificationRecord` per org — approximately `{domainLive, registrationId, registrationVerified, obscurity:{pressHits, verdict}, status, killed, killReason, checkedAt}`. Persisted to `DispatchState` (checkpointed, JSON-safe) **and** to Convex for Phase-47 rendering. Killed candidates recorded with `killReason` — never silently dropped. Contract-first.
- D-14: Kill mechanism = filter `state['candidates']` to survivors before Advocate. If **all** candidates are killed, do **not** crash — surface a degraded/needs-human state (mirror the existing `error`/editor-gate pause posture), so a run with zero survivors is recoverable rather than fatal.

**Editorial Memory read & repetition warning (SGE-05)**
- D-15: Reuse the Scout Convex read precedent (`charities:listForDedup`) as the avoid-list source, plus the Phase-39 recent-coverage data (last-8 featured charities' cause/geo). Prefer reusing an existing query over inventing a new one — RESEARCH question.
- D-16: Surface, never suppress. Attach an advisory `repetitionWarning` string to any lead that overlaps recent coverage or the avoid-list. The lead is still emitted. No lead is dropped or hidden on repetition grounds.
- D-17: Empty fallback when Convex is unavailable — mirror Scout's `_load_registry_keys` `[]`-on-failure behavior.

**Signal Editor agent implementation**
- D-18: Externalized prompt, like the other 9 agents. Add `prompts/signal_editor.md` + `prompts/signal_editor_user.md`; register the keys in `lib/config_loader.py` and `MAX_TOKENS_BY_AGENT`; seed via the existing prompt-seed pattern. Contract-first for the new keys.
- D-19: Web-search tool budget for dated pegs — same `web_search` + `max_tool_calls` budget pattern Scout uses (AGT-18). Pegs must be real and sourced, not invented.
- D-20: JSON-serializable everything for checkpoint resume (SGE-04). `story_leads` and the verification records are `list[dict]`. Add a pause/resume test spanning the new nodes.

### Claude's Discretion
- The Signal Editor's exact model tier: a capable editorial/reasoning model in the "Advocate/Editor class" — not Scout's Haiku — resolved through the existing `llm_config`/`MAX_TOKENS_BY_AGENT` system. **(See Common Pitfalls — this framing does not match the actual codebase tiering; resolved below.)**
- Exact prompt wording/rubric for lead generation, brand-risk judgment, and repetition-warning phrasing.
- The precise field names/indexes of the Convex store(s) for leads + verification records (within the contract-first amendment).
- The exact obscurity threshold (press-hit count) and how registration-ID reachability is scored.
- Whether leads are emitted per-lead as `deliberationEvents` or into a dedicated table.

### Deferred Ideas (OUT OF SCOPE)
- All Stage-1 UI (lead cards, organization options, "Needs your decision" adjudication, editable Brief) → Phase 47.
- "Start from my brief" second entry point → Phase 48.
- Live government/paid registration API → out of scope; use reachable registration URLs + existing `CharityCandidate` fields.
- Algorithmic "diversity score" for repetition → rejected.
- Auto-acting on the repetition warning (dropping/re-ranking leads) → out of scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SGE-01 | Signal Editor emits 3-5 dated story leads with premise/peg/source/energy/angle/category/confidence/brand-risk | `StoryLead` Pydantic+TypedDict shape, `agents/signal_editor.py` design (mirrors `agents/scout.py`), prompt externalization pattern, model-tier resolution — see Architecture Patterns, Code Examples |
| SGE-02 | Signal Editor never self-selects a brand-risk lead — routes to human | `recommended`/`brandRiskFlag` mutual-exclusion rule enforced in the agent body (Python, not just prompt trust) — see Architecture Patterns Pattern 2 |
| SGE-03 | `verify_candidates` deterministic check kills definitively-failed candidates | `agents/verify_candidates.py` design mirroring `agents/verify.py`, three-check design, `editor_gate_1` empty-candidates guard fix — see Common Pitfalls #1, Code Examples |
| SGE-04 | Graph runs 20 nodes; Postgres checkpointer resumes correctly across the new nodes | `graph/builder.py` wiring, JSON-safety precedent, `tests/test_builder_wiring.py` + `tests/test_pipeline_real_mode.py` + pause/resume test plan — see Validation Architecture |
| SGE-05 | Signal Editor reads Editorial Memory and surfaces (never suppresses) a repetition warning | Reuse of `charities:listRecentFeatured` + the exact `repetition_note()` algorithm already shipped in `api/registry.py` — see Architecture Patterns Pattern 3, Don't Hand-Roll |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement**: no direct file edits outside a GSD command (`/gsd:execute-phase` etc.) — process constraint on the executing agent, not on this research.
- **Locked stack**: LangGraph + FastAPI (pipeline), Convex (queryable event/state layer), Sanity (content-of-record), OpenRouter (model routing) — this phase stays entirely inside the existing pipeline stack; no new services.
- **AI cost containment matters**: "Per-run cost containment matters" is an explicit constraint. The Signal Editor is a NEW per-run LLM call (adds to the existing 9-agent cost). Model-tier choice (see below) is made with this in mind.
- **Voice**: Jesse's dry, precise, non-ironic voice is non-negotiable for published prose. Story leads are internal editorial artifacts (not published copy) but their prose (`premise`, `charitableAngle`) should still read as serious/gravity-appropriate per the brief's tone, since Phase 47 surfaces them verbatim to Andrew.
- **Convex working rule** (`convex/CLAUDE.md`): read `convex/_generated/ai/guidelines.md` before writing any `convex/*.ts` — applies to the planner/executor when they touch the two new Convex tables in this phase.
- Security/game-sandbox/theme-CSS constraints are not implicated by this phase (no game, no theme, no user-facing HTML surface).

## Summary

Phase 46 adds two nodes to an already-mature, well-instrumented 18-node LangGraph pipeline. The codebase has a strong, consistent set of precedents for every piece this phase needs: an LLM `@agent_node` with an externalized prompt and a Tavily tool-call budget (Scout — `agents/scout.py`), a deterministic non-LLM verification node with a conservative fetch posture (`agents/verify.py`), a dedicated append-style Convex table for structured per-run artifacts (`pitchLog`), and — critically — an **already-shipped, exact-match implementation of the SGE-05 repetition-warning algorithm** in `packages/pipeline/src/eisenbalm_pipeline/api/registry.py::repetition_note()` (Phase 40, `REPETITION_THRESHOLD=3`, "avoid X · avoid Y" format, geo-before-cause tie-break). This is not a coincidental resemblance — the Annotations doc's example phrase "avoid US-SE · avoid weather" is generated verbatim by this existing function's test fixture. Signal Editor's Editorial Memory read should call the same Convex query (`charities:listRecentFeatured`) and, ideally, a shared extracted helper, rather than reinventing repetition logic.

Two locked-decision framings need correction against the actual codebase, both flagged prominently below: (1) CONTEXT's "Advocate/Editor class" model-tier language doesn't map cleanly — `advocate` is actually pinned to the same Haiku tier as `scout` in `lib/llm_config.py`, not a distinct higher tier; the real three-tier system is Opus (voice-critical: calibrator/chronicler/editor_gate1/editor_final/qa/revision) / Sonnet (researcher + 5 section writers) / Haiku (scout/advocate/design), with `game` bumped to Opus as a one-off. (2) `docs/API_CONTRACTS.md` §37.3 states the `deliberationEvents.eventType` union is "FROZEN (no new literal may be added for it)" — which argues against D-07's literal suggestion of a new `signal-lead` deliberationEvents literal. Independent of that comment, a dedicated Convex table is also the architecturally better fit: `deliberationEvents` rows are immutable append-only event-stream rows, but Phase 47 (BRF-02) needs to eventually mark a lead Required/Removed — that needs a patchable, queryable row, which is exactly what `qaCorrections`/`pitchLog`/`charity_corrections` already do and `deliberationEvents` does not.

The single highest-risk item this phase touches that CONTEXT's file list does **not** mention: `agents/editor.py::editor_gate_1` currently `raise RuntimeError(...)` on an empty `state['candidates']`, reasoned in a code comment as "impossible" pre-Phase-46. Once `verify_candidates` can legitimately kill every candidate, that hard failure becomes reachable and directly contradicts D-14's "recoverable rather than fatal" requirement. This file must be added to the phase's touched-files list, and the fix must handle the case where there is no `top`/`sorted_candidates[0]` to fall back to.

**Primary recommendation:** Build `signal_editor` as an `@agent_node` at the Sonnet tier (mirrors `researcher`'s tool-use + structured-judgment shape, not Haiku's mechanical extraction, not full Opus voice-critical), persisting leads to a new dedicated `story_leads` Convex table (not `deliberationEvents`); build `verify_candidates` as a bare `wrap_agent_node`-only node exactly mirroring `verify.py`, persisting records to a new `verification_records` table keyed by the same `charity-{slugify(name)}` id Scout/Advocate/Sanity already use; fix `editor_gate_1`'s empty-candidates guard in the same phase; and update the two non-obvious existing files (`api/runs.py`'s `agent_keys` list, `tests/test_pipeline_real_mode.py`'s patch list) that the graph rewire silently breaks otherwise.

## Standard Stack

### Core

No new dependencies. Every library this phase needs is already a `packages/pipeline/pyproject.toml` dependency, used by the exact precedent code this phase mirrors:

| Library | Version (pinned) | Purpose | Why Standard (already used by) |
|---------|---------|---------|--------------|
| `httpx` | `0.28.1` | domain-live check (`verify_candidates`) | `agents/verify.py` (`verify_research`'s `_fetch_text`) |
| `python-slugify` | `8.0.4` | deterministic candidate/charity id for joining verification records | `agents/advocate.py::_charity_id_for`, `lib/sanity_client.py::write_charity` |
| `selectolax` | `0.4.9` | HTML-to-text if the registration-URL check needs page-content inspection (optional) | `agents/verify.py` |
| `langchain-openai` (via `lib/openrouter_client.py`) | pinned in pyproject | Signal Editor's LLM call | `acomplete()` — used by all 10 existing LLM agents |
| `langchain_tavily` (via `lib/search_client.py`) | pinned in pyproject | dated-peg search (Signal Editor) + press-scan (verify_candidates) | `agents/scout.py`, `agents/researcher.py` |
| `pydantic` | pinned in pyproject | `StoryLead`/`SignalEditorOutput` response-format schema | every agent's structured-output model |
| `langgraph` | pinned in pyproject | the two new nodes/edges | `graph/builder.py` |

**Installation:** none required — `cd packages/pipeline && uv sync` (existing lockfile already covers everything).

**Version verification:** not applicable — no new packages. Confirmed via `packages/pipeline/pyproject.toml` lines 14-20 read directly.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reusing `charities:listRecentFeatured` (Convex) + Sanity `groq_query` join for repetition | A brand-new dedicated "signal history" Convex query | Rejected — duplicates Phase 39/40's already-shipped, already-tested algorithm for no benefit; violates "prefer reuse" (D-15) |
| A new `story_leads` Convex table | Overloading `deliberationEvents` with a new `signal-lead` literal | Rejected — `deliberationEvents` rows are immutable event-log rows; Phase 47 (BRF-02) needs a patchable per-lead row; §37.3 explicitly calls the union "FROZEN" |
| `verify_candidates` calling a NEW EIN/registry API | Reusing `CharityCandidate.charityNavigatorUrl`/`guidestarUrl` reachability | CONTEXT explicitly prefers no new paid/government API; reachability-only is consistent with the existing conservative-fetch posture |

## Architecture Patterns

### Recommended Project Structure (delta only — no new top-level folders)

```
packages/pipeline/src/eisenbalm_pipeline/
├── agents/
│   ├── signal_editor.py          # NEW — @agent_node, mirrors scout.py's shape
│   └── verify_candidates.py      # NEW — bare node, mirrors verify.py exactly
├── prompts/
│   ├── signal_editor.md          # NEW
│   └── signal_editor_user.md     # NEW
├── lib/
│   ├── llm_config.py             # EDIT — add "signal_editor" to 3 dicts
│   ├── config_loader.py          # EDIT — add "signal_editor"/"signal_editor_user" to AGENT_KEY_TO_PROMPT_FILE (+ SYSTEM_PROMPT_KEYS if the planner wants config_loader to treat it as a "core 11"-equivalent — see Pitfall 5)
│   ├── agent_wrapper.py          # EDIT — add _INPUT_KEYS entries for both new node keys
│   └── registry_repetition.py    # NEW (recommended) — extracted shared helper from api/registry.py::repetition_note, reused by signal_editor.py
├── graph/
│   ├── builder.py                # EDIT — 2 add_node, rewire calibrator->scout and scout->advocate
│   └── state.py                  # EDIT — StoryLead/VerificationRecord TypedDicts, 2 new DispatchState fields
├── agents/editor.py               # EDIT — fix empty-candidates hard-fail (see Pitfall 1)
├── api/
│   ├── runs.py                   # EDIT — agent_keys list for agentRuns:queueForRun (see Pitfall 2)
│   └── registry.py               # EDIT (optional, recommended) — delegate repetition_note() to lib/registry_repetition.py
└── scripts/
    └── seed_phase46_signal_editor.py  # NEW — thin wrapper around seed_phase24_assets.py::seed_assets

convex/
├── schema.ts                     # EDIT — 2 new tables: story_leads, verification_records
├── storyLeads.ts                 # NEW — insert + byRunId query, mirrors pitchLog.ts
└── verificationRecords.ts        # NEW — insert + byRunId query, mirrors pitchLog.ts

docs/API_CONTRACTS.md             # EDIT — new §46 section (contract-first, BEFORE the above)
```

### Pattern 1: LLM `@agent_node` with externalized prompt + tool-call budget (Signal Editor)

**What:** The exact shape every prior LLM agent uses — `@agent_node(name=..., emit_event=None, max_tool_calls=N)` wrapping an `async def` that builds messages from `state["config"].agents[key].system_prompt` (Convex-hydrated, disk-fallback), calls `acomplete(agent_id=key, ...)` with a Pydantic `response_format`, and returns a state-update dict.

**When to use:** `signal_editor` (D-02).

**Example (adapted from `agents/scout.py`):**
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/agents/scout.py (existing, read verbatim)
from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.errors import AgentToolCallLimitExceeded

SIGNAL_QUERIES: tuple[str, ...] = (
    # curated for "current, dated, charitable-angle-adjacent" news, NOT
    # "obscure charity" (that's Scout's job) — tune in prompt-authoring
    "this week charitable response breaking news",
    "nonprofit relief effort recent event",
)

@agent_node(name="signal_editor", emit_event=None, max_tool_calls=8)
async def signal_editor(state: DispatchState) -> DispatchState:
    run_id = state["run_id"]
    # 1. Editorial Memory read (D-15/D-16/D-17) — see Pattern 3.
    avoid_note = await _read_repetition_note()  # {} on any Convex/Sanity failure
    # 2. Bounded Tavily search for dated pegs (D-19, mirrors scout.py's loop).
    tavily_results = []
    tool_calls = 0
    for q in SIGNAL_QUERIES:
        if tool_calls >= 8:
            raise AgentToolCallLimitExceeded(agent_id="signal_editor", attempts=tool_calls, limit=8)
        tool_calls += 1
        tavily_results.extend(await web_search(q, max_results=5))
    # 3. LLM parses results into 3-5 StoryLead objects + brand-risk judgment.
    messages = _build_messages(state=state, tavily_results=tavily_results, avoid_note=avoid_note)
    out, usage = await acomplete(agent_id="signal_editor", run_id=run_id, messages=messages, response_format=SignalEditorOutput)
    leads = [l.model_dump() for l in (out.leads if hasattr(out, "leads") else [])]
    # 4. D-08 enforced in Python, not just prompted (never trust the LLM alone):
    for lead in leads:
        if lead.get("brandRiskFlag"):
            lead["recommended"] = False
    # 5. Per-lead Convex emission — mirrors scout.py's per-candidate pitchLog:insert.
    for lead in leads:
        await convex_mutation_safe("story_leads:insert", {"runId": run_id, **lead})
    return {**state, "story_leads": leads, "model_versions": {**(state.get("model_versions") or {}), "signal_editor": usage["resolved_model"]}}
```

### Pattern 2: Deterministic non-LLM node (verify_candidates)

**What:** A bare `async def` with NO `@agent_node` decorator (no LLM call, no cost, no `deliberationEvents`) — only wrapped by `wrap_agent_node` in `builder.py` for lifecycle/progress tracking. Conservative posture: any fetch exception ⇒ that check is `unverified`, never a kill.

**When to use:** `verify_candidates` (D-02, D-10, D-12).

**Example (adapted from `agents/verify.py`, the exact template CONTEXT names):**
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/agents/verify.py (existing, read verbatim)
async def verify_candidates(state: DispatchState) -> dict:
    candidates = state.get("candidates") or []
    survivors: list[dict] = []
    records: list[dict] = []
    for c in candidates:
        domain_live = await _check_domain_live(c.get("website"))       # httpx GET, 10s timeout — None on any error = "unverified", not "fail"
        reg = await _check_registration(c)                              # reachability of charityNavigatorUrl/guidestarUrl
        press_hits = await _obscurity_press_scan(c.get("name"))         # bounded web_search call, len(results)
        killed, kill_reason = _apply_kill_rule(domain_live, reg, press_hits)  # D-12: only DEFINITIVE failure kills
        charity_id = f"charity-{slugify(c['name'])}"                    # SAME id Scout/Sanity/Advocate already use
        record = {"candidateId": charity_id, "candidateName": c["name"], "domainLive": domain_live, ..., "killed": killed, "killReason": kill_reason}
        records.append(record)
        await convex_mutation_safe("verification_records:insert", {"runId": state["run_id"], **record})
        if not killed:
            survivors.append(c)
    return {"candidates": survivors, "verification_records": records}
```

**Anti-pattern to avoid:** Do NOT hard-kill on `httpx.TimeoutError`/DNS blips (D-12) — this is the exact mistake `verify_research`'s docstring calls out ("False negatives are acceptable; false positives ... are not").

### Pattern 3: Reuse the shipped repetition-note algorithm (SGE-05)

**What:** `packages/pipeline/src/eisenbalm_pipeline/api/registry.py::repetition_note()` (lines 99-178) already implements exactly what SGE-05 needs: read `charities:listRecentFeatured` (last ≤8 featured, `lastFeaturedAt` desc), join to Sanity `focusArea`/`location` via one `groq_query`, count occurrences per dimension, threshold at `REPETITION_THRESHOLD = 3`, tie-break geo-before-cause, cap at 2, format as `"avoid {value} · avoid {value}"`. This is the literal source of the Annotations doc's example phrase "avoid US-SE · avoid weather" — confirmed by the test fixture in `tests/test_repetition_note.py` (3 rows share `focusArea="weather"` + `location="US-SE"`).

**When to use:** Signal Editor's Editorial Memory read (D-15, resolves the RESEARCH question in favor of `listRecentFeatured`, not `listForDedup`, as primary source — see rationale below).

**Recommendation:** Extract the counting logic (lines 140-176 of `api/registry.py`) into `lib/registry_repetition.py::compute_repetition_note(sanity_rows) -> dict` so both the existing `GET /registry/repetition-note` endpoint and the new `agents/signal_editor.py` call the identical, already-tested algorithm. Signal Editor calls it once per run (not per-lead), then injects the resulting `{"note": "...", "avoid": [...]}` into its LLM prompt context (mirroring how Scout interpolates `featured_keys` into its system prompt "for the LLM to use defensively" — `scout.py` line 176) and lets the LLM attach a `repetitionWarning` string to any lead whose `category`/`premise` textually overlaps an `avoid` entry. This keeps the computation deterministic/grounded while leaving the fuzzy "does this lead's premise overlap this cause/geo" judgment to the LLM — consistent with the project's established pattern of Python computing the hard facts and the LLM applying soft judgment over them.

**Example:**
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/api/registry.py:99-178 (existing, read verbatim)
async def _read_repetition_note() -> dict:
    try:
        rows = await convex_query_safe("charities:listRecentFeatured", {"workspace_id": "eisenbalm", "limit": 8}) or []
        ids = [r["sanityCharityId"] for r in rows if r.get("sanityCharityId")]
        sanity_rows = await groq_query(
            '*[_type=="charity" && _id in $ids]{_id, focusArea, location}', params={"ids": ids},
        ) if ids else []
        note = compute_repetition_note(sanity_rows)  # extracted helper
        log.info("signal_editor: read %d recent-coverage row(s) — %s", len(sanity_rows), note.get("note") or "no repetition")
        return note
    except Exception as exc:
        log.warning("signal_editor: Editorial Memory read failed (%r) — empty fallback", exc)  # D-17
        return {"note": None, "avoid": [], "sampleSize": 0}
```

**Why `listRecentFeatured` (not `listForDedup`) is the primary source:** `charities:listForDedup` returns exact charity name/domain dedup keys for featured+blocklisted orgs — useful for Scout's org-level dedup, but Signal Editor's leads are story angles/premises, not orgs, before Scout has even run. `listRecentFeatured` + the Sanity `focusArea`/`location` join is the cause/geo-level "recent coverage" signal the Annotations doc and SGE-05 actually describe. `listForDedup` remains available as a secondary, optional check only if a lead's premise happens to name a specific already-featured org — not required for SGE-05's acceptance criteria.

### Anti-Patterns to Avoid

- **Trusting the LLM alone for D-08 (`recommended` never true when `brandRiskFlag` true):** Enforce this invariant in Python after the LLM call (as shown in Pattern 1), not only in the prompt. Every other safety-relevant rule in this codebase (Scout's dedup filter, Advocate's positional-alignment fallback, Editor's deterministic top-score override) is enforced in Python with the LLM's output as advisory input — this is the established house style, not a one-off choice.
- **Adding a new `deliberationEvents.eventType` literal:** avoid per the §37.3 "FROZEN" comment and the architectural mismatch (see Standard Stack → Alternatives Considered).
- **Calling a new paid/government EIN API:** explicitly out of scope (CONTEXT Deferred + D-11).
- **Hard-killing on any check failure (including transient):** explicitly rejected in the Discussion Log as "kills good orgs on a blip."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Repetition/coverage-overlap detection | A new scoring/counting algorithm | `lib/registry_repetition.py::compute_repetition_note` (extracted from `api/registry.py::repetition_note`) | Already shipped, already tested (`tests/test_repetition_note.py`), already produces the exact phrase format the design doc specifies |
| Deterministic charity/candidate id | A new id scheme for verification records | `f"charity-{slugify(name)}"` (`lib/sanity_client.py::write_charity`, `agents/advocate.py::_charity_id_for`) | Already the canonical join key across Sanity `_id`, `agentVotes.charityId`, `pitchLog.charityId`, `deliberationEvents.charityId` |
| Prompt seeding for a new agent | A bespoke one-off seed script | `scripts/seed_phase24_assets.py::seed_assets(http, agent_keys, note=...)` | Already generic, idempotent, byte-verified against `load_prompt()` — just call it with `("signal_editor", "signal_editor_user")` |
| Convex per-run structured artifact storage | A blob dumped into `deliberationEvents.payload` JSON | A new dedicated table (`story_leads`, `verification_records`) mirroring `pitchLog`/`qaCorrections`/`charity_corrections` | Dedicated tables are queryable/indexable/patchable; `deliberationEvents` is an immutable append-only stream and its union is documented as frozen |
| Tool-call budget enforcement | A new limiter class | `lib.errors.AgentToolCallLimitExceeded` + the existing `@agent_node(max_tool_calls=N)` machinery | Already wired end-to-end: raises → `_wrapper.py` catches → emits `agent-tool-limit-exceeded` deliberationEvent → `pipelineRuns.status='failed'` |

**Key insight:** every primitive this phase needs — dedup keys, repetition scoring, prompt seeding, conservative fetch, tool budgets, per-run structured storage — was already built and hardened by an earlier phase for a near-identical problem. The research effort here is almost entirely about *finding and citing* the right precedent, not inventing new mechanism.

## Common Pitfalls

### Pitfall 1: `editor_gate_1` hard-fails on empty candidates — directly blocks D-14 (HIGH severity, NOT in CONTEXT's file list)
**What goes wrong:** `agents/editor.py` lines 257-263 currently do:
```python
if not candidates:
    raise RuntimeError(
        "editor_gate_1: state['candidates'] is empty — Scout produced "
        "no candidates. This should be impossible after Phase 4 PIP-04 ..."
    )
```
Once `verify_candidates` can kill every candidate (D-14 explicitly requires this be handled gracefully), this "impossible" case becomes reachable, and the run dies with an unrecoverable `RuntimeError` instead of the "degraded/needs-human state" D-14 requires.
**Why it happens:** `editor_gate_1` was written before `verify_candidates` existed; the guard's own comment says the empty case "should be impossible."
**How to avoid:** Modify the guard to mirror the existing low-confidence interrupt path instead of raising: write `pipelineRuns:updateStatus` `'awaiting-review'`, then `interrupt()` with a payload explaining verification killed every candidate, and accept a human-supplied `charityName` (and, since there is no `top`/`sorted_candidates[0]` to fall back to, construct a minimal synthetic `winning_charity` dict from just the human-supplied name when the list is genuinely empty — downstream Researcher/Chronicler will produce a degraded-but-non-crashing result, consistent with "recoverable rather than fatal," not "produces a great result"). **Add `agents/editor.py` to this phase's touched-files list.**
**Warning signs:** A test that forces `verify_candidates` to kill all 3-5 stub candidates and asserts the run reaches `'awaiting-review'` (not `'failed'`) is the concrete regression guard — write it as part of SGE-03/SGE-04 validation.

### Pitfall 2: `api/runs.py`'s hardcoded `agent_keys` list silently drifts from `builder.py` (MEDIUM severity, NOT in CONTEXT's file list)
**What goes wrong:** `api/runs.py` (~line 320) pre-registers `agent_runs` rows as `"queued"` via a **second, independent, hardcoded** node-name list:
```python
agent_keys = [
    "calibrator", "scout", "advocate", "editor_gate_1", "chronicler",
    "researcher", "verify_research", *SECTION_WRITERS,
    "validate_sections", "qa", "editor_final", "publisher",
]
```
This list is not derived from `builder.py` — it must be manually kept in sync. If `signal_editor`/`verify_candidates` aren't added here, the live-progress UI (Run Details rail) simply never shows them as "queued" before they run (they'd still emit `started`/`completed` once they actually execute, but the pre-registration step — which exists specifically so the UI can show all steps upfront — silently omits the two new ones).
**How to avoid:** Insert `"signal_editor"` before `"scout"` and `"verify_candidates"` after `"scout"` in this literal list, in the same commit as the `builder.py` rewire. **Add `api/runs.py` to this phase's touched-files list.**
**Warning signs:** A source-scan test asserting the list contains both new keys in the correct position (same style as `test_builder_wiring.py`'s chronicler tests).

### Pitfall 3: The existing full-graph e2e test breaks silently the moment the graph is rewired (HIGH severity, NOT in CONTEXT's file list)
**What goes wrong:** `tests/test_pipeline_real_mode.py::test_full_graph_runs_to_publisher` compiles the REAL `build_graph()` (only `acomplete`/`web_search`/Convex/Sanity are mocked) and runs it to completion. The moment `builder.py` is rewired to route through `signal_editor`/`verify_candidates`, this test will attempt to invoke the real (unmocked) `signal_editor.acomplete` and `verify_candidates`'s `httpx`/`web_search` calls — which either raises (no `OPENROUTER_API_KEY` in CI... actually a fake key IS set, so it will attempt a real network call and fail/hang) unless the new modules' external calls are added to `_build_patches()`.
**How to avoid:** In the same phase, add to `tests/test_pipeline_real_mode.py`: `"eisenbalm_pipeline.agents.signal_editor.acomplete"` to `_ACOMPLETE_PATCH_TARGETS`; a `_signal_leads()` mock-output builder (mirrors `_scout_candidates()`); patches for `signal_editor.web_search`, `signal_editor.convex_mutation_safe` (or whatever the module's Convex import binds to), and `verify_candidates`'s httpx/web_search calls. **Add `tests/test_pipeline_real_mode.py` to this phase's touched-files list** — CONTEXT's canonical_refs does not mention it, but it's the single test most likely to silently regress.

### Pitfall 4: `acomplete()` raises `KeyError` for any `agent_id` not in `MODEL_BY_AGENT`
**What goes wrong:** `lib/openrouter_client.py::_build_chat_model` does `if agent_id not in MODEL_BY_AGENT: raise KeyError(...)`. If `signal_editor.py` calls `acomplete(agent_id="signal_editor", ...)` before `"signal_editor"` is added to `lib/llm_config.MODEL_BY_AGENT`, every real-mode run fails immediately.
**Why it happens:** Easy to add the agent module and prompt files first and forget the `llm_config.py` registration step (it's a one-line dict entry, easy to miss).
**How to avoid:** Add `"signal_editor"` to `MODEL_BY_AGENT`, `SAMPLING_BY_AGENT`, and (recommended) `MAX_TOKENS_BY_AGENT` in `lib/llm_config.py` as the FIRST code change, before writing the agent body. Note: adding it to `MODEL_BY_AGENT` also automatically adds it to `config_loader.ALL_AGENT_KEYS` (`= tuple(MODEL_BY_AGENT) + _BONUS_VARIANT_KEYS`), which makes `load_run_config()` automatically hydrate it from Convex with disk fallback — no separate wiring needed there.
**Warning signs:** `KeyError: "agent_id='signal_editor' not in MODEL_BY_AGENT"` at first real-mode invocation.

### Pitfall 5: CONTEXT's "Advocate/Editor class" model-tier framing doesn't match the codebase
**What goes wrong:** CONTEXT's Claude's-Discretion note says the Signal Editor should be "a capable editorial/reasoning model in the Advocate/Editor class — not Scout's Haiku." Reading `lib/llm_config.py` directly: `MODEL_BY_AGENT["advocate"] = "anthropic/claude-haiku-4-5"` — **Advocate is the exact same Haiku tier as Scout**, not a distinct higher tier. Only `editor_gate1`/`editor_final` (and `calibrator`/`chronicler`/`qa`/`revision`) sit in the actual "higher" tier, which is the pinned voice-critical Opus tier, reserved for agents making final/irreversible/brand-facing decisions.
**Resolution:** Since Signal Editor's leads are PROPOSALS for human review (Phase 47), not final decisions, the closest functional and tier analog is **Researcher** (tool-use + web search + structured judgment feeding downstream consumers), which sits at Sonnet — not the mechanical Haiku tier (ruled out explicitly by CONTEXT) and not the full voice-critical Opus tier (reserved for final/irreversible calls). **Recommendation: `MODEL_BY_AGENT["signal_editor"] = "anthropic/claude-sonnet-4-6"`**, `SAMPLING_BY_AGENT["signal_editor"] = {"temperature": 0.4, "top_p": 1.0}` (between Researcher's fact-finding 0.3 and the section writers' creative 0.7, matching `chronicler`/`design`'s 0.4), `MAX_TOKENS_BY_AGENT["signal_editor"] = 16_000` (between Scout's 12_000 and Researcher's 20_000). This is a discretion call, not a locked decision — flag to the planner/Andrew if brand-risk stakes are judged to warrant the Opus tier instead; the plumbing change is identical either way.
**Warning signs:** None at build time (any string works) — this is a judgment call, not a bug, but worth flagging since CONTEXT's own reasoning doesn't hold up against the code it references.

### Pitfall 6: `docs/API_CONTRACTS.md` §7's `DispatchState` code block is already stale/drifted
**What goes wrong:** `graph/state.py`'s header comment claims it is "VERBATIM from docs/API_CONTRACTS.md §7 (lines 1185-1291)" — but §7 (now at ~line 1920 after later phases pushed the doc's line numbers down) does **not** list `featured_charity_keys`, `claims` (on `ResearchOutput`), `narrator_slug`, or the two `_force_*` test toggles that already exist in `state.py`. This drift predates Phase 46 (Phase 26/35/39 additions landed in state.py without a corresponding rewrite of the §7 code block, even though those phases DID add their own `## §NN` sections elsewhere in the doc describing the additions in prose).
**Why it matters for this phase:** The planner should not be surprised that a byte-for-byte diff between `state.py` and §7's code block doesn't reconcile — this is a pre-existing condition, not something this phase broke. Follow the SAME pattern those phases used: add the new `StoryLead`/`story_leads`/`VerificationRecord` fields as a new `## §46` section (prose + the new TypedDict/field snippets), rather than attempting to silently rewrite the entire §7 block to match current `state.py` (that's a larger, unrelated cleanup).
**How to avoid:** Don't scope-creep into "fixing" the drift; just don't be confused by it. Add §46 following the exact structural precedent of §39 (Registry Coverage-Memory Strip) or §42 (Fact Check Stage) — both are recent, both add fields+tables in a self-contained numbered section.

### Pitfall 7: CONTEXT names `USER_PROMPT_KEYS`; the actual code constant is `USER_TEMPLATE_KEYS`
**What goes wrong:** D-18 says register the new keys in "`SYSTEM_PROMPT_KEYS`, `USER_PROMPT_KEYS`" — but `lib/config_loader.py` has no `USER_PROMPT_KEYS` constant; the actual tuple is `USER_TEMPLATE_KEYS`. Minor naming slip in CONTEXT, easy to lose 10 minutes searching for a constant that doesn't exist.
**How to avoid:** Use `USER_TEMPLATE_KEYS` (confirmed at `lib/config_loader.py` line 145). Also note: `SYSTEM_PROMPT_KEYS` is explicitly commented "EXACTLY 11 entries... Frozen subset that the Phase 22 seed owns" — do NOT append `"signal_editor"` to that specific tuple (it would break the "exactly 11" invariant other code may rely on for iteration semantics); instead just add `"signal_editor"`/`"signal_editor_user"` to `AGENT_KEY_TO_PROMPT_FILE` (the superset map) — `load_run_config()` and `verify_prompt_seed.py` both iterate the superset already, not the frozen 11.

### Pitfall 8: Convex schema/function changes committed but not synced to the live dev deployment
**What goes wrong:** Documented team memory: Phase 39 shipped a production 500 because `charities:listRecentFeatured` was committed to git but never synced to the live Convex deployment (`dev:modest-magpie-797`). Committing `convex/schema.ts` + `convex/storyLeads.ts` + `convex/verificationRecords.ts` is **not** the same as deploying them.
**How to avoid:** After any `convex/*.ts` change, run `pnpm --filter @eisenbalm/convex dev:once` to push to the live dev deployment before any pipeline code that calls the new mutations/queries is exercised for real. There is now an automated guard: `pnpm check:convex-parity` (`convex/scripts/check-deploy-parity.mjs`) diffs the pipeline's `convex_query`/`convex_mutation` string-literal call sites against the live deployment's function-spec and exits non-zero on drift — run this as part of the phase's validation gate.

### Pitfall 9: `_INPUT_KEYS` whitelist silently defaults to `["run_id"]` for unregistered agent keys
**What goes wrong:** `lib/agent_wrapper.py::_INPUT_KEYS` has no entry for `"signal_editor"`/`"verify_candidates"` by default — `_snapshot_input`/`_snapshot_input_keys` fall back to `["run_id"]`, which won't crash anything but will produce an unhelpfully thin `agent_run_payloads.inputSnapshot`/`inputKeys` for the two new nodes (relevant to Phase 44's "Inputs tab," out of scope this phase but cheap to get right now).
**How to avoid:** Add `"signal_editor": ["style_brief"]` and `"verify_candidates": ["candidates"]` to `_INPUT_KEYS` alongside the other edits — low cost, keeps the precedent consistent.

## Code Examples

### Existing repetition-note algorithm (verbatim, to extract/reuse — SGE-05)
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/api/registry.py:99-178
REPETITION_THRESHOLD = 3
_REPETITION_DIMENSION_ORDER = {"geo": 0, "cause": 1}

# counters: dimension -> lowercased value -> [count, first-seen display casing]
counters: dict[str, dict[str, list]] = {"geo": {}, "cause": {}}
for s in sanity_rows:
    for dimension, field in (("cause", "focusArea"), ("geo", "location")):
        raw = s.get(field)
        if not raw:
            continue
        display_value = raw.strip()
        key = display_value.lower()
        entry = counters[dimension].get(key)
        if entry is None:
            counters[dimension][key] = [1, display_value]
        else:
            entry[0] += 1

over_represented = [
    (dimension, display_value, count)
    for dimension, values in counters.items()
    for count, display_value in values.values()
    if count >= REPETITION_THRESHOLD
]
over_represented.sort(key=lambda item: (-item[2], _REPETITION_DIMENSION_ORDER[item[0]], item[1]))
top = over_represented[:2]
avoid = [{"dimension": d, "value": v, "count": c} for (d, v, c) in top]
note = " · ".join(f"avoid {item['value']}" for item in avoid) or None
```

### Existing deterministic charity id (verbatim — for VerificationRecord join key)
```python
# Source: packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py:85-95
def _charity_id_for(name: str) -> str:
    return f"charity-{slugify(name)}"
```

### Existing generic idempotent prompt-seed helper (verbatim — reuse for signal_editor prompts)
```python
# Source: packages/pipeline/scripts/seed_phase24_assets.py:101-133
async def seed_assets(http, agent_keys, *, note="..."):
    for agent_key in agent_keys:
        prompt_file = AGENT_KEY_TO_PROMPT_FILE[agent_key]
        content = load_prompt(prompt_file)
        _byte_verify(agent_key, content)
        await convex_mutation(http, "promptVersions:upsertActive",
            {"workspace_id": WORKSPACE_ID, "agentKey": agent_key, "content": content, "note": note})

# Phase 46's new seed script needs only:
#   await seed_assets(http, ("signal_editor", "signal_editor_user"),
#                      note="Phase 46 v1 seed — Signal Editor")
```

### Existing pitchLog insert/read Convex module (template for story_leads.ts / verificationRecords.ts)
```typescript
// Source: convex/pitchLog.ts (existing, read verbatim)
export const insert = mutation({
  args: { runId: v.string(), /* ...fields... */, pipelineSecret: v.optional(v.string()) },
  handler: async (ctx, { pipelineSecret, ...args }) => {
    requirePipelineSecret(pipelineSecret)
    return await ctx.db.insert('pitchLog', { ...args, timestamp: Date.now() })
  },
})
export const byRunId = query({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) =>
    await ctx.db.query('pitchLog').withIndex('by_runId', q => q.eq('runId', runId)).order('asc').collect(),
})
```

## State of the Art

Not applicable in the "deprecated tech" sense — this is a pure internal-precedent-reuse phase, not a domain with shifting external best practices. The one relevant "old → current" shift is internal to this codebase's own history:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| GROQ-based `_load_featured_keys()` for Scout dedup | Convex `charities:listForDedup` registry read | Phase 26 (REG-02) | Signal Editor should use the CURRENT Convex-registry pattern, not the retired GROQ-only one, for anything registry-adjacent |
| Ad-hoc per-phase repetition logic (none existed before Phase 39/40) | `charities:listRecentFeatured` + `repetition_note()`'s counting algorithm | Phase 39 (MEM-01) / Phase 40 (§40.4) | Reuse directly (Pattern 3) — do not reinvent |

**No deprecated/outdated items block this phase.**

## Open Questions

1. **Exact obscurity press-hit threshold for `verify_candidates`**
   - What we know: Scout's own system prompt already frames "obscure" qualitatively ("obscure charity", "overlooked nonprofit"); no numeric threshold exists anywhere in the codebase today.
   - What's unclear: What Tavily hit-count for a bounded name search (e.g. `max_results=5` or `10`) reliably distinguishes "genuinely obscure" from "not obscure enough" in practice.
   - Recommendation: Start conservative — e.g., `pressHits <= 2` (out of a `max_results=5` bounded search) ⇒ pass; `pressHits >= 4` ⇒ fail "not obscure enough"; the 3-hit middle ground ⇒ `unverified` (D-12's conservative posture, not a hard kill). Tune against a handful of real Scout output runs during implementation; this is explicitly named a RESEARCH/tuning item in CONTEXT, not a locked number.

2. **Whether to seed a Convex `agents` row (dashboard-editable model/temp override) for `signal_editor`**
   - What we know: `load_run_config()` gracefully falls back to `MODEL_BY_AGENT`/`SAMPLING_BY_AGENT`/`MAX_TOKENS_BY_AGENT` defaults when no `agents` table row exists for a key (confirmed by reading the `row = agents_by_key.get(agent_key)` / `if row else None` fallback chain).
   - What's unclear: Whether Andrew needs dashboard-level override capability for Signal Editor's model/temperature from day one, or whether the code-level default is sufficient until a later phase touches Prompt Lab/Agent Instructions for this agent.
   - Recommendation: Not required for SGE-01..05 acceptance. Skip seeding an `agents` row this phase (the fallback path is fully functional); note it as a natural follow-up whenever Phase 44/45-style dashboard editing is extended to this agent.

3. **Prompt Lab `VariableRegistry.ts` registration for `signal_editor`'s `{token}` placeholders**
   - What we know: `apps/dispatch-control`'s Prompt Lab has a save-gate (PRM-02) that needs each prompt's declared tokens registered in `VariableRegistry.ts`, or editing that prompt via the dashboard UI is blocked/incorrect.
   - What's unclear: Whether this matters for Phase 46's acceptance (it doesn't — this phase explicitly has "no console dependency").
   - Recommendation: Out of scope for this phase; leave as a known gap for whoever next touches Prompt Lab. The prompt still works correctly via the disk-fallback/Convex-content path regardless.

## Environment Availability

This phase introduces **zero new external dependencies** — it exclusively reuses services already required by the other 18 pipeline nodes (OpenRouter, Tavily, Convex, Sanity, the Railway Postgres checkpointer). No new probing is needed beyond what the existing pipeline already requires to boot.

| Dependency | Required By | Available (existing infra) | Fallback |
|------------|------------|-----------|----------|
| `OPENROUTER_API_KEY` | `signal_editor`'s `acomplete()` call | ✓ — already required by 10 existing LLM agents | `EISENBALM_STUB_MODE=true` (existing stub-mode path, unaffected by this phase) |
| `TAVILY_API_KEY` | `signal_editor`'s dated-peg search + `verify_candidates`'s press scan | ✓ — already required by Scout + Researcher | stub-mode fixtures (existing) |
| `CONVEX_DEPLOY_KEY` / `NEXT_PUBLIC_CONVEX_URL` | `story_leads`/`verification_records` inserts, `charities:listRecentFeatured` read | ✓ — already required pipeline-wide | `convex_mutation_safe`/`convex_query_safe` fail-open (existing) |
| `SANITY_API_TOKEN` | `groq_query` for the focusArea/location join | ✓ — already required by Calibrator/Scout/Publisher | none needed — the join is best-effort (D-17 empty fallback) |
| `SUPABASE_POSTGRES_URL` (Railway Postgres) | checkpoint persistence across the 2 new nodes | ✓ — already required for ANY pipeline run | none — hard requirement pipeline-wide already |

**Missing dependencies with no fallback:** none — all reused, none newly introduced.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest 8.3 + pytest-asyncio 0.24 (`asyncio_mode = "auto"`); some endpoint tests use the `anyio` marker via `conftest.py`'s `anyio_backend` fixture |
| Config file | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` |
| Quick run command | `cd packages/pipeline && uv run pytest tests/agents/test_signal_editor.py tests/agents/test_verify_candidates.py tests/test_builder_wiring.py -x -q` |
| Full suite command | `cd packages/pipeline && uv run pytest -v` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SGE-01 | Signal Editor emits 3-5 leads with all required fields | unit | `uv run pytest tests/agents/test_signal_editor.py -k test_emits_leads_with_required_fields -x` | ❌ Wave 0 |
| SGE-01 | Every `{token}` in `prompts/signal_editor*.md` round-trips through `load_prompt` | unit | `uv run pytest tests/test_package_data_prompts.py -x` (extend existing) | ✓ (extend) |
| SGE-02 | `recommended` is never `true` on a `brandRiskFlag=true` lead, even if the LLM output claims otherwise | unit | `uv run pytest tests/agents/test_signal_editor.py -k test_brand_risk_never_recommended -x` | ❌ Wave 0 |
| SGE-03 | `verify_candidates` kills a candidate only on a DEFINITIVE failure (domain 404, no registration, high press-hit count); a `httpx.TimeoutError` keeps the candidate with `status='unverified'` | unit | `uv run pytest tests/agents/test_verify_candidates.py -k "test_kills_definitive_failure or test_keeps_on_transient_error" -x` | ❌ Wave 0 |
| SGE-03 | `VerificationRecord` for a killed candidate carries a non-empty `killReason` (never silently dropped) | unit | `uv run pytest tests/agents/test_verify_candidates.py -k test_killed_record_has_reason -x` | ❌ Wave 0 |
| SGE-03 / D-14 | All candidates killed ⇒ run reaches `'awaiting-review'`, NOT `'failed'` | integration | `uv run pytest tests/test_pipeline_real_mode.py -k test_all_candidates_killed_recovers -x` | ❌ Wave 0 (also requires the Pitfall 1 `editor.py` fix) |
| SGE-04 | Compiled graph has exactly 20 named nodes, in the D-01 order; old `calibrator->scout`/`scout->advocate` edges are absent | unit (source-scan + live introspection) | `uv run pytest tests/test_builder_wiring.py -x` | ✓ (extend with new test functions) |
| SGE-04 | Full graph (`MemorySaver`, all externals mocked) runs `signal_editor → scout → verify_candidates → advocate → ...` to `publisher` without exception | integration | `uv run pytest tests/test_pipeline_real_mode.py -k test_full_graph_runs_to_publisher -x` | ✓ (extend patches — Pitfall 3) |
| SGE-04 | AsyncPostgresSaver checkpoint/resume cycle spanning `signal_editor`→`scout`→`verify_candidates` (state populated pre-interrupt survives post-resume) | integration (live Postgres, `SUPABASE_POSTGRES_URL`-gated, matches `test_editor_gate_1_resume.py`'s skip pattern) | `uv run pytest tests/test_editor_gate_1_resume.py -x` (extend assertions: `final["story_leads"]` and verification-record presence, post-resume) | ✓ (extend existing test's assertions — no new file strictly required, since the existing interrupt happens at `editor_gate_1`, AFTER all 3 new-node state has already been written pre-interrupt) |
| SGE-05 | Signal Editor attaches a `repetitionWarning` to a lead when `charities:listRecentFeatured` + Sanity join shows an over-represented cause/geo (reuses the exact `_FEATURED_ROWS_OVER_REPRESENTED` fixture shape from `test_repetition_note.py`) | unit | `uv run pytest tests/agents/test_signal_editor.py -k test_repetition_warning_attached -x` | ❌ Wave 0 |
| SGE-05 | Convex unreachable ⇒ leads still emitted, `repetitionWarning` omitted (never crashes) | unit | `uv run pytest tests/agents/test_signal_editor.py -k test_editorial_memory_read_empty_fallback -x` | ❌ Wave 0 |
| SGE-05 | The read is logged with a count (verifiable-in-logs, mirrors MEM-03/D-10's `caplog` pattern in `test_researcher`) | unit | `uv run pytest tests/agents/test_signal_editor.py -k test_repetition_read_logged -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the relevant quick-run subset above (agent unit tests for the file just touched).
- **Per wave merge:** `cd packages/pipeline && uv run pytest tests/agents/test_signal_editor.py tests/agents/test_verify_candidates.py tests/test_builder_wiring.py tests/test_pipeline_real_mode.py -v`
- **Phase gate:** `cd packages/pipeline && uv run pytest -v` (full suite green) + `pnpm check:convex-parity` (guards Pitfall 8) + `pnpm --filter @eisenbalm/convex dev:once` (live-sync the 2 new Convex tables/functions before any live-mode smoke) before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `tests/agents/test_signal_editor.py` — covers SGE-01, SGE-02, SGE-05 (new file)
- [ ] `tests/agents/test_verify_candidates.py` — covers SGE-03 (new file)
- [ ] `tests/agents/test_stub_fixtures.py` — extend the fixture-function docstring/list to include `signal_editor`/`verify_candidates` if the stub-mode smoke test enumerates agent names (confirm during Wave 0; the current docstring lists "calibrator, scout, advocate, editor_gate_1, researcher, ..." — verify whether this is enumerated in code or just prose)
- [ ] `lib/registry_repetition.py` — the extracted shared helper Pattern 3 depends on; write it (and its own small unit test) before `signal_editor.py`'s Editorial Memory read can be implemented against it
- [ ] Convex `story_leads` / `verification_records` tables + `storyLeads.ts` / `verificationRecords.ts` functions — no test can exercise the real Convex path until these are deployed to `dev:modest-magpie-797` (mock-based unit tests can proceed in parallel using `MagicMock()`/monkeypatched `convex_mutation_safe`, matching the existing `test_pipeline_real_mode.py` pattern)
- [ ] Framework install: none — pytest/pytest-asyncio already configured

## Sources

### Primary (HIGH confidence — direct code reads)
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — full file read; confirms 18-node baseline, exact insertion points
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — full file read; confirms JSON-safety precedents (`featured_charity_keys`, `claims`)
- `packages/pipeline/src/eisenbalm_pipeline/agents/verify.py` — full file read; the `verify_candidates` template
- `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` — full file read; the `signal_editor` template (dedup, tool budget, prompt build, per-item Convex write)
- `packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py` — full file read; `_charity_id_for`, candidate-scoring shape verify_candidates must not break
- `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` — full file read; the Pitfall 1 hard-fail finding
- `packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py` + `lib/agent_wrapper.py` — full file reads; the two-layer wrapper architecture
- `packages/pipeline/src/eisenbalm_pipeline/lib/config_loader.py` + `lib/llm_config.py` — full file reads; Pitfall 4/5/7 findings
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` — full file read; `_PIPELINE_SECRET_GUARDED_PATHS` pattern for the 2 new mutations
- `packages/pipeline/src/eisenbalm_pipeline/lib/search_client.py`, `lib/errors.py`, `lib/prompts.py`, `lib/sanity_client.py` (partial) — confirm tool signatures, deterministic id scheme, prompt marker convention
- `packages/pipeline/src/eisenbalm_pipeline/api/registry.py` — full file read; the SGE-05 repetition-note precedent (Pattern 3's core finding)
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` (relevant sections) — the Pitfall 2 finding
- `packages/pipeline/scripts/seed_phase22.py`, `scripts/seed_phase24_assets.py`, `scripts/verify_prompt_seed.py` — full/partial reads; the prompt-seeding reuse pattern
- `packages/pipeline/tests/test_builder_wiring.py`, `tests/test_checkpointer.py`, `tests/test_editor_gate_1_resume.py`, `tests/test_pipeline_real_mode.py`, `tests/test_repetition_note.py`, `tests/test_scout_registry.py` — full/partial reads; the Validation Architecture test map
- `convex/schema.ts` — full file read; all existing table conventions, naming-casing history
- `convex/pitchLog.ts`, `convex/charities.ts`, `convex/charityCorrections.ts` — full/partial reads; the dedicated-table pattern (insert + byRunId query)
- `docs/API_CONTRACTS.md` (§7, §26, §33.7, §37, §37.3, §37.4, §39, §44.3) — direct reads; the "FROZEN deliberationEvents union" finding, the "hookClaim/hookVerified never actually shipped" finding, the §7 drift finding, the `signal`→`signal_editor` agentKey resolution confirmation
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` §7/§8 — direct read; the 11-step naming, `signal`/`org` artifact types
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — direct read; the "avoid US-SE · avoid weather" example phrase, confirmed to be the literal test-fixture output of the existing `repetition_note()` function
- `packages/pipeline/pyproject.toml` — direct read; confirms zero new dependencies needed
- `.planning/phases/39-registry-coverage-memory-strip/39-CONTEXT.md`, `.planning/STATE.md` (Phase 39/40 history notes) — direct reads; confirms the `scoutNotes`="signal" chip resolution and the `check:convex-parity` guard's origin story (Pitfall 8)

### Secondary (MEDIUM confidence)
- None — this research relied exclusively on direct codebase reads (Primary) plus the CONTEXT.md/ROADMAP.md/REQUIREMENTS.md planning documents already provided as required reading; no WebSearch/Context7 lookups were needed since this phase introduces zero new external technology.

### Tertiary (LOW confidence)
- The exact obscurity press-hit numeric threshold (Open Question 1) — no codebase precedent exists for this specific number; flagged as a tuning item, not stated as fact.
- The exact recommended Signal Editor sampling temperature (0.4) — a reasoned interpolation between two existing precedents (Researcher 0.3, section writers 0.7, matching chronicler/design's existing 0.4), not itself a value drawn from any single authoritative source.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every library confirmed present in `pyproject.toml`
- Architecture: HIGH — every pattern is a direct, verbatim-cited read of already-shipped, already-tested code in this exact codebase
- Pitfalls: HIGH for Pitfalls 1-4, 6-9 (each backed by a direct code read of the exact failure condition); MEDIUM for Pitfall 5 (a judgment call about model tier, not a bug)

**Research date:** 2026-07-15
**Valid until:** 30 days (stable internal codebase; no fast-moving external dependency risk since this phase adds none)
