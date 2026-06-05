import { describe, it, expect } from 'vitest'
import { generateUnsubscribeToken } from '@eisenbalm/emails'

describe('generateUnsubscribeToken (EMAIL-03)', () => {
  it('returns a 64-character hex string', () => {
    const token = generateUnsubscribeToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('two successive calls produce different tokens (collision-resistant)', () => {
    const a = generateUnsubscribeToken()
    const b = generateUnsubscribeToken()
    expect(a).not.toBe(b)
  })

  it('token length is exactly 64 characters', () => {
    const token = generateUnsubscribeToken()
    expect(token.length).toBe(64)
  })

  it('token contains only lowercase hex characters', () => {
    const token = generateUnsubscribeToken()
    expect(token).toMatch(/^[0-9a-f]+$/)
  })
})
