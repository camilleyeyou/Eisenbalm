---
phase: 32-native-galley-read-only-span-resolver
verified: 2026-07-07T22:32:56Z
status: human_needed
score: 4/4 must-haves verified (automated); 4 items require human sign-off
human_verification:
  - test: "Visual fidelity: open /review-desk/[runId] for a real completed run and read the galley top-to-bottom"
    expected: "Reads as the reader will see it — theme display/body Google Fonts loaded, accent color flavoring pullquotes/borders, D-04 type scale (52px headline / italic 22px deck / 16.5px body) visually present, paper background matches console chrome"
    why_human: "Visual/typographic fidelity judgment; automated tests only assert structural presence (text content, data-severity attributes), not rendered appearance"
  - test: "Toggle 'Show preview' in the Review Desk header and confirm the Phase 31 PreviewIframe still renders the live Sanity preview; separately open the Phase 26 /run-monitor/runs/[runId]/review page directly"
    expected: "Both the in-desk iframe toggle and the standalone Phase 26 review page render the working preview iframe exactly as before Phase 32 — a real fallback for the soak cycle (SC-4)"
    why_human: "Route-level smoke test in a real browser against a live run; git history confirms the Phase 26 page file is untouched since Phase 30, but a live render check is inherently manual"
  - test: "Click each section chip in galley mode (Origin Story, Problem, Founder Bio, Case Study, Bonus, Game, Deliberation, Podcast, Theme) and confirm smooth-scroll lands on the correct galley section"
    expected: "Each chip click scrolls the galley to the matching #galley-{id} anchor; the Theme chip is a documented no-anchor exception (applies globally, no dedicated section)"
    why_human: "scrollIntoView/scroll-spy behavior requires a real DOM viewport; jsdom component tests can assert the anchor ids exist but not actual scroll behavior"
  - test: "Confirm the sandboxed game iframe actually plays with no browser console CSP/sandbox errors, for a real run's embedCode"
    expected: "Game renders and is interactive inside the sandbox; no console errors from the injected CSP meta tag or the allow-scripts-only sandbox restricting expected game behavior"
    why_human: "Real browser CSP enforcement and script execution can't be verified via jsdom; automated tests confirm the iframe's sandbox attribute and validator gating only"
---

# Phase 32: Native Galley (read-only) + Span-Resolver Verification Report

**Phase Goal:** Operator can read the issue as the reader will see it, natively rendered with existing QA findings highlighted inline, without losing the working preview iframe as a fallback during the transition.
**Verified:** 2026-07-07T22:32:56Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP §Phase 32 Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Review Desk renders the Sanity draft (all sections, incl. sandboxed game) as a native `@portabletext/react` tree, not an iframe | ✓ VERIFIED (automated) / needs visual sign-off | `Galley.tsx`/`GallerySection.tsx` render `<PortableText>` from synthetic blocks; `GalleryGameSlot.tsx` renders the game in `<iframe sandbox="allow-scripts" srcDoc=...>`; `Galley.test.tsx` 5/5 green asserting headlines, blockquote, sandboxed iframe, bonus/podcast/deliberation content |
| 2 | QA findings render as inline severity-colored span annotations, resolved via `quotedSpan` + `blockIndexHint`; unresolved findings visibly marked, never silently dropped | ✓ VERIFIED | `spanResolver.ts` implements exact→quote-normalized→whitespace-tolerant staged matching with fail-closed-to-unresolved ambiguity (D-12); `AnnotationMark.tsx` renders `data-severity` underline + read-only popover; `UnresolvedFindingCard.tsx` renders full reason + quoted text + "Unresolved" label; 11/11 `spanResolver.test.ts` + 4/4 `UnresolvedFindingCard.test.tsx` green |
| 3 | Section-status chips show per-section finding counts and jump to that section on click | ✓ VERIFIED (automated) / needs scroll-behavior sign-off | `SectionChipList.tsx` renders a severity-tinted count badge + unresolved marker from an optional `counts` prop; `page.tsx` computes counts via `resolveSectionFindings`/`qaSectionToGalleyId` from live `qaCorrections` and wires `handleChipSelect` → `scrollIntoView` on `#galley-{id}`; 4/4 `SectionChipList.test.tsx` green |
| 4 | The prior preview-iframe route still renders and is reachable, for at least one full weekly cycle | ✓ VERIFIED (automated) / needs live-browser sign-off | `page.tsx` preserves `viewMode==='iframe'` rendering the Phase 31 `PreviewIframe` unchanged; Phase 26 `/run-monitor/runs/[runId]/review/page.tsx` last touched in Phase 30, untouched by any Phase 32 commit (`git log` confirms) |

**Score:** 4/4 truths pass every automated check available; all 4 also carry a human-only visual/browser component per `32-VALIDATION.md`'s own "Manual-Only Verifications" table (drafted by the phase planner, not invented by this verification).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/dispatch-control/lib/galley/sectionIdMap.ts` | QA↔galley bidirectional map | ✓ VERIFIED | 40 lines, exports `qaSectionToGalleyId`/`galleyIdToQaSection`, unknown→`null`; 18/18 tests green |
| `apps/dispatch-control/lib/galley/spanResolver.ts` | Per-block resolver, fail-closed ambiguity | ✓ VERIFIED | 210 lines, exports `resolveSectionFindings`/`ResolvedAnnotation`/`UnresolvedFinding`/`QaFinding`; never concatenates blocks (`grep join(` = none); 11/11 tests green |
| `apps/dispatch-control/lib/galley/syntheticPortableText.ts` | Flat row + annotations → PT block | ✓ VERIFIED | 124 lines, `toSyntheticBlocks`; markDefs `_type:'annotation'`; overlap-stacking case covered; 5/5 tests green |
| `apps/dispatch-control/lib/galley/googleFontLoader.ts` | Whitelist-gated font/accent loader | ✓ VERIFIED | 98 lines, `FONT_WHITELIST` (9 entries incl. Newsreader/Cormorant Garamond), `ensureThemeFont`, `applyThemeAccent` (hex-validated `setProperty`); zero `apps/web` imports; 6/6 tests green |
| `apps/dispatch-control/lib/galley/galleyGameValidator.ts` | Duplicated embed validator, parity w/ apps/web | ✓ VERIFIED | 97 lines, `BANNED_PATTERNS`/`validateEmbedCode`/`injectGameHead`/`GAME_CSP_POLICY`; zero `apps/web` imports; 8/8 tests green |
| `.../AnnotationMark.tsx` | Severity underline + read-only popover | ✓ VERIFIED | 107 lines, `data-severity`, keyboard-openable, no Accept/Edit/Dismiss buttons (D-10 respected, Phase-33 placeholder comment present) |
| `.../UnresolvedFindingCard.tsx` | D-09 section-end card | ✓ VERIFIED | 31 lines, renders full `reason` + `quotedSpan` + "Unresolved" label; 4/4 tests green |
| `.../GalleryGameSlot.tsx` | Sandboxed iframe game render | ✓ VERIFIED | 52 lines, `sandbox="allow-scripts"` exact string, zero `allow-same-origin`, validator-gated |
| `.../GallerySection.tsx` | One section's native PT render + unresolved cards | ✓ VERIFIED | 72 lines, `<PortableText>` w/ `marks.annotation`→`AnnotationMark`, `block.normal/h2/h3/blockquote`, `id="galley-{sectionId}"` anchor |
| `.../Galley.tsx` | Orchestrator: 8 sections, live findings, resolver, theme | ✓ VERIFIED | 188 lines, `useQuery(api.qaCorrections.byRunId)` filtered `accepted!==true`, per-section `resolveSectionFindings` (never concatenated), `ensureThemeFont`/`applyThemeAccent` in `useEffect`, zero Convex/Sanity writes |
| `.../SectionChipList.tsx` (upgraded) | Chip strip w/ counts + jump-nav | ✓ VERIFIED | 126 lines, optional `counts` prop backward-compatible, severity-tinted badge, unresolved `!` marker w/ `aria-label` |
| `.../page.tsx` (recomposed) | galley-default 3-mode screen | ✓ VERIFIED | 373 lines, `viewMode` state defaults `'galley'`, computes chip counts client-side, preserves `SectionEditorPanel` + `PreviewIframe` |
| `convex/schema.ts` / `convex/qaCorrections.ts` | `blockIndexHint: v.optional(v.number())` | ✓ VERIFIED | Present in both schema and `insert` mutation args; codegen regenerated (`api.d.ts`) |
| `packages/pipeline/.../lib/sanity_client.py` | `_DRAFT_GROQ` asset dereference | ✓ VERIFIED | `audioFile.asset->url` and `storyboards[]{ asset->{ url } }` present |
| `docs/API_CONTRACTS.md` | §31.7 addendum + §32.1 blockIndexHint | ✓ VERIFIED | Both sections present, contract-first per CLAUDE.md |
| `packages/pipeline/.../agents/qa/__init__.py` | `_block_index_hint` unique-match helper | ✓ VERIFIED | Present, called in `qa()` write loop, payload key omitted (not null) when no unique match |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `Galley.tsx` | `convex qaCorrections.byRunId` | `useQuery` | ✓ WIRED | Live query, filtered `accepted !== true` (D-08) |
| `Galley.tsx` | `spanResolver.resolveSectionFindings` | per-section call | ✓ WIRED | Called once per long-read/bonus section, never concatenated |
| `GallerySection.tsx` | `@portabletext/react <PortableText>` | synthetic blocks + `marks.annotation` | ✓ WIRED | `AnnotationMark` mounted as `marks.annotation` |
| `SectionChipList` chip click | galley section (`#galley-{id}`) | `onSelect` → `scrollIntoView` (in `page.tsx`) | ✓ WIRED | `galleyAnchorFor()` handles `theme`(no anchor)/`deliberation-conversation` exceptions |
| `page.tsx` | `Galley` (default) + `SectionEditorPanel` (edit) + `PreviewIframe` (fallback) | `viewMode` state | ✓ WIRED | All three bodies present and reachable |
| `agents/qa/__init__.py::qa()` | `convex qaCorrections:insert` | `blockIndexHint` payload key | ✓ WIRED | Conditionally added only on unique match |
| `_DRAFT_GROQ` | Sanity asset documents | `asset->{url}` projection | ✓ WIRED | Confirmed via grep + passing pytest |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 8 Wave-0 RED test files now pass | `npx vitest run __tests__/{sectionIdMap,spanResolver,syntheticPortableText,googleFontLoader,galleyGameValidator,UnresolvedFindingCard,Galley,SectionChipList}.test.{ts,tsx}` | 8 files / 61 tests passed | ✓ PASS |
| Full dispatch-control suite has no regressions | `npx vitest run` | 39 passed \| 1 skipped (40 files), 319 passed \| 2 todo (321 tests) | ✓ PASS |
| Strict Next.js build succeeds (project memory: vitest doesn't type-check) | `pnpm --filter dispatch-control build` | Compiled successfully, all routes incl. `/review-desk/[runId]` and `/run-monitor/runs/[runId]/review` generated | ✓ PASS |
| Pipeline QA blockIndexHint unit tests | `uv run pytest tests/ -k "qa and (hint or block_index)"` | 6 passed | ✓ PASS |
| Pipeline draft-read / sanity_client tests | `uv run pytest tests/ -k "draft or sanity_client"` | 13 passed, 1 skipped | ✓ PASS |
| All 19 commits referenced across the 7 SUMMARYs exist in git history | `git log --oneline --all \| grep -E "<19 hashes>"` | all 19 found | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GLY-01 | 32-01, 32-02, 32-04, 32-06, 32-07 | Native render of Sanity draft incl. sandboxed game, replacing iframe as primary read surface | ✓ SATISFIED | `Galley.tsx`/`GallerySection.tsx`/`GalleryGameSlot.tsx`; `.planning/REQUIREMENTS.md` line 283 marked `[x]` |
| GLY-02 | 32-01, 32-02, 32-03, 32-05 | Inline severity-colored span annotations resolved via quotedSpan + blockIndexHint; unresolved surfaced, never dropped | ✓ SATISFIED | `spanResolver.ts`, `AnnotationMark.tsx`, `UnresolvedFindingCard.tsx`; REQUIREMENTS.md line 284 marked `[x]` |
| GLY-05 | 32-01, 32-07 | Section-status chips show per-section counts + jump nav | ✓ SATISFIED | `SectionChipList.tsx` upgrade + `page.tsx` scroll wiring; REQUIREMENTS.md line 287 marked `[x]` |

**Orphaned requirements check:** REQUIREMENTS.md's "v3.0 Traceability" table (lines 663–665) still lists GLY-01/GLY-02/GLY-05 as `Planned` — this is a **stale secondary table**, not the authoritative status list. The primary checkbox list (lines 283–287) — the one this project's other phases treat as ground truth — already shows all three as `[x]` Complete. No plan claims a requirement ID that isn't accounted for above; no requirement mapped to Phase 32 in ROADMAP.md is missing a supporting plan. **Non-blocking documentation drift**, noted for cleanup but does not affect phase goal achievement.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `GalleryGameSlot.tsx` | 48 | `"Game coming soon."` | ℹ️ Info | Intentional, plan-specified fallback UI copy for the no-embedCode case (D-05) — not a stub |
| `AnnotationMark.tsx` | 10 | comment referencing "placeholder comment" | ℹ️ Info | Refers to the intentional Phase-33 action-row mount-point comment (D-10) — not a stub |

No blocker or warning-severity anti-patterns found. No TODO/FIXME/`not implemented` markers in any of the 15 new/modified Phase 32 files.

### Human Verification Required

See `human_verification` in the frontmatter above (4 items): visual/typographic fidelity of the galley render, live-browser confirmation of both iframe fallback paths, chip scroll-to-section behavior, and sandboxed game playability without console CSP errors. These four items are drawn directly from `32-VALIDATION.md`'s own "Manual-Only Verifications" table, authored by the phase's planner — this verification did not invent them, only confirmed no automated substitute exists and that all automatable prerequisites (structural rendering, wiring, data flow) pass.

### Gaps Summary

No gaps found. All 7 plans' `must_haves` (truths, artifacts, key_links) are verified present, substantive, and wired in the actual codebase — not just claimed in SUMMARYs. All 8 Wave-0 RED tests now pass green (61/61), the full dispatch-control suite is regression-free (319 passed/2 todo), the strict Next.js build succeeds, and the two pipeline-side additions (asset-URL dereference, blockIndexHint emission) are covered by passing pytest suites. The span resolver's fail-closed ambiguity handling (D-12), the D-08 accepted-finding exclusion, the D-09 unresolved-card surfacing, and the D-02 iframe/Phase-26-page preservation are all verified directly in source, not merely asserted by the SUMMARY documents. The only issue found — a stale secondary requirements-traceability table still reading "Planned" — is cosmetic and contradicted by the authoritative checkbox list in the same file, which already reflects completion.

Because four success-criterion aspects are inherently visual/browser-only (reader-fidelity judgment, live iframe smoke test, real scrollIntoView behavior, and sandboxed game console-error-free execution), overall status is `human_needed` rather than `passed` — the phase is code-complete and automatically verified, but final sign-off requires opening a real run in a browser per `32-VALIDATION.md`'s own manual-verification plan.

---

*Verified: 2026-07-07T22:32:56Z*
*Verifier: Claude (gsd-verifier)*
