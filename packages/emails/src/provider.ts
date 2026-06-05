export interface SendEmailParams {
  from: string
  to: string
  subject: string
  html: string
  headers?: Record<string, string>
}

export interface SendEmailProvider {
  send(params: SendEmailParams): Promise<{ id: string }>
}

export class FakeEmailProvider implements SendEmailProvider {
  public sent: SendEmailParams[] = []
  async send(params: SendEmailParams) {
    this.sent.push(params)
    return { id: `fake-${this.sent.length}-${Date.now()}` }
  }
}

export class ResendProvider implements SendEmailProvider {
  constructor(private apiKey: string) {}
  async send(params: SendEmailParams) {
    // Lazy import so packages/emails has no hard dependency on resend at module load.
    const { Resend } = await import('resend')
    const client = new Resend(this.apiKey)
    const res = await client.emails.send(params as Parameters<typeof client.emails.send>[0])
    if (res.error) throw new Error(`Resend error: ${res.error.message}`)
    return { id: res.data?.id ?? '' }
  }
}

export interface ProviderEnv {
  EMAIL_LIVE_SEND?: string
  RESEND_API_KEY?: string
  // Index signature so a raw `process.env` (NodeJS.ProcessEnv) is assignable.
  [key: string]: string | undefined
}

/** Live sending is OFF unless EMAIL_LIVE_SEND==='true' AND RESEND_API_KEY is present. Everything else => Fake. */
export function selectProvider(env: ProviderEnv): SendEmailProvider {
  if (env.EMAIL_LIVE_SEND === 'true' && env.RESEND_API_KEY) {
    return new ResendProvider(env.RESEND_API_KEY)
  }
  if (env.EMAIL_LIVE_SEND === 'true' && !env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn('[emails] EMAIL_LIVE_SEND=true but RESEND_API_KEY missing — falling back to FakeEmailProvider.')
  }
  return new FakeEmailProvider()
}
