---
phase: 31-content-patch-endpoints-full-editing
plan: 04
subsystem: frontend
tags: [dispatch-control, nextjs, clerk, convex, review-desk, source-scan-tripwire]

# Dependency graph
requires:
  - phase: 31-content-patch-endpoints-full-editing
    plan: 01
    provides: "§31 API_CONTRACTS.md contract (10 content-patch routes, revision guard, validation split, draft-read shape) — the fixed reference this client and route shell are built against"
  - phase: 26-review-gate-charity-registry
    provides: "reviewClient.ts pattern (pipelineBaseUrl/typed error), PreviewIframe + previewToken.ts HMAC preview flow, api.runs.listForWorkspace awaiting-review query"
provides:
  - "contentPatchClient.ts — typed fetch client covering every §31 route (patchSection/patchHeadline/patchTheme/patchGame/patchPdfDataPoints/patchBonus/patchDeliberationConversation/patchPodcastTranscript/getDraft/uploadAsset) with ContentPatchError(status, reason, message, fields)"
  - "EDT-05 source-scan tripwire (__tests__/dispatch-control-no-sanity-write.test.ts) — permanent guard against direct Sanity writes creeping into dispatch-control"
  - "Real /review-desk route shell: auto-focus (D-01) + /review-desk/[runId] two-pane editor layout (D-02) with SectionChipList + reused PreviewIframe + rerun-clobber advisory (§31.9)"
affects: [31-05-editor-components-and-wiring]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Each pipeline-API client module keeps its own private pipelineBaseUrl() copy rather than a shared cross-import (matches reviewClient.ts/testRunClient.ts precedent)"
    - "Client Components needing a server-secret-derived value (signed preview URL) call a same-app Route Handler rather than importing the server-only module directly — keeps PREVIEW_SECRET/node:crypto out of the client bundle"
    - "Source-scan Vitest tripwire (FORBIDDEN regex array + recursive file walk) as the enforcement mechanism for an architectural invariant, no ESLint rule needed"

key-files:
  created:
    - apps/dispatch-control/lib/contentPatchClient.ts
    - apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx
    - apps/dispatch-control/app/api/review-desk/[runId]/preview-url/route.ts
  modified:
    - apps/dispatch-control/app/(dashboard)/review-desk/page.tsx

key-decisions:
  - "review-desk/[runId]/page.tsx is a Client Component (not the Server-Component-delegates-to-client-view pattern used by prompt-lab/[agentKey]/page.tsx) because the plan's acceptance criteria requires SectionChipList/getDraft/PreviewIframe to be imported directly in page.tsx itself, and getDraft needs a live Clerk token from useAuth().getToken()"
  - "Added a new Route Handler (app/api/review-desk/[runId]/preview-url) not listed in the plan's files_modified — a minimal, justified Rule-3 addition: lib/previewToken.ts is explicitly server-only (PREVIEW_SECRET + node:crypto) and cannot be imported into the Client Component page without breaking the client bundle"
  - "SectionChipList exports EDITABLE_SECTIONS as the canonical 9-surface list/order so the parent page and future Plan 05 editors share one source of truth instead of duplicating the section-id list"

patterns-established:
  - "getDraft/patch* client calls always pass a `token: string | null` from useAuth().getToken() — never assume a token is present; the pipeline API itself enforces auth"

requirements-completed: [EDT-01, EDT-02, EDT-05]

# Metrics
duration: 25min
completed: 2026-07-07
---

# Phase 31 Plan 04: Frontend Foundation — Client and Route Shell Summary

**contentPatchClient.ts (typed fetch client for all 10 §31 routes) + the EDT-05 no-Sanity-write source-scan tripwire + the real Review Desk route shell (auto-focus `/review-desk` + two-pane `/review-desk/[runId]` editor with SectionChipList and a reused, toggleable PreviewIframe), replacing the Phase 30 placeholder.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-07-07T03:34:00Z (approx, first Read call)
- **Completed:** 2026-07-07T03:44:00Z
- **Tasks:** 3 completed
- **Files:** 5 created, 1 modified

## Accomplishments

- `lib/contentPatchClient.ts` mirrors `reviewClient.ts`'s `pipelineBaseUrl()` / typed-error pattern, covering every §31.2 route: `patchSection`, `patchHeadline`, `patchTheme`, `patchGame`, `patchPdfDataPoints`, `patchBonus`, `patchDeliberationConversation`, `patchPodcastTranscript`, `getDraft`, and `uploadAsset` (raw-binary body with `X-Filename`/`X-If-Revision-Id` headers, not multipart — matches §31.6's `python-multipart`-not-installed constraint). `ContentPatchError` carries `status`, `reason`, `message`, and an optional `fields` array so the editor can branch on `'revision_mismatch'` (D-10) vs `'validation_failed'` (D-08).
- `__tests__/dispatch-control-no-sanity-write.test.ts` (EDT-05) recursively scans `app/`, `components/`, `lib/` for four forbidden patterns (`@sanity/client` import, bare `from 'sanity'`, `createClient(`, `*.api.sanity.io`) and asserts zero `@sanity/*` deps in `package.json`. Passes immediately on the clean baseline — my own doc comments in `contentPatchClient.ts` tripped the regex on first run (mentioning the forbidden strings in prose) and were reworded to avoid false positives.
- `/review-desk` (D-01) now resolves the current awaiting-review run via `api.runs.listForWorkspace` (the same Convex source `ReviewQueue.tsx` uses) and redirects straight to its editor; renders a minimal switcher when more than one run is awaiting review, and an empty state (1c `PlaceholderScreen`-style chrome) when none is.
- `/review-desk/[runId]` (D-02) is a two-pane editor shell: `SectionChipList` on the left (9 surfaces, keyboard-focusable, dirty-dot indicator), a section-editor slot on the right (placeholder for Plan 05), and a toggleable reused `PreviewIframe` (imported from `run-monitor/.../review/_components/PreviewIframe`, not copied). The §31.9 rerun-clobber advisory ("Re-roll a section before editing…") is shown near the header.
- `SectionChipList.tsx` exports `EDITABLE_SECTIONS` (the canonical 9-surface id/label list in reading order: originStory, problemStatement, founderBio, caseStudy, bonus, game, deliberation-conversation, podcast, theme) as the shared source of truth for the parent page and future Plan 05 editors.
- New `app/api/review-desk/[runId]/preview-url/route.ts` Route Handler resolves the signed preview URL server-side (mirrors the slug-resolution chain in `run-monitor/.../review/page.tsx`) so the Client Component editor page never imports `lib/previewToken.ts` (server-only: `PREVIEW_SECRET` + `node:crypto`) directly.

## Task Commits

Each task was committed atomically:

1. **Task 1: contentPatchClient.ts + EDT-05 tripwire** - `3837106` (feat)
2. **Task 2: Review Desk route shell (auto-focus + [runId] editor layout)** - `f6c5bf1` (feat)
3. **Task 3: SectionChipList component** - `92cf63a` (feat)

## Files Created/Modified

- `apps/dispatch-control/lib/contentPatchClient.ts` - new: typed fetch client for all 10 §31 content-patch routes
- `apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts` - new: EDT-05 source-scan tripwire
- `apps/dispatch-control/app/(dashboard)/review-desk/page.tsx` - rewritten: auto-focus awaiting-review run (D-01), replaces Phase 30 `PlaceholderScreen`
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` - new: two-pane editor shell (D-02)
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx` - new: jump-nav chip list
- `apps/dispatch-control/app/api/review-desk/[runId]/preview-url/route.ts` - new: server-side signed preview-URL resolver for the Client Component editor page

## Decisions Made

- Built `/review-desk/[runId]/page.tsx` as a Client Component rather than following the `prompt-lab/[agentKey]/page.tsx` Server-Component-delegates-to-client-view split, because the plan's acceptance criteria require literal `SectionChipList`/`getDraft`/`PreviewIframe` imports inside `page.tsx` itself, and `getDraft` needs a live Clerk session token from `useAuth().getToken()`.
- Added a Route Handler (`app/api/review-desk/[runId]/preview-url`) not enumerated in the plan's `files_modified` — a minimal, scoped Rule-3 (blocking-issue) addition: `lib/previewToken.ts` explicitly documents itself as server-only, and importing it into the Client Component page would either break the client bundle (`node:crypto` has no browser polyfill) or leak `PREVIEW_SECRET`. The Route Handler keeps the secret server-side while letting the client page still mount the reused `PreviewIframe`.
- `EDITABLE_SECTIONS` is exported from `SectionChipList.tsx` (not redefined in the parent page) so Plan 05's per-section editors share one canonical section-id/order list.

## Deviations from Plan

**1. [Rule 3 - blocking issue] Added a preview-url Route Handler not listed in `files_modified`**
- **Found during:** Task 2
- **Issue:** The plan's acceptance criteria require `page.tsx` to directly import `PreviewIframe`, `SectionChipList`, and `getDraft` — all three need to coexist in a single Client Component (getDraft needs `useAuth().getToken()`, SectionChipList needs client-owned `selectedSection` state). But building the signed preview URL (`buildPreviewUrl` in `lib/previewToken.ts`) requires `PREVIEW_SECRET` and `node:crypto`, which must never reach the browser bundle.
- **Fix:** Added `apps/dispatch-control/app/api/review-desk/[runId]/preview-url/route.ts`, a thin server Route Handler (already covered by the standing `clerkMiddleware` auth on all `/api/*` routes) that resolves the slug and signs the URL server-side; the client page fetches it on demand when the preview is toggled on.
- **Files modified:** `apps/dispatch-control/app/api/review-desk/[runId]/preview-url/route.ts` (new)
- **Commit:** `f6c5bf1`

## Issues Encountered

- The EDT-05 tripwire initially failed against my own `contentPatchClient.ts` because its doc comments mentioned the literal forbidden strings (`@sanity/client`, `*.api.sanity.io`) in prose explaining what the module must never do. Reworded those two comments to describe the constraint without the literal substrings; both regressions were caught immediately by the test itself (as designed) and fixed before commit.

## User Setup Required

None — no external service configuration required. `PREVIEW_SECRET` / `NEXT_PUBLIC_WEB_PREVIEW_BASE` are pre-existing env vars from Phase 26; when unset, the preview toggle shows "Preview unavailable" gracefully (same fallback behavior as the existing run-monitor review screen).

## Next Phase Readiness

- Plan 05 can now drop per-section editor components into the `/review-desk/[runId]` right-pane slot, driven by `selectedSection` state and the `dirty` prop already wired on `SectionChipList`.
- `contentPatchClient.ts` exposes every save/upload function Plan 05 needs; `ContentPatchError.reason` is ready for the `revision_mismatch` / `validation_failed` branching Plan 05 must implement.
- The EDT-05 tripwire is live and will fail loudly if any future change reintroduces a direct Sanity write path in dispatch-control.

---
*Phase: 31-content-patch-endpoints-full-editing*
*Completed: 2026-07-07*

## Self-Check: PASSED

All 6 created/modified files confirmed present on disk; all 3 task commit
hashes (3837106, f6c5bf1, 92cf63a) confirmed in git log.
