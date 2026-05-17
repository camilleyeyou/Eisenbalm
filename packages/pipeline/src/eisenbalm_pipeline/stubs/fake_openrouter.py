"""Fake OpenRouter client — Phase 5 swap point (CONTEXT D-17).

Phase 4 agents never instantiate this — they directly return stubs/fixtures.
Phase 5 wired the toggle in ``lib/openrouter_client.py``:

  1. ``lib/openrouter_client.py`` owns the canonical ``is_stub_mode()``
     (Plan 05-14 D-22 consolidation — single default ``"false"`` line).
  2. When ``is_stub_mode()`` returns True, ``acomplete`` delegates to
     ``FakeOpenRouterClient`` below.
  3. Agents call ``await acomplete(...)`` regardless of stub-or-real; the
     toggle lives in the client construction, not in agent code.

This module re-exports ``is_stub_mode`` for backward compatibility with
callers that imported from here historically (e.g. ``lib/search_client.py``).

Cost contract: every fake call records 0 tokens + $0 USD via lib/cost
(CONTEXT D-22 stub-mode contract). The fake client never hits the network.
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
    """Re-export of the canonical ``is_stub_mode`` from
    ``lib/openrouter_client.py`` (Plan 05-14 D-22 consolidation).

    Older modules (notably ``lib/search_client.py``) import from here. This
    indirection keeps imports stable while the canonical default value
    lives in exactly one place: ``lib/openrouter_client.py``.
    """
    # Lazy import to break the import cycle (lib/openrouter_client imports
    # FakeOpenRouterClient from this module).
    from eisenbalm_pipeline.lib.openrouter_client import is_stub_mode as _canonical
    return _canonical()
