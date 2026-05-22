---
phase: 12
slug: machine-editorial-design-adoption-and-designagent-suppression
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Spans two runtimes: `apps/web` (Vitest) and `packages/pipeline` (pytest).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (web)** | Vitest 3.x |
| **Framework (pipeline)** | pytest |
| **Config file** | `apps/web/vitest.config.ts` · `packages/pipeline/` (pytest default) |
| **Quick run command** | web: `pnpm --filter web test:unit` · pipeline: `cd packages/pipeline && pytest` |
| **Full suite command** | `pnpm --filter web test:unit && pnpm --filter web build` · `cd packages/pipeline && pytest` |
| **Estimated runtime** | web unit ~10s, web build ~60s, pipeline pytest ~30s |

---

## Sampling Rate

- **After every task commit:** web tasks → `pnpm --filter web test:unit`; pipeline tasks → `cd packages/pipeline && pytest`
- **After every plan wave:** `pnpm --filter web test:unit && pnpm --filter web build` (web waves) and/or `cd packages/pipeline && pytest` (pipeline waves)
- **Before `/gsd:verify-work`:** both full suites green + `pnpm --filter web build` exits 0
- **Max feedback latency:** ~70 seconds (web unit + build)

---

## Per-Task Verification Map

> Task IDs assigned by the planner. Rows below are requirement-anchored; the planner maps each to a concrete task ID in its PLAN frontmatter.

| Req | Behavior | Wave | Test Type | Automated Command | File Exists | Status |
|-----|----------|------|-----------|-------------------|-------------|--------|
| MED-01 | When suppressed, NO per-issue theme override emitted (serializer returns `''`, applier early-returns) — `globals.css :root` wins | — | unit | `pnpm --filter web test:unit -- theme` | ⚠️ partial (`theme.test.ts` covers theme.ts logic; suppression behavior = W0) | ⬜ pending |
| MED-02 (web) | `ThemeApplier` early-returns when `suppressed=true` | — | unit | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| MED-02 (pipeline) | `build_graph` excludes `design` node + edges when `DESIGNAGENT_SUPPRESSED=true` | — | unit | `cd packages/pipeline && pytest tests/test_pipeline_real_mode.py` | ⚠️ partial (non-suppressed covered; suppressed = W0) | ⬜ pending |
| MED-02 (pipeline) | `validate_sections` does NOT require `theme` when suppressed (REQUIRED_FIELDS drops `theme` in lockstep) | — | unit | `cd packages/pipeline && pytest tests/agents/test_validate.py` | ❌ W0 (verify file exists) | ⬜ pending |
| MED-03 | `_build_messages` prompt contains the Machine Editorial envelope phrase; ThemeOutput/validation/fallback unchanged | — | source-scan + unit | `cd packages/pipeline && pytest tests/agents/test_design.py` | ⚠️ partial (existing tests don't assert prompt text; add 1 assertion) | ⬜ pending |
| MED-04 | Canonical anchor ids preserved in rebuilt `SectionNavigator.tsx` (`#origin-story`…`#podcast`) | — | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| MED-04 | `prefers-reduced-motion` early-return preserved in `SectionNavigator.tsx` | — | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| MED-05 | `AGENT_LABELS` present in rebuilt `DeliberationSlot.tsx`; 5 Convex subscriptions intact | — | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |
| MED-05 | No model names rendered in `DeliberationSlot.tsx` (DEL-04) — use `codeOnly()` before regex | — | source-scan | `pnpm --filter web test:unit` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/__tests__/machine-editorial-components.test.ts` — 4 source-scan tripwires (MED-04 anchor ids + reduced-motion; MED-05 AGENT_LABELS + no-model-names). Mirror the `readFileSync` + grep pattern in `game-sandbox.test.ts` / `issue-page-typography.test.ts`; reuse the `codeOnly()` comment-stripping helper before the model-name regex (avoids false-positive on the `run.cost` security comment).
- [ ] `apps/web/__tests__/theme.test.ts` (or sibling) — add a suppression-mode assertion proving the serializer/applier emit no override when the flag is set (existing theme.ts validation assertions stay green).
- [ ] `packages/pipeline/tests/test_pipeline_real_mode.py` — add a `test_design_suppressed` variant: graph compiles + completes without `theme` when `DESIGNAGENT_SUPPRESSED=true` (the existing line ~468 `theme.primaryColor` assertion only runs in non-suppressed mode).
- [ ] `packages/pipeline/tests/agents/test_validate.py` — verify it exists; add an assertion that `validate_sections` passes without `theme` in suppressed mode (REQUIRED_FIELDS no longer includes `theme`). If the file is missing, create it.
- [ ] `packages/pipeline/tests/agents/test_design.py` — add one assertion that `_build_messages` output contains the Machine Editorial envelope key phrase (MED-03).

*Existing infrastructure (Vitest + pytest) is installed — Wave 0 only adds test files/cases, no framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vertical Timeline renders at high fidelity vs board screenshot | MED-04 | Visual fidelity / layout polish not assertable by grep | Run `pnpm --filter web dev`, open `/issue/issue-999`, compare SectionNavigator to board node #1 screenshot; check spine, node dots, `§ NN`, READ STATUS column, scroll progress |
| Carousel & Flow renders at high fidelity vs board screenshot | MED-05 | Visual fidelity / motion feel | Same page; check horizontal pitch log scroll-snap, winner glow, Scout→Advocate→Editor flow line, tape-reel meter count-up |
| `prefers-reduced-motion` disables all new motion | MED-04/MED-05 | Requires OS/browser setting toggle | Enable Reduce Motion in OS; reload `/issue/issue-999`; confirm count-up shows final value instantly, cursor glow static, no auto-advance |
| Flag flips with no code change | MED-02 | Requires Vercel/Railway dashboard env edit + redeploy | Set `DESIGNAGENT_SUPPRESSED=false` in both dashboards, redeploy; confirm per-issue theming returns and the `design` node runs |
| WCAG AA contrast on rebuilt surfaces | MED-04/MED-05 | Contrast tooling is manual/visual | Spot-check new text surfaces with a contrast checker against `#0C0B0A`; `theme-aa-tones.test.ts` covers the token values automatically |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (4 web tripwires + 3 pipeline test cases)
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < 70s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
