---
phase: 24-prompt-editor-versioning
plan: 02
subsystem: convex-data-layer
tags: [prompt-versions, versioning, mutations, queries, audit, deploy]
requires:
  - "24-01: prompt_versions schema + API_CONTRACTS §4A.2/§4A.2a contract"
provides:
  - "by_workspace_agentKey_version compound index on prompt_versions"
  - "promptVersions.saveVersion — immutable new-version mutation (isActive:false, audit emit)"
  - "promptVersions.activate — single-active flip with D-02 in-progress guard ({blocked:true})"
  - "promptVersions.listForAgent — version history query (newest-first)"
  - "promptVersions.getByVersion — exact-version lookup via the new compound index"
affects:
  - "24-07 (editor UI): useMutation(saveVersion), useQuery(listForAgent/getActive)"
  - "24-08 (diff/rollback UI): useMutation(activate), useQuery(getByVersion)"
tech-stack:
  added: []
  patterns:
    - "Immutable append-only versioning: saveVersion never overwrites; activate flips the single active row"
    - "D-02 in-progress guard returns {blocked:true} instead of mutating during a live run"
    - "Audit emission on both save and activate"
key-files:
  created: []
  modified:
    - "convex/schema.ts"
    - "convex/promptVersions.ts"
decisions:
  - "Task 3 (deploy) was a human-action gate: required Andrew's Convex deploy credentials + Clerk auth-config env var (CLERK_JWT_ISSUER_DOMAIN). Resolved 2026-06-22 after Clerk app provisioning."
  - "Pre-existing upsertActive/getActive preserved unchanged; new functions are additive."
checkpoints:
  - type: human-action
    task: 3
    resolution: "Andrew set CLERK_JWT_ISSUER_DOMAIN on modest-magpie-797 and ran `convex dev --once`. Verified: env var set, listForAgent returns [] (function live), _generated/api.d.ts maps promptVersions."
metrics:
  duration_min: 13
  completed: "2026-06-22"
  tasks: 3
  files: 2
---

# Phase 24 Plan 02: Convex Versioning Data Layer Summary

## What shipped

Built the versioning data layer on the existing `prompt_versions` table:

- **Task 1 (`06532c2`)** — additive `by_workspace_agentKey_version` compound index. Existing `by_workspace` / `by_workspace_agentKey` indexes and all frozen deliberation tables untouched.
- **Task 2 (`36163d7`)** — four functions: `saveVersion` (immutable; new rows `isActive:false`; audit emit), `activate` (single-active flip; D-02 in-progress guard returns `{blocked:true}`; audit emit), `listForAgent` (newest-first history), `getByVersion` (uses the new compound index). Plan-01 RED tests turned GREEN: `saveVersion.test.ts` (3) + `activate.test.ts` (4) = 7/7.
- **Task 3 (deploy — human-action gate)** — required Andrew's Convex deploy + the Clerk `CLERK_JWT_ISSUER_DOMAIN` auth-config env var (no Clerk app existed). Resolved 2026-06-22: Clerk app provisioned, `convex` JWT template created, env var set on `modest-magpie-797`, `convex dev --once` succeeded. Verified live: `convex run promptVersions:listForAgent` returns `[]` (function deployed and callable), `_generated/api.d.ts` maps `promptVersions`.

## Verification

- 7/7 Plan-01 convex-test cases green (in-memory).
- Live deployment: `listForAgent` callable (returns empty — no versions seeded yet).
- Schema index materialized server-side; no schema errors on deploy.

## Notes

- Deploy gate was an environment/credentials action, not a code defect. The function code + index were committed and unit-tested well before the deploy.
- Seeding of prompt-version rows is a separate pipeline step (`seed_phase24_assets.py`); the live table is empty until seeded.
