'use client'
/**
 * Phase 47 Plan 47-05 (BRF-01) — LeadCard: the never-truncated Stage-1 lead
 * card. Reads a single `story_leads` row (from `ws.storyLeads`,
 * `WorkspaceStateProvider`'s Phase 47 subscription — see
 * `WorkspaceStateProvider.tsx`) and renders EVERY field in full — premise,
 * dated peg + `pegSourceUrl` source link, reader energy, charitable angle,
 * category, confidence, and (when present) the brand-risk warning — per
 * `docs/design/dispatch-control-v3/Dispatch Control v3 - Annotations.md`
 * §Stage 1 (~L50).
 *
 * The brand-risk warning mirrors `signal-desk/_components/CandidateSlate.tsx`'s
 * `primaryConcern` block EXACTLY: always visible when `brandRiskFlag` is
 * true, rendered in full, no `line-clamp`/`truncate` utility class anywhere
 * in this file, no `title=` tooltip-hiding attribute. `repetitionWarning`
 * (when present) renders as its own always-visible advisory line — it never
 * suppresses or replaces the rest of the card.
 */

export interface StoryLead {
  _id: string
  premise: string
  datedPeg: string
  pegSourceUrl: string
  readerEnergy: string
  charitableAngle: string
  category: string
  confidence: string
  brandRiskFlag: boolean
  brandRiskReason?: string
  repetitionWarning?: string
  recommended: boolean
  status?: 'active' | 'required' | 'removed'
}

export interface LeadCardProps {
  lead: StoryLead
}

export function LeadCard({ lead }: LeadCardProps) {
  return (
    <li
      data-testid={`lead-card-${lead._id}`}
      className="flex flex-col gap-2 border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
          {lead.category}
        </span>
        <span className="flex items-center gap-2">
          {/* fast 260723 — durable operator-action state. `status` was in the
              type but never rendered, so a successful Require/Remove changed
              NOTHING visible on the card (the operator reported clicking with
              no effect). Chip updates live via the existing Convex
              subscription the moment storyLeads:setStatus lands. */}
          {lead.status === 'required' && (
            <span
              data-testid={`lead-status-${lead._id}`}
              className="bg-[color:var(--color-green)] px-2 py-0.5 font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-white"
            >
              Required — locked in
            </span>
          )}
          {lead.status === 'removed' && (
            <span
              data-testid={`lead-status-${lead._id}`}
              className="bg-[color:var(--color-vermilion)] px-2 py-0.5 font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-white"
            >
              Removed
            </span>
          )}
          {lead.recommended && (
            <span
              data-testid={`lead-recommended-${lead._id}`}
              className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-green)]"
            >
              Recommended
            </span>
          )}
        </span>
      </div>

      {/* premise — ALWAYS visible, rendered in FULL, never clipped. */}
      <p
        data-testid={`lead-premise-${lead._id}`}
        className="font-[family-name:var(--font-display)] text-[16px] leading-relaxed text-[color:var(--color-ink)]"
      >
        {lead.premise}
      </p>

      {/* dated peg + source — the source is a real, sourced <a href> link, never bare text. */}
      <div>
        <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-ink-soft)]">
          Dated peg
        </span>
        <p
          data-testid={`lead-peg-${lead._id}`}
          className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
        >
          {lead.datedPeg}{' '}
          <a
            data-testid={`lead-peg-source-${lead._id}`}
            href={lead.pegSourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[color:var(--color-cobalt)] underline"
          >
            Source
          </a>
        </p>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)]">
        <dt className="text-[color:var(--color-ink-soft)]">Reader energy</dt>
        <dd data-testid={`lead-reader-energy-${lead._id}`}>{lead.readerEnergy}</dd>
        <dt className="text-[color:var(--color-ink-soft)]">Charitable angle</dt>
        <dd data-testid={`lead-angle-${lead._id}`}>{lead.charitableAngle}</dd>
        <dt className="text-[color:var(--color-ink-soft)]">Confidence</dt>
        <dd data-testid={`lead-confidence-${lead._id}`}>{lead.confidence}</dd>
      </dl>

      {/* brandRiskReason — ALWAYS visible when brandRiskFlag, rendered in FULL,
          never clipped, never a title= tooltip. */}
      {lead.brandRiskFlag && (
        <div className="border-t border-[color:var(--color-faint)] pt-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-vermilion)]">
            Brand-risk warning
          </span>
          <p
            data-testid={`brand-risk-reason-${lead._id}`}
            className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
          >
            {lead.brandRiskReason || '—'}
          </p>
        </div>
      )}

      {/* repetitionWarning — an always-visible advisory when present; never
          suppresses the rest of the card. */}
      {lead.repetitionWarning && (
        <div className="border-t border-[color:var(--color-faint)] pt-1.5">
          <span className="font-[family-name:var(--font-ui)] text-[10px] font-semibold uppercase tracking-[.06em] text-[color:var(--color-marigold-text)]">
            Repetition warning
          </span>
          <p
            data-testid={`lead-repetition-warning-${lead._id}`}
            className="mt-0.5 text-[13px] leading-relaxed text-[color:var(--color-ink)]"
          >
            {lead.repetitionWarning}
          </p>
        </div>
      )}
    </li>
  )
}
