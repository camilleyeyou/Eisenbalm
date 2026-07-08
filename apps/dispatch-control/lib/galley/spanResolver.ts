/**
 * Per-block quotedSpan resolution (GLY-02).
 *
 * Anchors QA `qaCorrections` findings onto exact character offsets within a
 * single draft block's text -- NEVER the whole section's concatenated text
 * (a cross-block "match" is not a real match; see 32-RESEARCH.md Pattern 2).
 *
 * A wrong highlight is worse than an honest miss (D-12): ambiguity of any
 * kind -- 2+ matches with no usable hint, or still-ambiguous after
 * normalization -- always resolves to `unresolved`, never a guess.
 *
 * Pure, dependency-free.
 */

export interface ResolvedAnnotation {
  findingId: string // Convex _id
  sectionId: string // galley/draft section id (post-mapping)
  blockIndex: number
  start: number // char offset into blocks[blockIndex].text
  end: number
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan: string
}

export interface UnresolvedFinding {
  findingId: string
  sectionId: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan?: string
}

/** Minimal shape needed from a draft row -- matches `ContentBlock` structurally. */
export interface DraftBlockLike {
  type: string
  text: string
}

/** Minimal shape needed from a Convex `qaCorrections` row, already filtered to one section. */
export interface QaFinding {
  _id: string
  severity: 'info' | 'warning' | 'error'
  axis?: string
  reason: string
  suggestedFix?: string
  quotedSpan?: string
  blockIndexHint?: number
  accepted?: boolean
  /** §33.1 resolution state — callers filter via `isOpenFinding` (findingState.ts). */
  resolution?: 'accepted' | 'dismissed'
}

interface MatchCandidate {
  blockIndex: number
  start: number
  end: number
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Curly -> straight quote substitution ONLY -- a 1:1 char swap, so it never
// changes string length. Offsets computed against the normalized string
// therefore map directly onto the ORIGINAL (un-normalized) string.
function normQuotes(s: string): string {
  return s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
}

function exactMatchesFor(blocks: DraftBlockLike[], quoted: string): MatchCandidate[] {
  const out: MatchCandidate[] = []
  blocks.forEach((block, blockIndex) => {
    const idx = block.text.indexOf(quoted)
    if (idx >= 0) out.push({ blockIndex, start: idx, end: idx + quoted.length })
  })
  return out
}

// Stage A: quote-substitution normalization (length-preserving). Still
// requires an exact substring match after normalizing both sides.
function quoteNormalizedMatchesFor(blocks: DraftBlockLike[], quoted: string): MatchCandidate[] {
  const normalizedQuoted = normQuotes(quoted)
  const out: MatchCandidate[] = []
  blocks.forEach((block, blockIndex) => {
    const idx = normQuotes(block.text).indexOf(normalizedQuoted)
    if (idx >= 0) out.push({ blockIndex, start: idx, end: idx + quoted.length })
  })
  return out
}

// Stage B: whitespace-tolerant regex over the quote-normalized text. Quote
// substitution never changes length, so `match.index` / `match[0].length`
// index the ORIGINAL block text directly -- never a normalized string.
function whitespaceTolerantMatchesFor(blocks: DraftBlockLike[], quoted: string): MatchCandidate[] {
  const normalizedQuoted = normQuotes(quoted)
  const pattern = escapeRegExp(normalizedQuoted).replace(/\s+/g, '\\s+')
  const out: MatchCandidate[] = []
  blocks.forEach((block, blockIndex) => {
    const re = new RegExp(pattern, 'g')
    const normalizedText = normQuotes(block.text)
    let match: RegExpExecArray | null
    while ((match = re.exec(normalizedText)) !== null) {
      out.push({ blockIndex, start: match.index, end: match.index + match[0].length })
      if (match[0].length === 0) re.lastIndex += 1
    }
  })
  return out
}

/**
 * Resolves a list of match candidates to a single winner, or signals
 * ambiguity. Never guesses: a hint only disambiguates when it names a block
 * that is ACTUALLY one of the candidates; an invalid/stale/non-matching
 * hint is ignored entirely (falls through within the caller's stage
 * sequencing, or is treated as unresolved if this is the final stage).
 */
function disambiguate(
  matches: MatchCandidate[],
  blockIndexHint: number | undefined,
  blockCount: number,
): MatchCandidate | 'ambiguous' | undefined {
  if (matches.length === 0) return undefined
  if (matches.length === 1) return matches[0]
  if (typeof blockIndexHint === 'number' && blockIndexHint >= 0 && blockIndexHint < blockCount) {
    const hinted = matches.find(m => m.blockIndex === blockIndexHint)
    if (hinted) return hinted
  }
  return 'ambiguous'
}

/**
 * Resolves QA findings (already filtered to one section) against that
 * section's draft blocks. Findings are searched one block at a time --
 * never against the blocks joined together.
 */
export function resolveSectionFindings(
  blocks: DraftBlockLike[],
  findings: QaFinding[],
  sectionId: string,
): { resolved: ResolvedAnnotation[]; unresolved: UnresolvedFinding[] } {
  const resolved: ResolvedAnnotation[] = []
  const unresolved: UnresolvedFinding[] = []

  for (const finding of findings) {
    // Defensive: the caller filters out accepted findings, but tolerate one
    // slipping through by excluding it entirely (not even as unresolved).
    if (finding.accepted === true) continue

    const quoted = finding.quotedSpan
    if (!quoted) {
      unresolved.push({
        findingId: finding._id,
        sectionId,
        severity: finding.severity,
        axis: finding.axis,
        reason: finding.reason,
        suggestedFix: finding.suggestedFix,
        quotedSpan: finding.quotedSpan,
      })
      continue
    }

    let candidate = disambiguate(exactMatchesFor(blocks, quoted), finding.blockIndexHint, blocks.length)

    if (candidate === undefined) {
      candidate = disambiguate(
        quoteNormalizedMatchesFor(blocks, quoted),
        finding.blockIndexHint,
        blocks.length,
      )
    }
    if (candidate === undefined) {
      candidate = disambiguate(
        whitespaceTolerantMatchesFor(blocks, quoted),
        finding.blockIndexHint,
        blocks.length,
      )
    }

    if (candidate && candidate !== 'ambiguous') {
      resolved.push({
        findingId: finding._id,
        sectionId,
        blockIndex: candidate.blockIndex,
        start: candidate.start,
        end: candidate.end,
        severity: finding.severity,
        axis: finding.axis,
        reason: finding.reason,
        suggestedFix: finding.suggestedFix,
        quotedSpan: quoted,
      })
    } else {
      unresolved.push({
        findingId: finding._id,
        sectionId,
        severity: finding.severity,
        axis: finding.axis,
        reason: finding.reason,
        suggestedFix: finding.suggestedFix,
        quotedSpan: quoted,
      })
    }
  }

  return { resolved, unresolved }
}
