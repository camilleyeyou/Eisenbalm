---
phase: 41-issue-workspace-frame
verified: 2026-07-15T03:00:00Z
status: passed
score: 7/7 must-haves verified (0 code gaps; 1 human-UAT residual expected, not counted against score)
re_verification:
  previous_status: gaps_found
  previous_score: 6/7 must-haves verified (1 genuine code gap; 1 human-UAT residual expected, not counted against score)
  gaps_closed:
    - "WSP-03: collapsible context panel now renders stage-appropriate context on all 5 stages (Story lead/org detail, Draft open QA items, Fact Check claim detail, Voice tells, Approval readiness board), closing the previously-hollow ContextPanel wiring via Plans 41-11 (slot mechanism) and 41-12 (5 stage publishers)."
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Walk the live demo path per .planning/phases/41-issue-workspace-frame/41-UAT.md Section 2 (all 7 rows currently ⬜ PENDING): open an in-progress issue at /issues/[n] against dev Convex, confirm the single 'Issue Workspace' nav item, stage-tab live status marks updating without full reload, outline jump-to-section, Stage 2 claim marigold/rust rendering with hover+Tab-focus source reveal and unchecked-claim click-through to Fact Check, Stage 4→5 sign-off flow, Publish gate unlocking with the exact-preview dialog and one-click confirm, a 'not generated' section rendering as a first-class Editor's-note block, and now (post-gap-closure) each stage's ContextPanel showing real, stage-specific content that swaps cleanly on tab switch (never stale prior-stage content)."
    expected: "All 7 rows plus the live-reactivity check pass with no full-page reloads and no stale UI on Convex-driven changes; the ContextPanel shows real content per stage and clears/refills correctly across tab switches."
    why_human: "Requires a running console (pnpm --filter dispatch-control dev) against live dev Convex, walking multiple stage navigations while observing live reactivity (tab marks, header status, publish-lock, and now panel-content swap) — no jsdom-automatable equivalent, per the phase's own 41-10 plan text. This is the expected UAT residual already recorded pending in 41-UAT.md, not a new gap discovered by this or the prior verification."
---

# Phase 41: Issue Workspace Frame Verification Report

**Phase Goal:** The Review Desk, Signal Desk, and Voice Pass nav items collapse into one Issue Workspace with stage tabs 1-5 — with no loss of capability. Stages 2 (Draft), 4 (Voice Pass), and 5 (Approval) are recompositions of the galley, voice-pass, and decision-rail work already shipped in v3.0 — not new backend. Stage 1 provisionally mounts the existing Phase 37 Signal Desk as-is, carried over until Phase 47.

**Verified:** 2026-07-15
**Status:** passed
**Re-verification:** Yes — after gap closure (Plans 41-11, 41-12)

## Goal Achievement

### Observable Truths

| # | Truth (WSP ref) | Status | Evidence |
|---|---|---|---|
| 1 | Stage tabs 1-5 replace Review Desk/Signal Desk/Voice Pass nav items, each carrying a live status mark (WSP-01) | ✓ VERIFIED | Regression check (no change since prior pass): `lib/nav.ts` has one "Issue Workspace" item; no `NavItem` for the 3 old desks in `NAV_GROUPS` (only a code comment references them). `layout.tsx` `FrameChrome` renders 5 `<Link>` stage tabs with icon+label from `deriveStageStates`/`STAGE_STATE_LABELS`. Strict build re-run confirms all 5 stage routes + 2 redirects live. Diff-confirmed: none of the gap-closure commits touched `nav.ts` or the tab-rendering block of `layout.tsx`. |
| 2 | Persistent issue outline lists every section with 5-state (clean/review/must-fix/changed-since-review/not-generated) and jumps to it (WSP-02) | ✓ VERIFIED | Regression check: `WorkspaceOutline.tsx` unchanged by the gap-closure diff (`git diff --stat` across the gap-closure range touches no file in `_components/` other than `WorkspaceStateProvider.tsx`). `SECTION_STATE_LABELS` and jump-to-section logic re-confirmed present via direct grep. |
| 3 | Collapsible context panel renders stage-appropriate context and can be hidden (WSP-03) | ✓ VERIFIED | **Gap closed.** `layout.tsx:249` now renders `<ContextPanel title="Context">{panelContent}</ContextPanel>` sourced from `useWorkspaceState()` (confirmed by direct read — the prior `{null}` is gone). `WorkspaceStateProvider.tsx` exposes a `panelContent`/`setPanelContent` slot (defaults to `null`, preserving `ContextPanel`'s own honest-empty placeholder) plus `pitchRows`/`qaFindings`/`claimRows`/`signOffs` on the context value — confirmed exactly 8 `useQuery(` calls remain (unchanged from the pre-gap-closure baseline; no new Convex subscription). All 5 stage pages (`story/`, `draft/`, `fact-check/`, `voice/`, `approval/page.tsx`) now mount a stage-specific `*PanelPublisher` sibling component that calls `setPanelContent` in an effect with null-cleanup on unmount. Confirmed by direct read of all 5 publisher files (`StoryPanelContent.tsx`, `DraftPanelContent.tsx`, `FactCheckPanelContent.tsx`, `VoicePanelContent.tsx`, `ApprovalPanelContent.tsx`) that each reads only `useWorkspaceState()` — grep for `useQuery(` across all 5 returns zero matches. Each builder distinguishes `undefined` (loading) from an empty array (honest "No charity selected yet" / "No open QA items — this draft is clean" / "No claims extracted yet" / "No voice tells flagged" / explicit "not signed"/"no claims yet"/"none" readiness rows) — never a fake populated or fake-verified state. `ApprovalPanelContent.tsx` is confirmed to contain no `DecisionRail` import (grep returns zero matches) — it is a deliberate read-only duplicate, not a re-import of the write-capable rail. |
| 4 | Stage 2 (Draft) galley: checked claims marigold-underlined w/ hover+keyboard-focus source reveal; unchecked claims rust-tinted and clickable through to Fact Check (WSP-04) | ✓ VERIFIED | Regression check: `globals.css` `.galley-claim:focus-visible` / `[data-provenance="sourced"/"unsourced"]` rules re-confirmed present via direct grep. `ClaimMark.tsx` `onFocus`/`onBlur`/`onUnsourcedClaimClick` re-confirmed present. Diff-confirmed: neither file appears in the gap-closure `git diff --stat`. |
| 5 | Stage 5 (Approval) leads with blockers, then readiness board, then the agent editor's recommendation labeled as agent judgment (WSP-05) | ✓ VERIFIED | Regression check: `DecisionRail.tsx` section order and "Agent editor's recommendation" label re-confirmed present via direct grep. File untouched by the gap-closure diff. |
| 6 | Publish disabled until Must fix=0 ∧ Fact Check complete ∧ Voice approved current, unlock condition next to control; exact preview + one-click confirm, no typed confirmation (WSP-06) | ✓ VERIFIED | Regression check: `DecisionRail.tsx` `publishDisabled` gate and unlock-condition text re-confirmed present. `PublishPreviewDialog.tsx` untouched by the gap-closure diff (not in `git diff --stat` output). |
| 7 | "Not generated" renders as a first-class state in canvas and outline, never a blank (WSP-07) | ✓ VERIFIED | Regression check: `WorkspaceOutline.tsx` `'— not generated'` label and `Galley.tsx`'s `NotGeneratedBlock` re-confirmed present (untouched by gap-closure diff); `DraftNotGenerated.test.tsx` (3 tests) still green in the re-run full suite. |
| 8 | Stage 1 (Story) renders the existing candidate slate + Gate 1 adjudication scoped to THIS issue's run, so no capability is lost (part of WSP-01) | ✓ VERIFIED | Regression check: `story/page.tsx` still resolves `issueNumber → runId` server-side and mounts `SignalDeskScreen` with the `runId` prop; the only change to this file in the gap-closure diff is the additive `<StoryPanelPublisher />` sibling (+8/-1 lines) — `SignalDeskScreen`'s own props are untouched. |

**Score:** 7/7 truths verified. The 8th row above is a component of WSP-01's "no capability lost" clause, folded into truth #1 for scoring purposes.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx` | Frame: stage tabs + outline + panel + persistent controls + last-visited writer | ✓ VERIFIED | 284 lines; `FrameChrome` destructures `panelContent` from `useWorkspaceState()` and renders `<ContextPanel title="Context">{panelContent}</ContextPanel>` — hardcoded `{null}` is gone. All other frame pieces (tabs, header, outline, controls, last-visited writer) unchanged. |
| `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` | Single Convex-subscription/derivation context + panel-content slot | ✓ VERIFIED | 239 lines (+33 from pre-gap-closure baseline); exactly 8 `useQuery(` calls (unchanged count); new `panelContent`/`setPanelContent` state + 4 exposed already-fetched arrays (`pitchRows`/`qaFindings`/`claimRows`/`signOffs`), all additive. |
| `apps/dispatch-control/app/(dashboard)/issues/_components/ContextPanel.tsx` | Collapsible shell (content-agnostic) | ✓ VERIFIED | Byte-unchanged per 41-11-SUMMARY.md's explicit scope boundary; confirmed no diff to this file in the gap-closure range. |
| `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/story/StoryPanelContent.tsx` | Stage 1 panel publisher (lead/org detail from `pitchRows`) | ✓ VERIFIED | `buildStoryPanelContent` pure function + `StoryPanelPublisher` effect wrapper; honest loading/"No charity selected yet" states; no `useQuery(`; mounted in `story/page.tsx`. |
| `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/draft/DraftPanelContent.tsx` | Stage 2 panel publisher (open QA items via `isOpenFinding`) | ✓ VERIFIED | Reuses the shared `isOpenFinding` predicate (not re-derived inline); honest loading/"No open QA items — this draft is clean" states; no `useQuery(`; mounted in `draft/page.tsx`. |
| `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckPanelContent.tsx` | Stage 3 panel publisher (claim detail from `claimRows`) | ✓ VERIFIED | Mirrors `FactCheckPlaceholder`'s coverage line + Pending/Checked/Skipped vocabulary; honest loading/"No claims extracted yet" states; no `useQuery(`; mounted in `fact-check/page.tsx`. |
| `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/voice/VoicePanelContent.tsx` | Stage 4 panel publisher (voice findings via `isOpenFinding` + `VOICE_AXES`) | ✓ VERIFIED | Uses the exact same filter `VoicePassRunView`'s tell count uses (list never disagrees with the header count); honest loading/"No voice tells flagged" states; no `useQuery(`; mounted in `voice/page.tsx`. |
| `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalPanelContent.tsx` | Stage 5 panel publisher (readiness board, read-only duplicate) | ✓ VERIFIED | No `DecisionRail` import (grep-confirmed); every readiness row always renders explicit text (never blank); honest "Loading readiness…" while `signOffs === undefined`; mounted in `approval/page.tsx`. |
| `apps/dispatch-control/__tests__/WorkspaceContextPanelSlot.test.tsx` | Regression: slot mechanism (setPanelContent → rendered panel; default placeholder) | ✓ VERIFIED | File exists (5092 bytes); 2 tests, both passing in the re-run full suite. |
| `apps/dispatch-control/__tests__/StageContextPanels.test.tsx` | Regression: per-stage populated/honest-empty/loading coverage for all 5 builders + 5-publisher plumbing test | ✓ VERIFIED | File exists (10973 bytes); 20 tests, all passing in the re-run full suite. |
| `apps/dispatch-control/lib/nav.ts` | Single "Issue Workspace" item; 3 desks absent | ✓ VERIFIED (regression check) | No diff in gap-closure range; re-confirmed via grep. |
| `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceOutline.tsx` | 5-state outline + jump-to | ✓ VERIFIED (regression check) | No diff in gap-closure range; re-confirmed via grep. |
| `apps/dispatch-control/components/galley/ClaimMark.tsx` | Focus-parity + click-through | ✓ VERIFIED (regression check) | No diff in gap-closure range; re-confirmed via grep. |
| `apps/dispatch-control/app/globals.css` | `.galley-claim:focus-visible` + provenance colors | ✓ VERIFIED (regression check) | No diff in gap-closure range; re-confirmed via grep. |
| `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx` + `PublishPreviewDialog.tsx` | Stage 5 + exact preview | ✓ VERIFIED (regression check) | No diff in gap-closure range. |
| `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` | Blockers→readiness→recommendation, publish gate | ✓ VERIFIED (regression check) | No diff in gap-closure range; re-confirmed via grep. |
| `convex/issues.ts` `setLastVisitedStage` | Operator mutation, idempotent patch-only | ✓ VERIFIED (regression check) | Unaffected by gap-closure plans (no Convex functions touched — 41-12-SUMMARY.md confirms no `dev:once` sync was required this wave). |
| `docs/API_CONTRACTS.md` | Unchanged (publish contract untouched) | ✓ VERIFIED (regression check) | No diff to this file in the gap-closure range. |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `layout.tsx` `<ContextPanel>` | `panelContent` from `useWorkspaceState()` | destructured render | ✓ WIRED | **Gap closed** — was `NOT_WIRED` (hardcoded `{null}`) in the prior pass. |
| `story/page.tsx` | `StoryPanelPublisher` → `setPanelContent` | effect on mount, cleanup to `null` on unmount | ✓ WIRED | Publishes `buildStoryPanelContent(pitchRows)`. |
| `draft/page.tsx` | `DraftPanelPublisher` → `setPanelContent` | effect on mount, cleanup to `null` on unmount | ✓ WIRED | Publishes `buildDraftPanelContent(qaFindings)`, reusing shared `isOpenFinding`. |
| `fact-check/page.tsx` | `FactCheckPanelPublisher` → `setPanelContent` | effect on mount, cleanup to `null` on unmount | ✓ WIRED | Publishes `buildFactCheckPanelContent(claimRows)`. |
| `voice/page.tsx` | `VoicePanelPublisher` → `setPanelContent` | effect on mount, cleanup to `null` on unmount | ✓ WIRED | Publishes `buildVoicePanelContent(qaFindings)` filtered by `VOICE_AXES`. |
| `approval/page.tsx` | `ApprovalPanelPublisher` → `setPanelContent` | effect on mount, cleanup to `null` on unmount | ✓ WIRED | Publishes `buildApprovalPanelContent({signOffs, claimRows, tasks, held})`, all sourced from `useWorkspaceState()`. |
| `layout.tsx` stage tabs | `useWorkspaceState().stages` | `usePathname()` active-link + `deriveStageStates` | ✓ WIRED (regression check) | Unchanged. |
| `layout.tsx` last-visited effect | `api.issues.setLastVisitedStage` | best-effort `useMutation` call | ✓ WIRED (regression check) | Unchanged. |
| `WorkspaceOutline` | `useWorkspaceState().sectionStates` | context consumption + `galleyAnchorFor` scroll | ✓ WIRED (regression check) | Unchanged. |
| `Galley` `onUnsourcedClaimClick` | `GallerySection` → `ClaimMark` → click handler | prop threading | ✓ WIRED (regression check) | Unchanged. |
| `ReviewDeskRunView` `onUnsourcedClaimClick` | `router.push(issueFactCheckHref(issueNumber))` | Draft-mount-only wiring | ✓ WIRED (regression check) | Unchanged. |
| `DecisionRail` Publish button | `PublishPreviewDialog` → `handlePublish` → `publishIssue(token, runId)` | preview interstitial | ✓ WIRED (regression check) | Unchanged. |
| `approval/page.tsx` → `ApprovalStage.tsx` | `DecisionRail` (full-width) | `held` sourced from frame context | ✓ WIRED (regression check) | Unchanged — `ApprovalPanelContent.tsx` (new) does NOT import `DecisionRail`, confirmed by grep. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| `StoryPanelContent.tsx` | `pitchRows` | `useWorkspaceState().pitchRows` ← `api.pitchLog.byRunId` (real Convex query, already subscribed) | Yes — renders winner charity name/location/focus/scout-summary + candidate list from actual pitch-log rows | ✓ FLOWING |
| `DraftPanelContent.tsx` | `qaFindings` | `useWorkspaceState().qaFindings` ← `api.qaCorrections.byRunId` | Yes — filters real findings via shared `isOpenFinding`, renders section/severity/reason per open finding | ✓ FLOWING |
| `FactCheckPanelContent.tsx` | `claimRows` | `useWorkspaceState().claimRows` ← `api.claimChecks.listByRunId` | Yes — renders real claim text, status, source URL per row; coverage count computed from actual row count | ✓ FLOWING |
| `VoicePanelContent.tsx` | `qaFindings` (voice-axis subset) | `useWorkspaceState().qaFindings`, filtered by `VOICE_AXES` | Yes — same source as Draft panel, filtered to voice-axis findings only | ✓ FLOWING |
| `ApprovalPanelContent.tsx` | `signOffs`, `claimRows`, `tasks`, `held` | `useWorkspaceState()` (all 4 fields, all real Convex-sourced) | Yes — readiness rows always render explicit real state ("signed"/"not signed"/actual must-fix count), never a hardcoded placeholder | ✓ FLOWING |

No hollow props found — none of the 5 publishers pass a hardcoded `[]`/`{}`/`null` literal at the call site; every value flows from the provider's real Convex subscriptions.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full dispatch-control test suite (re-run independently, not trusted from SUMMARY) | `pnpm --filter dispatch-control test -- --run` | 83 files passed / 1 skipped (84); 659 tests passed / 2 todo (661); exit 0 — matches 41-12-SUMMARY.md's claimed counts exactly | ✓ PASS |
| Strict Next build (re-run independently) | `pnpm --filter dispatch-control build` | "Compiled successfully"; 11 static + dynamic routes generated; all 5 stage routes (`story`/`draft`/`fact-check`/`voice`/`approval`) + both redirects (`/issues/[issueNumber]`, `/issues/[issueNumber]/review`) present in the route table | ✓ PASS |
| ContextPanel real-content wiring (the previously-failing check) | `grep -rn "ContextPanel" apps/dispatch-control` then read `layout.tsx:249` directly | `layout.tsx` renders `{panelContent}` (not `{null}`); 5 new `*PanelContent.tsx` files each publish into the slot | ✓ PASS (was ✗ FAIL in prior verification) |
| Zero new Convex subscriptions | `grep -n "useQuery(" WorkspaceStateProvider.tsx` (count) + `grep -n "useQuery(" <5 panel files>` | Provider: exactly 8 matches (unchanged). 5 panel files: 0 matches | ✓ PASS |
| No DecisionRail re-import in the Approval panel duplicate | `grep -n "DecisionRail" ApprovalPanelContent.tsx` | 0 matches | ✓ PASS |
| Isolated diff scope (regression risk check) | `git diff --stat 61003ff~1 HEAD -- apps/dispatch-control` | 14 files changed: 2 new test files, 5 new panel-content files, 5 stage `page.tsx` files (+8/-1 each, additive publisher mount only), `layout.tsx` (+2/-2, the panel-render line only), `WorkspaceStateProvider.tsx` (+33/-0, purely additive) | ✓ PASS |

All commands above were independently re-run during this re-verification (not merely trusted from 41-11/41-12-SUMMARY.md) and reproduced the exact same pass counts/output recorded there.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| WSP-01 | 41-01, 41-02, 41-04, 41-06, 41-07 | One Issue Workspace replaces 3 desk nav items; stage tabs 1-5 with live status marks | ✓ SATISFIED | nav.ts, layout.tsx, story/page.tsx + SignalDeskScreen runId prop (regression-confirmed) |
| WSP-02 | 41-01, 41-05 | Persistent outline lists every section w/ 5-state + jump | ✓ SATISFIED | WorkspaceOutline.tsx, derivedState.ts (regression-confirmed) |
| WSP-03 | 41-05, 41-11, 41-12 | Collapsible context panel renders stage-appropriate context, can be hidden | ✓ SATISFIED | **Now fully closed.** ContextPanel shell (41-05) + slot mechanism (41-11) + 5 stage publishers (41-12); code-verified end-to-end this pass. |
| WSP-04 | 41-03, 41-08 | Stage 2 galley typography, marigold/rust, focus+hover, click-through | ✓ SATISFIED | ClaimMark.tsx, globals.css, ReviewDeskRunView.tsx (regression-confirmed) |
| WSP-05 | 41-09 | Stage 5 blockers → readiness board → agent editor's recommendation | ✓ SATISFIED | DecisionRail.tsx section order + label (regression-confirmed) |
| WSP-06 | 41-09 | Publish gate + unlock text + exact preview + one-click confirm | ✓ SATISFIED | DecisionRail.tsx gate, PublishPreviewDialog.tsx (regression-confirmed) |
| WSP-07 | 41-01, 41-05, 41-07, 41-08 | "Not generated" first-class state in canvas + outline | ✓ SATISFIED | Galley.tsx NotGeneratedBlock, WorkspaceOutline.tsx (regression-confirmed) |

No orphaned requirements: REQUIREMENTS.md (lines 353-359, 806-812) maps exactly WSP-01 through WSP-07 to Phase 41; every ID appears in at least one plan's `requirements:` frontmatter, including the two gap-closure plans (`requirements-completed: [WSP-03]` in both 41-11-SUMMARY.md and 41-12-SUMMARY.md). REQUIREMENTS.md's checkbox list (lines 353-359) shows all 7 WSP items checked `[x]`. Its separate tracking table (lines 806-812) still shows only WSP-01 and WSP-03 as "Complete" with WSP-02/04/05/06/07 as "Planned" — this is stale bookkeeping carried over from the prior verification's note (the phase-complete step that flips this table apparently hasn't fully run for these rows), not a code gap; it does not affect this verification's status determination, which is based on code evidence, not this table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | No TODO/FIXME/HACK/"coming soon"/"not yet implemented" strings found in any of the 14 gap-closure-touched files scanned | — | none |

### Human Verification Required

### 1. Live demo-path UAT (Section 2 of `41-UAT.md`), now including panel-content behavior

**Test:** Run `pnpm --filter dispatch-control dev` against dev Convex; open an in-progress issue at `/issues/[n]`; walk Story → Draft → Voice → Approval → Publish-preview → confirm, observing tab/status/publish-lock reactivity AND the ContextPanel's content on each stage (real lead detail, open QA items, claim detail, voice tells, readiness board — swapping cleanly with no stale prior-stage content on tab switch).
**Expected:** All 7 WSP-referenced rows in `41-UAT.md` Section 2 pass, plus header/task-count/tab-mark/publish-lock updates live with no manual refresh, plus the ContextPanel shows correct stage-specific content that clears/refills on every tab change.
**Why human:** Multi-stage live Convex reactivity with no jsdom-automatable equivalent — genuinely requires a human operator driving a running console, per the phase's own 41-10 plan text. This is the expected residual already recorded PENDING in `41-UAT.md`, not a new gap discovered by this verification. It was already the sole human-verification item in the prior pass; the panel-content dimension is added to its scope here since WSP-03's code is now live.

### Gaps Summary

**No gaps remain.** The prior verification's sole finding — WSP-03's "renders stage-appropriate context" half being unwired (`ContextPanel` mounted with hardcoded `{null}` on all 5 stages) — has been closed by two gap-closure plans, both re-verified against the actual running code in this pass, not merely trusted from their SUMMARYs:

- **Plan 41-11** added a `panelContent`/`setPanelContent` slot to `WorkspaceStateProvider` (defaulting to `null`, preserving `ContextPanel`'s own honest-empty placeholder) and changed `layout.tsx`'s hardcoded `<ContextPanel>{null}</ContextPanel>` to `<ContextPanel>{panelContent}</ContextPanel>` — confirmed by direct read of both files.
- **Plan 41-12** added 5 stage-specific "panel publisher" components (Story/Draft/Fact Check/Voice/Approval), each a pure `buildXxxPanelContent` function plus a thin effect-wrapper that calls `setPanelContent` on mount and cleans up to `null` on unmount, mounted as siblings of each stage's existing screen component in that stage's `page.tsx` — confirmed by direct read of all 5 content files and all 5 modified page wrappers.

Independent verification performed in this pass (not delegated to trust of the SUMMARYs):
- Read `layout.tsx` directly and confirmed line 249 now renders `{panelContent}`, not `{null}`.
- Read `WorkspaceStateProvider.tsx` and counted exactly 8 `useQuery(` calls — unchanged from the pre-gap-closure baseline, confirming zero new Convex subscriptions were introduced to close this gap.
- Read all 5 panel-content files and confirmed zero `useQuery(` calls in any of them (they read exclusively from `useWorkspaceState()`), and confirmed `ApprovalPanelContent.tsx` contains no `DecisionRail` import (it is a deliberate read-only duplicate of the rail's readiness summary, per the gap's explicit extract-or-duplicate allowance).
- Read all 5 stage `page.tsx` files and confirmed each now mounts its corresponding `*PanelPublisher` as an additive sibling of the pre-existing stage screen component, with no change to that screen's own props.
- Ran `git diff --stat` across the full gap-closure commit range and confirmed the change set touches only the 5 new panel-content files, 2 new test files, the 5 stage `page.tsx` wrappers (+8/-1 lines each, purely additive), `layout.tsx` (+2/-2, the single panel-render line), and `WorkspaceStateProvider.tsx` (+33/-0, purely additive) — no file underpinning WSP-01/02/04/05/06/07 (`nav.ts`, `globals.css`, `ClaimMark.tsx`, `WorkspaceOutline.tsx`, `Galley.tsx`, `DecisionRail.tsx`, `PublishPreviewDialog.tsx`, `ApprovalStage.tsx`) appears in the diff, ruling out regression by construction and confirmed by direct grep re-checks of each.
- Independently re-ran the full test suite (`pnpm --filter dispatch-control test -- --run`) — 83 files / 659 tests passed, matching 41-12-SUMMARY.md's claimed counts exactly — and the strict build (`pnpm --filter dispatch-control build`) — clean compile, all 5 stage routes + 2 redirects live in the route table.

WSP-03 is now genuinely and fully delivered in code: both halves ("collapsible + can be hidden" and "renders stage-appropriate context") are wired and tested. Combined with the unregressed WSP-01/02/04/05/06/07, all 7 Phase 41 Success Criteria are code-verified. The one remaining item — the live demo-path human-UAT walk recorded in `41-UAT.md` — is an expected manual residual (multi-stage live Convex reactivity with no jsdom equivalent), not a gap, and does not block phase completion.

---

*Verified: 2026-07-15*
*Verifier: Claude (gsd-verifier)*
