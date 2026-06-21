---
phase: quick-260621-fi4
plan: "01"
subsystem: docs
tags: [reconciliation, docs, pipeline, prompts, cost-capture, auth]
dependency_graph:
  requires: []
  provides: [docs/CURRENT_STATE.md]
  affects: [mission-control-dashboard-planning]
tech_stack:
  added: []
  patterns: [read-only investigation, file:line citation discipline]
key_files:
  created:
    - docs/CURRENT_STATE.md
  modified: []
decisions:
  - "Prompts are file-externalized markdown in packages/pipeline/src/eisenbalm_pipeline/prompts/ — loader swap required for any DB migration, not string extraction"
  - "SUPABASE_POSTGRES_URL misnomer confirmed: points at Railway Postgres since 2026-06-12, env.example is stale"
  - "Weekly cron trigger: code exists (cli.py trigger-weekly), infrastructure not provisioned"
  - "Frontend auth: zero auth code in apps/web — must be built from zero if dashboard needs it"
metrics:
  duration: "~15 min"
  completed: "2026-06-21"
  tasks_completed: 2
  files_created: 1
  files_modified: 0
---

# Phase quick-260621-fi4 Plan 01: Phase 0 Reconciliation Summary

Read-only investigation producing `docs/CURRENT_STATE.md` — the ground-truth gate
for the Mission Control dashboard. Verified all five §0 questions against the real
codebase with file:line citations. Zero production code changes.

## What Was Done

**Task 1 (Investigation):** Read `lib/prompts.py`, `graph/builder.py`, `api/runs.py`,
`lib/cost.py`, `lib/openrouter_client.py`, `graph/checkpointer.py`, and
`agents/publisher/__init__.py`. Grepped agent files for `load_prompt` call sites.
Searched `apps/web` exhaustively for auth/middleware. Checked `.github/`,
`railway.toml`, `vercel.json`, `convex/crons.ts` for scheduler configuration.
Read project memory for the SUPABASE_POSTGRES_URL→Railway migration. Confirmed
commits da6e43d/99d68b8 in `openrouter_client.py` git log.

**Task 2 (Document):** Created `docs/CURRENT_STATE.md` (387 lines). All five
questions answered with concrete file:line citations. Seven divergences from the
dashboard brief's assumed architecture documented.

## Key Findings

**Q1 (Most important):** Agent prompts live as `.md` files in
`packages/pipeline/src/eisenbalm_pipeline/prompts/` (12 files), loaded at runtime
by `lib/prompts.py:49-70` via `importlib.resources`. Eight agent files confirmed to
call `load_prompt(name)` — no inline system prompts. Voice constraints live in
`lib/voice.py`; QA rubric in `agents/qa/rubric.md`. Dashboard's "move prompts to DB"
is a loader swap, not a string extraction.

**Q2:** LangGraph in `graph/builder.py:89-158` (14 nodes, 7-way fan-out). FastAPI
`POST /run/weekly` at `api/runs.py:177-241` guarded by `X-Pipeline-Trigger-Secret`.
Weekly automation: `cli.py trigger-weekly` (cron `0 14 * * 4`) is coded but the
Railway cron service is not provisioned — documented as a manual Andrew step in
`README.md:204-208`. No GitHub Actions, no Vercel crons, no Convex pipeline trigger.

**Q3:** Content lands in three places: Sanity (`write_issue_draft` at
`publisher/__init__.py:68`), Convex (`pipelineRuns:updateStatus` at `:70-77`),
and Postgres checkpointer (`graph/checkpointer.py:36`). `SUPABASE_POSTGRES_URL`
now points at Railway Postgres (Supabase project deleted 2026-06-12 per project
memory); env.example is stale.

**Q4:** Real OpenRouter tokens + USD captured per-call in `acomplete`
(`openrouter_client.py:112-128`, `_usage_from_message()`). Accumulated per-agent
in `lib/cost.py:83-109`. Persisted at pipeline end to both Convex
`pipelineRuns.cost`/`durationMs` and Sanity `pipelineMetadata.cost` (`publisher/
__init__.py:59-77`). Not fire-and-forget. Commits da6e43d/99d68b8 confirmed in
git log against those files.

**Q5:** No auth anywhere in `apps/web`. No `middleware.ts`. No NextAuth/Clerk/
auth0/next-auth. Three server routes only: Stripe checkout, Stripe webhook, email
unsubscribe. Site is fully public.

## Deviations from Plan

None — plan executed exactly as written. The investigation found one minor
discrepancy from the plan's `<facts>` section: `chronicler.md` is NOT present in
the prompts directory (the plan listed it; the actual directory has 12 files with
no chronicler.md). This was documented as a note in the CURRENT_STATE.md Q1 section
rather than repeated as a confirmed fact.

## Self-Check

- PASSED: `docs/CURRENT_STATE.md` exists (387 lines, above 120-line minimum)
- PASSED: Contains `## Divergences from the Mission Control brief`
- PASSED: Contains `lib/prompts.py` and `prompts/*.md` citations
- PASSED: Contains `path:line` citations throughout
- PASSED: Commit `0841e43` exists and is the only change
- PASSED: `git status --porcelain | grep -v '^??'` = empty (no tracked files modified)
