---
phase: 43-my-tasks-decision-log
plan: 09
type: execute
wave: 6
depends_on: ["43-01", "43-02", "43-03", "43-04", "43-05", "43-06", "43-07", "43-08"]
files_modified:
  - .planning/phases/43-my-tasks-decision-log/43-VALIDATION.md
autonomous: false
requirements: [TSK-01, TSK-02, TSK-03, TSK-04, TSK-05, TSK-06]

must_haves:
  truths:
    - "the full dispatch-control vitest suite is green (all Phase 43 unit + component + convex-test files)"
    - "the strict Next.js build (pnpm --filter dispatch-control build) is green — no Vercel/Linux-only type error"
    - "all convex/* changes are deployed to dev:modest-magpie-797 (pnpm --filter @eisenbalm/convex dev:once clean)"
    - "the pipeline pytest for the _emit_audit decision kwargs is green"
    - "the two manual-only behaviors (Decision Log actor-as-name in a live session; superseded after a real reroll) are human-verified"
  artifacts:
    - path: ".planning/phases/43-my-tasks-decision-log/43-VALIDATION.md"
      provides: "per-task verification map populated + green; nyquist_compliant: true"
  key_links:
    - from: "the full phase"
      to: "the 6 success criteria"
      via: "the integration gate"
      pattern: "TSK-0"
---

<objective>
Prove Phase 43 is done as a whole: full console suite + strict build + Convex deploy + pipeline pytest all green, and the two irreducibly-manual behaviors human-verified. This is the phase gate before /gsd:verify-work.

Purpose: vitest does not type-check and Convex commit ≠ deploy — the integration gate is where the phase's cross-file/cross-runtime correctness (selector + screen + component + Convex substrate + retrofit) is confirmed together, and where the two live-session behaviors that no automated test can reach get a human check.
Output: green gate + populated 43-VALIDATION.md map.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/43-my-tasks-decision-log/43-VALIDATION.md
@.planning/phases/43-my-tasks-decision-log/43-RESEARCH.md

<interfaces>
<!-- Verified from the current repo tree. -->
Console suite: `pnpm --filter dispatch-control test` (vitest run). Strict build: `pnpm --filter dispatch-control build`. Typecheck: `pnpm --filter dispatch-control typecheck`.
Convex sync: `pnpm --filter @eisenbalm/convex dev:once` -> dev:modest-magpie-797.
Pipeline tests: `cd packages/pipeline && python -m pytest -q -k "audit or factcheck"`.
Phase 43 test files: derivedState.test.ts (extended), taskSupersession.test.ts, MyTasksScreen.test.tsx, DecisionLog.test.tsx, auditLogDecision.test.ts (edge-runtime), charitiesDoNotUse.test.ts (edge-runtime).
Manual-only rows (43-VALIDATION.md): Decision Log actor-as-name in a live session; "superseded" after a real section reroll.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Full-suite + strict-build + Convex-deploy + pipeline-pytest gate</name>
  <files>.planning/phases/43-my-tasks-decision-log/43-VALIDATION.md</files>
  <read_first>
    - .planning/phases/43-my-tasks-decision-log/43-VALIDATION.md (the per-task map + sign-off checklist to populate)
    - .planning/phases/43-my-tasks-decision-log/43-RESEARCH.md (Validation Architecture — the sampling-rate + phase-gate rules)
  </read_first>
  <action>
Run, in order, and record each result in 43-VALIDATION.md's Per-Task Verification Map (replace the placeholder rows with the concrete Phase 43 test files, marking each ✅/❌):
1. `pnpm --filter dispatch-control test` (full console suite — all Phase 43 files + regression).
2. `pnpm --filter dispatch-control typecheck`.
3. `pnpm --filter dispatch-control build` (strict — catches Vercel/Linux-only type errors).
4. `pnpm --filter @eisenbalm/convex dev:once` (confirm all Phase 43 convex functions are live on dev:modest-magpie-797; confirm no uncommitted _generated drift).
5. `cd packages/pipeline && python -m pytest -q -k "audit or factcheck"`.
If any step fails, fix within its owning plan's files (do not paper over with skips) and re-run. When all green, tick the Validation Sign-Off checklist and set `nyquist_compliant: true` in the 43-VALIDATION.md frontmatter.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test && pnpm --filter dispatch-control typecheck && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm --filter dispatch-control test` exits 0 (full suite)
    - `pnpm --filter dispatch-control typecheck` exits 0
    - `pnpm --filter dispatch-control build` exits 0
    - `cd packages/pipeline && python -m pytest -q -k "audit or factcheck"` exits 0
    - `grep -n "nyquist_compliant: true" .planning/phases/43-my-tasks-decision-log/43-VALIDATION.md` matches
    - the Per-Task Verification Map in 43-VALIDATION.md has concrete rows for derivedState/taskSupersession/MyTasksScreen/DecisionLog/auditLogDecision/charitiesDoNotUse, each marked ✅
  </acceptance_criteria>
  <done>Full suite + typecheck + strict build + Convex deploy + pipeline pytest are green and recorded; the validation map is populated and nyquist_compliant.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Human-verify the two live-session behaviors</name>
  <files>none (manual verification)</files>
  <action>
    Pause for the operator to run the manual verification steps below in a live session (localhost:3001 against dev:modest-magpie-797). These two behaviors — actor-name resolution in a live Clerk session, and "superseded" after a real rerun_agent reroll — cannot be reached by automated tests (they are the 43-VALIDATION.md Manual-Only rows). Do not proceed until the operator responds.
  </action>
  <what-built>
    My Tasks screen (/my-tasks) rendering the cross-stage projection with age + deep links + Inspect-context entry point + designed empty state + superseded/resolved states; the shared Decision Log in the Approval context panel + the persistent Workspace control, projecting reason-bearing decisions with actor-as-name; Do-not-use reason capture.
  </what-built>
  <how-to-verify>
    1. Sign in to dispatch-control (localhost:3001). Open the Masthead "My Tasks · N" dropdown → click "See all →"; confirm /my-tasks lists the current issue's open claims/findings/missing sign-offs with title/where/why/severity(label+icon)/stage/age, and each row's primary action deep-links (a claim task → /issues/{n}/fact-check; the facts sign-off → /issues/{n}/approval). Confirm an "Inspect context" control is present (inert is fine).
    2. If the issue currently has zero tasks, confirm the screen shows "Nothing needs you" + a link to Approval (not a bare empty list).
    3. Perform a reasoned action (Hold the issue with a reason, OR mark a charity Do-not-use with a reason). Open the Decision log (Approval context panel AND the persistent Workspace "Decision log" control) and confirm the new row shows your NAME (not a Clerk sub), the reason, action, time, before/after, and issue+run.
    4. Re-roll a section that has an open task (RUN-05). Return to /my-tasks and confirm that task now reads "superseded" with a link to the new step — it does NOT silently disappear.
  </how-to-verify>
  <verify>
    <automated>MANUAL — operator verification; no automated command (the automated suite is Task 1)</automated>
  </verify>
  <acceptance_criteria>
    - Operator confirms: My Tasks lists tasks with correct deep links + age + empty-state pointer; the Decision Log shows actor-as-name reasoned rows in both mounts; a rerolled task reads "superseded" (never silently dropped).
  </acceptance_criteria>
  <done>Operator has confirmed (or itemized deviations for) the My Tasks screen behaviors, the Decision Log actor-as-name rendering in both mounts, and the superseded-on-reroll behavior.</done>
  <resume-signal>Type "approved" or describe the issues observed.</resume-signal>
</task>

</tasks>

<verification>
- Full console suite + typecheck + strict build green; pipeline pytest green; Convex deployed.
- Human confirmation of the two live-session behaviors recorded.
</verification>

<success_criteria>
All six Phase 43 success criteria are demonstrably TRUE: My Tasks is a derived cross-stage projection with rich rows, correct deep links, a designed empty state, and never-silent superseded tasks; and every reason-requiring action writes to one actor-as-name Decision Log — verified by a green full suite + strict build + Convex deploy + a human check of the two live-only behaviors.
</success_criteria>

<output>
After completion, create `.planning/phases/43-my-tasks-decision-log/43-09-SUMMARY.md`.
</output>
