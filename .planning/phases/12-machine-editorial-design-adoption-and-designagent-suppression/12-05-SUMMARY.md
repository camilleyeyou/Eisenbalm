---
phase: 12
plan: 05
subsystem: web/deliberation
tags: [MED-05, deliberation-slot, carousel-flow, machine-editorial, convex, reduced-motion]
requirements: [MED-05]

dependency_graph:
  requires: [12-01, 12-04]
  provides: [deliberation-carousel-flow]
  affects: [apps/web/components/issue/DeliberationSlot.tsx]

tech_stack:
  added: []
  patterns:
    - Three-zone vertical stack (pitch-log carousel / flow-line / QA) replacing two-column grid
    - .del-flow / .del-confidence-bar-* CSS classes from globals.css Phase 12 block
    - Winner luminous gold glow via color-mix() box-shadow (static, no animation)
    - Confidence meter below flow line using del-confidence-bar-track/fill classes

key_files:
  modified:
    - apps/web/components/issue/DeliberationSlot.tsx

decisions:
  - "eventOneLiner function output for scout/advocate/editor events now feeds sr-only timeline list; the visible event timeline shows only non-deliberation-phase events (section-draft, qa-correction, editor-final, publisher-deploy) to keep the flow line as the primary deliberation summary"
  - "Kept editorRationale rendering below the confidence meter rather than in the flow-line node — avoids layout overflow on long rationale strings and keeps the flow-line diagram compact"

metrics:
  duration: 5
  completed_date: 2026-05-22
  tasks: 1
  files: 1
---

# Phase 12 Plan 05: DeliberationSlot Carousel & Flow (MED-05) Summary

Three-zone vertical stack layout replacing two-column grid with winner glow, Scout→Advocate→Editor flow line, and tape-reel confidence meter — all 5 Convex subscriptions byte-compatible.

## What Was Built

Rebuilt `DeliberationSlot.tsx` from a two-column `lg:grid-cols-[1fr_1fr]` layout into the Machine Editorial Carousel & Flow variant (MED-05). The rebuild is purely visual — the data layer is untouched.

**Zone 1 — Horizontal Pitch Log Carousel**

Cards now use `borderRadius: '4px'`, `padding: '24px'`, and the full Carousel & Flow visual treatment:
- Winner card: `boxShadow: '0 0 32px color-mix(...28%...), 0 0 0 1px color-mix(...18%...)'` luminous gold glow (static)
- Charity name: `font-display 15px font-semibold` (was `text-[17px] font-medium`)
- Scout summary: `font-body 15px italic` (was `text-[14px]`)
- Location, badges, advocate score bar: byte-compatible with Phase 11

**Zone 2 — Scout → Advocate → Editor Flow Line + Confidence Meter**

New `<div className="del-flow" aria-hidden="true">` containing three `.del-flow-node` rows with `.del-flow-connector` separators, using:
- Scout circle: `var(--color-scout)`, label: `--color-scout`
- Advocate circle: `var(--color-advocate)`, label: `--color-advocate`
- Editor circle: `var(--color-primary)`, label: `--color-primary`, action: `{editorWinner} selected` (Lora italic inline)
- A `<div className="sr-only">` timeline list provides the same information to screen readers

Confidence meter moved below flow line. Uses `.del-confidence-bar-track` / `.del-confidence-bar-fill` classes from globals.css. Value: `clamp(32px, 3.5vw, 48px)` Cormorant Garamond, weight 600. `ref={confidenceSectionRef}` preserved on the meter wrapper.

**Zone 3 — QA Findings**

Unchanged in logic. Heading uses `tracking-[0.18em]` (machine-readout treatment). Severity pills, correction reason, section name: byte-compatible.

## Data Layer Preserved (Byte-Compatible)

All 5 Convex `useQuery` subscriptions with `runId ? { runId } : 'skip'` sentinel:
- `api.pipelineRuns.byRunId`
- `api.pitchLog.byRunId`
- `api.deliberationEvents.byRunId`
- `api.agentVotes.byRunId`
- `api.qaCorrections.byRunId`

`AGENT_LABELS` map, `getAgentLabel`, `QA_SEVERITY`, `agentChipStyle`, `prefersReducedMotion` module-scope declaration — all preserved.

`confidenceSectionRef` + `displayValue` + `animatedRef` + `IntersectionObserver` + `rAF tick()` count-up `useEffect` — byte-compatible. Includes:
- `if (prefersReducedMotion) { setDisplayValue(target); return }` — instant final value under reduced-motion
- `observer.disconnect()` after first fire (Pitfall 3)
- `[editorConfidence]` deps array

## Security Contracts

- `// SECURITY: never read run.cost (it contains the model-version map).` comment preserved at line 34
- `run.cost` and `modelVersions` not accessed anywhere in code (comment-stripped)
- No model-name literals (`claude`, `gpt`, `sonnet`, `haiku`, `openrouter`, `anthropic`) in code
- No hardcoded 6-digit hex literals in JSX/style props — only `var(--color-*)` tokens

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Carousel & Flow rebuild of DeliberationSlot (MED-05) | 51e6942 | apps/web/components/issue/DeliberationSlot.tsx |

## Verification

- `pnpm --filter web test:unit -- machine-editorial-components deliberation`: all 5 machine-editorial-components tests + 9 deliberation-subscriptions + 3 deliberation-no-model-names + 6 deliberation-agent-cards + 12 deliberation-qa-severity tests green
- Pre-existing Stripe Wave 0 sentinel failures (29 tests, CMR-03..CMR-08): unchanged, out-of-scope per SCOPE BOUNDARY
- `pnpm --filter web build`: exits 0, all routes generated
- `git diff` confirms only JSX/layout changed — data layer byte-compatible

## Deviations from Plan

None. Plan executed exactly as written.

The one nuance: the visible event timeline in Zone 2 shows only non-deliberation-phase events (section-draft, qa-correction, editor-final, publisher-deploy) since the flow-line diagram already represents scout-finding, advocate-argument, and editor-decision events visually. A `sr-only` list provides the full timeline for screen readers. This is within the planner's stated discretion ("planner discretion, but keep eventOneLiner usage somewhere or drop the standalone timeline if Zone 2 covers it").

## Known Stubs

None. All data bindings are live Convex subscriptions. The confidence meter renders only when `editorConfidence !== null`.

## Self-Check: PASSED

- `apps/web/components/issue/DeliberationSlot.tsx`: FOUND (720 lines, min_lines 400 satisfied)
- Contains `del-flow`: confirmed (16 occurrences)
- Commit 51e6942: confirmed in git log
- `pnpm --filter web build`: exits 0
- All 5 Convex subscription identifiers confirmed via grep
