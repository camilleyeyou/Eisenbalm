---
phase: 09
plan: 03
subsystem: apps/web
tags: [podcast, agents-route, restyle, dark-editorial, DEL-06, POD-01, POD-02, POD-03]
dependency_graph:
  requires: [09-01]
  provides: [PodcastSlot dark restyle, /agents/[agentId] route]
  affects: [issue-page, deliberation-layer]
tech_stack:
  added: []
  patterns: [RSC fetch + notFound(), GROQ by-id query, CSS variable dark tokens, group-open Tailwind toggle]
key_files:
  created:
    - apps/web/app/agents/[agentId]/page.tsx
  modified:
    - apps/web/components/issue/PodcastSlot.tsx
    - apps/web/__tests__/podcast-slot.test.ts
    - apps/web/__tests__/agents-route.test.ts
decisions:
  - "QUERY_AGENT_PROFILE_BY_ID defined inline in agents/[agentId]/page.tsx (not added to canonical queries.ts) — by-id query is page-local; QUERY_AGENT_PROFILES in queries.ts serves the deliberation layer list"
  - "PodcastSlot max-w updated from 680px to 740px per UI-SPEC reading measure"
  - "describe.skip comment references removed from both test files to satisfy grep -c == 0 acceptance criterion"
metrics:
  duration: "5 min"
  completed_at: "2026-05-21T22:39:39Z"
  tasks: 2
  files: 4
---

# Phase 09 Plan 03: Podcast + Agent Route — Summary

**One-liner:** Dark editorial PodcastSlot restyle with native audio retained; minimal /agents/[agentId] RSC stub fetching agentProfile by GROQ slug query with notFound() for unknown IDs.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Restyle PodcastSlot to dark editorial; update transcript label | afb948a | PodcastSlot.tsx |
| 2 | Create /agents/[agentId] route; unskip DEL-06 + POD-02 label tests | 7e207ff | app/agents/[agentId]/page.tsx, podcast-slot.test.ts, agents-route.test.ts |

## What Was Built

### Task 1 — PodcastSlot dark restyle

- Container widened to `max-w-[740px]` (UI-SPEC reading measure, was 680px)
- Top divider re-colored to `--color-line` hairline
- Label `THE PODCAST` re-colored to `--color-text-dim` (11px uppercase UI font)
- Audio player wrapped in `.audio-player` `<figure>` with `--color-surface` background + `--color-line` border (print-hide-list hook; POD-01 preserved)
- Native `<audio controls>` retained as accessible source of truth with `aria-label="${description ?? 'Episode'} — podcast audio"`
- Transcript disclosure (`<details class="group">`) uses `group-open:hidden` / `group-open:inline` Tailwind toggle: shows "Read full deliberation transcript" when closed, "Hide transcript" when open (POD-02 label updated)
- Summary has `min-height: 44px` for touch target compliance
- Empty state "Audio coming soon." preserved exactly (period, no exclamation) in `--color-text-dim` (POD-03)
- No JS animation added; all transitions covered by globals.css reduced-motion guard

### Task 2 — /agents/[agentId] route

- `apps/web/app/agents/[agentId]/page.tsx` created as a Server Component (RSC)
- Inline `QUERY_AGENT_PROFILE_BY_ID` GROQ query: `*[_type == "agentProfile" && agentId.current == $agentId][0]`
- Fetches `displayName`, `role`, `personality`, `avatarUrl` — no model names, no `modelVersions`, no `pipelineRuns.cost`
- `notFound()` called when profile is null (covers synthetic `game-validator` and unknown IDs)
- Renders `<section>` (not `<main>`) inside root layout's `<main id="main">` — single-main rule satisfied
- `generateMetadata` returns `{ title: profile.displayName }` with fallback
- Dark editorial styling using `--color-*` tokens; `.eyebrow` and `.prose-measure` utilities
- Back link to homepage
- Both `podcast-slot.test.ts` and `agents-route.test.ts` unskipped; `describe.skip` comment references cleaned

## Test Results

```
__tests__/podcast-slot.test.ts    8 tests  — 8 passed
__tests__/agents-route.test.ts    4 tests  — 4 passed
__tests__/game-sandbox.test.ts    3 tests  — 3 passed
Total (3 files): 15 passed
```

Full suite: 29 pre-existing Phase 8 sentinel failures unchanged (outside scope — CMR-* Stripe tests, legal pages). No regressions introduced.

## Acceptance Criteria Verification

- [x] `grep -c "Audio coming soon\." PodcastSlot.tsx` = 3 (>= 1)
- [x] `grep -c "Audio coming soon!" PodcastSlot.tsx` = 0
- [x] `grep -c "Read full deliberation transcript" PodcastSlot.tsx` = 3 (>= 1)
- [x] `grep -c "<audio" PodcastSlot.tsx` = 3 (>= 1, has `controls` and `audioUrl`)
- [x] `grep -c "deliberationTranscript" PodcastSlot.tsx` = 1 (>= 1, has `<details`)
- [x] `grep -c "audio-player" PodcastSlot.tsx` = 2 (>= 1)
- [x] `apps/web/app/agents/[agentId]/page.tsx` exists
- [x] Contains `QUERY_AGENT_PROFILE_BY_ID` and `notFound(`
- [x] Imports `AgentProfile` from `'@/lib/sanity/types'`
- [x] No model name literals (claude, sonnet, haiku, gpt, openrouter, modelversions, .cost)
- [x] No `<main>` JSX element (only in comments, stripped by `codeOnly()`)
- [x] `grep -c "describe.skip" podcast-slot.test.ts` = 0
- [x] `grep -c "describe.skip" agents-route.test.ts` = 0
- [x] All 15 target tests green

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Comment cleanup for describe.skip grep acceptance criterion**
- **Found during:** Task 2 acceptance criteria check
- **Issue:** Plan's acceptance criterion `grep -c "describe.skip" ... == 0` fails because both test files had historical `describe.skip` references in JSDoc/block comments even after the actual `describe.skip(` calls were removed.
- **Fix:** Updated file-level JSDoc comments to remove historical `describe.skip` references; replaced with present-tense descriptions of the active state.
- **Files modified:** `__tests__/podcast-slot.test.ts`, `__tests__/agents-route.test.ts`
- **Commit:** 7e207ff

None — plan executed as written for all functional requirements.

## Known Stubs

None. The agents route fetches live from Sanity; PodcastSlot binds to live Sanity podcast data. No hardcoded empty values in rendered output.

## Self-Check: PASSED

- `apps/web/components/issue/PodcastSlot.tsx` — FOUND
- `apps/web/app/agents/[agentId]/page.tsx` — FOUND
- `apps/web/__tests__/podcast-slot.test.ts` — FOUND
- `apps/web/__tests__/agents-route.test.ts` — FOUND
- Commit `afb948a` — FOUND
- Commit `7e207ff` — FOUND
