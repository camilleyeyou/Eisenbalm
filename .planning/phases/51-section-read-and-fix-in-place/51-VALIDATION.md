---
phase: 51
slug: section-read-and-fix-in-place
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-31
---

# Phase 51 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `51-RESEARCH.md` § Validation Architecture (all values confirmed against live source).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (+ Testing Library, jsdom) |
| **Config file** | `apps/dispatch-control/vitest.config.ts` — `environment: 'node'` default; `environmentMatchGlobs` sends `*.test.tsx` → `jsdom`, a named list of `.test.ts` → `edge-runtime` |
| **Quick run command** | `pnpm --filter dispatch-control vitest run __tests__/<File>.test.tsx` |
| **Full suite command** | `pnpm --filter dispatch-control test` |
| **Strict type gate (MANDATORY)** | `pnpm --filter dispatch-control build` |
| **Estimated runtime** | ~10s quick · ~90s full suite · ~2–4 min build |

**Critical project rule:** `test`/`test:unit` map to `vitest run` only — **no `tsc` step**. Vitest does not type-check. The missing-required-prop class of break (Pitfall 4 / D-25's `StoryDeskGrid`+`StoryFocusView` fallout) will NOT surface in Vitest. `pnpm --filter dispatch-control build` is a non-negotiable phase gate.

---

## Sampling Rate

- **After every task commit:** the single new/changed test file's quick command
- **After every plan wave:** `pnpm --filter dispatch-control test` (full suite — confirms no Review Desk / Voice Pass regression per D-24)
- **Before `/gsd:verify-work`:** full suite green **AND** `pnpm --filter dispatch-control build` green
- **Max feedback latency:** 90 seconds (full suite); 10 seconds (per-task quick run)

---

## Per-Task Verification Map

| Req | Behavior | Test Type | Automated Command | File Exists | Status |
|-----|----------|-----------|-------------------|-------------|--------|
| READ-01 | `/s/[section]` renders one section as prose — no rails, tabs, or form fields | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "renders"` | ❌ W0 | ⬜ pending |
| READ-02 | Fact/Voice/Source text tag renders adjacent to every marked span, readable without opening the popover | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/AnnotationMark.test.tsx` | ✅ extend | ⬜ pending |
| READ-03 | Popover shows agent reasoning + `ClaimProvenanceCard` evidence as valid phrasing content | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/ClaimProvenanceCard.test.tsx __tests__/ClaimMark.test.tsx` | ✅ extend | ⬜ pending |
| READ-04 | Group-accept applies to all sibling findings sharing axis+fix; partial-failure copy | component (jsdom) / pure-fn | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "group accept"` | ❌ W0 | ⬜ pending |
| READ-05 | In-place edit Save/Cancel patches the block (incl. `patchBonus` branch for specAd); 409 recovery copy | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "in-place edit"` | ❌ W0 | ⬜ pending |
| READ-06 | Dismiss requires a reason — existing annotation flow reused verbatim | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/AnnotationMark.test.tsx -t "dismiss"` | ✅ existing | ⬜ pending |
| READ-07 | Prev/next section nav; first/last omit the missing side | pure-fn + component | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "nav"` | ❌ W0 | ⬜ pending |
| READ-08 | "N of 9 sections still need you" derived from `deriveSectionStates`, never from `useReviewedSections` | pure-fn unit | `pnpm --filter dispatch-control vitest run __tests__/derivedState.test.ts` | ✅ extend | ⬜ pending |
| Pitfall 2 | Voice Pass on-demand rewrite survives D-08's neutral labels (label-independent `generateFixOnAccept`) | component regression | `pnpm --filter dispatch-control vitest run __tests__/AnnotationMark.test.tsx -t "rewrite"` | ❌ W0 case | ⬜ pending |
| Pitfall 3 | `useInspector()` does not throw on `/s/[section]` (provider mounted in the new route group) | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "inspect"` | ❌ W0 | ⬜ pending |
| D-17 | `EDITABLE_SECTIONS` promoted + re-exported; Review Desk importers unaffected | existing regression | `pnpm --filter dispatch-control vitest run __tests__/SectionChipList.test.tsx __tests__/derivedState.test.ts __tests__/runSections.test.ts __tests__/WorkspaceOutline.test.tsx` | ✅ gate | ⬜ pending |
| D-25 | `useReviewedSections` deleted; `StoryDeskGrid`/`StoryFocusView` compile and render on derived state | **strict build** | `pnpm --filter dispatch-control build` | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `__tests__/SectionReaderPage.test.tsx` — new file covering READ-01, READ-04, READ-05, READ-07, Pitfall 3. Copy the mock scaffold **verbatim** from `__tests__/Galley.test.tsx` (`vi.mock('convex/react')`, `vi.mock('@clerk/nextjs')`, `vi.mock('@convex/_generated/api')`) plus its draft fixture; add mocks for `useCurrentRun`, `getDraft`/`patchSection`/`patchBonus`, `acceptFinding`.
- [ ] Extend `__tests__/AnnotationMark.test.tsx` — Fact/Voice/Source tag cases (READ-02) and a `generateFixOnAccept` regression case (Pitfall 2: a test that does not exist today and would not fail today, but must exist to prove the fix is safe).
- [ ] Extend `__tests__/ClaimMark.test.tsx` / `__tests__/ClaimProvenanceCard.test.tsx` — phrasing-safe-mode structural assertion (Pitfall 1). jsdom will NOT flag invalid nesting; use an explicit structural proxy, e.g. `expect(container.querySelector('.galley-popover div')).toBeNull()`.
- [ ] No framework install needed — Vitest + Testing Library + jsdom already configured and exercised by six existing galley test files.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| ~760px reading measure, Lora 16.5px/1.7, no side rails — "a page to read, not a workspace" | READ-01 (SC-1) | Visual/typographic judgement; jsdom has no layout engine | Run dev server, open `/s/origin-story`, confirm measure ≈760px, body is Lora, no rail/tab/form chrome present |
| Label-not-colour-alone distinguishability | READ-02 (SC-2) | Perceptual check | Open a section with fact + voice + source findings; confirm each span carries a readable text label independent of its colour; verify in greyscale |
| DOM validity of the popover (no block-in-phrasing) | READ-03 (Pitfall 1) | jsdom does not validate content models; browsers silently reparent | Open a claim popover in Chrome DevTools, confirm no `<p>` auto-close/reparent in the rendered tree; the Vitest structural assertion is only a proxy |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ MISSING references above
- [ ] No watch-mode flags in any command
- [ ] Feedback latency < 90s
- [ ] `pnpm --filter dispatch-control build` green (mandatory — catches the D-25/Pitfall 4 class)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
