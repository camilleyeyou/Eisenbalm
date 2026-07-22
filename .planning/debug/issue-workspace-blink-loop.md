---
status: resolved
trigger: "Investigate issue: issue-workspace-blink-loop -- Issue Workspace frame (/issues/[n]) flickers continuously, Convex-backed readouts flip between loading and loaded states in an apparent infinite loop."
created: 2026-07-22T00:00:00Z
updated: 2026-07-22T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED and FIXED — infinite SERVER-SIDE redirect loop between the bare `/issues/[n]` index and the four run-dependent stage wrappers. Fix applied, self-verified (RED->GREEN regression test, full suite, strict build). Awaiting human confirmation that the live symptom (blinking on /issues/999660) is gone.
test: N/A — mechanism confirmed by direct code trace + live data; fix applied and self-verified.
expecting: N/A
next_action: Awaiting human verification per checkpoint below.

## Symptoms

expected: The workspace frame renders once and settles — status readout, cost readout, stage tabs, outline, and comments load and stay stable.
actual: Everything blinks continuously: the 5 stage tabs' "Not generated" labels, the Draft status readout, "cost unknown — refresh", the outline legend + "Loading outline…", and the Comments section "Loading..." all flicker between loading and loaded states, indefinitely. User describes it as "the highlights keep blinking" / "an infinite loop somewhere". Observed on the DEPLOYED Vercel dashboard.
errors: None reported in UI; no console output captured yet (user screenshot only).
reproduction: Open /issues/999660 in dispatch-control — a FRESH issue: run history says "No runs yet", 0 open tasks, no draft. Locally: `pnpm --filter dispatch-control dev` then visit /issues/999660. The oscillation between loading and loaded states means Convex useQuery subscriptions are likely being torn down and re-created repeatedly (remount or resubscribe loop), not merely re-rendered.
started: Noticed today, immediately after deploying commits afc958e (label rename) and a22bebf/6ffd306/8a2593e (HelpTip tooltips). User warns similar minor bugs exist elsewhere -- do not assume tooltip commits are the cause without evidence.

## Eliminated

- hypothesis: An unmemoized/unstable identity in `WorkspaceStateProvider` (beyond what quick-260721-pmn already fixed) feeds a `setPanelContent`-style effect loop, causing repeated Convex subscription teardown/recreate.
  evidence: Read `WorkspaceStateProvider.tsx`, `FrameChrome`/`layout.tsx`, `WorkspaceOutline.tsx`, `WorkspaceControls.tsx`, `IssueComments.tsx`, `StageHintStrip.tsx`, `HelpTip.tsx`, `ContextPanel.tsx`, `CreatePanel.tsx`, `OnboardingProvider.tsx`, `OnboardingTour.tsx`, `AppSidebar.tsx`, `Masthead.tsx`, `lib/derivedState.ts` (pure, no wall-clock/non-determinism) in full — no unstable identity feeding an effect dependency remains after the pmn/ohu fixes.
  timestamp: mid-investigation

- hypothesis: The exact reported repro (fresh issue, no run, mounted on the Story stage) self-sustains a React render loop.
  evidence: Built a bounded-settle integration test mounting the REAL `IssueWorkspaceLayout` -> `WorkspaceStateProvider` -> `FrameChrome` -> real `StoryBriefScreen` (Empty/CreatePanel state) -> real `IssueComments`/`WorkspaceOutline`/`WorkspaceControls`, plus the REAL `OnboardingProvider`/`OnboardingTour` (not mocked, unlike every existing sibling test), first with a synchronous convex mock (probeRenders=1) and then with a staggered-async convex mock modeling real Convex's referential-stability-once-resolved + out-of-order query arrival (probeRenders settled at 3 and never grew across a 1s window). No loop reproducible at the React level for the Story stage.
  timestamp: mid-investigation

- hypothesis: Convex functions referenced by the workspace frame (comments, userOnboarding, etc.) are committed but not deployed to the dev Convex instance, causing query errors that manifest as a loop (per the known "Convex sync" project pitfall).
  evidence: Ran `npx convex function-spec` against the live dev deployment (modest-magpie-797) from `convex/` — confirmed `comments.js:add`, `comments.js:listByIssueNumber`, `userOnboarding.js:*`, `issues.js:*`, `pipelineRuns.js:*`, `pipelineConfig.js:getAll`, and every other function the workspace frame calls are present and live.
  timestamp: mid-investigation

- hypothesis: The raw Convex data for issue 999660 is itself flapping/non-deterministic server-side (e.g. a buggy query), causing repeated resolve->undefined transitions.
  evidence: Ran a standalone Node script using `convex/browser`'s `ConvexClient` to subscribe directly to `issues:byIssueNumber`, `pipelineRuns:byIssueNumber`, `pipelineRuns:listByIssueNumber`, and `pipelineConfig:getAll` for issue 999660 against the live dev deployment. Each query delivered exactly ONE update over a 20-second window and never changed again — ruled out server-side data flapping. This same run surfaced the actual root cause: `issues:byIssueNumber` returned `lastVisitedStage: "draft"` while `pipelineRuns:byIssueNumber` returned `null` (no run) — the combination that triggers the redirect loop below.
  timestamp: mid-investigation

- hypothesis: Next.js 15 App Router / React 19 known ecosystem bug (dynamic-segment layout remount, force-dynamic Suspense hang) causes the observed blinking.
  evidence: Researched (web search) — real GitHub issues exist for adjacent symptoms, but none match this app's structure (no Suspense boundary/loading.tsx in this route tree; `reactStrictMode`'s double-invoke is dev-only and this bug is reported on the production Vercel deployment). Not pursued further once the actual redirect-loop mechanism was found via live data.
  timestamp: mid-investigation

## Evidence

- timestamp: mid-investigation
  checked: `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx` (bare index redirect) and `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx` (+ fact-check/voice/approval siblings) side by side
  found: The bare index page (D-03) redirects to `stageHrefFor(n, issue.lastVisitedStage)` whenever `lastVisitedStage` is one of the 5 known segments — WITHOUT checking whether a run currently exists. The draft/fact-check/voice/approval wrappers each resolve `run = await client.query(pipelineRuns.byIssueNumber, {issueNumber: n})` and, if `!run`, `redirect(issueHref(n))` — back to the bare index. Only `story/page.tsx` is exempt (by design comment: "does NOT redirect away when no run exists yet").
  implication: Any issue whose `lastVisitedStage` is `'draft'|'fact-check'|'voice'|'approval'` while it currently has ZERO pipeline runs produces an infinite two-hop server redirect loop between `/issues/{n}` and `/issues/{n}/{stage}`. This is fully deterministic and requires no race condition, no client JS bug, and no Convex flakiness — a pure server-side logic bug reachable whenever a run's association with an issue is lost/never created after `lastVisitedStage` was already written (e.g. seed/test data, or a deleted/reset run).

- timestamp: mid-investigation
  checked: Live Convex data for issue 999660 via `ConvexClient` subscription (see Eliminated above)
  found: `issues:byIssueNumber` -> `{ ..., lastVisitedStage: "draft", ... }`; `pipelineRuns:byIssueNumber` -> `null`; `pipelineRuns:listByIssueNumber` -> `[]`.
  implication: Issue 999660 is in exactly the loop-triggering state described above. This is the root cause, confirmed against live data, not merely a theoretical bug.

## Resolution

root_cause: >
  Infinite server-side redirect loop between the bare `/issues/[n]` index page and any of the four run-dependent stage wrapper pages (`draft`, `fact-check`, `voice`, `approval`). The index page trusts `issue.lastVisitedStage` and redirects into that stage without checking whether a run currently exists; each of those four stage wrappers redirects straight back to the bare index (`issueHref(n)`) whenever no run exists for the issue. For any issue whose `lastVisitedStage` is set to one of those four stages while it currently has zero pipeline runs (e.g. issue 999660: `lastVisitedStage: "draft"`, 0 runs), visiting `/issues/[n]` (or any of its sub-routes) redirects back and forth between the two routes forever. Every hop is a genuine Next.js server redirect (full page reload), which is what a user perceives as "everything blinking indefinitely" — every Convex-backed readout in the frame repeatedly restarts its loading sequence and never settles.
fix: >
  Changed the no-run redirect target in `draft/page.tsx`, `fact-check/page.tsx`, `voice/page.tsx`, and `approval/page.tsx` from `issueHref(n)` (the bare index, which can bounce right back via `lastVisitedStage`) to `issueStoryHref(n)` — Story is the one stage wrapper already designed to handle the no-run case gracefully (renders `StoryBriefScreen`'s Empty/CreatePanel state) with no further redirect, breaking the cycle at its source with a minimal, semantically-correct change (mirrors the bare index's own D-04 fallback: "no run at all also lands on Story").
verification: >
  Self-verified: (1) wrote `__tests__/IssueStageWrapperNoRunRedirect.test.tsx` asserting each of
  the 4 wrappers redirects to Story (never the bare index) when `pipelineRuns.byIssueNumber`
  resolves to `null`; confirmed RED against the pre-fix code (git stash the 4 files, ran the test,
  all 4 failed with `REDIRECT:/issues/999660` instead of `.../story` — exactly the loop-triggering
  target), then GREEN after restoring the fix. (2) Full dispatch-control vitest suite: 136 files
  passed + 1 pre-existing skip (1085 tests passed, 2 todo), including the new regression test.
  (3) `pnpm build` (strict — includes typecheck + lint): compiled successfully, all routes built,
  zero errors. NOT YET verified in a live browser against the real /issues/999660 URL (no browser
  tool available in this environment) — see checkpoint below.
files_changed:
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/page.tsx
  - apps/dispatch-control/__tests__/IssueStageWrapperNoRunRedirect.test.tsx (new regression test)

## Notes (follow-up, out of scope for this fix)

- Consider a data-hygiene fix separate from this bug: `setLastVisitedStage` (FrameChrome's effect) writes whichever stage segment the operator is currently on regardless of run state; nothing currently clears/resets `lastVisitedStage` when a run is deleted or an issue is reset. Not fixed here — the routing fix above makes the stale-`lastVisitedStage` state harmless (Story always terminates the chain) rather than trying to prevent the state from occurring.
- User noted "similar minor bugs elsewhere" during symptom gathering — not investigated per debug session scope (this session covers only the workspace blink loop). Worth a follow-up sweep.

## Resolution

- Fix committed as 9dcd4a2 (redirect no-run stage visits to /issues/[n]/story).
- Automated verification stood in for the visual check: RED->GREEN regression test on all 4 wrappers, full suite (1085 tests) + strict build green.
- Deployed via push to master 2026-07-22; user to confirm visually on the live dashboard (any still-looping issue self-resolves on next visit — routing change only, no data migration).
