---
phase: 28-prompt-console
plan: 02
type: execute
wave: 2
depends_on: [28-01]
files_modified:
  - apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts
  - apps/dispatch-control/app/(dashboard)/prompts/_components/VariableChips.tsx
  - apps/dispatch-control/app/(dashboard)/prompts/_components/AssembledPreview.tsx
  - apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx
  - apps/dispatch-control/__tests__/variableMaps.test.ts
  - apps/dispatch-control/__tests__/assembledPreview.test.ts
autonomous: true
requirements: [PRC-03, PRC-05, PRC-06, PRC-07]
must_haves:
  truths:
    - "The editor shows click-to-insert variable chips with description tooltips for the agent's allowed variables"
    - "An 'assembled with sample values' preview substitutes client-side sample values into the draft instantly with no server call"
    - "A passive 'unused variable' hint flags registry-allowed variables absent from the draft without blocking save"
    - "An in-app unsaved-changes guard (confirm dialog + visible indicator) fires on agentKey switch and view-toggle while the draft is dirty; no native beforeunload"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts"
      provides: "Additive VARIABLE_DESCRIPTIONS + VARIABLE_SAMPLES maps keyed by variable name + findUnusedVariables() — VARIABLE_REGISTRY shape unchanged"
      contains: "VARIABLE_DESCRIPTIONS"
    - path: "apps/dispatch-control/app/(dashboard)/prompts/_components/AssembledPreview.tsx"
      provides: "Client-side str.replace assembled preview using VARIABLE_SAMPLES"
      contains: "assembleWithSamples"
    - path: "apps/dispatch-control/app/(dashboard)/prompts/_components/VariableChips.tsx"
      provides: "Click-to-insert chips with description tooltips + unused-variable hint"
      contains: "descriptionForVariable"
  key_links:
    - from: "AgentPromptEditorView.tsx"
      to: "VariableChips + AssembledPreview"
      via: "render in the editing pane, insert into draft state"
      pattern: "AssembledPreview"
    - from: "AssembledPreview.tsx"
      to: "VARIABLE_SAMPLES"
      via: "assembleWithSamples str.replace substitution"
      pattern: "assembleWithSamples"
---

<objective>
Add the variable-authoring tooling to the editor pane: click-to-insert variable
chips with description tooltips (PRC-05), an instant client-side
"assembled with sample values" preview (PRC-06), a passive "unused variable"
advisory hint (PRC-07), and an in-app unsaved-changes guard (PRC-03).

Purpose: tighten the iterate→preview→edit loop and prevent accidental loss of an
unsaved draft — both voice-drift guardrails.
Output: additive description + sample maps next to VARIABLE_REGISTRY (its
`Record<agentKey, string[]>` shape UNCHANGED), two new components, and the
unsaved guard wired into AgentPromptEditorView. Pure dispatch-control frontend;
the preview makes no server call.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.planning/phases/28-prompt-console/28-CONTEXT.md

<interfaces>
<!-- Existing contracts — VARIABLE_REGISTRY shape MUST NOT change (highlight
     extension + unknown-var save gate depend on Record<agentKey,string[]>). -->

VariableRegistry.ts:
- VARIABLE_REGISTRY: Record<string, string[]>   // allowed {tokens} per agentKey
- findUnknownVariables(text, allowed): string[]  // existing save-gate driver — DO NOT change

PromptEditor.tsx props (controlled): { value, onChange, allowedVariables, agentKey,
  workspaceId, createdBy, onSaved }. It computes findUnknownVariables(value, allowedVariables)
  live and DISABLES "Save as new version" when unknown tokens exist (Phase 24 PRM-02 gate —
  this stays the ONLY gate; PRC-07 unused hint is advisory only).

AgentPromptEditorView.tsx (after Plan 01): has `draft`/`setDraft`, `editing`/`setEditing`,
  `seeded`, the agentKey-switch reset effect, and renders PromptEditor + TestRunPanel in the
  editing branch. allowedVariables = VARIABLE_REGISTRY[agentKey] ?? []. active = getActive(...).

Token substitution is `str.replace("{token}", value)`, NOT str.format() — preserve in the
assembled-preview substitution (D-14, brand-agnostic, readability aid not execution).
</interfaces>

@apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts
@apps/dispatch-control/app/(dashboard)/prompts/_components/PromptEditor.tsx
@apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Variable description + sample maps + assembled preview (PRC-05/06/07 data layer)</name>
  <files>apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts, apps/dispatch-control/app/(dashboard)/prompts/_components/AssembledPreview.tsx, apps/dispatch-control/__tests__/variableMaps.test.ts, apps/dispatch-control/__tests__/assembledPreview.test.ts</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts (the full union of variable names across VARIABLE_REGISTRY values; findUnknownVariables pattern)
    - packages/pipeline/src/eisenbalm_pipeline/api/agents.py (SAMPLE_FIXTURES — reference for realistic sample values; do NOT import — client-side map only, D-14)
  </read_first>
  <action>
    (A) Append to VariableRegistry.ts (ADDITIVE — do NOT change VARIABLE_REGISTRY's
        Record<agentKey,string[]> shape or findUnknownVariables):
      - `VARIABLE_DESCRIPTIONS: Record<string, string>` keyed by VARIABLE NAME (DRY,
        D-13). Cover every distinct token name across VARIABLE_REGISTRY values:
        VOICE_CONSTRAINTS, FORBIDDEN_CONSTRUCTS, STRUCTURE_CONTRACT,
        EDITOR_INTERRUPT_THRESHOLD, EDITOR_CONFIDENCE_THRESHOLD, issue_number,
        previous_bonus_types, chosen_bonus_type, featured_keys, charity_name,
        mission_statement, visual_direction, display_list, body_list, results_block,
        candidates_json, candidates_block, qa_corrections_json, section_headlines_json,
        charity. One short phrase each.
      - `VARIABLE_SAMPLES: Record<string, string>` keyed by variable name — a realistic
        sample value per token (charity_name: "The Quiet Foundation"; issue_number: "42";
        VOICE_CONSTRAINTS: a one-line voice reminder; etc.). Brand-agnostic illustrative
        values (mirror the spirit of server SAMPLE_FIXTURES but as per-VARIABLE strings).
      - `descriptionForVariable(name: string): string` → `VARIABLE_DESCRIPTIONS[name] ?? ''`.
      - `findUnusedVariables(text: string, allowed: string[]): string[]` → the `allowed`
        variables that DO NOT appear as `{name}` in `text` (complement of findUnknownVariables;
        PRC-07 advisory). Deterministic, first-seen order of `allowed`.
      - Unit test `apps/dispatch-control/__tests__/variableMaps.test.ts`: assert the union of
        all names across VARIABLE_REGISTRY values is a SUBSET of keys(VARIABLE_DESCRIPTIONS)
        AND keys(VARIABLE_SAMPLES) (every used variable has a description + sample); and
        `findUnusedVariables('uses {a}', ['a','b'])` deep-equals `['b']`.

    (B) Create AssembledPreview.tsx (new client component):
      - Export `assembleWithSamples(draft: string, allowed: string[]): string` — substitute
        each allowed variable's sample via the canonical replace-all chain:
        `let out = draft; for (const name of allowed) out = out.split('{'+name+'}').join(VARIABLE_SAMPLES[name] ?? '{'+name+'}'); return out;`
        (split/join emulates str.replace-all; NEVER str.format; D-14. Absent sample leaves
        the placeholder intact.)
      - Component props `{ draft: string; allowed: string[] }`: render a collapsible
        ("Assembled preview (sample values)") read-only `<pre>` of
        `assembleWithSamples(draft, allowed)`. Mono, neutral card, max-h scroll. Label it a
        readability aid, NOT a test-run. No fetch, no server call.
      - Unit test `apps/dispatch-control/__tests__/assembledPreview.test.ts`: assert
        `assembleWithSamples('Hi {charity_name}', ['charity_name'])` contains
        VARIABLE_SAMPLES['charity_name'] and no longer contains the literal `{charity_name}`;
        and a draft with an unrelated literal `{` is left intact.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control test -- variableMaps assembledPreview && grep -q "VARIABLE_DESCRIPTIONS" "apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts"</automated>
  </verify>
  <acceptance_criteria>
    - VARIABLE_REGISTRY declaration unchanged: grep for `export const VARIABLE_REGISTRY: Record<string, string[]>` still matches.
    - variableMaps test asserts every used variable name is in keys(VARIABLE_DESCRIPTIONS) and keys(VARIABLE_SAMPLES).
    - `findUnusedVariables('uses {a}', ['a','b'])` equals `['b']` (test asserts).
    - assembledPreview test: substituted output contains the sample value and not the raw `{charity_name}`.
    - `grep -q "assembleWithSamples" AssembledPreview.tsx` succeeds.
  </acceptance_criteria>
  <done>Variable description + sample maps added additively (VARIABLE_REGISTRY shape untouched, tested coverage); findUnusedVariables + assembleWithSamples implemented with str.replace-equivalent substitution and passing unit tests.</done>
</task>

<task type="auto">
  <name>Task 2: Variable chips (click-to-insert + tooltips + unused hint)</name>
  <files>apps/dispatch-control/app/(dashboard)/prompts/_components/VariableChips.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts (descriptionForVariable, findUnusedVariables — from Task 1)
    - apps/dispatch-control/app/(dashboard)/prompts/_components/PromptEditor.tsx (the existing known-variable chip styling to stay consistent)
  </read_first>
  <action>
    Create VariableChips.tsx (new client component):
      - Props: `{ allowed: string[]; draft: string; onInsert: (token: string) => void }`.
      - For each `name` in `allowed`, render a button chip labeled `{name}` that calls
        `onInsert('{'+name+'}')`. The chip carries the description via a native
        `title={descriptionForVariable(name)}` attribute AND an `aria-label` of the same,
        so the tooltip is accessible without a new dependency. (PRC-05)
      - Compute `unused = findUnusedVariables(draft, allowed)`. Chips whose name is in
        `unused` get a passive visual hint (dashed border + muted text) — non-blocking,
        advisory (PRC-07). Render a one-line muted note when `unused` is non-empty:
        "Allowed but not used: {comma-joined list}". This is NOT a save gate (the Phase 24
        unknown-var gate in PromptEditor stays the only gate).
      - When `allowed` is empty, render nothing (or a muted "no variables" note).
      - min-h-[44px] on the chip buttons, focus-visible:ring-2 ring-neutral-400. No new npm deps.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && grep -q "descriptionForVariable" "apps/dispatch-control/app/(dashboard)/prompts/_components/VariableChips.tsx" && grep -q "findUnusedVariables" "apps/dispatch-control/app/(dashboard)/prompts/_components/VariableChips.tsx"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "onInsert" VariableChips.tsx` succeeds (click-to-insert callback present).
    - `grep -q "title=" VariableChips.tsx` succeeds (description tooltip).
    - `grep -q "Allowed but not used" VariableChips.tsx` succeeds (unused advisory).
    - `grep -q "findUnusedVariables" VariableChips.tsx` succeeds (advisory, not a gate — no findUnknownVariables save-disable logic added here).
  </acceptance_criteria>
  <done>VariableChips renders click-to-insert chips with accessible description tooltips and a passive unused-variable hint; no save gating added.</done>
</task>

<task type="auto">
  <name>Task 3: Wire chips + assembled preview into the editor + in-app unsaved-changes guard</name>
  <files>apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx (draft/setDraft, editing/setEditing, the agentKey-switch reset effect, the editing branch that renders PromptEditor + TestRunPanel; active.content from getActive)
    - apps/dispatch-control/app/(dashboard)/prompts/_components/VariableChips.tsx + AssembledPreview.tsx (from Tasks 1-2)
  </read_first>
  <action>
    Extend AgentPromptEditorView.tsx. PRESERVE all existing behavior from Plan 01
    (description, drift badge, marker export, getActive, PromptEditor, TestRunPanel,
    VersionHistoryPanel, loading skeleton).

    1) In the EDITING branch, above PromptEditor, render
       `<VariableChips allowed={allowedVariables} draft={draft} onInsert={(t) => setDraft(d => d + t)} />`
       (append-at-end insertion is acceptable for PRC-05 — CodeMirror cursor insertion is
       optional polish). Below PromptEditor (or below TestRunPanel), render
       `<AssembledPreview draft={draft} allowed={allowedVariables} />`. (PRC-05/06/07)

    2) In-app unsaved-changes guard (PRC-03 — NO native beforeunload):
       - Compute `dirty = active != null ? draft !== active.content : draft.trim().length > 0`
         (the draft diverges from the active version, or, for an unseeded key, has content).
       - Visible indicator: when `dirty`, show an "unsaved changes" pill near the metadata
         line in the editing state.
       - Confirm on TWO transitions:
         (a) View toggle: the existing "Done / View" button — when `dirty`, call
             `window.confirm('You have unsaved changes. Leave the editor?')` and only
             `setEditing(false)` if confirmed.
         (b) agentKey switch: the existing reset effect runs on `[agentKey]`. Guard the
             reset with the same confirm — capture the previous agentKey in a ref; when it
             changes AND the prior draft was dirty, `window.confirm(...)` before clearing
             (if declined, the executor may simply proceed with the reset since the route
             already navigated — the requirement is the CONFIRM fires; document the chosen
             behavior in the SUMMARY). Use a plain `window.confirm` (in-app, synchronous,
             not the native `beforeunload` handler). Do NOT register a `beforeunload` listener.
       - Keep the confirm copy short and operator-facing.

    No new npm deps.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "VariableChips" AgentPromptEditorView.tsx` and `grep -q "AssembledPreview" AgentPromptEditorView.tsx` succeed.
    - `grep -q "unsaved changes" AgentPromptEditorView.tsx` succeeds (visible indicator).
    - `grep -q "window.confirm" AgentPromptEditorView.tsx` succeeds AND `grep -q "beforeunload" AgentPromptEditorView.tsx` FAILS (no native guard, D-11).
    - Existing PromptEditor + TestRunPanel + VersionHistoryPanel usages remain (grep all three).
    - `pnpm --filter dispatch-control build` (strict) passes.
  </acceptance_criteria>
  <done>The editing pane shows click-to-insert chips + an instant assembled-with-samples preview + a passive unused-variable hint; a window.confirm-based unsaved guard with a visible indicator fires on view-toggle and agentKey switch; no beforeunload; strict build passes.</done>
</task>

</tasks>

<verification>
- `pnpm --filter dispatch-control test -- variableMaps assembledPreview` passes (coverage + substitution correctness).
- `pnpm --filter dispatch-control build` (strict) passes.
- `grep beforeunload` over the prompts/_components dir returns nothing (D-11 honored).
- Manual sanity: editing a prompt shows chips (with tooltips + unused tags), an assembled preview, and a confirm + indicator when leaving with a dirty draft.
</verification>

<success_criteria>
- PRC-05: click-to-insert chips with description tooltips, sourced from the variable-name-keyed map; VARIABLE_REGISTRY shape unchanged.
- PRC-06: assembled-with-sample-values preview substitutes client-side (str.replace-equiv), no server call.
- PRC-07: passive unused-variable hint, advisory only (Phase 24 unknown-var gate stays the only gate).
- PRC-03: in-app confirm + visible indicator on dirty view-toggle / agentKey switch; no beforeunload.
</success_criteria>

<output>
After completion, create `.planning/phases/28-prompt-console/28-02-SUMMARY.md`
</output>
