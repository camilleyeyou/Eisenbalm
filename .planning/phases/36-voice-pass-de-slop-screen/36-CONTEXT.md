# Phase 36: Voice Pass De-Slop Screen - Context

**Gathered:** 2026-07-08
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all four areas accepted as recommended

<domain>
## Phase Boundary

The operator gets a dedicated Voice Pass screen that lights machine-tells and voice violations inline over otherwise-clean prose (with a per-screen tell count), lets them rewrite each tell to house voice (Accept rewrite / Write my own / Keep-not-a-tell) via the existing content-patch machinery, and carries its own "Sounds human" sign-off — distinct from factual clearance — that feeds the Phase 34 publish gate. Detection is two-layer: deterministic rules render instantly, the Opus judge runs on demand, both reusing the existing `agents/qa/rules.py` + `agents/qa/judge.py` rather than a new detector. Requirements: VOX-01, VOX-02, VOX-03, VOX-04.

**Explicitly NOT in scope:** Run Monitor v2 / Signal Desk (Phase 37); changing the factual "Facts cleared" gate (Phase 34, unchanged); the provenance galley (Phase 35, done — Voice Pass is the voice-axis sibling of that factual surface); a brand-new detector (VOX-04 forbids it — reuse QA rules + judge).

</domain>

<decisions>
## Implementation Decisions

### Screen surface & scope
- **D-01: Dedicated `/voice-pass/[runId]` route** (the `/voice-pass` stub route already exists), reusing the Phase 32 galley renderer components (GallerySection / synthetic PortableText). Distinct from the factual Review Desk galley — Voice Pass is the voice-axis surface, Review Desk stays the factual surface.
- **D-02: Same draft prose, rendered galley-style, lit with voice-tell annotations** instead of factual QA annotations — VOX-01's "machine-tells lit inline over otherwise clean prose." Reuses the draft-read + span-resolver + annotation-mark stack from Phases 32-35.
- **D-03: Prose sections only** (same reader-content coverage as the galley); game and podcast are exempt from tell-lighting (no in-iframe span annotation), consistent with Phase 35 D-06.
- **D-03b: Entry from the awaiting-you inbox + a Review Desk link.** Voice Pass is a peer destination to the Review Desk; the two sign-offs (Facts cleared / Sounds human) are earned on their respective surfaces.

### Detection — two-layer (VOX-04)
- **D-04: Rules layer reads existing findings from `qaCorrections` instantly**, axis-filtered to voice axes (sentiment / gravity / irony-signaling / and the new machine-tell axis). These are already computed at pipeline QA time (`agents/qa/rules.py` predicates → `qaCorrections:insert`), so the screen lights them with no round-trip — VOX-04's "deterministic rules render instantly."
- **D-05: Extend `agents/qa/rules.py` with a new `axis="machine-tell"` predicate** carrying an AI-slop lexicon (e.g. "delve", "tapestry", "testament to", "in the realm of", "it's important to note", "navigate the landscape", tricolon / "not only… but also" / em-dash overuse patterns) — the machine-tell half of VOX-01 that the current Jesse-voice forbidden sets don't cover. Keep the lockstep-sync note (rules.py ↔ lib/voice.py ↔ rubric.md) in mind; the machine-tell lexicon is a Voice-Pass-specific addition, not necessarily mirrored into prompt-assembly forbidden sets (Claude's discretion on whether writers should also avoid them at generation time).
- **D-06: Judge layer runs on demand** — a "Run deep check" control calls a new endpoint that re-runs the existing `agents/qa/judge.py` against the current (post-edit) draft, writing voice-axis findings. Instant rules first, judge on click — VOX-04 literal.
- **D-07: Reuse `qaCorrections` as the single finding store**, axis-filtered per screen: Voice Pass shows the voice axes, the Review Desk galley keeps showing the factual axes. No new table. (Confirm the axis taxonomy cleanly partitions voice vs factual; if an axis is ambiguous, planning decides its home — the machine-tell axis is unambiguously Voice Pass.)

### Tell interaction & rewrite (VOX-02)
- **D-08: Suggested rewrite = the judge's `suggestedFix` when present**; for rule-only tells with no fix, an on-click LLM rewrite call generates the house-voice suggestion on demand.
- **D-09: Reuse the Phase 33 `api/findings.py` accept/dismiss endpoints** — Accept rewrite = accept (server-resolved span-replace via Phase 31 content-patch, `ifRevisionID` guard), Write my own = Edit inline (open the section editor), Keep (not a tell) = dismiss with reason "not a tell". Mechanically identical to Phase 33's Accept/Edit/Dismiss; no new voice-specific mutation path.
- **D-10: Reuse the AnnotationMark popover** for the as-written vs suggested-house-voice comparison (the Phase 32/33 component gains a voice-tell presentation variant), not a separate diff panel.
- **D-11: Accepting a rewrite auto-revokes the "Sounds human" sign-off** — it's a content mutation, and Phase 34 D-08 already revokes active sign-offs on every content-patch. Andrew re-signs after reviewing. Consistent with the factual side; no special-casing.

### "Sounds human" sign-off (VOX-03)
- **D-12: Prerequisite-gated sign-off** (upgrades Phase 34 D-05's interim ungated attestation now that voice IS machine-checkable): "Sounds human" is enabled only when **zero open error-severity voice/machine-tell findings** remain (resolved or dismissed). Judge warnings (subjective style notes) do NOT block — mirrors Phase 33's error-blocks / warnings-don't pattern. This is the "before it counts as sounds human" in the phase goal.
- **D-13: Signed on the Voice Pass screen**, writing the same `sign_offs` row `kind='sounds-human'` that DecisionRail reads (Phase 34 D-05 anticipated Voice Pass "becomes where the sign-off is earned"). DecisionRail reflects the same green/red live via Convex; the Phase 34 publish gate contract is unchanged (it already requires both sign-offs).
- **D-14: Server-enforced prerequisite** — the sign-off endpoint enforces "no open error-severity voice findings for the run" server-side (mirrors facts-cleared's Phase 34 D-01 server check), not merely a disabled button. UI-only gating would be cosmetic.

### Claude's Discretion
- Exact machine-tell lexicon contents + regex shapes; whether writers also avoid them at generation time (lib/voice.py) or only Voice Pass flags them.
- The on-demand judge re-check endpoint shape + the on-click rewrite endpoint shape (contract-first: amend `docs/API_CONTRACTS.md` before code — CLAUDE.md hard rule).
- The exact voice-axis set that routes to Voice Pass vs Review Desk (the axis partition); per-screen tell-count computation.
- AnnotationMark voice-variant layout; Voice Pass route chrome; whether the "Run deep check" and rewrite calls stream or block.
- How the sign-off endpoint names its 409 detail for the "open voice findings" prerequisite.

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 36 — goal + 4 success criteria.
- `.planning/REQUIREMENTS.md` — VOX-01..VOX-04 (MON-*/SIG-* are Phase 37 — do not pull in).
- `.planning/PROJECT.md` §Current Milestone — locked v3.0 decisions (write boundary, "nothing silent", two mandatory sign-offs).

### Prior phase contexts (direct dependencies)
- `.planning/phases/34-two-sign-off-publish-gate-studio-bypass-retirement/34-CONTEXT.md` — D-05/D-06 (interim "Sounds human" attestation this phase upgrades in place), D-01 (facts-cleared server-gated prerequisite pattern D-14 mirrors), D-08 (content-mutation auto-revokes sign-offs — D-11 relies on it), the `sign_offs` table shape.
- `.planning/phases/33-accept-fix-wiring-decision-rail/33-CONTEXT.md` — D-02/D-05 (findings.py accept/dismiss endpoints D-09 reuses), the AnnotationMark action-row popover (D-10), DecisionRail composition.
- `.planning/phases/32-native-galley-read-only-span-resolver/32-CONTEXT.md` — D-06/D-13 (galley renderer + stateless span resolver D-02 reuses), D-07 (severity annotation colors), D-10 (AnnotationMark popover).
- `.planning/phases/35-provenance-pipeline-sourced-unsourced-galley-rendering/35-CONTEXT.md` — D-06 (prose-only coverage precedent for D-03), the qaCorrections-as-shared-store pattern.

### Design handoff (binding)
- `docs/design/dispatch-control-v2/README.md` §Voice Pass (line ~52: the two separate sign-offs, "Publish requires both greens"; machine-tell lighting; per-screen tell count) — the visual north star.
- `docs/design/dispatch-control-v2/DECISIONS.md` — "Two sign-offs, both mandatory, neither can be skipped."
- `docs/design/dispatch-control-v2/Dispatch Control.dc.html` — 1c tokens for the Voice Pass chrome + tell annotations.

### Contract boundary (hard rule)
- `docs/API_CONTRACTS.md` — amend BEFORE code: the on-demand judge re-check endpoint, the on-click rewrite endpoint, any new `qaCorrections` axis value(s) for machine-tell, the sign-off endpoint's new "open voice findings" prerequisite.

### Existing code (build on these)
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/rules.py` — deterministic predicates (`check_exclamation_marks`, `check_sentiment_keywords`, `check_winking`, `check_ai_reference`, `check_unverified_name`); `QAFinding{severity, axis, quotedSpan, reason}`; D-05 adds the machine-tell predicate here.
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` — `run_llm_judge`, `JudgeFinding{axis, severity, quotedSpan, suggestedFix?}` (axes incl. voice/gravity/sentiment/irony-signaling/cross-section-consistency/structural-variety); D-06's on-demand re-check invokes this.
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/__init__.py` — the QA agent node + `_finding_to_qa_correction` write path (how findings reach `qaCorrections`).
- `packages/pipeline/src/eisenbalm_pipeline/api/findings.py` — Phase 33 accept/dismiss endpoints (D-09 reuse); the Clerk-JWT + audit + 409 pattern for the new judge/rewrite/sign-off endpoints.
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py` — Phase 34 sign-off endpoints (`POST /issues/{run_id}/sign-off`); D-14 adds the "open voice findings" prerequisite for `kind='sounds-human'`.
- `convex/schema.ts` — `qaCorrections` (axis-filtered store, D-07), `sign_offs` (D-13). `convex/qaCorrections.ts`, `convex/signOffs.ts` — query/mutation surfaces.
- `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/_components/` — `Galley.tsx`, `GallerySection.tsx`, `AnnotationMark.tsx` (D-10 variant), `DecisionRail.tsx` (sign-off reflect), `SectionEditorPanel.tsx` (Edit-inline target, D-09).
- `apps/dispatch-control/lib/galley/spanResolver.ts` + `syntheticPortableText.ts` — the resolver/mark stack Voice Pass reuses (D-02).
- `apps/dispatch-control/app/(dashboard)/` — the `/voice-pass` stub route to build out (D-01).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **QA detection already exists** — `rules.py` (deterministic, severity='error', axis-tagged) + `judge.py` (Opus, suggestedFix) both write to `qaCorrections`. VOX-04's two layers already exist; this phase adds the machine-tell axis + a screen + an on-demand judge trigger.
- **Galley render + resolver + popover** — Phases 32-35 built the entire span-match → annotate → popover → content-patch stack; Voice Pass is the voice-axis reuse of it.
- **Accept/dismiss endpoints** — Phase 33 `findings.py` accept/dismiss + Phase 31 content-patch machinery cover VOX-02's actions with zero new mutation logic.
- **Sign-off infrastructure** — Phase 34 `sign_offs` table + `signOffs.ts` + `POST /sign-off` + the facts-cleared server-gate pattern; D-12/D-14 clone that pattern for 'sounds-human'.
- **`/voice-pass` stub route already scaffolded** (seen in the dispatch-control build route manifest).
- **Sign-off auto-revoke on mutation** — Phase 34 D-08 already fires on content-patch, so accept-rewrite revoking the sounds-human green (D-11) is free.

### Established Patterns
- Contract-first: amend `docs/API_CONTRACTS.md` before endpoint/schema code.
- "Nothing silent": every accept/dismiss/sign-off/revocation gets an audit row.
- Server-enforced gates, never just a disabled button (Phase 26 Pitfall 6, Phase 33 D-14, Phase 34 D-01).
- Error blocks / warnings don't (Phase 33) — D-12 applies it to the voice sign-off.
- Reuse-in-place over new surfaces (rules.py, judge.py, qaCorrections, findings.py, AnnotationMark).
- Run `pnpm --filter dispatch-control build` (strict type-check) before declaring frontend work done — vitest doesn't type-check.
- **Parallel worktree caution:** a wave run in isolated worktrees strands code on per-agent branches — verify code is on master + reconcile before the next wave (see the galley/rail reassembly in Phase 35).

### Integration Points
- `/voice-pass/[runId]` — new screen mounting the galley renderer with voice-axis annotations.
- `agents/qa/rules.py` — new machine-tell predicate (pipeline QA run seeds the findings).
- `qaCorrections` — axis-filtered by both Voice Pass (voice) and Review Desk (factual).
- `api/review.py` sign-off endpoint — new 'sounds-human' prerequisite (D-14).
- `DecisionRail.tsx` — reflects the now-earned 'sounds-human' green; Phase 34 publish gate unchanged.

</code_context>

<specifics>
## Specific Ideas

- Design README §Voice Pass is the visual north star: machine-tells lit inline over clean prose, per-screen tell count, "Publish requires both greens."
- The phase goal's operative clause — "before it counts as 'sounds human'" — is why D-12 gates the sign-off on zero open error tells (upgrading Phase 34's interim ungated attestation).
- VOX-04 is explicit and binding: "reusing the existing QA rules + Opus judge rather than a new detector." No parallel detector — extend rules.py, invoke judge.py on demand.
- The two sign-offs are deliberately independent surfaces: Facts cleared on the Review Desk (factual axes), Sounds human on Voice Pass (voice axes), both writing `sign_offs`, both mandatory for publish.

</specifics>

<deferred>
## Deferred Ideas

- **Run Monitor v2 / Signal Desk** — Phase 37.
- **Writers avoiding machine-tells at generation time** (lib/voice.py forbidden-set mirror) — Claude's discretion within this phase or a follow-up; the detection surface is the phase's core.
- **A dedicated `voice_findings` table** — considered, not chosen (D-07 reuses qaCorrections axis-filtered); revisit only if the axis partition proves leaky.
- **Streaming judge/rewrite responses** — Claude's discretion; not a phase requirement.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 36-voice-pass-de-slop-screen*
*Context gathered: 2026-07-08 via smart discuss (autonomous)*
