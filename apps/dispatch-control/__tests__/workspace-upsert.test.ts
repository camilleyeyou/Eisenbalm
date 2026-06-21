/**
 * AUTH-04 / CFG-05 seam — JIT user upsert + workspace seed tests.
 * Filled in Plan 21-02 when Convex mutations (workspace.ts, users.ts) land.
 *
 * Reference: 21-RESEARCH.md Pattern 6 (idempotent seed) + Pattern 7 (JIT upsert).
 * Pattern 6: seedEisenbalm — inserts workspaces row only if workspace_id='eisenbalm' absent.
 * Pattern 7: upsertCurrentUser — inserts users row keyed by ctx.auth.getUserIdentity().subject;
 *            patches lastSeenAt on subsequent calls.
 */
import { it } from 'vitest'

it.todo('upsertCurrentUser writes Clerk sub as clerkUserId')
it.todo('seedEisenbalm is idempotent on second call')
