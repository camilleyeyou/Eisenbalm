/**
 * Phase 32 (GLY-01, D-04, Plan 32-01 Wave 0 RED) — googleFontLoader tests.
 *
 * 32-RESEARCH.md §Pitfall 4: no dynamic Google Fonts loading mechanism
 * exists anywhere in this codebase yet (`next/font/google` cannot take a
 * runtime string; a repo-wide grep for `fonts.googleapis`/`fonts.gstatic`
 * `<link>` tags returns zero hits). This module is new: it validates an
 * incoming theme font name against a duplicated `FONT_WHITELIST` (same
 * list/reasoning as `apps/web/lib/theme.ts` — never trust the draft's
 * `theme.fontDisplay`/`fontBody` string directly) before injecting a
 * `<link rel="stylesheet">` tag, deduped by font name.
 *
 * Runs in node (this app's default vitest environment for `.test.ts`
 * files) — a minimal fake `document` is installed via `vi.stubGlobal`
 * rather than switching this file to jsdom, since only `document.head`
 * append/query behavior is exercised.
 *
 * RED at authoring time: `../lib/galley/googleFontLoader` does not exist
 * yet. Turns GREEN in Plan 32-05/32-06.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ensureThemeFont } from '../lib/galley/googleFontLoader'

interface FakeElement {
  tagName: string
  attributes: Record<string, string>
  setAttribute: (name: string, value: string) => void
  getAttribute: (name: string) => string | undefined
}

function createFakeLinkElement(): FakeElement {
  const attributes: Record<string, string> = {}
  return {
    tagName: 'LINK',
    attributes,
    setAttribute(name: string, value: string) {
      attributes[name] = value
    },
    getAttribute(name: string) {
      return attributes[name]
    },
  }
}

function createFakeDocument() {
  const appended: FakeElement[] = []
  return {
    createElement: (tag: string) => {
      if (tag.toLowerCase() !== 'link') {
        throw new Error(`unexpected createElement("${tag}") in font-loader test fake`)
      }
      return createFakeLinkElement()
    },
    head: {
      appendChild: (el: FakeElement) => {
        appended.push(el)
        return el
      },
      // Selector text is ignored -- the fake returns every previously
      // appended <link> element so the implementation's own href/name
      // comparison logic performs the real dedupe check.
      querySelectorAll: (_selector: string) => appended,
    },
    _appended: appended,
  }
}

describe('ensureThemeFont', () => {
  let fakeDocument: ReturnType<typeof createFakeDocument>

  beforeEach(() => {
    fakeDocument = createFakeDocument()
    vi.stubGlobal('document', fakeDocument)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('injects a <link> with an href containing fonts.googleapis.com/css2?family=Lora for a whitelisted font', () => {
    const result = ensureThemeFont('Lora')

    expect(result).toBeTruthy()
    expect(fakeDocument._appended).toHaveLength(1)
    const href = fakeDocument._appended[0].getAttribute('href') ?? ''
    expect(href).toContain('fonts.googleapis.com/css2?family=Lora')
  })

  it('injects a <link> for "Newsreader" (a second whitelisted font)', () => {
    const result = ensureThemeFont('Newsreader')

    expect(result).toBeTruthy()
    expect(fakeDocument._appended).toHaveLength(1)
    const href = fakeDocument._appended[0].getAttribute('href') ?? ''
    expect(href).toContain('fonts.googleapis.com/css2?family=Newsreader')
  })

  it('rejects a non-whitelisted font name ("Comic Sans MS") and injects NO link', () => {
    const result = ensureThemeFont('Comic Sans MS')

    expect(result).toBeFalsy()
    expect(fakeDocument._appended).toHaveLength(0)
  })

  it('rejects a bare color-like string ("red") and injects NO link', () => {
    const result = ensureThemeFont('red')

    expect(result).toBeFalsy()
    expect(fakeDocument._appended).toHaveLength(0)
  })

  it('rejects an HTML/script-injection attempt and injects NO link (security)', () => {
    const result = ensureThemeFont('"><script>alert(1)</script>')

    expect(result).toBeFalsy()
    expect(fakeDocument._appended).toHaveLength(0)
  })

  it('dedupes: calling twice with the same whitelisted font injects only ONE link', () => {
    ensureThemeFont('Lora')
    ensureThemeFont('Lora')

    expect(fakeDocument._appended).toHaveLength(1)
  })
})
