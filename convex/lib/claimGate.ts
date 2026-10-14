/**
 * Phase 51.1 — THE claim gate. API_CONTRACTS §51.1.2/§51.1.3.
 * Imported by convex/claimChecks.ts AND by dispatch-control via '@convex/lib/claimGate'.
 * Do not re-implement these expressions anywhere else (client/server drift caused a 9-day outage, Phase 34).
 */
export type ClaimVerdict = 'verified' | 'contradicted' | 'unverifiable'

/** Structural row shape — satisfied by full Convex docs AND dashboard lean projections. */
export interface ClaimGateRow {
  status: string
  verdict?: string
  importance?: string
  changedSinceCheck?: boolean
}

export function isOpenBlocking(row: ClaimGateRow): boolean {
  return row.verdict === 'contradicted' && row.status === 'pending' && row.changedSinceCheck !== true
}

export function isEditorFlagged(row: ClaimGateRow): boolean {
  if (row.status !== 'pending' || row.changedSinceCheck === true) return false
  if (row.verdict === 'contradicted') return true
  return row.verdict === 'unverifiable' && (row.importance ?? 'Supporting') === 'Load-bearing'
}

export interface ClaimGateSummary {
  total: number
  signedOff: number
  blocking: number
  flagged: number
  allSignedOff: boolean
}

export function summarizeClaimGate(rows: ClaimGateRow[]): ClaimGateSummary {
  const blocking = rows.filter(isOpenBlocking).length
  return {
    total: rows.length,
    signedOff: rows.filter(r => r.status !== 'pending').length,
    blocking,
    flagged: rows.filter(isEditorFlagged).length,
    allSignedOff: blocking === 0,
  }
}
