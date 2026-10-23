---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 01
type: tdd
wave: 1
depends_on: []
files_modified:
  - apps/dispatch-control/lib/editorState.ts
  - apps/dispatch-control/lib/nomenclature.ts
  - apps/dispatch-control/lib/issueTitle.ts
  - apps/dispatch-control/lib/issueRouteResolver.ts
  - apps/dispatch-control/__tests__/editorState.test.ts
  - apps/dispatch-control/__tests__/BehindSteps.test.ts
  - apps/dispatch-control/__tests__/issueTitle.test.ts
  - apps/dispatch-control/__tests__/issueRouteResolver.test.ts
  - apps/dispatch-control/__tests__/helpers/jargonScan.ts
  - apps/dispatch-control/__tests__/jargonScan.test.ts
autonomous: true
requirements: [P56-B1, P56-B2, P56-A3]

must_haves:
  truths:
    - "Every run/issue state maps to exactly one of the six words: Done, Working, Waiting for you, Not yet, Stopped, Problem"
    - "A paused (gate-interrupt) step or run is Waiting for you, never Problem; a cancelled run is Stopped"
    - "The Home view-model gives four stations (Pick charity, Write, Check, Publish) and one slab sentence per Home state"
    - "Issues are labelled 'Issue N · Thursday D Month YYYY', never with a run id"
    - "Past issues open at /?run=<runId>, not at a section page"
  artifacts:
    - path: "apps/dispatch-control/lib/editorState.ts"
      provides: "Pure derivation: status words, stations, slab copy, part rows, Behind steps, archive rows, rewrite rules, banned-word pattern"
      exports: ["plainNameForKey", "deriveEditorHome", "homeSlabCopy", "partRowStatus", "partsHint", "PART_ORDER", "PART_LABELS", "PLAIN_STEPS", "deriveBehindSteps", "runStatusWord", "deriveArchiveRows", "AGENT_FOR_SECTION", "canRewrite", "formatCostLine", "EDITOR_BANNED_PATTERN", "RUN_ID_PATTERN", "COPY"]
    - path: "apps/dispatch-control/lib/nomenclature.ts"
      provides: "STATUS_WORDS (additive)"
      contains: "export const STATUS_WORDS"
    - path: "apps/dispatch-control/lib/issueTitle.ts"
      provides: "formatIssueLine, issueThursday"
      contains: "export function formatIssueLine"
  key_links:
    - from: "apps/dispatch-control/lib/editorState.ts"
      to: "apps/dispatch-control/lib/homeSections.ts"
      via: "deriveEditorHome takes HomeFooter + HomeSectionRow[] (wraps deriveHomeFooter, never forks it)"
      pattern: "import type \\{[^}]*HomeFooter"
    - from: "apps/dispatch-control/lib/editorState.ts"
      to: "apps/dispatch-control/lib/gateInterrupt.ts"
      via: "isGateInterrupt decides Waiting for you vs Problem"
      pattern: "isGateInterrupt"
---

<objective>
Build the single pure module (no React) that every Phase 56 screen renders from: the six status words, the four-station checklist, the "Your next step" slab copy per Home state, part-row status text, the 10 plain Behind-the-scenes steps, archive row grouping, run-status words, the "Rewrite this part" rules, and the shared banned-word pattern used by every tripwire test.

Purpose: Locked decision 3 (six words everywhere) and decision 2 (four stations) must come from one place so no screen can disagree. Research anti-pattern: do not fork run-state logic; wrap `deriveHomeFooter`.
Output: `lib/editorState.ts` + additive `STATUS_WORDS`, `formatIssueLine`, `issueOpenHref` → `/?run=`, with unit tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/ROADMAP.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-RESEARCH.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md
@apps/dispatch-control/lib/homeSections.ts
@apps/dispatch-control/lib/derivedState.ts
@apps/dispatch-control/lib/gateInterrupt.ts
@apps/dispatch-control/lib/issueTitle.ts
@apps/dispatch-control/lib/issueRouteResolver.ts
@apps/dispatch-control/lib/nomenclature.ts

<interfaces>
From lib/homeSections.ts (read-only in this plan):
```typescript
export type HomeRowState = 'writing' | 'not-written' | 'clean'
export interface HomeSectionRow { id: string; label: string; headline: string; state: HomeRowState; agentChanges: number; href: string }
export type HomeFooter =
  | { kind: 'loading' } | { kind: 'none' } | { kind: 'failed' } | { kind: 'gate1' }
  | { kind: 'stopped' } | { kind: 'running' } | { kind: 'published'; publishedAt: number | null } | { kind: 'ready' }
```
From lib/role.ts: `export type Role = 'Editor-in-chief' | 'Collaborator'`
From lib/gateInterrupt.ts: `isGateInterrupt(row: { agentKey?: string; status: string; error?: string | null }): boolean`
From lib/derivedState.ts: `deriveRunCostUsd(rows: Array<{costUsd?: number}> | undefined): number | undefined`
Convex `agent_runs` row: `{ runId, agentKey, status: 'queued'|'running'|'done'|'failed', startedAt?, completedAt?, costUsd?, error? }`
Convex `runs` row: `{ runId, status: string /* incl. 'cancelled' */, startedAt: number, completedAt?: number }`
Convex `issues.listWithTitles` row (read the handler in convex/issues.ts:298 for exact fields): includes `issueNumber, title, subtitle, published, held, runId (string|null), publishedAt?, runStartedAt?, scheduledFor?`.
</interfaces>
</context>

<feature>
  <name>editorState pure derivation</name>
  <files>apps/dispatch-control/lib/editorState.ts, apps/dispatch-control/__tests__/editorState.test.ts, apps/dispatch-control/__tests__/BehindSteps.test.ts</files>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: STATUS_WORDS, formatIssueLine, issueOpenHref (additive helpers)</name>
  <files>apps/dispatch-control/lib/nomenclature.ts, apps/dispatch-control/lib/issueTitle.ts, apps/dispatch-control/lib/issueRouteResolver.ts, apps/dispatch-control/__tests__/issueTitle.test.ts, apps/dispatch-control/__tests__/issueRouteResolver.test.ts</files>
  <read_first>
    - apps/dispatch-control/lib/nomenclature.ts (append only; do NOT change RUN_STEP_MAP — guarded by nomenclature.test.ts / runDetailActionNames.test.ts)
    - apps/dispatch-control/lib/issueTitle.ts and __tests__/issueTitle.test.ts
    - apps/dispatch-control/lib/issueRouteResolver.ts and __tests__/issueRouteResolver.test.ts
    - 56-UI-SPEC.md § "Status words" table and § "3. Issue header"
  </read_first>
  <behavior>
    - STATUS_WORDS has exactly the 6 keys in order Done, Working, Waiting for you, Not yet, Stopped, Problem
    - formatIssueLine({issueNumber:48, publishedAt:null, scheduledFor:null, runStartedAt: <Mon 26 Oct 2026 09:02 PT>, published:false}) === 'Issue 48 · Thursday 29 October 2026'
    - same with publishedAt = Thu 22 Oct 2026 and published:true → 'Issue 47 · Thursday 22 October 2026 · Published'
    - scheduledFor wins over runStartedAt; publishedAt wins over both
    - runStartedAt on a Thursday PT → that same Thursday
    - all inputs null → 'Issue 48' (no date, never 'Invalid Date')
    - issueOpenHref('r1','r1') === '/'; issueOpenHref('r2','r1') === '/?run=r2'
  </behavior>
  <action>
1. Append to `lib/nomenclature.ts` (additive only):
```typescript
// ─── Phase 56: the six editor status words (UI-SPEC "Status words") ───────
export type StatusWord = 'Done' | 'Working' | 'Waiting for you' | 'Not yet' | 'Stopped' | 'Problem'
export type StatusMarker = 'check' | 'ring' | 'hollow' | 'line' | 'exclamation'
export const STATUS_WORDS: Record<StatusWord, { colorVar: string; bold: boolean; marker: StatusMarker }> = {
  Done: { colorVar: '--color-done', bold: true, marker: 'check' },
  Working: { colorVar: '--color-amber-text', bold: true, marker: 'ring' },
  'Waiting for you': { colorVar: '--color-amber-text', bold: true, marker: 'ring' },
  'Not yet': { colorVar: '--color-ink-soft', bold: false, marker: 'hollow' },
  Stopped: { colorVar: '--color-ink-soft', bold: true, marker: 'line' },
  Problem: { colorVar: '--color-problem', bold: true, marker: 'exclamation' },
}
export const STATUS_WORD_ORDER: readonly StatusWord[] = ['Done', 'Working', 'Waiting for you', 'Not yet', 'Stopped', 'Problem']
```
(The CSS variables `--color-done`, `--color-amber-text`, `--color-problem` are added by plan 56-02 in the same wave; this file only names them as strings.)

2. Add to `lib/issueTitle.ts` (keep every existing export unchanged):
   - `export const EDITOR_TIME_ZONE = 'America/Los_Angeles'` (Andrew's zone).
   - `export function issueThursday(a: { publishedAt?: number | null; scheduledFor?: number | null; runStartedAt?: number | null }): number | null` — ASSUMPTION A1 (Open Question 1, user may override): returns `publishedAt` if set, else `scheduledFor`, else the first Thursday on or after `runStartedAt` computed in EDITOR_TIME_ZONE (Thursday itself counts), else null.
   - `export function formatLongDate(ms: number, withWeekday = true): string` — build from `Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: EDITOR_TIME_ZONE }).formatToParts(ms)` and join as `${weekday} ${day} ${month} ${year}` (or `${day} ${month} ${year}` when `withWeekday` is false) so ICU comma variance cannot leak in.
   - `export function formatIssueLine(a: { issueNumber: number | null; publishedAt?: number | null; scheduledFor?: number | null; runStartedAt?: number | null; published?: boolean }): string` → `Issue ${n} · ${formatLongDate(thursday)}` + (`published` ? ' · Published' : ''); if no date, `Issue ${n}`; if issueNumber null, `This week's issue`.
   - Add `export const NO_CHARITY_YET = 'Charity not chosen yet'`.
3. In `lib/issueRouteResolver.ts` change only `issueOpenHref` body for the non-current case to `` `/?run=${encodeURIComponent(runId)}` `` and update its doc comment ("opens that issue's Home view"). Update the matching expectation in `__tests__/issueRouteResolver.test.ts` and add the new formatIssueLine/issueThursday cases to `__tests__/issueTitle.test.ts` (use fixed epoch ms built with `Date.UTC`, e.g. Mon 26 Oct 2026 16:02 UTC = 09:02 PDT).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/issueTitle.test.ts __tests__/issueRouteResolver.test.ts __tests__/nomenclature.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "export const STATUS_WORDS" apps/dispatch-control/lib/nomenclature.ts` = 1
    - `grep -n "export function formatIssueLine" apps/dispatch-control/lib/issueTitle.ts` matches
    - `grep -n "/?run=" apps/dispatch-control/lib/issueRouteResolver.ts` matches; `grep -n "/s/originStory?run=" apps/dispatch-control/lib/issueRouteResolver.ts` returns nothing
    - the three test files pass
    - `git diff apps/dispatch-control/lib/nomenclature.ts` shows only added lines (no `-` lines other than the diff header)
  </acceptance_criteria>
  <done>Six-word table, issue-line formatter and past-issue href exist and are tested.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: lib/editorState.ts — Home, parts, run words, archive, rewrite, copy</name>
  <files>apps/dispatch-control/lib/editorState.ts, apps/dispatch-control/__tests__/editorState.test.ts</files>
  <read_first>
    - apps/dispatch-control/lib/homeSections.ts (deriveHomeFooter semantics: cancelled→stopped, failed→failed, awaiting-review+no completedAt→gate1)
    - apps/dispatch-control/lib/publishChain.ts (derivePublishGate reasons — editorState must agree: publishable only if footer ready, held false, role Editor-in-chief)
    - 56-RESEARCH.md § "State Mapping" (all three tables) and § "Archive row status"
    - 56-UI-SPEC.md § "Copywriting Contract" (both tables) and § "Status words"
  </read_first>
  <behavior>
    - deriveEditorHome: loading→state 'loading'; none→'empty'; running w<9→'writing' word Working; running w=9→'checking' Working; ready+held false+Editor-in-chief→'ready' Waiting for you, publishable true; ready+Collaborator→'ready-collab' word Not yet, publishable false; ready+role undefined→state 'ready', publishable false (never the Collaborator sentence while loading); ready or running + held true→'held' Waiting for you (any role); published→'published' Done; stopped→'stopped' Stopped; failed→'problem' Problem; gate1→'stuck' Waiting for you (NEVER Problem); pinned + not current + not published + not failed/stopped → 'older' (read-only, publishable false)
    - stations: always 4, names ['Pick charity','Write','Check','Publish']; Pick charity Done whenever state ∉ {loading, empty}; writing w=5 → Write 'Working · 5 of 9 parts' (aria current), Check 'Not yet', Publish 'Not yet'; checking → Write 'Done · all nine parts', Check 'Working'; ready with 6 fixes → Check 'Done · 6 fixes made', 1 fix → 'Done · 1 fix made', Publish 'Now — waiting for you'; ready-collab → Publish 'Now — waiting for the editor-in-chief'; published → Publish 'Done · Thursday 22 October'; problem w<9 → Write word Problem; problem w=9 → Check word Problem; stopped → current-station word Stopped
    - exactly one station has current=true unless state is published (none current) or loading/empty
    - partRowStatus clean n=0 → 'Written'; n=1 → 'Written · 1 fix by the writers'; n=2 → 'Written · 2 fixes by the writers'; writing → 'Working' linked false; not-written → 'Not yet' linked false; published issue clean → 'Published' linked true
    - runStatusWord: complete→Done; cancelled→Stopped; failed→Problem; failed with interrupt=true→Waiting for you; running→Working; awaiting-review→Waiting for you; anything else→Not yet
    - deriveArchiveRows omits runId===null rows; cancelled/failed runs go to `unfinished` with reasons; current run row flagged `current: true` with status 'Waiting for you · this week' or 'Working'; published rows status 'Published' word Done; newest issueNumber first
    - canRewrite: true for originStory/problemStatement/founderBio/caseStudy and bonus when bonusType==='specAd'; false for game, theme, deliberation-conversation, podcast, bonus jingle/bigBudget, any section when published===true or runStatus==='running'
    - EDITOR_BANNED_PATTERN matches 'Trigger Run', 'Re-roll', 'Calibrator', 'agent', 'Failed', 'pipeline' but NOT 'Rewrite this part', 'returns', 'running total'? (see action: `\bruns?\b` only)
  </behavior>
  <action>
Create `apps/dispatch-control/lib/editorState.ts`. Header comment: "Phase 56 — single pure source for every editor screen. No React, no Convex, no clock reads (pass `now`)." Imports only: `import type { HomeFooter, HomeSectionRow } from '@/lib/homeSections'`, `import type { Role } from '@/lib/role'`, `import type { StatusWord } from '@/lib/nomenclature'`, `import { isGateInterrupt } from '@/lib/gateInterrupt'`, `import { formatLongDate, EDITOR_TIME_ZONE } from '@/lib/issueTitle'`.

Exports (exact names; downstream plans 56-03..56-12 import these):

```typescript
export const PART_ORDER = ['originStory','problemStatement','founderBio','caseStudy','bonus','game','deliberation-conversation','podcast','theme'] as const
export const PART_LABELS: Record<string, string> = { originStory: 'Origin story', problemStatement: 'Problem', founderBio: 'Founder', caseStudy: 'Case study', bonus: 'Bonus', game: 'Game', 'deliberation-conversation': 'Deliberation', podcast: 'Podcast', theme: 'Look' }
export const STATION_NAMES = ['Pick charity', 'Write', 'Check', 'Publish'] as const
export type HomeState = 'loading'|'empty'|'writing'|'checking'|'ready'|'ready-collab'|'held'|'published'|'stopped'|'problem'|'stuck'|'older'
export interface StationVM { name: (typeof STATION_NAMES)[number]; word: StatusWord; line: string; current: boolean; complete: boolean }
export interface EditorHomeVM { state: HomeState; word: StatusWord | null; stations: StationVM[]; writtenCount: number; fixCount: number; publishable: boolean }
export function deriveEditorHome(a: { footer: HomeFooter; held: boolean | undefined; role: Role | undefined; rows: HomeSectionRow[] | undefined; pinnedOlder?: boolean }): EditorHomeVM
export type SlabAction = 'publish'|'start-next'|'start-new'|'start-first'|'release'|'stop-stuck'
export interface SlabCopy { sentence: string; explanation?: string; action?: SlabAction; actionLabel?: string; working: boolean; link?: 'preview'|'website'|'what-happened'; linkLabel?: string }
export function homeSlabCopy(vm: EditorHomeVM, ctx: { issueNumber: number | null; startedAt?: number; publishedAt?: number | null; now: number }): SlabCopy
export function partRowStatus(row: Pick<HomeSectionRow,'state'|'agentChanges'>, ctx: { published: boolean }): { text: string; word: StatusWord; linked: boolean }
export function partsHint(state: HomeState): string
export function runStatusWord(a: { status: string; interrupt?: boolean }): StatusWord
export interface ArchiveRowVM { runId: string; issueNumber: number; dateLine: string; title: string; word: StatusWord; statusText: string; reason?: string; current: boolean; publishedUrl?: string | null }
export function deriveArchiveRows(a: { issues: Array<{ issueNumber: number; title: string | null; published: boolean; runId: string | null; publishedAt?: number | null; runStartedAt?: number | null; scheduledFor?: number | null; slug?: string | null }>; runs: Array<{ runId: string; status: string; startedAt: number; completedAt?: number }> | undefined; currentRunId: string | null }): { listed: ArchiveRowVM[]; unfinished: ArchiveRowVM[] } | undefined
export const AGENT_FOR_SECTION: Record<string, string> = { originStory: 'origin_story', problemStatement: 'problem', founderBio: 'founder_bio', caseStudy: 'case_study', bonus: 'bonus', game: 'game', theme: 'design' }
export function canRewrite(a: { sectionId: string; bonusType?: string; published: boolean; runStatus?: string }): boolean
export function formatCostLine(a: { costUsd: number | undefined; startedAt?: number; completedAt?: number; mode: 'finished' | 'stopped' }): string | null
export const EDITOR_BANNED_PATTERN = /\b(runs?|trigger|pipeline|graph|DAG|drift|re-?roll|calibrator|chronicler|agents?|tokens?|gate|interrupt|deterministic|awaiting-review|failed)\b/i
export const RUN_ID_PATTERN = /\b[0-9a-f]{8,}\b/i
export const COPY = { ...see table below... } as const
```

Rules:
- `deriveEditorHome`: map per 56-RESEARCH "Run / issue state to Home state" table. `writtenCount` = rows with state 'clean'; `fixCount` = sum of `agentChanges`. `held === true` with footer ready|running → 'held'. `pinnedOlder === true` with footer ready|running|gate1 → 'older'. `publishable` = state === 'ready' && role === 'Editor-in-chief' && held === false. `word`: per table (ready-collab → 'Not yet', older → 'Not yet', loading/empty → null). Stations per 56-RESEARCH "Four stations" table; `complete` true for Done stations (drives cobalt disc + connector). Published Publish line: `Done · ${formatLongDate(publishedAt)}` without the year: use weekday + day + month (e.g. 'Done · Thursday 22 October').
- `homeSlabCopy` strings (verbatim; `{N}` = issueNumber, numbers 0–9 spelled with NUMBER_WORDS = ['None','One','Two','Three','Four','Five','Six','Seven','Eight','Nine']):
  - ready: sentence 'Read the issue, then publish it.' explanation 'Everything is written and checked. Open any part below to read it or change the words. When you\'re happy, press Publish.' action 'publish' label `Publish Issue {N}` link 'preview' label 'Preview the issue first'
  - ready (role undefined): same sentence/explanation, no action, working false
  - ready-collab: sentence 'Waiting for the editor-in-chief to publish.' explanation 'Everything is written and checked. You can open any part below to read it or change the words.' no action
  - writing: sentence 'Nothing for you to do yet. The writers are on it.' explanation `Issue {N} started at {h:mm} {this morning|this afternoon|this evening}. {Five} of the nine parts are written. This page updates by itself, so come back when it says the issue is ready.` (if startedAt is not the same EDITOR_TIME_ZONE day as now: `started on {Weekday} at {h:mm}`; w=0: 'None of the nine parts are written yet.'; w=1: 'One of the nine parts is written.'), working true
  - checking: 'Nothing for you to do yet. The writers are checking their work.' / 'All nine parts are written. They are being checked and fixed. This page updates by itself.' working true
  - held: 'This issue is on hold.' / 'It will not go out until you release it. You can still read and change the parts.' action 'release' label 'Release this issue' link 'preview'
  - published: `Issue {N} went out on {Weekday}. Start the next one when you're ready.` / 'Readers can see it now. Starting the next issue takes one click: the writers pick a charity and write all nine parts, then this page tells you when it\'s your turn.' action 'start-next' label 'Start next week\'s issue' link 'website' label `Read Issue {N} on the website`
  - problem: 'This issue hit a problem and stopped. Nothing reached readers.' / 'There is nothing to fix here by hand. Start a new issue and the writers will try again from the beginning, usually without trouble.' action 'start-new' 'Start a new issue' link 'what-happened' 'What happened'
  - stopped — ASSUMPTION A3a (Open Question 3): 'This issue was stopped. Nothing reached readers.' / 'Start a new issue when you\'re ready. The writers will begin again from the start.' action 'start-new' 'Start a new issue'
  - stuck — ASSUMPTION A3b: 'This older issue can\'t continue.' / 'It paused on an older version of the system and can\'t finish. Stop it, then start a new issue.' action 'stop-stuck' label 'Stop this issue'
  - empty: 'No issue yet this week' / 'Start the first issue and the writers will pick a charity and write all nine parts. This page will tell you when it\'s your turn.' action 'start-first' 'Start the first issue'
  - older — ASSUMPTION A7 (Open Question 7): 'This older issue was never published.' / 'You can read its parts. Only this week\'s issue can be published.' no action
  - published + pinned past issue is handled by the view (sentence `Issue {N} went out on {Weekday}.`, explanation 'Readers can see it now. You can still open a part to read it.', no action) — export it as `homeSlabCopy(vm, {..., pinned: true})` variant (add optional `pinned?: boolean` to ctx).
- `partsHint`: ready/ready-collab/held/older → 'Click a part to read it or change the words.'; writing/checking → 'Finished parts open as soon as they\'re written.'; published → 'You can still open a part to read it. Changes after publishing need a new issue.'; else ''.
- `deriveArchiveRows`: returns undefined while `runs` undefined. Join issue.runId → run. Skip runId null. Status: published===true or run.status==='complete' → listed, word Done, statusText 'Published'; run.runId===currentRunId and not published → listed, current true, statusText 'Waiting for you · this week' when run.status==='awaiting-review' && completedAt != null, else 'Working' (word Working) — but if current run is cancelled/failed it goes to unfinished like any other; cancelled → unfinished word Stopped; failed → unfinished word Problem; other non-current (e.g. old awaiting-review never published) → unfinished word Stopped with reason 'Never finished'. ASSUMPTION A5 (Open Question 5) reasons: title null → 'Stopped before a charity was chosen' (Stopped) / 'Hit a problem before a charity was chosen' (Problem); title set → 'Stopped while it was being written' / 'Hit a problem while it was being written'. dateLine = `Issue {N} · {formatLongDate(issueThursday(...), false)}` (no weekday, e.g. 'Issue 47 · 22 October 2026'). title = issue.title ?? 'Charity not chosen yet'. Sort both lists by issueNumber desc.
- `formatCostLine`: costUsd undefined → null. finished: `This issue cost $${cost.toFixed(2)} to write and took ${minutes} minutes.` (minutes = round((completedAt-startedAt)/60000), '1 minute' singular; omit the 'and took…' clause if either time missing → `This issue cost $0.58 to write.`). stopped: `This attempt cost $${cost.toFixed(2)} before it stopped.`
- `COPY` constant object with keys and verbatim UI-SPEC "Other copy" strings: holdExplanation, stopExplanation, sectionToolbarHelper ('Click any paragraph to change the words. Changes save to this issue straight away.'), sectionPublishedHelper ('This issue is published. Changes after publishing need a new issue.'), rewriteButton ('Rewrite this part'), editReassurance, saved ('Saved'), saveFailed, publishFailed (template with {N}), startFailed ('We couldn\'t start a new issue just now. Wait a minute and press Start a new issue again.'), loadFailed ('This page didn\'t load. Check your connection, then press Reload this page.'), reloadButton ('Reload this page'), rewriteInProgress ('Rewriting this part…'), rewriteResult ('Here is the new version. Keep it or go back to the old one.'), keepVersion ('Keep this version'), goBack ('Go back to the old one'), stopConfirmTitle ('Stop writing this issue?'), stopConfirmBody (template 'This throws away what has been written so far for {issue}. Nothing has reached readers. You can start a new issue straight after.'), stopConfirm ('Stop writing'), stopCancel ('Keep writing'), discardTitle ('Leave without saving?'), discardBody ('Your changes to this paragraph haven\'t been saved.'), discardConfirm ('Leave without saving'), discardCancel ('Keep editing'), holdButton ('Hold this issue'), stopButton ('Stop writing this issue'), releaseButton ('Release this issue'), holdReason ('Held by the editor' — ASSUMPTION A6: fixed reason, held reason/by never shown), sectionSlab ('Read this part and change any words you like. Then go back to the issue to publish it.'), archiveSlab ('Nothing is waiting here. Open an issue to read it or change its words.'), archiveSlabWaiting (template 'Issue {N} is waiting for you.'), behindSlab ('Nothing here needs you this week. The issue is waiting for you on the front page.'), subPageSlab ('Nothing here is needed to publish this week\'s issue.' — ASSUMPTION A8: generic slab on every dial sub-page), backToIssue ('Back to the issue'), thisWeeksIssue ('This week\'s issue'), backToBehind ('Back to behind the scenes'), emptyArchive ('No past issues yet. Once you publish an issue it will be listed here.'), emptySearch (template 'No issue matches "{query}". Try a charity name or an issue number.').
- `EDITOR_BANNED_PATTERN` exactly as above. Tests MUST strip `<pre>` text before applying it and MUST not apply it to charity names from fixtures (fixtures use names without banned words).

Write `__tests__/editorState.test.ts` (`import { describe, it, expect } from 'vitest'`, node env) covering every behavior bullet, plus: every SlabCopy string across all states fails `EDITOR_BANNED_PATTERN` and `RUN_ID_PATTERN`; at most one `action` per state.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/editorState.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^export" apps/dispatch-control/lib/editorState.ts` >= 18
    - `grep -n "from 'react'\|convex/react\|Date.now()" apps/dispatch-control/lib/editorState.ts` returns nothing
    - `grep -n "isGateInterrupt" apps/dispatch-control/lib/editorState.ts` matches
    - `grep -n "'Now — waiting for the editor-in-chief'" apps/dispatch-control/lib/editorState.ts` matches
    - test `gate1 → stuck never Problem` exists: `grep -n "stuck" apps/dispatch-control/__tests__/editorState.test.ts` matches
    - editorState.test.ts passes
  </acceptance_criteria>
  <done>All Home/parts/archive/rewrite derivations are pure, tested, and copy is verbatim from UI-SPEC.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: PLAIN_STEPS + deriveBehindSteps + plainNameForKey + shared jargon-scan helper</name>
  <files>apps/dispatch-control/lib/editorState.ts, apps/dispatch-control/__tests__/BehindSteps.test.ts, apps/dispatch-control/__tests__/helpers/jargonScan.ts, apps/dispatch-control/__tests__/jargonScan.test.ts</files>
  <read_first>
    - 56-RESEARCH.md § "Behind-the-scenes plain steps (10)" table
    - apps/dispatch-control/lib/gateInterrupt.ts
    - apps/dispatch-control/lib/nomenclature.ts RUN_STEP_MAP keys (to confirm agentKey spellings)
  </read_first>
  <behavior>
    - PLAIN_STEPS has 10 entries in order with names exactly: Find story leads; Find charities worth writing about; Check the charities are real; Choose this week's charity; Research the charity; Check the research against its sources; Write the nine parts; Check the writing and fix problems; Final read-through; Publish
    - all member rows done → Done, line 'Done · 9:04' from the latest completedAt (PT, h:mm, no leading zero)
    - step 8 done with fixCount 6 → 'Done · 9:39 · 6 fixes' ('1 fix' singular)
    - a failed non-interrupt row → Problem, line 'Problem'; later steps with no rows → 'Not yet' (ASSUMPTION A4: never 'Not started')
    - a failed row whose error starts 'Interrupt(' on editor_gate_1 → Waiting for you, never Problem
    - any running row → Working
    - runStatus 'cancelled' → every not-Done step is Stopped
    - 'calibrator' rows are ignored; unknown agentKeys ignored
    - `firstProblemStep(steps)` returns the key of the first Problem step or null
  </behavior>
  <action>
Append to `lib/editorState.ts`:
```typescript
export interface PlainStep { key: string; name: string; agentKeys: readonly string[] }
export const PLAIN_STEPS: readonly PlainStep[] = [
  { key: 'leads', name: 'Find story leads', agentKeys: ['signal_editor'] },
  { key: 'charities', name: 'Find charities worth writing about', agentKeys: ['scout', 'advocate'] },
  { key: 'verify-charities', name: 'Check the charities are real', agentKeys: ['verify_candidates'] },
  { key: 'choose', name: "Choose this week's charity", agentKeys: ['editor_gate_1', 'chronicler'] },
  { key: 'research', name: 'Research the charity', agentKeys: ['researcher'] },
  { key: 'verify-research', name: 'Check the research against its sources', agentKeys: ['verify_research'] },
  { key: 'write', name: 'Write the nine parts', agentKeys: ['origin_story','problem','founder_bio','case_study','game','bonus','design','validate_sections'] },
  { key: 'check', name: 'Check the writing and fix problems', agentKeys: ['qa'] },
  { key: 'final', name: 'Final read-through', agentKeys: ['editor_final'] },
  { key: 'publish', name: 'Publish', agentKeys: ['publisher'] },
]
export interface StepVM { key: string; name: string; word: StatusWord; line: string; error?: string }
export function formatClock(ms: number): string   // 'h:mm' in EDITOR_TIME_ZONE, 12-hour, no am/pm, e.g. '9:04'
export function deriveBehindSteps(a: { agentRuns: Array<{ agentKey: string; status: string; completedAt?: number; error?: string | null }> | undefined; runStatus: string | undefined; fixCount?: number }): StepVM[] | undefined
export function firstProblemStep(steps: StepVM[]): string | null
```
Also export `plainNameForKey(agentKey: string): string` — writers: origin_story 'Origin story writer', problem 'Problem writer', founder_bio 'Founder writer', case_study 'Case study writer', game 'Game writer', bonus 'Bonus writer', design 'Look designer'; calibrator 'Weekly style note'; any other key in PLAIN_STEPS → that step's name; unknown keys → key with '_' replaced by ' ' and first letter capitalised. Used by plans 56-10/56-11 wherever an agent key would be shown.

Create `__tests__/helpers/jargonScan.ts` (shared by plans 56-10, 56-11, 56-12; not a test file itself):
```typescript
import { readFileSync } from 'node:fs'
export const UI_JARGON = /\b(runs?|trigger(ed)?|pipeline|graph|DAG|drift|re-?roll(ed)?|calibrator|chronicler|tokens?|agents?|interrupt|deterministic|awaiting[- ]review|failed|run detail)\b/i
/** Returns user-facing strings in a .tsx/.ts source that contain jargon: JSX text between tags, and the string values of label/title/description/placeholder/aria-label/heading props or object keys. Code identifiers, imports, comments and className values are ignored. */
export function jargonInSource(path: string, allow?: string[]): string[]   // `allow` = exact flagged strings a caller has reviewed as code, not UI text (each needs a comment in the calling test)
```
Implementation: strip `/* */` and `//` comments; collect (a) `/>([^<>{}]+)</g` captures (trimmed, non-empty), (b) `/(?:label|title|description|placeholder|aria-label|heading|confirmLabel|cancelLabel|body)\s*[:=]\s*(['"`])((?:(?!\1).)*)\1/g` captures; return those matching UI_JARGON. `__tests__/jargonScan.test.ts`: fixture strings — `<h1>Run Detail</h1>` flagged; `label: 'Trigger Run'` flagged; `import DriftStrip from './DriftStrip'` NOT flagged; `status === 'failed'` NOT flagged; `className="font-mono"` NOT flagged; `<p>Start a new issue</p>` NOT flagged (write fixtures to a temp file under os.tmpdir()).

Fold rules exactly as the behavior list. `line` for non-Done steps equals the word. `error` = the raw `error` of the failing row (consumed ONLY by the collapsed Technical details `<pre>` on Behind-Run). Return undefined while `agentRuns` is undefined. Write `__tests__/BehindSteps.test.ts` covering each behavior bullet with fixed epoch timestamps.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control exec vitest run __tests__/BehindSteps.test.ts __tests__/editorState.test.ts __tests__/jargonScan.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "export function jargonInSource" apps/dispatch-control/__tests__/helpers/jargonScan.ts` matches; `grep -n "export function plainNameForKey" apps/dispatch-control/lib/editorState.ts` matches
    - `grep -c "agentKeys:" apps/dispatch-control/lib/editorState.ts` = 10
    - `grep -n "Not started" apps/dispatch-control/lib/editorState.ts` returns nothing
    - `grep -n "export function deriveBehindSteps" apps/dispatch-control/lib/editorState.ts` matches
    - both test files pass
  </acceptance_criteria>
  <done>The 10 plain steps and their six-word statuses derive purely from agent_runs rows.</done>
</task>

</tasks>

<verification>
`pnpm --filter dispatch-control exec vitest run __tests__/editorState.test.ts __tests__/BehindSteps.test.ts __tests__/issueTitle.test.ts __tests__/issueRouteResolver.test.ts __tests__/nomenclature.test.ts __tests__/homeSections.test.ts` all green. No React imports in lib/editorState.ts.
</verification>

<success_criteria>
P56-B1 (six words from one module) and P56-B2 (stations + slab copy per state) are proven by unit tests; assumptions A1, A3a, A3b, A4, A5, A6, A7, A8 are recorded inline in code comments and in the SUMMARY so the user can override.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-01-SUMMARY.md` listing every export and every ASSUMPTION (A1–A8) with its chosen answer.
</output>
