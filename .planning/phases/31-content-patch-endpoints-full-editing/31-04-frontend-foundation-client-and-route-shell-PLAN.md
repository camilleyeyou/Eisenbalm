---
phase: 31-content-patch-endpoints-full-editing
plan: 04
type: execute
wave: 2
depends_on: [1]
files_modified:
  - apps/dispatch-control/lib/contentPatchClient.ts
  - apps/dispatch-control/app/(dashboard)/review-desk/page.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx
  - apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts
autonomous: true
requirements: [EDT-01, EDT-02, EDT-05]
user_setup: []

must_haves:
  truths:
    - "A contentPatchClient reaches the pipeline API via NEXT_PUBLIC_PIPELINE_URL with a Bearer token and surfaces structured {reason,message} 409/422 errors the editor can branch on"
    - "The dashboard has zero direct Sanity write paths — a source-scan tripwire forbids @sanity/client, createClient, and .api.sanity.io in apps/dispatch-control"
    - "/review-desk auto-focuses the current awaiting-review run; /review-desk/[runId] renders a section-chip list + the reused preview iframe"
  artifacts:
    - path: "apps/dispatch-control/lib/contentPatchClient.ts"
      provides: "patchSection/patchTheme/patchGame/uploadAsset/getDraft clients + ContentPatchError"
      contains: "NEXT_PUBLIC_PIPELINE_URL"
    - path: "apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts"
      provides: "EDT-05 source-scan tripwire"
      contains: "FORBIDDEN"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx"
      provides: "run editor shell (chip list + preview iframe)"
      contains: "SectionChipList"
  key_links:
    - from: "lib/contentPatchClient.ts"
      to: "pipeline API /issues/{runId}/*"
      via: "fetch with Bearer token, NEXT_PUBLIC_PIPELINE_URL base"
      pattern: "NEXT_PUBLIC_PIPELINE_URL"
    - from: "review-desk/[runId]/page.tsx"
      to: "run-monitor/.../review/_components/PreviewIframe.tsx"
      via: "reused import (D-02)"
      pattern: "PreviewIframe"
---

<objective>
Lay the dispatch-control frontend foundation the editor components mount into: a `contentPatchClient.ts` (mirroring `reviewClient.ts` — `NEXT_PUBLIC_PIPELINE_URL` base, Bearer token, typed structured errors for `revision_mismatch`/`validation_failed`), the EDT-05 no-direct-Sanity-writes source-scan tripwire (greenable immediately), and the real Review Desk route shell replacing the Phase 30 placeholder — `/review-desk` auto-focusing the current awaiting-review run (D-01) and `/review-desk/[runId]` rendering a section-chip list beside the reused preview iframe (D-02).

Purpose: Build against the §31 contract so the editor components (Plan 05) drop in without route/client rework; establish the write-boundary tripwire first.
Output: fetch client + source-scan test + route shell + SectionChipList.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/31-content-patch-endpoints-full-editing/31-CONTEXT.md
@.planning/phases/31-content-patch-endpoints-full-editing/31-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- reviewClient.ts pattern to clone (verified): -->
function pipelineBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_PIPELINE_URL
  if (!url) throw new Error('NEXT_PUBLIC_PIPELINE_URL is not set ...')
  return url.replace(/\/$/, '')
}
export class ReviewApiError extends Error { constructor(public status:number, public reason:string, message:string){...} }
// token from useAuth().getToken() passed as Authorization: Bearer <token>

<!-- EDT-05 source-scan design (from RESEARCH §"EDT-05 Source-Scan Test Design"): -->
const FORBIDDEN_IMPORTS = [/@sanity\/client/, /from ['"]sanity['"]/, /createClient\s*\(/, /\.api\.sanity\.io/]
// apps/dispatch-control/package.json currently has ZERO @sanity/* deps — baseline green.
// Precedents: apps/dispatch-control/__tests__/apps-web-no-clerk.test.ts, apps/web/__tests__/stripe-webhook-source.test.ts

<!-- Reuse (D-02): apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/PreviewIframe.tsx -->
<!-- Current placeholder to REPLACE: apps/dispatch-control/app/(dashboard)/review-desk/page.tsx (PlaceholderScreen) -->
<!-- awaiting-review run source: pipelineRuns / runs Convex queries already used by run-monitor -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: contentPatchClient.ts (mirrors reviewClient) + EDT-05 source-scan tripwire</name>
  <files>apps/dispatch-control/lib/contentPatchClient.ts, apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts</files>
  <read_first>
    - apps/dispatch-control/lib/reviewClient.ts (full — clone pipelineBaseUrl, ReviewApiError, Bearer-token fetch, 4xx {reason,message} parsing)
    - apps/dispatch-control/lib/testRunClient.ts (secondary reference for POST-with-body shape)
    - apps/dispatch-control/__tests__/apps-web-no-clerk.test.ts (source-scan recursion pattern to mirror)
    - apps/web/__tests__/stripe-webhook-source.test.ts (FORBIDDEN regex-array pattern)
    - docs/API_CONTRACTS.md §31.2/§31.3/§31.6/§31.7 (exact routes, payloads, headers)
  </read_first>
  <action>
**(A)** Create `apps/dispatch-control/lib/contentPatchClient.ts`:
- Private `pipelineBaseUrl()` identical to reviewClient's (reads `NEXT_PUBLIC_PIPELINE_URL`, throws if unset, strips trailing slash).
- `export class ContentPatchError extends Error` with `status: number` and `reason: string` (mirror `ReviewApiError`) so the editor branches on `reason === 'revision_mismatch'` (prompt reload, D-10) vs `'validation_failed'` (show field errors, D-08).
- A private `_contentFetch<T>(method, path, token, body?)` that sets `Authorization: Bearer ${token}`, `Content-Type: application/json`, and on non-2xx parses `{reason, message}` and throws `ContentPatchError(status, reason, message)`.
- Exported typed functions, all taking `(runId, token, payload)`:
  - `patchSection(runId, section, {ifRevisionID, blocks}, token)` -> `PATCH /issues/${runId}/sections/${section}` -> `{revisionId, warnings}`
  - `patchHeadline(runId, section, {ifRevisionID, headline}, token)`
  - `patchTheme(runId, {ifRevisionID, ...theme}, token)`
  - `patchGame(runId, {ifRevisionID, headline, description, embedCode}, token)`
  - `patchPdfDataPoints(runId, {ifRevisionID, ...}, token)`
  - `patchBonus(runId, payload, token)` / `patchDeliberationConversation(runId, {ifRevisionID, turns}, token)` / `patchPodcastTranscript(runId, {ifRevisionID, transcript}, token)`
  - `getDraft(runId, token)` -> `GET /issues/${runId}/draft` -> the §31.7 shape
  - `uploadAsset(runId, slot, file: Blob, {filename, contentType, ifRevisionID}, token)` -> `POST /issues/${runId}/assets/${slot}` with RAW binary body (`body: file`), headers `X-Filename`, `Content-Type: contentType`, `X-If-Revision-Id`, `Authorization: Bearer` — NOT `FormData` (matches the raw-binary server side, §31.6).
- Export TS interfaces for the payloads/results mirroring §31.

**(B)** Create `apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts` (EDT-05):
- `FORBIDDEN_IMPORTS = [/@sanity\/client/, /from ['"]sanity['"]/, /createClient\s*\(/, /\.api\.sanity\.io/]`.
- Recursively scan `apps/dispatch-control/{app,components,lib}` `.ts`/`.tsx` files; assert zero matches for each pattern (report the offending file+pattern on failure).
- Assert `apps/dispatch-control/package.json` has zero `@sanity/*` dependency entries (scan `dependencies` + `devDependencies` keys).
- This test must PASS immediately on the current tree (baseline is clean) and serves as the tripwire for this phase and future changes.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test -- --run dispatch-control-no-sanity-write 2>&1 | tail -8</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/lib/contentPatchClient.ts` exists; `grep -q "NEXT_PUBLIC_PIPELINE_URL" apps/dispatch-control/lib/contentPatchClient.ts`
    - `grep -q "class ContentPatchError" apps/dispatch-control/lib/contentPatchClient.ts` and it carries a `reason` field
    - `uploadAsset` sends a raw binary body (`grep -q "X-Filename" apps/dispatch-control/lib/contentPatchClient.ts`; `grep -q "FormData" apps/dispatch-control/lib/contentPatchClient.ts` returns NO hits)
    - `grep -q "getDraft" apps/dispatch-control/lib/contentPatchClient.ts` and at least `patchSection`, `patchTheme`, `patchGame` exported
    - the source-scan test file exists and `pnpm test -- --run dispatch-control-no-sanity-write` PASSES (0 violations on current tree)
    - the test's FORBIDDEN array includes `/@sanity\/client/` and `/\.api\.sanity\.io/`
  </acceptance_criteria>
  <done>contentPatchClient reaches the pipeline API for every §31 route with typed structured errors and raw-binary uploads; the EDT-05 tripwire passes and will fail on any future direct Sanity write.</done>
</task>

<task type="auto">
  <name>Task 2: Review Desk route shell — auto-focus run (D-01) + [runId] editor layout (D-02)</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/page.tsx, apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/page.tsx (current PlaceholderScreen — REPLACE)
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/page.tsx (how it resolves a run + reads awaiting-review; DO NOT edit it — D-03 keeps it byte-untouched)
    - apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/PreviewIframe.tsx (reuse import — D-02)
    - apps/dispatch-control/lib/previewToken.ts (HMAC preview-token flow the iframe uses)
    - docs/design/dispatch-control-v2/Dispatch Control - Review Desk Directions.dc.html (1c section-chip strip visual direction)
  </read_first>
  <action>
**(A)** Replace `apps/dispatch-control/app/(dashboard)/review-desk/page.tsx` with a client (or server+client) page that resolves the CURRENT awaiting-review run and redirects to `/review-desk/[runId]` (D-01: single operator, one issue/week). Query the awaiting-review run using the SAME Convex source run-monitor uses (`pipelineRuns` / `runs` — reuse the existing query hook or lib). If exactly one awaiting-review run exists, `redirect`/`router.replace` to its `[runId]`. If multiple, render a minimal run switcher (list of awaiting-review runs, each linking to `/review-desk/[runId]`). If none, render an empty state ("No issue is awaiting review.") using the 1c PlaceholderScreen-style chrome. Do NOT hardcode a run id.

**(B)** Create `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx`:
- Fetch the draft via `getDraft(runId, token)` (contentPatchClient) — token from `useAuth().getToken()`; handle loading/error.
- Two-pane layout (1c tokens, hard-edged surfaces): LEFT = `<SectionChipList>` (Task 3) listing the editable surfaces; RIGHT = a slot that renders the selected section's editor (Plan 05 fills the editors — for now render a "Select a section" placeholder + mount `<PreviewIframe>` reused from run-monitor, toggleable per D-02).
- Track `selectedSection` state; the chip list sets it. Add a static advisory note near the header (rerun-clobber ordering rule, §31.9): e.g. "Re-roll a section before editing — re-rolling after an edit overwrites console changes." (small muted text — the minimum-viable position from the phase constraint).
- Reuse `PreviewIframe` by importing it from its existing path (do not copy it).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm build 2>&1 | tail -15</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/app/(dashboard)/review-desk/page.tsx` no longer imports `PlaceholderScreen` as its sole content (`grep -q "awaiting" apps/dispatch-control/app/(dashboard)/review-desk/page.tsx` — it resolves the awaiting-review run)
    - `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` exists and imports `SectionChipList` and `getDraft`
    - `grep -q "PreviewIframe" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx` (reused, not copied — import path points at run-monitor's component)
    - the rerun-clobber advisory string is present in the [runId] page (`grep -qi "re-roll\|rerun\|overwrite" apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx`)
    - `apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/` is byte-unchanged (`git diff --stat` shows no changes under that path — D-03)
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>The Review Desk is real: /review-desk auto-focuses the awaiting-review run, /review-desk/[runId] shows the chip list + reused preview iframe + rerun-clobber advisory; the Phase 26 review page is untouched; the app builds.</done>
</task>

<task type="auto">
  <name>Task 3: SectionChipList component (jump-nav precursor to the galley chip strip)</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx (Task 2 — the parent that owns selectedSection state)
    - docs/design/dispatch-control-v2/README.md (Review Desk "section-status chip strip" the chip list anticipates — Phase 32 upgrades it in place)
    - .planning/phases/31-content-patch-endpoints-full-editing/31-RESEARCH.md (Field Inventory — the full editable-surface list)
  </read_first>
  <action>
Create `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx`:
- Props: `{ sections: string[] | SectionMeta[]; selected: string; onSelect: (id: string) => void; dirty?: Record<string, boolean> }`.
- Render one chip per editable surface, in reading order: `originStory`, `problemStatement`, `founderBio`, `caseStudy`, `bonus`, `game`, `deliberation-conversation`, `podcast`, `theme`. Human-readable labels ("Origin Story", "Problem", "Founder Bio", "Case Study", "Bonus", "Game", "Deliberation", "Podcast", "Theme").
- Selected chip visually distinct (1c tokens: ink/cobalt); a dirty chip (from `dirty[id]`) shows an unsaved-dot indicator (D-07 dirty-state). Chips are buttons, keyboard-focusable, ≥44px hit target, `onClick`/`onSelect`.
- Visually anticipate the design's galley chip strip (README) so Phase 32 upgrades it in place — no route/prop rework later.
Keep it a presentational client component; the parent owns state and save wiring (Plan 05).
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm build 2>&1 | tail -12</automated>
  </verify>
  <acceptance_criteria>
    - `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionChipList.tsx` exists
    - it renders chips for at least the 9 surfaces named above (`grep -q "Origin Story" ...SectionChipList.tsx` and `grep -q "Theme" ...SectionChipList.tsx`)
    - chips are `<button>` elements with an `onClick`/`onSelect` handler and a dirty indicator driven by a `dirty` prop
    - `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>SectionChipList renders keyboard-accessible jump-nav chips with selected + dirty states, anticipating the galley chip strip; the app builds.</done>
</task>

</tasks>

<verification>
- `pnpm test -- --run dispatch-control-no-sanity-write` — EDT-05 tripwire green
- `pnpm --filter dispatch-control build` — exits 0 (strict build, not just vitest — per the standing memory rule)
- Phase 26 review page unchanged (git diff clean under run-monitor/.../review/)
</verification>

<success_criteria>
- contentPatchClient covers every §31 route with typed structured errors + raw-binary upload
- EDT-05 source-scan tripwire exists and passes (no direct Sanity writes)
- /review-desk auto-focuses the awaiting-review run; /review-desk/[runId] shows chip list + reused preview iframe + rerun-clobber advisory
- dispatch-control build is clean; the Phase 26 review page is byte-untouched
</success_criteria>

<output>
After completion, create `.planning/phases/31-content-patch-endpoints-full-editing/31-04-SUMMARY.md`
</output>
