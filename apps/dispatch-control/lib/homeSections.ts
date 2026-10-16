/**
 * Phase 52 (HOME-02..06, HOME-09) — the front door's ONE selector.
 *
 * This is the single definition of "blocking" for the front door and it equals
 * the server gate (api/signoffs.py + review.py): open `severity === 'error'`
 * QA findings on ANY axis, plus open contradicted claims (`isOpenBlocking`).
 * Warnings and infos never count and never disable Publish (52-CONTEXT
 * "Resolved after research"). Predicates are composed from their existing
 * owners — never re-implemented here.
 *
 * KNOWN GAP (documented, fails safe): `isOpenFinding` treats a row as
 * resolved on the legacy `accepted` flag OR any `resolution`, while the
 * server (signoffs.py ~160/217) checks `resolution` only. A legacy row with
 * `accepted: true` and no `resolution` therefore looks resolved here but still
 * blocks the server; the page may show Ready and the publish chain then stops
 * with the server's own sentence. Do not "fix" this by forking the predicate.
 *
 * Pure: no React, no I/O.
 */
import { EDITABLE_SECTIONS } from '@/lib/editableSections'
import { draftSectionIdsFromDraft, isOpenBlocking, type DerivationInputs } from '@/lib/derivedState'
import { isOpenFinding } from '@/lib/galley/findingState'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import type { DraftResponse } from '@/lib/contentPatchClient'

// ─── Types ──────────────────────────────────────────────────────────────────

export type HomeRowState = 'writing' | 'not-written' | 'fix' | 'clean'

export interface HomeSectionRow {
  id: string
  label: string
  headline: string
  state: HomeRowState
  blockingCount: number
  firstFindingId: string | null
  href: string
}

export interface HomeSectionsResult {
  rows: HomeSectionRow[]
  attributedClaims: number
  unattributedClaims: number
  unattributedFindings: number
  /** Distinct section ids recovered for null-mapped findings (footer link target only). */
  unattributedFindingSections: string[]
  unknownSectionFindings: number
  totalBlocking: number
}

export type HomeFooter =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'failed' }
  | { kind: 'gate1' }
  | { kind: 'running' }
  | { kind: 'published'; publishedAt: number | null }
  | {
      kind: 'fix'
      stories: Array<{ id: string; label: string; href: string }>
      notWritten: Array<{ id: string; label: string }>
      unattributedClaims: number
      unattributedFindings: number
      unattributedFindingHref: string | null
    }
  | { kind: 'ready' }

// ─── Copy ───────────────────────────────────────────────────────────────────

export const SECTION_DESCRIPTORS: Record<string, string> = {
  'deliberation-conversation': 'How the agents chose this charity',
  podcast: 'This week’s episode',
  theme: 'Colours and fonts for this issue',
}

export const RUNNING_SENTENCE =
  'Still writing — Publish turns on once every story is written and nothing needs fixing.'
export const READY_SENTENCE =
  'Ready to publish. Nothing left to fix. The agents checked the facts; none were contradicted.'
export const NONE_SENTENCE = 'There is no current issue yet.'
export const FAILED_SENTENCE = 'This run failed before the issue was finished, so there is nothing to publish.'
export const GATE1_SENTENCE = 'The agents are waiting for you to choose the charity.'

export function rowNote(row: Pick<HomeSectionRow, 'state' | 'blockingCount'>): string {
  switch (row.state) {
    case 'fix':
      return row.blockingCount === 1 ? '1 thing to fix →' : `${row.blockingCount} things to fix →`
    case 'clean':
      return 'Reads clean'
    case 'writing':
      return 'Being written…'
    case 'not-written':
      return 'Not written yet'
  }
}

export function fixSentencePrefix(storyCount: number): string {
  return storyCount === 1 ? '1 story has something to fix: ' : `${storyCount} stories have something to fix: `
}

export function unattributedClaimSentence(n: number): string {
  return n === 1
    ? '1 fact the agents found contradicted needs checking.'
    : `${n} facts the agents found contradicted need checking.`
}

export function unattributedFindingSentence(n: number): string {
  return n === 1 ? '1 thing to fix isn’t tied to a story.' : `${n} things to fix aren’t tied to a story.`
}

// ─── Sections ───────────────────────────────────────────────────────────────

// Galley-only surfaces QA may still name; used ONLY to give the footer a link
// target. These findings are never bucketed into a row.
const UNMAPPED_QA_SECTION: Record<string, string> = {
  podcast: 'podcast',
  theme: 'theme',
  deliberation: 'deliberation-conversation',
  deliberation_conversation: 'deliberation-conversation',
  'deliberation-conversation': 'deliberation-conversation',
}

const KNOWN_IDS: ReadonlySet<string> = new Set(EDITABLE_SECTIONS.map((s) => s.id))

function producedHeadline(draft: DraftResponse | null, id: string): string | undefined {
  if (!draft) return undefined
  let raw: unknown
  if (id === 'game') raw = draft.game?.headline
  else if (id === 'bonus') raw = draft.bonus?.headline
  else raw = draft.sections?.[id]?.headline
  return typeof raw === 'string' && raw.trim() !== '' ? raw.trim() : undefined
}

export function deriveHomeSections(args: {
  draft: DraftResponse | null | undefined
  qaFindings: DerivationInputs['qaFindings']
  claimRows: DerivationInputs['claimRows']
  runStatus: string | undefined
}): HomeSectionsResult | undefined {
  const { draft, qaFindings, claimRows, runStatus } = args
  // HOME-09: any unloaded input means we cannot say anything is clean.
  if (draft === undefined || qaFindings === undefined || claimRows === undefined) return undefined

  const present: ReadonlySet<string> = draft ? draftSectionIdsFromDraft(draft) : new Set<string>()

  const counts = new Map<string, number>()
  const firstFinding = new Map<string, string>()
  let unattributedFindings = 0
  let unknownSectionFindings = 0
  const unattributedSections = new Set<string>()
  let attributedClaims = 0
  let unattributedClaims = 0

  for (const f of qaFindings) {
    if (!(isOpenFinding(f) && f.severity === 'error')) continue
    const id = qaSectionToGalleyId(f.sectionName)
    if (id === null || !KNOWN_IDS.has(id)) {
      unattributedFindings++
      const recovered = UNMAPPED_QA_SECTION[f.sectionName]
      if (recovered) unattributedSections.add(recovered)
      else unknownSectionFindings++
      continue
    }
    counts.set(id, (counts.get(id) ?? 0) + 1)
    if (!firstFinding.has(id)) firstFinding.set(id, f._id)
  }

  for (const c of claimRows) {
    if (!isOpenBlocking(c)) continue
    const id = c.sectionName
    if (!id || !KNOWN_IDS.has(id)) {
      unattributedClaims++
      continue
    }
    attributedClaims++
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }

  let totalBlocking = unattributedFindings + unattributedClaims
  const rows: HomeSectionRow[] = EDITABLE_SECTIONS.map(({ id, label }) => {
    const blockingCount = counts.get(id) ?? 0
    totalBlocking += blockingCount
    const firstFindingId = firstFinding.get(id) ?? null
    const state: HomeRowState =
      blockingCount > 0
        ? 'fix'
        : !present.has(id)
          ? runStatus === 'running'
            ? 'writing'
            : 'not-written'
          : 'clean'
    return {
      id,
      label,
      headline: SECTION_DESCRIPTORS[id] ?? producedHeadline(draft, id) ?? label,
      state,
      blockingCount,
      firstFindingId,
      href: firstFindingId ? `/s/${id}#finding-${firstFindingId}` : `/s/${id}`,
    }
  })

  return {
    rows,
    attributedClaims,
    unattributedClaims,
    unattributedFindings,
    unattributedFindingSections: EDITABLE_SECTIONS.map((s) => s.id).filter((id) => unattributedSections.has(id)),
    unknownSectionFindings,
    totalBlocking,
  }
}

// ─── Footer ─────────────────────────────────────────────────────────────────

export function deriveHomeFooter(args: {
  stateKind: 'loading' | 'none' | 'run'
  sections: HomeSectionsResult | undefined
  claimSummaryBlocking: number | undefined
  signOffsLoaded: boolean
  issue: { held: boolean; published: boolean } | null | undefined
  publishedAt: number | null | undefined
  runStatus: string | undefined
  runCompletedAt: number | undefined
}): HomeFooter {
  const { stateKind, sections, claimSummaryBlocking, signOffsLoaded, issue, publishedAt, runStatus, runCompletedAt } =
    args

  // Terminal / non-content kinds first: they need no content input.
  if (stateKind === 'loading') return { kind: 'loading' }
  if (stateKind === 'none') return { kind: 'none' }
  // The pipeline never flips issues.published; the Publisher sets the run to
  // 'complete', so that status IS the published signal.
  if (issue?.published === true || runStatus === 'complete') {
    return { kind: 'published', publishedAt: publishedAt ?? null }
  }
  if (runStatus === 'failed') return { kind: 'failed' }
  if (runStatus === 'running') return { kind: 'running' }
  if (runStatus === 'awaiting-review' && runCompletedAt == null) return { kind: 'gate1' }
  if (runStatus !== 'awaiting-review') return { kind: 'loading' }

  if (sections === undefined || claimSummaryBlocking === undefined || !signOffsLoaded || issue === undefined) {
    return { kind: 'loading' }
  }

  // Server summary wins: it can count claims no row could attribute.
  const unattributedClaims = Math.max(sections.unattributedClaims, claimSummaryBlocking - sections.attributedClaims)
  const stories = sections.rows
    .filter((r) => r.state === 'fix')
    .map((r) => ({ id: r.id, label: r.label, href: r.href }))
  const notWritten = sections.rows
    .filter((r) => r.state === 'not-written' || r.state === 'writing')
    .map((r) => ({ id: r.id, label: r.label }))
  const unattributedFindingHref =
    sections.unattributedFindings > 0 &&
    sections.unknownSectionFindings === 0 &&
    sections.unattributedFindingSections.length === 1
      ? `/s/${sections.unattributedFindingSections[0]}`
      : null

  if (stories.length || notWritten.length || unattributedClaims > 0 || sections.unattributedFindings > 0) {
    return {
      kind: 'fix',
      stories,
      notWritten,
      unattributedClaims,
      unattributedFindings: sections.unattributedFindings,
      unattributedFindingHref,
    }
  }
  return { kind: 'ready' }
}
