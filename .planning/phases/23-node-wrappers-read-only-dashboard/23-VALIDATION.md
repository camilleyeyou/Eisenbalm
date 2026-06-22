---
phase: 23
slug: node-wrappers-read-only-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-21
---

# Phase 23 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Detailed validation architecture (per-requirement test design) lives in
> `23-RESEARCH.md` → "Validation Architecture". This file is the executor's
> sampling contract; the planner fills the Per-Task Verification Map.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (pipeline, Python) · vitest/convex-test (Convex) — confirm during planning |
| **Config file** | `packages/pipeline/pyproject.toml` (pytest); dispatch-control test config — Wave 0 confirms |
| **Quick run command** | `pnpm --filter pipeline test` / `uv run pytest packages/pipeline -k wrap_agent_node` |
| **Full suite command** | `uv run pytest packages/pipeline && pnpm --filter dispatch-control test` |
| **Estimated runtime** | ~TBD seconds (planner sets after Wave 0) |

---

## Sampling Rate

- **After every task commit:** Run the quick run command for the touched package
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** target < 60 seconds for the quick command

---

## Per-Task Verification Map

> The planner populates this from RESEARCH.md "Validation Architecture" once
> tasks are defined. Every OBS/AUD requirement below must map to ≥1 task.

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 23-XX-XX | XX | 0 | (schema) | unit | `convex test` | ❌ W0 | ⬜ pending |
| 23-XX-XX | XX | — | OBS-01 | unit/integration | TBD | ❌ W0 | ⬜ pending |
| 23-XX-XX | XX | — | OBS-02 | integration | TBD | ❌ W0 | ⬜ pending |
| 23-XX-XX | XX | — | OBS-03 | integration | TBD | ❌ W0 | ⬜ pending |
| 23-XX-XX | XX | — | OBS-04 | integration | TBD (assert agent_runs cost == pipelineRuns.cost) | ❌ W0 | ⬜ pending |
| 23-XX-XX | XX | — | OBS-05 | integration | TBD | ❌ W0 | ⬜ pending |
| 23-XX-XX | XX | — | AUD-01 | unit | TBD (audit row shape: actor/timestamp/before/after) | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Confirm/extend pytest harness for `wrap_agent_node` (pipeline) — stubs for OBS-03/05 wrapper behavior
- [ ] Confirm Convex test harness (`convex-test`/vitest) for `agentRuns.ts` + `auditLog.ts` mutations/queries
- [ ] Integration fixture asserting `agent_runs` cost values reconcile with `pipelineRuns.cost` (OBS-04, "no second recorder" guard)
- [ ] Frontend test setup for dispatch-control if subscription/UI behavior is unit-tested (otherwise mark manual)

*Planner refines this list from RESEARCH.md.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live graph repaints nodes queued→running→done/failed with no refresh | OBS-03 | Real-time Convex subscription + visual node state hard to assert headlessly | Trigger a run; watch `/graph` repaint node colors + inline cost live |
| Node-click opens per-agent I/O + error/retry + cost panel | OBS-05 | Interaction + visual panel | Click a node in graph or run-detail; confirm input/output payload + error renders |
| Suppressed agent (DesignAgent) renders dimmed at rest | OBS-01 | Visual state | Load `/graph` at rest with `DESIGNAGENT_SUPPRESSED`; confirm dimmed node |

*Automated coverage handles emission, cost reconciliation, payload persistence, and audit row shape; the above are visual/interaction confirmations.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
