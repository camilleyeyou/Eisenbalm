# Phase 6: PDF Generation + Webhook Chain — Research

**Researched:** 2026-05-18
**Domain:** WeasyPrint base64 font bundling + Sanity HMAC webhook + Supabase idempotency + Vercel deploy hook orchestration
**Confidence:** HIGH (Sanity signature algorithm + WeasyPrint contract verified against upstream sources; webhook idempotency pattern is a well-established postgres recipe)

## Summary

Phase 6 closes the loop between Andrew clicking Publish in Sanity Studio and a live, deployed issue on Vercel. The Publisher needs to (a) render a themed PDF of the Problem Statement from `pdfContent` already produced by Phase 5's ProblemWriter, (b) upload that PDF as a Sanity asset and patch `weeklyIssue.problemPdf`, and (c) listen for Sanity's `weeklyIssue` publish webhook, deduplicate it, wait for CDN propagation, fire a Vercel deploy hook, and flip Convex `pipelineRuns.status` to `complete`. Phase 5 already shipped Pydantic-locked `PdfContent` (problemStatement/keyDataPoints[3]/interventionMechanism), the font whitelist (17 Andrew-approved fonts), the theme contract (4 hex + 2 fonts + visualDirection), and a stub webhook endpoint at the correct path — Phase 6 is mostly hardening, not greenfield design.

Three findings change the plan vs. what's in `docs/API_CONTRACTS.md`:

1. **The Sanity signature header format is wrong in API_CONTRACTS.** §5.3 shows `sha256=<hex>` but the actual format is `t={unix_ms},v1={base64url}` where the HMAC is over `{timestamp}.{stringified_payload}`. Confirmed against the upstream `@sanity/webhook` source. The Python implementation must split the header, validate the timestamp is fresh (the 5-minute age check), recompute base64url(hmac_sha256(secret, f"{t}.{body}")), and compare-digest. The `sanity-transaction-time` header is a *separate* ISO 8601 timestamp Sanity adds for monitoring purposes — usable for the age check too, but the canonical age signal is the `t=` integer inside the signature header.
2. **The `weeklyIssue.problemStatement` Sanity schema does NOT have a `pdfContent` subfield.** Phase 5 produces `pdfContent` in DispatchState and stores it intent-only — the Sanity write at the end of Phase 5 only persists `{headline, body}`. Either Phase 6 (a) amends the schema to add `pdfContent` as a Sanity object with sub-fields `problemStatement/keyDataPoints/interventionMechanism`, then patches the existing draft writer to include it, or (b) reads `pdfContent` directly from the LangGraph checkpoint via the runId. Option (a) matches the requirement language ("uses `weeklyIssue.problemStatement.pdfContent`") and is the only durable answer — checkpoint state is ephemeral past a deployment.
3. **WeasyPrint base64 font bundling needs TTF, not WOFF2.** The two documented failure issues referenced in the roadmap (#2031 = network timeout fetching Google Fonts, #2126 = Google Font debugging confusion) both describe the *anti-pattern* PDF-02 prohibits: HTTP-loading Google Fonts at PDF render time. Best practice is to vendor TTF files into the repo (Google Fonts API returns TTF at `fonts.gstatic.com/s/.../*.ttf`) and inline them as `url(data:font/truetype;base64,...)` inside a per-render generated `<style>` block. WeasyPrint's `pythontutorials.net` tutorial confirms "WeasyPrint prefers .ttf/.otf over .woff2." A `FontConfiguration` instance must be passed to both `HTML(...)` and `write_pdf(...)` for `@font-face` to resolve.

**Primary recommendation:** Add a small Sanity schema patch to embed `pdfContent` under `problemStatement`, vendor the 17 whitelisted fonts as TTF under `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/fonts/`, build a Jinja2 + WeasyPrint renderer that inlines exactly the two fonts the issue uses as base64 data URLs (not all 17), and rewrite the webhook handler to verify the Sanity `t=...,v1=...` signature, dedupe via a Supabase `webhook_idempotency` table (UNIQUE on `idempotency_key`, 7-day reaper), and fire a Vercel deploy hook after `asyncio.sleep(30)`. Reuse the existing `asyncio.create_task` + `app.state.background_tasks` pattern (Phase 4 already established). The manual `POST /run/{runId}/publish` endpoint should run the *same* underlying Publisher coroutine the webhook does — single source of truth, no parallel implementations.

## Project Constraints (from CLAUDE.md)

The project CLAUDE.md is authoritative on these points relevant to Phase 6 — the plan must comply:

- **Stack is locked.** WeasyPrint or Playwright is allowed for PDF generation; the brief lists WeasyPrint first and the Dockerfile already installs WeasyPrint system deps. Choose WeasyPrint. Do not introduce Playwright. (CLAUDE.md `## Constraints` "tech stack locked, do not substitute"; brief §"PDF generation"; Dockerfile lines 27-33.)
- **Sanity v3 client must be Python via raw httpx** — no maintained Python SDK. Use the existing `lib/sanity_client.py` helpers (`upload_pdf_to_issue`, `write_issue_draft`, `groq_query`). (CLAUDE.md `## Stack`; existing `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`.)
- **Convex writes are non-blocking** (CLAUDE.md `## Cross-Cutting Concerns` → "Convex mutations: Failures are non-blocking… Log the error but do not halt the pipeline."). Use `convex_mutation_safe` for the `publisher-deploy` event and `pipelineRuns:updateStatus` to `complete`.
- **Sanity webhook handler MUST return 200 immediately.** Never make Sanity wait for Publisher to complete. (CLAUDE.md `## Error Handling Rules` line 1307; `docs/API_CONTRACTS.md` line 1307.)
- **HMAC signature verification has no dev bypass.** No environment-variable shortcut may skip signature check on the Sanity webhook (mirrors the Stripe rule that's documented in REQ CMR-05 / CLAUDE.md voice on "airtight").
- **WeasyPrint emits HTML that lives inside `iframe srcdoc sandbox="allow-scripts"`** — N/A here, that's the Game agent's concern. Publisher emits PDFs that are downloaded, not iframed.
- **Theme color values must be validated** as 6-digit hex strings before injection (CLAUDE.md `## Constraints` "must validate hex colors and font names"; WEB-07/WEB-08). The PDF renderer must reuse the *same* validators (lib/wcag.py validate_theme + agents/design/font_whitelist.FONT_WHITELIST) so the PDF can't render a hex string the issue page rejected. **Do not duplicate validation logic**: import from existing modules.
- **GSD workflow enforced** — only edits via `/gsd:execute-phase`. Phase 6 plans must be authored via the planner.
- **One product, one charity per week** — irrelevant to Phase 6 mechanics but the PDF is the "narrative framework sales deck" for the featured charity (brief §"PDF generation"). Aesthetic must match Jesse voice (dry, precise, no winking).

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WeasyPrint | 68.1 (released 2026-02-06) | HTML+CSS → PDF renderer | Brief locks this choice; Dockerfile already installs system deps; produces print-quality PDFs from semantic HTML without a headless browser. |
| Jinja2 | 3.1.6 | HTML template engine for the PDF | Tiny, ubiquitous, plays well with WeasyPrint per `dantebytes.com/generating-pdfs-from-html-with-weasyprint-and-jinja2-python/`. Not yet in `pyproject.toml`. |
| httpx | 0.28.1 (already pinned) | Sanity asset upload + Vercel deploy hook POST | Already module-shared (`get_client()` in `lib/sanity_client.py`, `lib/convex_client.py`). Reuse — do not add `requests`. |
| psycopg[binary] | >=3.2,<4 (already pinned) | Supabase Postgres connection for idempotency table | Pool already exists at `app.state.pool`. Reuse the AsyncConnectionPool from `graph/checkpointer.create_pool`. |
| python-slugify | 8.0.4 (already pinned) | Filename safety for Sanity asset upload | Already used; ensures PDF filename stays ASCII-safe. |
| stdlib `hmac` + `hashlib` + `base64` | 3.11 | Signature verification | No third-party dep needed; constant-time compare via `hmac.compare_digest`. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `weasyprint.text.fonts.FontConfiguration` | bundled with WeasyPrint | Per-PDF font isolation | Required to pass `@font-face` rules through `CSS(..., font_config=fc)`. Without it WeasyPrint won't resolve `@font-face` declarations. Construct once per `write_pdf` call. |
| `pydyf` | >=0.11.0 | Low-level PDF object writer | Pulled in by WeasyPrint; no direct use. |
| `Pillow` | >=9.1.0 | Image rasterization for PDF | Pulled in by WeasyPrint; PDF may contain charity logo / images later (out of scope for PDF-01 but pre-installed). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| WeasyPrint | Playwright + Chromium | Higher fidelity (CSS Grid + JS), but doubles the runtime image and adds 200MB. Brief explicitly says "WeasyPrint or Playwright" — WeasyPrint chosen by Dockerfile precedent. |
| Jinja2 | Plain `.format()` string | Jinja2 wins on multi-line HTML templating + escaping safety; readability of the PDF template wins out over zero-dep purity. |
| Custom HMAC parsing | `@sanity/webhook` JS lib | Library is JS-only; Python port is ~15 lines. Reimplementing is the correct call — no Python equivalent exists. |
| Supabase idempotency table | Redis | Project already has Supabase Postgres + a pool open in `app.state.pool`. Redis would be a new infra dependency for a single counter use case. Postgres `INSERT … ON CONFLICT DO NOTHING` is atomic and sufficient. |
| `BackgroundTasks` for Publisher | `asyncio.create_task` + strong-ref set | Phase 4 already chose `create_task` — Pitfall 4 says BackgroundTasks is cancelled on client disconnect, leaving `pipelineRuns.status` stuck. Phase 6 inherits this decision (see `api/runs.py` and `04-RESEARCH.md` Pattern 3). |

**Installation:**

```bash
# Add to packages/pipeline/pyproject.toml:
#   "weasyprint==68.1",
#   "jinja2==3.1.6",
# Then:
cd packages/pipeline && uv add weasyprint==68.1 jinja2==3.1.6
```

**Version verification (run before plan publishes):**
```bash
curl -sL https://pypi.org/pypi/weasyprint/json | jq -r '.info.version, .releases | to_entries | last | .key + " " + .value[0].upload_time_iso_8601'
curl -sL https://pypi.org/pypi/jinja2/json    | jq -r '.info.version'
```
At research time: `weasyprint==68.1` (2026-02-06), `jinja2==3.1.6`. System libs already installed by Dockerfile lines 27-33 (`libpango`, `libcairo2`, `libgdk-pixbuf-2.0-0`, `fontconfig`, `fonts-liberation`). No Dockerfile change needed for runtime libs; only adding the two Python deps + the vendored `fonts/` directory.

## Architecture Patterns

### Recommended Project Structure

```
packages/pipeline/
├── src/eisenbalm_pipeline/
│   ├── agents/
│   │   └── publisher/                  # Promote agents/publisher.py → package (mirrors design/, qa/)
│   │       ├── __init__.py             # @agent_node publisher (kept compatible with Phase 4 stub import)
│   │       ├── pdf.py                  # WeasyPrint renderer + Jinja2 template loader
│   │       ├── fonts.py                # base64 helpers + ttf path resolver
│   │       └── templates/
│   │           └── problem_statement.html.j2
│   │           └── problem_statement.css.j2   # OR inline in .html.j2
│   ├── api/
│   │   └── webhooks.py                 # ← rewritten in Phase 6 (Phase 4 stub today)
│   ├── lib/
│   │   ├── idempotency.py              # NEW — Supabase webhook_idempotency table
│   │   ├── sanity_webhook.py           # NEW — Sanity signature verifier (HMAC + timestamp split)
│   │   ├── sanity_client.py            # EXTEND — already has upload_pdf_to_issue (Phase 4 shipped, unused)
│   │   └── vercel_client.py            # NEW — single-purpose async POST
│   └── ...
├── fonts/                              # NEW — vendored TTF for Phase 5 whitelist
│   ├── PlayfairDisplay-Regular.ttf
│   ├── PlayfairDisplay-Bold.ttf
│   ├── SourceSerifPro-Regular.ttf
│   ├── … (one Regular + Bold per of the 17 whitelisted fonts)
│   └── LICENSES/                       # SIL OFL licenses per font (required by Google Fonts)
└── tests/
    ├── agents/
    │   └── publisher/
    │       ├── test_pdf.py             # WeasyPrint real render: smoke pdf bytes > 0, ttf bytes present
    │       └── test_fonts.py           # base64 encode roundtrip
    ├── api/
    │   └── test_webhook_sanity.py      # signature accept/reject + age + idempotency
    └── lib/
        ├── test_idempotency.py
        └── test_sanity_webhook.py
```

### Pattern 1: HMAC-SHA256 signature verification (Sanity format)

**What:** Parse `sanity-webhook-signature` as `t={ms},v1={base64url}`. Verify body integrity AND timestamp freshness in one step.

**When to use:** Every request hitting `/webhook/sanity-publish` before any other work.

**Example:**
```python
# packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py
# Source: github.com/sanity-io/webhook-toolkit src/signature.ts (verbatim algorithm port)
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
    """Timestamp older than MAX_AGE_MS — WHK-03."""


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
      payload = f"{timestamp_ms}.{body_as_utf8_str}"
      signature = base64url_no_pad(HMAC_SHA256(secret_utf8, payload_utf8))
      header   = f"t={timestamp_ms},v1={signature}"
    """
    if not signature_header:
        raise SignatureFormatError("Missing sanity-webhook-signature header")
    m = SIGNATURE_RE.match(signature_header.strip())
    if not m:
        raise SignatureFormatError("Bad signature header format")
    ts_ms = int(m.group(1))
    provided_sig = m.group(2)

    # WHK-03: reject if older than 5 minutes
    now = now_ms if now_ms is not None else int(time.time() * 1000)
    if now - ts_ms > MAX_AGE_MS:
        raise SignatureExpiredError(
            f"Signature timestamp older than {MAX_AGE_MS}ms"
        )
    # Also reject negative/future skew > MAX_AGE_MS to protect clock drift
    if ts_ms - now > MAX_AGE_MS:
        raise SignatureExpiredError("Signature timestamp too far in future")

    payload = f"{ts_ms}.".encode("utf-8") + raw_body
    mac = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).digest()
    expected = _b64url_no_pad(mac)
    if not hmac.compare_digest(expected, provided_sig):
        raise SignatureMismatchError("Signature mismatch")
    return ts_ms
```

CRITICAL: this REPLACES the `sha256=<hex>` shape in `docs/API_CONTRACTS.md §5.3`. The plan must amend API_CONTRACTS with a strikethrough+correct version. Source: [github.com/sanity-io/webhook-toolkit/blob/main/src/signature.ts](https://github.com/sanity-io/webhook-toolkit/blob/main/src/signature.ts).

### Pattern 2: Idempotency-key dedup via Supabase + INSERT ON CONFLICT

**What:** Create a `webhook_idempotency` Postgres table with a UNIQUE index on `idempotency_key`. Each webhook attempt fires an `INSERT … ON CONFLICT DO NOTHING RETURNING id`. If `RETURNING id` is None, the request is a duplicate — return `{ok: true, duplicate: true}` and stop.

**When to use:** Right after signature verification, before launching the Publisher coroutine.

**Schema:**
```sql
-- One-shot DDL — runs in CLI setup-webhook-idempotency alongside setup-checkpointer
CREATE TABLE IF NOT EXISTS webhook_idempotency (
    id              BIGSERIAL   PRIMARY KEY,
    idempotency_key TEXT        NOT NULL,
    source          TEXT        NOT NULL,   -- 'sanity-publish' | future sources
    run_id          TEXT        NULL,        -- for cross-reference to pipelineRuns
    received_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT webhook_idempotency_key_source UNIQUE (source, idempotency_key)
);
CREATE INDEX IF NOT EXISTS webhook_idempotency_received_at_idx
    ON webhook_idempotency (received_at);
```

**Insert pattern:**
```python
# packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py
from psycopg_pool import AsyncConnectionPool

async def claim_idempotency_key(
    pool: AsyncConnectionPool,
    *,
    source: str,
    idempotency_key: str,
    run_id: str | None,
) -> bool:
    """Returns True if this is the first time we've seen the key (caller should
    proceed). Returns False if duplicate (caller should short-circuit).
    """
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            """
            INSERT INTO webhook_idempotency (idempotency_key, source, run_id)
            VALUES (%s, %s, %s)
            ON CONFLICT (source, idempotency_key) DO NOTHING
            RETURNING id
            """,
            (idempotency_key, source, run_id),
        )
        row = await cur.fetchone()
        return row is not None
```

**Retention:** Sanity retries for up to "several hours" (their docs don't give an exact figure — assume conservative 24h). Run a daily reaper to delete rows older than 7 days. Add to `cli.py` as `cleanup-idempotency` or rely on Supabase scheduled SQL. **Plan can defer the reaper to a future operational task** — the table grows ~1 row per published issue (~52/year), so the table is microscopic for a year+.

Source: [brandur.org/idempotency-keys](https://brandur.org/idempotency-keys) (72h retention is canonical; 7d is conservative), [hookdeck.com/webhooks/guides/implement-webhook-idempotency](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency).

### Pattern 3: WeasyPrint with base64-inlined TTF fonts

**What:** Build a Jinja2 HTML template, inject the two issue fonts (one display, one body) as base64 `data:font/truetype` URLs inside `<style>` `@font-face` rules. WeasyPrint resolves them locally without HTTP traffic.

**Why TTF not WOFF2:** WeasyPrint documentation + community tutorials say "prefers .ttf/.otf over .woff2" — TTF reliably works in WeasyPrint's font pipeline; WOFF2 has historical edge cases (#1692 still open in 2026). All 17 whitelisted fonts are available as TTF on Google Fonts.

**Example:**
```python
# packages/pipeline/src/eisenbalm_pipeline/agents/publisher/pdf.py
from __future__ import annotations

import base64
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML, CSS
from weasyprint.text.fonts import FontConfiguration

TEMPLATES_DIR = Path(__file__).parent / "templates"
FONTS_DIR = Path(__file__).parents[3].parent / "fonts"   # packages/pipeline/fonts/

_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES_DIR)),
    autoescape=select_autoescape(["html"]),
)


def _font_filename(family: str, weight: str) -> str:
    # 'Playfair Display' + 'Regular' -> 'PlayfairDisplay-Regular.ttf'
    return f"{family.replace(' ', '')}-{weight}.ttf"


def _font_to_base64(family: str, weight: str = "Regular") -> str:
    path = FONTS_DIR / _font_filename(family, weight)
    if not path.exists():
        raise FileNotFoundError(
            f"Vendored TTF not found for '{family} {weight}' at {path}. "
            f"Phase 6 setup must vendor all whitelisted fonts."
        )
    return base64.b64encode(path.read_bytes()).decode("ascii")


def render_problem_statement_pdf(
    *,
    issue_number: int,
    charity_name: str,
    pdf_content: dict,  # PdfContent shape from Phase 5
    theme: dict,        # Theme shape from DesignAgent
) -> bytes:
    """Returns PDF bytes ready for upload_pdf_to_issue."""
    # 1. Build font CSS blocks (inline base64 — no HTTP)
    fonts_css = []
    for family in [theme["fontDisplay"], theme["fontBody"]]:
        for weight, css_weight in [("Regular", "normal"), ("Bold", "bold")]:
            try:
                b64 = _font_to_base64(family, weight)
            except FileNotFoundError:
                if weight == "Bold":
                    continue  # Bold is optional; Regular is required
                raise
            fonts_css.append(
                f"@font-face {{ font-family: '{family}'; "
                f"font-weight: {css_weight}; "
                f"src: url(data:font/truetype;charset=utf-8;base64,{b64}) "
                f"format('truetype'); }}"
            )

    # 2. Render Jinja2 template
    template = _env.get_template("problem_statement.html.j2")
    html = template.render(
        issue_number=issue_number,
        charity_name=charity_name,
        pdf_content=pdf_content,
        theme=theme,
        fonts_css="\n".join(fonts_css),
    )

    # 3. WeasyPrint with FontConfiguration (REQUIRED for @font-face)
    font_config = FontConfiguration()
    pdf_bytes = HTML(string=html).write_pdf(font_config=font_config)
    return pdf_bytes
```

Source: [doc.courtbouillon.org/weasyprint/stable/first_steps.html](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html) (FontConfiguration usage), [pythontutorials.net/blog/how-to-use-custom-font-with-weasyprint/](https://www.pythontutorials.net/blog/how-to-use-custom-font-with-weasyprint/) (TTF over WOFF2), [github.com/Kozea/WeasyPrint/issues/1692](https://github.com/Kozea/WeasyPrint/issues/1692) (base64 data URL exists but is finicky).

### Pattern 4: Sanity webhook handler — return 200 immediately, do work in background

**What:** Verify signature + age + idempotency synchronously (cheap), then launch the Publisher via `asyncio.create_task` with the strong-ref set already on `app.state.background_tasks`. Return 200 in <50ms. Background coroutine: fetch issue via Sanity with `useCdn: false`, render PDF, upload, patch, sleep 30s, fire Vercel deploy hook, update Convex.

**Example:**
```python
# packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py (rewritten)
@router.post("/webhook/sanity-publish")
async def sanity_publish(request: Request) -> dict:
    secret = os.environ["SANITY_WEBHOOK_SECRET"]
    raw = await request.body()                                 # WHK-02: raw body
    sig_header = request.headers.get(SIGNATURE_HEADER_NAME)
    try:
        ts_ms = verify_sanity_signature(raw, sig_header, secret)  # WHK-02 + WHK-03
    except SignatureExpiredError:
        raise HTTPException(status_code=410, detail="Signature too old")  # 410 Gone — clearer than 401
    except SignatureError as e:
        raise HTTPException(status_code=401, detail=str(e))

    payload = json.loads(raw)
    if payload.get("status") != "published":
        return {"ok": True, "skipped": "not-published"}

    # WHK-04: idempotency-key dedup
    idem = request.headers.get("idempotency-key")
    if idem and request.app.state.pool is not None:
        first = await claim_idempotency_key(
            request.app.state.pool,
            source="sanity-publish",
            idempotency_key=idem,
            run_id=payload.get("runId"),
        )
        if not first:
            return {"ok": True, "duplicate": True}

    # Launch background — strong-ref'd, asyncio.create_task pattern (research §3)
    task = asyncio.create_task(_run_publisher(
        request.app,
        issue_id=payload["_id"],
        issue_number=payload["issueNumber"],
        run_id=payload.get("runId"),
    ))
    request.app.state.background_tasks.add(task)
    task.add_done_callback(request.app.state.background_tasks.discard)

    return {"ok": True, "scheduled": True}
```

### Pattern 5: Publisher pipeline (real, replacing Phase 4 stub)

```python
# packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
async def _run_publisher(app, *, issue_id: str, issue_number: int, run_id: str | None) -> None:
    """The single Publisher coroutine — invoked by both webhook + manual fallback.

    Steps (all best-effort with Convex non-blocking; Sanity write halts on failure):
      1. Fetch issue with useCdn=false (WHK-06).
      2. Render Problem Statement PDF.
      3. Upload PDF to Sanity (lib/sanity_client.upload_pdf_to_issue — exists).
      4. asyncio.sleep(30)                                   # WHK-05 CDN propagation.
      5. POST Vercel deploy hook (lib/vercel_client.trigger).
      6. Update Convex pipelineRuns.status = 'complete' + emit publisher-deploy.
    """
    sanity_http = sanity_client.get_client()
    issue = await sanity_client.groq_query(
        QUERY_ISSUE_FOR_PUBLISH, params={"id": issue_id}
    )                                              # WHK-06: groq_query has no CDN
    # ... PDF gen + upload + sleep + vercel + convex
```

### Anti-Patterns to Avoid

- **HTTP-loading Google Fonts inside the PDF template.** Documented to fail (issue #2031 was a 60s read timeout fetching fonts.googleapis.com; #2126 was hours of debugging Google Fonts in WeasyPrint). PDF-02 requires base64-inline.
- **Trusting `await request.json()` for signature verification.** The HMAC is computed over the raw bytes; FastAPI's automatic JSON parsing re-encodes the body and breaks the signature. Always read `raw = await request.body()` *before* anything else.
- **Putting the 30-second sleep inside the webhook request handler.** Sanity will time out and retry. The sleep happens in the *background* coroutine after the 200 has already returned.
- **Inserting all 17 fonts into every PDF.** Only the two fonts the issue actually uses (`theme.fontDisplay`, `theme.fontBody`) should be inlined. Otherwise each PDF is ~5MB+ of unused font data.
- **`asyncio.sleep(30)` inside `BackgroundTasks`.** BackgroundTasks is tied to request lifecycle; the sleep + everything after may be cancelled when the client disconnects (Phase 4 Pitfall 4). Use `asyncio.create_task` per the established Phase 4 pattern.
- **Hand-rolled timestamp parsing of `sanity-transaction-time`.** It's ISO 8601 (per Sanity datetime docs), but the canonical age signal is already inside the signature header (`t=`). Treating `sanity-transaction-time` as the primary age source forces a second parser. Use it as a *fallback* if `t=` is somehow missing — but the signature parser already does the age math.
- **Manually building Portable Text for `pdfContent`.** The pdfContent payload is structured JSON (`problemStatement: str`, `keyDataPoints: [{stat, source}]*3`, `interventionMechanism: str`) — it stays as JSON for the PDF renderer, not as Portable Text.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML → PDF | Custom HTML parser + PDF writer | WeasyPrint 68.1 | 5+ years of mature CSS handling, Pango for typography, bundled bitmap/variable font support. |
| HTML templating with safe escaping | Python `str.format` | Jinja2 | XSS protection via `select_autoescape`, ergonomic loops/conditionals, file-based templates. |
| Idempotency key tracking | In-memory dict | Postgres `UNIQUE` + `ON CONFLICT DO NOTHING` | Survives restart; atomic guarantee Sanity's retries can't beat. |
| HMAC signature verification | `==` string compare | `hmac.compare_digest` | Constant-time — defeats timing oracle attacks on the signature. |
| Vendored Google Fonts | Manual ZIP download | Direct TTF fetch from `fonts.gstatic.com/s/.../*.ttf` via Google Fonts Developer API | Reproducible; license files (SIL OFL) come from same source. |
| Background task lifecycle | Threading | `asyncio.create_task` + `app.state.background_tasks` set | Phase 4 already chose this; consistency. |
| Sanity asset upload | New helper | Existing `lib/sanity_client.upload_pdf_to_issue` | Phase 4 shipped it as a stub-Publisher contract — wire it, don't rewrite. |
| Sanity GROQ read | New helper | Existing `lib/sanity_client.groq_query` | Used by Scout + Calibrator; works without CDN by default (raw httpx GET against `*.api.sanity.io`, NOT `*.apicdn.sanity.io`). |

**Key insight:** Phase 4 left exactly the right Phase 6 surface area:
- `lib/sanity_client.upload_pdf_to_issue` — ready to call, has the `problemPdf.asset` patch wired.
- `lib/sanity_client.groq_query` — ready for the `useCdn: false` fetch (its base URL is `*.api.sanity.io`, which is non-CDN by definition; WHK-06 is satisfied for free).
- `agents/publisher.py` — stub returns `awaiting-review` to Convex; Phase 6 promotes to `publisher/` package and adds the PDF + Vercel chain.
- `api/webhooks.py` — stub returns 200; Phase 6 replaces with real verifier.
- `api/runs.py::manual_publish` — stub at `POST /run/{run_id}/publish` (WHK-08); Phase 6 wires it to the same `_run_publisher` coroutine the webhook calls.

## Runtime State Inventory

Not a rename/refactor phase — this section is intentionally omitted.

## Common Pitfalls

### Pitfall 1: Signature mismatch from re-serialized JSON
**What goes wrong:** Plan author reads `payload = await request.json()` first, then hashes `json.dumps(payload)` for verification. Round-trip changes whitespace/key-order. HMAC fails. Returns 401 to legitimate Sanity webhook.
**Why it happens:** Pydantic/FastAPI request models parse the body lazily; once `.json()` is called the raw body may be consumed.
**How to avoid:** Always call `raw = await request.body()` FIRST in the handler, compute HMAC over `raw`, then `json.loads(raw)` for the parsed payload.
**Warning signs:** Test against a fixture payload generated by `encode_sanity_signature(payload, ts_ms, secret)` (round-trip in the test). If the test passes but live webhooks fail, you've hit body-consumption-before-hash.

### Pitfall 2: WeasyPrint `@font-face` ignored without `FontConfiguration`
**What goes wrong:** PDF renders in system default fonts (DejaVu) even though `@font-face` rules are in the CSS.
**Why it happens:** WeasyPrint needs an explicit `font_config: FontConfiguration` argument to BOTH the CSS object (when using one) AND the `write_pdf` call. Without it, `@font-face` is silently dropped.
**How to avoid:** Always: `fc = FontConfiguration(); HTML(string=html).write_pdf(font_config=fc)`. Construct one `fc` per render; do not memoize globally — the `FontConfiguration` aggregates state.
**Warning signs:** `pdftotext output.pdf -` shows the text but PDF metadata says "DejaVuSans" instead of the requested font. Test: assert `b'PlayfairDisplay' in pdf_bytes` (the font name embedded by WeasyPrint).

### Pitfall 3: Base64 font data too large for inline (>5MB PDF)
**What goes wrong:** Inlining all 17 whitelisted fonts plus Bold variants in every PDF balloons file size to 50MB+; PDF download stalls; Sanity asset upload times out.
**Why it happens:** WHK-02 says "fonts come from the Phase 5 whitelist" — naively, that means *all* of them. Actually only the two used by this issue need inlining.
**How to avoid:** Inline only `theme.fontDisplay` and `theme.fontBody`. Skip Bold variants if not used. Phase 5 design agent only emits 2 family names; honor that.
**Warning signs:** Generated PDF is >5MB. Investigate which `@font-face` rules ended up in the inline CSS.

### Pitfall 4: `t=` timestamp clock skew between Sanity and Railway
**What goes wrong:** Sanity's server clock is a few seconds ahead; Railway clock is a few seconds behind. A signature signed at "now+30s" looks like a future signature; the 5-minute check passes one way (positive skew tolerated) but fails the other (negative skew rejected as "expired").
**Why it happens:** NTP drift on either side; the spec doesn't define a tolerance.
**How to avoid:** Allow both directions of skew up to MAX_AGE_MS. Implementation above: `if now - ts > MAX_AGE_MS or ts - now > MAX_AGE_MS: reject`. The 5-minute window is symmetric.
**Warning signs:** Sporadic 410 responses on legitimate webhooks; correlation with deploys (Railway resets fresh server clock); fix by adding NTP discipline or extending tolerance.

### Pitfall 5: Sanity GROQ query against CDN returns stale content (`useCdn: true`)
**What goes wrong:** Publisher fetches issue 0-5 seconds after Andrew publishes; Sanity CDN hasn't propagated; PDF is built from the previous draft state.
**Why it happens:** WHK-06 requires `useCdn: false`. The Next.js frontend reads via CDN for performance; the Publisher must NOT.
**How to avoid:** The existing `lib/sanity_client.groq_query` already uses `https://{project}.api.sanity.io` (non-CDN host). DO NOT modify it to use `apicdn.sanity.io`. The 30-second `asyncio.sleep` before the Vercel deploy hook is for the *frontend's* CDN cache to invalidate, not Publisher's read.
**Warning signs:** PDF doesn't match Andrew's edits. Confirm hostname in httpx request: `*.api.sanity.io` (correct) vs `*.apicdn.sanity.io` (wrong for Publisher).

### Pitfall 6: `idempotency-key` is missing or wildly variable
**What goes wrong:** Sanity webhooks ship with an `idempotency-key` header — but if it's missing in some retry edge case, the dedup table never logs and the Publisher fires twice.
**Why it happens:** Sanity's webhook contract guarantees the header on retries (same key) but the first delivery may be the first time you see it. Edge cases exist.
**How to avoid:** Treat a missing `idempotency-key` as "still process, but warn loudly." Don't refuse the webhook (Sanity won't retry usefully). Log a warning and proceed. Optionally, dedup against `(transaction_id, _id)` as a fallback composite key — Sanity always sends `sanity-transaction-id`.
**Warning signs:** Test: assert that a webhook with no `idempotency-key` header still triggers `_run_publisher`; only if BOTH headers are missing is it a real problem.

### Pitfall 7: Manual fallback creates a parallel implementation that drifts
**What goes wrong:** `POST /run/{runId}/publish` is implemented as a separate function from the webhook path. Over time the two diverge (one updates Convex, the other doesn't; one rotates fonts, the other doesn't).
**Why it happens:** Two endpoints written independently against the same spec.
**How to avoid:** Extract `_run_publisher(app, issue_id, issue_number, run_id)` as a single coroutine. The webhook handler calls it via `asyncio.create_task`. The manual endpoint calls it the same way. There is exactly one implementation.
**Warning signs:** If the manual endpoint has its own `httpx.post(...)` for Sanity instead of going through `lib/sanity_client`, it's a duplicate.

### Pitfall 8: `pdfContent` lives in DispatchState but never made it to Sanity in Phase 5
**What goes wrong:** Publisher tries `issue.problemStatement.pdfContent`, gets `None`, PDF renders with empty stats.
**Why it happens:** Phase 5 `write_issue_draft` (lib/sanity_client.py:134-139) only writes `headline` + `body` to `problemStatement`. The `pdfContent` Pydantic model is on the DispatchState side only; nothing in the Sanity write path moves it.
**How to avoid:** Phase 6 must either (a) extend `editorialSection` factory in apps/studio/schemas/weeklyIssue.ts to add a `pdfContent` object for the problemStatement section (preferred — matches the requirement language), AND amend `write_issue_draft` to pass `state['problem_statement']['pdfContent']` through, OR (b) fetch DispatchState from the LangGraph checkpoint by runId at PDF time (fragile — checkpoint may be GC'd or in a different deployment's pool). Plan (a). The Sanity schema patch is small and clean.
**Warning signs:** Pre-flight test: GROQ-query a published draft after Phase 6 lands and assert `pdfContent` is non-null with all 3 required fields.

### Pitfall 9: Font filename normalization mismatch (Display vs Body weights)
**What goes wrong:** `_font_filename("Source Serif Pro", "Regular")` → `"SourceSerifPro-Regular.ttf"`, but Google Fonts ships it as `"SourceSerifPro-Regular.ttf"` for v2, `"SourceSerif4-Regular.ttf"` for v4. Filename collision.
**Why it happens:** Google Fonts has multiple versions of the same family name; the static API URL changes between versions.
**How to avoid:** Vendor each font with a deterministic name regardless of source version. Use a `FONT_FILE_MAP: dict[str, dict[str, str]]` constant beside the whitelist that maps `(family, weight) → filename`. Plan must include a per-font vendoring script that puts the files under `packages/pipeline/fonts/` with predictable names.
**Warning signs:** `FileNotFoundError` at first real render. Test: parametrize over all 17 whitelisted fonts and assert each Regular weight TTF resolves.

### Pitfall 10: Vercel deploy hook fires from a non-production environment
**What goes wrong:** Staging Publisher triggers the production Vercel deploy hook (or vice versa), deploying stale or test content.
**Why it happens:** `VERCEL_DEPLOY_HOOK_URL` is per-branch. The wrong URL ends up in staging Railway env.
**How to avoid:** Add a `# TODO(ops): set per environment` comment to the env example. Verify in the Railway smoke test (Plan 06-N) that `VERCEL_DEPLOY_HOOK_URL` resolves to a *production* hook.
**Warning signs:** Production deploys when staging Publisher runs.

## Code Examples

Verified patterns from authoritative sources.

### Sanity signature encoder (mirror image of decoder — for tests)

```python
# tests/lib/test_sanity_webhook.py — helper for generating valid fixtures
def encode_sanity_signature(body: bytes, ts_ms: int, secret: str) -> str:
    payload = f"{ts_ms}.".encode("utf-8") + body
    mac = hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).digest()
    sig = base64.urlsafe_b64encode(mac).rstrip(b"=").decode("ascii")
    return f"t={ts_ms},v1={sig}"
```

### WeasyPrint render with FontConfiguration + base64 font

```python
# Pattern from doc.courtbouillon.org/weasyprint/stable/first_steps.html + #1692
from weasyprint import HTML
from weasyprint.text.fonts import FontConfiguration

font_config = FontConfiguration()
html_str = """
<html>
<head><style>
@font-face {
  font-family: 'Playfair Display';
  src: url(data:font/truetype;charset=utf-8;base64,AAEAAAA...) format('truetype');
}
body { font-family: 'Playfair Display', serif; }
</style></head>
<body><h1>Issue 42 — The Quiet Foundation</h1></body>
</html>
"""
pdf_bytes = HTML(string=html_str).write_pdf(font_config=font_config)
```

### Vercel deploy hook trigger

```python
# packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py
async def trigger_vercel_deploy(http: AsyncClient) -> dict:
    """POST to VERCEL_DEPLOY_HOOK_URL. No auth header (URL is the credential).
    Returns the {job:{id,state,createdAt}} response per Vercel docs.
    """
    url = os.environ["VERCEL_DEPLOY_HOOK_URL"]
    r = await http.post(url, timeout=30.0)
    r.raise_for_status()
    return r.json()
```

Source: [vercel.com/docs/deploy-hooks](https://vercel.com/docs/deploy-hooks) — confirms POST with no body, no auth.

### Idempotency claim — atomic insert pattern

```python
# Pattern from brandur.org/idempotency-keys + hookdeck.com webhook idempotency guide
# Returns True iff this is the first time we've seen the key.
async def claim_idempotency_key(pool, *, source, idempotency_key, run_id):
    async with pool.connection() as conn, conn.cursor() as cur:
        await cur.execute(
            """INSERT INTO webhook_idempotency (idempotency_key, source, run_id)
               VALUES (%s, %s, %s)
               ON CONFLICT (source, idempotency_key) DO NOTHING
               RETURNING id""",
            (idempotency_key, source, run_id),
        )
        return (await cur.fetchone()) is not None
```

### FastAPI background task launch (the canonical Phase 4 pattern)

```python
# From api/runs.py:165 — verbatim pattern, reuse for webhook
task = asyncio.create_task(_run_publisher(request.app, issue_id=..., ...))
request.app.state.background_tasks.add(task)
task.add_done_callback(request.app.state.background_tasks.discard)
```

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PDF-01 | Publisher renders Problem Statement to PDF using `weeklyIssue.problemStatement.pdfContent` + theme | Patterns 3, 5; Pitfall 8 (schema must be extended); WeasyPrint 68.1; PdfContent already locked by Phase 5 ProblemWriter (problem.py:40-60) |
| PDF-02 | Templates use base64-inlined `@font-face`, fonts from Phase 5 whitelist | Pattern 3; Pitfalls 2, 3, 9; vendored TTF in `packages/pipeline/fonts/`; FONT_WHITELIST has 17 fonts |
| PDF-03 | Generated PDF uploads to Sanity, set on `weeklyIssue.problemPdf` | `lib/sanity_client.upload_pdf_to_issue` already exists (Phase 4 stub) — wire it |
| PDF-04 | PDF download button on `/issue/[slug]` linked via `problemPdf.asset->url` | Already implemented in Phase 2 (apps/web/components/issue/IssueHero.tsx + queries.ts) — Phase 6 only fills the data |
| WHK-01 | Sanity webhook fires on `_type == "weeklyIssue" && status == "published"` | docs/API_CONTRACTS.md §5.1; Sanity Studio webhook config — Andrew configures in dashboard |
| WHK-02 | Publisher verifies HMAC against `SANITY_WEBHOOK_SECRET` using raw body | Pattern 1; Pitfall 1; CORRECTED ALGORITHM (not `sha256=hex` — `t=...,v1=base64url`) |
| WHK-03 | Reject webhooks where timestamp older than 5 minutes | Pattern 1 (`MAX_AGE_MS = 5*60*1000`); Pitfall 4 (symmetric tolerance) |
| WHK-04 | Deduplicate via `idempotency-key` header + Supabase `webhook_idempotency` table with unique constraint | Pattern 2; Pitfall 6; schema includes `UNIQUE (source, idempotency_key)` |
| WHK-05 | Wait 30 seconds before Vercel deploy hook (CDN propagation) | Pattern 5; `asyncio.sleep(30)` inside the background coroutine (NOT inside webhook handler) |
| WHK-06 | Use `useCdn: false` when fetching content for PDF generation | Pitfall 5; existing `lib/sanity_client.groq_query` already hits `*.api.sanity.io` (non-CDN) — verify it stays that way |
| WHK-07 | Update `pipelineRuns.status` to `complete` + write `publisher-deploy` event | Pattern 5; reuse existing `@agent_node` wrapper emission OR write directly via `convex_mutation_safe` from `_run_publisher`; the `publisher-deploy` literal is already in the deliberationEvents schema |
| WHK-08 | Manual `POST /run/{runId}/publish` fallback | Pitfall 7; promote stub in `api/runs.py:255` to call the same `_run_publisher` coroutine — single implementation |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `sha256=<hex>` HMAC signature (per docs/API_CONTRACTS.md §5.3) | `t={ts_ms},v1={base64url_b64_no_pad}` per `@sanity/webhook` v5+ | Sanity webhook-toolkit v5 (Web Crypto migration) | API_CONTRACTS.md must be amended; planner must NOT copy §5.3 verbatim |
| HTTP-loading Google Fonts in PDF templates | Vendored TTF + base64 inline `@font-face` | Pre-existing best practice; documented failures #2031, #2126 | Repository carries `packages/pipeline/fonts/` directory (~5-10MB of TTF files; reasonable for editorial Jesse-voice fonts) |
| WOFF2 in PDF templates | TTF for WeasyPrint compatibility | WeasyPrint changelog notes preference; community tutorials confirm | Vendoring step uses TTF assets from `fonts.gstatic.com/s/{family}/v{N}/.../*.ttf` |
| `BackgroundTasks` for slow Publisher work | `asyncio.create_task` + `app.state.background_tasks` set | Phase 4 already migrated (PIP-02 / Plan 04-09) | Phase 6 inherits — no per-phase reconsideration |
| Idempotency tracking in Redis | Postgres `INSERT … ON CONFLICT DO NOTHING` | Standard pattern since Postgres 9.5 | Reuses existing Supabase pool; no new infra |

**Deprecated/outdated:**
- `from weasyprint.fonts import FontConfiguration` → moved to `from weasyprint.text.fonts import FontConfiguration` in recent WeasyPrint releases. Use the `text.fonts` path.
- Sanity Python SDK (`sanity-python`) mentioned in CLAUDE.md — there is **no** maintained Python SDK. Raw httpx (already done in `lib/sanity_client.py`) is the canonical Python approach. CLAUDE.md should be amended; out of scope for this plan but worth a note in the plan summary.

## Open Questions

1. **Should the PDF include a charity logo or stay typography-only?**
   - What we know: Brief calls it a "narrative framework sales deck" with "structured argument." Phase 5 ProblemWriter's `PdfContent` schema has no image fields. Charity logo isn't currently captured anywhere in the data model.
   - What's unclear: Visual richness. Logo would require schema additions and image asset wrangling.
   - Recommendation: Phase 6 ships typography-only PDF (matches the brief's "dry, precise" voice). Logo is a v2.

2. **Where do the vendored TTF files live: in git, or fetched at Docker build?**
   - What we know: Each TTF is ~100-300KB; 17 fonts × ~2 weights × 200KB ≈ 7MB of binary in git. Google Fonts licensing (SIL OFL) permits vendoring.
   - What's unclear: Whether the team prefers fat git repo (reproducible) or thin git + Dockerfile RUN step (no binary in git but adds build complexity).
   - Recommendation: Vendor in git under `packages/pipeline/fonts/` with `LICENSES/` subdirectory. Simpler, deterministic, no network dependency at Docker build. ~7MB is fine.

3. **Should `webhook_idempotency` table live in the same Supabase Postgres as `checkpoints`?**
   - What we know: Phase 4 already opens an AsyncConnectionPool against `SUPABASE_POSTGRES_URL`. Reusing it is cheap.
   - What's unclear: Whether to use a separate schema (`webhook.idempotency`) or the public schema (`public.webhook_idempotency`).
   - Recommendation: `public.webhook_idempotency` — same schema as `public.checkpoints` for consistency. Add `cli setup-webhook-idempotency` mirroring Phase 4's `cli setup-checkpointer`. Run idempotently at deploy via `railway.toml preDeployCommand`.

4. **Does `apps/studio/schemas/weeklyIssue.ts` need to gain a `pdfContent` field, or can we encode it as JSON-stringified text?**
   - What we know: The Phase 5 ProblemWriter outputs `pdfContent` as structured JSON. The schema currently has only `problemStatement.{headline, body}`. Phase 4 added `pipelineMetadata.cost` and `pipelineMetadata.modelVersions` as JSON-stringified text fields (Plan 04-04 pattern).
   - What's unclear: Whether Andrew needs to edit the keyDataPoints stats/sources in Studio, or if pipeline output is final.
   - Recommendation: Add `pdfContent` as a typed Sanity object with sub-fields (`problemStatement: text`, `keyDataPoints: array of {stat, source}`, `interventionMechanism: text`). Andrew can override stats. Aligns with editorial-control philosophy in the brief.

5. **Is `runId` always present on the webhook payload?**
   - What we know: The Sanity webhook projection is `{_id, _type, status, issueNumber, "runId": pipelineMetadata.runId}`. If Phase 5 Calibrator didn't run (e.g., Andrew creates a draft manually), `runId` could be null.
   - What's unclear: Whether the Publisher should fail-loud or fall back to "ran without a pipeline" mode.
   - Recommendation: Allow `runId = None` through the Publisher. Skip Convex `pipelineRuns:updateStatus` if no runId. Still render PDF + fire Vercel deploy. The site can be published for issues that were authored by hand. The Convex layer is for the deliberation UI — gracefully degrading there is fine.

6. **Does the Plan 05-15 `langchain-openai` cost-metadata gap (STATE.md Phase 6 carryover) block Phase 6?**
   - What we know: All real-mode cost readings are $0 because `with_structured_output` doesn't surface `usage_metadata`. The cap cannot enforce.
   - What's unclear: Whether Phase 6 should fix the cost gap or just track it as a known limit.
   - Recommendation: Phase 6 should include a small task to either (a) move to `include_raw=True` and re-extract usage, or (b) add a usage sidechannel. This is the carryover item flagged in STATE.md. It is NOT on the critical path for PDF/webhook delivery — could be its own plan. The plan author should decide whether to bundle or split.

## Environment Availability

> Phase 6 introduces external dependencies on WeasyPrint (and its system libs) and a Vercel deploy hook URL. Most are already provisioned by Phase 4 — listed here for completeness.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.11 | All pipeline | ✓ | uv venv pinned `>=3.11,<3.12` | — |
| uv | Dependency install | ✓ | 0.11.7 | pip + requirements.txt |
| WeasyPrint Python package | PDF-01..04 | ✗ | needs `==68.1` | — (blocking install) |
| Jinja2 Python package | PDF template render | ✗ | needs `==3.1.6` | str.format (degraded ergonomics) |
| libpango-1.0-0 + libcairo2 + libpangocairo-1.0-0 system libs | WeasyPrint runtime | ✓ (in Docker image only) | from Dockerfile lines 27-33 | — (must be in Docker) |
| fontconfig + fonts-liberation | WeasyPrint font lookup | ✓ (in Docker image) | from Dockerfile | — |
| psycopg + AsyncConnectionPool | webhook_idempotency table | ✓ | already in pyproject | — |
| SUPABASE_POSTGRES_URL | Idempotency table connection | ✓ (provisioned in Phase 4) | per Railway env | — |
| SANITY_WEBHOOK_SECRET | WHK-02 HMAC | ✗ | Andrew must generate + set in Sanity dashboard + Railway env | — (blocking config) |
| VERCEL_DEPLOY_HOOK_URL | WHK-05 deploy fire | ✗ | Andrew must create in Vercel project settings, paste into Railway env | — (blocking config) |
| Sanity webhook configuration (URL/filter/secret) | WHK-01 trigger | ✗ | Andrew sets up in Sanity → API → Webhooks: filter `_type=="weeklyIssue" && status=="published"`, target `https://<railway>/webhook/sanity-publish`, secret matches SANITY_WEBHOOK_SECRET | — (blocking config) |
| Vendored TTF files (~7MB) under `packages/pipeline/fonts/` | PDF-02 base64 inline | ✗ | Plan-side step: download from Google Fonts API + commit | Could fall back to system fonts (DejaVu) but PDF-02 explicitly disallows |
| Convex deployment | WHK-07 status update | ✓ (Phase 3) | modest-magpie-797 (dev) per STATE | — |

**Missing dependencies with no fallback:**
- WeasyPrint + Jinja2 Python packages (must `uv add`)
- SANITY_WEBHOOK_SECRET (Andrew configures)
- VERCEL_DEPLOY_HOOK_URL (Andrew configures)
- Vendored fonts (commit step in Phase 6)
- Sanity webhook configuration (Andrew configures in Studio dashboard — autonomous=false step)

**Missing dependencies with fallback:**
- Jinja2 could be replaced with `str.format`; recommend against it.
- WOFF2 could be used instead of TTF; not recommended.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `pytest 8.x` + `pytest-asyncio` (auto mode) + `respx 0.21` for httpx mocks |
| Config file | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` (asyncio_mode="auto", testpaths=["tests"]) |
| Quick run command | `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/publisher tests/lib/test_sanity_webhook.py tests/lib/test_idempotency.py tests/api/test_webhook_sanity.py -x` |
| Full suite command | `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/ -x` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PDF-01 | Publisher invokes WeasyPrint with pdfContent + theme | unit (real WeasyPrint, mocked Sanity) | `pytest tests/agents/publisher/test_pdf.py::test_render_produces_nonempty_pdf -x` | ❌ Wave 0 |
| PDF-02 | PDF bytes contain inlined TTF (not Google Fonts HTTP) | unit (real WeasyPrint + real font file) | `pytest tests/agents/publisher/test_pdf.py::test_pdf_embeds_inline_ttf -x` | ❌ Wave 0 |
| PDF-02 | Only the two issue fonts are inlined, not all 17 | unit (CSS inspection on Jinja2 output) | `pytest tests/agents/publisher/test_pdf.py::test_pdf_inlines_only_two_fonts -x` | ❌ Wave 0 |
| PDF-03 | Successful PDF triggers upload_pdf_to_issue with patch | integration (mock Sanity httpx via respx) | `pytest tests/agents/publisher/test_pdf.py::test_publisher_uploads_to_sanity -x` | ❌ Wave 0 |
| PDF-04 | (Already done in Phase 2; smoke only) | manual visual | open `/issue/[slug]` in browser after live run | ✓ existing |
| WHK-01 | Webhook route resolves at `/webhook/sanity-publish` | unit (TestClient) | `pytest tests/api/test_webhook_sanity.py::test_route_exists -x` | ✓ (phase 4 stub test) |
| WHK-02 | Valid signature accepted; tampered signature rejected | unit | `pytest tests/api/test_webhook_sanity.py::test_signature_accept_and_reject -x` | ❌ Wave 0 |
| WHK-02 | Hash uses raw body, not re-parsed JSON | unit (whitespace edge case) | `pytest tests/lib/test_sanity_webhook.py::test_raw_body_required -x` | ❌ Wave 0 |
| WHK-03 | Timestamp older than 5 min rejected (410) | unit (parametrize over ages) | `pytest tests/api/test_webhook_sanity.py::test_age_rejection -x` | ❌ Wave 0 |
| WHK-03 | Future-skew >5 min also rejected | unit | `pytest tests/lib/test_sanity_webhook.py::test_future_skew_rejected -x` | ❌ Wave 0 |
| WHK-04 | Same idempotency-key triggers Publisher exactly once | integration (real Postgres against test schema) | `pytest tests/lib/test_idempotency.py::test_dedup_returns_false_on_second -x` | ❌ Wave 0 |
| WHK-04 | Missing idempotency-key: proceeds with warning | unit | `pytest tests/api/test_webhook_sanity.py::test_missing_idempotency_proceeds -x` | ❌ Wave 0 |
| WHK-05 | 30-second sleep fires before Vercel deploy hook | unit (mock asyncio.sleep, mock httpx.post) | `pytest tests/agents/publisher/test_pdf.py::test_30s_delay_before_vercel -x` | ❌ Wave 0 |
| WHK-06 | groq_query target URL is `*.api.sanity.io` (NOT `*.apicdn.sanity.io`) | unit (URL inspection) | `pytest tests/lib/test_sanity_client.py::test_groq_query_uses_non_cdn -x` | ❌ Wave 0 (add test) |
| WHK-07 | Publisher writes status=complete + emits publisher-deploy | integration (mock convex) | `pytest tests/agents/publisher/test_publisher.py::test_completes_convex_writes -x` | ❌ Wave 0 |
| WHK-08 | POST /run/{runId}/publish invokes same _run_publisher | unit (TestClient) | `pytest tests/api/test_runs.py::test_manual_publish_invokes_publisher -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `EISENBALM_STUB_MODE=true uv run pytest tests/agents/publisher tests/lib/test_sanity_webhook.py tests/lib/test_idempotency.py tests/api/test_webhook_sanity.py -x`
- **Per wave merge:** `EISENBALM_STUB_MODE=true uv run pytest tests/ -x` (full suite — must stay green; ~70 collected at start of Phase 6, ~90+ at end)
- **Phase gate:** Full suite green; real-mode E2E webhook test using a tunnel (ngrok / Sanity Studio dev webhook) before `/gsd:verify-work`. Andrew runs a live publish on a draft and confirms the PDF appears on `weeklyIssue.problemPdf` within 60 seconds.

### Wave 0 Gaps
- [ ] `tests/agents/publisher/__init__.py` — Python package init for new test directory
- [ ] `tests/agents/publisher/test_pdf.py` — PDF rendering tests (3+ test cases, real WeasyPrint)
- [ ] `tests/agents/publisher/test_publisher.py` — Publisher coroutine tests (mocked Sanity + Convex)
- [ ] `tests/agents/publisher/test_fonts.py` — TTF base64 encode roundtrip
- [ ] `tests/api/__init__.py` — Python package init
- [ ] `tests/api/test_webhook_sanity.py` — full webhook handler tests (signature accept/reject/age/idempotency)
- [ ] `tests/api/test_runs.py` — additions for WHK-08 manual fallback parity
- [ ] `tests/lib/test_sanity_webhook.py` — signature verifier unit tests (parametric over secrets, tampered bodies, skew)
- [ ] `tests/lib/test_idempotency.py` — `claim_idempotency_key` against test schema
- [ ] Test fixtures: `tests/agents/publisher/fixtures/sample_pdf_content.json`, `sample_theme.json`
- [ ] Test fixture: 1 small TTF for fast tests (or use Liberation Sans from `fonts-liberation` system pkg in Docker; locally use any TTF in `packages/pipeline/fonts/`)
- [ ] Optional: `conftest.py` fixture for a clean `webhook_idempotency` table per test (TRUNCATE in setup)

**What to mock vs hit real:**
| Component | Strategy | Why |
|-----------|---------|-----|
| WeasyPrint | **REAL** — invoke `HTML(...).write_pdf(font_config=fc)` with a small fixture font | The thing being tested. Mocking WeasyPrint defeats PDF-01/02 |
| TTF font files | **REAL** — vendor a tiny test font in `tests/agents/publisher/fixtures/` | The vendored-TTF + base64 pipeline must be exercised end-to-end |
| Jinja2 | **REAL** — Jinja is a pure-Python renderer, no I/O | Trivial cost |
| Sanity API (asset upload, GROQ, patch) | **MOCK** via `respx` | Avoid network; assert request shape (body bytes are PDF, patch sets `problemPdf.asset._ref`) |
| Convex mutations | **MOCK** via `unittest.mock.AsyncMock` (existing fixture `mock_convex_mutation`) | Avoid network; assert mutation calls |
| Vercel deploy hook | **MOCK** via `respx` | Avoid accidentally triggering production deploys during test |
| Supabase Postgres (idempotency table) | **REAL** against a test database (or use SQLite-on-disk with compatible DDL for the unit tests; real Postgres for integration) | UNIQUE constraint semantics are the whole point — must be the real engine |
| `time.time()` / `asyncio.sleep` | **MOCK** — pass `now_ms=...` to verifier; patch `asyncio.sleep` with AsyncMock for the 30s delay test | Tests stay fast; sleep is verified by `mock_sleep.assert_awaited_once_with(30)` |
| LangGraph checkpoint | **N/A** | Phase 6 reads from Sanity (not the checkpoint) — no graph involvement in Publisher path |
| Sanity webhook signature | **REAL** generation in test via `encode_sanity_signature` helper, mirror of decoder | Test parity — same algorithm both directions |

**Real-mode (end-to-end) integration tests:**

The existing `tests/test_pipeline_real_mode.py` skeleton (Phase 5 Plan 04) can be extended:

- `test_real_webhook_signature_against_sanity_dev`: optional — set up a Sanity sandbox project, configure a webhook pointing at `localhost:8000` via `ngrok`, publish a test issue, assert Publisher fires.
- `test_real_pdf_generation`: takes Phase 5's runId=`96ab834e96214671859322044a4b4683` draft, runs the Publisher coroutine without webhook, confirms `weeklyIssue.problemPdf` is populated.

Both real-mode tests are `pytest.mark.skipif` on missing env vars and `pytest.mark.slow` — opt-in only.

## Sources

### Primary (HIGH confidence)
- [docs/API_CONTRACTS.md §5 (in repo)](file:///Users/user/Desktop/Eisenbalm/docs/API_CONTRACTS.md) — Sanity webhook handler skeleton; CORRECTED for signature algorithm
- [docs/CLAUDE_CODE_BRIEF.md §"PDF generation" + §"Agent: Publisher"](file:///Users/user/Desktop/Eisenbalm/docs/CLAUDE_CODE_BRIEF.md) — Publisher responsibilities
- [github.com/sanity-io/webhook-toolkit/blob/main/src/signature.ts](https://github.com/sanity-io/webhook-toolkit/blob/main/src/signature.ts) — canonical signature algorithm (HMAC-SHA256, `t=ms,v1=b64url(hmac(secret, f"{ts}.{body}"))`); verified by fetching raw source
- [sanity.io/docs/content-lake/webhooks](https://www.sanity.io/docs/content-lake/webhooks) — webhook headers list (includes `idempotency-key`, `sanity-transaction-time`, `sanity-webhook-id`)
- [sanity.io/docs/content-lake/webhook-best-practices](https://www.sanity.io/docs/content-lake/webhook-best-practices) — idempotency guidance
- [doc.courtbouillon.org/weasyprint/stable/first_steps.html](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html) — `FontConfiguration` API
- [doc.courtbouillon.org/weasyprint/stable/changelog.html](https://doc.courtbouillon.org/weasyprint/stable/changelog.html) — WeasyPrint 68.1 (2026-02-06) is current
- [vercel.com/docs/deploy-hooks](https://vercel.com/docs/deploy-hooks) — POST to deploy hook URL with no auth, no body; returns `{job: {id, state, createdAt}}`
- [brandur.org/idempotency-keys](https://brandur.org/idempotency-keys) — canonical Postgres idempotency-keys table pattern (72h retention; UNIQUE composite)
- [pypi.org/pypi/weasyprint/json](https://pypi.org/pypi/weasyprint/json) — 68.1 confirmed via PyPI API
- [packages/pipeline/src/eisenbalm_pipeline/agents/problem.py](file:///Users/user/Desktop/Eisenbalm/packages/pipeline/src/eisenbalm_pipeline/agents/problem.py) — PdfContent Pydantic contract (Phase 5)
- [packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py](file:///Users/user/Desktop/Eisenbalm/packages/pipeline/src/eisenbalm_pipeline/agents/design/font_whitelist.py) — 17-font Andrew-approved whitelist
- [packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py:200-248](file:///Users/user/Desktop/Eisenbalm/packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py) — existing `upload_pdf_to_issue` ready to wire
- [packages/pipeline/Dockerfile:27-33](file:///Users/user/Desktop/Eisenbalm/packages/pipeline/Dockerfile) — WeasyPrint system libs pre-installed
- [.planning/phases/04-pipeline-skeleton/04-RESEARCH.md §3 + Pitfall 4](file:///Users/user/Desktop/Eisenbalm/.planning/phases/04-pipeline-skeleton/04-RESEARCH.md) — `asyncio.create_task` rationale carried forward

### Secondary (MEDIUM confidence — verified against multiple sources or official docs)
- [github.com/Kozea/WeasyPrint/issues/1692](https://github.com/Kozea/WeasyPrint/issues/1692) — base64 data URL @font-face issue (open, confirms WOFF2 has edge cases; TTF is safer)
- [github.com/Kozea/WeasyPrint/issues/2031](https://github.com/Kozea/WeasyPrint/issues/2031) — Google Fonts HTTP load timeout (one of the two failures the roadmap flagged)
- [github.com/Kozea/WeasyPrint/issues/2126](https://github.com/Kozea/WeasyPrint/issues/2126) — Google Fonts debug confusion (the other roadmap-flagged failure)
- [pythontutorials.net/blog/how-to-use-custom-font-with-weasyprint/](https://www.pythontutorials.net/blog/how-to-use-custom-font-with-weasyprint/) — "WeasyPrint prefers .ttf/.otf over .woff2"
- [hookdeck.com/webhooks/guides/implement-webhook-idempotency](https://hookdeck.com/webhooks/guides/implement-webhook-idempotency) — webhook idempotency pattern
- [developers.google.com/fonts/docs/developer_api](https://developers.google.com/fonts/docs/developer_api) — Google Fonts API exposes static TTF URLs at fonts.gstatic.com
- [hellogreg.github.io/woff2base/](https://hellogreg.github.io/woff2base/) — base64 font conversion online tool (for ad-hoc verification)

### Tertiary (LOW confidence — single source, used as confirmation only)
- [dantebytes.com/generating-pdfs-from-html-with-weasyprint-and-jinja2-python](https://dantebytes.com/generating-pdfs-from-html-with-weasyprint-and-jinja2-python/) — Jinja2 + WeasyPrint composition pattern (representative)
- [hookray.com/blog/webhook-signature-verification-2026](https://hookray.com/blog/webhook-signature-verification-2026) — general HMAC verification patterns

## Metadata

**Confidence breakdown:**
- WeasyPrint base64 font bundling: **HIGH** — verified against WeasyPrint docs + community tutorials + Dockerfile already installing system libs. Pattern is well-trodden.
- Sanity HMAC signature algorithm: **HIGH** — read upstream `@sanity/webhook` source verbatim; algorithm is unambiguous. The fact that `docs/API_CONTRACTS.md` is wrong here is a MEDIUM-confidence finding (could the project have an older Sanity that uses `sha256=hex`? — almost certainly not; v3 Sanity uses webhook-toolkit v3+).
- Supabase idempotency table: **HIGH** — standard Postgres pattern; project already has the pool open.
- Vercel deploy hook: **HIGH** — Vercel's own docs are explicit.
- 30-second delay for CDN: **MEDIUM** — requirement says it, brief assumes it. No empirical Sanity SLA. 30s is a reasonable hedge against multi-region replication.
- WHK-08 manual fallback shape: **MEDIUM** — endpoint stub exists in `api/runs.py:255`; the input shape (runId only? + issue_id lookup from Convex?) needs the planner to confirm whether the lookup is via Convex `pipelineRuns:byRunId` (returns the Sanity issue_id we wrote? — actually `pipelineRuns` doesn't store issue_id) or via Sanity by `runId` (GROQ filter `pipelineMetadata.runId == $runId`). Recommend the latter — Sanity is the source of truth.
- Cost-metadata carryover (Plan 05-15): **MEDIUM** — known issue from Phase 5, not on Phase 6 critical path but flagged in STATE.md as Phase 6 carryover.

**Research date:** 2026-05-18
**Valid until:** 2026-06-17 (30 days — WeasyPrint, Sanity, and Vercel APIs are all stable; only minor patch releases expected)
