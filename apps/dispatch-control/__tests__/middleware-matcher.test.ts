/**
 * AUTH-01 seam — middleware protection tests.
 * Filled in Plan 21-03 when @clerk/nextjs is installed.
 *
 * Reference: 21-RESEARCH.md Pattern 1 — clerkMiddleware + createRouteMatcher.
 * Pattern: isPublicRoute = createRouteMatcher(['/sign-in(.*)'])
 *          non-public routes → auth.protect() (auto-redirects to NEXT_PUBLIC_CLERK_SIGN_IN_URL)
 */
import { it } from 'vitest'

it.todo('clerkMiddleware protects all non-public routes')
it.todo('/sign-in is a public route')
