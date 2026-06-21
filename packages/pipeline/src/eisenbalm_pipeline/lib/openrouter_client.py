"""Phase 5 — single async OpenRouter client used by every agent (D-14, AGT-17).

Routes every LLM call through ``acomplete(agent_id, messages, ...)``.
Records token usage + USD into ``lib.cost.CostRecorder`` keyed by run_id.
Captures the resolved model ID from OpenRouter's response_metadata into
``state['model_versions']`` (AGT-17 observability surface).

Honors ``EISENBALM_STUB_MODE`` (D-22):
  - true (Phase 4 PIP-06 regression): delegates to FakeOpenRouterClient,
    records 0 tokens / $0, returns canned content.
  - false (Phase 5 runtime default, flipped in Plan 05-14): hits OpenRouter
    live via langchain-openai ChatOpenAI.

Plan 05-14 (D-22) consolidation: ``is_stub_mode()`` lives in THIS module —
``stubs/fake_openrouter.py`` re-exports it for callers (e.g. ``lib/search_client.py``)
that import from there for historical reasons. There is exactly ONE place
where the env-var default ``"false"`` lives: the ``is_stub_mode()`` body
immediately below.

Structured output strategy (D-14): when ``response_format`` is a Pydantic
BaseModel subclass, uses ``ChatOpenAI.with_structured_output(...)`` with a
one-regenerate retry on OutputParserException. Second failure propagates;
``@agent_node`` wrapper catches and sets pipelineRuns.status='failed'.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Optional, Type

from pydantic import BaseModel

from eisenbalm_pipeline.lib.cost import get_recorder, record_cost
from eisenbalm_pipeline.lib.llm_config import (
    MODEL_BY_AGENT,
    SAMPLING_BY_AGENT,
    MAX_TOKENS_BY_AGENT,
)

log = logging.getLogger(__name__)


# ── EISENBALM_STUB_MODE (D-22 — canonical location, Plan 05-14 flip) ────


def is_stub_mode() -> bool:
    """Return True iff ``EISENBALM_STUB_MODE`` resolves to truthy.

    Plan 05-14 (D-22) flips the default from ``"true"`` → ``"false"``: real
    mode is now the default. Setting ``EISENBALM_STUB_MODE=true`` explicitly
    still routes through ``stubs/fake_openrouter.FakeOpenRouterClient`` and
    preserves the Phase 4 PIP-06 regression smoke.

    Canonical location: this module. ``stubs/fake_openrouter.is_stub_mode``
    re-exports this function so older callers (e.g. ``lib/search_client.py``)
    keep working without import-path churn.
    """
    return os.environ.get("EISENBALM_STUB_MODE", "false").lower() == "true"


# Lazy import to keep stub-mode tests free of FakeOpenRouterClient overhead
# until they actually need it.
from eisenbalm_pipeline.stubs.fake_openrouter import FakeOpenRouterClient  # noqa: E402


# ── Real-mode helpers ───────────────────────────────────────────────────


def _build_chat_model(agent_id: str) -> Any:
    """Return a configured langchain-openai ChatOpenAI for OpenRouter.

    Imported lazily so stub-mode tests don't require langchain-openai's
    transitive runtime deps to resolve.
    """
    from langchain_openai import ChatOpenAI

    if agent_id not in MODEL_BY_AGENT:
        raise KeyError(
            f"agent_id={agent_id!r} not in MODEL_BY_AGENT "
            f"(lib/llm_config.py). Add it there or fix the caller."
        )
    model_id = MODEL_BY_AGENT[agent_id]
    sampling = SAMPLING_BY_AGENT.get(agent_id, {"temperature": 0.7})
    kwargs: dict[str, Any] = {**sampling}
    max_tokens = MAX_TOKENS_BY_AGENT.get(agent_id)
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens

    # D-22.1: pin OpenRouter to Anthropic for all anthropic/* models so it never
    # routes to Amazon Bedrock or Google Vertex (those don't support OpenAI-style
    # response_format, breaking structured output). Live-mode regression caught
    # by Plan 05-15 first-real-run: Calibrator failed with "output_config.format:
    # Extra inputs are not permitted" when OpenRouter fell back to Bedrock.
    # Enable OpenRouter usage accounting so usage.cost (authoritative USD)
    # surfaces in response_metadata["token_usage"]["cost"]. See RESEARCH §Q2.
    extra_body: dict[str, Any] = {"usage": {"include": True}}
    if model_id.startswith("anthropic/"):
        extra_body["provider"] = {
            "order": ["Anthropic"],
            "allow_fallbacks": False,
        }

    return ChatOpenAI(
        model=model_id,
        openai_api_base="https://openrouter.ai/api/v1",
        openai_api_key=os.environ["OPENROUTER_API_KEY"],
        extra_body=extra_body,
        **kwargs,
    )


def _usage_from_message(msg: Any, fallback_model: str) -> dict[str, Any]:
    """Extract tokens + authoritative USD + resolved model from an AIMessage.

    Works for both the structured ``raw`` AIMessage and the plain-text result.
    USD comes from OpenRouter usage accounting at
    ``response_metadata["token_usage"]["cost"]`` (usage_metadata drops cost).
    """
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


# ── Public API ──────────────────────────────────────────────────────────


async def acomplete(
    *,
    agent_id: str,
    run_id: str,
    messages: list[dict[str, str]],
    response_format: Optional[Type[BaseModel]] = None,
) -> tuple[Any, dict[str, Any]]:
    """Single async LLM call site for every Phase 5 agent.

    Args:
        agent_id: One of the keys in ``MODEL_BY_AGENT`` (e.g. "calibrator").
        run_id: ``state['run_id']``. Used to key cost recording + check_cap.
        messages: List of ``{"role": "system"|"user", "content": str}``.
        response_format: Optional Pydantic BaseModel subclass. When set,
            uses ChatOpenAI.with_structured_output + one regenerate-on-fail.

    Returns:
        ``(content, usage_dict)`` where ``content`` is either a string
        (raw text response) or an instance of ``response_format`` (parsed
        Pydantic object), and ``usage_dict`` contains
        ``{tokens_in, tokens_out, usd, resolved_model}``.

    Raises:
        CostCapExceeded: If cumulative run cost has hit the cap (D-08).
            Caller's ``@agent_node`` wrapper translates to status='failed'.
        OutputParserException: If response_format parsing fails twice
            in a row (one regenerate already attempted).
    """
    # Stub-mode short-circuit (D-22).
    if is_stub_mode():
        fake = FakeOpenRouterClient()
        # Stub returns a dict; if response_format requested, return a default
        # instance so downstream code path is identical to real mode.
        fake_out = await fake.acomplete(prompt=str(messages))
        content: Any
        if response_format is not None:
            try:
                # Pydantic v2: model_construct skips validation — fine for stub.
                content = response_format.model_construct()
            except Exception:
                content = fake_out["content"]
        else:
            content = fake_out["content"]
        record_cost(run_id, agent_id, tokens_in=0, tokens_out=0, usd=0.0)
        return content, {
            "tokens_in": 0,
            "tokens_out": 0,
            "usd": 0.0,
            "resolved_model": "fake-openrouter-stub",
        }

    # Real mode.
    llm = _build_chat_model(agent_id)

    if response_format is not None:
        # include_raw=True returns {"raw", "parsed", "parsing_error"} so we can
        # read real token usage + USD off the underlying AIMessage. CRITICAL:
        # a schema miss no longer raises — it surfaces as parsed=None (D-14).
        structured = llm.with_structured_output(response_format, include_raw=True)
        try:
            result = await structured.ainvoke(messages)
        except Exception as exc:  # transport/transient only (schema misses don't raise now)
            log.warning("acomplete %s: invoke error, retrying once: %r", agent_id, exc)
            result = await structured.ainvoke(messages)
        if result["parsed"] is None:  # schema/refusal miss — corrective retry (D-14)
            log.warning(
                "acomplete %s: schema miss, retrying once: %r",
                agent_id, result.get("parsing_error"),
            )
            retry_messages = messages + [{
                "role": "user",
                "content": (
                    f"Previous output failed schema validation: "
                    f"{result['parsing_error']}. "
                    f"Return JSON strictly matching the schema."
                ),
            }]
            result = await structured.ainvoke(retry_messages)
        parsed = result["parsed"]
        raw = result["raw"]
        if parsed is None:  # second failure — preserve D-14 propagate contract
            raise result["parsing_error"] or RuntimeError(
                f"{agent_id}: structured output failed schema twice"
            )

        u = _usage_from_message(raw, MODEL_BY_AGENT[agent_id])
        record_cost(
            run_id, agent_id,
            tokens_in=u["tokens_in"], tokens_out=u["tokens_out"], usd=u["usd"],
        )
        recorder = get_recorder(run_id)
        recorder._last_agent = agent_id
        await recorder.check_cap()
        return parsed, u

    # Plain string response path.
    result = await llm.ainvoke(messages)
    u = _usage_from_message(result, MODEL_BY_AGENT[agent_id])
    content = result.content if hasattr(result, "content") else result

    record_cost(
        run_id, agent_id,
        tokens_in=u["tokens_in"], tokens_out=u["tokens_out"], usd=u["usd"],
    )
    recorder = get_recorder(run_id)
    recorder._last_agent = agent_id
    await recorder.check_cap()
    return content, u


# ── State helper for model_versions (AGT-17) ────────────────────────────


def record_model_version(state: dict, agent_id: str, resolved_model: str) -> None:
    """Mutate ``state['model_versions']`` to record the resolved model.

    Agents call this after each acomplete() call to populate the AGT-17
    observability surface; the final dict is JSON-serialized into
    ``weeklyIssue.pipelineMetadata.modelVersions`` by the Publisher.
    """
    mv = state.get("model_versions") or {}
    mv[agent_id] = resolved_model
    state["model_versions"] = mv
