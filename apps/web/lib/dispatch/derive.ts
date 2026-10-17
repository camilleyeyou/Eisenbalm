/**
 * Pure derivations. Every function returns null/[] when data is absent so
 * components omit the block (never a placeholder).
 */
import type { ArchiveIssue, FrontPageRow, Issue } from '@/lib/sanity/types'

type FullIssue = NonNullable<Issue>

export type FactChip = { label: string; value: string }
export type StatTile = { figure: string | null; caption: string; source: string | null }
export type DelibCardKind = 'picked' | 'runner-up' | 'also'
export type DelibCard = {
  kind: DelibCardKind
  name: string
  location: string | null
  blurb: string | null
  score: number | null
}
export type ImpactRange = { min: number; max: number; unit: string }

const SENTINEL = '\u0000'
const ABBREVIATIONS = [
  'e.g.', 'i.e.', 'Inc.', 'Co.', 'Corp.', 'Ltd.', 'St.', 'Dr.', 'Mr.', 'Mrs.', 'Ms.', 'U.S.', 'No.', 'vs.', 'etc.',
]

function clean(s: string | null | undefined): string | null {
  const t = typeof s === 'string' ? s.trim() : ''
  return t.length > 0 ? t : null
}

export function firstSentences(text: string | null | undefined, max = 1): string | null {
  const t = clean(text)
  if (!t) return null
  let protectedText = t
  for (const abbr of ABBREVIATIONS) {
    const escaped = abbr.replace(/\./g, '\\.')
    protectedText = protectedText.replace(
      new RegExp(`(^|[^A-Za-z])${escaped}`, 'g'),
      (m) => m.replace(/\./g, SENTINEL),
    )
  }
  const parts = protectedText.split(/(?<=[.?!])\s+(?=[A-Z0-9"“(])/)
  const out = parts.slice(0, Math.max(1, max)).join(' ').split(SENTINEL).join('.').trim()
  return out.length > 0 ? out : null
}

export function tickerLines(issue: FullIssue): string[] {
  const authored = issue.frontPage?.tickerLines
  if (authored && authored.length > 0) {
    const lines = authored.map((l) => l.trim()).filter((l) => l.length > 0).slice(0, 8)
    if (lines.length > 0) return lines
  }
  const c = issue.charity
  const lines: Array<string | null> = [
    c.name ? `This week: ${c.name}` : null,
    clean(c.focusArea),
    clean(c.location),
    c.foundingYear ? `Founded ${c.foundingYear}` : null,
    ...(issue.problemStatement?.keyDataPoints ?? []).slice(0, 3).map((k) => clean(k.stat)),
  ]
  return lines.filter((l): l is string => !!l)
}

export function heroHeadline(issue: FullIssue): string {
  return clean(issue.originStory?.headline) ?? issue.charity.name
}

export function heroDek(issue: FullIssue): string | null {
  return clean(issue.frontPage?.dek) ?? firstSentences(issue.charity.missionStatement, 2)
}

export function factChips(charity: FullIssue['charity']): FactChip[] {
  const chips: FactChip[] = []
  const add = (label: string, v: string | null | undefined) => {
    const value = clean(v)
    if (value) chips.push({ label, value })
  }
  add('What they do', charity.focusArea)
  add('Size', charity.assetRange)
  add('Based in', charity.location)
  add('Founded', charity.foundingYear ? String(charity.foundingYear) : null)
  return chips
}

export function keyFigure(stat: string): { figure: string | null; caption: string } {
  const m = stat.match(/^\s*([~≈]?[$€£]?\d[\d,.]*\s?(?:%|percent|million|billion|thousand|[kKmMbB]\b)?)\s+(.+)$/)
  if (!m) return { figure: null, caption: stat.trim() }
  const figure = m[1]!.trim()
  if (figure.length > 8) return { figure: null, caption: stat.trim() }
  return { figure, caption: m[2]!.trim() }
}

export function statTiles(issue: FullIssue): StatTile[] {
  return (issue.problemStatement?.keyDataPoints ?? [])
    .filter((k) => clean(k.stat))
    .slice(0, 3)
    .map((k) => {
      const { figure, caption } = keyFigure(k.stat)
      return { figure, caption, source: clean(k.source) }
    })
}

export function readTimeLabel(minutes: number): string {
  const m = Number.isFinite(minutes) ? Math.max(1, Math.round(minutes)) : 1
  return `${m}-minute read`
}

export function editorConfidence(issue: FullIssue): number | null {
  const v = issue.selectionDeliberation?.editorConfidence
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : null
}

export function deliberationCards(issue: FullIssue): DelibCard[] {
  const d = issue.selectionDeliberation
  if (!d) return []
  const cands = (d.candidates ?? []).filter((c) => c.charity?.name)
  if (cands.length === 0 && !clean(d.editorDecision)) return []
  const winner = cands.find((c) => c.charity?.slug === issue.charity.slug)
  const others = cands
    .filter((c) => c !== winner)
    .sort((a, b) => (b.advocateScore ?? -Infinity) - (a.advocateScore ?? -Infinity))
  const cards: DelibCard[] = [
    {
      kind: 'picked',
      name: issue.charity.name,
      location: clean(issue.charity.location),
      blurb: firstSentences(d.editorDecision, 1),
      score: winner?.advocateScore ?? null,
    },
  ]
  others.forEach((c, i) => {
    if (i === 0) {
      cards.push({
        kind: 'runner-up',
        name: c.charity!.name,
        location: clean(c.charity!.location),
        blurb: firstSentences(d.runnerUpNotes, 2),
        score: c.advocateScore ?? null,
      })
    } else if (i <= 4) {
      cards.push({
        kind: 'also',
        name: c.charity!.name,
        location: clean(c.charity!.location),
        blurb: firstSentences(c.scoutSummary, 1),
        score: c.advocateScore ?? null,
      })
    }
  })
  return cards
}

function rows(list: FrontPageRow[] | null | undefined, max = 4): FrontPageRow[] {
  return (list ?? [])
    .map((r) => ({ label: (r.label ?? '').trim(), value: (r.value ?? '').trim() }))
    .filter((r) => r.label && r.value)
    .slice(0, max)
}

export function caseTimeline(issue: FullIssue): FrontPageRow[] {
  return rows(issue.frontPage?.caseTimeline)
}

export function adSummary(issue: FullIssue): { title: string | null; rows: FrontPageRow[] } | null {
  if (issue.bonusType !== 'specAd') return null
  const a = issue.frontPage?.adSummary
  if (!a) return null
  const title = clean(a.title)
  const r = rows(a.rows)
  return title || r.length > 0 ? { title, rows: r } : null
}

export function pullQuote(issue: FullIssue, which: 'origin' | 'case'): string | null {
  return clean(issue.frontPage?.pullQuotes?.[which])
}

export function impactRange(issue: FullIssue, priceCents: number): ImpactRange | null {
  const u = issue.frontPage?.impactUnit
  const unit = clean(u?.label)
  const lo = u?.costMinUsd
  const hi = u?.costMaxUsd
  if (!unit || typeof lo !== 'number' || typeof hi !== 'number') return null
  if (!(lo > 0) || hi < lo || !(priceCents > 0)) return null
  return { min: Math.ceil((lo * 100) / priceCents), max: Math.ceil((hi * 100) / priceCents), unit }
}

export function impactProgress(balms: number, range: ImpactRange): number {
  if (!(range.min > 0) || !Number.isFinite(balms)) return 0
  return Math.min(1, Math.max(0, balms / range.min))
}

export function balmsFromCents(cents: number, unitCents: number): number {
  if (!(unitCents > 0) || !Number.isFinite(cents)) return 0
  return Math.max(0, Math.round(cents / unitCents))
}

export function filterIssues<T extends ArchiveIssue>(issues: T[], query: string): T[] {
  const q = query.trim().toLowerCase()
  if (!q) return issues
  const num = q.match(/^(?:#|no\.?\s*)?(\d+)$/)
  if (num) {
    const n = Number(num[1])
    return issues.filter((i) => i.issueNumber === n)
  }
  return issues.filter((i) =>
    [i.charity.name, i.charity.focusArea, i.charity.location].some((f) => f?.toLowerCase().includes(q)),
  )
}

export function backIssues<T extends ArchiveIssue>(archive: T[], currentIssueNumber: number | null, limit = 8): T[] {
  return archive
    .filter((i) => i.issueNumber !== currentIssueNumber)
    .sort((a, b) => b.issueNumber - a.issueNumber)
    .slice(0, limit)
}

function parseDate(publishDate: string | null | undefined): Date | null {
  if (!publishDate) return null
  const d = new Date(publishDate + (publishDate.length === 10 ? 'T00:00:00Z' : ''))
  return Number.isNaN(d.getTime()) ? null : d
}

export function issueDateLabel(publishDate: string | null | undefined): string | null {
  const d = parseDate(publishDate)
  return d
    ? d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    : null
}

export function monthYearLabel(publishDate: string | null | undefined): string | null {
  const d = parseDate(publishDate)
  return d ? d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }) : null
}
