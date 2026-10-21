---
phase: quick-261021-5pr
plan: 01
subsystem: pipeline
tags: [fastapi, publisher, healthz, rate-limit, uploads]
key-files:
  created:
    - packages/pipeline/src/eisenbalm_pipeline/lib/background.py
    - packages/pipeline/src/eisenbalm_pipeline/lib/rate_limit.py
  modified:
    - agents/publisher/__init__.py, api/{webhooks,runs,control,health,main,content,agents,eval,brief,revision,voice_pass,factcheck}.py
    - lib/{idempotency,convex_client,sanity_client}.py
metrics:
  completed: 2026-10-21
---

# Quick 261021-5pr: Pipeline runtime hardening and request limits

Off-loop WeasyPrint render, logged and self-cleaning publisher background tasks, a deploy-aware /healthz, bounded asset uploads, and per-user rate limits on LLM routes. No new dependencies.

## Commits
- 844a92ef Task 1: off-loop PDF render, spawn_background, claim release
- c688b930 Task 2: /healthz 503 when deployed and degraded, bounded upload
- ae55d2f8 Task 3: rate limiting

## Task 1
- `render_problem_statement_pdf` now runs via `asyncio.to_thread`.
- `lib/background.spawn_background` replaces the create_task/add/discard blocks in webhooks, runs (x3) and control. It logs exceptions with the task name.
- The webhook schedules `_publish_with_claim_cleanup`. On failure it releases the `("publisher-run", issue_id)` claim, sets the Convex run to `failed` via the existing `pipelineRuns:updateStatus`, and re-raises. Claim release happens only if a claim was actually taken.

### Loop-safety conclusion (260720-gic)
Releasing the claim does not re-open the self-trigger loop, with one caveat that I closed.
- The only echo source is the problemPdf patch (publisher step 3).
- Failures in steps 1-2 (GROQ fetch, render) and in the asset upload mutate nothing, so no echo follows.
- Every step after the patch is non-fatal: the Vercel deploy is wrapped, and all Convex writes use `*_safe`. I found no post-upload step that can raise.
- Caveat: the patch call itself can raise after Sanity committed it (5xx or timeout). The echo would then meet a released claim and re-run the publisher. `upload_pdf_to_issue` therefore tags exceptions from the patch stage with `problem_pdf_patch_attempted`, and the wrapper KEEPS the claim in that case. The run is still marked failed, and the operator can use manual publish. This is a small addition beyond the plan.

## Task 2
- **/healthz:** returns 503 with the same JSON body only when `RAILWAY_ENVIRONMENT_NAME` is set and the checkpointer is missing. Local dev stays 200. Railway probes only during a deploy, so a dead DB at boot fails the deploy and the previous healthy deployment stays live. A DB that dies after the deploy is not detected. The lifespan still soft-boots, and a degraded boot now clears the convex and sanity client singletons.
- **Upload caps:**
  - podcast-audio: 100 MB
  - suno-audio: 25 MB
  - storyboard-*: 10 MB
  - Over the cap returns 413. A declared Content-Length is checked first, then the body is streamed with a running count.
  - Content-type whitelist (415): `audio/*` for audio slots. Storyboards accept png, jpeg, webp and gif only; svg is rejected. Content-type parameters are stripped.
  - Filenames are reduced to a safe basename of at most 120 characters with the extension kept, falling back to `upload.bin`.
  - All checks run before any Convex or Sanity call.

## Task 3
- In-process sliding window, keyed by Clerk `sub` (anonymous fallback), stdlib only. Denied attempts are not recorded.
- Bucket "llm": 10/min and 60/hr, shared per sub across agents test-run, agents score, brief strengthen preview, revise preview, voice-rewrite, and factcheck evidence preview.
- Bucket "shadow-run": 2/min and 10/hr.
- A denied request gets 429 with an integer `Retry-After` header and detail `{reason, bucket, retryAfter}`.
- **Single-instance assumption:** state is per-process memory. That is only correct because Railway runs one pipeline instance, and a restart resets the windows. Move to Redis or Postgres if the service scales out. The dev sentinel sub shares one bucket.
- An autouse conftest fixture resets the limiter between tests.

## Deviations
- [Rule 2] Added the `problem_pdf_patch_attempted` tag and claim-keep behaviour described above. It touches `lib/sanity_client.py`, which the plan listed only for the set_client change.
- The `/webhook/sanity-publish` sign-off gate blocks `run_id=None`, so the "run_id None" wrapper test calls the wrapper directly rather than going through the webhook.
- Rate limits are applied via `llm_rate_limit()` / `shadow_rate_limit()` wrappers around `rate_limit()`, so the numbers live in one place.
- `import asyncio` is kept in `api/runs.py` with a noqa, because `test_runs_config_snapshot` patches `runs.asyncio.create_task`. It was removed from `control.py`.

## Verification
Full suite: `926 passed, 38 skipped, 11 warnings in 15.08s` (baseline 883 passed, 38 skipped). The warnings are pre-existing pydantic serializer warnings. `pyproject.toml` and `uv.lock` are untouched.

## Self-Check: PASSED
