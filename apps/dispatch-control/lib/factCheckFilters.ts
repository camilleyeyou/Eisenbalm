/**
 * Phase 42 (FCT-03, D-12/D-13, Plan 42-06 Task 2) — the 7 Stage 3 claim-table
 * filter predicates.
 *
 * Pure, client-side derived predicates over the FULL `claim_checks` rows
 * FactCheckScreen subscribes to (`claimType`/`context` included — the lean
 * `WorkspaceStateProvider.claimRows` projection is NOT what this operates
 * on). No new Convex queries (D-12).
 *
 * Multi-select semantics (documented default, D-12): a claim matching ANY
 * active filter chip is included in the result — an OR-union across active
 * chips, not an AND-intersection. With zero active filters, every live
 * (non-removed) row passes through unfiltered.
 *
 * `status === 'removed'` rows (Remove claim's soft-delete, §42.3) are
 * excluded from every filter result set up front — a tombstoned claim is
 * not an editable claim (42-RESEARCH.md Pitfall 4).
 *
 * `isMustFix` is imported from `./derivedState` (the SAME predicate the
 * Stage 3 summary and My Tasks use) rather than reimplemented — see D-16 /
 * 42-RESEARCH.md's "don't let deriveFactCheckStage/deriveTasks silently
 * diverge" anti-pattern.
 *
 * The people/org split and the weak-source heuristic are documented,
 * intentionally light heuristics (D-13) — `claimType` stays
 * `"number" | "date" | "proper_noun"` in storage; no new stored subtype is
 * introduced here.
 */
import { isMustFix } from './derivedState'

export interface FactCheckFilterRow {
  status: string
  importance?: string
  sourceUrl?: string
  changedSinceCheck?: boolean
  claimType?: string
  text?: string
}

// D-13: a light org-suffix heuristic splits `claimType === 'proper_noun'`
// into "organization claims" vs "people & titles" — refinement is deferred;
// do not expand claimType's stored vocabulary to formalize this.
const ORG_SUFFIX_PATTERN =
  /\b(Trust|Foundation|Society|Institute|Association|Fund|Charity|Charities|Coalition|Alliance|Inc\.?|L\.?L\.?C\.?|Corp\.?|Corporation|Nonprofit|Non-profit)\b/i

/** True when a proper_noun claim's text carries an organization-suffix marker (D-13). */
export function isOrgClaim(row: Pick<FactCheckFilterRow, 'text'>): boolean {
  return ORG_SUFFIX_PATTERN.test(row.text ?? '')
}

// D-13: "weak source" = unsourced OR a sourced claim whose host fails a
// documented, intentionally small quality heuristic (no resolvable
// publisher / a low-authority TLD/host). This is a heuristic, not a
// judgment on any specific outlet — refinement is deferred to research.
const LOW_AUTHORITY_TLDS = ['.xyz', '.info', '.biz', '.click', '.top', '.tk']
const LOW_AUTHORITY_HOSTS = ['blogspot.com', 'wordpress.com', 'medium.com', 'substack.com']

/** True when a claim has no source, or its source fails the D-13 quality heuristic. */
export function isWeakSource(row: Pick<FactCheckFilterRow, 'sourceUrl'>): boolean {
  if (!row.sourceUrl) return true
  let host: string
  try {
    host = new URL(row.sourceUrl).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    // Unparsable URL -> no resolvable publisher -> weak (never a crash).
    return true
  }
  if (!host) return true
  if (LOW_AUTHORITY_HOSTS.some(h => host === h || host.endsWith(`.${h}`))) return true
  if (LOW_AUTHORITY_TLDS.some(tld => host.endsWith(tld))) return true
  return false
}

export interface FactCheckFilterDef {
  id: string
  label: string
  predicate: (row: FactCheckFilterRow) => boolean
}

/** The 7 filter chips, in the order they render (D-12). */
export const FACT_CHECK_FILTERS: FactCheckFilterDef[] = [
  { id: 'must-fix', label: 'Must fix', predicate: row => isMustFix(row) },
  { id: 'unchecked', label: 'Unchecked', predicate: row => row.status === 'pending' },
  { id: 'changed', label: 'Changed', predicate: row => row.changedSinceCheck === true },
  {
    id: 'numbers-dates',
    label: 'Numbers & dates',
    predicate: row => row.claimType === 'number' || row.claimType === 'date',
  },
  {
    id: 'people-titles',
    label: 'People & titles',
    predicate: row => row.claimType === 'proper_noun' && !isOrgClaim(row),
  },
  {
    id: 'organization-claims',
    label: 'Organization claims',
    predicate: row => row.claimType === 'proper_noun' && isOrgClaim(row),
  },
  { id: 'weak-source', label: 'Weak source', predicate: row => isWeakSource(row) },
]

/**
 * Applies the active filter chips to `rows`. `removed` rows are always
 * excluded first (tombstoned, not editable). With zero active filters, every
 * remaining (live) row passes. With one or more active filters, a row
 * matching ANY active filter's predicate is included (OR-union, the
 * documented default per D-12).
 */
export function applyFilters<T extends FactCheckFilterRow>(rows: T[], activeIds: string[]): T[] {
  const live = rows.filter(row => row.status !== 'removed')
  if (activeIds.length === 0) return live
  const activeFilters = FACT_CHECK_FILTERS.filter(f => activeIds.includes(f.id))
  return live.filter(row => activeFilters.some(f => f.predicate(row)))
}
