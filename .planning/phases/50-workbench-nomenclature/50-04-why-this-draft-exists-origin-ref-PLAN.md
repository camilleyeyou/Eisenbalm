---
phase: 50-workbench-nomenclature
plan: 04
type: execute
wave: 1
depends_on: ["50-00"]
files_modified:
  - docs/API_CONTRACTS.md
  - convex/schema.ts
  - convex/promptVersions.ts
  - apps/dispatch-control/components/inspector/InspectorFooter.tsx
  - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx
  - apps/dispatch-control/__tests__/promptVersionOrigin.test.ts
autonomous: true
requirements: [WBN-04]

must_haves:
  truths:
    - "A prompt version can carry an origin back-reference to the issue output that motivated it"
    - "The inspector 'Improve this agent →' action carries an origin reference (runId + section + excerpt) into the Agent Instructions editor"
    - "The Agent Instructions editor renders 'why this draft exists', linking back to the motivating issue output"
    - "The origin field is additive and optional — existing prompt versions without it still work"
    - "The contract (API_CONTRACTS.md) was amended BEFORE the schema/mutation change"
  artifacts:
    - path: "convex/schema.ts"
      provides: "prompt_versions additive optional originRef field"
      contains: "originRef"
    - path: "apps/dispatch-control/components/inspector/InspectorFooter.tsx"
      provides: "Improve-this-agent deep link carrying origin params"
      contains: "Improve this agent"
    - path: "apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx"
      provides: "'why this draft exists' render from originRef"
      contains: "why this draft exists"
  key_links:
    - from: "apps/dispatch-control/components/inspector/InspectorFooter.tsx"
      to: "apps/dispatch-control/app/(dashboard)/prompt-lab/[promptKey]"
      via: "promptHref carries runId + sectionName + excerpt query params"
      pattern: "promptHref|Improve this agent"
    - from: "convex/promptVersions.ts"
      to: "convex/schema.ts prompt_versions.originRef"
      via: "save mutation accepts optional originRef arg"
      pattern: "originRef"
---

<objective>
WBN-04 (D-13). Add the "why this draft exists" bridge: a draft instruction created via the inspector's "Improve this agent →" carries a stored origin back-reference to the specific issue output that motivated it, and the Agent Instructions editor renders that origin so the editor sees *why* the draft exists. Contract-first — amend `docs/API_CONTRACTS.md` before touching the Convex schema.

Purpose: `prompt_versions` has no origin/motivated-by field today (only free-text `note`). This is a real, small additive gap (D-13). The inspector's "Improve this agent →" (`InspectorFooter.tsx`) is the confirmed capture + deep-link seam; the destination editor needs to receive and render the origin. No inference engine — a stored reference.
Output: an additive optional `originRef` on prompt_versions, an origin-carrying deep link, an editor "why this draft exists" render, a Convex-synced schema, and a round-trip test.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/50-workbench-nomenclature/50-CONTEXT.md
@.planning/phases/50-workbench-nomenclature/50-RESEARCH.md
@docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md
@docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md
@docs/API_CONTRACTS.md
@convex/schema.ts
@convex/promptVersions.ts
@apps/dispatch-control/components/inspector/InspectorFooter.tsx

<interfaces>
<!-- convex/schema.ts:306-318 prompt_versions (confirmed no origin field): -->
prompt_versions: defineTable({
  workspace_id: v.string(), agentKey: v.string(), version: v.number(),
  content: v.string(), isActive: v.boolean(), createdAt: v.number(),
  createdBy: v.optional(v.string()), note: v.optional(v.string()),
})  // ADD: originRef: v.optional(v.object({ runId, sectionName, excerpt, issueNumber? }))

<!-- InspectorFooter.tsx:120 — the existing capture/deep-link seam: -->
const promptHref = promptKey ? `/prompt-lab/${encodeURIComponent(promptKey)}` : undefined
// "Improve this agent →" FooterAction uses promptHref. D-13: this link must CARRY
// an origin reference (runId + sectionName + a short excerpt) so the destination renders "why this draft exists".

<!-- Annotations §Agent Instructions: "Editor shows: why this draft exists (linked to the Issue 07 founder output that motivated it — the Flow C bridge)". -->
<!-- DERIVED-STATE §8 inspector artifact carries: meta ("step: … · agent: … · run #7"), output, sectionName → the origin fields to forward. -->
<!-- CLAUDE.md HARD RULE: any additive Convex field must be added to docs/API_CONTRACTS.md FIRST. -->
<!-- Convex live sync required after schema/mutation change: pnpm --filter @eisenbalm/convex dev:once (dev:modest-magpie-797). -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Contract-first — amend API_CONTRACTS.md, add originRef to schema + mutation, live-sync Convex</name>
  <files>docs/API_CONTRACTS.md, convex/schema.ts, convex/promptVersions.ts</files>
  <read_first>
    - docs/API_CONTRACTS.md (find the prompt_versions / Prompt Console section; amend it FIRST)
    - convex/schema.ts (prompt_versions table ~:306-318)
    - convex/promptVersions.ts (the save/create-version mutation signature)
    - .planning/phases/50-CONTEXT.md D-13 (additive field, contract-first) + CLAUDE.md contract-first hard rule
    - Memory note [[convex-functions-need-live-sync]] (dev:once against dev:modest-magpie-797)
  </read_first>
  <action>
    1. CONTRACT FIRST — edit `docs/API_CONTRACTS.md`: document the additive optional `prompt_versions.originRef` field and its shape. Define it as:
       `originRef?: { runId: string; sectionName: string; excerpt: string; issueNumber?: number }`
       — a stored back-reference to the issue output that motivated a draft instruction (the "why this draft exists" bridge). State it is additive/optional and does not affect existing rows or the active-version resolution. Note the origin is captured from the inspector's "Improve this agent →" deep link.
    2. `convex/schema.ts`: add `originRef: v.optional(v.object({ runId: v.string(), sectionName: v.string(), excerpt: v.string(), issueNumber: v.optional(v.number()) }))` to `prompt_versions`. Do NOT change existing fields or indexes.
    3. `convex/promptVersions.ts`: extend the version-creating mutation to accept an optional `originRef` arg (matching the object shape) and persist it when a new version row is inserted. Leave all other behavior (versioning, isActive, note) unchanged; unknown/absent originRef → field simply omitted (optional).
    4. Convex live sync: run `pnpm --filter @eisenbalm/convex dev:once` (dev:modest-magpie-797) so the deployed schema + generated types include the new field. Confirm codegen updated `convex/_generated` types.
  </action>
  <acceptance_criteria>
    - `grep -n "originRef" docs/API_CONTRACTS.md` hits AND the contract edit precedes the schema commit (document in SUMMARY that API_CONTRACTS was edited first).
    - `grep -n "originRef" convex/schema.ts convex/promptVersions.ts` hits in both.
    - `pnpm --filter @eisenbalm/convex dev:once` completes without error (schema deploys + codegen regenerates).
    - `pnpm --filter @eisenbalm/convex typecheck` exits 0.
  </acceptance_criteria>
  <verify><automated>pnpm --filter @eisenbalm/convex dev:once</automated></verify>
  <done>API_CONTRACTS documents originRef first; prompt_versions carries the additive optional originRef; the mutation accepts it; Convex is synced.</done>
</task>

<task type="auto">
  <name>Task 2: Carry origin through "Improve this agent →" + render "why this draft exists" + test</name>
  <files>apps/dispatch-control/components/inspector/InspectorFooter.tsx, apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx, apps/dispatch-control/__tests__/promptVersionOrigin.test.ts</files>
  <read_first>
    - apps/dispatch-control/components/inspector/InspectorFooter.tsx (:120 promptHref + the "Improve this agent →" FooterAction; note runId/agentKey props already present)
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx (the draft editor that must render "why this draft exists")
    - convex/promptVersions.ts (the mutation now accepting originRef — Task 1)
    - apps/dispatch-control/__tests__/PromptSaveDialog.test.tsx (the convex-mock test pattern to mirror, if present)
    - docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md §Agent Instructions ("why this draft exists" wording)
  </read_first>
  <action>
    InspectorFooter.tsx: make the "Improve this agent →" `promptHref` carry the origin reference as query params so the destination can render "why this draft exists" and store it on a new draft:
      `promptHref = promptKey ? `/prompt-lab/${encodeURIComponent(promptKey)}?fromRun=${encodeURIComponent(runId)}&section=${encodeURIComponent(sectionName)}&excerpt=${encodeURIComponent(excerpt)}` : undefined`
      Use the artifact's already-available fields (runId is a prop; sectionName + a short output excerpt come from the inspector artifact per DERIVED-STATE §8). Keep the reserved/NOT_EXTERNALIZED behavior for keys with no prompt (unchanged). Do NOT alter the other footer actions in this plan (the Restart-from-step upgrade is 50-05).
    AgentPromptEditorView.tsx: read the `fromRun`/`section`/`excerpt` params (or an `originRef` loaded from the active/draft version). When present, render a "why this draft exists" block (Annotations §Agent Instructions) — e.g. "This draft exists because of {sectionName} in run {fromRun}: '{excerpt}'" with a link back to that issue output (the run/issue route). When a draft is CREATED from this deep link, pass the assembled `originRef` object to the version-creating mutation (Task 1) so it persists. When no origin exists, render nothing (graceful — matches "no starting version"/no-origin states).
    Create `apps/dispatch-control/__tests__/promptVersionOrigin.test.ts` (mirror the convex-mock pattern):
      - Assert the save/create-version mutation round-trips `originRef` (insert with originRef → read back the same object).
      - Assert InspectorFooter's `promptHref` includes `fromRun`, `section`, and `excerpt` params when runId/sectionName/excerpt are supplied.
      - Assert AgentPromptEditorView renders "why this draft exists" text when origin params/originRef are present and renders nothing when absent.
  </action>
  <acceptance_criteria>
    - `grep -n "fromRun\|excerpt" apps/dispatch-control/components/inspector/InspectorFooter.tsx` shows the origin params on the deep link.
    - `grep -n "why this draft exists" apps/dispatch-control/app/(dashboard)/prompt-lab/_components/AgentPromptEditorView.tsx` hits.
    - `pnpm --filter dispatch-control test -- --run promptVersionOrigin` passes (round-trip + deep-link params + conditional render).
    - `pnpm --filter dispatch-control build` exits 0.
  </acceptance_criteria>
  <verify><automated>pnpm --filter dispatch-control test -- --run promptVersionOrigin && pnpm --filter dispatch-control build</automated></verify>
  <done>"Improve this agent →" carries the origin; the editor renders "why this draft exists" linking the motivating issue output; a draft persists its originRef; test proves the round-trip.</done>
</task>

</tasks>

<verification>
- `pnpm --filter @eisenbalm/convex dev:once` + `pnpm --filter @eisenbalm/convex typecheck` clean (schema synced).
- `pnpm --filter dispatch-control test -- --run promptVersionOrigin` green.
- `pnpm --filter dispatch-control build` exits 0.
- API_CONTRACTS.md amended before the schema change (contract-first).
</verification>

<success_criteria>
- prompt_versions carries an additive optional originRef; existing versions unaffected.
- The inspector "Improve this agent →" carries runId + section + excerpt into the editor.
- Agent Instructions renders "why this draft exists" linking the motivating issue output.
</success_criteria>

<output>
After completion, create `.planning/phases/50-workbench-nomenclature/50-04-SUMMARY.md`.
</output>
