# Quick Task 261021-ind: Dashboard simplification A — correctness fixes - Context

**Gathered:** 2026-10-21
**Status:** Ready for planning

<domain>
## Task Boundary
Part A of 2. Make the whole app tell the truth under the new rules shipped in quick 261021-7aw
(agents self-fix; Publish gated ONLY by Editor-in-chief role + hold). Part B (separate quick task)
does the route/IA simplification — do NOT delete routes or build /admin hub here.

Source audits (read them):
- .planning/ui-reviews/dashboard-simplification-260921-CLICK-PATH.md (CP-xx findings)
- .planning/ui-reviews/dashboard-simplification-260921-PRODUCT-LENS.md
</domain>

<decisions>
## Client answers (2026-10-21, locked)
1. Collaborators SEE Admin: yes.
2. Releasing a hold is NOT Editor-in-chief-only — any signed-in role may hold/release.
3. Charity choice (Gate 1) must GO AHEAD automatically — pipeline proceeds with the Editor agent's pick; no human pause.
4. Auto-publish: not yet, but soon — hide the toggle/banner from UI for now; keep backend config so it can come back.
5. Runs start from a "Start issue" button for now (automation later). (Button placement on `/` is Part B.)
6. Comments: not really used — remove from editor path (Part B).
7. Finance + Registry are checked weekly — keep and make reachable in admin (Part B).
8. No read-only fact-check view needed — fact-check surfaces can be deleted (Part B).
9. Old URLs may simply redirect (Part B).

## Part A scope (this task)
- SERVER HOLD ENFORCEMENT (CP-05/CP-11): publish, schedule, the scheduled-publish sweep/tick, publish-manual, and the
  Sanity webhook path must refuse when the issue is held (409 {reason:"held"}). Read `held` from Convex issues table
  (convex/schema.ts ~535). Tests for each path.
- DecisionRail "Hold" that calls /reject and never sets held (CP-04): make it set the real hold (same mutation as
  WorkspaceControls) or remove it in favour of the real one. Fix DecisionRail double-publish (CP-16) by disabling until run flips.
- GATE 1 AUTO-PROCEED (answer 3): pipeline editor gate must not pause for human choice; take the Editor agent's
  selection and continue to phase 2. Remove/neutralise the awaiting-review-without-completedAt pause. Update tests.
- DERIVATIONS (CP-01..03): lib/derivedState.ts deriveIssueStatus/deriveTasks/deriveStageStates and RunScreen must use
  new rules: publishable = run finished (awaiting-review with completedAt) and not held; published = runStatus complete
  (or issue.published). No sign-off requirements anywhere. My Tasks must not ask for sign-offs; AwaitingYouInbox must not
  count agent-closed findings (agent-applied/agent-skipped) as blockers.
- STALE COPY (CP-08..10, product-lens #5): helpCopy.ts, onboardingCopy.ts, how-to-use/page.tsx, StartHereCard,
  SectionEndNav "N of 9 sections still need you" — rewrite to the new rules (agents fix; you read, edit, publish).
  Section editor must not refer to "Edit myself" if it no longer exists; editor must open at the clicked paragraph if cheap, else neutral copy.
- DEAD CONTROLS: hide Auto-publish toggle + its red banner (answer 4, keep backend); remove "Ask agent to revise"
  everywhere it no-ops (Inspector on section page).
- NAV (CP-06): add a link back to `/` from the console (make the DISPATCH/CONTROL wordmark link to `/`).

### Claude's Discretion
- Exact 409 shape for held; whether hold check lives in a shared helper (preferred: one helper used by all paths).
</decisions>

<specifics>
- Memory: run `pnpm --filter dispatch-control build` (strict) — vitest doesn't type-check.
- Memory: Convex function changes must be synced: `pnpm --filter @eisenbalm/convex dev:once`.
- Remove gates/rules on BOTH client and server and all callers (Phase 34 half-retirement lesson).
- Update docs/API_CONTRACTS.md for the held 409 and Gate-1 auto-proceed.
</specifics>
