---
phase: 46-signal-editor-candidate-verification
plan: 05
type: execute
wave: 3
depends_on: ["46-01", "46-02"]
files_modified:
  - packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py
  - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
  - packages/pipeline/tests/agents/test_verify_candidates.py
  - packages/pipeline/tests/agents/test_editor.py
autonomous: true
requirements: [SGE-03]

must_haves:
  truths:
    - "verify_candidates produces one VerificationRecord per candidate (domainLive, registrationId, obscurity press scan), persisted to Convex"
    - "Only DEFINITIVE failures kill a candidate; a transient error (timeout/5xx/DNS blip) keeps the candidate as status='unverified'"
    - "A killed candidate's record carries a non-empty killReason (never silently dropped)"
    - "When verify_candidates kills EVERY candidate, editor_gate_1 reaches a recoverable needs-human state (awaiting-review) instead of raising RuntimeError"
  artifacts:
    - path: "packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py"
      provides: "deterministic non-LLM verify_candidates node"
      contains: "async def verify_candidates"
      min_lines: 60
  key_links:
    - from: "packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py"
      to: "verificationRecords:insert + filtered state['candidates']"
      via: "per-org record emission + survivor filter"
      pattern: "verificationRecords:insert"
    - from: "packages/pipeline/src/eisenbalm_pipeline/agents/editor.py"
      to: "pipelineRuns:updateStatus awaiting-review + interrupt()"
      via: "empty-candidates recovery path (D-14)"
      pattern: "awaiting-review"
---

<objective>
Build the deterministic `verify_candidates` node (runs after Scout, before Advocate) and fix `editor_gate_1`'s hard RuntimeError on empty candidates so the all-killed case is recoverable.

Purpose: SGE-03 — a per-organization verification record (domain live, registration ID, obscurity/press scan) that kills only DEFINITIVE failures while staying false-negative-safe (D-12), and D-14 — when every candidate is killed, the run degrades to needs-human rather than crashing (RESEARCH Pitfall 1: editor_gate_1 currently raises RuntimeError, directly blocking D-14).
Output: agents/verify_candidates.py, the editor.py recovery fix, and both unit tests.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/46-signal-editor-candidate-verification/46-CONTEXT.md
@.planning/phases/46-signal-editor-candidate-verification/46-RESEARCH.md
@.planning/phases/46-signal-editor-candidate-verification/46-VALIDATION.md
@packages/pipeline/src/eisenbalm_pipeline/agents/verify.py
@packages/pipeline/src/eisenbalm_pipeline/agents/editor.py
@packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py
@packages/pipeline/src/eisenbalm_pipeline/graph/state.py

<interfaces>
<!-- verify_research is the EXACT template (agents/verify.py): bare async def, NO @agent_node, httpx 10s timeout,
     follow_redirects, desktop UA, ALL exceptions collapse to a conservative not-verified value -->
async def verify_candidates(state: DispatchState) -> dict: ...   # returns {"candidates": survivors, "verification_records": records}

from slugify import slugify                                       # from agents/advocate.py
from eisenbalm_pipeline.lib.search_client import web_search       # obscurity press scan (bounded)
from eisenbalm_pipeline.lib.convex_client import convex_mutation_safe
import httpx                                                      # domain-live GET

def _charity_id_for(name: str) -> str: return f"charity-{slugify(name)}"   # SAME join key as advocate/Sanity/pitchLog

<!-- editor_gate_1 empty-candidates recovery (agents/editor.py ~L257-263) mirrors the existing interrupt path
     (~L316-374): write pipelineRuns:updateStatus 'awaiting-review' BEFORE interrupt(), accept a human charityName,
     build a minimal synthetic winning_charity when the list is genuinely empty. -->
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Implement agents/verify_candidates.py (deterministic, conservative)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/verify.py — the FULL template: `_fetch_text` httpx pattern (10s timeout, follow_redirects, desktop UA, every exception → None), "False negatives acceptable; false positives are not" docstring posture
    - packages/pipeline/src/eisenbalm_pipeline/agents/advocate.py lines 85-95 — `_charity_id_for` / slugify join key
    - packages/pipeline/src/eisenbalm_pipeline/graph/state.py — VerificationRecord field names (must match exactly) + CharityCandidate (`website`, `charityNavigatorUrl`, `guidestarUrl`)
    - .planning/phases/46-CONTEXT.md D-10, D-11, D-12, D-13; RESEARCH Open Question 1 (obscurity threshold)
  </read_first>
  <behavior>
    - Returns {"candidates": survivors, "verification_records": records} with one record per input candidate
    - test_kills_definitive_failure: a candidate whose website 404s/DNS-fails AND has no reachable registration AND high press-hit count is killed (killed=true, status='fail', non-empty killReason) and is NOT in survivors
    - test_keeps_on_transient_error: a candidate whose domain check raises httpx.TimeoutError is KEPT (in survivors) with that check marked unverified (status='unverified', killed=false)
    - test_killed_record_has_reason: every killed record has a non-empty killReason string
    - Each record is emitted via convex_mutation_safe("verificationRecords:insert", ...)
  </behavior>
  <action>
    Create `agents/verify_candidates.py` as a BARE `async def verify_candidates(state) -> dict` (NO @agent_node, no LLM, no cost, no deliberationEvent — exactly like verify.py):
    1. Constants (named, tunable — RESEARCH Open Question 1): `OBSCURITY_PASS_MAX_HITS = 2`, `OBSCURITY_FAIL_MIN_HITS = 4` with an inline comment that these are tuning items with no numeric precedent; the 3-hit middle band ⇒ `unverified` (never a kill).
    2. `async def _check_domain_live(url) -> Optional[bool]`: httpx GET (10s timeout, follow_redirects, desktop UA); DNS-resolves + 2xx/3xx ⇒ True; a definitive 4xx ⇒ False; ANY exception (timeout, 5xx, SSL, DNS blip) ⇒ None (= unverified, D-12). Mirror verify.py's `_fetch_text` try/except exactly.
    3. `async def _check_registration(c) -> tuple[Optional[str], bool]`: return the first reachable of `c.get("charityNavigatorUrl")`/`c.get("guidestarUrl")` — an httpx HEAD/GET that 2xx/3xx ⇒ (that url, True); if a URL is present but unreachable due to a transient error ⇒ (url, False) as unverified; if NEITHER field is present at all ⇒ (None, False) as a definitive "no registration". NO new paid/government EIN API (D-11 Deferred).
    4. `async def _obscurity_press_scan(name) -> Optional[int]`: `results = await web_search(name, max_results=5)`; return `len(results)`; ANY exception ⇒ None (unverified).
    5. `def _apply_kill_rule(domain_live, reg_ok, press_hits) -> tuple[bool, Optional[str]]`: kill ONLY on a DEFINITIVE failure — `domain_live is False` (definitive 404), OR `reg_ok is False AND registrationId is None` (no registration found at all), OR `press_hits is not None and press_hits >= OBSCURITY_FAIL_MIN_HITS` (clearly not obscure). `None` values (transient) NEVER contribute to a kill. Return `(killed, killReason)` with a concrete reason string.
    6. Main loop over `state.get("candidates") or []`: run the three checks, compute killed/reason, build a `VerificationRecord` dict (`candidateId = _charity_id_for(c["name"])`, candidateName, domainLive, registrationId, registrationVerified, obscurity={"pressHits": press_hits or 0, "verdict": <'obscure'|'not-obscure'|'unknown'>}, status ∈ {'pass','fail','unverified'}, killed, killReason, checkedAt=int(time.time()*1000)); append to `records`; `await convex_mutation_safe("verificationRecords:insert", {"runId": state["run_id"], "candidateId": ..., "candidateName": ..., "domainLive": ..., "registrationId": ..., "registrationVerified": ..., "pressHits": ..., "obscurityVerdict": ..., "status": ..., "killed": ..., "killReason": ..., "checkedAt": ...})` (flat args matching the Convex validator from 46-01); if not killed, append `c` to `survivors`.
    7. `return {"candidates": survivors, "verification_records": records}`.
  </action>
  <acceptance_criteria>
    - `grep -q "async def verify_candidates" packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py` matches AND the file has NO `@agent_node` decorator on verify_candidates
    - `grep -q "verificationRecords:insert" packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py` matches
    - `grep -q "OBSCURITY_FAIL_MIN_HITS" packages/pipeline/src/eisenbalm_pipeline/agents/verify_candidates.py` matches
    - `cd packages/pipeline && uv run python -c "from eisenbalm_pipeline.agents.verify_candidates import verify_candidates; print('IMPORT_OK')"` exits 0
    - `uv run pytest tests/agents/test_verify_candidates.py -q` exits 0 with all three tests PASSED (none skipped)
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_verify_candidates.py -q</automated>
  </verify>
  <done>verify_candidates emits a per-org record, kills only definitive failures, keeps transient-error candidates as unverified, and persists every record.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Make editor_gate_1 recover from all-candidates-killed (D-14)</name>
  <files>packages/pipeline/src/eisenbalm_pipeline/agents/editor.py, packages/pipeline/tests/agents/test_editor.py</files>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/agents/editor.py lines 255-263 (the `raise RuntimeError` hard-fail) + lines 316-374 (the existing interrupt path: `pipelineRuns:updateStatus` 'awaiting-review' BEFORE interrupt(), resume value shapes, status back to 'running')
    - packages/pipeline/tests/agents/test_editor.py — the existing editor unit-test fixtures/patterns to extend
    - .planning/phases/46-CONTEXT.md D-14; RESEARCH Pitfall 1 (this file is NOT in CONTEXT's file list but directly blocks D-14)
  </read_first>
  <behavior>
    - test (name containing `no_candidates`): calling editor_gate_1 with state['candidates'] == [] does NOT raise RuntimeError; instead it writes pipelineRuns:updateStatus 'awaiting-review' and calls interrupt() (patch interrupt to capture the payload / raise GraphInterrupt as the existing resume tests do)
    - On resume with a human-supplied charityName, editor_gate_1 builds a synthetic winning_charity dict from that name (since there is no sorted_candidates[0] to fall back to) and returns a non-crashing degraded state
  </behavior>
  <action>
    Replace the `if not candidates: raise RuntimeError(...)` block (editor.py ~L258-263) with a recovery path that mirrors the existing low-confidence interrupt:
    1. When `candidates` is empty: `await convex_mutation_safe("pipelineRuns:updateStatus", {"runId": run_id, "status": "awaiting-review", "awaitingHumanAt": int(time.time()*1000)})` FIRST (idempotency-before-interrupt), then `resume_value = interrupt({"prompt": "verify_candidates killed every candidate — supply a charity to proceed or restart.", "reason": "all-candidates-killed", "candidates": []})`.
    2. Accept the human-supplied name from the same three resume shapes the existing path handles (`editorSelection` / `winnerName` / raw str). Build a MINIMAL synthetic `winning_charity` dict from just that name: `{"name": <name>, "location": "", "website": "", "focusArea": "", "missionStatement": "", "scoutSummary": "", "whyOverlooked": "", "advocateScore": None, "advocateArgument": None, ...}` (all StoryLead-independent CharityCandidate keys present, empty). Write status back to 'running'.
    3. Skip the deterministic-ranking / LLM path when the synthetic winner was constructed (there are no candidates to rank); still return the standard success-state dict shape (winning_charity, editor_decision noting the degraded path, runner_up_notes="", editor_confidence=None, deliberation_transcript with a short "no candidates survived verification" note, model_versions unchanged). Downstream Researcher/Chronicler then produce a degraded-but-non-crashing result (D-14: "recoverable rather than fatal", not "produces a great result").
    4. Leave the non-empty path (deterministic ranking + LLM + existing interrupt) UNCHANGED.
    5. Add a test in test_editor.py (name containing `no_candidates`) asserting the behavior block, patching `interrupt` + `convex_mutation_safe` the way test_editor.py / the resume tests already do.
  </action>
  <acceptance_criteria>
    - `grep -q "raise RuntimeError" packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` no longer matches inside editor_gate_1's empty-candidates guard (the RuntimeError is gone from that block)
    - `grep -q "all-candidates-killed" packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` matches
    - `cd packages/pipeline && uv run pytest tests/agents/test_editor.py -k no_candidates -q` exits 0 with the new test PASSED
    - `uv run pytest tests/agents/test_editor.py -q` — no existing editor test regressed
  </acceptance_criteria>
  <verify>
    <automated>cd packages/pipeline && uv run pytest tests/agents/test_editor.py -q</automated>
  </verify>
  <done>editor_gate_1 degrades to awaiting-review + synthetic-winner recovery on empty candidates; no existing editor test regresses.</done>
</task>

</tasks>

<verification>
- verify_candidates emits per-org records, kills only definitive failures, keeps transient as unverified — `uv run pytest tests/agents/test_verify_candidates.py -q` green
- editor_gate_1 recovers from all-killed — `uv run pytest tests/agents/test_editor.py -q` green
</verification>

<success_criteria>
- SGE-03: one VerificationRecord per org (domain/registration/obscurity), persisted, definitive-failure kills only, transient → unverified, killReason always present on kills
- D-14: all-candidates-killed → awaiting-review recovery, not a RuntimeError crash
</success_criteria>

<output>
After completion, create `.planning/phases/46-signal-editor-candidate-verification/46-05-SUMMARY.md`
</output>
