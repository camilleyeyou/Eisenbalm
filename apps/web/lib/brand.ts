/**
 * Fixed Dispatch brand (Phase 55, locked decision 1).
 *
 * Values come ONLY from this frozen constant; nothing from Sanity reaches the
 * emitted CSS. lib/theme.ts is intentionally untouched (Phase 55 locked
 * decision 1) — we only import its contrast + hex helpers.
 */
import { contrastRatio, validateHex } from '@/lib/theme'

export const PALETTE = Object.freeze({
  green: '#00FF79',
  blue: '#005CFF',
  red: '#FF002B',
  yellow: '#EEFE34',
} as const)

export type Tone = keyof typeof PALETTE

export const INK = '#0A0A0A' as const
export const PAPER = '#FFFFFF' as const

export const NEUTRALS = Object.freeze({
  muted: '#4A4A4A',
  rule: '#D6D6D6',
  darkLead: '#E4E4E4',
  darkCaption: '#BDBDBD',
  track: '#EFEFEF',
  trackDark: '#3A3A3A',
  panel: '#1C1C1C',
} as const)

export const TONE_ORDER: readonly Tone[] = Object.freeze([
  'green',
  'blue',
  'red',
  'yellow',
] as Tone[])

/** Issue 2 = green (mockup-faithful; Andrew can shift). */
export const ACCENT_OFFSET = 2

function toneAt(i: number): Tone {
  return TONE_ORDER[i % 4] as Tone
}

export function toneForIssue(issueNumber: number): Tone {
  const k = Number.isFinite(issueNumber) ? Math.trunc(issueNumber) : ACCENT_OFFSET
  return toneAt((((k - ACCENT_OFFSET) % 4) + 4) % 4)
}

export function accentForIssue(issueNumber: number): string {
  return PALETTE[toneForIssue(issueNumber)]
}

export function rotationForIssue(issueNumber: number): {
  accent: string
  second: string
  third: string
  fourth: string
} {
  const idx = TONE_ORDER.indexOf(toneForIssue(issueNumber))
  return {
    accent: PALETTE[toneAt(idx)],
    second: PALETTE[toneAt(idx + 1)],
    third: PALETTE[toneAt(idx + 2)],
    fourth: PALETTE[toneAt(idx + 3)],
  }
}

export function inkFor(bg: string): '#0A0A0A' | '#FFFFFF' {
  return contrastRatio(INK, bg) >= contrastRatio(PAPER, bg) ? INK : PAPER
}

export function serializeAccentCss(issueNumber: number): string {
  const r = rotationForIssue(issueNumber)
  const safe = (v: string) => validateHex(v) ?? PALETTE.green
  const accent = safe(r.accent)
  const fourth = safe(r.fourth)
  return `.dispatch{--d-accent:${accent};--d-accent-ink:${inkFor(accent)};--d-second:${safe(r.second)};--d-third:${safe(r.third)};--d-fourth:${fourth};--d-fourth-ink:${inkFor(fourth)};}`
}
