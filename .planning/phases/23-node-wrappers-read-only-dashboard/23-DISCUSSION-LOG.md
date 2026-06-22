# Phase 23: Node Wrappers + Read-Only Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-21
**Phase:** 23-node-wrappers-read-only-dashboard
**Areas discussed:** Graph view fidelity

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Graph view fidelity | Visual DAG vs card grid; how live status paints | ✓ |
| Per-agent I/O inspection | Storage depth/location of payloads (OBS-05) | |
| Live run + cost display | Live-run presentation + cost roll-up format (OBS-03/04) | |
| Audit-log scope this phase | Infra-only vs wire-all-existing-writes (AUD-01) | |

**User's choice:** Graph view fidelity only. The other three captured as Claude's-discretion defaults in CONTEXT.md.

---

## Graph view fidelity

### Q1 — How should the pipeline graph render visually?

| Option | Description | Selected |
|--------|-------------|----------|
| Real visual DAG | Nodes + edges, auto-layout (React Flow / @xyflow), true spine + 7-writer fan-out | ✓ |
| Ordered card grid | Agents as cards in order, no drawn edges, reuses shadcn | |
| DAG, edges optional | Topology layout with lightweight SVG/CSS connectors, no heavy library | |

**User's choice:** Real visual DAG

### Q2 — How should live run status paint onto the graph?

| Option | Description | Selected |
|--------|-------------|----------|
| Color + inline cost on node | State colors + spinner on active node + inline cost/duration; readable from graph alone | ✓ |
| Badge only, details on click | Small status badge; cost/duration in a side panel | |
| You decide | Claude picks | |

**User's choice:** Color + inline cost on node

### Q3 — What should each node show at rest (no run in flight)?

| Option | Description | Selected |
|--------|-------------|----------|
| Config summary | Name + model + enabled flag + description from `agents` table; disabled agents dimmed | ✓ |
| Name only, config on click | Minimal node; config in detail panel | |
| You decide | Claude picks | |

**User's choice:** Config summary

### Q4 — What happens when the operator clicks a node?

| Option | Description | Selected |
|--------|-------------|----------|
| Opens I/O + cost panel | Node click → per-agent input/output + error/retry + cost panel (OBS-05); graph is entry point to inspection | ✓ |
| Config only (run history separate) | Click shows static config; I/O lives only in run-detail screens | |
| You decide | Claude wires navigation | |

**User's choice:** Opens I/O + cost panel

**Notes:** This decision makes the graph the primary entry point to run inspection, linking OBS-01 (config), OBS-03 (live status), and OBS-05 (I/O inspection) into one surface. I/O storage depth/shape remains Claude's discretion.

---

## Claude's Discretion

- Per-agent I/O payload storage depth, location, and "input/output" definition (access pattern locked: node click → panel)
- Live-run presentation beyond the graph + cost roll-up display format and aggregation location (OBS-03/04)
- Audit-log scope: build infrastructure this phase; action emissions land in owning phases (24/25/26)
- `wrap_agent_node()` internals (failure/retry semantics, which nodes emit)
- Graph library, auto-layout algorithm, responsive behavior, empty/no-runs state, node icons

## Deferred Ideas

- Editable graph topology / graph-as-data — Phase 28
- Dashboard write actions — Phases 24–26
- Audit emissions for config/prompt/review/kill-switch — owning phases
- Budget caps / cost projection — Phase 25/27
