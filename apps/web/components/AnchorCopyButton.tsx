'use client'

/**
 * Anchor copy-link button. UI-SPEC §AnchorCopyButton.
 *
 * Copies the full URL with #sectionId fragment to the clipboard.
 * Uses shadcn <Tooltip> (controlled open state) to show "Copied" feedback
 * that fades after 1500ms. Radix-based Tooltip (installed by Plan 02-05).
 *
 * Voice rules (CONTEXT.md / UI-SPEC copywriting contract):
 *   - Tooltip copy: "Copied" (no period, no exclamation)
 *   - aria-label: "Copy link to this section"
 *
 * Security: navigator.clipboard.writeText is called with a URL built from
 * window.location.origin + window.location.pathname + '#' + sectionId.
 * No raw user-supplied content enters the clipboard string.
 */

import { useState, useCallback } from 'react'
import { Link } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface AnchorCopyButtonProps {
  /** The section ID (without the '#' prefix, e.g., "origin-story"). */
  sectionId: string
  className?: string
}

export function AnchorCopyButton({ sectionId, className }: AnchorCopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    const url =
      window.location.origin + window.location.pathname + '#' + sectionId
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      // Fade feedback after 1500ms (UI-SPEC §AnchorCopyButton)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard write can fail in restricted contexts; fail silently.
    }
  }, [sectionId])

  return (
    <Tooltip open={copied || undefined}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy link to this section"
          className={[
            'inline-flex min-h-11 min-w-11 items-center justify-center rounded',
            'text-[color:var(--color-text-muted,var(--color-text))] opacity-50',
            'transition-opacity hover:opacity-100',
            'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
            'focus-visible:outline-[color:var(--color-primary)]',
            'print:hidden',
            className ?? '',
          ]
            .join(' ')
            .trim()}
        >
          <Link
            size={14}
            aria-hidden="true"
            // Accent color in copied state per UI-SPEC Color System §Accent Reserved For
            className={copied ? 'text-[color:var(--color-accent)]' : undefined}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {/* "Copied" — exact copy from UI-SPEC copywriting contract */}
        Copied
      </TooltipContent>
    </Tooltip>
  )
}
