---
phase: 49-roles-permissions
plan: 01
subsystem: api
tags: [convex, contract-first, rbac, schema, typescript]

# Dependency graph
requires:
  - phase: 39-registry-coverage-memory-strip
    provides: charity_corrections table shape — the append-only, workspace+key-scoped Convex table pattern the new comments table mirrors
  - phase: 21-auth-app-shell-convex-schema
    provides: users table (role field, JIT-upsert scaffold) whose value vocabulary this plan re-maps
provides:
  - "docs/API_CONTRACTS.md §49 — users.role vocabulary change, comments table shape, comments.ts add/listByIssueNumber signatures, six-action editor gate inventory + rejection shapes, verbatim §6 locked labels"
  - "convex/schema.ts — comments table (workspace_id, issueNumber, stage?, anchorRef?, text, authorId, createdAt) with by_workspace_issueNumber + by_workspace indices, live-synced to dev:modest-magpie-797"
  - "convex/schema.ts — users.role comment re-vocabularied to Editor-in-chief|Collaborator (field name/type unchanged)"
affects: [49-02, 49-03, 49-04, 49-05, 49-06, 49-07, 49-08, 49-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Contract-first schema shape declaration (§39/§48 precedent) — the §49 contract section is written and committed before any enforcement or comments.ts function code exists"
    - "comments table modeled directly on charity_corrections (§39.1): workspace+key-scoped, append-only, two indices (compound + workspace-only)"

key-files:
  created: []
  modified:
    - docs/API_CONTRACTS.md
    - convex/schema.ts

key-decisions:
  - "users.role FIELD NAME stays unchanged — only the string values are re-vocabularied (\"admin\"|\"operator\" -> \"Editor-in-chief\"|\"Collaborator\"); users.role remains an optional future mirror, NOT the live read path (Clerk JWT 'role' claim is the source of truth, per D-03/D-02)"
  - "comments table is net-new, append-only for this phase (add only, no update/patch/remove/delete) — modeled verbatim on §39.1 charity_corrections rather than inventing a new shape"
  - "This plan is contract + schema shapes ONLY — no comments.ts functions, no _require_editor/requireEditor enforcement, no LockedControl UI. Those are Plans 49-02 through 49-09 per the phase's 9-plan structure"

patterns-established:
  - "Pattern: any new Convex table gets a matching API_CONTRACTS.md §NN section written/committed before the schema.ts table itself (contract-first, CLAUDE.md hard rule) — this is the fourth phase in a row (39, 46, 47, 48, now 49) to follow this exact sequencing"

requirements-completed: [ROL-01, ROL-02, ROL-04]

# Metrics
duration: 10min
completed: 2026-07-16
---

# Phase 49 Plan 01: Contract-First Role & Comments Shapes Summary

**Wrote the API_CONTRACTS.md §49 contract (role vocab change + comments table + six-action gate inventory + verbatim locked labels) and landed the two additive schema.ts shapes it declares, synced to the dev Convex deployment.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-07-16T17:33:32Z
- **Completed:** 2026-07-16T17:40:46Z
- **Tasks:** 3 completed (3/3)
- **Files modified:** 2 (docs/API_CONTRACTS.md, convex/schema.ts)

## Accomplishments
- `docs/API_CONTRACTS.md` §49 section written (§49.1–§49.5 + additive-only summary), covering the `users.role` vocabulary change, the new `comments` table, the `comments.ts` function signatures, the six-action editor-gate inventory with rejection shapes, and the verbatim DERIVED-STATE-CONTRACT §6 locked labels — all BEFORE any enforcement code exists.
- `convex/schema.ts` updated: `users.role` comment re-vocabularied (field name/type unchanged); new `comments` table added with both indices (`by_workspace_issueNumber`, `by_workspace`).
- Dev Convex deployment (`dev:modest-magpie-797`) synced via `pnpm --filter @eisenbalm/convex dev:once` — confirmed live: `✔ Added table indexes: comments.by_workspace, comments.by_workspace_issueNumber`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Write docs/API_CONTRACTS.md §49 (contract-first)** - `97eff27` (docs)
2. **Task 2: Implement the two declared schema shapes in convex/schema.ts** - `a72cdf8` (feat)
3. **Task 3: Sync the schema change to the dev Convex deployment** - no new commit (deployment-only action; `convex/schema.ts` was already committed in Task 2 — `pnpm --filter @eisenbalm/convex dev:once` produced zero local file diff, only a remote schema push)

**Plan metadata:** (this commit, docs: complete plan)

## Files Created/Modified
- `docs/API_CONTRACTS.md` - New `## §49 — Roles & Permissions (Phase 49)` section (98 lines) with 5 subsections + additive-only summary
- `convex/schema.ts` - `users.role` comment re-vocabularied; new `comments: defineTable(...)` with two indices

## Decisions Made
- Field name `role` on `users` is untouched — only the documented string-value vocabulary changes, per D-02. The live read path is the Clerk JWT `role` claim (§49.1), not `users.role` — `upsertCurrentUser` remains unwired into live app code.
- `comments` table is modeled verbatim on `charity_corrections` (§39.1): `workspace_id` + primary key (`issueNumber` here vs `charityKey` there), append-only, two indices (compound + workspace-only).
- No `comments.ts` functions, no `_require_editor`/`requireEditor` dependencies, and no `<LockedControl>` UI were built in this plan — strictly contract + schema shapes, per the plan's explicit scope boundary. Those land in later plans in this 9-plan phase.
- Followed this repo's own established convention (confirmed against Phase 47's `47-01` wave-0 plan, which similarly marked all six of that phase's requirement IDs complete at its first, contract-only plan) by marking ROL-01/02/04 complete in `REQUIREMENTS.md` at this contract-first plan rather than deferring to the phase's final plan.

## Deviations from Plan

None — plan executed exactly as written. One documentation-precision note (not a deviation, no fix needed): the plan's Task 1 acceptance criterion `grep -n "## §49" docs/API_CONTRACTS.md` returns exactly one match` is imprecise as a literal unanchored grep — every `### §49.N` subsection heading also matches the unanchored substring `## §49` (verified this is equally true of the pre-existing `## §48`/`### §48.N` precedent, so it is not specific to this plan's authoring). The intended check — the top-level `## §49` heading appears exactly once — passes cleanly with `grep -c "^## §49"` → `1`. No content change was needed; documenting this for the verifier's awareness only.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. (Convex dev deployment credentials were already present in `convex/.env.local`; the sync ran non-interactively.)

## Next Phase Readiness

- The §49 contract and the two schema shapes it declares (`users.role` vocabulary, `comments` table) are live in the dev Convex deployment — Plan 49-05 (per the phase's research doc) can now build `convex/comments.ts` (`add`/`listByIssueNumber`) directly against the synced table.
- FastAPI's `_require_editor` and Convex's `requireEditor(ctx)` (§49.4) are declared in the contract but not yet implemented — no route or mutation in this repo currently imports either name. Downstream plans (49-02..49-04 per the phase's structure) implement the six-action gate swaps against this contract.
- The `<LockedControl>` UI wrapper and the verbatim locked labels (§49.5) are declared but not yet built — no component exists yet.
- No blockers identified for continuing the phase.

---
*Phase: 49-roles-permissions*
*Completed: 2026-07-16*

## Self-Check: PASSED

- FOUND: docs/API_CONTRACTS.md
- FOUND: convex/schema.ts
- FOUND: .planning/phases/49-roles-permissions/49-01-SUMMARY.md
- FOUND commit: 97eff27 (docs(49-01): write API_CONTRACTS.md §49 roles & permissions contract)
- FOUND commit: a72cdf8 (feat(49-01): add comments table + re-vocabulary users.role comment)
- Dev Convex deployment sync confirmed live (comments.by_workspace, comments.by_workspace_issueNumber indexes added)
- dispatch-control-no-sanity-write.test.ts: 2 passed
