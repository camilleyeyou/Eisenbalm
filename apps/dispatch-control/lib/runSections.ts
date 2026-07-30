/**
 * quick 260730-ldn (Task 3) — the nine work rows The Run renders, derived
 * purely from the draft and the current findings. No React, no Convex, no
 * fetch — type-only import from `@/lib/contentPatchClient`; every value
 * import is a pure helper the codebase already trusts as its single source
 * of truth for the thing it computes (`EDITABLE_SECTIONS`, presence via
 * `draftSectionIdsFromDraft`, word counts/excerpts via `sectionWordCount`/
 * `sectionExcerpt`/`countWords`, open-finding filtering via `isOpenFinding`,
 * the QA<->galley section-id bridge via `qaSectionToGalleyId`, and the
 * voice/factual axis split via `VOICE_AXES`/`FACTUAL_AXES`).
 *
 * Two "never-show-a-stale-value" disciplines, mirrored from
 * `lib/derivedState.ts`'s `deriveIssueStatus` (ISS-06):
 *   - `deriveRunSectionFindings(undefined)` returns `undefined`, NOT an
 *     all-zero map — the caller must be able to tell "no findings" from
 *     "findings not loaded".
 *   - `deriveRunSections(draft, undefined)` reports every GENERATED row as
 *     `state: 'unknown'`, never `'clean'` — a section is never called clean
 *     while its findings are still loading.
 * `draft === null` (the draft failed to load / has not loaded) is a THIRD,
 * distinct case from "findings not loaded": every row reports
 * `state: 'unknown'`, `generated: false`, `meta: 'Unavailable'` — explicitly
 * NOT `'pending'`/`'Not generated'`, because a draft that hasn't loaded is
 * not a draft that is empty.
 *
 * Do NOT fabricate "last edited". `DraftResponse.sections[id]` is
 * `{ headline?, blocks, lossy }` — there is no per-section timestamp
 * anywhere in the response, in Convex, or in Sanity's draft read. Mockup
 * 14's "EDITED 11 MIN AGO" therefore has no data source; it is intentionally
 * omitted here. `meta` carries word count (or `Interactive` / `Not generated`
 * / `Unavailable` / `Generated`) and nothing else — do not "restore" a last-
 * edited value from the mockup later without a real data source for it.
 */
import type { ContentBlock, DraftResponse } from '@/lib/contentPatchClient'
import { EDITABLE_SECTIONS } from '@/app/(dashboard)/review-desk/[runId]/_components/SectionChipList'
import { draftSectionIdsFromDraft } from '@/lib/derivedState'
import { sectionWordCount, sectionExcerpt, countWords } from '@/app/(dashboard)/review-desk/[runId]/_components/storyOutline'
import { isOpenFinding } from '@/lib/galley/findingState'
import { qaSectionToGalleyId } from '@/lib/galley/sectionIdMap'
import { VOICE_AXES } from '@/lib/galley/axisPartition'

// ── deriveRunSectionFindings ─────────────────────────────────────────────

export interface RunSectionFindingCounts {
  mustFix: number
  voice: number
}

export interface RunSectionFindingRow {
  _id: string
  sectionName: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  accepted?: boolean
  resolution?: 'accepted' | 'dismissed' | null
}

/**
 * Buckets open findings by their galley section id. Mirrors
 * `deriveSectionStates`'s mapping exactly (Phase 41): filter with
 * `isOpenFinding`, map `sectionName` through `qaSectionToGalleyId`, drop
 * `null` (galley-only sections QA never targets — podcast/theme/
 * deliberation — are dropped, never bucketed into an adjacent section).
 *
 * Axis split: `voice` increments for ANY severity when the axis is in
 * `VOICE_AXES` (Phase 36 §36.3 — voice findings are review-recommended
 * regardless of severity). `mustFix` increments only at `severity ===
 * 'error'` for the factual side (`axis === undefined` OR `axis` outside
 * `VOICE_AXES` both count as factual — the §36.3 conservative default),
 * matching `DecisionRail`'s `blockers` derivation so The Run's must-fix
 * count and the publish blocker count can never drift apart.
 */
export function deriveRunSectionFindings(
  qaFindings: RunSectionFindingRow[] | undefined,
): Record<string, RunSectionFindingCounts> | undefined {
  if (qaFindings === undefined) return undefined

  const result: Record<string, RunSectionFindingCounts> = {}
  for (const row of qaFindings) {
    if (!isOpenFinding(row)) continue
    const sectionId = qaSectionToGalleyId(row.sectionName)
    if (sectionId === null) continue

    const bucket = result[sectionId] ?? { mustFix: 0, voice: 0 }
    if (VOICE_AXES.has(row.axis ?? '')) {
      bucket.voice += 1
    } else if (row.severity === 'error') {
      bucket.mustFix += 1
    }
    result[sectionId] = bucket
  }
  return result
}

// ── deriveRunSections ────────────────────────────────────────────────────

export type RunSectionState = 'clean' | 'must-fix' | 'voice' | 'pending' | 'unknown'

export interface RunSectionRow {
  id: string
  label: string
  generated: boolean
  headline: string | null
  excerpt: string | null
  wordCount: number | null
  /** '842 words' | 'Interactive' | 'Generated' | 'Not generated' | 'Unavailable' */
  meta: string
  state: RunSectionState
  mustFix: number
  voice: number
}

// The 4 long-read sections whose draft payload is `{ headline?, blocks,
// lossy }` — the same set `draftSectionIdsFromDraft` treats specially.
const LONG_READ_SECTION_IDS = new Set(['originStory', 'problemStatement', 'founderBio', 'caseStudy'])

function formatWordCountMeta(n: number): string {
  return `${n} word${n === 1 ? '' : 's'}`
}

function unavailableRow(id: string, label: string): RunSectionRow {
  return {
    id,
    label,
    generated: false,
    headline: null,
    excerpt: null,
    wordCount: null,
    meta: 'Unavailable',
    state: 'unknown',
    mustFix: 0,
    voice: 0,
  }
}

function pendingRow(id: string, label: string): RunSectionRow {
  return {
    id,
    label,
    generated: false,
    headline: null,
    excerpt: null,
    wordCount: null,
    meta: 'Not generated',
    state: 'pending',
    mustFix: 0,
    voice: 0,
  }
}

export function deriveRunSections(
  draft: DraftResponse | null,
  counts: Record<string, RunSectionFindingCounts> | undefined,
): RunSectionRow[] {
  // `draft === null` — the draft has not loaded / failed to load. Distinct
  // from "section not generated": nothing here is known, so nothing is
  // called clean, pending, or anything else that implies real data was read.
  if (draft === null) {
    return EDITABLE_SECTIONS.map(({ id, label }) => unavailableRow(id, label))
  }

  const presentIds = draftSectionIdsFromDraft(draft)

  return EDITABLE_SECTIONS.map(({ id, label }) => {
    if (!presentIds.has(id)) return pendingRow(id, label)

    let headline: string | null = null
    let excerpt: string | null = null
    let wordCount: number | null = null
    let meta: string

    if (LONG_READ_SECTION_IDS.has(id)) {
      const section = draft.sections[id]
      const blocks = section?.blocks ?? []
      headline = section?.headline ?? null
      excerpt = sectionExcerpt(blocks) || null
      wordCount = sectionWordCount(blocks)
      meta = formatWordCountMeta(wordCount)
    } else if (id === 'game') {
      // An interactive embed has no meaningful word count — null, not 0.
      meta = 'Interactive'
    } else if (id === 'deliberation-conversation') {
      const turns = draft.conversation ?? []
      excerpt = turns[0]?.text ?? null
      wordCount = turns.reduce((sum, turn) => sum + countWords(turn?.text ?? ''), 0)
      meta = formatWordCountMeta(wordCount)
    } else if (id === 'bonus') {
      const body =
        draft.bonusType === 'specAd' && Array.isArray(draft.bonus?.body)
          ? (draft.bonus.body as ContentBlock[])
          : null
      if (body && body.length > 0) {
        excerpt = sectionExcerpt(body) || null
        wordCount = sectionWordCount(body)
        meta = formatWordCountMeta(wordCount)
      } else {
        // bigBudget / jingle (storyboards, lyrics+sunoPrompt) — real content,
        // but word count is not a meaningful measure of it.
        meta = 'Generated'
      }
    } else {
      // theme / podcast — payload present (per draftSectionIdsFromDraft) but
      // carries no headline/prose to summarize.
      meta = 'Generated'
    }

    const sectionCounts = counts?.[id]
    const mustFix = sectionCounts?.mustFix ?? 0
    const voice = sectionCounts?.voice ?? 0
    // Findings not loaded at all -> 'unknown', never 'clean' (never-show-a-
    // stale-value discipline, mirrors deriveIssueStatus's undefined checks).
    const state: RunSectionState =
      counts === undefined ? 'unknown' : mustFix > 0 ? 'must-fix' : voice > 0 ? 'voice' : 'clean'

    return { id, label, generated: true, headline, excerpt, wordCount, meta, state, mustFix, voice }
  })
}
