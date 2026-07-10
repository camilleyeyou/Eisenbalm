---
phase: 39-registry-coverage-memory-strip
plan: 04
type: execute
wave: 2
depends_on: ["39-01"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py
  - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md
  - packages/pipeline/tests/agents/test_researcher.py
  - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts
autonomous: true
requirements: [MEM-03]
must_haves:
  truths:
    - "On any charity mention, the Researcher computes the dedupKey via the existing make_dedup_key and reads charityCorrections:listByCharityKey"
    - "Corrections text is injected into the messages passed to acomplete"
    - "A log line records the correction count + injection, verifiable via caplog (MEM-03 acceptance)"
    - "The Researcher fails open (empty corrections) when Convex is unreachable"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py"
      provides: "corrections read + injection + log line"
      contains: "make_dedup_key"
    - path: "packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md"
      provides: "{corrections} placeholder for injection"
      contains: "{corrections}"
    - path: "packages/pipeline/tests/agents/test_researcher.py"
      provides: "corrections-reach-context + log-line assertions"
      contains: "corrections"
  key_links:
    - from: "researcher.py"
      to: "charity_registry.make_dedup_key"
      via: "import + call (no reimplementation)"
      pattern: "make_dedup_key"
    - from: "researcher.py"
      to: "charityCorrections:listByCharityKey"
      via: "convex_query_safe"
      pattern: "charityCorrections:listByCharityKey"
---

<objective>
Close the memory loop (MEM-03): the Researcher re-reads a charity's append-only corrections on any future mention and injects them into its prompt, logging the read so a repeat-charity run demonstrably shows it.

Purpose: The phase goal's operative contrast — "a durable record of corrections the Researcher ACTUALLY reuses." The read MUST reuse the existing `make_dedup_key` (a 4th dedup-key implementation risks silent key drift that makes corrections invisibly never match — Pitfall 2).
Output: A corrections read+inject+log step in `researcher()`, a `{corrections}` placeholder in `researcher_user.md`, and pytest asserting the corrections reach `acomplete` and the log line fires.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/39-registry-coverage-memory-strip/39-RESEARCH.md

<interfaces>
<!-- From 39-01 (already landed): charityCorrections:listByCharityKey({ workspace_id, charityKey }) -> Doc[] (createdAt asc) -->

Existing helpers to REUSE (do not reimplement):
  eisenbalm_pipeline.lib.charity_registry.make_dedup_key(name, website) -> "{name.strip().lower()}|{domain}"
  eisenbalm_pipeline.lib.convex_client.convex_query_safe(path, args) -> Any | None  (fail-open; logs a warning on any failure)

researcher.py current structure (agents/researcher.py):
  - `charity = state.get("winning_charity") or {}`  (~L129) then a missing-charity guard raising RuntimeError.
  - `_build_messages(*, state, charity, tavily_results)` (~L90) interpolates the user template via `.replace("{charity}", ...).replace("{results_block}", ...)`.
  - `messages = _build_messages(...)` then `out_obj, usage = await acomplete(agent_id="researcher", run_id=run_id, messages=messages, ...)`.
  - module-level logger: add `import logging` + `log = logging.getLogger(__name__)` if not already present (check top of file).
  - WORKSPACE_ID: use the literal "eisenbalm" (same as scout / the coverage endpoint).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED tests — corrections reach context + log line fires</name>
  <read_first>
    - packages/pipeline/tests/agents/test_researcher.py (existing AsyncMock patching of web_search/acomplete; how messages/acomplete are asserted)
    - packages/pipeline/src/eisenbalm_pipeline/lib/charity_registry.py (make_dedup_key ~L36 — to compute the expected key in the test)
  </read_first>
  <behavior>
    - Given state["winning_charity"] = { name: "Acme Trust", website: "https://acme.org" } and convex_query_safe patched to return 2 correction rows [{text: "Founder is anonymous per 2024 filing"}, {text: "AUM figure was wrong; use $4.2M"}] for the matching dedupKey, running researcher(): (1) convex_query_safe is called with path "charityCorrections:listByCharityKey" and args {"workspace_id": "eisenbalm", "charityKey": make_dedup_key("Acme Trust","https://acme.org")}; (2) both correction texts appear in the messages passed to the mocked acomplete; (3) a log.info line matching "read 2 correction" fires (assert via caplog at INFO).
    - Given convex_query_safe returns None (Convex down), researcher() still completes and logs "none found" / 0 corrections (fail-open).
  </behavior>
  <action>
    Extend packages/pipeline/tests/agents/test_researcher.py with tests marked/named `..._corrections...` (so `-k corrections` selects them). Patch `convex_query_safe` (AsyncMock), `web_search`, and `acomplete` per the existing style; capture the `messages` kwarg passed to the acomplete mock and assert both correction texts are substrings of the serialized messages. Use the `caplog` fixture at INFO to assert the count log line. Add the fail-open (None) case. Run — RED (researcher does not read corrections yet).
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_researcher.py -k corrections -q 2>&1 | grep -Eq "fail|error|no tests ran|passed"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "charityCorrections:listByCharityKey" packages/pipeline/tests/agents/test_researcher.py` succeeds
    - `grep -q "make_dedup_key" packages/pipeline/tests/agents/test_researcher.py` succeeds (test computes the expected key via the shared helper, not a hardcoded string)
    - `grep -q "caplog" packages/pipeline/tests/agents/test_researcher.py` succeeds
    - `cd packages/pipeline && uv run pytest tests/agents/test_researcher.py -k corrections -q` currently FAILS (RED)
  </acceptance_criteria>
  <done>RED tests assert the dedupKey-computed read, prompt injection, log line, and fail-open behavior.</done>
</task>

<task type="auto">
  <name>Task 2: Researcher reads + injects corrections; add {corrections} placeholder</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py (L20-33 imports; L90-124 _build_messages; L128-171 researcher())
    - packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md (existing {charity}/{results_block} placeholders — where to add {corrections})
    - apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts (the HARDCODED VARIABLE_REGISTRY/VARIABLE_DESCRIPTIONS/VARIABLE_SAMPLES maps — `researcher_user: ['charity', 'results_block']` at ~L54; it gates the pre-save unknown-variable warning and is NOT derived from the .md file)
    - apps/dispatch-control/__tests__/variableMaps.test.ts (the coverage invariant that every registry var needs a description + sample)
  </read_first>
  <action>
    In researcher.py:
    - Add imports: `from eisenbalm_pipeline.lib.charity_registry import make_dedup_key` and `from eisenbalm_pipeline.lib.convex_client import convex_query_safe`. Ensure `import logging` + `log = logging.getLogger(__name__)` exist at module level (add if missing).
    - Inside `researcher()`, immediately AFTER the `charity = state.get("winning_charity") or {}` missing-charity guard (~L134) and BEFORE `_build_queries(charity)`:
      ```
      dedup_key = make_dedup_key(charity.get("name", ""), charity.get("website"))
      corrections = await convex_query_safe(
          "charityCorrections:listByCharityKey",
          {"workspace_id": "eisenbalm", "charityKey": dedup_key},
      ) or []
      log.info(
          "Researcher: read %d correction(s) for charity=%r (dedupKey=%r) — %s",
          len(corrections), charity.get("name"), dedup_key,
          "injected into research context" if corrections else "none found",
      )
      ```
    - Thread `corrections` into `_build_messages` (extend its signature to `corrections: list[dict] | None = None`). Build a `corrections_block` string: if corrections, join each row's `text` as a bulleted list under a header like "PRIOR EDITORIAL CORRECTIONS (account for these):"; else empty string. Interpolate via `.replace("{corrections}", corrections_block)` on the user template (mirroring the existing `{charity}`/`{results_block}` replaces).
    - Pass `corrections=corrections` at the `_build_messages(...)` call site.
    In researcher_user.md: add a `{corrections}` placeholder in a sensible location (e.g. above or below the research results block). Keep it minimal — a single `{corrections}` line/section.
    In VariableRegistry.ts (MANDATORY — plan-review Blocker 2): the registry is a hardcoded static map, NOT derived from the .md file, and it gates Prompt Lab's pre-save unknown-variable warning (PRM-02). Adding `{corrections}` to researcher_user.md WITHOUT registering it here would flag `{corrections}` as unknown and BLOCK operators from saving the researcher_user template — a regression to shipped Phase 24 behavior. So: (a) append `'corrections'` to `VARIABLE_REGISTRY['researcher_user']` (making it `['charity', 'results_block', 'corrections']`); (b) add a `VARIABLE_DESCRIPTIONS['researcher_user'].corrections` (or the equivalent map shape used in the file) entry describing it (e.g. "Prior editorial corrections logged for this charity, injected so research accounts for them"); (c) add a `VARIABLE_SAMPLES` entry for `corrections` (the coverage invariant in variableMaps.test.ts requires every registered var to have a description + sample) — use a short realistic sample bullet.
    Run the RED tests — GREEN, and confirm the dispatch-control build + variableMaps test stay green.
  </action>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_researcher.py -q</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "from eisenbalm_pipeline.lib.charity_registry import make_dedup_key" packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` succeeds
    - `grep -q "charityCorrections:listByCharityKey" packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` succeeds
    - researcher.py contains NO local re-implementation of domain-stripping/case-folding (no new `_domain_of`/`bareDomain` helper): `grep -Eq "def _domain_of|def _bare_domain|def _make_key" packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` returns NOTHING
    - `grep -q "read %d correction" packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` succeeds (the MEM-03 log line)
    - `grep -q "{corrections}" packages/pipeline/src/eisenbalm_pipeline/prompts/researcher_user.md` succeeds
    - `grep -q "corrections" apps/dispatch-control/app/(dashboard)/prompt-lab/_components/VariableRegistry.ts` succeeds (registered so PRM-02 save-gate does not flag it)
    - `cd packages/pipeline && uv run pytest tests/agents/test_researcher.py -q` passes
    - `cd packages/pipeline && uv run pytest -q` full suite passes (voice/byte-equivalence tests unaffected when corrections are empty)
    - `cd apps/dispatch-control && npx vitest run __tests__/variableMaps.test.ts __tests__/VariableRegistry.test.ts` passes (corrections var has description + sample) AND `pnpm --filter dispatch-control build` exits 0
  </acceptance_criteria>
  <done>The Researcher reads corrections via the shared make_dedup_key, injects them into the prompt, logs the count for verifiability, and fails open — MEM-03 closed.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest tests/agents/test_researcher.py -k corrections -q` green.
- `cd packages/pipeline && uv run pytest -q` full suite green (no regression when corrections empty).
- The read reuses make_dedup_key (no 4th dedup-key implementation — Pitfall 2).
- The log line is caplog-verifiable (MEM-03's "verifiable in pipeline output/logs").
</verification>

<success_criteria>
- A repeat-charity run with a correction on file demonstrably shows the Researcher reading + injecting it (log + prompt), closing the memory loop.
</success_criteria>

<output>
After completion, create `.planning/phases/39-registry-coverage-memory-strip/39-04-SUMMARY.md`.
</output>
