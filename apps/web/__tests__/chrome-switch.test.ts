import { describe, it, expect } from 'vitest'
import { isDispatchRoute } from '@/components/dispatch/ChromeSwitch'

describe('isDispatchRoute', () => {
  it.each([['/', true], ['/index', true], ['/indexes', false], ['/issue/abc', true], ['/issue/abc/preview', true], ['/issues', false], ['/shop', false], ['/archive', false], ['/about', false], ['/charities/x', false], ['/legal/terms', false], [null, false], [undefined, false]])(
    '%s -> %s',
    (p, expected) => {
      expect(isDispatchRoute(p as string | null | undefined)).toBe(expected)
    },
  )
})
