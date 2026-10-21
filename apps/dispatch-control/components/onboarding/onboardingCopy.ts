/**
 * Quick 260721-qdx — plain onboarding copy data (no JSX side effects).
 *
 * Operator voice throughout: plain, dry, precise — matches existing UI copy
 * (DecisionRail / How to use), NOT Jesse's magazine voice. Where publishing
 * is mentioned, notes that Collaborators review/comment but don't publish
 * (matches LockedControl's "Collaborators can review and comment, not
 * publish." register).
 *
 * `StageSegment` mirrors the private type of the same name in
 * `issues/[issueNumber]/layout.tsx` — structurally identical string-literal
 * union, so values flow between the two without a shared import.
 */

export type StageSegment = 'story' | 'draft' | 'fact-check' | 'voice' | 'approval'

// ── The first-run step tour (4-6 steps) ─────────────────────────────────────

export interface TourStep {
  title: string
  body: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Nav groups',
    body: 'Left rail. Editorial is your daily work; System Workbench is the machine when something breaks; Operations is settings.',
  },
  {
    title: 'Masthead inbox',
    body: 'Top-right. Anything waiting on you shows up here, from any screen.',
  },
  {
    title: 'My Tasks',
    body: 'Your cross-stage to-do list — every open decision in one place.',
  },
  {
    title: 'The weekly loop',
    body: 'The agents write and check every story and fix what they find. You read and edit anything. The Editor-in-chief presses Publish. Anyone can put the issue on hold. Start on the issue page (the front page of this app). (Collaborators review and comment, not publish.)',
  },
  {
    title: 'How to use',
    body: 'Replay this tour or read the full guide any time.',
  },
]

// ── Per-stage hint strips (Task 3, StageHintStrip.tsx) ──────────────────────

export interface StageHintCopy {
  label: string
  body: string
}

export const STAGE_HINTS: Record<StageSegment, StageHintCopy> = {
  story: {
    label: 'STORY',
    body: 'The agents found candidates and settled on a recommended lead. Your job: pick or steer which one runs.',
  },
  draft: {
    label: 'DRAFT',
    body: 'The section writers produced the issue. Your job: read what they wrote before it moves to Fact Check.',
  },
  'fact-check': {
    label: 'FACT CHECK',
    body: 'The agents extracted factual claims from the draft and fixed what the sources contradict. Your job, if you want it: read the verdicts. Nothing here blocks Publish.',
  },
  voice: {
    label: 'VOICE',
    body: 'The agents de-slop the machine-tells. Your job, if you want it: read the voice and edit anything that still reads wrong.',
  },
  approval: {
    label: 'APPROVAL',
    body: 'Nothing is required here. When the issue is ready and not on hold, the Editor-in-chief publishes. (Collaborators review and comment, not publish.)',
  },
}

// ── Start-here card's 5-numbered-stage list (Task 2, StartHereCard.tsx) ─────

export interface StageSummary {
  segment: StageSegment
  label: string
  body: string
}

export const STAGE_SUMMARIES: StageSummary[] = [
  { segment: 'story', label: 'Story', body: 'Pick or steer the lead.' },
  { segment: 'draft', label: 'Draft', body: 'Read and edit what the writers produced.' },
  { segment: 'fact-check', label: 'Fact Check', body: 'Read the claim verdicts.' },
  { segment: 'voice', label: 'Voice', body: 'Read the voice; edit what reads wrong.' },
  { segment: 'approval', label: 'Approval', body: 'Publish when ready and not on hold.' },
]
