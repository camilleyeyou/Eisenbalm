---
phase: 14
plan: "03"
subsystem: frontend-ui
tags: [accessibility, wcag-aa, deliberation, light-theme, color-tokens]
dependency_graph:
  requires: ["14-01", "14-02"]
  provides: ["LIGHT-04", "LIGHT-07"]
  affects: ["apps/web/components/issue/DeliberationSlot.tsx"]
tech_stack:
  added: []
  patterns: ["AA-safe text token swap", "raw-brand-color → -text-variant"]
key_files:
  modified:
    - apps/web/components/issue/DeliberationSlot.tsx
decisions:
  - "Editor .del-flow-label uses --color-primary-text (gold) not --color-accent-text (rust): the editor node renders gold everywhere (chip, speaker label, flow-label) — switching it to rust would break agent identity consistency. UI-SPEC line 156 listed editor flow-label under --color-accent-text; line 157 listed it under --color-primary-text. Flag 2 adjudicated as gold-correct by the checker. SUMMARY records this resolution."
  - "Residual selected-badge text ('★ Selected this week', 11px, var(--color-primary)) was NOT changed: it renders on a 14% gold wash background, not pure #FAFAF8, so its effective ratio differs from the 2.24:1 on-paper calculation. It was not in the plan's blocker list. Flagged for UAT confirmation — if UAT confirms failure, a follow-up plan is required."
metrics:
  duration_seconds: 140
  completed_date: "2026-05-25"
  tasks_completed: 1
  files_changed: 1
---

# Phase 14 Plan 03: Deliberation Component Reconcile Summary

Six targeted inline-style token swaps in `apps/web/components/issue/DeliberationSlot.tsx`. No layout, logic, subscription, or motion changes. Turns the Plan 01 DeliberationSlot source-scan tripwire (BLOCKER 3) green.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Swap raw gold/rust for AA-safe -text variants | 955b8fc | apps/web/components/issue/DeliberationSlot.tsx |

## What Was Built

Six spots in `DeliberationSlot.tsx` that hardcoded raw brand gold (`var(--color-primary)`, #CDA434, 2.24:1 on light) or raw brand rust (`var(--color-accent)`, #C2502A, 4.49:1 on light) as 11px normal-size text color were swapped to the AA-safe `-text` variants defined in globals.css by Plan 02:

| Location | Old token | New token | Ratio |
|----------|-----------|-----------|-------|
| `QA_SEVERITY.warning.color` | `var(--color-primary)` | `var(--color-primary-text)` | 5.97:1 |
| `QA_SEVERITY.error.color` | `var(--color-accent)` | `var(--color-accent-text)` | 7.11:1 |
| `agentChipStyle()` editor branch `color` | `var(--color-primary)` | `var(--color-primary-text)` | 5.97:1 |
| `● live` indicator span (11px) | `var(--color-primary)` | `var(--color-primary-text)` | 5.97:1 |
| `{scoreValue}/10` advocate-score numeral (11px) | `var(--color-primary)` | `var(--color-primary-text)` | 5.97:1 |
| Editor `.del-flow-label` span (11px) | `var(--color-primary)` | `var(--color-primary-text)` | 5.97:1 |

**Decorative fills preserved unchanged** (these are not text — no AA text requirement):
- Editor `del-flow-circle` dot: `backgroundColor: var(--color-primary)` (10px dot)
- Advocate-score progress bar fill: `backgroundColor: var(--color-primary)` (decorative fill)
- Pitch-card selected-badge border/glow: `var(--color-primary)` (border + box-shadow, not text)
- EDITOR CONFIDENCE % numeral: `var(--color-primary)` (`clamp(32px, 3.5vw, 48px)` — AA-large context)
- Editor chip `backgroundColor`: `color-mix(in srgb, var(--color-primary) 14%, transparent)` (background wash, not text)

**Preserved byte-compatible:**
- 5 Convex `useQuery(api.*)` subscriptions (count verified: 5)
- `AGENT_LABELS` map (DEL-04 — no model names)
- Scout chip: `var(--color-scout)` (#3D6B2E, 6.01:1 on light — already AA)
- Advocate chip: `var(--color-advocate)` (#1B4F8A, 7.94:1 on light — already AA)
- Confidence meter `IntersectionObserver` + rAF count-up
- Phase 13 `.del-conversation` chat-thread render (structure unchanged; only `chip.color` value changes for editor turns)
- `prefers-reduced-motion` guard
- `≥44px` touch targets

## Deviations from Plan

None — plan executed exactly as written (six targeted token swaps, all acceptance criteria met).

## Key Resolutions

### Flag 2: Editor `.del-flow-label` token — GOLD confirmed correct

UI-SPEC §Accent-as-Text had an ambiguity: line 156 listed `.del-flow-label for editor node` under `--color-accent-text` (rust), while line 157 listed it under `--color-primary-text` (gold). The plan designated the checker as the authority; checker adjudicated: **gold is correct**.

Rationale: The editor identity is gold throughout — editor chip background wash, editor chip text, editor speaker-name label in chat thread, editor flow-circle dot, EDITOR CONFIDENCE numeral are all gold. Switching only the flow-label to rust would fracture agent-identity consistency. `--color-primary-text` is the correct and consistent token for all editor label text. This resolution is recorded here per plan instructions.

### Residual: `★ Selected this week` badge (out of scope — flagged for UAT)

The pitch-card selected-badge renders `★ Selected this week` at 11px with `color: var(--color-primary)`. This spot was **not** in the plan's blocker list. It renders on a 14% gold wash background (`color-mix(in srgb, var(--color-primary) 14%, transparent)`) — not on pure `#FAFAF8` — so its effective contrast ratio differs from the 2.24:1 on-paper calculation. Scope-boundary rule (only fix blockers explicitly listed) prevents a change here.

**Action required**: UAT should visually confirm legibility. If the tinted background does not provide sufficient contrast boost, a follow-up plan must swap this token to `var(--color-primary-text)` as well.

## Verification Results

All tests passed and build exits 0:

```
theme-aa-tones.test.ts           14/14 passed (incl. DeliberationSlot BLOCKER 3 tripwire)
deliberation-qa-severity.test.ts 12/12 passed
deliberation-subscriptions.test.ts 9/9 passed
deliberation-no-model-names.test.ts 3/3 passed
deliberation-conversation.test.ts 6/6 passed
pnpm --filter web build          exit 0
```

## Known Stubs

None — all six token swaps are complete. No placeholder values or TODO markers in changed lines.

## Self-Check: PASSED
