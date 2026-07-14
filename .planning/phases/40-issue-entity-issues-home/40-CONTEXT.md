# Phase 40: Issue Entity & Issues Home - Context

**Gathered:** 2026-07-14
**Status:** Ready for planning

<domain>
## Phase Boundary

The console stops being run-keyed and becomes **issue-keyed**. This phase delivers:

1. A first-class **issue entity** (new Convex `issues` table) that exists *before* any run does.
2. **Issue-keyed routing** — `/issues` home, `/issues/[issueNumber]`, with the pipeline run demoted to a historical record *under* the issue (`/issues/[n]/runs/[runId]`).
3. The **Issues home** — in-progress card with its 5-stage strip, the next scheduled slot with a repetition note, held issues with reason/who/when, recently published with verification record.
4. **Hold / Reopen** with a required reason.
5. A **global header** that separates four state systems that were previously blended.
6. A **derived-state selector module** (issue status, stage states, task projection, estimated work) that Phases 41 and 43 consume rather than re-invent.

**Not in this phase:** the Issue Workspace frame and stage tabs (Phase 41), Fact Check (42), the My Tasks *screen* (43), "Start from my brief" (48), roles/permissions (49), and the nomenclature renames (50). `/issues/[n]` ships as an issue overview page whose **contents** Phase 41 replaces in place — the URL does not move.

</domain>

<decisions>
## Implementation Decisions

### Issue entity & storage

- **D-01: New Convex `issues` table.** One row per issue. Approximate shape: `{workspace_id, issueNumber, scheduledFor, held (bool), heldReason, heldBy, heldAt, statusBeforeHold?, published (bool)/publishedAt, sanityIssueId, lastVisitedStage, createdAt}`. Hold + schedule + slot reservation are durable operator state with nowhere to live today — the same justification that earned `sign_offs` (Ph34) and `eval_scores` (Ph38) their tables. Sanity stays content-of-record; Convex owns operational state. **Contract-first:** amend `docs/API_CONTRACTS.md` before writing the table (established Ph35/38/39 pattern).
- **D-02: `issueNumber` (int) is the natural key** — in code, in queries, and in URLs. It is already the de-facto join key everywhere (`pipelineRuns.issueNumber`, Sanity `issue-{n}`, the masthead chip, the Calibrator tie-break) and it is how the design speaks ("Issue 07", "start #08 early"). Enforce uniqueness with an index. No opaque id, no slug (the slug depends on a charity that does not exist at creation time).
- **D-03: The console creates the issue; the run attaches to it.** Create issue → row exists with a reserved `issueNumber` → the run is triggered *against that number*. This is what makes "the editor never triggers a pipeline" true, and it is what gives Phase 41's "Create → land in Story & Brief" something to mount on. `_resolve_issue_number` in `packages/pipeline/.../api/runs.py` already honors an explicit `issueNumber` verbatim, so the pipeline change is small.
- **D-04: The pipeline defensively ensures the row.** At run start the pipeline calls a Convex `issues.ensureByNumber`-style mutation: no-op if the console already created the row, create it if not. The console remains the *intended* entry point, but no trigger path (existing `POST /run/weekly` with an empty body, a future cron, a curl) can orphan a run. Guard the status machine so a stray run can never silently resurrect a **Held** issue.
- **D-05: One-time backfill from `pipelineRuns`.** A seed/migration creates one `issues` row per distinct existing `issueNumber`, deriving published state from Sanity. "Recently published" then renders real history, and there is exactly one code path for "what is an issue."

### Routing & run demotion

- **D-06: URL shape is `/issues` → `/issues/[issueNumber]`.** Phase 41 hangs stage tabs beneath it (`/issues/7/draft`, `/issues/7/fact-check`, …) with no second URL migration. Stages are path segments, not query params, so per-stage deep links (from My Tasks, from a claim) stay linkable.
- **D-07: Re-key the desks now; 301 the old run-keyed URLs.** `/review-desk/[runId]` → `/issues/[n]/review`, `/voice-pass/[runId]` → `/issues/[n]/voice`. These are **thin issue→run param translations around the already-shipped components** — do NOT rewrite their internals; Phase 41 recomposes them into stage tabs. Old URLs redirect (resolve `issueNumber` from `runId` via `pipelineRuns`). This makes success criterion 2 literally true at the end of Phase 40 and spares Phase 41 a second URL migration.
- **D-08: A run is canonically reachable under its issue** at `/issues/[n]/runs/[runId]`, linked from the issue overview. **Run Monitor survives as a nav item** but moves into the System Workbench group — the v3 spec's own Workbench nav lists "Run Details", so ISS-02's "never a top-level nav destination" means a run stops being the *editorial* object, not that it becomes unreachable. Phase 50 renames it.
- **D-09: Clicking the in-progress card lands on `/issues/[n]`** — a real overview page (5-stage strip, status, open tasks, hold control, links into `/issues/[n]/review` + `/issues/[n]/voice` + run history). Phase 41 replaces its **contents** with the Workspace frame at the **same URL**.

### Scheduled slot & repetition note

- **D-10: The repetition note is derived deterministically from coverage memory.** A pipeline read endpoint (same shape and auth as Phase 39's `GET /registry/coverage-strip`) counts the last-8 cause/geo/signal chips and emits "avoid US-SE · avoid weather" for whatever is over-represented. **No LLM call, no run required** — which is mandatory, because the note must render *before* a run exists. It is the Calibrator's *rule* applied outside a run; today's Calibrator only rotates `bonusType` and emits no such note.
- **D-11: The next slot is a real `issues` row with status Scheduled** — lazily ensured when the home loads, with its `issueNumber` reserved and `scheduledFor` computed from a cadence config row. Because it is a real entity, the repetition note, a hold, and "start early" all attach to something that exists.
- **D-12: No cron in this phase.** The slot is informational; nothing fires on its own. ISS-03 only requires that the operator *see* the slot and *can* start it early, and "Human approval required" stays honest. (The missing weekly cron is a known pre-deploy gap — it remains its own decision, not a side effect of a UI phase.)
- **D-13: "Start it early"** flips the issue to in-progress, calls the existing run trigger with that `issueNumber`, and navigates to `/issues/[n]`. Once Phase 41 lands, the same navigation drops the operator into the Workspace — no rework.

### Hold

- **D-14: Hold offers to stop the run in progress.** The hold dialog carries an "also stop the run in progress" checkbox, **default on**, which sets the existing `runs.cancelRequested` cooperative-cancel flag (Phase 25). The two state systems stay distinct in the model, but the operator is never left holding an issue while the machine quietly keeps spending on it.
- **D-15: Held blocks publish; editing stays open.** `ready` gains a `&& !held` term — one line in the formula Phase 41's publish gate consumes. You usually hold an issue *because* it needs more work, so locking the editor would be self-defeating.
- **D-16: The hold reason is required free text**, written to the existing `audit_log` with actor + timestamp (the record Phase 43's Decision log reads back). No preset taxonomy — it would be invented before a single real hold exists.
- **D-17: Reopen clears the hold**, and status re-derives on its own (see D-18). No separate "restore previous status" bookkeeping.

### Derived state (the load-bearing decision)

- **D-18: Issue status is DERIVED; only `held` and `published` are stored.** `published → Published`; `held → Held`; `factDone && voiceDone → Ready to publish`; else `Draft / Needs review`. This is exactly the `DERIVED-STATE-CONTRACT` §3 formula, and it makes **success criterion 6 structural** — a silently stale "ready" is *impossible* when "ready" is recomputed from `sign_offs` on every read. Same discipline that makes My Tasks a projection.
- **D-19: Stage states are artifact-derived — what exists, not what ran.** Stage 1 = charity chosen (pitchLog / gate-1 resolution) · Stage 2 = sections drafted in Sanity + open QA findings · Stage 3 = `claim_checks` coverage · Stage 4 = voice findings + `sounds-human` sign-off · Stage 5 = `facts-cleared` + published. It answers "is the work done?", survives a restarted or re-run pipeline, and is the same question Phase 41's tabs ask. **Do not derive from pipeline node progress** — a completed run with zero checked claims must not show Fact Check as done.
- **D-20: Stage-state vocabulary: `Not generated / In progress / Needs you / Clean`, each with an open-item count.** Maps to the spec's "✓ / count / ⚠" tab marks. "Not generated" is a first-class visible state, never a blank. Every state renders **label + icon**, never color alone.
- **D-21: Build the REAL derived task projection now** — open must-fix claims + open QA findings + missing sign-offs → task objects carrying the `DERIVED-STATE-CONTRACT` §2 shape (`sev`, `title`, `where`, `why`, `rec`, `primary`, `insp`). Phase 40 renders `.length` in the header; **Phase 43 renders the same array as a screen.** A count-only shim would guarantee a header that says 3 next to a list of 2. **No tasks table** (contract §2).
- **D-22: Estimated work remaining = severity-weighted minutes over open tasks**, summed and rendered "~12 min". Weights live in one constants module so they can be tuned. Deterministic and explainable; falls straight out of D-21.
- **D-23: All derivation lives in a pure TS selector module** in `apps/dispatch-control/lib/` — pure functions over the results of existing Convex queries, unit-testable in isolation, consumed by the header, the issue card, Phase 41's tabs, and Phase 43's My Tasks. Follows the Phase 32 client-side span resolver (D-13) and Phase 37 client-side run aggregation (D-08) precedent. Editorial policy (severity weights, stage rules) stays out of the backend.

### Global header (rebuild of `Masthead.tsx`)

- **D-24: Four readouts, never blended** — Issue status (D-18) · System activity (Idle / Running / Paused for you / Failed / Complete, from `runs.status`) · My Tasks count (D-21) · Cost vs budget. Today's masthead blends these: its single "status" chip is actually *system activity*, and there is no issue status at all. Each readout carries **label + icon**, never color alone.
- **D-25: The "Awaiting you" inbox becomes the My Tasks readout.** The button becomes the labeled `My Tasks · N` readout; clicking it still opens the existing `AwaitingYouInbox` dropdown (already a derived list of what needs you). Phase 43 swaps the dropdown's target for the real screen. No capability lost, no dead button.
- **D-26: "Auto-publish OFF" → "Human approval required"** — quiet reassurance in the normal state. When auto-publish is **ON**, the existing vermilion warning + `AutoPublishBanner` stay exactly as loud as they are today. Done now because this header is being rebuilt anyway; the rest of the nomenclature pass stays in Phase 50.
- **D-27: Cost vs budget = month-to-date vs monthly cap** (existing `runs.monthToDateCost` + the `monthly_cap_usd` config key). The **issue card** carries *this issue's run cost* (ISS-01). Both numbers already exist; no new config key.

### Issues home

- **D-28: One Create path ships.** "Find a story with agents" — creates the issue row and triggers the run. Phase 48 adds "Start from my brief" beside it as an equal sibling. Build the layout to hold two cards so Phase 48 is an addition, not a redesign. **No dead button in the primary CTA** (locked milestone decision).
- **D-29: "Recently published" renders the real verification record** — claim coverage from `claim_checks` (checked X of Y) and sign-offs from `sign_offs` (who cleared facts, who approved voice, when). Both already exist. An empty verification slot would read as "unverified" — the exact "blank means verified" inversion the spec bans.
- **D-30: Empty state** (no issue in progress): the Create panel is open by default and the current-issue card is replaced by "No issue in progress — discovery scheduled {slot}". **Loading:** card skeletons that preserve the stage-strip geometry. **Error (ISS-06):** "State unknown — refresh", never a silently stale "ready".

### Navigation (`lib/nav.ts`)

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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Binding design spec (v4.0 milestone)
- `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md` — §Global header, §Nav, §Screen: Issues (home) are the direct spec for this phase; §State model defines the four state systems and the label+icon rule.
- `docs/design/dispatch-control-v3/DERIVED-STATE-CONTRACT.md` — **§1** (everything derives from four booleans; `ready = factDone && voiceDone`), **§2** (My Tasks is a projection — *do not add a tasks table*), **§3** (the header's four separated state systems and the `hdrStatus` / `hdrActivity` formulas). This is the authority for D-18, D-21, D-24.
- `docs/design/dispatch-control-v3/README.md` — color semantics (every state carries label + icon, never color alone) and the milestone's locked decisions.

### Contracts & schema
- `docs/API_CONTRACTS.md` — **amend before writing code** (the `issues` table + any new read endpoint). Contract-first is the established Ph35/38/39 pattern.
- `convex/schema.ts` — `sign_offs` (Ph34: `facts-cleared` / `sounds-human`, revoked on content mutation) · `claim_checks` (Ph35) · `runs` (incl. `cancelRequested`) · `pipelineRuns` (where `issueNumber` lives today) · `audit_log`.

### Project constraints
- `.planning/PROJECT.md` §Current Milestone — locked decisions ("no dead button in the primary CTA"; sign-off revocation stays as Phase 34 built it) and the reconciliation facts ("DO NOT REBUILD the design system / the publish gate"; the pipeline is 18 nodes today).

### Prior-phase context this phase builds on
- `.planning/phases/30-.../30-CONTEXT.md` — D-09 pure-derivation lifecycle (the Awaiting-you inbox this phase converts into the My Tasks readout).
- `.planning/phases/34-.../34-CONTEXT.md` — D-02 `sign_offs` table (the source of `factDone` / `voiceDone`).
- `.planning/phases/35-.../35-CONTEXT.md` — D-03 `claim_checks` upgraded in place (the source of claim coverage).
- `.planning/phases/39-.../39-CONTEXT.md` — the coverage-memory strip whose data D-10's repetition note is derived from.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `convex/signOffs.ts` + `sign_offs` → `factDone` / `voiceDone` / `ready` come free. **No new gate logic.**
- `convex/claimChecks.ts` + `claim_checks` → claim coverage for the card, the stage strip, and the published verification record.
- `apps/dispatch-control/lib/coverageStripClient.ts` + pipeline `GET /registry/coverage-strip` → returns the last ≤8 charities joined to `{cause, geo, signal}` chips. **This is the raw material for D-10's repetition note** — same client + auth pattern for the new endpoint.
- `apps/dispatch-control/components/Masthead.tsx` → being rebuilt into the four readouts. Already wires `runs.latest`, `pipelineRuns.byRunId` (for `issueNumber`), `runs.monthToDateCost`, and the `pipelineConfig` `monthly_cap_usd` / `auto_publish` keys.
- `apps/dispatch-control/components/AwaitingYouInbox.tsx` → becomes the My Tasks dropdown (D-25).
- `apps/dispatch-control/lib/nav.ts` → single source of truth for nav; `NAV_GROUPS` restructures here (D-31).
- `convex/runs.ts` → `latest`, `listForWorkspace`, `monthToDateCost`. `runs.cancelRequested` is the Phase 25 cooperative-cancel flag D-14 sets.
- `convex/auditLog.ts` → the hold-reason record (D-16).

### Established patterns
- **Contract-first:** amend `docs/API_CONTRACTS.md` + add the Convex table *before* code (Ph35/38/39).
- **Derive, don't store:** Phase 30 D-09, Phase 32 D-13 (client-side resolver), Phase 37 D-08 (client-side aggregation over existing rows, no new table). D-18/D-21/D-23 continue this line.
- **Convex functions need a live sync** — committing `convex/*.ts` is not deploying it. Run `pnpm --filter @eisenbalm/convex dev:once` against `dev:modest-magpie-797` after any Convex change (Phase 39 shipped a prod 500 by skipping this).
- **Strict build before "done":** `pnpm --filter dispatch-control build` — vitest does not type-check.
- **Write boundary:** every console content mutation goes dashboard → pipeline API → Sanity, logged to `audit_log`. An EDT-05 source-scan test proves zero direct Sanity writes from the console. `issues` is Convex-only operational state, so this phase does not touch that boundary — but the run trigger and the new read endpoint must respect it.

### Integration points
- `convex/schema.ts` — new `issues` table.
- `packages/pipeline/src/eisenbalm_pipeline/api/runs.py` — `_resolve_issue_number` already honors an explicit `issueNumber` (D-03); add the `ensureByNumber` Convex call at run start (D-04).
- Pipeline already namespaces `GET /issues/{run_id}/draft` — **keyed by run today.** That naming is precisely the inversion this phase performs; expect to reconcile it.
- New routes under `apps/dispatch-control/app/(dashboard)/issues/`; redirects from `review-desk/[runId]`, `voice-pass/[runId]`.
- New pipeline read endpoint for the repetition note (mirror the coverage-strip endpoint).

</code_context>

<specifics>
## Specific Ideas

- The prototype's demo path and copy are the reference for tone: "State unknown — refresh", "No issue in progress — discovery scheduled Monday 6:00", "avoid US-SE · avoid weather", "Human approval required".
- "Editor" unqualified is reserved for the **human**. Anything an agent recommends is labeled agent judgment (matters from Phase 41 on, but establish the vocabulary here).
- The design's own words for why status must derive: *"blank never means verified."* Success criterion 6 is a direct consequence — build it as a structural property (D-18), not a special-case error handler.

</specifics>

<deferred>
## Deferred Ideas

- **The weekly cron** that auto-starts the scheduled issue (D-12). A known pre-deploy gap; it needs its own thinking about failure, notification, and budget. Not a side effect of a UI phase.
- **"Start from my brief"** as a second Create path — Phase 48 (ENT).
- **My Tasks as a screen** — Phase 43 (TSK). Phase 40 builds the projection it will render.
- **Role gating on Hold / Create / Reopen** — Phase 49 (ROL) gates exactly six actions; Hold is not one of them, but Collaborator visibility rules for Create/Reopen land there.
- **Nomenclature renames** (Run Monitor → Run Details, Registry → Editorial Memory, etc.) — Phase 50 (WBN).
- **Per-issue cost budget** as a header readout — considered, not chosen (D-27 keeps month-to-date vs monthly cap).

</deferred>

---

*Phase: 40-issue-entity-issues-home*
*Context gathered: 2026-07-14*
