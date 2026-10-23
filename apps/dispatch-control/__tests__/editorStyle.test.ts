/**
 * Phase 56-12 — source-level style scan over every editor-facing file.
 * No mono, no uppercase, no tracking, nothing under 15px (the Behind-Run
 * technical <pre> is the single exception).
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..')
const ALLOWED_PX = new Set([15, 17, 18, 23, 26, 32, 42, 48])

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

const files = [
  ...walk(path.join(ROOT, 'components/editor')),
  ...walk(path.join(ROOT, 'app/(editorial)')),
  ...walk(path.join(ROOT, 'app/admin/_components')),
  path.join(ROOT, 'app/admin/page.tsx'),
  path.join(ROOT, 'app/admin/layout.tsx'),
  ...fs
    .readdirSync(path.join(ROOT, 'app/admin/runs/_components'))
    .filter((n) => /^BehindRun.*\.tsx$/.test(n))
    .map((n) => path.join(ROOT, 'app/admin/runs/_components', n)),
].filter((f) => fs.existsSync(f))

function violations(file: string): string[] {
  const out: string[] = []
  const rel = path.relative(ROOT, file)
  const isRunView = path.basename(file) === 'BehindRunView.tsx'
  let monoPre = 0
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      const at = `${rel}:${i + 1}`
      if (line.includes('font-mono')) out.push(`${at} font-mono`)
      if (/\buppercase\b/.test(line)) out.push(`${at} uppercase`)
      if (line.includes('tracking-[')) out.push(`${at} tracking-[`)
      if (line.includes('textTransform')) out.push(`${at} textTransform`)
      if (line.includes('bg-[color:var(--color-paper)]')) out.push(`${at} bg paper`)
      for (const m of line.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
        const n = Number(m[1])
        if (n === 14 && isRunView && line.includes('font-[monospace]')) {
          monoPre++
          continue
        }
        if (!ALLOWED_PX.has(n)) out.push(`${at} text-[${m[1]}px]`)
      }
    })
  if (isRunView && monoPre > 1) out.push(`${rel} more than one technical 14px line`)
  return out
}

describe('editor style scan', () => {
  it('scans a non-trivial set of files', () => {
    expect(files.length).toBeGreaterThan(10)
  })
  it.each(files.map((f) => [path.relative(ROOT, f), f]))('%s is clean', (_rel, f) => {
    expect(violations(f as string)).toEqual([])
  })
})
