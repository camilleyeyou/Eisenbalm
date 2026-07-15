---
phase: 42
slug: fact-check-stage
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-15
---

# Phase 42 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (console `apps/dispatch-control`) · pytest (pipeline `packages/pipeline`) |
| **Config file** | `apps/dispatch-control/vitest.config.ts` · `packages/pipeline/pyproject.toml` |
| **Quick run command** | `pnpm --filter dispatch-control test` · `uv run --package eisenbalm-pipeline pytest` (scope to touched files during a task) |
| **Full suite command** | `pnpm --filter dispatch-control test && pnpm --filter dispatch-control build && uv run --package eisenbalm-pipeline pytest` |
| **Estimated runtime** | ~TBD (planner to confirm) seconds |

> Project memory: vitest does NOT type-check — run the strict `pnpm --filter dispatch-control build` before declaring any frontend work done. Convex functions must be synced to the dev deployment (`pnpm --filter @eisenbalm/convex dev:once`), not merely committed. The standing `dispatch-control-no-sanity-write.test.ts` source-scan tripwire must stay green (no direct console→Sanity writes).

---

## Sampling Rate

- **After every task commit:** Run the quick run command scoped to the touched package.
- **After every plan wave:** Run the full suite command (vitest + strict build + pytest).
- **Before `/gsd:verify-work`:** Full suite must be green AND Convex synced to dev.
- **Max feedback latency:** TBD (planner to confirm) seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 42-01-01 | 01 | 1 | FCT-01..07 (contract) | unit | `TBD — planner fills from RESEARCH §Validation Architecture` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*Planner: populate one row per task from 42-RESEARCH.md "## Validation Architecture", mapping each to FCT-01..FCT-07.*

---

## Wave 0 Requirements

- [ ] Test scaffolds for the new Convex fields/mutations (`importance`, `changedSinceCheck`, touched-claims reset) — `convex/` vitest stubs
- [ ] Test scaffolds for the new pipeline endpoints (six actions + evidence preview/apply) — pytest stubs mirroring `tests/api/test_content*.py` / `test_findings*.py` / `test_voice_pass*.py`
- [ ] Test scaffold asserting `deriveFactCheckSummary` counter math per DERIVED-STATE-CONTRACT §4
- [ ] Regression stub: `dispatch-control-no-sanity-write.test.ts` still green after new console code
- [ ] Regression stub: `claimChecks:allSignedOff` still blocks facts-cleared when a must-fix claim exists

*Planner: reconcile against the exact Wave 0 list in 42-RESEARCH.md.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| The live demo leg (My Tasks → Fact Check claim detail → Ask agent for better evidence → Confirm → counters/header/publish-lock update) | FCT-05 (+ FCT-02) | End-to-end reactive UI across Convex + pipeline + Sanity; asserting the full live update chain is integration-level | Run a real/seeded issue run, open Stage 3, trigger "Ask agent for better evidence" on an unsourced load-bearing claim, confirm, verify counters + My Tasks + Approval readiness + header all update live |

*Planner may add/replace rows; keep automated coverage maximal.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < TBD s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
