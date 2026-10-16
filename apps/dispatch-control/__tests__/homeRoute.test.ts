/**
 * Phase 52 Plan 04 — route ownership: exactly one page.tsx owns `/`, and the
 * old console entry points still resolve (two groups owning `/` broke a
 * Vercel build once, 1430b98f).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const APP = path.resolve(__dirname, '../app')

describe('homeRoute', () => {
  it('the editorial group owns /', () => {
    expect(existsSync(path.join(APP, '(editorial)/page.tsx'))).toBe(true)
    expect(existsSync(path.join(APP, '(dashboard)/page.tsx'))).toBe(false)
    expect(existsSync(path.join(APP, 'page.tsx'))).toBe(false)
  })

  it('exactly one route-group page.tsx sits at the root', () => {
    const owners = readdirSync(APP)
      .filter((d) => /^\(.+\)$/.test(d) && statSync(path.join(APP, d)).isDirectory())
      .filter((d) => existsSync(path.join(APP, d, 'page.tsx')))
    expect(owners).toEqual(['(editorial)'])
  })

  it.each([
    '(dashboard)/run/page.tsx',
    '(dashboard)/issues/page.tsx',
    '(dashboard)/issues/[issueNumber]/approval/page.tsx',
    '(dashboard)/my-tasks/page.tsx',
    '(dashboard)/review-desk/page.tsx',
    '(editorial)/s/[section]/page.tsx',
  ])('%s still exists', (rel) => {
    expect(existsSync(path.join(APP, rel))).toBe(true)
  })

  it('the entry is a dynamic server component', () => {
    const src = readFileSync(path.join(APP, '(editorial)/page.tsx'), 'utf8')
    expect(src).toContain('force-dynamic')
    expect(src).not.toContain("'use client'")
  })
})
