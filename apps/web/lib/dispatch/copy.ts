/**
 * Phase 55 reader-facing copy. Jesse's register: dry, precise, no exclamation
 * marks. Cadence is Thursday. The price is derived from BALM_PRICE_CENTS and
 * never written as a literal here.
 */
import { BALM_PRICE_CENTS, formatUsd } from '@/lib/site'

export type SectionId = 'origin' | 'problem' | 'founder' | 'case' | 'game' | 'bonus' | 'delib' | 'pod'
export type DotTone = 'green' | 'blue' | 'red' | 'yellow'
export type BonusKind = 'specAd' | 'jingle' | 'bigBudget'

export interface SectionMetaEntry {
  id: SectionId
  number: string
  label: string
  navLabel: string
  dot: DotTone
}

export const PRICE_LABEL = formatUsd(BALM_PRICE_CENTS)
export const FUND_CTA = `Fund them · ${PRICE_LABEL}`

export function fundButtonLabel(name: string | null | undefined): string {
  const n = typeof name === 'string' ? name.trim() : ''
  return n.length > 0 && n.length <= 28 ? `Fund ${n} · ${PRICE_LABEL}` : FUND_CTA
}

export const READ_STORY_CTA = 'Read their story ↓'
export const MASTHEAD_WORDMARK = 'The Eisenbalm Dispatch'
export const MASTHEAD_TAGLINE = 'One overlooked nonprofit on the front page each week. Funded in full.'
export const TOPBAR_LINKS = [
  { label: "This week's nonprofit", href: '#story' },
  { label: 'Past nonprofits', href: '/archive' },
  { label: 'How it works', href: '#how' },
  { label: 'About', href: '#about' },
] as const

export const HERO_EYEBROW = "This week's nonprofit"
export const HOW_EYEBROW = 'How the Dispatch works'
export const HOW_STEPS = [
  { lead: 'Each Thursday', rest: ' we select one small nonprofit most people have not heard of.' },
  { lead: 'We tell its story,', rest: ' start to finish, on this page.' },
  { lead: 'Every lip balm sold that week funds it.', rest: ` The full ${PRICE_LABEL}. 100% to them.` },
] as const

export const TICKER_CONSTANT_LINE = 'Every balm sold this week goes to them'
export const STICKER_LINES = [`Your ${PRICE_LABEL}`, '100% to them'] as const

export const SECTION_META: ReadonlyArray<SectionMetaEntry> = Object.freeze([
  { id: 'origin', number: '01', label: 'How it started', navLabel: 'How it started', dot: 'green' },
  { id: 'problem', number: '02', label: 'The problem', navLabel: 'The problem', dot: 'blue' },
  { id: 'founder', number: '03', label: 'The founder', navLabel: 'The founder', dot: 'yellow' },
  { id: 'case', number: '04', label: 'The case', navLabel: 'The case', dot: 'red' },
  { id: 'game', number: '05', label: 'The game', navLabel: 'The game', dot: 'green' },
  // Consumers override the bonus label with bonusLabel(bonusType).
  { id: 'bonus', number: '06', label: 'The bonus', navLabel: 'The bonus', dot: 'red' },
  { id: 'delib', number: '07', label: 'Why we selected them', navLabel: 'Why them', dot: 'blue' },
  { id: 'pod', number: '08', label: 'The Dispatch podcast', navLabel: 'Podcast', dot: 'green' },
] satisfies SectionMetaEntry[])

export function sectionMeta(id: SectionId): SectionMetaEntry {
  const m = SECTION_META.find((s) => s.id === id)
  if (!m) throw new Error(`Unknown section id: ${id}`)
  return m
}

export function bonusLabel(kind: BonusKind): string {
  switch (kind) {
    case 'jingle':
      return 'The jingle we made them'
    case 'bigBudget':
      return 'The production we made them'
    case 'specAd':
    default:
      return 'The ad we made them'
  }
}

export const DELIB_INTRO =
  'Each week a scout, an advocate and an editor argue over the shortlist. The result is published here.'
export const DELIB_CARD_LABELS = { picked: 'Picked', 'runner-up': 'Runner-up', also: 'Also considered' } as const
export const CONFIDENCE_LABEL = "Editor's confidence"

export const buyEyebrow = (charity: string): string => `How you can help ${charity}`
export const BUY_HEADLINE = 'Buy a lip balm. Fund the work.'

export function buyLead(
  charity: string,
  impact?: { min: number; max: number; unit: string } | null,
): string {
  const base = `Every lip balm sold this week sends its full ${PRICE_LABEL} to ${charity}.`
  if (!impact) return base
  return `${base} About ${impact.min} to ${impact.max} balms covers one ${impact.unit}.`
}

export const BALM_LINE =
  'The balm: Jesse A. Eisenbalm. Beeswax and shea butter, no petrolatum. Stop. Breathe. Balm.'
export const SHIPPING_NOTE = 'Flat-rate shipping, continental US'
export const MORE_THAN_ONE_LINK = 'More than one? Choose a quantity'
export const CHECKOUT_LOADING = 'Opening checkout'

export const COUNT_LABEL_CURRENT = 'Balms sold this week'
export const COUNT_LABEL_LIFETIME = 'Balms sold'
export const impactCaption = (unit: string): string => `Progress toward the next ${unit}`

export const BACK_ISSUES_HEADING = "Nonprofits we've featured"
export const SEARCH_LABEL = 'Find a nonprofit'
export const SEARCH_PLACEHOLDER = 'Name, cause or issue no.'
export const SEE_ALL = 'See them all →'
export const searchStatus = (n: number): string => `${n} ${n === 1 ? 'nonprofit' : 'nonprofits'}`
export const SEARCH_EMPTY = 'No nonprofit matches that. Try a name, a cause or an issue number.'
export const ARCHIVE_EMPTY = 'This is the first issue. The archive begins next Thursday.'

export const NEWSLETTER_LABEL = 'Be told when a new nonprofit is selected'
export const NEWSLETTER_BUTTON = 'Subscribe to the Dispatch'
export const NEWSLETTER_SENDING = 'Sending'
export const NEWSLETTER_SUCCESS = 'Recorded. You are on the list.'
export const NEWSLETTER_ERROR = 'That did not go through. Check the address and try again.'

export const FOOTER_BLURB =
  "A weekly front page for one nonprofit that deserves one. Paid for by Jesse A. Eisenbalm lip balm. Every sale goes to that week's nonprofit."
export const EMPTY_HOME_HEADING = 'No issue is published yet.'
export const EMPTY_HOME_BODY = 'The next Dispatch arrives Thursday. Check back then.'
export const COPYRIGHT_HOLDER = 'Jesse A. Eisenbalm'
