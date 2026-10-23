"""Quick 261022-x8y — POST /runs/{id}/discard."""
from __future__ import annotations

import asyncio
from types import SimpleNamespace

import httpx
import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

import eisenbalm_pipeline.lib.discard as discard
import eisenbalm_pipeline.lib.sanity_client as sc
from eisenbalm_pipeline.api import runs as runs_mod
from eisenbalm_pipeline.api.control import router as control_router
from eisenbalm_pipeline.lib.errors import RunCancelled

pytestmark = pytest.mark.anyio

RUN = "run-d-001"


def _app() -> FastAPI:
    app = FastAPI()
    app.include_router(control_router)
    return app


@pytest.fixture
def sanity(monkeypatch):
    rec = SimpleNamespace(docs=[], deletes=[], order=[])

    async def find(http, n):
        return rec.docs

    async def delete(http, n, run_id):
        rec.deletes.append((n, run_id))
        rec.order.append("delete")

    monkeypatch.setattr(sc, "find_issue_docs", find)
    monkeypatch.setattr(sc, "delete_run_issue_docs", delete)
    monkeypatch.delenv("CLERK_JWT_ISSUER_DOMAIN", raising=False)
    return rec


async def _post(app, path):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        return await c.post(path)


def _seed(store, **kw):
    row = {"runId": RUN, "status": "awaiting-review", "completedAt": 1700000000000,
           "issueNumber": 48, "workspace_id": "eisenbalm"}
    row.update(kw)
    store.seed(row)


def _paths(store):
    return [p for p, _ in store.all_calls()]


async def test_discard_ready_issue(convex_runs_store, sanity):
    _seed(convex_runs_store)
    sanity.docs = [{"_id": "issue-48", "status": "draft", "runId": RUN}]
    r = await _post(_app(), f"/runs/{RUN}/discard")
    assert r.status_code == 200, r.text
    assert r.json() == {"runId": RUN, "status": "cancelled", "discarded": True}
    calls = dict(reversed(convex_runs_store.all_calls()))
    assert calls["runs:updateStatus"]["status"] == "cancelled"
    assert isinstance(calls["runs:updateStatus"]["completedAt"], int)
    assert calls["pipelineRuns:updateStatus"]["status"] == "failed"
    assert calls["pipelineRuns:updateStatus"]["errorMessage"] == "Discarded by the editor"
    assert sanity.deletes == [(48, RUN)]


async def test_discard_paused_run(convex_runs_store, sanity):
    row = {"runId": RUN, "status": "awaiting-review", "issueNumber": 48, "workspace_id": "eisenbalm"}
    convex_runs_store.seed(row)
    r = await _post(_app(), f"/runs/{RUN}/discard")
    assert r.json()["discarded"] is True
    assert "runs:requestCancel" not in _paths(convex_runs_store)
    assert sanity.deletes == [(48, RUN)]


@pytest.mark.parametrize("docs", [
    [{"_id": "issue-48", "status": "published", "runId": RUN}],
    [{"_id": "issue-48", "publishedAt": "2026-10-01T00:00:00Z", "runId": RUN}],
    [{"_id": "issue-48", "status": "published"}, {"_id": "drafts.issue-48", "status": "draft"}],
])
async def test_discard_published_refused(convex_runs_store, sanity, docs):
    _seed(convex_runs_store)
    sanity.docs = docs
    r = await _post(_app(), f"/runs/{RUN}/discard")
    assert r.status_code == 409
    assert r.json()["detail"]["reason"] == "published"
    assert sanity.deletes == []
    assert "runs:updateStatus" not in _paths(convex_runs_store)


async def test_discard_refused_when_convex_issue_published(convex_runs_store, sanity, monkeypatch):
    import eisenbalm_pipeline.lib.convex_client as cc
    _seed(convex_runs_store)
    prev = cc.convex_query

    async def q(http, path, args):
        if path == "issues:byIssueNumber":
            return {"publishedAt": 1700000000000}
        return await prev(http, path, args)

    monkeypatch.setattr(cc, "convex_query", q)
    r = await _post(_app(), f"/runs/{RUN}/discard")
    assert r.status_code == 409
    assert sanity.deletes == []


async def test_discard_complete_run_refused(convex_runs_store, sanity):
    _seed(convex_runs_store, status="complete")
    r = await _post(_app(), f"/runs/{RUN}/discard")
    assert r.status_code == 409
    assert sanity.deletes == []


async def test_discard_running_with_live_task_defers(convex_runs_store, sanity):
    _seed(convex_runs_store, status="running", completedAt=None)
    app = _app()
    ev = asyncio.Event()
    task = asyncio.create_task(ev.wait(), name=f"run:{RUN}")
    app.state.background_tasks = {task}
    try:
        r = await _post(app, f"/runs/{RUN}/discard")
        assert r.json() == {"runId": RUN, "discardRequested": True}
        assert "runs:requestCancel" in _paths(convex_runs_store)
        assert sanity.deletes == []
        assert app.state.pending_discards[RUN] == 48
    finally:
        ev.set()
        await task


class _Graph:
    def __init__(self, order, exc=None):
        self.order, self.exc = order, exc

    async def ainvoke(self, *a, **k):
        self.order.append("write")
        if self.exc:
            raise self.exc
        return {}


async def test_finish_pending_discard_after_late_write(convex_runs_store, sanity):
    _seed(convex_runs_store, status="running")
    app = _app()
    app.state.graph = _Graph(sanity.order)
    discard.pending(app)[RUN] = 48
    await runs_mod._execute_run(app, RUN, {}, {})
    assert sanity.order == ["write", "delete"]
    last = [a for p, a in convex_runs_store.all_calls() if p == "runs:updateStatus"][-1]
    assert last["status"] == "cancelled"
    assert RUN not in app.state.pending_discards


async def test_finish_pending_discard_on_runcancelled(convex_runs_store, sanity):
    _seed(convex_runs_store, status="running")
    app = _app()
    app.state.graph = _Graph(sanity.order, RunCancelled(RUN))
    discard.pending(app)[RUN] = 48
    await runs_mod._execute_run(app, RUN, {}, {})
    assert sanity.deletes == [(48, RUN)]
    last = [a for p, a in convex_runs_store.all_calls() if p == "runs:updateStatus"][-1]
    assert last["status"] == "cancelled"


async def test_running_orphan_goes_immediate(convex_runs_store, sanity):
    _seed(convex_runs_store, status="running", completedAt=None)
    r = await _post(_app(), f"/runs/{RUN}/discard")
    assert r.json()["discarded"] is True
    assert sanity.deletes == [(48, RUN)]


async def test_already_discarded_idempotent(convex_runs_store, sanity):
    _seed(convex_runs_store, status="cancelled")
    r = await _post(_app(), f"/runs/{RUN}/discard")
    assert r.status_code == 200 and r.json()["discarded"] is True
    assert sanity.deletes == [(48, RUN)]


async def test_already_discarded_ignores_other_runs_published_doc(convex_runs_store, sanity):
    _seed(convex_runs_store, status="cancelled")
    sanity.docs = [{"_id": "issue-48", "status": "published", "runId": "other"}]
    r = await _post(_app(), f"/runs/{RUN}/discard")
    assert r.status_code == 200
    assert sanity.deletes == [(48, RUN)]


async def test_rerun_refuses_cancelled_run(convex_runs_store, sanity, monkeypatch):
    _seed(convex_runs_store, status="cancelled")
    called = []

    async def w(*a, **k):
        called.append(1)

    monkeypatch.setattr(sc, "write_issue_draft", w)
    r = await _post(_app(), f"/runs/{RUN}/agents/origin_story/rerun")
    assert r.status_code == 409
    assert called == []


async def test_delete_mutation_shape(monkeypatch):
    monkeypatch.setenv("SANITY_API_TOKEN", "t")
    seen = []

    def handler(req: httpx.Request):
        import json
        seen.append(json.loads(req.content))
        return httpx.Response(200, json={})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://s") as http:
        await sc.delete_run_issue_docs(http, 48, RUN)
    (m,) = seen[0]["mutations"]
    d = m["delete"]
    assert "_id in [$id, $draftId]" in d["query"]
    assert "pipelineMetadata.runId == $runId" in d["query"]
    assert 'status != "published"' in d["query"]
    assert "!defined(publishedAt)" in d["query"]
    assert d["params"] == {"id": "issue-48", "draftId": "drafts.issue-48", "runId": RUN}


def test_issue_docs_published_helper():
    assert sc.issue_docs_published([{"status": "published"}])
    assert sc.issue_docs_published([{"publishedAt": "x"}])
    assert not sc.issue_docs_published([])
    assert not sc.issue_docs_published([{"status": "draft"}])
