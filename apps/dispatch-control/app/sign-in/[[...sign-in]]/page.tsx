// Source: https://clerk.com/docs/quickstarts/nextjs
// Catch-all route segment [[...sign-in]] is required for Clerk's <SignIn /> component.
//
// quick 260723-4a6 (Task 1): branded two-panel sign-in — an ink wordmark
// band (left, hidden below md) + the Clerk widget (right) on the 1c rail
// background, replacing the bare centered box on neutral-50. Server
// Component (no state needed here); the `appearance` prop maps Clerk's
// internal styling to the 1c design tokens.
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--color-rail)] md:flex-row">
      <div className="hidden flex-col justify-center gap-4 bg-[color:var(--color-ink)] p-12 text-[color:var(--color-masthead-text)] md:flex md:w-1/2">
        <span className="whitespace-nowrap font-[family-name:var(--font-ui)] text-[28px] font-bold tracking-[.03em]">
          DISPATCH<span className="text-[color:var(--color-vermilion)]">/</span>CONTROL
        </span>
        <p className="max-w-sm font-[family-name:var(--font-ui)] text-[14px] leading-relaxed text-[color:var(--color-masthead-muted)]">
          The editorial console behind The Eisenbalm Dispatch — nine agents draft, one human
          approves.
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <SignIn
          appearance={{
            variables: {
              colorPrimary: 'var(--color-ink)',
              borderRadius: '2px',
              fontFamily: 'var(--font-ui)',
            },
          }}
        />
      </div>
    </div>
  )
}
