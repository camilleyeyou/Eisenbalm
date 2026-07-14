---
phase: 40-issue-entity-issues-home
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - apps/dispatch-control/vitest.config.ts
  - apps/dispatch-control/__tests__/issues.test.ts
  - apps/dispatch-control/__tests__/derivedState.test.ts
  - apps/dispatch-control/__tests__/issueRouteResolver.test.ts
  - apps/dispatch-control/__tests__/IssueCard.test.tsx
  - apps/dispatch-control/__tests__/ScheduledSlotCard.test.tsx
  - apps/dispatch-control/__tests__/HoldDialog.test.tsx
  - packages/pipeline/tests/test_repetition_note.py
autonomous: true
requirements: [ISS-01, ISS-02, ISS-03, ISS-04, ISS-05, ISS-06]

must_haves:
  truths:
    - "docs/API_CONTRACTS.md contains a §40 section fixing the issues table, convex/issues.ts signatures, pipelineRuns issue-keyed queries, the repetition-note endpoint, the route tree, and the derived-state selector module — BEFORE any of that code exists"
    - "Every Wave-0 test file named in 40-VALIDATION.md exists on disk and fails RED for the right reason (module-not-found / not-implemented), not an environment misconfiguration"
    - "apps/dispatch-control/vitest.config.ts routes __tests__/issues.test.ts to the edge-runtime environment"
  artifacts:
    - path: "docs/API_CONTRACTS.md"
      provides: "§40 contract — the single authority for every shape Plans 40-02..40-09 implement"
      contains: "## §40 — Issue Entity & Issues Home (Phase 40)"
    - path: "apps/dispatch-control/vitest.config.ts"
      provides: "edge-runtime environment mapping for the new convex-test file"
      contains: "__tests__/issues.test.ts"
    - path: "apps/dispatch-control/__tests__/derivedState.test.ts"
      provides: "RED spec for the pure derived-state selector module (ISS-01/ISS-06)"
    - path: "apps/dispatch-control/__tests__/issues.test.ts"
      provides: "RED spec for the issues Convex table + hold/reopen/ensureByNumber (ISS-01/ISS-04)"
    - path: "packages/pipeline/tests/test_repetition_note.py"
      provides: "RED spec for GET /registry/repetition-note (ISS-03)"
  key_links:
    - from: "apps/dispatch-control/vitest.config.ts"
      to: "__tests__/issues.test.ts"
      via: "environmentMatchGlobs edge-runtime entry"
      pattern: "__tests__/issues.test.ts.*edge-runtime"
---

<objective>
Wave 0. Write the §40 contract and every test file the phase's implementation plans turn GREEN.

Purpose: This repo's hard convention (CLAUDE.md; Phases 35/38/39) is contract-first — `docs/API_CONTRACTS.md` is amended BEFORE the schema/endpoint/module it describes exists. Every downstream Phase 40 plan implements §40 verbatim; no field name, function signature, endpoint path, or selector shape may be invented later. The tests are written now so that every subsequent task has a real `<automated>` verify command that already exists on disk.

Output: `docs/API_CONTRACTS.md` §40; six RED dashboard test files; one RED pipeline test file; one `vitest.config.ts` environment entry.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/40-issue-entity-issues-home/40-CONTEXT.md
@.planning/phases/40-issue-entity-issues-home/40-RESEARCH.md
@.planning/phases/40-issue-entity-issues-home/40-VALIDATION.md
@.planning/phases/40-issue-entity-issues-home/40-UI-SPEC.md

<naming_trap>
CRITICAL — two unrelated things share the string `/issues/`:

1. The FastAPI **pipeline** already exposes 18 endpoints shaped `/issues/{run_id}/...`
   (`content.py`, `review.py`, `findings.py`, `signoffs.py`, `voice_pass.py`, `control.py`).
   There, `{run_id}` is a **runId**. These are OUT OF SCOPE. Do not rename them.
2. This phase creates a **console (Next.js dashboard)** route tree at
   `/issues/[issueNumber]`, keyed by **issueNumber**.

Different hosts, different frameworks, opposite path-param meanings. Every time you write
"/issues/..." in code or a comment, say which one you mean.
</naming_trap>

<interfaces>
Existing shapes the §40 contract must build on (read them, do not re-derive):

From convex/lib/auth.ts:
```typescript
export async function requireOperator(ctx: MutationCtx): Promise<string>  // returns identity.subject; NEVER trust a client-supplied actorId
export function requirePipelineSecret(secret?: string): void
export async function requireOperatorOrPipeline(ctx, secret?): Promise<{ actor: string; isPipeline: boolean }>
```

From convex/signOffs.ts:
```typescript
export const activeByRunId = query({ args: { runId: v.string() } })
// → Record<'facts-cleared' | 'sounds-human', { actorId: string; signedAt: number }>  (absent key = not signed / revoked)
```

From convex/claimChecks.ts:
```typescript
export const listByRunId = query({ args: { runId: v.string() } })   // rows sorted by claimIndex; row.status is "pending"|"checked"|"skipped"; row.sourceUrl optional
export const allSignedOff = query({ args: { runId: v.string() } })  // → { total, signedOff, allSignedOff }
```

From convex/qaCorrections.ts:
```typescript
export const byRunId = query({ args: { runId: v.string() } })
// row: { severity: 'info'|'warning'|'error', axis?: 'gravity'|'sentiment'|'irony-signaling'|'precision'|'cross-section-consistency'|'hard-rule'|'machine-tell'|'structural-variety', sectionName, accepted: boolean, resolution?: 'accepted'|'dismissed', reason, suggestedFix? }
```

From convex/pitchLog.ts: `byRunId`, `selectedByRunId` (row has `selected: boolean`)
From convex/runs.ts: `latest`, `byRunId`, `listForWorkspace`, `monthToDateCost`, `requestCancel({ workspace_id, runId })`
From convex/pipelineRuns.ts: `byRunId` ONLY. There is NO `byIssueNumber` query yet, even though `convex/schema.ts:25` already declares the `by_issueNumber` index.
From convex/auditLog.ts: `internalMutation write({ workspace_id, actorId, action, resourceType?, resourceId?, before?, after? })`

From apps/dispatch-control/lib/galley/findingState.ts:
```typescript
export function isOpenFinding(row: { accepted?: boolean; resolution?: 'accepted'|'dismissed'|null }): boolean
```
From apps/dispatch-control/lib/galley/axisPartition.ts:
```typescript
export const VOICE_AXES: ReadonlySet<string>   // gravity, sentiment, irony-signaling, machine-tell
export const FACTUAL_AXES: ReadonlySet<string> // precision, cross-section-consistency, structural-variety, hard-rule
```

From packages/pipeline/src/eisenbalm_pipeline/api/registry.py: `GET /registry/coverage-strip` — the exact endpoint the repetition-note endpoint mirrors (same Convex `charities:listRecentFeatured` query, same single `groq_query`, same `_require_clerk_jwt_control` guard, read-only, no audit row).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write docs/API_CONTRACTS.md §40 (contract-first)</name>

  <read_first>
    - docs/API_CONTRACTS.md lines 3816-3956 (the whole §39 section — copy its heading style, subsection numbering, code-fence style, and "written BEFORE any code exists" framing verbatim; §40 is appended after it, at the end of the file)
    - convex/schema.ts lines 1-30 (pipelineRuns + its already-declared but unused `by_issueNumber` index) and lines 466-483 (sign_offs — the closest structural analog to the new issues table)
    - convex/lib/auth.ts (the three guard lanes §40 references by name)
    - convex/auditLog.ts (the internalMutation `write` signature hold/reopen call)
    - packages/pipeline/src/eisenbalm_pipeline/api/registry.py (the GET /registry/coverage-strip endpoint the new repetition-note endpoint mirrors)
    - .planning/phases/40-issue-entity-issues-home/40-UI-SPEC.md (State & Icon Contract — the exact status/stage vocabularies §40.6 must fix)
  </read_first>

  <action>
Append a new `## §40 — Issue Entity & Issues Home (Phase 40)` section to the END of `docs/API_CONTRACTS.md` (currently 3956 lines, ending with §39). Open it with the same framing paragraph style §39 uses: state that this contract is written BEFORE any schema/module/endpoint code exists (CLAUDE.md contract-first hard rule, mirroring §31-§39), that Plans 40-02..40-09 implement these shapes verbatim, and that no field name, endpoint path, function signature, or state literal may be invented later.

Include a short "Naming note" paragraph at the top of §40 reproducing the `<naming_trap>` above: the pipeline's 18 pre-existing `/issues/{run_id}/...` REST endpoints are runId-keyed and OUT OF SCOPE; this section's `/issues/[issueNumber]` is the new Next.js console route tree. They collide in name only.

Write these subsections with EXACTLY these contents:

### §40.1 — `issues` Convex table (NEW)

```typescript
// convex/schema.ts
issues: defineTable({
  workspace_id: v.string(),
  issueNumber: v.number(),                 // NATURAL KEY (D-02). Unique per workspace — enforced by a
                                           // query-then-insert guard inside ensureByNumber, NOT the
                                           // schema (Convex has no unique constraint; same pattern as
                                           // runs:create's existing-row check, convex/runs.ts:37-41).
  scheduledFor: v.optional(v.number()),    // Unix ms — the slot this issue is reserved for (D-11)
  held: v.boolean(),                       // D-18: one of only TWO stored status inputs
  heldReason: v.optional(v.string()),      // required-when-holding, enforced at the MUTATION (D-16)
  heldBy: v.optional(v.string()),          // Clerk sub from requireOperator(ctx) — NEVER client-supplied
  heldAt: v.optional(v.number()),
  published: v.boolean(),                  // D-18: the other stored status input
  publishedAt: v.optional(v.number()),
  sanityIssueId: v.optional(v.string()),
  lastVisitedStage: v.optional(v.string()),// Phase 41 writes this; Phase 40 only declares it
  createdAt: v.number(),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_issueNumber', ['workspace_id', 'issueNumber']),
```

**Stored-vs-derived invariant (D-18, load-bearing):** `held` and `published` are the ONLY status
inputs ever persisted. Issue status is recomputed from them plus live `sign_offs` on every read
(§40.6). There is no `status` column and there must never be one — a persisted status is exactly the
silently-stale "ready" ISS-06 forbids.

### §40.2 — `convex/issues.ts` functions (NEW)

```typescript
// ── Queries (PUBLIC, unguarded reads — same convention as claimChecks:allSignedOff) ──
byIssueNumber({ workspace_id, issueNumber }): Promise<Doc<'issues'> | null>
listForWorkspace({ workspace_id }): Promise<Doc<'issues'>[]>   // issueNumber DESC

// ── Mutations ──
ensureByNumber({ workspace_id, issueNumber, scheduledFor?, pipelineSecret? })
  : Promise<{ issueNumber: number; created: boolean }>
  // DUAL LANE — requireOperatorOrPipeline(ctx, pipelineSecret). Console-created (D-03) AND
  // pipeline-defensive (D-04) both call this.
  // IDEMPOTENT insert-if-absent. On an existing row it is a strict NO-OP: it MUST NOT patch
  // `held`, `heldReason`, `heldBy`, `heldAt`, or `published`. D-04's guard — a stray run
  // (POST /run/weekly with an empty body, a curl, a future cron) can never silently resurrect a
  // Held issue. Returns { created: false } on the no-op path.
  // On insert: { workspace_id, issueNumber, scheduledFor, held: false, published: false,
  //              createdAt: Date.now() }.

hold({ workspace_id, issueNumber, reason }): Promise<null>
  // requireOperator(ctx) → actor. THROWS new Error('A reason is required to hold this issue.')
  // when reason.trim() === '' (D-16 — required free text, no preset taxonomy).
  // THROWS new Error('Issue not found') when no row exists.
  // Patches { held: true, heldReason: reason.trim(), heldBy: actor, heldAt: Date.now() }.
  // Then ctx.runMutation(internal.auditLog.write, {
  //   workspace_id, actorId: actor, action: 'issue.held', resourceType: 'issue',
  //   resourceId: String(issueNumber),
  //   before: JSON.stringify({ held: false }),
  //   after:  JSON.stringify({ held: true, heldReason: reason.trim() }),
  // })
  // NOTE: hold does NOT touch runs.cancelRequested. D-14's "also stop the run in progress"
  // checkbox is a SEPARATE client-side call to the existing runs:requestCancel mutation — the two
  // state systems stay distinct in the model.

reopen({ workspace_id, issueNumber }): Promise<null>
  // requireOperator(ctx) → actor. Patches
  // { held: false, heldReason: undefined, heldBy: undefined, heldAt: undefined }.
  // Status re-derives on its own (D-17) — no "restore previous status" bookkeeping.
  // audit_log action: 'issue.reopened' (same envelope as hold).

markPublished({ workspace_id, issueNumber, sanityIssueId?, publishedAt?, pipelineSecret? }): Promise<null>
  // DUAL LANE — requireOperatorOrPipeline(ctx, pipelineSecret). Used by the D-05 backfill script
  // and (later) the publisher. Patches { published: true, publishedAt: publishedAt ?? Date.now(),
  // sanityIssueId }. Idempotent.
```

**No `tasks` table, no `status` column, no `stage` column.** All three are derived (§40.6,
`DERIVED-STATE-CONTRACT.md` §2/§3).

### §40.3 — `convex/pipelineRuns.ts` issue-keyed queries (NEW)

```typescript
// Both PUBLIC/unguarded, matching the existing pipelineRuns:byRunId convention.
// Both use the ALREADY-DECLARED `by_issueNumber` index (convex/schema.ts:25) — no schema change.

byIssueNumber({ issueNumber }): Promise<Doc<'pipelineRuns'> | null>
  // The MOST RECENT run for that issue (startedAt DESC, first). This is the runId the issue-keyed
  // console routes /issues/[n]/review and /issues/[n]/voice resolve to.

listByIssueNumber({ issueNumber }): Promise<Doc<'pipelineRuns'>[]>
  // ALL runs for that issue, startedAt DESC — the run history the issue overview links into at the
  // console route /issues/[n]/runs/[runId] (D-08).
```

### §40.4 — `GET /registry/repetition-note` (pipeline, FastAPI, read-only, no audit row)

New endpoint in `packages/pipeline/src/eisenbalm_pipeline/api/registry.py`, alongside the existing
`GET /registry/coverage-strip`. Same auth guard (`_require_clerk_jwt_control`), same Convex+Sanity
join, read-only, no audit row.

**Why an endpoint and not a client-side derivation:** the cause/geo chips live in Sanity, and
dispatch-control has ZERO Sanity access (EDT-05, tripwire-enforced by
`apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts`).

**No LLM call, no run required (D-10).** The note must render BEFORE a run exists. It is the
Calibrator's *rule* applied outside a run — today's `agents/calibrator.py` only rotates `bonusType`
and emits no such note; nothing in that agent changes.

Request: `GET /registry/repetition-note` (no params).

Response (200):
```json
{
  "note": "avoid US-SE · avoid weather",
  "avoid": [
    { "dimension": "geo",   "value": "US-SE",   "count": 3 },
    { "dimension": "cause", "value": "weather", "count": 3 }
  ],
  "sampleSize": 8
}
```
`note` is `null` and `avoid` is `[]` when nothing is over-represented.

Algorithm (deterministic — no model call):
1. Read the SAME source `coverage-strip` reads: `convex_query(convex_http, "charities:listRecentFeatured", {workspace_id: "eisenbalm", limit: 8})`, then ONE `groq_query('*[_type=="charity" && _id in $ids]{_id, focusArea, location}', params={"ids": ids})` over the rows that have a `sanityCharityId`.
2. `sampleSize` = number of rows returned by Convex (≤ 8).
3. Count only TWO dimensions: `cause` (Sanity `focusArea`) and `geo` (Sanity `location`). **`signal` (`scoutNotes`) is deliberately EXCLUDED** — it is free prose, not a categorical value.
4. Normalize each value with `value.strip()`, compare case-insensitively, keep the first-seen original casing for display. Skip `None`/empty.
5. `REPETITION_THRESHOLD = 3` (module-level constant). A value is over-represented when its count is `>= REPETITION_THRESHOLD`.
6. Sort over-represented values by `count` DESC, then `dimension` in the fixed order `geo` before `cause`, then `value` ascending. Take at most **2** (the UI-SPEC's "avoid X · avoid Y" shape).
7. `note = " · ".join(f"avoid {value}" for each)`, or `None` when empty.

### §40.5 — `apps/dispatch-control/lib/repetitionNoteClient.ts` (NEW)

Mirrors `lib/coverageStripClient.ts` line-for-line: a private `pipelineBaseUrl()` reading
`NEXT_PUBLIC_PIPELINE_URL`, a `RepetitionNoteError extends Error` carrying `status`, and:

```typescript
export interface RepetitionAvoidItem { dimension: 'geo' | 'cause'; value: string; count: number }
export interface RepetitionNote { note: string | null; avoid: RepetitionAvoidItem[]; sampleSize: number }
export async function fetchRepetitionNote(token: string | null): Promise<RepetitionNote>
```

### §40.6 — `apps/dispatch-control/lib/derivedState.ts` (NEW — pure TS, no Convex import)

Pure functions over the RESULTS of existing Convex queries. Unit-testable in isolation. Consumed by
the header (40-06), the issue card (40-05), the issue overview (40-09), Phase 41's stage tabs, and
Phase 43's My Tasks. Editorial policy (severity weights, stage rules) lives HERE, never in the backend.

```typescript
export type IssueStatus = 'unknown' | 'draft' | 'needs-review' | 'ready' | 'published' | 'held'
export type StageState  = 'not-generated' | 'in-progress' | 'needs-you' | 'clean'
export type TaskSeverity = 'must-fix' | 'review-recommended' | 'information'

export interface StageStateResult { state: StageState; openCount: number }

export interface DerivedTask {            // DERIVED-STATE-CONTRACT §2 shape — NO tasks table
  id: string
  sev: TaskSeverity
  title: string                           // plain language
  where: string                           // section / area affected
  why: string                             // why human judgment is required
  rec?: string                            // the agent's recommendation, when one exists
  primary: { label: string; href: string }
  insp?: string                           // inspector target (Phase 44 consumes; may be omitted)
  stage: 1 | 2 | 3 | 4 | 5
}

// D-22 — tunable in ONE place.
export const SEVERITY_MINUTES: Record<TaskSeverity, number> = {
  'must-fix': 6,
  'review-recommended': 3,
  'information': 1,
}

/**
 * `undefined` means NOT LOADED (or the query failed). `null` means loaded-and-absent.
 * The distinction is load-bearing: it is what makes ISS-06 structural.
 */
export interface DerivationInputs {
  issueNumber: number | null
  runId: string | null
  issue: { held: boolean; published: boolean } | null | undefined
  signOffs: Record<string, { actorId: string; signedAt: number }> | undefined
  claimRows: Array<{ status: string; sourceUrl?: string; sectionName?: string; claimText?: string; _id: string }> | undefined
  qaFindings: Array<{ _id: string; severity: 'info'|'warning'|'error'; axis?: string; sectionName: string; reason: string; suggestedFix?: string; accepted?: boolean; resolution?: 'accepted'|'dismissed'|null }> | undefined
  pitchRows: Array<{ selected: boolean }> | undefined
  runStatus: string | undefined            // runs.latest.status
}

export function deriveIssueStatus(i: DerivationInputs): IssueStatus
export function deriveStageStates(i: DerivationInputs): [StageStateResult, StageStateResult, StageStateResult, StageStateResult, StageStateResult]
export function deriveTasks(i: DerivationInputs): DerivedTask[]
export function estimateWorkMinutes(tasks: DerivedTask[]): number
```

**`deriveIssueStatus` (D-18 + ISS-06) — exact precedence:**
```
if (issue === undefined || signOffs === undefined) return 'unknown'   // NOT LOADED / FAILED — never a stale value
if (issue === null)                                 return 'unknown'   // no issue row => nothing to state
if (issue.published)                                return 'published'
if (issue.held)                                     return 'held'
factDone  = signOffs['facts-cleared'] !== undefined
voiceDone = signOffs['sounds-human']  !== undefined
if (factDone && voiceDone)                          return 'ready'     // == DERIVED-STATE-CONTRACT §1 `ready`, plus D-15's `&& !held` (held returned above)
if (runId === null)                                 return 'draft'
return 'needs-review'
```
A silently stale "ready" is IMPOSSIBLE: `ready` is recomputed from `sign_offs` on every read, and an
unloaded/failed input yields `'unknown'`, which the UI renders as "State unknown — refresh".

**`deriveStageStates` (D-19 — ARTIFACT-derived, never pipeline-node-derived). Exactly 5 entries:**

| # | Stage | Rule (evaluated top-down; first match wins) |
|---|-------|---------------------------------------------|
| 1 | Story | `runId === null` → not-generated/0 · `pitchRows === undefined` → in-progress/0 · `pitchRows.some(p => p.selected)` → clean/0 · `pitchRows.length > 0` → needs-you/1 (Gate 1 unresolved) · else in-progress/0 |
| 2 | Draft | `runId === null` → not-generated/0 · `qaFindings === undefined \|\| claimRows === undefined` → in-progress/0 · `qaFindings.length === 0 && claimRows.length === 0` → (`runStatus === 'running'` ? in-progress/0 : not-generated/0) · else N = open findings whose axis is NOT in VOICE_AXES (undefined axis counts as factual, per axisPartition.ts's own rule) → N > 0 ? needs-you/N : clean/0 |
| 3 | Fact Check | `runId === null` → not-generated/0 · `claimRows === undefined` → in-progress/0 · `claimRows.length === 0` → not-generated/0 · U = rows with `status === 'pending'` → U > 0 ? needs-you/U : clean/0 |
| 4 | Voice | `runId === null` → not-generated/0 · `qaFindings === undefined \|\| signOffs === undefined` → in-progress/0 · V = open findings whose axis IS in VOICE_AXES → V > 0 ? needs-you/V : (`signOffs['sounds-human']` ? clean/0 : (`runStatus === 'running'` ? in-progress/0 : needs-you/1)) |
| 5 | Approval | `issue?.published` → clean/0 · `runId === null` → not-generated/0 · `signOffs === undefined` → in-progress/0 · factDone && voiceDone → needs-you/1 · else in-progress/0 |

**"Open" finding = `isOpenFinding(row)` from `lib/galley/findingState.ts` — the ONE shared predicate. Do not re-derive it inline.**

**A completed run with zero checked claims MUST show Fact Check as `needs-you`, never `clean` (D-19's explicit warning).** Stage 3 reads `claim_checks` rows only; it never reads `runStatus`.

**`deriveTasks` (D-21 — the REAL projection Phase 43 renders as a screen):**
- one task per open `qaFindings` row: `sev` = `error → 'must-fix'`, `warning → 'review-recommended'`, `info → 'information'`; `stage` = 4 when `axis ∈ VOICE_AXES` else 2; `where` = `sectionName`; `why` = `reason`; `rec` = `suggestedFix`; `primary.href` = `issueVoiceHref(n)` for stage 4 else `issueReviewHref(n)`.
- one task per `claimRows` row with `status === 'pending'`: `sev` = `'must-fix'` when `sourceUrl` is absent (an unsourced claim blocks) else `'review-recommended'`; `stage` = 3; `title` = `Check claim: {claimText truncated to 60 chars}`; `primary.href` = `issueReviewHref(n)`.
- one task when `runId !== null && runStatus !== 'running' && !signOffs['facts-cleared']`: `sev:'must-fix'`, `stage:5`, `title:'Clear the facts'`.
- one task when `runId !== null && runStatus !== 'running' && !signOffs['sounds-human']`: `sev:'must-fix'`, `stage:5`, `title:'Approve the voice'`.
- returns `[]` when `runId === null`. Sorted `must-fix` → `review-recommended` → `information`, then by `stage` ascending.
- **`deriveTasks(...).length` IS the header's My Tasks count and IS the card's open-task count.** A count-only shim is forbidden (a header saying 3 next to a list of 2).

**`estimateWorkMinutes`** = `tasks.reduce((sum, t) => sum + SEVERITY_MINUTES[t.sev], 0)`. Rendered `~{n} min` (ISS-01). `0` renders as `~0 min`, never blank.

### §40.7 — `apps/dispatch-control/lib/issueRouteResolver.ts` (NEW — pure TS)

```typescript
export function parseIssueNumber(param: string): number | null
  // Strict: /^[0-9]+$/ AND > 0. Rejects '', '-1', '1.5', '07x', 'abc', ' 7 '. Leading zeros ARE
  // accepted ('07' → 7) since Sanity's slug is issue-{n} and operators say "Issue 07".
export function issueHref(issueNumber: number): string        // `/issues/${n}`
export function issueReviewHref(issueNumber: number): string  // `/issues/${n}/review`
export function issueVoiceHref(issueNumber: number): string   // `/issues/${n}/voice`
export function issueRunHref(issueNumber: number, runId: string): string
                                                              // `/issues/${n}/runs/${encodeURIComponent(runId)}`
export function legacyRedirectTarget(surface: 'review' | 'voice', issueNumber: number | null | undefined): string
  // issueNumber resolved  → issueReviewHref(n) / issueVoiceHref(n)
  // issueNumber null/undefined (run has no issue row / unknown runId) → '/issues'
  // NEVER returns a run-keyed URL — that would redirect-loop.
```

### §40.8 — Console route tree (NEW — Next.js dashboard, issue-keyed)

| Console route | Purpose | Notes |
|---|---|---|
| `/issues` | Issues home (ISS-01/03/04/06) | new nav destination |
| `/issues/[issueNumber]` | Issue overview (D-09) | **Phase 41 replaces its CONTENTS at this same URL** — the URL never moves |
| `/issues/[issueNumber]/review` | thin issue→run translation around the already-shipped Review Desk screen (D-07) | internals NOT rewritten |
| `/issues/[issueNumber]/voice` | thin issue→run translation around the already-shipped Voice Pass screen (D-07) | internals NOT rewritten |
| `/issues/[issueNumber]/runs/[runId]` | a run as a HISTORICAL RECORD under its issue (D-08) | ISS-02 |

Legacy run-keyed console URLs redirect (dynamic — a Convex lookup maps `runId → issueNumber`, so this
can NEVER be a `next.config` rewrite):

| Old console URL | Redirects to |
|---|---|
| `/review-desk/[runId]` | `/issues/{n}/review` (or `/issues` when unresolvable) |
| `/voice-pass/[runId]` | `/issues/{n}/voice` (or `/issues` when unresolvable) |
| `/review-desk` | `/issues` |
| `/voice-pass` | `/issues` |
| `/` (dashboard index) | `/issues` |

`/run-monitor/**` and `/signal-desk` are UNCHANGED and remain functional. Run Monitor survives as a
nav item under **System Workbench** (D-08) — ISS-02's "never a top-level nav destination" means a run
stops being the *editorial* object, not that it becomes unreachable.

### §40.9 — `NAV_GROUPS` restructure (`apps/dispatch-control/lib/nav.ts`)

```typescript
Editorial        → Issues (/issues)                                      // My Tasks joins in Phase 43; Workspace in Phase 41
System Workbench → Run Monitor (/run-monitor) · Prompt Lab (/prompt-lab)
                   · Eval Center (/eval-center) · Registry (/registry)
Operations       → Config (/config) · Finance (/finance) · Settings (/settings)
```
`Review Desk`, `Signal Desk`, and `Voice Pass` LEAVE the nav — they are issue sub-routes now. Their
labels are unchanged elsewhere; the nomenclature pass (Run Monitor → Run Details, Registry →
Editorial Memory) is Phase 50.
  </action>

  <verify>
    <automated>test $(grep -c "^## §40 — Issue Entity &amp; Issues Home (Phase 40)" docs/API_CONTRACTS.md) -eq 1 &amp;&amp; for s in 40.1 40.2 40.3 40.4 40.5 40.6 40.7 40.8 40.9; do grep -q "### §$s" docs/API_CONTRACTS.md || { echo "MISSING §$s"; exit 1; }; done &amp;&amp; grep -q "SEVERITY_MINUTES" docs/API_CONTRACTS.md &amp;&amp; grep -q "REPETITION_THRESHOLD = 3" docs/API_CONTRACTS.md &amp;&amp; grep -q "ensureByNumber" docs/API_CONTRACTS.md &amp;&amp; echo CONTRACT-OK
</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "^## §40 — Issue Entity & Issues Home (Phase 40)" docs/API_CONTRACTS.md` returns 1
    - All nine subsection headings `### §40.1` through `### §40.9` are present
    - `grep -q "by_workspace_issueNumber" docs/API_CONTRACTS.md` succeeds
    - `grep -q "ensureByNumber" docs/API_CONTRACTS.md` succeeds
    - `grep -q "REPETITION_THRESHOLD = 3" docs/API_CONTRACTS.md` succeeds
    - `grep -q "SEVERITY_MINUTES" docs/API_CONTRACTS.md` succeeds
    - `grep -q "GET /registry/repetition-note" docs/API_CONTRACTS.md` succeeds
    - `grep -q "issueRouteResolver" docs/API_CONTRACTS.md` succeeds
    - §40 contains the literal strings `'unknown'`, `'not-generated'`, `'must-fix'`, and `legacyRedirectTarget`
    - §40 contains the naming-trap paragraph (grep for `name only` succeeds)
    - No file other than `docs/API_CONTRACTS.md` is modified by this task
  </acceptance_criteria>

  <done>docs/API_CONTRACTS.md ends with a complete §40 (nine subsections) fixing every shape Plans 40-02..40-09 implement. No implementation code exists yet.</done>
</task>

<task type="auto">
  <name>Task 2: Wave 0 dashboard test scaffolds + vitest edge-runtime entry</name>

  <read_first>
    - apps/dispatch-control/vitest.config.ts (the `environmentMatchGlobs` array — a new convex-test file NOT listed here silently fails with an environment error, not an assertion failure; Pitfall 3)
    - apps/dispatch-control/__tests__/evalScores.test.ts (the convex-test + edge-runtime precedent — copy its `convexTest(schema)` bootstrap, its `t.withIdentity(...)` operator-lane pattern, and its pipeline-secret lane pattern verbatim)
    - apps/dispatch-control/__tests__/Masthead.test.tsx (the jsdom component-test precedent — copy its `vi.mock('convex/react')` + query-reference-dispatch mock; a positional `mockReturnValueOnce` sequence is explicitly NOT the pattern)
    - apps/dispatch-control/__tests__/nav.test.ts (existing — do NOT modify it here; Plan 40-08 extends it)
    - docs/API_CONTRACTS.md §40 (written in Task 1 — every assertion below matches those shapes exactly)
    - apps/dispatch-control/lib/galley/findingState.ts and lib/galley/axisPartition.ts (the open-finding predicate and axis sets derivedState depends on)
  </read_first>

  <action>
**Step A — vitest.config.ts.** Add exactly one entry to `environmentMatchGlobs`, immediately after the Phase 39 `charityCorrections` line, with a matching comment:
```typescript
      // Phase 40 Plan 40-01 issues-table convex-test file
      ['__tests__/issues.test.ts', 'edge-runtime'],
```
Do NOT add a jsdom entry for the three new `.tsx` files — the existing `['__tests__/*.test.tsx', 'jsdom']` glob already covers them.

**Step B — write six RED test files.** Each must fail because the module under test does not exist yet (module-not-found) or its assertions are unmet — NOT because of a config/environment error. Every automated verify command in Plans 40-02..40-09 points at one of these files.

1. `__tests__/issues.test.ts` (convex-test, edge-runtime) — imports `schema from '@convex/schema'` and `api from '@convex/_generated/api'`. Cases:
   - `ensureByNumber` inserts a row with `held: false, published: false` and returns `{ created: true }`.
   - `ensureByNumber` called twice with the same `issueNumber` returns `{ created: false }` the second time and leaves exactly ONE row (`listForWorkspace().length === 1`).
   - **D-04 guard:** hold an issue, then call `ensureByNumber` again for the same number — assert `byIssueNumber(...).held` is STILL `true` and `heldReason` unchanged.
   - `hold` with `reason: '   '` → `await expect(...).rejects.toThrow(/reason is required/i)`.
   - `hold` with a real reason sets `held: true`, `heldReason`, `heldBy` = identity subject, `heldAt > 0`, AND writes an `audit_log` row with `action: 'issue.held'`, `resourceId: '7'` (query `api.auditLog.listForWorkspace`).
   - `reopen` clears `held`, `heldReason`, `heldBy`, `heldAt` and writes `action: 'issue.reopened'`.
   - `hold` with no Clerk identity throws `Unauthorized` (call without `t.withIdentity`).
   - `markPublished` sets `published: true` + `publishedAt`.

2. `__tests__/derivedState.test.ts` (node env — NO Convex import) — imports from `../lib/derivedState`. Over hand-constructed plain objects:
   - **ISS-06:** `deriveIssueStatus({ ...i, issue: undefined })` === `'unknown'`; `deriveIssueStatus({ ...i, signOffs: undefined })` === `'unknown'`; assert NOT `'ready'` and NOT `'draft'` in both.
   - `published: true` → `'published'` (even when `held` is also true).
   - `held: true` → `'held'` (even with both sign-offs present — held blocks ready, D-15).
   - both sign-offs, not held, not published → `'ready'`.
   - no sign-offs, `runId: null` → `'draft'`; no sign-offs, `runId: 'r1'` → `'needs-review'`.
   - **name this test exactly `completed run with zero checked claims is NOT clean` (D-19):** `runStatus:'complete'`, `claimRows:[{status:'pending'},{status:'pending'}]` → `deriveStageStates(...)[2]` equals `{ state:'needs-you', openCount:2 }`.
   - `claimRows: []` → stage 3 is `{ state:'not-generated', openCount:0 }` (never `clean`).
   - stage 2 counts only NON-voice open findings; stage 4 counts only voice-axis open findings — feed a mixed array, assert the two counts partition it.
   - a finding with `resolution:'dismissed'` and one with `accepted:true` are BOTH excluded from every count.
   - `deriveTasks` returns `[]` when `runId === null`.
   - `deriveTasks` length equals (open findings)+(pending claims)+(missing sign-offs on a non-running run) for a fixture — assert the exact number.
   - a pending claim with NO `sourceUrl` is `'must-fix'`; with `sourceUrl` it is `'review-recommended'`.
   - `estimateWorkMinutes([must-fix, review-recommended, information])` === `10`.
   - `SEVERITY_MINUTES` exported with exactly three keys.

3. `__tests__/issueRouteResolver.test.ts` (node env) — imports from `../lib/issueRouteResolver`:
   - `parseIssueNumber('7')===7`; `parseIssueNumber('07')===7`.
   - `parseIssueNumber` of `''`,`'abc'`,`'-1'`,`'1.5'`,`'07x'`,`' 7 '` all `=== null`.
   - `issueHref(7)==='/issues/7'`; `issueReviewHref(7)==='/issues/7/review'`; `issueVoiceHref(7)==='/issues/7/voice'`.
   - `issueRunHref(7,'a b/c')==='/issues/7/runs/a%20b%2Fc'`.
   - `legacyRedirectTarget('review',7)==='/issues/7/review'`; `legacyRedirectTarget('voice',7)==='/issues/7/voice'`.
   - `legacyRedirectTarget('review',null)==='/issues'` and `(...,undefined)==='/issues'`; assert neither result contains `'review-desk'`.

4. `__tests__/IssueCard.test.tsx` (jsdom) — imports `IssueCard from '../app/(dashboard)/issues/_components/IssueCard'`. IssueCard takes DERIVED values as props (pure presentational — no Convex mock needed):
   - renders 5 stage segments (`getAllByTestId('stage-segment')` length 5).
   - renders every ISS-01 readout: status label, open-task count, `checked X of Y` claim coverage, voice state, `~12 min`, `$`-prefixed run cost.
   - **ISS-06:** with `state={{ kind:'error' }}` shows exact text `State unknown — refresh` AND `queryByText(/ready/i)` is null AND `queryByText(/clean/i)` is null.
   - **ISS-06:** with `status='unknown'` in the loaded state ALSO shows `State unknown — refresh`.
   - with `state={{ kind:'loading' }}` renders a skeleton still containing 5 stage segments (geometry preserved).
   - each stage segment carries a text label from `Not generated | In progress | Needs you | Clean` (never color alone).

5. `__tests__/ScheduledSlotCard.test.tsx` (jsdom) — imports `ScheduledSlotCard from '../app/(dashboard)/issues/_components/ScheduledSlotCard'`. `vi.mock('@/lib/pipelineControlClient')` with a `triggerRun` spy; `vi.mock('@clerk/nextjs')` with `useAuth` → `{ getToken: async () => 'tok' }`:
   - renders `Start #8 early` when `issueNumber={8}`.
   - renders `avoid US-SE · avoid weather` when `note="avoid US-SE · avoid weather"`.
   - renders no `avoid`-shaped text and no empty placeholder chip when `note={null}`.
   - **ISS-03:** clicking `Start #8 early` calls `triggerRun` once — `expect(triggerRun).toHaveBeenCalledWith(expect.objectContaining({ issueNumber: 8 }), 'tok')`.

6. `__tests__/HoldDialog.test.tsx` (jsdom) — imports `HoldDialog from '../app/(dashboard)/issues/_components/HoldDialog'`:
   - reason textarea present with placeholder `Why are you holding Issue 7?`.
   - checkbox `Also stop the run in progress` CHECKED by default (D-14).
   - empty-reason submit renders `A reason is required to hold this issue.` and calls neither `onHold` nor `onCancel`.
   - reason submit calls `onHold` once with `{ reason: '<text>', stopRun: true }`.
   - unchecking then submitting calls `onHold` with `stopRun: false`.
   - confirm button reads `Hold issue`, cancel reads `Cancel`.

Use `describe`/`it`/`expect` from `vitest` explicitly (`globals: false`). Use `@testing-library/react` `render`/`screen`/`cleanup` with `afterEach(cleanup)`, matching existing component tests.
  </action>

  <verify>
    <automated>cd apps/dispatch-control && grep -q "__tests__/issues.test.ts', 'edge-runtime'" vitest.config.ts && for f in issues.test.ts derivedState.test.ts issueRouteResolver.test.ts IssueCard.test.tsx ScheduledSlotCard.test.tsx HoldDialog.test.tsx; do test -f "__tests__/$f" || { echo "MISSING $f"; exit 1; }; done && echo SCAFFOLD-OK</automated>
  </verify>

  <acceptance_criteria>
    - `grep -q "__tests__/issues.test.ts', 'edge-runtime'" apps/dispatch-control/vitest.config.ts` succeeds
    - All six files exist under `apps/dispatch-control/__tests__/`
    - `apps/dispatch-control/__tests__/derivedState.test.ts` contains the test name `completed run with zero checked claims is NOT clean`
    - `apps/dispatch-control/__tests__/IssueCard.test.tsx` contains the literal `State unknown — refresh`
    - `apps/dispatch-control/__tests__/HoldDialog.test.tsx` contains the literal `A reason is required to hold this issue.`
    - Running `pnpm --filter dispatch-control test -- __tests__/derivedState.test.ts` exits NON-zero (RED — module not implemented yet)
    - `apps/dispatch-control/__tests__/nav.test.ts` is unchanged (git diff shows no change to it)
  </acceptance_criteria>

  <done>Six RED dashboard test files exist, the edge-runtime entry is present, and each test fails for a not-yet-implemented reason rather than an environment error.</done>
</task>

<task type="auto">
  <name>Task 3: Wave 0 pipeline repetition-note test scaffold</name>

  <read_first>
    - packages/pipeline/tests/test_registry_coverage.py (the exact precedent — copy its `_make_client()` FastAPI TestClient bootstrap, its `monkeypatch.setattr(_cc, "convex_query", AsyncMock(...))`, its `patch.object(_sc, "groq_query", autospec=True)`, and its `pytestmark = pytest.mark.anyio`)
    - packages/pipeline/src/eisenbalm_pipeline/api/registry.py (the router the new endpoint is added to)
    - docs/API_CONTRACTS.md §40.4 (written in Task 1 — the exact response shape and threshold this test asserts)
  </read_first>

  <action>
Create `packages/pipeline/tests/test_repetition_note.py`, structurally identical to `test_registry_coverage.py` (same imports, same `_make_client()` that mounts `registry.router`, same mock patching of `_cc.convex_query` and `_sc.groq_query`). It targets `GET /registry/repetition-note` (§40.4).

Cases:
- **over-represented geo + cause:** Convex returns 8 featured rows all with a `sanityCharityId`; the Sanity join returns rows where `location` is `"US-SE"` on ≥3 of them and `focusArea` is `"weather"` on ≥3. Assert `resp.status_code == 200`, `data["note"] == "avoid US-SE · avoid weather"`, `data["sampleSize"] == 8`, and `data["avoid"]` contains both `{dimension:"geo", value:"US-SE"}` and `{dimension:"cause", value:"weather"}` each with `count >= 3`. Assert `geo` sorts before `cause`.
- **nothing over-represented:** every location/focusArea distinct (each count 1) → `data["note"] is None` and `data["avoid"] == []`.
- **threshold boundary:** a value appearing exactly twice is NOT in `avoid` (REPETITION_THRESHOLD == 3); a value appearing exactly three times IS.
- **signal excluded:** even if `scoutNotes` is identical across all 8 rows, it never appears in `avoid` (only `cause`/`geo` are counted).
- **at most two:** if THREE dimensions/values each exceed the threshold, `data["avoid"]` has at most 2 entries and `note` has at most two `avoid X` clauses.
- Use `autospec=True` on the `groq_query` patch so a wrong-arity call fails loudly (the coverage test's stated rationale).

Confirm the pipeline test command is `cd packages/pipeline && uv run pytest tests/test_repetition_note.py` (mirror the coverage test's invocation).
  </action>

  <verify>
    <automated>test -f packages/pipeline/tests/test_repetition_note.py && grep -q "repetition-note" packages/pipeline/tests/test_repetition_note.py && grep -q "avoid US-SE" packages/pipeline/tests/test_repetition_note.py && echo PIPELINE-SCAFFOLD-OK</automated>
  </verify>

  <acceptance_criteria>
    - `packages/pipeline/tests/test_repetition_note.py` exists
    - It references the path `/registry/repetition-note`
    - It asserts `note == "avoid US-SE · avoid weather"` for the over-represented fixture
    - It asserts the threshold-boundary behavior (2 → excluded, 3 → included)
    - It patches `groq_query` with `autospec=True`
    - `cd packages/pipeline && uv run pytest tests/test_repetition_note.py` exits NON-zero (RED — endpoint not implemented yet)
  </acceptance_criteria>

  <done>The pipeline repetition-note test exists and fails RED because `GET /registry/repetition-note` does not exist yet.</done>
</task>

</tasks>

<verification>
- `grep -c "^## §40" docs/API_CONTRACTS.md` returns 1 and all nine `### §40.x` subsections are present.
- All seven test files exist; the edge-runtime entry is present in `vitest.config.ts`.
- `pnpm --filter dispatch-control test -- __tests__/derivedState.test.ts` is RED (implementation absent).
- `cd packages/pipeline && uv run pytest tests/test_repetition_note.py` is RED (endpoint absent).
- No implementation code (no `convex/issues.ts`, no `lib/derivedState.ts`, no route files, no endpoint) is created by this plan.
</verification>

<success_criteria>
- docs/API_CONTRACTS.md §40 is the complete, single authority for every shape Plans 40-02..40-09 implement.
- Every requirement (ISS-01..ISS-06) has at least one RED test on disk pointing at the not-yet-written implementation.
- The vitest edge-runtime mapping and the pipeline pytest scaffold are in place so no downstream task hits an environment misconfiguration.
</success_criteria>

<output>
After completion, create `.planning/phases/40-issue-entity-issues-home/40-01-SUMMARY.md`.
</output>
