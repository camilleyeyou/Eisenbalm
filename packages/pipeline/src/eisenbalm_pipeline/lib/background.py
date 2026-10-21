"""Fire-and-forget background task helper.

asyncio only keeps a WEAK reference to tasks created via create_task, so a
task nobody holds can be garbage-collected mid-flight. ``spawn_background``
strong-refs the task in ``app.state.background_tasks`` until it finishes.

It also retrieves the task's exception in the done-callback. Without that,
a failing background coroutine surfaces only as asyncio's late, context-free
"Task exception was never retrieved" (or not at all); here it is logged
immediately with the task name and traceback.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Coroutine

log = logging.getLogger(__name__)


def spawn_background(app: Any, coro: Coroutine, *, name: str) -> asyncio.Task:
    """Schedule ``coro`` as a strong-ref'd, exception-logging background task.

    Tolerates an ``app.state`` without ``background_tasks`` (bare-app tests).
    """
    task = asyncio.create_task(coro, name=name)
    tasks = getattr(app.state, "background_tasks", None)
    if tasks is not None:
        tasks.add(task)

    def _done(t: asyncio.Task) -> None:
        if tasks is not None:
            tasks.discard(t)
        if t.cancelled():
            return
        exc = t.exception()  # also marks the exception as retrieved
        if exc is not None:
            log.error("Background task %s failed", t.get_name(), exc_info=exc)

    task.add_done_callback(_done)
    return task
