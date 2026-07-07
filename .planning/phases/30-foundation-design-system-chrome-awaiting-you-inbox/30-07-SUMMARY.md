---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 07
subsystem: ui
tags: [nextjs, dispatch-control, tailwind-v4, content]

# Dependency graph
requires:
  - phase: 30-02
    provides: how-to-use route stub (`(dashboard)/how-to-use/page.tsx`) created so the nav coverage gate passed
provides:
  - Full How-to-use screen content — 5 weekly-loop steps + 4-entry color legend + 4 house rules, verbatim from the 1c binding spec
  - how-to-use.test.ts source-scan lock on all 19 content/style assertions
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Source-scan (node:fs) content tests for static reference screens — same pattern as design-tokens.test.ts / screen-token-swap.test.ts, no rendering needed for a Server Component with no client logic"

key-files:
  created:
    - apps/dispatch-control/__tests__/how-to-use.test.ts
  modified:
    - "apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx"

key-decisions:
  - "House-rule dark bands use --color-ink background with --color-masthead-text (headline) / --color-masthead-muted (body) — the same dark-surface token pair the masthead already uses — rather than introducing a new token, since the spec's #17140e bg / near-white text pairing is already covered"
  - "Color-legend swatches render via inline style={{ background: token }} referencing the CSS variable (e.g. var(--color-green)) rather than a Tailwind arbitrary-value class, since the swatch color must exactly match the corresponding legend hex and this keeps the pairing visually self-evident in source"

requirements-completed: [CHR-03]

# Metrics
duration: ~15min
completed: 2026-07-07
---

# Phase 30 Plan 07: How-to-use Screen Summary

**Replaced the Plan 30-02 stub with the full 1c-styled How-to-use screen — 5 weekly-loop steps, a 4-entry color legend, and 4 house rules, copied verbatim from `Dispatch Control.dc.html`'s `disp_howto` block — locked by a 19-assertion source-scan test.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-07-07
- **Tasks:** 1
- **Files modified:** 2 (1 created, 1 modified)

## Accomplishments

- `how-to-use/page.tsx` rewritten as a Server Component rendering three sections: "The weekly loop" (5 numbered steps — Steer discovery/Signal Desk, Watch the run/Run Monitor, Clear the facts/Review Desk, De-slop it/Voice Pass, Improve the machine/Prompt Lab + Eval Center), "What the colors mean" (green/vermilion/marigold/cobalt swatches + meanings), and "Four house rules" (verbatim headlines on dark ink bands)
- Copy pulled directly from `docs/design/dispatch-control-v2/Dispatch Control.dc.html` lines 565-618 (`disp_howto`) rather than paraphrased, preserving the exact wording (including bolded inline callouts like "Awaiting you", "Accept fix", "Sounds human")
- Styled entirely with 1c tokens — Newsreader (`--font-display`) for headings, Lora (`--font-body`) for prose, Space Grotesk (`--font-ui`) for the eyebrow tagline — no literal Tailwind gray-scale/white/black classes
- `__tests__/how-to-use.test.ts` added: 19 source-scan assertions covering all 5 step phrases + 5 screen names, all 4 hex+meaning legend pairs, all 4 house-rule headlines verbatim, and the no-literal-neutral/white/black + token-presence style gates

## Task Commits

1. **Task 1: How-to-use full content page + source-scan test** - `b711205` (feat)

## Files Created/Modified

- `apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx` - full weekly-loop/color-legend/house-rules content, 1c-styled
- `apps/dispatch-control/__tests__/how-to-use.test.ts` - 19-assertion source-scan test

## Decisions Made

- Reused the existing `--color-masthead-text` / `--color-masthead-muted` token pair (already used by `Masthead.tsx` for its dark ink surface) for the house-rule bands instead of introducing a new dark-surface text token, since the spec's near-white-on-ink pairing there is functionally identical
- Rendered color-legend swatches via `style={{ background: 'var(--color-*)' }}` so each swatch is guaranteed to match its adjacent hex/meaning text exactly, keeping the CSS-variable indirection visible in source for future maintainers

## Deviations from Plan

None — plan executed exactly as written. Task 1's automated verification (`pnpm --filter dispatch-control test -- --run how-to-use` and `pnpm --filter dispatch-control build`) and all acceptance-criteria greps pass as specified.

## Issues Encountered

- **Parallel-execution stash interference:** mid-task, the shared working tree briefly reverted `how-to-use/page.tsx` back to the Plan 30-02 stub — a `git stash` entry named `temp-stash-other-executor-howtouse` had captured this plan's own in-progress edit (content verified byte-identical via `git stash show -p`). Popped the stash to restore the edit with no content loss, then proceeded. This is a byproduct of multiple GSD executors sharing one git working tree/index (same class of issue noted in `30-04-SUMMARY.md`'s "Issues Encountered"); no destructive operation was performed and no other plan's files were touched.
- Comment text on line 9 of the page (`no literal neutral-*/white/black`) initially tripped the test's own `/neutral-/` regex against itself (a false positive from the comment, not a class usage) — reworded to "gray-scale" to keep the comment's intent without matching the tripwire pattern.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- CHR-03 is fully satisfied; the How-to-use screen is content-complete and ready for Andrew's copy review at UAT.
- No downstream plan depends on this screen's internals (no `affects` entries) — this closes out the last content plan in Phase 30's Wave 3.

---
*Phase: 30-foundation-design-system-chrome-awaiting-you-inbox*
*Completed: 2026-07-07*

## Self-Check: PASSED

- FOUND: apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx
- FOUND: apps/dispatch-control/__tests__/how-to-use.test.ts
- FOUND: commit b711205
