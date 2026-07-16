"""Phase 46 Plan 05 — verify_candidates: standalone non-LLM node (SGE-03).

Inserted between Scout and Advocate by graph/builder.py (D-01 chain:
calibrator -> signal_editor -> scout -> verify_candidates -> advocate). For
every candidate in ``state['candidates']`` runs three deterministic checks —
domain-live, registration-ID reachability, and an obscurity/press scan — and
kills a candidate ONLY on a DEFINITIVE failure (D-12). Every check and every
record is persisted; nothing is silently dropped.

NOT an @agent_node:
  - No LLM call, no cost recording (mirrors agents/verify.py::verify_research).
  - No deliberationEvents emission.

Conservative posture (D-12, mirrors verify.py's docstring verbatim): any
transient/ambiguous failure (timeout, 5xx, SSL/DNS blip, rate-limit) marks
that check ``None``/unverified and NEVER kills the candidate. False
negatives (an obscure, legitimate org marked unverified) are acceptable;
false positives (killing a good org on a network blip) are not.
"""
from __future__ import annotations

import logging
import time
from typing import Optional

import httpx
from slugify import slugify

from eisenbalm_pipeline.graph.state import DispatchState, VerificationRecord
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
from eisenbalm_pipeline.lib.search_client import web_search

log = logging.getLogger(__name__)


_FETCH_TIMEOUT_S: float = 10.0
_USER_AGENT: str = "Mozilla/5.0 (compatible; EisenbalmBot/1.0)"

# Obscurity press-hit thresholds (RESEARCH Open Question 1) — tuning items,
# no numeric precedent exists anywhere in the codebase. Bounded search is
# max_results=5 (mirrors Scout's default). <=OBSCURITY_PASS_MAX_HITS ⇒ pass
# (genuinely obscure); >=OBSCURITY_FAIL_MIN_HITS ⇒ fail (clearly not obscure
# enough — a definitive kill signal per D-12); the middle band (3 hits) is
# deliberately left as `unverified` — never a kill on an ambiguous count.
OBSCURITY_PASS_MAX_HITS: int = 2
OBSCURITY_FAIL_MIN_HITS: int = 4


def _charity_id_for(name: str) -> str:
    """Deterministic candidate id — SAME join key as Sanity _id /
    pitchLog.charityId / agentVotes.charityId (agents/advocate.py::_charity_id_for).
    """
    return f"charity-{slugify(name)}"


async def _check_domain_live(url: Optional[str]) -> Optional[bool]:
    """GET the candidate's website. DNS-resolves + 2xx/3xx (after redirects)
    => True (live). A definitive 4xx => False. ANY other exception (timeout,
    5xx, SSL, DNS blip, connection error) => None (unverified — D-12).

    Mirrors verify.py::_fetch_text's try/except shape exactly.
    """
    if not url:
        return None
    try:
        async with httpx.AsyncClient(
            timeout=_FETCH_TIMEOUT_S, follow_redirects=True,
        ) as client:
            r = await client.get(url, headers={"User-Agent": _USER_AGENT})
        if 200 <= r.status_code < 400:
            return True
        if 400 <= r.status_code < 500:
            # Definitive: the server answered and said "not found"/"denied".
            return False
        # 5xx and anything else unexpected — transient, not definitive.
        return None
    except Exception as exc:  # noqa: BLE001 — never let fetch failures break the pipeline
        log.warning("verify_candidates: domain-live fetch failed url=%r err=%r", url, exc)
        return None


async def _check_registration(candidate: dict) -> tuple[Optional[str], bool]:
    """Reachability of charityNavigatorUrl/guidestarUrl (D-11 — no new
    paid/government EIN API). Returns (registrationId, registrationVerified).

    - Neither field present at all => (None, False) — a DEFINITIVE "no
      registration found" (D-12 kill signal).
    - A URL is present and reachable (2xx/3xx) => (url, True).
    - A URL is present but unreachable due to a transient error (timeout,
      5xx, SSL/DNS blip, or a definitive 4xx) => (url, False) — the
      candidate is NOT killed on this alone since a URL DOES exist; only
      the "neither field present" case is a definitive kill.
    """
    url = candidate.get("charityNavigatorUrl") or candidate.get("guidestarUrl")
    if not url:
        return None, False
    try:
        async with httpx.AsyncClient(
            timeout=_FETCH_TIMEOUT_S, follow_redirects=True,
        ) as client:
            r = await client.get(url, headers={"User-Agent": _USER_AGENT})
        return url, bool(200 <= r.status_code < 400)
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "verify_candidates: registration fetch failed url=%r err=%r", url, exc,
        )
        return url, False


async def _obscurity_press_scan(name: Optional[str]) -> Optional[int]:
    """Bounded Tavily search on the org name (D-11). Returns the hit count;
    ANY exception => None (unverified — never a kill on a search blip).
    """
    if not name:
        return None
    try:
        results = await web_search(name, max_results=5)
        return len(results)
    except Exception as exc:  # noqa: BLE001
        log.warning("verify_candidates: press scan failed name=%r err=%r", name, exc)
        return None


def _apply_kill_rule(
    domain_live: Optional[bool],
    registration: tuple[Optional[str], bool],
    press_hits: Optional[int],
) -> tuple[bool, Optional[str]]:
    """Kill ONLY on a DEFINITIVE failure (D-12). ``None`` values (transient
    errors) NEVER contribute to a kill — only an explicit False/definitive
    signal does.
    """
    registration_id, registration_verified = registration

    if domain_live is False:
        return True, "domain does not resolve / returned a definitive 4xx"

    if registration_id is None and not registration_verified:
        return True, "no registration record found (no charityNavigatorUrl or guidestarUrl)"

    if press_hits is not None and press_hits >= OBSCURITY_FAIL_MIN_HITS:
        return True, f"clearly not obscure enough — {press_hits} press hits found"

    return False, None


def _obscurity_verdict(press_hits: Optional[int]) -> str:
    if press_hits is None:
        return "unknown"
    if press_hits <= OBSCURITY_PASS_MAX_HITS:
        return "obscure"
    if press_hits >= OBSCURITY_FAIL_MIN_HITS:
        return "not-obscure"
    return "unknown"


def _record_status(
    domain_live: Optional[bool],
    registration: tuple[Optional[str], bool],
    press_hits: Optional[int],
    killed: bool,
) -> str:
    """'fail' when killed; 'pass' only when every check definitively
    succeeded; 'unverified' whenever any check is transient/ambiguous —
    never a kill signal on its own (D-12)."""
    if killed:
        return "fail"
    _registration_id, registration_verified = registration
    if domain_live is True and registration_verified is True and press_hits is not None:
        return "pass"
    return "unverified"


async def verify_candidates(state: DispatchState) -> dict:
    """Run the three deterministic checks per candidate, kill only definitive
    failures, persist every VerificationRecord, filter survivors.

    NOT an @agent_node — emits no deliberationEvent, makes no LLM call.
    Returns a state-update dict: {"candidates": survivors,
    "verification_records": records} (LangGraph merges into DispatchState).
    """
    run_id = state.get("run_id")
    candidates = state.get("candidates") or []

    survivors: list[dict] = []
    records: list[VerificationRecord] = []

    for c in candidates:
        name = c.get("name") or ""
        domain_live = await _check_domain_live(c.get("website"))
        registration = await _check_registration(c)
        press_hits = await _obscurity_press_scan(name)

        killed, kill_reason = _apply_kill_rule(domain_live, registration, press_hits)
        registration_id, registration_verified = registration

        record: VerificationRecord = {
            "candidateId": _charity_id_for(name),
            "candidateName": name,
            "domainLive": bool(domain_live),
            "registrationId": registration_id,
            "registrationVerified": registration_verified,
            "obscurity": {
                "pressHits": press_hits or 0,
                "verdict": _obscurity_verdict(press_hits),
            },
            "status": _record_status(domain_live, registration, press_hits, killed),  # type: ignore[typeddict-item]
            "killed": killed,
            "killReason": kill_reason,
            "checkedAt": int(time.time() * 1000),
        }
        records.append(record)

        await convex_mutation_safe(
            "verificationRecords:insert",
            {
                "runId": run_id,
                "candidateId": record["candidateId"],
                "candidateName": record["candidateName"],
                "domainLive": record["domainLive"],
                "registrationId": record["registrationId"],
                "registrationVerified": record["registrationVerified"],
                "pressHits": record["obscurity"]["pressHits"],
                "obscurityVerdict": record["obscurity"]["verdict"],
                "status": record["status"],
                "killed": record["killed"],
                "killReason": record["killReason"],
                "checkedAt": record["checkedAt"],
            },
        )

        if killed:
            log.info(
                "verify_candidates: killed candidate=%r reason=%r", name, kill_reason,
            )
        else:
            survivors.append(c)

    return {"candidates": survivors, "verification_records": records}
