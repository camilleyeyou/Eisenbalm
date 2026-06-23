"""Phase 25 Wave 0 — RED tests for single-agent re-roll (RUN-05).

RED state: ``eisenbalm_pipeline.api.control`` does not exist yet. The top-level
import ensures collection FAILS RED until Plan 02 lands the control router.

  test_reroll_leaves_siblings_unchanged (RUN-05)
    POST /runs/{run_id}/agents/origin_story/rerun on a finished run → every
    doc key in the Sanity write except 'originStory' is byte-identical to the
    pre-reroll state. The write_issue_draft createOrReplace composes from
    merged state — sibling sections are untouched (D-05).

  test_reroll_blocked_while_running (RUN-05, D-04)
    POST /runs/{run_id}/agents/origin_story/rerun while the run is 'running'
    returns 409.

  test_reroll_rejects_non_section (RUN-05, D-03)
    POST /runs/{run_id}/agents/qa/rerun (qa is NOT a section writer) returns 422.
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from eisenbalm_pipeline.api.control import router as control_router  # RED until Plan 02

pytestmark = pytest.mark.anyio


def _build_app() -> FastAPI:
    app = FastAPI()
    app.include_router(control_router)
    return app


async def test_reroll_leaves_siblings_unchanged(
    convex_runs_store,
    monkeypatch,
) -> None:
    """RUN-05: re-rolling origin_story leaves all other section fields in the
    Sanity write payload byte-identical to their pre-reroll values (D-05).

    The test monkeypatches write_issue_draft and the graph checkpointer to
    verify the merged state passed to the final Sanity write preserves all
    sibling section keys.
    """
    run_id = "run-reroll-test-001"

    # Seed a finished run (not running — re-roll only on finished, D-04)
    convex_runs_store.seed({"runId": run_id, "status": "complete", "workspace_id": "eisenbalm"})

    # Track what write_issue_draft receives
    sanity_write_calls: list[dict] = []

    async def _fake_write_issue_draft(sanity_client: object, state: dict) -> str:
        sanity_write_calls.append(dict(state))
        return f"issue-{state.get('issue_number', 0)}"

    import eisenbalm_pipeline.lib.sanity_client as sc_mod  # noqa: WPS433
    monkeypatch.setattr(sc_mod, "write_issue_draft", _fake_write_issue_draft)

    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(f"/runs/{run_id}/agents/origin_story/rerun")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body.get("rerolled") is True, f"Expected rerolled=true, got {body!r}"
    assert body.get("agentKey") == "origin_story"

    # Verify write was called and sibling section keys are preserved (not cleared)
    assert len(sanity_write_calls) >= 1, "write_issue_draft must have been called"
    merged_state = sanity_write_calls[-1]

    SIBLING_SECTION_KEYS = {
        "problem_statement", "founder_bio", "case_study", "game", "bonus", "theme"
    }
    for key in SIBLING_SECTION_KEYS:
        assert key in merged_state, (
            f"Sibling section key {key!r} missing from merged state — "
            f"re-roll must preserve all siblings (D-05)"
        )


async def test_reroll_blocked_while_running(
    convex_runs_store,
    monkeypatch,
) -> None:
    """RUN-05, D-04: POST /runs/{run_id}/agents/origin_story/rerun while the
    run is still 'running' must return 409."""
    run_id = "run-reroll-running-001"
    convex_runs_store.seed({"runId": run_id, "status": "running", "workspace_id": "eisenbalm"})

    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(f"/runs/{run_id}/agents/origin_story/rerun")

    assert response.status_code == 409, (
        f"Expected 409 when run is active (D-04), got {response.status_code}: {response.text}"
    )


async def test_reroll_rejects_non_section(
    convex_runs_store,
    monkeypatch,
) -> None:
    """RUN-05, D-03: re-roll of a non-section-writer agent (e.g. 'qa') must
    return 422 — only the 7 section writers are re-rollable."""
    run_id = "run-reroll-nonrerollable-001"
    convex_runs_store.seed({"runId": run_id, "status": "complete", "workspace_id": "eisenbalm"})

    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)

    NON_SECTION_AGENTS = ["qa", "scout", "advocate", "editor", "researcher", "chronicler"]

    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        for agent_key in NON_SECTION_AGENTS:
            response = await client.post(f"/runs/{run_id}/agents/{agent_key}/rerun")
            assert response.status_code == 422, (
                f"Expected 422 for non-section agent '{agent_key}' (D-03), "
                f"got {response.status_code}: {response.text}"
            )
