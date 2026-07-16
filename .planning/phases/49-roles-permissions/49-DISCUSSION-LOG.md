# Phase 49: Roles & Permissions - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-16
**Phase:** 49-roles-permissions
**Mode:** discuss `--auto` (all gray areas selected; recommended default chosen for each — no interactive prompts)
**Areas discussed:** Role model & source of truth, Server-side enforcement, Locked-control rendering, Comment capability, Role assignment/management

---

## Role model & source of truth

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse existing `users.role`, migrate vocab to Editor-in-chief/Collaborator, read role from Clerk publicMetadata claim | No second role field; Clerk is identity source; both backends read the claim | ✓ |
| New dedicated roles table + membership rows | More flexible, heavier; unnecessary for two flat roles | |
| Hardcoded allowlist of editor Clerk IDs | Simplest, but no self-serve assignment and brittle | |

**Auto-selected:** Reuse `users.role` (repurpose vocab), Clerk publicMetadata claim as the authoritative read on both backends. Local-dev sentinel → Editor-in-chief.
**Notes:** Codebase map showed `users.role` exists but is never written/read and `upsertCurrentUser` runs only in tests — so the Clerk claim (not the table) must be the live source unless the JIT upsert is activated. Two roles only per spec §6.

## Server-side enforcement (ROL-01/ROL-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Enforce in both surfaces: FastAPI `_require_editor` dep (4 actions) + Convex `requireEditor(ctx)` helper (2 actions) | Matches the actual split of the six handlers; additive to existing Clerk auth | ✓ |
| Route the 2 Convex actions through FastAPI so enforcement is single-surface | Consolidates gating but rewrites working mutations + adds a hop | |
| Client-only gating | Rejected outright — fails SC-1 (direct API call must be rejected) | |

**Auto-selected:** Enforce in both surfaces. FastAPI returns `403 {reason:"forbidden_role"}`; Convex throws `ConvexError`. Exactly six actions, no audit row for denials.
**Notes:** The six actions split 4 FastAPI (`revision.py`, `factcheck.py:apply_claim_evidence`, `signoffs.py`, `review.py`) / 2 Convex (`promptVersions.activate`, `charities.setStatus`). Both Convex mutations already authenticate via `requireOperator` (ignoring client `actorId`) but do not check role — role is the only gap.

## Locked-control rendering (ROL-03)

| Option | Description | Selected |
|--------|-------------|----------|
| One reusable `<LockedControl>`/`RoleGate` wrapper; render disabled + verbatim §6 labels + visible adjacent explanation | Consistent, a11y-safe, reuses controls Phases 41/42/45/47 structured for wrapping | ✓ |
| Per-screen bespoke locked states | Duplicative, drift-prone | |
| Tooltip-only explanation | Fails accessibility; explanation must be visible | |

**Auto-selected:** Single reusable wrapper, exact §6 labels, visible explanation, never hidden. Client role via `useUser()` publicMetadata (presentation only).
**Notes:** Labels are verbatim from DERIVED-STATE-CONTRACT §6. Publish uses the sentence label, not the lock shorthand.

## Comment capability (ROL-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal uniform comments: one Convex `comments` table keyed to target ref, add/list for both roles, consistent affordance across workspace screens | Satisfies "read + comment" without a heavy discussion system | ✓ |
| Full threaded comments with @mentions + notifications | Scope creep; own phase | |
| No comments (interpret ROL-04 as read-only) | Violates ROL-04 ("read everything and comment") | |

**Auto-selected:** Minimal uniform comment capability, flagged as the primary research target (no infra exists today).
**Notes:** Zero comment infrastructure exists — this is the phase's largest greenfield unknown. Threading/mentions/notifications deferred.

## Role assignment / management

| Option | Description | Selected |
|--------|-------------|----------|
| No assignment UI — roles set via Clerk publicMetadata out-of-band | Keeps phase focused on enforcement; admin surface is Phase 50 (Administration) | ✓ |
| Build a role-management screen this phase | Not in success criteria; belongs in Administration | |

**Auto-selected:** No assignment UI in Phase 49 (Claude's discretion / deferred).

## Claude's Discretion

- Exact `_require_editor` / `requireEditor` naming, the 403 reason-code string, and comment-affordance placement/anchor granularity.
- No role-assignment UI (D-14).

## Deferred Ideas

- `blocklisted` → "Do not use" rename + nav role-indicator / nomenclature ripple → Phase 50.
- Role-management / assignment UI → Administration (Phase 50).
- Threaded comments, @mentions, comment notifications → future.
- Auditing denied attempts → not built now.
