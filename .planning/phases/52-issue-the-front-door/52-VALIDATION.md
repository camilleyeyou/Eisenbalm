---
phase: 52
slug: issue-the-front-door
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| **Quick run command** | `pnpm --filter dispatch-control exec vitest run __tests__/IssueHome.test.tsx __tests__/homeSections.test.ts __tests__/publishChain.test.ts __tests__/homeRoute.test.ts` |
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
| HOME-01 | `/` shows real title+subject; `none` state invents nothing; one page owns `/` | component + static | `vitest run __tests__/IssueHome.test.tsx -t "title"` + strict build | ❌ W0 | ⬜ pending |
| HOME-02 | nine rows in EDITABLE_SECTIONS order with produced headline / fixed descriptors | unit | `vitest run __tests__/homeSections.test.ts -t "headline"` | ❌ W0 | ⬜ pending |
| HOME-03 | state derived (fix / clean / writing); absent data never "clean" | unit | `vitest run __tests__/homeSections.test.ts -t "state"` | ❌ W0 | ⬜ pending |
| HOME-04 | row notes "1 thing to fix →" / "N things to fix →" / "Reads clean" / "Being written…"; no checklist | component | `vitest run __tests__/IssueHome.test.tsx -t "note"` | ❌ W0 | ⬜ pending |
| HOME-05 | row href `/s/{id}#finding-{firstId}`; section page scrolls to hash after load | unit + component | `vitest run __tests__/homeSections.test.ts -t "href"`; `vitest run __tests__/SectionReaderPage.test.tsx -t "hash"` | ❌ W0 | ⬜ pending |
| HOME-06 | exactly one Publish `<button>`; footer sentence variants with linked story names | component | `vitest run __tests__/IssueHome.test.tsx -t "footer"` | ❌ W0 | ⬜ pending |
| HOME-07 | enablement parity with server gate; chain facts→voice→publish, skips recorded, stops on first failure; inline confirm; no window.confirm | unit + component | `vitest run __tests__/publishChain.test.ts`; `vitest run __tests__/IssueHome.test.tsx -t "publish"` | ❌ W0 | ⬜ pending |
| HOME-08 | none / running / failed / gate-1 paused / published states honest | component | `vitest run __tests__/IssueHome.test.tsx -t "states"` | ❌ W0 | ⬜ pending |
| HOME-09 | any of findings/claims/signOffs/issue/draft undefined → no clean/ready copy, aria-busy skeleton | component | `vitest run __tests__/IssueHome.test.tsx -t "loading"` | ❌ W0 | ⬜ pending |
| route | `(editorial)/page.tsx` exists, `(dashboard)/page.tsx` and `app/page.tsx` do not; `/run`, `/issues`, `/issues/[n]/approval` still exist | static fs | `vitest run __tests__/homeRoute.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/dispatch-control/__tests__/homeSections.test.ts` — selector + footer sentence builder
- [ ] `apps/dispatch-control/__tests__/publishChain.test.ts` — chain incl. 409 reasons (`claims_not_signed_off`, `open_error_findings`, `open_voice_findings`, `run_not_reviewable`, `forbidden_role`, `missing_signoffs`, `wrong_status`, `no_sanity_issue`)
- [ ] `apps/dispatch-control/__tests__/IssueHome.test.tsx` — page component
- [ ] `apps/dispatch-control/__tests__/homeRoute.test.ts` — fs route assertions
- [ ] new `hash` spec in `apps/dispatch-control/__tests__/SectionReaderPage.test.tsx`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Page matches the approved canvas (3 boards) and reads clearly to a non-technical editor | HOME-01..08 | Perceptual; jsdom can't judge it, local dev can't load drafts (CORS) | On the deployed Vercel URL: open `/` on the current issue, compare with the Dispatch Home canvas, follow a "thing to fix" link to the sentence, check phone width |
| One-click Publish end to end | HOME-07 | Publishes a real issue | Only when the editor intends to publish: click Publish → confirm → issue goes live, footer shows "Published <date>" |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
