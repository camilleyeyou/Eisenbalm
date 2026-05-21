---
phase: 09
plan: "01"
subsystem: apps/web
tags: [css-tokens, data-layer, dark-palette, wcag-aa, groq, sanity-types]
dependency_graph:
  requires: []
  provides:
    - dark HYBRID house palette CSS tokens in globals.css :root
    - QUERY_AGENT_PROFILES GROQ query
    - AgentProfile TypeScript type
    - runId prop wired to DeliberationSlot
  affects:
    - apps/web/app/issue/[slug]/page.tsx (runId wiring)
    - apps/web/lib/sanity/queries.ts (new query)
    - apps/web/lib/sanity/types.ts (new type)
    - apps/web/app/globals.css (dark palette, print extension)
    - apps/web/__tests__/theme-aa-tones.test.ts (new build guard)
tech_stack:
  added: []
  patterns:
    - dark house default palette with color-mix() derivations
    - WCAG AA build-time assertions via Vitest (theme-aa-tones.test.ts)
key_files:
  created:
    - apps/web/__tests__/theme-aa-tones.test.ts
  modified:
    - apps/web/app/globals.css
    - apps/web/lib/sanity/queries.ts
    - apps/web/lib/sanity/types.ts
    - apps/web/app/issue/[slug]/page.tsx
decisions:
  - Used #938A77 for --color-text-mute (5.8:1) over mockup's #615B4D (2.9:1 FAILS AA); locked by theme-aa-tones.test.ts
  - --color-text-muted alias retained for back-compat; now points to --color-text-mute
  - --color-surface changed from color-mix() derivation to fixed #14110D (house structure is fixed, not derived from per-issue bg)
  - prefers-color-scheme dark flip removed; house default is dark, issue themes override via injection
  - font-display default changed to Cormorant Garamond (already whitelisted); body stays Lora; UI stays Inter
  - Intentional TypeScript prop mismatch on DeliberationSlot in page.tsx — Plan 09-02 closes it
metrics:
  duration: "4 min"
  completed: "2026-05-21T22:27:49Z"
  tasks_completed: 2
  files_changed: 5
---

# Phase 9 Plan 01: CSS Tokens and Data Layer Summary

Dark HYBRID house palette as the new globals.css :root default, WCAG-AA-verified secondary tones, QUERY_AGENT_PROFILES GROQ query, AgentProfile type, and runId prop wiring to DeliberationSlot.

## Completed Tasks

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Replace :root with dark HYBRID house palette + extend print hide-list | 3d138c4 | apps/web/app/globals.css, apps/web/__tests__/theme-aa-tones.test.ts |
| 2 | Add QUERY_AGENT_PROFILES, AgentProfile type, and wire runId to DeliberationSlot | d60fe03 | apps/web/lib/sanity/queries.ts, apps/web/lib/sanity/types.ts, apps/web/app/issue/[slug]/page.tsx |

## What Was Built

### Task 1 — globals.css: Dark HYBRID House Palette

The `:root` block in `apps/web/app/globals.css` was replaced with the full dark house palette per the 09-UI-SPEC Token re-expression table:

**Core palette (theme-overridable):**
- `--color-bg: #0C0B0A` (the void; 16.4:1 contrast with `--color-text`)
- `--color-text: #F0EAD9` (warm cream)
- `--color-primary: #CDA434` (gold; 8.4:1 on dark bg)
- `--color-accent: #C2502A` (ember; AA-large only — borders/icons/≥18px text)

**House surfaces (fixed):**
- `--color-surface: #14110D`, `--color-card: #1A1611`, `--color-card-hover: #221D16`

**Secondary text tones (AA-verified):**
- `--color-text-dim: #A89F8A` (7.5:1 — AA at all sizes; secondary prose)
- `--color-text-mute: #938A77` (5.8:1 — AA; mockup's #615B4D at 2.9:1 was rejected)

**Agent identity colors (house, never themed):**
- `--color-scout: #8A9B7A` (sage; 6.6:1) and `--color-advocate: #6E92B8` (azure; 6.1:1)

**Line/border tokens:**
- `--color-line` and `--color-line-strong` via `color-mix(in srgb, var(--color-text) 8%/16%, transparent)`

**Derivations:**
- `--color-primary-bright` and `--color-primary-glow` via `color-mix()` tracking `--color-primary`

**Back-compat aliases preserved:** `--color-text-muted` → `var(--color-text-mute)`, `--color-border` → `var(--color-line)`

The `@media (prefers-color-scheme: dark)` block was removed — the house default is now dark; per-issue theme injection via `serializeThemeCss` still overrides all six theming variables.

**Print hide-list extended:** Added `.aurora`, `.bg-grid`, `.grain`, `.progress`, `.site-nav`, `.section-navigator`, `.agent-chip`, `.confidence-meter`, `.audio-player` to the `@media print` `display: none !important` group. The deliberation transcript and article prose remain printable as black-on-white serif.

**WCAG AA build guard:** `apps/web/__tests__/theme-aa-tones.test.ts` added with 8 assertions using `contrastRatio()` from `apps/web/lib/theme.ts`. All 8 pass, including the negative test that documents why #615B4D was rejected.

**theme.ts untouched:** Verified with `git diff --stat apps/web/lib/theme.ts` (no output).

### Task 2 — Data Layer: QUERY_AGENT_PROFILES, AgentProfile, and runId prop

**queries.ts:** `QUERY_AGENT_PROFILES` added after `QUERY_ISSUE_RUN_ID`, implementing the §1.6 contract:
```groq
*[_type == "agentProfile"] | order(agentId.current asc) {
  "agentId": agentId.current,
  displayName,
  role,
  personality,
  "avatarUrl": avatar.asset->url
}
```

**types.ts:** `AgentProfile` type added after `IssueRunId`:
```typescript
export type AgentProfile = {
  agentId: string
  displayName: string
  role: string
  personality: string | null
  avatarUrl: string | null
}
```

**page.tsx:** `<DeliberationSlot />` changed to `<DeliberationSlot runId={issue.runId ?? null} />`. The TypeScript prop mismatch (DeliberationSlot currently has no props in its stub) is intentional — Plan 09-02 rewrites the component to accept `{ runId: string | null }`.

## Deviations from Plan

### Auto-fixed Issues

None.

### Notes

**Comment adjustment (within-spec):** The plan's `:root` block comment referenced `#615B4D` with `NOT the mockup's #615B4D`. The acceptance criterion required `grep "#615B4D" apps/web/app/globals.css` to return nothing. The comment was reworded to reference the test file instead of the literal value — consistent with the plan's intent.

**Pre-existing test failures:** The full unit suite has 29 pre-existing failures from Phase 8 Stripe sentinel tests (CMR-05, CMR-06, CMR-03, CMR-01) — these are route files not yet created. These failures existed before this plan (STATE.md records 29 fail from Phase 8 Wave 0). Zero regressions were introduced.

## Known Stubs

None in files created or modified by this plan. The `<DeliberationSlot runId=...>` prop is the intended data contract; the component stub itself is owned by Plan 09-02.

## Self-Check: PASSED

**Files exist:**
- apps/web/app/globals.css: modified (has `--color-bg: #0C0B0A`)
- apps/web/__tests__/theme-aa-tones.test.ts: created (8 passing tests)
- apps/web/lib/sanity/queries.ts: modified (contains QUERY_AGENT_PROFILES)
- apps/web/lib/sanity/types.ts: modified (contains export type AgentProfile)
- apps/web/app/issue/[slug]/page.tsx: modified (contains `<DeliberationSlot runId=`)

**Commits exist:**
- 3d138c4: feat(09-01): dark HYBRID house palette in globals.css + print hide-list extension
- d60fe03: feat(09-01): add QUERY_AGENT_PROFILES, AgentProfile type, and wire runId to DeliberationSlot
