---
phase: 32-native-galley-read-only-span-resolver
plan: 02
type: execute
wave: 1
depends_on: [32-01]
files_modified:
  - docs/API_CONTRACTS.md
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
  - convex/schema.ts
  - convex/qaCorrections.ts
  - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py
autonomous: true
requirements: [GLY-01, GLY-02]
must_haves:
  truths:
    - "GET /issues/{run_id}/draft returns resolvable URLs for podcast audio and bigBudget storyboards (not raw Sanity references)"
    - "New QA runs record a blockIndexHint (block ordinal) on each finding written to Convex qaCorrections"
    - "Legacy findings without a hint still validate and read (hint is optional)"
  artifacts:
    - path: "convex/schema.ts"
      provides: "qaCorrections.blockIndexHint optional field"
      contains: "blockIndexHint: v.optional(v.number())"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
      provides: "asset-URL dereference in _DRAFT_GROQ"
      contains: "asset->"
    - path: "docs/API_CONTRACTS.md"
      provides: "amended §31.7 draft-read shape + blockIndexHint QA payload note"
  key_links:
    - from: "packages/pipeline/.../agents/qa/__init__.py::qa()"
      to: "convex qaCorrections:insert"
      via: "blockIndexHint arg in the mutation payload"
      pattern: "blockIndexHint"
    - from: "_DRAFT_GROQ"
      to: "Sanity asset documents"
      via: "asset->{url} projection"
      pattern: "audioFile\\.asset->|storyboards\\[\\]"
---

<objective>
Close the two backend gaps the galley depends on, contract-first (CLAUDE.md hard rule: amend docs/API_CONTRACTS.md BEFORE the schema/endpoint code):
1. **Asset-URL dereference (GLY-01, D-05):** `_DRAFT_GROQ` currently returns raw Sanity reference objects for `podcast.audioFile` and bigBudget `bonus.storyboards[]` — the galley cannot render a `<audio>` player or storyboard `<img>` from those. Add `asset->{url}` projections mirroring the pattern already used in `apps/web/lib/sanity/queries.ts`.
2. **blockIndexHint end-to-end (GLY-02, D-11):** Add the optional `blockIndexHint` field to Convex `qaCorrections` (schema + `insert` mutation) and make the QA agent compute + record each finding's block ordinal post-hoc.

Purpose: the galley's data source (draft-read) becomes complete, and the resolver gains a disambiguating hint.
Output: contract amendment + GROQ change + Convex field + QA emission.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/32-native-galley-read-only-span-resolver/32-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
Existing asset-URL dereference precedent (apps/web/lib/sanity/queries.ts):
```groq
storyboards[] { asset->{ url } },
"audioUrl": audioFile.asset->url,
"problemPdfUrl": problemPdf.asset->url,
```

Current _DRAFT_GROQ (packages/pipeline/.../lib/sanity_client.py):
```
*[_id == $id][0]{ _rev, theme, game, bonus, bonusType, podcast,
originStory, problemStatement, founderBio, caseStudy,
"conversation": selectionDeliberation.conversation }
```

Current QA Convex write loop (agents/qa/__init__.py::qa()) writes per finding:
  { runId, agentId:'qa', sectionName, severity, axis, quotedSpan, reason, suggestedFix, accepted:False }

QA raw section bodies still live in DispatchState at qa() time:
  state['origin_story']['body'], state['problem_statement']['body'],
  state['founder_bio']['body'], state['case_study']['body'], state['bonus']['body']
  — each a list[dict] Portable Text block list (block ordinal is 1:1 with the
  draft-read `blocks` rows, because pt_to_blocks maps each block → one row).
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Amend API_CONTRACTS §31.7 + _DRAFT_GROQ for asset URLs</name>
  <files>docs/API_CONTRACTS.md, packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py</files>
  <read_first>
    - docs/API_CONTRACTS.md §31.7 (lines ~2618-2670 — the draft-read response block)
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (`_DRAFT_GROQ` ~L576 and `get_issue_draft()` ~L585-625 — the return shape)
    - apps/web/lib/sanity/queries.ts (lines ~87, ~109, ~113 — the exact `asset->{url}` / `audioFile.asset->url` / `storyboards[] { asset->{ url } }` projections to mirror)
  </read_first>
  <action>
    CONTRACT FIRST — edit docs/API_CONTRACTS.md §31.7 before touching the query. In the §31.7 JSON response block, document that:
    - `podcast` now carries a dereferenced `"audioUrl": "string"` (the resolved `audioFile.asset->url`), in ADDITION to the existing raw fields — so the galley can render an `<audio>` player without a second fetch.
    - `bonus.storyboards[]` entries now carry a dereferenced `asset->{ url }` so bigBudget storyboards resolve to `<img src>`.
    Add a one-sentence note: "These asset-URL projections mirror `apps/web/lib/sanity/queries.ts` and are additive — existing Phase 31 consumers ignore the new keys."

    Then edit `_DRAFT_GROQ` in sanity_client.py to add the projections. Change the `podcast` and `bonus` selections so the query becomes (keep every existing field, ADD the dereferences):
    ```
    *[_id == $id][0]{ _rev, theme, game, bonusType,
    "bonus": bonus{ ..., storyboards[]{ ..., asset->{ url } } },
    "podcast": podcast{ ..., "audioUrl": audioFile.asset->url },
    originStory, problemStatement, founderBio, caseStudy,
    "conversation": selectionDeliberation.conversation }
    ```
    In `get_issue_draft()`, the existing code does `raw_bonus = dict(doc.get("bonus") or {})` and re-decomposes `raw_bonus["body"]` via `pt_to_blocks` — that continues to work because `storyboards` is a sibling field left verbatim (now with `asset.url` populated). The `podcast` passthrough `doc.get("podcast") or {}` now includes the `audioUrl` key. Make no other reshaping.
  </action>
  <verify>
    <automated>cd packages/pipeline && python -c "from eisenbalm_pipeline.lib.sanity_client import _DRAFT_GROQ; assert 'audioFile.asset->url' in _DRAFT_GROQ, 'audioUrl projection missing'; assert 'storyboards[]' in _DRAFT_GROQ and 'asset->{ url }' in _DRAFT_GROQ, 'storyboard projection missing'; print('ok')"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "audioFile.asset->url" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` matches
    - `grep -n "storyboards\[\]" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` matches with an `asset->{ url }` projection
    - docs/API_CONTRACTS.md §31.7 mentions `audioUrl` and storyboard `asset->{ url }` as additive dereferenced fields
    - `cd packages/pipeline && uv run pytest tests/ -k "draft or sanity_client" -q` stays green (no existing draft-read test regresses)
  </acceptance_criteria>
  <done>Draft-read returns resolvable podcast audio + storyboard URLs; contract documents them first.</done>
</task>

<task type="auto">
  <name>Task 2: Add blockIndexHint to Convex qaCorrections (schema + insert) + document in contract</name>
  <files>convex/schema.ts, convex/qaCorrections.ts, docs/API_CONTRACTS.md</files>
  <read_first>
    - convex/schema.ts (qaCorrections table ~L70-98 — where the optional Phase-5 fields `axis`, `quotedSpan`, `suggestedFix` live; add `blockIndexHint` alongside)
    - convex/qaCorrections.ts (the `insert` mutation args + handler — note the `pipelineSecret` public-exception comment; the new arg must slot into the same `...args` spread)
    - convex/_generated/ai/guidelines.md (Convex API rules — per convex/CLAUDE.md)
  </read_first>
  <action>
    In convex/schema.ts, inside the `qaCorrections` `defineTable({...})`, add after `suggestedFix: v.optional(v.string()),`:
    ```ts
    blockIndexHint: v.optional(v.number()), // Phase 32 D-11: QA-recorded block ordinal within the section body; a resolver hint, never authoritative
    ```
    In convex/qaCorrections.ts `insert` mutation `args`, add `blockIndexHint: v.optional(v.number()),` next to `suggestedFix`. The handler already destructures `{ pipelineSecret: _pipelineSecret, ...args }` and inserts `...args` — so `blockIndexHint` flows through automatically; make NO handler-logic change beyond leaving the spread intact. Do NOT gate `insert` behind any auth/secret check (the existing public-exception comment for GAM-05 stands).

    Redeploy the schema so `convex/_generated/api.d.ts` reflects the new arg: run the repo's Convex codegen (`pnpm --filter @eisenbalm/convex exec convex dev --once` or the documented equivalent — confirm the script in convex/README.md / package.json). Commit the regenerated `convex/_generated/` if it changes.

    Document the field in docs/API_CONTRACTS.md wherever the qaCorrections payload/QA contract lives (search for `quotedSpan` / `suggestedFix` to find it): add one line — "`blockIndexHint` (optional number, Phase 32): the block ordinal within the section body where QA found `quotedSpan`; the galley span-resolver treats it as a disambiguating hint, never authoritative (stale/out-of-range hints fall through to full search)."
  </action>
  <verify>
    <automated>grep -q "blockIndexHint: v.optional(v.number())" convex/schema.ts && grep -q "blockIndexHint" convex/qaCorrections.ts && echo ok</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "blockIndexHint" convex/schema.ts` ≥ 1 and the field is `v.optional(v.number())`
    - `grep -c "blockIndexHint" convex/qaCorrections.ts` ≥ 1 (in the `insert` args)
    - docs/API_CONTRACTS.md contains a `blockIndexHint` note describing it as an optional, non-authoritative resolver hint
    - Convex typecheck/codegen runs without error (`convex/_generated/api.d.ts` regenerated)
  </acceptance_criteria>
  <done>qaCorrections carries an optional blockIndexHint; the insert mutation accepts it; contract documents it.</done>
</task>

<task type="auto">
  <name>Task 3: QA agent computes + records blockIndexHint per finding</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py (`_extract_sections`, `_body_to_text`, and the `qa()` Convex write loop — where each finding's mutation payload is assembled ~L185-199)
    - .planning/phases/32-native-galley-read-only-span-resolver/32-RESEARCH.md (§Open Questions #1 — LOCK the "compute post-hoc in qa()" option; §Pattern 2 — unique-match-only rule)
    - packages/pipeline tests directory for the QA agent (to know where to add a unit test)
  </read_first>
  <action>
    LOCK the RESEARCH-recommended approach (post-hoc computation in `qa()`, zero changes to rules.py/judge.py, keeps the LLM judge schema unchanged). Add a helper in `agents/qa/__init__.py`:
    ```python
    # Maps QA snake_case section name -> DispatchState field holding the raw
    # Portable Text block list (block ordinal is 1:1 with draft-read blocks).
    _SECTION_STATE_FIELD = {
        "origin_story": "origin_story",
        "problem": "problem_statement",
        "founder_bio": "founder_bio",
        "case_study": "case_study",
        "bonus": "bonus",
    }

    def _block_index_hint(state, section: str, quoted: str | None) -> int | None:
        """Return the ordinal of the ONLY block whose text contains `quoted`,
        else None (0 or 2+ matches -> no hint; game/None -> no hint). Mirrors
        the client resolver's unique-substring rule (D-12: never guess)."""
        if not quoted:
            return None
        field = _SECTION_STATE_FIELD.get(section)
        if field is None:
            return None
        body = (state.get(field) or {}).get("body")
        if not isinstance(body, list):
            return None
        matches = []
        for i, block in enumerate(body):
            if not isinstance(block, dict):
                continue
            text = " ".join(
                (c.get("text", "") for c in (block.get("children") or [])
                 if isinstance(c, dict))
            )
            if quoted in text:
                matches.append(i)
        return matches[0] if len(matches) == 1 else None
    ```
    In the `qa()` Convex write loop, compute the hint per finding and add it to the mutation payload ONLY when non-None (keep payloads clean for game/no-match findings):
    ```python
    hint = _block_index_hint(state, f.section, f.quotedSpan)
    payload = {
        "runId": run_id, "agentId": "qa", "sectionName": f.section,
        "severity": f.severity, "axis": f.axis, "quotedSpan": f.quotedSpan,
        "reason": f.reason, "suggestedFix": f.suggestedFix, "accepted": False,
    }
    if hint is not None:
        payload["blockIndexHint"] = hint
    await convex_mutation_safe("qaCorrections:insert", payload)
    ```
    Do NOT change rules.py, judge.py, rubric.md, or the LLM judge output schema. Do NOT change `_finding_to_qa_correction` (state-side shape is unchanged).

    Add a unit test (`test_qa_block_index_hint.py` or extend an existing QA agent test) asserting `_block_index_hint`: unique match → correct index; no match → None; 2 blocks both containing the span → None; `game` / unknown section → None; empty quotedSpan → None.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/ -k "qa and (hint or block_index)" -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "_block_index_hint" packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` shows the helper defined and called in `qa()`
    - The mutation payload adds `blockIndexHint` only when a unique match is found (grep: `payload["blockIndexHint"] = hint`)
    - New/extended pytest asserting unique→index, 0→None, 2→None, game→None, empty→None passes
    - `cd packages/pipeline && uv run pytest -q` reports no regressions vs. baseline (existing QA tests green)
  </acceptance_criteria>
  <done>QA records a unique-match block ordinal as blockIndexHint; ambiguous/absent matches record no hint (never guess).</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest -q` green.
- Convex codegen clean; `blockIndexHint` present in schema, mutation, and contract.
- `_DRAFT_GROQ` dereferences podcast audio + storyboard assets.
</verification>

<success_criteria>
Draft-read is a complete galley data source (asset URLs resolve); new QA runs emit a non-authoritative blockIndexHint; every change was contract-documented first.
</success_criteria>

<output>
After completion, create `.planning/phases/32-native-galley-read-only-span-resolver/32-02-SUMMARY.md`
</output>
