---
phase: 6
slug: pdf-generation-webhook-chain
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `pytest 8.x` + `pytest-asyncio` (auto mode) + `respx 0.21` for httpx mocks |
| **Config file** | `packages/pipeline/pyproject.toml` `[tool.pytest.ini_options]` (asyncio_mode="auto", testpaths=["tests"]) |
| **Quick run command** | `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/publisher tests/lib/test_sanity_webhook.py tests/lib/test_idempotency.py tests/api/test_webhook_sanity.py -x` |
| **Full suite command** | `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/ -x` |
| **Estimated runtime** | ~30 seconds (quick) / ~90 seconds (full, ~90 collected at end of Phase 6) |

---

## Sampling Rate

- **After every task commit:** Run quick command above (~30s)
- **After every plan wave:** Run full suite command (~90s)
- **Before `/gsd:verify-work`:** Full suite must be green; real-mode E2E webhook test using a tunnel (ngrok) with Sanity Studio dev webhook
- **Max feedback latency:** 30 seconds per task; 90 seconds per wave

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| PDF-01 | Publisher invokes WeasyPrint with pdfContent + theme | unit (real WeasyPrint, mocked Sanity) | `pytest tests/agents/publisher/test_pdf.py::test_render_produces_nonempty_pdf -x` | ❌ W0 | ⬜ pending |
| PDF-02 | PDF bytes contain inlined TTF (not Google Fonts HTTP) | unit (real WeasyPrint + real font file) | `pytest tests/agents/publisher/test_pdf.py::test_pdf_embeds_inline_ttf -x` | ❌ W0 | ⬜ pending |
| PDF-02 | Only the two issue fonts are inlined, not all 17 | unit (CSS inspection on Jinja2 output) | `pytest tests/agents/publisher/test_pdf.py::test_pdf_inlines_only_two_fonts -x` | ❌ W0 | ⬜ pending |
| PDF-03 | Successful PDF triggers upload_pdf_to_issue with patch | integration (mock Sanity httpx via respx) | `pytest tests/agents/publisher/test_pdf.py::test_publisher_uploads_to_sanity -x` | ❌ W0 | ⬜ pending |
| PDF-04 | Frontend `/issue/[slug]` links to problemPdf asset URL | manual visual | open `/issue/[slug]` in browser after live run | ✓ existing (Phase 2) | ⬜ pending |
| WHK-01 | Webhook route resolves at `/webhook/sanity-publish` | unit (TestClient) | `pytest tests/api/test_webhook_sanity.py::test_route_exists -x` | ✓ Phase 4 stub | ⬜ pending |
| WHK-02 | Valid signature accepted; tampered signature rejected | unit | `pytest tests/api/test_webhook_sanity.py::test_signature_accept_and_reject -x` | ❌ W0 | ⬜ pending |
| WHK-02 | Hash uses raw body, not re-parsed JSON | unit (whitespace edge case) | `pytest tests/lib/test_sanity_webhook.py::test_raw_body_required -x` | ❌ W0 | ⬜ pending |
| WHK-03 | Timestamp older than 5 min rejected (410) | unit (parametrize over ages) | `pytest tests/api/test_webhook_sanity.py::test_age_rejection -x` | ❌ W0 | ⬜ pending |
| WHK-03 | Future-skew >5 min also rejected | unit | `pytest tests/lib/test_sanity_webhook.py::test_future_skew_rejected -x` | ❌ W0 | ⬜ pending |
| WHK-04 | Same idempotency-key triggers Publisher exactly once | integration (real Postgres against test schema) | `pytest tests/lib/test_idempotency.py::test_dedup_returns_false_on_second -x` | ❌ W0 | ⬜ pending |
| WHK-04 | Missing idempotency-key: proceeds with warning | unit | `pytest tests/api/test_webhook_sanity.py::test_missing_idempotency_proceeds -x` | ❌ W0 | ⬜ pending |
| WHK-05 | 30-second sleep fires before Vercel deploy hook | unit (mock asyncio.sleep, mock httpx.post) | `pytest tests/agents/publisher/test_pdf.py::test_30s_delay_before_vercel -x` | ❌ W0 | ⬜ pending |
| WHK-06 | groq_query target URL is `*.api.sanity.io` (NOT `*.apicdn.sanity.io`) | unit (URL inspection) | `pytest tests/lib/test_sanity_client.py::test_groq_query_uses_non_cdn -x` | ❌ W0 (add test) | ⬜ pending |
| WHK-07 | Publisher writes status=complete + emits publisher-deploy | integration (mock convex) | `pytest tests/agents/publisher/test_publisher.py::test_completes_convex_writes -x` | ❌ W0 | ⬜ pending |
| WHK-08 | POST /run/{runId}/publish invokes same _run_publisher | unit (TestClient) | `pytest tests/api/test_runs.py::test_manual_publish_invokes_publisher -x` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/agents/publisher/__init__.py` — Python package init for new test directory
- [ ] `tests/agents/publisher/test_pdf.py` — PDF rendering tests (3+ test cases, real WeasyPrint)
- [ ] `tests/agents/publisher/test_publisher.py` — Publisher coroutine tests (mocked Sanity + Convex)
- [ ] `tests/agents/publisher/test_fonts.py` — TTF base64 encode roundtrip
- [ ] `tests/agents/publisher/fixtures/sample_pdf_content.json` — fixture for PdfContent input
- [ ] `tests/agents/publisher/fixtures/sample_theme.json` — fixture for theme input
- [ ] `tests/agents/publisher/fixtures/tiny.ttf` — small TTF fixture for fast tests (or Liberation Sans)
- [ ] `tests/api/__init__.py` — Python package init
- [ ] `tests/api/test_webhook_sanity.py` — full webhook handler tests (signature accept/reject/age/idempotency)
- [ ] `tests/api/test_runs.py` — additions for WHK-08 manual fallback parity
- [ ] `tests/lib/test_sanity_webhook.py` — signature verifier unit tests (parametric over secrets, tampered bodies, skew)
- [ ] `tests/lib/test_idempotency.py` — `claim_idempotency_key` against test schema
- [ ] `tests/conftest.py` — fixture for a clean `webhook_idempotency` table per test (TRUNCATE in setup); fixture `encode_sanity_signature` helper for tests

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| PDF visual correctness (theme colors render, fonts shown, layout looks right) | PDF-01, PDF-02 | Visual fidelity requires human review | Open generated PDF; confirm headline uses theme.fontDisplay; body uses theme.fontBody; colors match theme.primaryColor / textColor / backgroundColor |
| PDF download from `/issue/[slug]` works in browser | PDF-04 | End-to-end UI flow | Visit `/issue/[slug]`; click PDF download; confirm browser downloads PDF file |
| Real Sanity webhook fires Publisher (E2E) | WHK-01, WHK-02 | Cross-system Sanity → Railway timing | Set up ngrok tunnel; configure Sanity webhook to localhost; publish test issue in Studio; assert Publisher coroutine fires within 60s |
| Vercel deploy hook actually deploys site | WHK-05 | Requires Vercel project deploy | After webhook fires, watch Vercel dashboard; confirm new build kicks off ~30s after webhook receipt |

---

## What to Mock vs Hit Real

| Component | Strategy | Why |
|-----------|----------|-----|
| WeasyPrint | **REAL** — invoke `HTML(...).write_pdf(font_config=fc)` with small fixture font | The thing being tested |
| TTF font files | **REAL** — vendor a tiny test font in `tests/agents/publisher/fixtures/` | Base64 pipeline must be exercised |
| Jinja2 | **REAL** — pure-Python renderer | Trivial cost |
| Sanity API (asset upload, GROQ, patch) | **MOCK** via `respx` | Avoid network; assert request shape |
| Convex mutations | **MOCK** via `unittest.mock.AsyncMock` (existing `mock_convex_mutation` fixture) | Avoid network; assert mutation calls |
| Vercel deploy hook | **MOCK** via `respx` | Avoid triggering production deploys |
| Supabase Postgres (idempotency table) | **REAL** against test database | UNIQUE constraint semantics are the point |
| `time.time()` / `asyncio.sleep` | **MOCK** — pass `now_ms=...` to verifier; patch `asyncio.sleep` with AsyncMock | Tests stay fast; sleep verified by `mock_sleep.assert_awaited_once_with(30)` |
| LangGraph checkpoint | **N/A** | Publisher reads from Sanity, no graph involvement |
| Sanity webhook signature | **REAL** generation via `encode_sanity_signature` helper in tests | Test parity — same algorithm both directions |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s per task
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
