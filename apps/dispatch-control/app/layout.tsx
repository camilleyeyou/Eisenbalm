import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Eisenbalm Dispatch Control',
  description: 'Mission Control dashboard for the Eisenbalm editorial pipeline.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
