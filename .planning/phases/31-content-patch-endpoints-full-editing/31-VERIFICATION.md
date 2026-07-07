---
phase: 31-content-patch-endpoints-full-editing
verified: 2026-07-07T17:55:00Z
status: human_needed
score: 5/5 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 3/5
  gaps_closed:
    - "Operator can edit structured fields (PDF key data points) from the console without losing existing content — get_issue_draft() now returns problemStatement.pdfContent verbatim; SectionEditorPanel prefills from it and gates patchPdfDataPoints behind pdfDirty"
    - "Operator can edit specAd bonus prose without losing existing content — get_issue_draft() decomposes bonus.body via pt_to_blocks() (+bodyLossy); patch_bonus() only sets fields present in the request; frontend gates specAd blocks behind bonusBodyDirty and sends the required variant discriminator with rows under blocks"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Live-Sanity non-clobber confirmation (flagged by 31-06-SUMMARY.md): open /review-desk/[runId] for a real issue with populated problemStatement.pdfContent.keyDataPoints; edit ONLY the problem-statement headline and Save; then read problemStatement.pdfContent from Sanity (Studio or GROQ)"
    expected: "keyDataPoints (3 stat/source rows) and interventionMechanism are byte-unchanged; only the headline changed; one content.headline_patched + one content.section_patched audit row, NO content.pdf_data_points_patched row"
    why_human: "Requires a live Sanity dataset with pre-existing content and Clerk auth; unit tests mock the Sanity boundary (httpx.MockTransport / vi.mock), so the real mutate-API shape is unexercised in this environment"
  - test: "Asset upload end-to-end: upload a podcast audio file through the console; confirm inline <audio> playback and that the asset appears in Sanity's asset library"
    expected: "Audio plays inline from the returned CDN URL; asset visible in Sanity; content.asset_uploaded audit row recorded"
    why_human: "Requires a real network round-trip to Sanity's assets API and a browser to verify playback — deferred to manual verification since Plan 31-05"
---

# Phase 31: Content-Patch Endpoints + Full Editing Verification Report

**Phase Goal:** Every content mutation from the console flows through a scoped pipeline-API patch to Sanity — never a direct Sanity write — so per-section editing, structured-field editing, and asset uploads all work without disturbing other sections' block identities.

**Verified:** 2026-07-07T17:55:00Z (re-verification after gap-closure plan 31-06)
**Status:** human_needed (all automated checks pass; 2 live-environment items remain)
**Re-verification:** Yes — after 31-06 gap closure (commits `262f857`, `6edada7`, `3ffbc01` — all confirmed in git log)

## Re-verification (after 31-06)

Both gaps from the initial pass were re-traced against the code on disk:

**Gap 1 (PDF data points clobber) — CLOSED.**
- `get_issue_draft()` (`packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py:601-602`) now attaches `sections.problemStatement.pdfContent` verbatim from Sanity. Locked by `test_draft_read_includes_pdf_content` (pytest).
- `SectionEditorPanel.buildWorkingState()` now prefills `working.pdf` from `draft.sections.problemStatement.pdfContent` (3-blank-rows fallback only when absent). Locked by the vitest prefill assertion.
- `saveSection('problemStatement')` gates the `patchPdfDataPoints()` step behind `pdfDirty = JSON.stringify(working.pdf) !== JSON.stringify(loaded.pdf)` — a prose-only save no longer sends the PDF patch at all. Locked by two vitest assertions: prose-only save → `patchPdfDataPoints` **not** called; pdf-edited save → called with the edited values.

**Gap 2 (specAd bonus.body clobber) — CLOSED.**
- `get_issue_draft()` now decomposes `bonus.body` through `pt_to_blocks()` and surfaces `bodyLossy` (`sanity_client.py:604-607`). Locked by `test_draft_read_decomposes_bonus_body` (pytest).
- `patch_bonus()` (`api/content.py:512-534`) now only sets fields present in the request (`is not None` guards on `blocks`/`body`/`lyrics`/`sunoPrompt`/`headline`) and no-ops with the caller's revisionId when nothing is sent. Locked by `test_bonus_headline_only_save_omits_body` (pytest — asserts the captured mutate `fields` dict contains ONLY `bonus.headline` for a headline-only specAd save, and ONLY `bonus.lyrics` for a lyrics-only jingle save).
- `saveSection('bonus')` gates the specAd body behind `bonusBodyDirty` and — fixing a latent payload-contract mismatch the initial verification missed — now sends the REQUIRED `variant` discriminator and puts specAd rows under `blocks` (the backend field), not `body` (which server-side is the bigBudget/jingle prose string). Locked by two vitest assertions: headline-only save payload has `variant` + `headline` and no `blocks`/`body` key; body-edited save includes `blocks`.
- `docs/API_CONTRACTS.md` §31.3 (bonus payload: `variant` required, all content fields optional/omit-able) and §31.7 (`pdfContent` on `sections.problemStatement`, `bonus.body` decomposed + `bodyLossy`) amended in the same commit as the backend change (`262f857`) — contract-first maintained.

**Regression check on previously-passed items:** full pipeline pytest 384 passed / 33 skipped (was 381 — the 3 new tests); content-patch file 19/19 (was 16); dispatch-control vitest 258 passed / 2 todo (was 253 — the 5 new assertions); EDT-05 source-scan tripwire still passing; `pnpm --filter dispatch-control build` exit 0 with zero type errors; repo-wide grep for direct-Sanity-write patterns in `apps/dispatch-control` still returns zero hits. No regressions.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | Operator can edit any section's prose as a structured block list and save via a scoped patch endpoint; every other section's content/block identities untouched | ✓ VERIFIED | All 5 prose surfaces (4 long-reads + specAd bonus) round-trip load→edit→save through scoped dotted-path patches; cross-field non-clobber now locked by pytest (`test_bonus_headline_only_save_omits_body`) and vitest (prose-only save never fires `patchPdfDataPoints`; headline-only bonus save omits `blocks`) |
| 2 | Operator can edit structured fields (headlines, PDF key data points, game embed code, theme values) and see them reflected in the Sanity draft | ✓ VERIFIED | `patch_headline`/`patch_theme` (hex + 9-font whitelist byte-identical to `apps/web/lib/theme.ts`)/`patch_game` (50KB cap)/`patch_pdf_data_points` (exactly-3-rows rule) all scoped and validated; PDF editor now prefills real values from the extended draft read |
| 3 | Operator can upload podcast audio, Suno audio, or storyboard image and see it attached to the draft as a Sanity asset | ✓ VERIFIED | `upload_asset()` + `POST /assets/{slot}` branch correctly (file ref / suno-audio URL-string §31.6 exception / positional storyboard image ref); `AssetUploadSlot.tsx` implements overwrite-confirm (D-12) + inline CDN preview (D-13); live E2E deferred to human item 2 |
| 4 | A source scan of `apps/dispatch-control` finds zero direct Sanity client writes | ✓ VERIFIED | Tripwire test passing (2/2); repo-wide grep zero hits; zero `@sanity/*` deps |
| 5 | Every mutation is revision-guarded and audited with before/after snapshots | ✓ VERIFIED | `ifRevisionID` top-level on every mutation, 409 `revision_mismatch` remap + frontend reload-and-reapply prompt (D-10); `_emit_audit` before/after truncated snapshots on all 9 write actions (D-09) |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `docs/API_CONTRACTS.md` §31 | Contract written before code; §31.3/§31.7 amended for 31-06 | ✓ VERIFIED | Contract-first ordering confirmed for both the original family (`557482a` before `a6be62d`) and the 31-06 amendment (same commit `262f857` as the backend change) |
| `lib/portable_text.py::pt_to_blocks` | Reverse PT→block mapper with lossy detection | ✓ VERIFIED | Applied to the 4 long-reads AND (new) `bonus.body` |
| `lib/theme_validation.py` | 9-font whitelist + hex regex matching `apps/web/lib/theme.ts` | ✓ VERIFIED | Byte-identical 9-font list |
| `lib/structural_floor.py::structural_floor_warnings` | Warn-only counter | ✓ VERIFIED | WARN-only in `patch_section` + specAd `patch_bonus` |
| `_emit_audit` before/after extension | Additive kwargs to `auditLog:record` | ✓ VERIFIED | Forwarded only when non-`None`, truncated |
| `lib/sanity_client.py` primitives | `patch_issue_field` / `get_issue_draft` / `upload_asset` | ✓ VERIFIED | Read-path completeness gaps closed (pdfContent + bonus.body/bodyLossy) |
| `api/content.py` | 8 PATCH + 1 POST + 1 GET router, omit-able bonus fields | ✓ VERIFIED | Mounted in `api/main.py:192`; `patch_bonus` now patch-only-what's-present |
| `lib/contentPatchClient.ts` | Typed client for all 10 routes | ✓ VERIFIED | `NEXT_PUBLIC_PIPELINE_URL`-based, structured `ContentPatchError` |
| `__tests__/dispatch-control-no-sanity-write.test.ts` | EDT-05 tripwire | ✓ VERIFIED | 2/2 passing |
| `review-desk/[runId]` route + editor components | Two-pane editor, all editors, dirty-gated saves | ✓ VERIFIED | Build clean; 5 new non-clobber/prefill vitest assertions passing |

### Key Link Verification

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `api/control.py::_emit_audit` | Convex `auditLog:record` | `before`/`after` kwargs | ✓ WIRED | |
| `lib/sanity_client.py::patch_issue_field` | Sanity `/data/mutate/{dataset}` | `ifRevisionID` top-level | ✓ WIRED | 409 remap tested |
| `lib/sanity_client.py::upload_asset` | Sanity `/assets/{files\|images}/{dataset}` | raw binary POST + ref patch | ✓ WIRED | suno-audio URL-string exception per §31.6 |
| `api/content.py` | sanity_client primitives | `run_id → sanityIssueId` resolve then scoped write | ✓ WIRED | `_resolve_sanity_id` first in every route |
| `api/main.py` | `content.router` | `app.include_router` | ✓ WIRED | |
| `lib/contentPatchClient.ts` | pipeline `/issues/{runId}/*` | fetch + Bearer token | ✓ WIRED | |
| `review-desk/[runId]/page.tsx` | `PreviewIframe.tsx` | reused import (D-02) | ✓ WIRED | |
| `SectionEditorPanel.tsx` save handlers | `contentPatchClient` patch fns | explicit Save, `ifRevisionID` chaining, dirty-gated sub-patches | ✓ WIRED | Previously PARTIAL — now fully correct: `pdfDirty` gates the PDF step, `bonusBodyDirty` gates specAd `blocks`, `variant` sent, rows under `blocks` |
| `SectionEditorPanel` 409 handling | reload-and-reapply prompt | `ContentPatchError.reason === 'revision_mismatch'` | ✓ WIRED | |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `BlockEditor` (4 long-reads) | `working.longReads[name].blocks` | `get_issue_draft()` → `pt_to_blocks()` | Yes | ✓ FLOWING |
| `PdfDataPointsEditor` | `working.pdf` | `draft.sections.problemStatement.pdfContent` (verbatim from Sanity) | Yes | ✓ FLOWING (was ✗ DISCONNECTED) |
| `BonusEditor` (specAd) | `working.bonus.body` | `get_issue_draft()` → `pt_to_blocks()` decomposed rows + `bodyLossy` | Yes | ✓ FLOWING (was ✗ DISCONNECTED) |
| `ThemeEditor` / `GameEditor` | `working.theme` / `working.game` | raw `theme`/`game` from draft read | Yes | ✓ FLOWING |
| `AssetUploadSlot` | `previewUrl` | draft asset URLs / post-upload CDN URL | Yes | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| Content-patch endpoint suite (incl. 3 new 31-06 tests) | `python -m pytest tests/test_content_patch_endpoints.py -q` | 19 passed | ✓ PASS |
| Full pipeline regression | `python -m pytest -q --ignore=tests/lib/test_vercel_client.py` | 384 passed, 33 skipped (respx import error pre-exists, unrelated) | ✓ PASS |
| dispatch-control full suite (incl. 5 new non-clobber/prefill assertions) | `pnpm test -- --run` | 258 passed, 2 todo | ✓ PASS |
| EDT-05 tripwire | in suite + standalone | 2 passed | ✓ PASS |
| Strict production build/typecheck | `pnpm --filter dispatch-control build` | Compiled successfully, exit 0 | ✓ PASS |
| Headline-only bonus save omits body (gap-2 regression lock) | pytest `test_bonus_headline_only_save_omits_body` | captured mutate fields == `{"bonus.headline": ...}` only, for both specAd and jingle | ✓ PASS |
| Prose-only problemStatement save skips PDF patch (gap-1 regression lock) | vitest `a prose-only problemStatement save does NOT call patchPdfDataPoints` | `patchPdfDataPoints` not called | ✓ PASS |
| Contract-first ordering (31-06 amendment) | `git show 262f857` | §31.3/§31.7 docs changes in the same commit as the code | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| EDT-01 | 31-01..31-06 | Per-section prose block-list editing via scoped patch endpoint | ✓ SATISFIED | All 5 prose surfaces correct; non-clobber locked by tests |
| EDT-02 | 31-01, 31-02, 31-03, 31-05, 31-06 | Structured-field editing (headlines, PDF data points, game embed, theme) | ✓ SATISFIED | PDF prefill + dirty-gate closed the remaining defect |
| EDT-03 | 31-01..31-05 | Asset upload through console → pipeline → Sanity | ✓ SATISFIED | No gaps; live E2E is human item 2 |
| EDT-05 | 31-01, 31-04 | Zero direct Sanity writes from dashboard, source-scan enforceable | ✓ SATISFIED | Tripwire green, zero hits |

No orphaned requirements — REQUIREMENTS.md maps exactly EDT-01/02/03/05 to Phase 31; all four appear in plan frontmatter. EDT-04/EDT-06 correctly belong to Phase 33.

### Anti-Patterns Found

None remaining. The two 🛑 Blocker patterns from the initial pass (unconditional PDF patch in `problemStatement` saves; unconditional specAd body payload) and the ⚠️ read-path completeness gap in `get_issue_draft()` are all fixed, and each fix carries a dedicated regression test.

### Human Verification Required

### 1. Live-Sanity non-clobber confirmation

**Test:** Open `/review-desk/[runId]` for a real issue with populated `problemStatement.pdfContent.keyDataPoints`. Edit ONLY the problem-statement headline and Save. Read `problemStatement.pdfContent` from Sanity afterwards.
**Expected:** `keyDataPoints` and `interventionMechanism` byte-unchanged; only the headline changed; audit log shows `content.headline_patched` + `content.section_patched` and NO `content.pdf_data_points_patched` row.
**Why human:** All boundary tests mock Sanity (httpx.MockTransport / vi.mock); the real mutate-API round-trip needs a live dataset + Clerk auth. Flagged by 31-06-SUMMARY.md itself for this re-verification pass.

### 2. Asset upload end-to-end

**Test:** Upload a podcast audio file through the console; confirm inline `<audio>` playback and the asset in Sanity's asset library.
**Expected:** Audio plays from the CDN URL; asset visible in Sanity; `content.asset_uploaded` audit row recorded.
**Why human:** Real network round-trip + browser playback; deferred to manual verification since Plan 31-05.

### Gaps Summary

No gaps remaining. Both data-loss defects from the initial verification are closed at every layer (read path, backend patch semantics, frontend dirty-gating, contract docs) with dedicated regression tests locking each one. All automated checks — 384 pipeline pytest, 258 dispatch-control vitest, the EDT-05 tripwire, and a strict production build — pass. The only outstanding items are the two live-environment checks above, which cannot be exercised without a real Sanity dataset and Clerk auth.

---
*Initial verification: 2026-07-07T11:21:54Z (gaps_found, 3/5)*
*Re-verified: 2026-07-07T17:55:00Z after 31-06 gap closure (human_needed, 5/5)*
*Verifier: Claude (gsd-verifier)*
