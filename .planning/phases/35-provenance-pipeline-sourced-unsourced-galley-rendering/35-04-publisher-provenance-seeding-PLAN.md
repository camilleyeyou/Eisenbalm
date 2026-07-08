---
phase: 35-provenance-pipeline-sourced-unsourced-galley-rendering
plan: 04
type: execute
wave: 3
depends_on: [01, 02, 03]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/claims.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
  - packages/pipeline/tests/test_claims_extractor.py
  - packages/pipeline/tests/agents/test_claim_block_index_hint.py
  - packages/pipeline/tests/agents/publisher/test_publisher.py
autonomous: true
requirements: [PRV-02, PRV-04]
must_haves:
  truths:
    - "The publisher seeds ONE claim_checks row per claim occurrence, each carrying sectionName + a blockIndexHint computed against the flat BodyBlock {type,text} shape (NOT children)"
    - "Writer-bound (sourced) rows carry claimId + sourceUrl + retrievedAt resolved from state['research']['claims']; regex-catch-all (unsourced) rows carry no claimId"
    - "A regex-extracted span whose normalized text matches a bound claimSpan's asWritten in the SAME block is excluded (counted as sourced, not double-listed as unsourced)"
    - "extract runs per-section, per-block (not globally joined) so every row owns a resolvable anchor for the galley + rail jump links"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/claims.py"
      provides: "per-section/per-block extraction + corrected flat-shape blockIndexHint"
      contains: "block.get(\"text\""
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py"
      provides: "sourced+unsourced claim_checks seeding with additive fields"
      contains: "claimId"
  key_links:
    - from: "state[section]['claimSpans'] + state['research']['claims']"
      to: "claim_checks sourced rows"
      via: "asWritten→blockIndexHint + claimId→sourceUrl mapping in publisher"
      pattern: "sourceUrl"
    - from: "lib/claims per-block extractor"
      to: "claim_checks unsourced rows"
      via: "regex catch-all minus bound-span exclusion, one row per occurrence"
      pattern: "sectionName"
---

<objective>
Seed the upgraded `claim_checks` table at publish time (PRV-02 data + PRV-04 data). For each prose section, resolve writer `claimSpans` into sourced rows (claimId + sourceUrl + retrievedAt + sectionName + blockIndexHint) and run the deterministic regex catch-all per-block for everything else as unsourced rows (D-04). Fix the verified `_block_index_hint` bug (it reads `children[].text`, but at publish time the body is flat `{type,text}` — Research Pitfall 1). Restructure extraction from globally-joined to per-section/per-block so every row owns a jump anchor (Research Pitfall 4).

Purpose: one canonical claim store where every occurrence is independently resolvable and honestly labeled sourced/unsourced.
Output: per-block extractor + corrected blockIndexHint helper + upgraded publisher seeding.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-CONTEXT.md
@.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- claim_checks additive fields (Plan 01): claimId, sourceUrl, retrievedAt, sectionName, blockIndexHint (all optional) -->
<!-- insertBatch (Plan 01) claims[] object now accepts those five optional fields. -->

<!-- At publish time, state[section]["body"] is RAW flat BodyBlock dicts: [{"type":"paragraph","text":"..."}, ...] -->
<!-- Pitfall 1: qa/__init__._block_index_hint reads block.get("children")[].text — WRONG for this shape. Read block.get("text","") directly. -->

<!-- state[section]["claimSpans"] = [{"claimId": "...", "asWritten": "..."}] (Plan 03) -->
<!-- state["research"]["claims"] = [{"claimId","text","sourceUrl"|None,"retrievedAt"|None}] (Plan 02) -->

<!-- Canonical prose sections (matches publisher + lib/claims _SECTION_ORDER) -->
_SECTION_ORDER = ("origin_story", "problem_statement", "founder_bio", "case_study", "bonus")
<!-- galley sectionName vocabulary the frontend uses: originStory | problemStatement | founderBio | caseStudy | bonus -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED tests — flat-shape blockIndexHint, per-block extraction, sourced+unsourced seeding</name>
  <files>packages/pipeline/tests/agents/test_claim_block_index_hint.py, packages/pipeline/tests/test_claims_extractor.py, packages/pipeline/tests/agents/publisher/test_publisher.py</files>
  <read_first>
    - packages/pipeline/tests/test_claims_extractor.py (existing extractor tests + fixture style)
    - packages/pipeline/tests/agents/publisher/test_publisher.py (how the publisher node is invoked + convex_mutation_safe stubbing)
    - packages/pipeline/src/eisenbalm_pipeline/lib/claims.py
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py (the buggy _block_index_hint reading children — do NOT copy it)
  </read_first>
  <behavior>
    - block_index_hint(blocks=[{"type":"paragraph","text":"A $2.3M budget."},{"type":"paragraph","text":"Founded 1998."}], as_written="Founded 1998") returns 1 (reads flat "text", NOT children) — a children-shaped fixture would be the wrong test (Pitfall 1 warning).
    - The new per-block extractor over a 2-section dict yields rows each carrying sectionName + blockIndexHint = the block's own loop index; the same fact in two sections yields TWO rows (one row per occurrence, distinct anchors).
    - Publisher, given a section with claimSpans=[{"claimId":"a-0","asWritten":"$2.3M budget"}] and research claims [{"claimId":"a-0","text":"$2.3M","sourceUrl":"https://x","retrievedAt":123}], calls claimChecks:insertBatch with at least one row where claimId=="a-0", sourceUrl=="https://x", sectionName set, blockIndexHint set; and unsourced rows (no claimId) for other extracted spans; a regex span whose text equals the bound asWritten in the same block is NOT also emitted as an unsourced row.
  </behavior>
  <action>
    Create packages/pipeline/tests/agents/test_claim_block_index_hint.py (fresh — do NOT copy tests/agents/qa/test_block_index_hint.py's children-shaped fixture; use flat {type,text} dicts matching real writer model_dump() output). Extend tests/test_claims_extractor.py with the per-section/per-block, one-row-per-occurrence, sectionName/blockIndexHint assertions. Extend tests/agents/publisher/test_publisher.py to capture the claimChecks:insertBatch payload (mock convex_mutation_safe) and assert sourced vs unsourced row shapes + the bound-span exclusion. RED now.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/agents/test_claim_block_index_hint.py tests/test_claims_extractor.py -x -q; test $? -ne 0 && echo "RED-as-expected"</automated>
  </verify>
  <acceptance_criteria>
    - `test -f packages/pipeline/tests/agents/test_claim_block_index_hint.py` is true
    - `grep -n "children" packages/pipeline/tests/agents/test_claim_block_index_hint.py` returns NOTHING (fixtures use flat {type,text}, not children — Pitfall 1)
    - `grep -n "sectionName\|blockIndexHint" packages/pipeline/tests/test_claims_extractor.py` matches
    - `grep -n "insertBatch\|claimId\|sourceUrl" packages/pipeline/tests/agents/publisher/test_publisher.py` matches
    - The new/extended tests FAIL now (RED gate)
  </acceptance_criteria>
  <done>RED tests encode flat-shape blockIndexHint, per-block one-row-per-occurrence extraction, and sourced/unsourced seeding with the bound-span exclusion.</done>
</task>

<task type="auto">
  <name>Task 2: lib/claims.py — per-section/per-block extractor + corrected flat-shape blockIndexHint helper</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/claims.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/claims.py (full — _extract_and_dedup, extract_claims, _section_to_text)
    - packages/pipeline/tests/agents/test_claim_block_index_hint.py (Task 1 — the contract to satisfy)
  </read_first>
  <action>
    Add to lib/claims.py (keep the existing extract_claims / extract_all_claim_types EXPORTS unchanged for Phase 26 back-compat — this task ADDS new functions):
    1. `block_index_hint(blocks: list[dict], as_written: str) -> int | None` — iterate `blocks`, read `b.get("text", "")` DIRECTLY (flat BodyBlock shape; NEVER `b.get("children")`), return the 0-based index of the first block whose text contains `as_written` (use the same normalization spirit as _normalise for robustness: case-insensitive substring is acceptable; document the choice). Return None if no block contains it. Add a short comment referencing Research Pitfall 1 (why NOT children).
    2. `extract_claims_by_block(sections: dict) -> list[dict]` — iterate `_SECTION_ORDER`; for each section value, take its `body` list of flat blocks; for each block index `bi`, run `_extract_and_dedup(block["text"])` (dedup WITHIN the block only, per Research Open Q1 recommendation of one-row-per-occurrence across blocks/sections); emit rows `{ "sectionName": <galley section id>, "blockIndexHint": bi, "text": c["text"], "claimType": c["claimType"], "context": c["context"] }`. Map the internal section key to the galley sectionName vocabulary (origin_story→originStory, problem_statement→problemStatement, founder_bio→founderBio, case_study→caseStudy, bonus→bonus). Do NOT assign claimIndex here — the publisher assigns global ordinals when it merges sourced + unsourced.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/agents/test_claim_block_index_hint.py tests/test_claims_extractor.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "def block_index_hint" packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` matches
    - `grep -n "def extract_claims_by_block" packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` matches
    - `grep -n 'block.get("children")\|block\["children"\]' packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` shows the new helpers do NOT read children (the only children read remains inside the legacy _flatten_portable_text)
    - `grep -n "originStory\|problemStatement\|founderBio\|caseStudy" packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` shows the galley-vocabulary section mapping
    - `uv run pytest tests/agents/test_claim_block_index_hint.py tests/test_claims_extractor.py -x -q` passes (GREEN)
  </acceptance_criteria>
  <done>Per-block extractor + flat-shape blockIndexHint helper exist and pass; legacy extract_claims exports unchanged.</done>
</task>

<task type="auto">
  <name>Task 3: publisher — assemble sourced + unsourced rows and seed claim_checks with additive fields</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py L74-109 (current extract_claims + insertBatch call)
    - packages/pipeline/src/eisenbalm_pipeline/lib/claims.py (Task 2 new helpers)
    - docs/API_CONTRACTS.md §35 (row shapes) + convex/claimChecks.ts (insertBatch payload)
  </read_first>
  <action>
    Replace the claims extraction block inside the `@agent_node publisher` (the `try:` block ~L78-109) with the sourced+unsourced assembly. Keep the existing try/except best-effort wrapper (a Convex failure must never block the run landing). Inside the try:
    1. Build `sections = {"origin_story": state.get("origin_story"), "problem_statement": state.get("problem_statement"), "founder_bio": state.get("founder_bio"), "case_study": state.get("case_study"), "bonus": state.get("bonus")}` (as today).
    2. Build a claimId→source lookup from research: `research_claims = {c["claimId"]: c for c in (state.get("research") or {}).get("claims", [])}`.
    3. SOURCED rows: for each prose section, read `state[section].get("claimSpans", [])`; for each span, resolve `rc = research_claims.get(span["claimId"])`; compute `bih = block_index_hint(state[section]["body"], span["asWritten"])`; emit a row `{ "text": span["asWritten"], "claimType": "sourced", "context": span["asWritten"][:120], "claimId": span["claimId"], "sourceUrl": rc.get("sourceUrl") if rc else None, "retrievedAt": rc.get("retrievedAt") if rc else None, "sectionName": <galley id>, "blockIndexHint": bih }`. Track, per (galley sectionName, blockIndexHint), the set of normalized asWritten strings covered — used for the exclusion in step 4.
    4. UNSOURCED rows: call `extract_claims_by_block(sections)`; for each returned row, DROP it if its normalized text matches a covered sourced asWritten in the SAME (sectionName, blockIndexHint) bucket (already sourced — Research data-flow step 4); otherwise keep it as an unsourced row (no claimId/sourceUrl/retrievedAt; keep sectionName + blockIndexHint). Reuse `lib.claims._normalise` for comparison.
    5. Merge sourced + unsourced into one list; assign a global `claimIndex` ordinal (0-based, in a stable order: iterate sections in _SECTION_ORDER, sourced-then-unsourced within a block, so re-runs are deterministic). Each row must have `claimIndex`. `claimIndex` must be UNIQUE (it is the key claimChecks:setStatus uses to find the row — convex/claimChecks.ts).
    6. Call `convex_mutation_safe("claimChecks:insertBatch", {"workspace_id": WORKSPACE_ID, "runId": run_id, "claims": rows})`.
    Do NOT change the surrounding pipelineRuns:updateStatus call or any other publisher behavior.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest tests/agents/publisher/test_publisher.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "claimId\|sourceUrl\|extract_claims_by_block\|block_index_hint" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` matches (sourced + unsourced assembly present)
    - `grep -n "claimIndex" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` shows a global ordinal is assigned to every row
    - The insertBatch call still passes workspace_id + runId + claims (regression-safe shape)
    - `uv run pytest tests/agents/publisher/test_publisher.py -x -q` passes (GREEN)
  </acceptance_criteria>
  <done>Publisher seeds one claim_checks row per occurrence — sourced rows with claimId/sourceUrl/retrievedAt/sectionName/blockIndexHint, unsourced rows with sectionName/blockIndexHint only, bound spans excluded from the unsourced catch-all; publisher tests green.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/agents/test_claim_block_index_hint.py tests/test_claims_extractor.py tests/agents/publisher/test_publisher.py -x -q` passes.
- Full regression: `cd packages/pipeline && uv run pytest -x -q` stays green (legacy Phase 26 claim tests unbroken — legacy extract_claims exports untouched).
</verification>

<success_criteria>
PRV-02 (publisher half) + PRV-04 (data): claim_checks holds sourced + unsourced rows, one per occurrence, each with a resolvable section/block anchor; blockIndexHint computed against the correct flat shape.
</success_criteria>

<output>
After completion, create `.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-04-SUMMARY.md`
</output>
