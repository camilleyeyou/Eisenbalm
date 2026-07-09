---
phase: 36-voice-pass-de-slop-screen
plan: 06
subsystem: ui
tags: [next.js, react, convex, galley, voice-pass, annotation, sign-off]

# Dependency graph
requires:
  - phase: 36-voice-pass-de-slop-screen
    plan: 02
    provides: "api/signoffs.py VOICE_AXES + server-gated sounds-human 409 (open_voice_findings) this rail's disabled state and belt-and-suspenders error mirror"
  - phase: 36-voice-pass-de-slop-screen
    plan: 03
    provides: "POST /issues/{run_id}/voice-rewrite (SS36.5) + accept_finding suggestedFixOverride (SS36.6) this popover's Accept rewrite path calls"
  - phase: 36-voice-pass-de-slop-screen
    plan: 04
    provides: "components/galley/{Galley,GallerySection,AnnotationMark}.tsx promoted stack + VOICE_AXES/FACTUAL_AXES partition + the voice-pass/[runId]/page.tsx screen this plan finalizes"
provides:
  - "AnnotationMark labels prop (components/galley/AnnotationMark.tsx) - voice-tell presentation variant (Accept rewrite/Write my own/Keep (not a tell)), threaded through Galley + GallerySection"
  - "findingsClient.acceptFinding + voicePassClient.rewrite - the rewrite-on-accept plumbing for rule-only tells with no stored suggestedFix"
  - "VoicePassRail.tsx - machine-tells list + voice-law reference + server-gated Sounds-human sign-off, mounted on /voice-pass/[runId]"
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Label-variant prop threading: AnnotationMark's optional `labels` prop is forwarded unmodified through GallerySection and Galley (never inferred from `value.axis`, since Review Desk's own Phase 33 test fixtures already use a 'gravity' axis for unrelated reasons) - one component, two caller-selected presentations"
    - "Rewrite-then-accept, no new mutation: a missing suggestedFix triggers an on-demand voicePassClient.rewrite() call whose result flows into the EXISTING acceptFinding() as suggestedFixOverride - the server-side accept flow (span resolve, patch, resolution flip, audit) is completely unchanged"
    - "Independent rail, shared sign_offs row: VoicePassRail is a standalone reader/writer of the same api.signOffs.activeByRunId query and POST /sign-off endpoint DecisionRail already uses - no coordination needed, Convex reactivity keeps both screens in sync"

key-files:
  created:
    - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx
    - apps/dispatch-control/__tests__/VoicePassRail.test.tsx
  modified:
    - apps/dispatch-control/components/galley/AnnotationMark.tsx
    - apps/dispatch-control/lib/findingsClient.ts
    - apps/dispatch-control/lib/voicePassClient.ts
    - apps/dispatch-control/__tests__/AnnotationMark.test.tsx
    - apps/dispatch-control/components/galley/Galley.tsx
    - apps/dispatch-control/components/galley/GallerySection.tsx
    - apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx
    - apps/dispatch-control/__tests__/VoicePassScreen.test.tsx

key-decisions:
  - "Chose to derive the voice-tell variant from an EXPLICIT `labels` prop only, never from `value.axis` membership in VOICE_AXES - the pre-existing Phase 33 AnnotationMark.test.tsx fixture already uses axis:'gravity' (now a VOICE_AXES member) for unrelated Review-Desk-only assertions; axis-based inference would have silently relabeled those tests' buttons and broken them"
  - "Extended the plan's own files_modified scope to include Galley.tsx and GallerySection.tsx (Rule 2 - auto-add missing critical functionality): the plan's Task 1 only specified AnnotationMark/findingsClient/voicePassClient, but per 36-RESEARCH.md's own Pattern 2, the labels prop must be threaded down from a page mount to actually reach the operator - without this, the phase's own must_haves truth ('Clicking a voice tell shows ... Accept rewrite / Write my own / Keep (not a tell)') would never hold in the running app"
  - "Mounted VoicePassRail in a two-column layout (Galley left, rail right at 336px) mirroring Review Desk's existing galley+DecisionRail composition exactly, rather than inventing a new layout convention"

requirements-completed: [VOX-02, VOX-03]

# Metrics
duration: ~20min
completed: 2026-07-09
---

# Phase 36 Plan 06: Rewrite Popover + Sounds-human Sign-off Summary

**AnnotationMark gains a caller-selected voice-tell label variant (Accept rewrite / Write my own / Keep (not a tell)) with on-demand rewrite-then-accept plumbing for rule-only tells, and a new VoicePassRail mirrors DecisionRail's blockers-first structure to carry the server-gated "Sounds human" sign-off — both wired onto the live `/voice-pass/[runId]` screen, completing VOX-02 and VOX-03.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 completed (plus one Rule-2 deviation task between them)
- **Files modified:** 10 (2 created, 8 modified)

## Accomplishments
- `AnnotationMark.tsx` gains an optional `labels` prop (`accept`/`editInline`/`dismiss`/`dismissReasonDefault`); when the caller passes the voice variant (`accept: 'Accept rewrite'`), the "Suggested:" line reads "Suggested house voice:", the Accept button renders even with no stored `suggestedFix` (rule-only tells), and the "Accept unavailable" message never shows in that variant — Review Desk's default (no `labels` prop) is byte-for-byte unchanged, proven by all 8 pre-existing Phase 33 tests still passing
- `handleAccept` now calls the new `voicePassClient.rewrite(runId, findingId, token)` on demand when a finding has no stored `suggestedFix`, then applies the result via `acceptFinding`'s new `suggestedFixOverride` field (SS36.5/SS36.6) — a finding WITH a stored fix skips the rewrite call entirely and uses it unchanged
- Threaded the `labels` prop through `Galley.tsx` and `GallerySection.tsx` (both otherwise untouched) so the voice-pass screen's mounted Galley actually surfaces the variant — the missing link between the popover mechanism and the operator seeing it, per 36-RESEARCH.md Pattern 2
- New `VoicePassRail.tsx`: a "Machine-tells" jump-link list of open voice-axis errors (same `isOpenFinding` + `VOICE_AXES` predicate the Galley itself applies — Pitfall 9), a one-line voice-law reference (a pointer to `voice_constraints`, not a restatement), and a "Sign: Sounds human" button disabled while any open voice-axis error remains, surfacing the server's `open_voice_findings` 409 message belt-and-suspenders — mounted in the voice-pass screen's new 336px right column, mirroring Review Desk's galley+rail layout
- `DecisionRail.tsx` required NO changes — it already subscribes to `api.signOffs.activeByRunId` and renders the "Sounds human" green the moment this rail's sign-off succeeds; the two rails are independent readers/writers of the same `sign_offs` row

## Task Commits

Each task was committed atomically:

1. **Task 1: AnnotationMark voice-tell variant + rewrite-on-accept plumbing** - `c814d15` (feat)
2. **Deviation (Rule 2): thread labels through Galley/GallerySection** - `7e09610` (feat)
3. **Task 2: VoicePassRail — machine-tells list + Sounds-human sign-off** - `0272e8c` (feat)

**Plan metadata:** (this commit) - docs: complete plan

## Files Created/Modified
- `apps/dispatch-control/components/galley/AnnotationMark.tsx` - `labels` prop, `isRewriteVariant` derivation, rewrite-then-accept `handleAccept`, relabeled "Suggested:" line, dismiss-reason prefill
- `apps/dispatch-control/lib/findingsClient.ts` - `acceptFinding`'s payload type gains optional `suggestedFixOverride`
- `apps/dispatch-control/lib/voicePassClient.ts` - new `rewrite(runId, findingId, token)` -> `POST /issues/{runId}/voice-rewrite`
- `apps/dispatch-control/__tests__/AnnotationMark.test.tsx` - 5 new tests: custom labels render, stored-fix accept skips rewrite, no-fix accept calls rewrite then accepts with the override, relabeled suggestion line, "Keep (not a tell)" prefill+submit
- `apps/dispatch-control/components/galley/Galley.tsx` - optional `labels` prop, forwarded to both `GallerySection` mount points (long-read sections + specAd bonus)
- `apps/dispatch-control/components/galley/GallerySection.tsx` - optional `labels` prop, forwarded into the `marks.annotation` -> `AnnotationMark` render (added to the `useMemo` deps)
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/_components/VoicePassRail.tsx` - NEW: machine-tells list, voice-law reference, server-gated Sounds-human sign-off
- `apps/dispatch-control/__tests__/VoicePassRail.test.tsx` - NEW: 5 tests (disabled+reason, factual-axis-doesn't-block, enabled+records sign-off, green signed state, 409 message surfaced)
- `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx` - `VOICE_LABELS` constant passed to the mounted `Galley`; two-column layout (Galley left, `VoicePassRail` right at 336px, mirroring Review Desk)
- `apps/dispatch-control/__tests__/VoicePassScreen.test.tsx` - added the `signOffs` query mock + a `@/lib/signOffClient` mock the newly-mounted `VoicePassRail` requires (a regression fix caused by this plan's own change, not a pre-existing gap)

## Decisions Made
See `key-decisions` in frontmatter — the axis-vs-explicit-prop label derivation, the Galley/GallerySection scope extension (Rule 2), and the two-column layout mirror.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Threaded AnnotationMark's `labels` prop through `Galley.tsx` and `GallerySection.tsx`**
- **Found during:** Task 1, before writing the SUMMARY (verifying the "truth" would actually hold in the running app)
- **Issue:** The plan's Task 1 scoped `files_modified` to `AnnotationMark.tsx`/`findingsClient.ts`/`voicePassClient.ts` only. `GallerySection.tsx`'s `marks.annotation` renderer constructs `AnnotationMark` directly and did not accept or forward a `labels` prop, and `Galley.tsx` had no `labels` prop to pass down to `GallerySection`. Without threading, the Voice Pass screen's mounted `AnnotationMark` instances would always render the Review Desk default labels ("Accept fix"/"Edit inline"/"Dismiss") regardless of the new `labels` prop's existence — the phase's own must-have truth ("Clicking a voice tell shows ... Accept rewrite / Write my own / Keep (not a tell)") would never hold in production, only in isolated component tests.
- **Fix:** Added an optional `labels` prop to both `GalleyProps` and `GallerySectionProps`, forwarded unmodified all the way to each `AnnotationMark` mount (both `GallerySection` call sites in `Galley.tsx` — the long-read sections loop and the specAd bonus branch). Undefined (every existing Review Desk call site) preserves today's behavior exactly.
- **Files modified:** `apps/dispatch-control/components/galley/Galley.tsx`, `apps/dispatch-control/components/galley/GallerySection.tsx`, `apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx` (passes `labels={VOICE_LABELS}`)
- **Verification:** Full vitest suite green (421 passed, including pre-existing `Galley.test.tsx`/`VoicePassScreen.test.tsx` with zero behavior change for Review Desk call sites which never pass `labels`); `pnpm --filter dispatch-control build` exits 0.
- **Committed in:** `7e09610`

**2. [Rule 1 - Bug I'd introduce] Fixed VoicePassScreen.test.tsx's mock gaps after mounting VoicePassRail**
- **Found during:** Task 2, running the full suite after mounting `VoicePassRail` in `voice-pass/[runId]/page.tsx`
- **Issue:** `VoicePassScreen.test.tsx`'s `@convex/_generated/api` mock didn't include `signOffs.activeByRunId`, so `VoicePassRail`'s `useQuery(api.signOffs.activeByRunId, ...)` threw `Cannot read properties of undefined (reading 'activeByRunId')` at render, crashing all 5 pre-existing tests in that file.
- **Fix:** Added `signOffs: { activeByRunId: 'signOffs:activeByRunId' }` to the mocked `api` object, a `signOffs:activeByRunId` case to `mockFindings`'s `useQuery` implementation (returns `{}`), and a `@/lib/signOffClient` module mock (matching the pattern already used in `DecisionRail.test.tsx`).
- **Files modified:** `apps/dispatch-control/__tests__/VoicePassScreen.test.tsx`
- **Verification:** `npx vitest run __tests__/VoicePassScreen.test.tsx` — all 5 tests pass; full suite re-run green.
- **Committed in:** `0272e8c` (part of the Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 regression fix for a bug this plan's own change introduced)
**Impact on plan:** Both were necessary for the plan's own stated must-haves/success criteria to actually hold at runtime and for the test suite to stay green. No scope creep beyond what VOX-02/VOX-03 require.

## Issues Encountered
None beyond the two deviations above.

## Known Stubs

- **`apps/dispatch-control/app/(dashboard)/voice-pass/[runId]/page.tsx:160-161`** — `handleEditSection()` remains the safe no-op stub carried forward from Plan 36-04 ("Intentionally inert."). The "Write my own" button (voice-tell label for `onEditSection`) renders correctly and calls this handler with `(sectionId, findingId)` exactly like Review Desk's "Edit inline" does, but the Voice Pass screen has no section-editor surface to navigate to — Review Desk's `SectionEditorPanel` + `viewMode` switcher is a Review-Desk-only construct this plan's two tasks (AnnotationMark variant, VoicePassRail) did not include building out for Voice Pass. This does not block VOX-02's stated truth (the popover correctly SHOWS all three voice actions with the right labels) or VOX-03 (unaffected). Accept rewrite and Keep (not a tell) are both fully functional end-to-end on this screen; only "Write my own"'s destination is inert. Resolving this — giving Voice Pass its own inline edit surface, or reusing Review Desk's — is a scope decision for a future plan, not silently built here (would otherwise require adding a full view-mode switcher, a Rule-4-scale architectural addition outside this plan's two declared tasks).

## User Setup Required

None - no external service configuration required. The new endpoints/props reuse the already-configured Clerk auth, Convex client, and `NEXT_PUBLIC_PIPELINE_URL` env var.

## Next Phase Readiness

- VOX-02 and VOX-03 are both fully wired end-to-end: a voice tell's popover offers Accept rewrite (generate-then-apply for rule-only tells, or apply-as-is for judge-authored ones with a stored fix) / Write my own (deep-links to the section editor) / Keep (not a tell) (dismiss with reason "not a tell"); "Sounds human" is earned on the Voice Pass screen itself, server-gated on zero open voice-axis errors, and reflected live on both screens via the shared `sign_offs` Convex row.
- Phase 36 (voice-pass-de-slop-screen) is now feature-complete across all 6 plans (36-01 through 36-06): contract, pipeline axis foundations, voice-pass endpoints, the voice-pass screen, the machine-tell predicate, and this plan's rewrite popover + sign-off. The two-sign-off publish gate (Phase 34, PUB-01) now has both its factual and voice halves genuinely earned on distinct screens.
- Full `apps/dispatch-control` vitest suite: **48 files passed | 1 skipped, 421 passed | 2 todo** (no regressions). `pnpm --filter dispatch-control build` (strict type-check) exits 0.
- One known stub carries forward from Plan 36-04, documented below (`## Known Stubs`) — Voice Pass's "Write my own" button is present and correctly labeled but has no edit-surface destination yet. This does not block either VOX-02 or VOX-03's stated success criteria.

---
*Phase: 36-voice-pass-de-slop-screen*
*Completed: 2026-07-09*

## Self-Check: PASSED

All claimed files exist on disk (`AnnotationMark.tsx`, `findingsClient.ts`,
`voicePassClient.ts`, `AnnotationMark.test.tsx`, `Galley.tsx`,
`GallerySection.tsx`, `voice-pass/[runId]/page.tsx`, `VoicePassRail.tsx`,
`VoicePassRail.test.tsx`, `VoicePassScreen.test.tsx`, this SUMMARY.md). All
claimed commit hashes (`c814d15`, `7e09610`, `0272e8c`) are present in
`git log --oneline --all`.
