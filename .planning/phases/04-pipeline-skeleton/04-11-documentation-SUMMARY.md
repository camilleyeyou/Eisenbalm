---
phase: 04-pipeline-skeleton
plan: 11
subsystem: infra
tags: [documentation, readme, onboarding, railway, supabase, env-vars]

# Dependency graph
requires:
  - phase: 04-pipeline-skeleton
    provides: "Plan 01 packages/pipeline scaffold (.env.example, railway.toml, Dockerfile, pyproject.toml, package.json scripts) + placeholder README"
  - phase: 04-pipeline-skeleton
    provides: "Plans 02-10 — FastAPI app, routers, graph, 14 stub agents, cli.py setup-checkpointer, integration tests — the behaviors the README documents"
provides:
  - "packages/pipeline/README.md rewritten as the canonical onboarding doc (CONTEXT D-40) — prerequisites, env var table, session-pooler warning, local dev, one-time setup-checkpointer, stub-mode toggle, tests, manual Railway+Supabase deploy steps, Andrew's verbatim D-42 smoke test, file layout, troubleshooting table, cross-references"
  - "apps/web/README.md Convex section amended (additive) noting CONVEX_DEPLOY_KEY is shared with the Railway pipeline (CONTEXT D-41)"
  - "Root .env.example Phase 4 block verified complete per CONTEXT D-32"
affects: [04-pipeline-skeleton Plan 12 (Andrew's smoke test follows this README verbatim), 05-agent-quality, 06-publisher-pdf]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "README-per-workspace canonical onboarding doc (mirrors apps/studio + convex)"
    - "Manual-provisioning checkpoint documented in-README (Railway + Supabase), executor never auto-provisions"

key-files:
  created:
    - ".planning/phases/04-pipeline-skeleton/04-11-documentation-SUMMARY.md"
  modified:
    - "packages/pipeline/README.md"
    - "apps/web/README.md"

key-decisions:
  - "Root .env.example required no edit — Plan 01's Phase 4 block already lists all 6 pipeline-only vars + 4 shared vars per CONTEXT D-32; verified, left intact"
  - "apps/web/README.md cross-reference placed as a new ### subsection ('Shared with the pipeline (Phase 4)') after 'What happens in Phase 9', before 'SEO and structured data' — additive only, 4 insertions / 0 deletions"

patterns-established:
  - "Pattern: README is the operational contract — Plan 12's smoke test executor reads CONTEXT D-42 steps directly from packages/pipeline/README.md"

requirements-completed: []

# Metrics
duration: 3min
completed: 2026-05-14
---

# Phase 4 Plan 11: Documentation Summary

**packages/pipeline/README.md rewritten from the Plan 01 placeholder into the canonical onboarding doc — env var table with the load-bearing Supabase session-pooler warning, one-time setup-checkpointer step, manual Railway+Supabase deploy steps, and Andrew's verbatim CONTEXT D-42 smoke test.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-14T16:55:53Z
- **Completed:** 2026-05-14T16:58:39Z
- **Tasks:** 2
- **Files modified:** 2 (+ 1 SUMMARY created)

## Accomplishments

- **packages/pipeline/README.md** is now the canonical onboarding doc. All CONTEXT D-40 sections present: What this is, Prerequisites, Environment variables (table), Sharp edge (Supabase pooler), Local development, One-time setup (`setup-checkpointer`), Stub mode vs real mode, Running tests, Deployment (manual — Railway + Supabase), Andrew's end-of-phase smoke test, File layout, Where to look when something breaks, Cross-references.
- **Supabase session-pooler warning is prominent** — documents the CORRECT session-pooler URL (port 5432) and warns against both the transaction pooler (port 6543, breaks `AsyncPostgresSaver` with `InvalidSqlStatementName`) and the IPv6-only direct connection (won't work from Railway). Both `5432` and `6543` appear in the README; `6543` only as a WRONG example. Sourced from RESEARCH §7 + Pitfalls 1 & 2.
- **CONTEXT D-42 smoke test is verbatim** — the 8-step curl-based recipe (setup-checkpointer → trigger run → poll status → verify Sanity → verify Convex → integration test → optional interrupt/resume) is copied precisely into the README. This is the script Plan 12's executor follows.
- **apps/web/README.md** Convex section amended with a "Shared with the pipeline (Phase 4)" subsection noting `CONVEX_DEPLOY_KEY` is the same value in Vercel (web) and Railway (pipeline) — both write the same Convex deployment (CONTEXT D-41). Additive only — `git diff --numstat` confirms 4 insertions, 0 deletions.
- **Root .env.example** Phase 4 block verified complete per CONTEXT D-32 — all 6 pipeline-only vars (`SUPABASE_POSTGRES_URL`, `SANITY_API_TOKEN`, `OPENROUTER_API_KEY`, `TAVILY_API_KEY`, `EISENBALM_STUB_MODE`, `PIPELINE_TRIGGER_SECRET`) plus the 4 shared vars present. No edit needed.

## Task Commits

Each task was committed atomically:

1. **Task 1: Rewrite packages/pipeline/README.md (canonical onboarding doc — CONTEXT D-40)** - `e7ee166` (docs)
2. **Task 2: Update apps/web/README.md Convex section + verify root .env.example Phase 4 block** - `0f0d11d` (docs)

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified

- `packages/pipeline/README.md` - Rewritten wholesale (296 insertions, 20 deletions): canonical onboarding doc with all CONTEXT D-40 sections, session-pooler sharp-edge warning, verbatim D-42 smoke test, troubleshooting table.
- `apps/web/README.md` - Additive (4 insertions, 0 deletions): new "Shared with the pipeline (Phase 4)" subsection in the Convex section noting shared `CONVEX_DEPLOY_KEY`.
- `.env.example` - Verified, unchanged. Plan 01's Phase 4 block is already complete and accurate per CONTEXT D-32.

## Decisions Made

- **Root .env.example left intact.** The plan instructed to verify (not blindly rewrite) the Phase 4 block. Plan 01 already wrote a complete, accurate block listing all 6 pipeline-only vars + 4 shared vars with correct cross-reference to `packages/pipeline/.env.example`. Nothing was off — no edit made.
- **apps/web/README.md cross-reference placed as its own `###` subsection** rather than appended inside an existing subsection — keeps the additive change cleanly scoped and self-documenting, and `git diff --stat` confirms zero deletions (Phase 1-3 content untouched).
- **README aligned to actual repo state vs. plan template:** the plan's template referenced `pnpm --filter pipeline dev` and `pnpm --filter pipeline setup-checkpointer` — both verified to be real scripts in `packages/pipeline/package.json`, so the README documents both the `pnpm` form and the raw `uv run` form.

## Deviations from Plan

None - plan executed exactly as written. (Root `.env.example` verification step confirmed the file was already complete, requiring no edit — this is the expected outcome the plan anticipated, not a deviation.)

## Issues Encountered

None.

## User Setup Required

None - this plan is documentation-only. The README itself documents the manual Railway + Supabase provisioning that Andrew performs (CONTEXT D-29/D-30), but that work belongs to Plan 12, not this plan.

## Next Phase Readiness

- **Plan 12 (Andrew's end-of-phase smoke test) is unblocked.** `packages/pipeline/README.md` now contains the verbatim CONTEXT D-42 smoke test sequence — Plan 12's executor reads these steps directly from the README and asks Andrew to run them against the live Railway deployment. The README is the script.
- All three documentation files are in their final Phase 4 state. No code, schema, or test changes were made.
- Phase 5 forward links are documented in-README (the `@agent_node` decorator is the stable contract; `EISENBALM_STUB_MODE` is the single toggle; `lib/openrouter_client.py` is the swap point).

## Self-Check: PASSED

- `packages/pipeline/README.md` — FOUND
- `apps/web/README.md` — FOUND
- `.planning/phases/04-pipeline-skeleton/04-11-documentation-SUMMARY.md` — FOUND
- Commit `e7ee166` (Task 1) — FOUND
- Commit `0f0d11d` (Task 2) — FOUND

---
*Phase: 04-pipeline-skeleton*
*Completed: 2026-05-14*
