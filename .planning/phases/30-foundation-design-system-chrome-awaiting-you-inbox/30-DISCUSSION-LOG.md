# Phase 30: Foundation — Design System, Chrome & Awaiting-You Inbox - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 30-foundation-design-system-chrome-awaiting-you-inbox
**Areas discussed:** Old routes → new nav, Restyle depth, Inbox behavior, Spec ingestion + How-to-use

---

## Old routes → new nav

### Q: Config, Finance, Settings aren't in the 1c nav — where do they live?

| Option | Description | Selected |
|--------|-------------|----------|
| Third nav group | "Operations" group below Craft & memory, styled to match | ✓ |
| Strict spec — URL only | Unlisted but live at their URLs | |
| Fold into other screens | Finance → spend-chip click-through; Config+Settings merge | |

### Q: What do not-yet-built nav items (Review Desk, Signal Desk, Voice Pass, Eval Center) render?

| Option | Description | Selected |
|--------|-------------|----------|
| 1c placeholders | Phase-labeled "coming in Phase X" pages, 1c-styled | ✓ |
| Route to nearest equivalent | Blurs built vs not | |
| Hide until built | Nav order changes every phase | |

### Q: Rename routes to final 1c names now, or relabel only?

| Option | Description | Selected |
|--------|-------------|----------|
| Final routes now | New paths + redirects from old; later phases build in final homes | ✓ |
| Relabel only | Keep /graph, /runs, /prompts URLs | |

### Q: Home route after Phase 30?

| Option | Description | Selected |
|--------|-------------|----------|
| Review Desk | Match spec now, even as placeholder | ✓ |
| Run Monitor until 32 | Most useful existing screen first | |

### Q (follow-up): What does /run-monitor render given Graph + Runs both exist?

| Option | Description | Selected |
|--------|-------------|----------|
| Runs + Graph as tabs | Both under one nav item; Phase 37 replaces interior | ✓ |
| Runs only, Graph retired | DAG dropped from nav | |
| Keep both nav items | Deviates from 7-item spec nav | |

---

## Restyle depth

### Q: How deep does the restyle go on existing screens?

| Option | Description | Selected |
|--------|-------------|----------|
| Token swap + chrome | Chrome to dc.html fidelity; existing screens keep layouts, get 1c skin | ✓ |
| Full 1c re-layout everywhere | Highest fidelity, partially thrown away by later phases | |
| Chrome only | Fails the "no leftover default styling" criterion | |

### Q: Config/Finance/Settings have no later rebuild phase — extra polish?

| Option | Description | Selected |
|--------|-------------|----------|
| Token swap only | Note layout oddities as follow-ups, don't fix here | ✓ |
| Light 1c pass | Targeted layout fixes now | |

---

## Inbox behavior

### Q: What counts as an "unresolved blocker"?

| Option | Description | Selected |
|--------|-------------|----------|
| Errors + unsigned claims | Unaccepted error-severity qaCorrections + open claim sign-offs | ✓ |
| Error-severity QA only | Narrower | |
| Everything unresolved | Noisy | |

### Q: How do items leave the inbox?

| Option | Description | Selected |
|--------|-------------|----------|
| Pure derivation | Item exists iff state unresolved; no new persistence | ✓ |
| Dismissable | New Convex flag; breaks no-new-backend decision | |

### Q: Scope window?

| Option | Description | Selected |
|--------|-------------|----------|
| Active runs only | Live states always; failed runs from current cycle only | ✓ |
| Last N runs | Fuller, staler | |
| Everything ever | Noisiest | |

### Q: Routing while owning screens are placeholders?

| Option | Description | Selected |
|--------|-------------|----------|
| Working screen now | Route to where action can be taken today; re-point later | ✓ |
| Final routes now | Would land on "coming in Phase X" dead ends | |

---

## Spec ingestion + How-to-use

### Q: Commit the design handoff bundle (currently in ~/Downloads) into the repo?

| Option | Description | Selected |
|--------|-------------|----------|
| Commit to docs/ | Full bundle → docs/design/dispatch-control-v2/ | ✓ |
| Commit spec only | Skip wireframe + rejected directions | |
| Reference external path | Fragile, invisible to worktree/cloud agents | |

### Q: Who writes the How-to-use content?

| Option | Description | Selected |
|--------|-------------|----------|
| Draft from handoff | Claude drafts from README + DECISIONS.md + color legend; Andrew reviews at UAT | ✓ |
| User provides copy | | |

---

## Claude's Discretion

- Font role mapping (follow dc.html), chip styling, inbox dropdown internals, empty-state copy
- Spend-cap source (`cost_cap_usd` config vs env — use existing canonical)
- Redirect implementation, Operations group label, /run-monitor tab mechanics
- Preserving Phase 24 `.cm-prompt-editor` styles through the retheme

## Deferred Ideas

- Config/Finance/Settings layout follow-ups if the new skin reads poorly
- Graph retirement/merge decision → Phase 37
- Inbox route re-pointing → Phases 32/37
- EIC seat + stuck-state notifications → later phases per DECISIONS.md
