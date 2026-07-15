---
phase: 41-issue-workspace-frame
plan: 10
type: uat-record
status: automated-gates-passed / human-demo-path-pending
created: 2026-07-15
---

# Phase 41 — Integration Gate: Automated Results + Human UAT Record

This file is the artifact required by Plan 41-10 (`.planning/phases/41-issue-workspace-frame/41-UAT.md`,
per its `must_haves.artifacts`). It records (1) the automated gate results, which an executor agent
CAN run and verify, and (2) the live demo-path walk, which per the plan's own text is a blocking
human checkpoint with "no jsdom-automatable equivalent" — genuinely requiring a human operator
driving the console against dev Convex. Section 2 below is NOT fabricated; it is left as an
explicit pending checklist for a human to complete.

---

## 1. Automated Gates (executor-verified 2026-07-15)

| Gate | Command | Result |
|---|---|---|
| Full test suite | `pnpm --filter dispatch-control test` | **PASS** — 81 files passed / 1 skipped (82), 637 tests passed / 2 todo (639), exit 0 |
| Strict build (the real gate — vitest does not type-check) | `pnpm --filter dispatch-control build` | **PASS** — "Compiled successfully", type-check + lint clean, 11/11 pages generated, exit 0 |
| Convex live-sync | `pnpm --filter @eisenbalm/convex dev:once` | **PASS** — "Convex functions ready!" (7.14s), exit 0 |
| No new type-suppressions | `git diff 87ca41a^..HEAD -- apps/dispatch-control convex \| grep '@ts-ignore\|as any'` | **PASS** — zero matches across the entire Phase 41 diff (41-01 through 41-10) |

### Build route table (confirms all 5 stage routes + redirects are live)

```
ƒ /issues/[issueNumber]                   157 B   (redirect-only, D-03/D-04)
ƒ /issues/[issueNumber]/story              135 B   (Stage 1)
ƒ /issues/[issueNumber]/draft            9.04 kB   (Stage 2)
ƒ /issues/[issueNumber]/fact-check       1.77 kB   (Stage 3)
ƒ /issues/[issueNumber]/voice             2.96 kB   (Stage 4)
ƒ /issues/[issueNumber]/approval          6.96 kB   (Stage 5)
ƒ /issues/[issueNumber]/review             157 B   (legacy redirect -> /draft, D-06)
```

### Convex mutation confirmed present in source + deployed

`convex/issues.ts:232` exports `setLastVisitedStage` (operator-only mutation, added in Plan 41-02).
The `dev:once` sync above pushed the current `convex/` tree (including this function) to
`dev:modest-magpie-797` and reported "Convex functions ready!" with no errors — the mutation
resolves in dev, so the frame's best-effort last-visited-stage writer (Plan 41-06) will not 404.

**Automated gates verdict: ALL GREEN.** No fixes were required — nothing to fix forward.

---

## 2. Human Demo-Path UAT — PENDING

**This section requires a human operator.** It cannot be completed by an executor agent: it involves
walking the live console (`pnpm --filter dispatch-control dev`) against dev Convex through multiple
stage navigations while observing live reactivity (tab marks, header status, publish lock) — there
is no jsdom-automatable equivalent, per the plan's own `<action>` text for Task 2.

**Setup:** `pnpm --filter dispatch-control dev`, open an in-progress issue at `/issues/[n]`.

| # | Criterion (WSP ref) | Result |
|---|---|---|
| 1 | Sidebar shows ONE "Issue Workspace" item; no Review Desk / Signal Desk / Voice Pass items (WSP-01) | ⬜ PENDING |
| 2 | `/issues/[n]` lands in the frame at the last-visited stage; 5 tabs each show a live status mark (icon + label, not color alone); switching tabs does not full-reload the frame (WSP-01) | ⬜ PENDING |
| 3 | Outline lists every section with its state; a not-generated section shows "not generated" (never blank); clicking a section jumps to it (WSP-02); context panel hides/shows (WSP-03) | ⬜ PENDING |
| 4 | Stage 2 Draft: checked claims are marigold-underlined and reveal source on hover AND Tab keyboard focus; unchecked claims are rust-tinted and clicking one lands on the Fact Check tab (WSP-04) | ⬜ PENDING |
| 5 | Stage 4: approve the Voice Pass ("Sounds human"). Stage 5: blockers appear first, then the readiness board, then "Agent editor's recommendation" (labeled as agent judgment) (WSP-05) | ⬜ PENDING |
| 6 | Publish disabled with the unlock condition shown until Must fix=0 ∧ Fact Check complete ∧ Voice approved current ∧ not held; once eligible, Publish shows the exact preview (destination, title, time, consequences) and one confirm click publishes — no typed confirmation (WSP-06) | ⬜ PENDING |
| 7 | A not-generated section (e.g. the Editor's note) reads as a first-class state, never a blank (WSP-07) | ⬜ PENDING |
| — | Header status, task counts, tab marks, and publish lock update live (no manual refresh) | ⬜ PENDING |

**Instructions for the human verifier:** For each row, replace ⬜ PENDING with ✅ PASS or ❌ FAIL
(with a one-line note on what failed), then record an overall verdict below and commit this file's
update. If any criterion fails, list it precisely so a follow-up plan/fix can be scoped — do not mark
the phase done until this table is complete and green (or failures are explicitly triaged).

**Overall demo-path verdict:** PENDING HUMAN VERIFICATION — not yet walked.

---

## Gate Status Summary

- Automated (suite + strict build + Convex live-sync + no-suppressions): **PASS**
- Human live demo-path (7 WSP criteria + live-reactivity check): **PENDING** — requires a human
  operator to run `pnpm --filter dispatch-control dev` against dev Convex and complete Section 2.
