/**
 * Shared issue fixtures for Phase 55 tests (not a *.test file).
 */
import type { ArchiveIssue, Issue, IssueDeliberationCandidate } from '@/lib/sanity/types'

type FullIssue = NonNullable<Issue>

let k = 0
function block(text: string) {
  k += 1
  return {
    _type: 'block' as const,
    _key: `b${k}`,
    style: 'normal' as const,
    markDefs: [],
    children: [{ _type: 'span' as const, _key: `s${k}`, text, marks: [] }],
  }
}

const charity = {
  name: 'Acme Mobility Cooperative',
  slug: 'acme-mobility-cooperative',
  location: 'Dayton, Ohio',
  website: 'https://acme.example.org',
  charityNavigatorUrl: null,
  foundingYear: 1998,
  assetRange: '$100K–$500K',
  focusArea: 'Wheelchair repair',
  missionStatement:
    'Acme repairs wheelchairs for people who cannot wait. It has done so since 1998. It intends to continue.',
}

const candidates: IssueDeliberationCandidate[] = [
  {
    charity: { name: charity.name, slug: charity.slug, location: charity.location },
    scoutSummary: 'Scout summary A',
    advocateArgument: 'Advocate argument A',
    advocateScore: 9,
  },
  {
    charity: { name: 'Second Street Pantry', slug: 'second-street-pantry', location: 'Akron, Ohio' },
    scoutSummary: 'Scout summary B',
    advocateArgument: 'Advocate argument B',
    advocateScore: 7,
  },
  {
    charity: { name: 'Third Ward Library', slug: 'third-ward-library', location: 'Toledo, Ohio' },
    scoutSummary: 'Scout summary C',
    advocateArgument: 'Advocate argument C',
    advocateScore: 6,
  },
  {
    charity: { name: 'Fourth Creek Trust', slug: 'fourth-creek-trust', location: 'Erie, Pennsylvania' },
    scoutSummary: 'Scout summary D',
    advocateArgument: null,
    advocateScore: null,
  },
]

export const fullIssue: FullIssue = {
  issueNumber: 2,
  publishDate: '2026-10-15',
  bonusType: 'specAd',
  runId: 'run-2',
  charity,
  narrator: null,
  theme: null,
  originStory: {
    headline: 'The Chair Is Not Optional',
    body: [block('Acme began in a garage in 1998.'), block('It has not left the garage in spirit.')],
  },
  problemStatement: {
    headline: 'The Waiting List',
    body: [block('Repairs take too long.'), block('This is the problem.')],
    keyDataPoints: [
      { stat: '42% of chairs wait over 90 days for repair', source: 'Survey 2025' },
      { stat: '$1,200 average repair cost', source: null },
      { stat: 'Most repair shops closed in the last decade', source: null },
    ],
  },
  problemPdfUrl: null,
  founderBio: {
    headline: 'A Founder, Treated Seriously',
    body: [block('The founder holds a wrench.'), block('The wrench holds the founder.')],
  },
  caseStudy: {
    subjectName: 'Marta',
    headline: 'Marta Waits No Longer',
    body: [block('Marta needed a repair.'), block('She received one.')],
  },
  game: {
    headline: 'Wheel Fix',
    goal: 'Fix 10 wheels before the shop closes.',
    howToPlay: ['Tap a wobbling wheel.', 'Hold until the bar fills.', 'Miss three and the shop closes.'],
    controls: 'Tap · Space',
    description: 'Repair the wheel.',
    embedCode: '<!doctype html><html><body><canvas></canvas></body></html>',
  },
  bonus: {
    headline: 'Spec Ad',
    body: [block('Ad copy.')],
    lyrics: null,
    sunoPrompt: null,
    sunoAudioUrl: null,
    storyboards: null,
  },
  podcast: {
    audioUrl: null,
    podcastDescription: 'A podcast.',
    duration: null,
    deliberationTranscript: null,
  },
  selectionDeliberation: {
    candidates,
    editorDecision: 'Acme was selected. The others were also good.',
    runnerUpNotes: 'Second Street Pantry came close. It will be reconsidered.',
    editorConfidence: 0.8,
  },
  frontPage: {
    dek: 'Wheelchairs wait. Acme does not.',
    tickerLines: ['Dayton, Ohio', 'Founded 1998', 'Wheelchair repair'],
    pullQuotes: { origin: 'It has not left the garage in spirit.', case: 'She received one.' },
    caseTimeline: [
      { label: 'Request', value: 'Day 1' },
      { label: 'Diagnosis', value: 'Day 3' },
      { label: 'Repair', value: 'Day 10' },
      { label: 'Result', value: 'Mobile again' },
    ],
    adSummary: {
      title: 'Spec Ad',
      rows: [
        { label: 'Format', value: '30 seconds' },
        { label: 'Tone', value: 'Grave' },
        { label: 'Product', value: 'Lip balm' },
      ],
    },
    heroImage: null,
    impactUnit: { label: 'wheelchair', costMinUsd: 120, costMaxUsd: 180 },
  },
}

export const sparseIssue: FullIssue = {
  issueNumber: 1,
  publishDate: '2026-10-08',
  bonusType: 'jingle',
  runId: null,
  charity: {
    name: 'Bare Charity',
    slug: 'bare-charity',
    location: 'Nowhere, Ohio',
    website: null,
    charityNavigatorUrl: null,
    foundingYear: null,
    assetRange: null,
    focusArea: null,
    missionStatement: null,
  },
  theme: null,
  originStory: null,
  problemStatement: null,
  problemPdfUrl: null,
  founderBio: null,
  caseStudy: null,
  game: null,
  bonus: null,
  podcast: null,
  selectionDeliberation: null,
}

export const longWordIssue: FullIssue = {
  ...fullIssue,
  charity: {
    ...charity,
    name: 'Pneumonoultramicroscopicsilicovolcanoconiosis Mobilization Collective',
  },
  originStory: {
    headline: 'The Supercalifragilisticexpialidocious-Pneumonoultra Chair',
    body: fullIssue.originStory!.body,
  },
}

export const oneCandidateIssue: FullIssue = {
  ...fullIssue,
  selectionDeliberation: {
    candidates: [candidates[0]!],
    editorDecision: 'Acme was selected.',
    runnerUpNotes: null,
  },
}

const focus = ['Wheelchair repair', 'Food access', 'Literacy', 'Watershed care', 'Tool lending']
const places = ['Dayton, Ohio', 'Akron, Ohio', 'Toledo, Ohio', 'Erie, Pennsylvania', 'Flint, Michigan']

export const archiveIssues: ArchiveIssue[] = Array.from({ length: 10 }, (_, i) => {
  const n = 10 - i
  return {
    issueNumber: n,
    publishDate: `2026-${String(Math.min(n + 1, 12)).padStart(2, '0')}-15`,
    slug: `issue-${n}`,
    bonusType: (['bigBudget', 'jingle', 'specAd'] as const)[n % 3]!,
    charity: {
      name: `Charity Number ${n}`,
      slug: `charity-number-${n}`,
      location: places[n % places.length]!,
      focusArea: focus[n % focus.length]!,
      assetRange: '$100K–$500K',
    },
  }
})
