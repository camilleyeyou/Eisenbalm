/**
 * Smoke tests for the theme engine security contract (WEB-07, WEB-08, WEB-09).
 *
 * Run with:
 *   node --test --import tsx/esm apps/web/lib/theme.test.ts
 * Or from repo root:
 *   pnpm exec tsx --test apps/web/lib/theme.test.ts
 *
 * These tests use Node.js's built-in test runner (node:test) — no additional
 * test framework dependency is required. Node 18+ includes the test runner.
 *
 * Execution approach chosen for Phase 2:
 *   pnpm exec tsx --test apps/web/lib/theme.test.ts
 *   (tsx is in apps/studio/devDependencies and is workspace-resolvable from root)
 *
 * Phase 5 may extend with a proper Vitest/Jest setup if the test surface grows.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateHex,
  validateFont,
  relativeLuminance,
  contrastRatio,
  passesWcagAA,
  serializeThemeCss,
  applyTheme,
  FONT_WHITELIST,
  BRAND_DEFAULTS,
  HEX_REGEX,
  WCAG_AA_THRESHOLD,
} from './theme.js'

// ─── validateHex ──────────────────────────────────────────────────────────────

test('validateHex: accepts 6-digit lowercase hex', () => {
  assert.equal(validateHex('#abc123'), '#abc123')
  assert.equal(validateHex('#000000'), '#000000')
  assert.equal(validateHex('#ffffff'), '#ffffff')
})

test('validateHex: accepts 6-digit uppercase hex', () => {
  assert.equal(validateHex('#FF0000'), '#FF0000')
  assert.equal(validateHex('#0A1B2C'), '#0A1B2C')
  assert.equal(validateHex('#FAFAF8'), '#FAFAF8')
})

test('validateHex: accepts mixed-case hex', () => {
  assert.equal(validateHex('#aAbBcC'), '#aAbBcC')
  assert.equal(validateHex('#1A1A18'), '#1A1A18')
})

test('validateHex: rejects 3-digit shorthand', () => {
  assert.equal(validateHex('#FFF'), null)
  assert.equal(validateHex('#abc'), null)
  assert.equal(validateHex('#000'), null)
})

test('validateHex: rejects 8-digit hex (with alpha)', () => {
  assert.equal(validateHex('#FF0000FF'), null)
  assert.equal(validateHex('#FAFAF8FF'), null)
})

test('validateHex: rejects named colors', () => {
  assert.equal(validateHex('red'), null)
  assert.equal(validateHex('blue'), null)
  assert.equal(validateHex('rebeccapurple'), null)
  assert.equal(validateHex('transparent'), null)
})

test('validateHex: rejects functional notation', () => {
  assert.equal(validateHex('rgb(255,0,0)'), null)
  assert.equal(validateHex('hsl(0, 100%, 50%)'), null)
  assert.equal(validateHex('var(--whatever)'), null)
  assert.equal(validateHex('rgba(0,0,0,0.5)'), null)
})

test('validateHex: rejects non-hex characters', () => {
  assert.equal(validateHex('#GG0000'), null)
  assert.equal(validateHex('#ZZZZZZ'), null)
  assert.equal(validateHex('#XYZ123'), null)
})

test('validateHex: rejects non-strings', () => {
  assert.equal(validateHex(undefined), null)
  assert.equal(validateHex(null), null)
  assert.equal(validateHex(42), null)
  assert.equal(validateHex({}), null)
  assert.equal(validateHex([]), null)
  assert.equal(validateHex(true), null)
})

test('validateHex: rejects empty string', () => {
  assert.equal(validateHex(''), null)
})

test('validateHex: rejects hash-only string', () => {
  assert.equal(validateHex('#'), null)
})

// ─── validateFont ─────────────────────────────────────────────────────────────

test('validateFont: accepts all 6 whitelisted fonts', () => {
  for (const font of FONT_WHITELIST) {
    assert.equal(validateFont(font), font, `Expected validateFont to accept "${font}"`)
  }
})

test('validateFont: rejects fonts not in whitelist', () => {
  assert.equal(validateFont('Comic Sans MS'), null)
  assert.equal(validateFont('Arial'), null)
  assert.equal(validateFont('Times New Roman'), null)
  assert.equal(validateFont('helvetica'), null)
})

test('validateFont: rejects non-strings', () => {
  assert.equal(validateFont(undefined), null)
  assert.equal(validateFont(null), null)
  assert.equal(validateFont(42), null)
})

test('validateFont: is case-sensitive', () => {
  assert.equal(validateFont('lora'), null)      // lowercase rejected
  assert.equal(validateFont('INTER'), null)     // all-caps rejected
  assert.equal(validateFont('Lora'), 'Lora')    // exact case accepted
})

// ─── relativeLuminance ────────────────────────────────────────────────────────

test('relativeLuminance: white (#FFFFFF) is 1', () => {
  assert.ok(Math.abs(relativeLuminance('#FFFFFF') - 1) < 1e-6,
    `Expected ~1, got ${relativeLuminance('#FFFFFF')}`)
})

test('relativeLuminance: black (#000000) is 0', () => {
  assert.equal(relativeLuminance('#000000'), 0)
})

test('relativeLuminance: mid-gray (#808080) is approximately 0.2158', () => {
  const lum = relativeLuminance('#808080')
  assert.ok(Math.abs(lum - 0.2158) < 0.001,
    `Expected ~0.2158, got ${lum}`)
})

test('relativeLuminance: brand bg (#FAFAF8) is high luminance', () => {
  const lum = relativeLuminance('#FAFAF8')
  assert.ok(lum > 0.9, `Expected > 0.9, got ${lum}`)
})

test('relativeLuminance: invalid input returns NaN', () => {
  assert.ok(Number.isNaN(relativeLuminance('red')))
  assert.ok(Number.isNaN(relativeLuminance('#FFF')))
  assert.ok(Number.isNaN(relativeLuminance('')))
})

// ─── contrastRatio ────────────────────────────────────────────────────────────

test('contrastRatio: black on white is approximately 21', () => {
  const ratio = contrastRatio('#000000', '#FFFFFF')
  assert.ok(Math.abs(ratio - 21) < 0.01,
    `Expected ~21, got ${ratio}`)
})

test('contrastRatio: white on black is also approximately 21 (symmetric)', () => {
  const ratio = contrastRatio('#FFFFFF', '#000000')
  assert.ok(Math.abs(ratio - 21) < 0.01,
    `Expected ~21, got ${ratio}`)
})

test('contrastRatio: same color is 1', () => {
  assert.equal(contrastRatio('#FFFFFF', '#FFFFFF'), 1)
  assert.equal(contrastRatio('#000000', '#000000'), 1)
})

test('contrastRatio: brand default text on brand default bg is > 15', () => {
  const ratio = contrastRatio(BRAND_DEFAULTS.text, BRAND_DEFAULTS.bg)
  assert.ok(ratio > 15,
    `Expected > 15, got ${ratio} (brand defaults must far exceed WCAG AA)`)
})

test('contrastRatio: invalid fg input returns 0', () => {
  assert.equal(contrastRatio('red', '#FFFFFF'), 0)
  assert.equal(contrastRatio('rgb(0,0,0)', '#FFFFFF'), 0)
})

test('contrastRatio: invalid bg input returns 0', () => {
  assert.equal(contrastRatio('#000000', 'invalid'), 0)
})

test('contrastRatio: both invalid returns 0', () => {
  assert.equal(contrastRatio('red', 'blue'), 0)
})

// ─── passesWcagAA ─────────────────────────────────────────────────────────────

test('passesWcagAA: brand default text on brand default bg passes', () => {
  assert.equal(passesWcagAA(BRAND_DEFAULTS.text, BRAND_DEFAULTS.bg), true)
})

test('passesWcagAA: black on white passes', () => {
  assert.equal(passesWcagAA('#000000', '#FFFFFF'), true)
})

test('passesWcagAA: light gray on white fails (low contrast)', () => {
  assert.equal(passesWcagAA('#CCCCCC', '#FFFFFF'), false)
})

test('passesWcagAA: white on white fails (no contrast)', () => {
  assert.equal(passesWcagAA('#FFFFFF', '#FFFFFF'), false)
})

test('passesWcagAA: invalid text color fails', () => {
  assert.equal(passesWcagAA('red', '#FFFFFF'), false)
})

test('passesWcagAA: invalid bg color fails', () => {
  assert.equal(passesWcagAA('#000000', 'invalid'), false)
})

test('passesWcagAA: threshold is exactly 4.5:1 (WCAG_AA_THRESHOLD constant)', () => {
  assert.equal(WCAG_AA_THRESHOLD, 4.5)
})

// ─── FONT_WHITELIST ───────────────────────────────────────────────────────────

test('FONT_WHITELIST: contains exactly 6 entries', () => {
  assert.equal(FONT_WHITELIST.length, 6)
})

test('FONT_WHITELIST: contains all required Phase 2 fonts', () => {
  assert.ok(FONT_WHITELIST.includes('Playfair Display'))
  assert.ok(FONT_WHITELIST.includes('Lora'))
  assert.ok(FONT_WHITELIST.includes('Inter'))
  assert.ok(FONT_WHITELIST.includes('Cormorant Garamond'))
  assert.ok(FONT_WHITELIST.includes('Merriweather'))
  assert.ok(FONT_WHITELIST.includes('DM Serif Display'))
})

// ─── HEX_REGEX ────────────────────────────────────────────────────────────────

test('HEX_REGEX is exactly the locked pattern', () => {
  assert.equal(HEX_REGEX.source, '^#[0-9a-fA-F]{6}$')
})

test('HEX_REGEX: accepts 6-digit hex', () => {
  assert.ok(HEX_REGEX.test('#FAFAF8'))
  assert.ok(HEX_REGEX.test('#000000'))
  assert.ok(HEX_REGEX.test('#abc123'))
})

test('HEX_REGEX: rejects non-6-digit values', () => {
  assert.equal(HEX_REGEX.test('#FFF'), false)
  assert.equal(HEX_REGEX.test('red'), false)
  assert.equal(HEX_REGEX.test(''), false)
})

// ─── BRAND_DEFAULTS ───────────────────────────────────────────────────────────

test('BRAND_DEFAULTS: palette matches UI-SPEC exactly', () => {
  assert.equal(BRAND_DEFAULTS.bg,      '#FAFAF8')
  assert.equal(BRAND_DEFAULTS.text,    '#1A1A18')
  assert.equal(BRAND_DEFAULTS.primary, '#2D5016')
  assert.equal(BRAND_DEFAULTS.accent,  '#8B1A1A')
})

test('BRAND_DEFAULTS: fonts are whitelisted', () => {
  assert.ok(FONT_WHITELIST.includes(BRAND_DEFAULTS.fontDisplay))
  assert.ok(FONT_WHITELIST.includes(BRAND_DEFAULTS.fontBody))
  assert.ok(FONT_WHITELIST.includes(BRAND_DEFAULTS.fontUi))
})

// ─── serializeThemeCss ────────────────────────────────────────────────────────

test('serializeThemeCss: null theme produces brand-default :root block', () => {
  const css = serializeThemeCss(null)
  assert.ok(css.startsWith(':root {'), `Expected ":root {" prefix, got: ${css.slice(0, 20)}`)
  assert.ok(css.endsWith('}'), `Expected "}" suffix`)
  assert.ok(css.includes(BRAND_DEFAULTS.bg),      'Expected bg default')
  assert.ok(css.includes(BRAND_DEFAULTS.text),    'Expected text default')
  assert.ok(css.includes(BRAND_DEFAULTS.primary), 'Expected primary default')
  assert.ok(css.includes(BRAND_DEFAULTS.accent),  'Expected accent default')
  assert.ok(css.includes(`'Playfair Display'`),   'Expected display font')
  assert.ok(css.includes(`'Lora'`),               'Expected body font')
})

test('serializeThemeCss: valid theme values are rendered in output', () => {
  const css = serializeThemeCss({
    primaryColor:    '#2D5016',
    accentColor:     '#8B1A1A',
    backgroundColor: '#FAFAF8',
    textColor:       '#1A1A18',
    fontDisplay:     'Playfair Display',
    fontBody:        'Lora',
  })
  assert.ok(css.includes('#2D5016'), 'Expected custom primary')
  assert.ok(css.includes('#8B1A1A'), 'Expected custom accent')
  assert.ok(css.includes('#FAFAF8'), 'Expected custom bg')
  assert.ok(css.includes('#1A1A18'), 'Expected custom text')
  assert.ok(css.includes(`'Playfair Display'`), 'Expected custom display font')
  assert.ok(css.includes(`'Lora'`), 'Expected custom body font')
})

test('serializeThemeCss: invalid hex falls back to brand defaults (security)', () => {
  const css = serializeThemeCss({
    primaryColor:    'not-a-hex',
    accentColor:     '"><script>alert(1)</script>',
    backgroundColor: '#FAFAF8',
    textColor:       '#1A1A18',
    fontDisplay:     'Playfair Display',
    fontBody:        'Lora',
  })
  // Injection attempts must NOT appear in output.
  assert.ok(!css.includes('not-a-hex'),         'not-a-hex must not appear in CSS output')
  assert.ok(!css.includes('<script>'),           'XSS attempt must not appear in CSS output')
  assert.ok(!css.includes('alert(1)'),           'XSS payload must not appear in CSS output')
  assert.ok(!css.includes('Comic Sans'),         'Non-whitelisted font must not appear')
  // Brand defaults applied for invalid values.
  assert.ok(css.includes(BRAND_DEFAULTS.primary), 'Expected fallback primary')
  assert.ok(css.includes(BRAND_DEFAULTS.accent),  'Expected fallback accent')
})

test('serializeThemeCss: invalid font falls back to brand default font', () => {
  const css = serializeThemeCss({
    primaryColor:    '#2D5016',
    accentColor:     '#8B1A1A',
    backgroundColor: '#FAFAF8',
    textColor:       '#1A1A18',
    fontDisplay:     'Comic Sans MS',
    fontBody:        'Lora',
  })
  assert.ok(!css.includes('Comic Sans MS'), 'Non-whitelisted display font must not appear')
  assert.ok(css.includes(`'Playfair Display'`), 'Expected fallback display font')
  assert.ok(css.includes(`'Lora'`), 'Valid body font should be kept')
})

test('serializeThemeCss: low-contrast theme reverts bg+text to brand defaults', () => {
  // Light gray text on white — fails WCAG AA.
  const css = serializeThemeCss({
    primaryColor:    '#2D5016',
    accentColor:     '#8B1A1A',
    backgroundColor: '#FFFFFF',
    textColor:       '#CCCCCC',
    fontDisplay:     'Playfair Display',
    fontBody:        'Lora',
  })
  // bg+text must revert to brand defaults.
  assert.ok(css.includes(BRAND_DEFAULTS.bg),   'Expected fallback bg after WCAG failure')
  assert.ok(css.includes(BRAND_DEFAULTS.text), 'Expected fallback text after WCAG failure')
  // Primary+accent keep their validated values (not subject to contrast gate).
  assert.ok(css.includes('#2D5016'), 'Custom primary should be retained')
  assert.ok(css.includes('#8B1A1A'), 'Custom accent should be retained')
})

test('serializeThemeCss: never throws on arbitrary theme input', () => {
  const dangerousInputs = [
    null,
    { primaryColor: '' },
    { primaryColor: 'javascript:alert(1)' },
    { primaryColor: '#' + 'Z'.repeat(6) },
    { backgroundColor: 'expression(alert(1))' },
    { fontDisplay: '<img src=x onerror=alert(1)>' },
    {},
  ] as const

  for (const input of dangerousInputs) {
    assert.doesNotThrow(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => serializeThemeCss(input as any),
      `Expected serializeThemeCss not to throw for input: ${JSON.stringify(input)}`
    )
  }
})

test('serializeThemeCss: output always starts with :root and ends with }', () => {
  const cases = [
    null,
    {},
    { primaryColor: '#FF0000', textColor: '#000000', backgroundColor: '#FFFFFF' },
  ]
  for (const input of cases) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const css = serializeThemeCss(input as any)
    assert.ok(css.trimStart().startsWith(':root {'))
    assert.ok(css.trimEnd().endsWith('}'))
  }
})

// ─── applyTheme ───────────────────────────────────────────────────────────────

// Minimal HTMLElement mock for Node.js test context (no DOM available).
function makeElement(): { style: { setProperty: (k: string, v: string) => void; props: Record<string, string> } } {
  const props: Record<string, string> = {}
  return {
    style: {
      setProperty: (k: string, v: string) => { props[k] = v },
      props,
    },
  }
}

test('applyTheme: sets CSS variables via setProperty', () => {
  const el = makeElement()
  applyTheme(el as unknown as HTMLElement, null)
  // All required variables must be set.
  assert.ok('--color-bg'      in el.style.props, 'Expected --color-bg')
  assert.ok('--color-text'    in el.style.props, 'Expected --color-text')
  assert.ok('--color-primary' in el.style.props, 'Expected --color-primary')
  assert.ok('--color-accent'  in el.style.props, 'Expected --color-accent')
  assert.ok('--font-display'  in el.style.props, 'Expected --font-display')
  assert.ok('--font-body'     in el.style.props, 'Expected --font-body')
})

test('applyTheme: null theme applies brand defaults', () => {
  const el = makeElement()
  applyTheme(el as unknown as HTMLElement, null)
  assert.equal(el.style.props['--color-bg'],      BRAND_DEFAULTS.bg)
  assert.equal(el.style.props['--color-text'],    BRAND_DEFAULTS.text)
  assert.equal(el.style.props['--color-primary'], BRAND_DEFAULTS.primary)
  assert.equal(el.style.props['--color-accent'],  BRAND_DEFAULTS.accent)
})

test('applyTheme: valid theme sets custom values', () => {
  const el = makeElement()
  applyTheme(el as unknown as HTMLElement, {
    primaryColor:    '#112233',
    accentColor:     '#445566',
    backgroundColor: '#000000',
    textColor:       '#FAFAF8',
    fontDisplay:     'Merriweather',
    fontBody:        'Lora',
  })
  assert.equal(el.style.props['--color-bg'],      '#000000')
  assert.equal(el.style.props['--color-text'],    '#FAFAF8')
  assert.equal(el.style.props['--color-primary'], '#112233')
  assert.equal(el.style.props['--color-accent'],  '#445566')
  assert.ok(el.style.props['--font-display'].includes('Merriweather'))
  assert.ok(el.style.props['--font-body'].includes('Lora'))
})

test('applyTheme: low-contrast pair reverts bg+text to brand defaults', () => {
  const el = makeElement()
  applyTheme(el as unknown as HTMLElement, {
    backgroundColor: '#FFFFFF',
    textColor:       '#CCCCCC', // fails WCAG AA on #FFFFFF
    primaryColor:    '#2D5016',
    accentColor:     '#8B1A1A',
  })
  assert.equal(el.style.props['--color-bg'],   BRAND_DEFAULTS.bg)
  assert.equal(el.style.props['--color-text'], BRAND_DEFAULTS.text)
  // Primary+accent keep validated values.
  assert.equal(el.style.props['--color-primary'], '#2D5016')
  assert.equal(el.style.props['--color-accent'],  '#8B1A1A')
})

test('applyTheme: never throws — even on null element', () => {
  // applyTheme should not throw; it catches internally.
  // Passing null as HTMLElement should trigger the catch path.
  assert.doesNotThrow(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applyTheme(null as any, null)
  })
})

test('applyTheme: never throws on injection attempts in theme data', () => {
  const el = makeElement()
  assert.doesNotThrow(() => {
    applyTheme(el as unknown as HTMLElement, {
      primaryColor:    '"><script>alert(1)</script>',
      accentColor:     'javascript:void(0)',
      backgroundColor: '#FAFAF8',
      textColor:       '#1A1A18',
      fontDisplay:     '<img onerror=alert(1)>',
      fontBody:        'Lora',
    })
  })
  // Output must not contain injection attempts.
  for (const value of Object.values(el.style.props)) {
    assert.ok(!value.includes('<script>'),    `CSS var value must not contain <script>: ${value}`)
    assert.ok(!value.includes('javascript:'), `CSS var value must not contain javascript:: ${value}`)
    assert.ok(!value.includes('<img'),        `CSS var value must not contain <img: ${value}`)
  }
})
