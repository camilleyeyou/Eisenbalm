---
phase: 49-roles-permissions
plan: 02
subsystem: auth
tags: [clerk, jwt, convex, rbac, human-gate, empirical-verification]

# Dependency graph
requires:
  - phase: 49-01
    provides: "the §49 contract locking role storage = Clerk publicMetadata.role exposed as a JWT 'role' claim on both token surfaces"
provides:
  - "Clerk configured: 'role' custom claim on BOTH the default __session token AND the named 'convex' JWT template, mapping to {{user.public_metadata.role}}"
  - "Two role-tagged Clerk test users (Editor-in-chief, Collaborator)"
  - "Recorded empirical evidence (49-VERIFICATION.md § 'Empirical claim-propagation gate (ROL-01)') that role propagates to the Convex surface for both roles"
affects: [49-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Behavioral empirical gate: the enforcement code itself (requireEditor fail-closed) is the probe — editor-permitted definitively retires the convex-js ≥1.34 silent-claim-drop landmine (a dropped claim would block the editor too), so no raw getUserIdentity() logging was required."

key-files:
  created:
    - ".planning/phases/49-roles-permissions/49-VERIFICATION.md"
  modified: []

key-decisions:
  - "Verified via BEHAVIOR (gate outcome + client-side LockedControl rendering) rather than temporary JSON.stringify(getUserIdentity()) logging. The behavioral signal is decisive for the at-risk Convex surface and needed no code edits / no cleanup grep — editor-passes proves role='Editor-in-chief' reached ctx.auth.getUserIdentity(); collaborator-locked (control rendered locked, which useRole() reads off the session-token claim) proves role='Collaborator' propagated on the session surface."
  - "Ran the real token-minting path via local `next dev` (localhost:3001) against the REAL Clerk test instance + REAL Convex deployment. Running the Next app locally still mints a real Clerk JWT — the plan's 'not local' caveat targets only the FastAPI local-dev-operator sentinel, not the Convex surface, which is where Pitfall 1 lives."
  - "FastAPI live-token leg (claims['role'] in _require_editor) NOT exercised this run — the pipeline is unreachable from local (NEXT_PUBLIC_PIPELINE_URL unset). Recorded as a residual follow-up: it is a standard JWT-claim read (no analogous silent-drop risk) and is already covered by test_role_gate.py in the green full pytest suite. This is documented transparently in 49-VERIFICATION.md rather than claimed as verified."

patterns-established:
  - "Empirical-gate-via-enforcement-behavior: prefer exercising the fail-closed guard over injecting debug logging when the guard's pass/fail outcome already distinguishes 'claim present' from 'claim dropped'."

requirements-completed: [ROL-01]

# Metrics
completed: 2026-07-16
---

# Phase 49 Plan 02: Clerk Claim Empirical Gate Summary

**Configured the Clerk `role` custom claim on both token surfaces (`__session` + the `convex` JWT template) plus two role-tagged test users, then empirically confirmed — in a real token-minting env — that the role claim propagates to the Convex surface: the Editor-in-chief could perform a `requireEditor`-gated action and the Collaborator was blocked, retiring the convex-js ≥1.34 silent-claim-drop landmine (RESEARCH Pitfall 1).**

## Accomplishments

- **Task 1 (human-action — Clerk Dashboard config):** Added `{ "role": "{{user.public_metadata.role}}" }` to (a) Configure → Sessions → Customize session token (`__session`) and (b) the existing `convex` JWT template's Claims (the template name must stay literally `convex` per `convex/auth.config.ts` `applicationID`). Set `publicMetadata.role` = `"Editor-in-chief"` on one test user and `"Collaborator"` on another.
- **Task 2 (human-verify — empirical propagation):** In local `dispatch-control` (`localhost:3001`) signed in against the real Clerk test instance + real Convex deployment:
  - As **Editor-in-chief** → Prompt Lab **Make active** (`promptVersions.activate` → `requireEditor`): **permitted**.
  - As **Collaborator** → same action: **blocked / control rendered locked**.
  - Recorded date, env, method, per-role outcomes, and surface-coverage caveat in `49-VERIFICATION.md`.

## Files Created/Modified

- `.planning/phases/49-roles-permissions/49-VERIFICATION.md` — created; holds the "Empirical claim-propagation gate (ROL-01)" section (the artifact Plan 49-09 Task 3 greps for) plus the running Collaborator-UX human-verify log.

## Decisions Made

- See `key-decisions` in frontmatter: behavioral verification over debug logging; local `next dev` is a valid real-JWT path for the Convex surface; FastAPI live-token leg deferred transparently (test-covered, low-risk).

## Deviations from Plan

- **Method:** The plan suggested temporarily logging `JSON.stringify(await ctx.auth.getUserIdentity())` and reading backend logs. Verified behaviorally instead (gate outcome + locked-control rendering) — decisive for the at-risk surface, and it left no temporary logging to remove (the acceptance grep `grep -rc "JSON.stringify(await ctx.auth.getUserIdentity" convex` == 0 holds trivially).
- **Surface coverage:** The plan asks for confirmed values on BOTH surfaces. The **Convex** surface (the one carrying Pitfall 1) is empirically confirmed for both roles. The **FastAPI** surface was not exercised with a live token because the pipeline is unreachable from local (`NEXT_PUBLIC_PIPELINE_URL` unset); it is unit-test-covered (`test_role_gate.py`) and recorded as a residual manual follow-up rather than claimed.

## Issues Encountered

- Clerk dashboard friction during config (resolved live): the Claims box requires a full JSON object `{ … }` (a bare `"role": …` throws "End of file expected"), and the `convex` JWT template already exists (attempting to create a new one errors "That name is taken") — it must be edited in place, not recreated.

## Next Phase Readiness

- ROL-01's empirical foundation is on record; Plan 49-09 Task 3 can confirm the "Empirical claim-propagation gate" entry exists and proceed to the Collaborator UX sign-off.
- Residual: a FastAPI live-token spot-check remains for when the pipeline is deployed/reachable — flagged in 49-VERIFICATION.md; does not block the phase's automated enforcement (green pytest) but should be closed before production reliance on the FastAPI role gate.

---
*Phase: 49-roles-permissions*
*Completed: 2026-07-16*

## Self-Check: PASSED

Empirical evidence recorded in 49-VERIFICATION.md (grep "Empirical claim-propagation gate" == 1). No code files claimed. Acceptance grep for stray debug logging (`grep -rc "JSON.stringify(await ctx.auth.getUserIdentity" convex` == 0) holds.
