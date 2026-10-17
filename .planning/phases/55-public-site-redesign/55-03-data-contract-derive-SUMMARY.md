---
phase: 55-public-site-redesign
plan: 03
subsystem: web-data-contract
tags: [sanity, groq, derive, fixtures, api-contracts]
requires: []
provides:
  - weeklyIssue.frontPage (editor-authored) + selectionDeliberation.editorConfidence in Studio schema
  - frontPage / editorConfidence / keyDataPoints in both public issue GROQ queries
  - apps/web/lib/dispatch/derive.ts pure derivations (20 exports)
  - shared issue fixtures (fullIssue, sparseIssue, longWordIssue, oneCandidateIssue, archiveIssues)
affects: [55-04, 55-05, 55-06, 55-07, 55-08, 55-09, 55-10, 55-11, 55-12]
tech-stack:
  added: []
  patterns: [pure derivations returning null/[] when data absent]
key-files:
  created:
    - apps/web/lib/dispatch/derive.ts
    - apps/web/__tests__/dispatch-derive.test.ts
    - apps/web/__tests__/groq-parity.test.ts
    - apps/web/__tests__/fixtures/issue.ts
  modified:
    - apps/studio/schemas/weeklyIssue.ts
    - apps/studio/sanity.types.ts
    - apps/web/lib/sanity/queries.ts
    - apps/web/lib/sanity/types.ts
    - docs/API_CONTRACTS.md
decisions:
  - No default confidence: editorConfidence returns null unless finite 0-1
metrics:
  completed: 2026-10-17
---

# Phase 55 Plan 03: Data Contract + Derive Summary

Additive Sanity `frontPage` object and `editorConfidence`, projected identically in both public issue queries, typed, documented in API_CONTRACTS section 55, with a pure tested `derive.ts` and shared fixtures.

## Commits
- aea02b9d feat: schema fields + API_CONTRACTS
- c0ebcc65 feat: GROQ projections, types, fixtures, parity test
- 20d23112 fix: noUncheckedIndexedAccess in fixtures
- c42de622 feat: derive.ts + tests

## Verification
- `pnpm --filter web test`: 56 files, 551 passed (13 todo)
- `pnpm --filter web typecheck`: clean
- Typegen ran successfully (`apps/studio/schema.json` is gitignored; `sanity.types.ts` committed)

## Deviations from Plan
- Task 1 verify mentioned `pnpm --filter studio exec tsc`; not run, typegen success used as the schema check instead.
- Task 2 fixtures initially failed typecheck under noUncheckedIndexedAccess; fixed in a follow-up commit (Rule 1).
- Task 3 `firstSentences` abbreviation test written with a space-separated sample; behavior per plan.

## Known Stubs
None.

## Self-Check: PASSED
