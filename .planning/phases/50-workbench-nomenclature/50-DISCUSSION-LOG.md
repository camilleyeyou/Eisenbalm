# Phase 50: Workbench & Nomenclature - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 50-workbench-nomenclature
**Mode:** discuss (`--auto` — all gray areas auto-selected, recommended default chosen per area)
**Areas discussed:** Rename mechanics · Nav split + role indicator · Run Details steps/diamonds · Failed-run recovery rail · Agent Instructions bridge + copy · Automation toggle + typed confirmation

---

## A. Rename mechanics — display vs routes vs data

| Option | Description | Selected |
|--------|-------------|----------|
| Copy/labels/headings only | Rename operator-facing strings; keep route paths + stored enum values + node ids | ✓ |
| Rename routes + redirects | Also rename `/run-monitor`→`/run-details` etc. with redirects | |
| Migrate stored values too | Also rename `blocklisted`→`do-not-use` in schema/data/contract | |

**Auto-selected:** Copy-only. Route paths and stored values (`blocklisted`, node ids, `charity.blocklisted` audit action) stay unchanged. **Grounding:** `charities.status` is a free `v.string()` and `'blocklisted'` is load-bearing across the Scout dedup read, API_CONTRACTS §43, and existing data — a value rename would be a cross-cutting migration for a cosmetic change; URLs aren't "operator-facing copy." → D-01, D-02, D-03.

## B. Two-group nav + role indicator + label source of truth (WBN-01)

| Option | Description | Selected |
|--------|-------------|----------|
| Rename labels + add role indicator + central label module | Keep existing NAV_GROUPS, rename 4 Workbench items+headings, add net-new role text via `useRole()`, one nomenclature source | ✓ |
| Rebuild the nav grouping | Restructure NAV_GROUPS from scratch | |
| Labels only, skip role indicator | Rename items but defer the "signed-in role shown" requirement | |

**Auto-selected:** The Editorial/System Workbench grouping already exists in `lib/nav.ts`; rename the 4 labels + headings, ensure visible distinctness, add the net-new role indicator (bottom-left, from Phase 49 `useRole()`), and introduce one shared nomenclature label source (extending the `agentList.ts` precedent). → D-04, D-05, D-06.

## C. Run Details — action-named steps + diamonds + framing (WBN-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Action-name map (§7) + diamond reconcile + historical/live header | Primary=action, agent=secondary; add `verify_candidates` to diamonds; fix stale legend; "historical record vs live run" header | ✓ |
| Keep agent-identity labels | Leave `toDisplayName()`/raw `agentKey` as-is | |
| Action names but no diamond/framing change | Rename steps only, skip diamond + header work | |

**Auto-selected:** Full §7 treatment — a single action-name map replacing `toDisplayName()`/raw `agentKey`, agent as secondary metadata; reconcile the `GATE_KEYS` diamond set to the live 20-node graph (add `verify_candidates`, fix the "three deterministic checks" stale copy); header states historical-record vs live-run, never "Monitor" when idle. → D-07, D-08, D-09.

## D. Failed-run recovery rail (WBN-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Real rail + reuse existing rerun/resume for Restart | 4-part explanation + Skipped dimming + "Improve this agent"; "Restart from this step" binds to `rerun_agent`/resume; research confirms reuse-completed semantics | ✓ |
| Build a new arbitrary-node checkpoint-resume engine | Net-new resume-from-any-failed-node infra | |
| Narrative-only rail | Render the copy without wiring Restart | |

**Auto-selected:** Build the rail as a real affordance (explanation + downstream "Skipped" dimming + "Improve this agent" deep-link); "Restart from this step" reuses existing primitives, no new resume engine. Research target: what reuse-from-node the AsyncPostgresSaver checkpointer already provides vs. per-node re-run only. → D-10, D-11, D-12.

## E. Agent Instructions "why this draft exists" + Quality Tests copy (WBN-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Stored origin ref via "Improve this agent" + copy rename, gate wiring unchanged | Draft carries a back-reference to the motivating issue output; additive field only if none exists (contract-first); Prompt Lab/Eval Center copy renamed | ✓ |
| Infer the motivating output post-hoc | Derive the bridge instead of storing it | |
| Rebuild the eval/activate gate while renaming | Touch gate wiring during the copy pass | |

**Auto-selected:** "Why this draft exists" renders a stored origin back-reference carried through the inspector's "Improve this agent →" (additive field only if absent, contract-first). Apply nomenclature to copy (shadow run→Preview next run, golden scenario→Standard test case, eval→Quality test/Test changes, commit→Make active, rollback→Restore version); Phase 38 commit gate + activate wiring stay byte-unchanged (reconciliation fact: do not rebuild the eval commit gate). → D-13, D-14.

## F. Automation toggle relocation + typed-confirmation scope (WBN-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Typed-confirm = Do-not-use only; reword operator surface; toggle stays in Config | Verify publish is clean; Masthead/banner → "Human approval required"; no new Administration screen | ✓ |
| Build a dedicated Administration screen | Move the toggle to a new admin surface this phase | |
| Keep the auto-publish switch on the operator surface | Leave Masthead chip/banner switch framing | |

**Auto-selected:** Typed confirmation reserved for Mark Do-not-use (verify Publish carries none — Phase 34 reversal is locked); reword the Masthead "Auto-publish ON" chip + `AutoPublishBanner` to the "Human approval required" register (OFF case already done in Phase 40); the toggle stays in Config/Operations as the admin home — no new Administration screen. → D-15, D-16.

## Claude's Discretion
- Shared nomenclature module structure + how far to consolidate duplicated label maps.
- Final diamond-set membership against live topology; recovery-rail layout; which primitive "Restart from this step" binds to (pending research).
- Origin-ref field shape (contract-first); whether to relabel "Config"→"Administration".

## Deferred Ideas
- Route/URL renames + redirects; stored enum/node-id/audit-action renames; full label-map de-dup; a dedicated Administration screen; a net-new arbitrary-node checkpoint-resume engine.
