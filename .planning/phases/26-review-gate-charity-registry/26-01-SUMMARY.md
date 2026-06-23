---
phase: 26
plan: "01"
subsystem: convex-foundation
tags:
  - convex
  - api-contracts
  - schema
  - review-gate
  - charity-registry
  - claim-checks
  - test-scaffolds
dependency-graph:
  requires:
    - Phase 25 runs table (scheduledPublishAt field added to existing runs table)
    - Phase 23 pipelineRuns table (sanityIssueId added)
    - Phase 22 pipelineConfig table (setAutoPublish added with 24h rate limit)
    - convex/auditLog.ts internal.auditLog.write (consumed by setAutoPublish)
  provides:
    - API_CONTRACTS §26.1–§26.8 (all Phase 26 interface contracts)
    - convex/charities.ts (registry CRUD + dedup + seed)
    - convex/claimChecks.ts (claim sign-off storage)
    - convex/reviewActions.ts (operator decision trail)
    - convex/runs.ts:setScheduledPublish + dueForPublish
    - convex/pipelineRuns.ts:updateStatus sanityIssueId field
    - convex/pipelineConfig.ts:setAutoPublish with 24h rate limit
  affects:
    - Phase 26 Plan 02 (FastAPI review endpoints + Scout registry integration)
    - Phase 26 Plan 03 (dispatch-control review screen)
    - Phase 26 Plan 04 (preview route + CSP)
tech-stack:
  added:
    - charities Convex table (via Phase 26 schema extensions in plan 26-01 task 2)
    - claim_checks Convex table
    - bareDomain() normalization helper (TS, mirrors scout.py _domain_of())
  patterns:
    - Convex mutation/query functional builder pattern (import from ./_generated/server)
    - Idempotent insertBatch via delete-then-reinsert
    - Conservative allSignedOff gate (empty list → false)
    - 24h rate-limit for setAutoPublish via pipeline_config key timestamp
    - Dedup key: name.trim().toLowerCase() + "|" + bareDomain(website)
key-files:
  created:
    - docs/API_CONTRACTS.md (§26.1–§26.8 added — 305 lines)
    - convex/schema.ts (27 insertions: charities additive fields, runs.scheduledPublishAt, pipelineRuns.sanityIssueId, new claim_checks table)
    - convex/charities.ts (7 exports + bareDomain helper)
    - convex/claimChecks.ts (4 exports)
    - convex/reviewActions.ts (2 exports)
    - packages/pipeline/tests/test_claims_extractor.py (10 skip-guarded pytest tests)
    - packages/pipeline/tests/test_review_endpoints.py (3 skip-guarded pytest tests)
    - packages/pipeline/tests/test_scout_registry.py (6 skip-guarded pytest tests)
    - apps/web/__tests__/preview-route.test.ts (10 it.skip vitest tests)
  modified:
    - convex/runs.ts (+setScheduledPublish, +dueForPublish)
    - convex/pipelineRuns.ts (updateStatus +sanityIssueId arg — backward compat)
    - convex/pipelineConfig.ts (+setAutoPublish with 24h rate limit + audit + event)
decisions:
  - "Dedup key uses pipe separator (|) to match existing scout.py _candidate_keys() — no migration needed"
  - "allSignedOff: empty list → false (conservative; prevents race window at approve click)"
  - "setAutoPublish 24h rate-limit stored as pipeline_config key auto_publish_enabled_at (reuses existing pattern)"
  - "Phase 27 NTF hook emitted from setAutoPublish using existing eventType literal as sentinel; Phase 27 adds proper eventType"
  - "reviewActions.record accepts v.string() for action (not a v.union literal enum) to avoid schema migration when adding future action types"
  - "charities.setStatus validates status in handler (not schema validator) for same extensibility reason"
metrics:
  duration: "~45 minutes (continuation session)"
  completed: "2026-06-23T09:47:39Z"
  tasks-completed: 4
  tasks-total: 4
  files-created: 12
  files-modified: 5
  commits: 4
---

# Phase 26 Plan 01: Contracts + Convex Foundation Summary

API_CONTRACTS.md Phase 26 section (§26.1–§26.8) + all Convex data layer for the review gate and charity registry.

## What Was Built

### Task 1 — API_CONTRACTS.md Amendment (`bcf07a6`)

Added 305 lines to `docs/API_CONTRACTS.md` defining the full Phase 26 interface contract before any implementation:

- **§26.1** — `charities` table additive fields: `dedupKey`, `website`, `domain`, `sanityCharityId`, `firstSeenRunId`, plus `by_workspace_dedupKey` and `by_workspace_status` indexes
- **§26.2** — `claim_checks` table schema (workspace_id, runId, claimIndex, text, claimType, context, status)
- **§26.3** — `runs.scheduledPublishAt` field + `dueForPublish` query spec for the Phase 25 tick sweep
- **§26.4** — `pipelineRuns.sanityIssueId` field (publish path resolves runId → Sanity issue)
- **§26.5** — Canonical `review_actions.action` enum: 8 values, kebab-free underscore form
- **§26.6** — All new Convex function signatures (charities.*, claimChecks.*, reviewActions.*, runs.setScheduledPublish, runs.dueForPublish, pipelineConfig.setAutoPublish)
- **§26.7** — FastAPI endpoints: `/issues/{run_id}/publish`, `/issues/{run_id}/schedule`, `/issues/{run_id}/reject`
- **§26.8** — Draft-preview route: HMAC-SHA256 token, 5-minute window, per-route `frame-ancestors` CSP

### Task 2 — convex/schema.ts Extension (`a4fd9b6`)

All additive, no existing field renames:

- `charities` table: +5 optional fields (dedupKey, website, domain, sanityCharityId, firstSeenRunId) + 2 new indexes
- `runs` table: +`scheduledPublishAt?: number`
- `pipelineRuns` table: +`sanityIssueId?: string`
- NEW `claim_checks` table: 7 fields, 2 indexes (by_runId, by_workspace)

### Task 3 — Convex Function Files (`c0c2773`)

Three new files + three extensions, all TypeScript-verified (exit 0):

**convex/charities.ts** (7 exports):
- `upsertCandidate` — idempotent Scout registration with featured/blocklisted downgrade guard (Pitfall 3)
- `upsertFeatured` — publish-path upsert, increments timesFeatured
- `setStatus` — operator registry UI, validates status in handler
- `listByWorkspace` — registry list with optional status filter
- `listForDedup` — Scout dedup query (featured + blocklisted only, minimal projection)
- `getByDedupKey` — direct compound key lookup
- `seedFromPublished` — backfill mutation for existing Sanity issues
- `bareDomain()` — local helper mirroring scout.py `_domain_of()`

**convex/claimChecks.ts** (4 exports):
- `insertBatch` — idempotent (delete-then-insert for re-extraction)
- `setStatus` — operator check/skip individual claims
- `listByRunId` — review screen checklist query
- `allSignedOff` — approve gate; conservative empty-list → false

**convex/reviewActions.ts** (2 exports):
- `record` — write decision trail row (server-side timestamp)
- `listByRunId` — decision trail reader (newest-first)

**Existing file extensions:**
- `convex/runs.ts`: +`setScheduledPublish` + `dueForPublish`
- `convex/pipelineRuns.ts`: `updateStatus` +`sanityIssueId` arg (backward-compatible)
- `convex/pipelineConfig.ts`: +`setAutoPublish` (24h rate-limit, audit log write, Phase 27 event hook)

### Task 4 — Wave 0 Test Scaffolds (`6cebee1`)

29 pre-written tests targeting Plan 26-02 implementation — all pass green (all skipped):

| File | Tests | Targets |
|------|-------|---------|
| `test_claims_extractor.py` | 10 (all skip) | `eisenbalm_pipeline.lib.claims` |
| `test_review_endpoints.py` | 3 (all skip) | `eisenbalm_pipeline.api.review` FastAPI router |
| `test_scout_registry.py` | 6 (all skip) | `eisenbalm_pipeline.lib.charity_registry` |
| `preview-route.test.ts` | 10 (all skip) | `apps/web/app/preview/[token]/page.tsx` + CSP (Plan 26-04) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript `possibly undefined` error in bareDomain()**
- **Found during:** Task 3 — `pnpm --filter @eisenbalm/convex exec tsc --noEmit`
- **Issue:** `withoutScheme.split('/')[0]` returns `string | undefined` in strict mode
- **Fix:** Added `?? ''` nullish coalescing: `const host = withoutScheme.split('/')[0] ?? ''`
- **Files modified:** `convex/charities.ts:30`
- **Commit:** `c0c2773`

**2. [Rule 1 - Bug] Cleaned duplicate imports in pipelineConfig.ts**
- **Found during:** Task 3 — review before commit
- **Issue:** `import { v as vv }` and second `import { internal }` were placed inline in the file body after `getAll`, creating duplicate identifiers
- **Fix:** Moved `import { internal }` to top-level imports, replaced `vv.boolean()` with `v.boolean()`, removed inline duplicate
- **Files modified:** `convex/pipelineConfig.ts`
- **Commit:** `c0c2773`

## Known Stubs

None. All Convex functions are fully implemented. The Wave 0 test files are intentionally skip-guarded scaffolds — their `pytest.skip` / `it.skip` state is the correct and expected state at this plan stage.

## Self-Check: PASSED

All created files exist and all commits are present (verified below).
