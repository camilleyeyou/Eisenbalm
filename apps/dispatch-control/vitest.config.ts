import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  esbuild: {
    // Use automatic React JSX transform so tests don't need 'import React from "react"'
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    globals: false,
    reporters: ['default'],
    // Per-file environment overrides:
    //   - edge-runtime: convex-test integration tests (Plan 23-01)
    //   - jsdom: React component tests (Plan 23-03)
    //   - default (node): everything else
    environmentMatchGlobs: [
      // convex-test requires edge-runtime
      ['__tests__/agentRuns.test.ts', 'edge-runtime'],
      ['__tests__/auditLog.test.ts', 'edge-runtime'],
      // React component tests require jsdom
      ['__tests__/*.test.tsx', 'jsdom'],
    ],
  },
})
