---
phase: 26-review-gate-charity-registry
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - convex/schema.ts
  - convex/charities.ts
  - convex/claimChecks.ts
  - convex/reviewActions.ts
  - convex/runs.ts
  - convex/pipelineConfig.ts
  - convex/pipelineRuns.ts
  - packages/pipeline/tests/test_claims_extractor.py
  - packages/pipeline/tests/test_review_endpoints.py
  - packages/pipeline/tests/test_scout_registry.py
  - apps/web/__tests__/preview-route.test.ts
autonomous: true
requirements: [RVW-01, RVW-03, RVW-04, RVW-05, REG-01, REG-02]
user_setup: []

must_haves:
  truths:
    - "Convex charities table has dedupKey, website, domain, sanityCharityId, firstSeenRunId fields and three indexes"
    - "Convex claim_checks table exists with by_runId and by_workspace indexes"
    - "review_actions action enum is documented in API_CONTRACTS with the full Phase 26 vocabulary"
    - "API_CONTRACTS.md documents every new endpoint, table field, mutation, and query BEFORE any code consumes them"
    - "Wave 0 test files exist (RED/skipped) for claims extraction, review endpoints, scout registry dedup, and the preview route"
  artifacts:
    - path: "convex/charities.ts"
      provides: "Registry mutations + dedup/list queries"
      exports: ["upsertCandidate", "upsertFeatured", "setStatus", "listByWorkspace", "listForDedup", "getByDedupKey", "seedFromPublished"]
    - path: "convex/claimChecks.ts"
      provides: "Claims storage + sign-off mutations/queries"
      exports: ["insertBatch", "setStatus", "listByRunId", "allSignedOff"]
    - path: "convex/reviewActions.ts"
      provides: "Review decision trail writer + reader"
      exports: ["record", "listByRunId"]
    - path: "convex/schema.ts"
      provides: "Additive charities fields, claim_checks table, runs.scheduledPublishAt, pipelineRuns.sanityIssueId"
      contains: "claim_checks"
  key_links:
    - from: "convex/charities.ts upsertCandidate"
      to: "charities.status guard"
      via: "skip status update when existing is featured/blocklisted"
      pattern: "featured|blocklisted"
    - from: "docs/API_CONTRACTS.md"
      to: "convex tables + endpoints"
      via: "Phase 26 section documenting all additive shapes"
      pattern: "scheduledPublishAt|claim_checks|dedupKey"
---

<objective>
Lay the contract + datastore foundation for Phase 26. This plan amends `docs/API_CONTRACTS.md` FIRST (CLAUDE.md hard rule), then makes the additive Convex schema changes and writes all Convex mutations/queries the pipeline and dashboards will consume. It also authors the Wave 0 test scaffolds so downstream plans have RED tests to satisfy.

Purpose: Every downstream Phase 26 plan (pipeline endpoints, scout re-point, claims extraction, preview route, dashboards) reads from these contracts and Convex functions. They must exist and be documented before any consumer is written.
Output: Amended API_CONTRACTS.md, extended convex/schema.ts, three new Convex function files (charities, claimChecks, reviewActions), extended runs/pipelineRuns/pipelineConfig functions, four Wave 0 test files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/26-review-gate-charity-registry/26-CONTEXT.md
@.planning/phases/26-review-gate-charity-registry/26-RESEARCH.md
@CLAUDE.md

<interfaces>
<!-- Existing Convex shapes the new functions must respect. Extracted from codebase. -->

Existing charities stub (convex/schema.ts:320):
```typescript
charities: defineTable({
  workspace_id: v.string(),
  name: v.string(),
  status: v.string(),          // "candidate" | "featured" | "blocklisted"
  timesFeatured: v.optional(v.number()),
  lastFeaturedAt: v.optional(v.number()),
}).index('by_workspace', ['workspace_id'])
```

Existing review_actions stub (convex/schema.ts:341):
```typescript
review_actions: defineTable({
  workspace_id: v.string(),
  runId: v.string(),
  actorId: v.string(),
  action: v.string(),          // currently "approved" | "rejected" | "requested_changes"
  note: v.optional(v.string()),
  timestamp: v.number(),
}).index('by_workspace', ['workspace_id']).index('by_runId', ['runId'])
```

Existing runs table (convex/schema.ts) — dashboard run record (Phase 21):
fields: workspace_id, runId, triggerSource, triggeredBy, configSnapshot, status, startedAt, completedAt, cost, durationMs, cancelRequested. Indexes: by_workspace, by_runId.

Existing pipelineRuns table (convex/schema.ts:6) — pipeline run record (Phase 4):
fields: runId, issueNumber, status (union running/awaiting-review/complete/failed), startedAt, completedAt, errorMessage, durationMs, cost, awaitingHumanAt. Index: by_runId. NOTE: it does NOT currently carry sanityIssueId.

Existing auditLog public mutation (convex/auditLog.ts:61):
```typescript
export const record = mutation({ args: { workspace_id, actorId, action, ... } })
```

Existing pipelineConfig (convex/pipelineConfig.ts): `upsert({workspace_id, key, value})` and `getAll({workspace_id})` returning rows of {key, value}.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend docs/API_CONTRACTS.md with all Phase 26 shapes (FIRST — hard rule)</name>
  <read_first>
    - docs/API_CONTRACTS.md (read §3B run-control contracts ~830-1022 and §4 Convex tables, and §5 publish endpoints — to match existing format/numbering)
    - .planning/phases/26-review-gate-charity-registry/26-RESEARCH.md (Patterns 3,4,6,7,9 + Pattern 9 endpoint shapes verbatim)
    - .planning/phases/26-review-gate-charity-registry/26-CONTEXT.md (decisions D-01..D-12)
    - convex/schema.ts (lines 1-360 — to copy exact existing table field names)
  </read_first>
  <action>
Add a new "## Phase 26 — Review Gate + Charity Registry" section to docs/API_CONTRACTS.md (place it after the most recent phase's section; match the existing heading + code-block style). Document EXACTLY these additive shapes — do NOT rename any existing field:

1. **charities table additive fields** (additive only — keep the 5 existing fields):
   - `dedupKey: v.optional(v.string())` — case-folded `"{name}|{domain}"` (pipe separator)
   - `website: v.optional(v.string())` — raw website URL
   - `domain: v.optional(v.string())` — bare domain, case-folded (from `_domain_of`)
   - `sanityCharityId: v.optional(v.string())` — Sanity charity slug/_id cross-ref
   - `firstSeenRunId: v.optional(v.string())` — runId that first logged it as candidate
   - New indexes: `by_workspace_dedupKey` on `['workspace_id','dedupKey']`, `by_workspace_status` on `['workspace_id','status']`

2. **claim_checks table** (NEW):
   ```
   claim_checks: { workspace_id: string, runId: string, claimIndex: number,
     text: string, claimType: "number"|"date"|"proper_noun", context: string,
     status: "pending"|"checked"|"skipped" }
   indexes: by_runId ['runId'], by_workspace ['workspace_id']
   ```

3. **runs table additive field**: `scheduledPublishAt: v.optional(v.number())` (Unix ms; D-02). Document `runs:dueForPublish({workspace_id, nowMs})` query returning runs where `status == "awaiting-review"` AND `scheduledPublishAt <= nowMs`.

4. **pipelineRuns table additive field**: `sanityIssueId: v.optional(v.string())` — written by publisher so the publish endpoint can resolve the Sanity issue from a runId (RESEARCH open-question 3).

5. **review_actions action enum** — canonical vocabulary (Pitfall 7): `"approved_and_published"`, `"approved_and_scheduled"`, `"rejected"`, `"section_rerolled"`, `"auto_publish_enabled"`, `"auto_publish_disabled"`, `"charity_blocklisted"`, `"charity_status_changed"`.

6. **Convex functions** (signatures, one line each):
   - `charities:upsertCandidate({workspace_id, name, website, runId})` — guarded (never downgrade featured/blocklisted)
   - `charities:upsertFeatured({workspace_id, name, website, sanityCharityId})` — sets featured, increments timesFeatured, sets lastFeaturedAt
   - `charities:setStatus({workspace_id, charityId, status})`
   - `charities:listByWorkspace({workspace_id, status?})`
   - `charities:listForDedup({workspace_id})` — returns `{dedupKey,name,domain,status}` for featured+blocklisted only
   - `charities:getByDedupKey({workspace_id, dedupKey})`
   - `charities:seedFromPublished({workspace_id, rows})` — backfill upsert
   - `claimChecks:insertBatch({workspace_id, runId, claims})`, `claimChecks:setStatus({runId, claimIndex, status})`, `claimChecks:listByRunId({runId})`, `claimChecks:allSignedOff({runId})`
   - `reviewActions:record({workspace_id, runId, actorId, action, note?})`, `reviewActions:listByRunId({runId})`
   - `pipelineConfig:setAutoPublish({workspace_id, enabled, actorId})` — rate-limited (24h), writes audit, emits alert event

7. **FastAPI endpoints** (copy RESEARCH Pattern 9 verbatim — auth, guards, body, response):
   - `POST /issues/{run_id}/publish`
   - `POST /issues/{run_id}/schedule` (body `{scheduledAt:int}`)
   - `POST /issues/{run_id}/reject` (body `{note?:str}`)
   - Note: tick sweep extension reads `runs:dueForPublish` and flips Sanity for each due run.

8. **apps/web draft-preview route**: `GET /issue/{slug}/preview?token=<hmac>&runId=<id>` — HMAC of `runId:slug:floor(now/300000)` with `PREVIEW_SECRET`; 5-min sliding window; `previewDrafts` Sanity perspective; per-route `frame-ancestors 'self' <PREVIEW_ALLOWED_ORIGIN>` CSP.

Mark every item "Phase 26 additive — frozen pipelineRuns/deliberationEvents shapes unchanged."
  </action>
  <verify>
    <automated>grep -q "Phase 26" docs/API_CONTRACTS.md && grep -q "claim_checks" docs/API_CONTRACTS.md && grep -q "scheduledPublishAt" docs/API_CONTRACTS.md && grep -q "dedupKey" docs/API_CONTRACTS.md && grep -q "approved_and_published" docs/API_CONTRACTS.md && grep -q "/issues/{run_id}/publish" docs/API_CONTRACTS.md && echo CONTRACTS_OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "claim_checks\|dedupKey\|scheduledPublishAt\|sanityIssueId\|setAutoPublish" docs/API_CONTRACTS.md` returns >= 5
    - `grep -q "approved_and_published" docs/API_CONTRACTS.md` succeeds (canonical action enum present)
    - `grep -q "frame-ancestors" docs/API_CONTRACTS.md` succeeds (preview CSP documented)
    - No existing field renamed: `grep -q "timesFeatured" docs/API_CONTRACTS.md` and the 5 original charities fields still referenced
  </acceptance_criteria>
  <done>API_CONTRACTS.md has a complete Phase 26 section documenting all 8 additive groups; every downstream consumer can cite it.</done>
</task>

<task type="auto">
  <name>Task 2: Extend convex/schema.ts (additive fields + claim_checks table)</name>
  <read_first>
    - convex/schema.ts (full file — must preserve all existing tables/fields/indexes byte-for-byte)
    - docs/API_CONTRACTS.md (the Phase 26 section just written — the schema must match it exactly)
    - convex/_generated/dataModel.d.ts (to confirm generated types align after edit)
  </read_first>
  <action>
Edit convex/schema.ts (additive only — do NOT remove or rename existing fields):

1. In `charities: defineTable({...})` ADD after `lastFeaturedAt`:
   ```typescript
   dedupKey: v.optional(v.string()),
   website: v.optional(v.string()),
   domain: v.optional(v.string()),
   sanityCharityId: v.optional(v.string()),
   firstSeenRunId: v.optional(v.string()),
   ```
   and ADD two indexes after the existing `.index('by_workspace', ['workspace_id'])`:
   ```typescript
   .index('by_workspace_dedupKey', ['workspace_id', 'dedupKey'])
   .index('by_workspace_status', ['workspace_id', 'status'])
   ```

2. In `runs: defineTable({...})` ADD after `cancelRequested`:
   ```typescript
   scheduledPublishAt: v.optional(v.number()), // Phase 26 RVW-03 / D-02
   ```

3. In `pipelineRuns: defineTable({...})` ADD after `awaitingHumanAt`:
   ```typescript
   sanityIssueId: v.optional(v.string()), // Phase 26 — publish endpoint resolves Sanity issue from runId
   ```

4. ADD a NEW table `claim_checks` (place near charities/review_actions):
   ```typescript
   claim_checks: defineTable({
     workspace_id: v.string(),
     runId: v.string(),
     claimIndex: v.number(),
     text: v.string(),
     claimType: v.string(),   // "number" | "date" | "proper_noun"
     context: v.string(),
     status: v.string(),      // "pending" | "checked" | "skipped"
   })
     .index('by_runId', ['runId'])
     .index('by_workspace', ['workspace_id']),
   ```

Do NOT touch review_actions table shape (action stays `v.string()`; the enum is enforced by callers, not schema).
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && grep -q "claim_checks: defineTable" convex/schema.ts && grep -q "scheduledPublishAt" convex/schema.ts && grep -q "by_workspace_dedupKey" convex/schema.ts && grep -q "sanityIssueId" convex/schema.ts && echo SCHEMA_OK</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "claim_checks: defineTable" convex/schema.ts` succeeds
    - `grep -q "dedupKey: v.optional(v.string())" convex/schema.ts` succeeds
    - `grep -q "by_workspace_dedupKey" convex/schema.ts` AND `grep -q "by_workspace_status" convex/schema.ts` succeed
    - `grep -q "scheduledPublishAt: v.optional(v.number())" convex/schema.ts` succeeds
    - `grep -q "sanityIssueId: v.optional(v.string())" convex/schema.ts` succeeds
    - All 5 original charities fields (name, status, timesFeatured, lastFeaturedAt, workspace_id) still present (grep each)
  </acceptance_criteria>
  <done>Schema compiles with the additive fields + claim_checks table; existing tables untouched.</done>
</task>

<task type="auto">
  <name>Task 3: Write convex/charities.ts, claimChecks.ts, reviewActions.ts + extend runs.ts, pipelineRuns.ts, pipelineConfig.ts</name>
  <read_first>
    - convex/runs.ts (mutation/query patterns — withIndex usage, mutation/query wrappers)
    - convex/pipelineConfig.ts (upsert/getAll pattern for key/value config)
    - convex/auditLog.ts (record + internal write signatures — to call from setAutoPublish)
    - convex/deliberationEvents.ts (to mirror the eventType insert pattern for the alarm event)
    - docs/API_CONTRACTS.md (Phase 26 section — function signatures must match exactly)
    - convex/_generated/server.d.ts (mutation/query/internal import paths)
  </read_first>
  <action>
Create three new Convex files and extend three existing ones. Use `import { mutation, query } from './_generated/server'` and `import { v } from 'convex/values'`. Thread `workspace_id` on every row.

**convex/charities.ts** — exports:
- `upsertCandidate` (mutation, args `{workspace_id, name, website, runId}`): compute `domain = bareDomain(website)`, `dedupKey = `${name.trim().toLowerCase()}|${domain}``. Look up existing via `by_workspace_dedupKey`. If existing AND `existing.status` is `"featured"` or `"blocklisted"` → return without changing status (Pitfall 3 guard). If existing (candidate) → patch website/domain only. If none → insert `{workspace_id, name, status:"candidate", website, domain, dedupKey, firstSeenRunId: runId, timesFeatured:0}`.
- `upsertFeatured` (mutation, args `{workspace_id, name, website, sanityCharityId}`): compute dedupKey same way. Find via `by_workspace_dedupKey`. If exists → patch `status:"featured"`, `timesFeatured: (existing.timesFeatured ?? 0)+1`, `lastFeaturedAt: Date.now()`, `sanityCharityId`. If not → insert with `status:"featured", timesFeatured:1, lastFeaturedAt: Date.now()`.
- `setStatus` (mutation, args `{workspace_id, charityId: v.id('charities'), status}`): patch status. Validate status in ["candidate","featured","blocklisted"] else throw.
- `listByWorkspace` (query, args `{workspace_id, status: v.optional(v.string())}`): use `by_workspace`, filter by status when provided, sort by name.
- `listForDedup` (query, args `{workspace_id}`): use `by_workspace`, return only rows where status in ["featured","blocklisted"], project `{dedupKey, name, domain, status}`.
- `getByDedupKey` (query, args `{workspace_id, dedupKey}`): `by_workspace_dedupKey` first().
- `seedFromPublished` (mutation, args `{workspace_id, rows: v.array(v.object({name:v.string(), website:v.optional(v.string()), sanityCharityId:v.optional(v.string())}))}`): loop rows, call the same featured-upsert logic (idempotent backfill).
- Add a local `function bareDomain(url?: string): string` mirroring scout's `_domain_of`: strip scheme, take host before first `/`, lowercase, strip leading `www.`. Empty string when falsy.

**convex/claimChecks.ts** — exports:
- `insertBatch` (mutation, args `{workspace_id, runId, claims: v.array(v.object({claimIndex:v.number(), text:v.string(), claimType:v.string(), context:v.string()}))}`): first delete any existing claim_checks for runId (idempotent re-extraction), then insert each with `status:"pending"`.
- `setStatus` (mutation, args `{runId, claimIndex, status}`): find via `by_runId` matching claimIndex, patch status. Validate status in ["pending","checked","skipped"].
- `listByRunId` (query, args `{runId}`): `by_runId`, sorted by claimIndex.
- `allSignedOff` (query, args `{runId}`): return `{total, signedOff, allSignedOff}` where allSignedOff = total>0 ? every row status != "pending" : false. (Empty list → false is acceptable; the dashboard distinguishes "no claims" separately, but server gate treats no-claims-yet conservatively. Document this in a comment.)

**convex/reviewActions.ts** — exports:
- `record` (mutation, args `{workspace_id, runId, actorId, action, note: v.optional(v.string())}`): insert into review_actions with `timestamp: Date.now()`. Add a comment listing the canonical action enum from API_CONTRACTS.
- `listByRunId` (query, args `{runId}`): `by_runId`, sorted by timestamp desc.

**Extend convex/runs.ts** — add:
- `setScheduledPublish` (mutation, args `{runId, scheduledPublishAt: v.optional(v.number())}`): find via by_runId, patch field (allow null to clear).
- `dueForPublish` (query, args `{workspace_id, nowMs}`): `by_workspace`, filter `status === "awaiting-review" && scheduledPublishAt !== undefined && scheduledPublishAt <= nowMs`.

**Extend convex/pipelineRuns.ts** — extend the existing `updateStatus` mutation (do NOT break callers): add optional `sanityIssueId: v.optional(v.string())` arg and patch it when provided. Keep all existing behavior.

**Extend convex/pipelineConfig.ts** — add `setAutoPublish` (mutation, args `{workspace_id, enabled: v.boolean(), actorId: v.string()}`):
  1. Read existing `auto_publish_enabled_at` config row (getAll-style or direct query). If `enabled === true` AND a prior enabled timestamp exists within 24h (24*60*60*1000 ms) → `throw new Error("rate_limited")`.
  2. Upsert `auto_publish` = JSON.stringify(enabled).
  3. Upsert `auto_publish_enabled_at` = JSON.stringify(Date.now()) when enabling.
  4. Insert a deliberationEvents row with `eventType: "auto-publish-enabled"` (Phase 27 NTF hook) — only when enabling.
  5. Call the audit writer with action `enabled ? "auto_publish_enabled" : "auto_publish_disabled"`.
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && for f in charities claimChecks reviewActions; do test -f convex/$f.ts || { echo "MISSING $f"; exit 1; }; done && grep -q "upsertCandidate" convex/charities.ts && grep -q "allSignedOff" convex/claimChecks.ts && grep -q "setScheduledPublish" convex/runs.ts && grep -q "dueForPublish" convex/runs.ts && grep -q "setAutoPublish" convex/pipelineConfig.ts && echo CONVEX_FNS_OK</automated>
  </verify>
  <acceptance_criteria>
    - Files convex/charities.ts, convex/claimChecks.ts, convex/reviewActions.ts all exist
    - `grep -q "featured\|blocklisted" convex/charities.ts` shows the upsertCandidate downgrade guard
    - `grep -q "rate_limited" convex/pipelineConfig.ts` succeeds (24h rate-limit throw)
    - `grep -q "auto-publish-enabled" convex/pipelineConfig.ts` succeeds (alert event)
    - `grep -q "dueForPublish" convex/runs.ts` AND `grep -q "setScheduledPublish" convex/runs.ts` succeed
    - `grep -q "sanityIssueId" convex/pipelineRuns.ts` succeeds (updateStatus extended)
    - `pnpm --filter @eisenbalm/convex exec tsc --noEmit` (or the repo's convex typecheck script) exits 0 if available; if no script, `npx tsc --noEmit -p convex/tsconfig.json` exits 0
  </acceptance_criteria>
  <done>All Convex registry/claims/review/config functions exist, typecheck, and match the documented signatures.</done>
</task>

<task type="auto">
  <name>Task 4: Author Wave 0 test scaffolds (RED) for pipeline + web consumers</name>
  <read_first>
    - packages/pipeline/tests/conftest.py (fixtures + fake convex/sanity patterns)
    - packages/pipeline/tests/test_scout.py (existing scout test patterns — if present; else any test_*.py for style)
    - apps/web/__tests__/game-sandbox.test.ts (vitest source-scan style used in this repo)
    - .planning/phases/26-review-gate-charity-registry/26-RESEARCH.md (Validation Architecture → Test Map + Wave 0 Gaps)
  </read_first>
  <action>
Create the four Wave 0 test files referenced in RESEARCH "Wave 0 Gaps". Each test must currently FAIL or be skip-marked with a clear `MISSING — implemented in Plan 26-0X` reason so the downstream plan turns it green. Do NOT implement production code here.

1. **packages/pipeline/tests/test_claims_extractor.py** — pytest. Import target `eisenbalm_pipeline.lib.claims` (does not exist yet). Tests:
   - `test_extract_all_claim_types`: given a text with `"$1,200"`, `"2019"`, `"March 3, 2021"`, `"Puppies Behind Bars"`, the extractor returns claims of type number, date, proper_noun (assert each type present).
   - `test_flatten_portable_text`: given a list of Portable Text block dicts, `_flatten_portable_text` returns the concatenated child text.
   Use `pytest.importorskip("eisenbalm_pipeline.lib.claims")` OR wrap import in try/except with `pytest.skip("MISSING — Plan 26-02 creates lib/claims.py")` so the suite stays green until implemented, AND add a `xfail`-free explicit assertion that the module exists once present.

2. **packages/pipeline/tests/test_review_endpoints.py** — pytest + FastAPI TestClient. Tests (skip-guarded until Plan 26-03):
   - `test_publish_requires_claims_signoff`: POST /issues/{run}/publish with pending claims → 409 reason "claims_not_signed_off".
   - `test_publish_success`: with all claims signed off + mocked Sanity flip → 200.
   - `test_schedule_writes_scheduled_at`: POST /issues/{run}/schedule writes scheduledPublishAt.
   Mark with `pytest.skip("MISSING — Plan 26-03 implements api/review.py")` at module import if the router import fails.

3. **packages/pipeline/tests/test_scout_registry.py** — pytest. Tests (skip-guarded until Plan 26-02):
   - `test_registry_dedup_skips_featured`: a candidate whose dedupKey matches a featured registry row is filtered out.
   - `test_registry_load_empty_fallback`: `_load_registry_keys` returns `[]` when the Convex query raises.

4. **apps/web/__tests__/preview-route.test.ts** — vitest. Source-scan + behavior stubs (skip until Plan 26-04):
   - asserts a file `apps/web/app/issue/[slug]/preview/page.tsx` will exist and that `next.config.ts` will contain a `headers()` block with `frame-ancestors` scoped to `/issue/:slug/preview`.
   - Use `it.skip` / `describe.skip` with a TODO comment referencing Plan 26-04 so vitest stays green now.

Each file must run under its suite without crashing the run (skips allowed, hard failures not).
  </action>
  <verify>
    <automated>cd "$(git rev-parse --show-toplevel)" && test -f packages/pipeline/tests/test_claims_extractor.py && test -f packages/pipeline/tests/test_review_endpoints.py && test -f packages/pipeline/tests/test_scout_registry.py && test -f apps/web/__tests__/preview-route.test.ts && cd packages/pipeline && uv run pytest tests/test_claims_extractor.py tests/test_review_endpoints.py tests/test_scout_registry.py -q 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - All four test files exist at the exact paths above
    - `cd packages/pipeline && uv run pytest tests/test_claims_extractor.py tests/test_scout_registry.py tests/test_review_endpoints.py -q` exits 0 (skips allowed, no errors/failures)
    - `grep -q "MISSING — Plan 26-0" packages/pipeline/tests/test_claims_extractor.py` (or equivalent skip reason) succeeds
    - `pnpm --filter web test:unit -- --run preview-route` exits 0 (skips allowed)
  </acceptance_criteria>
  <done>Four Wave 0 test files exist and run green (skip-guarded), giving downstream plans concrete RED→GREEN targets.</done>
</task>

</tasks>

<verification>
- API_CONTRACTS.md has a complete Phase 26 section (grep markers present).
- convex/schema.ts has claim_checks + all additive fields + new indexes; existing tables unchanged.
- Three new Convex files + three extended files exist and typecheck.
- Four Wave 0 test files run green (skip-guarded).
- Run convex typecheck (`npx tsc --noEmit -p convex/tsconfig.json` or repo script) → exits 0.
</verification>

<success_criteria>
- Every downstream Phase 26 consumer can cite a documented contract for the table field, mutation, query, or endpoint it uses.
- No frozen field renamed; all changes additive.
- `cd packages/pipeline && uv run pytest -x -q` stays green (new files skip-guarded).
</success_criteria>

<output>
After completion, create `.planning/phases/26-review-gate-charity-registry/26-01-SUMMARY.md`.
</output>
