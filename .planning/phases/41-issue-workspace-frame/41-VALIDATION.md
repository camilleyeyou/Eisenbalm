---
phase: 41
slug: issue-workspace-frame
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-14
---

# Phase 41 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 41-RESEARCH.md §Validation Architecture (HIGH confidence — mapped against the 62 existing `apps/dispatch-control/__tests__/*.test.{ts,tsx}` files).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`vitest run`) + `@testing-library/react`, jsdom env for `.test.tsx` |
| **Config file** | `apps/dispatch-control/vitest.config.ts` (existing — active, 62 test files) |
| **Quick run command** | `pnpm --filter dispatch-control test -- <pattern>` |
| **Full suite command** | `pnpm --filter dispatch-control test` **then** `pnpm --filter dispatch-control build` |
| **Estimated runtime** | ~30–60 seconds (suite) + build |

> ⚠️ **Vitest does NOT type-check.** Per project memory ([[run-strict-build-before-frontend-phase-done]]), a strict `pnpm --filter dispatch-control build` MUST pass before this phase is declared done — two latent bugs shipped in Phase 27 by skipping it. Any phase touching `convex/*.ts` also requires a live sync (`pnpm --filter @eisenbalm/convex dev:once`) per [[convex-functions-need-live-sync]].

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter dispatch-control test -- <file touched>`
- **After every plan wave:** Run `pnpm --filter dispatch-control test` (full suite) + `pnpm --filter dispatch-control build`
- **Before `/gsd:verify-work`:** Full suite green AND `build` green
- **Max feedback latency:** ~60 seconds (per-file quick run)

---

## Per-Task Verification Map

*(Requirement → behavior → test. Task IDs assigned by the planner; this maps requirements to their proving test.)*

| Plan area | Wave | Requirement | Behavior | Test Type | Automated Command | File Exists |
|-----------|------|-------------|----------|-----------|-------------------|-------------|
| Nav | 1 | WSP-01 | Nav shows one "Issue Workspace" item, not the three old desk items | unit (structural) | `pnpm --filter dispatch-control test -- nav.test.ts` | ✅ extend `nav.test.ts` |
| Frame/tabs | 2 | WSP-01 | Stage tabs render with live status marks matching `deriveStageStates` | component | `pnpm --filter dispatch-control test -- WorkspaceLayout.test.tsx` | ❌ W0 |
| Outline selector | 1 | WSP-02 / WSP-07 | New section-level `deriveSectionStates` returns 5-state vocabulary (clean/review/must fix/changed since review/not generated) | unit (pure selector) | `pnpm --filter dispatch-control test -- derivedState.test.ts` | ✅ extend `derivedState.test.ts` |
| Outline UI | 2 | WSP-02 | Outline lists all sections, jumps to section on click | component | `pnpm --filter dispatch-control test -- WorkspaceOutline.test.tsx` | ❌ W0 |
| Context panel | 2 | WSP-03 | Panel shows stage-appropriate content and can be hidden | component | `pnpm --filter dispatch-control test -- ContextPanel.test.tsx` | ❌ W0 |
| Galley claim marks | 2 | WSP-04 | Checked claim shows source on **focus** (not just hover); unchecked claim click navigates to Fact Check | component | `pnpm --filter dispatch-control test -- ClaimMark.test.tsx` | ❌ W0 (no `ClaimMark.test.tsx` exists — pre-existing gap) |
| Approval order | 2 | WSP-05 | Stage 5 renders blockers → readiness board → agent editor's recommendation, in that order; "Agent editor's recommendation" label present | component | `pnpm --filter dispatch-control test -- DecisionRail.test.tsx` | ✅ partial — extend `DecisionRail.test.tsx`; readiness-board test new |
| Publish preview | 2 | WSP-06 | Publish disabled until Must fix=0 ∧ factDone ∧ voiceDone ∧ !held; unlock condition rendered next to control; preview shows destination/title/time/consequences; one click after preview publishes | component | `pnpm --filter dispatch-control test -- PublishPreviewDialog.test.tsx` | ❌ W0 |
| Not-generated state | 1/2 | WSP-07 | "Not generated" renders as Editor's-note block, never blank, in canvas + outline | unit (selector) + component | `pnpm --filter dispatch-control test -- derivedState.test.ts` + component test | ❌ W0 (selector fn new) |

---

## Wave 0 Requirements

Net-new primitives that MUST exist (with their own tests) before the dependent stage/frame work can be built or verified:

- [ ] `lib/derivedState.ts` — new section-level `deriveSectionStates` selector (5-state vocabulary) + extend `derivedState.test.ts` (WSP-02/WSP-07). **Note the research open question:** "changed since review" has no data source in Phase 41 (no content-patch-touch tracking) — the planner must resolve whether it maps to sign-off-revocation / QA re-resolution signal or renders as unreachable-for-now; the selector's test must pin whichever is chosen.
- [ ] `__tests__/ClaimMark.test.tsx` — does not exist today; covers WSP-04 focus-parity + click-through (also closes a pre-existing gap).
- [ ] `convex/issues.ts` `setLastVisitedStage` mutation + test — needed for D-03/D-04 redirect logic (schema field exists, no writer does). Requires live Convex sync after commit.
- [ ] `SignalDeskScreen` additive optional `runId?` prop — needed before Stage 1's issue-keyed wrapper can be tested against a non-latest run (Pitfall 2: verbatim wrapper copy would silently show workspace's latest run).
- [ ] Extend `lib/issueRouteResolver.ts` with stage hrefs (`issueStoryHref`, `issueDraftHref`, `issueFactCheckHref`, `issueApprovalHref`) — **extend the existing `issueRouteResolver.test.ts`, do not create a new file.**

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| End-to-end live demo path (My Tasks → Fact Check leg is Phase 42, so the 41 slice is: Draft select → Voice approve → Approval → Publish preview → confirm; header status/tab marks/publish lock update live) | WSP-01/05/06 | Live Convex reactivity + multi-stage navigation across a real issue is integration-level, not unit | Run the console against dev Convex, walk an in-progress issue through Draft → Voice → Approval, confirm the publish preview shows real destination/title/time and one click publishes; confirm tabs + header update without refresh |
| Publication typography renders correctly in the galley canvas (WSP-04 visual) | WSP-04 | Font/measure/wash rendering is visual, not assertable in jsdom | Load Stage 2 Draft, confirm marigold underlines on checked claims + rust tint on unchecked, popover on hover AND Tab-focus |

---

## Validation Sign-Off

- [ ] All tasks have an automated verify command or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test references (5 items above)
- [ ] No watch-mode flags (`vitest run`, never `vitest` watch)
- [ ] Feedback latency < 60s per-file
- [ ] `nyquist_compliant: true` set in frontmatter (set by planner once every task maps to a verify)

**Approval:** pending
