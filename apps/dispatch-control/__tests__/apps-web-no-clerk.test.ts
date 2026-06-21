/**
 * AUTH-02 standing guard — asserts apps/web has zero @clerk imports.
 *
 * This test reads apps/web/package.json and checks that the string "@clerk"
 * does not appear. It also scans apps/web source files (app/ and components/)
 * for any @clerk import to catch accidental Clerk leakage into source code.
 *
 * Both checks run immediately (no todo) and stay green as long as no future
 * phase accidentally leaks Clerk into the public reader site.
 *
 * Pitfall 2: If Clerk imports land in apps/web, the public Eisenbalm site
 * becomes auth-gated, breaking unauthenticated reader access.
 *
 * If this test trips after a future phase lands, remove the Clerk import/dep
 * from apps/web before merging.
 */
import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as glob from 'fs'

describe('apps/web no-clerk guard (AUTH-02)', () => {
  it('apps/web/package.json contains zero occurrences of @clerk', () => {
    const pkgPath = path.resolve(__dirname, '../../web/package.json')
    const content = fs.readFileSync(pkgPath, 'utf-8')
    const clerkCount = (content.match(/@clerk/g) ?? []).length
    expect(clerkCount).toBe(0)
  })

  it('apps/web source files contain zero occurrences of @clerk', () => {
    const webRoot = path.resolve(__dirname, '../../web')
    const searchDirs = [
      path.join(webRoot, 'app'),
      path.join(webRoot, 'components'),
    ]

    const violations: string[] = []

    for (const searchDir of searchDirs) {
      if (!fs.existsSync(searchDir)) continue
      collectFiles(searchDir, ['.ts', '.tsx'], violations)
    }

    if (violations.length > 0) {
      throw new Error(
        `@clerk found in apps/web source files (Pitfall 2 — AUTH-02 violation):\n` +
          violations.map(v => `  ${v}`).join('\n')
      )
    }
  })
})

/**
 * Recursively collect files with the given extensions from `dir`
 * and add any that contain "@clerk" to the `violations` list.
 */
function collectFiles(
  dir: string,
  extensions: string[],
  violations: string[]
): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      collectFiles(fullPath, extensions, violations)
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name)
      if (extensions.includes(ext)) {
        const content = fs.readFileSync(fullPath, 'utf-8')
        if (content.includes('@clerk')) {
          violations.push(fullPath)
        }
      }
    }
  }
}
