---
phase: 51
slug: section-read-and-fix-in-place
status: automated-gates-passed / human-demo-path-pending
nyquist_compliant: true
wave_0_complete: true
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
| READ-01 | `/s/[section]` renders one section as prose — no rails, tabs, or form fields | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "renders"` | ✅ | ✅ green (8 passed) |
| READ-02 | Fact/Voice/Source text tag renders adjacent to every marked span, readable without opening the popover | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/AnnotationMark.test.tsx` | ✅ extend | ✅ green (25 passed) |
| READ-03 | Popover shows agent reasoning + `ClaimProvenanceCard` evidence as valid phrasing content | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/ClaimProvenanceCard.test.tsx __tests__/ClaimMark.test.tsx` | ✅ extend | ✅ green (43 passed) |
| READ-04 | Group-accept applies to all sibling findings sharing axis+fix; partial-failure copy | component (jsdom) / pure-fn | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "group accept"` | ✅ | ✅ green (4 passed) |
| READ-05 | In-place edit Save/Cancel patches the block (incl. `patchBonus` branch for specAd); 409 recovery copy | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "in-place edit"` | ✅ | ✅ green (5 passed) |
| READ-06 | Dismiss requires a reason — existing annotation flow reused verbatim | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/AnnotationMark.test.tsx -t "dismiss"` | ✅ existing | ✅ green (1 passed) |
| READ-07 | Prev/next section nav; first/last omit the missing side | pure-fn + component | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "nav"` | ✅ | ✅ green (4 passed) |
| READ-08 | "N of 9 sections still need you" derived from `deriveSectionStates`, never from `useReviewedSections` | pure-fn unit | `pnpm --filter dispatch-control vitest run __tests__/derivedState.test.ts` | ✅ extend | ✅ green (79 passed) |
| Pitfall 2 | Voice Pass on-demand rewrite survives D-08's neutral labels (label-independent `generateFixOnAccept`) | component regression | `pnpm --filter dispatch-control vitest run __tests__/AnnotationMark.test.tsx -t "rewrite"` | ✅ W0 case | ✅ green (3 passed) |
| Pitfall 3 | `useInspector()` does not throw on `/s/[section]` (provider mounted in the new route group) | component (jsdom) | `pnpm --filter dispatch-control vitest run __tests__/SectionReaderPage.test.tsx -t "inspect"` | ✅ | ✅ green (1 passed) |
| D-17 | `EDITABLE_SECTIONS` promoted + re-exported; Review Desk importers unaffected | existing regression | `pnpm --filter dispatch-control vitest run __tests__/SectionChipList.test.tsx __tests__/derivedState.test.ts __tests__/runSections.test.ts __tests__/WorkspaceOutline.test.tsx` | ✅ gate | ✅ green (110 passed) |
| D-25 | `useReviewedSections` deleted; `StoryDeskGrid`/`StoryFocusView` compile and render on derived state | **strict build** | `pnpm --filter dispatch-control build` | N/A | ✅ green (exit 0) |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*All rows independently re-run and confirmed by 51-06 (integration gate), 2026-08-01 — see 51-06-SUMMARY.md for the full command transcript. Full suite: 148 files / 1245 tests passed, 0 failed. `pnpm --filter dispatch-control build` exit 0.*

---

## Wave 0 Requirements

- [x] `__tests__/SectionReaderPage.test.tsx` — new file covering READ-01, READ-04, READ-05, READ-07, Pitfall 3. Copy the mock scaffold **verbatim** from `__tests__/Galley.test.tsx` (`vi.mock('convex/react')`, `vi.mock('@clerk/nextjs')`, `vi.mock('@convex/_generated/api')`) plus its draft fixture; add mocks for `useCurrentRun`, `getDraft`/`patchSection`/`patchBonus`, `acceptFinding`. — the `existsSync` guard now resolves live (18/18 tests, 0 skipped); confirmed by 51-06.
- [x] Extend `__tests__/AnnotationMark.test.tsx` — Fact/Voice/Source tag cases (READ-02) and a `generateFixOnAccept` regression case (Pitfall 2: a test that does not exist today and would not fail today, but must exist to prove the fix is safe). — 25/25 green, confirmed by 51-06.
- [x] Extend `__tests__/ClaimMark.test.tsx` / `__tests__/ClaimProvenanceCard.test.tsx` — phrasing-safe-mode structural assertion (Pitfall 1). jsdom will NOT flag invalid nesting; use an explicit structural proxy, e.g. `expect(container.querySelector('.galley-popover div')).toBeNull()`. — 9/9 + 34/34 green, confirmed by 51-06.
- [x] No framework install needed — Vitest + Testing Library + jsdom already configured and exercised by six existing galley test files. — confirmed: `git diff --name-only origin/master -- apps/dispatch-control/package.json pnpm-lock.yaml package-lock.json` empty.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions | Status |
|----------|-------------|------------|-------------------|--------|
| ~760px reading measure, Lora 16.5px/1.7, no side rails — "a page to read, not a workspace" | READ-01 (SC-1) | Visual/typographic judgement; jsdom has no layout engine | Run dev server, open `/s/origin-story`, confirm measure ≈760px, body is Lora, no rail/tab/form chrome present | ⬜ **NOT PERFORMED — blocked** |
| Label-not-colour-alone distinguishability | READ-02 (SC-2) | Perceptual check | Open a section with fact + voice + source findings; confirm each span carries a readable text label independent of its colour; verify in greyscale | ⬜ **NOT PERFORMED — blocked** |
| DOM validity of the popover (no block-in-phrasing) | READ-03 (Pitfall 1) | jsdom does not validate content models; browsers silently reparent | Open a claim popover in Chrome DevTools, confirm no `<p>` auto-close/reparent in the rendered tree; the Vitest structural assertion is only a proxy | ⬜ **NOT PERFORMED — blocked** |

**Blocked 2026-08-01:** the production pipeline's `DASHBOARD_ALLOWED_ORIGINS` CORS allowlist has no `localhost` entry (verified live: an OPTIONS preflight against `https://eisenbalm-pipeline-production.up.railway.app` returns no `Access-Control-Allow-Origin` header for `http://localhost:3000` or `http://localhost:3001`), and `apps/dispatch-control`'s dev server runs on port 3001 while `.env.local` points `NEXT_PUBLIC_PIPELINE_URL` at that same production Railway host. Every `/issues/{runId}/draft` fetch fails from a local browser, so no draft prose renders and none of the three rows above (nor the 8-item checkpoint in `51-06-PLAN.md`) could be exercised. User was offered two unblock routes and elected to close the plan without running them — see `51-06-SUMMARY.md` for full detail and the recorded decision. Full detail and open follow-ups also in `51-06-SUMMARY.md`.

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or a Wave 0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all ❌ MISSING references above
- [x] No watch-mode flags in any command
- [x] Feedback latency < 90s (full suite 48.95s, build ~2min)
- [x] `pnpm --filter dispatch-control build` green (mandatory — catches the D-25/Pitfall 4 class) — exit 0, confirmed by 51-06
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** automated gates passed 2026-08-01 (51-06 integration gate). Human demo-path checkpoint (Task 2 of 51-06-PLAN.md) **NOT performed** — blocked by a pre-existing local-dev CORS gap (see Manual-Only Verifications above), and the user elected to close the plan without running it after being offered both unblock routes. This is NOT a full sign-off; see `51-06-SUMMARY.md` for the complete record.
