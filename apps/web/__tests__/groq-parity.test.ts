import { describe, it, expect } from 'vitest'
import { QUERY_ISSUE_BY_SLUG, QUERY_ISSUE_PREVIEW_BY_SLUG } from '@/lib/sanity/queries'

function normalise(q: string): string {
  return q
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('GROQ parity: published vs preview issue query', () => {
  const pub = normalise(QUERY_ISSUE_BY_SLUG)
  const prev = normalise(QUERY_ISSUE_PREVIEW_BY_SLUG)

  it('are identical except the status filter', () => {
    expect(pub.replace(' && status == "published"', '')).toBe(prev)
  })

  it.each([pub, prev])('project the Phase 55 fields', (q) => {
    expect(q).toContain('editorConfidence')
    expect(q).toContain('frontPage {')
    expect(q).toContain('"keyDataPoints": pdfContent.keyDataPoints[]')
    expect(q).toContain('heroImage.alt')
  })

  it.each([pub, prev])('keeps the narrator projection minimal', (q) => {
    expect(q).toContain('narrator-> { name, "slug": slug.current, active, }')
  })
})
