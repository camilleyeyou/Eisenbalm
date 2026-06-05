import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
}

export default nextConfig
