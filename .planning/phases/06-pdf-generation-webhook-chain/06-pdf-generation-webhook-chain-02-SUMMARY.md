---
phase: 06-pdf-generation-webhook-chain
plan: 02
subsystem: sanity-schema + pipeline-write-path
tags: [pdf, schema, sanity, typegen, write-through, phase-6]
requires:
  - phase-5 ProblemWriter emits state['problem_statement']['pdfContent']
  - apps/studio/sanity.types.ts + packages/shared/src/sanity-types.ts pipeline (Phase 1)
provides:
  - weeklyIssue.problemStatement.pdfContent (Sanity schema field)
  - _build_pdf_content() helper in sanity_client (defensive 3-item normalizer)
  - write_issue_draft pdfContent passthrough
  - regenerated sanity.types.ts with pdfContent type
affects:
  - Phase 6 Plan 06-05 (WeasyPrint renderer reads pdfContent via GROQ)
  - Andrew's Sanity Studio UX (new editable fields under "The Problem They're Solving")
tech-stack:
  added: []
  patterns:
    - "Defensive normalization at the write boundary: truncate or pad to a contract-required count so downstream validators (Sanity Rule.length(3)) never reject"
    - "Inline defineField replaces editorialSection factory call when an editorial section needs extra fields beyond headline+body"
key-files:
  created:
    - packages/pipeline/tests/test_sanity_client_pdfcontent.py
  modified:
    - apps/studio/schemas/weeklyIssue.ts
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
    - apps/studio/sanity.types.ts (regenerated)
decisions:
  - "Use inline defineField for problemStatement (replacing editorialSection call) — keeps the factory intact for the two remaining sections that don't need pdfContent (originStory, founderBio)."
  - "_build_pdf_content normalizes to exactly 3 keyDataPoints (pad / truncate) with _key on every item. The defensive default lets manually-authored drafts (or pre-Phase 5 stub data) pass Sanity's Rule.length(3) validator without re-running the pipeline."
  - "Task 3 (Studio visual verification) auto-approved under workflow.auto_advance=true. TypeGen ran cleanly, types contain the expected shape; Andrew's UI confirmation is the irreducible manual residue and can happen on his next Studio session."
metrics:
  duration: ~15min
  completed: 2026-05-18
---

# Phase 6 Plan 02: Schema + Write-Through Summary

Wired up the Sanity `weeklyIssue.problemStatement.pdfContent` field so the Phase 5 ProblemWriter's structured PDF source data lands durably in Sanity, where the Phase 6 WeasyPrint renderer (Plan 06-05) can read it back via GROQ.

## One-Liner

Schema patch + Python passthrough + regenerated TypeGen — closes research §Pitfall 8 (Phase 5 emits pdfContent; Phase 4 draft writer drops it; renderer reads from Sanity not the LangGraph checkpoint).

## What Shipped

### Task 1 — Sanity schema patch (commit `41bfb4f`)

Replaced the `editorialSection('problemStatement', ...)` factory call in `apps/studio/schemas/weeklyIssue.ts` with an inline `defineField({...})` block. The new shape keeps `headline` + `body` (Portable Text) and adds:

```typescript
defineField({
  name: 'pdfContent',
  title: 'PDF Content (source for problemPdf)',
  type: 'object',
  description: 'Structured source for the Problem Statement PDF. ...',
  fields: [
    defineField({
      name: 'problemStatement',
      title: 'Problem Statement (PDF summary, <=150 words)',
      type: 'text',
      rows: 6,
    }),
    defineField({
      name: 'keyDataPoints',
      title: 'Key Data Points (exactly 3)',
      type: 'array',
      of: [{
        type: 'object',
        fields: [
          defineField({ name: 'stat', title: 'Statistic', type: 'string' }),
          defineField({ name: 'source', title: 'Source', type: 'string' }),
        ],
        preview: { select: { title: 'stat', subtitle: 'source' } },
      }],
      validation: Rule =>
        Rule.length(3).error('keyDataPoints must contain exactly 3 entries (Phase 6 PDF layout depends on it)'),
    }),
    defineField({
      name: 'interventionMechanism',
      title: 'Intervention Mechanism (<=100 words)',
      type: 'text',
      rows: 4,
    }),
  ],
}),
```

Schema extracted cleanly via `pnpm schema:extract`; the existing `editorialSection` factory remains in use for `originStory` and `founderBio`.

### Task 2 — Python write-through + tests (commit `b35075f`)

Added `_build_pdf_content(state)` to `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py`. The helper:

1. Pulls `state['problem_statement']['pdfContent']` if present and dict-shaped.
2. Normalizes `keyDataPoints` to **exactly 3 items**: truncates excess, pads missing with `{"stat": "", "source": ""}`.
3. Stamps `_key: f"kdp-{i}"` on every item (Sanity array-item requirement, mirrors the `candidate-{i}` pattern at line 165–167 of the same file).
4. Defensive default when `pdfContent` is missing, non-dict, or the whole `problem_statement` section is absent: emits a valid 3-empty-item shape so Sanity's `Rule.length(3)` validator passes.

`write_issue_draft` now includes:

```python
"problemStatement": {
    "headline": ...,
    "body": text_to_portable_text(...),
    # Phase 6 (PDF-01): pdfContent is the structured source for the
    # WeasyPrint renderer in agents/publisher/pdf.py. Field names match
    # agents/problem.py::PdfContent verbatim. Default to a 3-empty-item
    # shape so Sanity's Rule.length(3) validator passes even for
    # manually-authored drafts (Open Question 5).
    "pdfContent": _build_pdf_content(state),
},
```

`packages/pipeline/tests/test_sanity_client_pdfcontent.py` ships 9 tests:

- 7 unit tests on `_build_pdf_content` (full passthrough, missing section, missing pdfContent, partial keyDataPoints pads to 3, excess keyDataPoints truncates to 3, `_key` present on every item, garbage pdfContent string falls back to default).
- 2 integration tests on `write_issue_draft` via `httpx.MockTransport` that capture the JSON body sent to Sanity and assert the wire payload contains the correct `problemStatement.pdfContent` block with three `_key`-bearing keyDataPoints.

All 9 new tests pass; Phase 5 `tests/agents/test_problem.py` (5 tests) remains green.

### Task 3 — TypeGen regeneration (commit `08a8b9e`, auto-approved)

Ran `pnpm --filter studio typegen`. Clean exit, no network/parse errors:

```
✔ Successfully generated types to /Users/user/Desktop/Eisenbalm/apps/studio/sanity.types.ts in 642ms
  └─ 0 queries and 18 schema types
```

The regenerated `WeeklyIssue['problemStatement']['pdfContent']` now is:

```typescript
pdfContent?: {
  problemStatement?: string;
  keyDataPoints?: Array<{
    stat?: string;
    source?: string;
    _key: string;
  }>;
  interventionMechanism?: string;
};
```

`packages/shared/src/sanity-types.ts` already re-exports all of `apps/studio/sanity.types.ts` (per Phase 1 D-14), so consumers in `apps/web` (Phase 6 Plan 06-05 PDF renderer) and any TypeScript code in `packages/pipeline` see the new shape automatically — no extra edit was needed there.

## Sample pdfContent JSON (for downstream Plan 06-05 to grep against)

A real Sanity `weeklyIssue.problemStatement.pdfContent` block looks like:

```json
{
  "problemStatement": "Short summary under 150 words.",
  "keyDataPoints": [
    { "_key": "kdp-0", "stat": "1 in 4", "source": "CDC 2024" },
    { "_key": "kdp-1", "stat": "$2.3T",  "source": "World Bank" },
    { "_key": "kdp-2", "stat": "73%",    "source": "JAMA 2023" }
  ],
  "interventionMechanism": "Direct cash transfer."
}
```

Plan 06-05's WeasyPrint renderer can rely on:
- `pdfContent.keyDataPoints` always having exactly 3 items.
- Every keyDataPoint having `stat` and `source` (possibly empty strings).
- Every keyDataPoint carrying `_key` (Sanity contract; not load-bearing for the PDF renderer but present).

## Auto-Decisions

- **Task 3 (Studio visual verification) auto-approved.** The plan classifies Task 3 as `checkpoint:human-action` because (a) `pnpm typegen` needs network access to Sanity Studio's schema endpoint (it has flaked before per Phase 01 D-08 typegen ECONNRESET) and (b) the Studio UI rendering is a visual signal only a human can confirm. The user's prompt explicitly authorized autonomous execution and `workflow.auto_advance` is `true`. TypeGen ran cleanly on the first attempt and the regenerated types contain the expected `pdfContent` shape, so I auto-approved and committed the regenerated `sanity.types.ts`. Andrew's Studio UI confirmation is the irreducible manual residue and can be done on his next Studio session — if the UI doesn't render the three new sub-fields correctly, the schema or TypeGen output will show it.

## Deviations from Plan

### Plan path drift (resolved without changes)

- **Plan referenced `packages/shared/sanity.types.ts`.** Actual location is `apps/studio/sanity.types.ts`, re-exported through `packages/shared/src/sanity-types.ts`. No code change needed in `packages/shared/` — its re-export already passes through any field added to the upstream file.
- **Plan referenced `apps/studio/schemas/weeklyIssue.ts` lines 122–127 for the current `editorialSection('problemStatement', ...)` call.** Actual location was lines 123–127 in the as-found file. The replacement was applied at the correct location.

Neither drift required architectural deviation; both files were updated as planned.

## Self-Check: PASSED

Verified files exist:
- FOUND: `apps/studio/schemas/weeklyIssue.ts` (modified)
- FOUND: `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` (modified)
- FOUND: `packages/pipeline/tests/test_sanity_client_pdfcontent.py` (created)
- FOUND: `apps/studio/sanity.types.ts` (regenerated)

Verified commits exist on master:
- FOUND: `41bfb4f` feat(06-02): add pdfContent object to weeklyIssue.problemStatement
- FOUND: `b35075f` feat(06-02): thread pdfContent through write_issue_draft
- FOUND: `08a8b9e` chore(06-02): regenerate sanity.types.ts after pdfContent schema extension

Verified plan acceptance criteria:
- `grep -c "name: 'pdfContent'" apps/studio/schemas/weeklyIssue.ts` → `1` ✓
- `grep -c "name: 'keyDataPoints'" apps/studio/schemas/weeklyIssue.ts` → `1` ✓
- `grep -c "name: 'interventionMechanism'" apps/studio/schemas/weeklyIssue.ts` → `1` ✓
- `grep -c "Rule.length(3)" apps/studio/schemas/weeklyIssue.ts` → `1` ✓
- `grep -c "editorialSection(" apps/studio/schemas/weeklyIssue.ts` → `2` (>=2, ✓ — only originStory + founderBio)
- `grep "editorialSection(" apps/studio/schemas/weeklyIssue.ts | grep -c "problemStatement"` → `0` ✓
- `pnpm schema:extract` exits 0 ✓
- `grep -c "def _build_pdf_content" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` → `1` ✓
- `grep -c "pdfContent.*_build_pdf_content" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` → `1` ✓
- Python verification one-liner exits 0, prints `ok` ✓
- `grep -c "pdfContent" apps/studio/sanity.types.ts` → `1` (>=1, ✓)
- `grep -c "interventionMechanism" apps/studio/sanity.types.ts` → `1` (>=1, ✓)
- Phase 5 problem test suite stays green: `tests/agents/test_problem.py` 5 passed; new `tests/test_sanity_client_pdfcontent.py` 9 passed ✓
