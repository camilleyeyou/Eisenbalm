/**
 * summarize() / prettyJson() — shared human-readable-first JSON rendering
 * helpers (docs/API_CONTRACTS.md §44, INS-02, 44-RESEARCH.md "Don't
 * Hand-Roll").
 *
 * Extracted VERBATIM from
 * `app/(dashboard)/run-monitor/graph/_components/AgentIOPanel.tsx` (Phase
 * 23/37) so the Run Details handoff inspector and the new universal 7-tab
 * InspectorPanel (Phase 44) never drift into two summarizers. Byte-identical
 * behavior to the pre-extraction inline functions — Run Details relies on
 * it exactly as before.
 */

/** Pretty-print a JSON string for display (raw JSON, behind the toggle). */
export function prettyJson(raw: string | undefined): string {
  if (!raw) return '—'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

/**
 * Compact, human-readable one-line summary of a snapshot: top-level key
 * highlights rather than the full structure (the full structure is the raw
 * JSON behind the toggle).
 */
export function summarize(raw: string | undefined): string {
  if (!raw) return '—'
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed as Record<string, unknown>).slice(0, 6)
      return keys.length > 0 ? keys.join(', ') : '(empty object)'
    }
    if (Array.isArray(parsed)) {
      return `array (${parsed.length} items)`
    }
    return String(parsed).slice(0, 120)
  } catch {
    return raw.slice(0, 120)
  }
}
