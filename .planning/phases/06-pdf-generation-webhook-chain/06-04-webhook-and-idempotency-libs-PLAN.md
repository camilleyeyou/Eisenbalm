---
phase: 06-pdf-generation-webhook-chain
plan: 04
type: execute
wave: 1
depends_on:
  - 01
  - 03
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py
  - packages/pipeline/tests/lib/test_sanity_webhook.py
  - packages/pipeline/tests/lib/test_idempotency.py
  - packages/pipeline/tests/lib/test_vercel_client.py
autonomous: true
requirements_addressed:
  - WHK-02
  - WHK-03
  - WHK-04
  - WHK-05

must_haves:
  truths:
    - "verify_sanity_signature accepts valid t={ms},v1={base64url} headers and rejects tampered/expired/future-skewed ones"
    - "claim_idempotency_key returns True on first claim, False on duplicate (UNIQUE constraint enforced by Postgres)"
    - "trigger_vercel_deploy POSTs to VERCEL_DEPLOY_HOOK_URL with no body, no auth, and raises on non-2xx"
    - "All three lib modules import-clean — no top-level side effects, no env reads at import time"
    - "Plan 06-01's previously skip-marked tests in tests/lib/test_sanity_webhook.py, test_idempotency.py, test_vercel_client.py are now unskipped and green"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py"
      provides: "verify_sanity_signature + SignatureError hierarchy (Format/Expired/Mismatch)"
      contains: "def verify_sanity_signature"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py"
      provides: "claim_idempotency_key against Supabase Postgres webhook_idempotency table"
      contains: "def claim_idempotency_key"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py"
      provides: "trigger_vercel_deploy async POST helper"
      contains: "def trigger_vercel_deploy"
  key_links:
    - from: "lib/sanity_webhook.py::verify_sanity_signature"
      to: "tests/conftest.py::encode_sanity_signature"
      via: "test parity — encoder and decoder share the same algorithm"
      pattern: "base64.urlsafe_b64encode"
    - from: "lib/idempotency.py::claim_idempotency_key"
      to: "packages/pipeline/src/eisenbalm_pipeline/cli.py::WEBHOOK_IDEMPOTENCY_DDL"
      via: "INSERT INTO webhook_idempotency"
      pattern: "ON CONFLICT \\(source, idempotency_key\\) DO NOTHING"
---

<objective>
Land the three lib modules that Plan 06-07's webhook handler will compose:

  - `lib/sanity_webhook.py` — verifies Sanity's `t={ms},v1={base64url}` signature header (CORRECTED algorithm per research §Pattern 1, replacing the wrong `sha256=hex` in docs/API_CONTRACTS §5.3).
  - `lib/idempotency.py` — atomic INSERT … ON CONFLICT against the `webhook_idempotency` Postgres table that Plan 06-03's CLI created.
  - `lib/vercel_client.py` — single-purpose async POST to `VERCEL_DEPLOY_HOOK_URL` that raises on non-2xx.

Then unskip the three previously-skipped test files (`tests/lib/test_sanity_webhook.py`, `test_idempotency.py`, `test_vercel_client.py`) and write real assertions against the new lib modules. The Wave 0 skeletons already declared the canonical test names — this plan fills the bodies.

Purpose: package the three primitives the webhook handler composes, with full test coverage, so Plan 06-07's wiring is a pure composition step (no algorithmic surprises in the handler).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md
@packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py
@packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
@packages/pipeline/tests/conftest.py
@packages/pipeline/tests/lib/test_sanity_webhook.py
@packages/pipeline/tests/lib/test_idempotency.py
@packages/pipeline/tests/lib/test_vercel_client.py

<interfaces>
From 06-RESEARCH.md §Pattern 1 (canonical algorithm — REPLACES API_CONTRACTS §5.3):
```python
# header = f"t={ts_ms},v1={base64url_no_pad(hmac_sha256(secret, f'{ts_ms}.{body_bytes}'))}"
SIGNATURE_RE = re.compile(r"^t=(\d+)[, ]+v1=([^, ]+)$")
MAX_AGE_MS = 5 * 60 * 1000  # WHK-03

class SignatureError(Exception): ...
class SignatureFormatError(SignatureError): ...
class SignatureExpiredError(SignatureError): ...
class SignatureMismatchError(SignatureError): ...

def verify_sanity_signature(
    raw_body: bytes,
    signature_header: str | None,
    secret: str,
    *,
    now_ms: int | None = None,
) -> int:
    """Returns parsed ts_ms on success. Raises SignatureError subclass otherwise.
    Symmetric tolerance: rejects ts older than now-MAX_AGE_MS OR newer than now+MAX_AGE_MS.
    """
```

From 06-RESEARCH.md §Pattern 2 (atomic INSERT):
```python
async def claim_idempotency_key(
    pool: AsyncConnectionPool,
    *,
    source: str,
    idempotency_key: str,
    run_id: str | None,
) -> bool:
    """Returns True iff first time we've seen this (source, idempotency_key) pair."""
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            "INSERT INTO webhook_idempotency (idempotency_key, source, run_id) "
            "VALUES (%s, %s, %s) "
            "ON CONFLICT (source, idempotency_key) DO NOTHING RETURNING id",
            (idempotency_key, source, run_id),
        )
        return (await cur.fetchone()) is not None
```

From 06-RESEARCH.md §Code Examples — Vercel deploy hook:
```python
async def trigger_vercel_deploy(http: AsyncClient) -> dict:
    url = os.environ["VERCEL_DEPLOY_HOOK_URL"]
    r = await http.post(url, timeout=30.0)
    r.raise_for_status()
    return r.json()
```

From tests/conftest.py (Plan 06-01):
```python
def encode_sanity_signature(body: bytes, ts_ms: int, secret: str) -> str:
    payload = f"{ts_ms}.".encode("utf-8") + body
    mac = _hmac_mod.new(secret.encode("utf-8"), payload, hashlib.sha256).digest()
    sig = base64.urlsafe_b64encode(mac).rstrip(b"=").decode("ascii")
    return f"t={ts_ms},v1={sig}"

@pytest.fixture
def sanity_signature_encoder(): return encode_sanity_signature

@pytest.fixture
async def webhook_idempotency_clean(): ...  # yields opened psycopg pool
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create lib/sanity_webhook.py with the corrected HMAC verifier</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (existing module-level pattern; stdlib-only style)
    - packages/pipeline/tests/conftest.py (encode_sanity_signature — decoder must match encoder byte-for-byte)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Pattern 1 — exact algorithm)
  </read_first>
  <files>
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py
  </files>
  <action>
Create `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` with this content (verbatim from RESEARCH §Pattern 1, lightly extended with module docstring + SIGNATURE_HEADER_NAME constant):

```python
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
```

Verify smoke:
```bash
cd packages/pipeline
uv run python -c "
from eisenbalm_pipeline.lib.sanity_webhook import verify_sanity_signature, SignatureMismatchError
from tests.conftest import encode_sanity_signature
ts = 1700000000000
body = b'{\"hello\":\"world\"}'
header = encode_sanity_signature(body, ts, 'mysecret')
# Pass now_ms = ts so the 5-minute window doesn't kick in.
assert verify_sanity_signature(body, header, 'mysecret', now_ms=ts) == ts
# Tampered body
try:
    verify_sanity_signature(b'tampered', header, 'mysecret', now_ms=ts)
    assert False, 'should have raised'
except SignatureMismatchError:
    pass
print('ok')
"
```
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -c "def verify_sanity_signature" src/eisenbalm_pipeline/lib/sanity_webhook.py && grep -c "class SignatureExpiredError" src/eisenbalm_pipeline/lib/sanity_webhook.py && uv run python -c "from eisenbalm_pipeline.lib.sanity_webhook import verify_sanity_signature, SignatureMismatchError, SignatureExpiredError, SignatureFormatError; from tests.conftest import encode_sanity_signature; ts=1700000000000; body=b'{\"hello\":\"world\"}'; h=encode_sanity_signature(body, ts, 'mysecret'); assert verify_sanity_signature(body, h, 'mysecret', now_ms=ts)==ts; print('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "def verify_sanity_signature" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` returns `1`
    - `grep -c "class SignatureFormatError" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` returns `1`
    - `grep -c "class SignatureExpiredError" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` returns `1`
    - `grep -c "class SignatureMismatchError" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` returns `1`
    - `grep -c "MAX_AGE_MS = 5 \* 60 \* 1000" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` returns `1`
    - `grep -c "hmac.compare_digest" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` returns `1`
    - `grep -c "base64.urlsafe_b64encode" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` returns `1`
    - The Python one-liner in the verify command exits 0 and prints `ok`
  </acceptance_criteria>
  <done>
    sanity_webhook.py exists, exports 4 errors + verify function, the verifier is symmetric across encode_sanity_signature (test fixture in conftest).
  </done>
</task>

<task type="auto">
  <name>Task 2: Create lib/idempotency.py and lib/vercel_client.py</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/cli.py (WEBHOOK_IDEMPOTENCY_DDL — table + UNIQUE constraint shape)
    - packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py (AsyncConnectionPool pattern for type hints)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (module-level os.environ pattern + httpx style)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Pattern 2 + Vercel code example)
  </read_first>
  <files>
    - packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py
  </files>
  <action>
1. Create `packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py`:

```python
"""Webhook idempotency-key dedup (WHK-04).

Atomic INSERT ON CONFLICT against the `webhook_idempotency` Postgres table
(DDL lives in cli.py::WEBHOOK_IDEMPOTENCY_DDL, run by railway.toml
preDeployCommand). The UNIQUE constraint (source, idempotency_key) is the
atomic guarantee Sanity's retries cannot defeat.

Source: 06-RESEARCH.md Pattern 2 + Pitfall 6.
"""
from __future__ import annotations

from typing import Optional

from psycopg_pool import AsyncConnectionPool


async def claim_idempotency_key(
    pool: AsyncConnectionPool,
    *,
    source: str,
    idempotency_key: str,
    run_id: Optional[str],
) -> bool:
    """Returns True iff this is the first time we've seen (source, idempotency_key).

    Inserts a row into webhook_idempotency. On UNIQUE conflict (duplicate),
    the INSERT is a no-op and RETURNING id yields nothing — return False so
    the caller can short-circuit the webhook handler.

    Caller MUST handle exceptions (e.g., pool closed, table missing): this
    function does NOT swallow psycopg errors — they propagate so the
    webhook handler can decide between "fail loud" and "log + proceed".

    Parameters:
        pool: opened AsyncConnectionPool (typically app.state.pool from FastAPI lifespan).
        source: webhook source identifier — 'sanity-publish' for Phase 6.
        idempotency_key: contents of the idempotency-key header.
        run_id: optional pipelineRuns.runId for cross-reference. May be None.

    Returns:
        True if newly claimed (this is the first delivery).
        False if duplicate (the caller should return early with {"duplicate": True}).
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            (
                "INSERT INTO webhook_idempotency (idempotency_key, source, run_id) "
                "VALUES (%s, %s, %s) "
                "ON CONFLICT (source, idempotency_key) DO NOTHING "
                "RETURNING id"
            ),
            (idempotency_key, source, run_id),
        )
        row = await cur.fetchone()
        return row is not None
```

2. Create `packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py`:

```python
"""Vercel deploy hook trigger (WHK-05).

POSTs to `VERCEL_DEPLOY_HOOK_URL` with no body and no auth — the URL itself
is the credential. Returns the Vercel response body, which includes
`{job: {id, state, createdAt}}`.

Source: https://vercel.com/docs/deploy-hooks + 06-RESEARCH.md Code Examples.
"""
from __future__ import annotations

import logging
import os

from httpx import AsyncClient

log = logging.getLogger(__name__)


async def trigger_vercel_deploy(http: AsyncClient) -> dict:
    """Fire the Vercel deploy hook. Raises on non-2xx.

    Parameters:
        http: an open httpx.AsyncClient. Caller controls lifecycle; we do
              NOT construct a new client per call (research §"Don't
              Hand-Roll" — reuse the pool registered on app.state).

    Returns:
        Parsed JSON response — typically `{"job": {"id": ..., "state": ...,
        "createdAt": ...}}` per Vercel's documented response shape.

    Raises:
        httpx.HTTPStatusError: on 4xx/5xx — caller decides whether to retry
        or surface as a Convex deliberationEvents error.
        KeyError: if VERCEL_DEPLOY_HOOK_URL is unset (fail-loud).
    """
    url = os.environ["VERCEL_DEPLOY_HOOK_URL"]
    log.info("Triggering Vercel deploy hook (URL redacted in logs).")
    r = await http.post(url, timeout=30.0)
    r.raise_for_status()
    return r.json()
```

Both modules MUST:
  - Import nothing from the rest of the codebase except stdlib + psycopg_pool / httpx (avoid circular imports — they're standalone primitives).
  - Have zero module-level side effects (no env reads at import time — env is read inside the function body so tests can patch / set vars per-test).
  - Use `from __future__ import annotations` for forward-compat type hints.

Verify imports:
```bash
cd packages/pipeline
uv run python -c "from eisenbalm_pipeline.lib.idempotency import claim_idempotency_key; from eisenbalm_pipeline.lib.vercel_client import trigger_vercel_deploy; print('ok')"
```
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -c "def claim_idempotency_key" src/eisenbalm_pipeline/lib/idempotency.py && grep -c "def trigger_vercel_deploy" src/eisenbalm_pipeline/lib/vercel_client.py && uv run python -c "from eisenbalm_pipeline.lib.idempotency import claim_idempotency_key; from eisenbalm_pipeline.lib.vercel_client import trigger_vercel_deploy; print('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "def claim_idempotency_key" packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py` returns `1`
    - `grep -c "ON CONFLICT (source, idempotency_key) DO NOTHING" packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py` returns `1`
    - `grep -c "RETURNING id" packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py` returns `1`
    - `grep -c "def trigger_vercel_deploy" packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py` returns `1`
    - `grep -c "VERCEL_DEPLOY_HOOK_URL" packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py` returns `1`
    - Both modules import-clean (the Python one-liner exits 0 with `ok`)
    - Neither module has module-level `os.environ[...]` reads outside of function bodies: `grep -n "os.environ\[" packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py | grep -v "def " | wc -l` returns `0` (env reads only inside function bodies)
  </acceptance_criteria>
  <done>
    Two new lib modules exist; each has one async function with the canonical signature; both are import-clean with no side effects.
  </done>
</task>

<task type="auto">
  <name>Task 3: Unskip + flesh out tests/lib/test_sanity_webhook.py, test_idempotency.py, test_vercel_client.py</name>
  <read_first>
    - packages/pipeline/tests/lib/test_sanity_webhook.py (Wave 0 skip-marked skeletons — locked test names)
    - packages/pipeline/tests/lib/test_idempotency.py (same)
    - packages/pipeline/tests/lib/test_vercel_client.py (same)
    - packages/pipeline/tests/conftest.py (encode_sanity_signature + webhook_idempotency_clean fixtures)
    - .planning/phases/06-pdf-generation-webhook-chain/06-VALIDATION.md (test→requirement map)
  </read_first>
  <files>
    - packages/pipeline/tests/lib/test_sanity_webhook.py
    - packages/pipeline/tests/lib/test_idempotency.py
    - packages/pipeline/tests/lib/test_vercel_client.py
  </files>
  <action>
For each file: remove the `@pytest.mark.skip(...)` decorator and fill in the body. Test NAMES are LOCKED — do not rename. Add imports for the new lib modules at the top of each file.

**`tests/lib/test_sanity_webhook.py`** (replace entire body, preserving the test names from Plan 06-01):

```python
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
```

**`tests/lib/test_idempotency.py`** (replace entire body):

```python
"""Postgres webhook_idempotency tests (Plan 06-04 fills bodies).

NOTE: These tests require a live Supabase Postgres reachable via
SUPABASE_POSTGRES_URL with the webhook_idempotency table created
(setup-webhook-idempotency CLI). The webhook_idempotency_clean fixture
TRUNCATEs before each test for isolation. Tests skip if env unset.
"""
from __future__ import annotations

import pytest

from eisenbalm_pipeline.lib.idempotency import claim_idempotency_key


async def test_dedup_returns_true_on_first(webhook_idempotency_clean):
    """WHK-04: first claim_idempotency_key call returns True."""
    pool = webhook_idempotency_clean
    first = await claim_idempotency_key(
        pool,
        source="sanity-publish",
        idempotency_key="key-001",
        run_id="run-abc",
    )
    assert first is True


async def test_dedup_returns_false_on_second(webhook_idempotency_clean):
    """WHK-04: second call with same (source, idempotency_key) returns False."""
    pool = webhook_idempotency_clean
    first = await claim_idempotency_key(
        pool, source="sanity-publish", idempotency_key="key-002", run_id="run-x"
    )
    second = await claim_idempotency_key(
        pool, source="sanity-publish", idempotency_key="key-002", run_id="run-x"
    )
    assert first is True
    assert second is False


async def test_different_source_independent(webhook_idempotency_clean):
    """WHK-04: same idempotency_key under different source values are independent."""
    pool = webhook_idempotency_clean
    a = await claim_idempotency_key(
        pool, source="sanity-publish", idempotency_key="key-003", run_id=None
    )
    b = await claim_idempotency_key(
        pool, source="future-source", idempotency_key="key-003", run_id=None
    )
    assert a is True
    assert b is True  # different source → no conflict
```

**`tests/lib/test_vercel_client.py`** (replace entire body):

```python
"""Vercel deploy hook trigger tests (Plan 06-04 fills bodies).

Uses respx to mock the HTTP call — never actually fires a deploy.
"""
from __future__ import annotations

import os

import httpx
import pytest
import respx

from eisenbalm_pipeline.lib.vercel_client import trigger_vercel_deploy

HOOK_URL = "https://api.vercel.com/v1/integrations/deploy/test-hook-id"


async def test_trigger_posts_to_hook_url(monkeypatch):
    """WHK-05: trigger_vercel_deploy POSTs (no body, no auth) to VERCEL_DEPLOY_HOOK_URL."""
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL)
    async with respx.mock(assert_all_called=True) as router:
        route = router.post(HOOK_URL).mock(
            return_value=httpx.Response(
                201, json={"job": {"id": "abc", "state": "READY", "createdAt": 1}}
            )
        )
        async with httpx.AsyncClient() as http:
            result = await trigger_vercel_deploy(http)
        assert route.called
        assert route.calls.last.request.method == "POST"
        # No auth header, no body
        assert b"Authorization" not in (route.calls.last.request.headers.raw[0][0] if route.calls.last.request.headers.raw else b"")
        assert route.calls.last.request.content == b""
        assert result == {"job": {"id": "abc", "state": "READY", "createdAt": 1}}


async def test_trigger_raises_on_non_2xx(monkeypatch):
    """WHK-05: 4xx/5xx from Vercel raises so caller can log + continue."""
    monkeypatch.setenv("VERCEL_DEPLOY_HOOK_URL", HOOK_URL)
    async with respx.mock(assert_all_called=False) as router:
        router.post(HOOK_URL).mock(return_value=httpx.Response(500))
        async with httpx.AsyncClient() as http:
            with pytest.raises(httpx.HTTPStatusError):
                await trigger_vercel_deploy(http)
```

Run the unit tests (signature + vercel; idempotency may skip without live DB):
```bash
cd packages/pipeline
EISENBALM_STUB_MODE=true uv run pytest tests/lib/test_sanity_webhook.py tests/lib/test_vercel_client.py -x -v
# Expected: 6+ passed for sanity_webhook, 2 passed for vercel_client.
```
  </action>
  <verify>
    <automated>cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/lib/test_sanity_webhook.py tests/lib/test_vercel_client.py -x 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/lib/test_sanity_webhook.py` returns `0` (all skip markers removed)
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/lib/test_idempotency.py` returns `0`
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/lib/test_vercel_client.py` returns `0`
    - `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/lib/test_sanity_webhook.py -x 2>&1 | tail -1` shows ≥ 6 passed, 0 failed
    - `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/lib/test_vercel_client.py -x 2>&1 | tail -1` shows ≥ 2 passed, 0 failed
    - `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/lib/test_idempotency.py 2>&1 | tail -1` shows ≥ 3 passed OR ≥ 3 skipped (skipped when SUPABASE_POSTGRES_URL is unset locally — that's the documented fallback path)
    - Each test name from Plan 06-01's locked list is still present in the file (`grep -c "def test_valid_signature_returns_timestamp" tests/lib/test_sanity_webhook.py` returns `1`, etc.)
  </acceptance_criteria>
  <done>
    All three test files unskipped; ≥ 8 tests pass deterministically (sanity_webhook + vercel_client); idempotency tests pass when SUPABASE_POSTGRES_URL is available, skip cleanly otherwise.
  </done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/lib/ -x 2>&1 | tail -3` — at least 8 passed (sanity_webhook + vercel_client always pass; idempotency passes or skips)
- `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.lib import sanity_webhook, idempotency, vercel_client; print('ok')"` exits 0
- Phase 5 suite still green: `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/ -x 2>&1 | tail -1` — no new failures
</verification>

<success_criteria>
1. lib/sanity_webhook.py exports verify_sanity_signature + 3 named errors; algorithm matches conftest.py::encode_sanity_signature byte-for-byte
2. lib/idempotency.py exports claim_idempotency_key with the canonical INSERT ... ON CONFLICT DO NOTHING RETURNING id shape
3. lib/vercel_client.py exports trigger_vercel_deploy that POSTs with no body, no auth, and raises on non-2xx
4. tests/lib/test_sanity_webhook.py — 6 passed
5. tests/lib/test_idempotency.py — 3 passed (or skipped with clear reason)
6. tests/lib/test_vercel_client.py — 2 passed (mocked, no network)
</success_criteria>

<output>
After completion, create `.planning/phases/06-pdf-generation-webhook-chain/06-pdf-generation-webhook-chain-04-SUMMARY.md` documenting:
  - The exact test counts (passed / skipped / failed) from each test file
  - Whether idempotency tests ran against a real Supabase or skipped
  - Any departures from the verbatim Pattern 1 + Pattern 2 code (none expected)
  - The base64url encoding choice for SignatureFormatError detection (rejection of `sha256=hex` shape)
</output>
