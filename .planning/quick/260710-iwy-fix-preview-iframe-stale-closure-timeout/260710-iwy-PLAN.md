---
phase: quick-260710-iwy
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/PreviewIframe.tsx
  - apps/dispatch-control/__tests__/PreviewIframe.test.tsx
  - packages/pipeline/src/eisenbalm_pipeline/lib/claims.py
  - packages/pipeline/tests/test_claims_extractor.py
autonomous: true
requirements: [PREVIEW-IFRAME-TIMEOUT, CLAIMS-EXTRACTOR-NOISE]
must_haves:
  truths:
    - "A successfully-loaded preview iframe stays visible indefinitely — it never flips to the error state ~30s after loading"
    - "A never-loading iframe still shows the 'Preview unavailable.' error state after LOAD_TIMEOUT_MS"
    - "The Factual Claims checklist no longer contains sentence-length headline proper-noun fragments; heading (h1–h4) and blockquote blocks are excluded from extraction"
    - "Genuine numbers, dates, and 2–5 word entity names (founder/org names, $ amounts, years) still extract — full recall preserved"
    - "Overlapping proper-noun fragments de-duplicate down to the single longest surviving entity"
    - "Claim context snippets are trimmed to word boundaries (no mid-word truncation like '…Netw' / '…Just')"
  artifacts:
    - path: "apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/PreviewIframe.tsx"
      provides: "Load-timeout effect that depends on [loaded] and early-returns once loaded, so the timer is cancelled after onLoad and never re-armed"
    - path: "apps/dispatch-control/__tests__/PreviewIframe.test.tsx"
      provides: "Fake-timer component tests proving loaded-stays-visible and never-loaded-shows-error past the timeout"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/claims.py"
      provides: "Claims-scoped heading/blockquote block filter, headline string-field exclusion, proper-noun word-count cap, substring de-overlap, word-boundary context"
    - path: "packages/pipeline/tests/test_claims_extractor.py"
      provides: "Updated + new cases proving headline exclusion, runaway rejection, de-overlap, recall retention, and word-bounded context"
  key_links:
    - from: "apps/dispatch-control/.../PreviewIframe.tsx"
      to: "iframe onLoad → setLoaded(true)"
      via: "useEffect dependency [loaded] cleanup clearTimeout"
      pattern: "\\}, \\[loaded\\]\\)"
    - from: "packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py"
      to: "packages/pipeline/src/eisenbalm_pipeline/lib/claims.py extract_claims_by_block"
      via: "publisher unsourced claim_checks seeding (live checklist path)"
      pattern: "extract_claims_by_block"
---

<objective>
Fix two confirmed, root-caused code defects on the dispatch-control run-review screen. Both are real code bugs, not env/config.

- Bug 1 (dispatch-control): the preview iframe loads, then vanishes ~30s later. A load-timeout `useEffect` with an empty `[]` dep array captures a stale `loaded=false`; after `onLoad` sets `loaded=true`, the still-pending 30s timer sees the stale `false` and calls `setError(true)`, replacing a good preview with the "Preview unavailable." state.
- Bug 2 (pipeline): the "Factual Claims" checklist is garbled — Title-Case section HEADLINE and pull-quote text is over-extracted as sentence-length "proper noun" claims, with context truncated mid-word ("…Netw", "…Just"). Confirmed live on run 999605. Andrew cannot verify these, defeating the factual-clearance gate.

Purpose: restore a stable preview and a verifiable claims checklist without losing genuine numbers/dates/entities.
Output: PreviewIframe timeout fix + component test; claims extractor noise-reduction + updated pytest cases.

OUT OF SCOPE (do NOT implement): the "Estimated Run Cost: —" tile / run-cost instrumentation is a separate known deferred gap. It may be noted as deferred in the SUMMARY but MUST NOT be touched.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/PreviewIframe.tsx
@packages/pipeline/src/eisenbalm_pipeline/lib/claims.py
@packages/pipeline/tests/test_claims_extractor.py
@packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py

<verified_context>
Confirmed by planner code inspection (bake into your execution):

BUG 1 — PreviewIframe.tsx (lines 31–39): the timeout effect uses `useEffect(() => { const timer = setTimeout(() => { if (!loaded) setError(true) }, LOAD_TIMEOUT_MS); return () => clearTimeout(timer) }, [])` with an `eslint-disable react-hooks/exhaustive-deps`. The `[]` deps freeze `loaded=false` in the closure. `handleLoad` already does `setLoaded(true); setError(false)`.

BUG 2 — the LIVE checklist path is the publisher node calling `extract_claims_by_block(sections)` (packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py line 162). That function reads FLAT `{"type","text"}` body blocks directly (`block.get("text")`), so h2/h3/blockquote-TYPE body blocks currently leak into extraction — this is the source of the garbled headline claims. Its `type` vocabulary is 'paragraph' | 'h2' | 'h3' | 'blockquote' (from portable_text.compose_section_body).
The secondary path `extract_claims`/`extract_all_claim_types` flattens NESTED Sanity blocks via `_flatten_portable_text` (reads `children`, `style` in 'normal'|'h2'|'h3'|'blockquote') and `_section_to_text` (appends EVERY string field, incl. the `headline` key).
The proper-noun cap, substring de-overlap, and word-boundary context all belong in the SHARED core (`_extract_from_text` / `_extract_and_dedup`) so they apply to BOTH paths automatically.
Grep confirmed the PUBLIC alias `flatten_portable_text` has NO callers outside claims.py except the `test_flatten_portable_text_*` tests (which use 'normal' blocks) — so a default-off style filter preserves them.
Section string fields: only `headline` is a title-type key in the extracted sections (SectionContent / CaseStudyContent / BonusContent, graph/state.py). `subjectName` and `subjectRole` are FACTUAL and must survive.

INVARIANTS (must all hold):
- LOAD_TIMEOUT_MS stays 30_000; skeleton loader + handleLoad/handleError + loaded/error UI unchanged.
- No new npm or Python deps.
- Claims row SHAPE unchanged — do NOT add/rename any emitted key. `claimType` stays in {number, date, proper_noun} (+ "sourced" produced by the publisher, untouched here). Public signatures of extract_claims / extract_all_claim_types / extract_claims_by_block / flatten_portable_text unchanged.
- Preserve DATE-before-NUMBER typing and existing number/date extraction.
- No convex/ changes expected (if convex/ is somehow touched, run `pnpm check:convex-parity` → must exit 0; otherwise not applicable).
- Contract-first (CLAUDE.md hard rule): if any emitted shape in docs/API_CONTRACTS.md changes, reconcile the doc FIRST. Expected internal-only; the grep to confirm is in Task 2's verify.
</verified_context>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix PreviewIframe stale-closure load timeout + add component test</name>
  <files>
    apps/dispatch-control/app/(dashboard)/run-monitor/runs/[runId]/review/_components/PreviewIframe.tsx
    apps/dispatch-control/__tests__/PreviewIframe.test.tsx
  </files>
  <action>
    In PreviewIframe.tsx, replace the load-timeout `useEffect` (currently `[]`-dep with an inner `if (!loaded)` guard and an `eslint-disable-next-line react-hooks/exhaustive-deps`) with an effect that arms the timer ONLY while not loaded and cancels it once loaded:

      useEffect(() => {
        if (loaded) return
        const timer = setTimeout(() => setError(true), LOAD_TIMEOUT_MS)
        return () => clearTimeout(timer)
      }, [loaded])

    Because `handleLoad` sets `loaded=true`, the re-render re-runs the effect, hits the early-return, and the cleanup `clearTimeout` fires on the PREVIOUS (still-pending) timer — so a loaded preview is never flipped to error. Remove the now-stale `eslint-disable react-hooks/exhaustive-deps` comment (deps are complete) and the inner `if (!loaded)` guard (redundant). Do NOT change LOAD_TIMEOUT_MS (30_000), the skeleton loader block, `handleLoad`/`handleError`, or the loaded/error JSX — this is a surgical effect change only.

    Add apps/dispatch-control/__tests__/PreviewIframe.test.tsx. The vitest config maps `__tests__/*.test.tsx` to the jsdom environment automatically, and `globals: false`, so import test symbols explicitly. Mirror the imports and jest-dom setup of an existing component test — read apps/dispatch-control/__tests__/DecisionRail.test.tsx first and match its `@testing-library/react` + jest-dom pattern exactly. Use vitest fake timers:
      - beforeEach: `vi.useFakeTimers()`; afterEach: `vi.useRealTimers()` + cleanup.
      - Test A "loaded iframe stays visible past the timeout": render `<PreviewIframe previewUrl="https://example.test/preview" />`; fire load on the iframe (`fireEvent.load(screen.getByTitle('Issue preview'))`); then `act(() => vi.advanceTimersByTime(31_000))`; assert `screen.queryByText('Preview unavailable.')` is null AND the iframe (getByTitle('Issue preview')) is still present.
      - Test B "never-loading iframe shows error after the timeout": render the component; do NOT fire load; `act(() => vi.advanceTimersByTime(31_000))`; assert `screen.getByText('Preview unavailable.')` is present.
    No new deps — @testing-library/react, jsdom, and vitest are already devDependencies.
  </action>
  <verify>
    <automated>pnpm --filter dispatch-control test:unit 2>&1 | tail -30  # PreviewIframe.test.tsx (both cases) green</automated>
    <automated>pnpm --filter dispatch-control build  # strict production build — the real type gate (vitest does NOT type-check); must exit 0</automated>
  </verify>
  <done>
    The timeout effect depends on `[loaded]` and early-returns when loaded; the stale-closure that fired `setError` after a successful load is gone. New PreviewIframe.test.tsx proves (a) a loaded iframe stays visible after 31s and (b) a never-loaded iframe shows "Preview unavailable." after 31s. `pnpm --filter dispatch-control build` and the dispatch-control vitest suite both exit 0.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: De-noise the claims extractor (headline/blockquote exclusion, entity cap, de-overlap, word-bounded context)</name>
  <files>
    packages/pipeline/src/eisenbalm_pipeline/lib/claims.py
    packages/pipeline/tests/test_claims_extractor.py
  </files>
  <behavior>
    - Heading (h1–h4) and blockquote blocks yield NO claims — extract only from body prose ('normal' style / 'paragraph' type). Proven for BOTH `extract_all_claim_types` (nested Sanity 'h2'/'blockquote' blocks) and `extract_claims_by_block` (flat `{"type":"h2","text":...}` blocks).
    - A section `headline` (title-type) string field is NOT extracted; factual string fields (`subjectName`, `subjectRole`) still are (proven via `extract_claims`).
    - A long Title-Case sentence run (6+ words) produces NO proper_noun claim (no proper_noun claim exceeds the word cap); a 2–5 word name still extracts.
    - Overlapping proper-noun fragments collapse to the single longest (a fragment fully contained word-wise in a longer surviving proper_noun is dropped).
    - Recall retained: "Founded in 1998 by Jane Doe, who raised $500,000." → proper_noun "Jane Doe" + number "$500,000" + date "1998" all present, DATE-before-NUMBER typing intact.
    - Every claim's `context` is stripped and word-bounded — no mid-word edge truncation.
    - All pre-existing test_claims_extractor.py cases (flatten, numbers, dates, proper nouns, sequential indices, required fields, extract_claims_by_block section/block anchoring) stay green.
  </behavior>
  <action>
    Edit packages/pipeline/src/eisenbalm_pipeline/lib/claims.py with five focused, shape-preserving changes:

    (a) HEADING/BLOCKQUOTE FILTER. Add `_HEADING_BLOCKQUOTE = frozenset({"h1","h2","h3","h4","blockquote"})` (this single set matches both the nested `style` and flat `type` vocabularies).
        - Give `_flatten_portable_text(blocks, exclude_styles: frozenset[str] = frozenset())` the new default-empty param; skip any block whose `block.get("style")` is in `exclude_styles`. Default empty preserves the public `flatten_portable_text` alias behavior and the `test_flatten_portable_text_*` tests (only callers, grep-confirmed). Have `extract_all_claim_types` and `_section_to_text` pass `exclude_styles=_HEADING_BLOCKQUOTE`.
        - In `extract_claims_by_block` (the LIVE publisher path over flat blocks): inside the block loop, `continue` when `block.get("type") in _HEADING_BLOCKQUOTE` before calling `_extract_and_dedup`. This removes run 999605's h2/h3/blockquote leakage.

    (b) HEADLINE STRING-FIELD EXCLUSION in `_section_to_text`. Add `_HEADLINE_KEYS = frozenset({"headline","title","subtitle","subhead","subheading","sectiontitle","kicker","deck","pullquote"})`. Iterate `value.items()` (not `.values()`) and skip a string field whose `key.lower()` is in `_HEADLINE_KEYS`. KEEP all other string fields so founder/subject/org/AUM strings (`subjectName`, `subjectRole`, …) survive. (Confirmed: `headline` is the only title-type key in the extracted sections.)

    (c) PROPER-NOUN WORD CAP. Keep `RE_PROPER_NOUN` greedy/unbounded so runaway runs are REJECTED, not truncated. Add `_MAX_PROPER_NOUN_WORDS = 5` with a comment justifying it (person/org names are 2–5 words — "The Riverside Community Trust"=4, "San Francisco"=2 — while multi-clause Title-Case headline runs are 6+ words and get dropped wholesale). In `_extract_from_text`, when `claim_type == "proper_noun"`, skip any match whose `len(match.split()) > _MAX_PROPER_NOUN_WORDS`.

    (d) SUBSTRING DE-OVERLAP in `_extract_and_dedup`. After the existing exact-normalized dedup, add a containment pass over the surviving `proper_noun` claims ONLY: drop a proper_noun claim whose normalized text is a whole-word substring of a longer surviving proper_noun claim's normalized text (keep the longest). Do NOT touch number/date claims; preserve DATE-before-NUMBER order and first-occurrence order of survivors. Use a word-boundary containment check (e.g. compare `f" {short} "` within `f" {long} "`) so "Trust" is not treated as inside "Trustees".

    (e) WORD-BOUNDARY CONTEXT in `_extract_from_text`. Replace `context = text[max(0,start-30):end+30]` with a snippet expanded to word boundaries: take a ±~40-char window, then if the window start > 0 advance past the first whitespace, and if the window end < len(text) retreat before the last whitespace, so neither edge cuts a token; `.strip()` the result. Keep it short and never truncate the matched `text` itself.

    Preserve every public signature and the returned dict keys exactly (`text`, `claimType`, `context`, plus `claimIndex` for extract_claims/_all, plus `sectionName`/`blockIndexHint` for extract_claims_by_block). Match surrounding style/docstrings.

    Update packages/pipeline/tests/test_claims_extractor.py: keep all existing tests green (adjust ONLY if the cleaner behavior legitimately changes an assertion) and ADD cases covering the six behaviors above — heading/blockquote exclusion (both `extract_all_claim_types` nested 'h2'/'blockquote' AND `extract_claims_by_block` flat h2 body block yields zero rows for that block), runaway-headline rejection (assert no proper_noun claim has >5 words), overlap de-dup (longest survives, fragment dropped), recall ("Jane Doe" + "$500,000" + "1998" all present), headline string-field exclusion via `extract_claims` ({headline: <Title-Case run>, subjectName: "Jane Doe", body:[normal prose]} → run absent from proper_noun, "Jane Doe" present), and word-bounded context (a claim's `context == context.strip()` and its first/last whitespace tokens appear intact in the source text — no partial-token edges).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_claims_extractor.py -v  # updated + new cases green</automated>
    <automated>cd packages/pipeline && uv run pytest -q  # entire pipeline suite green</automated>
    <automated>grep -n "claimType\|blockIndexHint\|extract_claims" docs/API_CONTRACTS.md  # confirm emitted row SHAPE unchanged; if any emitted key added/renamed, update API_CONTRACTS.md FIRST (not expected — only WHICH claims + text/context CONTENT change)</automated>
    <automated>grep -rn "flatten_portable_text" packages  # confirm public-alias callers are only the test_flatten_portable_text_* tests (default exclude preserves them)</automated>
  </verify>
  <done>
    The live `extract_claims_by_block` (publisher path) and the `extract_claims`/`extract_all_claim_types` path no longer emit sentence-length headline proper-noun fragments: heading (h1–h4) + blockquote blocks and headline/title string fields are excluded, runaway Title-Case runs (>5 words) are rejected, overlapping fragments de-duplicate to the longest, and context snippets are word-bounded. Genuine numbers/dates/2–5-word entities still extract (recall intact) with DATE-before-NUMBER typing preserved. Full `uv run pytest` green; row shape + public signatures unchanged; docs/API_CONTRACTS.md unchanged (grep-confirmed). No new deps.
  </done>
</task>

</tasks>

<verification>
- Bug 1 gate: `pnpm --filter dispatch-control build` exits 0 (strict prod build) AND `pnpm --filter dispatch-control test:unit` green (incl. PreviewIframe.test.tsx).
- Bug 2 gate: `cd packages/pipeline && uv run pytest -q` green (esp. tests/test_claims_extractor.py).
- No new npm/Python deps introduced (inspect diffs of package.json / pyproject.toml — must be unchanged).
- docs/API_CONTRACTS.md unchanged (claims row shape identical); no convex/ changes (so `check:convex-parity` not applicable).
- Run-cost "—" tile untouched (out of scope).
</verification>

<success_criteria>
- Loaded preview iframe remains visible past 30s; never-loaded iframe still errors after 30s — both proven by PreviewIframe.test.tsx and the strict build passes.
- Factual Claims checklist for a run like 999605 shows discrete, verifiable entities/numbers/dates with word-bounded context and no headline/pull-quote sentence fragments — proven by the updated + new claims tests with the full pipeline suite green.
- Each task is independently committable.
</success_criteria>

<output>
After completion, create `.planning/quick/260710-iwy-fix-preview-iframe-stale-closure-timeout/260710-iwy-SUMMARY.md`. Note the run-cost "—" tile as an untouched deferred gap (explicitly out of scope for this plan).
</output>
