'use client'
// Source: https://docs.convex.dev/auth/clerk
// Note: useAuth is imported from @clerk/nextjs — NOT from @clerk/clerk-react (Pitfall 3).
import { ConvexReactClient } from 'convex/react'
import { ConvexProviderWithClerk } from 'convex/react-clerk'
import { useAuth } from '@clerk/nextjs'

/**
 * One ConvexReactClient instance per browser session.
 * Module-scope construction prevents per-render websocket leaks.
 */
const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!)

export default function ConvexClientProvider({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      {children}
    </ConvexProviderWithClerk>
  )
}
