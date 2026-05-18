"""Sanity webhook signature verification (WHK-02 + WHK-03).

CORRECTED algorithm vs docs/API_CONTRACTS §5.3. The upstream @sanity/webhook
library (v5+, the Web Crypto migration) uses:

    header   = f"t={timestamp_ms},v1={base64url_no_pad(signature)}"
    payload  = f"{timestamp_ms}.".encode("utf-8") + raw_body_bytes
    signature = HMAC_SHA256(secret_utf8, payload)

This file replaces the `sha256=hex` shape historically documented in
API_CONTRACTS. Plan 06-06 amends that doc; this module is the single source
of truth in code.

Source: https://github.com/sanity-io/webhook-toolkit/blob/main/src/signature.ts
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import re
import time

SIGNATURE_HEADER_NAME = "sanity-webhook-signature"
SIGNATURE_RE = re.compile(r"^t=(\d+)[, ]+v1=([^, ]+)$")
MAX_AGE_MS = 5 * 60 * 1000  # WHK-03: 5 minutes


class SignatureError(Exception):
    """Base class — return 401 to Sanity (do not retry)."""


class SignatureFormatError(SignatureError):
    """Header missing or malformed."""


class SignatureExpiredError(SignatureError):
    """Timestamp older than MAX_AGE_MS or future-skewed beyond MAX_AGE_MS — WHK-03 (Pitfall 4)."""


class SignatureMismatchError(SignatureError):
    """HMAC does not match — body tampered or wrong secret."""


def _b64url_no_pad(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def verify_sanity_signature(
    raw_body: bytes,
    signature_header: str | None,
    secret: str,
    *,
    now_ms: int | None = None,
) -> int:
    """Returns the parsed timestamp_ms on success. Raises SignatureError otherwise.

    Algorithm (canonical, from @sanity/webhook v5+ src/signature.ts):
        payload   = f"{timestamp_ms}.".encode("utf-8") + raw_body
        signature = base64url_no_pad(HMAC_SHA256(secret_utf8, payload))
        header    = f"t={timestamp_ms},v1={signature}"

    Parameters:
        raw_body: the raw request body bytes (NOT the parsed JSON — Pitfall 1).
        signature_header: contents of the `sanity-webhook-signature` header.
        secret: SANITY_WEBHOOK_SECRET.
        now_ms: override for tests (defaults to int(time.time() * 1000)).

    Returns:
        The parsed timestamp_ms from the header on success.

    Raises:
        SignatureFormatError: header missing or malformed.
        SignatureExpiredError: timestamp outside [now - MAX_AGE_MS, now + MAX_AGE_MS].
        SignatureMismatchError: HMAC does not match.
    """
    if not signature_header:
        raise SignatureFormatError("Missing sanity-webhook-signature header")
    m = SIGNATURE_RE.match(signature_header.strip())
    if not m:
        raise SignatureFormatError(f"Bad signature header format: {signature_header!r}")
    ts_ms = int(m.group(1))
    provided_sig = m.group(2)

    # WHK-03 + Pitfall 4: symmetric tolerance for clock skew between Sanity
    # and Railway. Reject anything beyond MAX_AGE_MS in either direction.
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    if now - ts_ms > MAX_AGE_MS:
        raise SignatureExpiredError(
            f"Signature timestamp {ts_ms} older than {MAX_AGE_MS}ms (now={now})"
        )
    if ts_ms - now > MAX_AGE_MS:
        raise SignatureExpiredError(
            f"Signature timestamp {ts_ms} too far in future (now={now})"
        )

    # WHK-02: HMAC over raw body bytes (Pitfall 1 — DO NOT re-serialize JSON).
    payload = f"{ts_ms}.".encode("utf-8") + raw_body
    mac = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).digest()
    expected = _b64url_no_pad(mac)
    if not hmac.compare_digest(expected, provided_sig):
        raise SignatureMismatchError("Signature mismatch (HMAC differs from header)")
    return ts_ms
