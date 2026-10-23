# Quick Task 261022-x8y: Discard an unpublished issue from dispatch-control - Context

**Gathered:** 2026-10-22
**Status:** Ready for planning

<domain>
## Task Boundary

The editor can throw away the current issue in any unpublished state: being written, paused, ready or held. After that, Home shows "Start a new issue". Trigger (user, 2026-10-22): "We should be able to discard an issue if it does not make sense." Today POST /runs/{id}/cancel returns alreadyTerminal for finished runs, so a ready or held issue can't be thrown away.

</domain>

<decisions>
## Implementation Decisions

### Issue number (user choice)
- Discard REUSES the issue number. The pipeline deletes the unpublished Sanity weeklyIssue draft (`issue-N`, as written by lib/sanity_client.write_issue_draft), so `_resolve_issue_number` (max+1, in api/runs.py) gives the next start the same N.
- Refuse (409, plain message) if the issue was ever published: Sanity status published, a published doc with no `drafts.` prefix, or a publishedAt timestamp. Never delete published content.
- The discarded text is gone for good. The run's step-by-step record (Convex runs, agent_runs, pipelineRuns) is KEPT, so Behind the scenes still shows it as Stopped.

### Backend behaviour
- New endpoint, e.g. POST /runs/{run_id}/discard, with the same auth as cancel (`_require_clerk_jwt_control`) and the same role permission as Stop. Audit action `run.discarded`.
- Running run: request the cooperative cancel (runs:requestCancel). Delete the Sanity draft once the run reaches cancelled. Do it in `_execute_run`'s RunCancelled handling when a discard flag is set, or have the endpoint wait or poll. The planner picks the simplest correct approach and must make sure a late writer can't recreate the draft after deletion.
- Paused, ready or held run: go terminal immediately. Set runs.status='cancelled' with completedAt and pipelineRuns.status='failed' with errorMessage "Discarded by the editor", then delete the draft.
- Release any hold on that issue number (lib/issue_hold.py / Convex issues hold).
- Idempotent: discarding an already-discarded run returns success.

### UI
- A quiet secondary "Discard this issue" control on Home, next to the HoldStopFooter area, shown for writing, checking, ready and held states. It must never add a second cobalt or primary button; exactly one [data-primary] per page stays. Use a bordered or ghost style like the Hold/Stop button.
- It sits behind the existing useConfirm dialog. The copy says plainly that the text is deleted for good and that the next issue will reuse the number. Example: "Discard Issue 48? Everything the writers wrote for it is deleted for good. Nothing reached readers. The next issue you start will be Issue 48 again." Buttons: "Discard it" / "Keep this issue".
- On success, Home moves to the stopped state, which already exists, with the button "Start a new issue". Failure shows a plain one-sentence message, never a raw error.
- Plain words only. The editorCopy, editorStyle and retirement tripwire tests must stay green. Add the copy to COPY in lib/editorState.ts.

### Claude's Discretion
- Endpoint shape and name, and whether Stop and Discard share code.
- Whether Behind-Run also offers Discard. Not required.

</decisions>

<canonical_refs>
## Canonical References

- packages/pipeline/src/eisenbalm_pipeline/api/control.py (cancel_run ~L593, _require_clerk_jwt_control, _emit_audit)
- packages/pipeline/src/eisenbalm_pipeline/api/runs.py (_resolve_issue_number)
- packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (write_issue_draft, issue-N ids)
- packages/pipeline/src/eisenbalm_pipeline/lib/issue_hold.py
- apps/dispatch-control/lib/editorState.ts (COPY, Home slab states)
- apps/dispatch-control/app/(editorial)/_components/{IssueHome,IssueHomeView,HoldStopFooter}.tsx
- The existing client wrapper for /runs/{id}/cancel in apps/dispatch-control/lib/ (find it)
- .planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md (tokens, type sizes 15–17px, no mono caps)

</canonical_refs>
