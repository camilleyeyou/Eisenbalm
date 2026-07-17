# Dispatch Control — Whole-Dashboard UI Review

**Audited:** 2026-07-17
**Scope:** `apps/dispatch-control` (operator dashboard) — whole-app audit, not a single phase. `init phase-op` returned no active phase (v4.0 "Dispatch Control v3," Phases 40–50, is complete); this review measures the implementation against the design intent recorded in Phases 26, 34, 37, 40, 41, 49, 50 (UI-SPECs/PLANs/CONTEXTs/SUMMARYs), `docs/API_CONTRACTS.md`, and `CLAUDE.md`.
**Lens:** the operator's core job — taking a weekly issue from `awaiting-review` to `published` — per the orchestrator's explicit framing. This audit is a post-mortem as much as a style pass: a real production incident (three issues stuck in `awaiting-review` since 2026-07-08, one operator session that clicked Publish three times against an unresolvable 409 and gave up) motivated it.
**Screenshots:** not captured — no dev server running on :3000/:5173/:8080. This is a 100% code-reading audit; every claim below is traced to source, not inferred from a rendered screen.
**Registry audit:** `components.json` exists (shadcn initialized, `baseColor: neutral`), but every reviewed UI-SPEC.md (26, 40) declares **zero third-party registry blocks** — only pre-existing shadcn-official `switch`, "safety gate: not required." No Registry Safety section follows; there is nothing to flag.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Excellent, disciplined "never blank" copy in the current (Editorial) surfaces; the legacy review screen's copy for the *same* underlying action ("Reject Run" vs. "Hold") contradicts the current one, and its error-handling copy targets a 409 reason the server can no longer emit. |
| 2. Visuals | 3/4 | Strong icon+label discipline and a clear single-focal-point Issues home; undercut by two visually distinct product eras coexisting side by side, most damagingly on the exact review/publish screen that matters most. |
| 3. Color | 3/4 | Modern surfaces use a disciplined semantic CSS-variable palette; the legacy System Workbench zone runs an uncoordinated, un-migrated Tailwind neutral/red/amber palette in parallel. |
| 4. Typography | 3/4 | Same split as Color — a deliberate bespoke micro-type scale in Editorial surfaces vs. default Tailwind text sizes in System Workbench/legacy surfaces. Internally consistent in each zone, inconsistent across the app. |
| 5. Spacing | 4/4 | Consistent Tailwind spacing scale everywhere; the small set of arbitrary bracket values are deliberate pixel-level micro-adjustments in named design-system components, not scattered noise. `min-h-[44px]` touch targets applied uniformly. |
| 6. Experience Design | 1/4 | **The core job — publish a reviewed issue — is currently broken via a live, discoverable, un-retired duplicate surface**, plus a second, independently-discovered server endpoint that skips the two-sign-off gate entirely, plus a "Schedule for later" action that only exists on the broken surface. This is not a style nit; it is a confirmed, traced production outage. |

**Overall: 17/24**

---

## Primary Audit Questions — Direct Answers

### Q1. Client-gate vs. server-gate drift

**Two confirmed instances, one exactly matching the grounding incident, one newly found by this audit:**

**1a. `ReviewDecisionPanel.tsx` — CONFIRMED, the incident's root cause.**
`apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/ReviewDecisionPanel.tsx:56-67`:
```
// This is the legacy publish surface (D-06/D-07) — gated the same way as
// review-desk's DecisionRail.
const canApprove = signoffQuery !== undefined && signoffQuery.allSignedOff === true
```
`signoffQuery` reads `claimChecks.allSignedOff` — the Phase 26 claims-checklist gate. Phase 34 (D-04, `packages/pipeline/src/eisenbalm_pipeline/api/review.py:114-133`) relocated that exact check off `publish_issue` and onto the `facts-cleared` sign-off endpoint (`signoffs.py:92-107`); `publish_issue` now gates on `signOffs:activeByRunId` alone (`review.py:118-133`, `reason: "missing_signoffs"`). The comment claiming parity with `DecisionRail` is **false** — `DecisionRail` gates on `factsActive && humanActive` from `signOffs:activeByRunId` (`review-desk/[runId]/_components/DecisionRail.tsx:214-218,521-522`); `ReviewDecisionPanel` never reads that query at all. Net effect: if every individual claim has been checked off (a normal, achievable state that has nothing to do with the two sign-offs) but neither "Facts cleared" nor "Sounds human" was ever recorded, `canApprove` is `true`, the "Approve and Publish" button renders **enabled**, and the click 409s with `missing_signoffs` — a reason this panel has no branch for (see 1a-detail below). This is the exact, already-diagnosed defect; this audit did not need to rediscover it, only confirm it in the current tree.

*1a-detail — reason-vocabulary mismatch:* `ReviewDecisionPanel.tsx:94-104` only branches on `reason === 'claims_not_signed_off'` and `reason === 'wrong_status'`. Neither `publish_issue` nor `schedule_issue` can emit `claims_not_signed_off` anymore (grep-confirmed: that reason now originates exclusively from `signoffs.py:101`, the sign-off recording endpoint, not the publish/schedule endpoints). The branch is dead code. `missing_signoffs` — the reason the endpoint actually emits — falls through to the generic `else { setErrorMsg(e.message) }`, which (now that the FastAPI-envelope-unwrap bug is fixed) does render a legible string ("Both sign-offs (Facts cleared + Sounds human) are required before publishing."). So the *message* is readable, but the screen has **zero sign-off controls** to act on it — an operator reading that message on this screen has no next step available to them on the page they're looking at.

**1b. `POST /issues/{run_id}/publish-manual` — CONFIRMED, newly found, not part of the known incident.**
`packages/pipeline/src/eisenbalm_pipeline/api/control.py:855-925` (the Recovery Rail's "Restart from this step" bridge for a run that failed at the `publisher` node, wired from `RecoveryRail.tsx:171` `publishManual(runId, token)`). This handler goes straight to `asyncio.create_task(_run_publisher(...))` after only checking `_require_editor` and that a Sanity `weeklyIssue` exists (`control.py:887-897`) — it never queries `signOffs:activeByRunId`, unlike `publish_issue` (`review.py:118-133`) and the webhook's independent re-check (`webhooks.py:124-172`, Phase 34 D-07). By construction this is *usually* safe: it only renders (per `restartAvailabilityFor('publisher')`, `lib/nomenclature.ts:227`, unconditionally `'live'`) when the `publisher` agent node itself failed, which normally means the two-sign-off gate already passed once (that's how `_run_publisher` got invoked the first time). But Phase 34's own D-08 design ("sign-offs auto-revoke on content mutation... nothing silent") exists precisely so that an edit after a sign-off invalidates it; `content.py`'s patch endpoints do not gate on run status, so an edit is possible on a run sitting in a `failed`-at-publisher state. In that narrow sequence — publish attempted → publisher step fails → operator (or anyone) edits a section, which per D-08 revokes both sign-offs → operator clicks "Restart from this step" instead of returning to Approval — `publish_manual` will publish content nobody re-attested to, silently. This is the same *class* of bug as 1a (a path to real publish that doesn't consult the sign-off gate) but via omission rather than a stale duplicate gate, and it is a genuine, if narrow, gap in the "server refuses, never just the client" principle the codebase otherwise holds to consistently (`review.py`'s own docstring, `webhooks.py`'s D-07 re-check).

**No other gate drift found.** The role gate (`useRole()` / `LockedControl`, `apps/dispatch-control/lib/role.ts`) is used identically and correctly in both `DecisionRail` and `ReviewDecisionPanel` (both correctly documented as presentation-only, server `_require_editor` authoritative). `revision_mismatch`/`span_not_resolved`/`cost_cap_exceeded` are branched on consistently everywhere they're used (`SectionEditorPanel.tsx`, `AnnotationMark.tsx`, `RevisionFlow.tsx`). `schedule_in_past` is handled correctly in `SchedulePublishDialog.tsx`. `forbidden_role`, `run_in_progress`, `not_due`, `budget_projection_exceeds_cap` have no dedicated client branch anywhere, but every call site uses the same generic `e instanceof Error ? e.message : ...` fallback pattern with a server-supplied legible `message` string — that pattern works (unlike 1a, these screens don't also have a stale *enablement* gate sitting in front of the action), so it is not flagged as a defect, just noted as the same "no special-cased copy" pattern that made 1a's failure mode possible in the first place.

### Q2. Duplicated/competing flows

Enumerated by action, with the endpoint each surface calls:

| Action | Endpoint | Surfaces that can trigger it |
|---|---|---|
| Publish now | `POST /issues/{run_id}/publish` | `DecisionRail` (Approval stage, correct gate) **and** `ReviewDecisionPanel` (legacy, stale gate) — same endpoint, two UIs with disagreeing client-side enablement logic (Q1a) |
| Publish (recovery) | `POST /issues/{run_id}/publish-manual` | `RecoveryRail` only — but converges on the same `_run_publisher` call `publish_issue` and the Sanity webhook use, with no sign-off check (Q1b) |
| Publish (Studio bypass, safe) | Sanity `weeklyIssue.status → published` flip → webhook | Sanity Studio (`SANITY_STUDIO_DISABLE_PUBLISH` default OFF — flag not yet flipped, per 34-06-SUMMARY.md) → but the webhook's D-07 re-check blocks + reverts + audits + alerts if either sign-off is missing, so this path is confirmed **safe**, just still live as a fourth code path into `_run_publisher` |
| Schedule for later | `POST /issues/{run_id}/schedule` | **`ReviewDecisionPanel`/`SchedulePublishDialog` only** — grep-confirmed zero usage anywhere in `review-desk/` or the Issue Workspace. The correct, sign-off-gated `DecisionRail` (Approval stage) has no Schedule action at all. |
| Hold / Reject run | `POST /issues/{run_id}/reject` | `DecisionRail` ("Hold" button, `handleHold`) **and** `ReviewDecisionPanel` ("Reject Run" button) — same endpoint, same (ungated — "always allowed") server behavior, but described to the operator in **contradictory terms** on the two screens (see Copywriting findings) |
| Re-run a section | `rerollAgent` / `POST /issues/{run_id}/agents/{key}/rerun` | `DecisionRail`, `ReviewDecisionPanel`, `RecoveryRail`, `RerollButton`/`WriterExpansion` (graph view) — four surfaces, but this action has no gate to drift (always available), so the duplication is low-risk, just visually redundant |

Four of six action families exist on more than one surface. Re-run's duplication is benign (no gate exists to drift). Publish and Schedule are not: Publish now has *two* client gates that can disagree (Q1a) and a fourth path with no gate at all (Q1b); Schedule exists in exactly one place, and that place is the broken one.

### Q3. Discoverability of the review→publish path

The **correct** path is real, well-built, and is in fact the default landing page: `/` → redirect → `/issues` (`app/(dashboard)/page.tsx`), which shows one focal `IssueCard` with a 5-segment `StageStrip` (Story/Draft/Fact Check/Voice/**Approval**) whose icon flips to a vermilion `AlertTriangle` + "Needs you" the moment a sign-off is outstanding (`lib/derivedState.ts:214-221` `deriveApprovalStage`), plus a "My Tasks" projection that links straight to `issueApprovalHref(n)` for exactly this task (`derivedState.ts:460-483`). Once inside `/issues/[n]`, the workspace frame's stage tabs make Approval one click away and impossible to miss (`issues/[issueNumber]/layout.tsx:242-280`). Taken in isolation, this is a genuinely good design.

The problem is that it is **not the only plausible entry point, and it is not the more visually prominent one.** Run Monitor never left the top-level nav (`lib/nav.ts:73-79`, labeled **"Run Details"** per the Phase 50 nomenclature pass, `lib/nomenclature.ts:33`) — a label an operator checking on a stuck weekly issue would reasonably click. Its default landing page, `/run-monitor/runs` (`run-monitor/page.tsx` redirects here), renders `ReviewQueue` (`run-monitor/runs/page.tsx:20,31`) **above** the run history table: an amber-bordered "Awaiting Review" box, one card per stuck run, each with a black `min-h-[44px]` **"Review →"** button (`ReviewQueue.tsx:62-105`) linking directly to `/run-monitor/runs/{runId}/review` — the broken surface. Compare that to the correct path's affordance: a small "Open issue" text link inside a 6-column readout grid on the Issues-home card (`IssueCard.tsx:162-169`). The broken path is objectively the more prominent, more action-shaped, more "this is clearly what I click next" affordance of the two. This matches the incident narrative (an operator who gave up after three failed Publish clicks) far better than it contradicts it — the dashboard's nav and layout make the wrong door the more obvious one to walk through.

### Q4. Dead ends generally

- **The headline one:** `ReviewDecisionPanel` renders "Approve and Publish" enabled, the click 409s, and the screen has no sign-off affordance to resolve it with (Q1a). This is the confirmed dead end.
- **A related non-dead-end that is arguably worse:** `publish_manual` (Q1b) doesn't fail — it can silently *succeed* over a revoked sign-off. A false negative you can't unstick is bad; a false positive that ships unattested content and tells the operator nothing was wrong is worse, even though it isn't literally a "dead end."
- **Schedule for later has no working home** on the current surface (Q2) — not a dead end in the sense of a broken click, but a capability gap that pushes operators back toward the broken screen if they ever need it.
- No other unresolvable action was found. Every other 409/error path this audit traced (`revision_mismatch`, `span_not_resolved`, `cost_cap_exceeded`, `schedule_in_past`, `forbidden_role`) resolves to a legible, actionable message on a screen that also has the control needed to act on it (reload-and-retry, wait for cost cap, pick a future time, etc.).

---

## Top 3 Priority Fixes

1. **Retire (redirect) the legacy `/run-monitor/runs/[runId]/review` surface — this is the live incident.** `ReviewDecisionPanel.tsx`'s Approve-and-Publish gate (`claimChecks.allSignedOff`) disagrees with what `publish_issue` actually enforces (`signOffs:activeByRunId`), and the panel has no sign-off controls at all. Concrete fix: turn `run-monitor/runs/[runId]/review/page.tsx` into a server-side redirect to `/issues/[n]/approval`, exactly mirroring the pattern already shipped for `/review-desk/[runId]` and `/voice-pass/[runId]` (`legacyRedirectTarget`, `lib/issueRouteResolver.ts:71-77` — resolve `runId → issueNumber` via `pipelineRuns.byRunId`, then redirect). Delete `ReviewDecisionPanel.tsx`'s publish/schedule logic in the same change. Until that ships, at minimum remove the "Review →" CTA from `ReviewQueue.tsx` (or repoint it at `issueApprovalHref`) so the more prominent path stops leading to the dead end. **Impact: unblocks the three issues stuck in `awaiting-review` since 2026-07-08 and prevents recurrence next Thursday.**

2. **Add the sign-off gate to `POST /issues/{run_id}/publish-manual`.** `control.py:855-925` calls `_run_publisher` directly with no `signOffs:activeByRunId` check, unlike every other path to the same function. Concrete fix: insert the identical `missing` / `missing_signoffs` 409 check from `review.py:118-133` before scheduling the publisher task. **Impact: closes a second, independently-found route to publishing unattested content — currently safe only because of a timing assumption (edit-then-revoke-then-restart) that the codebase's own D-08 design explicitly anticipates as a real sequence.**

3. **Give the Approval stage a "Schedule for later" action, or explicitly retire scheduling.** `scheduleIssue`/`SchedulePublishDialog` exist only inside the surface being retired in fix #1. Concrete fix: port the dialog into `DecisionRail.tsx`'s Actions section (it already has the `factsActive`/`humanActive`/`held` state needed to gate it identically to Publish), or, if scheduling is being deliberately dropped, remove the dead `scheduleIssue` client/endpoint pairing and say so in `docs/API_CONTRACTS.md`. **Impact: without this, fix #1 removes the only working path to a real, documented capability (`POST /issues/{run_id}/schedule`, `review.py:190-280`).**

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

**Strengths (Editorial/current surfaces):** the codebase has a genuinely disciplined, consistently-applied "never blank / affirmative state" convention — `IssueCard.tsx:96-115` (structural "State unknown — refresh," never a stale label), `DecisionRail.tsx:486-513` ("Facts cleared — signed {N}m ago" vs. an explicit "Sign: Facts cleared" button, never a blank row), `ApprovalPanelContent.tsx:69-86` (same discipline duplicated deliberately, by design, for the context panel). No generic `Submit`/`OK`/`Click Here` labels found anywhere (`grep` for the standard generic-label set returned zero hits app-wide).

**Deductions:**
- The single highest-stakes button in the app, "Approve and Publish" (`ReviewDecisionPanel.tsx:193`), no longer accurately describes what the endpoint requires — it implies a claims-checklist gate that hasn't governed publish since Phase 34. Its error copy ("Sign off all factual claims before publishing," `ReviewDecisionPanel.tsx:96`) is shown for a condition (`claims_not_signed_off`) the endpoint can no longer produce; the condition it actually 409s on (`missing_signoffs`) has no bespoke copy at all on this screen.
- `reviewClient.ts:8,108-109,133` — the shared client's own docstring still documents the pre-Phase-34 contract ("On 409 `claims_not_signed_off`: ... 'Sign off all factual claims before publishing.'"), which is stale and would mislead the next engineer who reads it before touching this code, as apparently happened here.
- The **same** `rejectIssue` endpoint is narrated with contradictory implications on the two surfaces: `DecisionRail.tsx:278` — "Run held — it stays awaiting review" (temporary, low-stakes framing, matching the Phase 33/41 "held" terminology) vs. `ReviewDecisionPanel.tsx:130,240-243` — "Reject this run?" / "Run rejected. It will remain in the history log... but will not publish" (final, adversarial framing). An operator who uses both screens across sessions is being told two different things about what the same click does.

### Pillar 2: Visuals (3/4)

**Strengths:** the Issues-home page has an unambiguous single focal point (`IssueCard`, with the empty-state deliberately inverting focus to `CreatePanel` per `40-UI-SPEC.md`'s explicit "Visual Hierarchy" resolution). Icon+label pairing is a hard rule in the modern surfaces, not a convention that's sometimes honored: `StageStrip.tsx` and the workspace frame's `StageTabIcon` (`layout.tsx:90-121`) both carry an explicit comment that the "in-progress" spinner icon is reserved exclusively for System Activity and is a *static* `CircleDot` here specifically so it "can never be mistaken for a live system-activity readout" — genuine, deliberate visual-hierarchy discipline, not an accident.

**Deduction:** the app visibly contains two design eras. The Editorial surfaces (Issues home, Issue Workspace, review-desk galley, signal-desk, story-brief, voice-pass) use `rounded-[2px]` square corners, CSS custom properties (`var(--color-ink)`, `var(--color-rail)`, etc.), and a bespoke micro-type scale. The System Workbench surfaces (all of `run-monitor/`, plus `prompt-lab/`, `registry/`) still use `rounded-md`/`rounded-lg`, Tailwind's default `neutral-*` palette, and default text sizes — 41 files under `run-monitor/`+`prompt-lab/`+`registry/` use `neutral-*` classes (grep-confirmed) against 87 files elsewhere using `var(--color-*)` tokens. This is defensible as "System Workbench is explicitly the machine-debugging zone, not the polished magazine tool" (per `lib/nav.ts`'s own header comment) — but it means the one screen that most needed a visual "you have left the safe tool" signal (the legacy review panel, since it behaves like a different, older product) instead looks like a completely normal, trustworthy, black-button primary-action screen. The visual inconsistency, if anything, makes the trap more convincing rather than less.

### Pillar 3: Color (3/4)

Modern surfaces apply a small, consistent semantic set: vermilion for blockers/errors/destructive states, green for cleared/signed-off/affirmative states, marigold for in-progress — applied identically across `DecisionRail.tsx`, `StageStrip.tsx`, `IssueCard.tsx`, the workspace frame. Hardcoded hex fallbacks (`var(--color-green,#148a52)`, `var(--color-cobalt,#253ad4)`) are used defensively alongside the CSS variables, not as an alternative system.

The legacy zone uses its own, uncoordinated Tailwind palette instead — `bg-yellow-100 text-yellow-800` for "awaiting-review" badges (`ReviewDecisionPanel.tsx`'s sibling `RunDetail.tsx:81`, `RunsTable.tsx:43`), `bg-red-50 border-red-200 text-red-700` for error feedback, `bg-green-50 border-green-200` for success (`ReviewDecisionPanel.tsx:168-176`), `bg-amber-50 border-amber-200` for the Awaiting Review queue (`ReviewQueue.tsx:62`). None of it is broken in isolation, but none of it maps onto the same semantic tokens the rest of the app uses, so "amber = needs attention" in Run Monitor and "marigold = in progress" in the Issue Workspace are two different vocabularies an operator has to learn are the same concept.

### Pillar 4: Typography (3/4)

Distinct font-size utility count app-wide: Tailwind-scale classes (`text-xs` through `text-3xl`, 504 uses across ~85 files) run in parallel with a bespoke bracket-pixel scale (`text-[9px]` through `text-[34px]`, ~21 distinct values, ~403 uses across 74 files, e.g. the shared `MICRO_LABEL` constant in `DecisionRail.tsx:149-150`: `text-[10px] font-semibold uppercase tracking-[.09em]`). Font-weight usage is well-contained overall (`font-semibold`: 251, `font-medium`: 191, `font-normal`: 7, `font-bold`: 2 — effectively a 2-weight system with rare exceptions), which is good discipline for an operator console.

By the abstract ">4 sizes" standard this would flag, but the bracket-pixel values read as an intentional, named micro-type scale (every phase touching it references "1c"/"Dispatch Control v3" design tokens, and the values recur identically across components rather than being invented ad hoc per file) — this is a coherent system, just a second one, coexisting with unmigrated Tailwind-default text sizing in the System Workbench zone (`ReviewDecisionPanel.tsx` uses plain `text-sm`/`text-base`/`text-xs` throughout, no bracket values at all). Same split as Color and Visuals: internally consistent per zone, inconsistent across the app as a whole.

### Pillar 5: Spacing (4/4)

No evidence of sloppy/arbitrary spacing. The standard Tailwind spacing scale (`p-4`, `gap-2`, `py-3`, `px-3`, etc.) dominates every surface old and new. The arbitrary bracket values that do exist are few (`gap-[6px]` ×18, `px-[9px]`/`py-[3px]` ×6 each, a handful of ×1-2 singletons) and concentrated in exactly the shared layout primitives that need pixel-level control for icon+label row alignment (`StageStrip.tsx`, the workspace frame's stage tabs) — a deliberate, load-bearing choice, not noise. The `min-h-[44px]` touch-target convention is applied with genuine uniformity across both design eras — every button audited in this review, including every one on the legacy `ReviewDecisionPanel`, honors it.

### Pillar 6: Experience Design (1/4)

This score is dominated by one fact: **the dashboard's core job — take a reviewed issue from `awaiting-review` to `published` — has a live, traced, currently-unresolved failure mode**, plus a second related gap found independently by this audit. See the Primary Audit Questions section above for the full evidence chain (file:line citations for the stale gate, the dead reason-branch, the more-prominent broken entry point, and the ungated `publish-manual` bridge). Per this audit's explicit instructions, Experience Design is weighted heavily precisely because good visuals cannot offset a dashboard that cannot complete its own reason for existing — and this one currently cannot, for at least three real issues sitting in `awaiting-review` since 2026-07-08.

This is not the whole story for the pillar, and it would be unfair to pretend otherwise: loading states are handled everywhere queried data is `undefined` (structural, not incidental — `IssueCard`, `DecisionRail`'s every section, `ApprovalPanelContent`), empty states are always explicit text (never a blank div), destructive actions get inline two-step confirms (`ReviewDecisionPanel`'s Reject/Re-roll panels, `RecoveryRail`'s `window.confirm`), and the role gate is implemented once and reused correctly everywhere it appears. None of that offsets a confirmed dead end on the single most consequential action in the product, which is why this pillar scores far below the others rather than averaging out.

---

## Files Audited

**Design intent (read in full or in relevant part):**
- `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-CONTEXT.md`, `34-06-rail-signoffs-studio-retirement-PLAN.md`, `34-06-SUMMARY.md`, `34-VERIFICATION.md`
- `.planning/phases/26-review-gate-charity-registry/26-UI-SPEC.md`
- `.planning/phases/40-issue-entity-issues-home/40-UI-SPEC.md`
- `.planning/phases/41-issue-workspace-frame/` (dir listing; layout/frame cross-checked against implementation)
- `.planning/phases/49-roles-permissions/`, `.planning/phases/50-workbench-nomenclature/` (dir listings; `lib/role.ts` and `lib/nomenclature.ts` cross-checked)
- `CLAUDE.md`

**Implementation — routes, components, clients:**
- `apps/dispatch-control/lib/nav.ts`, `lib/nomenclature.ts`, `lib/role.ts`, `lib/issueRouteResolver.ts`, `lib/derivedState.ts`, `lib/reviewClient.ts`, `lib/signOffClient.ts`
- `apps/dispatch-control/app/(dashboard)/layout.tsx`, `page.tsx`
- `apps/dispatch-control/app/(dashboard)/issues/page.tsx`, `_components/IssueCard.tsx`, `_components/StageStrip.tsx`, `[issueNumber]/layout.tsx`, `[issueNumber]/page.tsx`, `[issueNumber]/review/page.tsx`, `[issueNumber]/approval/page.tsx`, `[issueNumber]/approval/ApprovalStage.tsx`, `[issueNumber]/approval/ApprovalPanelContent.tsx`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx`, `ReviewDeskRunView.tsx`, `_components/DecisionRail.tsx`
- `apps/dispatch-control/app/(dashboard)/run-monitor/page.tsx`, `runs/page.tsx`, `runs/_components/ReviewQueue.tsx`, `runs/_components/RunDetail.tsx`, `runs/_components/RecoveryRail.tsx`, `runs/[runId]/review/page.tsx`, `runs/[runId]/review/_components/ReviewDecisionPanel.tsx`
- `apps/dispatch-control/app/(dashboard)/issues/_components/HoldDialog.tsx` (partial)
- `apps/dispatch-control/components.json`

**Implementation — pipeline (server-side gate source of truth):**
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py` (full — `publish_issue`, `schedule_issue`)
- `packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` (full — `record_sign_off`)
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` (`publish_manual`, `adjudicate` region)
- `packages/pipeline/src/eisenbalm_pipeline/api/content.py`, `findings.py`, `revision.py`, `brief.py` (reason-vocabulary grep only)

**Grep sweeps (whole-app, `apps/dispatch-control/app` + `components`):** font sizes/weights, spacing classes, hardcoded hex colors, `neutral-*` usage, generic copy labels, error/loading/empty-state patterns, and the full 409-reason vocabulary (`wrong_status`, `missing_signoffs`, `no_sanity_issue`, `claims_not_signed_off`, `open_error_findings`, `open_voice_findings`, `schedule_in_past`, `revision_mismatch`, `span_not_resolved`, `cost_cap_exceeded`, `forbidden_role`, `run_in_progress`, `not_due`, `budget_projection_exceeds_cap`) across every client file.
