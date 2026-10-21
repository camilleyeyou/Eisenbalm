"""spawn_background: strong-ref, exception logging, cancel silence."""
from __future__ import annotations

import asyncio
import logging
from types import SimpleNamespace

from eisenbalm_pipeline.lib.background import spawn_background


def _app(with_set: bool = True):
    state = SimpleNamespace()
    if with_set:
        state.background_tasks = set()
    return SimpleNamespace(state=state)


async def test_task_tracked_then_discarded() -> None:
    app = _app()
    gate = asyncio.Event()

    async def work():
        await gate.wait()

    task = spawn_background(app, work(), name="t1")
    assert task in app.state.background_tasks
    gate.set()
    await task
    await asyncio.sleep(0)
    assert task not in app.state.background_tasks


async def test_exception_is_logged_with_name(caplog) -> None:
    app = _app()

    async def boom():
        raise ValueError("kaboom")

    with caplog.at_level(logging.ERROR):
        task = spawn_background(app, boom(), name="publisher:issue-1")
        await asyncio.gather(task, return_exceptions=True)
        await asyncio.sleep(0)
    recs = [r for r in caplog.records if "publisher:issue-1" in r.getMessage()]
    assert recs and recs[0].exc_info and isinstance(recs[0].exc_info[1], ValueError)


async def test_cancelled_task_is_silent(caplog) -> None:
    app = _app()

    async def forever():
        await asyncio.sleep(60)

    with caplog.at_level(logging.ERROR):
        task = spawn_background(app, forever(), name="t3")
        await asyncio.sleep(0)
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        await asyncio.sleep(0)
    assert not [r for r in caplog.records if r.levelno >= logging.ERROR]
    assert task not in app.state.background_tasks


async def test_missing_background_tasks_attr_still_schedules() -> None:
    app = _app(with_set=False)
    ran = []

    async def work():
        ran.append(1)

    await spawn_background(app, work(), name="t4")
    assert ran == [1]
