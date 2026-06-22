---
phase: 24-prompt-editor-versioning
plan: 07
type: execute
wave: 3
depends_on: [24-01, 24-02]
files_modified:
  - apps/dispatch-control/package.json
  - apps/dispatch-control/app/(dashboard)/prompts/page.tsx
  - apps/dispatch-control/app/(dashboard)/prompts/[agentKey]/page.tsx
  - apps/dispatch-control/app/(dashboard)/prompts/_components/PromptEditor.tsx
  - apps/dispatch-control/app/(dashboard)/prompts/_components/_CodeMirrorInner.tsx
  - apps/dispatch-control/app/(dashboard)/prompts/_components/variableHighlightExtension.ts
  - apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts
  - apps/dispatch-control/app/(dashboard)/prompts/_components/PromptSaveDialog.tsx
  - apps/dispatch-control/app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx
  - apps/dispatch-control/app/globals.css
autonomous: false
requirements: [PRM-01, PRM-02, PRM-03, PRM-06]
must_haves:
  truths:
    - "Operator can open an agent, edit its system prompt and user-prompt template in a CodeMirror editor"
    - "Known {variable} tokens highlight distinctly from unknown/mangled ones; unknown tokens block save with a warning"
    - "Saving creates a new immutable version (author + timestamp + optional note); prior versions are never overwritten"
    - "VOICE_CONSTRAINTS appears as an editable agent entry in the same editor"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/prompts/_components/PromptEditor.tsx"
      provides: "CodeMirror editor with variable highlight + save flow"
      contains: "use client"
    - path: "apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts"
      provides: "Per-agent allowed-variable map + findUnknownVariables"
      contains: "VARIABLE_REGISTRY"
  key_links:
    - from: "PromptSaveDialog"
      to: "convex promptVersions.saveVersion"
      via: "useMutation"
      pattern: "saveVersion"
    - from: "variableHighlightExtension"
      to: "VariableRegistry allowed vars"
      via: "useMemo-rebuilt extension"
      pattern: "variableHighlighter"
---

<objective>
Replace the prompts placeholder with the real editor. Install CodeMirror, build the
`{variable}`-aware editor (known vs unknown/mangled highlight + pre-save unknown-variable warning),
the per-agent variable registry, the version-history list, and the save-as-new-version flow wired to
`promptVersions.saveVersion`. VOICE_CONSTRAINTS appears as one of the editable agents.

Purpose: PRM-01 (edit system + user template), PRM-02 (variable highlight + warn), PRM-03 (immutable
save-as-version), PRM-06 (voice editable in the same surface).
Output: prompts route + 7 client components + globals.css highlight styles; Plan-01 VariableRegistry +
PromptEditor tests GREEN.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/24-prompt-editor-versioning/24-CONTEXT.md
@.planning/phases/24-prompt-editor-versioning/24-RESEARCH.md
@apps/dispatch-control/app/(dashboard)/prompts/page.tsx
@apps/dispatch-control/app/(dashboard)/graph/_components/AgentIOPanel.tsx

<interfaces>
Convex (Plan 02): promptVersions.saveVersion(workspace_id, agentKey, content, createdBy?, note?),
  listForAgent(workspace_id, agentKey), getActive(workspace_id, agentKey), getByVersion(...).
Convex client in dispatch-control: useQuery/useMutation from 'convex/react' with api from @eisenbalm/convex.
RESEARCH Pattern 1 (next/dynamic ssr:false wrapper), Pattern 2 (StateField {variable} highlighter),
  Pattern 8 (VariableRegistry exact agentKey→vars map), Pitfall 1 (useMemo to avoid stale closure on agent switch).
Packages to install (RESEARCH Standard Stack): @uiw/react-codemirror@4.25.10, @codemirror/state@6.6.0,
  @codemirror/view@6.43.1, @codemirror/lang-markdown@6.5.0, diff@9.0.0, -D @types/diff.
workspace_id is the string "eisenbalm".
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install CodeMirror deps + build VariableRegistry + highlight extension</name>
  <files>apps/dispatch-control/package.json, apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts, apps/dispatch-control/app/(dashboard)/prompts/_components/variableHighlightExtension.ts, apps/dispatch-control/app/globals.css</files>
  <read_first>
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (Standard Stack versions; Pattern 2 highlight code; Pattern 8 complete variable map incl. the advocate row resolved in Plan 06 backend reads)
    - packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py (CONFIRM advocate has NO .replace tokens — registry entry empty, per RESEARCH Open Question 1)
    - apps/dispatch-control/app/globals.css (where to add scoped CodeMirror styles)
  </read_first>
  <action>
    Install exact versions (cd apps/dispatch-control): @uiw/react-codemirror@4.25.10 @codemirror/state@6.6.0
    @codemirror/view@6.43.1 @codemirror/lang-markdown@6.5.0 diff@9.0.0 and -D @types/diff. Pin in package.json.

    VariableRegistry.ts: export `VARIABLE_REGISTRY: Record<string, string[]>` with the exact map from
    RESEARCH Pattern 8 (calibrator: VOICE_CONSTRAINTS, issue_number, previous_bonus_types, chosen_bonus_type;
    scout: featured_keys; editor_gate1: VOICE_CONSTRAINTS, EDITOR_INTERRUPT_THRESHOLD, EDITOR_CONFIDENCE_THRESHOLD;
    editor_final/researcher: VOICE_CONSTRAINTS; game: charity_name, VOICE_CONSTRAINTS, FORBIDDEN_CONSTRUCTS;
    design: display_list, body_list; bonus_*: VOICE_CONSTRAINTS, STRUCTURE_CONTRACT; advocate: []; section
    guidance keys + rubric + voice_constraints: []). Also map the `*_user` keys to the SAME token sets their
    system prompts use where the user template carries those tokens (per the tokens captured in Plan 04).
    Export `findUnknownVariables(text: string, allowed: string[]): string[]` scanning `/\{([^}]+)\}/g`,
    returning trimmed token names NOT in allowed (dedup).

    variableHighlightExtension.ts: implement the CM6 StateField + Decoration highlighter from RESEARCH
    Pattern 2 — `variableHighlighter(allowedVars: string[])` returning a StateField that marks known vars
    `.cm-var-known` and unknown `.cm-var-unknown`. Rebuild decorations on docChanged.

    globals.css: add `.cm-var-known { color:#166534; text-decoration:underline; }` and
    `.cm-var-unknown { color:#991b1b; text-decoration: underline wavy; }` scoped under the editor wrapper.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/VariableRegistry.test.ts 2>&1 | grep -Eq "passed|PASS" && echo REGISTRY_GREEN</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/__tests__/VariableRegistry.test.ts` PASSES
    - `grep -q "@uiw/react-codemirror" apps/dispatch-control/package.json` and `grep -q '"diff"' apps/dispatch-control/package.json`
    - `grep -q "VARIABLE_REGISTRY" apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts` and `grep -q "findUnknownVariables" .../VariableRegistry.ts`
    - `grep -q "cm-var-unknown" apps/dispatch-control/app/globals.css`
    - advocate registry entry is `[]` (empty array) per source confirmation
  </acceptance_criteria>
  <done>CodeMirror installed; variable registry + highlighter built; registry test green.</done>
</task>

<task type="auto">
  <name>Task 2: Build the CodeMirror editor (SSR-safe) + save-as-version flow</name>
  <files>apps/dispatch-control/app/(dashboard)/prompts/_components/PromptEditor.tsx, apps/dispatch-control/app/(dashboard)/prompts/_components/_CodeMirrorInner.tsx, apps/dispatch-control/app/(dashboard)/prompts/_components/PromptSaveDialog.tsx</files>
  <read_first>
    - .planning/phases/24-prompt-editor-versioning/24-RESEARCH.md (Pattern 1 dynamic ssr:false; Pattern 2 pre-save warning gate; Pitfall 1 useMemo)
    - apps/dispatch-control/app/(dashboard)/graph/_components/AgentIOPanel.tsx (existing convex useQuery/useMutation + panel style to match)
    - apps/dispatch-control/__tests__/PromptEditor.test.tsx (the smoke test to satisfy)
  </read_first>
  <action>
    _CodeMirrorInner.tsx ('use client'): wrap `@uiw/react-codemirror` with
    `extensions={useMemo(() => [markdown(), variableHighlighter(allowedVariables)], [allowedVariables])}`
    (Pitfall 1). Props: value, onChange, allowedVariables.

    PromptEditor.tsx ('use client'): dynamic-import _CodeMirrorInner with `{ ssr:false, loading: <skeleton> }`
    (Pattern 1). Holds local draft state (value). Computes `unknown = findUnknownVariables(value, allowed)`
    live; renders a warning banner listing unknown tokens when non-empty. Renders a "Save as new version"
    button that is DISABLED when `unknown.length > 0` (PRM-02 save-blocking gate). Accepts props:
    agentKey, allowedVariables, initialContent.

    PromptSaveDialog.tsx ('use client'): a note input + confirm; on confirm calls
    `useMutation(api.promptVersions.saveVersion)({ workspace_id:'eisenbalm', agentKey, content, createdBy:<clerk id or undefined>, note })`.
    On success, refresh the version list and clear the dirty flag. saveVersion never overwrites (Plan 02).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx vitest run __tests__/PromptEditor.test.tsx 2>&1 | grep -Eq "passed|PASS" && echo EDITOR_GREEN</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/__tests__/PromptEditor.test.tsx` PASSES
    - `grep -q "ssr: false\|ssr:false" apps/dispatch-control/app/(dashboard)/prompts/_components/PromptEditor.tsx`
    - `grep -q "useMemo" apps/dispatch-control/app/(dashboard)/prompts/_components/_CodeMirrorInner.tsx` (stale-closure guard)
    - `grep -q "findUnknownVariables" apps/dispatch-control/app/(dashboard)/prompts/_components/PromptEditor.tsx` and the save button is gated on unknown.length
    - `grep -q "saveVersion" apps/dispatch-control/app/(dashboard)/prompts/_components/PromptSaveDialog.tsx`
  </acceptance_criteria>
  <done>SSR-safe CodeMirror editor with variable-aware save gate + save-as-version wired.</done>
</task>

<task type="auto">
  <name>Task 3: Prompts route — agent list, per-agent editor page, version history</name>
  <files>apps/dispatch-control/app/(dashboard)/prompts/page.tsx, apps/dispatch-control/app/(dashboard)/prompts/[agentKey]/page.tsx, apps/dispatch-control/app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompts/page.tsx (placeholder being replaced)
    - apps/dispatch-control/app/(dashboard)/graph/_components/pipelineTopology.ts (canonical agent list to enumerate the editor's left nav — reuse, do NOT hardcode a new list)
    - apps/dispatch-control/app/(dashboard)/settings/_components/AuditLogViewer.tsx (read pattern to mirror for the version list)
  </read_first>
  <action>
    prompts/page.tsx: render the agent selector — list every editable agentKey (system-prompt agents +
    `*_user` templates + section-guidance keys + `rubric` + `voice_constraints`), each linking to
    `/prompts/[agentKey]`. Source the agent set from the canonical topology + the registry keys (brand-agnostic,
    data-driven — no Eisenbalm-hardcoded labels per CONTEXT specifics).

    prompts/[agentKey]/page.tsx: load the active version via `useQuery(api.promptVersions.getActive, {workspace_id:'eisenbalm', agentKey})`,
    pass its content as initialContent to PromptEditor with `allowedVariables = VARIABLE_REGISTRY[agentKey] ?? []`.
    Render VersionHistoryPanel alongside.

    VersionHistoryPanel.tsx ('use client'): `useQuery(api.promptVersions.listForAgent, ...)` → render
    versions newest-first with version number, author, timestamp, note, and an isActive badge. (Diff +
    activate/rollback controls are added by Plan 08 — leave a clearly-marked mount point for them.)
  </action>
  <verify>
    <automated>cd apps/dispatch-control && npx tsc --noEmit 2>&1 | tail -5; cd apps/dispatch-control && npx vitest run __tests__/PromptEditor.test.tsx __tests__/VariableRegistry.test.ts 2>&1 | grep -Eq "passed|PASS" && echo UI_GREEN</automated>
  </verify>
  <acceptance_criteria>
    - `cd apps/dispatch-control && npx tsc --noEmit` reports no errors in the prompts route files
    - prompts/page.tsx no longer contains "coming in Phase 24" (`grep -c "coming in Phase 24" apps/dispatch-control/app/(dashboard)/prompts/page.tsx` returns 0)
    - `grep -q "listForAgent" apps/dispatch-control/app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx`
    - `grep -q "getActive" apps/dispatch-control/app/(dashboard)/prompts/[agentKey]/page.tsx`
    - PromptEditor + VariableRegistry tests still PASS
  </acceptance_criteria>
  <done>Prompts route live with agent list, editor page, and version history (rollback mount point ready).</done>
</task>

</tasks>

<verification>
- CodeMirror editor renders SSR-safe; variable highlight + unknown-var save gate work; save-as-version wired.
- VOICE_CONSTRAINTS + all externalized assets appear as editable agents.
</verification>

<success_criteria>
PRM-01/02/03/06 UI surface exists: operator edits any prompt/template/voice with variable awareness
and immutable versioning.
</success_criteria>

<output>
After completion, create `.planning/phases/24-prompt-editor-versioning/24-07-SUMMARY.md`
</output>
