'use client'
// Source: https://docs.convex.dev/auth/clerk
// Note: useAuth is imported from @clerk/nextjs — NOT from @clerk/clerk-react (Pitfall 3).
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useAuth } from '@clerk/nextjs'

/**
 * One ConvexReactClient instance per browser session.
 * Module-scope construction prevents per-render websocket leaks.
 *
 * D-16 fallback (mirrors apps/web ConvexClientProvider): if
 * NEXT_PUBLIC_CONVEX_URL is missing (CI build without env vars set),
 * render children unwrapped so the build succeeds. The app will not
 * function without a real URL — this is only a build-time guard.
 */
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

// Conditionally construct client (avoids "No address provided" error in CI).
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

export default function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  // No URL configured — render children unwrapped (build-time passthrough).
  if (!convex) {
    return <>{children}</>
  }

  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
