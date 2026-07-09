"""Tests for POST /eval/shadow-run (EVL-05, docs/API_CONTRACTS.md §38.4).

Mirrors tests/api/test_eval_scenarios.py's bare-FastAPI-app harness: a
lifespan-free app with only the eval router mounted. In dev mode (no
CLERK_JWT_ISSUER_DOMAIN) ``_require_operator`` returns the sentinel
{"sub": "local-dev-operator"} without a network call, so no auth header is
needed for these tests.

The D-12 isolation proof mirrors tests/test_test_run.py's
FORBIDDEN_MUTATION_PREFIXES pattern, extended with "pitchLog" + "charities"
(the two Convex mutations scout() calls that neither test-run nor score ever
needed to guard against, since neither of those endpoints calls Scout) AND an
explicit assertion that Sanity's write_charity is never invoked (Pitfall 2 —
a coverage gap the existing test-run/score isolation tests don't need).
"""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from eisenbalm_pipeline.agents.scout import CharityCandidate, ScoutBatchOutput
from eisenbalm_pipeline.api import eval as eval_module
from eisenbalm_pipeline.lib.search_client import SearchResult

# Convex table prefixes the shadow-run endpoint MUST NEVER write to.
# Extends tests/test_test_run.py's FORBIDDEN_MUTATION_PREFIXES with
# "pitchLog" + "charities" — the two mutations scout() calls that neither
# test-run nor score ever needed to guard against (neither calls Scout).
FORBIDDEN_MUTATION_PREFIXES = (
    "agentRuns",
    "agent_runs",
    "agent_run_payloads",
    "deliberationEvents",
    "pipelineRuns",
    "pitchLog",
    "charities",
)


def _make_candidate(name: str, website: str) -> CharityCandidate:
    return CharityCandidate(
        name=name,
        location="NYC",
        website=website,
        assetRange="<$1M",
        focusArea="education",
        missionStatement="m",
        scoutSummary="s",
        whyOverlooked="o",
    )


def _build_app() -> FastAPI:
    """Mount only the eval router on a bare lifespan-free app."""
    app = FastAPI()
    app.include_router(eval_module.router)
    return app


def _discovery_patches(candidates: list[CharityCandidate], featured_keys: list[str]):
    """Patch context managers driving discover_candidates() through a
    controlled candidate list — mirrors tests/agents/test_scout_discover.py."""
    batch = ScoutBatchOutput(candidates=candidates)
    usage = {
        "tokens_in": 10,
        "tokens_out": 5,
        "usd": 0.001,
        "resolved_model": "anthropic/claude-haiku-4-5",
    }
    tavily_results = [
        SearchResult(url=c.website, title=c.name, content="...", score=0.9)
        for c in candidates
    ]
    return (
        patch(
            "eisenbalm_pipeline.agents.scout.web_search",
            AsyncMock(return_value=tavily_results),
        ),
        patch(
            "eisenbalm_pipeline.agents.scout.acomplete",
            AsyncMock(return_value=(batch, usage)),
        ),
        patch(
            "eisenbalm_pipeline.agents.scout._load_registry_keys",
            AsyncMock(return_value=featured_keys),
        ),
        patch(
            "eisenbalm_pipeline.agents.scout.get_convex_http",
            return_value=object(),  # non-None sentinel so the None branch isn't taken
        ),
    )


async def test_shadow_run_returns_candidates_preview() -> None:
    """POST /eval/shadow-run -> 200 with {candidates, featuredKeysCount}."""
    candidates = [
        _make_candidate(f"Org {i}", f"https://org{i}.example") for i in range(3)
    ]
    featured_keys = ["blocked org"]

    p1, p2, p3, p4 = _discovery_patches(candidates, featured_keys)
    app = _build_app()
    transport = ASGITransport(app=app)
    with p1, p2, p3, p4:
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post("/eval/shadow-run", json={"workspace_id": "eisenbalm"})

    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    assert "candidates" in body
    assert len(body["candidates"]) == 3
    assert body["featuredKeysCount"] == len(featured_keys)


async def test_shadow_run_isolation_no_convex_run_table_writes_no_sanity_write() -> None:
    """D-12 (hard requirement): the shadow-run endpoint writes NOTHING to a
    Convex run table (pitchLog/charities included) and never calls Sanity's
    write_charity — no pipelineRuns, no pitchLog, no charities upsert, no
    publish, no pipeline mutation of any kind."""
    candidates = [
        _make_candidate(f"Org {i}", f"https://org{i}.example") for i in range(3)
    ]

    p1, p2, p3, p4 = _discovery_patches(candidates, [])

    captured_convex_paths: list[str] = []

    async def _convex_spy(path: str, args: dict) -> None:  # noqa: ANN001
        captured_convex_paths.append(path)

    def _write_charity_raises(*args, **kwargs):  # noqa: ANN002, ANN003
        raise AssertionError(
            "shadow-run MUST NEVER call write_charity (D-12 isolation contract)"
        )

    app = _build_app()
    transport = ASGITransport(app=app)
    with (
        p1,
        p2,
        p3,
        p4,
        # Belt: the actually-reachable bound references inside scout.py.
        patch("eisenbalm_pipeline.agents.scout.convex_mutation_safe", _convex_spy),
        patch("eisenbalm_pipeline.agents.scout.write_charity", _write_charity_raises),
        # Suspenders: the lib-module source, per Pitfall 2's explicit instruction.
        patch(
            "eisenbalm_pipeline.lib.convex_client.convex_mutation_safe", _convex_spy
        ),
        patch(
            "eisenbalm_pipeline.lib.sanity_client.write_charity",
            _write_charity_raises,
        ),
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            r = await c.post("/eval/shadow-run", json={"workspace_id": "eisenbalm"})

    assert r.status_code == 200, r.text

    polluting = [
        p
        for p in captured_convex_paths
        if any(prefix in p for prefix in FORBIDDEN_MUTATION_PREFIXES)
    ]
    assert not polluting, (
        f"shadow-run wrote to forbidden real-run tables: {polluting}. The "
        "endpoint must call discover_candidates() directly and emit nothing "
        "to pipelineRuns / pitchLog / charities / agent_runs / "
        "deliberationEvents."
    )
