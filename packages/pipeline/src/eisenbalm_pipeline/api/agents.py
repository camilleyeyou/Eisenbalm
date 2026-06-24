"""Single-agent test-run endpoint (PRM-05).

``POST /agents/{agent_key}/test-run`` evaluates an operator's UNSAVED draft
system prompt against one of four input modes and returns the LLM output plus
cost — WITHOUT writing to any real run table (24-RESEARCH Pattern 5 + Pitfall 8).

Isolation contract (Pitfall 8): this endpoint NEVER invokes the
``@agent_node``-decorated agent function (which would emit ``deliberationEvents``
+ ``agent_runs`` + ``agent_run_payloads`` rows under a synthetic run_id). It
calls ``acomplete`` DIRECTLY with a transient ``run_id = f"test-{uuid4()}"``
and a plain-string response (no ``response_format``). Cost is read from
``acomplete``'s existing usage path — no second cost recorder.

Four input modes (variable-value precedence, highest first):
  1. ``prior_run_id``    — load ``inputSnapshot`` from the real
                           ``agentRuns:payloadByRunIdAgentKey`` query (prior-real).
  2. explicit ``variables`` — operator-supplied manual variable map.
  3. ``SAMPLE_FIXTURES``  — built-in canned fixture per agentKey (D-04).
  (The ``draft_prompt`` / ``draft_user_template`` carry the unsaved draft text —
   PRM-03 — and are token-substituted with the resolved variable values.)

Works in ``EISENBALM_STUB_MODE`` (acomplete short-circuits to a fake client),
so the Plan-01 test_test_run.py cases run offline with no network/model calls.
"""
from __future__ import annotations

import json
import logging
import time
from typing import Any, Optional
from uuid import uuid4

import os

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from eisenbalm_pipeline.agents.qa import judge as judge_module
from eisenbalm_pipeline.api.auth import require_clerk_jwt
from eisenbalm_pipeline.lib import convex_client
from eisenbalm_pipeline.lib.openrouter_client import acomplete

log = logging.getLogger(__name__)

router = APIRouter(prefix="/agents")


# Optional-credentials bearer: unlike the shared ``auth.security`` (auto_error
# True), this does NOT 401/403 on a missing header — so the dev-mode bypass in
# ``require_clerk_jwt`` (CLERK_JWT_ISSUER_DOMAIN unset → {"sub":
# "local-dev-operator"}) is reachable without a header, which the operator
# dashboard and the Plan-01 isolation tests rely on. In a deployed environment
# (CLERK_JWT_ISSUER_DOMAIN set) a missing/invalid token still 401s.
_optional_bearer = HTTPBearer(auto_error=False)


async def _require_operator(
    credentials: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
) -> dict:
    """Auth gate for test-run: dev-mode no-op, prod-mode delegates to Clerk verify.

    Mirrors ``require_clerk_jwt`` semantics but with an OPTIONAL bearer so the
    dev-mode sentinel path is reachable header-free (24-RESEARCH Pattern 5 +
    test_test_run.py: "no auth header is needed for these isolation tests").
    """
    if not os.environ.get("CLERK_JWT_ISSUER_DOMAIN"):
        # Local-dev / stub: same sentinel require_clerk_jwt returns.
        return {"sub": "local-dev-operator"}
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    # Delegate real verification to the canonical Clerk guard.
    return await require_clerk_jwt(credentials)


# ── Canned fixtures (input mode 4, D-04) ──────────────────────────────────────
# One representative variable set per agentKey. Used when neither prior_run_id
# nor explicit variables are supplied. Values are illustrative, not real-run
# data — enough to exercise the prompt end-to-end in a test-run.
SAMPLE_FIXTURES: dict[str, dict[str, str]] = {
    "scout": {"featured_keys": "[]"},
    "advocate": {
        "candidates_json": json.dumps(
            [
                {
                    "name": "The Quiet Foundation",
                    "location": "Vermont",
                    "focusArea": "library acoustics",
                    "missionStatement": "Preserve the acoustic environment of public libraries.",
                }
            ],
            indent=2,
        )
    },
    "calibrator": {
        "VOICE_CONSTRAINTS": "",
        "issue_number": "42",
        "previous_bonus_types": "[]",
        "chosen_bonus_type": "specAd",
    },
    "editor_gate1": {
        "issue_number": "42",
        "candidates_block": json.dumps(
            [{"name": "The Quiet Foundation", "advocateScore": 8}], indent=2
        ),
    },
    "editor_final": {
        "qa_corrections_json": "[]",
        "section_headlines_json": json.dumps({"origin_story": "Origin"}, indent=2),
    },
    "researcher": {
        "charity": "The Quiet Foundation",
        "results_block": "URL: https://example.org\nTitle: About\nContent: A small charity.",
    },
    "game": {
        "charity_name": "The Quiet Foundation",
        "mission_statement": "Preserve the acoustic environment of public libraries.",
    },
    "design": {
        "charity_name": "The Quiet Foundation",
        "visual_direction": "Quiet serif gravity, paper-white restraint.",
    },
    "bonus_big_budget": {
        "charity_name": "The Quiet Foundation",
        "mission_statement": "Preserve the acoustic environment of public libraries.",
        "visual_direction": "Quiet serif gravity, paper-white restraint.",
    },
    "bonus_jingle": {
        "charity_name": "The Quiet Foundation",
        "mission_statement": "Preserve the acoustic environment of public libraries.",
        "visual_direction": "Quiet serif gravity, paper-white restraint.",
    },
    "bonus_spec_ad": {
        "charity_name": "The Quiet Foundation",
        "mission_statement": "Preserve the acoustic environment of public libraries.",
        "visual_direction": "Quiet serif gravity, paper-white restraint.",
    },
}


class TestRunRequest(BaseModel):
    """Body for ``POST /agents/{agent_key}/test-run`` (PRM-05 + 24-RESEARCH Pattern 5)."""

    workspace_id: str
    draft_prompt: str = Field(
        ..., description="The UNSAVED system-prompt draft (PRM-03, D-03)."
    )
    draft_user_template: Optional[str] = Field(
        default=None,
        description="Optional unsaved user-message-template draft (token placeholders).",
    )
    variables: dict[str, str] = Field(
        default_factory=dict,
        description="Manual {token} values. Overridden by prior_run_id when set.",
    )
    prior_run_id: Optional[str] = Field(
        default=None,
        description="When set, load the real inputSnapshot for this run + agentKey.",
    )


class TestRunResponse(BaseModel):
    """Output + cost shape returned by a test-run."""

    output: str
    cost_usd: float
    tokens_in: int
    tokens_out: int
    model: str
    duration_ms: int


def _substitute(template: str, variables: dict[str, str]) -> str:
    """Apply the canonical ``str.replace("{token}", value)`` substitution chain.

    Mirrors the agents' own substitution convention (safe against literal
    braces in prose — never ``str.format``).
    """
    out = template
    for token, value in variables.items():
        out = out.replace("{" + token + "}", str(value))
    return out


async def _load_prior_input(
    prior_run_id: str, agent_key: str
) -> dict[str, str]:
    """Load the real ``inputSnapshot`` for a prior run + agentKey (input mode 1).

    Reads the existing ``agentRuns:payloadByRunIdAgentKey`` query and returns
    the deserialized ``inputSnapshot`` as a variable map. This is a READ — it
    does NOT write to any real table (isolation contract). Returns {} when the
    payload or its inputSnapshot is missing.
    """
    http = convex_client.get_client()
    payload = await convex_client.convex_query(
        http,
        "agentRuns:payloadByRunIdAgentKey",
        {"runId": prior_run_id, "agentKey": agent_key},
    )
    if not payload:
        return {}
    snapshot = payload.get("inputSnapshot")
    if snapshot is None:
        return {}
    if isinstance(snapshot, str):
        try:
            snapshot = json.loads(snapshot)
        except (ValueError, TypeError):
            return {}
    if not isinstance(snapshot, dict):
        return {}
    # Coerce all values to str for the substitution chain.
    return {k: str(v) for k, v in snapshot.items()}


@router.post("/{agent_key}/test-run", response_model=TestRunResponse)
async def test_run_agent(
    agent_key: str,
    body: TestRunRequest,
    _: dict = Depends(_require_operator),
) -> TestRunResponse:
    """Evaluate an unsaved draft prompt for ``agent_key`` and return output + cost.

    Direct ``acomplete`` call — NO graph, NO ``@agent_node`` decorator, NO write
    to ``agent_runs`` / ``agent_run_payloads`` / ``deliberationEvents`` /
    ``pipelineRuns`` (PRM-05 isolation, Pitfall 8).
    """
    # ── Resolve variable values by mode precedence (mode 1 > 2 > 3) ──────────
    variables: dict[str, str]
    if body.prior_run_id:
        try:
            variables = await _load_prior_input(body.prior_run_id, agent_key)
        except Exception as exc:  # noqa: BLE001 — surface a clean 502, never 500-leak
            log.warning(
                "test-run prior_run_id load failed (run=%s key=%s): %r",
                body.prior_run_id,
                agent_key,
                exc,
            )
            raise HTTPException(
                status_code=502,
                detail=f"Failed to load prior run input: {exc}",
            ) from exc
    elif body.variables:
        variables = dict(body.variables)
    else:
        # Mode 4 — canned fixture (empty map when the agentKey has no fixture).
        variables = dict(SAMPLE_FIXTURES.get(agent_key, {}))

    # ── Build the message list from the UNSAVED draft text ────────────────────
    system = _substitute(body.draft_prompt, variables)
    if body.draft_user_template is not None:
        user = _substitute(body.draft_user_template, variables)
    else:
        # Minimal default user message — enough to elicit a response when the
        # operator is testing a system-prompt draft only.
        user = "Run this agent against the supplied input and return your output."
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]

    # ── Direct acomplete call — transient run_id, plain string response ───────
    run_id = f"test-{uuid4()}"
    started = time.monotonic()
    content, usage = await acomplete(
        agent_id=agent_key,
        run_id=run_id,
        messages=messages,
        response_format=None,
    )
    duration_ms = int((time.monotonic() - started) * 1000)

    return TestRunResponse(
        output=str(content),
        cost_usd=float(usage["usd"]),
        tokens_in=int(usage["tokens_in"]),
        tokens_out=int(usage["tokens_out"]),
        model=str(usage["resolved_model"]),
        duration_ms=duration_ms,
    )


# ── Phase 28 PRC-09: voice-rubric scoring (§3A.2) ─────────────────────────────


class ScoreRequest(BaseModel):
    """Body for ``POST /agents/{agent_key}/score`` (PRC-09, API_CONTRACTS §3A.2)."""

    workspace_id: str
    agent_key: str = Field(
        default="",
        description="Advisory/labeling only — the rubric is global. The path "
        "param is canonical; the body value is echo.",
    )
    output: str = Field(
        ..., description="A SINGLE arbitrary agent output to score against the rubric."
    )


class AxisOut(BaseModel):
    """One per-axis score line in the response (§3A.2)."""

    axis: str
    score: float
    pass_: bool = Field(serialization_alias="pass")
    note: str

    model_config = {"populate_by_name": True}


class ScoreResponse(BaseModel):
    """Voice-score response shape (API_CONTRACTS §3A.2)."""

    overall: float
    axes: list[AxisOut]
    rationale: str
    rubric_source: str
    cost_usd: float
    tokens_in: int
    tokens_out: int
    model: str
    duration_ms: int


async def _resolve_rubric(workspace_id: str) -> tuple[str, str]:
    """Resolve the active voice rubric (Convex active row → disk fallback).

    Mirrors ``config_loader._hydrate_asset``: try ``promptVersions:getActive``
    for the global ``rubric`` asset; on a missing row OR any error, fall back to
    the on-disk ``rubric.md`` via ``judge._load_rubric``. Returns
    ``(rubric_text, rubric_source)`` where rubric_source is "convex" | "disk".
    """
    try:
        http = convex_client.get_client()
        row = await convex_client.convex_query(
            http,
            "promptVersions:getActive",
            {"workspace_id": workspace_id, "agentKey": "rubric"},
        )
        if row and row.get("content"):
            return str(row["content"]), "convex"
    except Exception as exc:  # noqa: BLE001 — never 500-leak; fall back to disk
        log.warning(
            "score: active rubric fetch failed (workspace=%s) — disk fallback: %r",
            workspace_id,
            exc,
        )
    return judge_module._load_rubric(), "disk"


@router.post("/{agent_key}/score", response_model=ScoreResponse)
async def score_agent_output(
    agent_key: str,
    body: ScoreRequest,
    _: dict = Depends(_require_operator),
) -> ScoreResponse:
    """Score a SINGLE agent output against the live active voice rubric (PRC-09).

    Loads the SAME rubric the QA judge uses (active ``rubric`` row → disk
    fallback) and runs ``judge.score_output`` — a single ``acomplete`` call over
    ONE output. Advisory ONLY: it NEVER gates, and writes to NO real run / issue
    table. Cost comes from the existing ``acomplete`` usage path (no second
    cost recorder).
    """
    rubric, rubric_source = await _resolve_rubric(body.workspace_id)

    started = time.monotonic()
    voice_score, usage = await judge_module.score_output(
        output=body.output,
        rubric=rubric,
        run_id=f"score-{uuid4()}",
        agent_key=agent_key,
    )
    duration_ms = int((time.monotonic() - started) * 1000)

    return ScoreResponse(
        overall=float(voice_score.overall),
        axes=[
            AxisOut(
                axis=a.axis,
                score=float(a.score),
                pass_=bool(a.pass_),
                note=a.note,
            )
            for a in voice_score.axes
        ],
        rationale=str(voice_score.rationale),
        rubric_source=rubric_source,
        cost_usd=float(usage["usd"]),
        tokens_in=int(usage["tokens_in"]),
        tokens_out=int(usage["tokens_out"]),
        model=str(usage["resolved_model"]),
        duration_ms=duration_ms,
    )
