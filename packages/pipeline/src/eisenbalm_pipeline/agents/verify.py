"""Phase 5 verify_research — standalone non-LLM node (D-11).

Inserted between Researcher and the parallel section-writer fan-out by
graph/builder.py. Reads state['research']['founderName'] +
['founderNameSourceUrl'] (and the subject equivalents), fetches the source
URL via httpx (10s timeout, follow_redirects, desktop User-Agent), strips
HTML to text via selectolax, and sets *Verified bools via case-insensitive
substring + last-name fallback.

NOT an @agent_node:
  - No LLM call.
  - No deliberationEvents emission (per CONTEXT D-11 explicit note).
  - No cost recording (no tokens consumed).

Conservative posture: httpx errors (timeout, 4xx/5xx, SSL, DNS) leave
verified=False. False negatives are acceptable; false positives (wrong
name confirmed) ship factual errors and are not (AGT-08).
"""
from __future__ import annotations

import logging

import httpx
from selectolax.parser import HTMLParser

from eisenbalm_pipeline.graph.state import DispatchState

log = logging.getLogger(__name__)


_FETCH_TIMEOUT_S: float = 10.0
_USER_AGENT: str = "Mozilla/5.0 (compatible; EisenbalmBot/1.0)"


async def _fetch_text(url: str) -> str | None:
    """GET the URL and return HTML-stripped text. Returns None on any failure.

    httpx errors (timeout, 4xx/5xx, SSL, DNS, connection) and parsing errors
    all collapse into a None return — AGT-08 conservative fallback.
    """
    if not url:
        return None
    try:
        async with httpx.AsyncClient(
            timeout=_FETCH_TIMEOUT_S, follow_redirects=True,
        ) as client:
            r = await client.get(url, headers={"User-Agent": _USER_AGENT})
            r.raise_for_status()
        tree = HTMLParser(r.text)
        parts = [n.text() for n in tree.css("body *") if n.text()]
        return " ".join(parts) if parts else None
    except Exception as exc:  # noqa: BLE001 — never let fetch failures break the pipeline
        log.warning("verify_research: fetch failed url=%r err=%r", url, exc)
        return None


def _name_in_text(name: str, text: str) -> bool:
    """Case-insensitive substring + last-name fallback (D-11).

    Conservative: empty name OR empty text => False.
    """
    if not name or not text:
        return False
    if name.lower() in text.lower():
        return True
    tokens = name.strip().split()
    if not tokens:
        return False
    last = tokens[-1]
    return last.lower() in text.lower()


async def verify_research(state: DispatchState) -> dict:
    """Set founderNameVerified + subjectNameVerified on state['research'].

    NOT an @agent_node — emits no deliberationEvent, makes no LLM call.
    Returns a state-update dict (LangGraph merges into DispatchState).
    """
    research = dict(state.get("research") or {})

    for name_field, url_field, verified_field in [
        ("founderName", "founderNameSourceUrl", "founderNameVerified"),
        ("subjectName", "subjectNameSourceUrl", "subjectNameVerified"),
    ]:
        name = research.get(name_field)
        url = research.get(url_field)
        if name and url:
            text = await _fetch_text(url)
            research[verified_field] = bool(text and _name_in_text(name, text))
        else:
            research[verified_field] = False

    return {"research": research}
