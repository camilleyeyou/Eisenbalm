# Phase 39: Registry Coverage-Memory Strip - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning
**Mode:** Smart discuss (autonomous) — all four areas accepted as recommended

<domain>
## Phase Boundary

The operator can see thematic repetition across recent issues at a glance and keep a durable record of corrections to a charity that the Researcher actually reuses. A coverage-memory strip visualizes the last 8 issues' cause/geo/signal chips so thematic repetition is visible at a glance (MEM-01); the operator can append a correction to a charity's record, stored as an append-only corrections log surfaced in the Registry (MEM-02); and the Researcher re-reads a charity's corrections log on any future mention of that charity, verifiable in pipeline output/logs for a repeat-charity run (MEM-03). Requirements: MEM-01, MEM-02, MEM-03. This is the final v3.0 phase.

**Explicitly NOT in scope:** REG-01/REG-02 (charity registry + Scout dedup — already shipped Phase 26); changing the Scout dedup logic; any new agent; auto-acting on corrections (the Researcher READS them, it does not auto-rewrite based on them beyond normal research incorporation).

</domain>

<decisions>
## Implementation Decisions

### Coverage-memory strip (MEM-01)
- **D-01: A strip on the Registry page** (top of `registry/page.tsx`), visualizing the last 8 featured issues' cause/geo/signal chips so thematic repetition is scannable. Distinct from the Run Monitor drift strip (that's cost/duration; this is editorial coverage).
- **D-02: Last-8 source = the 8 most recently featured charities** (`charities` table, `status === 'featured'`, ordered by `lastFeaturedAt` desc), joined to their Sanity charity's `focusArea` (→ cause chip) and `location` (→ geo chip). One column per issue, chips stacked.
- **D-03: The "signal" chip source is a research question — resolve in RESEARCH.** No dedicated "signal" field exists today. Options for the researcher/planner to choose the cheapest honest source: (a) capture a lightweight `signal` tag on the `charities` row (or a coverage record) at feature time; (b) derive it from an existing taxonomy (focusArea sub-classification, or the pitchLog `primaryConcern`/scoutSummary for that charity's run); (c) if no clean source exists, ship cause+geo chips and mark signal as a follow-up rather than fabricate one. Prefer a real existing source over a new write path; do NOT invent a signal that isn't grounded in data.
- **D-04: Repetition is visible, not computed-into-a-score.** The strip shows the chips side by side so a human sees repetition (e.g. three "housing" causes in a row); no algorithmic "diversity score" this phase.

### Corrections log (MEM-02)
- **D-05: New append-only Convex table `charity_corrections`** — shape approximately `{workspace_id, charityKey (the registry dedupKey; also store sanityCharityId when known), text, author, createdAt}`. Append-only: never updated or deleted (the log IS the durable record). Contract-first: amend `docs/API_CONTRACTS.md` + add the table before code.
- **D-06: Write path = a guarded, audit-logged append.** A `requireOperator`-guarded mutation (or a pipeline endpoint if that matches the existing registry mutation pattern — planner confirms which the Phase 26 registry uses and stays consistent), writing an audit row ("nothing silent"). Corrections are append-only; there is no edit/delete.
- **D-07: Surfaced per-charity in the Registry.** Each charity row gains an "Add correction" affordance + a chronological list of its corrections (RegistryTable row expansion or a detail panel — Claude's discretion). Reuses the existing Registry surface (`RegistryTable.tsx`), not a new page.

### Researcher re-reads corrections (MEM-03)
- **D-08: The Researcher agent reads corrections** for the winning charity (Phase 2, per-charity), NOT the Scout. Before/while building research context, it queries `charity_corrections` by the winning charity's `dedupKey` (fallback `sanityCharityId`/name) and injects the corrections text into its prompt context so future research accounts for past corrections.
- **D-09: Match by dedupKey** — the registry's canonical case-folded key (`{name.trim().toLowerCase()}|{domain}`, Phase 26 §26.1), falling back to `sanityCharityId` then name, so a repeat mention of the same charity reliably finds its log.
- **D-10: Verifiable in pipeline output/logs.** The Researcher logs that it read the corrections (count + that they were injected into context) so a repeat-charity run demonstrably shows the re-read in pipeline logs/output (MEM-03's acceptance is "verifiable in pipeline output/logs for a repeat-charity run"). A test asserts the corrections reach the Researcher's context on a charity that has them.

### Claude's Discretion
- The exact coverage-strip visual (chip layout, color coding by cause/geo/signal within the 1c system); whether the last-8 join happens client-side (Convex charities + Sanity focusArea) or via a read endpoint.
- The `signal` source decision (D-03) after research; the exact `charity_corrections` field set + indexes; whether the write is a Convex mutation or a pipeline endpoint (match Phase 26 registry convention).
- The Registry correction UI (row expansion vs panel); the Researcher's corrections-injection prompt wording + where in the research flow it reads them.
- Whether corrections are also surfaced anywhere the winning charity appears beyond the Registry (not required).

### Folded Todos
None — no pending todos matched this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & roadmap
- `.planning/ROADMAP.md` §Phase 39 — goal + 3 success criteria.
- `.planning/REQUIREMENTS.md` — MEM-01, MEM-02, MEM-03 (REG-01/02 already done — do not re-touch).
- `.planning/PROJECT.md` §Current Milestone — locked v3.0 decisions.

### Design handoff (binding)
- `docs/design/dispatch-control-v2/README.md` §Registry — the coverage-memory strip (last-8 cause/geo/signal chips) + the corrections log affordance.
- `docs/design/dispatch-control-v2/Dispatch Control.dc.html` — 1c tokens for the chips.
- `docs/design/dispatch-control-v2/DECISIONS.md` — house rules ("nothing silent").

### Contract boundary (hard rule)
- `docs/API_CONTRACTS.md` — §26 covers the charity registry; amend BEFORE code for: the `charity_corrections` table + its append mutation/endpoint, and any coverage-strip read shape; note the Researcher's new corrections read.

### Existing code (build on these)
- `convex/schema.ts` — `charities` (~L367; the registry the strip + corrections attach to: dedupKey, status, lastFeaturedAt, sanityCharityId), `audit_log` (~L264; D-06 correction-append log). New `charity_corrections` table lands here (D-05).
- `convex/charities.ts` (registry queries/mutations — `listForDedup` etc.; the Phase 26 mutation pattern D-06 matches) + `convex/auditLog.ts`.
- `apps/dispatch-control/app/(dashboard)/registry/page.tsx` + `_components/` (`RegistryTable.tsx`, `AddCharityDialog.tsx`, `CharityStatusBadge.tsx`) — the strip mounts on the page (D-01); the corrections UI extends RegistryTable (D-07).
- `packages/pipeline/src/eisenbalm_pipeline/agents/scout.py` — `_load_registry_keys` / `charities:listForDedup` (the registry-read precedent D-08 mirrors for corrections; Scout does dedup, Researcher does corrections).
- `packages/pipeline/src/eisenbalm_pipeline/agents/researcher.py` — where the corrections read + injection + logging land (D-08/D-10); it already receives `state['winning_charity']` with the charity identity to match on (D-09).
- `packages/pipeline/src/eisenbalm_pipeline/lib/convex_client.py` — the pipeline's Convex HTTP read path for the corrections query.
- Sanity charity schema (`focusArea`, `location`) — the cause/geo chip source (D-02); confirm the field names in the Sanity schema during research.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Charity registry exists** — `charities` table + Registry page + RegistryTable (Phase 26); the strip and corrections attach to it, no new registry.
- **Pipeline reads Convex already** — Scout's `_load_registry_keys` (`charities:listForDedup`) proves the pipeline→Convex read path; the Researcher's corrections read (D-08) mirrors it.
- **Winning charity identity in state** — the Researcher already has `state['winning_charity']` (name/website/dedup basis) to match corrections on (D-09).
- **Audit infra** — `audit_log` + `_emit_audit` cover the correction-append log (D-06).
- **dedupKey is the canonical join key** — Phase 26's case-folded `{name|domain}` key ties corrections, the registry, and the Researcher's lookup together (D-09).

### Established Patterns
- Contract-first: amend `docs/API_CONTRACTS.md` before the corrections table / mutation / endpoint.
- "Nothing silent": the correction append is audit-logged (D-06).
- Append-only as the durable record (audit_log / eval_scores precedent) — D-05.
- Convex reactivity: the strip + corrections list update live via `useQuery`.
- Pipeline→Convex reads via `convex_client.py` (Scout precedent).
- Run strict `pnpm --filter dispatch-control build` before declaring frontend work done.
- **Sequential-in-main-checkout execution** (Phases 36-38) — no worktrees; avoids the Phase 35 strand problem.

### Integration Points
- `registry/page.tsx` — the coverage strip (MEM-01) + corrections UI (MEM-02).
- New `charity_corrections` Convex table — written by the append mutation, read by the Registry + the Researcher.
- `researcher.py` — the corrections re-read + injection + verifiable log (MEM-03).
- `charities` + Sanity charity `focusArea`/`location` — the last-8 cause/geo chip source.

</code_context>

<specifics>
## Specific Ideas

- Design README §Registry is the north star: a coverage-memory strip of the last-8 cause/geo/signal chips + a per-charity corrections log.
- The phase goal's operative contrast — "a durable record of corrections to a charity that the Researcher ACTUALLY reuses" — is why MEM-03/D-10 requires the re-read to be verifiable in pipeline logs, not just stored: the loop must demonstrably close on a repeat-charity run.
- MEM-01's value is human pattern-spotting ("three housing causes in a row"), so D-04 keeps it a visual strip, not a computed diversity metric.
- The "signal" chip (D-03) must be grounded in real data or deferred — do not fabricate a signal taxonomy that isn't backed by a field/source.

</specifics>

<deferred>
## Deferred Ideas

- **Signal chip if no clean source exists** (D-03 option c) — ship cause+geo, defer signal to a follow-up rather than invent data.
- **Algorithmic coverage/diversity score** — considered, not chosen (D-04 keeps it visual); revisit if human scanning proves insufficient.
- **Auto-acting on corrections** (the Researcher rewriting based on corrections beyond normal incorporation) — out of scope; it reads + injects, the human still drives.
- **Corrections surfaced beyond the Registry** (e.g. on the issue page) — not required this phase.

### Reviewed Todos (not folded)
None — no pending todos matched this phase.

</deferred>

---

*Phase: 39-registry-coverage-memory-strip*
*Context gathered: 2026-07-09 via smart discuss (autonomous)*
