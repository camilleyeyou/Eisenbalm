---
phase: 43
slug: my-tasks-decision-log
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
---

# Phase 43 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (console app) + pytest (pipeline, for any `api/*` decision-write endpoint) |
| **Config file** | `apps/dispatch-control/vitest.config.ts` (present); pipeline `packages/pipeline/pyproject.toml` |
| **Quick run command** | `pnpm --filter dispatch-control test` (console unit/selector tests) |
| **Full suite command** | `pnpm --filter dispatch-control test && pnpm --filter dispatch-control build` (build catches Linux/Vercel-only type errors — see project rule "run strict build before frontend phase done") |
| **Estimated runtime** | ~30–60 seconds (console suite) |

*Convex note: committing `convex/*.ts` ≠ deployed. After any `convex/schema.ts` / `convex/auditLog.ts` change, sync with `pnpm --filter @eisenbalm/convex dev:once` to dev:modest-magpie-797 before declaring done (a prior phase shipped a prod 500 by skipping this).*

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter dispatch-control test`
- **After every plan wave:** Run the full suite command above (test + build)
- **Before `/gsd:verify-work`:** Full suite green + strict build green + Convex synced
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

*Populated by the planner from the Validation Architecture section of `43-RESEARCH.md`. Each TSK requirement maps to at least one grep-/test-verifiable acceptance criterion. Reference targets:*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 43-01-01 | 01 | 1 | TSK-01/02 | unit | `pnpm --filter dispatch-control test derivedState` | ✅ | ⬜ pending |
| 43-0X-XX | — | — | TSK-03 | unit | deep-link href resolves to fact-check/approval (not draft) | ❌ W0 | ⬜ pending |
| 43-0X-XX | — | — | TSK-04 | unit | empty-state renders "Nothing needs you" + Approval link | ❌ W0 | ⬜ pending |
| 43-0X-XX | — | — | TSK-05 | unit | superseded state derives from `run.section_rerolled` audit cross-ref | ❌ W0 | ⬜ pending |
| 43-0X-XX | — | — | TSK-06 | unit + pytest | decision-write helper emits full record; Do-not-use writes audit row w/ reason | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky. The planner replaces the placeholder rows with concrete per-task entries.*

---

## Wave 0 Requirements

- [ ] Console test stubs for the My Tasks screen (empty/populated/superseded/resolved states) and the Decision Log projection — RED-first against the new screen/component.
- [ ] pytest stub(s) for any new/extended `api/*` decision-write endpoint (e.g. Do-not-use reason capture, TSK-06) if the plan routes a content-touching action through the pipeline boundary.
- [ ] Reuse existing `derivedState.test.ts` / `Masthead.test.tsx` / audit tripwire patterns — do not install new frameworks.

*Existing vitest + pytest infrastructure covers all phase requirements; Wave 0 adds test files only.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Decision Log renders actor as a human/agent name in a live session | TSK-06 | Requires a real Clerk user + a real reasoned action against live Convex | Sign in, perform a hold/keep-as-written, open the Decision log in the Approval panel, confirm the row shows name (not Clerk sub), reason, before/after, issue+run |
| "Superseded" appears after a real section re-roll | TSK-05 | Requires triggering `rerun_agent` on a live run | Re-roll a section that had an open task, confirm the task shows superseded + link to the new step, not silent disappearance |

*Remaining phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
