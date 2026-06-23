---
phase: 26-review-gate-charity-registry
plan: 02
type: execute
wave: 2
depends_on: [26-01]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/lib/claims.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
  - packages/pipeline/scripts/backfill_charity_registry.py
  - packages/pipeline/tests/test_claims_extractor.py
  - packages/pipeline/tests/test_scout_registry.py
autonomous: true
requirements: [RVW-05, REG-01, REG-02]
user_setup: []

must_haves:
  truths:
    - "Deterministic claims extraction surfaces every number, date, and proper-noun from the issue text at run-end"
    - "Extracted claims are written to Convex claim_checks before the run lands in awaiting-review"
    - "The Scout consults the Convex charities registry (not Sanity GROQ) and skips featured + blocklisted charities"
    - "The Scout logs its surviving candidates to the registry as status=candidate"
    - "On a Convex failure the Scout dedup falls back to an empty key list (first-run safety preserved)"
    - "A backfill script seeds the registry as featured from existing published Sanity charities (idempotent)"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/claims.py"
      provides: "extract_claims + _flatten_portable_text"
      min_lines: 40
    - path: "packages/pipeline/scripts/backfill_charity_registry.py"
      provides: "One-shot registry backfill from published Sanity charities"
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/scout.py"
      provides: "Registry-backed dedup + candidate logging"
      contains: "_load_registry_keys"
  key_links:
    - from: "publisher node"
      to: "claimChecks:insertBatch"
      via: "extract_claims at run-end before awaiting-review"
      pattern: "claimChecks:insertBatch|extract_claims"
    - from: "scout.py _load_registry_keys"
      to: "charities:listForDedup"
      via: "convex_query"
      pattern: "charities:listForDedup"
    - from: "scout.py candidate logging"
      to: "charities:upsertCandidate"
      via: "convex_mutation per surviving candidate"
      pattern: "charities:upsertCandidate"
---

<objective>
Wire the pipeline side of Phase 26: (1) deterministic factual-claims extraction at run-end stored in Convex (RVW-05), (2) re-point the Scout's dedup from a Sanity GROQ query to the Convex charities registry and log candidates (REG-02 / D-03/D-04/D-05), (3) a one-time backfill script seeding the registry from existing published charities (D-03).

Purpose: The dashboard review screen (Plan 05) needs claims ready the instant a run hits the queue; the registry must be the single dedup authority the Scout consults; existing published charities must not be re-selected.
Output: lib/claims.py, publisher extraction step, scout registry re-point, backfill script — all with green tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/26-review-gate-charity-registry/26-CONTEXT.md
@.planning/phases/26-review-gate-charity-registry/26-RESEARCH.md
@CLAUDE.md

<interfaces>
<!-- Convex functions from Plan 26-01 the pipeline calls. -->
charities:listForDedup({workspace_id}) -> [{dedupKey, name, domain, status}]  // featured + blocklisted only
charities:upsertCandidate({workspace_id, name, website, runId})               // guarded, never downgrades
charities:upsertFeatured({workspace_id, name, website, sanityCharityId})      // backfill + publish path
claimChecks:insertBatch({workspace_id, runId, claims:[{claimIndex, text, claimType, context}]})

<!-- Existing pipeline patterns to reuse (do not reinvent). -->
scout.py:_domain_of(url) -> bare domain (scheme/path/www stripped, lowercased)
scout.py:_candidate_keys(c) -> set of {name.lower(), domain}
scout.py:_load_featured_keys() -> GROQ on published weeklyIssue.charity (BEING REPLACED)
lib/convex_client.py:convex_query(http, name, args) / convex_mutation(http, name, args)
publisher/__init__.py: writes pipelineRuns:updateStatus status="awaiting-review" with sanityIssueId at run-end (lines ~44-74)
DispatchState fields: origin_story, problem_statement, founder_bio, case_study, game, bonus (each has body Portable Text + headline strings)
WORKSPACE_ID = "eisenbalm"
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create lib/claims.py — deterministic claim extraction (RVW-05 / D-06)</name>
  <behavior>
    - extract_claims(sections: dict) returns a flat ordered list of {claimIndex, text, claimType, context}
    - claimType is one of "number" | "date" | "proper_noun"
    - Numbers: $1,200 / 47% / 1,000 / 3rd all detected as "number"
    - Dates: 2019 / "March 3, 2021" / "Jan 2020" detected as "date"
    - Proper nouns: "Puppies Behind Bars" (2+ consecutive Title-Case words) detected as "proper_noun"
    - _flatten_portable_text(blocks) extracts and joins child["text"] from each block["children"]; plain strings pass through unchanged
    - Duplicate claims (case-folded, punctuation-stripped) are de-duplicated; claimIndex is the stable ordinal of first appearance
    - context is the ~60-char window surrounding the match
  </behavior>
  <read_first>
    - packages/pipeline/tests/test_claims_extractor.py (the Wave 0 RED tests from Plan 26-01 — implement to satisfy them)
    - packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py (existing Portable Text helpers — reuse block/children shape knowledge)
    - .planning/phases/26-review-gate-charity-registry/26-RESEARCH.md (Pattern 6 — regex patterns RE_NUMBER/RE_DATE/RE_PROPER_NOUN verbatim + Pitfall 4 flatten)
  </read_first>
  <action>
Create `packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` using Python stdlib `re` only (no new deps).

Copy these compiled patterns from RESEARCH Pattern 6 verbatim:
```python
RE_NUMBER = re.compile(r'\b(?:\$[\d,]+(?:\.\d+)?[BMK]?|\d[\d,]*(?:\.\d+)?%?(?:st|nd|rd|th)?)\b')
RE_DATE = re.compile(
    r'\b(?:19|20)\d{2}\b'
    r'|\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?'
    r'|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)'
    r'\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*\d{4})?\b', re.IGNORECASE)
RE_PROPER_NOUN = re.compile(r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b')
```

Functions:
- `_flatten_portable_text(blocks) -> str`: if `blocks` is a str return it; if it's a list, for each block that is a dict with `"children"`, join `child.get("text","")` for each child; join blocks with `"\n"`. Tolerate non-dict entries. (Pitfall 4.)
- `_extract_from_text(text, claim_type, regex) -> list[dict]`: iterate `regex.finditer`, build `{text: match, claimType: claim_type, context: text[max(0,start-30):end+30]}`.
- `extract_claims(sections: dict) -> list[dict]`: For each section value in a fixed order (origin_story, problem_statement, founder_bio, case_study, bonus — plus their headline strings if present), flatten to text via `_flatten_portable_text`, run all three extractors. Run DATE before NUMBER so a bare year is typed "date" not "number" (de-dup on normalized text prevents the year also being a number). Normalize each claim's text (lowercase, strip surrounding punctuation) for de-dup; keep first occurrence. Assign `claimIndex` as the 0-based ordinal of the kept claims. Return the list.

Section value shape: a section may be a dict with a `body` (Portable Text list) and string headline fields, or a plain dict — accept `dict` and pull `.get("body")` plus any string values; be defensive (skip None).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/test_claims_extractor.py -x -q 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/test_claims_extractor.py -x -q` exits 0 with the two tests PASSING (not skipped)
    - `grep -q "_flatten_portable_text" packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` succeeds
    - `grep -q "RE_PROPER_NOUN" packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` succeeds
    - `extract_claims` returns claimType values only in {"number","date","proper_noun"} (asserted by test)
    - No new dependency added: `git diff packages/pipeline/pyproject.toml` shows no change
  </acceptance_criteria>
  <done>lib/claims.py extracts numbers/dates/proper-nouns deterministically; Wave 0 claims tests pass.</done>
</task>

<task type="auto">
  <name>Task 2: Wire claims extraction into the publisher node at run-end (D-07)</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py (full file — the run-end node that writes pipelineRuns:updateStatus status="awaiting-review"; insert extraction BEFORE that status flip)
    - packages/pipeline/src/eisenbalm_pipeline/lib/claims.py (the extractor from Task 1)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (convex_mutation signature + the safe wrapper if one exists)
    - docs/API_CONTRACTS.md (Phase 26 claimChecks:insertBatch signature)
  </read_first>
  <action>
In the publisher node (Option A from RESEARCH — read from DispatchState, no Sanity round-trip): immediately BEFORE the existing `pipelineRuns:updateStatus` call that sets `status="awaiting-review"`, add a claims-extraction step.

1. Import `from eisenbalm_pipeline.lib.claims import extract_claims`.
2. Build `sections = {"origin_story": state.get("origin_story"), "problem_statement": state.get("problem_statement"), "founder_bio": state.get("founder_bio"), "case_study": state.get("case_study"), "bonus": state.get("bonus")}`.
3. `claims = extract_claims(sections)`.
4. Map to the insertBatch shape: `[{"claimIndex": c["claimIndex"], "text": c["text"], "claimType": c["claimType"], "context": c["context"]} for c in claims]`.
5. Call `convex_mutation(http, "claimChecks:insertBatch", {"workspace_id": WORKSPACE_ID, "runId": run_id, "claims": claim_rows})` wrapped in try/except that logs a warning and continues on failure (claims are best-effort; never block the run). Reuse the existing safe-mutation pattern if the file already imports one.

Do NOT change the existing status flip, sanityIssueId write, or any other publisher behavior. The extraction is purely additive and runs only on the awaiting-review (non-auto-publish) path.
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -q "claimChecks:insertBatch" src/eisenbalm_pipeline/agents/publisher/__init__.py && grep -q "extract_claims" src/eisenbalm_pipeline/agents/publisher/__init__.py && uv run pytest -x -q -k "publisher" 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "extract_claims" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` succeeds
    - `grep -q "claimChecks:insertBatch" packages/pipeline/src/eisenbalm_pipeline/agents/publisher/__init__.py` succeeds
    - The extraction call is wrapped in try/except (grep for `except` near the insertBatch call) and logs on failure
    - `cd packages/pipeline && uv run pytest -x -q -k "publisher"` exits 0 (existing publisher tests stay green)
  </acceptance_criteria>
  <done>The publisher extracts and persists claims to Convex before the run lands in awaiting-review, failure-tolerant.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Re-point Scout dedup to the Convex registry + log candidates (REG-02 / D-03/D-04/D-05)</name>
  <behavior>
    - _load_registry_keys(http) queries charities:listForDedup and returns a sorted list of dedup keys split from each row's dedupKey (name + domain parts)
    - On any Convex exception, _load_registry_keys returns [] (empty fallback — first-run safety)
    - A candidate whose _candidate_keys intersect a featured/blocklisted registry key is filtered out before Editor gate 1
    - Each surviving candidate is logged via charities:upsertCandidate (best-effort)
  </behavior>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py (full file — _domain_of, _candidate_keys, _load_featured_keys at lines 95-175, and the dedup filter + candidate write at ~267-276)
    - packages/pipeline/tests/test_scout_registry.py (Wave 0 RED tests from Plan 26-01 — implement to satisfy)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (convex_query/convex_mutation)
    - docs/API_CONTRACTS.md (charities:listForDedup + upsertCandidate signatures)
  </read_first>
  <action>
Edit scout.py per RESEARCH Pattern 5. Keep `_domain_of` and `_candidate_keys` unchanged.

1. Add `async def _load_registry_keys(http) -> list[str]:` exactly as RESEARCH Pattern 5 specifies:
   - `convex_query(http, "charities:listForDedup", {"workspace_id": WORKSPACE_ID})`
   - For each row, split `row["dedupKey"]` on `"|"`, add non-empty parts to a set.
   - Return `sorted(keys)`.
   - Wrap in try/except → on exception `log.warning(...)` and `return []`.
2. Replace the call site that used `_load_featured_keys()` with `await _load_registry_keys(http)`. Keep `_load_featured_keys` in the file ONLY if a test still references it; otherwise remove it and its GROQ. (Prefer removal — the registry is now the single dedup authority per D-03. Confirm no other module imports it via grep first.)
3. After the Python-side dedup that produces surviving candidates (~scout.py:267-276), for each surviving candidate call (best-effort, try/except per candidate):
   `await convex_mutation(http, "charities:upsertCandidate", {"workspace_id": WORKSPACE_ID, "name": c.name, "website": c.website, "runId": run_id})`.
   The upsertCandidate mutation's own guard prevents downgrading featured/blocklisted rows (Pitfall 3), so logging is safe.
4. The `http` handle: use the same Convex http the Scout already uses for pitchLog writes (the agent receives it via state/app — match the existing pitchLog write pattern in this file).
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -q "_load_registry_keys" src/eisenbalm_pipeline/agents/scout.py && grep -q "charities:listForDedup" src/eisenbalm_pipeline/agents/scout.py && grep -q "charities:upsertCandidate" src/eisenbalm_pipeline/agents/scout.py && uv run pytest tests/test_scout_registry.py tests/test_scout.py -x -q 2>&1 | tail -6</automated>
  </verify>
  <acceptance_criteria>
    - `cd packages/pipeline && uv run pytest tests/test_scout_registry.py -x -q` exits 0 with both tests PASSING (not skipped)
    - `grep -q "charities:listForDedup" packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` succeeds
    - `grep -q "charities:upsertCandidate" packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` succeeds
    - `_load_registry_keys` returns `[]` on Convex failure (asserted by test_registry_load_empty_fallback)
    - Existing scout tests still green: `cd packages/pipeline && uv run pytest tests/test_scout.py -x -q` exits 0
    - No remaining production reference to the removed GROQ dedup unless a test still needs it: `grep -rn "_load_featured_keys" packages/pipeline/src` returns 0 lines (or only the test if intentionally kept)
  </acceptance_criteria>
  <done>The Scout reads dedup keys from the Convex registry, skips featured/blocklisted, and logs candidates; scout tests green.</done>
</task>

<task type="auto">
  <name>Task 4: Backfill script — seed registry from published Sanity charities (D-03)</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py (the GROQ query at ~135-138 returning {name, slug, website} for published charities — reuse it)
    - packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py (how to build an http client + call mutations from a standalone script)
    - packages/pipeline/scripts/ (existing script conventions — uv-runnable, env loading; pick an existing script as a template)
    - docs/API_CONTRACTS.md (charities:seedFromPublished signature)
  </read_first>
  <action>
Create `packages/pipeline/scripts/backfill_charity_registry.py` — a uv-runnable one-shot. It must:
1. Load env (Sanity token, Convex deploy URL/key) the same way existing scripts do.
2. Run the published-charity GROQ (copy from scout.py):
   `*[_type == "weeklyIssue" && status == "published" && defined(charity)].charity->{ name, "slug": slug.current, website }`
3. Build `rows = [{"name": r["name"], "website": r.get("website"), "sanityCharityId": r.get("slug")} for r in result if r.get("name")]`.
4. Call `charities:seedFromPublished({"workspace_id": "eisenbalm", "rows": rows})` (idempotent upsert — safe to re-run).
5. Print a summary line: `f"Backfilled {len(rows)} charities into registry"`.
6. Add a module docstring documenting usage: `uv run python -m eisenbalm_pipeline... ` or `uv run scripts/backfill_charity_registry.py` (match the repo's script invocation convention).
Guard the main with `if __name__ == "__main__":` and an asyncio entrypoint if convex_client is async.
  </action>
  <verify>
    <automated>cd packages/pipeline && test -f scripts/backfill_charity_registry.py && grep -q "charities:seedFromPublished" scripts/backfill_charity_registry.py && uv run python -c "import ast; ast.parse(open('scripts/backfill_charity_registry.py').read()); print('PARSE_OK')"</automated>
  </verify>
  <acceptance_criteria>
    - File packages/pipeline/scripts/backfill_charity_registry.py exists and parses (`python -c "import ast; ast.parse(...)"` prints PARSE_OK)
    - `grep -q "charities:seedFromPublished" packages/pipeline/scripts/backfill_charity_registry.py` succeeds
    - `grep -q "status == \"published\"" packages/pipeline/scripts/backfill_charity_registry.py` succeeds (reuses published GROQ)
    - Module docstring documents the run command (grep for "uv run")
  </acceptance_criteria>
  <done>An idempotent backfill script seeds the registry as featured from published Sanity charities.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest -x -q` full suite green (claims + scout registry tests now passing, not skipped).
- Publisher emits claimChecks:insertBatch before awaiting-review.
- Scout reads charities:listForDedup and writes charities:upsertCandidate.
- Backfill script exists and parses.
</verification>

<success_criteria>
- Every number/date/proper-noun in issue text is extracted and stored at run-end (RVW-05 substrate).
- The Scout's only dedup authority is the Convex registry; featured/blocklisted are skipped (REG-02).
- Existing published charities can be seeded as featured (D-03).
- Full pipeline pytest suite stays green.
</success_criteria>

<output>
After completion, create `.planning/phases/26-review-gate-charity-registry/26-02-SUMMARY.md`.
</output>
