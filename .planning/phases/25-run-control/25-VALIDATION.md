---
phase: 25
slug: run-control
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 25 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Skeleton — the planner fills the Per-Task Verification Map from 25-RESEARCH.md "## Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (pipeline) / vitest (convex + dispatch-control) — confirm in plan |
| **Config file** | packages/pipeline/pyproject.toml · apps/dispatch-control config |
| **Quick run command** | `cd packages/pipeline && pytest -q` |
| **Full suite command** | `cd packages/pipeline && pytest` |
| **Estimated runtime** | ~TBD seconds |

---

## Sampling Rate

- **After every task commit:** Run quick run command for the touched package
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** TBD seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| _planner fills from RESEARCH Validation Architecture_ | | | RUN-01..RUN-06 | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] _planner determines test stubs/fixtures from RESEARCH Validation Architecture_

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Railway cron → `/pipeline/tick` provisioning | RUN-03 | Human infra step (Andrew provisions Railway cron service; cannot be automated) | Provision Railway cron POSTing `/pipeline/tick` hourly; confirm tick no-ops when `schedule_enabled=false` and fires when due |
| Operator-local timezone display | RUN-03 | Browser-rendered, locale-dependent | Verify next-run shows operator local TZ + UTC alongside |

*If none: "All phase behaviors have automated verification."*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < TBDs
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
