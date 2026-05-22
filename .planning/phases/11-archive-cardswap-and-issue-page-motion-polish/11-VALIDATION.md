---
phase: 11
slug: archive-cardswap-and-issue-page-motion-polish
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-21
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.2.0 (`environment: 'node'`) |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter web test:unit` |
| **Full suite command** | `pnpm --filter web test:unit` (same — all tests in `apps/web/__tests__/`) |
| **Build check** | `pnpm --filter web build` |
| **Estimated runtime** | ~5–15 seconds (source-scan tests, no DOM/render) |

**Test pattern:** All new tests follow the established `readFileSync` + source-scan pattern from `game-sandbox.test.ts` and `issue-page-typography.test.ts`. No DOM, no React render, no mocks — pure file-content grep assertions. Compatible with the `node` test environment.

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter web test:unit`
- **After every plan wave:** Run `pnpm --filter web test:unit` + `pnpm --filter web build`
- **Before `/gsd:verify-work`:** Full suite green AND `pnpm --filter web build` passes
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Requirement-level map derived from RESEARCH.md `## Validation Architecture`. The planner refines `Task ID` / `Plan` / `Wave` columns when tasks are written; every row must map to a task `<acceptance_criteria>`.

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| ARC-01 | CardSwap binds to real `ArchiveIssue[]`, no hardcoded issue content | source-scan | `pnpm --filter web test:unit` | ❌ W0 `archive-cardswap.test.ts` | ⬜ pending |
| ARC-01 | `apps/web/package.json` dependencies unchanged (no new npm dep) | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| ARC-01 | No CDN `<script>`/`@import` in CardSwap.tsx | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| ARC-01 | Auto-cycle disabled under `prefers-reduced-motion` (timer not started; static keyboard list) | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| ARC-01 | Indicator dots / controls have `aria-label` + `aria-current`; ≥44px targets | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| ARC-01 | CardSwap wrapper has `data-print-hide="true"`; uses `<section>` not `<main>` | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| MOT-01 | Hero `<h1>` charity name split into word/line spans | source-scan | `pnpm --filter web test:unit` | ❌ W0 `issue-hero-motion.test.ts` | ⬜ pending |
| MOT-01 | `opacity: 0` / `clip-path` reveal only in `@keyframes` (not base style → no FOUC/hidden under reduced-motion) | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| MOT-01 | IssueHero retains ≥2 `.eyebrow` usages (DES-04 inheritance) | source-scan (existing) | `pnpm --filter web test:unit` | ✅ `issue-page-typography.test.ts` | ⬜ pending |
| MOT-02 | `.section-card:hover` adds `transform: translateY(-4px)` in globals.css | source-scan | `pnpm --filter web test:unit` | ❌ W0 `motion-polish.test.ts` | ⬜ pending |
| MOT-02 | `SectionNavigator.tsx` magnetic glow keeps `prefersReducedMotion` early-return | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| MOT-03 | `DeliberationSlot.tsx` count-up uses `IntersectionObserver` | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| MOT-03 | Reduced-motion branch shows final confidence value instantly (not 0) | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| MOT-03 | `.pitch-card-list` in globals.css has `scroll-snap-type` | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| DEL-04 | `DeliberationSlot.tsx` exposes no model names after Phase 11 edits | source-scan (existing) | `pnpm --filter web test:unit` | ✅ `deliberation-no-model-names.test.ts` | ⬜ pending |
| Security | `GameSlot.tsx` unchanged: `sandbox="allow-scripts"`, no `allow-same-origin` | source-scan (existing) | `pnpm --filter web test:unit` | ✅ `game-sandbox.test.ts` | ⬜ pending |
| Security | `FONT_WHITELIST` unchanged in `theme.ts` (6 entries, frozen) | source-scan (new) | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| WCAG | No new `:root` hex values (AA tones inherited) | source-scan (existing) | `pnpm --filter web test:unit` | ✅ `theme-aa-tones.test.ts` | ⬜ pending |
| Build | `pnpm --filter web build` passes TS + Next build | build | `pnpm --filter web build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

New test files to create before/alongside implementation:

- [ ] `apps/web/__tests__/archive-cardswap.test.ts` — ARC-01: source-scan of `CardSwap.tsx` (no hardcoded issue content, no CDN scripts/`@import`, `data-print-hide`, reduced-motion guard present, indicator `aria-label`/`aria-current`, no `<main>`); source-scan of `archive/page.tsx` (imports + renders CardSwap); `apps/web/package.json` dependencies unchanged vs baseline; `theme.ts` `FONT_WHITELIST` length still 6, no new entries
- [ ] `apps/web/__tests__/issue-hero-motion.test.ts` — MOT-01: source-scan of `IssueHero.tsx` (name `.split(...)`, inline `animationDelay`, no base `opacity: 0`/`clip-path` outside `@keyframes`; eyebrow count ≥2 inherited)
- [ ] `apps/web/__tests__/motion-polish.test.ts` — MOT-02 + MOT-03: source-scan of `globals.css` (`.section-card:hover` `translateY`, `.pitch-card-list` `scroll-snap-type`); `DeliberationSlot.tsx` (`IntersectionObserver`, `setDisplayValue`, reduced-motion final-value branch, no model names — inherits DEL-04); `SectionNavigator.tsx` (retains `prefersReducedMotion` early-return)

*Existing tests (`game-sandbox`, `theme-aa-tones`, `deliberation-no-model-names`, `issue-page-typography`, `site-header-nav`) are tripwires that must stay green — no edits needed, they guard regressions.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| CardSwap 3D cycle animates smoothly, pauses on hover, click opens issue | ARC-01 | Visual motion + pointer interaction not asserted by source-scan | Load `/archive`, observe ~6s auto-advance, hover to pause, click a card → navigates to `/issue/{slug}` |
| Hero clip-path reveal plays on load; instant under reduced-motion | MOT-01 | Animation timing is visual | Load `/issue/issue-999`; then enable OS "Reduce motion" and reload — name appears instantly |
| Magnetic gold glow follows cursor; absent under reduced-motion | MOT-02 | Pointer-tracking is visual | Hover section-navigator cards; toggle reduce-motion → glow static/absent, cards still keyboard-focusable |
| Confidence count-up animates 0→value on scroll; final value instant under reduced-motion | MOT-03 | Scroll-triggered visual | Scroll DeliberationSlot into view; toggle reduce-motion → final value shown immediately |
| AA contrast on new surfaces; ≥44px targets | WCAG/constraint | Requires rendered measurement | Spot-check with devtools/contrast tool on CardSwap controls + nav cards |

---

## Validation Sign-Off

- [ ] All tasks have `<acceptance_criteria>` mapping to a verify command or Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING (❌) references
- [ ] No watch-mode flags in commands
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner wires task IDs)

**Approval:** pending
