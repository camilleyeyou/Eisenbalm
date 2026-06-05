---
phase: 20-post-purchase-email-lifecycle-8-email-flow
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - pnpm-workspace.yaml
  - packages/emails/package.json
  - packages/emails/tsconfig.json
  - packages/emails/src/index.ts
  - packages/emails/src/offsets.ts
  - packages/emails/src/suppression.ts
  - packages/emails/src/token.ts
  - packages/emails/src/subjects.ts
  - packages/emails/src/provider.ts
  - apps/web/package.json
  - apps/web/__tests__/email-offsets.test.ts
  - apps/web/__tests__/email-suppression.test.ts
  - apps/web/__tests__/email-token.test.ts
  - apps/web/__tests__/email-idempotency.test.ts
  - apps/web/__tests__/email-provider.test.ts
autonomous: true
requirements: [EMAIL-01, EMAIL-02, EMAIL-03, EMAIL-07]
must_haves:
  truths:
    - "The 8 purchase-anchored offsets are encoded as exact ms constants (E1 +0 ... E8 +42d) and unit-tested"
    - "A pure suppression function decides marketing-step suppression without any Convex import"
    - "A pure idempotency function decides whether a step may send given an existing ledger row"
    - "unsubscribe tokens are 64-char hex and collision-resistant"
    - "A SendEmailProvider abstraction exists with a Resend impl and a Fake impl; live sending is OFF by default"
    - "convex/ and apps/web/ can both import from @eisenbalm/emails via source resolution (no build step)"
  artifacts:
    - path: "packages/emails/package.json"
      provides: "@eisenbalm/emails workspace package (source-resolution, mirrors @eisenbalm/shared)"
      contains: "@eisenbalm/emails"
    - path: "packages/emails/src/offsets.ts"
      provides: "OFFSETS_MS array (8 entries) + STEP_STREAM map (transactional/marketing)"
      exports: ["OFFSETS_MS", "STEP_STREAM", "isMarketingStep"]
    - path: "packages/emails/src/suppression.ts"
      provides: "shouldSuppressStep(step, subscriber) pure function"
      exports: ["shouldSuppressStep"]
    - path: "packages/emails/src/token.ts"
      provides: "generateUnsubscribeToken() -> 64-char hex"
      exports: ["generateUnsubscribeToken"]
    - path: "packages/emails/src/provider.ts"
      provides: "SendEmailProvider interface + ResendProvider + FakeEmailProvider + selectProvider(env)"
      exports: ["SendEmailProvider", "ResendProvider", "FakeEmailProvider", "selectProvider"]
    - path: "packages/emails/src/index.ts"
      provides: "barrel export of all pure helpers + provider"
      min_lines: 5
  key_links:
    - from: "pnpm-workspace.yaml"
      to: "packages/emails"
      via: "workspace glob packages/*"
      pattern: "packages/\\*"
    - from: "apps/web/package.json"
      to: "@eisenbalm/emails"
      via: "workspace:* dependency"
      pattern: "@eisenbalm/emails.*workspace"
---

<objective>
Scaffold the `@eisenbalm/emails` workspace package and the pure, Convex-free business logic that the rest of Phase 20 builds on: the 8 purchase-anchored offset constants, the marketing-suppression decision function, the idempotency decision function, unsubscribe-token generation, per-step subjects, and the `SendEmailProvider` abstraction (Resend impl + Fake impl + env-gated selector with live sending OFF by default).

Purpose: Research flags that Convex has no unit-test SDK — so all testable logic must live as pure functions importable by both `convex/` (Wave 2) and `apps/web/` (Wave 3/4). This plan creates the seam and the Wave 0 vitest coverage so every later task has a green sampling target.
Output: A source-resolution workspace package (mirrors `@eisenbalm/shared`) plus 5 vitest files covering EMAIL-01/02/03/07.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-BRIEF.md
@.planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-RESEARCH.md

<interfaces>
<!-- Existing workspace patterns the executor must mirror. No codebase exploration needed. -->

packages/shared/package.json (the source-resolution pattern to COPY — no build step):
```json
{
  "name": "@eisenbalm/shared",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } }
}
```

pnpm-workspace.yaml (already includes packages/* — emails is auto-included; NO yaml edit needed unless adding an explicit entry):
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'convex'
```

apps/web/package.json dependencies already include: convex@^1.38.0, framer-motion, next@^15.3.9, stripe@^21.0.0. devDependencies include vitest@^3.2.0, vite-tsconfig-paths@^5.1.0.

vitest config (apps/web/vitest.config.ts): environment 'node', include ['__tests__/**/*.test.ts','__tests__/**/*.test.tsx'], globals: false. Tests import vitest primitives explicitly: `import { describe, it, expect } from 'vitest'`.

emailSubscribers shape (from 20-RESEARCH.md — Wave 2 builds the Convex table; this plan's pure fns type against it):
```typescript
type SubscriberLike = { consentState: 'subscribed' | 'unsubscribed' } | null | undefined
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Scaffold @eisenbalm/emails workspace package</name>
  <read_first>packages/shared/package.json, packages/shared/tsconfig.json, packages/shared/src/index.ts, pnpm-workspace.yaml</read_first>
  <files>packages/emails/package.json, packages/emails/tsconfig.json, packages/emails/src/index.ts, apps/web/package.json, pnpm-workspace.yaml</files>
  <action>
Create `packages/emails/` as a source-resolution workspace package mirroring `@eisenbalm/shared` EXACTLY (no build step):
- `packages/emails/package.json`: name `@eisenbalm/emails`, `"private": true`, `"type": "module"`, `"main": "./src/index.ts"`, `"types": "./src/index.ts"`, `"exports": { ".": { "types": "./src/index.ts", "default": "./src/index.ts" } }`. devDependencies: `"typescript": "^5.6.0"`. Add a `"typecheck": "tsc --noEmit"` script.
- `packages/emails/tsconfig.json`: copy `packages/shared/tsconfig.json` verbatim (extends the repo base, noEmit). If shared's tsconfig references files that do not exist here, keep only `extends` + `compilerOptions` + `"include": ["src/**/*.ts"]`.
- `packages/emails/src/index.ts`: barrel — `export * from './offsets'`, `export * from './suppression'`, `export * from './token'`, `export * from './subjects'`, `export * from './provider'`. (These files are created in Tasks 2-3; create the barrel now even if some are stubs you fill in this plan.)
- `apps/web/package.json`: add `"@eisenbalm/emails": "workspace:*"` to dependencies (alphabetical, next to `@eisenbalm/shared`).
- `pnpm-workspace.yaml`: leave as-is (`packages/*` already covers it). Do NOT add a redundant entry.
- Run `pnpm install` so the workspace link resolves.

Do NOT add `resend`, `@react-email/render`, or `@react-email/components` here yet — those are added in Plan 20-03 (templates) and the provider's dynamic import keeps this package dependency-light. (`resend` is imported lazily inside ResendProvider in Task 3.)
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm && pnpm install --frozen-lockfile=false >/dev/null 2>&1; node -e "require('./packages/emails/package.json').name === '@eisenbalm/emails' || process.exit(1)" && grep -q '@eisenbalm/emails' apps/web/package.json && echo OK</automated>
  </verify>
  <acceptance_criteria>
- `packages/emails/package.json` `.name` === `@eisenbalm/emails` and `.main` === `./src/index.ts`.
- `apps/web/package.json` dependencies contains `"@eisenbalm/emails": "workspace:*"`.
- `packages/emails/src/index.ts` re-exports offsets, suppression, token, subjects, provider.
- No `resend`/`@react-email/*` dependency added in `packages/emails/package.json`.
  </acceptance_criteria>
  <done>Workspace package resolves; apps/web declares the dependency; barrel exists.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Pure helpers — offsets, suppression, idempotency, token, subjects</name>
  <read_first>packages/emails/src/index.ts, .planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-BRIEF.md, .planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-RESEARCH.md</read_first>
  <files>packages/emails/src/offsets.ts, packages/emails/src/suppression.ts, packages/emails/src/token.ts, packages/emails/src/subjects.ts, apps/web/__tests__/email-offsets.test.ts, apps/web/__tests__/email-suppression.test.ts, apps/web/__tests__/email-token.test.ts, apps/web/__tests__/email-idempotency.test.ts</files>
  <behavior>
    - OFFSETS_MS[0]===0, [1]===1*24*3600_000, [2]===4*24*3600_000, [3]===7*24*3600_000, [4]===9*24*3600_000, [5]===14*24*3600_000, [6]===21*24*3600_000, [7]===42*24*3600_000; length===8
    - isMarketingStep(1..3)===false; isMarketingStep(4..8)===true
    - shouldSuppressStep(3, {consentState:'unsubscribed'})===false (transactional always sends)
    - shouldSuppressStep(4, {consentState:'unsubscribed'})===true
    - shouldSuppressStep(4, {consentState:'subscribed'})===false
    - shouldSuppressStep(4, null)===false (no subscriber row => not suppressed)
    - shouldSendStep(existing) — returns false when existing?.status==='sent', true otherwise (undefined/scheduled/failed)
    - generateUnsubscribeToken() matches /^[0-9a-f]{64}$/ and two calls differ
  </behavior>
  <action>
Create the pure helpers (NO Convex imports, NO React imports — these must run under vitest `node` env):

`packages/emails/src/offsets.ts`:
```typescript
const DAY_MS = 24 * 3600_000
// Index 0 == step 1. Purchase-anchored offsets per 20-BRIEF.
export const OFFSETS_MS: readonly number[] = [
  0,          // E1 Order confirmation +0
  1 * DAY_MS, // E2 Shipping +1d
  4 * DAY_MS, // E3 Delivered estimate +4d
  7 * DAY_MS, // E4 The ritual +7d
  9 * DAY_MS, // E5 Charity receipt +9d
  14 * DAY_MS,// E6 Review ask +14d
  21 * DAY_MS,// E7 Newsletter opt-in +21d
  42 * DAY_MS,// E8 Replenishment +42d
] as const
export type EmailStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
export const STEP_STREAM: Record<number, 'transactional' | 'marketing'> = {
  1:'transactional',2:'transactional',3:'transactional',
  4:'marketing',5:'marketing',6:'marketing',7:'marketing',8:'marketing',
}
export function isMarketingStep(step: number): boolean { return step >= 4 }
export function offsetForStep(step: number): number { return OFFSETS_MS[step - 1] }
```

`packages/emails/src/suppression.ts`:
```typescript
import { isMarketingStep } from './offsets'
export type SubscriberLike = { consentState: 'subscribed' | 'unsubscribed' } | null | undefined
/** Marketing steps (4-8) are suppressed when the subscriber is unsubscribed. Transactional (1-3) never suppressed. */
export function shouldSuppressStep(step: number, subscriber: SubscriberLike): boolean {
  if (!isMarketingStep(step)) return false
  return subscriber?.consentState === 'unsubscribed'
}
/** Idempotency gate: a step may send only if no prior row is already 'sent'. */
export type SendRowLike = { status: 'scheduled' | 'sent' | 'failed' | 'cancelled' | 'skipped' } | null | undefined
export function shouldSendStep(existing: SendRowLike): boolean {
  return existing?.status !== 'sent'
}
```

`packages/emails/src/token.ts`:
```typescript
import { randomBytes } from 'node:crypto'
export function generateUnsubscribeToken(): string { return randomBytes(32).toString('hex') }
```

`packages/emails/src/subjects.ts`: export `SUBJECTS: Record<number,string>` — 8 deadpan Jesse-voice subject DRAFTS (one per step, each prefixed with a `// TODO(Andrew): voice sign-off` comment above the object). Subject for step 3 MUST NOT contain "arrived" or "delivered" (delivery-ESTIMATE safe). Keep them short, honest, non-deceptive (CAN-SPAM). Example step 3: `"It should reach you any day now."`

Then create the 4 vitest files in `apps/web/__tests__/` importing from `@eisenbalm/emails`, encoding the behaviors above. `email-idempotency.test.ts` tests `shouldSendStep`. Each file: `import { describe, it, expect } from 'vitest'`.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/web && npx vitest run __tests__/email-offsets.test.ts __tests__/email-suppression.test.ts __tests__/email-token.test.ts __tests__/email-idempotency.test.ts</automated>
  </verify>
  <acceptance_criteria>
- `npx vitest run` on the 4 files passes with 0 failures.
- `OFFSETS_MS.length === 8` and each value equals the exact ms in the behavior block (assert in test).
- `shouldSuppressStep(3, {consentState:'unsubscribed'}) === false` and `shouldSuppressStep(4, {consentState:'unsubscribed'}) === true` assertions present and green.
- `generateUnsubscribeToken()` assertion `/^[0-9a-f]{64}$/` present and green.
- `SUBJECTS[3]` does not match `/arrived|delivered/i` (asserted in email-offsets or subjects test).
  </acceptance_criteria>
  <done>All four pure-helper test files green; helpers exported from the package barrel.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: SendEmailProvider abstraction (Resend + Fake + env selector, live OFF by default)</name>
  <read_first>packages/emails/src/index.ts, .planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-RESEARCH.md</read_first>
  <files>packages/emails/src/provider.ts, apps/web/__tests__/email-provider.test.ts</files>
  <behavior>
    - new FakeEmailProvider() records each send into .sent[] and returns { id: 'fake-...' } without network
    - selectProvider({ EMAIL_LIVE_SEND: undefined }) returns a FakeEmailProvider (live OFF by default)
    - selectProvider({ EMAIL_LIVE_SEND: 'false' }) returns a FakeEmailProvider
    - selectProvider({ EMAIL_LIVE_SEND: 'true', RESEND_API_KEY: undefined }) returns a FakeEmailProvider (no key => never live; logs a warning)
    - selectProvider({ EMAIL_LIVE_SEND: 'true', RESEND_API_KEY: 're_x' }) returns a ResendProvider
  </behavior>
  <action>
Create `packages/emails/src/provider.ts`:
```typescript
export interface SendEmailParams {
  from: string; to: string; subject: string; html: string
  headers?: Record<string, string>
}
export interface SendEmailProvider {
  send(params: SendEmailParams): Promise<{ id: string }>
}
export class FakeEmailProvider implements SendEmailProvider {
  public sent: SendEmailParams[] = []
  async send(params: SendEmailParams) { this.sent.push(params); return { id: `fake-${this.sent.length}-${Date.now()}` } }
}
export class ResendProvider implements SendEmailProvider {
  constructor(private apiKey: string) {}
  async send(params: SendEmailParams) {
    // Lazy import so packages/emails has no hard dependency on resend at module load.
    const { Resend } = await import('resend')
    const client = new Resend(this.apiKey)
    const res = await client.emails.send(params as any)
    if (res.error) throw new Error(`Resend error: ${res.error.message}`)
    return { id: res.data?.id ?? '' }
  }
}
export interface ProviderEnv { EMAIL_LIVE_SEND?: string; RESEND_API_KEY?: string }
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
```
The lazy `await import('resend')` means vitest tests that only exercise Fake paths never load `resend`. Tests must NOT exercise the live ResendProvider.send path (no network).

Create `apps/web/__tests__/email-provider.test.ts` encoding the behaviors (assert `selectProvider(...)` returns a `FakeEmailProvider` instance via `instanceof` for the OFF/missing-key cases, and a `ResendProvider` instance for the live+key case). Use `instanceof` checks imported from `@eisenbalm/emails`.
  </action>
  <verify>
    <automated>cd /Users/user/Desktop/Eisenbalm/apps/web && npx vitest run __tests__/email-provider.test.ts</automated>
  </verify>
  <acceptance_criteria>
- `email-provider.test.ts` passes with 0 failures.
- Test asserts `selectProvider({}) instanceof FakeEmailProvider === true` (live OFF by default).
- Test asserts `selectProvider({ EMAIL_LIVE_SEND:'true', RESEND_API_KEY:'re_x' }) instanceof ResendProvider === true`.
- No test makes a network call (Resend is dynamically imported and never invoked in tests).
  </acceptance_criteria>
  <done>Provider abstraction green; live sending provably OFF by default; package barrel re-exports it.</done>
</task>

</tasks>

<verification>
- `cd apps/web && npx vitest run __tests__/email-offsets.test.ts __tests__/email-suppression.test.ts __tests__/email-token.test.ts __tests__/email-idempotency.test.ts __tests__/email-provider.test.ts` → all green.
- `pnpm install` resolves `@eisenbalm/emails` as a workspace link.
- `grep -r "from 'resend'" packages/emails/src/provider.ts` returns nothing (the import is `await import('resend')`, lazy).
</verification>

<success_criteria>
- @eisenbalm/emails package exists with source resolution; apps/web depends on it.
- 8 offsets, suppression, idempotency, token, subjects, provider all exported and unit-tested (EMAIL-01/02/03/07 green).
- Live sending OFF by default proven by `selectProvider` tests.
</success_criteria>

<output>
After completion, create `.planning/phases/20-post-purchase-email-lifecycle-8-email-flow/20-01-SUMMARY.md`
</output>
