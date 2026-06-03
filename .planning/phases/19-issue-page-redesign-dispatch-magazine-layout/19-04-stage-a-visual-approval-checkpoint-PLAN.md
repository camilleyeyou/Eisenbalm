---
phase: 19-issue-page-redesign-dispatch-magazine-layout
plan: 04
type: execute
wave: 3
depends_on: [19-02, 19-03]
files_modified: []
autonomous: false
requirements: [P19-05]
must_haves:
  truths:
    - "The Stage A static shell visually matches 19-PROTOTYPE.html"
    - "Under prefers-reduced-motion all 10 sections are fully visible with no hidden/empty states"
    - "The user has explicitly approved the visual match BEFORE Stage B live wiring begins"
  artifacts: []
  key_links: []
---

<objective>
HARD DELIVERY GATE (success criterion 5). Pause for the user to visually verify the Stage A static shell (Plans 02 + 03, MOCK data) against the 19-PROTOTYPE.html source-of-truth. Stage B (Plan 05 — live Sanity GROQ + Convex wiring + per-issue theme re-enable) MUST NOT begin until the user approves. This checkpoint makes the Stage A/Stage B boundary explicit so execute-phase stops here.

Purpose: Visual fidelity to the prototype cannot be asserted by source-scan tests. The two-stage contract requires human approval of the structure + motion before live data is wired, so any layout corrections are made cheaply against mock data, not after GROQ/Convex plumbing.
Output: User approval (or a list of visual corrections to fold back into Plans 02/03 before Stage B).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-UI-SPEC.md
@.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-PROTOTYPE.html
</context>

<tasks>

<task type="auto">
  <name>Task 1: Confirm Stage A automated gates green before requesting visual review</name>
  <read_first>
    - .planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-VALIDATION.md (sampling rates + Stage A gate)
  </read_first>
  <action>
    Before pausing for human review, confirm the Stage A automated baseline is green so the user reviews a building, test-passing shell:
    1. Run `pnpm --filter web test:unit` — must exit 0.
    2. Run `pnpm --filter web typecheck` — must exit 0.
    3. Run `pnpm --filter web build` — must exit 0.
    If any fails, STOP and report the failure (do not proceed to the human checkpoint with a red baseline).
  </action>
  <verify>
    <automated>cd apps/web && pnpm test:unit > /dev/null 2>&1 && pnpm typecheck > /dev/null 2>&1 && pnpm build > /dev/null 2>&1 && echo "STAGE_A_GATES_GREEN"</automated>
  </verify>
  <acceptance_criteria>
    - The verify command prints `STAGE_A_GATES_GREEN`
    - `pnpm --filter web test:unit` exits 0
    - `pnpm --filter web build` exits 0
  </acceptance_criteria>
  <done>All three Stage A automated gates pass; shell is ready for human visual review.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Stage A visual approval against the prototype</name>
  <what-built>
    The complete Stage A static issue-page shell at `/issue/[slug]` rendering all 10 Dispatch sections from MOCK data (Plans 02 + 03): compact masthead → 3-col briefing with animated stat count-ups → dark mission band → sticky left scroll-spy rail → drop-capped article sections with pull-quotes (origin/problem/founder/case) → full-width game with play button → spec-ad bonus → deliberation dark-band centerpiece (scoreboard + staggered chat + confidence bar) → podcast player → shop band. framer-motion scroll reveals, count-ups, scroll-progress bar, and deliberation stagger all running. Atmosphere aurora + vertical-timeline navigator retired.
  </what-built>
  <how-to-verify>
    1. Start the dev server: `pnpm --filter web dev`.
    2. Open `http://localhost:3000/issue/[any-slug]` (Stage A renders MOCK "Puppies Behind Bars" content regardless of slug).
    3. Open `.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-PROTOTYPE.html` in a second browser tab.
    4. Compare side by side, section by section, in order: masthead (Fraunces h1, dateline), 3-col briefing (stats count up on scroll-in), mission band (dark, constant copy), sticky left rail appears after ~700px scroll and ticks track the active section, article sections (drop cap on first paragraph, pull-quotes with accent left-border), full-width game (76px accent play button), spec-ad (2-col justified, "ADVERTISEMENT — SPEC" tab), deliberation dark band (candidate scoreboard with winner highlight, chat messages stagger in, confidence bar fills), podcast player, oxblood shop band.
    5. Resize the browser below 980px: nav links hide, briefing stacks to 1 column, rail hides, deliberation/game/ad go 1-column.
    6. Enable OS "Reduce motion" (macOS: System Settings → Accessibility → Display → Reduce motion), reload: confirm ALL 10 sections are fully visible immediately — no blank/hidden/opacity-0 regions, no missing chat messages, confidence bar at full width.
  </how-to-verify>
  <acceptance_criteria>
    - User confirms the Stage A shell matches the prototype's structure, type, color, and motion
    - User confirms reduced-motion shows 100% of content with no hidden states
    - User types "approved" (or provides a specific list of visual corrections)
  </acceptance_criteria>
  <resume-signal>Type "approved" to unlock Stage B (Plan 05), or describe specific visual corrections to fold back into Plans 02/03 first.</resume-signal>
</task>

</tasks>

<verification>
- Stage A automated gates green (test:unit, typecheck, build)
- User has explicitly approved the visual match OR provided correction list
</verification>

<success_criteria>
- Stage A reviewable + user-approved BEFORE Stage B begins (P19-05)
- Reduced-motion content visibility confirmed (P19-04)
</success_criteria>

<output>
After completion, create `.planning/phases/19-issue-page-redesign-dispatch-magazine-layout/19-04-SUMMARY.md` recording the approval (or the correction list).
</output>
