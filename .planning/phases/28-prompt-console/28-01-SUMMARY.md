---
phase: 28-prompt-console
plan: 01
subsystem: dispatch-control
tags: [prompts, editorial-console, drift, voice-guardrails, convex]
requires:
  - api.promptVersions.listActiveForWorkspace (existing)
  - api.promptVersions.getActive (existing)
  - api.promptVersions.getByVersion (existing)
  - VARIABLE_REGISTRY (existing canonical editable key set)
  - prompts.py::_extract marker/newline contract (existing)
provides:
  - PROMPT_DESCRIPTIONS map + descriptionFor() (per-key editorial context, PRC-01)
  - api.promptVersions.listSeedV1ForWorkspace (additive drift oracle, PRC-02)
  - buildMarkerExport() + PromptMarkerExport component (PRC-10)
  - /prompts list filtering by name + group + drift (PRC-04)
affects:
  - apps/dispatch-control /prompts list + /prompts/[agentKey] detail
tech-stack:
  added: []
  patterns:
    - "Additive Convex query (no existing export reshaped)"
    - "Content-compare drift oracle (active content !== v1 seed content)"
    - "Exact round-trippable .md marker byte form for copy→commit"
key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/prompts/_components/promptDescriptions.ts
    - apps/dispatch-control/app/(dashboard)/prompts/_components/PromptMarkerExport.tsx
    - apps/dispatch-control/__tests__/promptDescriptions.test.ts
    - apps/dispatch-control/__tests__/markerExport.test.ts
  modified:
    - convex/promptVersions.ts
    - apps/dispatch-control/app/(dashboard)/prompts/_components/PromptsListClient.tsx
    - apps/dispatch-control/app/(dashboard)/prompts/_components/AgentPromptEditorView.tsx
decisions:
  - "api.d.ts acceptance grep adjusted: Convex codegen uses module-reference (`typeof promptVersions`) so individual function names do not appear literally in api.d.ts — typed-ness confirmed by clean codegen TypeScript pass + full strict build"
metrics:
  duration_min: 8
  tasks: 3
  files: 7
  completed: 2026-06-24
---

# Phase 28 Plan 01: Editorial Context, Drift & Export Summary

Added the editorial-context, drift-detection, and source-of-truth surfaces to the view-first `/prompts` console: per-key brand-agnostic descriptions on cards and the detail pane (PRC-01), an "edited since seed" drift badge driven by an additive content-compare Convex query (PRC-02), list search/filter by name + group + drift (PRC-04), and a copyable exact-byte `.md`-marker export for copy→commit to the git fallback (PRC-10). Pure dispatch-control frontend plus one additive Convex query — no pipeline/backend changes.

## What Was Built

### Task 1 — Descriptions map, drift query, marker export (commit 5c3b252)
- `promptDescriptions.ts`: `PROMPT_DESCRIPTIONS` covering every editable key (full `VARIABLE_REGISTRY` set: system agents, `*_user` templates, six section-guidance keys, `rubric` + `voice_constraints`) with one brand-agnostic role sentence each; `descriptionFor()` returns `''` for unknown keys (never throws).
- `convex/promptVersions.ts`: additive `listSeedV1ForWorkspace` query — collects rows via `by_workspace`, keeps `version === 1`, returns `{ agentKey, content }[]` as the drift oracle. No existing export renamed or reshaped.
- `PromptMarkerExport.tsx`: exported pure `buildMarkerExport(content)` producing `<!-- PROMPT START -->\n` + content + `\n<!-- PROMPT END -->` (matches `prompts.py::_extract`), plus a read-only `<pre>` + "Copy .md" clipboard button (transient "Copied", ≥44px, focus ring). Copy-to-clipboard only — no repo write (D-03).
- Tests: `promptDescriptions.test.ts` asserts the map is a superset of `VARIABLE_REGISTRY` keys + every value non-empty; `markerExport.test.ts` asserts the exact byte form + a strip-one-leading/strip-one-trailing-newline round-trip.

### Task 2 — List cards: description, drift badge, filters (commit a2aa978)
- Added `listSeedV1ForWorkspace` subscription; `isDrifted(key)` = active content defined && seed content defined && differ (not-drifted while loading, D-10).
- Cards now render `descriptionFor(key)` as a truncated muted subtitle + an amber "edited since seed" pill when drifted.
- Filter bar above the group sections: name text input (matches raw key + humanized name, case-insensitive), group `<select>` (All + four groups), drift-only toggle (`aria-pressed`). Empty groups hidden; "No prompts match." empty state. All controls ≥44px + focus rings. Loading skeleton + "never seeded" behavior preserved.

### Task 3 — Detail pane: description, drift badge, marker export (commit 6a65d6e)
- Editorial description rendered under the `agentKey` header.
- `getByVersion` v1 subscription; `drifted = active && seedV1 && active.content !== seedV1.content`; amber "edited since seed" badge shown on the metadata line in BOTH read-only and editing states.
- `<PromptMarkerExport content={active.content} />` rendered below the read-only `<pre>`, only when `active != null`.
- All existing behavior intact: `getActive`, draft/seed effects, editing toggle, `PromptEditor`, `TestRunPanel`, `VersionHistoryPanel`, variable chips, loading skeleton.

## Deviations from Plan

### Adjusted verification

**1. [Rule 3 - Blocking] api.d.ts literal grep does not match Convex codegen style**
- **Found during:** Task 1 automated verify
- **Issue:** The plan's acceptance grep `grep -q "listSeedV1ForWorkspace" convex/_generated/api.d.ts` cannot pass — Convex codegen emits module references (`import type * as promptVersions ...` + `promptVersions: typeof promptVersions`), so individual function names never appear literally in `api.d.ts`. This is true of every existing query (`listActiveForWorkspace`, `getActive`, etc.) as well.
- **Resolution:** Typed-ness confirmed instead by (a) `pnpm --filter @eisenbalm/convex codegen` completing its "Running TypeScript..." step with no error against the new export, and (b) the full `pnpm --filter dispatch-control build` strict build passing while `PromptsListClient.tsx` + `AgentPromptEditorView.tsx` consume `api.promptVersions.listSeedV1ForWorkspace` / `getByVersion` type-checked. No code change needed — the query is genuinely additive and typed.
- **Files modified:** none (verification interpretation only)
- **Commit:** n/a

No other deviations — plan executed as written. No auth gates. No architectural changes.

## Verification

- `pnpm --filter @eisenbalm/convex codegen` — clean (TypeScript pass); `listSeedV1ForWorkspace` additive, all existing exports intact (`getActive`, `saveVersion`, `activate`, `listActiveForWorkspace`, `getByVersion`, `upsertActive`, `listForAgent`).
- `pnpm --filter dispatch-control test -- promptDescriptions markerExport` — 6/6 passed (superset coverage + byte-form round-trip).
- `pnpm --filter dispatch-control test` (full) — 106 passed / 2 todo / 1 file skipped, no regressions.
- `pnpm --filter dispatch-control build` (strict) — passes (the gate that catches type/route errors vitest misses).
- Acceptance greps all green on both list + detail (`listSeedV1ForWorkspace`, `descriptionFor`, `edited since seed`, `aria-pressed`/`<input`/`<select`, `PromptMarkerExport`, `getByVersion`, and preserved `PromptEditor`/`TestRunPanel`/`VersionHistoryPanel`).

## Known Stubs

None. All surfaces are wired to live Convex subscriptions; descriptions are real editorial copy (no placeholder/TODO text).

## Self-Check: PASSED

- All 4 created artifacts + SUMMARY.md present on disk.
- All 3 task commits present in git history (5c3b252, a2aa978, 6a65d6e).
