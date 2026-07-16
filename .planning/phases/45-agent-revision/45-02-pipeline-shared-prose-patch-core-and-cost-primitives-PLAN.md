---
phase: 45-agent-revision
plan: 02
type: execute
wave: 2
depends_on: ["45-01"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/api/content.py
  - packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/budget.py
  - packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py
  - packages/pipeline/tests/test_budget.py
autonomous: true
requirements: [REV-04, REV-05]
must_haves:
  truths:
    - "One shared apply path exists: factcheck's claim path and (in 45-03) the passage path both mutate prose through content.py::_patch_prose_span — not two implementations (D-01)"
    - "The FCT-06 endpoint suite stays green after the extraction (zero regression)"
    - "would_exceed_run_cap sums durable agentRuns:byRunId costUsd and returns 409-shaped info; it never reads lib.cost._store"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/api/content.py"
      provides: "_patch_prose_span (claim-agnostic core) + _section_blocks (relocated from factcheck)"
      contains: "async def _patch_prose_span"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/budget.py"
      provides: "would_exceed_run_cap per-issue guard predicate"
      contains: "async def would_exceed_run_cap"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py"
      provides: "'revision' agent registered in MODEL_BY_AGENT/SAMPLING_BY_AGENT"
      contains: "revision"
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py::_patch_claim_prose"
      to: "content.py::_patch_prose_span"
      via: "thin wrapper unpacking claim dict → _patch_prose_span"
      pattern: "_patch_prose_span"
    - from: "packages/pipeline/src/eisenbalm_pipeline/lib/budget.py::would_exceed_run_cap"
      to: "agentRuns:byRunId"
      via: "convex_query sum of costUsd"
      pattern: "agentRuns:byRunId"
---

<objective>
Extract the claim-agnostic prose-patch core out of `factcheck.py::_patch_claim_prose` into
`content.py::_patch_prose_span` and relocate `_claim_section_blocks`→`content.py::_section_blocks`,
so the passage-revision endpoint (45-03) and the existing claim endpoints share ONE apply path
(D-01/D-20). Add the per-issue cost-guard predicate `budget.py::would_exceed_run_cap` (sums durable
`agent_runs`, never the in-memory `_store`) and register a `"revision"` agent id in `llm_config.py`.

Purpose: this is the load-bearing "reuse, do not rebuild" move — 45-03 becomes pure composition
once these primitives exist. The extraction MUST NOT regress the FCT-06 claim endpoints.
Output: `_patch_prose_span` + `_section_blocks` in content.py; `_patch_claim_prose` a thin wrapper;
`would_exceed_run_cap` in budget.py; `"revision"` in llm_config.py.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/45-agent-revision/45-RESEARCH.md
@docs/API_CONTRACTS.md

<interfaces>
<!-- Current factcheck.py helpers to generalize (read the file). -->
factcheck.py:147 def _claim_section_blocks(draft, section_name) -> (list[dict], str)   # RELOCATE → content.py::_section_blocks
factcheck.py:181 async def _patch_claim_prose(convex_http, sanity_http, *, sanity_id, run_id, claim, new_text, if_revision_id) -> str  # BECOMES wrapper
factcheck.py:71  _LONG_READ_SECTIONS = {"originStory","problemStatement","founderBio","caseStudy"}   # RELOCATE → content.py

<!-- content.py helpers _patch_prose_span composes (already in content.py / its imports). -->
resolve_span(blocks, quoted_text, block_index_hint) -> match|None   # lib/span_resolver.py
get_issue_draft(sanity_http, sanity_id) -> draft                     # lib/sanity_client.py
patch_issue_field(sanity_http, *, issue_id, field_path, value, if_revision_id) -> new_rev
compose_section_body(blocks) -> portable text                       # lib/portable_text.py
content.py:160 _touched_block_indices(before, after) -> set|None
content.py:180 async def _reset_touched_claims(convex_http, *, run_id, section_name, touched)

<!-- budget.py primitives to reuse verbatim. -->
budget.py:35 trailing_average(list[float]) -> float|None
budget.py:51 async def would_exceed_monthly_cap(http, *, monthly_cap_usd) -> (bool, dict)   # mirror shape

<!-- agent_runs cost source (durable) — convex/agentRuns.ts:224 byRunId(runId) -> rows[{costUsd}]. -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Extract _patch_prose_span + _section_blocks into content.py; make _patch_claim_prose a wrapper</name>
  <requirements>REV-04</requirements>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py:71-236 — `_LONG_READ_SECTIONS`, `_claim_section_blocks`, `_patch_claim_prose` (the exact code to generalize/relocate).
    - packages/pipeline/src/eisenbalm_pipeline/api/content.py:157-227 — `_touched_block_indices`/`_reset_touched_claims` (the neighbours the extracted core sits beside) + the module's existing imports of `resolve_span`/`get_issue_draft`/`patch_issue_field`/`compose_section_body`.
    - docs/API_CONTRACTS.md §45.4 — the reset-touched-FIRST ordering the core must preserve.
  </read_first>
  <files>packages/pipeline/src/eisenbalm_pipeline/api/content.py, packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py</files>
  <action>
In `content.py`, add (next to `_reset_touched_claims`):
- `_LONG_READ_SECTIONS = frozenset({"originStory","problemStatement","founderBio","caseStudy"})` (moved from factcheck.py).
- `def _section_blocks(draft: dict, section_name: str) -> tuple[list[dict], str]:` — the VERBATIM body of factcheck's `_claim_section_blocks` (it is already section-name-generic: long-read → `(blocks, f"{section_name}.body")`; `"bonus"` specAd → `(body, "bonus.body")`; else 409 `claim_edit_unavailable`). Keep the 409 reason string `claim_edit_unavailable` unchanged (the client already branches on it).
- `async def _patch_prose_span(convex_http, sanity_http, *, sanity_id: str, run_id: str, section_name: str, quoted_text: str, block_index_hint: Optional[int], new_text: str, if_revision_id: str) -> str:` — the VERBATIM core of `_patch_claim_prose` but parameterized on `(section_name, quoted_text, block_index_hint)` instead of a `claim: dict`: `get_issue_draft` → `_section_blocks(draft, section_name)` → `resolve_span(blocks, quoted_text, block_index_hint)` (raise 409 `span_not_resolved` on None) → build `before_blocks`, splice `new_text` into `blocks[match.block_index]` at `[match.start:match.end]` → `patch_issue_field(... value=compose_section_body(blocks), if_revision_id=...)` → `_touched_block_indices` → `_reset_touched_claims` (reset FIRST; caller sets any terminal status LAST). Return the new revision id.

In `factcheck.py`:
- Remove the local `_LONG_READ_SECTIONS` and `_claim_section_blocks` definitions; import `_section_blocks` (and, if any other module referenced `_claim_section_blocks`, re-export or update the import — grep first).
- Replace `_patch_claim_prose`'s body with a thin wrapper (keep its EXACT existing signature so `patch_claim`/`apply_claim_evidence` callers are untouched):
  `return await _patch_prose_span(convex_http, sanity_http, sanity_id=sanity_id, run_id=run_id, section_name=claim.get("sectionName") or "", quoted_text=claim.get("text",""), block_index_hint=claim.get("blockIndexHint"), new_text=new_text, if_revision_id=if_revision_id)`.
- Update factcheck's imports from `content` to include `_patch_prose_span` and `_section_blocks`.
Do NOT change any endpoint behaviour, reason strings, or the reset-first/terminal-last ordering.
  </action>
  <verify>
    <automated>cd packages/pipeline && python -m pytest tests/test_factcheck_endpoints.py -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "async def _patch_prose_span" packages/pipeline/src/eisenbalm_pipeline/api/content.py` and `grep -q "def _section_blocks" packages/pipeline/src/eisenbalm_pipeline/api/content.py`.
    - `factcheck.py` no longer DEFINES `_claim_section_blocks` (`grep -c "def _claim_section_blocks" packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py` returns 0) and imports `_patch_prose_span` from `content`.
    - `factcheck.py::_patch_claim_prose` body calls `_patch_prose_span` (`grep -q "_patch_prose_span" packages/pipeline/src/eisenbalm_pipeline/api/factcheck.py`).
    - `cd packages/pipeline && python -m pytest tests/test_factcheck_endpoints.py -x` exits 0 (zero regression).
  </acceptance_criteria>
  <done>The prose-patch core lives once in content.py; factcheck's claim path is a thin wrapper over it; the FCT-06 suite is green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: would_exceed_run_cap predicate + 'revision' agent registration</name>
  <requirements>REV-05</requirements>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/budget.py (full) — `trailing_average` + `would_exceed_monthly_cap` shape to mirror; reuse `_cc.convex_query`.
    - packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py:22-75 — `MODEL_BY_AGENT`, `SAMPLING_BY_AGENT`, and any per-agent max-tokens dict; mirror the `"qa"` entries.
    - packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py `_build_chat_model` (~line 77) — it KeyErrors on an unregistered agent_id (RESEARCH Pitfall 6), which is why the registration is required.
    - packages/pipeline/tests/test_budget.py — the Wave-0 stub whose `run_cap` tests this task turns green.
  </read_first>
  <behavior>
    - would_exceed_run_cap(http, run_id='r', per_run_cap_usd=0) → (False, {reason:'cap_disabled', spentUsd:0.0})
    - agent_runs rows summing to 9.90, projected 0.20, cap 10.0 → (True, {spentUsd:9.90, projectedUsd:0.20, capUsd:10.0})
    - agent_runs rows summing to 2.00, projected 0.05, cap 10.0 → (False, ...)
    - It reads agentRuns:byRunId (convex_query), NEVER lib.cost._store
  </behavior>
  <files>packages/pipeline/src/eisenbalm_pipeline/lib/budget.py, packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py, packages/pipeline/tests/test_budget.py</files>
  <action>
In `budget.py` add:
```python
_DEFAULT_REVISION_COST_ESTIMATE_USD = 0.05

async def would_exceed_run_cap(http, *, run_id: str, per_run_cap_usd: float, prior_revision_costs: list[float]) -> tuple[bool, dict]:
    if per_run_cap_usd <= 0:
        return False, {"reason": "cap_disabled", "spentUsd": 0.0}
    rows = await _cc.convex_query(http, "agentRuns:byRunId", {"runId": run_id}) or []
    spent_usd = sum(float(r.get("costUsd") or 0.0) for r in rows)
    projected = trailing_average(prior_revision_costs) or _DEFAULT_REVISION_COST_ESTIMATE_USD
    over = (spent_usd + projected) > per_run_cap_usd
    return over, {"spentUsd": spent_usd, "projectedUsd": projected, "capUsd": per_run_cap_usd}
```
Keep it READ-ONLY (no cost writes), matching the module's documented constraint; sum the DURABLE
`agent_runs` rows only — never `lib.cost._store`/`_run_caps` (RESEARCH Pitfall 1).

In `llm_config.py`, add a `"revision"` key to EVERY per-agent dict keyed by agent id (grep the file
for each dict — at minimum `MODEL_BY_AGENT` and `SAMPLING_BY_AGENT`, plus any max-tokens map),
mirroring the `"qa"` values (voice-critical model pin, `{"temperature":0.3,"top_p":1.0}`) so
`acomplete(agent_id="revision", ...)` never KeyErrors (Pitfall 6).

Convert the `-k run_cap` `it`-equivalent tests in the Wave-0 `test_budget.py` into real assertions
covering every `<behavior>` case (monkeypatch `budget._cc.convex_query` to return fake
`[{"costUsd": ...}]` rows), and remove the module-level `skipif` guard now that the function exists.
  </action>
  <verify>
    <automated>cd packages/pipeline && python -m pytest tests/test_budget.py -k run_cap -x</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "async def would_exceed_run_cap" packages/pipeline/src/eisenbalm_pipeline/lib/budget.py`.
    - `budget.py` `would_exceed_run_cap` queries `agentRuns:byRunId` and contains NO reference to `_store`/`cost.` (`grep -n "_store\|lib.cost\|from eisenbalm_pipeline.lib.cost" packages/pipeline/src/eisenbalm_pipeline/lib/budget.py` returns nothing new).
    - `grep -c "\"revision\"\|'revision'" packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` >= 2 (in both MODEL_BY_AGENT and SAMPLING_BY_AGENT).
    - `cd packages/pipeline && python -m pytest tests/test_budget.py -k run_cap -x` exits 0 (guard removed, tests real).
  </acceptance_criteria>
  <done>`would_exceed_run_cap` sums durable agent_runs and returns the 409-shaped info dict; `"revision"` is a registered agent id; the `run_cap` tests are green.</done>
</task>

</tasks>

<verification>
- `pytest tests/test_factcheck_endpoints.py -x` green (extraction regression guard).
- `pytest tests/test_budget.py -k run_cap -x` green.
- Full `python -m pytest` green.
</verification>

<success_criteria>
The prose-patch apply path exists once (content.py::_patch_prose_span), the claim path delegates to
it with zero regression, the per-issue cost guard predicate reads durable agent_runs, and a
`"revision"` agent id is registered — so 45-03 is pure composition.
</success_criteria>

<output>
After completion, create `.planning/phases/45-agent-revision/45-02-SUMMARY.md`.
</output>
