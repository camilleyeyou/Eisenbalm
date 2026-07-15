---
phase: 43-my-tasks-decision-log
plan: 07
type: execute
wave: 4
depends_on: ["43-02"]
files_modified:
  - convex/issues.ts
  - convex/promptVersions.ts
  - convex/charityCorrections.ts
  - packages/pipeline/src/eisenbalm_pipeline/api/control.py
  - packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py
  - apps/dispatch-control/__tests__/auditLogDecision.test.ts
autonomous: true
requirements: [TSK-06]

must_haves:
  truths:
    - "every ALREADY-SHIPPED reason-requiring action emits a complete structured decision row via the ONE shared helper: hold + reopen (issues.ts) and activate-with-regression override (promptVersions.ts) and charity correction (charityCorrections.ts) call writeDecision with the structured reason/issueNumber/runId/instructionVersion; the reason is promoted from after-JSON into the structured field"
    - "the pipeline-side keep-as-written (Phase 42 fact-check) emits its decision via the extended _emit_audit with the new reason/issue_number/run_id kwargs"
    - "the retrofit is additive — existing action behavior/tests still pass; the reason now ALSO lands in the structured audit_log field the Decision Log projects"
    - "convex/* changes are synced to dev:modest-magpie-797 via pnpm --filter @eisenbalm/convex dev:once"
  artifacts:
    - path: "convex/issues.ts"
      provides: "hold/reopen routed through writeDecision with structured reason + issueNumber"
      contains: "writeDecision"
    - path: "convex/promptVersions.ts"
      provides: "activate override routed through writeDecision with reason + instructionVersion"
      contains: "writeDecision"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/control.py"
      provides: "_emit_audit extended with reason/issue_number/run_id/instruction_version optional kwargs"
      contains: "instruction_version"
  key_links:
    - from: "issues.hold / promptVersions.activate / factcheck keep-as-written"
      to: "auditLog.listDecisions"
      via: "structured reason field on audit_log"
      pattern: "writeDecision"
---

<objective>
Route every ALREADY-SHIPPED reason-requiring action through the shared decision-write helper (TSK-06, D-13) so the Decision Log renders a uniform TSK-06 record for each. Per RESEARCH Pattern 3, there is NO existing shared wrapper — each dashboard mutation inlines its own auditLog.write, and the pipeline shares _emit_audit. This plan unifies the shape: promote the reason from after-JSON into the structured field for the Convex-side actions, and thread the new decision kwargs through the pipeline-side keep-as-written.

Purpose: "Every reason-requiring action console-wide writes to one Decision log" is satisfied for all SHIPPED actions here (Stage-1 remove-lead / org-override are Phases 46-47 and inherit the shape — D-14). Do-not-use is net-new and is its own plan (43-08).
Output: hold/reopen/activate/charity-correction via writeDecision + _emit_audit decision kwargs + keep-as-written wiring + Convex sync.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@docs/API_CONTRACTS.md
@convex/auditLog.ts
@convex/issues.ts
@convex/promptVersions.ts
@packages/pipeline/src/eisenbalm_pipeline/api/control.py

<interfaces>
<!-- Verified from the current repo tree. -->
writeDecision (from 43-02): internal.auditLog.writeDecision({ workspace_id, actorId, action, resourceType?, resourceId?, before?, after?, reason, issueNumber?, runId?, instructionVersion? }).
convex/issues.ts::hold (101-145): validates required reason, patches, then `ctx.runMutation(internal.auditLog.write, { action:'issue.held', resourceId: String(issueNumber), after: JSON.stringify({held:true, heldReason}) })`. reopen (149-186): similar, action 'issue.reopened'. Retarget both to writeDecision, moving the reason into the structured `reason` field and adding issueNumber (the numeric field).
convex/promptVersions.ts::activate (~line 340-360): on regression override, writes internal.auditLog.write with reason inside `after`/note. Retarget the override emission to writeDecision with reason + instructionVersion (String(version)) + agentKey in resourceId.
convex/charityCorrections.ts::append (~line 50): writes internal.auditLog.write with a reason-bearing correction. Retarget to writeDecision with the correction reason.
packages/pipeline/.../api/control.py::_emit_audit (137-175): currently forwards workspace_id/actorId/action/resourceType/resourceId/before/after. EXTEND additively with optional kwargs reason, issue_number, run_id, instruction_version, each added to the args dict only when non-None (mirror the before/after pattern).
packages/pipeline/.../api/factcheck.py: the Phase 42 "Keep as written — add reason" flow calls _emit_audit; pass the operator's reason + run_id (+ issue_number if resolvable) as the new kwargs.
Convex sync: `pnpm --filter @eisenbalm/convex dev:once` after editing convex/*.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Route Convex-side shipped actions (hold, reopen, activate-override, charity correction) through writeDecision</name>
  <files>convex/issues.ts, convex/promptVersions.ts, convex/charityCorrections.ts, apps/dispatch-control/__tests__/auditLogDecision.test.ts</files>
  <read_first>
    - convex/auditLog.ts (writeDecision signature from 43-02)
    - convex/issues.ts (hold 101-145, reopen 149-186 — the existing inline auditLog.write calls)
    - convex/promptVersions.ts (activate — the override audit emission; find the reason-in-after write)
    - convex/charityCorrections.ts (append — the correction audit write)
    - apps/dispatch-control/__tests__/auditLogDecision.test.ts (the 43-02 test file — extend it to assert the retrofitted rows carry structured reason + issueNumber + are returned by listDecisions)
  </read_first>
  <action>
1. convex/issues.ts hold: replace the `internal.auditLog.write` call with `internal.auditLog.writeDecision`, passing `reason: trimmedReason`, `issueNumber`, `resourceType:'issue'`, `resourceId: String(issueNumber)`, and keep before/after. reopen: same, action 'issue.reopened', reason describing the reopen (or the prior heldReason) + issueNumber. Preserve the required-reason validation.
2. convex/promptVersions.ts activate: for the regression-override emission, call writeDecision with the override `reason`, `instructionVersion: String(version)`, `resourceType:'prompt_version'`, `resourceId: agentKey` (or the existing resourceId), preserving action/before/after.
3. convex/charityCorrections.ts append: route its audit emission through writeDecision with the correction reason (+ any run/issue scope available).
4. Extend __tests__/auditLogDecision.test.ts: assert that after calling issues.hold, listDecisions returns a row with structured reason === the hold reason and issueNumber set.
5. Run `pnpm --filter @eisenbalm/convex dev:once` to sync.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- __tests__/auditLogDecision.test.ts __tests__/issues.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "writeDecision" convex/issues.ts` matches (hold + reopen)
    - `grep -n "writeDecision" convex/promptVersions.ts` matches
    - `grep -n "writeDecision" convex/charityCorrections.ts` matches
    - `grep -n "internal.auditLog.write\b" convex/issues.ts` no longer appears for the hold/reopen decision emissions (replaced by writeDecision)
    - `pnpm --filter dispatch-control test -- __tests__/auditLogDecision.test.ts __tests__/issues.test.ts` exits 0
    - `pnpm --filter @eisenbalm/convex dev:once` completes without a deploy error
  </acceptance_criteria>
  <done>All shipped Convex-side reason-requiring actions emit a structured decision row via the one helper; the reason is promoted into the field the Decision Log projects.</done>
</task>

<task type="auto">
  <name>Task 2: Extend pipeline _emit_audit with decision kwargs + wire keep-as-written</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/control.py, packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/control.py (_emit_audit 137-175 — the before/after optional-kwarg pattern to mirror)
    - packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py (the keep-as-written flow that calls _emit_audit)
    - docs/API_CONTRACTS.md §43.2 (the _emit_audit kwarg contract)
    - packages/pipeline (pytest layout — find the existing factcheck/control test to extend)
  </read_first>
  <action>
1. control.py _emit_audit: add optional kwargs `reason: str | None = None`, `issue_number: int | None = None`, `run_id: str | None = None`, `instruction_version: str | None = None`; forward each into the `args` dict (keys `reason`, `issueNumber`, `runId`, `instructionVersion`) only when non-None, exactly like the existing before/after handling.
2. factcheck.py keep-as-written: pass `reason=<operator reason>`, `run_id=<run_id>` (and `issue_number` if resolvable) into the _emit_audit call for that action so it becomes a structured decision the Decision Log projects.
3. Add/extend a pytest asserting _emit_audit forwards the new kwargs into the auditLog:record args dict only when provided (mock the convex mutation call and inspect the args).
  </action>
  <verify>
    <automated>cd packages/pipeline && python -m pytest -q -k "audit or factcheck" 2>&1 | tail -20</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "instruction_version" packages/pipeline/src/eisenbalm_pipeline/api/control.py` matches inside _emit_audit
    - `grep -n "reason=" packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py` matches in the keep-as-written call
    - the pytest for _emit_audit kwarg forwarding passes (command exits 0)
  </acceptance_criteria>
  <done>The pipeline-side keep-as-written emits a structured decision via the extended shared _emit_audit; the kwarg forwarding is test-covered.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test` green (decision + issues tests).
- pipeline pytest for the audit kwargs green.
- `git diff` shows additive changes only; each retrofitted action still performs its original mutation, now with a structured reason.
- Convex dev sync ran.
</verification>

<success_criteria>
Every shipped reason-requiring action (hold, reopen, activate-with-regression override, charity correction, keep-as-written) writes a complete structured decision row through the one shared helper, uniformly rendered by the Decision Log; unbuilt Stage-1 actions inherit the shape (D-14).
</success_criteria>

<output>
After completion, create `.planning/phases/43-my-tasks-decision-log/43-07-SUMMARY.md`.
</output>
