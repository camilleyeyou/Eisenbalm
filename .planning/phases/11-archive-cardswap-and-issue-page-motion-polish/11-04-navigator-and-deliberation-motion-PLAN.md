---
phase: 11-archive-cardswap-and-issue-page-motion-polish
plan: 04
type: execute
wave: 2
depends_on: ["11-01"]
files_modified:
  - apps/web/app/globals.css
  - apps/web/components/issue/SectionNavigator.tsx
  - apps/web/components/issue/DeliberationSlot.tsx
autonomous: true
requirements: [MOT-02, MOT-03]

must_haves:
  truths:
    - "Section-navigator cards lift with translateY(-4px) on hover (gold glow already shipping); under reduced-motion the lift is instant and the magnetic-glow JS still early-returns (no cursor tracking)"
    - "The deliberation editor-confidence meter animates 0→its real value on scroll-into-view via IntersectionObserver + requestAnimationFrame; under reduced-motion the final value is shown instantly (never 0)"
    - "On screens <960px the pitch-card list becomes a horizontal scroll-snap carousel; on ≥960px it stays a vertical list"
    - "DEL-04 holds (no model names) and the 5 live Convex subscriptions in DeliberationSlot are untouched"
  artifacts:
    - path: "apps/web/app/globals.css"
      provides: "Phase 11 section: .section-card:hover translateY(-4px) + .pitch-card-list scroll-snap rules"
      contains: ".pitch-card-list"
    - path: "apps/web/components/issue/SectionNavigator.tsx"
      provides: "Magnetic-glow JS with preserved prefersReducedMotion early-return (unchanged behavior)"
      contains: "prefers-reduced-motion"
    - path: "apps/web/components/issue/DeliberationSlot.tsx"
      provides: "IntersectionObserver + rAF count-up on confidence meter; pitch-card-list class on pitch container"
      contains: "IntersectionObserver"
  key_links:
    - from: "apps/web/app/globals.css .section-card:hover"
      to: "SectionNavigator card lift"
      via: "transform: translateY(-4px) (transition: transform 0.3s already on .section-card)"
      pattern: "translateY\\(-4px\\)"
    - from: "apps/web/components/issue/DeliberationSlot.tsx confidence section"
      to: "displayValue state"
      via: "IntersectionObserver fires rAF count-up; reduced-motion sets final value directly"
      pattern: "setDisplayValue"
    - from: "apps/web/components/issue/DeliberationSlot.tsx pitch container"
      to: "globals.css .pitch-card-list"
      via: "className='pitch-card-list' replacing flex flex-col gap-4"
      pattern: "pitch-card-list"
---

<objective>
Implement MOT-02 and MOT-03 across three files that share `globals.css` (the only cross-file coupling in this phase, hence grouped into one plan to avoid a wave collision):

- **MOT-02:** Add `transform: translateY(-4px)` to the existing `.section-card:hover` rule in `globals.css` (the gold magnetic glow already ships from Phase 9; only the lift is missing). Preserve the existing `prefersReducedMotion` early-return in `SectionNavigator.tsx` — no new JS, no cursor tracking added.
- **MOT-03:** In `DeliberationSlot.tsx` (already `'use client'`), animate the editor-confidence percentage 0→real value on scroll-into-view via `IntersectionObserver` + `requestAnimationFrame`; under reduced-motion set the final value instantly. Convert the pitch-card container to a `.pitch-card-list` scroll-snap carousel (CSS rule added to `globals.css`, applied on <960px). Do NOT touch the 5 Convex subscriptions or any DEL-04-guarded code.

Purpose: Deliver the Machine Editorial motion polish on the live issue page while keeping every locked constraint (reduced-motion-safe, no model names, no new dep, AA, ≥44px targets).
Output: 3 modified files; turns `motion-polish.test.ts` (MOT-02 + MOT-03) GREEN; keeps `deliberation-no-model-names.test.ts` and `theme-aa-tones.test.ts` GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-UI-SPEC.md
@.planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-RESEARCH.md

<interfaces>
<!-- Live source extracts — extend these exact locations; do not rewrite surrounding logic. -->

globals.css `.section-card` base (lines 485-500) ALREADY has `transition: background 0.3s, border-color 0.3s, transform 0.3s, box-shadow 0.3s` — so `transform 0.3s` is already animated; no base-rule change needed.

globals.css `.section-card:hover` (lines 521-527) currently:
```css
.section-card:hover {
  background: var(--color-card-hover);
  border-color: var(--color-primary);
  box-shadow:
    0 24px 60px -20px rgba(0, 0, 0, 0.7),
    0 0 0 1px color-mix(in srgb, var(--color-primary) 20%, transparent);
}
```
Add `transform: translateY(-4px);` to this rule (RESEARCH lines 189-202). No `translateY` exists here yet (confirmed).

globals.css reduced-motion guard (lines 293-302) already collapses `transition-duration: 0.01ms !important` → the translate is instant under reduced-motion. DO NOT duplicate the guard.

globals.css print rule: `[data-print-hide="true"] { display: none !important; }` (line ~110). DO NOT change.

SectionNavigator.tsx (lines 91-101): magnetic-glow JS with the existing early-return — PRESERVE verbatim:
```tsx
useEffect(() => {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (prefersReducedMotion) return    // <-- preserve this line; no JS added below it
  ...
}, [])
```
MOT-02 adds NO JS to SectionNavigator. The only MOT-02 code change is the one CSS value in globals.css. (Optionally SectionNavigator can be left byte-unchanged — but the motion-polish.test.ts asserts it still contains the early-return, which it already does.)

DeliberationSlot.tsx — current React imports (line 21): `import { useQuery } from 'convex/react'` — it does NOT yet import React hooks. You MUST add `import { useState, useEffect, useRef } from 'react'`.

DeliberationSlot.tsx module-scope reduced-motion const (lines 95-97) — REUSE this; do NOT redeclare:
```tsx
const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
```

DeliberationSlot.tsx 5 Convex subscriptions (lines 105-109) — DO NOT touch:
```tsx
const run         = useQuery(api.pipelineRuns.byRunId,       runId ? { runId } : 'skip')
const pitchLog    = useQuery(api.pitchLog.byRunId,           runId ? { runId } : 'skip')
const events      = useQuery(api.deliberationEvents.byRunId, runId ? { runId } : 'skip')
const votes       = useQuery(api.agentVotes.byRunId,         runId ? { runId } : 'skip')
const corrections = useQuery(api.qaCorrections.byRunId,      runId ? { runId } : 'skip')
```

DeliberationSlot.tsx confidence meter (lines 487-534) — `editorConfidence` is a local already in scope. Current value render (line 500): `{Math.round(editorConfidence * 100)}%`. Current bar fill (lines 507-514): `width: ${editorConfidence * 100}%` with `transition: prefersReducedMotion ? 'none' : 'width 0.6s ease'`.

DeliberationSlot.tsx pitch-card container (line 273): `<div className="flex flex-col gap-4">`. Each card (line 279): `<div key={card._id} className="rounded p-6" style={{...}}>`.

DEL-04 forbidden strings (deliberation-no-model-names.test.ts, comment-stripped scan): `modelVersions`, `run?.cost`, `run.cost`, `claude`, `gpt`, `sonnet`, `haiku`, `openrouter`. New code must reference NONE of these. Read only `editorConfidence` (already extracted).

Count-up reduced-motion rule (Pitfall 4, RESEARCH lines 508-514): under reduced-motion the IntersectionObserver still fires but the rAF loop is skipped and `setDisplayValue(target)` is called directly — the value must NOT stay 0.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: globals.css — Phase 11 section: section-card hover translate + pitch-card scroll-snap</name>
  <files>apps/web/app/globals.css</files>
  <read_first>
    - apps/web/app/globals.css (read the `.section-card` base lines 485-500, `.section-card:hover` lines 521-527, the reduced-motion guard lines 293-302, the print rule near line 110, and find the end of the existing Phase 9 / Phase 10 section to append after)
    - apps/web/__tests__/theme-aa-tones.test.ts (confirms it scans :root hex values — Phase 11 adds NO new :root hex, only class rules)
    - apps/web/__tests__/motion-polish.test.ts (the .section-card:hover translateY + .pitch-card-list scroll-snap-type assertions to satisfy)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-RESEARCH.md (globals.css addition lines 619-652; RESEARCH lines 396-403)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-UI-SPEC.md (MOT-02 lines 351-385; MOT-03b lines 430-466)
  </read_first>
  <action>
Two edits to `apps/web/app/globals.css`. Add a clearly-labeled Phase 11 banner section AFTER the existing Phase 9/10 content (do not interleave). Use the ASCII banner convention already in the file.

**Edit A (MOT-02):** Add `transform: translateY(-4px);` to the existing `.section-card:hover` rule (lines 521-527) — append it inside that rule body alongside the existing `background`, `border-color`, `box-shadow`. Do NOT create a duplicate `.section-card:hover` rule; modify the existing one in place. The base `.section-card` already has `transition: ... transform 0.3s ...` so no transition change is needed. Do NOT add a reduced-motion guard here — the global guard at lines 293-302 collapses the transition.

**Edit B (MOT-03b):** Append the pitch-card scroll-snap rules in the Phase 11 banner section (copy from RESEARCH lines 628-651 verbatim). NO new `:root` hex variables (theme-aa-tones tripwire). Only class rules:
```css
/* ── PHASE 11 — Archive CardSwap + Motion Polish ─────────────────────────── */

/* MOT-03: Pitch-card scroll-snap carousel on narrow screens */
.pitch-card-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

@media (max-width: 959px) {
  .pitch-card-list {
    flex-direction: row;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
  }
  .pitch-card-list::-webkit-scrollbar {
    display: none;
  }
  .pitch-card-list > [role="listitem"] {
    scroll-snap-align: start;
    flex: 0 0 85vw;
    max-width: 400px;
  }
}
```
Note: `.pitch-card-list` base is `flex-direction: column` so the ≥960px desktop two-column layout is unchanged (vertical list); the `@media (max-width: 959px)` block switches to the horizontal snap carousel. The child selector targets `[role="listitem"]` — Task 2 adds `role="listitem"` to each pitch card.
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:unit __tests__/motion-polish.test.ts 2>&1 | tail -20 && pnpm test:unit __tests__/theme-aa-tones.test.ts 2>&1 | tail -8</automated>
  </verify>
  <acceptance_criteria>
    - The `.section-card:hover` rule in `apps/web/app/globals.css` contains `transform: translateY(-4px)` — verify with `grep -A6 "\.section-card:hover" apps/web/app/globals.css | grep "translateY(-4px)"`
    - There is exactly ONE `.section-card:hover {` rule (no duplicate) — `grep -c "\.section-card:hover {" apps/web/app/globals.css` returns 1
    - `grep "\.pitch-card-list" apps/web/app/globals.css` matches AND `grep "scroll-snap-type: x mandatory" apps/web/app/globals.css` matches
    - `grep "scroll-snap-align: start" apps/web/app/globals.css` matches
    - `grep "max-width: 959px" apps/web/app/globals.css` matches (the <960px breakpoint)
    - No new `:root` hex color values added — `theme-aa-tones.test.ts` stays GREEN
    - The MOT-02 `.section-card:hover translateY` and MOT-03 `.pitch-card-list scroll-snap-type` assertions in motion-polish.test.ts are GREEN
  </acceptance_criteria>
  <done>globals.css has the section-card hover lift and the pitch-card scroll-snap carousel rules in a Phase 11 section; AA tripwire unchanged.</done>
</task>

<task type="auto">
  <name>Task 2: DeliberationSlot.tsx — confidence count-up (IntersectionObserver + rAF) + pitch-card scroll-snap wiring</name>
  <files>apps/web/components/issue/DeliberationSlot.tsx</files>
  <read_first>
    - apps/web/components/issue/DeliberationSlot.tsx (FULL relevant regions: imports line 21-23, prefersReducedMotion lines 95-97, 5 subscriptions lines 105-109, pitch container lines 261-296, confidence meter lines 487-534)
    - apps/web/__tests__/deliberation-no-model-names.test.ts (the DEL-04 forbidden-string list + codeOnly() helper — your new code must reference none of them)
    - apps/web/__tests__/motion-polish.test.ts (MOT-03 assertions: IntersectionObserver, setDisplayValue, setDisplayValue(target) reduced-motion branch, pitch-card-list class, no model names)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-RESEARCH.md (Pattern 4 lines 205-320; count-up hook example lines 572-614; Pitfalls 3 + 4 lines 502-514; Anti-Patterns lines 321-328)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-UI-SPEC.md (MOT-03a count-up lines 399-428; MOT-03b scroll-snap + a11y lines 430-466; aria-live note lines 541-544)
  </read_first>
  <action>
Modify `apps/web/components/issue/DeliberationSlot.tsx`. Three surgical changes. Do NOT touch the 5 Convex subscriptions (lines 105-109), the empty/loading states, the QA severity logic, or anything DEL-04-guarded. Do NOT reference `run?.cost`, `run.cost`, `modelVersions`, or any model-name literal in new code or comments.

**Change A — imports:** Change line 21's import region to add React hooks. Add: `import { useState, useEffect, useRef } from 'react'`. (Currently only `useQuery` from convex/react is imported; React hooks are not yet imported.)

**Change B — count-up state + effect:** Inside the `DeliberationSlot` component function body (after the subscriptions, before the return; `prefersReducedMotion` module-scope const is reused — do NOT redeclare it), add the count-up machinery. `editorConfidence` is already a local in scope (used at line 500). Add:
```tsx
const confidenceSectionRef = useRef<HTMLDivElement>(null)
const [displayValue, setDisplayValue] = useState(0)
const animatedRef = useRef(false)

useEffect(() => {
  if (editorConfidence === null) return
  const target = Math.round(editorConfidence * 100)

  if (prefersReducedMotion) {
    setDisplayValue(target)   // Pitfall 4: final value instantly, never 0
    return
  }

  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !animatedRef.current) {
        animatedRef.current = true
        observer.disconnect()   // Pitfall 3: disconnect after first fire
        const duration = 1200
        const start = performance.now()
        function tick(now: number) {
          const t = Math.min((now - start) / duration, 1)
          setDisplayValue(Math.round(t * target))
          if (t < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }
    },
    { threshold: 0.4 },
  )
  const el = confidenceSectionRef.current
  if (el) observer.observe(el)
  return () => observer.disconnect()
}, [editorConfidence])
// prefersReducedMotion is module-scope (non-reactive) — intentionally omitted from deps
```

**Change C — wire the count-up into the confidence meter JSX (lines 487-534):**
- Add `ref={confidenceSectionRef}` to the outer `<div>` of the confidence block (the `<div>` opened at line 488).
- Change the displayed value span (line 500) from `{Math.round(editorConfidence * 100)}%` to `{displayValue}%`, and add `aria-live="polite"` to that `<span>` so the final value is announced once (UI-SPEC lines 541-544).
- Change the bar fill `width` (line 510) from `width: \`${editorConfidence * 100}%\`` to `width: \`${displayValue}%\``. KEEP the existing `transition: prefersReducedMotion ? 'none' : 'width 0.6s ease'` line (line 512) verbatim — it already correctly handles reduced-motion for the bar.
- The `< 0.70` threshold note (lines 518-531) reads `editorConfidence < 0.70` — leave it reading `editorConfidence` (the real value), NOT `displayValue`, so the note's presence does not flicker during the count-up.

**Change D — pitch-card scroll-snap wiring:**
- The pitch container (line 273) `<div className="flex flex-col gap-4">` becomes `<div className="pitch-card-list" role="list">`. (The `.pitch-card-list` class is defined in globals.css by Task 1; it provides `display:flex; flex-direction:column; gap:16px` on desktop and the scroll-snap carousel under 960px.)
- Each pitch card `<div key={card._id} className="rounded p-6" ...>` (line 279) gains `role="listitem"` and `tabIndex={0}` for keyboard accessibility (UI-SPEC lines 455-458). Keep all existing inline styles.
- After the pitch container closes, add a visually-hidden hint: `<p className="sr-only">Scroll to see more candidates.</p>` (UI-SPEC line 546).
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:unit __tests__/motion-polish.test.ts __tests__/deliberation-no-model-names.test.ts __tests__/deliberation-subscriptions.test.ts 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `grep "import { useState, useEffect, useRef } from 'react'" apps/web/components/issue/DeliberationSlot.tsx` matches
    - `grep "IntersectionObserver" apps/web/components/issue/DeliberationSlot.tsx` matches
    - `grep "setDisplayValue" apps/web/components/issue/DeliberationSlot.tsx` matches AND `grep -E "setDisplayValue\(\s*target\s*\)" DeliberationSlot.tsx` matches (Pitfall-4 reduced-motion final-value branch)
    - `grep "observer.disconnect()" apps/web/components/issue/DeliberationSlot.tsx` matches (Pitfall 3)
    - `grep "requestAnimationFrame" apps/web/components/issue/DeliberationSlot.tsx` matches
    - `grep "aria-live=\"polite\"" apps/web/components/issue/DeliberationSlot.tsx` matches
    - `grep "{displayValue}%" apps/web/components/issue/DeliberationSlot.tsx` matches (value span uses animated value)
    - `grep "pitch-card-list" apps/web/components/issue/DeliberationSlot.tsx` matches AND `grep "role=\"list\"" DeliberationSlot.tsx` matches AND `grep "role=\"listitem\"" DeliberationSlot.tsx` matches
    - The 5 Convex subscriptions are byte-unchanged — `grep -c "useQuery(api\." apps/web/components/issue/DeliberationSlot.tsx` still returns 5
    - DEL-04: new code references none of `run?.cost`, `run.cost`, `modelVersions`, `claude`, `gpt`, `sonnet`, `haiku`, `openrouter` — `deliberation-no-model-names.test.ts` stays GREEN
    - `motion-polish.test.ts` MOT-03 assertions all GREEN; `deliberation-subscriptions.test.ts` stays GREEN
  </acceptance_criteria>
  <done>Confidence meter counts up on scroll-into-view (instant under reduced-motion); pitch cards are a keyboard-accessible scroll-snap carousel under 960px; Convex subscriptions + DEL-04 intact.</done>
</task>

<task type="auto">
  <name>Task 3: Confirm SectionNavigator reduced-motion early-return preserved + full-suite + build gate</name>
  <files>apps/web/components/issue/SectionNavigator.tsx</files>
  <read_first>
    - apps/web/components/issue/SectionNavigator.tsx (lines 91-101 — the magnetic-glow useEffect + the `if (prefersReducedMotion) return` early-return)
    - apps/web/__tests__/motion-polish.test.ts (the SectionNavigator early-return assertion)
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-UI-SPEC.md (MOT-02 reduced-motion lines 371-379 — "No JS is added for MOT-02")
    - .planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-VALIDATION.md (Sampling Rate — per-wave merge runs full suite + build)
  </read_first>
  <action>
SectionNavigator.tsx requires NO code change for MOT-02 (the hover lift is entirely the globals.css edit in Task 1; the magnetic-glow JS and its reduced-motion early-return already exist and ship correctly). Confirm — do NOT add any cursor-tracking JS, do NOT remove the early-return. If the file is already correct (it is, per RESEARCH lines 203 + 377), leave it byte-unchanged; the motion-polish.test.ts assertion only verifies the early-return string is still present.

Then run the full per-wave validation gate (VALIDATION.md Sampling Rate — per-wave merge): the entire unit suite plus the Next build. This is the Wave 2 merge checkpoint that proves no tripwire regressed and the whole web app type-checks/builds with all Phase 11 source changes (CardSwap + IssueHero + globals.css + DeliberationSlot) integrated.
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:unit 2>&1 | tail -15 && pnpm --filter web build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `grep "prefers-reduced-motion" apps/web/components/issue/SectionNavigator.tsx` matches AND `grep -E "if\s*\(\s*prefersReducedMotion\s*\)\s*return" SectionNavigator.tsx` matches (early-return preserved)
    - SectionNavigator.tsx adds no new `mousemove`/cursor-tracking code beyond what already shipped (file unchanged or unchanged-in-behavior)
    - `pnpm --filter web test:unit` reports the FULL suite GREEN — all 23 files: the 3 new Wave 0 files now pass their Phase 11 assertions; the five tripwires (game-sandbox, theme-aa-tones, deliberation-no-model-names, issue-page-typography, site-header-nav) GREEN; all other existing tests GREEN
    - `pnpm --filter web build` exits 0
    - `git diff --stat apps/web/package.json` shows no dependency change
  </acceptance_criteria>
  <done>SectionNavigator early-return confirmed intact; full unit suite green; web build passes — Wave 2 merge gate satisfied.</done>
</task>

</tasks>

<verification>
- `pnpm --filter web test:unit` — FULL suite GREEN (3 new Phase 11 files + 5 tripwires + all others).
- `pnpm --filter web build` exits 0.
- DeliberationSlot 5 Convex subscriptions unchanged; DEL-04 no-model-names tripwire green.
- No new :root hex values; theme-aa-tones tripwire green.
- package.json dependencies unchanged.
</verification>

<success_criteria>
- MOT-02: `.section-card:hover` has `translateY(-4px)`; SectionNavigator reduced-motion early-return preserved (no new cursor JS).
- MOT-03: confidence count-up via IntersectionObserver+rAF (final value instant under reduced-motion); pitch cards scroll-snap under 960px via `.pitch-card-list`.
- DEL-04 + live Convex subscriptions intact.
- Full unit suite + build green.
</success_criteria>

<output>
After completion, create `.planning/phases/11-archive-cardswap-and-issue-page-motion-polish/11-04-SUMMARY.md`
</output>
