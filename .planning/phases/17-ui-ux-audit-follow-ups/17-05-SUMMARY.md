---
phase: 17-ui-ux-audit-follow-ups
plan: "05"
subsystem: web
tags: [about-page, copy, jesse-voice, placeholder-removal, editorial]
dependency_graph:
  requires: [17-01]
  provides: [about-page-copy-complete]
  affects: [apps/web/app/about/page.tsx]
tech_stack:
  added: []
  patterns: [jesse-voice-interim-copy, TODO-Andrew-marker]
key_files:
  created: []
  modified:
    - apps/web/app/about/page.tsx
decisions:
  - "Interim Jesse-voice copy ships with TODO(Andrew) marker; Andrew's voice approval is a non-blocking manual gate — plan is code-complete without it"
  - "Three paragraphs cover: what the Dispatch is, the editorial posture (Fortune 500 gravity, no sentiment), and the Thursday cadence"
  - "Task 2 (checkpoint:human-verify) auto-approved under auto_advance=true; TODO(Andrew) marker remains until Andrew acts"
metrics:
  duration: 1 min
  completed: "2026-06-02"
  tasks_completed: 2
  files_changed: 1
---

# Phase 17 Plan 05: About Copy Summary

Jesse-voice interim copy replaces the "This page is being written" placeholder on `/about`; `about-page.test.ts` turns GREEN; Andrew's final voice approval remains an open non-blocking editorial gate flagged by the `TODO(Andrew)` marker.

## What Was Built

The `/about` page (`apps/web/app/about/page.tsx`) now renders three Jesse-voice paragraphs inside the existing `<article>` structural shell:

1. **What the Dispatch is** — a weekly editorial that selects one overlooked charity, produces an eight-section examination, and donates 100% of lip balm proceeds to that organization.
2. **The editorial posture** — every featured organization is treated with Fortune 500 gravity; the central question is why it deserves to exist, answered without sentiment.
3. **The cadence** — a new issue ships every Thursday after editorial review; the shop carries one product; proceeds go entirely to the charity on the cover.

A `TODO(Andrew)` JSX comment immediately precedes the prose paragraphs, providing a greppable target for Andrew's final wording once he reviews the live page. The metadata export, `<article>` wrapper, `<h1>` element, and all `var(--color-*)` typography classes are preserved verbatim.

## Tasks

| # | Name | Status | Commit |
|---|------|--------|--------|
| 1 | Replace placeholder with Jesse-voice interim copy + TODO(Andrew) marker | Done | 14ab376 |
| 2 | Andrew approves /about voice (non-blocking manual gate) | Auto-approved (open gate) | — |

## Acceptance Criteria — All Green

- `grep -c "This page is being written" apps/web/app/about/page.tsx` → 0
- `grep -q "<article"` → exits 0
- `grep -q "TODO(Andrew)"` → exits 0
- `grep -c '#[0-9a-fA-F]{6}'` → 0 (no hardcoded hex)
- `pnpm --filter web test:unit -- --run about-page` → 2/2 passed
- Full suite `pnpm --filter web test:unit` → 259/259 passed

## Open Gate (Non-Blocking)

**Andrew's voice approval** — Task 2 is a `checkpoint:human-verify` with `gate="non-blocking"`. Code is complete. Andrew needs to:

1. Run `pnpm --filter web dev` and open http://localhost:3000/about (or review deployed preview).
2. Read the three paragraphs. Confirm Jesse voice: dry, precise, no irony, no exclamation.
3. If approved as-is: delete the `TODO(Andrew)` JSX comment in `apps/web/app/about/page.tsx`.
4. If different wording wanted: replace paragraph text (same `<p>` classes), then remove the `TODO(Andrew)` comment.
5. Re-run `pnpm --filter web test:unit -- --run about-page` to confirm it stays green.

The `TODO(Andrew)` marker is greppable: `grep -rn "TODO(Andrew)" apps/web/app/about/page.tsx`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `TODO(Andrew)` interim copy in `apps/web/app/about/page.tsx` — intentional; flags the prose for Andrew's final voice approval. Does not prevent the plan's goal (placeholder removed, page presentable, test green). The TODO(Andrew) comment is the tracking mechanism.

## Self-Check: PASSED

- `apps/web/app/about/page.tsx` modified: confirmed
- Commit 14ab376 exists: confirmed
- 259 tests passing: confirmed
