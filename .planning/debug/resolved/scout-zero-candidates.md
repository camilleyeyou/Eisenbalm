---
status: resolved
trigger: "Investigate issue: scout-zero-candidates - Scout agent intermittently returns zero charity candidates from the LLM, raises RuntimeError, kills pipeline run"
created: 2026-07-17T00:00:00Z
updated: 2026-07-17T02:00:00Z
---

## Current Focus

status: RESOLVED (probabilistic mitigation — see Resolution.verification; the
bug is NOT proven fixed, only made less likely). Confirmed by coordinator
2026-07-17 after an independent RED-gate check of the new tests.
next_action: none — session archived. See Follow-ups for open work.

## Symptoms

expected: Scout parses the Tavily search results via the LLM (structured output -> ScoutBatchOutput) and returns >=3 charity candidates, so the pipeline can proceed to Advocate/Editor Gate 1.

actual: The LLM returns an EMPTY candidates list. Scout retries once with a strengthened instruction; the retry ALSO returns empty; Scout raises RuntimeError and the whole run fails at the first agent.

errors: "scout: RuntimeError: Scout: LLM returned zero charity candidates after one corrective retry (run c1ca753cce454e59b98e7fd1df4f6b10); Tavily surfaced 15 results"
Raised at: packages/pipeline/src/eisenbalm_pipeline/agents/scout.py:315
Recorded on the Convex run row (dev:modest-magpie-797) as status='failed'.

reproduction: Intermittent — happens on some live pipeline runs, not all. 2 of the 6 runs in the Convex `runs` table (workspace 'eisenbalm') are 'failed'. The most recent: run c1ca753cce454e59b98e7fd1df4f6b10, issueNumber 999616, started 2026-07-17 ~08:50 UTC, failed ~64 seconds after start. An earlier failure occurred 2026-06-25. Successful runs of the same code path exist (e.g. run 6ba26a029f3345b5963565c62ad5ab98 reached awaiting-review, and its recorded cost blob shows scout completing with tokens_in=3226/tokens_out=343/retries=0).

started: Not a fresh regression — failures span 06-25 to 07-17, interleaved with successes. So it is a flaky/conditional failure, not a hard break.

## Eliminated

- hypothesis: Stub mode causing empty candidates
  evidence: Production /healthz returns stubMode:false
  timestamp: pre-investigation (provided)

- hypothesis: _extract_candidates silently drops populated list
  evidence: Code at scout.py:193-203 handles both object/dict shapes correctly, returns list(out.candidates or [])
  timestamp: pre-investigation (provided)

- hypothesis: Tavily/search not working
  evidence: Error message itself interpolates len(tavily_results)==15, real results in hand at failure time
  timestamp: pre-investigation (provided)

- hypothesis: featured_keys over-exclusion (lead #1) — model rejects all Tavily results because the exclusion set is too broad, or `RIP Medical Debt`'s corrupted `timesFeatured: 33886` poisons the set
  evidence: `npx convex run charities:listForDedup '{"workspace_id":"eisenbalm"}'` against the live dev deployment (modest-magpie-797) returns exactly ONE row (RIP Medical Debt, status=featured). `charities:listByWorkspace` confirms only 12 total rows in the registry (11 candidate + 1 featured), none blocklisted. `featured_keys` therefore resolves to only 2 short strings (`"rip medical debt"`, `"ripmedicaldebt.org"`) — far too small a set to plausibly cause a model to reject all 15 unrelated Tavily results. The corrupted `timesFeatured` counter is irrelevant: `listForDedup` doesn't project or use that field at all.
  timestamp: 2026-07-17 (this session)

- hypothesis: Tavily content not actually reaching the prompt (lead #4) — results passed but text empty/truncated, leaving the model nothing to extract
  evidence: `_build_messages` (scout.py:198-201) interpolates the real result CONTENT, not just a count: `f"URL: {r.url}\nTitle: {r.title}\nContent: {r.content[:600]}"` joined across all results into `{results_block}`. Independently confirmed by the coordinator.
  timestamp: 2026-07-17 (this session)

## Evidence

- timestamp: 2026-07-17 (this session)
  checked: packages/pipeline/src/eisenbalm_pipeline/agents/scout.py (full file), especially `ScoutBatchOutput` (lines 75-86 pre-fix) and the corrective-retry block (lines 282-317 pre-fix)
  found: `ScoutBatchOutput.candidates` is `Field(default_factory=list)` with NO `min_length` constraint — `{"candidates": []}` is a fully schema-valid response. The docstring explicitly acknowledges this ("the empty-list case is handled by a corrective retry in scout(), not a parse-time validator"). The corrective retry in `discover_candidates()` fires exactly ONCE on empty output, re-sending the exact same messages plus one appended "you must return 3+" instruction — it does not change the underlying filtering criteria at all.
  implication: confirms investigation lead #3 exactly — `acomplete()` (openrouter_client.py) can and does return a successfully-parsed `ScoutBatchOutput` with an empty list; its own internal schema-miss retry (triggered only when `parsed is None`) never engages for this case, since an empty list validates fine. The ONLY safety net is Scout's single Python-level retry.

- timestamp: 2026-07-17 (this session)
  checked: packages/pipeline/src/eisenbalm_pipeline/prompts/scout.md
  found: System prompt reads: "You are the Scout... You reject anything Charity Navigator already ranks prominently... Reject any charity whose name or website domain appears in: {featured_keys}". The rejection instruction is strongly worded ("reject anything... already ranks prominently") with no stated fallback for "what if nothing in this batch qualifies."
  implication: supports investigation lead #5. If Scout's 3 generic Tavily queries ("obscure charity...", "underfunded charitable foundation...", "small charity unique mission...") happen to surface mostly well-known/listicle-style results (plausible given queries aren't charity-name-specific), the model can apply its own strict-rejection instruction to conclude, self-consistently, that zero of the 15 results qualify. Since the existing one-shot corrective retry only insists "you must return 3+" without addressing *why* the model rejected everything, a model that filtered strictly the first time has no new information to change its answer on retry — explaining why "twice in a row, including after a strengthened corrective-retry prompt" still failed per the bug summary.

- timestamp: 2026-07-17 (this session)
  checked: packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py (`acomplete`) and lib/llm_config.py (`MODEL_BY_AGENT`, `SAMPLING_BY_AGENT`, `MAX_TOKENS_BY_AGENT`)
  found: scout uses `anthropic/claude-haiku-4-5`, temperature 0.3, `max_tokens=12_000` — generous headroom for 3-5 short CharityCandidate objects (a real successful run logged only tokens_out=343). No evidence of truncation. `acomplete()`'s structured-output path (`with_structured_output(..., include_raw=True)`) only regenerates when `parsed is None`; a schema-valid empty list never triggers that internal retry.
  implication: rules out investigation lead #2 (max_tokens truncation) as implausible given the token budget vs. observed usage; confirms the "escape hatch" for empty output is exclusively `discover_candidates()`'s Python-level retry, not `acomplete()`'s built-in one.

- timestamp: 2026-07-17 (this session)
  checked: packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py (`@agent_node` decorator)
  found: No retry/backoff wraps the whole agent node — any exception raised from the agent body propagates directly to LangGraph, which writes `pipelineRuns.status='failed'` and halts the entire run. There is no "restart Scout" mechanism at the pipeline level.
  implication: confirms the reported symptom mechanism precisely (RuntimeError from scout.py:315 kills the whole run) and confirms that ALL resilience against this failure mode must live inside `discover_candidates()` itself — there's no higher-level safety net to lean on.

## Resolution

root_cause: |
  Scout's LLM call (`ScoutBatchOutput`, via `acomplete()`) has NO schema-level
  floor on `candidates` length — `{"candidates": []}` is fully valid Pydantic
  output, so an empty response never triggers `acomplete()`'s own internal
  regenerate-on-schema-miss retry. The only defense against an empty response
  is a single, one-shot Python-level corrective retry in
  `discover_candidates()` (scout.py) that re-sends the same Tavily results
  with an appended "you must return 3+" instruction — it does not address
  *why* the model might have rejected every candidate. Scout's system prompt
  instructs the model to strongly reject anything resembling a
  Charity-Navigator-ranked/prominent charity; because the 3 Tavily queries
  are generic ("obscure charity...", "underfunded charitable foundation...")
  rather than charity-name-targeted, they can plausibly surface a batch of
  results that are mostly well-known/listicle-style, causing the model to
  self-consistently apply its own strict-rejection rule to ALL 15 results —
  a state that a same-message-again retry does nothing to break out of.
  featured_keys over-exclusion was investigated and ELIMINATED: the live
  Convex registry only contains 1 featured row (2 dedup keys total), far too
  small to explain rejecting 15 unrelated results.

  Because this is inherently an LLM-generation-behavior bug (temperature 0.3,
  non-zero), it cannot be root-caused to a single deterministic code defect
  the way a typical software bug can — see verification note below.

fix: |
  packages/pipeline/src/eisenbalm_pipeline/agents/scout.py:
    1. Widened the corrective-retry budget from 1 retry (2 total LLM calls)
       to 2 retries (3 total LLM calls), via a new
       `SCOUT_EMPTY_RETRY_MESSAGES` tuple and a bounded loop in
       `discover_candidates()` that breaks as soon as a non-empty candidates
       list is returned.
    2. Made the retries ESCALATE rather than repeat the same instruction:
       retry #1 keeps the original "re-parse the existing results, return
       3+" instruction (preserves existing single-retry-success behavior/
       tests unchanged). Retry #2 (new) explicitly names the likely failure
       mode and gives the model permission to relax its obscurity/
       prominence filter: "If you rejected every result because it seemed
       too well-known or prominent, relax that bar: select the 3-5 LEAST
       prominent... An imperfect but populated list is required."
    3. Updated the final RuntimeError message to reflect "N corrective
       retries" instead of a hardcoded "one corrective retry".

  This is a bounded, in-process change — no schema/contract change, no new
  dependencies, no change to Sanity/Convex writes. Total added latency/cost
  on the (rare) worst case is one extra Haiku call (~cheap, ~12k max_tokens
  budget already proven sufficient).

verification: |
  Deterministic (mocked) verification: packages/pipeline/tests/agents/test_scout.py
    - test_empty_then_populated_retry (existing, unchanged): 1 empty + 1
      populated -> succeeds after exactly 2 acomplete() calls (confirms the
      widened loop still short-circuits at the first successful retry and
      doesn't regress the pre-existing single-retry-success path).
    - test_empty_twice_then_populated_second_retry (NEW): 2 empty + 1
      populated -> succeeds after exactly 3 acomplete() calls (proves the
      new second retry attempt is reachable and effective).
    - test_empty_three_times_raises_runtimeerror (NEW, replaces the old
      test_empty_twice_raises_runtimeerror): 3 empty in a row -> raises
      RuntimeError after exactly 3 acomplete() calls (proves the bounded
      loop still fails closed and doesn't retry forever).
  All 17 scout-related tests pass; full pipeline suite (686 passed, 38
  skipped — the skips are pre-existing/unrelated missing `respx` dependency
  issues, not caused by this change) passes with no regressions.

  HONEST LIMITATION (per debugging constraints): this is a PROBABILISTIC
  MITIGATION, not a proven deterministic fix. The underlying behavior being
  mitigated is real LLM sampling variance (Haiku, temperature 0.3) reacting
  to a strict system-prompt instruction — nothing in this fix can guarantee
  the model will never return empty 3 times in a row again. What CAN be said
  with confidence:
    - The mechanism (schema permits empty list; single retry with no new
      information/no relaxed criteria) is real and directly explains why a
      "strengthened corrective-retry prompt" (mentioned in the bug summary)
      already failed to help — because merely asking harder for the same
      strict filter doesn't change the model's underlying judgment.
    - The two changes made — (a) one more attempt, (b) a substantively
      different final-attempt instruction that explicitly authorizes
      relaxing the obscurity bar — directly target that mechanism and
      should reduce (not eliminate) the failure's probability.
    - This CANNOT be verified against live pipeline runs within the
      constraints of this session (no live-run execution, no OpenRouter
      spend without explicit sign-off). Real-world confirmation requires
      observing whether future live runs (Convex `runs` table, workspace
      'eisenbalm') stop producing 'failed' rows with this specific
      RuntimeError over the coming weeks. If the failure recurs even with
      the widened retry budget, the next investigation step should be: (1)
      log the actual Tavily result titles/content for a failing run (not
      currently captured anywhere — a good follow-up instrumentation gap),
      and (2) consider loosening SCOUT_QUERIES to be less likely to surface
      only "well-known charity" listicle content.

  INDEPENDENT VERIFICATION (coordinator, 2026-07-17): the two new tests were
  confirmed non-vacuous via a RED gate — scout.py was reverted to HEAD and
  both new tests were run against the OLD 1-retry code; both failed with the
  original "after one corrective retry" RuntimeError. Fix restored; 26
  scout-related tests green. The coordinator also independently confirmed
  the loop breaks immediately when the first call returns candidates (happy
  path unchanged, no extra LLM spend on healthy runs).

files_changed:
  - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
  - packages/pipeline/tests/agents/test_scout.py

## Follow-ups (NOT done — recorded for future work)

1. **Instrument the zero-candidate failure path with the actual Tavily
   payload.** Nothing currently captures what the model actually saw when it
   returned empty — the RuntimeError only reports `len(tavily_results)`. If
   this recurs despite the widened retry budget, the titles/URLs/content of
   the 15 results are exactly the evidence needed to confirm or kill the
   "Tavily surfaced only well-known/listicle content" theory. Suggested:
   log result titles + URLs (and optionally truncated content) at WARNING on
   the first empty response, and/or attach them to the raised RuntimeError /
   a Convex deliberationEvents row.

2. **Revisit `SCOUT_QUERIES`.** The three queries are generic
   ("obscure charity small nonprofit overlooked impact", etc.) rather than
   charity-name-targeted, so they can plausibly surface listicle/round-up
   pages about well-known charities — precisely the content Scout's system
   prompt tells the model to reject. Evidence this already happens: the live
   registry contains candidate rows whose `domain` is `gofundme.com` (from
   `https://www.gofundme.com/c/blog/weird-charities`) and
   `charityconnect.co.uk` / `centreforsocialjustice.org.uk` article URLs —
   i.e. Scout has previously been parsing *listicle articles* rather than
   charity homepages. Lowering the odds of surfacing that content would
   attack the root cause upstream of the retry mitigation.

3. **Retry attempts are dropped from cost accounting (PRE-EXISTING — not
   caused by this change; do NOT conflate with the fix above).** In
   `discover_candidates`, `batch_out, usage = await acomplete(...)`
   reassigns `usage` on every retry, and only that final value is returned
   and reported. The tokens/usd/retries of any retried attempt therefore
   vanish from the per-run cost blob — the Convex run row's
   `"scout": {..., "retries": 0}` cannot be trusted on a retry path. This
   predates this fix (the original 1-retry code had the same reassignment),
   but this fix widens the window from 2 attempts to 3. It matters because
   CLAUDE.md names per-run AI cost containment as an explicit project
   constraint. Right fix: accumulate usage across attempts (sum tokens_in /
   tokens_out / usd, count retries) rather than overwrite. Deliberately NOT
   implemented here — out of scope for this debug session.
