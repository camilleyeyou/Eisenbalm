import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  esbuild: {
    // Use automatic React JSX transform so .test.tsx files don't need
    // 'import React from "react"'. Mirrors apps/dispatch-control's config.
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts', '__tests__/**/*.test.tsx'],
    globals: false,
    reporters: ['default'],
    // Source-scan tests (readFileSync, no DOM) stay on the default 'node'
    // environment. React component tests need jsdom (Phase 29 D-9 adds
    // the first one: buy-button.test.tsx).
    environmentMatchGlobs: [
      ['__tests__/*.test.tsx', 'jsdom'],
    ],
  },
})
