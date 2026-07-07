---
phase: 31-content-patch-endpoints-full-editing
plan: 06
type: execute
wave: 1
depends_on: []
files_modified:
  - docs/API_CONTRACTS.md
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
  - packages/pipeline/src/eisenbalm_pipeline/api/content.py
  - packages/pipeline/tests/test_content_patch_endpoints.py
  - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx
  - apps/dispatch-control/__tests__/review-desk-editors.test.tsx
autonomous: true
gap_closure: true
requirements: [EDT-01, EDT-02]
user_setup: []

must_haves:
  truths:
    - "get_issue_draft() returns problemStatement.pdfContent verbatim and bonus.body decomposed via pt_to_blocks (with a bodyLossy flag), so both editors prefill real content on load"
    - "A problemStatement prose-only save (headline/body edit) does NOT call patchPdfDataPoints — the PDF patch fires only when the PDF sub-state itself is dirty"
    - "A specAd bonus headline-only save does NOT include blocks/body in the payload and does NOT touch bonus.body in Sanity — patch_bonus only sets fields the caller actually sent"
    - "The bonus save payload matches the server contract: carries variant (required) and blocks (specAd rows, not a mis-named body key)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
      provides: "get_issue_draft with pdfContent + decomposed bonus.body/bodyLossy"
      contains: "pdfContent"
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/content.py"
      provides: "patch_bonus with omit-able body (no unconditional bonus.body set)"
      contains: "blocks is not None"
    - path: "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx"
      provides: "pdf prefill + dirty-gated pdf/bonus-body save steps + correct bonus payload"
      contains: "pdfDirty"
  key_links:
    - from: "SectionEditorPanel.buildWorkingState"
      to: "draft.sections.problemStatement.pdfContent"
      via: "prefill instead of hardcoded blank literal"
      pattern: "pdfContent"
    - from: "SectionEditorPanel.saveSection('bonus')"
      to: "patchBonus payload"
      via: "variant + dirty-gated blocks (specAd)"
      pattern: "variant"
---

<objective>
Close the two verified data-loss gaps from 31-VERIFICATION.md: (1) `get_issue_draft()` drops `problemStatement.pdfContent` and returns `bonus.body` as raw Portable Text, so the PDF-data-points editor and specAd bonus block editor always start blank; (2) `SectionEditorPanel.saveSection()` unconditionally chains the blank PDF patch into every problemStatement save and the blank bonus body into every specAd bonus save — silently clobbering real content on the operator's first edit. Fix BOTH sides (read-path completeness AND dirty-gated save steps) per the verifier's direction, plus the two adjacent contract mismatches in the same path (bonus payload missing required `variant`; specAd rows sent under `body` instead of `blocks`; jingle/bigBudget branches wiping `bonus.body` when `body` is None).

Purpose: EDT-01/EDT-02 must be safe for Andrew's first real weekly edit session — no field's save may overwrite a sibling field the operator never touched.
Output: extended draft-read shape (contract-first §31.7 amendment), omit-able patch_bonus fields, prefilled + dirty-gated frontend saves, and cross-field non-clobber tests on both sides.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/31-content-patch-endpoints-full-editing/31-VERIFICATION.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- get_issue_draft current shape (sanity_client.py L584-610) — _DRAFT_GROQ already pulls the FULL
     problemStatement and bonus objects; the response-shaping loop just drops pdfContent and leaves bonus raw. -->

<!-- _BonusBody (api/content.py L216-223) — server contract the client must match: -->
class _BonusBody(BaseModel):
    ifRevisionID: str
    variant: Literal["specAd", "bigBudget", "jingle"]   # REQUIRED — client currently never sends it
    blocks: Optional[list[_BlockRow]] = None            # specAd rows — client currently sends them as `body`
    headline: Optional[str] = None
    body: Optional[str] = None                          # bigBudget/jingle prose string
    lyrics: Optional[str] = None
    sunoPrompt: Optional[str] = None

<!-- patch_bonus clobber (api/content.py L516-525): specAd branch does
     fields["bonus.body"] = compose_section_body(body.blocks or [])  — None -> [] -> wipe;
     jingle/bigBudget do fields["bonus.body"] = text_to_portable_text(body.body or "") — None -> "" -> wipe. -->

<!-- SectionEditorPanel: buildWorkingState L158 hardcodes blank pdf; sectionSlice L172-174 ALREADY bundles
     pdf into the problemStatement dirty slice (so isDirty('problemStatement') is true for pdf-only edits — keep);
     saveSection L289-302 unconditionally chains patchPdfDataPoints; L303-310 builds the bonus payload
     without variant and with `payload.body = working.bonus.body` for specAd. -->

<!-- coerceBlocks (frontend) passes arrays through when rows already match {type,text} — so returning
     decomposed rows server-side makes the existing prefill path work with no shape change. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Backend — §31.7 contract amendment, draft-read completeness, omit-able patch_bonus fields</name>
  <files>docs/API_CONTRACTS.md, packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py, packages/pipeline/src/eisenbalm_pipeline/api/content.py, packages/pipeline/tests/test_content_patch_endpoints.py</files>
  <read_first>
    - .planning/phases/31-content-patch-endpoints-full-editing/31-VERIFICATION.md (gaps 1+2 — root cause + recommended fix)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (L576-610 — _DRAFT_GROQ + get_issue_draft response shaping)
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py (L216-223 _BonusBody; L482-543 patch_bonus; L429-476 patch_pdf_data_points for the audit pattern)
    - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py (pt_to_blocks signature — returns (rows, lossy))
    - docs/API_CONTRACTS.md §31.7 (~L2599 — the draft-read shape to amend FIRST, contract-first)
    - packages/pipeline/tests/test_content_patch_endpoints.py (existing MockTransport/monkeypatch fixtures to extend)
  </read_first>
  <behavior>
    - Test test_draft_read_includes_pdf_content: get_issue_draft on a doc with real pdfContent returns sections["problemStatement"]["pdfContent"] verbatim ({problemStatement, keyDataPoints[3x {stat,source}], interventionMechanism})
    - Test test_draft_read_decomposes_bonus_body: a doc whose bonus.body is stored Portable Text (h2 + paragraph blocks) returns bonus["body"] as [{type:'h2',text},{type:'paragraph',text}] rows and bonus["bodyLossy"] false; a markDefs-bearing bonus block sets bodyLossy true
    - Test test_bonus_headline_only_save_omits_body: PATCH /bonus with {variant:'specAd', headline:'X'} and NO blocks key emits a Sanity set containing ONLY bonus.headline — no bonus.body key; same for variant:'jingle' with only lyrics (no bonus.body wipe)
  </behavior>
  <action>
**(A) Contract first — amend docs/API_CONTRACTS.md §31.7** (BEFORE the code changes below). Update the draft-read response shape to:
```
{ revisionId,
  sections: {
    <name>: { headline, blocks: [{type,text}], lossy: boolean,
              pdfContent?: {problemStatement, keyDataPoints: [{stat,source}] (3), interventionMechanism} }  // problemStatement ONLY, verbatim from Sanity
  },
  theme, game,
  bonus,        // body is now DECOMPOSED {type,text}[] rows (via pt_to_blocks) + sibling bodyLossy: boolean;
                // all other bonus fields (headline, lyrics, sunoPrompt, sunoAudioUrl, storyboards) verbatim
  bonusType, podcast, conversation }
```
Also amend the §31.2/§31.3 `/bonus` payload note: `blocks`, `headline`, `body`, `lyrics`, `sunoPrompt` are ALL optional — the endpoint patches ONLY the fields present in the request (omitted field = untouched in Sanity); `variant` remains required. Note in §31.7 that the frontend must send `variant` on every /bonus PATCH.

**(B) sanity_client.py — get_issue_draft():** in the `_LONG_READS` shaping loop, when `name == "problemStatement"` add `sections[name]["pdfContent"] = sec.get("pdfContent") or {}` (verbatim, no reshaping). Replace the raw `"bonus": doc.get("bonus") or {}` return entry with a decomposed copy:
```python
raw_bonus = dict(doc.get("bonus") or {})
bonus_rows, bonus_lossy = pt_to_blocks(raw_bonus.get("body") or [])
raw_bonus["body"] = bonus_rows
raw_bonus["bodyLossy"] = bonus_lossy
```
and return `"bonus": raw_bonus`. Do NOT touch `_DRAFT_GROQ` (it already pulls the full objects).

**(C) api/content.py — patch_bonus():** make every optional field omit-able (only patch what the caller sent):
```python
if body.variant == "specAd":
    if body.blocks is not None:
        blocks = [b.model_dump() for b in body.blocks]
        warnings = structural_floor_warnings(blocks)
        fields["bonus.body"] = compose_section_body(blocks)
elif body.variant == "bigBudget":
    if body.body is not None:
        fields["bonus.body"] = text_to_portable_text(body.body)
elif body.variant == "jingle":
    if body.body is not None:
        fields["bonus.body"] = text_to_portable_text(body.body)
    if body.lyrics is not None:
        fields["bonus.lyrics"] = body.lyrics
    if body.sunoPrompt is not None:
        fields["bonus.sunoPrompt"] = body.sunoPrompt
```
(the `if body.headline is not None` guard already exists — keep it). If `fields` ends up empty, return the current revision unchanged (no mutate call) with `{"revisionId": body.ifRevisionID, "warnings": []}` — do not send an empty patch. Note: `patch_bonus` calls `get_issue_draft` for the variant guard/before-snapshot — the decomposed `bonus["body"]` rows are fine for the audit `before` snapshot (JSON-dumped either way).

**(D) Tests — extend packages/pipeline/tests/test_content_patch_endpoints.py** with the three behavior tests above, using the existing MockTransport (Sanity) + monkeypatch (`_cc.convex_query`/`convex_mutation`) fixtures. The omit-body test must assert on the CAPTURED mutate request body that the `set` dict has no `bonus.body` key. Then run the FULL pipeline suite.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py::test_draft_read_includes_pdf_content tests/test_content_patch_endpoints.py::test_draft_read_decomposes_bonus_body tests/test_content_patch_endpoints.py::test_bonus_headline_only_save_omits_body -q 2>&1 | tail -5 && cd packages/pipeline && uv run pytest -q --ignore=tests/lib/test_vercel_client.py 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - docs/API_CONTRACTS.md §31.7 documents `pdfContent` on sections.problemStatement AND the decomposed `bonus.body` rows + `bodyLossy` flag (`grep -q "bodyLossy" docs/API_CONTRACTS.md` and `grep -q "pdfContent" docs/API_CONTRACTS.md`), and the /bonus payload is documented omit-able ("patches ONLY the fields present")
    - `grep -q 'pdfContent' packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` and `grep -q 'bodyLossy' packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`
    - `grep -q "blocks is not None" packages/pipeline/src/eisenbalm_pipeline/api/content.py` and `grep -c "or \\[\\])" packages/pipeline/src/eisenbalm_pipeline/api/content.py` shows the specAd `body.blocks or []` wipe pattern is GONE from patch_bonus; `grep -q 'text_to_portable_text(body.body or "")' packages/pipeline/src/eisenbalm_pipeline/api/content.py` returns NO hits
    - the three new tests pass; full pipeline suite reports 0 failures (baseline: 381 passed, 33 skipped)
  </acceptance_criteria>
  <done>§31.7 amended first; get_issue_draft returns pdfContent verbatim and bonus.body as decomposed rows with bodyLossy; patch_bonus never sets a field the caller omitted; all new + existing pipeline tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Frontend — prefill pdf/bonus from the extended draft, dirty-gate the pdf and bonus-body save steps, fix the bonus payload contract</name>
  <files>apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx, apps/dispatch-control/__tests__/review-desk-editors.test.tsx</files>
  <read_first>
    - apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx (buildWorkingState L103-167, sectionSlice L170-190, saveSection L268-330 — the exact lines being changed)
    - apps/dispatch-control/lib/contentPatchClient.ts (patchBonus L296-307, BonusPatchPayload L113-119, patchPdfDataPoints)
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py (L216-223 _BonusBody — the payload field names the client MUST match: variant required, blocks for specAd rows)
    - apps/dispatch-control/__tests__/review-desk-editors.test.tsx (existing mock/save-wiring test patterns to extend)
  </read_first>
  <behavior>
    - Test: buildWorkingState prefills working.pdf from draft.sections.problemStatement.pdfContent (real values render, not blanks); missing pdfContent still yields the 3-blank-rows default
    - Test: a problemStatement save where ONLY headline/blocks changed calls patchHeadline + patchSection but does NOT call patchPdfDataPoints (mocked patchPdfDataPoints not invoked)
    - Test: a problemStatement save where the pdf sub-state changed DOES call patchPdfDataPoints with the edited values
    - Test: a specAd bonus headline-only save calls patchBonus with a payload containing variant:'specAd' and headline, and NO blocks and NO body key
    - Test: a specAd bonus save where the block editor changed includes blocks (the {type,text} rows) in the payload
  </behavior>
  <action>
All changes in `SectionEditorPanel.tsx`:

**(A) Prefill (buildWorkingState):**
- Replace the hardcoded blank at L158 with a read of the extended draft:
```ts
const rawPdf = (draft.sections?.problemStatement as any)?.pdfContent ?? {}
pdf: {
  problemStatement: rawPdf.problemStatement ?? '',
  keyDataPoints: Array.isArray(rawPdf.keyDataPoints) && rawPdf.keyDataPoints.length === 3
    ? rawPdf.keyDataPoints.map((r: any) => ({ stat: r?.stat ?? '', source: r?.source ?? '' }))
    : blankKeyDataPoints(),
  interventionMechanism: rawPdf.interventionMechanism ?? '',
},
```
Remove the now-stale "upstream gap" comment (L156-157).
- Bonus: `body: coerceBlocks(rawBonus.body)` now receives decomposed rows from the server and passes them through — keep `coerceBlocks` as the defensive layer but set `lossy: Boolean(rawBonus.bodyLossy)` (replacing the hardcoded `lossy: false` at L139) and surface it to the BonusEditor the same way long-read lossy flags flow.

**(B) Dirty-gate the chained saves (saveSection):**
- Add sub-slice dirty checks computed against `loaded`:
```ts
const pdfDirty = JSON.stringify(working.pdf) !== JSON.stringify(loaded.pdf)
const bonusBodyDirty = JSON.stringify(working.bonus.body) !== JSON.stringify(loaded.bonus.body)
```
- In the `problemStatement` branch, wrap the `patchPdfDataPoints` step in `if (pdfDirty) { ... }` — a prose-only save skips it entirely. (Keep `sectionSlice('problemStatement')` bundling pdf into the section's dirty indicator — the chip should still show dirty for a pdf-only edit; only the PATCH call is gated.)
- Similarly gate the long-read prose steps if desired is NOT required — leave headline/blocks steps as-is (they patch only their own fields; no cross-field clobber).

**(C) Fix the bonus payload to match _BonusBody (server contract):**
```ts
const payload: BonusPatchPayload = {
  ifRevisionID: revId,
  variant: working.bonusType,                     // REQUIRED by _BonusBody — was missing entirely
  headline: working.bonus.headline,
}
if (working.bonusType === 'specAd' && bonusBodyDirty) payload.blocks = working.bonus.body   // server field is `blocks`, NOT `body`
if (working.bonusType === 'jingle') {
  payload.lyrics = working.bonus.lyrics
  payload.sunoPrompt = working.bonus.sunoPrompt
}
```
Never set a `body` key for specAd (that name is the bigBudget/jingle prose string on the server).

**(D) Tests — extend apps/dispatch-control/__tests__/review-desk-editors.test.tsx** with the five behavior tests above (mock `contentPatchClient` module fns; assert call/no-call and exact payload keys via `expect.objectContaining` / `expect.not.objectContaining({ blocks: expect.anything() })` and an explicit `expect('body' in capturedPayload).toBe(false)` for the headline-only case). Then run the full dispatch-control suite AND the strict build.
  </action>
  <verify>
    <automated>cd apps/dispatch-control && pnpm test -- --run review-desk-editors 2>&1 | tail -6 && cd apps/dispatch-control && pnpm test -- --run 2>&1 | tail -4 && cd apps/dispatch-control && pnpm build 2>&1 | tail -8</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "pdfContent" "apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/SectionEditorPanel.tsx"` (prefill wired) and the hardcoded blank-pdf literal with the "upstream gap" comment is gone (`grep -q "upstream gap" ...SectionEditorPanel.tsx` returns NO hits)
    - `grep -q "pdfDirty" ...SectionEditorPanel.tsx` and the `patchPdfDataPoints` call sits inside that guard
    - `grep -q "bonusBodyDirty" ...SectionEditorPanel.tsx`; the bonus payload sets `variant` (`grep -q "variant: working.bonusType" ...SectionEditorPanel.tsx`) and uses `payload.blocks` for specAd (`grep -q "payload.blocks" ...SectionEditorPanel.tsx`); `grep -q "payload.body = working.bonus.body" ...SectionEditorPanel.tsx` returns NO hits
    - `grep -q "bodyLossy" ...SectionEditorPanel.tsx` (bonus lossy flag surfaced, no longer hardcoded false)
    - the five new vitest assertions pass; full dispatch-control suite >= 253 passing baseline; `pnpm --filter dispatch-control build` exits 0
    - EDT-05 tripwire still green (runs as part of the full suite)
  </acceptance_criteria>
  <done>PDF data points and specAd bonus body prefill real content on load; a prose-only problemStatement save cannot touch pdfContent and a headline-only bonus save cannot touch bonus.body; the bonus payload matches the server contract (variant + blocks); full suite + strict build green.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest -q --ignore=tests/lib/test_vercel_client.py` — 0 failures (>= 381-pass baseline + 3 new)
- `pnpm --filter dispatch-control test -- --run` — 0 failures (>= 253-pass baseline + 5 new)
- `pnpm --filter dispatch-control build` — exits 0
- Cross-field non-clobber proven on BOTH sides: server omit-test asserts no `bonus.body` in the emitted set; client tests assert patchPdfDataPoints not called / no blocks key on undirtied saves
- Manual re-check (from 31-VERIFICATION.md Human Verification 1): edit only the problem-statement headline on a real draft with populated keyDataPoints, save, confirm `problemStatement.pdfContent.keyDataPoints` unchanged in Sanity
</verification>

<success_criteria>
- Both verifier gaps closed at root: read path complete (pdfContent verbatim, bonus.body decomposed + bodyLossy) AND save steps dirty-gated (pdf patch, specAd blocks) AND patch_bonus cannot wipe omitted fields
- The adjacent contract mismatches fixed (bonus payload carries required variant; specAd rows sent as blocks)
- §31.7 amended before code (contract-first); full pipeline pytest + dispatch-control vitest + strict build all green
</success_criteria>

<output>
After completion, create `.planning/phases/31-content-patch-endpoints-full-editing/31-06-SUMMARY.md`
</output>
