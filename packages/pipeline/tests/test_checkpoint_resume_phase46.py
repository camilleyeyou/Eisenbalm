"""Phase 46 Wave 0 — checkpoint pause/resume across the two new nodes (SGE-04).

Like ``test_editor_gate_1_resume.py``, this drives the full LangGraph graph and
needs a live AsyncPostgresSaver checkpointer. The module-level skipif below
skips this file with a descriptive reason until ``SUPABASE_POSTGRES_URL`` is
set (matches the existing 04-CONTEXT.md D-36 skip pattern).

Plan 46-07 fills in the real assertions: `story_leads` and `verification_records`
populated by `signal_editor` / `verify_candidates` (pre-interrupt) survive a
pause/resume cycle at `editor_gate_1` (post-resume).
"""
from __future__ import annotations

import os

import pytest

pytestmark = pytest.mark.skipif(
    not os.environ.get("SUPABASE_POSTGRES_URL"),
    reason=(
        "SUPABASE_POSTGRES_URL not set — interrupt/resume requires the "
        "AsyncPostgresSaver checkpointer, provisioned live (mirrors "
        "test_editor_gate_1_resume.py's skip pattern)."
    ),
)


def test_story_leads_and_verification_records_survive_resume() -> None:
    """SGE-04: state populated by signal_editor/verify_candidates pre-interrupt
    is present in the final state post-resume (Postgres checkpoint round-trip)."""
    pytest.skip("filled by 46-07")
