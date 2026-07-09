---
phase: 37
slug: run-monitor-v2-signal-desk
status: draft
nyquist_compliant: false
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
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/ -x -q` / `cd apps/dispatch-control && npx vitest run` |
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
| (filled by planner — foundations first: contract §37 amendment; agent_runs.retryCount additive field; editor-decision confidence persistence; adjudication bridge endpoint) | | | MON-01..04, SIG-01..03 | | | | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 / Wave 1 Requirements

Foundations the research corrected (must land before the consuming UI tasks), RED-first:
- [ ] Contract-first: `docs/API_CONTRACTS.md` §37 (agent_runs.retryCount additive field; editor-decision confidence field; Clerk-guarded adjudication bridge endpoint) BEFORE any schema/endpoint code.
- [ ] `agent_runs.retryCount` optional field (populated from genuine retry signals where they exist, else 0 — no new node-retry infrastructure).
- [ ] `editor-decision` deliberationEvents payload gains `confidence` (editor.py computes it today then discards it — persist it; SIG-02).
- [ ] Clerk-guarded adjudication bridge endpoint (pick + reason → audit + deliberation event → server-side resume, never exposing the trigger secret; SIG-03).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Forensic spine reads as dots/diamonds with correct chips | MON-01 | Visual | Open the rebuilt run-monitor/graph for a real run; confirm agents=dots, gates=diamonds, per-node cost/latency/model/retry chips |
| primaryConcern + editor reasoning never truncated | SIG-01/02 | Visual | On Signal Desk, confirm primaryConcern and editor reasoning render in full (no line-clamp/ellipsis) |
| Gate 1 adjudication resumes the run | SIG-03 | Live pipeline | Interrupt a run at Gate 1; pick a candidate + reason on Signal Desk; confirm the run resumes and the pick+reason are audit-logged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0/1 covers the retryCount + confidence + adjudication-bridge foundations
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
