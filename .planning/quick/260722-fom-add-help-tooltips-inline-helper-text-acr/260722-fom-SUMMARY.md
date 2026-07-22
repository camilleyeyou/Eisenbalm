---
phase: quick-260722-fom
plan: 01
subsystem: ui
tags: [dispatch-control, help, tooltips, a11y, onboarding, vitest, nextjs]

# Dependency graph
requires:
  - phase: quick-260721-qdx
    provides: "Onboarding layer (tour + StageHintStrip + onboardingCopy.ts precedent) that HelpTips complement at element level"
  - phase: quick-260722-f2c
    provides: "Plain-language label baseline on the Gate-1 decision card (de-jargon precedent, Phase 47 D-07)"
  - phase: quick-260721-pmn
    provides: "WorkspaceStateProvider identity-stability fix + the guardrail HelpTip usage must honor (no setPanelContent routing)"
provides:
  - "Reusable accessible HelpTip primitive (components/ui/HelpTip.tsx): ? icon, hover + focus + tap toggle, Escape close, aria-describedby, 44px touch target, viewport-safe popover, no new npm dependency"
  - "Centralized help copy module (components/help/helpCopy.ts) — every tooltip and inline-helper string keyed by rendering surface, reviewable/editable in one place"
  - "Curated-density help across 15 operator surfaces: issues home, workspace frame, story brief (decision card + lead actions), fact check, voice pass rail, approval decision rail, signal desk, run monitor (runs table + recovery rail), prompt lab version history, notification settings"
  - "Inline always-visible helper sentences (not hidden tooltips) on consequential actions: Hold/Reopen, Remove lead, Publish"
affects: [dispatch-control, issues, story-brief, signal-desk, run-monitor, prompt-lab, review-desk, voice-pass, settings]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hybrid help model: HelpTip ? for non-obvious headers/readouts; inline visible helper text for consequential actions; StageHintStrip remains the stage-level layer — three distinct help altitudes, no duplication"
    - "All help strings live in components/help/helpCopy.ts as module constants — HelpTip receives only static string props (identity-stable by construction, honors the 260721-pmn guardrail)"

key-files:
  created:
    - "apps/dispatch-control/components/ui/HelpTip.tsx"
    - "apps/dispatch-control/components/help/helpCopy.ts"
    - "apps/dispatch-control/__tests__/HelpTip.test.tsx"
  modified:
    - "apps/dispatch-control/app/(dashboard)/issues/_components/IssueCard.tsx"
    - "apps/dispatch-control/app/(dashboard)/issues/_components/ScheduledSlotCard.tsx"
    - "apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx"
    - "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx"
    - "apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx"
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/NeedsYourDecisionCard.tsx"
    - "apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadActions.tsx"
    - "apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx"
    - "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx"
    - "apps/dispatch-control/app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx"
    - "apps/dispatch-control/app/(dashboard)/signal-desk/_components/CandidateSlate.tsx"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunsTable.tsx"
    - "apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx"
    - "apps/dispatch-control/app/(dashboard)/settings/_components/NotificationSettings.tsx"

key-decisions:
  - "Checker-driven retargeting (plan iteration 2): Voice tips anchor in voice-pass/[runId]/VoicePassRail.tsx (not the null-publisher VoicePanelContent.tsx); Approval tips anchor in review-desk/[runId]/DecisionRail.tsx (not the read-only ApprovalPanelContent.tsx); require/remove-lead copy lives under a storyBrief key targeting LeadActions.tsx — signalDesk copy rewritten to its real adjudicate-resume UX"
  - "No existing test file needed modification — HelpTip buttons are name-scoped (aria-label per tip) so no existing getByRole/getByText query broke; the 3-file HelpTip unit suite was written TDD (RED before implementation)"
  - "Publish, Hold/Reopen, and Remove-lead got always-visible inline helper sentences instead of hover tips — misunderstanding those has consequences, so the explanation must not hide behind hover (mirrors the decision-card 'Saved to the decision log' precedent)"

patterns-established:
  - "New operator-facing help goes through components/help/helpCopy.ts + HelpTip — never ad-hoc title= attributes or one-off popovers"

requirements-completed: [QUICK-260722-FOM]

# Metrics
duration: ~25 min (executor; stalled at SUMMARY step — implementation + gates completed, summary written by orchestrator)
completed: 2026-07-22
commits:
  - "a22bebf feat(quick-260722-fom): add HelpTip primitive + centralized help copy module"
  - "6ffd306 feat(quick-260722-fom): wire help into Editorial weekly-loop surfaces"
  - "8a2593e feat(quick-260722-fom): wire help into stage-control, workbench, and ops surfaces"
---

# Quick Task 260722-fom: Help tooltips + inline helper text across dispatch-control

**One-liner:** A reusable, accessible `?` HelpTip primitive plus a centralized copy module, wired at curated density across all 15 major operator surfaces — hover/focus/tap tooltips for non-obvious readouts, always-visible inline helpers for consequential actions.

## What shipped

1. **`HelpTip` primitive** (`components/ui/HelpTip.tsx`) — in-house, zero new dependencies. Lucide `HelpCircle` icon button; tip opens on hover, keyboard focus, or tap (touch devices have no hover); Escape closes; `aria-describedby` wiring for screen readers; ≥44px touch target per codebase convention; popover clamps at viewport edges without a positioning library; styled entirely with the existing CSS-variable tokens.
2. **`helpCopy.ts`** (`components/help/`) — the single source of truth for every help string, keyed by the surface that actually renders it (issues, workspace, storyBrief, factCheck, voice, approval, signalDesk, runMonitor, promptLab, settings). Plain operator English, one–two sentences each.
3. **15 surfaces wired** at curated density (headers + non-obvious readouts only; self-evident buttons untouched): issue status chips, claim coverage, scheduled slot, workspace status/cost readouts + stage tabs, candidate ranking, lead require/remove, fact-check claim marks, voice machine-tells + sign-offs, approval readiness board + publish, signal-desk adjudication + advocate score, run status column, recovery recommendations, prompt version history + eval-gate override, notification settings.

## Verification

- `HelpTip.test.tsx`: 8 tests covering the 7 required behaviors (hover, focus, tap toggle, Escape, aria-describedby, touch target, viewport clamp) — TDD RED→GREEN.
- Full dispatch-control vitest suite: 135 files, 1081 tests, all passing (re-confirmed independently by the orchestrator after the executor stalled).
- `pnpm --filter dispatch-control build`: compiles + type-checks clean (re-confirmed independently).
- Guardrail held: no HelpTip is routed through `setPanelContent` or given provider-derived unstable props — all usages are static leaf JSX with module-constant strings.

## Deviations

- The executor agent stalled (600s watchdog) after completing all three commits and both gates, before writing this SUMMARY — the orchestrator verified commit/gate state independently and authored the SUMMARY. No code impact.
- No existing tests broke, so the planned test-file updates (9 files listed in Task 3) were unnecessary — HelpTip buttons carry per-tip aria-labels, keeping existing role/text queries unambiguous.
