import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    globals: false,
    reporters: ['default'],
    // convex-test requires the edge-runtime environment for Convex integration tests
    environmentMatchGlobs: [
      ['__tests__/agentRuns.test.ts', 'edge-runtime'],
      ['__tests__/auditLog.test.ts', 'edge-runtime'],
    ],
  },
})
