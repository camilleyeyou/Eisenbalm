'use client'
/**
 * Phase 32 (GLY-01, GLY-02) — one galley section's native render.
 *
 * Renders a section's headline/deck plus its body as synthetic
 * PortableText (Plan 32-04 `toSyntheticBlocks`) so `@portabletext/react`'s
 * native `marks.annotation` component API can render (and stack)
 * severity-colored inline spans (Plan 32-05 `AnnotationMark`). Findings that
 * failed to anchor onto the draft's blocks render as section-end
 * `UnresolvedFindingCard`s (D-09) so nothing is ever silently dropped.
 *
 * Phase 33 (EDT-04, Plan 33-04): threads the action context — `runId`,
 * `revisionId`, `reloadDraft`, `onEditSection` — down into each
 * `AnnotationMark` (via a per-render `components` object that closes over
 * the props) and each `UnresolvedFindingCard`, so the popover's
 * Accept/Edit/Dismiss row and the card's Dismiss/Edit-inline actions can
 * call the pipeline findings endpoints.
 *
 * Wrapped in `<section id="galley-{sectionId}">` so the chip jump-nav
 * (Plan 32-07) can `scrollIntoView` directly.
 *
 * Phase 35 (PRV-03, Plan 35-05): threads `claimResolved` + `showProvenance`
 * into `toSyntheticBlocks` so a span can additionally carry a `claimSpan`
 * mark (rendered by `ClaimMark`), stacked alongside `annotation` marks —
 * the marigold/rust provenance wash. When `showProvenance` is false, `[]`
 * is passed instead so no wash renders (annotations are unaffected).
 *
 * Phase 36 (VOX-02, D-10, Plan 36-06): threads an optional `labels` prop
 * straight through into every `AnnotationMark` this section mounts — the
 * voice-tell label variant (Accept rewrite / Write my own / Keep (not a
 * tell)). Undefined (Review Desk's default) is unchanged.
 *
 * Phase 44 (INS-01, Plan 44-07 Task 1): threads an optional `onInspect?`
 * prop into every `AnnotationMark`/`UnresolvedFindingCard` this section
 * mounts (covers the draft passage AND voice finding entry points via the
 * shared finding chain), and renders a lightweight per-section "Inspect how
 * this was made" header affordance for sections with no open finding to
 * hang the action off. Both are gated on `Boolean(onInspect)`; existing
 * callers that omit the prop are unaffected.
 *
 * Phase 45 (REV-01, Plan 45-05 Task 1): every block renderer now stamps
 * `data-block-index` (derived from the synthetic `_key`, `row-{sectionId}-
 * {blockIndex}`, via the 45-01 `blockIndexFromKey` helper — never a second
 * parser) onto its rendered DOM node. This is the ONLY hook the shared
 * `PassageToolbar` (mounted by `Galley.tsx`) needs to resolve an arbitrary
 * `window.getSelection()` back to a block index; this file itself performs
 * no selection handling.
 *
 * Phase 51 (READ-03, D-20, Plan 51-07): when `showClaimEvidenceInFindings`
 * is set, `buildFindingClaimMap` links every open finding to a tracked claim
 * it overlaps, sourced from `claimResolvedForLookup` — the UNFILTERED claim
 * resolution — NEVER the `claimResolved` render array above (that one is
 * already filtered by Galley's `markSourcedClaims`, D-09). Each linked
 * claim is mapped into a `ClaimProvenanceView` (field-for-field identical to
 * ClaimMark.tsx's own mapping) and passed to `AnnotationMark` as `claim`, to
 * render read-only, phrasing-safe evidence beneath the finding's reason.
 */
import { useMemo } from 'react'
import { PortableText, type PortableTextReactComponents } from '@portabletext/react'
import {
  toSyntheticBlocks,
  type ClaimSpanMarkDef,
  type ResolvedClaim,
} from '@/lib/galley/syntheticPortableText'
import type { ResolvedAnnotation, UnresolvedFinding } from '@/lib/galley/spanResolver'
import { blockIndexFromKey } from '@/lib/blockIndexFromKey'
import { buildFindingClaimMap } from '@/lib/galley/findingClaimLink'
import type { ClaimProvenanceView } from '@/components/provenance/ClaimProvenanceCard'
import AnnotationMark from './AnnotationMark'
import ClaimMark from './ClaimMark'
import UnresolvedFindingCard from './UnresolvedFindingCard'

export interface GallerySectionContentBlock {
  type: string
  text: string
}

interface GallerySectionProps {
  sectionId: string
  headline?: string
  deck?: string
  rows: GallerySectionContentBlock[]
  resolved: ResolvedAnnotation[]
  unresolved: UnresolvedFinding[]
  // Phase 33 action context — threaded into AnnotationMark + UnresolvedFindingCard.
  runId: string
  revisionId: string
  reloadDraft: () => Promise<void> | void
  onEditSection: (sectionId: string, findingId?: string) => void
  // Phase 44 (INS-01) — opens the shared inspector on this section's founder
  // artifact. Optional; omitted callers see no "Inspect how this was made"
  // affordance anywhere in this section.
  onInspect?: (sectionId: string) => void
  // Phase 35 (PRV-03) — provenance wash resolution + visibility toggle.
  claimResolved?: ResolvedClaim[]
  showProvenance?: boolean
  // Phase 36 (VOX-02, D-10) — voice-tell AnnotationMark label variant.
  labels?: {
    accept?: string
    editInline?: string
    dismiss?: string
    dismissReasonDefault?: string
  }
  // Phase 41 (WSP-04, Plan 41-03) — optional click-through for an unchecked
  // claim, forwarded unmodified into every ClaimMark this section mounts.
  // Undefined leaves today's toggle-popover-only behavior intact.
  onUnsourcedClaimClick?: (claimIndex: number) => void
  // Phase 51 (D-08, Pitfall 2) — forwarded unmodified into every AnnotationMark.
  generateFixOnAccept?: boolean
  // Phase 51 (D-07) — forwarded into every AnnotationMark AND ClaimMark.
  showAxisTag?: boolean
  // Phase 51 (READ-04, D-10..D-13) — forwarded unmodified into every
  // AnnotationMark. Undefined (Review Desk / Voice Pass) leaves today's
  // single-accept behaviour unchanged.
  findingGroup?: {
    sizeFor: (findingId: string) => number
    acceptGroup: (findingId: string) => Promise<void>
  }
  /** Phase 51 (READ-03, D-20) — mount claim evidence inside finding popovers. */
  showClaimEvidenceInFindings?: boolean
  /**
   * Phase 51 (READ-03, D-20) — the UNFILTERED resolved claims for this
   * section, used ONLY for finding->claim lookup. `claimResolved` above is
   * the D-09 render array and may exclude sourced claims. Falls back to
   * `claimResolved` when absent, so existing callers are unaffected.
   */
  claimResolvedForLookup?: ResolvedClaim[]
}

export default function GallerySection({
  sectionId,
  headline,
  deck,
  rows,
  resolved,
  unresolved,
  runId,
  revisionId,
  reloadDraft,
  onEditSection,
  onInspect,
  claimResolved = [],
  showProvenance = true,
  labels,
  onUnsourcedClaimClick,
  generateFixOnAccept,
  showAxisTag,
  findingGroup,
  showClaimEvidenceInFindings,
  claimResolvedForLookup,
}: GallerySectionProps) {
  // toSyntheticBlocks groups `resolved`/`claimResolved` by blockIndex
  // internally (it filters the flat lists per-row), so the flat arrays are
  // passed directly. showProvenance=false passes [] so no wash renders.
  const syntheticBlocks = toSyntheticBlocks(
    rows,
    resolved,
    sectionId,
    showProvenance ? claimResolved : [],
  )

  // LOOKUP path — `claimResolvedForLookup`, NOT `claimResolved`.
  // `claimResolved` is the D-09 RENDER array, already filtered by
  // `markSourcedClaims` in Galley (plan 51-01 Task 3f). Using it here would
  // mean a finding could only ever link to an UNSOURCED claim — inverting
  // D-20's own field list, since sourceUrl and retrievedAt exist only on
  // SOURCED rows. The render question ("does this claim get a wash?") and
  // the lookup question ("does this finding overlap any tracked claim?")
  // are independent.
  const findingClaimMap = useMemo(
    () =>
      showClaimEvidenceInFindings
        ? buildFindingClaimMap(resolved, claimResolvedForLookup ?? claimResolved ?? [])
        : new Map<string, ResolvedClaim>(),
    [showClaimEvidenceInFindings, resolved, claimResolvedForLookup, claimResolved],
  )

  // Built per-render (memoized on the action context) because
  // marks.annotation must close over runId/revisionId/reloadDraft/
  // onEditSection to hand them to each AnnotationMark.
  const components = useMemo<Partial<PortableTextReactComponents>>(
    () => ({
      block: {
        normal: ({ value, children }) => (
          <p className="galley-body" data-block-index={blockIndexFromKey(value._key ?? '') ?? undefined}>
            {children}
          </p>
        ),
        h2: ({ value, children }) => (
          <h2 className="galley-h2" data-block-index={blockIndexFromKey(value._key ?? '') ?? undefined}>
            {children}
          </h2>
        ),
        h3: ({ value, children }) => (
          <h3 className="galley-h2" data-block-index={blockIndexFromKey(value._key ?? '') ?? undefined}>
            {children}
          </h3>
        ),
        blockquote: ({ value, children }) => (
          <blockquote
            className="galley-pullquote"
            data-block-index={blockIndexFromKey(value._key ?? '') ?? undefined}
          >
            {children}
          </blockquote>
        ),
      },
      marks: {
        annotation: ({ value, children }) => {
          // Phase 51 (READ-03, D-20) — same field mapping ClaimMark.tsx:107-114
          // uses, so the two popovers can never disagree about the same claim.
          const c = findingClaimMap.get(value.findingId)
          const claimView: ClaimProvenanceView | undefined = c
            ? {
                text: c.text,
                importance: c.importance,
                status: c.status,
                sourceUrl: c.sourceUrl,
                supportingPassage: c.context,
                retrievedAt: c.retrievedAt,
                sectionName: sectionId,
              }
            : undefined
          return (
            <AnnotationMark
              value={value}
              runId={runId}
              sectionId={sectionId}
              revisionId={revisionId}
              reloadDraft={reloadDraft}
              onEditSection={onEditSection}
              onInspect={onInspect}
              labels={labels}
              generateFixOnAccept={generateFixOnAccept}
              showAxisTag={showAxisTag}
              findingGroup={findingGroup}
              claim={claimView}
            >
              {children}
            </AnnotationMark>
          )
        },
        claimSpan: ({ value, children }) => (
          <ClaimMark
            value={value as ClaimSpanMarkDef}
            runId={runId}
            onUnsourcedClaimClick={onUnsourcedClaimClick}
            showAxisTag={showAxisTag}
          >
            {children}
          </ClaimMark>
        ),
      },
    }),
    [
      runId,
      sectionId,
      revisionId,
      reloadDraft,
      onEditSection,
      onInspect,
      labels,
      onUnsourcedClaimClick,
      generateFixOnAccept,
      showAxisTag,
      findingGroup,
      findingClaimMap,
      showClaimEvidenceInFindings,
    ],
  )

  return (
    <section id={`galley-${sectionId}`} className="galley-section">
      {(headline || onInspect) && (
        <div className="galley-section__header flex items-center justify-between gap-2">
          {headline && <h2 className="galley-headline">{headline}</h2>}
          {onInspect && (
            <button
              type="button"
              onClick={() => onInspect(sectionId)}
              className="min-h-[44px] shrink-0 rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)]"
            >
              Inspect how this was made
            </button>
          )}
        </div>
      )}
      {deck && <p className="galley-deck">{deck}</p>}

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <PortableText value={syntheticBlocks as any} components={components} />

      {unresolved.map((finding) => (
        <UnresolvedFindingCard
          key={finding.findingId}
          finding={finding}
          runId={runId}
          sectionId={sectionId}
          onEditSection={onEditSection}
          onInspect={onInspect}
        />
      ))}
    </section>
  )
}
