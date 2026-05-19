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
    awaitingHumanAt: v.optional(v.number()), // PIP-10: Unix ms when Editor gate 1 called interrupt() and paused for Andrew. Enables SLA alerting on stuck runs.
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
      v.literal('cost-warning'),                // Phase 5 D-08: CostRecorder soft-warn at 70% of PIPELINE_COST_CAP_USD
      v.literal('agent-tool-limit-exceeded'),   // Phase 5 D-21: max_tool_calls overrun on Scout/Researcher
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
    agentId: v.optional(v.string()),         // Phase 5 D-01: always 'qa' for new rows
    sectionName: v.string(),                  // which editorial section
    fieldName: v.optional(v.string()),        // Phase 5 unused; legacy compat (Phase 4 rewrite-shape)
    original: v.optional(v.string()),         // Phase 5 unused; legacy compat
    corrected: v.optional(v.string()),        // Phase 5 unused (D-02 annotation-only); legacy compat
    reason: v.string(),                       // Phase 5 maps Pydantic `reason` directly into this
    severity: v.union(
      v.literal('info'),                     // Phase 5 D-01: minor suggestion; Andrew may ignore
      v.literal('warning'),                  // Phase 5 D-01: borderline; Andrew should review
      v.literal('error'),                    // Phase 5 D-01: clear voice/factual violation; Andrew must review
    ),
    accepted: v.boolean(),                    // Phase 5 writes `false` on every row; Andrew flips in Phase 9
    // ── New Phase 5 fields (D-01 LLM-judge structured output) ─────────────
    axis: v.optional(v.union(
      v.literal('gravity'),
      v.literal('sentiment'),
      v.literal('irony-signaling'),
      v.literal('precision'),
      v.literal('cross-section-consistency'),
      v.literal('hard-rule'),                // Layer-1 deterministic findings
    )),
    quotedSpan: v.optional(v.string()),       // exact offending text
    suggestedFix: v.optional(v.string()),     // concrete alternative
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

  // ── Stripe events: idempotency dedup table (Phase 8 — CMR-06) ────────────
  // One row per unique Stripe event.id we have processed. The unique
  // by_eventId index + Convex per-table mutation serialization gives us
  // atomic check-and-insert via the `claim` mutation (see convex/stripeEvents.ts).
  stripeEvents: defineTable({
    eventId: v.string(),       // Stripe evt_... — unique per event delivery
    eventType: v.string(),     // e.g. 'checkout.session.completed'
    livemode: v.boolean(),     // matches event.livemode from Stripe
    receivedAt: v.number(),    // Date.now() server-side
  })
    .index('by_eventId', ['eventId']),

  // ── Stripe orders: minimal audit trail (Phase 8 — Open Question 2) ───────
  // Behind STRIPE_RECORD_ORDERS env flag (default 'true'). One row per
  // checkout.session.completed event we processed. Stripe Dashboard remains
  // source of truth for orders; this exists so we can answer
  // "how much went to charity X this week" without paginating Stripe API.
  stripeOrders: defineTable({
    sessionId: v.string(),     // cs_test_... or cs_live_...
    eventId: v.string(),       // evt_... that fulfilled this order
    amountTotal: v.number(),   // cents (Stripe convention)
    currency: v.string(),      // 'usd', 'eur', etc.
    customerEmail: v.optional(v.string()),
    charitySlug: v.optional(v.string()),  // current charity at click time
    createdAt: v.number(),     // Date.now() server-side
  })
    .index('by_sessionId', ['sessionId'])
    .index('by_charitySlug_createdAt', ['charitySlug', 'createdAt']),
})
