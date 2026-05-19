import { describe, it, expect } from 'vitest'

import {
  BANNED_PATTERNS,
  GAME_CSP_POLICY,
  injectGameHead,
  validateEmbedCode,
} from '@/lib/game-validator'

// Fixtures — one expected-rejection sample per banned construct.
// The label string is what validateEmbedCode returns inside `reason`,
// so the test pulls the labels straight off BANNED_PATTERNS to avoid
// double-maintaining the list.
const BANNED_SAMPLES: ReadonlyArray<{ label: string; sample: string }> = [
  { label: 'parent frame access (window.parent)',     sample: '<script>window.parent.foo</script>' },
  { label: 'top frame access (window.top)',           sample: '<script>window.top.foo</script>' },
  { label: 'top global property access (top.)',       sample: '<script>top.location.href</script>' },
  { label: 'parent global property access (parent.)', sample: '<script>parent.location.href</script>' },
  { label: 'network request (fetch)',                 sample: '<script>fetch("/x")</script>' },
  { label: 'network request (XMLHttpRequest)',        sample: '<script>new XMLHttpRequest()</script>' },
  { label: 'cookie access (document.cookie)',         sample: '<script>document.cookie</script>' },
  { label: 'document.domain',                         sample: '<script>document.domain = "evil"</script>' },
  { label: 'storage access (localStorage)',           sample: '<script>localStorage.getItem("x")</script>' },
  { label: 'dynamic evaluation (eval)',               sample: '<script>eval("alert(1)")</script>' },
  { label: 'dynamic import',                          sample: '<script>import("./x")</script>' },
  { label: 'external script (<script src=...>)',      sample: '<script src="https://evil/x.js"></script>' },
  { label: 'external stylesheet (<link href=...>)',   sample: '<link href="https://evil/x.css" rel="stylesheet">' },
]

describe('game-validator', () => {
  describe('validateEmbedCode (GAM-02)', () => {
    it('rejects empty embedCode', () => {
      expect(validateEmbedCode('')).toEqual({ valid: false, reason: 'Embed code is empty' })
    })

    it('accepts safe inline HTML+JS with no banned constructs', () => {
      const safe = `<!DOCTYPE html><html><head></head><body>
        <canvas id="c"></canvas>
        <script>
          const ctx = document.getElementById('c').getContext('2d');
          let x = 0;
          setInterval(() => { x = (x + 1) % 100; }, 100);
        </script>
      </body></html>`
      expect(validateEmbedCode(safe)).toEqual({ valid: true })
    })

    it('mirrors all 13 banned-pattern entries exactly', () => {
      // If BANNED_PATTERNS grows or shrinks the sample list must follow.
      // This is the tripwire between game.py FORBIDDEN_CONSTRUCTS and
      // this module.
      expect(BANNED_PATTERNS).toHaveLength(BANNED_SAMPLES.length)
    })

    for (const { label, sample } of BANNED_SAMPLES) {
      it(`rejects: ${label}`, () => {
        const result = validateEmbedCode(sample)
        expect(result).toEqual({
          valid: false,
          reason: `Forbidden construct: ${label}`,
        })
      })
    }

    it('does not false-positive on words containing "parent" or "top" without dot access', () => {
      // GAM-02 Pitfall 5: \btop\. and \bparent\. use word boundaries.
      // Strings like "the most important moment" or "in the top tier"
      // should pass.
      const safe = `<p>the most important moment in the top tier</p>`
      expect(validateEmbedCode(safe)).toEqual({ valid: true })
    })
  })

  describe('injectGameHead (GAM-04, GAM-06 substrate)', () => {
    const sampleDoc = '<!DOCTYPE html><html><head></head><body><p>game</p></body></html>'

    it('returns a string longer than the input (head was injected)', () => {
      expect(injectGameHead(sampleDoc).length).toBeGreaterThan(sampleDoc.length)
    })

    it('injects a CSP meta tag with connect-src none and script-src unsafe-inline', () => {
      const out = injectGameHead(sampleDoc)
      expect(out).toContain('<meta http-equiv="Content-Security-Policy"')
      expect(out).toContain("connect-src 'none'")
      expect(out).toContain("script-src 'unsafe-inline'")
      expect(out).toContain("default-src 'none'")
    })

    it('GAME_CSP_POLICY contains every required directive', () => {
      expect(GAME_CSP_POLICY).toContain("default-src 'none'")
      expect(GAME_CSP_POLICY).toContain("script-src 'unsafe-inline'")
      expect(GAME_CSP_POLICY).toContain("style-src 'unsafe-inline'")
      expect(GAME_CSP_POLICY).toContain("img-src data:")
      expect(GAME_CSP_POLICY).toContain("connect-src 'none'")
      expect(GAME_CSP_POLICY).toContain("frame-src 'none'")
      expect(GAME_CSP_POLICY).toContain("object-src 'none'")
      expect(GAME_CSP_POLICY).toContain("base-uri 'none'")
      expect(GAME_CSP_POLICY).toContain("form-action 'none'")
    })

    it('injects a viewport meta tag (GAM-06)', () => {
      const out = injectGameHead(sampleDoc)
      expect(out).toContain('<meta name="viewport"')
      expect(out).toContain('width=device-width')
    })

    it('injects a CSS reset that prevents horizontal overflow at 360px (GAM-06)', () => {
      const out = injectGameHead(sampleDoc)
      expect(out).toContain('overflow-x: hidden')
      expect(out).toContain('max-width: 100%')
    })

    it('prepends the head injection (Pitfall 4 — never relies on <head> match)', () => {
      // The function must put its injection BEFORE the user document
      // so the CSP applies even when LLM HTML lacks a <head>.
      const out = injectGameHead(sampleDoc)
      const cspIdx = out.indexOf('Content-Security-Policy')
      const docIdx = out.indexOf('<!DOCTYPE html>')
      expect(cspIdx).toBeGreaterThanOrEqual(0)
      expect(docIdx).toBeGreaterThan(cspIdx)
    })

    it('handles malformed HTML without <head> (still prepends head)', () => {
      const malformed = '<body><canvas></canvas></body>'
      const out = injectGameHead(malformed)
      expect(out).toContain('Content-Security-Policy')
      expect(out.indexOf('Content-Security-Policy')).toBeLessThan(out.indexOf('<body>'))
    })
  })
})
