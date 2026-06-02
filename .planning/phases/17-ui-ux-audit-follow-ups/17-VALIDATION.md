---
phase: 17
slug: ui-ux-audit-follow-ups
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.0 |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter web test:unit` |
| **Full suite command** | `pnpm --filter web test:unit` (no split in this project) |
| **Estimated runtime** | ~3.3 seconds (26 test files, 234 tests baseline) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test:unit`
- **After every plan wave:** Run `pnpm --filter web test:unit` + `pnpm --filter web build` (build confirms no TS/import regressions)
- **Before `/gsd:verify-work`:** Full suite green + manual Lighthouse CLS check documented in VERIFICATION.md
- **Max feedback latency:** ~5 seconds

---

## Per-Task Verification Map

> Planner fills exact Task IDs once plans exist. Requirements below are derived from the 6 ROADMAP success criteria (no pre-assigned REQ-IDs for this phase).

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | P17-* (test stubs) | wave-0 | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | P17-01 BonusSection uses `next/image` `fill`, no raw `<img>` | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | P17-03 ArchiveList has PAGE_SIZE + load-more, dep count still 17 | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | P17-04 loading.tsx at 4 route segments, none use `<main>` | source-scan (file-exists) | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | P17-05 /about has no "This page is being written" placeholder | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | P17-06 _debug/convex has no `<main>` | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | P17-07 prior 234 tests still green | regression | `pnpm --filter web test:unit` | ✅ existing | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New source-scan test files needed before implementation (~20–25 assertions, bringing total to ~254–260):

- [ ] `apps/web/__tests__/bonus-section-image.test.ts` — P17-01: imports `next/image`, no raw `<img`, no `no-img-element` eslint-disable
- [ ] `apps/web/__tests__/archive-pagination.test.ts` — P17-03: `PAGE_SIZE`/`visibleCount`/load-more present; dependency count guard stays 17
- [ ] `apps/web/__tests__/loading-skeletons.test.ts` — P17-04: the 4 `loading.tsx` files exist and none contain `<main`
- [ ] `apps/web/__tests__/about-page.test.ts` — P17-05: no "being written" string; `<article>` wrapper present
- [ ] `apps/web/__tests__/debug-route.test.ts` — P17-06: `_debug/convex/page.tsx` contains no `<main`

*Existing 26 test files cover the regression baseline (P17-07).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CLS measurable improvement on `/issue/[slug]` | P17-02 | Lighthouse runtime metric, not source-checkable | Run Lighthouse on a live/preview `/issue/[slug]`; record CLS before/after in VERIFICATION.md |
| /about copy reads in Jesse voice | P17-05 (copy half) | Editorial judgement; gated on Andrew supplying approved text | Andrew reviews rendered `/about`; confirms voice + removes any `TODO(Andrew)` marker |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
