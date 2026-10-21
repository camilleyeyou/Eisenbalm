# Dispatch Control — Click-Path Audit for Dashboard Simplification

**Date:** 2026-10-21 · **Method:** ecc `click-path-audit` (trace every touchpoint → state change → final UI vs label promise) · **Scope:** `apps/dispatch-control` (32 `page.tsx` routes, both route groups) · **Baseline:** after quick 261021-7aw (`7fa74808..9971274e`): agents self-fix findings, sign-offs optional, Publish gated only by Editor-in-chief role + hold, must-fix / Accept-rewrite / revise UX removed from the editor path (`/`, `/s/[section]`).
**Mode:** read-only static trace; nothing was run in a browser. Line numbers are as of `1753e09c`.

**Bottom line:** the new front door (`/` → `/s/[section]` → Publish) is the simplest it has ever been: **2 clicks to publish**. But every surface around it still runs on the pre-7aw model. Three things contradict the front door's "Ready to publish":
- the shared derivations `deriveIssueStatus` / `deriveTasks` / `deriveStageStates`
- the old console (The Run's GatesPanel, DecisionRail, AwaitingYouInbox, help/tour copy)
- the server, which does not enforce hold

The front door also has no route back from the console. A non-technical user who clicks "Admin" or "Past issues" lands in a 5-tab console that tells them the issue "Needs review" and that they have 2 must-fix tasks, forever.

---

## 1. State map (Step 1 of the method)

There is no Zustand/Redux. The "stores" are Convex subscriptions, plus pure derivations shared by many surfaces. Those derivations are where most contradictions live.

| Derivation / store | Reads | Still encodes the removed gate? | Consumers |
|---|---|---|---|
| `deriveIssueStatus` `lib/derivedState.ts:147-164` | issue.held/published, runStatus, signOffs | **YES.** `ready` only if `facts-cleared` AND `sounds-human` are signed (`:159-161`). Otherwise `needs-review` forever. `published` only if `issue.published`, which the pipeline never sets (`lib/homeSections.ts:135`). | Masthead chip `components/Masthead.tsx:308`, workspace StatusReadout `issues/[issueNumber]/layout.tsx:147-183`, `/run` chip `run/_components/RunScreen.tsx:572-580` |
| `deriveTasks` `lib/derivedState.ts:498-628` | qaFindings, claimRows, signOffs | **YES.** It always pushes two `must-fix` tasks, "Clear the facts" / "Approve the voice" ("…sign-off is required before publish"), once the run is not running (`:582-610`). No `published` guard. | Masthead "My Tasks · N" `Masthead.tsx:247,370`, `/my-tasks`, workspace "N open · ~N min" |
| `deriveStageStates` `lib/derivedState.ts:226-251` | signOffs, qaFindings, claimRows | **YES.** Voice is `needs-you` until Sounds-human is signed. Approval is `in-progress` until both sign-offs exist, so it is never "needs you" for a publishable issue. | Issue Workspace stage tabs `issues/[issueNumber]/layout.tsx:96-102` |
| `deriveSectionStates` `lib/derivedState.ts:298-322` | open qaFindings | Partly. It counts open findings; new runs have none, legacy runs do. | `SectionEndNav` "N of 9 sections still need you." |
| `deriveHomeFooter` / `derivePublishGate` `lib/homeSections.ts:122-149`, `lib/publishChain.ts:46-60` | runStatus, held, role | **No. Correct post-7aw model.** | Front door only |
| `AwaitingYouInbox` local logic `components/AwaitingYouInbox.tsx:42-120` | qaCorrections, claimChecks.allSignedOff, runs | **YES, and it diverges from `deriveTasks`.** It filters with `severity==='error' && !f.accepted` (`:59`) instead of `isOpenFinding`, so the agents' `agent-skipped` rows (written `accepted:false`, `packages/pipeline/.../qa/__init__.py:221,310`) and dismissed rows show as "QA blocker". | Masthead dropdown |
| Convex `issues.held` (`convex/issues.ts:101` hold / `:156` reopen) | — | Hold is **client-only**. `POST /issues/{run}/publish` (`api/review.py:69-158`), `/schedule` (`:159+`), the tick sweep (`api/control.py:464-486`) and `/publish-manual` (`:825+`) never read `held`. | Front door gate, DecisionRail, GatesPanel |

**Dangerous cross-surface conflict:** the front door's derivation (`deriveHomeFooter`) and every other surface's derivation (`deriveIssueStatus` / `deriveTasks` / `deriveStageStates`) answer "can this ship?" with opposite results, for the same run, at the same time.

---

## 2. Core weekly journeys (traced through code)

### J1. Start a run: 3 to 4 clicks, with no Start control on `/` or on `/run` once any run exists

| Path | Clicks / hops | State change |
|---|---|---|
| A. `/` → "Admin" (`IssueHomeView.tsx:70`) → `/run` (old run, "Before it can publish / Locked") → sidebar "Archive" → **"Find a story with agents"** (`issues/_components/CreatePanel.tsx:120-127`) **or "Start #N early"** (`ScheduledSlotCard.tsx:75-82`) | 3 clicks, 3 hops, then a server redirect `/issues/N` → by `lastVisitedStage` (`issues/[issueNumber]/page.tsx:51-62,83-84`) | Convex `issues.ensureByNumber` (CreatePanel only), then `POST /pipeline/run` |
| B. Sidebar "Run Details" → `/run-monitor` → redirect `/run-monitor/runs` → **"Trigger Run"** (`RunControlBar.tsx:156`) → **"Confirm Run?"** (`:118-131`) → "Open Issue N →" | 4 clicks | `triggerRun({})`, with no issueNumber and no `ensureByNumber` |
| C. `/issues/n/story` "Restart discovery" (`StoryBriefScreen.tsx:180-184`), plus an embedded CreatePanel when there is no run (`:150-163`) | — | `POST /pipeline/run` |
| `/run` empty state: "Start a run →" (`RunScreen.tsx:406-411`) | +1 hop | It only links to `/issues`. It is not a start action. |

There are four start buttons with three different labels. Only CreatePanel reserves the issue row, and only RunControlBar disables itself while a run is in flight (`RunControlBar.tsx:149`).

### J2. Monitor a run: 2 clicks

`/` shows "Still writing — Publish turns on when the agents finish." (`homeSections.ts:52`). It has no progress link, only "Admin" → `/run` ("N of 9 written", `RunScreen.tsx:459-460`) → "Run details →" → `/issues/n/runs/[runId]`.
- The same RunDetail screen also lives at `/run-monitor/runs/[runId]`, with different chrome.
- The masthead "Running" readout is plain text (`Masthead.tsx:201-207`).

### J3. Choose the charity at Gate 1: 4 actions from `/`, and no way back to `/`

`/` footer "The agents are waiting for you to choose the charity." → **"Choose the charity →"** (`PublishFooter.tsx:81-89`) → `/issues/n/story`. Scroll past Leads ("Require this lead" / "Remove") and OrgOptionSlate to `NeedsYourDecisionCard` (`StoryBriefScreen.tsx:283-290`). Pick a radio → type "Why this pick? (required)" → **"Choose this story"**. This calls `POST /issues/{run}/adjudicate` (`NeedsYourDecisionCard.tsx:111-125,247-251`).
- Result: an in-place message "Got it — the run is continuing with X." No navigation follows, and the console has no link to `/`.
- A second adjudication screen exists at `/signal-desk` ("Resume run", `AdjudicationPanel.tsx:117-121`). It shows *all* candidates, while the Story page shows the top two (`NeedsYourDecisionCard.tsx:104-107`). Entry links split between the two:
  - RecoveryRail → Signal Desk (`RecoveryRail.tsx:149-157`)
  - The Approval page shows both (`approval/page.tsx:113-124`)

### J4. Read and edit a section

| Path | Clicks | Notes |
|---|---|---|
| **Editorial** `/` → StoryRow → `/s/[id]` → select text → toolbar "Edit text" → "Save edit" | 4 | The editor always opens **block 0**: `openInPlaceEditor` hard-codes `blockIndex: 0, isFallback: true` (`app/(editorial)/s/[section]/page.tsx:337-338`), even though the toolbar knows the selected block (`components/galley/Galley.tsx:436`). |
| **Console** Archive → row → `/issues/n` (redirect by `lastVisitedStage`) → Draft tab → card "Open …" (`StoryDeskGrid.tsx:194`) → "Edit story" (`StoryFocusView.tsx:310`) → "Done editing" | 6 + redirect | Full findings rail, "Apply fix" / "Dismiss", and "Next that needs you" are still live. |
| `/run` section rows → `/issues/n/draft?story=…&tab=draft` (`RunScreen.tsx:157-158`) | — | Sends the user to the *old* desk, not to `/s/[id]`. |

### J5. Publish / schedule / hold: four Publish paths, two Hold buttons

| Path | Clicks | Gate (client) | Gate (server) |
|---|---|---|---|
| (a) **Front door** `/` "Publish" → "Publish Issue N now?" → "Publish" (`PublishFooter.tsx:156-185`) | 2 | footer ready + held + role (`publishChain.ts:46-60`); publishing latch until the run reads published (`IssueHome.tsx:130-161`) | role, awaiting-review, sanityIssueId. **No hold check.** |
| (b) **DecisionRail** Archive → issue → Approval tab → "Publish" → PublishPreviewDialog "Publish now" (`review-desk/[runId]/_components/DecisionRail.tsx:546-583`) | 5 | `!!held \|\| busy` only (`:551`); **no latch** | same |
| (b') `/run` GatesPanel **"Approve & publish →"** (`RunScreen.tsx:344-350`) → path (b) | +1 | still requires both sign-offs + 0 must-fix (`:259`) | — |
| (c) **Schedule**: DecisionRail "Schedule for later" (`DecisionRail.tsx:597-614`). This is the only Schedule control in the app. | 5+ | — | **No hold check**, at schedule time or at tick time |
| (d) **publish-manual**: RecoveryRail (`RecoveryRail.tsx:165-181`) and Inspector footer **"Restart Prepare publication?" → "Restart"** (`components/inspector/InspectorFooter.tsx:190-237`) | 2 | none | **No status check and no hold check** (`api/control.py:825+`). It runs `_run_publisher` directly. |
| **Hold (real)**: Issue Workspace "Hold issue" → HoldDialog → confirm (`issues/_components/WorkspaceControls.tsx:62-86`) | 3 after reaching the issue | sets Convex `issues.held` | not enforced |
| **"Hold" (fake)**: DecisionRail "Hold" (`DecisionRail.tsx:619-625`) → `rejectIssue` → `POST /reject` | 1 | **Never sets `held`** | records a `rejected` review action only |
| **Release** is labelled "Reopen" (`WorkspaceControls.tsx:72-75`, `HeldIssueRow.tsx:63-69`) | — | Front door copy says "release the hold to publish" (`publishChain.ts:19`) but offers no control or link. | — |

### J6. View the archive: 2 clicks, 2 hops, and it lands on the wrong surface

`/` "Past issues" (`IssueHomeView.tsx:67`): the whole chrome switches to the console. Clicking a row goes to `issueDraftHref` → `/issues/n/draft` (`issues/page.tsx:168-172`). That is the old findings console, even for Published issues.
- There is no editorial read of a past issue (`/s/[section]` only ever shows `useCurrentRun()`).
- There is no per-row "read live issue" link.
- The browser Back button is the only way home.

---

## 3. Findings ranked by how much they confuse a non-technical user

Rank 5 = actively tells the user something false or blocks them. Rank 1 = cosmetic. Click-path pattern names follow the skill.

### Rank 5

**CP-01 — "Needs review" forever, never "Ready to publish" or "Published"** (Pattern: Conditional Dead Path)
- `deriveIssueStatus` returns `ready` only when both optional sign-offs exist, and `published` only when `issue.published` is set, which nothing at runtime sets (`lib/derivedState.ts:159-163`; `homeSections.ts:135`; `issues:markPublished` has no runtime caller).
- Shown as amber "NEEDS REVIEW" in the masthead on every console page (`Masthead.tsx:105-108,308`), in the workspace header (`issues/[issueNumber]/layout.tsx:147-183`), on `/run` (`RunScreen.tsx:572-580`), and in the Archive "In progress" chip (`issues/page.tsx:88`).
- **Expected:** "Ready to publish", then "Published". **Actual:** "Needs review" before and after publishing.

**CP-02 — Phantom must-fix tasks: red "My Tasks · 2"** (Missing Transition)
- `deriveTasks` emits "Clear the facts" / "Approve the voice", severity must-fix, why "…sign-off is required before publish" (`lib/derivedState.ts:582-610`).
- Feeds the masthead `MyTasksTrigger` (`Masthead.tsx:215-234,247`), `/my-tasks` (`MyTasksScreen.tsx:321`), and the workspace open-count.
- Never cleared by publishing.

**CP-03 — The Run (`/run`) GatesPanel is entirely pre-7aw** (Conditional Dead Path)
- "Before it can publish" (`RunScreen.tsx:265`); `canPublish = factsSigned && voiceSigned && mustFixTotal===0 && !held` (`:259`).
- Shows a **"Locked"** chip (`:351-354`) with reasons "Both sign-offs are still outstanding." / "…must-fix finding(s) remain(s)." (`:248-254`).
- Shows "Fix or dismiss them before clearing the facts." with "Review contradicted claims →" (`:282-294`), and "Voice sign-off outstanding." with "Voice pass →" (`:313-323`).
- When it does unlock, the copy reads "Opens when both gates above are signed and no must-fix findings remain." (`:340`).
- The only guard is not-running/not-failed (`:535`), so it also renders at Gate 1 and on published issues.
- `/run` is "The Run", the **first nav item** (`lib/nav.ts:63`), and the front door's "Admin" link. So the second screen most users see tells them the issue is locked while `/` says it is ready.

**CP-04 — Two buttons labelled "Hold" do different things** (Missing Transition)
- DecisionRail "Hold" → `rejectIssue` (`DecisionRail.tsx:291-300,619-625`) records a rejection and shows "Run held — it stays awaiting review." But `issues.held` is never set: Publish directly above stays enabled, and no surface shows "Held".
- Only WorkspaceControls "Hold issue" actually holds.

**CP-05 — Hold is not enforced on the server; scheduled publishes ignore it; publish-manual bypasses everything** (safety)
- Publish (`api/review.py:69-158`, whose docstring at `:20` says "plus hold where enforced"), schedule (`:159+`), the tick sweep (`api/control.py:464-486`) and publish-manual (`:825+`) never read `held`.
- No unschedule or cancel-schedule UI exists.
- After 7aw, hold is the *only* content gate left, and it is client-side only.

**CP-06 — The console has no way back to the front door**
- The only `href="/"` is `SectionHeader.tsx:39`.
- The wordmark is a `<span>` (`Masthead.tsx:260-262`).
- `lib/nav.ts:57-87` and the CommandPalette (`CommandPalette.tsx:109-112`) have no front-door entry.
- After "Admin", "Past issues", or "Choose the charity →", only browser Back returns.
- The comment at `SectionHeader.tsx:9-13` (saying `/` redirects into the console) is stale.

**CP-07 — Help, tour and How-to-use teach the removed gates**
- `components/onboarding/onboardingCopy.ts`:
  - `:39` "Story → Draft → Fact Check → Voice → Approval → Publish … Start on Issues"
  - `:65` "Publishing is blocked until errors are cleared."
  - `:69` "…then mark it Sounds human."
  - `:73` "Both Facts cleared and Sounds human are required."
  - `:88` "Verify or dismiss every claim."
  - `:90` "Both greens required, then publish."
- `components/help/helpCopy.ts`:
  - `:21` "'Ready to publish' means both sign-offs are cleared."
  - `:23` "Publishing stays blocked until every claim is verified or dismissed."
  - `:47` "Anything left as an error blocks publishing."
  - `:53` "one of the two sign-offs Approval requires"
  - `:57` "Publishing needs both greens…"
  - These render as HelpTips on DecisionRail "Explain publish readiness" (`DecisionRail.tsx:395`), VoicePassRail, and FactCheckScreen.
- `app/(dashboard)/how-to-use/page.tsx`:
  - Step 3 (`:62-75`): "**Accept fix**, edit inline, or dismiss … Publish stays locked until the Must fix list is empty."
  - Step 4 (`:77-88`): "hit **Sounds human** … Publish needs both greens."
  - Never mentions `/`.
- StageHintStrip shows these on every stage. StartHereCard (`issues/_components/StartHereCard.tsx:64-100`) links each stage into the old console.

### Rank 4

**CP-08 — `SectionEndNav` still counts "sections still need you"**
- Shows "N of 9 sections still need you." / "All 9 sections are clean — nothing needs you." (`app/(editorial)/s/[section]/_components/SectionEndNav.tsx:33-41`) via `deriveSectionStates`. On legacy runs, or any open row, it tells the editor to act, but the page now has no controls to act with (findings hidden by `Galley hideFindings`, `s/[section]/page.tsx:354`).
- Sibling stale copy: `ExemptSectionNote.tsx:16-25` says "…it carries no inline findings to review here." for six sections. That talks about reviewing findings that are no longer reviewable anywhere on this page.

**CP-09 — The in-place editor points at a removed control** (Dead Path)
- `InPlaceBlockEditor.tsx:132-140`: "Opened the first paragraph of this section — use "Edit myself" on a specific finding for a precise target."
- "Edit myself" was removed in `9971274e`.
- Combined with the block-0 hard-code (`s/[section]/page.tsx:337-338`), selecting paragraph 5 and clicking "Edit text" opens paragraph 1.

**CP-10 — "Ask agent to revise" in the Inspector is a no-op on `/s/[section]`** (Missing Transition)
- InspectorPanel/InspectorFooter enable it whenever there is prose (`components/inspector/InspectorPanel.tsx:514-516`, `InspectorFooter.tsx:294-298`).
- It calls `requestRevision`, which sets `revisePassage` in the editorial InspectorProvider.
- The section page no longer mounts `RevisionFlow`, so nothing happens.
- RevisionFlow is still mounted in ReviewDeskRunView (`:553-574`), VoicePassRunView (`:346`) and BriefFieldStrengthen.

**CP-11 — Inspector "Restart" on the editor path can discard hand edits, and its publisher variant is a hidden Publish**
- `InspectorFooter.tsx:172-237`: "Restart this step?" re-runs a writer and overwrites saved edits.
- "Restart Prepare publication?" calls publish-manual (CP-05) with no status or hold check.
- A "Restart" label on a publish action is the opposite of what the button does.

**CP-12 — "Paused for you" and DraftReadyBanner fire at Gate 1 and point to an empty draft** (Conditional Dead Path)
- `Masthead.tsx:168-174,251-254`: any `awaiting-review` run becomes a link with aria-label "The draft is ready — go to the Draft desk" → `/issues/n/draft`, including runs paused at Gate 1 with no draft.
- Same bug in:
  - `DraftReadyBanner.tsx:19`: "The draft is ready — nine stories are waiting."
  - ReviewQueue "Review →" (`ReviewQueue.tsx:56-58,81-86`)
  - RunDetail "Open issue →" (`RunDetail.tsx:296-299`)
- `/run` at Gate 1 shows GatesPanel and Pending rows, and never mentions the charity decision.

**CP-13 — AwaitingYouInbox lists agent-closed rows as blockers and disagrees with the count that opens it**
- `components/AwaitingYouInbox.tsx:56-59` (`!f.accepted` instead of `isOpenFinding`). Dismissed and `agent-skipped` rows show as "QA blocker — {section}".
- "Awaiting review — Run {raw runId}" (`:106`) shows a raw ID.
- Links take 2–3 redirect hops: `/run-monitor/runs/{id}/review` → `/issues/n/approval` (`:70`); `/review-desk/{runId}` → `/issues/n/review` → `/issues/n/draft` (`:77`).
- "See all →" (`:167-172`) goes to `/my-tasks`, which re-derives with `deriveTasks`, a different projection from the dropdown.

**CP-14 — Stage tabs contradict Publish**
- Voice is "Needs you" until signed (`derivedState.ts:226-238`).
- Approval, where Publish lives, reads "In progress" until both sign-offs exist (`:240-251`).
- Fact Check is "Needs you · N" for editor-flagged claims (`:221`).

**CP-15 — DecisionRail is still a blocker board**
- "N blockers to clear · M warnings" (`DecisionRail.tsx:342,351`), a "Must fix items" checklist (`:357-385`), and Readiness board "Voice: Not signed yet" / "Open decisions: N blockers" (`:408-425`), all above an enabled Publish.
- "Sign-offs (optional)" (`:512`) has two buttons that gate nothing.
- The same "Sign: Sounds human" exists in VoicePassRail, where it is **disabled** with "N voice tells to clear" and role-locked (`VoicePassRail.tsx:130-133,203-207`). In DecisionRail it is enabled and not role-locked (`DecisionRail.tsx:533-537`). Same action, opposite gating.

**CP-16 — Four Publish paths with different guards**
- See J5. The front door is the only one with a double-click latch.
- **DecisionRail can double-publish** (Async Race): after success it resets `busy=false` and shows "Published." while the run is still `awaiting-review` (`DecisionRail.tsx:250-266`). A second click calls the non-idempotent publish again (`publishChain.ts:9`).
- The `/approval` page still mounts DecisionRail for *published* runs (`approval/page.tsx:146-153`). Clicking gives a 409: "This run cannot be published in its current state."
- `publishChain.ts:10` says schedule lives only on DecisionRail, but `RunScreen.tsx:532-534` says "Publish stays exclusively behind DecisionRail". The two code comments contradict each other.

**CP-17 — Archive opens every issue in the old console**
- `issues/page.tsx:168-172` → `/issues/n/draft`, even for Published issues.
- Filter chips "All / Published / Held / Has drafts" (`:96-101`) overlap the group headings "In progress / Published / Held / Scheduled" (`:80-85`).

**CP-18 — Four start buttons, two charity-choice screens** (J1, J3)
- Start buttons:
  - CreatePanel "Find a story with agents" / "Start from my brief"
  - ScheduledSlotCard "Start #N early" (same `triggerRun` as "Find a story", on the same page, `issues/page.tsx:430,459`)
  - RunControlBar "Trigger Run" / "Confirm Run?"
  - StoryBriefScreen "Restart discovery"
- Charity choice: Story vs Signal Desk.
- RecoveryRail's "Restart from this step" (`RecoveryRail.tsx:151-153`) is only a link to Signal Desk; nothing restarts.

**CP-19 — The Auto-publish toggle does nothing, but drives a red banner and the masthead chip**
- `config/_components/AutoPublishToggle.tsx:98-100,170-180`: "finished runs publish automatically without review" / "bypasses the review gate".
- The pipeline loads `auto_publish` (`config_loader.py:68,404`) but never reads the attribute (grep `\.auto_publish` finds nothing).
- Turning it on shows "Publishing is automatic…" on every page (`(dashboard)/_components/AutoPublishBanner.tsx`) and "Publishing automatically — managed in Administration" (`Masthead.tsx:340-349`), and nothing auto-publishes.
- Also, "the review gate" no longer exists.
- The page is called three different names: "Administration" (banner), "Config" (nav `lib/nav.ts:80`, H1 `config/page.tsx:29`), "Configuration" (tab title, `:22`).

### Rank 3

**CP-20 — Accept/Dismiss/rewrite controls are still live in the console**
- These are dead for new runs (all rows agent-resolved) and live for legacy runs:
  - StoryFindingsRail "Apply fix" / "Dismiss" (`StoryFindingsRail.tsx:170-215`)
  - StoryFocusView "Next that needs you: …" (`:457-458`)
  - StoryDeskGrid "clean · N must fix · N in review" (`:158`)
  - Voice galley "Accept rewrite" / "Write my own" / "Keep (not a tell)" (`VoicePassRunView.tsx:91-95`) and "Run deep check" (`:282`)
  - Fact Check Keep/Remove and "Ask agent for better evidence" (`FactCheckScreen.tsx:226-253,328-431`), plus "Show only claims that need you" (`:555`)
- Still wired through `lib/findingsClient.ts` (via `storyFindingActions.ts:9,175,202,224`) and `lib/signOffClient.ts`.

**CP-21 — "Write my own" in Voice Pass loses its target**
- `VoicePassRunView.tsx:253-257` pushes `/review-desk/{runId}?edit=…&finding=…`.
- The two redirect stubs (`review-desk/[runId]/page.tsx:18`, `issues/[issueNumber]/review/page.tsx:13`) drop the query string, so the editor never opens.

**CP-22 — Re-roll skips the agent self-fix**
- RunDetail "Re-roll" (`RerollButton.tsx:67-69`) rewrites a section without re-running QA (control.py rerun docstring).
- The front door still says "The agents reviewed every section and fixed what they found." (`homeSections.ts:53`), and "agents made N changes" describes the old text.

**CP-23 — Adjudication buttons re-enable after success** (Async Race)
- `NeedsYourDecisionCard.tsx:118-124`, `AdjudicationPanel.tsx:46-56`: `finally setBusy(false)` runs before Convex flips the status.
- A second click returns 409 "adjudicate-gate1 failed (409): …is not paused…", which overwrites the success line.

**CP-24 — `/issues/[n]` lands on a different tab every time**
- It redirects by `lastVisitedStage` (`issues/[issueNumber]/page.tsx:51-62`).
- The same "Issue N" link (Archive, CommandPalette `:127`, start buttons) has no stable destination.

**CP-25 — CommandPalette advertises removed stages**
- "Issue N · Story/Draft/Fact Check/Voice/Approval" (`CommandPalette.tsx:62-67,133-139`) and "Run {id8} · {status}" (`:147-153`).
- No entries for `/` or the nine `/s/[section]` pages.
- The palette is also mounted in the editorial layout (`app/(editorial)/layout.tsx:32`), where it would offer only console routes. Whether ⌘K actually fires there is unverified.

### Rank 2

**CP-26 — Orphan routes and redirect-only stubs (extra hops)**
- Stubs: `/review-desk` → `/issues`; `/voice-pass` → `/issues`; `/run-monitor` → `/runs`; `/review-desk/[runId]` → `/issues/n/review` → draft; `/voice-pass/[runId]` → `/issues/n/voice`; `/run-monitor/runs/[runId]/review` → `/issues/n/approval`; `/issues/[n]/review` → draft.
- Pages with no nav entry: `/signal-desk`, `/my-tasks`, `/run-monitor/graph`.
- `story-brief/` has no `page.tsx`; its components are used by `/issues/n/story`.

**CP-27 — Console friction for non-technical users**
- Bare digit keys 1-5 switch stage tabs (`issues/[issueNumber]/layout.tsx` keydown, ~`:225-242`).
- The issue workspace has five tabs, a context panel, an outline, a decision log and run history on one screen.
- The first-run tour is mounted only in the console (`(dashboard)/layout.tsx:91`), never on `/`, and it tours the contradictory masthead inbox and My Tasks.

**CP-28 — Same RunDetail screen at two URLs**
- `/issues/n/runs/[id]` (issue tabs) and `/run-monitor/runs/[id]` (Workbench tabs).

**CP-29 — Unused front-door props**
- `links.factCheck` / `links.approval` are still built in `IssueHome.tsx:169-170` and passed down, but `PublishFooter` no longer renders them.
- They are a residue of the removed fix sentences; harmless, but they invite re-wiring.

### Rank 1

**CP-30 — The sign-off endpoint is still live**
- `api/signoffs.py:60` accepts attestations that now feed only the stale derivations in CP-01, CP-02 and CP-14.

---

## 4. Nav inventory

| Surface (file:line) | Label (verbatim) | Goes to |
|---|---|---|
| `lib/nav.ts:63` (sidebar `SidebarNav.tsx:87-110`, mobile drawer, palette) | The Run | `/run` (stale GatesPanel, CP-03) |
| `lib/nav.ts:65` | Archive | `/issues` |
| `lib/nav.ts:71` | Run Details | `/run-monitor` → `/run-monitor/runs` |
| `lib/nav.ts:72` | Agent Instructions | `/prompt-lab` |
| `lib/nav.ts:73` | Quality Tests | `/eval-center` |
| `lib/nav.ts:74` | Editorial Memory | `/registry` |
| `lib/nav.ts:80-82` | Config · Finance · Settings | `/config` · `/finance` · `/settings` |
| `lib/nav.ts:87` (pinned) | How to use | `/how-to-use` (stale steps, CP-07; "Replay tour") |
| `SidebarNav.tsx:77` | Signed in as {role} | text |
| `Masthead.tsx:260` | DISPATCH/CONTROL | **not a link** |
| `Masthead.tsx:278-304` | Issue N · {title} | text |
| `Masthead.tsx:119-131` | State unknown — refresh | reloads the page |
| `Masthead.tsx:308` | Draft / Needs review / Ready to publish / Published / Held / Run failed | text (CP-01) |
| `Masthead.tsx:189-198` | Paused for you | `/issues/n/draft` (CP-12) |
| `Masthead.tsx:316-332` | $mtd / $cap | text |
| `Masthead.tsx:340-349` | Human approval required / Publishing automatically — managed in Administration | text (CP-19) |
| `Masthead.tsx:356-362` | ⌘K | CommandPalette |
| `Masthead.tsx:370-379` | My Tasks · N | AwaitingYouInbox dropdown → items (CP-13), "See all →" `/my-tasks` |
| `Masthead.tsx:383` | Clerk UserButton | account |
| `AutoPublishBanner` | Open Administration | `/config` |
| `run-monitor/layout.tsx:33-34` | Runs · Graph | `/run-monitor/runs` · `/run-monitor/graph` |
| `issues/[issueNumber]/layout.tsx:96-102` | Story · Draft · Fact Check · Voice · Approval (keys 1-5) | `/issues/n/{story,draft,fact-check,voice,approval}` |
| `issues/[issueNumber]/layout.tsx:84` | WorkspaceControls: Hold issue / Reopen | Convex `issues.hold` / `issues.reopen` |
| `CommandPalette.tsx:109-153` | nav routes; Issue N; Issue N · {stage}; Run {id8} · {status} | as listed (CP-25) |
| `IssueHomeView.tsx:67` / `:70` | Past issues / Admin | `/issues` / `/run` |
| `PublishFooter.tsx:65` | Open Admin → | `/run` |
| `PublishFooter.tsx:75` | Admin → Run Details | `/issues/n/runs/{runId}`, falling back to `/run` |
| `PublishFooter.tsx:85` | Choose the charity → | `/issues/n/story` |
| `PublishFooter.tsx:98` | Read the live issue → | `{NEXT_PUBLIC_WEB_PREVIEW_BASE}/issue/issue-n` |
| `PublishFooter.tsx:145-151` | Preview the issue | Sanity preview URL (new tab) |
| `PublishFooter.tsx:156-185` | Publish → Publish Issue N now? → Publish / Cancel | `publishChain` → `POST /issues/{run}/publish` |
| `StoryRow.tsx:15` | each of the nine stories | `/s/{id}` |
| `SectionHeader.tsx:39` | {issue title} | `/` (**the only link to `/` in the app**) |
| `SectionEndNav.tsx:44-53` | ← prev / next → | `/s/{prev}` · `/s/{next}` |
| `StartHereCard.tsx:64-100` | Story…Approval, Take the 1-min tour, Dismiss | `/issues/n/{stage}` |
| `issues/page.tsx:168-172` | archive row | `/issues/n/draft` (always) |
| CreatePanel / ScheduledSlotCard | Find a story with agents · Start from my brief · Start #N early | `POST /pipeline/run` → `/issues/n` |
| `RunScreen.tsx:157-158,317-323,344-350,406-411,513-518` | section rows · Voice pass → · Approve & publish → · Start a run → · Re-run → | old draft desk · `/issues/n/voice` · `/issues/n/approval` · `/issues` · `/run-monitor/runs/{id}` |

---

## 5. Simplification implications (for the follow-up plan, not prescriptive)

1. **One "can it ship?" truth.** Retarget `deriveIssueStatus` / `deriveTasks` / `deriveStageStates` to the 7aw model: drop the sign-off-derived `ready`/`needs-review` and the two sign-off tasks, and derive `published` from `runStatus==='complete'` (as `deriveHomeFooter` already does). This clears CP-01, CP-02, CP-12 and CP-14 at the source.
2. **Server-enforce hold** in publish, schedule, the tick sweep and publish-manual. Give publish-manual a status guard and a non-"Restart" label, or remove it from the Inspector. Delete DecisionRail's fake "Hold", or wire it to `issues.hold`.
3. **Make `/` the home of the console.** Make the wordmark a link to `/`, add a nav item, and give the front door Hold/Release and Schedule so DecisionRail and GatesPanel can be retired or demoted to Workbench.
4. **Retire the gate vocabulary everywhere it is still shown:** GatesPanel, DecisionRail blocker board, `SectionEndNav` "still need you", `ExemptSectionNote`, the `InPlaceBlockEditor` "Edit myself" line, AwaitingYouInbox, `helpCopy.ts`, `onboardingCopy.ts`, `how-to-use`, StartHereCard, and the CommandPalette stage entries.
5. **Collapse duplicates to one control each:** one Start (front door), one charity chooser (Story *or* Signal Desk), one Publish (front door), and archive rows that open a read view rather than `/draft`.
6. **Fix the editor's block targeting:** pass `sel.blockIndex` through `onEditText`. Hide "Ask agent to revise" in the editorial Inspector, or re-mount RevisionFlow.
7. **Remove or wire `auto_publish`** (CP-19).
