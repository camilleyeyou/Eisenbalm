# Phase 16: Choose Your Narrator - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning
**Source:** discuss-phase interactive — 1 gray area discussed (voice-override architecture); 3 captured as Claude's Discretion with defensible defaults

<domain>
## Phase Boundary

Per-issue editorial voice variation. Andrew picks a Narrator on `weeklyIssue`; the four narrative writer agents (OriginStory, Problem, FounderBio, CaseStudy) + the Phase 13 Chronicler + the QA judge all become narrator-aware via a single injection point in the Calibrator. When `narrator` is unset (or set to default `jesse`), the pipeline produces Jesse voice byte-equivalent to Phase 15-era runs — verified against the existing 168-passing pytest suite + every Jesse-voice tripwire.

**In scope:**
- New Sanity `narratorProfile` document type + `weeklyIssue.narrator` optional reference
- Two-tier voice surface: `UNIVERSAL_CORE` (hard rules) + `PERSONA_BLOCK` (narrator-controlled register)
- Calibrator merges narrator persona into the StyleBrief; downstream writers/Chronicler consume `style_brief["voice"]` unchanged (their consumption surface stays stable)
- QA rubric becomes per-run loaded with narrator-aware persona expectations + `exampleSamples` as few-shot anchors
- Three seeded `narratorProfile` documents at landing: `jesse` (explicit default), `maya-rudolph`, `werner-herzog`
- Frontend masthead chip when narrator is set; no chip when unset
- Zero-regression validation against existing tripwires + pytest

**Out of scope:**
- Reader-side narrator selection (editorial-only; reader picks go through SEED-001)
- Narrator variation within a single issue (one narrator per issue, all sections)
- Visual theme changes (Phase 14 light palette fixed regardless of narrator)
- Game / Bonus / Researcher narrator-awareness (these stay Jesse — Game already uses `VOICE_CONSTRAINTS` directly without `build_section_writer_prompt`; Researcher is voiceless data; Bonus has its own voice rules)
- Live multi-call narrator debate / streaming narration
- `/narrators/[slug]` route + archive-filter-by-narrator (deferred to backlog — see Deferred Ideas)
- A new LLM model — same OpenRouter routing, same agents

</domain>

<decisions>
## Implementation Decisions

### Voice-Override Architecture (the load-bearing decision)

- **D-01: Two-tier voice surface.** Split `VOICE_CONSTRAINTS` into `UNIVERSAL_CORE` (non-overridable, applies to every narrator including Jesse) + `PERSONA_BLOCK` (narrator-controlled register/cadence). The narrator overrides only the persona block. Rejected: wholesale-replace (weakens guardrails — a sloppy narrator profile could disable DEL-04) and per-profile inherit flag (creates two valid patterns, ambiguity risk).

- **D-02: `UNIVERSAL_CORE` content (locked, all four selected by user):**
  1. **No AI references / Jesse-born-AI rule** (DEL-04 — already enforced by `deliberation-no-model-names.test.ts` tripwire). Non-negotiable.
  2. **Fortune-500 gravity** — every charity treated with seriousness, every founder as a visionary regardless of obscurity. Editorial premise of the entire product.
  3. **Forbidden sentimentality words** — the existing Jesse list (`heartwarming, inspiring, incredible, amazing, truly, simply, journey of, passion, transformative, empowering, life-changing, remarkable, humbling, beautiful work`) PLUS forbidden adjectives-as-compliments (`impressive, wonderful, great`) PLUS passive hedging (`might be, could perhaps, seems to`). These are quality flags, not register flags. The Maya / Herzog / Sorkin samples confirmed: none use any of these. They fail QA regardless of narrator.
  4. **No exclamation marks.** Surprising at first; confirmed by all three client samples (Maya enthusiastic but never uses one). It's a typographic register rule.

- **D-03: `PERSONA_BLOCK` is what each `narratorProfile.voiceConstraints` provides** — the narrator-specific register, cadence, gestures (e.g. Herzog's geological-time metaphors, Maya's asides, Sorkin's intercut dialogue, Jesse's "dry, precise, absurdly serious"). Includes anything not in `UNIVERSAL_CORE`. The Jesse persona block contains the original Jesse register lines from `VOICE_CONSTRAINTS` minus the core rules.

- **D-04: WINNER AUTHORITY (Phase 13 chronicler) is universal.** Lives in `UNIVERSAL_CORE` (or in the chronicler's persona-agnostic preamble — planning decides exact placement). Herzog can be philosophical, Maya enthusiastic, Sorkin theatrical — but the Editor's final turn MUST conclude with the WINNER named in state. Non-negotiable.

- **D-05: Single injection point — the Calibrator.** Only the Calibrator reads `state['narrator']`. It assembles the final voice string as `UNIVERSAL_CORE + "\n\n" + persona_block` (where `persona_block` is either `narrator.voiceConstraints` if set, or `JESSE_PERSONA_BLOCK` as the default), then writes it to `style_brief["voice"]`. Downstream writers and the Chronicler stay surface-stable: they consume `style_brief["voice"]` as a single string. Rejected: per-agent (5× the surface area to keep in sync) and hybrid (creates two valid patterns).

- **D-06: `style_brief["voice"]` shape stays a single string.** No structured object. The two-tier split exists in the assembly logic, not in the data passing through downstream agents. Byte-equivalent guarantee for the unset-narrator case becomes mechanical: with `narrator=None`, `UNIVERSAL_CORE + "\n\n" + JESSE_PERSONA_BLOCK` MUST equal exactly the current `VOICE_CONSTRAINTS` string. This is the testable invariant for NRR-10 zero-regression.

- **D-07: Code-level layout.** `lib/voice.py` exposes `UNIVERSAL_CORE: str`, `JESSE_PERSONA_BLOCK: str`, and `VOICE_CONSTRAINTS: str` (the literal concatenation kept for backward-compatibility with `chronicler.py:33`, `calibrator.py:27,158,182`, `game.py:21,64` that import it directly — Game stays Jesse and untouched, so its existing import path is preserved). A new helper `assemble_voice(narrator: NarratorProfile | None) -> str` returns the assembled voice string. The Calibrator calls it; nobody else needs to know the tiers exist.

### Narrator Schema + Seeding (Claude's Discretion — defensible defaults)

- **D-08: `narratorProfile` Sanity document type** lives at `apps/studio/schemas/narratorProfile.ts`, mirrors the `agentProfile.ts` pattern. Fields:
  - `name` (string, required) — display name e.g. "Werner Herzog"
  - `slug` (slug, required, source=name, maxLength=96) — used for seed `_id` (`narrator-{slug}`)
  - `voiceConstraints` (text, rows=8, required) — the `PERSONA_BLOCK` content
  - `voiceRubric` (text, rows=8, required) — narrator-specific QA scoring rubric (replaces the persona-register portion of `rubric.md`; universal rules are appended by code at run time)
  - `exampleSamples` (array of text blocks, min 1 max 5) — short prose samples that prove the voice; **plain string each, NOT Portable Text** (the chronicler turns are plain strings; consistency)
  - `active` (boolean, default true) — Andrew can park a narrator without deleting

- **D-09: `weeklyIssue.narrator`** is an optional `reference` field with `to: [{type: 'narratorProfile'}]`. Field placement: under the existing `pipelineMetadata` group OR as a top-level field next to `narrator-adjacent` editorial controls — final placement decided in the planning phase to minimize Studio scroll. Absence = `null` = default Jesse.

- **D-10: Seeded `jesse` narratorProfile is explicit-by-construction.**
  - `voiceConstraints` field = `JESSE_PERSONA_BLOCK` content (Python string copied verbatim into the seed). This is the second source of truth. To prevent drift, the seed script runs a sentinel assertion at seed time: `assert seeded_jesse.voiceConstraints.strip() == JESSE_PERSONA_BLOCK.strip()` and refuses to write a mismatched seed. Drift is caught at deploy, not at runtime.
  - `voiceRubric` field = the persona-register portion of the existing `rubric.md` (the "Dry, precise, absurdly serious" tone framing; the forbidden-words list stays in `UNIVERSAL_CORE`-injected universal rules).
  - `exampleSamples` = 2-3 short paragraphs from Phase 13 sample chronicler runs (real Jesse output, anchored). Empty samples acceptable for `jesse` since the rubric carries the register description.
- **D-11: Seeded `maya-rudolph` + `werner-herzog` narratorProfiles** = the client-supplied sample tables verbatim (Origin Story + Problem + Founder Bio + Case Study for The Nap Ministry), 1-3 paragraphs each in `exampleSamples`, ~100-200 words each. These ARE the acceptance reference.
- **D-12: `exampleSamples` count + length: 3 samples × ~150 words each as the seed default.** Total ~450 words per narrator added to the QA system prompt. At ~600 tokens/narrator × 1 narrator-per-run, this is the source of the ≤10% cost delta budget for NRR-10 success criterion 7.

### Edge Cases (Claude's Discretion — defensible defaults)

- **D-13: `narrator: null` vs `narrator: jesse-explicit-ref` are byte-equivalent by construction.** `assemble_voice(None)` returns `UNIVERSAL_CORE + "\n\n" + JESSE_PERSONA_BLOCK`. `assemble_voice(jesse_profile)` returns `UNIVERSAL_CORE + "\n\n" + jesse_profile.voiceConstraints`. The seed sentinel (D-10) guarantees `jesse_profile.voiceConstraints == JESSE_PERSONA_BLOCK`, so both paths produce identical strings. This is the testable invariant — write a test that runs both and asserts byte-equality.
- **D-14: Referenced narrator with `active: false` falls back to Jesse + logs a warning.** Do NOT silently honor an inactive narrator (Andrew probably parked it intentionally). Do NOT block the run (silent fallback is friendlier to Andrew than a hard failure on Thursday morning). Convex `pipelineRuns` row gets a non-blocking `warning` entry in the deliberation events: `{eventType: 'editor-decision', payload: '{"warning": "inactive narrator X — fell back to Jesse"}'}` — does NOT require a new Convex schema field (reuses existing event surface). Implementation: Calibrator checks `narrator.active`; if false, sets `state['narrator'] = None` and emits the warning event before continuing.
- **D-15: Andrew swaps narrator mid-draft after a run.** No pipeline behavior — the narrator field is a Sanity content field. Re-running the pipeline picks up the new narrator. We do NOT track a narrator-change history on `weeklyIssue` (Sanity's built-in revision history covers it). This is a non-decision; documenting it so the planner doesn't invent state.
- **D-16: `narratorProfile` dropdown in Studio defaults to "no selection" (= null = Jesse default).** Andrew must explicitly pick a non-Jesse narrator to override. Lowers the "I accidentally set Maya for issue 42" footgun.

### Frontend Narrator Surfacing (Claude's Discretion — defensible defaults)

- **D-17: Masthead chip copy = "Narrated by {narrator.name}"** when narrator is set AND name ≠ "Jesse Eisenbalm". No chip when narrator is null OR narrator is the explicit-Jesse default. Default Jesse stays implicit/invisible.
- **D-18: Chip is non-interactive in this phase** (no link). A `/narrators/[slug]` route + archive-filter-by-narrator is deferred to backlog (see Deferred Ideas). Decision rationale: ship the variation feature first, observe whether 2-3 narrators in rotation creates enough volume for a discovery surface to matter.
- **D-19: Chip placement: under the issue title on `IssueHero`**, above the publish date line. Styling uses existing `--color-text-mute` token + Inter uppercase 0.18em (the existing machine-readout label convention from Phase 12 MED-04), to mark it as editorial metadata, not part of the article body.
- **D-20: Deliberation chat thread chip reuse.** No new chip in the chat thread — agent attribution already uses Phase 13's `AGENT_LABELS` / `agentChipStyle` per speaker. The masthead chip is sufficient narrator surfacing; per-turn narrator labels would be noise.

### Claude's Discretion

The planner has freedom on the following without re-asking the user:
- Exact `narratorProfile.narrator` field placement on `weeklyIssue` (under `pipelineMetadata` group or top-level).
- Whether `assemble_voice` helper lives in `lib/voice.py` or a new `lib/narrator.py` module. Leaning `lib/voice.py` for cohesion with `VOICE_CONSTRAINTS`.
- How the QA `rubric.md` per-run load is implemented (template with placeholder vs. multi-file).
- Exact chip CSS/Tailwind classes (must use Phase 14 light tokens + machine-readout convention).
- Whether the seed sentinel assertion lives in the seed script or in a startup check; planner picks.
- Exact `pipelineRuns` warning event payload shape for D-14 (must use existing eventType union; no new Convex schema change).
- Whether tests parametrize the byte-equality assertion (D-13) per-narrator or just for Jesse.

### Folded Todos

None — no pending todos matched Phase 16 (`todo match-phase 16` returned 0).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Hard rules & contracts (read FIRST — gates every schema/payload change)
- `CLAUDE.md` — project hard rules: no schema field renames without `docs/API_CONTRACTS.md`; GSD workflow enforcement; Jesse voice non-negotiable.
- `docs/API_CONTRACTS.md §1.2` — `QUERY_ISSUE_BY_SLUG` GROQ read — `weeklyIssue.narrator` reference must be added here for the frontend to display the narrator chip.
- `docs/API_CONTRACTS.md §2.2` — `create weeklyIssue draft` Python write — the pipeline does NOT write `narrator` (it's editorial input, set by Andrew in Studio); confirm and leave write path unchanged.
- `docs/API_CONTRACTS.md §7` — `DispatchState` contract — add `narrator: Optional[NarratorProfile]` field here (or equivalent loaded shape).
- `docs/CLAUDE_CODE_BRIEF.md` lines 359-367 — source-of-truth for Jesse voice; the canonical text `VOICE_CONSTRAINTS` derives from.

### Phase 16 intent (full client spec)
- `.planning/phases/16-choose-your-narrator/16-INTENT.md` — full client-supplied spec including Maya/Herzog/Sorkin sample tables (the acceptance reference for "in voice"). Read for the seed content + the 5 open questions discussion resolved.

### Prior-phase decisions this phase inherits
- `.planning/phases/05-agent-quality/05-CONTEXT.md` — Phase 5 D-01 (QA Layer-2 LLM judge + rubric.md pattern) and D-13 (`build_section_writer_prompt` + AGT-09 voice-isolation invariant). The narrator-aware version preserves AGT-09 (writers never read other section output) byte-equivalently.
- `.planning/phases/13-deliberation-as-conversation/13-CONTEXT.md` — Phase 13 D-04 (single LLM call for chronicler), D-14 (faithful dramatization), D-16 (`VOICE_CONSTRAINTS` verbatim — Phase 16 changes this to `assemble_voice(narrator)`), D-18 (deterministic fallback). The WINNER AUTHORITY rule (chronicler.py system prompt rule 7) becomes part of `UNIVERSAL_CORE`.
- `.planning/phases/14-light-theme-adoption/14-CONTEXT.md` (if it exists — light tokens) — narrator chip styling inherits the light palette + machine-readout label convention from Phase 12 MED-04.

### Pipeline (voice surface + Calibrator + QA + Chronicler)
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` — defines `VOICE_CONSTRAINTS` and `build_section_writer_prompt`. The latter already accepts `voice_constraints: str = VOICE_CONSTRAINTS` override — Phase 16's surgical injection point. Split point: introduce `UNIVERSAL_CORE`, `JESSE_PERSONA_BLOCK`, and `assemble_voice(narrator)`; preserve `VOICE_CONSTRAINTS` constant as a literal concatenation for back-compat with direct importers (`chronicler.py`, `calibrator.py`, `game.py`).
- `packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py` lines 27, 101-115, 158, 182 — current Jesse-only `style_brief["voice"] = VOICE_CONSTRAINTS` assignment. This is the single injection point per D-05; rewires to `style_brief["voice"] = assemble_voice(state.get("narrator"))`. The Calibrator pydantic StyleBrief field description "Jesse voice summary — copy from VOICE_CONSTRAINTS" (line ~42) needs updating for narrator-awareness.
- `packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py` lines 33 (`from ... import VOICE_CONSTRAINTS`), 54-56 (`_build_system_prompt` interpolation). Per D-05/D-06, consumer surface stays stable — Chronicler reads `state['style_brief']['voice']` instead of importing `VOICE_CONSTRAINTS` directly. Phase 13 fallback transcript path (D-18) is preserved byte-compatible.
- `packages/pipeline/src/eisenbalm_pipeline/agents/origin_story.py`, `problem.py`, `founder_bio.py`, `case_study.py` — already consume `style_brief` via `build_section_writer_prompt`. **No change needed** if the Calibrator route is taken (D-05) — the StyleBrief already flows through.
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` lines 30 (`_RUBRIC_PATH` import-time load), 78-79 (`_load_rubric()`) — convert to per-run load with narrator context. Construct the rubric at call time as `JESSE_RUBRIC_CORE + persona_register_block` where `persona_register_block` comes from `narrator.voiceRubric` or the existing Jesse persona block.
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rubric.md` — current single-file rubric. Split: "Jesse Voice (Non-Negotiable)" section stays as `JESSE_RUBRIC_CORE` (or moves to code). Forbidden lists + Evaluation Axes stay universal. The persona register block (the "dry, precise" framing) becomes narrator-controlled via `narratorProfile.voiceRubric`. Few-shot anchors injected from `narratorProfile.exampleSamples`.
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — `DispatchState` TypedDict. Add `narrator: Optional[NarratorProfile]` field. NarratorProfile = loaded narratorProfile dict shape (mirrors how `charity` flows today).
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` — must load `narratorProfile` doc by reference and inject into `state['narrator']` before Calibrator runs. Reuse the existing `charity` dereference pattern.
- `packages/pipeline/src/eisenbalm_pipeline/agents/game.py` line 21 (`from ... import VOICE_CONSTRAINTS`), 64 (interpolation) — **Game stays Jesse. No change.** Confirms VOICE_CONSTRAINTS constant must survive as the literal concatenation per D-07.

### Sanity (narratorProfile schema + weeklyIssue ref)
- `apps/studio/schemas/agentProfile.ts` — the canonical pattern `narratorProfile.ts` mirrors.
- `apps/studio/schemas/weeklyIssue.ts` — adds `narrator` optional reference field. Existing `selectionDeliberation.conversation[]` (lines 344, 384 from Phase 13) is untouched.
- `apps/studio/schemas/index.ts` — register `narratorProfile` in `schemaTypes` export.
- `apps/studio/scripts/seed-agent-profiles.ts` (or equivalent — verify exact path during planning) — the Phase 1 idempotent seed pattern. Add a parallel `seed-narrator-profiles.ts` for `jesse` + `maya-rudolph` + `werner-herzog`.
- TypeGen: run `pnpm --filter @eisenbalm/studio typegen` after schema changes; new `NarratorProfile` type flows into `apps/studio/sanity.types.ts` → re-exported via `@eisenbalm/shared`.

### Frontend (narrator chip + GROQ extension)
- `apps/web/lib/sanity/queries.ts` — extend `QUERY_ISSUE_BY_SLUG` to dereference `narrator->{name, slug, active}` (no `voiceConstraints`/`voiceRubric`/`exampleSamples` needed on the frontend).
- `apps/web/lib/sanity/types.ts` — add `IssueNarrator` type; `Issue.narrator: IssueNarrator | null`.
- `apps/web/components/issue/IssueHero.tsx` — render the masthead chip per D-17/D-19. Use existing `--color-text-mute` token + Inter uppercase 0.18em (Phase 12 MED-04 machine-readout convention).
- `apps/web/components/issue/DeliberationSlot.tsx` — confirm NO change (per D-20, per-turn agent labels stay).
- `apps/web/__tests__/` — add tripwire test: `narrator-chip.test.ts` (chip presence iff `narrator` is set and not the default Jesse; copy = "Narrated by {name}"; no chip surface leak when null).

### Convex (do-not-touch confirmation)
- `convex/schema.ts` — `pipelineRuns` + `deliberationEvents` tables stay unchanged. D-14 inactive-narrator warning reuses the existing `editor-decision` eventType payload string — no new union member, no migration.

### Tripwires that MUST stay green (NRR-10 zero-regression contract)
- `apps/web/__tests__/deliberation-no-model-names.test.ts` (DEL-04)
- `apps/web/__tests__/game-sandbox.test.ts` (Phase 7)
- `apps/web/__tests__/typography.test.ts` (Phase 10)
- `apps/web/__tests__/deliberation-conversation.test.ts` (Phase 13)
- `apps/web/__tests__/podcast-slot.test.ts` (Phase 13)
- `apps/web/__tests__/theme-aa-tones.test.ts` (Phase 14)
- `apps/web/__tests__/shop-page.test.ts` (Phase 15)
- All 29 CMR sentinel tests (Phase 8)
- Full pipeline pytest suite (168 passing as of Phase 14 baseline)

### Brand voice source-of-truth
- `docs/CLAUDE_CODE_BRIEF.md` lines 359-367 — the literal Jesse voice text. After D-01 split, the `UNIVERSAL_CORE` extracts the rules from this section and the `JESSE_PERSONA_BLOCK` keeps the register lines. The brief itself is the canonical English statement — code derives from it.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`lib/voice.py::build_section_writer_prompt`** — already accepts `voice_constraints: str = VOICE_CONSTRAINTS` override. Phase 16's two-tier injection is a near-trivial wiring change at the Calibrator.
- **`lib/voice.py::VOICE_CONSTRAINTS`** — preserve as literal `UNIVERSAL_CORE + "\n\n" + JESSE_PERSONA_BLOCK` for back-compat with direct importers (Game agent stays on the direct import path since it's Jesse-only).
- **`agents/qa/rubric.md`** + **`agents/qa/judge.py::_load_rubric`** — current import-time load. The single-file pattern survives the per-narrator extension by injecting `narrator.voiceRubric` + `narrator.exampleSamples` as appendages at call time (rubric.md keeps the universal axes; narrator content layers on).
- **`apps/studio/schemas/agentProfile.ts`** — 5-field document type mirroring exactly the pattern `narratorProfile.ts` follows (name/slug/displayName/role/personality/avatar → name/slug/voiceConstraints/voiceRubric/exampleSamples/active).
- **Phase 1 seed pattern** (`apps/studio/scripts/seed-agent-profiles.ts` — verify path) — idempotent `createOrReplace` with deterministic `_id`s like `agent-{agentId}`. Same shape for `narrator-{slug}` doc ids.
- **`charity` dereference pattern in pipeline** — `lib/sanity_client.py` already loads `weeklyIssue.charity` by reference and injects into `state['winning_charity']`. Same pattern for `narrator`.
- **Phase 12 MED-04 machine-readout label convention** — Inter uppercase 0.18em on `--color-text-mute`. Reuse verbatim for the narrator chip.

### Established Patterns
- LangGraph DispatchState extension: add field, add type, no reducer needed for single-write fields. `narrator` is set by Calibrator from Sanity load and read by Calibrator only (per D-05) — minimal state surface.
- Sanity-as-canonical-content + Convex-as-live-machine-log split (Phase 13 D-06): narrator is editorial content → Sanity-only. No Convex schema change.
- Idempotent seed scripts use deterministic `_id` (Phase 1) — same here: `_id: narrator-{slug}`, `createOrReplace`.
- AGT-09 voice-isolation invariant (Phase 5): section writers never read other section output. Narrator awareness flows through the StyleBrief — does NOT introduce cross-section reads. Invariant preserved.

### Integration Points
- **Pipeline:** new `narratorProfile` load in `lib/sanity_client.py` → `state['narrator']` → Calibrator's `assemble_voice()` call → `style_brief["voice"]` → downstream writers + Chronicler + QA all unchanged in their consumption surface.
- **Studio:** new schema file + index registration + seed script + TypeGen run.
- **Web:** GROQ extension (`narrator->{name, slug, active}`) + types + new chip in `IssueHero.tsx` + new tripwire test.
- **No new Convex tables, no new Convex queries, no new Convex schema entries** — the D-14 inactive warning reuses the existing `editor-decision` event surface.

### Constraints inherited from the codebase
- No new npm dependency, no CDN, no new font.
- `theme.ts` validation + `FONT_WHITELIST` + game-sandbox security untouched.
- Cost per run ≤10% over Jesse-default baseline (D-12 sets the budget: ~600 tokens/narrator persona block + samples).
- Game agent stays on the direct `VOICE_CONSTRAINTS` import (per D-07 back-compat preservation).
- All Phase 5/12/13/14/15 tripwires green throughout.

</code_context>

<specifics>
## Specific Ideas

- The client doc's three voice samples (Maya / Herzog / Sorkin on The Nap Ministry) are the human-judgable acceptance bar for "in voice." Read it aloud — does it sound like the narrator or like Jesse-in-disguise? The latter fails.
- Werner Herzog's sample reframes the founder's sabbaths as "one of the few genuinely sane responses to the modern condition I have observed." Aaron Sorkin's sample stages an actual walk-out ("She's already gone."). Maya Rudolph's sample lands "Icon behavior." as a one-line paragraph. These are the moves the persona block must enable.
- The samples respect every UNIVERSAL_CORE rule already — they prove the two-tier model fits without contortions. They were the empirical basis for D-02 selecting all four core rules.
- The Spinning Wheel (SEED-001) is the commerce-side cousin. Andrew picks the narrator here; the reader picks the charity (when SEED-001 wakes). Different governance, different timing.

</specifics>

<deferred>
## Deferred Ideas

- **`/narrators/[slug]` route + narrator profile page** — would show the narrator's name, voice notes, and the issues they've narrated. Natural follow-on once 2-3 narrators are in rotation. Defer to a future phase or backlog seed.
- **Archive filter by narrator** — `/archive?narrator=werner-herzog`. Same trigger as above (volume-dependent). Pairs naturally with the route above.
- **Reader-side narrator pick** — different governance from this phase (which is editorial-only). If wanted, plant as a sibling seed to SEED-001.
- **Game / Bonus / Researcher narrator-awareness** — Researcher is voiceless data; Game and Bonus have separate voice rules. Revisit only if a future phase needs it.
- **Narrator change-history audit log on `weeklyIssue`** — Sanity's built-in revision history already covers it; no custom surface needed unless editorial workflow grows.
- **Hot-swap narrator mid-pipeline** — currently Calibrator reads `state['narrator']` once at pipeline start. Mid-run swap would require Calibrator re-runs. No demand for this; defer.

### Reviewed Todos (not folded)

None — `todo match-phase 16` returned 0 matches.

</deferred>

---

*Phase: 16-choose-your-narrator*
*Context gathered: 2026-05-28 via discuss-phase (interactive — 1 area discussed, 3 Claude's Discretion)*
