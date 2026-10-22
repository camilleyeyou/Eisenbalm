/**
 * Quick 261022-cr6 (client bug 8) — a run paused at the Gate-1 interrupt
 * leaves its `editor_gate_1` agent_runs row 'failed' with a Python
 * `Interrupt(value={...})` repr as the error. That is a pause, not a failure.
 * Pure helpers so the UI can say "Waiting for you" and never print the repr.
 */

export function isGateInterrupt(row: { agentKey?: string; status: string; error?: string | null }): boolean {
  if (row.status !== 'failed') return false
  return /^\[?\s*Interrupt\(/.test((row.error ?? '').trim())
}

/** Pulls candidate charity names out of the repr. Deduped, max 5. Unparseable -> []. */
export function summarizeInterrupt(error: string): { candidates: string[] } {
  const seen = new Set<string>()
  const re = /['"](?:charityName|name)['"]:\s*(?:'([^']+)'|"([^"]+)")/g
  let m: RegExpExecArray | null
  while ((m = re.exec(error ?? '')) !== null) {
    const name = (m[1] ?? m[2] ?? '').trim()
    if (name) seen.add(name)
    if (seen.size >= 5) break
  }
  return { candidates: [...seen] }
}
