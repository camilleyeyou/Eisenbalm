---
phase: quick-260730-ldn
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [RUN-01, RUN-02, RUN-03, RUN-04, RUN-05, RUN-06]

files_modified:
  - convex/issues.ts
  - apps/dispatch-control/lib/issueTitle.ts
  - apps/dispatch-control/lib/currentRun.ts
  - apps/dispatch-control/lib/useCurrentRun.ts
  - apps/dispatch-control/lib/runSections.ts
  - apps/dispatch-control/components/Masthead.tsx
  - apps/dispatch-control/app/(dashboard)/run/page.tsx
  - apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx
  - apps/dispatch-control/app/(dashboard)/page.tsx
  - apps/dispatch-control/app/(dashboard)/desk/page.tsx
  - apps/dispatch-control/app/(dashboard)/desk/_components/DeskScreen.tsx
  - apps/dispatch-control/app/(dashboard)/issues/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/IssueCard.tsx
  - apps/dispatch-control/lib/nav.ts
  - apps/dispatch-control/__tests__/issueTitle.test.ts
  - apps/dispatch-control/__tests__/currentRun.test.ts
  - apps/dispatch-control/__tests__/runSections.test.ts
  - apps/dispatch-control/__tests__/RunScreen.test.tsx
  - apps/dispatch-control/__tests__/ArchiveScreen.test.tsx
  - apps/dispatch-control/__tests__/DeskScreen.test.tsx
  - apps/dispatch-control/__tests__/IssueCard.test.tsx
  - apps/dispatch-control/__tests__/Masthead.test.tsx
  - apps/dispatch-control/__tests__/nav.test.ts

must_haves:
  truths:
    - "The Run and the Masthead can never disagree about which issue is current — both read one shared resolution (runs.latest -> pipelineRuns.byRunId -> issueNumber)."
    - "A reserved issue slot with no run is never presented as the current issue anywhere."
    - "An operator lands on the nine produced sections — real headlines, excerpts and word counts they can click straight into editing."
    - "Issues are recognisable by title in the Masthead, on The Run, in the switcher, and in the Archive; an issue whose run never chose a subject reads 'Not yet chosen', never a fabricated title."
    - "Editorial nav is exactly two items: The Run and Archive."
    - "No surface claims 'clean' or 'Not generated' while findings, claims, sign-offs or the draft are still loading or failed to load."
    - "Every existing capability of /issues (held rows + reopen, recently-published verification, create panel, ensureByNumber scheduling) is still reachable."
    - "No new publish path exists — publish stays behind the Approval stage's DecisionRail and its unchanged gates."
  artifacts:
    - path: "convex/issues.ts"
      provides: "listWithTitles — server-side issues -> latest pipelineRun -> selected pitchLog join"
      contains: "listWithTitles"
    - path: "apps/dispatch-control/lib/currentRun.ts"
      provides: "resolveCurrentRun — THE one pure current-run resolution"
      exports: ["resolveCurrentRun", "CurrentRunState"]
    - path: "apps/dispatch-control/lib/useCurrentRun.ts"
      provides: "useCurrentRun — the single hook Masthead and The Run both consume"
      exports: ["useCurrentRun"]
    - path: "apps/dispatch-control/lib/runSections.ts"
      provides: "deriveRunSections + deriveRunSectionFindings — the nine work rows"
      exports: ["deriveRunSections", "deriveRunSectionFindings"]
    - path: "apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx"
      provides: "RunBody (pure) + RunScreen (Convex wrapper) — the front door"
      min_lines: 200
    - path: "apps/dispatch-control/lib/issueTitle.ts"
      provides: "issueTitleLabel + relativeWeekLabel"
      exports: ["issueTitleLabel", "relativeWeekLabel", "NO_TITLE_LABEL"]
  key_links:
    - from: "apps/dispatch-control/components/Masthead.tsx"
      to: "apps/dispatch-control/lib/useCurrentRun.ts"
      via: "useCurrentRun() replaces the inline runs.latest -> pipelineRuns.byRunId chain"
      pattern: "useCurrentRun\\("
    - from: "apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx"
      to: "apps/dispatch-control/lib/useCurrentRun.ts"
      via: "the SAME hook — no second resolution"
      pattern: "useCurrentRun\\("
    - from: "apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx"
      to: "apps/dispatch-control/lib/contentPatchClient.ts"
      via: "getDraft(runId, token) supplies the produced section content"
      pattern: "getDraft\\("
    - from: "apps/dispatch-control/app/(dashboard)/issues/page.tsx"
      to: "convex/issues.ts listWithTitles"
      via: "one server-joined subscription — no per-row title lookup"
      pattern: "listWithTitles"
    - from: "apps/dispatch-control/app/(dashboard)/page.tsx"
      to: "/run"
      via: "root redirect"
      pattern: "redirect\\('/run'\\)"
---

<objective>
Replace the task-inbox Desk with **The Run** — a work-first front door that lands the operator on the nine sections the agents actually produced, ready to edit — give every issue a derived title, and collapse Editorial nav to two surfaces.

Purpose: the previous front door latched onto an empty reserved slot (`max(issueNumber)` among `!published && !held`) and rendered "0 open items · Nothing needs you" while the Masthead — resolving `runs.latest -> pipelineRuns.byRunId -> issueNumber` — simultaneously said "Issue 999717 · NEEDS REVIEW · PAUSED FOR YOU · MY TASKS 1". Two surfaces, two definitions of "the current issue", contradicting each other on one screen. And the surface itself was the wrong concept: a list of problems, not the work.

Output: one additive Convex query, four new pure lib modules, `/run`, a title-led `/issues` Archive, and a two-item Editorial nav. No schema change, no pipeline change, no data deletion, no new publish path.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md

Design contract (read all three before Task 4/5 — these ARE the spec):
@.planning/quick/260730-ldn-the-run-surface-issue-titles-nav-consoli/mockups/14-the-run.html
@.planning/quick/260730-ldn-the-run-surface-issue-titles-nav-consoli/mockups/15-the-run-states.html
@.planning/quick/260730-ldn-the-run-surface-issue-titles-nav-consoli/mockups/16-archive-titles.html
@.planning/quick/260724-lp1-uniform-visual-pass-on-run-monitor-promp/mockups/08-system-sheet.html

Superseded surface (what this replaces):
@.planning/quick/260730-i4j-work-first-desk-front-door-draft-focus-m/260730-i4j-SUMMARY.md
@apps/dispatch-control/app/(dashboard)/desk/_components/DeskScreen.tsx

The correct resolution to copy, and the surfaces being changed:
@apps/dispatch-control/components/Masthead.tsx
@apps/dispatch-control/app/(dashboard)/issues/page.tsx
@apps/dispatch-control/lib/derivedState.ts
@apps/dispatch-control/lib/nav.ts
@apps/dispatch-control/lib/issueRouteResolver.ts
@apps/dispatch-control/lib/contentPatchClient.ts
@apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx
@apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/storyOutline.ts
@convex/schema.ts
@convex/issues.ts
@convex/pitchLog.ts
@convex/pipelineRuns.ts

<interfaces>
<!-- Extracted from the codebase. Use these directly — do not re-explore. -->

Convex tables + indexes already in place (convex/schema.ts) — NO schema change in this task:

```ts
issues: { workspace_id, issueNumber, scheduledFor?, held, heldReason?, heldBy?, heldAt?,
          published, publishedAt?, sanityIssueId?, lastVisitedStage?, createdAt }
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_issueNumber', ['workspace_id', 'issueNumber'])

pipelineRuns: { runId, issueNumber, status: 'running'|'awaiting-review'|'complete'|'failed',
                startedAt, completedAt?, errorMessage?, durationMs?, cost?, awaitingHumanAt?, sanityIssueId? }
  .index('by_runId', ['runId'])
  .index('by_issueNumber', ['issueNumber'])

pitchLog: { runId, charityId?, charityName, charityLocation, charityWebsite?, assetRange?,
            focusArea?, scoutSummary, selected: boolean, timestamp }
  .index('by_runId', ['runId'])
  .index('by_runId_and_selected', ['runId', 'selected'])

deliberationEvents: { runId, agentId, eventType, payload, charityId?, sectionName?, timestamp }
  .index('by_runId', ['runId'])
  .index('by_runId_and_type', ['runId', 'eventType'])
```

Existing Convex functions this plan consumes (all already deployed):
```
api.runs.latest({ workspace_id })            -> runs row | null   (sorted startedAt desc)
api.runs.byRunId({ runId })                  -> runs row | null
api.pipelineRuns.byRunId({ runId })          -> pipelineRuns row | null   (has .issueNumber)
api.pipelineRuns.byIssueNumber({issueNumber})-> most recent pipelineRuns row | null
api.pitchLog.selectedByRunId({ runId })      -> { charityName, scoutSummary, ... } | null
api.pitchLog.byRunId({ runId })              -> rows[]
api.issues.byIssueNumber({ workspace_id, issueNumber }) -> issues row | null
api.issues.listForWorkspace({ workspace_id })-> rows[] sorted issueNumber desc
api.issues.ensureByNumber({ workspace_id, issueNumber, scheduledFor? })  (idempotent, strict no-op on existing)
api.signOffs.activeByRunId({ runId })        -> Record<'facts-cleared'|'sounds-human', {actorId, signedAt}>
api.claimChecks.listByRunId({ runId })       -> rows[]  ({ _id, status, sourceUrl, sectionName, text, ... })
api.claimChecks.allSignedOff({ runId })      -> { signedOff, total }
api.qaCorrections.byRunId({ runId })         -> rows[]  ({ _id, sectionName, severity, axis?, reason, resolution?, accepted?, timestamp })
api.agentRuns.byRunId({ runId })             -> rows[]  ({ costUsd? })
api.pipelineConfig.getAll({ workspace_id })  -> { key, value }[]
api.deliberationEvents.byRunIdAndType({ runId, eventType }) -> rows[]
```

Pure selectors already available (apps/dispatch-control/lib/derivedState.ts):
```ts
deriveIssueStatus(i: DerivationInputs): IssueStatus       // 'unknown'|'draft'|'needs-review'|'ready'|'published'|'held'|'failed'
deriveStageStates(i): [S,S,S,S,S]                          // Story, Draft, Fact Check, Voice, Approval
deriveTasks(i): DerivedTask[]
deriveSectionStates(i, draftSectionIds): Record<string, SectionStateResult>
draftSectionIdsFromDraft(draft: DraftResponse): ReadonlySet<string>   // THE presence authority
isMustFix(row), deriveFactCheckSummary(rows)
estimateWorkMinutes(tasks), formatTaskAge(openedAt, now), formatElapsed(startedAt, now, completedAt?)
deriveRunCostUsd(agentRuns) /* undefined while loading — never coerce to 0 */, deriveRunCapUsd(configRows)
isPausedAtGate1(i), TASK_SEVERITY_RENDER_ORDER, SEVERITY_MINUTES, DEFAULT_RUN_CAP_USD
```
`DerivationInputs` semantics are load-bearing: `undefined` = NOT LOADED, `null` = loaded-and-absent. This is what makes ISS-06 ("never show a stale value") structural.

Draft read (apps/dispatch-control/lib/contentPatchClient.ts):
```ts
getDraft(runId: string, token: string | null): Promise<DraftResponse>
interface DraftSection { headline?: string; blocks: ContentBlock[]; lossy: boolean }
interface ContentBlock { type: 'paragraph'|'h2'|'h3'|'blockquote'; text: string }
interface DraftResponse {
  revisionId: string
  sections: Record<string, DraftSection>
  theme: Record<string, any>; game: Record<string, any>
  bonus: Record<string, any>; bonusType: 'specAd'|'bigBudget'|'jingle'
  podcast: Record<string, any>
  conversation: { speaker: string; text: string }[]
}
```
**DraftResponse carries NO per-section timestamps.** Mockup 14's "EDITED 11 MIN AGO" has no data source. Do NOT fabricate it — see Task 3.
`pipelineBaseUrl()` THROWS when `NEXT_PUBLIC_PIPELINE_URL` is unset, so `getDraft` can reject before any network call. That failure must be surfaced honestly, never rendered as "Not generated".

Section vocabulary (SectionChipList.tsx / storyOutline.ts / galley helpers):
```ts
EDITABLE_SECTIONS: SectionMeta[] = [
  { id: 'originStory', label: 'Origin Story' }, { id: 'problemStatement', label: 'Problem' },
  { id: 'founderBio', label: 'Founder Bio' },   { id: 'caseStudy', label: 'Case Study' },
  { id: 'bonus', label: 'Bonus' },              { id: 'game', label: 'Game' },
  { id: 'deliberation-conversation', label: 'Deliberation' },
  { id: 'podcast', label: 'Podcast' },          { id: 'theme', label: 'Theme' },
]
interface SectionChipCounts { open: number; unresolved: number; error?: number; warning?: number; info?: number }

// storyOutline.ts
sectionWordCount(blocks: ContentBlock[]): number
sectionExcerpt(blocks: ContentBlock[]): string      // first paragraph's text, '' when none
countWords(text), firstSentence(text, max=160)

// lib/galley/sectionIdMap.ts
qaSectionToGalleyId(qaName): string | null   // origin_story->originStory, problem->problemStatement,
                                             // founder_bio->founderBio, case_study->caseStudy, game, bonus; else null
// lib/galley/axisPartition.ts
VOICE_AXES   = { gravity, sentiment, irony-signaling, machine-tell }
FACTUAL_AXES = { precision, cross-section-consistency, structural-variety, hard-rule }
// lib/galley/findingState.ts
isOpenFinding(row): boolean   // THE one open-finding predicate — always use it
```
Axis gating rule (Phase 36 §36.3, as DecisionRail applies it): a finding with `axis === undefined`
counts as FACTUAL. Use `axis === undefined || FACTUAL_AXES.has(axis)` for factual, `VOICE_AXES.has(axis)` for voice.

Route hrefs (lib/issueRouteResolver.ts):
```ts
issueHref(n) = /issues/{n}                     issueStoryHref(n)     = /issues/{n}/story
issueDraftHref(n) = /issues/{n}/draft          issueFactCheckHref(n) = /issues/{n}/fact-check
issueVoiceHref(n) = /issues/{n}/voice          issueApprovalHref(n)  = /issues/{n}/approval
issueRunHref(n, runId) = /issues/{n}/runs/{runId}
```
The Draft stage mounts `ReviewDeskRunView`, which is URL-driven on `?story=<sectionId>&tab=outline|draft`.
So "open this section for editing" === `` `${issueDraftHref(n)}?story=${sectionId}&tab=draft` ``.

Schedule helpers (lib/scheduleLabel.ts): `DEFAULT_CADENCE`, `readConfigValue<T>(rows, key)`,
`formatScheduledForLabel(nextRunAt, cadence)`, `type Cadence`.

Publish path — DO NOT FORK. `DecisionRail.tsx` (mounted by `/issues/[n]/approval`) owns
`publishIssue(token, runId)`, `recordSignOff(token, runId, kind)`, the `publishDisabled` derivation,
the held term, the role gate and the publish-preview interstitial. The Run's three gates are
**status readouts + links into the existing stages**. No mutation, no fetch, no sign-off button on `/run`.

House rules (Uniform System Sheet):
- Hard edges, radius 0–2px. Dots are the only circles.
- 1c tokens only: `--color-ink`, `ink-soft`, `faint`, `cobalt`, `vermilion`, `marigold`, `marigold-text`,
  `green`, `paper`, `nav`, `rail`, `card`, `card-alt`, `border`. Never `neutral/gray/slate`.
- Four fonts: `--font-display` (Newsreader) headlines · `--font-body` (Lora, italic) deks/excerpts ·
  `--font-ui` (Space Grotesk) UI · `--font-mono` (IBM Plex Mono, caps) kickers/labels/numerals.
- Status is never colour alone — chip label + colour, or dot + count.
- Every page head: mono kicker → display h1 → italic dek.
- Interactive targets ≥44px (established across this app).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Convex — the server-side titles join, deployed; plus the pure title/week helpers</name>
  <files>
convex/issues.ts
apps/dispatch-control/lib/issueTitle.ts
apps/dispatch-control/__tests__/issueTitle.test.ts
  </files>
  <behavior>
`__tests__/issueTitle.test.ts` (pure, node env — no Convex, no DOM):
- `issueTitleLabel('The Kumasi Roofless Schools Audit')` → the title verbatim.
- `issueTitleLabel(null)` → `'Not yet chosen'` (=== `NO_TITLE_LABEL`).
- `issueTitleLabel(undefined)` → `'Not yet chosen'` (loaded-and-absent and never-loaded both collapse here; callers that must distinguish "still loading" do so BEFORE calling this — assert the exported const exists so callers can compare).
- `issueTitleLabel('   ')` → `'Not yet chosen'` (whitespace-only is not a title).
- `relativeWeekLabel(now, now)` → `'This week'`.
- `relativeWeekLabel(now - 8 days, now)` → `'Last week'`.
- `relativeWeekLabel(now - 20 days, now)` → `'2 weeks ago'`.
- `relativeWeekLabel(now - 60 days, now)` → `'8 weeks ago'`.
- `relativeWeekLabel(undefined, now)` → `'Unknown'` (never a fabricated date, never blank).
- `relativeWeekLabel(now + 3 days, now)` → `'This week'` (a future timestamp must not produce a negative-week string).
  </behavior>
  <action>
**(a) `convex/issues.ts` — add ONE additive public query `listWithTitles`.** Do not touch any
existing export. Follow the file's existing style (`query({ args, handler })`, `v.string()`, index
reads only, a header comment explaining the join).

```ts
export const listWithTitles = query({
  args: { workspace_id: v.string() },
  handler: async (ctx, { workspace_id }) => { /* see below */ },
})
```

Handler, in order:
1. `.query('issues').withIndex('by_workspace', q => q.eq('workspace_id', workspace_id)).collect()`.
2. For each issue, resolve its most recent run:
   `.query('pipelineRuns').withIndex('by_issueNumber', q => q.eq('issueNumber', issue.issueNumber)).collect()`
   then `rows.sort((a,b) => b.startedAt - a.startedAt)[0] ?? null` — the SAME "most recent run for
   this issue" rule `pipelineRuns.byIssueNumber` already uses. Reuse that rule, do not invent another.
3. When a run exists, resolve the subject:
   `.query('pitchLog').withIndex('by_runId_and_selected', q => q.eq('runId', run.runId).eq('selected', true)).first()`
4. When a run exists, resolve "has drafts to edit":
   `.query('deliberationEvents').withIndex('by_runId_and_type', q => q.eq('runId', run.runId).eq('eventType', 'section-draft')).first()`
   → `hasDrafts = row !== null`. Use `.first()`, never `.collect()` — a boolean needs one row.
   (`section-draft` is emitted by origin_story / problem / founder_bio / case_study / game / bonus /
   design / researcher via `@agent_node(emit_event="section-draft")`, so its presence is the honest
   "sections were produced" signal.)
5. Return, sorted `issueNumber` desc (same ordering contract as `listForWorkspace`):

```ts
{
  _id, issueNumber, held, heldReason, heldBy, heldAt,
  published, publishedAt, scheduledFor, createdAt, lastVisitedStage,
  runId: string | null,
  runStatus: string | null,        // pipelineRuns.status
  runStartedAt: number | null,
  runCompletedAt: number | null,
  title: string | null,            // selected pitchLog.charityName
  subtitle: string | null,         // selected pitchLog.scoutSummary — the archive dek
  hasDrafts: boolean,
}
```

Honesty contract to state in the header comment and honour exactly:
`title: null` means **the run has not chosen a subject** (never cleared Gate 1, or no run at all).
The CLIENT renders `'Not yet chosen'`. This query must NEVER substitute the issue number, the
location, an unselected candidate's name, or any other stand-in for a missing `charityName`.

Every read is index-backed. This is the server-side join that stops the archive from N+1ing the
way `RecentlyPublishedRowContainer` does per row. Do NOT add a new index and do NOT change the schema.

**(b) `apps/dispatch-control/lib/issueTitle.ts` — new pure module** (no React, no Convex, no imports):

```ts
export const NO_TITLE_LABEL = 'Not yet chosen'
export function issueTitleLabel(title: string | null | undefined): string
export function relativeWeekLabel(ts: number | null | undefined, now: number): string
```
`relativeWeekLabel` takes `now` as a parameter — never reads the clock internally, matching the
`formatElapsed` / `formatTaskAge` precedent in `lib/derivedState.ts`. Buckets: `< 7d` → `'This week'`,
`< 14d` → `'Last week'`, else `'{n} weeks ago'` with `n = Math.floor(diffDays / 7)`; a negative diff
(future timestamp) clamps to `'This week'`; absent → `'Unknown'`.

**(c) DEPLOY THE QUERY.** Committing `convex/*.ts` is NOT deploying it — Phase 39 shipped a
production 500 by skipping exactly this. Run `pnpm --filter @eisenbalm/convex dev:once` so
`dev:modest-magpie-797` gets the function AND `convex/_generated/api.d.ts` regenerates
(`api.issues.listWithTitles` will not typecheck in the app until it does). This is a required step of
this task, not a follow-up.
  </action>
  <verify>
    <automated>pnpm --filter @eisenbalm/convex typecheck && pnpm --filter @eisenbalm/convex dev:once && pnpm --filter dispatch-control test -- issueTitle</automated>
  </verify>
  <done>
`api.issues.listWithTitles` exists in `convex/_generated/api.d.ts`, is live on `dev:modest-magpie-797`,
and returns one row per issue carrying `runId`/`runStatus`/`title`/`subtitle`/`hasDrafts` with `title: null`
for any issue whose run never selected a pitch. `issueTitle.test.ts` passes. No schema change, no index
added, no existing Convex export modified.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: The ONE current-run resolution — lib/currentRun.ts + useCurrentRun, and the Masthead reads the title</name>
  <files>
apps/dispatch-control/lib/currentRun.ts
apps/dispatch-control/lib/useCurrentRun.ts
apps/dispatch-control/components/Masthead.tsx
apps/dispatch-control/__tests__/currentRun.test.ts
apps/dispatch-control/__tests__/Masthead.test.tsx
  </files>
  <behavior>
`__tests__/currentRun.test.ts` (pure, node env) — `resolveCurrentRun(latest, pipelineRun)`:
- `(undefined, undefined)` → `{ kind: 'loading' }` (runs.latest not yet loaded).
- `(null, undefined)` → `{ kind: 'none' }` — confirmed: no run exists. This is the state the old Desk
  never had, and the reason it invented an issue.
- `({ runId: 'r1' }, undefined)` → `{ kind: 'loading' }` — a run exists but its issueNumber has not
  resolved yet; must NOT report a run with a null issueNumber while still loading.
- `({ runId: 'r1' }, null)` → `{ kind: 'run', runId: 'r1', issueNumber: null }` — run exists, no
  pipelineRuns row (legacy/orphan runId). Honest, not loading, not none.
- `({ runId: 'r1' }, { issueNumber: 999717 })` → `{ kind: 'run', runId: 'r1', issueNumber: 999717 }`.
- A regression assertion, named for the bug: given an `issues` list whose highest `!published && !held`
  row is 999720 and a `runs.latest`/`pipelineRuns` pair pointing at 999717, `resolveCurrentRun` returns
  999717 — the function takes no issues list at all, which is the structural guarantee.

`__tests__/Masthead.test.tsx` — extend the existing file (mock dispatches by query ref + args; add
`pitchLog.selectedByRunId` to the `@convex/_generated/api` mock):
- With a resolved run whose selected pitch is `{ charityName: 'The Kumasi Roofless Schools Audit' }`,
  the masthead renders that title text AND still renders `Issue 999717`.
- With `pitchLog.selectedByRunId` returning `undefined` (still loading), the masthead renders NEITHER
  the title NOR `'Not yet chosen'` — never a premature "no subject" claim.
- With `pitchLog.selectedByRunId` returning `null` (loaded, no selection), the masthead renders
  `'Not yet chosen'`.
- Every pre-existing Masthead assertion in this file still passes unmodified (the four ISS-05 readouts,
  the My Tasks trigger, the auto-publish chip, the ⌘K chip).
  </behavior>
  <action>
**(a) `lib/currentRun.ts` — new pure module.** No React, no Convex imports.

```ts
export type CurrentRunState =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'run'; runId: string; issueNumber: number | null }

export function resolveCurrentRun(
  latest: { runId: string } | null | undefined,
  pipelineRun: { issueNumber: number } | null | undefined,
): CurrentRunState
```
Header comment must state the rule plainly, because it is the whole point of this task:
**follow the run, never the issue number.** `runs.latest -> pipelineRuns.byRunId -> issueNumber`.
A reserved slot with no run is a future slot; it belongs in the Archive, never on the front door.
Never scan `issues` for `max(issueNumber)` — that is precisely the defect this module exists to make
unrepresentable.

**(b) `lib/useCurrentRun.ts` — new client hook (`'use client'`).** The single subscription assembly
both the Masthead and The Run consume. Lift the Masthead's EXISTING wiring here verbatim — this is a
move, not a redesign:
```
api.runs.latest({ workspace_id: DEFAULT_WORKSPACE_ID })
api.pipelineRuns.byRunId({ runId })                    // skip until runId known
api.pitchLog.selectedByRunId({ runId })                // skip until runId known  — the TITLE
api.issues.byIssueNumber({ workspace_id, issueNumber })// skip until issueNumber known
api.signOffs.activeByRunId({ runId })
api.claimChecks.listByRunId({ runId })
api.claimChecks.allSignedOff({ runId })
api.qaCorrections.byRunId({ runId })
api.pitchLog.byRunId({ runId })
api.runs.byRunId({ runId })
api.agentRuns.byRunId({ runId })
api.pipelineConfig.getAll({ workspace_id })
```
Return:
```ts
{
  state: CurrentRunState
  runId: string | null
  issueNumber: number | null
  title: string | null | undefined     // undefined === still loading (callers MUST branch on this)
  derivationInputs: DerivationInputs
  issueStatus: IssueStatus
  claimSummary: { signedOff: number; total: number } | undefined
  signOffs: Record<string, { actorId: string; signedAt: number }> | undefined
  qaFindings: ... | undefined
  claimRows: ... | undefined
  runRow: ... | undefined              // runs.byRunId — startedAt/completedAt for formatElapsed
  runCostUsd: number | undefined       // deriveRunCostUsd(agentRuns) — undefined while loading
  capUsd: number                       // deriveRunCapUsd(configRows)
  configRows: { key: string; value: string }[] | undefined
}
```
Preserve two disciplines exactly as the existing code has them:
- `claimRows` is mapped to `derivedState`'s shape (`{ _id, status, sourceUrl, sectionName, claimText: row.text }`).
- `signOffs` normalization: leave it `undefined` while the run lookup is unresolved; once
  `state.kind === 'none'` is CONFIRMED, hand `deriveIssueStatus` a module-scoped stable empty object
  (the `EMPTY_SIGNOFFS` constant pattern — never a fresh `{}` literal per render).
`derivationInputs` must be byte-equivalent to what `Masthead.tsx` assembles today, plus
`runStartedAt`/`runCompletedAt` from `runs.latest` (already optional fields on `DerivationInputs`).

**(c) `components/Masthead.tsx` — consume the hook and lead with the title.**
Replace the inline `runs.latest`/`pipelineRuns.byRunId`/`issues.byIssueNumber`/`signOffs`/`claimChecks`/
`qaCorrections`/`pitchLog` block with a single `useCurrentRun()` call. `runs.monthToDateCost` and the
`autoPublish` config read stay where they are (month-to-date cost is a workspace readout, not a
run readout).

Then change ONE rendered thing: the `Issue {n} | Issue —` mono span becomes a two-part identity node
inside the existing `ScrollHintRow`:
- mono `Issue {n}` (or `Issue —`) — demoted metadata, `--color-masthead-muted`, unchanged styling;
- followed by the title in `--font-display`, `--color-masthead-text`, ~14px, `truncate max-w-[280px]`,
  with a `title={...}` attribute for the full string.
Title branching (this is the ISS-06 discipline applied to the title):
`title === undefined` → render NOTHING for the title (still loading — never "Not yet chosen");
`title === null` and a run exists → `issueTitleLabel(null)` = `'Not yet chosen'` in `--color-masthead-muted`;
`state.kind === 'none'` → render no title node at all.
Everything else about the Masthead — the four ISS-05 readouts, `draftDeskHref`, `MyTasksTrigger`,
`AwaitingYouInbox`, the auto-publish chip, the ⌘K chip, the mobile scroll strip — is untouched.

**Deliberate non-change:** `/desk` is NOT patched here. Task 4 deletes it outright; patching a file
about to be removed is throwaway work. The bug's *root* — two definitions of the current issue — is
closed by this module the moment a second surface can only obtain the answer from `useCurrentRun`.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- currentRun Masthead</automated>
  </verify>
  <done>
`resolveCurrentRun` is the only place the current issue is decided; it accepts no issues list, so
`max(issueNumber)` is unrepresentable. `Masthead.tsx` contains no `useQuery(api.runs.latest…)` of its
own — it calls `useCurrentRun()`. The masthead shows the issue TITLE next to a demoted mono issue
number, shows nothing while the title is loading, and `'Not yet chosen'` only once loaded-and-absent.
All pre-existing Masthead tests still pass.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: lib/runSections.ts — the nine work rows, derived purely from the draft and the findings</name>
  <files>
apps/dispatch-control/lib/runSections.ts
apps/dispatch-control/__tests__/runSections.test.ts
  </files>
  <behavior>
`__tests__/runSections.test.ts` (pure, node env — fixtures only, no Convex, no DOM):

`deriveRunSectionFindings(qaFindings, ...)`:
- An open finding with `axis: 'precision'`, `severity: 'error'`, `sectionName: 'origin_story'` →
  `originStory.mustFix === 1`, `voice === 0`.
- An open finding with `axis: undefined` and `severity: 'error'` counts as **factual** (Phase 36 §36.3
  conservative default — must-fix), not voice.
- An open finding with `axis: 'gravity'` (any severity) → `voice === 1`, `mustFix === 0`.
- A finding with `resolution: 'accepted'` or `resolution: 'dismissed'` is excluded from both counts
  (via `isOpenFinding`).
- A finding whose `sectionName` maps to `null` through `qaSectionToGalleyId` (e.g. `'podcast'`) is
  dropped, never bucketed into an adjacent section.
- `qaFindings === undefined` → returns `undefined` (NOT an all-zero map): the caller must be able to
  tell "no findings" from "findings not loaded".

`deriveRunSections(draft, counts)`:
- Returns exactly 9 rows, in `EDITABLE_SECTIONS` order, each carrying that entry's `id` and `label`.
- `draft === null` → every row `state: 'unknown'`, `generated: false`, `headline: null`,
  `meta: 'Unavailable'`. Explicitly NOT `'pending'` and explicitly NOT `'Not generated'` — a draft
  that has not loaded is not a draft that is empty.
- With a draft where `sections.originStory.blocks` is non-empty: that row has `generated: true`,
  `headline` = `sections.originStory.headline`, `excerpt` = first paragraph text,
  `wordCount` = `sectionWordCount(blocks)`, `meta` = `'842 words'`-shaped.
- A section absent from `draftSectionIdsFromDraft(draft)` → `generated: false`, `state: 'pending'`,
  `headline: null` (the surface renders "Not generated").
- `state` precedence on a generated section: `mustFix > 0` → `'must-fix'`; else `voice > 0` → `'voice'`;
  else `'clean'`.
- `counts === undefined` (findings not loaded) → every generated row is `state: 'unknown'`, never
  `'clean'`. **A section is never called clean while its findings are still loading.**
- `game` with a non-empty `draft.game` → `generated: true`, `wordCount: null`, `meta: 'Interactive'`
  (word count is not a meaningful measure of an interactive embed — null, not 0).
- `deliberation-conversation` with a non-empty `draft.conversation` → `excerpt` = first turn's text,
  `wordCount` = summed across turns.
- `bonus` with `bonusType: 'specAd'` and `bonus.body` blocks → excerpt/word count read from
  `bonus.body`; with any other `bonusType` → `generated` still true (payload non-empty) but
  `wordCount: null`.
- `theme` / `podcast` with non-empty payloads → `generated: true`, `headline: null`, `wordCount: null`.
- No row ever carries a "last edited" value (see action — the data does not exist).
  </behavior>
  <action>
**New pure module `apps/dispatch-control/lib/runSections.ts`.** No React, no Convex, no fetch.
Type-only imports from `@/lib/contentPatchClient`; value imports limited to
`EDITABLE_SECTIONS` (SectionChipList), `draftSectionIdsFromDraft` (derivedState), `sectionWordCount` /
`sectionExcerpt` (storyOutline), `isOpenFinding`, `qaSectionToGalleyId`, `VOICE_AXES`, `FACTUAL_AXES`.

```ts
export interface RunSectionFindingCounts { mustFix: number; voice: number }

export function deriveRunSectionFindings(
  qaFindings: Array<{ _id: string; sectionName: string; severity: 'info'|'warning'|'error';
                      axis?: string; accepted?: boolean; resolution?: 'accepted'|'dismissed'|null }> | undefined,
): Record<string, RunSectionFindingCounts> | undefined

export type RunSectionState = 'clean' | 'must-fix' | 'voice' | 'pending' | 'unknown'

export interface RunSectionRow {
  id: string
  label: string
  generated: boolean
  headline: string | null
  excerpt: string | null
  wordCount: number | null
  meta: string                 // '842 words' | 'Interactive' | 'Not generated' | 'Unavailable'
  state: RunSectionState
  mustFix: number
  voice: number
}

export function deriveRunSections(
  draft: DraftResponse | null,
  counts: Record<string, RunSectionFindingCounts> | undefined,
): RunSectionRow[]
```

Presence is decided by `draftSectionIdsFromDraft(draft)` — reuse it, do not write a second presence
predicate (that function is already documented as THE authority and is kept in lockstep with the
Stage-2 canvas).

Findings bucketing mirrors `deriveSectionStates`'s mapping exactly: filter with `isOpenFinding`, map
`row.sectionName` through `qaSectionToGalleyId`, drop `null`. Axis split:
`voice` when `VOICE_AXES.has(axis ?? '')`; otherwise factual, and factual contributes to `mustFix`
only at `severity === 'error'` (matching `DecisionRail`'s `blockers`, so The Run's must-fix count and
the publish blocker count cannot drift).

**Do not fabricate "last edited".** `DraftResponse.sections[id]` is `{ headline?, blocks, lossy }` —
there is no per-section timestamp anywhere in the response, in Convex, or in Sanity's draft read.
Mockup 14's `EDITED 11 MIN AGO` therefore has no data source. Omit it entirely; the `meta` string
carries word count (or `Interactive` / `Not generated` / `Unavailable`) and nothing else. Record this
in the module header so a later reader does not "restore" it from the mockup.

Note in the header that `deriveRunSectionFindings` returning `undefined` and `deriveRunSections`
mapping that to `state: 'unknown'` is the same never-show-a-stale-value discipline `deriveIssueStatus`
enforces with its `undefined` = NOT LOADED contract.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- runSections</automated>
  </verify>
  <done>
`deriveRunSections` returns 9 ordered rows from a `DraftResponse`, distinguishing generated / not
generated / draft-unavailable / findings-not-loaded as four different states, and never reports
`'clean'` or `'Not generated'` for either of the two unknown cases. No existing file is modified.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: /run — the front door; /desk deleted; the selection bug becomes unrepresentable</name>
  <files>
apps/dispatch-control/app/(dashboard)/run/page.tsx
apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx
apps/dispatch-control/app/(dashboard)/page.tsx
apps/dispatch-control/app/(dashboard)/desk/page.tsx
apps/dispatch-control/app/(dashboard)/desk/_components/DeskScreen.tsx
apps/dispatch-control/__tests__/RunScreen.test.tsx
apps/dispatch-control/__tests__/DeskScreen.test.tsx
  </files>
  <behavior>
`__tests__/RunScreen.test.tsx` mounts the pure exported `RunBody` with fixture props (the
`DeskBody`/`MyTasksList` precedent — props only, no Convex, no fetch):

Identity:
- Renders the title as the display `h1`, and `Issue 999717` as mono metadata — assert the title node
  is an `h1` and the issue number is not.
- `title === undefined` (loading) → renders neither the title nor `'Not yet chosen'`.
- `title === null` → the `h1` reads `'Not yet chosen'`.

State · no run (`{ kind: 'no-run' }`):
- Renders `'Nothing is running.'` and the next-discovery label.
- Renders NO issue number, NO status chip, NO section rows, NO gates, and never the string
  `'Nothing needs you'`. **This is the exact regression the whole task exists for — name the test after it.**
- Offers one action linking to `/issues`.

State · loading:
- Renders a loading affordance and neither `'Nothing is running.'` nor any section state.

State · running:
- Status chip reads `Running`; renders the produced-so-far rows; renders progress copy
  (`'{n} of 9 written'`); renders NO gates (nothing to sign off mid-flight).

State · failed:
- Status chip reads `Run failed`; renders NO gate rows and NO sign-off affordance at all
  (quick 260718-51o terminal-state rule); offers a re-run pointer.

The work:
- Renders exactly 9 rows in `EDITABLE_SECTIONS` order, each labelled with its section label.
- A generated row's link href is `/issues/999717/draft?story=originStory&tab=draft`.
- A `state: 'pending'` row renders `'Not generated'`, is dimmed, and is NOT a link.
- A `state: 'unknown'` row renders `'Unavailable'`, not `'Not generated'` and not `'Clean'`.
- Per-row state renders as label + colour (never colour alone): `Clean` / `2 must fix` / `1 voice` / `Pending`.
- When `draftError` is set, an honest banner carries the message and no row claims `Clean`.

Gates:
- Facts gate unsigned → reads the unchecked-claim count and links to `/issues/999717/fact-check`.
- Voice gate unsigned → reads the open voice-finding count and links to `/issues/999717/voice`.
- Publish gate with both signed + zero must-fix + not held → a link to `/issues/999717/approval`.
- Publish gate with either sign-off missing → a NON-interactive `Locked` element (assert it is not a
  link and not an enabled button) plus the stated reason.
- Publish gate with both signed but must-fix remaining → still locked, reason names the must-fix count.
- `signOffsLoaded === false` → every gate reads `Checking…`; none reads `Locked` and none reads a
  cleared state.
- No `<button>` in the whole component fires a publish or sign-off (assert by absence of any handler
  prop in the fixture surface — the gates are readouts and links only).

Switcher:
- Lists only items with `hasDrafts: true`, by title, with a relative-week label.
- A `hasDrafts: false` scheduled slot renders dimmed, reads `'Not yet chosen'`, and is NOT a link.
- The current issue's row is marked current and is not a link.

Delete `__tests__/DeskScreen.test.tsx` along with the surface it covers.
  </behavior>
  <action>
Build `/run` to mockup 14 (populated) and mockup 15 (states). Read both before writing markup; they
are the contract, not a suggestion.

**(a) `app/(dashboard)/run/page.tsx`** — thin route, mirroring `my-tasks/page.tsx`:
`export const dynamic = 'force-dynamic'`, `export const metadata = { title: 'The Run' }`, renders
`<RunScreen />`.

**(b) `app/(dashboard)/run/_components/RunScreen.tsx`** — `'use client'`. Two exports, the
`DeskScreen.tsx` structure this replaces:
- `export function RunBody(props: RunBodyProps)` — pure, props only, no Convex, no fetch, unit-tested.
- `export default function RunScreen()` — the thin data wrapper.

Wrapper responsibilities:
1. `const run = useCurrentRun()` — **the only way it may learn the current issue.** It must not
   subscribe to `api.issues.listForWorkspace` for this purpose and must not sort by `issueNumber`.
2. `api.issues.listWithTitles({ workspace_id: DEFAULT_WORKSPACE_ID })` — the switcher's single
   subscription (Task 1).
3. Draft load: `getDraft(run.runId, await getToken())` in an effect keyed on `run.runId`, guarded by a
   `cancelled` flag, with the `getToken`-excluded-from-deps comment the codebase already uses
   (`ReviewDeskRunView.reloadDraft` is the precedent — copy its shape). Skip entirely when
   `run.runId === null`. On rejection, set `draftError` to the message and leave `draft = null`.
   Remember `pipelineBaseUrl()` throws synchronously when `NEXT_PUBLIC_PIPELINE_URL` is unset — that
   must land in `draftError`, not in an unhandled rejection and never as "Not generated".
4. `deriveRunSectionFindings(run.qaFindings)` → `deriveRunSections(draft, counts)`.
5. Surface state:
   - `run.state.kind === 'loading'` → `{ kind: 'loading' }`
   - `run.state.kind === 'none'` → `{ kind: 'no-run', scheduledForLabel }` using
     `formatScheduledForLabel(readConfigValue<number>(configRows,'schedule_next_run_at'), cadence)`
   - `run.issueStatus === 'failed'` (or `runStatus === 'failed'`) → `{ kind: 'failed' }`
   - otherwise `{ kind: 'run' }`.
6. Elapsed via `formatElapsed(run.runRow?.startedAt, Date.now(), run.runRow?.completedAt)`;
   cost via `run.runCostUsd` / `run.capUsd` (render `'cost unknown — refresh'` when `undefined`,
   never `$0.00`); claims via `run.claimSummary`.
7. `onRefresh = () => window.location.reload()` — the documented last resort for a stuck Convex
   subscription, same as `IssueCard` / `DeskScreen`.

`RunBody` layout, top to bottom:
- **Identity line** (mockup 14 `.titleline`): mono `Issue {n}` kicker · status chip (label + colour) ·
  `Switch issue ▾` disclosure · right-aligned mono facts (elapsed · `$x.xx / $y.yy` · `Claims n/m`).
- **`h1`** in `--font-display` ~34px = the TITLE, with a 2px `--color-ink` bottom rule.
- **Italic dek** in `--font-body`: `'{written} of 9 sections written. {n} need you.'` — and when
  nothing needs you, say that plainly. Plus a `Run details →` link to `issueRunHref(n, runId)`.
- **Switcher panel** (collapsed by default; a `<details>`/disclosure or local `open` state). Rows from
  `listWithTitles`: mono number · display title (`issueTitleLabel`) · mono meta
  (`relativeWeekLabel(runStartedAt ?? publishedAt ?? createdAt, Date.now())` + a short status word).
  Only `hasDrafts === true` rows are links, to `issueDraftHref(n)`. The current issue's row is marked
  current (inset cobalt bar per mockup) and is not a link. Rows with `hasDrafts === false` render
  dimmed/italic and are `<span>`s, never anchors. Document the decision in a comment: The Run always
  shows the LATEST run; the switcher is a jump-off into another issue's Draft desk, not a `?issue=`
  variant of this route — no new route parameter is invented.
- **THE WORK** — section label row (`The work` · `{written} written · {pending} pending`) then the 9
  `RunSectionRow`s. Each generated row: mono cobalt kicker (the section label, fixed ~118px column) ·
  display headline (falling back to the section label when `headline === null`) · italic one-line
  excerpt (`line-clamp-1`) · mono meta · right-aligned state chip. Generated rows are `<Link href={`${issueDraftHref(n)}?story=${row.id}&tab=draft`}>`;
  non-generated and unknown rows are non-interactive.
  State chips: `Clean` (green), `{n} must fix` (vermilion), `{n} voice` (marigold), `Pending` (faint),
  `Unavailable` (faint) — always dot **and** label.
  When `draftError` is set, render one honest banner above the rows carrying the message.
- **Gates** ("Before it can publish") — three rows, rendered ONLY when the surface state is `'run'`:
  1. *Clear the facts* — signed → green check + `Cleared by {actorId} {relative}`; unsigned →
     `{unchecked} of {total} claims still unchecked` + `Check claims →` link to `issueFactCheckHref(n)`.
  2. *Sounds human* — signed → green check + actor/time; unsigned → `{n} voice finding(s) open` (or
     `Voice sign-off outstanding` at zero) + `Voice pass →` link to `issueVoiceHref(n)`.
  3. *Approve & publish* — a `<Link>` to `issueApprovalHref(n)` labelled `Approve & publish →` ONLY
     when both sign-offs are active AND `mustFixTotal === 0` AND the issue is not held; otherwise a
     non-interactive `Locked` chip whose subtitle names the actual blocker.
  While `signOffs === undefined` or `claimRows === undefined` or `qaFindings === undefined`, every gate
  reads `Checking…` — never `Locked`, never a cleared state.
  **No mutation, no fetch, no sign-off button lives on this surface.** `recordSignOff` and
  `publishIssue` stay exclusively in `DecisionRail`, behind its unchanged client gate, role gate,
  preview interstitial and the server `_require_editor` dependency. Add a comment saying so.
- **State · no run** — replaces everything between the identity line and the gates: `Nothing is
  running.` + `The next discovery is scheduled {label}.` + one `Start a run →` link to `/issues`
  (where `CreatePanel` lives — do not duplicate `triggerRun`). No issue number, no status chip, no
  fabricated slot, and never the copy `Nothing needs you`.
- **State · failed** — status chip `Run failed`; keep the section rows (surviving sections are real and
  are kept); render NO gates and NO sign-off affordance; offer `Re-run →` to `/run-monitor/runs/{runId}`
  (where `RecoveryRail` is mounted) and `Run details →` to `issueRunHref(n, runId)`.
- **State · running** — status chip `Running`; dek says sections appear as agents finish; a progress
  line `{written} of 9 written`; rows render as they arrive; no gates.

**(c) Retire the Desk.** Delete `app/(dashboard)/desk/page.tsx`,
`app/(dashboard)/desk/_components/DeskScreen.tsx` (and the now-empty `desk/` directories) and
`__tests__/DeskScreen.test.tsx`. Its capabilities are relocated, not dropped: the run band → The Run's
identity line + facts; the stage strip → the three gates; the task ledger → per-section state chips
plus the gates; the quiet strip → the Archive (Task 5). `/my-tasks` still exists and still holds the
full severity-grouped ledger for anyone who wants it.

**(d) `app/(dashboard)/page.tsx`** → `redirect('/run')`. Update the header comment to record that this
supersedes the quick 260730-i4j `/desk` redirect.

House rules apply throughout: hard edges (0–2px), 1c tokens only, four fonts four jobs, status never
colour alone, ≥44px targets, page head = mono kicker → display h1 → italic dek.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- RunScreen && pnpm --filter dispatch-control build</automated>
  </verify>
  <done>
`/run` is the root redirect target and appears in the Next.js route manifest. It resolves the current
issue only through `useCurrentRun`, lands the operator on the nine produced sections with real
headlines that click through to `?story=&tab=draft`, and tells the truth in all four states —
including saying "Nothing is running." instead of inventing an issue. `/desk` and `DeskScreen.tsx` are
gone. No publish or sign-off mutation exists anywhere under `app/(dashboard)/run/`. `pnpm --filter
dispatch-control build` passes (strict Next.js production build — vitest does not type-check).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: /issues becomes the title-led Archive; Editorial nav collapses to The Run + Archive</name>
  <files>
apps/dispatch-control/app/(dashboard)/issues/page.tsx
apps/dispatch-control/app/(dashboard)/issues/_components/IssueCard.tsx
apps/dispatch-control/lib/nav.ts
apps/dispatch-control/__tests__/ArchiveScreen.test.tsx
apps/dispatch-control/__tests__/IssueCard.test.tsx
apps/dispatch-control/__tests__/nav.test.ts
  </files>
  <behavior>
`__tests__/ArchiveScreen.test.tsx` mounts the pure exported `ArchiveBody` with fixture rows:
- Renders four group headings in order — `In progress`, `Published`, `Held`, `Scheduled` — and omits
  any heading whose group is empty.
- A row leads with its title in `--font-display` and carries the issue number as mono metadata.
- A row whose `title` is `null` reads `'Not yet chosen'`, never a fabricated title and never a bare number.
- A row's dek renders `subtitle` when present; a held row's dek carries the held reason.
- Typing `kumasi` in the search box filters to rows whose title matches case-insensitively; typing
  `999716` matches by issue number; a query matching nothing renders an explicit empty message, not a
  blank page.
- The filter chips `All` / `Published` / `Held` / `Has drafts` each narrow the list; `Has drafts` keeps
  only `hasDrafts: true` rows.
- A `hasDrafts: false` scheduled row is dimmed and is NOT a link.
- Relative-week labels render per `relativeWeekLabel`.
- The list renders from ONE fixture array — assert no per-row data-fetch prop exists on the row
  component (structural guard against reintroducing the `RecentlyPublishedRowContainer` N+1 into the
  long list).

`__tests__/nav.test.ts` (update in place):
- The Editorial group has exactly TWO items: `{ label: 'The Run', href: '/run' }` then
  `{ label: 'Archive', href: '/issues' }`.
- `'Desk'`, `'Issues'`, `'Issue Workspace'` and `'My Tasks'` appear nowhere in `NAV_GROUPS`
  (replaces the existing "exactly one Issue Workspace item" assertion, which this task retires).
- `/desk` appears nowhere in `NAV_GROUPS`.
- The existing System Workbench / Operations / NAV_PINNED assertions and the
  "every nav href maps to a real page file on disk" assertion all still pass unmodified.

Delete `__tests__/IssueCard.test.tsx` with the component it covers.
  </behavior>
  <action>
Build the Archive to mockup 16. Read it before writing markup.

**(a) `app/(dashboard)/issues/page.tsx` — rewrite as the Archive.** Split it the way `RunScreen` is
split: `export function ArchiveBody(props)` (pure, props only, unit-tested) plus the default page
component as the data wrapper.

Data: ONE `api.issues.listWithTitles({ workspace_id: DEFAULT_WORKSPACE_ID })` subscription replaces
`api.issues.listForWorkspace` for the list. The long archive list must never per-row-subscribe.

Head (house rule): mono kicker `Editorial` → display `h1` `Archive` → italic dek
`Every issue this workspace has produced, by title.`

Tools row: a title search `<input>` (client-side, case-insensitive, matches `title` OR
`String(issueNumber)`) and four filter chips `All` / `Published` / `Held` / `Has drafts` (local state,
`All` default, active chip inverted to ink).

Groups and their predicates, in order:
- **In progress** — `runId !== null && !published && !held`
- **Published** — `published`
- **Held** — `held && !published`
- **Scheduled** — `runId === null && !published && !held` (the reserved slots — dimmed, `'Not yet
  chosen'`, dek `'Discovery runs {scheduledForLabel}. No drafts yet.'`, not links)

Row (per mockup 16 `.row`): mono issue number (64px column) · display title via `issueTitleLabel` ·
italic dek (`subtitle`, or the held reason for held rows, or the scheduled copy) · mono relative-week
label · status chip (label + colour: `Published` green + dot, `Needs review` marigold, `Held`
vermilion, `Scheduled` faint). Selectable rows link to `issueDraftHref(issueNumber)`.

**Preserve every existing capability — relocate, never drop:**
- `StartHereCard` stays at the top. Its `inProgressIssueNumber` prop must now come from
  `useCurrentRun().issueNumber` — **not** from a `max(issueNumber)` scan. The Archive must not
  reintroduce the defect Task 2 eliminated. Delete the old `inProgressIssue` scan from this file entirely.
- `HeldIssueRow` keeps rendering the **Held** group (it owns the Reopen action) — mount it under the
  Archive's `Held` heading rather than replacing it with a plain archive row, so reopen survives.
  Keep the existing 8-row cap and the `+N more held` note.
- `ScheduledSlotCard` + the `ensureByNumber` reservation effect + the `fetchRepetitionNote` effect all
  survive, relocated under the **Scheduled** group. Keep both one-shot `useRef` guards
  (`ensuredRef`, `noteFetchedRef`) and the existing dependency arrays and comments verbatim — they
  guard against `getToken` reference churn and duplicate reservations.
- `CreatePanel` stays at the bottom, unchanged (it is now also the target of The Run's `Start a run →`).
- **Recently published verification** — `RecentlyPublishedRowContainer` + `RecentlyPublishedRow` are the
  only place claim coverage and the two sign-off attributions are shown for a published issue. Keep
  them, but relocate into a collapsed `<details>` disclosure titled
  `Verification record — recently published` beneath the archive list, still capped at 5 rows. Its
  bounded per-row subscription is pre-existing and accepted; the ARCHIVE list itself must not do it.
- `IssueCard` is REMOVED from this page — every readout it carried (status, stage strip, open task
  count, claim coverage, voice state, work minutes, run cost) is now on The Run's identity line and
  gates. Delete `app/(dashboard)/issues/_components/IssueCard.tsx` and `__tests__/IssueCard.test.tsx`
  rather than leaving dead code. Verify with a grep that nothing else imports it before deleting
  (`StageStrip`/`ScheduledSlotCard`/`HeldIssueRow` only *mention* it in comments — leave those files
  alone). Keep `StageStrip.tsx` (it is imported elsewhere).

**(b) `lib/nav.ts` — Editorial becomes exactly two items:**
```ts
{ label: 'The Run', href: '/run' },
{ label: 'Archive', href: '/issues' },
```
Remove `Desk`, `Issues`, `Issue Workspace` (a duplicate `/issues` href) and `My Tasks`. System
Workbench and Operations groups and `NAV_PINNED` are untouched. Update the file header to record why:
four Editorial entries pointed at three surfaces, two of them at the same URL; My Tasks' signal is
absorbed by per-section finding counts and the three gates on The Run; the Issue Workspace stage tabs
are absorbed by those same gates.

**Routes stay alive — nothing 404s and no test dies pointlessly:**
- `/my-tasks` keeps its route AND `MyTasksScreen.tsx` AND `__tests__/MyTasksScreen.test.tsx`. Only the
  nav entry is removed. `AwaitingYouInbox`'s `See all` link to `/my-tasks` keeps working untouched.
- `/issues/[n]` and every `/issues/[n]/{story,draft,fact-check,voice,approval,review,runs}` route is
  untouched — The Run and the Archive both link into them.
- `/review-desk/[runId]` and `/voice-pass/[runId]` legacy redirects are untouched.
Run a grep for `'/desk'` across `apps/dispatch-control` after deleting the route and fix any survivor
(expect only `lib/nav.ts`, `app/(dashboard)/page.tsx` and `__tests__/nav.test.ts`, all handled).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test && pnpm --filter dispatch-control build</automated>
  </verify>
  <done>
`/issues` is a title-led Archive grouped In progress / Published / Held / Scheduled, searchable and
filterable, reading one server-joined subscription. Held reopen, the scheduled-slot reservation
(`ensureByNumber`), the repetition note, the create panel and the recently-published verification
record are all still reachable. The Editorial nav is exactly `The Run` and `Archive`. The full suite
and the strict production build both pass.
  </done>
</task>

</tasks>

<verification>
Both gates are mandatory and neither substitutes for the other — vitest does NOT type-check, so a
green test run is not evidence the app compiles (quick lesson from Phase 27: two latent bugs shipped
that only failed on Vercel/Linux).

```bash
pnpm --filter @eisenbalm/convex typecheck
pnpm --filter @eisenbalm/convex dev:once     # deploys listWithTitles to dev:modest-magpie-797 + regenerates _generated/api
pnpm --filter dispatch-control test
pnpm --filter dispatch-control build
```

Manual honesty checks against the live deploy:
1. The Masthead and The Run name the SAME issue. Confirm the number they show is the one
   `runs.latest -> pipelineRuns.byRunId` resolves to, not `max(issueNumber)`.
2. Issue 999720 (the empty reserved slot) appears ONLY under the Archive's Scheduled group, dimmed and
   unselectable — never as "the current issue" and never in The Run's switcher as selectable.
3. No 999xxx issue was deleted — the Archive row count matches `issues.listForWorkspace`'s length.
4. With `NEXT_PUBLIC_PIPELINE_URL` unset or the pipeline down, The Run shows an honest draft-load error
   and every section reads `Unavailable` — never `Not generated` and never `Clean`.
5. Publish still happens only from `/issues/[n]/approval`; the gate remains locked when either
   sign-off is missing or a must-fix finding remains.
</verification>

<success_criteria>
- [ ] `api.issues.listWithTitles` is deployed to `dev:modest-magpie-797` (not merely committed) and returns `title: null` for runs that never chose a subject.
- [ ] `resolveCurrentRun` is the only current-issue decision in the app; it takes no issues list, so `max(issueNumber)` is structurally impossible.
- [ ] `Masthead.tsx` and `RunScreen.tsx` both obtain the current issue from `useCurrentRun()` — grep finds no second `runs.latest -> pipelineRuns.byRunId` chain.
- [ ] Titles lead in the Masthead, on The Run, in the switcher and in the Archive; `'Not yet chosen'` renders only once loaded-and-absent, never while loading.
- [ ] `/run` lists the nine `EDITABLE_SECTIONS` with real headlines, excerpts and word counts, each generated row opening `?story=&tab=draft`.
- [ ] Four honest states shipped: loading · no-run ("Nothing is running.", never an invented issue) · running (sections appear as agents finish) · failed (re-run only, no sign-off buttons).
- [ ] The three gates are readouts + links; no publish or sign-off mutation exists under `app/(dashboard)/run/`; `DecisionRail`'s gates are unweakened and unforked.
- [ ] `/desk`, `DeskScreen.tsx`, `DeskScreen.test.tsx`, `IssueCard.tsx` and `IssueCard.test.tsx` are gone; root redirects to `/run`.
- [ ] `/issues` is the Archive with titles, groups, search and filters, and still offers held reopen, the scheduled reservation, the repetition note, the create panel and the recently-published verification record.
- [ ] Editorial nav is exactly `The Run` + `Archive`; `/my-tasks`, `/issues/[n]/*` and the legacy redirects still resolve.
- [ ] No Convex schema change, no pipeline change, no issue row deleted.
- [ ] `pnpm --filter dispatch-control test` AND `pnpm --filter dispatch-control build` both pass.
</success_criteria>

<output>
After completion, create `.planning/quick/260730-ldn-the-run-surface-issue-titles-nav-consoli/260730-ldn-SUMMARY.md`
</output>
</content>
</invoke>
