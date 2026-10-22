---
phase: 56
slug: dashboard-redesign-grandma-simple-editor
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-22
---

# Phase 56 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: 56-RESEARCH.md § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.2 + @testing-library/react ^16.3 + jest-dom + jsdom |
| **Config file** | `apps/dispatch-control/vitest.config.ts` (globals false — import describe/it/expect) |
| **Quick run command** | `pnpm --filter dispatch-control exec vitest run __tests__/<file>` |
| **Full suite command** | `pnpm --filter dispatch-control test` |
| **Strict gate** | `pnpm --filter dispatch-control build` (typecheck is NOT a gate — pre-existing `__tests__/` errors) |
| **Estimated runtime** | ~30 seconds (suite); build ~90 s |

**Baseline (2026-10-22):** 104 files pass, 1 fails (`SectionReaderPage.test.tsx` "Save edit calls patchBonus…") — known, replaced by 56-04; not a regression.

---

## Sampling Rate

- **After every task commit:** quick run of the touched test file(s)
- **After every plan wave:** full suite + strict build
- **Before `/gsd:verify-work`:** full suite green, strict build green, browser-QA walkthrough at 1280 px and 400 px recorded in `56-UAT.md`
- **Max feedback latency:** 30 seconds

---

## Per-Requirement Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| P56-B1 | every state → exactly one of six status words; gate interrupt never Problem; cancelled → Stopped | unit | `vitest run __tests__/editorState.test.ts` | ❌ W0 | ⬜ pending |
| P56-B2 | four stations + slab copy per Home state (Collaborator, held, empty) | unit + component | `vitest run __tests__/editorState.test.ts __tests__/IssueHomeView.test.tsx` | ❌ W0 / rewrite | ⬜ pending |
| P56-A1 | each artboard route renders its states; phone classes present | component | `vitest run __tests__/IssueHomeView.test.tsx __tests__/SectionReaderPage.test.tsx __tests__/ArchiveScreen.test.tsx __tests__/AdminHub.test.tsx __tests__/BehindRun.test.tsx` | rewrite + ❌ W0 | ⬜ pending |
| P56-A2 | client walkthrough bugs 1–8 do not recur | component + browser QA | per-bug assertions in files above | partial | ⬜ pending |
| P56-A3 | no banned words / run ids / raw errors; exactly one `[data-primary]` per page | render scan | `vitest run __tests__/editorCopy.test.tsx` | ❌ W0 | ⬜ pending |
| P56-A3 | no font-mono / uppercase / tracking / sub-15px in editor files | source scan | `vitest run __tests__/editorStyle.test.ts` | ❌ W0 | ⬜ pending |
| P56-B3 | nav = exactly 3 links, aria-current | component | `vitest run __tests__/EditorShell.test.tsx __tests__/nav.test.ts` | ❌ W0 / rewrite | ⬜ pending |
| P56-B4 | in-place edit Save/Cancel/409/Escape; Rewrite keep/go-back; Rewrite hidden on podcast/deliberation/published | component | `vitest run __tests__/SectionReaderPage.test.tsx __tests__/RewriteThisPart.test.tsx` | rewrite + ❌ W0 | ⬜ pending |
| P56-B5 | retired files gone; no "Admin" label; palette unmounted | source scan | `vitest run __tests__/editorRetirement.test.ts` | ❌ W0 | ⬜ pending |
| guard | `/` single server page, force-dynamic | existing | `vitest run __tests__/homeRoute.test.ts` | ✅ | ⬜ pending |
| P56-A4 | strict build + full suite | build | `pnpm --filter dispatch-control build && pnpm --filter dispatch-control test` | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/editorState.test.ts`
- [ ] `__tests__/EditorShell.test.tsx`, `__tests__/NextStepSlab.test.tsx`, `__tests__/Stations.test.tsx`
- [ ] `__tests__/BehindRun.test.tsx`, `__tests__/BehindSteps.test.ts`
- [ ] `__tests__/RewriteThisPart.test.tsx`
- [ ] `__tests__/editorCopy.test.tsx`, `__tests__/editorStyle.test.ts`, `__tests__/editorRetirement.test.ts`
- [ ] Pre-flight: start local pipeline, confirm a draft loads in the browser (CORS); record baseline

---

## Manual-Only Verifications

| Behavior | Req | Why Manual | Test Instructions |
|----------|-----|------------|-------------------|
| Pixel/spacing fidelity vs 7 artboards | P56-A1 | jsdom has no layout | ecc:browser-qa at 1280 px and 400 px, compare to canvas/*.dc.html |
| Client walkthrough replay | P56-A2 | end-to-end judgement | replay `.planning/ui-reviews/client-ux-feedback-261022.md`, record in 56-UAT.md |
| Rewrite this part end-to-end | P56-B4 | needs OpenRouter key (revoked 2026-10-22) | after key replaced: rewrite a part, Keep, then Go back on another |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
