---
phase: 18
slug: magazine-editorial-layout-writers
status: complete
created: 2026-05-30
---

# Phase 18 — Verification

> Per-MEL pass/fail matrix. Generated at the close of Plans 18-01 through 18-06.

## MEL Matrix

| ID | Description | Verification Method | Result | Evidence |
|----|-------------|---------------------|--------|----------|
| MEL-01 | >=2 h2/h3 in each of 5 long-read section bodies | `pytest tests/agents/test_writer_structural_floor.py::test_structural_floor_headings_required -q` | PASS | 5 passed in 0.14s |
| MEL-02 | >=1 blockquote in each of 5 long-read sections | `pytest tests/agents/test_writer_structural_floor.py::test_structural_floor_blockquote_required -q` | PASS | 5 passed in 0.13s |
| MEL-03 | Body prose voice byte-equivalent | `pytest tests/test_section_writer_voice_propagation.py tests/test_voice.py -q` | PASS | 8 passed in 0.14s (Phase 16 NRR-04 byte-equivalence preserved) |
| MEL-04 | structural-variety axis in JudgeFinding + rubric.md | `pytest tests/agents/test_qa_structural_axis.py -q` | PASS | 2 passed in 0.14s |
| MEL-05 | Pipeline >=200 tests + web >=234 tests | `pytest -q` + `pnpm --filter web test:unit --run` | PASS | pipeline: 226 passed, 33 skipped; web: 234 passed (26 test files) |
| MEL-06 | Live /issue HTML has >=2 `<h2>` + >=1 `<blockquote>` per long-read section | Andrew UAT — Task 3 | PENDING (Andrew UAT) | See Live HTML Scan section below |
| MEL-07 | Cost <=15% increase per writer call | Real-mode measurement (see Cost section below) | ESTIMATED PASS | ~80 token system-prompt addition per writer; <10% increase per run; within 15% cap with margin |
| MEL-08 | BigBudget + Jingle do NOT carry structural floor | `pytest tests/agents/test_bonus_specad_only.py -q` | PASS | 3 passed in 0.13s |

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
Result: **226 passed, 33 skipped, 6 warnings in 10.83s**

Web (all GREEN — `pnpm --filter web test:unit --run`):

- [x] __tests__/deliberation-no-model-names.test.ts (DEL-04)
- [x] __tests__/game-sandbox.test.ts (Phase 7)
- [x] __tests__/issue-page-typography.test.ts (Phase 10)
- [x] __tests__/deliberation-conversation.test.ts (Phase 13)
- [x] __tests__/podcast-slot.test.ts (Phase 13)
- [x] __tests__/theme-aa-tones.test.ts (Phase 14)
- [x] __tests__/shop-page.test.ts (Phase 15)
- [x] __tests__/narrator-chip.test.ts (Phase 16)

Full web suite result: **234 passed (26 test files) in 3.75s**

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
    # Python-based section extraction (more reliable than awk for multi-line HTML)
    python3 - <<'PYEOF'
import re, sys

section = sys.argv[1] if len(sys.argv) > 1 else '$SECTION'
with open('/tmp/phase18-issue.html') as f:
    html = f.read()

# Find section start (id="origin-story" etc.)
start_pat = f'id="{section}"'
start = html.find(start_pat)
if start == -1:
    print(f"Section {section} not found in HTML")
    sys.exit(0)

# Find the next section anchor to bound extraction
# Look for the next id=" that starts a new major section
next_section_start = html.find('id="', start + len(start_pat))
chunk = html[start:next_section_start] if next_section_start != -1 else html[start:]

h2_count = chunk.count('<h2')
bq_count = chunk.count('<blockquote')
print(f"h2 count: {h2_count} (expected >= 2)")
print(f"blockquote count: {bq_count} (expected >= 1)")
PYEOF
    # Use the env variable
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
