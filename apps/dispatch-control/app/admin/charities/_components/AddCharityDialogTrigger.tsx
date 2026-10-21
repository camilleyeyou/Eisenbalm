'use client'
/**
 * Phase 26 — REG-01: "Add Charity" button + dialog trigger.
 *
 * Wraps the trigger button and the AddCharityDialog in a client component
 * so the Server Component registry/page.tsx can mount it without violating
 * the Next.js App Router Server/Client boundary.
 */
import { useState } from 'react'
import AddCharityDialog from './AddCharityDialog'

interface AddCharityDialogTriggerProps {
  workspace_id: string
}

export default function AddCharityDialogTrigger({
  workspace_id,
}: AddCharityDialogTriggerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[44px] border border-[color:var(--color-ink)] bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[13px] font-semibold text-[color:var(--color-masthead-text)] hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-vermilion)] focus-visible:ring-offset-1"
      >
        Add Charity
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="presentation"
          onClick={e => {
            // Close on backdrop click
            if (e.target === e.currentTarget) setOpen(false)
          }}
        >
          <div className="w-full max-w-md mx-4">
            <AddCharityDialog
              workspace_id={workspace_id}
              onClose={() => setOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  )
}
