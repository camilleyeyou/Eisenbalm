---
phase: 19
slug: issue-page-redesign-dispatch-magazine-layout
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-03
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter web test:unit` |
| **Full suite command** | `pnpm --filter web test:unit && pnpm --filter web typecheck` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test:unit`
- **After every plan wave:** Run `pnpm --filter web test:unit && pnpm --filter web typecheck`
- **Before `/gsd:verify-work`:** Full suite + `pnpm --filter web build` must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| (planner populates during planning) | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/__tests__/issue-page-dispatch.test.ts` — source-scan assertions for the 10-section order, retired-component absence, font wiring, framer-motion usage (per RESEARCH.md)
- [ ] Update `apps/web/__tests__/theme-aa-tones.test.ts` — Phase 14 palette assertions (`#FAFAF8` bg, gold scout/advocate) replaced with oxblood/cream `BRAND_DEFAULTS`

*Planner refines exact files during planning.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stage A visual approval | success criterion 5 | Visual fidelity to prototype cannot be asserted by source scan | Run dev server, open `/issue/[slug]` with mock data, compare against `19-PROTOTYPE.html` |
| `prefers-reduced-motion` content visibility | success criterion 4 | Requires browser with reduced-motion enabled | Toggle OS reduced-motion, confirm all sections fully visible, no hidden/empty states |

*Planner refines during planning.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
