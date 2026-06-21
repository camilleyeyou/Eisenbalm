// Source: https://clerk.com/docs/quickstarts/nextjs
// Catch-all route segment [[...sign-in]] is required for Clerk's <SignIn /> component.
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50">
      <SignIn />
    </div>
  )
}
