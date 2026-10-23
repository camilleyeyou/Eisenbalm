import { describe, it, expect } from 'vitest'
import { PLAIN_STEPS, deriveBehindSteps, firstProblemStep, plainNameForKey, formatClock } from '../lib/editorState'

// 9:04 PDT on Mon 26 Oct 2026
const T = (h: number, m: number) => Date.UTC(2026, 9, 26, h + 7, m)
const done = (agentKey: string, completedAt = T(9, 4)) => ({ agentKey, status: 'done', completedAt })

describe('PLAIN_STEPS', () => {
  it('ten steps in order', () => {
    expect(PLAIN_STEPS.map((s) => s.name)).toEqual([
      'Find story leads',
      'Find charities worth writing about',
      'Check the charities are real',
      "Choose this week's charity",
      'Research the charity',
      'Check the research against its sources',
      'Write the nine parts',
      'Check the writing and fix problems',
      'Final read-through',
      'Publish',
    ])
  })
})

describe('deriveBehindSteps', () => {
  it('undefined while loading', () => {
    expect(deriveBehindSteps({ agentRuns: undefined, runStatus: 'running' })).toBeUndefined()
  })
  it('Done with clock from latest completedAt', () => {
    const s = deriveBehindSteps({ agentRuns: [done('scout', T(9, 1)), done('advocate', T(9, 4))], runStatus: 'running' })!
    expect(s[1]).toMatchObject({ word: 'Done', line: 'Done · 9:04' })
    expect(formatClock(T(9, 4))).toBe('9:04')
  })
  it('check step shows fix count', () => {
    const s = deriveBehindSteps({ agentRuns: [done('qa', T(9, 39))], runStatus: 'running', fixCount: 6 })!
    expect(s[7].line).toBe('Done · 9:39 · 6 fixes')
    const one = deriveBehindSteps({ agentRuns: [done('qa', T(9, 39))], runStatus: 'running', fixCount: 1 })!
    expect(one[7].line).toBe('Done · 9:39 · 1 fix')
  })
  it('failed step is Problem, later steps Not yet', () => {
    const s = deriveBehindSteps({ agentRuns: [{ agentKey: 'researcher', status: 'failed', error: 'boom' }], runStatus: 'failed' })!
    expect(s[4]).toMatchObject({ word: 'Problem', line: 'Problem', error: 'boom' })
    expect(s[5]).toMatchObject({ word: 'Not yet', line: 'Not yet' })
    expect(firstProblemStep(s)).toBe('research')
  })
  it('gate interrupt waits, never Problem', () => {
    const s = deriveBehindSteps({
      agentRuns: [{ agentKey: 'editor_gate_1', status: 'failed', error: 'Interrupt(value={})' }],
      runStatus: 'awaiting-review',
    })!
    expect(s[3].word).toBe('Waiting for you')
    expect(firstProblemStep(s)).toBeNull()
  })
  it('running is Working', () => {
    const s = deriveBehindSteps({ agentRuns: [done('origin_story'), { agentKey: 'game', status: 'running' }], runStatus: 'running' })!
    expect(s[6].word).toBe('Working')
  })
  it('cancelled run stops every unfinished step', () => {
    const s = deriveBehindSteps({ agentRuns: [done('signal_editor'), { agentKey: 'scout', status: 'running' }], runStatus: 'cancelled' })!
    expect(s[0].word).toBe('Done')
    expect(s.slice(1).every((x) => x.word === 'Stopped')).toBe(true)
  })
  it('ignores calibrator and unknown keys', () => {
    const s = deriveBehindSteps({ agentRuns: [done('calibrator'), done('mystery')], runStatus: 'running' })!
    expect(s.every((x) => x.word === 'Not yet')).toBe(true)
  })
})

describe('plainNameForKey', () => {
  it('names writers, steps and unknowns', () => {
    expect(plainNameForKey('origin_story')).toBe('Origin story writer')
    expect(plainNameForKey('design')).toBe('Look designer')
    expect(plainNameForKey('calibrator')).toBe('Weekly style note')
    expect(plainNameForKey('qa')).toBe('Check the writing and fix problems')
    expect(plainNameForKey('some_thing')).toBe('Some thing')
  })
})
