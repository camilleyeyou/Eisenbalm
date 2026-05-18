---
phase: 7
slug: game-rendering
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-18
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (to be installed in Wave 0) |
| **Config file** | `apps/web/vitest.config.ts` (Wave 0 creates) |
| **Quick run command** | `pnpm --filter apps/web test:unit` |
| **Full suite command** | `pnpm --filter apps/web test:unit --reporter=verbose` |
| **Estimated runtime** | ~5 seconds (pure unit + source-scan; no browser) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter apps/web test:unit`
- **After every plan wave:** Run `pnpm --filter apps/web test:unit --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green + Andrew manual smoke (mobile + validator failure path) complete
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-* | 01 (test infra) | 0 | (Wave 0 — installs Vitest, writes test stubs for GAM-01..GAM-04) | install + stubs | `pnpm --filter apps/web test:unit` (passes empty) | ❌ W0 creates | ⬜ pending |
| 07-02-* | 02 (validator) | 1 | GAM-02, GAM-04 | unit | `pnpm --filter apps/web test:unit game-validator` | ❌ W0 stub | ⬜ pending |
| 07-03-* | 03 (GameSlot wiring) | 1 | GAM-01, GAM-05 | unit + manual | `pnpm --filter apps/web test:unit game-sandbox` | ❌ W0 stub | ⬜ pending |
| 07-04-* | 04 (mobile + smoke) | 2 | GAM-06 | manual smoke | Andrew loads issue at 360px | N/A — manual | ⬜ pending |
| 07-05-* | 05 (source-scan) | 1 | GAM-03 | source-scan (Vitest) | `pnpm --filter apps/web test:unit game-sandbox` | ❌ W0 stub | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/vitest.config.ts` — minimal Vitest config with `vite-tsconfig-paths` for `@/*` alias
- [ ] `apps/web/package.json` — add `test:unit` script (`vitest run`) and `vitest`, `@vitest/ui`, `vite-tsconfig-paths` devDependencies
- [ ] `apps/web/__tests__/game-validator.test.ts` — empty stubs for GAM-02, GAM-04 validator tests
- [ ] `apps/web/__tests__/game-sandbox.test.ts` — empty stubs for GAM-01, GAM-03 source-scan tests
- [ ] Framework install: `pnpm --filter apps/web add -D vitest @vitest/ui vite-tsconfig-paths`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `qaCorrections` row appears in Convex on validation failure | GAM-05 | Requires running Convex dev deployment + real React mount | (1) Write a fixture issue in Sanity Studio with `embedCode` containing `document.cookie`. (2) Load `/issue/<slug>` in browser. (3) Check Convex dashboard `qaCorrections` table — row exists with `sectionName='game'`, `severity='error'`, `agentId='game-validator'`, `reason` containing "cookie access". |
| "Game unavailable." fallback renders when validation fails | GAM-05 | Requires real React mount; verifies visible copy | Same fixture as above. Confirm `<GameSlot>` shows the fallback copy "Game unavailable." (not the iframe). |
| Game renders at 360px viewport with no horizontal scroll | GAM-06 | Cannot fully validate LLM-generated HTML without Playwright | (1) Open a real published issue (issue 999 from Phase 5 smoke). (2) In Chrome DevTools, set viewport to 360×640. (3) Verify the `#game` section's iframe container shows no horizontal scrollbar and game content is not clipped beyond the rounded container. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify OR Wave 0 dependencies OR explicit manual entry above
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (Wave 2 mobile smoke is the only manual gap; preceded and followed by automated tasks)
- [ ] Wave 0 covers all MISSING references (Vitest install + config + test stubs)
- [ ] No watch-mode flags (`vitest run`, not `vitest`)
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter (flip after Wave 0 plan exists)

**Approval:** pending
