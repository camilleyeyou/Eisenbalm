---
status: passed
phase: 49-roles-permissions
verified: 2026-07-16T23:14:50Z
score: 4/4 must-haves verified
note: >
  This file holds the Plan 49-02 empirical claim-propagation gate and the
  Plan 49-09 Collaborator UX human-verify log ABOVE the phase-level
  gsd-verifier report. The "Empirical claim-propagation gate (ROL-01)"
  section and the "Collaborator UX human-verify (Plan 49-09 Task 3)" section
  are load-bearing human observations — PRESERVE THEM VERBATIM on any future
  edit to this file (Plan 49-09 Task 3 greps for the ROL-01 heading).
human_verification:
  - test: "FastAPI live-token leg of the empirical claim-propagation gate — confirm claims[\"role\"] on a real editor and collaborator Clerk token reaching a deployed pipeline (not the local-dev sentinel)."
    expected: "Editor token reaches the normal path (200) on apply-revision/evidence-apply/sounds-human-signoff/publish; Collaborator token is rejected 403 {reason:\"forbidden_role\"} on the same four."
    why_human: "Pipeline is unreachable from local (NEXT_PUBLIC_PIPELINE_URL unset) — this leg cannot be exercised until the pipeline is deployed/reachable. Enforcement code is unit-test-covered (packages/pipeline/tests/api/test_role_gate.py, green in the full pytest run) and reads a standard JWT claim with no known silent-drop mechanism, so this is a low-risk tracked residual, not a blocking gap."
---

## Empirical claim-propagation gate (ROL-01)

**Date:** 2026-07-16
**Env:** local `dispatch-control` (`http://localhost:3001`, `next dev`) authenticated against the **real Clerk test instance** (`pk_test…`) and the **real Convex deployment** (`NEXT_PUBLIC_CONVEX_URL`). This is a real token-minting path — NOT the FastAPI `local-dev-operator` sentinel (`control.py:142`), which is the path the plan warns cannot prove propagation.
**Method:** behavioral — observed gate outcomes on a Convex-gated action plus client-side `useRole()` lock rendering. (Raw `JSON.stringify(getUserIdentity())` logging was not needed; the gate behavior is decisive — see below.)

### Observed

| Role (Clerk `publicMetadata.role`) | Action attempted | Outcome | What it proves |
|---|---|---|---|
| `Editor-in-chief` | Prompt Lab → **Make active** (`promptVersions.activate` → `requireEditor`) | **Permitted** | `role: "Editor-in-chief"` reached `ctx.auth.getUserIdentity()`. A dropped/undefined claim (convex-js ≥1.34 Pitfall 1) would have **also blocked the editor** because `requireEditor` fails closed — so editor-passes definitively retires the silent-drop landmine on the Convex surface. |
| `Collaborator` | Prompt Lab → **Make active** (same action) | **Blocked / control rendered locked** | Non-editor is refused (SC-1/SC-2 enforcement holds). The control rendered **locked-with-explanation** (not hidden), which the client's `useRole()` reads from the **session-token** `role` claim ⇒ `role: "Collaborator"` propagated on the session surface too (ROL-03). |

### Surface coverage

- **Convex surface (`ctx.auth.getUserIdentity().role`) + client session-token claim:** ✅ **empirically confirmed** for both roles (table above). This is the surface carrying the actual Pitfall-1 risk, and it is retired.
- **FastAPI surface (`claims["role"]` in `_require_editor`, `control.py:144`):** ⚠️ **not exercised with a live token in this run** — the pipeline is not reachable from local (`NEXT_PUBLIC_PIPELINE_URL` unset). Enforcement is covered by unit tests (`packages/pipeline/tests/api/test_role_gate.py`, full `pytest` green) and reads a **standard JWT claim** with no analogous silent-drop mechanism. **Residual manual check:** confirm `claims["role"]` on a live editor/collaborator token once the pipeline is deployed/reachable.

**Verdict:** ROL-01 empirical gate **PASS on the at-risk (Convex) surface**; FastAPI live-token spot-check recorded as a residual follow-up (test-covered, low-risk).

## Collaborator UX human-verify (Plan 49-09 Task 3)

_(log — appended as checks are performed)_

- 2026-07-16 — Locked-control rendering (ROL-03): **PASS** — as `Collaborator`, Prompt Lab **Make active** renders present-but-locked (not hidden) and is refused server-side. Verified on the prompt-lab control; the remaining five controls' locked rendering is covered by automated tests (`RevisionFlow.roleGate.test.tsx`, `DecisionRail.roleGate.test.tsx`) + the `roleGateInventory.test.ts` source-scan.
- 2026-07-16 — Comment affordance (ROL-04): **PASS** — as `Collaborator`, the Comments box renders on `/my-tasks` and a submitted comment appears. Confirms the positive "read-everything-and-comment" capability is reachable and functional (not editor-gated).

**Task 3 verdict:** Collaborator UX **signed off** — locked-with-explanation control rendering (ROL-03) + reachable/functional comment affordance (ROL-04), with the empirical claim-propagation gate (ROL-01) on record above.

---

# Phase 49: Roles & Permissions — Goal-Backward Verification Report

**Phase Goal:** Every action gated to Editor-in-chief across the workspace is enforced server-side, not just hidden in the UI, and a Collaborator sees exactly what they can't do and why.
**Verified:** 2026-07-16T23:14:50Z
**Status:** passed
**Re-verification:** No — initial phase-level gsd-verifier pass (the sections above are prior human-verification records from Plans 49-02/49-09, preserved verbatim, not superseded).

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| SC-1 | Role checks enforced server-side; a Collaborator's direct API call to a gated action is rejected, not merely hidden client-side | ✓ VERIFIED | `_require_editor` (FastAPI, `control.py:138-149`) checks `claims.get("role") != "Editor-in-chief"` → 403 `{reason:"forbidden_role"}`; `requireEditor` (Convex, `convex/lib/auth.ts:65-72`) checks `identity.role !== 'Editor-in-chief'` → throws `ConvexError`, fails closed on missing identity/role. Both independent of client UI state. Unit-tested: `packages/pipeline/tests/api/test_role_gate.py` (7 tests, collaborator-403 + editor-pass + sentinel-regression, all green in the recorded pytest run). Empirically confirmed on the Convex surface (ROL-01 log above). |
| SC-2 | EXACTLY six actions gated to Editor-in-chief | ✓ VERIFIED | `apps/dispatch-control/__tests__/roleGateInventory.test.ts` — re-ran directly this pass: **4/4 tests pass** (see Behavioral Spot-Checks below). Asserts `Depends(_require_editor)` in exactly `revision.py`, `factcheck.py`, `review.py` (count==3); `signoffs.py` gates `sounds-human` in-handler, NOT via route `Depends`; `requireEditor(ctx)` in exactly `promptVersions.ts` and `charities.ts` (count==2, excluding the `lib/auth.ts` definition). Manually cross-checked each call site by reading the source (see Required Artifacts table). |
| SC-3 | A Collaborator sees every gated control rendered and LOCKED with an explanation, never hidden | ✓ VERIFIED | `LockedControl.tsx` clones the real interactive child with `disabled` + `aria-disabled` + `aria-describedby` pointing at a visible `<span role="note">` explanation (never a CSS-only inert overlay, never `display:none`) — renders the child unconditionally, only toggling the locked wrapper. All six controls wired with verbatim §6 labels (confirmed by direct grep, see below). Empirically confirmed for one control (Prompt Lab "Make active") in the Collaborator UX log above; remaining five covered by `RevisionFlow.roleGate.test.tsx` / `DecisionRail.roleGate.test.tsx` automated tests per 49-09 SUMMARY. |
| SC-4 | A Collaborator can read every screen and leave comments | ✓ VERIFIED | `convex/comments.ts::add` accepts any authenticated identity (no role check — the one write both roles share); `listByIssueNumber` is unguarded (read-open to both). `IssueComments.tsx` mounted in both `app/(dashboard)/issues/[issueNumber]/layout.tsx` (every issue-scoped stage screen) and `app/(dashboard)/my-tasks/_components/MyTasksScreen.tsx`. Empirically confirmed: comment box renders on `/my-tasks` and a submitted comment appears (Collaborator UX log above). |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `packages/pipeline/src/eisenbalm_pipeline/api/control.py` | Defines `_require_editor` dependency | ✓ VERIFIED | Lines 138-149: layered on `_require_clerk_jwt_control`; local-dev sentinel (`sub=="local-dev-operator"`) short-circuits to editor; else requires `claims["role"]=="Editor-in-chief"`, else 403 `{reason:"forbidden_role"}`. |
| `packages/pipeline/src/eisenbalm_pipeline/api/revision.py` | `Depends(_require_editor)` on apply-revision route | ✓ VERIFIED | Import at line 51, `Depends(_require_editor)` at line 360 (apply route). |
| `packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py` | `Depends(_require_editor)` on evidence-apply route | ✓ VERIFIED | Import at line 56, `Depends(_require_editor)` at line 552 (`apply_claim_evidence`). |
| `packages/pipeline/src/eisenbalm_pipeline/api/review.py` | `Depends(_require_editor)` on publish route | ✓ VERIFIED | Import at line 45, `Depends(_require_editor)` at line 73 (`publish_issue`). |
| `packages/pipeline/src/eisenbalm_pipeline/api/signoffs.py` | In-handler `kind=="sounds-human"` role branch, NOT a route `Depends` swap | ✓ VERIFIED | Lines 138-150: branch inside `record_sign_off`, gates only `sounds-human` (facts-cleared stays ungated per D-06/Open Q2); same sentinel + 403 shape as `_require_editor`. |
| `convex/lib/auth.ts` | Defines `requireEditor(ctx)` | ✓ VERIFIED | Lines 65-72: independent of `requireOperator` (not a wrapper), fails closed on missing identity or non-matching role, throws `ConvexError({code:'forbidden_role',...})`. |
| `convex/promptVersions.ts` | `requireEditor(ctx)` on `activate` mutation | ✓ VERIFIED | Import at line 20, call at line 281 inside `activate`. |
| `convex/charities.ts` | `requireEditor(ctx)` on `setStatus` mutation | ✓ VERIFIED | Import at line 22, call at line 192 inside `setStatus`. |
| `apps/dispatch-control/components/LockedControl.tsx` | Reusable locked-with-explanation wrapper, a11y-safe | ✓ VERIFIED | Clones real child with `disabled`+`aria-disabled`+`aria-describedby`; visible `<span role="note">` explanation; never a CSS-only inert overlay. |
| `apps/dispatch-control/lib/role.ts` | `useRole()` / `useIsEditor()` client hook | ✓ VERIFIED | Presentation-only per D-11 (docstring explicit); reads Clerk `publicMetadata.role`; returns `undefined` while loading (no flash-lock for editors). |
| Six `LockedControl` wiring sites (RevisionFlow/RevisionComparisonCard, FactCheckScreen, VoicePassRail, DecisionRail, ReviewDecisionPanel(legacy), VersionHistoryPanel, RegistryTable) | Verbatim §6 locked labels | ✓ VERIFIED | Grepped labels: `"Apply revision 🔒 editor only"` (RevisionFlow→RevisionComparisonCard, FactCheckScreen), `"Voice approval 🔒 Editor-in-chief only"` (VoicePassRail), `"Collaborators can review and comment, not publish."` (DecisionRail + legacy ReviewDecisionPanel), `"Make active 🔒 Editor-in-chief only"` (VersionHistoryPanel), `"🔒 editor only"` (RegistryTable) — all match D-09 verbatim. |
| `convex/comments.ts` | `add` (any identity) + `listByIssueNumber` (unguarded) | ✓ VERIFIED | `add` checks only `ctx.auth.getUserIdentity()` truthiness (no role check); `authorId` always server-derived from `identity.subject`, never client-supplied. `listByIssueNumber` has no auth check at all. Append-only (no update/patch/delete exported). |
| `convex/schema.ts` `comments` table | Matches `convex/comments.ts` field usage | ✓ VERIFIED | Lines 586-597: `workspace_id, issueNumber, stage?, anchorRef?, text, authorId, createdAt` + two indices (`by_workspace_issueNumber`, `by_workspace`) — exact match to the mutation/query field usage. |
| `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/_components/IssueComments.tsx` | Comment affordance component | ✓ VERIFIED | Present; mounted in `layout.tsx` (issue-scoped stages) and `MyTasksScreen.tsx`. |
| `apps/dispatch-control/__tests__/roleGateInventory.test.ts` | Durable exactly-six source-scan tripwire | ✓ VERIFIED | Present; re-ran this pass — 4/4 pass (see below). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `RevisionFlow.tsx` / `RevisionComparisonCard.tsx` | Server (`Depends(_require_editor)` on apply-revision) | `<LockedControl>` wraps Apply-revision button, client `useRole()` decides `isLocked` | ✓ WIRED | Client lock is presentation-only per D-11; server is authoritative and independently enforces (confirmed by artifact check + unit tests). |
| `FactCheckScreen.tsx` | Server (`Depends(_require_editor)` on evidence-apply) | `<LockedControl>` at line 160 | ✓ WIRED | Same pattern. |
| `VoicePassRail.tsx` | Server (`kind=="sounds-human"` in-handler branch) | `<LockedControl>` at line 193 | ✓ WIRED | Same pattern; facts-cleared sign-off correctly left ungated on both client and server per D-06. |
| `DecisionRail.tsx` + legacy `ReviewDecisionPanel.tsx` | Server (`Depends(_require_editor)` on publish) | `<LockedControl>` (both files) | ✓ WIRED | Both the current and legacy publish surfaces gated — no orphaned bypass path. |
| `VersionHistoryPanel.tsx` | Convex (`requireEditor(ctx)` on `promptVersions.activate`) | `<LockedControl>` at line 262 + `useMutation(api.promptVersions.activate)` | ✓ WIRED | Empirically confirmed end-to-end (ROL-01 log: editor permitted, collaborator blocked + locked render). |
| `RegistryTable.tsx` | Convex (`requireEditor(ctx)` on `charities.setStatus`) | `<LockedControl>` at line 276 | ✓ WIRED | Same server gate pattern as VersionHistoryPanel; not independently empirically re-tested this pass (covered by roleGateInventory + unit tests). |
| `IssueComments.tsx` | Convex (`comments.add` / `comments.listByIssueNumber`) | direct `useMutation`/`useQuery` | ✓ WIRED | Mounted in two screens; empirically confirmed functional on `/my-tasks` (Collaborator UX log above). |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| ROL-01 | 49-02, 49-03, 49-04 | Server-side role enforcement, not client-hidden | ✓ SATISFIED | `_require_editor` + `requireEditor` fail-closed server gates; empirically confirmed on the Convex surface; FastAPI live-token leg is a tracked residual (test-covered, not exercised live — see Human Verification below). |
| ROL-02 | 49-03, 49-04, 49-09 | Exactly six actions gated | ✓ SATISFIED | `roleGateInventory.test.ts` tripwire, re-run this pass, 4/4 green. |
| ROL-03 | 49-06, 49-07 | Locked-with-explanation rendering, never hidden | ✓ SATISFIED | `LockedControl` a11y-safe implementation + all six sites wired with verbatim §6 labels; one control empirically confirmed. |
| ROL-04 | 49-05, 49-08 | Collaborator reads everything + comments | ✓ SATISFIED | `comments.ts` (any-identity write, unguarded read) + `IssueComments` mounted workspace-wide; empirically confirmed functional. |

No orphaned requirements found — `.planning/REQUIREMENTS.md` maps only ROL-01..04 to Phase 49, and all four appear in plan frontmatter (`requirements-completed` across 49-01 through 49-09).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| SC-2 exactly-six tripwire still green | `cd apps/dispatch-control && pnpm vitest run __tests__/roleGateInventory.test.ts` | `4 tests passed (4)`, exit 0 | ✓ PASS |
| FastAPI role-gate unit coverage exists and is comprehensive | `grep -n "def test_" packages/pipeline/tests/api/test_role_gate.py` | 7 test functions: collaborator-403 (parametrized across the 3 `Depends` routes), editor-reaches-normal-path, sentinel-regression, plus 4 dedicated `signoffs` sounds-human/facts-cleared tests | ✓ PASS |
| `comments` schema/mutation field parity | direct read of `convex/schema.ts:586-597` vs `convex/comments.ts` | Exact field match, both indices present | ✓ PASS |

Full pytest (692 passed / 38 skipped) and full dispatch-control vitest (959 passed) were NOT re-run this pass per the task instructions (already confirmed green in Plan 49-09 Task 2, same commit tree, no phase-relevant files changed since).

### Anti-Patterns Found

None. No `TODO`/`FIXME`/placeholder markers, no empty handlers, no hidden-not-locked patterns, and no client-only gating (every client lock is paired with a confirmed server-side check) found in any of the phase's touched files during this review.

### Human Verification Required

### 1. FastAPI live-token leg of the empirical claim-propagation gate (ROL-01 residual)

**Test:** With the pipeline deployed/reachable, sign in as an Editor-in-chief and attempt apply-revision, evidence-apply, sounds-human sign-off, and publish; repeat as a Collaborator.
**Expected:** Editor requests reach the normal 200 path; Collaborator requests are rejected `403 {reason:"forbidden_role"}` on all four.
**Why human:** `NEXT_PUBLIC_PIPELINE_URL` is unset locally, so the pipeline is unreachable from the dev environment this phase was built/verified in — the live-JWT-claims code path (`claims["role"]` in `_require_editor`) can only be exercised against a real deployed FastAPI instance with a real Clerk-issued bearer token. This is not a gap in the implementation: the code path is fully unit-tested (`packages/pipeline/tests/api/test_role_gate.py`, green) and reads a standard, well-understood JWT claim — the Convex surface was the one carrying the actual known risk (convex-js ≥1.34 silent-claim-drop), and that surface IS empirically confirmed. Recorded here as a tracked follow-up for whenever the pipeline is next deployed/reachable from a verifier's environment — does not block phase completion.

### Gaps Summary

No gaps. All four success criteria are satisfied by direct code inspection: server-side gates exist at exactly the six specified sites (confirmed by reading each file and by the passing `roleGateInventory.test.ts` tripwire), the locked-control rendering pattern is accessibility-safe and applied with verbatim labels at all six sites, and the comment capability is genuinely open to both roles (write via any-identity mutation, read via an unguarded query) and mounted across the relevant screens. The one open item — the FastAPI surface's live-token leg — is a recorded, low-risk, test-covered residual (not exercised with a live deployed pipeline), tracked as a human-verification follow-up rather than a phase-blocking gap, consistent with the instructions for this verification pass.

---

*Verified: 2026-07-16T23:14:50Z*
*Verifier: Claude (gsd-verifier)*
