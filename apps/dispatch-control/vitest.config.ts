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
    // Phase 24: register `.ts`/`.tsx` in Node's Module._extensions so the Wave 0
    // RED scaffold tests can resolve the new prompts components via an
    // extension-less runtime require() of relative TypeScript source. Without
    // this, vitest's CJS executor (createRequire().resolve) only searches
    // `.js`/`.json`/`.node` and the require falls into the RED catch branch.
    setupFiles: ['./__tests__/registerTsRequire.ts'],
    // Per-file environment overrides:
    //   - edge-runtime: convex-test integration tests (Plan 23-01)
    //   - jsdom: React component tests (Plan 23-03)
    //   - default (node): everything else
    environmentMatchGlobs: [
      // convex-test requires edge-runtime
      ['__tests__/agentRuns.test.ts', 'edge-runtime'],
      ['__tests__/auditLog.test.ts', 'edge-runtime'],
      ['__tests__/runs.test.ts', 'edge-runtime'],
      ['__tests__/auditViewer.test.ts', 'edge-runtime'],
      // Phase 24 prompt-versioning convex-test files
      ['__tests__/saveVersion.test.ts', 'edge-runtime'],
      ['__tests__/activate.test.ts', 'edge-runtime'],
      // React component tests require jsdom
      ['__tests__/*.test.tsx', 'jsdom'],
    ],
  },
})
