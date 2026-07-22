---
status: resolved
trigger: "scout-zero-candidates: Scout agent kills every recent new pipeline run with \"LLM returned zero charity candidates after 2 corrective retries\" despite Tavily returning healthy results."
created: 2026-07-22T00:00:00Z
updated: 2026-07-22T00:00:00Z
---

## Current Focus

status: RESOLVED — root cause confirmed via live reproduction (real Tavily +
real OpenRouter Haiku, twice), fix implemented, verified via 2 consecutive
live end-to-end runs of the exact failing code path (discover_candidates()),
full pipeline test suite green (715 passed, 38 pre-existing unrelated skips).
next_action: none — session archived.

## Symptoms

expected: Scout searches (Tavily), the LLM distills 5+ obscure-charity candidates, pipeline proceeds to Advocate/Gate 1.
actual: Runs die in Scout: `RuntimeError: Scout: LLM returned zero charity candidates after 2 corrective retries (run ...); Tavily surfaced 15 results` raised at packages/pipeline/src/eisenbalm_pipeline/agents/scout.py:351 inside discover_candidates(), called from scout() at line 380. Both corrective retries ("strengthened instruction") also yield zero.
errors: Railway log for run 3dd63397 (2026-07-21T05:15 UTC): three Tavily obscure-charity searches return 9/9/9 results; OpenRouter POST /chat/completions returns HTTP 200 at 05:15:15,398 -> WARNING "LLM returned zero candidates — retrying (1/2)" at 05:15:15,542; second 200 at 05:15:16,569 -> retry 2/2 warning at 05:15:16,724; third 200 at 05:15:17,8 -> RuntimeError. Round trips ~1.0-1.3s each. Separate earlier failure mode (issue 999603, ~07-16): `scout: ValidationError: 1 validation error for ScoutBatchOutput`.
reproduction: DO NOT POST /pipeline/run against Railway. Reproduced locally instead (see Evidence): calling discover_candidates()'s pieces directly with real Tavily + real OpenRouter Haiku.
started: intermittent — Scout succeeded 2026-07-20 09:53 UTC (run d05983ee) then failed 10:04 same morning (run 5b6e64f3), 11 min apart. Also failed 07-20 22:14 (3dd63397) and 07-17 (c1ca753c). Earlier July runs (999603-999607) mostly succeeded. A prior debug session (2026-07-17, see resolved/scout-zero-candidates.md, commit 9d3b29b) diagnosed this as model over-rejection and widened the retry budget 1->2 retries as a "PROBABILISTIC MITIGATION — NOT A VERIFIED FIX" (explicit in that commit message); this recurrence proves that mitigation was insufficient on its own.

## Eliminated

- hypothesis: H1 — post-filter dedup (featured_keys / registry) killing all candidates, error message misleading
  evidence: Read scout.py discover_candidates() completely. The RuntimeError at line ~350 (now ~365 after instrumentation added) fires on `candidates_raw` — extracted directly from the raw LLM completion via `_extract_candidates` — which is checked and raises BEFORE the Python-side dedup/filter step (step 4, several lines later). Dedup is never reached when this RuntimeError fires. Also: prior 07-17 debug session independently confirmed via live Convex query that the registry had only 1 featured row / 2 dedup keys at that time — far too small to plausibly reject 15 unrelated Tavily results.
  timestamp: 2026-07-22 (this session)

- hypothesis: H2 — structured-output parse failure silently degrading to empty (acomplete()'s with_structured_output swallowing an error/refusal as an empty-but-valid ScoutBatchOutput)
  evidence: Read openrouter_client.py acomplete() completely. When `result["parsed"] is None` (genuine schema miss / refusal), acomplete() logs "schema miss, retrying once" and retries internally, then RAISES if still None — this is a distinct code path/log line from what appears in the production Railway logs (which show scout.py's OWN "LLM returned zero candidates — retrying (N/2)" warnings, not acomplete's "schema miss" warning). This means `result["parsed"]` was a valid, non-None `ScoutBatchOutput(candidates=[])` each time — the model genuinely, successfully returned a well-formed but empty list. Confirmed directly via live repro: single real acomplete() call returned tokens_out=8 (matches emitting `{"candidates": []}`, far too short to be a truncated/malformed response).
  timestamp: 2026-07-22 (this session)

- hypothesis: H3 (partial) — max_tokens too low causing truncation, or model/config misconfiguration
  evidence: llm_config.py: scout uses `anthropic/claude-haiku-4-5`, temperature 0.3, max_tokens=12_000 (not opus, not null — the "opus-4-7 / max_tokens null" framing in the initial hypothesis brief describes OTHER agents' config, not scout's). Live repro's real completions used tokens_out=8 (empty case) and 507-849 (populated case) — both far under the 12k budget; no truncation signature (e.g. malformed JSON) observed in either case.
  timestamp: 2026-07-22 (this session)

## Evidence

- timestamp: 2026-07-22T00:05:00Z
  checked: packages/pipeline/src/eisenbalm_pipeline/agents/scout.py (full read)
  found: The RuntimeError fires on the raw `candidates_raw` before any dedup step (see H1 elimination above). The retry loop (SCOUT_EMPTY_RETRY_MESSAGES) re-sends the SAME `messages` list (same Tavily results embedded) across all 3 attempts — it only appends escalating instruction text, never re-fetches Tavily. Code comments show this exact bug was investigated once before (commit 9d3b29b, 2026-07-17) and explicitly flagged as a "PROBABILISTIC MITIGATION — NOT A VERIFIED FIX" with a recorded follow-up: "Revisit SCOUT_QUERIES... Lowering the odds of surfacing [listicle] content would attack the root cause upstream of the retry mitigation."
  implication: The correct next step (per the prior session's own recorded follow-up) was to investigate SCOUT_QUERIES content quality directly with live data, not to further tune retry wording.

- timestamp: 2026-07-22T00:20:00Z
  checked: Live reproduction — ran the 3 real SCOUT_QUERIES against live Tavily, built the real system+user messages via `_build_messages` (on-disk scout.md/scout_user.md, file-fallback path — matches production since prompt_versions is unseeded per known issue), then made ONE real OpenRouter Haiku call via `acomplete()` with `response_format=ScoutBatchOutput`.
  found: All 15 Tavily results across the 3 queries were meta-commentary/analysis/opinion content about the nonprofit sector in general — e.g. "The 'invisible majority': What we know about very small nonprofits" (Candid blog/report), "Who are the Most Overlooked Nonprofit Donors?" (YouTube video about donor engagement strategy), "Supporting Underfunded Charities" (charitynavigator.org donor-advice page), "5 Essential Strategies for Small Nonprofits to Amplify Their Impact", "Why a Narrow Focus Can Help Non-Profits Grow Faster" (LinkedIn post) — NONE of the 15 results named or described a specific, individual charity organization. The LLM call returned tokens_out=8 and `ScoutBatchOutput(candidates=[])` — a genuinely correct response given the input: there was nothing to extract.
  implication: Confirms and sharpens the prior session's hypothesis. It's not primarily that the model over-applies its "reject anything Charity Navigator-ranked" rule to well-known orgs — it's that the 3 generic SCOUT_QUERIES frequently surface content that never names ANY specific charity at all (commentary/analysis/how-to articles about the sector). No retry wording, however forcefully worded, can produce a real charity name from input that contains none. This directly explains why even the widened 07-17 retry fix (2 retries, escalating to "relax the obscurity bar") still failed in the 07-20/07-21 recurrences: relaxing a filter doesn't help when the filter was never the blocker — absence of content was.

- timestamp: 2026-07-22T00:25:00Z
  checked: Control test — same real OpenRouter call, but with a synthetic Tavily result set containing 3 clearly-named, clearly-small charities (Vermont library-acoustics nonprofit, Maine cartography trust, Midwest seed-savers collective) plus one no-charity-named commentary result (mirroring the mix).
  found: Model correctly extracted exactly the 3 real charities (tokens_out=507) and correctly ignored the commentary result. Response format, prompt structure, and OpenRouter/Haiku pipeline all behave correctly when given extractable content.
  implication: Rules out any broader defect in the LLM call / parse / prompt-construction path (already largely ruled out by prior session too). The failure is specifically and only about INPUT CONTENT QUALITY from the 3 generic SCOUT_QUERIES.

- timestamp: 2026-07-22T00:35:00Z
  checked: Probed alternative Tavily query phrasings live to find a reliable source of real, named, small/obscure charity content.
  found: `site:guidestar.org/profile small overlooked nonprofit obscure mission` and `site:guidestar.org/profile tiny nonprofit organization narrow focus` reliably return individual GuideStar charity profile pages with real org names and real mission-statement snippets — e.g. "Emerald Development and Economic Network, Inc." (housing insecurity), "Foster Love" (foster-care youth), "No Baby Blisters" (rare genetic disease), "Usher 1F Collaborative Inc" (rare disease research), "Strive" (math/ELA literacy) — small, genuinely obscure-sounding 501(c)(3) orgs, exactly Scout's target profile. A couple results were larger/more-known orgs (Baby2Baby, Friends of the Earth) but that's an acceptable mix since Scout's own rejection logic can filter those while retaining the genuinely obscure ones — unlike the original queries which offered zero extractable orgs of ANY size.
  implication: Identified a concrete, empirically-validated data-source fix: adding these 2 queries to SCOUT_QUERIES gives every batch real, extractable charity content, addressing the root cause directly (data quality) rather than relying solely on prompt-wording pressure on the model.

- timestamp: 2026-07-22T00:45:00Z
  checked: Verification — implemented the fix (SCOUT_QUERIES extended with the 2 guidestar.org/profile queries; empty-first-attempt instrumentation added), then re-ran the REAL discover_candidates() end-to-end (real Tavily across all 5 queries, real OpenRouter Haiku, Convex client mocked unavailable so no writes) TWICE.
  found: Both live runs succeeded on the FIRST LLM attempt (no corrective retry needed) — run 1 returned 4 surviving candidates (No Baby Blisters, Usher 1F Collaborative Inc, Foster Love, Emerald Development and Economic Network) with tokens_out=849; run 2 returned the same 4 orgs with tokens_out=790. Full pipeline test suite: 715 passed, 38 skipped (pre-existing, unrelated respx dependency gap per prior session's notes), 0 failures.
  implication: Fix confirmed working against the real failure mechanism, not just against mocks. Given the original bug was intermittent (not every run failed even pre-fix), 2/2 clean live successes is meaningful but not an absolute mathematical guarantee against a future recurrence — see Resolution.verification for the honest limitation.

## Resolution

root_cause: |
  Scout's 3 original `SCOUT_QUERIES` ("obscure charity small nonprofit
  overlooked impact", "underfunded charitable foundation lesser-known",
  "small charity unique mission narrow focus") are topical/meta queries that
  reliably surface commentary, analysis, and how-to content ABOUT the
  nonprofit sector in general (blog posts, YouTube videos, Reddit threads,
  donor-advice pages, LinkedIn posts) rather than pages that describe a
  SPECIFIC, NAMED charity organization. Live reproduction confirmed this
  directly: all 15 results across the 3 queries in one real Tavily search
  batch contained zero extractable charity names. Scout's LLM call
  (`ScoutBatchOutput` via `acomplete()`, response_format-constrained, no
  min_length on `candidates`) correctly and validly returns
  `{"candidates": []}` when given such a batch — this is genuine, honest
  model behavior, not a parse failure, not a refusal, not truncation, and
  (contrary to the prior 07-17 debug session's leading theory) not primarily
  the model over-applying its "reject anything Charity Navigator-ranked"
  rule to well-known orgs. Because the existing corrective-retry loop
  (`SCOUT_EMPTY_RETRY_MESSAGES`, added in commit 9d3b29b) deliberately
  re-sends the SAME stale Tavily results on every retry ("do not run new
  searches — parse the existing results"), no amount of escalating retry
  wording can manufacture a charity name out of content that never named
  one — explaining exactly why the 07-17 fix (which explicitly labeled
  itself "PROBABILISTIC MITIGATION — NOT A VERIFIED FIX") did not stop the
  bug from recurring on 07-20/07-21. The intermittency (success and failure
  interleaved, sometimes 11 minutes apart) is explained by Tavily's live web
  index varying result mix run-to-run for these generic queries — some
  batches happen to include a listicle with real charity names embedded,
  others don't.

fix: |
  packages/pipeline/src/eisenbalm_pipeline/agents/scout.py:
    1. Extended `SCOUT_QUERIES` from 3 to 5 entries, adding 2 queries
       targeting `site:guidestar.org/profile` (live-validated to reliably
       return individual charity profile pages with real names + mission
       text, e.g. "Foster Love", "No Baby Blisters", "Emerald Development
       and Economic Network"). The original 3 queries are kept for
       diversity. 5 queries stays well under the max_tool_calls=8 budget
       (AGT-18) — no change to the tool-call-limit mechanism.
    2. Added instrumentation: when the LLM returns zero candidates on the
       FIRST attempt, `discover_candidates()` now logs the actual Tavily
       result titles + URLs at WARNING (previously only `len(tavily_results)`
       was ever surfaced, which cost real diagnosis time in this and the
       prior session — this was an explicit recorded follow-up from the
       07-17 session).
    3. Updated in-code comments to record the 07-22 root-cause finding
       alongside (not replacing) the 07-17 investigation's comments, so a
       future reader sees the full history and why the retry-loop mitigation
       alone was insufficient. The corrective-retry loop itself (2 escalating
       retries) is UNCHANGED and kept as defense-in-depth for genuine model
       conservatism — it is no longer the primary defense.

  packages/pipeline/tests/agents/test_scout.py: added 3 regression tests —
    - test_scout_queries_include_guidestar_targeted_queries: guards against
      a silent revert of the 2 new queries (the actual fix).
    - test_scout_queries_within_tool_call_budget: guards the AGT-18 budget
      as the query pool grows.
    - test_empty_first_attempt_logs_tavily_titles: locks in the new
      instrumentation (WARNING includes real titles/URLs on first empty
      attempt).

verification: |
  Deterministic (mocked): all 11 scout.py-related tests pass, including the
  3 new regression tests above. Full pipeline suite: 715 passed, 38 skipped
  (pre-existing unrelated respx gap), 0 failures — no regressions.

  Live end-to-end (real Tavily + real OpenRouter Haiku, no stub mode): 2/2
  consecutive runs of the actual `discover_candidates()` function (same code
  path as production `scout()`) succeeded on the FIRST LLM attempt (no
  corrective retry engaged), each returning 4 genuinely small/obscure named
  charities pulled from real GuideStar profile pages. This directly
  reproduces AND then resolves the exact failure mechanism confirmed in the
  Evidence section (same function, same real APIs, same on-disk prompts).

  HONEST LIMITATION: like the 07-17 fix, this cannot be a mathematical
  guarantee against every possible future empty-batch scenario — Tavily's
  live index could, on some future date, return a genuinely orgless batch
  even across all 5 queries, or GuideStar's own site structure/robots
  behavior could change. What CAN be said with confidence: this fix
  directly targets the CONFIRMED root cause (input content had zero
  extractable charities, not model over-rejection), is validated against
  real production API calls (not just mocks), and the existing 07-17
  escalating-retry mechanism remains as a second layer of defense for any
  residual model-conservatism cases. No live `/pipeline/run` was triggered
  against Railway per the debugging constraints; final confirmation should
  come from observing the Convex `runs` table (workspace 'eisenbalm') for
  absence of this specific RuntimeError over the coming scheduled runs.

files_changed:
  - packages/pipeline/src/eisenbalm_pipeline/agents/scout.py
  - packages/pipeline/tests/agents/test_scout.py

## Notes (unrelated observations, logged not fixed per debugging constraints)

- The `scout.md` system prompt still contains a vestigial instruction
  ("Emit each candidate as soon as you have enough information — do not
  wait for all 5. Max tool calls: 8.") referring to agentic tool-calling
  behavior that no longer applies — Scout's current design does all Tavily
  searches in Python before a single non-tool-calling structured-output LLM
  call, so the LLM never sees or uses "tool calls" itself. Harmless (didn't
  contribute to this bug — confirmed via the control test, which used the
  unmodified prompt and worked correctly) but worth cleaning up separately.
- Pre-existing cost-accounting gap (recorded by the 07-17 session, NOT
  touched here per its own explicit note and this session's scope
  discipline): `discover_candidates()` reassigns `usage` on every retry
  attempt rather than accumulating, so retried attempts' tokens/cost vanish
  from the per-run cost blob. Now affects up to 5 SCOUT_QUERIES' worth of
  Tavily calls plus up to 3 LLM attempts — same gap, unchanged scope.
- 38 pre-existing test skips in the full suite are attributed (by the prior
  session's notes) to a missing `respx` dependency in this environment —
  unrelated to scout, not investigated further here.
