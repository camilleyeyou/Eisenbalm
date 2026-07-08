---
phase: 33
slug: accept-fix-wiring-decision-rail
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-07
---

# Phase 33 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (packages/pipeline) + vitest (apps/dispatch-control) |
| **Config file** | packages/pipeline/pyproject.toml · apps/dispatch-control/vitest.config.ts |
| **Quick run command** | `pnpm --filter dispatch-control test -- --run` / `cd packages/pipeline && uv run pytest -q` |
| **Full suite command** | both of the above + `pnpm --filter dispatch-control build` (strict type-check — required before phase done) |
| **Estimated runtime** | ~60–120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the affected side's quick command
- **After every plan wave:** Run both suites
- **Before `/gsd:verify-work`:** Full suite green + `pnpm --filter dispatch-control build` green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| (filled by planner) | — | — | GLY-03, GLY-04, EDT-04, EDT-06 | unit/integration | see infrastructure | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Pipeline: test module for the findings accept/dismiss/reopen endpoints (clone Phase 26 review-endpoint test pattern)
- [ ] Pipeline: server span-resolution unit tests (exact / curly-quote / whitespace-tolerant / ambiguous → 409)
- [ ] Dashboard: vitest stubs for popover action row, rail blockers, orphan card actions

*Existing pytest + vitest infrastructure covers frameworks; no installs needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Popover accept round-trip against live draft | EDT-04 | Needs live Sanity draft + Convex run | On a real awaiting-review run, accept a fix; confirm galley text updates and audit row appears |
| Rail affirmative timestamps render | GLY-04 | Visual recency state | Open Review Desk; verify "checked Nm ago" never blank |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
