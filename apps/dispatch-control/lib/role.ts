'use client'
/**
 * Phase 49 (ROL-03) Plan 49-06 — presentation-only role hook.
 *
 * D-11: this hook is a CLIENT HINT for rendering only. The server dependency
 * (`_require_editor` in FastAPI, `requireEditor` in Convex — Plans 49-03/49-04)
 * is the authoritative gate; nothing here is a security boundary. Callers must
 * never treat this hook's return value as proof of authorization.
 */
import { useUser } from '@clerk/nextjs'

export type Role = 'Editor-in-chief' | 'Collaborator'

/**
 * Presentation-only (D-11). The server dependency (_require_editor /
 * requireEditor) is the authoritative gate; this hook only decides which
 * of two render branches LockedControl shows. Returns undefined while Clerk
 * is still loading — callers must NOT treat undefined as Collaborator (that
 * would flash a lock for an editor mid-load).
 */
export function useRole(): Role | undefined {
  const { user, isLoaded } = useUser()
  if (!isLoaded) return undefined
  const role = user?.publicMetadata?.role
  return role === 'Editor-in-chief' || role === 'Collaborator' ? role : undefined
}

/** Convenience: true only when we KNOW the user is an editor. */
export function useIsEditor(): boolean {
  return useRole() === 'Editor-in-chief'
}
