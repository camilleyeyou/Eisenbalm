---
status: partial
phase: 49-roles-permissions
updated: 2026-07-16
note: >
  This file currently holds the Plan 49-02 empirical claim-propagation gate and the
  Plan 49-09 Collaborator UX human-verify log. The phase-level gsd-verifier report is
  appended below these sections at phase completion — the "Empirical claim-propagation
  gate (ROL-01)" section MUST be preserved (Plan 49-09 Task 3 greps for it).
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
