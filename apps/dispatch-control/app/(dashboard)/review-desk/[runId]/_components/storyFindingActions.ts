/**
 * quick 261014-lbr — make story findings fixable.
 *
 * Pure helpers behind StoryFindingsRail: group findings that quote the same
 * passage, never-silent jump, editor field focus, and group accept/dismiss.
 * Accept/dismiss reuse the EXACT helpers AnnotationMark uses
 * (`@/lib/findingsClient`) — no new fetch path, no new endpoint.
 */
import { acceptFinding, dismissFinding, FindingsError } from '@/lib/findingsClient'

type Severity = 'info' | 'warning' | 'error'

export interface FindingRowInput {
  findingId: string
  sectionId?: string
  severity: Severity
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan?: string
}

export interface FindingGroup {
  key: string
  findingIds: string[]
  severity: Severity
  axis?: string
  quotedSpan?: string
  reasons: string[]
  suggestedFix?: string
  anchoredFindingId?: string
  members: Array<{ findingId: string; suggestedFix?: string }>
}

const SEVERITY_RANK: Record<Severity, number> = { error: 0, warning: 1, info: 2 }

export function normalizeQuote(s: string): string {
  return s
    .trim()
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function normalizeReason(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

export function groupFindingRows(
  resolved: ReadonlyArray<FindingRowInput>,
  unresolved: ReadonlyArray<FindingRowInput>,
): FindingGroup[] {
  const buckets = new Map<string, Array<{ row: FindingRowInput; anchored: boolean }>>()
  const tag = (rows: ReadonlyArray<FindingRowInput>, anchored: boolean) => {
    for (const row of rows) {
      const q = row.quotedSpan ? normalizeQuote(row.quotedSpan) : ''
      const key = q ? `${row.sectionId ?? ''}::${q}` : `solo::${row.findingId}`
      const list = buckets.get(key)
      if (list) list.push({ row, anchored })
      else buckets.set(key, [{ row, anchored }])
    }
  }
  tag(resolved, true)
  tag(unresolved, false)

  const groups: FindingGroup[] = []
  for (const [key, entries] of buckets) {
    const anchoredFindingId = entries.find(e => e.anchored)?.row.findingId
    // Stable sort: most severe first.
    const sorted = [...entries].sort(
      (a, b) => SEVERITY_RANK[a.row.severity] - SEVERITY_RANK[b.row.severity],
    )
    const reasons: string[] = []
    const seen = new Set<string>()
    for (const { row } of sorted) {
      const n = normalizeReason(row.reason)
      if (!seen.has(n)) {
        seen.add(n)
        reasons.push(row.reason)
      }
    }
    const top = sorted[0]!.row
    groups.push({
      key,
      findingIds: sorted.map(e => e.row.findingId),
      severity: top.severity,
      axis: top.axis,
      quotedSpan: top.quotedSpan,
      reasons,
      suggestedFix: sorted.find(e => e.row.suggestedFix && e.row.suggestedFix.trim())?.row.suggestedFix,
      anchoredFindingId,
      members: sorted.map(e => ({ findingId: e.row.findingId, suggestedFix: e.row.suggestedFix })),
    })
  }
  return groups
}

/** Scroll to + open the in-prose mark; otherwise ALWAYS fall back (never silent). */
export function jumpToFinding(
  findingId: string,
  fallback: (id: string) => void,
  doc: Document = document,
): boolean {
  const el = doc.getElementById(`finding-${findingId}`)
  if (el) {
    el.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
    ;(el as HTMLElement).click()
    return true
  }
  fallback(findingId)
  return false
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase()

/** Focus the first text field whose value contains the quote; select the match. */
export function focusFieldContainingQuote(container: ParentNode, quote: string): boolean {
  const q = quote.trim()
  if (!q) return false
  const fields = Array.from(
    container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'textarea, input[type="text"], input:not([type])',
    ),
  )
  const lower = q.toLowerCase()
  for (const el of fields) {
    const idx = el.value.toLowerCase().indexOf(lower)
    if (idx >= 0) {
      el.scrollIntoView?.({ block: 'center' })
      el.focus()
      el.setSelectionRange(idx, idx + q.length)
      return true
    }
  }
  const cq = collapse(q)
  for (const el of fields) {
    if (collapse(el.value).includes(cq)) {
      el.scrollIntoView?.({ block: 'center' })
      el.focus()
      return true
    }
  }
  return false
}

export const SUPERSEDED_REASON =
  'Resolved: this passage was rewritten by another accepted fix on the same card.'

export interface ApplyGroupResult {
  applied: number
  superseded: number
  failed: string[]
  note: string | null
}

export async function applyFixToGroup(args: {
  runId: string
  revisionId: string
  members: FindingGroup['members']
  getToken: () => Promise<string | null>
}): Promise<ApplyGroupResult> {
  const { runId, members, getToken } = args
  let current = args.revisionId
  let applied = 0
  let note: string | null = null
  const failed: string[] = []
  const toSupersede: string[] = []
  const withoutFix: string[] = members.filter(m => !m.suggestedFix?.trim()).map(m => m.findingId)
  const withFix = members.filter(m => m.suggestedFix?.trim())

  for (let i = 0; i < withFix.length; i++) {
    const id = withFix[i]!.findingId
    try {
      const res = await acceptFinding(runId, id, { ifRevisionID: current }, await getToken())
      current = res.revisionId
      applied++
    } catch (e) {
      const reason = e instanceof FindingsError ? e.reason : ''
      if (reason === 'revision_mismatch') {
        for (const rest of withFix.slice(i)) failed.push(rest.findingId)
        note = 'The draft changed while applying — reload and try again.'
        break
      }
      if ((reason === 'span_not_resolved' || reason === 'accept_unavailable') && applied > 0) {
        toSupersede.push(id)
      } else {
        failed.push(id)
      }
    }
  }

  if (note === null) {
    for (const id of withoutFix) (applied > 0 ? toSupersede : failed).push(id)
  } else {
    failed.push(...withoutFix)
  }

  let superseded = 0
  for (const id of toSupersede) {
    try {
      await dismissFinding(runId, id, { reason: SUPERSEDED_REASON }, await getToken())
      superseded++
    } catch {
      failed.push(id)
    }
  }

  if (failed.length > 0 && note === null) {
    note = `${applied + superseded} of ${members.length} resolved — ${failed.length} still need you. Use “Fix it in the editor”.`
  }
  return { applied, superseded, failed, note }
}

export async function dismissGroup(
  runId: string,
  findingIds: string[],
  reason: string,
  getToken: () => Promise<string | null>,
): Promise<string[]> {
  const failed: string[] = []
  for (const id of findingIds) {
    try {
      await dismissFinding(runId, id, { reason: reason.trim() }, await getToken())
    } catch {
      failed.push(id)
    }
  }
  return failed
}
