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
    body: 'An issue moves Story → Draft → Fact Check → Voice → Approval → Publish. You make the calls; the pipeline does the legwork. Start on Issues. (Collaborators review and comment, not publish.)',
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
    body: 'The agents extracted factual claims from the draft. Your job: verify or dismiss each one. Publishing is blocked until errors are cleared.',
  },
  voice: {
    label: 'VOICE',
    body: 'The one thing only you can do. Your job: de-slop the machine-tells, then mark it Sounds human.',
  },
  approval: {
    label: 'APPROVAL',
    body: 'Both Facts cleared and Sounds human are required. Your job: give the final sign-off, then publish. (Collaborators review and comment, not publish.)',
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
  { segment: 'draft', label: 'Draft', body: 'Read what the writers produced.' },
  { segment: 'fact-check', label: 'Fact Check', body: 'Verify or dismiss every claim.' },
  { segment: 'voice', label: 'Voice', body: 'De-slop the machine-tells, then mark it Sounds human.' },
  { segment: 'approval', label: 'Approval', body: 'Both greens required, then publish.' },
]
