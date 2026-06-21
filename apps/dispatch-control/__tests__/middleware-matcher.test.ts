/**
 * AUTH-01 — middleware route-protection unit tests.
 *
 * Tests the exported `isPublicRoute` matcher from middleware.ts.
 * Asserts that /sign-in is public and all dashboard routes are protected.
 *
 * Reference: 21-RESEARCH.md Pattern 1 — clerkMiddleware + createRouteMatcher.
 * Pattern: isPublicRoute = createRouteMatcher(['/sign-in(.*)'])
 *          non-public routes → auth.protect() (auto-redirects to NEXT_PUBLIC_CLERK_SIGN_IN_URL)
 */
import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { isPublicRoute } from '../middleware'

/**
 * Build a minimal NextRequest for the given pathname.
 * The base URL is irrelevant — only the pathname matters for route matching.
 */
function makeReq(pathname: string): NextRequest {
  return new NextRequest(new URL(pathname, 'http://localhost:3001'))
}

describe('AUTH-01 — middleware route protection', () => {
  describe('public routes (isPublicRoute returns true)', () => {
    it('/sign-in is a public route', () => {
      expect(isPublicRoute(makeReq('/sign-in'))).toBe(true)
    })

    it('/sign-in/factor-one is a public route (catch-all)', () => {
      expect(isPublicRoute(makeReq('/sign-in/factor-one'))).toBe(true)
    })

    it('/sign-in/factor-two is a public route (catch-all)', () => {
      expect(isPublicRoute(makeReq('/sign-in/factor-two'))).toBe(true)
    })
  })

  describe('protected routes (isPublicRoute returns false)', () => {
    it('/ (root) is NOT a public route', () => {
      expect(isPublicRoute(makeReq('/'))).toBe(false)
    })

    it('/graph is NOT a public route', () => {
      expect(isPublicRoute(makeReq('/graph'))).toBe(false)
    })

    it('/runs is NOT a public route', () => {
      expect(isPublicRoute(makeReq('/runs'))).toBe(false)
    })

    it('/config is NOT a public route', () => {
      expect(isPublicRoute(makeReq('/config'))).toBe(false)
    })

    it('/prompts is NOT a public route', () => {
      expect(isPublicRoute(makeReq('/prompts'))).toBe(false)
    })

    it('/settings is NOT a public route', () => {
      expect(isPublicRoute(makeReq('/settings'))).toBe(false)
    })
  })
})
