---
phase: 41-issue-workspace-frame
plan: 06
subsystem: ui
tags: [next-app-router, react-context, convex, dispatch-control, workspace-frame, nav]

# Dependency graph
requires:
  - phase: 41-issue-workspace-frame
    provides: "WorkspaceStateProvider + useWorkspaceState() (41-05) — the single Convex-subscription/derivation context the frame mounts; WorkspaceOutline + ContextPanel (41-05); issueStoryHref/issueDraftHref/issueFactCheckHref/issueVoiceHref/issueApprovalHref (41-01); api.issues.setLastVisitedStage (41-02)"
provides:
  - "The Issue Workspace frame: issues/[issueNumber]/layout.tsx — one provider-wrapped shared layout mounting the 5 stage tabs (live status marks), the persistent status header, WorkspaceOutline, ContextPanel shell, and WorkspaceControls; stays mounted across stage-tab switches (App Router layout semantics)"
  - "WorkspaceControls.tsx — Hold/Reopen + the hold dialog wiring + the separate cancelRun-on-stopRun call + the inline run-history list, relocated from the old overview page (Pitfall 5 — no capability lost)"
  - "issues/[issueNumber]/page.tsx as a redirect-only Server Component: lastVisitedStage (D-03) else Draft/Story (D-04)"
  - "A single 'Issue Workspace' Editorial nav item (WSP-01, D-22)"
  - "The last-visited-stage writer — a useEffect keyed on usePathname that calls api.issues.setLastVisitedStage on every stage visit"
affects: [41-07-stage1-story-stage3-factcheck, 41-08-stage2-draft-recomposition, 41-09-stage5-approval-publish-preview, 41-10-integration-gate]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "App Router layout-vs-page split as the frame spine: the persistent frame (tabs/outline/panel/controls + the ONE provider) lives in layout.tsx so it survives stage-tab navigations without remounting; each stage's canvas is the nested {children} page"
    - "Server-Component redirect-only index page resolving lastVisitedStage/default server-side (ConvexHttpClient) — no client subscription race on first paint, mirroring the review/voice wrappers"
    - "Capability relocation (not deletion): before gutting a page into a redirect, every persistent concern is moved to a named frame component (WorkspaceControls) that consumes the shared context rather than re-subscribing (Pitfall 3 + Pitfall 5)"
    - "Live tabs proven via test by mocking convex/react useQuery to feed the REAL provider a fixture, so deriveStageStates actually runs — the tabs are never hard-coded"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx
    - apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx
    - apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx
  modified:
    - apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx
    - apps/dispatch-control/lib/nav.ts
    - apps/dispatch-control/__tests__/nav.test.ts

key-decisions:
  - "The stage-tab icon set is duplicated (not imported) from StageStrip: StageStrip's StageIcon is a private helper, and the tabs need the icon inline with the tab's own <Link> chrome (border-b active underline) rather than StageStrip's boxed segment geometry — so the frame renders label + icon itself, reusing only StageStrip's exported STAGE_STATE_LABELS. Label+icon-never-color-alone is preserved."
  - "The bare page.tsx redirect resolves lastVisitedStage/default via ConvexHttpClient server-side (same shape as the review/voice wrappers) rather than a client redirect — avoids a flash of the frame at the wrong stage before a client subscription resolves."
  - "The pre-existing Phase-40 comment in nav.ts that names 'Review Desk, Signal Desk, and Voice Pass' (documenting that they LEFT the nav) is left intact — it is accurate historical documentation, not a nav item. The load-bearing guard is the new nav.test.ts REMOVED_LABELS assertion over the actual NAV_GROUPS labels (which passes), not a raw grep over comments."
  - "layout.tsx renders its frame root as a plain <div>, not a second <main> — the dashboard root layout already owns the single <main> for the whole console."

patterns-established:
  - "Pattern: the Workspace frame is a client layout.tsx that wraps children in exactly one context provider + renders the persistent chrome; stage pages are nested children so the frame never remounts on tab switch (the demoable-milestone spine)."
  - "Pattern: a 'remember where I was' writer as a useEffect keyed on usePathname's last segment, calling an operator-only patch mutation best-effort (never blocking navigation, never surfacing an error)."

requirements-completed: [WSP-01]

# Metrics
duration: 22min
completed: 2026-07-15
---

# Phase 41 Plan 06: Workspace Frame Layout + Nav Summary

**The three desks collapse into one Issue Workspace: a single provider-wrapped `layout.tsx` frame now renders 5 stage tabs carrying live `deriveStageStates` status marks (label + icon), a persistent status header, the section outline, the context-panel shell, and the relocated Hold/Reopen + run-history controls — staying mounted across tab switches — while the bare `/issues/[n]` becomes a server-resolved redirect into the frame at the last-visited (or default) stage, and a single "Issue Workspace" nav item replaces the departed Review/Signal/Voice desks.**

## Performance

- **Duration:** ~22 min (spanned a transient-API-error restart mid-Task-3; Tasks 1 & 2 were already committed, Task 3 resumed cleanly from a clean tree)
- **Completed:** 2026-07-15
- **Tasks:** 3
- **Files modified:** 6 (3 created, 3 modified)

## Accomplishments
- **Task 1 — the frame (`layout.tsx`):** a `'use client'` layout that parses `useParams().issueNumber`, wraps every stage route in ONE `WorkspaceStateProvider` (41-05), and renders a `FrameChrome` inner component consuming `useWorkspaceState()`: the 5 stage tabs (each a `<Link>` to its stage href with the derived state's label + icon and the `· {openCount}` needs-you suffix, active via `usePathname()` + `aria-current="page"`), the persistent status header (the `'unknown' → "State unknown — refresh"` rule preserved, plus `{tasks.length} open · ~{workMinutes} min`), `WorkspaceOutline`, the `ContextPanel` shell, and `WorkspaceControls`. A `useEffect` keyed on `usePathname()` writes `api.issues.setLastVisitedStage` on every stage visit (best-effort, guards `n===null` and unknown segments, ignores `/runs/*`).
- **Task 2 — capability preservation + redirect (Pitfall 5, D-03/D-04):** `WorkspaceControls.tsx` relocates the old 314-line overview's persistent concerns verbatim in behavior — the held-state row + Reopen, the Hold flow (`HoldDialog` → `api.issues.hold` + the SEPARATE `cancelRun` call on `stopRun`, `holdBusy`/`holdError` with the `role="alert"` error), and the full inline run-history list — consuming `held`/`issue`/`history`/`runId` from the context instead of re-subscribing (Pitfall 3). `page.tsx` is now redirect-only: `lastVisitedStage` when valid, else Draft (run exists AND a pitch is selected) / Story otherwise, `parseIssueNumber` failure → `/issues`.
- **Task 3 — nav + tests (WSP-01):** a single `{ label: 'Issue Workspace', href: '/issues' }` added to the Editorial group; `nav.test.ts` extended to assert exactly one such item AND that no desk LABEL appears as a nav item; `WorkspaceLayout.test.tsx` mocks `convex/react` `useQuery` to feed the REAL provider a fixture so `deriveStageStates` runs, then asserts 5 tabs with `STAGE_LABELS` + a live state mark each and `aria-current="page"` on the active Draft tab (mocked pathname `/issues/7/draft`).

## Task Commits

Each task was committed atomically to master:

1. **Task 1: The workspace frame layout — tabs + outline + panel + lastVisitedStage writer** — `0315193` (feat)
2. **Task 2: Extract WorkspaceControls + redirect the bare page (Pitfall 5, D-03)** — `21b9fff` (feat)
3. **Task 3: Nav "Issue Workspace" entry + frame/nav tests (WSP-01)** — `81380e0` (feat)

## Files Created/Modified
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx` — the shared Workspace frame (provider wrap + 5 stage tabs + status header + outline + context-panel shell + WorkspaceControls + last-visited-stage writer)
- `apps/dispatch-control/app/(dashboard)/issues/_components/WorkspaceControls.tsx` — Hold/Reopen + hold-dialog wiring + cancelRun-on-stopRun + inline run-history, relocated from the old overview
- `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/page.tsx` — rewritten as a redirect-only Server Component (lastVisitedStage → Draft/Story)
- `apps/dispatch-control/lib/nav.ts` — single "Issue Workspace" Editorial nav item
- `apps/dispatch-control/__tests__/nav.test.ts` — asserts one "Issue Workspace" item + absence of the three desk labels
- `apps/dispatch-control/__tests__/WorkspaceLayout.test.tsx` — 3 tests proving the tabs are live (real provider derivation) + active-tab aria-current

## Build & Test Verification

- **`pnpm --filter dispatch-control test -- WorkspaceLayout.test.tsx nav.test.ts`:** PASS — 2 files, 11 tests passed (nav.test.ts 8, WorkspaceLayout.test.tsx 3), exit 0.
- **`pnpm --filter dispatch-control build`:** PASS — "Compiled successfully in 5.6s", type-check + lint clean, 11/11 static pages generated. The route table confirms the recomposition: `/issues/[issueNumber]` is now **154 B** (redirect-only, down from the 314-line overview), and the frame's weight surfaces on the stage routes (`/issues/[issueNumber]/review` 12.8 kB, `/issues/[issueNumber]/voice` 2.61 kB) — those routes now nest inside the new `layout.tsx`.
- **`pnpm --filter dispatch-control exec tsc --noEmit`:** the files this plan touched (`layout.tsx`, `WorkspaceControls.tsx`, `page.tsx`) report ZERO errors. The ~20 pre-existing errors in unrelated test files (`syntheticPortableText.test.ts`, `voicePassAxis.test.ts`, `WriterExpansion.test.tsx`, plus the `import.meta.glob`/`noUncheckedIndexedAccess` test-only noise) are the same baseline documented in `41-01-SUMMARY.md`/`41-05-SUMMARY.md` — out of scope, not touched. The strict production build (which is the real gate per CLAUDE.md memory "run-strict-build-before-frontend-phase-done") passes.

## Decisions Made
- Duplicated (rather than imported) StageStrip's per-state icon into the tab bar, because `StageStrip`'s `StageIcon` is private and the tabs need the icon inline with the tab's own `<Link>` underline chrome, not StageStrip's boxed segment geometry. Only `STAGE_STATE_LABELS` (StageStrip's public export) is reused. Label + icon (never color alone) is preserved.
- The bare-page redirect resolves server-side via `ConvexHttpClient` (same pattern as the review/voice wrappers), avoiding a flash of the frame at the wrong stage before a client subscription resolves.
- The pre-existing Phase-40 comment in `nav.ts` naming the three departed desks is left intact (accurate documentation, not a nav item); the structural guard is the new `nav.test.ts` `REMOVED_LABELS` assertion over actual `NAV_GROUPS` labels.

## Deviations from Plan

None — plan executed exactly as written across all three tasks.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a `noUncheckedIndexedAccess` type error on the stage-tab loop**
- **Found during:** Task 2 (running `pnpm --filter dispatch-control exec tsc --noEmit` as a courtesy check before committing, per CLAUDE.md memory "vitest doesn't type-check")
- **Issue:** `apps/dispatch-control` has `noUncheckedIndexedAccess: true`; `stages[i]` (a fixed 5-tuple indexed in the tab `.map`) is typed `StageStateResult | undefined`, so the subsequent `.state`/`.openCount` accesses failed `tsc --noEmit`.
- **Fix:** Added a same-shape fallback `const stageResult = stages[i] ?? { state: 'not-generated' as const, openCount: 0 }`. `stages` and `STAGE_TABS` are both fixed 5-length and stay in lockstep, so the fallback is unreachable — it only satisfies the strictness setting.
- **Files modified:** `apps/dispatch-control/app/(dashboard)/issues/[issueNumber]/layout.tsx`
- **Committed in:** `21b9fff` (Task 2 commit)

## Issues Encountered
- Mid-Task-3, a transient API error terminated the executor. The working tree was clean and Tasks 1 & 2 (`0315193`, `21b9fff`) were already committed, so Task 3 resumed without redoing prior work. No code was stranded.
- `node gsd-tools roadmap get-phase 41` returns `malformed_roadmap` (the known multi-milestone ROADMAP.md CLI quirk documented in project memory `roadmap-multi-milestone-cli-quirk`). The Phase 41 detail section exists at `### Phase 41:`; the 41-06 plan checkbox was updated directly (see State Updates).

## User Setup Required
None — no external service configuration required. `api.issues.setLastVisitedStage` was already deployed live in Plan 41-02.

## Next Phase Readiness
- The frame is now the mount point for the remaining stage canvases: Plan 41-07 (Stage 1 Story + Stage 3 Fact Check placeholder), Plan 41-08 (Stage 2 Draft recomposition), Plan 41-09 (Stage 5 Approval). Each drops a `page.tsx` under `issues/[issueNumber]/{story,draft,fact-check,voice,approval}/` and it renders inside this frame automatically.
- The `ContextPanel` shell currently renders a default; the per-stage children injection (Stage 1 lead detail, Stage 2 open QA items, etc. — D-19) is each stage page's job in 41-07/08/09.
- No blockers identified for Plans 41-07 through 41-10.

---
*Phase: 41-issue-workspace-frame*
*Completed: 2026-07-15*

## Self-Check: PASSED

All 6 claimed files found on disk; all 3 task commits (`0315193`, `21b9fff`, `81380e0`) found in git history.
