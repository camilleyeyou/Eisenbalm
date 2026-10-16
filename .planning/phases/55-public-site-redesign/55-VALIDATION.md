---
phase: 55
slug: public-site-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-10-16
---

# Phase 55 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `55-RESEARCH.md` § Validation Architecture. Requirement IDs PUB-01..16 are proposed by research (ROADMAP lists Requirements: TBD).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^3.2 (node env; `*.test.tsx` → jsdom), @testing-library/react; pytest for pipeline |
| **Config file** | `apps/web/vitest.config.ts` |
| **Quick run command** | `pnpm --filter web test -- <file>` + `pnpm --filter web typecheck` |
| **Full suite command** | `pnpm --filter web test` (baseline 443 pass / 13 todo) |
| **Estimated runtime** | ~6 seconds (suite), ~6 seconds (typecheck) |

---

## Sampling Rate

- **After every task commit:** Run targeted `pnpm --filter web test -- <file>` + `pnpm --filter web typecheck`
- **After every plan wave:** Run `pnpm --filter web test` (full) + typecheck
- **Before `/gsd:verify-work`:** Full suite green + strict `pnpm --filter web build` on a networked machine (vitest does not type-check)
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

Filled in by the planner per task. Requirement → test mapping:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| PUB-01 | Manrope via next/font; palette in `dispatch.css`; `lib/theme.ts` exports unchanged | source-scan | `pnpm --filter web test -- brand-tokens` | ❌ W0 | ⬜ pending |
| PUB-02 | `accentForIssue` cycles; `inkFor` ≥ 4.5:1; palette passes `validateHex` | unit | `pnpm --filter web test -- brand-accent` | ❌ W0 | ⬜ pending |
| PUB-03 | `/` renders front page (no redirect), canonical → issue | source-scan | `pnpm --filter web test -- home-page` | ❌ W0 | ⬜ pending |
| PUB-04/05 | 8 section ids once, in order; single `<main>`; nav anchors resolve | source-scan + jsdom | `pnpm --filter web test -- issue-front-page` | ❌ W0 | ⬜ pending |
| PUB-06 | Deliberation cards from data; bar hidden when confidence undefined; no transcript | unit + source-scan | `pnpm --filter web test -- delib-cards` | ❌ W0 | ⬜ pending |
| PUB-07 | Game iframe `sandbox="allow-scripts"` only + validator | source-scan | `pnpm --filter web test -- game-sandbox` | ✅ | ⬜ pending |
| PUB-08 | FundButton → checkout; all "Fund them" → `#buy`/FundButton | jsdom + source-scan | `pnpm --filter web test -- fund-button` | ❌ W0 | ⬜ pending |
| PUB-09 | `balmsFromCents`; counter hides on undefined, shows 0 | unit + jsdom | `pnpm --filter web test -- balm-count` | ❌ W0 | ⬜ pending |
| PUB-10 | Subscribe route validation/honeypot/secret; form a11y | route unit + jsdom | `pnpm --filter web test -- newsletter` | ❌ W0 | ⬜ pending |
| PUB-11 | `derive.ts` derivations; GROQ published/preview parity | unit + source-scan | `pnpm --filter web test -- dispatch-derive groq-parity` | ❌ W0 | ⬜ pending |
| PUB-12 | Back-issues filter by name/cause/number; empty state | unit + jsdom | `pnpm --filter web test -- back-issues-search` | ❌ W0 | ⬜ pending |
| PUB-13 | No fixed widths ≥312px; overflow-wrap; padding clamp | source-scan | `pnpm --filter web test -- dispatch-css-responsive` | ❌ W0 | ⬜ pending |
| PUB-14 | 44px targets; reduced-motion; focus ring; AA pairs table | source-scan + unit | `pnpm --filter web test -- dispatch-a11y` | ❌ W0 | ⬜ pending |
| PUB-15 | Phase 19 files retired, no importers | source-scan | `pnpm --filter web test -- phase19-retired` | ❌ W0 | ⬜ pending |
| PUB-16 | Mockup placeholder copy denylist absent; "Thursday" present | source-scan | `pnpm --filter web test -- dispatch-voice` | ❌ W0 | ⬜ pending |
| contract | Pipeline writes `editorConfidence` (None → omitted) | pytest | `cd packages/pipeline && pytest tests -k sanity_client` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/web/__tests__/brand-accent.test.ts`, `brand-tokens.test.ts` — PUB-01/02
- [ ] `apps/web/__tests__/fixtures/issue.ts` (full, sparse, long-word, 1-candidate) + `dispatch-derive.test.ts` — PUB-06/11/12
- [ ] `apps/web/__tests__/groq-parity.test.ts`
- [ ] `apps/web/__tests__/fund-button.test.tsx`, `newsletter-form.test.tsx`, `newsletter-route.test.ts`
- [ ] Disposition of ~15 Phase 19 source-scan tests (rewrite vs delete) — final wave
- Framework install: none needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Desktop + 375px layout matches mockup, no horizontal scroll | PUB-13 | No Playwright installed | Open `/` and `/issue/<slug>` at 1440px and 375px; compare with `MOCKUP-Main.dc.html` |
| Keyboard + axe pass | PUB-14 | axe not installed | Tab through page; run axe DevTools; zero serious violations |
| Live balms count matches Convex | PUB-09 | Needs deployed Convex | `npx convex run stripeOrders:balmsForCharity` vs rendered count |
| Copy reads in Jesse's voice | PUB-16 | Editorial judgement | Read-through of one live issue |
| Strict build | all | Prerender needs Sanity network | `pnpm --filter web build` on networked machine |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
