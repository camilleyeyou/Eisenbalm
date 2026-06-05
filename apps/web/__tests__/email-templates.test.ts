import { describe, expect, it } from 'vitest'
import { renderEmailStep } from '@eisenbalm/emails'

// Fixtures
const order = {
  amountTotal: 899,
  createdAt: 0,
  customerEmail: 'a@b.c',
  charitySlug: 'nap-ministry',
}

const charity = {
  name: 'The Nap Ministry',
  location: 'Atlanta, GA',
  focusArea: 'Rest',
  missionStatement: 'Rest is resistance.',
}

// EMAIL-04/05/06/08 coverage (replaces Wave-0 it.todo placeholders from Plan 20-01 Task 2)
describe('email-templates (EMAIL-04/05/06/08)', () => {
  it('E1 transactional render contains the funded charity name (EMAIL-04)', async () => {
    const html = await renderEmailStep(1, { order, charity })
    expect(html).toContain('The Nap Ministry')
  })

  it('E3 render contains neither "arrived" nor "delivered" (EMAIL-08)', async () => {
    const html = await renderEmailStep(3, { order, charity })
    expect(html.toLowerCase()).not.toContain('arrived')
    expect(html.toLowerCase()).not.toContain('delivered')
  })

  it('E4 marketing render contains the unsubscribe link (EMAIL-05)', async () => {
    const html = await renderEmailStep(4, {
      order,
      charity,
      unsubscribeToken: 'abc',
      baseUrl: 'https://x',
    })
    expect(html).toContain('/api/email/unsubscribe?token=abc')
  })

  it('E1 transactional render contains NO unsubscribe link (EMAIL-06)', async () => {
    const html = await renderEmailStep(1, {
      order,
      charity,
      unsubscribeToken: 'abc',
    })
    expect(html).not.toContain('/api/email/unsubscribe')
  })

  it('E7 render lists OTHER charities by name', async () => {
    const html = await renderEmailStep(7, {
      order,
      others: [{ name: 'A' }, { name: 'B' }],
    })
    expect(html).toContain('A')
    expect(html).toContain('B')
  })

  it('E8 render shows the fundedMoreCount', async () => {
    const html = await renderEmailStep(8, { order, fundedMoreCount: 3 })
    expect(html).toContain('3')
  })

  it('E5 renders fallback copy when charity is null (no crash)', async () => {
    const html = await renderEmailStep(5, { order, charity: null })
    expect(html).toBeTruthy()
    expect(html.toLowerCase()).toContain('charity')
  })
})
