import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { jargonInSource } from './helpers/jargonScan'

function scan(src: string, allow?: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'jargon-'))
  const p = join(dir, 'f.tsx')
  writeFileSync(p, src)
  return jargonInSource(p, allow)
}

describe('jargonInSource', () => {
  it('flags JSX text and label props', () => {
    expect(scan('<h1>Run Detail</h1>')).toEqual(['Run Detail'])
    expect(scan("const x = { label: 'Trigger Run' }")).toEqual(['Trigger Run'])
  })
  it('ignores code identifiers, comparisons and classNames', () => {
    expect(scan("import DriftStrip from './DriftStrip'")).toEqual([])
    expect(scan("if (status === 'failed') {}")).toEqual([])
    expect(scan('<div className="font-mono">x</div>')).toEqual([])
    expect(scan('<p>Start a new issue</p>')).toEqual([])
  })
  it('ignores comments and honours allow', () => {
    expect(scan('// <p>agent</p>\n/* title: "run" */')).toEqual([])
    expect(scan('<p>agent</p>', ['agent'])).toEqual([])
  })
})
