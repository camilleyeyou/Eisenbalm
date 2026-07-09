---
phase: 37
slug: run-monitor-v2-signal-desk
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-09
---

# Phase 37 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (packages/pipeline) + vitest (apps/dispatch-control, incl. convex-test) |
| **Config file** | packages/pipeline/pyproject.toml · apps/dispatch-control/vitest.config.ts |
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/ -x -q` / `pnpm --filter dispatch-control test:unit -- <pattern>` |
| **Full suite command** | both of the above + `pnpm --filter dispatch-control build` (strict type-check — vitest does not type-check) |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched package.
- **After every plan wave:** Run BOTH full suites — this phase touches pipeline (retryCount/confidence/adjudication endpoint) and frontend (spine + signal desk).
- **Before `/gsd:verify-work`:** Both full suites green + `pnpm --filter dispatch-control build` exits 0 + the manual visual checks below.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|------|------|------|-------------|-----------|-------------------|-------------|--------|
| Contract §37 amendment | 37-01 | 1 | MON-01/SIG-02/SIG-03 (contract) | grep gate | `grep -q "## §37" docs/API_CONTRACTS.md` | ✅ docs/API_CONTRACTS.md | ⬜ |
| Gate-1 confidence persistence | 37-01 | 1 | SIG-02 | pytest | `cd packages/pipeline && uv run pytest tests/agents/test_editor.py -x -q` | ✅ extend test_editor.py | ⬜ |
| agent_runs.retryCount plumbing | 37-01 | 1 | MON-01 | vitest+pytest | `pnpm --filter dispatch-control test:unit -- agentRuns` | ✅ extend agentRuns.test.ts | ⬜ |
| _resume_paused_run extraction | 37-02 | 2 | SIG-03 | pytest | `cd packages/pipeline && uv run pytest tests/test_editor_gate_1_resume.py -x -q` | ✅ resume test (extend) | ⬜ |
| adjudicate bridge endpoint | 37-02 | 2 | SIG-03 | pytest | `cd packages/pipeline && uv run pytest tests/test_adjudication_bridge.py -x -q` | ❌ Wave 0 — test_adjudication_bridge.py | ⬜ |
| GATE_KEYS + dot/diamond/chips | 37-03 | 2 | MON-01 | vitest | `pnpm --filter dispatch-control test:unit -- pipelineTopology AgentNode` | ✅ extend pipelineTopology/AgentNode tests | ⬜ |
| Wire retry/model/isGate into spine | 37-03 | 2 | MON-01 | build | `pnpm --filter dispatch-control build` | ✅ PipelineGraph.tsx | ⬜ |
| Handoff inspector | 37-03 | 2 | MON-02 | vitest | `pnpm --filter dispatch-control test:unit -- AgentIOPanel` | ❌ Wave 0 — AgentIOPanel.test.tsx | ⬜ |
| strengthScore lib | 37-04 | 3 | MON-03 | vitest | `pnpm --filter dispatch-control test:unit -- strengthScore` | ❌ Wave 0 — strengthScore.test.ts | ⬜ |
| WriterExpansion (strength/flags/rerun) | 37-04 | 3 | MON-03 | vitest | `pnpm --filter dispatch-control test:unit -- WriterExpansion` | ❌ Wave 0 — WriterExpansion.test.tsx | ⬜ |
| DriftStrip + mount | 37-04 | 3 | MON-04 | vitest+build | `pnpm --filter dispatch-control test:unit -- DriftStrip` | ❌ Wave 0 — DriftStrip.test.tsx | ⬜ |
| CandidateSlate (SIG-01 join) | 37-05 | 3 | SIG-01 | vitest | `pnpm --filter dispatch-control test:unit -- CandidateSlate` | ❌ Wave 0 — CandidateSlate.test.tsx | ⬜ |
| DecisionPanel (confidence/reasoning) | 37-05 | 3 | SIG-02 | vitest | `pnpm --filter dispatch-control test:unit -- DecisionPanel` | ❌ Wave 0 — DecisionPanel.test.tsx | ⬜ |
| AdjudicationPanel + page | 37-05 | 3 | SIG-03 | vitest+build | `pnpm --filter dispatch-control test:unit -- AdjudicationPanel` | ❌ Wave 0 — AdjudicationPanel.test.tsx | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 / Wave 1 Requirements

Foundations the research corrected (must land before the consuming UI tasks), RED-first:
- [ ] Contract-first: `docs/API_CONTRACTS.md` §37 (agent_runs.retryCount additive field; editor-decision confidence field; Clerk-guarded adjudication bridge endpoint) BEFORE any schema/endpoint code. (37-01 T1)
- [ ] `agent_runs.retryCount` optional field, honestly sourced from acomplete regenerate-retries via the existing cost path — NO new node-retry infrastructure; legacy rows read 0. (37-01 T3)
- [ ] `editor-decision` deliberationEvents payload gains `confidence` (+ `runnerUpNotes`); DispatchState gains `editor_confidence` (editor.py computes confidence today then discards it). (37-01 T2)
- [ ] Clerk-guarded adjudication bridge endpoint (pick + reason → audit → server-side resume, never exposing the trigger secret; deliberationEvents union stays FROZEN — reason logged via audit_log). (37-02)

New RED-first test files created within their consuming plans (Wave-0-within-plan):
- [ ] `packages/pipeline/tests/test_adjudication_bridge.py` (37-02) — pattern: test_editor_gate_1_resume.py
- [ ] `apps/dispatch-control/__tests__/AgentIOPanel.test.tsx` (37-03) — MON-02
- [ ] `apps/dispatch-control/__tests__/strengthScore.test.ts` (37-04) — MON-03
- [ ] `apps/dispatch-control/__tests__/WriterExpansion.test.tsx` (37-04) — MON-03
- [ ] `apps/dispatch-control/__tests__/DriftStrip.test.tsx` (37-04) — MON-04
- [ ] `apps/dispatch-control/__tests__/CandidateSlate.test.tsx` (37-05) — SIG-01
- [ ] `apps/dispatch-control/__tests__/DecisionPanel.test.tsx` (37-05) — SIG-02
- [ ] `apps/dispatch-control/__tests__/AdjudicationPanel.test.tsx` (37-05) — SIG-03 (frontend)
- Framework install: none needed — all frameworks already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Forensic spine reads as dots/diamonds with correct chips | MON-01 | Visual | Open the rebuilt run-monitor/graph for a real run; confirm agents=dots, the 2 gates=marigold diamonds, per-node cost/latency/model/retry chips |
| Handoff inspector reads upstream→node→downstream | MON-02 | Visual | Click a mid-spine node; confirm the from/this/to handoff renders human-readable first with a raw-JSON toggle + truncation note |
| Per-section strength + re-run | MON-03 | Visual/live | Expand the 7-writers node; confirm per-section strength bars + flag counts; trigger a per-section re-run on a finished run |
| Drift strip vs last 8 | MON-04 | Visual | Confirm the drift strip shows current-vs-trailing-mean for cost + duration and labels n when <8 prior runs |
| primaryConcern + editor reasoning never truncated | SIG-01/02 | Visual | On Signal Desk, confirm primaryConcern and editor reasoning render in full (no line-clamp/ellipsis) |
| Gate 1 adjudication resumes the run | SIG-03 | Live pipeline | Interrupt a run at Gate 1; pick a candidate + reason on Signal Desk; confirm the run resumes and the pick+reason are audit-logged |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0/1 covers the retryCount + confidence + adjudication-bridge foundations
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved
