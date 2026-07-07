---
phase: 32
slug: native-galley-read-only-span-resolver
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-07
---

# Phase 32 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 3.2.x (apps/dispatch-control) + pytest (packages/pipeline) |
| **Config file** | apps/dispatch-control/vitest config (existing) |
| **Quick run command** | `pnpm --filter dispatch-control test:unit -- <file>` |
| **Full suite command** | `pnpm --filter dispatch-control test` (+ `pytest` in packages/pipeline for QA emission change) |
| **Estimated runtime** | ~30–60 seconds |

---

## Sampling Rate

- **After every task commit:** Run the targeted vitest file for the module touched
- **After every plan wave:** Run `pnpm --filter dispatch-control test` (and `pytest packages/pipeline/tests/agents/qa/` when QA agent touched)
- **Before `/gsd:verify-work`:** Full suite green + `pnpm --filter dispatch-control build` (per project memory: vitest doesn't type-check)
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

*To be filled by planner — every plan task maps here. Expected coverage:*

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| (resolver module) | TBD | TBD | GLY-02 | unit | `pnpm --filter dispatch-control test:unit -- spanResolver` | ❌ W0 | ⬜ pending |
| (sectionName bridge) | TBD | TBD | GLY-02 | unit | `pnpm --filter dispatch-control test:unit -- spanResolver` | ❌ W0 | ⬜ pending |
| (galley render) | TBD | TBD | GLY-01 | component | `pnpm --filter dispatch-control test:unit -- Galley` | ❌ W0 | ⬜ pending |
| (chip counts) | TBD | TBD | GLY-05 | component | `pnpm --filter dispatch-control test:unit -- SectionChip` | ❌ W0 | ⬜ pending |
| (QA blockIndexHint emission) | TBD | TBD | GLY-02 | unit | `pytest packages/pipeline/tests/agents/qa/ -q` | ✅ existing dir | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Resolver unit-test stubs (no match / single match / multi-match + hint disambiguation / hint mismatch / ambiguous→unresolved / normalization / cross-block quote → unresolved)
- [ ] Existing vitest infra covers component tests — no framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Galley reads as the reader would see it (theme fonts + accent, type scale) | GLY-01 | Visual fidelity judgment | Open /review-desk/[runId] for a real run; compare against iframe toggle |
| Iframe fallback reachable | GLY-01 (SC-4) | Route-level smoke in real browser | Toggle iframe in Review Desk; open Phase 26 review page |
| Chip click jumps to section | GLY-05 | Scroll behavior | Click each chip, confirm scroll target |
| Game renders sandboxed | GLY-01 | iframe sandbox behavior | Confirm game plays, no console CSP errors |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
