---
phase: 42-fact-check-stage
plan: 02
type: execute
wave: 2
depends_on: ["42-01"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
  - packages/pipeline/tests/test_researcher_importance.py
  - packages/pipeline/tests/test_publisher_importance.py
autonomous: true
requirements: [FCT-01]

must_haves:
  truths:
    - "The Researcher emits an importance tier (Load-bearing / Supporting / Incidental) on every claim it produces, defaulting to Supporting when the model omits it"
    - "importance flows through the mapped research claims and lands on the writer-bound (sourced) claim_checks rows via the existing claimId linkage"
    - "Unsourced (deterministic regex catch-all) rows and any row with no researcher-emitted importance default to Supporting — never silently Load-bearing (D-03), never blank"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py"
      provides: "ClaimOutput.importance field + importance in the mapped_claims dict"
      contains: "importance"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py"
      provides: "importance carried onto sourced rows (via research_claims lookup) and defaulted on unsourced rows"
      contains: "importance"
  key_links:
    - from: "agents/researcher.py mapped_claims"
      to: "agents/publisher/__init__.py sourced_rows"
      via: "research_claims[claimId] lookup carrying importance"
      pattern: "research_claims"
    - from: "agents/publisher/__init__.py claim_rows"
      to: "claimChecks:insertBatch"
      via: "insertBatch claims[] payload now including importance"
      pattern: "claimChecks:insertBatch"
---

<objective>
Make the Researcher emit `importance` per claim (FCT-01) and thread it through the publisher's claim-merge so every claim_checks row lands with a defined importance tier — the single net-new backend concept of this phase.

Purpose: `mustFix = importance === 'Load-bearing' && !sourceUrl` (D-05) is the spine of the whole Fact Check summary; without importance on the rows, the summary/severity/My-Tasks math is undefined. Generation-time emission (D-02) is cheaper than a post-hoc judge and matches the existing `claims: list[ClaimOutput]` structured-output pattern exactly.
Output: ClaimOutput.importance; importance in mapped_claims; importance carried onto sourced rows via the claimId lookup and defaulted on unsourced rows.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/42-fact-check-stage/42-CONTEXT.md
@.planning/phases/42-fact-check-stage/42-RESEARCH.md

<interfaces>
<!-- Verified from the current repo tree. -->

agents/researcher.py:
  class ClaimOutput(BaseModel):   # line ~47
      text: str = ""
      sourceIndex: int | None = None
  mapped_claims append (~lines 238-243) TODAY builds:
      {"claimId": f"{run_id[:8]}-{i}", "text": ..., "sourceUrl": source_url, "retrievedAt": retrieved_at}
  research_dict["claims"] = mapped_claims

agents/publisher/__init__.py:
  research_claims = { c["claimId"]: c for c in research_dict["claims"] if c.get("claimId") }   # ~line 107
  sourced_rows built from section["claimSpans"]; rc = research_claims.get(claim_id)   # ~line 133
      row = {"text": as_written, "claimType": "sourced", "context": as_written[:120], "claimId": claim_id, "sectionName": galley_id}
      # sourceUrl/retrievedAt conditionally added from rc (omit-when-None)   # ~lines 148-153
  unsourced_rows: for row in extract_claims_by_block(sections): unsourced_rows.append(row)   # ~lines 161-166
  claim_rows = [{**row, "claimIndex": idx} ...]; convex_mutation_safe("claimChecks:insertBatch", {..., "claims": claim_rows})
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add importance to Researcher ClaimOutput + mapped_claims</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py, packages/pipeline/tests/test_researcher_importance.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py (ClaimOutput at ~line 47; the mapped_claims loop at ~lines 229-244; check the existing `from typing import` line for whether Literal is imported)
    - .planning/phases/42-fact-check-stage/42-RESEARCH.md (§42.2 skeleton + Data Model Deltas table lines 483-484 for the exact field/default)
    - packages/pipeline/tests/test_claims_extractor.py (a nearby pipeline unit-test file to mirror for style/imports)
  </read_first>
  <behavior>
    - A ClaimOutput parsed from model JSON with `importance: "Load-bearing"` retains it; a ClaimOutput with no importance key defaults to 'Supporting'.
    - After the researcher's claim-mapping, each entry in research_dict["claims"] has an `importance` key with one of the three literal values.
    - A claim whose LLM output omits importance produces a mapped claim with `importance == 'Supporting'`.
  </behavior>
  <action>
In agents/researcher.py:
1. Ensure `Literal` is imported from `typing` (add to the existing typing import if missing).
2. Add to `class ClaimOutput(BaseModel)`:
   `importance: Literal['Load-bearing', 'Supporting', 'Incidental'] = 'Supporting'`
3. In the mapped_claims construction loop (~lines 231-243), add to the appended dict:
   `"importance": claim_dict.get("importance", "Supporting"),`
   Place it alongside the existing claimId/text/sourceUrl/retrievedAt keys.

Write packages/pipeline/tests/test_researcher_importance.py asserting the <behavior> list: parse a ClaimOutput with and without importance; and unit-test the mapped-claims dict-construction path (call the mapping helper or reconstruct the small loop) to assert every mapped claim carries importance and the default is 'Supporting'. Do NOT hit the network — construct raw_claims dicts directly and assert the mapping, mirroring how test_claims_extractor.py tests pure logic.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_researcher_importance.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "importance: Literal\['Load-bearing', 'Supporting', 'Incidental'\] = 'Supporting'" packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` matches
    - `grep -n '"importance": claim_dict.get("importance", "Supporting")' packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` matches
    - `cd packages/pipeline && uv run pytest tests/test_researcher_importance.py -x -q` exits 0
  </acceptance_criteria>
  <done>ClaimOutput carries importance (default Supporting); every mapped research claim carries an importance tier.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Carry importance through the publisher claim-merge onto sourced + unsourced rows</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py, packages/pipeline/tests/test_publisher_importance.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py (research_claims map ~line 107; sourced_rows construction ~lines 117-157; unsourced_rows loop ~lines 161-166; claim_rows + insertBatch ~lines 195-206)
    - packages/pipeline/src/eisenbalm_pipeline/lib/claims.py (extract_claims_by_block — the unsourced-row shape, to confirm it has no importance key today)
    - .planning/phases/42-fact-check-stage/42-RESEARCH.md (Data Model Deltas lines 485-486: exact sourced/unsourced importance edits, and Open Question 2 on soft-delete — informational)
  </read_first>
  <behavior>
    - A sourced row whose claimId resolves in research_claims copies that claim's importance onto the row.
    - A sourced row whose research_claims lookup returns None (rc is None) defaults importance to 'Supporting'.
    - Every unsourced (extract_claims_by_block) row gets importance 'Supporting' before it is appended.
    - The final claim_rows passed to claimChecks:insertBatch each carry an importance key.
  </behavior>
  <action>
In agents/publisher/__init__.py:
1. In the sourced_rows construction, right after `rc = research_claims.get(claim_id)` (~line 133) and after the row dict is created, add:
   `row["importance"] = rc.get("importance", "Supporting") if rc else "Supporting"`
   (rc now carries importance because Task 1 added it to research_dict["claims"], which feeds research_claims.)
2. In the unsourced_rows loop (~lines 161-166), before `unsourced_rows.append(row)`, add:
   `row["importance"] = "Supporting"`   # D-03 fallback: unsourced never silently Load-bearing
3. Do NOT change insertBatch's call site beyond the fact that claim_rows now carry importance — the Convex validator (Plan 42-01) already accepts it.

Write packages/pipeline/tests/test_publisher_importance.py asserting the <behavior> list. Construct minimal fixtures: a fake `research_dict["claims"]` map with a claimId->importance entry, a fake sections dict with a claimSpans span and a body block whose text contains the asWritten phrase, and assert the resulting sourced row carries the emitted importance; assert an unmatched claimId defaults to Supporting; assert extract_claims_by_block-derived rows all become Supporting. Isolate the pure merge logic (monkeypatch/avoid the Convex + Sanity network calls, mirroring how test_content_patch_endpoints.py monkeypatches the Convex/Sanity boundary).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_publisher_importance.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n 'row\["importance"\] = rc.get("importance", "Supporting") if rc else "Supporting"' packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` matches
    - `grep -n 'row\["importance"\] = "Supporting"' packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` matches (the unsourced-row fallback)
    - `cd packages/pipeline && uv run pytest tests/test_publisher_importance.py -x -q` exits 0
    - `cd packages/pipeline && uv run pytest tests/test_claims_extractor.py -x -q` still exits 0 (no regression to the extractor)
  </acceptance_criteria>
  <done>Every claim_checks row seeded by the publisher — sourced or unsourced — carries a defined importance tier (Researcher-emitted for sourced, Supporting fallback otherwise).</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_researcher_importance.py tests/test_publisher_importance.py -x -q` green.
- No regression: `cd packages/pipeline && uv run pytest tests/test_claims_extractor.py -x -q` green.
</verification>

<success_criteria>
FCT-01 satisfied at generation time: importance is emitted by the Researcher on every claim and lands on every claim_checks row (sourced via claimId linkage, unsourced via Supporting fallback), so the downstream mustFix/severity math is total.
</success_criteria>

<output>
After completion, create `.planning/phases/42-fact-check-stage/42-02-SUMMARY.md`.
</output>
