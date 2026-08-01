/**
 * Phase 51 (READ-04, D-10/D-11) -- recurring-correction grouping.
 *
 * A "group" is SIBLING findings that share a fix, NOT one finding with an
 * ambiguous span: the rules layer emits one qaCorrections row per occurrence,
 * each with its own resolvable span and the same suggestedFix. Accepting the
 * group is the "one action" READ-04 asks for.
 *
 * Group key = axis + byte-identical suggestedFix, within one section. Quoted
 * spans may differ (the same word flagged inside two different sentences
 * still groups).
 *
 * A finding with no suggestedFix is ALWAYS a group of one -- there is no
 * shared fix to apply.
 *
 * This changes NOTHING about lib/galley/spanResolver.ts's ambiguity handling
 * and NOTHING about the accept endpoint's server-side resolution semantics
 * (D-10).
 *
 * Pure, dependency-free -- no Convex, no React, no fetch. Scoping to one
 * section is the CALLER's responsibility (pass only that section's open
 * findings); this module has no notion of "section" at all.
 */

export interface GroupableFinding {
  _id: string
  axis?: string
  suggestedFix?: string
}

export interface FindingGroup {
  key: string
  findingIds: string[]
}

const KEY_SEP = '::'

/**
 * Groups `rows` by axis + suggestedFix (joined with a separator that cannot
 * appear in either field naturally, so the pair can never collide with a
 * different pair whose concatenation happens to match). Findings with no
 * `suggestedFix` each get their own single-member group keyed on their
 * `_id` so they can never collide with one another or with a real fix
 * group. Preserves input order within each group and returns groups in
 * first-appearance order.
 */
export function groupFindings(rows: ReadonlyArray<GroupableFinding>): FindingGroup[] {
  const groups: FindingGroup[] = []
  const indexByKey = new Map<string, number>()

  for (const row of rows) {
    if (!row.suggestedFix) {
      groups.push({ key: 'solo' + KEY_SEP + row._id, findingIds: [row._id] })
      continue
    }
    const key = (row.axis ?? '') + KEY_SEP + row.suggestedFix
    const existingIndex = indexByKey.get(key)
    if (existingIndex === undefined) {
      indexByKey.set(key, groups.length)
      groups.push({ key, findingIds: [row._id] })
    } else {
      groups[existingIndex]!.findingIds.push(row._id)
    }
  }

  return groups
}

/**
 * The group a given finding belongs to -- `findingIds.length === 1` when it
 * is alone. Falls back to a synthetic group-of-one for a `findingId` not
 * present in `rows` rather than throwing (defensive; the caller's own
 * `rows` list is the source of truth for what "in this section" means).
 */
export function groupForFinding(
  rows: ReadonlyArray<GroupableFinding>,
  findingId: string,
): FindingGroup {
  const groups = groupFindings(rows)
  const found = groups.find((g) => g.findingIds.includes(findingId))
  return found ?? { key: 'solo' + KEY_SEP + findingId, findingIds: [findingId] }
}
