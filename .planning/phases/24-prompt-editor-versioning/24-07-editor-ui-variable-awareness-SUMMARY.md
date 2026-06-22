---
phase: 24-prompt-editor-versioning
plan: 07
subsystem: dispatch-control-ui
tags: [codemirror, prompt-editor, variable-highlight, versioning, prm-01, prm-02, prm-03, prm-06]
requires:
  - "24-01: dispatch-control vitest scaffold (VariableRegistry/PromptEditor RED tests)"
  - "24-02: promptVersions.saveVersion/listForAgent/getActive (deployed)"
provides:
  - "First write-capable UI surface: /prompts route + per-agent CodeMirror editor"
  - "VARIABLE_REGISTRY (per-agent allowed {tokens}) + findUnknownVariables"
  - "CM6 variableHighlighter (cm-var-known / cm-var-unknown)"
  - "PromptSaveDialog wired to promptVersions.saveVersion (immutable versioning)"
  - "VersionHistoryPanel (listForAgent) with rollback mount point for Plan 08"
affects:
  - "24-08 (diff/rollback/test-run UI): mounts DiffViewer + activate/test-run into the version history + editor page"
tech-stack:
  added:
    - "@uiw/react-codemirror@4.25.10, @codemirror/state, @codemirror/view, @codemirror/lang-markdown, diff@9.0.0"
    - "esbuild-free TS-compiler require shim for vitest (typescript transpileModule)"
  patterns:
    - "next/dynamic ssr:false wrapper for CodeMirror (Pattern 1)"
    - "CM6 StateField decoration highlighter rebuilt on docChanged (Pattern 2)"
    - "useMemo'd extensions keyed on allowedVariables to avoid stale closure on agent switch (Pitfall 1)"
    - "Unknown-variable save-block gate (PRM-02)"
key-files:
  created:
    - "apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts"
    - "apps/dispatch-control/app/(dashboard)/prompts/_components/variableHighlightExtension.ts"
    - "apps/dispatch-control/app/(dashboard)/prompts/_components/PromptEditor.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompts/_components/_CodeMirrorInner.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompts/_components/PromptSaveDialog.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompts/_components/VersionHistoryPanel.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx"
    - "apps/dispatch-control/app/(dashboard)/prompts/_components/agentList.ts"
    - "apps/dispatch-control/app/(dashboard)/prompts/[agentKey]/page.tsx"
    - "apps/dispatch-control/__tests__/registerTsRequire.ts"
  modified:
    - "apps/dispatch-control/app/(dashboard)/prompts/page.tsx"
    - "apps/dispatch-control/app/globals.css"
    - "apps/dispatch-control/package.json"
    - "apps/dispatch-control/vitest.config.ts"
    - "apps/dispatch-control/__tests__/PromptEditor.test.tsx"
decisions:
  - "Executor agent dropped on a connection error after building all components but before any commit. Work recovered inline by the orchestrator: verified, fixed test infra, committed in 4 task-aligned commits."
  - "Wave 0 require-shim rewritten from esbuild to the TypeScript compiler (ts.transpileModule): esbuild's native bridge throws under jsdom/edge-runtime (TextEncoder invariant). Added Module._resolveFilename alias resolution for @convex/* and @/* (tsconfig paths the raw CJS require ignores)."
  - "Fixed an invalid-JSX defect in the 24-01 PromptEditor scaffold (`<PromptEditor!>` — non-null assertion in tag position never compiles) by aliasing the guarded var to a capitalized const. Behavior-preserving."
checkpoints:
  - type: human-verify
    task: 4
    resolution: "Andrew ran dispatch-control locally (after Clerk app provisioning), confirmed the /prompts agent list, CodeMirror render, known/unknown {variable} highlight, unknown-var save-block, and voice_constraints editability. Approved 2026-06-22."
metrics:
  completed: "2026-06-22"
  tasks: 4
  files: 15
---

# Phase 24 Plan 07: Editor UI + Variable Awareness Summary

## What shipped

The first write-capable UI surface in dispatch-control — the `/prompts` console:

- **Task 1** — CodeMirror stack pinned; `VARIABLE_REGISTRY` (per-agent allowed `{tokens}`, advocate `[]`) + `findUnknownVariables`; CM6 `variableHighlighter` StateField marking `.cm-var-known` / `.cm-var-unknown`, rebuilt on docChanged; scoped `globals.css` styles.
- **Task 2** — `PromptEditor` (next/dynamic ssr:false, live `findUnknownVariables` gate disabling save on unknown tokens), `_CodeMirrorInner` (useMemo'd extensions), `PromptSaveDialog` (`useMutation(promptVersions.saveVersion)`).
- **Task 3** — data-driven agent selector (topology + registry keys, no hardcoded labels), `[agentKey]` page loads `getActive` into the editor with registry `allowedVariables`, `VersionHistoryPanel` (`listForAgent`, newest-first, isActive badge, rollback mount point for Plan 08).
- **Task 4 (human-verify checkpoint)** — Andrew verified in-browser after provisioning Clerk. Approved.

## Verification

- `VariableRegistry.test.ts` + `PromptEditor.test.tsx` GREEN.
- Full dispatch-control suite: 71 passed, 0 regressions to the pre-existing 59 (DiffViewer.test.tsx remains RED — that's Plan 08's component).
- `tsc --noEmit`: 0 errors.
- Human visual verification: approved (agent list, CodeMirror render, known/unknown highlight, save-block gate, voice_constraints editable).

## Recovery note

The executor agent lost its connection after ~54 min, having written all components but committed nothing. The orchestrator recovered the uncommitted work inline: it diagnosed and fixed a broken esbuild-based vitest require shim (rewrote to the pure-JS TypeScript compiler so it works in jsdom/edge-runtime), added tsconfig path-alias resolution, fixed an invalid-JSX scaffold defect, verified everything green + tsc-clean, and committed in four task-aligned commits plus a test-infra commit.

## Deferred (not blocking)

- Live `prompt_versions` seeding hit a 401 (stale `CONVEX_DEPLOY_KEY` in `packages/pipeline/.env`). The editor verifies without seeded content; seeding + key refresh is a go-live follow-up.
