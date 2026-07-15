---
phase: 41-issue-workspace-frame
verified: 2026-07-15T00:50:00Z
status: gaps_found
score: 6/7 must-haves verified (1 genuine code gap; 1 human-UAT residual expected, not counted against score)
gaps:
  - truth: "A collapsible context panel renders stage-appropriate context (open items, claim detail, findings, decision log) and can be hidden (WSP-03)"
    status: failed
    reason: >
      The ContextPanel component itself is fully built and unit-tested (collapsible shell,
      Hide/Show toggle, localStorage persistence, never-blank empty-state copy) — but it is
      wired into the app in exactly ONE place, apps/dispatch-control/app/(dashboard)/issues/
      [issueNumber]/layout.tsx line 249: `<ContextPanel title="Context">{null}</ContextPanel>`.
      No stage page (story, draft, fact-check, voice, approval) ever passes real content into
      it. Confirmed by an exhaustive grep of the whole apps/dispatch-control tree: "ContextPanel"
      appears only in layout.tsx (hardcoded {null}) and in ContextPanel.tsx/ContextPanel.test.tsx
      themselves — no other file references it. 41-CONTEXT.md D-19 explicitly specified the
      per-stage content mapping (Stage 1 lead/org detail; Stage 2 open QA items; Stage 3 claim
      detail; Stage 4 voice findings; Stage 5 decision log/readiness detail) and 41-06-SUMMARY.md
      explicitly deferred that wiring to Plans 41-07/41-08/41-09 ("the per-stage children
      injection ... is each stage page's job in 41-07/08/09") — but none of those three plans'
      must_haves actually captured this obligation, and none of their SUMMARYs or diffs touch
      ContextPanel. In the running app the panel always renders "Nothing to show for this stage
      yet" on every one of the 5 stages. The "collapsible + can be hidden" half of WSP-03 is
      genuinely delivered; the "renders stage-appropriate context" half is not.
    artifacts:
      - path: "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx"
        issue: "Line 249 mounts <ContextPanel title=\"Context\">{null}</ContextPanel> unconditionally — no stage-aware content is ever passed, on any of the 5 stage routes"
      - path: "apps/dispatch-control/app/(dashboard)/issues/_components/ContextPanel.tsx"
        issue: "Component itself is correct and content-agnostic (accepts children) — the gap is entirely at the call site, not in this file"
    missing:
      - "Thread real per-stage content into ContextPanel from each stage route (or its inner client component): Stage 1 (Story) lead/org detail from SignalDeskScreen's candidate/pitch data; Stage 2 (Draft) the open QA items list (reuse the qaCorrections feed already fetched by ReviewDeskRunView); Stage 3 (Fact Check) claim detail (reuse claim_checks data FactCheckPlaceholder already has); Stage 4 (Voice) voice findings; Stage 5 (Approval) the decision log / readiness detail (DecisionRail already computes most of this — extract or duplicate the relevant read-only summary into the panel slot)."
      - "A mechanism for a nested stage route to set the frame layout's ContextPanel children — e.g. hoist per-stage panel content into WorkspaceStateProvider as a new context field the stage page can populate via a setter, or move ContextPanel rendering out of layout.tsx and into each stage page (with the frame supplying only the shell import) so each stage can pass its own children directly."
      - "A regression test proving each stage's ContextPanel shows non-placeholder, stage-specific content (the existing ContextPanel.test.tsx only proves the shell mechanics with arbitrary test children, not that any real stage feeds it anything)."
human_verification:
  - test: "Walk the live demo path per .planning/phases/41-issue-workspace-frame/41-UAT.md Section 2 (all 7 rows currently ⬜ PENDING): open an in-progress issue at /issues/[n] against dev Convex, confirm the single 'Issue Workspace' nav item, stage-tab live status marks updating without full reload, outline jump-to-section, Stage 2 claim marigold/rust rendering with hover+Tab-focus source reveal and unchecked-claim click-through to Fact Check, Stage 4→5 sign-off flow, Publish gate unlocking with the exact-preview dialog and one-click confirm, and a 'not generated' section rendering as a first-class Editor's-note block."
    expected: "All 7 rows plus the live-reactivity check pass with no full-page reloads and no stale UI on Convex-driven changes."
    why_human: "Requires a running console (pnpm --filter dispatch-control dev) against live dev Convex, walking multiple stage navigations while observing live reactivity (tab marks, header status, publish lock updating without refresh) — no jsdom-automatable equivalent, per the phase's own 41-10 plan text. This is the expected UAT residual already recorded pending in 41-UAT.md, not a new gap discovered by this verification."
---

# Phase 41: Issue Workspace Frame Verification Report

**Phase Goal:** The Review Desk, Signal Desk, and Voice Pass nav items collapse into one Issue Workspace with stage tabs 1-5 — with no loss of capability. Stages 2 (Draft), 4 (Voice Pass), and 5 (Approval) are recompositions of the galley, voice-pass, and decision-rail work already shipped in v3.0 — not new backend. Stage 1 provisionally mounts the existing Phase 37 Signal Desk as-is, carried over until Phase 47.

**Verified:** 2026-07-15
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth (WSP ref) | Status | Evidence |
|---|---|---|---|
| 1 | Stage tabs 1-5 replace Review Desk/Signal Desk/Voice Pass nav items, each carrying a live status mark (WSP-01) | ✓ VERIFIED | `lib/nav.ts` has one "Issue Workspace" item; Review Desk/Signal Desk/Voice Pass are absent from `NAV_GROUPS` (only a code comment references them, no `NavItem`). `layout.tsx` `FrameChrome` renders 5 `<Link>` stage tabs with icon+label from `deriveStageStates`/`STAGE_STATE_LABELS` (never color alone). Strict build confirms all 5 stage routes + 2 redirects (`/issues/[n]`, legacy `/issues/[n]/review`) are live. |
| 2 | Persistent issue outline lists every section with 5-state (clean/review/must-fix/changed-since-review/not-generated) and jumps to it (WSP-02) | ✓ VERIFIED | `WorkspaceOutline.tsx` renders one row per `EDITABLE_SECTIONS`, label+icon per `SECTION_STATE_LABELS`, `jumpToSection` scrolls via `galleyAnchorFor`; a loading state (not an inferred "not generated" wall) shows while `sectionStates` is `undefined`; `deriveSectionStates`/`draftSectionIdsFromDraft` share the SAME authoritative-draft source the Stage-2 canvas reads (`derivedState.ts`). |
| 3 | Collapsible context panel renders stage-appropriate context and can be hidden (WSP-03) | ✗ FAILED | `ContextPanel.tsx` shell (collapse/hide/localStorage persistence) is real and tested, but is mounted in exactly one place — `layout.tsx:249` — with hardcoded `{null}` children. No stage route ever injects Stage 1 lead detail / Stage 2 open QA items / Stage 3 claim detail / Stage 4 voice findings / Stage 5 decision log, despite this being explicitly specified in 41-CONTEXT.md D-19 and explicitly deferred (not delivered) per 41-06-SUMMARY.md's own admission. The panel always shows its empty-state copy on every stage. |
| 4 | Stage 2 (Draft) galley: checked claims marigold-underlined w/ hover+keyboard-focus source reveal; unchecked claims rust-tinted and clickable through to Fact Check (WSP-04) | ✓ VERIFIED | `globals.css` `.galley-claim[data-provenance="sourced"]` (marigold gradient wash) / `="unsourced"` (rust/vermilion wash); `.galley-claim:focus-visible` added, matching `.galley-anno`. `ClaimMark.tsx` reveals the popover via `onFocus`/`onBlur` (`focusOpen` state) independent of click-`open`. `onUnsourcedClaimClick` threaded `Galley → GallerySection → ClaimMark`, wired in `ReviewDeskRunView.tsx` (the Draft mount) to `router.push(issueFactCheckHref(issueNumber))`. |
| 5 | Stage 5 (Approval) leads with blockers, then readiness board, then the agent editor's recommendation labeled as agent judgment (WSP-05) | ✓ VERIFIED | `DecisionRail.tsx` section order: 1 headline count, 2 Blocking items, 3 Readiness board (Fact check/Voice/Hook & peg/Organization verification "Not tracked yet"/Open decisions — never blank, never color-alone), 4 "Agent editor's recommendation" (explicit label, sourced from `editor-final` `notes`), then Hook/Verification/Sign-offs/Actions/Resolved. |
| 6 | Publish disabled until Must fix=0 ∧ Fact Check complete ∧ Voice approved current, unlock condition next to control; exact preview + one-click confirm, no typed confirmation (WSP-06) | ✓ VERIFIED | `DecisionRail.tsx`: `publishDisabled = blockers.length>0 \|\| !factsActive \|\| !humanActive \|\| !!held \|\| busy`; "Unlocks when: Must fix = 0 · Fact Check complete · Voice approved current[· Not held]" rendered next to the button. `PublishPreviewDialog.tsx` shows Destination/Title/Time/Consequences with a single "Publish now" button (no typed-input anywhere) calling the unchanged `publishIssue(token, runId)`. |
| 7 | "Not generated" renders as a first-class state in canvas and outline, never a blank (WSP-07) | ✓ VERIFIED | `Galley.tsx` `NotGeneratedBlock` renders an Editor's-note-style block inside the section's `galley-{id}` anchor; `WorkspaceOutline.tsx` renders `'— not generated'` with a distinct icon, never a blank row; both share `draftSectionIdsFromDraft` so they cannot disagree. `DraftNotGenerated.test.tsx` (3 tests) passes. |
| 8 | Stage 1 (Story) renders the existing candidate slate + Gate 1 adjudication scoped to THIS issue's run, so no capability is lost (part of WSP-01) | ✓ VERIFIED | `story/page.tsx` resolves `issueNumber → runId` server-side and mounts `SignalDeskScreen` with the 41-04 `runId` prop; `SignalDeskScreen.tsx` skips `api.runs.latest` entirely when `runId` is passed (`passedRunId ? 'skip' : ...`), so a held/older issue is never silently overridden by the workspace's latest run. `WorkspaceControls.tsx` relocates Hold/Reopen + run-history verbatim from the old overview — no capability lost. |

**Score:** 6/7 truths verified (WSP-03 failed; see gap above). The 8th row above is a component of WSP-01's "no capability lost" clause, folded into truth #1 for scoring purposes.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx` | Frame: stage tabs + outline + panel + persistent controls + last-visited writer | ✓ VERIFIED | 284 lines; all pieces present; `setLastVisitedStage` mutation call in a `useEffect` keyed on `usePathname()`, best-effort (`.catch(() => {})`) |
| `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx` | Redirect-only into last-visited/default stage | ✓ VERIFIED | `redirect()` server component; D-03 (lastVisitedStage) then D-04 default (Draft if run+pitch, else Story) |
| `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/{story,draft,fact-check,voice,approval}/page.tsx` | 5 stage routes | ✓ VERIFIED | All 5 exist; confirmed live in strict build route table |
| `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/review/page.tsx` | Legacy redirect to `/draft` | ✓ VERIFIED | `redirect(issueDraftHref(n))` |
| `apps/dispatch-control/lib/nav.ts` | Single "Issue Workspace" item; 3 desks absent | ✓ VERIFIED | Confirmed via grep — no `NavItem` for Review Desk/Signal Desk/Voice Pass in `NAV_GROUPS` |
| `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceOutline.tsx` | 5-state outline + jump-to | ✓ VERIFIED | 161 lines; loading-state guard; legend of all 5 vocabulary values |
| `apps/dispatch-control/app/(dashboard)/issues/_components/ContextPanel.tsx` | Collapsible shell + stage content | ⚠️ HOLLOW | Shell itself passes all unit tests (content render, empty placeholder, hide/show, localStorage) — but is never fed real content anywhere in the app (see gap) |
| `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceStateProvider.tsx` | Single Convex-subscription/derivation context | ✓ VERIFIED | 206 lines; 8 Convex queries + authoritative-draft fetch; `sectionStates` stays `undefined` (never inferred empty) while loading |
| `apps/dispatch-control/components/galley/ClaimMark.tsx` | Focus-parity + click-through | ✓ VERIFIED | `onFocus`/`onBlur` reveal, `onUnsourcedClaimClick` click-through gated on `status === 'pending'` |
| `apps/dispatch-control/app/globals.css` | `.galley-claim:focus-visible` | ✓ VERIFIED | Matches `.galley-anno:focus-visible` outline treatment |
| `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/approval/ApprovalStage.tsx` + `PublishPreviewDialog.tsx` | Stage 5 + exact preview | ✓ VERIFIED | `ApprovalStage` reads `held` from `useWorkspaceState()` (no duplicate subscription); `PublishPreviewDialog` shows destination/title/time/consequences, one-click confirm |
| `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx` | Blockers→readiness→recommendation, publish gate | ✓ VERIFIED | Section order and gate exactly match WSP-05/06; `Agent editor's recommendation` label present |
| `convex/issues.ts` `setLastVisitedStage` | Operator mutation, idempotent patch-only | ✓ VERIFIED | Present at line 232; `requireOperator` guard; no-op (never creates a row) when the issue row is absent; confirmed deployed live via `pnpm --filter @eisenbalm/convex dev:once` → "Convex functions ready!" |
| `docs/API_CONTRACTS.md` | Unchanged (publish contract untouched) | ✓ VERIFIED | No diff to this file in the Phase 41 range; `publishIssue()` call signature unchanged |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `layout.tsx` stage tabs | `useWorkspaceState().stages` | `usePathname()` active-link + `deriveStageStates` | ✓ WIRED | `aria-current="page"`, icon/label from `STAGE_STATE_LABELS` |
| `layout.tsx` last-visited effect | `api.issues.setLastVisitedStage` | best-effort `useMutation` call on stage-segment path change | ✓ WIRED | Guards unknown segments (`/runs/[runId]`, bare index); tolerates failure |
| `WorkspaceOutline` | `useWorkspaceState().sectionStates` | context consumption + `galleyAnchorFor` scroll | ✓ WIRED | |
| `layout.tsx` `<ContextPanel>` | stage-specific content | **none** | ✗ NOT_WIRED | Hardcoded `{null}` — see gap |
| `Galley` `onUnsourcedClaimClick` | `GallerySection` → `ClaimMark` → click handler | prop threading | ✓ WIRED | |
| `ReviewDeskRunView` `onUnsourcedClaimClick` | `router.push(issueFactCheckHref(issueNumber))` | Draft-mount-only wiring | ✓ WIRED | |
| `DecisionRail` Publish button | `PublishPreviewDialog` → `handlePublish` → `publishIssue(token, runId)` | preview interstitial before the unchanged publish call | ✓ WIRED | |
| `story/page.tsx` | `SignalDeskScreen` | server-resolved `runId` passed as a prop, bypassing `runs.latest` | ✓ WIRED | |
| `draft/page.tsx` | `ReviewDeskRunView` (minus DecisionRail) | server-resolved `runId` + `issueNumber` props | ✓ WIRED | Confirmed no `DecisionRail` import in `ReviewDeskRunView.tsx` |
| `approval/page.tsx` → `ApprovalStage.tsx` | `DecisionRail` (full-width) | `held` sourced from frame context, not re-queried | ✓ WIRED | |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full dispatch-control test suite | `pnpm --filter dispatch-control test -- --run` | 81 files passed / 1 skipped (82); 637 tests passed / 2 todo (639); exit 0 | ✓ PASS |
| Strict Next build (type-check + lint) | `pnpm --filter dispatch-control build` | "Compiled successfully"; 11/11 pages generated; all 5 stage routes + 2 redirects present in route table | ✓ PASS |
| Convex live sync | `pnpm --filter @eisenbalm/convex dev:once` | "Convex functions ready!" (5.25s), exit 0 | ✓ PASS |
| Nav item removal | `grep` on `lib/nav.ts` | No `Review Desk`/`Signal Desk`/`Voice Pass` `NavItem` entries in `NAV_GROUPS` | ✓ PASS |
| ContextPanel real-content wiring | `grep -rln "ContextPanel"` across `apps/dispatch-control` | Only `layout.tsx` (hardcoded `{null}`) and the component/test files | ✗ FAIL (this is the recorded gap) |

All three commands above were independently re-run during this verification (not merely trusted from 41-10-SUMMARY.md) and reproduced the exact same pass counts/output recorded there.

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| WSP-01 | 41-01, 41-02, 41-04, 41-06, 41-07 | One Issue Workspace replaces 3 desk nav items; stage tabs 1-5 with live status marks | ✓ SATISFIED | nav.ts, layout.tsx, story/page.tsx + SignalDeskScreen runId prop |
| WSP-02 | 41-01, 41-05 | Persistent outline lists every section w/ 5-state + jump | ✓ SATISFIED | WorkspaceOutline.tsx, derivedState.ts |
| WSP-03 | 41-05 | Collapsible context panel renders stage-appropriate context, can be hidden | ✗ BLOCKED | ContextPanel shell built and hide/show works; stage-content injection never wired (see gap) |
| WSP-04 | 41-03, 41-08 | Stage 2 galley typography, marigold/rust, focus+hover, click-through | ✓ SATISFIED | ClaimMark.tsx, globals.css, ReviewDeskRunView.tsx |
| WSP-05 | 41-09 | Stage 5 blockers → readiness board → agent editor's recommendation | ✓ SATISFIED | DecisionRail.tsx section order + label |
| WSP-06 | 41-09 | Publish gate + unlock text + exact preview + one-click confirm | ✓ SATISFIED | DecisionRail.tsx gate, PublishPreviewDialog.tsx |
| WSP-07 | 41-01, 41-05, 41-07, 41-08 | "Not generated" first-class state in canvas + outline | ✓ SATISFIED | Galley.tsx NotGeneratedBlock, WorkspaceOutline.tsx |

No orphaned requirements: REQUIREMENTS.md (lines 353-359, 806-812) maps exactly WSP-01 through WSP-07 to Phase 41, and every ID appears in at least one plan's `requirements:` frontmatter (01, 02, 04, 06, 07 in Plan 41-01; 01 in 41-02; 04 in 41-03; 01 in 41-04; 02/03/07 in 41-05; 01 in 41-06; 01/07 in 41-07; 04/07 in 41-08; 05/06 in 41-09; all 7 in 41-10's gate). `REQUIREMENTS.md`'s own tracking table (lines 806-812) still shows WSP-02 through WSP-07 as "Planned" rather than "Complete" — this is stale bookkeeping (the phase-complete step that flips this table apparently hasn't run yet for these rows even though WSP-01 was flipped), not a code gap; noted here for completeness only.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | No TODO/FIXME/HACK/"coming soon"/"not yet implemented" strings found in any of the 13 phase-touched files scanned | — | none |

The one real defect this phase shipped is not a code-smell pattern (no stub comment, no placeholder string) — it is a genuinely wired-nowhere component (`ContextPanel`), which is why it required tracing the actual call graph (Step 4b-style) rather than a grep-only scan to surface.

### Human Verification Required

### 1. Live demo-path UAT (Section 2 of `41-UAT.md`)

**Test:** Run `pnpm --filter dispatch-control dev` against dev Convex; open an in-progress issue at `/issues/[n]`; walk Story → Draft → Voice → Approval → Publish-preview → confirm, observing tab/status/publish-lock reactivity.
**Expected:** All 7 WSP-referenced rows in `41-UAT.md` Section 2 pass, plus header/task-count/tab-mark/publish-lock updates live with no manual refresh.
**Why human:** Multi-stage live Convex reactivity with no jsdom-automatable equivalent — genuinely requires a human operator driving a running console, per the phase's own 41-10 plan text. This is the expected residual already recorded PENDING in `41-UAT.md`, not a new finding from this verification.

### Gaps Summary

Phase 41's frame, routing, nav collapse, outline, galley recomposition (Stage 2), and Approval recomposition (Stage 5) are all genuinely and solidly delivered — verified independently in this pass by re-running the full test suite (637/637 green), the strict build (clean, all 5 stage routes + both redirects live), and the Convex live-sync (functions ready), and by tracing every key wiring link by hand (nav → tabs, claim click-through, publish gate → preview → publish, Signal Desk issue-keying).

One requirement, **WSP-03 (collapsible context panel)**, is only half-delivered: the shell component is well-built and passes its own unit tests, but it was never actually connected to any stage's real content anywhere in the running app — the single integration point hardcodes empty children. This was explicitly planned for in 41-CONTEXT.md (D-19) and explicitly *deferred* by 41-06's own summary text to Plans 41-07/08/09, but none of those three plans' scopes or diffs ever picked it up, so the obligation silently fell through the cracks across the wave boundary. This is a genuine, code-verifiable gap, not a documentation nit — the panel is a permanent empty box in the shipped UI today, on every one of the 5 stages.

The phase's own 41-10 integration gate already correctly identified and persisted the live-UAT walk as a pending human-only checkpoint (not a gap); that residual is preserved here as the sole `human_verification` item and is not counted against the score.

---

*Verified: 2026-07-15*
*Verifier: Claude (gsd-verifier)*
