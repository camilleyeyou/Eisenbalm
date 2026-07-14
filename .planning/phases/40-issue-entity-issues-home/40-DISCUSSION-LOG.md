# Phase 40: Issue Entity & Issues Home - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 40-issue-entity-issues-home
**Areas discussed:** Issue entity storage · URL contract + run demotion · Scheduled slot + repetition note · Hold semantics · Header four readouts · Issues home scope · Nav restructuring · Stage-strip derivation · Estimated work remaining

---

## Issue entity storage

| Option | Description | Selected |
|--------|-------------|----------|
| New Convex `issues` table | Durable row: status, hold, schedule, sanityIssueId. Same justification as `sign_offs`/`eval_scores`. | ✓ |
| Derive from runs + Sanity, park hold elsewhere | No new table; hold state in `pipeline_config`/`audit_log`. Breaks "create issue, then run". | |
| Sanity `weeklyIssue` is the issue entity | Drags console-only state through the write boundary. | |

**User's choice:** New Convex `issues` table.

| Option | Description | Selected |
|--------|-------------|----------|
| `issueNumber` (int) — natural key | Already the join key everywhere; human-readable URLs. | ✓ |
| Convex `_id` | Opaque; makes URLs unreadable, issueNumber still needs uniqueness. | |
| Slug | Depends on a charity that doesn't exist at creation time. | |

**User's choice:** `issueNumber`.

| Option | Description | Selected |
|--------|-------------|----------|
| Console creates the issue; run attaches later | Makes "the editor never triggers a pipeline" true. | ✓ |
| Pipeline upserts the issue at run start | Issue could never exist before a run — breaks Phase 41/47. | |
| Both — console creates, pipeline upserts defensively | Two write paths to one status machine. | |

**User's choice:** Console creates; run attaches. *(Note: the orphan-run follow-up below effectively restored the defensive upsert as a guard, without moving the intended entry point.)*

| Option | Description | Selected |
|--------|-------------|----------|
| One-time backfill from `pipelineRuns` | One row per distinct existing issueNumber. | ✓ |
| Lazy — create on first access | "Recently published" can't list untouched issues. | |
| Fresh start — new issues only | Two definitions of "an issue" living side by side. | |

**User's choice:** One-time backfill.

---

## URL contract + run demotion

| Option | Description | Selected |
|--------|-------------|----------|
| Pipeline ensures the row by number | `issues.ensureByNumber` at run start; no trigger path can orphan a run. | ✓ |
| Console is the only way in | A cron couldn't start an issue without creating the row first. | |
| Tolerate orphans; reconcile on read | A stray run could silently resurrect a Held issue. | |

**User's choice:** Pipeline ensures the row by number.
**Notes:** Raised because console-first creation leaves `POST /run/weekly` (empty body), a future cron, or a curl with no issue row to attach to.

| Option | Description | Selected |
|--------|-------------|----------|
| `/issues` → `/issues/[issueNumber]` | Phase 41 hangs stage tabs beneath it; no second migration. | ✓ |
| `/issues/[n]` with stages as query params | Breaks per-stage deep links. | |
| Keep dashboard root; `/issues` is one more screen | Doesn't deliver the ISS-02 inversion. | |

**User's choice:** `/issues` → `/issues/[issueNumber]`.

| Option | Description | Selected |
|--------|-------------|----------|
| Re-key now + 301 old URLs | Thin issue→run param translation around shipped components. | ✓ |
| Nav-only demotion; re-key in Phase 41 | Ships criterion 2 half-true. | |
| Delete the desk routes outright | Loses working capability for a phase. | |

**User's choice:** Re-key now + redirect.

| Option | Description | Selected |
|--------|-------------|----------|
| Both: canonical under the issue, listed in Workbench | Matches the v3 spec, whose Workbench nav *does* list Run Details. | ✓ |
| Only under the issue | Contradicts the spec's own Workbench nav. | |
| Leave runs at `/run-monitor`, just link from the issue | The run never actually becomes a record *inside* an issue. | |

**User's choice:** Both.

---

## Scheduled slot + repetition note

| Option | Description | Selected |
|--------|-------------|----------|
| Derived from coverage memory, deterministically | Reuses Phase 39's cause/geo/signal chips; no LLM, no run needed. | ✓ |
| New standalone Calibrator call | Costs a model call per home load; nondeterministic. | |
| Operator-authored note in config | Makes the human retype a memory the system already has. | |

**User's choice:** Derived from coverage memory.
**Notes:** The note must render *before* any run exists, so it structurally cannot be a Calibrator run-output. Today's Calibrator only rotates `bonusType`.

| Option | Description | Selected |
|--------|-------------|----------|
| A real `issues` row, status=Scheduled | The note, a hold, and "start early" attach to a real entity. | ✓ |
| Computed display only, no row until started | The slot can't be held, annotated, or referenced. | |

**User's choice:** A real Scheduled row.

| Option | Description | Selected |
|--------|-------------|----------|
| No cron — slot informational, start is manual | ISS-03 only requires *seeing* the slot and *being able to* start early. | ✓ |
| Add the weekly cron now | A behavior change smuggled into a routing phase. | |

**User's choice:** No cron. **Deferred** — the missing weekly cron is a known pre-deploy gap needing its own decision.

| Option | Description | Selected |
|--------|-------------|----------|
| Flip to in-progress + trigger the run, land on the issue | Same navigation works once Phase 41 lands. | ✓ |
| Mark started, don't trigger anything | Ships a button whose name promises work it doesn't do. | |

**User's choice:** Flip + trigger + navigate.

---

## Hold semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Derived status; only Held + Published stored | Makes criterion 6 (no stale "ready") structural. | ✓ |
| Stored status column with explicit transitions | Failure mode is exactly the silently-stale "ready" ISS-06 forbids. | |

**User's choice:** Derived.
**Notes:** Surfaced from `DERIVED-STATE-CONTRACT` §3 — `hdrStatus` is already specified as a formula over sign-offs.

| Option | Description | Selected |
|--------|-------------|----------|
| Hold offers to stop the run too (checkbox, default on) | Sets the existing `cancelRequested` flag. | ✓ |
| Hold is editorial status only; run keeps running | Purest per "never blended" — but cost keeps accruing. | |
| Hold always cancels the run | Destructive by default; blends the two state systems. | |

**User's choice:** Hold offers to stop the run.

| Option | Description | Selected |
|--------|-------------|----------|
| Blocks publish; editing stays open | `ready` gains `&& !held`. | ✓ |
| Locks the issue read-only | Makes hold a heavy, rarely-used hammer. | |
| Advisory only | A Held issue would still be publishable. | |

**User's choice:** Blocks publish only.

| Option | Description | Selected |
|--------|-------------|----------|
| Required free text + `audit_log` entry | Matches the spec's "short reason required". | ✓ |
| Preset reasons + optional note | Invents a taxonomy before any real holds exist. | |

**User's choice:** Required free text.

---

## Header four readouts

| Option | Description | Selected |
|--------|-------------|----------|
| Build the real derived projection now; header reads `.length` | One selector, two consumers (Ph40 header, Ph43 screen). | ✓ |
| Count-only shim now; full projection in Phase 43 | Guarantees a header that says 3 next to a list of 2. | |

**User's choice:** Real projection now.

| Option | Description | Selected |
|--------|-------------|----------|
| Inbox becomes the My Tasks readout; dropdown survives until Ph43 | No capability lost, no dead button. | ✓ |
| Keep the inbox, add a separate count readout | Two things answering "does anything need me?" — the blending ISS-05 forbids. | |
| Remove the inbox; count inert until Phase 43 | Removes a working feature for a phase. | |

**User's choice:** Inbox becomes the readout.

| Option | Description | Selected |
|--------|-------------|----------|
| Rename to "Human approval required" now; keep the loud ON warning | The header is being rebuilt anyway. | ✓ |
| Defer to the Phase 50 nomenclature pass | Touches the same header twice. | |

**User's choice:** Rename now.

| Option | Description | Selected |
|--------|-------------|----------|
| Header = MTD vs monthly cap; card = this issue's run cost | Both numbers already exist; no new config key. | ✓ |
| Header = this issue's cost vs a per-issue budget | Hides the monthly spend that is the actual budget. | |

**User's choice:** MTD in header, run cost on the card.

---

## Issues home scope

| Option | Description | Selected |
|--------|-------------|----------|
| One Create path now; Phase 48 adds the second | Honors "no dead button in the primary CTA". | ✓ |
| Ship both; the brief path opens a stub | Exactly the dead CTA the milestone decision rules out. | |
| No Create panel — "Start early" is the only way in | No way to make an off-cadence issue. | |

**User's choice:** One path now.

| Option | Description | Selected |
|--------|-------------|----------|
| Published issues + real claim coverage and sign-offs | Data already exists; an empty slot would read as "unverified". | ✓ |
| Plain list, no verification data | The "blank means verified" inversion the spec bans. | |

**User's choice:** Real verification record.

| Option | Description | Selected |
|--------|-------------|----------|
| `/issues/[n]` — an overview Phase 41 replaces in place | Same URL; nothing to re-route later. | ✓ |
| Deep-link straight into the re-keyed review desk | Stage strip / run history / hold have nowhere to live. | |

**User's choice:** `/issues/[n]` overview page.

---

## Nav restructuring

| Option | Description | Selected |
|--------|-------------|----------|
| Restructure into Editorial / System Workbench / Operations now | Desks leave the nav (now issue sub-routes); names unchanged. | ✓ |
| Minimal — add Issues, demote Run Monitor, leave the rest | ISS-02 stays half-done. | |
| Full v3 nav including the Phase 50 renames | Explicitly Phase 50's scope; ripples into untouched screens. | |

**User's choice:** Restructure into three groups; renames deferred.

---

## Stage-strip derivation

| Option | Description | Selected |
|--------|-------------|----------|
| Artifact-derived — what exists, not what ran | Survives restarted/re-run pipelines; same question Ph41's tabs ask. | ✓ |
| Run-progress-derived — which node completed | A completed run with unchecked claims would show Fact Check as done. | |
| Hybrid — run progress until artifacts exist | A stage's state would have two meanings depending on timing. | |

**User's choice:** Artifact-derived.

| Option | Description | Selected |
|--------|-------------|----------|
| Not generated / In progress / Needs you / Clean · with a count | Maps to the spec's "✓ / count / ⚠" tab marks. | ✓ |
| Reuse the section outline's 5-state legend verbatim | "Changed since review" doesn't mean anything for a whole stage. | |

**User's choice:** Four-state vocabulary with counts.

---

## Estimated work remaining

| Option | Description | Selected |
|--------|-------------|----------|
| Severity-weighted minutes over open tasks | Deterministic, explainable; falls out of the task projection. | ✓ |
| Historical average from past issues | Nothing records review duration today — estimating from an empty table. | |
| Drop it — show the open-task count only | ISS-01 names it explicitly. | |

**User's choice:** Severity-weighted minutes.

| Option | Description | Selected |
|--------|-------------|----------|
| Pure TS selector module in dispatch-control | Matches Ph32 D-13 and Ph37 D-08 precedent; unit-testable. | ✓ |
| A Convex query returning derived issue state | Puts editorial policy in the backend where it's harder to test. | |

**User's choice:** Pure TS selector module.

---

## Claude's Discretion

- Exact `issues` field names/types and index choices; the `ensureByNumber` mutation signature.
- Severity → minute weights (one exported constants object).
- Redirect implementation for the old run-keyed URLs (route-level vs `next.config`).
- Skeleton/loading structure and how the ISS-06 error state is detected — provided the failure mode is a visible "State unknown — refresh".
- Exact copy of the derived repetition note beyond the "avoid X · avoid Y" shape.

## Deferred Ideas

- The weekly cron that auto-starts the scheduled issue — a known pre-deploy gap, needs its own decision.
- "Start from my brief" — Phase 48 (ENT).
- My Tasks as a screen — Phase 43 (TSK).
- Role gating on Create / Reopen — Phase 49 (ROL).
- Nomenclature renames — Phase 50 (WBN).
- Per-issue cost budget in the header — considered, not chosen.
