"""Sanity signature verifier unit tests (Plan 06-04 fills bodies)."""
from __future__ import annotations

import pytest

from eisenbalm_pipeline.lib.sanity_webhook import (
    MAX_AGE_MS,
    SignatureExpiredError,
    SignatureFormatError,
    SignatureMismatchError,
    verify_sanity_signature,
)


SECRET = "test-secret-32-bytes"


def test_valid_signature_returns_timestamp(sanity_signature_encoder):
    """WHK-02: verify_sanity_signature returns the parsed ts_ms on success."""
    ts = 1700000000000
    body = b'{"_id":"issue-42","status":"published"}'
    header = sanity_signature_encoder(body, ts, SECRET)
    assert verify_sanity_signature(body, header, SECRET, now_ms=ts) == ts


def test_raw_body_required(sanity_signature_encoder):
    """WHK-02 Pitfall 1: HMAC over re-serialized JSON FAILS — must use raw bytes."""
    import json
    ts = 1700000000000
    raw_body = b'{"hello":"world","extra":true}'
    header = sanity_signature_encoder(raw_body, ts, SECRET)
    # Re-serialize with different whitespace — bytes change, HMAC fails.
    parsed = json.loads(raw_body)
    re_serialized = json.dumps(parsed, separators=(", ", ": ")).encode("utf-8")
    assert re_serialized != raw_body
    with pytest.raises(SignatureMismatchError):
        verify_sanity_signature(re_serialized, header, SECRET, now_ms=ts)


def test_tampered_body_rejected(sanity_signature_encoder):
    """WHK-02: changing a single byte in body → SignatureMismatchError."""
    ts = 1700000000000
    body = b'{"_id":"issue-42"}'
    header = sanity_signature_encoder(body, ts, SECRET)
    tampered = b'{"_id":"issue-43"}'
    with pytest.raises(SignatureMismatchError):
        verify_sanity_signature(tampered, header, SECRET, now_ms=ts)


def test_expired_signature_rejected(sanity_signature_encoder):
    """WHK-03: ts_ms older than now-300_000 → SignatureExpiredError."""
    ts = 1700000000000
    body = b'{"x":1}'
    header = sanity_signature_encoder(body, ts, SECRET)
    # now is 6 minutes after the signature timestamp
    future = ts + MAX_AGE_MS + 60_000
    with pytest.raises(SignatureExpiredError):
        verify_sanity_signature(body, header, SECRET, now_ms=future)


def test_future_skew_rejected(sanity_signature_encoder):
    """WHK-03 Pitfall 4: ts_ms newer than now+300_000 → SignatureExpiredError."""
    ts = 1700000000000
    body = b'{"x":1}'
    header = sanity_signature_encoder(body, ts, SECRET)
    # now is 6 minutes BEFORE the signature timestamp
    past = ts - MAX_AGE_MS - 60_000
    with pytest.raises(SignatureExpiredError):
        verify_sanity_signature(body, header, SECRET, now_ms=past)


def test_malformed_header_rejected():
    """WHK-02: header missing 't=' or 'v1=' → SignatureFormatError."""
    body = b'{"x":1}'
    with pytest.raises(SignatureFormatError):
        verify_sanity_signature(body, None, SECRET, now_ms=1700000000000)
    with pytest.raises(SignatureFormatError):
        verify_sanity_signature(body, "garbage", SECRET, now_ms=1700000000000)
    with pytest.raises(SignatureFormatError):
        # sha256=hex shape (the WRONG algorithm — must be rejected)
        verify_sanity_signature(body, "sha256=abc123", SECRET, now_ms=1700000000000)
