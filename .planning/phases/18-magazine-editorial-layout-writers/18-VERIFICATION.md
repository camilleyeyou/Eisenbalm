---
phase: 18
slug: magazine-editorial-layout-writers
status: human_needed
created: 2026-05-30
human_verification:
  - test: "Trigger a real pipeline run on production with a fresh issueNumber; after Andrew publishes the draft in Sanity Studio, run: curl -s https://eisenbalm-web.vercel.app/issue/<slug> | grep -c '<h2'  (expect >= 10) and grep -c '<blockquote' (expect >= 5). Per-section check documented in the Live HTML Scan section below."
    expected: ">=10 <h2> elements and >=5 <blockquote> elements across the page; per-section: >=2 h2 and >=1 blockquote within each of origin-story, problem, founder-bio, case-study, bonus section containers"
    why_human: "Requires a live production pipeline run — cannot be done in CI; depends on Andrew triggering /run/weekly and publishing the resulting draft in Sanity Studio"
  - test: "After the controlled real-mode run completes, diff pipelineRuns.cost per-writer USD totals against the Phase 5 baseline to confirm <=+15% cost increase per writer call."
    expected: "Each writer's per-call cost is at most 15% above the Phase 5 baseline; expected ~+8-10% from the ~80-token STRUCTURE_CONTRACT addition"
    why_human: "Real-mode OpenRouter call required; token capture on the structured-output path is approximate (Phase 5 D-15 known limitation: langchain-openai 1.2.1 does not expose usage_metadata on with_structured_output)"
---

# Phase 18 — Verification

> Per-MEL pass/fail matrix. Generated at the close of Plans 18-01 through 18-06.
> Audited by gsd-verifier 2026-05-30 — all mechanical claims confirmed against actual codebase.

## MEL Matrix

| ID | Description | Verification Method | Result | Evidence |
|----|-------------|---------------------|--------|----------|
| MEL-01 | >=2 h2/h3 in each of 5 long-read section bodies | `pytest tests/agents/test_writer_structural_floor.py::test_structural_floor_headings_required -q` | PASS | 5 passed in 0.13s (verified by auditor 2026-05-30) |
| MEL-02 | >=1 blockquote in each of 5 long-read sections | `pytest tests/agents/test_writer_structural_floor.py::test_structural_floor_blockquote_required -q` | PASS | 5 passed in 0.13s (verified by auditor 2026-05-30) |
| MEL-03 | Body prose voice byte-equivalent | `pytest tests/test_section_writer_voice_propagation.py tests/test_voice.py -q` | PASS | 8 passed in 0.14s — STRUCTURE_CONTRACT lives in section_guidance, not voice_constraints; NRR-04/NRR-10 intact (verified 2026-05-30) |
| MEL-04 | structural-variety axis in JudgeFinding + rubric.md | `pytest tests/agents/test_qa_structural_axis.py -q` | PASS | 2 passed in 0.13s (verified by auditor 2026-05-30) |
| MEL-05 | Pipeline >=200 tests + web >=234 tests | `pytest -q` + `pnpm --filter web test:unit --run` | PASS | pipeline: 226 passed, 33 skipped; web: 234 passed (26 test files) — verified by auditor 2026-05-30 |
| MEL-06 | Live /issue HTML has >=2 `<h2>` + >=1 `<blockquote>` per long-read section | Andrew UAT — Task 3 | PENDING (Andrew UAT) | See Live HTML Scan section below |
| MEL-07 | Cost <=15% increase per writer call | Real-mode measurement (see Cost section below) | ESTIMATED PASS | ~80 token system-prompt addition per writer; <10% increase per run; within 15% cap with margin |
| MEL-08 | BigBudget + Jingle do NOT carry structural floor | `pytest tests/agents/test_bonus_specad_only.py -q` | PASS | 3 passed in 0.13s (verified by auditor 2026-05-30) |

## Tripwire Matrix (zero-regression contract from 18-CONTEXT canonical_refs)

Pipeline (all GREEN):

- [x] tests/test_section_writer_voice_propagation.py (Phase 16 NRR-04) — 8 passed in 0.14s
- [x] tests/test_voice.py (Phase 16 NRR-10) — included in above run
- [x] tests/test_qa_judge_narrator.py (Phase 16) — included in full suite 226 passed
- [x] tests/test_chronicler.py (Phase 13) — included in full suite 226 passed
- [x] tests/test_pipeline_e2e.py — skipped (SUPABASE_POSTGRES_URL not set; correct expected behavior in CI)
- [x] tests/test_sanity_write.py — included in full suite 226 passed
- [x] tests/test_sanity_client_pdfcontent.py (Phase 6 D-03 confirmed) — included in full suite 226 passed

Full suite command run: `cd packages/pipeline && uv run pytest -q`
Result: **226 passed, 33 skipped, 6 warnings** (verified 2026-05-30)

Web (all GREEN — `pnpm --filter web test:unit --run`):

- [x] __tests__/deliberation-no-model-names.test.ts (DEL-04)
- [x] __tests__/game-sandbox.test.ts (Phase 7)
- [x] __tests__/issue-page-typography.test.ts (Phase 10)
- [x] __tests__/deliberation-conversation.test.ts (Phase 13)
- [x] __tests__/podcast-slot.test.ts (Phase 13)
- [x] __tests__/theme-aa-tones.test.ts (Phase 14)
- [x] __tests__/shop-page.test.ts (Phase 15)
- [x] __tests__/narrator-chip.test.ts (Phase 16)

Full web suite result: **234 passed (26 test files) in 3.75s** (verified 2026-05-30)

## Cost Measurement (MEL-07)

Phase 5 Plan 05-15 noted token capture is approximate on the structured-output path (the
langchain-openai 1.2.1 wrapper does not expose `usage_metadata` on `with_structured_output`).
Per-writer cost is therefore a controlled estimate, not a measured number.

**Estimate basis:**

- STRUCTURE_CONTRACT addition: ~80 tokens per writer system prompt
- Typical writer input: ~800-1200 tokens
- Increase: <10% per writer per run (under the 15% cap with margin)
- Worst case (every writer hits structural-floor retry once): +100% per writer per failing-retry run; expected-case is 0 retries once the model is tuned to the new contract

**Verification command (real-mode, optional — only if Andrew approves OPENROUTER token spend):**

```bash
cd packages/pipeline && EISENBALM_STUB_MODE=false uv run pytest tests/test_pipeline_real_mode.py -q
# Then inspect pipelineRuns.cost per-agent USD totals against Phase 5 baseline
```

**Result:** ESTIMATED PASS — within budget per estimate above (~80 tokens added per writer; <10% overhead; well under the 15% cap). Precise measurement requires a controlled real-mode run with token capture via `include_raw=True` workaround (see Phase 5 D-15 open TODO).

## Live HTML Scan (MEL-06)

Run after Andrew triggers a new pipeline run and publishes the resulting draft issue.

```bash
SLUG=<latest-published-issue-slug>
URL="https://eisenbalm-web.vercel.app/issue/$SLUG"

curl -s "$URL" > /tmp/phase18-issue.html

# Quick page-level check (expects >= 10 h2 across all sections x 5 + >= 5 blockquotes x 5)
echo "=== Page-level h2 count ==="
grep -c "<h2" /tmp/phase18-issue.html
echo "=== Page-level blockquote count ==="
grep -c "<blockquote" /tmp/phase18-issue.html
```

Expected minimum: h2 count >= 10, blockquote count >= 5 across the page.

**Per-section granular check** (EditorialSection.tsx uses `id={id}` anchors per page.tsx; section IDs are `origin-story`, `problem`, `founder-bio`, `case-study`, `bonus`):

```bash
for SECTION in origin-story problem founder-bio case-study bonus; do
    echo "=== $SECTION ==="
    python3 -c "
section = '$SECTION'
with open('/tmp/phase18-issue.html') as f:
    html = f.read()
start_pat = f'id=\"{section}\"'
start = html.find(start_pat)
if start == -1:
    print(f'Section {section} not found'); exit(0)
next_s = html.find('id=\"', start + len(start_pat))
chunk = html[start:next_s] if next_s != -1 else html[start:]
print(f'h2={chunk.count(\"<h2\")} (expect >=2), blockquote={chunk.count(\"<blockquote\")} (expect >=1)')
"
done
```

Simplified one-liner version Andrew can run after publishing:

```bash
SLUG=issue-<NN>  # Replace with actual slug from Sanity Studio
curl -s "https://eisenbalm-web.vercel.app/issue/$SLUG" > /tmp/issue.html
echo "h2 total: $(grep -c '<h2' /tmp/issue.html)   (expect >= 10)"
echo "blockquote total: $(grep -c '<blockquote' /tmp/issue.html)   (expect >= 5)"
```

**Live HTML scan results:** PENDING Andrew UAT

## Andrew UAT Sign-Off

**What was built:** Phase 18 is code-complete. Every long-read writer (origin_story, problem,
founder_bio, case_study, and bonus when bonusType=='specAd') now emits structured Portable Text
with at least 2 sub-headers (h2 or h3) + 1 blockquote per section. The frontend
PortableTextRenderer.tsx (Phase 10) has been rendering these primitives all along; Phase 18
activated the dead code by upgrading the writers. Stub fixtures also updated to emit conforming
list[dict] bodies so the full pytest suite stays green.

**Andrew confirms:**
1. Visual check: Each long-read section breaks into 3+ logical chunks with visible sub-headers (not a single wall of 19px prose)
2. Pull-quote: At least one blockquote per long-read section is visually distinct (display font, accent-colored left border per PortableTextRenderer)
3. Voice: Prose register is dry/precise/Jesse-voice throughout (no exclamation marks, no sentiment, no AI self-reference)
4. HTML count: grep confirms >= 10 `<h2>` + >= 5 `<blockquote>` on the page

**Sign-off:** UNSIGNED until checkpoint:human-verify approved
**Sign-off date:** (YYYY-MM-DD when Andrew approves)
**Issue URL reviewed:** (paste full URL here)

---

## Verifier Audit

**Audited:** 2026-05-30
**Auditor:** Claude (gsd-verifier)
**Method:** Goal-backward mechanical verification against actual codebase; all test suites re-run

### What was verified

**MEL-01 — CONFIRMED.** `OriginStoryOutput`, `ProblemOutput`, `FounderBioOutput`, `CaseStudyOutput`, `SpecAdBonus` all have `body: list[BodyBlock]` (imported from `graph/blocks.py`) and `@field_validator('body') _enforce_structural_floor` that raises `ValueError("structural-floor: ...")` when heading count < 2. Test `test_structural_floor_headings_required` (5 parametrized writers) passes. Source confirmed in `agents/{origin_story,problem,founder_bio,case_study,bonus}.py`.

**MEL-02 — CONFIRMED.** Same validators raise `ValueError("structural-floor: ... blockquote ...")` when blockquote count < 1. Test `test_structural_floor_blockquote_required` (5 parametrized writers) passes.

**MEL-03 — CONFIRMED.** STRUCTURE_CONTRACT is appended to `SECTION_GUIDANCE` / `GUIDANCE_VERIFIED` / `GUIDANCE_ANONYMOUS` string constants — these are passed via `section_guidance` kwarg to `build_section_writer_prompt`, NOT via `voice_constraints`. The `voice_constraints` kwarg carries `style_brief.get("voice") or VOICE_CONSTRAINTS` unchanged. Phase 16 NRR-04 byte-equivalence guard holds. `test_section_writer_voice_propagation.py` + `test_voice.py` = 8 passed.

**MEL-04 — CONFIRMED.** `JudgeFinding.axis` Literal in `agents/qa/judge.py` line 85 includes `"structural-variety"`. `rubric.md` lines 49-55 document the `structural-variety` axis with `severity: warning`. `test_qa_structural_axis.py` = 2 passed.

**MEL-05 — CONFIRMED.** Pipeline: 226 passed, 33 skipped (>= 200 criterion met). Web vitest: 234 passed, 26 files (baseline preserved). All Phase 18 tripwire tests included in count.

**MEL-06 — HUMAN NEEDED (non-blocking).** Requires Andrew to trigger a production pipeline run and publish a draft issue. The scan commands are fully documented in the Live HTML Scan section. The code path that produces h2/blockquote blocks is mechanically verified (MEL-01 + MEL-02 + sanity_client write path using `compose_section_body`). The frontend `PortableTextRenderer.tsx` h2/h3/blockquote handlers are confirmed present and unchanged.

**MEL-07 — HUMAN NEEDED (non-blocking, estimated pass).** STRUCTURE_CONTRACT additions confirmed at ~80 tokens per writer (text measured in source). Real-mode token capture requires Andrew to approve an OPENROUTER spend. ESTIMATED PASS per basis documented above.

**MEL-08 — CONFIRMED.** `BigBudgetBonus.body: str` and `JingleBonus.body: str` confirmed in `agents/bonus.py` lines 59 and 70. Neither class has `_enforce_structural_floor`. `SpecAdBonus.body: list[BodyBlock]` with the validator confirmed at lines 88-106. `test_bonus_specad_only.py` = 3 passed. `_build_big_budget_prompt` and `_build_jingle_prompt` are byte-unchanged (no STRUCTURE_CONTRACT added).

### Supporting infrastructure confirmed

- `graph/blocks.py` — `BodyBlock` discriminated union (Paragraph | Heading | Blockquote) present and correctly typed.
- `lib/portable_text.py` — `block_paragraph`, `block_h2`, `block_h3`, `block_blockquote`, `compose_section_body` all present and correct.
- `lib/sanity_client.py` — all 4 long-read section write paths use `compose_section_body(...)` (lines 195, 202, 215, 223); `_build_bonus` uses `compose_section_body` for specAd, `text_to_portable_text` for bigBudget/jingle (D-04 correctly implemented).
- `docs/API_CONTRACTS.md` — §2.4 and §7 updated; `BodyBlock` discriminated union documented; `compose_section_body` documented alongside the legacy `text_to_portable_text`.
- Stub fixtures in `stubs/fixtures.py` — all 4 long-read sections emit conforming `list[dict]` bodies (2 h2 + 1 blockquote each); bigBudget bonus fixture retains `body: str` (correct per D-04).
- `apps/web/components/issue/PortableTextRenderer.tsx` — h2/h3/blockquote handlers confirmed present (Phase 10 artifact, unchanged in Phase 18).
- No Sanity schema changes, no frontend component changes, no Convex schema changes — confirmed by audit.

### Minor discrepancy noted (non-blocking)

The original VERIFICATION.md MEL-01 row cites "5 passed in 0.14s" and MEL-02 cites "5 passed in 0.13s". The full `test_writer_structural_floor.py` file contains 4 test functions × 5 parametrized writers = 20 tests total. The cited commands (`::test_structural_floor_headings_required` and `::test_structural_floor_blockquote_required`) each produce 5 passes — the citation is accurate for those specific test functions; the full file produces 20 passes. No discrepancy in correctness; only in presentation.

### Overall verdict

**Status: human_needed.** MEL-01 through MEL-05 and MEL-08 are mechanically verified and pass. MEL-06 (live HTML scan) and MEL-07 (cost measurement) require Andrew to trigger a production pipeline run — these are correctly classified as non-blocking human verification items per `18-VALIDATION.md` Manual-Only Verifications table. The phase goal is code-complete; Andrew UAT is the remaining gate before sign-off.
