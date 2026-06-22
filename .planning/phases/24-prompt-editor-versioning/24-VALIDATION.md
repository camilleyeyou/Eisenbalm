---
phase: 24
slug: prompt-editor-versioning
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-22
---

# Phase 24 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest 7.x (pipeline) + vitest/jest (dispatch-control, if present) |
| **Config file** | `packages/pipeline/pyproject.toml` — confirm dispatch-control test config in Wave 0 |
| **Quick run command** | `cd packages/pipeline && pytest -q` (scope to touched tests during dev) |
| **Full suite command** | `cd packages/pipeline && pytest` + dispatch-control test run |
| **Estimated runtime** | ~TBD (planner/executor to confirm in Wave 0) |

---

## Sampling Rate

- **After every task commit:** Run scoped quick command (e.g. `pytest -q packages/pipeline/.../test_voice.py`)
- **After every plan wave:** Run full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** TBD (confirm during Wave 0)

---

## Per-Task Verification Map

*Populated by gsd-planner from RESEARCH.md Validation Architecture and PLAN.md tasks. Each task maps to PRM-01..PRM-06.*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | PRM-01..06 | unit/integration | TBD | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Byte-equivalence oracle tests for each newly-externalized asset (user-templates, SECTION_GUIDANCE, qa/rubric.md, VOICE_CONSTRAINTS) — assert migrated v1 row == on-disk/in-code source
- [ ] Preserve existing `test_voice.py` invariants (`assemble_voice(None) == VOICE_CONSTRAINTS`) and Phase-16 import-time sentinel
- [ ] Convex mutation tests for `saveVersion` (increments, never overwrites) / `activate` (in-progress guard)
- [ ] dispatch-control component test harness — confirm/install if absent

*Planner to finalize from RESEARCH.md Validation Architecture section.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `{variable}` highlight color rendering in CodeMirror | PRM-02 | Visual rendering inside editor | Open editor, confirm known vars highlighted distinctly, unknown var triggers warning before save |
| Side-by-side diff visual layout | PRM-04 | Visual side-by-side comparison | Select two versions, confirm true two-column diff |

*Planner to refine; prefer automating the warning/validation logic even where visual rendering stays manual.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < TBDs
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
