/**
 * Phase 32 (GLY-01/GLY-02, Plan 32-01 Wave 0 RED) — sectionIdMap tests.
 *
 * QA's `qaCorrections.sectionName` vocabulary (snake_case, written by
 * `agents/qa/__init__.py::_extract_sections`) does NOT match the galley /
 * draft-read section id vocabulary (camelCase, from
 * `SectionChipList.tsx::EDITABLE_SECTIONS` + `contentPatchClient.ts`'s
 * `DraftResponse.sections` keys). Nothing in the codebase bridges these two
 * vocabularies today (32-RESEARCH.md §Pitfall 2) — this module is new,
 * explicitly-tested code that closes that gap.
 *
 * RED at authoring time: `../lib/galley/sectionIdMap` does not exist yet.
 * Turns GREEN in Plan 32-03/32-04.
 */
import { describe, it, expect } from 'vitest'
import { qaSectionToGalleyId, galleyIdToQaSection } from '../lib/galley/sectionIdMap'

describe('qaSectionToGalleyId (QA sectionName -> galley/draft section id)', () => {
  const forwardCases: Array<[string, string]> = [
    ['origin_story', 'originStory'],
    ['problem', 'problemStatement'],
    ['founder_bio', 'founderBio'],
    ['case_study', 'caseStudy'],
    ['game', 'game'],
    ['bonus', 'bonus'],
  ]

  for (const [qaName, galleyId] of forwardCases) {
    it(`maps QA sectionName "${qaName}" -> galley id "${galleyId}"`, () => {
      expect(qaSectionToGalleyId(qaName)).toBe(galleyId)
    })
  }

  it('returns null for an unknown/nonsense QA sectionName (never silently coerced)', () => {
    expect(qaSectionToGalleyId('nonsense')).toBeNull()
  })

  it('returns null for an empty string', () => {
    expect(qaSectionToGalleyId('')).toBeNull()
  })
})

describe('galleyIdToQaSection (galley/draft section id -> QA sectionName)', () => {
  const reverseCases: Array<[string, string]> = [
    ['originStory', 'origin_story'],
    ['problemStatement', 'problem'],
    ['founderBio', 'founder_bio'],
    ['caseStudy', 'case_study'],
    ['game', 'game'],
    ['bonus', 'bonus'],
  ]

  for (const [galleyId, qaName] of reverseCases) {
    it(`maps galley id "${galleyId}" -> QA sectionName "${qaName}"`, () => {
      expect(galleyIdToQaSection(galleyId)).toBe(qaName)
    })
  }

  // Galley-only ids that QA never emits findings against (32-RESEARCH.md
  // §Pitfall 2 table: "(never emitted)" row) — reverse-map to null, never
  // to a guessed/adjacent QA name.
  const galleyOnlyIds = ['podcast', 'theme', 'deliberation-conversation']
  for (const galleyId of galleyOnlyIds) {
    it(`returns null for galley-only id "${galleyId}" (QA never emits findings against it)`, () => {
      expect(galleyIdToQaSection(galleyId)).toBeNull()
    })
  }

  it('returns null for an unknown galley id', () => {
    expect(galleyIdToQaSection('nonsense')).toBeNull()
  })
})
