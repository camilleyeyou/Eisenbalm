# Phase 16: Choose Your Narrator — INTENT

> Source document: client doc "Eisenbalm Obscure Charity Navigator", "5/26 Ideas" section, sent 2026-05-28.
> This file captures the full client-supplied spec before `/gsd:discuss-phase` and `/gsd:plan-phase` decompose it.
> When you run discuss/plan, read this first.

---

## What the client asked for

Per-issue editorial voice variation. Andrew picks a Narrator per issue (e.g. Jesse, Maya Rudolph, Werner Herzog, Aaron Sorkin), and every narrative section in that issue is produced in the chosen voice. The client doc provided full Maya / Herzog / Sorkin samples for The Nap Ministry's Origin Story, Problem, Founder Bio, and Case Study — these samples are the acceptance reference for "in-voice."

The samples are good. They are not "AI does an impression" good — they are "the voice carries the argument differently" good. Herzog reframes Hersey's sabbaths as "one of the few genuinely sane responses to the modern condition." Sorkin turns the foundation meeting into a Sorkin walk-out. That is the bar.

## Why this fits the existing architecture

**The architecture is uniquely ready:**

- **Phase 13 (`chronicler` agent)** already proves single-call voice-shaping with `VOICE_CONSTRAINTS` injection works. Narrator extends that exact pattern from one section (the deliberation conversation) to four (Origin Story / Problem / Founder Bio / Case Study) plus the chronicler itself.
- **Phase 12 suppressed DesignAgent** — per-issue visual variation is intentionally OFF. **Phase 14 locked the site to a fixed light palette.** The "per-issue variation axis" the product currently lacks is exactly the slot Choose Your Narrator fills, on the voice axis instead of the visual one.
- **Phase 5 (`Agent Quality`)** centralized `VOICE_CONSTRAINTS` and the Jesse-voice QA rubric in the pipeline. Narrator is a controlled, schema-driven swap of those two values per-run, not a rewrite of how agents work.

**Doing this BEFORE Phase 17 (Agentic Chat Origin Story) is correct:** narrator validates voice-variation at the system-prompt level; the chat format then becomes "one more issue format that respects narrator," not a parallel mechanism.

## Goal (verbatim from roadmap)

An issue whose `weeklyIssue.narrator` reference is set to a non-default `narratorProfile` document renders the four narrative sections (Origin Story, Problem Statement, Founder Bio, Case Study) AND the deliberation conversation in that narrator's voice — where "in voice" means (a) QA scores ≥80% on the per-narrator voice rubric, AND (b) Andrew confirms in human UAT the issue reads as that narrator (not Jesse-in-disguise).

When `narrator` is unset, the pipeline produces Jesse voice byte-equivalent to Phase 15-era runs (zero-regression on existing tripwires + pytest).

## Requirements (NRR-* — Narrator)

- **NRR-01**: New Sanity `narratorProfile` document type (parallel to `agentProfile`). Fields:
  - `name` (string, required)
  - `slug` (slug, required, source=name)
  - `voiceConstraints` (text block — the system-prompt constraint that gets merged into StyleBrief, replacing or augmenting Jesse `VOICE_CONSTRAINTS`)
  - `voiceRubric` (text — the per-narrator QA scoring rubric)
  - `exampleSamples` (array of short text blocks proving the voice; used in Studio preview and in the QA rubric as few-shot anchors)
  - `active` (boolean — Andrew can park a narrator without deleting)
- **NRR-02**: `weeklyIssue.narrator` optional reference to `narratorProfile`. Absence = default Jesse voice. Presence = narrator override. Reference field, not embedded — so editing a profile flows to future issues without rewriting old drafts.
- **NRR-03**: Calibrator agent reads `state['narrator']` if set and merges `narrator.voiceConstraints` into the StyleBrief that downstream writers consume. If unset, StyleBrief contains stock Jesse `VOICE_CONSTRAINTS` unchanged (the existing Phase 5 behavior — byte-equivalent).
- **NRR-04**: Each of the four narrative writer agents — **OriginStoryWriter, ProblemWriter, FounderBioWriter, CaseStudyWriter** — reads the narrator-aware StyleBrief and adopts the voice in its system prompt. **ResearcherAgent, GameWriter, BonusWriter are NOT narrator-aware** (research is voiceless; game and bonus may be voiceless or use a separate rule — revisit only if a future phase needs it).
- **NRR-05**: Chronicler agent (Phase 13) reads `state['narrator']` if set and dramatizes the deliberation in that voice — direct extension of the existing single-pass voice-shaping pattern. Falls back to Jesse voice when unset (preserves DEL-CONV behavior byte-compatible — verified by the chronicler tripwire that exists today).
- **NRR-06**: QA agent rubric becomes narrator-aware. If narrator set, QA scores against `narratorProfile.voiceRubric` (with `exampleSamples` as few-shot anchors). If unset, QA scores against the existing Phase 5 Jesse rubric (preserved byte-compatible — the existing rubric is the unset-branch implementation).
- **NRR-07**: Sanity Studio shows a narrator picker on `weeklyIssue` with a "Preview voice samples" affordance that renders `narratorProfile.exampleSamples` inline. Andrew should never have to leave the issue draft to see what each narrator sounds like.
- **NRR-08**: Frontend issue page surfaces narrator attribution under the masthead (e.g. a single chip "Narrated by Werner Herzog"). Non-narrator issues show no chip — default Jesse remains implicit. This is editorial honesty, not a feature flag: the reader sees who is speaking.
- **NRR-09**: Three seeded `narratorProfile` documents minimum at landing — `jesse` (the default, opt-in to be explicit and inspectable), `maya-rudolph`, `werner-herzog`. Plus the schema and seed-script pattern for adding more (Aaron Sorkin and others come from Andrew populating Studio after launch — no code change).
- **NRR-10**: **Zero-regression contract.** With no narrator set, the full Jesse-voice tripwire stack remains green: `game-sandbox`, `no-model-names`, `typography`, `deliberation-conversation`, `podcast-slot`, `theme-aa-tones`. The existing 168-passing pipeline pytest suite remains green. Chronicler output for unset-narrator runs is byte-equivalent to pre-Phase-16 chronicler output given the same inputs.

## Success Criteria (verbatim from roadmap)

1. A `weeklyIssue` with `narrator` → seeded `werner-herzog` profile, run through the full pipeline, produces Origin Story / Problem / Founder Bio / Case Study sections that read as Herzog (QA score ≥80% on Herzog voice rubric, AND Andrew confirms in human UAT).
2. A `weeklyIssue` with `narrator` unset (or set to default `jesse`) produces Jesse-voice content byte-equivalent in behavior to Phase 15-era runs: existing tripwires green AND existing pipeline pytest suite remains green.
3. The deliberation conversation rendered on the issue page reflects the narrator voice when set, and falls back to Jesse voice when unset (Phase 13 DEL-CONV behavior preserved as the default branch).
4. Andrew can pick a narrator in Sanity Studio from a dropdown that previews voice samples, and the choice flows into the next pipeline run without a code deploy.
5. The frontend issue page renders a narrator attribution chip on the masthead when narrator is set, and no chip when unset.
6. No new npm dependency, no CDN, no new font loaded; `theme.ts` validation + FONT_WHITELIST + game-sandbox security all untouched.
7. Cost per run: narrator-aware runs add ≤10% to LLM token spend vs. Jesse-default runs (voice constraint is a small system-prompt delta, not a new round-trip).

## Non-goals (explicit)

- **Reader does NOT pick the narrator.** Editorial choice only (Andrew) — same governance as charity selection. The wheel-style reader-pick belongs to SEED-001, not here.
- **Narrator does NOT vary within an issue.** One narrator per issue, all narrative sections.
- **Narrator does NOT change the visual theme.** Phase 14 light palette remains fixed regardless of narrator. This is a voice-axis feature, not a visual-axis feature.
- **Narrator is NOT a new model.** Same OpenRouter model, same agents — just narrator-aware system prompts.
- **Game and Bonus sections are NOT narrator-aware.** They have their own voice rules; revisit if needed in a later phase.

## Voice samples (acceptance reference)

The client doc provided side-by-side samples of The Nap Ministry's Origin Story / Problem / Founder Bio / Case Study in three narrator voices. Each sample is ~150-300 words. They are the human-judgable bar for "in-voice":

- **Maya Rudolph** — warm, enthusiastic, asides ("Icon behavior", "I gasped. In the best way."), short punchy sentences.
- **Werner Herzog** — sweeping, philosophical, geological-time metaphors ("the way a river is tired after centuries over the same stones"), wry comparisons to opera-builders in jungles, ultimate sincerity.
- **Aaron Sorkin** — walk-and-talks, intercut dialogue, characters who walk out of rooms mid-line, stage directions ("She's already gone").

For Andrew's human UAT, the success bar is: read the section out loud. Does it sound like the narrator, or like someone wearing the narrator as a costume? The latter fails.

The full samples live in the source client doc. They should be reproduced into the `narratorProfile.exampleSamples` field for each seeded profile so QA has anchors to score against and Studio has previews to render.

## Architectural notes for `/gsd:plan-phase`

When the planner decomposes this into plans, the wave order will almost certainly be:

1. **Sanity schema** — `narratorProfile` document type + `weeklyIssue.narrator` ref + TypeGen regen (single short plan)
2. **Narrator seed** — idempotent seed of `jesse` + `maya-rudolph` + `werner-herzog` with verbatim sample blocks (mirrors the Phase 1 `01-06-agent-seed` pattern)
3. **DispatchState + Calibrator** — extend pipeline state with `narrator: NarratorProfile | None`, Calibrator merges narrator.voiceConstraints into StyleBrief (or passes Jesse defaults when None)
4. **Section writer wiring** — make OriginStoryWriter / ProblemWriter / FounderBioWriter / CaseStudyWriter consume narrator-aware StyleBrief. Likely a single plan: the four agents share input shape (precedent: Phase 5 fan-out).
5. **QA + Chronicler narrator-awareness** — QA scores against narrator-aware rubric; Chronicler dramatizes in narrator voice. Likely paired in one plan because both reuse the same "if narrator: use narrator rubric / constraints, else: use Jesse" branch.
6. **Studio picker + preview affordance** — the Sanity Studio UX. Schema-only field is technically enough, but the preview-samples affordance is in the success criteria.
7. **Frontend narrator chip** — issue page masthead chip when narrator is set. Lightweight — token-based styling, inherits Phase 14 light palette.
8. **Zero-regression validation + human UAT** — exercise the unset-narrator path against existing tripwires and pytest; Andrew runs the Herzog UAT.

This is the ESTIMATED structure. `/gsd:plan-phase` should re-derive it based on actual code state and is free to merge or split.

## Open questions for `/gsd:discuss-phase` to resolve

1. **`exampleSamples` as QA few-shot anchors — how many, what length?** The voice rubric is text; the samples are the anchors. QA prompt size and cost depend on this.
2. **Does the chronicler's "narrator override" affect the `{speaker, text}` shape, or only the text contents?** Probably only the text — the speaker labels (Scout / Advocate / Editor) are agent identity, not narrator voice. But worth pinning down.
3. **What happens if a narrator is set but its `active: false`?** Likely: pipeline falls back to Jesse with a warning logged (do not silently honor an inactive narrator).
4. **Do we add a "narrator change-history" log on `weeklyIssue` for editorial audit?** Andrew may switch narrators mid-draft. Probably out of scope for this phase — Sanity history is already there.
5. **Does the frontend chip on the masthead link anywhere?** A `/narrators/[slug]` route showcasing the narrator + their issues is a natural follow-on but probably not required in this phase. Defer to backlog.

## Cross-references

- **SEED-001** ([.planning/seeds/SEED-001-spinning-wheel-of-obscure-charities.md](../../seeds/SEED-001-spinning-wheel-of-obscure-charities.md)) — Spinning Wheel; complementary commerce-side variation idea from the same client doc.
- **Phase 13** (`chronicler`) — voice-shaping pattern this phase extends.
- **Phase 14** (light theme) — visual baseline this phase coexists with unchanged.
- **Phase 5** (Agent Quality) — `VOICE_CONSTRAINTS` and the Jesse QA rubric this phase makes pluggable.

## Source

Client doc: "Eisenbalm Obscure Charity Navigator", "5/26 Ideas" section, "Choose your Narrator Exploration" subsection. The full Maya / Herzog / Sorkin sample tables for The Nap Ministry are the canonical voice reference.
