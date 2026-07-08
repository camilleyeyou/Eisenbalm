---
phase: 36
slug: voice-pass-de-slop-screen
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-08
---

# Phase 36 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (packages/pipeline) + vitest (apps/dispatch-control) |
| **Config file** | packages/pipeline/pyproject.toml · apps/dispatch-control/vitest.config.ts |
| **Quick run command** | `cd packages/pipeline && uv run pytest tests/ -x -q` / `cd apps/dispatch-control && npx vitest run` |
| **Full suite command** | both of the above + `pnpm --filter dispatch-control build` (strict type-check — vitest does not type-check) |
| **Estimated runtime** | ~60-120 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick command for the touched package (pipeline → pytest; frontend → vitest).
- **After every plan wave:** Run BOTH full suites — this phase touches pipeline (rules/judge/endpoints) and frontend (Voice Pass screen).
- **Before `/gsd:verify-work`:** Both full suites green + `pnpm --filter dispatch-control build` exits 0 + the manual tell-lighting visual check.
- **Max feedback latency:** 120 seconds.

---

## Per-Task Verification Map

| Task | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|------|------|------|-------------|-----------|-------------------|-------------|--------|
| (filled by planner — Wave 0 must cover: machine-tell axis added to Convex union; axis-collapse fix so machine-tell survives; facts-cleared narrowed to factual axes) | | 0/1 | VOX-01..04 | | | | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 must land the structural foundations the research confirmed (or every downstream task silently fails):
- [ ] Add `"machine-tell"` to the Convex `qaCorrections.axis` union (`convex/schema.ts` + `convex/qaCorrections.ts`) — else pipeline writes vanish via `convex_mutation_safe`.
- [ ] Fix `agents/qa/__init__.py::qa()` axis-collapse so per-predicate axis survives to Convex (research Pitfall 3).
- [ ] Narrow the `facts-cleared` prerequisite in `api/signoffs.py`/`review.py` to factual axes so voice errors don't double-gate (research Pitfall + Open Q1).
- [ ] RED tests for the above before the feature tasks.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Machine-tell lighting reads over clean prose | VOX-01 | Visual judgment | Open /voice-pass for a run; confirm tells light inline, per-screen count is accurate, and lighting doesn't over-fire on legitimate prose |
| Two independent sign-off greens | VOX-03 | Cross-screen state | Sign Facts cleared on Review Desk + Sounds human on Voice Pass; confirm both greens required for Publish and they're independent |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the axis-union + axis-collapse + facts-cleared-narrowing foundations
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
