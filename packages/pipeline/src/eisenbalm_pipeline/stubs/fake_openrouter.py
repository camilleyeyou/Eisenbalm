"""Fake OpenRouter client — Phase 5 swap point (CONTEXT D-17).

Phase 4 agents never instantiate this — they directly return stubs/fixtures.
Phase 5 will:

  1. Create ``lib/openrouter_client.py`` with the real ChatOpenAI instance.
  2. Add an ``EISENBALM_STUB_MODE`` branch that returns this fake client when
     the env var is ``'true'``.
  3. Agents call ``await client.acomplete(...)`` regardless of stub-or-real;
     the toggle lives in the client construction, not in agent code.

Cost contract: every fake call records 0 tokens + $0 USD via lib/cost
(CONTEXT D-22 stub-mode contract). The fake client never hits the network.
"""
from __future__ import annotations

import os
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
            ``{"content": "stub-response", "tokens_in": 0,
               "tokens_out": 0, "usd": 0.0}``
        """
        return {
            "content": "stub-response",
            "tokens_in": 0,
            "tokens_out": 0,
            "usd": 0.0,
        }


def is_stub_mode() -> bool:
    """Helper used by Phase 5's ``lib/openrouter_client.py`` to decide which
    client to return. Phase 4 default: ``True`` (CONTEXT D-17).
    """
    return os.environ.get("EISENBALM_STUB_MODE", "true").lower() == "true"
