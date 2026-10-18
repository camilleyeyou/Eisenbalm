/**
 * Agent profile page. DEL-06 link target.
 *
 * Minimal RSC that fetches an agentProfile by agentId (Sanity slug) and
 * renders displayName, role, personality, and avatar if present.
 *
 * Constraints (DEL-04 / DEL-06):
 *   - Renders ONLY: displayName, role, personality, avatarUrl from agentProfile.
 *   - NEVER renders any model name, modelVersions, or pipelineRuns cost.
 *   - notFound() for unknown / synthetic agentIds (e.g. 'game-validator').
 *   - Single <main> rule: this component renders a <section> inside the root
 *     layout's <main id="main"> — NO second <main> element.
 *
 * The 14 valid agentIds: calibrator, scout, advocate, editor, researcher,
 * origin-story, problem-statement, founder-bio, case-study, game, bonus,
 * design, qa, publisher. All others 404 gracefully.
 */
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { groq } from 'next-sanity'

import { sanityClient } from '@/lib/sanity/client'
import type { AgentProfile } from '@/lib/sanity/types'
import { SitePage } from '@/components/dispatch/SitePage'
import '@/components/dispatch/pages.css'

// ─── Query ─────────────────────────────────────────────────────────────────────

const QUERY_AGENT_PROFILE_BY_ID = groq`
  *[_type == "agentProfile" && agentId.current == $agentId][0] {
    "agentId": agentId.current,
    displayName,
    role,
    personality,
    "avatarUrl": avatar.asset->url
  }
`

// ─── Props ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ agentId: string }>
}

// ─── generateMetadata ──────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { agentId } = await params
  let profile: AgentProfile | null = null
  try {
    profile = await sanityClient.fetch<AgentProfile | null>(
      QUERY_AGENT_PROFILE_BY_ID,
      { agentId },
    )
  } catch {
    // fall through
  }
  return {
    title: profile?.displayName ?? 'Agent Profile',
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AgentProfilePage({ params }: PageProps) {
  const { agentId } = await params

  let profile: AgentProfile | null = null
  try {
    profile = await sanityClient.fetch<AgentProfile | null>(
      QUERY_AGENT_PROFILE_BY_ID,
      { agentId },
    )
  } catch {
    // fall through to notFound
  }

  if (!profile) notFound()

  return (
    <SitePage tone="paper" narrow>
      <section aria-label="Agent profile">
        {/* Back link */}
        <nav className="d-crumb" aria-label="Breadcrumb">
          <a href="/" className="d-tap d-label d-link">
            ← The Eisenbalm Dispatch
          </a>
        </nav>

        <article>
          {/* Avatar */}
          {profile.avatarUrl && (
            <img
              src={profile.avatarUrl}
              alt={`${profile.displayName} avatar`}
              width={80}
              height={80}
              className="d-avatar"
            />
          )}

          {/* Eyebrow: role */}
          <p className="d-eyebrow d-muted">{profile.role}</p>

          {/* Display name */}
          <h1 className="d-display">{profile.displayName}</h1>

          {/* Personality / bio */}
          {profile.personality && (
            <div className="d-prose d-detail-section">
              <p>{profile.personality}</p>
            </div>
          )}
        </article>
      </section>
    </SitePage>
  )
}
