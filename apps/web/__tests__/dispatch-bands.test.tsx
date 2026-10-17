import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'

vi.mock('convex/react', () => ({ useMutation: () => vi.fn().mockResolvedValue(null) }))
vi.mock('@convex/_generated/api', () => ({ api: { qaCorrections: { insert: 'qaCorrections:insert' } } }))
vi.mock('next/image', () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}))

import { GameSlot } from '@/components/issue/GameSlot'
import { PodcastSlot } from '@/components/issue/PodcastSlot'
import { BonusSection } from '@/components/issue/BonusSection'
import { adSummary } from '@/lib/dispatch/derive'
import { fullIssue } from './fixtures/issue'

afterEach(cleanup)

describe('GameSlot band', () => {
  it('gates the sandboxed iframe behind Play', () => {
    const { container, getByRole } = render(<GameSlot game={fullIssue.game!} runId={null} />)
    expect(container.querySelector('section#game.d-sec--game')).not.toBeNull()
    expect(container.querySelector('iframe')).toBeNull()
    fireEvent.click(getByRole('button', { name: 'Play Wheel Fix' }))
    const frame = container.querySelector('iframe')!
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
  })

  it('falls back (no iframe) when the validator rejects', () => {
    const game = { ...fullIssue.game!, embedCode: '<html><script src="https://evil.example"></script></html>' }
    const { container } = render(<GameSlot game={game} runId={null} />)
    expect(container.querySelector('iframe')).toBeNull()
    expect(container.textContent).toContain('Game unavailable.')
  })
})

describe('PodcastSlot band', () => {
  it('shows empty state without audio', () => {
    const { container } = render(<PodcastSlot podcast={{ ...fullIssue.podcast!, audioUrl: null }} />)
    expect(container.querySelector('section#pod')).not.toBeNull()
    expect(container.textContent).toContain('Audio coming soon.')
    expect(container.querySelector('audio')).toBeNull()
  })
  it('renders audio controls with a url', () => {
    const { container } = render(
      <PodcastSlot podcast={{ ...fullIssue.podcast!, audioUrl: 'https://cdn.example/a.mp3' }} />,
    )
    expect(container.querySelector('audio[controls]')).not.toBeNull()
  })
})

describe('BonusSection band', () => {
  const ad = adSummary(fullIssue)
  it('spec ad shows the authored summary', () => {
    const { container } = render(<BonusSection bonus={fullIssue.bonus} bonusType="specAd" adSummary={ad} />)
    expect(container.querySelector('section#bonus.d-sec--bonus')).not.toBeNull()
    expect(container.textContent).toContain('The ad we made them')
    expect(container.querySelectorAll('.d-adsummary dl > div')).toHaveLength(ad!.rows.length)
    expect(ad!.rows.length).toBe(3)
  })
  it('jingle has the jingle eyebrow and no ad summary', () => {
    const { container } = render(<BonusSection bonus={fullIssue.bonus} bonusType="jingle" adSummary={ad} />)
    expect(container.textContent).toContain('The jingle we made them')
    expect(container.querySelector('.d-adsummary')).toBeNull()
  })
  it('null summary renders none', () => {
    const { container } = render(<BonusSection bonus={fullIssue.bonus} bonusType="specAd" adSummary={null} />)
    expect(container.querySelector('.d-adsummary')).toBeNull()
  })
})
