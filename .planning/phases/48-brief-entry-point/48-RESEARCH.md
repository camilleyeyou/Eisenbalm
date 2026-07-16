# Phase 48: Brief Entry Point - Research

**Researched:** 2026-07-16
**Domain:** LangGraph conditional graph entry, FastAPI trigger endpoints, Convex schema extension, Next.js console intake — all within an existing, fully-built pipeline (no new external libraries)
**Confidence:** HIGH (every finding below is grounded in reading the actual current code, not framework docs — this phase is 100% internal wiring)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: One graph, a conditional entry at `START`.** Add `builder.add_conditional_edges(START, route_by_entry_mode, {...})` keyed on a new `DispatchState['entry_mode']` flag (`'discovery'` | `'brief'`). Discovery runs keep the existing `START → calibrator → signal_editor → scout → verify_candidates → advocate → editor_gate_1 → chronicler → researcher → …` chain byte-unchanged. Brief runs route `START → calibrator → verify_candidates → researcher → …`. **One compiled graph, one checkpointer, downstream (researcher onward) reused verbatim** — no second graph, no per-node short-circuit scattering. Exact edge/router placement is a RESEARCH item; the *mechanism* (a `START` conditional edge on `entry_mode`) is locked.
- **D-02: Calibrator still runs in brief mode.** It sets `style_brief` (voice, `bonusType`, `visualDirection`, `previousBonusTypes`) and resolves the narrator — the section writers require these. Do NOT skip it. Only Signal Editor, Scout, Advocate, and Gate 1 are skipped (ENT-02's literal list).
- **D-03: `verify_candidates` runs on the brief path.** It must sit on the brief branch (after calibrator, before researcher) so the human org gets a persisted `VerificationRecord` (ENT-04). It reads `state['candidates']` (seeded from the human org, D-05) and writes `verificationRecords` exactly as today — no logic change.
- **D-04: The human brief IS the source of truth; seed it into `initial_state` at run start.** Gate 1 — which in discovery mode resolves `winning_charity` and deterministically assembles + persists the Brief (`editor.py::_assemble_brief` → `briefs:insert`, §47.3) — is skipped. In brief mode, `_start_run` (brief-aware) seeds `entry_mode='brief'`, `winning_charity` (from the human org), `candidates=[human org]`, and `brief` (the 6-field Brief, D-06) directly into `initial_state`. The Researcher reads `state['winning_charity']` unchanged; the writers read `state['brief']` unchanged.
- **D-05: The `candidates` list is seeded with the single human org** so `verify_candidates` has its input (it iterates `state['candidates']`). `_charity_id_for(name)` (the shared `charity-{slugify(name)}` join key) binds the org to its verification record and any registry prior-coverage.
- **D-06: The `briefs` Convex row is written at intake — deterministic, no LLM, mirroring `_assemble_brief` but sourced from the human input.** Because the operator hand-authors the Brief, this is NOT an `_assemble_brief` re-projection of leads/records; it is a direct map of the entry form onto the 6 Brief fields (D-08). Where the `briefs:insert` write happens — console-side before triggering, in the brief-trigger endpoint, or a tiny deterministic pre-graph seed — is **Claude's discretion / RESEARCH**; the constraint is that a `briefs` row exists for the run before the writers draft (mirroring the §47.3 write, sourced from the human).
- **D-07: Collect exactly ENT-02's set — premise, peg, organization, optional source material — nothing more.** Do NOT force the operator to author all six Brief fields up front; that contradicts ENT-02 and inflates burden.
- **D-08: Map the form onto the 6-field Brief; leave the rest blank for BRF-06 strengthen.** `premise → premise`, `peg → currentPeg`, `organization → winning_charity + candidate`. `centralClaim`, `readerEffect`, `knownRisks`, `voiceIntention` start **blank** (or `voiceIntention` defaulted from `style_brief.visualDirection`, D-02) and the operator fills/sharpens them in Stage 1 using the **shipped BRF-06 field-strengthen** (`api/brief.py` preview/apply) and BRF-05 direct edit — no new editing surface. This reuses Phase 47's editable Brief exactly.
- **D-09: `organization` capture is a name (+ optional website/registration id).** `verify_candidates` needs a website URL to run the domain-live check and a registration id for the registration-ID check; the form should collect at least the org name and ideally its website so the verification record is meaningful (a name-only org still verifies, just with more `unverified` checks — acceptable per `verify_candidates`' conservative posture).
- **D-10: A single optional free-text field (URLs + pasted notes) threaded to the Researcher as seed context.** Stored on the run/brief; made available to the Researcher as prioritized seed sources (the Researcher already does web search — source material seeds/anchors it). **No file/asset upload this phase.** "Optional" is literal: a brief run works with the field empty. Exact threading (a new `DispatchState` field vs. an existing research-seed slot) is a RESEARCH item.
- **D-11: Verification is ADVISORY on a brief run — it produces the record (ENT-04) but never kills the org or halts the run.** In discovery mode, `verify_candidates` can definitively kill a candidate and Advocate/Gate 1 re-slate. In brief mode there is exactly one org, no slate, and the human deliberately chose it. So: run the checks, persist the `VerificationRecord`, surface its concerns prominently in Stage 1's org card (never truncated), but a definitive-fail check does **not** remove the org or pause the run. The operator sees the concern and proceeds knowingly (or uses the existing **Hold issue** control if the record looks disqualifying).
- **D-12: Skip the chronicler; the deliberation artifact is legitimately absent for brief runs.** A brief run has no Scout findings, no Advocate scores, no Gate-1 debate to dramatize. The brief branch does not route through `chronicler`; `deliberation_conversation` / `deliberation_transcript` stay `None` (both are `Optional`), and the reader-facing `DeliberationSlot` renders its existing absent state. **This is the one honest divergence from a discovery run** — outside ENT-03's enumerated "same downstream artifacts" set and its "indistinguishable at Stages 2-5" scope.
- **D-13: Fill the reserved second grid cell in `CreatePanel.tsx` with the "Start from my brief" card.** D-28 (Phase 40) already left the cell absent, not a dead button, specifically for this phase. The card reveals the brief-intake form (inline expand or modal — Claude's discretion); on submit it: `issues:ensureByNumber` → the new brief-trigger client call (D-14) → `router.push(issueHref(n))` to the Workspace at Stage 1.
- **D-14: A new `triggerBriefRun`-style client** in `lib/pipelineControlClient.ts` (sibling of `triggerRun`) posts the human brief payload with the Clerk token. No change to the existing `triggerRun` / "Find a story with agents" path.
- **D-15: A new dedicated Clerk-guarded endpoint (e.g. `POST /pipeline/run/brief` or `POST /issues/brief`) reusing an `entry_mode`-extended `_start_run`.** It validates the human brief, seeds `entry_mode='brief'` + winner/candidates/brief (D-04), ensures the `briefs` row (D-06), and calls `_start_run` so all shared run-launch discipline is preserved: the one-at-a-time gate (409 if a run is running), the RUN-06 budget start-gate, the config load+snapshot, and the `agentRuns:queueForRun` pre-population. Do NOT overload `RunWeeklyBody` / `/pipeline/run`. Contract-first: add a §48 to `docs/API_CONTRACTS.md` for the endpoint + `entry_mode` field + the brief-run seed shape.
- **D-16: The `agentRuns:queueForRun` list for a brief run is the SHORTER node set** — `calibrator, verify_candidates, researcher, verify_research, *SECTION_WRITERS, validate_sections, qa, editor_final, publisher` (no `signal_editor`, `scout`, `advocate`, `editor_gate_1`, `chronicler`). `_start_run` currently hard-codes the full 20-step list; brief mode passes the reduced list.

### Claude's Discretion

- Inline-expand vs. modal for the brief-intake form; exact field layout within the 1c token system.
- Where the `briefs:insert` write happens for a brief run (console pre-trigger, the trigger endpoint, or a tiny deterministic pre-graph seed) — as long as a row exists before the writers draft (D-06).
- Exact `route_by_entry_mode` router signature + edge placement (D-01).
- Exact threading of source material into the Researcher (new `DispatchState` field vs. existing research-seed slot) (D-10).
- Whether `voiceIntention` defaults from `style_brief.visualDirection` or starts blank (D-08).
- Whether the endpoint is named `/pipeline/run/brief` or `/issues/brief` (D-15) — match whichever sibling convention the planner finds cleanest.

### Deferred Ideas (OUT OF SCOPE)

- **A deliberation-equivalent for brief runs** — a chronicler variant that dramatizes the editor's decision to run this particular brief. Explicitly NOT built (risks fabricating a "deliberation" that never happened). → future/backlog.
- **File/asset upload for source material** — free-text only this phase. → backlog.
- **Roles/permissions gating of who may start a brief run** → **Phase 49**.
- **Nomenclature / Workbench rename** ripple → **Phase 50**.
- **LLM expansion of the minimal brief into a full 6-field Brief at intake** — NOT chosen; operator fills remaining fields with the shipped BRF-06 strengthen on demand.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-------------------|
| ENT-01 | Create issue offers two equal paths ("Find a story with agents" / "Start from my brief"), both landing at Stage 1 | §"Frontend intake" below — exact `CreatePanel.tsx` second-cell composition, `triggerBriefRun` client, `issueHref` reuse, verified against the actual reserved-cell markup |
| ENT-02 | Operator submits premise, peg, organization, optional source material; run skips Signal Editor/Scout/Advocate/Gate 1, enters at Researcher | §"Graph entry & branching" + §"Brief-entry endpoint" — exact two-conditional-edge topology, `_start_run` extension, request body shape, all verified against `graph/builder.py` / `api/runs.py` / `api/control.py` |
| ENT-03 | Brief-started run produces same downstream artifacts (research, sections, QA, claims, sign-offs) as discovery run, indistinguishable at Stages 2-5 | §"Downstream reuse is already verbatim-safe" — traced every downstream consumer (researcher, publisher's `winning_charity_sanity_id`, Sanity write helpers) to confirm none of them special-case how `winning_charity`/`brief` were populated |
| ENT-04 | Human-supplied organization still run through `verify_candidates`, verification record never absent | §"`verify_candidates` on a human org" — traced the exact code path proving the record is persisted unconditionally and `winning_charity` is never touched by this node, so "advisory" is already the node's natural behavior |
</phase_requirements>

## Summary

This phase requires **zero new libraries and zero new architectural subsystems** — it is a precise wiring exercise across four already-built layers (LangGraph graph topology, the `_start_run` launcher, Convex schema, and the console's Create panel). Every consuming node downstream of `researcher` already reads only `winning_charity` / `brief` / `research`, never `candidates` or the presence of a deliberation — which means the "reuse verbatim" requirement (ENT-03) is largely already satisfied by the existing code's data-flow shape, not something Phase 48 needs to build.

Two findings materially de-risk the plan. First, **`verify_candidates` needs ZERO functional code changes** to satisfy D-11's "advisory, never blocks" requirement: it already returns a bare partial dict (`{"candidates": survivors, "verification_records": records}`) that never touches `winning_charity`, and it already persists each `VerificationRecord` to Convex unconditionally inside the per-candidate loop, before the kill decision is even applied. Since the brief branch's next node (`researcher`) reads exclusively `state['winning_charity']` and never reads `state['candidates']`, an emptied/killed single-candidate list has zero effect on the brief run's continuation. Second, **the literal D-01 wording ("conditional edge at `START`") does not match the chain description in the same decision** — both discovery and brief chains begin `START → calibrator`, so the actual branch point must be placed *after* `calibrator`, not at `START`. This is the one place research materially corrects the locked decision's mechanism while honoring its intent (a conditional edge keyed on `entry_mode`, one compiled graph).

The one real gap the CONTEXT under-scoped is Stage 1 rendering (research item 6): Phase 47's `StoryBriefScreen` and `OrgOptionSlate` are wired entirely off `story_leads` (Signal Editor) and `pitchLog` (Scout) — both of which stay permanently empty for a brief-started run. Without a small brief-mode variant, a brief-started issue's Stage 1 would show "No leads yet" and "No organization options yet," silently hiding the human org and its verification record even though both exist in Convex. This is real, scoped work the planner must include, not an existing capability to merely wire up.

**Primary recommendation:** Two `add_conditional_edges` calls (one after `calibrator`, one after `verify_candidates`) sharing one router function; extend `_start_run` with `entry_mode` + optional `winning_charity`/`brief`/`source_material`/`agent_keys_override` params (deriving `candidates=[winning_charity]` internally); do the `briefs:insert` write inside `_start_run` itself (not the endpoint, not the console) right after `runs:create`; add a small `entryMode`-aware Stage-1 variant reading a new `runs.entryMode` Convex field.

## Standard Stack

### Core

No new libraries. This phase extends existing, already-installed dependencies only.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| langgraph | 1.1.10 (pinned, `pyproject.toml`) | `add_conditional_edges(source, router_fn, path_map)` — the exact mechanism D-01 locks | Already the graph engine for all 20 existing nodes; conditional entry via a router fn is the documented pattern for exactly this "different chain per run" use case |
| httpx | already a dependency (`verify_candidates.py`, `researcher.py`) | Domain-live / registration-URL checks `verify_candidates` already performs on the human org | No new usage — reused verbatim |
| fastapi / pydantic | already pinned | New `BriefRunBody` request model + new router in `api/control.py` | Matches every existing endpoint in the file |
| convex | already pinned (`@eisenbalm/convex`) | New `entryMode` field on `runs`; reuses existing `briefs`/`verificationRecords` tables | No new table needed |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|-----------|
| Extending `_start_run` | A second, brief-specific launcher function | Rejected — D-15 explicitly requires reusing `_start_run` so the one-at-a-time gate, budget gate, config snapshot, and `agentRuns:queueForRun` pre-population aren't duplicated/drift-prone across two launchers |
| `add_conditional_edges` after `calibrator` | A literal `add_conditional_edges(START, ...)` per D-01's exact wording | Rejected — see Architecture Patterns below; both chains start at `calibrator` identically (D-02), so a START-level branch would be a no-op |

**Installation:** None — no new packages.

**Version verification:** `langgraph==1.1.10` and `langgraph-checkpoint-postgres==3.1.0` are already pinned in `packages/pipeline/pyproject.toml`; `add_conditional_edges` is a stable, long-standing `StateGraph` method present in this version (confirmed via LangChain's current reference docs — see Sources).

## Architecture Patterns

### Pattern 1: Two conditional edges sharing one router (corrects D-01's literal placement)

**What:** D-01 says "conditional edges at `START`," but the two chains it describes both start `START → calibrator` identically (D-02: calibrator runs in both modes). A conditional edge literally at `START` would have to map every `entry_mode` value to the same node (`"calibrator"`), which is a no-op branch — the real fork happens **after** `calibrator` (discovery goes to `signal_editor`; brief goes straight to `verify_candidates`) and **after** `verify_candidates` (discovery goes to `advocate`; brief goes straight to `researcher`).

**When to use:** This phase's graph wiring only.

**Recommendation:**
```python
# graph/builder.py — keep the START edge unconditional (both modes need calibrator):
builder.add_edge(START, "calibrator")

# Router — single function, reused at both conditional-edge call sites with
# different path_maps. Defaults 'discovery' for any pre-Phase-48 state
# fixture that never sets entry_mode (back-compat, no KeyError).
def route_by_entry_mode(state: DispatchState) -> str:
    return state.get("entry_mode") or "discovery"

# REPLACES the existing static edge `builder.add_edge("calibrator", "signal_editor")`:
builder.add_conditional_edges(
    "calibrator",
    route_by_entry_mode,
    {"discovery": "signal_editor", "brief": "verify_candidates"},
)

# REPLACES the existing static edge `builder.add_edge("verify_candidates", "advocate")`:
builder.add_conditional_edges(
    "verify_candidates",
    route_by_entry_mode,
    {"discovery": "advocate", "brief": "researcher"},
)
```
Every other edge (`scout→verify_candidates`, `advocate→editor_gate_1`, `editor_gate_1→chronicler`, `chronicler→researcher`, `researcher→verify_research`, the 7-way fan-out, `validate_sections→qa→editor_final→publisher→END`) is untouched — this satisfies "downstream reused verbatim" and "discovery chain byte-unchanged" (the discovery *execution order* is identical; only the edge-declaration mechanism for two specific hops changes from `add_edge` to `add_conditional_edges`).

**Why this is safe with the existing checkpointer / node wrapper (verified, not assumed):**
- `wrap_agent_node` (`lib/agent_wrapper.py`) wraps node **functions**, not edges — it has no knowledge of how a node was reached. A conditional edge upstream has zero interaction with the wrapper's cancel-check/cost/I-O-snapshot logic.
- `calibrator`'s node function returns `{**state, ...}` (a full spread — confirmed by reading `agents/calibrator.py` lines 332-344), so `entry_mode`, `winning_charity`, `candidates`, `brief`, and the new `source_material` field (all seeded into `initial_state` before `graph.ainvoke()`) survive through calibrator unmodified.
- `verify_candidates` returns a **bare partial dict** — `{"candidates": survivors, "verification_records": records}` (confirmed, `agents/verify_candidates.py` line 239) — never touching `winning_charity`. LangGraph's default per-key merge means everything else in state (including `winning_charity`, `brief`, `entry_mode`) passes through untouched regardless.
- The AsyncPostgresSaver checkpointer records executed supersteps against `thread_id=run_id`; a brief-mode run never calls `interrupt()` anywhere on its path (Gate 1, the only interrupt point in the whole graph, is never reached), so there is no new interrupt/resume interaction to reason about — brief runs simply never pause.

### Pattern 2: `_start_run` extension (D-15/D-16) — thin, mode-agnostic launcher

**What:** Extend the existing single authoritative launcher (`api/runs.py::_start_run`) with four new optional params rather than forking a second launcher.

**Recommendation:**
```python
async def _start_run(
    app: Any,
    *,
    issue_number: Optional[int],
    trigger_source: str,
    triggered_by: Optional[str] = None,
    force_no_winner: bool = False,
    force_fail_agent: Optional[str] = None,
    narrator_slug: Optional[str] = None,
    # ── Phase 48 additions ──────────────────────────────────────────────
    entry_mode: str = "discovery",
    winning_charity: Optional[dict] = None,   # CharityCandidate shape (D-04/D-05)
    brief: Optional[dict] = None,             # Brief shape (D-04/D-06)
    source_material: Optional[str] = None,    # D-10
    agent_keys_override: Optional[list[str]] = None,  # D-16
) -> str:
    ...
    # Step 5 (agentRuns:queueForRun) — use the override when present, else the
    # existing full 20-step list (byte-unchanged for every existing caller):
    agent_keys = agent_keys_override or [
        "calibrator", "signal_editor", "scout", "verify_candidates", "advocate",
        "editor_gate_1", "chronicler",
        "researcher", "verify_research",
        *SECTION_WRITERS,
        "validate_sections", "qa", "editor_final", "publisher",
    ]
    ...
    # runs:create — add entryMode alongside triggerSource (persists it for the
    # dashboard/Stage-1 UI to read; see Pattern 4):
    runs_create_args["entryMode"] = entry_mode
    ...
    # initial_state — seed entry_mode always; brief-mode-only fields only when present:
    initial_state["entry_mode"] = entry_mode
    if entry_mode == "brief":
        initial_state["winning_charity"] = winning_charity
        initial_state["candidates"] = [winning_charity] if winning_charity else []
        initial_state["brief"] = brief
        if source_material:
            initial_state["source_material"] = source_material

    # briefs:insert — write HERE (after run_id exists, before create_task) so
    # the Brief row exists before the writers draft, mirroring §47.3's own
    # write, but for a run_id that never reaches editor_gate_1 (D-06):
    if brief is not None:
        await _cc.convex_mutation(http, "briefs:insert", {"runId": run_id, **brief})
```

**Why `briefs:insert` belongs inside `_start_run`, not the endpoint (resolves D-06's discretion item):** `briefs:insert` requires `runId`, which `_start_run` generates internally (Step 2) — the endpoint cannot mint it independently without either duplicating `new_run_id()`/`begin_run()` or making two separate calls with a partial-failure window (a run that starts but never gets its Brief row if the second call fails). Putting the write inside `_start_run`, right after `runs:create`, keeps every run-bootstrap side effect (pipelineRuns, runs, agentRuns queue, brief, config snapshot) inside the one function whose own docstring calls it "the SINGLE authoritative trigger body" — consistent with the file's existing design intent, and avoids a new failure mode the CONTEXT doesn't want.

**Existing callers (`/run/weekly`, `/pipeline/run`, `/pipeline/tick`) are unaffected** — all four new params default to values that reproduce today's exact behavior (`entry_mode="discovery"`, `agent_keys_override=None` → full list, `brief=None` → no `briefs:insert` call).

### Pattern 3: Brief-trigger endpoint lives in `api/control.py`, not `api/brief.py`

**What:** `api/brief.py` (Phase 47) is the **run-scoped content-edit family** — `PATCH /issues/{run_id}/brief`, `POST /issues/{run_id}/brief/{field}/strengthen/{preview,apply}` — all of which operate on an *existing* run's Brief row. The new brief-**trigger** endpoint has no `run_id` yet at request time (it creates one); it belongs conceptually and mechanically alongside `pipeline_run`/`pipeline_tick` in `api/control.py`, which already imports `_start_run`, `_require_clerk_jwt_control`, `_emit_audit`, and the gate-check pattern this endpoint reuses.

**Recommendation:** `POST /pipeline/run/brief` (matches the `/pipeline/run` + `/pipeline/tick` sibling family already in `control.py`; the alternative `/issues/brief` reads more like a REST-resource-under-issues path, which is the `api/brief.py` family's naming convention instead).

```python
class OrganizationInput(BaseModel):
    name: str
    website: Optional[str] = None
    charityNavigatorUrl: Optional[str] = None
    guidestarUrl: Optional[str] = None

class BriefRunBody(BaseModel):
    issueNumber: Optional[int] = None
    premise: str
    peg: str
    organization: OrganizationInput
    sourceMaterial: Optional[str] = None

@router.post("/pipeline/run/brief")
async def pipeline_run_brief(
    request: Request,
    body: BriefRunBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    if not body.organization.name.strip():
        raise HTTPException(status_code=422, detail="organization.name is required")

    operator_id = claims.get("sub")
    http = getattr(request.app.state, "convex_http", None)

    # Reuse the SAME one-at-a-time + budget gates pipeline_run enforces
    # (recommend factoring into a shared `_enforce_start_gates(http)` helper
    # to avoid two independently-drifting copies of this logic — see Pitfalls).
    await _enforce_start_gates(http)

    winning_charity: dict = {
        "name": body.organization.name,
        "location": "",
        "website": body.organization.website or "",
        "charityNavigatorUrl": body.organization.charityNavigatorUrl,
        "guidestarUrl": body.organization.guidestarUrl,
        "foundingYear": None,
        "assetRange": "",
        "focusArea": "",
        "missionStatement": "",
        "scoutSummary": "",
        "whyOverlooked": "",
        "advocateArgument": None,
        "advocateScore": None,
    }
    brief: dict = {
        "premise": body.premise,
        "currentPeg": body.peg,
        "centralClaim": "",
        "readerEffect": "",
        "knownRisks": "",
        "voiceIntention": "",   # see "voiceIntention" note below — starts blank, not defaulted
    }
    BRIEF_AGENT_KEYS = [
        "calibrator", "verify_candidates", "researcher", "verify_research",
        *SECTION_WRITERS, "validate_sections", "qa", "editor_final", "publisher",
    ]

    run_id = await _start_run(
        request.app,
        issue_number=body.issueNumber,
        trigger_source="manual",
        triggered_by=operator_id,
        entry_mode="brief",
        winning_charity=winning_charity,
        brief=brief,
        source_material=body.sourceMaterial,
        agent_keys_override=BRIEF_AGENT_KEYS,
    )

    await _emit_audit(
        http, actor_id=operator_id or "unknown", action="run.triggered",
        resource_type="run", resource_id=run_id,
        after=json.dumps({"entryMode": "brief", "organization": body.organization.name}),
    )
    return {"runId": run_id}
```

**`voiceIntention` starts blank, not defaulted from `style_brief.visualDirection` (resolves D-08's discretion item):** The Brief is authored **before the run starts** (that is this phase's entire selling point, per §47.3's own note). `style_brief` does not exist yet at the moment this endpoint runs — it is produced by `calibrator`, which hasn't executed yet. Defaulting `voiceIntention` from a field that doesn't exist yet is not mechanically possible without either (a) blocking the HTTP response on `calibrator`'s LLM call (breaks the "returns `{runId}` immediately" contract every other trigger endpoint honors), or (b) adding brief-specific Brief-patching logic inside `calibrator` itself (scope creep beyond D-02's literal "calibrator's job is unchanged"). Starting blank is simpler, avoids the race entirely, and is consistent with the other three blank fields (`centralClaim`, `readerEffect`, `knownRisks`) — the operator fills all four via the already-shipped BRF-06 strengthen once Stage 1 loads (by which point `calibrator` has run and `style_brief` exists, if a future phase wants to wire that enrichment).

### Pattern 4: Stage 1 needs a brief-mode variant (the gap the CONTEXT under-scoped)

**What:** `StoryBriefScreen.tsx` and `OrgOptionSlate.tsx` (Phase 47) are wired **entirely** off `story_leads` (Signal Editor's output) and `pitchLog` (Scout's output). Both tables are **permanently empty** for a brief-started run (`signal_editor` and `scout` are never in its execution path). Traced concretely:
- `StoryBriefScreen`'s "Leads" section: `storyLeadsTyped.length === 0` → renders `"No leads yet."` — technically not broken, but the copy implies leads are still coming, which is false for a brief run.
- `OrgOptionSlate`: `pitchRows.length === 0` → renders `"No organization options yet"` — this is the real gap. The human org and its `VerificationRecord` (persisted by `verify_candidates`, confirmed real, ENT-04-compliant) are **never rendered anywhere** in Stage 1, because this component's only data source (`pitchLog` + the Scout/Advocate join) is empty. This directly undermines D-11's explicit "surface its concerns prominently in Stage 1's org card" instruction — the record exists in Convex but is invisible in the console.
- The Brief section (`BriefFieldTable`/`BriefFieldStrengthen`) is **already correct out of the box** — it only depends on `ws.brief` (subscribed via `briefs:byRunId`), which Pattern 2 populates at intake regardless of entry mode. No work needed here.
- `NeedsYourDecisionCard` (`isPausedAtGate1`) is correctly suppressed for brief runs — `editor_gate_1` never runs in brief mode, so its `interrupt()` is never reached and `runs.status` never becomes `'awaiting-review'` via that path.

**Recommendation (net-new, scoped, small):**
1. Add `entryMode: v.optional(v.union(v.literal('discovery'), v.literal('brief')))` to the `runs` table (absent = `'discovery'`, mirroring `story_leads.status`'s "absent = default" precedent from §47.2).
2. Thread `runRow?.entryMode` into `WorkspaceStateProvider`'s exposed context value (it already pulls `runRow?.status` through the same pattern — see `app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` lines 142-148, 213).
3. In `StoryBriefScreen.tsx`, branch on `ws.entryMode === 'brief'`:
   - Replace the "Leads" section with a short explanatory line ("Started from a hand-authored brief — no story leads.") instead of the misleading "No leads yet."
   - Replace `<OrgOptionSlate />` with a new small `BriefOrgCard` component that reads `winning_charity` (via a `pipelineRuns`/`runs`-scoped query already available, or by exposing it on `ws`) + the matching `verificationRecords` row (already centrally subscribed as `ws.verificationRecords`, joined the SAME way `OrgOptionSlate` already joins it — `candidateId === charity-{slugify(name)}` or `candidateName` fallback) — reusing the exact never-truncated rendering discipline (`mechanism`, verification-with-dates, always-visible main concern) `OrgOptionSlate`'s per-item `<li>` already implements, just without the `pitchLog` dependency.
   - Leave `BriefFieldTable`/`BriefFieldStrengthen`/`NeedsYourDecisionCard` untouched.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| One-at-a-time / budget start-gates for the new endpoint | A second copy-pasted gate block in the new brief-trigger handler | Factor `pipeline_run`'s existing gate logic (lines 233-263 of `api/control.py`) into a shared `_enforce_start_gates(http) -> None` helper, called by both `pipeline_run` and the new brief endpoint | D-15 explicitly requires "all shared run-launch discipline is preserved" — two independently-maintained copies of the same 409 logic will drift the first time either is touched |
| `_charity_id_for(name)` join-key derivation | A third copy of `f"charity-{slugify(name)}"` | Reuse the *pattern* already duplicated in `agents/advocate.py::_charity_id_for` and `agents/verify_candidates.py::_charity_id_for` — the brief endpoint doesn't need to compute this key itself at all; it only needs to supply `name`, and `verify_candidates`/`_assemble_brief`'s existing matchers already derive the key downstream | No new join-key scheme should be invented; the existing derivation already binds the human org to its `VerificationRecord` correctly once `candidates=[{"name": ..., ...}]` is seeded |
| A synthetic "minimal charity dict" shape for a human-supplied org with no scouted fields | A hand-invented partial `CharityCandidate` literal | Copy the **exact existing precedent** in `agents/editor.py`'s D-14 "all-candidates-killed" synthetic-winner branch (lines 423-437) — it is already a human-name-only `CharityCandidate` dict with every other field defaulted to `""`/`None` | This is the identical problem (a human-supplied name with no scored/researched data) already solved once in this codebase; the brief endpoint's `winning_charity` dict should be structurally identical |
| Deliberation content for a brief run | A minimal/synthetic chronicler pass | Nothing — leave `deliberation_transcript`/`deliberation_conversation` as `None` (D-12) | `lib/sanity_client.py` already defends with `.get(..., "")` / `.get(...) or []` — confirmed no crash risk; the reader-facing `DeliberationSlot` (Phase 13) already renders an absent-deliberation state gracefully |

**Key insight:** Nearly everything downstream of `researcher` was already built mode-agnostic (it reads `winning_charity`/`brief`/`research`, never inspects how they got populated) — the temptation to "build a parallel brief-mode data path" for research, sections, QA, or publishing must be resisted; the actual required work is entirely at the entry seam (graph edges + `_start_run` seeding + one new endpoint + Stage 1 rendering), exactly as the CONTEXT's "reuse/generalize, don't fork" governing principle states.

## Common Pitfalls

### Pitfall 1: Taking D-01's "conditional edge at `START`" literally
**What goes wrong:** Wiring `builder.add_conditional_edges(START, route_by_entry_mode, {"discovery": "calibrator", "brief": "calibrator"})` compiles and runs fine, but accomplishes nothing — it's a disguised static edge.
**Why it happens:** D-01's prose names `START` as the conditional point while its own chain description shows both modes beginning at `calibrator`.
**How to avoid:** Place the conditional edges after `calibrator` and after `verify_candidates` (Pattern 1 above); keep `add_edge(START, "calibrator")` unconditional.
**Warning signs:** A router function that only ever needs to distinguish two path_map values that are identical.

### Pitfall 2: `verify_candidates` silently emptying `candidates` and someone "fixing" that
**What goes wrong:** A future engineer sees a brief run finish with `state['candidates'] == []` (the human org got killed by a definitive check) and "fixes" it by making `verify_candidates` skip the kill logic in brief mode, or by re-adding the killed candidate back into `candidates`.
**Why it happens:** `candidates == []` looks like a bug at a glance.
**How to avoid:** Do nothing — this is correct, harmless, and exactly what D-11 wants. `researcher` never reads `state['candidates']`; only `state['winning_charity']`, which `verify_candidates` never touches. Confirm this with the existing `researcher.py` line `charity = state.get("winning_charity") or {}` before "fixing" anything.
**Warning signs:** Any planned change to `verify_candidates.py`'s kill/filter logic that is scoped to Phase 48 — the CONTEXT itself says "this phase invokes it on a human org, it does not alter its checks."

### Pitfall 3: Forgetting the `runs.entryMode` Convex field means Stage 1 can't tell which mode a run is in
**What goes wrong:** `_start_run` seeds `DispatchState['entry_mode']` for the graph, but if `runs:create`'s Convex args don't also carry an `entryMode` field, the dashboard has no way to distinguish a brief-started run from a discovery run at all (the pipeline's internal `DispatchState` is invisible to the console; only Convex-persisted fields are).
**Why it happens:** `entry_mode` (pipeline-side) and `entryMode` (Convex-side) are two separate persistence layers that must both be threaded — easy to do one and forget the other.
**How to avoid:** Confirm both: `initial_state["entry_mode"] = entry_mode` (graph) AND `runs_create_args["entryMode"] = entry_mode` (Convex `runs:create` call) inside `_start_run`.
**Warning signs:** Stage 1 UI work that reads `run?.status` but never `run?.entryMode`.

### Pitfall 4: Editing `convex/schema.ts` / `convex/runs.ts` and expecting it live without a sync step
**What goes wrong:** The new `entryMode` field and `runs:create` arg change are committed to git but never actually reach the Convex deployment, so the pipeline's `runs:create` call 500s with "Unexpected field" the first time it's exercised for real (mirrors the exact Phase 42-03 "unregistered guarded path" lesson, just for schema instead of secret-guarding).
**Why it happens:** Convex functions/schema are deployed via `pnpm --filter @eisenbalm/convex dev:once`, not via `git commit` (memory: `[[convex-functions-need-live-sync]]`).
**How to avoid:** Run `pnpm --filter @eisenbalm/convex dev:once` after any `convex/schema.ts` / `convex/runs.ts` / `convex/briefs.ts` touch, before any pipeline call that exercises the new field.
**Warning signs:** Passing pytest (mocked Convex) but a real endpoint call 500ing.

### Pitfall 5: The `researcher_user.md` prompt template silently dropping source material if a DB-active override predates the phase
**What goes wrong:** Adding a `{source_material}` token to `prompts/researcher_user.md` (disk fallback) is necessary but not sufficient — if `prompt_versions` has an **active** `researcher_user` row in Convex (Phase 24 config override), that stored template lacks the new token, and `.replace("{source_material}", block)` on a string with no matching substring is a silent no-op. Source material is quietly never seen by the LLM for any run using the DB-active version.
**Why it happens:** `RunConfig.user_templates` prefers the Convex-hydrated active row over the on-disk file (`CFG-03` fallback chain) — confirmed in `agents/researcher.py::_build_messages`.
**How to avoid:** Either check whether a `researcher_user` `prompt_versions` row is currently active and update it alongside the `.md` file, or treat "silently omitted for legacy DB-active prompt versions" as an acceptable, explicitly-flagged degradation (matches the existing tolerance for missing tokens elsewhere in the config system) — the planner should pick one and state it, not leave it implicit.
**Warning signs:** A brief-mode QA/manual-UAT run where pasted source material never shows up in the Researcher's actual Tavily-result-plus-context prompt (visible in the Inspect-how-this-was-made Inputs tab, Phase 44).

## Code Examples

### `DispatchState` additions (§7 amendment)
```python
# packages/pipeline/src/eisenbalm_pipeline/graph/state.py
class DispatchState(TypedDict):
    ...
    # ── Phase 48: Brief Entry Point (ENT-01..04) ──────────────────────────────
    entry_mode: NotRequired[Optional[Literal['discovery', 'brief']]]
    # Routes the two conditional edges (calibrator->{signal_editor|verify_candidates},
    # verify_candidates->{advocate|researcher}). Absent/None -> 'discovery' by the
    # router fn's `state.get("entry_mode") or "discovery"` default (back-compat with
    # every pre-Phase-48 DispatchState test fixture — NotRequired mirrors the
    # existing `config` field precedent for the identical reason).
    source_material: NotRequired[Optional[str]]
    # D-10: optional free-text (URLs + pasted notes), threaded into the
    # Researcher's user prompt as prioritized seed context. Only ever set on
    # brief-mode runs (via _start_run); None/absent on discovery runs -> the
    # {source_material} template token renders as "" (byte-equivalent prompt,
    # mirrors the existing {corrections} empty-string precedent).
```

### Researcher threading (D-10) — mirrors the existing `_build_corrections_block` pattern
```python
# packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
def _build_source_material_block(source_material: str | None) -> str:
    """D-10: render operator-supplied source material as a labeled block.
    Empty string when absent (byte-equivalent messages for discovery runs)."""
    if not source_material:
        return ""
    return f"OPERATOR-SUPPLIED SOURCE MATERIAL (prioritize these as seed context):\n{source_material}"

# In _build_messages(), add one more .replace() call:
user = (
    user_tmpl
    .replace("{charity}", f"{charity}")
    .replace("{results_block}", results_block)
    .replace("{corrections}", corrections_block)
    .replace("{source_material}", _build_source_material_block(state.get("source_material")))
)
```
Add the `{source_material}` token to `prompts/researcher_user.md` (see Pitfall 5 for the DB-active-override caveat).

### Frontend: second Create-panel cell + `triggerBriefRun` client (D-13/D-14)
```typescript
// apps/dispatch-control/lib/pipelineControlClient.ts — sibling of triggerRun
export interface TriggerBriefRunBody {
  issueNumber?: number
  premise: string
  peg: string
  organization: { name: string; website?: string; charityNavigatorUrl?: string; guidestarUrl?: string }
  sourceMaterial?: string
}

export async function triggerBriefRun(
  body: TriggerBriefRunBody,
  token: string | null,
): Promise<TriggerRunResult> {
  const res = await fetch(`${pipelineBaseUrl()}/pipeline/run/brief`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`trigger-brief-run failed (${res.status})${detail ? `: ${detail}` : ''}`)
  }
  return (await res.json()) as TriggerRunResult
}
```
`CreatePanel.tsx`'s reserved second grid cell (currently a JSX comment, lines 79-80) becomes a peer card — same `min-h-[44px]` button styling, same `ensureByNumber` → trigger → `router.push(issueHref(nextIssueNumber))` flow as the existing "Find a story with agents" card, substituting `triggerBriefRun` for `triggerRun` and revealing an inline form (premise / peg / organization name+website / optional source material) before submit.

## Runtime State Inventory

*(Not applicable — Phase 48 is a greenfield feature addition, not a rename/refactor/migration. No existing runtime state changes name or shape.)*

## State of the Art

*(Not applicable in the usual sense — there is no "old approach" being replaced. This phase adds a second entry path alongside the existing one, which is fully preserved. The one relevant "old→new" framing is the graph topology itself:)*

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| Single unconditional chain: `START → calibrator → signal_editor → scout → verify_candidates → advocate → editor_gate_1 → chronicler → researcher → …` | Two conditional edges (`calibrator→{signal_editor\|verify_candidates}`, `verify_candidates→{advocate\|researcher}`) keyed on `entry_mode` | This phase | The graph now has two valid execution paths from one compiled graph/checkpointer; discovery's path and behavior are unchanged, brief's path skips 4 nodes |

## Open Questions

1. **Should the `_enforce_start_gates` refactor (Pitfall/Don't-Hand-Roll item) be mandatory, or is copy-pasting the ~25-line gate block acceptable?**
   - What we know: `pipeline_run`'s one-at-a-time + budget-gate block is short and self-contained; D-15 says "all shared run-launch discipline is preserved," which the gate logic technically satisfies either way (same checks run) — but only extraction prevents future drift between two copies.
   - What's unclear: whether the planner should spend a task on this refactor or accept the duplication given the phase's tight scope.
   - Recommendation: extract it (small, low-risk, directly serves D-15's stated intent) but this is not blocking — flag as planner's call.

2. **Does the Phase 44 "Inspect how this was made" Inputs tab need `_INPUT_KEYS["researcher"]` updated to include `source_material`?**
   - What we know: `_INPUT_KEYS` in `lib/agent_wrapper.py` is a hand-maintained whitelist used for the I/O-snapshot capture (`agent_run_payloads`), separate from the Phase 44 "declared template variables minus keys supplied" diff mechanism.
   - What's unclear: whether omitting it causes the Inspector to under-report the Researcher's actual inputs for a brief run (cosmetic, not functional).
   - Recommendation: add `"source_material"` to `_INPUT_KEYS["researcher"]`'s list as a one-line follow-on; not blocking for ENT-01..04.

3. **Exact `BriefOrgCard` component boundary (new Stage-1 component for Pattern 4) vs. extending `OrgOptionSlate` with an internal branch.**
   - What we know: `OrgOptionSlate`'s entire join logic (`joinCandidates`) is Scout/pitchLog-shaped and doesn't apply to a brief run's single human org; a parallel, much simpler render path is needed.
   - What's unclear: whether the planner prefers a wholly separate component file (`BriefOrgCard.tsx`) or an `if (ws.entryMode === 'brief') { ... }` early-return inside `OrgOptionSlate.tsx` itself.
   - Recommendation: separate component — `OrgOptionSlate` is already a Scout/Advocate-shaped join; forcing a brief-mode branch into it mixes two different data-join stories in one file. A new small component reading `winning_charity` + the single matching `VerificationRecord` is cleaner and independently testable.

## Environment Availability

*(Skipped — this phase has no new external dependencies. All services touched (Convex, Clerk, Tavily/web_search via `verify_candidates`, httpx) are already integrated and exercised by existing phases.)*

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Pipeline framework | pytest 8.3 + pytest-asyncio (already configured, `packages/pipeline/pyproject.toml`) |
| Pipeline config file | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` |
| Dispatch-control framework | Vitest 3.2 (`apps/dispatch-control/package.json`) |
| Dispatch-control config file | `apps/dispatch-control/vitest.config.*` (existing) |
| Quick run command (pipeline) | `cd packages/pipeline && uv run pytest tests/test_builder_wiring.py tests/test_control.py tests/test_editor_gate_1_resume.py -x` (existing files touched by this phase — run these first) |
| Quick run command (dispatch-control) | `pnpm --filter dispatch-control test:unit -- CreatePanel StoryBriefScreen runControl` |
| Full suite command (pipeline) | `cd packages/pipeline && uv run pytest` |
| Full suite command (dispatch-control) | `pnpm --filter dispatch-control test:unit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|---------------------|--------------|
| ENT-01 | Second Create-panel cell renders "Start from my brief" as a peer card; submit flow calls `ensureByNumber` → `triggerBriefRun` → `router.push(issueHref(n))` | unit (vitest, component) | `pnpm --filter dispatch-control test:unit -- CreatePanel` | ❌ Wave 0 (new file) |
| ENT-02 | Graph wiring: `calibrator` conditional-routes brief mode to `verify_candidates` (skipping signal_editor/scout/advocate/editor_gate_1); `_start_run` seeds `entry_mode`/`winning_charity`/`candidates`/`brief` correctly | unit (pytest, source-scan + `_start_run` unit) | `cd packages/pipeline && uv run pytest tests/test_builder_entry_mode_wiring.py tests/test_start_run_brief_seed.py -x` | ❌ Wave 0 (new files; mirror `test_builder_wiring.py`'s existing source-scan pattern exactly) |
| ENT-02 | `POST /pipeline/run/brief` — 422 on empty org name, reuses one-at-a-time/budget 409s, 200 returns `{runId}`, emits `run.triggered` audit row | unit (pytest, FastAPI TestClient, mirrors `test_control.py`) | `cd packages/pipeline && uv run pytest tests/test_brief_run_endpoint.py -x` | ❌ Wave 0 (new file) |
| ENT-03 | A brief-started run's full pipeline execution (stub-mode) produces `origin_story`/`problem`/`founder_bio`/`case_study`/`game`/`bonus`/`theme`, QA corrections, claims, and reaches `publisher` — same as a discovery run, minus deliberation | integration (pytest, extends existing e2e harness) | `cd packages/pipeline && uv run pytest tests/test_pipeline_e2e.py -k brief -x` | ❌ Wave 0 (extend `test_pipeline_e2e.py` — the existing `test_pipeline_e2e_runId_threaded_to_all_datastores` is the direct precedent to clone) |
| ENT-03 | Stages 2-5 of a brief-started issue render identically to a discovery-started issue (visual/DOM parity) | manual-only | — (no automated DOM-diff harness exists for this) | manual UAT — justified: cross-stage visual "indistinguishable" claims aren't currently covered by any existing snapshot/visual-regression tooling in this repo |
| ENT-04 | `verify_candidates` persists exactly one `VerificationRecord` for the human org even when killed; `winning_charity`/researcher continuation are unaffected by a kill | unit (pytest) | `cd packages/pipeline && uv run pytest tests/test_verify_candidates_brief_mode.py -x` | ❌ Wave 0 (new file — or extend the existing Phase 46 `verify_candidates` test module if one exists under a different name; planner confirms exact existing filename during Wave 0) |

### Sampling Rate

- **Per task commit:** the quick-run commands above (both pipeline and dispatch-control), scoped to touched files.
- **Per wave merge:** `cd packages/pipeline && uv run pytest` (full) + `pnpm --filter dispatch-control test:unit` (full).
- **Phase gate:** both full suites green, **plus** `pnpm --filter dispatch-control build` (strict `next build` — vitest does not type-check; memory: `[[run-strict-build-before-frontend-phase-done]]`) before `/gsd:verify-work`.

### Wave 0 Gaps

- [ ] `packages/pipeline/tests/test_builder_entry_mode_wiring.py` — source-scan test mirroring `test_builder_wiring.py`'s exact pattern, asserting: `entry_mode` field exists in `state.py`, both `add_conditional_edges` calls exist with the correct path_maps, `add_edge(START, "calibrator")` is unconditional and unchanged.
- [ ] `packages/pipeline/tests/test_start_run_brief_seed.py` — unit tests for `_start_run`'s four new params: default behavior unchanged for existing callers; brief-mode seeding of `initial_state`; `agent_keys_override` respected; `briefs:insert` called only when `brief is not None`.
- [ ] `packages/pipeline/tests/test_brief_run_endpoint.py` — FastAPI TestClient tests for `POST /pipeline/run/brief`.
- [ ] `packages/pipeline/tests/test_verify_candidates_brief_mode.py` (or extend the existing Phase 46 verify_candidates test file — confirm exact name at Wave 0) — asserts advisory-only behavior for a single-candidate brief-mode invocation.
- [ ] Extend `packages/pipeline/tests/test_pipeline_e2e.py` with a brief-mode end-to-end case (clone `test_pipeline_e2e_runId_threaded_to_all_datastores`'s structure).
- [ ] `apps/dispatch-control/__tests__/CreatePanel.test.tsx` — new file (none exists today).
- [ ] Extend `apps/dispatch-control/__tests__/StoryBriefScreen.test.tsx` with an `entryMode === 'brief'` render-path case.
- [ ] `docs/API_CONTRACTS.md` §7 (`entry_mode` + `source_material` DispatchState fields) and a new §48 (the endpoint, the `runs.entryMode` field, the brief-seed shape) — **contract-first gate, must land before any code** (CLAUDE.md hard rule).
- [ ] `convex/schema.ts` `runs.entryMode` field + `convex/runs.ts::create` arg — **must be live-synced** via `pnpm --filter @eisenbalm/convex dev:once` before any pipeline call exercises it (memory: `[[convex-functions-need-live-sync]]`).

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement:** all file-changing work must go through a GSD command (`/gsd:execute-phase` for this planned phase work) — no direct repo edits outside the workflow.
- **Schema field-name freeze:** do not modify field names in `schemas/` or `convex/schema.ts` without checking `docs/API_CONTRACTS.md` first — this phase only *adds* fields (`entry_mode` on `DispatchState`, `entryMode` on `runs`), never renames.
- **Contract-first (hard rule):** every cross-boundary shape this phase introduces (`entry_mode`, the brief seed, the new endpoint, `runs.entryMode`) must be documented in `docs/API_CONTRACTS.md` (§7 + new §48) and `convex/schema.ts` BEFORE implementation code — treat this as the phase's Wave 0 gate, not a documentation afterthought.
- **Write boundary:** every console content mutation goes dashboard → pipeline API → Sanity/Convex, logged to `audit_log` — the new `triggerBriefRun` client must never call Convex directly for anything content-touching (mirrors `briefClient.ts`'s existing "never talks to Sanity/Convex directly" discipline).
- **Convex functions need live sync:** any `convex/schema.ts` or `convex/*.ts` change must be synced via `pnpm --filter @eisenbalm/convex dev:once` — committing is not deploying.
- **Strict build gate:** `pnpm --filter dispatch-control build` must pass before the phase is declared done (vitest alone does not type-check).
- **Sequential-in-main-checkout execution:** no worktrees for this phase (established mode for Phases 36-47) — avoids the strand-on-branches problem.

## Sources

### Primary (HIGH confidence — read directly from this repository)
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — full current edge/node wiring
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — `DispatchState` + all TypedDicts
- `packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py` — full verification node logic
- `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` — `editor_gate_1`, `_assemble_brief`, the D-14 synthetic-winner precedent
- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` — confirms `winning_charity`-only read, prompt template mechanism
- `packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py` — confirms full-state-spread return
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` — confirms `winning_charity_sanity_id` self-contained derivation, `deliberation_transcript`/`conversation` defensive `.get()`
- `packages/pipeline/src/eisenbalm_pipeline/lib/agent_wrapper.py` — confirms node-wrapper is edge-agnostic
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` — `_PIPELINE_SECRET_GUARDED_PATHS` (confirms `runs:create`/`briefs:insert` already guarded, no new registration needed)
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` — `_start_run` full implementation
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` — `pipeline_run`, gate logic, `_require_clerk_jwt_control`, `_emit_audit`
- `packages/pipeline/src/eisenbalm_pipeline/api/brief.py` — confirms the run-scoped content-edit family (distinct from the new trigger endpoint)
- `packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md` — template token mechanism
- `packages/pipeline/tests/test_builder_wiring.py` — existing source-scan test precedent
- `convex/schema.ts` — `runs`, `pipelineRuns`, `briefs` table definitions
- `convex/briefs.ts`, `convex/runs.ts` — existing mutation implementations
- `apps/dispatch-control/app/(dashboard)/issues/_components/CreatePanel.tsx` — the reserved second grid cell
- `apps/dispatch-control/lib/pipelineControlClient.ts`, `lib/briefClient.ts`, `lib/issueRouteResolver.ts`
- `apps/dispatch-control/app/(dashboard)/story-brief/_components/StoryBriefScreen.tsx`, `OrgOptionSlate.tsx`
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx`
- `docs/API_CONTRACTS.md` §3B, §7, §46, §47 — existing contract sections this phase amends
- `.planning/phases/48-brief-entry-point/48-CONTEXT.md`, `.planning/PROJECT.md`, `.planning/REQUIREMENTS.md`

### Secondary (MEDIUM confidence)
- LangGraph `add_conditional_edges(START, ...)` mechanism — verified against current LangChain reference docs (matches `langgraph==1.1.10`'s pinned API surface; the repo itself has no prior example of a conditional-entry-at-START pattern to cross-check against, hence not HIGH)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; every mechanism verified by reading the actual pinned-version source in this repo.
- Architecture (graph wiring, `_start_run` extension, endpoint placement): HIGH — every claim traced to specific line ranges in the current codebase, including the D-01 literal-placement correction.
- Stage 1 rendering gap: HIGH — traced `StoryBriefScreen`/`OrgOptionSlate`'s actual data dependencies (`story_leads`, `pitchLog`) and confirmed both are empty-by-construction for brief runs.
- Pitfalls: HIGH — each is a specific, verified code-path consequence (partial-return semantics, config-override token drift, Convex live-sync), not a generic warning.

**Research date:** 2026-07-16
**Valid until:** 30 days (stable internal codebase; no external API/version drift risk since no new external dependencies are introduced)
