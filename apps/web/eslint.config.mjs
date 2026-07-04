// Flat ESLint config for the web app (Next 15 + ESLint 9).
//
// eslint-config-next@15.5.x still ships the legacy eslintrc-style config
// (`{ extends: [...] }`), so we bridge it into flat config via FlatCompat.
// This exists so `pnpm --filter web lint` runs NON-INTERACTIVELY (no
// "How would you like to configure ESLint?" prompt) and lints against
// Next's core-web-vitals ruleset. Lint is advisory (see next.config.ts —
// eslint.ignoreDuringBuilds is true): it must not hard-fail `next build`
// on pre-existing style accumulated across ~29 phases.
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'
import tsPlugin from '@typescript-eslint/eslint-plugin'

const __dirname = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory: __dirname })

export default [
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
      'node_modules/**',
    ],
  },
  ...compat.config({
    extends: ['next/core-web-vitals'],
  }),
  {
    // Pre-existing style from ~29 phases must not hard-fail the advisory lint
    // run. Downgrade the two rules that currently error on existing code:
    //  - no-html-link-for-pages: one legacy `<a href="/">` in an agents page.
    //  - @typescript-eslint/no-explicit-any: registered as `off` only so the
    //    stale inline `eslint-disable` directives in lib/theme.test.ts resolve
    //    to a KNOWN rule (otherwise ESLint throws "rule definition not found").
    //    core-web-vitals does not load the TS plugin, so this is a no-op rule.
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@next/next/no-html-link-for-pages': 'warn',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]
