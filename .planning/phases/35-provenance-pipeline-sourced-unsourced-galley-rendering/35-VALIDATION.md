---
phase: 35
slug: provenance-pipeline-sourced-unsourced-galley-rendering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-08
---

# Phase 35 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (packages/pipeline) + vitest (apps/dispatch-control) |
| **Config file** | packages/pipeline/pyproject.toml · apps/dispatch-control/vitest.config.ts |
| **Quick run command** | `cd packages/pipeline && python -m pytest tests/ -x -q` / `pnpm --filter dispatch-control test` |
| **Full suite command** | both of the above + `pnpm --filter dispatch-control build` (strict type-check — see memory: vitest doesn't type-check) |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched package
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green, including `pnpm --filter dispatch-control build`
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| (filled by planner) | | | PRV-01..04 | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] To be determined by planner (pipeline claim-binding unit tests, resolver/dedup unit tests)

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Wash vs underline visual coexistence | PRV-03 | CSS layering is visual | Open galley with QA findings overlapping claim washes; confirm underline-over-wash reads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
