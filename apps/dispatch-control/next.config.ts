import type { NextConfig } from 'next'

/**
 * Quick 261021-j83 (D-9) — every old console URL lands somewhere live.
 * All redirects are temporary (307, `permanent: false`) and point DIRECTLY at
 * the final page (no redirect chains). Specific sources come before
 * catch-alls: Next matches the first rule that fits.
 */
const REDIRECTS = [
  // ── Pre-v3.0 names (Phase 30), retargeted straight to /admin/* ──────────
  { source: '/graph', destination: '/admin/runs/graph' },
  { source: '/graph/:path*', destination: '/admin/runs/graph' },
  { source: '/runs', destination: '/admin/runs' },
  { source: '/runs/:runId', destination: '/admin/runs/:runId' },
  { source: '/prompts', destination: '/admin/agents' },
  { source: '/prompts/:path*', destination: '/admin/agents/:path*' },

  // ── Issue console → front door / archive ────────────────────────────────
  { source: '/issues', destination: '/archive' },
  { source: '/issues/:n/runs/:runId', destination: '/admin/runs/:runId' },
  { source: '/issues/:n', destination: '/' },
  { source: '/issues/:n/:path*', destination: '/' },

  // ── Retired surfaces → front door ───────────────────────────────────────
  { source: '/run', destination: '/' },
  { source: '/my-tasks', destination: '/' },
  { source: '/how-to-use', destination: '/' },
  { source: '/review-desk', destination: '/' },
  { source: '/review-desk/:path*', destination: '/' },
  { source: '/voice-pass', destination: '/' },
  { source: '/voice-pass/:path*', destination: '/' },
  { source: '/signal-desk', destination: '/' },
  { source: '/story-brief', destination: '/' },
  { source: '/story-brief/:path*', destination: '/' },

  // ── Run Monitor → /admin/runs (review sub-route first) ──────────────────
  { source: '/run-monitor', destination: '/admin/runs' },
  { source: '/run-monitor/runs', destination: '/admin/runs' },
  { source: '/run-monitor/runs/:runId/review', destination: '/admin/runs/:runId' },
  { source: '/run-monitor/runs/:runId', destination: '/admin/runs/:runId' },
  { source: '/run-monitor/graph', destination: '/admin/runs/graph' },

  // ── Workbench + operations pages → /admin/* ─────────────────────────────
  { source: '/prompt-lab', destination: '/admin/agents' },
  { source: '/prompt-lab/:agentKey', destination: '/admin/agents/:agentKey' },
  { source: '/eval-center', destination: '/admin/tests' },
  { source: '/registry', destination: '/admin/charities' },
  { source: '/config', destination: '/admin/automation' },
  { source: '/finance', destination: '/admin/finance' },
  { source: '/settings', destination: '/admin/settings' },
] as const

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Phase 21: no experimental features required at scaffold stage.
  },
  async redirects() {
    return REDIRECTS.map(r => ({ ...r, permanent: false as const }))
  },
}

export default nextConfig
