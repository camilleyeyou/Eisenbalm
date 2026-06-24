"""Phase 28 PRC-09 — tests for POST /agents/{agent_key}/score (API_CONTRACTS §3A.2).

The scoring endpoint (api/agents.py) loads the SAME rubric the QA judge uses
(active ``rubric`` row via ``promptVersions:getActive`` → disk ``rubric.md``
fallback) and scores ONE arbitrary agent output via a SINGLE acomplete call,
returning a per-axis breakdown + an overall headline + a 1-2 line rationale +
the rubric_source + cost. It is advisory-only and writes to NO real run table.

Mirrors tests/test_test_run.py's harness: a bare lifespan-free FastAPI app with
only the agents router mounted. In dev mode (no CLERK_JWT_ISSUER_DOMAIN)
``_require_operator`` returns the sentinel {"sub": "local-dev-operator"} without
a network call, so NO auth header is needed (isolation contract, mirrors §3A.1).

Disk-fallback approach: the bare app never calls ``set_client(http)``, so
``convex_client.get_client()`` raises inside ``_resolve_rubric`` and the handler
falls back to the on-disk ``rubric.md`` — exercising rubric_source == "disk"
under stub mode with no live Convex. (acomplete short-circuits to the fake
client under EISENBALM_STUB_MODE so the call runs fully offline.)
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from eisenbalm_pipeline.api import agents as agents_module

# Convex table prefixes the score endpoint MUST NEVER write to (advisory-only).
FORBIDDEN_MUTATION_PREFIXES = (
    "agentRuns",
    "agent_runs",
    "agent_run_payloads",
    "deliberationEvents",
    "pipelineRuns",
)


def _build_app() -> FastAPI:
    """Mount only the agents router on a bare lifespan-free app (no set_client)."""
    app = FastAPI()
    app.include_router(agents_module.router)
    return app


async def test_score_returns_breakdown_overall_rationale_and_cost(monkeypatch):
    """POST /agents/scout/score in stub mode → 200 with overall/axes/rationale/
    rubric_source + the four cost fields. No auth header (dev-mode sentinel)."""
    monkeypatch.setenv("EISENBALM_STUB_MODE", "true")
    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post(
            "/agents/scout/score",
            json={
                "workspace_id": "eisenbalm",
                "agent_key": "scout",
                "output": "The Quiet Foundation preserves library acoustics.",
            },
        )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
    body = r.json()

    # Shape (§3A.2): per-axis breakdown + overall + rationale + rubric_source.
    assert isinstance(body["overall"], (int, float))
    assert isinstance(body["axes"], list)
    assert isinstance(body["rationale"], str)
    assert body["rubric_source"] in ("convex", "disk")

    # Four cost fields from the existing acomplete usage path (no 2nd recorder).
    for key in ("cost_usd", "tokens_in", "tokens_out", "model"):
        assert key in body, f"score response missing cost key: {key}"


async def test_score_uses_disk_rubric_fallback_when_convex_unavailable(monkeypatch):
    """With no live Convex (bare app, no set_client), the rubric resolves from
    the on-disk rubric.md — rubric_source == 'disk' (active→disk fallback)."""
    monkeypatch.setenv("EISENBALM_STUB_MODE", "true")
    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post(
            "/agents/founder_bio/score",
            json={"workspace_id": "eisenbalm", "output": "Some founder bio prose."},
        )
    assert r.status_code == 200, r.text
    assert r.json()["rubric_source"] == "disk"


async def test_score_does_not_write_real_run_tables(monkeypatch):
    """The score endpoint is advisory-only — it MUST NOT write to
    agent_runs / agent_run_payloads / deliberationEvents / pipelineRuns."""
    monkeypatch.setenv("EISENBALM_STUB_MODE", "true")

    captured_paths: list[str] = []

    async def _spy(path: str, args: dict) -> None:  # noqa: ANN001
        captured_paths.append(path)

    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.convex_client.convex_mutation_safe", _spy
    )

    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        await c.post(
            "/agents/scout/score",
            json={"workspace_id": "eisenbalm", "output": "some text"},
        )

    polluting = [
        p
        for p in captured_paths
        if any(prefix in p for prefix in FORBIDDEN_MUTATION_PREFIXES)
    ]
    assert not polluting, (
        f"score wrote to forbidden real-run tables: {polluting}. The endpoint "
        "must call acomplete (via score_output) directly and emit nothing."
    )
