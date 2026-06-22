---
phase: 23
slug: node-wrappers-read-only-dashboard
status: draft
nyquist_compliant: true
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
| **Framework** | pytest + pytest-asyncio (pipeline, Python) · vitest 3.2 + convex-test (Convex/edge-runtime) · vitest + jsdom + @testing-library/react (components) |
| **Config file** | `packages/pipeline/pyproject.toml` (pytest); `apps/dispatch-control/vitest.config.ts` (environmentMatchGlobs: edge-runtime for convex-test, jsdom for *.test.tsx, node default) |
| **Quick run command** | `pnpm --filter dispatch-control test:unit` / `uv run pytest packages/pipeline -k 'wrapper or cost_double'` |
| **Full suite command** | `uv run pytest packages/pipeline && pnpm --filter dispatch-control test && pnpm --filter dispatch-control build` |
| **Estimated runtime** | ~30s vitest unit · ~20s pipeline pytest subset · ~40s next build |

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
| 23-01-T1 | 01 | 0 | (schema) | static | `grep -q agent_run_payloads convex/schema.ts` | ❌ W0 | ⬜ pending |
| 23-01-T2 | 01 | 0 | OBS-03/05/AUD-01 | static | `grep export const agentRuns.ts + auditLog.ts` | ❌ W0 | ⬜ pending |
| 23-01-T3 | 01 | 0 | OBS-04/AUD-01 | unit/integration | `pnpm --filter dispatch-control test:unit` (costRollup, agentRuns, auditLog) | ❌ W0 | ⬜ pending |
| 23-01-T3 | 01 | 0 | OBS-04 (no-double-count) | unit (Python) | `uv run pytest packages/pipeline/tests/test_cost_double_count.py -x` | ❌ W0 | ⬜ pending |
| 23-02-T1 | 02 | 1 | OBS-03/04/05 | unit (Python) | `uv run pytest packages/pipeline/tests/test_agent_wrapper.py -x` | ❌ W0 | ⬜ pending |
| 23-02-T2 | 02 | 1 | OBS-03 | static/import | `grep -c wrap_agent_node builder.py ≥18 + queueForRun in runs.py` | ❌ W0 | ⬜ pending |
| 23-03-T2 | 03 | 1 | OBS-01 | component (jsdom) | `pnpm --filter dispatch-control test:unit -- AgentNode` | ❌ W0 | ⬜ pending |
| 23-03-T3 | 03 | 1 | OBS-03/05 | unit + build | `pnpm --filter dispatch-control test:unit -- pipelineTopology && build` | ❌ W0 | ⬜ pending |
| 23-04-T1 | 04 | 1 | OBS-02 | integration (convex-test) | `pnpm --filter dispatch-control test:unit -- runs` | ❌ W0 | ⬜ pending |
| 23-04-T2 | 04 | 1 | OBS-04 | build + manual reconcile | `pnpm --filter dispatch-control build` | ❌ W0 | ⬜ pending |
| 23-04-T3 | 04 | 1 | AUD-01 | integration (convex-test) | `pnpm --filter dispatch-control test:unit -- auditViewer` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Wave 0 work lives in **Plan 23-01** (wave 0; every other plan depends_on it):

- [ ] (23-01-T3) Install `convex-test` + `@edge-runtime/vm`; wire `environmentMatchGlobs` in vitest.config.ts + `__tests__/setup.ts` schema re-export
- [ ] (23-01-T3) Convex test harness green for `agentRuns.ts` + `auditLog.ts` mutations/queries (agentRuns.test.ts, auditLog.test.ts)
- [ ] (23-01-T3) `lib/costRollup.ts` (`parseCostJson`/`sumRunsCost`) + `costRollup.test.ts` (OBS-04 frontend aggregation)
- [ ] (23-01-T3) `test_cost_double_count.py` — proves `get_cost_payload` is a pure read (OBS-04 "no second recorder" guard)
- [ ] (23-02-T1) `test_agent_wrapper.py` created in Plan 23-02 (wave 1) covering OBS-03/05 wrapper emit/fail/no-cost behaviors
- [ ] (23-03-T2) jsdom + @testing-library/react added in Plan 23-03 for `AgentNode.test.tsx` (OBS-01 component render)

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
