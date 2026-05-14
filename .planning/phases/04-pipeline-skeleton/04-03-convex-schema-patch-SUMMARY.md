---
phase: 04-pipeline-skeleton
plan: 03
subsystem: convex
tags: [convex, schema-patch, pipelineRuns, additive-migration]
requirements:
  - PIP-11
  - PIP-12
dependency_graph:
  requires:
    - "Phase 3 deployed Convex (pipelineRuns table + updateStatus mutation)"
    - "Convex CLI logged in under Andrew's account (dev deployment modest-magpie-797)"
  provides:
    - "pipelineRuns.durationMs (optional number)"
    - "pipelineRuns.cost (optional string)"
    - "pipelineRuns:updateStatus accepts durationMs + cost as optional args"
  affects:
    - "packages/pipeline lib/cost.py (Plan 04-02 onward) — will write into the new shape"
    - "packages/pipeline agents/publisher.py (Plan 04-07 / 04-09) — will flush cost + durationMs at pipeline-end"
tech-stack:
  added: []
  patterns:
    - "Additive Convex schema migration (no field renames, no index changes)"
    - "JSON-string mirror for evolving payloads (cost field mirrors existing modelVersions pattern)"
    - "Dev-deployment redeploy via 'convex dev --once' for non-interactive contexts"
key-files:
  created:
    - ".planning/phases/04-pipeline-skeleton/04-03-convex-schema-patch-SUMMARY.md"
  modified:
    - "convex/schema.ts"
    - "convex/pipelineRuns.ts"
    - "convex/README.md"
decisions:
  - "Pushed to the dev Convex deployment (modest-magpie-797) via 'convex dev --once' rather than the prod deployment (wonderful-wolverine-947). Rationale: the app actually uses the dev deployment per Phase 3 D-04 / Plan 03-02 Deviation 1; the prod deployment is unused by Phase 3, 4 callers. The 'pnpm run deploy' script targets prod and requires interactive confirmation, which is not available in autonomous executor context. The dev-once push regenerates _generated/ and pushes the schema + functions to the same deployment all consumers reference via NEXT_PUBLIC_CONVEX_URL."
  - "Did NOT add a new 'partial-failure' status enum value despite CONTEXT D-26 noting it might be useful; Phase 4 holds the line on additive-only changes. Future failure-mode work routes through 'failed' + descriptive errorMessage."
metrics:
  duration: "~3m"
  completed: "2026-05-14T02:34:35Z"
  tasks_completed: 4
  files_created: 1
  files_modified: 3
  commits: 3
---

# Phase 4 Plan 3: Convex Schema Patch (durationMs + cost) Summary

One-liner: Added two optional fields (`durationMs`, `cost`) to the `pipelineRuns` Convex table and extended `pipelineRuns:updateStatus` to accept them — additive-only patch, redeployed to the dev Convex deployment, smoke-tested via HTTP API.

## What Was Built

1. **Schema patch** (`convex/schema.ts`): Added `durationMs: v.optional(v.number())` and `cost: v.optional(v.string())` to the `pipelineRuns` table, after the existing `errorMessage` field. All four other tables (`deliberationEvents`, `agentVotes`, `qaCorrections`, `pitchLog`) are untouched. Both pipelineRuns indexes (`by_runId`, `by_issueNumber`) preserved.

2. **Mutation patch** (`convex/pipelineRuns.ts`): Extended the `updateStatus` mutation's `args` validator with the same two optional fields, after `errorMessage`. Handler body is unchanged — the existing `const { runId, ...updates } = args; await ctx.db.patch(run._id, updates)` destructure carries the new optional fields through automatically. The `byRunId` query and `create` mutation are untouched. The throw-on-missing behavior (`Run not found: ${runId}`) locked by Phase 3 D-13 is preserved.

3. **Convex redeploy** (Task 3 checkpoint, autonomous: false → auto-approved): Pushed the schema + functions to the dev Convex deployment via `pnpm --filter @eisenbalm/convex exec convex dev --once`. Output: `Convex functions ready! (4.95s)`. No `_generated/` diff appeared in git status because the api.d.ts uses `typeof <module>` re-exports — new validator types flow through automatically from the source files.

4. **README update** (`convex/README.md`): Inserted a `## Phase 4 additions (Pipeline Skeleton)` section between the Tables and Function files sections. Documents the two new fields by name + validator, links to CONTEXT D-22, D-23, D-39. Phase 3 documentation is untouched.

## Convex Deploy Details

- **Deploy timestamp:** 2026-05-14 19:33:13 (CLI-local time, deploy completed in 4.95s)
- **Target deployment:** `modest-magpie-797` (dev) — the deployment the app + Phase 4 pipeline use per Phase 3 D-04 / Plan 03-02 Deviation 1
- **Deploy command:** `pnpm --filter @eisenbalm/convex exec convex dev --once` (non-interactive variant; the documented `pnpm deploy:convex` targets the prod deployment `wonderful-wolverine-947` which requires interactive confirmation)
- **_generated/ regeneration:** Convex regenerated `_generated/` files during deploy. No diff appeared in `git status` — api.d.ts/server.d.ts use generic `FunctionReference` and `typeof <module>` re-exports, so adding optional validator fields does not change generated file content.

## Smoke Test (proves validator accepts new args)

Invoked the deployed mutation via the documented HTTP API path:

```bash
curl -X POST "${NEXT_PUBLIC_CONVEX_URL}/api/mutation" \
  -H 'Content-Type: application/json' \
  -H "Authorization: Convex ${CONVEX_DEPLOY_KEY}" \
  -d '{
    "path": "pipelineRuns:updateStatus",
    "args": {
      "runId": "nonexistent-04-03-checkpoint-smoke",
      "status": "running",
      "cost": "{}",
      "durationMs": 0
    },
    "format": "json"
  }'
```

Response:
```json
{
  "status": "error",
  "errorMessage": "[Request ID: 679aba913b25fd04] Server Error\nUncaught Error: Run not found: nonexistent-04-03-checkpoint-smoke\n    at handler (../pipelineRuns.ts:48:12)\n"
}
```

This is exactly the expected positive signal:
- The validator **accepted** `cost: "{}"` and `durationMs: 0` (additive optional fields).
- The handler was reached — confirmed by the error originating at `pipelineRuns.ts:48` (the existing `throw new Error(\`Run not found: ${args.runId}\`)`).
- The error is NOT `ArgumentValidationError`, which is what would have appeared if the validator rejected the new fields.

The checkpoint is therefore **AUTO-APPROVED** per the orchestrator's auto-mode directive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Plan-documented deploy command requires interactive confirmation**
- **Found during:** Task 3 (Convex redeploy checkpoint)
- **Issue:** The plan and Phase 3 README documented `pnpm --filter @eisenbalm/convex deploy` as the redeploy command. However, this script invokes `convex deploy`, which targets the **prod** deployment (`wonderful-wolverine-947`). Since the local CLI is currently set to `CONVEX_DEPLOYMENT=modest-magpie-797` (dev), `convex deploy` prompts: "Do you want to push your code to your prod deployment ... now?" — and exits with an interactive-prompt error in non-TTY contexts.
- **Fix:** Used `pnpm --filter @eisenbalm/convex exec convex dev --once` instead. This pushes to the currently-configured dev deployment without an interactive prompt. Phase 3 D-04 / Plan 03-02 Deviation 1 established that the dev deployment is the single environment the project uses; the prod deployment exists but no Phase 1-4 consumer references it (`NEXT_PUBLIC_CONVEX_URL` points at the dev URL).
- **Verification:** Convex CLI reported `Convex functions ready! (4.95s)` exit 0; subsequent HTTP smoke test confirmed the deployed mutation accepts the new args.
- **Files modified:** None (CLI invocation only)
- **Commit:** N/A (no source change; deploy result captured in Task 4 commit message and this SUMMARY)

No other deviations.

## Authentication Gates

None encountered. The Convex CLI was already authenticated against Andrew's account from Phase 3, and the deploy succeeded on first attempt against the dev deployment.

## Forward Links

- **Plan 04-02 (Dispatch State + lib modules):** `lib/cost.py` `CostRecorder` accumulates per-agent `{tokens_in, tokens_out, usd}` records, which get flushed via `pipelineRuns:updateStatus { cost: json.dumps(summary) }` at pipeline end. The schema slot now exists.
- **Plan 04-06 / 04-07 (Stub agents + wrapper):** The `@agent_node` decorator records duration and cost (stub: 0 tokens). The wrapper has somewhere to write the data when the pipeline completes.
- **Plan 04-09 (FastAPI app + routers):** The Publisher node (or top-level FastAPI handler on failure) computes `durationMs = pipeline_end_ms - pipeline_start_ms` and includes it in the final `pipelineRuns:updateStatus` call. CONTEXT D-23.
- **Plan 04-04 (Sanity schema patch):** The Sanity-side mirror — `weeklyIssue.pipelineMetadata.cost` is the JSON-stringified payload twin of `pipelineRuns.cost`. Plan 04-04 ensures the Sanity schema accepts the same shape.
- **Phase 5 (real agents):** The `cost` field is a JSON string today specifically so nested-object validation can be tightened later when the cost shape is real. CONTEXT D-22.

## Self-Check: PASSED

Verified each claim before completion:

```
FOUND: convex/schema.ts contains "durationMs: v.optional(v.number())"
FOUND: convex/schema.ts contains "cost: v.optional(v.string())"
FOUND: convex/pipelineRuns.ts contains "durationMs: v.optional(v.number())"
FOUND: convex/pipelineRuns.ts contains "cost: v.optional(v.string())"
FOUND: convex/README.md contains "Phase 4 additions"
FOUND: convex/README.md contains "PIP-11"
FOUND: 8ca7317 (Task 1 commit: schema.ts)
FOUND: de405ed (Task 2 commit: pipelineRuns.ts)
FOUND: 05c293e (Task 4 commit: README.md)
FOUND: Convex deploy succeeded (exit 0, "Convex functions ready! (4.95s)")
FOUND: HTTP smoke test returned "Run not found" not "ArgumentValidationError"
```

No claims missing.
