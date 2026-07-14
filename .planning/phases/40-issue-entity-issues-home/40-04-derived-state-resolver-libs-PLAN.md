---
phase: 40-issue-entity-issues-home
plan: 04
type: execute
wave: 2
depends_on: ["40-01"]
files_modified:
  - apps/dispatch-control/lib/derivedState.ts
  - apps/dispatch-control/lib/issueRouteResolver.ts
  - apps/dispatch-control/lib/repetitionNoteClient.ts
autonomous: true
requirements: [ISS-01, ISS-06, ISS-02, ISS-03]

must_haves:
  truths:
    - "Issue status, stage states, the task projection, and estimated work are computed by pure functions over existing-query results — the same module the header, the card, Phase 41's tabs, and Phase 43's My Tasks all consume"
    - "A not-loaded / failed input yields status 'unknown' (never a stale 'ready') — ISS-06 is structural, not a special-case error handler"
    - "issueNumber↔URL translation is a pure, tested resolver; the legacy redirect target never returns a run-keyed URL"
  artifacts:
    - path: "apps/dispatch-control/lib/derivedState.ts"
      provides: "deriveIssueStatus, deriveStageStates, deriveTasks, estimateWorkMinutes, SEVERITY_MINUTES"
      exports: ["deriveIssueStatus", "deriveStageStates", "deriveTasks", "estimateWorkMinutes", "SEVERITY_MINUTES"]
    - path: "apps/dispatch-control/lib/issueRouteResolver.ts"
      provides: "parseIssueNumber + href builders + legacyRedirectTarget"
      exports: ["parseIssueNumber", "issueHref", "issueReviewHref", "issueVoiceHref", "issueRunHref", "legacyRedirectTarget"]
    - path: "apps/dispatch-control/lib/repetitionNoteClient.ts"
      provides: "fetchRepetitionNote client for GET /registry/repetition-note"
      exports: ["fetchRepetitionNote"]
  key_links:
    - from: "apps/dispatch-control/lib/derivedState.ts"
      to: "apps/dispatch-control/lib/galley/findingState.ts"
      via: "isOpenFinding — the one shared open-finding predicate"
      pattern: "isOpenFinding"
    - from: "apps/dispatch-control/lib/derivedState.ts deriveTasks"
      to: "apps/dispatch-control/lib/issueRouteResolver.ts"
      via: "issueReviewHref / issueVoiceHref for task primary hrefs"
      pattern: "issue(Review|Voice)Href"
---

<objective>
Build the three pure-TS library modules Phase 40's UI sits on: the derived-state selector (D-18..D-23), the route resolver (D-06/D-07), and the repetition-note fetch client (D-10). All three are pure/fetch-only — no Convex import — so they unit-test in isolation and run parallel with the Convex and pipeline plans.

Purpose: Editorial policy (severity weights, stage rules, status precedence) lives client-side in ONE module (Phase 32/37 precedent) so the header, the card, Phase 41's tabs, and Phase 43's My Tasks all consume the same truth. ISS-06 becomes structural: an unloaded input can only produce `'unknown'`.
Output: `lib/derivedState.ts`, `lib/issueRouteResolver.ts`, `lib/repetitionNoteClient.ts`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@.planning/phases/40-issue-entity-issues-home/40-UI-SPEC.md

<interfaces>
§40.5 / §40.6 / §40.7 in docs/API_CONTRACTS.md are BINDING — implement every signature, type literal, precedence rule, and stage-table row verbatim.

Reuse (do NOT re-derive):
```typescript
// apps/dispatch-control/lib/galley/findingState.ts
export function isOpenFinding(row: { accepted?: boolean; resolution?: 'accepted'|'dismissed'|null }): boolean
// apps/dispatch-control/lib/galley/axisPartition.ts
export const VOICE_AXES: ReadonlySet<string>   // gravity, sentiment, irony-signaling, machine-tell
```

Mirror (line-for-line) for the fetch client:
```typescript
// apps/dispatch-control/lib/coverageStripClient.ts — private pipelineBaseUrl() reading
// NEXT_PUBLIC_PIPELINE_URL, a typed *Error extends Error carrying `status`, a GET with a Bearer token.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: lib/derivedState.ts — the pure selector module (ISS-01/ISS-06)</name>

  <behavior>
    - deriveIssueStatus returns 'unknown' when `issue` OR `signOffs` is `undefined` (not-loaded/failed) — never a stale 'ready'
    - deriveIssueStatus precedence: published → held → (factDone && voiceDone) 'ready' → (runId===null) 'draft' → 'needs-review'
    - deriveStageStates returns exactly 5 artifact-derived StageStateResult entries; stage 3 with pending claims on a COMPLETE run is 'needs-you', never 'clean'
    - stage 2 counts only non-voice open findings; stage 4 counts only voice-axis open findings; both use isOpenFinding
    - deriveTasks returns [] for runId===null; length = open findings + pending claims + missing sign-offs (non-running); unsourced pending claim is 'must-fix'
    - estimateWorkMinutes sums SEVERITY_MINUTES; [must-fix, review-recommended, information] → 10
  </behavior>

  <read_first>
    - docs/API_CONTRACTS.md §40.6 (the exact `deriveIssueStatus` precedence pseudo-code, the 5-row `deriveStageStates` table, the `deriveTasks` bullet rules, `SEVERITY_MINUTES`, and the `DerivationInputs` shape — copy verbatim)
    - apps/dispatch-control/lib/galley/findingState.ts (isOpenFinding — the ONE shared predicate; do not re-derive `accepted !== true` inline)
    - apps/dispatch-control/lib/galley/axisPartition.ts (VOICE_AXES — the voice/factual partition; an undefined axis counts as factual)
    - apps/dispatch-control/__tests__/derivedState.test.ts (the RED spec from 40-01 — every case must pass, including the test named `completed run with zero checked claims is NOT clean`)
    - apps/dispatch-control/lib/issueRouteResolver.ts (created in Task 2 of THIS plan — deriveTasks imports issueReviewHref/issueVoiceHref for task primary hrefs; do Task 2 first or in the same pass)
  </read_first>

  <action>
Create `apps/dispatch-control/lib/derivedState.ts` implementing §40.6 EXACTLY. No Convex import; import only `isOpenFinding` from `./galley/findingState`, `VOICE_AXES` from `./galley/axisPartition`, and `issueReviewHref`/`issueVoiceHref` from `./issueRouteResolver`.

Export the types (`IssueStatus`, `StageState`, `TaskSeverity`, `StageStateResult`, `DerivedTask`, `DerivationInputs`) and the constant `SEVERITY_MINUTES = { 'must-fix': 6, 'review-recommended': 3, 'information': 1 }` verbatim from §40.6.

`deriveIssueStatus(i)` — implement the exact precedence from §40.6:
```
if (i.issue === undefined || i.signOffs === undefined) return 'unknown'
if (i.issue === null) return 'unknown'
if (i.issue.published) return 'published'
if (i.issue.held) return 'held'
const factDone = i.signOffs['facts-cleared'] !== undefined
const voiceDone = i.signOffs['sounds-human'] !== undefined
if (factDone && voiceDone) return 'ready'
if (i.runId === null) return 'draft'
return 'needs-review'
```

`deriveStageStates(i)` — return a 5-tuple following the §40.6 table top-down (first match wins) for Story / Draft / Fact Check / Voice / Approval. Use `isOpenFinding` for every "open finding" test. For the factual/voice split: an open finding counts toward Draft (stage 2) when `!VOICE_AXES.has(row.axis ?? '')` and toward Voice (stage 4) when `VOICE_AXES.has(row.axis ?? '')`. **Stage 3 (Fact Check) reads only `claimRows` — it MUST NOT read `runStatus`** (D-19: a completed run with zero checked claims shows Fact Check as needs-you, never clean).

`deriveTasks(i)` — build the `DerivedTask[]` per the §40.6 bullets:
- open qaFindings → sev by severity (`error`→must-fix, `warning`→review-recommended, `info`→information), stage 4 if voice-axis else 2, `where=sectionName`, `why=reason`, `rec=suggestedFix`, `primary.href = stage===4 ? issueVoiceHref(n) : issueReviewHref(n)` where `n = i.issueNumber`.
- pending claimRows → sev `must-fix` if no `sourceUrl` else `review-recommended`, stage 3, `title='Check claim: '+ (claimText ?? '').slice(0,60)`, `primary.href=issueReviewHref(n)`.
- missing `facts-cleared` on `runId!==null && runStatus!=='running'` → must-fix, stage 5, `title='Clear the facts'`.
- missing `sounds-human` same condition → must-fix, stage 5, `title='Approve the voice'`.
- `[]` when `runId===null`. Sort must-fix → review-recommended → information, then stage ascending. `id` = a stable string per source row (`qa-<_id>`, `claim-<_id>`, `signoff-facts`, `signoff-voice`).

`estimateWorkMinutes(tasks)` = `tasks.reduce((s, t) => s + SEVERITY_MINUTES[t.sev], 0)`.

If `i.issueNumber === null`, task hrefs fall back to `'/issues'` (guard `n` before calling the href builders).
  </action>

  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/derivedState.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `apps/dispatch-control/lib/derivedState.ts` exports `deriveIssueStatus`, `deriveStageStates`, `deriveTasks`, `estimateWorkMinutes`, `SEVERITY_MINUTES`, and the six types
    - `grep -q "isOpenFinding" apps/dispatch-control/lib/derivedState.ts` succeeds (no inline `accepted !== true`)
    - `grep -q "VOICE_AXES" apps/dispatch-control/lib/derivedState.ts` succeeds
    - `deriveStageStates` does NOT reference `runStatus` inside the Fact-Check (stage 3) branch
    - `pnpm --filter dispatch-control test -- __tests__/derivedState.test.ts` exits 0 (was RED in 40-01)
  </acceptance_criteria>

  <done>The selector module passes its 40-01 spec, including the ISS-06 unknown-on-unloaded and the D-19 zero-checked-claims cases.</done>
</task>

<task type="auto">
  <name>Task 2: lib/issueRouteResolver.ts — issueNumber↔URL translation (ISS-02)</name>

  <read_first>
    - docs/API_CONTRACTS.md §40.7 (the six function signatures + strict parse rules + the legacy-redirect-never-run-keyed rule)
    - apps/dispatch-control/__tests__/issueRouteResolver.test.ts (the RED spec from 40-01)
  </read_first>

  <action>
Create `apps/dispatch-control/lib/issueRouteResolver.ts` implementing §40.7 EXACTLY:
- `parseIssueNumber(param)` — return `Number(param)` only when `/^[0-9]+$/.test(param)` AND the result `> 0`; else `null`. (Leading zeros accepted: `'07'`→7. `''`, `'abc'`, `'-1'`, `'1.5'`, `'07x'`, `' 7 '` → null.)
- `issueHref(n)` → `` `/issues/${n}` ``; `issueReviewHref(n)` → `` `/issues/${n}/review` ``; `issueVoiceHref(n)` → `` `/issues/${n}/voice` ``.
- `issueRunHref(n, runId)` → `` `/issues/${n}/runs/${encodeURIComponent(runId)}` ``.
- `legacyRedirectTarget(surface, issueNumber)` — when `issueNumber` is a number → `surface==='review' ? issueReviewHref(n) : issueVoiceHref(n)`; when `null`/`undefined` → `'/issues'`. NEVER return a `review-desk`/`voice-pass` URL (would redirect-loop).

Pure module — no imports beyond what the functions need (none).
  </action>

  <verify>
    <automated>cd apps/dispatch-control && pnpm vitest run __tests__/issueRouteResolver.test.ts</automated>
  </verify>

  <acceptance_criteria>
    - `apps/dispatch-control/lib/issueRouteResolver.ts` exports `parseIssueNumber`, `issueHref`, `issueReviewHref`, `issueVoiceHref`, `issueRunHref`, `legacyRedirectTarget`
    - `grep -q "encodeURIComponent" apps/dispatch-control/lib/issueRouteResolver.ts` succeeds (runId encoding)
    - `legacyRedirectTarget` returns `'/issues'` for null/undefined and never a string containing `review-desk` or `voice-pass`
    - `pnpm --filter dispatch-control test -- __tests__/issueRouteResolver.test.ts` exits 0 (was RED in 40-01)
  </acceptance_criteria>

  <done>The resolver passes its 40-01 spec; deriveTasks (Task 1) and the routing plan (40-06) both build on it.</done>
</task>

<task type="auto">
  <name>Task 3: lib/repetitionNoteClient.ts — the repetition-note fetch client (ISS-03)</name>

  <read_first>
    - apps/dispatch-control/lib/coverageStripClient.ts (the whole file — copy its `pipelineBaseUrl()`, its `CoverageStripError extends Error`, its Bearer-token GET, its non-2xx error surfacing; the new client is the same shape against a different route)
    - docs/API_CONTRACTS.md §40.5 (the `RepetitionNote` / `RepetitionAvoidItem` interfaces + `fetchRepetitionNote` signature)
  </read_first>

  <action>
Create `apps/dispatch-control/lib/repetitionNoteClient.ts`, mirroring `coverageStripClient.ts`:
- private `pipelineBaseUrl()` reading `NEXT_PUBLIC_PIPELINE_URL` (throw if unset, strip trailing slash) — its own private copy, per the existing per-client convention.
- `export class RepetitionNoteError extends Error { constructor(public readonly status: number, message: string) { ... this.name = 'RepetitionNoteError' } }`.
- `export interface RepetitionAvoidItem { dimension: 'geo' | 'cause'; value: string; count: number }`.
- `export interface RepetitionNote { note: string | null; avoid: RepetitionAvoidItem[]; sampleSize: number }`.
- `export async function fetchRepetitionNote(token: string | null): Promise<RepetitionNote>` — `GET ${pipelineBaseUrl()}/registry/repetition-note` with `Authorization: Bearer ${token}` when token present; on non-2xx throw `RepetitionNoteError(res.status, <body text or HTTP N>)`; else return the parsed JSON.
- A file-header comment noting this app NEVER imports the Sanity SDK (EDT-05) — the endpoint does the Convex→Sanity join server-side (same note coverageStripClient carries).
  </action>

  <verify>
    <automated>cd apps/dispatch-control && grep -q "export async function fetchRepetitionNote" lib/repetitionNoteClient.ts && grep -q "/registry/repetition-note" lib/repetitionNoteClient.ts && grep -q "RepetitionNoteError" lib/repetitionNoteClient.ts && pnpm exec tsc --noEmit -p tsconfig.json 2>/dev/null | grep -c "repetitionNoteClient" | grep -q "^0$"
</automated>
  </verify>

  <acceptance_criteria>
    - `apps/dispatch-control/lib/repetitionNoteClient.ts` exports `fetchRepetitionNote`, `RepetitionNoteError`, `RepetitionNote`, `RepetitionAvoidItem`
    - It GETs `/registry/repetition-note` with an optional Bearer token, mirroring `coverageStripClient.ts`
    - It imports NO Sanity SDK (`grep -q "@sanity" apps/dispatch-control/lib/repetitionNoteClient.ts` returns nothing)
    - `pnpm --filter dispatch-control exec tsc --noEmit` reports no error originating in `repetitionNoteClient.ts`
  </acceptance_criteria>

  <done>The repetition-note client exists and type-checks; the Issues home (40-05) consumes it for the scheduled-slot readout.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- __tests__/derivedState.test.ts` is GREEN (ISS-01/ISS-06 selector).
- `pnpm --filter dispatch-control test -- __tests__/issueRouteResolver.test.ts` is GREEN (ISS-02 resolver).
- `pnpm --filter dispatch-control exec tsc --noEmit` has no error in any of the three new lib files.
- None of the three modules imports `convex/react`, `@convex/_generated`, or `@sanity/*` (they are pure/fetch-only).
</verification>

<success_criteria>
- The derived-state selector, route resolver, and repetition-note client all exist, are unit-tested GREEN, and expose exactly the §40.5/§40.6/§40.7 signatures the header, card, overview, Phase 41 tabs, and Phase 43 My Tasks consume.
- ISS-06 is structural: `deriveIssueStatus` returns `'unknown'` on any unloaded/failed input.
</success_criteria>

<output>
After completion, create `.planning/phases/40-issue-entity-issues-home/40-04-SUMMARY.md`.
</output>
