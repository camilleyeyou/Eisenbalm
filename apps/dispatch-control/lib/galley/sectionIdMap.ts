/**
 * Bidirectional QA <-> galley section-id vocabulary bridge (GLY-02).
 *
 * QA's `qaCorrections.sectionName` (snake_case, written by
 * `agents/qa/__init__.py::_extract_sections`) does NOT match the galley /
 * draft-read section id vocabulary (camelCase, from
 * `SectionChipList.tsx::EDITABLE_SECTIONS` + `contentPatchClient.ts`'s
 * `DraftResponse.sections` keys). This is the ONLY authority for that
 * mapping (32-RESEARCH.md Section-id mapping table).
 *
 * Pure, dependency-free. Unknown names never coerce -- they return `null`.
 */

// QA (snake_case, Convex) -> galley/draft section id (camelCase).
const QA_TO_GALLEY: Record<string, string> = {
  origin_story: 'originStory',
  problem: 'problemStatement', // NOTE: problem !== problemStatement
  founder_bio: 'founderBio',
  case_study: 'caseStudy',
  game: 'game',
  bonus: 'bonus',
}

/** Maps a QA `sectionName` to its galley/draft section id. Unknown -> null. */
export function qaSectionToGalleyId(qaName: string): string | null {
  return QA_TO_GALLEY[qaName] ?? null
}

const GALLEY_TO_QA: Record<string, string> = Object.fromEntries(
  Object.entries(QA_TO_GALLEY).map(([qaName, galleyId]) => [galleyId, qaName]),
)

/**
 * Maps a galley/draft section id back to its QA `sectionName`. Galley-only
 * ids that QA never emits findings against (podcast / theme /
 * deliberation-conversation) -> null, never a guessed/adjacent name.
 */
export function galleyIdToQaSection(galleyId: string): string | null {
  return GALLEY_TO_QA[galleyId] ?? null
}
