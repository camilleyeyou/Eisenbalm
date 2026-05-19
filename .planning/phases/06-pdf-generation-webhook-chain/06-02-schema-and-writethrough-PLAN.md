---
phase: 06-pdf-generation-webhook-chain
plan: 02
type: execute
wave: 0
depends_on: []
files_modified:
  - apps/studio/schemas/weeklyIssue.ts
  - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
  - packages/shared/sanity.types.ts
  - packages/pipeline/tests/test_sanity_client_pdfcontent.py
autonomous: false
requirements_addressed:
  - PDF-01

must_haves:
  truths:
    - "After Phase 6 lands, a Sanity weeklyIssue draft contains problemStatement.pdfContent with the 3-key shape (problemStatement, keyDataPoints[3], interventionMechanism)"
    - "write_issue_draft passes state['problem_statement']['pdfContent'] through to Sanity verbatim — the JSON the WeasyPrint renderer reads matches the JSON Phase 5 ProblemWriter emits, byte-for-byte"
    - "Sanity TypeGen successfully regenerates packages/shared/sanity.types.ts with the new pdfContent nested type"
  artifacts:
    - path: "apps/studio/schemas/weeklyIssue.ts"
      provides: "problemStatement now has an embedded pdfContent object with problemStatement/keyDataPoints/interventionMechanism"
      contains: "name: 'pdfContent'"
    - path: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
      provides: "write_issue_draft emits problemStatement.pdfContent passthrough"
    - path: "packages/shared/sanity.types.ts"
      provides: "Regenerated types include the new pdfContent shape"
  key_links:
    - from: "apps/studio/schemas/weeklyIssue.ts"
      to: "packages/pipeline/src/eisenbalm_pipeline/agents/problem.py::PdfContent"
      via: "field-name parity (problemStatement / keyDataPoints / interventionMechanism)"
      pattern: "pdfContent"
    - from: "packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py"
      to: "apps/studio/schemas/weeklyIssue.ts::problemStatement.pdfContent"
      via: "write_issue_draft doc['problemStatement']['pdfContent'] = ..."
      pattern: "pdfContent"
---

<objective>
Extend the Sanity `weeklyIssue.problemStatement` schema to include a `pdfContent` sub-object with the exact field names locked by Phase 5 ProblemWriter's `PdfContent` Pydantic model (problemStatement: text, keyDataPoints: array of {stat, source}, interventionMechanism: text). Then thread `state['problem_statement']['pdfContent']` through `lib/sanity_client.write_issue_draft` so the value Phase 5 already produces in DispatchState lands durably in Sanity. Regenerate TypeGen so the rest of the codebase sees the new shape.

Purpose: close research §Pitfall 8 — the Phase 5 ProblemWriter emits `pdfContent` but Phase 4's draft writer drops it. The PDF renderer (Plan 06-05) reads from Sanity GROQ (not the LangGraph checkpoint), so the field MUST exist on the document.

Output: Sanity schema + Python write path + regenerated TypeGen + a small write-through unit test. Andrew runs `pnpm typegen` to regenerate sanity.types.ts (autonomous: false — needs Studio access to verify).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md
@apps/studio/schemas/weeklyIssue.ts
@packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
@packages/pipeline/src/eisenbalm_pipeline/agents/problem.py

<interfaces>
From packages/pipeline/src/eisenbalm_pipeline/agents/problem.py (LOCKED — do not rename fields):
```python
class KeyDataPoint(BaseModel):
    stat: str = ""
    source: str = ""

class PdfContent(BaseModel):
    problemStatement: str = Field(default="", description="<=150 words")
    keyDataPoints: list[KeyDataPoint] = Field(
        default_factory=lambda: [KeyDataPoint(), KeyDataPoint(), KeyDataPoint()],
        description="exactly 3 keyDataPoints (Phase 6 PDF layout depends on count=3)",
    )
    interventionMechanism: str = Field(default="", description="<=100 words")
```

From apps/studio/schemas/weeklyIssue.ts (current — note `problemStatement` uses editorialSection factory that only emits headline + body):
```ts
editorialSection(
  'problemStatement',
  'The Problem They\'re Solving',
  'Stated plainly and precisely. No sentiment. Just: here is the broken thing, here is how small the fix actually is.'
)
```
The factory returns `{name, title, type: 'object', fields: [headline, body]}`. We MUST replace the factory call for problemStatement with an inline `defineField({...})` so we can extend the `fields:` array with the new `pdfContent` object.

From packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (current write path):
```python
"problemStatement": {
    "headline": (state.get("problem_statement") or {}).get("headline", ""),
    "body": text_to_portable_text(
        (state.get("problem_statement") or {}).get("body", "")
    ),
},
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add pdfContent field to problemStatement in weeklyIssue.ts</name>
  <read_first>
    - apps/studio/schemas/weeklyIssue.ts (lines 4-25 for editorialSection factory; lines 122-127 for current problemStatement call)
    - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py (PdfContent Pydantic — field names + 3-item keyDataPoints contract are LOCKED)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Pitfall 8 — schema must be extended; Open Question 4 — Andrew may override stats in Studio)
  </read_first>
  <files>
    - apps/studio/schemas/weeklyIssue.ts
  </files>
  <action>
Replace the line `editorialSection('problemStatement', "The Problem They're Solving", 'Stated plainly and precisely...')` with an inline `defineField({...})` that extends the headline+body shape with a `pdfContent` object. Keep the description string verbatim from the current factory call.

Insert this block in place of the current `editorialSection('problemStatement', ...)` line (current schema lines 123-127):

```typescript
    defineField({
      name: 'problemStatement',
      title: "The Problem They're Solving",
      type: 'object',
      description: 'Stated plainly and precisely. No sentiment. Just: here is the broken thing, here is how small the fix actually is.',
      fields: [
        defineField({
          name: 'headline',
          title: 'Headline',
          type: 'string',
          validation: Rule => Rule.required(),
        }),
        defineField({
          name: 'body',
          title: 'Body',
          type: 'array',
          of: [{ type: 'block' }],
          validation: Rule => Rule.required(),
        }),
        // ─── PDF source content (Phase 6 — WeasyPrint renderer reads from here) ──
        defineField({
          name: 'pdfContent',
          title: 'PDF Content (source for problemPdf)',
          type: 'object',
          description:
            'Structured source for the Problem Statement PDF. The WeasyPrint renderer reads this exact shape; field names match the Phase 5 ProblemWriter Pydantic contract. Andrew may edit stats/sources here without re-running the pipeline.',
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
              of: [
                {
                  type: 'object',
                  fields: [
                    defineField({ name: 'stat', title: 'Statistic', type: 'string' }),
                    defineField({ name: 'source', title: 'Source', type: 'string' }),
                  ],
                  preview: { select: { title: 'stat', subtitle: 'source' } },
                },
              ],
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
      ],
    }),
```

Do NOT remove the existing `editorialSection` factory — it stays in use for originStory, founderBio, and any future editorial sections. Only the `problemStatement` call is replaced with an inline definition. The Rule import is already at the top of the file.
  </action>
  <verify>
    <automated>grep -c "name: 'pdfContent'" apps/studio/schemas/weeklyIssue.ts && grep -c "interventionMechanism" apps/studio/schemas/weeklyIssue.ts && grep -c "Rule.length(3)" apps/studio/schemas/weeklyIssue.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "name: 'pdfContent'" apps/studio/schemas/weeklyIssue.ts` returns `1`
    - `grep -c "name: 'keyDataPoints'" apps/studio/schemas/weeklyIssue.ts` returns `1`
    - `grep -c "name: 'interventionMechanism'" apps/studio/schemas/weeklyIssue.ts` returns `1`
    - `grep -c "Rule.length(3)" apps/studio/schemas/weeklyIssue.ts` returns `1`
    - `grep -c "editorialSection(" apps/studio/schemas/weeklyIssue.ts` returns at least `2` (originStory + founderBio still use it; problemStatement no longer does)
    - The string `"editorialSection( 'problemStatement'"` is NOT present (problemStatement no longer uses the factory): `grep -c "editorialSection($" apps/studio/schemas/weeklyIssue.ts || true` — and `grep "editorialSection(" apps/studio/schemas/weeklyIssue.ts | grep -c "problemStatement"` returns `0`
    - `cd apps/studio && pnpm exec sanity schema validate` (or `pnpm typegen`) exits 0 — no schema errors
  </acceptance_criteria>
  <done>
    Sanity schema includes the pdfContent nested object; the existing problemStatement.headline/body remain; the editorialSection factory remains intact for other sections; schema validates.
  </done>
</task>

<task type="auto">
  <name>Task 2: Thread state['problem_statement']['pdfContent'] through write_issue_draft</name>
  <read_first>
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py (write_issue_draft lines 99-197; specifically the problemStatement dict at lines 134-139)
    - packages/pipeline/src/eisenbalm_pipeline/agents/problem.py (PdfContent shape — 3 keyDataPoints contract; agent emits problem_statement = {"headline", "body", "pdfContent": {...}})
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Pitfall 8 + Open Question 5)
  </read_first>
  <files>
    - packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py
  </files>
  <action>
Modify `write_issue_draft` so the `problemStatement` dict it writes to Sanity now includes `pdfContent` whenever `state['problem_statement']` carries it. Defensively default to an empty 3-keyDataPoint shape if the field is missing (e.g., for issues authored manually outside the pipeline) — this matches the Pydantic default in `agents/problem.py::PdfContent` and keeps Sanity's `Rule.length(3)` validator happy.

Replace the existing block (around lines 134-139):

```python
        "problemStatement": {
            "headline": (state.get("problem_statement") or {}).get("headline", ""),
            "body": text_to_portable_text(
                (state.get("problem_statement") or {}).get("body", "")
            ),
        },
```

With:

```python
        "problemStatement": {
            "headline": (state.get("problem_statement") or {}).get("headline", ""),
            "body": text_to_portable_text(
                (state.get("problem_statement") or {}).get("body", "")
            ),
            # Phase 6 (PDF-01): pdfContent is the structured source for the
            # WeasyPrint renderer in agents/publisher/pdf.py. Field names match
            # agents/problem.py::PdfContent verbatim. Default to a 3-empty-item
            # shape so Sanity's Rule.length(3) validator passes even for
            # manually-authored drafts (Open Question 5).
            "pdfContent": _build_pdf_content(state),
        },
```

Then add a new module-level helper above `write_issue_draft` (next to `_build_bonus` at line 71):

```python
def _build_pdf_content(state: dict) -> dict:
    """Phase 6 (PDF-01) — pass pdfContent from state through to Sanity.

    Shape locked by agents/problem.py::PdfContent:
      - problemStatement: str  (<=150 words)
      - keyDataPoints: [{stat, source}] * 3 (EXACTLY 3 — Phase 6 PDF layout
        + Sanity Rule.length(3) validator both enforce this)
      - interventionMechanism: str  (<=100 words)

    Defensive default: if state['problem_statement']['pdfContent'] is missing
    (e.g., manually-authored draft, or pre-Phase 5 stub data), emit a 3-empty-
    item shape so the Sanity write doesn't reject.
    """
    section = state.get("problem_statement") or {}
    raw_pdf = section.get("pdfContent") if isinstance(section, dict) else None
    if isinstance(raw_pdf, dict):
        key_data_points = raw_pdf.get("keyDataPoints") or []
        # Normalize to exactly 3 items: truncate excess, pad missing with empties.
        normalized: list[dict] = []
        for i in range(3):
            if i < len(key_data_points) and isinstance(key_data_points[i], dict):
                normalized.append(
                    {
                        "_key": f"kdp-{i}",
                        "stat": key_data_points[i].get("stat", ""),
                        "source": key_data_points[i].get("source", ""),
                    }
                )
            else:
                normalized.append({"_key": f"kdp-{i}", "stat": "", "source": ""})
        return {
            "problemStatement": raw_pdf.get("problemStatement", ""),
            "keyDataPoints": normalized,
            "interventionMechanism": raw_pdf.get("interventionMechanism", ""),
        }
    # No pdfContent in state — default empty 3-item shape.
    return {
        "problemStatement": "",
        "keyDataPoints": [
            {"_key": "kdp-0", "stat": "", "source": ""},
            {"_key": "kdp-1", "stat": "", "source": ""},
            {"_key": "kdp-2", "stat": "", "source": ""},
        ],
        "interventionMechanism": "",
    }
```

The `_key` field on each keyDataPoint is REQUIRED by Sanity for array items (mirrors the `_key: f"candidate-{i}"` pattern already used in `selectionDeliberation.candidates` at line 165-167).
  </action>
  <verify>
    <automated>cd packages/pipeline && grep -c "_build_pdf_content" src/eisenbalm_pipeline/lib/sanity_client.py && uv run python -c "
from eisenbalm_pipeline.lib.sanity_client import _build_pdf_content
# Test 1: full state
out = _build_pdf_content({'problem_statement': {'pdfContent': {'problemStatement': 'X', 'keyDataPoints': [{'stat':'a','source':'b'},{'stat':'c','source':'d'},{'stat':'e','source':'f'}], 'interventionMechanism': 'Y'}}})
assert len(out['keyDataPoints']) == 3 and out['problemStatement'] == 'X', f'Test 1 failed: {out}'
# Test 2: missing pdfContent
out2 = _build_pdf_content({'problem_statement': {'headline':'h','body':'b'}})
assert len(out2['keyDataPoints']) == 3 and out2['problemStatement'] == '', f'Test 2 failed: {out2}'
# Test 3: partial keyDataPoints (only 1 item — must pad to 3)
out3 = _build_pdf_content({'problem_statement': {'pdfContent': {'keyDataPoints': [{'stat':'only','source':'one'}]}}})
assert len(out3['keyDataPoints']) == 3 and out3['keyDataPoints'][0]['stat'] == 'only' and out3['keyDataPoints'][2]['stat'] == '', f'Test 3 failed: {out3}'
# Test 4: _key present on every keyDataPoint
for kdp in out['keyDataPoints']:
    assert '_key' in kdp, f'_key missing: {kdp}'
print('ok')
"</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "def _build_pdf_content" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` returns `1`
    - `grep -c "pdfContent.*_build_pdf_content" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` returns `1`
    - The Python one-liner in the verify command exits 0 and prints `ok`
    - The shape returned for a state with full pdfContent has exactly 3 keyDataPoints, all containing `_key`, `stat`, `source`
    - The shape returned for missing pdfContent still has exactly 3 keyDataPoints (defensive default)
  </acceptance_criteria>
  <done>
    write_issue_draft emits problemStatement.pdfContent on every write; the helper enforces the 3-item array contract; existing fields (headline, body) preserved.
  </done>
</task>

<task type="checkpoint:human-action">
  <name>Task 3: Regenerate Sanity TypeGen + verify Studio shows new pdfContent fields</name>
  <read_first>
    - apps/studio/schemas/weeklyIssue.ts (after Task 1 — verify the pdfContent block is in place)
    - apps/studio/sanity.cli.ts (TypeGen invocation config — confirms `pnpm typegen` resolves to the right script)
    - packages/shared/sanity.types.ts (current shape — confirm regeneration produces a diff containing pdfContent)
    - .planning/phases/06-pdf-generation-webhook-chain/06-RESEARCH.md (Open Question 4 + Pitfall 8 — why the schema patch matters)
  </read_first>
  <files>
    - packages/shared/sanity.types.ts
  </files>
  <action>
Andrew runs the TypeGen regeneration and visually verifies the new fields render in Sanity Studio. Two reasons this is human-action:
  1. `pnpm typegen` needs network access to Sanity Studio's schema endpoint; in CI it has flaked before (see Phase 01 D-08 typegen ECONNRESET).
  2. The Studio UI rendering of the new pdfContent fields is the visual signal that the schema is correctly wired — only a human can confirm "the editor sees three text fields and a 3-row keyDataPoints array."
  </action>
  <instructions>
1. From the repo root:
   ```bash
   pnpm --filter @eisenbalm/shared typegen
   ```
   This re-runs Sanity TypeGen against `apps/studio/schemas/index.ts` and writes the result to `packages/shared/sanity.types.ts`.

2. Confirm the regen succeeded:
   ```bash
   grep -c "pdfContent" packages/shared/sanity.types.ts
   # Expected: >= 1
   grep -c "interventionMechanism" packages/shared/sanity.types.ts
   # Expected: >= 1
   ```
   Both grep counts MUST be >= 1.

3. Open Sanity Studio locally (`pnpm --filter @eisenbalm/studio dev`) and navigate to a draft `weeklyIssue` document. Expand the "Problem They're Solving" section. Confirm:
   - A new "PDF Content (source for problemPdf)" sub-object is visible
   - Inside it: "Problem Statement (PDF summary, <=150 words)" textarea
   - Inside it: "Key Data Points (exactly 3)" array — click "Add item" three times; each item shows "Statistic" and "Source" string fields
   - Inside it: "Intervention Mechanism (<=100 words)" textarea
   - If you add fewer than 3 or more than 3 keyDataPoints and click "Publish", Studio surfaces the error: "keyDataPoints must contain exactly 3 entries (Phase 6 PDF layout depends on it)"

4. Commit the regenerated `packages/shared/sanity.types.ts` to git.

If TypeGen fails (network / parse error), re-run with `pnpm --filter @eisenbalm/shared typegen --verbose` and capture the error. If the failure is environmental, fall back to a manual edit of `sanity.types.ts` extending the `WeeklyIssue['problemStatement']` type with the pdfContent shape (mirror the existing weeklyIssue type structure) and document this fallback in the SUMMARY.
  </instructions>
  <verify>
    <automated>grep -q "pdfContent" packages/shared/sanity.types.ts && grep -q "interventionMechanism" packages/shared/sanity.types.ts</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "pdfContent" packages/shared/sanity.types.ts` returns >= `1`
    - `grep -c "interventionMechanism" packages/shared/sanity.types.ts` returns >= `1`
    - Andrew confirms via Studio screenshot or verbal confirmation that the new pdfContent UI section renders
    - `git status packages/shared/sanity.types.ts` shows the file is committed (M or unchanged after generation)
  </acceptance_criteria>
  <resume-signal>Type "approved" once typegen succeeded and Studio shows the pdfContent fields, or describe the issue you saw.</resume-signal>
  <done>
    sanity.types.ts contains the new pdfContent type; Studio renders the editor UI for the three new fields; the schema is end-to-end consistent.
  </done>
</task>

</tasks>

<verification>
- `grep -c "pdfContent" apps/studio/schemas/weeklyIssue.ts` returns `1`
- `grep -c "_build_pdf_content" packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` returns `1`
- `grep -c "pdfContent" packages/shared/sanity.types.ts` returns >= `1`
- Sanity schema validate exits 0
- Phase 5 test suite remains green: `cd packages/pipeline && EISENBALM_STUB_MODE=true uv run pytest tests/agents/test_problem.py -x` shows no new failures
</verification>

<success_criteria>
1. weeklyIssue.problemStatement.pdfContent is a valid Sanity object field with 3 sub-fields (problemStatement, keyDataPoints, interventionMechanism)
2. keyDataPoints is constrained to exactly 3 items by Rule.length(3)
3. write_issue_draft includes the pdfContent passthrough on every Sanity write, with normalized 3-item keyDataPoints and required `_key` per item
4. sanity.types.ts is regenerated and committed
5. Andrew can edit pdfContent fields in Studio without schema validation errors
</success_criteria>

<output>
After completion, create `.planning/phases/06-pdf-generation-webhook-chain/06-pdf-generation-webhook-chain-02-SUMMARY.md` documenting:
  - The exact replacement block applied to weeklyIssue.ts (paste it)
  - Whether `pnpm typegen` ran cleanly or required the manual fallback
  - Andrew's Studio screenshot confirmation (or note if Andrew confirmed verbally)
  - Sample pdfContent JSON Studio produces (for downstream Plan 06-05 to grep against)
</output>
