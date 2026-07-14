# Phase 40: Issue Entity & Issues Home - Research

**Researched:** 2026-07-14
**Domain:** Next.js 15 App Router console routing inversion + new Convex entity, over an existing 27-table Convex schema and 18-node FastAPI/LangGraph pipeline
**Confidence:** HIGH — every claim below is grounded in a direct read of this repository (file:line citations throughout). No external library research was needed; this phase is internal-architecture archaeology, not new-technology adoption.

## Summary

Phase 40 is a routing inversion plus one new Convex table, executed over a codebase that already has every substrate it needs. The five Phase 34/35/38/39 tables this phase must derive from (`sign_offs`, `claim_checks`, `runs`, `pipelineRuns`, `audit_log`) all exist today with the exact shapes CONTEXT.md's decisions assume — confirmed by direct reads of `convex/schema.ts:1-483` and their corresponding function files. `issueNumber` is already the de-facto join key everywhere (`pipelineRuns.issueNumber` at `convex/schema.ts:8`, Sanity's `issue-${doc.issueNumber}` slug at `apps/studio/schemas/weeklyIssue.ts:44`), so D-02's "issueNumber is the natural key" is not a new decision so much as a ratification of existing practice. The one genuinely new piece of backend work is the `issues` Convex table itself (D-01) plus its two mutations (`ensureByNumber`, hold/reopen) — everything else (derived status, stage strip, header readouts) is a pure client-side selector over data that already streams into the dashboard.

The highest-risk part of the phase is exactly what CONTEXT.md calls it: the routing inversion. `apps/dispatch-control/app/(dashboard)/` currently has run-keyed leaf routes (`review-desk/[runId]`, `voice-pass/[runId]`, `run-monitor/runs/[runId]`) that must gain issue-keyed siblings under `/issues/[issueNumber]/...` while the old URLs 301 forward. Because resolving `issueNumber → runId` (or vice versa) requires a live Convex read, this redirect **cannot** be done as a static `next.config.js` rewrite — it must be a Server Component (or Route Handler) that awaits the Convex query before calling `redirect()`. A second, subtler risk: the FastAPI pipeline already has 18 REST endpoints shaped `/issues/{run_id}/...` (`content.py`, `review.py`, `findings.py`, `signoffs.py`, `voice_pass.py`, `control.py`) where `{run_id}` is unambiguously a **runId**, not an issueNumber. These live in a different service (Railway pipeline vs. Vercel dashboard) so there is no literal URL collision, but the naming coincidence with the new console route `/issues/[issueNumber]` is a standing confusion trap for every future contributor and must be called out explicitly in the plan, not silently worked around.

**Primary recommendation:** Build the `issues` table and its two mutations first (contract-first, per the established Ph35/38/39 pattern — amend `docs/API_CONTRACTS.md` §40 before writing `convex/issues.ts`), then build the pure-TS derived-state selector module as a standalone unit-tested library, then wire the Issues home and header to it, and do the route re-keying as thin Server Component wrappers around the *already-shipped* Client Components (`ReviewDeskRunPageProps`, `VoicePassPage` internals) — do not touch their internals, per D-07.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Issue entity & storage**
- **D-01: New Convex `issues` table.** One row per issue. Approximate shape: `{workspace_id, issueNumber, scheduledFor, held (bool), heldReason, heldBy, heldAt, statusBeforeHold?, published (bool)/publishedAt, sanityIssueId, lastVisitedStage, createdAt}`. Hold + schedule + slot reservation are durable operator state with nowhere to live today — the same justification that earned `sign_offs` (Ph34) and `eval_scores` (Ph38) their tables. Sanity stays content-of-record; Convex owns operational state. **Contract-first:** amend `docs/API_CONTRACTS.md` before writing the table (established Ph35/38/39 pattern).
- **D-02: `issueNumber` (int) is the natural key** — in code, in queries, and in URLs. It is already the de-facto join key everywhere (`pipelineRuns.issueNumber`, Sanity `issue-{n}`, the masthead chip, the Calibrator tie-break) and it is how the design speaks ("Issue 07", "start #08 early"). Enforce uniqueness with an index. No opaque id, no slug (the slug depends on a charity that does not exist at creation time).
- **D-03: The console creates the issue; the run attaches to it.** Create issue → row exists with a reserved `issueNumber` → the run is triggered *against that number*. This is what makes "the editor never triggers a pipeline" true, and it is what gives Phase 41's "Create → land in Story & Brief" something to mount on. `_resolve_issue_number` in `packages/pipeline/.../api/runs.py` already honors an explicit `issueNumber` verbatim, so the pipeline change is small.
- **D-04: The pipeline defensively ensures the row.** At run start the pipeline calls a Convex `issues.ensureByNumber`-style mutation: no-op if the console already created the row, create it if not. The console remains the *intended* entry point, but no trigger path (existing `POST /run/weekly` with an empty body, a future cron, a curl) can orphan a run. Guard the status machine so a stray run can never silently resurrect a **Held** issue.
- **D-05: One-time backfill from `pipelineRuns`.** A seed/migration creates one `issues` row per distinct existing `issueNumber`, deriving published state from Sanity. "Recently published" then renders real history, and there is exactly one code path for "what is an issue."

**Routing & run demotion**
- **D-06: URL shape is `/issues` → `/issues/[issueNumber]`.** Phase 41 hangs stage tabs beneath it (`/issues/7/draft`, `/issues/7/fact-check`, …) with no second URL migration. Stages are path segments, not query params, so per-stage deep links (from My Tasks, from a claim) stay linkable.
- **D-07: Re-key the desks now; 301 the old run-keyed URLs.** `/review-desk/[runId]` → `/issues/[n]/review`, `/voice-pass/[runId]` → `/issues/[n]/voice`. These are **thin issue→run param translations around the already-shipped components** — do NOT rewrite their internals; Phase 41 recomposes them into stage tabs. Old URLs redirect (resolve `issueNumber` from `runId` via `pipelineRuns`). This makes success criterion 2 literally true at the end of Phase 40 and spares Phase 41 a second URL migration.
- **D-08: A run is canonically reachable under its issue** at `/issues/[n]/runs/[runId]`, linked from the issue overview. **Run Monitor survives as a nav item** but moves into the System Workbench group — the v3 spec's own Workbench nav lists "Run Details", so ISS-02's "never a top-level nav destination" means a run stops being the *editorial* object, not that it becomes unreachable. Phase 50 renames it.
- **D-09: Clicking the in-progress card lands on `/issues/[n]`** — a real overview page (5-stage strip, status, open tasks, hold control, links into `/issues/[n]/review` + `/issues/[n]/voice` + run history). Phase 41 replaces its **contents** with the Workspace frame at the **same URL**.

**Scheduled slot & repetition note**
- **D-10: The repetition note is derived deterministically from coverage memory.** A pipeline read endpoint (same shape and auth as Phase 39's `GET /registry/coverage-strip`) counts the last-8 cause/geo/signal chips and emits "avoid US-SE · avoid weather" for whatever is over-represented. **No LLM call, no run required** — which is mandatory, because the note must render *before* a run exists. It is the Calibrator's *rule* applied outside a run; today's Calibrator only rotates `bonusType` and emits no such note.
- **D-11: The next slot is a real `issues` row with status Scheduled** — lazily ensured when the home loads, with its `issueNumber` reserved and `scheduledFor` computed from a cadence config row. Because it is a real entity, the repetition note, a hold, and "start early" all attach to something that exists.
- **D-12: No cron in this phase.** The slot is informational; nothing fires on its own. ISS-03 only requires that the operator *see* the slot and *can* start it early, and "Human approval required" stays honest. (The missing weekly cron is a known pre-deploy gap — it remains its own decision, not a side effect of a UI phase.)
- **D-13: "Start it early"** flips the issue to in-progress, calls the existing run trigger with that `issueNumber`, and navigates to `/issues/[n]`. Once Phase 41 lands, the same navigation drops the operator into the Workspace — no rework.

**Hold**
- **D-14: Hold offers to stop the run in progress.** The hold dialog carries an "also stop the run in progress" checkbox, **default on**, which sets the existing `runs.cancelRequested` cooperative-cancel flag (Phase 25). The two state systems stay distinct in the model, but the operator is never left holding an issue while the machine quietly keeps spending on it.
- **D-15: Held blocks publish; editing stays open.** `ready` gains a `&& !held` term — one line in the formula Phase 41's publish gate consumes. You usually hold an issue *because* it needs more work, so locking the editor would be self-defeating.
- **D-16: The hold reason is required free text**, written to the existing `audit_log` with actor + timestamp (the record Phase 43's Decision log reads back). No preset taxonomy — it would be invented before a single real hold exists.
- **D-17: Reopen clears the hold**, and status re-derives on its own (see D-18). No separate "restore previous status" bookkeeping.

**Derived state (the load-bearing decision)**
- **D-18: Issue status is DERIVED; only `held` and `published` are stored.** `published → Published`; `held → Held`; `factDone && voiceDone → Ready to publish`; else `Draft / Needs review`. This is exactly the `DERIVED-STATE-CONTRACT` §3 formula, and it makes **success criterion 6 structural** — a silently stale "ready" is *impossible* when "ready" is recomputed from `sign_offs` on every read. Same discipline that makes My Tasks a projection.
- **D-19: Stage states are artifact-derived — what exists, not what ran.** Stage 1 = charity chosen (pitchLog / gate-1 resolution) · Stage 2 = sections drafted in Sanity + open QA findings · Stage 3 = `claim_checks` coverage · Stage 4 = voice findings + `sounds-human` sign-off · Stage 5 = `facts-cleared` + published. It answers "is the work done?", survives a restarted or re-run pipeline, and is the same question Phase 41's tabs ask. **Do not derive from pipeline node progress** — a completed run with zero checked claims must not show Fact Check as done.
- **D-20: Stage-state vocabulary: `Not generated / In progress / Needs you / Clean`, each with an open-item count.** Maps to the spec's "✓ / count / ⚠" tab marks. "Not generated" is a first-class visible state, never a blank. Every state renders **label + icon**, never color alone.
- **D-21: Build the REAL derived task projection now** — open must-fix claims + open QA findings + missing sign-offs → task objects carrying the `DERIVED-STATE-CONTRACT` §2 shape (`sev`, `title`, `where`, `why`, `rec`, `primary`, `insp`). Phase 40 renders `.length` in the header; **Phase 43 renders the same array as a screen.** A count-only shim would guarantee a header that says 3 next to a list of 2. **No tasks table** (contract §2).
- **D-22: Estimated work remaining = severity-weighted minutes over open tasks**, summed and rendered "~12 min". Weights live in one constants module so they can be tuned. Deterministic and explainable; falls straight out of D-21.
- **D-23: All derivation lives in a pure TS selector module** in `apps/dispatch-control/lib/` — pure functions over the results of existing Convex queries, unit-testable in isolation, consumed by the header, the issue card, Phase 41's tabs, and Phase 43's My Tasks. Follows the Phase 32 client-side span resolver (D-13) and Phase 37 client-side run aggregation (D-08) precedent. Editorial policy (severity weights, stage rules) stays out of the backend.

**Global header (rebuild of `Masthead.tsx`)**
- **D-24: Four readouts, never blended** — Issue status (D-18) · System activity (Idle / Running / Paused for you / Failed / Complete, from `runs.status`) · My Tasks count (D-21) · Cost vs budget. Today's masthead blends these: its single "status" chip is actually *system activity*, and there is no issue status at all. Each readout carries **label + icon**, never color alone.
- **D-25: The "Awaiting you" inbox becomes the My Tasks readout.** The button becomes the labeled `My Tasks · N` readout; clicking it still opens the existing `AwaitingYouInbox` dropdown (already a derived list of what needs you). Phase 43 swaps the dropdown's target for the real screen. No capability lost, no dead button.
- **D-26: "Auto-publish OFF" → "Human approval required"** — quiet reassurance in the normal state. When auto-publish is **ON**, the existing vermilion warning + `AutoPublishBanner` stay exactly as loud as they are today. Done now because this header is being rebuilt anyway; the rest of the nomenclature pass stays in Phase 50.
- **D-27: Cost vs budget = month-to-date vs monthly cap** (existing `runs.monthToDateCost` + the `monthly_cap_usd` config key). The **issue card** carries *this issue's run cost* (ISS-01). Both numbers already exist; no new config key.

**Issues home**
- **D-28: One Create path ships.** "Find a story with agents" — creates the issue row and triggers the run. Phase 48 adds "Start from my brief" beside it as an equal sibling. Build the layout to hold two cards so Phase 48 is an addition, not a redesign. **No dead button in the primary CTA** (locked milestone decision).
- **D-29: "Recently published" renders the real verification record** — claim coverage from `claim_checks` (checked X of Y) and sign-offs from `sign_offs` (who cleared facts, who approved voice, when). Both already exist. An empty verification slot would read as "unverified" — the exact "blank means verified" inversion the spec bans.
- **D-30: Empty state** (no issue in progress): the Create panel is open by default and the current-issue card is replaced by "No issue in progress — discovery scheduled {slot}". **Loading:** card skeletons that preserve the stage-strip geometry. **Error (ISS-06):** "State unknown — refresh", never a silently stale "ready".

**Navigation (`lib/nav.ts`)**
- **D-31: Restructure into three groups now; renames deferred to Phase 50.**
  - **Editorial** — Issues. (My Tasks joins in Phase 43; Issue Workspace in Phase 41.)
  - **System Workbench** — Run Monitor, Prompt Lab, Eval Center, Registry. The machine, visited when something broke or an agent needs improving.
  - **Operations** — Config, Finance, Settings. Real screens the v3 spec never mentions; they stay.
  - **Review Desk / Signal Desk / Voice Pass leave the nav** — they are now issue sub-routes, reachable from `/issues/[n]` (D-07, D-09). Labels stay as-is; Phase 50 renames.

### Claude's Discretion
- Exact field names/types on the `issues` table (within D-01's shape), index choices, and the `ensureByNumber` mutation signature.
- Severity → minute weights in D-22 (make them one exported constant object).
- How the redirect in D-07 is implemented (route-level vs `next.config` rewrites).
- Skeleton/loading component structure, and how the ISS-06 error state is detected (error boundary vs explicit query-failure handling) — provided the failure mode is a visible "State unknown — refresh" and never a stale value.
- Precise copy for the derived repetition note beyond the "avoid X · avoid Y" shape.

### Deferred Ideas (OUT OF SCOPE)
- **The weekly cron** that auto-starts the scheduled issue (D-12). A known pre-deploy gap; it needs its own thinking about failure, notification, and budget. Not a side effect of a UI phase.
- **"Start from my brief"** as a second Create path — Phase 48 (ENT).
- **My Tasks as a screen** — Phase 43 (TSK). Phase 40 builds the projection it will render.
- **Role gating on Hold / Create / Reopen** — Phase 49 (ROL) gates exactly six actions; Hold is not one of them, but Collaborator visibility rules for Create/Reopen land there.
- **Nomenclature renames** (Run Monitor → Run Details, Registry → Editorial Memory, etc.) — Phase 50 (WBN).
- **Per-issue cost budget** as a header readout — considered, not chosen (D-27 keeps month-to-date vs monthly cap).

The UI-SPEC (`.planning/phases/40-issue-entity-issues-home/40-UI-SPEC.md`) is already checker-approved (6/6 dimensions PASS) and is binding for all visual/copy decisions — this research does not re-derive layout, color, typography, or copy; it grounds the *data and routing* decisions the UI-SPEC assumes.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ISS-01 | Issues home shows in-progress issue card: 5-stage strip, status, open-task count, claim coverage, voice state, est. work remaining, run cost | §"Derived state data sources" below maps each readout to its exact existing Convex source (`sign_offs`, `claim_checks`, `pitchLog`, `qaCorrections`, `runs.cost`). All sources confirmed to exist; zero new persisted fields required for the readouts themselves. |
| ISS-02 | Console routes are issue-keyed; a run is reachable only as a historical record under an issue | §"Routing inversion" enumerates every existing run-keyed route/nav entry (7 routes, 4 nav items) that must be re-parented, plus the 18 pipeline `/issues/{run_id}/...` endpoints that share the `/issues/` prefix by coincidence, not design — flagged as a naming trap, not a collision. |
| ISS-03 | Operator sees next scheduled slot with Calibrator repetition note; can start early | §"Scheduling substrate" confirms `pipeline_config.schedule_next_run_at` / `schedule_cadence` already exist (`packages/pipeline/.../lib/scheduler.py`), the Calibrator today only rotates `bonusType` (confirmed no repetition note exists — `agents/calibrator.py`), and `POST /pipeline/run` is the existing trigger endpoint "start early" must call (`apps/dispatch-control/lib/pipelineControlClient.ts:63-84`). |
| ISS-04 | Hold with required reason; held issues show reason/who/when; can be reopened | §"Write boundary & audit" confirms `audit_log` shape (`convex/auditLog.ts`) and the existing `runs.cancelRequested` flag (`convex/runs.ts:195-215`) D-14's stop-checkbox sets. |
| ISS-05 | Global header: 4 separate never-blended readouts, label+icon | §"Masthead.tsx today" documents the exact chips/queries to replace (`apps/dispatch-control/components/Masthead.tsx`) — confirms today's single "pipeline-state chip" conflates issue status and system activity, exactly as CONTEXT.md's D-24 claims. |
| ISS-06 | Status load failure reads "State unknown — refresh", never a stale "ready" | §"Derived state data sources" — because D-18 makes status a pure function of live query results, a query in `undefined`/error state has no cached "ready" value to fall back to; this is a UI-state-machine question (Claude's Discretion per CONTEXT.md), not a data-availability question. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **GSD workflow enforcement**: file-changing tool use must go through a GSD command (`/gsd:execute-phase` etc.) — not directly relevant to research, but the planner should structure Wave/Plan boundaries accordingly.
- **Schema stability**: "Schema files are in schemas/ and convex/schema.ts — do not modify field names without checking API_CONTRACTS.md first." **Correction for this phase:** the actual current path is `apps/studio/schemas/weeklyIssue.ts` (verified — `schemas/` at repo root does not exist; CLAUDE.md is stale on this specific path, the monorepo moved Sanity schemas under `apps/studio/` at some earlier phase). The rule's *intent* — do not add/rename fields without an API_CONTRACTS.md amendment first — is fully in force and is exactly what CONTEXT.md's "Contract-first" note (D-01) already requires.
- Read `docs/CLAUDE_CODE_BRIEF.md` and `docs/API_CONTRACTS.md` before doing anything else (per CLAUDE.md's top-level instruction) — `docs/API_CONTRACTS.md` is 3956 lines, currently ending at `§39 — Registry Coverage-Memory Strip (Phase 39)` (`docs/API_CONTRACTS.md:3816-3943`). Phase 40's contract amendment is `§40`, following the exact heading/subsection convention of §35-§39 (`## §40 — ...` then `### §40.1 — ...` etc.).

## Standard Stack

Not applicable in the conventional sense — this phase adds zero new npm/pip packages. Confirmed via `apps/dispatch-control/package.json`: Next.js `^15.3.9`, React `^19.2.6`, Convex `^1.38.0`, `lucide-react` `^1.14.0`, `@clerk/nextjs` `^7.5.7` — all already installed and sufficient for every component the UI-SPEC calls for (shadcn `Dialog` is explicitly NOT used per the UI-SPEC's Registry Safety table). No `npm install` step belongs in this phase's plan.

**Version verification:** package versions above read directly from `apps/dispatch-control/package.json` (committed, current tree) — not verified against the npm registry since no new/upgraded package is introduced.

## Architecture Patterns

### Convex table + mutation pattern to follow (D-01, D-04)

The `sign_offs` table (`convex/schema.ts:466-482`, functions in `convex/signOffs.ts`) is the closest analog to `issues`: workspace-scoped, one row per logical entity, with an idempotent upsert mutation. Follow its exact shape:

```typescript
// convex/schema.ts — pattern from sign_offs (convex/schema.ts:471-482)
issues: defineTable({
  workspace_id: v.string(),
  issueNumber: v.number(),
  held: v.boolean(),
  heldReason: v.optional(v.string()),
  heldBy: v.optional(v.string()),
  heldAt: v.optional(v.number()),
  published: v.boolean(),
  publishedAt: v.optional(v.number()),
  scheduledFor: v.optional(v.number()),
  sanityIssueId: v.optional(v.string()),
  lastVisitedStage: v.optional(v.string()),
  createdAt: v.number(),
})
  .index('by_workspace', ['workspace_id'])
  .index('by_workspace_issueNumber', ['workspace_id', 'issueNumber'])
```

**Convex has no native unique-constraint enforcement.** Uniqueness on `issueNumber` (D-02) must be enforced the same way `pipelineRuns:create`'s idempotent-insert guard already does it (`convex/pipelineRuns.ts:16-32` has no such guard — but `convex/runs.ts:22-52`'s `create` mutation does, at lines 37-41): query the index for an existing row *inside the mutation* before inserting, and no-op (or throw, per D-04's semantics) on a hit. This is the mechanism `ensureByNumber` (D-04) is: an idempotent "insert-if-absent" mutation, structurally identical to `runs:create`'s existing-row check.

**Two mutation lanes are needed, mirroring the established `requireOperator` / `requirePipelineSecret` split (`convex/lib/auth.ts`):**
- Console-originated writes (Create issue, Hold, Reopen) → `requireOperator(ctx)` (Clerk identity required, throws `'Unauthorized'` otherwise — `convex/lib/auth.ts:52-56`).
- Pipeline-originated writes (`ensureByNumber` called from `_start_run`) → `requirePipelineSecret(pipelineSecret)` (`convex/lib/auth.ts:68-73`), following the exact pattern every other pipeline-lane mutation uses (e.g. `convex/pipelineRuns.ts:25-26`, `convex/signOffs.ts:48-49`).

`convex/CLAUDE.md` mandates reading `convex/_generated/ai/guidelines.md` before Convex work — **this file does not currently exist in the repo** (confirmed: `convex/_generated/` contains only `api.d.ts`, `api.js`, `dataModel.d.ts`, `server.d.ts`, `server.js` — no `ai/` subdirectory). The planner should either run `npx convex ai-files install` first or proceed on the strength of this repo's own established Convex conventions (which are extensive and consistent — every pattern above is drawn directly from shipped code, not the missing guidelines file).

### Routing inversion (D-06, D-07, D-08, D-09) — highest-risk area

**Current run-keyed routes that must gain issue-keyed counterparts** (enumerated from `find apps/dispatch-control/app -type d`):

| Existing route | New issue-keyed route (D-06/D-07) | Notes |
|---|---|---|
| `(dashboard)/review-desk/page.tsx` (auto-focus shell, `apps/dispatch-control/app/(dashboard)/review-desk/page.tsx:1-98`) | folds into `/issues/[n]` overview (D-09) | today resolves the sole `awaiting-review` run and redirects — same Convex query (`api.runs.listForWorkspace`) can resolve `issueNumber` instead |
| `(dashboard)/review-desk/[runId]/page.tsx` (490 lines, full galley editor, `apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx:1-59` shown) | `/issues/[n]/review` (D-07) | **do not touch internals** — wrap with a thin Server Component that resolves `issueNumber → runId` via `pipelineRuns:byRunId`-equivalent lookup, then renders the existing Client Component with `runId` prop |
| `(dashboard)/voice-pass/page.tsx` (auto-focus shell, byte-identical pattern to review-desk, `apps/dispatch-control/app/(dashboard)/voice-pass/page.tsx:1-100`) | folds into `/issues/[n]` overview | same resolution pattern |
| `(dashboard)/voice-pass/[runId]/page.tsx` (243 lines) | `/issues/[n]/voice` (D-07) | same thin-wrapper approach |
| `(dashboard)/signal-desk/page.tsx` (27 lines, Server Component, `apps/dispatch-control/app/(dashboard)/signal-desk/page.tsx:1-27`) | Stage 1 provisional mount is Phase 41 scope (WSP), not Phase 40 — Phase 40 only needs Signal Desk reachable from `/issues/[n]` per D-09's "links into" list | leave the standalone `/signal-desk` route in place this phase (nav entry removed per D-31, but the page itself stays functional as a fallback until Phase 41 replaces it) |
| `(dashboard)/run-monitor/runs/[runId]/page.tsx` (32 lines) | `/issues/[n]/runs/[runId]` (D-08) | this one is a genuine *move*, not just an alias — "a run is reachable only as a historical record under an issue" |
| `(dashboard)/run-monitor/page.tsx`, `run-monitor/graph/`, `run-monitor/runs/_components/` | stays as-is, nav-relocated into System Workbench (D-08, D-31) | Run Monitor survives as a nav item, just moved |

**Nav items removed from `lib/nav.ts`'s `NAV_GROUPS` (currently `apps/dispatch-control/lib/nav.ts:21-47`):** `Review Desk`, `Signal Desk`, `Voice Pass` (3 of the current 4 "Workflow" group items) leave the nav per D-31; `Run Monitor` moves to "System Workbench". A new `Issues` item is added to a new "Editorial" group.

**The redirect mechanism (D-07's "Claude's Discretion" item) must be a dynamic lookup, not a static rewrite.** Confirmed via official Next.js docs research: `next.config.js` rewrites/redirects run before route matching and cannot perform a live data lookup; `redirect()` from `next/navigation` runs during Server Component rendering and *can* `await` a data fetch first. Because resolving `runId → issueNumber` (for the old-URL redirect) or `issueNumber → runId` (for the new URL to reach the existing Client Component) both require a live Convex read (`pipelineRuns:byRunId` keyed on `runId`, or a reverse lookup keyed on `issueNumber` — `convex/pipelineRuns.ts:6-14` only indexes `by_runId`, so a **new** `by_issueNumber`-indexed query is needed, and `convex/schema.ts:25` shows `pipelineRuns` already has a `by_issueNumber` index defined, just no query function exposing it yet), the correct implementation shape is:

```typescript
// apps/dispatch-control/app/(dashboard)/review-desk/[runId]/page.tsx becomes
// a redirect-only Server Component; the real content moves to
// app/(dashboard)/issues/[issueNumber]/review/page.tsx
import { redirect } from 'next/navigation'
// ... resolve issueNumber from runId via a Convex query, then:
redirect(`/issues/${issueNumber}/review`)
```
[Next.js `redirect()` docs](https://nextjs.org/docs/app/api-reference/functions/redirect) confirm this is the documented pattern for a data-dependent redirect in the App Router.

### Naming trap: pipeline `/issues/{run_id}/...` vs. console `/issues/[issueNumber]` (flagged explicitly per CONTEXT.md's code_context note)

The FastAPI pipeline already exposes **18 endpoints** under an `/issues/{run_id}/...` prefix, where `{run_id}` is unambiguously a runId (confirmed by grep across `content.py`, `review.py`, `findings.py`, `signoffs.py`, `voice_pass.py`, `control.py` — e.g. `GET /issues/{run_id}/draft` at `packages/pipeline/src/eisenbalm_pipeline/api/content.py:799`, `POST /issues/{run_id}/publish` at `review.py:66`, `POST /issues/{run_id}/adjudicate` at `control.py:604`). These live on the Railway pipeline service, not the Vercel dashboard, so there is **no literal URL collision** with the new `apps/dispatch-control` route `/issues/[issueNumber]` — different hosts, different frameworks. But the shared `/issues/` string with an opposite-meaning path param (`run_id` vs. `issueNumber`) is exactly the kind of thing that causes a future contributor (or an LLM agent) to wire a client call to the wrong base URL or misread which identifier a given `/issues/...` reference means. **Recommendation: do not rename the 18 pipeline endpoints this phase** (out of scope, high blast radius, zero UX benefit) — instead, the plan should include one comment/doc note at the top of `apps/dispatch-control/lib/nav.ts` or the new `issues` route group explaining the distinction, and RESEARCH flags this so the planner does not accidentally conflate the two when writing task descriptions.

### Derived state data sources (D-18 through D-23) — confirms "derive, don't store"

| Readout (ISS-01, UI-SPEC State & Icon Contract) | Existing source | Confirmed at |
|---|---|---|
| Issue status (Draft/Needs review/Ready/Published/Held) | `held`+`published` (new `issues` fields) `&&` `sign_offs` active rows for `facts-cleared`/`sounds-human` | `convex/signOffs.ts:115-131` (`activeByRunId` returns `{ 'facts-cleared': {...}, 'sounds-human': {...} }`) |
| Stage 3 (Fact Check) coverage | `claim_checks` rows, `status` field | `convex/claimChecks.ts:159-177` (`allSignedOff` returns `{total, signedOff, allSignedOff}`) |
| Stage 4 (Voice) state | `sign_offs` kind=`sounds-human` + open voice-axis `qaCorrections` | `convex/schema.ts:92` (`axis` union includes `'machine-tell'`, Phase 36's voice axis) |
| Stage 2 (Draft) state | Sanity section content + open non-voice `qaCorrections` | `convex/qaCorrections.ts` (not fully read this pass, but table shape at `convex/schema.ts:70-106` confirmed) |
| Stage 1 (charity chosen) | `pitchLog.selected` / Gate-1 resolution | `convex/schema.ts:110-123` |
| Open-task count | Projection over the four sources above — **no new table** (D-21, `DERIVED-STATE-CONTRACT.md:26-37`) | n/a — pure selector |
| Run cost (this issue) | `runs.cost` (JSON string, `.total` field) | `convex/schema.ts:257`, parsed exactly as `convex/runs.ts:144-158` already does for `monthToDateCost` |
| Cost vs budget (header) | `runs:monthToDateCost` query + `pipeline_config` key `monthly_cap_usd` | `convex/runs.ts:131-186`; read pattern already live in `Masthead.tsx:65-73` |
| System activity (header) | `runs.status` (`'running'|'awaiting-review'|'complete'|'failed'|'cancelled'`) of `runs:latest` | `convex/runs.ts:109-118`; `Masthead.tsx:65,77` already reads this exact query |

**Zero new persisted fields are required for any of the six ISS-01 readouts** — the only new persisted state in the whole phase is the `issues` table's own operational fields (`held`, `published`, `scheduledFor`, hold metadata). This directly confirms ROADMAP.md's "reuse discipline" note (`.planning/ROADMAP.md:861`).

### Masthead.tsx today — the four-readout rebuild's starting point (D-24)

Current implementation (`apps/dispatch-control/components/Masthead.tsx:63-151`) renders exactly what CONTEXT.md's D-24 says it renders: one "pipeline-state chip" (line 92-96, sourced from `runs.latest.status` — i.e., **system activity**, mislabeled as generic "status") with zero separate issue-status readout, plus an issue-number chip (line 86-89, sourced from `pipelineRuns.byRunId` cross-referenced off `runs.latest` — confirming the file's own comment at line 8-9 that `issueNumber` "lives on the older `pipelineRuns` table, not `runs`"), plus cost-vs-cap (line 98-110) and auto-publish (line 112-123). The rebuild:
1. Keeps the cost-vs-cap query wiring (`runs.monthToDateCost` + `pipelineConfig.getAll` keyed `monthly_cap_usd`) unchanged — D-27.
2. Splits the single status chip into two: Issue status (new, derived per D-18) and System activity (existing `runs.latest.status`, relabeled per the UI-SPEC's icon/label table).
3. Adds the My Tasks readout, replacing `AwaitingYouTrigger` (lines 51-61) with a labeled `My Tasks · N` button that still opens the same `<AwaitingYouInbox>` (D-25) — the dropdown component itself (`apps/dispatch-control/components/AwaitingYouInbox.tsx`) needs no changes.
4. Renames the `Auto-publish {ON|OFF}` label (lines 112-123) to "Human approval required" in the OFF case per D-26, leaving the ON-case vermilion warning untouched.

### Scheduling substrate (D-10, D-11, D-12) — confirms no cron exists, confirms the cadence config already does

`packages/pipeline/src/eisenbalm_pipeline/lib/scheduler.py:7-68` confirms a `_is_due`/`compute_next_run_at` mechanism already reads `pc["schedule_next_run_at"]` (a `pipeline_config` row, JSON-encoded Unix ms) and a `schedule_cadence` dict (`{dayOfWeek, hourUtc, minuteUtc}`, default seen at `packages/pipeline/src/eisenbalm_pipeline/api/control.py:386`). This is invoked from `POST /pipeline/tick` (`control.py:270-417`), which is itself only fired by an external cron caller — **confirming memory's claim that no cron exists today** (nothing in this repo calls `/pipeline/tick` on a schedule; it is a dormant endpoint waiting for a Railway cron job that does not exist, consistent with `.planning/PROJECT.md`'s "no Signal Editor and no verify-candidates gate" era note and the memory file `pre-deploy-audit-260703.md`'s "pipeline: no cron" finding). D-11's `scheduledFor` computation should read the SAME `schedule_next_run_at`/`schedule_cadence` config keys `compute_next_run_at` already reads — no new config key needed, matching D-27's zero-new-config-key precedent for cost.

The Calibrator (`packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py:58-93`) confirmed to **only** rotate `bonusType` via `_fetch_previous_bonus_types()` (queries Sanity for the last 3 published issues' `bonusType`) and `_pick_bonus_type()` (deterministic tie-break) — there is no cause/geo/signal repetition note emitted anywhere in this file. D-10's repetition-note endpoint is therefore new pipeline code, but it should mirror `GET /registry/coverage-strip` (`packages/pipeline/src/eisenbalm_pipeline/api/registry.py:38-89`) almost exactly: same Convex query (`charities:listRecentFeatured`, `convex/charities.ts:274-290`), same Sanity join pattern (GROQ over `sanityCharityId`s for `focusArea`/`location`/`scoutNotes`), same auth guard (`_require_clerk_jwt_control`), same "no audit row, read-only" shape — but a NEW endpoint computing over-representation and formatting "avoid X · avoid Y" text, not returning raw chip data. **This is new code, not reused code** — flag clearly for the planner: D-10 requires one new pipeline endpoint (small, ~50-90 lines by the `registry.py` precedent) plus its dashboard-side client module (mirroring `coverageStripClient.ts:1-92` almost line-for-line).

"Start it early" (D-13) is confirmed to map directly onto the existing `triggerRun()` client function (`apps/dispatch-control/lib/pipelineControlClient.ts:63-84`), which already POSTs `{issueNumber, narratorSlug}` to `POST /pipeline/run` (`packages/pipeline/src/eisenbalm_pipeline/api/control.py:193-265`) — that endpoint already accepts an explicit `issueNumber` and passes it verbatim into `_start_run` (`api/runs.py:237-273`, step 1 honors an explicit `issue_number` with zero Sanity read). **No pipeline change is needed for D-13 itself** — only the dashboard-side call site (pass the reserved `issueNumber` from the `issues` row) and the one-at-a-time gate already enforced server-side (`control.py:214-220`, 409 if a run is already in progress) which the UI should surface, not duplicate.

### Write boundary & audit (D-14, D-16) — EDT-05 confirmed intact

`apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts:1-80+` is a live, passing source-scan tripwire that will fail the build if `issues`-table Convex writes ever route through a direct Sanity client call from the dashboard. Since `issues` is pure Convex operational state (per CONTEXT.md's own "this phase does not touch that boundary" note), Hold/Reopen/Create-issue mutations should be **plain Convex mutations called directly from the dashboard with `requireOperator(ctx)`** — they do NOT need to go through the pipeline API's `dashboard → pipeline API → Sanity` chain, because they never touch Sanity. Only "Start it early" (which triggers a real pipeline run) goes through the pipeline API (`POST /pipeline/run`), consistent with every other pipeline-trigger action in the app.

`audit_log` (`convex/schema.ts:266-277`, functions in `convex/auditLog.ts:1-99`) already has exactly the shape D-16 needs: `{workspace_id, actorId, action, resourceType, resourceId, before, after, timestamp}`. The public `record` mutation (`auditLog.ts:64-79`, pipeline-secret-guarded) and the `write` internal mutation (`auditLog.ts:37-50`, callable from other Convex mutations) are both usable — since Hold/Reopen originate from the dashboard with a live Clerk identity, the **internal `write` mutation called from inside `issues.ts`'s hold mutation** (using `requireOperator(ctx)`'s returned `identity.subject` as `actorId`, not a client-supplied value — per `convex/lib/auth.ts:18-20`'s explicit warning "never trust an incoming actorId") is the correct pattern, mirroring how e.g. `pipelineConfig.ts`'s auto-publish toggle already calls `auditLog:write` internally (`convex/pipelineConfig.ts:202-205`).

`runs.cancelRequested` (D-14's "also stop the run" checkbox) is a pre-existing, already-wired boolean flag (`convex/schema.ts:259`, mutations at `convex/runs.ts:195-232`) — polled cooperatively by `wrap_agent_node` before each pipeline node executes. The Hold dialog's checkbox should call the existing `runs:requestCancel` mutation directly; no new cancel mechanism is needed.

### Recommended file layout (new files this phase)

```
apps/dispatch-control/
├── app/(dashboard)/issues/
│   ├── page.tsx                          # Issues home (D-06)
│   ├── [issueNumber]/
│   │   ├── page.tsx                      # Issue overview (D-09) — Phase 41 replaces contents in place
│   │   ├── review/page.tsx               # D-07 thin wrapper around existing review-desk galley
│   │   ├── voice/page.tsx                # D-07 thin wrapper around existing voice-pass screen
│   │   └── runs/[runId]/page.tsx         # D-08 — historical run record
│   └── _components/
│       ├── IssueCard.tsx
│       ├── StageStrip.tsx
│       ├── ScheduledSlotCard.tsx
│       ├── HeldIssueRow.tsx / RecentlyPublishedRow.tsx
│       ├── CreatePanel.tsx
│       └── HoldDialog.tsx
├── app/(dashboard)/review-desk/[runId]/page.tsx   # becomes a redirect-only Server Component (D-07)
├── app/(dashboard)/voice-pass/[runId]/page.tsx    # becomes a redirect-only Server Component (D-07)
├── components/Masthead.tsx                        # rebuilt (D-24)
├── lib/
│   ├── nav.ts                            # NAV_GROUPS restructure (D-31)
│   ├── derivedState.ts                   # NEW — pure selector module (D-23)
│   ├── repetitionNoteClient.ts           # NEW — mirrors coverageStripClient.ts (D-10)
│   └── issuesClient.ts                   # optional — if hold/reopen go through a thin wrapper rather than raw useMutation calls
convex/
├── schema.ts                             # + issues table (D-01)
├── issues.ts                             # NEW — ensureByNumber, hold, reopen, create, byIssueNumber, listForWorkspace, listHeld, listRecentPublished (queries/mutations, Claude's discretion on exact split)
docs/API_CONTRACTS.md                     # + §40 (contract-first, before convex/issues.ts)
packages/pipeline/src/eisenbalm_pipeline/
├── api/registry.py                       # + GET /registry/repetition-note (or new file, mirrors coverage-strip) — D-10
├── api/runs.py / control.py              # + ensureByNumber call inside _start_run (D-04)
├── scripts/backfill_issues.py            # NEW — D-05, mirrors scripts/backfill_charity_registry.py's standalone-httpx-client pattern exactly
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Publish readiness / two-sign-off gate | A new "ready" computation | `sign_offs` `activeByRunId` (`convex/signOffs.ts:115-131`) — `ready = factDone && voiceDone` per `DERIVED-STATE-CONTRACT.md:20-24` | PROJECT.md's "DO NOT REBUILD the publish gate" is explicit (`.planning/PROJECT.md:42`) — this is *exactly* v3's formula, D-18 just adds `&& !held` |
| Claim coverage counters | A new claims-checked tally | `claim_checks:allSignedOff` (`convex/claimChecks.ts:159-177`) already returns `{total, signedOff, allSignedOff}` | Same data Phase 26/33/35 already built; the issue card's "checked X of Y" is a direct read |
| Task list / My Tasks count | A `tasks` Convex table | Pure selector over `claim_checks` + `qaCorrections` + `sign_offs` (`DERIVED-STATE-CONTRACT.md:26-37`, D-21) | Explicitly banned by the design contract §2: "Do not add a tasks table" |
| Cost roll-ups | A new per-issue cost aggregator | `runs.cost` JSON `.total` field, same parse logic as `runs:monthToDateCost` (`convex/runs.ts:144-158`) | Single-cost-writer rule (referenced in `convex/runs.ts:129` comment) — cost is written once by the pipeline, never derived elsewhere |
| Cancel/stop mechanism | A new run-abort flag | `runs.cancelRequested` (`convex/schema.ts:259`, Phase 25) | Already cooperative-cancel-wired through every pipeline node |
| Unique-issueNumber enforcement | A Convex "unique index" (does not exist as a primitive) | Query-then-insert idempotent-guard pattern, exactly as `convex/runs.ts:37-41`'s existing-row check | Convex has no native unique constraint; every existing table in this schema that needs uniqueness (`stripeEvents.by_eventId`, `runs.by_runId`) uses this same query-guard pattern, not a schema-level constraint |
| Repetition-note data source | A new coverage-tracking mechanism | `charities:listRecentFeatured` (`convex/charities.ts:274-290`), the exact same query `GET /registry/coverage-strip` already uses | Phase 39 already built and shipped this read path |

**Key insight:** every one of Phase 40's six ISS requirements is satisfiable by *reading* tables that already exist and are already wired into the dashboard's Convex subscriptions. The only genuinely new persisted state is the `issues` table's own five-ish operational fields (held/published/scheduledFor/hold-metadata) — everything else is routing plus a selector module.

## Runtime State Inventory

> Phase 40 is not a rename/rebrand phase, but it does perform a data migration (D-05 backfill) and a URL migration (D-07 redirects), so this section is included per the trigger condition ("migration").

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | **None requiring a rename.** `issueNumber` is not being renamed — it already exists identically in `pipelineRuns.issueNumber` (`convex/schema.ts:8`) and Sanity's `issue-${issueNumber}` slug (`apps/studio/schemas/weeklyIssue.ts:35-44`). The only stored-data change is additive: a NEW `issues` table populated by a one-time backfill (D-05) reading distinct `issueNumber` values out of the existing `pipelineRuns` table and deriving `published` from Sanity `status == 'published'` (confirmed value list at `apps/studio/schemas/weeklyIssue.ts:58-62`: `draft`/`in-review`/`published`). | Code: new `convex/issues.ts` mutation (e.g. `seedFromPipelineRuns`) callable idempotently, mirroring `charities:seedFromPublished`'s idempotent-upsert pattern (`convex/charities.ts:292+`). Data migration: one-shot standalone Python script under `packages/pipeline/scripts/`, structurally identical to the existing `scripts/backfill_charity_registry.py` (standalone `httpx.AsyncClient` against `NEXT_PUBLIC_CONVEX_URL` + `CONVEX_DEPLOY_KEY`, a GROQ read for Sanity published state, then a loop of idempotent Convex mutation calls). |
| Live service config | None. No n8n-style external workflow config, no third-party dashboard config keyed by a string this phase renames. | None. |
| OS-registered state | None. No cron/task-scheduler registration exists for this pipeline today (confirmed — `pipeline/tick` is dormant, no external caller found in-repo), so there is nothing OS-registered to update. D-12 explicitly keeps it that way this phase. | None. |
| Secrets/env vars | None. No new secret or env var is introduced — `issues` mutations reuse `PIPELINE_CONVEX_SECRET` (pipeline lane) and Clerk session auth (console lane), both already provisioned. | None. |
| Build artifacts | None. No package rename, no binary, no stale `.egg-info`. | None. |
| **URL migration (not in the standard 5 categories, but load-bearing for this phase)** | 7 dashboard routes re-key from run-keyed to issue-keyed (D-06/D-07/D-08, table above); 4 nav items restructure (D-31); old URLs must 301 via dynamic `redirect()`, not a static rewrite (confirmed via Next.js docs research above). | Code: thin Server Component wrappers at the old paths; new page tree under `app/(dashboard)/issues/`. Verify old bookmarked/linked URLs (e.g. any hardcoded `/review-desk/${runId}` link in `AwaitingYouInbox.tsx:71,74,93,104` and elsewhere) either get updated to the new issue-keyed URL directly or continue to work via the redirect — **recommend updating the link generation at the source** (`AwaitingYouInbox.tsx`'s `reviewHref`/`editHref` helpers) rather than relying on the redirect round-trip, since the redirect is a compatibility shim for external/historical links, not the primary navigation path going forward. |

**Nothing found requiring a literal string rename anywhere in the codebase** — this phase adds a new identity concept (`issues` rows) and re-parents routes; it does not rename any existing field, config key, or external resource.

## Common Pitfalls

### Pitfall 1: Confusing pipeline `/issues/{run_id}/...` with console `/issues/[issueNumber]`
**What goes wrong:** A future task description, a client function, or a code comment references "the `/issues/` endpoint" ambiguously, and someone wires a dashboard fetch to a pipeline REST path expecting `issueNumber` semantics when the pipeline route actually expects a `run_id`.
**Why it happens:** Both use the literal string `/issues/` in their path, for unrelated reasons (pipeline: pre-existing content-mutation REST namespace, run-keyed; console: this phase's new issue-keyed page tree). Confirmed 18 occurrences across `content.py`, `review.py`, `findings.py`, `signoffs.py`, `voice_pass.py`, `control.py`.
**How to avoid:** Name the new dashboard route tree clearly in plan/task titles as "the console `/issues/[issueNumber]` page tree" (never bare "`/issues/`"), and do not rename the pipeline endpoints this phase (confirmed out of scope — 18 endpoints, high blast radius, zero UX benefit for this phase's success criteria).
**Warning signs:** A task or PR touching `packages/pipeline/src/eisenbalm_pipeline/api/*.py`'s `/issues/{run_id}/...` routes when the actual goal is a dashboard routing change.

### Pitfall 2: Static redirect for a dynamic issueNumber↔runId mapping
**What goes wrong:** Implementing D-07's 301 via `next.config.js` `redirects()`, which only supports static or simple pattern-matched paths — it cannot perform the Convex lookup needed to translate a `runId` into an `issueNumber` (or vice versa).
**Why it happens:** `next.config.js` redirects *look* like the "proper" place for URL-shape changes, and are simpler to write for the common case.
**How to avoid:** Use a Server Component (or Route Handler) at the old path that awaits a Convex query, then calls `redirect()` from `next/navigation` — confirmed as the documented pattern for data-dependent redirects.
**Warning signs:** A `next.config.ts` diff attempting a `redirect` or `rewrite` rule referencing `:runId` or `:issueNumber` as a literal pattern segment with no data lookup.

### Pitfall 3: Forgetting the vitest `environmentMatchGlobs` entry for new Convex-table tests
**What goes wrong:** A new `__tests__/issues.test.ts` file using `convex-test` silently fails or errors with an unclear runtime error, because `apps/dispatch-control/vitest.config.ts`'s `environmentMatchGlobs` (lines 26-46) requires an explicit `edge-runtime` environment override per test file — the default `node` environment cannot run `convex-test`.
**Why it happens:** Every prior Convex-table test file (`agentRuns.test.ts`, `auditLog.test.ts`, `runs.test.ts`, `evalScores.test.ts`, `charityCorrections.test.ts`, etc.) required this exact same one-line addition; it is easy to add the test file and forget the config entry.
**How to avoid:** Add `['__tests__/issues.test.ts', 'edge-runtime']` to `apps/dispatch-control/vitest.config.ts`'s `environmentMatchGlobs` array in the SAME task/commit that adds `convex/issues.ts` and its test.
**Warning signs:** `issues.test.ts` fails with an environment-related error (missing edge-runtime globals) rather than a normal assertion failure.

### Pitfall 4: Convex deploy skipped after schema/function changes
**What goes wrong:** `convex/schema.ts` and `convex/issues.ts` are committed but never pushed to the live dev deployment (`dev:modest-magpie-797`), so the dashboard's `useQuery(api.issues....)` calls 404 or the schema validation silently rejects writes in production, exactly as happened in Phase 39 (per project memory: "Phase 39 shipped a prod 500 by skipping this").
**Why it happens:** Committing `convex/*.ts` files feels like "done" — there is no build-time signal that a live sync is still required.
**How to avoid:** Run `pnpm --filter @eisenbalm/convex dev:once` (confirmed exact script: `convex/package.json`'s `"dev:once": "convex dev --once"`) against `dev:modest-magpie-797` as an explicit, separate task step after any Convex schema/function change, before declaring the phase's Convex work done.
**Warning signs:** A dashboard page renders "loading" forever or throws a Convex API-not-found error for a query/mutation that exists in the committed source but was never pushed.

### Pitfall 5: `vitest` passing while the Next.js build fails
**What goes wrong:** All new component/unit tests pass, but a type error or a Server/Client Component boundary violation in the new `app/(dashboard)/issues/` tree only surfaces at `next build` time, because vitest does not type-check (confirmed project memory: "vitest doesn't type-check").
**Why it happens:** `apps/dispatch-control/package.json`'s `test`/`test:unit` scripts run `vitest run` only; `typecheck` (`tsc --noEmit`) and `build` (`next build`) are separate scripts that must be run explicitly.
**How to avoid:** Run `pnpm --filter dispatch-control build` (confirmed exact script: `"build": "next build"`) as a mandatory final verification step before the phase is declared done — this is a locked project convention (CONTEXT.md's Established patterns list, corroborated by project memory).
**Warning signs:** Any new file under `app/(dashboard)/issues/` mixes `'use client'` state (e.g. `useState` for the Hold dialog) into what should be a Server Component page, or a Convex query result type mismatch that vitest's mocked/edge-runtime tests don't exercise.

### Pitfall 6: `pipelineRuns` has no `by_issueNumber`-keyed query function yet
**What goes wrong:** Assuming `convex/pipelineRuns.ts` already exposes a way to look up a run (or the latest run) by `issueNumber` — it does not. Only `byRunId` (`convex/pipelineRuns.ts:6-14`) exists as a query, even though the schema already has the index (`convex/schema.ts:25`, `.index('by_issueNumber', ['issueNumber'])`).
**Why it happens:** The index was added early (Phase 4-era) for a use case that never needed a dedicated query function until now.
**How to avoid:** The D-07 redirect (`runId → issueNumber`) is straightforward via the existing `byRunId` query. But anything needing the REVERSE (`issueNumber → runId`, e.g. resolving `/issues/[n]/review` to the underlying `runId` for the wrapped Client Component) needs a NEW query function on `convex/pipelineRuns.ts` using the already-declared-but-unused `by_issueNumber` index.
**Warning signs:** A plan step tries to call a nonexistent `pipelineRuns.byIssueNumber` query without first adding it.

## Code Examples

### Idempotent insert-if-absent mutation pattern (for `issues.ensureByNumber`, D-04)
```typescript
// Source: convex/runs.ts:22-52 (create mutation's existing-row guard)
export const create = mutation({
  args: { workspace_id: v.string(), runId: v.string(), /* ... */ },
  handler: async (ctx, { workspace_id, runId, /* ... */ }) => {
    requirePipelineSecret(pipelineSecret)
    const existing = await ctx.db
      .query('runs')
      .withIndex('by_runId', q => q.eq('runId', runId))
      .first()
    if (existing) return existing._id   // no-op — the D-04 pattern to replicate
    return await ctx.db.insert('runs', { /* ... */ })
  },
})
```

### Pipeline-lane vs. dashboard-lane mutation guard split (for `issues.ts`)
```typescript
// Source: convex/lib/auth.ts:52-56 (dashboard lane) and :68-73 (pipeline lane)
export async function requireOperator(ctx: MutationCtx): Promise<string> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) throw new Error('Unauthorized')
  return identity.subject   // NEVER trust a client-supplied actorId — use this
}
export function requirePipelineSecret(secret?: string): void {
  const expected = process.env.PIPELINE_CONVEX_SECRET
  if (!expected || !secret || !constantTimeEqual(secret, expected)) {
    throw new Error('Unauthorized')
  }
}
```

### Existing derived-status formula this phase must match exactly (DERIVED-STATE-CONTRACT.md:20-24)
```
ready      = factDone && voiceDone           // publish unlock — Phase 34, unchanged
canPublish = ready && isEditor && !published
// D-18 adds: issue status = published ? 'Published' : held ? 'Held' : ready ? 'Ready to publish' : 'Needs review'
```

### Existing run-trigger client D-13 reuses verbatim (no new client function needed beyond passing issueNumber)
```typescript
// Source: apps/dispatch-control/lib/pipelineControlClient.ts:63-84
export async function triggerRun(
  body: TriggerRunBody,  // { issueNumber?: number; narratorSlug?: string }
  token: string | null,
): Promise<TriggerRunResult> {
  const res = await fetch(`${pipelineBaseUrl()}/pipeline/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  })
  // ... error handling, returns { runId }
}
```

### Backfill script pattern to replicate for D-05 (`scripts/backfill_issues.py`)
```python
# Source: packages/pipeline/scripts/backfill_charity_registry.py:1-53 (structure)
# Standalone httpx.AsyncClient against NEXT_PUBLIC_CONVEX_URL + CONVEX_DEPLOY_KEY,
# a GROQ read for Sanity state, then idempotent Convex mutation calls in a loop.
# D-05 needs: distinct issueNumber values from pipelineRuns (Convex read, not Sanity),
# cross-referenced against Sanity `status == 'published'` per issueNumber for the
# `published` field — inverse direction of backfill_charity_registry's Sanity-primary read.
```

## Environment Availability

No new external dependency, service, CLI, or runtime is introduced by this phase. Every system this phase touches is already provisioned and reachable in this environment:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Convex (`dev:modest-magpie-797`) | `issues` table, all derived-state reads | ✓ (already deployed, existing 27 tables live) | `convex@^1.38.0` (`apps/dispatch-control/package.json`) | — |
| FastAPI pipeline (Railway) | `POST /pipeline/run` (D-13), new repetition-note endpoint (D-10) | ✓ (already deployed, 18 existing `/issues/{run_id}/...` routes prove the service is live) | — | — |
| Clerk auth | `requireOperator`, dashboard route guards | ✓ (already wired, `@clerk/nextjs@^7.5.7`) | — | — |
| Sanity (read-only GROQ) | D-05 backfill's published-state derivation, D-10's repetition note's cause/geo/signal join | ✓ (already reachable from pipeline via `groq_query`, per `registry.py`'s existing coverage-strip pattern) | — | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^3.2.0` (`apps/dispatch-control/package.json`), config at `apps/dispatch-control/vitest.config.ts` |
| Config file | `apps/dispatch-control/vitest.config.ts` — note the `environmentMatchGlobs` array requires a per-file `edge-runtime` entry for every new `convex-test`-based test file (Pitfall 3 above) |
| Quick run command | `pnpm --filter dispatch-control test -- __tests__/issues.test.ts` (or the equivalent single-file vitest invocation) |
| Full suite command | `pnpm --filter dispatch-control test` (→ `vitest run`, currently ~70 test files per `__tests__/` listing) |

**Note:** vitest does NOT type-check (confirmed project memory + `package.json`'s separate `typecheck`/`build` scripts) — `pnpm --filter dispatch-control build` (→ `next build`) is a MANDATORY separate step before this phase is declared done, per the locked project convention.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ISS-01 | `issues` table CRUD + `ensureByNumber` idempotency | unit (convex-test) | `pnpm --filter dispatch-control test -- __tests__/issues.test.ts` | ❌ Wave 0 |
| ISS-01 | Derived-state selector (`ready`, stage states, task projection, work-remaining) pure functions | unit | `pnpm --filter dispatch-control test -- __tests__/derivedState.test.ts` | ❌ Wave 0 |
| ISS-01 | `IssueCard` renders 5-stage strip + all 7 readouts | component (jsdom) | `pnpm --filter dispatch-control test -- __tests__/IssueCard.test.tsx` | ❌ Wave 0 |
| ISS-02 | Old run-keyed URL redirects to new issue-keyed URL | integration/component (or manual — Next.js `redirect()` from a Server Component is awkward to unit-test in isolation; consider a thin resolver-function unit test instead) | `pnpm --filter dispatch-control test -- __tests__/issueRouteResolver.test.ts` (test the resolver function, not the Next.js redirect mechanics directly) | ❌ Wave 0 |
| ISS-02 | Nav restructure (`NAV_GROUPS` no longer contains Review Desk/Signal Desk/Voice Pass; contains Issues under Editorial) | unit | `pnpm --filter dispatch-control test -- __tests__/nav.test.ts` (existing file — extend, do not replace) | ✅ extend existing |
| ISS-03 | Repetition-note pipeline endpoint | pipeline unit/integration (pytest, mirrors `packages/pipeline/tests/` coverage-strip equivalent if one exists — not confirmed this pass) | `cd packages/pipeline && uv run pytest tests/api/test_registry.py -k repetition` (path/name is a recommendation, not confirmed to exist) | ❌ Wave 0 |
| ISS-03 | "Start it early" wiring (calls `triggerRun` with reserved `issueNumber`) | component | `pnpm --filter dispatch-control test -- __tests__/ScheduledSlotCard.test.tsx` | ❌ Wave 0 |
| ISS-04 | Hold mutation writes `audit_log` row + sets `held`; Reopen clears it | unit (convex-test) | included in `__tests__/issues.test.ts` | ❌ Wave 0 |
| ISS-04 | Hold dialog's "stop run" checkbox calls `runs:requestCancel` | component | `__tests__/HoldDialog.test.tsx` | ❌ Wave 0 |
| ISS-05 | Masthead renders 4 separate readouts, never a blended single chip | component | `pnpm --filter dispatch-control test -- __tests__/Masthead.test.tsx` (existing file — extend) | ✅ extend existing |
| ISS-06 | Query failure/undefined state renders "State unknown — refresh", never a stale prior value | component | `__tests__/IssueCard.test.tsx` (same file as ISS-01, additional error-state test case) | ❌ Wave 0 (covered by the ISS-01 IssueCard test file) |

### Sampling Rate
- **Per task commit:** `pnpm --filter dispatch-control test -- <changed test file>`
- **Per wave merge:** `pnpm --filter dispatch-control test` (full vitest suite) + `pnpm --filter dispatch-control build` (strict type-check via `next build`)
- **Phase gate:** Full vitest suite green + `next build` exit 0 + (if any `convex/*.ts` changed) `pnpm --filter @eisenbalm/convex dev:once` against `dev:modest-magpie-797` completed, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `__tests__/issues.test.ts` — covers ISS-01/ISS-04 (`issues` table mutations/queries, `convex-test`, `edge-runtime` environment)
- [ ] Add `['__tests__/issues.test.ts', 'edge-runtime']` to `apps/dispatch-control/vitest.config.ts`'s `environmentMatchGlobs`
- [ ] `apps/dispatch-control/lib/derivedState.ts` + `__tests__/derivedState.test.ts` — covers ISS-01/ISS-06 (pure selector, node environment, no Convex needed — plain unit tests over hand-constructed input objects)
- [ ] `__tests__/IssueCard.test.tsx`, `__tests__/ScheduledSlotCard.test.tsx`, `__tests__/HoldDialog.test.tsx` — new component tests (jsdom)
- [ ] `docs/API_CONTRACTS.md` §40 — not a test file, but a Wave-0-equivalent prerequisite: contract-first per established Ph35/38/39 convention, must exist before `convex/issues.ts` is written
- [ ] Pipeline-side test for the new repetition-note endpoint — exact existing test file for `GET /registry/coverage-strip` was not located this research pass; the planner should grep `packages/pipeline/tests/` for the Phase 39 registry test before assuming a pattern to follow

## Sources

### Primary (HIGH confidence — direct repository reads)
- `convex/schema.ts:1-483` — full current Convex schema (27 tables); confirms `issues` table does not yet exist, confirms exact shapes of `pipelineRuns`, `runs`, `sign_offs`, `claim_checks`, `audit_log`, `pipeline_config`, `charities`
- `convex/runs.ts`, `convex/pipelineRuns.ts`, `convex/signOffs.ts`, `convex/claimChecks.ts`, `convex/auditLog.ts`, `convex/lib/auth.ts`, `convex/charities.ts` — function-level implementation patterns
- `apps/dispatch-control/components/Masthead.tsx:1-152`, `AwaitingYouInbox.tsx:1-161`, `lib/nav.ts:1-50`, `lib/coverageStripClient.ts:1-92`, `lib/pipelineControlClient.ts:1-212`, `lib/workspace.ts:1-21`
- `apps/dispatch-control/app/(dashboard)/{review-desk,voice-pass,signal-desk,run-monitor}/**/page.tsx` — full route tree enumeration + representative file reads
- `apps/dispatch-control/__tests__/dispatch-control-no-sanity-write.test.ts`, `vitest.config.ts`, `package.json`
- `packages/pipeline/src/eisenbalm_pipeline/api/{runs,control,registry}.py` — `_resolve_issue_number`, `_start_run`, `POST /pipeline/run`, `GET /registry/coverage-strip` full implementations
- `packages/pipeline/src/eisenbalm_pipeline/agents/calibrator.py:1-345` — confirms no repetition-note logic exists today, confirms `bonusType`-only rotation
- `packages/pipeline/src/eisenbalm_pipeline/lib/scheduler.py`, `scripts/backfill_charity_registry.py` — scheduling substrate and backfill-script precedent
- `apps/studio/schemas/weeklyIssue.ts` — Sanity `issueNumber`/`status`/`pipelineMetadata` field confirmation (corrects CLAUDE.md's stale `schemas/` path reference)
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md`, `Dispatch Control v3 - Annotations.md`, `README.md` — binding design spec (read in full)
- `.planning/PROJECT.md:1-90` — Current Milestone locked decisions + reconciliation facts
- `.planning/ROADMAP.md:857-919` — Phase 40/41 detail sections + reuse-discipline note
- `.planning/phases/40-issue-entity-issues-home/40-CONTEXT.md`, `40-UI-SPEC.md` — full read, both binding for this phase

### Secondary (MEDIUM confidence — official docs, verified against repo behavior)
- [Next.js `redirect()` function docs](https://nextjs.org/docs/app/api-reference/functions/redirect) — confirms Server Component `redirect()` can follow an awaited data fetch; used to ground the D-07 "Claude's Discretion" recommendation against a static `next.config` rewrite, which cannot perform a Convex lookup

### Tertiary (LOW confidence)
- None — every claim in this document traces to a direct repository read or an official framework doc; no unverified WebSearch-only claims are included.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; existing `package.json` read directly.
- Architecture (routing inversion, Convex table pattern): HIGH — every pattern cited is drawn from shipped, currently-passing code in this exact repo.
- Derived-state data sources: HIGH — every one of the six ISS-01 readouts traced to an existing, currently-queried Convex table/function.
- Scheduling substrate: HIGH — `scheduler.py` and `calibrator.py` read in full; the "no cron exists" and "no repetition note exists today" claims are both directly falsifiable-if-wrong and were verified by absence-of-evidence in the actual source, not by inference from memory alone.
- Pitfalls: HIGH — five of six pitfalls are drawn from either a currently-passing tripwire test, an explicit project-memory incident (Phase 39's prod 500), or a directly-confirmed missing query function; one (Pitfall 2, static-vs-dynamic redirect) is grounded in official Next.js docs research.

**Research date:** 2026-07-14
**Valid until:** ~14 days (fast-moving phase — the very next phase, 41, recomposes routes this phase creates; any drift in the `issues` table shape or route tree should be re-verified against the actual Phase 40 implementation before Phase 41 planning begins, rather than trusting this document's file:line citations to still be current).
