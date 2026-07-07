---
phase: 30-foundation-design-system-chrome-awaiting-you-inbox
plan: 07
type: execute
wave: 3
depends_on: ["30-02"]
files_modified:
  - apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx
  - apps/dispatch-control/__tests__/how-to-use.test.ts
autonomous: true
requirements: [CHR-03]
must_haves:
  truths:
    - "The How-to-use screen explains the weekly loop, the color legend, and the house rules"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx"
      provides: "Full How-to-use content — 5 weekly-loop steps + 4-entry color legend + 4 house rules (D-13)"
      contains: "Silence is never"
  key_links:
    - from: "apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx"
      to: "docs/design/dispatch-control-v2/Dispatch Control.dc.html (disp_howto content)"
      via: "verbatim copy of the weekly loop / legend / house rules"
      pattern: "Nothing silent"
---

<objective>
Fill the How-to-use screen (D-13, CHR-03) with the operator onboarding content drafted from the committed handoff — the weekly loop (5 steps), the 1c color legend (4 entries), and the 4 house rules — replacing the minimal stub created in Plan 30-02. Andrew reviews/edits this copy at UAT.

Purpose: The How-to-use screen is the console's self-documentation; the content is extracted verbatim from the binding spec so it stays faithful.
Output: `how-to-use/page.tsx` with the full 1c-styled content; a source-scan test locking the required copy.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-RESEARCH.md
@.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-CONTEXT.md
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: How-to-use full content page + source-scan test</name>
  <read_first>
    - docs/design/dispatch-control-v2/Dispatch Control.dc.html (search `disp_howto` — the source content committed in Plan 30-01)
    - apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx (the stub from 30-02 being replaced)
    - apps/dispatch-control/components/_PlaceholderScreen.tsx (1c styling reference)
  </read_first>
  <files>apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx, apps/dispatch-control/__tests__/how-to-use.test.ts</files>
  <behavior>
    - how-to-use.test.ts (source-scan on page.tsx) asserts all 5 weekly-loop step phrases are present
    - Asserts all 4 color-legend hex+meaning entries are present
    - Asserts all 4 house-rule headlines are present verbatim
  </behavior>
  <action>
    Rewrite `how-to-use/page.tsx` (Server Component) with three 1c-styled sections using Newsreader display headings + Lora body (`font-[family-name:var(--font-body)]`) + the color tokens. Pull the exact wording from `docs/design/dispatch-control-v2/Dispatch Control.dc.html` (`disp_howto`), preserving these verbatim (RESEARCH Code Examples extracted them):

    Weekly loop (5 numbered steps):
    1. "Steer discovery" · Signal Desk
    2. "Watch the run" · Run Monitor
    3. "Clear the facts" · Review Desk
    4. "De-slop it" · Voice Pass
    5. "Improve the machine" · Prompt Lab + Eval Center

    Color legend (4 entries, render a swatch in the actual token color beside each):
    - green `#148a52` = "Verified/cleared — a check ran and passed"
    - vermilion `#e8471d` = "Error/blocking/unsourced — needs you"
    - marigold `#f2b01e` = "Warning/sourced-claim/code gate"
    - cobalt `#253ad4` = "Interactive/links/the current selection"

    House rules (4 headlines, verbatim):
    - "Silence is never 'verified.'"
    - "Nothing silent."
    - "JSON is never the default."
    - "The irreversible ones ask twice."

    Use ONLY 1c token classes (no literal neutral-*/white). Author `__tests__/how-to-use.test.ts` per the behavior block (source-scan via node:fs on the page file).
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test -- --run how-to-use && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "Steer discovery" apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx`
    - `grep -q "Improve the machine" apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx`
    - `grep -q "#148a52" apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx` and `grep -q "#253ad4" apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx`
    - `grep -q "Nothing silent" apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx`
    - `grep -q "The irreversible ones ask twice" apps/dispatch-control/app/(dashboard)/how-to-use/page.tsx`
    - no `neutral-` literal classes in the page
    - how-to-use.test.ts green; `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>How-to-use screen renders the 5 loop steps, 4-entry color legend, and 4 house rules verbatim, 1c-styled; test + build green.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- --run how-to-use` green
- `pnpm --filter dispatch-control build` exits 0
</verification>

<success_criteria>
CHR-03 (How-to-use): weekly loop + color legend + house rules present and faithful to the spec.
</success_criteria>

<output>
After completion, create `.planning/phases/30-foundation-design-system-chrome-awaiting-you-inbox/30-07-SUMMARY.md`
</output>
