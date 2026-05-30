# Phase 18: Magazine Editorial Layout — Writer Structure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 18-magazine-editorial-layout-writers
**Areas discussed:** Emission mechanism, QA enforcement scope

---

## Gray-Area Selection

**Question:** Which gray areas do you want to discuss for Phase 18?

| Option | Description | Selected |
|--------|-------------|----------|
| Emission mechanism — how writers produce h2/blockquote | Option A: writers emit body as plain str with Markdown-ish markers (## sub-head, > quote) → text_to_portable_text() parses. Option B: writers emit a structured body: list[dict] (h2/blockquote blocks already shaped) — Pydantic-validated. Option C: writers emit body + separate sub_headers[]/pull_quote str fields, helper merges. Tradeoff: A is minimal-touch but fragile; B is strict but changes SectionContent shape; C is explicit but inflates the contract. | ✓ |
| QA enforcement scope — which sections get the structural axis | ROADMAP lists 5 sections (OriginStory, Problem, FounderBio, CaseStudy, Bonus). But Bonus has 3 branches (bigBudget storyboards, jingle lyrics, specAd body-only). Question: does the structural contract apply to all 3 Bonus branches, or only specAd (the prose branch)? Sub-question: does it apply to Bonus at all (Bonus voice already differs from the 4 narrative writers and uses VOICE_CONSTRAINTS directly — not narrator-aware). | ✓ |
| Failure mode — what happens when writer emits 0 h2/0 blockquote | Per Phase 5 D-04, QA never blocks the draft. Two options: (X) QA writes severity='error' qaCorrections row, draft ships with the wall-of-prose for Andrew to fix manually in Studio (existing pattern); (Y) introduce a one-shot writer retry: structural-failure → re-prompt with explicit count requirement → if second fail, fall through to severity='error' (raises per-run cost but recovers structure). Per-section retry was explicitly rejected in Phase 5 D-04. | |
| Sub-head + pull-quote authorship: writer-only vs. post-process extractor | Option P: writer agents are responsible for emitting sub-heads + lifting pull-quote, prompt does the work (one LLM call, but writer must pick the right quotable line). Option Q: writer emits flat prose; a small post-process pass (cheap Haiku call or deterministic 'longest one-sentence paragraph' rule) inserts the sub-heads + pull-quote (two passes per section, more deterministic but adds cost + a new agent surface). Option R: hybrid — writer emits sub-heads, post-process extractor picks pull-quote (cheapest mix; quotable line is mechanical). | |

**User's choice:** Emission mechanism + QA enforcement scope. The other two were absorbed into the discussion via D-02 (failure mode → Pydantic retry-once-then-fail, the established Phase 5 path) and D-01 (authorship → writer-only since it emits the typed blocks directly).

---

## Area 1: Emission mechanism

### Q1: How should the 5 writers communicate h2 + blockquote structure?

| Option | Description | Selected |
|--------|-------------|----------|
| B: Pydantic body = list of typed blocks (Recommended) | Writer Pydantic schema changes: body: list[BodyBlock] where BodyBlock = Paragraph \| Heading \| Blockquote. Pipeline calls block_paragraph/block_h2/block_blockquote helpers in lib/portable_text.py to serialize directly to Portable Text. Strict & validated at Pydantic layer; per-block count assertions are trivial; SectionContent.body type changes from str to list — a contract change requiring docs/API_CONTRACTS.md update (CLAUDE.md hard rule). | ✓ |
| A: writer emits Markdown-ish str, parser splits | Writer keeps body: str; uses '## sub-head\n' + '> quote\n' inline markers. text_to_portable_text() extended to recognize and emit h2/blockquote blocks based on line prefix. Smallest contract surface (no API_CONTRACTS change); fragile to model drift (LLM might use '##' inside prose); requires regex defense against false positives. | |
| C: separate fields — body str + subHeaders[] + pullQuote | Writer Pydantic gains body: str + sub_headers: list[{after_paragraph: int, text: str}] + pull_quote: {after_paragraph: int, text: str}. A merge step in lib/portable_text.py interleaves them into Portable Text. Explicit but inflates the contract; merge logic adds a code surface; mismatched after_paragraph indices = silent positioning bugs. | |

**User's choice:** B — Pydantic typed body blocks.
**Notes:** Locked as D-01 in CONTEXT.md. Contract change to `docs/API_CONTRACTS.md §7` (DispatchState `SectionContent.body` type) ships in Plan 18-01 per CLAUDE.md hard rule.

---

### Q2: Where should the structural count constraint (≥2 h2 + ≥1 blockquote) be enforced?

| Option | Description | Selected |
|--------|-------------|----------|
| Pydantic field_validator on the writer schema (Recommended) | Writer's OriginStoryOutput / ProblemOutput / etc. include a @field_validator on body that counts heading + blockquote blocks. LLM output that fails the count triggers the existing Phase 5 retry-once-then-fail path in openrouter_client.acomplete (already established for malformed Pydantic). Catches violations at parse time, before reaching QA. QA judge layer still gets an axis for cross-section consistency. | ✓ |
| QA judge layer only (no Pydantic validation) | Body shape passes any list of blocks. The new QA structural axis (Plan 18-03 in ROADMAP stub) is the only gate. Failure produces severity='error' qaCorrections row; draft ships with the wall (per D-04 — QA never blocks). Cheaper (no LLM retry on structural failure), but the wall ships. | |
| Both — Pydantic for structural floor + QA judge for quality | Pydantic guarantees the counts; QA judge evaluates 'are these sub-heads good and Jesse-voice' qualitatively. Most defensive (matches Phase 5's two-layer QA pattern); adds modest cost (retry-on-fail) but ensures the live page never ships with the wall. | |

**User's choice:** Pydantic field_validator.
**Notes:** Locked as D-02 in CONTEXT.md. Uses existing Phase 5 `acomplete` retry-once-then-fail lane (Phase 5 D-14). NOTE: D-05 in CONTEXT.md still adds a *qualitative* QA axis on top — the discussion clarified Pydantic catches **counts**, QA judge catches **craft** (short, Jesse-voice sub-heads vs. generic labels). So effectively this is "Both", but with the clear separation: Pydantic = count gate, QA = quality grade. Recorded explicitly in D-02 + D-05.

---

### Q3: Does ProblemWriter's `pdfContent` (the Phase 6 WeasyPrint template input) also need the structural body, or stays flat?

| Option | Description | Selected |
|--------|-------------|----------|
| pdfContent stays flat (Recommended) | ProblemWriter.body becomes list[BodyBlock] for Sanity / page render; pdfContent keeps its current shape (problemStatement ≤150w + keyDataPoints[3] + interventionMechanism ≤100w). Phase 6 WeasyPrint template input is unaffected; PDF stays single-column prose. Cleanest scope boundary; PDF and web diverge intentionally. | ✓ |
| pdfContent gets sub-heads too | Both web body AND PDF body get the structural treatment. Requires Phase 6 WeasyPrint template update (font sizes for sub-heads in print, blockquote treatment). Scope grows; benefits a print artifact that ships separately. | |

**User's choice:** pdfContent stays flat.
**Notes:** Locked as D-03 in CONTEXT.md. Scope boundary stays clean; Phase 6 WeasyPrint template unaffected.

---

## Area 2: QA enforcement scope

### Q4: Which Bonus branches get the structural contract (≥2 h2 + ≥1 blockquote)?

| Option | Description | Selected |
|--------|-------------|----------|
| specAd only (Recommended) | Only the specAd branch (pure 200-400w prose body) gets structural enforcement — it's the branch that looks like a long-read. bigBudget keeps its current shape (headline + body + storyboards[] — storyboards already break up the visual rhythm); jingle keeps its shape (headline + body + lyrics + sunoPrompt — lyrics already provide visual variation). Matches the ROADMAP success criterion intent (the wall-of-text problem) without forcing structure where the existing shape already provides it. | ✓ |
| All 3 Bonus branches | specAd + bigBudget + jingle all get structural enforcement on their `body` field. Consistent rule across the agent; but bigBudget storyboards already provide visual breaks (the screenshot Pillar 2 audit even notes 'storyboards as the only inline visual asset on any long-read'), and jingle body is short-form intro to the lyrics block. Forcing sub-heads on a 100-200w jingle intro feels mechanical. | |
| Drop Bonus entirely from this phase | Only the 4 narrative writers (OriginStory, Problem, FounderBio, CaseStudy) get the contract. Bonus is the variant section that breaks the 'long-read' pattern; the UI review screenshot's Bonus body was only 287 words (well below the wall-of-text threshold). Smaller scope; matches the audit's actual evidence; one less branch surface in the writers refactor. Roadmap goal mentions Bonus but only the 4 narrative writers carry the wall-of-text severity. | |

**User's choice:** specAd only.
**Notes:** Locked as D-04 in CONTEXT.md. `_build_spec_ad_prompt` + `SpecAdBonus` Pydantic get the validator + STRUCTURE_CONTRACT; bigBudget + jingle branches unchanged.

---

### Q5: If Pydantic validator catches missing structure first (D-02), what does the QA judge add for structure?

| Option | Description | Selected |
|--------|-------------|----------|
| QA judges sub-head + pull-quote QUALITY (Recommended) | Pydantic guarantees the counts are met; QA judge evaluates whether the sub-heads are short (≤6 words), Jesse-voice, and actually break the body into logical movements — not generic labels like 'Background' / 'Conclusion'. Pull-quote evaluated as: is it actually a quotable line lifted from body prose, or a generic restatement. Adds qualitative axis ('structural-variety' or similar) to rubric.md. | ✓ |
| QA structural axis is a backstop only | QA's structural rule mirrors Pydantic's count check (≥2 h2 + ≥1 blockquote). Redundant guard in case writer Pydantic is ever bypassed (e.g., manual draft, stub-mode test fixtures). Doesn't judge quality, just count. Simpler rule; layered defense matches Phase 5 D-01 philosophy. | |
| Skip the QA structural axis | Pydantic is the only gate; rubric.md not extended. Cheaper (no rubric grow + judge cost); the writer can't physically emit a non-conforming draft (retry-once-then-fail). Quality of sub-head wording is the writer-prompt's job, not QA's. | |

**User's choice:** QA judges quality.
**Notes:** Locked as D-05 in CONTEXT.md. `rubric.md` extends with a `structural-variety` axis; `JudgeFinding.axis` `Literal` adds `"structural-variety"`; severity='warning' (Pydantic is the hard gate, QA grades craft).

---

## Wrap-Up

### Q6: We've discussed Emission mechanism + QA enforcement scope. Which remaining gray areas (if any) do you want to explore before writing the CONTEXT.md?

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context (Recommended) | Lock in D-01..D-05 above. The 'Failure mode' gray area was answered by D-02 (Pydantic retry-once-then-fail is the existing Phase 5 path). The 'Sub-head + pull-quote authorship' gray area was answered by D-01 (writer emits the typed blocks directly — no post-process extractor). Narrator interaction stays narrator-agnostic per Phase 16 D-05/D-06 (the structural rule lives in section_guidance, not in voice). Researcher + planner have enough to act. | ✓ |
| Failure mode — expand the retry/fallback behavior | Should the Pydantic retry-once-then-fail path (D-02) emit a specific deliberationEvent type so Andrew sees structural-failure runs distinctly from voice failures? E.g., new event 'writer-structural-retry'. | |
| Narrator interaction — confirm structure is narrator-agnostic | Maya/Herzog/Sorkin samples may use sub-heads differently. Worth discussing whether a narrator's voiceConstraints can override the structural floor, or if ≥2 h2 + ≥1 blockquote is universal. | |
| Test scaffold layout — RED-first test file design | ROADMAP stub mentions test_writer_emits_h2_sub_headers.py / test_writer_emits_blockquote.py / test_qa_rejects_flat_paragraph_wall.py. Worth deciding whether to consolidate or keep separate (this is normally planner discretion, but you may have a preference). | |

**User's choice:** Ready for context.

---

## Claude's Discretion

Areas the user deferred to Claude:
- `compose_section_body` module placement (recommend `lib/portable_text.py`)
- Pydantic discriminator pattern (`Annotated[Union[...], Field(discriminator='type')]`)
- Test scaffold consolidation vs. three separate files (planner picks)
- STRUCTURE_CONTRACT exact wording (≤120 words)
- `text_to_portable_text` deprecation policy (recommend keep with docstring)
- Per-writer h2-vs-h3 hierarchy preference (recommend h2 default)
- Negative test for bigBudget/jingle "no structural floor" (recommend yes)
- `structural-variety` axis description wording in `rubric.md`

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section. Top items:
- UI-REVIEW Fix #2 (`StatRow` for `keyDataPoints`) — follow-on web phase
- UI-REVIEW Fix #3 (per-section `.lede` paragraph styling) — follow-on web phase
- UI-REVIEW Fix #5 (sticky SectionNavigator) — orthogonal
- Empty CaseStudy metadata-block bug — `/gsd:quick` task
- `bigBudget` + `jingle` structural enforcement — revisit if future audit measures them as walls
- Narrator override of structural floor — revisit if a narrator demands a different register
- `pdfContent` structural body — revisit if Phase 6 PDF gets a serious editorial pass
- New `deliberationEvents.eventType` for structural-retry visibility — noise; existing logging suffices
