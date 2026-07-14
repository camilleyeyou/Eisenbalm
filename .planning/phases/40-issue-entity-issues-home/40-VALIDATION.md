---
phase: 40
slug: issue-entity-issues-home
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-14
---

# Phase 40 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `40-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^3.2.0` |
| **Config file** | `apps/dispatch-control/vitest.config.ts` |
| **Quick run command** | `pnpm --filter dispatch-control test -- __tests__/<file>` |
| **Full suite command** | `pnpm --filter dispatch-control test` |
| **Strict type-check (MANDATORY)** | `pnpm --filter dispatch-control build` |
| **Pipeline suite** | `cd packages/pipeline && uv run pytest` |
| **Estimated runtime** | ~60-90 seconds (full vitest suite, ~70 test files) |

**Critical:** vitest does NOT type-check. `pnpm --filter dispatch-control build` (→ `next build`) is a MANDATORY separate gate before this phase is declared done. Phase 27 shipped two latent bugs that only failed on Vercel by skipping this.

**Convex deploy gate:** if any `convex/*.ts` changed, `pnpm --filter @eisenbalm/convex dev:once` must be run against `dev:modest-magpie-797`. Committing Convex functions is NOT deploying them — Phase 39 shipped a prod 500 by skipping this.

**convex-test note:** every new `convex-test`-based test file requires its own `edge-runtime` entry in `vitest.config.ts`'s `environmentMatchGlobs` array. Adding the test file alone is not sufficient.

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter dispatch-control test -- <changed test file>`
- **After every plan wave:** Run `pnpm --filter dispatch-control test` (full suite) + `pnpm --filter dispatch-control build` (strict type-check)
- **Before `/gsd:verify-work`:** Full vitest suite green + `next build` exit 0 + Convex sync completed (if `convex/*.ts` touched)
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

*Populated by gsd-planner during planning. Requirement → test-type mapping is fixed below; task IDs are assigned when plans are written.*

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| ISS-01 | `issues` table CRUD + `ensureByNumber` idempotency | unit (convex-test) | `pnpm --filter dispatch-control test -- __tests__/issues.test.ts` | ❌ W0 | ⬜ pending |
| ISS-01 | Derived-state selectors (stage states, task projection, work remaining) as pure functions | unit | `pnpm --filter dispatch-control test -- __tests__/derivedState.test.ts` | ❌ W0 | ⬜ pending |
| ISS-01 | `IssueCard` renders 5-stage strip + all readouts | component (jsdom) | `pnpm --filter dispatch-control test -- __tests__/IssueCard.test.tsx` | ❌ W0 | ⬜ pending |
| ISS-02 | Run-keyed URL resolves/redirects to issue-keyed URL | unit (resolver fn, not Next.js redirect mechanics) | `pnpm --filter dispatch-control test -- __tests__/issueRouteResolver.test.ts` | ❌ W0 | ⬜ pending |
| ISS-02 | Nav no longer exposes run as a top-level destination; Issues present | unit | `pnpm --filter dispatch-control test -- __tests__/nav.test.ts` | ✅ extend | ⬜ pending |
| ISS-03 | Calibrator repetition-note endpoint | pytest | `cd packages/pipeline && uv run pytest -k repetition` | ❌ W0 | ⬜ pending |
| ISS-03 | "Start it early" calls `triggerRun` with reserved `issueNumber` | component | `pnpm --filter dispatch-control test -- __tests__/ScheduledSlotCard.test.tsx` | ❌ W0 | ⬜ pending |
| ISS-04 | Hold mutation writes `audit_log` row + sets held; reopen clears it | unit (convex-test) | included in `__tests__/issues.test.ts` | ❌ W0 | ⬜ pending |
| ISS-04 | Hold requires a reason (empty reason rejected) | unit + component | `__tests__/issues.test.ts` + `__tests__/HoldDialog.test.tsx` | ❌ W0 | ⬜ pending |
| ISS-05 | Masthead renders 4 separate readouts, never blended; each has label + icon | component | `pnpm --filter dispatch-control test -- __tests__/Masthead.test.tsx` | ✅ extend | ⬜ pending |
| ISS-06 | Load failure renders "State unknown — refresh", never a stale prior value | component | `__tests__/IssueCard.test.tsx` (error-state case) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `docs/API_CONTRACTS.md` §40 — contract-first per the Phase 35/38/39 convention; must exist BEFORE `convex/issues.ts` is written
- [ ] `apps/dispatch-control/__tests__/issues.test.ts` — ISS-01/ISS-04 (`issues` table mutations/queries via `convex-test`)
- [ ] Add `['__tests__/issues.test.ts', 'edge-runtime']` to `vitest.config.ts` `environmentMatchGlobs`
- [ ] `apps/dispatch-control/lib/derivedState.ts` + `__tests__/derivedState.test.ts` — ISS-01/ISS-06 pure selectors (node env, no Convex)
- [ ] `__tests__/IssueCard.test.tsx` — ISS-01/ISS-06
- [ ] `__tests__/ScheduledSlotCard.test.tsx` — ISS-03
- [ ] `__tests__/HoldDialog.test.tsx` — ISS-04
- [ ] `__tests__/issueRouteResolver.test.ts` — ISS-02
- [ ] Pipeline test for the repetition-note endpoint — grep `packages/pipeline/tests/` for the Phase 39 `/registry/coverage-strip` test and mirror its pattern (exact path unconfirmed at research time)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Next.js `redirect()` from a Server Component actually issues a 307 in a live app | ISS-02 | Redirect mechanics need a running server; the resolver function it calls IS unit-tested | Run `pnpm --filter dispatch-control dev`, visit an old run-keyed URL, confirm landing on the issue-keyed URL |
| Four header readouts remain visually separate and legible without color | ISS-05 | Visual/perceptual — automated test asserts structure (label + icon present, distinct nodes), not perception | Load console in greyscale; confirm all four readouts remain distinguishable by label + icon alone |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (`vitest run`, never `vitest --watch`)
- [ ] Feedback latency < 90s
- [ ] `pnpm --filter dispatch-control build` exits 0
- [ ] Convex synced if `convex/*.ts` touched
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
