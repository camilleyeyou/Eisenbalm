---
phase: 42-fact-check-stage
plan: 03
type: execute
wave: 2
depends_on: ["42-01"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/content.py
  - packages/pipeline/tests/test_content_patch_endpoints.py
autonomous: true
requirements: [FCT-07]

must_haves:
  truths:
    - "A content revision that touches a claim's block returns that claim to unchecked (status='pending') and sets its changedSinceCheck marker — even when the replacement text is itself sourced (block-level touched-counter, not re-verification)"
    - "Index drift is handled conservatively: same-length body edits reset only the truly-touched blocks' claims; length-changed edits reset the whole section's claims"
    - "The reset rides the existing content-patch write boundary (content.py), so a Sanity edit made from any endpoint returns the right claims to unchecked — not console-side logic"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/content.py"
      provides: "_touched_block_indices + _reset_touched_claims helpers, called alongside _revoke_active_signoffs in patch_section and patch_bonus(specAd)"
      contains: "_reset_touched_claims"
  key_links:
    - from: "content.py patch_section / patch_bonus(specAd)"
      to: "claimChecks:markChanged (Convex, requirePipelineSecret)"
      via: "_reset_touched_claims iterating live rows for the touched section/blocks"
      pattern: "claimChecks:markChanged"
---

<objective>
Extend the existing content-patch endpoints so that editing a section's prose returns any claim anchored to a touched block back to unchecked and increments the "changed since check" counter (FCT-07), reusing the sign-off-revocation hook point (D-19). This rides content.py so the reset fires no matter which endpoint made the edit.

Purpose: FCT-07 is the honesty guarantee that a "✓ Checked" chip can never sit next to prose that changed under it. It must be a pipeline-side effect of the write boundary, not console logic, or an edit made from a future surface would silently leave stale checks.
Output: `_touched_block_indices` + `_reset_touched_claims` helpers in content.py, wired into patch_section (all 4 long-reads) and patch_bonus (specAd branch only).
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

api/content.py:
  patch_section  (~line 234) — replaces a section body array with `blocks = [b.model_dump() for b in body.blocks]` (~line 255,
      each row shaped {type, text}); pre-patch `before = draft.get("sections", {}).get(section_name, {})` (~line 259);
      after mutation calls `await _revoke_active_signoffs(convex_http, run_id=run_id, reason="section edited")` (~line 278).
      *** before-state block array is under key "blocks" ***  (get_issue_draft stores each section as {headline, blocks:[...]},
      sanity_client.py:598-600) — so before_blocks = before.get("blocks", []).  NOT "body".
  patch_bonus    (~line 494) — variant-shaped; specAd branch handles `blocks = [b.model_dump() for b in body.blocks]` (~line 529);
      pre-patch `before = draft.get("bonus", {})` (~line 520); calls `_revoke_active_signoffs(..., reason="bonus edited")` (~line 562).
      *** bonus before-state block array is under key "body" ***  — so before_blocks = before.get("body", []).
  bigBudget/jingle bonus.body is a PLAIN STRING (exempt per §35.3 D-06) — do NOT reset for those variants.

claim_checks rows carry sectionName + blockIndexHint (Phase 35 anchors) and (Plan 42-01) changedSinceCheck.
Convex: claimChecks:listByRunId (query), claimChecks:markChanged (mutation, requirePipelineSecret) [Plan 42-01].
The section galley-id vocabulary on claim_checks.sectionName: originStory, problemStatement, founderBio, caseStudy, bonus.
Both pre-patch rows (pt_to_blocks output) and new blocks (body.blocks model_dump) are {type, text} dicts — compare on the "text" key.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add _touched_block_indices + _reset_touched_claims helpers (conservative on index drift)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/content.py, packages/pipeline/tests/test_content_patch_endpoints.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py (the imports block + _revoke_active_signoffs usage; the Convex helper names used elsewhere, e.g. convex_query / convex_mutation_safe — match the exact helper names the file already imports)
    - .planning/phases/42-fact-check-stage/42-RESEARCH.md (the `_reset_touched_claims` illustrative sketch lines 371-407, and Pitfall 2 lines 278-282 index-drift algorithm)
    - convex/claimChecks.ts (listByRunId return shape; markChanged args {runId, claimIndex, pipelineSecret})
  </read_first>
  <behavior>
    - _touched_block_indices(before, after): returns None when len(before) != len(after); otherwise returns the set of indices i where before[i]["text"] != after[i]["text"].
    - _reset_touched_claims(runId, sectionName, touched): for each live claim_checks row whose sectionName matches, calls claimChecks:markChanged when touched is None (whole-section) OR the row's blockIndexHint is None (unresolved anchor => reset conservatively) OR blockIndexHint in touched. Rows in other sections are untouched.
    - A same-length edit that changes only block 2 resets only claims anchored to block 2 (and any null-anchor claims in that section), not block 0/1 claims.
    - A length-changed edit (insert/delete) resets every claim in the section regardless of blockIndexHint.
  </behavior>
  <action>
Add two module-level helpers to api/content.py (transcribe the 42-RESEARCH sketch lines 376-400, adapting the Convex helper names to whatever content.py already imports for query/mutation — likely `convex_query`/`convex_mutation_safe`):

```python
def _touched_block_indices(before_blocks: list[dict], after_blocks: list[dict]) -> set[int] | None:
    """None => 'whole section touched' (length changed => positional diffing unreliable, Pitfall 2)."""
    if len(before_blocks) != len(after_blocks):
        return None
    return {
        i for i, (b, a) in enumerate(zip(before_blocks, after_blocks))
        if (b or {}).get("text") != (a or {}).get("text")
    }

async def _reset_touched_claims(convex_http, *, run_id: str, section_name: str, touched: set[int] | None) -> None:
    rows = await <convex_query>(convex_http, "claimChecks:listByRunId", {"runId": run_id}) or []
    for row in rows:
        if row.get("sectionName") != section_name:
            continue
        bih = row.get("blockIndexHint")
        if touched is None or bih is None or bih in touched:
            await <convex_mutation_safe>("claimChecks:markChanged", {"runId": run_id, "claimIndex": row["claimIndex"]})
```

Both the pre-patch rows (pt_to_blocks output) and the new blocks (body.blocks model_dump) are `{type, text}` dicts, so the diff compares the top-level `"text"` key directly — no children-join needed for this draft shape. (If a reader finds a nested `children` shape instead, join children text; but for content.py's `{type,text}` rows the top-level `"text"` is correct.)

Add pure unit tests to packages/pipeline/tests/test_content_patch_endpoints.py (new cases `test_touched_block_indices_*` and `test_reset_touched_claims_*`) covering the <behavior> list, monkeypatching the Convex query/mutation calls to capture which claimIndexes got markChanged.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py -k "touched or reset" -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "def _touched_block_indices" packages/pipeline/src/eisenbalm_pipeline/api/content.py` matches
    - `grep -n "async def _reset_touched_claims" packages/pipeline/src/eisenbalm_pipeline/api/content.py` matches
    - `grep -n "claimChecks:markChanged" packages/pipeline/src/eisenbalm_pipeline/api/content.py` matches
    - `cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py -k "touched or reset" -x -q` exits 0
  </acceptance_criteria>
  <done>The two helpers exist and the conservative index-drift algorithm is unit-tested: same-length edits reset only touched-block claims; length-changed edits reset the whole section.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Wire _reset_touched_claims into patch_section + patch_bonus(specAd)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/content.py, packages/pipeline/tests/test_content_patch_endpoints.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py (patch_section ~line 234: `blocks` at ~255, `before = draft.get("sections",{}).get(section_name,{})` at ~259, _revoke_active_signoffs at ~278; patch_bonus ~line 494: specAd `blocks` at ~529, `before = draft.get("bonus",{})` at ~520, _revoke_active_signoffs at ~562)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (get_issue_draft lines 594-600 — confirms sections store blocks under key "blocks")
    - packages/pipeline/tests/test_content_patch_endpoints.py (the existing endpoint-integration test style — monkeypatch of Sanity/Convex — to mirror)
  </read_first>
  <behavior>
    - patch_section, after its existing _revoke_active_signoffs call, computes touched = _touched_block_indices(before.get("blocks", []), blocks) and calls _reset_touched_claims(run_id, sectionName, touched) with the section's galley-id sectionName.
    - patch_bonus's specAd branch does the same using before.get("body", []) as the pre-patch blocks and sectionName 'bonus'; the bigBudget and jingle branches do NOT call it.
    - An integration test: patch a section whose body length is unchanged but block 1's text changes => the claim anchored to block 1 gets markChanged; a claim anchored to block 0 does not.
    - An integration test: patch_bonus bigBudget variant does NOT trigger any markChanged call.
  </behavior>
  <action>
In patch_section: immediately after the existing `await _revoke_active_signoffs(convex_http, run_id=run_id, reason="section edited")` line, add:
```python
touched = _touched_block_indices(before.get("blocks", []), blocks)
await _reset_touched_claims(convex_http, run_id=run_id, section_name=section_name, touched=touched)
```
Use the SAME `before` dict the endpoint already fetched (`before = draft.get("sections", {}).get(section_name, {})`) — its block array is under key **"blocks"** (NOT "body"; a `before.get("body", [])` here would always be `[]` and force the whole-section path, failing the precise-reset test). `blocks` is the just-patched new array. `section_name` is already the galley-id path param the publisher wrote to claim_checks.sectionName.

In patch_bonus, inside the `if body.variant == "specAd":` branch ONLY, after its _revoke_active_signoffs call, add:
```python
touched = _touched_block_indices(before.get("body", []), blocks)
await _reset_touched_claims(convex_http, run_id=run_id, section_name="bonus", touched=touched)
```
Here the bonus pre-patch block array is under key **"body"** (`before = draft.get("bonus", {})`). Leave the bigBudget/jingle branches unchanged (plain-string body, exempt).

Add integration test cases to test_content_patch_endpoints.py per the <behavior> list, asserting the exact claimIndexes markChanged is called with, and asserting the bonus bigBudget path issues zero markChanged calls.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py -x -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "_reset_touched_claims(convex_http" packages/pipeline/src/eisenbalm_pipeline/api/content.py` shows a call inside patch_section and inside the specAd branch of patch_bonus (2 call sites)
    - patch_section's touched computation reads `before.get("blocks"` and patch_bonus specAd reads `before.get("body"` (grep both — the keys are NOT interchangeable)
    - The bigBudget/jingle branches of patch_bonus contain NO `_reset_touched_claims` call (verify by reading the branch)
    - `cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py -x -q` exits 0 (all pre-existing cases still green)
  </acceptance_criteria>
  <done>Editing any of the four long-read sections (before-key "blocks") or the specAd bonus (before-key "body") resets the touched-block claims to unchecked + sets the changed marker, alongside the existing sign-off revocation; string-body bonus variants are correctly exempt.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/test_content_patch_endpoints.py -x -q` fully green.
- Reset fires from content.py (the write boundary), so a later phase's evidence/apply endpoint (Plan 42-04) reuses this same helper rather than reimplementing.
</verification>

<success_criteria>
FCT-07 satisfied: a revision touching a claim's block returns that claim to unchecked and increments changedCount even when the replacement text is itself sourced; index drift is handled conservatively (over-reset, never under-reset); the correct before-state keys ("blocks" for sections, "body" for bonus) make the precise-touched-block reset actually work.
</success_criteria>

<output>
After completion, create `.planning/phases/42-fact-check-stage/42-03-SUMMARY.md`.
</output>
