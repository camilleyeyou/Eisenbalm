/**
 * Phase 51 (READ-03, D-20) — the finding -> tracked-claim link, derived
 * client-side.
 *
 * WHY DERIVED: `qaCorrections` carries no claimId/claimIndex and this phase
 * makes ZERO schema changes. It does not need one: `resolveSectionFindings`
 * resolves BOTH QA findings and claim_checks rows into the same
 * {blockIndex, start, end} coordinate space for the same section, so the link
 * is an intersection over data already on screen.
 *
 * This EXTENDS the Phase 45 "Related facts" predicate
 * (`sectionName === sectionId && blockIndexHint === blockIndex`,
 * ReviewDeskRunView.tsx:449-451) with character-range overlap, because a
 * paragraph routinely carries several claims and a whole-block match would
 * attach the wrong evidence to a finding. It does not modify or replace the
 * Phase 45 path, and it changes nothing in spanResolver.ts.
 *
 * No overlap => null. Never a nearest-neighbour guess: showing the wrong
 * evidence beside a finding is worse than showing none.
 */
export interface SpanLike {
  blockIndex: number
  start: number
  end: number
}

function overlaps(a: SpanLike, c: SpanLike): boolean {
  return a.blockIndex === c.blockIndex && a.start < c.end && c.start < a.end
}

function overlapLength(a: SpanLike, c: SpanLike): number {
  return Math.min(a.end, c.end) - Math.max(a.start, c.start)
}

/**
 * The claim overlapping `finding`'s span with the greatest overlap length.
 * Ties break on the lower `claimIndex` (deterministic — never input order,
 * which varies with Convex row ordering). No overlap => `null`.
 */
export function claimForFinding<C extends SpanLike & { claimIndex: number }>(
  finding: SpanLike,
  claims: ReadonlyArray<C>,
): C | null {
  let best: C | null = null
  let bestLength = -1
  for (const claim of claims) {
    if (!overlaps(finding, claim)) continue
    const length = overlapLength(finding, claim)
    if (
      length > bestLength ||
      (length === bestLength && best !== null && claim.claimIndex < best.claimIndex)
    ) {
      best = claim
      bestLength = length
    }
  }
  return best
}

/**
 * Builds a `Map<findingId, claim>` for every finding that has an overlapping
 * claim. Findings with no match are simply absent from the map — never a
 * `null`/placeholder entry.
 */
export function buildFindingClaimMap<
  A extends SpanLike & { findingId: string },
  C extends SpanLike & { claimIndex: number },
>(findings: ReadonlyArray<A>, claims: ReadonlyArray<C>): Map<string, C> {
  const map = new Map<string, C>()
  for (const finding of findings) {
    const match = claimForFinding(finding, claims)
    if (match) map.set(finding.findingId, match)
  }
  return map
}
