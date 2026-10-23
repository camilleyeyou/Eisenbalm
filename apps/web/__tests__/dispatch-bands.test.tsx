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
  it('mounts the sandboxed iframe immediately; Play restarts it', () => {
    const { container, getByRole } = render(<GameSlot game={fullIssue.game!} runId={null} />)
    expect(container.querySelector('section#game.d-sec--game')).not.toBeNull()
    const before = container.querySelector('iframe')!
    expect(before.getAttribute('sandbox')).toBe('allow-scripts')
    expect(before.getAttribute('loading')).toBe('lazy')
    fireEvent.click(getByRole('button', { name: 'Play Wheel Fix' }))
    const after = container.querySelector('iframe')!
    expect(after).not.toBe(before)
    expect(after.getAttribute('sandbox')).toBe('allow-scripts')
    expect(getByRole('button', { name: 'Play Wheel Fix' })).not.toBeNull()
  })

  it('renders the How to play panel from goal / howToPlay / controls', () => {
    const { container, getByText } = render(<GameSlot game={fullIssue.game!} runId={null} />)
    expect(getByText('How to play')).not.toBeNull()
    expect(getByText('Fix 10 wheels before the shop closes.')).not.toBeNull()
    const steps = Array.from(container.querySelectorAll('.d-game-steps li')).map((li) => li.textContent)
    expect(steps).toEqual(['Tap a wobbling wheel.', 'Hold until the bar fills.', 'Miss three and the shop closes.'])
    const kbds = Array.from(container.querySelectorAll('kbd')).map((k) => k.textContent)
    expect(kbds).toEqual(['Tap', 'Space'])
  })

  it('renders legacy games (no instruction fields) without a How to play block', () => {
    const { goal: _g, howToPlay: _h, controls: _c, ...legacy } = fullIssue.game!
    void _g; void _h; void _c
    const { container, queryByText, getByRole } = render(<GameSlot game={legacy} runId={null} />)
    expect(queryByText('How to play')).toBeNull()
    expect(container.querySelector('iframe')).not.toBeNull()
    expect(getByRole('button', { name: 'Play Wheel Fix' })).not.toBeNull()
  })

  it('nests the iframe inside .d-game-frame inside .d-game-stage', () => {
    const { container } = render(<GameSlot game={fullIssue.game!} runId={null} />)
    expect(container.querySelector('.d-game-stage > .d-game-frame > iframe')).not.toBeNull()
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
