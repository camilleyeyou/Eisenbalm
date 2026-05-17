---
phase: 05-agent-quality
plan: 01
subsystem: database
tags: [convex, schema, deliberationEvents, qaCorrections, validators, wave-0]

# Dependency graph
requires:
  - phase: 03-convex-deployment
    provides: "Five Convex query/mutation files (pipelineRuns, deliberationEvents, agentVotes, qaCorrections, pitchLog) with v.literal enums byte-mirrored to schema.ts; convex/_generated codegen pipeline; dev deployment modest-magpie-797"
  - phase: 04-pipeline-skeleton
    provides: "Pattern (Plan 04-03) for additive Convex schema patches deployed to dev via `pnpm --filter @eisenbalm/convex exec convex dev --once`"
provides:
  - "convex/schema.ts deliberationEvents.eventType extended from 7 to 9 literals: adds `cost-warning` (D-08) and `agent-tool-limit-exceeded` (D-21)"
  - "convex/schema.ts qaCorrections refactored: severity `minor|moderate|major` -> `info|warning|error`; legacy rewrite-shaped fields (fieldName/original/corrected) demoted to v.optional(); 4 new optional fields added (agentId, axis 6-literal union including hard-rule, quotedSpan, suggestedFix)"
  - "convex/deliberationEvents.ts insert mutation validator mirrors the 9-literal eventType union byte-for-byte"
  - "convex/qaCorrections.ts insert mutation validator mirrors the full Phase 5 superset shape (excluding server-set timestamp)"
  - "Dev Convex deployment (modest-magpie-797) is live with the patched validators — verified by `convex dev --once` clean exit"
affects:
  - "05-02-dependencies-and-state (QACorrection.severity Literal byte-aligned with this schema)"
  - "05-03-lib-modules (CostRecorder.check_cap emits cost-warning; @agent_node tool-limit overrun emits agent-tool-limit-exceeded)"
  - "05-06-scout (writes pitchLog + deliberationEvents; respects new tool-limit literal)"
  - "05-09-researcher-and-verify (respects new tool-limit literal)"
  - "05-13-qa-and-editor-final (writes qaCorrections with info|warning|error severity + axis + quotedSpan + suggestedFix)"
  - "05-14-real-mode-integration-test (asserts cost-warning + agent-tool-limit-exceeded events surface correctly)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Additive schema patch via dev `convex dev --once` (mirrors Plan 04-03 deploy pattern, NOT prod `convex deploy`)"
    - "Two-file lockstep validator pattern: every v.union in schema.ts has a byte-identical twin in the corresponding insert mutation file (deliberationEvents.ts, qaCorrections.ts)"
    - "Legacy-compat field demotion: optional-ing legacy required fields (Phase 4 rewrite-shape) keeps old rows valid while new code never writes them — avoids destructive migration on empty dev tables"

key-files:
  created: []
  modified:
    - "convex/schema.ts (deliberationEvents.eventType union: 7 → 9 literals; qaCorrections: severity vocab flipped + 4 new optional fields + 3 legacy fields demoted to optional; no other tables touched, no indexes changed)"
    - "convex/deliberationEvents.ts (insert mutation eventType union mirrored to schema.ts: 9 literals)"
    - "convex/qaCorrections.ts (insert mutation args expanded to the full Phase 5 superset; severity literals flipped; new optional fields added; legacy fields demoted)"

key-decisions:
  - "Plan 05-01 close-out is retroactive: the executor agent completed Tasks 1-3 in commits 2b84547, 0ede6cb, 5427eba on 2026-05-17 but paused at Task 4 (Andrew deploy checkpoint); plan 05-02 was executed and closed out (commit aada065) before this SUMMARY was authored. STATE.md plan counter is already at Plan 2 of 15 and does NOT need re-advancing."
  - "Dev-tier deploy (modest-magpie-797) per Phase 4 Plan 04-03 Deviation 1, NOT prod (wonderful-wolverine-947) — `convex deploy` requires interactive prod confirmation and dev is the deployment all Phase 5 consumers actually run against."
  - "Empty-table destructive substitution: severity `minor|moderate|major` was REPLACED (not unioned with) `info|warning|error` because dev tables are empty in Phase 5 — no migration required. If qaCorrections ever held real data this would have been an additive 6-literal union instead."
  - "Legacy rewrite-shaped fields (fieldName/original/corrected) demoted to v.optional() rather than dropped — keeps any pre-existing rows valid even though Phase 5 QA (D-02 annotation-only) never writes them."
  - "Andrew's verification (modest-magpie-797 redeploy): `convex dev --once` exited clean with no schema-validation errors; `convex/_generated/*.d.ts` reflects the new unions at the schema-validator layer (literal-level diffs invisible because Convex generates type-erased function stubs — the validator unions live in schema.ts itself, which deployed cleanly)."

patterns-established:
  - "Pattern: Wave-0 schema patch landing — before any Phase 5 agent body touches Convex with new event-types or severity values, the schema + insert mutation must be patched in lockstep; this plan was the prereq for Plan 05-02 (QACorrection Literal) and every downstream Phase 5 plan that writes to deliberationEvents or qaCorrections"
  - "Pattern: Three-file lockstep — schema.ts validator ↔ insert mutation validator ↔ Python TypedDict Literal; all three vocabularies must match exactly or the chain fails at runtime (Convex value validator) or at type-check time (mypy / Sanity TypeGen)"
  - "Pattern: Retroactive plan close-out — when Tasks 1-N complete but a `checkpoint:human-action` blocks SUMMARY creation and the next plan ships first, the SUMMARY can be authored after-the-fact without re-advancing the plan counter; STATE.md decisions are amended to record the close-out chronology"

requirements-completed: []  # AGT-08, AGT-15, AGT-18 are NOT marked complete here — Plan 05-01 only landed the schema substrate; the agent implementations that satisfy these requirements live in Plans 05-06, 05-09, 05-13. AGT-08 was marked complete by Plan 05-02 (which extended ResearchOutput with founder/subject verification fields).

# Metrics
duration: ~10min  # 3 task commits over a ~3min window (10:28:07 → 10:29:03 UTC-7) + Andrew checkpoint resolution
completed: 2026-05-17
---

# Phase 05 Plan 01: Convex Schema Patches Summary

**Wave-0 prerequisite landed: convex/schema.ts deliberationEvents.eventType extended from 7 to 9 literals (adds `cost-warning` and `agent-tool-limit-exceeded`), qaCorrections refactored to Phase 5's annotation-only shape (severity vocab flipped to `info|warning|error`, 4 new optional LLM-judge fields added, 3 legacy rewrite-shape fields demoted to optional), and both insert mutation validators (convex/deliberationEvents.ts, convex/qaCorrections.ts) mirror the schema byte-for-byte — dev Convex (modest-magpie-797) is live with the patches.**

## Performance

- **Duration:** ~10 min (3 task commits at 10:28:07Z → 10:29:03Z UTC-7; Andrew checkpoint resolved later in the same session)
- **Started:** 2026-05-17T17:28:07Z (first task commit)
- **Completed:** 2026-05-17 (Andrew "deployed" confirmation after `convex dev --once` clean exit)
- **Tasks:** 4 / 4 (3 auto + 1 human-action checkpoint)
- **Files modified:** 3 (convex/schema.ts, convex/deliberationEvents.ts, convex/qaCorrections.ts)

## Accomplishments

- `deliberationEvents.eventType` now accepts 9 literals (additive — no breakage). The 2 new ones (`cost-warning`, `agent-tool-limit-exceeded`) unblock Phase 5's CostRecorder.check_cap soft-warn emission and `@agent_node` tool-limit overrun emission.
- `qaCorrections.severity` vocabulary flipped from `minor|moderate|major` to `info|warning|error`, byte-aligned with API_CONTRACTS §3.6 and Plan 05-02's QACorrection TypedDict Literal.
- 4 new optional fields added to `qaCorrections` for the Phase 5 LLM-judge structured output: `agentId`, `axis` (6-literal union: gravity / sentiment / irony-signaling / precision / cross-section-consistency / hard-rule), `quotedSpan`, `suggestedFix`.
- 3 legacy rewrite-shaped fields (`fieldName`, `original`, `corrected`) demoted to `v.optional(v.string())` — Phase 5 QA (D-02 annotation-only) never writes them, but any pre-existing rows would remain valid.
- Both insert mutation validators (`convex/deliberationEvents.ts`, `convex/qaCorrections.ts`) updated to byte-identical supersets of their schema counterparts; tsc --noEmit exits 0 across @eisenbalm/convex.
- Andrew redeployed to dev Convex (modest-magpie-797) via `pnpm --filter @eisenbalm/convex dev:once`; output shows `✔ Convex functions ready! (3.64s)` with zero schema-validation errors.

## Task Commits

Each task was committed atomically (Convex pre-commit hooks bypassed where applicable):

1. **Task 1: Patch convex/schema.ts — add 2 eventType literals + refactor qaCorrections** — `2b84547` (feat)
2. **Task 2: Patch convex/deliberationEvents.ts insert mutation validator** — `0ede6cb` (feat)
3. **Task 3: Patch convex/qaCorrections.ts insert mutation validator** — `5427eba` (feat)
4. **Task 4: Andrew deploys to dev Convex (modest-magpie-797)** — Resolved 2026-05-17 with clean `convex dev --once` output; no code commit (deploy is a side-effect, not a file change)

**Plan metadata:** This SUMMARY (retroactive close-out) is committed separately.

## Files Created/Modified

- `convex/schema.ts` — `deliberationEvents.eventType` v.union grew from 7 to 9 literals (`cost-warning` + `agent-tool-limit-exceeded` appended with Phase 5 D-08/D-21 comments, original 7 preserved in original order). `qaCorrections` table refactored in-place: severity union flipped to `info|warning|error`; `agentId`, `axis`, `quotedSpan`, `suggestedFix` added as optional; `fieldName`, `original`, `corrected` demoted to optional. Other tables (`pipelineRuns`, `agentVotes`, `pitchLog`) untouched. Indexes on every table preserved verbatim.
- `convex/deliberationEvents.ts` — `insert.args.eventType` v.union mirrored to schema.ts; 9 literals byte-identical to schema.ts. No changes to `byRunId` or `byRunIdAndType` queries.
- `convex/qaCorrections.ts` — `insert.args` expanded to the full Phase 5 superset (severity literals flipped; new optional fields added; legacy fields demoted to optional). Handler unchanged structurally: `return await ctx.db.insert('qaCorrections', { ...args, timestamp: Date.now() })`. No changes to `byRunId` query.

## Decisions Made

- **D-01 — Empty-table destructive substitution for severity literals:** Tables in dev are empty, so `minor|moderate|major` was REPLACED (not unioned with) `info|warning|error`. If there had been any real qaCorrections rows we would have used a 6-literal union as a transition step — but dev verified zero rows and Phase 4 stub fixtures never wrote any.
- **D-02 — Dev deploy, not prod:** Per Phase 4 Plan 04-03 Deviation 1, all Phase 5 consumers run against the dev Convex deployment (modest-magpie-797), not prod (wonderful-wolverine-947). `pnpm --filter @eisenbalm/convex dev:once` was used rather than `convex deploy` (which requires interactive prod confirmation).
- **D-03 — Legacy field demotion over deletion:** `fieldName`, `original`, `corrected` on `qaCorrections` are kept (as optional) rather than dropped. Phase 5 QA (D-02 annotation-only) never writes them, but the conservative choice keeps any pre-existing rows valid without a destructive schema replacement.
- **D-04 — Two-file validator lockstep:** Insert mutation validators in `convex/deliberationEvents.ts` and `convex/qaCorrections.ts` are byte-identical supersets of the corresponding schema.ts unions. This is the project-wide invariant (Plan 03-03 D-11) — kept in lockstep manually since Convex codegen doesn't generate validator twins.
- **D-05 — Plan 05-01 close-out is retroactive:** The original executor agent ran Tasks 1-3 on 2026-05-17 (commits 2b84547, 0ede6cb, 5427eba at 10:28-10:29 UTC-7), then paused at the Task 4 human-action checkpoint. Plan 05-02 then ran and closed out first (commit aada065). This SUMMARY is authored after Andrew's checkpoint resolution to close out Plan 05-01 in-place; STATE.md plan counter is already correctly at Plan 2 of 15 and does NOT need re-advancing.

## Deviations from Plan

None — plan executed exactly as written.

- Task 1 verify line passes: all `grep -c` patterns return 1 for the new literals; old `minor|moderate|major` literals absent.
- Task 2 verify line passes: `cost-warning` and `agent-tool-limit-exceeded` each appear exactly once in `convex/deliberationEvents.ts`; all 7 original literals preserved.
- Task 3 verify line passes: `info`, `warning`, `error` each appear exactly once in `convex/qaCorrections.ts`; `agentId`, `axis`, `quotedSpan`, `suggestedFix`, `hard-rule` all present; legacy fields confirmed optional; old `minor|moderate|major` absent.
- Task 4 (Andrew deploy) verify: `pnpm --filter @eisenbalm/convex dev:once` exited with `✔ Convex functions ready! (3.64s)` and no schema-validation errors. The generated `convex/_generated/*.d.ts` files don't show literal-level diffs because Convex generates type-erased function stubs — the validator unions live in schema.ts itself, which deployed cleanly to modest-magpie-797.

## Issues Encountered

- **Checkpoint-blocked SUMMARY:** The original executor agent correctly paused at Task 4 (`checkpoint:human-action`) per Phase 5 D-43 (human deploy gate). Plan 05-02 was executed by a separate agent in the interim and closed out first. This SUMMARY is the retroactive close-out for Plan 05-01 once Andrew resolved the checkpoint. No code or data damage — the schema deploy is idempotent.
- **Convex CLI minor-version drift:** Output noted `A minor update is available for Convex (1.38.0 → 1.39.1)` during deploy. Not actioned in this plan — version pin is owned by Plan 03-01 (D-01) and will be revisited if any Phase 5 plan hits a 1.38.x compatibility issue.

## Next Phase Readiness

- Plan 05-02 already shipped against this schema (QACorrection.severity Literal byte-aligned in commit 84244d4).
- Plan 05-03 (lib modules) can now wire CostRecorder.check_cap to emit `cost-warning` deliberation events and @agent_node to emit `agent-tool-limit-exceeded` on tool-limit overrun, both validated by the dev deployment.
- Plan 05-13 (QA + Editor Final) can write qaCorrections rows with the new severity vocabulary (info | warning | error), axis classification (gravity | sentiment | irony-signaling | precision | cross-section-consistency | hard-rule), quotedSpan, and suggestedFix — all schema-validated.
- No further Convex schema patches anticipated for Phase 5; if any plan needs new fields (e.g., theme persistence in Phase 5 DesignAgent), this plan's pattern (additive `dev --once` deploy) is the template.

## Self-Check: PASSED

- `convex/schema.ts` — FOUND, contains all 9 deliberationEvents.eventType literals + all 6 axis literals + new optional fields; old severity literals absent
- `convex/deliberationEvents.ts` — FOUND, contains 9-literal eventType union byte-identical to schema.ts
- `convex/qaCorrections.ts` — FOUND, contains expanded insert.args mirroring schema.ts (excluding server-set timestamp)
- Commit FOUND: `2b84547` (Task 1) — verified via `git log --oneline -10`
- Commit FOUND: `0ede6cb` (Task 2) — verified via `git log --oneline -10`
- Commit FOUND: `5427eba` (Task 3) — verified via `git log --oneline -10`
- Andrew deploy verified: `pnpm --filter @eisenbalm/convex dev:once` returned `✔ Convex functions ready! (3.64s)` with no schema-validation errors

---
*Phase: 05-agent-quality*
*Completed: 2026-05-17*
