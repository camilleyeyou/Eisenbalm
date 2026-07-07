# Decisions to make before / while building

> **STATUS: Most decisions are now made** (recorded below by the editor-in-chief, Jul 2026). Items marked **DECIDED** are settled — build to them. Items marked **TO DEFINE WITH DEV** need a working session but the direction is set.

---

## DECIDED

### 1. Publishing requires TWO independent green lights. ✅ DECIDED
An issue cannot publish until **both** are true: (a) **facts cleared** (Review Desk) and (b) **sounds human** (Voice Pass, written/edited by the human so it doesn't read like AI). Two separate sign-offs, both mandatory, every issue. Neither can be skipped.
→ *Build:* a publish state machine gated on two booleans; Voice Pass is a required step, not optional.

### 2. Run Monitor is FORENSIC (after-the-fact), but must be fully auditable. ✅ DECIDED
The human does **not** watch runs live. They get notified when something needs them (Awaiting-you inbox). BUT every run must be **recorded in full and replayable** so the editor can audit what happened and use it to improve the agents.
→ *Build:* no live streaming needed. Instead, persist a complete, inspectable run record — every node's input, output, cost, latency, retries, and the handoff between nodes — queryable after the fact. Re-run-from-node uses this record.

### 3. Provenance is a per-claim ANNOTATION + a reviewable INDEX, checked before publish. ✅ DECIDED
Confirmed as a hard rule from day one: the Researcher attaches a source (URL + retrieval date) to **every factual claim**, and that binding survives into the final prose. The editor reviews it two ways before publishing:
- **Inline annotations** — each claim highlighted in the galley, hover/click → its source.
- **A source index** — one consolidated list (now on the Review Desk rail): unsourced claims grouped at top ("jump to"), sourced claims listed with their source. The editor sweeps this as a pre-publish checklist.
→ *Build:* Researcher output schema binds provenance per claim; section writers preserve the binding; the galley renderer maps text spans → provenance records; the rail renders the index from the same data. Unsourced is a first-class, visible state — never blank.

### 4. The pipeline MUST pause, notify, and resume. ✅ DECIDED
Required. When an agent needs a human (`requiresHumanInput` — e.g. a tie at Gate 1, a brand-risk signal), it **stops, fires a notification, and waits**; the human resolves it (with a logged reason); the pipeline **resumes** from there.
→ *Build:* a durable, resumable orchestration (not fire-and-forget) that supports human-in-the-loop tasks; the Awaiting-you inbox is the notification surface; "stuck" states must page the editor.

### 5. Tech stack — already chosen by the developer. ✅ DECIDED (no action)
A working app/stack exists (the developer built the current site). Recreate these designs within it. The one constraint to honor: the pipeline must support pause/notify/resume (see #4). *(Note: I — Claude — can't see the live site; the developer should reconcile these designs against what's already there.)*

### 6. Writers: ONE box that expands to seven, WITH per-section strength. ✅ DECIDED + now in the design
Run Monitor shows "7 Writers" as one node that **expands to all seven sections** (origin, problem, founder, case, game, bonus, note). Each section shows a **strength read** — a 0–100 score with a colored bar (green ≥80 / marigold ≥65 / rust below) and its flag count (clean / warnings / error). This tells the editor at a glance which section is weak and where to spend the five minutes.
→ *Build:* QA/eval assigns a per-section confidence score; Run Monitor renders the expandable list; each section is individually re-runnable. *(Implemented in the prototype — click the Writers node.)*

### 7. Roles: one Editor-in-Chief, assignable. ✅ DECIDED
There is a single **Editor-in-Chief** role that owns review and publish. It can be **assigned to a different person** (delegation), but it's one seat, not a shared free-for-all. Others (if any) are read + comment only.
→ *Build:* an assignable EIC role; publish is restricted to whoever holds it; optional read/comment collaborators.

### 8. Machine-tell detection: BOTH heuristic list AND model judge. ✅ DECIDED
Voice Pass uses a fast, cheap **banned-cliché/heuristic list** for the obvious tells (instant) *plus* an **AI judge** for subtle voice violations (smarter, slower, small cost).
→ *Build:* two-layer detector; heuristics run inline as you type/read, the judge runs on demand or on section-complete.

---

## TO DEFINE WITH DEV (direction set, details in a working session)

### 9. Golden test scenarios — the editor's standards, written as pass/fail tests.
Plain version: these are a **"driving test" for the agents** — a fixed set of situations (normal week, no-good-charities week, famous-charity-sneaks-in, fake-charity-with-dead-site, etc.) each with a defined *correct behavior*, so whenever the agents or prompts change you can confirm they still meet your editorial bar instead of guessing.
→ **Decision made:** the **Editor-in-Chief defines these with the developer early** — they encode editorial judgment, not engineering. The dev turns each into a runnable check and maintains the harness. Start with the 8 in the design; add more as real failures teach you new ones.
→ *Working session needed:* write down, per scenario, "what does the right outcome look like?" That's the whole task.

### 10. Remaining data-contract details (dev owns, EIC signs off)
Not blockers, but pin these during sprint 1 so nothing silent slips in:
- **QA finding schema:** `{ axis, severity(error|warning|info), quotedSpan, sectionId, reason, suggestedFix }`; how "Accept fix" mutates the stored section and logs it.
- **Prompt versioning + commit-gating:** what counts as a regression; when Commit is enabled; the **override-with-reason** escape hatch (so the gate can't deadlock); immutable version history + one-click rollback.
- **"Nothing silent" logging:** every dismiss / overrule / kill needs a one-line reason, stored **append-only** where the next agent or human reads it (corrections log + deliberation transcripts).
- **Cost metering:** per-node → per-run → month-to-date vs. cap; recommend an ambient warning at the cap, not a hard stop.
- **The "game" sandbox:** which agent produces it, how it's stored, and the iframe CSP.

---

## Design decisions (settled)
- **Visual direction:** 1c bold anti-SaaS magazine, vibrant palette (no beige) — locked.
- **Desktop-first**, single focused operator; no dark mode (per brief).
- **Fonts:** Newsreader / Lora / Space Grotesk / IBM Plex Mono — all OFL, safe to self-host.

## Suggested build order
1. Reconcile designs with the existing app; confirm the pipeline can pause/resume (#4).
2. Run Monitor (forensic record + expandable writers w/ strength) + Review Desk (facts + source index).
3. Voice Pass + the two-sign-off publish gate (#1, #8).
4. Signal Desk + interrupt/adjudication (#4).
5. Prompt Lab + Eval Center + golden scenarios (#9, #10).
6. Registry + append-only logs + Awaiting-you inbox glue.

