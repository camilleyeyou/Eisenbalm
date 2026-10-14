"""Phase 51.1 (VRD-01/VRD-07) — batched claim verdicts. API_CONTRACTS §51.1.6.

One structured fact_check call per <=120 claims (in practice one per run),
judging every extracted claim against the Researcher's already-retrieved
passages (state['research_sources']). No web search. The model returns claim
and passage INDEXES only; code maps passage index -> real URL, so a
hallucinated source URL is structurally impossible (same discipline as
agents/researcher.py::_map_claims, §35.1).
"""
from __future__ import annotations

import logging
import time
from collections import Counter
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError

from eisenbalm_pipeline.lib.openrouter_client import acomplete

log = logging.getLogger(__name__)

FACT_CHECK_AGENT_ID = "fact_check"
CLAIMS_PER_CALL = 120
EVIDENCE_MAX_CHARS = 400
PASSAGE_PROMPT_CHARS = 1200
CLAIM_PROMPT_CHARS = 500
NO_SOURCES_EVIDENCE = "No retrieved source passages were available to check this claim."
VERDICT_FIELDS = ("verdict", "verdictEvidence", "verdictSources", "verdictAt", "verdictModel")

FACT_CHECK_SYSTEM_PROMPT = (
    "You are a fact-checker for a magazine. You receive numbered source passages [S0], [S1], ... "
    "and numbered claims [C0], [C1], .... For EACH claim return one verdict:\n"
    "- verified: a numbered passage states the claim. Cite it in sourceIndexes.\n"
    "- contradicted: a numbered passage directly conflicts with the claim (a different number, "
    "date, name or fact). Cite the conflicting passage in sourceIndexes and quote the conflict "
    "in evidence.\n"
    "- unverifiable: no passage addresses the claim, or the passages are ambiguous.\n"
    "Never use outside knowledge. Judge only against the passages given. Do not mark a claim "
    "contradicted because a passage omits it — omission is unverifiable. Keep evidence under 300 "
    "characters. Return claimIndex, verdict, evidence and sourceIndexes only; sourceIndexes are "
    "passage numbers, never URLs."
)


class ClaimVerdict(BaseModel):
    claimIndex: int
    verdict: Literal["verified", "contradicted", "unverifiable"]
    evidence: str = ""
    sourceIndexes: list[int] = Field(default_factory=list)


class VerdictBatch(BaseModel):
    verdicts: list[ClaimVerdict] = Field(default_factory=list)


def _build_messages(chunk: list[dict], sources: list[dict], research: dict) -> list[dict[str, str]]:
    passages = "\n\n".join(
        f"[S{s['index']}] URL: {s.get('url', '')}\nTitle: {s.get('title', '')}\n"
        f"Content: {(s.get('content') or '')[:PASSAGE_PROMPT_CHARS]}"
        for s in sources
    )
    user = "SOURCE PASSAGES:\n" + passages
    summary = (research or {}).get("summary")
    if summary:
        user += "\n\nRESEARCH SUMMARY (context only — not a citable source):\n" + str(summary)[:1500]
    user += "\n\nCLAIMS:\n" + "\n".join(
        f"[C{j}] ({row.get('sectionName') or 'unknown'}) {(row.get('text') or '')[:CLAIM_PROMPT_CHARS]}"
        for j, row in enumerate(chunk)
    )
    return [
        {"role": "system", "content": FACT_CHECK_SYSTEM_PROMPT},
        {"role": "user", "content": user},
    ]


async def attach_verdicts(
    run_id: str,
    claim_rows: list[dict],
    sources: list[dict],
    research: dict | None = None,
) -> list[dict]:
    """Return copies of ``claim_rows`` with verdict fields attached (see module doc)."""
    rows = [dict(r) for r in claim_rows]
    if not rows:
        return []
    now = int(time.time() * 1000)

    if not sources:
        for row in rows:
            row["verdict"] = "unverifiable"
            row["verdictEvidence"] = NO_SOURCES_EVIDENCE
            row["verdictSources"] = []
            row["verdictAt"] = now
        log.info("attach_verdicts: no sources; %d claims marked unverifiable (no LLM call)", len(rows))
        return rows

    url_by_index = {
        int(s["index"]): s["url"]
        for s in sources
        if isinstance(s, dict) and isinstance(s.get("index"), int) and s.get("url")
    }

    counts: Counter[str] = Counter()
    downgrades = 0
    for k in range(0, len(rows), CLAIMS_PER_CALL):
        chunk = rows[k : k + CLAIMS_PER_CALL]
        out, usage = await acomplete(
            agent_id=FACT_CHECK_AGENT_ID,
            run_id=run_id,
            messages=_build_messages(chunk, sources, research or {}),
            response_format=VerdictBatch,
        )
        if isinstance(out, dict):
            verdicts = out.get("verdicts") or []
        else:
            verdicts = getattr(out, "verdicts", None) or []
        seen: set[int] = set()
        for item in verdicts:
            if isinstance(item, dict):
                try:
                    item = ClaimVerdict.model_validate(item)
                except ValidationError:
                    continue
            if not (0 <= item.claimIndex < len(chunk)) or item.claimIndex in seen:
                continue
            seen.add(item.claimIndex)
            urls = [url_by_index[i] for i in dict.fromkeys(item.sourceIndexes) if i in url_by_index]
            verdict = item.verdict
            if verdict in ("contradicted", "verified") and not urls:
                log.info(
                    "attach_verdicts: downgraded %s -> unverifiable (no valid cited passage) claim=%d",
                    verdict, k + item.claimIndex,
                )
                verdict = "unverifiable"
                downgrades += 1
            row = rows[k + item.claimIndex]
            row["verdict"] = verdict
            row["verdictEvidence"] = (item.evidence or "")[:EVIDENCE_MAX_CHARS]
            row["verdictSources"] = urls
            row["verdictAt"] = now
            model = (usage or {}).get("resolved_model")
            if model:
                row["verdictModel"] = model
            counts[verdict] += 1

    log.info(
        "attach_verdicts: total=%d verdicted=%d %s downgrades=%d unverdicted=%d",
        len(rows), sum(counts.values()), dict(counts), downgrades, len(rows) - sum(counts.values()),
    )
    return rows
