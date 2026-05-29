---
phase: 16-choose-your-narrator
plan: 08
subsystem: meta
tags: [superseded, plan-split, no-op]

# Dependency graph
requires: []
provides: []
affects: [16-08a-seed-narrators, 16-08b-frontend-chip]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plan split for scope control: combined seed + frontend chip exceeded 4-task / 2-subsystem threshold per plan-checker iteration 1 warning W7"

key-files:
  created: []
  modified: []
---

## Outcome

This plan was **superseded** before execution. It was originally drafted as a combined "Studio seed + frontend narrator chip" plan but flagged by the plan-checker (revision iteration 1, warning W7) for exceeding the scope threshold (5 tasks, 2 subsystems).

The plan was split into two independently executable plans, each within scope:

- **16-08a-seed-narrators-PLAN.md** — Studio seed assets (`narrators.json`, `seed-narrators.ts`) with Andrew Studio UAT checkpoint
- **16-08b-frontend-chip-PLAN.md** — Web frontend (queries.ts extension, types.ts narrator type, IssueHero.tsx chip render)

## Tasks executed

None. This plan has `task_count: 0` and `files_modified: []`. Execution is a no-op.

## Verification

- Frontmatter `type: superseded` is present in the PLAN file
- Frontmatter `superseded_by:` lists both replacement plans
- Replacement plans 16-08a and 16-08b exist in the phase directory and have their own task lists

## Notes

This SUMMARY exists solely to mark the slot complete so the executor pipeline does not re-attempt the superseded plan. All actual implementation work is tracked under 16-08a and 16-08b SUMMARY files.
