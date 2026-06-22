"""Phase 24 Wave 0 — RED tests for POST /agents/{agent_key}/test-run (PRM-05).

The single-agent test-run endpoint (api/agents.py, Plan 06) evaluates the
operator's unsaved draft prompt via a DIRECT acomplete call and returns output
+ cost, WITHOUT writing to any real run/issue table (24-RESEARCH Pattern 5 +
Pitfall 8).

RED state: ``eisenbalm_pipeline.api.agents`` does not exist yet. The module
import is guarded so this file import-executes cleanly (collection succeeds);
both tests SKIP-as-RED until Plan 06 lands the router. Once it lands, the
``_AGENTS_ROUTER_AVAILABLE`` guard flips True and the assertions run:

  test_test_run_returns_output_and_cost
    POST in stub mode → 200 with keys output/cost_usd/tokens_in/tokens_out/
    model/duration_ms.

  test_test_run_does_not_write_agent_runs
    Patches convex_mutation_safe and asserts NO call path targets agent_runs /
    agent_run_payloads / deliberationEvents — the isolation contract (Pitfall 8).
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

# Guard the not-yet-existing router so the file collects cleanly (RED).
try:
    from eisenbalm_pipeline.api import agents as agents_module  # noqa: WPS433

    _AGENTS_ROUTER_AVAILABLE = True
except ImportError:
    agents_module = None  # type: ignore[assignment]
    _AGENTS_ROUTER_AVAILABLE = False


# Convex table prefixes that the test-run endpoint MUST NEVER write to.
FORBIDDEN_MUTATION_PREFIXES = (
    "agentRuns",
    "agent_runs",
    "agent_run_payloads",
    "deliberationEvents",
    "pipelineRuns",
)


pytestmark = pytest.mark.skipif(
    not _AGENTS_ROUTER_AVAILABLE,
    reason="Phase 24 Plan 06 not yet landed — api/agents.py test-run router missing (RED)",
)


def _build_app() -> FastAPI:
    """Mount only the agents router on a bare lifespan-free app.

    In dev mode (no CLERK_JWT_ISSUER_DOMAIN) require_clerk_jwt returns the
    sentinel {"sub": "local-dev-operator"} without a network call, so no auth
    header is needed for these isolation tests.
    """
    app = FastAPI()
    app.include_router(agents_module.router)
    return app


async def test_test_run_returns_output_and_cost(monkeypatch):
    """POST /agents/scout/test-run in stub mode → 200 with the full cost shape."""
    monkeypatch.setenv("EISENBALM_STUB_MODE", "true")
    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        r = await c.post(
            "/agents/scout/test-run",
            json={
                "workspace_id": "eisenbalm",
                "draft_prompt": "You are the scout. Find obscure charities.",
                "variables": {"featured_keys": "[]"},
            },
        )
    assert r.status_code == 200, f"expected 200, got {r.status_code}: {r.text}"
    body = r.json()
    for key in ("output", "cost_usd", "tokens_in", "tokens_out", "model", "duration_ms"):
        assert key in body, f"test-run response missing key: {key}"


async def test_test_run_does_not_write_agent_runs(monkeypatch):
    """The test-run MUST NOT pollute agent_runs / agent_run_payloads /
    deliberationEvents (isolation contract, PRM-05 + Pitfall 8).

    We capture every convex_mutation_safe path and assert none targets a
    forbidden table prefix.
    """
    monkeypatch.setenv("EISENBALM_STUB_MODE", "true")

    captured_paths: list[str] = []

    async def _spy(path: str, args: dict) -> None:  # noqa: ANN001
        captured_paths.append(path)

    # Patch the convex emitter in the convex_client module so any indirect
    # write attempt is observed rather than executed.
    monkeypatch.setattr(
        "eisenbalm_pipeline.lib.convex_client.convex_mutation_safe", _spy
    )

    app = _build_app()
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        await c.post(
            "/agents/scout/test-run",
            json={
                "workspace_id": "eisenbalm",
                "draft_prompt": "You are the scout.",
                "variables": {"featured_keys": "[]"},
            },
        )

    polluting = [
        p
        for p in captured_paths
        if any(p.startswith(prefix) or prefix in p for prefix in FORBIDDEN_MUTATION_PREFIXES)
    ]
    assert not polluting, (
        f"test-run wrote to forbidden real-run tables: {polluting}. "
        "The endpoint must call acomplete directly and emit nothing to "
        "agent_runs / agent_run_payloads / deliberationEvents."
    )
