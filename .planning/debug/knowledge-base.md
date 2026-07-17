# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## scout-zero-candidates — Scout agent intermittently returns zero charity candidates, RuntimeError kills the whole run
- **Date:** 2026-07-17
- **Error patterns:** scout, RuntimeError, zero charity candidates, corrective retry, LLM returned zero, Tavily surfaced 15 results, empty candidates list, ScoutBatchOutput, status=failed, structured output, discover_candidates
- **Root cause:** `ScoutBatchOutput.candidates` has no `min_length`, so `{"candidates": []}` is fully schema-valid — `acomplete()`'s internal regenerate (fires only when `parsed is None`) never engages for an empty list. The sole defense was ONE Python-level retry in `discover_candidates()` that re-sent the same Tavily results with only "you must return 3+" appended, never addressing WHY the model rejected everything. Scout's system prompt (`prompts/scout.md`) tells the model to strongly reject anything "Charity Navigator already ranks prominently"; because `SCOUT_QUERIES` are generic rather than charity-name-targeted, they can surface a batch that is mostly well-known/listicle content, letting the model self-consistently reject all 15 results — a state a same-message retry cannot break out of. NOTE: this is LLM sampling behavior, so the "root cause" is a missing-resilience defect, not a single deterministic code bug.
- **Fix:** PROBABILISTIC MITIGATION, NOT A VERIFIED FIX. Widened the retry budget from 1 retry (2 LLM calls) to 2 retries (3 LLM calls) via a new `SCOUT_EMPTY_RETRY_MESSAGES` tuple + a bounded loop that breaks as soon as candidates are non-empty (happy path unchanged). Made retries escalate rather than repeat: retry #2 names the likely failure mode and authorizes relaxing the obscurity/prominence bar. Verified deterministically only at the mechanism level via mocked `acomplete`; real confirmation requires watching the Convex `runs` table for recurrence. Commit 9d3b29b.
- **Files changed:** packages/pipeline/src/eisenbalm_pipeline/agents/scout.py, packages/pipeline/tests/agents/test_scout.py
- **Eliminated (do not re-investigate):** `featured_keys` over-exclusion (live registry has only 1 featured row => 2 dedup keys; corrupted `timesFeatured: 33886` is never read by `listForDedup`); max_tokens truncation (12k budget vs 343 observed `tokens_out`); Tavily content not reaching the prompt (`_build_messages` interpolates real title/url/content); stub mode (`stubMode:false` in prod); `_extract_candidates` dropping a populated list.
- **Open follow-ups:** (1) log the actual Tavily titles/URLs/content on the zero-candidate path — nothing currently captures what the model saw, which is the evidence needed if this recurs; (2) revisit `SCOUT_QUERIES` (live registry contains candidate rows with `gofundme.com` / article-URL domains, i.e. Scout has been parsing listicles, not charity homepages); (3) PRE-EXISTING: `discover_candidates` overwrites `usage` on every retry, so retried attempts vanish from the per-run cost blob (`"scout": {..., "retries": 0}` is untrustworthy on a retry path) — accumulate instead of overwrite.
---

