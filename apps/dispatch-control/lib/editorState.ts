/**
 * Phase 56 — single pure source for every editor screen. No React, no Convex,
 * no clock reads (pass `now`).
 *
 * Wraps `deriveHomeFooter` (never forks run-state logic) and maps every
 * run/issue state onto the six status words: Done, Working, Waiting for you,
 * Not yet, Stopped, Problem.
 *
 * Assumptions recorded for the user to override (56-01 SUMMARY lists them):
 *  A1  issue Thursday = publishedAt, else scheduledFor, else next Thursday (issueTitle.ts)
 *  A3a stopped copy is its own variant, not the Problem copy
 *  A3b gate1 (legacy paused run) is "stuck": Waiting for you, action = stop it
 *  A4  later steps read "Not yet", never the older wording
 *  A5  archive reasons are generic (title null vs set), not per failing step
 *  A6  hold reason is a fixed "Held by the editor"; held reason/by never shown
 *  A7  an older unpublished issue is read-only ("older")
 *  A8  every dial sub-page gets one generic slab sentence
 */
import type { HomeFooter, HomeSectionRow } from '@/lib/homeSections'
import type { Role } from '@/lib/role'
import type { StatusWord } from '@/lib/nomenclature'
import { isGateInterrupt } from '@/lib/gateInterrupt'
import { formatLongDate, EDITOR_TIME_ZONE, issueThursday, NO_CHARITY_YET } from '@/lib/issueTitle'

// ─── Parts ──────────────────────────────────────────────────────────────────

export const PART_ORDER = [
  'originStory',
  'problemStatement',
  'founderBio',
  'caseStudy',
  'bonus',
  'game',
  'deliberation-conversation',
  'podcast',
  'theme',
] as const

export const PART_LABELS: Record<string, string> = {
  originStory: 'Origin story',
  problemStatement: 'Problem',
  founderBio: 'Founder',
  caseStudy: 'Case study',
  bonus: 'Bonus',
  game: 'Game',
  'deliberation-conversation': 'Deliberation',
  podcast: 'Podcast',
  theme: 'Look',
}

export const STATION_NAMES = ['Pick charity', 'Write', 'Check', 'Publish'] as const

// ─── Home ───────────────────────────────────────────────────────────────────

export type HomeState =
  | 'loading'
  | 'empty'
  | 'writing'
  | 'checking'
  | 'ready'
  | 'ready-collab'
  | 'held'
  | 'published'
  | 'stopped'
  | 'problem'
  | 'stuck'
  | 'older'

export interface StationVM {
  name: (typeof STATION_NAMES)[number]
  word: StatusWord
  line: string
  current: boolean
  complete: boolean
}

export interface EditorHomeVM {
  state: HomeState
  word: StatusWord | null
  stations: StationVM[]
  writtenCount: number
  fixCount: number
  publishable: boolean
}

const NUMBER_WORDS = ['None', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']

function fixesText(n: number): string {
  return n === 1 ? '1 fix' : `${n} fixes`
}

function weekdayOf(ms: number): string {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', timeZone: EDITOR_TIME_ZONE }).format(ms)
}

function dayMonthOf(ms: number): string {
  // 'Thursday 22 October' (weekday, day, month; no year)
  return formatLongDate(ms).replace(/\s\d{4}$/, '')
}

/** 'h:mm' in the editor's zone, 12-hour, no am/pm, no leading zero on the hour. */
export function formatClock(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: EDITOR_TIME_ZONE,
  }).formatToParts(ms)
  const h = parts.find((p) => p.type === 'hour')?.value ?? '0'
  const m = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${Number(h)}:${m}`
}

function hourOf(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: 'numeric',
    hour12: false,
    timeZone: EDITOR_TIME_ZONE,
  }).formatToParts(ms)
  return Number(parts.find((p) => p.type === 'hour')?.value ?? '0') % 24
}

function sameDay(a: number, b: number): boolean {
  return formatLongDate(a, false) === formatLongDate(b, false)
}

function station(
  name: StationVM['name'],
  word: StatusWord,
  line: string,
  current = false,
): StationVM {
  return { name, word, line, current, complete: word === 'Done' }
}

function mapState(a: {
  footer: HomeFooter
  held: boolean | undefined
  role: Role | undefined
  w: number
  pinnedOlder: boolean
}): { state: HomeState; word: StatusWord | null } {
  const { footer, held, role, w, pinnedOlder } = a
  switch (footer.kind) {
    case 'loading':
      return { state: 'loading', word: null }
    case 'none':
      return { state: 'empty', word: null }
    case 'published':
      return { state: 'published', word: 'Done' }
    case 'stopped':
      return { state: 'stopped', word: 'Stopped' }
    case 'failed':
      return { state: 'problem', word: 'Problem' }
    case 'gate1':
      // A pause, never a problem.
      return pinnedOlder
        ? { state: 'older', word: 'Not yet' }
        : { state: 'stuck', word: 'Waiting for you' }
    case 'running':
    case 'ready': {
      if (pinnedOlder) return { state: 'older', word: 'Not yet' }
      if (held === true) return { state: 'held', word: 'Waiting for you' }
      if (footer.kind === 'running') {
        return { state: w >= 9 ? 'checking' : 'writing', word: 'Working' }
      }
      if (role === 'Collaborator') return { state: 'ready-collab', word: 'Not yet' }
      return { state: 'ready', word: 'Waiting for you' }
    }
  }
}

function buildStations(a: {
  state: HomeState
  footer: HomeFooter
  role: Role | undefined
  w: number
  fixes: number
}): StationVM[] {
  const { state, footer, role, w, fixes } = a
  const [pick, write, check, publish] = STATION_NAMES
  if (state === 'loading' || state === 'empty') {
    return [
      station(pick, 'Not yet', 'Not yet'),
      station(write, 'Not yet', 'Not yet'),
      station(check, 'Not yet', 'Not yet'),
      station(publish, 'Not yet', 'Not yet'),
    ]
  }
  const pickS = station(pick, 'Done', 'Done')
  const writeDone = station(write, 'Done', 'Done · all nine parts')
  const writeNot = station(write, 'Not yet', 'Not yet')
  const checkNot = station(check, 'Not yet', 'Not yet')
  const publishNot = station(publish, 'Not yet', 'Not yet')
  const checkDone = station(check, 'Done', fixes > 0 ? `Done · ${fixesText(fixes)} made` : 'Done')

  switch (state) {
    case 'published': {
      const at = footer.kind === 'published' ? footer.publishedAt : null
      return [
        pickS,
        writeDone,
        checkDone,
        station(publish, 'Done', at != null ? `Done · ${dayMonthOf(at)}` : 'Done'),
      ]
    }
    case 'stopped':
    case 'problem': {
      const word: StatusWord = state === 'stopped' ? 'Stopped' : 'Problem'
      if (w < 9) {
        return [pickS, station(write, word, word, true), checkNot, publishNot]
      }
      return [pickS, writeDone, station(check, word, word, true), publishNot]
    }
    case 'stuck':
      return [pickS, station(write, 'Waiting for you', 'Waiting for you', true), checkNot, publishNot]
    case 'older': {
      if (footer.kind === 'running' && w < 9) {
        return [pickS, station(write, 'Working', `Working · ${w} of 9 parts`), checkNot, publishNot]
      }
      if (footer.kind === 'ready') return [pickS, writeDone, checkDone, publishNot]
      return [pickS, w >= 9 ? writeDone : writeNot, checkNot, publishNot]
    }
    case 'writing':
      return [
        pickS,
        station(write, 'Working', `Working · ${w} of 9 parts`, true),
        checkNot,
        publishNot,
      ]
    case 'checking':
      return [pickS, writeDone, station(check, 'Working', 'Working', true), publishNot]
    case 'held': {
      if (footer.kind === 'running') {
        return w >= 9
          ? [pickS, writeDone, station(check, 'Working', 'Working', true), publishNot]
          : [pickS, station(write, 'Working', `Working · ${w} of 9 parts`, true), checkNot, publishNot]
      }
      return [pickS, writeDone, checkDone, station(publish, 'Waiting for you', 'On hold — waiting for you', true)]
    }
    case 'ready-collab':
      return [
        pickS,
        writeDone,
        checkDone,
        station(publish, 'Not yet', 'Now — waiting for the editor-in-chief', true),
      ]
    case 'ready':
    default: {
      const publishLine =
        role === undefined || role === 'Editor-in-chief' ? 'Now — waiting for you' : 'Now — waiting for the editor-in-chief'
      return [pickS, writeDone, checkDone, station(publish, 'Waiting for you', publishLine, true)]
    }
  }
}

export function deriveEditorHome(a: {
  footer: HomeFooter
  held: boolean | undefined
  role: Role | undefined
  rows: HomeSectionRow[] | undefined
  pinnedOlder?: boolean
}): EditorHomeVM {
  const rows = a.rows ?? []
  const w = rows.filter((r) => r.state === 'clean').length
  const fixes = rows.reduce((n, r) => n + (r.agentChanges ?? 0), 0)
  const { state, word } = mapState({
    footer: a.footer,
    held: a.held,
    role: a.role,
    w,
    pinnedOlder: a.pinnedOlder === true,
  })
  return {
    state,
    word,
    stations: buildStations({ state, footer: a.footer, role: a.role, w, fixes }),
    writtenCount: w,
    fixCount: fixes,
    publishable: state === 'ready' && a.role === 'Editor-in-chief' && a.held === false,
  }
}

// ─── Slab copy ──────────────────────────────────────────────────────────────

export type SlabAction = 'publish' | 'start-next' | 'start-new' | 'start-first' | 'release' | 'stop-stuck'

export interface SlabCopy {
  sentence: string
  explanation?: string
  action?: SlabAction
  actionLabel?: string
  working: boolean
  link?: 'preview' | 'website' | 'what-happened'
  linkLabel?: string
}

export function homeSlabCopy(
  vm: EditorHomeVM,
  ctx: {
    issueNumber: number | null
    startedAt?: number
    publishedAt?: number | null
    now: number
    pinned?: boolean
  },
): SlabCopy {
  const n = ctx.issueNumber
  const issueLabel = n != null ? `Issue ${n}` : 'this issue'
  switch (vm.state) {
    case 'ready': {
      const base = {
        sentence: 'Read the issue, then publish it.',
        explanation:
          "Everything is written and checked. Open any part below to read it or change the words. When you're happy, press Publish.",
        working: false,
      }
      if (!vm.publishable) return base // role still loading: no action
      return {
        ...base,
        action: 'publish',
        actionLabel: n != null ? `Publish Issue ${n}` : 'Publish this issue',
        link: 'preview',
        linkLabel: 'Preview the issue first',
      }
    }
    case 'ready-collab':
      return {
        sentence: 'Waiting for the editor-in-chief to publish.',
        explanation:
          'Everything is written and checked. You can open any part below to read it or change the words.',
        working: false,
      }
    case 'writing': {
      const w = vm.writtenCount
      const count =
        w === 0
          ? 'None of the nine parts are written yet.'
          : w === 1
            ? 'One of the nine parts is written.'
            : `${NUMBER_WORDS[w] ?? w} of the nine parts are written.`
      let started = ''
      if (ctx.startedAt != null) {
        if (sameDay(ctx.startedAt, ctx.now)) {
          const h = hourOf(ctx.startedAt)
          const when = h < 12 ? 'this morning' : h < 17 ? 'this afternoon' : 'this evening'
          started = `${issueLabel} started at ${formatClock(ctx.startedAt)} ${when}. `
        } else {
          started = `${issueLabel} started on ${weekdayOf(ctx.startedAt)} at ${formatClock(ctx.startedAt)}. `
        }
      }
      return {
        sentence: 'Nothing for you to do yet. The writers are on it.',
        explanation: `${started}${count} This page updates by itself, so come back when it says the issue is ready.`,
        working: true,
      }
    }
    case 'checking':
      return {
        sentence: 'Nothing for you to do yet. The writers are checking their work.',
        explanation: 'All nine parts are written. They are being checked and fixed. This page updates by itself.',
        working: true,
      }
    case 'held':
      return {
        sentence: 'This issue is on hold.',
        explanation: 'It will not go out until you release it. You can still read and change the parts.',
        action: 'release',
        actionLabel: 'Release this issue',
        working: false,
        link: 'preview',
        linkLabel: 'Preview the issue first',
      }
    case 'published': {
      const day = ctx.publishedAt != null ? weekdayOf(ctx.publishedAt) : 'Thursday'
      if (ctx.pinned) {
        return {
          sentence: `${issueLabel.charAt(0).toUpperCase()}${issueLabel.slice(1)} went out on ${day}.`,
          explanation: 'Readers can see it now. You can still open a part to read it.',
          working: false,
        }
      }
      return {
        sentence: `${issueLabel.charAt(0).toUpperCase()}${issueLabel.slice(1)} went out on ${day}. Start the next one when you're ready.`,
        explanation:
          "Readers can see it now. Starting the next issue takes one click: the writers pick a charity and write all nine parts, then this page tells you when it's your turn.",
        action: 'start-next',
        actionLabel: "Start next week's issue",
        working: false,
        link: 'website',
        linkLabel: `Read ${issueLabel} on the website`,
      }
    }
    case 'problem':
      return {
        sentence: 'This issue hit a problem and stopped. Nothing reached readers.',
        explanation:
          'There is nothing to fix here by hand. Start a new issue and the writers will try again from the beginning, usually without trouble.',
        action: 'start-new',
        actionLabel: 'Start a new issue',
        working: false,
        link: 'what-happened',
        linkLabel: 'What happened',
      }
    case 'stopped':
      return {
        sentence: 'This issue was stopped. Nothing reached readers.',
        explanation: "Start a new issue when you're ready. The writers will begin again from the start.",
        action: 'start-new',
        actionLabel: 'Start a new issue',
        working: false,
      }
    case 'stuck':
      return {
        sentence: "This older issue can't continue.",
        explanation: "It paused on an older version of the system and can't finish. Stop it, then start a new issue.",
        action: 'stop-stuck',
        actionLabel: 'Stop this issue',
        working: false,
      }
    case 'older':
      return {
        sentence: 'This older issue was never published.',
        explanation: "You can read its parts. Only this week's issue can be published.",
        working: false,
      }
    case 'empty':
      return {
        sentence: 'No issue yet this week',
        explanation:
          "Start the first issue and the writers will pick a charity and write all nine parts. This page will tell you when it's your turn.",
        action: 'start-first',
        actionLabel: 'Start the first issue',
        working: false,
      }
    case 'loading':
    default:
      return { sentence: '', working: false }
  }
}

export function partRowStatus(
  row: Pick<HomeSectionRow, 'state' | 'agentChanges'>,
  ctx: { published: boolean },
): { text: string; word: StatusWord; linked: boolean } {
  if (row.state === 'clean') {
    if (ctx.published) return { text: 'Published', word: 'Done', linked: true }
    const n = row.agentChanges
    const text = n <= 0 ? 'Written' : `Written · ${fixesText(n)} by the writers`
    return { text, word: 'Done', linked: true }
  }
  if (row.state === 'writing') return { text: 'Working', word: 'Working', linked: false }
  return { text: 'Not yet', word: 'Not yet', linked: false }
}

export function partsHint(state: HomeState): string {
  switch (state) {
    case 'ready':
    case 'ready-collab':
    case 'held':
    case 'older':
      return 'Click a part to read it or change the words.'
    case 'writing':
    case 'checking':
      return "Finished parts open as soon as they're written."
    case 'published':
      return 'You can still open a part to read it. Changes after publishing need a new issue.'
    default:
      return ''
  }
}

// ─── Run status / archive ───────────────────────────────────────────────────

export function runStatusWord(a: { status: string; interrupt?: boolean }): StatusWord {
  switch (a.status) {
    case 'complete':
      return 'Done'
    case 'cancelled':
      return 'Stopped'
    case 'failed':
      return a.interrupt === true ? 'Waiting for you' : 'Problem'
    case 'running':
      return 'Working'
    case 'awaiting-review':
      return 'Waiting for you'
    default:
      return 'Not yet'
  }
}

export interface ArchiveRowVM {
  runId: string
  issueNumber: number
  dateLine: string
  title: string
  word: StatusWord
  statusText: string
  reason?: string
  current: boolean
  publishedUrl?: string | null
}

export function deriveArchiveRows(a: {
  issues: Array<{
    issueNumber: number
    title: string | null
    published: boolean
    runId: string | null
    publishedAt?: number | null
    runStartedAt?: number | null
    scheduledFor?: number | null
    slug?: string | null
  }>
  runs:
    | Array<{ runId: string; status: string; startedAt: number; completedAt?: number }>
    | undefined
  currentRunId: string | null
}): { listed: ArchiveRowVM[]; unfinished: ArchiveRowVM[] } | undefined {
  if (a.runs === undefined) return undefined
  const listed: ArchiveRowVM[] = []
  const unfinished: ArchiveRowVM[] = []
  for (const issue of a.issues) {
    if (issue.runId === null) continue
    const run = a.runs.find((r) => r.runId === issue.runId)
    if (!run && !issue.published) continue
    const t = issueThursday({
      publishedAt: issue.publishedAt,
      scheduledFor: issue.scheduledFor,
      runStartedAt: issue.runStartedAt ?? run?.startedAt,
    })
    const hasTitle = issue.title != null && issue.title.trim() !== ''
    const base = {
      runId: issue.runId,
      issueNumber: issue.issueNumber,
      dateLine: `Issue ${issue.issueNumber}${t != null ? ` · ${formatLongDate(t, false)}` : ''}`,
      title: hasTitle ? (issue.title as string) : NO_CHARITY_YET,
      current: false,
      publishedUrl: issue.slug ? `/issue/${issue.slug}` : null,
    }
    const status = run?.status
    if (issue.published || status === 'complete') {
      listed.push({ ...base, word: 'Done', statusText: 'Published' })
    } else if (status === 'cancelled') {
      unfinished.push({
        ...base,
        word: 'Stopped',
        statusText: 'Stopped',
        reason: hasTitle ? 'Stopped while it was being written' : 'Stopped before a charity was chosen',
      })
    } else if (status === 'failed') {
      unfinished.push({
        ...base,
        word: 'Problem',
        statusText: 'Problem',
        reason: hasTitle
          ? 'Hit a problem while it was being written'
          : 'Hit a problem before a charity was chosen',
      })
    } else if (issue.runId === a.currentRunId) {
      const waiting = status === 'awaiting-review' && run?.completedAt != null
      listed.push({
        ...base,
        current: true,
        word: waiting ? 'Waiting for you' : 'Working',
        statusText: waiting ? 'Waiting for you · this week' : 'Working',
      })
    } else {
      unfinished.push({ ...base, word: 'Stopped', statusText: 'Stopped', reason: 'Never finished' })
    }
  }
  const byNewest = (x: ArchiveRowVM, y: ArchiveRowVM) => y.issueNumber - x.issueNumber
  listed.sort(byNewest)
  unfinished.sort(byNewest)
  return { listed, unfinished }
}

// ─── Rewrite rules / cost ───────────────────────────────────────────────────

export const AGENT_FOR_SECTION: Record<string, string> = {
  originStory: 'origin_story',
  problemStatement: 'problem',
  founderBio: 'founder_bio',
  caseStudy: 'case_study',
  bonus: 'bonus',
  game: 'game',
  theme: 'design',
}

export function canRewrite(a: {
  sectionId: string
  bonusType?: string
  published: boolean
  runStatus?: string
}): boolean {
  if (a.published === true || a.runStatus === 'running') return false
  if (a.sectionId === 'bonus') return a.bonusType === 'specAd'
  return ['originStory', 'problemStatement', 'founderBio', 'caseStudy'].includes(a.sectionId)
}

export function formatCostLine(a: {
  costUsd: number | undefined
  startedAt?: number
  completedAt?: number
  mode: 'finished' | 'stopped'
}): string | null {
  if (a.costUsd === undefined) return null
  const cost = `$${a.costUsd.toFixed(2)}`
  if (a.mode === 'stopped') return `This attempt cost ${cost} before it stopped.`
  if (a.startedAt == null || a.completedAt == null) return `This issue cost ${cost} to write.`
  const minutes = Math.max(1, Math.round((a.completedAt - a.startedAt) / 60000))
  return `This issue cost ${cost} to write and took ${minutes === 1 ? '1 minute' : `${minutes} minutes`}.`
}

// ─── Banned words + copy ────────────────────────────────────────────────────

export const EDITOR_BANNED_PATTERN =
  /\b(runs?|trigger|pipeline|graph|DAG|drift|re-?roll|calibrator|chronicler|agents?|tokens?|gate|interrupt|deterministic|awaiting-review|failed)\b/i
export const RUN_ID_PATTERN = /\b[0-9a-f]{8,}\b/i

export const COPY = {
  holdExplanation:
    'Not ready this week? Holding keeps the issue from going out until you release it. You can still read and change the parts.',
  stopExplanation:
    'Changed your mind about this charity or this week? Stopping throws away what has been written so far. You can start a new issue straight after.',
  sectionToolbarHelper: 'Click any paragraph to change the words. Changes save to this issue straight away.',
  sectionPublishedHelper: 'This issue is published. Changes after publishing need a new issue.',
  rewriteButton: 'Rewrite this part',
  editReassurance: 'Nothing goes to readers until you press Publish on the issue page.',
  saved: 'Saved',
  saveFailed: "We couldn't save that change. Your words are still in the box. Press Save to try again.",
  publishFailed:
    "Publishing didn't go through, and nothing has reached readers. Press Publish Issue {N} to try again. If it keeps happening, tell Andrew.",
  startFailed: "We couldn't start a new issue just now. Wait a minute and press Start a new issue again.",
  loadFailed: "This page didn't load. Check your connection, then press Reload this page.",
  reloadButton: 'Reload this page',
  rewriteInProgress: 'Rewriting this part…',
  rewriteResult: 'Here is the new version. Keep it or go back to the old one.',
  keepVersion: 'Keep this version',
  goBack: 'Go back to the old one',
  stopConfirmTitle: 'Stop writing this issue?',
  stopConfirmBody:
    'This throws away what has been written so far for {issue}. Nothing has reached readers. You can start a new issue straight after.',
  stopConfirm: 'Stop writing',
  stopCancel: 'Keep writing',
  discardTitle: 'Leave without saving?',
  discardBody: "Your changes to this paragraph haven't been saved.",
  discardConfirm: 'Leave without saving',
  discardCancel: 'Keep editing',
  discardIssueButton: 'Discard this issue',
  discardIssueExplanation:
    "Doesn't make sense? Discarding deletes everything written for this issue. Nothing reaches readers, and the next issue you start keeps the same number.",
  discardIssueConfirmTitle: 'Discard {issue}?',
  discardIssueConfirmBody:
    'Everything the writers wrote for it is deleted for good. Nothing reached readers. The next issue you start will be {issue} again.',
  discardIssueConfirm: 'Discard it',
  discardIssueCancel: 'Keep this issue',
  discardIssuePending: 'Discarding {issue}. This can take a minute while the writers stop.',
  discardIssueFailed: "That didn't go through. Press Discard this issue again.",
  discardIssuePublished: "This issue was published, so it can't be discarded.",
  holdButton: 'Hold this issue',
  stopButton: 'Stop writing this issue',
  releaseButton: 'Release this issue',
  holdReason: 'Held by the editor',
  sectionSlab: 'Read this part and change any words you like. Then go back to the issue to publish it.',
  archiveSlab: 'Nothing is waiting here. Open an issue to read it or change its words.',
  archiveSlabWaiting: 'Issue {N} is waiting for you.',
  behindSlab: 'Nothing here needs you this week. The issue is waiting for you on the front page.',
  subPageSlab: "Nothing here is needed to publish this week's issue.",
  backToIssue: 'Back to the issue',
  thisWeeksIssue: "This week's issue",
  backToBehind: 'Back to behind the scenes',
  emptyArchive: 'No past issues yet. Once you publish an issue it will be listed here.',
  emptySearch: 'No issue matches "{query}". Try a charity name or an issue number.',
  // quick 261023-1i8: toast copy. {issue} is the Home label ("Issue 48" / "this issue").
  toastPublishing: 'Publishing {issue}…',
  toastPublished: '{issue} is published.',
  toastPublishedDetail: 'It is live on the website.',
  toastPublishFailed: "Publishing didn't go through.",
  toastPublishFailedDetail: 'Nothing has reached readers. Press Publish to try again.',
  toastStarting: 'Starting a new issue…',
  toastStarted: 'The writers have started on the next issue.',
  toastStartFailed: "We couldn't start a new issue.",
  toastHeld: '{issue} is on hold.',
  toastHeldDetail: 'It will not go out until you release it.',
  toastReleased: '{issue} is released.',
  toastReleasedDetail: 'You can publish it when you are ready.',
  toastTryAgain: "That didn't go through. Try again.",
  toastStopping: 'Stopping {issue}…',
  toastStopped: 'Stopped writing {issue}.',
  toastDiscarding: 'Discarding {issue}…',
  toastDiscarded: '{issue} is discarded.',
  toastDiscardedDetail: 'Nothing reached readers.',
  toastSaved: 'Saved.',
  toastSavedDetail: 'Your change is in this issue.',
  toastRewriting: 'Rewriting this part…',
  toastRewritten: 'This part has a new version.',
  toastRewrittenDetail: 'Keep it or go back to the old one.',
  toastRewriteFailed: "The rewrite didn't go through.",
  toastKept: 'Kept the new version.',
  toastWentBack: 'Back to the old version.',
} as const

// ─── Behind the scenes: the ten plain steps ─────────────────────────────────

export interface PlainStep {
  key: string
  name: string
  agentKeys: readonly string[]
}

export const PLAIN_STEPS: readonly PlainStep[] = [
  { key: 'leads', name: 'Find story leads', agentKeys: ['signal_editor'] },
  { key: 'charities', name: 'Find charities worth writing about', agentKeys: ['scout', 'advocate'] },
  { key: 'verify-charities', name: 'Check the charities are real', agentKeys: ['verify_candidates'] },
  { key: 'choose', name: "Choose this week's charity", agentKeys: ['editor_gate_1', 'chronicler'] },
  { key: 'research', name: 'Research the charity', agentKeys: ['researcher'] },
  { key: 'verify-research', name: 'Check the research against its sources', agentKeys: ['verify_research'] },
  {
    key: 'write',
    name: 'Write the nine parts',
    agentKeys: ['origin_story', 'problem', 'founder_bio', 'case_study', 'game', 'bonus', 'design', 'validate_sections'],
  },
  { key: 'check', name: 'Check the writing and fix problems', agentKeys: ['qa'] },
  { key: 'final', name: 'Final read-through', agentKeys: ['editor_final'] },
  { key: 'publish', name: 'Publish', agentKeys: ['publisher'] },
]

const WRITER_NAMES: Record<string, string> = {
  origin_story: 'Origin story writer',
  problem: 'Problem writer',
  founder_bio: 'Founder writer',
  case_study: 'Case study writer',
  game: 'Game writer',
  bonus: 'Bonus writer',
  design: 'Look designer',
  calibrator: 'Weekly style note',
}

/** Plain name for any agent key; the only way an agent key may reach the screen. */
export function plainNameForKey(agentKey: string): string {
  if (WRITER_NAMES[agentKey]) return WRITER_NAMES[agentKey]
  const step = PLAIN_STEPS.find((s) => s.agentKeys.includes(agentKey))
  if (step) return step.name
  const spaced = agentKey.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export interface StepVM {
  key: string
  name: string
  word: StatusWord
  line: string
  /** Raw error of the failing row: only for the collapsed Technical details block. */
  error?: string
}

export function deriveBehindSteps(a: {
  agentRuns:
    | Array<{ agentKey: string; status: string; completedAt?: number; error?: string | null }>
    | undefined
  runStatus: string | undefined
  fixCount?: number
}): StepVM[] | undefined {
  if (a.agentRuns === undefined) return undefined
  const cancelled = a.runStatus === 'cancelled'
  return PLAIN_STEPS.map((step) => {
    const members = a.agentRuns!.filter((r) => step.agentKeys.includes(r.agentKey))
    const base = { key: step.key, name: step.name }
    const notYet = (): StepVM =>
      cancelled
        ? { ...base, word: 'Stopped', line: 'Stopped' }
        : { ...base, word: 'Not yet', line: 'Not yet' }

    if (members.length === 0) return notYet()

    const problem = members.find((r) => r.status === 'failed' && !isGateInterrupt(r))
    if (problem) {
      return { ...base, word: 'Problem', line: 'Problem', error: problem.error ?? undefined }
    }
    if (members.some((r) => isGateInterrupt(r))) {
      return { ...base, word: 'Waiting for you', line: 'Waiting for you' }
    }
    if (members.some((r) => r.status === 'running')) {
      return cancelled
        ? { ...base, word: 'Stopped', line: 'Stopped' }
        : { ...base, word: 'Working', line: 'Working' }
    }
    if (members.every((r) => r.status === 'done')) {
      const latest = Math.max(...members.map((r) => r.completedAt ?? 0))
      let line = latest > 0 ? `Done · ${formatClock(latest)}` : 'Done'
      if (step.key === 'check' && (a.fixCount ?? 0) > 0) line += ` · ${fixesText(a.fixCount!)}`
      return { ...base, word: 'Done', line }
    }
    return notYet()
  })
}

export function firstProblemStep(steps: StepVM[]): string | null {
  return steps.find((s) => s.word === 'Problem')?.key ?? null
}
