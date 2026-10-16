---
phase: 52-issue-the-front-door
plan: 01
type: tdd
wave: 1
depends_on: []
files_modified:
  - apps/dispatch-control/lib/homeSections.ts
  - apps/dispatch-control/__tests__/homeSections.test.ts
autonomous: true
requirements: [HOME-02, HOME-03, HOME-04, HOME-05, HOME-06, HOME-09]

must_haves:
  truths:
    - "The nine stories come out in EDITABLE_SECTIONS order with the produced headline, or a fixed descriptor for Deliberation/Podcast/Theme — never an invented title"
    - "A story's state is derived only from open error-severity findings (any axis) + open contradicted claims; warnings never make a story 'fix'"
    - "A story with blocking problems links to /s/{id}#finding-{firstErrorFindingId}, or /s/{id} when only claims block"
    - "Nothing comes back 'clean' or 'ready' while the draft, findings, claims, claim summary, sign-offs or issue row are still undefined"
    - "The footer model names the exact stories that block, plus unattributed contradicted claims and unattributed error findings, so Publish can never be off with no named reason"
  artifacts:
    - path: "apps/dispatch-control/lib/homeSections.ts"
      provides: "deriveHomeSections, deriveHomeFooter, rowNote, footer copy constants"
      exports: ["deriveHomeSections", "deriveHomeFooter", "rowNote", "fixSentencePrefix", "RUNNING_SENTENCE", "READY_SENTENCE"]
    - path: "apps/dispatch-control/__tests__/homeSections.test.ts"
      provides: "Selector + footer unit tests (headline / state / href / footer / loading)"
  key_links:
    - from: "apps/dispatch-control/lib/homeSections.ts"
      to: "lib/galley/findingState.ts isOpenFinding + lib/derivedState.ts isOpenBlocking/draftSectionIdsFromDraft + lib/galley/sectionIdMap.ts qaSectionToGalleyId"
      via: "imports — never re-implemented predicates"
      pattern: "isOpenFinding|isOpenBlocking|draftSectionIdsFromDraft|qaSectionToGalleyId"
---

<objective>
Write the ONE pure selector the front door renders from: per-story rows (headline, derived state, blocking count, deep-link href) and a footer model (which sentence, which stories to name). TDD: tests first.

Purpose: every number the page shows and every Publish-disable reason must come from one definition of "blocking" that equals the server's gate (52-RESEARCH Q3/Q5, Pitfalls 1, 2, 6). A second definition is this phase's main failure mode.
Output: `lib/homeSections.ts` + `__tests__/homeSections.test.ts`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/52-issue-the-front-door/52-CONTEXT.md
@.planning/phases/52-issue-the-front-door/52-RESEARCH.md
@apps/dispatch-control/lib/derivedState.ts
@apps/dispatch-control/lib/editableSections.ts

<interfaces>
From apps/dispatch-control/lib/editableSections.ts:
```ts
export interface SectionMeta { id: string; label: string }
export const EDITABLE_SECTIONS: SectionMeta[]  // originStory, problemStatement, founderBio, caseStudy, bonus, game, deliberation-conversation, podcast, theme
```
From apps/dispatch-control/lib/derivedState.ts:
```ts
export interface DerivationInputs { qaFindings: Array<{_id: string; severity: 'info'|'warning'|'error'; axis?: string; sectionName: string; reason: string; accepted?: boolean; resolution?: 'accepted'|'dismissed'|null; timestamp?: number}> | undefined; claimRows: Array<{_id: string; status: string; sectionName?: string; verdict?: string; changedSinceCheck?: boolean; ...}> | undefined; runStatus: string | undefined; runCompletedAt?: number; issue: {held: boolean; published: boolean} | null | undefined; signOffs: Record<string,{actorId:string;signedAt:number}> | undefined; ... }
export function draftSectionIdsFromDraft(draft: DraftResponse): ReadonlySet<string>
export { isOpenBlocking }   // re-exported from convex/lib/claimGate.ts: verdict==='contradicted' && status==='pending' && changedSinceCheck!==true
```
From apps/dispatch-control/lib/galley/findingState.ts: `export function isOpenFinding(row: {accepted?: boolean; resolution?: 'accepted'|'dismissed'|null}): boolean`
From apps/dispatch-control/lib/galley/sectionIdMap.ts: `export function qaSectionToGalleyId(qaName: string): string | null` (snake_case QA name -> galley id; podcast/theme/deliberation -> null)
From apps/dispatch-control/lib/contentPatchClient.ts: `DraftResponse { revisionId; sections: Record<string,{headline?: string; blocks; lossy}>; theme; game; bonus; bonusType; podcast; conversation }` — `game.headline`, `bonus.headline` are the produced headlines for those rows.
Claim rows' `sectionName` is ALREADY a galley id (no mapping). QA rows' `sectionName` is snake_case (map through qaSectionToGalleyId).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — homeSections.test.ts</name>
  <files>apps/dispatch-control/__tests__/homeSections.test.ts</files>
  <read_first>
    - apps/dispatch-control/lib/derivedState.ts (DerivationInputs, draftSectionIdsFromDraft, isOpenBlocking)
    - apps/dispatch-control/lib/galley/sectionIdMap.ts
    - apps/dispatch-control/__tests__/runSections.test.ts (fixture style for drafts/findings)
    - .planning/phases/52-issue-the-front-door/52-CONTEXT.md ("Problems on the page", "Footer sentence", "Resolved after research")
  </read_first>
  <behavior>
    Group specs in `describe` blocks whose names contain the filter words used by 52-VALIDATION: "headline", "state", "href", "footer", "loading".
    - headline: full draft fixture -> 9 rows, ids in EDITABLE_SECTIONS order; originStory headline = draft.sections.originStory.headline; game row = draft.game.headline ('The Filtration Layer'); bonus row = draft.bonus.headline; deliberation-conversation = 'How the agents chose this charity'; podcast = 'This week's episode' (typographic apostrophe U+2019: `This week’s episode`); theme = 'Colours and fonts for this issue'; a long-read with headline '' or missing falls back to its label.
    - state: open error finding (sectionName 'game', axis undefined) -> game row state 'fix', blockingCount 1; open error finding with axis 'voice' (any non-factual axis) also counts as blocking; open WARNING and INFO findings -> state 'clean', blockingCount 0; finding with resolution 'dismissed' or accepted true -> not counted; contradicted pending claim with sectionName 'game' -> counted (2 with the finding); claim with verdict 'supported' or status 'signed-off' or changedSinceCheck true -> not counted; section absent from draft + runStatus 'running' -> 'writing'; absent + 'awaiting-review' -> 'not-written'; absent but with a blocking finding -> 'fix'; QA finding whose sectionName maps to null (e.g. 'podcast' or 'unknown_section') with severity error -> NOT bucketed into any row, increments `unattributedFindings`; contradicted claim with sectionName undefined or 'nonsense' -> increments `unattributedClaims`.
    - href: game row with finding _id 'f9' first in qaFindings order -> href '/s/game#finding-f9'; two error findings in a section -> firstFindingId is the earlier one in array order; claim-only blocker -> href '/s/game'; clean row -> '/s/originStory'.
    - note: rowNote for blockingCount 1 -> '1 thing to fix →'; 3 -> '3 things to fix →'; clean -> 'Reads clean'; writing -> 'Being written…'; not-written -> 'Not written yet'.
    - footer: see Task 2 action for each kind; assert fixSentencePrefix(1) === '1 story has something to fix: ' and fixSentencePrefix(2) === '2 stories have something to fix: '; one game blocker in an awaiting-review completed run -> footer.kind 'fix' with stories [{id:'game',label:'Game',href:'/s/game#finding-f9'}]; zero blockers + claimSummaryBlocking 0 + all nine present -> 'ready'; claimSummaryBlocking 2 but only 1 attributed claim -> footer 'fix' with unattributedClaims 1 (server summary wins); running -> 'running'; failed -> 'failed'; awaiting-review with runCompletedAt undefined -> 'gate1'; issue.published true -> 'published' (even if runStatus 'complete'); runStatus 'complete' and not published -> 'closed'; any not-written story in a completed run -> 'fix' with notWritten listing it.
    - loading: deriveHomeSections returns undefined when draft is undefined, qaFindings undefined, or claimRows undefined; deriveHomeFooter returns {kind:'loading'} when stateKind 'loading', sections undefined, claimSummaryBlocking undefined, signOffsLoaded false, or issue undefined. No input combination with any of those undefined returns 'ready'.
  </behavior>
  <action>
    Create `apps/dispatch-control/__tests__/homeSections.test.ts` (node env, `.test.ts`, no React) importing `{ deriveHomeSections, deriveHomeFooter, rowNote, fixSentencePrefix, RUNNING_SENTENCE, READY_SENTENCE }` from `@/lib/homeSections` and implementing every spec listed in <behavior>. Build one full `DraftResponse` fixture with all nine sections present (four long-reads with headline + 1 paragraph block, `game: {headline: 'The Filtration Layer', embedCode: '<canvas></canvas>'}`, `bonus: {headline: 'Spec Ad', body: [...]}`, `podcast: {transcript: 'x'}`, `conversation: [{speaker:'Scout', text:'x'}]`, `theme: {fontDisplay:'Newsreader'}`). Also assert the copy constants verbatim: `RUNNING_SENTENCE === 'Still writing — Publish turns on once every story is written and nothing needs fixing.'` and `READY_SENTENCE === 'Ready to publish. Nothing left to fix. The agents checked the facts; none were contradicted.'`. Run it and confirm it fails (module not found). Commit: `test(52-01): add failing homeSections selector tests`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm exec vitest run __tests__/homeSections.test.ts 2>&1 | grep -E "FAIL|Failed|Cannot find|failed" </automated>
  </verify>
  <acceptance_criteria>
    - File `apps/dispatch-control/__tests__/homeSections.test.ts` exists and contains the strings `describe('headline'`, `describe('state'`, `describe('href'`, `describe('footer'`, `describe('loading'` (or the same names in `describe("…"` form)
    - grep finds `How the agents chose this charity`, `Colours and fonts for this issue`, `1 thing to fix →`, `Reads clean`, `Being written…`, `/s/game#finding-f9` in the test file
    - The test run fails before Task 2 (module `@/lib/homeSections` missing)
  </acceptance_criteria>
  <done>Failing test file committed covering all behaviours above.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — implement lib/homeSections.ts</name>
  <files>apps/dispatch-control/lib/homeSections.ts</files>
  <read_first>
    - apps/dispatch-control/__tests__/homeSections.test.ts (from Task 1)
    - apps/dispatch-control/lib/derivedState.ts lines 81-146, 181-183, 340-420
    - apps/dispatch-control/lib/runSections.ts (never-clean discipline precedent, lines ~122-216)
    - apps/dispatch-control/lib/galley/findingState.ts, lib/galley/sectionIdMap.ts
  </read_first>
  <action>
    Create `apps/dispatch-control/lib/homeSections.ts` (pure, no React, no 'use client'). Header docstring: Phase 52 (HOME-02..06, HOME-09) — the ONE definition of "blocking" for the front door = server gate parity (api/signoffs.py + review.py): open `severity==='error'` QA findings on ANY axis + `isOpenBlocking` claims. Warnings/infos never count (52-CONTEXT "Resolved after research"). Use `// ─── Name ───` section headers.

    Imports (compose, never re-implement): `EDITABLE_SECTIONS` from `@/lib/editableSections`; `draftSectionIdsFromDraft, isOpenBlocking, type DerivationInputs` from `@/lib/derivedState`; `isOpenFinding` from `@/lib/galley/findingState`; `qaSectionToGalleyId` from `@/lib/galley/sectionIdMap`; `type DraftResponse` from `@/lib/contentPatchClient`.

    Exports exactly:
    ```ts
    export type HomeRowState = 'writing' | 'not-written' | 'fix' | 'clean'
    export interface HomeSectionRow { id: string; label: string; headline: string; state: HomeRowState; blockingCount: number; firstFindingId: string | null; href: string }
    export interface HomeSectionsResult { rows: HomeSectionRow[]; attributedClaims: number; unattributedClaims: number; unattributedFindings: number; totalBlocking: number }
    export const SECTION_DESCRIPTORS: Record<string, string> = { 'deliberation-conversation': 'How the agents chose this charity', podcast: 'This week’s episode', theme: 'Colours and fonts for this issue' }
    export const RUNNING_SENTENCE = 'Still writing — Publish turns on once every story is written and nothing needs fixing.'
    export const READY_SENTENCE = 'Ready to publish. Nothing left to fix. The agents checked the facts; none were contradicted.'
    export const NONE_SENTENCE = 'There is no current issue yet.'
    export const FAILED_SENTENCE = 'This run failed before the issue was finished, so there is nothing to publish.'
    export const GATE1_SENTENCE = 'The agents are waiting for you to choose the charity.'
    export const CLOSED_SENTENCE = 'This run is closed and was not published.'
    export function deriveHomeSections(args: { draft: DraftResponse | null | undefined; qaFindings: DerivationInputs['qaFindings']; claimRows: DerivationInputs['claimRows']; runStatus: string | undefined }): HomeSectionsResult | undefined
    export function rowNote(row: Pick<HomeSectionRow, 'state' | 'blockingCount'>): string
    export function fixSentencePrefix(storyCount: number): string
    export function unattributedClaimSentence(n: number): string
    export function unattributedFindingSentence(n: number): string
    export type HomeFooter =
      | { kind: 'loading' } | { kind: 'none' } | { kind: 'failed' } | { kind: 'gate1' } | { kind: 'closed' } | { kind: 'running' }
      | { kind: 'published'; publishedAt: number | null }
      | { kind: 'fix'; stories: Array<{ id: string; label: string; href: string }>; notWritten: Array<{ id: string; label: string }>; unattributedClaims: number; unattributedFindings: number }
      | { kind: 'ready' }
    export function deriveHomeFooter(args: { stateKind: 'loading' | 'none' | 'run'; sections: HomeSectionsResult | undefined; claimSummaryBlocking: number | undefined; signOffsLoaded: boolean; issue: { held: boolean; published: boolean } | null | undefined; publishedAt: number | null | undefined; runStatus: string | undefined; runCompletedAt: number | undefined }): HomeFooter
    ```

    deriveHomeSections: return `undefined` if `draft === undefined || qaFindings === undefined || claimRows === undefined` (HOME-09). `draft === null` means "draft confirmed unavailable" (caller passes null only when the fetch failed while running) -> present set is empty. Otherwise present = `draftSectionIdsFromDraft(draft)`. Blocking findings = `qaFindings.filter(f => isOpenFinding(f) && f.severity === 'error')`, bucketed by `qaSectionToGalleyId(f.sectionName)`; a null map OR an id not in EDITABLE_SECTIONS -> `unattributedFindings++`. Blocking claims = `claimRows.filter(isOpenBlocking)`, bucketed by `sectionName` directly; missing/unknown id -> `unattributedClaims++`, else `attributedClaims++`. Per row: `blockingCount` = findings + claims for that id; `firstFindingId` = `_id` of the first blocking finding for that id in qaFindings array order, else null; `state` = blockingCount>0 ? 'fix' : !present.has(id) ? (runStatus==='running' ? 'writing' : 'not-written') : 'clean'; `href` = firstFindingId ? `/s/${id}#finding-${firstFindingId}` : `/s/${id}`; `headline` = SECTION_DESCRIPTORS[id] ?? (trimmed non-empty `draft.sections[id]?.headline` for long-reads, `draft.game?.headline` for game, `draft.bonus?.headline` for bonus) ?? label. `totalBlocking` = sum of all row counts + unattributed counts.

    rowNote: fix -> n===1 ? '1 thing to fix →' : `${n} things to fix →`; clean -> 'Reads clean'; writing -> 'Being written…'; not-written -> 'Not written yet'.
    fixSentencePrefix(n): n===1 ? '1 story has something to fix: ' : `${n} stories have something to fix: ` (caller appends linked names joined by ', ' and a final '.').
    unattributedClaimSentence(n): n===1 ? '1 fact the agents found contradicted needs checking.' : `${n} facts the agents found contradicted need checking.`
    unattributedFindingSentence(n): n===1 ? '1 thing to fix isn’t tied to a story.' : `${n} things to fix aren’t tied to a story.`

    deriveHomeFooter precedence (first match wins): stateKind 'loading' -> loading; stateKind 'none' -> none; `sections===undefined || claimSummaryBlocking===undefined || !signOffsLoaded || issue===undefined` -> loading; `issue?.published === true` -> published {publishedAt: publishedAt ?? null}; runStatus 'failed' -> failed; runStatus 'running' -> running; runStatus 'awaiting-review' && runCompletedAt == null -> gate1; runStatus !== 'awaiting-review' -> closed; then compute `unattributedClaims = Math.max(sections.unattributedClaims, claimSummaryBlocking - sections.attributedClaims)` (server summary wins — Pitfall 6), stories = rows with state 'fix' (id,label,href), notWritten = rows with state 'not-written' or 'writing'; if stories.length || notWritten.length || unattributedClaims || sections.unattributedFindings -> fix; else ready. 'ready' is therefore reachable ONLY for awaiting-review + completedAt set + everything loaded + zero blocking + all nine present.

    Run the tests until green; then commit `feat(52-01): implement front-door section selector`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm exec vitest run __tests__/homeSections.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm exec vitest run __tests__/homeSections.test.ts` exits 0
    - `grep -c "isOpenFinding\|isOpenBlocking\|draftSectionIdsFromDraft\|qaSectionToGalleyId" apps/dispatch-control/lib/homeSections.ts` >= 4
    - `grep -n "accepted !== true\|=== 'contradicted'\|status === 'pending'" apps/dispatch-control/lib/homeSections.ts` returns nothing (no re-implemented predicates)
    - `grep -n "severity === 'error'" apps/dispatch-control/lib/homeSections.ts` matches; `grep -n "'warning'" apps/dispatch-control/lib/homeSections.ts` returns nothing
    - `grep -n "use client\|from 'react'" apps/dispatch-control/lib/homeSections.ts` returns nothing
  </acceptance_criteria>
  <done>Selector and footer model implemented, all homeSections tests green, committed.</done>
</task>

</tasks>

<verification>
`cd apps/dispatch-control && pnpm exec vitest run __tests__/homeSections.test.ts __tests__/derivedState.test.ts __tests__/runSections.test.ts` green.
</verification>

<success_criteria>
One pure module owns "what blocks the front door", built only from existing predicates, with every copy string fixed as an exported constant or helper.
</success_criteria>

<output>
After completion, create `.planning/phases/52-issue-the-front-door/52-01-SUMMARY.md`
</output>
