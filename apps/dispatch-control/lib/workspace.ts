/**
 * Workspace constant for the Dispatch Control dashboard.
 *
 * D-16: "eisenbalm" lives ONLY here (as a constant) and in seeded Convex data.
 * No other control-plane code should hardcode the slug.
 *
 * Phase 28: getCurrentWorkspace() will derive the slug from the Clerk org claim
 * to support multi-tenant workspaces. For Phase 21 it always returns the
 * single-tenant constant.
 */
export const DEFAULT_WORKSPACE_ID = 'eisenbalm'

/**
 * Returns the workspace slug for the currently signed-in operator.
 * Phase 21: single-tenant — always returns DEFAULT_WORKSPACE_ID.
 * Phase 28: derive from Clerk session org slug.
 */
export async function getCurrentWorkspace(): Promise<string> {
  return DEFAULT_WORKSPACE_ID
}
