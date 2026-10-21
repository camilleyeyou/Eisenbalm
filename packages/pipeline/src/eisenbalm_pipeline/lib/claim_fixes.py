"""Quick 261021-7aw — remove agent-contradicted claims before the draft is written.

The fact-check agent marks claim rows ``verdict == "contradicted"``. Policy
("correct or remove" -> remove, no extra LLM call, cost containment): the
sentence carrying the contradicted claim is cut from its section body BEFORE
``write_issue_draft``. The claim row is stored with ``status`` 'removed' (cut)
or 'skipped' (sentence could not be located unambiguously) — never 'pending',
so ``convex/lib/claimGate.ts::isOpenBlocking`` never sees a new open row.

Copy-on-write: state dicts are not mutated; updates are returned.
"""
from __future__ import annotations

import copy
import re

# Galley section id (claim row ``sectionName``) -> DispatchState field.
# Camel-case ids are what lib/claims.py emits; kebab-case accepted defensively.
_GALLEY_TO_STATE_FIELD = {
    "originStory": "origin_story",
    "origin-story": "origin_story",
    "problemStatement": "problem_statement",
    "problem": "problem_statement",
    "founderBio": "founder_bio",
    "founder-bio": "founder_bio",
    "caseStudy": "case_study",
    "case-study": "case_study",
    "bonus": "bonus",
}

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


def _locate(body: list, text: str) -> int | None:
    """Index of the ONLY block containing ``text`` exactly once, else None."""
    hits = []
    total = 0
    for i, block in enumerate(body):
        if not isinstance(block, dict) or not isinstance(block.get("text"), str):
            continue
        n = block["text"].count(text)
        if n:
            hits.append(i)
            total += n
    return hits[0] if len(hits) == 1 and total == 1 else None


def apply_claim_fixes(
    state: dict, claim_rows: list[dict]
) -> tuple[dict, list[dict]]:
    """Cut contradicted-claim sentences. Returns ``(state_updates, claim_rows)``
    where contradicted rows carry ``status`` 'removed' | 'skipped' and all
    other rows are untouched (status unset -> insertBatch defaults 'pending')."""
    work: dict[str, list] = {}
    touched: set[str] = set()
    rows = [dict(r) for r in claim_rows]

    for row in rows:
        if row.get("verdict") != "contradicted":
            continue
        row["status"] = "skipped"
        field = _GALLEY_TO_STATE_FIELD.get(row.get("sectionName") or "")
        text = (row.get("text") or "").strip()
        if field is None or not text:
            continue
        if field not in work:
            section = state.get(field)
            body = section.get("body") if isinstance(section, dict) else None
            if not isinstance(body, list):
                continue
            work[field] = copy.deepcopy(body)
        body = work[field]
        idx = _locate(body, text)
        if idx is None:
            continue
        sentences = _SENTENCE_SPLIT.split(body[idx]["text"].strip())
        kept = [s for s in sentences if text not in s]
        if len(kept) == len(sentences):
            continue
        row["status"] = "removed"
        touched.add(field)
        if kept:
            body[idx]["text"] = " ".join(kept)
            continue
        # Whole block was the claim — drop it and keep sibling hints aligned.
        del body[idx]
        for other in rows:
            if _GALLEY_TO_STATE_FIELD.get(other.get("sectionName") or "") != field:
                continue
            hint = other.get("blockIndexHint")
            if hint is None:
                continue
            if hint == idx:
                other.pop("blockIndexHint", None)
            elif hint > idx:
                other["blockIndexHint"] = hint - 1

    updates = {
        field: {**state[field], "body": work[field]} for field in touched
    }
    return updates, rows
