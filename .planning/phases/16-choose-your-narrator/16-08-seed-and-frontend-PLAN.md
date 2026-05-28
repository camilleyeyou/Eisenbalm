---
phase: 16-choose-your-narrator
plan: 08
type: superseded
wave: 4
depends_on: []
files_modified: []
autonomous: true
requirements: []
must_haves:
  truths:
    - "This plan has been superseded by 16-08a (seed) and 16-08b (frontend chip)."
  artifacts: []
  key_links: []
superseded_by:
  - 16-08a-seed-narrators-PLAN.md
  - 16-08b-frontend-chip-PLAN.md
---

<objective>
SUPERSEDED — see split below.

This plan was originally a combined "seed + frontend chip" plan. The plan-checker (revision iteration 1, warning W7) flagged it as exceeding the 4-task / 2-subsystem scope threshold (5 tasks, Studio seeds + React frontend). Plan was split into:

- `16-08a-seed-narrators-PLAN.md` — Studio seed (narrators.json + seed-narrators.ts + Andrew Studio UAT checkpoint)
- `16-08b-frontend-chip-PLAN.md` — Web frontend (queries.ts + types.ts + IssueHero.tsx chip)

The two split plans have independent dependency graphs:
- 16-08a depends on: 16-01, 16-02, 16-04 (Sanity schema + tests + voice.py UNIVERSAL_CORE anchor)
- 16-08b depends on: 16-01, 16-03 (Sanity schema + web test scaffold)

Both are wave 4 (same as the original 16-08). Plan 16-09 (verification + UAT) depends on both.

**EXECUTORS: Do not implement this file. Implement 16-08a and 16-08b instead.**
</objective>

<execution_context>
This plan has no execution context. It is a tombstone redirect.
</execution_context>

<context>
@.planning/phases/16-choose-your-narrator/16-08a-seed-narrators-PLAN.md
@.planning/phases/16-choose-your-narrator/16-08b-frontend-chip-PLAN.md
</context>

<tasks>
<!-- No tasks. See 16-08a and 16-08b. -->
</tasks>

<success_criteria>
- 16-08a and 16-08b are present in the phase directory.
- Plan 16-09's depends_on list references 16-08a and 16-08b (not 16-08).
</success_criteria>

<output>
No SUMMARY required. This file is a redirect marker.
</output>
