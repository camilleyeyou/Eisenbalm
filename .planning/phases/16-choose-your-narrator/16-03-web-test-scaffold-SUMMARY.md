---
phase: 16-choose-your-narrator
plan: 03
subsystem: web
tags: [tripwire, source-scan, security, NRR-08, frontend, wave-0]
requires:
  - "Phase 7 source-scan pattern (game-sandbox.test.ts)"
  - "Phase 13 source-scan pattern (deliberation-conversation.test.ts)"
provides:
  - "apps/web/__tests__/narrator-chip.test.ts (NRR-08 source-scan tripwire)"
  - "Frontend gate for Plan 16-08b (IssueHero chip + queries.ts narrator-> extension)"
  - "Pitfall 8 security guard: GROQ projection no-leak (voiceConstraints / voiceRubric / exampleSamples)"
affects:
  - "Plan 16-08b (turns these RED tests green by adding chip + GROQ projection)"
  - "Wave 0 narrator-chip.test.ts present row of VALIDATION matrix (now closed)"
tech_stack:
  added: []
  patterns:
    - "Vitest readFileSync source-scan (no DOM render, no mock Sanity client)"
    - "Per-it() readFileSync (avoids Phase 9 describe-collection trap)"
    - "Graceful-skip on missing source file (early-return expect(true).toBe(true) for pre-implementation state)"
key_files:
  created:
    - "apps/web/__tests__/narrator-chip.test.ts"
  modified: []
decisions:
  - "RED-first: 6 of 9 assertions intentionally fail at Wave 0 — Plan 16-08b makes them green by adding the IssueHero chip + queries.ts narrator-> projection block. The 3 graceful-skip passers cover GROQ leak-guard (only enforced once block exists) + chip-above-time DOM-order (only enforced once chip exists) + DEL-04 chip-surface model-name guard (passes trivially because current IssueHero contains no model-name literals)."
  - "Source-scan regex tolerates whitespace/formatting variation in JSX (e.g. narrator&&[^}]*name!==, Narrated by[^\\n]*\\{narrator\\??.name\\})."
  - "Pitfall 8 security gate: leak-guard ONLY fires once the narrator-> block exists. This prevents the test from failing pre-Plan-16-08b while still locking the post-Plan-16-08b invariant."
  - "Phase 12 MED-04 machine-readout convention (--color-text-mute + uppercase + 0.18em tracking) asserted at the chip surface to enforce CONTEXT D-19 styling."
metrics:
  duration: "10 minutes"
  completed_at: "2026-05-29"
  tasks_completed: 1
  files_created: 1
  files_modified: 0
  test_assertions_added: 9
  describe_blocks_added: 6
---

# Phase 16 Plan 03: Web Test Scaffold (Narrator-Chip Source-Scan Tripwire) Summary

NRR-08 frontend RED-first source-scan tripwire — 6 describe / 9 it() Vitest assertions on raw IssueHero.tsx + queries.ts source, guarding chip rendering contract + Pitfall 8 GROQ no-leak security invariant before Plan 16-08b adds the implementation.

## What Shipped

A single new test file at `apps/web/__tests__/narrator-chip.test.ts` (163 lines, 6 describe blocks, 9 it() assertions) that encodes the four NRR-08 sub-contracts plus two reinforcement guards using the established Phase 7 / Phase 13 source-scan pattern (`readFileSync` + regex, no DOM render, no mocked Sanity client).

### Sub-Contracts Encoded

| ID | Describe Block | Asserts |
|----|---------------|---------|
| NRR-08(a) | "chip renders iff narrator set AND name !== 'Jesse Eisenbalm'" | `IssueHero.tsx` source contains `/narrator\s*&&[^}]*name\s*!==\s*['"]Jesse Eisenbalm['"]/` conditional |
| NRR-08(b) | "chip is absent when narrator is null" | Source contains `"Narrated by"` literal AND the `narrator &&` conditional guard (together encoding "only inside conditional") |
| NRR-08(c) | "chip copy is 'Narrated by {narrator.name}'" | (i) `/Narrated by[^\n]*\{\s*narrator\??\.name\s*\}/` JSX expression present; (ii) chip uses Phase 12 MED-04 convention (`--color-text-mute` + `uppercase` + `0.18em` tracking) |
| NRR-08(d) | "GROQ projection contains ONLY name + slug + active (Pitfall 8)" | (i) `queries.ts` contains `narrator->` block; (ii) block contains `name`, `slug`, `active`; (iii) block does NOT contain `voiceConstraints`, `voiceRubric`, or `exampleSamples` |
| NRR-08(e) | "narrator chip JSX precedes <time> element in IssueHero source (DOM-order source-scan)" | `indexOf('Narrated by') < indexOf('<time')` once both exist (CONTEXT D-19 chip-above-publish-date invariant) |
| NRR-08 + DEL-04 | "chip surface MUST NOT introduce any model name" | `IssueHero.tsx` source does not contain `Claude`, `gpt-`, `Anthropic`, `OpenAI`, `language model` (case-insensitive) |

### Pattern Reuse

- **Phase 7 game-sandbox.test.ts** — `readFileSync` + literal-string negative + positive assertion pattern.
- **Phase 13 deliberation-conversation.test.ts** — per-it() `readOrEmpty()` helper so tests collect cleanly even when target source pre-exists in incomplete state; describe blocks split per contract for readable failure output.
- **Phase 10 typography test** — `codeOnly()` comment-stripping was considered but not needed here because the asserted patterns are JSX (not prose).

## RED-State Verification

Run command: `pnpm --filter web exec vitest run __tests__/narrator-chip.test.ts --reporter=default`

Result: **6 failed / 3 passed (9 tests, 1 file)** — exactly the intended RED state. The 3 graceful-skip passers are:

1. **NRR-08(d) leak-guard** — only enforces the negative ONCE the `narrator->` block exists. Pre-Plan-16-08b, returns `expect(true).toBe(true)` so the leak-guard never falsely fires.
2. **NRR-08(e) DOM-order** — only enforces ordering ONCE the chip exists.
3. **DEL-04 chip-surface model-name guard** — passes trivially because the current `IssueHero.tsx` contains no model-name literals (which is correct; the guard locks this invariant against future regression).

The 6 failing assertions all turn green when Plan 16-08b lands the IssueHero chip JSX + queries.ts `narrator->{name, slug, active}` projection.

## Existing Tripwire Suite — Stayed Green

Confirmed by running:

```
pnpm --filter web exec vitest run \
  __tests__/game-sandbox.test.ts \
  __tests__/deliberation-no-model-names.test.ts \
  __tests__/podcast-slot.test.ts \
  __tests__/deliberation-conversation.test.ts \
  --reporter=default
```

Result: **4 files passed / 21 tests passed**. No spillover damage from the new file.

## Deviations from Plan

None — plan executed exactly as written. The plan's prescribed file contents were inlined verbatim; the test ran on first attempt; the RED state matches the plan's predicted "most assertions fail because Plan 16-08b not yet landed" verification path.

## Commits

| Hash | Message |
|------|---------|
| `004412a` | `test(16-03): add narrator-chip source-scan tripwire (NRR-08)` |

## VALIDATION Closure

Phase 16 VALIDATION §Wave 0 Requirements row 4 (`narrator-chip.test.ts present`) — **CLOSED**. Plan 16-08b's automated verification command (`pnpm --filter web test:unit -- narrator-chip.test.ts`) now targets a file that exists at this Wave 0 commit; the Nyquist substrate-presence rule is honored.

## Self-Check: PASSED

- File exists: `apps/web/__tests__/narrator-chip.test.ts` (FOUND)
- Commit exists: `004412a` (FOUND in git log)
- Test runs under Vitest with intended RED state (6 failed / 3 passed)
- Existing tripwire suite stays green (game-sandbox, deliberation-no-model-names, podcast-slot, deliberation-conversation — 21/21 passing)
