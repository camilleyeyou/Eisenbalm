'use client'

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <section className="mx-auto max-w-[680px] px-4 md:px-6 lg:px-8 py-16">
      <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-tight text-[color:var(--color-text)]">
        This issue could not be loaded.
      </h1>
      <p className="mt-6 font-body text-[18px] text-[color:var(--color-text)]">
        Try refreshing.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-6 font-ui text-[14px] underline underline-offset-4 hover:text-[color:var(--color-accent)]"
      >
        Try again
      </button>
    </section>
  )
}
