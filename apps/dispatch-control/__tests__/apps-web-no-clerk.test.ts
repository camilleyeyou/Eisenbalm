/**
 * AUTH-02 standing guard — asserts apps/web has zero @clerk imports.
 *
 * This test reads apps/web/package.json and checks that the string "@clerk"
 * does not appear. It runs immediately (no todo) and stays green as long as
 * no future phase accidentally leaks Clerk into the public reader site.
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

describe('apps/web no-clerk guard (AUTH-02)', () => {
  it('apps/web/package.json contains zero occurrences of @clerk', () => {
    const pkgPath = path.resolve(__dirname, '../../web/package.json')
    const content = fs.readFileSync(pkgPath, 'utf-8')
    const clerkCount = (content.match(/@clerk/g) ?? []).length
    expect(clerkCount).toBe(0)
  })
})
