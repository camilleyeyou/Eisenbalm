# Phase 21: Auth + App Shell + Convex Schema - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 21-auth-app-shell-convex-schema
**Areas discussed:** Schema depth per table (the rest decided at Claude's discretion from brief + research)

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Schema depth per table | Full vs stub field definitions across the 11 new tables | ✓ |
| App shell scope & layout | What nav routes render, landing route, sidebar vs topbar | |
| Operator identity & attribution | Clerk → users → FastAPI/runs flow, JWT verification | |
| workspace_id type & seeding | String slug vs Convex Id; seed mechanism | |

**User's choice:** Schema depth per table (only)
**Notes:** Other three areas delegated to Claude to lock from `docs/MISSION_CONTROL_BRIEF.md` + `.planning/research/`.

---

## Schema depth per table

### Q1 — Core fork: how complete should the 11 tables' fields be?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid | Full fields for tables Phase 21 exercises (workspaces, users, runs, audit_log); stubs for the 7 owned by later phases | ✓ |
| Full schema now | Every field for all 11 tables up front | |
| All stubs | workspace_id + minimal keys everywhere | |

**User's choice:** Hybrid
**Notes:** Avoid guessing fields phases 22–27 own; still prove workspace-scoping + attribution shape now.

### Q2 — Attribution tables functional now, or just defined?

| Option | Description | Selected |
|--------|-------------|----------|
| Defined + seed/auth writes only | workspaces seeded + users JIT-written for real; runs/audit_log fully defined with attribution fields, live write flows land with their endpoints in later phases | ✓ |
| Fully functional now | Wire a real audit_log + runs write path this phase to demo attribution end-to-end | |

**User's choice:** Defined + seed/auth writes only
**Notes:** Criterion 4 met at the schema level (attribution fields present from day one); no synthetic run-trigger path built just to demo.

### Q3 — workspace_id index on every table?

| Option | Description | Selected |
|--------|-------------|----------|
| Index on every table | by_workspace (or compound) on all 11 from the start | ✓ |
| Field now, indexes per-phase | workspace_id field everywhere; indexes added when a phase queries | |

**User's choice:** Index on every table
**Notes:** Matches criterion 5; avoids later index migration over live run data.

### Q4 — File organization for the new tables?

| Option | Description | Selected |
|--------|-------------|----------|
| Follow existing pattern | Append all 11 inline to convex/schema.ts with ASCII headers; per-table .ts files only when a phase adds logic | ✓ |
| Group under one v2.0 section | Same schema.ts, all 11 fenced under one Mission Control block | |

**User's choice:** Follow existing pattern
**Notes:** Consistent with the 9 existing tables and per-table mutation file convention.

---

## Claude's Discretion (decided from brief + research)

- **App shell:** placeholder pages for all 7 nav routes; sidebar layout (shadcn); Graph as default home; Clerk user button in chrome.
- **Identity & attribution:** Clerk JIT user provisioning into `users`; FastAPI verifies Clerk JWT via JWKS; `triggered_by` defined on runs/audit_log.
- **workspace_id:** plain string slug `"eisenbalm"` (not v.id); idempotent Convex seed mutation; no hardcoded brand logic in control-plane code.

## Deferred Ideas

- Phases 22–28 scope (config externalization, dashboard views, prompt editing, run control, review gate, money/notifications, productization) — out of scope for Phase 21.
- `dispatch-control` dedicated Vercel project — confirm during Phase 21 planning; shares one Convex deployment regardless.
