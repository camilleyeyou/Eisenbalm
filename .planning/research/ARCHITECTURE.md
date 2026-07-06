# Architecture Research — Dispatch Control v2 Integration

**Domain:** Editorial operator console (Next.js dashboard) integrating with an existing LangGraph pipeline + Sanity + Convex system
**Researched:** 2026-07-06
**Confidence:** HIGH (all findings verified against actual code in this repo, not training-data assumptions)

## Grounding: what the code actually does today

These facts drive every recommendation below. Verified by reading `convex/schema.ts`, `packages/pipeline/src/eisenbalm_pipeline/graph/state.py`, `lib/claims.py`, `lib/portable_text.py`, `lib/sanity_client.py`, `api/review.py`, `api/webhooks.py`, `api/control.py`, `api/agents.py`, `agents/researcher.py`, `agents/qa/judge.py`.

1. **Sanity writes are whole-document `createOrReplace`, and Portable Text `_key`s are random on every write.** `write_issue_draft()` (`lib/sanity_client.py`) rebuilds the entire `weeklyIssue` document from `DispatchState` and calls `createOrReplace`. `lib/portable_text.py`'s `block_paragraph`/`block_h2`/`block_h3`/`block_blockquote` each mint a fresh `f'block-{uuid.uuid4().hex[:8]}'` key. `POST /runs/{run_id}/agents/{agent_key}/rerun` (`api/control.py:rerun_agent`) re-runs one section writer, then — per its own docstring — "re-writes the whole Sanity draft from merged state so sibling sections are byte-identical." **Any full-document rewrite regenerates every block's `_key`, in every section, even ones that weren't touched.** Only `upload_pdf_to_issue` uses a scoped Sanity `patch` (targeted `set`), not `createOrReplace`.
2. **QA `quotedSpan` is already free-text, not an offset.** `JudgeFinding.quotedSpan` (`agents/qa/judge.py`) is an LLM-emitted exact substring of the offending text — a string-matching problem already, never a position.
3. **`claim_checks` is the same shape.** `lib/claims.py` extracts `{claimIndex, text, claimType, context}` via three regexes over flattened Portable Text — text + a 60-char context window, no offsets.
4. **Provenance today is nearly nonexistent.** `ResearchOutputModel` (`agents/researcher.py`) has only two paired fact→source fields (`founderName`/`founderNameSourceUrl`, `subjectName`/`subjectNameSourceUrl`); everything else is a flat `sources: list[str]` + free-text `verifiedFacts: list[str]` with zero binding to a claim. There is no mechanism today for a section writer to say "this sentence came from that URL."
5. **The publish gate is enforced in exactly one place, and the Sanity path skips it entirely.** `POST /issues/{run_id}/publish` (`api/review.py`) checks status, `claimChecks:allSignedOff` (409 if not), and `sanityIssueId`, then calls `_flip_sanity_published`. The Sanity webhook handler (`api/webhooks.py:sanity_publish`) that this triggers — and that ANY direct Studio status-flip also triggers — only checks `payload.get("status") == "published"`. It has **no knowledge of sign-off state at all**, and explicitly tolerates `run_id` being `None` ("manually-authored drafts"). This is the exact bypass the milestone must retire.
6. **A single-agent eval substrate already exists and is a good template.** `POST /agents/{key}/test-run` (`api/agents.py`) calls `acomplete()` directly — no graph, no `@agent_node` wrapper, no writes to `agent_runs`/`deliberationEvents`/`pipelineRuns` (an explicit "isolation contract"). `POST /agents/{key}/score` runs `judge.score_output()` against the live active rubric, advisory-only, also writeless. Both are patterns to extend, not replace.
7. **Re-running part of the graph without re-running the whole thing already has a precedent.** `rerun_agent` forks the LangGraph/`AsyncPostgresSaver` checkpoint (`graph.aget_state`/`aupdate_state(as_node=...)`), imports the **bare, undecorated** node function directly (bypassing the `@agent_node` wrapper's real-table writes), and runs it in isolation. This is the shape the eval harness's "shadow run" should reuse.
8. **Every additive Convex table in this codebase follows the same shape**: `workspace_id` scoping, an audit trail via `audit_log` (`actorId`, `before`/`after` JSON), and append-only or upsert-by-key semantics (`claim_checks`, `review_actions`, `payouts`, `notificationsLedger`). New tables for this milestone should match this house style exactly.

---

## 1. Span-anchoring strategy

**Recommendation: quotedSpan string-matching, resolved at render time against current content — not block-key+offset anchors, and not PT marks written into Sanity content.**

### Why not block-key+offset anchors

Fact #1 above is disqualifying on its own: every full-document Sanity write (`write_issue_draft` at pipeline end, `rerun_agent`'s re-roll) regenerates every block's `_key` across the *entire* document, not just the section that changed. An anchor of the form `{blockKey: "block-a1b2c3d4", offset: 120}` persisted in Convex would silently point at nothing after the next re-roll of an unrelated section, or after any pipeline re-run. Making `_key`s deterministic/stable across `createOrReplace` writes would require rewriting `lib/sanity_client.py`'s entire compose path (deriving keys from content hashes or preserving keys from the prior doc read) — a much larger, riskier change than this milestone's stated scope, and one that fights the grain of "Sanity bypass, not removal, this milestone."

### Why not PT marks/annotations written into the content itself

Two reasons, both tied to the locked decisions:
- **Sanity removal is the very next milestone.** Burying review metadata (QA findings, provenance) as `markDefs`/annotations inside the canonical content means that removal has to also migrate or strip that metadata out of every historical document. Keeping it in Convex means Sanity's removal is a pure adapter swap, which is explicitly the reason the write-boundary isolation exists ("this isolation is what makes the later Sanity removal a contained adapter swap" — PROJECT.md).
- **Leak risk.** `PortableTextRenderer` on the public site renders whatever marks exist in the document. A custom `qaFinding`/`provenance` mark type would need to be added to every renderer's allow-list forever, and any miss becomes a reader-visible artifact. Keeping annotations entirely out of Sanity content removes this class of bug outright.

### The recommended approach

Reuse the shape QA and claims already use (facts #2, #3) rather than inventing a new one:

1. Findings/claims are stored in Convex as **`{runId, sectionName, quotedSpan (or claimText), ...metadata}`** — text, not position. This is exactly what `qaCorrections` and `claim_checks` already do; provenance should follow suit (see §2).
2. A **shared span-resolver function** (one TS implementation for the dashboard galley, mirroring the same algorithm already implicit in `lib/claims.py`'s flattening logic) does, at render time:
   - Flatten the current `weeklyIssue.<section>.body` Portable Text into plain text, tracking a `(blockIndex, charStart, charEnd)` map per block (same flattening approach as `_flatten_portable_text` in `lib/claims.py`, just done client-side against live content instead of pipeline-side against `DispatchState`).
   - Exact `indexOf` the `quotedSpan` against that flattened text.
   - On miss, retry with a normalized comparison (collapse whitespace, strip smart-quote variants) — LLM-emitted spans occasionally differ from source by a quote-character or trailing space.
   - On a second miss, the finding is rendered as **unlocated**: still listed in the blockers rail / QA panel, but not highlighted inline. This is a feature, not a bug — it's the natural signal that "the underlying text has since been edited," which is exactly what happens once per-section editing ships.
3. Store an **optional `blockIndexHint`** (ordinal position in the section's block array *at the time the finding/claim was generated*, not a `_key`) alongside `quotedSpan`. Ordinal position is far more stable than a `_key` across `createOrReplace` (block *order* rarely changes on an edit; block *identity strings* always do), and it lets the resolver narrow/disambiguate when the same short substring appears twice in a section. It is a hint, never authoritative — the resolver always re-verifies by string search against current content first.
4. This same resolver is the mechanism for provenance highlighting (§2) and for Voice Pass's as-written/rewrite popovers — one utility, three consumers (QA annotations, provenance highlights, Voice Pass).

**Consequence for content-patch endpoints:** because findings are re-resolved against current content rather than pinned to a persisted position, a content-patch that fixes one QA issue does not require updating other findings' anchors — they simply re-resolve (or fail to, correctly) against the new text on next render.

---

## 2. Where provenance binding should live

**Recommendation: a new Convex table, not Sanity PT marks.** Given the milestone's explicit constraint that Sanity is bypassed-not-removed *this* milestone and removed *next* milestone, provenance must not depend on Sanity's content shape at all.

### New table: `provenance_claims`

Follows the house pattern (`claim_checks`, `review_actions`) exactly:

```
provenance_claims: defineTable({
  workspace_id: v.string(),
  runId: v.string(),
  sectionName: v.string(),
  claimText: v.string(),        // the quotedSpan — resolved the same way as qaCorrections/claim_checks
  blockIndexHint: v.optional(v.number()),
  sourceUrl: v.optional(v.string()),   // present = "sourced"; absent = "unsourced"
  retrievedAt: v.optional(v.string()), // ISO timestamp, from Researcher's search call
  status: v.union(v.literal('sourced'), v.literal('unsourced')),
})
  .index('by_runId', ['runId'])
  .index('by_runId_and_section', ['runId', 'sectionName'])
```

### Pipeline-side change (the actual provenance gap)

The milestone context correctly identifies this as the biggest lift. Recommended shape, minimizing blast radius on the 7 parallel writers:

1. **Extend `ResearchOutputModel`** (`agents/researcher.py`) with a generalized `claims: list[{claim: str, sourceUrl: str, retrievedAt: str}]` field, populated the same way `founderNameSourceUrl`/`subjectNameSourceUrl` already are today (Sonnet asked to cite a source per discrete fact it extracts from Tavily results) — this generalizes an existing pattern rather than inventing one.
2. **Do not require the 7 section writers to emit structured citations.** Requiring every writer's Pydantic model to carry a `sourceRef` per paragraph would touch 7 prompt surfaces at once and directly risks voice drift — the exact failure mode Phase 16/18 went out of their way to avoid (`SECTION_GUIDANCE` additions kept out of `voice_constraints` specifically to protect `VOICE_CONSTRAINTS` byte-equivalence). Instead:
3. **Add one deterministic post-writer matching pass**, structurally identical to `lib/claims.py`'s existing extraction: for each finished section, flatten its Portable Text and, for each `research.claims[]` entry, substring-match `claim` text (normalized) against the section's flattened text. A match writes one `provenance_claims` row `{sectionName, claimText: <matched span in the section>, sourceUrl, retrievedAt, status: 'sourced'}`. This reuses `_flatten_portable_text`-style logic pipeline-side (where `DispatchState` section bodies already exist before the Sanity write) and needs no change to the 7 writers' prompts or output schemas at all.
4. Any extracted fact-like span from `claims.py`'s existing extraction (`claim_checks`) that has **no** matching `provenance_claims` row is implicitly `unsourced` — the galley can compute "sourced vs unsourced" as a diff between the two tables without a third state to maintain, or `provenance_claims` can additionally insert `status: 'unsourced'` rows for unmatched `claim_checks` entries at the same pipeline step, so the galley only ever reads one table.

**Why this survives Sanity removal cleanly:** `provenance_claims` never references a Sanity document ID or a Portable Text key — only `runId` + `sectionName` + text. When content moves to Convex/wherever next milestone, the resolver's flatten-and-match step is unchanged; only the "read current section body" call swaps its source.

---

## 3. Content-patch endpoint design

**Recommendation: per-section granularity, using scoped Sanity `patch` (not `createOrReplace`), with optimistic UI + background reconciliation refetch — not per-block patch, not pure-optimistic-only.**

### Why per-section, not per-block

- Matches the milestone's own locked decision: "Editing v1 is per-section (structured/plain editing that regenerates blocks), not inline WYSIWYG."
- A per-section endpoint can internally regenerate that section's blocks via the existing `compose_section_body()` (`lib/portable_text.py`) — already the exact function the pipeline uses — so dispatch-control and the pipeline share one source of truth for "how do we turn writer-shaped blocks into Portable Text."
- Per-block patch would require the dashboard to reconstruct valid Portable Text block objects (`_type`, `markDefs`, span structure) itself, duplicating pipeline logic in TypeScript for no real benefit at this milestone's stated editing fidelity ("per-section... not inline WYSIWYG").

### Why scoped `patch`, not `createOrReplace`

This is the load-bearing fix suggested by fact #1. `write_issue_draft`'s full-document `createOrReplace` regenerates **every** section's block `_key`s on every write, including sections nobody touched. If content-patch endpoints reused that function, editing Section A would silently reshuffle Section B's block identities — invisible to Andrew, but exactly the kind of churn that (a) makes debugging harder and (b) is unnecessary blast radius for a single-section edit. The fix is mechanical and already has a precedent in this codebase: `upload_pdf_to_issue` issues a scoped `{"patch": {"id": issue_id, "set": {...}}}` mutation touching only the field it needs. New endpoints should do the same:

```
PATCH /issues/{run_id}/sections/{section_name}
  body: { headline?, body: BodyBlock[] }  # same shape section writers already emit
```

- Server: resolve `sanityIssueId` from `pipelineRuns:byRunId` (existing lookup, used identically in `review.py`), compose the new section's Portable Text via `compose_section_body()`, then `patch.set({f"{sectionName}.headline": ..., f"{sectionName}.body": [...]})` — touching only that one field path. Every other section's document data, including block `_key`s, is untouched.
- **"Accept fix" reuses the same endpoint**, computed from the QA finding's `suggestedFix`: resolve the finding's span (§1's resolver) against the CURRENT section body, splice in the corrected text for that one block, and `PATCH` just that section. Because the patch is scoped to one section, sibling sections' spans (QA or provenance) are unaffected by an accept-fix action elsewhere.
- **Structured-field edits** (PDF key data points, game embed, theme, asset uploads) get their own routes in the same family — `PATCH /issues/{run_id}/theme`, `PATCH /issues/{run_id}/game`, etc. — each a scoped `patch.set` on its own field path, never touching prose sections. This keeps the full-document `createOrReplace` reserved for what it already does well: the pipeline's initial draft write and the existing `rerun_agent` re-roll (which legitimately needs to resync everything, since re-running a section writer can change `model_versions` and cost too).
- **Audit logging**: every content-patch call writes an `audit_log` row with `before`/`after` JSON snapshots of just the patched field — this is free undo history and satisfies the locked "nothing silent" write-boundary rule with the existing table shape, no new mechanism needed.

### Optimistic UI vs refetch

Recommend **optimistic apply + background reconciliation refetch**, not pure fire-and-forget optimism and not blocking-refetch-only:

- Andrew is single-threaded (no concurrent-editor conflict risk — a documented constraint), so the risk optimistic UI usually guards against (two people editing at once) doesn't apply here. Apply the edit to local component state immediately for a responsive feel.
- Await the `PATCH` call in the background; on success, do a lightweight refetch of just that section (a GROQ read the dashboard already has patterns for) to reconcile canonical block `_key`s and confirm the write landed — cheap, and avoids the dashboard silently drifting from Sanity truth if the patch response and local optimistic state ever disagree (e.g., server-side normalization of the body).
- On failure, roll back the optimistic state and surface the error — do not silently retry, per the existing "never silent" pattern used throughout `review.py`/`control.py` (they always raise/log rather than swallow).

---

## 4. Two-sign-off state machine placement

**Recommendation: a new Convex `sign_offs` table (one row per run, two independent booleans), enforced in TWO places — the existing `POST /issues/{run_id}/publish` guard chain (`api/review.py`) AND, as the actual fix for the bypass, inside the Sanity webhook handler (`api/webhooks.py`) itself.**

### Why enforcement must live in two places

Fact #5 is the crux: the webhook handler that `_flip_sanity_published` fires — and that a raw Studio status-flip *also* fires, since it's the same Sanity `status==='published'` transition — currently has zero knowledge of sign-off state. Extending only `review.py`'s guard chain (the way `claimChecks:allSignedOff` already works) would leave the Studio path exactly as bypassable as it is today. The fix is not "add a nicer gate to the dashboard's own publish button" — it's "make the webhook, which is the true trigger for `_run_publisher`, refuse to fire without both sign-offs," because that's the one chokepoint both paths share.

### Schema

```
sign_offs: defineTable({
  workspace_id: v.string(),
  runId: v.string(),
  factsCleared: v.boolean(),
  factsClearedBy: v.optional(v.string()),
  factsClearedAt: v.optional(v.number()),
  soundsHuman: v.boolean(),
  soundsHumanBy: v.optional(v.string()),
  soundsHumanAt: v.optional(v.number()),
})
  .index('by_runId', ['runId'])
```

Two mutations (`signOffs:setFactsCleared`, `signOffs:setSoundsHuman`), each Clerk-JWT-guarded and audit-logged — mirrors `payouts:markPayoutSent`'s exact shape (guarded, rejects redundant flips, audit-logs before/after).

### Relationship to the existing `claimChecks:allSignedOff` gate

Keep both. "Facts cleared" is a **deliberate operator attestation**, not merely the automatic result of ticking every claim checkbox — the UI should gate the "Facts cleared" toggle so it's only *enabled* once `claimChecks:allSignedOff` is true (reusing that existing query as a precondition), but the actual boolean written to `sign_offs` is a distinct, explicit action Andrew takes, auditable as "I attest this." "Sounds human" is the same pattern gated on Voice Pass completion (no unresolved QA `error`-severity findings). This preserves all of the existing `claim_checks` machinery unchanged and layers the new named gate on top.

### Retiring the Studio bypass

Two changes, in order of necessity:

1. **Must-have, this milestone:** `api/webhooks.py:sanity_publish` gains a guard immediately after the existing `status != 'published'` check — look up `run_id` (already read from `payload.get("runId")`), and if present, query `signOffs:isFullySignedOff(runId)`; if not fully signed off, log a warning, write an `audit_log` row (`action: "publish.blocked_missing_signoff"`), and return `{"ok": True, "skipped": "not-signed-off"}` instead of scheduling `_run_publisher`. This closes the loophole regardless of *how* the status flip happened (dashboard, Studio, or a stray manual Sanity API call) and requires no change to Sanity permissions. Note the existing code path explicitly tolerates `run_id is None` ("manually-authored drafts") — that fallback should now REQUIRE sign-off to be satisfied for any run_id-bearing payload, and should treat a `None` run_id (no pipeline run to check) as a case that must be blocked or explicitly flagged for manual audit, since there's no way to verify sign-off state without a run to look it up on.
2. **Recommended, can follow immediately after:** since the milestone already states "Studio becomes read-only fallback," configure Sanity's role/field permissions so the Studio-authenticated role cannot write `weeklyIssue.status`. This is a Sanity-project-config change, not a code change, and is the belt to the webhook guard's suspenders — but the webhook guard (1) is the one that actually matters, because it can't be defeated by a future permissions misconfiguration.

`review.py`'s `publish`/`schedule` endpoints also gain the same `signOffs:isFullySignedOff` check alongside the existing `claimChecks:allSignedOff` check (409 `reason: "not_fully_signed_off"`) — this is the dashboard-side UX gate (disabled Publish button, clear error) and should be added even though the webhook guard is the actual security boundary, because it's the path Andrew uses 99% of the time and should fail fast with a good message rather than relying on the webhook silently no-op'ing.

---

## 5. Eval harness architecture

**Recommendation: extend the existing single-agent isolation pattern (`api/agents.py`) for agent-level evals, and reuse `rerun_agent`'s checkpoint-fork + bare-node-import pattern for full/partial-graph "shadow runs" — both writing to one new append-only Convex scoreboard table.**

### Two granularities, matching the two granularities the codebase already has

1. **Single-agent golden scenarios** — nearly free to build. `POST /agents/{key}/test-run` already does an isolated `acomplete()` call with zero real-table writes; `POST /agents/{key}/score` already scores a single output against the live rubric. A golden scenario is just a named, versioned `variables` map (generalizing the existing `SAMPLE_FIXTURES` dict in `api/agents.py` into a file-based fixture registry, e.g. `packages/pipeline/eval/fixtures/{scenario_id}.json`) fed into the existing test-run → score chain, with the result persisted (see scoreboard below) instead of only returned to the caller.
2. **Full/partial-graph "shadow runs"** — reuse `rerun_agent`'s exact recipe (`api/control.py`): a throwaway `thread_id = f"eval-{uuid4()}"` (never a real `run_id`, so it can never collide with or be picked up by real-run queries), a `DispatchState` seeded from a fixture (e.g., pre-populate `winning_charity`/`research`/`style_brief` to skip the expensive/nondeterministic upstream agents when the scenario only wants to exercise the 7 section writers or the QA judge's cross-section-consistency axis), and direct imports of the **bare, undecorated** node functions — exactly as `rerun_agent` already imports `from eisenbalm_pipeline.agents.origin_story import origin_story as _origin_story` — so the eval path never touches `agent_runs`/`deliberationEvents`/`pipelineRuns` (same isolation contract `test-run.py`'s docstring calls out explicitly).

### Mocking OpenRouter vs cheap-model live runs

The codebase already has two relevant levers — reuse both rather than building a third mocking mechanism:

- **`EISENBALM_STUB_MODE`** (existing, used in tests today): `acomplete` short-circuits to a fake client returning `model_construct()` defaults. Good for **structural/wiring** evals only — "does the graph still execute end-to-end and validate against Pydantic schemas" — never for voice/quality scoring, since outputs are fake.
- **Per-agent model override**, already threaded through `RunConfig`/`AgentConfig` since Phase 22 (`lib/config_loader.py`, `DispatchState.config`). The eval harness's frequent/cheap runs should override `config.agents[key].model` to a fast/cheap model for cost containment (drift detection doesn't need production-fidelity output quality on every run); a separate, less-frequent "shadow run" mode uses the real production model config for periodic fidelity checks. This is the same mechanism operators already use to configure agents — no new plumbing.

### Scoring and storage

- Reuse `judge.score_output()` (already extracted standalone in Phase 28, `agents/qa/judge.py`) for the scoring step in both granularities — it already returns per-axis scores + rationale + cost, and it's already the function `POST /agents/{key}/score` calls.
- New **append-only** Convex table, matching house style (`workspace_id`, no updates/deletes — query-time diffing instead of a separate "drift computed" state):

```
eval_runs: defineTable({
  workspace_id: v.string(),
  scenarioId: v.string(),
  agentKey: v.string(),          // or "full-graph" for shadow runs
  triggeredBy: v.string(),       // Clerk userId
  runAt: v.number(),
  model: v.string(),
  costUsd: v.number(),
  overall: v.number(),
  axes: v.string(),              // JSON — per-axis {axis, score, pass, note}
  rationale: v.string(),
  promptVersion: v.optional(v.number()),  // ties to prompt_versions.version for drift-vs-prompt-edit correlation
})
  .index('by_workspace_scenario_agent', ['workspace_id', 'scenarioId', 'agentKey'])
  .index('by_workspace_runAt', ['workspace_id', 'runAt'])
```

- **Drift detector = a query, not a separate service**: fetch the last N rows for `(scenarioId, agentKey)` ordered by `runAt`, diff `overall`/axis scores between consecutive rows. No new computation pipeline needed — this is exactly the pattern `finance.ts`'s reconciliation and `charities.ts`'s dedup already use (derive from existing rows at query time, don't pre-compute and store a second derived state).
- New endpoints: `POST /eval/scenarios/{scenario_id}/run` (dispatches to test-run+score or shadow-run+score depending on the fixture's declared kind, writes one `eval_runs` row, returns it) and a plain Convex query for the Eval Center's scoreboard/trend view (no new FastAPI route needed for reads — the dashboard already reads Convex directly for everything else).

---

## 6. Suggested build order

Ordering follows real dependencies found in the code, not milestone-doc ordering. Three independent tracks exist (Review/Editing, Signal/Run Monitor, Eval), plus one piece of foundational plumbing everything else benefits from.

```
Track A (spine — Review Desk + editing + publish gate)   Track B (parallel)         Track C (parallel)
──────────────────────────────────────────────────────   ────────────────────       ───────────────────
1. Foundation: fix NEXT_PUBLIC_PIPELINE_URL,
   design system + chrome, Awaiting-you inbox
   (pure read-aggregation over existing tables)
        │
2. Content-patch endpoint family (scoped Sanity
   `patch`, per-section + structured fields, audit-logged)
        │
3. Review Desk native galley + span-resolver util,          Run Monitor v2 +           Prompt Lab eval
   rendering EXISTING qaCorrections via the resolver         Signal Desk (additive      drawer + Eval
        │                                                    frontend over existing     Center (fixtures +
4. "Accept fix" wiring (QA finding → content-patch,          agent_runs/pitchLog/       eval_runs table +
   using the span-resolver's match)                          interrupt-resume — no      test-run/score
        │                                                    schema deps on Track A)    reuse)
5. Two-sign-off (`sign_offs` table) + webhook-guard
   fix + gated Publish button in Review Desk
        │
6. Provenance pipeline (Researcher `claims[]` field +
   post-writer matching pass + `provenance_claims`
   table) + sourced/unsourced galley rendering via
   the same span-resolver from step 3
        │
7. Voice Pass (reuses QA two-layer detector +
   score_output; as-written/rewrite popovers are the
   same span mechanics as step 4's accept-fix)
        │
8. Registry upgrades (coverage memory strip,
   corrections log) — smallest, least dependent,
   slots in anywhere
```

**Rationale for the ordering within Track A:**
- Content-patch (step 2) must exist before *anything* that mutates content — accept-fix (4), Voice Pass rewrites (7), and per-section editing itself all depend on it. Build it once, prove it with the simplest consumer (plain per-section editing), before layering span-aware consumers on top.
- The galley + span-resolver (step 3) is a prerequisite for both accept-fix (4) and provenance rendering (6) — it's the one piece of shared infrastructure both consume, so it should exist before either.
- Two-sign-off (step 5) is schema-independent of steps 2-4 but should land before or alongside the galley's "gated Publish" UI, since that's explicitly one Review Desk feature — sequencing it here avoids building the Publish button twice.
- Provenance (step 6) is deliberately sequenced *after* the galley exists, not before — the milestone context flags it as the biggest lift, and building the rendering consumer first means the pipeline-side work (step 6) has an immediate, testable frontend target instead of shipping into a vacuum.
- Voice Pass (7) is sequenced after accept-fix (4) specifically because they are mechanically the same feature (span match → popover → content-patch) — building accept-fix first de-risks Voice Pass.

**Tracks B and C have no schema or endpoint dependency on Track A** and can be staffed in parallel from day one: Run Monitor v2/Signal Desk is purely additive frontend over tables that already exist (`agent_runs`, `agent_run_payloads`, `pitchLog`, the `editor_gate_1` interrupt/resume flow), and the eval harness reuses `api/agents.py`'s existing isolation pattern plus `rerun_agent`'s checkpoint-fork pattern without touching Sanity, `qaCorrections`, or `claim_checks` at all.

---

## Integration Points Summary

| New/Modified Component | Type | Depends On | Notes |
|---|---|---|---|
| `sign_offs` Convex table | New | — | Mirrors `payouts` shape exactly |
| `provenance_claims` Convex table | New | Researcher `claims[]` field | Text-keyed, not Sanity-keyed — survives Sanity removal |
| `eval_runs` Convex table | New | — | Append-only; drift = query, not a stored derived state |
| Span-resolver utility (TS) | New | Current section body (live read) | Shared by QA rendering, provenance rendering, Voice Pass |
| `PATCH /issues/{run_id}/sections/{name}` | New (FastAPI) | `compose_section_body()` (existing) | Scoped Sanity `patch`, not `createOrReplace` |
| `PATCH /issues/{run_id}/{theme,game,...}` | New (FastAPI) | Same pattern as above | One route per structured field region |
| `ResearchOutputModel.claims[]` | Modified | — | Generalizes existing `founderNameSourceUrl` pattern |
| Post-writer provenance matching pass | New (pipeline) | `lib/claims.py`-style flattening | Runs before the Sanity write, alongside existing `extract_claims` |
| `api/webhooks.py:sanity_publish` | Modified | `sign_offs` table | The actual bypass fix — must check sign-off state, not just `status` |
| `api/review.py:publish/schedule` | Modified | `sign_offs` table | UX-layer gate; webhook guard is the real boundary |
| `POST /eval/scenarios/{id}/run` | New (FastAPI) | `api/agents.py` test-run/score, `rerun_agent`'s bare-node pattern | Two granularities, one endpoint |
| Awaiting-you inbox | New (frontend) | Existing `runs`/`pipelineRuns`/`review_actions` | Pure read-aggregation, no backend changes |

## Sources

- `.planning/PROJECT.md` — milestone scope, locked decisions, reconciliation facts (read in full)
- `convex/schema.ts` — all 24 tables, house patterns for additive tables
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — `DispatchState`, `ResearchOutput`, `QACorrection` shapes
- `packages/pipeline/src/eisenbalm_pipeline/lib/claims.py` — claim extraction algorithm (the template for span/provenance matching)
- `packages/pipeline/src/eisenbalm_pipeline/lib/portable_text.py` — block builders, `_key` generation, `compose_section_body`
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` — `write_issue_draft` (full `createOrReplace`), `upload_pdf_to_issue` (scoped `patch` precedent)
- `packages/pipeline/src/eisenbalm_pipeline/api/review.py` — publish/schedule/reject endpoints, existing `claimChecks:allSignedOff` gate
- `packages/pipeline/src/eisenbalm_pipeline/api/webhooks.py` — the Sanity webhook handler that is the actual bypass
- `packages/pipeline/src/eisenbalm_pipeline/api/control.py` — `rerun_agent` (checkpoint-fork + bare-node-import pattern for evals)
- `packages/pipeline/src/eisenbalm_pipeline/api/agents.py` — `test-run`/`score` isolation pattern for eval harness
- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` — `ResearchOutputModel`, current provenance gap
- `packages/pipeline/src/eisenbalm_pipeline/agents/qa/judge.py` — `JudgeFinding.quotedSpan` shape

---
*Architecture research for: Dispatch Control v2 — Editorial Operator Console (v3.0 milestone integration)*
*Researched: 2026-07-06*
