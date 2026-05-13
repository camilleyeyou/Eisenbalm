/**
 * ConvexClientProvider — 'use client' wrapper that mounts <ConvexProvider>.
 *
 * Mirrors Convex's official Next.js App Router pattern:
 *   https://docs.convex.dev/quickstart/nextjs
 *
 * Module-scope client construction (one ConvexReactClient per browser
 * session, one websocket per client). Do NOT instantiate inside the
 * component — re-creating per render leaks websockets.
 *
 * D-16: handle missing NEXT_PUBLIC_CONVEX_URL gracefully so Vercel preview
 * builds without Convex env still pass. Pattern mirrors
 * apps/web/lib/sanity/client.ts (Phase 2) — log + soft-fail rather than
 * throw at module load.
 *
 * Phase 9 will introduce <Suspense> boundaries around the actual
 * <DeliberationSlot> subscription. Phase 3 has no consuming UI yet other
 * than /_debug/convex (Plan 03-06).
 */
'use client'

import { ConvexProvider, ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL

if (!convexUrl) {
  // Log once at module init when env is missing. Mirrors the
  // console.error in apps/web/lib/sanity/client.ts for SANITY_PROJECT_ID.
  console.error(
    '[convex] NEXT_PUBLIC_CONVEX_URL is not set. ' +
      'Copy apps/web/.env.example to apps/web/.env.local and run ' +
      '`pnpm --filter @eisenbalm/convex exec convex dev --once --configure` ' +
      'to provision a deployment. The app will render without Convex ' +
      'subscriptions until this is set.',
  )
}

// Module-scope: one client per browser session. When the env var is missing
// we skip client construction entirely (D-16) and render children without a
// provider — any descendant calling useQuery will throw with a clear
// "no provider" message, which is the correct loud failure in dev.
const convex = convexUrl ? new ConvexReactClient(convexUrl) : null

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    return <>{children}</>
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>
}
