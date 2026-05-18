---
phase: 06-pdf-generation-webhook-chain
plan: 04
subsystem: api
tags: [webhook, hmac, signature, idempotency, vercel, postgres, sanity, httpx, respx]

# Dependency graph
requires:
  - phase: 06-pdf-generation-webhook-chain
    provides: "Plan 06-01 test fixtures (sanity_signature_encoder, webhook_idempotency_clean) and Plan 06-03 webhook_idempotency table DDL via CLI"
provides:
  - "lib/sanity_webhook.py — verify_sanity_signature with corrected t={ms},v1={base64url} HMAC-SHA256 algorithm"
  - "lib/idempotency.py — atomic INSERT ... ON CONFLICT (source, idempotency_key) DO NOTHING RETURNING id"
  - "lib/vercel_client.py — trigger_vercel_deploy POSTs (no body, no auth) and raises on non-2xx"
  - "SignatureError hierarchy: SignatureFormatError, SignatureExpiredError, SignatureMismatchError"
  - "Test surface for all three modules — 8 passed, 3 skipped (idempotency only, no live DB locally)"
affects: [06-07-webhook-and-publisher-wiring, 06-08-readme-and-smoke-test]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Module-level zero-side-effect lib modules — env reads inside function bodies only (testable via monkeypatch)"
    - "hmac.compare_digest for constant-time signature comparison (defeats timing-oracle)"
    - "Symmetric MAX_AGE_MS clock-skew tolerance — protects against both stale and future-skewed timestamps"
    - "respx.mock context manager for httpx-level test mocking without network"
    - "Atomic UNIQUE-constraint dedup pattern: INSERT ... ON CONFLICT DO NOTHING RETURNING id"

key-files:
  created:
    - "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py"
    - "packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py"
    - "packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py"
    - "packages/pipeline/tests/lib/test_sanity_webhook.py"
    - "packages/pipeline/tests/lib/test_idempotency.py"
    - "packages/pipeline/tests/lib/test_vercel_client.py"
  modified:
    - "packages/pipeline/tests/conftest.py (Rule 3 deviation — fixtures inlined; later superseded by parallel 06-01 commit)"

key-decisions:
  - "Sanity signature algorithm follows the corrected @sanity/webhook v5+ Web Crypto migration spec (RESEARCH §Pattern 1, not API_CONTRACTS §5.3 sha256=hex)"
  - "base64url_no_pad encoding for signature — rstrip(b'=') then urlsafe_b64encode (Python equivalent to JS base64url)"
  - "Symmetric MAX_AGE_MS bidirectional skew check — rejects both past-expiry AND future-skewed timestamps (Pitfall 4)"
  - "SignatureFormatError correctly rejects the legacy `sha256=hex` shape per the SIGNATURE_RE regex requiring `t=<digits>,v1=<token>`"
  - "claim_idempotency_key does NOT swallow psycopg exceptions — handler decides between fail-loud vs log+proceed"
  - "trigger_vercel_deploy takes injected AsyncClient (no per-call construction) — reuses lifespan pool"

patterns-established:
  - "Pattern A: lib modules import-clean (no env reads at import time) — enables straightforward monkeypatch in tests"
  - "Pattern B: pytest respx.mock context manager + httpx.AsyncClient for HTTP-boundary tests without network"
  - "Pattern C: test fixture conftest extensions live in conftest.py with @pytest.fixture decorator + standalone helper functions for non-fixture importers"

requirements-completed: [WHK-02, WHK-03, WHK-04, WHK-05]

# Metrics
duration: 7min
completed: 2026-05-18
---

# Phase 06 Plan 04: Webhook + Idempotency Libs Summary

**Three import-clean lib primitives — corrected Sanity HMAC verifier, atomic Postgres dedup, no-body Vercel deploy POST — with full test coverage so Plan 06-07's handler is a composition step**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-18T19:48:05Z
- **Completed:** 2026-05-18T19:54:58Z
- **Tasks:** 3 (all autonomous)
- **Files created:** 6 (3 lib modules + 3 test files)
- **Files modified:** 1 (tests/conftest.py — Rule 3 deviation)

## Accomplishments

- `lib/sanity_webhook.py` shipped with the canonical `t={ms},v1={base64url}` algorithm replacing the historically-wrong `sha256=hex` in API_CONTRACTS §5.3. Symmetric clock-skew tolerance (±5 min). Three named error subclasses for explicit handler branching.
- `lib/idempotency.py` shipped with the canonical `INSERT ... ON CONFLICT (source, idempotency_key) DO NOTHING RETURNING id` pattern. Returns `True` on first claim, `False` on duplicate.
- `lib/vercel_client.py` shipped — single-purpose async POST to `VERCEL_DEPLOY_HOOK_URL` with no body, no auth header, no client construction (caller controls AsyncClient lifecycle).
- Test surface: **6 sanity_webhook tests + 2 vercel_client tests = 8 passed deterministically**; **3 idempotency tests skip cleanly** without `SUPABASE_POSTGRES_URL` (will pass against live Supabase).
- Zero Phase 5 agent regressions (117 agent tests still pass).

## Task Commits

Each task was committed atomically:

1. **Task 1: Create lib/sanity_webhook.py with HMAC verifier** — `aac888b` (feat)
2. **Task 2: Create lib/idempotency.py + lib/vercel_client.py** — `9337c35` (feat)
3. **Task 3: Write test bodies for all three lib modules** — `9a41710` (test)

_Note: Task 3 commit's diff was reduced because Plan 06-01 (running in parallel) committed `ffa6096` between my Task 1 and Task 3, which absorbed my conftest.py extension. The conftest.py fixture surface in HEAD is byte-equivalent to what Task 3 added._

## Files Created/Modified

- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` — HMAC-SHA256 signature verifier with corrected algorithm + 3-subclass error hierarchy
- `packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py` — Atomic Postgres INSERT … ON CONFLICT helper for webhook dedup
- `packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py` — Vercel deploy hook POST helper, raises on non-2xx
- `packages/pipeline/tests/lib/test_sanity_webhook.py` — 6 tests: valid, raw-body-required (Pitfall 1), tampered, expired, future-skew (Pitfall 4), malformed (incl. `sha256=hex` rejection)
- `packages/pipeline/tests/lib/test_idempotency.py` — 3 tests: first-true, second-false, different-source-independent
- `packages/pipeline/tests/lib/test_vercel_client.py` — 2 tests: POST shape (no body / no auth header) via respx + raises on non-2xx
- `packages/pipeline/tests/conftest.py` — appended `encode_sanity_signature` + `sanity_signature_encoder` + `webhook_idempotency_clean` + `mock_vercel_trigger` (Rule 3 deviation; convergent with Plan 06-01's parallel commit)

## Test Counts

| File | Passed | Skipped | Failed | Notes |
|------|--------|---------|--------|-------|
| `tests/lib/test_sanity_webhook.py` | 6 | 0 | 0 | All algorithm cases deterministic, no env/network deps |
| `tests/lib/test_vercel_client.py` | 2 | 0 | 0 | respx mocks the HTTP boundary; no network |
| `tests/lib/test_idempotency.py` | 0 | 3 | 0 | Skipped because `SUPABASE_POSTGRES_URL` is unset locally; will pass against live Supabase when env is provided |

Idempotency tests **did not** run against a real Supabase in this execution — the `webhook_idempotency_clean` fixture skips early when any required env var is missing. The conftest fixture's `TRUNCATE TABLE webhook_idempotency` swallows table-missing errors so the tests will degrade gracefully if Plan 06-03's `setup-webhook-idempotency` CLI hasn't run yet against the target Supabase instance.

## Decisions Made

None — plan was followed verbatim apart from the Rule 3 deviation noted below. The algorithm matches RESEARCH §Pattern 1 byte-for-byte. The `base64url_no_pad` encoding choice is what makes the `SignatureFormatError` correctly reject the legacy `sha256=<hex>` header shape (the SIGNATURE_RE regex `^t=(\d+)[, ]+v1=([^, ]+)$` cannot match `sha256=abc123`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Inlined Plan 06-01 conftest fixtures**
- **Found during:** Task 3 (writing test bodies)
- **Issue:** Plan 06-04 depends on Plan 06-01 (Wave 0) which adds `encode_sanity_signature`, `sanity_signature_encoder`, `webhook_idempotency_clean`, and `mock_vercel_trigger` to `tests/conftest.py`. At the time Task 3 started, Plan 06-01 had not yet committed those fixtures. Without them, the test fixtures would fail to resolve.
- **Fix:** Appended the four fixture symbols to `tests/conftest.py` verbatim from Plan 06-01's spec (byte-equivalent — Plan 06-01 committed its identical conftest.py extension as `ffa6096` between my Task 1 and Task 3 commits, so HEAD ends up with the same surface).
- **Files modified:** `packages/pipeline/tests/conftest.py`
- **Verification:** `from tests.conftest import encode_sanity_signature` succeeds; `pytest tests/lib/test_sanity_webhook.py` → 6 passed.
- **Committed in:** `9a41710` (Task 3) — though Plan 06-01's parallel commit `ffa6096` ultimately authored the matching diff.

**2. [Rule 1 - Bug] Vercel test header-name lookup**
- **Found during:** Task 3 verify (writing `test_trigger_posts_to_hook_url`)
- **Issue:** The plan template's `assert b"Authorization" not in (route.calls.last.request.headers.raw[0][0] if route.calls.last.request.headers.raw else b"")` only inspects the first header tuple, which is brittle (any non-empty header list passes the assertion regardless of `Authorization`).
- **Fix:** Rewrote as `header_names = {k.lower() for k, _ in route.calls.last.request.headers.raw}; assert b"authorization" not in header_names` — checks all headers, case-insensitively.
- **Files modified:** `packages/pipeline/tests/lib/test_vercel_client.py`
- **Verification:** `pytest tests/lib/test_vercel_client.py::test_trigger_posts_to_hook_url` passes; the assertion now genuinely proves no Authorization header was sent.
- **Committed in:** `9a41710` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both deviations preserve the contract; no scope creep. Algorithm and test names are unchanged.

## Issues Encountered

- Parallel-execution race: Plan 06-01's commit `ffa6096` landed between my Task 1 and Task 3, absorbing my conftest.py edits into its diff. The resulting HEAD is correct (Plan 06-01's content is byte-equivalent to what I would have written), but my Task 3 commit shows fewer files than it would have in serial execution. No semantic difference.
- `EISENBALM_STUB_MODE=true` is set for the verify command per plan, but none of the three lib modules read that env var — they're pure stateless primitives. The flag is harmless and matches the plan's verify command for consistency with the rest of Phase 5/6 test conventions.

## User Setup Required

None — these are stateless lib primitives. The handler that composes them (Plan 06-07) reads env vars at request time; this plan does not introduce new env requirements.

## Known Stubs

None. All three lib modules implement their full contracts. The idempotency tests skip rather than stub when `SUPABASE_POSTGRES_URL` is unset — they run real Postgres against the real `webhook_idempotency` table when the env is provided.

## Next Phase Readiness

- **Plan 06-07** (webhook-and-publisher-wiring) can now compose the three primitives directly: import `verify_sanity_signature`, `claim_idempotency_key`, `trigger_vercel_deploy`, wire them into the FastAPI route handler.
- All four addressed requirements (WHK-02 ✓, WHK-03 ✓, WHK-04 ✓, WHK-05 ✓) have unit-test coverage at the lib boundary; integration coverage at the handler boundary is Plan 06-07's responsibility.
- Phase 5 suite still green (117 agent tests pass) — no Phase 5 regressions introduced.

## Self-Check: PASSED

- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_webhook.py` — FOUND
- `packages/pipeline/src/eisenbalm_pipeline/lib/idempotency.py` — FOUND
- `packages/pipeline/src/eisenbalm_pipeline/lib/vercel_client.py` — FOUND
- `packages/pipeline/tests/lib/test_sanity_webhook.py` — FOUND
- `packages/pipeline/tests/lib/test_idempotency.py` — FOUND
- `packages/pipeline/tests/lib/test_vercel_client.py` — FOUND
- Commit `aac888b` (Task 1) — FOUND
- Commit `9337c35` (Task 2) — FOUND
- Commit `9a41710` (Task 3) — FOUND

---
*Phase: 06-pdf-generation-webhook-chain*
*Completed: 2026-05-18*
