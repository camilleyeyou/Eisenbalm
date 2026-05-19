/**
 * CMR-07 + CMR-08 — legal pages exist (no 404).
 *
 * Asserts that /legal/privacy and /legal/terms have page.tsx files that
 * compile and export a default React component. Content quality is
 * Andrew's call (placeholders with TODO(Andrew) are acceptable for v1);
 * this test only enforces the existence + shape contract.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, it, expect } from 'vitest'

const PRIVACY_PATH = resolve(__dirname, '../app/legal/privacy/page.tsx')
const TERMS_PATH = resolve(__dirname, '../app/legal/terms/page.tsx')

describe('CMR-07: /legal/privacy page exists', () => {
  it('privacy page file exists at the expected path', () => {
    expect(existsSync(PRIVACY_PATH)).toBe(true)
  })

  it('privacy page exports a default React component', () => {
    const source = readFileSync(PRIVACY_PATH, 'utf8')
    expect(source).toMatch(/export\s+default\s+function/)
  })
})

describe('CMR-08: /legal/terms page exists', () => {
  it('terms page file exists at the expected path', () => {
    expect(existsSync(TERMS_PATH)).toBe(true)
  })

  it('terms page exports a default React component', () => {
    const source = readFileSync(TERMS_PATH, 'utf8')
    expect(source).toMatch(/export\s+default\s+function/)
  })
})
