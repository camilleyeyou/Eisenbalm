---
phase: 51-section-read-and-fix-in-place
verified: 2026-08-01T09:35:00Z
status: human_needed
score: 5/5 must-haves automated-verified; 3/5 carry an unverified perceptual sub-claim
human_verification:
  - test: "Open /s/originStory with a live pipeline draft. Confirm the reading column measures roughly 760px, body copy is visibly Lora and larger than Review Desk's galley type, and there is no sidebar, masthead, tab strip, stage nav or form field above the prose. Confirm the header scrolls away (not sticky)."
    expected: "The surface reads as 'a page to read, not a workspace to navigate' — the phase's own stated bar for success criterion 1."
    why_human: "jsdom has no layout engine. Automated tests can and do assert the .section-reader wrapper class is present, that aside/form/input elements are absent, and that globals.css literally contains max-width:760px / font-size:17.5px — but none of that proves the rendered page reads as intended. This exact check was never run: the plan's own blocking human-verification checkpoint (51-06 Task 2) was skipped by explicit user decision after a CORS gap blocked any draft from loading in a local browser."
  - test: "Find a section (or two) carrying fact, voice and unsourced-claim problems together. Confirm each marked span carries a readable Fact / Voice / Source word beside it without opening anything, then switch the display to greyscale (macOS Accessibility → Display → Color Filters → Grayscale) and confirm the three kinds are still distinguishable."
    expected: "Colour is never the only signal separating the three problem kinds."
    why_human: "Automated tests prove the text label renders in the DOM and prove the tag colour is a fixed, non-axis-coded var(--color-ink-soft) (so colour cannot be the differentiator by construction) — a real structural guarantee. What they cannot prove is that the label is legible/prominent enough in practice. Not performed for the same CORS-blocked reason as above."
  - test: "Open a claim popover in Chrome DevTools and inspect the actual rendered DOM tree for a reparented/auto-closed <p>."
    expected: "No block-level element leaks into or breaks the popover's phrasing-content structure."
    why_human: "jsdom does not validate HTML content models, so the passing Vitest assertion (container.querySelector('.galley-popover div') is null, etc.) is an explicit structural PROXY, per the plan's own documentation, not a proof of real-browser DOM validity. Not performed — same CORS blocker."
  - test: "Accept a suggestion, edit a passage by hand and save it, and dismiss a finding (confirm the one-line reason is still required) — all without leaving the paragraph. Then click through prev/next to the first and last sections, and open /s/game, /s/podcast, /s/theme and /s/deliberation-conversation. Finally confirm /run, /review-desk/{runId} and /voice-pass/{runId} still work with no 'Mark reviewed' button anywhere."
    expected: "All of the above matches 51-UI-SPEC.md's contract and no v4.0 console surface regressed."
    why_human: "This is the full 8-item checklist from the phase's own 51-06 Task 2 checkpoint. Every item has strong automated coverage (SectionReaderPage.test.tsx's in-place-edit/group-accept/nav describes, StoryDeskGrid/StoryFocusView/ReviewDeskRunView tests, a green strict build with every v4.0 route present in the route table) but none of it has been seen rendered in a browser."
  - test: "Judge whether ClaimProvenanceCard's new raw-sourceUrl visible-text line (added by plan 51-07 to satisfy its own locked test) reads acceptably on Review Desk Stage 3 Fact Check, Stage 5 Approval, and Voice Pass — the three v4.0 surfaces that mount the same shared card."
    expected: "A product/design decision: either the change is fine as shipped, or it needs its own follow-up."
    why_human: "This is an open, explicitly-flagged decision, not a code defect — no existing test asserts an exact-string Source-field match that would have caught or blocked it, and the change is additive (the derived publisher name line is untouched; the raw URL is a new line beneath it). It was necessary to satisfy this phase's own locked evidence-card assertion and could not be forked per-caller under the reuse discipline (D-09/D-16), so it landed in the one shared component and therefore reached three other consoles as a side effect. Nobody has looked at it in a browser."
---

# Phase 51: Section — Read and Fix in Place Verification Report

**Phase Goal:** An editor can read any section of the current issue as full-width prose and fix a factual, voice, or unsourced-claim problem without leaving the paragraph — the riskiest assumption in the redesign, tested first, reusing the galley/annotation/finding-resolution system wholesale.

**Verified:** 2026-08-01T09:35:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Summary

Every artifact this phase claims to have built exists, is wired end-to-end, and is covered by tests that this verification independently re-ran (not taken on the SUMMARYs' word). The engineering is genuinely solid: 148 test files / 1245 tests passed / 0 failed, a clean strict `next build` with `/s/[section]` and every v4.0 console route present in the route table, and every one of the ten invariant source-scans from the phase's own integration gate reproduced the same clean result independently.

But the phase's own plan (51-06 Task 2) required a human to actually look at the rendered surface before the phase could be called done, specifically because three of its success criteria are inherently perceptual and jsdom cannot settle them. That checkpoint was never run — a pre-existing CORS gap between the local dev server and the production pipeline blocked every draft from loading in a browser, and the user chose to close the phase without it after being offered two unblock routes. This is honestly recorded in `51-06-SUMMARY.md` and `51-VALIDATION.md` (`status: automated-gates-passed / human-demo-path-pending`) and correctly reflected with asterisks in `REQUIREMENTS.md`. This verification agrees with that self-assessment: the code is not the gap, the missing human read-through is, and per this task's own instructions a `passed` verdict resting on jsdom-only evidence for an inherently perceptual criterion would be overclaiming.

## Goal Achievement

### Observable Truths (Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Editor reads a section as full-width prose (~760px, Lora, no side rails, no form fields) — "a page to read, not a workspace to navigate" | ⚠ NEEDS HUMAN | Structural half VERIFIED: `.section-reader` wrapper class asserted present, `aside`/`form`/`input` asserted absent (`SectionReaderPage.test.tsx` `renders` describe, re-run independently, green). CSS values confirmed literally present in `globals.css` (`max-width: 760px`, `.section-reader .galley-body { font-size: 17.5px }`, unrelated shared rules `.galley-body` 16.5px / `[id^='galley-']` 88px unchanged). The perceptual half ("reads as a page to read") was never rendered in a browser — see human_verification. |
| 2 | Every fact, voice and unsourced-claim problem is marked in the sentence it affects, each carrying a text label as well as colour | ⚠ NEEDS HUMAN (structurally strong) | VERIFIED in code and tests: `Galley` mount on `/s/[section]` omits `includeAxes` entirely (grep-confirmed no occurrence under `app/(editorial)/`) so fact+voice+claim all render together (D-06); `showAxisTag` renders "Fact"/"Voice" text beside `AnnotationMark` spans and "Source" beside unsourced `ClaimMark` spans, readable without opening the popover (asserted pre-click in tests); the tag colour is a single fixed `var(--color-ink-soft)` for every axis, never axis-coded, so colour cannot by construction be the sole differentiator. Greyscale legibility itself was never eyeballed — see human_verification. |
| 3 | Opening a marked problem shows the agent's reasoning and its evidence without leaving the paragraph | ⚠ NEEDS HUMAN (functionally strong) | VERIFIED: `AnnotationMark`'s popover mounts `<ClaimProvenanceCard claim={claim} phrasingSafe />` beneath the reason, read-only (no `actions` passed); the lookup deliberately reads the UNFILTERED `claimResolvedForLookup` array, not the D-09-filtered `claimResolved` render array (grep-confirmed: `buildFindingClaimMap(resolved, claimResolvedForLookup ?? claimResolved ?? [])`), so a finding on a *sourced* claim (the load-bearing case, since `sourceUrl`/`retrievedAt` exist only on sourced rows) still resolves its evidence even though D-09 suppressed that claim's own wash — pinned by one real-pipeline test asserting both facts in a single render (`Galley.test.tsx -t 'D-09 and D-20 are independent'`, independently re-run, green). The jsdom structural proxy (no `div`/`p`/`h3` inside `.galley-popover`) passes, but it is explicitly a proxy, not proof of real-browser DOM validity — see human_verification. |
| 4 | Editor can accept a correction in one action (including every recurrence), edit the passage themselves, or dismiss with the required reason | ✓ VERIFIED | Fully functional, non-perceptual, and fully tested: group accept renders `"Accept suggestion (applies to N places)"`, runs `acceptFinding` sequentially carrying the previous call's fresh `revisionId` (no `Promise.all`/`allSettled`, grep-confirmed), and reports `"{X} of {Y} applied — {Z} still need you."` on partial failure. In-place edit is a controlled textarea with `Save edit`/`Cancel edit`, routes `bonus` to `patchBonus` and the four long-reads to `patchSection`, and shows the exact 409 copy. Dismiss reuses `AnnotationMark`'s pre-existing, untouched flow — the Dismiss button is disabled while the reason field is empty (`dismissReason.trim() === ''`), unchanged by this phase. All of `SectionReaderPage.test.tsx`'s `in-place edit` and `group accept` describes pass in the independently re-run suite. |
| 5 | Editor can move prev/next without returning to the issue, and sees a derived still-need-you count | ✓ VERIFIED | Fully functional, non-perceptual, and fully tested: `SectionEndNav` always names the destination (`← Origin Story` / `Problem →`), never a bare Previous/Next, never disabled; the first section shows only Next, the last only Previous (independently re-run, green). The count sentence is computed from `deriveSectionStates`/`EDITABLE_SECTIONS.length`, never hard-coded or manually set. The old "Mark reviewed" bookkeeping is completely gone: `grep -rn "useReviewedSections\|reviewedIds\|onToggleReviewed\|Mark reviewed"` across the whole app returns zero matches (independently re-run). |

**Score:** 5/5 truths have solid, independently-reproduced automated backing. 3/5 (SC-1, SC-2, SC-3) additionally carry a perceptual component that automated tooling structurally cannot settle, and the phase's own plan required — but did not get — a human look before shipping.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `app/(editorial)/layout.tsx` | Sibling shell, own provider stack, zero console chrome | ✓ VERIFIED | Exists; `InspectorProvider`/`ConfirmProvider`/`CommandPaletteProvider` present; no `AppSidebar`/`Masthead`/`MobileNavDrawer`/`AutoPublishBanner`/`OnboardingProvider`; no `page.tsx` at group root |
| `app/(editorial)/s/[section]/page.tsx` | The reading surface | ✓ VERIFIED | Exists, `'use client'`, `useCurrentRun` (never `Math.max`), `EDITABLE_SECTIONS` validation + `notFound()`, `.section-reader` wrapper, `aria-busy` skeleton, `Galley` mounted with `sections={[sectionId]}`, `generateFixOnAccept`, `showAxisTag`, `markSourcedClaims={false}`, `showClaimEvidenceInFindings` |
| `_components/SectionHeader.tsx`, `SectionEndNav.tsx`, `ExemptSectionNote.tsx`, `InPlaceBlockEditor.tsx` | Slim header, end-nav, exempt copy, in-place editor | ✓ VERIFIED | All exist and wired into `page.tsx`; grep-confirmed locked copy strings present verbatim |
| `lib/editableSections.ts` | Canonical `EDITABLE_SECTIONS`/`SectionMeta` | ✓ VERIFIED | 9 entries; `derivedState.ts` imports downward; `SectionChipList.tsx` re-exports (Review Desk compiles unchanged) |
| `lib/galley/findingGroups.ts` | Pure grouping selector | ✓ VERIFIED | `groupFindings`/`groupForFinding` exported; no Convex/React/fetch import; 10 unit tests pass |
| `lib/galley/findingClaimLink.ts` | Pure finding↔claim intersection selector | ✓ VERIFIED | `claimForFinding`/`buildFindingClaimMap` exported; character-range overlap predicate present; `spanResolver.ts` untouched (`git diff --name-only` empty); 10 unit tests pass |
| `components/provenance/ClaimProvenanceCard.tsx` `phrasingSafe` mode | Zero block-level elements under the flag | ✓ VERIFIED | `Box`/`Txt` alias pattern present; default mode unchanged (existing tests pass); `ClaimProvenanceRow` untouched |
| `components/galley/AnnotationMark.tsx` / `ClaimMark.tsx` / `GallerySection.tsx` / `Galley.tsx` primitives | `generateFixOnAccept`, `showAxisTag`, `markSourcedClaims`, `findingGroup`, `showClaimEvidenceInFindings`/`claimResolvedForLookup` | ✓ VERIFIED | All present, all additive/optional, all threaded through `useMemo` dependency arrays where required; Review Desk/Voice Pass callers pass none of them and render byte-identically (their own test suites unchanged and green) |
| `useReviewedSections.ts` | Deleted (D-25) | ✓ VERIFIED | File absent on disk; zero repo-wide references to the hook, its localStorage key, "Mark reviewed", `reviewedIds`, `onToggleReviewed`, `isReviewed`, `nextUnreviewed` |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `page.tsx` | `useCurrentRun` | current-run resolution, never `max(issueNumber)` | ✓ WIRED | Grep-confirmed; no `Math.max`/`max(issueNumber)` anywhere under `(editorial)/` |
| `page.tsx` | `Galley.tsx` | single-section mount, `sections={[sectionId]}`, no `includeAxes` | ✓ WIRED | Confirmed in source; D-06 (all axes merged) holds |
| `Galley.tsx` | `AnnotationMark.tsx`/`ClaimMark.tsx` | `showAxisTag`/`generateFixOnAccept` threaded via `GallerySection` | ✓ WIRED | Present in all four files, in the `useMemo` dep arrays |
| `Galley.tsx` render path | `toSyntheticBlocks` | `claimsForRender` filters the OUTPUT of `resolveClaimsFor`, not the input | ✓ WIRED | Sourced claims never reach `toSyntheticBlocks` when `markSourcedClaims={false}` — a genuine DOM-level removal (no `<mark>`, nothing in the a11y tree), not a CSS suppression. Confirmed by direct source trace, not just the passing test. |
| `GallerySection.tsx` | `findingClaimLink.buildFindingClaimMap` | lookup consumes `claimResolvedForLookup` (UNFILTERED), never the D-09-filtered `claimResolved` | ✓ WIRED | Grep-confirmed: `buildFindingClaimMap(resolved, claimResolvedForLookup ?? claimResolved ?? [])`; both `Galley.tsx` mounts pass `claimResolvedForLookup={claimResolvedAll}`. The one prior known regression risk this phase called out by name (routing the lookup through the filtered array) did not happen. |
| `AnnotationMark.tsx` | `ClaimProvenanceCard.tsx` | `phrasingSafe` mount, no `actions` (read-only) | ✓ WIRED | Confirmed in source |
| `ReviewDeskRunView.tsx`/`StoryDeskGrid.tsx`/`StoryFocusView.tsx` | `chipCounts[...].open`/`.error` | `nextNeedsYouAfter`, `statusFor`, "Clean" badge — all derived, none manual | ✓ WIRED | Confirmed in source; `nextUnreviewed`/`isReviewed` gone |
| `InPlaceBlockEditor.tsx` | `contentPatchClient.patchSection`/`patchBonus` | `bonus` routed to `patchBonus` (not in `patchSection`'s 4-value allow-list) | ✓ WIRED | Confirmed via plan text + passing `Save edit calls patchBonus, never patchSection` test |

### Data-Flow Trace (Level 4)

`page.tsx` renders `draft` from a real `getDraft(runId, token)` call against the pipeline API (same shape/client `ReviewDeskRunView` already uses), and `derivationInputs`/`qaFindings`/`claimRows` from `useCurrentRun()`'s real Convex queries — no hardcoded or mocked fixture in production code. The "loading" state explicitly gates on `qaFindings`/`claimRows` being `undefined`, never rendering "clean" before both have resolved (D-21), which this verification confirmed by direct source read. Nothing here is hollow; the CORS gap that blocks a *browser* read-through is an environment/config issue (production pipeline's `DASHBOARD_ALLOWED_ORIGINS` has no `localhost` entry), not a code defect, and does not affect the production deployment path (Vercel's origin is already allowlisted).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Full Vitest suite, independently re-run (not quoted from any SUMMARY) | `pnpm --filter dispatch-control test` | 148 files / 1245 tests passed, 0 failed, 1 skipped, 2 todo | ✓ PASS |
| Strict Next.js build, independently re-run | `pnpm --filter dispatch-control build` | exit 0; route table includes `/s/[section]` and every v4.0 route (`/run`, `/review-desk`, `/review-desk/[runId]`, `/voice-pass`, `/voice-pass/[runId]`, `/issues/[issueNumber]/{story,draft,fact-check,voice,approval}`) | ✓ PASS |
| Backend/schema untouched | `git diff --stat origin/master -- packages/pipeline convex schemas` | empty | ✓ PASS |
| Lockfile/package.json untouched | `git diff --name-only origin/master -- apps/dispatch-control/package.json pnpm-lock.yaml` | empty | ✓ PASS |
| D-25 bookkeeping fully gone | `grep -rn "useReviewedSections\|reviewDesk:reviewed\|Mark reviewed\|onToggleReviewed\|reviewedIds"` | no matches | ✓ PASS |
| No `localStorage`/`includeAxes`/`lucide-react`/`Math.max` under `(editorial)/` | 4 greps | no matches | ✓ PASS |
| No links from `(editorial)/` into `/run`, `/review-desk`, `/voice-pass`, `/issues/` | grep | no matches | ✓ PASS |
| Shared galley CSS untouched | `.galley-body` still 16.5px, bare `[id^='galley-']` still 88px | present | ✓ PASS |
| Live browser read-through of `/s/[section]` | — | not run (CORS-blocked) | ? SKIP — routed to human_verification |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| READ-01 | 51-02, 51-04, 51-06 | Full-width prose, no side rails, reading measure not a form | ⚠ Automated-complete, perceptual pending | Structural tests + CSS values verified; visual read-through not performed |
| READ-02 | 51-01, 51-04, 51-06 | Fact/voice/unsourced-claim marked in-sentence, label + colour | ⚠ Automated-complete, perceptual pending | Label rendering + non-axis-coded colour verified structurally; greyscale check not performed |
| READ-03 | 51-01, 51-04, 51-07, 51-06 | Open a problem, see reasoning + evidence, in place | ⚠ Automated-complete, DOM-validity pending | Popover wiring + real-pipeline independence test verified; Chrome DevTools DOM-validity check not performed |
| READ-04 | 51-05, 51-06 | Accept in one action, including recurrences | ✓ Complete | Group-accept sequential loop + partial-failure copy verified by test, independently re-run |
| READ-05 | 51-05, 51-06 | Edit the passage themselves | ✓ Complete | In-place editor + patchBonus/patchSection branch + 409 copy verified by test |
| READ-06 | 51-04 (reuse), 51-06 | Dismiss with required reason | ✓ Complete | Pre-existing `AnnotationMark` dismiss flow untouched; reason-required gate confirmed in source |
| READ-07 | 51-00→51-04, 51-06 | Prev/next without returning to issue | ✓ Complete | `SectionEndNav` naming-the-destination behavior verified by test |
| READ-08 | 51-01, 51-03, 51-04, 51-06 | Derived still-need-you count, never manual | ✓ Complete | `deriveSectionStates`-sourced count verified by test; D-25 bookkeeping deletion grep-confirmed |

No orphaned requirements: every ID READ-01…READ-08 declared in `REQUIREMENTS.md`'s Phase 51 mapping is claimed by at least one plan's frontmatter, and every plan's declared requirement is accounted for above. `REQUIREMENTS.md` itself already carries the same READ-01/02/03 asterisk this report applies — its self-assessment and this independent verification agree.

### Anti-Patterns Found

None. Scanned every file under `app/(editorial)/` for TODO/FIXME/PLACEHOLDER/"coming soon"/empty-implementation patterns — zero matches. The two `return null` occurrences in `page.tsx` are a legitimate exempt-note-lookup helper's not-exempt case and the standard `notFound(); return null` Next.js pattern, not stubs.

### Open Item Requiring Product Judgment (not a code defect)

Plan 51-07 extended the one shared `ClaimProvenanceCard` (also mounted by Review Desk's Stage 3 Fact Check, Stage 5 Approval, and Voice Pass) to additionally render the raw `sourceUrl` as its own visible text line, because the phase's own locked test and must-have truth require the literal URL string to be visible DOM text, and the reuse discipline (D-09/D-16) forbids forking the card per caller. This is additive (nothing existing was removed), broke no existing test, and is honestly documented as an "undecided" question in both `51-06-SUMMARY.md` and `51-07-SUMMARY.md` rather than shipped silently. It is not a regression against the reuse constraint — the constraint was honored (one component, composed, not forked) — but it is a visible change to three v4.0 console surfaces that nobody has looked at yet. Routed to human_verification above.

## Human Verification Required

See the `human_verification` block in the frontmatter — five items, all traceable to the phase's own unexecuted 51-06 Task 2 checkpoint plus the one open ClaimProvenanceCard question. None of these represent unfinished engineering; every one of them has full automated/structural backing already and is blocked purely on a local-dev CORS gap between `apps/dispatch-control` (port 3001) and the production Railway pipeline's `DASHBOARD_ALLOWED_ORIGINS` allowlist (no `localhost` entry). Two unblock routes are already recorded in `51-06-SUMMARY.md`:
1. Run the pipeline locally with `DASHBOARD_ALLOWED_ORIGINS=http://localhost:3001` and point `NEXT_PUBLIC_PIPELINE_URL` at it for the session.
2. Add `http://localhost:3001` to the Railway service's `DASHBOARD_ALLOWED_ORIGINS` environment variable.

## Gaps Summary

There are no code-level gaps: every must-have artifact exists, is substantive, is wired correctly (including the two hardest wiring risks the phase itself flagged — D-09/D-20 independence and the phrasing-safe popover nesting — both pinned by tests and traced by hand in this verification), and the full suite plus strict build are independently green. The gap is entirely in verification coverage: the phase's own plan made human perceptual sign-off a blocking gate for exactly the reasons this report's skepticism instructions anticipated (jsdom cannot judge a reading measure, a colour-independent label, or real-browser DOM validity), and that gate was explicitly skipped by user decision, not silently missed. This report reflects that honestly rather than rounding it up to `passed`.

---

*Verified: 2026-08-01T09:35:00Z*
*Verifier: Claude (gsd-verifier)*
