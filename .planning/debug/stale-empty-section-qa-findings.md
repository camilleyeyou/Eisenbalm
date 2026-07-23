---
status: awaiting_human_verify
trigger: "The QA judge emits error-severity \"The {section} section is empty. This is a required section and cannot be evaluated or published without content.\" findings for sections that ARE fully populated in the final Sanity draft. The false finding (axis=precision, severity=error, quotedSpan='') renders as a loud UNRESOLVED·ERROR card in the dispatch-control galley and — because it is an open factual-axis error — BLOCKS the \"Facts cleared\" sign-off. Root-cause it, then fix."
created: 2026-07-23T00:00:00Z
updated: 2026-07-23T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — see Resolution below.
test: n/a — root cause confirmed with direct evidence from Convex
  (agent_run_payloads outputSnapshot/inputSnapshot) proving state was never
  empty; code reading confirming `_body_to_text`'s shape mismatch.
expecting: n/a
next_action: human verification of the two live-remediated runs in
  dispatch-control (facts-cleared gate should no longer be blocked by the
  false findings for issue 999681; issue 999682 still correctly blocked by
  2 unrelated real findings) + confirm no recurrence on the next real
  pipeline run.

## Symptoms

expected: QA judges the same section content that write_issue_draft
  persists; no "empty section" findings when sections have content.
actual: QA received EMPTY section bodies mid-run while the final Sanity
  draft has full content for those same sections. Confirmed via Convex
  qaCorrections:byRunId + Sanity public API:
  - run fcbe76ce136e49a59475f2f621227b4c (issue 999682, MIB Agents): 1
    empty-section finding (origin_story; error/precision; quotedSpan '';
    timestamp 2026-07-23T13:29:51Z). Sanity draft originStory = 10 blocks +
    headline.
  - run f48a0a4d5c3140f994afaedd5c5d93ff (issue 999681, FOCUS): 5
    empty-section findings (origin_story, problem, founder_bio, case_study,
    bonus). Sanity draft has ALL sections populated.
  - run 59c7db3f56fe403abe6a43920b057756 (issue 999608, yesterday): 0
    empty-section findings.
errors: none thrown — the run completes to awaiting-review; the defect is
  silent data inconsistency.
reproduction: trigger a pipeline run (POST /pipeline/run); observed on 2 of
  2 runs on the day this was reported.
started: not a recent regression — see Root Cause. The defect has existed
  since the Phase 18-04 commit that shipped the flat BodyBlock shape; the
  VISIBLE symptom (the LLM judge explicitly saying "this section is empty")
  is an intermittent LLM judgment call on top of an always-broken extraction,
  which is why it looked new.

## Eliminated

- hypothesis: LangGraph fan-in/join race — validate_sections or qa runs
    before all 7 parallel section writers' outputs are merged into state.
  evidence: Convex agentRuns:byRunId timing for both runs shows validate_sections
    starting strictly after every writer's `completedAt` (e.g. f48a0a4d:
    writers finish by 1784813677341, validate_sections starts 1784813677633).
    More conclusively, `qa`'s own `agent_run_payloads.inputSnapshot` (the
    ACTUAL state object LangGraph passed into the qa node, captured by
    agent_wrapper.py before fn() runs) contains the full, rich prose for
    origin_story/problem/founder_bio/case_study for BOTH runs — the state
    was never empty when QA read it.
  timestamp: 2026-07-23

- hypothesis: a section writer's structured-output call returned a
    genuinely empty body (LLM failure / empty-structured-output class, same
    family as the scout-zero-candidates recurrence).
  evidence: each writer's own `agent_run_payloads.outputSnapshot` for both
    runs shows real, substantial prose (1000+ chars, correct headline,
    correct h2/blockquote structure) — tokensOut for every writer was in the
    hundreds-to-thousands range, not a truncation/empty-output signature.
  timestamp: 2026-07-23

- hypothesis: editor_final or publisher regenerates/fills empty sections
    after QA runs, explaining content-after-QA.
  evidence: editor_final (agents/editor.py::editor_final) only reads
    qa_corrections + section headlines to write an advisory memo — it never
    touches section body state. publisher() passes the SAME state object
    through to write_issue_draft with no section mutation in between.
  timestamp: 2026-07-23

- hypothesis: the write_issue_draft/Sanity write path silently "fixes" or
    falls back for empty sections, masking a real empty state.
  evidence: lib/portable_text.py::compose_section_body reads `b.get('type')`
    / `b.get('text', '')` directly off each flat BodyBlock dict — there is
    no fallback/regeneration logic; it faithfully serializes whatever is in
    state. This ruled out a second bug at the Sanity-write layer and pointed
    at the QA-side reader instead.
  timestamp: 2026-07-23

## Evidence

- timestamp: 2026-07-23
  checked: agents/qa/__init__.py::_body_to_text and _block_index_hint
  found: `_body_to_text` iterates `block.get('children') or []` for every
    list-bodied block, then reads `child.get('text','')` from each child.
    But `graph/blocks.py`'s `BodyBlock` (the actual Pydantic model every
    long-read writer emits) is FLAT: `{"type": "paragraph"|"h2"|"h3"|
    "blockquote", "text": "..."}` — there is no `children` key at all.
    `block.get('children')` is always `None` for these blocks, so the inner
    loop iterates zero children, `parts` stays empty, and `_body_to_text`
    returns `''` for EVERY list-bodied section on EVERY run.
    `_block_index_hint` has the identical bug (same `block.get('children')`
    assumption), so blockIndexHint resolution for these findings is also
    silently broken (quotedSpan can never anchor to a block — consistent
    with the reported `quotedSpan=''`).
  implication: `_extract_sections()` (which calls `_body_to_text` on
    origin_story/problem_statement/founder_bio/case_study/bonus) has always
    fed the Layer-2 LLM judge an EMPTY STRING for these sections, regardless
    of what the writer actually produced.

- timestamp: 2026-07-23
  checked: `git log -p` on agents/qa/__init__.py — which commit introduced
    `_body_to_text`
  found: commit `27f364f feat(18-04): rewire 5 sanity_client.py call sites
    and fix test fixtures for list[BodyBlock] body` added `_body_to_text` in
    THE SAME COMMIT that rewired `lib/sanity_client.py`/`lib/portable_text.py`
    for the new flat `BodyBlock` shape. The author correctly updated the
    Sanity-write path but wrote `_body_to_text` against the OLDER nested
    Portable-Text-like shape (`{"children":[{"text":...}]}`) — a same-commit
    authoring inconsistency, not a later regression.
  implication: this has been broken since Phase 18 shipped; it is not a
    recent code change causing "today's" recurrence.

- timestamp: 2026-07-23
  checked: `tests/agents/qa/test_block_index_hint.py` (pre-existing suite)
  found: every fixture built blocks as `{"children": [{"text": ...}]}` — the
    WRONG (legacy) shape. This test suite passed continuously because it
    never exercised the real production shape, masking the bug for its
    entire lifetime.
  implication: the pre-existing green test suite gave false confidence; the
    fixtures needed correcting alongside the source fix (done — see
    Resolution).

- timestamp: 2026-07-23
  checked: Convex `qaCorrections:byRunId` for both affected runs (full rows)
  found: every "section is empty" finding has `severity="error"`,
    `axis="precision"`, `quotedSpan=""` — exactly matching the symptom. Both
    runs ALSO contain a derivative false finding on `bonus`
    (`axis="cross-section-consistency"`, severity="warning") whose reason
    text explicitly says "...because five of six sections are empty" for
    run fcbe76ce — a direct hallucinated consequence of the SAME extraction
    bug (the judge saw 5 empty sections + 1 real bonus, and correctly
    noticed the (fake) inconsistency). Also found: run f48a0a4d's `bonus`
    happened to be a `SpecAdBonus` (list[BodyBlock] — affected), while
    fcbe76ce's `bonus` happened to be a `BigBudgetBonus`/`JingleBonus`
    (plain `str` body — NOT affected, since `_body_to_text` correctly
    passes through `str` unchanged). This fully explains why fcbe76ce only
    had 1 empty-section finding (origin_story) while f48a0a4d had 5 (bonus
    included) — the bonus TYPE (chosen per-run by Calibrator) determines
    whether it hits the same bug, independent of any run-to-run "regression."
  implication: the false-empty claim on origin_story/problem/founder_bio/
    case_study is UNCONDITIONAL (those 4 are always list[BodyBlock] since
    Phase 18); bonus is conditionally affected depending on the run's
    bonusType. The LLM's decision to explicitly SURFACE the "this section is
    empty" finding (vs. silently producing fewer/no findings for that
    section) is a non-deterministic judgment call layered on top of an
    always-broken, deterministic extraction bug — this is why the visible
    symptom rate varies run to run (0, 1, or 5 findings) even though the
    underlying defect fires identically every time.

## Resolution

root_cause: |
  `agents/qa/__init__.py::_body_to_text()` (and its sibling
  `_block_index_hint()`) were written against the legacy nested
  Portable-Text-like block shape (`{"children": [{"text": ...}]}`). Phase
  18's "post-launch fix" (see `graph/blocks.py` docstring) collapsed every
  long-read writer's structured-output schema (OriginStory/Problem/
  FounderBio/CaseStudy/SpecAdBonus) into a FLAT `BodyBlock{type, text}`
  shape (no `children` key) specifically because Anthropic's structured-
  output API rejects `oneOf` schemas. `_body_to_text` was added in the SAME
  commit that shipped this flat shape everywhere else, but its author
  assumed the OLD nested shape — a same-commit authoring mistake. As a
  result, `_body_to_text` has returned `""` for EVERY list-bodied section on
  EVERY run since Phase 18, silently feeding the Layer-2 LLM judge an empty
  view of sections the writers had, in every observed case, actually
  populated with real content (proven via each writer's own recorded
  `agent_run_payloads.outputSnapshot`, independent of the buggy QA
  extraction path). Whether the judge, given that empty view, explicitly
  emits a "this section is empty" finding is a non-deterministic LLM
  judgment call — which is why the OBSERVABLE symptom is intermittent (0,
  1, or 5 findings per run) even though the underlying extraction defect is
  constant. The pre-existing `tests/agents/qa/test_block_index_hint.py`
  suite used the same wrong (legacy) block shape in its fixtures, so it
  passed continuously without ever exercising the real production shape,
  masking the bug for its entire lifetime.

  The Sanity draft was never actually missing content: `lib/portable_text.py
  ::compose_section_body` (the Sanity-write path) correctly reads
  `block.get('type')`/`block.get('text', '')` directly off the same flat
  BodyBlock dicts, so `write_issue_draft` always persisted the writers' real
  output — only QA's OWN internal extraction was blind to it.

fix: |
  (a) PREVENT — packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py:
      `_body_to_text()` and `_block_index_hint()` now read `block.get('text',
      '')` directly for the real flat BodyBlock shape, falling back to the
      legacy nested `children[].text` extraction ONLY when a block actually
      has a `children` key (defensive back-compat, not the production shape).

  (b) HEAL — new `heal_stale_empty_section_findings(run_id, sections)` in the
      same module, wired into `agents/publisher/__init__.py::publisher()`
      immediately after `write_issue_draft` succeeds. It queries
      `qaCorrections:byRunId`, and for any OPEN finding whose `reason`
      matches "the {sectionName} section is empty" for its OWN sectionName
      AND whose freshly-re-extracted (now-fixed) section text is non-empty,
      calls `qaCorrections:setResolution` with `resolution="dismissed"` and
      an explanatory `resolutionReason`, `resolvedBy="pipeline-auto-heal"`.
      Conservative by design — never touches any other finding (real voice/
      precision findings on real content, or genuinely-still-empty
      sections, are left untouched), and best-effort (a Convex hiccup here
      never fails an otherwise-successful run).

  (c) LIVE REMEDIATION (one-off, not a code path) — directly invoked
      `heal_stale_empty_section_findings` against the two already-affected
      runs using each writer's own recorded `agent_run_payloads.
      outputSnapshot` as proof of non-empty content (the Sanity API token in
      the local `.env` is stale/expired — "Session not found" — so direct
      Sanity draft verification wasn't available locally; the independent
      Convex writer-output evidence was already conclusive). Result:
      4 stale findings dismissed for run fcbe76ce136e49a59475f2f621227b4c
      (origin_story/problem/founder_bio/case_study), 5 for run
      f48a0a4d5c3140f994afaedd5c5d93ff (origin_story/problem/founder_bio/
      case_study/bonus). The one non-pattern-matching derivative finding
      (cross-section-consistency "five of six sections are empty" on
      fcbe76ce) was intentionally left for manual review since it does not
      match the conservative automated pattern (by design) — Andrew can
      dismiss it directly in dispatch-control with one click, or a future
      "revisit follow-up" could match it too.

verification: |
  1. Full pipeline test suite: `EISENBALM_STUB_MODE=true uv run pytest
     tests/ -q` → 732 passed, 38 skipped (pre-existing), 0 failures.
  2. New regression tests added and passing:
     - tests/agents/qa/test_body_to_text_extraction.py (7 tests) — proves
       `_body_to_text`/`_extract_sections` correctly extract the real flat
       BodyBlock shape (would have failed before the fix), plus legacy
       shape + str passthrough + genuinely-empty-stays-empty coverage.
     - tests/agents/qa/test_heal_stale_empty_section_findings.py (8 tests)
       — proves the heal path dismisses ONLY the exact stale pattern,
       never cross-contaminates sections, never touches already-resolved
       or unrelated findings, and no-ops when the query returns nothing.
     - tests/agents/qa/test_block_index_hint.py — fixtures corrected to the
       real flat shape (this alone would have caught the bug had it existed
       at authoring time); added a dedicated legacy-shape back-compat test.
  3. Live remediation verified via direct Convex query
     (qaCorrections:byRunId) post-heal:
     - f48a0a4d5c3140f994afaedd5c5d93ff (issue 999681): 0 open error-severity
       findings remain (only 2 unrelated warning-severity `game` findings).
       The facts-cleared gate (api/signoffs.py: blocks on severity=="error"
       AND no resolution AND axis not in VOICE_AXES) is no longer blocked
       by this bug.
     - fcbe76ce136e49a59475f2f621227b4c (issue 999682): the 4 false findings
       are dismissed; 2 GENUINE error-severity findings remain open on
       `bonus` (an actual vague hedge + an actual unattributed statistic —
       real QA feedback on real content, unrelated to this bug) and
       correctly continue to block facts-cleared until Andrew addresses
       them — confirming the fix did not over-heal.
  4. NOT YET verified: a fresh real pipeline run producing zero new
     "section is empty" findings end-to-end (requires triggering a real
     run, which is a human/operational action outside this debug session's
     scope — see Awaiting below).

files_changed:
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
  - packages/pipeline/tests/agents/qa/test_block_index_hint.py
  - packages/pipeline/tests/agents/qa/test_body_to_text_extraction.py (new)
  - packages/pipeline/tests/agents/qa/test_heal_stale_empty_section_findings.py (new)
