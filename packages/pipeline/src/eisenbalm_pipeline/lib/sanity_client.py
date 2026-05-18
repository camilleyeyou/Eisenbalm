"""Sanity write client — raw httpx (no maintained Python SDK per research §5).

API base: ``https://{PROJECT_ID}.api.sanity.io/v2024-01-01``
Auth: ``Authorization: Bearer {SANITY_API_TOKEN}``
Mutation endpoint: ``POST /data/mutate/{dataset}``
Asset upload: ``POST /assets/files/{dataset}?filename=...``

Source: docs/API_CONTRACTS.md §2 + 04-RESEARCH.md §5.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Optional

from httpx import AsyncClient
from slugify import slugify

from eisenbalm_pipeline.lib.portable_text import text_to_portable_text

API_VERSION = "v2024-01-01"


def _dataset() -> str:
    return os.environ.get("NEXT_PUBLIC_SANITY_DATASET", "production")


def _auth_headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {os.environ['SANITY_API_TOKEN']}",
        "Content-Type": "application/json",
    }


async def write_charity(http: AsyncClient, charity: dict) -> str:
    """Idempotent createOrReplace for a charity document. Returns _id.

    Deterministic _id = ``charity-{slugify(name)}`` — CONTEXT D-19.
    """
    slug = slugify(charity["name"])
    doc_id = f"charity-{slug}"

    doc: dict[str, Any] = {
        "_type": "charity",
        "_id": doc_id,
        "name": charity["name"],
        "slug": {"_type": "slug", "current": slug},
        "location": charity.get("location", ""),
        "website": charity.get("website", ""),
        "charityNavigatorUrl": charity.get("charityNavigatorUrl"),
        "guidestarUrl": charity.get("guidestarUrl"),
        "foundingYear": charity.get("foundingYear"),
        "assetRange": charity.get("assetRange", ""),
        "focusArea": charity.get("focusArea", ""),
        "missionStatement": charity.get("missionStatement", ""),
        "scoutNotes": charity.get("scoutSummary", ""),
    }
    # Drop None-valued optional fields so Sanity doesn't try to store null.
    doc = {k: v for k, v in doc.items() if v is not None}

    r = await http.post(
        f"/{API_VERSION}/data/mutate/{_dataset()}",
        json={"mutations": [{"createOrReplace": doc}]},
        headers=_auth_headers(),
    )
    r.raise_for_status()
    return doc_id


def _build_bonus(state: dict) -> dict:
    """Mirror API_CONTRACTS §2.2 _build_bonus.

    For ``jingle`` bonus type, include lyrics + sunoPrompt (sunoAudioUrl
    intentionally omitted — Andrew populates after Suno generation).
    """
    bonus = state.get("bonus") or {}
    bonus_type = (state.get("style_brief") or {}).get("bonusType")
    result: dict[str, Any] = {
        "headline": bonus.get("headline", ""),
        "body": text_to_portable_text(bonus.get("body", "")),
    }
    if bonus_type == "jingle":
        result["lyrics"] = bonus.get("lyrics", "")
        result["sunoPrompt"] = bonus.get("sunoPrompt", "")
        # sunoAudioUrl intentionally omitted — Andrew populates
    return result


def _build_pdf_content(state: dict) -> dict:
    """Phase 6 (PDF-01) — pass pdfContent from state through to Sanity.

    Shape locked by agents/problem.py::PdfContent:
      - problemStatement: str  (<=150 words)
      - keyDataPoints: [{stat, source}] * 3 (EXACTLY 3 — Phase 6 PDF layout
        + Sanity Rule.length(3) validator both enforce this)
      - interventionMechanism: str  (<=100 words)

    Defensive default: if state['problem_statement']['pdfContent'] is missing
    (e.g., manually-authored draft, or pre-Phase 5 stub data), emit a 3-empty-
    item shape so the Sanity write doesn't reject.
    """
    section = state.get("problem_statement") or {}
    raw_pdf = section.get("pdfContent") if isinstance(section, dict) else None
    if isinstance(raw_pdf, dict):
        key_data_points = raw_pdf.get("keyDataPoints") or []
        # Normalize to exactly 3 items: truncate excess, pad missing with empties.
        normalized: list[dict] = []
        for i in range(3):
            if i < len(key_data_points) and isinstance(key_data_points[i], dict):
                normalized.append(
                    {
                        "_key": f"kdp-{i}",
                        "stat": key_data_points[i].get("stat", ""),
                        "source": key_data_points[i].get("source", ""),
                    }
                )
            else:
                normalized.append({"_key": f"kdp-{i}", "stat": "", "source": ""})
        return {
            "problemStatement": raw_pdf.get("problemStatement", ""),
            "keyDataPoints": normalized,
            "interventionMechanism": raw_pdf.get("interventionMechanism", ""),
        }
    # No pdfContent in state — default empty 3-item shape.
    return {
        "problemStatement": "",
        "keyDataPoints": [
            {"_key": "kdp-0", "stat": "", "source": ""},
            {"_key": "kdp-1", "stat": "", "source": ""},
            {"_key": "kdp-2", "stat": "", "source": ""},
        ],
        "interventionMechanism": "",
    }


def _build_podcast_description(state: dict) -> str:
    """Placeholder until Phase 9 wires real podcast description logic."""
    charity_name = (state.get("winning_charity") or {}).get("name", "")
    return (
        f"Pipeline deliberation transcript for the issue spotlighting "
        f"{charity_name}."
    )


async def write_issue_draft(
    http: AsyncClient,
    state: dict,
    cost_payload: Optional[dict] = None,
) -> str:
    """One write at pipeline end. Returns Sanity _id.

    ``cost_payload`` is JSON-stringified into ``pipelineMetadata.cost`` per
    CONTEXT D-22 (mirrors modelVersions). Falls back to empty cost shape.

    Source: docs/API_CONTRACTS.md §2.2.
    """
    issue_id = f"issue-{state['issue_number']}"
    candidates = state.get("candidates") or []
    completed_iso = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    doc: dict[str, Any] = {
        "_type": "weeklyIssue",
        "_id": issue_id,
        "issueNumber": state["issue_number"],
        "slug": {"_type": "slug", "current": f"issue-{state['issue_number']}"},
        "publishDate": state["publish_date"],
        "status": "draft",
        "bonusType": (state.get("style_brief") or {}).get("bonusType"),
        "charity": {
            "_type": "reference",
            "_ref": state["winning_charity_sanity_id"],
        },
        "theme": state.get("theme") or {},
        "originStory": {
            "headline": (state.get("origin_story") or {}).get("headline", ""),
            "body": text_to_portable_text(
                (state.get("origin_story") or {}).get("body", "")
            ),
        },
        "problemStatement": {
            "headline": (state.get("problem_statement") or {}).get("headline", ""),
            "body": text_to_portable_text(
                (state.get("problem_statement") or {}).get("body", "")
            ),
            # Phase 6 (PDF-01): pdfContent is the structured source for the
            # WeasyPrint renderer in agents/publisher/pdf.py. Field names match
            # agents/problem.py::PdfContent verbatim. Default to a 3-empty-item
            # shape so Sanity's Rule.length(3) validator passes even for
            # manually-authored drafts (Open Question 5).
            "pdfContent": _build_pdf_content(state),
        },
        "founderBio": {
            "headline": (state.get("founder_bio") or {}).get("headline", ""),
            "body": text_to_portable_text(
                (state.get("founder_bio") or {}).get("body", "")
            ),
        },
        "caseStudy": {
            "subjectName": (state.get("case_study") or {}).get("subjectName", ""),
            "headline": (state.get("case_study") or {}).get("headline", ""),
            "body": text_to_portable_text(
                (state.get("case_study") or {}).get("body", "")
            ),
        },
        "game": {
            "headline": (state.get("game") or {}).get("headline", ""),
            "description": (state.get("game") or {}).get("description", ""),
            "embedCode": (state.get("game") or {}).get("embedCode", ""),
        },
        "bonus": _build_bonus(state),
        "podcast": {
            "deliberationTranscript": state.get("deliberation_transcript", ""),
            "podcastDescription": _build_podcast_description(state),
        },
        "selectionDeliberation": {
            "candidates": [
                {
                    "_key": f"candidate-{i}",
                    "charity": {
                        "_type": "reference",
                        "_ref": f"charity-{slugify(c['name'])}",
                    },
                    "scoutSummary": c.get("scoutSummary", ""),
                    "advocateArgument": c.get("advocateArgument", ""),
                    "advocateScore": c.get("advocateScore"),
                }
                for i, c in enumerate(candidates)
            ],
            "editorDecision": state.get("editor_decision", ""),
            "runnerUpNotes": state.get("runner_up_notes", ""),
        },
        "pipelineMetadata": {
            "runId": state["run_id"],
            "startedAt": state.get("pipeline_started_at"),
            "completedAt": completed_iso,
            "modelVersions": json.dumps(state.get("model_versions", {})),
            # CONTEXT D-22 + D-24: JSON-stringified cost summary.
            # Plan 04 (Sanity schema patch) adds the `cost` text field.
            "cost": json.dumps(cost_payload or {"total": 0.0, "agents": {}}),
        },
    }

    r = await http.post(
        f"/{API_VERSION}/data/mutate/{_dataset()}",
        json={"mutations": [{"createOrReplace": doc}]},
        headers=_auth_headers(),
    )
    r.raise_for_status()
    return issue_id


async def upload_pdf_to_issue(
    http: AsyncClient,
    issue_id: str,
    pdf_bytes: bytes,
    issue_number: int,
) -> None:
    """Phase 6 contract — Phase 4 stub Publisher does NOT call this.

    Function shipped here so Phase 6 only needs to wire it from
    publisher.py.

    Source: 04-RESEARCH.md §5 + docs/API_CONTRACTS.md §2.3.
    """
    filename = f"dispatch-issue-{issue_number}-problem-statement.pdf"

    # 1) Upload the binary
    r = await http.post(
        f"/{API_VERSION}/assets/files/{_dataset()}",
        params={"filename": filename},
        content=pdf_bytes,
        headers={
            "Authorization": f"Bearer {os.environ['SANITY_API_TOKEN']}",
            "Content-Type": "application/pdf",
        },
    )
    r.raise_for_status()
    asset_id = r.json()["document"]["_id"]

    # 2) Patch the issue to reference the asset
    r = await http.post(
        f"/{API_VERSION}/data/mutate/{_dataset()}",
        json={
            "mutations": [
                {
                    "patch": {
                        "id": issue_id,
                        "set": {
                            "problemPdf": {
                                "_type": "file",
                                "asset": {"_type": "reference", "_ref": asset_id},
                            }
                        },
                    }
                }
            ]
        },
        headers=_auth_headers(),
    )
    r.raise_for_status()


# ── Module-level shared client (mirrors convex_client._CLIENT pattern) ────
# The FastAPI lifespan (Plan 09) constructs the shared AsyncClient and calls
# set_client() once at startup. Agents use get_client() to retrieve it
# rather than constructing a new client per call.

_CLIENT: Optional[AsyncClient] = None


def set_client(client: AsyncClient) -> None:
    """Register the shared Sanity AsyncClient. Called from FastAPI lifespan."""
    global _CLIENT
    _CLIENT = client


def get_client() -> AsyncClient:
    """Return the registered shared Sanity AsyncClient; raise if unset."""
    if _CLIENT is None:
        raise RuntimeError(
            "Sanity client not registered. "
            "FastAPI lifespan must call set_client(http) at startup."
        )
    return _CLIENT


async def groq_query(query: str, *, params: Optional[dict] = None) -> list[dict]:
    """Read-only GROQ query against the configured Sanity dataset.

    Phase 5 Calibrator (Plan 05-05) + Scout (Plan 05-06) use this to read
    previously-published issues + previously-featured charities.

    Uses the module-level shared AsyncClient if registered; otherwise
    constructs a one-shot AsyncClient against the API host. The one-shot
    path is used in unit tests / agent code that runs outside the FastAPI
    lifespan. Tolerates Sanity unreachability — agents catch and fall back.

    Returns the ``result`` array from the Sanity Query API response.
    """
    project = os.environ.get("NEXT_PUBLIC_SANITY_PROJECT_ID")
    dataset = _dataset()
    token = os.environ.get("SANITY_API_TOKEN")

    if not project:
        raise RuntimeError(
            "NEXT_PUBLIC_SANITY_PROJECT_ID not set — cannot query Sanity"
        )

    path = f"/{API_VERSION}/data/query/{dataset}"
    request_params: dict[str, Any] = {"query": query}
    if params:
        for k, v in params.items():
            request_params[f"${k}"] = json.dumps(v)

    headers: dict[str, str] = {}
    if token:
        headers["Authorization"] = f"Bearer {token}"

    # Prefer the registered shared client (FastAPI lifespan path); fall back
    # to a one-shot AsyncClient for direct agent + unit-test calls.
    if _CLIENT is not None:
        r = await _CLIENT.get(path, params=request_params, headers=headers)
    else:
        async with AsyncClient(
            base_url=f"https://{project}.api.sanity.io",
            timeout=15.0,
        ) as http:
            r = await http.get(path, params=request_params, headers=headers)

    r.raise_for_status()
    body = r.json()
    return body.get("result") or []


async def set_charity_first_featured(
    http: AsyncClient, charity_id: str, issue_id: str
) -> None:
    """Publisher-only call. See API_CONTRACTS §2.5.

    Phase 4 stub Publisher does NOT invoke this (the issue isn't actually
    published yet).

    Implementation note: uses ``setIfMissing`` rather than API_CONTRACTS
    §2.5's "get + check + set" pattern. ``setIfMissing`` is the
    Sanity-native atomic equivalent: only writes the field if it's not
    already present. Safer under concurrent re-runs and avoids the
    extra GET round-trip. Documented in 04-02 SUMMARY (Claude's
    discretion).
    """
    r = await http.post(
        f"/{API_VERSION}/data/mutate/{_dataset()}",
        json={
            "mutations": [
                {
                    "patch": {
                        "id": charity_id,
                        "setIfMissing": {
                            "firstFeaturedIn": {
                                "_type": "reference",
                                "_ref": issue_id,
                            }
                        },
                    }
                }
            ]
        },
        headers=_auth_headers(),
    )
    r.raise_for_status()
