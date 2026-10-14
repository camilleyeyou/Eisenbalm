---
phase: quick-261014-kf8
plan: 01
tags: [pipeline, openrouter, rate-limit]
key-files:
  modified: [packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py]
  created: [packages/pipeline/tests/lib/test_openrouter_rate_limit.py]
completed: 2026-10-14
---

# Quick 261014-kf8: Grammar rate-limit fallback and 429 backoff

`acomplete` structured path now falls back to `method="function_calling"` on Anthropic "Grammar compilation rate limit" errors, and sleeps a jittered backoff (max 10s) on other rate limits. At most 2 rate-limit retries, then the error propagates. Non-rate-limit errors keep their single immediate retry.

## Commits
- ee9ab561: fix(pipeline): fall back to function_calling on Anthropic grammar rate limit, back off on 429

## Tests
New file `test_openrouter_rate_limit.py` has 6 tests. Full pipeline suite: 802 passed, 38 skipped, 0 failed. Pushed to origin/master.

## Deviations
None.
