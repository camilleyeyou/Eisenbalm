/**
 * Phase 40 Plan 40-04 (§40.6, ISS-01/ISS-06, D-18..D-23) — the pure
 * derived-state selector module.
 *
 * Pure functions over the RESULTS of existing Convex queries. No Convex
 * import. Unit-testable in isolation. Consumed by the header (40-08), the
 * issue card (40-05), the issue overview (40-07/40-09), Phase 41's stage
 * tabs, and Phase 43's My Tasks. Editorial policy (severity weights, stage
 * rules, status precedence) lives HERE, never in the backend.
 *
 * ISS-06 is structural, not a special-case error handler: `deriveIssueStatus`
 * returns `'unknown'` for any not-loaded/failed input by construction — see
 * the `undefined` checks at the top of that function.
 */
import { isOpenFinding } from './galley/findingState'
import { VOICE_AXES } from './galley/axisPartition'
import { qaSectionToGalleyId } from './galley/sectionIdMap'
import { issueDraftHref, issueVoiceHref } from './issueRouteResolver'
import { EDITABLE_SECTIONS } from '../app/(dashboard)/review-desk/[runId]/_components/SectionChipList'
import type { DraftResponse } from './contentPatchClient'

// ── Types (§40.6, verbatim) ──────────────────────────────────────────────────

export type IssueStatus = 'unknown' | 'draft' | 'needs-review' | 'ready' | 'published' | 'held'
export type StageState = 'not-generated' | 'in-progress' | 'needs-you' | 'clean'
export type TaskSeverity = 'must-fix' | 'review-recommended' | 'information'

export interface StageStateResult {
  state: StageState
  openCount: number
}

export interface DerivedTask {
  // DERIVED-STATE-CONTRACT §2 shape — NO tasks table
  id: string
  sev: TaskSeverity
  title: string // plain language
  where: string // section / area affected
  why: string // why human judgment is required
  rec?: string // the agent's recommendation, when one exists
  primary: { label: string; href: string }
  insp?: string // inspector target (Phase 44 consumes; may be omitted)
  stage: 1 | 2 | 3 | 4 | 5
}

// D-22 — tunable in ONE place.
export const SEVERITY_MINUTES: Record<TaskSeverity, number> = {
  'must-fix': 6,
  'review-recommended': 3,
  information: 1,
}

/**
 * `undefined` means NOT LOADED (or the query failed). `null` means
 * loaded-and-absent. The distinction is load-bearing: it is what makes
 * ISS-06 structural.
 */
export interface DerivationInputs {
  issueNumber: number | null
  runId: string | null
  issue: { held: boolean; published: boolean } | null | undefined
  signOffs: Record<string, { actorId: string; signedAt: number }> | undefined
  claimRows:
    | Array<{
        status: string
        sourceUrl?: string
        sectionName?: string
        claimText?: string
        _id: string
      }>
    | undefined
  qaFindings:
    | Array<{
        _id: string
        severity: 'info' | 'warning' | 'error'
        axis?: string
        sectionName: string
        reason: string
        suggestedFix?: string
        accepted?: boolean
        resolution?: 'accepted' | 'dismissed' | null
      }>
    | undefined
  pitchRows: Array<{ selected: boolean }> | undefined
  runStatus: string | undefined // runs.latest.status
}

// ── deriveIssueStatus (D-18 + ISS-06) ────────────────────────────────────────

export function deriveIssueStatus(i: DerivationInputs): IssueStatus {
  // NOT LOADED / FAILED — never a stale value.
  if (i.issue === undefined || i.signOffs === undefined) return 'unknown'
  // Loaded-and-absent — no issue row => nothing to state.
  if (i.issue === null) return 'unknown'
  if (i.issue.published) return 'published'
  if (i.issue.held) return 'held'
  const factDone = i.signOffs['facts-cleared'] !== undefined
  const voiceDone = i.signOffs['sounds-human'] !== undefined
  if (factDone && voiceDone) return 'ready'
  if (i.runId === null) return 'draft'
  return 'needs-review'
}

// ── deriveStageStates (D-19 — ARTIFACT-derived, never pipeline-node-derived) ─

function isVoiceAxisFinding(row: { axis?: string }): boolean {
  return VOICE_AXES.has(row.axis ?? '')
}

function countOpen(rows: DerivationInputs['qaFindings']): number {
  return (rows ?? []).filter(isOpenFinding).length
}

function deriveStoryStage(i: DerivationInputs): StageStateResult {
  if (i.runId === null) return { state: 'not-generated', openCount: 0 }
  if (i.pitchRows === undefined) return { state: 'in-progress', openCount: 0 }
  if (i.pitchRows.some((p) => p.selected)) return { state: 'clean', openCount: 0 }
  if (i.pitchRows.length > 0) return { state: 'needs-you', openCount: 1 } // Gate 1 unresolved
  return { state: 'in-progress', openCount: 0 }
}

function deriveDraftStage(i: DerivationInputs): StageStateResult {
  if (i.runId === null) return { state: 'not-generated', openCount: 0 }
  if (i.qaFindings === undefined || i.claimRows === undefined) {
    return { state: 'in-progress', openCount: 0 }
  }
  if (i.qaFindings.length === 0 && i.claimRows.length === 0) {
    return i.runStatus === 'running'
      ? { state: 'in-progress', openCount: 0 }
      : { state: 'not-generated', openCount: 0 }
  }
  const n = i.qaFindings.filter((row) => isOpenFinding(row) && !isVoiceAxisFinding(row)).length
  return n > 0 ? { state: 'needs-you', openCount: n } : { state: 'clean', openCount: 0 }
}

function deriveFactCheckStage(i: DerivationInputs): StageStateResult {
  // MUST NOT read runStatus (D-19): a completed run with zero checked claims
  // shows needs-you, never clean.
  if (i.runId === null) return { state: 'not-generated', openCount: 0 }
  if (i.claimRows === undefined) return { state: 'in-progress', openCount: 0 }
  if (i.claimRows.length === 0) return { state: 'not-generated', openCount: 0 }
  const u = i.claimRows.filter((row) => row.status === 'pending').length
  return u > 0 ? { state: 'needs-you', openCount: u } : { state: 'clean', openCount: 0 }
}

function deriveVoiceStage(i: DerivationInputs): StageStateResult {
  if (i.runId === null) return { state: 'not-generated', openCount: 0 }
  if (i.qaFindings === undefined || i.signOffs === undefined) {
    return { state: 'in-progress', openCount: 0 }
  }
  const v = i.qaFindings.filter((row) => isOpenFinding(row) && isVoiceAxisFinding(row)).length
  if (v > 0) return { state: 'needs-you', openCount: v }
  if (i.signOffs['sounds-human'] !== undefined) return { state: 'clean', openCount: 0 }
  // No open voice-axis findings, but the sounds-human sign-off itself is
  // still outstanding: 'needs-you' with openCount 0 — there is no
  // enumerable finding to count, only the sign-off action (§40.6 test
  // "findings with resolution/accepted excluded from every stage count").
  return i.runStatus === 'running'
    ? { state: 'in-progress', openCount: 0 }
    : { state: 'needs-you', openCount: 0 }
}

function deriveApprovalStage(i: DerivationInputs): StageStateResult {
  if (i.issue?.published) return { state: 'clean', openCount: 0 }
  if (i.runId === null) return { state: 'not-generated', openCount: 0 }
  if (i.signOffs === undefined) return { state: 'in-progress', openCount: 0 }
  const factDone = i.signOffs['facts-cleared'] !== undefined
  const voiceDone = i.signOffs['sounds-human'] !== undefined
  return factDone && voiceDone
    ? { state: 'needs-you', openCount: 1 }
    : { state: 'in-progress', openCount: 0 }
}

export function deriveStageStates(
  i: DerivationInputs,
): [StageStateResult, StageStateResult, StageStateResult, StageStateResult, StageStateResult] {
  return [
    deriveStoryStage(i),
    deriveDraftStage(i),
    deriveFactCheckStage(i),
    deriveVoiceStage(i),
    deriveApprovalStage(i),
  ]
}

// ── deriveSectionStates (Phase 41 Plan 41-01, WSP-02/WSP-07) ────────────────
//
// The per-SECTION sibling to `deriveStageStates` above. `deriveStageStates`
// is stage-level (5 results, 4-value `StageState` vocabulary); the Workspace
// outline (41-05) and frame tabs need a section-level grain that selector
// does NOT provide (9 `EDITABLE_SECTIONS` entries, a different 5-value
// vocabulary). Do NOT feed `deriveStageStates` output into the outline
// (Pitfall 4, 41-RESEARCH) — this is the separate, purpose-built selector.
//
// `'changed-since-review'` is a RESERVED legend value with NO Phase-41 data
// source (41-RESEARCH Open Q3 / DERIVED-STATE-CONTRACT §4): no
// content-patch-touch tracking exists yet. It is intentionally never
// produced by this function — Phase 42+ will drive it. Every section falls
// through to one of the four REACHABLE states below; presence (absent ->
// 'not-generated') is checked FIRST so a section is never silently reported
// 'clean' when it is actually absent.
export type SectionState = 'clean' | 'review' | 'must-fix' | 'changed-since-review' | 'not-generated'

export interface SectionStateResult {
  state: SectionState
  openCount: number
}

export function deriveSectionStates(
  i: DerivationInputs,
  draftSectionIds: ReadonlySet<string>,
): Record<string, SectionStateResult> {
  const result: Record<string, SectionStateResult> = {}
  for (const section of EDITABLE_SECTIONS) {
    if (!draftSectionIds.has(section.id)) {
      result[section.id] = { state: 'not-generated', openCount: 0 }
      continue
    }
    const openFindings = (i.qaFindings ?? []).filter(
      (row) => isOpenFinding(row) && qaSectionToGalleyId(row.sectionName) === section.id,
    )
    const openCount = openFindings.length
    const hasError = openFindings.some((row) => row.severity === 'error')
    if (hasError) {
      result[section.id] = { state: 'must-fix', openCount }
    } else if (openCount > 0) {
      result[section.id] = { state: 'review', openCount }
    } else {
      result[section.id] = { state: 'clean', openCount: 0 }
    }
  }
  return result
}

// ── draftSectionIdsFromDraft (Phase 41 Plan 41-01) ──────────────────────────
//
// THE single source of truth for "which sections are generated." Shared by
// the outline provider (41-05) and the Stage-2 canvas (41-08) so they cannot
// disagree: presence is read from real draft content, never inferred from
// side-tables (claims/findings) a clean section legitimately lacks.
//
// Long-reads use the BYTE-IDENTICAL `(draft.sections[id]?.blocks ?? []).length
// > 0` check the canvas renders (41-08 Task 2). Keep the two in lockstep —
// if this predicate changes, the canvas's copy must change too. The
// remaining galley sections check their corresponding top-level draft
// payload for non-empty content. A type-only `DraftResponse` import keeps
// this module free of runtime Convex/React/fetch coupling.
const LONG_READ_SECTION_IDS = [
  'originStory',
  'problemStatement',
  'founderBio',
  'caseStudy',
] as const

function hasNonEmptyPayload(value: unknown): boolean {
  if (value == null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value).length > 0
  return Boolean(value)
}

export function draftSectionIdsFromDraft(draft: DraftResponse): ReadonlySet<string> {
  const ids = new Set<string>()
  for (const id of LONG_READ_SECTION_IDS) {
    if ((draft.sections[id]?.blocks ?? []).length > 0) ids.add(id)
  }
  if (hasNonEmptyPayload(draft.bonus)) ids.add('bonus')
  if (hasNonEmptyPayload(draft.game)) ids.add('game')
  if (hasNonEmptyPayload(draft.podcast)) ids.add('podcast')
  if (hasNonEmptyPayload(draft.conversation)) ids.add('deliberation-conversation')
  if (hasNonEmptyPayload(draft.theme)) ids.add('theme')
  return ids
}

// ── deriveTasks (D-21 — the REAL projection Phase 43 renders as a screen) ───

const SEVERITY_ORDER: Record<TaskSeverity, number> = {
  'must-fix': 0,
  'review-recommended': 1,
  information: 2,
}

function findingSeverityToTaskSeverity(severity: 'info' | 'warning' | 'error'): TaskSeverity {
  if (severity === 'error') return 'must-fix'
  if (severity === 'warning') return 'review-recommended'
  return 'information'
}

export function deriveTasks(i: DerivationInputs): DerivedTask[] {
  if (i.runId === null) return []

  const n = i.issueNumber
  const fallbackHref = n === null ? '/issues' : undefined

  const tasks: DerivedTask[] = []

  for (const row of i.qaFindings ?? []) {
    if (!isOpenFinding(row)) continue
    const voiceAxis = isVoiceAxisFinding(row)
    const stage = voiceAxis ? 4 : 2
    const href = fallbackHref ?? (voiceAxis ? issueVoiceHref(n as number) : issueDraftHref(n as number))
    tasks.push({
      id: `qa-${row._id}`,
      sev: findingSeverityToTaskSeverity(row.severity),
      title: row.reason,
      where: row.sectionName,
      why: row.reason,
      rec: row.suggestedFix,
      primary: { label: 'Review', href },
      stage,
    })
  }

  for (const row of i.claimRows ?? []) {
    if (row.status !== 'pending') continue
    const sev: TaskSeverity = row.sourceUrl ? 'review-recommended' : 'must-fix'
    const href = fallbackHref ?? issueDraftHref(n as number)
    tasks.push({
      id: `claim-${row._id}`,
      sev,
      title: `Check claim: ${(row.claimText ?? '').slice(0, 60)}`,
      where: row.sectionName ?? '',
      why: 'Unverified claim requires human judgment',
      primary: { label: 'Review', href },
      stage: 3,
    })
  }

  const runningOrDone = i.runId !== null && i.runStatus !== 'running'
  if (runningOrDone && i.signOffs !== undefined) {
    const href = fallbackHref ?? issueDraftHref(n as number)
    if (i.signOffs['facts-cleared'] === undefined) {
      tasks.push({
        id: 'signoff-facts',
        sev: 'must-fix',
        title: 'Clear the facts',
        where: 'Approval',
        why: 'Facts sign-off is required before publish',
        primary: { label: 'Review', href },
        stage: 5,
      })
    }
    if (i.signOffs['sounds-human'] === undefined) {
      const voiceHref = fallbackHref ?? issueVoiceHref(n as number)
      tasks.push({
        id: 'signoff-voice',
        sev: 'must-fix',
        title: 'Approve the voice',
        where: 'Approval',
        why: 'Voice sign-off is required before publish',
        primary: { label: 'Review', href: voiceHref },
        stage: 5,
      })
    }
  }

  tasks.sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.sev] - SEVERITY_ORDER[b.sev]
    if (sevDiff !== 0) return sevDiff
    return a.stage - b.stage
  })

  return tasks
}

// ── estimateWorkMinutes (D-22) ───────────────────────────────────────────────

export function estimateWorkMinutes(tasks: DerivedTask[]): number {
  return tasks.reduce((sum, t) => sum + SEVERITY_MINUTES[t.sev], 0)
}
