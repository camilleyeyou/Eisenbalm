# Design Brief — Dispatch Control v2
*Paste this whole document into Claude Design. Companion low-fi wireframe: `4 — Wireframe — Dispatch Control v2.html`.*

## Product context

Dispatch Control is the operator console for The Eisenbalm Dispatch: a weekly, agent-produced editorial issue that features one obscure-but-verified charity, tied to a cultural moment, written in a dry Fortune-500 register ("Jesse voice"). A pipeline of ~11 LLM agents plus deterministic code gates produces each issue. One human — Andrew — reviews and publishes.

V1 (exists) is CRUD over prompts and runs. V2's job is different: **make one person operate like a whole masthead.** Three jobs, in priority order:

1. **Review an issue in under 5 minutes** — everything blocking, sourced, and decidable on one screen.
2. **Improve prompts safely** — edit → eval → scoreboard → commit/rollback, without paid pipeline runs.
3. **Trust the system's self-checks** — verification status, provenance, and drift visible everywhere, so silence means "verified," never "unchecked."

Design temperament: the console should feel like the publication — warm paper, near-black ink, serif display (Cormorant Garamond) over readable body (Lora), gold #CDA434 / rust #C2502A as accents only. Dense but calm; a newsroom desk, not a SaaS dashboard. No dark mode.

## Users

- **Andrew (primary, daily-to-weekly):** publisher/editor-in-chief. Reviews issues, adjudicates flags, edits prompts, watches spend. Non-engineer but technical enough for JSON when needed — JSON must never be the default view.
- **Collaborator (occasional, read-mostly):** sees status and history, can comment, cannot publish.

## Information architecture

Left sidebar, six items, in workflow order:
**1 Review Desk · 2 Signal Desk · 3 Run Monitor · 4 Prompt Lab · 5 Eval Center · 6 Registry**
Persistent header strip on every screen: current issue #, pipeline state (idle / running / awaiting review / interrupt), month-to-date spend vs. cap, and a lock chip reading "Auto-publish OFF" (clicking it explains why it should stay off; turning it on requires typed confirmation).

---

## Screen 1 — Review Desk (home)

The 5-minute publish review. Two-column layout.

**Left (70%): The Galley.** The issue rendered as the reader will see it (theme fonts/colors applied), one continuous scroll: headline, origin story, problem, founder bio, case study, game (playable inline in its sandbox), bonus, editor's note. Overlaid:
- **QA annotations inline:** offending spans get a subtle underline — rust for error, gold for warning, gray dotted for info. Click → side popover with axis, reason, suggested fix, and three actions: *Accept fix* (applies suggested text, logged), *Edit* (inline rich-text on that block only), *Dismiss* (requires one-line reason, logged).
- **Provenance on demand:** every factual claim the Researcher sourced carries an invisible anchor; hover shows source URL + retrieval date; click opens source in new tab. Claims WITHOUT provenance are highlighted automatically in pale rust — "unsourced claim" is a first-class visual state, the single most important signal on this screen.
- **Section header chips:** per-section QA status (✓ clean / n warnings / n errors) for jump-navigation.

**Right (30%): The Decision Rail.** Sticky column:
1. **Blocking items** — every error-severity finding as a checklist; each must be resolved (accepted/edited/dismissed-with-reason) before Publish enables.
2. **Editor's memo** — Editor Final's 100-300 word brief: blocking items, judgment calls, one-sentence thesis verdict.
3. **Hook card** — the signal, the charity's claim on it, hookVerified badge, dated peg with source.
4. **Verification summary** — charity domain ✓, registration ID ✓, founder name sourced/anonymous, stat coverage "11/11 claims sourced."
5. **Actions** — Publish (primary, disabled until blocking list clears), Request re-run of a single section (picker), Hold issue, View deliberation transcript.

Empty state (no run awaiting review): last published issue + "Trigger run" + next scheduled run.

## Screen 2 — Signal Desk

Where discovery becomes an editorial decision.

- **Signal board (top):** 3 cards from the Signal Editor: signal, dated peg (with source link), reader energy, charity angle, category chip, brand-risk chip when flagged (rust outline, never auto-hidden). Andrew can kill a signal (reason required, feeds previous_signals memory) or pin one as mandatory.
- **Candidate slate (middle):** cards grouped under their signal. Each card: name, one-line mechanism, hookClaim, the four gates as pass badges (REAL / OBSCURE / SPECIFIC / TELLABLE), VerificationRecord strip (domain ✓ · EIN ✓ · parent-org flag ⚠ · press-hits count), Advocate score 1-10 with expandable 150-250-word argument, keyStrengths, primaryConcern always visible (never truncated — concerns are surfaced, not hidden).
- **Decision panel (bottom):** Gate 1 output — winner, confidence meter, editorReasoning; if the Editor overruled the top score, the stated cause renders as a distinct callout. **Interrupt state:** when requiresHumanInput=true the whole screen enters adjudication mode — top-two candidates side by side, Andrew picks, decision + rationale logged to the deliberation transcript.

## Screen 3 — Run Monitor

The existing DAG view, upgraded: vertical pipeline with code gates drawn as distinct diamond nodes (Verify Candidates, Verify Research, Validate Sections) so checks-and-balances are legible at a glance. Per-node: cost, latency, model chip, retry count. Click → I/O inspector with **human-readable rendering first** (the JSON behind a toggle). Failure state: failed node in rust, downstream ghosted, error excerpt + "re-run from this node." A thin timeline strip at the bottom shows this run against the last 8 runs' cost/duration (drift in operational metrics).

## Screen 4 — Prompt Lab

V1's prompt CMS, rebuilt around safe iteration.

- **Asset rail (left):** grouped list (Agent prompts / User templates / Section guidance / Shared assets) with status chips: active version, "edited since seed," ⚠ never-seeded (rust — this failure mode already happened), and eval status (green: passed last eval / gray: never evaluated).
- **Editor (center):** monospace editor with variable pills ({VOICE_CONSTRAINTS} etc.) validated live against what the pipeline actually injects — an undeclared variable renders as a rust pill with "code does not supply this" (this failure mode also already happened: declared-but-never-injected). Side-by-side diff vs. any version. Immutable version timeline with one-click rollback (kept from v1).
- **Eval drawer (right):** "Run evals" button auto-selects the scenarios affected by this asset (mapping maintained per asset); results stream into a scoreboard table (gate integrity, hook strength, fact traceability n/5, voice violations, machine-tells, judge recall, est. review minutes) with delta-vs-current-version arrows. **Commit is gated:** improving target metric + no regressions → "Commit new version" enabled; any regression → warning interstitial with the failing dimension quoted.
- **Single-source guardrail:** if an edit introduces text that duplicates ≥1 line of `voice_constraints`, show inline: "Voice law lives in voice_constraints — reference it, don't restate it."

## Screen 5 — Eval Center

The 8 golden scenarios as cards (normal week, dry well, famous-charity bait, ghost charity, radioactive week, repeat pressure, voice gauntlet, hallucination trap) — each with description, what-it-catches, last result, run button. Below: **scoreboard time series** (one row per eval run, columns = dimensions, sparklines per column) — this table is the editorial drift detector. A "shadow run" card runs scenario 1 against the current week's real news and estimates what the paid run would produce. History is append-only.

## Screen 6 — Registry

Featured/candidate/blocklist table (kept), plus per-charity: cause chip, geography chip, signal used, issue link, verification record, and a **corrections log** (append-only; corrections here are re-read by the Researcher on any future mention). A "coverage memory" strip visualizes the last 8 issues' cause/geo/signal chips so repetition is visible at a glance — this is what the Calibrator reads.

---

## Cross-cutting rules

- **Provenance is a component:** one consistent "sourced claim" affordance (hover → URL + date) used in galley, candidate cards, hook cards, and dossier views. Unsourced = visible pale-rust state everywhere. No screen renders a factual claim without one of the two states.
- **Nothing silent:** every dismiss, overrule, and kill requires a one-line reason and is logged where the next agent or human will see it.
- **JSON never default:** every agent artifact has a human-readable rendering; raw JSON behind a toggle.
- **Destructive/irreversible actions** (publish, blocklist, auto-publish toggle) get typed confirmation; everything else is one click + undo.
- **Cost ambient, not alarming:** spend meter in header; per-run cost on nodes; alerts only at the configured threshold.

## Success criteria

1. Issue review ≤ 5 minutes with zero context-switching off the Review Desk.
2. A prompt edit can be evaluated and committed (or confidently rolled back) in ≤ 10 minutes without a paid run.
3. A visitor can tell within 10 seconds whether anything in the system is unverified, drifting, or awaiting a human — from any screen.
