---
phase: 18-magazine-editorial-layout-writers
plan: 06
type: execute
wave: 4
depends_on: [18-05]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py
  - .planning/phases/18-magazine-editorial-layout-writers/18-VERIFICATION.md
  - .planning/phases/18-magazine-editorial-layout-writers/18-VALIDATION.md
autonomous: false
requirements: [MEL-03, MEL-05, MEL-06, MEL-07]

must_haves:
  truths:
    - "5 stub fixtures (origin_story_output, problem_output, founder_bio_output, case_study_output, bonus_output[specAd variant]) emit conforming list[dict] body shapes"
    - "Full pipeline pytest suite passes >= 202 tests (190 Phase 16 baseline + 34 Plan 18-02 + 0 regression from fixture update)"
    - "Full web vitest suite passes >= 234 tests (Phase 16 baseline preserved)"
    - "18-VERIFICATION.md exists with per-MEL pass/fail matrix"
    - "Andrew runs the live HTML scan + visual UAT and signs off on the reading-experience improvement (MEL-06)"
    - "Cost diff measured and recorded — MEL-07 cap (<=15%) either confirmed or explicitly disclaimed if structured-output token capture is approximate"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py"
      provides: "5 stub fixtures emit list[dict] body shapes that satisfy the structural floor"
      contains: "blockquote"
    - path: ".planning/phases/18-magazine-editorial-layout-writers/18-VERIFICATION.md"
      provides: "Per-MEL verification matrix + live HTML scan results + cost diff"
      contains: "MEL-06"
    - path: ".planning/phases/18-magazine-editorial-layout-writers/18-VALIDATION.md"
      provides: "Updated frontmatter: nyquist_compliant: true, wave_0_complete: true; per-task status updated to GREEN"
      contains: "nyquist_compliant: true"
  key_links:
    - from: "stubs/fixtures.py origin_story_output() output shape"
      to: "agents/origin_story.OriginStoryOutput._enforce_structural_floor (Plan 18-04)"
      via: "stub-mode pipeline doesn't run Pydantic validators, but the fixture must still produce shape that flows correctly through compose_section_body in sanity_client.py"
      pattern: "list of dicts with type/text keys; >=2 h2/h3; >=1 blockquote"
    - from: "18-VERIFICATION.md HTML scan"
      to: "live production /issue/[next-slug]"
      via: "curl + grep <h2>/<blockquote> per section"
      pattern: "<h2>|<blockquote>"
---

<objective>
Close Phase 18 with three artifacts:
1. Stub-fixture updates so the full pytest suite (which runs in stub mode by default) doesn't
   regress — every long-read fixture emits a conforming `list[dict]` body that flows correctly
   through Plan 18-04's `compose_section_body` Sanity-write path.
2. `18-VERIFICATION.md` — the per-MEL pass/fail matrix used as the verify-work gate.
3. Andrew UAT checkpoint — the live HTML scan + qualitative reading-experience check.

The verification + UAT step closes MEL-06 (the user-perceived payoff: no more wall of 19px prose
on `/issue/[slug]`).

Purpose: Hand the executor a tight closing checklist; transition Phase 18 from "code complete"
to "verified shipped" and ready for `/gsd:verify-work`.
Output: 1 modified Python file (fixtures), 1 new verification doc, 1 updated validation doc,
1 Andrew UAT checkpoint with sign-off in 18-VERIFICATION.md.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/18-magazine-editorial-layout-writers/18-CONTEXT.md
@.planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md
@.planning/phases/18-magazine-editorial-layout-writers/18-VALIDATION.md
@packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py

<interfaces>
<!-- 5 stub fixture functions to update (RESEARCH §Pitfall 4) -->
<!-- Current shape (from RESEARCH §sources): body: str = "plain text..." -->
<!-- Target shape (from RESEARCH §Code Examples): body: list[{type, text}] -->

Conforming origin_story body template:
```python
"body": [
    {"type": "paragraph", "text": "Burlington, Vermont. 1987."},
    {"type": "h2",        "text": "The founding moment"},
    {"type": "paragraph", "text": "A librarian made a recording."},
    {"type": "blockquote","text": "The silence is the product."},
    {"type": "h2",        "text": "Why not something else"},
    {"type": "paragraph", "text": "Acoustic data has no institutional home."},
],
```

5 fixture functions per stubs/fixtures.py inspection:
- origin_story_output() — sets state['origin_story']
- problem_output() — sets state['problem_statement']; pdfContent stays unchanged (D-03)
- founder_bio_output() — sets state['founder_bio']
- case_study_output() — sets state['case_study']
- bonus_output() — sets state['bonus']; default is bigBudget (D-16); if any test exercises specAd
  variant, that fixture variant must conform too

Live verification URL pattern (RESEARCH §Validation Architecture + ROADMAP success criterion 6):
- https://eisenbalm-web.vercel.app/issue/<latest-issue-slug>
- HTML scan: per-section <h2> count >= 2; per-section <blockquote> count >= 1

Tripwires that MUST stay green (CONTEXT canonical_refs):
- All Phase 7/10/12/13/14/15/16 web tripwires
- packages/pipeline/tests/test_section_writer_voice_propagation.py (Phase 16 NRR-04)
- packages/pipeline/tests/test_voice.py (Phase 16 NRR-10)
- Phase 8 commerce sentinel suite (29 tests)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Update 5 long-read stub fixtures in stubs/fixtures.py to emit conforming list[dict] body shapes</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py (full file — see the 5 long-read fixture functions: origin_story_output line 239, problem_output line 262, founder_bio_output line 284, case_study_output line 300, bonus_output line 341)
    - packages/pipeline/tests/agents/test_stub_fixtures.py (if it exists — verify what shape it expects; update assertions if needed)
    - packages/pipeline/tests/test_pipeline_e2e.py (the full-pipeline stub e2e test — confirm it consumes section state after fan-out; the fixture shape must allow this test to complete)
    - .planning/phases/18-magazine-editorial-layout-writers/18-RESEARCH.md §Pitfall 4 + §Code Examples (the conforming body shape template is HIGH-confidence)
  </read_first>
  <behavior>
    - 5 long-read fixture functions emit `body: list[dict]` conforming to the structural floor (>=2 h2/h3 + >=1 blockquote each)
    - Each fixture body has at least 6 blocks: 1 lead paragraph + 2 h2 + 1 blockquote + 2 paragraphs (or equivalent satisfying counts)
    - problem_output's pdfContent dict stays UNCHANGED (D-03 — Phase 6 contract)
    - bonus_output stays on bigBudget (D-16 — Phase 5 default); BigBudget body remains str (D-04 — NO change to bonus_output's body shape unless a specAd variant exists). If the default bonus_output is bigBudget, no change. If a specAd variant fixture exists, it gets the list[dict] treatment.
    - All other fixtures (calibrator, scout, advocate, editor, researcher, game, qa, publisher, design) UNTOUCHED
    - Full pytest suite passes — no per-agent or e2e regression
  </behavior>
  <action>
    Open `packages/pipeline/src/eisenbalm_pipeline/stubs/fixtures.py`. Locate each of the 4
    narrative fixtures and rewrite the `body` field from a str literal to a `list[dict]`
    conforming payload.

    **EDIT 1 — `origin_story_output` (line ~239)**. Replace the `body` value:
    ```python
    def origin_story_output() -> dict:
        return {
            "origin_story": {
                "headline": "The Quiet Foundation, 1987",
                "body": [
                    {"type": "paragraph", "text": "Burlington, Vermont. 1987."},
                    {"type": "h2",        "text": "The founding moment"},
                    {"type": "paragraph", "text": "A librarian made a recording."},
                    {"type": "blockquote","text": "The silence is the product."},
                    {"type": "h2",        "text": "Why not something else"},
                    {"type": "paragraph", "text": "Acoustic data has no institutional home."},
                ],
            },
        }
    ```

    **EDIT 2 — `problem_output` (line ~262)**. ONLY the `body` field changes; the `pdfContent`
    dict stays byte-identical (D-03):
    ```python
    def problem_output() -> dict:
        return {
            "problem_statement": {
                "headline": "<existing headline preserved>",
                "body": [
                    {"type": "paragraph", "text": "The problem is structural."},
                    {"type": "h2",        "text": "What goes unmeasured"},
                    {"type": "paragraph", "text": "Three categories of harm escape current accounting."},
                    {"type": "blockquote","text": "Absence of data is itself a measurement."},
                    {"type": "h2",        "text": "Why intervention works"},
                    {"type": "paragraph", "text": "The mechanism is direct: replace a missing instrument."},
                ],
                "pdfContent": {
                    # <preserve the existing pdfContent dict verbatim — D-03>
                },
            },
        }
    ```

    Read the existing `problem_output` first; preserve its existing `headline` and `pdfContent` dict
    byte-for-byte (D-03 — the `keyDataPoints` list of exactly 3 entries must remain intact). ONLY the
    `body` value changes.

    **EDIT 3 — `founder_bio_output` (line ~284)**. Replace the `body` value:
    ```python
    def founder_bio_output() -> dict:
        return {
            "founder_bio": {
                "headline": "<existing headline preserved>",
                "body": [
                    {"type": "paragraph", "text": "The founder was a public-service archivist."},
                    {"type": "h2",        "text": "Before the foundation"},
                    {"type": "paragraph", "text": "Seventeen years inside the state records office."},
                    {"type": "blockquote","text": "Information that nobody asks for is also information."},
                    {"type": "h2",        "text": "The decision to leave"},
                    {"type": "paragraph", "text": "The pension was forfeit. The work could not wait."},
                ],
            },
        }
    ```

    Preserve any existing additional fields beyond `headline` and `body` byte-for-byte.

    **EDIT 4 — `case_study_output` (line ~300)**. Replace the `body` value (CaseStudyContent has
    `subjectName` too — preserve it):
    ```python
    def case_study_output() -> dict:
        return {
            "case_study": {
                "subjectName": "<existing subjectName preserved>",
                "headline": "<existing headline preserved>",
                "body": [
                    {"type": "paragraph", "text": "A nurse in Tacoma submitted a recording in 2019."},
                    {"type": "h2",        "text": "What the recording captured"},
                    {"type": "paragraph", "text": "Twelve minutes of ambient hospital corridor."},
                    {"type": "blockquote","text": "The data set is now cited in seven peer-reviewed papers."},
                    {"type": "h2",        "text": "What it changed"},
                    {"type": "paragraph", "text": "A scheduling protocol was rewritten across two states."},
                ],
            },
        }
    ```

    **EDIT 5 — `bonus_output` (line ~341)**. Per the file header docstring "Big-budget bonus shape
    per CONTEXT D-16 (Phase 5 owns rotation)" the default is bigBudget. CONTEXT D-04 keeps
    BigBudgetBonus.body as str — NO CHANGE to bonus_output's body in this case. Verify the fixture
    is bigBudget (not specAd); if it is, leave it BYTE-UNCHANGED. If there is a separate specAd
    variant fixture in the file (search for "specAd" in fixtures.py — likely absent), update only
    that variant's body to a list[dict] shape mirroring origin_story's template.

    DO NOT touch any other fixture function (calibrator, scout, advocate, editor, researcher, game,
    qa, publisher, design — these are not long-read writers).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest -x -q 2>&1 | tail -3</automated>
  </verify>
  <acceptance_criteria>
    - Each updated fixture function has body that is a list with at least 6 entries: `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.stubs.fixtures import origin_story_output, problem_output, founder_bio_output, case_study_output; assert len(origin_story_output()['origin_story']['body']) >= 6; assert len(problem_output()['problem_statement']['body']) >= 6; assert len(founder_bio_output()['founder_bio']['body']) >= 6; assert len(case_study_output()['case_study']['body']) >= 6; print('OK')"` prints `OK`
    - Each updated fixture body has >=2 h2/h3 + >=1 blockquote: `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.stubs.fixtures import origin_story_output, problem_output, founder_bio_output, case_study_output;\nfor name, get in [('origin', lambda: origin_story_output()['origin_story']['body']), ('problem', lambda: problem_output()['problem_statement']['body']), ('founder', lambda: founder_bio_output()['founder_bio']['body']), ('case', lambda: case_study_output()['case_study']['body'])]:\n    body = get()\n    h = sum(1 for b in body if b['type'] in ('h2','h3'))\n    bq = sum(1 for b in body if b['type'] == 'blockquote')\n    assert h >= 2, name + ' h=' + str(h); assert bq >= 1, name + ' bq=' + str(bq)\nprint('OK')"` prints `OK`
    - problem_output's pdfContent is preserved (D-03): `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.stubs.fixtures import problem_output; pc = problem_output()['problem_statement']['pdfContent']; assert 'keyDataPoints' in pc; assert len(pc['keyDataPoints']) == 3; print('OK')"` prints `OK`
    - bonus_output's body is unchanged when bonusType is bigBudget (D-04): `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.stubs.fixtures import bonus_output; b = bonus_output()['bonus']['body']; assert isinstance(b, str), 'BigBudget body must remain str (D-04), got ' + type(b).__name__; print('OK')"` prints `OK`
    - Full pipeline pytest suite passes: `cd packages/pipeline && uv run pytest -x -q 2>&1 | tail -2` shows >= 202 passed (190 Phase 16 + 34 Plan 18-02 + 0 fixture-related regression; some per-agent tests may have stricter assertions that need a small update — record any such test in 18-VERIFICATION.md and resolve)
    - Phase 16 byte-equivalence tests still pass: `cd packages/pipeline && uv run pytest tests/test_section_writer_voice_propagation.py tests/test_voice.py -q 2>&1 | tail -1` shows pass
  </acceptance_criteria>
  <done>
    4 narrative stub fixtures (origin_story, problem, founder_bio, case_study) emit conforming list[dict] body shapes; bonus_output untouched (bigBudget, D-04); problem_output pdfContent preserved (D-03); full pytest suite >= 202 passing.
  </done>
</task>

<task type="auto">
  <name>Task 2: Author 18-VERIFICATION.md with per-MEL pass/fail matrix + cost note + HTML scan template</name>
  <files>.planning/phases/18-magazine-editorial-layout-writers/18-VERIFICATION.md, .planning/phases/18-magazine-editorial-layout-writers/18-VALIDATION.md</files>
  <read_first>
    - .planning/phases/18-magazine-editorial-layout-writers/18-VALIDATION.md (existing per-task verification map; needs frontmatter update to nyquist_compliant: true after Wave 0/1/2/3 complete + per-task status update)
    - .planning/phases/16-choose-your-narrator/16-HUMAN-UAT.md (if it exists — pattern reference for the UAT section; otherwise structure freely)
    - .planning/phases/15-shop-storefront/15-SUMMARY.md (if it exists — pattern reference for Phase wrap-up artifacts)
  </read_first>
  <action>
    **CREATE `18-VERIFICATION.md`** with this EXACT structure (fill in measured values during
    execution; the executor must run each automated command and paste the actual output):

    ```markdown
    ---
    phase: 18
    slug: magazine-editorial-layout-writers
    status: draft
    created: 2026-05-30
    ---

    # Phase 18 — Verification

    > Per-MEL pass/fail matrix. Generated at the close of Plans 18-01 through 18-06.

    ## MEL Matrix

    | ID | Description | Verification Method | Result | Evidence |
    |----|-------------|---------------------|--------|----------|
    | MEL-01 | >=2 h2/h3 in each of 5 long-read section bodies | `pytest tests/agents/test_writer_structural_floor.py::test_structural_floor_headings_required -q` | <PASS/FAIL> | <paste tail -1 of pytest output> |
    | MEL-02 | >=1 blockquote in each of 5 long-read sections | `pytest tests/agents/test_writer_structural_floor.py::test_structural_floor_blockquote_required -q` | <PASS/FAIL> | <paste tail -1 of pytest output> |
    | MEL-03 | Body prose voice byte-equivalent | `pytest tests/test_section_writer_voice_propagation.py tests/test_voice.py -q` | <PASS/FAIL> | <paste tail -1> |
    | MEL-04 | structural-variety axis in JudgeFinding + rubric.md | `pytest tests/agents/test_qa_structural_axis.py -q` | <PASS/FAIL> | <paste tail -1> |
    | MEL-05 | Pipeline >=200 tests + web >=234 tests | `pytest -q` + `pnpm --filter web test:unit --run` | <PASS/FAIL> | pipeline: <N passed>; web: <N passed> |
    | MEL-06 | Live /issue HTML has >=2 <h2> + >=1 <blockquote> per long-read section | Andrew UAT — Task 3 | <PASS/FAIL> | <link to deployed issue URL + screenshot or curl output> |
    | MEL-07 | Cost <=15% increase per writer call | Real-mode measurement (see Cost section below) | <PASS/FAIL or ESTIMATED> | <token diff or worst-case disclaimer> |
    | MEL-08 | BigBudget + Jingle do NOT carry structural floor | `pytest tests/agents/test_bonus_specad_only.py -q` | <PASS/FAIL> | <paste tail -1> |

    ## Tripwire Matrix (zero-regression contract from 18-CONTEXT canonical_refs)

    Pipeline (must all stay GREEN):
    - [ ] tests/test_section_writer_voice_propagation.py (Phase 16 NRR-04)
    - [ ] tests/test_voice.py (Phase 16 NRR-10)
    - [ ] tests/test_qa_judge_narrator.py (Phase 16)
    - [ ] tests/test_chronicler.py (Phase 13)
    - [ ] tests/test_pipeline_e2e.py
    - [ ] tests/test_sanity_write.py
    - [ ] tests/test_sanity_client_pdfcontent.py (Phase 6 D-03 confirmed)

    Web (must all stay GREEN — capture pnpm --filter web test:unit --run output):
    - [ ] __tests__/deliberation-no-model-names.test.ts (DEL-04)
    - [ ] __tests__/game-sandbox.test.ts (Phase 7)
    - [ ] __tests__/issue-page-typography.test.ts (Phase 10)
    - [ ] __tests__/deliberation-conversation.test.ts (Phase 13)
    - [ ] __tests__/podcast-slot.test.ts (Phase 13)
    - [ ] __tests__/theme-aa-tones.test.ts (Phase 14)
    - [ ] __tests__/shop-page.test.ts (Phase 15)
    - [ ] __tests__/narrator-chip.test.ts (Phase 16)

    ## Cost Measurement (MEL-07)

    Phase 5 Plan 05-15 noted token capture is approximate on the structured-output path (the
    langchain-openai 1.2.1 wrapper does not expose `usage_metadata` on `with_structured_output`).
    Per-writer cost is therefore a controlled estimate, not a measured number:

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

    **Result:** <ESTIMATED PASS — within budget per estimate above | MEASURED PASS | MEASURED FAIL>

    ## Live HTML Scan (MEL-06)

    Run after Andrew triggers a new pipeline run and publishes the resulting draft issue.

    ```bash
    SLUG=<latest-published-issue-slug>
    URL="https://eisenbalm-web.vercel.app/issue/$SLUG"

    curl -s "$URL" > /tmp/phase18-issue.html

    # Per-section scan: each of the 5 long-read sections should have >=2 <h2> and >=1 <blockquote>
    # The exact section container selectors depend on EditorialSection.tsx; use the section anchor IDs:
    for SECTION in origin-story problem founder-bio case-study bonus; do
        echo "=== $SECTION ==="
        # Extract section block by anchor id; count h2 + blockquote
        awk -v s="id=\"$SECTION\"" '$0 ~ s {f=1} f && /id="next-section"/ {f=0} f' /tmp/phase18-issue.html | \
            grep -c "<h2"
        awk -v s="id=\"$SECTION\"" '$0 ~ s {f=1} f && /id="next-section"/ {f=0} f' /tmp/phase18-issue.html | \
            grep -c "<blockquote"
    done
    ```

    (Adapt the awk extraction to whatever section delimiter the rendered HTML actually uses — read
    apps/web/components/issue/EditorialSection.tsx to confirm the anchor ID pattern.)

    Expected output: every section reports >= 2 for <h2> AND >= 1 for <blockquote>.

    ## Andrew UAT Sign-Off

    See Task 3 below — Andrew confirms the reading experience qualitatively improved.

    **Sign-off:** <UNSIGNED until checkpoint:human-verify approved>
    **Sign-off date:** <YYYY-MM-DD when Andrew approves>
    ```

    **THEN UPDATE `18-VALIDATION.md` frontmatter** — flip status fields:
    - `status: draft` → `status: complete`
    - `nyquist_compliant: false` → `nyquist_compliant: true`
    - `wave_0_complete: false` → `wave_0_complete: true`

    AND update the Per-Task Verification Map status column: change every ⬜ pending to ✅ green
    (or ❌ red if a test legitimately fails — record the failure in 18-VERIFICATION.md).

    AND check off the Validation Sign-Off checklist at the bottom of 18-VALIDATION.md.
  </action>
  <verify>
    <automated>test -f .planning/phases/18-magazine-editorial-layout-writers/18-VERIFICATION.md && grep -c "MEL-0[1-8]" .planning/phases/18-magazine-editorial-layout-writers/18-VERIFICATION.md</automated>
  </verify>
  <acceptance_criteria>
    - `.planning/phases/18-magazine-editorial-layout-writers/18-VERIFICATION.md` exists
    - File contains all 8 MEL IDs in the matrix: `grep -c "MEL-0[1-8]" .planning/phases/18-magazine-editorial-layout-writers/18-VERIFICATION.md` returns >= 8
    - File contains the Tripwire Matrix heading: `grep -c "Tripwire Matrix" .planning/phases/18-magazine-editorial-layout-writers/18-VERIFICATION.md` returns `1`
    - File contains the Cost Measurement section + HTML scan command: `grep -c "Cost Measurement\|Live HTML Scan" .planning/phases/18-magazine-editorial-layout-writers/18-VERIFICATION.md` returns `2`
    - 18-VALIDATION.md frontmatter flipped: `grep "nyquist_compliant: true" .planning/phases/18-magazine-editorial-layout-writers/18-VALIDATION.md` matches one line
    - 18-VALIDATION.md frontmatter flipped: `grep "wave_0_complete: true" .planning/phases/18-magazine-editorial-layout-writers/18-VALIDATION.md` matches one line
    - 18-VALIDATION.md frontmatter status: `grep "^status: complete" .planning/phases/18-magazine-editorial-layout-writers/18-VALIDATION.md` matches one line
    - All Per-Task statuses updated (no remaining ⬜): `grep -c "⬜ pending" .planning/phases/18-magazine-editorial-layout-writers/18-VALIDATION.md` returns `0`
    - Each MEL row has a Result column with PASS/FAIL/ESTIMATED (filled in during execution; placeholder `<PASS/FAIL>` strings are NOT acceptable at task close — `grep -c "<PASS/FAIL>\|<paste" .planning/phases/18-magazine-editorial-layout-writers/18-VERIFICATION.md` returns `0`)
  </acceptance_criteria>
  <done>
    18-VERIFICATION.md exists with completed MEL matrix (8 rows), Tripwire Matrix, Cost section, Live HTML Scan section, and Andrew UAT sign-off section; 18-VALIDATION.md frontmatter flipped to nyquist_compliant: true + wave_0_complete: true + status: complete with all per-task statuses updated.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Andrew UAT — live HTML scan + qualitative reading-experience confirmation</name>
  <files>.planning/phases/18-magazine-editorial-layout-writers/18-VERIFICATION.md</files>
  <action>See &lt;how-to-verify&gt; below — Andrew triggers a pipeline run, publishes the resulting draft in Sanity Studio, opens the live URL, performs the visual + HTML-count + voice checks, then fills MEL-06 + Andrew UAT Sign-Off in 18-VERIFICATION.md.</action>
  <verify>
    <automated>MISSING — manual UAT checkpoint per CONTEXT (the user-perceived payoff is qualitative and cannot be asserted by CI). Mechanical fallback that anchors the human check: curl -s https://eisenbalm-web.vercel.app/issue/$SLUG | grep -c '&lt;h2' must return >=10 AND grep -c '&lt;blockquote' must return >=5 across the page.</automated>
  </verify>
  <done>Andrew has written PASS into the MEL-06 row of 18-VERIFICATION.md, signed the UAT block with email + date, and pasted the HTML count grep output; OR has written FAIL with a description that routes to a follow-up plan.</done>
  <what-built>
    Phase 18 is code-complete: every long-read writer (origin_story, problem, founder_bio, case_study,
    and bonus when bonusType=='specAd') emits structured Portable Text with at least 2 sub-headers
    (h2 or h3) + 1 blockquote per section. The frontend PortableTextRenderer.tsx (Phase 10) has been
    rendering these primitives all along; Phase 18 activated the dead code by upgrading the writers.

    Andrew now confirms the user-perceived payoff at the live URL: no more wall of 19px prose.
  </what-built>
  <how-to-verify>
    1. **Trigger a fresh pipeline run** (Andrew's choice — either click the manual trigger in the
       Sanity Studio toolbar OR run from the terminal):
       ```bash
       cd packages/pipeline
       # If running locally against production:
       PIPELINE_TRIGGER_SECRET=<from .env> curl -X POST https://eisenbalm-pipeline.up.railway.app/run/weekly \
         -H "X-Pipeline-Trigger-Secret: $PIPELINE_TRIGGER_SECRET"
       # Returns: {"runId": "..."}
       ```

    2. **Wait for the draft to appear in Sanity Studio** (~10-15 min for a real-mode run). Open
       Sanity Studio, find the new `weeklyIssue` draft, review its 5 long-read sections in
       Studio's preview — visually confirm each section has sub-headers + a pull-quote.

    3. **Publish the issue** in Sanity Studio (Andrew's normal review-and-publish flow).

    4. **Wait ~30 seconds** for the Vercel deploy hook to fire and the Next.js build to complete.

    5. **Open the live URL:** `https://eisenbalm-web.vercel.app/issue/<new-slug>`

    6. **Visual check (the actual payoff):** scroll through each of the 5 long-read sections.
       The reading experience should feel like scanning a magazine spread, NOT reading a single
       wall of 19px paragraphs:
       - Origin Story: at least 2 sub-headers break the body into 3+ logical chunks; at least 1
         blockquote is visually distinct (display font, italic, accent-colored left border)
       - Problem Statement: same
       - Founder Bio: same
       - Case Study: same
       - Bonus: same (if bonusType happened to be specAd this issue; if bigBudget, the storyboards
         provide the visual variety as designed — D-04)

    7. **HTML count check (mechanical confirmation):** in a terminal,
       ```bash
       curl -s https://eisenbalm-web.vercel.app/issue/<new-slug> > /tmp/issue.html
       grep -c '<h2' /tmp/issue.html       # Expect >= 10 across the page (>=2 per section × 5 sections)
       grep -c '<blockquote' /tmp/issue.html  # Expect >= 5 across the page (>=1 per section × 5 sections)
       ```

    8. **Voice check (MEL-03 — narrative byte-equivalence to Jesse register):** read 2-3 paragraphs
       from each section. Confirm:
       - No exclamation marks
       - No "amazing/incredible/transformative" sentimentality
       - No "as an AI / language model" self-reference
       - Same dry, precise, Fortune-500-gravity register as prior issues

    9. **Update `18-VERIFICATION.md` in the same commit:**
       - Fill in the MEL-06 row with PASS + the issue URL
       - Fill in the Andrew UAT Sign-Off section: "<andrew@>" + today's date
       - Paste the HTML count check output in the Live HTML Scan section
       - If anything visibly fails, mark MEL-06 FAIL + describe the symptom (e.g. "Founder Bio
         has only 1 h2 — the writer slipped under the floor; structural-validator may have
         retry-passed with a borderline output; consider tightening STRUCTURE_CONTRACT wording")
  </how-to-verify>
  <resume-signal>
    Type "approved — issue <slug> reads as a scannable magazine spread with sub-heads + pull-quotes
    in each long-read; voice register preserved" once 18-VERIFICATION.md is filled in and committed.
    Or describe specific failures so the planner can route a quick fix or a Phase 18.1 follow-up.
  </resume-signal>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest -q 2>&1 | tail -2` shows >= 202 passed (190 baseline + 34 new MEL tests + 0 regression after fixture update)
- `pnpm --filter web test:unit --run 2>&1 | tail -3` shows >= 234 passed (Phase 16 web baseline preserved)
- All tripwire tests listed in 18-VERIFICATION.md Tripwire Matrix are GREEN (recorded in the doc)
- 18-VERIFICATION.md exists with completed matrix and Andrew sign-off
- 18-VALIDATION.md frontmatter shows nyquist_compliant: true + wave_0_complete: true + status: complete
- Live `/issue/[new-slug]` page has visible h2 sub-headers + blockquote pull-quotes in each long-read section
- 4 narrative fixtures emit list[dict] bodies; bonus_output unchanged (bigBudget per D-04 + D-16); problem_output pdfContent unchanged (D-03)
</verification>

<success_criteria>
- 4 narrative stub fixtures updated to emit conforming list[dict] body
- bonus_output left as bigBudget (D-04 + D-16) — body still str
- problem_output pdfContent preserved (D-03)
- Full pipeline pytest suite >= 202 passing
- Full web vitest suite >= 234 passing
- All tripwires in 18-VERIFICATION.md Tripwire Matrix GREEN
- 18-VERIFICATION.md filled in with measured/observed results (no placeholder strings left)
- 18-VALIDATION.md frontmatter flipped to compliant
- Andrew signs off on the live HTML scan + visual UAT in 18-VERIFICATION.md
- Phase 18 ready for `/gsd:verify-work` (and then ROADMAP.md Phase 18 status flips to Complete)
</success_criteria>

<output>
After completion, create `.planning/phases/18-magazine-editorial-layout-writers/18-06-SUMMARY.md`
summarizing: which fixtures were updated (line diffs), test count delta (pre-plan baseline →
post-plan), MEL matrix outcome (8/8 or partial), Andrew UAT outcome with quoted sign-off line, any
follow-up tasks Andrew identified (file as `/gsd:quick` if minor or open a Phase 18.1 plan if
substantial), and Phase 18 close-out confirmation.
</output>
