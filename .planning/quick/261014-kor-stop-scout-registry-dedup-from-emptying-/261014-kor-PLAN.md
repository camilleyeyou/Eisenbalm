---
phase: quick-261014-kor
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
  - packages/pipeline/tests/agents/test_scout_dedup_domains.py
  - packages/pipeline/tests/agents/test_editor.py
autonomous: true
requirements: [QUICK-261014-kor]

must_haves:
  truths:
    - "A registry row whose domain part is an aggregator (guidestar.org) no longer dedups candidates whose website is a guidestar.org profile URL"
    - "A registry row whose domain part is '.' (or empty / dotless) contributes no domain key"
    - "A candidate whose own domain matches a registry domain (ripmedicaldebt.org) is still deduped"
    - "A candidate whose name matches a registry name is still deduped"
    - "Pipeline logs show which key removed each deduped candidate, a WARNING when dedup removes all, and verify_candidates input/survivor/killed counts"
    - "The editor_gate_1 empty-candidates interrupt keeps reason 'all-candidates-killed' and payload shape but its prompt names both Scout dedup and verification"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/scout.py"
      provides: "_NON_IDENTITY_HOSTS frozenset + _is_usable_domain(); filter applied in _candidate_keys and _load_registry_keys; dedup logging"
      contains: "_is_usable_domain"
    - path: "packages/pipeline/tests/agents/test_scout_dedup_domains.py"
      provides: "Regression tests for aggregator/degenerate domain keys"
  key_links:
    - from: "scout._load_registry_keys"
      to: "scout._is_usable_domain"
      via: "domain part of dedupKey filtered before adding to key set"
      pattern: "_is_usable_domain"
    - from: "scout._candidate_keys"
      to: "scout._is_usable_domain"
      via: "candidate domain key only added if usable"
      pattern: "_is_usable_domain"
---

<objective>
Stop Scout's Python registry dedup from silently emptying the candidate list.

Diagnosis (live run 1614184a02ca4ba8a3da6cfae54f58c6): `charities:listForDedup` returns dedupKeys like
`"through evely's eyes|guidestar.org"` and `"be a dear and donate a brassiere|."`. `_load_registry_keys`
splits on "|" so the featured set contains `guidestar.org` and `.`. Two SCOUT_QUERIES target
`site:guidestar.org/profile`, so many candidates' `website` is a guidestar profile URL →
`_candidate_keys` yields `guidestar.org` → every such candidate is deduped. verify_candidates then
receives `[]` and editor_gate_1 raises a misleading "verify_candidates killed every candidate" interrupt.

Purpose: aggregator/directory/social hosts are never an org's identity, so they must never be dedup keys
on either side. Plus make the failure diagnosable in logs and make the interrupt text accurate.
Output: scout.py domain filter + logging, verify_candidates count logging, accurate interrupt prompt, regression tests.

Out of scope: NO Convex code or data changes (no Convex deploy).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@./CLAUDE.md
@packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
@packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py
@packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
@packages/pipeline/tests/agents/test_scout_discover.py

<interfaces>
scout.py (current, ~L144-200):
```python
def _domain_of(url: str) -> str:          # strips scheme, path, leading "www.", lowercases
def _candidate_keys(c: CharityCandidate) -> set[str]:   # {name.strip().lower()} | {domain if truthy}
async def _load_registry_keys(http) -> list[str]:
    rows = await convex_query(http, "charities:listForDedup", {"workspace_id": WORKSPACE_ID})
    keys = set()
    for r in rows or []:
        if r.get("dedupKey"):
            for part in r["dedupKey"].split("|"):
                if part: keys.add(part)
    return sorted(keys)        # except -> log.warning + return []
```
discover_candidates(run_id, config) -> (surviving: list[dict], featured_keys: list[str], usage)
  - featured_set = set(featured_keys) (~L300)
  - dedup loop (~L413-426):
```python
    surviving: list[dict] = []
    for cand in candidates_raw:
        c = cand if isinstance(cand, CharityCandidate) else CharityCandidate(**cand)
        keys = _candidate_keys(c)
        if keys & featured_set:
            continue
        surviving.append(c.model_dump())
```
Test pattern for discover_candidates (tests/agents/test_scout_discover.py): patch
`eisenbalm_pipeline.agents.scout.web_search` (AsyncMock([])), `.acomplete`
(AsyncMock((ScoutBatchOutput(candidates=[...]), usage))), `._load_registry_keys`
(AsyncMock(featured_list)), `.get_convex_http` (return_value=object()). `_make_candidate(name, website)`
helper builds CharityCandidate with location/assetRange/focusArea/missionStatement/scoutSummary/whyOverlooked.
For `_load_registry_keys` direct tests, patch `eisenbalm_pipeline.agents.scout.convex_query` with
AsyncMock(return_value=[{"dedupKey": ...}, ...]) and pass any object as `http`.

verify_candidates.py `verify_candidates(state) -> {"candidates": survivors, "verification_records": records}`
(L239); has module `log`; loop logs "killed candidate" at INFO.

editor.py editor_gate_1 empty-candidates branch (~L378-398) interrupt payload:
```python
interrupt({"prompt": ("verify_candidates killed every candidate — supply a "
                      "charity to proceed or restart."),
           "reason": "all-candidates-killed", "candidates": []})
```
Existing test refs: tests/agents/test_editor.py L459-526, L641 (assert on reason / editor_decision,
grep for any assertion on the old prompt text). Also transcript text (~L441) and editor_decision_text
(~L447) say "verify_candidates killed every candidate" — reword to the accurate phrasing too
("No candidates survived Scout dedup and verification"), but keep the substring
"all-candidates-killed" in editor_decision_text (test L526 asserts it OR "Degraded").
apps/web / dispatch-control depend only on `reason` + `candidates` keys — do not change them.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Aggregator/degenerate-domain filter in Scout dedup + diagnostic logging</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/scout.py, packages/pipeline/tests/agents/test_scout_dedup_domains.py</files>
  <behavior>
    New file tests/agents/test_scout_dedup_domains.py (follow test_scout_discover.py patch style; async tests run under the repo's pytest-asyncio config like existing ones):
    - _is_usable_domain: "ripmedicaldebt.org" -> True; "foo.example" -> True; "." -> False; "" -> False; "localhost" -> False; ".org" -> False; "foo." -> False; "guidestar.org" -> False; "charitynavigator.org" -> False; "sites.google.com" -> False; "m.facebook.com" (subdomain of listed host) -> False; "en.wikipedia.org" -> False; "notguidestar.org" -> True (suffix match must be on a dot boundary).
    - _candidate_keys(candidate with website "https://www.guidestar.org/profile/12-3456789") == {name_lower} only (no domain key).
    - _load_registry_keys with convex_query mocked to return dedupKeys ["rip medical debt|ripmedicaldebt.org", "through evely's eyes|guidestar.org", "be a dear and donate a brassiere|."] returns a list containing "rip medical debt", "ripmedicaldebt.org", "through evely's eyes", "be a dear and donate a brassiere" and NOT containing "guidestar.org" or ".".
    - discover_candidates with registry keys ["x", "guidestar.org", "y", "."] (i.e. the raw, unfiltered set a mock returns — proves the candidate-side filter alone protects) and candidates [A with guidestar profile URL, B with "https://bfoo.example"] → both survive.
    - discover_candidates with registry keys ["rip medical debt", "ripmedicaldebt.org", "some featured org"] and candidates [ "Different Name" @ "https://www.ripmedicaldebt.org/about" (own-domain match), "Some Featured Org" @ "https://www.guidestar.org/profile/1" (name match), "Fresh Org" @ "https://fresh.example" ] → only "Fresh Org" survives.
    - discover_candidates where dedup removes every candidate emits a WARNING log record (use caplog, logger "eisenbalm_pipeline.agents.scout") mentioning the candidate names; per-removed-candidate INFO record includes the matched key.
  </behavior>
  <action>
    Write the tests first (RED), then implement in scout.py under the "Dedup helpers (AGT-04)" section:

    1. Add module-level `_NON_IDENTITY_HOSTS: frozenset[str]` containing at least: guidestar.org, charitynavigator.org, candid.org, causeiq.com, projects.propublica.org, propublica.org, give.org, greatnonprofits.org, idealist.org, gofundme.com, facebook.com, instagram.com, linkedin.com, x.com, twitter.com, youtube.com, linktr.ee, google.com, sites.google.com, wikipedia.org, en.wikipedia.org, reddit.com, medium.com. Comment: these are directory/aggregator/social hosts that are never an organisation's own identity; Scout's own SCOUT_QUERIES target guidestar profiles, so using these as dedup keys collapses unrelated charities into one key (live run 1614184a…, 2026-10-14).

    2. Add `def _is_usable_domain(domain: str) -> bool`: strip + lowercase; return False if empty; split on "."; require len(labels) >= 2 and every label non-empty (rejects ".", ".org", "foo.", "localhost", "a..b"); return False if domain is in `_NON_IDENTITY_HOSTS` or ends with "." + any host in the set (dot-boundary subdomain match — "notguidestar.org" stays usable); else True.

    3. `_candidate_keys`: only add the domain if `_is_usable_domain(d)`. Name key unchanged. Update docstring.

    4. `_load_registry_keys`: split dedupKey with `name, _, domain = key.partition("|")`; add `name.strip()` if non-empty (names unchanged — registry stores them lowercased already; do not alter casing logic beyond current behaviour); add the domain part only if `_is_usable_domain(domain)` (add it lowercased/stripped). Rows with no "|" keep current behaviour (whole string treated as a name key). Update docstring noting aggregator/degenerate domains are dropped. Keep the existing except → [] fallback.

    5. In discover_candidates' dedup loop: compute `matched = keys & featured_set`; if matched, append `(c.name, sorted(matched))` to a `removed` list and `log.info("Scout dedup: removed candidate=%r matched_keys=%s (run %s)", c.name, sorted(matched), run_id)`; continue. After the loop, if `removed and not surviving`: `log.warning("Scout dedup removed ALL %d candidates (run %s): %s", len(removed), run_id, removed)`. Return signature/values unchanged.

    Do not modify Convex code or `make_dedup_key` in lib/charity_registry.py.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest -q tests/agents/test_scout_dedup_domains.py tests/agents/test_scout.py tests/agents/test_scout_discover.py tests/test_scout_registry.py</automated>
  </verify>
  <done>New tests pass; existing scout tests (test_domain_of, test_candidate_keys, test_dedup, discover tests) still pass; guidestar/"." registry keys no longer remove candidates while own-domain and name matches still do.</done>
</task>

<task type="auto">
  <name>Task 2: verify_candidates count logging + accurate empty-candidates interrupt text, full suite, commit + push</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py, packages/pipeline/src/eisenbalm_pipeline/agents/editor.py, packages/pipeline/tests/agents/test_editor.py</files>
  <action>
    1. verify_candidates.py `verify_candidates()`: right after reading `candidates`, `log.info("verify_candidates: start run=%s input_candidates=%d", run_id, len(candidates))`. Before the return, `log.info("verify_candidates: done run=%s survivors=%d killed=%d", run_id, len(survivors), len(candidates) - len(survivors))`. No behaviour change.

    2. editor.py editor_gate_1 empty-candidates branch: keep `"reason": "all-candidates-killed"` and `"candidates": []` exactly. Change prompt to: "No candidates survived Scout dedup and verification — supply a charity to proceed or restart." Update the adjacent comment to say candidates can be emptied by Scout dedup OR verify_candidates. Reword transcript (~L441) to "No candidates survived Scout dedup and verification this run. A human supplied a charity directly to recover the run." and editor_decision_text (~L447) to "Degraded recovery path (D-14): no candidates survived Scout dedup and verification, so no deterministic ranking or LLM call was made. A human supplied a charity directly via the all-candidates-killed interrupt." (keeps the "all-candidates-killed" and "Degraded" substrings).

    3. `grep -rn "verify_candidates killed" packages/pipeline/tests apps` — update any test asserting the old prompt/transcript text to the new strings (test_editor.py around L459-526 and L641). Do not change reason/payload assertions.

    4. Run full suite: `cd packages/pipeline && uv run pytest -q`. Baseline was 802 passed, 38 skipped; expect ≥ that many passed plus the new tests, 0 failures.

    5. ONLY if the full suite passes: stage exactly the changed files by explicit path (the 5 files in files_modified plus this quick task's PLAN/SUMMARY and STATE.md if updated). NEVER `git add -A`/`git add .` — the working tree has unrelated uncommitted changes (.planning/config.json, apps/web test, docx, many untracked planning files) that must not be staged. Commit `fix(pipeline): ignore aggregator/degenerate domains in Scout registry dedup (quick-261014-kor)` with the Co-Authored-By trailer, then `git push origin master` (deploys pipeline to Railway). If the suite fails, do not commit/push — report the failure.

    SUMMARY must note: registry row "through evely's eyes" still stores domain guidestar.org and "be a dear and donate a brassiere" stores "." in Convex — now harmless (filtered at load), could be cleaned later via a Convex data fix; no Convex code/data was touched.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/packages/pipeline && uv run pytest -q</automated>
  </verify>
  <done>Full suite green (0 failures); interrupt reason/payload unchanged with accurate prompt; verify_candidates logs start/end counts; only task files committed; pushed to origin/master.</done>
</task>

</tasks>

<verification>
- `cd packages/pipeline && uv run pytest -q` → 0 failures (baseline 802 passed / 38 skipped, plus new tests).
- `grep -n "_is_usable_domain" packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` shows use in both `_candidate_keys` and `_load_registry_keys`.
- `grep -rn "verify_candidates killed every" packages/pipeline/src` → no matches.
- `git show --stat HEAD` lists only the intended files; `git status` still shows the pre-existing unrelated changes unstaged.
</verification>

<success_criteria>
- Guidestar-profile candidates are no longer wiped by the "through evely's eyes|guidestar.org" registry row; "." key ignored.
- Real own-domain and name dedup preserved.
- Logs make dedup removals and verify counts visible; all-removed case is a WARNING.
- Interrupt contract (reason + payload keys) unchanged; text accurate.
- Change committed and pushed to master.
</success_criteria>

<output>
After completion, create `.planning/quick/261014-kor-stop-scout-registry-dedup-from-emptying-/261014-kor-SUMMARY.md`
</output>
