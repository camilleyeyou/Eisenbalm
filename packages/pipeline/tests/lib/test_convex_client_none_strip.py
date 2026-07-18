"""Bug A (quick 260718-7dk) — convex_mutation must strip None-valued args
before serialization, so Convex's ``v.optional(v.string())`` sees an ABSENT
key rather than an explicit JSON ``null`` (which it rejects with
ArgumentValidationError, silently dropped by convex_mutation_safe's
try/except).

Self-contained: does NOT use the env-gated fixtures in tests/conftest.py
(mirrors the respx idiom already used in tests/agents/test_verify_candidates.py).
"""
from __future__ import annotations

import json

import httpx
import pytest
import respx

from eisenbalm_pipeline.lib.convex_client import convex_mutation


@pytest.mark.asyncio
async def test_none_valued_args_omitted_from_wire_body(monkeypatch: pytest.MonkeyPatch) -> None:
    """RED (must FAIL pre-fix): a guarded-path mutation whose args carry
    None-valued optionals must send an HTTP body that OMITS those keys
    entirely. Non-None keys are preserved unchanged, and the injected
    pipelineSecret is still present on the wire."""
    monkeypatch.setenv("CONVEX_DEPLOY_KEY", "test-deploy-key")
    monkeypatch.setenv("PIPELINE_CONVEX_SECRET", "test-secret")

    async with respx.mock(assert_all_called=True) as router:
        route = router.post("http://test/api/mutation").mock(
            return_value=httpx.Response(200, json={"status": "success", "value": "id_1"})
        )
        async with httpx.AsyncClient(base_url="http://test") as http:
            await convex_mutation(
                http,
                "storyLeads:insert",
                {
                    "runId": "r1",
                    "premise": "p",
                    "brandRiskReason": None,
                    "repetitionWarning": None,
                    "recommended": True,
                },
            )

    sent = json.loads(route.calls.last.request.content)
    assert "brandRiskReason" not in sent["args"]
    assert "repetitionWarning" not in sent["args"]
    assert sent["args"]["runId"] == "r1"
    assert sent["args"]["premise"] == "p"
    assert sent["args"]["recommended"] is True
    assert sent["args"]["pipelineSecret"] == "test-secret"


@pytest.mark.asyncio
async def test_none_valued_args_omitted_on_unguarded_path_no_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A non-guarded path (not in _PIPELINE_SECRET_GUARDED_PATHS) also omits
    None-valued keys, AND does NOT get pipelineSecret injected — guarded-set
    behavior is preserved."""
    monkeypatch.setenv("CONVEX_DEPLOY_KEY", "test-deploy-key")
    monkeypatch.setenv("PIPELINE_CONVEX_SECRET", "test-secret")

    async with respx.mock(assert_all_called=True) as router:
        route = router.post("http://test/api/mutation").mock(
            return_value=httpx.Response(200, json={"status": "success", "value": "id_2"})
        )
        async with httpx.AsyncClient(base_url="http://test") as http:
            await convex_mutation(
                http,
                "agentRuns:noop",
                {"runId": "r2", "someOptional": None},
            )

    sent = json.loads(route.calls.last.request.content)
    assert "someOptional" not in sent["args"]
    assert sent["args"]["runId"] == "r2"
    assert "pipelineSecret" not in sent["args"]
