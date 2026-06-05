---
phase: 20
slug: post-purchase-email-lifecycle-8-email-flow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-05
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seed contract — the planner refines the Per-Task Verification Map against the
> Validation Architecture section of 20-RESEARCH.md.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (apps/web) |
| **Config file** | apps/web/vitest.config.ts |
| **Quick run command** | `cd apps/web && npx vitest run <target test>` |
| **Full suite command** | `cd apps/web && npm test` |
| **Estimated runtime** | ~3 seconds (current suite: 32 files / 288 tests) |

---

## Sampling Rate

- **After every task commit:** Run the task's targeted `npx vitest run <file>`
- **After every plan wave:** Run `cd apps/web && npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | TBD | unit | `cd apps/web && npx vitest run <file>` | ❌ W0 | ⬜ pending |

*Planner fills this from the Validation Architecture section of 20-RESEARCH.md. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test harness for Convex email-flow logic (enqueue / idempotency / unsubscribe cancellation) — Convex has no official unit-test SDK; planner decides the seam (extract pure helpers testable under vitest, or a provider-abstraction dry-run).
- [ ] Provider abstraction / dry-run mode so the flow is fully testable with NO live sending.

*Planner finalizes against research findings.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Real deliverability / inbox placement | go-live | Requires verified DNS (SPF/DKIM/DMARC) + Resend domains | Launch prerequisite, not a build gate |
| Jesse-voice copy approval (8 beats) | voice gate | Brand voice is a human editorial decision (Andrew) | Andrew reviews drafts before live sending is enabled |

*All build-time behaviors (enqueue, idempotency, offset correctness, unsubscribe suppression, per-order charity resolution) must have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
