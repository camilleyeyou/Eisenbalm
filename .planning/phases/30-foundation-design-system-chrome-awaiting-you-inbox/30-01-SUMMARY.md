---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 01
subsystem: ui
tags: [nextjs, tailwind-v4, next-font-google, design-tokens, dispatch-control]

# Dependency graph
requires: []
provides:
  - "docs/design/dispatch-control-v2/ — the 7-file binding 1c design handoff bundle, committed in-repo"
  - "1c @theme token block in apps/dispatch-control/app/globals.css (ink/cobalt/vermilion/marigold/green + 4 font-family variables)"
  - "4 next/font/google loaders (Newsreader/Lora/Space Grotesk/IBM Plex Mono) wired as CSS variables on <body>"
  - "__tests__/design-tokens.test.ts — source-scan regression gate locking tokens + fonts"
affects: [30-02, 30-03, 30-04, 30-05, 30-06, 30-07, 30-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tailwind v4 CSS-first @theme token block referencing next/font/google CSS variables (mirrors apps/web Phase 19 multi-font pattern)"
    - "shadcn :root CSS-variable shim remapped to 1c token equivalents rather than rewritten"

key-files:
  created:
    - docs/design/dispatch-control-v2/Dispatch Control.dc.html
    - docs/design/dispatch-control-v2/Dispatch Control - Audit.dc.html
    - docs/design/dispatch-control-v2/Dispatch Control - Review Desk Directions.dc.html
    - docs/design/dispatch-control-v2/DECISIONS.md
    - docs/design/dispatch-control-v2/README.md
    - "docs/design/dispatch-control-v2/4 - Design Brief - Dispatch Control v2.md"
    - "docs/design/dispatch-control-v2/4 - Wireframe - Dispatch Control v2.html"
    - apps/dispatch-control/__tests__/design-tokens.test.ts
  modified:
    - apps/dispatch-control/app/globals.css
    - apps/dispatch-control/app/layout.tsx

key-decisions:
  - "Preserved the Phase 24 .cm-prompt-editor .cm-var-known/.cm-var-unknown rules byte-unchanged while retheming globals.css"
  - "Remapped the existing shadcn :root variable shim to 1c equivalents instead of removing it — keeps switch.tsx working without a rewrite"
  - "Set --radius: 0 (was 0.5rem) for the hard-edged anti-SaaS surface treatment the 1c spec requires"

patterns-established:
  - "1c @theme token block in globals.css is the single source of truth for color/font tokens; new chrome components (masthead, nav) should consume var(--color-*) / var(--font-*) directly rather than literal hex/Tailwind neutral-* classes"

requirements-completed: [CHR-01]

# Metrics
duration: 3min
completed: 2026-07-06
---

# Phase 30 Plan 01: Design Bundle, Tokens & Fonts Summary

**Committed the binding 1c design handoff bundle in-repo and wired the full 1c token system (5 colors + 4 next/font/google fonts) into apps/dispatch-control's globals.css/layout.tsx via a Tailwind v4 @theme block, with the Phase 24 CodeMirror highlight styles preserved untouched.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-06T18:02:38-07:00
- **Completed:** 2026-07-06T18:05:26-07:00
- **Tasks:** 3 completed (Task 2 was TDD: RED test commit + GREEN implementation commit)
- **Files modified:** 9 (7 new docs files + 1 new test file + 2 modified app files)

## Accomplishments
- All 7 files of the binding `Dispatch Control.dc.html` design handoff bundle are now readable in-repo at `docs/design/dispatch-control-v2/`, unblocking every downstream Phase 30-39 plan that reads it (D-12)
- `apps/dispatch-control/app/globals.css` carries the full 1c `@theme` token block (verbatim from RESEARCH Pattern 1) plus a remapped shadcn `:root` shim with `--radius: 0` for hard edges
- `apps/dispatch-control/app/layout.tsx` loads all 4 Google Fonts (Newsreader, Lora, Space Grotesk, IBM Plex Mono) via `next/font/google`, self-hosted, zero CDN/CLS
- Phase 24's `.cm-prompt-editor .cm-var-known`/`.cm-var-unknown` prompt-editor highlight rules survive the retheme byte-unchanged
- A new source-scan test (`design-tokens.test.ts`) locks token presence, `--radius: 0`, the preserved CodeMirror rules, and all 4 font imports as a permanent regression gate

## Task Commits

Each task was committed atomically:

1. **Task 1: Commit the design handoff bundle into the repo (D-12)** - `715e20c` (docs)
2. **Task 2: 1c token block in globals.css** - `8e67208` (test, RED) + `bb39e99` (feat, GREEN)
3. **Task 3: Load the 4 fonts via next/font/google in layout.tsx** - `8a29059` (feat)

**Plan metadata:** committed alongside this SUMMARY (see final commit below)

_Note: Task 2 was TDD — the failing source-scan test was committed first, then made green by the globals.css edit._

## Files Created/Modified
- `docs/design/dispatch-control-v2/*` (7 files) - the binding 1c design spec, decisions log, audit, review-desk directions, README, design brief, wireframe — verbatim copies from the source handoff
- `apps/dispatch-control/__tests__/design-tokens.test.ts` - source-scan gate: token literals, `--radius: 0`, preserved `.cm-prompt-editor` rules, 4 font imports
- `apps/dispatch-control/app/globals.css` - `@theme` token block, remapped shadcn shim, `body { font-family: var(--font-ui) }`
- `apps/dispatch-control/app/layout.tsx` - 4 `next/font/google` loaders + `.variable` classes on `<body>`

## Decisions Made
- Preserved the shadcn CSS-variable shim (remapped, not removed) since `components/ui/switch.tsx` is the only primitive that consumes it — a full rewrite wasn't necessary for this plan's scope
- Followed RESEARCH Pattern 1's exact token/font values verbatim (no re-derivation) since they were extracted directly from the binding `Dispatch Control.dc.html` spec

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria (file counts, grep assertions, test/build green) verified directly against the plan's stated commands.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The 1c token substrate (`var(--color-*)`, `var(--font-*)`) is ready for 30-02 through 30-08 to consume directly in new chrome (masthead, nav, inbox) and in the literal-class token-swap pass on Config/Finance/Settings.
- Per RESEARCH Pitfall 1: this plan only wired the token *system* — it does not touch the ~13 existing files using literal `neutral-*` Tailwind classes. That token-swap-only pass is explicitly out of this plan's scope and belongs to later 30-0x plans per D-06/D-07.
- Design handoff bundle is now a stable in-repo reference (`docs/design/dispatch-control-v2/`) — downstream plans should read from there, not `~/Downloads/`.

---
*Phase: 30-foundation-design-system-chrome-awaiting-you-inbox*
*Completed: 2026-07-06*

## Self-Check: PASSED

All created/modified files verified present on disk; all 4 task commit hashes (715e20c, 8e67208, bb39e99, 8a29059) verified present in git history.
