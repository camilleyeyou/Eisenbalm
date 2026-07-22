---
phase: quick-260722-fom
plan: 01
type: execute
wave: 1
depends_on: []
requirements: [QUICK-260722-fom]
files_modified:
  - apps/dispatch-control/components/ui/HelpTip.tsx
  - apps/dispatch-control/components/help/helpCopy.ts
  - apps/dispatch-control/__tests__/HelpTip.test.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/IssueCard.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/ScheduledSlotCard.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx
  - apps/dispatch-control/__tests__/IssueCard.test.tsx
  - apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx
  - apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx
  - apps/dispatch-control/app/(dashboard)/story-brief/_components/NeedsYourDecisionCard.tsx
  - apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadActions.tsx
  - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx
  - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
  - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunsTable.tsx
  - apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx
  - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx
  - apps/dispatch-control/app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx
  - apps/dispatch-control/app/(dashboard)/signal-desk/_components/CandidateSlate.tsx
  - apps/dispatch-control/app/(dashboard)/settings/_components/NotificationSettings.tsx
  - apps/dispatch-control/__tests__/VoicePassRail.test.tsx
  - apps/dispatch-control/__tests__/VoicePassScreen.test.tsx
  - apps/dispatch-control/__tests__/DecisionRail.test.tsx
  - apps/dispatch-control/__tests__/DecisionRail.roleGate.test.tsx
  - apps/dispatch-control/__tests__/LeadActions.test.tsx
  - apps/dispatch-control/__tests__/AdjudicationPanel.test.tsx
  - apps/dispatch-control/__tests__/CandidateSlate.test.tsx
  - apps/dispatch-control/__tests__/SignalDeskScreen.test.tsx
  - apps/dispatch-control/__tests__/RecoveryRail.test.tsx
autonomous: true

must_haves:
  truths:
    - "A small ? icon button appears on non-obvious section headers and controls across dispatch-control operator surfaces and reveals a one-sentence explanation"
    - "The tip opens on hover, on keyboard focus, and on click/tap toggle (touch devices with no hover can still open it); Escape closes it"
    - "When open the ? button is wired to the tip via aria-describedby (or equivalent) so screen readers announce the explanation"
    - "The ? button meets the codebase min-h-[44px]/min-w-[44px] touch-target convention and the tip does not clip at the viewport edge (simple flip/clamp)"
    - "Critical/consequential actions (publish, sign-offs, choosing a story) carry an always-visible inline helper sentence, not a hidden tooltip"
    - "Every tooltip and inline-helper string lives in one centralized helpCopy module in plain operator English, keyed by surface"
    - "Help is wired to the components that ACTUALLY render each control (VoicePassRail, DecisionRail, LeadActions, AdjudicationPanel) — never a null-rendering panel publisher or a read-only duplicate"
    - "HelpTips are added only to genuinely non-obvious elements — self-evident buttons get nothing, and StageHintStrip stage-level content is neither removed nor duplicated"
    - "No new npm dependency is added; HelpTip uses lucide-react HelpCircle and existing CSS-variable design tokens"
    - "The full dispatch-control vitest suite passes and pnpm --filter dispatch-control build succeeds (Linux/Vercel parity)"
    - "No new unstable-identity prop is introduced into any WorkspaceStateProvider setPanelContent render path"
  artifacts:
    - path: "apps/dispatch-control/components/ui/HelpTip.tsx"
      provides: "Reusable in-house ? help-tip primitive (hover/focus/tap toggle, Escape close, a11y wiring, 44px target, viewport clamp)"
      min_lines: 60
    - path: "apps/dispatch-control/components/help/helpCopy.ts"
      provides: "Centralized surface-keyed help + inline-helper copy (plain data, no JSX)"
      contains: "HELP_COPY"
      min_lines: 40
    - path: "apps/dispatch-control/__tests__/HelpTip.test.tsx"
      provides: "Unit test covering hover, focus, tap-toggle, Escape, and a11y wiring"
      min_lines: 40
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/issues/_components/IssueCard.tsx"
      to: "apps/dispatch-control/components/ui/HelpTip.tsx"
      via: "import HelpTip + HELP_COPY, render as static leaf JSX"
      pattern: "HelpTip"
    - from: "apps/dispatch-control/components/ui/HelpTip.tsx"
      to: "lucide-react HelpCircle"
      via: "icon import"
      pattern: "HelpCircle"
    - from: "surface components"
      to: "apps/dispatch-control/components/help/helpCopy.ts"
      via: "import { HELP_COPY }"
      pattern: "HELP_COPY"
---

<objective>
Add a curated, hybrid help layer across the dispatch-control operator surfaces: a reusable in-house `HelpTip` `?` primitive on genuinely non-obvious headers/controls/readouts, plus always-visible inline helper sentences on the most consequential actions. All copy lives in one centralized, reviewable module in plain operator English.

Purpose: Operators (Andrew + collaborators) can understand any non-obvious control in place, without leaving the page or guessing — element-level help that complements the existing stage-level StageHintStrip, never duplicates it.
Output: A `HelpTip` primitive, a `helpCopy.ts` copy module, a HelpTip unit test, and curated help wired into the Editorial, System Workbench, and Operations surfaces.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

# Precedents to mirror (already read during planning — re-read as needed)
@apps/dispatch-control/components/onboarding/onboardingCopy.ts
@apps/dispatch-control/components/onboarding/StageHintStrip.tsx
@apps/dispatch-control/components/ui/switch.tsx
@apps/dispatch-control/app/(dashboard)/issues/_components/IssueCard.tsx
@apps/dispatch-control/app/(dashboard)/issues/_components/ScheduledSlotCard.tsx
@apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx
@apps/dispatch-control/app/(dashboard)/story-brief/_components/NeedsYourDecisionCard.tsx
@apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadActions.tsx
@apps/dispatch-control/__tests__/StartHereCard.test.tsx

<interfaces>
<!-- Executor: use these directly — no codebase exploration needed. -->

Design tokens (apps/dispatch-control/app/globals.css):
  --color-ink #17140e · --color-ink-soft #55514a · --color-faint #8b8778
  --color-card #ffffff · --color-cobalt #253ad4 · --color-vermilion (focus ring)
  --font-ui (Space Grotesk)

Touch-target + focus convention (verbatim from StageHintStrip.tsx):
  min-h-[44px] min-w-[44px]
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)]

lucide-react (^1.14.0, already a dependency): `HelpCircle` export is CONFIRMED present.

Test conventions (vitest.config.ts):
  - Tests live in `__tests__/*.test.tsx`; `*.test.tsx` glob auto-runs under jsdom.
  - Import: `import { render, screen, cleanup, fireEvent } from '@testing-library/react'`
    and `import { describe, it, expect, afterEach, vi } from 'vitest'` (globals: false).
  - `afterEach(cleanup)`. Path alias `@/` = app root; `@convex/` = convex generated.

Import aliases for wiring:
  import HelpTip from '@/components/ui/HelpTip'
  import { HELP_COPY } from '@/components/help/helpCopy'

Existing inline-helper precedent (NeedsYourDecisionCard.tsx:229-231) — copy an always-visible
sentence styled exactly like:
  <p className="mt-0.5 text-[11px] text-[color:var(--color-ink-soft)]">Saved to the decision log — not published.</p>

CONFIRMED real render targets (checker-corrected — the obvious "stage page/panel" files are wrappers/publishers):
  - Voice galley entry + "Sounds human" sign-off → app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx
      (sections: `<h3>Machine-tells</h3>`, `<h3>Sign-offs</h3>` with the "Sign: Sounds human" button ~line 183).
      NOTE: issues/[issueNumber]/voice/VoicePanelContent.tsx renders null (setPanelContent publisher) — DO NOT target it.
  - Two-sign-off gate + Publish                  → app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
      (`<h3>Readiness board</h3>` ~line 369; "Facts cleared"/"Sounds human" gate; Publish action, "Both sign-offs
      required to publish." ~line 546). NOTE: issues/[issueNumber]/approval/page.tsx is a server wrapper and
      ApprovalPanelContent.tsx is a read-only duplicate — DO NOT target either.
  - Require/remove lead                          → app/(dashboard)/story-brief/_components/LeadActions.tsx
      ("Require this lead" button ~line 82; "Remove — add reason (required)" label ~line 90; "Remove" button ~line 105).
      These POST to the real /issues/{run_id}/leads/{lead_id}/require|remove endpoints. Signal Desk has NO such buttons.
  - Gate-1 adjudication                          → app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx
      (`<h2>` + subtext "Pick a candidate and give a reason to resume the run." ~line 66; `role="radiogroup"` ~line 70;
      "Resume run" button ~line 116).
  - Advocate score readout                       → app/(dashboard)/signal-desk/_components/CandidateSlate.tsx (renders advocateScore).
</interfaces>

<guardrails>
- WorkspaceStateProvider identity-stability trap (quick 260721-pmn/-ohu): HelpTip must be rendered
  as plain STATIC leaf JSX. Its props must be module-constant strings from HELP_COPY — never a
  freshly-constructed object/array/callback. NEVER register HelpTip via a `setPanelContent` effect
  and NEVER add a new prop into any `setPanelContent(...)` effect dependency list.
- Do NOT touch pipeline code, Convex schemas/functions, apps/web, or any internal identifier
  (requiresHumanInput, agent keys, etc.). Operator-facing copy only.
- Do NOT remove or restate StageHintStrip content. HelpTips are element-level; hint strips are
  stage-level. If a stage's non-obvious point is already covered by its StageHintStrip, skip it.
- Curated density: at most 1–2 HelpTips per surface. Self-evident labelled buttons get nothing.
</guardrails>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: HelpTip primitive + centralized helpCopy module + unit test</name>
  <files>apps/dispatch-control/components/ui/HelpTip.tsx, apps/dispatch-control/components/help/helpCopy.ts, apps/dispatch-control/__tests__/HelpTip.test.tsx</files>
  <behavior>
    HelpTip (props: `{ text: string; label?: string; className?: string }`):
    - Test 1: renders a `<button>` with an accessible name (from `label`, default "Help") and a lucide `HelpCircle` icon (aria-hidden); the tip text is NOT in the document initially.
    - Test 2: `fireEvent.mouseEnter(button)` shows the tip (text now queryable via `screen.getByText`).
    - Test 3: `fireEvent.focus(button)` shows the tip (keyboard/touch parity — no hover required).
    - Test 4: clicking the button toggles the tip open→closed→open (tap support for touch devices).
    - Test 5: with the tip open, `fireEvent.keyDown(button, { key: 'Escape' })` closes it.
    - Test 6 (a11y): when open, the button carries `aria-describedby` pointing at the tip element's `id` (assert the id matches and the tip element exists); when closed, `aria-describedby` is absent.
    - Test 7: the button has classes satisfying the touch target (`min-h-[44px]` and `min-w-[44px]`).
  </behavior>
  <action>
    Write the RED test first (`__tests__/HelpTip.test.tsx`) per the behavior block above, using the
    test conventions in <interfaces>. Confirm it fails, then implement to GREEN.

    `components/help/helpCopy.ts` — plain data module (mirror onboardingCopy.ts: `'use client'` NOT
    needed, no JSX side effects). Export `const HELP_COPY = { ... } as const` with the surface-keyed
    strings below. Plain operator/dashboard English (NOT Jesse's editorial voice); each answers
    "what is this / what should I do" in one sentence, two max. Mark inline-helper strings with an
    `// inline` comment so wiring tasks know they render as a visible <p>, not a HelpTip.

    NOTE (revision 1): the require/remove-lead copy lives under the `storyBrief` key (that is the real
    surface for those controls); `signalDesk` copy describes Gate-1 adjudication, which is what that
    surface actually does. Voice/approval STRINGS are unchanged — only their wiring targets moved
    (see Task 3). Keys must match Task 3's wiring exactly.

      issuesHome:
        statusChip:     'Where this issue sits in the weekly loop. "Needs review" means a stage is waiting on you; "Ready to publish" means both sign-offs are cleared.'
        claimCoverage:  'How many factual claims the fact-checkers have resolved. Publishing stays blocked until every claim is verified or dismissed.'
        scheduledSlot:  'The next issue number, already reserved. "Start early" kicks off its pipeline run now instead of waiting for the Thursday schedule.'
      workspace:
        statusReadout:  'The issue\'s overall state. "State unknown — refresh" means the live data dropped — reload to re-sync.'
        costBudget:     'Spend so far on this run versus the budget cap. Nearing the cap is a heads-up, not a hard stop.'
        stageTabs:      'Each stage shows its own state — not started, in progress, needs you, or clean. Work them left to right.'
        hold:           'Pause this issue so the pipeline stops advancing it. Nothing is lost — Reopen resumes where it left off.'   // inline (Hold/Reopen area)
      story:
        ranking:        'The agents ranked candidates by advocate score. These are the top two — pick one, or steer to a different lead.'
      storyBrief:
        leadRequire:    'Require this lead — force the pipeline to run it regardless of the agents\' ranking.'
        leadRemove:     'Remove this lead from consideration, with a reason. The reason is written to the decision log and the pipeline won\'t pick it.'   // inline OR tip (executor's call)
      factCheck:
        claimMark:      'Mark each claim Verified or Dismissed. Anything left as an error blocks publishing.'
      voice:
        galley:         'Open machine-tells jump into the draft to fix. Edit in the galley and re-check — the sign-off stays blocked until they\'re cleared.'
        soundsHuman:    'Mark it "Sounds human" once the voice reads clean — one of the two sign-offs Approval requires.'
      approval:
        twoSignOff:     'Publishing needs both greens: Facts cleared (every claim resolved) and Sounds human (voice signed off).'
        publish:        'Publishing pushes the issue live to the public site. Collaborators can review and comment, not publish.'   // inline
      runMonitor:
        runState:       'The pipeline run\'s live state — running, awaiting your review, complete, or failed.'
        recovery:       'When a run fails, this rail shows where it broke and the two ways to recover: restart from the failed step, or adjudicate manually.'
      promptLab:
        activate:       'Make this saved version the one the pipeline uses on the next run. "Restore" activates an older version.'
        evalGate:       'A version must pass evals before it can go active — run them here, or override with a reason if you\'re sure.'
      signalDesk:
        adjudicate:     'The run is paused for a Gate-1 call. Pick a candidate and give a reason — submitting resumes the run with that charity.'
        advocateScore:  'The advocate agent\'s score for how strong a story this candidate makes — higher is a stronger case, not a ranking you\'re bound to.'
      settings:
        notifications:  'Choose which run events notify you, and on which channel. Applies to every issue.'

    `components/ui/HelpTip.tsx` — `'use client'` in-house primitive (NO new dependency; mirror the
    switch.tsx forwardRef style loosely but this is a small stateful component):
    - Root is `<span className="relative inline-flex ...">` wrapping the button + conditionally
      rendered tip.
    - `<button type="button">` with lucide `HelpCircle` (size ~15, aria-hidden), `aria-label={label ?? 'Help'}`,
      `min-h-[44px] min-w-[44px]` inline-flex centered, and the vermilion focus-visible ring from
      <interfaces>. Wire: `onMouseEnter`/`onFocus` → open; `onMouseLeave`/`onBlur` → close;
      `onClick` → toggle; `onKeyDown` Escape → close.
    - Tip element: rendered only when open, with a stable `id` (React `useId()`), `role="tooltip"`,
      absolute-positioned popover styled with tokens (bg var(--color-card), 1px var(--color-faint)
      border, var(--color-ink) text, var(--font-ui), text-[12.5px], small shadow, max-w-[240px],
      z-index above siblings). Button gets `aria-describedby={open ? tipId : undefined}`.
    - Viewport clamp (best-effort, static-safe): a `useLayoutEffect` reads the tip's
      `getBoundingClientRect()` on open and flips horizontal alignment (left vs right anchored) if it
      would overflow `window.innerWidth`; default to right-of-icon. jsdom returns zero rects — the
      effect must no-op safely there (guard on `typeof window` / rect width 0). This must NOT throw
      in the test environment.
    - Default export.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- HelpTip</automated>
    <automated>pnpm --filter dispatch-control typecheck</automated>
  </verify>
  <done>HelpTip.test.tsx passes all 7 behaviors; HelpTip renders as static leaf JSX with 44px target, token styling, Escape-close, and aria-describedby wiring; HELP_COPY exports every surface key (incl. storyBrief.leadRequire/leadRemove + signalDesk.adjudicate/advocateScore); typecheck clean.</done>
</task>

<task type="auto">
  <name>Task 2: Wire help into the Editorial weekly-loop surfaces (issues home + workspace frame + Hold/Reopen)</name>
  <files>apps/dispatch-control/app/(dashboard)/issues/_components/IssueCard.tsx, apps/dispatch-control/app/(dashboard)/issues/_components/ScheduledSlotCard.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx, apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx, apps/dispatch-control/__tests__/IssueCard.test.tsx, apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx, apps/dispatch-control/__tests__/FrameChromeCostReadout.test.tsx</files>
  <action>
    Curated additions only (1–2 per surface). Import `HelpTip` from `@/components/ui/HelpTip` and
    `HELP_COPY` from `@/components/help/helpCopy`. Render HelpTip as static leaf JSX beside the
    existing label/heading text (e.g. inside the `<span>` or next to the readout label). Do NOT change
    any existing test-ids, layout structure, control behavior, or copy that is already there.

    - IssueCard.tsx: add `<HelpTip>` next to (a) the status chip (statusMeta.label span, ~line 143-149)
      using `HELP_COPY.issuesHome.statusChip`, and (b) the "Claim coverage" Readout label using
      `HELP_COPY.issuesHome.claimCoverage`. Leave Open tasks / Voice / Est. work / Run cost / Open
      issue alone (self-evident). The `Readout` label is deep inside a shared component — either pass
      an optional `help?: string` prop through `Readout` OR wrap only the claim-coverage label; keep
      it minimal and typed.
    - ScheduledSlotCard.tsx: add one `<HelpTip>` next to the "Scheduled" chip (or the h2) using
      `HELP_COPY.issuesHome.scheduledSlot`. Leave "Start #{n} early" as-is (labelled action).
    - issues/[issueNumber]/layout.tsx (FrameChrome): add `<HelpTip>` next to (a) `<StatusReadout>`
      using `HELP_COPY.workspace.statusReadout`, (b) `<CostBudgetReadout>` using
      `HELP_COPY.workspace.costBudget`, and (c) the stage-tabs `<nav aria-label="Workspace stages">`
      — a single HelpTip near the nav (e.g. in a small header above/beside it), NOT one per tab —
      using `HELP_COPY.workspace.stageTabs`. Keep these as static JSX in FrameChrome's return; do not
      route any of them through `setPanelContent`.
    - WorkspaceControls.tsx: read the file first. Add the always-visible INLINE helper sentence
      (`HELP_COPY.workspace.hold`, marked `// inline`) near the Hold/Reopen control, styled like the
      NeedsYourDecisionCard precedent `<p className="... text-[11px] text-[color:var(--color-ink-soft)]">`.
      A HelpTip on the control is also acceptable if inline reads awkward — pick one, not both.

    Test updates: run the three named test files; update ONLY assertions that break because of new
    DOM (e.g. a `getByRole('button')` that now matches an extra HelpTip button → scope with an
    accessible name, or use `getByRole('button', { name: ... })`). Do not weaken existing behavioral
    assertions. If a test uses `getAllByRole` counts, adjust intentionally and comment why.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- IssueCard WorkspaceLayout FrameChromeCostReadout</automated>
    <automated>pnpm --filter dispatch-control typecheck</automated>
  </verify>
  <done>Status chip + claim coverage (IssueCard), scheduled slot, workspace status/cost/stage-tabs readouts each carry a HelpTip; Hold/Reopen carries an inline helper; the three touched test files pass; no setPanelContent path gained a new prop; typecheck clean.</done>
</task>

<task type="auto">
  <name>Task 3: Wire help into the real stage-control surfaces + System Workbench + Operations, then full gate</name>
  <files>apps/dispatch-control/app/(dashboard)/story-brief/_components/NeedsYourDecisionCard.tsx, apps/dispatch-control/app/(dashboard)/story-brief/_components/LeadActions.tsx, apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/fact-check/FactCheckScreen.tsx, apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx, apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RunsTable.tsx, apps/dispatch-control/app/(dashboard)/run-monitor/runs/_components/RecoveryRail.tsx, apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VersionHistoryPanel.tsx, apps/dispatch-control/app/(dashboard)/signal-desk/_components/AdjudicationPanel.tsx, apps/dispatch-control/app/(dashboard)/signal-desk/_components/CandidateSlate.tsx, apps/dispatch-control/app/(dashboard)/settings/_components/NotificationSettings.tsx, apps/dispatch-control/__tests__/VoicePassRail.test.tsx, apps/dispatch-control/__tests__/VoicePassScreen.test.tsx, apps/dispatch-control/__tests__/DecisionRail.test.tsx, apps/dispatch-control/__tests__/DecisionRail.roleGate.test.tsx, apps/dispatch-control/__tests__/LeadActions.test.tsx, apps/dispatch-control/__tests__/AdjudicationPanel.test.tsx, apps/dispatch-control/__tests__/CandidateSlate.test.tsx, apps/dispatch-control/__tests__/SignalDeskScreen.test.tsx, apps/dispatch-control/__tests__/RecoveryRail.test.tsx</files>
  <action>
    Read each file before editing. Curated additions only (1–2 per surface), static leaf JSX,
    `HELP_COPY` strings. Respect the guardrails — do not duplicate StageHintStrip points, do not alter
    any gate/publish/resume logic, do not change existing test-ids.

    STORY / STORY BRIEF:
    - NeedsYourDecisionCard.tsx: this card already has strong inline copy — add ONLY one `<HelpTip>`
      beside the "Needs your decision" h2 or the radiogroup label, using `HELP_COPY.story.ranking`.
    - LeadActions.tsx (the REAL require/remove-lead surface — POSTs to /leads/{id}/require|remove):
      add `<HelpTip>` on the "Require this lead" button (~line 82) using `HELP_COPY.storyBrief.leadRequire`,
      and on the "Remove — add reason (required)" label (~line 90) using `HELP_COPY.storyBrief.leadRemove`
      (or render leadRemove as the inline `<p>` helper beside the Remove control — executor's call).

    FACT CHECK:
    - FactCheckScreen.tsx: add one `<HelpTip>` on the claims header / claim-mark control area using
      `HELP_COPY.factCheck.claimMark`. Keep it focused on the Verified-vs-Dismissed marks (the voice
      StageHintStrip already says "verify or dismiss each one" — don't restate that).

    VOICE (retargeted — issues/[issueNumber]/voice/VoicePanelContent.tsx renders null; DO NOT touch it):
    - VoicePassRail.tsx: add `<HelpTip>` on the `<h3>Machine-tells</h3>` section header using
      `HELP_COPY.voice.galley`, and on the `<h3>Sign-offs</h3>` header (or the "Sign: Sounds human"
      button, ~line 183) using `HELP_COPY.voice.soundsHuman`.

    APPROVAL (retargeted — approval/page.tsx + ApprovalPanelContent.tsx are wrappers/duplicates; DO NOT touch):
    - DecisionRail.tsx: add a `<HelpTip>` next to the `<h3>Readiness board</h3>` header (~line 369)
      using `HELP_COPY.approval.twoSignOff`, AND an always-visible INLINE helper sentence
      (`HELP_COPY.approval.publish`, `// inline`) beside the Publish affordance (near "Both sign-offs
      required to publish.", ~line 546), styled like the NeedsYourDecisionCard precedent. Do NOT alter
      the `publishDisabled` derivation, `handlePublish`, or the PublishPreviewDialog flow.

    RUN MONITOR:
    - RunsTable.tsx: add one `<HelpTip>` on the "Status" column `<th>` using `HELP_COPY.runMonitor.runState`.
    - RecoveryRail.tsx: add one `<HelpTip>` on the "Recommended recovery" h3 (or the rail heading)
      using `HELP_COPY.runMonitor.recovery`.

    PROMPT LAB:
    - VersionHistoryPanel.tsx: add `<HelpTip>` near the "Make active"/"Restore this version" control
      (`HELP_COPY.promptLab.activate`); if the eval-gate override control is adjacent, add
      `HELP_COPY.promptLab.evalGate` there too (max 2).

    SIGNAL DESK (retargeted — this surface does Gate-1 adjudication, NOT lead require/remove):
    - AdjudicationPanel.tsx: add one `<HelpTip>` on the h2 (~line 62) or the `role="radiogroup"`
      (~line 70) using `HELP_COPY.signalDesk.adjudicate`.
    - CandidateSlate.tsx: add one `<HelpTip>` on the advocate-score readout using
      `HELP_COPY.signalDesk.advocateScore` (skip if the score isn't rendered on a labelled row — keep
      to a single signalDesk tip if so).

    SETTINGS:
    - NotificationSettings.tsx: add one `<HelpTip>` next to the "Notifications" h2 using
      `HELP_COPY.settings.notifications`. Leave the individual channel/event toggles unadorned.

    SKIP: My Tasks and How-to-use pages (self-explanatory / already documented).

    Test updates: the named test files render these components and may break on new DOM. Update ONLY
    assertions that break (scope `getByRole('button'/'radio')` with accessible names; adjust
    `getAllBy*` counts with a comment). Do not weaken behavioral assertions. Search for any other test
    that imports these components if a break surfaces. Then run the FINAL gate.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test</automated>
    <automated>pnpm --filter dispatch-control build</automated>
  </verify>
  <done>Story ranking (NeedsYourDecisionCard), require/remove lead (LeadActions), fact-check marks, voice Machine-tells + Sounds-human (VoicePassRail), approval Readiness board + inline Publish helper (DecisionRail), run-monitor state + recovery, prompt-lab activate, signal-desk adjudicate + advocate score, and settings notifications each carry curated help; the FULL dispatch-control vitest suite passes; pnpm --filter dispatch-control build succeeds; no null-publisher/read-only-duplicate was targeted; no setPanelContent render loop reintroduced.</done>
</task>

</tasks>

<verification>
- HelpTip opens on hover, focus, and tap; Escape closes; aria-describedby links button→tip when open (HelpTip.test.tsx).
- Every wired string resolves from `HELP_COPY` (no inline literals at call sites except the `// inline` <p> helpers).
- Help is attached to the components that actually render each control: VoicePassRail (voice), DecisionRail (approval), LeadActions (require/remove lead), AdjudicationPanel/CandidateSlate (signal desk) — never voice/VoicePanelContent.tsx, approval/page.tsx, or ApprovalPanelContent.tsx.
- `pnpm --filter dispatch-control test` — full suite green.
- `pnpm --filter dispatch-control build` — succeeds (mandatory Linux/Vercel parity per project memory; vitest does not type-check).
- Manual spot-check note for SUMMARY: no HelpTip is registered through a `setPanelContent` effect; all are static leaf JSX.
</verification>

<success_criteria>
- Reusable `HelpTip` primitive exists in `components/ui/`, uses lucide `HelpCircle` + design tokens, no new npm dependency, ≥44px target, viewport-safe, Escape-closable, screen-reader-announced.
- `components/help/helpCopy.ts` is the single source for every tooltip + inline-helper string, keyed by the REAL surface (storyBrief lead controls; signalDesk adjudication), in plain operator English.
- Curated help is wired across Editorial (issues home, workspace frame, Hold/Reopen, story, require/remove lead, fact-check, voice, approval), System Workbench (run monitor, prompt lab, signal desk), and Operations (settings) — 1–2 elements per surface, self-evident controls untouched, StageHintStrip content neither removed nor duplicated.
- Consequential actions (publish, Hold/Reopen) carry always-visible inline helper sentences.
- Full vitest suite passes and `build` succeeds.
</success_criteria>

<output>
After completion, create `.planning/quick/260722-fom-add-help-tooltips-inline-helper-text-acr/260722-fom-SUMMARY.md`
</output>
