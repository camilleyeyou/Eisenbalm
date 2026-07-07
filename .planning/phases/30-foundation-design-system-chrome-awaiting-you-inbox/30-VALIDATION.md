---
phase: 30
slug: foundation-design-system-chrome-awaiting-you-inbox
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-06
---

# Phase 30 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing — `apps/dispatch-control/vitest.config.ts`) |
| **Config file** | `apps/dispatch-control/vitest.config.ts` |
| **Quick run command** | `pnpm --filter dispatch-control test -- --run` |
| **Full suite command** | `pnpm --filter dispatch-control test -- --run && pnpm --filter dispatch-control build` |
| **Estimated runtime** | ~60–120 seconds (build dominates) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter dispatch-control test -- --run`
- **After every plan wave:** Run full suite including `pnpm --filter dispatch-control build` (per project memory: vitest doesn't type-check — strict build required before declaring frontend work done)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~120 seconds

---

## Per-Task Verification Map

*(Filled by planner — every task must map to a requirement and a check.)*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | — | — | CHR-01 | grep + build | `grep -rn "#17140e" apps/dispatch-control/app/globals.css` + build green | ✅ | ⬜ pending |
| TBD | — | — | CHR-02 | unit + grep | masthead component test (chips render from mocked query data) | ❌ W0 | ⬜ pending |
| TBD | — | — | CHR-03 | grep | nav config lists Review Desk→Registry in order + how-to-use route exists | ✅ | ⬜ pending |
| TBD | — | — | CHR-04 | unit | inbox derivation test (mocked runs/qaCorrections/claimChecks → item list) | ❌ W0 | ⬜ pending |
| TBD | — | — | CHR-05 | manual | deployed test-run panel reaches Railway pipeline API (human) | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Existing vitest infrastructure covers unit tests; new test files for masthead/inbox derivation live in `apps/dispatch-control/__tests__/`

*Existing infrastructure covers all phase requirements — no new framework needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 1c visual fidelity vs dc.html | CHR-01 | Visual judgment against binding spec | Open deployed/local dashboard side-by-side with `docs/design/dispatch-control-v2/Dispatch Control.dc.html`; compare masthead, nav, tokens, fonts |
| Live masthead data | CHR-02 | Requires real Convex data | With a run in `awaiting-review`, confirm state chip, spend `$X / $Y`, lock chip all show live values |
| Inbox routing | CHR-04 | Requires unresolved live state | Click each inbox item type; confirm it lands on the working screen (review page / runs) |
| Production pipeline reachability | CHR-05 | Vercel env + Railway CORS are prod-only | Andrew sets `NEXT_PUBLIC_PIPELINE_URL` in Vercel + `DASHBOARD_ALLOWED_ORIGINS` in Railway per `apps/dispatch-control/DEPLOY.md`; run a test-run from the deployed prompts panel |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
