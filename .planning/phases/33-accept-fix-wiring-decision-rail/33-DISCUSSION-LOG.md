# Phase 33: Accept-Fix Wiring + Decision Rail - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-07
**Phase:** 33-accept-fix-wiring-decision-rail
**Areas discussed:** Finding lifecycle & dismiss, Accept-fix mechanics, Orphaned annotations UX, Decision rail composition

---

## Finding lifecycle & dismiss

### How should accept/dismiss state be modeled on qaCorrections?

| Option | Description | Selected |
|--------|-------------|----------|
| status enum (Recommended) | `resolution: 'accepted' \| 'dismissed'` (absent = open) + resolutionReason/resolvedBy/resolvedAt; legacy `accepted` kept in sync | ✓ |
| Parallel booleans | `dismissed` + `dismissedReason` beside `accepted`; two flags can contradict | |
| Separate resolutions table | Immutable findings + resolution-event table; every read needs a join | |

### Where does the accept/dismiss write go?

| Option | Description | Selected |
|--------|-------------|----------|
| Pipeline endpoint (Recommended) | POST /issues/{run_id}/findings/{id}/accept\|dismiss orchestrates patch + Convex flip + audit; matches Phase 26/31 pattern | ✓ |
| Split: patch + Convex mutation | Dashboard calls content-patch then a Convex mutation; two non-atomic writes, split audit story | |

### What happens visually to dismissed findings?

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden like accepted (Recommended) | Vanish from galley spans + chip counts (Phase 32 D-08 parity); history in audit log | ✓ |
| Ghosted in place | Faded/struck-through in galley; more context, more noise | |

### Can Andrew undo an accept or dismiss?

| Option | Description | Selected |
|--------|-------------|----------|
| Reopen action, no text revert (Recommended) | Reopen flips back to open (logged); text changes are re-edited manually | ✓ |
| No undo in v1 | Final actions; a mis-click loses the finding from the to-do surface | |
| Full undo incl. text revert | Reverse-patch from audit snapshot; unsafe (truncated snapshots, interleaved edits) | |

---

## Accept-fix mechanics

### How does Accept apply the suggested fix to the draft text?

| Option | Description | Selected |
|--------|-------------|----------|
| Span replace, server-resolved (Recommended) | Endpoint re-resolves quotedSpan (+hint) server-side, replaces exactly that span via Phase 31 scoped patch; 409 on ambiguity/failure | ✓ |
| Client sends resolved block | Dashboard sends whole edited block through section-patch; trusts stale client resolution | |

### What guards the accept against a stale draft?

| Option | Description | Selected |
|--------|-------------|----------|
| Revision guard, same as saves (Recommended) | Accept carries ifRevisionID; mismatch → 409, refetch + re-resolve, re-click | ✓ |
| Last-write-wins | Server applies against current; can compound on unseen edits | |

### When is Accept unavailable on a finding?

| Option | Description | Selected |
|--------|-------------|----------|
| No fix or no anchor (Recommended) | Accept hidden/disabled when suggestedFix absent OR finding unresolved/orphaned; popover says why | ✓ |
| Always shown, fails gracefully | Server rejects with reason; invites dead-end clicks | |

### What does 'Edit inline' do?

| Option | Description | Selected |
|--------|-------------|----------|
| Open section editor, prefilled (Recommended) | Jumps into Phase 31 section editor scrolled to the finding's block, reason visible; no new editor surface | ✓ |
| Micro-editor in the popover | Textarea in popover; a second editing surface with its own save path | |

---

## Orphaned annotations UX

### Should 'orphaned' be distinguished from 'unresolved'?

| Option | Description | Selected |
|--------|-------------|----------|
| One bucket, one card (Recommended) | Same state, same section-end card; stateless resolver can't reliably tell them apart | ✓ |
| Two distinct states | Persist resolution history to label orphans; breaks the stateless resolver | |

### Where do orphaned/unresolved findings surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Section card + rail rollup (Recommended) | Section-end card in context + rail lists unresolved with jump links | ✓ |
| Section card only | Rail only counts them; easy to scroll past | |
| Dedicated orphan queue | Separate rail panel; splits attention across three surfaces | |

### What actions do orphaned/unresolved findings get?

| Option | Description | Selected |
|--------|-------------|----------|
| Dismiss + Edit inline (Recommended) | Dismiss-with-reason + open section editor; no Accept (nothing to anchor) | ✓ |
| Dismiss only | Forces a detour to act on the underlying issue | |
| Add manual re-anchor | Selection UI to re-attach; a whole feature for a rare case | |

### Does an error-severity finding still block Publish when orphaned?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — still blocks (Recommended) | Blocks until explicitly accepted or dismissed; an edit must never silently clear a blocker | ✓ |
| No — orphans don't block | Risks an edit accidentally clearing the gate | |

---

## Decision rail composition

### What does the Hook card show given hookClaim/hookVerified don't exist until Phase 37?

| Option | Description | Selected |
|--------|-------------|----------|
| Charity card from pitchLog (Recommended) | Selected charity name + scoutSummary; Phase 37 upgrades in place | ✓ |
| Omit until Phase 37 | Rail wouldn't match the design spec | |
| Placeholder with empty state | Permanently-dead card for several cycles | |

### Where does the verification summary's 'checked Nm ago' come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Add checkedAt to claim_checks (Recommended) | `checkedAt: v.optional(v.number())` stamped on checked/skipped; legacy rows show "not yet checked" | ✓ |
| Use review_actions timestamps | Would lie about what was actually verified | |

### How is Publish blocked this phase (server sign-offs are Phase 34)?

| Option | Description | Selected |
|--------|-------------|----------|
| Client + server check now (Recommended) | Rail disables Publish + publish endpoint 409s on open error findings; Phase 34 layers sign-offs on top | ✓ |
| Client-side only this phase | "Blocks Publish" would be cosmetic for a cycle | |

### Which rail actions ship in Phase 33?

| Option | Description | Selected |
|--------|-------------|----------|
| All four, wired to existing (Recommended) | Publish (gated), Hold → reject flow, Re-run section ▾ → rerun_agent, Transcript → deliberation jump | ✓ |
| Publish + Hold only | Andrew leaves the Review Desk mid-review for re-runs | |
| Publish only | Leanest, least like the design | |

---

## Claude's Discretion

- Exact endpoint shapes/granularity (contract-first via API_CONTRACTS.md)
- Reopen as its own endpoint vs a transition parameter
- Server-side span resolution implementation (mirror the TS resolver's normalization; never-guess rule holds)
- Popover action-row layout, dismiss-reason input UX, optimistic-UI vs refetch
- Rail checklist micro-UX; estimated-minutes headline heuristic (may omit)
- How the rail counts info-severity findings
- Where the checkedAt stamp is written (ClaimsChecklist mutation)

## Deferred Ideas

- Two-sign-off gate + Studio bypass retirement → Phase 34
- hookClaim/hookVerified model → Phase 37
- Sourced/unsourced rail source index → Phase 35
- Manual re-anchor UI, distinct orphan states, full undo with text revert — considered, not chosen
