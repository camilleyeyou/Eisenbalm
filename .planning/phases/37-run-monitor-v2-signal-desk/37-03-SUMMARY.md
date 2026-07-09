---
phase: 37-run-monitor-v2-signal-desk
plan: 03
subsystem: ui
tags: [react-flow, convex, dagre, run-monitor, forensic-spine, dispatch-control]

# Dependency graph
requires:
  - phase: 37-01-contract-and-data-foundations
    provides: "agent_runs.retryCount populated honestly from the real acomplete() regenerate-retry signal"
  - phase: 23-forensics-live-progress
    provides: "agent_runs/agent_run_payloads tables, PipelineGraph/AgentNode/AgentIOPanel scaffold, pipelineTopology.ts static DAG"
provides:
  - "GATE_KEYS (verify_research, validate_sections) — the two real code gates distinguished as marigold diamonds on the spine"
  - "AgentNode dot/diamond rendering with model + cost/duration + retry chips rendering simultaneously on executed nodes"
  - "AgentIOPanel handoff inspector (MON-02): upstream output → this node's input/output → downstream input, human-readable first, raw JSON behind a toggle"
affects: [37-04-run-monitor-strength-drift, 37-05-signal-desk]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-key child component (HandoffNode) to keep useQuery hook count stable across variable-length fan-out/fan-in edge sets"
    - "Design token comment references (#f2b01e) alongside canonical Tailwind theme utility classes (bg-marigold) rather than arbitrary-value classes, matching the Phase 30 @theme CSS-first token system"

key-files:
  created:
    - apps/dispatch-control/__tests__/AgentIOPanel.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx
    - apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx
    - apps/dispatch-control/__tests__/pipelineTopology.test.ts
    - apps/dispatch-control/__tests__/AgentNode.test.tsx

key-decisions:
  - "GATE_KEYS is a plain exported Set<string> with exactly 2 members (verify_research, validate_sections) — no schema change, no third 'Verify Candidates' gate (design brief's third gate name is stale per Research Pitfall 8)"
  - "Model chip moved out of the at-rest-only render branch to render unconditionally, alongside cost/duration/retry — the plan-review fix ensuring these four are never mutually exclusive on an executed node"
  - "Marigold diamond uses the canonical bg-marigold Tailwind utility (from the Phase 30 @theme --color-marigold token) rather than an arbitrary-value bg-[#f2b01e] class, per IDE canonical-class guidance — the literal hex is documented in an adjacent comment"
  - "HandoffNode is a dedicated per-(runId,agentKey) child component so each upstream/downstream fetch is exactly one useQuery hook call per component instance, keeping hook counts stable regardless of fan-out/fan-in width (verify_research: 7 downstream; validate_sections: 7 upstream)"

# Metrics
duration: ~15min
completed: 2026-07-09
requirements-completed: [MON-01, MON-02]
---

# Phase 37 Plan 03: Run Monitor Spine + Handoff Summary

**The run-monitor/graph view is now a forensic spine — agents render as black dots, `verify_research`/`validate_sections` render as marigold diamonds, and every executed node shows its model, cost, duration, and retry-count chips together (never mutually exclusive); clicking any node now opens a handoff inspector showing upstream output → this node's input/output → downstream input, human-readable first with raw JSON behind a toggle.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-09
- **Tasks:** 3
- **Files modified:** 6 (+ 1 created)

## Accomplishments
- `pipelineTopology.ts` exports `GATE_KEYS` — the two real code-gate nodes (`verify_research`, `validate_sections`) — with an explicit comment correcting the stale "3 gates" design-brief scope (Research Pitfall 8)
- `AgentNode.tsx` renders a dot/diamond shape marker driven by `isGate`, a retry chip (only when `retryCount > 0`), and a model chip that now renders **unconditionally** — the plan-review fix ensuring an executed node (`status: 'done'`) shows model + cost/duration + retry chip simultaneously, not mutually exclusive
- `PipelineGraph.tsx` merges `run?.retryCount` (populated honestly by 37-01) and `GATE_KEYS.has(agentKey)` into each node's `AgentNodeData` in the existing node-build `useMemo` — no layout change, dagre TB stays as-is
- `AgentIOPanel.tsx` (MON-02) is extended into the handoff inspector: it resolves upstream/downstream agent keys from `PIPELINE_EDGES`, fetches each via a dedicated `HandoffNode` child component (stable hook count across variable fan-out/fan-in), renders a compact human-readable key-summary first, and reveals the existing raw-JSON `<pre>` blocks only behind a "Show raw JSON" toggle; the ~2000-char truncation is noted in the UI
- Both zero-upstream (`calibrator`) and 7-way fan-out (`verify_research`) / fan-in (`validate_sections`) cases degrade gracefully — render what exists, never crash

## Task Commits

Each task was committed atomically:

1. **Task 1: Add GATE_KEYS + dot/diamond/chip rendering to topology + node** - `4bc4cd9` (feat)
2. **Task 2: Wire retryCount + model + isGate into PipelineGraph spine** - `3a7e102` (feat)
3. **Task 3: Extend AgentIOPanel into the upstream→node→downstream handoff inspector (MON-02)** - `ee2e71d` (feat)

**Plan metadata:** (this commit) `docs: complete 37-03 plan`

_Note: Tasks 1 and 3 were marked `tdd="true"`; behavior tests were added alongside the implementation in the same commit (matching the 37-01 precedent), since GATE_KEYS/AgentNode chip logic and the AgentIOPanel handoff view were each authored together with their test coverage before being verified green._

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts` - Added `GATE_KEYS` export (the two real code gates)
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentNode.tsx` - `retryCount`/`isGate` added to `AgentNodeData`; dot/diamond shape marker; retry chip; model chip moved to render unconditionally
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/PipelineGraph.tsx` - Merges `retryCount`/`isGate` into node data from `GATE_KEYS` and the 37-01 `agent_runs.retryCount` field
- `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx` - Extended into the upstream→node→downstream handoff inspector with a raw-JSON toggle and truncation note
- `apps/dispatch-control/__tests__/pipelineTopology.test.ts` - Added `GATE_KEYS` coverage (size, membership, no phantom third gate)
- `apps/dispatch-control/__tests__/AgentNode.test.tsx` - Added dot/diamond, retry-chip, and "all chips together" coverage; added `afterEach(cleanup)` (see Deviations)
- `apps/dispatch-control/__tests__/AgentIOPanel.test.tsx` (new) - Handoff-region, toggle, truncation-note, and fan-out/no-upstream degrade coverage

## Decisions Made
- GATE_KEYS deliberately excludes a third gate — the design brief's "Verify Candidates" gate does not exist in `builder.py` (Research Pitfall 8); adding it would misrepresent the pipeline's actual checks-and-balances.
- The model chip's "config-at-rest" framing (Research Pitfall 7) is preserved in the comment even though it now renders during a run too — the value still comes from the `agents` table config, not a live field.
- Marigold color: used the canonical `bg-marigold` Tailwind utility (Phase 30's `@theme` CSS-first token) instead of an arbitrary-value class, matching the codebase's established token convention; the literal `#f2b01e` hex is preserved in an adjacent comment for documentation/traceability.
- HandoffNode fetches are per-child-component (not batched into a single query) — simplest way to keep `useQuery` hook-count invariants stable across nodes with 0, 1, or 7 upstream/downstream edges, at the cost of one Convex query per handoff row. Acceptable given these are on-demand (node-click) fetches, not live subscriptions.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added `afterEach(cleanup)` to AgentNode.test.tsx**
- **Found during:** Task 1 (verifying the new AgentNode behavior tests)
- **Issue:** The pre-existing `AgentNode.test.tsx` never called `@testing-library/react`'s `cleanup()` between tests. This worked previously because every existing test queried unique text content, so DOM accumulation across un-cleaned renders was invisible. The new tests reuse `data-testid="retry-chip"` / `agent-node-dot` / `agent-node-diamond` across multiple `it()` blocks, so `getByTestId` started failing with "multiple elements found" once prior renders' nodes remained in the document.
- **Fix:** Imported `cleanup` from `@testing-library/react` and `afterEach` from `vitest`; added `afterEach(() => cleanup())` at module scope, matching the pattern already used in `DecisionRail.test.tsx`.
- **Files modified:** `apps/dispatch-control/__tests__/AgentNode.test.tsx`
- **Verification:** `pnpm --filter dispatch-control test:unit -- pipelineTopology AgentNode` — all 12 + 9 tests pass.
- **Committed in:** `4bc4cd9` (Task 1 commit)

**2. [Rule 1 - Bug] Removed a literal "Verify Candidates" string from the GATE_KEYS doc comment**
- **Found during:** Task 1 (running the plan's own acceptance-criteria grep)
- **Issue:** My first draft of the `GATE_KEYS` doc comment quoted the design brief's stale third gate name verbatim ("Verify Candidates") to explain why it's excluded — but the plan's acceptance criteria requires `grep -c "Verify Candidates" .../*.ts*` to return 0 across the whole directory, and a doc comment quoting the phantom gate name still matches that grep, defeating the check's purpose (proving no trace of the phantom gate leaked in).
- **Fix:** Reworded the comment to describe the correction without quoting the stale gate name literally.
- **Files modified:** `apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/pipelineTopology.ts`
- **Verification:** `grep -c "Verify Candidates" apps/dispatch-control/app/(dashboard)/run-monitor/graph/_components/*.ts*` returns 0 for every file.
- **Committed in:** `4bc4cd9` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — bugs in the test/doc authoring itself, not in the plan)
**Impact on plan:** Both fixes are test-infrastructure/documentation corrections needed to make the plan's own acceptance criteria pass honestly. No scope creep; no behavior change to shipped UI beyond what the plan specified.

## Issues Encountered

None beyond the two auto-fixed items above.

## User Setup Required

None - no external service configuration required. This plan touches only `apps/dispatch-control` frontend components and their tests.

## Next Phase Readiness

- The forensic spine (dots/diamonds, per-node chips) and the handoff inspector are both in place on the existing `run-monitor/graph` route (D-01) — 37-04 (strength/drift) wires into this same `PipelineGraph.tsx` file next, per the phase's sequencing note (Wave 3 runs after this Wave 2 lands, main-checkout sequential per Phase 36 precedent).
- `GATE_KEYS` is now a shared export other plans can import if they need to distinguish code gates from LLM agents (e.g., for strength-score section mapping in 37-04, though that plan maps `SECTION_WRITER_KEYS`, not `GATE_KEYS`).
- Full verification green:
  - `pnpm --filter dispatch-control test:unit` → 438 passed, 2 todo (50 files, 1 skipped)
  - `pnpm --filter dispatch-control build` → exit 0

No blockers for 37-04.

---
*Phase: 37-run-monitor-v2-signal-desk*
*Completed: 2026-07-09*

## Self-Check: PASSED

All 7 modified/created source+test files and the SUMMARY itself confirmed present on disk; all 3 task commit hashes (`4bc4cd9`, `3a7e102`, `ee2e71d`) confirmed present in `git log`.
