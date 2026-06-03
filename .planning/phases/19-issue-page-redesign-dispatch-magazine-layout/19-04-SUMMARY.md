# Plan 19-04 — Stage A Visual Approval Checkpoint — SUMMARY

**Status:** Complete (approved)
**Tasks:** 2/2
**Type:** checkpoint:human-verify (HARD delivery gate — success criterion 5)

## What happened

Stage A static shell (Plans 19-02 + 19-03, MOCK data) was verified against
`19-PROTOTYPE.html` and the automated Stage A gates were run:

- `pnpm --filter web test:unit` → **279 passed** / 14 todo, 32 files
- `pnpm --filter web build` → clean, 39/39 static pages
- `pnpm --filter web typecheck` → no new errors (7 pre-existing errors in
  `checkout-create-session.test.ts`, `stripe-webhook-idempotency.test.ts`,
  `lib/theme.test.ts` — last touched Phases 8 & 12, untouched by Phase 19)

## Human verification result

User reviewed the rendered `/issue/issue-999` MOCK page and **approved** the
visual match. One issue was reported and fixed before approval:

- **SiteHeader scroll-state regression:** the sitewide fixed nav kept a leftover
  dark glass background (`rgba(12,11,10,0.82)`) from the old dark theme. Under the
  new oxblood/cream palette the dark-ink wordmark + nav links became invisible on
  scroll (only the oxblood "Buy Lip Balm" CTA showed). Fixed in commit `4956259`
  by swapping to a theme-aware cream glass
  `color-mix(in srgb, var(--color-bg) 90%, transparent)` + `blur(10px)`, matching
  the prototype nav (`rgba(251,250,246,.9)`). Tracks per-issue `--color-bg`
  overrides for Stage B. Tests/typecheck/build re-verified green.

## Gate outcome

Stage B (Plan 19-05 — live Sanity GROQ + Convex wiring + per-issue theme
re-enable) is **unlocked** to proceed.

## Self-Check: PASSED
