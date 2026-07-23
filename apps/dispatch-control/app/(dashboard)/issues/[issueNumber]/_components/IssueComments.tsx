'use client'
/**
 * Phase 49 Plan 08 (ROL-04, §49.2/§49.3) — the reusable comments affordance.
 *
 * Built so a Collaborator can read every screen and leave a comment — the
 * one write ROL-04 grants regardless of role (D-12/D-13). Wired to the
 * comments-table list query (unguarded read, oldest-first) and its add
 * mutation (ANY authenticated identity — a THIRD auth lane, neither of the
 * two role-gate helpers in convex/lib/auth.ts — see convex/comments.ts and
 * 49-RESEARCH.md Open Question 4). See §49.3 for the exact function shapes.
 *
 * Deliberately NOT wrapped in the shared role-gate wrapper components 49-06/
 * 49-07 introduced for the six ROL-02 actions — commenting is never
 * editor-gated (ROL-04 is the positive Collaborator capability, the inverse
 * of those six).
 *
 * Flat only (D-13): no threading, no @mentions, no notifications. Mounted by
 * the persistent issue-workspace layout (FrameChrome, `layout.tsx`, sibling
 * to — never inside — the per-stage collapsible panel's content slot) and by
 * `MyTasksScreen.tsx` (a sibling route, not nested under that layout).
 *
 * quick 260722-tv1: caps to the latest 20 comments (the query is
 * oldest-first, so `slice(-20)` is the latest 20, in order) with a "Show
 * earlier comments" toggle ABOVE the list — an unbounded thread ran
 * indefinitely long on a heavily-discussed issue.
 */
import { useState } from 'react'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@convex/_generated/api'
import { DEFAULT_WORKSPACE_ID } from '@/lib/workspace'

export interface IssueCommentsProps {
  issueNumber: number
  /** Optional stage scope ('story'|'draft'|'fact-check'|'voice'|'approval'); omitted = issue-overview-level. */
  stage?: string
}

export default function IssueComments({ issueNumber, stage }: IssueCommentsProps) {
  const comments = useQuery(api.comments.listByIssueNumber, {
    workspace_id: DEFAULT_WORKSPACE_ID,
    issueNumber,
    stage,
  })
  const addComment = useMutation(api.comments.add)

  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [showAllComments, setShowAllComments] = useState(false)

  // comments is oldest-first — the latest 20 is the trailing slice, and
  // slice() preserves chronological order within it.
  const visibleComments =
    comments === undefined ? [] : showAllComments ? comments : comments.slice(-20)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || busy) return

    setBusy(true)
    try {
      await addComment({
        workspace_id: DEFAULT_WORKSPACE_ID,
        issueNumber,
        stage,
        text: trimmed,
      })
      setText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[2px] border border-[color:var(--color-ink)]/[.1] bg-[color:var(--color-card)] p-4">
      <h2 className="font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.08em] text-[color:var(--color-ink-soft)]">
        Comments
      </h2>

      {comments === undefined ? (
        <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink-soft)]">
          Loading…
        </p>
      ) : comments.length === 0 ? (
        <p className="font-[family-name:var(--font-ui)] text-[13px] italic text-[color:var(--color-ink-soft)]">
          No comments yet.
        </p>
      ) : (
        <>
          {comments.length > 20 && !showAllComments && (
            <button
              type="button"
              onClick={() => setShowAllComments(true)}
              className="self-start font-[family-name:var(--font-ui)] text-[12px] font-medium text-[color:var(--color-cobalt)] hover:underline"
            >
              Show earlier comments ({comments.length - 20})
            </button>
          )}
          <ul role="list" className="flex flex-col gap-2">
          {visibleComments.map(c => (
            <li
              key={c._id}
              className="border-b border-[color:var(--color-ink)]/[.08] pb-2 last:border-b-0 last:pb-0"
            >
              <p className="font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)]">
                {c.text}
              </p>
              <p className="font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink-soft)]">
                {c.authorId} · {new Date(c.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
          </ul>
        </>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-2">
        <label
          htmlFor={`issue-comment-input-${issueNumber}-${stage ?? 'overview'}`}
          className="sr-only"
        >
          Add a comment
        </label>
        <textarea
          id={`issue-comment-input-${issueNumber}-${stage ?? 'overview'}`}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          className="min-h-[44px] w-full rounded-[2px] border border-[color:var(--color-ink)]/[.15] p-2 font-[family-name:var(--font-ui)] text-[13px] text-[color:var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-cobalt)]"
        />
        <button
          type="submit"
          disabled={busy || text.trim().length === 0}
          className="min-h-[44px] self-end rounded-[2px] bg-[color:var(--color-ink)] px-4 font-[family-name:var(--font-ui)] text-[11px] font-semibold uppercase tracking-[.04em] text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-cobalt)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Post comment
        </button>
      </form>
    </div>
  )
}
