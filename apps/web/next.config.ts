import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Phase 29 (D-10): ESLint runs as an advisory step (`pnpm --filter web lint`),
  // NOT a build gate. `apps/web` accumulated ~29 phases of code before a lint
  // config existed; enforcing lint inside `next build` would hard-fail the
  // strict production build on pre-existing style. Keep the build green and
  // run lint separately in CI/dev.
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Phase 20: React Email packages must be treated as server externals.
  // @react-email/render uses Node.js streams internally; bundling it with
  // Next.js webpack/turbopack causes "X is not a function" errors at runtime.
  serverExternalPackages: ['@react-email/render', '@react-email/components'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io',
        pathname: '/images/**',
      },
    ],
  },
  experimental: {
    // Phase 2: no experimental features required.
  },
  // ─── Phase 26: per-route frame-ancestors CSP (Plan 26-04) ─────────────────
  // The draft-preview route is iframed by dispatch-control (D-09). Only this
  // route needs a frame-ancestors CSP. Public issue pages must NOT have one —
  // a site-wide frame-ancestors header would prevent any legitimate embeds
  // elsewhere (Pitfall 2 in 26-RESEARCH.md). Scoped to /issue/:slug/preview.
  async headers() {
    const origin = process.env.PREVIEW_ALLOWED_ORIGIN ?? "'self'"
    return [
      {
        source: '/issue/:slug/preview',
        headers: [
          { key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${origin}` },
        ],
      },
    ]
  },
}

export default nextConfig
