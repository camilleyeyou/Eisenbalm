---
phase: "01"
plan: "06"
subsystem: cms-seed
tags: [sanity, agent-profiles, seeding, idempotent]
dependency_graph:
  requires: ["01-03"]
  provides: ["14 agentProfile documents in Sanity production dataset"]
  affects: ["Phase 9 deliberation layer (consumes agentProfile.displayName and personality)"]
tech_stack:
  added: ["@sanity/client createOrReplace pattern"]
  patterns: ["deterministic _id (agent-{agentId})", "JSON/TS copy-separation for non-dev editing"]
key_files:
  created:
    - apps/studio/scripts/agents.json
    - apps/studio/scripts/seed-agents.ts
  modified: []
decisions:
  - "D-17: Deterministic _id format agent-{agentId} with createOrReplace — re-runs produce identical state"
  - "D-18: agents.json holds all copy; seed-agents.ts is the runner — Andrew edits copy without TypeScript"
  - "D-19: Invoked via pnpm seed:agents (wired in apps/studio/package.json from Plan 03)"
metrics:
  duration_minutes: 3
  completed: "2026-05-12T01:10:25Z"
  tasks_completed: 2
  files_created: 2
  files_modified: 0
---

# Phase 01 Plan 06: Agent Seed Summary

Seeds all 14 canonical agentProfile documents into the Sanity production dataset using deterministic IDs and idempotent createOrReplace writes.

## One-liner

Idempotent seed of 14 agentProfile docs into Sanity production (agent-calibrator through agent-publisher) using deterministic `_id` and on-voice Jesse copy.

## What Was Built

### Task 1 — apps/studio/scripts/agents.json

All 14 canonical agents authored in Jesse voice — dry, precise, no winking. The JSON file is the single source of copy truth; Andrew can edit `displayName`, `role`, and `personality` without touching TypeScript.

**Canonical order (agentId → _id):**
1. `calibrator` → `agent-calibrator`
2. `scout` → `agent-scout`
3. `advocate` → `agent-advocate`
4. `editor` → `agent-editor`
5. `researcher` → `agent-researcher`
6. `origin-story` → `agent-origin-story`
7. `problem-statement` → `agent-problem-statement`
8. `founder-bio` → `agent-founder-bio`
9. `case-study` → `agent-case-study`
10. `game` → `agent-game`
11. `bonus` → `agent-bonus`
12. `design` → `agent-design`
13. `qa` → `agent-qa`
14. `publisher` → `agent-publisher`

### Task 2 — apps/studio/scripts/seed-agents.ts

Idempotent seed script using `@sanity/client` `createOrReplace`. Key properties:
- **Deterministic `_id`**: `agent-{agentId}` — never duplicates on re-run
- **Validation before writes**: validates canonical 14-agent order at startup; fails with clear error if `agents.json` is malformed
- **Env var guard**: exits with actionable message if `SANITY_STUDIO_PROJECT_ID` or `SANITY_API_TOKEN` is absent
- **Slug shape**: `agentId` field written as `{ _type: 'slug', current: agentId }` matching the Sanity schema
- **Pinned apiVersion**: `2024-01-01`

## Execution Result

The seed was **executed successfully** against the live `6h1vd9mf/production` dataset during plan execution. Idempotency was confirmed by a second run (exit 0, no duplicates).

```
Seeded 14/14 agent profiles.
  ✓ agent-calibrator ... ✓ agent-publisher
```

Re-running `pnpm seed:agents` at any time is safe — `createOrReplace` overwrites existing documents rather than creating duplicates.

## How to Run

```bash
# From repo root
pnpm seed:agents

# Or from apps/studio directly
pnpm seed:agents
```

Both require `SANITY_STUDIO_PROJECT_ID`, `SANITY_STUDIO_DATASET`, and `SANITY_API_TOKEN` in `apps/studio/.env.local`. Full instructions are in `apps/studio/README.md` (created in Plan 07).

## Deviations from Plan

None — plan executed exactly as written. Seed script ran successfully during plan execution (not deferred to Plan 07 smoke test) because all three required env vars were already present in `apps/studio/.env.local`.

## Self-Check: PASSED

- `apps/studio/scripts/agents.json` — FOUND (14 entries, correct order, all fields)
- `apps/studio/scripts/seed-agents.ts` — FOUND (createOrReplace, deterministic _id, env guard)
- Seed executed: 14/14 documents in `6h1vd9mf/production` — CONFIRMED
- Idempotent re-run: exit 0, no duplicates — CONFIRMED
- Commits: c0c4803 (agents.json), 7305b5d (seed-agents.ts) — FOUND
