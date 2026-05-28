# Phase 16: Choose Your Narrator - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 16-choose-your-narrator
**Areas discussed:** Voice-Override Architecture (1 of 4 gray areas presented; 3 captured as Claude's Discretion at user request)

---

## Gray Area Selection

The user was presented with 4 candidate gray areas (multiSelect):

| Option | Description | Selected |
|--------|-------------|----------|
| Voice-override architecture (Recommended) | How narrator overrides Jesse — wholesale replace vs two-tier core+delta. Affects writers + chronicler + QA simultaneously. | ✓ |
| narratorProfile schema + Jesse-as-profile semantics | Fields, exampleSamples shape, whether seeded `jesse` profile mirrors VOICE_CONSTRAINTS or acts as sentinel pointer. | |
| Edge cases: inactive / null / explicit-Jesse / mid-draft swap | What happens on `active: false`; null vs explicit jesse byte-equivalence; mid-draft swap. | |
| Frontend narrator surfacing | Chip copy, `/narrators/[slug]` route now or later, archive filter, chat thread chip styling. | |

**Notes:** User picked only the recommended option — focused discussion on the load-bearing decision. The three unpicked areas were captured as Claude's Discretion in CONTEXT.md (D-08 through D-20) with defensible defaults and rationale.

---

## Voice-Override Architecture

### Q1: How should narrator override the Jesse voice in the prompt?

| Option | Description | Selected |
|--------|-------------|----------|
| Two-tier: universal core + persona (Recommended) | Split VOICE_CONSTRAINTS into UNIVERSAL_CORE (DEL-04, gravity, no sentimentality, no exclamation marks, WINNER AUTHORITY) + PERSONA_BLOCK (register, cadence). Narrator overrides only persona block. Maya/Herzog/Sorkin samples already respect this split. | ✓ |
| Wholesale replace | narratorProfile.voiceConstraints REPLACES VOICE_CONSTRAINTS entirely. Each profile must include DEL-04/gravity/no-sentimentality rules itself. Simplest code, weakest guardrails — a sloppy narrator profile could disable AI-reference rule. | |
| Configurable per-profile (inherit/full-override flag) | Each narratorProfile has `inheritUniversalCore: boolean`. Most inherit; experimental profiles can opt out. Most flexibility, most surface area to test, easiest to get wrong by mistake. | |

**User's choice:** Two-tier: universal core + persona (Recommended)
**Notes:** The client-supplied Maya/Herzog/Sorkin samples were the empirical basis — they universally respect DEL-04, no exclamation marks, no sentimentality words while overriding the surface register. This is exactly what the two-tier model encodes.

---

### Q2: Where does the narrator override get applied in the pipeline?

| Option | Description | Selected |
|--------|-------------|----------|
| Calibrator only (Recommended) | Calibrator reads state['narrator'], assembles voice string (UNIVERSAL_CORE + persona), writes to style_brief['voice']. Downstream writers + Chronicler consume style_brief['voice'] as single string — unchanged surface. Mirrors how voice flows today. Single point of truth. | ✓ |
| Per-agent (every narrator-aware agent reads state['narrator']) | Each narrative writer + Chronicler reads state['narrator'] directly and assembles voice itself. More flexibility (one agent could behave differently per narrator), 5× the surface area to keep in sync. | |
| Hybrid (Calibrator default + per-agent override hook) | Calibrator sets style_brief['voice'] by default; agents can also read state['narrator']. Pragmatic but creates two valid patterns — ambiguity risk. | |

**User's choice:** Calibrator only (Recommended)
**Notes:** Smallest blast radius. Downstream writers + Chronicler stay surface-stable. Zero-regression contract (NRR-10) becomes mechanical: with narrator unset, Calibrator produces byte-equivalent style_brief['voice'] to today.

---

### Q3: What lives in UNIVERSAL_CORE (non-overridable, applies to every narrator including Jesse)?

| Option | Description | Selected |
|--------|-------------|----------|
| No AI references / Jesse-born-AI rule (DEL-04) — Recommended | Non-negotiable. Already enforced by deliberation-no-model-names tripwire. Brand failure if any narrator references AI. | ✓ |
| Fortune-500 gravity (charity + founder) — Recommended | The editorial premise of the entire product. Even Maya Rudolph treats charities with seriousness in the sample. | ✓ |
| Forbidden sentimentality words (heartwarming, inspiring, etc.) — Recommended | These are quality flags, not register flags. The Maya/Herzog/Sorkin samples use none of them. They should fail QA regardless of narrator. | ✓ |
| No exclamation marks — Recommended | Surprising but the samples confirm: even Maya Rudolph's enthusiastic voice never uses one. It's a typographic register rule. | ✓ |

**User's choice:** All four (full lock on UNIVERSAL_CORE)
**Notes:** This is the strongest possible interpretation of UNIVERSAL_CORE. The narrator persona block now has freedom over register/cadence/gestures but cannot weaken any of these editorial guardrails. The full forbidden-adjective and passive-hedging lists from VOICE_CONSTRAINTS also flow into UNIVERSAL_CORE by extension (per CONTEXT.md D-02 elaboration — those are "sentimentality flags" of the same kind).

---

### Q4: Does the WINNER AUTHORITY rule (Phase 13 chronicler) survive in narrator voice?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — universal, narrator can phrase but cannot override (Recommended) | Herzog can be philosophical, Maya enthusiastic, Sorkin theatrical — but Editor's final turn MUST conclude with WINNER named in state. Non-negotiable, lives in UNIVERSAL_CORE. | ✓ |
| Yes — but as a narrator-overridable best-practice, not a hard rule | Allows a narrator profile to relax (e.g. 'open-ended conclusion narrator'). Weaker guarantee that rendered deliberation matches actual editorial decision. | |

**User's choice:** Yes — universal, narrator can phrase but cannot override (Recommended)
**Notes:** Preserves the editorial truth contract. The deliberation conversation MUST end with the winner the pipeline actually chose. Narrator gets to *stage* the conclusion; the conclusion itself is data-true.

---

## Continuation Check

The user was presented with 4 options for next steps after the architecture discussion:

| Option | Description | Selected |
|--------|-------------|----------|
| I'm ready for context — capture my picks + use defensible defaults for the rest (Recommended) | Write 16-CONTEXT.md now. Claude's Discretion defaults: jesse-as-explicit-profile byte-equivalent guarantee; inactive narrator falls back to Jesse + warning; masthead chip with no link; exampleSamples = plain strings. | ✓ |
| One more question about the architecture | Dig deeper — UNIVERSAL_CORE constant placement, prompt-assembly testing strategy. | |
| Quick pass on the edge cases | inactive narrator, mid-draft swap, jesse-explicit semantics. | |
| Quick pass on frontend narrator surfacing | chip copy, /narrators route, archive filter. | |

**User's choice:** I'm ready for context (Recommended)
**Notes:** User trusted Claude's defaults for the unpicked areas. All Claude's Discretion decisions captured in CONTEXT.md sections D-08 through D-20 with rationale per decision.

---

## Claude's Discretion

The user delegated decisions on the three unpicked gray areas. The defaults locked in CONTEXT.md are:

**Narrator Schema + Seeding:**
- D-08: `narratorProfile` at `apps/studio/schemas/narratorProfile.ts`, mirrors `agentProfile.ts` pattern; fields = name/slug/voiceConstraints/voiceRubric/exampleSamples/active.
- D-09: `weeklyIssue.narrator` optional reference; final placement decided in planning.
- D-10: Seeded `jesse` profile explicit-by-construction; seed sentinel asserts byte-equivalence with `JESSE_PERSONA_BLOCK`.
- D-11: Seeded `maya-rudolph` + `werner-herzog` use client-supplied samples verbatim.
- D-12: 3 samples × ~150 words; ~600 tokens/narrator cost budget.

**Edge Cases:**
- D-13: `narrator: null` vs `narrator: jesse-explicit-ref` byte-equivalent by construction (testable invariant).
- D-14: Inactive narrator → fall back to Jesse + logged warning (reuses existing Convex `editor-decision` event surface, no new schema).
- D-15: Mid-draft swap = no behavior; Sanity revision history handles audit.
- D-16: Studio narrator dropdown defaults to "no selection" (= null = Jesse default).

**Frontend Surfacing:**
- D-17: Chip copy "Narrated by {narrator.name}" when narrator is set AND name ≠ "Jesse Eisenbalm".
- D-18: Chip non-interactive in this phase; `/narrators/[slug]` route deferred to backlog.
- D-19: Chip placement under issue title on IssueHero, machine-readout label convention.
- D-20: No new per-turn chip in chat thread; Phase 13 `AGENT_LABELS` already covers it.

---

## Deferred Ideas (also in CONTEXT.md)

- `/narrators/[slug]` route + narrator profile pages
- Archive filter by narrator
- Reader-side narrator pick (different governance — could be a sibling seed to SEED-001)
- Game / Bonus / Researcher narrator-awareness
- Custom narrator change-history audit log
- Mid-pipeline hot-swap narrator
