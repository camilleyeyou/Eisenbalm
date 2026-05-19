---
phase: 06-pdf-generation-webhook-chain
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - packages/pipeline/tests/agents/publisher/__init__.py
  - packages/pipeline/tests/agents/publisher/fixtures/__init__.py
  - packages/pipeline/tests/agents/publisher/fixtures/sample_pdf_content.json
  - packages/pipeline/tests/agents/publisher/fixtures/sample_theme.json
  - packages/pipeline/tests/agents/publisher/fixtures/tiny.ttf
  - packages/pipeline/tests/agents/publisher/test_pdf.py
  - packages/pipeline/tests/agents/publisher/test_publisher.py
  - packages/pipeline/tests/agents/publisher/test_fonts.py
  - packages/pipeline/tests/api/__init__.py
  - packages/pipeline/tests/api/test_webhook_sanity.py
  - packages/pipeline/tests/api/test_runs.py
  - packages/pipeline/tests/lib/test_sanity_webhook.py
  - packages/pipeline/tests/lib/test_idempotency.py
  - packages/pipeline/tests/lib/test_vercel_client.py
  - packages/pipeline/tests/conftest.py
autonomous: true
requirements_addressed:
  - PDF-01
  - PDF-02
  - PDF-03
  - PDF-04
  - WHK-01
  - WHK-02
  - WHK-03
  - WHK-04
  - WHK-05
  - WHK-06
  - WHK-07
  - WHK-08

must_haves:
  truths:
    - "Every Phase 6 requirement has at least one skipped pytest skeleton checked in BEFORE implementation"
    - "pytest --collect-only succeeds against tests/ with zero ImportError (skeletons are import-clean)"
    - "A canonical encode_sanity_signature helper is added to tests/conftest.py for downstream signature tests to import"
    - "tests/agents/publisher/fixtures/tiny.ttf exists and is a valid TrueType font (passes WeasyPrint @font-face) under 200KB"
  artifacts:
    - path: "packages/pipeline/tests/agents/publisher/__init__.py"
      provides: "Python package init for new publisher test directory"
    - path: "packages/pipeline/tests/api/__init__.py"
      provides: "Python package init for new api test directory"
    - path: "packages/pipeline/tests/agents/publisher/fixtures/tiny.ttf"
      provides: "Liberation Sans Regular (or smaller) for fast WeasyPrint tests"
    - path: "packages/pipeline/tests/agents/publisher/fixtures/sample_pdf_content.json"
      provides: "Phase 5 PdfContent shape fixture for renderer tests"
    - path: "packages/pipeline/tests/agents/publisher/fixtures/sample_theme.json"
      provides: "DesignAgent theme fixture (2 fonts from whitelist + 4 validated hex)"
    - path: "packages/pipeline/tests/agents/publisher/test_pdf.py"
      provides: "Skip-marked PDF render test skeletons (4+ cases)"
    - path: "packages/pipeline/tests/agents/publisher/test_publisher.py"
      provides: "Skip-marked Publisher coroutine test skeletons"
    - path: "packages/pipeline/tests/agents/publisher/test_fonts.py"
      provides: "Skip-marked TTF base64 encode roundtrip skeleton"
    - path: "packages/pipeline/tests/api/test_webhook_sanity.py"
      provides: "Skip-marked webhook handler skeletons (signature/age/idempotency)"
    - path: "packages/pipeline/tests/api/test_runs.py"
      provides: "Skip-marked WHK-08 manual fallback skeleton"
    - path: "packages/pipeline/tests/lib/test_sanity_webhook.py"
      provides: "Skip-marked signature verifier skeletons (raw body, future skew, format error)"
    - path: "packages/pipeline/tests/lib/test_idempotency.py"
      provides: "Skip-marked claim_idempotency_key skeleton"
    - path: "packages/pipeline/tests/lib/test_vercel_client.py"
      provides: "Skip-marked vercel deploy hook trigger skeleton"
    - path: "packages/pipeline/tests/conftest.py"
      provides: "encode_sanity_signature helper + webhook_idempotency table cleanup fixture stub"
  key_links:
    - from: "tests/agents/publisher/test_pdf.py"
      to: "tests/agents/publisher/fixtures/tiny.ttf"
      via: "Path(__file__).parent / 'fixtures' / 'tiny.ttf'"
      pattern: "tiny\\.ttf"
    - from: "tests/api/test_webhook_sanity.py"
      to: "tests/conftest.py::encode_sanity_signature"
      via: "pytest fixture import"
      pattern: "encode_sanity_signature"
---

<objective>
Stand up the Wave 0 test surface for Phase 6 BEFORE any implementation. Every PDF-* and WHK-* requirement gets a skip-marked pytest skeleton with the eventual `<automated>` command path; the test files import-clean so subsequent plans only need to unskip + flesh out bodies. Vendor a tiny TTF fixture so WeasyPrint tests run without network. Ship the canonical `encode_sanity_signature` helper in conftest.py so signature-related tests across `tests/api/` and `tests/lib/` reuse one implementation.

Purpose: prevent the systemic plan-vs-codebase drift Phase 5 saw (acomplete kwargs mismatch hit 7+ plans) by checking in test contracts FIRST and unskipping atomically per downstream plan.

Output: 13 new files under `packages/pipeline/tests/{agents/publisher, api, lib}/` plus conftest.py extension. All tests pytest-collectable, none green yet.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md
@.planning/phases/06-pdf-generation-webhook-chain/06-VALIDATION.md
@packages/pipeline/tests/conftest.py
@packages/pipeline/tests/agents/test_problem.py

<interfaces>
<!-- Phase 5 PdfContent contract (locked) — fixture file MUST match this shape -->
From packages/pipeline/src/eisenbalm_pipeline/agents/problem.py:
```python
class KeyDataPoint(BaseModel):
    stat: str = ""
    source: str = ""

class PdfContent(BaseModel):
    problemStatement: str = Field(default="", description="<=150 words")
    keyDataPoints: list[KeyDataPoint] = Field(
        default_factory=lambda: [KeyDataPoint(), KeyDataPoint(), KeyDataPoint()],
        description="exactly 3 keyDataPoints (Phase 6 PDF layout depends on count=3)",
    )
    interventionMechanism: str = Field(default="", description="<=100 words")
```

From packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py:
```python
WHITELIST_DISPLAY: list[str] = [...]  # 11 fonts; "Playfair Display" is canonical fallback
WHITELIST_BODY: list[str]   = [...]  # 11 fonts; "Source Serif Pro" is canonical fallback
FALLBACK_FONT_DISPLAY: str = "Playfair Display"
FALLBACK_FONT_BODY:    str = "Source Serif Pro"
```

From packages/pipeline/tests/conftest.py (existing fixtures we extend):
```python
@pytest.fixture
def mock_convex_mutation() -> AsyncMock          # canned {"status": "success"}
@pytest.fixture
def mock_openrouter_acomplete() -> AsyncMock     # zero-cost text response
@pytest.fixture
def sample_dispatch_state() -> dict              # minimal DispatchState for unit assembly
```

Sanity signature canonical algorithm (REPLACES API_CONTRACTS §5.3):
```
header  = f"t={timestamp_ms},v1={signature}"
payload = f"{timestamp_ms}.".encode("utf-8") + raw_body_bytes
signature = base64url_no_pad(HMAC_SHA256(secret_utf8, payload))
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Vendor fixtures (TTF + PdfContent JSON + theme JSON) and package __init__.py</name>
  <read_first>
    - packages/pipeline/tests/agents/test_problem.py (see how Phase 5 tests construct sample states)
    - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py (PdfContent shape — exact field names, exactly 3 keyDataPoints)
    - packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py (FALLBACK_FONT_DISPLAY / FALLBACK_FONT_BODY)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Pattern 3 + Pitfall 9)
  </read_first>
  <files>
    - packages/pipeline/tests/agents/publisher/__init__.py
    - packages/pipeline/tests/agents/publisher/fixtures/__init__.py
    - packages/pipeline/tests/agents/publisher/fixtures/tiny.ttf
    - packages/pipeline/tests/agents/publisher/fixtures/sample_pdf_content.json
    - packages/pipeline/tests/agents/publisher/fixtures/sample_theme.json
    - packages/pipeline/tests/api/__init__.py
  </files>
  <action>
1. Create empty `__init__.py` at `packages/pipeline/tests/agents/publisher/__init__.py`, `packages/pipeline/tests/agents/publisher/fixtures/__init__.py`, and `packages/pipeline/tests/api/__init__.py`.

2. Vendor a Liberation Sans Regular TTF (~140KB) at `packages/pipeline/tests/agents/publisher/fixtures/tiny.ttf`. Source priority:
   a. Copy from `/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf` if it exists locally.
   b. Download from https://github.com/liberationfonts/liberation-fonts/releases (use the latest 2.x release; pick `LiberationSans-Regular.ttf`).
   c. File MUST be valid TrueType (binary starts with `0x00 0x01 0x00 0x00`). Verify with `file tests/agents/publisher/fixtures/tiny.ttf` returning `TrueType Font data`.
   d. File MUST be ≤ 200KB to keep tests fast.

3. Write `sample_pdf_content.json` with EXACTLY this content (matches Phase 5 PdfContent shape):
```json
{
  "problemStatement": "Public libraries in rural counties shed staff faster than they shed circulation. Sixty-three rural systems closed branches between 2019 and 2024, but circulation dropped only 8 percent. The work didn't vanish; the people doing it did.",
  "keyDataPoints": [
    {"stat": "63 rural library branches closed 2019-2024", "source": "American Library Association annual survey 2024"},
    {"stat": "8 percent circulation decline over same period", "source": "IMLS Public Libraries Survey FY2023"},
    {"stat": "$1.20 average operating cost per circulation in counties served", "source": "Sage Library Foundation 2024 annual report"}
  ],
  "interventionMechanism": "The Foundation pays for a half-time branch coordinator in counties where the system can no longer afford one. The position is restricted: ordering, scheduling, programming. Not janitorial, not administrative."
}
```

4. Write `sample_theme.json` with EXACTLY this content (uses 2 whitelisted fonts + 4 valid hex):
```json
{
  "primaryColor": "#1D9E75",
  "accentColor": "#B5651D",
  "backgroundColor": "#FAF7F0",
  "textColor": "#1A1A1A",
  "fontDisplay": "Playfair Display",
  "fontBody": "Source Serif Pro",
  "visualDirection": "Warm cream paper, oxblood ink, library-card serif. Restrained."
}
```
  </action>
  <verify>
    <automated>cd packages/pipeline && file tests/agents/publisher/fixtures/tiny.ttf | grep -q "TrueType" && python -c "import json; d=json.load(open('tests/agents/publisher/fixtures/sample_pdf_content.json')); assert len(d['keyDataPoints'])==3 and all('stat' in k and 'source' in k for k in d['keyDataPoints']); print('ok')" && python -c "import json; d=json.load(open('tests/agents/publisher/fixtures/sample_theme.json')); assert d['fontDisplay']=='Playfair Display' and d['fontBody']=='Source Serif Pro'; print('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - `packages/pipeline/tests/agents/publisher/__init__.py` exists (may be empty)
    - `packages/pipeline/tests/api/__init__.py` exists (may be empty)
    - `file packages/pipeline/tests/agents/publisher/fixtures/tiny.ttf` output contains `TrueType`
    - `ls -l packages/pipeline/tests/agents/publisher/fixtures/tiny.ttf` shows size ≤ 200000 bytes
    - `jq '.keyDataPoints | length' packages/pipeline/tests/agents/publisher/fixtures/sample_pdf_content.json` returns `3`
    - `jq -r '.fontDisplay, .fontBody' packages/pipeline/tests/agents/publisher/fixtures/sample_theme.json` returns `Playfair Display\nSource Serif Pro`
    - All four theme hex strings match `/^#[0-9A-Fa-f]{6}$/`: `jq -r '.primaryColor, .accentColor, .backgroundColor, .textColor' .../sample_theme.json | grep -cE '^#[0-9A-Fa-f]{6}$'` returns `4`
  </acceptance_criteria>
  <done>
    Six fixture files exist on disk with correct shape; the TTF is loadable by WeasyPrint; the JSONs are valid against Phase 5 contracts.
  </done>
</task>

<task type="auto">
  <name>Task 2: Extend conftest.py with encode_sanity_signature + webhook_idempotency_clean + mock_vercel_trigger fixtures</name>
  <read_first>
    - packages/pipeline/tests/conftest.py (current shape — see existing fixtures and REQUIRED_ENV_VARS pattern)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Code Examples → "Sanity signature encoder")
    - packages/pipeline/src/eisenbalm_pipeline/graph/checkpointer.py (create_pool for shape parity)
  </read_first>
  <files>
    - packages/pipeline/tests/conftest.py
  </files>
  <action>
Append (do NOT replace existing fixtures) the following to `packages/pipeline/tests/conftest.py`:

```python
# ── Phase 6 — Sanity webhook signature helper ─────────────────────────────
# Mirror of lib/sanity_webhook.verify_sanity_signature so tests can generate
# valid headers without round-tripping through the live verifier.

import base64
import hashlib
import hmac as _hmac_mod  # noqa: E402 — intentional late import


def encode_sanity_signature(body: bytes, ts_ms: int, secret: str) -> str:
    """Produce a valid `sanity-webhook-signature` header for tests.

    Algorithm (mirrors @sanity/webhook v5+ src/signature.ts):
        payload   = f"{ts_ms}.".encode("utf-8") + body
        signature = base64url_no_pad(HMAC_SHA256(secret_utf8, payload))
        header    = f"t={ts_ms},v1={signature}"
    """
    payload = f"{ts_ms}.".encode("utf-8") + body
    mac = _hmac_mod.new(secret.encode("utf-8"), payload, hashlib.sha256).digest()
    sig = base64.urlsafe_b64encode(mac).rstrip(b"=").decode("ascii")
    return f"t={ts_ms},v1={sig}"


@pytest.fixture
def sanity_signature_encoder():
    """Pytest fixture wrapper around encode_sanity_signature."""
    return encode_sanity_signature


# ── Phase 6 — webhook_idempotency table cleanup ───────────────────────────


@pytest.fixture
async def webhook_idempotency_clean():
    """TRUNCATE webhook_idempotency before each test that needs a clean slate.

    Skips if SUPABASE_POSTGRES_URL is unset. Plan 06-03 lands the table via the
    setup-webhook-idempotency CLI; until then TRUNCATE may fail silently.
    """
    missing = _missing_env()
    if missing:
        pytest.skip(f"Required env var not set: {missing}")
    from psycopg_pool import AsyncConnectionPool  # noqa: WPS433
    db_url = os.environ["SUPABASE_POSTGRES_URL"]
    pool = AsyncConnectionPool(
        db_url,
        max_size=2,
        kwargs={"autocommit": True, "prepare_threshold": None},
        open=False,
    )
    await pool.open()
    try:
        async with pool.connection() as conn, conn.cursor() as cur:
            try:
                await cur.execute("TRUNCATE TABLE webhook_idempotency")
            except Exception:  # noqa: BLE001 — table may not yet exist pre-06-03
                pass
        yield pool
    finally:
        await pool.close()


# ── Phase 6 — vercel deploy hook stub fixture ─────────────────────────────


@pytest.fixture
def mock_vercel_trigger():
    """Patch lib.vercel_client.trigger_vercel_deploy. Returns dict marker.

    Tests assert on call_count to verify the deploy hook fired exactly once.
    """
    mock = AsyncMock(return_value={"job": {"id": "test-job-id", "state": "READY", "createdAt": 1}})
    return mock
```

Place new symbols at the END of conftest.py after the existing `sample_dispatch_state` fixture. The `import base64`, `import hashlib`, `import hmac as _hmac_mod` lines stay inline at the section header (matches the existing `from unittest.mock import AsyncMock` late-import pattern at line ~194).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run python -c "from tests.conftest import encode_sanity_signature; ts=1700000000000; sig=encode_sanity_signature(b'{\"hello\":\"world\"}', ts, 'mysecret'); assert sig.startswith(f't={ts},v1='); print('header:', sig); print('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "def encode_sanity_signature" packages/pipeline/tests/conftest.py` returns `1`
    - `grep -c "def sanity_signature_encoder" packages/pipeline/tests/conftest.py` returns `1`
    - `grep -c "def webhook_idempotency_clean" packages/pipeline/tests/conftest.py` returns `1`
    - `grep -c "def mock_vercel_trigger" packages/pipeline/tests/conftest.py` returns `1`
    - `grep -c "base64.urlsafe_b64encode" packages/pipeline/tests/conftest.py` returns at least `1`
    - The Python one-liner in the verify command exits 0 and prints `ok`
    - Existing fixtures still present: `grep -c "def mock_convex_mutation" packages/pipeline/tests/conftest.py` returns `1`
  </acceptance_criteria>
  <done>
    conftest.py additively grows; encode_sanity_signature is importable; downstream signature tests have a shared, correct helper.
  </done>
</task>

<task type="auto">
  <name>Task 3: Write skip-marked test skeletons covering all PDF-* and WHK-* requirements</name>
  <read_first>
    - packages/pipeline/tests/conftest.py (after Task 2 edits — for fixture names to use)
    - packages/pipeline/tests/agents/test_problem.py (Phase 5 pattern for parametric tests)
    - .planning/phases/06-pdf-generation-webhook-chain/06-VALIDATION.md (test→requirement map)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Pattern 1, 3, 5; Pitfalls)
  </read_first>
  <files>
    - packages/pipeline/tests/agents/publisher/test_pdf.py
    - packages/pipeline/tests/agents/publisher/test_publisher.py
    - packages/pipeline/tests/agents/publisher/test_fonts.py
    - packages/pipeline/tests/api/test_webhook_sanity.py
    - packages/pipeline/tests/api/test_runs.py
    - packages/pipeline/tests/lib/test_sanity_webhook.py
    - packages/pipeline/tests/lib/test_idempotency.py
    - packages/pipeline/tests/lib/test_vercel_client.py
  </files>
  <action>
For each file below, create the file with `pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-NN unskips")` markers on every test function. The bodies are EMPTY (`pass` or `...`). The skip reason cites the unskipping plan ID. Test names are LOCKED — downstream plans assert these names exist.

**`tests/agents/publisher/test_pdf.py`** — covers PDF-01, PDF-02 (Plan 06-05 unskips):
```python
"""WeasyPrint renderer tests. Plan 06-05 unskips.

Tests intentionally use REAL WeasyPrint (no mocking) per 06-VALIDATION
"What to Mock vs Hit Real" — WeasyPrint is the thing being tested.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"
TINY_TTF = FIXTURES_DIR / "tiny.ttf"


@pytest.fixture
def pdf_content() -> dict:
    return json.loads((FIXTURES_DIR / "sample_pdf_content.json").read_text())


@pytest.fixture
def theme() -> dict:
    return json.loads((FIXTURES_DIR / "sample_theme.json").read_text())


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-05 unskips (PDF-01)")
def test_render_produces_nonempty_pdf(pdf_content, theme):
    """PDF-01: render_problem_statement_pdf returns non-empty bytes starting with '%PDF'."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-05 unskips (PDF-02)")
def test_pdf_embeds_inline_ttf(pdf_content, theme):
    """PDF-02: PDF bytes contain inlined font (no http://fonts.googleapis.com URLs)."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-05 unskips (PDF-02)")
def test_pdf_inlines_only_two_fonts(pdf_content, theme):
    """PDF-02: only theme.fontDisplay + theme.fontBody are inlined, not all 17."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-05 unskips (PDF-02 Pitfall 2)")
def test_font_configuration_required():
    """PDF-02 Pitfall 2: render without FontConfiguration falls back to system fonts."""
```

**`tests/agents/publisher/test_publisher.py`** — covers PDF-03, WHK-05, WHK-06, WHK-07 (Plan 06-07 unskips):
```python
"""Publisher coroutine integration tests (_run_publisher).

Mocks Sanity httpx via respx; mocks Convex mutations via mock_convex_mutation;
mocks asyncio.sleep + lib.vercel_client.trigger_vercel_deploy to keep tests fast.
Plan 06-07 unskips.
"""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (PDF-03)")
async def test_publisher_uploads_to_sanity(mock_convex_mutation, mock_vercel_trigger):
    """PDF-03: _run_publisher invokes upload_pdf_to_issue with PDF bytes + asset patch."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-05)")
async def test_30s_delay_before_vercel(mock_convex_mutation, mock_vercel_trigger, monkeypatch):
    """WHK-05: asyncio.sleep called with 30.0 BEFORE trigger_vercel_deploy."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-06)")
async def test_publisher_uses_non_cdn_sanity_host():
    """WHK-06: groq_query is called against *.api.sanity.io (NOT *.apicdn.sanity.io)."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-07)")
async def test_completes_convex_writes(mock_convex_mutation, mock_vercel_trigger):
    """WHK-07: After Vercel deploy success, Convex receives status=complete + publisher-deploy event."""
```

**`tests/agents/publisher/test_fonts.py`** — covers PDF-02 (Plan 06-05 unskips):
```python
"""Vendored TTF base64 helper tests. Plan 06-05 unskips."""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-05 unskips (PDF-02)")
def test_font_to_base64_roundtrip():
    """PDF-02: _font_to_base64 returns a string that round-trips back to TTF bytes."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-05 unskips (PDF-02 Pitfall 9)")
def test_font_filename_normalization():
    """Pitfall 9: 'Playfair Display' + 'Regular' → 'PlayfairDisplay-Regular.ttf'."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-05 unskips (PDF-02 Pitfall 9)")
def test_missing_font_raises_clear_error():
    """Pitfall 9: Unknown family raises FileNotFoundError with diagnostic message."""
```

**`tests/api/test_webhook_sanity.py`** — covers WHK-01, WHK-02, WHK-03, WHK-04 (Plan 06-07 unskips):
```python
"""Sanity webhook handler tests. Plan 06-07 unskips."""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-01)")
async def test_route_exists(client):
    """WHK-01: POST /webhook/sanity-publish returns < 500 for ANY input (handler exists)."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-02)")
async def test_signature_accept_and_reject(client, sanity_signature_encoder, monkeypatch):
    """WHK-02: valid signature → 200; tampered body → 401."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-03)")
async def test_age_rejection(client, sanity_signature_encoder, monkeypatch):
    """WHK-03: timestamp older than 5 minutes → 410 Gone."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-04)")
async def test_idempotency_dedup(client, sanity_signature_encoder, webhook_idempotency_clean, monkeypatch):
    """WHK-04: same idempotency-key sent twice → publisher fires exactly once."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-04 Pitfall 6)")
async def test_missing_idempotency_proceeds(client, sanity_signature_encoder, monkeypatch):
    """WHK-04 Pitfall 6: missing idempotency-key header is allowed (proceeds with warning)."""
```

**`tests/api/test_runs.py`** — covers WHK-08 (Plan 06-07 unskips):
```python
"""Manual publish fallback tests. Plan 06-07 unskips."""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-08)")
async def test_manual_publish_invokes_publisher(client, monkeypatch):
    """WHK-08: POST /run/{runId}/publish invokes the same _run_publisher coroutine."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-07 unskips (WHK-08)")
async def test_manual_publish_requires_trigger_secret(client):
    """WHK-08: trigger-secret guard same as /run/weekly + /run/{id}/resume."""
```

**`tests/lib/test_sanity_webhook.py`** — covers WHK-02, WHK-03 (Plan 06-04 unskips):
```python
"""Sanity signature verifier unit tests. Plan 06-04 unskips."""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-04 unskips (WHK-02)")
def test_valid_signature_returns_timestamp(sanity_signature_encoder):
    """WHK-02: verify_sanity_signature returns the parsed ts_ms on success."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-04 unskips (WHK-02 Pitfall 1)")
def test_raw_body_required(sanity_signature_encoder):
    """WHK-02 Pitfall 1: HMAC over re-serialized JSON FAILS — must use raw bytes."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-04 unskips (WHK-02)")
def test_tampered_body_rejected(sanity_signature_encoder):
    """WHK-02: changing a single byte in body → SignatureMismatchError."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-04 unskips (WHK-03)")
def test_expired_signature_rejected(sanity_signature_encoder):
    """WHK-03: ts_ms older than now-300_000 → SignatureExpiredError."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-04 unskips (WHK-03 Pitfall 4)")
def test_future_skew_rejected(sanity_signature_encoder):
    """WHK-03 Pitfall 4: ts_ms newer than now+300_000 → SignatureExpiredError."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-04 unskips (WHK-02)")
def test_malformed_header_rejected():
    """WHK-02: header missing 't=' or 'v1=' → SignatureFormatError."""
```

**`tests/lib/test_idempotency.py`** — covers WHK-04 (Plan 06-04 unskips):
```python
"""Postgres webhook_idempotency tests. Plan 06-04 unskips."""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-04 unskips (WHK-04)")
async def test_dedup_returns_true_on_first(webhook_idempotency_clean):
    """WHK-04: first claim_idempotency_key call returns True."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-04 unskips (WHK-04)")
async def test_dedup_returns_false_on_second(webhook_idempotency_clean):
    """WHK-04: second call with same (source, idempotency_key) returns False."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-04 unskips (WHK-04)")
async def test_different_source_independent(webhook_idempotency_clean):
    """WHK-04: same idempotency_key under different source values are independent."""
```

**`tests/lib/test_vercel_client.py`** — covers WHK-05 (Plan 06-04 unskips):
```python
"""Vercel deploy hook trigger tests. Plan 06-04 unskips."""
from __future__ import annotations

import pytest


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-04 unskips (WHK-05)")
async def test_trigger_posts_to_hook_url(monkeypatch):
    """WHK-05: trigger_vercel_deploy POSTs (no body, no auth) to VERCEL_DEPLOY_HOOK_URL."""


@pytest.mark.skip(reason="Wave 0 skeleton — Plan 06-04 unskips (WHK-05)")
async def test_trigger_raises_on_non_2xx(monkeypatch):
    """WHK-05: 4xx/5xx from Vercel raises so caller can log + continue."""
```
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest --collect-only tests/agents/publisher tests/api tests/lib/test_sanity_webhook.py tests/lib/test_idempotency.py tests/lib/test_vercel_client.py 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `pytest --collect-only tests/agents/publisher tests/api tests/lib/test_sanity_webhook.py tests/lib/test_idempotency.py tests/lib/test_vercel_client.py` produces no `error` lines and collects ≥ 24 tests
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/agents/publisher/test_pdf.py` returns `4`
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/agents/publisher/test_publisher.py` returns `4`
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/agents/publisher/test_fonts.py` returns `3`
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/api/test_webhook_sanity.py` returns `5`
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/api/test_runs.py` returns `2`
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/lib/test_sanity_webhook.py` returns `6`
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/lib/test_idempotency.py` returns `3`
    - `grep -c "@pytest.mark.skip" packages/pipeline/tests/lib/test_vercel_client.py` returns `2`
    - `cd packages/pipeline && uv run pytest tests/agents/publisher tests/api tests/lib/test_sanity_webhook.py tests/lib/test_idempotency.py tests/lib/test_vercel_client.py 2>&1 | tail -1` shows ≥ 24 skipped, 0 failed
  </acceptance_criteria>
  <done>
    All 8 test files exist with skip-marked skeletons; pytest --collect-only is clean; downstream plans can unskip incrementally without ImportError.
  </done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/ 2>&1 | tail -3` shows no NEW failures (existing skipped tests remain skipped; new 24+ skipped tests added)
- `cd packages/pipeline && uv run pytest --collect-only tests/ 2>&1 | grep -c "error"` returns `0`
- All 13+ new file paths exist and are committed
</verification>

<success_criteria>
1. 24+ skip-marked tests collected across `tests/agents/publisher/`, `tests/api/`, `tests/lib/`
2. `encode_sanity_signature` helper exists in conftest.py and produces `t=...,v1=...` shape headers
3. `tiny.ttf` is a valid TrueType binary ≤ 200KB
4. `sample_pdf_content.json` and `sample_theme.json` match Phase 5 PdfContent + theme contracts exactly
5. Pre-existing Phase 5 test suite remains green (no regression)
</success_criteria>

<output>
After completion, create `.planning/phases/06-pdf-generation-webhook-chain/06-pdf-generation-webhook-chain-01-SUMMARY.md` summarizing: test count by file, fixture source for tiny.ttf, any test names that changed from this plan's template (so downstream plans grep for the actual names).
</output>
