---
status: partial
phase: 18-magazine-editorial-layout-writers
source: [18-VERIFICATION.md]
started: 2026-05-30T15:00:00Z
updated: 2026-05-30T15:00:00Z
---

## Current Test

[awaiting human testing — Andrew must trigger one production pipeline run + publish before MEL-06 can be confirmed]

## Tests

### 1. MEL-06 — Live HTML scan on a freshly-generated production issue
expected: After Andrew triggers `/run/weekly` against production and publishes the resulting draft via Sanity Studio (which fires the Phase 6 webhook → Vercel deploy), the live `/issue/[slug]` HTML contains **≥ 2 `<h2>` elements + ≥ 1 `<blockquote>` element within EACH of the 5 long-read section containers** (OriginStory, Problem, FounderBio, CaseStudy, Bonus). Verification commands:
```bash
SLUG=issue-<NN>   # the freshly-published issue slug
curl -s "https://eisenbalm-web.vercel.app/issue/$SLUG" > /tmp/issue.html
echo "total <h2 count: $(grep -c '<h2' /tmp/issue.html)        (expect >= 10 — 2 per section × 5 sections)"
echo "total <blockquote count: $(grep -c '<blockquote' /tmp/issue.html)  (expect >= 5 — 1 per section × 5 sections)"
```
Then visually scan: each long-read section should now have visible sub-heads breaking the prose into 3+ movements, plus one pull-quote line in the editorial pull-quote treatment (display font, italic, gold accent left border).
result: [pending]

### 2. MEL-07 — Per-writer cost diff vs. Phase 5 baseline (≤+15%)
expected: After a controlled real-mode pipeline run, diff `pipelineRuns.cost` per-writer USD totals against the Phase 5 baseline. The five long-read writers (origin_story, problem, founder_bio, case_study, bonus[specAd]) each show **≤ +15% per-call cost increase**. Estimate is +8-10% from the ~80-token STRUCTURE_CONTRACT addendum + worst-case +1 retry per writer per run (D-02 retry-once-then-fail path).
result: [pending]

### 3. Qualitative reading-experience confirmation (the user-perceived payoff)
expected: Andrew opens the freshly-published issue on `eisenbalm-web.vercel.app`, reads each long-read section, and confirms it no longer feels like a "wall of 19 px prose" — the sub-heads break the rhythm into 3-4 scannable chunks per section; the pull-quote provides a visible focal point. This is the qualitative validation of the user complaint that triggered this phase (verbatim user-reported failure mode from `10-UI-REVIEW.md`: "the sections are present in very long reads, It's boring for someone to just come on and see a chunk of text").
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
