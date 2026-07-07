import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Phase 21: no experimental features required at scaffold stage.
  },
  // Phase 30 (D-03): permanent redirects from the pre-v3.0 route names to
  // their final v3.0 homes so no bookmarked/linked old path 404s.
  async redirects() {
    return [
      { source: '/graph', destination: '/run-monitor/graph', permanent: true },
      { source: '/graph/:path*', destination: '/run-monitor/graph/:path*', permanent: true },
      { source: '/runs', destination: '/run-monitor/runs', permanent: true },
      { source: '/runs/:path*', destination: '/run-monitor/runs/:path*', permanent: true },
      { source: '/prompts', destination: '/prompt-lab', permanent: true },
      { source: '/prompts/:path*', destination: '/prompt-lab/:path*', permanent: true },
    ]
  },
}

export default nextConfig
