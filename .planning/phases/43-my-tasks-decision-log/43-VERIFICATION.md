---
phase: 43-my-tasks-decision-log
verified: 2026-07-15T17:52:54Z
status: human_needed
score: 6/6 must-haves verified (automated); 2 items require live-session human verification
human_verification:
  - test: "Decision Log renders actor as a human/agent name in a live session (TSK-06)"
    expected: "Sign in to dispatch-control with a real Clerk session, perform a reasoned action (Hold with a reason, or mark a charity Do-not-use with a reason), open the Decision log in BOTH mounts (Approval context panel + Workspace persistent 'Decision log' control), and confirm the new row shows a NAME (not a raw Clerk sub), plus reason, action, time, before/after, and issue+run."
    why_human: "Requires a real Clerk-authenticated session and a live Convex users table row — cannot be exercised by static analysis or the vitest/convex-test suite, which mock actor identity."
  - test: "'Superseded' appears after a real section re-roll, never silent disappearance (TSK-05)"
    expected: "With an issue that has an open task on a section, trigger rerun_agent to re-roll that section on a live run. Return to /my-tasks and confirm the task now reads 'superseded' with a link to the new step, rather than dropping off the list."
    why_human: "Requires triggering a real pipeline rerun against a live run and observing session-local React state across a live re-render — the pure predicate (computeSessionStates) is unit-tested, but the end-to-end wiring through a live rerun is not exercised by the automated suite."
---

# Phase 43: My Tasks & Decision Log Verification Report

**Phase Goal:** My Tasks becomes a derived projection over open claims, open findings, and missing sign-offs — no new task store — and every reason-requiring action console-wide writes to one shared Decision log.
**Verified:** 2026-07-15T17:52:54Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (mapped from ROADMAP.md Phase 43 Success Criteria / TSK-01..06)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 (TSK-01) | My Tasks lists every open claim, open finding, and missing sign-off as a derived task, computed as a selector over existing data — not a new tasks table | ✓ VERIFIED | `apps/dispatch-control/lib/derivedState.ts::deriveTasks` (lines 388-471) projects over `qaFindings`, `claimRows`, `signOffs` — no new Convex table added; `MyTasksScreen.tsx` assembles `DerivationInputs` from the SAME queries `Masthead.tsx` uses (`runs.latest` → `pipelineRuns.byRunId` → `issues.byIssueNumber` + `signOffs.activeByRunId`/`claimChecks.listByRunId`/`qaCorrections.byRunId`). No `tasks` table exists in `convex/schema.ts`. |
| 2 (TSK-02) | Each task shows title, issue/area, why, severity, stage, age, and recommendation when one exists | ✓ VERIFIED | `DerivedTask` type carries `title`/`where`/`why`/`sev`/`stage`/`rec`/`openedAt`; `MyTasksScreen.tsx`'s `MyTasksList` renders all of them plus `formatTaskAge(task.openedAt)`, with severity always paired with a label + lucide icon (never color alone, `SEVERITY_META`). `formatTaskAge` (derivedState.ts:482-492) renders an explicit `'unknown'` for missing `openedAt`, never a blank string. |
| 3 (TSK-03) | Primary action deep-links to the exact claim/passage/decision; "Inspect context" opens the inspector | ✓ VERIFIED (Inspect is a documented Phase-44 stub) | `deriveTasks` claim loop uses `issueFactCheckHref(n)` (derivedState.ts:418) and the facts-signoff task uses `issueApprovalHref(n)` (derivedState.ts:436) — both regression-pinned in `__tests__/derivedState.test.ts:503-516` ("deep-links to /issues/7/fact-check, not /draft" / "deep-links to /issues/7/approval, not /draft"). "Inspect context" renders as a disabled button with `title="Inspect panel arrives in a future phase — this entry point is reserved (D-16)."` — an explicitly documented Phase-44 placeholder, acceptable per task scope. |
| 4 (TSK-04) | "Nothing needs you" empty state points to Approval | ✓ VERIFIED | `MyTasksList` (MyTasksScreen.tsx:92-109) renders "Nothing needs you." + explanatory copy + a "Go to Approval" link to `approvalHref` when `tasks.length === 0`. Covered by `__tests__/MyTasksScreen.test.tsx` "TSK-04" describe block. |
| 5 (TSK-05) | A task whose step was restarted shows as superseded with a link to the new step, not silently disappearing | ✓ VERIFIED | `apps/dispatch-control/lib/taskSupersession.ts::computeSessionStates` cross-references `run.section_rerolled` audit-log rows (matched by `runId:agentKey` resourceId + timestamp newer than the task's `openedAt`) — NOT vanish-diffing. `resolved`/`superseded` live only on the `DisplayTask` wrapper (taskSupersession.ts:31-34), never added to `TaskSeverity`/`SEVERITY_MINUTES`/`SEVERITY_ORDER` in derivedState.ts (confirmed those remain the closed 3-member unions). Unit-tested in `__tests__/taskSupersession.test.ts` (8/8 passing, verified live). |
| 6 (TSK-06) | Every reason-requiring action writes to one shared Decision Log component (actor, action, time, reason, before/after, instruction version, issue, run) | ✓ VERIFIED | One component `components/decision-log/DecisionLog.tsx` projects `auditLog.listDecisions` (the reason-bearing subset of `audit_log`, not a new store), actor-resolved to a name via `users.byClerkUserId` + a static system/agent map. Mounted in `ApprovalPanelContent.tsx` AND `WorkspaceControls.tsx`'s persistent "Decision log" control. `writeDecision` is called from `convex/issues.ts` (hold/reopen), `convex/promptVersions.ts` (activate override), `convex/charityCorrections.ts`, and `convex/charities.ts::setStatus` (net-new Do-not-use emission, action `'charity.blocklisted'`, reason now REQUIRED). Pipeline-side keep-as-written routes through `_emit_audit`'s new `reason`/`run_id`/`issue_number`/`instruction_version` kwargs (`factcheck.py:281-291`). |

**Score:** 6/6 truths verified by automated evidence; 2 of the truths (TSK-05 end-to-end live-rerun behavior, TSK-06 live-session actor-name rendering) additionally carry a manual-only verification requirement per the phase's own `43-VALIDATION.md`, correctly deferred to `43-HUMAN-UAT.md` (status: partial, 2 pending) rather than being silently declared done.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/dispatch-control/lib/derivedState.ts` | `deriveTasks`/`formatTaskAge` extended with `openedAt`/age + corrected hrefs | ✓ VERIFIED | 498 lines; `deriveTasks` (388-471), `formatTaskAge` (482-492) present, exported, tested (54 tests in `derivedState.test.ts`, all green). |
| `apps/dispatch-control/lib/taskSupersession.ts` | `computeSessionStates` pure predicate + `DisplayTask` type | ✓ VERIFIED | 129 lines; exports `computeSessionStates`, `DisplayTask`, `RerollSignal`. 8/8 tests green. |
| `apps/dispatch-control/app/(dashboard)/my-tasks/page.tsx` + `_components/MyTasksScreen.tsx` | Real `/my-tasks` screen route | ✓ VERIFIED | 19-line page.tsx + 301-line MyTasksScreen.tsx (well above `min_lines: 80`). Compiled into the strict Next.js build as route `/my-tasks` (3.31 kB, dynamic). |
| `apps/dispatch-control/components/decision-log/DecisionLog.tsx` | Shared Decision Log component | ✓ VERIFIED | 289 lines (above `min_lines: 60`). Exports `DecisionLog` (default, data wrapper) + `DecisionLogRows` (pure render) + `reasonOf`. 7/7 tests green. |
| `apps/dispatch-control/lib/nav.ts` | "My Tasks" Editorial nav item | ✓ VERIFIED | `{ label: 'My Tasks', href: '/my-tasks' }` present in the Editorial group. |
| `apps/dispatch-control/components/AwaitingYouInbox.tsx` | "See all →" footer link to /my-tasks | ✓ VERIFIED | `href="/my-tasks"` present with an explanatory comment distinguishing it from the narrower inbox projection. |
| `convex/schema.ts` | `audit_log` additive decision fields | ✓ VERIFIED | `reason`/`issueNumber`/`runId`/`instructionVersion`, all `v.optional`, added after the pre-existing fields (schema.ts:265-284). |
| `convex/auditLog.ts` | `writeDecision`, `listDecisions`, `isDecisionRow` | ✓ VERIFIED | All three present; `writeDecision` requires `reason: v.string()` (not optional) — a decision always has a reason. `listDecisions` filters via `isDecisionRow` (structured reason OR after-JSON `reason`/`heldReason` fallback) and is run/issue-scopable. |
| `convex/users.ts` | Clerk sub → display name/email query | ✓ VERIFIED | `byClerkUserId` query present. |
| `convex/charities.ts` | Reason-required blocklist transition + `writeDecision` | ✓ VERIFIED | `setStatus` throws `'A reason is required to mark a charity Do not use.'` on empty reason for `status === 'blocklisted'`; emits `writeDecision` with `action: 'charity.blocklisted'` only on that transition. Closes the documented pre-existing Phase 26 zero-audit gap. |
| `apps/dispatch-control/app/(dashboard)/registry/_components/RegistryTable.tsx` | Reason textarea in blocklist confirm flow | ✓ VERIFIED | `blocklistReason` state, required textarea, confirm disabled until non-empty (`disabled={isPendingThisAction \|\| blocklistReason.trim() === ''}`). |
| `packages/pipeline/src/eisenbalm_pipeline/api/control.py` | `_emit_audit` extended with decision kwargs | ✓ VERIFIED | `reason`/`issue_number`/`run_id`/`instruction_version` optional kwargs (control.py:146-150), forwarded into the `record` mutation args only when non-`None`. |
| `.planning/phases/43-my-tasks-decision-log/43-VALIDATION.md` | Per-task verification map, green | ✓ VERIFIED | `nyquist_compliant: true`, `status: gate-passed`, all 7 rows ✅ green, integration gate results table populated. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `deriveTasks` claim loop | `issueRouteResolver.issueFactCheckHref` | `primary.href` for stage-3 claim tasks | ✓ WIRED | Confirmed at derivedState.ts:418, regression-tested. |
| `deriveTasks` facts-signoff | `issueRouteResolver.issueApprovalHref` | `primary.href` | ✓ WIRED | Confirmed at derivedState.ts:436, regression-tested. |
| `MyTasksScreen` | `deriveTasks` + `computeSessionStates` | assembled `DerivationInputs` + client-filtered `run.section_rerolled` rows | ✓ WIRED | Live Convex `useQuery` calls feed real data into both pure functions (MyTasksScreen.tsx:204-286); no hardcoded/empty fixtures in the render path. |
| `AwaitingYouInbox` | `/my-tasks` | See-all footer `Link` | ✓ WIRED | Confirmed. |
| `DecisionLog` | `auditLog.listDecisions` + `users.byClerkUserId` | reason-bearing projection + read-time actor resolution | ✓ WIRED | `DecisionLog` default export subscribes to `listDecisions`; `ActorNameResolver` child components call `users.byClerkUserId` per distinct human actorId. |
| `ApprovalPanelContent` / `WorkspaceControls` | `DecisionLog` | mount | ✓ WIRED | Both files import and render `DecisionLog` (grep-confirmed, not test-only references). |
| `issues.hold`/`promptVersions.activate`/`charityCorrections`/`charities.setStatus` | `auditLog.writeDecision` | `ctx.runMutation(internal.auditLog.writeDecision, ...)` | ✓ WIRED | All four call sites confirmed via grep. |
| pipeline fact-check `keep-as-written` | `_emit_audit` | new `reason`/`run_id` kwargs | ✓ WIRED | factcheck.py:281-291, confirmed by direct read. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `MyTasksScreen` | `derivationInputs` (claimRows/qaFindings/signOffs/pitchRows) | Live `useQuery` calls against `claimChecks.listByRunId`, `qaCorrections.byRunId`, `signOffs.activeByRunId`, `pitchLog.byRunId` | Yes — real Convex queries scoped by resolved `runId`, no hardcoded/empty fallback in the render path | ✓ FLOWING |
| `MyTasksScreen` | `rerolls` (RerollSignal[]) | `useQuery(api.auditLog.listForWorkspace, ...)`, filtered client-side for `action === 'run.section_rerolled'` and `resourceId` prefix match | Yes | ✓ FLOWING |
| `DecisionLog` | `rows` | `useQuery(api.auditLog.listDecisions, ...)` | Yes — real Convex query filtered server-side by `isDecisionRow` | ✓ FLOWING |
| `RegistryTable` blocklist reason | `blocklistReason` → `setStatus({ ..., reason })` | Live mutation call, gated by non-empty check both client-side (button disabled) and server-side (`charities.ts` throws) | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 43 unit/component/convex-test files pass | `pnpm --filter dispatch-control test -- derivedState.test.ts taskSupersession.test.ts MyTasksScreen.test.tsx DecisionLog.test.tsx auditLogDecision.test.ts charitiesDoNotUse.test.ts` | 6 files, 88/88 tests passed | ✓ PASS |
| Full dispatch-control suite is green | `pnpm --filter dispatch-control test` | 91 files passed, 1 intentionally skipped; 786 tests passed, 2 todo | ✓ PASS |
| Strict Next.js build succeeds, `/my-tasks` route compiles | `pnpm --filter dispatch-control build` | Exit 0; `/my-tasks` route generated (3.31 kB); `/issues/[issueNumber]/approval` generated (6.18 kB, carries the mounted Decision Log) | ✓ PASS |
| Convex functions synced to dev deployment | `pnpm --filter @eisenbalm/convex dev:once` | "Convex functions ready!" against the dev deployment; `git status --short convex/` clean before/after | ✓ PASS |
| Pipeline pytest for `_emit_audit` decision kwargs + factcheck | `cd packages/pipeline && python -m pytest -q -k "audit or factcheck" --ignore=tests/lib/test_vercel_client.py` | 37 passed, 0 failed | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TSK-01 | 43-03, 43-05 | My Tasks is a derived projection, no new task store | ✓ SATISFIED | `deriveTasks` selector, no `tasks` table in schema.ts |
| TSK-02 | 43-01, 43-03, 43-05 | Task shows title/where/why/severity/stage/age/recommendation | ✓ SATISFIED | `DerivedTask` shape + `formatTaskAge` + full render in `MyTasksList` |
| TSK-03 | 43-01, 43-03, 43-05 | Primary action deep-links; Inspect context entry point | ✓ SATISFIED | Corrected hrefs regression-tested; Inspect stub documented (D-16, Phase 44 dependency) |
| TSK-04 | 43-05 | "Nothing needs you" empty state → Approval | ✓ SATISFIED | `MyTasksList` empty branch |
| TSK-05 | 43-01, 43-04, 43-05 | Superseded task shows link to new step, never silently disappears | ✓ SATISFIED (automated); live-rerun end-to-end path is human-verified per `43-HUMAN-UAT.md` | `computeSessionStates` cross-referencing `run.section_rerolled`, unit-tested |
| TSK-06 | 43-01, 43-02, 43-06, 43-07, 43-08 | One shared Decision Log, every reason-requiring action writes to it | ✓ SATISFIED (automated); live-session actor-as-name rendering is human-verified per `43-HUMAN-UAT.md` | `DecisionLog` component, `writeDecision`/`_emit_audit` retrofit across hold/reopen/activate-override/keep-as-written/Do-not-use |

No orphaned requirements — REQUIREMENTS.md maps exactly TSK-01..TSK-06 to Phase 43, and all six appear in at least one plan's `requirements:` frontmatter.

### Anti-Patterns Found

None. Scanned `derivedState.ts`, `taskSupersession.ts`, `DecisionLog.tsx`, `MyTasksScreen.tsx`, `convex/auditLog.ts`, `convex/charities.ts` for TODO/FIXME/placeholder/empty-return patterns — the only `return []` is a legitimate early-exit guard (`deriveTasks` when `runId === null`). The "Inspect context" disabled button is an explicitly documented, intentional Phase-44 placeholder (D-16) rather than an undocumented stub, and is called out as acceptable in the verification brief.

### Human Verification Required

### 1. Decision Log actor-as-name rendering in a live session (TSK-06)

**Test:** Sign in to dispatch-control with a real Clerk session. Perform a reasoned action (Hold the issue with a reason, or mark a charity Do-not-use with a reason). Open the Decision log in both mounts — the Approval context panel and the persistent Workspace "Decision log" control — and confirm the new row shows your NAME (not a Clerk sub/user ID), the reason, action, time, before/after, and issue+run.
**Expected:** Actor renders as a human-readable display name/email, not a raw Clerk `sub`.
**Why human:** Requires a real authenticated Clerk session and a populated `users` table row against live Convex — the automated suite mocks actor identity and cannot exercise the live `users.byClerkUserId` resolution path end-to-end.

### 2. "Superseded" appears after a real section re-roll (TSK-05)

**Test:** With an issue that has an open task on a section (e.g. an open fact-check finding), trigger `rerun_agent` to re-roll that section on a live run. Return to `/my-tasks` and confirm the task now reads "superseded" with a link to the new step — it must not silently drop off the list.
**Expected:** The task row renders struck-through with a "superseded" label and a "See the new step" link, not simple disappearance.
**Why human:** Requires triggering a real pipeline rerun against a live run and observing client-side session state (`prevRef`/`computeSessionStates`) across a live re-render, which the automated suite covers only at the pure-predicate level (`taskSupersession.test.ts`), not end-to-end through a live rerun.

*Both items are already correctly tracked in `.planning/phases/43-my-tasks-decision-log/43-HUMAN-UAT.md` (status: partial, 2 pending) rather than silently declared done — this verification concurs with that self-assessment rather than discovering a new gap.*

### Gaps Summary

No automated gaps found. Every TSK-01..TSK-06 success criterion has direct, working code behind it: `deriveTasks` is a real selector (not a new store), the `/my-tasks` screen renders it live against Convex with all required fields, hrefs deep-link correctly (regression-pinned against the pre-existing Draft-href bug), the empty state explicitly names itself and points to Approval, supersession is computed via a real audit-log cross-reference (not vanish-diffing) with `resolved`/`superseded` kept off the closed `TaskSeverity` union, and the Decision Log is one real shared component/projection (not a new store) wired into both required mounts with `writeDecision`/`_emit_audit` retrofitted across all five reason-requiring actions named in the phase goal — including the net-new Do-not-use audit emission that previously wrote zero rows.

All automated verification (unit/component/convex-test suites, strict Next.js build, Convex dev sync, pipeline pytest) was independently re-run during this verification (not just trusted from SUMMARY.md) and passed. The repo-wide pre-existing `tsc --noEmit` baseline (~216 errors/28 files, all test-file-only, none Phase-43-attributable) and the pre-existing pipeline `respx` import error are confirmed pre-existing per `deferred-items.md` and correctly excluded from the strict build gate — not treated as phase failures per the verification brief.

The phase is functionally complete. Status is `human_needed` rather than `passed` solely because two behaviors are structurally impossible to verify without a live Clerk session and a live pipeline rerun, and the phase's own validation artifacts already correctly flag them as pending rather than papering over them.

---

*Verified: 2026-07-15T17:52:54Z*
*Verifier: Claude (gsd-verifier)*
