import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  // One record per weekly pipeline run
  pipelineRuns: defineTable({
    runId: v.string(),           // UUID, matches pipelineMetadata.runId in Sanity
    issueNumber: v.number(),
    status: v.union(
      v.literal('running'),
      v.literal('awaiting-review'), // paused at Andrew gate
      v.literal('complete'),
      v.literal('failed'),
    ),
    startedAt: v.number(),       // Unix timestamp ms
    completedAt: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    // ── Phase 4 additions (CONTEXT D-22, D-23, D-39) ────────────────────────
    durationMs: v.optional(v.number()),  // PIP-12: pipeline wall-clock ms
    cost: v.optional(v.string()),         // PIP-11 + OPS-03: JSON-stringified per-agent cost summary
  })
    .index('by_runId', ['runId'])
    .index('by_issueNumber', ['issueNumber']),

  // All agent events during a pipeline run — the raw deliberation stream
  // This feeds the deliberation layer on the frontend in real time
  deliberationEvents: defineTable({
    runId: v.string(),
    agentId: v.string(),         // matches agentProfile.agentId in Sanity
    eventType: v.union(
      v.literal('scout-finding'),      // Scout found a candidate charity
      v.literal('advocate-argument'),  // Advocate built case for a candidate
      v.literal('editor-decision'),    // Editor gate 1 selected winner
      v.literal('section-draft'),      // Section agent produced draft
      v.literal('qa-correction'),      // QA flagged and corrected something
      v.literal('editor-final'),       // Editor final approved
      v.literal('publisher-deploy'),   // Publisher built and deployed
    ),
    payload: v.string(),         // JSON string — structure varies by eventType
    charityId: v.optional(v.string()), // Sanity charity _id, for candidate-specific events
    sectionName: v.optional(v.string()), // e.g. 'originStory', 'founderBio'
    timestamp: v.number(),
  })
    .index('by_runId', ['runId'])
    .index('by_runId_and_type', ['runId', 'eventType']),

  // Explicit votes with reasoning — subset of deliberationEvents but queryable
  agentVotes: defineTable({
    runId: v.string(),
    agentId: v.string(),
    charityId: v.string(),       // Sanity charity _id
    charityName: v.string(),     // Denormalized for fast reads
    vote: v.union(
      v.literal('for'),
      v.literal('against'),
      v.literal('abstain'),
    ),
    reasoning: v.string(),
    timestamp: v.number(),
  })
    .index('by_runId', ['runId'])
    .index('by_runId_and_charity', ['runId', 'charityId']),

  // QA corrections as a queryable table — shown in the deliberation layer
  // as a record of what QA caught and why
  qaCorrections: defineTable({
    runId: v.string(),
    sectionName: v.string(),     // which editorial section
    fieldName: v.string(),       // which field within the section
    original: v.string(),        // what the agent wrote
    corrected: v.string(),       // what QA changed it to
    reason: v.string(),          // why QA flagged it
    severity: v.union(
      v.literal('minor'),        // word choice, tone
      v.literal('moderate'),     // factual issue, voice drift
      v.literal('major'),        // values violation, accuracy failure
    ),
    accepted: v.boolean(),       // whether Editor final accepted the correction
    timestamp: v.number(),
  })
    .index('by_runId', ['runId'])
    .index('by_runId_and_section', ['runId', 'sectionName']),

  // Pitch log — the Scout's candidate pitches before deliberation
  // Displayed in the deliberation layer as "the pitch log this week"
  pitchLog: defineTable({
    runId: v.string(),
    charityId: v.optional(v.string()),  // Sanity charity _id (if already exists)
    charityName: v.string(),
    charityLocation: v.string(),
    charityWebsite: v.optional(v.string()),
    assetRange: v.optional(v.string()),
    focusArea: v.optional(v.string()),
    scoutSummary: v.string(),    // Why Scout surfaced this one
    selected: v.boolean(),       // Whether this one won
    timestamp: v.number(),
  })
    .index('by_runId', ['runId'])
    .index('by_runId_and_selected', ['runId', 'selected']),
})
