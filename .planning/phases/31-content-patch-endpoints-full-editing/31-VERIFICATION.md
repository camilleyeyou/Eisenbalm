---
phase: 31-content-patch-endpoints-full-editing
verified: 2026-07-07T11:21:54Z
status: gaps_found
score: 3/5 must-haves verified
gaps:
  - truth: "Operator can edit structured fields (PDF key data points) from the console and see them reflected in the Sanity draft without losing existing content"
    status: failed
    reason: >
      get_issue_draft() (packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py:584-610)
      never surfaces problemStatement.pdfContent in its response, so
      SectionEditorPanel.buildWorkingState() (apps/dispatch-control/.../SectionEditorPanel.tsx:158)
      hardcodes working.pdf to a permanently-blank {problemStatement:'', keyDataPoints:[3x blank], interventionMechanism:''}
      on every load, regardless of what real content exists in Sanity. Worse than a
      pre-fill gap: saveSection('problemStatement') (SectionEditorPanel.tsx:284-300)
      unconditionally calls patchPdfDataPoints() with this blank working.pdf as a
      mandatory third step of EVERY problemStatement prose save (headline/body) — it is
      not gated behind any dirty check on the pdf sub-state. Any operator who edits only
      the problem-statement headline or body text and clicks Save silently overwrites the
      real PDF key data points (3 stat/source rows + interventionMechanism text) with
      blanks via patch_pdf_data_points()'s "Full problemStatement.pdfContent replace"
      (packages/pipeline/src/eisenbalm_pipeline/api/content.py:435-436). The destructive
      write IS captured in the audit before/after snapshot (before is real, after is
      blank — _fetch_before is used server-side), so it is not literally "silent" in the
      audit log, but the operator has no visibility into it happening and never chose it.
    artifacts:
      - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
        issue: "get_issue_draft()'s _DRAFT_GROQ pulls the full problemStatement object but the response-shaping loop (L592-600) only extracts headline/blocks/lossy, dropping pdfContent entirely"
      - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx"
        issue: "buildWorkingState() hardcodes working.pdf to blank (L158) instead of reading draft.sections.problemStatement.pdfContent; saveSection() unconditionally re-sends this blank pdf state as part of every problemStatement save (L289-300), not gated on pdf-specific dirty state"
    missing:
      - "Extend get_issue_draft()'s response to include problemStatement.pdfContent (raw or via a dedicated shaping step) so the console can prefill real values"
      - "Prefill working.pdf from draft.sections.problemStatement.pdfContent in buildWorkingState()"
      - "Gate the patchPdfDataPoints() call in saveSection('problemStatement') behind its own dirty check (only fire when the pdf sub-state actually changed), not as an unconditional third step of every problemStatement save"
  - truth: "Operator can edit any section's prose as a structured block list (specAd bonus, per D-04's 5-long-read list) and save without losing existing content"
    status: failed
    reason: >
      get_issue_draft() returns doc.get("bonus") raw (sanity_client.py:606) — bonus.body
      is never run through pt_to_blocks() the way the 4 canonical long-reads are (L595).
      BonusEditor's specAd branch (SectionEditorPanel.tsx buildWorkingState L133-146)
      defensively coerces this raw Portable Text into an empty block array via
      coerceBlocks() since it never matches the {type,text} shape. saveSection('bonus')
      (SectionEditorPanel.tsx L299-307) unconditionally includes
      payload.body = working.bonus.body whenever bonusType === 'specAd', regardless of
      whether the operator touched the body field — so saving just the bonus headline
      for a specAd issue silently overwrites the real bonus.body with an (almost) empty
      Portable Text array via patch_bonus()'s unconditional `fields["bonus.body"] =
      compose_section_body(blocks)` (api/content.py:514-516).
    artifacts:
      - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
        issue: "get_issue_draft() does not decompose bonus.body through pt_to_blocks() the way it does for the 4 long-reads"
      - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx"
        issue: "saveSection('bonus') always includes body in the specAd payload (L302-303) regardless of whether body is dirty"
      - path: "packages/pipeline/src/eisenbalm_pipeline/api/content.py"
        issue: "patch_bonus() unconditionally sets fields['bonus.body'] for the specAd variant whenever the route is called (L514-516), with no way for the caller to omit it"
    missing:
      - "Run bonus.body through pt_to_blocks() in get_issue_draft() (mirroring the 4 long-reads) so BonusEditor prefills real content for specAd"
      - "Make body an Optional field on the /bonus PATCH payload (like headline already is) so a headline-only save can omit it, and gate the frontend body payload on body-specific dirty state"
---

# Phase 31: Content-Patch Endpoints + Full Editing Verification Report

**Phase Goal:** Every content mutation from the console flows through a scoped pipeline-API patch to Sanity — never a direct Sanity write — so per-section editing, structured-field editing, and asset uploads all work without disturbing other sections' block identities.

**Verified:** 2026-07-07T11:21:54Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Operator can edit originStory/founderBio/caseStudy prose as a structured block list and save via a scoped patch endpoint, other sections untouched | ✓ VERIFIED | `patch_headline`/`patch_section` are independently scoped dotted-path patches (`api/content.py` L281-330ish); `get_issue_draft()` correctly decomposes these 3 sections' body via `pt_to_blocks()`; round-trip confirmed load→edit→save with no coupled side-effects |
| 1b | Operator can edit problemStatement / specAd-bonus prose without losing sibling structured data | ✗ FAILED | See gaps — saving problemStatement prose unconditionally wipes `pdfContent`; saving specAd bonus headline unconditionally wipes `bonus.body` |
| 2 | Operator can edit structured fields (headlines, theme, game) from the console and see them reflected in the Sanity draft | ✓ VERIFIED | `patch_headline`, `patch_theme` (hex+9-font HARD-validation matches `apps/web/lib/theme.ts` FONT_WHITELIST exactly), `patch_game` (50KB embed cap) all independently scoped and round-trip correctly; `ThemeEditor`/`GameEditor` prefill from raw Sanity fields (no read-path gap) |
| 2b | Operator can edit PDF key data points from the console and see them reflected in the Sanity draft | ✗ FAILED | See gaps — `get_issue_draft()` never surfaces `pdfContent`; editor always starts blank; saving overwrites real data with blanks as a mandatory side-effect of any problemStatement prose save |
| 3 | Operator can upload a podcast audio file, Suno audio, or storyboard image through the console and see it attached to the draft as a Sanity asset | ✓ VERIFIED | `upload_asset()` + `POST /issues/{run_id}/assets/{slot}` correctly branch by slot (file ref / URL-string exception for suno-audio / positional image ref for storyboards); `AssetUploadSlot.tsx` implements overwrite-confirm (D-12) + inline CDN preview (D-13); 16/16 pipeline pytest + dispatch-control component tests pass |
| 4 | A source scan of `apps/dispatch-control` finds zero direct Sanity client writes | ✓ VERIFIED | `dispatch-control-no-sanity-write.test.ts` passes (2/2); repo-wide grep for `@sanity/client`, `from 'sanity'`, `createClient(`, `.api.sanity.io` across `app/`, `components/`, `lib/` (and the whole app tree) returns zero hits; `package.json` has zero `@sanity/*` deps |

**Score:** 3/5 truths fully verified (2 partial-failures within truths 1 and 2, isolated to `problemStatement`/`specAd` bonus)

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `docs/API_CONTRACTS.md` §31 | Content-patch endpoint family contract, written before code | ✓ VERIFIED | §31.1-§31.9 present; commit `557482a` (docs) precedes `a6be62d`/`ac03836` (code) in git log — contract-first rule honored |
| `packages/pipeline/.../lib/portable_text.py::pt_to_blocks` | Reverse PT→block mapper with lossy detection | ✓ VERIFIED | Present, used correctly for the 4 long-reads; NOT applied to `bonus.body` (gap above) |
| `packages/pipeline/.../lib/theme_validation.py` | 9-font whitelist + hex regex matching `apps/web/lib/theme.ts` | ✓ VERIFIED | Byte-identical 9-font list confirmed against `apps/web/lib/theme.ts` `FONT_WHITELIST` |
| `packages/pipeline/.../lib/structural_floor.py::structural_floor_warnings` | Warn-only counter | ✓ VERIFIED | Present, used in `patch_section` and specAd `patch_bonus` as WARN-only (never raises) |
| `_emit_audit` before/after extension | Additive kwargs forwarded to `auditLog:record` | ✓ VERIFIED | `before`/`after` kwargs present, forwarded only when non-`None`, truncated |
| `packages/pipeline/.../lib/sanity_client.py` (`patch_issue_field`, `get_issue_draft`, `upload_asset`) | Revision-guarded primitives | ✓ VERIFIED (with the two read-path gaps above) | All three exist and are unit-tested; `get_issue_draft()`'s response shape is incomplete for `pdfContent` and `bonus.body` |
| `packages/pipeline/.../api/content.py` | 8 PATCH + 1 POST + 1 GET router | ✓ VERIFIED | All 10 routes present, Clerk-JWT-guarded, mounted in `api/main.py` (`app.include_router(content.router)`) |
| `apps/dispatch-control/lib/contentPatchClient.ts` | Typed client for all 10 routes + `ContentPatchError` | ✓ VERIFIED | All client functions present, `NEXT_PUBLIC_PIPELINE_URL`-based, structured error surfacing |
| `apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts` | EDT-05 tripwire | ✓ VERIFIED | 2/2 passing |
| `.../review-desk/[runId]/page.tsx` + `_components/*` | Two-pane editor: SectionChipList, BlockEditor, TurnListEditor, StructuredFieldEditor, AssetUploadSlot, SectionEditorPanel | ✓ VERIFIED | All present, wired, `pnpm --filter dispatch-control build` succeeds with zero type errors |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `api/control.py::_emit_audit` | Convex `auditLog:record` | `before`/`after` kwargs | ✓ WIRED | `before is not None` / `after is not None` guards confirmed |
| `lib/sanity_client.py::patch_issue_field` | Sanity `/data/mutate/{dataset}` | `ifRevisionID` top-level patch key | ✓ WIRED | Confirmed top-level sibling of `id`/`set`; 409 remap confirmed by `test_patch_revision_mismatch` |
| `lib/sanity_client.py::upload_asset` | Sanity `/assets/{files\|images}/{dataset}` | raw binary POST + reference patch | ✓ WIRED | Confirmed; `suno-audio` URL-string exception implemented as documented in §31.6 |
| `api/content.py` | `lib/sanity_client` primitives | `run_id -> sanityIssueId` resolve then scoped write | ✓ WIRED | `_resolve_sanity_id` called first in every route |
| `api/main.py` | `content.router` | `app.include_router` | ✓ WIRED | Confirmed at `main.py:192` |
| `lib/contentPatchClient.ts` | pipeline API `/issues/{runId}/*` | fetch + Bearer token | ✓ WIRED | Confirmed |
| `review-desk/[runId]/page.tsx` | `PreviewIframe.tsx` (Phase 26) | reused import (D-02) | ✓ WIRED | Confirmed |
| `SectionEditorPanel.tsx` save handlers | `contentPatchClient` patch fns | explicit Save + `ifRevisionID` chaining | ⚠️ PARTIAL | Wired and functional for 8/10 field groups; for `problemStatement` and specAd `bonus`, the chain includes an **unconditional, undirtied** overwrite of a sibling structured field (see gaps) |
| `SectionEditorPanel` 409 handling | reload-and-reapply prompt | `ContentPatchError.reason === 'revision_mismatch'` | ✓ WIRED | Confirmed present and correctly gated |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `BlockEditor` (originStory/founderBio/caseStudy) | `working.longReads[name].blocks` | `get_issue_draft()` → `pt_to_blocks()` | Yes | ✓ FLOWING |
| `PdfDataPointsEditor` | `working.pdf` | hardcoded blank literal in `buildWorkingState()` (never reads `draft.sections.problemStatement.pdfContent`, which `get_issue_draft()` doesn't even return) | No | ✗ DISCONNECTED — and the disconnected blank state is then written back over real data on save |
| `BonusEditor` (specAd) | `working.bonus.body` | `coerceBlocks(rawBonus.body)` — `rawBonus.body` is raw Portable Text from `get_issue_draft()`, never decomposed, so `coerceBlocks` always returns `[]` | No | ✗ DISCONNECTED — same clobber-on-save pattern |
| `ThemeEditor` / `GameEditor` | `working.theme` / `working.game` | `get_issue_draft()` raw `theme`/`game` objects | Yes | ✓ FLOWING |
| `AssetUploadSlot` (podcast/suno/storyboard) | `previewUrl` | `draft.podcast.audioFile.asset.url` / `draft.bonus.sunoAudioUrl` / `draft.bonus.storyboards[i].url` | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Pipeline content-patch endpoint test suite | `python -m pytest tests/test_content_patch_endpoints.py -q` | 16 passed | ✓ PASS |
| Full pipeline regression | `python -m pytest -q --ignore=tests/lib/test_vercel_client.py` | 381 passed, 33 skipped (pre-existing `respx` import error in an unrelated file, not phase 31 code) | ✓ PASS |
| dispatch-control full test suite | `pnpm test -- --run` | 253 passed, 2 todo, 1 file skipped | ✓ PASS |
| EDT-05 source-scan tripwire | `pnpm test -- --run __tests__/dispatch-control-no-sanity-write.test.ts` | 2 passed | ✓ PASS |
| dispatch-control production build/typecheck | `pnpm --filter dispatch-control build` | Compiled successfully, zero type errors, `/review-desk` + `/review-desk/[runId]` routes present | ✓ PASS |
| Contract-first ordering | `git log` on `docs/API_CONTRACTS.md` vs `api/content.py` | §31 contract commit (`557482a`) precedes endpoint code commits (`a6be62d`, `ac03836`) | ✓ PASS |
| Font whitelist parity | diff of pipeline `CONTENT_FONT_WHITELIST` vs `apps/web/lib/theme.ts` `FONT_WHITELIST` | Identical 9 entries | ✓ PASS |

Note: existing test suites (pipeline unit tests + `review-desk-editors.test.tsx`) do not exercise the failure mode above — no test asserts that saving `problemStatement` headline-only leaves `pdfContent` untouched, or that saving specAd `bonus` headline-only leaves `body` untouched. The gap was found by tracing the actual data flow, not by a failing test.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| EDT-01 | 31-01, 31-02, 31-03, 31-04, 31-05 | Per-section prose block-list editing via scoped patch endpoint | ⚠️ MOSTLY SATISFIED | 3/5 prose surfaces (originStory, founderBio, caseStudy) fully correct; problemStatement and specAd-bonus have the clobber-on-save defect above |
| EDT-02 | 31-01, 31-02, 31-03, 31-05 | Structured-field editing (headlines, PDF data points, game embed, theme) | ⚠️ MOSTLY SATISFIED | headline/theme/game fully correct; PDF key data points has the clobber-on-save defect above |
| EDT-03 | 31-01, 31-02, 31-03, 31-04, 31-05 | Asset upload (podcast/Suno/storyboard) through console → pipeline → Sanity | ✓ SATISFIED | Fully verified, no gaps found |
| EDT-05 | 31-01, 31-04 | Zero direct Sanity writes from dashboard, source-scan enforceable | ✓ SATISFIED | Fully verified, tripwire test passing |

No orphaned requirements — REQUIREMENTS.md maps exactly EDT-01/02/03/05 to Phase 31, and all four appear in at least one plan's `requirements` frontmatter.

REQUIREMENTS.md currently marks EDT-01 and EDT-02 as `[x]` complete; given the clobber-on-save defects found above, these two checkboxes are optimistic — both requirements are functionally satisfied for most of their surface area but have a confirmed data-loss defect on two specific fields (problemStatement PDF data points, specAd bonus body) that a real operator would hit on the very first edit of those fields.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| `SectionEditorPanel.tsx` | ~284-300 | Unconditional multi-field patch chained into a single-field save action (`problemStatement` prose save always re-sends blank `pdf`) | 🛑 Blocker | Silent data loss on first problem-statement edit |
| `SectionEditorPanel.tsx` | ~299-307 | Unconditional `payload.body = working.bonus.body` for specAd bonus regardless of dirty state | 🛑 Blocker | Silent data loss on first bonus headline-only edit |
| `sanity_client.py` (`get_issue_draft`) | 592-609 | Read-path completeness gap: `pdfContent` dropped, `bonus.body` not decomposed | ⚠️ Warning | Root cause of both blockers above; self-flagged in 31-05-SUMMARY.md as a known follow-up |

No other placeholder/TODO/stub patterns found in the Phase 31 file set; the rest of the router, client, and editor code is substantive and functional.

### Human Verification Required

### 1. Confirm the clobber defect against a real Sanity dataset

**Test:** Open `/review-desk/[runId]` for an issue with real PDF key data points and a real specAd bonus body. Edit only the problem-statement headline (leave PDF data points and bonus untouched) and Save. Then check the Sanity draft directly (Studio or GROQ) for `problemStatement.pdfContent.keyDataPoints`.
**Expected (if the gap above is real):** The 3 `keyDataPoints` rows are now blank (`stat: '', source: ''`) even though the operator never touched that field.
**Why human:** Requires a live Sanity dataset with pre-existing content and Clerk auth; not reproducible from source inspection alone with full certainty of the exact live document shape.

### 2. Confirm asset upload end-to-end against Sanity CDN

**Test:** Upload a podcast audio file through the console; confirm inline `<audio>` playback works and the file is visible in Sanity's asset library.
**Expected:** Audio plays inline from the CDN URL; asset appears in Sanity.
**Why human:** Requires real network round-trip to Sanity's assets API and a browser to verify audio playback — explicitly deferred by 31-05-SUMMARY.md to this verification step.

### Gaps Summary

Phase 31 delivers a real, working write boundary: the contract was written first (CLAUDE.md compliance confirmed via git log), all 10 documented routes exist and are mounted, revision-guard 409 handling and validation-split (HARD theme/game, WARN structural floor) both work as designed, asset upload (EDT-03) is fully correct with no gaps, and the EDT-05 zero-direct-write invariant is enforced by a passing source-scan tripwire.

However, two of the ten routes have a confirmed data-loss defect that traces back to the same root cause the Plan 31-05 authors self-flagged as a "known follow-up" (`get_issue_draft()` doesn't surface `problemStatement.pdfContent` and doesn't run `bonus.body` through `pt_to_blocks()`). The verification found this is more severe than the SUMMARY's framing of "starts blank on load, but saves work fine": because `SectionEditorPanel.saveSection()` unconditionally bundles the blank PDF-data-points patch into every problemStatement prose save, and unconditionally bundles the blank bonus-body patch into every specAd bonus save, an operator's very first edit to either of these sections' *other* fields will silently overwrite real existing content with blanks — precisely the kind of silent clobbering the phase's revision-guard and "nothing silent" audit design exists to prevent. The audit log does capture the true before/after (so it is discoverable after the fact), but nothing in the UI warns the operator before it happens.

Both gaps share the same fix: extend `get_issue_draft()`'s response to surface real `pdfContent` and `pt_to_blocks()`-decomposed `bonus.body`, and make the corresponding frontend save steps conditional on their own dirty state rather than unconditional side-effects of a sibling field's save. This is scoped, well-understood, small-surface-area follow-up work — not a redesign — but it must land before Andrew's first real weekly edit session, exactly as 31-05-SUMMARY.md's own "Next Phase Readiness" note recommends.

---
*Verified: 2026-07-07T11:21:54Z*
*Verifier: Claude (gsd-verifier)*
