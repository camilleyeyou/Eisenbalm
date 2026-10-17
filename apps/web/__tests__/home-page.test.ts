/** Phase 55: home renders the latest issue front page (no redirect). Source-scan. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

const src = readFileSync(resolve(__dirname, '../app/page.tsx'), 'utf-8')

describe('app/page.tsx (home)', () => {
  it('does not redirect', () => {
    expect(src).not.toMatch(/redirect\(/)
    expect(src).not.toMatch(/import\s*\{[^}]*redirect[^}]*\}\s*from\s*'next\/navigation'/)
  })
  it('renders the shared IssueLayout with archive and balms', () => {
    expect(src).toContain('<IssueLayout')
    expect(src).toContain('QUERY_ARCHIVE')
    expect(src).toContain('fetchBalms')
  })
  it('canonical points at the latest issue URL', () => {
    expect(src).toContain('canonical')
    expect(src).toContain('/issue/')
  })
  it('has a dry empty state and ISR of 60s', () => {
    expect(src).toContain('EMPTY_HOME_HEADING')
    expect(src).toMatch(/revalidate = 60/)
  })
})
