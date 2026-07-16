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
import {
  issueDraftHref,
  issueVoiceHref,
  issueFactCheckHref,
  issueApprovalHref,
} from './issueRouteResolver'
import { EDITABLE_SECTIONS } from '../app/(dashboard)/review-desk/[runId]/_components/SectionChipList'
import type { DraftResponse } from './contentPatchClient'
// Phase 44 Plan 44-08 (INS-01, §44.1) — the string-encoded artifact-key
// form `DerivedTask.insp` carries. Populated ONLY for qa-finding and claim
// tasks below (each anchors to exactly one artifact); sign-off tasks
// deliberately leave `insp` unset (44-RESEARCH Open Question 1 — a sign-off
// gate has no single natural artifact).
import { encodeArtifactKey } from './inspectorArtifact'

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
  // Phase 43 Plan 43-03 (§43.5a, TSK-02) — additive. Raw ms timestamp; absent
  // => age unknown. Rendered by the pure `formatTaskAge` below, NOT computed
  // inside `deriveTasks` (keeps the selector free of wall-clock dependence).
  openedAt?: number
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
        // Phase 42 Plan 42-05 (FCT-02, D-04..D-08) — additive fact-check
        // severity/summary fields. Optional: legacy rows and non-fact-check
        // consumers may omit them; `isMustFix`/`deriveFactCheckSummary`
        // below treat an absent `importance` as 'Supporting' (D-03).
        claimIndex?: number
        claimId?: string
        importance?: 'Load-bearing' | 'Supporting' | 'Incidental'
        changedSinceCheck?: boolean
        conflict?: boolean
        checkedAt?: number
        // Phase 43 Plan 43-03 (§43.5a, TSK-02) — additive passthrough of the
        // row's creation time (mapped from Convex's implicit `_creationTime`
        // by callers), used as the claim task's `openedAt`.
        createdAt?: number
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
        // Phase 43 Plan 43-03 (§43.5a, TSK-02) — additive. Already the
        // finding's creation time (Phase 5's `qaCorrections.timestamp`);
        // used as the QA-finding task's `openedAt`.
        timestamp?: number
      }>
    | undefined
  pitchRows: Array<{ selected: boolean }> | undefined
  runStatus: string | undefined // runs.latest.status
  // Phase 43 Plan 43-03 (§43.5a, TSK-02) — additive. The run's `startedAt`
  // (already queried by every `DerivationInputs` caller); used as the
  // "since run start" `openedAt` anchor for missing-sign-off tasks, since
  // there is no per-sign-off "became eligible at" timestamp stored anywhere.
  runStartedAt?: number
  // Phase 47 Plan 47-08 (Pitfall 3) — additive. The run's `completedAt`
  // (mirrors `runStartedAt`'s optional-passthrough shape). Together with
  // `runStatus`, this is what lets `deriveStoryStage` gate 'needs-you' on
  // the PRECISE Gate-1-paused predicate (`status === 'awaiting-review' &&
  // completedAt == null`, API_CONTRACTS §37.4(c)) instead of merely "leads
  // exist and none is selected yet."
  runCompletedAt?: number
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
  // Phase 47 Plan 47-08 (Pitfall 3): gate 'needs-you' on the PRECISE Gate-1
  // paused predicate — status==='awaiting-review' && completedAt==null — not
  // merely "leads exist and none is selected yet," which would flash "Needs
  // you" for a mid-flight run (Scout/Advocate still working, Gate 1 not
  // reached). Mirrors SignalDeskScreen's isPausedAtGate1 exactly.
  const pausedAtGate1 = i.runStatus === 'awaiting-review' && i.runCompletedAt == null
  if (pausedAtGate1) return { state: 'needs-you', openCount: 1 }
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

// ── isMustFix + deriveFactCheckSummary (Phase 42 Plan 42-05, FCT-02, D-04..D-08) ─
//
// The pure derived-selector pair for Stage 3 Fact Check. `isMustFix` is the
// SAME severity predicate `deriveTasks`'s claim loop uses below — sharing
// this one function is what keeps My Tasks, the stage badge, and the Stage
// 3 screen's own summary from silently disagreeing (42-CONTEXT D-16,
// 42-RESEARCH Pitfall 1 / Anti-Pattern). Severity is editorial, not
// statistical: an unsourced Load-bearing claim is Must-fix; an unsourced
// Incidental/Supporting claim — or a legacy row with no `importance` at
// all, which defaults to 'Supporting' per D-03 — is Review-recommended.
// "Blank never means verified" (D-08): every counter below is always
// present in the returned object, even when zero.

export type ClaimImportance = 'Load-bearing' | 'Supporting' | 'Incidental'

export interface FactCheckClaimRow {
  status: string
  importance?: string
  sourceUrl?: string
  changedSinceCheck?: boolean
  conflict?: boolean
  checkedAt?: number
}

export interface FactCheckSummary {
  factCoverage: string
  total: number
  checked: number
  mustFixCount: number
  changedCount: number
  uncheckedCount: number
  conflictsCount: number
  checksNotRunCount: number
  lastVerifiedAt: number | null
}

export function isMustFix(row: FactCheckClaimRow): boolean {
  return (
    row.status === 'pending' && (row.importance ?? 'Supporting') === 'Load-bearing' && !row.sourceUrl
  )
}

export function deriveFactCheckSummary(rows: FactCheckClaimRow[]): FactCheckSummary {
  const total = rows.length
  const checked = rows.filter((r) => r.status !== 'pending').length
  const mustFixCount = rows.filter(isMustFix).length
  const changedCount = rows.filter((r) => r.changedSinceCheck).length
  const uncheckedCount = rows.filter((r) => r.status === 'pending').length
  const conflictsCount = rows.filter((r) => r.conflict).length
  const checksNotRunCount = rows.filter(
    (r) => r.status === 'pending' && !r.sourceUrl && !r.changedSinceCheck,
  ).length
  const checkedAts = rows.map((r) => r.checkedAt ?? 0).filter((t) => t > 0)
  const lastVerifiedAt = checkedAts.length > 0 ? Math.max(...checkedAts) : null
  return {
    factCoverage: `${checked} of ${total}`,
    total,
    checked,
    mustFixCount,
    changedCount,
    uncheckedCount,
    conflictsCount,
    checksNotRunCount,
    lastVerifiedAt,
  }
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
      // §44.1/§44.3 — a QA finding (factual or voice-axis) anchors to the
      // writer that produced the section: `type: 'founder'` with the qa
      // sectionName as locator (the resolver normalizes snake_case section
      // names via KNOWN_RUN_KEYS/galleyIdToQaSection, degrading honestly if
      // unresolvable).
      insp: encodeArtifactKey({ type: 'founder', runId: i.runId as string, locator: row.sectionName }),
      stage,
      openedAt: row.timestamp,
    })
  }

  for (const row of i.claimRows ?? []) {
    if (row.status !== 'pending') continue
    const sev: TaskSeverity = isMustFix(row) ? 'must-fix' : 'review-recommended'
    // §43.5b (Pitfall 1 fix) — claim tasks deep-link to Fact Check, not Draft.
    const href = fallbackHref ?? issueFactCheckHref(n as number)
    tasks.push({
      id: `claim-${row._id}`,
      sev,
      title: `Check claim: ${(row.claimText ?? '').slice(0, 60)}`,
      where: row.sectionName ?? '',
      why: 'Unverified claim requires human judgment',
      primary: { label: 'Review', href },
      // §44.1/§44.3 — a claim anchors to `claim` with the claimId as locator
      // (resolves to `researcher`, per §44.RECONCILIATION).
      insp: encodeArtifactKey({ type: 'claim', runId: i.runId as string, locator: row._id }),
      stage: 3,
      openedAt: row.createdAt,
    })
  }

  const runningOrDone = i.runId !== null && i.runStatus !== 'running'
  if (runningOrDone && i.signOffs !== undefined) {
    // §43.5b (Pitfall 1 fix) — the facts sign-off task deep-links to
    // Approval, not Draft. signoff-voice's href is unchanged (already
    // correct per §40.6 — verified against issueVoiceHref, §43.5b).
    const href = fallbackHref ?? issueApprovalHref(n as number)
    if (i.signOffs['facts-cleared'] === undefined) {
      tasks.push({
        id: 'signoff-facts',
        sev: 'must-fix',
        title: 'Clear the facts',
        where: 'Approval',
        why: 'Facts sign-off is required before publish',
        primary: { label: 'Review', href },
        stage: 5,
        openedAt: i.runStartedAt,
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
        openedAt: i.runStartedAt,
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

// ── formatTaskAge (Phase 43 Plan 43-03, §43.5a, TSK-02) ─────────────────────
//
// Pure, wall-clock-dependent by DESIGN (unlike `deriveTasks` itself) — called
// by the screen at render time, never from inside `deriveTasks`. Mirrors
// RegistryTable.tsx's `formatRelativeTime` granularity, extended with
// minute/hour buckets since tasks are typically much more recent than
// registry "last featured" dates. `openedAt: undefined` (row has no known
// creation time) renders an explicit 'unknown' — never a blank string.

export function formatTaskAge(openedAt: number | undefined, now: number = Date.now()): string {
  if (openedAt === undefined) return 'unknown'
  const diffMs = now - openedAt
  if (diffMs < 60_000) return 'just now'
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

// ── estimateWorkMinutes (D-22) ───────────────────────────────────────────────

export function estimateWorkMinutes(tasks: DerivedTask[]): number {
  return tasks.reduce((sum, t) => sum + SEVERITY_MINUTES[t.sev], 0)
}

// ── deriveRunCostUsd + deriveRunCapUsd (Phase 45 Plan 45-06, REV-05, D-12/D-13/D-15) ─
//
// The header cost-vs-budget readout's pure derivation pair. Spend is summed
// from the durable `agentRuns:byRunId` rows (never the pipeline's in-memory
// `lib/cost.py` `_store`, which is cleared before an operator ever reaches
// review — 45-RESEARCH Pitfall 1). The cap mirrors `per_run_cap_usd` from
// `pipelineConfig:getAll`, defaulting to 10.0 (the same default
// `api/control.py` uses server-side). Never-blank (D-15): `deriveRunCostUsd`
// returns `undefined` while loading — it must NOT be coerced to 0.

export const DEFAULT_RUN_CAP_USD = 10.0

export function deriveRunCostUsd(
  rows: Array<{ costUsd?: number }> | undefined,
): number | undefined {
  if (rows === undefined) return undefined // never-blank: loading, not zero
  return rows.reduce((sum, r) => sum + (r.costUsd ?? 0), 0)
}

export function deriveRunCapUsd(
  pipelineConfigRows: Array<{ key: string; value: string }> | undefined,
): number {
  if (pipelineConfigRows === undefined) return DEFAULT_RUN_CAP_USD
  const row = pipelineConfigRows.find((r) => r.key === 'per_run_cap_usd')
  if (!row) return DEFAULT_RUN_CAP_USD
  try {
    const v = JSON.parse(row.value)
    return typeof v === 'number' ? v : Number(v) || DEFAULT_RUN_CAP_USD
  } catch {
    return Number(row.value) || DEFAULT_RUN_CAP_USD
  }
}
