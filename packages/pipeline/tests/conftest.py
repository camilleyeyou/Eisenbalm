"""Shared pytest fixtures for the Eisenbalm pipeline test suite.

Source: 04-RESEARCH.md §10 + 04-VALIDATION.md §Wave 0 Requirements.

Every fixture is defensively guarded so `uv run pytest -v` exits 0 even when:
- Required env vars (Supabase / Convex / Sanity) are not set
- The FastAPI app module (`eisenbalm_pipeline.api.main`) has not yet been wired
  (Plans 06-09 land that surface)

Plan 10 replaces the test bodies that consume these fixtures; the fixture
shapes here are the contract Plan 10 will rely on.
"""
from __future__ import annotations

import os
from typing import Any, Awaitable, Callable, Optional

import pytest
from httpx import ASGITransport, AsyncClient


# ── Env helpers ───────────────────────────────────────────────────────────

REQUIRED_ENV_VARS = (
    "SUPABASE_POSTGRES_URL",
    "NEXT_PUBLIC_CONVEX_URL",
    "CONVEX_DEPLOY_KEY",
    "NEXT_PUBLIC_SANITY_PROJECT_ID",
    "SANITY_API_TOKEN",
    "PIPELINE_TRIGGER_SECRET",
)


def _missing_env() -> Optional[str]:
    """Return the first missing required env var, or None if all set."""
    for name in REQUIRED_ENV_VARS:
        if not os.getenv(name):
            return name
    return None


@pytest.fixture
def anyio_backend() -> str:
    return "asyncio"


# ── HTTP client fixtures ──────────────────────────────────────────────────


@pytest.fixture
async def client():
    """In-process FastAPI test client. Skips if any required env var is unset
    or if `eisenbalm_pipeline.api.main` is not yet importable (pre-Plan 09).

    Once Plan 09 lands FastAPI, this fixture activates and runs the real app
    in-process via ASGITransport (research §10 — fast, no Railway round-trip).
    """
    missing = _missing_env()
    if missing:
        pytest.skip(f"Required env var not set: {missing}")
    try:
        from eisenbalm_pipeline.api.main import app  # noqa: WPS433
    except ImportError as e:
        pytest.skip(f"FastAPI app not yet wired (Plan 09 pending): {e}")

    transport = ASGITransport(app=app)
    async with AsyncClient(
        transport=transport,
        base_url="http://test",
        headers={
            "X-Pipeline-Trigger-Secret": os.environ["PIPELINE_TRIGGER_SECRET"],
        },
    ) as c:
        yield c


@pytest.fixture
async def convex_query_fn():
    """Async helper for direct Convex query assertions.

    Usage:
        rows = await convex_query_fn('pipelineRuns:byRunId', {'runId': '...'})

    Skips if any required env var is unset.
    """
    missing = _missing_env()
    if missing:
        pytest.skip(f"Required env var not set: {missing}")

    async with AsyncClient(
        base_url=os.environ["NEXT_PUBLIC_CONVEX_URL"].rstrip("/"),
        timeout=15.0,
    ) as http:

        async def _q(path: str, args: dict) -> Any:
            r = await http.post(
                "/api/query",
                json={"path": path, "args": args, "format": "json"},
                headers={
                    "Authorization": f"Convex {os.environ['CONVEX_DEPLOY_KEY']}",
                },
            )
            r.raise_for_status()
            body = r.json()
            if body.get("status") != "success":
                raise RuntimeError(
                    f"Convex query failed: {path} → {body.get('errorMessage')}"
                )
            return body.get("value")

        yield _q


# ── Cleanup helpers ───────────────────────────────────────────────────────


@pytest.fixture
async def sanity_cleanup() -> Callable[[int], Awaitable[None]]:
    """Returns an async function `await sanity_cleanup(issue_number)` that
    deletes the Sanity draft for `issue-{issue_number}`.

    Used by integration tests for teardown. Tolerant of "not found" responses
    (Sanity mutation returns 200 with no error for missing docs).
    """
    missing = _missing_env()
    if missing:
        pytest.skip(f"Required env var not set: {missing}")

    project = os.environ["NEXT_PUBLIC_SANITY_PROJECT_ID"]
    dataset = os.environ.get("NEXT_PUBLIC_SANITY_DATASET", "production")
    token = os.environ["SANITY_API_TOKEN"]
    api_version = "v2024-01-01"

    async with AsyncClient(
        base_url=f"https://{project}.api.sanity.io",
        timeout=15.0,
    ) as http:

        async def _delete(issue_number: int) -> None:
            issue_id = f"issue-{issue_number}"
            await http.post(
                f"/{api_version}/data/mutate/{dataset}",
                json={"mutations": [{"delete": {"id": issue_id}}]},
                headers={"Authorization": f"Bearer {token}"},
            )

        yield _delete


# ── Sanity GET helper (for asserting pipelineMetadata.runId) ──────────────


@pytest.fixture
async def sanity_get_issue() -> Callable[[int], Awaitable[Optional[dict]]]:
    """Returns `await sanity_get_issue(issue_number)` -> draft doc dict (or None).

    Uses the Sanity `doc/{dataset}/{id}` endpoint (read-only).
    """
    missing = _missing_env()
    if missing:
        pytest.skip(f"Required env var not set: {missing}")

    project = os.environ["NEXT_PUBLIC_SANITY_PROJECT_ID"]
    dataset = os.environ.get("NEXT_PUBLIC_SANITY_DATASET", "production")
    token = os.environ["SANITY_API_TOKEN"]
    api_version = "v2024-01-01"

    async with AsyncClient(
        base_url=f"https://{project}.api.sanity.io",
        timeout=15.0,
    ) as http:

        async def _get(issue_number: int) -> Optional[dict]:
            issue_id = f"issue-{issue_number}"
            r = await http.get(
                f"/{api_version}/data/doc/{dataset}/{issue_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            r.raise_for_status()
            body = r.json()
            docs = body.get("documents") or []
            return docs[0] if docs else None

        yield _get


# ── Phase 5 mock fixtures (added by Plan 05-04) ───────────────────────────
#
# These fixtures are pure unit-test mocks. They do NOT require any env vars
# and do NOT skip — every Wave 1-3 agent test consumes them directly.
# Source: 05-VALIDATION.md Wave 0 Requirements + 05-RESEARCH.md §Validation
# Architecture.

from unittest.mock import AsyncMock, MagicMock  # noqa: E402  (intentional late import)


@pytest.fixture
def mock_convex_mutation():
    """Patch lib.convex_client.convex_mutation_safe to record calls.

    Returns an AsyncMock. Tests assert on call_args_list to verify
    the right mutation name + payload was issued.
    """
    mock = AsyncMock(return_value={"status": "success"})
    return mock


@pytest.fixture
def mock_sanity_write_charity():
    """Patch lib.sanity_client.write_charity. Returns deterministic _id."""
    mock = AsyncMock(side_effect=lambda http, c: f"charity-{c['name'].lower().replace(' ', '-')}")
    return mock


@pytest.fixture
def mock_openrouter_acomplete():
    """Patch lib.openrouter_client.acomplete with a canned response.

    Tests set .return_value or .side_effect to control content + usage.
    Default returns the empty-string content + zero tokens (cost cap safe).
    """
    mock = AsyncMock(return_value=("", {
        "tokens_in": 0,
        "tokens_out": 0,
        "usd": 0.0,
        "resolved_model": "anthropic/claude-opus-4-7",
    }))
    return mock


@pytest.fixture
def mock_tavily_search():
    """Patch lib.search_client.web_search. Returns 3 fake SearchResult-shaped dicts."""
    mock = AsyncMock(return_value=[
        {"url": "https://example.org/about", "title": "Example Charity", "content": "...", "score": 0.9},
        {"url": "https://example2.org/about", "title": "Another Charity", "content": "...", "score": 0.8},
        {"url": "https://example3.org/about", "title": "Third Charity", "content": "...", "score": 0.7},
    ])
    return mock


@pytest.fixture
def mock_httpx_get():
    """Patch httpx.AsyncClient.get for verify_research tests.

    Default returns 200 OK with HTML containing 'Jane Doe' for substring matching.
    """
    response = MagicMock()
    response.text = "<html><body>About us. Founded by Jane Doe in 2003.</body></html>"
    response.raise_for_status = MagicMock(return_value=None)
    mock = AsyncMock(return_value=response)
    return mock


@pytest.fixture
def sample_dispatch_state():
    """Minimal DispatchState dict for unit-test assembly."""
    return {
        "run_id": "test-run-id-0001",
        "issue_number": 42,
        "publish_date": "2026-05-21",
        "pipeline_started_at": "2026-05-21T10:00:00Z",
        "style_brief": {
            "voice": "Jesse",
            "constraints": ["No exclamation marks", "No sentimentality"],
            "bonusType": "bigBudget",
            "visualDirection": "Warm cream and oxblood",
            "previousBonusTypes": ["jingle"],
        },
        "winning_charity": {
            "name": "Example Charity",
            "location": "Maine, USA",
            "website": "https://example.org",
            "missionStatement": "We help people.",
            "assetRange": "$100K–$500K",
            "focusArea": "Education",
        },
        "research": {
            "summary": "Founded 2003 by Jane Doe...",
            "founderName": "Jane Doe",
            "founderRole": "founder",
            "founderNameSourceUrl": "https://example.org/about",
            "founderNameVerified": True,
            "subjectName": "Alex Smith",
            "subjectRole": "a parent",
            "subjectNameSourceUrl": "https://example.org/stories/alex",
            "subjectNameVerified": True,
        },
        "featured_charity_keys": [],
        "model_versions": {},
    }


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


# ── Phase 25 — runs/pipeline_config Convex stub fixtures ──────────────────
#
# ``convex_runs_store`` and ``convex_config_store`` provide in-memory dict-backed
# stubs for every Convex mutation/query that Phase 25 run-control code touches.
# They monkeypatch ``lib.convex_client.convex_mutation``,
# ``lib.convex_client.convex_mutation_safe``, and ``lib.convex_client.convex_query``
# the same way the existing ``mock_convex_mutation`` fixture does, but with
# behaviour-faithful in-memory stores so tests can assert on stored state +
# recorded call sequences rather than just call counts.
#
# Usage in tests:
#   async def test_something(convex_runs_store, convex_config_store, monkeypatch):
#       convex_config_store.seed("schedule_enabled", False)
#       convex_runs_store.seed({"runId": "run-001", "status": "running"})
#       # ... call endpoint / fn under test ...
#       assert convex_runs_store.mutation_calls("runs:create") == 0


class _ConvexRunsStore:
    """In-memory stub for runs:* Convex mutations and queries.

    Seeded rows are queryable by runId; mutation calls are recorded so tests
    can assert counts / args (e.g. assert zero ``runs:create`` calls when the
    kill switch is off).
    """

    def __init__(self) -> None:
        self._rows: list[dict] = []
        self._call_log: list[tuple[str, dict]] = []
        self._cancel_flags: dict[str, bool] = {}

    # ── Test helpers ──────────────────────────────────────────────────────

    def seed(self, row: dict) -> None:
        """Pre-populate a runs row (must include at least ``runId``)."""
        self._rows.append(dict(row))

    def mutation_calls(self, path: str) -> int:
        """Return the number of recorded mutation calls matching ``path``."""
        return sum(1 for p, _ in self._call_log if p == path)

    def all_calls(self) -> list[tuple[str, dict]]:
        """Return every (path, args) pair recorded so far."""
        return list(self._call_log)

    # ── Mutation handlers ─────────────────────────────────────────────────

    async def _handle_mutation(self, http: Any, path: str, args: dict) -> Any:
        self._call_log.append((path, dict(args)))
        if path == "runs:create":
            row = dict(args)
            row.setdefault("cancelRequested", False)
            self._rows.append(row)
            return {"status": "success"}
        if path == "runs:updateStatus":
            for row in self._rows:
                if row.get("runId") == args.get("runId"):
                    row.update({k: v for k, v in args.items() if k != "runId"})
            return {"status": "success"}
        if path == "runs:requestCancel":
            run_id = args.get("runId", "")
            self._cancel_flags[run_id] = True
            for row in self._rows:
                if row.get("runId") == run_id:
                    row["cancelRequested"] = True
            return {"status": "success"}
        # Default no-op for other mutations
        return {"status": "success"}

    async def _handle_mutation_safe(self, path: str, args: dict) -> None:
        await self._handle_mutation(None, path, args)

    async def _handle_query(self, http: Any, path: str, args: dict) -> Any:
        import json as _json
        if path == "runs:byRunId":
            run_id = args.get("runId")
            for row in self._rows:
                if row.get("runId") == run_id:
                    return dict(row)
            return None
        if path == "runs:latest":
            ws = args.get("workspace_id", "eisenbalm")
            matches = [r for r in self._rows if r.get("workspace_id", "eisenbalm") == ws]
            return dict(matches[-1]) if matches else None
        if path == "runs:isCancelRequested":
            run_id = args.get("runId", "")
            return self._cancel_flags.get(run_id, False)
        if path == "runs:monthToDateCost":
            # In-memory stub: sums ALL seeded runs' cost as MTD (no timestamp
            # filtering in tests — unit tests verify gate logic, not date math).
            # trailingCosts = last up-to-4 completed/awaiting-review run totals.
            completed = [
                r for r in self._rows
                if r.get("status") in ("complete", "awaiting-review") and r.get("cost")
            ]
            # Sort newest-first by startedAt (or insertion order if equal).
            completed_sorted = sorted(
                completed,
                key=lambda r: r.get("startedAt", 0),
                reverse=True,
            )[:4]
            trailing_costs: list[float] = []
            mtd_usd = 0.0
            for row in self._rows:
                cost_raw = row.get("cost")
                if cost_raw:
                    try:
                        parsed = _json.loads(cost_raw)
                        if isinstance(parsed.get("total"), (int, float)):
                            mtd_usd += float(parsed["total"])
                    except Exception:
                        pass
            for row in completed_sorted:
                cost_raw = row.get("cost")
                if cost_raw:
                    try:
                        parsed = _json.loads(cost_raw)
                        if isinstance(parsed.get("total"), (int, float)):
                            trailing_costs.append(float(parsed["total"]))
                    except Exception:
                        pass
            return {
                "mtdUsd": mtd_usd,
                "completedCount": len(completed),
                "trailingCosts": trailing_costs,
            }
        return None


class _ConvexConfigStore:
    """In-memory stub for pipelineConfig:* Convex mutations and queries.

    Tests call ``seed(key, value)`` to pre-populate config rows before
    invoking the system-under-test; the store records all upsert calls so
    tests can verify config writes.
    """

    def __init__(self) -> None:
        self._config: dict[str, Any] = {}
        self._call_log: list[tuple[str, dict]] = []

    # ── Test helpers ──────────────────────────────────────────────────────

    def seed(self, key: str, value: Any) -> None:
        """Pre-populate a config key/value pair."""
        self._config[key] = value

    def mutation_calls(self, path: str) -> int:
        """Return the number of recorded mutation calls matching ``path``."""
        return sum(1 for p, _ in self._call_log if p == path)

    # ── Mutation / query handlers ─────────────────────────────────────────

    async def _handle_mutation(self, http: Any, path: str, args: dict) -> Any:
        self._call_log.append((path, dict(args)))
        if path == "pipelineConfig:upsert":
            import json as _json
            key = args.get("key", "")
            raw = args.get("value", "null")
            try:
                self._config[key] = _json.loads(raw)
            except Exception:
                self._config[key] = raw
        return {"status": "success"}

    async def _handle_mutation_safe(self, path: str, args: dict) -> None:
        await self._handle_mutation(None, path, args)

    async def _handle_query(self, http: Any, path: str, args: dict) -> Any:
        import json as _json
        if path == "pipelineConfig:getAll":
            ws = args.get("workspace_id", "eisenbalm")
            return [
                {"workspace_id": ws, "key": k, "value": _json.dumps(v)}
                for k, v in self._config.items()
            ]
        return None


@pytest.fixture
def convex_runs_store(monkeypatch: pytest.MonkeyPatch) -> "_ConvexRunsStore":
    """In-memory dict-backed stub for runs:* Convex mutations and queries.

    Monkeypatches ``lib.convex_client.convex_mutation``,
    ``lib.convex_client.convex_mutation_safe``, and
    ``lib.convex_client.convex_query`` to route runs:* paths to in-memory
    handlers. Returns the store object so tests can call
    ``store.seed(row)``, ``store.mutation_calls(path)``, etc.

    When used together with ``convex_config_store``, chaining is handled via
    path-prefix routing in the shared ``_ConvexMultiStore`` dispatcher
    installed by whichever fixture is applied second.

    Source: 25-01-PLAN.md Task 3.
    """
    store = _ConvexRunsStore()

    import eisenbalm_pipeline.lib.convex_client as _cc

    # Capture any previously-installed handler (e.g. from convex_config_store
    # applied first in a different fixture ordering).
    prev_mutation = _cc.convex_mutation
    prev_mutation_safe = _cc.convex_mutation_safe
    prev_query = _cc.convex_query
    prev_query_safe = getattr(_cc, "convex_query_safe", None)

    async def _dispatch_mutation(http: Any, path: str, args: dict) -> Any:
        if path.startswith("runs:") or path.startswith("agentRuns:") or path.startswith("pipelineRuns:"):
            return await store._handle_mutation(http, path, args)
        return await prev_mutation(http, path, args)

    async def _dispatch_mutation_safe(path: str, args: dict) -> None:
        if path.startswith("runs:") or path.startswith("agentRuns:") or path.startswith("pipelineRuns:"):
            await store._handle_mutation_safe(path, args)
        else:
            await prev_mutation_safe(path, args)

    async def _dispatch_query(http: Any, path: str, args: dict) -> Any:
        if path.startswith("runs:") or path.startswith("agentRuns:") or path.startswith("pipelineRuns:"):
            return await store._handle_query(http, path, args)
        return await prev_query(http, path, args)

    async def _dispatch_query_safe(path: str, args: dict) -> Any:
        if path.startswith("runs:") or path.startswith("agentRuns:") or path.startswith("pipelineRuns:"):
            return await store._handle_query(None, path, args)
        if prev_query_safe is not None:
            return await prev_query_safe(path, args)
        return None

    monkeypatch.setattr(_cc, "convex_mutation", _dispatch_mutation)
    monkeypatch.setattr(_cc, "convex_mutation_safe", _dispatch_mutation_safe)
    monkeypatch.setattr(_cc, "convex_query", _dispatch_query)
    monkeypatch.setattr(_cc, "convex_query_safe", _dispatch_query_safe)
    return store


@pytest.fixture
def convex_config_store(monkeypatch: pytest.MonkeyPatch) -> "_ConvexConfigStore":
    """In-memory dict-backed stub for pipelineConfig:* Convex mutations and queries.

    Monkeypatches ``lib.convex_client.convex_mutation``,
    ``lib.convex_client.convex_mutation_safe``, and
    ``lib.convex_client.convex_query`` to route pipelineConfig:* paths to
    in-memory handlers. Tests call ``store.seed(key, value)`` to pre-populate
    config before invoking the system under test.

    When used together with ``convex_runs_store``, chaining is handled via
    path-prefix routing — pipelineConfig:* paths go to this store; everything
    else falls through to the previously-installed handler (including runs:*
    paths already claimed by convex_runs_store).

    Source: 25-01-PLAN.md Task 3.
    """
    store = _ConvexConfigStore()

    import eisenbalm_pipeline.lib.convex_client as _cc

    # Capture any previously-installed handler (e.g. from convex_runs_store).
    prev_mutation = _cc.convex_mutation
    prev_mutation_safe = _cc.convex_mutation_safe
    prev_query = _cc.convex_query
    prev_query_safe = getattr(_cc, "convex_query_safe", None)

    async def _dispatch_mutation(http: Any, path: str, args: dict) -> Any:
        if path.startswith("pipelineConfig:") or path.startswith("auditLog:"):
            return await store._handle_mutation(http, path, args)
        return await prev_mutation(http, path, args)

    async def _dispatch_mutation_safe(path: str, args: dict) -> None:
        if path.startswith("pipelineConfig:") or path.startswith("auditLog:"):
            await store._handle_mutation_safe(path, args)
        else:
            await prev_mutation_safe(path, args)

    async def _dispatch_query(http: Any, path: str, args: dict) -> Any:
        if path.startswith("pipelineConfig:"):
            return await store._handle_query(http, path, args)
        return await prev_query(http, path, args)

    async def _dispatch_query_safe(path: str, args: dict) -> Any:
        # pipelineConfig has no query_safe paths; fall through to previous handler
        if prev_query_safe is not None:
            return await prev_query_safe(path, args)
        return None

    monkeypatch.setattr(_cc, "convex_mutation", _dispatch_mutation)
    monkeypatch.setattr(_cc, "convex_mutation_safe", _dispatch_mutation_safe)
    monkeypatch.setattr(_cc, "convex_query", _dispatch_query)
    monkeypatch.setattr(_cc, "convex_query_safe", _dispatch_query_safe)
    return store


# ── Phase 6 — vercel deploy hook stub fixture ─────────────────────────────


@pytest.fixture
def mock_vercel_trigger():
    """Patch lib.vercel_client.trigger_vercel_deploy. Returns dict marker.

    Tests assert on call_count to verify the deploy hook fired exactly once.
    """
    mock = AsyncMock(return_value={"job": {"id": "test-job-id", "state": "READY", "createdAt": 1}})
    return mock
