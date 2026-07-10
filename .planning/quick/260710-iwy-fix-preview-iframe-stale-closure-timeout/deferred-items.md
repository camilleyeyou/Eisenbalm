# Deferred Items — Quick Task 260710-iwy

Out-of-scope discoveries found during execution. Not fixed here (per
deviation-rules scope boundary); logged for future triage.

## RE_NUMBER drops a leading "$" from dollar amounts

**Found during:** Task 2 (claims extractor de-noise), while writing the
recall-retention regression test.

**Issue:** `RE_NUMBER` in `packages/pipeline/src/eisenbalm_pipeline/lib/claims.py`
is `\b(?:\$[\d,]+(?:\.\d+)?[BMK]?|\d[\d,]*(?:\.\d+)?%?(?:st|nd|rd|th)?)\b`. The
leading `\b` requires a transition between a word char and a non-word char.
Since `$` is a non-word character, and it is virtually always preceded by
whitespace or punctuation (also non-word), the boundary never falls
immediately before the `$` — it falls one character later, at the digit. The
`\$[\d,]+...` alternative therefore never actually matches in practice; every
dollar amount is captured as bare digits (e.g. `"$500,000"` in source text
extracts as claim text `"500,000"`, silently dropping the currency symbol).

Verified with a standalone repro against the unmodified module:
```
$500,000        -> ['500,000']
raised $500,000. -> ['500,000']
Cost is $5.      -> ['5']
($500,000)       -> ['500,000']
```

**Why not fixed now:** This quick task's plan explicitly freezes RE_NUMBER —
one of its stated invariants is "Preserve DATE-before-NUMBER typing and
existing number/date extraction." The bug is pre-existing, unrelated to the
two confirmed defects this task fixes (PreviewIframe timeout, headline/
blockquote claims noise), and out of scope per the deviation-rules scope
boundary (only auto-fix issues directly caused by the current task's
changes).

**Suggested fix (future task):** Change the regex so the boundary check
applies to the digit run, not the optional leading `$`, e.g.:
`(?:\$\d[\d,]*(?:\.\d+)?[BMK]?|\b\d[\d,]*(?:\.\d+)?%?(?:st|nd|rd|th)?\b)` —
anchor `\b` after the `$` (right before the first digit) instead of before
the whole alternation. Add a regression test asserting `"$500,000"` (not
`"500,000"`) extracts verbatim.

**Impact:** Every dollar-amount claim shown in the Factual Claims checklist
is missing its currency symbol (shows as a bare number). Cosmetic/precision
gap, not a crash or data-loss issue — Andrew can still verify the number,
just without the `$` prefix.
