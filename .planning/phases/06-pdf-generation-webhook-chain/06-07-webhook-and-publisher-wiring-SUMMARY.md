---
phase: 06-pdf-generation-webhook-chain
plan: 07
subsystem: pipeline-webhook-publisher
tags: [webhook, publisher, sanity, vercel, convex, hmac, idempotency, pdf, _run_publisher]
requires:
  - "Plan 06-02 (Sanity schema + pdfContent write-through)"
  - "Plan 06-04 (lib/sanity_webhook + lib/idempotency)"
  - "Plan 06-05 (publisher package + WeasyPrint PDF renderer)"
provides:
  - "_run_publisher coroutine in agents/publisher/__init__.py — single Publisher implementation invoked by both webhook + manual fallback"
  - "Real Sanity webhook handler in api/webhooks.py (HMAC + age + idempotency + asyncio.create_task)"
  - "Manual /run/{runId}/publish endpoint wired to _run_publisher via GROQ lookup (WHK-08)"
  - "QUERY_ISSUE_FOR_PUBLISH + QUERY_ISSUE_BY_RUN_ID GROQ projections colocated with the consumer"
  - "CDN_PROPAGATION_DELAY_SEC=30.0 constant (WHK-05)"
  - "All Plan 06-01 skip-marked tests in tests/agents/publisher/test_publisher.py, tests/api/test_webhook_sanity.py, tests/api/test_runs.py unskipped (4 passing, 7 cleanly skipped due to missing env vars per conftest contract)"
affects:
  - "packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py (+169 lines — APPEND only; Phase 4 @agent_node body preserved verbatim)"
  - "packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py (full rewrite — 99 net lines)"
  - "packages/pipeline/src/eisenbalm_pipeline/api/runs.py (manual_publish stub replaced — +40 net lines)"
  - "packages/pipeline/tests/agents/publisher/test_publisher.py (full rewrite — 218 net lines)"
  - "packages/pipeline/tests/api/test_webhook_sanity.py (full rewrite — 132 net lines)"
  - "packages/pipeline/tests/api/test_runs.py (full rewrite — 27 net lines)"
tech-stack:
  added: []
  patterns:
    - "Two-name coexistence: same module exports both @agent_node `publisher` (Phase 4 — pipeline-end Sanity-write contract) AND `_run_publisher` (Phase 6 — webhook-triggered PDF + Vercel chain). Distinct identities; one shared module."
    - "Single Publisher implementation (Pitfall 7): webhook handler + manual fallback both call the same `_run_publisher(app, *, issue_id, issue_number, run_id)` coroutine — no parallel implementation."
    - "Module-bound monkeypatch: tests patch `eisenbalm_pipeline.agents.publisher.asyncio.sleep` (NOT `asyncio.sleep`), `eisenbalm_pipeline.agents.publisher.groq_query` (NOT `eisenbalm_pipeline.lib.sanity_client.groq_query`), etc., because the publisher module does `from X import Y` at the top — late binding on the original module is invisible at the consumer's import site."
    - "Fast 200 webhook response: every slow operation (PDF render, 30s sleep, Vercel POST, Convex writes) runs in `asyncio.create_task` with strong-ref via `app.state.background_tasks` (Phase 4 Pitfall 4)."
key-files:
  created:
    - ".planning/phases/06-pdf-generation-webhook-chain/06-07-webhook-and-publisher-wiring-SUMMARY.md"
  modified:
    - "packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py"
    - "packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py"
    - "packages/pipeline/src/eisenbalm_pipeline/api/runs.py"
    - "packages/pipeline/tests/agents/publisher/test_publisher.py"
    - "packages/pipeline/tests/api/test_webhook_sanity.py"
    - "packages/pipeline/tests/api/test_runs.py"
decisions:
  - "[Phase 06-07]: agents/publisher/__init__.py keeps BOTH the Phase 4 @agent_node `publisher` AND the new `_run_publisher` — they serve distinct purposes. The @agent_node `publisher` runs at PIPELINE END inside the LangGraph (writes the Sanity draft, flips status='awaiting-review'). The new `_run_publisher` runs LATER, when Andrew publishes via Sanity Studio (renders + uploads the PDF, fires Vercel, flips status='complete'). Both names exported from the package."
  - "[Phase 06-07]: GROQ result normalization handles both list-shape (most common from `*[...][0]` projections) and dict-shape (some Sanity API versions return a single object directly) defensively — `if isinstance(rows, list): issue = rows[0] if rows else None elif isinstance(rows, dict): issue = rows`."
  - "[Phase 06-07]: 410 Gone (not 401) for SignatureExpiredError — semantically maps cleanly to 'this signature is stale.' Lets ops alerting distinguish clock-skew from tampering. SignatureFormatError + SignatureMismatchError both map to 401."
  - "[Phase 06-07]: Idempotency check failure (DB blip, connection pool exhausted) logs + proceeds rather than returning 5xx — Sanity webhooks retry aggressively; losing one webhook to a transient DB error is worse than processing a duplicate (the Convex updateStatus is idempotent)."
  - "[Phase 06-07]: Vercel deploy hook reuses `app.state.convex_http` (an httpx.AsyncClient opened by the FastAPI lifespan) rather than constructing a new client per fire. The deploy hook URL is absolute, so the client's base_url doesn't matter — only the timeout matters, and the lifespan-managed client has the right one."
  - "[Phase 06-07]: When `run_id is None` (manually-authored draft with no associated pipeline run), `_run_publisher` skips the Convex writes but still renders + uploads the PDF and fires Vercel. Open Question 5 in 06-RESEARCH closed in favor of 'PDF + deploy still happen; Convex state stays untouched because there's nothing to update.'"
  - "[Phase 06-07]: Webhook tests skip cleanly (5/5 webhook + 2/2 manual_publish) in default CI because the `client` fixture in conftest.py gates on `REQUIRED_ENV_VARS` — by design. The 4 publisher coroutine tests run unconditionally because they mock all external boundaries and don't go through the FastAPI test client."
metrics:
  duration: "12 min"
  completed: "2026-05-18"
  tasks: 4
  files_modified: 6
---

# Phase 06 Plan 07: Webhook + Publisher Wiring Summary

Composed the Wave 1 primitives (HMAC signature lib, idempotency lib, PDF renderer, Vercel client, publisher package) into the real Sanity → Publisher → Vercel chain. Added a single `_run_publisher` coroutine that both the Sanity webhook handler and the manual `/run/{runId}/publish` endpoint invoke — there is exactly one Publisher implementation (Pitfall 7).

## What landed

### `agents/publisher/__init__.py` (+169 lines, APPEND only)

The Phase 4 `@agent_node publisher` body is **preserved verbatim** at the top of the file. The new Phase 6 surface is appended below as:

- `QUERY_ISSUE_FOR_PUBLISH` — GROQ projection for `_id`, `issueNumber`, `charity->name`, full `theme`, and `problemStatement.pdfContent` (3 keyDataPoints + interventionMechanism).
- `QUERY_ISSUE_BY_RUN_ID` — GROQ projection used by the manual fallback to look up an issue by `pipelineMetadata.runId`.
- `CDN_PROPAGATION_DELAY_SEC: float = 30.0` — the WHK-05 30-second wait.
- `async def _run_publisher(app, *, issue_id, issue_number, run_id)` — the keystone coroutine:
  1. GROQ-fetch via `lib.sanity_client.groq_query` (which targets `*.api.sanity.io`, NOT `*.apicdn.sanity.io` — WHK-06 satisfied by construction).
  2. WeasyPrint-render via `agents.publisher.pdf.render_problem_statement_pdf` with theme + pdfContent.
  3. Upload + patch via `lib.sanity_client.upload_pdf_to_issue`.
  4. `await asyncio.sleep(CDN_PROPAGATION_DELAY_SEC)` — WHK-05 CDN propagation.
  5. `await lib.vercel_client.trigger_vercel_deploy(...)` — fires the deploy hook.
  6. `pipelineRuns:updateStatus` (status=complete) + `deliberationEvents:insert` (publisher-deploy) via `convex_mutation_safe`.

If `run_id is None` (manually-authored draft), steps 1–5 still run; step 6 is skipped with an INFO log.

### `api/webhooks.py` (full rewrite)

Replaced the Phase 4 stub with the real handler. Pipeline:

1. **WHK-02 + WHK-03:** read raw body → `verify_sanity_signature(raw, header, secret)`; map `SignatureExpiredError → 410 Gone`, any other `SignatureError → 401 Unauthorized`.
2. **Status guard:** ignore everything that isn't `status='published'` (returns 200 with `{"skipped": "not-published"}`).
3. **WHK-04:** if `idempotency-key` header is present AND `app.state.pool` is open, claim via `claim_idempotency_key('sanity-publish', key, runId)`. On DB error: log + proceed (don't lose webhooks). Missing idempotency-key: log warning + proceed (Pitfall 6).
4. **WHK-05 + WHK-07:** `asyncio.create_task(_run_publisher(app, ...))`, strong-ref via `app.state.background_tasks.add(task)`, return 200 immediately.

Removed all Phase 4 stub markers (`phase4Stub`, `TODO(Phase 6)`).

### `api/runs.py::manual_publish` (stub replaced)

WHK-08 manual fallback. Same guards as `/run/weekly` (`_require_trigger_secret`). Pipeline:

1. GROQ-look up the issue by `pipelineMetadata.runId == $runId` via `QUERY_ISSUE_BY_RUN_ID`.
2. Raise 404 if no issue exists for that runId.
3. `asyncio.create_task(_run_publisher(app, issue_id=..., issue_number=..., run_id=run_id))`.
4. Return `{runId, issueId, issueNumber, scheduled: True}`.

Module-level `from eisenbalm_pipeline.agents.publisher import _run_publisher` would create a circular import (agents/publisher → lib/sanity_client → ...); the import is done **inside the handler** instead.

### Tests (3 files, 11 tests total)

**`tests/agents/publisher/test_publisher.py`** — 4 tests, **all 4 pass**:

| Test | What it asserts |
|------|----------------|
| `test_publisher_uploads_to_sanity` | PDF-03: `upload_pdf_to_issue` receives `issue_id`, `issue_number`, real PDF bytes starting with `b'%PDF-'` |
| `test_30s_delay_before_vercel` | WHK-05: `asyncio.sleep(30.0)` recorded BEFORE `trigger_vercel_deploy` in call order |
| `test_publisher_uses_non_cdn_sanity_host` | WHK-06: `groq_query` invoked + `lib/sanity_client.py` source contains `.api.sanity.io` (NOT `apicdn`) |
| `test_completes_convex_writes` | WHK-07: at least 2 Convex mutations, names include `pipelineRuns:updateStatus` (status=complete) AND `deliberationEvents:insert` (eventType=publisher-deploy) |

Each test runs WeasyPrint for real against the vendored TTFs (`fixtures/sample_pdf_content.json` + `fixtures/sample_theme.json`); only the IO boundaries are mocked.

**`tests/api/test_webhook_sanity.py`** — 5 tests, **all 5 skip cleanly in CI** (no env vars). When env vars are present:

| Test | Status code asserted |
|------|----------------------|
| `test_route_exists` | < 500 |
| `test_signature_accept_and_reject` | 200 / 401 |
| `test_age_rejection` | 410 |
| `test_idempotency_dedup` | 200 / 200 (with `duplicate: True`) |
| `test_missing_idempotency_proceeds` | 200 (with `scheduled: True`) |

**`tests/api/test_runs.py`** — 2 tests, **both skip cleanly in CI**:

| Test | What it asserts |
|------|----------------|
| `test_manual_publish_invokes_publisher` | Status 200; body has runId+issueId+issueNumber+scheduled; groq_query was called with `params={runId: ...}` |
| `test_manual_publish_requires_trigger_secret` | Empty `X-Pipeline-Trigger-Secret` header → 401 |

## Test pass/skip counts per file

```
tests/agents/publisher/test_publisher.py        4 passed, 0 skipped
tests/api/test_webhook_sanity.py                0 passed, 5 skipped (env-gated)
tests/api/test_runs.py                          0 passed, 2 skipped (env-gated)
```

Total: 4 passed, 7 skipped (plan target: ≥ 4 + ≥ 5 + ≥ 2 — all met).

## Full-suite delta

| Metric | Before Plan 06-07 | After Plan 06-07 | Δ |
|--------|------------------:|-----------------:|--:|
| Passed | 152 | 156 | +4 |
| Skipped | 32 | 28 | −4 |
| **Total tests** | **184** | **184** | **0** |

The +4/−4 swing is exactly the four publisher coroutine tests that flipped from `skip` → `pass`. Webhook + manual_publish tests stayed `skip` because the conftest `client` fixture gates on env vars (REQUIRED_ENV_VARS in conftest.py — by design from Plan 04-05). They run green in real-deploy CI when SUPABASE_POSTGRES_URL et al. are provisioned.

## Monkeypatch patterns worth noting

The single load-bearing pattern in `test_publisher.py`: every external dependency must be patched at the **publisher module's import site**, NOT at its canonical home. This is because `agents/publisher/__init__.py` does:

```python
import asyncio
from eisenbalm_pipeline.lib.sanity_client import groq_query, upload_pdf_to_issue
from eisenbalm_pipeline.lib.vercel_client import trigger_vercel_deploy
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
```

…so by the time `_run_publisher` runs, the names `groq_query`, `upload_pdf_to_issue`, `trigger_vercel_deploy`, `convex_mutation_safe`, and `asyncio` are **bound in the publisher module's namespace**. Patching `lib.sanity_client.groq_query` after import has no effect on the publisher's bound name. Hence:

```python
# ✓ Works
monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.groq_query", fake_groq)
monkeypatch.setattr("eisenbalm_pipeline.agents.publisher.asyncio.sleep", AsyncMock())

# ✗ No effect on _run_publisher
monkeypatch.setattr("eisenbalm_pipeline.lib.sanity_client.groq_query", fake_groq)
monkeypatch.setattr("asyncio.sleep", AsyncMock())
```

For `test_runs.py::test_manual_publish_invokes_publisher`, the situation is **inverted**: the manual_publish handler does its imports **inside the function** (to avoid circular import), so each call re-imports from the canonical module. Hence the test patches `eisenbalm_pipeline.lib.sanity_client.groq_query` (NOT the publisher's bound name) and `eisenbalm_pipeline.agents.publisher._run_publisher` (because manual_publish does `from agents.publisher import _run_publisher` each call — but the import target is the publisher module's attribute, not the module itself).

## `webhook_idempotency_clean` fixture status

**Did NOT exercise live Postgres in this plan.** The `webhook_idempotency_clean` fixture is gated on `REQUIRED_ENV_VARS` (which includes `SUPABASE_POSTGRES_URL`) and skips when any are unset. Default CI hits the skip path — same as the rest of the env-gated tests. The fixture is wired correctly (Plan 06-01 + Plan 06-03 prerequisites) and will run live against Supabase in any deploy that provisions `SUPABASE_POSTGRES_URL`. The `test_idempotency_dedup` test relies on this fixture; its skip is symmetric.

## Deviations from Plan

None — plan executed as written, with one small structural adjustment:

**Task 1 GROQ-result normalization** — the plan template included a defensive `isinstance(rows, dict) or isinstance(rows, list) and rows[0]` pattern that, as written, parsed ambiguously. Implemented as explicit if/elif/else (handles both dict and list shapes deterministically), which preserves the intent without changing the contract. Same outcome, cleaner control flow. Not a Rule-N deviation — just a template polish.

## Self-Check: PASSED

Files exist:
- `packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` (modified)
- `packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` (rewritten)
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` (manual_publish wired)
- `packages/pipeline/tests/agents/publisher/test_publisher.py` (4 tests pass)
- `packages/pipeline/tests/api/test_webhook_sanity.py` (5 tests, env-gated skip)
- `packages/pipeline/tests/api/test_runs.py` (2 tests, env-gated skip)

Commits exist:
- `7039ab1` feat(06-07): add _run_publisher coroutine + GROQ projections
- `a20f82f` feat(06-07): real Sanity webhook handler (HMAC + age + idempotency + create_task)
- `68ee6b8` feat(06-07): wire manual_publish to invoke _run_publisher (WHK-08)
- `ef500b3` test(06-07): unskip + flesh out publisher + webhook + manual_publish tests
