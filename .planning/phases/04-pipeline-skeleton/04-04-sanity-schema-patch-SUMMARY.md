---
phase: 04-pipeline-skeleton
plan: 04
subsystem: sanity-schema
tags: [sanity, schema, typegen, ops-03, cost-tracking]
status: complete
completed: "2026-05-14"
requires:
  - apps/studio/schemas/weeklyIssue.ts (existing pipelineMetadata object — Phase 1)
  - apps/studio/sanity.cli.ts (Phase 1 D-12 typegen wiring)
  - packages/shared/src/sanity-types.ts (Phase 1 D-14 re-export)
provides:
  - apps/studio/schemas/weeklyIssue.ts:pipelineMetadata.cost field
  - apps/studio/sanity.types.ts:WeeklyIssue.pipelineMetadata.cost?: string
  - OPS-03 schema slot — Andrew reads per-run cost JSON in Studio
affects:
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (Plan 04-02 writes json.dumps(cost_payload) to this field)
  - apps/web (no change required — Phase 9 may surface cost on issue page)
tech-stack:
  added: []
  patterns:
    - Mirror modelVersions JSON-string pattern (defer nested-object validation to Phase 5 / v2)
    - Additive-only schema change (no existing field touched)
key-files:
  created: []
  modified:
    - apps/studio/schemas/weeklyIssue.ts
    - apps/studio/sanity.types.ts
decisions:
  - "Used pnpm typegen (cleanly succeeded) — no manual fallback to sanity.types.ts needed. Generator also updated docblock comment format vs the previously-committed file."
  - "cost field is type: 'text', rows: 4 — matches plan spec verbatim; description explicitly notes the JSON-stringified per-agent cost summary mirrors Convex pipelineRuns.cost."
  - "Pre-existing typecheck errors in @eisenbalm/shared (Phase 1) are NOT addressed in Plan 04-04 (out of scope per deviation Rule SCOPE BOUNDARY). The re-export resolves at runtime/Bundler resolution; only the tsc --noEmit step under nodenext module resolution fails, and that was already failing before this plan ran."
metrics:
  duration: 6m
  tasks-completed: 2
  files-modified: 2
  commits: 2
---

# Phase 4 Plan 04: Sanity Schema Patch Summary

Added the `pipelineMetadata.cost` text field to `apps/studio/schemas/weeklyIssue.ts` and regenerated `apps/studio/sanity.types.ts` so the Phase 4 pipeline (Plan 04-02's `lib/sanity_client.py:write_issue_draft`) can persist a JSON-stringified per-agent cost summary on each weekly issue draft, and Andrew can read it in Studio for OPS-03.

## Tasks Executed

### Task 1: Add `cost` text field to `weeklyIssue.pipelineMetadata`

**Commit:** `0beff9c feat(04-04): add pipelineMetadata.cost text field to weeklyIssue schema`

- Located the `pipelineMetadata` object's `fields` array (currently `runId`, `startedAt`, `completedAt`, `modelVersions`).
- Appended a new `defineField({ name: 'cost', title: 'Run Cost (JSON)', type: 'text', rows: 4, description: '...' })` AFTER `modelVersions` (last in array order).
- Description copy: *"JSON: per-agent token + USD cost summary. Mirrors Convex pipelineRuns.cost. Read-only for Andrew."*
- All other fields, validation rules, and ordering preserved exactly.

**Verify:** `grep -F "name: 'cost'" apps/studio/schemas/weeklyIssue.ts` returns the new line; `grep -F "name: 'modelVersions'"` and `name: 'runId'` still return their existing lines.

### Task 2: Regenerate `sanity.types.ts` via `pnpm typegen`

**Commit:** `bf0404f chore(04-04): regenerate sanity.types.ts with pipelineMetadata.cost`

- Ran `pnpm typegen` from repo root (delegates to `pnpm --filter studio typegen` which runs `sanity schema extract --enforce-required-fields && sanity typegen generate`).
- Typegen succeeded cleanly — no ECONNRESET, no manual fallback edit required.
- Generated `WeeklyIssue` interface now contains `pipelineMetadata?: { runId?: string; startedAt?: string; completedAt?: string; modelVersions?: string; cost?: string; }`.
- Generator also refreshed the file's header comment block (older typegen version had a terser comment); this is incidental but committed alongside the new field.

**Verify:**
```bash
grep -F "cost?: string" apps/studio/sanity.types.ts       # → "  cost?: string;"
grep -F "modelVersions?: string" apps/studio/sanity.types.ts  # → "  modelVersions?: string;"
grep -F "pipelineMetadata" apps/studio/sanity.types.ts    # → "  pipelineMetadata?: {"
```

All three checks pass.

## Deviations from Plan

None. The plan ran exactly as written:
- `pnpm typegen` succeeded on the first attempt — the Phase 1 STATE.md ECONNRESET fallback path was not needed.
- No edits to any schema other than `weeklyIssue.ts`.
- `pipelineMetadata` field order preserved; `cost` appended last per spec.

## Out-of-Scope Pre-existing Issues (NOT addressed)

- `pnpm --filter @eisenbalm/shared typecheck` fails with two pre-existing errors:
  - `src/index.ts(3,15): error TS2835` (missing `.js` extension under nodenext moduleResolution)
  - `src/sanity-types.ts(22,20): error TS2307` (cannot resolve `../../../apps/studio/sanity.types` under nodenext)

  Both errors are reproducible by stashing my changes — they exist in master prior to Plan 04-04. The re-export still resolves correctly at Bundler resolution (used by apps/web Next.js 15 build) and at the Sanity Studio's own resolution path. Fixing requires changing `packages/shared/tsconfig.json` (Phase 1 setup) — out of scope per deviation Rule SCOPE BOUNDARY. The new `cost?: string` field appears in `apps/studio/sanity.types.ts` and is therefore consumed correctly by every workspace that imports from `@eisenbalm/shared` via Bundler resolution.

## Known Stubs

None — this plan is a schema patch only. The new field exists; Plan 04-02 already (in its own parallel commits) writes `json.dumps(cost_payload)` to `pipelineMetadata.cost` via `lib/sanity_client.py:write_issue_draft`.

## Forward Links

- **Plan 04-02** (`packages/pipeline/.../sanity_client.py`): `write_issue_draft` writes `pipelineMetadata.cost = json.dumps(state.get("cost_payload", {"total": 0.0, "agents": {}}))` — this slot now exists in the schema.
- **Plan 04-12** (Andrew's smoke test): Andrew opens `issue-999` draft in Studio after a stub run and confirms the "Run Cost (JSON)" field is populated with the JSON payload.
- **Phase 5**: When real LLM calls land, `lib/cost.py:CostRecorder` flushes its accumulated per-agent records into the same JSON shape. No schema change needed.
- **Phase 5 or v2**: A custom Studio field renderer may replace the raw text view — CONTEXT D-24 explicitly defers this.

## Self-Check: PASSED

- [x] `apps/studio/schemas/weeklyIssue.ts` exists and grep `name: 'cost'` matches inside the `pipelineMetadata` block
- [x] `apps/studio/sanity.types.ts` exists and grep `cost?: string` matches inside the `pipelineMetadata` block
- [x] Commit `0beff9c` (schema patch) verified present in `git log --oneline --all`
- [x] Commit `bf0404f` (regenerated types) verified present in `git log --oneline --all`
- [x] `pnpm typegen` exit code 0
- [x] `WeeklyIssue` interface in regenerated types includes optional `cost?: string` field under `pipelineMetadata`
