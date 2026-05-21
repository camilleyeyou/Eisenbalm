---
phase: quick-260521-mnz
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/web/components/issue/DeliberationSlot.tsx
autonomous: true
requirements: [BUILD-FIX]
must_haves:
  truths:
    - "pnpm --filter web build completes the full Next.js production build + typecheck with exit 0 (no 'Type error', no 'Failed to compile')"
    - "The advocate-score-bar branch still renders the score percentage and {scoreValue}/10 label"
    - "The null-score fallback branch still renders 'Scores did not complete this cycle.' for the Issue 999 null case"
    - "Existing deliberation + game-sandbox unit tests still pass"
  artifacts:
    - path: "apps/web/components/issue/DeliberationSlot.tsx"
      provides: "Type-safe advocate score bar guard"
      contains: "typeof scoreValue === 'number'"
  key_links:
    - from: "apps/web/components/issue/DeliberationSlot.tsx line ~340 guard"
      to: "scoreValue usage at lines ~355 and ~365"
      via: "typeof narrowing to number"
      pattern: "typeof scoreValue === 'number'"
---

<objective>
Fix the production build blocker in `apps/web/components/issue/DeliberationSlot.tsx` introduced by Phase 9 (deliberation layer). `pnpm --filter web build` fails type-checking with:

```
./components/issue/DeliberationSlot.tsx:365:50
Type error: 'scoreValue' is possibly 'undefined'.
  width: `${(scoreValue / 10) * 100}%`,
```

Purpose: Restore a clean, deployable Next.js production build. The deliberation layer is fully implemented and unit tests pass (vitest source-scans / logic mocks), but only the full `next build` typecheck catches this narrowing gap. Production deploys are blocked until it is resolved.

Output: A minimal, type-safe edit to the line-340 guard so `scoreValue` narrows to `number` inside the advocate-score-bar branch, plus minimal resolution of any further type errors the full build surfaces after this one.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md

<read_first>
@apps/web/components/issue/DeliberationSlot.tsx
</read_first>

<root_cause>
- Line 129: `const advocateScores = new Map<string, number | null>()` — values are `number | null`.
- Line 275: `const score = advocateScores.get(card.charityName)` → type `number | null | undefined` (Map.get adds `undefined`).
- Line 277: `const scoreValue = hasScore ? score : undefined` → type `number | null | undefined`.
- Line 340 guard: `hasScore && scoreValue !== null ?` narrows out `null` ONLY, leaving `number | undefined`.
- Line 355 `{scoreValue}/10` and line 365 `${(scoreValue / 10) * 100}%` therefore see `number | undefined` → typecheck fails on the arithmetic at 365.
</root_cause>

<required_fix>
Change ONLY the line-340 guard condition:

  FROM: `{hasScore && scoreValue !== null ? (`
  TO:   `{hasScore && typeof scoreValue === 'number' ? (`

This narrows `scoreValue` to `number` inside the advocate-score-bar branch, fixing both line ~355 (`{scoreValue}/10`) and line ~365 (`${(scoreValue / 10) * 100}%`).

LEAVE the null-score fallback branch EXACTLY as-is:
  `) : hasScore && scoreValue === null ? (`  rendering "Scores did not complete this cycle." (lines ~372–379).
This still correctly catches the real Issue 999 null-score case (`Map<string, number | null>` can hold `null`).

Do NOT alter any other rendering logic, copy, styling, animation, or the DEL-04 no-model-names behavior. Three render branches must remain: number bar / null message / null (no entry).
</required_fix>

<constraints>
- CLAUDE.md: do NOT change any schema field names; locked stack; no model names in UI. This fix touches none of those — guard condition only.
- This is a type-narrowing fix, not a logic change. No refactors.
- `next build` stops at the first type error. After applying the guard fix, re-run the FULL build; if additional latent type errors surface, minimally resolve ONLY what blocks the typecheck (no refactors, no scope creep).
- No watch-mode test flags.
</constraints>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Narrow scoreValue guard and confirm the full build + tests pass</name>
  <files>apps/web/components/issue/DeliberationSlot.tsx</files>
  <action>
Read `apps/web/components/issue/DeliberationSlot.tsx` first (focus lines 270–385 and the `advocateScores` declaration near line 129).

1. Edit the advocate-score-bar guard at line ~340. Change the condition from:
     `{hasScore && scoreValue !== null ? (`
   to:
     `{hasScore && typeof scoreValue === 'number' ? (`
   This is the ONLY required edit. It narrows `scoreValue` from `number | null | undefined` to `number` inside the bar branch, fixing the `{scoreValue}/10` label (line ~355) and the `${(scoreValue / 10) * 100}%` width (line ~365).

2. Leave the null-score fallback branch unchanged: `) : hasScore && scoreValue === null ? (` rendering "Scores did not complete this cycle." (lines ~372–379). Leave all other JSX, copy, styling, `prefersReducedMotion` transition, and DEL-04 no-model-names behavior untouched.

3. Run the FULL production build:
     `cd /Users/user/Desktop/Eisenbalm && pnpm --filter web build`
   The build must reach "Compiled successfully" and show no "Type error" / "Failed to compile". Because `next build` halts at the first type error, if it now surfaces a DIFFERENT latent type error elsewhere, minimally resolve ONLY what blocks the typecheck (concrete, surgical fix — no refactors, no behavior changes), then re-run the full build until it exits 0. Note any such additional fix in the SUMMARY.

4. Run the existing unit tests to confirm no regression:
     `cd /Users/user/Desktop/Eisenbalm/apps/web && npm run test:unit -- __tests__/deliberation-advocate-scores.test.ts __tests__/deliberation-no-model-names.test.ts __tests__/game-sandbox.test.ts`
   (No watch flags — `test:unit` is `vitest run`.)
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter web build</automated>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/web && npm run test:unit -- __tests__/deliberation-advocate-scores.test.ts __tests__/deliberation-no-model-names.test.ts __tests__/game-sandbox.test.ts</automated>
  </verify>
  <done>
- `cd /Users/user/Desktop/Eisenbalm && pnpm --filter web build` exits 0 — full Next.js production build + typecheck shows "Compiled successfully" AND no "Failed to compile" / "Type error".
- `cd /Users/user/Desktop/Eisenbalm/apps/web && npm run test:unit -- __tests__/deliberation-advocate-scores.test.ts __tests__/deliberation-no-model-names.test.ts __tests__/game-sandbox.test.ts` exits 0.
- DeliberationSlot.tsx line ~340 guard reads `hasScore && typeof scoreValue === 'number'`; the null-score fallback branch and all other rendering logic/copy/styling are unchanged; all three render branches (number bar / null message / none) remain.
  </done>
</task>

</tasks>

<verification>
- Full production build is clean: `pnpm --filter web build` exits 0, "Compiled successfully", no "Type error" or "Failed to compile".
- The three deliberation/game unit-test files pass under `vitest run` (no watch mode).
- The advocate-score-bar still renders the percentage width and `{scoreValue}/10`; the null-score fallback still renders "Scores did not complete this cycle."; DEL-04 no-model-names behavior intact.
- Edit is confined to `apps/web/components/issue/DeliberationSlot.tsx`; no schema field names changed; stack unchanged.
</verification>

<success_criteria>
- `cd /Users/user/Desktop/Eisenbalm && pnpm --filter web build` exits 0 (full build + typecheck passes).
- `cd /Users/user/Desktop/Eisenbalm/apps/web && npm run test:unit -- __tests__/deliberation-advocate-scores.test.ts __tests__/deliberation-no-model-names.test.ts __tests__/game-sandbox.test.ts` exits 0.
- Guard at line ~340 is `hasScore && typeof scoreValue === 'number'`; all other DeliberationSlot rendering, copy, styling, and behavior unchanged.
</success_criteria>

<output>
After completion, create `.planning/quick/260521-mnz-fix-deliberationslot-scorevalue-possibly/260521-mnz-SUMMARY.md`
</output>
