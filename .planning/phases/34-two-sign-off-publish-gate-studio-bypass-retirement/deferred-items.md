# Deferred Items — Phase 34

## `client` fixture never runs FastAPI lifespan (pre-existing, out of scope for 34-04)

**Found during:** 34-04 Task 2 verification (webhook D-07 guard).

**Symptom:** Any `tests/api/test_webhook_sanity.py` test that reaches
`request.app.state.background_tasks.add(task)` raises
`AttributeError: 'State' object has no attribute 'background_tasks'` when run
with real infra env vars sourced (`.env`).

**Root cause:** `tests/conftest.py`'s `client` fixture builds
`httpx.ASGITransport(app=app)` directly and does `async with AsyncClient(transport=transport, ...)`.
`httpx==0.28.1`'s `ASGITransport` has no `lifespan` parameter at all — it never
sends the ASGI `lifespan.startup`/`lifespan.shutdown` messages, so
`api/main.py`'s `lifespan()` function (which sets `app.state.graph`,
`app.state.pool`, `app.state.convex_http`, `app.state.sanity_http`,
`app.state.background_tasks`, etc.) never runs. Routes that use
`getattr(request.app.state, "x", None)` degrade gracefully (e.g. `/healthz`);
`api/webhooks.py`'s `request.app.state.background_tasks.add(task)` does not,
and raises.

**Confirmed pre-existing:** reproduced identically on unmodified `master`
(`git stash` before any 34-04 edits, same `AttributeError` on
`test_signature_accept_and_reject`). Not caused by the 34-04 D-07 guard.

**Why not fixed here:** Out of scope per CLAUDE.md SCOPE BOUNDARY — 34-04's
task is the D-07 sign-off re-validation guard, not the test harness's
lifespan wiring. Fixing this properly means either switching the `client`
fixture to `starlette.testclient.TestClient` (sync, runs lifespan via
`portal.call`) or asgi-lifespan's `LifespanManager`, and would touch every
consumer of the `client` fixture across the suite — a cross-cutting change
outside a single execute-plan task.

**Verified 34-04 is correct despite this:** manually smoke-tested the full
webhook handler + D-07 guard end-to-end using
`starlette.testclient.TestClient` (which DOES run lifespan) with a live
Convex-shaped mock — confirmed: missing sign-off → `_run_publisher` NOT
called, `_revert_sanity_status` called with `status="in-review"`, an audit
row (`action="run.publish_bypass_blocked"`) and a `deliberationEvents:insert`
`cost-warning`/`publish-bypass-blocked` alert are both emitted, response is
`{"ok": True, "blocked": "missing_signoffs", "missing": [...]}`.

**Practical impact today:** In this sandbox (and any environment without
`SUPABASE_POSTGRES_URL`/`NEXT_PUBLIC_CONVEX_URL`/etc. sourced),
`tests/api/test_webhook_sanity.py` skips entirely (fixture `_missing_env()`
guard) and the acceptance command
(`uv run pytest tests/api/test_webhook_sanity.py -x -q`) exits 0. Whether
this file's real-infra CI run (with `.env` sourced) already hits this bug for
the pre-existing tests (`test_signature_accept_and_reject`,
`test_idempotency_dedup`, `test_missing_idempotency_proceeds` — all of which
predate Phase 34 and already reach the same `background_tasks.add(task)`
line) is unverified from this sandbox; if it does, it is a Phase 6-era latent
bug, not a Phase 34 regression.

**Suggested follow-up:** A small, standalone quick-fix or debug task to swap
`tests/conftest.py`'s `client` fixture to run lifespan (e.g.
`from asgi_lifespan import LifespanManager` wrapping the transport, or migrate
to `starlette.testclient.TestClient` with `anyio`/sync bridging) so the whole
`tests/api/` suite reflects real boot behavior when infra env vars are
present.
