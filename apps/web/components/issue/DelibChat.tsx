'use client'

/**
 * DelibChat — Phase 19 deliberation centerpiece: chat-style staggered transcript.
 * UI-SPEC §10 Right Chat Transcript + §Accessibility ARIA + §Motion Contract.
 *
 * - framer-motion stagger: containerVariants staggerChildren 0.26s
 * - messageVariants: opacity 0 y14 → opacity 1 y0 over 0.5s
 * - useInView(ref, { once:true, amount:0.2 }) for trigger
 * - useReducedMotion(): when set, all messages are immediately visible
 *   (initial={false}, no per-message variants applied — DEL-04 opacity-0 trap avoided)
 * - role="log" + aria-live="polite" for screen readers (UI-SPEC §Accessibility line 721)
 * - onComplete() called after last message reveal (parent triggers ConfidenceBar 200ms later)
 * - DEL-04: speaker → display name via const map ONLY. Never interpolates model/provider strings.
 *
 * Dark-band inline constants (never CSS vars):
 *   chat body: #CFC9BB  editor body: #E8E3D6  who label: #8A8273
 *   Scout avatar: #5E7359  Advocate avatar: #3D6285
 */

import { useRef, useEffect } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'

// DEL-04: Only these three display names may appear. Never model names.
const SPEAKER_NAMES: Record<string, string> = {
  scout:    'The Scout',
  advocate: 'The Advocate',
  editor:   'The Editor',
}

// Avatar colors per UI-SPEC §10 (house agent identity — dark band context)
const AVATAR_STYLE: Record<string, { bg: string; letter: string }> = {
  scout:    { bg: '#5E7359', letter: 'S' },
  advocate: { bg: '#3D6285', letter: 'A' },
  editor:   { bg: 'var(--color-accent)', letter: 'E' },
}

// framer-motion stagger pattern (RESEARCH lines 510-551)
const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.26,
    },
  },
}

const messageVariants = {
  hidden:  { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
}

type Message = {
  speaker: 'scout' | 'advocate' | 'editor'
  text: string
}

type Props = {
  messages: Message[]
  onComplete?: () => void
}

export function DelibChat({ messages, onComplete }: Props) {
  const prefersReducedMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })
  const onCompleteCalledRef = useRef(false)

  // Call onComplete after last message reveals
  useEffect(() => {
    if (onCompleteCalledRef.current) return
    if (!onComplete) return

    if (prefersReducedMotion) {
      // Under reduced-motion: all messages immediately visible → call immediately
      onCompleteCalledRef.current = true
      onComplete()
      return
    }

    if (isInView) {
      // Stagger timing: messages.length * 260ms + 500ms for last message to complete
      const delay = messages.length * 260 + 500
      const t = setTimeout(() => {
        onCompleteCalledRef.current = true
        onComplete()
      }, delay)
      return () => clearTimeout(t)
    }
  }, [isInView, prefersReducedMotion, onComplete, messages.length])

  return (
    <motion.div
      ref={ref}
      role="log"
      aria-live="polite"
      aria-label="Deliberation conversation"
      style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
      variants={containerVariants}
      initial={prefersReducedMotion ? false : 'hidden'}
      animate={isInView || prefersReducedMotion ? 'visible' : 'hidden'}
    >
      {messages.map((msg, i) => {
        const displayName = SPEAKER_NAMES[msg.speaker] ?? 'The Editor'
        const avatar = AVATAR_STYLE[msg.speaker] ?? AVATAR_STYLE.editor
        const isEditor = msg.speaker === 'editor'

        return (
          <motion.div
            key={i}
            className="msg"
            variants={prefersReducedMotion ? undefined : messageVariants}
          >
            {/* Avatar circle */}
            <div
              className="avatar"
              style={{ background: avatar.bg }}
              aria-hidden="true"
            >
              {avatar.letter}
            </div>

            {/* Message body */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Who label */}
              <p className="msg-who">
                <b
                  style={{
                    color: '#FBFAF6',
                    fontWeight: 500,
                  }}
                >
                  {displayName}
                </b>
              </p>

              {/* Message text */}
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '15.5px',
                  fontWeight: 300,
                  color: isEditor ? '#E8E3D6' : '#CFC9BB',
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {msg.text}
              </p>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}
