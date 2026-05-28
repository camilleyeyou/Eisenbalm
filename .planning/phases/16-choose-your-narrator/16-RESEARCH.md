# Phase 16: Choose Your Narrator — Research

**Researched:** 2026-05-28
**Domain:** Per-issue editorial voice variation — Python voice assembly, LangGraph state extension, Sanity schema addition, QA rubric per-run loading, frontend chip surfacing
**Confidence:** HIGH (all findings are code-verified against the actual codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01**: Two-tier voice surface. `UNIVERSAL_CORE` (non-overridable) + `PERSONA_BLOCK` (narrator-controlled register). No wholesale replace, no per-profile inherit flag.
- **D-02**: `UNIVERSAL_CORE` contains exactly: (1) No AI references / Jesse-born-AI rule (DEL-04), (2) Fortune-500 gravity for charities/founders, (3) Forbidden sentimentality words (existing Jesse list plus forbidden adjectives-as-compliments and passive hedging), (4) No exclamation marks.
- **D-03**: `PERSONA_BLOCK` is what each `narratorProfile.voiceConstraints` provides — narrator-specific register, cadence, gestures.
- **D-04**: WINNER AUTHORITY rule (Phase 13 chronicler system prompt rule 7) is universal — lives in `UNIVERSAL_CORE` or in a chronicler-specific preamble.
- **D-05**: Single injection point — the Calibrator. Only Calibrator reads `state['narrator']`. Assembles `UNIVERSAL_CORE + "\n\n" + persona_block` → `style_brief["voice"]`. Downstream writers and Chronicler stay surface-stable.
- **D-06**: `style_brief["voice"]` shape stays a single string. Byte-equivalent guarantee: `assemble_voice(None)` MUST equal exactly the current `VOICE_CONSTRAINTS` string.
- **D-07**: `lib/voice.py` exposes `UNIVERSAL_CORE: str`, `JESSE_PERSONA_BLOCK: str`, `VOICE_CONSTRAINTS: str` (literal concatenation, preserved for back-compat), and `assemble_voice(narrator: NarratorProfile | None) -> str`. Game agent preserves its direct `VOICE_CONSTRAINTS` import — untouched.
- **D-08**: `narratorProfile` Sanity document type at `apps/studio/schemas/narratorProfile.ts`. Fields: `name` (string, required), `slug` (slug, required, source=name, maxLength=96), `voiceConstraints` (text, rows=8, required), `voiceRubric` (text, rows=8, required), `exampleSamples` (array of text blocks, min 1 max 5), `active` (boolean, default true).
- **D-09**: `weeklyIssue.narrator` is an optional `reference` to `narratorProfile`. Absence = null = default Jesse.
- **D-10**: Seeded `jesse` narratorProfile. `voiceConstraints` field = `JESSE_PERSONA_BLOCK` content verbatim. Seed script runs sentinel assertion: `assert seeded_jesse.voiceConstraints.strip() == JESSE_PERSONA_BLOCK.strip()`.
- **D-11**: Seeded `maya-rudolph` + `werner-herzog` narratorProfiles = verbatim client-supplied sample tables.
- **D-12**: `exampleSamples` count: 3 samples × ~150 words each as seed default. Plain strings (NOT Portable Text). ~600 tokens/narrator × 1 narrator-per-run = ≤10% cost delta budget.
- **D-13**: `narrator: null` and `narrator: jesse-explicit-ref` are byte-equivalent by construction. Testable invariant.
- **D-14**: Inactive narrator (`active: false`) falls back to Jesse + logs non-blocking Convex warning via existing `editor-decision` eventType. No new Convex schema change.
- **D-15**: Narrator mid-draft swap handled by Sanity revision history — no pipeline behavior needed.
- **D-16**: Studio dropdown defaults to "no selection" (= null = Jesse default).
- **D-17**: Chip copy = "Narrated by {narrator.name}" when narrator is set AND name ≠ "Jesse Eisenbalm". No chip when null OR Jesse default.
- **D-18**: Chip is non-interactive in this phase. No `/narrators/[slug]` route (deferred).
- **D-19**: Chip placement: under issue title on `IssueHero`, above publish date line. `--color-text-mute` + Inter uppercase 0.18em (Phase 12 MED-04 machine-readout label convention).
- **D-20**: Deliberation chat thread unchanged — no new chip in chat thread. Masthead chip is sufficient.

### Claude's Discretion

- Exact `narratorProfile.narrator` field placement on `weeklyIssue` (under `pipelineMetadata` group or top-level).
- Whether `assemble_voice` helper lives in `lib/voice.py` or a new `lib/narrator.py` module. Leaning `lib/voice.py`.
- How QA `rubric.md` per-run load is implemented (template with placeholder vs. multi-file).
- Exact chip CSS/Tailwind classes (must use Phase 14 light tokens + machine-readout convention).
- Whether seed sentinel assertion lives in seed script or in startup check; planner picks.
- Exact `pipelineRuns` warning event payload shape for D-14 (must use existing eventType union; no new Convex schema change).
- Whether tests parametrize byte-equality assertion (D-13) per-narrator or just Jesse.

### Deferred Ideas (OUT OF SCOPE)

- `/narrators/[slug]` route + narrator profile page
- Archive filter by narrator
- Reader-side narrator pick
- Game / Bonus / Researcher narrator-awareness
- Narrator change-history audit log on `weeklyIssue`
- Hot-swap narrator mid-pipeline

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NRR-01 | New Sanity `narratorProfile` document type (name, slug, voiceConstraints, voiceRubric, exampleSamples, active) | Section B: Sanity Schema Addition |
| NRR-02 | `weeklyIssue.narrator` optional reference. Absence = Jesse default | Section B: weeklyIssue Extension |
| NRR-03 | Calibrator reads `state['narrator']`, merges into StyleBrief; unset = byte-equivalent Jesse | Section A: Byte-Equivalence + Section C: Calibrator Wiring |
| NRR-04 | Four narrative writer agents become narrator-aware via StyleBrief; no direct change to writer bodies | Section C: Zero-Change Surface |
| NRR-05 | Chronicler reads narrator voice via `style_brief["voice"]` (consumer surface stable) | Section F: Chronicler Pattern |
| NRR-06 | QA rubric becomes narrator-aware; `voiceRubric` + `exampleSamples` injected at call time | Section D: QA Rubric Architecture |
| NRR-07 | Studio narrator picker with preview of `exampleSamples` | Section B: Studio UX |
| NRR-08 | Frontend narrator chip under masthead when set; no chip when unset | Section I: Frontend Chip |
| NRR-09 | Three seeded `narratorProfile` documents (jesse, maya-rudolph, werner-herzog) + seed pattern for more | Section B: Seed Pattern |
| NRR-10 | Zero-regression: existing tripwires green + 168-passing pytest green + byte-equivalence when unset | Section A: Byte-Equivalence + Validation Architecture |

</phase_requirements>

---

## Summary

Phase 16 adds per-issue narrator selection by making a single injection point in `calibrator.py` narrator-aware. The codebase is already structured for this: `lib/voice.py::build_section_writer_prompt` accepts a `voice_constraints` override kwarg, `calibrator.py` already sets `style_brief["voice"]`, and all four narrative writers already consume that string without knowing where it came from. The chronicler imports `VOICE_CONSTRAINTS` directly today but can trivially shift to reading `state['style_brief']['voice']` instead. The QA judge loads `rubric.md` at import time today — changing that to per-call load and appending narrator-specific content is a 10-line change.

The biggest risk is **byte-equivalence under the null-narrator path**. `VOICE_CONSTRAINTS` in `lib/voice.py` is a multi-line string literal assembled with Python string concatenation and explicit `\n` characters. The `UNIVERSAL_CORE + "\n\n" + JESSE_PERSONA_BLOCK` expression must produce exactly the same string. This is testable and must be locked as an import-time assertion AND as a pytest invariant.

The second risk is the **QA rubric architecture choice**. The current single-file `rubric.md` approach is clean. The recommended pattern for Phase 16 is to keep `rubric.md` as the universal foundation and build the final per-call rubric string in code by appending `narrator.voiceRubric` + `narrator.exampleSamples` as few-shot anchors. This avoids file-system proliferation while keeping rubric.md Andrew-editable.

**Primary recommendation:** Keep all changes in `lib/voice.py` (two-tier split + `assemble_voice`) and `calibrator.py` (single rewire). Every other agent is a zero-change surface. The chronicler shifts from `VOICE_CONSTRAINTS` direct import to `state['style_brief']['voice']` consumption — a 2-line change in `_build_system_prompt`. QA judge converts `_RUBRIC_PATH` from import-time to call-time load with narrator appendage.

---

## Standard Stack

### Core (already present — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `lib/voice.py` | existing | Single source for voice constants | Already the Phase 5 canonical module |
| `calibrator.py` | existing | Single injection point | D-05 locked decision |
| `@sanity/client` | existing | Sanity schema + GROQ reads | Already used throughout |
| `pydantic` | existing | NarratorProfile model for type safety | Already used for all agent outputs |
| Vitest | existing | Frontend tripwire tests | Already configured |
| pytest | existing | Pipeline regression tests | Already configured |

### No New Dependencies
Per D-07 / CONTEXT.md locked constraint: no new npm dependency, no CDN, no new font. All changes are additive within the existing stack.

---

## Architecture Patterns

### Recommended Project Structure (additions only)

```
packages/pipeline/src/eisenbalm_pipeline/
├── lib/
│   └── voice.py            # ADD: UNIVERSAL_CORE, JESSE_PERSONA_BLOCK, assemble_voice()
│                           # KEEP: VOICE_CONSTRAINTS (literal concat) + build_section_writer_prompt
├── agents/
│   └── calibrator.py       # CHANGE: assemble_voice(state.get("narrator")) at line 158/182
│   └── chronicler.py       # CHANGE: consume style_brief["voice"] instead of VOICE_CONSTRAINTS direct
│   └── qa/
│       ├── judge.py         # CHANGE: per-call rubric load with narrator appendage
│       └── rubric.md        # KEEP: universal axes unchanged; persona block becomes narrator-provided
├── graph/
│   └── state.py            # CHANGE: add narrator: Optional[NarratorProfile]
│
apps/studio/
├── schemas/
│   ├── narratorProfile.ts   # NEW
│   ├── weeklyIssue.ts       # CHANGE: add narrator optional reference field
│   └── index.ts             # CHANGE: register narratorProfile
├── scripts/
│   ├── seed-agents.ts       # UNCHANGED
│   └── seed-narrators.ts    # NEW (idempotent, mirrors seed-agents.ts)
│
apps/web/
├── lib/sanity/
│   ├── queries.ts           # CHANGE: extend QUERY_ISSUE_BY_SLUG with narrator->{}
│   └── types.ts             # CHANGE: add IssueNarrator type, Issue.narrator field
├── components/issue/
│   ├── IssueHero.tsx        # CHANGE: add narrator chip slot
│   └── DeliberationSlot.tsx # UNCHANGED (D-20)
└── __tests__/
    └── narrator-chip.test.ts # NEW tripwire
```

---

## Section A: Byte-Equivalence — The Critical Invariant

### The VOICE_CONSTRAINTS string as it exists today

From `lib/voice.py` (verified by direct file read), `VOICE_CONSTRAINTS` is a single Python string literal assembled via implicit concatenation of adjacent string literals (no explicit `+` operator visible, but effectively a multi-line constant). The exact structure is:

```
"Jesse Eisenbalm voice. Dry, precise, absurdly serious. No winking. "
"No irony signaling. The brand does not pivot to AI.\n"
"Treat every charity...\n"
...
```

The string uses explicit `\n` to end lines and implicit space-before-`\n` for sentences that continue from the same paragraph.

### How to split without breaking byte-equivalence

The split into `UNIVERSAL_CORE + "\n\n" + JESSE_PERSONA_BLOCK` must produce **exactly the same bytes** as the current `VOICE_CONSTRAINTS` string.

**Pitfall A-1 (confirmed HIGH risk):** The join separator between `UNIVERSAL_CORE` and `JESSE_PERSONA_BLOCK` must match the natural separator in the original string. If the current string has a single `\n` between rule blocks, the separator must be `"\n"`, not `"\n\n"`. If it has no separator (they flow together), the separator is `""`. **This must be verified by inspecting the exact string character-by-character, not by reading the source file visually.**

**Pitfall A-2:** Python string literal whitespace is invisible. A trailing space before `\n` in the original that gets omitted in the split will break byte-equivalence. The safest approach is to define:

```python
VOICE_CONSTRAINTS = UNIVERSAL_CORE + "\n\n" + JESSE_PERSONA_BLOCK
```

...and then verify this equals the original constant using an import-time assertion:

```python
_ORIGINAL_VOICE_CONSTRAINTS = (
    "Jesse Eisenbalm voice. Dry, precise, absurdly serious. No winking. "
    "No irony signaling. The brand does not pivot to AI.\n"
    # ... all lines verbatim ...
)
assert VOICE_CONSTRAINTS == _ORIGINAL_VOICE_CONSTRAINTS, (
    "VOICE_CONSTRAINTS does not equal the original. "
    "The UNIVERSAL_CORE + JESSE_PERSONA_BLOCK split is broken."
)
```

**Recommended implementation pattern (HIGH confidence):**

1. Keep the original `VOICE_CONSTRAINTS` string as a comment reference or inline check.
2. Define `UNIVERSAL_CORE` = the four rule groups from D-02 (DEL-04, Fortune-500 gravity, forbidden words, no exclamation marks).
3. Define `JESSE_PERSONA_BLOCK` = the remaining register lines ("Dry, precise, absurdly serious. No winking. No irony signaling.").
4. Define `VOICE_CONSTRAINTS = UNIVERSAL_CORE + "\n\n" + JESSE_PERSONA_BLOCK` (or whatever separator makes the assertion pass).
5. Add an import-time `assert VOICE_CONSTRAINTS == _ORIGINAL` check in `lib/voice.py`.

**Where the assertion lives:** Both at import time (fast-fails the process on misconfiguration) AND in pytest (`test_byte_equivalence_jesse_default`). The import-time check catches the error at startup; the pytest check catches it in CI before any human runs the code.

### `assemble_voice` function signature

```python
def assemble_voice(narrator: Optional[dict]) -> str:
    """Return the assembled voice string for the given narrator.
    
    Args:
        narrator: loaded NarratorProfile dict (state['narrator']) or None.
    
    Returns:
        UNIVERSAL_CORE + "\n\n" + persona_block
        where persona_block = narrator['voiceConstraints'] if narrator and narrator.get('active')
                              else JESSE_PERSONA_BLOCK
    
    Invariant: assemble_voice(None) == VOICE_CONSTRAINTS (byte-equivalent to current Jesse).
    Invariant: assemble_voice({'voiceConstraints': JESSE_PERSONA_BLOCK, 'active': True})
               == VOICE_CONSTRAINTS
    """
```

**Note:** The function accepts a raw `dict` (the loaded Sanity document shape), not a Pydantic model. This matches how `winning_charity` flows today — as a plain `CharityCandidate`-shaped dict. If a Pydantic `NarratorProfile` model is introduced, it should be optional and the function should handle both.

---

## Section B: Sanity Schema Addition

### `narratorProfile.ts` — mirrors `agentProfile.ts` exactly

From inspecting `agentProfile.ts` (verified): it uses `defineType` / `defineField` builder pattern, `type: 'document'`, 5 fields, all with `title` + `description` + optional `validation`. The `narratorProfile.ts` follows the identical pattern.

**Key difference from `agentProfile`:** `agentProfile.agentId` is a `slug` field (to match pipeline agent IDs). `narratorProfile.slug` is also a `slug` field, but source-generated from `name`.

**`exampleSamples` field shape:**

```typescript
defineField({
  name: 'exampleSamples',
  title: 'Example Samples',
  type: 'array',
  of: [{ type: 'text' }],   // plain string, NOT 'block' (Portable Text)
  validation: Rule => Rule.min(1).max(5),
  description: 'Short prose samples proving the voice. Used in Studio preview and as QA few-shot anchors.',
})
```

Plain strings (not Portable Text) per D-12 — the chronicler turn text is plain strings; consistency matters.

### `weeklyIssue.ts` — `narrator` field placement

**Recommendation (Claude's Discretion):** Place under the `pipelineMetadata` group, immediately after `pipelineMetadata` definition. Rationale: it's an editorial configuration input that influences the pipeline run, analogous to `pipelineMetadata.runId`. This avoids scattering in the middle of content sections.

The field:

```typescript
defineField({
  name: 'narrator',
  title: 'Narrator',
  type: 'reference',
  to: [{ type: 'narratorProfile' }],
  description: 'Optional narrator profile. Leave unset for default Jesse voice. Set to override all four narrative sections + the deliberation conversation.',
})
```

The existing `selectionDeliberation.conversation[]` at lines 382–416 of `weeklyIssue.ts` is UNCHANGED (D-20 / DEL-CONV data shape remains stable).

### Seed script `seed-narrators.ts`

Mirrors `seed-agents.ts` exactly:
- Reads from `narrators.json` (same pattern as `agents.json`)
- Uses `createOrReplace` with deterministic `_id = narrator-{slug}`
- Sentinel assertion: after the jesse narrator is written, read it back and assert `voiceConstraints.trim() == JESSE_PERSONA_BLOCK.trim()`. This asserts **at seed time** that code and content haven't drifted.
- Runs via `pnpm seed:narrators` (new script in `apps/studio/package.json`)

**Pitfall B-1:** The sentinel assertion in the seed script reads `JESSE_PERSONA_BLOCK` from a Python file — but this is a TypeScript seed script. The Python constant cannot be imported into TypeScript. **Resolution:** The `narrators.json` file contains the Jesse narrator's `voiceConstraints` field. The sentinel asserts that `narrators.json` Jesse entry equals what the Python pipeline uses. This is a cross-language check. The recommended approach: run a separate Python test (`test_jesse_seed_matches_persona_block`) that imports `JESSE_PERSONA_BLOCK` from `lib/voice.py` and asserts it equals the content of `narrators.json["jesse"]["voiceConstraints"]`. This cross-language sentinel is the only robust way to catch drift.

### Studio preview affordance for `exampleSamples` (NRR-07)

Sanity's built-in array field with `type: 'text'` will render each sample as an expandable text block in Studio without additional code. Andrew sees the samples inline when editing a `narratorProfile`. For the `weeklyIssue.narrator` reference field, Sanity renders the reference as a link card showing the narrator's name. The "preview voice samples" affordance from NRR-07 is satisfied by the reference field showing the `narratorProfile` document (which has the `exampleSamples` array), accessible via the linked document. No custom Studio plugin needed.

### TypeGen flow

After adding `narratorProfile.ts` and registering it in `schemas/index.ts`:

```bash
pnpm --filter @eisenbalm/studio typegen
```

This regenerates `apps/studio/sanity.types.ts` with `NarratorProfile` and `WeeklyIssue['narrator']` types. The `@eisenbalm/shared` package re-exports Sanity types — `packages/shared/src/index.ts` already has a re-export hook for `sanity.types.ts`. No change to `packages/shared` needed if the re-export is a wildcard. If it's selective, add `NarratorProfile` to the export list.

**Pitfall B-2:** `apps/studio/sanity.types.ts` is gitignored per Phase 1 D-08. The TypeGen must be run by the executor after schema changes. The plan must include an explicit "run `pnpm typegen`" task gated behind schema edits.

---

## Section C: Calibrator Wiring — The Single Injection Point

### Current calibrator.py state (verified)

- Line 27: `from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS`
- Line 40: `voice: str = Field(default="", description="Jesse voice summary — copy from VOICE_CONSTRAINTS")`
- Lines 157-166: stub-mode fallback sets `brief_dict["voice"] = VOICE_CONSTRAINTS`
- Line 181: defensive: `if not brief_dict.get("voice"): brief_dict["voice"] = VOICE_CONSTRAINTS`

### Rewire pattern

1. Change import to: `from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, assemble_voice`
2. At stub-mode fallback (line 158): `brief_dict["voice"] = assemble_voice(state.get("narrator"))`
3. At defensive fill (line 181): `brief_dict["voice"] = assemble_voice(state.get("narrator"))`
4. Update `StyleBriefOutput.voice.description`: "Voice summary — narrator-aware; copy from assemble_voice()"

**What does NOT change in calibrator.py:**
- The `_build_messages` function still embeds `VOICE_CONSTRAINTS` verbatim in the system prompt. This is the system prompt that tells the LLM to copy the voice into the output. Since `brief_dict["voice"]` is set defensively after the LLM call (lines 181-182), the LLM's output for `voice` is overridden anyway. The safest approach: also change line 109 in `_build_messages` to use `assemble_voice(state.get("narrator", None))` so the system prompt reflects the correct narrator voice. But this is optional — the defensive override at lines 157-182 already ensures the right voice lands in `style_brief["voice"]`.

### `DispatchState` extension

Add to `graph/state.py`:

```python
# ── Phase 16 additions ────────────────────────────────────────────────────
narrator: NotRequired[Optional[dict]]   # Loaded narratorProfile dict or None
```

The type is `dict` (not a Pydantic model) to match how `winning_charity` and `style_brief` flow as plain TypedDicts. Using `NotRequired[Optional[dict]]` means existing code that doesn't set this field won't break.

**CLAUDE.md hard rule:** This field must be added to `docs/API_CONTRACTS.md §7` BEFORE any code. The plan must include an API_CONTRACTS.md update task as Wave 0 (same pattern as Phase 13 Plan 13-01).

### Inactive narrator handling (D-14)

In `calibrator.py`, after loading `state.get("narrator")`:

```python
narrator = state.get("narrator")
if narrator and not narrator.get("active", True):
    # D-14: inactive narrator — fall back to Jesse, emit warning
    await emit_warning_event(
        run_id=run_id,
        payload={"warning": f"inactive narrator {narrator.get('name', '?')} — fell back to Jesse"},
    )
    narrator = None
```

The warning event reuses the existing `editor-decision` eventType (no new Convex schema field). The `emit_warning_event` helper calls the existing Convex `deliberationEvents:insert` mutation with `eventType='editor-decision'`.

### Zero-change writer surface (NRR-04)

Verified by code inspection: `origin_story.py`, `problem.py`, `founder_bio.py`, `case_study.py` all call `build_section_writer_prompt(...)`. The function signature already accepts `voice_constraints: str = VOICE_CONSTRAINTS`. Since the Calibrator now sets `style_brief["voice"]` to the narrator-assembled string, and the writers pass `style_brief` to `build_section_writer_prompt` (extracting `style_brief.get("voice", VOICE_CONSTRAINTS)` or similar), the writers get the narrator voice automatically.

**Pitfall C-1:** Current `build_section_writer_prompt` signature uses `voice_constraints: str = VOICE_CONSTRAINTS` — the default. How do the writers pass `style_brief["voice"]` today? Looking at the signature and the writer bodies: the function takes `style_brief: dict[str, Any]` as a parameter, but the `voice_constraints` kwarg defaults to `VOICE_CONSTRAINTS`. The system prompt builds the voice block from `voice_constraints`, not from `style_brief["voice"]`. This means writers do NOT currently pass `style_brief["voice"]` to override the voice — they rely on the default.

**This is the actual wire-up needed (HIGH confidence finding):** The `build_section_writer_prompt` call sites in the four narrative writer agents need to pass `voice_constraints=style_brief.get("voice", VOICE_CONSTRAINTS)` explicitly. Otherwise the narrator voice never reaches the writers. This is a small but load-bearing change to the four writer agents (not zero-change as assumed in CONTEXT.md D-05). However, it's a single-line addition per writer, not an architectural change.

---

## Section D: QA Rubric Architecture

### Current judge.py state (verified)

```python
_RUBRIC_PATH: Path = Path(__file__).parent / "rubric.md"
# Resolved at import time — keeps the rubric load free of per-call I/O.
```

And in `run_llm_judge`:
```python
rubric = _load_rubric()
# _load_rubric reads _RUBRIC_PATH.read_text(encoding="utf-8")
```

### Recommended per-run load pattern (Claude's Discretion)

**Option 1 (Recommended): Append narrator content at call time, keep rubric.md universal**

```python
async def run_llm_judge(
    sections: dict[str, str],
    *,
    run_id: str,
    narrator: Optional[dict] = None,   # NEW parameter
) -> tuple[list[QAFinding], str]:
    rubric_core = _load_rubric()   # still loads rubric.md
    
    # Build narrator-specific extension
    if narrator and narrator.get("voiceRubric"):
        persona_rubric = narrator["voiceRubric"]
        example_block = ""
        if narrator.get("exampleSamples"):
            samples = narrator["exampleSamples"][:3]
            example_block = "\n\n## Voice Examples (few-shot anchors)\n" + "\n\n---\n\n".join(samples)
        narrator_block = f"\n\n## Narrator Register: {narrator.get('name', 'Unknown')}\n{persona_rubric}{example_block}"
        rubric = rubric_core + narrator_block
    else:
        rubric = rubric_core   # byte-equivalent Jesse default
```

**Why this is preferred over multi-file rubric.md:**
- `rubric.md` stays as the single Andrew-editable universal rubric (gravity, sentiment, irony-signaling, precision, cross-section-consistency axes).
- The Jesse persona register block currently embedded in `rubric.md` ("Jesse Voice — Dry, precise, and absurdly serious...") becomes the fallback.
- Narrator-specific register lives in `narratorProfile.voiceRubric` (Sanity-editable, no code deploy needed).
- No file-system proliferation (`rubric_jesse.md`, `rubric_core.md`, etc.).

**Option 2: Template file with `{persona_register}` placeholder** — rejected because it makes the rubric.md no longer readable as-is (Andrew sees `{persona_register}` which is confusing).

**Option 3: Move rubric content to code** — rejected because it removes Andrew's ability to edit the rubric in a text file.

### rubric.md split

The current `rubric.md` "Jesse Voice (Non-Negotiable)" section becomes the fallback for when no narrator is set. For narrator-aware runs, this section is REPLACED by the narrator's `voiceRubric`. The axes (gravity, sentiment, irony-signaling, precision, cross-section-consistency) are universal and stay in `rubric.md` unchanged.

**Pitfall D-1:** The current `rubric.md` "Jesse Voice" section includes the forbidden-words list. This list is in `UNIVERSAL_CORE` (D-02 decision). When narrator is set, the judge must still enforce the universal forbidden words. The `rubric.md` approach handles this correctly because the universal axes remain, and the `UNIVERSAL_CORE` rules are in the writers' system prompts. But the judge rubric should also include the forbidden words list as a universal section. Verify this is present in `rubric.md` under "Forbidden" (it is — confirmed by direct file read: the "Forbidden" section lists exclamation marks, sentimentality words, winking, AI self-reference, adjectives-as-compliments, passive hedging).

**Resolution:** The "Forbidden" section of `rubric.md` maps to `UNIVERSAL_CORE` rules. It stays in `rubric.md` unchanged (universal). Only the "Jesse Voice (Non-Negotiable)" prose description ("Dry, precise, and absurdly serious...") is the persona register — this is what narrator overrides. In practice: rubric.md already has the right structure. The QA judge change only needs to append the narrator's persona register block after the universal axes.

---

## Section E: LangGraph State Extension

### How `narrator` flows through the pipeline

1. **Pipeline start** (`lib/sanity_client.py`): Load `weeklyIssue.narrator` reference → dereference `narratorProfile` document → inject into `state['narrator']`. This is a new load step, parallel to how `winning_charity` is loaded. The load happens before the graph runs (at pipeline initialization, not inside a graph node).

2. **Calibrator** (inside graph): Reads `state.get("narrator")`, calls `assemble_voice(narrator)`, writes result to `style_brief["voice"]`.

3. **All downstream agents**: Consume `style_brief["voice"]` unchanged.

4. **QA judge**: Receives `narrator` as a kwarg from the QA orchestrator, which reads `state.get("narrator")`.

5. **Sanity write** (`lib/sanity_client.py`): Does NOT write narrator back to Sanity (narrator is read from Sanity, not written by pipeline — D-09 confirms this).

### Loading `narratorProfile` from Sanity

The existing `groq_query` helper in `lib/sanity_client.py` handles GROQ reads. The load pattern mirrors how `winning_charity` reference is resolved. The issue GROQ query (not the `QUERY_ISSUE_BY_SLUG` frontend query, but a pipeline-side read) needs to dereference `weeklyIssue.narrator` and load the full `narratorProfile` fields needed by the pipeline (`voiceConstraints`, `voiceRubric`, `exampleSamples`, `active`, `name`, `slug`).

```python
async def load_narrator_from_issue(issue_id: str) -> Optional[dict]:
    """Load the narrator profile for a given weeklyIssue document, or None."""
    query = (
        f'*[_type == "weeklyIssue" && _id == "{issue_id}"]'
        '[0]{ narrator->{ name, "slug": slug.current, voiceConstraints, voiceRubric, exampleSamples, active } }'
    )
    rows = await groq_query(query)
    if rows and rows[0].get("narrator"):
        return rows[0]["narrator"]
    return None
```

This is additive — the existing charity dereference pattern is already in `lib/sanity_client.py`. The narrator load is a parallel call at pipeline initialization.

### DispatchState field declaration

The field must be declared in `graph/state.py` AND in `docs/API_CONTRACTS.md §7` before any code. The plan's Wave 0 must include both as a single atomic task (API_CONTRACTS.md reconciliation gating).

```python
# ── Phase 16 additions ────────────────────────────────────────────────────
narrator: NotRequired[Optional[dict]]   # Loaded narratorProfile dict (name, slug, voiceConstraints, voiceRubric, exampleSamples, active) or None
```

Using `NotRequired` ensures the 168-passing pytest tests (which construct DispatchState-shaped dicts without `narrator`) still pass without modification.

---

## Section F: Chronicler Narrator-Awareness

### Current `chronicler.py` state (verified)

- Line 33: `from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS`
- Line 55-56: `_build_system_prompt()` uses `f"{VOICE_CONSTRAINTS}\n\n"` as the system prompt prefix

### Correct migration pattern

**The cleanest approach (recommended):** Change `_build_system_prompt()` to accept a `voice_constraints: str` parameter:

```python
def _build_system_prompt(voice_constraints: str) -> str:
    """Return the Chronicler system prompt with given voice constraints."""
    return (
        f"{voice_constraints}\n\n"
        "You are The Chronicler for The Eisenbalm Dispatch. ..."
        # ... rest unchanged ...
    )
```

In the `chronicler()` node body:
```python
voice = state.get("style_brief", {}).get("voice", VOICE_CONSTRAINTS)
system = _build_system_prompt(voice_constraints=voice)
```

This:
1. Preserves byte-equivalence: when `style_brief["voice"]` == `VOICE_CONSTRAINTS` (narrator=None), the chronicler system prompt is byte-identical to before.
2. Eliminates the direct `VOICE_CONSTRAINTS` import dependency (though keeping the import as a fallback default is safe).
3. Is the minimal change: 2 lines added to `_build_system_prompt`, 1 line changed in the node body.

**D-18 fallback compatibility:** The D-18 fallback (`return {"deliberation_conversation": None}`) is unchanged. The deterministic `_format_deliberation_transcript` in `editor.py` stays intact and is still the fallback when chronicler fails.

**WINNER AUTHORITY rule (D-04):** This rule currently lives in the chronicler system prompt (rule 7). Per D-04, it becomes universal. The cleanest placement: keep it in the chronicler system prompt as-is (it's only relevant there — narrative writers don't need it). It can optionally be added to `UNIVERSAL_CORE` where it's vacuous for writers, but that adds noise. Recommended: keep WINNER AUTHORITY in the chronicler's universal preamble (the part of the system prompt that doesn't come from `VOICE_CONSTRAINTS`). It is already there in `_build_system_prompt()` rule 7.

---

## Section G: WINNER AUTHORITY Placement

Per D-04, the WINNER AUTHORITY rule is universal. Looking at the current chronicler system prompt:

```
"7. WINNER AUTHORITY (non-negotiable): The Editor's final turn must "
"conclude that the WINNER named in the data is the selected charity..."
```

This rule is semantically meaningful only for the chronicler. For narrative section writers (origin_story, problem, founder_bio, case_study), the WINNER has already been chosen — the section writers write ABOUT the winner. Including WINNER AUTHORITY in `UNIVERSAL_CORE` would be vacuous noise in their system prompts.

**Recommendation:** WINNER AUTHORITY stays in the chronicler's hardcoded system prompt rules section (lines 74-83), NOT in `UNIVERSAL_CORE`. It is already "universal" across all narrators for the chronicler because it's in the non-narrator part of the chronicler's prompt. D-04 means "every narrator's chronicler output obeys this rule" — not "every agent sees this rule in their system prompt."

---

## Section H: Cost Budget (NRR-10 Criterion 7)

### Budget analysis

From D-12: ~600 tokens/narrator (persona block + 3 × ~150 word samples).

The narrator block adds cost in two places:
1. **Calibrator system prompt**: `assemble_voice(narrator)` adds ~600 tokens to the calibrator call. But the calibrator call is a short, fixed-cost call — this is a ~30-40% increase on the calibrator call but calibrator is a small fraction of total run cost.
2. **QA judge system prompt**: `narrator.voiceRubric` + `exampleSamples` appended to rubric.md adds ~600 tokens to the QA judge call.

For everything else (section writers, chronicler): `style_brief["voice"]` replaces the existing `VOICE_CONSTRAINTS` string. The narrator persona block (~150-200 words) vs JESSE_PERSONA_BLOCK (~80 words) is a delta of ~70-120 words per writer call = ~90-150 tokens per writer. With 4 narrative writers, that's ~360-600 tokens added across all writer calls.

**Total additional tokens per narrator run (estimate):**
- Calibrator: +600 tokens
- QA judge: +600 tokens  
- 4 writers × ~120 token delta: +480 tokens
- Chronicler: +120 token delta
Total: ~1,800 additional tokens

**Total tokens for a Jesse-default run (rough estimate based on Phase 5 cost baseline):** The Phase 5 decision log notes cost target of "$3-6 per run" for the full pipeline with Opus for voice-critical + Sonnet for writers + Haiku for mechanical. At ~$0.003/1K input tokens for Sonnet and ~$0.015/1K for Opus, 1,800 additional tokens is approximately $0.03-0.07 in additional cost. Against a baseline of $3-6, this is well under the 10% cap.

**Measurement approach (Claude's Discretion):** The most practical check is a unit test that counts `len(assemble_voice(herzog_profile))` vs `len(VOICE_CONSTRAINTS)` and asserts the ratio is < 1.10. This is deterministic, doesn't require a live run, and catches runaway persona blocks before they hit production.

---

## Section I: Frontend Narrator Chip

### IssueHero.tsx current state (verified)

The component is a Server Component (no `'use client'`). Props: `{ charity, issueNumber, publishDate, readingTimeMinutes, problemPdfUrl }`. The chip goes between the issue eyebrow label and the charity name h1 — or between the byline and the mission statement. Per D-19: under the issue title, above the publish date line.

Looking at the actual render order in `IssueHero.tsx`:
1. Ghost numeral
2. Issue eyebrow label (`Issue N — Date`)
3. Charity name h1
4. Byline ("by Jesse A. Eisenbalm")
5. Hero mission (missionStatement)
6. Meta row (location, founding year, read time)
7. PDF download link

"Under the issue title" = after the charity name h1. "Above the publish date line" = the meta row has no publish date (the date is in the issue eyebrow label). D-19 likely means: after the byline, before the mission statement. Or: after the mission statement, before the meta row.

**Recommended placement:** After the byline paragraph (step 4), before the mission statement (step 5). This puts it in the masthead metadata cluster without interrupting the hero visual flow.

**Chip implementation:**

```tsx
interface IssueHeroProps {
  // ... existing props ...
  narrator?: { name: string; slug: string; active: boolean } | null
}

// Inside render:
{narrator && narrator.name !== 'Jesse Eisenbalm' && (
  <p
    className="eyebrow mb-6 text-[color:var(--color-text-mute)] tracking-[0.18em] uppercase"
    style={{ fontSize: '11px' }}  // Inter uppercase 0.18em — Phase 12 MED-04 convention
  >
    Narrated by {narrator.name}
  </p>
)}
```

Note: The Phase 12 MED-04 machine-readout label convention uses `--color-text-mute` + Inter uppercase 0.18em. Looking at the existing `eyebrow` class in globals.css: it already applies `font-ui` (Inter) + uppercase + tracking. Adding `text-[color:var(--color-text-mute)]` to the element overrides any default `eyebrow` color.

### GROQ extension for frontend

Extend `QUERY_ISSUE_BY_SLUG` in `queries.ts`:

```groq
narrator-> {
  name,
  "slug": slug.current,
  active,
},
```

Note: `voiceConstraints`, `voiceRubric`, and `exampleSamples` are NOT projected — these are pipeline-only fields, not needed on the reader-facing page (security: no system prompt content exposed to readers).

### TypeScript types

Add to `types.ts`:

```typescript
export type IssueNarrator = {
  name: string
  slug: string
  active: boolean
} | null

// Add to Issue type:
export type Issue = {
  // ... existing fields ...
  narrator: IssueNarrator
}
```

### API_CONTRACTS.md §1.2 update

Per CLAUDE.md hard rule: add `narrator->{ name, "slug": slug.current, active }` to the §1.2 GROQ projection before any code implementing the GROQ change.

---

## Section J: Tripwire Test Architecture

### `narrator-chip.test.ts` — required by NRR-10

Following the established source-scan pattern (game-sandbox.test.ts, issue-page-typography.test.ts):

```typescript
// apps/web/__tests__/narrator-chip.test.ts
describe('Narrator chip — NRR-08', () => {
  it('renders chip when narrator is set and name !== Jesse Eisenbalm', () => {
    // source-scan: IssueHero.tsx contains the conditional chip render
    // with narrator.name !== 'Jesse Eisenbalm' guard
  })
  it('renders no chip when narrator is null', () => {
    // source-scan: no unconditional chip render
  })
  it('chip copy is "Narrated by {narrator.name}"', () => {
    // source-scan: template string "Narrated by {narrator.name}" or equivalent
  })
  it('does not leak voiceRubric, voiceConstraints, or exampleSamples text to reader', () => {
    // source-scan: GROQ projection in queries.ts does NOT include these fields
  })
})
```

**Pitfall J-1:** The source-scan pattern reads the file with `readFileSync` and asserts regex patterns. The chip condition check must account for JSX short-circuit rendering: `{narrator && narrator.name !== 'Jesse Eisenbalm' && (...)}`. A regex that looks for `narrator.name` would need to not false-positive on the type definition.

### Byte-equivalence pytest test

```python
# packages/pipeline/tests/test_voice.py
def test_voice_constraints_byte_equivalence():
    from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, assemble_voice
    # assemble_voice(None) must equal VOICE_CONSTRAINTS exactly
    assert assemble_voice(None) == VOICE_CONSTRAINTS

def test_jesse_explicit_narrator_byte_equivalence():
    from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS, assemble_voice, JESSE_PERSONA_BLOCK
    jesse = {"voiceConstraints": JESSE_PERSONA_BLOCK, "active": True}
    assert assemble_voice(jesse) == VOICE_CONSTRAINTS
```

### Inactive narrator warning test

```python
def test_inactive_narrator_falls_back_to_jesse(state_with_inactive_narrator):
    # Verify calibrator emits the warning event and narrator=None is used
    pass
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| String byte-equality verification | Custom diff algorithm | Python `==` on strings + `assert` | Bytes are bytes; == is sufficient and unambiguous |
| Sanity document dereference | Custom expansion logic | GROQ `->` operator in existing `groq_query` helper | Already works for `charity->`; identical pattern |
| Narrator schema in Studio | Custom widget | Standard Sanity reference field + document type | Sanity handles the picker UI automatically |
| Per-narrator rubric file management | `rubric_herzog.md`, `rubric_maya.md` etc. | Single `rubric.md` + runtime string append | Reduces file-system sprawl; keeps Andrew's edit surface clear |
| Chip toggle as feature flag | Environment variable or config flag | JSX conditional on `narrator` field value | The narrator field IS the flag; no separate mechanism needed |
| Narrator validation at write time | Custom pre-write validation | Sanity schema `validation: Rule => Rule.required()` + `active` boolean | Schema enforces structure; `active` handles "park without delete" |

---

## Common Pitfalls

### Pitfall 1: VOICE_CONSTRAINTS split breaks byte-equivalence
**What goes wrong:** `UNIVERSAL_CORE + "\n\n" + JESSE_PERSONA_BLOCK != VOICE_CONSTRAINTS` because of an invisible trailing space, missing newline, or wrong separator.
**Why it happens:** Python string literal concatenation is sensitive to whitespace that's invisible in editors.
**How to avoid:** Add an import-time assertion in `lib/voice.py`. Run `test_voice_constants_byte_equivalence` in pytest Wave 0 before any other phase work.
**Warning signs:** The pytest test fails immediately after the split is committed.

### Pitfall 2: Section writers don't receive narrator voice
**What goes wrong:** Four narrative writers still produce Jesse voice even when narrator is set, because `build_section_writer_prompt` defaults to `VOICE_CONSTRAINTS` and the call sites don't override it.
**Why it happens:** D-05 assumes writers are "zero-change surface" but the current call sites don't pass `voice_constraints=style_brief["voice"]` explicitly.
**How to avoid:** Add `voice_constraints=style_brief.get("voice", VOICE_CONSTRAINTS)` to the `build_section_writer_prompt` calls in all four writer agents. This is a one-line change per writer.
**Warning signs:** A Herzog-narrator run produces sections indistinguishable from Jesse voice.

### Pitfall 3: QA judge scores against Jesse rubric even for non-Jesse narrators
**What goes wrong:** Non-Jesse narrators fail QA because the rubric expects "dry, precise, absurdly serious" Jesse register and penalizes Herzog's philosophical sweep or Maya's warmth.
**Why it happens:** `run_llm_judge` receives no narrator context; rubric.md is hardcoded to Jesse register.
**How to avoid:** Pass `narrator=state.get("narrator")` to `run_llm_judge`. Append narrator.voiceRubric to the rubric before the LLM call.
**Warning signs:** Herzog-narrator run produces QA errors for "sentiment" axis despite the content being correctly in-voice.

### Pitfall 4: Chronicler still uses VOICE_CONSTRAINTS directly after migration
**What goes wrong:** Chronicler produces Jesse-register deliberation even when a non-Jesse narrator is set.
**Why it happens:** `chronicler.py::_build_system_prompt()` still directly embeds `VOICE_CONSTRAINTS` instead of reading `style_brief["voice"]`.
**How to avoid:** The `_build_system_prompt` refactor must be included in the Chronicler plan task and tested.
**Warning signs:** Chronicler output reads like Jesse even on a Herzog-narrator run.

### Pitfall 5: TypeGen not run after schema changes
**What goes wrong:** `apps/studio/sanity.types.ts` has no `NarratorProfile` type; `@eisenbalm/shared` re-exports a stale version; TypeScript errors in web app.
**Why it happens:** `sanity.types.ts` is gitignored (Phase 1 D-08) and must be regenerated manually.
**How to avoid:** The plan must include an explicit "run `pnpm --filter @eisenbalm/studio typegen`" task immediately after schema changes, marked `autonomous: false` (requires Sanity project credentials).
**Warning signs:** `pnpm --filter web build` fails with type error on `narrator` field.

### Pitfall 6: Seed sentinel can't cross-reference Python string from TypeScript
**What goes wrong:** The `seed-narrators.ts` script wants to assert that `narrators.json["jesse"]["voiceConstraints"] == JESSE_PERSONA_BLOCK` from Python, but TypeScript can't import Python constants.
**Why it happens:** Cross-language type/constant sharing across packages.
**How to avoid:** The sentinel is a pytest test that reads `narrators.json` and asserts equality with `JESSE_PERSONA_BLOCK`. The TypeScript seed script does not need to be the sentinel — it just seeds idempotently. The Python test is the guardian.
**Warning signs:** A developer edits `narrators.json["jesse"]["voiceConstraints"]` but doesn't update `lib/voice.py::JESSE_PERSONA_BLOCK`; the Python sentinel test fails at pytest run.

### Pitfall 7: API_CONTRACTS.md reconciliation skipped
**What goes wrong:** `weeklyIssue.narrator` added to Sanity schema and GROQ query but not to `docs/API_CONTRACTS.md §1.2` or `§7`. CLAUDE.md hard rule violated.
**Why it happens:** Wave 0 plan omits the API_CONTRACTS.md update task.
**How to avoid:** Plan Wave 0 MUST include: (a) add `narrator` to API_CONTRACTS.md §7 DispatchState, (b) add `narrator->{ name, slug, active }` to API_CONTRACTS.md §1.2 GROQ read. These are gating tasks before any schema or code changes.
**Warning signs:** Reviewer notes API_CONTRACTS.md is stale; CLAUDE.md rule explicitly forbids proceeding.

### Pitfall 8: Narrator chip leaks pipeline content to readers
**What goes wrong:** Frontend GROQ projection includes `narrator->{ voiceConstraints, voiceRubric, exampleSamples }` which exposes system prompt content to browser.
**Why it happens:** Developer copies the full narratorProfile field list into the GROQ projection.
**How to avoid:** Frontend GROQ projection includes ONLY `name`, `slug`, `active`. The tripwire test `narrator-chip.test.ts` source-scans `queries.ts` to assert these fields are NOT projected.
**Warning signs:** Browser network tab shows `voiceConstraints` in the GROQ response.

---

## Code Examples

### Verified: Current VOICE_CONSTRAINTS from lib/voice.py

```python
# Source: packages/pipeline/src/eisenbalm_pipeline/lib/voice.py (verified by direct file read)
VOICE_CONSTRAINTS = (
    "Jesse Eisenbalm voice. Dry, precise, absurdly serious. No winking. "
    "No irony signaling. The brand does not pivot to AI.\n"
    "Treat every charity with the gravity of a Fortune 500 company.\n"
    "Treat every founder as a visionary regardless of obscurity.\n"
    "Never use exclamation marks. Never use: heartwarming, inspiring, "
    "incredible, amazing, truly, simply, journey of, passion, transformative, "
    "empowering, life-changing, remarkable, humbling, beautiful work.\n"
    "Never use winking constructions: \"if you can call it that\", "
    "\"believe it or not\", \"of sorts\", \"for lack of a better word\", "
    "\"so to speak\", \"as they say\".\n"
    "Never reference AI, language models, or Jesse's AI nature. "
    "Jesse was born AI. This is not a gimmick.\n"
    "Answer the implied question \"Why do you deserve to exist?\" without sentiment.\n"
    "Adjectives that are also compliments (impressive, wonderful, great) are forbidden.\n"
    "Passive hedging (might be, could perhaps, seems to) is forbidden."
)
```

### Verified: Calibrator stub-mode fallback (the insertion point)

```python
# Source: packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py lines 156-166
# CURRENT:
brief_dict = {
    "voice": VOICE_CONSTRAINTS,
    ...
}

# PHASE 16 CHANGE:
brief_dict = {
    "voice": assemble_voice(state.get("narrator")),
    ...
}
```

### Verified: QA judge _RUBRIC_PATH (the per-run load insertion point)

```python
# Source: packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py line 29
# CURRENT:
_RUBRIC_PATH: Path = Path(__file__).parent / "rubric.md"

# PHASE 16 CHANGE: move load from import time to call time
# Remove module-level constant; pass narrator to run_llm_judge
```

### Verified: agentProfile.ts pattern for narratorProfile.ts

```typescript
// Source: apps/studio/schemas/agentProfile.ts (verified by direct file read)
// narratorProfile.ts follows this exact defineType/defineField builder structure
export default defineType({
  name: 'narratorProfile',
  title: 'Narrator Profile',
  type: 'document',
  fields: [
    defineField({ name: 'name', ... }),
    defineField({ name: 'slug', type: 'slug', options: { source: 'name', maxLength: 96 }, ... }),
    defineField({ name: 'voiceConstraints', type: 'text', rows: 8, ... }),
    defineField({ name: 'voiceRubric', type: 'text', rows: 8, ... }),
    defineField({ name: 'exampleSamples', type: 'array', of: [{ type: 'text' }], ... }),
    defineField({ name: 'active', type: 'boolean', ... }),
  ],
  preview: { select: { title: 'name', subtitle: 'voiceConstraints' } },
})
```

### Verified: seed-agents.ts idempotent pattern to mirror

```typescript
// Source: apps/studio/scripts/seed-agents.ts (verified)
// The _id pattern is: `agent-{agentId}` with createOrReplace
// narrator seed mirrors: `narrator-{slug}` with createOrReplace
const mutations = narrators.map(n => ({
  createOrReplace: {
    _id: `narrator-${n.slug}`,
    _type: 'narratorProfile',
    name: n.name,
    slug: { _type: 'slug', current: n.slug },
    voiceConstraints: n.voiceConstraints,
    voiceRubric: n.voiceRubric,
    exampleSamples: n.exampleSamples,
    active: n.active ?? true,
  },
}))
```

### Verified: QUERY_ISSUE_BY_SLUG extension point

```groq
// Source: apps/web/lib/sanity/queries.ts QUERY_ISSUE_BY_SLUG
// After charity-> {...}, add:
narrator-> {
  name,
  "slug": slug.current,
  active,
},
```

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Python framework | pytest (already configured in `packages/pipeline/pyproject.toml`) |
| JS framework | Vitest (already configured in `apps/web/vitest.config.ts`) |
| Python config file | `packages/pipeline/pyproject.toml` (pytest section) |
| JS config file | `apps/web/vitest.config.ts` |
| Python quick run | `uv run pytest packages/pipeline/tests/ -x -q` |
| Python full suite | `uv run pytest packages/pipeline/tests/ -v` |
| JS quick run | `pnpm --filter web test:unit` |
| JS full suite | `pnpm --filter web test:unit` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NRR-01 | `narratorProfile` schema compiles + TypeGen runs | manual | `pnpm --filter @eisenbalm/studio typegen` | ❌ Wave 0 (schema file) |
| NRR-02 | `weeklyIssue.narrator` reference field in schema | source-scan | `pnpm --filter web test:unit` (narrator-chip.test.ts) | ❌ Wave 0 |
| NRR-03 | `assemble_voice(None) == VOICE_CONSTRAINTS` | unit | `uv run pytest tests/test_voice.py::test_voice_constants_byte_equivalence` | ❌ Wave 0 |
| NRR-03 | Jesse-explicit-narrator produces same voice | unit | `uv run pytest tests/test_voice.py::test_jesse_explicit_narrator_byte_equivalence` | ❌ Wave 0 |
| NRR-04 | Section writers use narrator voice from style_brief | integration | `uv run pytest tests/test_calibrator_narrator.py` | ❌ Wave 0 |
| NRR-05 | Chronicler consumes `style_brief["voice"]` not direct import | unit | `uv run pytest tests/test_chronicler.py::test_narrator_voice_propagation` | ❌ Wave 0 |
| NRR-06 | QA judge appends narrator rubric at call time | unit | `uv run pytest tests/test_qa_judge_narrator.py` | ❌ Wave 0 |
| NRR-07 | Studio dropdown shows narrator field (manual only) | manual | Andrew UAT | N/A |
| NRR-08 | Chip present iff narrator set and not Jesse | source-scan | `pnpm --filter web test:unit` (narrator-chip.test.ts) | ❌ Wave 0 |
| NRR-08 | Chip copy = "Narrated by {name}" | source-scan | same | ❌ Wave 0 |
| NRR-08 | No voiceRubric/voiceConstraints/exampleSamples in GROQ | source-scan | same | ❌ Wave 0 |
| NRR-09 | Three seed docs present in Sanity | manual | `pnpm seed:narrators` (idempotent) | ❌ Wave 0 (seed script) |
| NRR-09 | Jesse seed voiceConstraints matches JESSE_PERSONA_BLOCK | cross-language unit | `uv run pytest tests/test_narrator_seed_sentinel.py` | ❌ Wave 0 |
| NRR-10 | All existing tripwires still green | all existing | `pnpm --filter web test:unit` | ✅ all existing |
| NRR-10 | 168 pipeline pytest tests still green | pytest | `uv run pytest packages/pipeline/tests/` | ✅ |
| NRR-10 | Cost delta ≤10% (token count check) | unit | `uv run pytest tests/test_narrator_cost_budget.py` | ❌ Wave 0 |

### Existing Tripwires That Must Stay Green (NRR-10 zero-regression contract)

| Tripwire | File | What it guards |
|----------|------|----------------|
| DEL-04 no model names | `apps/web/__tests__/deliberation-no-model-names.test.ts` | No Claude/AI mention in deliberation render |
| Game sandbox | `apps/web/__tests__/game-sandbox.test.ts` | `allow-same-origin` absence |
| Typography | `apps/web/__tests__/issue-page-typography.test.ts` | DES-01..06 invariants |
| Deliberation conversation | `apps/web/__tests__/deliberation-conversation.test.ts` | Phase 13 chat render |
| Podcast slot | `apps/web/__tests__/podcast-slot.test.ts` | Phase 13 pre removal |
| Theme AA tones | `apps/web/__tests__/theme-aa-tones.test.ts` | Phase 14 LIGHT-03/05 |
| Shop page | `apps/web/__tests__/shop-page.test.ts` | Phase 15 assertions |
| All 29 CMR sentinels | `apps/web/__tests__/` (Phase 8 files) | Commerce security |
| Pipeline pytest 168/168 | `packages/pipeline/tests/` | All agent contracts |

### Sampling Rate

- **Per task commit:** `uv run pytest packages/pipeline/tests/ -x -q` + `pnpm --filter web test:unit`
- **Per wave merge:** Full suite: `uv run pytest packages/pipeline/tests/ -v` + `pnpm --filter web test:unit`
- **Phase gate:** Both suites green before `/gsd:verify-work`

### Wave 0 Gaps

All of the following must exist before implementation begins:

- [ ] `packages/pipeline/tests/test_voice.py` — byte-equivalence invariants (NRR-03, NRR-10)
- [ ] `packages/pipeline/tests/test_narrator_seed_sentinel.py` — cross-language Jesse voiceConstraints check (NRR-09)
- [ ] `packages/pipeline/tests/test_narrator_cost_budget.py` — token count ratio assertion (NRR-10 criterion 7)
- [ ] `apps/web/__tests__/narrator-chip.test.ts` — frontend chip presence/absence/copy/no-leak (NRR-08)
- [ ] `docs/API_CONTRACTS.md §7` and `§1.2` updated with narrator field — gating task before any code
- [ ] `apps/studio/schemas/narratorProfile.ts` — new schema file
- [ ] `apps/studio/scripts/seed-narrators.ts` + `narrators.json` — seed script + data
- [ ] `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` narrator field — after API_CONTRACTS.md update

---

## State of the Art

| Old Approach | Current Approach (Phase 16) | Impact |
|--------------|--------------------------|--------|
| Single hardcoded VOICE_CONSTRAINTS | Two-tier UNIVERSAL_CORE + PERSONA_BLOCK assembled per run | Narrator persona is swappable; universal rules are locked |
| Import-time rubric.md load in judge.py | Per-call load with narrator rubric appended | QA scores against the correct narrator register |
| Calibrator always emits Jesse voice | Calibrator calls assemble_voice(narrator) | Single injection point; all 4 writers + chronicler get narrator voice automatically |
| Chronicler imports VOICE_CONSTRAINTS directly | Chronicler reads style_brief["voice"] | Narrator-aware deliberation with zero surface change to Chronicler I/O contract |

---

## Open Questions

1. **Which exact lines of VOICE_CONSTRAINTS become UNIVERSAL_CORE vs JESSE_PERSONA_BLOCK?**
   - What we know: D-02 enumerates the four UNIVERSAL_CORE rule groups. The first line ("Jesse Eisenbalm voice. Dry, precise, absurdly serious. No winking.") is register, not a rule — it's Jesse's persona marker.
   - What's unclear: Does "Jesse Eisenbalm voice." go in UNIVERSAL_CORE (as a prefix that says "you are this kind of writer") or JESSE_PERSONA_BLOCK?
   - Recommendation: "Jesse Eisenbalm voice. Dry, precise, absurdly serious. No winking. No irony signaling." is JESSE_PERSONA_BLOCK (persona register). Rules about charities, founders, forbidden words, no-exclamation are UNIVERSAL_CORE. The planner decides the exact split line when writing the voice.py task.

2. **Does `build_section_writer_prompt` need to change its signature for narrator voice to reach writers?**
   - What we know: The function has `voice_constraints: str = VOICE_CONSTRAINTS` — callers can override. Currently writers don't pass this kwarg.
   - What's unclear: Do writer call sites currently pass `voice_constraints` at all?
   - Recommendation: Writers need to add `voice_constraints=style_brief.get("voice", VOICE_CONSTRAINTS)` to their `build_section_writer_prompt` calls. This is a ~4 one-line changes (one per writer). The planner must include this in the section-writer plan task.

3. **Where does `load_narrator_from_issue` get called in the pipeline?**
   - What we know: It should be called at pipeline start before the graph runs, analogous to how the issue itself is loaded.
   - What's unclear: The exact location in `main.py` or `api/runs.py` where the pipeline starts and the issue data is fetched.
   - Recommendation: Load the narrator alongside the issue fetch in the pipeline startup code (wherever `issue_number` → `weeklyIssue` lookup happens). If no such lookup exists and issue_number is passed directly, add a `load_narrator_for_issue` call in the `run_weekly` endpoint handler before `graph.ainvoke`.

---

## Environment Availability

> Step 2.6: No new external dependencies. All required tools (pnpm, uv, pytest, Vitest) are already verified present from prior phases. Sanity project and dataset are live. SKIPPED for new tool check.

---

## Sources

### Primary (HIGH confidence — direct file reads)

- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` — VOICE_CONSTRAINTS exact string verified
- `packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py` — injection point at lines 158, 182 verified
- `packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` — VOICE_CONSTRAINTS import at line 33 verified
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` — import-time `_RUBRIC_PATH` at line 29 verified
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md` — structure and universal axes verified
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — DispatchState fields + `deliberation_conversation` field verified
- `packages/pipeline/src/eisenbalm_pipeline/agents/game.py` — VOICE_CONSTRAINTS direct import at line 21 verified
- `apps/studio/schemas/agentProfile.ts` — pattern to mirror verified
- `apps/studio/schemas/weeklyIssue.ts` — selectionDeliberation.conversation location at lines 382-416 verified
- `apps/studio/scripts/seed-agents.ts` — idempotent seed pattern verified
- `apps/web/lib/sanity/queries.ts` — QUERY_ISSUE_BY_SLUG current shape verified; narrator not yet present
- `apps/web/lib/sanity/types.ts` — Issue type shape + existing IssueDeliberationTurn verified
- `apps/web/components/issue/IssueHero.tsx` — chip insertion point + render order verified
- `docs/API_CONTRACTS.md §1.2 + §7` — current narrator field ABSENT (must be added in Wave 0) verified
- `.planning/phases/16-choose-your-narrator/16-CONTEXT.md` — all 20 decisions
- `.planning/phases/16-choose-your-narrator/16-INTENT.md` — requirements NRR-01..NRR-10
- `.planning/phases/13-deliberation-as-conversation/13-CONTEXT.md` — D-04, D-16, D-18 verified
- `.planning/phases/05-agent-quality/05-CONTEXT.md` — D-01 QA rubric pattern verified
- `.planning/config.json` — nyquist_validation: true verified

### Secondary (MEDIUM confidence)

- Prior phase STATE.md entries for Phase 13 chronicle patterns and Phase 5 voice architecture

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all additions are within existing stack; no new dependencies
- Architecture: HIGH — all patterns verified against actual codebase files
- Pitfalls: HIGH — all pitfalls derived from actual code inspection (not assumptions)
- Byte-equivalence: HIGH — the pitfall is real and confirmed; the mitigation is testable

**Research date:** 2026-05-28
**Valid until:** Until VOICE_CONSTRAINTS is edited in `lib/voice.py` (then byte-equivalence section must be re-verified)
