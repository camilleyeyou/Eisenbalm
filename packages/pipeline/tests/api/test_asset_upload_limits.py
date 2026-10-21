"""Quick 261021-5pr — bounded, type-checked, filename-sanitized asset upload."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from eisenbalm_pipeline.api import content
from eisenbalm_pipeline.api.content import _sanitize_filename

_C = "eisenbalm_pipeline.api.content"


@pytest.fixture
def client(monkeypatch):
    app = FastAPI()
    app.include_router(content.router)
    app.state.convex_http = MagicMock()
    app.state.sanity_http = MagicMock()
    app.state.graph = None
    app.state.background_tasks = set()
    monkeypatch.setattr(content, "_MAX_IMAGE_BYTES", 16)
    monkeypatch.setattr(content, "_MAX_AUDIO_PODCAST_BYTES", 16)
    monkeypatch.setattr(content, "_MAX_AUDIO_JINGLE_BYTES", 16)
    resolve = AsyncMock(
        return_value=(MagicMock(), MagicMock(), "issue-1", "actor")
    )
    monkeypatch.setattr(f"{_C}._resolve_sanity_id", resolve)
    monkeypatch.setattr(f"{_C}.get_issue_draft", AsyncMock(return_value={}))
    upload = AsyncMock(return_value={"assetUrl": "u", "assetId": "a", "revisionId": "r"})
    monkeypatch.setattr(f"{_C}.upload_asset", upload)
    monkeypatch.setattr(f"{_C}._emit_audit", AsyncMock())
    monkeypatch.setattr(f"{_C}._revoke_active_signoffs", AsyncMock())
    c = TestClient(app)
    c.resolve, c.upload = resolve, upload
    return c


def test_declared_content_length_over_cap_is_413_before_any_call(client):
    r = client.post(
        "/issues/run-1/assets/storyboard-0",
        headers={"Content-Type": "image/png"},
        content=b"x" * 64,
    )
    assert r.status_code == 413
    assert r.json()["detail"]["reason"] == "payload_too_large"
    client.resolve.assert_not_called()
    client.upload.assert_not_called()


def test_streamed_body_without_content_length_over_cap_is_413(client):
    def gen():
        for _ in range(8):
            yield b"xxxx"

    r = client.post(
        "/issues/run-1/assets/storyboard-0",
        headers={"Content-Type": "image/png"},
        content=gen(),
    )
    assert r.status_code == 413
    client.upload.assert_not_called()


@pytest.mark.parametrize(
    "slot,ct",
    [
        ("storyboard-0", "text/html"),
        ("storyboard-0", "image/svg+xml"),
        ("podcast-audio", "image/png"),
        ("storyboard-0", ""),
    ],
)
def test_bad_content_type_is_415(client, slot, ct):
    headers = {"Content-Type": ct} if ct else {}
    r = client.post(f"/issues/run-1/assets/{slot}", headers=headers, content=b"x")
    assert r.status_code == 415
    client.resolve.assert_not_called()


def test_content_type_params_accepted_and_filename_sanitized(client):
    r = client.post(
        "/issues/run-1/assets/storyboard-0",
        headers={
            "Content-Type": "image/png; charset=x",
            "X-Filename": "../../etc/pass wd<script>.png",
        },
        content=b"x",
    )
    assert r.status_code == 200, r.text
    kw = client.upload.await_args.kwargs
    assert kw["filename"] == "pass_wd_script_.png"
    assert kw["content_type"] == "image/png"


@pytest.mark.parametrize(
    "raw,expected",
    [(None, "upload.bin"), ("", "upload.bin"), ("...", "upload.bin"), ("a\\b\\c.mp3", "c.mp3")],
)
def test_sanitize_fallbacks(raw, expected):
    assert _sanitize_filename(raw) == expected


def test_sanitize_long_name_keeps_extension():
    out = _sanitize_filename("a" * 300 + ".mp3")
    assert len(out) <= 120 and out.endswith(".mp3")
