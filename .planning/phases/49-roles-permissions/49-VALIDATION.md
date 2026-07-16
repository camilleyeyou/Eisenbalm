---
phase: 49
slug: roles-permissions
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-16
---

# Phase 49 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 49-RESEARCH.md "## Validation Architecture". The planner fills the
> Per-Task Verification Map once tasks are defined.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (pipeline)** | pytest 7.x (`packages/pipeline`) |
| **Framework (convex/web)** | vitest + convex-test (`convex/__tests__`, `apps/dispatch-control/__tests__`) |
| **Config file** | `packages/pipeline/pyproject.toml`; root `vitest.config.ts` |
| **Quick run command** | `uv run --project packages/pipeline pytest -q` (pipeline) · `pnpm vitest run` (convex/web) |
| **Full suite command** | `uv run --project packages/pipeline pytest` && `pnpm vitest run` && `pnpm --filter dispatch-control build` |
| **Estimated runtime** | ~90–150 seconds |

---

## Sampling Rate

- **After every task commit:** Run the relevant quick command (pytest for FastAPI tasks, `pnpm vitest run` for Convex/web tasks)
- **After every plan wave:** Run the full suite
- **Before `/gsd:verify-work`:** Full suite green + `pnpm --filter dispatch-control build` passes (strict build — memory: vitest does not type-check)
- **Max feedback latency:** ~150 seconds

---

## Per-Task Verification Map

*Planner fills this from the task breakdown. One row per task.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | | | ROL-01..04 | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Success-Criterion → Validation Map (Nyquist)

| SC | Requirement | Validation approach | Automated? |
|----|-------------|---------------------|-----------|
| SC-1 | ROL-01 | pytest: Collaborator-role JWT/sentinel → each of the 4 FastAPI gated routes returns **403** (`revise/apply`, `claims/{i}/evidence/apply`, `sign-off` for `kind="sounds-human"`, `publish`). convex-test: `t.withIdentity({subject, role:'Collaborator'})` → `promptVersions.activate` and `charities.setStatus` **throw**. | ✅ |
| SC-2 | ROL-02 | Enumerate exactly the six actions; a "no other route/mutation newly role-gated" scan (grep for `requireEditor`/`_require_editor` call sites == 6 handlers). Editor-role calls to all six **succeed** (positive path). | ✅ |
| SC-3 | ROL-03 | vitest/RTL: render each of the 6 controls with role=Collaborator → control is present in the DOM (not removed), `disabled`, and the verbatim §6 explanation text is in an accessible node (not tooltip-only). | ✅ |
| SC-4 | ROL-04 | vitest: `comments.add`/`listByIssueNumber` callable by a Collaborator identity (positive); Collaborator can reach every read screen. convex-test for the comments functions; RTL for the affordance mount. | ✅ (mount placement may need one manual check) |

---

## Wave 0 Requirements

- [ ] pytest stubs for the 4 FastAPI routes asserting 403 for a Collaborator-role token (extend existing route test files)
- [ ] convex-test: **update** existing `withIdentity()` calls in `activate.test.ts`, `charitiesDoNotUse.test.ts`, `convexAuthLockdown.test.ts` to carry `role:'Editor-in-chief'` (they will break otherwise), + new negative-path tests with `role:'Collaborator'`
- [ ] convex-test stubs for the net-new `comments` table functions
- [ ] RTL scaffold for the `<LockedControl>` wrapper (present-but-locked assertions)
- [ ] **Wave 0 empirical gate:** verify `ctx.auth.getUserIdentity()` actually returns the `role` claim end-to-end (the convex-js ≥1.34 session-token-vs-template landmine) before building enforcement on it

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Clerk publicMetadata `role` propagates through the live "convex" JWT template + session token | ROL-01 | Requires a real Clerk env + deployed token minting; cannot be asserted by the local sentinel path | In a deployed/preview env, sign in as each role, confirm `getUserIdentity().role` and the FastAPI `claims["role"]` both resolve correctly |
| Comment affordance placement reads well across My Tasks + 5 stages | ROL-04 | Visual/UX judgment on mount placement | Load each screen as a Collaborator, confirm the persistent Comments affordance is reachable and legible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (incl. the convex-test role-identity updates)
- [ ] No watch-mode flags
- [ ] Feedback latency < 150s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
