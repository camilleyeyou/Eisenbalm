import Link from 'next/link'

export default function NotFound() {
  return (
    <section className="mx-auto max-w-[680px] px-4 md:px-6 lg:px-8 py-16">
      <h1 className="font-display text-[28px] md:text-[36px] font-semibold leading-tight text-[color:var(--color-text)]">
        This page does not exist.
      </h1>
      <p className="mt-6 font-body text-[18px] text-[color:var(--color-text)]">
        Try the{' '}
        <Link
          href="/archive"
          className="underline underline-offset-4 hover:text-[color:var(--color-accent)]"
        >
          archive
        </Link>
        .
      </p>
    </section>
  )
}
