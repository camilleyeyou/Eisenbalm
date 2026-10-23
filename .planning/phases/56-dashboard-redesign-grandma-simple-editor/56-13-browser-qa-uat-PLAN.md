---
phase: 56-dashboard-redesign-grandma-simple-editor
plan: 13
type: execute
wave: 5
depends_on: [56-12]
files_modified:
  - .planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UAT.md
  - .planning/phases/56-dashboard-redesign-grandma-simple-editor/qa/
autonomous: false
requirements: [P56-A1, P56-A2, P56-B4]

must_haves:
  truths:
    - "Each of the 7 artboards has a matching live screen at 1280px and 400px, compared side by side with canvas/*.dc.html"
    - "Replaying the client walkthrough (client-ux-feedback-261022.md bugs 1–9 + jargon list) hits none of the reported confusions"
    - "No horizontal page scroll at 400px; tap targets at least 48px"
  artifacts:
    - path: ".planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UAT.md"
      provides: "Browser-QA record: per artboard x width, per client item, pass/fail with notes"
      contains: "## Walkthrough replay"
  key_links:
    - from: "56-UAT.md"
      to: ".planning/ui-reviews/client-ux-feedback-261022.md"
      via: "one row per client item"
      pattern: "Bug 1"
---

<objective>
Human-gated browser QA: run dispatch-control locally against the local pipeline (CORS confirmed in 56-PREFLIGHT.md), capture all seven screens at 1280px and 400px, replay the client walkthrough, and record the result in 56-UAT.md.

Purpose: Success criteria 1 and 2 cannot be proven in jsdom.
Output: qa/ screenshots + 56-UAT.md, approved by the user.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-PREFLIGHT.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UI-SPEC.md
@.planning/ui-reviews/client-ux-feedback-261022.md
@.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Start the stack, capture 7 screens x 2 widths, pre-fill 56-UAT.md</name>
  <files>.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UAT.md, .planning/phases/56-dashboard-redesign-grandma-simple-editor/qa/</files>
  <read_first>
    - 56-PREFLIGHT.md (CORS check commands)
    - 56-RESEARCH.md § "Walkthrough mapping" table
    - canvas/*.dc.html (open each for side-by-side comparison)
  </read_first>
  <action>
1. Start `pnpm --filter pipeline dev` (port 8000) and `pnpm --filter dispatch-control dev` (port 3001) in the background. Re-run the CORS probe from 56-PREFLIGHT.md; if it fails, stop and report (do not continue to the checkpoint with a broken data path).
2. Use the browser QA tool (`ecc:browser-qa` if available, else Playwright via `npx playwright` with a signed-in storage state supplied by the user at the checkpoint) to visit, at viewport 1280x900 and 400x860: `/` (current issue), `/?run=<a published run id>`, `/s/founderBio`, `/s/game`, `/archive` (and open the Stopped section), `/admin`, `/admin/runs/<a failed run id>`, `/admin/runs`, `/admin/finance`. Pick run ids from Convex dev data via the Archive page. Save PNGs to `qa/<route-slug>-<width>.png`. For each page record: horizontal scroll present (document.scrollingElement.scrollWidth > innerWidth), count of `[data-primary]`, any console errors.
3. Write `56-UAT.md` with sections `## Pre-flight`, `## Artboards` (table: artboard, route, 1280 result, 400 result, notes, screenshot paths), `## Walkthrough replay` (one row per client item: Bug 1 … Bug 9 and the jargon list, expected behaviour from the Walkthrough mapping table, result left as `pending-human`), `## Deferred` ("Rewrite this part end-to-end and Start a new issue: blocked until OPENROUTER_API_KEY is replaced; Bug 10 Clerk production instance is ops, out of scope").
If sign-in blocks automated capture, this is an authentication gate: ask the user to sign in in the opened browser, then continue.
  </action>
  <verify>
    <automated>grep -c "pending-human" /Users/user/Desktop/Eisenbalm/.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UAT.md</automated>
  </verify>
  <acceptance_criteria>
    - 56-UAT.md exists with headings `## Artboards` and `## Walkthrough replay`
    - `ls .planning/phases/56-dashboard-redesign-grandma-simple-editor/qa/*.png | wc -l` >= 14
    - walkthrough table has rows `Bug 1` through `Bug 9`
  </acceptance_criteria>
  <done>Evidence captured and ready for the human pass.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Human walkthrough replay at 1280px and 400px</name>
  <files>.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UAT.md</files>
  <read_first>
    - .planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UAT.md (pre-filled by Task 1)
    - .planning/ui-reviews/client-ux-feedback-261022.md
  </read_first>
  <action>Present the steps below to the user, wait for their answers, then replace every `pending-human` in 56-UAT.md with `pass` or `fail — <user's words>`. Do not mark anything pass on the user's behalf.</action>
  <what-built>All seven editor screens rebuilt to the canvas, old chrome retired, local stack running at http://localhost:3001 with screenshots in qa/ and a pre-filled 56-UAT.md.</what-built>
  <how-to-verify>
    1. Open http://localhost:3001 at desktop width and at a 400px-wide window (or phone).
    2. Compare each screen with its artboard in `canvas/` (Main, Home-Writing or Home-Published, Section, Archive, Behind, Behind-Run).
    3. Replay the client walkthrough in `.planning/ui-reviews/client-ux-feedback-261022.md`:
       - Bug 1: in Past issues, click a charity name — it opens that issue.
       - Bug 2: on a Behind-Run page, 'Back to the issue' opens that issue, not a generic page.
       - Bug 3: while an issue is being written there is a 'Stop writing this issue' button with a confirm.
       - Bug 4: 'Past issues, step by step' shows names and dates with plain status words, not ids.
       - Bug 5: on a part, click a paragraph, change a word, Save — the change sticks after reload.
       - Bug 6: Behind the scenes shows a real cost, not $0.00.
       - Bug 7: the front page lists nine parts.
       - Bug 8: a paused older issue reads 'Waiting for you', never red 'Failed', no Interrupt(...) text outside Technical details.
       - Bug 9: every button you press does something.
       - Jargon: no Run, Trigger, Pipeline, Graph, Drift, Re-roll, Calibrator, Chronicler, Tokens, Agent on any page.
    4. Each page has at most one blue button; at 400px nothing scrolls sideways.
    5. Mark each row in 56-UAT.md pass / fail (the executor records your answers).
  </how-to-verify>
  <resume-signal>Type "approved", or list the failing rows (e.g. "Bug 5 fails: Save shows error").</resume-signal>
  <verify>
    <automated>! grep -n "pending-human" /Users/user/Desktop/Eisenbalm/.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-UAT.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "pending-human" 56-UAT.md` = 0
    - every `Bug N` row and every artboard row reads `pass` or `fail — …`
  </acceptance_criteria>
  <done>User has approved, or failing rows are recorded for gap closure.</done>
</task>

</tasks>

<verification>
56-UAT.md has no `pending-human` rows left and every row is pass, or the failing rows are listed for a gap-closure plan.
</verification>

<success_criteria>
Success criteria 1 and 2 confirmed by the user.
</success_criteria>

<output>
After completion, create `.planning/phases/56-dashboard-redesign-grandma-simple-editor/56-13-SUMMARY.md`
</output>
