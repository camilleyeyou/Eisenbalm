# Project Research Summary

**Project:** The Eisenbalm Dispatch — Dispatch Control v2: Editorial Operator Console (v3.0)
**Domain:** Editorial operator console for a single-human-reviewer, AI-generated weekly magazine — galley review, span-anchored annotation, per-claim provenance, multi-sign-off publish gate, LLM eval scoreboard, forensic run monitor
**Researched:** 2026-07-06
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone rebuilds `apps/dispatch-control` from a working-but-thin admin dashboard (Phases 21–29, already shipped) into the complete editorial surface Andrew uses every Thursday: a native galley that replaces the preview iframe, per-section editing that replaces Sanity Studio as the write path, a two-sign-off publish gate that finally closes a real security bypass, per-claim provenance rendering, a dedicated voice/de-slop screen, and an LLM eval harness. Nothing here is greenfield — every recommendation builds on infrastructure that already exists and was verified directly against this repo's code (`convex/schema.ts`, `lib/sanity_client.py`, `api/review.py`, `api/webhooks.py`, `api/control.py`, `api/agents.py`, `agents/researcher.py`, `agents/qa/judge.py`). The stack needs almost nothing new: `@portabletext/react` (already proven in `apps/web`) for the galley, plain React forms (no editor library) for per-section editing, raw `httpx` for asset uploads, and the existing pytest + Convex substrate for evals. The single genuinely hard technical problem is span-level annotation anchoring — QA findings and the new provenance bindings must stay attached to the right text across edits — and the second-hardest is making per-claim provenance survive the 7 parallel section-writer LLM calls without losing or misattributing the source.

The recommended approach, cross-validated across all four research passes, is: (1) keep annotations text-anchored (`quotedSpan`-style) and resolved fresh at render time against live content, never pinned to Sanity's Portable Text `_key`s, because `write_issue_draft()` regenerates every block key on every full-document write; (2) move all content mutation off whole-document `createOrReplace` onto scoped Sanity `patch` calls, per-section, so editing one section never disturbs another section's block identities; (3) establish provenance at LLM-generation time (writer emits a `claimId` reference) rather than reconstructing it after the fact via fuzzy text matching, because post-hoc matching is exactly the failure mode the citation-hallucination literature warns produces false "verified" states; (4) enforce the two-sign-off publish gate at the one true chokepoint — the Sanity webhook handler itself — not just the dashboard's own publish button, because the webhook is what both the legitimate publish flow and the still-open Studio status-flip bypass share; and (5) sequence the rollout so the riskiest changes (native galley, per-section editing, the publish-gate cutover) run in parallel with the existing working paths for at least one full real weekly cycle before anything old is retired — this is a single-operator, hard-Thursday-deadline system, and a big-bang cutover with no fallback is the single most avoidable failure mode identified across the pitfalls research.

The main risks are, in order of severity: (a) annotations silently pointing at the wrong text after an edit, which the resolver-based approach mitigates but does not eliminate — it must degrade to "unresolved," never mis-render; (b) provenance bindings surviving prose rewriting only if writers are given structured claim references to cite, not left to have their output fuzzy-matched afterward; (c) the Sanity Studio publish bypass, which is closed by re-validating sign-off state inside the webhook handler itself, not merely by removing a UI button; and (d) eval-gate rubber-stamping and alarm fatigue from over-flagging, both of which are UX/process risks more than technical ones and need explicit acceptance criteria (readable diffs, severity-driven hierarchy, dismissal-rate tracking) rather than being left as "the scoreboard exists, therefore it's a gate."

## Key Findings

### Recommended Stack

The v2.0 stack (Clerk, Convex, CodeMirror, `@uiw/react-codemirror`, `@xyflow/react`, Tailwind v4, Vitest) is locked and already shipped — this milestone adds a small, low-risk set of packages on top. The single required addition is `@portabletext/react` (pin `^6.2.0` to match `apps/web`), which renders the Sanity draft body as the native galley and exposes the `components.marks` override point needed for QA/provenance overlays. Per-section editing needs no editor library at all — plain React forms (a typed `{type, text}[]` block-row list mapped 1:1 to the existing `BodyBlock` discriminated union) satisfy the locked "structured/plain editing, not inline WYSIWYG" decision. Asset uploads need no widget library — native `<input type="file">` plus a raw-binary `httpx.post()` extension to `lib/sanity_client.py` (Sanity's asset API takes a binary body, not multipart). The eval harness needs no new framework — pytest + pytest-asyncio + respx (already 340+ tests deep) plus additive Convex tables mirror the exact pattern every other operator-facing scoreboard in this codebase already uses. `@dnd-kit` is a deferred-optional addition only if plain reorder buttons prove insufficient in practice.

**Core technologies:**
- `@portabletext/react` `^6.2.0` — native galley rendering — already proven at this exact version/React pairing in `apps/web`, zero-risk add
- `next/font/google` (no separate package) — 1c design system fonts (Newsreader/Lora/Space Grotesk/IBM Plex Mono) — ships with Next 15, feeds Tailwind v4's CSS-first `@theme`
- Plain React forms (no library) — per-section block editing — matches the locked "not inline WYSIWYG" decision and the existing `BodyBlock` shape
- `httpx` (already a dependency) extended in `lib/sanity_client.py` — asset upload proxy — Sanity's binary-body asset API, no new SDK
- pytest + pytest-asyncio + Convex additive tables — eval harness — reuses the existing `test-run`/`score` isolation pattern and `judge.score_output()`

### Expected Features

Full detail in FEATURES.md. The domain synthesis draws on four adjacent categories (CMS editorial workflow, AI-suggestion UX, citation/provenance UI, LLM eval platforms) since no single comparable product combines all of them for a one-operator newsroom.

**Must have (table stakes):**
- Inline annotation with accept / edit / dismiss per finding, severity-ordered (blockers-first)
- Hover-to-reveal provenance card with a first-class sourced/unsourced visual distinction
- Explicit, server-enforced publish gate (not a soft warning) with a full audit trail
- Per-section editing without leaving the review surface
- Unified "what needs me right now" (Awaiting-you) queue

**Should have (competitive differentiators):**
- Native galley (not iframe) with span-level inline annotation — collapses "does it read well" and "is it correct" into one pass
- Voice Pass as its own dedicated, sign-off-gated screen — near-unique among AI-content tools
- Per-claim provenance surviving into rendered prose, not a bolted-on sources list
- Forensic Run Monitor with per-section strength scores and drift-vs-last-8 comparison
- Eval Center: golden scenarios + append-only scoreboard + shadow run, adapted from Braintrust's CI-regression model to a subjective-voice domain

**Defer (v2+ / explicit anti-features):**
- Real-time multiplayer editing, multi-role approval chains, chat-copilot sidebar, bulk-accept-all QA findings, general WYSIWYG, public/multi-tenant eval leaderboard, character-level track-changes, cinematic run-replay scrubber — all explicitly rejected as over-engineering for a single-operator tool

### Architecture Approach

The integration strategy is grounded entirely in verified code facts, not assumptions: Sanity writes are whole-document `createOrReplace` with random Portable Text `_key`s regenerated on every write; QA's `quotedSpan` and claims extraction are already text-matching, not offset-based; provenance today is almost nonexistent (only founder/subject names have source URLs); the publish gate is enforced in exactly one place (`api/review.py`) and the Sanity webhook that the Studio bypass also triggers has zero knowledge of sign-off state; and a single-agent eval isolation pattern (`api/agents.py` test-run/score, `api/control.py`'s checkpoint-fork + bare-node-import) already exists as a template to extend.

**Major components:**
1. **Span-resolver utility (new, shared TS)** — flattens live Portable Text, resolves `quotedSpan`-style text anchors at render time (with normalized-match fallback and "unresolved" degradation), consumed by QA rendering, provenance rendering, and Voice Pass alike
2. **Content-patch endpoint family (new, FastAPI)** — `PATCH /issues/{run_id}/sections/{name}` and sibling routes for structured fields, using scoped Sanity `patch` (not `createOrReplace`) so unaffected sections' block keys are never disturbed; the load-bearing write-boundary change everything else depends on
3. **`sign_offs` Convex table + webhook re-validation (new)** — two independent booleans (facts, voice), enforced both in `api/review.py`'s publish/schedule guard chain and, critically, inside `api/webhooks.py:sanity_publish` itself, since that shared chokepoint is what actually closes the Studio bypass
4. **`provenance_claims` Convex table + Researcher `claims[]` field + post-writer matching pass (new)** — text-keyed (never Sanity-keyed) so it survives the follow-up Sanity-removal milestone unchanged
5. **`eval_runs` Convex table + golden-scenario fixtures (new)** — append-only scoreboard reusing `judge.score_output()` and the existing test-run/checkpoint-fork isolation patterns; drift detection is a query over existing rows, not a new computation pipeline

### Critical Pitfalls

Full detail in PITFALLS.md. Top risks, in priority order:

1. **Span-anchoring drift** — annotations silently point at the wrong text after any edit. Avoid by resolving anchors fresh against live content at render time (never persisting a position), degrading loudly to "unresolved" rather than mis-rendering, and using scoped `patch` writes so unaffected blocks' identities survive edits.
2. **Provenance binding loss across the 7-writer rewrite** — post-hoc fuzzy-matching claim text against final prose risks false "sourced" states, which is worse than false "unsourced" because it tells Andrew something is verified when it isn't. Avoid by pushing claim IDs into each writer's structured output schema (cite-by-reference), never reconstructing bindings after generation.
3. **Dual-write inconsistency / Studio bypass** — "Sanity bypass, not removal" is a documented intent, not an enforced constraint, unless the Studio publish action is actually stripped and the webhook handler independently re-checks sign-off state. Must ship in the same phase as full editing and the two-sign-off gate, not deferred.
4. **Eval-gate rubber-stamping and golden-set overfitting** — a green scoreboard number invites merging without reading the diff, and a fixed golden set naturally gets optimized against rather than generalizing. Avoid with readable before/after diffs (not just a number) and a held-out shadow set not visible to whoever edits prompts.
5. **Big-bang in-place redesign breaking the one working review flow** — this is a hard-Thursday-deadline, no-second-reviewer system; every major new surface (galley, editing, two-sign-off gate) needs a tested fallback to the prior working path for at least one full real weekly cycle before the old path is retired.

**Reconciliation note (span anchoring):** PITFALLS.md's initial recommendation was `_key`+offset anchoring per block/span. ARCHITECTURE.md's code-verified finding overrides this: `lib/sanity_client.py` regenerates Portable Text `_key`s on every whole-document write (`write_issue_draft`, and `rerun_agent`'s full re-sync), so a persisted `_key`+offset anchor would silently orphan after any unrelated section's re-roll or any pipeline re-run — a `_key`-stable-anchoring approach would require rewriting the entire compose path, out of this milestone's scope. **The adopted strategy is ARCHITECTURE.md's**: extend the existing free-text `quotedSpan`/`claim_checks` substring-match pattern with a non-authoritative `blockIndexHint` (ordinal position, not identity string — stable across `createOrReplace` in a way `_key`s are not), resolved fresh against current content at render/edit time, plus scoped `patch` operations for content mutation (which preserve keys where possible and, more importantly, don't force this problem in the first place by only ever touching one section). PITFALLS.md's underlying warning is retained as the risk this strategy must still actively mitigate: re-validate/re-resolve every annotation anchor after any content patch, and surface orphaned/unresolved annotations to Andrew explicitly rather than letting them silently mis-render or silently disappear.

## Implications for Roadmap

Based on ARCHITECTURE.md's dependency-driven build order (three tracks: Review/Editing spine, Signal/Run Monitor, Eval — plus foundational plumbing), FEATURES.md's MVP slice, and PITFALLS.md's sequencing constraint (chrome first, galley parallel-not-replacing, gate last with a soak period), the suggested phase structure is:

### Phase 1: Foundation — Design System + Chrome + Awaiting-You Inbox
**Rationale:** Lowest risk, no data-integrity dependency, builds momentum; everything else is built inside this shell. Also the right place to fix the known `NEXT_PUBLIC_PIPELINE_URL` unset bug (test-run panel likely dead in prod).
**Delivers:** 1c design tokens (ink/cobalt/vermilion/marigold/green + 4 fonts), black masthead, workflow-ordered nav, cross-screen Awaiting-you inbox (pure read-aggregation over existing `awaiting-review`/`awaitingHumanAt`/interrupt/failed-run state — no new backend).
**Addresses:** Design system + chrome, Awaiting-you inbox (FEATURES.md P1, cheapest item in the milestone).
**Avoids:** Pitfall 6 (big-bang redesign) — purely visual work sequenced separately from data-integrity-critical paths.

### Phase 2: Content-Patch Endpoint Family + Full Editing in Dispatch Control
**Rationale:** The load-bearing write-boundary change every later content-mutating feature depends on (accept-fix, Voice Pass rewrites, per-section editing itself). Must exist and be proven with the simplest consumer before layering span-aware consumers on top.
**Delivers:** `PATCH /issues/{run_id}/sections/{section_name}` and sibling structured-field routes (theme, game, PDF data points), using scoped Sanity `patch` (never `createOrReplace`), each audit-logged; asset upload proxy (`upload_asset()` in `lib/sanity_client.py`); plain per-section block-editing forms in dispatch-control.
**Uses:** `httpx` binary POST for assets, `compose_section_body()` reuse, existing `audit_log` shape.
**Implements:** Content-patch endpoint component (Architecture #2).

### Phase 3: Native Galley (read-only render pass) + Span-Resolver
**Rationale:** De-risks the milestone's single highest-complexity item by splitting render-fidelity from mutation-plumbing — ship galley reading EXISTING `qaCorrections` via the resolver, in parallel with (not replacing) the current preview iframe, so Andrew has a fallback for at least one full weekly cycle.
**Delivers:** `@portabletext/react`-based galley rendering the Sanity draft with QA annotations overlaid via the shared span-resolver utility; existing preview iframe path stays live and usable.
**Implements:** Span-resolver utility (Architecture #1); addresses Pitfall 1 and Pitfall 6 directly.

### Phase 4: Accept-Fix Wiring
**Rationale:** Once the galley read-path (Phase 3) and content-patch endpoints (Phase 2) both exist independently, wiring "accept fix" is the natural connective step — and it mechanically de-risks Voice Pass (Phase 7), which is the same span-match → popover → content-patch shape.
**Delivers:** QA finding → span-resolver match → content-patch mutation, scoped to the one section touched.
**Addresses:** Inline annotation accept/edit/dismiss with real content mutation (FEATURES.md table stakes, genuinely new per D-02).

### Phase 5: Two-Sign-Off Publish Gate + Studio Bypass Retirement
**Rationale:** The highest-risk single change in the milestone (per PROJECT.md's own framing). Must ship as one unit with the Studio-side lockdown as an explicit acceptance criterion — not deferred — and must be exercised on at least one real, complete weekly run before the old Studio-flip path is fully retired.
**Delivers:** New `sign_offs` Convex table (facts, voice — two independent booleans); enforcement in BOTH `api/review.py`'s publish/schedule guard chain AND inside `api/webhooks.py:sanity_publish` itself (the actual chokepoint shared by the dashboard publish button and any Studio status-flip); Studio "Publish" document action stripped for `weeklyIssue`.
**Implements:** `sign_offs` table + webhook re-validation (Architecture #3); closes Pitfall 3 (dual-write/bypass) and the associated Security Mistake (trusting client-submitted sign-off state).

### Phase 6: Provenance Pipeline + Sourced/Unsourced Galley Rendering
**Rationale:** Deliberately sequenced after the galley exists (Phase 3) — the pipeline-side work gets an immediate, testable frontend target instead of shipping into a vacuum. The claim-ID-carrying writer-output contract must be locked (per this project's contract-first discipline) before any of the 7 section writers are touched.
**Delivers:** `ResearchOutputModel.claims[]` generalization; each of the 7 writers required to reference `claimId`s in structured output (not free prose); post-writer matching pass producing `provenance_claims` rows; galley renders sourced (marigold, hover-for-source) vs. unsourced (rust) spans via the same span-resolver from Phase 3.
**Implements:** `provenance_claims` table + Researcher claims field (Architecture #4); directly avoids Pitfall 2 (binding loss / false-positive sourcing) by establishing provenance at generation time, not via post-hoc fuzzy matching.

### Phase 7: Voice Pass De-Slop Screen
**Rationale:** Sequenced after accept-fix (Phase 4) specifically because it's mechanically the same feature (span match → rewrite popover → content-patch); building accept-fix first de-risks this phase. Depends on nothing new technically but benefits from the galley/editing UX patterns being settled.
**Delivers:** Dedicated screen reusing the existing two-layer QA detector (`agents/qa/rules.py` + Opus judge); as-written vs. house-voice rewrite popovers; its own sign-off feeding the Phase 5 gate.
**Addresses:** Voice Pass (FEATURES.md differentiator, directly serves the brief's "voice drift = brand failure" constraint).

### Phase 8 (parallel track): Run Monitor v2 + Signal Desk
**Rationale:** No schema or endpoint dependency on the Track A phases above (per ARCHITECTURE.md) — purely additive frontend over `agent_runs`/`agent_run_payloads`/`pitchLog`/the existing `editor_gate_1` interrupt/resume flow. Can be staffed in parallel from day one.
**Delivers:** Forensic spine (agents as dots, code gates as diamonds), handoff inspector, 7-writer expansion with per-section strength scores (new derived metric), run-vs-last-8 drift strip, re-run-from-node; Signal Desk candidate slate + Gate 1 decision panel over existing interrupt/resume (no new pipeline agents — Signal Editor agent and REAL/OBSCURE/SPECIFIC/TELLABLE gates explicitly deferred).

### Phase 9 (parallel track): Prompt Lab Eval Drawer + Eval Center
**Rationale:** Also independent of Track A; reuses `api/agents.py`'s existing test-run/score isolation pattern and `api/control.py`'s checkpoint-fork + bare-node-import pattern for shadow runs. Genuinely new data models (golden scenarios, append-only scoreboard) sit on top of existing endpoints — budget real design time here, don't scope as "just a UI phase."
**Delivers:** Golden-scenario fixture registry; new `eval_runs` append-only Convex table; drift detector as a query (not a new service); readable before/after diff view (not just a trending number) and a held-out shadow set — both hard acceptance criteria per Pitfall 4, not stretch goals. Shadow-run (full production-fidelity comparison) is the highest-effort, lowest-priority sub-feature — defer within this phase if time-constrained.

### Phase 10: Registry Coverage-Memory Strip
**Rationale:** Smallest, least dependent item in the milestone — pure read-side aggregation over the existing `charities` registry (`timesFeatured`, `lastFeaturedAt`, cause/geo tags). Slots in anywhere; fine to land whenever convenient.
**Delivers:** Last-8-issues cause/geo/signal coverage view informing the Signal Desk's Gate 1 decision context.

### Phase Ordering Rationale

- Content-patch (Phase 2) must exist before anything that mutates content (accept-fix, Voice Pass rewrites, per-section editing) — this is a hard dependency found in the code, not a stylistic preference.
- The galley + span-resolver (Phase 3) is shared infrastructure consumed by both accept-fix (Phase 4) and provenance rendering (Phase 6) — build once, prove with the simplest consumer, before layering span-aware features on top.
- Two-sign-off (Phase 5) is schema-independent of Phases 2–4 but is sequenced to land before/alongside the galley's gated Publish UI so the Publish button isn't built twice; its real dependency is the Studio-bypass retirement, not the second checkbox.
- Provenance (Phase 6) is deliberately after the galley, not before, so pipeline-side work has an immediate frontend target.
- Voice Pass (Phase 7) is after accept-fix (Phase 4) because they're mechanically the same feature.
- Tracks B (Run Monitor/Signal Desk) and C (Eval) have zero schema/endpoint dependency on Track A and should be staffed in parallel from day one to avoid unnecessarily serializing independent work.
- Every phase touching the write path (2, 4, 5) must ship with a tested rollback/fallback and a soak period before retiring the prior path (Pitfall 6) — this is a cross-cutting sequencing constraint on the roadmap as a whole, not a single phase's concern, and should be made an explicit verification gate ("N consecutive real weekly issues published via the new gate with zero fallback-to-Studio incidents") before Phase 5's Studio lockdown is considered fully complete.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Native galley + span-resolver):** Highest-complexity item in the milestone; the synthetic-mark-injection technique for arbitrary-substring highlighting in `@portabletext/react` is a standard pattern but not officially documented for this exact use case (MEDIUM confidence per STACK.md) — budget time to prototype `injectAnnotationMarks(blocks, findings, claims)` before committing to a plan.
- **Phase 5 (Two-sign-off gate + Studio bypass retirement):** Security-critical; needs explicit verification steps (attempt the old Studio publish path directly post-ship, attempt a direct forged API call to `/publish`) written into the phase's acceptance criteria, not left implicit.
- **Phase 6 (Provenance pipeline):** Touches all 7 section-writer prompts/schemas simultaneously — contract-first amendment to `docs/API_CONTRACTS.md` required before any writer code changes, and the binding-survival rate should be established as a trackable scoreboard metric from day one of this phase.
- **Phase 9 (Eval Center):** Golden-scenario abstraction and the shadow-set anti-overfitting mechanism are genuinely new design surface, not just new UI on old data — needs real design time before build.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Design system + chrome + inbox):** Well-documented Tailwind v4 `@theme` + `next/font/google` patterns, pure read-aggregation for the inbox — no new integration risk.
- **Phase 2 (Content-patch endpoints):** Direct extension of `upload_pdf_to_issue`'s existing scoped-`patch` precedent in this codebase.
- **Phase 8 (Run Monitor v2 + Signal Desk):** Purely additive frontend over already-instrumented data (`agent_runs`, `agent_run_payloads`, `pitchLog`) — presentation work, not new integration.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified via npm registry/official docs; every recommendation cross-checked against actual `package.json`/`pyproject` state in this repo; the one MEDIUM sub-item is the synthetic-mark-injection technique (standard pattern, not officially documented for Portable Text specifically) |
| Features | MEDIUM-HIGH | Patterns well-established across four adjacent product categories, but no single comparable product combines all of them for a one-operator newsroom — the synthesis connecting them is the researcher's own, not sourced from a single authority |
| Architecture | HIGH | Every finding verified directly against this repo's actual code (not training-data assumptions) — `write_issue_draft`, `sanity_publish` webhook, `rerun_agent`, `api/agents.py` isolation pattern all read and cited with line-level specificity |
| Pitfalls | MEDIUM-HIGH | Grounded in documented architecture patterns (strangler fig, span-anchoring literature, citation-hallucination research, approval-fatigue research) cross-checked against this project's actual schemas and locked decisions; no Context7 library-API research was needed since this is process/architecture-level, not API-surface-level |

**Overall confidence:** HIGH — this is a milestone within an established, well-instrumented product, not greenfield research; nearly every recommendation is an extension of a pattern already proven in this exact codebase.

### Gaps to Address

- **Span-anchoring approach reconciliation:** PITFALLS.md's initial recommendation (`_key`+offset anchors) was superseded by ARCHITECTURE.md's code-verified finding (quotedSpan + blockIndexHint resolver, scoped patches) — see the Reconciliation note above. This is resolved for planning purposes, but the resolver's "second miss → unresolved" fallback behavior and its UX (how "unresolved" is surfaced to Andrew) needs concrete design during Phase 3 planning, not left as an abstract fallback.
- **Provenance binding-survival rate:** No baseline number exists yet for what fraction of Researcher claims currently survive rewriting with a resolvable reference — this should be measured as soon as Phase 6 lands and tracked as a scoreboard metric, not assumed to be acceptable by default.
- **Eval Center shadow-set mechanics:** The "held-out shadow set not visible to whoever edits prompts" mechanism is specified at the concept level (PITFALLS.md Pitfall 4) but needs concrete rotation/sourcing rules (how often refreshed, from which real runs) worked out during Phase 9 planning.
- **`NEXT_PUBLIC_PIPELINE_URL` unset bug:** Called out in PROJECT.md reconciliation facts as a known issue (test-run panel likely dead in prod) — should be fixed early in Phase 1, verified before it silently undermines Phase 9's eval-drawer work later.
- **Sanity role/permission lockdown feasibility:** ARCHITECTURE.md recommends stripping Studio's "Publish" document action as the belt to the webhook guard's suspenders — this is a Sanity-project-config change whose exact mechanism (custom document actions plugin vs. dataset role permissions) should be confirmed against the actual Sanity plan/tier during Phase 5 planning.

## Sources

### Primary (HIGH confidence)
- `convex/schema.ts` — all 24 tables, house patterns for additive tables (read in full)
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` — `write_issue_draft` (full `createOrReplace`), `upload_pdf_to_issue` (scoped `patch` precedent)
- `packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` — block builders, `_key` generation, `compose_section_body`
- `packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` — claim extraction algorithm (template for span/provenance matching)
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py`, `api/webhooks.py`, `api/control.py`, `api/agents.py` — publish gate, webhook bypass, rerun/checkpoint-fork pattern, eval isolation pattern
- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py`, `agents/qa/judge.py` — provenance gap, `JudgeFinding.quotedSpan` shape
- [@portabletext/react — npm](https://www.npmjs.com/package/@portabletext/react), [Sanity Assets API HTTP reference](https://www.sanity.io/docs/http-reference/assets), [Presenting Portable Text — Sanity Docs](https://www.sanity.io/docs/developer-guides/presenting-block-text)
- `.planning/PROJECT.md` — Current Milestone section (scope, locked decisions, reconciliation facts verified in code 2026-07-06)

### Secondary (MEDIUM confidence)
- [Braintrust vs LangSmith (2026) comparisons](https://www.morphllm.com/comparisons/braintrust-vs-langsmith), [Label Studio Enterprise review docs](https://docs.humansignal.com/guide/quality) — LLM eval / annotation-review UX patterns
- [Source or It Didn't Happen: Multi-Agent Citation Hallucination Detection (arXiv 2605.08583)](https://arxiv.org/html/2605.08583), [Collective Hallucination in Multi-Agent LLMs (arXiv 2606.07941)](https://arxiv.org/pdf/2606.07941) — provenance-binding-loss risk
- [Strangler Fig Pattern — AWS/Azure architecture guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html) — incremental-migration sequencing rationale
- [OpenAI to acquire Promptfoo](https://openai.com/index/openai-to-acquire-promptfoo/) — eval-tooling landscape context (not adopted, informed the "why not" for a third-party eval SaaS)

### Tertiary (LOW confidence)
- None flagged — all researchers cross-checked findings against this repo's actual code or multiple independent sources.

---
*Research completed: 2026-07-06*
*Ready for roadmap: yes*
