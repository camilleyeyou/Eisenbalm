# v3 Derived-State Contract

Extract of the `DCLogic` state machine in `Dispatch Control v3.dc.html`. This is the part of the prototype that is *behaviour*, not layout — every phase that touches issue state must agree with it.

---

## 1. Everything derives from four booleans

The prototype's entire header, task list, stage tabs, issue card, and publish lock derive from a handful of primitives. Ours map as follows:

| Prototype | Our source of truth |
|---|---|
| `claimDone` | zero `claim_checks` rows with `status != 'checked'/'skipped'` **and** zero unsourced load-bearing claims |
| `voiceDone` | active (unrevoked) `sign_offs` row, `kind = 'sounds-human'` |
| `factDone` | active (unrevoked) `sign_offs` row, `kind = 'facts-cleared'` |
| `founderApplied` | a content-patch was applied to a passage (drives the "changed" counter) |
| `published` | issue status |

```
ready    = factDone && voiceDone           // publish unlock
canPublish = ready && isEditor && !published
```

**This is exactly the Phase 34 two-sign-off gate.** No new gate logic — reuse `sign_offs`.

## 2. My Tasks is DERIVED, not stored

```js
taskCount = (claimDone ? 0 : 1) + (voiceDone ? 0 : 1) + (founderApplied ? 0 : 1)
```

Tasks are a **projection** over open claims, open findings, and missing sign-offs. **Do not add a tasks table.** Implement as a selector. Consequences that fall out for free:

- "Superseded" needs no lifecycle — a restarted step simply re-derives.
- Resolved tasks render struck-through in-session (`titleDeco`, `sev: 'Done'`, `age: 'resolved just now'`) and then fall out of the projection.

Each derived task carries: `sev` (Must fix / Review recommended / Information), `title` (plain language), `where` (stage), `why` (why human judgment is required), `rec` (agent recommendation, nullable), `primary` (its own verb + deep link), `insp` (inspector artifact key).

## 3. Header separates four state systems — never blended

```
Issue status    Draft · Needs review · Ready to publish · Published · Held
System activity Idle · Running · Paused for you · Failed · Complete
My Tasks count  <n>
Cost vs budget  $12.40 / $200
```

`hdrStatus = published ? 'Published' : (ready ? 'Ready to publish' : 'Needs review')`
`hdrActivity = pausedForYou ? '⏸ Paused for you' : (published ? 'Complete' : 'Idle')`

## 4. Fact Check counters

```
factCoverage  = "10 of 11" → "11 of 11"      // checked / total
mustFixCount  = unsourced load-bearing claims
changedCount  = claims touched by an applied revision since last check
uncheckedCount, conflictsCount, checksNotRunCount
```

`changedCount` increments when a revision is applied **even if the replacement text is itself sourced** (the prototype's founder fix replaces an unsourced characterization with an already-checked fact, and still increments). So: **block-level touched-counter, not re-verification.** Cheap to implement, and it *is* the spec.

**Blank never means verified.** Every claim renders an explicit state: `✓ Checked` or `✕ Must fix`.

## 5. Claim shape (Stage 3 + the reused provenance card)

```ts
{ text, importance: 'Load-bearing'|'Supporting'|'Incidental',
  status, sourceUrl, sourcePublisher, supportingPassage,
  retrievedAt, agent, confidence }
```

Maps onto our existing `claim_checks` (Phase 35 gave us `claimId`/`sourceUrl`/`retrievedAt`/`sectionName`). **New field required: `importance`** — emitted by the Researcher.

Actions: Confirm · Edit claim · Replace source · **Ask agent for better evidence** · Remove claim · Keep as written — add reason · Inspect.

*Ask agent for better evidence* returns a replacement source **and a rewritten claim** in one action:
> `"demand outpaces supply four to one"` (unsourced) → `"demand outpaces installations roughly four to one"` + Post & Courier (Jun 2025). Confirm replacement → content-patch + claim update + decision-log entry.

## 6. Role gating — exactly six actions

`isEditor = role === 'Editor-in-chief'`. Collaborator = read + comment. Locked controls **render with an explanation**, never hidden:

| Action | Locked label |
|---|---|
| Apply revision | `Apply revision 🔒 editor only` |
| Confirm evidence replacement | (no-op) |
| Approve the Voice Pass | `Voice approval 🔒 Editor-in-chief only` |
| Publish issue | `Collaborators can review and comment, not publish.` |
| Make instruction active | `Make active 🔒 Editor-in-chief only` |
| Mark Do not use | `🔒 editor only` |

## 7. Run Details — 11 action-named steps

Name is the action; the agent is secondary metadata (`— Signal Editor`). Diamonds (`◆ marigold, rotated square, italic label`) = deterministic checks.

| # | Step (shown) | Agent (secondary) | Check? |
|---|---|---|---|
| 1 | Find story leads | Signal Editor | |
| 2 | Find organizations | Scout | |
| 3 | Verify organizations | deterministic check | ◆ |
| 4 | Make the case | Advocate | |
| 5 | Choose recommended story | Agent Editor | |
| 6 | Research the issue | Researcher | |
| 7 | Verify research | deterministic check | ◆ |
| 8 | Draft sections | seven writing agents | |
| 9 | Check the draft | QA | |
| 10 | Recommend publication | Agent Editor Final | |
| 11 | Prepare publication | Publisher | ◆ |

Step states: `Waiting · Running · Complete · Paused — done · Failed · Skipped`.
Failed run: failed step in vermilion, **downstream steps dim + read `Skipped`**, and the rail explains in plain language — *what happened / completed successfully / what did not happen / recommended recovery* — with **Restart from this step** ("completed steps are reused, not re-paid") and **Improve this agent**.

## 8. Inspector artifact contract

Six artifact types in the prototype: `founder` (a drafted section), `claim`, `rec` (agent editor's recommendation), `org` (organization selection), `signal` (story leads), `qa`. Each anchors to a **step**, not a span — so section-level granularity suffices, resolvable via `sectionName → writer → agent_runs`.

```ts
interface InspectorArtifact {
  title: string; meta: string          // "step: … · agent: … · instructions v4 · run #7"
  asked: string; result: string        // Summary tab — human-readable, never JSON
  confidence: string; warning: string
  upstream: string; downstream: string
  inputs: string                       // Inputs tab — values actually supplied
  missing: string                      // ⚠ THE HIGH-VALUE FIELD — see below
  instructionVersion, instructions, sectionGuidance   // Instructions tab
  output: string; outputNote: string   // + note when the issue text has since diverged
  sources: { title, mark, passage, retrievedAt }[]
  model, timing, cost, latency, validation            // Diagnostics tab
  json: string                         // Technical tab — never the default anywhere
}
```

**`missing` is computable and is the single highest-leverage item in the design.** It is `declared template variables − keys actually supplied in the run's input payload`. The Prompt Lab `VariableRegistry` already parses the declared set; we need the run's actual input keys. This is what turns a bad sentence into a prompt fix:

> `characterization_examples` — the instruction references good/bad examples, but the system supplies none. **Likely cause of the inflated phrase.**

Footer actions (all six artifacts): Ask agent to revise · Restart from this step · Improve this agent · Compare instruction versions · Related quality tests · Prior & downstream steps.

## 9. Ask agent to revise — direction chips, never bare "Regenerate"

`Make more specific · Make clearer · Tighten · Match the brief more closely · Reduce repetition · Try another approach · Custom direction…`

Returns a comparison card **before** apply: Original (strikethrough) | Proposed, plus a **What changed** line that names the claim delta explicitly:

> "Replaced unverifiable characterization with a sourced biographical fact. **Claims: 1 altered** — 'former county clerk' is already checked (Post & Courier, 2019). No claims added or removed."

Then: Apply / Edit before applying / Try another approach / Discard.

## 10. Known prototype bugs — do not port

- **Voice approval is not revoked when a revision is applied.** `voiceDone` survives `founderApplied`, contradicting the prototype's own copy ("Any later material prose change returns this to Review needed automatically"). Our Phase 34 sign-off revocation is correct. Port the sentence, not the wiring.
- **"Start from my brief" is unwired** — both Create cards call the same handler. Milestone decision: build it as a real second pipeline entry point (skip Scout + Gate 1, enter at Researcher).
