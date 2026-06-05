---
phase: quick-260605-egv
plan: "01"
type: execute
subsystem: frontend/issue-page
tags: [mobile-responsive, css, game-section, spec-ad, layout]
dependency_graph:
  requires: []
  provides: [mobile-responsive-game-section, mobile-responsive-spec-ad]
  affects: [apps/web/components/issue/GameSlot.tsx, apps/web/components/issue/BonusSection.tsx, apps/web/app/globals.css]
tech_stack:
  added: []
  patterns: [css-className-driven-layout, media-queries]
key_files:
  created: []
  modified:
    - apps/web/components/issue/GameSlot.tsx
    - apps/web/components/issue/BonusSection.tsx
    - apps/web/app/globals.css
decisions:
  - "#FFFDF8 kept inline in BonusSection.tsx per plan invariant (not moved to globals.css)"
  - "Base CSS values set exactly equal to the inline values removed, preserving desktop byte-identity"
metrics:
  duration: "~5 min"
  completed: "2026-06-05"
  tasks_completed: 1
  files_modified: 3
---

# Phase quick-260605-egv Plan 01: Fix Issue Page Game and Spec-Ad Mobile Responsiveness Summary

Move GAME and SPEC-AD section multi-column layout props from inline styles (which cannot carry media queries) into className-driven CSS rules in globals.css, with tablet/mobile breakpoints that collapse them to a single column.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Move GAME + SPEC-AD layout props to globals.css with mobile breakpoints | 22e33ca | GameSlot.tsx, BonusSection.tsx, globals.css |

## What Was Done

### GameSlot.tsx (Edit A + B)
- Removed 5 layout props from `.game-head` inline style object: `display: 'grid'`, `gridTemplateColumns: '1.3fr 1fr'`, `gap: '48px'`, `alignItems: 'end'`, `marginBottom: '36px'`. The `style={{}}` attribute was removed entirely.
- Removed `textAlign: 'right'` from `.game-desc` inline style. Font/color/size props remain inline unchanged.

### BonusSection.tsx (Edit C)
- Ad box div: added `className="ad-box"`, removed `padding: '48px 56px'` from inline style. `maxWidth`, `margin`, `border`, `background: '#FFFDF8'`, and `position` remain inline.
- Body div: changed `className="body"` to `className="body ad-body"`, removed `columnCount: 2`, `columnGap: '32px'`, `textAlign: 'justify'` from inline. `fontSize: '17px'` remains inline.

### globals.css (Edit D + E)
Inserted after the `.game` <=980px media query:

```css
.game-head {
  display: grid;
  grid-template-columns: 1.3fr 1fr;
  gap: 48px;
  align-items: end;
  margin-bottom: 36px;
}

.game-desc {
  text-align: right;
}

@media (max-width: 768px) {
  .game-head { grid-template-columns: 1fr; gap: 16px; align-items: start; }
  .game-desc { text-align: left; }
}
```

Inserted after `.ad-wrap`:

```css
.ad-box { padding: 48px 56px; }
.ad-body { column-count: 2; column-gap: 32px; text-align: justify; }

@media (max-width: 768px) {
  .ad-body { column-count: 1; text-align: left; }
}

@media (max-width: 600px) {
  .ad-box { padding: 28px 22px; }
}
```

## Invariants Preserved

- Desktop byte-identical: all base CSS values equal the inline values removed.
- Game iframe `sandbox="allow-scripts"` untouched.
- `validateEmbedCode` / `injectGameHead` path untouched.
- `bonusType` branching (bigBudget/jingle/specAd) untouched.
- `#FFFDF8` remains inline in BonusSection.tsx - not moved to globals.css.
- No new hex literals added to globals.css.
- `.mission-band` 22px vertical padding and `.sec-label` 22px margin-bottom prototype exceptions untouched.
- No new npm deps, no CDN, no new fonts.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Gates

- `pnpm build:web`: exit 0. Build succeeded cleanly (39 static pages generated).
- `pnpm --filter web test`: **391 passed / 13 todo** (404 total). Matches pre-change baseline exactly. No regressions.

## Self-Check: PASSED

- `apps/web/app/globals.css` modified with `.game-head`, `.game-desc`, `.ad-box`, `.ad-body` rules and media queries.
- `apps/web/components/issue/GameSlot.tsx` modified - no inline layout props on `.game-head`; no `textAlign` on `.game-desc`.
- `apps/web/components/issue/BonusSection.tsx` modified - `className="ad-box"` added, `#FFFDF8` inline, `className="body ad-body"` set.
- Commit `22e33ca` exists in git log.
