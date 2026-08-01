'use client'
/**
 * Phase 42 (FCT-04, D-09/D-10/D-11, Plan 42-06 Task 1) — the ONE shared
 * claim provenance card.
 *
 * Renders the DERIVED-STATE-CONTRACT §5 / API_CONTRACTS §42.6 claim shape:
 * `{ text, importance, status, sourceUrl, sourcePublisher, supportingPassage,
 * retrievedAt, agent, confidence }` — consumed by Stage 3 Fact Check (this
 * plan), and reused (not forked) by Stage 2 Draft, Stage 5 Approval, and the
 * Phase 44 inspector (Plan 42-07+). D-09 forbids three copies.
 *
 * Field sourcing (D-10 — only `importance` is genuinely new, everything
 * else derives):
 *   - text/status/sourceUrl/retrievedAt/sectionName: straight from
 *     `claim_checks` (passed in by the caller).
 *   - sourcePublisher: derived from `sourceUrl`'s host (`deriveSourcePublisher`,
 *     exported below for Plan 42-07 reuse).
 *   - supportingPassage: the caller passes `context` (± blockIndexHint
 *     window) in directly; this component only renders it honestly.
 *   - agent: derived from `sectionName` via `galleyIdToQaSection` + a
 *     5-entry label map (`deriveClaimAgent`, exported below).
 *   - confidence: always "—" in this phase (no stored source yet, per
 *     §42.6 — never invent a value).
 *
 * Never-blank guarantees (D-08 extended to "never fabricate a value"):
 *   - no sourceUrl -> "Unsourced" (not blank)
 *   - importance absent -> "Supporting" (D-03 fallback, never blank)
 *   - agent absent -> "—" (never a guess)
 *   - confidence -> always "—" this phase (never blank, never invented)
 *
 * The per-claim status chip uses the D-08 locked 5-state vocabulary (✓
 * Checked / ✕ Must fix / Unchecked / Review recommended / Changed) — label +
 * icon, never color alone (D-23) — reusing the SAME `isMustFix` predicate
 * `lib/derivedState.ts` already exports, so the card's own chip can never
 * silently disagree with the Stage 3 summary/table (D-16).
 *
 * The six actions (Confirm · Edit claim · Replace source · Ask agent for
 * better evidence · Remove claim · Keep as written) plus Open source +
 * Inspect (D-11) all render as isolated controls, structured so a Phase 49
 * wrapper can later replace any one of them with a locked-with-explanation
 * render — none are ever hidden here. Each reason/text/URL-collecting action
 * reveals its own small inline form (mirrors `UnresolvedFindingCard.tsx`'s
 * reveal-then-confirm pattern) rather than a native browser prompt.
 */
import { useState } from 'react'
import { galleyIdToQaSection } from '@/lib/galley/sectionIdMap'
import { isMustFix, type FactCheckClaimRow } from '@/lib/derivedState'

// ── Field-sourcing pure helpers (D-10 — exported for Plan 42-07 reuse) ──────

/**
 * A tiny curated map for well-known outlets; anything else falls back to the
 * bare host (both are acceptable per §42.6's "Post and Courier" OR "the bare
 * host" framing) — never a fabricated publisher name.
 */
const KNOWN_PUBLISHERS: Record<string, string> = {
  'postandcourier.com': 'Post and Courier',
}

/** Derives a human `sourcePublisher` from `sourceUrl`'s host. Pure, tested. */
export function deriveSourcePublisher(sourceUrl?: string): string {
  if (!sourceUrl) return 'Unsourced'
  let host: string
  try {
    host = new URL(sourceUrl).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return 'Unsourced'
  }
  if (!host) return 'Unsourced'
  return KNOWN_PUBLISHERS[host] ?? host
}

// `galleyIdToQaSection` maps a claim_checks `sectionName` (galley vocabulary,
// e.g. "problemStatement") to the QA snake_case key ("problem") this label
// map is keyed on — reusing the ONE existing bidirectional bridge rather
// than inventing a second galleyId->agent map (42-RESEARCH Pattern 5).
const SECTION_AGENT_LABELS: Record<string, string> = {
  origin_story: 'Origin Story Writer',
  problem: 'Problem Writer',
  founder_bio: 'Founder Bio Writer',
  case_study: 'Case Study Writer',
  bonus: 'Bonus Writer',
}

/** Derives a human `agent` label from a claim's `sectionName`. Pure, tested. */
export function deriveClaimAgent(sectionName?: string): string {
  if (!sectionName) return '—'
  const qaKey = galleyIdToQaSection(sectionName)
  if (!qaKey) return '—'
  return SECTION_AGENT_LABELS[qaKey] ?? '—'
}

function formatRetrievedAt(ms?: number): string {
  if (!ms) return '—'
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toISOString().slice(0, 10)
}

// ── The claim shape + the D-08 chip derivation ──────────────────────────────

export type ClaimImportance = 'Load-bearing' | 'Supporting' | 'Incidental'

/**
 * The card's own props shape (§42.6). `changedSinceCheck` is an additive
 * optional beyond the bare §42.6 list — it lets the ONE shared chip
 * derivation below render D-08's "Changed" state when a caller has it (the
 * Stage 3 claim table, which reads full rows, always does); a caller that
 * omits it simply never shows "Changed" on the card itself.
 */
export interface ClaimProvenanceView {
  text: string
  importance?: ClaimImportance
  status: string
  sourceUrl?: string
  supportingPassage?: string
  retrievedAt?: number
  sectionName?: string
  confidence?: number
  changedSinceCheck?: boolean
}

export interface ClaimCardActions {
  onConfirm?: () => void
  onEdit?: (newText: string) => void
  onReplaceSource?: (sourceUrl: string) => void
  onAskAgent?: () => void
  onRemove?: (reason?: string) => void
  onKeep?: (reason: string) => void
  onOpenSource?: () => void
  onInspect?: () => void
}

interface ClaimProvenanceCardProps {
  claim: ClaimProvenanceView
  actions?: ClaimCardActions
  busy?: boolean
  /**
   * Phase 51 (D-20, Pitfall 1) — render every container as
   * `<span style={{ display: 'block' }}>` instead of `<div>`/`<p>`/`<h3>` so
   * this card can legally mount inside a galley popover, which is PHRASING
   * CONTENT (it renders inside the galley's <p> elements). Visual output is
   * unchanged — only the element types change. Default false = today's
   * block markup, byte-identical for every existing caller.
   */
  phrasingSafe?: boolean
}

export type ClaimChipState = 'checked' | 'must-fix' | 'unchecked' | 'review-recommended' | 'changed'

const CHIP_META: Record<ClaimChipState, { icon: string; label: string }> = {
  checked: { icon: '✓', label: 'Checked' },
  'must-fix': { icon: '✕', label: 'Must fix' },
  unchecked: { icon: '○', label: 'Unchecked' },
  'review-recommended': { icon: '△', label: 'Review recommended' },
  changed: { icon: '⟳', label: 'Changed' },
}

/**
 * D-08's locked 5-state per-claim chip vocabulary. Reuses `isMustFix` (the
 * SAME predicate the Stage 3 summary/table use) so this card can never
 * silently disagree with them (D-16). Exported so the Stage 3 claim table
 * (Plan 42-06 Task 3) renders the identical chip per row.
 */
export function deriveClaimChipState(claim: ClaimProvenanceView): ClaimChipState {
  if (claim.changedSinceCheck) return 'changed'
  if (claim.status !== 'pending') return 'checked'
  const row: FactCheckClaimRow = {
    status: claim.status,
    importance: claim.importance,
    sourceUrl: claim.sourceUrl,
  }
  if (isMustFix(row)) return 'must-fix'
  if (!claim.sourceUrl) return 'review-recommended'
  return 'unchecked'
}

const FIELD_LABEL =
  'font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.09em] text-[color:var(--color-ink-soft)]'

const ACTION_BUTTON =
  'min-h-[44px] rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-[color:var(--color-ink)] hover:bg-[color:var(--color-card-alt)] disabled:cursor-not-allowed disabled:opacity-40'

const INLINE_INPUT =
  'min-h-[44px] w-full rounded-[2px] border border-[color:var(--color-faint)] bg-white px-3 py-1.5 text-xs text-[color:var(--color-ink)]'

export default function ClaimProvenanceCard({
  claim,
  actions,
  busy,
  phrasingSafe,
}: ClaimProvenanceCardProps) {
  // Phase 51 (D-20, Pitfall 1) — element-type aliases only; no visual,
  // className, copy, or handler change. See prop doc-comment above.
  const Box = phrasingSafe ? 'span' : 'div'
  const Txt = phrasingSafe ? 'span' : 'p'
  const boxStyle = phrasingSafe ? ({ display: 'block' } as React.CSSProperties) : undefined
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(claim.text)
  const [replacingSource, setReplacingSource] = useState(false)
  const [newSourceUrl, setNewSourceUrl] = useState('')
  const [keeping, setKeeping] = useState(false)
  const [keepReason, setKeepReason] = useState('')
  const [removing, setRemoving] = useState(false)
  const [removeReason, setRemoveReason] = useState('')

  const disabled = Boolean(busy)

  const chip = deriveClaimChipState(claim)
  const chipMeta = CHIP_META[chip]
  // D-03 fallback — a legacy row with no importance renders "Supporting",
  // never blank.
  const importanceLabel = claim.importance ?? 'Supporting'
  const sourcePublisher = deriveSourcePublisher(claim.sourceUrl)
  const agent = deriveClaimAgent(claim.sectionName)
  // §42.6 — confidence has no stored source yet in this phase; always "—",
  // never fabricated.
  const confidenceLabel = claim.confidence !== undefined ? String(claim.confidence) : '—'
  const retrievedLabel = formatRetrievedAt(claim.retrievedAt)

  return (
    <Box
      className="flex flex-col gap-3 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4"
      style={boxStyle}
      data-testid="claim-provenance-card"
    >
      <Box style={boxStyle}>
        <Txt className={FIELD_LABEL} style={boxStyle}>
          Claim
        </Txt>
        <Txt
          className="mt-1 text-[14px] leading-snug text-[color:var(--color-ink)]"
          style={boxStyle}
        >
          {claim.text}
        </Txt>
      </Box>

      <Box className="flex flex-wrap items-center gap-x-4 gap-y-2" style={boxStyle}>
        <span className={`${FIELD_LABEL} text-[color:var(--color-ink)]`}>
          <span aria-hidden="true">{chipMeta.icon}</span> {chipMeta.label}
        </span>
        <span className={FIELD_LABEL}>
          Importance:{' '}
          <span className="normal-case font-normal text-[color:var(--color-ink)]">
            {importanceLabel}
          </span>
        </span>
        <span className={FIELD_LABEL}>
          Confidence:{' '}
          <span className="normal-case font-normal text-[color:var(--color-ink)]">
            {confidenceLabel}
          </span>
        </span>
      </Box>

      <Box style={boxStyle}>
        <Txt className={FIELD_LABEL} style={boxStyle}>
          Source
        </Txt>
        <Txt className="mt-1 text-[13px] text-[color:var(--color-ink)]" style={boxStyle}>
          {sourcePublisher}
          {claim.sourceUrl && retrievedLabel !== '—' ? ` · retrieved ${retrievedLabel}` : null}
        </Txt>
        {/*
         * Phase 51 (READ-03, D-20) — the raw source URL as its own visible
         * text line, not just the derived-host `sourcePublisher` above and
         * not just an `href` attribute buried in "Open source" below (an
         * attribute value is invisible to `textContent` and to a reader who
         * doesn't hover/click). D-20's own truth is "shows that claim's
         * source URL" — this is the ONE shared card (D-09/D-16), so every
         * caller (Stage 3, Stage 5, ClaimMark, this popover) gains it
         * identically rather than a per-caller fork.
         */}
        {claim.sourceUrl && (
          <Txt
            className="mt-0.5 break-all text-[12px] text-[color:var(--color-ink-soft)]"
            style={boxStyle}
          >
            {claim.sourceUrl}
          </Txt>
        )}
      </Box>

      <Box style={boxStyle}>
        <Txt className={FIELD_LABEL} style={boxStyle}>
          Supporting passage
        </Txt>
        <Txt
          className="mt-1 text-[13px] italic text-[color:var(--color-ink-soft)]"
          style={boxStyle}
        >
          {claim.supportingPassage || 'No supporting passage recorded.'}
        </Txt>
      </Box>

      <Box style={boxStyle}>
        <Txt className={FIELD_LABEL} style={boxStyle}>
          Agent
        </Txt>
        <Txt className="mt-1 text-[13px] text-[color:var(--color-ink)]" style={boxStyle}>
          {agent}
        </Txt>
      </Box>

      {/* ── Action controls (D-11 — isolated, none hidden; Phase 49 wraps) ── */}
      <Box
        className="flex flex-wrap gap-2 border-t border-[color:var(--color-faint)] pt-3"
        style={boxStyle}
      >
        <button
          type="button"
          className={ACTION_BUTTON}
          disabled={disabled || !actions?.onConfirm}
          onClick={() => actions?.onConfirm?.()}
        >
          Confirm
        </button>

        {!editing ? (
          <button
            type="button"
            className={ACTION_BUTTON}
            disabled={disabled || !actions?.onEdit}
            onClick={() => setEditing(true)}
          >
            Edit claim
          </button>
        ) : (
          <span className="flex w-full flex-col gap-2">
            <textarea
              aria-label="Edit claim text"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              className={`min-h-[60px] ${INLINE_INPUT}`}
            />
            <span className="flex gap-2">
              <button
                type="button"
                className={ACTION_BUTTON}
                disabled={disabled || editText.trim() === ''}
                onClick={() => {
                  actions?.onEdit?.(editText.trim())
                  setEditing(false)
                }}
              >
                Save edit
              </button>
              <button
                type="button"
                className={ACTION_BUTTON}
                onClick={() => {
                  setEditing(false)
                  setEditText(claim.text)
                }}
              >
                Cancel
              </button>
            </span>
          </span>
        )}

        {!replacingSource ? (
          <button
            type="button"
            className={ACTION_BUTTON}
            disabled={disabled || !actions?.onReplaceSource}
            onClick={() => setReplacingSource(true)}
          >
            Replace source
          </button>
        ) : (
          <span className="flex w-full flex-col gap-2">
            <input
              aria-label="Replacement source URL"
              placeholder="https://…"
              value={newSourceUrl}
              onChange={e => setNewSourceUrl(e.target.value)}
              className={INLINE_INPUT}
            />
            <span className="flex gap-2">
              <button
                type="button"
                className={ACTION_BUTTON}
                disabled={disabled || newSourceUrl.trim() === ''}
                onClick={() => {
                  actions?.onReplaceSource?.(newSourceUrl.trim())
                  setReplacingSource(false)
                  setNewSourceUrl('')
                }}
              >
                Confirm replace
              </button>
              <button type="button" className={ACTION_BUTTON} onClick={() => setReplacingSource(false)}>
                Cancel
              </button>
            </span>
          </span>
        )}

        <button
          type="button"
          className={ACTION_BUTTON}
          disabled={disabled || !actions?.onAskAgent}
          onClick={() => actions?.onAskAgent?.()}
        >
          Ask agent for better evidence
        </button>

        {!removing ? (
          <button
            type="button"
            className={ACTION_BUTTON}
            disabled={disabled || !actions?.onRemove}
            onClick={() => setRemoving(true)}
          >
            Remove claim
          </button>
        ) : (
          <span className="flex w-full flex-col gap-2">
            <input
              aria-label="Removal reason (optional)"
              placeholder="Why remove this claim? (optional)"
              value={removeReason}
              onChange={e => setRemoveReason(e.target.value)}
              className={INLINE_INPUT}
            />
            <span className="flex gap-2">
              <button
                type="button"
                className={ACTION_BUTTON}
                disabled={disabled}
                onClick={() => {
                  actions?.onRemove?.(removeReason.trim() || undefined)
                  setRemoving(false)
                  setRemoveReason('')
                }}
              >
                Confirm remove
              </button>
              <button type="button" className={ACTION_BUTTON} onClick={() => setRemoving(false)}>
                Cancel
              </button>
            </span>
          </span>
        )}

        {!keeping ? (
          <button
            type="button"
            className={ACTION_BUTTON}
            disabled={disabled || !actions?.onKeep}
            onClick={() => setKeeping(true)}
          >
            Keep as written
          </button>
        ) : (
          <span className="flex w-full flex-col gap-2">
            <input
              aria-label="Reason for keeping as written"
              placeholder="Why keep this as written?"
              value={keepReason}
              onChange={e => setKeepReason(e.target.value)}
              className={INLINE_INPUT}
            />
            <span className="flex gap-2">
              <button
                type="button"
                className={ACTION_BUTTON}
                disabled={disabled || keepReason.trim() === ''}
                onClick={() => {
                  actions?.onKeep?.(keepReason.trim())
                  setKeeping(false)
                  setKeepReason('')
                }}
              >
                Confirm keep
              </button>
              <button type="button" className={ACTION_BUTTON} onClick={() => setKeeping(false)}>
                Cancel
              </button>
            </span>
          </span>
        )}

        {claim.sourceUrl ? (
          <a
            href={claim.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => actions?.onOpenSource?.()}
            className={`${ACTION_BUTTON} inline-flex items-center justify-center text-center no-underline`}
          >
            Open source
          </a>
        ) : (
          <button
            type="button"
            className={ACTION_BUTTON}
            disabled
            title="No source recorded for this claim."
          >
            Open source
          </button>
        )}

        <button
          type="button"
          className={ACTION_BUTTON}
          disabled={disabled || !actions?.onInspect}
          onClick={() => actions?.onInspect?.()}
        >
          Inspect
        </button>
      </Box>
    </Box>
  )
}

// ── ClaimProvenanceRow (D-09, Plan 42-07 Task 2) ────────────────────────────
//
// Stage 5 Approval's SourceIndex lists every claim in a run at once — a full
// six-action card per row would be far too heavy for that list, and Approval
// doesn't expose the Fact Check six-action set anyway (only check/skip,
// D-12/D-14). This compact row reuses the SAME field-sourcing helpers/
// constants the full card above uses (deriveSourcePublisher, deriveClaimAgent,
// deriveClaimChipState, CHIP_META, formatRetrievedAt) — it is a lighter
// LAYOUT over the identical field mapping, never a forked derivation (D-16).
// The caller (SourceIndex) supplies its own action controls (Open source /
// Jump to section / Check / Skip) via `children`, rendered below the fields.

export interface ClaimProvenanceRowProps {
  claim: ClaimProvenanceView
  children?: React.ReactNode
}

export function ClaimProvenanceRow({ claim, children }: ClaimProvenanceRowProps) {
  const chip = deriveClaimChipState(claim)
  const chipMeta = CHIP_META[chip]
  // D-03 fallback — never blank.
  const importanceLabel = claim.importance ?? 'Supporting'
  const sourcePublisher = deriveSourcePublisher(claim.sourceUrl)
  const agent = deriveClaimAgent(claim.sectionName)
  const retrievedLabel = formatRetrievedAt(claim.retrievedAt)

  return (
    <div className="flex flex-col gap-1.5" data-testid="claim-provenance-row">
      <p className="text-[13px] leading-snug text-[color:var(--color-ink)]">{claim.text}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className={`${FIELD_LABEL} text-[color:var(--color-ink)]`}>
          <span aria-hidden="true">{chipMeta.icon}</span> {chipMeta.label}
        </span>
        <span className={FIELD_LABEL}>
          <span className="normal-case font-normal">{importanceLabel}</span>
        </span>
        {/*
         * Omitted entirely (rather than showing "Unsourced") when there is
         * no sourceUrl — SourceIndex already groups unsourced claims under
         * their own "Unsourced" heading (D-14), so repeating the same exact
         * text per row would both be redundant AND (in tests) collide with
         * `getByText(/^unsourced$/i)` matching the group header. The full
         * ClaimProvenanceCard (Stage 3/Draft, no such heading) still shows
         * "Unsourced" honestly (D-08) — this is a lighter LAYOUT choice, not
         * a change to `deriveSourcePublisher` itself.
         */}
        {claim.sourceUrl && (
          <span className="text-[12px] text-[color:var(--color-ink-soft)]">
            {sourcePublisher}
            {retrievedLabel !== '—' ? ` · retrieved ${retrievedLabel}` : null}
          </span>
        )}
        <span className="text-[12px] text-[color:var(--color-ink-soft)]">{agent}</span>
      </div>
      {claim.supportingPassage && (
        <p className="text-[12px] italic text-[color:var(--color-ink-soft)]">
          {claim.supportingPassage}
        </p>
      )}
      {children}
    </div>
  )
}
