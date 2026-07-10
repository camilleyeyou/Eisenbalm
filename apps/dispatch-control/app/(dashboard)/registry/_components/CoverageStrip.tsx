'use client'
/**
 * Phase 39 (MEM-01) — CoverageStrip: the coverage-memory strip at the top of
 * the Registry, visualizing the last-8 featured charities' cause/geo/signal
 * chips so thematic repetition ("three housing causes in a row") is
 * scannable at a glance (design README §Registry).
 *
 * Fetches GET /registry/coverage-strip via the authenticated pipeline fetch
 * client (coverageStripClient.ts, mirrors findingsClient.ts) — this
 * dashboard has zero Sanity access (EDT-05); the endpoint performs the
 * Convex charities -> Sanity focusArea/location/scoutNotes join server-side
 * (39-02).
 *
 * D-04: purely visual — repetition is shown side by side, never reduced to
 * a computed diversity number. Columns for a legacy charity missing a
 * sanityCharityId (or missing an individual chip) render an explicit
 * empty-chip affordance ("—"), never crash and never render "undefined".
 */
import { useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { fetchCoverageStrip, type CoverageColumn } from '@/lib/coverageStripClient'

/** Signal chips (scoutNotes) can be long free text — truncate for the strip. */
function truncateSignal(signal: string, maxLen = 64): string {
  if (signal.length <= maxLen) return signal
  return signal.slice(0, maxLen) + '…'
}

interface ChipProps {
  label: string
  value?: string | null
  /** A `--color-*` custom-property name from the 1c token set. */
  colorVar: string
  truncate?: boolean
}

/** One labeled chip within a column. Null/absent renders an explicit "—". */
function Chip({ label, value, colorVar, truncate }: ChipProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-[family-name:var(--font-ui)] text-[9px] font-semibold uppercase tracking-[.09em] text-[color:var(--color-faint)]">
        {label}
      </span>
      {value ? (
        <span
          title={truncate ? value : undefined}
          className="font-[family-name:var(--font-ui)] text-[12px] font-medium leading-snug"
          style={{ color: `var(${colorVar})` }}
        >
          {truncate ? truncateSignal(value) : value}
        </span>
      ) : (
        <span
          data-testid="coverage-chip-empty"
          className="font-[family-name:var(--font-ui)] text-[12px] text-[color:var(--color-faint)]"
        >
          —
        </span>
      )}
    </div>
  )
}

export function CoverageStrip() {
  const { getToken } = useAuth()
  const [columns, setColumns] = useState<CoverageColumn[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const token = await getToken()
        const data = await fetchCoverageStrip(token)
        if (!cancelled) setColumns(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
    }

    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section
      aria-label="Coverage memory"
      className="border border-[color:var(--color-faint)] bg-[color:var(--color-card)] p-4"
    >
      <h2 className="font-[family-name:var(--font-ui)] text-[9.5px] font-semibold uppercase tracking-[.1em] text-[color:var(--color-ink-soft)]">
        Coverage memory — last 8
      </h2>

      {error && (
        <p role="alert" className="mt-2 text-[12px] text-[color:var(--color-vermilion)]">
          {error}
        </p>
      )}

      {columns === null && !error && (
        <p className="mt-2 text-[12px] text-[color:var(--color-ink-soft)]">
          Loading coverage memory…
        </p>
      )}

      {columns !== null && columns.length === 0 && (
        <p className="mt-2 text-[12px] italic text-[color:var(--color-ink-soft)]">
          No featured charities yet.
        </p>
      )}

      {columns !== null && columns.length > 0 && (
        <div className="mt-3 flex gap-4 overflow-x-auto" data-testid="coverage-strip-columns">
          {columns.map((col, i) => (
            <div
              key={col.sanityCharityId ?? `${col.name}-${i}`}
              data-testid={`coverage-column-${i}`}
              className="flex min-w-[140px] flex-col gap-2 border-l-2 border-[color:var(--color-faint)] pl-3"
            >
              <p className="font-[family-name:var(--font-display)] text-[13px] font-semibold text-[color:var(--color-ink)]">
                {col.name}
              </p>
              <Chip label="Cause" value={col.cause} colorVar="--color-cobalt" />
              <Chip label="Geo" value={col.geo} colorVar="--color-green" />
              <Chip label="Signal" value={col.signal} colorVar="--color-marigold-text" truncate />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default CoverageStrip
