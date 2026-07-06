# Feature Research

**Domain:** Editorial operator console for a single-human-reviewer, AI-generated weekly magazine (galley review, provenance, multi-sign-off publish gate, LLM eval scoreboard, forensic run monitor, "awaiting-you" inbox)
**Researched:** 2026-07-06
**Milestone:** v3.0 Dispatch Control v2 — Editorial Operator Console
**Confidence:** MEDIUM-HIGH (patterns are well-established across four adjacent product categories — CMS editorial workflow, AI writing-assistant suggestion UX, citation/provenance UI, and LLM eval platforms — but no single comparable product combines all of them for a one-operator newsroom; synthesis is mine)

---

## Scope Reminder

This file covers ONLY the NEW v3.0 capabilities listed in PROJECT.md's Current Milestone section. The following are already shipped (Phases 1–27) and must not be re-researched or re-scoped:

- Runs dashboard with per-node forensics (`agent_runs`, `agent_run_payloads` — cost/latency/tokens/truncated I/O)
- Prompt versioning + test-run + voice scoring (`prompt_versions`, `/{agent_key}/test-run`, `/score`)
- Review gate: preview iframe + claims checklist + approve/schedule/reject (`/issues/{run_id}/publish|schedule|reject`, `claimChecks`)
- Charity registry (candidate/featured/blocklisted, dedup, `timesFeatured`/`lastFeaturedAt`)
- Budget caps, notifications (email/Slack), audit log (`audit_log`, `review_actions`)
- LangGraph interrupt/resume at the candidate-selection gate (`editor_gate_1`, `/run/{id}/resume`)
- 18-node pipeline itself (calibrator → scout → advocate → editor_gate_1 → chronicler → researcher → verify_research → 7 writers → validate_sections → qa → editor_final → publisher)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features Andrew (the one operator) will assume exist because every adjacent tool category already has them. Missing these makes the console feel like a toy compared to Grammarly/Contentful/LangSmith, which is the implicit bar the committed 1c design sets.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Inline annotation with accept / edit / dismiss per finding | Every AI-suggestion surface (Grammarly, Google Docs Suggesting Mode, Label Studio review) offers exactly these three verbs on a per-item basis; anything less (e.g. only "acknowledge") reads as unfinished | MEDIUM | `qaCorrections` already carries `{severity, axis, quotedSpan, reason, suggestedFix, accepted}` but is annotation-only (`accepted: boolean`, no content mutation) per existing D-02. "Accept fix" that mutates content is genuinely NEW: needs a pipeline content-patch endpoint, not just flipping a Convex boolean. "Edit" (operator writes their own replacement) and "dismiss with reason" are cheaper additions |
| Dismiss requires (or strongly nudges) a reason | Label Studio's enterprise review flow ties rejection to "the exact rule that applies... what was missing"; reason capture is what makes QA improvable over time (feeds prompt tuning later) | LOW | Add free-text `dismissReason` to the corrections row; don't hard-block on it — a rushed operator shouldn't be stopped by a mandatory field, but the field should exist |
| Blockers-first triage (severity ordering; can't-miss items surfaced before minor ones) | Every review queue (Label Studio, LangSmith failing-eval lists, code review tools) sorts by severity/status first; a flat unordered list of findings is a known UX failure mode | LOW | `severity: info/warning/error` already exists — the "decision rail" is mostly grouping/sorting by it and gating: unresolved `error` findings block the publish CTA |
| Hover-to-reveal source / provenance card | Now the dominant pattern across ChatGPT, Perplexity, Claude, Notion AI — a small marker (chip/underline) revealing title + snippet + link on hover, click-through for full source; users now expect this by default in any AI-generated-text UI | MEDIUM | Requires the NEW provenance pipeline (per-claim `{claim, sourceUrl, retrievedAt}` bindings from Researcher) before the UI has anything to hover over — correctly scoped in PROJECT.md as its own workstream, not just a UI task |
| Distinguishable "sourced" vs "unsourced" states | Once provenance is shown at all, an ungrounded claim with no visual distinction from a grounded one is a known trust-eroding gap (see research on source attribution in LLM deep-research agents) — users generalize "no citation shown = maybe made up" | LOW-MEDIUM | PROJECT.md already specifies this correctly (marigold=sourced/hover, rust=unsourced) — keep it a first-class two-state system, not a "sometimes shows a citation" afterthought |
| Explicit publish gate state (can't publish until conditions met) | Contentful's Draft→Review→Approved→Published workflow, Label Studio's review-before-accept, and essentially every enterprise CMS enforce a hard gate rather than a soft warning | LOW (mechanically) / MEDIUM (enforcement) | Single-sign-off gate already exists (`claimChecks:allSignedOff` → 409 otherwise) — extending to two independent boolean sign-offs is additive. The hard part is closing the Studio bypass (retiring the direct status-flip publish path), since that's the real security boundary, not the UI checkbox |
| Audit trail / who-signed-what-when | Contentful and most enterprise workflow tools sell "audit trails" as baseline, not a differentiator; `review_actions` + `audit_log` already exist in this codebase | LOW | Pure extension of existing tables — add sign-off events as a new `review_actions` row type |
| Per-section editing without leaving the review surface | Editorial tools (Contentful, WordPress) let you edit inline from the review/preview screen, not force a context-switch to a separate CMS | MEDIUM-HIGH | Explicitly scoped as "per-section, not inline WYSIWYG" this milestone — correct scope discipline; still requires a new mutation surface for every section's structured fields + asset upload, which is real work even without WYSIWYG |
| Cost/latency/status visibility per pipeline step | LangSmith and Braintrust both treat per-node latency/cost/token visibility as baseline observability, not a premium feature | LOW | Already built (`agent_runs` cost/duration/tokens) — Run Monitor v2 is mostly presentation work (dots/diamonds/sparklines) on existing data, EXCEPT the per-section "strength score," which is new |
| Eval regression check before a prompt change goes live | Both LangSmith and Braintrust converged on this as non-negotiable — "is this prompt change actually better" via fixed golden datasets + scoring is the central loop of every serious prompt-ops tool in 2026 | MEDIUM-HIGH | `prompt_versions` + test-run/score endpoints already exist; NEW work is the golden-scenario dataset abstraction + append-only scoreboard + comparison view, not the underlying scoring call |
| Unified "what needs me right now" queue | Linear's Inbox, Asana's My Tasks, GitHub notifications all provide this cross-surface aggregation; for a single-operator tool whose whole point is "don't make Andrew hunt across screens," this is closer to mandatory than nice-to-have | LOW-MEDIUM | Aggregates existing state (awaiting-review runs, unresolved blockers, stalled Gate 1 interrupts, failed runs) into one list — no new source-of-truth data, just a cross-table read + prioritization |

### Differentiators (Competitive Advantage)

Features that go beyond the "expected" bar and specifically serve the single-operator, voice-quality, weekly-cadence constraints of this product. Most comparable tools are built for teams; this console is built for exactly one person doing final-mile judgment on machine prose.

| Feature | Value Proposition | Complexity | Notes |
|---------|--------------------|------------|-------|
| Native galley (not iframe) with span-level inline annotation | Nobody else in the CMS-review space renders the *actual reader page* with annotations mapped onto real DOM spans — Contentful/Sanity show a form, not the magazine page; this collapses "does it read well" and "is it factually/voice correct" into one pass instead of two (preview tab + separate QA tab) | HIGH | Correctly identified in PROJECT.md as needing "native, not iframe" because inline annotations require span control an iframe can't give across origins; this is the single highest-complexity item in the milestone — text-offset-to-DOM-span mapping is fiddly once the Phase 18 discriminated-union `BodyBlock` (h2/h3/blockquote) is involved |
| Voice Pass as a dedicated screen (machine-tell detection + rewrite popovers) | Generic AI-content tools (Grammarly, Google Docs) do grammar/clarity; almost none specialize in "does this sound like a specific persona and not like an LLM" as a first-class reviewable, sign-off-gated concern — this is close to unique and directly serves the brief's "Voice drift = brand failure" constraint | MEDIUM-HIGH | Reuses the existing two-layer detector (`agents/qa/rules.py` + Opus judge) — the differentiator is surfacing findings as editable rewrite popovers rather than a flat list, plus giving Voice its own sign-off distinct from Facts |
| Per-claim provenance surviving into rendered prose (not just a sources list) | Most AI tools show a "Sources" panel bolted onto the end of an answer (ChatGPT-style); few bind individual claims inline to individual sources through a full multi-agent content pipeline and preserve that binding all the way to a styled magazine page — closer to Perplexity/Semantic-Reader sophistication than typical CMS tooling | HIGH | The real differentiator IS the pipeline work (Researcher emitting bound claims) more than the UI; UI reuses the well-known hover-card pattern. Correctly flagged in PROJECT.md as "the biggest gap" — today only founder/subject names have per-fact source URLs |
| Forensic Run Monitor with per-section strength scores + drift-vs-last-8 | LangSmith/Braintrust show trace/eval data for engineers; nobody shows a *single editorial operator* a run's "shape" (agents as dots, code gates as diamonds) with a rolling drift comparison against recent history — a narrative/trust-building layer on top of observability data most tools leave as raw tables | MEDIUM | Mostly presentation logic on already-collected `agent_runs`/`agent_run_payloads` data; "strength score" per section is new derived data (likely QA-judge-axis-derived) |
| Two-sign-off publish gate as two INDEPENDENT concerns (facts vs voice) | Enterprise CMS approval chains gate on role/stage ("did legal review this"); this gates on two orthogonal quality axes owned by the same person — an unusual but sensible model for a solo operator who must context-switch between "is this true" and "does this sound right" | LOW-MEDIUM | Novel primarily in framing, not mechanism — same server-enforced boolean-AND gate pattern as any multi-approval workflow, just two axes instead of two people |
| Eval Center: golden scenarios + append-only scoreboard + shadow run | Braintrust's CI regression-gate pattern (run eval suite on every prompt change, block if score drops) applied to a *creative-voice* domain rather than a factual-accuracy/RAG domain — most eval tooling targets tool-use/RAG correctness, not "does this still sound like Jesse" | HIGH | Genuinely close to state-of-the-art prompt-ops (Braintrust-style), scoped down to fit the existing `prompt_versions`/test-run substrate — shadow run (test a new prompt against real traffic without publishing) is the highest-value, highest-effort piece |
| Registry coverage-memory (last 8 issues' cause/geo/signal) | Editorial calendars (WordPress, Contentful) track *what's scheduled*, not *what's been thematically over/under-represented*; closer to a diversity/balance dashboard than a calendar — directly serves the "obscure charity" mandate by making pattern-repetition visible to the one human who'd otherwise have to remember 8 weeks of issues from memory | LOW-MEDIUM | Pure read-side aggregation over existing `charities` registry fields (`timesFeatured`, `lastFeaturedAt`) plus whatever cause/geo tags already exist on charity records |
| Awaiting-you inbox as persistent cross-screen chrome, not a page | Most "my work" queues (Linear Inbox, GitHub notifications) are a dedicated page you navigate to; persistent chrome across every screen is a smaller but real UX differentiator for a solo operator who should never "forget" something needs them while deep in an unrelated screen | LOW | Pure frontend composition over existing status flags (`awaiting-review`, `awaitingHumanAt`, interrupt state, failed runs) — no new backend data model |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| Real-time collaborative editing (multiple cursors, presence indicators) | "Feels modern," every trendy editor (Notion, Google Docs, Figma) has it | There is exactly one operator (Andrew). Multiplayer sync (CRDT/OT, presence, conflict resolution) is pure accidental complexity with zero users who need it — and increases risk of the exact kind of bug (lost edits, race conditions) this milestone is trying to avoid by tightening the write boundary | Simple single-editor save (optimistic lock or last-write-wins); if a second reviewer is ever added, revisit then — don't build for a hypothetical team |
| Configurable multi-role approval chains (reviewer → legal → editor-in-chief → publisher) | Enterprise CMS tools (Contentful) sell this as a flagship feature; feels like "growing up" the product | Over-engineering for a one-person newsroom; the two-sign-off gate already models the only two concerns that matter (facts, voice) — adding role/assignment machinery for roles that don't exist yet (PROJECT.md explicitly defers "assignable EIC seat" and Signal Editor) creates UI/data-model surface with no current user | Keep the two-sign-off gate hardcoded to the single operator; if a second reviewer role becomes real, add role-gating as its own future milestone, not speculative now |
| Free-form AI chat / copilot sidebar bolted onto every screen | Trend-chasing ("every tool needs an assistant now"); looks impressive in a demo | Adds a whole new interaction surface (chat state, streaming, prompt-injection surface, cost) orthogonal to the actual job — Andrew's job is *judging* machine output, not chatting with more machine output; a chat box next to a "detect AI slop" tool is tonally and functionally confused | If Andrew wants to know "why did QA flag this," surface QA's existing `reason`/`quotedSpan`/`suggestedFix` fields directly — that's already the explanation, no chat needed |
| Fully automatic "accept all" / bulk-resolve for QA findings | Feels like a time-saver, mirrors Grammarly's "accept all suggestions" | For a product whose core differentiator is "voice drift = brand failure," bulk-accepting machine suggestions about voice/facts without individual review defeats the entire purpose of the human-in-the-loop gate — it would let a bad week ship because triage got tedious | Keep per-finding accept/edit/dismiss; if triage volume becomes real friction, group by axis/section for faster scanning rather than blanket bulk-accept of substantive (error/warning) findings. Bulk-dismiss of `info`-severity noise is defensible; bulk-accept of `error` is not |
| General-purpose WYSIWYG rich text editor with full formatting freedom | "Editors expect a real word processor," matches the Google Docs mental model | PROJECT.md explicitly locks structured/per-section editing over inline WYSIWYG this milestone for good reason: full WYSIWYG re-opens the "wall of undifferentiated prose" problem Phase 18's structural floor (h2/h3/blockquote counts) was built to prevent, and fights the Portable Text / discriminated-union `BodyBlock` model already in place | Per-section structured editing (prose fields mapped to known block types) as scoped; revisit full inline editing only if per-section friction is proven over real weekly cycles |
| Public-facing or multi-tenant eval leaderboard / gamified scoring | Eval tooling (Braintrust, LangSmith) often ships shareable dashboards, leaderboards, team comparison views | There's one operator and one prompt author; a "leaderboard" implies competition or an audience that doesn't exist. Building shareable/public views adds auth surface and scope for a private internal tool | Keep the Eval Center scoreboard append-only and internal; it's a regression-detection log, not a leaderboard |
| Granular per-word diff/track-changes UI (Word-style redlines) for every edit | Feels thorough, mirrors legal/Word workflows | High implementation cost (diff algorithm, diff rendering, accept/reject at token granularity) for content that gets regenerated in structured blocks, not hand-edited character by character — most edits here are "regenerate this section" or "replace this span with the suggested fix," not micro-copyedits | Span-level accept/edit/dismiss (already the QA annotation grain) is the right granularity; don't build character-level track-changes on top of it |
| Full historical "replay every past run" video/timeline scrubber | Forensic Run Monitor could tempt into building a cinematic replay feature | High effort, low marginal value over a static handoff inspector + drift sparkline; a solo operator debugging one run doesn't need a movie, needs the inputs/outputs at each node and how this run compares to recent history | Handoff inspector (human-readable, JSON-behind-toggle) + run-vs-last-8 drift strip, as already scoped — resist scrubber/timeline-video temptation |

## Feature Dependencies

```
Provenance pipeline (Researcher per-claim {claim, sourceUrl, retrievedAt})
    └──requires──> Galley sourced/unsourced hover rendering
                       └──enhances──> Blockers-first decision rail (unsourced claims can be a blocker class)

Native galley (span-level rendering of Sanity draft)
    └──requires──> Full editing in dispatch-control (per-section writes via pipeline API)
    └──requires──> Inline annotation UI (accept/edit/dismiss anchored to spans)
                       └──requires──> Content-patch endpoint (pipeline API mutates a specific section field)
                                          └──requires──> Write-boundary contract (dashboard never touches Sanity directly — already locked in PROJECT.md)

Two-sign-off publish gate
    └──requires──> Existing single-sign-off publish endpoint (`POST /issues/{run_id}/publish`, already built)
    └──requires──> Studio direct-publish path retirement (else gate is bypassable — THIS is the actual hard dependency, not the second checkbox)
    └──enhances──> Voice Pass (Voice Pass sign-off is one of the two gate inputs)

Voice Pass de-slop screen
    └──requires──> Existing QA two-layer detector (rules.py + Opus judge) — already built
    └──enhances──> Two-sign-off publish gate ("sounds human" sign-off)

Run Monitor v2 (forensic spine, per-section strength scores, drift strip)
    └──requires──> Existing agent_runs / agent_run_payloads instrumentation — already built
    └──requires──> Per-section strength score (NEW derived metric, likely from QA judge axis scores)
    └──enhances──> Awaiting-you inbox (stalled/failed runs surface there too)

Prompt Lab eval drawer + Eval Center
    └──requires──> Existing prompt_versions + test-run/score endpoints — already built
    └──requires──> Golden scenario dataset abstraction (NEW)
    └──requires──> Append-only scoreboard storage (NEW, likely new Convex table)
    └──enhances──> Shadow run (shadow run needs the scoreboard to compare against)

Awaiting-you inbox
    └──requires──> Existing status fields across runs/review/registry (awaiting-review, awaitingHumanAt, interrupt state) — already built, pure aggregation

Registry coverage-memory strip
    └──requires──> Existing charities registry (timesFeatured, lastFeaturedAt, cause/geo tags) — already built, pure aggregation
    └──enhances──> Signal Desk candidate slate (informs Gate 1 decision with historical balance context)

Signal Desk (interrupt/adjudication mode)
    └──requires──> Existing editor_gate_1 interrupt + /run/{id}/resume — already built
    └──conflicts with──> Building a new Signal Editor agent or REAL/OBSCURE/SPECIFIC/TELLABLE gates (explicitly deferred — do not combine in same phase)
```

### Dependency Notes

- **Native galley requires full editing + content-patch endpoint:** the galley's whole value proposition (inline accept-fix that actually changes content) is dead on arrival without a pipeline endpoint that can mutate a single section field server-side. Sequence these together — a galley that can only annotate but never apply a fix is a strictly worse version of the existing preview iframe + checklist it's meant to replace.
- **Two-sign-off gate's real dependency is the Studio-bypass retirement, not the second checkbox:** adding a second boolean to the claim-check gate is trivial; the actual security-relevant work is closing the direct Sanity status-flip path in Studio so it can no longer publish without going through the gate. Roadmap this as the load-bearing task, not an afterthought.
- **Provenance pipeline must land before (or in the same phase as) galley hover-card UI:** building the hover-card UI against the *existing* flat `sources[]`/free-text `verifiedFacts[]` shape would need to be thrown away once per-claim binding lands — sequence provenance data model first, or as a tightly coupled pair.
- **Eval Center's golden-scenario + scoreboard abstractions are net-new data models**, even though they sit on top of existing test-run/score endpoints — budget real design time for "what is a golden scenario" (fixed input + expected voice/fact characteristics) before building the UI around it.
- **Run Monitor v2's per-section strength score is new derived data**, not just new UI on old data — likely computed from QA judge axis scores or a dedicated lightweight scorer; don't scope it as "just a UI phase."
- **Awaiting-you inbox and Registry coverage-memory are the cheapest items in the milestone** — both are read-side aggregations over data that already exists in Convex. Good candidates for an early phase to build momentum before the harder galley/provenance/eval work.
- **Signal Desk conflicts with scope creep toward new pipeline agents:** the milestone explicitly defers the Signal Editor agent and new gates — resist folding "just one more gate" into this phase since it's out of scope and would require new pipeline nodes this milestone excludes.

## MVP Definition

Not a traditional "v1 product" MVP since this is a milestone within an established product — reframed as **minimum viable slice of this milestone** that could ship as an internal checkpoint if sequencing needs to break.

### Launch With (v1 of this milestone)

- [ ] Design system + chrome (tokens, masthead, workflow-ordered nav) — everything else is built inside this shell
- [ ] Awaiting-you inbox (cheap, high-value, no new backend) — proves the cross-screen aggregation pattern early
- [ ] Full editing in dispatch-control (per-section, structured fields, asset uploads) via pipeline API — the load-bearing write-boundary change everything else depends on
- [ ] Native galley rendering (read-only pass first: real magazine rendering with QA annotations overlaid, before wiring "accept-fix" mutation) — de-risks the highest-complexity item by splitting render-fidelity from mutation-plumbing
- [ ] Two-sign-off publish gate + Studio bypass retirement — closes the actual security gap; must not ship half-done

### Add After Validation (v1.x of this milestone)

- [ ] Provenance pipeline (per-claim source binding) + galley sourced/unsourced rendering — sequence once galley rendering is proven stable
- [ ] Inline annotation accept-fix mutation (wired to the content-patch endpoint) — once galley read-path and editing endpoints both exist independently
- [ ] Voice Pass de-slop screen — depends on nothing new technically, but benefits from the galley/editing UX patterns being settled first so it doesn't duplicate interaction paradigms
- [ ] Run Monitor v2 forensic spine + drift strip — valuable but not gating anything else

### Future Consideration (defer within or beyond this milestone)

- [ ] Eval Center shadow run (run a new prompt against real traffic without publishing) — highest-effort Eval Center feature; golden scenarios + scoreboard alone deliver most of the regression-safety value
- [ ] Registry coverage-memory strip — genuinely low-risk but also low-urgency; fine to land whenever convenient
- [ ] Signal Desk interrupt/adjudication UI polish beyond functional minimum — backend already exists; UI can be basic first, refined later
- [ ] Any multi-reviewer / role-based approval chain — explicitly anti-feature for now (see Anti-Features), revisit only if a second human reviewer is ever added to the product

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|----------------------|----------|
| Awaiting-you inbox | HIGH | LOW | P1 |
| Two-sign-off publish gate + Studio bypass retirement | HIGH | MEDIUM | P1 |
| Full editing in dispatch-control (write boundary) | HIGH | MEDIUM-HIGH | P1 |
| Native galley (read-only render pass) | HIGH | HIGH | P1 |
| Inline annotation accept/edit/dismiss (QA findings, no mutation yet) | HIGH | MEDIUM | P1 |
| Provenance pipeline (per-claim source binding) | HIGH | HIGH | P1 |
| Galley sourced/unsourced hover rendering | HIGH | MEDIUM | P1 |
| Accept-fix mutation (content-patch endpoint) | MEDIUM-HIGH | MEDIUM-HIGH | P2 |
| Voice Pass de-slop screen | MEDIUM-HIGH | MEDIUM | P2 |
| Run Monitor v2 (spine, handoff inspector, drift strip) | MEDIUM | MEDIUM | P2 |
| Prompt Lab eval drawer + golden scenarios + scoreboard | MEDIUM | HIGH | P2 |
| Registry coverage-memory strip | LOW-MEDIUM | LOW | P2 |
| Signal Desk interrupt/adjudication UI | MEDIUM | LOW-MEDIUM | P2 |
| Eval Center shadow run | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have — either load-bearing (write boundary, publish gate) or the milestone's headline differentiator (galley, provenance)
- P2: Should have — real value, sequenced after P1 dependencies land
- P3: Nice to have — highest effort relative to incremental value; fine to defer past this milestone if time-constrained

## Competitor / Adjacent-Product Feature Analysis

| Feature Area | CMS Editorial Workflow (Contentful/Sanity) | AI Suggestion UX (Grammarly/Google Docs) | LLM Eval Platforms (LangSmith/Braintrust) | Our Approach |
|---------------|----------------------------------------------|--------------------------------------------|----------------------------------------------|--------------|
| Review surface | Form-based document editor, preview is a separate tab | Sidebar suggestion cards + inline underlines on the real document | Trace/run viewer, separate from any "document" concept | Native galley = the real reader page IS the review surface, annotations mapped onto it directly |
| Finding resolution | Comments/tasks, no structured accept/reject verbs | Accept / Dismiss, one-click, per suggestion | Pass/fail per eval case, not an editorial "finding" | Accept-fix / edit / dismiss-with-reason per QA finding, severity-gated |
| Approval gating | Role-based multi-stage (Draft→Review→Approved→Published) | N/A (no publish concept) | CI-style: block merge/deploy if score < threshold | Two independent sign-offs (facts, voice) by the same single operator, server-enforced |
| Source/citation display | N/A (not a citation-generating tool) | N/A | N/A (traces show tool calls, not prose citations) | Per-claim hover-card provenance, sourced/unsourced as first-class visual states (closer to Perplexity/Semantic Reader than any CMS) |
| Regression safety on content-generation changes | N/A (no "prompt" concept) | N/A | Golden dataset + scoring + CI gate is the core loop | Prompt Lab golden scenarios + append-only scoreboard, adapted from Braintrust's model to a subjective-voice domain |
| Cross-surface "what needs me" queue | Notifications/tasks list, often per-space not unified | N/A | Some dashboards have a "failing evals" view, not unified across concerns | Persistent Awaiting-you inbox chrome aggregating review/interrupt/failure/registry states |

## Sources

- [Braintrust vs LangSmith (2026): Scores vs Traces, Eval-First vs Trace-First](https://www.morphllm.com/comparisons/braintrust-vs-langsmith)
- [Braintrust: LangSmith alternatives 2026](https://www.braintrust.dev/articles/langsmith-alternatives-2026)
- [Braintrust: LangSmith vs. Braintrust](https://www.braintrust.dev/articles/langsmith-vs-braintrust)
- [Label Studio Enterprise: Review annotation quality](https://docs.humansignal.com/guide/quality)
- [Label Studio Community: How to accept or reject predictions as annotations](https://community.labelstud.io/t/how-to-accept-or-reject-predictions-as-annotations/422)
- [Prodigy vs Label Studio: regulated industries comparison](https://www.ertas.ai/blog/prodigy-vs-label-studio-regulated-industries)
- [Grammarly Editor user guide](https://support.grammarly.com/hc/en-us/articles/360003474732-Grammarly-Editor-user-guide)
- [Suggest edits in Google Docs](https://support.google.com/docs/answer/6033474?hl=en&co=GENIE.Platform%3DDesktop)
- [Contentful: Content approval workflow — Tasks and comments](https://www.contentful.com/blog/tasks-and-comments-supercharge-your-content-approval-workflow/)
- [Sanity: What are Drafts & Publishing Workflow?](https://www.sanity.io/glossary/drafts--publishing-workflow)
- [Sanity vs Contentful: Why teams are migrating in 2026](https://www.sanity.io/contentful-vs-sanity)
- [AI citation and source UI design patterns for 2026 - AYDesign](https://www.aydesign.ai/blog/ai-citation-source-ui-patterns-2026)
- [Perplexity AI UX Case Study — Citations](https://www.aiuxplayground.com/gallery/perplexity-citations/)
- [Cited but Not Verified: Parsing and Evaluating Source Attribution in LLM Deep Research Agents (arXiv)](https://arxiv.org/html/2605.06635v1)
- [Not All Transparency Is Equal: Source Presentation Effects (arXiv)](https://arxiv.org/pdf/2512.12207)
- Internal: `.planning/PROJECT.md` (Current Milestone section — feature scope, locked decisions, reconciliation facts verified in code 2026-07-06)
- Internal: `convex/schema.ts` (existing `qaCorrections`, `prompt_versions`, `charities`, `agent_runs`, `agent_run_payloads`, `audit_log`, `review_actions` table shapes — used to distinguish "already built" from "genuinely new" for each feature)

---
*Feature research for: Eisenbalm Dispatch Control v2 — Editorial Operator Console*
*Researched: 2026-07-06*
