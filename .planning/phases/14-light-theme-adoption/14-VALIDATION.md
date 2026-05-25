---
phase: 14
slug: light-theme-adoption
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-24
---

# Phase 14 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 14-RESEARCH.md "## Validation Architecture" + 14-UI-SPEC.md test-update table.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (existing) |
| **Config file** | `apps/web/vitest.config.ts` (existing — no install needed) |
| **Quick run command** | `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts` |
| **Full suite command** | `cd apps/web && npx vitest run` |
| **Estimated runtime** | ~3 seconds (unit/source-scan only; no DOM render) |

---

## Sampling Rate

- **After every task commit:** `cd apps/web && npx vitest run __tests__/theme-aa-tones.test.ts`
- **After every plan wave:** `cd apps/web && npx vitest run` (all tripwires must stay green)
- **Before `/gsd:verify-work`:** Full web suite green + `pnpm --filter web build` exits 0
- **Max feedback latency:** ~5 seconds

---

## Per-Requirement Verification Map

> Task IDs assigned by the planner; every derived LIGHT-* requirement maps to an automated check except the two genuinely-visual ones (LIGHT-02 computed-style appearance, LIGHT-06 prompt-envelope intent), which are manual.

| Req ID | Behavior | Test Type | Automated Command | File | Status |
|--------|----------|-----------|-------------------|------|--------|
| LIGHT-01 | `:root` token values emit the locked light hex (bg #FAFAF8, text #1A1A1A, …) | unit | `npx vitest run __tests__/theme-aa-tones.test.ts` | theme-aa-tones.test.ts (update) | ⬜ pending |
| LIGHT-03 | Every text/UI token passes AA on LIGHT_BG; raw gold #CDA434 asserted BELOW AA (decorative-only) | unit | `npx vitest run __tests__/theme-aa-tones.test.ts` | theme-aa-tones.test.ts (update) | ⬜ pending |
| LIGHT-04 | Editor agent chip + QA warning use `--color-primary-text` (not raw gold) | source-scan | `npx vitest run __tests__/theme-aa-tones.test.ts` | theme-aa-tones.test.ts (update scan) | ⬜ pending |
| LIGHT-05 | `.snw-*` / `.sc-*` 11px text uses `--color-primary-text`; no `rgba(0,0,0,` in `.section-card` | source-scan | `npx vitest run __tests__/theme-aa-tones.test.ts` | theme-aa-tones.test.ts (add scan) | ⬜ pending |
| LIGHT-07 (regression) | Existing tripwires stay green; build passes | unit + build | `npx vitest run` ; `pnpm --filter web build` | issue-page-typography / deliberation-no-model-names / game-sandbox / podcast-slot / deliberation-conversation | ⬜ pending |
| LIGHT-02 | Derived color-mix tokens render correctly on paper (hairlines visible, glows soft) | manual | browser inspect computed styles across pages | — | ⬜ pending |
| LIGHT-06 | DesignAgent prompt envelope describes the light canvas | manual | `grep -iE "FAFAF8\|warm paper\|daylight\|light" packages/pipeline/src/eisenbalm_pipeline/agents/design/__init__.py` | design/__init__.py | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing Vitest infrastructure covers all automated phase requirements — **no new test files needed**. The Wave 0 work is an **update**, not creation:

- [ ] `apps/web/__tests__/theme-aa-tones.test.ts` — rename `DARK_BG` → `LIGHT_BG`; update all token hex + assert thresholds per the 14-UI-SPEC table; add `--color-primary-text` (#7A5C0E ≥4.5:1) and `--color-accent-text` (#9B3015 ≥4.5:1) assertions; flip the `--color-primary` #CDA434 assertion from `≥AA` (passed on dark) to `< AA` (decorative-only on light); document `#938A77` as rejected (was the dark-base mute).
- [ ] (source-scan, same file) add: `--color-primary` MUST NOT appear in `.snw-*` / `.sc-*` selectors after Phase 14 (must be `--color-primary-text`); `rgba(0,0,0,` MUST NOT appear in `.section-card`.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| No dark surfaces remain anywhere | LIGHT-02 / SC-1 | Visual sweep across rendered pages can't be fully asserted by token unit tests | Load `/`, `/issue/[slug]`, `/archive`, `/charities`, `/about`, `/shop` on the light build; confirm every surface is paper/light — no residual dark cards, navigator, deliberation, footer |
| On-paper glow/shadow readability | LIGHT-02 / SC-3 | Aesthetic judgment of softened aurora + paper shadows | Inspect issue page atmosphere glows + `.section-card` hover shadow on `#FAFAF8`; confirm subtle, on-brand, not muddy/invisible |
| DesignAgent light envelope intent | LIGHT-06 / SC-4 | Prompt-text intent (not just keyword presence) | Read the updated `AESTHETIC ENVELOPE` block; confirm it describes the warm-paper light aesthetic coherently |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (theme-aa-tones.test.ts update covers LIGHT-01/03/04/05; tripwires cover LIGHT-07)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers the test-update dependency before implementation is verified
- [ ] No watch-mode flags (uses `vitest run`)
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner wires task IDs)

**Approval:** pending
