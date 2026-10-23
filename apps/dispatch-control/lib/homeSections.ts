/**
 * Phase 52 (HOME-02..06, HOME-09) — the front door's ONE selector.
 *
 * Quick 261021-7aw: nothing content-related blocks Publish any more. The
 * pipeline agents review and self-fix every section before the draft reaches
 * the editor, so there is no "fix" row state and no blocking count. This
 * selector only reports whether each story is written and how many changes
 * the agents made to it (a quiet, read-only count).
 *
 * Pure: no React, no I/O.
 */
import { EDITABLE_SECTIONS } from '@/lib/editableSections'
import { draftSectionIdsFromDraft, type DerivationInputs } from '@/lib/derivedState'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import type { DraftResponse } from '@/lib/contentPatchClient'

// ─── Types ──────────────────────────────────────────────────────────────────

export type HomeRowState = 'writing' | 'not-written' | 'clean'

export interface HomeSectionRow {
  id: string
  label: string
  headline: string
  state: HomeRowState
  /** Findings the agents applied + contradicted claims they removed in this section. */
  agentChanges: number
  href: string
}

export interface HomeSectionsResult {
  rows: HomeSectionRow[]
}

export type HomeFooter =
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'failed' }
  | { kind: 'gate1' }
  | { kind: 'stopped' }
  | { kind: 'running' }
  | { kind: 'published'; publishedAt: number | null }
  | { kind: 'ready' }

// ─── Copy ───────────────────────────────────────────────────────────────────

export const SECTION_DESCRIPTORS: Record<string, string> = {
  'deliberation-conversation': 'How the writers chose this charity',
  podcast: 'This week’s episode',
  theme: 'Colours and fonts for this issue',
}

// ─── Sections ───────────────────────────────────────────────────────────────

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
  // HOME-09: any unloaded input means we cannot say anything is written.
  if (draft === undefined || qaFindings === undefined || claimRows === undefined) return undefined

  const present: ReadonlySet<string> = draft ? draftSectionIdsFromDraft(draft) : new Set<string>()

  const changes = new Map<string, number>()
  const bump = (id: string) => changes.set(id, (changes.get(id) ?? 0) + 1)
  for (const f of qaFindings) {
    if (f.resolution !== 'agent-applied') continue
    const id = qaSectionToGalleyId(f.sectionName)
    if (id !== null && KNOWN_IDS.has(id)) bump(id)
  }
  for (const c of claimRows) {
    if (c.verdict !== 'contradicted' || c.status !== 'removed') continue
    if (c.sectionName && KNOWN_IDS.has(c.sectionName)) bump(c.sectionName)
  }

  const rows: HomeSectionRow[] = EDITABLE_SECTIONS.map(({ id, label }) => ({
    id,
    label,
    headline: SECTION_DESCRIPTORS[id] ?? producedHeadline(draft, id) ?? label,
    state: present.has(id) ? 'clean' : runStatus === 'running' ? 'writing' : 'not-written',
    agentChanges: changes.get(id) ?? 0,
    href: `/s/${id}`,
  }))

  return { rows }
}

// ─── Footer ─────────────────────────────────────────────────────────────────

export function deriveHomeFooter(args: {
  stateKind: 'loading' | 'none' | 'run'
  sections: HomeSectionsResult | undefined
  issue: { held: boolean; published: boolean } | null | undefined
  publishedAt: number | null | undefined
  runStatus: string | undefined
  runCompletedAt: number | undefined
}): HomeFooter {
  const { stateKind, sections, issue, publishedAt, runStatus, runCompletedAt } = args

  // Terminal / non-content kinds first: they need no content input.
  if (stateKind === 'loading') return { kind: 'loading' }
  if (stateKind === 'none') return { kind: 'none' }
  // The pipeline never flips issues.published; the Publisher sets the run to
  // 'complete', so that status IS the published signal.
  if (issue?.published === true || runStatus === 'complete') {
    return { kind: 'published', publishedAt: publishedAt ?? null }
  }
  if (runStatus === 'cancelled') return { kind: 'stopped' }
  if (runStatus === 'failed') return { kind: 'failed' }
  if (runStatus === 'running') return { kind: 'running' }
  if (runStatus === 'awaiting-review' && runCompletedAt == null) return { kind: 'gate1' }
  if (runStatus !== 'awaiting-review') return { kind: 'loading' }

  if (sections === undefined || issue === undefined) return { kind: 'loading' }

  // Quick 261021-7aw: findings, contradicted claims and sign-offs never block.
  return { kind: 'ready' }
}
