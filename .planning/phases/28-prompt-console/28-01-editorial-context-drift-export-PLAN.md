---
phase: 28-prompt-console
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/dispatch-control/app/(dashboard)/prompts/_components/agentList.ts
  - apps/dispatch-control/app/(dashboard)/prompts/_components/PromptsListClient.tsx
  - apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx
  - apps/dispatch-control/app/(dashboard)/prompts/_components/promptDescriptions.ts
  - apps/dispatch-control/app/(dashboard)/prompts/_components/PromptMarkerExport.tsx
  - convex/promptVersions.ts
  - apps/dispatch-control/__tests__/promptDescriptions.test.ts
  - apps/dispatch-control/__tests__/markerExport.test.ts
autonomous: true
requirements: [PRC-01, PRC-02, PRC-04, PRC-10]
must_haves:
  truths:
    - "Every editable prompt card and the detail pane show the agent's editorial role/description"
    - "A drift badge marks prompts whose active content differs from the seeded v1, on both list cards and detail pane"
    - "The prompt list is filterable by name text, by group, and by drift"
    - "The detail pane has a copyable export rendering the active content wrapped in exact <!-- PROMPT START/END --> markers"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/prompts/_components/promptDescriptions.ts"
      provides: "Brand-agnostic descriptions map keyed by agentKey covering all editable keys + descriptionFor() lookup"
      contains: "PROMPT_DESCRIPTIONS"
    - path: "convex/promptVersions.ts"
      provides: "Additive listSeedV1ForWorkspace query returning v1 content per agentKey for drift compare"
      contains: "listSeedV1ForWorkspace"
    - path: "apps/dispatch-control/app/(dashboard)/prompts/_components/PromptMarkerExport.tsx"
      provides: "Copyable .md-marker export component rendering exact PROMPT START/END byte form"
      contains: "<!-- PROMPT START -->"
  key_links:
    - from: "PromptsListClient.tsx"
      to: "api.promptVersions.listSeedV1ForWorkspace"
      via: "useQuery (drift compare against listActiveForWorkspace)"
      pattern: "listSeedV1ForWorkspace"
    - from: "PromptsListClient.tsx"
      to: "promptDescriptions.descriptionFor"
      via: "import + render on card"
      pattern: "descriptionFor"
---

<objective>
Add the editorial-context + safety + source-of-truth surfaces to the existing
view-first `/prompts` console: per-key editorial descriptions on cards and the
detail pane (PRC-01), an "edited since seed" drift badge on both (PRC-02),
list search/filter by name+group+drift (PRC-04), and a copyable `.md`-marker
export of the active version for copy→commit (PRC-10).

Purpose: voice-drift guardrails — Andrew sees what each prompt is for, which
prompts have diverged from their seed, and can keep the git fallback current.
Output: a descriptions map, a drift Convex query, an export component, and the
enhanced list + detail surfaces. Pure dispatch-control frontend + one additive
Convex query. No backend pipeline changes.
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
<!-- Existing contracts the executor MUST use directly — do not change shapes. -->

agentList.ts (apps/.../prompts/_components/agentList.ts) — DO NOT change existing exports:
- listEditableAgentKeys(): string[]   // authoritative editable set, sorted
- groupForAgentKey(key): EditableAgentGroup  // 'system'|'user-template'|'section-guidance'|'asset'
- GROUP_LABELS: Record<EditableAgentGroup, string>
- humanizeAgentKey(key): string

VariableRegistry.ts:
- VARIABLE_REGISTRY: Record<string, string[]>   // keys() === full editable agentKey set

convex/promptVersions.ts (existing — additive only per docs/API_CONTRACTS.md):
- listActiveForWorkspace({ workspace_id }) → { agentKey, version, content, updatedAt }[]
- getActive({ workspace_id, agentKey }) → active row | null
- getByVersion({ workspace_id, agentKey, version }) → row | null   // index by_workspace_agentKey_version
- The Phase 22 seed wrote each key's v1 via upsertActive (version stays 1). saveVersion increments
  and never overwrites, so the v1 row PERSISTS and is the canonical seed for drift compare.

workspace.ts: DEFAULT_WORKSPACE_ID = 'eisenbalm'; getCurrentWorkspace(): Promise<string>

Pipeline marker convention (packages/.../lib/prompts.py _extract): content lives between
`<!-- PROMPT START -->` and `<!-- PROMPT END -->`; _extract strips exactly ONE leading newline
after START and ONE trailing newline before END. So the round-trippable byte form is:
  `<!-- PROMPT START -->\n` + <active content verbatim> + `\n<!-- PROMPT END -->`
</interfaces>

@apps/dispatch-control/app/(dashboard)/prompts/_components/PromptsListClient.tsx
@apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx
@apps/dispatch-control/app/(dashboard)/prompts/_components/agentList.ts
@convex/promptVersions.ts
</context>

<tasks>

<task type="auto">
  <name>Task 1: Descriptions map + drift Convex query + marker-export component</name>
  <files>apps/dispatch-control/app/(dashboard)/prompts/_components/promptDescriptions.ts, apps/dispatch-control/app/(dashboard)/prompts/_components/PromptMarkerExport.tsx, convex/promptVersions.ts, apps/dispatch-control/__tests__/promptDescriptions.test.ts, apps/dispatch-control/__tests__/markerExport.test.ts</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompts/_components/agentList.ts (humanizeAgentKey, groupForAgentKey, listEditableAgentKeys)
    - apps/dispatch-control/app/(dashboard)/prompts/_components/VariableRegistry.ts (VARIABLE_REGISTRY keys = full editable set)
    - convex/promptVersions.ts (listActiveForWorkspace + getByVersion patterns — copy the by_workspace index pattern)
    - packages/pipeline/src/eisenbalm_pipeline/lib/prompts.py (the _extract marker/newline contract the export must satisfy)
  </read_first>
  <action>
    Create THREE artifacts.

    (A) `promptDescriptions.ts` (new, next to agentList.ts):
      - Export `PROMPT_DESCRIPTIONS: Record<string, string>` — a brand-agnostic
        editorial role/description for EVERY editable key (cover the full
        `Object.keys(VARIABLE_REGISTRY)` set: system-prompt agents, every `*_user`
        template, the six section-guidance keys
        (origin_story/problem/founder_bio_verified/founder_bio_anonymous/case_study_verified/case_study_anonymous),
        and the two assets `rubric` + `voice_constraints`). One sentence each,
        describing WHAT the prompt controls (e.g. rubric: "The voice rubric the QA
        judge scores section bodies against."; calibrator: "Sets the style brief
        and bonus type for the issue."). Keep brand-agnostic phrasing.
      - Export `descriptionFor(agentKey: string): string` → returns
        `PROMPT_DESCRIPTIONS[agentKey] ?? ''` (empty string for unknown keys, never throws).
      - Add a unit test `apps/dispatch-control/__tests__/promptDescriptions.test.ts`
        asserting `Object.keys(PROMPT_DESCRIPTIONS)` is a SUPERSET of
        `Object.keys(VARIABLE_REGISTRY)` (uniform coverage, D-09 "no half-covered keys")
        and every value is a non-empty string.

    (B) Additive Convex query `listSeedV1ForWorkspace` appended to convex/promptVersions.ts
        (DO NOT modify/rename existing exports — additive only):
      - args: `{ workspace_id: v.string() }`
      - Collect rows via `by_workspace` index, keep only `version === 1`, return one
        compact row per agentKey: `{ agentKey, content }[]` (the seed content).
      - This is the drift oracle: a key has drifted when its active content
        (listActiveForWorkspace) !== its v1 seed content (this query). Content-compare,
        exact even after rollback re-activates v1 (D-10).
      - Run `pnpm --filter @eisenbalm/convex codegen` so api.promptVersions.listSeedV1ForWorkspace types.

    (C) `PromptMarkerExport.tsx` (new client component, next to AgentPromptEditorView.tsx):
      - Props: `{ content: string }`.
      - Compute the exact byte form:
        `const md = '<!-- PROMPT START -->\n' + content + '\n<!-- PROMPT END -->'`
        (matches _extract: one newline after START, one before END — copy→commit keeps
        load_prompt byte-verification passing, PRC-10).
      - Render the `md` string in a read-only `<pre>` (mono, neutral card) plus a
        "Copy .md" button using `navigator.clipboard.writeText(md)` with a transient
        "Copied" state. min-h-[44px], focus-visible:ring-2 ring-neutral-400. No repo write
        (honest copy-to-clipboard boundary, D-03).
      - Add `apps/dispatch-control/__tests__/markerExport.test.ts`: a pure unit test of
        the byte-form builder — extract the builder into an exported helper
        `buildMarkerExport(content: string): string` in PromptMarkerExport.tsx and assert
        `buildMarkerExport('hello')` === `'<!-- PROMPT START -->\nhello\n<!-- PROMPT END -->'`,
        AND a round-trip check that stripping one leading + one trailing newline from
        between the markers returns the original content verbatim.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter @eisenbalm/convex codegen && grep -q "listSeedV1ForWorkspace" convex/_generated/api.d.ts && grep -q "<!-- PROMPT START -->" "apps/dispatch-control/app/(dashboard)/prompts/_components/PromptMarkerExport.tsx" && pnpm --filter dispatch-control test -- promptDescriptions markerExport</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "listSeedV1ForWorkspace" convex/_generated/api.d.ts` succeeds (query typed).
    - `Object.keys(PROMPT_DESCRIPTIONS)` ⊇ `Object.keys(VARIABLE_REGISTRY)` (test asserts superset).
    - `buildMarkerExport('hello') === '<!-- PROMPT START -->\nhello\n<!-- PROMPT END -->'` (test asserts).
    - Round-trip test passes: strip-one-leading + strip-one-trailing newline between markers === original content.
    - No existing convex/promptVersions.ts export renamed/reshaped (grep confirms getActive, saveVersion, activate, listActiveForWorkspace, getByVersion still present).
  </acceptance_criteria>
  <done>Descriptions map covers all editable keys with a tested superset assertion; listSeedV1ForWorkspace added (additive) + codegen clean; marker export builds the exact round-trippable byte form with passing unit tests.</done>
</task>

<task type="auto">
  <name>Task 2: List cards — description, drift badge, search + group + drift filter</name>
  <files>apps/dispatch-control/app/(dashboard)/prompts/_components/PromptsListClient.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompts/_components/PromptsListClient.tsx (current card layout + listActiveForWorkspace subscription + group sections)
    - apps/dispatch-control/app/(dashboard)/prompts/_components/agentList.ts (humanizeAgentKey, GROUP_LABELS, groupForAgentKey)
    - apps/dispatch-control/app/(dashboard)/prompts/_components/promptDescriptions.ts (descriptionFor — from Task 1)
  </read_first>
  <action>
    Extend PromptsListClient.tsx (keep it 'use client'; keep the existing
    listActiveForWorkspace subscription, group sections, GROUP_LABELS headings,
    next/link cards, ≥44px + focus rings):

    1) Add a second subscription:
       `useQuery(api.promptVersions.listSeedV1ForWorkspace, { workspace_id: workspaceId })`.
       Build `Map<agentKey, seedContent>`. Compute `isDrifted(key)` =
       activeContent !== undefined && seedContent !== undefined && activeContent !== seedContent.
       (PRC-02 content-compare, D-10.) When seed/active not yet loaded, treat as not-drifted.

    2) On each card render:
       - `descriptionFor(key)` as a one-line muted subtitle under the humanized name
         (text-xs text-neutral-500, truncate). (PRC-01)
       - A drift badge when `isDrifted(key)`: a small amber pill
         `rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800` reading
         "edited since seed". (PRC-02)

    3) Add filter controls ABOVE the group sections (PRC-04):
       - A text input bound to `query` state; matches case-insensitively against BOTH
         the raw agentKey AND humanizeAgentKey(key).
       - A group `<select>` (All / the four groups via GROUP_LABELS); 'all' default.
       - A "drift only" toggle button (aria-pressed). When on, show only drifted keys.
       - Apply the three filters to the keys rendered in each group section; hide a
         group heading whose filtered key list is empty. Show a neutral "No prompts
         match" empty state when everything is filtered out.
       - All controls min-h-[44px], focus-visible:ring-2 ring-neutral-400.

    Keep the existing loading skeleton + "never seeded" meta behavior. No new npm deps.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "listSeedV1ForWorkspace" "apps/dispatch-control/app/(dashboard)/prompts/_components/PromptsListClient.tsx"` succeeds.
    - `grep -q "descriptionFor" "apps/dispatch-control/app/(dashboard)/prompts/_components/PromptsListClient.tsx"` succeeds.
    - `grep -q "edited since seed" "apps/dispatch-control/app/(dashboard)/prompts/_components/PromptsListClient.tsx"` succeeds.
    - List has a text input, a group select, and a drift toggle (grep for `aria-pressed` + an `<input` + `<select`).
    - `pnpm --filter dispatch-control build` (strict production build) passes.
  </acceptance_criteria>
  <done>Cards show description + an "edited since seed" badge when active≠v1; the list filters by name text, group, and drift; groups + ≥44px + focus rings preserved; strict build passes.</done>
</task>

<task type="auto">
  <name>Task 3: Detail pane — description, drift badge, marker export</name>
  <files>apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx (view-first read-only pane + editing toggle + getActive subscription)
    - apps/dispatch-control/app/(dashboard)/prompts/_components/promptDescriptions.ts (descriptionFor)
    - apps/dispatch-control/app/(dashboard)/prompts/_components/PromptMarkerExport.tsx (the export component from Task 1)
    - convex/promptVersions.ts (getByVersion — to read the v1 seed for this single key)
  </read_first>
  <action>
    Extend AgentPromptEditorView.tsx. PRESERVE all existing behavior: getActive
    subscription, draft state, seeding effects, editing toggle, PromptEditor,
    TestRunPanel, VersionHistoryPanel, known-variable chips, loading skeleton.

    1) Under the `<h1>{agentKey}</h1>` header, render `descriptionFor(agentKey)`
       as a muted one-line role description (text-sm text-neutral-500). (PRC-01)

    2) Drift badge on the detail pane (PRC-02): add a subscription
       `const seedV1 = useQuery(api.promptVersions.getByVersion, { workspace_id: workspaceId, agentKey, version: 1 })`.
       Compute `drifted = active != null && seedV1 != null && active.content !== seedV1.content`.
       When drifted, render the same amber "edited since seed" pill near the metadata line
       in BOTH the read-only and editing states.

    3) Marker export (PRC-10): in the READ-ONLY state, below the `<pre>` active-content
       block, render `<PromptMarkerExport content={active.content} />` so the operator can
       copy the exact `.md`-marker byte form for copy→commit. Only render when `active != null`.

    No new npm deps. Reuse existing imports + add the two new imports
    (descriptionFor, PromptMarkerExport, getByVersion via api).
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm --filter dispatch-control build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "descriptionFor" "apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx"` succeeds.
    - `grep -q "PromptMarkerExport" "apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx"` succeeds.
    - `grep -q "getByVersion" "apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx"` succeeds.
    - `grep -q "edited since seed" "apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx"` succeeds.
    - The existing PromptEditor + TestRunPanel + VersionHistoryPanel imports/usages remain (grep confirms all three).
    - `pnpm --filter dispatch-control build` passes.
  </acceptance_criteria>
  <done>Detail pane shows the editorial description, an "edited since seed" drift badge (active≠v1 by content), and a copyable .md-marker export in the read-only state; all existing edit/version/test behavior intact; strict build passes.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @eisenbalm/convex codegen` clean; api.d.ts has listSeedV1ForWorkspace (additive, existing exports unchanged).
- `pnpm --filter dispatch-control test -- promptDescriptions markerExport` passes (coverage superset + byte-form round-trip).
- `pnpm --filter dispatch-control build` (strict) passes — the gate that catches type/route errors vitest misses (per STATE memory rule).
- Manual sanity: /prompts cards show a description + drift badge on edited keys + filter controls; /prompts/[agentKey] shows description + drift badge + a "Copy .md" export.
</verification>

<success_criteria>
- PRC-01: description on every card + detail pane from the brand-agnostic PROMPT_DESCRIPTIONS map (tested superset of VARIABLE_REGISTRY keys).
- PRC-02: "edited since seed" badge on cards + detail when active content ≠ v1 seed content.
- PRC-04: list filterable by name text + group + drift.
- PRC-10: copyable export renders the exact <!-- PROMPT START/END --> byte form (round-trip tested); no repo write.
- Additive Convex query only; no existing export reshaped; strict build passes.
</success_criteria>

<output>
After completion, create `.planning/phases/28-prompt-console/28-01-SUMMARY.md`
</output>
