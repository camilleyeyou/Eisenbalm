"""Phase 31 (EDT-01/EDT-02/EDT-03) — content-patch endpoint family.

Clerk-JWT-guarded routes that let the dispatch-control dashboard mutate a
run's Sanity `weeklyIssue` document via scoped dotted-path patches, instead
of Studio. This is the ONLY server-side write boundary for operator content
edits — see docs/API_CONTRACTS.md §31.

Every route resolves `run_id -> sanityIssueId` (identical to `api/review.py`),
targets the PLAIN Sanity `_id` (`issue-{n}` — this app has no Sanity
drafts/publish documents, §31.1), applies the D-08 validation split
(theme/game HARD-block; editorial structural floor WARN-only), and writes
exactly one truncated before/after audit row per mutation (D-09).

Asset uploads (EDT-03) use raw binary request bodies — `python-multipart`
is not an installed dependency (RESEARCH Pitfall 3), so FastAPI's
multipart form-parsing helpers are never used here.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

import eisenbalm_pipeline.lib.convex_client as _cc
import eisenbalm_pipeline.lib.sanity_client as _sc
from eisenbalm_pipeline.api.control import _emit_audit, _require_clerk_jwt_control
from eisenbalm_pipeline.lib.agent_wrapper import _truncate
from eisenbalm_pipeline.lib.portable_text import (
    compose_section_body,
    text_to_portable_text,
)
from eisenbalm_pipeline.lib.sanity_client import (
    get_issue_draft,
    patch_issue_field,
    upload_asset,
)
from eisenbalm_pipeline.lib.structural_floor import structural_floor_warnings
from eisenbalm_pipeline.lib.theme_validation import (
    validate_game_embed,
    validate_theme_fields,
)

log = logging.getLogger(__name__)
router = APIRouter()

_LONG_READ_SECTIONS = frozenset(
    {"originStory", "problemStatement", "founderBio", "caseStudy"}
)


# ── Shared resolve + audit helpers ─────────────────────────────────────────


async def _resolve_sanity_id(
    request: Request, run_id: str, claims: dict
) -> tuple[Any, Any, str, str]:
    """Resolve run_id -> sanityIssueId (clone of api/review.py's lookup).

    Returns (convex_http, sanity_http, sanity_id, actor). Raises 404 if the
    run does not exist, 409 {reason:"no_sanity_issue"} if sanityIssueId is
    unset. Every content mutation targets the PLAIN issue-{n} Sanity id
    resolved here — never a Sanity drafts/publish document id (§31.1).
    """
    convex_http = getattr(request.app.state, "convex_http", None)
    sanity_http = getattr(request.app.state, "sanity_http", None)
    actor = claims.get("sub") or "unknown"

    run = await _cc.convex_query(convex_http, "pipelineRuns:byRunId", {"runId": run_id})
    if run is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Run not found: {run_id}",
        )

    sanity_id = run.get("sanityIssueId")
    if not sanity_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "reason": "no_sanity_issue",
                "message": "No Sanity issue ID found for this run.",
            },
        )
    return convex_http, sanity_http, sanity_id, actor


async def _fetch_before(sanity_http: Any, sanity_id: str, projection_expr: str) -> Any:
    """Read a single field's current value via a scoped GROQ projection.

    Used for 'before' audit snapshots on fields not already surfaced by
    get_issue_draft() (e.g. problemStatement.pdfContent).
    """
    rows = await _sc._groq(
        sanity_http,
        f'*[_id == $id][0]{{"value": {projection_expr}}}',
        {"id": sanity_id},
    )
    doc = rows[0] if rows else {}
    return doc.get("value")


async def _patch_fields(
    sanity_http: Any,
    *,
    issue_id: str,
    fields: dict[str, Any],
    if_revision_id: str,
) -> str:
    """Scoped multi-field dotted-path patch in ONE mutation.

    Mirrors sanity_client.patch_issue_field but allows several sibling
    fields to be set atomically in a single revision-guarded mutation — used
    by the variant-shaped /bonus endpoint so unrelated bonus sub-fields
    (sunoAudioUrl, storyboards) are never clobbered, and so a second field
    write never races the revision bumped by a first separate call.
    """
    payload = {
        "mutations": [
            {
                "patch": {
                    "id": issue_id,
                    "ifRevisionID": if_revision_id,
                    "set": fields,
                }
            }
        ],
        "returnIds": True,
    }
    r = await sanity_http.post(
        f"/{_sc.API_VERSION}/data/mutate/{_sc._dataset()}",
        json=payload,
        headers=_sc._auth_headers(),
    )
    if r.status_code == 409:
        raise HTTPException(
            status_code=409,
            detail={
                "reason": "revision_mismatch",
                "message": (
                    "This section changed since you loaded it. Reload and "
                    "reapply your edit."
                ),
            },
        )
    r.raise_for_status()
    return await _sc._fetch_issue_rev(sanity_http, issue_id)


# ── Request body models ────────────────────────────────────────────────────


class _BlockRow(BaseModel):
    type: str
    text: str


class _SectionBody(BaseModel):
    ifRevisionID: str
    blocks: list[_BlockRow]


class _HeadlineBody(BaseModel):
    ifRevisionID: str
    headline: str


class _ThemeBody(BaseModel):
    ifRevisionID: str
    primaryColor: str
    accentColor: str
    backgroundColor: str
    textColor: str
    fontDisplay: str
    fontBody: str
    visualDirection: str = ""


class _GameBody(BaseModel):
    ifRevisionID: str
    headline: str
    description: str
    embedCode: str


class _KeyDataPoint(BaseModel):
    stat: str
    source: str


class _PdfDataPointsBody(BaseModel):
    ifRevisionID: str
    problemStatement: str
    keyDataPoints: list[_KeyDataPoint]
    interventionMechanism: str


class _TurnBody(BaseModel):
    speaker: str
    text: str


class _ConversationBody(BaseModel):
    ifRevisionID: str
    turns: list[_TurnBody]


class _TranscriptBody(BaseModel):
    ifRevisionID: str
    transcript: str


class _BonusBody(BaseModel):
    ifRevisionID: str
    variant: Literal["specAd", "bigBudget", "jingle"]
    blocks: Optional[list[_BlockRow]] = None  # specAd
    headline: Optional[str] = None  # bigBudget / jingle
    body: Optional[str] = None  # bigBudget / jingle
    lyrics: Optional[str] = None  # jingle
    sunoPrompt: Optional[str] = None  # jingle


# ── PATCH /issues/{run_id}/sections/{section_name} — EDT-01 ────────────────


@router.patch("/issues/{run_id}/sections/{section_name}")
async def patch_section(
    request: Request,
    run_id: str,
    section_name: str,
    body: _SectionBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Scoped patch of one long-read section's `body`. WARN-only structural
    floor (never blocks — D-08)."""
    if section_name not in _LONG_READ_SECTIONS:
        raise HTTPException(
            status_code=400,
            detail={
                "reason": "invalid_section",
                "message": f"Unknown section: {section_name}",
            },
        )

    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    blocks = [b.model_dump() for b in body.blocks]
    warnings = structural_floor_warnings(blocks)

    draft = await get_issue_draft(sanity_http, sanity_id)
    before = draft.get("sections", {}).get(section_name, {})

    new_rev = await patch_issue_field(
        sanity_http,
        issue_id=sanity_id,
        field_path=f"{section_name}.body",
        value=compose_section_body(blocks),
        if_revision_id=body.ifRevisionID,
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="content.section_patched",
        resource_type="issue",
        resource_id=sanity_id,
        before=_truncate(json.dumps(before, default=str)),
        after=_truncate(json.dumps(blocks, default=str)),
    )
    return {"revisionId": new_rev, "warnings": warnings}


# ── PATCH /issues/{run_id}/headlines/{section_name} — EDT-02 ───────────────


@router.patch("/issues/{run_id}/headlines/{section_name}")
async def patch_headline(
    request: Request,
    run_id: str,
    section_name: str,
    body: _HeadlineBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Scoped patch of one long-read section's `headline` string."""
    if section_name not in _LONG_READ_SECTIONS:
        raise HTTPException(
            status_code=400,
            detail={
                "reason": "invalid_section",
                "message": f"Unknown section: {section_name}",
            },
        )

    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    draft = await get_issue_draft(sanity_http, sanity_id)
    before = draft.get("sections", {}).get(section_name, {}).get("headline", "")

    new_rev = await patch_issue_field(
        sanity_http,
        issue_id=sanity_id,
        field_path=f"{section_name}.headline",
        value=body.headline,
        if_revision_id=body.ifRevisionID,
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="content.headline_patched",
        resource_type="issue",
        resource_id=sanity_id,
        before=_truncate(before or ""),
        after=_truncate(body.headline),
    )
    return {"revisionId": new_rev}


# ── PATCH /issues/{run_id}/theme — EDT-02 (HARD-validate) ──────────────────


@router.patch("/issues/{run_id}/theme")
async def patch_theme(
    request: Request,
    run_id: str,
    body: _ThemeBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Full theme-object replace. HARD-blocks invalid hex/font (D-08)."""
    theme_dict = body.model_dump(exclude={"ifRevisionID"})
    failed = validate_theme_fields(theme_dict)
    if failed:
        raise HTTPException(
            status_code=422,
            detail={
                "reason": "validation_failed",
                "message": "Invalid theme field(s).",
                "fields": failed,
            },
        )

    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    draft = await get_issue_draft(sanity_http, sanity_id)
    before = draft.get("theme", {})

    new_rev = await patch_issue_field(
        sanity_http,
        issue_id=sanity_id,
        field_path="theme",
        value=theme_dict,
        if_revision_id=body.ifRevisionID,
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="content.theme_patched",
        resource_type="issue",
        resource_id=sanity_id,
        before=_truncate(json.dumps(before, default=str)),
        after=_truncate(json.dumps(theme_dict, default=str)),
    )
    return {"revisionId": new_rev}


# ── PATCH /issues/{run_id}/game — EDT-02 (HARD-validate embed size) ────────


@router.patch("/issues/{run_id}/game")
async def patch_game(
    request: Request,
    run_id: str,
    body: _GameBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Full game-object replace. HARD-blocks embeds over 50KB (D-08)."""
    if not validate_game_embed(body.embedCode):
        raise HTTPException(
            status_code=422,
            detail={
                "reason": "validation_failed",
                "message": "Game embed exceeds 50KB.",
                "fields": ["embedCode"],
            },
        )

    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    draft = await get_issue_draft(sanity_http, sanity_id)
    before = draft.get("game", {})

    value = {
        "headline": body.headline,
        "description": body.description,
        "embedCode": body.embedCode,
    }
    new_rev = await patch_issue_field(
        sanity_http,
        issue_id=sanity_id,
        field_path="game",
        value=value,
        if_revision_id=body.ifRevisionID,
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="content.game_patched",
        resource_type="issue",
        resource_id=sanity_id,
        before=_truncate(json.dumps(before, default=str)),
        after=_truncate(json.dumps(value, default=str)),
    )
    return {"revisionId": new_rev}


# ── PATCH /issues/{run_id}/pdf-data-points — EDT-02 ─────────────────────────


@router.patch("/issues/{run_id}/pdf-data-points")
async def patch_pdf_data_points(
    request: Request,
    run_id: str,
    body: _PdfDataPointsBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Full problemStatement.pdfContent replace. keyDataPoints MUST be
    exactly 3 rows (Sanity Rule.length(3) validator)."""
    if len(body.keyDataPoints) != 3:
        raise HTTPException(
            status_code=400,
            detail={
                "reason": "invalid_key_data_points",
                "message": "keyDataPoints must contain exactly 3 items.",
            },
        )

    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    before = await _fetch_before(sanity_http, sanity_id, "problemStatement.pdfContent")

    value = {
        "problemStatement": body.problemStatement,
        "keyDataPoints": [
            {"_key": f"kdp-{i}", "stat": kdp.stat, "source": kdp.source}
            for i, kdp in enumerate(body.keyDataPoints)
        ],
        "interventionMechanism": body.interventionMechanism,
    }
    new_rev = await patch_issue_field(
        sanity_http,
        issue_id=sanity_id,
        field_path="problemStatement.pdfContent",
        value=value,
        if_revision_id=body.ifRevisionID,
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="content.pdf_data_points_patched",
        resource_type="issue",
        resource_id=sanity_id,
        before=_truncate(json.dumps(before, default=str)),
        after=_truncate(json.dumps(value, default=str)),
    )
    return {"revisionId": new_rev}


# ── PATCH /issues/{run_id}/bonus — EDT-01/02 (variant-shaped, D-05) ────────


@router.patch("/issues/{run_id}/bonus")
async def patch_bonus(
    request: Request,
    run_id: str,
    body: _BonusBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Variant-shaped bonus patch — specAd -> body, bigBudget -> headline+body,
    jingle -> headline+body+lyrics+sunoPrompt. 409s if `variant` doesn't match
    the issue's stored top-level `bonusType`."""
    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    draft = await get_issue_draft(sanity_http, sanity_id)
    stored_variant = draft.get("bonusType")
    if stored_variant and body.variant != stored_variant:
        raise HTTPException(
            status_code=409,
            detail={
                "reason": "wrong_bonus_variant",
                "message": (
                    f"This issue's bonus type is '{stored_variant}', "
                    f"not '{body.variant}'."
                ),
            },
        )

    before = draft.get("bonus", {})
    warnings: list[str] = []
    fields: dict[str, Any] = {}

    if body.headline is not None:
        fields["bonus.headline"] = body.headline

    if body.variant == "specAd":
        if body.blocks is not None:
            blocks = [b.model_dump() for b in body.blocks]
            warnings = structural_floor_warnings(blocks)
            fields["bonus.body"] = compose_section_body(blocks)
    elif body.variant == "bigBudget":
        if body.body is not None:
            fields["bonus.body"] = text_to_portable_text(body.body)
    elif body.variant == "jingle":
        if body.body is not None:
            fields["bonus.body"] = text_to_portable_text(body.body)
        if body.lyrics is not None:
            fields["bonus.lyrics"] = body.lyrics
        if body.sunoPrompt is not None:
            fields["bonus.sunoPrompt"] = body.sunoPrompt

    if not fields:
        return {"revisionId": body.ifRevisionID, "warnings": []}

    new_rev = await _patch_fields(
        sanity_http,
        issue_id=sanity_id,
        fields=fields,
        if_revision_id=body.ifRevisionID,
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="content.bonus_patched",
        resource_type="issue",
        resource_id=sanity_id,
        before=_truncate(json.dumps(before, default=str)),
        after=_truncate(json.dumps(fields, default=str)),
    )
    return {"revisionId": new_rev, "warnings": warnings}


# ── PATCH /issues/{run_id}/deliberation-conversation — EDT-01 ──────────────


@router.patch("/issues/{run_id}/deliberation-conversation")
async def patch_deliberation_conversation(
    request: Request,
    run_id: str,
    body: _ConversationBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Full replace of selectionDeliberation.conversation[] turn list.
    `_key` regenerated `turn-{i:03d}` per turn (mirrors write_issue_draft)."""
    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    draft = await get_issue_draft(sanity_http, sanity_id)
    before = draft.get("conversation", [])

    turns = [
        {
            "_type": "object",
            "_key": f"turn-{i:03d}",
            "speaker": t.speaker,
            "text": t.text,
        }
        for i, t in enumerate(body.turns)
    ]
    new_rev = await patch_issue_field(
        sanity_http,
        issue_id=sanity_id,
        field_path="selectionDeliberation.conversation",
        value=turns,
        if_revision_id=body.ifRevisionID,
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="content.deliberation_conversation_patched",
        resource_type="issue",
        resource_id=sanity_id,
        before=_truncate(json.dumps(before, default=str)),
        after=_truncate(json.dumps(turns, default=str)),
    )
    return {"revisionId": new_rev}


# ── PATCH /issues/{run_id}/podcast-transcript — EDT-01 ──────────────────────


@router.patch("/issues/{run_id}/podcast-transcript")
async def patch_podcast_transcript(
    request: Request,
    run_id: str,
    body: _TranscriptBody,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Plain-textarea patch of podcast.deliberationTranscript."""
    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    draft = await get_issue_draft(sanity_http, sanity_id)
    before = draft.get("podcast", {}).get("deliberationTranscript", "")

    new_rev = await patch_issue_field(
        sanity_http,
        issue_id=sanity_id,
        field_path="podcast.deliberationTranscript",
        value=body.transcript,
        if_revision_id=body.ifRevisionID,
    )

    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="content.podcast_transcript_patched",
        resource_type="issue",
        resource_id=sanity_id,
        before=_truncate(before or ""),
        after=_truncate(body.transcript),
    )
    return {"revisionId": new_rev}


# ── POST /issues/{run_id}/assets/{slot} — EDT-03 (raw binary) ──────────────


def _resolve_asset_slot(slot: str) -> tuple[str, str]:
    """Map a slot name to (field_path, asset_kind). Raises 400 on unknown
    slots. `asset_kind` is unused for the suno-audio URL-string exception
    (§31.6) but still returned for shape consistency."""
    if slot == "podcast-audio":
        return "podcast.audioFile", "file"
    if slot == "suno-audio":
        return "bonus.sunoAudioUrl", "file"
    if slot.startswith("storyboard-"):
        suffix = slot[len("storyboard-") :]
        if suffix.isdigit():
            return f"bonus.storyboards[{int(suffix)}]", "image"
    raise HTTPException(
        status_code=400,
        detail={"reason": "invalid_slot", "message": f"Unknown asset slot: {slot}"},
    )


def _existing_asset_ref(draft: dict, slot: str) -> Optional[str]:
    """Read the currently-stored asset `_ref` for a slot (for the D-12
    overwrite-swap audit before value). Returns None if unset/out of range."""
    if slot == "podcast-audio":
        audio = (draft.get("podcast") or {}).get("audioFile") or {}
        return (audio.get("asset") or {}).get("_ref")
    if slot.startswith("storyboard-"):
        suffix = slot[len("storyboard-") :]
        if suffix.isdigit():
            idx = int(suffix)
            storyboards = (draft.get("bonus") or {}).get("storyboards") or []
            if 0 <= idx < len(storyboards):
                item = storyboards[idx] or {}
                return (item.get("asset") or {}).get("_ref")
    return None


async def _upload_asset_as_url(
    sanity_http: Any,
    *,
    issue_id: str,
    field_path: str,
    file_bytes: bytes,
    filename: str,
    content_type: str,
    if_revision_id: str,
) -> dict:
    """suno-audio EXCEPTION (§31.6): `bonus.sunoAudioUrl` is `type: 'url'` (a
    plain string field), NOT a file-reference object. Uploads the bytes to
    Sanity's asset store, then `set`s the returned CDN URL STRING directly
    onto `field_path` — never a `{_type:'file', asset:{_ref}}` object."""
    r = await sanity_http.post(
        f"/{_sc.API_VERSION}/assets/files/{_sc._dataset()}",
        params={"filename": filename},
        content=file_bytes,
        headers={
            "Authorization": f"Bearer {os.environ['SANITY_API_TOKEN']}",
            "Content-Type": content_type,
        },
    )
    r.raise_for_status()
    doc = r.json()["document"]
    asset_id, asset_url = doc["_id"], doc["url"]

    new_rev = await patch_issue_field(
        sanity_http,
        issue_id=issue_id,
        field_path=field_path,
        value=asset_url,
        if_revision_id=if_revision_id,
    )
    return {"assetUrl": asset_url, "assetId": asset_id, "revisionId": new_rev}


@router.post("/issues/{run_id}/assets/{slot}")
async def upload_content_asset(
    request: Request,
    run_id: str,
    slot: str,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """EDT-03 — raw-binary asset upload (podcast-audio | suno-audio |
    storyboard-{i}). NEVER FastAPI's multipart form-parsing helpers —
    python-multipart is not an installed dependency (RESEARCH Pitfall 3);
    the body is read via `await request.body()` and metadata comes from
    custom headers."""
    field_path, asset_kind = _resolve_asset_slot(slot)

    raw = await request.body()
    filename = request.headers.get("X-Filename") or "upload.bin"
    content_type = request.headers.get("Content-Type") or "application/octet-stream"
    if_revision_id = request.headers.get("X-If-Revision-Id") or ""

    convex_http, sanity_http, sanity_id, actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    draft = await get_issue_draft(sanity_http, sanity_id)

    if slot == "suno-audio":
        old_value = (draft.get("bonus") or {}).get("sunoAudioUrl") or ""
        result = await _upload_asset_as_url(
            sanity_http,
            issue_id=sanity_id,
            field_path=field_path,
            file_bytes=raw,
            filename=filename,
            content_type=content_type,
            if_revision_id=if_revision_id,
        )
        new_value = result["assetUrl"]
    else:
        old_value = _existing_asset_ref(draft, slot) or ""
        result = await upload_asset(
            sanity_http,
            issue_id=sanity_id,
            field_path=field_path,
            file_bytes=raw,
            filename=filename,
            content_type=content_type,
            asset_kind=asset_kind,
            if_revision_id=if_revision_id,
        )
        new_value = result["assetId"]

    # D-12: overwriting a slot leaves the prior asset in Sanity (no delete);
    # this swap is what the audit row records.
    await _emit_audit(
        convex_http,
        actor_id=actor,
        action="content.asset_uploaded",
        resource_type="issue",
        resource_id=sanity_id,
        before=_truncate(old_value),
        after=_truncate(new_value),
    )
    return result


# ── GET /issues/{run_id}/draft — read path for the editor ──────────────────


@router.get("/issues/{run_id}/draft")
async def get_content_draft(
    request: Request,
    run_id: str,
    claims: dict = Depends(_require_clerk_jwt_control),
) -> dict:
    """Read-only — no audit row. Returns get_issue_draft()'s shape verbatim
    (§31.7)."""
    _convex_http, sanity_http, sanity_id, _actor = await _resolve_sanity_id(
        request, run_id, claims
    )
    return await get_issue_draft(sanity_http, sanity_id)
