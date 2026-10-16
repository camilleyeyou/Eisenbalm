---
phase: 52
slug: issue-the-front-door
status: green
nyquist_compliant: true
wave_0_complete: true
created: 2026-10-16
---

# Phase 52 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.2 + @testing-library/react ^16.3 + jsdom ^26 |
| **Config file** | `apps/dispatch-control/vitest.config.ts` |
| **Quick run command** | `pnpm --filter dispatch-control exec vitest run __tests__/IssueHome.test.tsx __tests__/IssueHomeView.test.tsx __tests__/homeSections.test.ts __tests__/publishChain.test.ts __tests__/homeRoute.test.ts` |
| **Full suite command** | `pnpm --filter dispatch-control test` |
| **Type/build gate** | `pnpm --filter dispatch-control typecheck && pnpm --filter dispatch-control build` |
| **Estimated runtime** | ~30 s quick · ~4 min full |

---

## Sampling Rate

- **After every task commit:** quick run command
- **After every plan wave:** full suite command
- **Before `/gsd:verify-work`:** full suite + typecheck + strict build green, then deployed-URL read-through
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| HOME-01 | `/` shows real title+subject; `none` state invents nothing; one page owns `/` | component + static | `vitest run __tests__/IssueHome.test.tsx __tests__/IssueHomeView.test.tsx -t "title"` + strict build | ✅ | ✅ green |
| HOME-02 | nine rows in EDITABLE_SECTIONS order with produced headline / fixed descriptors | unit | `vitest run __tests__/homeSections.test.ts -t "headline"` | ✅ | ✅ green |
| HOME-03 | state derived (fix / clean / writing); absent data never "clean"; warnings never block; legacy accepted-without-resolution gap documented | unit | `vitest run __tests__/homeSections.test.ts -t "state"` | ✅ | ✅ green |
| HOME-04 | row notes "1 thing to fix →" / "N things to fix →" / "Reads clean" / "Being written…"; no checklist | component | `vitest run __tests__/IssueHomeView.test.tsx -t "note"` | ✅ | ✅ green |
| HOME-05 | row href `/s/{id}#finding-{firstId}`; section page scrolls to hash after load | unit + component | `vitest run __tests__/homeSections.test.ts -t "href"`; `vitest run __tests__/SectionReaderPage.test.tsx -t "hash"` | ✅ | ✅ green |
| HOME-06 | exactly one Publish `<button>`; footer sentence variants with linked story names | component | `vitest run __tests__/IssueHomeView.test.tsx -t "footer"`; `vitest run __tests__/homeSections.test.ts -t "footer"` | ✅ | ✅ green |
| HOME-07 | enablement parity with server gate; chain facts→voice→publish, skips recorded, stops on first failure; inline confirm; no window.confirm; published = issue.published OR runStatus 'complete'; 75s slow notice | unit + component | `vitest run __tests__/publishChain.test.ts`; `vitest run __tests__/IssueHomeView.test.tsx __tests__/IssueHome.test.tsx -t "publish"` | ✅ | ✅ green |
| HOME-08 | none / running / failed / gate-1 paused / published states honest, terminal kinds resolve first (incl. draft fetch rejected) | unit + component | `vitest run __tests__/homeSections.test.ts -t "footer"`; `vitest run __tests__/IssueHomeView.test.tsx __tests__/IssueHome.test.tsx -t "states"` | ✅ | ✅ green |
| HOME-09 | any of findings/claims/signOffs/issue/draft undefined, or a stale draft from a previous runId → no clean/ready copy, aria-busy skeleton | unit + component | `vitest run __tests__/homeSections.test.ts __tests__/IssueHomeView.test.tsx __tests__/IssueHome.test.tsx -t "loading"` | ✅ | ✅ green |
| route | `(editorial)/page.tsx` exists, `(dashboard)/page.tsx` and `app/page.tsx` do not; `/run`, `/issues`, `/issues/[n]/approval` still exist | static fs | `vitest run __tests__/homeRoute.test.ts` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `apps/dispatch-control/__tests__/homeSections.test.ts` — selector + footer sentence builder
- [x] `apps/dispatch-control/__tests__/publishChain.test.ts` — chain incl. 409 reasons (`claims_not_signed_off`, `open_error_findings`, `open_voice_findings`, `run_not_reviewable`, `forbidden_role`, `missing_signoffs`, `wrong_status`, `no_sanity_issue`)
- [x] `apps/dispatch-control/__tests__/IssueHomeView.test.tsx` — props-only view (52-03): title / note / footer / publish / states / loading
- [x] `apps/dispatch-control/__tests__/IssueHome.test.tsx` — live data wrapper (52-04): title / loading / publish / states
- [x] `apps/dispatch-control/__tests__/homeRoute.test.ts` — fs route assertions
- [x] new `hash` spec in `apps/dispatch-control/__tests__/SectionReaderPage.test.tsx`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Page matches the approved canvas (3 boards) and reads clearly to a non-technical editor | HOME-01..08 | Perceptual; jsdom can't judge it, local dev can't load drafts (CORS) | On the deployed Vercel URL: open `/` on the current issue, compare with the Dispatch Home canvas, follow a "thing to fix" link to the sentence, check phone width |
| One-click Publish end to end | HOME-07 | Publishes a real issue | Only when the editor intends to publish: click Publish → confirm → issue goes live, footer shows "Published <date>" |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automated gate green 2026-10-16; manual read-through pending (52-HUMAN-UAT.md)
