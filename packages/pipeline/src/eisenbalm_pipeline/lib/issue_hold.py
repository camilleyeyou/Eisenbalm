"""Single hold helper for every publish path (quick 261021-ind).

Hold is the only content-side gate left on Publish. Every path that can make
an issue go live (dashboard publish, schedule, publish-manual, POST
/run/{id}/publish, the tick scheduled-publish sweep, the Sanity webhook) goes
through ``is_issue_held`` / ``assert_not_held``.

``_cc.convex_query`` is called through the module attribute so tests that
monkeypatch ``eisenbalm_pipeline.lib.convex_client.convex_query`` apply.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import HTTPException

import eisenbalm_pipeline.lib.convex_client as _cc

log = logging.getLogger(__name__)

WORKSPACE_ID = "eisenbalm"

HELD_DETAIL = {
    "reason": "held",
    "message": "This issue is on hold. Release the hold to publish.",
}


async def is_issue_held(http: Any, issue_number: Optional[int]) -> bool:
    """True iff the issues row for issue_number has held == True.

    A missing row (legacy / never held) is not held. Query errors propagate.
    """
    if issue_number is None:
        return False
    row = await _cc.convex_query(
        http,
        "issues:byIssueNumber",
        {"workspace_id": WORKSPACE_ID, "issueNumber": int(issue_number)},
    )
    return isinstance(row, dict) and row.get("held") is True


async def assert_not_held(http: Any, issue_number: Optional[int]) -> None:
    """Raise 409 {reason:'held'} if held; 503 if the hold state is unknowable (fail closed)."""
    try:
        held = await is_issue_held(http, issue_number)
    except Exception:
        log.exception("assert_not_held: hold lookup failed for issue %s", issue_number)
        raise HTTPException(
            status_code=503,
            detail={
                "reason": "hold_unknown",
                "message": "Could not confirm whether this issue is on hold. Try again.",
            },
        )
    if held:
        raise HTTPException(status_code=409, detail=dict(HELD_DETAIL))
