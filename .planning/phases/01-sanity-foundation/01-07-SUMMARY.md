---
phase: "01"
plan: "07"
subsystem: cms-seed
tags: [sanity, studio, readme, smoke-test, onboarding, typegen, agent-profiles]

dependency_graph:
  requires:
    - phase: "01-03"
      provides: "sanity.config.ts, schema wiring, apps/studio package"
    - phase: "01-05"
      provides: "TypeGen pipeline, sanity.types.ts committed"
    - phase: "01-06"
      provides: "14 agentProfile docs seeded, seed-agents.ts script"
  provides:
    - "apps/studio/README.md — canonical Phase 1 onboarding runbook for Andrew"
    - "End-to-end smoke test passed: FND-01, FND-02, FND-03, FND-04 all verified by Andrew"
    - "Phase 1 complete — Phase 2 can begin"
  affects:
    - "Phase 2 (apps/web) — consumes SANITY_STUDIO_PROJECT_ID via NEXT_PUBLIC_SANITY_PROJECT_ID"
    - "Phase 4 (packages/pipeline) — same project ID / dataset for Sanity writes"
    - "Phase 9 deliberation layer — agentProfile docs in production dataset are live"

tech-stack:
  added: []
  patterns:
    - "Human-gate: Andrew verifies each success criterion manually before plan closes"
    - "Onboarding README as executable runbook (every command listed, every expected output stated)"

key-files:
  created:
    - apps/studio/README.md
    - .planning/phases/01-sanity-foundation/01-07-SUMMARY.md
  modified:
    - apps/studio/package.json (Plan 06 follow-up fix: tsx --env-file flag)

key-decisions:
  - "D-22: No CI for Phase 1. Andrew's manual smoke test IS the acceptance gate."
  - "Cloud deploy URL deferred to Andrew's discretion — local Studio smoke test passed all four FND criteria; deploy step was not confirmed in session"

patterns-established:
  - "Smoke-test gate: human-verify checkpoint at end of each phase to confirm success criteria before closing"
  - "README-as-runbook: every command, every expected output, every env var documented in sequence"

requirements-completed:
  - FND-01
  - FND-02
  - FND-03
  - FND-04

metrics:
  duration_minutes: 10
  completed: "2026-05-11"
  tasks_completed: 2
  files_created: 1
  files_modified: 1
---

# Phase 01 Plan 07: README + Smoke Test Summary

**apps/studio/README.md authored as Andrew's Phase 1 runbook; end-to-end smoke test confirmed all four success criteria (FND-01..FND-04) against the live Sanity production dataset**

## Performance

- **Duration:** ~10 min (Task 1 automated + Task 2 human-verify gate)
- **Started:** 2026-05-12T01:11:57Z
- **Completed:** 2026-05-11
- **Tasks:** 2 (1 auto + 1 checkpoint:human-verify)
- **Files modified:** 2

## Accomplishments

- `apps/studio/README.md` written as a fully executable 7-step runbook: init → env → install → typegen → seed → dev → deploy
- All 14 canonical agentId values listed in canonical order with their deterministic `_id` pattern documented
- Andrew ran the full sequence locally and confirmed all four FND success criteria
- Plan 06 follow-up fix applied: `apps/studio/package.json` seed script now passes `--env-file=.env.local` to `tsx` so `.env.local` loads correctly from the user shell (commit `75b4a08`)

## Task Commits

1. **Task 1: Write apps/studio/README.md** — `a6781cf` (docs)
2. **Plan 06 follow-up fix: tsx --env-file flag** — `75b4a08` (fix)
3. **Plan metadata (this SUMMARY + STATE + ROADMAP)** — pending final commit

## Files Created/Modified

- `apps/studio/README.md` — Andrew's canonical Phase 1 onboarding runbook; 7-step sequence from `npx sanity@latest init` through `pnpm deploy:studio`
- `apps/studio/package.json` — One-line fix: `tsx --env-file=.env.local` added to seed:agents script so `.env.local` loads in user shell context (Plan 06 follow-up, commit `75b4a08`)

## Smoke Test Results (Andrew Verified)

Andrew ran the following and confirmed each criterion:

| Criterion | Command | Result |
|-----------|---------|--------|
| FND-01 — Studio renders all schema types | `pnpm --filter studio dev` | Sidebar shows Weekly Issue / Charity / Agent Profile in sidebar |
| FND-02 — TypeGen generates types | Already confirmed in Plan 05 (pnpm typegen exit 0, sanity.types.ts committed) | Passed |
| FND-03 — 14 agentProfile docs seeded | `pnpm --filter studio seed:agents` | 14 docs visible in Agent Profile list |
| FND-04 — Andrew can save weeklyIssue draft | Created stub Charity, then Weekly Issue draft referencing it | Saved without schema validation error |

Studio cloud deploy (`pnpm deploy:studio`) was not confirmed in session — deferred to Andrew's discretion. The deployed URL is not captured here. Local Studio verification against the `production` dataset satisfies all four FND criteria.

## Decisions Made

- Cloud deploy URL left unspecified in SUMMARY — Andrew did not provide a deployed hostname. The plan acceptance criteria specify it should be recorded; however all four FND requirements are observably met via the local Studio run against the live production dataset. Andrew may deploy independently at any time; no Phase 2 work is blocked by the absence of a cloud URL.
- Plan 06 follow-up fix (`75b4a08`) recorded here rather than reopening Plan 06 — the fix is a one-line shell flag change, within scope of Plan 07's Task 2 unblocking.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan 06 follow-up: tsx --env-file=.env.local in seed script**
- **Found during:** Task 2 (Andrew running seed:agents from shell)
- **Issue:** `pnpm seed:agents` failed to load `.env.local` when Andrew ran it from the user shell; the earlier in-agent execution had different env loading behavior. The tsx invocation in `apps/studio/package.json` did not pass `--env-file`.
- **Fix:** Added `--env-file=.env.local` flag to the tsx call in `apps/studio/package.json` seed:agents script
- **Files modified:** `apps/studio/package.json`
- **Verification:** Andrew re-ran `pnpm --filter studio seed:agents` — 14/14 confirmed
- **Committed in:** `75b4a08` (fix(01-06): tsx --env-file loads .env.local for seed-agents script)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking issue)
**Impact on plan:** Fix was required to unblock Andrew's seed run. No scope change.

## Issues Encountered

- `pnpm seed:agents` env loading differed between agent-shell and user-shell execution. Resolved by making the tsx invocation self-contained via `--env-file=.env.local`.

## Phase 2 Readiness

Phase 2 (Web Shell + Theme Engine) can begin. What Phase 2 needs from Phase 1:

- **SANITY_STUDIO_PROJECT_ID** — Andrew's `.env.local` has it. Phase 2 must add `NEXT_PUBLIC_SANITY_PROJECT_ID` (same value) to `apps/web/.env.local` for GROQ queries.
- **SANITY_STUDIO_DATASET** — `production`. Mirror as `NEXT_PUBLIC_SANITY_DATASET` in `apps/web/.env.local`.
- **TypeScript types** — `apps/studio/sanity.types.ts` is committed. Import via `@eisenbalm/shared` (`packages/shared/src/sanity-types.ts` re-exports it).
- **14 agentProfile docs** — live in `production` dataset. Phase 9 deliberation layer will reference them by `_id` (`agent-{agentId}`).
- **No blockers from Phase 1** — all four FND requirements observed and closed.

---
*Phase: 01-sanity-foundation*
*Completed: 2026-05-11*
