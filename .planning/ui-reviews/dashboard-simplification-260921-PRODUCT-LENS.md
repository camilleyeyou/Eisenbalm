# Dashboard Simplification: Product Lens

**Date:** 2026-10-21 · **App:** `apps/dispatch-control` · **Method:** ecc `product-lens`. Mode 1 (Product Diagnostic) to set the goal, Mode 3 (User Journey Audit, done statically from code) to find friction, Mode 4 (Prioritization) for the route disposition.
**Status:** READ-ONLY review. No code changed.

**Client brief (2026-10-21):** "Simplify the dashboard so everyone can easily use it."

**Settled decisions (not re-opened here):**
- `editorial-rebuild-v5`: one editor, agents write, the human edits; no pipeline-stage UI in the editor's path; admin tools sit behind one door; state is derived, with no "mark done".
- `no-publish-gates-agents-self-fix`: agents self-fix everything. Publish is gated only by the Editor-in-chief role plus the hold switch. There is no must-fix, remix or "ask agent" UX. This replaces the v5 "three gates in the footer".

---

## 1. Diagnostic (Mode 1)

| Question | Answer |
|---|---|
| **Who is it for?** | Two roles in `lib/role.ts`: **Editor-in-chief** (publishes) and **Collaborator** (reads, edits, comments, cannot publish). "Everyone" means anyone with a login, *including a first-time, non-technical Collaborator who has never seen the product*. See §2. |
| **What's the pain?** | There are two products in one app. `/` and `/s/[section]` (`app/(editorial)`) already form the simple editor. But every exit from them goes to the **old console**: `Admin` links to `/run` (`app/(editorial)/_components/IssueHome.tsx:166`), and from there a 10-item sidebar (`lib/nav.ts`), a 5-stage tab frame (`app/(dashboard)/issues/[issueNumber]/layout.tsx` STAGE_TABS), a tour, and an inbox take over. Weekly, the editor is forced into the old console for **four** routine jobs: choosing the charity (Gate 1 links to `/issues/[n]/story`), holding or releasing the issue (only `WorkspaceControls.tsx`), starting a run when none exists ("Open Admin →"), and commenting (only `IssueComments` in the old frame). |
| **Why now?** | Today's gate removal (quick 261021-7aw: commits `5f14897e`, `9971274e`) emptied the purpose of Fact Check, Voice, Approval, My Tasks and the review desks. The old surfaces still *say* the opposite of the new product, though. `onboardingCopy.ts:65` says "Publishing is blocked until errors are cleared". `onboardingCopy.ts:73` says "Both Facts cleared and Sounds human are required". `how-to-use/page.tsx:74` says "Publish stays locked until the Must fix list is empty". `FactCheckScreen`, `VoicePassRail`, `RunScreen` and `MyTasksScreen` still render must-fix and sign-off UX. A new user who wanders into them gets told wrong rules. |
| **10-star version** | You open one URL and see this week's issue, with nine stories and a Publish button. You read, fix a sentence in place, and press Publish. If the agents need a decision (the charity), the question shows up *on that same page*. Nobody ever sees the word "pipeline". Admin exists, but only the person who maintains the machine knows where it is. |
| **MVP** | (a) Bring the four forced exits into the editorial group. (b) Change the old console from the "Admin" destination into a hidden `/admin` hub. (c) Delete or redirect every surface that today's gate removal made dead. No backend changes. |
| **Anti-goals** | No new stages, tasks, inbox, tour, "mark reviewed", must-fix list, sign-off, or review/approval page. No multi-writer features. No backend changes (pipeline, Convex and the content-patch API stay as they are). No re-litigating the role model. |
| **How we know it worked** | (1) A first-time Collaborator, with no guide, can find this week's issue, edit a sentence and leave a comment in **under 2 min**. (2) The Editor-in-chief can do the whole weekly loop (choose charity, read, edit, publish) **without ever loading a `(dashboard)` route**. Measure with a server log or a Convex `lastVisitedStage`-style counter of `(dashboard)` hits per week by Editor-in-chief; target 0. (3) Zero UI strings anywhere that claim a content gate blocks Publish. |

**Go / no-go:** **GO.** This is mostly subtraction plus relocating four existing capabilities. The hard part, the editorial front door, already ships.

---

## 2. Personas: who "everyone" is

| # | Persona | Role | Tech comfort | Frequency | Notes |
|---|---|---|---|---|---|
| P1 | **Andrew, Editor-in-chief** | Editor-in-chief | Medium. Knows the product exists to publish one issue a week. | Weekly, 30–90 min Thu→Thu | Single-threaded. If he can't find something, no issue ships. |
| P2 | **First-time Collaborator** (proofreader, client staff, guest editor) | Collaborator | **Low.** Has never heard of agents, runs or stages. | Occasional | Arrives from an invite email. Has to understand what they're looking at in one screen. Can hand-edit, because content PATCH endpoints in `packages/pipeline/.../api/content.py` are not `_require_editor`-gated. Can **hold** and **reopen**, because `convex/issues.ts:108,162` use `requireOperator`, not `requireEditor`. Cannot publish. |
| P3 | **Returning Collaborator** | Collaborator | Medium | Weekly | Same jobs as P2, but wants to jump straight to "what changed / what's new". |
| P4 | **Operator / maintainer** (developer, or Andrew in "machine is broken" mode) | Editor-in-chief | High | Rare: on failure, or when tuning agents, budget or schedule | The only person who needs Run Details, Agent Instructions, Quality Tests, Registry, Config, Finance, Settings. |

P1–P3 are "everyone". P4 is the admin door.

---

## 3. Weekly jobs per persona

**P1 Editor-in-chief**
1. See this week's issue and whether it's ready ("Still writing" / "Choose the charity" / "Ready" / "Failed" / "Published").
2. **Choose the charity** when the agents pause at Gate 1.
3. Read the nine stories and hand-edit anything ("what the agents changed" is read-only).
4. Preview the issue as readers will see it.
5. **Publish**, or **hold** and later **release**.

**P2/P3 Collaborator**
1. Open this week's issue and understand it in one sentence.
2. Read and hand-edit sections.
3. Leave a comment for the Editor-in-chief.
4. (Rare) Put the issue on hold if something's wrong.
5. Look at a past issue.

**P4 Operator**
1. When a run fails, see why and restart it.
2. Start a run manually, or check the schedule.
3. Tune agent instructions, run quality tests, and manage the charity registry (Do-not-use list).
4. Check budget, revenue and payouts. Manage notifications and the audit log.

---

## 4. Which surfaces serve those jobs today

### Serve P1–P3 well (already the editorial product)
- `/`: `app/(editorial)/page.tsx` → `_components/IssueHome.tsx`, `IssueHomeView.tsx`, `PublishFooter.tsx`, `StoryRow.tsx`. Status sentence, nine stories, Preview, Publish gated by role and hold only (`lib/publishChain.ts`, `lib/homeSections.ts:52-56`).
- `/s/[section]`: `app/(editorial)/s/[section]/page.tsx`. Full-width reader, `InPlaceBlockEditor`, read-only `AgentChangesNote`, prev/next via `SectionEndNav`. No findings UI (`hideFindings`).

### Jobs P1–P3 must still leave the editorial product to do (the friction)
| Job | Where it lives today | Evidence |
|---|---|---|
| Choose the charity (Gate 1) | `/issues/[n]/story` (StoryBriefScreen + `NeedsYourDecisionCard`) **and** a duplicate at `/signal-desk` | `IssueHome.tsx:171`, `PublishFooter.tsx` `gate1` case |
| Hold / release | `/issues/[n]/*` frame → `issues/_components/WorkspaceControls.tsx` + `HoldDialog.tsx`; Reopen also on `/issues` (`HeldIssueRow.tsx`) | `PublishFooter` only *displays* `HELD_REASON` ("release the hold to publish") and offers no control to do it |
| Start an issue when none exists | `/run-monitor/runs` `RunControlBar.tsx` "Trigger Run", `/issues` `StartHereCard`/`CreatePanel.tsx`, `/issues/[n]/story` empty state | `PublishFooter` `none` case → "Open Admin →" → `/run` |
| Comment | `issues/[issueNumber]/_components/IssueComments.tsx`, mounted only in the old frame layout | `COLLABORATOR_LOCK_LABEL` promises "Collaborators can review and comment", but there is no comment UI on `/` or `/s/*` |
| Past issues | `/issues` (Archive) renders inside the old sidebar shell | `IssueHomeView.tsx` "Past issues" link |
| See why a run failed | `/issues/[n]/runs/[runId]` (RunDetail) | `PublishFooter` `failed` case. This is fine as an admin hop. |

### Pipeline machinery (P4 only: keep, but behind the admin door)
Run Monitor (`/run-monitor/*`), Prompt Lab (`/prompt-lab/*`), Eval Center, Registry, Config, Finance, Settings, Signal Desk.

### Dead or contradicting after today's gate removal (no remaining job)
- **Fact Check** `/issues/[n]/fact-check`: verify/dismiss claims, "Must fix" (`FactCheckScreen.tsx`). Agents now self-fix; claims gate nothing.
- **Voice** `/issues/[n]/voice` (+ `/voice-pass`, `/voice-pass/[runId]`): de-slop plus the "Sounds human" sign-off (`VoicePassRail.tsx`). Sign-offs are gone.
- **Approval** `/issues/[n]/approval`: `DecisionRail` two-sign-off publish. Publish now lives on `/` only.
- **Draft** `/issues/[n]/draft` (+ `/review`, `/review-desk/*`): the old galley review desk with findings rails (`StoryFindingsRail`, `StoryFocusView`). This is superseded by `/s/[section]`.
- **The Run** `/run` (`RunScreen.tsx`): an older front door with the "three gates" readout. It is superseded by `/`, but it is *currently the Admin link target*.
- **My Tasks** `/my-tasks` + `components/AwaitingYouInbox.tsx`: a cross-stage to-do inbox, which v5 already rejected. Its tasks are findings and sign-offs, which no longer exist.
- **Story-brief** as a *stage*: the lead/brief field table is pipeline steering. Only the Gate-1 *decision* is an editor job.
- **How to use** `/how-to-use` + **Onboarding tour** (`components/onboarding/*`, `StageHintStrip`): they teach the five-stage loop and the publish gates, and every rule they teach is now false (lines cited in §1).
- `/issues/[n]` bare route: a redirect into `lastVisitedStage`, i.e. into a dead stage.

---

## 5. Recommended minimal information architecture

**Principle:** two doors. The editorial door is for everyone and has **no sidebar**. The Admin door is for operators, with one hub page and one flat list. Every editor job finishes inside the editorial door.

```
EDITORIAL  (app/(editorial), no sidebar, top bar: "The Eisenbalm Dispatch" · Past issues · [Admin*])
  /                 This week's issue: status sentence · Gate-1 charity choice inline (or link to /choose)
                    · 9 stories · Preview · Hold/Release · Comments · Publish (EIC only)
  /s/[section]      Read + hand-edit one story · "what the agents changed" · comments on this story
  /choose           (only if inline is too big) Gate-1 charity choice: candidates + one "Use this charity" button
  /archive          Past issues by title (read-only), Reopen for held issues
  /sign-in

ADMIN  (one door: /admin hub, old sidebar shell kept here only)
  /admin            Hub: plain-language cards, e.g. "Something broke", "Start a run", "Agent instructions" ...
  /admin/runs, /admin/runs/[runId], /admin/runs/graph        (Run Details)
  /admin/agents, /admin/agents/[agentKey]                    (Agent Instructions = Prompt Lab)
  /admin/tests                                               (Quality Tests = Eval Center)
  /admin/charities                                           (Editorial Memory = Registry)
  /admin/automation                                          (Config: schedule, budget, auto-publish)
  /admin/finance
  /admin/settings
```
\* Whether **Admin** shows for Collaborators is open question Q1.

**Nav:**
- **Editorial:** no sidebar. Header links are only **Past issues** and **Admin** (role-dependent). Section pages use the existing "← Issue" link and prev/next.
- **Admin:** keep `AppSidebar` but reduce `NAV_GROUPS` (`lib/nav.ts`) to one flat list of 7 items plus a "← Back to the issue" link. Remove the "Editorial" group (The Run, Archive) and the pinned "How to use".
- Remove Masthead's awaiting-you inbox (`components/Masthead.tsx`, `AwaitingYouInbox.tsx`), `OnboardingProvider`/`OnboardingTour` from `app/(dashboard)/layout.tsx`, and the stage-digit keyboard shortcuts in the issue frame.
- **Help:** replace the tour and the How-to-use page with one plain sentence on `/` per state (already partly there in `homeSections.ts` SENTENCE constants), plus a three-line "How this works" disclosure: *agents write and check every story → you read and edit anything → Editor-in-chief presses Publish*.

**Path strategy (matches v5 "additive first, subtractive second"):** move admin routes with Next `redirects()` in `next.config.ts` (the pattern Phase 30 already used for `/graph`, `/runs`, `/prompts`). The old URLs keep working, and nobody's bookmark 404s. Shared components live in route folders (e.g. `review-desk/[runId]/_components/*`, `voice-pass/[runId]/_components/*`, `components/galley/*`), and `/s/[section]` and the admin pages still import some of them. **Delete route `page.tsx` files first; delete components only after an import sweep.**

---

## 6. Disposition of all 32 routes

Legend: **KEEP** stays in editorial · **MERGE** capability moves into another route, then this URL redirects · **ADMIN** stays, but only behind `/admin` (path move plus redirect) · **REDIRECT** already redirect-only, so keep the redirect and retarget it · **DELETE** remove the page (redirect the URL to `/` or the nearest live route).

| # | Route (file under `apps/dispatch-control/app/`) | Today | Job served | Disposition | Target / note |
|---|---|---|---|---|---|
| 1 | `(editorial)/page.tsx` → `/` | Issue front door | P1–P3 core | **KEEP** (+ absorb) | Add Hold/Release, Gate-1 choice, Start-issue (EIC), comments. Change `links.admin` from `/run` to `/admin`. |
| 2 | `(editorial)/s/[section]/page.tsx` | Section reader/editor | P1–P3 core | **KEEP** (+ comments) | Add per-section comments (reuse `IssueComments`, stage scope → section scope). |
| 3 | `sign-in/[[...sign-in]]/page.tsx` | Clerk sign-in | Everyone | **KEEP** | Check that post-sign-in lands on `/`. |
| 4 | `(dashboard)/issues/page.tsx` → `/issues` | Archive + StartHereCard + Held rows + Recently published | Past issues, reopen | **MERGE** → `/archive` (editorial group) | Keep the title list and Reopen. Drop `StartHereCard` (start lives on `/` and admin). Redirect `/issues` → `/archive`. |
| 5 | `(dashboard)/issues/[issueNumber]/page.tsx` | Redirect into lastVisitedStage | none | **REDIRECT** | Current issue → `/`; past issue → `/archive#n`. Retire `lastVisitedStage` writes (layout `setLastVisitedStage`). |
| 6 | `(dashboard)/issues/[issueNumber]/story/page.tsx` | Story & Brief stage + Gate 1 + Create | Gate-1 choice (P1); brief steering (P4) | **MERGE** | Gate-1 decision → `/` inline or `/choose` (reuse `NeedsYourDecisionCard`, `OrgOptionSlate`). Brief field table and lead steering → ADMIN (`/admin/runs/[runId]` or drop). Redirect → `/`. |
| 7 | `(dashboard)/issues/[issueNumber]/draft/page.tsx` | Old galley review desk | superseded by `/s/*` | **DELETE** | Redirect → `/`. Do not delete `ReviewDeskRunView` components until imports are swept. |
| 8 | `(dashboard)/issues/[issueNumber]/review/page.tsx` | Redirect → draft | none | **REDIRECT** | Retarget → `/`. |
| 9 | `(dashboard)/issues/[issueNumber]/fact-check/page.tsx` | Claim verify/dismiss, Must fix | **dead** (agents self-fix) | **DELETE** | Redirect → `/`. If an audit trail is wanted, add a read-only claims list in Admin Run Details (Q4). |
| 10 | `(dashboard)/issues/[issueNumber]/voice/page.tsx` | Voice de-slop + "Sounds human" sign-off | **dead** | **DELETE** | Redirect → `/`. |
| 11 | `(dashboard)/issues/[issueNumber]/approval/page.tsx` | DecisionRail sign-off + publish | **dead** (publish is on `/`) | **DELETE** | Redirect → `/`. This also removes a second publish path that could drift (lesson from `phase34-retirement-half-done`). |
| 12 | `(dashboard)/issues/[issueNumber]/runs/[runId]/page.tsx` | Run detail under issue | P4 "why did it fail" | **ADMIN** | → `/admin/runs/[runId]`. `PublishFooter` failed-link points here. |
| 13 | `(dashboard)/run/page.tsx` → `/run` | The Run (old front door, three-gates readout) | superseded by `/` | **DELETE** | Redirect → `/`. It is currently the "Admin" target, so repoint that first. |
| 14 | `(dashboard)/my-tasks/page.tsx` | Cross-stage task inbox | **dead** | **DELETE** | Redirect → `/`. Also remove `AwaitingYouInbox` from Masthead. |
| 15 | `(dashboard)/how-to-use/page.tsx` | Static guide + Replay tour | teaches false rules | **DELETE** | Replace with an inline "How this works" disclosure on `/`. Redirect → `/`. |
| 16 | `(dashboard)/review-desk/page.tsx` | Redirect → `/issues` | none | **REDIRECT** | Retarget → `/`. Move to `next.config.ts` and delete the file. |
| 17 | `(dashboard)/review-desk/[runId]/page.tsx` | Legacy run-keyed redirect | none | **REDIRECT** | Retarget → `/` (or `/archive`). Keep the `_components/` folder until the import sweep. |
| 18 | `(dashboard)/voice-pass/page.tsx` | Redirect → `/issues` | none | **REDIRECT** | Retarget → `/`. Move to config and delete the file. |
| 19 | `(dashboard)/voice-pass/[runId]/page.tsx` | Legacy redirect | none | **REDIRECT** | Retarget → `/`. |
| 20 | `(dashboard)/run-monitor/runs/[runId]/review/page.tsx` | Legacy redirect → approval | none | **REDIRECT** | Retarget → `/admin/runs/[runId]` (approval is gone). |
| 21 | `(dashboard)/signal-desk/page.tsx` | Gate-1 candidate slate + adjudication | duplicate of #6 | **MERGE** | Into the Gate-1 surface on `/` or `/choose`. Redirect. One place to choose a charity, not two. |
| 22 | `(dashboard)/run-monitor/page.tsx` | Redirect → runs | P4 | **ADMIN** | `/admin/runs`. |
| 23 | `(dashboard)/run-monitor/runs/page.tsx` | Runs list, Trigger Run, cost rollup, budget banner | P4 start/inspect runs | **ADMIN** | `/admin/runs`. EIC "Start this week's issue" on `/` reuses `pipelineControlClient`. |
| 24 | `(dashboard)/run-monitor/runs/[runId]/page.tsx` | Run detail | P4 | **ADMIN** | `/admin/runs/[runId]`. Merge with #12, since they render the same `RunDetail`. |
| 25 | `(dashboard)/run-monitor/graph/page.tsx` | Pipeline graph | P4 | **ADMIN** | `/admin/runs/graph` (tab of Run Details). |
| 26 | `(dashboard)/prompt-lab/page.tsx` | Agent instructions list | P4 | **ADMIN** | `/admin/agents`. |
| 27 | `(dashboard)/prompt-lab/[agentKey]/page.tsx` | Prompt editor + test run | P4 | **ADMIN** | `/admin/agents/[agentKey]`. |
| 28 | `(dashboard)/eval-center/page.tsx` | Quality tests / drift | P4 | **ADMIN** | `/admin/tests`. |
| 29 | `(dashboard)/registry/page.tsx` | Charity registry / Do-not-use | P4 (maybe P1, Q5) | **ADMIN** | `/admin/charities`. |
| 30 | `(dashboard)/config/page.tsx` | Schedule, kill-switch, budget caps, auto-publish | P4 | **ADMIN** | `/admin/automation`. Re-check `AutoPublishToggle` copy now that there are no gates (Q6). |
| 31 | `(dashboard)/finance/page.tsx` | Revenue, payouts, pricing | P4 / client finance | **ADMIN** | `/admin/finance`. |
| 32 | `(dashboard)/settings/page.tsx` | Notifications + audit log | P4 | **ADMIN** | `/admin/settings`. |

**Net:** 32 → **5 editorial** (`/`, `/s/[section]`, `/archive`, `/sign-in`, optional `/choose`) + **1 admin hub + 10 admin pages**. 10 routes are deleted and 9 become config-level redirects (no page files). Sidebar items for everyone: 10 → **0**.

---

## 7. Prioritized next steps (Mode 4: Impact × Confidence ÷ Effort)

| # | Step | I | C | E | Score |
|---|---|---|---|---|---|
| 1 | Repoint `links.admin` `/run` → `/admin` hub. Remove the Editorial group, How to use, the tour and the inbox from the admin shell. | 5 | 5 | 2 | 12.5 |
| 2 | Delete or redirect the dead surfaces (#7–11, 13–15, 16–20) and purge the false-rule copy (`onboardingCopy.ts`, `helpCopy.ts`, `how-to-use`, `nomenclature.ts` "Must fix"). | 5 | 5 | 2 | 12.5 |
| 3 | Hold/Release control on `/` (reuse `HoldDialog`, `api.issues.hold/reopen`). | 5 | 5 | 2 | 12.5 |
| 4 | Gate-1 charity choice on `/` (reuse `NeedsYourDecisionCard`). Merge `/signal-desk`. | 5 | 4 | 3 | 6.7 |
| 5 | Comments on `/` and `/s/[section]` (reuse `IssueComments`). | 4 | 4 | 3 | 5.3 |
| 6 | Move admin routes under `/admin/*` with `next.config.ts` redirects. | 3 | 5 | 3 | 5.0 |
| 7 | "Start this week's issue" (EIC) on `/` for the `none` state. | 3 | 4 | 3 | 4.0 |

Run as one `/gsd:quick` per row or a single phase. Per memory `editorial-rebuild-v5`, **mock up #3–#5 in Claude Design and get client sign-off before coding**. Run `pnpm --filter dispatch-control build` before declaring done.

---

## 8. Open questions for the client

1. **Admin visibility:** should Collaborators see the **Admin** link at all, or is it Editor-in-chief-only (hidden, with server gates unchanged)? Recommendation: Editor-in-chief-only.
2. **Hold permissions:** today *any* signed-in user can hold **and release** (`convex/issues.ts` `hold`/`reopen` use `requireOperator`). Should release be Editor-in-chief-only?
3. **Gate 1:** should the editor still choose the charity each week, or should the agents' recommended charity auto-proceed (like the self-fix decision) with the editor able to override? This decides whether `/choose` exists at all.
4. **Fact-check audit trail:** with agents self-fixing, does anyone want to see which claims were checked and cut? If yes, read-only in Admin Run Details. If no, the claims UI is deleted outright.
5. **Comments:** are comments actually used? If not, drop them instead of moving them, and change `COLLABORATOR_LOCK_LABEL` ("review and comment") to match.
6. **Auto-publish** (`config/_components/AutoPublishToggle.tsx`, `AutoPublishBanner`): with no content gates, auto-publish means agents publish with zero human reads. Keep, hide, or remove?
7. **Who starts a run:** is the weekly run always the schedule/cron (the pre-deploy audit noted that no cron existed), or should the Editor-in-chief have a "Start this week's issue" button on `/`?
8. **Finance and the charity registry:** does the client (non-operator) look at revenue and payouts or the Do-not-use list weekly? If yes, those two become small links on `/` or `/archive` instead of Admin-only.
9. **Old URLs:** can the old console URLs simply redirect now, or must the old console "keep running at its URL until the new one is proven" (v5)? Recommendation: redirect. The new door has been live since Phase 52.
