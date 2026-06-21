// apps/dispatch-control/middleware.ts
// Source: https://clerk.com/docs/references/nextjs/clerk-middleware
// Note: This is middleware.ts (Next.js 15), NOT proxy.ts (Next.js 16+).
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

/**
 * Public routes — everything else is protected.
 * Exported for use in unit tests (AUTH-01).
 */
export const isPublicRoute = createRouteMatcher(['/sign-in(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params.
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes.
    '/(api|trpc)(.*)',
    // Always run for Clerk internals.
    '/__clerk/(.*)',
  ],
}
