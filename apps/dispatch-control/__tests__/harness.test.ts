/**
 * Wave 0 sanity test — proves vitest + path aliases work.
 * Must pass immediately (no todo).
 */
import { describe, it, expect } from 'vitest'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'

describe('test harness', () => {
  it('DEFAULT_WORKSPACE_ID is eisenbalm', () => {
    expect(DEFAULT_WORKSPACE_ID).toBe('eisenbalm')
  })
})
