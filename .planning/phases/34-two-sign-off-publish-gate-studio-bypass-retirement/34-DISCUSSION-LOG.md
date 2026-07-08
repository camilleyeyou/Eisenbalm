# Phase 34: Two-Sign-Off Publish Gate + Studio Bypass Retirement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-08
**Phase:** 34-two-sign-off-publish-gate-studio-bypass-retirement
**Areas discussed:** Sign-off model & semantics, "Sounds human" before Phase 36, Bypass & invalidation behavior, Studio retirement & soak

---

## Sign-off model & semantics

### Q: Is "Facts cleared" an explicit operator action or derived from existing gates?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit, prerequisite-gated | Deliberate sign-off button, enabled only once claims checked + no open error findings; server-enforced prerequisites | ✓ |
| Fully derived | Computed from claims + findings state; no button, no attestation moment | |
| Explicit, ungated | Sign any time; claims/findings 409s stay parallel | |

### Q: How should sign-offs be stored?

| Option | Description | Selected |
|--------|-------------|----------|
| New sign_offs table | `{runId, kind, actor, signedAt, revokedAt?}`; audit-shaped, Phase 36 writes same table | ✓ |
| Fields on runs | Timestamps on runs table; history lost on re-sign | |

### Q: Should there be an override path (publish despite a missing sign-off)?

| Option | Description | Selected |
|--------|-------------|----------|
| No override | DECISIONS.md "Neither can be skipped"; forcing = signing both yourself | ✓ |
| Break-glass override | Publish-with-typed-reason, loudly audit-logged | |

### Q: Do the existing claims-signoff and error-findings 409s stay as separate publish gates?

| Option | Description | Selected |
|--------|-------------|----------|
| Fold into prerequisites | Publish checks the two sign-offs only; claims + findings gate the recording of "Facts cleared" | ✓ |
| Keep all gates stacked | 4 independent 409 paths at publish | |

---

## "Sounds human" before Phase 36

### Q: Where does Andrew record "Sounds human" before the Voice Pass screen exists?

| Option | Description | Selected |
|--------|-------------|----------|
| Attestation in DecisionRail | Second sign-off control next to "Facts cleared"; Phase 36 upgrades in place | ✓ |
| Stub /voice-pass route | Mostly-empty page with only the sign-off | |

### Q: Should the interim "Sounds human" sign-off have any prerequisite?

| Option | Description | Selected |
|--------|-------------|----------|
| Ungated attestation | Nothing machine-checkable for voice until Phase 36; independent green | ✓ |
| Require Facts cleared first | Forced ordering mirroring workflow order | |

---

## Bypass & invalidation behavior

### Q: When the webhook fires without both sign-offs recorded (Studio flip), what happens?

| Option | Description | Selected |
|--------|-------------|----------|
| Block + revert + alert | Skip publisher, revert Sanity status to in-review, audit row, alert event | ✓ |
| Block + log only | Leave Sanity status as 'published' (inconsistent) | |
| Block + revert silently | No alert event | |

### Q: Should sign-offs invalidate when content changes after signing?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-revoke on mutation | Every content-mutating pipeline endpoint revokes active sign-offs, audit row each | ✓ |
| Revision check at publish | Passive; stale state surfaces only at Publish click | |
| Sign-offs persist | Defeats the gate | |

### Q: How should sign-offs interact with scheduled publishes (hourly tick)?

| Option | Description | Selected |
|--------|-------------|----------|
| Check at both ends | Gate at schedule time; webhook re-check covers fire time | ✓ |
| Schedule-time only | Edits between schedule and fire could ship unreviewed | |

---

## Studio retirement & soak

### Q: How should the Studio publish-action disable be implemented and timed?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship now behind a flag | Document-action override built this phase, env flag default OFF during soak | ✓ |
| Disable immediately, no soak | Bolder; loses emergency fallback | |
| Document only, code later | Risk it never happens | |

### Q: What ends the soak period?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual, criterion documented | e.g. 2–3 consecutive console-only weekly issues; Andrew flips the flag | ✓ |
| Automatic counter | Auto-disable after N console publishes | |

### Q: Does the retirement touch Studio editing, or only the publish path?

| Option | Description | Selected |
|--------|-------------|----------|
| Publish only | Editing stays as emergency fallback; docs state console is surface of record | ✓ |
| Publish + edit warnings | Banner on weeklyIssue docs warning edits bypass audit trail | |

---

## Claude's Discretion

- Exact `sign_offs` table shape, indexes, and sign-off/revoke endpoint shapes (contract-first).
- Webhook run-lookup + revert idempotency mechanics against the legit publish path.
- Rail sign-off control UX within the 1c design system (affirmative states, never blank).
- Which mutation endpoints trigger revocation and whether both kinds are cleared (recommend: both).
- 409 detail granularity (enumerate missing sign-offs or not).
- Env flag name and `document.actions` resolver implementation.

## Deferred Ideas

- Voice Pass machine-tell screen — Phase 36 (upgrades the attestation in place).
- Source-bound claims prerequisite upgrade — Phase 35.
- Studio editing lockdown / full Sanity removal — follow-up milestone.
- Automatic soak counter — considered, not chosen.
- Break-glass override — considered, not chosen; revisit only after a real incident.
