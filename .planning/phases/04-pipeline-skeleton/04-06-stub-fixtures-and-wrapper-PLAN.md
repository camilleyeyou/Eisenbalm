---
phase: 04-pipeline-skeleton
plan: 06
type: execute
wave: 2
depends_on:
  - "04-02"
  - "04-03"
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/stubs/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py
  - packages/pipeline/src/eisenbalm_pipeline/stubs/fake_openrouter.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py
autonomous: true
requirements:
  - PIP-04
must_haves:
  truths:
    - "`@agent_node(name=..., emit_event=..., payload_builder=..., max_tool_calls=...)` decorator wraps every agent body with try/except + Convex event emission + cost recording + iteration-limit attribute"
    - "Decorator catches exceptions, calls `convex_mutation_safe('pipelineRuns:updateStatus', {status: 'failed', errorMessage: '{agent_id}: {ExceptionClass}: {msg}'})`, then re-raises so LangGraph checkpoints the failure (CONTEXT D-27)"
    - "Decorator honors the `_force_fail_agent` test toggle — research §"Pattern 5" code path raises RuntimeError when state['_force_fail_agent'] == name"
    - "`stubs/fixtures.py` exports 14 deterministic functions (one per agent) returning structurally valid partial state matching API_CONTRACTS §7"
    - "Stub Scout fixture returns the demo 'The Quiet Foundation' charity (Phase 2 D-16 reuse — no fake test data polluting the charity database)"
    - "Stub Calibrator fixture returns hardcoded `bonusType: 'bigBudget'` (CONTEXT D-16; Phase 5 owns rotation)"
    - "Stub Editor gate 1 fixture honors the `_force_no_winner` test toggle"
    - "`stubs/fake_openrouter.py` placeholder exists (Phase 5 swap point) — returns canned strings, records 0 tokens"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py"
      provides: "@agent_node decorator"
      contains: "def agent_node"
    - path: "packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py"
      provides: "14 deterministic fixture functions"
      contains: "def calibrator_output"
    - path: "packages/pipeline/src/eisenbalm_pipeline/stubs/fake_openrouter.py"
      provides: "Phase 5 swap-point placeholder"
      contains: "class FakeOpenRouterClient"
  key_links:
    - from: "agents/_wrapper.py:@agent_node"
      to: "lib/convex_client.py:convex_mutation_safe + lib/cost.py:record_cost"
      via: "wrapper calls both on success path; only Convex on failure path"
      pattern: "convex_mutation_safe"
    - from: "stubs/fixtures.py:scout_candidates"
      to: "Phase 2 demo charity 'The Quiet Foundation'"
      via: "Returns a candidate list including this charity so stub Editor can select it"
      pattern: "The Quiet Foundation"
---

<objective>
Land the `@agent_node` decorator (the Phase 4→Phase 5 stability contract per CONTEXT D-15 and CONTEXT §"Specifics") and the 14 deterministic stub fixtures every agent will return. The decorator is the single most important architectural artifact in Phase 4 — Phase 5 changes ONLY the agent function bodies; the decorator stays as-is. Stub fixtures must be deterministic so the integration test (Plan 10) can assert exact output shapes.

Purpose: PIP-04 (each agent stub returns structurally valid `DispatchState`). The wrapper plumbing — try/except, Convex event emission, cost recording, iteration-limit storage, test-toggle honoring — is the foundation Plan 07's 14 stub agents depend on.
Output: One decorator file + one fixtures module with 14 fixture functions + a fake OpenRouter placeholder. Wave 2 Plan 07 wires these into 14 agent modules.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/04-pipeline-skeleton/04-CONTEXT.md
@.planning/phases/04-pipeline-skeleton/04-RESEARCH.md
@docs/API_CONTRACTS.md
@docs/CLAUDE_CODE_BRIEF.md
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py
@packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/cost.py
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create agents/__init__.py + agents/_wrapper.py (@agent_node decorator — Phase 4→5 stable contract)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/__init__.py, packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-15 (full decorator signature + body — read closely)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-25 (max_tool_calls stored as function attribute for Phase 5)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-27 (errorMessage format: `f'{agent_id}: {ExceptionClass}: {short_msg}'`)
    - .planning/phases/04-pipeline-skeleton/04-RESEARCH.md "Pattern 5" lines 437-510 (full reference impl — COPY THIS)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-20 (Convex failures log + continue — wrapper uses convex_mutation_safe)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-37 (_force_fail_agent toggle — decorator raises before fn runs)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md "Claude's Discretion" (payload_builder hook lives in the wrapper, with per-agent builder param)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (already exports `convex_mutation_safe`)
    - packages/pipeline/src/eisenbalm_pipeline/lib/cost.py (already exports `record_cost`)
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py (DispatchState)
  </read_first>
  <action>
    **Step A — `packages/pipeline/src/eisenbalm_pipeline/agents/__init__.py`**: one docstring line: `"""14 agent modules + the @agent_node wrapper decorator."""`

    **Step B — `packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py`** — copy research §"Pattern 5" verbatim with the test-toggle from research's Pattern 5 example (the `_force_fail_agent` check at the top, before `fn(state)`):

    ```python
    """@agent_node decorator — Phase 4 → Phase 5 stable contract (CONTEXT D-15).

    Phase 5 changes ONLY the agent function bodies. This decorator stays as-is.

    Owns:
      - try/except around the agent body (CONTEXT D-15)
      - Convex deliberationEvents:insert on success (when emit_event is set)
      - Cost recording via lib.cost.record_cost (stub mode: 0 tokens, 0 USD)
      - Iteration limit attribute (CONTEXT D-25 — stored on function; enforced in Phase 5)
      - Test toggle _force_fail_agent (CONTEXT D-37)
      - errorMessage format per CONTEXT D-27

    Source: 04-RESEARCH.md §"Pattern 5".
    """
    from __future__ import annotations
    import functools
    import json
    import logging
    import time
    from typing import Any, Awaitable, Callable, Optional

    from eisenbalm_pipeline.graph.state import DispatchState
    from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
    from eisenbalm_pipeline.lib.cost import record_cost

    log = logging.getLogger(__name__)


    def agent_node(
        *,
        name: str,
        emit_event: Optional[str] = None,
        payload_builder: Optional[Callable[[DispatchState], dict]] = None,
        max_tool_calls: Optional[int] = None,
    ) -> Callable:
        """Wrap an agent body with the standard cross-cutting concerns.

        Args:
            name: agent_id (matches agentProfile.agentId in Sanity — e.g. 'scout').
                  Used as agentId in deliberationEvents and as the prefix in
                  errorMessage on failure (CONTEXT D-27).
            emit_event: If provided, emit a `deliberationEvents:insert` with this
                  eventType on successful agent completion.
            payload_builder: Optional fn that takes the post-run state and returns
                  a dict for the deliberationEvents.payload JSON string.
            max_tool_calls: Stored on the function as `_max_tool_calls`. Phase 4
                  doesn't enforce (stubs don't call tools); Phase 5 reads this
                  attribute on entry to enforce AGT-18.

        Phase 4 → Phase 5 contract: this signature does NOT change.
        """

        def decorator(
            fn: Callable[[DispatchState], Awaitable[DispatchState]],
        ) -> Callable[[DispatchState], Awaitable[DispatchState]]:
            # Stored for Phase 5 iteration-limit enforcement (AGT-18).
            fn._max_tool_calls = max_tool_calls  # type: ignore[attr-defined]

            @functools.wraps(fn)
            async def wrapped(state: DispatchState) -> DispatchState:
                start = time.monotonic()
                run_id = state["run_id"]

                # Test toggle: forced agent failure (CONTEXT D-37 / OPS-01).
                if state.get("_force_fail_agent") == name:
                    err = RuntimeError(
                        f"Forced failure for testing (agent={name})"
                    )
                    await convex_mutation_safe(
                        "pipelineRuns:updateStatus",
                        {
                            "runId": run_id,
                            "status": "failed",
                            "completedAt": int(time.time() * 1000),
                            # CONTEXT D-27 format: f'{agentId}: {ExceptionClass}: {msg}'
                            "errorMessage": f"{name}: RuntimeError: {err}",
                        },
                    )
                    raise err

                try:
                    new_state = await fn(state)
                    duration_ms = int((time.monotonic() - start) * 1000)

                    # Emit the deliberation event for visualization.
                    if emit_event:
                        payload = (
                            payload_builder(new_state) if payload_builder else {}
                        )
                        await convex_mutation_safe(
                            "deliberationEvents:insert",
                            {
                                "runId": run_id,
                                "agentId": name,
                                "eventType": emit_event,
                                "payload": json.dumps(payload),
                            },
                        )

                    # Record cost (stub mode: 0 tokens, 0 USD; duration is real).
                    record_cost(
                        run_id,
                        name,
                        tokens_in=0,
                        tokens_out=0,
                        usd=0.0,
                        duration_ms=duration_ms,
                    )
                    return new_state

                except Exception as e:
                    # CONTEXT D-27: f'{agentId}: {ExceptionClass}: {msg}'
                    error_msg = f"{name}: {type(e).__name__}: {e}"
                    log.exception("Agent %s raised: %s", name, error_msg)
                    await convex_mutation_safe(
                        "pipelineRuns:updateStatus",
                        {
                            "runId": run_id,
                            "status": "failed",
                            "completedAt": int(time.time() * 1000),
                            "errorMessage": error_msg,
                        },
                    )
                    raise  # propagate so LangGraph checkpoints the failure

            # Preserve max_tool_calls on the wrapped function for Phase 5.
            wrapped._max_tool_calls = max_tool_calls  # type: ignore[attr-defined]
            return wrapped

        return decorator
    ```

    Notes for executor:
    - `convex_mutation_safe` is used everywhere (CONTEXT D-20) — Convex failures must not crash an agent.
    - The wrapper RE-RAISES the original exception after writing the failed status. LangGraph's behavior on uncaught node exceptions is to checkpoint the partial state and bubble up to the orchestrator.
    - `_max_tool_calls` set on BOTH `fn` (so introspection on the source function works) and `wrapped` (so introspection through the decorator chain also works).
    - The `_force_fail_agent` check happens BEFORE `fn(state)` runs — this matches research's Pattern 5 exactly.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents._wrapper import agent_node; import inspect; src = inspect.getsource(agent_node); assert 'convex_mutation_safe' in src; assert 'record_cost' in src; assert '_force_fail_agent' in src; assert '_max_tool_calls' in src; assert 'deliberationEvents:insert' in src; assert 'pipelineRuns:updateStatus' in src; assert 'errorMessage' in src; print('OK')"</automated>
  </verify>
  <done>
    - `agents/_wrapper.py` exports `agent_node` decorator with signature `agent_node(*, name, emit_event=None, payload_builder=None, max_tool_calls=None)`
    - On exception: writes `pipelineRuns:updateStatus` with status='failed', errorMessage in `f'{name}: {ExceptionClass}: {msg}'` format, then re-raises (CONTEXT D-27)
    - On `_force_fail_agent == name`: raises before fn runs (CONTEXT D-37)
    - On success + `emit_event`: writes `deliberationEvents:insert` with the agent's eventType and a payload from `payload_builder(state)` (CONTEXT D-15)
    - `record_cost(run_id, name, tokens_in=0, tokens_out=0, usd=0.0, duration_ms=...)` called on success
    - `_max_tool_calls` stored as attribute (CONTEXT D-25)
  </done>
</task>

<task type="auto">
  <name>Task 2: Create stubs/__init__.py + stubs/fixtures.py (14 deterministic fixture functions reusing Phase 2 demo charity)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/stubs/__init__.py, packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-16 (stub fixtures are deterministic; reuse Phase 2 demo charity "The Quiet Foundation"; issue_number defaults to 999; Calibrator returns hardcoded bonusType='bigBudget')
    - docs/API_CONTRACTS.md §7 (DispatchState + nested TypedDicts — every fixture must return shape-correct partial state)
    - docs/CLAUDE_CODE_BRIEF.md §"The nine-agent pipeline" lines 78-210 (each agent's input/output contract — fixture text should be Jesse-voice-ish per CONTEXT D-16 but planner has discretion; Lorem ipsum is allowed)
    - .planning/phases/02-web-shell-theme-engine/02-CONTEXT.md (Phase 2 demo charity is "The Quiet Foundation", Sanity _id = charity-the-quiet-foundation)
    - .planning/STATE.md "Phase 02 P04" entry (demo issue uses bonusType 'jingle' to exercise empty-state path — Phase 4 stub uses 'bigBudget' per CONTEXT D-16)
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/stubs/__init__.py`: `"""Stub fixtures + fake OpenRouter client (Phase 5 swap points)."""`

    Write `packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py` with 14 fixture functions. Each returns a partial DispatchState update with structurally-valid content matching API_CONTRACTS §7. Use Phase 2's demo charity verbatim.

    ```python
    """Deterministic stub fixtures for Phase 4 (CONTEXT D-16).

    Each function returns the FIELDS THIS AGENT WRITES (not the full state) —
    LangGraph merges them into the running state.

    Stub content is Jesse-voice-ish (dry, neutral) but planner-discretion per
    CONTEXT D-16. Phase 5 replaces these with real LLM outputs through the
    same @agent_node interface.

    The fake charity "The Quiet Foundation" was seeded by Phase 2's demo
    content seed (Plan 02-04). Stub Scout reuses it so Phase 4 runs don't
    pollute the charity database with new fake entries on every run.
    """
    from __future__ import annotations
    from typing import Any

    # Phase 2 demo charity (CONTEXT D-16 + Phase 02-04 SUMMARY).
    QUIET_FOUNDATION_NAME = "The Quiet Foundation"
    QUIET_FOUNDATION_SANITY_ID = "charity-the-quiet-foundation"


    # ── Calibrator (CONTEXT D-16 hardcoded bonusType='bigBudget') ─────────────

    def calibrator_output() -> dict:
        return {
            "style_brief": {
                "voice": (
                    "Dry, precise, Fortune 500 gravity. No exclamation marks. "
                    "No winking. Charities treated with the seriousness of "
                    "publicly-traded companies."
                ),
                "constraints": [
                    "Never use 'just' as a hedge.",
                    "No sentence starts with 'And' or 'But'.",
                    "Numbers cited with sources.",
                ],
                "bonusType": "bigBudget",
                "visualDirection": (
                    "Warm cream paper feel; serif display, sans body; "
                    "muted ochre accent."
                ),
                "previousBonusTypes": [],
            },
        }


    # ── Scout (3 candidates; one is the demo charity) ──────────────────────────

    def scout_candidates() -> dict:
        return {
            "candidates": [
                {
                    "name": QUIET_FOUNDATION_NAME,
                    "location": "Burlington, Vermont",
                    "website": "https://example.org/quiet-foundation",
                    "charityNavigatorUrl": None,
                    "guidestarUrl": None,
                    "foundingYear": 1987,
                    "assetRange": "$50K–$100K",
                    "focusArea": "Library acoustic preservation",
                    "missionStatement": (
                        "To preserve and document the acoustic environments of "
                        "America's smallest libraries."
                    ),
                    "scoutSummary": (
                        "Niche but operationally rigorous; thirty-year record "
                        "of recorded library silences."
                    ),
                    "whyOverlooked": (
                        "Mission is so specific that mainstream charity "
                        "aggregators treat it as fringe."
                    ),
                    "advocateArgument": None,
                    "advocateScore": None,
                },
                {
                    "name": "The Backroad Cartography Trust",
                    "location": "Salina, Kansas",
                    "website": "https://example.org/backroad",
                    "charityNavigatorUrl": None,
                    "guidestarUrl": None,
                    "foundingYear": 1972,
                    "assetRange": "$10K–$50K",
                    "focusArea": "Rural roadway mapping",
                    "missionStatement": (
                        "To produce and maintain accurate maps of unimproved "
                        "rural roads in the American Midwest."
                    ),
                    "scoutSummary": (
                        "Volunteer-led since founding; maps are downloaded by "
                        "actual rural municipalities."
                    ),
                    "whyOverlooked": (
                        "Mapping has been swallowed by tech giants; small "
                        "trusts get no funding attention."
                    ),
                    "advocateArgument": None,
                    "advocateScore": None,
                },
                {
                    "name": "Northumbrian Bell Founders' Mutual",
                    "location": "Newcastle, England",
                    "website": "https://example.org/bells",
                    "charityNavigatorUrl": None,
                    "guidestarUrl": None,
                    "foundingYear": 1849,
                    "assetRange": "$100K–$500K",
                    "focusArea": "Historical bell preservation",
                    "missionStatement": (
                        "To preserve and restore the church and civic bells of "
                        "Northumbria."
                    ),
                    "scoutSummary": (
                        "175 years old. No marketing apparatus. Operates from "
                        "two cottages and a foundry."
                    ),
                    "whyOverlooked": (
                        "Heritage preservation is structurally undercapitalized; "
                        "bells especially so."
                    ),
                    "advocateArgument": None,
                    "advocateScore": None,
                },
            ],
        }


    # ── Advocate (scores Scout's 3 candidates) ─────────────────────────────────

    def advocate_scored(candidates: list[dict]) -> dict:
        """Mutate candidates in-place-style: return updated `candidates` list."""
        scored = []
        scores = {QUIET_FOUNDATION_NAME: 9}  # demo charity always wins
        for c in candidates:
            score = scores.get(c["name"], 6)
            scored.append({
                **c,
                "advocateScore": score,
                "advocateArgument": (
                    f"The work of {c['name']} is operationally tight, "
                    f"historically continuous, and structurally underserved by "
                    f"mainstream philanthropy. The audience for this magazine "
                    f"is exactly the audience this institution requires."
                ),
            })
        return {"candidates": scored}


    # ── Editor gate 1 — selects the demo charity OR triggers interrupt ────────
    # The actual selection + interrupt logic lives in agents/editor.py (Plan 07).
    # This fixture provides the post-decision shape.

    def editor_decision_output(winner_name: str) -> dict:
        return {
            "editor_decision": (
                f"Selected {winner_name} on the basis of operational "
                f"longevity, narrative specificity, and the Advocate's "
                f"argument that the audience overlap is unusually clean."
            ),
            "runner_up_notes": (
                "Backroad Cartography Trust and Northumbrian Bell Founders' "
                "Mutual were both viable; the runner-up consideration was "
                "primarily editorial pacing — neither candidate fit the "
                "issue's silence-and-listening visual direction."
            ),
            "deliberation_transcript": (
                "Scout surfaced three structurally-similar institutions, all "
                "with operational records of thirty-plus years. Advocate "
                "scored each on the magazine's audience-fit rubric. Editor "
                "selected the winning candidate on the cleanest match."
            ),
        }


    # ── Researcher ────────────────────────────────────────────────────────────

    def research_output() -> dict:
        return {
            "research": {
                "foundingMoment": (
                    "Founder Margaret Whitlock began the project after "
                    "discovering that the regional library board had no "
                    "audio archive of the buildings it operated."
                ),
                "founderName": "Margaret Whitlock",
                "founderBackground": (
                    "Trained as a librarian. Spent twelve years as a regional "
                    "library director before founding the Foundation."
                ),
                "caseStudySubject": (
                    "The Edenwold Township Library acoustic restoration"
                ),
                "caseStudyOutcome": (
                    "The Foundation produced a fourteen-hour archival recording "
                    "and a structural acoustic report, both of which were used "
                    "in the building's restoration."
                ),
                "verifiedFacts": [
                    "Founded 1987",
                    "Operates from Burlington, Vermont",
                    "Has produced acoustic archives of 41 libraries to date",
                ],
                "sources": [
                    "https://example.org/quiet-foundation/about",
                    "https://example.org/quiet-foundation/annual-report-2024",
                ],
            },
        }


    # ── Section writers ───────────────────────────────────────────────────────

    def origin_story_output() -> dict:
        return {
            "origin_story": {
                "headline": "Whitlock and the Edenwold Tape",
                "body": (
                    "Margaret Whitlock did not set out to start an institution. "
                    "She had been hired, in 1986, as the new director of a "
                    "small regional library system in central Vermont. The "
                    "buildings were old, the budget was small, and the work "
                    "was administrative.\n\n"
                    "One Thursday in February she discovered, while pulling "
                    "an inventory file, that the board had no record of how "
                    "its buildings sounded. No acoustic survey, no recordings, "
                    "no notes. The buildings had been operating for between "
                    "thirty and one hundred years.\n\n"
                    "She bought a tape recorder. The Foundation began."
                ),
            },
        }


    def problem_output() -> dict:
        return {
            "problem_statement": {
                "headline": "The libraries are quiet, and no one is listening.",
                "body": (
                    "The acoustic environment of a public-library building is "
                    "neither a feature nor a problem. It is a record. The "
                    "ceiling tile, the floor pine, the door hinge — all of "
                    "these have a sound. Most are now being replaced.\n\n"
                    "When the buildings are renovated, the sound is lost. "
                    "When the sound is lost, the building loses a dimension "
                    "of its identity that cannot be reconstructed.\n\n"
                    "The Quiet Foundation records what would otherwise be "
                    "thrown away."
                ),
            },
            "problem_pdf_content": (
                "Whitlock, M. (1987). On the silence of small libraries.\n\n"
                "Selected acoustic measurements, Edenwold Township Library, "
                "January 1987."
            ),
        }


    def founder_bio_output() -> dict:
        return {
            "founder_bio": {
                "headline": "Margaret Whitlock",
                "body": (
                    "Margaret Whitlock has been the director of the Quiet "
                    "Foundation since its founding in 1987. She holds an MLS "
                    "from Simmons College and previously directed the "
                    "Northshire Library Council from 1974 to 1986.\n\n"
                    "She lives in Burlington, Vermont, and does not give "
                    "interviews."
                ),
            },
        }


    def case_study_output() -> dict:
        return {
            "case_study": {
                "subjectName": "The Edenwold Township Library",
                "headline": "Edenwold Township Library, 1987–2003",
                "body": (
                    "The Edenwold Township Library was the Foundation's first "
                    "subject. Built in 1903, it was a single-room building "
                    "with a pressed-tin ceiling and a coal stove that had "
                    "been disabled but not removed.\n\n"
                    "The Foundation's fourteen-hour recording of the library "
                    "is the largest single-building acoustic archive the "
                    "Foundation has produced. In 2003, when the township "
                    "voted to demolish the building, the archive was donated "
                    "to the Vermont Historical Society."
                ),
            },
        }


    def game_output() -> dict:
        return {
            "game": {
                "headline": "The Listening Game",
                "description": (
                    "Three audio clips. One is from the Foundation's archive. "
                    "Identify it."
                ),
                # Stub embed: self-contained HTML, no external resources.
                "embedCode": (
                    "<!DOCTYPE html><html><head><meta charset=\"utf-8\">"
                    "<title>Listening Game (stub)</title></head>"
                    "<body><h1>Stub game placeholder</h1>"
                    "<p>The Phase 7 validator will replace this with a real "
                    "game when GameWriter goes live.</p></body></html>"
                ),
            },
        }


    def bonus_output() -> dict:
        # bigBudget shape per API_CONTRACTS §7 BonusContent
        return {
            "bonus": {
                "headline": "The Sound Archive Trailer (Big Budget)",
                "body": (
                    "Storyboard 1: A wide shot of an empty library reading "
                    "room. Audio: rustle of a single page.\n\n"
                    "Storyboard 2: A tracking shot down a row of shelves. "
                    "Audio: the hum of a fluorescent ballast and a settling "
                    "floor beam.\n\n"
                    "Storyboard 3: Cut to Margaret Whitlock, standing in the "
                    "doorway, listening."
                ),
                "lyrics": None,
                "sunoPrompt": None,
            },
        }


    def design_output() -> dict:
        return {
            "theme": {
                "primaryColor": "#3F2E1E",   # warm walnut
                "accentColor": "#B58B3A",    # ochre
                "backgroundColor": "#F4EFE3", # warm cream
                "textColor": "#1E1A12",      # near-black warm
                "fontDisplay": "Crimson Pro",
                "fontBody": "Inter",
                "visualDirection": (
                    "Warm cream paper feel. Serif display, sans body. "
                    "Muted ochre as the only saturated accent."
                ),
            },
        }


    # ── QA (stub: 0 corrections) ──────────────────────────────────────────────

    def qa_output() -> dict:
        return {
            "qa_corrections": [],
        }


    # ── Editor Final (stub: approves) ─────────────────────────────────────────

    def editor_final_output() -> dict:
        return {
            "editor_final_notes": (
                "Approved. No additional connective copy required. "
                "Section pacing acceptable for a 12-minute read."
            ),
        }


    # ── Publisher (stub: placeholder URL + completion timestamp) ──────────────

    def publisher_output() -> dict:
        return {
            "sanity_issue_id": None,  # filled in by the pipeline-end Sanity write
        }
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "
    from eisenbalm_pipeline.stubs.fixtures import (
        calibrator_output, scout_candidates, advocate_scored,
        editor_decision_output, research_output, origin_story_output,
        problem_output, founder_bio_output, case_study_output,
        game_output, bonus_output, design_output, qa_output,
        editor_final_output, publisher_output,
        QUIET_FOUNDATION_NAME, QUIET_FOUNDATION_SANITY_ID,
    )
    cb = calibrator_output()
    assert cb['style_brief']['bonusType'] == 'bigBudget'
    sc = scout_candidates()
    assert len(sc['candidates']) == 3
    assert sc['candidates'][0]['name'] == QUIET_FOUNDATION_NAME
    av = advocate_scored(sc['candidates'])
    assert av['candidates'][0]['advocateScore'] == 9
    th = design_output()
    assert th['theme']['primaryColor'].startswith('#')
    assert qa_output()['qa_corrections'] == []
    assert QUIET_FOUNDATION_SANITY_ID == 'charity-the-quiet-foundation'
    print('OK 14 fixtures importable')
    "</automated>
  </verify>
  <done>
    - `stubs/fixtures.py` exports 14+ fixture functions (calibrator, scout, advocate, editor_decision, research, 7 section writers, qa, editor_final, publisher)
    - Each fixture returns a partial DispatchState dict matching API_CONTRACTS §7 shapes
    - Calibrator returns `style_brief.bonusType == 'bigBudget'` (CONTEXT D-16)
    - Scout returns 3 candidates; first is "The Quiet Foundation" (CONTEXT D-16 — reuses Phase 2 demo charity)
    - Advocate scores demo charity 9, others 6
    - Theme has 6-digit hex values (Phase 5 will validate; Phase 4 just provides valid shape)
    - All fixtures importable under `uv run python -c "..."`
  </done>
</task>

<task type="auto">
  <name>Task 3: Create stubs/fake_openrouter.py (Phase 5 swap-point placeholder)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/stubs/fake_openrouter.py</files>
  <read_first>
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md D-17 (stub mode is the default; toggle is EISENBALM_STUB_MODE; Phase 5 flips default and adds real-mode path; toggle lives in `lib/openrouter_client.py` OR `stubs/fake_openrouter.py` — agent code never branches on it)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md "Forward link Phase 5" (`lib/openrouter_client.py` module path exists (even if stub) — Phase 5 fills in real ChatOpenAI instantiation)
    - .planning/phases/04-pipeline-skeleton/04-CONTEXT.md "Specifics" ("The wrapper decorator is the Phase 4 → Phase 5 contract")
  </read_first>
  <action>
    Write `packages/pipeline/src/eisenbalm_pipeline/stubs/fake_openrouter.py`:

    ```python
    """Fake OpenRouter client — Phase 5 swap point (CONTEXT D-17).

    Phase 4 agents never instantiate this — they directly return stubs/fixtures.
    Phase 5 will:
      1. Create `lib/openrouter_client.py` with the real ChatOpenAI instance.
      2. Add an `EISENBALM_STUB_MODE` branch that returns this fake client when
         the env var is 'true'.
      3. Agents call `await client.acomplete(...)` regardless of stub-or-real;
         the toggle lives in the client construction, not in agent code.

    Cost contract: every fake call records 0 tokens + $0 USD via lib/cost.
    """
    from __future__ import annotations
    from typing import Any


    class FakeOpenRouterClient:
        """Deterministic placeholder. Returns canned strings; records 0 tokens.

        Phase 4 agents do NOT instantiate this. Reserved for Phase 5 toggle
        plumbing (CONTEXT D-17 + D-22).
        """

        def __init__(self) -> None:
            self.model = "fake-openrouter-stub"

        async def acomplete(self, prompt: str, **kwargs: Any) -> dict:
            """Return a canned response with the stub cost shape.

            Returns:
                {
                  "content": "stub-response",
                  "tokens_in": 0,
                  "tokens_out": 0,
                  "usd": 0.0,
                }
            """
            return {
                "content": "stub-response",
                "tokens_in": 0,
                "tokens_out": 0,
                "usd": 0.0,
            }


    def is_stub_mode() -> bool:
        """Helper used by Phase 5's lib/openrouter_client.py to decide which
        client to return. Phase 4 default: True (CONTEXT D-17)."""
        import os
        return os.environ.get("EISENBALM_STUB_MODE", "true").lower() == "true"
    ```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.stubs.fake_openrouter import FakeOpenRouterClient, is_stub_mode; import asyncio; c = FakeOpenRouterClient(); r = asyncio.run(c.acomplete('hello')); assert r['content'] == 'stub-response'; assert r['tokens_in'] == 0; assert r['usd'] == 0.0; assert is_stub_mode() in (True, False); print('OK')"</automated>
  </verify>
  <done>
    - `stubs/fake_openrouter.py` exports `FakeOpenRouterClient` class + `is_stub_mode()` helper
    - `FakeOpenRouterClient().acomplete(...)` returns `{content, tokens_in, tokens_out, usd}` shape
    - All zero-cost values per CONTEXT D-22 stub-mode contract
    - Phase 5 swap-point clearly documented in module docstring
  </done>
</task>

</tasks>

<verification>
After all three tasks:

1. `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents._wrapper import agent_node; from eisenbalm_pipeline.stubs.fixtures import calibrator_output, scout_candidates; from eisenbalm_pipeline.stubs.fake_openrouter import FakeOpenRouterClient; print('OK')"` succeeds.

2. `grep -F "convex_mutation_safe" packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py` succeeds.

3. `grep -F "_force_fail_agent" packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py` succeeds.

4. `grep -F "The Quiet Foundation" packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py` succeeds (Phase 2 D-16 reuse).

5. `cd packages/pipeline && uv run pytest -v` still exits 0 (no regression — Plan 05 tests still all skipped).

The `@agent_node` decorator is the Phase 4 → Phase 5 stability contract per CONTEXT §"Specifics". Plan 07 imports it; Plan 5 only changes agent function bodies.
</verification>

<success_criteria>
- The `@agent_node` decorator is the canonical agent-lifecycle wrapper. Phase 5 only changes function bodies — decorator signature is stable.
- 14 fixture functions exist; every one returns DispatchState-shape-correct partial state.
- Scout's stub charity is the Phase 2 demo charity (CONTEXT D-16 + Phase 2 D-16) — no fake-charity database pollution.
- Calibrator stub returns `bonusType='bigBudget'` (CONTEXT D-16; Phase 5 owns rotation).
- FakeOpenRouterClient exists at the documented Phase 5 swap point.
- PIP-04 evidence: Plan 10 will parametrize tests over fixtures + assert TypedDict shape compliance.
</success_criteria>

<output>
Create `.planning/phases/04-pipeline-skeleton/04-06-stub-fixtures-and-wrapper-SUMMARY.md` recording:
- Confirmation that the `@agent_node` decorator signature matches the Phase 4 → Phase 5 stability contract (CONTEXT D-15 + D-25)
- The exact 15 fixture function names exported from stubs/fixtures.py (Editor gate 1 + Editor Final = 2 fixtures; 14 agents in the brief sequence)
- Forward link to Plan 07 (14 agent modules decorate their bodies with @agent_node and call into these fixtures) and Plan 10 (parametrized tests over the fixtures verify PIP-04)
</output>
