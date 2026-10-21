---
phase: quick-261021-ind
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/issue_hold.py
  - packages/pipeline/src/eisenbalm_pipeline/api/review.py
  - packages/pipeline/src/eisenbalm_pipeline/api/control.py
  - packages/pipeline/src/eisenbalm_pipeline/api/runs.py
  - packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
  - packages/pipeline/tests/test_issue_hold.py
  - packages/pipeline/tests/test_review_endpoints.py
  - packages/pipeline/tests/test_scheduler.py
  - packages/pipeline/tests/test_publish_bridge.py
  - packages/pipeline/tests/api/test_webhook_sanity.py
  - packages/pipeline/tests/agents/test_editor.py
  - packages/pipeline/tests/test_editor_gate_1_resume.py
  - packages/pipeline/tests/test_checkpoint_resume_phase46.py
  - docs/API_CONTRACTS.md
  - apps/dispatch-control/lib/derivedState.ts
  - apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx
  - apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx
  - apps/dispatch-control/components/AwaitingYouInbox.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx
  - apps/dispatch-control/components/help/helpCopy.ts
  - apps/dispatch-control/components/onboarding/onboardingCopy.ts
  - apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/StartHereCard.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/ExemptSectionNote.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx
  - apps/dispatch-control/app/(editorial)/s/[section]/page.tsx
  - apps/dispatch-control/components/galley/Galley.tsx
  - apps/dispatch-control/components/inspector/InspectorProvider.tsx
  - apps/dispatch-control/components/inspector/InspectorContainer.tsx
  - apps/dispatch-control/components/inspector/InspectorPanel.tsx
  - apps/dispatch-control/components/inspector/InspectorFooter.tsx
  - apps/dispatch-control/app/(editorial)/layout.tsx
  - apps/dispatch-control/app/(dashboard)/layout.tsx
  - apps/dispatch-control/app/(dashboard)/config/page.tsx
  - apps/dispatch-control/components/Masthead.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx
  - apps/dispatch-control/app/(dashboard)/issues/_components/HeldIssueRow.tsx
  - apps/dispatch-control/__tests__/*.test.ts(x) (the suites named in each task)
autonomous: true
requirements: [QUICK-261021-ind]

must_haves:
  truths:
    - "A held issue cannot be published by ANY path: POST /issues/{run}/publish, /schedule, /publish-manual, POST /run/{run}/publish, the tick scheduled-publish sweep, and a direct Sanity Studio flip (webhook) all refuse"
    - "The pipeline never pauses for a human at Gate 1 — the Editor agent's pick (deterministic top score) is used and the run continues to phase 2"
    - "Every console surface (masthead chip, workspace status, /run, My Tasks, Awaiting-you inbox, stage tabs) says 'Ready to publish' for a finished, un-held run and 'Published' after publishing — no sign-off is ever asked for"
    - "DecisionRail has no fake Hold and cannot double-publish"
    - "No UI string claims findings, claims or sign-offs block Publish; no 'Edit myself' / 'Ask agent to revise' no-ops on the editor path; Auto-publish toggle/banner/chip are hidden"
    - "The DISPATCH/CONTROL wordmark links to /"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/issue_hold.py"
      provides: "is_issue_held + assert_not_held (single hold helper)"
      exports: ["is_issue_held", "assert_not_held", "HELD_DETAIL"]
    - path: "packages/pipeline/tests/test_issue_hold.py"
      provides: "helper unit tests + one held test per publish path"
  key_links:
    - from: "api/review.py publish_issue + schedule_issue, api/control.py publish_manual + tick sweep, api/runs.py manual_publish, api/webhooks.py sanity_publish"
      to: "lib/issue_hold.py"
      via: "assert_not_held / is_issue_held → convex issues:byIssueNumber"
      pattern: "assert_not_held|is_issue_held"
    - from: "apps/dispatch-control/lib/derivedState.ts deriveIssueStatus"
      to: "runStatus + runCompletedAt"
      via: "ready = awaiting-review && completedAt != null && !held; published = issue.published || runStatus==='complete'"
      pattern: "runCompletedAt"
---

<objective>
Part A of the dashboard simplification: make the whole app tell the truth under the rules shipped in quick 261021-7aw
(agents self-fix; Publish gated ONLY by Editor-in-chief role + hold). Enforce hold on the server for every publish path,
make Gate 1 auto-proceed, retarget the shared console derivations, purge stale gate copy and dead controls, and add a
link back to `/`.

Purpose: today the server ignores hold (the only content gate left), and every console surface contradicts the front
door ("Needs review" forever, phantom must-fix sign-off tasks, fake Hold). Phase 34 lesson: retire a rule on BOTH client
and server and in all callers.

Output: one hold helper wired into 6 publish paths with tests; editor gate auto-proceed; corrected derivations and copy.

OUT OF SCOPE (Part B — do NOT do here): deleting routes, redirects, /admin hub, moving Start/Hold/charity choice onto `/`,
removing comments, deleting fact-check/voice surfaces, CommandPalette entries, archive row targets.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@.planning/quick/261021-ind-dashboard-simplification-a-server-hold-e/261021-ind-CONTEXT.md
@.planning/ui-reviews/dashboard-simplification-260921-CLICK-PATH.md
@.planning/quick/261021-7aw-agents-review-and-self-fix-every-section/261021-7aw-SUMMARY.md

<verified_facts>
<!-- Planner verified these against the code at 1753e09c. Audit claims CP-01..CP-19 hold, with the corrections below. -->
- Convex `issues` table (convex/schema.ts ~535) has `held: v.boolean()`, keyed by `by_workspace_issueNumber`.
  `issues:byIssueNumber` is a PUBLIC query, args `{workspace_id: string, issueNumber: number}` → row | null.
  `pipelineRuns` rows carry required `issueNumber`. NO Convex change is needed for this task.
- `convex/issues.ts` `hold`/`reopen` already use `requireOperator` (any signed-in role) — decision 2 is already true
  server-side; nothing to change there.
- Pipeline Convex access: `import eisenbalm_pipeline.lib.convex_client as _cc`; `await _cc.convex_query(http, path, args)`.
  Existing tests monkeypatch `eisenbalm_pipeline.api.<module>._cc.convex_query`, which patches the SHARED module
  attribute — so the helper MUST call `_cc.convex_query(...)` via the module attribute (not `from ... import convex_query`)
  for those patches to apply.
- Publish paths (none read `held` today):
  - `api/review.py` `publish_issue` (L69) and `schedule_issue` (L159) — have `run` (from `pipelineRuns:byRunId`, includes issueNumber).
  - `api/control.py` tick scheduled-publish sweep (~L455-486: loops `runs:dueForPublish`, looks up `pr` via
    `pipelineRuns:byRunId`, calls `_flip_sanity_published`, then clears `scheduledPublishAt`) and `publish_manual`
    (L825, resolves Sanity `issue` with `issue["issueNumber"]`, spawns `_run_publisher`).
  - `api/runs.py` `manual_publish` (POST /run/{run_id}/publish, L578, trigger-secret, same Sanity `issue` lookup).
  - `api/webhooks.py` `sanity_publish` — payload has `issueNumber`, `runId`; `no_run_id` block reverts via
    `_revert_sanity_status(sanity_http, issue_id, status="in-review")` + `_emit_audit` + returns 200 `{"ok":True,"blocked":...}`.
    The self-echo claim (`claim_idempotency_key(... source="publisher-run")`) must stay AFTER any block so a blocked publish
    does not consume the claim.
- Gate 1: `agents/editor.py` `editor_gate_1` has two `interrupt()` paths: (a) `if not candidates:` all-candidates-killed
  (L369-470), (b) `interrupt_triggered = score_gap < EDITOR_INTERRUPT_THRESHOLD and confidence < EDITOR_CONFIDENCE_THRESHOLD
  and requiresHumanInput` (L515-570). Winner is already the deterministic top score (`winner_name = top.get("name")`); the
  LLM winnerName is diagnostic only. Thresholds are also substituted into the editor prompt (L316-317) — keep the constants.
  `adjudicate` / `/run/{id}/resume` endpoints stay (they 409 "not paused" for new runs; legacy paused runs can still resume).
- dispatch-control derivations (lib/derivedState.ts): `deriveIssueStatus` L147-164 requires both sign-offs for `ready`;
  `deriveTasks` L582-610 always pushes `signoff-facts`/`signoff-voice` must-fix tasks; `deriveVoiceStage` L226-238 and
  `deriveApprovalStage` L240-251 are sign-off driven. `isPausedAtGate1(i)` = `runStatus==='awaiting-review' && runCompletedAt==null`.
- EXTRA BUG FOUND: `MyTasksScreen.tsx` (~L303-319) builds `DerivationInputs` WITHOUT `runCompletedAt`, so
  `isPausedAtGate1` is TRUE for every finished run there → My Tasks shows "Choose the charity to continue" forever. Fix by
  passing `runCompletedAt: latest?.completedAt`. (useCurrentRun.ts and WorkspaceStateProvider.tsx already pass it.)
- `AwaitingYouInbox.tsx` L59 `f.severity==='error' && !f.accepted` (counts agent-applied/agent-skipped rows); also lists
  `claimChecks.allSignedOff.blocking` contradicted claims; label `Awaiting review — Run ${runId}` (raw id).
- DecisionRail.tsx: fake Hold L291-300 + button L619-625 calls `rejectIssue`; `handlePublish` L249-266 resets `busy` in
  `finally` → double-publish; `publishDisabled = !!held || busy` (L551). The real Hold (WorkspaceControls "Hold issue")
  renders in the SAME issue-frame header (issues/[issueNumber]/layout.tsx) as the Approval stage that mounts DecisionRail.
  `api.pipelineRuns.byRunId` (convex/pipelineRuns.ts L6) is available for a run-status query.
- Section editor: `s/[section]/page.tsx` `openInPlaceEditor` hard-codes `blockIndex: 0, isFallback: true`;
  `Galley.tsx` L437 `onEditText={(sel) => onEditSection(sel.sectionId)}` drops `sel.blockIndex` (`PassageSelection` in
  components/galley/PassageToolbar.tsx has `blockIndex: number`). `InPlaceBlockEditor.tsx` L136-138 fallback copy names "Edit myself".
- Inspector revise: `InspectorContainer.tsx` L291 passes `onRequestRevision={requestRevision}` (from `useInspector()`);
  `InspectorPanel.tsx` ~L513 derives `onAskToRevise`; `InspectorFooter.tsx` ~L296 renders "Ask agent to revise" (reserved
  when undefined). `(editorial)/layout.tsx` mounts its own `<InspectorProvider>`; the section page does not mount RevisionFlow.
- Auto-publish UI: `(dashboard)/layout.tsx` L83-85 `<AutoPublishBanner>`, `config/page.tsx` L34-39 `<AutoPublishToggle>`,
  `Masthead.tsx` L244 + L340-349 chip ("Publishing automatically…" / "Human approval required"). Wordmark is a `<span>` at
  Masthead.tsx L260-262.
- Test commands: pipeline `cd packages/pipeline && uv run pytest`; dispatch-control `pnpm --filter dispatch-control test`
  (vitest run) and `pnpm --filter dispatch-control build` (strict — vitest does not type-check).
</verified_facts>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Pipeline — one hold helper on every publish path + Gate 1 auto-proceed + API_CONTRACTS</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/issue_hold.py, packages/pipeline/src/eisenbalm_pipeline/api/review.py, packages/pipeline/src/eisenbalm_pipeline/api/control.py, packages/pipeline/src/eisenbalm_pipeline/api/runs.py, packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py, packages/pipeline/src/eisenbalm_pipeline/agents/editor.py, packages/pipeline/tests/test_issue_hold.py, packages/pipeline/tests/test_review_endpoints.py, packages/pipeline/tests/test_scheduler.py, packages/pipeline/tests/test_publish_bridge.py, packages/pipeline/tests/api/test_webhook_sanity.py, packages/pipeline/tests/agents/test_editor.py, packages/pipeline/tests/test_editor_gate_1_resume.py, packages/pipeline/tests/test_checkpoint_resume_phase46.py, docs/API_CONTRACTS.md</files>
  <behavior>
    - is_issue_held: row {held: True} → True; {held: False}, None, {} , non-dict, or issue_number None → False; query exception propagates
    - assert_not_held: held → HTTPException 409 detail {"reason":"held","message":"This issue is on hold. Release the hold to publish."}; query raises → 503 detail {"reason":"hold_unknown", ...}; not held → returns None
    - POST /issues/{run}/publish with held issue → 409 reason held, `_flip_sanity_published` NOT called, no reviewActions row
    - POST /issues/{run}/schedule with held issue → 409 reason held, `runs:setScheduledPublish` NOT called
    - POST /issues/{run}/publish-manual and POST /run/{run}/publish with held issue → 409 reason held, `_run_publisher` NOT spawned, no audit row
    - tick sweep with a due run whose issue is held → no `_flip_sanity_published`, scheduledPublishAt cleared (set to None), audit `run.scheduled_publish_skipped_held` emitted, run NOT in scheduledPublished; un-held due run still publishes
    - Sanity webhook status=published, runId present, issue held, run status != complete → `_revert_sanity_status(..., status="in-review")` called, `_run_publisher` NOT scheduled, idempotency "publisher-run" claim NOT taken, 200 {"ok":True,"blocked":"held"}
    - Sanity webhook for a held issue whose run is already `complete` → NOT reverted (hold never unpublishes a live issue)
    - editor_gate_1 with narrow gap + low confidence + requiresHumanInput=True → no interrupt, no awaiting-review write, winner = deterministic top
    - editor_gate_1 with no candidates → raises RuntimeError (run goes failed via the wrapper), no awaiting-review write, interrupt never called
  </behavior>
  <action>
**1a. Helper `lib/issue_hold.py` (new, per Claude's-discretion: one shared helper).**
`import eisenbalm_pipeline.lib.convex_client as _cc`; `WORKSPACE_ID = "eisenbalm"`;
`HELD_DETAIL = {"reason": "held", "message": "This issue is on hold. Release the hold to publish."}`;
`async def is_issue_held(http, issue_number) -> bool` — return False if issue_number is None; else
`row = await _cc.convex_query(http, "issues:byIssueNumber", {"workspace_id": WORKSPACE_ID, "issueNumber": int(issue_number)})`;
return `isinstance(row, dict) and row.get("held") is True` (a missing row = legacy/never-held = not held). Let exceptions propagate.
`async def assert_not_held(http, issue_number) -> None` — wraps is_issue_held; on exception log.exception and raise
`HTTPException(503, detail={"reason": "hold_unknown", "message": "Could not confirm whether this issue is on hold. Try again."})`
(fail CLOSED — hold is the only gate left); if held raise `HTTPException(409, detail=HELD_DETAIL)`.

**1b. Wire it (CONTEXT "SERVER HOLD ENFORCEMENT").**
- `review.py publish_issue`: after the status guard and sanityIssueId guard, BEFORE `_flip_sanity_published`:
  `await assert_not_held(http, run.get("issueNumber"))`. Same in `schedule_issue` before `runs:setScheduledPublish`.
  Update both docstrings' guard lists, and the module docstring line "(plus hold where enforced)" → "and hold (409 reason held)".
- `control.py publish_manual`: after resolving `issue` (404 check), BEFORE `_emit_audit`/`spawn_background`:
  `await assert_not_held(http, issue.get("issueNumber"))`.
- `runs.py manual_publish`: same placement after its Sanity issue lookup; use the app's convex http (same pattern the
  module already uses — `getattr(request.app.state, "convex_http", None)`).
- `control.py` tick sweep, inside the per-run try, after `pr` lookup and before `_flip_sanity_published`:
  `if await is_issue_held(http, (pr or {}).get("issueNumber")):` → clear `scheduledPublishAt` (same `runs:setScheduledPublish`
  None call), `await _emit_audit(http, actor_id="scheduler", action="run.scheduled_publish_skipped_held", resource_type="run", resource_id=r["runId"])`,
  log.info, `continue`. Clearing the schedule is deliberate: releasing a hold must NOT silently publish a past-due schedule;
  the editor re-schedules. A query error is already caught by the per-run except → that run is skipped this tick (not published, not cleared).
- `webhooks.py sanity_publish`: AFTER the `run_id is None` block and BEFORE the self-echo `claim_idempotency_key(source="publisher-run")`:
  query `pipelineRuns:byRunId` (convex_http); if the run's status != "complete", call `is_issue_held(convex_http, issue_number)`;
  if held → `_revert_sanity_status(sanity_http, issue_id, status="in-review")` (try/except log like no_run_id), `_emit_audit(convex_http, actor_id="webhook", action="run.publish_blocked_held", resource_type="run", resource_id=issue_id, after=json.dumps({"reason": "held"}))`,
  return `{"ok": True, "blocked": "held"}`. Wrap the run+hold lookup in try/except: on error log.warning and PROCEED
  (fail-open here — the webhook must return 200, and the dashboard/tick paths already enforced hold fail-closed before flipping;
  a Convex blip must not silently un-publish a legit click). Webhook always returns 200.

**1c. Gate 1 auto-proceed (decision 3).** In `agents/editor.py editor_gate_1`:
- Delete the `interrupt_triggered` block entirely (the awaiting-review write, `interrupt(...)`, resume-value parsing, and the
  status-back-to-running write). Keep `winner_name = top.get("name", "")`. When the old condition would have fired, just
  `log.info("editor_gate_1: low-confidence pick auto-proceeds (gap=%s conf=%s) — quick 261021-ind", ...)`.
- Replace the `if not candidates:` interrupt branch with: `raise RuntimeError("No candidates survived Scout dedup and verification — start a new run.")`
  (the `@agent_node` wrapper marks the run `failed` with that message; there is no pick to proceed with). Remove the now-dead
  synthetic-winner code in that branch.
- Remove the `interrupt` import if unused. Keep `EDITOR_INTERRUPT_THRESHOLD`/`EDITOR_CONFIDENCE_THRESHOLD` (prompt placeholders).
  Update the module docstring steps 4-5 ("pauses" → "auto-proceeds with the deterministic top score; no human pause since quick 261021-ind").
- Do NOT remove `adjudicate`/`_resume_paused_run`/`/run/{id}/resume` (legacy paused runs; UI removal is Part B).

**1d. Tests.**
- New `tests/test_issue_hold.py`: helper unit tests (behaviors 1-2) using a monkeypatched `eisenbalm_pipeline.lib.convex_client.convex_query`.
- Add one held-path test per publish path in the existing files (mirror their app/mock setup; make the mock return
  `{"held": True, ...}` for path `"issues:byIssueNumber"`): test_review_endpoints.py (publish + schedule), test_publish_bridge.py
  (publish-manual; add manual_publish there too if runs.py's route is reachable from its fixture, else in test_issue_hold.py with a
  minimal FastAPI app including the runs router), test_scheduler.py (held due run skipped + cleared + un-held one still flips),
  api/test_webhook_sanity.py (held → reverted/blocked; held + run complete → not reverted).
- Existing mocks that raise on unknown paths must return None for `issues:byIssueNumber`; mocks returning `{}` are already fine.
- tests/agents/test_editor.py: rewrite `test_interrupt_threshold_triggers` → `test_low_confidence_auto_proceeds` (interrupt
  patched to fail the test if called; no `awaiting-review` updateStatus call; winner is top); rewrite
  `test_editor_gate_1_no_candidates_triggers_recoverable_interrupt` → raises RuntimeError with no awaiting-review write; delete
  `test_editor_gate_1_no_candidates_resume_builds_synthetic_winner`.
- tests/test_editor_gate_1_resume.py and tests/test_checkpoint_resume_phase46.py (both already skip without SUPABASE_POSTGRES_URL):
  change module `pytestmark` to an unconditional `pytest.mark.skip(reason="Gate 1 auto-proceeds since quick 261021-ind — no interrupt to resume")`.

**1e. docs/API_CONTRACTS.md** — append a `## Quick 261021-ind — Server-enforced hold + Gate 1 auto-proceed` section after the
261021-7aw section: the held 409 shape and 503 hold_unknown; the six paths and their behavior (tick: skip + clear schedule +
audit; webhook: revert to in-review + `blocked: "held"`, never reverts a `complete` run, fail-open on lookup error); Gate 1 no
longer pauses (all-candidates-killed → run fails), `adjudicate`/`resume` retained for legacy paused runs. Add a one-line
"Amended by quick 261021-ind" pointer under the existing `POST /issues/{run_id}/publish` (~L2317) and Phase 34 publish-gate sections.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest -q 2>&1 | tail -5 && grep -n "assert_not_held\|is_issue_held" src/eisenbalm_pipeline/api/review.py src/eisenbalm_pipeline/api/control.py src/eisenbalm_pipeline/api/runs.py src/eisenbalm_pipeline/api/webhooks.py && ! grep -n "interrupt(" src/eisenbalm_pipeline/agents/editor.py</automated>
  </verify>
  <done>Full pipeline suite green (baseline 939 passed + new tests; skips only for SUPABASE-gated modules). Six publish paths reference the helper; editor.py contains no interrupt() call; API_CONTRACTS has the new section.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: dispatch-control — derivations, /run GatesPanel, My Tasks, Awaiting-you inbox, DecisionRail hold + double-publish</name>
  <files>apps/dispatch-control/lib/derivedState.ts, apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx, apps/dispatch-control/app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx, apps/dispatch-control/components/AwaitingYouInbox.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx, apps/dispatch-control/__tests__/derivedState.test.ts, apps/dispatch-control/__tests__/RunScreen.test.tsx, apps/dispatch-control/__tests__/MyTasksScreen.test.tsx, apps/dispatch-control/__tests__/AwaitingYouInbox.test.tsx, apps/dispatch-control/__tests__/DecisionRail.test.tsx, apps/dispatch-control/__tests__/DecisionRail.roleGate.test.tsx, apps/dispatch-control/__tests__/Masthead.test.tsx</files>
  <behavior>
    - deriveIssueStatus: awaiting-review + runCompletedAt set + not held → 'ready' with NO sign-offs; runStatus 'complete' → 'published'; held → 'held'; Gate-1-paused (completedAt null) or running → 'needs-review'/'draft' as below; signOffs undefined no longer forces 'unknown'
    - deriveTasks: never emits signoff-facts / signoff-voice; returns [] when published (runStatus complete or issue.published); no task has severity 'must-fix' except the legacy gate1-decision task
    - deriveStageStates: Voice is 'clean' with zero open voice findings and no sign-off; Approval is 'needs-you' (openCount 1) when ready, 'clean' when published, 'in-progress' otherwise
    - MyTasksScreen with a finished awaiting-review run shows no "Choose the charity" task
    - AwaitingYouInbox never lists QA findings or contradicted claims; a finished awaiting-review run shows "Issue N is ready to publish" linking to "/"
    - DecisionRail renders no "Hold" button; Publish/Schedule stay disabled after a successful publish and when the run status is 'complete'
    - /run GatesPanel shows no sign-off / must-fix rows and no "Locked" chip for a finished un-held run
  </behavior>
  <action>
Per CONTEXT "DERIVATIONS (CP-01..03)" and "DecisionRail" items. Keep all exported names and the `DerivationInputs` /
`IssueStatus` / `StageState` types unchanged (many consumers); `signOffs` stays in the input type but no longer drives status.

**lib/derivedState.ts**
- `deriveIssueStatus`: `if (i.issue === undefined) return 'unknown'`; `if (i.issue === null) return 'unknown'`;
  `if (i.issue.published || i.runStatus === 'complete') return 'published'` (the pipeline never sets issues.published —
  mirrors `deriveHomeFooter`); held → 'held'; failed → 'failed'; `if (i.runId === null) return 'draft'`;
  `if (i.runStatus === 'awaiting-review' && i.runCompletedAt != null) return 'ready'`; `if (i.runStatus === 'running') return 'draft'`;
  otherwise `'needs-review'` (only reachable for a legacy run paused at Gate 1 or a not-yet-loaded runStatus — keep it).
  Update the doc comment above it (quick 261021-ind: no sign-offs; ready = finished and not held).
- `deriveTasks`: add an early `if (i.issue?.published || i.runStatus === 'complete') return []`; delete the whole
  `runningOrDone && signOffs` sign-off block; in `findingSeverityToTaskSeverity` map 'error' → 'review-recommended'
  (nothing is must-fix any more); claim tasks: sev always 'review-recommended', title prefix stays, `why` unchanged.
  Keep the `isPausedAtGate1` gate1-decision task (legacy paused runs only; new runs never pause).
- `deriveVoiceStage`: drop the sign-off condition — open voice findings → needs-you; else running → in-progress; else clean.
- `deriveApprovalStage`: published (issue.published || runStatus==='complete') → clean; runId null → not-generated;
  `isPublishable` (awaiting-review && runCompletedAt != null && !issue?.held) → needs-you openCount 1; else in-progress.
  Factor `export function isPublishable(i)` and reuse it in deriveIssueStatus where natural.
- Remove now-unused imports/helpers only if the strict build flags them.

**MyTasksScreen.tsx**: add `runCompletedAt: latest?.completedAt` to its `DerivationInputs` (bug: without it every finished
run reads as paused at Gate 1). Remove any "sign-off" copy in its empty/header states if present (grep "sign-off").

**RunScreen.tsx GatesPanel** (CP-03): replace the two-sign-off/must-fix body with a single "Publishing" panel:
heading "Publishing"; if `gates.held` → "This issue is on hold. Release the hold before publishing."; else if the run is finished
(awaiting-review with completedAt — thread `completedAt` in if not already available on the props) → "Ready to publish." + a
`<Link href="/">Publish from the issue page →</Link>`; else if published (status complete) → "Published."; Gate-1-paused legacy →
"The agents are waiting for the charity choice." Delete `publishBlockReason`, the "Locked" chip, the facts/voice rows, the
"Review contradicted claims →" and "Voice pass →" links and the "Opens when both gates…" copy. Fix the stale comment at
~L532-534 (Publish lives on `/`; DecisionRail remains a secondary path). Change the status-chip map entry only if labels need it
(they don't — 'ready'/'published' already exist). Remove `RunGateInputs` fields that become unused (factsSignedBy, voiceSignedBy,
mustFixTotal) and their producers in the same file.

**AwaitingYouInbox.tsx** (CP-13): delete the qaCorrections and claimChecks.allSignedOff queries and items 1-2 entirely
(agents close every finding; nothing blocks). Item 3: only runs with `status==='awaiting-review' && completedAt != null`,
label `Issue ${run.issueNumber} is ready to publish`, href `/`; runs paused at Gate 1 (completedAt null) → label
`Issue ${run.issueNumber}: choose the charity`, href `/issues/${run.issueNumber}/story` (unchanged destination, Part B moves it).
Failed item label → `Issue ${failedItem.issueNumber}: the run failed` (keep href). No raw runIds in labels. Keep "See all →".

**DecisionRail.tsx** (CP-04, CP-16): delete `handleHold`, the Hold button, and the `rejectIssue` import (the real "Hold issue"
lives in the same issue-frame header via WorkspaceControls). Add `const runRow = useQuery(api.pipelineRuns.byRunId, { runId })`
and `const [publishSent, setPublishSent] = useState(false)`; on publish success `setPublishSent(true)` and message
"Publishing — this can take a minute." (do not reset publishSent); also set it after a successful schedule.
`publishDisabled = !!held || busy || publishSent || runRow?.status === 'complete'`; when status is 'complete' show
"Published." instead of the Publish/Schedule buttons. Remove the blocker-board wording that claims blocking: change
"N blockers to clear · M warnings" to "N agent notes" style neutral copy ONLY if it is a one-line string swap; otherwise leave the
board (Part B deletes Approval).

**Tests**: update derivedState.test.ts (status/tasks/stage expectations per behavior list — delete sign-off-required cases,
add ready-without-signoffs, published-from-complete, no-tasks-after-publish), RunScreen.test.tsx, MyTasksScreen.test.tsx
(add the runCompletedAt regression), AwaitingYouInbox.test.tsx, DecisionRail*.test.tsx (no Hold button; disabled after publish;
mock `api.pipelineRuns.byRunId`), Masthead.test.tsx if its chip/count expectations change.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test 2>&1 | tail -8 && pnpm --filter dispatch-control build 2>&1 | tail -5 && ! grep -n "signoff-facts\|signoff-voice\|sign-off is required" apps/dispatch-control/lib/derivedState.ts && ! grep -n "rejectIssue\|Before it can publish" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/DecisionRail.tsx" "apps/dispatch-control/app/(dashboard)/run/_components/RunScreen.tsx"</automated>
  </verify>
  <done>vitest full suite green and strict `next build` succeeds. A finished un-held run derives 'ready' everywhere; complete derives 'published' with zero tasks; DecisionRail has no fake Hold and latches after publish.</done>
</task>

<task type="auto">
  <name>Task 3: Stale copy rewrite, dead controls hidden, wordmark → /</name>
  <files>apps/dispatch-control/components/help/helpCopy.ts, apps/dispatch-control/components/onboarding/onboardingCopy.ts, apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx, apps/dispatch-control/app/(dashboard)/issues/_components/StartHereCard.tsx, apps/dispatch-control/app/(editorial)/s/[section]/_components/SectionEndNav.tsx, apps/dispatch-control/app/(editorial)/s/[section]/_components/ExemptSectionNote.tsx, apps/dispatch-control/app/(editorial)/s/[section]/_components/InPlaceBlockEditor.tsx, apps/dispatch-control/app/(editorial)/s/[section]/page.tsx, apps/dispatch-control/components/galley/Galley.tsx, apps/dispatch-control/components/inspector/InspectorProvider.tsx, apps/dispatch-control/components/inspector/InspectorContainer.tsx, apps/dispatch-control/components/inspector/InspectorPanel.tsx, apps/dispatch-control/components/inspector/InspectorFooter.tsx, apps/dispatch-control/app/(editorial)/layout.tsx, apps/dispatch-control/app/(dashboard)/layout.tsx, apps/dispatch-control/app/(dashboard)/config/page.tsx, apps/dispatch-control/components/Masthead.tsx, apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx, apps/dispatch-control/app/(dashboard)/issues/_components/HeldIssueRow.tsx</files>
  <action>
House rule for every rewritten string (Jesse brief: dry, precise, no winking): the model is "The agents write and check every
story and fix what they find. You read and edit anything. The Editor-in-chief presses Publish. Anyone can put the issue on hold."
No string may say findings, claims, errors or sign-offs block/lock Publish, or ask the user to "clear", "verify every claim",
"mark Sounds human", or get "both greens".

**Copy (CONTEXT "STALE COPY", CP-07/08/09):**
- `components/help/helpCopy.ts`: rewrite every entry that teaches a gate (audit lines :21 "'Ready to publish' means both sign-offs…",
  :23, :47, :53, :57) → e.g. "'Ready to publish' means the agents have finished and the issue is not on hold."; sign-off entries →
  "Optional. A record that you read it. It does not affect Publish." Keep keys/exports unchanged (consumers import by key).
- `components/onboarding/onboardingCopy.ts` (:39, :65, :69, :73, :88, :90): rewrite to the model above; step text that says
  "Start on Issues" → "Start on the issue page (the front page of this app)". Keep step ids/count unchanged so OnboardingTour
  and StageHintStrip tests only need string updates.
- `app/(dashboard)/how-to-use/page.tsx`: rewrite steps 3-4 (L62-88) — no Accept fix / Must fix / Sounds human / both greens;
  add one line in the intro that the issue page `/` is where you read, edit and publish (with a `<Link href="/">`).
- `issues/_components/StartHereCard.tsx` (L64-100): replace the per-stage "do this to unlock" copy with one neutral line per stage
  (or a single line pointing to `/`); keep the component's props and the tour/dismiss buttons.
- `s/[section]/_components/SectionEndNav.tsx`: delete the "N of 9 sections still need you" / "All 9 sections are clean" paragraph
  and the `deriveSectionStates` call; keep prev/next links. Drop now-unused props only if the strict build complains (update the
  caller in page.tsx accordingly).
- `s/[section]/_components/ExemptSectionNote.tsx` (L16-25): replace "…carries no inline findings to review here." with a neutral
  "The agents check this section as a whole." (or equivalent) — no reference to reviewing findings.

**Editor opens at the clicked paragraph (CP-09, cheap path):**
- `components/galley/Galley.tsx`: add optional prop `onEditBlock?: (sectionId: string, blockIndex: number) => void`; the
  PassageToolbar `onEditText` becomes `(sel) => onEditBlock ? onEditBlock(sel.sectionId, sel.blockIndex) : onEditSection(sel.sectionId)`.
  Other Galley consumers (ReviewDeskRunView, VoicePassRunView) are untouched.
- `s/[section]/page.tsx`: pass `onEditBlock={(sid, bi) => { const n = blocksForSection(sid).length; setEditingTarget({ sectionId: sid, blockIndex: bi >= 0 && bi < n ? bi : 0, isFallback: !(bi >= 0 && bi < n) }) }}`;
  keep `onEditSection={openInPlaceEditor}` as the fallback; update the comment above openInPlaceEditor.
- `InPlaceBlockEditor.tsx` L136-138: fallback note → "Opened the first paragraph of this section." (no "Edit myself").

**Dead controls (CONTEXT "DEAD CONTROLS", CP-10, CP-19):**
- Inspector revise: add `revisionEnabled?: boolean` (default `true`) to `InspectorProvider` props + context value;
  `(editorial)/layout.tsx` renders `<InspectorProvider revisionEnabled={false}>`; `InspectorContainer` passes
  `onRequestRevision={revisionEnabled ? requestRevision : undefined}` and a `hideRevise={!revisionEnabled}` prop through
  `InspectorPanel` to `InspectorFooter`, which then does NOT render the "Ask agent to revise" row at all (instead of the reserved
  state). Dashboard behavior unchanged.
- Auto-publish (decision 4 — hide, keep backend): remove the `<AutoPublishBanner>` mount from `(dashboard)/layout.tsx` and the
  `<AutoPublishToggle>` block from `config/page.tsx` (leave both component files and the `auto_publish` config key/loader in place;
  add a one-line comment at each removal site: "Hidden per quick 261021-ind (auto-publish returns later)"). In `Masthead.tsx`
  remove the auto-publish chip (L340-349) and the `autoPublish` read (L244) plus any query used only for it.
- Hold release wording: in `WorkspaceControls.tsx` and `HeldIssueRow.tsx` relabel the "Reopen" button to "Release hold"
  (behavior unchanged — any signed-in role may release, decision 2). Update matching test strings.

**Nav (CP-06):** `Masthead.tsx` wordmark `<span>` (L260-262) → `next/link` `<Link href="/" aria-label="Back to this week's issue">`
with the same classes plus `no-underline` and a visible focus ring; keep the DISPATCH/CONTROL markup.

**Tests:** update string assertions in __tests__/how-to-use.test.ts, nomenclature.test.ts (only if it asserts removed strings),
StageHintStrip.test.tsx, OnboardingTour.test.tsx, StartHereCard.test.tsx, SectionReaderPage.test.tsx (add: selecting block 2 then
"Edit text" opens block 2), Galley.test.tsx / PassageToolbar.test.tsx if affected, InspectorFooter/InspectorPanel/InspectorProvider
tests (add: revisionEnabled=false hides "Ask agent to revise"), Masthead.test.tsx (wordmark is a link to "/"; no auto-publish chip).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test 2>&1 | tail -8 && pnpm --filter dispatch-control build 2>&1 | tail -5 && ! grep -rn "Edit myself\|both greens\|Both Facts cleared\|Publishing is blocked\|Publish stays locked\|still need you\|both sign-offs are cleared" apps/dispatch-control/components apps/dispatch-control/app --include='*.ts' --include='*.tsx' | grep -v __tests__</automated>
  </verify>
  <done>vitest green and strict build succeeds; the grep for gate vocabulary returns nothing outside tests; the wordmark links to `/`; Auto-publish UI is hidden while its component files and backend config remain; "Ask agent to revise" is absent on `/s/[section]`; the section editor opens at the selected paragraph.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest -q` — all green.
- `pnpm --filter dispatch-control test` and `pnpm --filter dispatch-control build` — both green (memory: vitest does not type-check).
- No `convex/` files change in this plan, so `pnpm --filter @eisenbalm/convex dev:once` is NOT required. If the executor ends up
  touching `convex/*.ts` anyway, run it before declaring done.
- grep: `assert_not_held|is_issue_held` appears in review.py, control.py (x2), runs.py, webhooks.py.
- Pipeline changes are NOT live until Railway redeploys; note that in the SUMMARY (do not push/deploy).
</verification>

<success_criteria>
- Holding an issue blocks publish/schedule/publish-manual/manual_publish (409 reason held), the tick sweep (skip + clear), and Studio flips (revert + blocked: held).
- New runs never pause at Gate 1.
- The console's status chip, My Tasks, inbox, /run and stage tabs agree with the front door: Ready → Published, no sign-off tasks.
- No UI text claims a content gate; dead controls (fake Hold, Ask agent to revise on the editor path, Auto-publish UI) are gone; wordmark returns to `/`.
</success_criteria>

<output>
After completion, create `.planning/quick/261021-ind-dashboard-simplification-a-server-hold-e/261021-ind-SUMMARY.md`
</output>
