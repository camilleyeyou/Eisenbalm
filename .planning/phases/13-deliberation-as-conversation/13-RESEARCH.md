# Phase 13: Deliberation as Conversation - Research

**Researched:** 2026-05-23
**Domain:** LangGraph node insertion · Sanity schema extension · Next.js chat UI
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Add ONE new graph node `chronicler` (single LLM call) inserted between `editor_gate_1` and `researcher` in `graph/builder.py`. Rewire the edge `editor_gate_1 → researcher` to `editor_gate_1 → chronicler → researcher`. The Editor has, by that point, produced everything the Chronicler needs, and keeping it sequential (not a new fan-in) avoids reducer changes.

**D-02:** Chronicler inputs come from `DispatchState` only: `candidates` / `sorted_candidates` (post-Advocate, carrying `name`, `scoutSummary`, `advocateArgument`, `advocateScore`), `winning_charity`, `editor_decision` (Editor reasoning), `runner_up_notes`, `issue_number`. It reads NO other section output.

**D-03:** Chronicler writes the canonical `state['deliberation_transcript']` (replacing the value the Editor node currently sets) **plus** the new structured turns onto state. Add a new `DispatchState` field for the turns (e.g. `deliberation_conversation: Optional[list[dict]]`) — exact name reconciled with `docs/API_CONTRACTS.md §7` first.

**D-04:** Single LLM call only — no multi-call debate loop. Route via the existing OpenRouter client / `llm_config` pattern; record its resolved model under `model_versions['chronicler']` exactly as other agents do (AGT-17).

**D-05:** The Chronicler may live in `agents/chronicler.py` (new module) or as a function in `editor.py`; new module preferred for separation. agentId for any emitted event / attribution is a house persona — NOT a model name (DEL-04).

**D-06:** Store the structured conversation as canonical Sanity content on the `weeklyIssue` document — an additive field, NOT a Convex `deliberationEvents` eventType. Rationale: the conversation is published, Andrew-reviewable, persistent content (Sanity's exact role); it must survive in the issue independent of any live run. This avoids touching the locked `deliberationEvents.eventType` `v.union(...)` enum and the "do not regress the deliberationEvents/agentVotes emission path" constraint entirely.

**D-07:** Recommended shape: an ordered array of `{ speaker, text }` objects (speaker ∈ the three persona ids, text = plain string), placed under the existing `selectionDeliberation` object (e.g. `selectionDeliberation.conversation[]`). Final field name + whether `text` is a plain string vs Portable Text is a planning/research decision that MUST be reconciled with `docs/API_CONTRACTS.md` (§1.2 GROQ read, §2.2 weeklyIssue write) and `apps/studio/schemas/weeklyIssue.ts` BEFORE any code (CLAUDE.md hard rule). Plain string is the leaning default — render layer adds formatting; no Markdown stored.

**D-08:** Do NOT add a new `deliberationEvents` eventType for turns. Do NOT rename any existing schema field. The live machine log (DeliberationSlot's 5 Convex subscriptions) is unchanged.

**D-09:** Render the conversation as a chat thread at the top of the existing `#deliberation` section, visible by default (not inside a `<details>`). Reuse the `#deliberation` anchor so MED-04's 8 canonical SectionNavigator anchor ids stay intact. The existing Carousel & Flow "machine" view stays in its collapsed `<details>` BELOW the conversation.

**D-10:** Remove the raw `<pre>{transcript}</pre>` Markdown dump from `PodcastSlot.tsx`. PodcastSlot keeps its `<audio>` player + description + (optional) plain-text transcript disclosure for the export form — but stops being the home of the deliberation narrative.

**D-11:** Turn render = attributed chat bubbles. Reuse `AGENT_LABELS` / `getAgentLabel` / `agentChipStyle` and the `/agents/[agentId]` links already in `DeliberationSlot.tsx`; reuse the `--color-scout` / `--color-advocate` / `--color-primary` CSS vars for per-speaker accent. No literal `#`/`##`/`**` ever rendered.

**D-12:** No new npm dependency, no CDN scripts, single `<main>`, WCAG AA contrast, ≥44px touch targets, `prefers-reduced-motion` honored (any turn-reveal motion must early-return / be instant under reduced motion), DEL-04 (no model names anywhere on the render path). `pnpm --filter web build` must pass.

**D-13:** Speakers are the three named agents only: The Scout, The Advocate, The Editor (persona ids `scout` / `advocate` / `editor`).

**D-14:** Faithful dramatization — the Chronicler stages the real data into dialogue and invents NO new facts: charity names, advocate scores, the winner, and the editor's reasoning all trace to actual state values. It is staging/turn-taking, not fiction.

**D-15:** Target a genuinely multi-turn exchange (~8–16 turns) with real back-and-forth, not one monologue block per agent. Output is structured JSON (list of `{speaker, text}`) so we get both the turns and a derivable transcript from one call.

**D-16:** Reuse `lib/voice.py` `VOICE_CONSTRAINTS` verbatim in the Chronicler system prompt (Jesse voice non-negotiable), plus an explicit DEL-04 instruction (never reference AI / models / Jesse's nature). Validate output is well-formed turns; on malformed/failed LLM output, fall back per D-18.

**D-17:** Keep `weeklyIssue.podcast.deliberationTranscript` (Sanity field + GROQ §1.2 + `IssuePodcast.deliberationTranscript` type). It remains the NotebookLM source for V2-02. Derive it from the Chronicler's structured turns (e.g. flatten `Speaker: text` per line) so a usable transcript form always exists.

**D-18:** Retain the deterministic `_format_deliberation_transcript` template AND its `test_transcript_format` exact-header assertions as the fail-safe fallback: if the Chronicler LLM call fails or returns malformed output, the run falls back to the existing template transcript so a run never ends with an empty/absent transcript. Do not delete the template or its test.

### Claude's Discretion
- Exact new Sanity field name and nesting (`selectionDeliberation.conversation` vs under `podcast`) — pick during planning, reconciled with API_CONTRACTS.md + the schema.
- Exact `DispatchState` field name for the turns.
- Chat-bubble visual styling specifics (alignment, spacing, avatar vs initial chip) within the D-11/D-12 constraints.
- Whether the Chronicler lives in a new module vs `editor.py` (new module leaning).
- Exact turn-count tuning within the ~8–16 guideline.

### Deferred Ideas (OUT OF SCOPE)
- Live multi-turn debate loop (multiple LLM calls) — explicitly rejected for per-run cost + weekly cadence.
- Real-time streaming of the conversation as it is chronicled.
- Reviewed todos (not folded): none — no pending todos matched Phase 13.
</user_constraints>

---

## Summary

Phase 13 has three coupled sub-systems that must land together: (1) a new `chronicler` pipeline node inserted between `editor_gate_1` and `researcher`, producing structured `{speaker, text}` turns in a single LLM call; (2) an additive Sanity field `selectionDeliberation.conversation[]` that stores those turns as published content; (3) a chat-style render at the top of the `#deliberation` section in `DeliberationSlot.tsx` that replaces the raw-Markdown `<pre>` dump in `PodcastSlot.tsx`. All three pieces are locked by decisions D-01 through D-18 — no greenfield design is needed.

The update sequence is strictly ordered by CLAUDE.md contract rules: `docs/API_CONTRACTS.md §7` (DispatchState) → `apps/studio/schemas/weeklyIssue.ts` (Sanity schema) → `apps/web/lib/sanity/types.ts` + `queries.ts` (TypeScript types + GROQ) → `graph/state.py` (Python state) → `agents/chronicler.py` (new node) → `graph/builder.py` (edge rewiring) → `lib/sanity_client.py` (write extension) → `DeliberationSlot.tsx` + `PodcastSlot.tsx` (frontend). Each step unlocks the next; implementing in any other order risks schema drift.

The phase introduces exactly zero new npm packages, zero new Python packages (the Chronicler reuses the existing `acomplete()` + `@agent_node` + `VOICE_CONSTRAINTS` infrastructure), and zero new Convex table changes. The only structural risk is the fallback chain: if Chronicler output is malformed, `_format_deliberation_transcript` must remain intact and tested.

**Primary recommendation:** Implement as six sequential waves, one file group per wave, in the contract-first order above. Gate each wave on the previous wave's tests passing before touching the next file group.

---

## Standard Stack

### No new libraries required

This phase is entirely within the existing Eisenbalm stack. No new packages are needed.

| Layer | Existing Library | Phase 13 Usage |
|-------|-----------------|----------------|
| Pipeline LLM call | `openrouter_client.acomplete()` | Chronicler's single LLM call — kwargs-only signature |
| Pipeline node decorator | `_wrapper.@agent_node` | Wrap `chronicler` node with `name="chronicler"`, `emit_event=None` |
| Pipeline state | `graph/state.py` `DispatchState` TypedDict | Add `deliberation_conversation: Optional[list[dict]]` |
| LLM routing config | `lib/llm_config.py` `MODEL_BY_AGENT` | Add `"chronicler": MODEL_PIN_VOICE_CRITICAL` |
| Sanity schema | Sanity v3 `defineField` / `defineType` | Additive `conversation[]` field in `selectionDeliberation` |
| GROQ read | `apps/web/lib/sanity/queries.ts` | Extend `QUERY_ISSUE_BY_SLUG` projection |
| TypeScript types | `apps/web/lib/sanity/types.ts` | Add `IssueDeliberationTurn` + extend `IssueDeliberation` |
| Chat render | React + Tailwind (already in stack) | New conversation thread JSX inside `DeliberationSlot.tsx` |
| JSON output validation | `pydantic` `BaseModel` (already used in `editor.py`) | `ChroniclerOutput(turns: list[Turn])` |

**Version verification:** All packages are already installed. No `npm install` or `pip install` required for this phase.

---

## Architecture Patterns

### Recommended Update Sequence

```
docs/API_CONTRACTS.md       ← Wave 0: declare DispatchState field + Sanity field contract
apps/studio/schemas/         ← Wave 1: additive Sanity schema field + TypeGen
apps/web/lib/sanity/        ← Wave 2: TypeScript types + GROQ projection
packages/pipeline/graph/    ← Wave 3: state.py field + builder.py edge rewiring
packages/pipeline/agents/   ← Wave 4: chronicler.py new agent + sanity_client.py write
apps/web/components/        ← Wave 5: DeliberationSlot chat render + PodcastSlot <pre> removal
```

### Pattern 1: Chronicler Node (new sequential LangGraph node)

**What:** A new `@agent_node`-decorated async function in `agents/chronicler.py` that reads `DispatchState`, calls `acomplete()` with structured JSON output (`response_format`), writes `deliberation_conversation` and a new `deliberation_transcript` derived from turns, and records `model_versions['chronicler']`.

**When to use:** Exactly once — sequential, between `editor_gate_1` and `researcher`.

```python
# Source: mirrors editor_gate_1 pattern in agents/editor.py lines ~350-420
# packages/pipeline/src/eisenbalm_pipeline/agents/chronicler.py

from __future__ import annotations
from typing import Any
from pydantic import BaseModel
from eisenbalm_pipeline.agents._wrapper import agent_node
from eisenbalm_pipeline.graph.state import DispatchState
from eisenbalm_pipeline.lib.voice import VOICE_CONSTRAINTS
from eisenbalm_pipeline.lib.openrouter_client import acomplete
from eisenbalm_pipeline.lib.llm_config import MODEL_BY_AGENT, SAMPLING_BY_AGENT

class _Turn(BaseModel):
    speaker: str   # "scout" | "advocate" | "editor"
    text: str      # plain string, no Markdown

class _ChroniclerOutput(BaseModel):
    turns: list[_Turn]

@agent_node(name="chronicler", emit_event=None)
async def chronicler(state: DispatchState) -> dict[str, Any]:
    candidates = state.get("sorted_candidates") or state.get("candidates") or []
    winning = state.get("winning_charity", "")
    editor_decision = state.get("editor_decision", "")
    runner_up_notes = state.get("runner_up_notes", "")
    issue_number = state.get("issue_number", "")

    system = _build_system_prompt()
    user = _build_user_prompt(candidates, winning, editor_decision, runner_up_notes, issue_number)

    result, usage = await acomplete(
        agent_id="chronicler",
        run_id=state["run_id"],
        messages=[{"role": "system", "content": system},
                  {"role": "user", "content": user}],
        response_format=_ChroniclerOutput,
    )

    turns: list[dict] = [t.model_dump() for t in result.turns]

    # Derive transcript (flat form for podcast/NotebookLM — D-17)
    transcript = "\n\n".join(
        f"{t['speaker'].capitalize()}: {t['text']}" for t in turns
    ) if turns else None

    # AGT-17: record resolved model
    existing_mv = state.get("model_versions") or {}
    new_mv = {**existing_mv, "chronicler": usage.get("resolved_model", MODEL_BY_AGENT["chronicler"])}

    return {
        "deliberation_conversation": turns or None,
        "deliberation_transcript": transcript or state.get("deliberation_transcript"),
        "model_versions": new_mv,
    }
```

**Fallback (D-18):** If `acomplete()` raises or `result.turns` is empty, the `@agent_node` wrapper propagates the exception and causes the run to fail. To implement graceful fallback, wrap the `acomplete()` call in try/except inside the function body (before the wrapper sees it), and on failure: leave `deliberation_conversation` as `None` and preserve the existing `deliberation_transcript` set by `editor_gate_1`.

```python
# Graceful fallback pattern inside chronicler():
try:
    result, usage = await acomplete(...)
    turns = [t.model_dump() for t in result.turns]
    if len(turns) < 4:   # sanity minimum
        raise ValueError(f"Too few turns: {len(turns)}")
    transcript = "\n\n".join(...)
    return {"deliberation_conversation": turns, "deliberation_transcript": transcript, ...}
except Exception:
    # D-18: fall back to the deterministic transcript already on state
    return {"deliberation_conversation": None}  # transcript unchanged
```

### Pattern 2: Graph Builder Edge Rewiring

**What:** Change one edge, add one node and import.

```python
# Source: packages/pipeline/src/eisenbalm_pipeline/graph/builder.py lines 133-138
# BEFORE (line 133):
builder.add_edge("editor_gate_1", "researcher")

# AFTER:
from eisenbalm_pipeline.agents.chronicler import chronicler
# ...
builder.add_node("chronicler", chronicler)
builder.add_edge("editor_gate_1", "chronicler")
builder.add_edge("chronicler", "researcher")
# verify_research edge stays: builder.add_edge("researcher", "verify_research")
```

### Pattern 3: DispatchState Field Addition

**What:** Add one field to the Phase 1 Selection block in `graph/state.py`. Comment must say "VERBATIM from docs/API_CONTRACTS.md §7". API_CONTRACTS.md §7 must be updated FIRST.

```python
# Source: packages/pipeline/src/eisenbalm_pipeline/graph/state.py ~line 136
# Add after deliberation_transcript:
deliberation_transcript: Optional[str]         # existing
deliberation_conversation: Optional[list[dict]]  # NEW — Chronicler turns, VERBATIM from docs/API_CONTRACTS.md §7
```

No reducer is needed because only one sequential node (`chronicler`) writes this field.

### Pattern 4: Sanity Schema Additive Field

**What:** Add `conversation[]` inside the existing `selectionDeliberation` object definition in `weeklyIssue.ts`. ADDITIVE ONLY — no field renames.

```typescript
// Source: apps/studio/schemas/weeklyIssue.ts ~line 370
// Inside selectionDeliberation.fields[], after runnerUpNotes:
defineField({
  name: 'conversation',
  title: 'Deliberation Conversation',
  type: 'array',
  of: [
    {
      type: 'object',
      fields: [
        defineField({ name: 'speaker', title: 'Speaker', type: 'string',
          description: 'Persona id: scout | advocate | editor',
          validation: Rule => Rule.required() }),
        defineField({ name: 'text', title: 'Text', type: 'text', rows: 3,
          description: 'Plain string, no Markdown.',
          validation: Rule => Rule.required() }),
      ],
      preview: {
        select: { title: 'speaker', subtitle: 'text' },
        prepare: ({ title, subtitle }: { title: string; subtitle: string }) => ({
          title: title?.toUpperCase(),
          subtitle: subtitle?.slice(0, 80),
        }),
      },
    },
  ],
  description: 'Chronicler-dramatized dialogue turns for the chat render. Auto-generated by pipeline.',
}),
```

`_key` is automatically added by Sanity for array-of-object items — no explicit `_key` field needed in the schema.

### Pattern 5: GROQ Projection Extension

**What:** Add `conversation[] { speaker, text }` to the existing `selectionDeliberation` block in `QUERY_ISSUE_BY_SLUG`.

```groq
// Source: apps/web/lib/sanity/queries.ts — QUERY_ISSUE_BY_SLUG
// BEFORE:
selectionDeliberation {
  candidates[] { ... },
  editorDecision,
  runnerUpNotes,
}

// AFTER:
selectionDeliberation {
  candidates[] { ... },
  editorDecision,
  runnerUpNotes,
  conversation[] { speaker, text },
}
```

### Pattern 6: TypeScript Type Extension

**What:** Add `IssueDeliberationTurn` type and extend `IssueDeliberation`. The `Issue` type picks up the new field automatically through `IssueDeliberation`.

```typescript
// Source: apps/web/lib/sanity/types.ts ~line 108
export type IssueDeliberationTurn = {
  speaker: string   // "scout" | "advocate" | "editor"
  text: string
}

export type IssueDeliberation = {
  candidates: IssueDeliberationCandidate[] | null
  editorDecision: string | null
  runnerUpNotes: string | null
  conversation: IssueDeliberationTurn[] | null  // NEW
} | null
```

### Pattern 7: Sanity Write Extension (sanity_client.py)

**What:** In `write_issue_draft`, add `conversation` to the `selectionDeliberation` dict. The write must guard against `None` (old runs without conversation).

```python
# Source: packages/pipeline/src/eisenbalm_pipeline/lib/sanity_client.py ~line 213
# Inside write_issue_draft, extend the 'selectionDeliberation' dict:
'selectionDeliberation': {
    'candidates': [...],          # existing
    'editorDecision': ...,        # existing
    'runnerUpNotes': ...,         # existing
    'conversation': [             # NEW
        {'_type': 'object', '_key': f'turn-{i:03d}', 'speaker': t['speaker'], 'text': t['text']}
        for i, t in enumerate(state.get('deliberation_conversation') or [])
    ] or None,
},
```

The `_key` field is required when writing array-of-object items to Sanity via the Python client. Each key must be unique within the array.

### Pattern 8: Chat Render in DeliberationSlot.tsx

**What:** Add a `conversation` prop (nullable `IssueDeliberationTurn[]`) to `DeliberationSlot`. Render a `<ConversationThread>` block at the TOP of the `<section id="deliberation">`, above the existing `<details>` machine view. The render reuses `getAgentLabel` and `agentChipStyle` already in scope.

```typescript
// Source: apps/web/components/issue/DeliberationSlot.tsx — extend props
interface DeliberationSlotProps {
  runId: string | null
  conversation: IssueDeliberationTurn[] | null  // NEW — Sanity data, static
}

// Inside the JSX, before the <details> machine view:
{conversation && conversation.length > 0 && (
  <div className="mb-8" role="log" aria-label="Deliberation conversation">
    {conversation.map((turn, i) => {
      const label = getAgentLabel(turn.speaker)
      const style = agentChipStyle(turn.speaker)
      return (
        <div key={i} className="flex gap-3 py-3 border-b border-[--color-border] last:border-0">
          <a
            href={`/agents/${turn.speaker}`}
            className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold"
            style={{ backgroundColor: `var(${style.replace('color:', '').trim()}, var(--color-text-dim))` }}
            aria-label={label.name}
          >
            {label.name[0]}
          </a>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold mb-1" style={{ color: `var(${style.replace('color:', '').trim()})` }}>
              {label.name} — {label.role}
            </p>
            <p className="text-sm leading-relaxed">{turn.text}</p>
          </div>
        </div>
      )
    })}
  </div>
)}
```

**Critical:** No model names, no Markdown characters, no `#`/`##`/`**` anywhere in this JSX. The DEL-04 tripwire (`deliberation-no-model-names.test.ts`) scans this file after comment stripping — any string literal matching `claude`, `gpt`, `sonnet`, `haiku`, `openrouter` will cause the test to fail.

`prefersReducedMotion` is already declared at module scope in `DeliberationSlot.tsx`. If any turn-reveal animation is added, gate it on `!prefersReducedMotion` before applying — never inside a hook.

### Pattern 9: page.tsx prop threading

**What:** Pass `issue.selectionDeliberation?.conversation ?? null` from `page.tsx` to `DeliberationSlot`.

```typescript
// Source: apps/web/app/issue/[slug]/page.tsx ~line 240
// BEFORE:
<DeliberationSlot runId={issue.runId ?? null} />

// AFTER:
<DeliberationSlot
  runId={issue.runId ?? null}
  conversation={issue.selectionDeliberation?.conversation ?? null}
/>
```

### Pattern 10: PodcastSlot `<pre>` removal

**What:** Remove lines ~96-127 from `PodcastSlot.tsx` — specifically the `<details class="group">` collapsible block containing the `<pre>{transcript}</pre>`. The audio player, description, and "Audio coming soon" empty state are retained untouched.

```typescript
// Source: apps/web/components/issue/PodcastSlot.tsx lines ~96-127
// REMOVE entirely:
{podcast.deliberationTranscript && (
  <details className="group ...">
    <summary ...>...</summary>
    <pre className="...">{podcast.deliberationTranscript}</pre>
  </details>
)}
```

The `IssuePodcast.deliberationTranscript` field and its GROQ projection remain in types.ts and queries.ts (D-17) — only the `<pre>` render is removed.

### Pattern 11: llm_config.py extension

**What:** Add `"chronicler"` to both `MODEL_BY_AGENT` and `SAMPLING_BY_AGENT`.

```python
# Source: packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py
# Add to MODEL_BY_AGENT:
"chronicler": MODEL_PIN_VOICE_CRITICAL,   # Opus — voice-critical, persona integrity

# Add to SAMPLING_BY_AGENT:
"chronicler": {"temperature": 0.4, "top_p": 1.0},
# Creative enough for staged dialogue but controlled enough for faithful data rendering.
# Lower than section writers (0.7) because faithfulness to actual scores/names is a hard constraint.
```

### Anti-Patterns to Avoid

- **Extending `deliberationEvents.eventType`:** Do not add `"conversation-turn"` or any new literal to the Convex `v.union(...)`. The union is closed and expanding it is a schema migration. Conversation turns go to Sanity only (D-06/D-08).
- **Storing Markdown in `text` fields:** The Chronicler prompt must instruct the model to produce plain prose, no `#`, `##`, `**`, `_`, `[link](url)`. The `<pre>` problem is exactly this pattern recurring.
- **Using positional args with `acomplete()`:** The signature is kwargs-only: `acomplete(agent_id=..., run_id=..., messages=..., response_format=...)`. Six prior plans got this wrong (noted in STATE.md systemic quality issue).
- **Declaring `prefersReducedMotion` inside a React hook:** It must be at module scope (existing pattern in `DeliberationSlot.tsx`) — not inside `useEffect` or `useMemo`.
- **Putting conversation data into Convex:** The conversation is static published content (written once at pipeline time, read via GROQ). Routing it through Convex would require extending the closed `eventType` union and would make the conversation ephemeral/run-dependent.
- **Updating API_CONTRACTS.md after state.py:** The contract declares the field first; `state.py` comments say "VERBATIM from docs/API_CONTRACTS.md §7". Reversing this order means the comment is wrong at commit time.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Structured JSON output from LLM | Custom regex parser | `response_format=_ChroniclerOutput` (Pydantic) passed to `acomplete()` | OpenRouter enforces schema; parser breaks on whitespace/newline variation |
| Turn speaker accent colors | New CSS variables or color constants | `agentChipStyle(agentId)` already in `DeliberationSlot.tsx` | Single source; already maps scout→`--color-scout`, advocate→`--color-advocate`, editor→`--color-primary` |
| Agent display names | New label map | `AGENT_LABELS` + `getAgentLabel()` already in `DeliberationSlot.tsx` | Pre-existing, DEL-04 compliant |
| Voice constraints string | Inline prompt text | `VOICE_CONSTRAINTS` from `lib/voice.py` verbatim (D-16) | Jesse voice is non-negotiable; single source prevents drift |
| Model routing | Direct OpenRouter HTTP call | `MODEL_BY_AGENT["chronicler"]` + `acomplete()` | Usage tracking, AGT-17, rate limiting handled by existing client |
| `model_versions` accumulation | New dict merge logic | `_merge_model_versions` reducer already on `model_versions` in `DispatchState` | Custom merge risks clobbering; the existing `Annotated[..., _merge_model_versions]` handles fan-out merges |
| `_key` generation for Sanity arrays | UUID import | `f'turn-{i:03d}'` sequential keys | Sufficient uniqueness within the array; avoids an import; matches Sanity requirement |

**Key insight:** The entire Chronicler is an assembly of existing pieces. The only genuinely new artifact is the prompt text and the `_ChroniclerOutput` Pydantic model. Everything else — routing, state, graph wiring, voice constraints, speaker styling — is plugged in from existing infrastructure.

---

## Common Pitfalls

### Pitfall 1: acomplete() positional argument call
**What goes wrong:** `await acomplete("chronicler", state["run_id"], messages)` raises `TypeError: acomplete() takes 0 positional arguments but 3 were given`.
**Why it happens:** The signature is `async def acomplete(*, agent_id, run_id, messages, response_format=None)` — all keyword-only (note the `*`). This is a systemic issue: STATE.md records 6/6 prior plans made this mistake.
**How to avoid:** Always write `await acomplete(agent_id="chronicler", run_id=state["run_id"], messages=...)`.
**Warning signs:** `TypeError` at pipeline start before any LLM call completes.

### Pitfall 2: Sanity array write without `_key`
**What goes wrong:** The Python client raises a validation error or Sanity silently rejects the array; the issue draft is written without conversation turns.
**Why it happens:** Sanity's API requires a `_key` field on every item in an array-of-objects when written programmatically. The Studio auto-generates keys; the Python client does not.
**How to avoid:** Include `'_key': f'turn-{i:03d}'` and `'_type': 'object'` in every dict written to the `conversation` array.
**Warning signs:** Array appears empty in Sanity Studio even though pipeline logs show turns generated.

### Pitfall 3: Model name leaking into DeliberationSlot render
**What goes wrong:** `deliberation-no-model-names.test.ts` fails. The DEL-04 tripwire scans source after comment stripping and matches `claude`, `gpt`, `sonnet`, `haiku`, or `openrouter` anywhere in the file.
**Why it happens:** The model name leaks through: a `console.log` debug statement, a comment that wasn't stripped (the tripwire strips block comments but not necessarily all inline comments — verify), or a string constant imported from another file.
**How to avoid:** Never reference model names in `DeliberationSlot.tsx`. The test is never-skipped.
**Warning signs:** Test failure with message showing the matched literal and its position in the file.

### Pitfall 4: `deliberation_conversation` field added to state.py BEFORE API_CONTRACTS.md §7
**What goes wrong:** The comment `# VERBATIM from docs/API_CONTRACTS.md §7` is technically a lie at commit time; if a reviewer or future tool compares them they will diverge.
**Why it happens:** Developers update the implementation file first and forget the contract file.
**How to avoid:** Wave 0 of the plan must update `docs/API_CONTRACTS.md §7` and commit it before `graph/state.py` is touched.
**Warning signs:** `state.py` has the field but `API_CONTRACTS.md §7` does not mention it.

### Pitfall 5: `prefersReducedMotion` declared inside a hook
**What goes wrong:** React renders twice in development; the module-scope check happens once at load time, which is the intended behavior. If moved into a hook, SSR vs browser mismatch can cause hydration errors.
**Why it happens:** Developers reorganizing the component body accidentally move module-scope consts inside the component function.
**How to avoid:** Keep `const prefersReducedMotion = ...` outside the component function, at module scope — exactly as the existing pattern in `DeliberationSlot.tsx`.
**Warning signs:** Hydration mismatch errors in development or animations playing despite reduced-motion setting.

### Pitfall 6: Chronicler fails and conversation is permanently None
**What goes wrong:** Chronicler raises an exception inside `@agent_node`; the wrapper marks the run as `failed` and halts the pipeline. The transcript from `editor_gate_1` is never propagated; the issue draft is never written.
**Why it happens:** The `@agent_node` wrapper propagates unhandled exceptions to Convex as `pipelineRuns:updateStatus('failed')`. Chronicler is sequential before `researcher`, so failure is total.
**How to avoid:** Wrap the LLM call in try/except INSIDE the `chronicler()` function body (before `@agent_node` sees it). On failure, return `{"deliberation_conversation": None}` and let `deliberation_transcript` remain unchanged (the editor_gate_1-set value survives in the checkpointed state).
**Warning signs:** Pipeline halts at chronicler node; Convex shows `failed` status; `researcher` never runs.

### Pitfall 7: Markdown stored in turn `text` fields
**What goes wrong:** The Chronicler LLM produces `**The Scout**:` or `## Round 1 —` in turn text; the frontend renders it as literal characters (`**`, `##`) because the chat bubble renders `turn.text` as a plain string, not via a Markdown renderer.
**Why it happens:** The LLM defaults to Markdown formatting unless explicitly prohibited.
**How to avoid:** The Chronicler system prompt must contain an explicit rule: "Output ONLY plain prose. No Markdown syntax: no `#`, `##`, `**`, `_`, `[link](url)`, no bullet points, no numbered lists. Every turn must be a complete sentence or paragraph in plain prose."
**Warning signs:** Literal `**`, `##`, or `_` appear as text in the rendered chat bubbles on the issue page.

---

## Code Examples

### Verified pattern: Chronicler system prompt structure

```python
# Source: mirrors build_section_writer_prompt in lib/voice.py + VOICE_CONSTRAINTS in lib/voice.py
def _build_system_prompt() -> str:
    return f"""{VOICE_CONSTRAINTS}

You are The Chronicler for The Eisenbalm Dispatch.
Your role: take the actual deliberation data from this week's pipeline run and stage it
as a genuine multi-turn conversation between three named personas.

Personas:
- scout  (The Scout): reports findings; dry, precise, data-first
- advocate  (The Advocate): scores each candidate 0-10 with argument; argues for the best
- editor  (The Editor): makes the final call; reasons from brand and editorial fit

Rules:
1. Faithful dramatization only — invent NO new facts. Every charity name, every advocate
   score, the winner, and the editor's reasoning must trace exactly to the data you receive.
2. Output ONLY plain prose. No Markdown: no `#`, `##`, `**`, `_`, `[link](url)`,
   no bullet points, no numbered lists, no headings.
3. ~8–16 turns with genuine back-and-forth — not one monologue block per persona.
4. Speaker field must be exactly one of: scout | advocate | editor
5. Never reference AI, language models, or Jesse's AI nature.
   Jesse was born AI. This is not a gimmick.
6. Jesse voice applies to every turn: dry, precise, absurdly serious. No winking.
   No irony signaling. No exclamation marks.
"""
```

### Verified pattern: Chronicler user prompt

```python
def _build_user_prompt(
    candidates: list[dict],
    winning_charity: str,
    editor_decision: str,
    runner_up_notes: str,
    issue_number: str | int,
) -> str:
    cand_lines = []
    for c in candidates:
        name = c.get("name", "Unknown")
        score = c.get("advocateScore", "?")
        arg = c.get("advocateArgument", "")
        summary = c.get("scoutSummary", "")
        cand_lines.append(
            f"- {name}: Scout found — {summary} | Advocate score {score}/10 — {arg}"
        )
    candidates_block = "\n".join(cand_lines) if cand_lines else "(no candidates)"

    return f"""Issue #{issue_number} deliberation data:

CANDIDATES CONSIDERED:
{candidates_block}

WINNER: {winning_charity}

EDITOR DECISION: {editor_decision}

RUNNER-UP NOTES: {runner_up_notes or '(none)'}

Stage this deliberation as a {8}–{16}-turn conversation between the three personas.
Return JSON: {{"turns": [{{"speaker": "scout|advocate|editor", "text": "plain prose"}}]}}
"""
```

### Verified pattern: MODEL_BY_AGENT extension

```python
# Source: packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py
# Confirmed existing entries: calibrator, scout, advocate, editor_gate_1, researcher,
#   origin_story, problem, founder_bio, case_study, game, bonus, design, qa, editor_final, publisher
# Add:
"chronicler": MODEL_PIN_VOICE_CRITICAL,   # same as editor_gate_1 — voice-critical
# MODEL_PIN_VOICE_CRITICAL = "anthropic/claude-opus-4-7"
```

### Verified pattern: AGT-17 model_versions recording

```python
# Source: editor_gate_1 return in agents/editor.py ~line 405
# The existing pattern:
existing_mv = state.get("model_versions") or {}
new_mv = {**existing_mv, "editor_gate_1": usage.get("resolved_model", MODEL_BY_AGENT["editor_gate_1"])}
return { ..., "model_versions": new_mv }

# For chronicler — identical pattern:
existing_mv = state.get("model_versions") or {}
new_mv = {**existing_mv, "chronicler": usage.get("resolved_model", MODEL_BY_AGENT["chronicler"])}
return { ..., "model_versions": new_mv }
```

### Verified pattern: @agent_node decorator for non-emitting node

```python
# Source: agents/_wrapper.py — @agent_node signature
# For nodes that do NOT emit deliberationEvents (e.g. verify_research pattern):
@agent_node(name="chronicler", emit_event=None)
async def chronicler(state: DispatchState) -> dict[str, Any]:
    ...
```

### Verified pattern: Sanity Studio preview for turn object

```typescript
// Source: apps/studio/schemas/weeklyIssue.ts — existing array-of-object preview pattern
preview: {
  select: { title: 'speaker', subtitle: 'text' },
  prepare: ({ title, subtitle }: { title: string; subtitle: string }) => ({
    title: title?.toUpperCase() ?? 'UNKNOWN',
    subtitle: subtitle?.slice(0, 80) ?? '',
  }),
},
```

---

## Runtime State Inventory

> This phase does NOT rename any existing field, agent ID, or collection name. No stored data migration is required.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | Existing `weeklyIssue` Sanity documents have no `conversation` field | None — additive field; old documents render gracefully with `conversation: null` |
| Live service config | No external service config references field names from this phase | None |
| OS-registered state | None | None — verified by grep |
| Secrets/env vars | `MODEL_PIN_VOICE_CRITICAL` resolves via `OPENROUTER_API_KEY` (already in Railway env) | None — no new secrets needed |
| Build artifacts | `packages/pipeline` egg-info / wheel: Chronicler is a new module in existing package; no rename | Reinstall not required; package structure unchanged |

Old issued documents (no `conversation` field): the GROQ projection returns `conversation: null` (Sanity returns null for missing array fields). The frontend guards `{conversation && conversation.length > 0 && ...}`. No migration needed.

---

## Environment Availability

> Step 2.6: No new external tools, services, CLIs, or runtimes required.

All dependencies already available in the project environment:
- `pydantic` (for `BaseModel`) — already in `packages/pipeline` dependencies (used in `agents/editor.py`)
- `openrouter` client — `acomplete()` already functional
- Sanity Python client — `write_issue_draft` already in `lib/sanity_client.py`
- Node.js + `pnpm` — already used for `apps/web`
- `vitest` — already configured for `apps/web/__tests__/`
- `pytest` — already configured for `packages/pipeline/`

**Step 2.6 SKIPPED (no new external dependencies).**

---

## Validation Architecture

> `workflow.nyquist_validation` not explicitly set to false in `.planning/config.json` — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Frontend framework | Vitest (configured in `apps/web/`) |
| Backend framework | pytest (configured in `packages/pipeline/`) |
| Frontend quick run | `pnpm --filter web test --run` |
| Frontend full suite | `pnpm --filter web test --run && pnpm --filter web build` |
| Backend quick run | `pytest packages/pipeline/ -x -q` |
| Backend full suite | `pytest packages/pipeline/ -v` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| DEL-P13-01 | Chronicler node runs and produces ≥8 well-formed `{speaker, text}` turns | unit (pytest) | `pytest packages/pipeline/tests/test_chronicler.py -x` | ❌ Wave 0 |
| DEL-P13-02 | Turns are faithful — charity names, scores, winner, editor reasoning all traceable to actual state values passed in | unit (pytest) | `pytest packages/pipeline/tests/test_chronicler.py::test_turn_faithfulness -x` | ❌ Wave 0 |
| DEL-P13-03 | Fallback fires — when Chronicler raises, `_format_deliberation_transcript` transcript value survives unchanged | unit (pytest) | `pytest packages/pipeline/tests/test_chronicler.py::test_fallback_preserves_transcript -x` | ❌ Wave 0 |
| DEL-P13-04 | Frontend renders no literal Markdown — `#`, `##`, `**` never appear as rendered text nodes in chat bubbles | unit (vitest, source scan + snapshot) | `pnpm --filter web test --run deliberation-chat` | ❌ Wave 0 |
| DEL-P13-05 | DEL-04 — no model names anywhere in `DeliberationSlot.tsx` (existing never-skipped tripwire) | unit (vitest) | `pnpm --filter web test --run deliberation-no-model-names` | ✅ exists at `apps/web/__tests__/deliberation-no-model-names.test.ts` |
| DEL-P13-06 | `pnpm --filter web build` passes (TypeScript + Next.js compilation) | build (smoke) | `pnpm --filter web build` | ✅ infrastructure exists |
| DEL-P13-07 | `pytest packages/pipeline/` green — `test_transcript_format` exact-header assertions survive (D-18 fallback not deleted) | regression (pytest) | `pytest packages/pipeline/tests/agents/test_editor.py::test_transcript_format -x` | ✅ exists (must not be deleted) |
| DEL-P13-08 | `graph/builder.py` wires chronicler between editor_gate_1 and researcher | unit (pytest, source scan) | `pytest packages/pipeline/tests/test_builder_wiring.py -x` | ❌ Wave 0 |
| DEL-P13-09 | Sanity write includes `conversation` array with `_key` fields | unit (pytest, mock Sanity client) | `pytest packages/pipeline/tests/test_sanity_write.py::test_conversation_write -x` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter web test --run && pytest packages/pipeline/ -x -q`
- **Per wave merge:** `pnpm --filter web test --run && pnpm --filter web build && pytest packages/pipeline/ -v`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `packages/pipeline/tests/test_chronicler.py` — covers DEL-P13-01, DEL-P13-02, DEL-P13-03 (unit test with mocked `acomplete`)
- [ ] `packages/pipeline/tests/test_builder_wiring.py` — covers DEL-P13-08 (source scan asserting `add_edge("editor_gate_1", "chronicler")` and `add_edge("chronicler", "researcher")` present)
- [ ] `packages/pipeline/tests/test_sanity_write.py::test_conversation_write` — covers DEL-P13-09 (mock sanity client asserting `_key` present on each turn)
- [ ] `apps/web/__tests__/deliberation-chat.test.ts` — covers DEL-P13-04 (source scan of `DeliberationSlot.tsx` asserting no `#`, `##`, `**` in JSX text nodes or string literals outside of comments)

Existing tests that MUST NOT be deleted:
- `apps/web/__tests__/deliberation-no-model-names.test.ts` — DEL-04 (DEL-P13-05)
- `packages/pipeline/tests/agents/test_editor.py::test_transcript_format` — D-18 fallback (DEL-P13-07)

---

## Sources

### Primary (HIGH confidence)
- `13-CONTEXT.md` — D-01..D-18 locked decisions; all phase constraints
- `docs/API_CONTRACTS.md §1.2, §2.2, §3.4, §4.3, §7` — GROQ read, Sanity write, Convex schema, DispatchState contracts
- `packages/pipeline/src/eisenbalm_pipeline/graph/builder.py` — exact current edge wiring
- `packages/pipeline/src/eisenbalm_pipeline/graph/state.py` — DispatchState field placement
- `packages/pipeline/src/eisenbalm_pipeline/agents/editor.py` — `_format_deliberation_transcript`, `editor_gate_1` return, `EditorDecision` Pydantic pattern
- `packages/pipeline/src/eisenbalm_pipeline/lib/voice.py` — `VOICE_CONSTRAINTS` verbatim string
- `packages/pipeline/src/eisenbalm_pipeline/lib/llm_config.py` — `MODEL_BY_AGENT`, `SAMPLING_BY_AGENT`, `MODEL_PIN_VOICE_CRITICAL`
- `packages/pipeline/src/eisenbalm_pipeline/lib/openrouter_client.py` — `acomplete()` kwargs-only signature confirmed
- `packages/pipeline/src/eisenbalm_pipeline/agents/_wrapper.py` — `@agent_node` decorator signature
- `apps/studio/schemas/weeklyIssue.ts` — `selectionDeliberation` and `podcast` object field locations
- `apps/web/components/issue/DeliberationSlot.tsx` — `AGENT_LABELS`, `getAgentLabel`, `agentChipStyle`, `prefersReducedMotion` module-scope pattern, `<section id="deliberation">` structure
- `apps/web/components/issue/PodcastSlot.tsx` — lines ~96-127 containing `<pre>{transcript}</pre>` to remove
- `apps/web/lib/sanity/types.ts` — `IssueDeliberation`, `IssuePodcast` types
- `apps/web/__tests__/deliberation-no-model-names.test.ts` — DEL-04 tripwire scan logic verified
- `apps/web/lib/sanity/queries.ts` — `QUERY_ISSUE_BY_SLUG` current `selectionDeliberation` projection
- `apps/web/app/issue/[slug]/page.tsx` — section order, `DeliberationSlot` and `PodcastSlot` prop shapes
- `convex/schema.ts` — `deliberationEvents.eventType` closed union confirmed; turns must NOT go here

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — systemic `acomplete()` positional-arg error (6/6 prior plans got it wrong)
- `.planning/REQUIREMENTS.md` — phase 13 roadmap requirements and success criteria

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all existing patterns verified from source
- Architecture: HIGH — update sequence and all code patterns verified from 18 canonical files
- Pitfalls: HIGH — sourced from actual code bugs (acomplete signature, DEL-04 tripwire, Sanity `_key` requirement)
- Test map: HIGH — existing test files confirmed; Wave 0 gaps identified from missing test files

**Research date:** 2026-05-23
**Valid until:** 2026-06-23 (stable stack; no fast-moving dependencies)
