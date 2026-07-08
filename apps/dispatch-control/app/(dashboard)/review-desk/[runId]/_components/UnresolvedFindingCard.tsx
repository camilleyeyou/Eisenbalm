/**
 * D-09 section-end unresolved card (Phase 32, GLY-02).
 *
 * A finding whose `quotedSpan` failed to anchor onto the draft's blocks (no
 * match, or an ambiguous match per D-12) is never silently dropped. It
 * surfaces here at the end of its section with the full reason text and the
 * original quoted span, so nothing is lost — "never silently dropped or
 * mis-rendered."
 *
 * Pure presentational component — no client-only behavior needed.
 */
import type { UnresolvedFinding } from '@/lib/galley/spanResolver'

interface UnresolvedFindingCardProps {
  finding: UnresolvedFinding
  /** Phase 33 (D-11) action context, threaded from GallerySection. */
  runId?: string
  sectionId?: string
  onEditSection?: (sectionId: string, findingId?: string) => void
}

export default function UnresolvedFindingCard({ finding }: UnresolvedFindingCardProps) {
  return (
    <div className="galley-unresolved" data-severity={finding.severity}>
      <div className="galley-unresolved__label">Unresolved &middot; {finding.severity}</div>
      <p>{finding.reason}</p>
      {finding.quotedSpan && (
        <p className="galley-unresolved__quote">
          &ldquo;<span>{finding.quotedSpan}</span>&rdquo;
        </p>
      )}
      {finding.suggestedFix && <p>Suggested: {finding.suggestedFix}</p>}
    </div>
  )
}
