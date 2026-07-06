# Pitfalls Research

**Domain:** Editorial operator console rebuild — native rich-text annotation UI, multi-agent LLM provenance, CMS-bypass migration, LLM eval gating, single-operator review UX, in-place dashboard redesign
**Researched:** 2026-07-06
**Confidence:** MEDIUM-HIGH (grounded in documented architecture patterns — strangler fig, span-anchoring in collaborative editors, LLM citation-hallucination literature, approval-fatigue research — cross-checked against this project's actual schemas and locked decisions in `.planning/PROJECT.md`. Portable Text `_key` mechanics confirmed against Sanity's own docs. No Context7 library docs were queried since this is an architectural/process research pass, not an API-surface one.)

> Supersedes the prior `PITFALLS.md` (2026-06-21, Mission Control v2.0 — config externalization race conditions). This file is scoped to the v3.0 Dispatch Control v2 milestone only. Retrieve the prior version from git history if v2.0 config-externalization pitfalls are needed for reference.

## Critical Pitfalls

### Pitfall 1: Span-anchoring drift — annotations point at the wrong text after any edit

**What goes wrong:**
QA findings and provenance highlights are anchored to spans of text (`quotedSpan` in the existing `qaCorrections` schema is a literal text-match, not a stable key). The moment Andrew edits a section — even inserting one word before a flagged sentence — every annotation anchored by character offset or substring match silently points at the wrong text, or fails to re-attach at all. Two more specific failure shapes for this system: (1) the round-trip through the FastAPI service (galley edit → pipeline API → Sanity write → galley reload) can re-serialize Portable Text with new `_key`s if the write path regenerates blocks instead of patching them, permanently orphaning every annotation keyed to the old `_key`s; (2) `verify_research`/QA operate on a flattened text view (`_body_to_text` bridges `str`/`list[dict]` shapes per Phase 18), so an annotation's offset is only valid against that specific flattening — pretty-printing, whitespace normalization, or heading/blockquote insertion by an editor shifts every downstream offset.

**Why it happens:**
Character-offset anchoring is the naive default (it's what `quotedSpan`-as-literal-text already does) because it needs no new data model. Teams underestimate how often "just an edit" reflows offsets, and Portable Text's own `_key`-per-block/span design exists precisely to solve this — but only if annotations are keyed to `_key`s (or a `_key` + local character range within that span), not absolute document offsets or raw substring search.

**How to avoid:**
- Anchor every annotation (QA finding, provenance highlight) to `{blockKey, spanKey, startOffset, endOffset}` relative to a single block/span, never to a whole-document character offset.
- Treat `quotedSpan` as a *fallback fuzzy-match display value*, not the source of truth — the source of truth must be the key-based anchor. When keys don't resolve (block deleted/split), degrade to "orphaned — re-locate or dismiss" rather than silently mis-rendering on the wrong text.
- The FastAPI write path for per-section edits MUST use a diff/patch strategy that preserves unaffected blocks' `_key`s (Sanity's `patch()` API, not whole-document `createOrReplace`). This is the single highest-leverage prevention: if `_key`s survive edits, most anchors survive too.
- Recompute/re-validate annotation anchors immediately after every save (server-side), not lazily on next galley load — surface "N annotations couldn't be re-anchored" to Andrew instead of failing silently.
- Since QA findings are generated once per pipeline run (not live per keystroke), version-stamp them: an annotation belongs to `runId` + `sectionVersion`. After an edit, either re-run QA on just that section (cheap, deterministic-rules-only pass) or explicitly mark existing findings for that section "stale — reflects text prior to your edit."

**Warning signs:**
- QA annotation highlights visually land on the wrong sentence, or on punctuation/whitespace, after any manual edit.
- Provenance highlight (marigold/rust) coverage percentage changes after a no-op save (edit-then-immediately-undo).
- `_key` values in Sanity documents change on every save (indicates whole-document rewrite instead of patch).

**Phase to address:**
Native galley rendering + per-section editing round-trip (the phase that introduces the FastAPI edit-write path). This must be solved before Provenance pipeline and Voice Pass ship, since both depend on annotations surviving edits.

---

### Pitfall 2: Per-claim provenance binding breaks across the 7 parallel section-writer rewrite

**What goes wrong:**
The Researcher will emit `{claim, sourceUrl, retrievedAt}` bindings, but those bindings only stay attached to specific *facts* — the 7 section writers (origin story, problem, founder bio, case study, game, bonus, +1) are separate LLM calls that paraphrase, recombine, and re-sequence the Researcher's material into prose. An LLM asked to write engaging copy will restate a sourced fact in different words, merge two claims into one sentence, or drop the claim's precise wording while keeping its substance — at which point naive provenance tracking (e.g., matching claim text against final prose via substring/fuzzy match) loses the binding, and the galley either shows nothing sourced (false "unsourced" — rust when it should be marigold) or, worse, binds the wrong source to a superficially similar but factually different sentence (false marigold — the dangerous direction, since it tells Andrew "verified" when it isn't). This is exactly the mechanism documented in the citation-hallucination literature: reference/claim provenance degrades specifically at the "generate new text conditioned on sourced input" step, and multi-agent pipelines compound this because each writer is a fresh model call with no visibility into the Researcher's structured bindings unless explicitly threaded through.

**Why it happens:**
It's tempting to solve provenance as a downstream NLP-matching problem (extract claims from final prose, fuzzy-match against the Researcher's claim list) because it requires no change to the 7 writer prompts. This is the wrong direction of binding — provenance must be established at generation time (writer says which source it drew from), not reconstructed after the fact by matching text.

**How to avoid:**
- Push claim IDs into the writer's context and require the writer's structured output to carry claim references forward, not just prose. Concretely: give each writer the Researcher's claims as a numbered/keyed list in its prompt, and require the writer's Pydantic output schema to include a parallel `sourcedSpans: list[{text, claimId}]` (or similar) alongside the prose — i.e., make citation a structured output field the model must populate, not something inferred later. This mirrors the existing pattern of `_enforce_structural_floor` validators (Phase 18) — provenance becomes a schema-enforced field, not a post-hoc pass.
- Treat "no claimId reference" as the correct, honest default (unsourced/rust) rather than trying to backfill via similarity search — false negatives (unsourced when actually sourced) are recoverable by Andrew clicking through; false positives (marked sourced when the source doesn't actually support the sentence) are a factual-accuracy failure that undermines the entire "two sign-off" gate.
- Validate at the code-gate layer (like `verify_research`/`validate_sections`) that every `claimId` a writer references actually exists in the Researcher's claim list and that the source URL is still resolvable — reject/regenerate-once on dangling references, the same pattern already used for structural validation.
- Do NOT let the QA judge (Opus) invent or "verify" provenance bindings freely — its role should be flagging unsupported factual claims (existing regex `claim_checks`), not asserting sourcing that the writer itself never claimed.
- Track a binding-survival metric per run (percentage of Researcher claims that arrive at final prose with a resolvable claimId) as a scoreboard number — if it degrades after a prompt change, that prompt change should fail eval gating (ties into Pitfall 4's regression gate).

**Warning signs:**
- Marigold (sourced) highlights that, when hovered, show a source URL clearly about a different fact than the highlighted sentence.
- Binding-survival rate drops after any writer-prompt edit, silently, with no scoreboard alarm.
- The founder/subject-name-only sourcing gap called out in PROJECT.md ("only founder/subject names have per-fact source URLs today") persists after this milestone ships — a sign the new provenance pipeline only threaded through the easy case and left prose claims unsourced.

**Phase to address:**
Provenance pipeline phase, but the schema contract (claimId-carrying writer outputs) must be locked *before* any of the 7 writers are touched — this is a contract-first change per this project's own CLAUDE.md discipline (`docs/API_CONTRACTS.md` amended before code). Sequence it before or alongside the galley phase that renders sourced/unsourced spans, since the galley UI is only as trustworthy as the binding underneath it.

---

### Pitfall 3: Dual-write inconsistency during the Sanity-bypass migration

**What goes wrong:**
The milestone's locked decision is "Sanity bypass, not removal" — the dashboard becomes the write path (`dashboard → pipeline API → Sanity`), but Sanity Studio remains a "read-only fallback." Two concrete ways this breaks: (1) Studio is Sanity's own UI — "read-only fallback" is a documentation intent, not an enforced technical constraint; if Andrew (or anyone) opens Studio and edits a field directly (which Studio always permits — Sanity has no built-in per-field lock), that write bypasses the pipeline API, `audit_log`, and every annotation/provenance state the dashboard thinks it owns, silently desyncing the two views of "truth." (2) The existing Sanity-status-flip publish path (`weeklyIssue.status` → `published` → webhook → PDF/deploy chain) is explicitly called out as still live and bypassing all gates — if it isn't hard-disabled (not just "deprecated in docs"), a flip in Studio (accidental or out of habit) publishes an issue that never passed the two-sign-off gate, defeating the entire point of this milestone.

**Why it happens:**
"Reduce Sanity to a pass-through datastore" is a data-flow intent that's easy to state and easy to leave un-enforced, because CMS platforms like Sanity are designed to be directly editable and don't have a native "disable direct writes, allow only via service-account API" mode without deliberate configuration (role/permission restriction, or removing the schema from Studio's deployed config). Teams also tend to defer "actually lock down the old path" because the pipeline still needs Sanity write access for its own automated writes (draft creation, PDF URL, etc.) — so a blanket lockdown isn't just a flag flip, it requires distinguishing "pipeline service account" writes from "human via Studio" writes.

**How to avoid:**
- Enforce, don't just document: use Sanity's dataset roles/permissions (or a Studio-side custom document actions plugin that removes Publish/Save actions for `weeklyIssue`/relevant types) so a human logged into Studio physically cannot write to the fields the dashboard now owns. If full field-level lockdown isn't feasible this milestone, at minimum strip the "Publish" document action from Studio for `weeklyIssue` so the status-flip path has no UI trigger left — the webhook can stay wired (it's harmless if nothing calls it), but its trigger must be unreachable.
- Add a server-side guard on the Sanity webhook handler itself: reject/no-op a `published` transition unless it was accompanied by evidence of the new gate (e.g., check `claimChecks:allSignedOff` + a new two-sign-off equivalent before running the publisher chain), so even if Studio's UI somehow still fires the webhook, the pipeline-side gate re-checks server-side rather than trusting the Sanity status field as sufficient authorization. (This project already does exactly this pattern for the existing publish gate — 409 unless `claimChecks:allSignedOff` — so extending that re-check to the two-sign-off state is consistent with existing practice, not a new pattern.)
- Log every Sanity write with its origin (pipeline-service-account vs. any other identity) so a Studio-origin write to a "dashboard-owned" field is detectable in `audit_log` even if it can't be fully prevented on day one.
- Do the lockdown in the SAME phase as "Full editing in dispatch-control" ships — not as a follow-up — because the moment dashboard editing exists, a still-open Studio editing path is an active two-writers-one-record hazard, not a theoretical one.

**Warning signs:**
- Sanity Studio still shows a "Publish" button on `weeklyIssue` documents after this milestone ships.
- Any document field editable from both Studio and dispatch-control with no single source of truth for "last writer wins" resolution.
- `audit_log` rows exist for pipeline-service-account writes but there's no way to tell if a document was *also* touched by a Studio-authenticated write in between.

**Phase to address:**
Full editing in dispatch-control + Two-sign-off publish gate phases — these should ship together with the Studio-side lockdown as an explicit acceptance criterion, not deferred to the later "Sanity removal" milestone.

---

### Pitfall 4: Eval-gate rubber-stamping and regression-gate overfitting

**What goes wrong:**
Two related failure modes for the Prompt Lab eval drawer / Eval Center: (1) **Rubber-stamping** — golden scenarios + a regression-gated prompt commit workflow only work as a real quality gate if someone actually reads the eval diff before approving a prompt change. With a single operator on a weekly deadline, the realistic failure mode is Andrew (or whoever edits prompts) glancing at a green scoreboard number and merging, without reading what the golden scenarios actually probe — the same dynamic documented in code-review rubber-stamping research, where repetitive approval-gates degrade judgment regardless of gate quality. (2) **Overfitting to the golden set** — once a fixed set of golden scenarios exists, prompt iteration naturally optimizes against exactly those scenarios (consciously or not), so the scoreboard trends up while real-world quality on the following week's actual (novel) charity/story is unaffected or worse — this is the same well-documented LLM-eval failure where static eval sets stop correlating with production quality once they become the optimization target.

**Why it happens:**
Gates that are cheap to pass "on paper" (a single scoreboard number, a green check) invite passing them cheaply. And golden scenarios are, definitionally, historical/fixed — they can't cover the specific new charity, specific new facts, specific new voice edge case that next week's run will actually contain. Regression gates catch known regressions; they cannot catch unknown-unknowns in a domain (obscure-charity journalism in a fixed satirical voice) that is inherently novel every week.

**How to avoid:**
- Make the gate produce a diff a human can read in under a minute, not just a pass/fail number — show *what changed* in the model's behavior on 2-3 representative scenarios (before/after prose side-by-side), not just an aggregate score. Rubber-stamping is much harder when the artifact in front of you is "here's the actual before/after text" rather than "87 → 89."
- Keep a small shadow set of scenarios *not visible to whoever edits prompts* (rotated in periodically, e.g. from the last few real runs' actual outputs) specifically to catch overfitting — if the visible golden-set score goes up but the shadow-set score doesn't move or drops, that's the actual signal to block the merge.
- Cap how much weekly time is spent per prompt-change review, but require a specific, named checklist item (e.g., "did you read at least one full before/after section, not just the score?") rather than an unbounded free review — this converts an open-ended fatigue-inducing task into a bounded one, which is the documented antidote to approval fatigue.
- Since this is a single-operator system, consider making prompt-commit gating advisory-with-friction (a confirmation step that shows the diff and requires an explicit reason string) rather than a hard CI-style block — a hard block that Andrew can't bypass under Thursday deadline pressure will get "just ship it" workarounds that erode the gate's authority long-term more than an honest advisory friction step would.
- Periodically (not every commit) refresh the golden set itself with recent real runs' good *and* bad outputs, so the set doesn't calcify around whatever prompt style was current when it was built.

**Warning signs:**
- Scoreboard trending up for several consecutive prompt commits while Andrew's own qualitative read of recent issues doesn't feel improved (or feels worse).
- Prompt-commit review time trending toward zero (commits merged within seconds of the eval run completing).
- Golden scenarios never updated since initial creation, despite dozens of prompt commits since.

**Phase to address:**
Prompt Lab eval drawer + Eval Center phase. The shadow-set mechanism and "readable diff, not just a number" requirement should be a hard acceptance criterion for that phase, not a stretch goal — without it, the phase risks shipping a gate that looks rigorous but isn't.

---

### Pitfall 5: Annotation alarm fatigue in the galley (QA + provenance + machine-tell)

**What goes wrong:**
The galley will simultaneously surface QA findings (severity/axis-tagged), provenance state (sourced/unsourced spans), and machine-tell/voice-violation flags (Voice Pass) — potentially dozens of inline annotations across 8 sections in a single issue. If every annotation renders with equal visual weight, or if the QA judge/voice detector is tuned to flag liberally "to be safe," Andrew will rationally start skimming past annotations rather than reading each one — the identical dynamic documented in security alert-fatigue and code-review rubber-stamping research: volume overwhelms judgment regardless of how good the underlying detector is. For a single-operator, Thursday-deadline system, this is especially dangerous because there's no second reviewer to catch what got skimmed past — an ignored "unsourced factual claim" annotation ships straight to publish.

**Why it happens:**
Detector tuning naturally drifts toward over-flagging because false negatives (missed problems) feel worse to the team building the detector than false positives (annotations Andrew dismisses) — but the *cost* of false positives is not zero, it's deferred and compounding: each unnecessary flag makes the next real flag less likely to get read carefully. Two-layer detection (deterministic rules + Opus judge) makes this worse if both layers fire independently on the same text without deduplication — same sentence gets flagged twice for overlapping reasons.

**How to avoid:**
- Rank/collapse, don't just list: severity + axis should drive visual hierarchy so blockers-first is real, not just a label — critical/factual issues visually dominate; minor style nits are collapsed/muted by default and require a click to expand, rather than being inline at equal weight.
- Deduplicate overlapping findings from the two QA layers (rules + judge) before rendering — one annotation per span-and-concern, not one per detector.
- Track and show Andrew's own historical accept/reject rate per axis/severity over time (this project already has `qaCorrections.accepted` as a field) — if a specific axis has a near-100% dismissal rate over several issues, that's a signal to *retune the detector*, not a signal that Andrew is being careless. Treat persistently-dismissed annotation categories as a detector-quality bug, not an Andrew-behavior problem.
- Cap the number of non-blocking annotations shown by default (e.g., show all blockers, but paginate/summarize style-only flags as "12 minor style notes — expand to review" rather than 12 separate inline call-outs).
- For Voice Pass specifically: the "as-written vs. house-voice rewrite" popover pattern is good (it gives Andrew a decision, not just a complaint) — extend that same decision-forward pattern to QA findings, i.e. every annotation should offer "accept fix / dismiss / edit" inline, not just a passive highlight Andrew has to go find an action for elsewhere.

**Warning signs:**
- Annotation count per issue trending upward release over release without a corresponding increase in real accuracy problems.
- Andrew's average time-in-review-screen shrinking while annotation count grows (a sign of skimming, not reading).
- A specific severity/axis with near-100% historical dismissal rate that hasn't been retuned.

**Phase to address:**
Review Desk (native galley) phase for the rendering/hierarchy work; Voice Pass phase for the two-layer dedup and rewrite-popover pattern. The accept/reject-rate feedback loop should be scoped into whichever phase ships `qaCorrections.accepted` reporting to the operator, ideally the same phase as Run Monitor v2's drift strip (both are "look at recent history to catch drift" features and can share plumbing).

---

### Pitfall 6: Big-bang in-place redesign breaks the one working review flow mid-migration

**What goes wrong:**
This is a single-operator, weekly-cadence, Thursday-deadline system — "no issue ships that week" is an explicit named risk in this project's own brief. A full visual + structural rebuild of dispatch-control (new design tokens, new nav, new galley, new editing surface, new publish gate) done as one big cutover risks exactly the failure mode strangler-fig/incremental-migration practice exists to prevent: if the new Review Desk has a bug in, say, the two-sign-off gate's server-side enforcement, and the old review path has been fully removed rather than kept as a fallback, there is no way to review and publish that week's issue at all. Given this team's own working pattern (see Phase 26/27 history: additive schema changes, contract-first amendments, phased waves with verification gates each time), a full big-bang UI cutover would be a departure from established practice, not a continuation of it.

**Why it happens:**
Visual redesigns feel like they should be "all at once" because a half-migrated UI (some screens old chrome, some new) looks unfinished and is uncomfortable to ship incrementally — but that discomfort is aesthetic, not functional, and the cost of getting it wrong (a broken review flow on a hard weekly deadline) is much higher than the cost of a visually inconsistent app for a few weeks.

**How to avoid:**
- Sequence by *capability*, not by *screen* — ship the native galley behind the existing review flow first (parallel to, not replacing, whatever renders review today), let Andrew use it for real issues while the old preview iframe path still works as a fallback, and only retire the iframe path once the galley has proven itself across a few real weekly cycles. This project already has exactly this kind of "flip a var, old behavior returns" reversibility pattern for `DESIGNAGENT_SUPPRESSED` (Phase 12) — apply the same discipline here: every major new surface (native galley, per-section editing, two-sign-off gate) should have a fast, documented rollback to the prior working path for at least one full weekly cycle after it ships.
- The two-sign-off publish gate replacing the Studio-flip path is the highest-risk single change in this milestone (per PROJECT.md's own framing — "Studio flip path currently BYPASSES all gates — must be retired"). Do not retire the old path until the new gate has been exercised on at least one real, complete weekly run end-to-end (not just tests) — keep the old path present-but-logged (or feature-flagged off but not deleted) through that first real cycle, so a rollback is a flag flip, not a re-implementation, if the new gate has a showstopper bug discovered live on a Thursday.
- Design-token/chrome changes (new palette, masthead, nav) are lower-risk and can go first/fastest since they don't touch data-integrity-critical paths — sequence the purely visual work early and separately from the review-gate/editing-write-path work, so a visual regression and a functional regression are never entangled in the same rollback decision.
- Keep the existing screens' underlying data contracts (Convex queries, existing `qaCorrections`/`agent_runs` shapes) stable while the chrome around them changes — this project's own Phase 11-18 history shows a strong existing discipline of "rebuild the component, keep the subscription/data-shape byte-compatible" (e.g., DeliberationSlot rebuilt twice while its 5 Convex subscriptions stayed byte-unchanged both times). Continue that pattern for the operator console rebuild rather than touching UI and data contracts simultaneously.

**Warning signs:**
- A phase plan that removes the old review/publish path in the same wave that introduces the new one, with no overlap window.
- No documented rollback/flag for the two-sign-off gate specifically.
- Visual (design-token) changes and functional (write-path, gate-logic) changes bundled into the same PR/wave, making a visual bug and a gate bug equally hard to isolate and roll back.

**Phase to address:**
This is a sequencing concern for the roadmap as a whole, not a single phase — but it should be made explicit as an ordering constraint: chrome/design-system phase first (low risk), native galley phase in parallel with (not replacing) the existing preview path, two-sign-off gate phase last and only retiring the Studio-flip path after a real-run soak period, ideally flagged as its own milestone-closing verification step ("N consecutive real weekly issues published via the new gate with zero fallback-to-Studio incidents").

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Anchor annotations to `quotedSpan` text-match only (no `_key`/offset model) | Ships galley faster, no schema change | Every edit silently mis-anchors annotations (Pitfall 1) | Never, once per-section editing ships — acceptable only for a read-only, no-edit galley preview |
| Backfill provenance via post-hoc fuzzy text-matching instead of structured writer output | No writer-prompt/schema changes needed | Wrong-binding risk (false "sourced") undermines the entire sign-off gate (Pitfall 2) | Never for factual claims; acceptable only for low-stakes cosmetic highlighting, not for gating publish |
| Leave Sanity Studio's Publish action live "because retiring it is extra work" | Studio stays a full fallback UI with zero config changes | Silent bypass of the new two-sign-off gate (Pitfall 3) | Never past the phase that ships the new gate |
| Single aggregate eval score with no before/after diff view | Fast to build (one number, one gate) | Rubber-stamped prompt commits, undetected regressions (Pitfall 4) | Acceptable only as an early scaffold before Prompt Lab's real UI ships, never as the final UX |
| Flag every possible QA/voice concern "to be safe" (liberal detector tuning) | Feels thorough, avoids missed issues in demos | Alarm fatigue, real flags get skimmed past (Pitfall 5) | Never in production; acceptable only during initial detector calibration against a held-out set, before it reaches the operator |
| Remove the old review/publish path immediately once the new one exists | Cleaner codebase, one path to maintain | No fallback if new gate has a showstopper on a live Thursday (Pitfall 6) | Acceptable only after ≥1 full real weekly cycle has succeeded end-to-end on the new path |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| Sanity Portable Text (galley round-trip) | Whole-document `createOrReplace` on save, regenerating all `_key`s | Patch-based writes (`patch().set()` on specific block/span paths) that preserve unaffected `_key`s |
| Sanity webhook (status-flip publish) | Assuming "retired" means "no longer called from the UI" is sufficient | Add server-side re-validation in the webhook handler itself (re-check sign-off state), since the trigger surface (Studio) can't be perfectly locked day one |
| Convex `qaCorrections` schema | Treating `quotedSpan` as authoritative for re-locating text after edits | Add/require a stable anchor (block/span key + local offset); keep `quotedSpan` as a human-readable label only |
| FastAPI per-section edit endpoint | Editing endpoint accepts/returns plain prose strings, losing the `BodyBlock` discriminated-union structure (h2/h3/blockquote/paragraph) introduced in Phase 18 | Editing endpoint must round-trip the full `BodyBlock` shape, not collapse back to flat text — otherwise editing silently undoes the Phase 18 structural-variety work |
| Researcher → 7 writers claim handoff | Passing claims as unstructured prose context ("here are some facts, cite them if relevant") | Pass claims as a structured, ID-keyed list the writer's output schema must reference explicitly (Pydantic field, not free text) |
| Two-sign-off publish gate | Implementing sign-off as two client-side checkboxes with no server re-check | Server-enforced (like the existing `claimChecks:allSignedOff` 409 pattern) — both sign-off states must be re-verified in `POST /issues/{run_id}/publish`, not trusted from the client |
| Prompt Lab eval scoreboard | Storing only the latest score per prompt version (mutable) | Append-only scoreboard (already the stated design) — mutable "latest score" invites silent overwrite of a regression before anyone notices |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Re-running full QA (rules + Opus judge) on every keystroke/autosave during per-section editing | Slow galley, rising per-edit LLM cost, Andrew waits on every save | Re-run deterministic rules on save (cheap, instant); re-run the Opus judge only on explicit "re-check" action or before publish, not on every autosave | Becomes a real cost/latency problem the first week Andrew does heavy live editing rather than one-shot review |
| Eval Center golden-scenario runs re-executing the full 18-node pipeline per prompt commit | Slow feedback loop discourages actually reviewing diffs (feeds Pitfall 4) | Scope golden scenarios to the single agent/section being changed where possible (unit-level eval), reserve full-pipeline shadow runs for periodic (not per-commit) checks | Becomes noticeable once more than a couple of prompt commits happen per week under deadline pressure |
| Forensic spine (agent_runs/agent_run_payloads) rendering full truncated I/O for every node on every page load | Run Monitor page slow, especially with 7-writer expansion | Lazy-load payload detail only on node click/expand, not eagerly for the whole spine | Noticeable once payload sizes grow (long-read sections with full research context) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting client-submitted sign-off state ("Facts cleared" / "Sounds human") without server re-verification | An operator (or a bug, or a replay) could publish without real sign-off, defeating the entire milestone's purpose | Re-check both sign-off booleans server-side in the publish endpoint, exactly as the existing `claimChecks:allSignedOff` 409 pattern already does — extend, don't replace, that pattern |
| Leaving the Sanity status-flip webhook reachable with no re-validation after "retiring" the UI trigger | Any direct API call to Sanity (misconfigured integration, leaked token, accidental Studio click) can still fully publish, bypassing every new gate | Webhook handler must independently re-verify gate state before running the publisher chain, not assume "nothing calls this anymore" |
| Rendering per-claim source URLs or provenance popovers with unescaped content from LLM output | Stored-content injection risk in the galley (echoes this project's existing game-sandbox security discipline — same class of concern, new surface) | Source URLs and claim text must be rendered as plain text/validated URLs only, never `dangerouslySetInnerHTML`, consistent with the existing DEL-CONV-04 pattern already used for dialogue turns |
| Span-anchor confusion used adversarially or accidentally to make an unsourced claim visually appear sourced (Pitfall 1 + 2 combined) | An operator could approve a factually wrong sentence believing it's verified, because the highlight visually overlaps a plausible-looking (but wrong) span | Fail loud, not quiet, on anchor-resolution failure — an annotation that can't confidently re-locate its span must show as "unresolved," never silently attach to the nearest similar text |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Equal visual weight for blocker vs. minor annotations | Andrew has to read everything to find what matters, encourages skimming (Pitfall 5) | Severity-driven visual hierarchy; blockers-first is a real design constraint, not just a filter option |
| Two-sign-off gate presented as two adjacent checkboxes with no distinct review action behind each | Sign-off becomes a single mental "yep, sure" click — no real double-check | Each sign-off should require its own distinct confirming action (e.g., "Facts cleared" only enables after the claims checklist is fully reviewed; "Sounds human" only enables after Voice Pass has been opened) |
| Provenance shown as binary sourced/unsourced with no confidence gradient | Andrew can't tell "solidly sourced" from "technically has a claimId but weak source" | Consider a lightweight confidence signal (e.g., source domain trust, retrieval recency) surfaced in the hover-for-source popover, not just presence/absence |
| Eval scoreboard shown as a single trending number | Encourages "did the number go up" thinking over reading actual output changes (Pitfall 4) | Pair every scoreboard delta with a linked before/after sample, surfaced by default, not behind a click |

## "Looks Done But Isn't" Checklist

- [ ] **Span-anchored annotations:** Often "done" by rendering correctly against the exact text the pipeline generated — verify by editing a section (insert a word before a flagged span) and confirming the annotation still points at the right sentence, not just that it renders at all on first load.
- [ ] **Per-claim provenance:** Often "done" when the Researcher's claims have source URLs — verify the binding survives by tracing one specific claim from Researcher output through a section writer into final prose and confirming the rendered claimId/source in the galley actually corresponds to that same fact, not just that *some* spans show marigold.
- [ ] **Studio bypass retirement:** Often "done" when the dashboard has a working publish button — verify by attempting the old Studio status-flip path directly and confirming it either can't be triggered or is rejected server-side, not just that nobody uses it in the demo.
- [ ] **Two-sign-off gate:** Often "done" when the UI shows two checkboxes gating a publish button — verify server-side enforcement by attempting a direct API call to `/publish` with sign-off state unset or forged, not just clicking through the UI.
- [ ] **Eval regression gate:** Often "done" when a scoreboard number exists — verify it actually blocks a bad prompt commit by deliberately introducing a regression and confirming the gate refuses/flags it, not just that the score is displayed.
- [ ] **Annotation dedup across QA's two layers:** Often "done" when both the rules engine and the Opus judge produce findings — verify the same sentence doesn't get two overlapping, differently-worded annotations for the same underlying issue.
- [ ] **Rollback path for the new galley/editing/gate:** Often "done" when the new surface works — verify there is an actual, tested way to fall back to the prior review path for one more week if the new one has a live-Thursday showstopper.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Span-anchoring drift discovered in production | MEDIUM | Add a "re-anchor" pass that re-runs the deterministic QA rules against current text and re-emits findings with fresh keys; mark all prior findings for that section as stale/superseded rather than trying to salvage old offsets |
| Provenance binding found to be wrong/misleading after ship | HIGH | Treat as a factual-accuracy incident — audit recent published issues for the same failure pattern, add the specific case to the golden eval set as a regression scenario, and default to "unsourced" (rust) for any binding that can't be re-verified rather than leaving a possibly-wrong marigold highlight live |
| Studio bypass discovered to have published an issue outside the gate | MEDIUM | This is an audit-log incident, not just a bug — the existing `audit_log`/"nothing silent" discipline should make the bypass visible; retroactively lock the Studio action immediately, and treat the incident as the forcing function to finish the lockdown work if it was deferred |
| Eval gate found to have been rubber-stamped for several commits | LOW-MEDIUM | Re-run the current prompt versions against the shadow set (or a freshly sampled real-run set) to establish current actual quality, independent of the possibly-inflated golden-set trend; only then decide whether to roll back any specific prompt commit |
| Annotation alarm fatigue causing a missed real issue | HIGH (reputational/factual, since it likely means a wrong claim shipped) | Post-incident, pull the per-axis historical dismissal-rate data (Pitfall 5's recommended tracking) to identify which category was over-flagged and retune that detector specifically, rather than broadly reducing all annotation volume |
| Big-bang cutover breaks review flow on a live Thursday | HIGH if no fallback exists, LOW if one does | This is exactly why Pitfall 6's fallback-path requirement matters — if followed, recovery is "flip back to the prior path for this week's issue"; if not followed, recovery means a missed issue that week |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase (per PROJECT.md target features) | Verification |
|---------|------|--------------|
| Span-anchoring drift | Native galley + Full editing in dispatch-control | Edit a section, confirm annotations re-anchor correctly (or clearly show as unresolved); confirm `_key`s survive a save via patch-based writes |
| Provenance binding loss through rewriting | Provenance pipeline (contract locked before touching the 7 writers) | Trace a single claim end-to-end from Researcher output to rendered galley span; measure binding-survival rate as a scoreboard metric |
| Dual-write / Studio bypass inconsistency | Full editing in dispatch-control + Two-sign-off publish gate (shipped together) | Attempt the old Studio publish path directly post-ship and confirm server-side rejection, not just UI absence |
| Eval-gate rubber-stamping / overfitting | Prompt Lab eval drawer + Eval Center | Deliberately introduce a regression in a test prompt commit and confirm the gate surfaces a readable diff and can block it; confirm a held-out shadow set exists and is checked |
| Annotation alarm fatigue | Review Desk (galley) + Voice Pass | Track per-axis/severity dismissal rates over several real issues; confirm severity-driven visual hierarchy exists, not flat equal-weight annotations |
| Big-bang redesign breaking a working flow | Cross-cutting roadmap sequencing (chrome first, galley parallel-not-replacing, gate last with soak period) | Confirm a documented, tested rollback exists for each major new surface through at least one full real weekly cycle before the old path is removed |

## Sources

- [Portable Text specification and `_key` mechanics](https://www.sanity.io/docs/developer-guides/beginners-guide-to-portable-text) — confirms `_key`-based stable references are the intended anchoring mechanism, not offsets
- [Portable Text GitHub spec](https://github.com/portabletext/portabletext)
- [Source or It Didn't Happen: A Multi-Agent Framework for Citation Hallucination Detection (arXiv 2605.08583)](https://arxiv.org/html/2605.08583)
- [Detecting and Correcting Reference Hallucinations in Commercial LLMs and Deep Research Agents (arXiv 2604.03173)](https://arxiv.org/html/2604.03173v1)
- [Collective Hallucination in Multi-Agent LLMs (arXiv 2606.07941)](https://arxiv.org/pdf/2606.07941)
- [Approval Fatigue — Encyclopedia of Agentic Coding Patterns](https://aipatternbook.com/approval-fatigue)
- [Please don't rubber stamp code reviews — Chromium dev discussion](https://groups.google.com/a/chromium.org/g/chromium-dev/c/b0Lb_mXfp0Y)
- [Monitoring and Alerting Best Practices to Reduce Alert Fatigue](https://oneuptime.com/blog/post/2026-02-20-monitoring-alerting-best-practices/view)
- [Strangler Fig Pattern — AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/strangler-fig.html)
- [Strangler Fig Pattern — Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/strangler-fig)
- [How to Implement the Strangler Fig Pattern](https://oneuptime.com/blog/post/2026-01-30-strangler-fig-pattern/view)
- [Beyond Golden Datasets: Why Static Evals Miss Critical LLM Failures](https://galileo.ai/blog/beyond-golden-datasets-static-evals-failures)
- [Kinde: CI/CD for Evals — Running Prompt & Agent Regression Tests in GitHub Actions](https://www.kinde.com/learn/ai-for-software-engineering/ai-devops/ci-cd-for-evals-running-prompt-and-agent-regression-tests-in-github-actions/)
- [Automated Prompt Regression Testing with LLM-as-a-Judge and CI/CD — Traceloop](https://www.traceloop.com/blog/automated-prompt-regression-testing-with-llm-as-a-judge-and-ci-cd)
- Project-internal source of truth: `.planning/PROJECT.md` (Current Milestone section, reconciliation facts, and Phase 11–27 shipped-feature history — used to ground every pitfall against this codebase's actual schemas, e.g. `qaCorrections {section, severity, axis, quotedSpan, reason, suggestedFix, accepted}`, the existing `claimChecks:allSignedOff` 409 pattern, and the `BodyBlock` discriminated union from Phase 18)

---
*Pitfalls research for: Eisenbalm Dispatch Control v2 — Editorial Operator Console (v3.0 milestone)*
*Researched: 2026-07-06*
