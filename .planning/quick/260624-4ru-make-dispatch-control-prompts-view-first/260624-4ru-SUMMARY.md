---
phase: quick-260624-4ru
plan: 01
subsystem: dispatch-control
tags: [prompts, convex, view-first, ui]
requires:
  - prompt_versions table (workspace eisenbalm, 30 active v1 rows on modest-magpie-797)
  - existing promptVersions queries (getActive/saveVersion/activate/listForAgent/getByVersion/upsertActive)
provides:
  - api.promptVersions.listActiveForWorkspace (additive query)
  - view-first /prompts list cards with live previews
  - view-first /prompts/[agentKey] detail pane with Edit toggle
affects:
  - apps/dispatch-control /prompts section
tech-stack:
  added: []
  patterns:
    - server component resolves workspace + groups, client child owns single Convex subscription
    - view-first / edit-on-demand toggle preserving existing CodeMirror editor
key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/prompts/_components/PromptsListClient.tsx
  modified:
    - convex/promptVersions.ts
    - apps/dispatch-control/app/(dashboard)/prompts/page.tsx
    - apps/dispatch-control/app/(dashboard)/prompts/_components/agentList.ts
    - apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx
decisions:
  - listActiveForWorkspace maps row.createdAt to updatedAt (no separate updatedAt field exists)
  - kept min-h-[44px] literal over Tailwind canonical min-h-11 to mirror existing dispatch-control convention
metrics:
  duration: 4 min
  tasks: 3
  files: 5
  completed: 2026-06-24
---

# Quick 260624-4ru: Make dispatch-control /prompts view-first Summary

Additive Convex query plus a view-first rework of the dispatch-control `/prompts`
section: operators now see each editable key's humanized name, a ~120-char preview
of its live active prompt, and "active v{N} · updated {date}" on the list, and land
on a read-only pane of the current active prompt before an explicit Edit button
reveals the existing CodeMirror editor.

## What Was Built

**Task 1 — `listActiveForWorkspace` query (convex/promptVersions.ts)**
Appended a public `query` taking `{ workspace_id }`, reading all rows via the
`by_workspace` index, filtering `isActive === true`, and returning one compact
`{ agentKey, version, content, updatedAt }` per agentKey (first active row wins
defensively if duplicates ever exist; `updatedAt` = `row.createdAt`). No existing
export was renamed or reshaped — strictly additive per docs/API_CONTRACTS.md.
Codegen run; the query is typed for the frontend via `typeof promptVersions`.

**Task 2 — view-first list cards**
- `agentList.ts`: added pure, deterministic `humanizeAgentKey()` (snake_case →
  Title Case). Existing exports untouched.
- New `PromptsListClient.tsx` (`'use client'`): owns ONE
  `useQuery(api.promptVersions.listActiveForWorkspace)` subscription, builds a
  `Map<agentKey, {version,content,updatedAt}>`, and renders the same group
  sections + card grid. Each card: humanized title + raw key mono subtitle +
  ~120-char whitespace-collapsed preview + meta line
  ("active v{N} · updated {date}" / "never seeded" / "…" while loading). Cards are
  still `next/link` to `/prompts/[agentKey]`; ≥44px, focus-visible ring added.
- `page.tsx`: now an async server component — resolves `getCurrentWorkspace()`,
  builds grouped key lists with `listEditableAgentKeys()/groupForAgentKey()/GROUP_ORDER`,
  hands `{ workspaceId, groups }` to `PromptsListClient`. Heading/intro preserved.

**Task 3 — view-first detail pane (AgentPromptEditorView.tsx)**
Added an `editing` boolean (default false). Read-only state renders the active
prompt in a `<pre className="whitespace-pre-wrap font-mono text-sm">`, a metadata
line, the existing variable chips, and a primary Edit button. Editing state renders
the unchanged `PromptEditor` + `TestRunPanel` plus a "Done / View" button (does not
discard draft). Never-seeded keys (`active === null`) show an empty-state card with
a "Create first version" button into the editor. Loading skeleton and
`VersionHistoryPanel` (right column, both states) preserved. All getActive / draft /
seeding / save / version / test-run wiring intact.

## Verification

- `pnpm --filter @eisenbalm/convex codegen` — succeeded.
- Strict build: `pnpm --filter dispatch-control build` — PASSED after both Task 2 and Task 3 (the gate that catches noUncheckedIndexedAccess / route-group conflicts vitest misses). `/prompts` prerenders static (○), `/prompts/[agentKey]` dynamic (ƒ) — unchanged from before.
- Confirmed no existing `convex/promptVersions.ts` export renamed/reshaped (grep check: all 6 prior exports present, new export added).

## Deviations from Plan

### Verify-command note (not a code change)

Task 1's automated verify was `grep -q "listActiveForWorkspace" convex/_generated/api.d.ts`. Convex's per-module codegen references functions via `import type * as promptVersions` + `typeof promptVersions` rather than inlining each function name, so the literal string does not appear in `api.d.ts` even though the query IS surfaced and typed. Codegen succeeded and the query type resolves — proven by the Task 2/3 strict builds type-checking `api.promptVersions.listActiveForWorkspace` against the generated type. No code defect; the grep assertion was a mismatch with this codegen style.

## Known Stubs

None.

## Self-Check: PASSED
