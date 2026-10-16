---
phase: 52-issue-the-front-door
plan: 03
type: tdd
wave: 3
depends_on: ["52-01", "52-02"]
files_modified:
  - apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx
  - apps/dispatch-control/app/(editorial)/_components/StoryRow.tsx
  - apps/dispatch-control/app/(editorial)/_components/PublishFooter.tsx
  - apps/dispatch-control/__tests__/IssueHomeView.test.tsx
autonomous: true
requirements: [HOME-01, HOME-04, HOME-06, HOME-07, HOME-08, HOME-09]

must_haves:
  truths:
    - "The page shows the wordmark, Past issues and Admin links, the issue's real title and subject, nine story rows and one footer — no sidebar, tabs, checklist or task list"
    - "Each row is one real <a> (≥44px) showing label · headline · plain note ('1 thing to fix →' / 'Reads clean' / 'Being written…')"
    - "The footer holds exactly one Publish <button>; when disabled it says in one plain sentence why, with each named story linking to it"
    - "Clicking Publish shows an inline 'Publish Issue N now?' with Publish / Cancel — never window.confirm"
    - "Loading shows an aria-busy skeleton and never the strings 'Reads clean', 'Ready to publish' or 'Nothing left to fix'"
    - "Failed, published, gate-1 and no-issue states render honest copy with no Publish button"
    - "'Preview the issue' is available whenever a preview URL exists and the footer is fix, running or ready"
  artifacts:
    - path: "apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx"
      provides: "Pure props-only front-door body (header, title block, story card, footer)"
      exports: ["IssueHomeView", "IssueHomeViewProps", "formatPublishedDate"]
    - path: "apps/dispatch-control/app/(editorial)/_components/StoryRow.tsx"
      provides: "One story row as a real link"
    - path: "apps/dispatch-control/app/(editorial)/_components/PublishFooter.tsx"
      provides: "Footer sentence + the one Publish button + inline confirm"
    - path: "apps/dispatch-control/__tests__/IssueHomeView.test.tsx"
      provides: "Component tests: title / note / footer / publish / states / loading"
  key_links:
    - from: "PublishFooter.tsx"
      to: "lib/homeSections.ts copy helpers + lib/publishChain.ts PublishGate/COLLABORATOR_LOCK_LABEL/HELD_REASON + components/LockedControl.tsx"
      via: "imports"
      pattern: "fixSentencePrefix|READY_SENTENCE|LockedControl"
    - from: "StoryRow.tsx"
      to: "HomeSectionRow.href + rowNote"
      via: "next/link href={row.href}"
      pattern: "rowNote\\(|row\\.href"
---

<objective>
Build the visual front door as pure, props-only components (the RunBody/RunScreen testing seam, 52-RESEARCH "Recommended structure"), reproducing the approved "Dispatch Home" canvas from the locked description in 52-CONTEXT "Visual design".

Purpose: HOME-01/04/06/07/08/09 rendering contract, fully testable without Convex/Clerk/pipeline. Plan 52-04 wires data in.
Output: three components under `app/(editorial)/_components/` + `__tests__/IssueHomeView.test.tsx`.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/52-issue-the-front-door/52-CONTEXT.md
@.planning/phases/52-issue-the-front-door/52-01-SUMMARY.md
@.planning/phases/52-issue-the-front-door/52-02-SUMMARY.md
@apps/dispatch-control/lib/homeSections.ts
@apps/dispatch-control/lib/publishChain.ts

<interfaces>
From lib/homeSections.ts (52-01): `HomeSectionRow {id,label,headline,state:'writing'|'not-written'|'fix'|'clean',blockingCount,firstFindingId,href}`, `HomeSectionsResult {rows, attributedClaims, unattributedClaims, unattributedFindings, totalBlocking}`, `HomeFooter` union (loading|none|failed|gate1|running|published{publishedAt}|fix{stories,notWritten,unattributedClaims,unattributedFindings,unattributedFindingHref}|ready), `rowNote(row)`, `fixSentencePrefix(n)`, `unattributedClaimSentence(n)`, `unattributedFindingSentence(n)`, `RUNNING_SENTENCE`, `READY_SENTENCE`, `NONE_SENTENCE`, `FAILED_SENTENCE`, `GATE1_SENTENCE`.
From lib/publishChain.ts (52-02) also: `PUBLISH_SLOW_NOTICE` (the wrapper passes it in as `publishNotice`).
From lib/publishChain.ts (52-02): `PublishGate = {enabled:true} | {enabled:false; reason:'not-ready'|'loading'|'role-unknown'|'collaborator'|'held'|'busy'}`, `COLLABORATOR_LOCK_LABEL`, `HELD_REASON`.
From components/LockedControl.tsx: `LockedControl({ isLocked: boolean; lockedLabel: string; children: ReactElement<button> })` — clones the single child button with disabled + aria-describedby and renders the label as role="note".
From components/ui/Skeleton.tsx: `SkeletonLine({ className })`.
CSS tokens (app/globals.css): --font-display (Newsreader), --font-body (Lora), --font-ui (Space Grotesk), --font-mono (IBM Plex Mono), --color-ink #17140e, --color-ink-soft #55514a, --color-faint #8b8778, --color-paper #e9eaec, --color-nav #e3e5e8, --color-cobalt #253ad4.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — IssueHomeView.test.tsx</name>
  <files>apps/dispatch-control/__tests__/IssueHomeView.test.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/SectionReaderPage.test.tsx lines 1-130 (jsdom harness, cleanup)
    - apps/dispatch-control/__tests__/DecisionRail.roleGate.test.tsx (LockedControl assertions)
    - apps/dispatch-control/lib/homeSections.ts, apps/dispatch-control/lib/publishChain.ts
    - .planning/phases/52-issue-the-front-door/52-CONTEXT.md ("Footer sentence", "Navigation & chrome", "Visual design")
  </read_first>
  <behavior>
    Render `<IssueHomeView {...props} />` with a `baseProps()` factory (issueNumber 7, title 'The Quiet Ledger', subject 'A two-person water lab in the Ozarks.', nine rows from a fixture, footer {kind:'ready'}, gate {enabled:true}, publishing false, publishError null, publishNotice null, confirming false, no-op callbacks, links {admin:'/run', pastIssues:'/issues', runDetails:'/issues/7/runs/run_1', factCheck:'/issues/7/fact-check', approval:'/issues/7/approval', storyChoice:'/issues/7/story', liveIssue:'https://web.example/issue/issue-7', preview:'https://web.example/issue/issue-7/preview?token=x'}). Describe names include filter words: 'title', 'note', 'footer', 'publish', 'states', 'loading'.
    - title: heading level 1 text 'The Quiet Ledger'; subject text present; eyebrow 'Issue 7'; link 'Past issues' href '/issues'; link 'Admin' href '/run'; wordmark 'The Eisenbalm Dispatch'; no `aside`, no `[role="tablist"]`, no `input`, no `[role="checkbox"]`.
    - note: a 'fix' Game row with blockingCount 1 headline 'The Filtration Layer' -> one link whose accessible name contains 'Game', 'The Filtration Layer' and '1 thing to fix →', href '/s/game#finding-f9'; blockingCount 3 -> '3 things to fix →'; clean row -> 'Reads clean'; writing row -> 'Being written…'; exactly nine row links inside the story list.
    - footer: kind fix with stories [Game] -> text '1 story has something to fix: Game.' where 'Game' is a link to '/s/game#finding-f9'; two stories -> '2 stories have something to fix: Origin Story, Game.'; unattributedClaims 1 -> also '1 fact the agents found contradicted needs checking.' linking '/issues/7/fact-check'; running -> RUNNING_SENTENCE; ready -> READY_SENTENCE and the footer card has the ready border class (data-ready="true").
    - publish: exactly one button with name 'Publish' in ready/fix/running; gate disabled -> that button is disabled; gate {enabled:false, reason:'collaborator'} -> button disabled and note 'Collaborators can review and comment, not publish.' visible; reason 'held' -> 'This issue is held — release the hold to publish.' visible; clicking enabled Publish calls onRequestPublish; confirming true -> text 'Publish Issue 7 now?', buttons 'Publish' (calls onConfirmPublish) and 'Cancel' (calls onCancelPublish), still exactly one button named 'Publish'; 'Preview the issue' link uses links.preview and is present for footer kinds fix, running AND ready when links.preview is non-null (absent when null, absent for failed/published/gate1/none); publishNotice 'Publishing is taking longer than usual — check Admin → Run Details.' -> rendered in role="status" while the button stays disabled; publishing true -> button text 'Publishing…' and disabled; publishError 'Both sign-offs …' -> rendered in role="alert"; `window.confirm` spy never called.
    - states: footer failed -> FAILED_SENTENCE + link 'Admin → Run Details' href '/issues/7/runs/run_1', zero buttons named Publish; published {publishedAt: Date.UTC(2026,9,16,12)} -> text starting 'Published ' and matching formatPublishedDate output, link 'Read the live issue →' to links.liveIssue, no Publish button; liveIssue null -> no live link; gate1 -> GATE1_SENTENCE + link 'Choose the charity →' to '/issues/7/story', no Publish; none -> 'There is no current issue yet.' + 'Admin' link, no story list, no Publish; fix with unattributedFindings 1 and unattributedFindingHref '/s/podcast' -> the sentence '1 thing to fix isn’t tied to a story.' links '/s/podcast'; with unattributedFindingHref null -> links '/issues/7/approval'.
    - loading: footer {kind:'loading'} and sections undefined and title undefined -> container has `[aria-busy="true"]`; queryByText for /Reads clean|Ready to publish|Nothing left to fix/ is null; no Publish button. draftError 'boom' -> role="alert" contains 'boom' and no 'Reads clean'.
  </behavior>
  <action>
    Create `apps/dispatch-control/__tests__/IssueHomeView.test.tsx` implementing <behavior> with @testing-library/react (`render`, `screen`, `within`, `fireEvent`, `cleanup` in afterEach). Mock `next/link` is NOT needed (renders an <a>). Import `{ IssueHomeView, formatPublishedDate, type IssueHomeViewProps }` from `@/app/(editorial)/_components/IssueHomeView`; if the `@/app/(editorial)/...` alias path does not resolve in vitest, use the relative import `../app/(editorial)/_components/IssueHomeView`. Import copy constants from `@/lib/homeSections` and `@/lib/publishChain` rather than retyping them where possible, but ALSO keep at least the literals '1 story has something to fix: Game.', 'Publish Issue 7 now?', 'Preview the issue', 'Admin → Run Details', 'Read the live issue →' typed verbatim. Confirm RED; commit `test(52-03): add failing front-door view tests`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm exec vitest run __tests__/IssueHomeView.test.tsx 2>&1 | grep -E "FAIL|failed|Cannot find|Failed to resolve"</automated>
  </verify>
  <acceptance_criteria>
    - File exists; grep finds `Publish Issue 7 now?`, `1 story has something to fix: Game.`, `aria-busy`, `window`, `Collaborators can review and comment, not publish.`
    - Run fails before Task 2
  </acceptance_criteria>
  <done>Failing view spec committed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — IssueHomeView, StoryRow, PublishFooter</name>
  <files>apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx, apps/dispatch-control/app/(editorial)/_components/StoryRow.tsx, apps/dispatch-control/app/(editorial)/_components/PublishFooter.tsx</files>
  <read_first>
    - apps/dispatch-control/__tests__/IssueHomeView.test.tsx
    - apps/dispatch-control/components/LockedControl.tsx
    - apps/dispatch-control/components/ui/Skeleton.tsx
    - apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionHeader.tsx (editorial typography/class conventions)
    - apps/dispatch-control/app/globals.css lines 1-40 (tokens)
  </read_first>
  <action>
    All three files start with `'use client'` and a docstring citing Phase 52 + the canvas https://claude.ai/artifact/KSPqMJof6iYHnAr9NP3SbZ (boards: Something needs you / Ready to publish / Agents still writing). Pure props only: NO useQuery, useAuth, useRole, fetch, or useInspector imports (Pitfall 5). Hard edges: no `rounded*`, no `shadow*` classes.

    **IssueHomeView.tsx** — exports:
    ```ts
    export interface IssueHomeLinks { admin: string; pastIssues: string; runDetails: string | null; factCheck: string | null; approval: string | null; storyChoice: string | null; liveIssue: string | null; preview: string | null }
    export interface IssueHomeViewProps { issueNumber: number | null; title: string | null | undefined; subject: string | null | undefined; sections: HomeSectionsResult | undefined; footer: HomeFooter; gate: PublishGate; draftError: string | null; publishing: boolean; publishError: string | null; publishNotice: string | null; confirming: boolean; onRequestPublish: () => void; onConfirmPublish: () => void; onCancelPublish: () => void; links: IssueHomeLinks }
    export function formatPublishedDate(ts: number): string  // new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) e.g. '16 October 2026'
    export function IssueHomeView(props: IssueHomeViewProps): JSX.Element
    ```
    Layout: outer `<div className="min-h-screen bg-[color:var(--color-paper)]">`, inner `<main className="mx-auto w-full max-w-[880px] px-4 py-8 sm:px-6">`.
    Header (`<header className="flex flex-wrap items-baseline justify-between gap-3 pb-8">`): wordmark `<span className="font-[family-name:var(--font-display)] text-[22px] text-[color:var(--color-ink)]">The Eisenbalm Dispatch</span>`; `<nav aria-label="Site">` with `<Link href={links.pastIssues}>Past issues</Link>` and `<Link href={links.admin}>Admin</Link>`, each `inline-flex min-h-[44px] items-center px-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)] underline-offset-4 hover:underline`.
    Title block: eyebrow `<p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[color:var(--color-ink-soft)]">Issue {issueNumber}</p>`; `<h1 className="mt-2 font-[family-name:var(--font-display)] text-[40px] leading-[1.05] sm:text-[52px] text-[color:var(--color-ink)]">` = title (when title === null: `Issue {issueNumber}`); subject `<p className="mt-3 font-[family-name:var(--font-body)] text-[18px] text-[color:var(--color-ink-soft)]">` = subject, or when subject/title is null the line "The agents haven’t chosen this issue’s charity yet." — never an invented title (HOME-01). When title or subject is undefined render `SkeletonLine`s inside an `aria-busy="true"` wrapper instead.
    Section label above the card: `<h2 className="mt-10 mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.12em] text-[color:var(--color-ink-soft)]">In this issue</h2>`.
    Story card: if draftError -> `<p role="alert" className="border border-[color:var(--color-faint)] bg-white p-5 font-[family-name:var(--font-ui)] text-[14px] text-[#c43a14]">Couldn’t load this issue’s stories: {draftError}</p>`; else if sections undefined -> `<div aria-busy="true" className="border border-[color:var(--color-faint)] bg-white">` with nine `SkeletonLine` rows (each `min-h-[64px] px-5 py-4`, separated by `border-t border-[color:var(--color-nav)]`); else `<ol aria-label="Stories in this issue" className="border border-[color:var(--color-faint)] bg-white">` rendering `<StoryRow>` per row, every row after the first with `border-t border-[color:var(--color-nav)]`.
    State branches for footer.kind 'none': skip the title block, the 'In this issue' label and the story card entirely (the footer alone carries NONE_SENTENCE + Open Admin — do not render that sentence twice). 'gate1' and 'failed': still render the title block; render the story card only if sections is defined.
    Footer: `<PublishFooter ... />` placed with `mt-6`.

    **StoryRow.tsx** — `export function StoryRow({ row }: { row: HomeSectionRow })`: `<li><Link href={row.href} className="flex min-h-[64px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-4 hover:bg-[color:var(--color-paper)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-cobalt)]">` containing: label `<span className="w-[120px] shrink-0 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">`; headline `<span className="min-w-[200px] flex-1 font-[family-name:var(--font-display)] text-[21px] leading-snug text-[color:var(--color-ink)]">`; note per state: fix -> `<span className="bg-[#c43a14] px-2 py-1 font-[family-name:var(--font-ui)] text-[13px] font-medium text-white">{rowNote(row)}</span>` (#c43a14 on white text ≥4.5:1); clean -> `<span className="font-[family-name:var(--font-ui)] text-[13px] text-[#11764a]">Reads clean</span>`; writing / not-written -> `<span className="font-[family-name:var(--font-ui)] text-[13px] italic text-[color:var(--color-ink-soft)]">{rowNote(row)}</span>`. Note text always comes from `rowNote()`.

    **PublishFooter.tsx** — `export function PublishFooter(props: Pick<IssueHomeViewProps, 'issueNumber' | 'footer' | 'gate' | 'publishing' | 'publishError' | 'publishNotice' | 'confirming' | 'onRequestPublish' | 'onConfirmPublish' | 'onCancelPublish' | 'links'>)`. Card: `<section aria-label="Publish" data-ready={footer.kind === 'ready' ? 'true' : 'false'} className={"flex flex-col gap-4 bg-white p-5 sm:flex-row sm:items-center sm:justify-between " + (footer.kind === 'ready' ? 'border-2 border-[color:var(--color-ink)]' : 'border border-[color:var(--color-faint)]')}>`. Left: one `<p className="font-[family-name:var(--font-body)] text-[16px] text-[color:var(--color-ink)]">` sentence by kind:
      - loading: `<div aria-busy="true">` with two SkeletonLine; no button.
      - none: NONE_SENTENCE + `Open Admin →` link; no button.
      - failed: FAILED_SENTENCE + ` ` + `<Link href={links.runDetails ?? links.admin}>Admin → Run Details</Link>`; no button.
      - gate1: GATE1_SENTENCE + `<Link href={links.storyChoice ?? links.admin}>Choose the charity →</Link>`; no button.
      - published: `Published ${formatPublishedDate(publishedAt)}.` (or `Published.` when publishedAt null) + `<a href={links.liveIssue}>Read the live issue →</a>` only when liveIssue non-null; no button.
      - running: RUNNING_SENTENCE.
      - fix: if stories.length -> `fixSentencePrefix(n)` followed by each story as `<Link href={s.href}>{s.label}</Link>` joined with ', ' then '.'; if notWritten.length -> ` ${n === 1 ? '1 story isn’t written yet: ' : `${n} stories aren’t written yet: `}` + linked labels (href `/s/${id}`) + '.'; if unattributedClaims -> ' ' + `<Link href={links.factCheck ?? links.admin}>{unattributedClaimSentence(n)}</Link>`; if unattributedFindings -> ' ' + `<Link href={footer.unattributedFindingHref ?? links.approval ?? links.admin}>{unattributedFindingSentence(n)}</Link>` (docstring: findings on podcast/theme/deliberation have no inline mark, so link that section's page when the selector recovered a single known section; otherwise fall back to the old approval screen, which lists every open finding). All inside ONE `<p>`.
      - ready: READY_SENTENCE.
      Below the sentence: `publishError` in `<p role="alert" className="mt-2 font-[family-name:var(--font-ui)] text-[13px] text-[#c43a14]">`; when gate.reason === 'held' a `<p className="mt-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">{HELD_REASON}</p>`; `publishNotice` (when non-null) in `<p role="status" className="mt-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">`; when kind is 'fix', 'running' or 'ready' and links.preview non-null, `<a href={links.preview} target="_blank" rel="noreferrer">Preview the issue</a>` (font-ui 13px, min-h-[44px] inline-flex).
      Right (only for kinds fix | running | ready): if `confirming && gate.enabled` -> `<div className="flex flex-wrap items-center gap-3"><p>Publish Issue {issueNumber} now?</p><button type="button" onClick={onConfirmPublish} className={ENABLED}>Publish</button><button type="button" onClick={onCancelPublish} className="min-h-[44px] border border-[color:var(--color-ink)] bg-white px-5 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink)]">Cancel</button></div>`; else the single button wrapped as `<LockedControl isLocked={!gate.enabled && gate.reason === 'collaborator'} lockedLabel={COLLABORATOR_LOCK_LABEL}><button type="button" disabled={!gate.enabled || publishing} onClick={onRequestPublish} className={gate.enabled && !publishing ? ENABLED : DISABLED}>{publishing ? 'Publishing…' : 'Publish'}</button></LockedControl>` with `ENABLED = 'min-h-[44px] w-full sm:w-auto bg-[color:var(--color-cobalt)] px-6 font-[family-name:var(--font-ui)] text-[15px] font-medium text-white'` and `DISABLED = 'min-h-[44px] w-full sm:w-auto cursor-not-allowed bg-[#d6d3cb] px-6 font-[family-name:var(--font-ui)] text-[15px] text-[color:var(--color-ink-soft)]'`. Never call `window.confirm`; no `<input>` anywhere (keeps __tests__/publishNoTypedConfirm.test.ts semantics).

    Run the view tests to green; commit `feat(52-03): front-door view — story rows and one-button footer`.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm exec vitest run __tests__/IssueHomeView.test.tsx __tests__/homeSections.test.ts __tests__/publishChain.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - All three test files pass
    - `grep -rn "useQuery\|useAuth\|useRole\|useInspector\|fetch(" "apps/dispatch-control/app/(editorial)/_components/"` returns nothing
    - `grep -rn "window.confirm\|<input\|rounded\|shadow" "apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx" "apps/dispatch-control/app/(editorial)/_components/StoryRow.tsx" "apps/dispatch-control/app/(editorial)/_components/PublishFooter.tsx"` returns nothing
    - `grep -n "#c43a14" "apps/dispatch-control/app/(editorial)/_components/StoryRow.tsx"` and `grep -n "#11764a"` in the same file both match
    - `grep -n "max-w-\[880px\]" "apps/dispatch-control/app/(editorial)/_components/IssueHomeView.tsx"` matches
    - `grep -n "LockedControl" "apps/dispatch-control/app/(editorial)/_components/PublishFooter.tsx"` matches
  </acceptance_criteria>
  <done>View renders every board/state from props; tests green; committed.</done>
</task>

</tasks>

<verification>
`cd apps/dispatch-control && pnpm exec vitest run __tests__/IssueHomeView.test.tsx` green; `pnpm --filter dispatch-control typecheck` reports no errors in the new files.
</verification>

<success_criteria>
The canvas is reproduced as props-only components whose every string comes from the 52-01/52-02 helpers, so the page cannot say something the gate disagrees with.
</success_criteria>

<output>
After completion, create `.planning/phases/52-issue-the-front-door/52-03-SUMMARY.md`
</output>
