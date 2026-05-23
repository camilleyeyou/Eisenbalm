# Phase 13: Deliberation as Conversation - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning
**Source:** discuss-phase --auto (recommended defaults auto-selected; see DISCUSSION-LOG.md)

<domain>
## Phase Boundary

Transform the issue's deliberation layer from a dry sequential report into a real,
engaging multi-turn **conversation** between the three named agents — The Scout, The
Advocate, The Editor — faithful to the run's actual findings, advocate scores, and editor
decision, rendered chat-style inline on the issue page.

Three coupled pieces:
1. **Chronicler pass** — ONE new LLM call in the pipeline that dramatizes the *real* Scout
   findings, Advocate scores/arguments, and Editor decision into a Jesse-voice dialogue.
   Its output becomes the canonical transcript, replacing the deterministic template
   `editor.py::_format_deliberation_transcript` currently overwrites.
2. **Structured dialogue turns** — ordered `{speaker, text}` data the frontend consumes
   directly (no client-side Markdown parsing of a `<pre>` blob).
3. **Chat-style inline render** — replaces the raw-Markdown `<pre>{transcript}</pre>` dump
   buried in `PodcastSlot.tsx`, surfaced as a formatted threaded conversation in the main
   issue flow.

**In scope:** the Chronicler node + prompt, the structured-turn storage shape, the frontend
chat render, and preserving a transcript form for the V2-02 NotebookLM podcast export.

**Out of scope:** a live multi-turn debate loop (multiple LLM calls); real-time streaming of
the conversation; any change to the Advocate scoring path (already fixed in quick task
260523-eg3); the Convex live "machine" deliberation log (DeliberationSlot's pitch
carousel / flow line / QA — stays as-is).

</domain>

<decisions>
## Implementation Decisions

### Chronicler — pipeline placement & I/O
- **D-01:** Add ONE new graph node `chronicler` (single LLM call) inserted **between
  `editor_gate_1` and `researcher`** in `graph/builder.py`. Rewire the edge
  `editor_gate_1 → researcher` to `editor_gate_1 → chronicler → researcher`. The Editor
  has, by that point, produced everything the Chronicler needs, and keeping it sequential
  (not a new fan-in) avoids reducer changes.
- **D-02:** Chronicler inputs come from `DispatchState` only: `candidates` /
  `sorted_candidates` (post-Advocate, carrying `name`, `scoutSummary`, `advocateArgument`,
  `advocateScore`), `winning_charity`, `editor_decision` (Editor reasoning),
  `runner_up_notes`, `issue_number`. It reads NO other section output.
- **D-03:** Chronicler writes the canonical `state['deliberation_transcript']` (replacing
  the value the Editor node currently sets) **plus** the new structured turns onto state.
  Add a new `DispatchState` field for the turns (e.g. `deliberation_conversation:
  Optional[list[dict]]`) — exact name reconciled with `docs/API_CONTRACTS.md §7` first.
- **D-04:** Single LLM call only — no multi-call debate loop (cost + weekly cadence
  constraint). Route via the existing OpenRouter client / `llm_config` pattern; record its
  resolved model under `model_versions['chronicler']` exactly as other agents do (AGT-17).
- **D-05:** The Chronicler may live in `agents/chronicler.py` (new module) or as a function
  in `editor.py`; **new module preferred** for separation. agentId for any emitted event /
  attribution is a house persona — NOT a model name (DEL-04).

### Structured-turn storage layer (the load-bearing schema decision)
- **D-06:** Store the structured conversation as **canonical Sanity content** on the
  `weeklyIssue` document — an additive field, NOT a Convex `deliberationEvents` eventType.
  Rationale: the conversation is published, Andrew-reviewable, persistent content (Sanity's
  exact role); it must survive in the issue independent of any live run. This avoids
  touching the locked `deliberationEvents.eventType` `v.union(...)` enum and the "do not
  regress the deliberationEvents/agentVotes emission path" constraint entirely.
- **D-07:** Recommended shape: an ordered array of `{ speaker, text }` objects (speaker ∈
  the three persona ids, text = plain string), placed under the existing
  `selectionDeliberation` object (e.g. `selectionDeliberation.conversation[]`) or `podcast`.
  Final field name + whether `text` is a plain string vs Portable Text is a
  **planning/research decision that MUST be reconciled with `docs/API_CONTRACTS.md`
  (§1.2 GROQ read, §2.2 weeklyIssue write) and `apps/studio/schemas/weeklyIssue.ts` BEFORE
  any code** (CLAUDE.md hard rule). Plain string is the leaning default — render layer adds
  formatting; no Markdown stored.
- **D-08:** Do NOT add a new `deliberationEvents` eventType for turns. Do NOT rename any
  existing schema field. The live machine log (DeliberationSlot's 5 Convex subscriptions)
  is unchanged.

### Frontend placement & render
- **D-09:** Render the conversation as a chat thread at the **top of the existing
  `#deliberation` section, visible by default** (not inside a `<details>`). Reuse the
  `#deliberation` anchor so MED-04's 8 canonical SectionNavigator anchor ids stay intact
  (no navigator churn). The existing Carousel & Flow "machine" view (pitch log / flow line /
  confidence / QA) stays in its collapsed `<details>` BELOW the conversation — i.e. the
  conversation leads, the machine record follows under "How this issue was made."
- **D-10:** Remove the raw `<pre>{transcript}</pre>` Markdown dump from `PodcastSlot.tsx`.
  PodcastSlot keeps its `<audio>` player + description + (optional) plain-text transcript
  disclosure for the export form — but stops being the home of the deliberation narrative.
- **D-11:** Turn render = attributed chat bubbles. Reuse `AGENT_LABELS` / `getAgentLabel` /
  `agentChipStyle` and the `/agents/[agentId]` links already in `DeliberationSlot.tsx`;
  reuse the `--color-scout` / `--color-advocate` / `--color-primary` CSS vars for
  per-speaker accent. No literal `#`/`##`/`**` ever rendered.
- **D-12:** Constraints held verbatim: no new npm dependency, no CDN scripts, single
  `<main>`, WCAG AA contrast, ≥44px touch targets, `prefers-reduced-motion` honored (any
  turn-reveal motion must early-return / be instant under reduced motion), DEL-04 (no model
  names anywhere on the render path). `pnpm --filter web build` must pass.

### Chronicler prompt & turn shape
- **D-13:** Speakers are the three named agents only: The Scout, The Advocate, The Editor
  (persona ids `scout` / `advocate` / `editor`).
- **D-14:** **Faithful dramatization** — the Chronicler stages the *real* data into dialogue
  and invents NO new facts: charity names, advocate scores, the winner, and the editor's
  reasoning all trace to actual state values. It is staging/turn-taking, not fiction.
- **D-15:** Target a genuinely multi-turn exchange (~8–16 turns) with real back-and-forth,
  not one monologue block per agent. Output is structured JSON (list of `{speaker, text}`)
  so we get both the turns and a derivable transcript from one call.
- **D-16:** Reuse `lib/voice.py` `VOICE_CONSTRAINTS` **verbatim** in the Chronicler system
  prompt (Jesse voice non-negotiable), plus an explicit DEL-04 instruction (never reference
  AI / models / Jesse's nature). Validate output is well-formed turns; on malformed/failed
  LLM output, fall back per D-18.

### Podcast / NotebookLM transcript preservation
- **D-17:** Keep `weeklyIssue.podcast.deliberationTranscript` (Sanity field + GROQ §1.2 +
  `IssuePodcast.deliberationTranscript` type). It remains the NotebookLM source for V2-02.
  Derive it from the Chronicler's structured turns (e.g. flatten `Speaker: text` per line)
  so a usable transcript form always exists.
- **D-18:** **Retain** the deterministic `_format_deliberation_transcript` template AND its
  `test_transcript_format` exact-header assertions as the **fail-safe fallback**: if the
  Chronicler LLM call fails or returns malformed output, the run falls back to the existing
  template transcript so a run never ends with an empty/absent transcript. Do not delete the
  template or its test.

### Claude's Discretion
- Exact new Sanity field name and nesting (`selectionDeliberation.conversation` vs under
  `podcast`) — pick during planning, reconciled with API_CONTRACTS.md + the schema.
- Exact `DispatchState` field name for the turns.
- Chat-bubble visual styling specifics (alignment, spacing, avatar vs initial chip) within
  the D-11/D-12 constraints.
- Whether the Chronicler lives in a new module vs `editor.py` (new module leaning).
- Exact turn-count tuning within the ~8–16 guideline.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Hard rules & contracts (read FIRST — gates every schema/payload change)
- `CLAUDE.md` — project hard rules: no schema field renames without `docs/API_CONTRACTS.md`;
  GSD workflow enforcement; Jesse voice non-negotiable.
- `docs/API_CONTRACTS.md §1.2` — `QUERY_ISSUE_BY_SLUG` GROQ read (where a new
  `selectionDeliberation`/`podcast` field must be added for the frontend to consume it).
- `docs/API_CONTRACTS.md §2.2` — `create weeklyIssue draft` Python write (where the pipeline
  must write the new structured-turn field).
- `docs/API_CONTRACTS.md §3.4 + §4.3` — `deliberationEvents:insert` payloads + the
  `deliberationEvents.ts` insert validator (the locked eventType union — do NOT extend; this
  ref exists so the planner confirms turns do NOT go here).
- `docs/API_CONTRACTS.md §7` — LangGraph State Contract (`DispatchState`) — where a new turns
  field must be declared.
- `docs/CLAUDE_CODE_BRIEF.md` — full agent pipeline + Jesse voice/tone notes (lines 359-367
  are the source of `VOICE_CONSTRAINTS`).

### Pipeline (Chronicler insertion + transcript)
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — node wiring; insert
  `chronicler` between `editor_gate_1` and `researcher`.
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` §`deliberation_transcript`
  (line ~136) — `DispatchState`; add the turns field here.
- `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` — `_format_deliberation_transcript`
  (line ~112), `editor_gate_1` return (line ~405) that currently sets
  `deliberation_transcript`; this is what the Chronicler supersedes (with template as fallback).
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` — `VOICE_CONSTRAINTS` (reuse
  verbatim) + `build_section_writer_prompt` (prompt-assembly pattern to mirror).
- `packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py` (line ~213) —
  `write_issue_draft` maps `state['deliberation_transcript']` → Sanity; extend to also write
  the structured turns.
- `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` /
  `lib/openrouter_client.py` — model routing pattern for the new Chronicler call.

### Frontend (chat render)
- `apps/web/app/issue/[slug]/page.tsx` (lines ~237-246) — issue section order; Deliberation
  slot is #8, Podcast #9.
- `apps/web/components/issue/DeliberationSlot.tsx` — Phase 12 Carousel & Flow; reuse
  `AGENT_LABELS`/`getAgentLabel`/`agentChipStyle`, `/agents/[agentId]` links, DEL-04
  discipline, reduced-motion pattern; the conversation renders at the top of this section.
- `apps/web/components/issue/PodcastSlot.tsx` (lines ~96-127) — the `<pre>{transcript}</pre>`
  dump to remove.
- `apps/web/lib/sanity/types.ts` (line ~94 `IssuePodcast`, line ~128 `Issue.podcast`) +
  `apps/web/lib/sanity/queries.ts` — types + GROQ to extend for the new field.
- `apps/studio/schemas/weeklyIssue.ts` (lines ~305-383) — `podcast.deliberationTranscript`
  + `selectionDeliberation` object; where the new conversation field is added.

### Convex (do-not-touch confirmation)
- `convex/schema.ts` (lines ~28-48) — `deliberationEvents.eventType` union; confirm turns are
  NOT added here; emission path unchanged.

### Prior-phase baselines
- `.planning/phases/12-machine-editorial-design-adoption-and-designagent-suppression/12-CONTEXT.md`
  — DeliberationSlot Carousel & Flow + SectionNavigator 8-anchor baseline (MED-04/MED-05).
- `.planning/phases/09-issue-page-completion/09-CONTEXT.md` — DEL-01..06 deliberation-layer
  decisions (DEL-04 no-model-names tripwire, `/agents/[agentId]` route).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`AGENT_LABELS` + `getAgentLabel()` + `agentChipStyle()`** (`DeliberationSlot.tsx`):
  persona name/role map + per-speaker accent — reuse directly for turn attribution.
- **`/agents/[agentId]` route** (Phase 9 DEL-06): persona profile links for each speaker.
- **`VOICE_CONSTRAINTS` + `build_section_writer_prompt`** (`lib/voice.py`): single source of
  Jesse voice + the structural prompt-assembly pattern the Chronicler should mirror.
- **`_format_deliberation_transcript`** (`editor.py`): deterministic transcript template —
  becomes the Chronicler fallback (kept, not deleted).
- **`editor_gate_1` return** already exposes `winning_charity`, `editor_decision`,
  `runner_up_notes`, and sorted candidates-with-scores — exactly the Chronicler's inputs.
- **`prefers-reduced-motion` module-scope check** + IntersectionObserver/rAF count-up pattern
  (`DeliberationSlot.tsx`) for any tasteful turn-reveal motion.
- **`portable_text.py`** helper if turns are stored/rendered as Portable Text (only if
  research picks PT over plain strings).

### Established Patterns
- LangGraph nodes mutate distinct `DispatchState` fields; sequential edges block until prior
  node completes (no reducer needed for a single new sequential node).
- Convex `deliberationEvents.eventType` is a closed `v.literal(...)` union — extending it is a
  schema change gated by API_CONTRACTS.md; the chosen design avoids it.
- Sanity is the canonical published-content store; the frontend reads it via GROQ
  (`QUERY_ISSUE_BY_SLUG`) and renders Portable Text / plain fields.
- DEL-04 enforced by a never-skipped tripwire test (`deliberation-no-model-names.test.ts`) —
  any new render code is subject to it.

### Integration Points
- Pipeline: new `chronicler` node in `graph/builder.py`; new `DispatchState` field in
  `graph/state.py`; Sanity write extension in `lib/sanity_client.py`.
- Studio: new field in `apps/studio/schemas/weeklyIssue.ts` (+ TypeGen regenerate).
- Web: GROQ (`queries.ts`) + types (`types.ts`) extension; new/relocated chat-render block in
  the `#deliberation` section of `page.tsx` (likely a new component or an extension of
  `DeliberationSlot.tsx`); `<pre>` removal in `PodcastSlot.tsx`.

</code_context>

<specifics>
## Specific Ideas

- Memory `deliberation-as-conversation` (decided 2026-05-23): the conversation "must be an
  interesting read" — a brand/editorial-quality bar, not a nice-to-have. The deliberation is
  a signature feature and currently reads like a status log.
- The three known problems this fixes: (1) static template lists each agent once with no
  turn-taking; (2) frontend dumps raw markdown so `#`/`##`/`**` show literally, hidden under
  the podcast disclosure; (3) advocate 0/10 score collapse (already fixed in 260523-eg3 — a
  prerequisite for a compelling debate).

</specifics>

<deferred>
## Deferred Ideas

- **Live multi-turn debate loop** (agents actually responding to each other across multiple
  LLM calls) — explicitly rejected for per-run cost + weekly Thu→Thu cadence; a possible
  future version, not this phase.
- **Real-time streaming** of the conversation as it is chronicled — out of scope; the
  conversation is generated once at pipeline time and published.
- **Reviewed todos (not folded):** none — no pending todos matched Phase 13.

</deferred>

---

*Phase: 13-deliberation-as-conversation*
*Context gathered: 2026-05-23 via discuss-phase --auto*
