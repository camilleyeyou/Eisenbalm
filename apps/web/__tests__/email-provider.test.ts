import { describe, it, expect } from 'vitest'
import {
  FakeEmailProvider,
  ResendProvider,
  selectProvider,
} from '@eisenbalm/emails'
import type { SendEmailParams } from '@eisenbalm/emails'

describe('FakeEmailProvider (EMAIL-07 provider behavior)', () => {
  it('records sent emails in .sent[]', async () => {
    const provider = new FakeEmailProvider()
    const params: SendEmailParams = {
      from: 'no-reply@receipts.eisenbalm.com',
      to: 'customer@example.com',
      subject: 'Your order is confirmed.',
      html: '<p>Thank you.</p>',
    }
    await provider.send(params)
    expect(provider.sent).toHaveLength(1)
    expect(provider.sent[0]).toEqual(params)
  })

  it('returns { id: "fake-..." } without network call', async () => {
    const provider = new FakeEmailProvider()
    const result = await provider.send({
      from: 'no-reply@receipts.eisenbalm.com',
      to: 'customer@example.com',
      subject: 'Test',
      html: '<p>Test</p>',
    })
    expect(result.id).toMatch(/^fake-/)
  })

  it('increments the count across multiple sends', async () => {
    const provider = new FakeEmailProvider()
    await provider.send({ from: 'a@a.com', to: 'b@b.com', subject: 'one', html: '' })
    await provider.send({ from: 'a@a.com', to: 'b@b.com', subject: 'two', html: '' })
    expect(provider.sent).toHaveLength(2)
  })
})

describe('selectProvider (EMAIL-07 live-OFF default)', () => {
  it('returns FakeEmailProvider when env is empty (live OFF by default)', () => {
    expect(selectProvider({})).toBeInstanceOf(FakeEmailProvider)
  })

  it('returns FakeEmailProvider when EMAIL_LIVE_SEND is undefined', () => {
    expect(selectProvider({ EMAIL_LIVE_SEND: undefined })).toBeInstanceOf(FakeEmailProvider)
  })

  it('returns FakeEmailProvider when EMAIL_LIVE_SEND is "false"', () => {
    expect(selectProvider({ EMAIL_LIVE_SEND: 'false' })).toBeInstanceOf(FakeEmailProvider)
  })

  it('returns FakeEmailProvider when EMAIL_LIVE_SEND is "true" but RESEND_API_KEY missing', () => {
    // No key => never live; logs a warning (not tested here to avoid console spy complexity)
    expect(selectProvider({ EMAIL_LIVE_SEND: 'true', RESEND_API_KEY: undefined })).toBeInstanceOf(FakeEmailProvider)
  })

  it('returns ResendProvider when EMAIL_LIVE_SEND is "true" AND RESEND_API_KEY is present', () => {
    expect(selectProvider({ EMAIL_LIVE_SEND: 'true', RESEND_API_KEY: 're_x' })).toBeInstanceOf(ResendProvider)
  })
})
