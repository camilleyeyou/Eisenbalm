# Phase 13: Deliberation as Conversation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-23
**Phase:** 13-deliberation-as-conversation
**Mode:** `--auto` (recommended defaults auto-selected; no interactive answers)
**Areas discussed:** Chronicler insertion, Turn storage layer, Frontend placement & render, Chronicler prompt & turn shape, Podcast transcript preservation

---

## Chronicler — pipeline placement & I/O

| Option | Description | Selected |
|--------|-------------|----------|
| New `chronicler` node between `editor_gate_1` → `researcher` | All inputs (candidates+scores, winner, editorDecision, runnerUpNotes) exist by then; stays sequential, no reducer change | ✓ |
| Run inside `editor_gate_1` (extend existing node) | Fewer graph edges, but bloats Editor responsibilities and the LLM call | |
| Run after `validate_sections` / before publisher | Later than necessary; same inputs already available right after Editor | |

**Auto-selected:** New sequential `chronicler` node between `editor_gate_1` and `researcher`.
**Notes:** Editor return already exposes everything the Chronicler consumes; Sanity write at run end picks up the canonical transcript naturally. (D-01..D-05)

---

## Structured-turn storage layer

| Option | Description | Selected |
|--------|-------------|----------|
| Sanity additive field on `weeklyIssue` | Canonical, Andrew-reviewable, persistent published content; avoids touching locked Convex eventType union + emission path | ✓ |
| New Convex `deliberationEvents` eventType `dialogue-turn` | Realtime/run-keyed; but conversation is published content, and this extends a locked `v.union` + risks the "do not regress emission path" constraint | |
| Both (Sanity canonical + Convex live mirror) | Maximal, but doubles surface area and Convex schema risk for no clear benefit this phase | |

**Auto-selected:** Sanity additive field (shape `{speaker, text}[]` under `selectionDeliberation`/`podcast`; final shape reconciled with `docs/API_CONTRACTS.md` §1.2/§2.2 + the schema before coding).
**Notes:** CLAUDE.md hard rule — no schema field renames / new payload shapes without API_CONTRACTS.md. No new Convex eventType. (D-06..D-08)

---

## Frontend placement & render

| Option | Description | Selected |
|--------|-------------|----------|
| Chat thread at TOP of existing `#deliberation` section, visible by default | Reuses anchor (MED-04's 8 SectionNavigator ids intact), lifts conversation out of podcast `<details>`; machine view stays collapsed below | ✓ |
| New standalone section with its own anchor id | Cleanest separation, but adds a 9th anchor → SectionNavigator churn + nav-count assumptions | |
| Keep in PodcastSlot but format the markdown | Still "buried under the podcast disclosure" — violates the goal | |

**Auto-selected:** Render at the top of `#deliberation`, visible; machine pitch/flow/QA stays in its `<details>` below; remove the `<pre>` dump from PodcastSlot.
**Notes:** Reuse `AGENT_LABELS`/`getAgentLabel`/`agentChipStyle`, `/agents/[agentId]` links, speaker accent vars; preserve reduced-motion / WCAG AA / single `<main>` / ≥44px / DEL-04 / no new deps. (D-09..D-12)

---

## Chronicler prompt & turn shape

| Option | Description | Selected |
|--------|-------------|----------|
| Faithful dramatization, ~8–16 real back-and-forth turns, structured JSON, VOICE_CONSTRAINTS verbatim, single call | Invents no facts; genuine turn-taking; one LLM call (cost/cadence) | ✓ |
| Free creative fiction | Risks unfaithful claims (wrong scores/winner) — violates fidelity success criterion | |
| One block per agent (3 turns) | Reproduces the current "lists each agent once, no debate" problem | |
| Multi-call live debate | Rejected for cost + weekly cadence (see Deferred) | |

**Auto-selected:** Faithful dramatization, 3 named speakers (Scout/Advocate/Editor), ~8–16 `{speaker,text}` turns, JSON output, reuse `VOICE_CONSTRAINTS` + explicit DEL-04, single LLM call.
**Notes:** (D-13..D-16)

---

## Podcast / NotebookLM transcript preservation

| Option | Description | Selected |
|--------|-------------|----------|
| Keep `podcast.deliberationTranscript`, derive from Chronicler turns; retain template + test as fallback | Usable transcript always exists; no run ends transcript-less; existing test stays green | ✓ |
| Drop the transcript field entirely | Breaks V2-02 NotebookLM export (success criterion 4) | |
| Keep template as primary, Chronicler as extra | Defeats the purpose — template is the dry report being replaced | |

**Auto-selected:** Chronicler turns are canonical; `deliberationTranscript` derived from them for NotebookLM; deterministic `_format_deliberation_transcript` + `test_transcript_format` retained as the fail-safe fallback.
**Notes:** (D-17, D-18)

---

## Claude's Discretion

- Exact new Sanity field name/nesting (`selectionDeliberation.conversation` vs `podcast.*`).
- Exact `DispatchState` turns field name.
- Chat-bubble visual styling within D-11/D-12 constraints.
- Chronicler module location (new module vs `editor.py`).
- Turn-count tuning within ~8–16.

## Deferred Ideas

- Live multi-turn debate loop (multi-LLM-call) — cost + cadence; future version.
- Real-time streaming of the conversation as chronicled — out of scope.
