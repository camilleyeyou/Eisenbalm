# Phase 18: Magazine Editorial Layout — Writer Structure - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning
**Source:** discuss-phase interactive — 2 gray areas selected (Emission mechanism, QA enforcement scope); the other 2 in the candidate set (Failure mode, Sub-head + pull-quote authorship) were absorbed by D-02 + D-01 respectively, with defensible defaults.

<domain>
## Phase Boundary

Eliminate the "wall of 19 px prose" reading experience on `/issue/[slug]` by teaching the five long-read writer agents — **OriginStoryWriter, ProblemWriter, FounderBioWriter, CaseStudyWriter, and the Bonus `specAd` branch only** — to emit varied Portable Text structure: at minimum **2 `h2` (or `h3`) sub-headers + 1 `blockquote` (pull-quote)** per section. The frontend `PortableTextRenderer` already renders these primitives (Phase 10); they are dead-coded at the live URL because writers emit only `style: "normal"` paragraphs. Phase 18 activates that already-built typography by upgrading **the writer Pydantic schemas + the per-writer system prompt + the QA `rubric.md` qualitative axis** — zero new frontend components, zero Sanity schema changes.

**In scope:**

- Refactor `SectionContent.body` (and equivalents for `CaseStudyContent`, `BonusContent`) from `str` to **`list[BodyBlock]`** where `BodyBlock` is a discriminated union of `Paragraph | Heading | Blockquote` (D-01). This is a contract surface change to `docs/API_CONTRACTS.md §7` (DispatchState) and §2.2 (Sanity write shape) — reconcile FIRST per CLAUDE.md hard rule.
- Extend `lib/portable_text.py` with `block_paragraph`, `block_h2`, `block_h3`, `block_blockquote` builders (ROADMAP stub already names them); writers consume these via a new `compose_section_body(blocks: list[BodyBlock]) -> list[PortableTextBlock]` serializer.
- Per-writer Pydantic schema upgrade: each section writer's response model gains a `@field_validator('body')` enforcing `count(type == 'h2' | 'h3') >= 2 AND count(type == 'blockquote') >= 1` (D-02). Validation failure triggers the existing Phase 5 `openrouter_client.acomplete` retry-once-then-fail path; second failure raises and `@agent_node` wrapper sets `pipelineRuns.status='failed'` with `errorMessage='<agent>: structural-validation: <details>'`.
- Per-writer prompt upgrade: each writer system prompt gains a **STRUCTURE_CONTRACT block** in its `section_guidance` string (per ROADMAP stub language): "Emit at minimum 2 sub-headers (h2 or h3) and 1 pull-quote (blockquote). Sub-headers ≤ 6 words, Jesse-voice, break body into 3+ movements. Blockquote is a one-sentence lift from the most quotable line in body."
- **Bonus agent — `specAd` branch ONLY** (D-04). `_build_spec_ad_prompt` gains the STRUCTURE_CONTRACT; `_build_big_budget_prompt` and `_build_jingle_prompt` unchanged (their existing structured output — storyboards[], lyrics/sunoPrompt — already breaks visual rhythm).
- QA judge `rubric.md` gains a new qualitative axis (D-05) — call it `structural-variety` — that judges sub-head wording (short, Jesse-voice, not generic labels like "Background" / "Conclusion") + pull-quote (actually lifted from body, not a generic restatement). Pydantic guarantees the count; the judge grades the craft. Findings land in `qaCorrections` with the new axis label.
- QA `rules.py` Layer-1 deterministic predicates stay unchanged (no new regex predicate — counting Portable Text blocks is a serializer-layer concern, not a body-string predicate).
- Pipeline tests RED-first per ROADMAP stub: `test_writer_emits_h2_sub_headers.py` (5 cases — one per agent), `test_writer_emits_blockquote.py` (5 cases), `test_qa_rejects_flat_paragraph_wall.py` (1 backstop test).
- Verification + Andrew UAT: trigger one real pipeline run end-to-end on production with a fresh `issueNumber`; query Sanity post-write to assert `count(originStory.body[style in ["h2","h3"]]) >= 2` (and equivalents for the other 4 sections); fetch the live `/issue/[slug]` HTML and assert `<h2>` + `<blockquote>` counts within each section's container.

**Strictly NOT in this phase (deferred or explicitly out of scope):**

- **`pdfContent` stays flat** (D-03). ProblemWriter's `pdfContent` (Phase 6 WeasyPrint template input — `problemStatement` ≤150w + `keyDataPoints[3]` + `interventionMechanism` ≤100w) is unaffected. PDF stays single-column prose; web body diverges intentionally.
- Bonus `bigBudget` and `jingle` branches — their existing structured outputs (storyboards[], lyrics + sunoPrompt) already provide visual variety; forcing sub-heads on a 100-200 w jingle intro would be mechanical.
- Game agent — not narrative prose; emits `embedCode`, not body.
- Chronicler conversation turns — already a structured chat thread (Phase 13), not a wall.
- Researcher — emits `research` object, not body prose.
- Frontend changes — `PortableTextRenderer.tsx` already renders h2/h3/blockquote correctly (Phase 10). No new component.
- **Fix #2 from `10-UI-REVIEW.md`** (`StatRow` component for `problemStatement.pdfContent.keyDataPoints`) — that's a web-side render task; separate phase or follow-on. Phase 18 is pipeline-side only on the writer surface.
- **Fix #3 from `10-UI-REVIEW.md`** (per-section `.lede` paragraph styling) — frontend-only typography polish; this phase doesn't add new CSS utilities.
- **Fix #5 from `10-UI-REVIEW.md`** (sticky SectionNavigator) — frontend-only; orthogonal.
- **Empty CaseStudy metadata-block bug** (`subjectName.trim()` guard, `CaseStudySection.tsx:55`) — one-line bug fix; doesn't belong in this phase, drop it as a quick task (`/gsd:quick`) if not already filed.
- Narrator-override of the structural floor — structural rule stays narrator-agnostic (lives in `section_guidance`, not in `voice_constraints` — per Phase 16 D-05/D-06, narrator only controls `style_brief["voice"]`). Maya/Herzog/Sorkin samples have not been observed to need a different floor.
- Per-section retry on QA `error` — Phase 5 D-04 explicitly rejected this; structural-validation retry-once at the Pydantic layer is the only retry surface added in this phase.
- New `deliberationEvents.eventType` value for structural retry — reuses the existing `acomplete` retry mechanism's logging path; no new event type, no Convex schema change.

</domain>

<decisions>
## Implementation Decisions

### Emission mechanism (the load-bearing decision)

- **D-01: Pydantic typed `body` blocks.** Each long-read writer's response Pydantic schema changes its `body` field from `str` to `list[BodyBlock]`, where `BodyBlock` is a discriminated union:
  ```python
  class Paragraph(BaseModel):
      type: Literal['paragraph'] = 'paragraph'
      text: str

  class Heading(BaseModel):
      type: Literal['h2', 'h3']      # writer picks per local hierarchy
      text: str

  class Blockquote(BaseModel):
      type: Literal['blockquote'] = 'blockquote'
      text: str                       # one-sentence pull-quote lift

  BodyBlock = Annotated[
      Union[Paragraph, Heading, Blockquote],
      Field(discriminator='type'),
  ]
  ```
  Pipeline serializes `list[BodyBlock]` → Portable Text via `compose_section_body()` in `lib/portable_text.py`, which dispatches each block type to the matching `block_paragraph` / `block_h2` / `block_h3` / `block_blockquote` builder. Sanity write path consumes the same Portable Text shape it does today — no Sanity schema change.
  - **Why:** Rejected Option A (Markdown-ish `##` / `>` prefixes in `body: str`) — too fragile to model drift (LLM might use `##` mid-prose); requires regex defense against false positives; harder to test. Rejected Option C (separate `sub_headers[]` + `pull_quote` fields with `after_paragraph: int` indices) — explicit but inflates the contract; mismatched indices = silent positioning bugs; merge logic adds a code surface. Option B is the strict-from-the-model-outward choice: structure is validated at the Pydantic layer where every other writer constraint already lives, and the LLM's response-format coercion (OpenRouter JSON mode + Pydantic) does the heavy lifting.
  - **How to apply:** Planner reconciles `docs/API_CONTRACTS.md §7` (DispatchState — `SectionContent.body`, `CaseStudyContent.body`, `BonusContent.body`) FIRST per CLAUDE.md, then ships:
    1. `lib/portable_text.py` gains `block_paragraph`, `block_h2`, `block_h3`, `block_blockquote` builders + `compose_section_body(blocks: list[BodyBlock]) -> list[PortableTextBlock]` serializer
    2. `graph/state.py` `SectionContent` (+ `CaseStudyContent`, `BonusContent`) `body` field re-typed from `str` to `list[dict]` (TypedDict can't express the discriminated union; the Pydantic layer in each writer enforces shape)
    3. Each writer's response Pydantic model declares `body: list[BodyBlock]`
    4. Each writer call replaces the existing `text_to_portable_text(body_str)` Sanity write path with `compose_section_body(body_blocks)` (planner audits all call sites — `agents/*.py` + `lib/sanity_client.py`)

- **D-02: Structural floor enforced at the Pydantic layer (writer schema `@field_validator`).** Each long-read writer's response model includes:
  ```python
  @field_validator('body')
  @classmethod
  def _enforce_structural_floor(cls, body: list[BodyBlock]) -> list[BodyBlock]:
      heading_count = sum(1 for b in body if b.type in ('h2', 'h3'))
      blockquote_count = sum(1 for b in body if b.type == 'blockquote')
      if heading_count < 2:
          raise ValueError(f"structural-floor: need >=2 sub-headers, got {heading_count}")
      if blockquote_count < 1:
          raise ValueError(f"structural-floor: need >=1 blockquote, got {blockquote_count}")
      return body
  ```
  LLM output that fails the validator triggers the existing Phase 5 `openrouter_client.acomplete` **retry-once-then-fail** path — the second attempt's prompt appends the Pydantic error message (existing established behavior). Second failure raises; `@agent_node` wrapper catches and sets `pipelineRuns.status='failed'` with `errorMessage='<agent>: structural-validation: <pydantic error>'`. **QA never reaches a non-conforming body** because the writer can't produce one — QA's structural axis (D-05) is a qualitative judge on top of a guaranteed-shape input.
  - **Why:** Rejected "QA-only" enforcement — Phase 5 D-04 says QA never blocks the draft, so a QA-only structural axis would let the wall ship anyway. Rejected "both Pydantic + QA backstop count check" — redundant; Pydantic is deterministic and runs first; a count-only QA layer wastes judge tokens on a guaranteed-met constraint. The Pydantic retry-once path is the existing established defense for malformed writer output (Phase 5 D-14); structural validation rides that lane without inventing a new mechanism.
  - **How to apply:** Planner adds the `_enforce_structural_floor` validator to OriginStoryOutput, ProblemOutput, FounderBioOutput, CaseStudyOutput, and SpecAdBonus (NOT BigBudgetBonus, NOT JingleBonus — per D-04). The validator lives on the response Pydantic model, not on `SectionContent`/`CaseStudyContent`/`BonusContent` TypedDicts (which are state-storage shapes, not write-time gates).

- **D-03: `pdfContent` stays flat.** ProblemWriter's `body` becomes `list[BodyBlock]` for Sanity / page render; ProblemWriter's `pdfContent` (the WeasyPrint template input — `problemStatement: str ≤150w`, `keyDataPoints: list[KeyDataPoint] (exactly 3)`, `interventionMechanism: str ≤100w`) is **unchanged**. Phase 6 WeasyPrint template is unaffected; PDF stays single-column prose. Cleanest scope boundary; PDF and web diverge intentionally — the PDF is for download/print, the web is for editorial scanning.
  - **Why:** ROADMAP success criterion 6 targets the live frontend specifically (`/issue/[slug]` HTML scan). The PDF is a separate artifact; Phase 6 owns the template; reshaping `pdfContent` would grow Phase 18 into Phase 6 territory. Phase 18 ships a contract-surface change to `body` only; `pdfContent` shape is byte-equivalent.
  - **How to apply:** ProblemWriter Pydantic response model keeps `pdfContent: PDFContent` unchanged (existing Pydantic shape); only `body` field changes type. Sanity write path for `weeklyIssue.problem.pdfContent` unchanged; for `weeklyIssue.problem.body` flows through `compose_section_body`.

### QA enforcement scope

- **D-04: Bonus structural contract applies ONLY to the `specAd` branch.** `_build_spec_ad_prompt` in `agents/bonus.py` gains the STRUCTURE_CONTRACT addendum; `SpecAdBonus` Pydantic gets the `body: list[BodyBlock]` shape + `_enforce_structural_floor` validator. `_build_big_budget_prompt` and `_build_jingle_prompt` **unchanged**: BigBudgetBonus keeps `body: str` (its visual variety comes from `storyboards: list[Storyboard]` — already shapes the section into 3-5 distinct shots), and JingleBonus keeps `body: str` (its visual variety comes from `lyrics: str` + `sunoPrompt: str` — the body is a short 100-200w concept intro to the structured payload below it).
  - **Why:** The UI review evidence (`10-UI-REVIEW.md` Pillar 2 table) measured Bonus at **287 words** — well below the 451-551 wall-of-text threshold of the four narrative writers. The bigBudget branch's storyboard grid is "the only inline visual asset on any long-read" per the audit itself. Forcing sub-heads on a 100-200w jingle intro would be mechanical; bigBudget already has structure. The wall-of-text problem is concentrated in the four narrative writers + the specAd branch when it happens to ship.
  - **How to apply:** Planner ships the contract on `SpecAdBonus` only. Tests `test_writer_emits_h2_sub_headers.py` and `test_writer_emits_blockquote.py` parametrize over 5 writers: `origin_story`, `problem`, `founder_bio`, `case_study`, `bonus[specAd]`. The bonus test uses `style_brief["bonusType"] == "specAd"` as the fixture state; no test for bigBudget/jingle structural floor (negative test optional — "bigBudget body keeps `str` shape").

- **D-05: QA judge gets a qualitative `structural-variety` axis.** `rubric.md` extends its evaluation axes with a new axis:
  ```
  structural-variety: Are the sub-headers short (≤6 words), Jesse-voice (no
  generic labels like 'Background' / 'Conclusion'), and breaking the body
  into 3+ logical movements? Is the pull-quote a real one-sentence lift
  from body prose, or a generic restatement?
  ```
  `JudgeFinding.axis` `Literal` union in `agents/qa/judge.py` gains `"structural-variety"`. The judge runs against the **rendered body text** (paragraphs only, concatenated) so it can evaluate the prose ↔ sub-head match without parsing block JSON itself — sub-head text + body prose text are both presented in the user message as labelled sections. Findings land in `qaCorrections` with `severity='warning'` (not `error`) because the body is already structurally valid; this is craft quality, not contract.
  - **Why:** Pydantic guarantees the counts; left alone, that produces a "2 sub-heads labelled 'Background' and 'Conclusion' on every section" pattern — count met, craft failed. The qualitative judge axis catches that. `severity='warning'` because Phase 5 D-02/D-04 keep QA annotation-only and Andrew is the editorial guard — error severity is reserved for hard rule failures (exclamation marks, forbidden sentiment keywords, AI self-reference).
  - **How to apply:** Planner extends `rubric.md` with the new axis (short, declarative — 2-3 sentences); adds `"structural-variety"` to `JudgeFinding.axis` `Literal`; updates `JudgeFindings.findings[].severity` guidance in rubric to use `warning` for this axis. No new judge call (still single Opus call per Phase 5 D-03); no new Convex schema change (the existing `qaCorrections.axis` field accepts any string per Phase 5).

### Claude's Discretion

Planner has freedom on the following without re-asking the user:

- Whether `compose_section_body` lives in `lib/portable_text.py` (recommended, matches the existing `text_to_portable_text` neighbour) or a new `lib/portable_text_compose.py`.
- Exact Pydantic discriminator pattern — `Annotated[Union[...], Field(discriminator='type')]` vs. `Annotated[..., Discriminator('type')]` — pick what parses reliably with the current pydantic-v2 pin.
- Whether the test scaffold uses one consolidated `test_writer_structural_floor.py` file with `pytest.mark.parametrize` over (agent, body fixture) tuples, or three separate files per ROADMAP stub (`test_writer_emits_h2_sub_headers.py`, `test_writer_emits_blockquote.py`, `test_qa_rejects_flat_paragraph_wall.py`). ROADMAP stub names the three files; planner may consolidate if `parametrize` produces cleaner output.
- Exact STRUCTURE_CONTRACT wording in each writer's `section_guidance` — copy the ROADMAP stub language as the seed, refine for Jesse voice. Keep ≤ 120 words; structural rules are mechanical, not editorial.
- Whether to keep `text_to_portable_text(body_str)` around as a deprecation-tombstone (for backward-compatibility with any stub-mode fixture that still emits `body: str`) or delete it after migration. Recommend keeping with a docstring marking it stubs-only.
- Per-writer h2-vs-h3 hierarchy preference — recommend writer picks `h2` for top-level movements (default), `h3` only when it wants to nest. Validator counts both as "sub-headers".
- Test fixture body shapes for the RED tests (the `body: list[BodyBlock]` payloads asserted against the validator).
- Whether to additionally write a `test_bonus_specAd_only_structural_floor.py` negative test asserting BigBudgetBonus + JingleBonus do NOT carry the validator — recommend yes, costs one small test, prevents future drift.
- Exact wording of the new `rubric.md` `structural-variety` axis description — must match the existing rubric's editorial register (short, declarative, no hedging).

### Folded Todos

None — `gsd-tools todo match-phase 18` returned 0 matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Hard rules & contracts (read FIRST — gate every schema/payload change)
- `CLAUDE.md` — no schema field renames without `docs/API_CONTRACTS.md`; GSD workflow enforcement; Jesse voice non-negotiable. Body-shape change MUST update API_CONTRACTS first.
- `docs/API_CONTRACTS.md §7` — `DispatchState` TypedDict. `SectionContent.body`, `CaseStudyContent.body`, `BonusContent.body` all currently typed `str`. Must change to `list[dict]` (Pydantic enforces the discriminated union at write time; TypedDict can't express it).
- `docs/API_CONTRACTS.md §2.2` — `create weeklyIssue draft` Python write shape. Each section's `body` field on Sanity is `array of blocks` (already Portable Text on Sanity's side); this phase changes the upstream pipeline shape, NOT the Sanity field type. Confirm the §2.2 example block reflects the new compose path.
- `docs/API_CONTRACTS.md §2.4` — Portable Text helpers (`text_to_portable_text` is described here). Add `block_paragraph`, `block_h2`, `block_h3`, `block_blockquote`, `compose_section_body` documentation alongside.

### Phase 18 audit reference (the canonical "why this phase exists")
- `.planning/phases/10-editorial-design-pass/10-UI-REVIEW.md` — full 6-pillar UI audit (score 14/24). The Top 5 Priority Fixes table identifies this phase's scope as Fix #1 ("Force agents to emit at least 2 h2 sub-heads per long-read section") + Fix #4 ("Pull-quote the most-quotable sentence per section — option (a) is zero-schema-change"). The Pillar 2 + Pillar 4 sections quantify the wall-of-prose (0 sub-heads / 0 blockquotes across all 5 long-reads on `/issue/issue-999530`).
- `/tmp/issue-999530-v2.html` (referenced in the UI-REVIEW, may or may not survive — planner re-runs the audit if absent) — live RSC render that proves `<h2>` / `<blockquote>` counts inside sections are 0.

### Prior-phase decisions this phase inherits (carry forward — do NOT re-decide)
- `.planning/phases/05-agent-quality/05-CONTEXT.md`:
  - **D-01** (two-layer QA: deterministic `rules.py` + LLM `judge.py`) — Phase 18 extends judge layer with `structural-variety` axis; does NOT add a new Layer-1 predicate.
  - **D-02** (QA writes annotations only — never rewrites) — Phase 18 honors; `structural-variety` findings go into `qaCorrections` with `severity='warning'`.
  - **D-03** (one holistic QA pass post-fan-out) — Phase 18 honors; the new axis runs in the same single Opus call.
  - **D-04** (QA never blocks the draft) — Phase 18 honors; the structural floor blocks at the Pydantic layer (writer retries once), NOT at QA.
  - **D-13** (`lib/voice.py::build_section_writer_prompt` is the only path to assemble a section writer's prompt) — Phase 18 threads STRUCTURE_CONTRACT through each writer's `section_guidance` argument; does NOT change `build_section_writer_prompt`'s signature.
  - **D-14** (per-agent Pydantic output validation + retry-once-then-fail) — Phase 18's structural floor is a Pydantic validator that hooks into the existing retry path. This is the SINGLE mechanism the structural enforcement relies on.
  - **AGT-09** (voice-isolation invariant: writers never read other section output) — Phase 18 honors; the body shape change does NOT introduce cross-section reads.
- `.planning/phases/13-deliberation-as-conversation/13-CONTEXT.md`:
  - **D-04** (chronicler is a single-call pattern; reusable here for one writer call producing structured output) — Phase 18 mirrors: one writer call, structured output, validated at parse time.
- `.planning/phases/16-choose-your-narrator/16-CONTEXT.md`:
  - **D-05 / D-06** (single injection point = Calibrator; `style_brief["voice"]` stays a single string) — Phase 18 honors; the structural floor lives in `section_guidance` (per-section), NOT in `voice_constraints` (per-narrator). Narrator override of structural floor is OUT of scope.
  - **NRR-10** (zero-regression on existing tripwires + 168-passing pytest) — Phase 18 must hold this line; baseline is now 190+ passing per ROADMAP Phase 18 success criterion 5.

### Pipeline (writer + QA surfaces — Phase 18 modification points)
- `packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` (40 lines) — current single helper `text_to_portable_text`. Add `block_paragraph`, `block_h2`, `block_h3`, `block_blockquote`, `compose_section_body`.
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py::build_section_writer_prompt` — Phase 18 does NOT change its signature; threads STRUCTURE_CONTRACT via each writer's `section_guidance` argument.
- `packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py` (104 lines) — `SECTION_GUIDANCE` gains STRUCTURE_CONTRACT addendum; `OriginStoryOutput` Pydantic `body` field changes from `str` to `list[BodyBlock]` + `@field_validator` for `_enforce_structural_floor`.
- `packages/pipeline/src/eisenbalm_pipeline/agents/problem.py` (142 lines) — same modification on `ProblemOutput`; `pdfContent` shape unchanged (D-03); section_guidance gains STRUCTURE_CONTRACT for the body field only.
- `packages/pipeline/src/eisenbalm_pipeline/agents/founder_bio.py` (137 lines) — same on `FounderBioOutput`. Both `GUIDANCE_VERIFIED` and `GUIDANCE_ANONYMOUS` get the STRUCTURE_CONTRACT addendum.
- `packages/pipeline/src/eisenbalm_pipeline/agents/case_study.py` (131 lines) — same on `CaseStudyOutput`. Both verified + anonymous guidance paths get the STRUCTURE_CONTRACT.
- `packages/pipeline/src/eisenbalm_pipeline/agents/bonus.py` (231 lines) — ONLY `_build_spec_ad_prompt` + `SpecAdBonus` get the STRUCTURE_CONTRACT + validator (D-04). `_build_big_budget_prompt` + `BigBudgetBonus` unchanged. `_build_jingle_prompt` + `JingleBonus` unchanged.
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` lines 80-99 — `SectionContent.body`, `CaseStudyContent.body`, `BonusContent.body` re-typed from `str` to `list[dict]` (TypedDict can't carry the discriminated union; Pydantic enforces at write time).
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` — current call sites that pass `body_str` into `text_to_portable_text()` for Sanity write rewire to call `compose_section_body(body_blocks)` instead. Audit every section's write path.
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` (190 lines) — `JudgeFinding.axis` `Literal` union gains `"structural-variety"`. No new acomplete call (single Opus call per Phase 5 D-03 preserved).
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md` — extend Evaluation Axes section with the `structural-variety` axis (D-05). Short, declarative description.
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py` (269 lines) — UNCHANGED. Phase 18 does NOT add a Layer-1 deterministic predicate; structural enforcement is the Pydantic layer, qualitative judgment is the Layer-2 LLM-judge axis.

### Sanity (do-not-touch confirmation)
- `apps/studio/schemas/weeklyIssue.ts` — `originStory.body`, `problemStatement.body`, `founderBio.body`, `caseStudy.body`, `bonus.body` are already `type: 'array', of: [{type: 'block'}]` (Portable Text). Sanity side accepts any block-style — h2, h3, blockquote are already valid Portable Text styles. **No Sanity schema change.** `problemStatement.pdfContent` shape unchanged (D-03).
- `apps/studio/sanity.types.ts` — re-generated only if Sanity schema changes; this phase does NOT trigger TypeGen.

### Frontend (do-not-touch confirmation)
- `apps/web/components/issue/PortableTextRenderer.tsx` (102 lines) — h2 / h3 / blockquote handlers ALREADY exist and render correctly (Phase 10). **No frontend code change.** Phase 18 activates dead code by emitting the markers writers currently omit.
- `apps/web/components/issue/EditorialSection.tsx` — no change.
- `apps/web/lib/sanity/queries.ts` — `QUERY_ISSUE_BY_SLUG` already projects the full body Portable Text. **No GROQ change.**

### Convex (do-not-touch confirmation)
- `convex/schema.ts` — `qaCorrections.axis` is `v.string()` (permissive). New `"structural-variety"` axis value flows through without a schema change.
- No Convex query / mutation modification.

### Tripwires that MUST stay green (Phase 18 zero-regression contract)
- `apps/web/__tests__/deliberation-no-model-names.test.ts` (DEL-04)
- `apps/web/__tests__/game-sandbox.test.ts` (Phase 7)
- `apps/web/__tests__/issue-page-typography.test.ts` (Phase 10 — DES-01..DES-06 visual regression)
- `apps/web/__tests__/deliberation-conversation.test.ts` (Phase 13)
- `apps/web/__tests__/podcast-slot.test.ts` (Phase 13)
- `apps/web/__tests__/theme-aa-tones.test.ts` (Phase 14)
- `apps/web/__tests__/shop-page.test.ts` (Phase 15)
- `apps/web/__tests__/narrator-chip.test.ts` (Phase 16)
- Phase 8 commerce sentinel suite (29 tests)
- Pipeline pytest suite ≥ 190 (Phase 16 baseline = 168 + Phase 16-19 added; planner re-asserts the count after Phase 18 RED-first scaffold lands)
- Web vitest baseline ≥ 234 (Phase 16 baseline preserved)
- `packages/pipeline/tests/test_section_writer_voice_propagation.py` (Phase 16 NRR-04 narrator-voice byte-equivalence — must stay green; the body-shape change doesn't affect system message wording)
- `packages/pipeline/tests/test_voice.py` (Phase 16 NRR-10 `assemble_voice` byte-equivalence)

### Cost budget (per ROADMAP success criterion 7)
- ≤15% per writer call cost increase from baseline. The STRUCTURE_CONTRACT is a small ≤120-word addition to each writer's system prompt; structural retry-once on Pydantic validator failure adds at most one extra call per writer per run. Planner asserts at execution time via `state['cost_per_agent']` snapshot diff.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lib/portable_text.py::text_to_portable_text`** — current 40-line helper. The new block builders (`block_paragraph`, `block_h2`, `block_h3`, `block_blockquote`) live next to it and follow the same `_type: 'block'` + `_key: f'block-{uuid.uuid4().hex[:8]}'` + `markDefs: []` + single-span pattern. Reuse the UUID-key convention verbatim — Sanity Studio renders blank for blocks with duplicate `_key`s.
- **Existing Pydantic + retry-once-then-fail path** (`lib/openrouter_client.py::acomplete` + Phase 5 D-14) — the same lane that catches malformed JSON catches the structural-floor `ValueError`. Phase 18 reuses; no new wrapper.
- **`build_section_writer_prompt`** (`lib/voice.py:190`) — already accepts `section_guidance: str`. STRUCTURE_CONTRACT addendum drops in without touching the helper signature.
- **`@agent_node` decorator** (`agents/_wrapper.py`) — already catches the second-fail exception and sets `pipelineRuns.status='failed'`. Phase 18 reuses; no new error handling.
- **Phase 10 `PortableTextRenderer.tsx` h2/h3/blockquote primitives** — render-correct, dead-coded. Phase 18's deliverable is "make them light up at the live URL".
- **Phase 5 `qa/judge.py` LLM-judge structured output pattern** — `JudgeFinding.axis` is a `Literal` union; adding `"structural-variety"` is a one-token diff. Single Opus call per Phase 5 D-03 preserved.
- **`agents/bonus.py` three-branch pattern** — already routes on `style_brief["bonusType"]`. Adding the structural validator to ONLY `SpecAdBonus` (D-04) is a one-class diff; the existing branching code stays unchanged.

### Established Patterns
- **Discriminated unions in Pydantic for typed writer output** (Phase 13 chronicler turns: `{"speaker": Literal[...], "text": str}` per turn) — Phase 18 uses the same pattern for `BodyBlock`.
- **Pydantic `@field_validator` for writer-side guards** (Phase 5 D-14, established) — Phase 18's `_enforce_structural_floor` is a clean instance.
- **Per-writer Pydantic schema isolation** — each writer owns its response model; the cross-cutting `BodyBlock` union lives once in `graph/state.py` (or a sibling `graph/blocks.py`) and is imported by each writer.
- **Single source-of-truth helpers** (`lib/voice.py`, `lib/portable_text.py`, `lib/llm_config.py`) — Phase 18 extends `lib/portable_text.py`; does not create a new lib module.
- **RED-first test scaffold per phase** (Phase 5 / 6 / 7 / 12 / 13 / 16 pattern) — Phase 18 ships test files BEFORE production code; ROADMAP stub names three files; planner consolidates if cleaner.
- **Contract change first, code change second** (CLAUDE.md hard rule, repeatedly honored Phase 4 / 13 / 16) — Phase 18 amends `docs/API_CONTRACTS.md §7 + §2.2 + §2.4` in Plan 18-01 before any writer change.

### Integration Points
- **Writers → Pydantic discriminated union** — every writer imports `BodyBlock` (and its constituent `Paragraph`/`Heading`/`Blockquote`) from a single module.
- **Pipeline → Sanity write** — `compose_section_body(body_blocks)` replaces `text_to_portable_text(body_str)` at every write site for the 5 long-read sections. Audit `lib/sanity_client.py` + any direct caller in `agents/*.py`.
- **QA judge → rubric** — `rubric.md` is the version-controlled prompt; `JudgeFinding.axis` is the schema gate. Both ship together.
- **Tests → fixture body shapes** — existing per-agent fixtures in `stubs/fixtures.py` may need updating to produce conforming `list[BodyBlock]` payloads (the stub-mode pipeline must still pass the structural floor; otherwise stub mode fails the new tests). Planner confirms.

### Constraints inherited from the codebase
- No new npm dependency, no CDN, no new font.
- No new Convex query / mutation.
- No new Sanity schema field.
- Frontend `PortableTextRenderer.tsx` byte-unchanged.
- `theme.ts` validation + `FONT_WHITELIST` + game-sandbox security untouched.
- Phase 16 narrator system: the structural rule is narrator-agnostic (lives in `section_guidance`, not `voice_constraints`). Confirmed Maya / Herzog / Sorkin samples do not require a different structural floor.
- Cost per writer call ≤15% over baseline (D-02 retry-once adds ≤1 extra call per writer per run).

</code_context>

<specifics>
## Specific Ideas

- **The wall-of-text problem is concentrated in `body: str` → `text_to_portable_text()` → single-style emission.** Phase 18 attacks the choke point at the writer Pydantic layer, not at the frontend; the frontend has been right since Phase 10. The shortest path to fixing the user complaint runs through the agents, not the renderer.
- **Pydantic validator > QA-only enforcement.** Once the validator is on, the writer cannot ship a flat body; it retries once with the error appended to its prompt, then fails the run. QA's `structural-variety` axis is the craft critic, not the structural gate.
- **`pdfContent` divergence is intentional.** The PDF is a download/print artifact; sub-heads in PDF body would require Phase 6 WeasyPrint template changes. The web body and the PDF body now serve different reading modes — that's correct.
- **`bigBudget` storyboards are already "the only inline visual asset on any long-read"** (UI review Pillar 2 verbatim). Forcing additional sub-heads on bigBudget body would be redundant; the visual variety is there. specAd is the gap.
- **Narrator interaction is conceptually clean.** Sub-heads + pull-quotes are typographic register, not voice register. Maya's "Icon behavior." one-liner becomes a candidate pull-quote in her voice; Herzog's "one of the few genuinely sane responses to the modern condition I have observed" becomes a candidate in his voice. The structural floor is universal; the writing style is per-narrator. Both layers compose.
- **The audit baseline `10-UI-REVIEW.md` is the verification target.** Re-run the same per-section break count after Phase 18 ships; counts in the h2 / blockquote columns must be `>= 2` and `>= 1` respectively for all 5 long-reads. The same shell that produced the original numbers (Pillar 2 table) is the regression detector.
- **No new component, no new CSS utility, no new GROQ projection, no new Sanity field, no new Convex axis enum.** This is a pipeline-side phase that activates already-shipped frontend primitives.

</specifics>

<deferred>
## Deferred Ideas

- **`StatRow` component for `problemStatement.pdfContent.keyDataPoints`** (UI-REVIEW Fix #2) — render the latent stat trio on the page; lift `keyDataPoints` into the GROQ projection (currently projected to PDF only). Belongs in a follow-on web-side phase.
- **Per-section `.lede` paragraph styling** (UI-REVIEW Fix #3) — every section gets a larger, lighter first paragraph; only Origin Story keeps the drop cap. CSS-only + 1 line in `PortableTextRenderer`; follow-on phase.
- **Sticky SectionNavigator on `≥1024px`** (UI-REVIEW Fix #5) — `position: sticky` + container restructure; orthogonal to Phase 18.
- **Empty CaseStudy metadata-block bug** (UI-REVIEW Pillar 6, `apps/web/components/issue/CaseStudySection.tsx:55`) — one-line `subjectName?.trim() && ...` guard; file as a quick task (`/gsd:quick`), don't bundle into Phase 18.
- **End-of-section "next: THE PROBLEM →" link** (UI-REVIEW Pillar 6) — reading aid; orthogonal to body-shape change.
- **Visible scroll-progress bar** (UI-REVIEW Pillar 6) — `--color-primary` solid + 4px; CSS-only.
- **`FigureWithCaption` component** for mid-section portraits inside FounderBio / CaseStudy (UI-REVIEW Pillar 2 Fix recommendation 3) — requires a new schema field per section (`figures: list[{assetUrl, caption, position}]`); pipeline-side asset acquisition + Sanity schema change; out of scope.
- **`bigBudget` + `jingle` structural enforcement** (D-04 rejection) — revisit only if a future audit measures these branches as walls (current evidence: 287w bonus body is sub-threshold).
- **Narrator override of the structural floor** — revisit only if a future narrator demands a different typographic register (current evidence: Maya / Herzog / Sorkin samples all read fine with sub-heads).
- **`pdfContent` structural body** (D-03 rejection) — revisit only if Phase 6 PDF gets a serious editorial pass and the print artifact needs sub-heads.
- **Layer-1 deterministic regex predicate for body-block counts** — rejected because Layer-1 operates on `body: str` not on Portable Text blocks; the Pydantic validator covers this lane cleanly.
- **New `deliberationEvents.eventType` for structural-retry visibility** — rejected because the existing `acomplete` retry mechanism already logs to its own surface; one more event type for Andrew to filter is noise.
- **Body-shape migration for chronicler conversation turns** — turns are already structured (`speaker`, `text`); structural-variety is meaningless for a chat thread.

### Reviewed Todos (not folded)

None — `gsd-tools todo match-phase 18` returned 0 matches.

</deferred>

---

*Phase: 18-magazine-editorial-layout-writers*
*Context gathered: 2026-05-30 via discuss-phase (interactive — 2 areas discussed, 3 Claude's Discretion items)*
