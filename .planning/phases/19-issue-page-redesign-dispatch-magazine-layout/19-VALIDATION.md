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
| **Full suite command** | `pnpm --filter web test:unit && pnpm --filter web typecheck && pnpm --filter web build` |
| **Estimated runtime** | ~30 seconds (build adds ~60s) |

**Baseline:** 259 tests / 31 files — all stay green. `theme-aa-tones.test.ts` is UPDATED (Plan 01) to assert the Phase 19 oxblood/cream palette (replaces Phase 14 light-palette assertions). `issue-page-dispatch.test.ts` is a NEW Wave 0 source-scan file.

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test:unit`
- **After every plan wave:** Run `pnpm --filter web test:unit && pnpm --filter web typecheck`
- **Stage A gate (Plan 04):** All three automated gates green + human visual approval vs `19-PROTOTYPE.html`
- **Stage B gate (Plan 05):** Full suite + `pnpm --filter web build` green + live-data UAT + per-issue-theme + reduced-motion human verify
- **Max feedback latency:** 30 seconds (test:unit)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-T1 fonts + framer-motion | 19-01 | 1 | DES-01, P19-02 | source-scan + typecheck | `pnpm --filter web typecheck` | ✅ issue-page-dispatch.test.ts (01-T4) | ⬜ pending |
| 01-T2 theme.ts tokens | 19-01 | 1 | P19-03, WEB-08, AGT-14 | unit + source-scan | `pnpm --filter web test:unit` | ✅ theme-aa-tones + issue-page-dispatch | ⬜ pending |
| 01-T3 globals.css re-token | 19-01 | 1 | P19-03 | source-scan | `pnpm --filter web test:unit` | ✅ issue-page-dispatch.test.ts | ⬜ pending |
| 01-T4 test gate update + tripwires | 19-01 | 1 | P19-06, WEB-09 | unit (RED→GREEN) | `pnpm --filter web test:unit` | ✅ (this task authors) | ⬜ pending |
| 02-T1 motion primitives + retire | 19-02 | 2 | P19-04, P19-07 | source-scan + typecheck | `pnpm --filter web typecheck` | ✅ issue-page-dispatch.test.ts | ⬜ pending |
| 02-T2 masthead/briefing/mission/shop | 19-02 | 2 | P19-01, CMR-09, WEB-15 | typecheck | `pnpm --filter web typecheck` | ✅ (source-scan grep in plan) | ⬜ pending |
| 02-T3 restyle editorial/game/bonus/pod | 19-02 | 2 | DES-02/03/05, GAM-01/04, POD-01/03 | unit (existing tripwires) | `pnpm --filter web test:unit` | ✅ game-sandbox + podcast-slot | ⬜ pending |
| 02-T4 page.tsx MOCK 10-section | 19-02 | 2 | P19-01, P19-05(A) | build + source-scan | `pnpm --filter web build` | ✅ issue-page-dispatch.test.ts | ⬜ pending |
| 03-T1 scoreboard + confidence + dark css | 19-03 | 2 | DEL-02 | typecheck | `pnpm --filter web typecheck` | ✅ (source-scan grep in plan) | ⬜ pending |
| 03-T2 DelibChat stagger + DEL-04 | 19-03 | 2 | DEL-04, P19-04 | unit | `pnpm --filter web test:unit` | ✅ deliberation-no-model-names | ⬜ pending |
| 03-T3 DeliberationSlot rewrite + 5 subs | 19-03 | 2 | DEL-01..05 | unit + build | `pnpm --filter web test:unit` | ✅ deliberation-subscriptions | ⬜ pending |
| 04-T1 Stage A gates green | 19-04 | 3 | P19-05(A) | full gate | `pnpm --filter web test:unit && build` | ✅ all | ⬜ pending |
| 04-T2 visual approval | 19-04 | 3 | P19-05(A), P19-04 | MANUAL (human-verify) | n/a — visual vs prototype | n/a | ⬜ pending |
| 05-T1 theme re-enable layout.tsx | 19-05 | 4 | WEB-06, DES-06, P19-03 | source-scan | `pnpm --filter web test:unit` | ✅ issue-page-dispatch.test.ts | ⬜ pending |
| 05-T2 live fetch swap page.tsx | 19-05 | 4 | P19-05(B), DEL-01, GAM-05 | typecheck + source-scan | `pnpm --filter web typecheck` | ✅ issue-page-dispatch.test.ts | ⬜ pending |
| 05-T3 full verify + sign-off | 19-05 | 4 | P19-06 | full gate + MANUAL UAT | `pnpm --filter web test:unit && typecheck && build` | ✅ all | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **Sampling continuity:** No 3 consecutive tasks lack an automated verify. Every code task has a `pnpm --filter web test:unit` / `typecheck` / `build` gate. The two checkpoint tasks (04-T2, 05-T3) are gated by automated gates immediately before/within them.

---

## Wave 0 Requirements

- [x] `apps/web/__tests__/issue-page-dispatch.test.ts` — NEW source-scan tripwires (Plan 01 Task 4): Fraunces/Newsreader/IBM Plex Mono in layout.tsx, FONT_WHITELIST 9 entries, BRAND_DEFAULTS oxblood/cream, `it.todo` placeholders for the suppression-off (Plan 05) + framer-motion-component + DelibChat-a11y (Plan 03) conditions, framer-motion dependency. Authored RED-aware (only currently-true assertions active in Wave 1).
- [x] Update `apps/web/__tests__/theme-aa-tones.test.ts` — Phase 14 `#FAFAF8` + gold assertions replaced with Phase 19 oxblood/cream palette (`#FBFAF6` bg, `#1A1714` ink, dark-band scout/advocate/accent-on-dark ratios) (Plan 01 Task 4).

*Wave 0 work lives inside Plan 01 (foundation + test gate are tightly coupled — the tripwires only go green once the foundation lands).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Plan |
|----------|-------------|------------|-------------------|------|
| Stage A visual approval | P19-05 (success criterion 5) | Visual fidelity to prototype cannot be asserted by source scan | Run `pnpm --filter web dev`, open `/issue/[slug]` (MOCK data), compare section-by-section against `19-PROTOTYPE.html` | 19-04 |
| `prefers-reduced-motion` content visibility | P19-04 (success criterion 4) | Requires browser with reduced-motion enabled | Toggle OS reduced-motion, confirm all 10 sections fully visible, no hidden/empty/opacity-0 states, all chat messages present, confidence bar full | 19-04 + 19-05 |
| Per-issue theme override | WEB-06, DES-06 (success criterion 3) | Requires two issues with different Sanity `theme.accentColor`; visual comparison | Open two issues (or set distinct accentColor on one); confirm accent changes while structure/grid/motion identical | 19-05 |
| Live deliberation data | DEL-01 (success criterion 1) | Requires a real run with Convex data | Open a real issue with `runId`; confirm scoreboard scores + live chat conversation render | 19-05 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (issue-page-dispatch.test.ts + theme-aa-tones update)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter (flipped in Plan 05 Task 3)

**Approval:** pending
