# Phase 56: Dashboard Redesign — The Grandma-Simple Editor - Research

**Researched:** 2026-10-22
**Domain:** Next.js 15 App Router UI rebuild of `apps/dispatch-control` (Tailwind v4 CSS-first tokens, Convex subscriptions, Clerk, vitest + Testing Library)
**Confidence:** HIGH (everything below was read from the repo; the few inferences are flagged)

## Summary

This is a UI-layer rebuild. All editor surfaces already exist as three routes in the `app/(editorial)/` group (`/`, `/s/[section]`, `/archive`) plus a `/admin` hub and `/admin/runs/[runId]` run page. The data layer is already correct and should be reused untouched: `useCurrentRun` (follows `runs.latest`, can be pinned to a run), `deriveHomeSections` / `deriveHomeFooter` (the existing "state of this issue" derivation), `lib/issueTitle.ts`, `lib/runLabels.ts`, `lib/publishChain.ts`, `lib/pipelineControlClient.ts` (`triggerRun`, `cancelRun`, `rerollAgent`), `lib/contentPatchClient.ts` (`getDraft`, `patchSection`, `patchBonus`) and the Galley. The work is: (1) a shared shell and a "Your next step" slab primitive, (2) one new pure derivation module that maps existing run/issue state onto the six status words, four stations and the slab copy table, (3) re-skinning five screens to the canvas, (4) a new Behind-the-scenes step list and plain-words problem page, (5) a jargon sweep over the `/admin/*` sub-pages, and (6) retiring the old chrome (publish footer, hold dialog, mono-caps chips, tabs, admin top bar, command palette) with a tripwire test.

Four findings change how the plan should be shaped:

1. **"Rewrite this part" cannot return a candidate without overwriting.** `POST /runs/{id}/agents/{key}/rerun` re-runs the writer and calls `write_issue_draft`, which overwrites the Sanity draft (verified in `packages/pipeline/.../api/control.py:679-770`). The UI-SPEC's Keep this version / Go back to the old one flow must therefore be implemented client-side: snapshot the section via `getDraft`, call `rerollAgent`, reload the draft, and "Go back" re-applies the snapshot through `patchSection` / `patchBonus` (backend unchanged). Only 7 section writers can be rerolled (no deliberation, no podcast), so the button must be hidden on those two parts.
2. **Archive cannot tell Stopped from Problem using `issues.listWithTitles`.** That query returns `pipelineRuns.status`, whose union has no `cancelled` (a stopped run is stored as `failed` there; `cancelled` exists only on the `runs` table). The Archive must also subscribe to `runs.listRecentForWorkspace` (already exists, take 100) and join on `runId`. This avoids a Convex schema/query change and the "committing convex/*.ts is not deployed" trap.
3. **There is a pre-existing red test and a noisy `tsc`.** Baseline run on 2026-10-22: 104 files pass, 1 fails (`__tests__/SectionReaderPage.test.tsx` "Save edit calls patchBonus…", the Edit-text selection toolbar flow), 975 tests pass. `pnpm exec tsc --noEmit` already reports errors inside `__tests__/` (e.g. `import.meta.glob`, possibly-undefined), so success criterion 4 must gate on `pnpm --filter dispatch-control build` (which excludes tests) plus vitest, not on `typecheck`. The Section rewrite deletes the failing test's subject, so it is fixed by replacement.
4. **`/` is a server component guarded by a test.** `__tests__/homeRoute.test.ts` asserts `(editorial)/page.tsx` has `force-dynamic` and no `'use client'`. Past-issue Home (Archive link target) should therefore be `/?run=<runId>`, read via the server page's `searchParams` Promise and passed to the client `IssueHome` as a `runId` prop (mirrors `/s/[section]?run=`, which already exists and uses `sectionEditHref`).

**Primary recommendation:** Build one pure `lib/editorState.ts` (TDD, no React) and a small `components/editor/*` primitive set (shell, slab, status word, stations, step list) first; then rebuild Home, Section, Archive, Behind and Behind-Run in parallel against those primitives with disjoint file ownership; finish with a retirement + tripwire plan and a strict-build + browser-QA gate.

<user_constraints>
## User Constraints (from ROADMAP.md Phase 56 block; there is no CONTEXT.md)

### Locked Decisions (2026-10-22), verbatim
1. One "Your next step" slab at the top of every page (2px ink frame, Newsreader sentence, ONE cobalt button).
2. Four-station checklist: Pick charity → Write → Check → Publish. Charity stays auto-picked; no content gates on Publish (only role + hold).
3. Six status words everywhere: Done · Working · Waiting for you · Not yet · Stopped · Problem. Issues named "Issue 48 · Thursday 29 October 2026 — charity name", never run ids.
4. Nav is three links: This week's issue · Past issues · Behind the scenes (Admin renamed, plain-word items).
5. No mono-caps chips, no jargon, UI text 15–17px; keep 1c tokens (paper #f1f0ea, ink #17140e, cobalt #253ad4; Newsreader/Lora/Space Grotesk), IBM Plex Mono dropped from editor pages.
6. Paragraphs edited in place (hover pencil → textarea, Save/Cancel), one "Rewrite this part" helper per part.
7. Stopped/unfinished issues collapsed at the bottom of Past issues; failed runs explained in plain words with technical details collapsed.

Scope lock: New UI only; backend kept. Reuse Galley, in-place editor, content-patch API, hold/start/publish chain.

### Claude's Discretion
No explicit discretion list. By implication (UI-SPEC "Open items for the planner"): how Past-issue Home is routed, how "Rewrite this part" keep/undo is implemented, how Held and Collaborator states render, how the Behind step list is derived.

### Deferred Ideas (OUT OF SCOPE)
- Charity pick-cards / a visible charity choice (RESOLVED 2026-10-22: charity stays auto-picked; "design should not show a charity choice").
- Any content gate on Publish, must-fix / remix UX, sign-offs (memory `no-publish-gates-agents-self-fix`).
- Client bug 10 (switch Clerk to a production instance) is ops, not this phase.
- Replacing the OpenRouter key (known blocker for real-data runs, see Environment Availability).
</user_constraints>

<phase_requirements>
## Phase Requirements

No requirement IDs are mapped (TBD). Derive must-haves from the success criteria. Proposed local IDs the planner can use in plan frontmatter:

| ID | Description | Research Support |
|----|-------------|------------------|
| P56-A1 | Each of the 7 artboards has a matching live screen at desktop and phone width | Route map, Responsive notes, Wave plan |
| P56-A2 | Client walkthrough replay hits none of the reported confusions | Walkthrough mapping table below |
| P56-A3 | No run ids, raw errors, or jargon on editor pages; exactly one primary action per page | Retirement list, tripwire tests |
| P56-A4 | Strict `pnpm --filter dispatch-control build` and full vitest suite pass | Validation Architecture |
| P56-B1 | Six status words derived from one module | `lib/editorState.ts` design |
| P56-B2 | Four-station checklist + slab copy per Home state | State mapping tables |
| P56-B3 | Nav is three links; Admin relabelled | Shell + `lib/nav.ts` |
| P56-B4 | Paragraph in-place edit with keep/undo "Rewrite this part" | Rewrite finding |
| P56-B5 | Old chrome retired and verified (Phase 34 lesson) | Retirement list |
</phase_requirements>

## Standard Stack

All already installed in `apps/dispatch-control` (versions from `package.json`, verified 2026-10-22). Nothing new should be added.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | ^15.3.9 | App Router, route groups, redirects | existing; `middleware.ts` (not proxy.ts) |
| react / react-dom | ^19.2.6 | UI | existing |
| tailwindcss + @tailwindcss/postcss | ^4.3.0 | CSS-first `@theme` tokens in `app/globals.css` | any `--color-*` in `@theme` auto-generates `bg-*`, `text-*`, `border-*` utilities |
| convex | ^1.38.0 | live subscriptions (`useQuery`/`useMutation`) | existing data layer |
| @clerk/nextjs | ^7.5.7 | `useAuth().getToken`, `useUser` for role | existing |
| vitest | ^3.2.0 + @testing-library/react ^16.3.0 + jest-dom + jsdom ^26 | tests | existing; `*.test.tsx` auto-jsdom |

### Supporting (reuse, do not rebuild)
| Module | Path | Use |
|--------|------|-----|
| Confirm dialog | `components/ui/ConfirmDialog.tsx` (`useConfirm`, options `title/body/confirmLabel/cancelLabel/tone`) | Stop writing, discard unsaved edit |
| Locked control | `components/LockedControl.tsx` | Collaborator lock (but note UI-SPEC wants a sentence, not a disabled button, see Pitfall 6) |
| Skeleton | `components/ui/Skeleton.tsx` (`SkeletonLine`) | loading states |
| Galley game slot | `components/galley/GalleryGameSlot.tsx` | sandboxed game iframe, unchanged |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New paragraph list for text parts | Keep Galley's `GallerySection` for text parts | Galley renders annotation/claim machinery and a selection `PassageToolbar`; the canvas needs a pencil per paragraph row. Use a thin new `SectionArticle` for text parts and keep Galley only for the non-text parts (game, bonus non-specAd, podcast, deliberation) with `hideFindings` |
| New Convex query for run status in Archive | `runs.listRecentForWorkspace` client-side join | No backend change, no Convex redeploy needed (see memory `convex-functions-need-live-sync`) |

**Installation:** none. **Version verification:** versions above read from `apps/dispatch-control/package.json`; no registry lookups needed because no package is added.

## Route Map (artboard to code)

All paths relative to `apps/dispatch-control/`.

| Artboard | Route | Existing file(s) | Action |
|---|---|---|---|
| Main / Home-Writing / Home-Published (+ Held, Empty, Problem, Collaborator variants) | `/` and `/?run=<runId>` | `app/(editorial)/page.tsx` (server, keep `force-dynamic`, add `searchParams` prop to pass `runId`), `_components/IssueHome.tsx` (data wrapper), `_components/IssueHomeView.tsx` (pure view), `PublishFooter.tsx`, `StoryRow.tsx`, `StartIssueButton.tsx`, `HoldControl.tsx`, `HoldDialog.tsx`, `HeldIssueRow.tsx` | REBUILD `IssueHome` + `IssueHomeView` (keep the pure-props seam); REPLACE `PublishFooter`/`StoryRow`; FOLD `StartIssueButton` + publish into the slab; REWRITE `HoldControl` (no dialog, default reason); DELETE `HoldDialog`, `HeldIssueRow` (after Archive stops importing it) |
| Section | `/s/[section]` (+ `?run=`) | `app/(editorial)/s/[section]/page.tsx` (457 lines), `_components/{SectionHeader,SectionEndNav,EarlierIssueBanner,ExemptSectionNote,AgentChangesNote,InPlaceBlockEditor}.tsx` | REBUILD page; RESTYLE `InPlaceBlockEditor` into the per-paragraph editor (it is the "in-place paragraph editor" to reuse: it already branches `patchBonus` vs `patchSection`, handles 409 `revision_mismatch`, Escape/Cmd+Enter); REWRITE `SectionEndNav` (prev/next + "All nine parts"), `SectionHeader`, `AgentChangesNote` (closed `details`), `ExemptSectionNote`; DELETE `EarlierIssueBanner` (replaced by slab/breadcrumb); NEW `RewriteThisPart` |
| Archive | `/archive` | `app/(editorial)/archive/page.tsx`, `_components/ArchiveBody.tsx` (290 lines, mono-caps chips, filter pills) | REBUILD both; keep the `?issue=N` forward behaviour (old `/issues/:n` redirects in `next.config.ts` land on `/archive?issue=:n`, covered by `nextConfigRedirects.test.ts`) |
| Behind | `/admin` | `app/admin/page.tsx`, `app/admin/layout.tsx` (h-screen/overflow-hidden shell with UserButton), `lib/nav.ts` (`ADMIN_ITEMS`) | REBUILD page; replace layout shell; RELABEL `ADMIN_ITEMS` |
| Behind-Run | `/admin/runs/[runId]` | `app/admin/runs/[runId]/page.tsx` (server), `_components/RunDetail.tsx` (620 lines), `RecoveryRail.tsx`, `RerollButton.tsx`, `CancelRunButton.tsx`, `runs/layout.tsx` (mono-caps "Runs/Graph" tabs) | NEW `BehindRun` view; RETIRE `RunDetail`, `RecoveryRail`, `RerollButton`; handle non-problem runs too (the route serves every run) |

Admin sub-pages reachable from the dials (layout NOT redrawn, jargon cleaned, wrapped in the new shell): `/admin/finance`, `/admin/charities`, `/admin/runs` (list), `/admin/runs/graph`, `/admin/agents` (+ `[agentKey]`), `/admin/tests`, `/admin/automation`, `/admin/settings`. Route paths do not change.

Routes that stay as-is: `app/sign-in/**`, `app/api/review-desk/[runId]/preview-url/route.ts` (used by Home for "Preview the issue first"; the `/api/review-desk/...` path name is internal and not user-visible), `middleware.ts`, `next.config.ts` redirects.

## Reusable Pieces (signatures and locations)

| Piece | Location | Signature / behaviour to rely on |
|---|---|---|
| Current run | `lib/useCurrentRun.ts` | `useCurrentRun(opts?: { runId?: string \| null })` returns `{ state: {kind:'loading'\|'none'\|'run'}, pinned, runId, issueNumber, title (undefined=loading, null=no charity yet), derivationInputs, qaFindings, claimRows, runRow {startedAt, completedAt?}, runCostUsd, ... }`. `derivationInputs.runStatus` is `runs.status`, so it includes `'cancelled'`. |
| Home sections | `lib/homeSections.ts` | `deriveHomeSections({draft, qaFindings, claimRows, runStatus})` returns `{rows: HomeSectionRow[]}` or `undefined` (HOME-09: any input not loaded). Row: `{id,label,headline,state:'writing'\|'not-written'\|'clean',agentChanges,href}`. Row order == UI-SPEC part order (originStory, problemStatement, founderBio, caseStudy, bonus, game, deliberation-conversation, podcast, theme), exactly nine (client bug 7 already fixed). `agentChanges` is the "N fixes by the writers" count. `rowNote()`, `*_SENTENCE` constants exist but carry old jargon copy and must be replaced. |
| Home footer kind | `lib/homeSections.ts` | `deriveHomeFooter({...})` returns `HomeFooter` kinds: `loading none failed gate1 stopped running published ready`. This is the existing run-state classifier; the new module should wrap it, not fork it. |
| Derived issue state | `lib/derivedState.ts` | `deriveIssueStatus(i)` (`unknown draft needs-review ready published held failed`), `isPublishable`, `isPausedAtGate1`, `deriveStageStates`, `deriveTasks` (the Phase 40/43 task machinery; sign-off and must-fix flavoured, NOT needed by the new UI), `formatElapsed(startedAt, now, completedAt?)` (renders `41m 12s`), `deriveRunCostUsd(agentRuns)`, `draftSectionIdsFromDraft`. `deriveTasks`/`deriveStageStates` should not be called from new code. |
| Title | `lib/issueTitle.ts` | `issueTitleLabel(title)` returns "Not yet chosen" for null/empty (jargon-free but replace with "Charity not chosen yet" copy), `relativeWeekLabel`. The "Issue N · Thursday D Month YYYY" line is NEW (see Open Question 1). |
| Run labels | `lib/runLabels.ts` | `formatRunLabel({issueNumber, charityName, startedAt})`, `splitStaleRuns(runs, now, days=14)`. Reuse for Archive Stopped list ordering and the admin runs list. |
| Publish | `lib/publishChain.ts` | `publishChain({getToken, runId})` returns `{ok:true} \| {ok:false, step, message}` (one call, `publishIssue`); `derivePublishGate({footer, role, held, busy})` reasons: `not-ready loading role-unknown collaborator held busy`; constants `NETWORK_FAILURE_MESSAGE`, `HELD_REASON`, `PUBLISH_SLOW_*` (copy contains "Admin → Run Details", must change). Publish is non-idempotent: latch busy on first click. |
| Start / Stop / Reroll | `lib/pipelineControlClient.ts` | `triggerRun({}, token)`, `cancelRun(runId, token)` returns `{stopped?, alreadyTerminal?, cancelRequested?}`, `rerollAgent(runId, agentKey, token)` (409 while running). Error text arrives as `"... failed (409): detail"`; `StartIssueButton.startErrorMessage` shows the parsing precedent. |
| Hold / Release | Convex `api.issues.hold({workspace_id, issueNumber, reason})` (non-empty reason required, server throws otherwise), `api.issues.reopen({workspace_id, issueNumber})` | UI-SPEC wants no dialog: pass a fixed reason such as `'Held by the editor'`. Retire the "also stop the run" checkbox (Stop is its own button). |
| Content patch | `lib/contentPatchClient.ts` | `getDraft(runId, token): DraftResponse`, `patchSection(runId, sectionId, {ifRevisionID, blocks})`, `patchBonus(runId, {ifRevisionID, body})` (bonus is NOT in `patchSection`'s allow-list, Pitfall 5), `ContentPatchError.reason === 'revision_mismatch'`, `ContentBlock {type:'paragraph'\|'h2'\|'h3'\|'blockquote'; text}`. Specs for game/theme use `patchGame`/`patchTheme`. |
| Section ids | `lib/editableSections.ts` | `EDITABLE_SECTIONS` ids/labels (labels are old: "Origin Story", "Founder Bio", "Theme"; UI-SPEC labels are "Origin story", "Founder", "Look" etc., so add a `PART_LABELS` map in the new module rather than editing this file, which Galley/derivedState import). |
| Hrefs | `lib/issueRouteResolver.ts` | `adminRunHref(runId)`, `issueOpenHref(runId, currentRunId)` (currently returns `/s/originStory?run=` for non-current; change to `/?run=` for the new Home-for-a-past-issue), `sectionEditHref(sectionId, runId, currentRunId?)`. |
| Role | `lib/role.ts` | `useRole(): 'Editor-in-chief' \| 'Collaborator' \| undefined` (presentation only; server is the gate). `undefined` while Clerk loads; never treat as Collaborator. |
| Gate interrupt | `lib/gateInterrupt.ts` | `isGateInterrupt(row)`, `summarizeInterrupt(error)`; a paused Gate-1 row is stored as `failed` with a Python `Interrupt(...)` repr. Must map to "Waiting for you", never Problem, and the repr must never print. |
| Nomenclature | `lib/nomenclature.ts` | `RUN_STEP_MAP`, `runStepFor(agentKey)` (action labels such as "Find story leads"; imports `GATE_KEYS` from the graph topology), `restartAvailabilityFor`. Contains banned words (agent labels, "deterministic check"). Add a NEW `STATUS_WORDS` export here (UI-SPEC says "extend `lib/nomenclature.ts`") but build the plain 10-step map in the new editor module; do not change `RUN_STEP_MAP` (covered by `nomenclature.test.ts`, `runDetailActionNames.test.ts`). |
| Provenance | `ClaimProvenanceCard`, `PassageToolbar`, Inspector panel | "Inspect how this was made" and "Related facts & sources" are jargon-heavy and not in the canvas. Drop them from the Section page (and drop `PassageToolbar`'s role by not mounting Galley for text parts). |

## State Mapping

### Run / issue state to Home state, slab, status word

Input: `footer = deriveHomeFooter(...)` (`HomeFooter.kind`), `held` (issues row), `role`, written count `w` = rows with `state==='clean'` (0..9). Implement as a pure `deriveEditorHome(...)` in `lib/editorState.ts`.

| footer.kind | held | role | Home state | Slab sentence key (UI-SPEC copy table) | Primary action | Issue status word |
|---|---|---|---|---|---|---|
| loading | any | any | `loading` | skeleton slab | none | none |
| none | n/a | any | `empty` | "No issue yet this week" body | Start the first issue (`triggerRun`) | none |
| running, `w<9` | false | any | `writing` | "Nothing for you to do yet. The writers are on it." | none, Working indicator | Working |
| running, `w===9` | false | any | `checking` | "...checking their work" | none | Working |
| ready | false | Editor-in-chief | `ready` | "Read the issue, then publish it." | Publish Issue N (`publishChain`) | Waiting for you |
| ready | false | Collaborator | `ready-collab` | "Waiting for the editor-in-chief to publish." | none | Not yet (for them) |
| ready or running | true | any | `held` | "This issue is on hold." | Release this issue (`reopen`) | Waiting for you |
| published | n/a | any | `published` | "Issue N went out on <weekday>. Start the next one..." | Start next week's issue | Done |
| stopped | n/a | any | `stopped` | "This issue hit a problem and stopped..." (use the Stopped variant, see Open Question 3) | Start a new issue | Stopped |
| failed | n/a | any | `problem` | "This issue hit a problem and stopped. Nothing reached readers." | Start a new issue; text link "What happened" to `/admin/runs/[id]` | Problem |
| gate1 (legacy run paused before a charity) | n/a | any | `stuck` | not in UI-SPEC; see Open Question 3 | Stop this issue | Waiting for you (never Problem) |

Held + Collaborator: slab shows the held sentence; Release is allowed for anyone (memory `dashboard-simplification-client-answers`: "anyone releases hold").
`start` is allowed for any signed-in role (matches `StartIssueButton`). Start must latch busy, surface the 409 text in UI-SPEC "Error: start failed" wording, and stay disabled-looking-free (no dead buttons).

### Four stations

| Station | Not yet | Working | Waiting for you | Done | Stopped / Problem |
|---|---|---|---|---|---|
| Pick charity | n/a | n/a | n/a | always Done once an issue exists ("Done") | Done |
| Write | w=0 and run not started | "Working · {w} of 9 parts" while running and `w<9` | n/a | "Done · all nine parts" | Problem at this station if failed with `w<9`; Stopped if cancelled |
| Check | "Not yet" while writing | "Working" when `w===9` and running | n/a | "Done · {sum agentChanges} fixes made" (singular "1 fix made") | Problem if failed with `w===9` |
| Publish | "Not yet" | n/a | "Now — waiting for you" (amber, 600) when ready and Editor-in-chief, or "Now — waiting for the editor-in-chief" for a Collaborator | "Done · {Thursday D Month}" | "Not yet" |

Marker shape comes from the word (UI-SPEC "Status words" table). Current station gets `aria-current="step"`; Done stations + connectors cobalt (UI-SPEC explicitly keeps cobalt for station discs even though the Done word text is green).

### Part-row status text (Home list)

`row.state` `clean` + `agentChanges` n to "Written" or "Written · {n} fix(es) by the writers" (green `--color-done`); `writing` to "Working" (non-link `div`); `not-written` to "Not yet" (non-link `div`; if run is failed/stopped this is still "Not yet"). Published issue: "Published" on all linked rows. Working suffix: "Working · 5 of 9 parts" belongs on the station, not rows.

### Behind-the-scenes plain steps (10)

New `PLAIN_STEPS` in `lib/editorState.ts`, grouping `agent_runs.agentKey` (verified keys in `RUN_STEP_MAP`):

| # | Plain name | agentKeys |
|---|---|---|
| 1 | Find story leads | `signal_editor` |
| 2 | Find charities worth writing about | `scout`, `advocate` |
| 3 | Check the charities are real | `verify_candidates` |
| 4 | Choose this week's charity | `editor_gate_1`, `chronicler` |
| 5 | Research the charity | `researcher` |
| 6 | Check the research against its sources | `verify_research` |
| 7 | Write the nine parts | `origin_story problem founder_bio case_study game bonus design validate_sections` |
| 8 | Check the writing and fix problems | `qa` |
| 9 | Final read-through | `editor_final` |
| 10 | Publish | `publisher` |

`calibrator` is a supporting step, not shown. Status per step (fold member rows): any `failed` that is not `isGateInterrupt` gives Problem; a gate-interrupt row gives Waiting for you; any `running` gives Working; all `done` gives Done with "· {HH:MM}" from `completedAt` and (step 8) "· N fixes"; no rows or all `queued` gives Not yet; if the run is cancelled, unfinished steps show Stopped. UI-SPEC says later steps read "Not started" in Behind-Run, which collides with the six-words rule; use "Not yet" (flag Open Question 4). Total cost footer: `deriveRunCostUsd(agentRuns)` (sum of per-step `costUsd`, fixes client bug 6; `runs.cost` JSON is the source of the old `$0.00`), duration via `completedAt - startedAt` in whole minutes ("took 39 minutes").

Problem explanation: a static map `stepKey -> {what, why, next}` of two plain paragraphs per step (UI-SPEC item 9), raw `agent_runs.error` (or `pipelineRuns.errorMessage`) goes only into the collapsed `<pre>`.

### Archive row status

Join `issues.listWithTitles` (title, subtitle, published, held, runId, publishedAt, runStartedAt) with `runs.listRecentForWorkspace` (status incl. `cancelled`) on `runId`. Rules: `published` or run `complete` gives Done ("Published"); `cancelled` gives Stopped (collapsed list); `failed` gives Problem (collapsed list); the single in-flight/ready run gives "Waiting for you · this week" or "Working" with the `#fffdf6` tint. Plain reasons for the collapsed list ("Stopped before a charity was chosen" = no title; "Hit a problem while checking the research" = the failing `agent_runs` step, which needs `agentRuns.byRunId` per row; keep it cheap with a generic fallback "Hit a problem while it was being written" and the specific text only on the Behind-Run page, see Open Question 5). Rows with `runId === null` (reserved slots) are not issues for the editor; omit them.

## Architecture Patterns

### Recommended structure (new/changed only)
```
apps/dispatch-control/
├── app/globals.css                         # + editor tokens (see Token additions)
├── components/editor/                      # NEW, shared by (editorial) and admin
│   ├── EditorShell.tsx                     # masthead + 3-link nav + <main> container (client: usePathname for aria-current)
│   ├── NextStepSlab.tsx                    # eyebrow, sentence, explanation, ONE primary or ghost, optional link
│   ├── StatusWord.tsx                      # word + shape + colour from STATUS_WORDS
│   ├── Stations.tsx                        # 4-station checklist, vertical <640px
│   ├── StepList.tsx                        # Behind step list (22px dots on 2px line), shared by Behind + Behind-Run
│   ├── PartsList.tsx                       # nine-parts list (Home) + 2-line phone card
│   └── ConfirmStop.tsx? (use useConfirm)   # optional thin wrapper
├── lib/editorState.ts                      # NEW pure: statuses, stations, slab model, PLAIN_STEPS, deriveBehindSteps, formatIssueLine
├── lib/nomenclature.ts                     # + STATUS_WORDS export only
├── lib/nav.ts                              # relabel ADMIN_ITEMS, add EDITOR_NAV
├── app/(editorial)/{layout.tsx,page.tsx,_components/*, archive/*, s/[section]/*}
└── app/admin/{layout.tsx,page.tsx,runs/[runId]/page.tsx,_components/BehindRun*.tsx}
```

### Pattern 1: Pure derivation module with view/data seam (existing house pattern)
**What:** `IssueHome` (client data wrapper) assembles inputs; a pure function returns a view-model; `IssueHomeView` renders from props only. `IssueHomeView.tsx` already documents this "RunBody/RunScreen seam". Keep it: it makes the 7 artboards testable without Convex/Clerk mocks.
**When:** every new screen. Put derivation in `lib/editorState.ts` with unit tests (like `homeSections.test.ts`, 246 lines, pure).

```typescript
// Source: pattern from apps/dispatch-control/lib/homeSections.ts + app/(editorial)/_components/IssueHome.tsx
export type StatusWord = 'Done' | 'Working' | 'Waiting for you' | 'Not yet' | 'Stopped' | 'Problem'
export type HomeState =
  | 'loading' | 'empty' | 'writing' | 'checking' | 'ready' | 'ready-collab'
  | 'held' | 'published' | 'stopped' | 'problem' | 'stuck'

export function deriveEditorHome(args: {
  footer: HomeFooter            // from deriveHomeFooter
  held: boolean | undefined
  role: Role | undefined
  rows: HomeSectionRow[] | undefined
}): { state: HomeState; stations: StationVM[]; writtenCount: number; fixCount: number }
```

### Pattern 2: Pin a screen to any run via `?run=`
`useCurrentRun({ runId })` already supports pinning; `/s/[section]` already reads `searchParams` (Thenable-safe). Apply the same to `/`: server `page.tsx` becomes `async function Page({searchParams})` and passes `runId` to `<IssueHome runId=... />`. Keep `export const dynamic = 'force-dynamic'` and no `'use client'` (homeRoute test).

### Pattern 3: Client-side keep/undo for "Rewrite this part"
```typescript
// Source: lib/pipelineControlClient.ts rerollAgent + lib/contentPatchClient.ts (existing APIs only)
// 1) before = blocksFor(draft, sectionId)          // snapshot from the already-loaded draft
// 2) await rerollAgent(runId, AGENT_FOR_SECTION[sectionId], token)   // overwrites Sanity draft
// 3) draft2 = await getDraft(runId, token)         // show new text, offer Keep / Go back
// 4) Go back: patchSection(runId, id, {ifRevisionID: draft2.revisionId, blocks: before}, token)
//    (bonus: patchBonus(runId, {ifRevisionID, body: before}))
const AGENT_FOR_SECTION: Record<string, string> = {
  originStory: 'origin_story', problemStatement: 'problem', founderBio: 'founder_bio',
  caseStudy: 'case_study', bonus: 'bonus', game: 'game', theme: 'design',
} // deliberation-conversation and podcast: no Rewrite button
```
Caveats: reroll is blocked while the run is `running` (409) and for published issues (hide it); it re-runs the writer against checkpointed state (can take tens of seconds; show "Rewriting this part…" inline and keep old text visible); for `game`/`theme`, undo requires `patchGame`/`patchTheme` payloads rather than blocks, so restrict the Keep/Go-back flow to block-based parts (origin, problem, founder, case study, specAd bonus) and, for game/theme/jingle/bigBudget bonus, either hide Rewrite or accept "no undo" (Open Question 2).

### Anti-Patterns to Avoid
- **Forking run-state logic.** Do not re-derive "ready/running/published" inside components; the Phase 52 selector exists and its tests encode edge cases (HOME-09: nothing reads "written" until every input has arrived).
- **Following issue numbers.** Current issue = `runs.latest` via `useCurrentRun` (lib/currentRun.ts explains the two-definitions bug). Past issues pin by `runId`.
- **Showing the Gate-1 `Interrupt(...)` repr or labelling a pause Problem** (client bug 8).
- **Disabled/dead buttons.** UI-SPEC: Working indicator, never a disabled primary. This removes `DISABLED` grey button styles used today.
- **Using `bg-white` / `text-white` / `neutral-*` literals in admin files covered by `screen-token-swap.test.ts`** (finance, automation, settings pages and components): use `bg-card` / token classes there.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| "Which run is current" | new max(issueNumber) or custom query | `useCurrentRun` | known double-definition bug |
| "Is the issue ready/published/running" | new status logic in components | `deriveHomeFooter` + new thin `deriveEditorHome` | edge cases (cancelled, gate1, completedAt) already encoded |
| Saving a paragraph | direct fetch to Sanity | `patchSection` / `patchBonus` with live `draft.revisionId` | EDT-05 tripwire forbids Sanity writes from this app; 409 handling exists |
| Publish | new endpoint call | `publishChain` | single call, server enforces role+hold |
| Stop a run / start a run | custom fetch | `cancelRun` / `triggerRun` | audit + Clerk guard |
| Confirm dialogs | `window.confirm` or new modal | `useConfirm()` | z-order ladder, focus handling |
| Run cost | `runs.cost` JSON | `deriveRunCostUsd(agentRuns)` | bug 6 ($0.00) |
| Gate-1 pause detection | regex on error | `isGateInterrupt` | already tested |
| Game rendering | new iframe | `GalleryGameSlot` | sandbox hardening; project security constraint |
| Icons | add lucide to editor pages | inline SVG copied from the canvas | UI-SPEC says inline SVG only |

**Key insight:** almost no new logic is needed; the risk is re-implementing state logic while re-skinning.

## Retirement Inventory (first-class deliverable; Phase 34 lesson)

Nothing here is done until a test or grep proves it gone. Each item gets a verification in plan 56-09 (see Validation Architecture).

| Retire | Where | Replacement | Proof |
|---|---|---|---|
| Mono-caps chips / `font-mono` / `uppercase tracking-` on editor pages | `ArchiveBody.tsx` (GROUP_CHIP_META, filter pills), `IssueHomeView` eyebrows, `SectionEndNav`, `InPlaceBlockEditor` (`textTransform: uppercase`, 11px), `admin/page.tsx` "Checked weekly" chip, `runs/layout.tsx` tabs, status chips in `RunsTable`/`RunDetail` | `StatusWord`, plain text tags | source-scan test over the new editor files forbidding `font-mono`, `uppercase`, `tracking-[`, `text-[9px]`..`text-[14px]` (15px floor, except the `<pre>`) |
| Publish footer w/ inline confirm | `PublishFooter.tsx` | slab primary button | file deleted; `grep -r PublishFooter` empty |
| Separate Start/Hold/Stop blocks | `StartIssueButton.tsx`, `HoldDialog.tsx`, `HeldIssueRow.tsx`, old `HoldControl`, `StopRunButton` styling | slab + footer ghost buttons; `StopRunButton` logic folded into the footer using `useConfirm` | files deleted/rewritten; tests replaced |
| Old copy constants | `lib/homeSections.ts` `*_SENTENCE`, `rowNote`; `lib/publishChain.ts` `PUBLISH_SLOW_NOTICE` ("Admin → Run Details"), `COLLABORATOR_LOCK_LABEL`, `HELD_REASON`; `StopRunButton` copy; `START_*` copy | new copy module (UI-SPEC copy table); keep the exported names only if tests import them, else delete | render-level banned-words test |
| Admin top bar (UserButton, "← Back to the issue", "Admin") and h-screen shell | `app/admin/layout.tsx` | `EditorShell` (3 links) | route test: no "Admin" link text anywhere on editor/admin pages |
| ⌘K command palette (shows "Run {id·8}") | `CommandPaletteProvider` in both layouts, `components/CommandPalette.tsx` | removed from both layouts (keep `ConfirmProvider`; keep `InspectorProvider` only if a mounted Galley path still needs `useInspector`) | layouts no longer import it; component file deleted or left unmounted |
| Run-id displays | `RunsTable`, `ReviewQueue`, `CommandPalette`, `RunDetail`, `admin/runs/[runId]/page.tsx` h1 "Run Detail" | `formatRunLabel` | banned-pattern test: no 8+ hex string in rendered text |
| Dead buttons "Restart from this step" / "Improve this agent" (already removed from `RecoveryRail` per cr6, still defined in `nomenclature.ts`, `InspectorFooter`, `PromptSaveDialog`, `AgentPromptEditorView`) | `RecoveryRail.tsx`, inspector, agents editor | delete rail; for agents editor keep only if wired (bug 9: every button must act) | grep + manual check |
| Jargon on sub-pages | "Trigger Run" (`RunControlBar`), "Pipeline Graph"/"DAG" (`runs/graph/page.tsx`), "Drift" (`tests/*`, `DriftStrip`, `RunsTable`, `agents` editor), "Re-roll" (`RerollButton`), "Calibrator"/"Chronicler" (`nomenclature.ts`, `agentList.ts`), "Tokens in/out" (`AgentIOPanel`, `TestRunPanel`), "Run Detail"/"Runs" headings, "Failed"/"Awaiting review" chips | plain labels (see UI-SPEC swaps: Start a new issue, Rewrite this part, Ready for you to read, Waiting for you) | banned-words render test per sub-page |
| Old tests asserting old UI | see Test Impact | rewritten | full suite green |
| `runs/layout.tsx` tab strip | `app/admin/runs/layout.tsx` | plain "Past issues, step by step" / graph link text | removed |

## Common Pitfalls

### Pitfall 1: Retirement half skipped (Phase 34 repeat)
**What goes wrong:** New screens ship, old components stay importable/reachable and drift from the server.
**How to avoid:** a plan whose sole job is deletion + tripwire tests (56-09), plus every rebuild plan lists the files it deletes in `files_modified` so the verifier can check.
**Warning signs:** `grep -rn "PublishFooter\|HoldDialog\|RecoveryRail\|RunDetail" app lib components` non-empty after the phase.

### Pitfall 2: Local live QA is impossible until CORS/env is ready
**What goes wrong:** (memory `local-dev-pipeline-cors-gap`) Phase 51 lost its whole human read-through.
**State today (verified 2026-10-22):** `apps/dispatch-control/.env.local` sets `NEXT_PUBLIC_PIPELINE_URL=http://localhost:8000` and `packages/pipeline/.env` has `DASHBOARD_ALLOWED_ORIGINS=http://localhost:3001`. So Route A is in place; the local pipeline must be started (`pnpm --filter pipeline dev`) before any browser QA. Add a Wave 0 task "start pipeline, load `/` in the browser, confirm a draft renders" before building UI.
**Warning signs:** blank parts list with a CORS error in the console.

### Pitfall 3: OPENROUTER key revoked
Only matters for creating a new issue. Browser QA of Home/Section/Archive/Behind can use existing data. A real Rewrite this part and Start a new issue run cannot be exercised end-to-end until the key is replaced (Railway + local `.env`). Plan the end-to-end QA as a human-gated checkpoint.

### Pitfall 4: Strict build only fails on real build
vitest does not type-check and `tsc --noEmit` is already noisy in `__tests__/`. Run `pnpm --filter dispatch-control build` after every wave touching routes. Also: two route groups owning `/` broke Vercel before (1430b98f); keep exactly one `page.tsx` at root (`homeRoute.test.ts` guards it). Server pages must not import client-only hooks.

### Pitfall 5: Archive "Stopped vs Problem" without the runs table
See Summary finding 2; do not trust `pipelineRuns.status === 'failed'` to mean Problem.

### Pitfall 6: Collaborator and Held states are undrawn
`LockedControl` renders a disabled button plus a label. UI-SPEC wants a sentence in the slab and no Publish button (no dead/disabled controls). Do not reuse `LockedControl` for Publish; render the Collaborator sentence instead. `derivePublishGate` still useful for the server-parity logic. Keep `role === undefined` (loading) from flashing the Collaborator sentence.

### Pitfall 7: Token drift
Canvas amber `#9a6f04` fails AA; UI-SPEC adds `--color-amber-text:#8a6403`. `--color-green` (#148a52) and `--color-paper` (#e9eaec) already exist with different meanings: add new tokens (`--color-done`, `--color-amber-text`, `--color-problem`, `--color-wash`, `--color-current`, `--color-line`, `--color-line-strong`), never mutate existing ones (`design-tokens.test.ts` asserts the existing values; legacy admin screens depend on them). Editor pages use `--color-rail` as page background, not `--color-paper`. Keep `IBM_Plex_Mono` imported in `app/layout.tsx` (the same test asserts the import string) but never apply `font-mono` on editor pages.

### Pitfall 8: Spacing/size snapping
UI-SPEC is deliberately snapped (22 to 24, 18 to 16, 19 px is dropped; sizes only 15/17/18/23/26/32/42/48). The canvas values differ (e.g. blurb 19px, slab padding 28/32). Follow UI-SPEC, not the canvas, for these.

### Pitfall 9: InPlaceBlockEditor focus/dirty model
The new per-paragraph editor needs: one open at a time, `ConfirmDialog` when opening another with unsaved edits, Escape = cancel, focus returns to the paragraph, `revisionId` read fresh at save time (a retry after 409 must use the reloaded revision), "Saved" for 3s, Save error copy per UI-SPEC with the text kept in the box. Phone: textarea 6 rows, scroll into view on focus, pencil always visible.

### Pitfall 10: Past-issue Home for Problem/Stopped issues
UI-SPEC item 4: `/?run=<id>` for a failed/stopped run should redirect to `/admin/runs/<id>`. Implement in the client wrapper (router.replace) or server page; `issueOpenHref` and Archive must agree.

## Code Examples

### Slab model (one component, all states)
```typescript
// Source: pattern from UI-SPEC "Your next step" + existing IssueHomeView props seam
interface SlabVM {
  sentence: string
  explanation?: string
  primary?: { label: string; onClick: () => void; busy?: boolean }   // cobalt, max one per page
  working?: boolean                      // renders dot + "Working", no button
  ghost?: { label: string; href: string } // nav-only pages
  link?: { label: string; href: string; external?: boolean }
  error?: string                         // inline, 15px, --color-problem, 600
}
```
Exactly-one-primary is testable: `container.querySelectorAll('[data-primary]').length <= 1` per rendered page.

### Test mocking convention (copy from `__tests__/IssueHome.test.tsx`)
`vi.hoisted` for client fns; `vi.mock('convex/react')`, `vi.mock('@clerk/nextjs')` (`useAuth`, `useUser` publicMetadata.role), `vi.mock('@convex/_generated/api')`, `vi.mock('@/lib/useCurrentRun')`, `vi.mock('next/navigation')`; `.test.tsx` auto-jsdom.

## State of the Art

| Old | Current (this phase) | Impact |
|---|---|---|
| Phase 52 footer with a mono-caps console feel, sign-off and finding gates | slab + stations; no gates (261021-7aw) | simpler state machine |
| Admin hub of 7 links + chips | Behind page: step list + 7 "dials" | relabel only |
| Per-selection PassageToolbar edit | per-paragraph pencil | fewer states |

**Deprecated here:** `deriveTasks`/`deriveStageStates` consumers, `lib/homeSections.ts` copy constants, `LockedControl` for publish.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Node | all | yes | v24.13.0 | none needed (CLAUDE.md says 18+) |
| pnpm | build/test | yes | 9.15.4 | none |
| vitest suite | gate | yes | 104 pass / 1 baseline fail | n/a |
| `next build` | gate | assumed (env keys present in `.env.local`; not executed in this research) | n/a | confirm early; memory says a build is the only strict type gate |
| Local pipeline on :8000 | browser QA | configured (`.env.local`, CORS allowlist `localhost:3001`), not running now | n/a | start `pnpm --filter pipeline dev` |
| Convex dev deployment `modest-magpie-797` | data | live, shared | n/a | none |
| OPENROUTER_API_KEY | new issue / Rewrite end-to-end | NO (revoked 2026-10-22) | n/a | QA read paths on existing data; defer end-to-end to a human checkpoint after key replacement |
| Browser QA tool (`ecc:browser-qa`) | SC-2 | assumed available per ROADMAP | n/a | manual walkthrough at 1280 and 400 px |

**Missing, blocking nothing in build:** OpenRouter key. No Convex or backend change is planned, so no `convex dev:once` sync is needed; if the plan author adds a Convex query anyway, add that sync step (memory `convex-functions-need-live-sync`).

## Validation Architecture

> `.planning/config.json` has `workflow.nyquist_validation: true`.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ^3.2.0 + @testing-library/react ^16.3 + jest-dom + jsdom ^26 (node env for `.test.ts`, jsdom for `.test.tsx` via `environmentMatchGlobs`) |
| Config file | `apps/dispatch-control/vitest.config.ts` (globals false, so import `describe/it/expect`) |
| Quick run command | `pnpm --filter dispatch-control exec vitest run __tests__/<file>` |
| Full suite command | `pnpm --filter dispatch-control test` (about 30 s; 106 files) |
| Strict gate | `pnpm --filter dispatch-control build` |
| Not a gate | `pnpm --filter dispatch-control typecheck` (pre-existing errors inside `__tests__/`) |

### Phase Requirements to Test Map
| Req | Behavior | Test type | Automated command | File exists? |
|-----|----------|-----------|-------------------|--------------|
| P56-B1 | every run/issue state maps to exactly one of six words; gate-interrupt never Problem; cancelled gives Stopped | unit (pure) | `vitest run __tests__/editorState.test.ts` | Wave 0 |
| P56-B2 | stations + slab copy per Home state; Collaborator sentence; held; empty | unit + component | `vitest run __tests__/editorState.test.ts __tests__/IssueHomeView.test.tsx` | Wave 0 / rewrite |
| P56-A1 | each artboard route renders (loading, empty, writing, ready, held, published, problem); phone classes present (`grid-cols-1 sm:grid-cols-4`, full-width button classes) | component (class assertions only; jsdom has no layout) | `vitest run __tests__/IssueHomeView.test.tsx __tests__/SectionReaderPage.test.tsx __tests__/ArchiveScreen.test.tsx __tests__/AdminHub.test.tsx __tests__/BehindRun.test.tsx` | rewrite + Wave 0 |
| P56-A1 (visual) | pixel/spacing fidelity at 1280 and 400 px | manual / browser QA | `ecc:browser-qa` | manual-only (layout not testable in jsdom) |
| P56-A2 | walkthrough: open past issue from Archive (bug 1), Review/Open links land on the issue (bug 2), Stop exists (bug 3), runs list names not ids (bug 4), paragraph edit works (bug 5), cost not $0.00 (bug 6), nine parts (bug 7), pause not red Failed (bug 8) | component tests for 1-8 + browser QA replay | per-bug assertions in the files above; replay manual | partial automated |
| P56-A3 | no banned words / run ids / raw errors; exactly one `[data-primary]` per page | render-level scan test over all 7 screens with fixture data | `vitest run __tests__/editorCopy.test.tsx` | Wave 0 |
| P56-A3 | no `font-mono`, `uppercase`, `tracking-[`, sub-15px text in new editor files | source-scan | `vitest run __tests__/editorStyle.test.ts` | Wave 0 |
| P56-B3 | nav has exactly 3 links, labels, `aria-current` | component | `vitest run __tests__/EditorShell.test.tsx __tests__/nav.test.ts` | Wave 0 / rewrite |
| P56-B4 | Save calls `patchSection` (or `patchBonus` for bonus) with fresh `revisionId`; 409 copy; Escape cancels; unsaved-switch confirms; Rewrite hidden for podcast/deliberation and published; Go back re-applies snapshot | component | `vitest run __tests__/SectionReaderPage.test.tsx __tests__/RewriteThisPart.test.tsx` | rewrite + Wave 0 |
| P56-B5 | retired files gone; admin layout has no "Admin" link; palette unmounted | source-scan | `vitest run __tests__/editorRetirement.test.ts` | Wave 0 |
| route ownership | single `page.tsx` at `/`, server component, `force-dynamic` | existing | `vitest run __tests__/homeRoute.test.ts` | exists (keep green) |
| P56-A4 | strict build + full suite | build | `pnpm --filter dispatch-control build && pnpm --filter dispatch-control test` | n/a |

Banned-word regex for `editorCopy.test.tsx` (UI-SPEC list, case-insensitive, word-boundary, applied to `document.body.textContent` minus any `<pre>`): `run|trigger|pipeline|graph|DAG|drift|re-?roll|calibrator|chronicler|agent|token|gate|interrupt|deterministic|awaiting-review|failed`. Careful: "run" will false-positive on ordinary words; use `\brun(s)?\b` and review fixtures (the Behind dial label "Past issues, step by step" avoids it). Also assert no `/\b[0-9a-f]{8}\b/` and no `Interrupt(`.

### Sampling Rate
- **Per task commit:** the single touched test file(s) via the quick command.
- **Per wave merge:** full vitest plus `pnpm --filter dispatch-control build`.
- **Phase gate:** full suite green, strict build green, browser-QA walkthrough at 1280 px and 400 px recorded in a `56-UAT.md`, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `__tests__/editorState.test.ts` (pure derivation: P56-B1/B2)
- [ ] `__tests__/EditorShell.test.tsx`, `__tests__/NextStepSlab.test.tsx`, `__tests__/Stations.test.tsx`
- [ ] `__tests__/BehindRun.test.tsx`, `__tests__/BehindSteps.test.ts`
- [ ] `__tests__/RewriteThisPart.test.tsx`
- [ ] `__tests__/editorCopy.test.tsx`, `__tests__/editorStyle.test.ts`, `__tests__/editorRetirement.test.ts`
- [ ] Pre-flight: start local pipeline, confirm a draft loads in the browser (CORS) before any UI work; record the baseline "1 failing test" so it is not mistaken for a regression

## Test Impact (existing tests that will break or be replaced)

| Test file | Why | Action |
|---|---|---|
| `IssueHome.test.tsx` (296 lines), `IssueHomeView.test.tsx` (283) | assert old footer/StoryRow/copy | rewrite against new view model |
| `StartIssueButton.test.tsx`, `HoldControl.test.tsx`, `HoldDialog.test.tsx` | components removed/rewritten | rewrite (keep `canStartIssue`/`startErrorMessage` logic tests if those functions are kept) / delete HoldDialog test |
| `SectionReaderPage.test.tsx` (554, includes the 1 baseline failure) | selection-toolbar edit flow replaced by pencil flow | rewrite |
| `ArchiveScreen.test.tsx` (146) | chips, filter pills, row layout | rewrite |
| `AdminHub.test.tsx`, `nav.test.ts` | label/heading/"Checked weekly" chip/"Admin" h1 assertions | rewrite (nav.test still must check every href has a `page.tsx`) |
| `RecoveryRail.test.tsx` (244), `runDetailActionNames.test.ts` (166), `runControl.test.tsx` | RecoveryRail/RunDetail/RunControlBar retired or relabelled | delete or rewrite against `BehindRun` / relabelled controls |
| `homeSections.test.ts` (246) | still valid if `deriveHomeSections/Footer` untouched; copy-constant/`rowNote` assertions break if those are removed | keep functions, drop only constants you delete |
| `publishChain.test.ts` | copy constants | update if strings change |
| `design-tokens.test.ts`, `screen-token-swap.test.ts` | must stay green | do not alter existing tokens; avoid `bg-white`/`text-white`/`neutral-` literals in the 13 swap-listed admin files |
| `Galley.test.tsx`, `PassageToolbar.test.tsx`, `AnnotationMark.test.tsx`... | Galley untouched | stay green; do not edit Galley props except additive |
| `nextConfigRedirects.test.ts`, `homeRoute.test.ts`, `dispatch-control-no-sanity-write.test.ts`, `roleGateInventory.test.ts` | structural guards | must stay green (no Sanity SDK import; no new role gates) |

## Suggested Plan Decomposition (waves, disjoint file ownership)

Frontmatter `files_modified` below is the exclusive ownership list per plan. Plans in the same wave never touch the same file.

**Wave 0 (pre-flight, no code):** start local pipeline and confirm CORS/draft loads; record the baseline suite (1 known failure); decide Open Questions 1 to 5 with the user if possible.

**Wave 1 (parallel, disjoint):**
- **56-01 Foundation: tokens, shell, primitives.** Owns `app/globals.css` (additive tokens), `components/editor/{EditorShell,NextStepSlab,StatusWord,Stations,StepList,PartsList}.tsx`, `app/(editorial)/layout.tsx`, `app/admin/layout.tsx` (swap in `EditorShell`; unmount `CommandPaletteProvider`; keep `ConfirmProvider`, keep `InspectorProvider` only if still needed), `lib/nav.ts` (EDITOR_NAV + relabelled ADMIN_ITEMS), `lib/nomenclature.ts` (additive `STATUS_WORDS` only), tests `EditorShell/NextStepSlab/Stations`. Note: `nav.test.ts` rewrite belongs here since it owns `nav.ts`; `AdminHub.test.tsx` belongs to 56-06.
- **56-02 Pure derivation (TDD).** Owns `lib/editorState.ts`, `lib/issueTitle.ts` (additive `formatIssueLine`), `lib/issueRouteResolver.ts` (`issueOpenHref` to `/?run=`), `lib/homeSections.ts` (copy constants only, if removed), `lib/publishChain.ts` (copy constants), tests `editorState.test.ts`, `issueTitle.test.ts`, `issueRouteResolver.test.ts`, `homeSections.test.ts`, `publishChain.test.ts`. No React.

**Wave 2 (parallel after Wave 1; each owns its own directory):**
- **56-03 Home (`/`, `/?run=`).** Owns `app/(editorial)/page.tsx`, `app/(editorial)/_components/{IssueHome,IssueHomeView,HoldFooter(new),StartIssue(folded)}.tsx`; deletes `PublishFooter, StoryRow, StartIssueButton, HoldDialog`, rewrites `HoldControl`; tests `IssueHome*.test.tsx`, `StartIssueButton/HoldControl/HoldDialog` tests, `homeRoute.test.ts` stays green. Does NOT delete `HeldIssueRow` (Archive imports it until 56-05 removes the import; deletion in 56-09).
- **56-04 Section.** Owns everything under `app/(editorial)/s/[section]/` and `SectionReaderPage.test.tsx`, new `RewriteThisPart.test.tsx`. Includes the keep/undo flow, per-paragraph editor, prev/next, phone behaviour, published read-only.
- **56-05 Archive.** Owns `app/(editorial)/archive/**`, `ArchiveScreen.test.tsx`; removes the `HeldIssueRow` import; includes the `runs.listRecentForWorkspace` join and `?issue=N` forwarding.
- **56-06 Behind hub.** Owns `app/admin/page.tsx`, `AdminHub.test.tsx`; step list for the latest issue (uses `agentRuns.byRunId`), dials list, cost/time footer.
- **56-07 Behind-Run.** Owns `app/admin/runs/[runId]/page.tsx`, new `app/admin/runs/_components/BehindRun*.tsx`, `BehindRun.test.tsx`; deletes `RunDetail.tsx`, `RecoveryRail.tsx`, `RerollButton.tsx` and their tests (`RecoveryRail.test.tsx`, `runDetailActionNames.test.ts`); keep `CancelRunButton` only if the runs list still needs it. Needs `StepList` and `deriveBehindSteps` from Wave 1; shares nothing else with 56-06 (both import, neither edits, `StepList`).
- **56-08a Sub-page sweep: runs.** Owns `app/admin/runs/page.tsx`, `layout.tsx`, `loading.tsx`, `_components/{RunsTable,RunControlBar,ReviewQueue,CostRollup,BudgetAlertBanner,CancelRunButton}.tsx`, `app/admin/runs/graph/**`, `runControl.test.tsx`.
- **56-08b Sub-page sweep: the rest.** Owns `app/admin/{agents,tests,automation,finance,settings,charities}/**` and `components/inspector/**`, `components/help/helpCopy.ts` (jargon labels only). Heavy; keep to headings, button labels and status chips (no layout redraw per UI-SPEC). Do not violate `screen-token-swap` for the 13 listed files.

**Wave 3:**
- **56-09 Retirement + tripwires + gates.** Owns deletion of leftovers (`HeldIssueRow`, `components/CommandPalette.tsx` and its import sites, any dead exports), new `editorCopy.test.tsx`, `editorStyle.test.ts`, `editorRetirement.test.ts`, then `pnpm --filter dispatch-control build` + full suite. Contains a human-gated checkpoint: browser QA replaying `client-ux-feedback-261022.md` at 1280 and 400 px, writing `56-UAT.md`. Rewrite end-to-end (needs the OpenRouter key) is a separate optional check.

Conflict notes: `lib/nomenclature.ts` is edited only by 56-01 (additive); `lib/nav.ts` only by 56-01; layouts only by 56-01; `HeldIssueRow` import removal in 56-05 precedes deletion in 56-09; `lib/useCurrentRun.ts` and Galley are read-only for the whole phase.

## Walkthrough mapping (for SC-2 and the UAT script)

| Client item | Where fixed in this phase |
|---|---|
| 1 Past issues titles do nothing | Archive title is a link to `/?run=<id>` (56-05) |
| 2 "Review" / "Open issue" links go to `/` | those links no longer exist; Behind-Run slab/breadcrumb link to the issue (56-07) |
| 3 No Stop button | footer ghost "Stop writing this issue" with confirm (56-03) |
| 4 20 identical "Awaiting review" cards, run ids | runs list uses names + six words (56-08a) |
| 5 Only Re-roll, no sentence edit | Section pencil edit (56-04) |
| 6 $0.00 | `deriveRunCostUsd` in Behind and Behind-Run (56-06/07) |
| 7 "Seven" heading vs six | nine parts list (already nine rows; 56-03) |
| 8 Pause shown as red Failed + raw repr | `isGateInterrupt` mapped to Waiting for you; repr never printed (56-02/07) |
| 9 Dead buttons | RecoveryRail retired; sweep (56-07/09) |
| Jargon list | 56-08a/b + `editorCopy.test.tsx` |

## Open Questions

1. **What date goes in "Issue 48 · Thursday 29 October 2026"?**
   - Known: `issues` has `scheduledFor`, `publishedAt`, `createdAt`; run has `startedAt`; cadence is "every Thursday".
   - Unclear: the canvas shows the issue's Thursday, not necessarily the start date.
   - Recommendation: published gives `publishedAt` date; else `scheduledFor`; else the first Thursday on or after `runStartedAt`. Put it in `formatIssueLine` with a unit test; confirm with the user.
2. **Rewrite this part for game / look (theme) / jingle / bigBudget bonus.**
   - Known: reroll works for the 7 writers but only block-based parts have a trivial undo snapshot.
   - Recommendation: show Rewrite on origin, problem, founder, case study and specAd bonus with full Keep/Go-back; for game and Look, Rewrite runs with a confirm ("this replaces the current version") and no undo, or hide it. Ask the user; default to hiding for game/theme/non-specAd bonus.
3. **Undrawn Home states: Stopped (cancelled) and legacy Gate-1 "stuck".**
   - UI-SPEC covers "Stopped / Problem" with one sentence ("hit a problem and stopped"), which is wrong wording for a deliberate Stop.
   - Recommendation: Stopped sentence "This issue was stopped. Nothing reached readers." with the same Start a new issue button; stuck (legacy, should not occur since Gate 1 auto-proceeds): sentence "This older issue can't continue." with primary "Stop this issue" (confirm). Low traffic, so keep minimal.
4. **"Not started" vs "Not yet" on Behind-Run.** UI-SPEC item 9 says "Not started"; locked decision 3 says six words only. Recommendation: "Not yet".
5. **Archive reasons for Stopped/Problem rows.** Per-row specific reason needs `agent_runs` per run (N subscriptions). Recommendation: generic reason by status + whether a charity was chosen; specific text on Behind-Run only.
6. **Held reason and `heldBy` display.** Old UI showed "Held · reason · by · time". UI-SPEC drops it. Recommendation: do not show it; use fixed reason string on hold.
7. **Mobile Home for a past issue** is "reuses Home-Published layout" but for a Done issue with an unpublished-but-ready run, `?run=` on a non-current ready run should behave like Home (publishable?). Recommendation: only the current run is publishable; a pinned older ready run shows read-only parts and no Publish.

## Project Constraints (from CLAUDE.md)

- Locked stack: Next.js 14+ App Router on Vercel (dispatch-control is Next 15), Sanity v3, FastAPI/LangGraph on Railway, Convex, Stripe: do not substitute.
- Read `docs/CLAUDE_CODE_BRIEF.md` and `docs/API_CONTRACTS.md` first; do not change schema field names without checking `API_CONTRACTS.md`. Contract-first: if a plan adds any API surface, update `docs/API_CONTRACTS.md` before code. (This phase plans none.)
- Start every session by confirming which build step you are on.
- Brand voice constraint (Jesse) applies to reader-facing content; editor-page copy uses the separate plain voice defined in UI-SPEC.
- Security: game HTML renders only inside `iframe srcdoc sandbox="allow-scripts"`; keep `GalleryGameSlot`/`galleyGameValidator` untouched. Theme CSS-variable injection must keep hex/font validation (`googleFontLoader`).
- Stripe/Convex conventions irrelevant here.
- GSD workflow: all repo edits through GSD commands (`/gsd:execute-phase`); the user's global CLAUDE.md is Hugging Face skills only (not relevant to this phase).
- Memory-derived rules (treat as constraints): run `pnpm --filter dispatch-control build` before declaring done; verify retirement halves; never reintroduce publish content gates; Convex function edits need `dev:once` sync; parallel worktree agents strand commits on branches (cherry-pick back and reconcile between waves); the GSD roadmap CLI misreports on this roadmap (read the `### Phase 56:` block directly).

## Sources

### Primary (HIGH confidence, read directly)
- `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md` (approved contract) and `canvas/Main.dc.html`, `canvas.json`
- `.planning/ROADMAP.md` Phase 56 block (locked decisions)
- `.planning/ui-reviews/client-ux-feedback-261022.md`
- `apps/dispatch-control/` sources: `app/(editorial)/**`, `app/admin/**`, `lib/{derivedState,homeSections,useCurrentRun,currentRun,publishChain,pipelineControlClient,contentPatchClient,issueTitle,runLabels,issueRouteResolver,nav,nomenclature,gateInterrupt,role,editableSections}.ts`, `components/{StopRunButton,LockedControl,galley/Galley,ui/ConfirmDialog,CommandPalette}.tsx`, `app/globals.css`, `app/layout.tsx`, `vitest.config.ts`, `package.json`, `next.config.ts`, `middleware.ts`, `__tests__/*` (headers of IssueHome, nav, AdminHub, homeRoute, design-tokens, screen-token-swap, roleGateInventory, publishNoTypedConfirm)
- `convex/schema.ts`, `convex/issues.ts` (`hold`, `listWithTitles`), `convex/runs.ts`, `convex/pipelineRuns.ts`
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` (`rerun_agent`, `cancel`)
- Executed: `vitest run` (104 pass, 1 fail, 975 tests pass), `tsc --noEmit` (pre-existing test errors), `node/pnpm --version`
- Memory: `dashboard-redesign-canvas-261022`, `phase34-retirement-half-done`, `local-dev-pipeline-cors-gap`, `run-strict-build-before-frontend-phase-done`, `no-publish-gates-agents-self-fix`

### Secondary / Tertiary
- None. No web research was needed (no new libraries). The canvas files other than `Main.dc.html` were not opened line by line; the UI-SPEC transcribes them and states it wins ties except where "Snapped".

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no new packages, versions read from package.json.
- Architecture / route map / reuse signatures: HIGH, read from source.
- State mapping tables: MEDIUM-HIGH, derived from `deriveHomeFooter` and schema; the Stopped/stuck sentences and issue-date source are recommendations awaiting confirmation.
- Rewrite keep/undo: HIGH that reroll overwrites (control.py read); MEDIUM on the client-side snapshot workaround for non-block parts.
- Pitfalls: HIGH (most are recorded in project memory and confirmed in code).

**Research date:** 2026-10-22
**Valid until:** about 14 days (the repo is moving fast; re-run `git log -- apps/dispatch-control` before planning if more than a few days pass).
